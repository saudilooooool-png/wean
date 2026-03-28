"""
Wean – Admin API routes
FastAPI router mounted at /admin by main.py.

All endpoints use Appwrite for persistence when configured; otherwise they
return realistic mock data so the dashboard works in dev without Appwrite.
"""

from __future__ import annotations

import datetime
import logging
from typing import Any

import httpx
import structlog
from appwrite.id import ID
from appwrite.query import Query
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

# ─── Settings (shared with main.py via env) ────────────────────────────────────


class AdminSettings(BaseSettings):
    appwrite_endpoint: str = "http://appwrite:80/v1"
    appwrite_project_id: str = ""
    appwrite_api_key: str = ""
    appwrite_db_id: str = "wean_db"
    appwrite_searches_collection: str = "searches"
    appwrite_broadcasts_collection: str = "broadcasts"
    appwrite_advertisers_collection: str = "advertisers"
    appwrite_settings_collection: str = "bot_settings"

    evolution_server_url: str = "http://localhost:8080"
    evolution_api_key: str = "evolution_api_key_change_me"
    evolution_instance: str = "wean_bot"

    # Anti-spam defaults
    antispam_cooldown_days: int = 7
    send_hours_from: int = 9
    send_hours_to: int = 21

    class Config:
        env_file = ".env"
        extra = "ignore"


admin_settings = AdminSettings()
log = structlog.get_logger()

# ─── Lazy Appwrite client (same pattern as main.py) ────────────────────────────

_appwrite_db = None


def _get_db():
    global _appwrite_db
    if _appwrite_db is not None:
        return _appwrite_db
    if not (admin_settings.appwrite_project_id and admin_settings.appwrite_api_key):
        return None
    try:
        from appwrite.client import Client as AppwriteClient
        from appwrite.services.databases import Databases

        aw = AppwriteClient()
        aw.set_endpoint(admin_settings.appwrite_endpoint)
        aw.set_project(admin_settings.appwrite_project_id)
        aw.set_key(admin_settings.appwrite_api_key)
        _appwrite_db = Databases(aw)
        return _appwrite_db
    except Exception as exc:
        log.warning("admin.appwrite_init_failed", error=str(exc))
        return None


# ─── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/admin", tags=["admin"])

# ─── Pydantic models ───────────────────────────────────────────────────────────


class SendMessageRequest(BaseModel):
    text: str = Field(..., min_length=1)


class NoteRequest(BaseModel):
    note: str


class BroadcastRequest(BaseModel):
    name: str
    message: str
    target_place_type: str
    target_days: int = 30
    schedule_at: datetime.datetime | None = None


class AdvertiserRegistration(BaseModel):
    business_name: str
    category: str
    location: str
    ad_message: str
    monthly_budget: float
    contact_phone: str


class AdvertiserApproval(BaseModel):
    duration_days: int = 30
    max_sends_per_week: int = 2
    service_fee: float = 500.0


class BotSettings(BaseModel):
    search_radius: int = 2000
    max_results: int = 5
    welcome_message: str = "مرحباً بك في وين! أرسل اسم المكان الذي تبحث عنه."
    max_messages_per_week: int = 1
    send_hours_from: int = 9
    send_hours_to: int = 21


# ─── Helpers ───────────────────────────────────────────────────────────────────

PLACE_LABEL_AR: dict[str, str] = {
    "restaurant": "مطعم",
    "cafe": "كافيه",
    "pharmacy": "صيدلية",
    "hospital": "مستشفى",
    "supermarket": "سوبرماركت",
    "mosque": "مسجد",
    "gas_station": "محطة بنزين",
    "atm": "صراف",
    "bakery": "مخبز",
    "park": "حديقة",
    "lodging": "فندق",
    "other": "أخرى",
}


def _utcnow() -> datetime.datetime:
    return datetime.datetime.utcnow()


def _apply_antispam_filter(
    contacts: list[dict], settings: dict
) -> tuple[list[dict], int]:
    """
    1. Remove opted-out contacts.
    2. Remove contacts messaged within the cooldown window.
    3. Only run during allowed hours (server-local UTC hour check).
    Returns (filtered_list, original_count).
    """
    original_count = len(contacts)
    cooldown_days = settings.get("antispam_cooldown_days", admin_settings.antispam_cooldown_days)
    now = _utcnow()
    send_from = settings.get("send_hours_from", admin_settings.send_hours_from)
    send_to = settings.get("send_hours_to", admin_settings.send_hours_to)

    # Hour check – warn if outside window but do not block (caller decides)
    current_hour = now.hour
    if not (send_from <= current_hour < send_to):
        log.warning(
            "broadcast.outside_send_window",
            current_hour=current_hour,
            window=f"{send_from}-{send_to}",
        )

    cutoff = now - datetime.timedelta(days=cooldown_days)
    filtered = []
    for c in contacts:
        if c.get("opted_out"):
            continue
        last_msg_raw = c.get("last_messaged_at")
        if last_msg_raw:
            try:
                last_msg = datetime.datetime.fromisoformat(str(last_msg_raw))
                if last_msg > cutoff:
                    continue
            except ValueError:
                pass
        filtered.append(c)

    return filtered, original_count


async def _evo_get(path: str) -> dict:
    url = f"{admin_settings.evolution_server_url}{path}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            url,
            headers={"apikey": admin_settings.evolution_api_key},
        )
        r.raise_for_status()
        return r.json()


async def _evo_post(path: str, payload: dict | None = None) -> dict:
    url = f"{admin_settings.evolution_server_url}{path}"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            url,
            json=payload or {},
            headers={"apikey": admin_settings.evolution_api_key},
        )
        r.raise_for_status()
        return r.json()


async def _send_whatsapp(phone: str, text: str) -> dict:
    """Send a WhatsApp text message via Evolution API."""
    # Normalise phone: strip leading + for Evolution API
    jid = phone.lstrip("+").replace(" ", "") + "@s.whatsapp.net"
    payload = {
        "number": jid,
        "options": {"delay": 1200, "presence": "composing"},
        "textMessage": {"text": text},
    }
    return await _evo_post(
        f"/message/sendText/{admin_settings.evolution_instance}", payload
    )


# ─── /admin/stats ──────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_stats() -> dict[str, Any]:
    db = _get_db()
    if db is None:
        # Mock data for dev/no-Appwrite mode
        return {
            "total_contacts": 1240,
            "searches_today": 87,
            "active_advertisers": 12,
            "messages_sent": 3400,
            "top_place_types": [
                {"type": "restaurant", "label": "مطعم", "count": 450, "pct": 45},
                {"type": "cafe", "label": "كافيه", "count": 280, "pct": 28},
                {"type": "pharmacy", "label": "صيدلية", "count": 120, "pct": 12},
                {"type": "hospital", "label": "مستشفى", "count": 80, "pct": 8},
                {"type": "other", "label": "أخرى", "count": 70, "pct": 7},
            ],
        }

    try:
        # Total unique contacts from searches
        searches = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_searches_collection,
            queries=[Query.limit(5000)],
        )
        docs = searches.get("documents", [])

        phones = {d.get("phone_number") for d in docs if d.get("phone_number")}
        total_contacts = len(phones)

        today_str = _utcnow().date().isoformat()
        searches_today = sum(
            1
            for d in docs
            if (d.get("timestamp") or "").startswith(today_str)
        )

        # Active advertisers
        try:
            adv = db.list_documents(
                database_id=admin_settings.appwrite_db_id,
                collection_id=admin_settings.appwrite_advertisers_collection,
                queries=[Query.equal("status", "active"), Query.limit(1000)],
            )
            active_advertisers = adv.get("total", 0)
        except Exception:
            active_advertisers = 0

        # Broadcasts sent count
        try:
            bcast = db.list_documents(
                database_id=admin_settings.appwrite_db_id,
                collection_id=admin_settings.appwrite_broadcasts_collection,
                queries=[Query.limit(1000)],
            )
            messages_sent = sum(
                d.get("sent_count", 0) for d in bcast.get("documents", [])
            )
        except Exception:
            messages_sent = 0

        # Top place types
        type_counts: dict[str, int] = {}
        for d in docs:
            pt = d.get("place_type") or "other"
            type_counts[pt] = type_counts.get(pt, 0) + 1

        total_searches = len(docs) or 1
        top_place_types = []
        for pt, cnt in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            top_place_types.append(
                {
                    "type": pt,
                    "label": PLACE_LABEL_AR.get(pt, pt),
                    "count": cnt,
                    "pct": round(cnt / total_searches * 100),
                }
            )

        return {
            "total_contacts": total_contacts,
            "searches_today": searches_today,
            "active_advertisers": active_advertisers,
            "messages_sent": messages_sent,
            "top_place_types": top_place_types,
        }
    except Exception as exc:
        log.error("admin.stats_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ─── /admin/contacts ───────────────────────────────────────────────────────────

_MOCK_CONTACTS = [
    {
        "id": f"mock_{i}",
        "phone_number": f"+9665012345{i:02d}",
        "last_search_type": "restaurant",
        "last_search_type_ar": "مطعم",
        "total_searches": 12,
        "last_area": "الرياض",
        "joined_at": "2026-01-15T10:00:00",
        "opted_out": False,
        "notes": "",
    }
    for i in range(1, 41)
]


@router.get("/contacts")
async def list_contacts(
    page: int = 1,
    limit: int = 20,
    search: str = "",
    place_type: str = "",
) -> dict[str, Any]:
    db = _get_db()
    if db is None:
        # Mock mode
        filtered = _MOCK_CONTACTS
        if search:
            filtered = [c for c in filtered if search in c["phone_number"]]
        if place_type:
            filtered = [c for c in filtered if c["last_search_type"] == place_type]
        total = len(filtered)
        offset = (page - 1) * limit
        return {
            "contacts": filtered[offset : offset + limit],
            "total": total,
            "page": page,
            "pages": max(1, -(-total // limit)),
        }

    try:
        queries: list[str] = [Query.limit(5000)]
        docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_searches_collection,
            queries=queries,
        ).get("documents", [])

        # Aggregate per phone
        phone_map: dict[str, dict] = {}
        for d in docs:
            ph = d.get("phone_number", "")
            if not ph:
                continue
            if ph not in phone_map:
                phone_map[ph] = {
                    "id": d.get("$id", ph),
                    "phone_number": ph,
                    "last_search_type": d.get("place_type", ""),
                    "last_search_type_ar": PLACE_LABEL_AR.get(
                        d.get("place_type", ""), d.get("place_type", "")
                    ),
                    "total_searches": 0,
                    "last_area": "",
                    "joined_at": d.get("timestamp", ""),
                    "opted_out": d.get("opted_out", False),
                    "notes": d.get("notes", ""),
                    "_last_ts": d.get("timestamp", ""),
                }
            agg = phone_map[ph]
            agg["total_searches"] += 1
            ts = d.get("timestamp", "")
            if ts > agg["_last_ts"]:
                agg["_last_ts"] = ts
                agg["last_search_type"] = d.get("place_type", "")
                agg["last_search_type_ar"] = PLACE_LABEL_AR.get(
                    d.get("place_type", ""), d.get("place_type", "")
                )

        contacts = list(phone_map.values())

        if search:
            contacts = [c for c in contacts if search in c["phone_number"]]
        if place_type:
            contacts = [c for c in contacts if c["last_search_type"] == place_type]

        contacts.sort(key=lambda c: c.get("_last_ts", ""), reverse=True)
        for c in contacts:
            c.pop("_last_ts", None)

        total = len(contacts)
        offset = (page - 1) * limit
        return {
            "contacts": contacts[offset : offset + limit],
            "total": total,
            "page": page,
            "pages": max(1, -(-total // limit)),
        }
    except Exception as exc:
        log.error("admin.contacts_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/contacts/{phone}/history")
async def contact_history(phone: str) -> dict[str, Any]:
    db = _get_db()
    if db is None:
        return {
            "phone": phone,
            "searches": [
                {
                    "place_type": "restaurant",
                    "place_type_ar": "مطعم",
                    "timestamp": "2026-03-20T14:30:00",
                    "results_count": 5,
                    "latitude": 24.7136,
                    "longitude": 46.6753,
                }
            ],
        }

    try:
        docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_searches_collection,
            queries=[
                Query.equal("phone_number", phone),
                Query.order_desc("timestamp"),
                Query.limit(200),
            ],
        ).get("documents", [])

        searches = [
            {
                "id": d.get("$id"),
                "place_type": d.get("place_type"),
                "place_type_ar": PLACE_LABEL_AR.get(d.get("place_type", ""), d.get("place_type", "")),
                "timestamp": d.get("timestamp"),
                "results_count": d.get("results_count", 0),
                "latitude": d.get("latitude"),
                "longitude": d.get("longitude"),
            }
            for d in docs
        ]
        return {"phone": phone, "searches": searches}
    except Exception as exc:
        log.error("admin.contact_history_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/contacts/{phone}/message")
async def send_direct_message(phone: str, body: SendMessageRequest) -> dict[str, Any]:
    try:
        result = await _send_whatsapp(phone, body.text)
        return {"ok": True, "result": result}
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Evolution API error {exc.response.status_code}: {exc.response.text}",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/contacts/{phone}/note")
async def save_contact_note(phone: str, body: NoteRequest) -> dict[str, Any]:
    db = _get_db()
    if db is None:
        return {"ok": True, "mock": True, "phone": phone, "note": body.note}

    try:
        # Find the most recent search document for this phone and store note there.
        # The searches collection has an optional `notes` field.
        docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_searches_collection,
            queries=[
                Query.equal("phone_number", phone),
                Query.order_desc("timestamp"),
                Query.limit(1),
            ],
        ).get("documents", [])

        if not docs:
            raise HTTPException(status_code=404, detail="Contact not found")

        doc_id = docs[0]["$id"]
        db.update_document(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_searches_collection,
            document_id=doc_id,
            data={"notes": body.note},
        )
        return {"ok": True, "phone": phone}
    except HTTPException:
        raise
    except Exception as exc:
        log.error("admin.save_note_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ─── /admin/whatsapp ───────────────────────────────────────────────────────────


@router.get("/whatsapp/status")
async def whatsapp_status() -> dict[str, Any]:
    try:
        data = await _evo_get(
            f"/instance/connectionState/{admin_settings.evolution_instance}"
        )
        state = data.get("instance", {}).get("state", "unknown")
        return {
            "connected": state == "open",
            "phone_number": data.get("instance", {}).get("owner", ""),
            "instance_name": admin_settings.evolution_instance,
            "state": state,
            "qr_url": (
                f"{admin_settings.evolution_server_url}/instance/qrcode/"
                f"{admin_settings.evolution_instance}?image=true"
            ),
        }
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Evolution API error {exc.response.status_code}: {exc.response.text}",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/whatsapp/reconnect")
async def whatsapp_reconnect() -> dict[str, Any]:
    try:
        await _evo_delete(
            f"/instance/logout/{admin_settings.evolution_instance}"
        )
    except Exception as exc:
        log.warning("admin.evo_logout_failed", error=str(exc))

    try:
        await _evo_get(
            f"/instance/connect/{admin_settings.evolution_instance}"
        )
    except Exception as exc:
        log.warning("admin.evo_connect_failed", error=str(exc))

    qr_url = (
        f"{admin_settings.evolution_server_url}/instance/qrcode/"
        f"{admin_settings.evolution_instance}?image=true"
    )
    return {"ok": True, "qr_url": qr_url}


async def _evo_delete(path: str) -> dict:
    url = f"{admin_settings.evolution_server_url}{path}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.delete(
            url,
            headers={"apikey": admin_settings.evolution_api_key},
        )
        r.raise_for_status()
        return r.json()


# ─── /admin/broadcasts ─────────────────────────────────────────────────────────


@router.get("/broadcasts")
async def list_broadcasts() -> dict[str, Any]:
    db = _get_db()
    if db is None:
        return {
            "broadcasts": [
                {
                    "id": "mock_bcast_1",
                    "name": "ترحيب رمضان",
                    "message": "رمضان كريم! اكتشف أقرب المطاعم.",
                    "target_place_type": "restaurant",
                    "status": "sent",
                    "target_count": 120,
                    "sent_count": 87,
                    "scheduled_at": None,
                    "created_at": "2026-03-01T08:00:00",
                }
            ]
        }

    try:
        docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_broadcasts_collection,
            queries=[Query.order_desc("created_at"), Query.limit(100)],
        ).get("documents", [])

        return {
            "broadcasts": [
                {
                    "id": d.get("$id"),
                    "name": d.get("name"),
                    "message": d.get("message"),
                    "target_place_type": d.get("target_place_type"),
                    "status": d.get("status"),
                    "target_count": d.get("target_count", 0),
                    "sent_count": d.get("sent_count", 0),
                    "scheduled_at": d.get("scheduled_at"),
                    "created_at": d.get("created_at"),
                }
                for d in docs
            ]
        }
    except Exception as exc:
        log.error("admin.broadcasts_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/broadcast")
async def create_broadcast(body: BroadcastRequest) -> dict[str, Any]:
    db = _get_db()

    # ── 1. Gather candidate contacts ──────────────────────────────────────────
    if db is None:
        # Mock mode: simulate 120 contacts, 87 pass filter
        broadcast_id = f"mock_bcast_{ID.unique()}"
        return {
            "broadcast_id": broadcast_id,
            "target_count": 120,
            "filtered_count": 87,
            "scheduled": body.schedule_at is not None,
        }

    try:
        cutoff_date = (_utcnow() - datetime.timedelta(days=body.target_days)).isoformat()

        # Pull contacts active within target_days window
        searches_docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_searches_collection,
            queries=[
                Query.equal("place_type", body.target_place_type),
                Query.greater_than("timestamp", cutoff_date),
                Query.limit(5000),
            ],
        ).get("documents", [])

        # Deduplicate by phone, keeping latest metadata
        phone_map: dict[str, dict] = {}
        for d in searches_docs:
            ph = d.get("phone_number", "")
            if not ph:
                continue
            existing = phone_map.get(ph)
            if existing is None or d.get("timestamp", "") > existing.get("timestamp", ""):
                phone_map[ph] = {
                    "phone_number": ph,
                    "opted_out": d.get("opted_out", False),
                    "last_messaged_at": d.get("last_messaged_at"),
                    "timestamp": d.get("timestamp", ""),
                }

        contacts = list(phone_map.values())

        # ── 2. Apply anti-spam filter ──────────────────────────────────────────
        settings_doc = _load_bot_settings(db)
        filtered_contacts, target_count = _apply_antispam_filter(contacts, settings_doc)
        filtered_count = len(filtered_contacts)

        broadcast_id = ID.unique()

        # ── 3a. Schedule ───────────────────────────────────────────────────────
        if body.schedule_at is not None:
            db.create_document(
                database_id=admin_settings.appwrite_db_id,
                collection_id=admin_settings.appwrite_broadcasts_collection,
                document_id=broadcast_id,
                data={
                    "name": body.name,
                    "message": body.message,
                    "target_place_type": body.target_place_type,
                    "target_days": body.target_days,
                    "status": "scheduled",
                    "target_count": target_count,
                    "sent_count": 0,
                    "scheduled_at": body.schedule_at.isoformat(),
                    "created_at": _utcnow().isoformat(),
                },
            )
            return {
                "broadcast_id": broadcast_id,
                "target_count": target_count,
                "filtered_count": filtered_count,
                "scheduled": True,
            }

        # ── 3b. Send immediately ───────────────────────────────────────────────
        sent = 0
        failed = 0
        for contact in filtered_contacts:
            try:
                await _send_whatsapp(contact["phone_number"], body.message)
                sent += 1
            except Exception as exc:
                log.warning(
                    "broadcast.send_failed",
                    phone=contact["phone_number"],
                    error=str(exc),
                )
                failed += 1

        db.create_document(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_broadcasts_collection,
            document_id=broadcast_id,
            data={
                "name": body.name,
                "message": body.message,
                "target_place_type": body.target_place_type,
                "target_days": body.target_days,
                "status": "sent",
                "target_count": target_count,
                "sent_count": sent,
                "scheduled_at": None,
                "created_at": _utcnow().isoformat(),
            },
        )

        return {
            "broadcast_id": broadcast_id,
            "target_count": target_count,
            "filtered_count": filtered_count,
            "sent": sent,
            "failed": failed,
            "scheduled": False,
        }

    except HTTPException:
        raise
    except Exception as exc:
        log.error("admin.broadcast_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/broadcast/{broadcast_id}/send")
async def send_scheduled_broadcast(broadcast_id: str) -> dict[str, Any]:
    db = _get_db()
    if db is None:
        return {"ok": True, "mock": True, "broadcast_id": broadcast_id, "sent": 87}

    try:
        doc = db.get_document(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_broadcasts_collection,
            document_id=broadcast_id,
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    if doc.get("status") not in ("scheduled", "pending"):
        raise HTTPException(
            status_code=400,
            detail=f"Broadcast is already in status '{doc.get('status')}'",
        )

    # Re-resolve contacts and send
    try:
        target_days = doc.get("target_days", 30)
        target_place_type = doc.get("target_place_type", "")
        message = doc.get("message", "")

        cutoff_date = (_utcnow() - datetime.timedelta(days=target_days)).isoformat()
        searches_docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_searches_collection,
            queries=[
                Query.equal("place_type", target_place_type),
                Query.greater_than("timestamp", cutoff_date),
                Query.limit(5000),
            ],
        ).get("documents", [])

        phone_map: dict[str, dict] = {}
        for d in searches_docs:
            ph = d.get("phone_number", "")
            if not ph:
                continue
            existing = phone_map.get(ph)
            if existing is None or d.get("timestamp", "") > existing.get("timestamp", ""):
                phone_map[ph] = {
                    "phone_number": ph,
                    "opted_out": d.get("opted_out", False),
                    "last_messaged_at": d.get("last_messaged_at"),
                    "timestamp": d.get("timestamp", ""),
                }

        contacts = list(phone_map.values())
        settings_doc = _load_bot_settings(db)
        filtered_contacts, _ = _apply_antispam_filter(contacts, settings_doc)

        sent = 0
        failed = 0
        for contact in filtered_contacts:
            try:
                await _send_whatsapp(contact["phone_number"], message)
                sent += 1
            except Exception as exc:
                log.warning(
                    "broadcast.scheduled_send_failed",
                    phone=contact["phone_number"],
                    error=str(exc),
                )
                failed += 1

        db.update_document(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_broadcasts_collection,
            document_id=broadcast_id,
            data={"status": "sent", "sent_count": sent},
        )

        return {
            "ok": True,
            "broadcast_id": broadcast_id,
            "sent": sent,
            "failed": failed,
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.error("admin.broadcast_send_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ─── /admin/advertisers ────────────────────────────────────────────────────────


@router.get("/advertisers")
async def list_advertisers() -> dict[str, Any]:
    db = _get_db()
    if db is None:
        return {
            "pending": [
                {
                    "id": "mock_adv_1",
                    "business_name": "مطعم الأصالة",
                    "category": "restaurant",
                    "location": "الرياض",
                    "ad_message": "اكتشف أشهى الأطباق السعودية!",
                    "monthly_budget": 1500.0,
                    "contact_phone": "+966501111111",
                    "status": "pending",
                }
            ],
            "active": [
                {
                    "id": "mock_adv_2",
                    "business_name": "صيدلية الشفاء",
                    "category": "pharmacy",
                    "location": "جدة",
                    "ad_message": "أدوية وعروض يومية!",
                    "monthly_budget": 800.0,
                    "contact_phone": "+966502222222",
                    "status": "active",
                    "duration_days": 30,
                    "max_sends_per_week": 2,
                }
            ],
        }

    try:
        pending_docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_advertisers_collection,
            queries=[Query.equal("status", "pending"), Query.limit(200)],
        ).get("documents", [])

        active_docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_advertisers_collection,
            queries=[Query.equal("status", "active"), Query.limit(200)],
        ).get("documents", [])

        def _fmt(d: dict) -> dict:
            return {
                "id": d.get("$id"),
                "business_name": d.get("business_name"),
                "category": d.get("category"),
                "location": d.get("location"),
                "ad_message": d.get("ad_message"),
                "monthly_budget": d.get("monthly_budget"),
                "contact_phone": d.get("contact_phone"),
                "status": d.get("status"),
                "duration_days": d.get("duration_days"),
                "max_sends_per_week": d.get("max_sends_per_week"),
                "approved_at": d.get("approved_at"),
            }

        return {
            "pending": [_fmt(d) for d in pending_docs],
            "active": [_fmt(d) for d in active_docs],
        }
    except Exception as exc:
        log.error("admin.advertisers_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/advertisers")
async def register_advertiser(body: AdvertiserRegistration) -> dict[str, Any]:
    """Public self-registration endpoint for advertisers."""
    db = _get_db()
    if db is None:
        return {"ok": True, "mock": True, "id": f"mock_adv_{ID.unique()}"}

    try:
        doc = db.create_document(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_advertisers_collection,
            document_id=ID.unique(),
            data={
                "business_name": body.business_name,
                "category": body.category,
                "location": body.location,
                "ad_message": body.ad_message,
                "monthly_budget": body.monthly_budget,
                "contact_phone": body.contact_phone,
                "status": "pending",
                "duration_days": None,
                "max_sends_per_week": None,
                "approved_at": None,
            },
        )
        return {"ok": True, "id": doc.get("$id")}
    except Exception as exc:
        log.error("admin.register_advertiser_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/advertisers/{advertiser_id}/approve")
async def approve_advertiser(
    advertiser_id: str, body: AdvertiserApproval
) -> dict[str, Any]:
    db = _get_db()
    if db is None:
        return {"ok": True, "mock": True, "id": advertiser_id}

    try:
        db.update_document(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_advertisers_collection,
            document_id=advertiser_id,
            data={
                "status": "active",
                "duration_days": body.duration_days,
                "max_sends_per_week": body.max_sends_per_week,
                "service_fee": body.service_fee,
                "approved_at": _utcnow().isoformat(),
            },
        )
        return {"ok": True, "id": advertiser_id}
    except Exception as exc:
        log.error("admin.approve_advertiser_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/advertisers/{advertiser_id}/reject")
async def reject_advertiser(advertiser_id: str) -> dict[str, Any]:
    db = _get_db()
    if db is None:
        return {"ok": True, "mock": True, "id": advertiser_id}

    try:
        db.update_document(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_advertisers_collection,
            document_id=advertiser_id,
            data={"status": "rejected"},
        )
        return {"ok": True, "id": advertiser_id}
    except Exception as exc:
        log.error("admin.reject_advertiser_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


# ─── /admin/settings ───────────────────────────────────────────────────────────

_DEFAULT_SETTINGS = {
    "search_radius": 2000,
    "max_results": 5,
    "welcome_message": "مرحباً بك في وين! أرسل اسم المكان الذي تبحث عنه.",
    "max_messages_per_week": 1,
    "send_hours_from": 9,
    "send_hours_to": 21,
}


def _load_bot_settings(db) -> dict:
    """Load bot settings from Appwrite or fall back to defaults."""
    if db is None:
        return _DEFAULT_SETTINGS.copy()
    try:
        docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_settings_collection,
            queries=[Query.limit(1)],
        ).get("documents", [])
        if docs:
            return docs[0]
    except Exception:
        pass
    return _DEFAULT_SETTINGS.copy()


@router.get("/settings")
async def get_settings() -> dict[str, Any]:
    db = _get_db()
    settings_doc = _load_bot_settings(db)
    # Return only the known keys, with defaults where missing
    return {
        "search_radius": settings_doc.get("search_radius", _DEFAULT_SETTINGS["search_radius"]),
        "max_results": settings_doc.get("max_results", _DEFAULT_SETTINGS["max_results"]),
        "welcome_message": settings_doc.get("welcome_message", _DEFAULT_SETTINGS["welcome_message"]),
        "max_messages_per_week": settings_doc.get(
            "max_messages_per_week", _DEFAULT_SETTINGS["max_messages_per_week"]
        ),
        "send_hours_from": settings_doc.get("send_hours_from", _DEFAULT_SETTINGS["send_hours_from"]),
        "send_hours_to": settings_doc.get("send_hours_to", _DEFAULT_SETTINGS["send_hours_to"]),
    }


@router.put("/settings")
async def update_settings(body: BotSettings) -> dict[str, Any]:
    db = _get_db()
    data = body.model_dump()

    if db is None:
        return {"ok": True, "mock": True, "settings": data}

    try:
        # Upsert: check if a settings document already exists
        docs = db.list_documents(
            database_id=admin_settings.appwrite_db_id,
            collection_id=admin_settings.appwrite_settings_collection,
            queries=[Query.limit(1)],
        ).get("documents", [])

        if docs:
            doc_id = docs[0]["$id"]
            db.update_document(
                database_id=admin_settings.appwrite_db_id,
                collection_id=admin_settings.appwrite_settings_collection,
                document_id=doc_id,
                data=data,
            )
        else:
            db.create_document(
                database_id=admin_settings.appwrite_db_id,
                collection_id=admin_settings.appwrite_settings_collection,
                document_id=ID.unique(),
                data=data,
            )

        return {"ok": True, "settings": data}
    except Exception as exc:
        log.error("admin.update_settings_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))
