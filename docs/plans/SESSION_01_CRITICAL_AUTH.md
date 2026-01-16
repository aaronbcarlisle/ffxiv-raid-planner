# Session 1: Critical Security - Auth Hardening

**Duration:** 3-4 hours
**Issues:** P0-SEC-001, P0-SEC-002, P0-SEC-003
**Priority:** CRITICAL - Execute First

---

## Pre-Session Checklist

- [ ] Backend virtual environment activated
- [ ] All tests passing (`pytest tests/ -q`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to fix 3 critical security issues in the FFXIV Raid Planner backend. Work through each issue one at a time, creating small, reviewable commits after each fix.

## Issue 1: JWT Tokens Returned in JSON Response Body (P0-SEC-001)

**Location:** `backend/app/routers/auth.py` and `backend/app/schemas/auth.py`

**Current problem:** The TokenResponse includes access_token and refresh_token in the JSON body, which defeats httpOnly cookie security.

**Required changes:**

1. In `backend/app/schemas/auth.py`, make the tokens Optional:
```python
class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: int
```

2. In `backend/app/routers/auth.py`, add a helper function:
```python
def wants_legacy_tokens(request: Request) -> bool:
    """Check if client explicitly requests tokens in response body (legacy mode)."""
    hdr = request.headers.get("X-Legacy-Token-Response", "")
    qry = request.query_params.get("legacyTokens", "")
    return hdr == "1" or qry.lower() == "true"
```

3. Modify the callback and refresh endpoints to only include tokens in response when `wants_legacy_tokens(request)` is True.

After implementing, run `pytest tests/test_auth_utils.py tests/test_httponly_cookies.py -v` to verify.

---

## Issue 2: OAuth State Cache Missing TTL (P0-SEC-002)

**Location:** `backend/app/cache.py`

**Current problem:** The local cache fallback stores values without TTL, allowing OAuth state replay attacks.

**Required changes:**

1. Create a dataclass for local cache entries:
```python
from dataclasses import dataclass

@dataclass
class _LocalEntry:
    value: Any
    expires_at: float
```

2. Change `_local_cache` type to store `_LocalEntry` objects.

3. Add a `_purge_expired()` method that removes expired entries.

4. Update `get()`, `set()`, and `exists()` methods to:
   - Call `_purge_expired()` before access
   - Check expiration on get
   - Store with `expires_at = time.time() + ttl` on set

After implementing, test that:
- OAuth flow still works
- Local cache entries expire after TTL

---

## Issue 3: Rate-Limit IP Header Spoofing (P0-SEC-003)

**Location:** `backend/app/rate_limit.py` and `backend/app/config.py`

**Current problem:** X-Forwarded-For header trusted unconditionally, allowing rate limit bypass.

**Required changes:**

1. In `backend/app/config.py`, add to Settings:
```python
trusted_proxy_ips: list[str] = Field(default_factory=list)
```

2. In `backend/app/rate_limit.py`, modify `get_client_ip()`:
```python
def get_client_ip(request: Request) -> str:
    settings = get_settings()
    peer = request.client.host if request.client else ""

    # Only trust forwarded headers if request comes from trusted proxy
    if peer in settings.trusted_proxy_ips:
        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        x_real_ip = request.headers.get("X-Real-IP")
        if x_real_ip:
            return x_real_ip.strip()

    return peer or "unknown"
```

After implementing, verify with test that:
- Untrusted requests use peer IP
- Only trusted proxy IPs have X-Forwarded-For honored

---

## After All Changes

1. Run full backend test suite: `pytest tests/ -q`
2. Test OAuth login flow manually
3. Commit with message: "fix(security): harden auth - cookie-only tokens, cache TTL, proxy trust"

Do NOT make any changes beyond what's specified. Maintain existing code style.
```

---

## Expected Outcomes

### Files Modified
- `backend/app/schemas/auth.py`
- `backend/app/routers/auth.py`
- `backend/app/cache.py`
- `backend/app/config.py`
- `backend/app/rate_limit.py`

### Tests to Verify
```bash
pytest tests/test_auth_utils.py -v
pytest tests/test_httponly_cookies.py -v
pytest tests/ -q  # Full suite
```

### Manual Verification
1. Start dev servers: `./dev.sh`
2. Navigate to app, click Discord login
3. Verify login completes successfully
4. Check browser DevTools -> Application -> Cookies
   - Should see `access_token` and `refresh_token` cookies
5. Check Network tab for callback response
   - JSON body should NOT contain tokens (unless legacy header sent)

---

## Rollback Plan

If issues arise:
```bash
git stash  # or
git checkout backend/app/routers/auth.py backend/app/schemas/auth.py backend/app/cache.py backend/app/config.py backend/app/rate_limit.py
```

---

## Commit Message Template

```
fix(security): harden auth - cookie-only tokens, cache TTL, proxy trust

- Make JWT tokens in response body opt-in via X-Legacy-Token-Response header
- Add TTL enforcement to local cache fallback (OAuth state expiration)
- Only trust X-Forwarded-For from configured trusted proxy IPs

Addresses: P0-SEC-001, P0-SEC-002, P0-SEC-003
```
