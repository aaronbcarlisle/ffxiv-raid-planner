# Session 4: High Priority Security - Headers + SSRF

**Duration:** 2-3 hours
**Issues:** P1-SEC-002, P1-SEC-003
**Priority:** HIGH

---

## Pre-Session Checklist

- [ ] Backend virtual environment activated
- [ ] All tests passing (`pytest tests/ -q`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to add missing security headers and fix an SSRF vulnerability. Work through each issue, creating commits after each fix.

## Issue 1: Missing Content-Security-Policy Header (P1-SEC-002)

**Location:** `backend/app/middleware/security.py`

**Current state:** SecurityHeadersMiddleware exists with 6 headers but NO CSP.

**Required change:** Add Content-Security-Policy header in the `dispatch()` method.

The CSP should allow:
- Default: self only
- Scripts: self + unsafe-inline (for React) + Vercel analytics
- Styles: self + unsafe-inline (for Tailwind)
- Images: self + data URIs + xivapi.com + Discord CDN
- Connections: self + xivgear.app + garlandtools + etro.gg
- Frames: none (prevent clickjacking)

**Implementation:**
```python
# Add after existing headers in dispatch()
response.headers["Content-Security-Policy"] = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https://xivapi.com https://cdn.discordapp.com; "
    "connect-src 'self' https://api.xivgear.app https://www.garlandtools.org https://etro.gg; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)
```

**Testing:**
1. Start the dev server
2. Verify header present: `curl -I http://localhost:8000/health | grep Content-Security-Policy`
3. Test that the frontend still works (no CSP violations in console)

Commit: "feat(security): add Content-Security-Policy header"

---

## Issue 2: SSRF Vulnerability - Redirects Not Disabled (P1-SEC-003)

**Location:** `backend/app/routers/bis.py`

**Current problem:** httpx.AsyncClient follows redirects by default, allowing potential SSRF.

**Locations to fix (4 places):**
1. `fetch_item_from_garland()` - around line 220
2. `fetch_bis_from_github()` - around line 333
3. `fetch_bis_from_shortlink()` - around line 357
4. `fetch_bis_from_etro()` - around line 407

**Required change for each:**
```python
# Change FROM:
async with httpx.AsyncClient() as client:
    response = await client.get(url, timeout=10.0)

# Change TO:
async with httpx.AsyncClient(follow_redirects=False) as client:
    response = await client.get(url, timeout=10.0)
    # Optionally add redirect detection:
    if response.status_code in (301, 302, 303, 307, 308):
        logger.warning("bis_unexpected_redirect", url=url, status=response.status_code)
        raise HTTPException(status_code=502, detail="External service returned redirect")
```

**Note:** Only add the redirect detection if it makes sense for that endpoint. For GitHub raw files and xivgear, redirects should NOT happen with valid URLs.

**Testing:**
1. Run `pytest tests/ -k bis -v` if there are BiS-related tests
2. Manually test BiS import flow:
   - Import from xivgear
   - Import from etro
   - Import a preset

Commit: "fix(security): disable httpx redirects to prevent SSRF"

---

## Verification

After all changes:
```bash
# Backend tests
cd backend && pytest tests/ -q

# Check CSP header
curl -I http://localhost:8000/health | grep -i security

# Test BiS import still works
# (Manual test via UI)
```
```

---

## Expected Outcomes

### Files Modified
- `backend/app/middleware/security.py` (add CSP)
- `backend/app/routers/bis.py` (fix 4 httpx calls)

### Headers After Fix
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
Content-Security-Policy: default-src 'self'; script-src 'self' ...  # NEW
```

### Tests to Verify
```bash
pytest tests/ -q

# CSP verification
curl -I http://localhost:8000/health
```

---

## Troubleshooting

### CSP Violations in Browser Console
If you see CSP violations after adding the header:
1. Check browser console for specific blocked resource
2. Add the domain to appropriate CSP directive
3. Be conservative - only add what's truly needed

### BiS Import Fails After SSRF Fix
If BiS import stops working:
1. Check if the external API actually redirects
2. If legitimate redirect needed, log and handle gracefully
3. Consider allowlisting specific redirect patterns

---

## Rollback Plan

```bash
git checkout backend/app/middleware/security.py backend/app/routers/bis.py
```

---

## Commit Messages

```
feat(security): add Content-Security-Policy header

Adds CSP to SecurityHeadersMiddleware with:
- Default self-only
- Scripts: self + inline + Vercel analytics
- Styles: self + inline
- Images: self + data + xivapi + Discord CDN
- Connections: self + xivgear + garlandtools + etro
- Frame ancestors: none

Addresses: P1-SEC-002
```

```
fix(security): disable httpx redirects to prevent SSRF

Disables automatic redirect following in all external API calls:
- fetch_item_from_garland
- fetch_bis_from_github
- fetch_bis_from_shortlink
- fetch_bis_from_etro

Prevents SSRF where compromised external service could
redirect to internal resources.

Addresses: P1-SEC-003
```
