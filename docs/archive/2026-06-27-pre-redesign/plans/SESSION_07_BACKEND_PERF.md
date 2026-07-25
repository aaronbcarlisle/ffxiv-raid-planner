# Session 7: Backend Performance - Pagination + Indexes

**Duration:** 3-4 hours
**Issues:** P1-PERF-001, P1-PERF-002
**Priority:** HIGH

---

## Pre-Session Checklist

- [ ] Backend virtual environment activated
- [ ] All tests passing (`pytest tests/ -q`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to add pagination to loot log endpoints and add missing database indexes. Work through each issue, creating commits after each fix.

## Issue 1: Add Pagination to Loot Log Endpoints (P1-PERF-001)

**Location:** `backend/app/routers/loot_tracking.py`

**Endpoints to modify:**
1. `GET /{group_id}/tiers/{tier_id}/loot-log` (around line 93)
2. `GET /{group_id}/tiers/{tier_id}/page-ledger` (around line 419)
3. `GET /{group_id}/tiers/{tier_id}/material-log` (around line 876)

**Current problem:** All three endpoints return ALL records without pagination.

**Required changes for each endpoint:**

1. Add query parameters:
```python
from fastapi import Query

@router.get("/{group_id}/tiers/{tier_id}/loot-log")
async def get_loot_log(
    group_id: str,
    tier_id: str,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    week: int | None = Query(default=None, ge=1),  # Optional filter
    # ... existing params
):
```

2. Apply pagination to query:
```python
query = (
    select(LootLogEntry)
    .where(LootLogEntry.tier_snapshot_id == tier.id)
    .order_by(LootLogEntry.week_number.desc(), LootLogEntry.created_at.desc())
    .offset(skip)
    .limit(limit)
)

# Add week filter if provided
if week:
    query = query.where(LootLogEntry.week_number == week)
```

3. Optionally add total count in response header:
```python
# Get total count for pagination info
count_query = select(func.count(LootLogEntry.id)).where(...)
total = await db.scalar(count_query)

# After getting results, before return:
response.headers["X-Total-Count"] = str(total)
response.headers["X-Page-Size"] = str(limit)
```

**Apply same pattern to:**
- `/page-ledger` (PageLedgerEntry)
- `/material-log` (MaterialLogEntry)

**Testing:**
1. Run existing tests: `pytest tests/ -q`
2. Test pagination manually:
   - `GET /loot-log?limit=10` should return max 10 items
   - `GET /loot-log?skip=10&limit=10` should return next 10
   - `GET /loot-log?week=1` should filter by week

Commit: "feat(api): add pagination to loot log endpoints"

---

## Issue 2: Add Missing Foreign Key Indexes (P1-PERF-002)

**Location:** Multiple model files

**Models to modify:**
1. `backend/app/models/loot_log_entry.py`
2. `backend/app/models/material_log_entry.py`
3. `backend/app/models/page_ledger_entry.py`

**Current state (example):**
```python
recipient_player_id: Mapped[str] = mapped_column(ForeignKey("snapshot_players.id"))
tier_snapshot_id: Mapped[str] = mapped_column(ForeignKey("tier_snapshots.id"))
created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
```

**Required change - add `index=True`:**
```python
recipient_player_id: Mapped[str] = mapped_column(
    ForeignKey("snapshot_players.id"), index=True
)
tier_snapshot_id: Mapped[str] = mapped_column(
    ForeignKey("tier_snapshots.id"), index=True
)
created_by_user_id: Mapped[str | None] = mapped_column(
    ForeignKey("users.id"), index=True
)
```

**After modifying models, create migration:**
```bash
cd backend
alembic revision --autogenerate -m "add_fk_indexes_loot_tables"
```

**Review the generated migration:**
- Should contain CREATE INDEX statements
- Verify index names are reasonable
- Check no unintended changes included

**Apply migration:**
```bash
alembic upgrade head
```

**Testing:**
1. Run tests: `pytest tests/ -q`
2. Verify indexes exist in database (if you have DB access)

Commit: "perf(db): add indexes on FK columns for loot tables"

---

## After Both Fixes

```bash
pytest tests/ -q
# Test API with pagination
# Verify migration applied cleanly
```
```

---

## Expected Outcomes

### Files Modified
- `backend/app/routers/loot_tracking.py` (3 endpoints)
- `backend/app/models/loot_log_entry.py`
- `backend/app/models/material_log_entry.py`
- `backend/app/models/page_ledger_entry.py`
- `backend/alembic/versions/xxx_add_fk_indexes_loot_tables.py` (new)

### API Changes
Before:
```
GET /loot-log  -> Returns ALL records
```

After:
```
GET /loot-log?skip=0&limit=100&week=1
Response headers:
  X-Total-Count: 247
  X-Page-Size: 100
```

### Database Changes
New indexes:
- `ix_loot_log_entries_tier_snapshot_id`
- `ix_loot_log_entries_recipient_player_id`
- `ix_loot_log_entries_created_by_user_id`
- (Similar for material_log and page_ledger)

---

## Troubleshooting

### Alembic can't detect changes
- Ensure models are imported in `env.py`
- Try `alembic revision -m "manual"` and write migration manually

### Index already exists
- Migration may fail if index already present
- Add `if_not_exists=True` or wrap in try/except

### Frontend breaks with pagination
- Frontend may need updates to handle pagination
- Start with high default limit (100) for backward compatibility

---

## Rollback Plan

```bash
# Rollback migration
alembic downgrade -1

# Restore files
git checkout backend/app/routers/loot_tracking.py
git checkout backend/app/models/loot_log_entry.py
git checkout backend/app/models/material_log_entry.py
git checkout backend/app/models/page_ledger_entry.py
```

---

## Commit Messages

```
feat(api): add pagination to loot log endpoints

Adds skip/limit/week query parameters to:
- GET /loot-log
- GET /page-ledger
- GET /material-log

Default: limit=100, max=500
Adds X-Total-Count and X-Page-Size response headers

Addresses: P1-PERF-001
```

```
perf(db): add indexes on FK columns for loot tables

Adds indexes to foreign key columns for improved query performance:
- loot_log_entries: tier_snapshot_id, recipient_player_id, created_by_user_id
- material_log_entries: same
- page_ledger_entries: same

Addresses: P1-PERF-002
```
