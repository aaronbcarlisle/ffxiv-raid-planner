# Session Handoff: Admin View As Improvements & Player Badge Colors

**Date:** 2026-01-11
**Context:** Continuing work on admin features and fixing player card badge colors
**Status:** In Progress - Backend partially complete, frontend not started

---

## What Was Requested

1. **Admin dropdown shows all users** - Admins should see ALL users in the database when assigning players, not just group members/linked players
2. **View As modal role badges** - Add membership role badges next to members in the Admin Dashboard View As modal
3. **ViewAs user swap** - Add dropdown in ViewAsBanner to switch between users without going back to Admin Dashboard
4. **Player card badge colors** - Linked user badges should use membership role colors (not orange/linked color)

---

## What Was Completed

### 1. Admin Dropdown - All Users ✅

**Backend:**
- Created `/api/static-groups/admin/all-users` endpoint (line 905-938 in `backend/app/routers/static_groups.py`)
- Admin-only endpoint that fetches ALL users in database
- Returns `InteractedUserInfo` format for frontend compatibility

**Frontend:**
- Updated `AssignUserModal.tsx` to conditionally fetch:
  - Admins: `/api/static-groups/admin/all-users`
  - Owners: `/api/static-groups/{groupId}/interacted-users`
- Updated help text to say "Admins see all users in the database"

**Files:**
- `backend/app/routers/static_groups.py` (lines 905-938)
- `frontend/src/components/player/AssignUserModal.tsx` (lines 47-49, 182-184)

### 2. View As Modal Role Badges ✅

**Changes:**
- Created `ViewAsMemberInfo` interface extending `MemberInfo` with `role` and `isLinkedPlayer` fields
- Updated `fetchMembers` to include role information from memberships
- Added role badge display in modal using semantic membership color tokens
- Shows "Linked" badge for non-members who have player cards

**Files:**
- `frontend/src/pages/AdminDashboard.tsx` (lines 18-22, 93, 110-138, 525-533)

### 3. ViewAs User Swap Dropdown ✅

**Changes:**
- Added "Switch User" dropdown to ViewAsBanner
- Fetches available users (members + linked players) for current group
- Displays dropdown with user avatars and role badges
- Clicking a user switches viewAs without leaving the page
- Current user highlighted with "(current)" indicator

**Files:**
- `frontend/src/components/admin/ViewAsBanner.tsx` (complete rewrite with dropdown functionality)

### 4. Player Card Badge Colors - IN PROGRESS ⚠️

**Backend Changes Completed:**
- Added `membership_role` field to `LinkedUserInfo` schema in `backend/app/schemas/tier_snapshot.py` (line 83)
- Created `get_user_membership_role()` helper function in `backend/app/routers/tiers.py` (lines 82-101)
- Updated `player_to_response()` to accept optional `membership_role` parameter (line 104)
- Updated `snapshot_to_response_with_players()` to accept membership_map parameter (line 188)
- Updated `list_snapshot_players` endpoint to fetch memberships and pass to player_to_response (lines 558-574)

**Endpoints Updated with Membership Role Lookup:**
- ✅ `claim_player` (line 891)
- ✅ `update_snapshot_player` (line 778)
- ✅ `release_player` (line 952)
- ✅ `admin_assign_player` (line 1049)
- ⚠️ `owner_assign_player` (line 1137) - **NEEDS membership lookup added**
- ❌ Remaining endpoints at lines 1234, 1285, 1336 - **NEED to be checked and updated**

**Frontend Changes - NOT STARTED:**
- ❌ Add `membershipRole?: string` to `LinkedUserInfo` interface in `frontend/src/types/index.ts`
- ❌ Update `PlayerCardStatus.tsx` to use `membershipRole` for badge color instead of hardcoded `membership-linked` color
- ❌ Test that badges now show correct membership colors (owner=teal, lead=purple, member=blue, viewer=zinc)

---

## What Needs To Be Done

### Backend (90% Complete)

1. **Update `owner_assign_player` endpoint** (line 1137 in `tiers.py`):
   ```python
   # Look up membership role for the newly assigned user
   membership_role = None
   if player.user_id:
       membership_role = await get_user_membership_role(session, player.user_id, group_id)

   return player_to_response(player, membership_role)
   ```

2. **Check and update remaining `player_to_response` calls** (lines 1234, 1285, 1336):
   - Identify which endpoints these are in
   - Add membership role lookup if they return players with linked users
   - Follow the same pattern as other updated endpoints

3. **Update `snapshot_to_response_with_players` calls** that don't pass membership_map:
   - Lines 313, 338, 526 in `tiers.py`
   - Need to fetch membership_map and pass it

### Frontend (0% Complete)

1. **Update TypeScript types** (`frontend/src/types/index.ts`):
   ```typescript
   export interface LinkedUserInfo {
     id: string;
     discordId: string;
     discordUsername: string;
     discordAvatar?: string;
     avatarUrl?: string;
     displayName?: string;
     membershipRole?: string;  // NEW: owner/lead/member/viewer
   }
   ```

2. **Update `PlayerCardStatus.tsx`** (lines 96-112):
   - Change from hardcoded `membership-linked` color to role-based colors
   - Add role label mapping
   - Example:
     ```typescript
     const ROLE_COLORS: Record<string, string> = {
       owner: 'bg-membership-owner/20 text-membership-owner',
       lead: 'bg-membership-lead/20 text-membership-lead',
       member: 'bg-membership-member/20 text-membership-member',
       viewer: 'bg-membership-viewer/20 text-membership-viewer',
     };

     const roleColor = linkedUser.membershipRole
       ? ROLE_COLORS[linkedUser.membershipRole]
       : 'bg-membership-linked/20 text-membership-linked';

     const roleLabel = linkedUser.membershipRole
       ? linkedUser.membershipRole.charAt(0).toUpperCase() + linkedUser.membershipRole.slice(1)
       : linkedUser.displayName || linkedUser.discordUsername;
     ```

3. **Test the changes:**
   - Assign a user to a player card
   - Verify badge shows correct role color (owner=teal, lead=purple, member=blue, viewer=zinc)
   - Verify non-members still show orange "Linked" badge

---

## Key Files Modified

### Backend
- `backend/app/routers/static_groups.py` - Added admin/all-users endpoint
- `backend/app/routers/tiers.py` - Added membership_role to player responses
- `backend/app/schemas/tier_snapshot.py` - Added membershipRole field to LinkedUserInfo

### Frontend
- `frontend/src/components/player/AssignUserModal.tsx` - Admin/owner user fetching
- `frontend/src/pages/AdminDashboard.tsx` - View As modal with role badges
- `frontend/src/components/admin/ViewAsBanner.tsx` - User swap dropdown
- `frontend/src/types/index.ts` - Type definitions (needs update)
- `frontend/src/components/player/PlayerCardStatus.tsx` - Badge colors (needs update)

---

## Current State of Code

### Backend player_to_response Pattern

All endpoints that return players should follow this pattern:

```python
# After committing/updating player
await session.flush()
await session.commit()

# Reload with user relationship
result = await session.execute(
    select(SnapshotPlayer)
    .where(SnapshotPlayer.id == player_id)
    .options(selectinload(SnapshotPlayer.user))
)
player = result.scalar_one()

# Look up membership role for the linked user
membership_role = None
if player.user_id:
    membership_role = await get_user_membership_role(session, player.user_id, group_id)

return player_to_response(player, membership_role)
```

### Frontend Badge Color Mapping

```typescript
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30',
  lead: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30',
  member: 'bg-membership-member/20 text-membership-member border-membership-member/30',
  viewer: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30',
};
```

---

## Testing Checklist

- [ ] Admin can see ALL users when assigning player cards
- [ ] View As modal shows role badges for all members
- [ ] ViewAs banner allows switching between users without leaving page
- [ ] Player card badges use membership role colors:
  - [ ] Owner shows teal badge
  - [ ] Lead shows purple badge
  - [ ] Member shows blue badge
  - [ ] Viewer shows zinc badge
  - [ ] Non-members show orange "Linked" badge
- [ ] Backend compilation passes
- [ ] Frontend TypeScript compilation passes

---

## Design System Compliance

All components use the design system:
- Checkboxes use `<Checkbox>` component
- Dropdowns use `<Select>` component
- Role badges use semantic color tokens (`text-membership-*`, `bg-membership-*`)
- All modals use `<Modal>` component

---

## Notes

- The orange badge issue is because `PlayerCardStatus.tsx` uses hardcoded `membership-linked` color for all linked users
- The fix is to use the `membershipRole` field from `linkedUser` to determine the color
- Non-members (users with no membership) should still show orange "Linked" badge
- This creates a visual hierarchy: members show their role color, non-members show they're just "linked"
