# Session 10: Backend Consistency - Transactions + Errors

**Duration:** 4-5 hours
**Issues:** P2-ARCH-003, P2-ARCH-004, P2-SEC-002, P2-SEC-003
**Priority:** MEDIUM

---

## Pre-Session Checklist

- [ ] Backend virtual environment activated
- [ ] All tests passing (`pytest tests/ -q`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to standardize backend patterns for consistency. Work through each issue, creating commits after each fix.

## Issue 1: Inconsistent Transaction Management (P2-ARCH-003)

**Location:** Multiple routers

**Current patterns found:**

Pattern A (flush then commit):
```python
await session.flush()
await session.commit()
```

Pattern B (direct commit):
```python
db.add(entry)
await db.commit()
```

Pattern C (no refresh after commit):
```python
await db.commit()
# No refresh!
```

**Standard pattern to adopt:**
```python
# For CREATE operations
db.add(entity)
await db.flush()  # Get ID, trigger constraints early
await db.commit()
await db.refresh(entity)  # Load any defaults/relationships
return entity

# For UPDATE operations
entity.field = new_value
await db.commit()
await db.refresh(entity)
return entity
```

**Files to review and standardize:**
- `backend/app/routers/static_groups.py`
- `backend/app/routers/tiers.py`
- `backend/app/routers/loot_tracking.py`

Search for patterns like:
- `db.add(` without `db.flush()`
- `db.commit()` without `db.refresh()`
- Double `db.refresh()` calls (see P2-PERF-003)

Commit: "refactor(db): standardize transaction patterns across routers"

---

## Issue 2: Mixed Error Response Formats (P2-ARCH-004)

**Location:** All routers

**Current state:**

HTTPException format:
```python
raise HTTPException(status_code=404, detail="Not found")
# Response: {"detail": "Not found"}
```

AppException format:
```python
raise AppException(error="not_found", message="Resource not found")
# Response: {"error": "not_found", "message": "...", "details": {...}}
```

**Goal:** Standardize ALL errors through AppException for consistent API responses.

**Changes needed:**

1. Review `backend/app/exceptions.py` to understand AppException structure
2. Create helper functions for common errors:
```python
def not_found(resource: str, id: str) -> AppException:
    return AppException(
        status_code=404,
        error="not_found",
        message=f"{resource} not found",
        details={"id": id}
    )

def permission_denied(reason: str) -> AppException:
    return AppException(
        status_code=403,
        error="permission_denied",
        message=reason
    )
```

3. Replace HTTPException calls with AppException in routers:
```python
# Before
raise HTTPException(status_code=404, detail="Group not found")

# After
raise not_found("Static group", group_id)
```

**Priority files:**
- `backend/app/routers/loot_tracking.py` (most HTTPException usage)
- `backend/app/routers/tiers.py`
- `backend/app/routers/static_groups.py`

Commit: "refactor(api): standardize error responses using AppException"

---

## Issue 3: Timing Attack on User Enumeration (P2-SEC-002)

**Location:** `backend/app/dependencies.py` (around lines 58-73)

**Current state:**
```python
if not user_id:  # Line 58
    raise HTTPException(detail="Invalid or expired token")
if not user:     # Line 68
    raise HTTPException(detail="User not found")  # Different message!
```

**Problem:** Different error messages allow attackers to distinguish between:
- Invalid token
- Valid token for non-existent user

**Solution:**
```python
GENERIC_AUTH_ERROR = HTTPException(
    status_code=401,
    detail="Authentication failed"
)

# Replace both specific errors with generic one
if not user_id:
    raise GENERIC_AUTH_ERROR
if not user:
    raise GENERIC_AUTH_ERROR
```

Commit: "fix(security): use generic auth error to prevent user enumeration"

---

## Issue 4: Information Leakage in BiS Router (P2-SEC-003)

**Location:** `backend/app/routers/bis.py` (around line 339)

**Current state:**
```python
except Exception as e:
    raise HTTPException(status_code=502, detail=f"Failed to reach GitHub: {e}")
    # Exposes exception details!
```

**Problem:** Exception details could reveal internal paths, library versions, etc.

**Solution:**
```python
from ..logging_config import get_logger
logger = get_logger(__name__)

# ...

except Exception as e:
    logger.exception("bis_github_fetch_failed", url=url)
    raise HTTPException(status_code=502, detail="Failed to fetch BiS data")
```

Search for similar patterns in bis.py and fix all of them.

Commit: "fix(security): hide internal error details in BiS router"

---

## After All Fixes

```bash
pytest tests/ -q
```

Test that API errors return consistent format:
```bash
# Should return {"error": "...", "message": "...", "details": {...}}
curl http://localhost:8001/api/static-groups/nonexistent | jq
```
```

---

## Expected Outcomes

### Files Modified
- `backend/app/routers/static_groups.py`
- `backend/app/routers/tiers.py`
- `backend/app/routers/loot_tracking.py`
- `backend/app/routers/bis.py`
- `backend/app/dependencies.py`
- `backend/app/exceptions.py` (add helpers)

### API Response Consistency
Before:
```json
{"detail": "Not found"}
```

After:
```json
{
  "error": "not_found",
  "message": "Static group not found",
  "details": {"id": "abc123"}
}
```

---

## Troubleshooting

### Tests fail after error format change
- Update test assertions to match new format
- Check for tests that expect `detail` key

### AppException not imported
- Ensure import at top of router files
- Check circular import issues

---

## Rollback Plan

```bash
git checkout backend/app/routers/*.py
git checkout backend/app/dependencies.py
git checkout backend/app/exceptions.py
```

---

## Commit Messages

```
refactor(db): standardize transaction patterns across routers

Adopts consistent pattern:
- CREATE: add -> flush -> commit -> refresh
- UPDATE: modify -> commit -> refresh

Ensures IDs available after create and relationships loaded.

Addresses: P2-ARCH-003
```

```
refactor(api): standardize error responses using AppException

Replaces HTTPException with AppException for consistent format:
{"error": "...", "message": "...", "details": {...}}

Adds helper functions: not_found(), permission_denied(), etc.

Addresses: P2-ARCH-004
```

```
fix(security): use generic auth error to prevent user enumeration

Uses same error message for both invalid token and missing user
to prevent attackers from determining valid token states.

Addresses: P2-SEC-002
```

```
fix(security): hide internal error details in BiS router

Logs exceptions internally but returns generic message to clients.
Prevents leaking internal paths, library versions, etc.

Addresses: P2-SEC-003
```
