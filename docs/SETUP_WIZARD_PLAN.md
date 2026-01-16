# Static Setup Wizard & UX Improvements Implementation Plan

## Overview

This plan addresses the unintuitive static creation process by implementing:
1. **Setup Wizard** - A 4-step guided modal for creating statics
2. **Player Card Action Buttons** - Visible "Take Ownership" / "Assign Ownership" / "Import BiS" buttons
3. **Members Tab Enhancement** - Linked Card dropdown for member-to-card assignment

## Design Decisions (User Confirmed)

### Session 1.5 UX Improvements (New)
| Feature | Implementation |
|---------|----------------|
| Default tier | Pre-select RAID_TIERS[0] (latest tier) |
| Job selection | Role-specific quick-select buttons + "Other" fallback |
| Dropdown rendering | Portal or z-index fix to prevent modal shift |
| Keyboard nav | Full Tab/Enter/Arrow support through roster |
| Navigation footer | Sticky at bottom, always visible |

### Original Decisions

| Decision | Choice |
|----------|--------|
| BiS in wizard | Button opens existing BiSImportModal (lightweight) |
| Roster completion | Allow partial (not all 8 required) |
| Member assignment UI | Members tab dropdown |
| Button visibility | Only when actionable (hide otherwise) |
| Static name location | Inside wizard as Step 1 |
| Cancel behavior | Discard everything (nothing created until complete) |
| Navigation | Linear with back/next |
| Wizard scope | Initial creation only (tier workflow noted for future) |

## Ownership Button Behavior

| User Role | Unclaimed Card | Claimed Card |
|-----------|----------------|--------------|
| Owner/Lead | "Assign Ownership" → Opens AssignUserModal | No button |
| Member | "Take Ownership" → Claims for self | No button |
| Viewer | No button | No button |

---

## Architecture

### New Components

```
frontend/src/components/wizard/
├── SetupWizard.tsx           # Main orchestrator (modal container)
├── WizardProgress.tsx        # 4-step progress indicator
├── WizardNavigation.tsx      # Back/Next/Create buttons
├── RosterSlot.tsx            # Individual player slot component
├── types.ts                  # WizardState, WizardPlayer interfaces
├── index.ts                  # Barrel export
└── steps/
    ├── StaticDetailsStep.tsx # Step 1: Name + Tier + Public
    ├── RosterSetupStep.tsx   # Step 2: 8 player slots
    ├── InviteMembersStep.tsx # Step 3: Generated invite link
    └── ReviewStep.tsx        # Step 4: Summary + Create button
```

### Modified Components

| Component | Modification |
|-----------|-------------|
| `Dashboard.tsx` | Replace create modal with wizard trigger |
| `PlayerCard.tsx` | Add conditional action button row |
| `MembersPanel.tsx` | Add "Linked Card" dropdown per member |

### State Management

**Wizard uses local React state** (not Zustand) because:
- State is transient - discarded on cancel
- No cross-component access needed
- Simpler for one-time setup flow

```typescript
interface WizardState {
  step: 1 | 2 | 3 | 4;
  staticName: string;
  tierId: string;
  isPublic: boolean;
  players: WizardPlayer[];
  inviteCode: string | null;
}

interface WizardPlayer {
  position: RaidPosition; // T1, T2, H1, H2, M1, M2, R1, R2
  name: string;
  job: string;
  role: string;
  bisLink?: string;
  gear?: GearSlotStatus[];
}
```

---

## API Usage

**No new endpoints required.** The wizard uses existing endpoints sequentially:

1. `POST /api/static-groups` - Create static
2. `POST /api/static-groups/{id}/tiers` - Create tier
3. `POST .../tiers/{tierId}/players` - Add player (for each non-empty slot)
4. `PUT .../players/{playerId}` - Update with BiS data
5. `POST /api/static-groups/{id}/invitations` - Create invite link

---

## Implementation Sessions

### Session 1: Wizard Foundation & Step 1-2
**Model:** Sonnet (good balance of speed and quality for component scaffolding)
**Estimated Scope:** ~800-1000 lines of new code

#### Tasks
1. Create wizard directory structure and types
2. Build `SetupWizard.tsx` container with modal, state, navigation
3. Implement `WizardProgress.tsx` (4-step indicator)
4. Implement `WizardNavigation.tsx` (Back/Next buttons)
5. Build `StaticDetailsStep.tsx` (name, tier selector, public toggle)
6. Build `RosterSetupStep.tsx` (8 player slots grid)
7. Build `RosterSlot.tsx` (position, name, job picker, BiS button)
8. Integrate BiSImportModal for wizard context

#### Prompt for Session 1
```
Continue implementing the Static Setup Wizard from the plan at /home/serapis/.claude/plans/compressed-purring-llama.md

This session focuses on: Wizard Foundation & Steps 1-2

Tasks:
1. Create /frontend/src/components/wizard/ directory with types.ts
2. Build SetupWizard.tsx - modal container with step state management
3. Build WizardProgress.tsx - horizontal 4-step indicator with labels
4. Build WizardNavigation.tsx - Back/Next buttons with validation
5. Build StaticDetailsStep.tsx - static name input, TierSelector, public checkbox
6. Build RosterSetupStep.tsx - 2x4 grid of RosterSlot components
7. Build RosterSlot.tsx - position label, name input, JobPicker, Import BiS button

Key patterns to follow:
- Use existing Modal component from components/ui/Modal.tsx
- Use existing Button component with variants
- Match design system (dark theme, teal accents, role colors)
- BiS button opens existing BiSImportModal

Test the wizard opens from Dashboard (don't integrate submission yet).
```

#### Handoff for Session 2
```
Session 1 Complete. Wizard foundation and Steps 1-2 are implemented.

Files created:
- /frontend/src/components/wizard/types.ts
- /frontend/src/components/wizard/SetupWizard.tsx
- /frontend/src/components/wizard/WizardProgress.tsx
- /frontend/src/components/wizard/WizardNavigation.tsx
- /frontend/src/components/wizard/steps/StaticDetailsStep.tsx
- /frontend/src/components/wizard/steps/RosterSetupStep.tsx
- /frontend/src/components/wizard/RosterSlot.tsx

Current state:
- Wizard opens from Dashboard
- Steps 1-2 functional with local state
- BiS import works within RosterSlot
- Back/Next navigation works

Next session: Implement Steps 3-4 and full submission flow.
```

---

### Session 1.5: UX Polish & Refinements
**Model:** Sonnet
**Estimated Scope:** ~200-300 lines of modifications

#### Tasks
1. **Default to Latest Tier** - Pre-select current tier in StaticDetailsStep
2. **Job Quick-Select Buttons** - Add role-specific job buttons to RosterSlot
3. **Fix Dropdown Z-Index** - Ensure JobPicker renders outside modal scroll container
4. **Keyboard Navigation** - Full keyboard support for roster slots
5. **Sticky Navigation Footer** - Make Back/Next buttons always visible

#### Detailed Changes

**1. StaticDetailsStep - Default Tier**
- Get current tier from `RAID_TIERS[0]` (always first in array)
- Pre-populate `tierId` in wizard state initialization
- Show selected tier with ability to change (not hidden)

**2. RosterSlot - Job Quick-Select**
- Show role-specific job icons as toggle buttons (similar to existing JobPicker with `templateRole`)
- For tanks: PLD, WAR, DRK, GNB buttons + "Other"
- For healers: WHM, SCH, AST, SGE buttons + "Other"
- For melee: MNK, DRG, NIN, SAM, RPR, VPR buttons + "Other"
- For ranged: BRD, MCH, DNC buttons + "Other"
- For casters: BLM, SMN, RDM, PCT buttons + "Other"
- "Other" opens full JobPicker dropdown
- Replace button-to-open-picker with inline quick-select

**3. JobPicker Portal Fix**
- Ensure JobPicker dropdown uses `createPortal` to render at document root
- Or use proper z-index layering (z-50+ to render above modal backdrop)
- Prevents modal content from shifting when picker expands

**4. Keyboard Navigation**
- Tab order: name input → job buttons → BiS button → next slot
- Enter key on job button selects that job and focuses next slot
- Arrow keys navigate between job buttons
- Escape closes expanded JobPicker
- Auto-focus next slot's name input after job selection

**5. Sticky Footer in Modal**
- Modify SetupWizard to split modal content into:
  - Scrollable content area (WizardProgress + step content)
  - Fixed footer (WizardNavigation)
- Use flex layout: `flex flex-col` with `flex-1 overflow-y-auto` for content
- Footer stays at bottom regardless of scroll position

#### Prompt for Session 1.5
```
Continue implementing the Static Setup Wizard from the plan at docs/SETUP_WIZARD_PLAN.md

This session focuses on: UX Polish & Refinements (Session 1.5)

Prerequisites from Session 1:
- Wizard foundation and Steps 1-2 implemented
- Basic functionality working

Tasks:
1. StaticDetailsStep.tsx - Default to latest tier:
   - Initialize tierId with RAID_TIERS[0].id in SetupWizard state
   - Keep tier selector visible but pre-populated

2. RosterSlot.tsx - Add job quick-select buttons:
   - Show role-specific job icons as clickable buttons
   - Use existing getJobsByRole() to get jobs for player's role
   - Display job icons in a horizontal row with hover states
   - Add "Other Jobs" button that opens full JobPicker
   - Replace current button-to-open-picker with inline buttons

3. JobPicker.tsx - Fix z-index/portal:
   - Ensure dropdown renders above modal backdrop
   - Use z-index z-[100] or higher
   - Test that modal content doesn't shift when picker opens

4. RosterSlot.tsx - Keyboard navigation:
   - Implement proper tab order through slots
   - Add Enter key handler on job buttons to select and advance
   - Auto-focus next slot's name input after job selection
   - Add onKeyDown handlers for navigation

5. SetupWizard.tsx - Sticky navigation footer:
   - Restructure modal content with flex layout
   - Make step content scrollable: overflow-y-auto flex-1
   - Keep WizardNavigation fixed at bottom
   - Test with short screens to verify footer stays visible

Run build and test keyboard navigation thoroughly.
```

#### Handoff for Session 2
```
Session 1.5 Complete. UX refinements implemented.

Changes made:
- StaticDetailsStep defaults to latest tier (still changeable)
- RosterSlot has inline job quick-select buttons per role
- JobPicker z-index fixed, no modal content shift
- Full keyboard navigation working (Tab, Enter, Arrow keys)
- Navigation footer is sticky, always visible

Current state:
- Wizard UX is polished and keyboard-accessible
- Default selections reduce clicks for common case
- Ready for Steps 3-4 implementation

Next session: Implement Steps 3-4 and full submission flow.
```

---

### Session 2: Steps 3-4 & Submission Flow
**Model:** Sonnet
**Estimated Scope:** ~500-700 lines

#### Tasks
1. Build `InviteMembersStep.tsx` (invite link display, copy button, skip option)
2. Build `ReviewStep.tsx` (summary cards, warnings, Create button)
3. Implement wizard submission flow (create group → tier → players → invite)
4. Add loading states and error handling
5. Navigate to new static on completion
6. Add cancel confirmation dialog
7. Update Dashboard.tsx to use wizard instead of simple modal

#### Prompt for Session 2
```
Continue implementing the Static Setup Wizard from the plan at /home/serapis/.claude/plans/compressed-purring-llama.md

This session focuses on: Steps 3-4 & Submission Flow

Prerequisites complete from Session 1:
- Wizard container and Steps 1-2 are working
- Local state management in place

Tasks:
1. Build InviteMembersStep.tsx
   - Auto-generate member invite link display
   - Copy button with feedback toast
   - Role selector (default: member)
   - "Skip for now" option

2. Build ReviewStep.tsx
   - Static name and tier summary
   - Roster cards (8 slots showing name/job/BiS status)
   - Empty slot warnings (info, not blocking)
   - "Create Static" button

3. Implement submission flow in SetupWizard.tsx:
   - createGroup() → createTier() → addPlayer() loop → createInvitation()
   - Loading spinner during submission
   - Error handling with retry option
   - Navigate to /group/{shareCode} on success

4. Add cancel confirmation (ConfirmModal when closing mid-wizard)

5. Update Dashboard.tsx:
   - Replace simple create modal with <SetupWizard />
   - Handle onComplete callback

Run build and fix any type errors.
```

#### Handoff for Session 3
```
Session 2 Complete. Full wizard flow is working.

Files created/modified:
- /frontend/src/components/wizard/steps/InviteMembersStep.tsx
- /frontend/src/components/wizard/steps/ReviewStep.tsx
- /frontend/src/components/wizard/SetupWizard.tsx (submission flow added)
- /frontend/src/pages/Dashboard.tsx (wizard integration)

Current state:
- Full 4-step wizard flow works end-to-end
- Static + tier + players + invite created on completion
- Error handling and loading states in place
- Cancel confirmation works

Next session: PlayerCard action buttons.
```

---

### Session 3: PlayerCard Action Buttons
**Model:** Sonnet
**Estimated Scope:** ~300-400 lines

#### Tasks
1. Create `PlayerCardActions.tsx` component with conditional button rendering
2. Modify `PlayerCard.tsx` to include action button row
3. Implement button visibility logic:
   - Unclaimed + Owner/Lead → "Assign Ownership"
   - Unclaimed + Member → "Take Ownership"
   - Claimed by me + No BiS → "Import BiS"
4. Wire up button handlers (reuse existing claim/assign/BiS logic)
5. Add unit tests for button visibility logic

#### Prompt for Session 3
```
Continue implementing the Static Setup Wizard features from the plan at /home/serapis/.claude/plans/compressed-purring-llama.md

This session focuses on: PlayerCard Action Buttons

Tasks:
1. Create PlayerCardActions.tsx in /frontend/src/components/player/
   - Accepts: player, currentUserId, userRole, isGroupOwner, userHasClaimedPlayer, handlers
   - Renders conditional buttons based on state

2. Button visibility logic:
   | State | Owner/Lead | Member |
   |-------|------------|--------|
   | Unclaimed | "Assign Ownership" | "Take Ownership" |
   | Claimed by me, no BiS | "Import BiS" | "Import BiS" |
   | Claimed by other | - | - |

3. Modify PlayerCard.tsx:
   - Add <PlayerCardActions /> below header or in card footer
   - Pass required props from existing context
   - "Assign Ownership" opens AssignUserModal
   - "Take Ownership" calls existing onClaimPlayer
   - "Import BiS" opens BiSImportModal

4. Use existing Button component with appropriate variants:
   - "Assign Ownership": variant="secondary" with Link2 icon
   - "Take Ownership": variant="secondary" with UserCheck icon
   - "Import BiS": variant="secondary" with FileDown icon

5. Add tests in PlayerCardActions.test.tsx for visibility logic

Run build, run tests, fix any errors.
```

#### Handoff for Session 4
```
Session 3 Complete. PlayerCard action buttons are working.

Files created/modified:
- /frontend/src/components/player/PlayerCardActions.tsx (new)
- /frontend/src/components/player/PlayerCardActions.test.tsx (new)
- /frontend/src/components/player/PlayerCard.tsx (added action buttons)

Current state:
- Action buttons appear based on card state and user role
- Buttons trigger existing modals/actions
- Context menu still works (buttons are additional, not replacement)
- Tests passing

Next session: MembersPanel linked card dropdown.
```

---

### Session 4: MembersPanel Enhancement & Final Polish
**Model:** Sonnet
**Estimated Scope:** ~400-500 lines

#### Tasks
1. Enhance `MembersPanel.tsx` with "Linked Card" dropdown per member
2. Fetch available player cards (unclaimed or owned by member)
3. Implement card assignment on dropdown selection
4. Add tier grouping if multiple tiers exist
5. Write integration tests for wizard flow
6. Update CLAUDE.md with new components documentation
7. Update OUTSTANDING_WORK.md to mark items complete
8. Final testing and bug fixes

#### Prompt for Session 4
```
Continue implementing the Static Setup Wizard features from the plan at /home/serapis/.claude/plans/compressed-purring-llama.md

This session focuses on: MembersPanel Enhancement & Final Polish

Tasks:
1. Modify MembersPanel.tsx:
   - Add "Linked Card" dropdown to each member row
   - Fetch current tier's players
   - Show available cards: unclaimed OR already claimed by this member
   - Display job icon + player name in dropdown options
   - On selection, call existing assign endpoint
   - Pre-select if member already has a linked card

2. Edge cases:
   - No available cards → show "No available cards"
   - Multiple tiers → group by tier or focus on active tier only
   - Assignment fails → show error toast

3. Write integration tests:
   - Test wizard flow end-to-end
   - Test player card button states
   - Test member assignment dropdown

4. Documentation updates:
   - Update CLAUDE.md Key Files section with new wizard components
   - Add wizard patterns to Key Implementation Patterns
   - Update OUTSTANDING_WORK.md if applicable

5. Final testing:
   - Run full test suite
   - Manual testing of wizard flow
   - Verify no regressions in existing functionality

Create PR when complete.
```

#### Handoff (Final)
```
Implementation Complete!

Summary of changes:
1. Setup Wizard - 4-step guided static creation
2. PlayerCard Action Buttons - Visible Take/Assign Ownership and Import BiS
3. MembersPanel Enhancement - Linked Card dropdown

Files created:
- /frontend/src/components/wizard/* (8 new files)
- /frontend/src/components/player/PlayerCardActions.tsx

Files modified:
- /frontend/src/pages/Dashboard.tsx
- /frontend/src/components/player/PlayerCard.tsx
- /frontend/src/components/static-group/MembersPanel.tsx
- /home/serapis/projects/ffxiv-raid-planner/CLAUDE.md

All tests passing. PR ready for review.
```

---

## Edge Cases & Handling

### Wizard Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Browser closed mid-wizard | Data lost - acceptable for one-time setup |
| API error during creation | Show error, allow retry, don't navigate |
| Empty roster submitted | Allow - creates static with template players |
| Partial roster | Skip empty slots, create only filled ones |
| BiS import fails | Show error in slot, allow retry/skip |
| Session expires | Redirect to login, wizard state lost |

### PlayerCard Button Edge Cases

| Edge Case | Handling |
|-----------|----------|
| User already claimed a card | Hide "Take Ownership" on other cards |
| Admin using View As | Use effective role, not admin status |
| Card has BiS already | Hide "Import BiS" (use context menu to update) |

### MembersPanel Edge Cases

| Edge Case | Handling |
|-----------|----------|
| No available cards | Dropdown disabled with "No cards available" |
| Member already linked | Pre-select their card |
| Multiple tiers | Show active tier's cards only |

---

## Testing Strategy

### Unit Tests
- `SetupWizard.test.tsx` - State transitions, validation
- `RosterSetupStep.test.tsx` - Slot interactions
- `PlayerCardActions.test.tsx` - Button visibility logic

### Integration Tests
- Full wizard flow creates static correctly
- BiS import within wizard persists data
- Cancel at each step discards progress
- Member assignment updates player.userId

### Manual Testing Checklist
- [ ] Create static with full roster
- [ ] Create static with partial roster
- [ ] BiS import in wizard works
- [ ] Invite link copies correctly
- [ ] Take Ownership button claims card
- [ ] Assign Ownership opens modal
- [ ] Import BiS button works on claimed card
- [ ] Linked Card dropdown assigns member
- [ ] Existing functionality unaffected

---

## Future Considerations

### Tier Creation Wizard (Future)
The wizard component structure supports adaptation:
- Step 1: Tier selection
- Step 2: Roster setup (copy from existing or fresh)
- Step 3: Review

### Template Statics (Future)
Pre-populated wizard with party compositions:
- "Standard 2-2-4"
- "Double melee"
- "Triple ranged"

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `components/wizard/SetupWizard.tsx` | Main wizard orchestrator |
| `components/wizard/steps/RosterSetupStep.tsx` | Most complex step |
| `components/wizard/RosterSlot.tsx` | Individual player input |
| `components/player/PlayerCard.tsx` | Add action buttons (lines 308-437) |
| `components/player/PlayerCardActions.tsx` | New action button component |
| `components/static-group/MembersPanel.tsx` | Add linked card dropdown |
| `components/player/BiSImportModal.tsx` | Reuse in wizard |
| `components/player/AssignUserModal.tsx` | Reuse for "Assign Ownership" |
| `stores/staticGroupStore.ts` | createGroup() |
| `stores/tierStore.ts` | createTier(), addPlayer(), updatePlayer() |
| `stores/invitationStore.ts` | createInvitation() |
