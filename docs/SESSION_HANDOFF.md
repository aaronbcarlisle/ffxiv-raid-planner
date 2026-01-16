# Setup Wizard - Session Handoff

## Branch: `feature/setup-wizard`

## Last Session: Session 2 (Steps 3-4 & Submission Flow)

### Completed This Session

1. **InviteMembersStep.tsx** - Step 3 implementation:
   - Role selector (member/lead/viewer) for invite recipients
   - Skip invite option with checkbox
   - Preview of invite link (actual link generated after creation)
   - Helpful tips about invite management

2. **ReviewStep.tsx** - Step 4 implementation:
   - Static details summary (name, tier, visibility, invite role)
   - Roster grid showing all 8 slots with job icons
   - Empty slot warnings (informational, not blocking)
   - BiS import status indicators
   - Error display with retry button

3. **Full submission flow** in SetupWizard.tsx:
   - `createGroup()` → Creates static group
   - `createTier()` → Creates tier with default players
   - `updatePlayer()` loop → Updates players with names/jobs/BiS data
   - `createInvitation()` → Creates invite link (if not skipped)
   - Navigation to `/group/{shareCode}` on success

4. **Cancel confirmation dialog**:
   - ConfirmModal prompts when closing with unsaved changes
   - "Keep Editing" / "Discard" options
   - Change detection for all wizard fields

5. **Dashboard integration** already working:
   - SetupWizard replaces simple create modal
   - `onComplete` callback navigates to new static

### Files Created/Modified This Session

| File | Changes |
|------|---------|
| `components/wizard/steps/InviteMembersStep.tsx` | New - Step 3 with role selector, skip option |
| `components/wizard/steps/ReviewStep.tsx` | New - Step 4 with summary, roster preview |
| `components/wizard/SetupWizard.tsx` | Updated - Full submission flow, cancel confirm |
| `components/wizard/index.ts` | Updated - Export new step components |

### Current State

- **Step 1 (Details)**: Fully functional - name, tier selector, public toggle
- **Step 2 (Roster)**: Fully functional - job quick-select, keyboard nav, BiS import
- **Step 3 (Invite)**: Fully functional - role selector, skip option
- **Step 4 (Review)**: Fully functional - summary, roster preview, warnings
- **Submission**: Fully functional - creates group, tier, players, invitation
- **Cancel confirm**: Fully functional - warns on discard

### Key Files Reference

```
frontend/src/components/wizard/
├── SetupWizard.tsx           # Main orchestrator, state, submission flow
├── WizardProgress.tsx        # 4-step progress indicator
├── WizardNavigation.tsx      # Back/Next buttons + keyboard hint
├── RosterSlot.tsx            # Individual player slot with job picker
├── types.ts                  # WizardState, WizardPlayer interfaces
├── index.ts                  # Barrel exports
└── steps/
    ├── StaticDetailsStep.tsx # Step 1: Name + Tier + Public
    ├── RosterSetupStep.tsx   # Step 2: 8 player slots grid
    ├── InviteMembersStep.tsx # Step 3: Invite role + skip option
    └── ReviewStep.tsx        # Step 4: Summary + Create button
```

### Submission Flow Detail

```typescript
// 1. Create static group
const group = await createGroup(staticName, isPublic);

// 2. Create tier (with 8 default players)
const tier = await createTier(group.id, tierId);

// 3. Update players with wizard data
for (const wizardPlayer of players) {
  const tierPlayer = tier.players.find(p => p.position === wizardPlayer.position);
  if (tierPlayer && (wizardPlayer.name || wizardPlayer.job || wizardPlayer.bisLink)) {
    await updatePlayer(group.id, tier.id, tierPlayer.id, {
      name: wizardPlayer.name,
      job: wizardPlayer.job,
      role: getJobInfo(wizardPlayer.job)?.role,
      bisLink: wizardPlayer.bisLink,
      gear: wizardPlayer.gear,
      configured: !!(wizardPlayer.name && wizardPlayer.job),
    });
  }
}

// 4. Create invitation (if not skipped)
if (!skipInvite) {
  await createInvitation(group.id, { role: inviteRole });
}

// 5. Navigate to new static
navigate(`/group/${group.shareCode}`);
```

---

## Next Session: Session 3 - PlayerCard Action Buttons

### Tasks

1. **Create PlayerCardActions.tsx** in `/frontend/src/components/player/`
   - Accepts: player, currentUserId, userRole, isGroupOwner, handlers
   - Renders conditional buttons based on state

2. **Button visibility logic:**
   | State | Owner/Lead | Member |
   |-------|------------|--------|
   | Unclaimed | "Assign Ownership" | "Take Ownership" |
   | Claimed by me, no BiS | "Import BiS" | "Import BiS" |
   | Claimed by other | - | - |

3. **Modify PlayerCard.tsx:**
   - Add `<PlayerCardActions />` below header or in card footer
   - "Assign Ownership" opens AssignUserModal
   - "Take Ownership" calls existing onClaimPlayer
   - "Import BiS" opens BiSImportModal

4. **Use existing Button component with variants:**
   - "Assign Ownership": variant="secondary" with Link2 icon
   - "Take Ownership": variant="secondary" with UserCheck icon
   - "Import BiS": variant="secondary" with FileDown icon

5. **Add tests** in PlayerCardActions.test.tsx for visibility logic

### Files to Modify

- `components/player/PlayerCardActions.tsx` (new)
- `components/player/PlayerCardActions.test.tsx` (new)
- `components/player/PlayerCard.tsx` (add action buttons)

---

## Session 4 - MembersPanel Enhancement & Final Polish

### Tasks

1. **Modify MembersPanel.tsx:**
   - Add "Linked Card" dropdown to each member row
   - Show available cards: unclaimed OR already claimed by this member
   - On selection, call existing assign endpoint

2. **Documentation updates:**
   - Update CLAUDE.md Key Files section with new wizard components
   - Add wizard patterns to Key Implementation Patterns
   - Update OUTSTANDING_WORK.md if applicable

3. **Final testing:**
   - Run full test suite
   - Manual testing of wizard flow
