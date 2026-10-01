# ROLE-1 · Client role gating: hide what a role can't use (W0)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** a member, a viewer or an outsider never sees a lead's control, disabled or enabled. A control the server refuses for their role isn't on screen at all.
- Home, Roster, Loot and Tracking: every control a member can't use is **hidden, not disabled**. That covers the Roster toolbar, the card menu, "Add session", "Log this week's loot", catalog "Track", "Manage characters" and the books cell.
- Two controls that 403 today are fixed: Take Ownership for a signed-in non-member, and a member's own books cell.
- Leads keep every control they have today. Their missing edit-others ability (farm participant status) is delivered by S2a, by owner ruling (R-R1-11).

**Spec (binding):** `design/redesign/HOME_STRETCH.md` §6.3 W0, the **ROLE-1** row (`:373`); the audit row D-08 (`.superpowers/v2-audit/SYNTHESIS.md:203`, sources A5-10/34, A2 H-5/H-6/R-17, A4 F-S7, A6-09). Also binding:
- HS-36, self-service with attribution (`HOME_STRETCH.md:57`): members write their own facts, others need the role, viewers never. The client mirrors the server **as it is today**. Where HS-36 promises a member write the server doesn't yet allow (books), the control hides until the slice that changes the server (W4 LOOT).
- SEC-1 (`:366`, #329/#330);
- `CLAUDE.md` § UI rules ("A clickable thing must look and announce clickable") and § Product rules (roles; the backend always validates).

Owner rulings, this session (2026-10-01):
- (a) catalog "Track" hides in **both shells**, a sanctioned V1 delta with a release line (R-R1-9);
- (b) lead edit-others of farm participant status is **delivered by S2a's "Edit statuses"** (`specs/2026-09-30-s2a-progress-design.md:48`). ROLE-1 builds none of it (R-R1-11).

**Slice:** one slice, one PR. Branch `feat/w0-role1`, worktree `.claude/worktrees/guest1` (reused; no other session uses it), base `main` `6e513583`. 4 tasks, about **950 changed lines** after the vet folds (Task 4's spec runs first as the baseline), roughly 55% tests. Frontend only: no backend, no migration, no API change, so the plugin contract is untouched. The only V1-visible delta is R-R1-9.

The frontend's `node_modules` and `.npmrc` are already in place in this worktree.

**Tech stack:** React 19 · Zustand · Vitest + Testing Library · Playwright (local only, against a real backend; CI has no Playwright job).

**Plan-vet:** `xivrp-director`, 2026-10-01: CHANGES (1 Critical, 4 Important, 5 Minor). Every finding is folded below and tagged `(vet Fn)`. F1–F3 are folded as the director wrote them, so there's no re-vet. The director's OWNER-Q (F3: a read-only Characters entry for viewers and non-members) is taken as recommended, R-R1-8. The owner can override it on the PR.

**Parallel slices.** The S2a-1 stack (#348 + #349, drafts, main checkout) is backend-only (`collection_records`). No file overlaps. `releaseNotes.ts`, `HOME_STRETCH.md` and `PRODUCT_MODEL.md` are this slice's write-backs and go **last** (Finish), after merging `origin/main` again if anything has landed. Sibling slices race for the release patch number: whoever merges second renumbers.

**Tests first:** each implementer writes its task's listed tests first and shows the non-pin ones failing for the right reason before any production edit. Tests marked **(pin)** already pass on `main` and guard behaviour that must not change: run them, but don't show them failing.

## Premises checked against the code (2026-10-01, `main` `6e513583`)

Two read-only inventories of every V2 control on Home, Roster, Loot, Schedule and Tracking. Line cites are from `6e513583`; implementers re-read before editing.

**Roles on the client:**
- `pages/NewShell.tsx:66` passes `useStaticPermissions().canEdit` (owner, lead or admin access, `hooks/useStaticPermissions.ts:57`) to Home, Loot and Schedule as `canManage`.
- Roster gets `canManageRoster(userRole, isAdminAccess)` (`NewShell.tsx:95`).
- Tracking, in both shells, gets `canManageRoster(userRole).allowed`, `isViewer` and `isMember = userRole != null` (`GroupViewContent.tsx:1169-1171`).
- Admin access arrives as `userRole: 'owner'` from the API (`permissions.py:264-265`).
- There's no central "member" predicate. `useStaticPermissions` (`:56`), `Schedule.tsx:86`, `GroupViewContent.tsx:1171` and `Home.tsx:131` each define it differently. This slice adds no refactor (R-R1-12).

| Surface | Control | Where | Today | Server | Change |
|---|---|---|---|---|---|
| Home | "Log this week's loot" | `WeeklyLootSummaryCard.tsx:77-79`, wired `Home.tsx:373` `onNavigate('gear')` | everyone; lands on Priority | navigation | R-R1-1 |
| Home | Next-session empty card "Add session" | `Home.tsx:351-358` | everyone; non-members never fetch sessions (`:131-134`), so they always get it | POST schedule = lead (`authz_matrix.py:460`) | R-R1-2 |
| Home | "Import BiS" attention rows | `Home.tsx:251-269` | a row per claimed raider without BiS, for everyone (guests too: GUEST-2 kept `userId`) | own card = member, other = lead (`authz:351`, `:360`) | R-R1-3 |
| Home | Assign / Review rows; Recruiting | `Home.tsx:272`, `:297`, `:399` | hidden (`canManage`) | — | pin |
| Roster toolbar | Add player | `RosterToolbar.tsx:250-258` | **disabled** `!canManage` (`:254`) | lead (`authz:349`) | R-R1-4 |
| Roster toolbar | Reorder | `RosterToolbar.tsx:132-143`, `:234-248` | **disabled** + tooltip wrapper | lead (`tiers.py:992-1002`) | R-R1-4 |
| Roster toolbar | Cards/Board, density, sort, Light Party, subs toggles | `RosterToolbar.tsx:154-228` | everyone | view preferences, no write | keep (pin) |
| Roster card | kebab items | `useRosterCardActions.tsx:204-375`, gates `:429-431` | role-gated items **disabled** + tooltip; a member on another's card sees 10 disabled; null role sees all edit items disabled | own = member, other = lead; Mark as Sub / Duplicate / Remove = lead | R-R1-5 |
| Roster card | Take Ownership | `useRosterCardActions.tsx:284-291`; `showTake` `:440-441` (`userRole !== 'viewer'`) | a signed-in **non-member** sees it enabled, and the claim 403s | member (`authz:370-373`) | R-R1-6 |
| Roster card | "Edit Books" jump | `useRosterCardActions.tsx:236-242` (`editPermission`) | a member on their own card gets it; it jumps to a cell that 403s | page-ledger = **lead** (`authz:440`; `loot_tracking.py:720`) | R-R1-7 |
| Roster | "Manage characters" | `CharacterManageBridge.tsx:83-85`, mounted `Roster.tsx:532-541` (V2-only bridge) | everyone; guests' list request 401s; per-row Lodestone sync **disabled** + reason (`:109`, `:137`) | own = member, other = lead (`authz:584-625`) | R-R1-8 |
| Loot | toolbar, reset, log floor, grid, history, need matrix, weapons | `LootToolbar.tsx:58-100`; `Loot.tsx:1229`, `:1293`; … | hidden (`canEdit`, SEC-1 #330) | lead | pin |
| Loot | Books cell on a member's own row | `BookLedgerCard.tsx:351` (`rowCanEdit = canEdit \|\| own row`), `:363-378` | member's own row is clickable, and the write 403s | **lead** (`authz:440`) | R-R1-7 |
| Schedule | Add session, session menu, heatmap/best-times propose | `WeekNavigatorStrip.tsx:97-101`; `SessionList.tsx:303-307`, `:366-381`; … | hidden (`canManage`) | lead | pin |
| Tracking (both shells) | catalog "Track" | `SourceFarmCard.tsx:72-80` (`trackDisabled ? null : <Button>`), fed `trackDisabled={usingFallback}` by `CatalogBrowse.tsx:317`; `CollectionsHub.tsx:190-193` passes no role | members and viewers see it; the create 403s | POST collection-goals = lead (`authz:494`) | R-R1-9 |
| Tracking (both shells) | Log Drop | `RewardGoalCard.tsx:192-196` (`!isViewer`) | members see it and it works for themselves (`LogDropModal.tsx:31-32`) | member for self, lead for others (`authz:503`) | keep (R-R1-10) |
| Tracking (both shells) | Custom Goal, Make Active, goal edit/delete, drop delete, objectives | `CollectionsHub.tsx:146`, `:210`; … | hidden; drop delete matches the API | lead / own | pin |
| Tracking (both shells) | another member's participant state | `ParticipantsPanel.tsx:23` (`_canManage` unused) | leads can't edit others | lead (`collection_goals.py:619`, `authz:518`) | S2a (R-R1-11) |

**Leads are blocked nowhere else.** The inventory checked Log Drop for others (`LogDropModal.tsx:31-32`), drop delete (`DropHistoryPanel.tsx:79`), roster card edits for others (`utils/permissions.ts:86`), Board cells, weapon priorities, and Loot logging and books. Schedule RSVP and availability are self-only **on the server** (`schemas/schedule.py:115-117`, `:209-211`). The mount-farm tree has no mount (`MountFarmTab` is unused) and S2a deletes it.

## Rulings (bind every task)

- **R-R1-0 Hide, never disable, on role.** A control whose only reason to be off is the viewer's role isn't rendered. A control off for a **state** reason stays disabled with its reason: Paste with an empty clipboard, Reset Gear's "Feature not available", Track on a catalog fallback. When a hidden control leaves an empty section, wrapper or header, that goes too.
- **R-R1-1 "Log this week's loot".** With `canManage`, the label stays and the click goes to `onNavigate('gear', { lview: 'log' })` (`Loot.tsx:433`, `useGroupViewState.ts:295-327`). Everyone else gets **"View loot priority"**, which goes to `onNavigate('gear', { lview: 'priority' })`. The explicit param is needed because tab memory keeps a stale `lview` by default (`navPreferences.ts:93-94`), so a member coming from Loot ▸ Log would otherwise land on Log (vet F4). Same `Button` and variant: only the label and the target change. `WeeklyLootSummaryCard` gets a `canManage` prop, or a `label` prop; the implementer picks one and keeps the card's other props unchanged.
  - *Why: the audit's H-5. A lead's intent is the Log view; a member can only read, and Priority is what they read.*
- **R-R1-2 Next-session empty card.**
  - With `canManage`: unchanged ("Add session" → Schedule).
  - Any other role holder (member or viewer: Home's own `!!group.userRole` test, `:131`): title "No upcoming session", description "Nothing's scheduled yet. Your lead adds sessions on Schedule.", action **"View schedule"** → `onNavigate('schedule')`.
  - A non-member or guest (no role): title "Schedule is for members", description "Members see the next session and RSVP here.", no action. Their Schedule is GUEST-1's members-only card, and Home never fetched sessions for them, so "No upcoming session" would be a claim they can't know.
  - *Why: H-6. "Add session" sent members to a page with no add button.*
  - **Effective role (vet F5):** R-R1-2 and R-R1-3 read the **effective** role and user: `useStaticPermissions().userRole`, and `viewAsUser?.userId ?? user?.id` as `Roster.tsx:190-194` does. That way View As previews the right Home. The `:131` fetch gate isn't touched.
- **R-R1-3 "Import BiS" attention rows.**
  - With `canManage`: unchanged (any claimed raider without BiS, top 3).
  - Otherwise: only rows the viewer may act on, `canEditPlayer(group.userRole, p, userId, false).allowed`, which in practice is a member's own claimed card. No row for anyone else, and none for a non-member or guest.
  - The empty state's description becomes "Nothing needs you right now." for non-managers; managers keep today's copy. Its title stays.
  - *Why: a member can't import another raider's BiS, and a guest saw a to-do list for the static.*
- **R-R1-4 Roster toolbar.** "Add player" and "Reorder", with its tooltip wrapper, render only with `canManage`. The view-preference controls stay for everyone.
- **R-R1-5 Card menu.**
  - In `buildMenuItems`, an item gated by `editPermission`, `rosterPermission` or `resetPermission` is **omitted** when that permission is false, instead of `disabled` + `tooltip`.
  - State-gated disables stay (R-R1-0).
  - BiS Targets (read-only), Copy and Copy URL stay for everyone.
  - A `sectionHeader` followed by no items (or by another header, or by the end) is dropped, so the menu never shows an empty section. A `{ separator: true }` that is leading, trailing, or next to a header or another separator is dropped too (Danger Zone, `:367`; `ContextMenu.tsx:208-212`) (vet F6). The kebab button stays: Copy is always there.
  - The legacy card is untouched, since this hook is V2-only.
- **R-R1-6 Take Ownership.** `showTake` also requires `isRaidMember(userRole)`, which is new in `utils/permissions.ts`: true for `owner`, `lead` and `member`. Admin access arrives as `'owner'`. Release is unchanged.
  - *Why: a signed-in non-member saw an enabled Take that 403s.*
- **R-R1-7 Books follow the server today.** The page-ledger write is lead-only.
  - `BookLedgerCard`'s own-row path is removed: `rowCanEdit = canEdit`.
  - The "Edit Books" menu item shows only with `rosterPermission.allowed`.
  - The comment at `BookLedgerCard.tsx:~13` that cites spec §5.7 is updated to say HS-36's member books ship with W4 LOOT, which changes the server and restores both.
  - The existing test `BookLedgerCard.test.tsx:185`, which locks in the member-own-row edit, flips to assert no edit control.
  - *Cost if wrong: none for users; W4 LOOT re-adds two conditions.*
- **R-R1-8 "Manage characters".**
  - The button (and so the modal) renders only for a **signed-in** user (`!!currentUserId`), which removes the guest 401. Viewer-role members and signed-in non-members may read the list (`static_characters.py:170-180`), and V1 shows it to every role, so they keep a read-only modal (vet F3).
  - The label is **"Manage characters"** when the user can edit at least one row, and **"Characters"** when they can edit none. That's the director's OWNER-Q answered as recommended: the button never names an action the user can't take.
  - Inside the bridge's Lodestone list, a row the user can't edit shows its identity line ("Not linked" or name · server) and **no button**. The reason text goes.
  - `RosterCharacterPanel`, shared with V1, is not edited (carry C-1).
- **R-R1-9 Catalog "Track" (both shells, owner ruling 2026-10-01).**
  - `CollectionsHub` passes its `canManage` to `CatalogBrowse` (new prop), which passes `trackDisabled={usingFallback || !canManage}`. `SourceFarmCard` isn't edited.
  - `CatalogFarmRow.tsx` has no importer and isn't touched.
  - Release line: public, naming V1's page: "Members no longer see a Track button they can't use in Goals & Farms' catalog." (vet F9d)
  - The fallback catalog already hides Track (`SourceFarmCard.tsx:72`), so it is not an allowlist entry (vet F9c).
- **R-R1-10 Log Drop stays for members.** SEC-1 (9A) lets a member log their own drop, and #330 shows it on purpose (`RewardGoalCard.test.tsx:59`). The ROLE-1 row's "farm Track/Log Drop" predates SEC-1. The write-back corrects it to "Track".
- **R-R1-11 Lead edit-others → S2a (owner ruling 2026-10-01).** S2a's lead "Edit statuses" mode (spec `:48`) delivers it. `ParticipantsPanel` and the unused `upsertStateForUser` (`collectionGoalStore.ts:521`) aren't touched. The write-back records that the premises table found no other place where a lead is blocked.
- **R-R1-12 No role refactor.** One helper is added (`isRaidMember`, R-R1-6) and used where this slice needs it. Each surface keeps the role source it has today. The four "member" definitions are carry C-3.
- **R-R1-14 Seat chips on another's card (vet F1, Critical).** In V2 only, when the card isn't editable (`!canEdit`), `RosterCard` (`:793-814`) renders the seat value (position or tank seat) as a **static chip** in the same tone, not as `PositionSelector`/`TankSeatSelector`. Today they render `<button disabled>` at opacity-50 (`PositionSelector.tsx:154`, `TankSeatSelector.tsx:139`). `PositionSelector` is shared with V1 (`PlayerCardHeader.tsx:17`) and isn't edited.
- **R-R1-15 Gear data cells vs. role controls (vet F2).**
  - Gear-state circles (`RosterGearTable.tsx:450-455`) and Board cells (`GearBoard.tsx:129`, `:271`) are **read-only data**: they keep `aria-disabled`, and the tests at `RosterCard.test.tsx:454` and `:715` become pins.
  - The BiS-source trigger (`RosterGearTable.tsx:428-432`) and the tome "+" (`:393-397`) render as **static values** for a non-editor, inside `RosterGearTable` (V2-only). `BiSSourceSelector` is shared with `GearTable.tsx:17` and isn't edited.
  - The e2e sweep also runs as the member in Expanded density and in Board. Allowlist entries are **scoped selectors** (the compact pip strip at `RosterCard.tsx:1248`, disabled for every role; Board cells), never a bare `[role=checkbox]`.
- **R-R1-13 Acceptance is a sweep, not screenshots alone.** Task 4's e2e signs in as DevMember and asserts that no role-gated control (by name) is rendered on Home, Roster (toolbar + a kebab on another member's card), Loot and Tracking ▸ Farms catalog. It also asserts that no `button[disabled]` or `[aria-disabled="true"]` inside `main` is outside a short allowlist of state-disabled controls, each with a comment. An owner pin asserts the lead controls are present. The browser walk supplies the screenshots the row asks for.

## Review Focus

- **Hide vs. state (R-R1-0):** no role-gated `disabled`/tooltip pair is left on the four surfaces, and no state-gated one was removed.
- **Never over-hide:**
  - a member on their **own** card keeps BiS, Weapon Priorities, Track Tome Weapon, Flex Roles, Paste and Reset Gear;
  - a lead and the owner keep every item, everywhere;
  - admin access (View As) behaves like today.
- **Empty sections:** the kebab never ends on, or shows two adjacent, section headers.
- **Navigation:** the Home loot button lands a lead on `lview=log` and a member on Priority, with no stale `lview`.
- **V1:** the only delta is Track (R-R1-9). `PlayerCard`, `RosterCharacterPanel`, `ParticipantsPanel` and `RewardGoalCard` are byte-identical.
- **Tests:** every flipped "disabled" assertion became an absence assertion, not a deleted test.

## Task 1 — Home (`xivrp-implementer`)

**Files.** Modify `frontend/src/components/home/Home.tsx` and `components/home/WeeklyLootSummaryCard.tsx`. Extend `components/home/Home.test.tsx` and `components/home/WeeklyLootSummaryCard.test.tsx`.

1. **Tests first:**
   - `WeeklyLootSummaryCard`: the manager form → "Log this week's loot"; the non-manager form → "View loot priority"; each click calls its handler.
   - `Home` (`renderHome` defaults `canManage` to true, `Home.test.tsx:172`):
     - manager → the loot button calls `onNavigate('gear', { lview: 'log' })`; member (`canManage: false`, `userRole: 'member'`) → "View loot priority" calls `onNavigate('gear', { lview: 'priority' })` (vet F4);
     - View As (vet F5): signed in as the owner while viewing as a member → only that member's "Import BiS" row; viewing as a non-member → "Schedule is for members";
     - no sessions: manager → "Add session" **(pin, `:254`)**; member → "View schedule" calls `onNavigate('schedule')`, and no "Add session"; `userRole: null` → "Schedule is for members", no button;
     - attention rows: two claimed raiders without BiS, one the member's own → the member sees one "Import BiS" row (their own); `userRole: null` → none, and the empty state reads "Nothing needs you right now."; manager → both rows **(pin, `:294`)**;
     - **(pin)** `:304`, `:318`: the Assign and Review rows stay manage-only.
   - Show the non-pin tests failing.
2. Implement R-R1-1, R-R1-2 and R-R1-3.
3. **Gates:**
   - `pnpm -C frontend test src/components/home`, then `pnpm -C frontend test` (paste the count);
   - `pnpm -C frontend build`;
   - `pnpm -C frontend lint` (0 errors, warnings ≤ main's 809);
   - `pnpm -C frontend check:design-system:strict`.

**Acceptance:** as a member, Home shows no "Add session" and no other raider's "Import BiS". Its loot button reads "View loot priority" and lands on Priority, while a lead's lands on Log.

## Task 2 — Roster: toolbar, card menu, Take Ownership, Manage characters (RISKIEST · `xivrp-implementer-deep`)

**Files.**
- Modify `frontend/src/utils/permissions.ts` (add `isRaidMember`), `components/roster/RosterToolbar.tsx`, `hooks/useRosterCardActions.tsx`, `components/roster/CharacterManageBridge.tsx`, and `components/roster/Roster.tsx` (the bridge's mount condition only, if the gate isn't inside the bridge; the implementer picks one place).
- Extend `components/roster/RosterToolbar.test.tsx` (`:118` asserts **disabled** and becomes absence), `hooks/useRosterCardActions.test.tsx` (`:190`, `:198`, `:206`, `:256`, `:317`), `components/roster/CharacterManageBridge.test.tsx` (`:186`, `:274`), `components/roster/RosterCard.test.tsx` where it asserts disabled items (`:444`, `:460`, `:721`), `pages/NewShell.roster.test.tsx` if it asserts the toolbar, and `utils/permissions.test.ts` (or the existing permissions test file).

1. **Tests first:**
   - `isRaidMember`: owner, lead and member → true; viewer, `null` and `undefined` → false.
   - Toolbar: `canManage: false` → no "Add player" and no "Reorder" in the DOM (`queryByRole` is null), and Cards/Board, sort and density are present; **(pin)** `canManage: true` → both are present and enabled.
   - Card menu, by role and card (the hook's tests build the items):
     - member on **another's** claimed card → the full item list deep-equals BiS Targets, Copy and Copy URL with their section headers (kinds and labels); **no** disabled item; no empty section header and no leading, trailing or doubled separator (vet F6);
     - seat chips (R-R1-14): a member on another's card → no seat `button`, and the position or seat text is present; **(pin)** own card → the enabled selector; **(pin)** owner → the enabled selector;
     - gear table (R-R1-15): a member on another's card in Expanded → no `BiSSourceSelector` button and no tome "+", with the values shown as text; **(pin)** `:454` and `:715` keep `aria-disabled` on the circles;
     - member on **own** card → BiS, Weapon Priorities, Track Tome Weapon, Reset Gear, Release Ownership, Flex Roles, Copy, Copy URL and Paste are present (**pin**); Mark as Sub, Duplicate, Remove Player and **Edit Books** are absent (R-R1-7);
     - `userRole: null` (signed-in non-member) on an unclaimed card → **no** Take Ownership (R-R1-6), no edit items;
     - member on an unclaimed card when they hold no card → Take Ownership present **(pin)**;
     - **(pin)** owner and lead on any card → today's full list, enabled; admin access with `userRole: 'owner'` → the same;
     - Paste with an empty clipboard, as a member on their own card → present and **disabled** with "No player copied" (state, R-R1-0, **pin**).
   - `CharacterManageBridge` / Roster (vet F3):
     - guest (no user) → no button;
     - viewer-role and signed-in `null` → a **"Characters"** button whose modal has no button in any row;
     - member → "Manage characters"; in the modal, their own row has its sync button and another's row shows its identity line and **no** button (no disabled button anywhere in the modal);
     - **(pin)** owner → every row has an enabled button.
   - Show the non-pin tests failing.
2. Implement R-R1-4, R-R1-5, R-R1-6, R-R1-7 (the menu item), R-R1-8, R-R1-14 and R-R1-15. Also modify `components/roster/RosterCard.tsx` and `components/roster/RosterGearTable.tsx` (V2-only). `PositionSelector`, `BiSSourceSelector`, `PlayerCard*` and `GearTable` aren't edited.
3. **Mutation check (slice-loop rule 6), executed and pasted:** revert the empty-header filter alone, then the separator filter alone, and show the "member on another's card" test failing each time.
4. **Gates:**
   - `pnpm -C frontend test src/components/roster src/hooks/useRosterCardActions.test.tsx src/utils src/pages/NewShell.roster.test.tsx`, then `pnpm -C frontend test` (paste the count);
   - `pnpm -C frontend build`;
   - `pnpm -C frontend lint`;
   - `pnpm -C frontend check:design-system:strict`;
   - `pnpm -C frontend deadcode` (unchanged).

**Acceptance:** a member's Roster has no disabled toolbar control, and a kebab on another member's card has three enabled items. A signed-in non-member can't start a claim. Owners and leads see exactly today's controls.

## Task 3 — Loot books and Tracking's Track (`xivrp-implementer`)

**Files.** Modify `frontend/src/components/loot/BookLedgerCard.tsx`, `components/collections/CatalogBrowse.tsx` and `components/collections/CollectionsHub.tsx`. Extend `components/loot/BookLedgerCard.test.tsx` (`:185`). Create `components/collections/CatalogBrowse.test.tsx` (none exists), or extend `CollectionsHub`'s test if it renders the catalog.

1. **Tests first:**
   - `BookLedgerCard`: a member (`canEdit: false`) with their own row → no edit `Button` in any book cell of that row, and the values still render; **(pin)** `canEdit: true` → every row's cells are buttons.
   - `CatalogBrowse` (mock the store, as the existing collection tests do): `canManage: false` → no "Track" button on a reward chip that has no goal; `canManage: true` → "Track" present **(pin)**; `canManage: true` with the catalog fallback → no Track **(pin, state)**.
   - `CollectionsHub` passes `canManage` through: `canManage: false` on the catalog sub-view → no Track.
   - **(pin)** `RewardGoalCard.test.tsx:59`: a member still sees Log Drop (R-R1-10).
   - Show the non-pin tests failing.
2. Implement R-R1-7 (the cell and the comment) and R-R1-9.
3. **Gates:**
   - `pnpm -C frontend test src/components/loot src/components/collections`, then `pnpm -C frontend test` (paste the count);
   - `pnpm -C frontend build`;
   - `pnpm -C frontend lint`;
   - `pnpm -C frontend check:design-system:strict`.

**Acceptance:** a member's own books row reads as values, not buttons. Members and viewers see no Track in either shell's catalog, and leads and owners still do.

## Task 4 — the member sweep e2e (`xivrp-implementer`)

**Files.** Create `frontend/e2e/role-gating.spec.ts`. Use `loginAsMember` and `loginAsOwner` (`e2e/helpers/auth.ts:72-76`). Helpers aren't edited unless a step needs one.

**Order (vet F8):** this spec is written and run **first**, before Task 1, while the branch still sits at `6e513583`. That run is the baseline: paste, per surface, which checks fail on `main`. It's committed then, and re-run green after Task 3.

1. **Baseline on `main` first.** Run the new spec on the branch at `6e513583`. Paste the per-surface list of disabled and role-gated controls it finds, and which by-name checks fail, so the PR shows before and after (vet F7b).
2. The spec, on DEVTST at `?shell=v2`:
   - **member** (DevMember):
     - `tab=overview`: no "Add session" (a comment notes it's conditional: DEVTST may have an upcoming session, F7b); "View loot priority" present; no "Log this week's loot". Coming from `tab=gear&lview=log`, clicking it lands on Priority (F4);
     - `tab=roster` in Compact, **Expanded** and **Board** (R-R1-15): no seat-chip button on another's card;
     - `tab=roster`: no "Add player" and no "Reorder"; "Manage characters" **is** present (a member keeps it, R-R1-8) and its modal has no disabled button. Open the kebab on a card that isn't DevMember's: no disabled `menuitem`;
     - `tab=gear` at Log (`lview=log`): DevMember's book row is **required** (the spec claims a card first), and it has no book-cell button (F7a);
     - `tab=goals&goal=farms`, catalog view: no "Track".
   - **On each surface,** `main` holds no `button[disabled]` or `[aria-disabled="true"]` outside the allowlist (R-R1-13). Every allowlist entry has a comment naming the state that disables it.
   - **owner pin** (DevOwner): Roster has "Add player" and "Reorder" enabled; Home has "Log this week's loot"; the catalog shows "Track".
   - **legacy**: with `pinShell(page, 'legacy', …)` (`e2e/helpers/auth.ts:99`, F7c), the member's Goals & Farms catalog shows no "Track", and an **owner pin** shows it there, so a fallback catalog can't pass the check trivially (F7d).
3. Run it against real servers (§ Finish's ports) and paste the result line.
4. **Gates:**
   - `pnpm exec playwright test e2e/role-gating.spec.ts` (from `frontend/`; paste the result);
   - `pnpm -C frontend lint`;
   - `pnpm -C frontend build`.

DEVTST facts (`backend/app/routers/dev_auth.py:38-54`, `:397-470`): `/api/dev-auth/login/0` = DevOwner (owner, `is_admin`), `/login/1` = DevMember (member), `/login/2` = DevApplicant (no membership). There is no seeded lead. If DevMember holds no claimed card, the spec claims one first through the UI (Take Ownership) or the API, and says so in a comment.

**Acceptance:** the sweep passes as the member with an allowlist of state-only entries, and fails on `main` (the baseline). The owner pin passes.

## Finish (controller)

1. **Browser validation** (slice-loop §2). Use worktree servers: backend `:8021` and frontend `:5179` with `VITE_API_URL=http://localhost:8021` (5174 may be the main checkout's). Copy the DB, run `alembic upgrade head`, and kill an orphaned `vite.js` by PID.
   - Walk V2 Home, Roster (toolbar, a kebab on another's card, Manage characters), Loot (Log, books) and Tracking (catalog) as DevMember, and as DevOwner for the pin.
   - Walk the V2 Roster as DevApplicant on a share link: no Take Ownership, no Manage characters.
   - Check legacy Tracking's catalog as DevMember: no Track.
   - The member shots are the row's acceptance. Shots go to `docs/redesign/pr-shots/`.
2. **Review once** (`redesign-reviewer`), then one fix wave (slice-loop §3–4).
3. **Release notes.** `git fetch` and read the highest `RELEASES[].version` on `origin/main`. Merge `origin/main` first if anything landed. The entry is public (the V1 Track delta, plus the V2 preview's role gating); dispatch `xivrp-implementer` with `model: haiku` and the complete entry text.
4. **Write-backs (one commit):**
   - HOME_STRETCH §6.3: the ROLE-1 row → ✅ #PR, with "Track/Log Drop" corrected to "Track" (R-R1-10), the books note (R-R1-7 → W4 LOOT) and "leads get edit-others" → S2a "Edit statuses" (R-R1-11);
   - the HOME-1 row: "'Add session' gated on canManage; members get 'View schedule'" ✅ via ROLE-1 #PR, so HOME-1 keeps only `nextOccurrence` (vet F9a);
   - the W4 LOOT row: restore member own-row books and the "Edit Books" item together with the server change (R-R1-7, vet F9b);
   - `docs/PRODUCT_MODEL.md` §6.1 W0 row: add "ROLE-1 (hide role-gated controls on Home, Roster, Loot and Tracking) ✅ #PR", and HOME-1's gate part ✅.
5. `pr-checklist`, then the gates with their counts in the PR body. Then `gh pr create --draft`, mark it ready once, and merge when every check is green and every thread is resolved.

## Carried, not ROLE-1

- **C-1** Members can't register characters on their own card in "Manage characters", though the API allows it (`authz:584-607`). The panel (`RosterCharacterPanel`) is shared with V1. → W4 ROSTER (HS-36 self-service).
- **C-2** A farm's `priority_rank` / `token_count` for others has no edit UI → S2a's "Change order" (S2-8).
- **C-3** Four definitions of "member" on the client (`useStaticPermissions.ts:56`, `Schedule.tsx:86`, `GroupViewContent.tsx:1171`, `Home.tsx:131`), and an admin whose membership is "member" gets `canManage=false` on Tracking (it under-offers) → holistic review.
- **C-4** A non-member from the Finder lands on Roster (D-20) → W1.
- **C-6** `CollectionsHub.tsx:204`'s empty state ("browse the catalog to track something manually") now speaks to members who have no Track. It's shared with V1, so it's carried rather than widening ruling (a) (vet F10) → holistic review / S2a-5.
- **C-5** Whether "Needs your attention" should show at all for a non-member → holistic review (DA 15 with the Settings carry).
