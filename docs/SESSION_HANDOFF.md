# Setup Wizard - Session Handoff

## Branch: `feature/setup-wizard`

## Last Session: Session 1.5+ (Keyboard Navigation & Focus Polish)

### Completed This Session

1. **Auto-focus first player slot** - When switching from Details to Roster step, first slot's name input is automatically focused

2. **JobPicker upward dropdown fix** - Fixed keyboard navigation for dropdowns that open upward:
   - Double `flex-col-reverse` (container + each category section) ensures index 0 is at visual bottom
   - Up/Down arrows now move in correct visual direction
   - Scroll position starts at bottom (tanks visible, closest to search)

3. **Focus flow improvements**:
   - "Other Jobs" picker selection now focuses next slot (same as quick-select buttons)
   - Last slot (R2) job selection focuses Next button directly

4. **Wizard keyboard shortcuts**:
   - `Alt+Left` - Go back a step
   - `Alt+Right` - Go forward a step (respects validation)
   - `preventDefault()` stops Chrome's browser back/forward

5. **Keyboard hint in footer** - Subtle hint between Back/Next buttons: `[Alt] + [←][→] to navigate`

### Files Modified This Session

| File | Changes |
|------|---------|
| `components/wizard/SetupWizard.tsx` | Added keyboard event listener for Alt+Arrow navigation |
| `components/wizard/WizardNavigation.tsx` | Added keyboard shortcut hint with styled kbd elements |
| `components/wizard/steps/RosterSetupStep.tsx` | Auto-focus first slot on mount, focus Next on last slot |
| `components/wizard/RosterSlot.tsx` | Pass `shouldFocusNext=true` when selecting from "Other Jobs" |
| `components/player/JobPicker.tsx` | Fixed upward dropdown keyboard nav with double flex-col-reverse |

### Current State

- **Step 1 (Details)**: Fully functional - name, tier selector, public toggle
- **Step 2 (Roster)**: Fully functional with polished UX - job quick-select, keyboard nav, proper focus flow
- **Step 3 (Invite)**: Placeholder only
- **Step 4 (Review)**: Placeholder only
- **Submission**: Not implemented (placeholder alert)

### Key Files Reference

```
frontend/src/components/wizard/
├── SetupWizard.tsx           # Main orchestrator, state, keyboard shortcuts
├── WizardProgress.tsx        # 4-step progress indicator
├── WizardNavigation.tsx      # Back/Next buttons + keyboard hint
├── RosterSlot.tsx            # Individual player slot with job picker
├── types.ts                  # WizardState, WizardPlayer interfaces
└── steps/
    ├── StaticDetailsStep.tsx # Step 1: Name + Tier + Public
    ├── RosterSetupStep.tsx   # Step 2: 8 player slots grid
    ├── InviteMembersStep.tsx # Step 3: (TO BE IMPLEMENTED)
    └── ReviewStep.tsx        # Step 4: (TO BE IMPLEMENTED)
```

### Known Issues / Notes

- `frontend/src/gamedata/index.ts` and `raid-tiers.ts` have unrelated uncommitted changes (tier images)
- Untracked files: `frontend/public/images/raid-tiers/`, `frontend/scripts/blend-tier-banners.py`

---

## Next Session: Session 2 - Steps 3-4 & Submission Flow

### Tasks

1. **Build InviteMembersStep.tsx**
   - Auto-generate member invite link display
   - Copy button with feedback toast
   - Role selector (default: member)
   - "Skip for now" option

2. **Build ReviewStep.tsx**
   - Static name and tier summary
   - Roster cards (8 slots showing name/job/BiS status)
   - Empty slot warnings (info, not blocking)
   - "Create Static" button

3. **Implement submission flow in SetupWizard.tsx**:
   - `createGroup()` → `createTier()` → `addPlayer()` loop → `createInvitation()`
   - Loading spinner during submission
   - Error handling with retry option
   - Navigate to `/group/{shareCode}` on success

4. **Add cancel confirmation** (ConfirmModal when closing mid-wizard)

5. **Update Dashboard.tsx**:
   - Replace simple create modal with `<SetupWizard />`
   - Handle onComplete callback

### API Endpoints Used (Existing)

```
POST /api/static-groups                    # Create static
POST /api/static-groups/{id}/tiers         # Create tier
POST .../tiers/{tierId}/players            # Add player (loop)
PUT .../players/{playerId}                 # Update with BiS data
POST /api/static-groups/{id}/invitations   # Create invite link
```

### Stores to Use

- `staticGroupStore.ts` - `createGroup()`
- `tierStore.ts` - `createTier()`, `addPlayer()`, `updatePlayer()`
- `invitationStore.ts` - `createInvitation()`
