"""
Wean – Cache Worker
يعمل في الخلفية لتجديد كاش الأماكن الشائعة كل 12 ساعة.
يغطي المدن الرئيسية في السعودية + الكويت + الإمارات.

التشغيل:
  python cache_worker.py               ← يبدأ ويعمل باستمرار
  python cache_worker.py --once        ← دورة واحدة ثم يتوقف
  python cache_worker.py --city رياض  ← مدينة واحدة فقط
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import os
import sys
import time
from dataclasses import dataclass

import httpx
import redis.asyncio as aioredis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("cache_worker")

# ─── إعدادات ──────────────────────────────────────────────────────────────────

REDIS_URL      = os.getenv("REDIS_URL", "redis://localhost:6379/3")
OVERPASS_URL   = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
API_BASE_URL   = os.getenv("API_BASE_URL", "http://langchain-service:8000")
REFRESH_HOURS  = int(os.getenv("CACHE_REFRESH_HOURS", "12"))
CACHE_TTL      = int(os.getenv("CACHE_TTL_PRECACHED", "43200"))  # 12 ساعة
SEARCH_RADIUS  = int(os.getenv("CACHE_SEARCH_RADIUS", "3000"))   # متر
DELAY_BETWEEN  = float(os.getenv("CACHE_DELAY_SECONDS", "2.5"))  # تجنب الحظر

# ─── المدن المستهدفة ──────────────────────────────────────────────────────────
# كل مدينة: اسم + نقطة مركزية + شبكة نقاط فرعية (grid)
# النقاط الفرعية تغطي مناطق مختلفة داخل المدينة

@dataclass
class CityGrid:
    name: str
    name_ar: str
    points: list[tuple[float, float]]  # (lat, lng)


CITIES: list[CityGrid] = [
    CityGrid("riyadh", "الرياض", [
        (24.7136, 46.6753),  # وسط المدينة
        (24.7500, 46.7200),  # شمال
        (24.6800, 46.7100),  # جنوب
        (24.7200, 46.6200),  # غرب
        (24.7000, 46.7500),  # شرق
        (24.8000, 46.6400),  # شمال غرب
        (24.6500, 46.7800),  # جنوب شرق
    ]),
    CityGrid("jeddah", "جدة", [
        (21.4858, 39.1925),  # وسط
        (21.5200, 39.2100),  # شمال
        (21.4500, 39.1700),  # جنوب
        (21.5600, 39.1600),  # شمال غرب
    ]),
    CityGrid("mecca", "مكة", [
        (21.3891, 39.8579),  # الحرم
        (21.4200, 39.8200),  # شمال
        (21.3600, 39.8800),  # جنوب
    ]),
    CityGrid("medina", "المدينة", [
        (24.5247, 39.5692),  # الحرم النبوي
        (24.5500, 39.6000),  # شمال
        (24.5000, 39.5400),  # جنوب
    ]),
    CityGrid("dammam", "الدمام", [
        (26.4207, 50.0888),  # وسط
        (26.4500, 50.1200),  # شمال
        (26.3900, 50.0600),  # جنوب
    ]),
    CityGrid("khobar", "الخبر", [
        (26.2794, 50.2046),
        (26.3100, 50.2200),
    ]),
    CityGrid("kuwait", "الكويت", [
        (29.3759, 47.9774),
        (29.4100, 48.0200),
        (29.3400, 47.9400),
    ]),
    CityGrid("dubai", "دبي", [
        (25.2048, 55.2708),
        (25.2400, 55.3200),
        (25.1700, 55.2200),
    ]),
]

PLACE_TYPES = [
    "restaurant", "cafe", "pharmacy", "hospital",
    "supermarket", "mosque", "gas_station", "atm",
    "bakery", "park", "lodging",
]

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


# ─── المنطق الأساسي ───────────────────────────────────────────────────────────

def _cache_key(lat: float, lng: float, place_type: str, radius: int) -> str:
    raw = f"{lat:.4f}:{lng:.4f}:{place_type}:{radius}"
    return "wean:search:" + hashlib.md5(raw.encode()).hexdigest()


async def _fetch_overpass(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
    place_type: str,
    radius: int,
) -> list[dict]:
    osm_filter = OVERPASS_QUERIES.get(place_type, f'["amenity"="{place_type}"]')
    query = f"""
[out:json][timeout:15];
(
  node{osm_filter}(around:{radius},{lat},{lng});
  way{osm_filter}(around:{radius},{lat},{lng});
);
out center tags;
"""
    try:
        resp = await client.post(
            OVERPASS_URL, data={"data": query}, timeout=18.0
        )
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
    except Exception as exc:
        log.warning("overpass.fetch_failed type=%s err=%s", place_type, exc)
        return []

    import math

    def _dist(lat1, lon1, lat2, lon2):
        R = 6_371_000
        φ1, φ2 = math.radians(lat1), math.radians(lat2)
        dφ = math.radians(lat2 - lat1)
        dλ = math.radians(lon2 - lon1)
        a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    places = []
    for el in elements:
        tags = el.get("tags", {})
        name = (
            tags.get("name:ar") or tags.get("name") or tags.get("name:en") or ""
        ).strip()
        if not name:
            continue

        if el["type"] == "way":
            c = el.get("center", {})
            p_lat, p_lng = c.get("lat"), c.get("lon")
        else:
            p_lat, p_lng = el.get("lat"), el.get("lon")

        if not p_lat or not p_lng:
            continue

        places.append({
            "name": name,
            "lat": p_lat,
            "lng": p_lng,
            "distance_m": round(_dist(lat, lng, p_lat, p_lng)),
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "address": " ".join(filter(None, [
                tags.get("addr:street"),
                tags.get("addr:suburb"),
                tags.get("addr:city"),
            ])).strip(),
            "opening_hours": tags.get("opening_hours"),
            "rating": None,
            "user_ratings_total": 0,
            "reviews": [],
        })

    places.sort(key=lambda x: x["distance_m"])
    return places[:10]  # نحفظ أفضل 10 لكل نقطة


async def _cache_one(
    redis: aioredis.Redis,
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
    place_type: str,
    city_name: str,
) -> bool:
    key = _cache_key(lat, lng, place_type, SEARCH_RADIUS)

    # لا نجدد الكاش إذا لم يمر نصف الوقت
    ttl = await redis.ttl(key)
    if ttl > CACHE_TTL // 2:
        return False  # لا يحتاج تجديد بعد

    places = await _fetch_overpass(client, lat, lng, place_type, SEARCH_RADIUS)
    if not places:
        return False

    from main import _build_whatsapp_msg  # noqa: local import to avoid circular
    try:
        msg = _build_whatsapp_msg(places[:5], place_type, len(places))
    except Exception:
        msg = ""

    data = {
        "places": places[:5],
        "formatted_message": msg,
        "total_found": len(places),
    }

    await redis.setex(key, CACHE_TTL, json.dumps(data, ensure_ascii=False))
    return True


async def run_city(
    redis: aioredis.Redis,
    client: httpx.AsyncClient,
    city: CityGrid,
) -> dict:
    updated = 0
    skipped = 0

    for lat, lng in city.points:
        for ptype in PLACE_TYPES:
            try:
                result = await _cache_one(redis, client, lat, lng, ptype, city.name_ar)
                if result:
                    updated += 1
                    log.info(
                        "cached  %-12s %-15s (%.4f, %.4f)",
                        ptype, city.name_ar, lat, lng,
                    )
                else:
                    skipped += 1
            except Exception as exc:
                log.error("cache_one.failed city=%s type=%s err=%s", city.name_ar, ptype, exc)

            await asyncio.sleep(DELAY_BETWEEN)

    return {"city": city.name_ar, "updated": updated, "skipped": skipped}


async def run_all(target_city: str | None = None) -> None:
    redis = await aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    await redis.ping()
    log.info("redis.connected")

    cities = CITIES
    if target_city:
        cities = [c for c in CITIES if target_city in (c.name, c.name_ar)]
        if not cities:
            log.error("لم أجد المدينة: %s", target_city)
            return

    async with httpx.AsyncClient(
        headers={"User-Agent": "Wean-CacheWorker/1.0 (OpenStreetMap)"},
        timeout=20.0,
    ) as client:
        total_updated = 0
        for city in cities:
            log.info("▶ بدء تجديد كاش: %s (%d نقطة × %d نوع)",
                     city.name_ar, len(city.points), len(PLACE_TYPES))
            result = await run_city(redis, client, city)
            total_updated += result["updated"]
            log.info("✓ %s — جُدِّد: %d، تخطى: %d",
                     result["city"], result["updated"], result["skipped"])

    await redis.aclose()
    log.info("انتهى. إجمالي المحدَّث: %d", total_updated)


async def main_loop(once: bool = False, target_city: str | None = None) -> None:
    log.info("Wean Cache Worker بدأ (كل %d ساعة)", REFRESH_HOURS)

    while True:
        start = time.monotonic()
        try:
            await run_all(target_city)
        except Exception as exc:
            log.error("run_all.failed: %s", exc)

        if once:
            break

        elapsed = time.monotonic() - start
        sleep_secs = max(0, REFRESH_HOURS * 3600 - elapsed)
        log.info("الدورة التالية بعد %.1f ساعة", sleep_secs / 3600)
        await asyncio.sleep(sleep_secs)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wean Cache Worker")
    parser.add_argument("--once", action="store_true", help="دورة واحدة ثم توقف")
    parser.add_argument("--city", type=str, default=None, help="مدينة محددة")
    args = parser.parse_args()

    asyncio.run(main_loop(once=args.once, target_city=args.city))
