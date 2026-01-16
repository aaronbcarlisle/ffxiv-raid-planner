# Session Handoff - January 16, 2026

## Branch: `feature/player-setup-banner`

## v1.0.9 Status: Setup Wizard & Player Setup Banner

### Completed Features (All Committed & Pushed)

1. **Setup Wizard** - 4-step guided static creation
   - Step 1: Static Details (name, tier, content type)
   - Step 2: Roster Setup (8 player slots with job quick-select)
   - Step 3: Share (copy share link for inviting members)
   - Step 4: Review (summary before creation)
   - Default tier pre-selected, sticky navigation, cancel confirmation

2. **PlayerSetupBanner** - Contextual setup prompts on player cards
   - Shows between header and gear table when setup incomplete
   - States: Unclaimed (Assign/Take Ownership), No BiS (Import BiS)
   - Supports View As mode for admin impersonation

3. **AssignUserModal Improvements**
   - Visual role badges (Owner/Lead/Member/Viewer/Linked) in user dropdown
   - Users already assigned to other player cards appear at bottom of list
   - Confirmation modal when reassigning user from another card

4. **BiS Removed from Wizard** - Moved to post-creation via PlayerSetupBanner
   - BiS import requires existing player records (doesn't work during creation)
   - PlayerSetupBanner prompts "Import BiS" after claiming a card

### Current State

- All changes committed and pushed to `origin/feature/player-setup-banner`
- Build passes (`pnpm build`)
- Branch is up to date with remote

---

## Outstanding Work

### Immediate Next Steps

1. **Session 4: MembersPanel Enhancement** (from SETUP_WIZARD_PLAN.md)
   - Add "Linked Card" dropdown to each member row in MembersPanel
   - Show available cards: unclaimed OR already claimed by this member
   - On selection, call existing assign endpoint
   - Pre-select if member already has a linked card

### After v1.0.9

- Phase 7: Lodestone auto-sync
- Phase 8: FFLogs integration

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `components/wizard/SetupWizard.tsx` | Main wizard orchestrator |
| `components/wizard/steps/RosterSetupStep.tsx` | Roster configuration step |
| `components/wizard/RosterSlot.tsx` | Individual player slot with job picker |
| `components/player/PlayerSetupBanner.tsx` | Setup prompts on player cards |
| `components/player/AssignUserModal.tsx` | User assignment with role badges |
| `components/player/PlayerCard.tsx` | Main player card, integrates banner |
| `components/static-group/MembersPanel.tsx` | Target for Session 4 |
| `docs/SETUP_WIZARD_PLAN.md` | Implementation plan with session status |

---

## Copy/Paste Prompt for New Session

```
Continue working on branch feature/player-setup-banner in the FFXIV Raid Planner project.

Current state:
- v1.0.9 complete: Setup Wizard & PlayerSetupBanner fully implemented
- All work committed and pushed
- User documentation updated

Next task: Session 4 from docs/SETUP_WIZARD_PLAN.md

Session 4: MembersPanel Enhancement
- Add "Linked Card" dropdown to each member row in MembersPanel
- Show available cards: unclaimed OR already claimed by this member
- On selection, call existing assign endpoint (POST .../players/{id}/assign)
- Pre-select if member already has a linked card

Key files:
- components/static-group/MembersPanel.tsx (modify)
- components/player/AssignUserModal.tsx (reference for patterns)
- stores/tierStore.ts (player data)

Run `pnpm build` to verify everything works.
```
