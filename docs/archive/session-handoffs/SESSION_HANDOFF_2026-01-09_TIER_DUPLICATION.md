# Session Handoff: Tier Duplication Issue

**Date:** 2026-01-09
**Session ID:** `a0f0a57d-e34a-48d9-a62b-6d80c1ed6561`
**Branch:** `feature/combined-audit-improvements`
**PR:** #9

---

## Current Issue

**Problem:** When duplicating a static group, the duplicated group opens with a different tier selected than what was active in the source group.

**Expected:** If the source group has "aac-heavyweight" tier active, the duplicated group should also show "aac-heavyweight" as the active tier.

**Actual:** The duplicated group shows a different tier (e.g., "cruiserweight") even though the backend sets the correct tier as active.

---

## What Was Attempted

### Backend Fix (may not be working)
**File:** `backend/app/routers/static_groups.py:450-458`

```python
# Find which tier_id is currently active in the source group
source_active_tier_id = next(
    (t.tier_id for t in source_group.tier_snapshots if t.is_active),
    None
)

for source_tier in source_group.tier_snapshots:
    # Set the tier with matching tier_id as active
    should_be_active = source_tier.tier_id == source_active_tier_id
```

This was supposed to ensure the same tier_id (like "aac-heavyweight") stays active in the duplicate.

---

## Debugging Next Steps

1. **Check if backend is setting is_active correctly:**
   ```bash
   # After duplicating, check the database
   sqlite3 backend/data/app.db "SELECT tier_id, is_active FROM tier_snapshots WHERE static_group_id = 'NEW_GROUP_ID';"
   ```

2. **Check frontend tier selection logic:**
   - File: `frontend/src/pages/GroupView.tsx:328-365`
   - The useEffect selects tier based on: URL param > localStorage > active tier > first tier
   - localStorage key: `selected-tier-{groupId}`
   - Maybe localStorage from a previous group is interfering?

3. **Check API response after duplication:**
   - The duplicate endpoint returns the new group but NOT the tiers
   - The frontend then calls `fetchTiers()` and `fetchTier()` separately
   - Check if `fetchTiers` returns correct `is_active` flags

4. **Potential root causes:**
   - `source_group.tier_snapshots` iteration order is non-deterministic
   - Frontend tier selection prioritizes something other than `is_active`
   - localStorage has stale tier selection for similar group

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/routers/static_groups.py:400-560` | Duplication endpoint |
| `frontend/src/pages/GroupView.tsx:328-365` | Tier selection on group load |
| `frontend/src/stores/tierStore.ts:68-97` | fetchTiers and fetchTier |
| `frontend/src/stores/staticGroupStore.ts:150-196` | duplicateGroup frontend |

---

## Tests Added This Session

- `TestGearDataPreservation` - Verifies gear data is preserved during duplication (passes)
- `TestGroupDuplicationActiveTiers` - Verifies only one tier is active (passes)

Both tests pass, suggesting the backend logic is correct but something in the frontend/data flow is wrong.

---

## PR Status

- 46 review threads resolved
- All 97 backend tests pass
- All 142 frontend tests pass
- Ready for merge except for this tier selection UX issue

---

## Resume Prompt

```
Continue debugging the tier duplication issue in PR #9. When a static group is
duplicated, the new group should open with the same tier selected as was active
in the source group. The backend fix at static_groups.py:450-458 sets is_active
correctly, but the frontend still shows a different tier.

Check:
1. What the API returns for is_active on the duplicated tiers
2. How GroupView.tsx:328-365 selects which tier to display
3. If localStorage is interfering with tier selection

Key files: static_groups.py (duplication), GroupView.tsx (tier selection),
tierStore.ts (tier fetching)
```

---

## Quick Commands

```bash
# Start dev servers
./dev.sh

# Run backend tests
cd backend && source venv/bin/activate && pytest tests/test_pr_integration.py -v

# Check database
sqlite3 backend/data/app.db "SELECT id, tier_id, is_active FROM tier_snapshots ORDER BY static_group_id, tier_id;"

# Type check frontend
cd frontend && pnpm tsc --noEmit
```
