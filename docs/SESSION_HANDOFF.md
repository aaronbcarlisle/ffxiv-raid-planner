# Session Handoff - January 16, 2026

## Current State

**Version:** v1.0.10 (Complete)
**Branch:** `feature/start-next-week`
**Build Status:** Passing (`pnpm tsc --noEmit`)

---

## Recently Completed (v1.0.10)

### Loot Priority UX & Score Tooltips
- Weapon priority connector line styling with collapsible tie sections
- Priority score breakdown tooltips (hover to see calculation)
- Gear slot icons in Gear Priority and Who Needs It panels
- Icon Gallery developer tool (`/icon-gallery.html`)

### Week Management
- Start next week functionality with confirmation
- Revert week option with proper messaging
- Improved week selector UX

### Tooltip Audit (15+ files)
- TabNavigation, ProgressRing, GroupViewToggle
- GearSourceBadge, TankRoleSelector, PositionSelector
- PlayerCardStatus, Home, Dashboard, AdminDashboard
- LightPartyHeader, GearTable, WhoNeedsItMatrix
- SectionedLogView, PageBalancesPanel

---

## Immediate Next Step: Session 4

**Task:** MembersPanel Enhancement (from SETUP_WIZARD_PLAN.md)

Add "Linked Card" dropdown to each member row in MembersPanel:
- Show available cards: unclaimed OR already claimed by this member
- On selection, call existing assign endpoint (`POST .../players/{id}/assign`)
- Pre-select if member already has a linked card

**Key files:**
- `components/static-group/MembersPanel.tsx` (modify)
- `components/player/AssignUserModal.tsx` (reference for patterns)
- `stores/tierStore.ts` (player data)

---

## Remaining Tooltip Work (Lower Priority)

### Missing Tooltips:
- [ ] iLv display on player cards - show iLv breakdown in tooltip
- [ ] Book entry values
- [ ] Reset Dropdown and Dropdown Items
- [ ] Log > Grid/List views and By Floor/Timeline subtabs
- [ ] Log Buttons in Gear and Weapon Priority Tabs
- [ ] Roll button in Weapon Priority tab
- [ ] Assign Player/Take Ownership/Import BiS in PlayerSetupBanner
- [ ] Have and Aug checkboxes on player cards
- [ ] Tier Selector, Static Selector
- [ ] Card/List view toggles in My Statics Dashboard
- [ ] Create Static Button, G1/G2/SUB header badges

### Design System Polish:
- [ ] Tier selector styling
- [ ] Delete Tier danger indicator in Action menu
- [ ] Sort dropdown spacing issue
- [ ] Role dropdown spacing in Static Settings

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `components/wizard/SetupWizard.tsx` | Main wizard orchestrator |
| `components/player/PlayerSetupBanner.tsx` | Setup prompts on player cards |
| `components/player/AssignUserModal.tsx` | User assignment modal |
| `components/loot/LootPriorityPanel.tsx` | Priority with score tooltips |
| `components/loot/WeaponPriorityList.tsx` | Weapon priority with connector styling |
| `components/static-group/MembersPanel.tsx` | Target for Session 4 |
| `docs/SETUP_WIZARD_PLAN.md` | Implementation plan with session status |
| `docs/OUTSTANDING_WORK.md` | Full prioritized remaining work |

---

## Commands

```bash
# Build verification
pnpm tsc --noEmit
pnpm check:design-system:strict
pnpm test
pnpm build

# Backend tests
cd backend && source venv/bin/activate && pytest tests/ -q
```

---

## Copy/Paste Prompt for New Session

```
Continue working on branch feature/start-next-week in the FFXIV Raid Planner project.

Current state:
- v1.0.10 complete
- Build passes (pnpm tsc --noEmit)

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
