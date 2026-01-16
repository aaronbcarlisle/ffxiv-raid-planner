# Session 11: Backend Polish - Pool + Query Optimization

**Duration:** 3 hours
**Issues:** P2-PERF-003, P2-PERF-004, P2-PERF-006, P2-PERF-007
**Priority:** MEDIUM

---

## Pre-Session Checklist

- [ ] Backend virtual environment activated
- [ ] All tests passing (`pytest tests/ -q`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to add database connection pooling, optimize some queries, and add request ID tracking. Work through each issue, creating commits after each fix.

## Issue 1: Missing Connection Pool Configuration (P2-PERF-004)

**Location:** `backend/app/database.py`

**Current state:**
```python
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,
)
```

**Problem:** Uses default pool settings which may not be optimal for production.

**Solution:**
```python
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,
    pool_size=20,        # Number of connections to keep open
    max_overflow=10,     # Extra connections allowed when pool exhausted
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=3600,   # Recycle connections after 1 hour
)
```

**Consider making configurable:**
```python
# In config.py
db_pool_size: int = Field(default=20)
db_max_overflow: int = Field(default=10)
db_pool_recycle: int = Field(default=3600)
```

Commit: "perf(db): configure connection pool settings"

---

## Issue 2: Double refresh() Calls (P2-PERF-003)

**Location:** `backend/app/routers/loot_tracking.py` (around line 220)

**Current state:**
```python
await db.refresh(entry)  # First refresh
await db.refresh(entry, ["recipient_player", "created_by"])  # Second refresh!
```

**Problem:** Two separate database round-trips when one would suffice.

**Solution options:**

Option A: Single refresh with all attributes
```python
await db.refresh(entry, ["recipient_player", "created_by"])
```

Option B: Use eager loading in the initial query
```python
# When creating/updating, immediately query back with joins
result = await db.execute(
    select(LootLogEntry)
    .options(
        joinedload(LootLogEntry.recipient_player),
        joinedload(LootLogEntry.created_by)
    )
    .where(LootLogEntry.id == entry.id)
)
entry = result.scalar_one()
```

Search for other double refresh patterns in the codebase and fix them.

Commit: "perf(db): remove redundant refresh calls"

---

## Issue 3: Inefficient Week Data Query (P2-PERF-006)

**Location:** `backend/app/routers/loot_tracking.py` (around lines 817-870)

**Current state:** Three separate queries for distinct weeks across tables.

**Solution:** Use UNION to combine in single query:
```python
from sqlalchemy import union_all

# Build individual queries for distinct weeks
loot_weeks = (
    select(LootLogEntry.week_number.label('week'))
    .where(LootLogEntry.tier_snapshot_id == tier.id)
    .distinct()
)
page_weeks = (
    select(PageLedgerEntry.week_number.label('week'))
    .where(PageLedgerEntry.tier_snapshot_id == tier.id)
    .distinct()
)
material_weeks = (
    select(MaterialLogEntry.week_number.label('week'))
    .where(MaterialLogEntry.tier_snapshot_id == tier.id)
    .distinct()
)

# Combine with UNION
combined_query = union_all(loot_weeks, page_weeks, material_weeks).alias('weeks')
result = await db.execute(
    select(combined_query.c.week).distinct().order_by(combined_query.c.week)
)
weeks = [row[0] for row in result.all()]
```

Commit: "perf(db): use UNION for week data query"

---

## Issue 4: No Request ID Tracking (P2-PERF-007)

**Location:** `backend/app/middleware/` and `backend/app/logging_config.py`

**Goal:** Add request IDs for log correlation.

**Step 1: Create middleware**
Create `backend/app/middleware/request_id.py`:
```python
import contextvars
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# Context var accessible from anywhere in the request
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Use provided ID or generate new one
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request_id_var.set(request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

def get_request_id() -> str:
    """Get current request ID from context."""
    return request_id_var.get()
```

**Step 2: Add to app**
In `backend/app/main.py`:
```python
from .middleware.request_id import RequestIDMiddleware

# Add early in middleware stack
app.add_middleware(RequestIDMiddleware)
```

**Step 3: Add to logging**
In `backend/app/logging_config.py`, add processor:
```python
from .middleware.request_id import get_request_id

def add_request_id(logger, method_name, event_dict):
    request_id = get_request_id()
    if request_id:
        event_dict["request_id"] = request_id
    return event_dict

# Add to processors list
processors = [
    # ... existing processors
    add_request_id,
    # ...
]
```

Commit: "feat(logging): add request ID middleware for log correlation"

---

## After All Fixes

```bash
pytest tests/ -q
```

Test request ID:
```bash
curl -I http://localhost:8000/health
# Should include X-Request-ID header
```
```

---

## Expected Outcomes

### Files Modified
- `backend/app/database.py` (pool config)
- `backend/app/config.py` (optional pool settings)
- `backend/app/routers/loot_tracking.py` (double refresh, week query)
- `backend/app/middleware/request_id.py` (new)
- `backend/app/middleware/__init__.py` (export)
- `backend/app/main.py` (add middleware)
- `backend/app/logging_config.py` (add processor)

### Request/Response Headers
```
Request: X-Request-ID: abc-123 (optional, client-provided)
Response: X-Request-ID: abc-123 (echoed back or generated)
```

### Log Output
```json
{
  "event": "user_login",
  "user_id": "123",
  "request_id": "abc-123",
  "timestamp": "..."
}
```

---

## Troubleshooting

### Pool connection errors
- Start with smaller pool_size in development
- Check database max_connections setting

### Request ID not appearing in logs
- Verify middleware order in main.py
- Check that logging processor is registered

### UNION query syntax errors
- Ensure all subqueries have same number of columns
- Use `.label()` to align column names

---

## Rollback Plan

```bash
git checkout backend/app/database.py
git checkout backend/app/routers/loot_tracking.py
git checkout backend/app/main.py
git checkout backend/app/logging_config.py
rm backend/app/middleware/request_id.py
```

---

## Commit Messages

```
perf(db): configure connection pool settings

Adds explicit pool configuration:
- pool_size: 20
- max_overflow: 10
- pool_pre_ping: true
- pool_recycle: 3600

Improves connection reuse and reliability.

Addresses: P2-PERF-004
```

```
perf(db): remove redundant refresh calls

Replaces double db.refresh() calls with single refresh
including all needed relationships.

Addresses: P2-PERF-003
```

```
perf(db): use UNION for week data query

Combines three separate queries for distinct weeks into
single UNION query, reducing database round-trips.

Addresses: P2-PERF-006
```

```
feat(logging): add request ID middleware for log correlation

- Adds RequestIDMiddleware to generate/propagate request IDs
- Adds X-Request-ID response header
- Includes request_id in all log entries

Enables tracing requests through logs.

Addresses: P2-PERF-007
```
