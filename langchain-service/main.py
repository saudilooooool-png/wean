"""
Wean – LangChain / FastAPI service
- Google Maps: Playwright scraping (بدون API key)
- AI Intent: نموذج محلي sentence-transformers (بدون أي API خارجي)
- Reviews: عرض مباشر للتعليقات الحقيقية (بدون توليد AI)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import re
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import quote

import redis.asyncio as aioredis
import structlog
from appwrite.client import Client as AppwriteClient
from appwrite.id import ID
from appwrite.services.databases import Databases
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from playwright.async_api import Browser, async_playwright
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from tenacity import retry, stop_after_attempt, wait_exponential

from intent_model import PLACE_LABEL_AR, classifier


# ─── Configuration ────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/3"
    appwrite_endpoint: str = "http://appwrite:80/v1"
    appwrite_project_id: str = ""
    appwrite_api_key: str = ""
    app_env: str = "production"
    log_level: str = "info"
    appwrite_db_id: str = "wean_db"
    appwrite_sessions_collection: str = "sessions"
    appwrite_searches_collection: str = "searches"
    max_results: int = 5
    cache_ttl_seconds: int = 3600
    scrape_timeout_ms: int = 20000
    max_concurrent_scrapes: int = 3

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.log_level.upper(), logging.INFO)
    ),
)
log = structlog.get_logger()


# ─── Global state ─────────────────────────────────────────────────────────────

redis_client: aioredis.Redis | None = None
appwrite_db: Databases | None = None
_browser: Browser | None = None
_pw = None
_scrape_sem: asyncio.Semaphore | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, appwrite_db, _browser, _pw, _scrape_sem

    log.info("wean.startup", env=settings.app_env)

    # تحميل نموذج الذكاء المحلي (مرة واحدة)
    await asyncio.to_thread(classifier.load)
    log.info("intent_classifier.ready")

    redis_client = aioredis.from_url(
        settings.redis_url, encoding="utf-8", decode_responses=True
    )
    await redis_client.ping()
    log.info("redis.connected")

    _pw = await async_playwright().start()
    _browser = await _pw.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ],
    )
    _scrape_sem = asyncio.Semaphore(settings.max_concurrent_scrapes)
    log.info("playwright.ready")

    if settings.appwrite_project_id and settings.appwrite_api_key:
        try:
            aw = AppwriteClient()
            aw.set_endpoint(settings.appwrite_endpoint)
            aw.set_project(settings.appwrite_project_id)
            aw.set_key(settings.appwrite_api_key)
            appwrite_db = Databases(aw)
            log.info("appwrite.connected")
        except Exception as exc:
            log.warning("appwrite.init_failed", error=str(exc))

    yield

    await _browser.close()
    await _pw.stop()
    await redis_client.aclose()
    log.info("wean.shutdown")


app = FastAPI(
    title="Wean Service",
    version="3.0.0",
    description="WhatsApp location search — Playwright + Local AI (no external API)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic models ──────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    place_type: str
    radius: int = Field(default=2000, ge=100, le=50000)
    max_results: int = Field(default=5, ge=1, le=10)
    phone_number: str | None = None


class SearchResponse(BaseModel):
    places: list[dict[str, Any]]
    formatted_message: str
    total_found: int


class IntentRequest(BaseModel):
    text: str
    phone_number: str | None = None


class IntentResponse(BaseModel):
    place_type: str | None
    confidence: float
    raw_text: str
    suggested_reply: str


# ─── خريطة نوع المكان (عربي ← Google type) ──────────────────────────────────

PLACE_TYPE_MAP: dict[str, str] = {
    "مطعم": "restaurant", "مطاعم": "restaurant", "أكل": "restaurant",
    "اكل": "restaurant", "طعام": "restaurant", "غداء": "restaurant",
    "عشاء": "restaurant", "فطور": "restaurant",
    "كافيه": "cafe", "كافيهات": "cafe", "قهوة": "cafe",
    "مقهى": "cafe", "مقاهي": "cafe", "كوفي": "cafe",
    "صيدلية": "pharmacy", "صيدليات": "pharmacy", "دواء": "pharmacy",
    "مستشفى": "hospital", "مستشفيات": "hospital", "طوارئ": "hospital",
    "سوبرماركت": "supermarket", "بقالة": "supermarket", "دكان": "supermarket",
    "مسجد": "mosque", "مساجد": "mosque", "جامع": "mosque",
    "بنزين": "gas_station", "محطة": "gas_station", "وقود": "gas_station",
    "صراف": "atm", "صرافة": "atm",
    "مخبز": "bakery", "خبز": "bakery",
    "حديقة": "park", "منتزه": "park",
    "فندق": "lodging", "فنادق": "lodging",
}

PLACE_TYPE_EN_QUERY: dict[str, str] = {
    "restaurant": "restaurants", "cafe": "cafes coffee shops",
    "pharmacy": "pharmacies", "hospital": "hospitals clinics",
    "supermarket": "supermarkets grocery", "mosque": "mosques",
    "gas_station": "gas stations", "atm": "ATMs",
    "bakery": "bakeries", "park": "parks",
    "lodging": "hotels",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _cache_key(lat: float, lng: float, place_type: str, radius: int) -> str:
    raw = f"{lat:.4f}:{lng:.4f}:{place_type}:{radius}"
    return "wean:search:" + hashlib.md5(raw.encode()).hexdigest()


def _stars(rating: float | None) -> str:
    if rating is None:
        return "لا يوجد تقييم"
    filled = round(rating)
    return "⭐" * filled + "☆" * (5 - filled) + f" ({rating:.1f})"


def _rank(p: dict) -> float:
    r = p.get("rating") or 0.0
    n = p.get("user_ratings_total") or 0
    return r * math.log(n + 2)


def _format_reviews(
    reviews: list[dict], rating: float | None, count: int, name: str
) -> str:
    """
    عرض التعليقات الحقيقية بدون AI —
    نختار أكثر تعليقين إفادةً بناءً على الطول والتنوع.
    """
    if not reviews:
        if rating and count:
            pos_pct = min(100, int((rating / 5) * 100))
            return f"بناءً على {count:,} تقييم — {pos_pct}% إيجابية"
        return ""

    avg_rating = rating or 3.0

    # تسجيل نقاط لكل تعليق: نص أطول + تقييم مختلف عن المتوسط = أكثر إفادة
    scored: list[tuple[float, dict]] = []
    for r in reviews:
        text = (r.get("text") or "").strip()
        if not text:
            continue
        r_val = float(r.get("rating") or avg_rating)
        score = len(text) + abs(r_val - avg_rating) * 30
        scored.append((score, r))

    top = sorted(scored, key=lambda x: x[0], reverse=True)[:2]

    lines: list[str] = []
    for _, r in top:
        text = (r.get("text") or "").strip()[:220]
        r_val = r.get("rating") or 0
        if r_val >= 4:
            emoji = "✅"
        elif r_val <= 2:
            emoji = "❌"
        else:
            emoji = "➖"
        lines.append(f"{emoji} {text}")

    return "\n".join(lines)


# ─── Google Maps Scraper ───────────────────────────────────────────────────────

async def _scrape_places_list(
    lat: float, lng: float, place_type: str, max_results: int
) -> list[dict]:
    query_ar = PLACE_LABEL_AR.get(place_type, place_type)
    query_en = PLACE_TYPE_EN_QUERY.get(place_type, place_type.replace("_", " "))

    for query in [query_ar, query_en]:
        url = (
            f"https://www.google.com/maps/search/{quote(query)}"
            f"/@{lat},{lng},14z?hl=ar"
        )
        places = await _scrape_url(url, max_results)
        if places:
            return places

    return []


async def _scrape_url(url: str, max_results: int) -> list[dict]:
    async with _scrape_sem:
        context = await _browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            locale="ar-SA",
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()
        places: list[dict] = []

        try:
            await page.goto(url, wait_until="domcontentloaded",
                            timeout=settings.scrape_timeout_ms)

            for btn in ["Accept all", "قبول الكل"]:
                try:
                    await page.get_by_role("button", name=btn).click(timeout=2000)
                    break
                except Exception:
                    pass

            try:
                await page.wait_for_selector(
                    'div[role="feed"]', timeout=settings.scrape_timeout_ms
                )
            except Exception:
                return []

            feed = page.locator('div[role="feed"]')
            for _ in range(4):
                await feed.evaluate("el => el.scrollTop += 600")
                await asyncio.sleep(0.5)

            cards = await page.query_selector_all('div[role="feed"] > div')
            for card in cards:
                if len(places) >= max_results * 2:
                    break
                try:
                    place = await _parse_card(card)
                    if place and place.get("name"):
                        places.append(place)
                except Exception:
                    pass

        except Exception as exc:
            log.error("scraper.page_error", error=str(exc))
        finally:
            await page.close()
            await context.close()

    return places


async def _parse_card(card) -> dict | None:
    name = None
    for sel in [".fontHeadlineSmall", "div[class*='fontHeadline']", "h3"]:
        el = await card.query_selector(sel)
        if el:
            text = (await el.text_content() or "").strip()
            if text and len(text) > 1:
                name = text
                break
    if not name:
        return None

    rating = None
    for sel in ["span.MW4etd", "span[aria-label*='نجم']", "span[aria-label*='star']"]:
        el = await card.query_selector(sel)
        if el:
            try:
                rating = float((await el.text_content() or "").strip().replace(",", "."))
                break
            except ValueError:
                pass

    count = 0
    for sel in ["span.UY7F9", "span[aria-label*='تقييم']"]:
        el = await card.query_selector(sel)
        if el:
            txt = re.sub(r"[^\d]", "", await el.text_content() or "")
            count = int(txt) if txt else 0
            break

    address = ""
    for el in reversed(await card.query_selector_all(".W4Efsd")):
        txt = (await el.text_content() or "").strip()
        if txt and txt != name and len(txt) > 4:
            address = txt
            break

    open_now: bool | None = None
    open_el = await card.query_selector(".eXlnHd")
    if open_el:
        txt = (await open_el.text_content() or "").lower()
        open_now = "مفتوح" in txt or "open" in txt

    place_url = None
    link = await card.query_selector("a[href*='/maps/place/']")
    if link:
        place_url = await link.get_attribute("href")

    return {
        "name": name,
        "rating": rating,
        "user_ratings_total": count,
        "formatted_address": address,
        "open_now": open_now,
        "place_url": place_url,
        "reviews": [],
    }


async def _scrape_place_details(place_url: str) -> dict:
    if not place_url:
        return {}

    async with _scrape_sem:
        context = await _browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            locale="ar-SA",
        )
        page = await context.new_page()
        details: dict = {}

        try:
            full_url = (
                place_url if place_url.startswith("http")
                else f"https://www.google.com{place_url}"
            )
            await page.goto(full_url, wait_until="domcontentloaded",
                            timeout=settings.scrape_timeout_ms)
            await asyncio.sleep(1.5)

            # رقم الهاتف
            phone_el = await page.query_selector(
                "button[data-item-id*='phone'] .Io6YTe, "
                "button[aria-label*='هاتف'] .Io6YTe"
            )
            if phone_el:
                details["phone"] = (await phone_el.text_content() or "").strip()

            # الانتقال لتبويب التعليقات
            try:
                await page.get_by_role(
                    "tab", name=re.compile("تقييم|review", re.I)
                ).click(timeout=4000)
                await asyncio.sleep(1.5)
            except Exception:
                pass

            # جمع التعليقات
            reviews: list[dict] = []
            for rc in await page.query_selector_all("div.jftiEf, div[data-review-id]"):
                try:
                    text_el = await rc.query_selector("span.wiI7pd")
                    r_el = await rc.query_selector(
                        "span[aria-label*='نجم'], span[aria-label*='star']"
                    )
                    text = (await text_el.text_content() or "").strip() if text_el else ""
                    r_label = (await r_el.get_attribute("aria-label") or "") if r_el else ""
                    m = re.search(r"\d", r_label)
                    star = int(m.group()) if m else None
                    if text:
                        reviews.append({"text": text[:300], "rating": star})
                except Exception:
                    pass
            details["reviews"] = reviews

        except Exception as exc:
            log.warning("scraper.details_error", error=str(exc))
        finally:
            await page.close()
            await context.close()

    return details


# ─── Format WhatsApp message ──────────────────────────────────────────────────

async def _build_whatsapp_msg(
    places: list[dict], place_type: str, total_found: int
) -> str:
    type_label = PLACE_LABEL_AR.get(place_type, place_type)
    lines = [f"🔍 وجدت *{total_found}* {type_label} قريب منك، إليك أفضل {len(places)}:\n"]

    for i, p in enumerate(places, 1):
        name = p.get("name", "غير معروف")
        rating = p.get("rating")
        count = p.get("user_ratings_total", 0)
        address = p.get("formatted_address", "")
        open_now = p.get("open_now")
        phone = p.get("phone", "")
        reviews_text = _format_reviews(
            p.get("reviews", []), rating, count, name
        )

        open_status = (
            "🟢 مفتوح الآن" if open_now is True
            else "🔴 مغلق الآن" if open_now is False
            else ""
        )

        block = [f"*{i}. {name}*"]
        block.append(_stars(rating) + (f" · {count:,} تقييم" if count else ""))
        if address:
            block.append(f"📍 {address}")
        if open_status:
            block.append(open_status)
        if phone:
            block.append(f"📞 {phone}")
        if reviews_text:
            block.append(f"\n💬 أبرز التعليقات:\n{reviews_text}")

        lines.append("\n".join(block))
        lines.append("─────────────────")

    lines.append("\n_أرسل رقم المكان للحصول على الاتجاهات._")
    return "\n".join(lines)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    redis_ok = False
    try:
        if redis_client:
            await redis_client.ping()
            redis_ok = True
    except Exception:
        pass
    return {
        "status": "ok",
        "redis": redis_ok,
        "playwright": _browser is not None and _browser.is_connected(),
        "intent_model": classifier._model is not None,
        "appwrite": appwrite_db is not None,
    }


@app.post("/search", response_model=SearchResponse)
async def search_places(req: SearchRequest):
    log.info("search.request", lat=req.lat, lng=req.lng, type=req.place_type)

    place_type = PLACE_TYPE_MAP.get(req.place_type, req.place_type)

    cache_key = _cache_key(req.lat, req.lng, place_type, req.radius)
    cached = await redis_client.get(cache_key)
    if cached:
        log.info("search.cache_hit")
        return SearchResponse(**json.loads(cached))

    try:
        raw_places = await _scrape_places_list(req.lat, req.lng, place_type, req.max_results)
    except Exception as exc:
        log.error("scraper.failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"خطأ في البحث: {exc}")

    total_found = len(raw_places)
    if total_found == 0:
        type_label = PLACE_LABEL_AR.get(place_type, place_type)
        return SearchResponse(
            places=[],
            formatted_message=f"عذراً، لم أجد *{type_label}* قريباً. جرّب نوعاً آخر.",
            total_found=0,
        )

    top_places = sorted(raw_places, key=_rank, reverse=True)[: req.max_results]

    async def _enrich(place: dict) -> dict:
        if place.get("place_url"):
            try:
                details = await _scrape_place_details(place["place_url"])
                place.update(details)
            except Exception as exc:
                log.warning("enrich.failed", name=place.get("name"), error=str(exc))
        return place

    enriched = list(await asyncio.gather(*[_enrich(p) for p in top_places]))
    formatted_message = await _build_whatsapp_msg(enriched, place_type, total_found)

    serializable = [
        {
            "name": p.get("name"),
            "rating": p.get("rating"),
            "user_ratings_total": p.get("user_ratings_total"),
            "formatted_address": p.get("formatted_address"),
            "open_now": p.get("open_now"),
            "phone": p.get("phone"),
            "place_url": p.get("place_url"),
            "reviews": p.get("reviews", [])[:3],
        }
        for p in enriched
    ]

    response_data = {
        "places": serializable,
        "formatted_message": formatted_message,
        "total_found": total_found,
    }

    await redis_client.setex(
        cache_key,
        settings.cache_ttl_seconds,
        json.dumps(response_data, ensure_ascii=False),
    )

    asyncio.create_task(
        _log_search(req.phone_number, req.lat, req.lng, place_type, total_found)
    )

    return SearchResponse(**response_data)


@app.post("/intent", response_model=IntentResponse)
async def extract_intent(req: IntentRequest):
    log.info("intent.request", text=req.text[:80])

    # 1. مطابقة سريعة بالكلمات المفتاحية
    text_lower = req.text.lower()
    for kw, gtype in PLACE_TYPE_MAP.items():
        if kw in text_lower:
            label = PLACE_LABEL_AR.get(gtype, gtype)
            return IntentResponse(
                place_type=gtype,
                confidence=0.98,
                raw_text=req.text,
                suggested_reply=(
                    f"حسناً، سأبحث لك عن أقرب *{label}* 📍\n"
                    "من فضلك أرسل موقعك الحالي."
                ),
            )

    # 2. النموذج المحلي (semantic similarity)
    result = await asyncio.to_thread(classifier.classify, req.text)

    if result.place_type:
        return IntentResponse(
            place_type=result.place_type,
            confidence=result.confidence,
            raw_text=req.text,
            suggested_reply=(
                f"حسناً، سأبحث لك عن أقرب *{result.place_name_ar}* 📍\n"
                "من فضلك أرسل موقعك الحالي."
            ),
        )

    return IntentResponse(
        place_type=None,
        confidence=result.confidence,
        raw_text=req.text,
        suggested_reply=(
            "عذراً، لم أفهم ما تبحث عنه. مثال:\n"
            "• مطعم 🍽️\n• كافيه ☕\n• صيدلية 💊\n• مستشفى 🏥\n• محطة بنزين ⛽"
        ),
    )


async def _log_search(phone, lat, lng, place_type, count):
    if not appwrite_db or not phone:
        return
    try:
        import datetime
        appwrite_db.create_document(
            database_id=settings.appwrite_db_id,
            collection_id=settings.appwrite_searches_collection,
            document_id=ID.unique(),
            data={
                "phone_number": phone,
                "latitude": lat,
                "longitude": lng,
                "place_type": place_type,
                "results_count": count,
                "timestamp": datetime.datetime.utcnow().isoformat(),
            },
        )
    except Exception as exc:
        log.warning("appwrite.log_failed", error=str(exc))


@app.exception_handler(Exception)
async def _err(request: Request, exc: Exception):
    log.error("unhandled", path=str(request.url), error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "حدث خطأ داخلي، يرجى المحاولة لاحقاً."},
    )
