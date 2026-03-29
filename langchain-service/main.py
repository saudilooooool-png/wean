"""
Wean – FastAPI Service
- بحث الأماكن: Overpass API (OpenStreetMap) — مجاني، بدون Scraping، 1-3 ثانية
- تصنيف الأوامر: نموذج محلي sentence-transformers — بدون أي API خارجي
- تقييمات: من كاش مسبق (cache_worker) أو تُعرض بدونها إذا لم تتوفر
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import quote

import httpx
import redis.asyncio as aioredis
import structlog
from appwrite.client import Client as AppwriteClient
from appwrite.id import ID
from appwrite.services.databases import Databases
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

from intent_model import PLACE_LABEL_AR, classifier


# ─── إعدادات ──────────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/3"
    appwrite_endpoint: str = "http://appwrite:80/v1"
    appwrite_project_id: str = ""
    appwrite_api_key: str = ""
    app_env: str = "production"
    log_level: str = "info"
    appwrite_db_id: str = "wean_db"
    appwrite_searches_collection: str = "searches"
    max_results: int = 5
    cache_ttl_seconds: int = 7200        # ساعتان للبيانات الحية
    cache_ttl_precached: int = 43200     # 12 ساعة للكاش المسبق
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    overpass_timeout: int = 12           # ثانية
    evolution_url: str = "http://evolution-api:8080"
    evolution_api_key: str = ""
    evolution_instance: str = "wean_bot"

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


# ─── حالة عامة ────────────────────────────────────────────────────────────────

redis_client: aioredis.Redis | None = None
appwrite_db: Databases | None = None
http_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, appwrite_db, http_client

    log.info("wean.startup", env=settings.app_env)

    # تحميل نموذج الذكاء المحلي
    await asyncio.to_thread(classifier.load)
    log.info("intent_classifier.ready")

    redis_client = aioredis.from_url(
        settings.redis_url, encoding="utf-8", decode_responses=True
    )
    await redis_client.ping()
    log.info("redis.connected")

    # HTTP client مشترك (connection pooling)
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(20.0),
        headers={"User-Agent": "Wean-Bot/3.0 (OpenStreetMap Overpass)"},
    )
    log.info("http_client.ready")

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

    await http_client.aclose()
    await redis_client.aclose()
    log.info("wean.shutdown")


app = FastAPI(
    title="Wean Service",
    version="4.0.0",
    description="WhatsApp location search — Overpass API (OSM) + Local AI",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
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
    from_cache: bool = False


class IntentRequest(BaseModel):
    text: str
    phone_number: str | None = None


class IntentResponse(BaseModel):
    place_type: str | None
    confidence: float
    raw_text: str
    suggested_reply: str


# ─── خرائط نوع المكان ─────────────────────────────────────────────────────────

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

# خريطة Overpass — نوع المكان → استعلام OSM
OVERPASS_QUERIES: dict[str, str] = {
    "restaurant":  '["amenity"="restaurant"]',
    "cafe":        '["amenity"="cafe"]',
    "pharmacy":    '["amenity"="pharmacy"]',
    "hospital":    '["amenity"~"hospital|clinic|doctors"]',
    "supermarket": '["shop"~"supermarket|grocery|convenience"]',
    "mosque":      '["amenity"="place_of_worship"]["religion"="muslim"]',
    "gas_station": '["amenity"="fuel"]',
    "atm":         '["amenity"="atm"]',
    "bakery":      '["shop"="bakery"]',
    "park":        '["leisure"~"park|garden"]',
    "lodging":     '["tourism"~"hotel|motel|guest_house"]',
}


# ─── مساعدات ──────────────────────────────────────────────────────────────────

def _cache_key(lat: float, lng: float, place_type: str, radius: int) -> str:
    raw = f"{lat:.4f}:{lng:.4f}:{place_type}:{radius}"
    return "wean:search:" + hashlib.md5(raw.encode()).hexdigest()


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """المسافة بالمتر بين نقطتين جغرافيتين."""
    R = 6_371_000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fmt_distance(meters: float) -> str:
    if meters < 1000:
        return f"{int(meters)} م"
    return f"{meters / 1000:.1f} كم"


def _stars(rating: float | None) -> str:
    if not rating:
        return ""
    filled = round(rating)
    return "⭐" * filled + "☆" * (5 - filled) + f" ({rating:.1f})"


def _parse_opening_hours(oh: str | None) -> str | None:
    """تحويل صيغة opening_hours لـ OSM إلى نص مقروء."""
    if not oh:
        return None
    if oh.strip() == "24/7":
        return "🟢 مفتوح 24/7"
    return f"🕐 {oh}"


# ─── Overpass API ─────────────────────────────────────────────────────────────

async def _query_overpass(
    lat: float, lng: float, place_type: str, radius: int
) -> list[dict]:
    osm_filter = OVERPASS_QUERIES.get(place_type, f'["amenity"="{place_type}"]')

    query = f"""
[out:json][timeout:{settings.overpass_timeout}];
(
  node{osm_filter}(around:{radius},{lat},{lng});
  way{osm_filter}(around:{radius},{lat},{lng});
);
out center tags;
"""
    try:
        resp = await http_client.post(
            settings.overpass_url,
            data={"data": query},
            timeout=settings.overpass_timeout + 3,
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.TimeoutException:
        log.warning("overpass.timeout", place_type=place_type)
        raise HTTPException(status_code=504, detail="انتهت مهلة الاستعلام، حاول مجدداً.")
    except Exception as exc:
        log.error("overpass.error", error=str(exc))
        raise HTTPException(status_code=502, detail="خطأ في جلب البيانات.")

    places: list[dict] = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})

        # الاسم: نفضّل العربي
        name = (
            tags.get("name:ar")
            or tags.get("name")
            or tags.get("name:en")
            or ""
        ).strip()
        if not name:
            continue

        # الإحداثيات
        if el["type"] == "way":
            c = el.get("center", {})
            p_lat, p_lng = c.get("lat"), c.get("lon")
        else:
            p_lat, p_lng = el.get("lat"), el.get("lon")

        if not p_lat or not p_lng:
            continue

        distance = _haversine(lat, lng, p_lat, p_lng)

        places.append({
            "name": name,
            "lat": p_lat,
            "lng": p_lng,
            "distance_m": round(distance),
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "address": (
                tags.get("addr:full")
                or " ".join(filter(None, [
                    tags.get("addr:street"),
                    tags.get("addr:suburb"),
                    tags.get("addr:city"),
                ])) or ""
            ).strip(),
            "opening_hours": tags.get("opening_hours"),
            "website": tags.get("website") or tags.get("contact:website"),
            "osm_id": el.get("id"),
            # التقييمات تأتي من الكاش المسبق (cache_worker)
            "rating": None,
            "user_ratings_total": 0,
        })

    # ترتيب حسب المسافة
    places.sort(key=lambda x: x["distance_m"])
    return places


async def _enrich_from_ratings_cache(places: list[dict]) -> list[dict]:
    """
    يحاول إضافة التقييمات من كاش ratings المسبق (إذا توفر).
    لا يُبطئ الاستجابة — يعمل بشكل متوازٍ.
    """
    if not redis_client:
        return places

    async def _fetch_rating(place: dict) -> dict:
        key = f"wean:rating:{hashlib.md5(place['name'].encode()).hexdigest()}"
        cached = await redis_client.get(key)
        if cached:
            r = json.loads(cached)
            place["rating"] = r.get("rating")
            place["user_ratings_total"] = r.get("total", 0)
            place["reviews"] = r.get("reviews", [])
        else:
            place["reviews"] = []
        return place

    return list(await asyncio.gather(*[_fetch_rating(p) for p in places]))


# ─── تنسيق رسالة واتساب ───────────────────────────────────────────────────────

def _build_whatsapp_msg(
    places: list[dict], place_type: str, total_found: int
) -> str:
    type_label = PLACE_LABEL_AR.get(place_type, place_type)
    lines = [
        f"🔍 وجدت *{total_found}* {type_label} قريب منك، إليك أقرب {len(places)}:\n"
    ]

    for i, p in enumerate(places, 1):
        name = p["name"]
        dist = _fmt_distance(p["distance_m"])
        address = p.get("address", "")
        phone = p.get("phone", "")
        oh = _parse_opening_hours(p.get("opening_hours"))
        stars = _stars(p.get("rating"))
        count = p.get("user_ratings_total", 0)
        reviews = p.get("reviews", [])

        # رابط خرائط قوقل مباشر
        maps_url = (
            f"https://maps.google.com/?q={p['lat']},{p['lng']}"
        )

        block = [f"*{i}. {name}*"]
        if stars:
            block.append(stars + (f" · {count:,} تقييم" if count else ""))
        block.append(f"📍 {dist}" + (f" — {address}" if address else ""))
        if oh:
            block.append(oh)
        if phone:
            block.append(f"📞 {phone}")

        # أبرز تعليق واحد (إذا توفر من الكاش)
        top_review = next(
            (r["text"][:180] for r in reviews if r.get("text")), None
        )
        if top_review:
            block.append(f'💬 _"{top_review}"_')

        block.append(f"🗺️ {maps_url}")
        lines.append("\n".join(block))
        lines.append("─────────────────")

    lines.append("\n_أرسل رقم المكان للحصول على المزيد من التفاصيل._")
    return "\n".join(lines)


# ─── Endpoints ────────────────────────────────────────────────────────────────

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
        "intent_model": classifier._model is not None,
        "appwrite": appwrite_db is not None,
        "overpass": settings.overpass_url,
    }


class CitySearchRequest(BaseModel):
    city_name: str = Field(..., description="اسم المدينة بالعربي")
    place_type: str
    max_results: int = Field(default=5, ge=1, le=10)
    phone_number: str | None = None


# إحداثيات المدن الرئيسية
CITY_COORDS: dict[str, tuple[float, float]] = {
    "الرياض": (24.7136, 46.6753), "رياض": (24.7136, 46.6753),
    "جدة": (21.4858, 39.1925), "جده": (21.4858, 39.1925),
    "مكة": (21.3891, 39.8579), "مكه": (21.3891, 39.8579),
    "مكة المكرمة": (21.3891, 39.8579),
    "المدينة": (24.5247, 39.5692), "المدينه": (24.5247, 39.5692),
    "المدينة المنورة": (24.5247, 39.5692),
    "الدمام": (26.4207, 50.0888), "دمام": (26.4207, 50.0888),
    "الخبر": (26.2794, 50.2046), "خبر": (26.2794, 50.2046),
    "الكويت": (29.3759, 47.9774), "كويت": (29.3759, 47.9774),
    "دبي": (25.2048, 55.2708),
    "أبوظبي": (24.4539, 54.3773), "ابوظبي": (24.4539, 54.3773),
    "الشارقة": (25.3463, 55.4209), "شارقة": (25.3463, 55.4209),
    "حائل": (27.5219, 41.7057),
    "تبوك": (28.3998, 36.5714),
    "أبها": (18.2164, 42.5053),
    "طريف": (30.6607, 38.7283),
}


@app.post("/search/city", response_model=SearchResponse)
async def search_by_city(req: CitySearchRequest):
    """بحث في مدينة كاملة بدل نقطة محددة — يستخدم نطاق 5 كم."""
    coords = CITY_COORDS.get(req.city_name)
    if not coords:
        raise HTTPException(
            status_code=400,
            detail=f"المدينة '{req.city_name}' غير مدعومة حالياً."
        )
    lat, lng = coords
    # نستخدم نطاق 5 كم ليغطي معظم الحي المركزي
    fake_req = SearchRequest(
        lat=lat, lng=lng,
        place_type=req.place_type,
        radius=5000,
        max_results=req.max_results,
        phone_number=req.phone_number,
    )
    return await search_places(fake_req)


@app.post("/search", response_model=SearchResponse)
async def search_places(req: SearchRequest):
    log.info("search.request", lat=req.lat, lng=req.lng, type=req.place_type)

    place_type = PLACE_TYPE_MAP.get(req.place_type, req.place_type)
    cache_key = _cache_key(req.lat, req.lng, place_type, req.radius)

    # ── طبقة 1: Redis Cache ─────────────────────────────────────────────────
    if redis_client:
        cached = await redis_client.get(cache_key)
        if cached:
            log.info("search.cache_hit")
            return SearchResponse(**json.loads(cached), from_cache=True)

    # ── طبقة 2: Overpass API (1-3 ثانية) ──────────────────────────────────
    raw_places = await _query_overpass(req.lat, req.lng, place_type, req.radius)

    total_found = len(raw_places)
    if total_found == 0:
        type_label = PLACE_LABEL_AR.get(place_type, place_type)
        return SearchResponse(
            places=[],
            formatted_message=(
                f"عذراً، لم أجد *{type_label}* في نطاق {req.radius} متر.\n"
                "جرّب: أرسل 'نطاق أوسع' أو ابحث عن نوع آخر."
            ),
            total_found=0,
        )

    # إذا النتائج أقل من المطلوب → وسّع النطاق تلقائياً (مرة واحدة)
    if len(raw_places) < req.max_results and req.radius < 8000:
        expanded = await _query_overpass(req.lat, req.lng, place_type, req.radius * 2)
        if len(expanded) > len(raw_places):
            raw_places = expanded
            total_found = len(raw_places)

    top = raw_places[: req.max_results]

    # ── طبقة 3: إضافة التقييمات من الكاش (لا يُبطئ إذا لم تتوفر) ──────────
    top = await _enrich_from_ratings_cache(top)

    formatted_message = _build_whatsapp_msg(top, place_type, total_found)

    serializable = [
        {
            "name": p["name"],
            "lat": p["lat"],
            "lng": p["lng"],
            "distance_m": p["distance_m"],
            "address": p.get("address"),
            "phone": p.get("phone"),
            "opening_hours": p.get("opening_hours"),
            "rating": p.get("rating"),
            "user_ratings_total": p.get("user_ratings_total", 0),
            "maps_url": f"https://maps.google.com/?q={p['lat']},{p['lng']}",
            "reviews": p.get("reviews", [])[:2],
        }
        for p in top
    ]

    response_data = {
        "places": serializable,
        "formatted_message": formatted_message,
        "total_found": total_found,
    }

    # حفظ في الكاش
    if redis_client:
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
                    "أرسل موقعك الحالي."
                ),
            )

    # 2. النموذج المحلي
    result = await asyncio.to_thread(classifier.classify, req.text)

    if result.place_type:
        return IntentResponse(
            place_type=result.place_type,
            confidence=result.confidence,
            raw_text=req.text,
            suggested_reply=(
                f"حسناً، سأبحث لك عن أقرب *{result.place_name_ar}* 📍\n"
                "أرسل موقعك الحالي."
            ),
        )

    return IntentResponse(
        place_type=None,
        confidence=result.confidence,
        raw_text=req.text,
        suggested_reply=(
            "عذراً، لم أفهم ما تبحث عنه. مثال:\n"
            "• مطعم 🍽️\n• كافيه ☕\n• صيدلية 💊\n• محطة بنزين ⛽"
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


from admin_routes import router as admin_router
app.include_router(admin_router)


@app.exception_handler(Exception)
async def _err(request: Request, exc: Exception):
    log.error("unhandled", path=str(request.url), error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "حدث خطأ داخلي، يرجى المحاولة لاحقاً."},
    )
