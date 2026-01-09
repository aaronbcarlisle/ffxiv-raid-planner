# Remaining Issues Implementation Plan

**Created:** January 9, 2026
**Branch:** fix/remaining-issues
**Source:** docs/CONSOLIDATED_STATUS.md

---

## Phase 1: Critical Security (P0)

| Issue | Impact | Effort |
|-------|--------|--------|
| **Rate Limiting** | DoS vulnerability | Medium |
| **Security Headers** | Missing CSP, X-Frame-Options | Low |

### Rate Limiting
- Add `slowapi` to backend dependencies
- Create rate limiter middleware in `backend/app/middleware/rate_limit.py`
- Apply limits: 100/min for general endpoints, 10/min for auth

### Security Headers
- Add middleware for CSP, X-Frame-Options, X-Content-Type-Options
- Configure CORS more strictly for production

---

## Phase 2: Stability (P1)

| Issue | Impact | Effort |
|-------|--------|--------|
| **Error Boundaries** | App crashes on errors | Medium |
| **Toast Integration** | Poor error feedback | Low |
| **Button Standardization** | Inconsistent UX | Medium |

### Error Boundaries
- Create `components/ErrorBoundary.tsx` with fallback UI
- Wrap routes in `App.tsx` and major components
- Add "Report Issue" link in fallback

### Toast Integration
- Toast.tsx exists but isn't wired up
- Connect to errorHandler.ts for automatic error toasts
- Add success toasts for key actions (save, delete, etc.)

---

## Phase 3: Accessibility (P1)

| Issue | Impact | Effort |
|-------|--------|--------|
| **ARIA Labels** | Screen reader issues | Medium |
| **Keyboard Navigation** | Usability | Medium |

### Key files needing ARIA
- Dropdowns/selects in player cards
- Modal dialogs (BiSImportModal, QuickLogDropModal)
- Tab navigation components
- Context menus

---

## Phase 4: Code Quality (P2)

| Issue | Impact | Effort |
|-------|--------|--------|
| **Duplicate DEFAULT_SETTINGS** | Maintenance burden | Low |
| **PlayerCard complexity** | 682 lines, hard to maintain | High |
| **Raw Tailwind values** | Design drift | Medium |

### DEFAULT_SETTINGS consolidation
- Create `constants/settings.ts` with shared default
- Update GroupView.tsx, HistoryView.tsx, useLootActions.ts

### PlayerCard split
- Extract `PlayerCardHeader.tsx` (name, job, iLv)
- Extract `PlayerCardGear.tsx` (gear table)
- Extract `PlayerCardActions.tsx` (context menu, buttons)

---

## Recommended Priority Order

1. **Rate Limiting + Security Headers** - Security critical
2. **Error Boundaries + Toast Integration** - User experience
3. **DEFAULT_SETTINGS consolidation** - Quick win, reduces bugs
4. **ARIA Labels** - Accessibility compliance
5. **PlayerCard refactor** - Maintainability

---

## Status

- [ ] Phase 1: Critical Security
- [ ] Phase 2: Stability
- [ ] Phase 3: Accessibility
- [ ] Phase 4: Code Quality
