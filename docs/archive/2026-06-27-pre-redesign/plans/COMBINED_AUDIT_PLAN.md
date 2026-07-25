# FFXIV Raid Planner - Combined Audit Plan

**Generated:** January 16, 2026
**Sources:** ChatGPT Audit, Claude Code Audit, Claude Web Browser Audit
**Total Unique Issues:** 47

---

## Executive Summary

This document consolidates findings from three independent code audits into a single, prioritized remediation plan organized into Claude Code execution sessions.

### Issue Severity Distribution

| Severity | Count | Category Breakdown |
|----------|-------|-------------------|
| **Critical (P0)** | 4 | Security: 3, Performance: 1 |
| **High (P1)** | 12 | Security: 6, Performance: 3, Architecture: 2, DevOps: 1 |
| **Medium (P2)** | 19 | Performance: 7, Architecture: 6, Security: 4, API: 2 |
| **Low (P3)** | 12 | Code quality, minor optimizations |

### Top 5 Priority Issues

1. **JWT tokens returned in JSON response body** - Token exfiltration risk (P0-SEC-001)
2. **OAuth state cache missing TTL** - Replay attacks + memory leak (P0-SEC-002)
3. **Rate-limit IP header spoofing** - Bypass rate limits (P0-SEC-003)
4. **N+1 Query in Admin Dashboard** - 5-10 second load times (P0-PERF-001)
5. **React Router CVE vulnerabilities** - CSRF/XSS (P1-SEC-001)

### Estimated Total Effort

| Phase | Focus | Hours | Sessions |
|-------|-------|-------|----------|
| Phase 1 | Critical Security | 8-10 | 2 |
| Phase 2 | High Priority Security + Performance | 12-15 | 3 |
| Phase 3 | Performance Optimization | 8-10 | 2 |
| Phase 4 | API Consistency + Architecture | 10-12 | 3 |
| Phase 5 | Code Quality + Polish | 6-8 | 2 |
| **Total** | | **44-55** | **12** |

---

## Table of Contents

1. [Critical Issues (P0)](#1-critical-issues-p0)
2. [High Severity Issues (P1)](#2-high-severity-issues-p1)
3. [Medium Severity Issues (P2)](#3-medium-severity-issues-p2)
4. [Low Severity Issues (P3)](#4-low-severity-issues-p3)
5. [Issues Verified as Fixed](#5-issues-verified-as-fixed)
6. [Session Breakdown](#6-session-breakdown)
7. [Verification Checklist](#7-verification-checklist)
8. [File Reference Matrix](#8-file-reference-matrix)

---

## 1. Critical Issues (P0)

### P0-SEC-001: JWT Tokens Returned in JSON Response Body
**Sources:** ChatGPT Audit (1.1), Claude Web Browser Audit (partial)
**Severity:** Critical
**Category:** Security
**Location:** `backend/app/routers/auth.py:199-205`

**Current State:**
```python
# Still return tokens in body for backward compatibility
return TokenResponse(
    access_token=access_token,
    refresh_token=refresh_token,
    expires_in=settings.jwt_access_token_expire_minutes * 60,
)
```

**Problem:**
Returning JWTs in JSON response undermines httpOnly cookie security. Any XSS vulnerability, logging middleware, or network proxy can capture tokens.

**Impact:**
- Token exfiltration via XSS
- Two auth channels = larger attack surface
- Violates security best practice of cookie-only tokens

**Solution:**
Make token return opt-in via explicit header/query parameter. Default to cookies-only.

**Files to Modify:**
- `backend/app/schemas/auth.py` - Make tokens Optional
- `backend/app/routers/auth.py` - Add `wants_legacy_tokens()` check

**Effort:** 2-3 hours

---

### P0-SEC-002: OAuth State Cache Fallback Missing TTL
**Sources:** ChatGPT Audit (1.2)
**Severity:** Critical
**Category:** Security / Stability
**Location:** `backend/app/cache.py:115-117, 145`

**Current State:**
```python
# Fallback to local cache (no TTL enforcement for simplicity)
self._local_cache[full_key] = value
```

**Problem:**
OAuth state must expire to prevent replay attacks. Redis path uses `setex` with TTL, but local fallback stores values indefinitely.

**Impact:**
- OAuth state replay window in dev/staging
- Memory growth in long-running processes
- Security regression when Redis unavailable

**Solution:**
Implement TTL enforcement in local cache using `(value, expires_at)` tuples.

**Files to Modify:**
- `backend/app/cache.py` - Add `_LocalEntry` dataclass with expiration

**Effort:** 1-2 hours

---

### P0-SEC-003: Rate-Limit IP Extraction Trusts Spoofable Headers
**Sources:** ChatGPT Audit (1.3), Claude Code Audit (P3-006), Claude Web Browser Audit (partial)
**Severity:** Critical
**Category:** Security
**Location:** `backend/app/rate_limit.py:27-45`

**Current State:**
```python
if x_forwarded_for:
    return x_forwarded_for.split(",")[0].strip()
if x_real_ip:
    return x_real_ip.strip()
```

**Problem:**
Attackers can bypass rate limits by spoofing `X-Forwarded-For` header when not behind a trusted proxy.

**Impact:**
- Rate limit bypass for brute force attacks
- Auth endpoint (10/min limit) can be overwhelmed

**Solution:**
Only trust forwarded headers when request originates from a known proxy IP.

**Files to Modify:**
- `backend/app/config.py` - Add `trusted_proxy_ips` setting
- `backend/app/rate_limit.py` - Check peer IP against trusted list

**Effort:** 1-2 hours

---

### P0-PERF-001: N+1 Query in Admin Dashboard
**Sources:** Claude Web Browser Audit (C-001)
**Severity:** Critical
**Category:** Performance
**Location:** `backend/app/routers/static_groups.py:359-450`

**Current State:**
```python
query = (
    select(StaticGroup)
    .options(
        selectinload(StaticGroup.tier_snapshots),  # Loads ALL tiers
        selectinload(StaticGroup.memberships),     # Loads ALL memberships
    )
)
# ...
tier_count=len(group.tier_snapshots)  # Counts in Python!
```

**Problem:**
Code builds subqueries for counts but never uses them. Instead loads entire collections and counts in Python.

**Impact:**
- Admin dashboard takes 5-10+ seconds with 50+ groups
- O(n) database queries where n = number of groups
- Connection pool exhaustion under load

**Solution:**
Use scalar subqueries in SELECT statement for counts instead of eager loading.

**Files to Modify:**
- `backend/app/routers/static_groups.py` - Fix admin list query

**Effort:** 3 hours

---

## 2. High Severity Issues (P1)

### P1-SEC-001: React Router DOM CVE Vulnerabilities
**Sources:** Claude Code Audit (P1-001), Claude Web Browser Audit (H-002)
**Severity:** High
**Category:** Security (A06:2021)
**Location:** `frontend/package.json`

**Current:** `react-router-dom: 7.11.0`

**CVEs:**
- GHSA-h5cw-625j-3rxh (CSRF in Action processing)
- GHSA-2w69-qvjg-hvjx (XSS via Open Redirects)
- GHSA-8v8x-cx79-35w7 (SSR XSS in ScrollRestoration)

**Solution:**
```bash
cd frontend && pnpm update react-router-dom@7.12.0
pnpm test && pnpm build
```

**Effort:** 30 minutes

---

### P1-SEC-002: Missing Content-Security-Policy Header
**Sources:** Claude Code Audit (P1-002), Claude Web Browser Audit (H-003)
**Severity:** High
**Category:** Security (A05:2021)
**Location:** `backend/app/middleware/security.py`

**Current Headers:** HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
**Missing:** Content-Security-Policy

**Solution:**
```python
response.headers["Content-Security-Policy"] = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https://cdn.discordapp.com https://xivapi.com; "
    "connect-src 'self' https://api.xivgear.app https://etro.gg; "
    "frame-ancestors 'none';"
)
```

**Effort:** 2 hours

---

### P1-SEC-003: SSRF Vulnerability in BiS Import (Redirects)
**Sources:** Claude Code Audit (P1-003), Claude Web Browser Audit (H-004)
**Severity:** High
**Category:** Security (A10:2021)
**Location:** `backend/app/routers/bis.py:220, 333, 357, 407`

**Current State:**
```python
async with httpx.AsyncClient() as client:
    response = await client.get(url)  # follow_redirects=True by default
```

**Problem:**
External URLs could redirect to internal services (SSRF).

**Solution:**
```python
async with httpx.AsyncClient(follow_redirects=False) as client:
    response = await client.get(url)
```

Apply to all 4 AsyncClient instantiations.

**Effort:** 30 minutes

---

### P1-SEC-004: Vulnerable Dependency - ecdsa CVE-2024-23342
**Sources:** Claude Web Browser Audit (H-001)
**Severity:** High
**Category:** Security (A06:2021)
**Location:** `backend/requirements.txt` (transitive via python-jose)

**Problem:**
`ecdsa 0.19.1` has known vulnerability. While not directly exploitable (using HS256), it's a hygiene issue.

**Solution:**
Consider migrating from `python-jose` to `PyJWT[crypto]>=2.8.0`

**Effort:** 2 hours

---

### P1-SEC-005: Global CSS Forces Aria-Hidden Visible
**Sources:** ChatGPT Audit (2.1)
**Severity:** High
**Category:** UX / Accessibility
**Location:** `frontend/src/index.css:216-221`

**Current State:**
```css
[data-aria-hidden="true"],
[aria-hidden="true"]:not([role="presentation"]):not(.sr-only) {
  visibility: visible !important;
  display: revert !important;
}
```

**Problem:**
Defeats aria-hidden semantics, breaking screen reader experience and modal overlays.

**Solution:**
Delete this CSS block, fix underlying Radix portal configuration.

**Effort:** 1 hour

---

### P1-SEC-006: Select Component MutationObserver Hacks
**Sources:** ChatGPT Audit (2.2)
**Severity:** High
**Category:** UX / Accessibility / Maintainability
**Location:** `frontend/src/components/ui/Select.tsx:24-58`

**Current State:**
Uses MutationObserver to remove `aria-hidden` and disable scroll lock.

**Solution:**
Re-enable Portal usage, remove MutationObserver hacks.

**Effort:** 4-6 hours (includes testing all Select usages)

---

### P1-ARCH-001: ProtectedRoute Navigates During Render
**Sources:** ChatGPT Audit (2.3)
**Severity:** High
**Category:** React Correctness
**Location:** `frontend/src/components/auth/ProtectedRoute.tsx:65-69`

**Current State:**
```typescript
if (!showLoginPrompt) {
  navigate('/');  // Side effect during render!
  return null;
}
```

**Solution:**
```typescript
import { Navigate } from 'react-router-dom';

if (!isAuthenticated && !showLoginPrompt) {
  return <Navigate to="/" replace />;
}
```

**Effort:** 30 minutes - 1 hour

---

### P1-ARCH-002: initializeAuth Doesn't Validate Cookie Session
**Sources:** ChatGPT Audit (2.4)
**Severity:** High
**Category:** Auth Correctness
**Location:** `frontend/src/stores/authStore.ts:317-321`

**Current State:**
```typescript
if (user) {
  await fetchUser();
}
```

**Problem:**
Only validates session if user object already persisted. Stale sessions with valid cookies may not be detected.

**Solution:**
Always call `fetchUser()` on boot regardless of persisted state.

**Effort:** 30 minutes - 1 hour

---

### P1-PERF-001: Missing Pagination on Loot Log Endpoints
**Sources:** Claude Code Audit (P1-005), Claude Web Browser Audit (H-005)
**Severity:** High
**Category:** Performance
**Location:** `backend/app/routers/loot_tracking.py:93, 419, 876`

**Endpoints Affected:**
- `/loot-log` - Returns ALL records
- `/page-ledger` - Returns ALL records
- `/material-log` - Returns ALL records

**Solution:**
Add `skip` and `limit` query parameters with defaults.

**Effort:** 2 hours

---

### P1-PERF-002: Missing Foreign Key Indexes
**Sources:** Claude Web Browser Audit (H-006)
**Severity:** High
**Category:** Performance
**Location:** `backend/app/models/loot_log_entry.py`, `material_log_entry.py`, `page_ledger_entry.py`

**Missing Indexes:**
- `recipient_player_id`
- `tier_snapshot_id`
- `created_by_user_id`

**Solution:**
Add `index=True` to FK columns, create Alembic migration.

**Effort:** 1 hour

---

### P1-DEVOPS-001: Dual Lockfiles (pnpm + npm)
**Sources:** ChatGPT Audit (2.5)
**Severity:** High
**Category:** Build Determinism
**Location:** `frontend/package-lock.json`, `frontend/pnpm-lock.yaml`

**Solution:**
Delete `package-lock.json`, enforce pnpm via CI check.

**Effort:** 30 minutes

---

### P1-DEVOPS-002: Backend Not in CI Workflow
**Sources:** ChatGPT Audit (2.6)
**Severity:** High
**Category:** DevOps / Quality
**Location:** `.github/workflows/ci.yml`

**Solution:**
Add backend job to run `pytest`, type checking.

**Effort:** 1-2 hours

---

## 3. Medium Severity Issues (P2)

### P2-PERF-001: Zustand Store Selectors Not Used in GroupView
**Sources:** Claude Code Audit (P1-004), ChatGPT Audit (3.1)
**Location:** `frontend/src/pages/GroupView.tsx:44-51`

**Problem:**
Entire store destructured, causing re-renders on ANY store change.

**Solution:**
Use individual selectors or existing selector hooks.

**Effort:** 1 hour

---

### P2-PERF-002: Derived Selectors Allocate New Arrays
**Sources:** ChatGPT Audit (3.2)
**Location:** `frontend/src/stores/tierStore.ts:835-872`

**Solution:**
Use `useMemo` in components or memoize in store.

**Effort:** 2 hours

---

### P2-PERF-003: Double refresh() Calls
**Sources:** Claude Code Audit (P2-004)
**Location:** `backend/app/routers/loot_tracking.py:220`

**Solution:**
Use eager loading instead of double refresh.

**Effort:** 1 hour

---

### P2-PERF-004: Missing Connection Pool Configuration
**Sources:** Claude Code Audit (P2-006)
**Location:** `backend/app/database.py`

**Solution:**
Add `pool_size=20`, `max_overflow=10`, `pool_pre_ping=True`, `pool_recycle=3600`.

**Effort:** 30 minutes

---

### P2-PERF-005: Inline Arrow Functions in JSX (110+ instances)
**Sources:** Claude Code Audit (P2-007)
**Location:** Multiple components (BiSImportModal, PlayerCard, PageBalancesPanel)

**Solution:**
Extract to `useCallback` in hot paths identified via profiler.

**Effort:** 2 hours

---

### P2-PERF-006: Inefficient Week Data Query
**Sources:** Claude Web Browser Audit (M-008)
**Location:** `backend/app/routers/loot_tracking.py:817-870`

**Problem:**
Three separate queries instead of UNION.

**Effort:** 1 hour

---

### P2-PERF-007: No Request ID Tracking
**Sources:** Claude Web Browser Audit (H-007)
**Location:** `backend/app/logging_config.py`

**Solution:**
Add RequestIDMiddleware for log correlation.

**Effort:** 2 hours

---

### P2-ARCH-001: useGroupViewState Hook Too Large (360 lines)
**Sources:** Claude Code Audit (P2-001)
**Location:** `frontend/src/hooks/useGroupViewState.ts`

**Problem:**
20+ useState calls managing unrelated concerns.

**Solution:**
Split into `usePageNavigation`, `useModalState`, `useViewSettings`.

**Effort:** 4 hours

---

### P2-ARCH-002: API Client Patterns Duplicated
**Sources:** ChatGPT Audit (3.3)
**Location:** `frontend/src/services/api.ts`, `frontend/src/stores/authStore.ts`

**Solution:**
Unify error/refresh retry logic in one client module.

**Effort:** 4-6 hours

---

### P2-ARCH-003: Inconsistent Transaction Management
**Sources:** Claude Code Audit (P2-002)
**Location:** Multiple routers

**Problem:**
Mixed patterns: some use `flush()` then `commit()`, others direct `commit()`.

**Solution:**
Standardize: `db.add()` -> `db.flush()` -> `db.commit()` -> `db.refresh()`.

**Effort:** 2 hours

---

### P2-ARCH-004: Mixed Error Response Formats
**Sources:** Claude Code Audit (P2-003)
**Location:** All routers

**Problem:**
HTTPException returns `{"detail": ...}`, AppException returns `{"error": ..., "message": ...}`.

**Solution:**
Standardize all errors through AppException.

**Effort:** 2 hours

---

### P2-ARCH-005: DB Timestamps Stored as Text
**Sources:** ChatGPT Audit (2.7)
**Location:** `backend/app/models/*.py`

**Solution:**
Convert to `DateTime(timezone=True)` with Alembic migration.

**Effort:** 6-10 hours

---

### P2-ARCH-006: Docs Pages Are Massive TSX Files
**Sources:** ChatGPT Audit (3.12)
**Location:** Documentation components

**Solution:**
Move content to MD/MDX or structured JSON.

**Effort:** 4-6 hours (deferred)

---

### P2-SEC-001: OAuth State Not Bound to Session
**Sources:** Claude Web Browser Audit (M-001)
**Location:** `backend/app/routers/auth.py:49-86`

**Solution:**
Bind state to client IP and user agent.

**Effort:** 2 hours

---

### P2-SEC-002: Timing Attack on User Enumeration
**Sources:** Claude Web Browser Audit (M-002)
**Location:** `backend/app/dependencies.py:58-73`

**Problem:**
Different error messages for "invalid token" vs "user not found".

**Solution:**
Use generic "Authentication failed" for both.

**Effort:** 30 minutes

---

### P2-SEC-003: Information Leakage in BiS Router
**Sources:** Claude Code Audit (P2-005)
**Location:** `backend/app/routers/bis.py:339`

**Solution:**
Log exception internally, return generic message.

**Effort:** 30 minutes

---

### P2-SEC-004: Missing BiS Input Validation
**Sources:** Claude Web Browser Audit (M-005)
**Location:** `backend/app/routers/bis.py:111-148`

**Solution:**
Validate job/tier against whitelists.

**Effort:** 1 hour

---

### P2-API-001: No Explicit API Versioning
**Sources:** ChatGPT Audit (3.5)
**Solution:**
Use `/api/v1/...` prefix.

**Effort:** 2-4 hours (deferred)

---

### P2-API-002: Inconsistent DELETE Status Codes
**Sources:** Claude Code Audit (P2-008)
**Solution:**
Standardize on `status.HTTP_204_NO_CONTENT`.

**Effort:** 30 minutes

---

## 4. Low Severity Issues (P3)

| ID | Issue | Location | Effort |
|----|-------|----------|--------|
| P3-001 | Vite target too aggressive (esnext) | vite.config.ts | 30 min |
| P3-002 | ManualChunks could split docs further | vite.config.ts | 1 hour |
| P3-003 | Missing TrustedHostMiddleware | main.py | 1 hour |
| P3-004 | Health endpoint doesn't check DB/cache | main.py | 1 hour |
| P3-005 | Magic strings need centralization | Various | 2 hours |
| P3-006 | @dnd-kit/sortable outdated (8.0.0 -> 10.0.0) | package.json | 2 hours |
| P3-007 | Missing field validation for floor/slot enums | schemas | 1 hour |
| P3-008 | Missing error responses in OpenAPI docs | All routers | 2 hours |
| P3-009 | Logging uses print in config fallback | config.py | 30 min |
| P3-010 | ESLint warnings (10 remaining) | Various | 2 hours |
| P3-011 | DB migration testing missing | tests/ | 2 hours |
| P3-012 | No bundle visualization tooling | vite.config.ts | 1 hour |

---

## 5. Issues Verified as Fixed

| Item | Location | Status |
|------|----------|--------|
| Session Auto-Commit | database.py | No auto-commit, explicit commits |
| Granular Loading States | lootTrackingStore.ts | LoadingStates interface implemented |
| Modal Focus Trap | Modal.tsx | Tab wrapping + focus restoration |
| Toast ARIA | Toast.tsx | aria-live="polite", role="alert" |
| Hardcoded Colors | WeeklyLootGrid.tsx | Uses design tokens |
| Icon Button Labels | Dashboard.tsx | All buttons have aria-labels |
| Double-Click Confirm | useDoubleClickConfirm.ts | Hook with isLoading, timeout |
| Race Condition Handling | permissions.py | IntegrityError handling |

---

## 6. Session Breakdown

### Session 1: Critical Security - Auth Hardening (3-4 hours)
**Focus:** P0-SEC-001, P0-SEC-002, P0-SEC-003

See: [SESSION_01_CRITICAL_AUTH.md](./SESSION_01_CRITICAL_AUTH.md)

### Session 2: Critical Security - Admin Performance (3 hours)
**Focus:** P0-PERF-001

See: [SESSION_02_ADMIN_PERF.md](./SESSION_02_ADMIN_PERF.md)

### Session 3: High Priority Security - Dependencies (2-3 hours)
**Focus:** P1-SEC-001, P1-SEC-003, P1-SEC-004, P1-DEVOPS-001

See: [SESSION_03_DEPS_SECURITY.md](./SESSION_03_DEPS_SECURITY.md)

### Session 4: High Priority Security - Headers + SSRF (2-3 hours)
**Focus:** P1-SEC-002, P1-SEC-003

See: [SESSION_04_HEADERS_SSRF.md](./SESSION_04_HEADERS_SSRF.md)

### Session 5: Frontend Accessibility - Radix Fixes (4-6 hours)
**Focus:** P1-SEC-005, P1-SEC-006

See: [SESSION_05_RADIX_A11Y.md](./SESSION_05_RADIX_A11Y.md)

### Session 6: Frontend Architecture - React Fixes (2-3 hours)
**Focus:** P1-ARCH-001, P1-ARCH-002

See: [SESSION_06_REACT_FIXES.md](./SESSION_06_REACT_FIXES.md)

### Session 7: Backend Performance - Pagination + Indexes (3-4 hours)
**Focus:** P1-PERF-001, P1-PERF-002

See: [SESSION_07_BACKEND_PERF.md](./SESSION_07_BACKEND_PERF.md)

### Session 8: DevOps - CI + Lockfiles (2 hours)
**Focus:** P1-DEVOPS-001, P1-DEVOPS-002

See: [SESSION_08_DEVOPS.md](./SESSION_08_DEVOPS.md)

### Session 9: Performance Optimization - Zustand + Hooks (4-6 hours)
**Focus:** P2-PERF-001, P2-ARCH-001

See: [SESSION_09_ZUSTAND_PERF.md](./SESSION_09_ZUSTAND_PERF.md)

### Session 10: Backend Consistency - Transactions + Errors (4-5 hours)
**Focus:** P2-ARCH-003, P2-ARCH-004, P2-SEC-002, P2-SEC-003

See: [SESSION_10_BACKEND_CONSISTENCY.md](./SESSION_10_BACKEND_CONSISTENCY.md)

### Session 11: Backend Polish - Pool + Query Optimization (3 hours)
**Focus:** P2-PERF-003, P2-PERF-004, P2-PERF-006, P2-PERF-007

See: [SESSION_11_BACKEND_POLISH.md](./SESSION_11_BACKEND_POLISH.md)

### Session 12: Security Hardening - OAuth + Validation (3-4 hours)
**Focus:** P2-SEC-001, P2-SEC-004, P2-API-002

See: [SESSION_12_SECURITY_HARDENING.md](./SESSION_12_SECURITY_HARDENING.md)

---

## 7. Verification Checklist

### After Phase 1 (Sessions 1-2)
```bash
# Backend tests
cd backend && pytest tests/ -q

# Verify OAuth flow still works
# Test: Login via Discord, refresh works

# Verify admin dashboard loads quickly
# Target: < 2 seconds for 50 groups
```

### After Phase 2 (Sessions 3-8)
```bash
# Security scan
cd frontend && pnpm audit

# Full build
cd frontend && pnpm test && pnpm build

# Headers check (production)
curl -I https://yoursite.com | grep -E "(Content-Security-Policy|Strict-Transport)"

# CI should now run backend tests
```

### After Phase 3-4 (Sessions 9-12)
```bash
# Full test suites
cd frontend && pnpm test && pnpm lint && pnpm tsc --noEmit
cd backend && pytest tests/ -q && ruff check .

# Performance verification
# React DevTools Profiler: GroupView re-renders reduced
# API: /loot-log returns paginated results
```

---

## 8. File Reference Matrix

### Backend Files (by priority)

| File | Issues | Priority |
|------|--------|----------|
| `app/routers/auth.py` | P0-SEC-001, P2-SEC-001 | Critical |
| `app/cache.py` | P0-SEC-002 | Critical |
| `app/rate_limit.py` | P0-SEC-003 | Critical |
| `app/routers/static_groups.py` | P0-PERF-001 | Critical |
| `app/middleware/security.py` | P1-SEC-002 | High |
| `app/routers/bis.py` | P1-SEC-003, P2-SEC-003, P2-SEC-004 | High |
| `app/routers/loot_tracking.py` | P1-PERF-001, P2-PERF-003, P2-PERF-006 | High |
| `app/models/*.py` | P1-PERF-002 | High |
| `app/database.py` | P2-PERF-004 | Medium |
| `app/dependencies.py` | P2-SEC-002 | Medium |
| `app/config.py` | P0-SEC-003 | Critical |

### Frontend Files (by priority)

| File | Issues | Priority |
|------|--------|----------|
| `package.json` | P1-SEC-001, P1-DEVOPS-001 | High |
| `src/index.css` | P1-SEC-005 | High |
| `src/components/ui/Select.tsx` | P1-SEC-006 | High |
| `src/components/auth/ProtectedRoute.tsx` | P1-ARCH-001 | High |
| `src/stores/authStore.ts` | P1-ARCH-002 | High |
| `src/pages/GroupView.tsx` | P2-PERF-001 | Medium |
| `src/hooks/useGroupViewState.ts` | P2-ARCH-001 | Medium |

### CI/DevOps Files

| File | Issues | Priority |
|------|--------|----------|
| `.github/workflows/ci.yml` | P1-DEVOPS-002 | High |
| `frontend/package-lock.json` | P1-DEVOPS-001 (delete) | High |

---

## Appendix A: OWASP Top 10 Coverage

| # | Category | Status | Issues |
|---|----------|--------|--------|
| A01 | Broken Access Control | Secure | Permission system solid |
| A02 | Cryptographic Failures | Fixed | P0-SEC-001 addresses tokens |
| A03 | Injection | Secure | SQLAlchemy parameterization |
| A04 | Insecure Design | Secure | Good separation of concerns |
| A05 | Security Misconfiguration | Partial | P1-SEC-002 adds CSP |
| A06 | Vulnerable Components | Action | P1-SEC-001, P1-SEC-004 |
| A07 | Auth Failures | Action | P0-SEC-002, P2-SEC-001 |
| A08 | Data Integrity | Secure | JWT signatures, validation |
| A09 | Logging Failures | Partial | P2-PERF-007 adds request IDs |
| A10 | SSRF | Action | P1-SEC-003 |

---

## Appendix B: Dependency Audit Summary

### Frontend
```
react-router-dom: 7.11.0 -> 7.12.0 (CVE fix)
zustand: 5.0.9 -> 5.0.10 (patch)
vite: 7.2.4 -> 7.3.1 (patch)
@dnd-kit/sortable: 8.0.0 -> 10.0.0 (major - test carefully)
```

### Backend
```
ecdsa: 0.19.1 (CVE-2024-23342 - transitive via python-jose)
Recommendation: Migrate to PyJWT
```

---

**Report Complete**

*Consolidated from 3 independent audits*
*Total unique issues: 47*
*Estimated remediation: 44-55 hours across 12 sessions*
