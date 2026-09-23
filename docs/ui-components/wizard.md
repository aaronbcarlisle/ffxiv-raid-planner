# Wizard Components (v1.0.9)

> Part of the [UI component inventory](../UI_COMPONENTS.md) — moved here verbatim on 2026-09-23 so the entry doc stays small. Quick Reference, decision tree, tokens and the compliance checker live there.


### SetupWizard

**Path:** `components/wizard/SetupWizard.tsx`

**Purpose:** 4-step guided modal for creating new static groups.

**Steps:**
1. **Static Details** - Name, tier selection (defaults to latest), content type
2. **Roster Setup** - 8 player slots with job quick-select
3. **Share** - Copy share link for inviting members
4. **Review** - Summary of configuration before creation

**Features:**
- Role-specific job quick-select buttons
- Keyboard navigation (Tab through slots, Enter to advance)
- Sticky navigation footer (always visible)
- Default tier pre-selected (latest savage tier)
- Partial roster allowed
- Cancel confirmation prevents data loss

**Sub-components:**
- `WizardProgress` - 4-step horizontal progress indicator
- `WizardNavigation` - Back/Next/Create buttons
- `RosterSlot` - Individual player slot with job picker
- `StaticDetailsStep`, `RosterSetupStep`, `ShareStep`, `ReviewStep`

**Usage:**
```tsx
import { SetupWizard } from '../components/wizard';

<SetupWizard
  isOpen={showWizard}
  onClose={() => setShowWizard(false)}
  onComplete={(group) => navigate(`/group/${group.shareCode}`)}
/>
```

**When to use:** Dashboard "Create Static" button.

---

### PlayerSetupBanner

**Path:** `components/player/PlayerSetupBanner.tsx`

**Purpose:** Contextual banner on PlayerCards when setup is incomplete.

**Props:**
```typescript
interface PlayerSetupBannerProps {
  player: SnapshotPlayer;
  userRole: MemberRole | undefined;
  currentUserId: string | undefined;
  isAdmin: boolean;
  viewAsUserId?: string;
  onAssign: () => void;
  onClaim: () => void;
  onImportBiS: () => void;
}
```

**Banner States:**
| Condition | Message | Action |
|-----------|---------|--------|
| Unclaimed + Owner/Lead | "Unclaimed" | Assign Player |
| Unclaimed + Member | "Unclaimed" | Take Ownership |
| Claimed by me + No BiS | "No BiS configured" | Import BiS |
| Fully configured | *(hidden)* | - |

**Features:**
- Auto-hides when card is fully configured
- Respects View As mode for admin impersonation
- Compact design (~32px height)
- Uses `bg-surface-elevated` styling

**Usage:**
```tsx
import { PlayerSetupBanner } from '../components/player/PlayerSetupBanner';

<PlayerSetupBanner
  player={player}
  userRole={membership?.role}
  currentUserId={user?.id}
  isAdmin={isAdmin}
  onAssign={() => setShowAssignModal(true)}
  onClaim={handleClaim}
  onImportBiS={() => setShowBiSModal(true)}
/>
```

**When to use:** Between PlayerCard header and gear table.

---

### AssignUserModal

**Path:** `components/player/AssignUserModal.tsx`

**Purpose:** Modal for owners/admins to assign Discord users to player cards.

**Features:**
- Two tabs: Members (existing group members) and Manual (enter user ID)
- Role-colored badges (Owner/Lead/Member/Viewer/Linked)
- Users already assigned to other cards appear at bottom with indicator
- Confirmation modal when reassigning from another card
- Discord ID (17-19 digits) and UUID format validation

**Usage:**
```tsx
import { AssignUserModal } from '../components/player/AssignUserModal';

<AssignUserModal
  isOpen={showAssignModal}
  onClose={() => setShowAssignModal(false)}
  player={player}
  members={groupMembers}
  allPlayers={allPlayers}
  onAssign={handleAssignUser}
/>
```

**When to use:** Admin/owner player assignment via context menu or PlayerSetupBanner
