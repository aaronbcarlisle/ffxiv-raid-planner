# Audit Session Quick Reference

**Total Sessions:** 12
**Total Estimated Hours:** 44-55

---

## Phase 1: Critical Security (Week 1)

| Session | Focus | Hours | Priority |
|---------|-------|-------|----------|
| [Session 1](./SESSION_01_CRITICAL_AUTH.md) | Auth Hardening (JWT, Cache TTL, Proxy Trust) | 3-4 | P0 |
| [Session 2](./SESSION_02_ADMIN_PERF.md) | Admin Dashboard N+1 Query | 3 | P0 |

**P0 Issues Addressed:** 4

---

## Phase 2: High Priority Security (Week 2)

| Session | Focus | Hours | Priority |
|---------|-------|-------|----------|
| [Session 3](./SESSION_03_DEPS_SECURITY.md) | Dependency Updates (react-router CVEs) | 2-3 | P1 |
| [Session 4](./SESSION_04_HEADERS_SSRF.md) | CSP Header + SSRF Fix | 2-3 | P1 |
| [Session 5](./SESSION_05_RADIX_A11Y.md) | Radix Accessibility Fixes | 4-6 | P1 |
| [Session 6](./SESSION_06_REACT_FIXES.md) | React Architecture (ProtectedRoute, Auth Init) | 2-3 | P1 |

**P1 Issues Addressed:** 10

---

## Phase 3: High Priority Performance (Week 3)

| Session | Focus | Hours | Priority |
|---------|-------|-------|----------|
| [Session 7](./SESSION_07_BACKEND_PERF.md) | Pagination + FK Indexes | 3-4 | P1 |
| [Session 8](./SESSION_08_DEVOPS.md) | CI Backend Tests | 2 | P1 |

**P1 Issues Addressed:** 4

---

## Phase 4: Medium Priority (Weeks 4-5)

| Session | Focus | Hours | Priority |
|---------|-------|-------|----------|
| [Session 9](./SESSION_09_ZUSTAND_PERF.md) | Zustand Selectors + Hook Splitting | 4-6 | P2 |
| [Session 10](./SESSION_10_BACKEND_CONSISTENCY.md) | Transaction + Error Consistency | 4-5 | P2 |
| [Session 11](./SESSION_11_BACKEND_POLISH.md) | Connection Pool + Query Optimization | 3 | P2 |
| [Session 12](./SESSION_12_SECURITY_HARDENING.md) | OAuth Binding + Input Validation | 3-4 | P2 |

**P2 Issues Addressed:** 12

---

## Issue to Session Mapping

### Critical (P0)
| Issue ID | Description | Session |
|----------|-------------|---------|
| P0-SEC-001 | JWT tokens in response body | 1 |
| P0-SEC-002 | OAuth state cache TTL | 1 |
| P0-SEC-003 | Rate-limit IP spoofing | 1 |
| P0-PERF-001 | Admin dashboard N+1 | 2 |

### High (P1)
| Issue ID | Description | Session |
|----------|-------------|---------|
| P1-SEC-001 | React Router CVEs | 3 |
| P1-SEC-002 | Missing CSP header | 4 |
| P1-SEC-003 | SSRF in BiS import | 4 |
| P1-SEC-004 | ecdsa CVE | 3 |
| P1-SEC-005 | Aria-hidden CSS hack | 5 |
| P1-SEC-006 | Select MutationObserver | 5 |
| P1-ARCH-001 | ProtectedRoute navigate | 6 |
| P1-ARCH-002 | Auth init validation | 6 |
| P1-PERF-001 | Loot log pagination | 7 |
| P1-PERF-002 | FK indexes | 7 |
| P1-DEVOPS-001 | Dual lockfiles | 3 |
| P1-DEVOPS-002 | Backend CI | 8 |

### Medium (P2)
| Issue ID | Description | Session |
|----------|-------------|---------|
| P2-PERF-001 | Zustand selectors | 9 |
| P2-PERF-003 | Double refresh calls | 11 |
| P2-PERF-004 | Connection pool | 11 |
| P2-PERF-006 | Week data query | 11 |
| P2-PERF-007 | Request ID tracking | 11 |
| P2-ARCH-001 | useGroupViewState split | 9 |
| P2-ARCH-003 | Transaction patterns | 10 |
| P2-ARCH-004 | Error response format | 10 |
| P2-SEC-001 | OAuth state binding | 12 |
| P2-SEC-002 | Timing attack | 10 |
| P2-SEC-003 | Info leakage BiS | 10 |
| P2-SEC-004 | BiS input validation | 12 |
| P2-API-002 | DELETE status codes | 12 |

---

## Execution Order

```
Week 1: Sessions 1-2 (Critical)
Week 2: Sessions 3-6 (High Security)
Week 3: Sessions 7-8 (High Performance + DevOps)
Week 4: Sessions 9-10 (Medium)
Week 5: Sessions 11-12 (Medium)
```

---

## Quick Start Commands

### Before Starting Any Session
```bash
# Backend
cd backend
source venv/bin/activate
pytest tests/ -q

# Frontend
cd frontend
pnpm test
pnpm lint
```

### After Completing Each Session
```bash
# Backend sessions
pytest tests/ -q

# Frontend sessions
pnpm test && pnpm build && pnpm lint
```

---

## Files Most Frequently Modified

| File | Sessions |
|------|----------|
| `backend/app/routers/auth.py` | 1, 12 |
| `backend/app/routers/bis.py` | 4, 10, 12 |
| `backend/app/routers/loot_tracking.py` | 7, 10, 11 |
| `frontend/src/pages/GroupView.tsx` | 9 |
| `frontend/src/components/ui/Select.tsx` | 5 |
| `.github/workflows/ci.yml` | 8 |
