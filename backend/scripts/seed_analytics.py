"""Seed analytics data for local development testing.

Run from backend directory with venv activated:
  python scripts/seed_analytics.py
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import async_session_maker, engine
from app.models.analytics import AnalyticsEvent, ErrorReport


EVENT_CATEGORIES = {
    "navigation": ["tab_switch", "page_view", "modal_open", "modal_close", "docs_view"],
    "player": ["player_claim", "player_configure", "gear_toggle_has", "gear_toggle_augmented", "bis_import", "bis_import_error", "player_release", "player_reorder"],
    "loot": ["loot_log", "loot_delete", "material_log", "page_ledger_entry", "floor_cleared", "week_advance"],
    "feature": ["view_mode_change", "filter_toggle", "sort_mode_change", "group_view_toggle", "weapon_priority_set", "keyboard_shortcut", "theme_toggle", "summary_tab_view"],
    "wizard": ["setup_wizard_start", "setup_wizard_complete", "setup_wizard_abandon", "setup_wizard_step", "log_week_wizard", "log_floor_wizard"],
    "admin": ["api_key_create", "static_create", "static_duplicate", "tier_create", "invitation_create"],
    "engagement": ["share_code_copy", "player_link_copy", "tier_share_link"],
}

TAB_NAMES = ["players", "loot", "history", "stats"]
PAGES = ["/", "/dashboard", "/admin", "/docs", "/docs/quick-start", "/docs/faq", "/docs/api"]
LOOT_METHODS = ["drop", "book", "tome", "purchase"]
FLOORS = ["M9S", "M10S", "M11S", "M12S"]
JOBS = ["PLD", "WAR", "DRK", "GNB", "WHM", "SCH", "AST", "SGE", "MNK", "DRG", "NIN", "SAM", "RPR", "VPR", "BRD", "MCH", "DNC", "BLM", "SMN", "RDM", "PCT"]

ERROR_TYPES = [
    ("api_error", "Failed to fetch /api/static-groups: Network error", "error", "frontend"),
    ("api_error", "BiS import failed: 502 Bad Gateway from xivgear.app", "error", "frontend"),
    ("api_error", "Failed to save player: 422 Unprocessable Entity", "warning", "frontend"),
    ("js_error", "TypeError: Cannot read properties of undefined (reading 'map')", "error", "frontend"),
    ("js_error", "RangeError: Maximum call stack size exceeded", "critical", "frontend"),
    ("unhandled_rejection", "AbortError: The operation was aborted", "warning", "frontend"),
    ("backend_error", "IntegrityError: duplicate key value violates unique constraint", "error", "backend"),
    ("external_service_error", "External service error: discord - 503 Service Unavailable", "error", "backend"),
    ("backend_error", "TimeoutError: QueuePool limit reached", "critical", "backend"),
]


def random_date(days_back: int) -> str:
    offset = random.random() * days_back * 86400
    dt = datetime.now(timezone.utc) - timedelta(seconds=offset)
    return dt.isoformat()


def generate_event_data(category: str, event_name: str) -> dict | None:
    if event_name == "tab_switch":
        return {"tab": random.choice(TAB_NAMES)}
    if event_name == "page_view":
        return {"page": random.choice(PAGES)}
    if event_name == "bis_import":
        return {"source": random.choice(["xivgear", "etro"]), "job": random.choice(JOBS)}
    if event_name == "loot_log":
        return {"floor": random.choice(FLOORS), "slot": random.choice(["head", "body", "hands", "legs", "feet", "earring", "necklace", "bracelet", "ring1"]), "method": random.choice(LOOT_METHODS)}
    if event_name == "view_mode_change":
        return {"mode": random.choice(["compact", "expanded"])}
    if event_name == "setup_wizard_complete":
        return {"playerCount": random.randint(4, 8)}
    return None


async def seed():
    print("Seeding analytics data...")

    async with async_session_maker() as session:
        # Check if data already exists
        from sqlalchemy import select, func
        result = await session.execute(select(func.count(AnalyticsEvent.id)))
        existing = result.scalar()
        if existing and existing > 0:
            print(f"  Already have {existing} events. Skipping seed.")
            return

        # Generate fake user/session IDs
        user_ids = [str(uuid.uuid4()) for _ in range(15)]
        # Also use the real user ID from the DB if available
        from app.models import User
        real_users = await session.execute(select(User.id))
        real_user_ids = [r[0] for r in real_users.all()]
        if real_user_ids:
            user_ids = real_user_ids + user_ids[:5]  # Mix real + fake

        session_ids = [str(uuid.uuid4()) for _ in range(50)]

        # Generate 2000 analytics events over the last 60 days
        events = []
        # Weight categories by realistic usage
        weighted_events = []
        for cat, names in EVENT_CATEGORIES.items():
            weight = {"navigation": 40, "player": 25, "loot": 15, "feature": 10, "wizard": 3, "admin": 3, "engagement": 4}.get(cat, 5)
            for name in names:
                weighted_events.extend([(cat, name)] * weight)

        for _ in range(2000):
            category, event_name = random.choice(weighted_events)
            events.append(AnalyticsEvent(
                user_id=random.choice(user_ids),
                session_id=random.choice(session_ids),
                event_category=category,
                event_name=event_name,
                event_data=generate_event_data(category, event_name),
                page_url=random.choice(PAGES + ["/group/ABC123", "/group/XYZ789", "/group/DEF456"]),
                created_at=random_date(60),
            ))

        session.add_all(events)
        print(f"  Added {len(events)} analytics events")

        # Generate 50 error reports
        errors = []
        for _ in range(50):
            error_type, message, severity, source = random.choice(ERROR_TYPES)
            import hashlib
            fingerprint = hashlib.sha256(f"{error_type}:{message}".encode()).hexdigest()
            errors.append(ErrorReport(
                fingerprint=fingerprint,
                user_id=random.choice(user_ids),
                session_id=random.choice(session_ids),
                error_type=error_type,
                message=message,
                stack_trace="at Object.fetch (analytics.ts:84)\n  at flush (analytics.ts:92)" if source == "frontend" else None,
                context={"url": f"http://localhost:5174{random.choice(PAGES)}", "browser": "Mozilla/5.0"},
                severity=severity,
                source=source,
                is_reviewed=random.random() < 0.3,  # 30% reviewed
                created_at=random_date(30),
            ))

        session.add_all(errors)
        print(f"  Added {len(errors)} error reports")

        await session.commit()
        print("Done! Refresh the admin dashboard to see data.")


if __name__ == "__main__":
    asyncio.run(seed())
