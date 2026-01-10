# FFXIV Raid Planner - Three-Issue Fix Plan

## Overview

This plan addresses three user-reported issues:
1. Session persistence problems on production
2. Universal Tomestone feature incomplete
3. Weapon priority incorrectly including role for non-BiS weapons

---

## Issue 1: Session Persistence (Production Re-login)

### Understanding
Users on the live site (https://www.xivraidplanner.app/) must re-login constantly, but it works fine locally.

### Root Causes Identified

**Primary Cause: Missing VITE_API_URL at Build Time**
- Frontend reads `VITE_API_URL` at compile time, not runtime
- If not set during Railway build, defaults to `http://localhost:8000`
- All API calls (including token refresh) fail silently, logging user out

**Secondary Causes:**
1. No `.env.production` file for frontend build configuration
2. `CORS_ORIGINS_PRODUCTION` likely not set on Railway backend
3. No proactive token refresh - access tokens expire in 15 min
4. If user returns after 15+ minutes, token is expired, app tries fetch → 401 → logout

### Files Affected
- `frontend/src/stores/authStore.ts` - Token refresh logic
- `frontend/src/services/api.ts` - API base URL
- `backend/app/config.py` - CORS and token configuration
- Missing: `frontend/.env.production`

### Proposed Fix

**Step 1: Verify Railway Environment Variables**
- Check if `VITE_API_URL` is set in Railway frontend build
- Check if `CORS_ORIGINS_PRODUCTION` is set to `https://www.xivraidplanner.app`
- Check if `JWT_SECRET_KEY` is explicitly set (not auto-generated)

**Step 2: Create frontend/.env.production (if not using Railway env vars)**
```env
VITE_API_URL=https://api.xivraidplanner.app  # or whatever your API domain is
```

**Step 3: Add proactive token refresh in authStore.ts**
- On `initializeAuth()`, check if access token is expired
- If expired but refresh token valid, call `refreshAccessToken()` before `fetchUser()`
- Add JWT decode to check expiration time

**Step 4: Extend token expiration (optional)**
- Consider increasing access token from 15 min to 1 hour
- Consider increasing refresh token from 7 days to 30 days

---

## Issue 2: Universal Tomestone Feature

### Understanding
Universal Tomestone appears in UI (Loot tab > Gear Priority > Floor 2 > Special Materials) but is not functional.

### Current State
- **Defined:** `frontend/src/gamedata/loot-tables.ts:43` as `specialMaterials: ['Universal Tomestone']`
- **Displayed:** `LootPriorityPanel.tsx:444-459` as read-only badge
- **Documented:** In `GEARING_REFERENCE.md` as weapon upgrade material
- **NOT IMPLEMENTED:** No tracking, logging, priority, or balance display

### FFXIV Game Context
- Drops from M10S (Floor 2)
- Used to upgrade tome weapons from iLv 780 to 790
- Critical for progression - provides weapon upgrade before savage weapon drop
- One per raid group per week

### What's Missing for Full Implementation

**Backend:**
1. Extend `MaterialType` enum to include `universal_tomestone`
2. Or create separate `special_material_log` table
3. Add API endpoints: GET/POST/DELETE for logging
4. Add balance calculation endpoint

**Frontend:**
1. Extend `MaterialType` type
2. Add quick-log modal for Universal Tomestone
3. Add balance display in History view
4. Add priority calculation (who needs it for tome weapon upgrade?)

**Priority Calculation Considerations:**
- Who still needs their tome weapon upgraded?
- Track via `tomeWeapon.isAugmented` field
- Players without augmented tome weapon get priority

### Proposed Implementation Options

**Option A: Full Material Tracking (Recommended)**
- Add as a first-class material type alongside twine/glaze/solvent
- Full logging, balance tracking, priority calculation
- ~4-6 hours of work

**Option B: Minimal Tracking**
- Just add logging capability, no priority calculation
- Track who received it each week
- ~2-3 hours of work

**Option C: Manual Only**
- Leave as informational badge
- Raid leads track manually outside app
- No code changes

---

## Issue 3: Weapon Priority Role Logic

### Understanding
Role priority affects ALL weapons, but should only affect main BiS weapons. Extra/off-job weapons should use pure weapon list ordering.

### Current Behavior
```typescript
// weaponPriority.ts:62-64 - APPLIES TO ALL WEAPONS
const roleIndex = settings.lootPriority.indexOf(player.role);
const roleScore = roleIndex === -1 ? 0 : (5 - roleIndex) * 100;
```

**Example Problem:**
- Tank player has SAM weapon at priority #1
- Melee player has SAM weapon at priority #3
- Melee player wins because role > rank, even though Tank specifically wants it more

### Correct Behavior
- **Main BiS weapon:** Role + Rank + MainJobBonus (current, correct)
- **Extra weapons:** Rank ONLY (pure weapon list ordering)
- Already obtained weapons: Correctly filtered out

### Files to Modify
- `frontend/src/utils/weaponPriority.ts` - Line 62-64

### Proposed Fix

```typescript
// BEFORE (current):
const roleScore = roleIndex === -1 ? 0 : (5 - roleIndex) * 100;

// AFTER (fixed):
// Only apply role score to main job weapons
// For extra/off-job weapons, priority is purely based on weapon list order
const roleScore = isMainJob
  ? (roleIndex === -1 ? 0 : (5 - roleIndex) * 100)
  : 0;
```

### Edge Cases

**Tie-breaking for extra weapons:**
When two players have the same rank for an extra weapon:
1. Player who explicitly added it first? (by list position)
2. Alphabetical by name?
3. Keep role as tie-breaker only?

**Current tiebreaker:** Score is identical → sorted by entry order in result array

---

## Verification Plan

### Issue 1: Auth
1. Check Railway environment variables via Railway dashboard
2. If missing, add `VITE_API_URL` and `CORS_ORIGINS_PRODUCTION`
3. Redeploy and test login persistence over 20+ minutes
4. Test in incognito/private browsing mode

### Issue 2: Universal Tomestone
1. Implement chosen option
2. Test logging a Universal Tomestone drop
3. Verify balance display shows correct counts
4. Test priority calculation (if implemented)

### Issue 3: Weapon Priority
1. Add unit test for the specific scenario
2. Modify roleScore calculation
3. Run `pnpm test` to verify no regressions
4. Manual UI test: verify melee player doesn't outrank tank for off-job weapon

---

## Implementation Decisions

1. **Issue 1:** Both - verify Railway env vars AND add detection logic for safety
2. **Issue 2:** Full tracking with priority calculation
3. **Issue 3:** Show tied players together with a "Roll" feature for random tie-breaking

---

## Detailed Implementation Plan

### Issue 1: Auth/Session Persistence

**Files to modify:**
- `frontend/src/stores/authStore.ts`
- `frontend/src/services/api.ts`
- `backend/app/config.py` (verify settings)

**Implementation steps:**
1. Add detection logic in `authStore.ts` to warn if API URL looks like localhost in production
2. Add proactive token refresh in `initializeAuth()`:
   - Decode JWT to check expiration time
   - If access token expired but refresh token valid, refresh first
3. Add a refresh check before every API call (or use axios interceptors)
4. Consider extending token expiration (15min → 1hr for access token)

**User action required:**
- Verify Railway has `VITE_API_URL` set to production API domain
- Verify Railway has `CORS_ORIGINS_PRODUCTION=https://www.xivraidplanner.app`

---

### Issue 2: Universal Tomestone (Full Implementation)

**Backend changes:**

1. **Extend MaterialType enum** in `backend/app/models/material_log_entry.py`:
   ```python
   material_type: Mapped[str] = mapped_column(
       SQLEnum("twine", "glaze", "solvent", "universal_tomestone", ...)
   )
   ```

2. **Add database migration** to add new enum value

3. **Update schemas** in `backend/app/schemas/loot_tracking.py`

**Frontend changes:**

1. **Extend types** in `frontend/src/types/index.ts`:
   ```typescript
   export type MaterialType = 'twine' | 'glaze' | 'solvent' | 'universal_tomestone';
   ```

2. **Update loot-tables.ts** to mark Universal Tomestone as trackable (not just informational)

3. **Add quick-log modal** for Universal Tomestone in `LootPriorityPanel.tsx`

4. **Add priority calculation** based on `tomeWeapon.isAugmented`:
   - Players WITHOUT augmented tome weapon get priority
   - Use similar scoring to material priority

5. **Add balance display** in History view showing who has received how many

**Priority logic:**
- Check each player's `tomeWeapon.isAugmented` status
- Players needing tome weapon upgrade (not augmented) get higher priority
- Secondary sort by role priority (from settings)

---

### Issue 3: Weapon Priority (Role Fix + Roll Feature)

**Files to modify:**
- `frontend/src/utils/weaponPriority.ts`
- `frontend/src/components/weapon-priority/WeaponPriorityList.tsx`

**Step 1: Fix role score calculation**

In `weaponPriority.ts`, change line 62-64:

```typescript
// BEFORE:
const roleScore = roleIndex === -1 ? 0 : (5 - roleIndex) * 100;

// AFTER:
// Only apply role to main job weapons; extra weapons use pure list ordering
const roleScore = isMainJob
  ? (roleIndex === -1 ? 0 : (5 - roleIndex) * 100)
  : 0;
```

**Step 2: Add tie detection to return data**

Modify `getWeaponPriorityForJob()` to return tie information:
```typescript
interface WeaponPriorityEntry {
  player: SnapshotPlayer;
  score: number;
  isMainJob: boolean;
  rank: number;
  isTied: boolean;  // NEW: marks if this player is tied with adjacent entries
  tieGroup?: number; // NEW: groups tied players together
}
```

**Step 3: Add Roll UI component**

Create `RollButton.tsx` or add to `WeaponPriorityList.tsx`:
- "Roll" button appears when hovering over tied players group
- Click generates random 1-100 for each tied player
- Display: "PlayerA: 73, PlayerB: 45" with winner highlighted
- Rolls are ephemeral (not persisted) - just for decision-making

**Step 4: Update WeaponPriorityList display**

- Detect tied scores when rendering
- Group tied players visually (shared background, bracket, or same line)
- Show roll button for the tie group
- Both players have individual log buttons

---

## Verification Plan

### Issue 1: Auth
1. Check Railway dashboard for env vars
2. Deploy changes
3. Log in, wait 20+ minutes, verify still logged in
4. Test in incognito mode
5. Check console for any localhost API call warnings

### Issue 2: Universal Tomestone
1. Run database migration
2. Test logging via quick-log modal
3. Verify balance shows in History view
4. Verify priority calculation puts non-augmented tome weapon players first

### Issue 3: Weapon Priority
1. Add unit test for off-job weapon scenario
2. Run `pnpm test`
3. UI test: Tank at rank #1 should beat Melee at rank #3 for off-job weapon
4. Test roll feature for tied players

---

## Critical Files Summary

| Issue | Files |
|-------|-------|
| Auth | `authStore.ts`, `api.ts`, `config.py` |
| Tomestone | `material_log_entry.py`, `loot_tracking.py` (schemas), `types/index.ts`, `LootPriorityPanel.tsx` |
| Weapon Priority | `weaponPriority.ts`, `WeaponPriorityList.tsx` |
