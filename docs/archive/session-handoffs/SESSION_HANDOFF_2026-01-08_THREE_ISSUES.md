# Session Handoff - Three Issue Fixes

**Date:** 2026-01-08
**Branch:** `feature/three-issue-fixes`
**PR:** https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/pull/8
**Status:** PR Created, Ready for Review/Merge

---

## What Was Done

### Issue 1: Auth/Session Persistence
**Problem:** Users on production (https://www.xivraidplanner.app/) constantly had to re-login, but it worked fine locally.

**Root Causes Identified:**
1. `VITE_API_URL` not set at build time → defaults to localhost
2. No proactive token refresh → 15-min access token expires, user gets logged out

**Solution Implemented:**
- Added production misconfiguration detection (warns in console if API URL is localhost in production)
- Added JWT decoding to check token expiration
- Proactive token refresh in `initializeAuth()` before fetching user data

**Files Changed:**
- `frontend/src/stores/authStore.ts`

**User Action Required:**
- Verify Railway env vars: `VITE_API_URL`, `CORS_ORIGINS_PRODUCTION`

---

### Issue 2: Universal Tomestone
**Problem:** Universal Tomestone appeared in UI but was not functional - no tracking, logging, or priority.

**Solution Implemented:**
- Extended `MaterialType` enum to include `universal_tomestone` (backend + frontend)
- Created PostgreSQL migration: `c3d4e5f6g7h8_add_universal_tomestone_material.py`
- Added `getPriorityForUniversalTomestone()` function based on tome weapon upgrade status
- Moved from `specialMaterials` (informational) to `upgradeMaterials` (trackable)
- Updated `QuickLogMaterialModal` to use correct priority function
- Added `UPGRADE_MATERIAL_DISPLAY_NAMES` for proper labeling

**Files Changed:**
- `backend/app/models/material_log_entry.py`
- `backend/app/schemas/loot_tracking.py`
- `backend/app/routers/loot_tracking.py`
- `backend/alembic/versions/c3d4e5f6g7h8_add_universal_tomestone_material.py`
- `frontend/src/types/index.ts`
- `frontend/src/gamedata/loot-tables.ts`
- `frontend/src/utils/priority.ts`
- `frontend/src/components/loot/LootPriorityPanel.tsx`
- `frontend/src/components/loot/QuickLogMaterialModal.tsx`

---

### Issue 3: Weapon Priority Role Logic
**Problem:** Role priority was applied to ALL weapons, but should only apply to main BiS weapons. Off-job weapons should use pure weapon list ordering.

**Solution Implemented:**
- Fixed `roleScore` calculation to only apply when `isMainJob === true`
- Added tie detection: `isTied` and `tieGroup` fields to `WeaponPriorityEntry`
- Added Roll UI for tied players:
  - Grouped visual display with dashed yellow border
  - "Roll" button generates random 1-100 for each tied player
  - Winner highlighted in green
  - Both players have Log buttons

**Files Changed:**
- `frontend/src/utils/weaponPriority.ts`
- `frontend/src/components/loot/WeaponPriorityList.tsx`

---

## Tests
- TypeScript: ✅ Passes (`pnpm tsc --noEmit`)
- Unit Tests: ✅ All 25 tests pass (`pnpm test`)

---

## What's Next

### Immediate
1. Review and merge PR #8
2. After merge, verify Railway env vars are set correctly
3. Deploy and test auth persistence on production

### Future Enhancements
- Add Universal Tomestone column to TeamSummaryEnhanced (currently only T/G/S shown)
- Consider extending token expiration times (currently 15min access, 7 day refresh)
- Add unit tests for Universal Tomestone priority calculation

---

## Key Code Locations

| Feature | File | Key Function/Component |
|---------|------|------------------------|
| Auth token refresh | `stores/authStore.ts` | `initializeAuth()`, `isTokenExpired()` |
| Univ. Tomestone priority | `utils/priority.ts` | `getPriorityForUniversalTomestone()` |
| Weapon role fix | `utils/weaponPriority.ts:66` | `roleScore` calculation |
| Tie detection | `utils/weaponPriority.ts:101-123` | Tie group assignment loop |
| Roll UI | `components/loot/WeaponPriorityList.tsx` | `WeaponPriorityCard` component |
