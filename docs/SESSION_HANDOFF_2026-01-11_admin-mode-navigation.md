# Session Handoff: Navigation-Based Admin Mode + Player Badge Colors

**Date:** 2026-01-11
**Status:** Complete - Ready for testing

---

## What Was Implemented

### 1. Player Card Badge Display Fix
**Issue:** Badge showed role name (Owner, Lead, etc.) instead of user's avatar + username
**Fix:** Changed `roleLabel` to always show username; role is now indicated by badge color

**File:** `frontend/src/components/player/PlayerCardStatus.tsx` (line 70-71)
```typescript
// Always show username (role is indicated by color)
const roleLabel = linkedUser?.displayName || linkedUser?.discordUsername || '';
```

### 2. Navigation-Based Admin Access
**Issue:** Admins always had elevated access, making "View As" confusing
**Fix:** Admin mode only activates when navigating from Admin Dashboard with `?adminMode=true`

**How It Works:**
- Normal navigation (My Statics, share links) = user sees their normal membership role
- Admin Dashboard navigation = adds `?adminMode=true` to URL, enables admin powers
- "Exit Admin Mode" button clears the param and returns to normal view

**Files Changed:**

| File | Change |
|------|--------|
| `AdminDashboard.tsx` | Added `?adminMode=true` to all navigation URLs (lines 174, 364) |
| `GroupView.tsx` | Changed isAdminAccess to check for `adminMode` URL param (lines 285-287) |
| `AdminBanners.tsx` | Added "Exit Admin Mode" button (lines 25-33, 45-51) |
| `PlayerCard.tsx` | Added `isAdminAccess` prop, use it for permission checks (lines 51, 87, 312-314, 385, 393) |
| `DroppablePlayerCard.tsx` | Added `isAdminAccess` prop passthrough (line 26) |
| `PlayerGrid.tsx` | Pass `isAdminAccess` to DroppablePlayerCard (line 183) |
| `GearTable.tsx` | Changed permission check to use `isAdminAccess` (line 370) |
| `PlayerCardGear.tsx` | Changed prop from `isAdmin` to `isAdminAccess` (line 26, 59) |

---

## Key Code Changes

### GroupView.tsx - Admin Mode Logic
```typescript
// Admin access only when navigating from Admin Dashboard with adminMode=true
const adminModeParam = searchParams.get('adminMode') === 'true';
const isAdminAccess = !viewAsUser && (user?.isAdmin ?? false) && adminModeParam;
```

### PlayerCard.tsx - Permission Checks
```typescript
// Permission checks - use isAdminAccess (not isAdmin) to respect View As context
const editPermission = canEditPlayer(userRole, player, currentUserId, isAdminAccess);
const rosterPermission = canManageRoster(userRole, isAdminAccess);
const resetPermission = canResetGear(userRole, player, currentUserId, isAdminAccess);
```

### AdminBanners.tsx - Exit Button
```typescript
const handleExitAdminMode = () => {
  const params = new URLSearchParams(location.search);
  params.delete('adminMode');
  params.delete('viewAs');
  const newSearch = params.toString();
  const newPath = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
  navigate(newPath, { replace: true });
};
```

---

## Testing Checklist

- [ ] **Badge Display:**
  - Assign a member to a player card
  - Badge shows avatar + username (not "Owner"/"Member")
  - Badge color matches their role (teal=owner, purple=lead, blue=member, zinc=viewer)
  - Tooltip shows "Linked to Username (role)"

- [ ] **Normal Navigation (No Admin Mode):**
  - Go to My Statics → open a group where you're a member
  - Verify: See your normal member permissions
  - Verify: No admin banner at top
  - Verify: Cannot see "Assign User (Admin)" in context menu

- [ ] **Admin Dashboard Navigation:**
  - Go to Admin Dashboard → click a static
  - Verify: URL has `?adminMode=true`
  - Verify: Orange "Admin Mode" banner appears with "Exit Admin Mode" button
  - Verify: Have owner-level permissions
  - Verify: "Assign User (Admin)" appears in context menu

- [ ] **Exit Admin Mode:**
  - Click "Exit Admin Mode" button
  - Verify: URL no longer has `adminMode` param
  - Verify: Banner disappears
  - Verify: Permissions return to normal membership level

- [ ] **View As (within Admin Mode):**
  - From Admin Dashboard, use View As on a member
  - Verify: URL has `?adminMode=true&viewAs=userId`
  - Verify: See that member's exact permissions
  - Verify: Cannot edit other players' cards

---

## Session Continuation Prompt

If context runs low, use this prompt:

```
Continue work from docs/SESSION_HANDOFF_2026-01-11_admin-mode-navigation.md

COMPLETED:
- Player badge shows username with role-based colors
- Navigation-based admin mode (adminMode=true URL param)
- Exit Admin Mode button in AdminBanners
- PlayerCard uses isAdminAccess for permission checks

TO TEST:
1. Normal navigation - admin sees their member role, not admin powers
2. Admin Dashboard navigation - admin mode activates with banner
3. Exit Admin Mode - clears param and returns to normal
4. View As - respects impersonated user's permissions
```

---

## Related Files

- `frontend/src/components/player/PlayerCardStatus.tsx` - Badge display
- `frontend/src/components/player/PlayerCard.tsx` - Permission checks
- `frontend/src/components/player/PlayerGrid.tsx` - Prop passing
- `frontend/src/components/player/DroppablePlayerCard.tsx` - Prop passthrough
- `frontend/src/components/admin/AdminBanners.tsx` - Admin mode banner
- `frontend/src/pages/AdminDashboard.tsx` - Navigation URLs
- `frontend/src/pages/GroupView.tsx` - Admin mode calculation
