# Session 12: Security Hardening - OAuth + Validation

**Duration:** 3-4 hours
**Issues:** P2-SEC-001, P2-SEC-004, P2-API-002
**Priority:** MEDIUM

---

## Pre-Session Checklist

- [ ] Backend virtual environment activated
- [ ] All tests passing (`pytest tests/ -q`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to add OAuth state binding, BiS input validation, and standardize status codes. Work through each issue, creating commits after each fix.

## Issue 1: OAuth State Not Bound to Session (P2-SEC-001)

**Location:** `backend/app/routers/auth.py` (around lines 49-86)

**Current state:** OAuth state token is cached but not bound to client IP or user agent.

**Problem:** Attacker could potentially intercept state token and use it from different client.

**Solution:**

1. When generating state, store additional context:
```python
import hashlib

@router.get("/discord")
async def discord_auth(request: Request, redirect_uri: str = Query(...)):
    state = secrets.token_urlsafe(32)

    # Bind state to client context
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")[:100]

    state_data = {
        "created": datetime.now(timezone.utc).isoformat(),
        "redirect_uri": redirect_uri,
        "ip_hash": hashlib.sha256(client_ip.encode()).hexdigest()[:16],
        "ua_hash": hashlib.sha256(user_agent.encode()).hexdigest()[:16],
    }

    await oauth_state_cache.set(state, state_data)
    # ... rest of function
```

2. When validating callback, check context matches:
```python
@router.post("/callback")
async def discord_callback(request: Request, data: OAuthCallbackRequest):
    cached = await oauth_state_cache.get(data.state)
    if not cached:
        raise HTTPException(status_code=400, detail="Invalid state")

    # Verify client context
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")[:100]
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
    ua_hash = hashlib.sha256(user_agent.encode()).hexdigest()[:16]

    if cached.get("ip_hash") != ip_hash:
        logger.warning("oauth_ip_mismatch", state=data.state[:8])
        raise HTTPException(status_code=400, detail="Session mismatch")

    # UA mismatch is less severe - log but allow
    if cached.get("ua_hash") != ua_hash:
        logger.info("oauth_ua_mismatch", state=data.state[:8])

    # ... rest of callback
```

**Note:** Use hashes instead of raw values to avoid logging sensitive info.

Commit: "fix(security): bind OAuth state to client IP and user agent"

---

## Issue 2: Insufficient BiS Path Input Validation (P2-SEC-004)

**Location:** `backend/app/routers/bis.py` (around lines 111-148)

**Current state:** Job and tier names extracted from URLs are not validated.

**Solution:**

1. Define valid values (consider putting in a constants file):
```python
VALID_JOBS = {
    # Tanks
    "pld", "war", "drk", "gnb",
    # Healers
    "whm", "sch", "ast", "sge",
    # Melee
    "mnk", "drg", "nin", "sam", "rpr", "vpr",
    # Ranged
    "brd", "mch", "dnc",
    # Casters
    "blm", "smn", "rdm", "pct",
}

VALID_TIERS = {
    "current",  # Current tier
    "m1s-m4s", "m5s-m8s", "m9s-m12s",  # Savage tiers
    "fru", "top", "dsr", "tea", "ucob", "uwu",  # Ultimates
}
```

2. Validate in extraction function:
```python
def extract_bis_path(url_or_uuid: str) -> tuple[str, str | None]:
    # ... existing logic to extract job and tier ...

    if path_type == "bis":
        parts = identifier.split("/")
        if len(parts) != 2:
            raise ValueError("Invalid BiS path format")

        job, tier = parts[0].lower(), parts[1].lower()

        if job not in VALID_JOBS:
            logger.warning("bis_invalid_job", job=job)
            raise ValueError(f"Invalid job: {job}")

        if tier not in VALID_TIERS:
            logger.warning("bis_invalid_tier", tier=tier)
            raise ValueError(f"Invalid tier: {tier}")

        return (job, tier)
```

3. Return appropriate HTTP error:
```python
try:
    job, tier = extract_bis_path(url_or_uuid)
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
```

Commit: "fix(security): validate BiS job and tier inputs against whitelist"

---

## Issue 3: Inconsistent DELETE Status Codes (P2-API-002)

**Location:** Multiple routers

**Current state:** Some endpoints use raw `204`, others use `status.HTTP_204_NO_CONTENT`.

**Solution:** Standardize all DELETE endpoints to use the constant.

Search pattern:
```python
# Find all DELETE endpoints
@router.delete
status_code=204  # Change to status.HTTP_204_NO_CONTENT
```

Files to check:
- `backend/app/routers/static_groups.py`
- `backend/app/routers/tiers.py`
- `backend/app/routers/loot_tracking.py`
- `backend/app/routers/invitations.py`

Example fix:
```python
# Before
@router.delete("/{group_id}", status_code=204)

# After
from starlette import status

@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
```

Commit: "refactor(api): use HTTP status constants for DELETE endpoints"

---

## After All Fixes

```bash
pytest tests/ -q
```

Test OAuth flow:
1. Start fresh login
2. Complete Discord OAuth
3. Verify session works

Test BiS import:
1. Import valid job/tier
2. Try invalid job - should get 400 error
```

---

## Expected Outcomes

### Files Modified
- `backend/app/routers/auth.py` (OAuth state binding)
- `backend/app/routers/bis.py` (input validation)
- `backend/app/routers/static_groups.py` (status codes)
- `backend/app/routers/tiers.py` (status codes)
- `backend/app/routers/loot_tracking.py` (status codes)
- `backend/app/routers/invitations.py` (status codes)

### Security Improvements
- OAuth state replay harder from different client
- BiS import rejects invalid job/tier combinations
- Consistent API status codes

---

## Troubleshooting

### OAuth fails after state binding
- Check client IP detection works correctly
- Verify hash comparison is consistent
- Consider allowing IP mismatch in development

### BiS import fails for valid jobs
- Verify VALID_JOBS includes all current FFXIV jobs
- Check lowercase normalization

### Tests expect raw 204
- Update test assertions to accept either format
- Both 204 and HTTP_204_NO_CONTENT are the same value

---

## Rollback Plan

```bash
git checkout backend/app/routers/auth.py
git checkout backend/app/routers/bis.py
git checkout backend/app/routers/static_groups.py
git checkout backend/app/routers/tiers.py
git checkout backend/app/routers/loot_tracking.py
git checkout backend/app/routers/invitations.py
```

---

## Commit Messages

```
fix(security): bind OAuth state to client IP and user agent

Stores hashed client IP and user agent with OAuth state.
Validates these match on callback to prevent state theft.

Uses SHA256 hashes to avoid logging sensitive values.

Addresses: P2-SEC-001
```

```
fix(security): validate BiS job and tier inputs against whitelist

Adds VALID_JOBS and VALID_TIERS constants.
Validates extracted values before making external requests.
Returns 400 Bad Request for invalid inputs.

Addresses: P2-SEC-004
```

```
refactor(api): use HTTP status constants for DELETE endpoints

Standardizes all DELETE endpoints to use:
  status_code=status.HTTP_204_NO_CONTENT

Improves code consistency and readability.

Addresses: P2-API-002
```
