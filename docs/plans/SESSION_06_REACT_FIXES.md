# Session 6: Frontend Architecture - React Fixes

**Duration:** 2-3 hours
**Issues:** P1-ARCH-001, P1-ARCH-002
**Priority:** HIGH

---

## Pre-Session Checklist

- [ ] Frontend dependencies installed
- [ ] All tests passing (`pnpm test`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to fix two React architecture issues. Work through each issue, creating commits after each fix.

## Issue 1: ProtectedRoute Navigates During Render (P1-ARCH-001)

**Location:** `frontend/src/components/auth/ProtectedRoute.tsx`

**Current problem (around line 65-69):**
```typescript
if (!showLoginPrompt) {
  navigate('/');  // Side effect during render!
  return null;
}
```

**Problem:** Calling `navigate()` during render is a React anti-pattern. It can cause:
- Warning in React 18+
- Unpredictable behavior
- Potential infinite loops

**Solution:** Use the `<Navigate>` component instead:

```typescript
import { Navigate } from 'react-router-dom';

// Replace the imperative navigate with declarative Navigate
if (!isAuthenticated && !showLoginPrompt) {
  return <Navigate to="/" replace />;
}
```

**Testing:**
1. Run tests: `pnpm test`
2. Manual test: Visit a protected route while logged out
   - Should redirect to home page
   - No console warnings about side effects during render

Commit: "fix(auth): replace imperative navigate with Navigate component"

---

## Issue 2: initializeAuth Doesn't Always Validate Session (P1-ARCH-002)

**Location:** `frontend/src/stores/authStore.ts`

**Current problem (around line 317-321):**
```typescript
export async function initializeAuth(): Promise<void> {
  const { user } = useAuthStore.getState();
  if (user) {
    const { fetchUser } = useAuthStore.getState();
    await fetchUser();
  }
}
```

**Problem:** Only validates session if `user` object already exists in state. This misses:
- Fresh browser sessions with valid httpOnly cookies
- Sessions where localStorage was cleared but cookies remain

**Solution:** Always call `fetchUser()` regardless of persisted state:

```typescript
export async function initializeAuth(): Promise<void> {
  const { fetchUser } = useAuthStore.getState();
  await fetchUser();
}
```

**Rationale:**
- `fetchUser()` makes a request to `/api/auth/me`
- Backend validates the httpOnly cookie
- If valid, returns user data and updates state
- If invalid, returns 401 and clears state
- This is the source of truth, not localStorage

**Testing:**
1. Run tests: `pnpm test`
2. Manual test scenarios:
   a. Clear localStorage, keep cookies:
      - Reload page
      - Should still be logged in (cookie validated)
   b. Clear both localStorage and cookies:
      - Reload page
      - Should be logged out
   c. Normal login flow:
      - Should work as before

Commit: "fix(auth): always validate cookie session on init"

---

## After Both Fixes

```bash
pnpm test
pnpm lint
pnpm tsc --noEmit
pnpm build
```

Test auth flows manually:
1. Login via Discord
2. Refresh page (should stay logged in)
3. Visit protected route while logged out (should redirect)
4. Clear localStorage, refresh (should stay logged in if cookie valid)
```

---

## Expected Outcomes

### Files Modified
- `frontend/src/components/auth/ProtectedRoute.tsx`
- `frontend/src/stores/authStore.ts`

### Tests to Run
```bash
pnpm test
pnpm lint
pnpm tsc --noEmit
```

### Manual Testing

#### ProtectedRoute Fix
1. Log out
2. Try to access `/group/abc123`
3. Verify redirect to `/` with no console errors

#### Auth Init Fix
1. Log in normally
2. Open DevTools > Application > Local Storage
3. Delete all ffxiv-raid-planner keys
4. Refresh page
5. Should still be logged in (cookie still valid)

---

## Rollback Plan

```bash
git checkout frontend/src/components/auth/ProtectedRoute.tsx frontend/src/stores/authStore.ts
```

---

## Commit Messages

```
fix(auth): replace imperative navigate with Navigate component

Using navigate() during render is a React anti-pattern that can cause
warnings and unpredictable behavior. Replace with declarative <Navigate>
component for proper redirect handling.

Addresses: P1-ARCH-001
```

```
fix(auth): always validate cookie session on init

Previously initializeAuth() only called fetchUser() if a user object
existed in persisted state. This missed cases where:
- localStorage was cleared but httpOnly cookies remained
- Fresh browser session with valid cookies

Now always validates session via /api/auth/me, which is the source
of truth for authentication state.

Addresses: P1-ARCH-002
```
