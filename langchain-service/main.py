"""
Wean – LangChain / FastAPI service
Endpoints:
  POST /search  – nearby place search + Arabic AI review summaries
  POST /intent  – Arabic text → place_type intent extraction
  GET  /health  – liveness probe
"""

from __future__ import annotations

import json
import os
import hashlib
import logging
from contextlib import asynccontextmanager
from typing import Any

import googlemaps
import redis.asyncio as aioredis
import structlog
from appwrite.client import Client as AppwriteClient
from appwrite.services.databases import Databases
from appwrite.id import ID
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from tenacity import retry, stop_after_attempt, wait_exponential


# ─── Configuration ────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    openai_api_key: str
    google_maps_api_key: str
    redis_url: str = "redis://localhost:6379/3"
    appwrite_endpoint: str = "http://appwrite:80/v1"
    appwrite_project_id: str = ""
    appwrite_api_key: str = ""
    app_env: str = "production"
    log_level: str = "info"
    # Appwrite collection IDs (populated by setup.js, readable from env or defaults)
    appwrite_db_id: str = "wean_db"
    appwrite_sessions_collection: str = "sessions"
    appwrite_searches_collection: str = "searches"
    appwrite_users_collection: str = "users"
    # Search defaults
    search_radius_meters: int = 2000
    max_results: int = 5
    cache_ttl_seconds: int = 3600

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# ─── Logging ──────────────────────────────────────────────────────────────────

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.log_level.upper(), logging.INFO)
    ),
)
log = structlog.get_logger()


# ─── Global clients (initialised in lifespan) ─────────────────────────────────

redis_client: aioredis.Redis | None = None
gmaps_client: googlemaps.Client | None = None
llm: ChatOpenAI | None = None
appwrite_db: Databases | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, gmaps_client, llm, appwrite_db

    log.info("wean.startup", env=settings.app_env)

    redis_client = aioredis.from_url(
        settings.redis_url, encoding="utf-8", decode_responses=True
    )
    await redis_client.ping()
    log.info("redis.connected")

    gmaps_client = googlemaps.Client(key=settings.google_maps_api_key)
    log.info("googlemaps.ready")

    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.3,
        openai_api_key=settings.openai_api_key,
        max_tokens=1024,
    )
    log.info("langchain.ready")

    if settings.appwrite_project_id and settings.appwrite_api_key:
        try:
            aw_client = AppwriteClient()
            aw_client.set_endpoint(settings.appwrite_endpoint)
            aw_client.set_project(settings.appwrite_project_id)
            aw_client.set_key(settings.appwrite_api_key)
            appwrite_db = Databases(aw_client)
            log.info("appwrite.connected")
        except Exception as exc:
            log.warning("appwrite.init_failed", error=str(exc))
    else:
        log.warning("appwrite.skipped", reason="credentials not configured")

    yield

    await redis_client.aclose()
    log.info("wean.shutdown")


# ─── FastAPI app ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Wean LangChain Service",
    version="1.0.0",
    description="WhatsApp location search with Arabic AI review summaries",
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
    lat: float = Field(..., description="Latitude", ge=-90, le=90)
    lng: float = Field(..., description="Longitude", ge=-180, le=180)
    place_type: str = Field(..., description="e.g. restaurant, cafe, pharmacy")
    language: str = Field(default="ar", description="Response language code")
    radius: int = Field(default=2000, description="Search radius in metres", ge=100, le=50000)
    max_results: int = Field(default=5, description="Max places to return", ge=1, le=10)
    phone_number: str | None = Field(default=None, description="Requester phone (for logging)")


class SearchResponse(BaseModel):
    places: list[dict[str, Any]]
    formatted_message: str
    total_found: int


class IntentRequest(BaseModel):
    text: str = Field(..., description="Arabic user message")
    phone_number: str | None = Field(default=None)


class IntentResponse(BaseModel):
    place_type: str | None
    confidence: float
    raw_text: str
    suggested_reply: str


# ─── Place type mapping (Arabic → Google Maps type) ──────────────────────────

PLACE_TYPE_MAP: dict[str, str] = {
    # Restaurants
    "مطعم": "restaurant",
    "مطاعم": "restaurant",
    "اكل": "restaurant",
    "أكل": "restaurant",
    "طعام": "restaurant",
    "غداء": "restaurant",
    "عشاء": "restaurant",
    "فطور": "restaurant",
    # Cafes
    "كافيه": "cafe",
    "كافيهات": "cafe",
    "قهوة": "cafe",
    "مقهى": "cafe",
    "مقاهي": "cafe",
    "كوفي": "cafe",
    "كافية": "cafe",
    # Pharmacy
    "صيدلية": "pharmacy",
    "صيدليات": "pharmacy",
    "دواء": "pharmacy",
    # Hospital
    "مستشفى": "hospital",
    "مستشفيات": "hospital",
    "طوارئ": "hospital",
    # Supermarket
    "سوبرماركت": "supermarket",
    "بقالة": "supermarket",
    "محل": "supermarket",
    "دكان": "supermarket",
    # Mosque
    "مسجد": "mosque",
    "مساجد": "mosque",
    "جامع": "mosque",
    # Gas station
    "بنزين": "gas_station",
    "محطة": "gas_station",
    "وقود": "gas_station",
    # ATM
    "صراف": "atm",
    "صرافة": "atm",
    # Bakery
    "مخبز": "bakery",
    "خبز": "bakery",
    "بيكري": "bakery",
    # Park
    "حديقة": "park",
    "منتزه": "park",
    # Hotel
    "فندق": "lodging",
    "فنادق": "lodging",
}

# Human-readable Arabic labels for place types
PLACE_TYPE_AR: dict[str, str] = {
    "restaurant": "مطعم",
    "cafe": "كافيه",
    "pharmacy": "صيدلية",
    "hospital": "مستشفى",
    "supermarket": "سوبرماركت",
    "mosque": "مسجد",
    "gas_station": "محطة بنزين",
    "atm": "صراف آلي",
    "bakery": "مخبز",
    "park": "حديقة",
    "lodging": "فندق",
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


def _price_level_ar(level: int | None) -> str:
    mapping = {0: "مجاني", 1: "رخيص", 2: "متوسط", 3: "غالي", 4: "فاخر جداً"}
    return mapping.get(level, "غير محدد")


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=4))
def _places_nearby(
    lat: float,
    lng: float,
    place_type: str,
    radius: int,
    language: str,
) -> list[dict]:
    result = gmaps_client.places_nearby(
        location=(lat, lng),
        radius=radius,
        type=place_type,
        language=language,
    )
    return result.get("results", [])


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=4))
def _place_details(place_id: str, language: str) -> dict:
    fields = [
        "name",
        "rating",
        "user_ratings_total",
        "formatted_address",
        "opening_hours",
        "price_level",
        "reviews",
        "website",
        "formatted_phone_number",
        "geometry",
        "photos",
        "types",
    ]
    result = gmaps_client.place(
        place_id=place_id,
        fields=fields,
        language=language,
    )
    return result.get("result", {})


async def _summarise_reviews_ar(place_name: str, reviews: list[dict]) -> str:
    """Use LangChain / GPT-4o to produce an Arabic review summary."""
    if not reviews:
        return "لا توجد تقييمات متاحة لهذا المكان."

    reviews_text = "\n".join(
        f"- ({r.get('rating', '?')}/5): {r.get('text', '').strip()}"
        for r in reviews[:5]
        if r.get("text")
    )
    if not reviews_text.strip():
        return "لا توجد تقييمات نصية متاحة."

    messages = [
        SystemMessage(
            content=(
                "أنت مساعد متخصص في تلخيص تقييمات الأماكن. "
                "لخّص التقييمات التالية بأسلوب ودّي ومفيد باللغة العربية في جملتين أو ثلاث كحد أقصى. "
                "ركّز على النقاط الإيجابية والسلبية الرئيسية."
            )
        ),
        HumanMessage(
            content=f"اسم المكان: {place_name}\n\nالتقييمات:\n{reviews_text}"
        ),
    ]

    response = await llm.ainvoke(messages)
    return response.content.strip()


async def _format_results_ar(
    places_details: list[dict],
    place_type: str,
    total_found: int,
) -> str:
    """Build the full Arabic WhatsApp message."""
    type_label = PLACE_TYPE_AR.get(place_type, place_type)
    lines: list[str] = [
        f"🔍 وجدت *{total_found}* {type_label} قريب منك، إليك أفضل {len(places_details)}:\n"
    ]

    for i, place in enumerate(places_details, start=1):
        name = place.get("name", "غير معروف")
        rating = place.get("rating")
        ratings_total = place.get("user_ratings_total", 0)
        address = place.get("formatted_address", "")
        price_level = place.get("price_level")
        opening_hours = place.get("opening_hours", {})
        open_now = opening_hours.get("open_now")
        phone = place.get("formatted_phone_number", "")
        summary = place.get("_review_summary", "")

        open_status = "🟢 مفتوح الآن" if open_now is True else ("🔴 مغلق الآن" if open_now is False else "")

        block = [f"*{i}. {name}*"]
        block.append(_stars(rating) + (f" من {ratings_total:,} تقييم" if ratings_total else ""))
        if address:
            block.append(f"📍 {address}")
        if open_status:
            block.append(open_status)
        if price_level is not None:
            block.append(f"💰 السعر: {_price_level_ar(price_level)}")
        if phone:
            block.append(f"📞 {phone}")
        if summary:
            block.append(f"\n💬 _{summary}_")

        lines.append("\n".join(block))
        lines.append("─────────────────")

    lines.append("\n_للحصول على اتجاهات، أرسل رقم المكان الذي تريده._")
    return "\n".join(lines)


async def _log_search_to_appwrite(
    phone_number: str | None,
    lat: float,
    lng: float,
    place_type: str,
    results_count: int,
) -> None:
    if appwrite_db is None or not phone_number:
        return
    try:
        appwrite_db.create_document(
            database_id=settings.appwrite_db_id,
            collection_id=settings.appwrite_searches_collection,
            document_id=ID.unique(),
            data={
                "phone_number": phone_number,
                "latitude": lat,
                "longitude": lng,
                "place_type": place_type,
                "results_count": results_count,
                "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
            },
        )
    except Exception as exc:
        log.warning("appwrite.log_search_failed", error=str(exc))


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
        "googlemaps": gmaps_client is not None,
        "llm": llm is not None,
        "appwrite": appwrite_db is not None,
    }


@app.post("/search", response_model=SearchResponse)
async def search_places(req: SearchRequest):
    log.info("search.request", lat=req.lat, lng=req.lng, type=req.place_type)

    # Normalise place_type (handle Arabic input)
    place_type = PLACE_TYPE_MAP.get(req.place_type, req.place_type)

    # Cache check
    cache_key = _cache_key(req.lat, req.lng, place_type, req.radius)
    cached = await redis_client.get(cache_key)
    if cached:
        log.info("search.cache_hit", key=cache_key)
        data = json.loads(cached)
        return SearchResponse(**data)

    # Google Maps – nearby search
    try:
        raw_places = _places_nearby(req.lat, req.lng, place_type, req.radius, req.language)
    except Exception as exc:
        log.error("googlemaps.nearby_failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"Google Maps error: {exc}")

    total_found = len(raw_places)
    if total_found == 0:
        type_label = PLACE_TYPE_AR.get(place_type, place_type)
        empty_msg = (
            f"عذراً، لم أجد أي *{type_label}* في نطاق {req.radius} متر من موقعك. "
            f"جرّب توسيع نطاق البحث أو ابحث عن نوع آخر."
        )
        return SearchResponse(places=[], formatted_message=empty_msg, total_found=0)

    # Sort by rating × log(user_ratings_total + 1) – Bayesian-style ranking
    def _rank(p: dict) -> float:
        r = p.get("rating") or 0.0
        n = p.get("user_ratings_total") or 0
        import math
        return r * math.log(n + 2)

    top_places_raw = sorted(raw_places, key=_rank, reverse=True)[: req.max_results]

    # Fetch details + summarise reviews concurrently
    import asyncio

    async def _enrich(place_raw: dict) -> dict:
        place_id = place_raw.get("place_id", "")
        try:
            details = await asyncio.to_thread(_place_details, place_id, req.language)
        except Exception as exc:
            log.warning("googlemaps.details_failed", place_id=place_id, error=str(exc))
            details = place_raw

        reviews = details.get("reviews", [])
        summary = await _summarise_reviews_ar(details.get("name", ""), reviews)
        details["_review_summary"] = summary
        return details

    places_details = await asyncio.gather(*[_enrich(p) for p in top_places_raw])

    formatted_message = await _format_results_ar(list(places_details), place_type, total_found)

    # Serialise for response
    serialisable_places = []
    for d in places_details:
        serialisable_places.append(
            {
                "name": d.get("name"),
                "place_id": d.get("place_id"),
                "rating": d.get("rating"),
                "user_ratings_total": d.get("user_ratings_total"),
                "formatted_address": d.get("formatted_address"),
                "opening_hours": d.get("opening_hours"),
                "price_level": d.get("price_level"),
                "formatted_phone_number": d.get("formatted_phone_number"),
                "website": d.get("website"),
                "geometry": d.get("geometry"),
                "review_summary": d.get("_review_summary"),
                "types": d.get("types"),
            }
        )

    response_data = {
        "places": serialisable_places,
        "formatted_message": formatted_message,
        "total_found": total_found,
    }

    # Cache for 1 hour
    await redis_client.setex(cache_key, settings.cache_ttl_seconds, json.dumps(response_data))

    # Log to Appwrite (fire-and-forget)
    import asyncio as _asyncio
    _asyncio.create_task(
        _log_search_to_appwrite(req.phone_number, req.lat, req.lng, place_type, total_found)
    )

    return SearchResponse(**response_data)


@app.post("/intent", response_model=IntentResponse)
async def extract_intent(req: IntentRequest):
    log.info("intent.request", text=req.text[:60])

    # Fast local keyword match first
    text_lower = req.text.lower()
    for keyword, gtype in PLACE_TYPE_MAP.items():
        if keyword in text_lower:
            type_label = PLACE_TYPE_AR.get(gtype, gtype)
            return IntentResponse(
                place_type=gtype,
                confidence=0.95,
                raw_text=req.text,
                suggested_reply=(
                    f"حسناً، سأبحث لك عن أقرب *{type_label}* إلى موقعك. 📍\n"
                    f"من فضلك أرسل موقعك الحالي."
                ),
            )

    # Fallback to LLM intent extraction
    messages = [
        SystemMessage(
            content=(
                "أنت مساعد يحدد نوع المكان الذي يبحث عنه المستخدم. "
                "استخرج نوع المكان من الرسالة وأعد الإجابة بتنسيق JSON فقط بهذا الشكل:\n"
                '{"place_type": "<google_maps_type_or_null>", "confidence": <0.0-1.0>, "place_name_ar": "<arabic_name>"}\n'
                "أنواع Google Maps الصالحة: restaurant, cafe, pharmacy, hospital, supermarket, mosque, "
                "gas_station, atm, bakery, park, lodging, bank, school, gym\n"
                "إذا لم تستطع تحديد النوع، استخدم null."
            )
        ),
        HumanMessage(content=req.text),
    ]

    try:
        response = await llm.ainvoke(messages)
        raw = response.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
    except Exception as exc:
        log.warning("intent.llm_parse_failed", error=str(exc))
        return IntentResponse(
            place_type=None,
            confidence=0.0,
            raw_text=req.text,
            suggested_reply=(
                "عذراً، لم أفهم ما تبحث عنه. يمكنك أن تقول مثلاً:\n"
                "• مطعم 🍽️\n• كافيه ☕\n• صيدلية 💊\n• مستشفى 🏥"
            ),
        )

    place_type = parsed.get("place_type")
    confidence = float(parsed.get("confidence", 0.5))
    place_name_ar = parsed.get("place_name_ar", place_type or "المكان")

    if place_type:
        suggested_reply = (
            f"حسناً، سأبحث لك عن أقرب *{place_name_ar}* إلى موقعك. 📍\n"
            "من فضلك أرسل موقعك الحالي."
        )
    else:
        suggested_reply = (
            "عذراً، لم أفهم ما تبحث عنه بالضبط. يمكنك أن تقول مثلاً:\n"
            "• مطعم 🍽️\n• كافيه ☕\n• صيدلية 💊\n• مستشفى 🏥"
        )

    return IntentResponse(
        place_type=place_type,
        confidence=confidence,
        raw_text=req.text,
        suggested_reply=suggested_reply,
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("unhandled_exception", path=str(request.url), error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "حدث خطأ داخلي، يرجى المحاولة لاحقاً."},
    )
