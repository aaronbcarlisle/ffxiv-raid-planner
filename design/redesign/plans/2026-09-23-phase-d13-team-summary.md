# Phase D · D13 — Team Summary on static Home (D-42)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** Restore V1's Team Summary (the retired "Summary — Team-wide gear statistics" tab) as a
module on v2's static Home, and delete the dead plain-`TeamSummary` family it supersedes.

**Architecture:** V1 renders `team/TeamSummaryEnhanced.tsx` in its Gear ▸ Summary sub-tab
(`GroupViewContent.tsx:1080-1086`). That file is V1-live, so D13 neither edits nor mounts it. v2 gets
its own `home/` pair: a pure row/total derivation (`teamSummaryRows.ts`) and a card that renders it
with v2 primitives and semantic tokens (`TeamSummaryCard.tsx`). A render-level parity test seeds the
same stores into both components and asserts identical numbers, so "restore" is demonstrated, not
asserted. Home mounts the card for members and adds the fetches it needs to its existing
membership-gated effect.

**Tech stack:** React 19 · TypeScript · Zustand 5 (`lootTrackingStore`, `staticCharacterStore`,
`tierStore`) · Vitest + Testing Library · Tailwind 4 semantic tokens.

**Spec (binding):**
- `design/redesign/specs/phase-d-loot-plan.md:202` (D13 row), `§2.7`, `§5` row "D13's Team Summary
  reference" (default: `TeamSummaryEnhanced`; `SummaryPanel` deleted).
- `design/redesign/specs/v1-v2-parity-matrix.md:268` — **D-42 RESTORE**: per-player gear %, books
  I–IV and materials T/G/S as current/needed, Main/Alt/Sub chips, aggregate stat cards, Team Total
  footer, "Mains only" filter, mobile collapse, legend, empty state. `:477,480,482` — D-59, D-62, D-64
  are **covered by D-42**: this card is Home's single per-player readout.
- `design/redesign/specs/systems-flow-map.md:124,220` — **F-08**: Team Summary is a Home module.
- **Not D13:** R-40's `FairnessSummary` → Home, and the D-42 write-back (both D14).

**Plan-vet:** `xivrp-director` 2026-09-23 → READY-WITH-FIXES (4 Major, 8 Minor), all folded in below.
The first draft's stat-tile fold was withdrawn: D-42 lists the tiles and no ruling allows dropping
them.

---

## Rulings (bind every task)

| ID | Ruling | Why | Cost if wrong |
|---|---|---|---|
| R-D13-A | The **behaviour reference is `TeamSummaryEnhanced`**. The plain `team/TeamSummary.tsx` is not a reference and is deleted along with its only mount, `loot/SummaryPanel.tsx` | D-42's row describes the Enhanced table, and it is what V1 renders (§5's default) | None found: the plain component has no live mount |
| R-D13-B | **v2-owned card, not a mount of `TeamSummaryEnhanced`.** Reuse read-only: `calculatePlayerCompletion`, `calculatePlayerBooks`, `calculatePlayerMaterials`, `sortPlayersByRole` (`utils/calculations.ts`) and `playerHasMainRole` (`utils/staticCharacterContextService.ts`) | The V1 file is frozen and breaks the design system (raw `<button>`, `text-[10px]`, `green/blue/purple/amber-400` floors, a `purple-400` chip). `pnpm dupes` blocks transcription, so the code must be re-expressed, not copied | The two derivations drift apart. Task 2's parity test is the guard |
| R-D13-C | **Placement:** Home's `TwoRegionDashboard` **main** column, directly below `RoleBisCard` | The per-player readout sits beside the per-role one. The side column stays free for D14's `FairnessSummary`, which R-40 puts "beside" it | A visual call; it goes on the holistic-review list. Moving it is a one-line change |
| R-D13-D | **The four aggregate tiles are restored** (Players `n/8` · BiS progress · Books collected · Materials received) over the **filtered** rows, with one label change: V1's "BiS Progress" becomes **"Avg BiS progress"** | D-42 lists them. The hero's `RosterReadinessCard` "% BiS" is the share of raiders who are fully BiS (`RosterReadinessCard.tsx:46,55`), while V1's tile is the mean per-player completion (`TeamSummaryEnhanced.tsx:313,451`). Two different "% BiS" figures on one page need two labels | A one-word copy change |
| R-D13-E | **Mobile collapse is deferred** to the Phase-P mobile pass (`ROLLOUT_ROADMAP.md:269-275`) | Standing ruling: mobile is one end-phase pass | Small screens show every tile, and the table scrolls sideways, until Phase P. It is disclosed at the slice-end write-back so D14's D-42 write-back cannot record "fully restored" |
| R-D13-F | **Row set and order:** `configured && !isSubstitute` (V1's `mainRosterPlayers` plus `TeamSummaryEnhanced.tsx:220`), sorted with `sortPlayersByRole(players, DEFAULT_SETTINGS.displayOrder, 'standard')` | A Home readout should not depend on the viewer's Roster sort preset | The order differs from a viewer's custom preset |
| R-D13-G | **Fetches:** Home's membership-gated effect adds `fetchPageBalances(groupId, tierId)` and `fetchMaterialBalances(groupId, tierId)` to the existing `Promise.all` (one "Failed to load loot data" toast), and `fetchRegistrations(groupId)` for members, not gated on a tier (it swallows its own errors) | Home's fetch gate stays as it is. V1 never fetched registrations for this tab: its chips and "Mains only" showed only if another surface had fetched them | A fetch storm if an effect dependency is unstable. The Home tests pin the calls |
| R-D13-H | **Player rows do not link to Roster** in D13 | D-62: "identity/nav folds into existing Home design"; Home's attention rows already route to Roster | A missing convenience, additive later. On the holistic-review list |
| R-D13-I | **Dead code:** delete `loot/SummaryPanel.tsx`, its barrel line `loot/index.ts:7`, and `team/TeamSummary.tsx`. **Keep** `calculateTeamSummary` and the `TeamSummary` type | §2.1: removing a barrel export is a V1 edit and "the line goes with the file". The util and type live in V1-imported shared files and are a separate cleanup | Knip keeps flagging `calculateTeamSummary`, as it already does on `main` |
| R-D13-J | **The card is mounted for members only** (`group.userRole` truthy) | Home skips the balance fetches for non-members, so a non-member would see `0/N` stated as fact | Public-static viewers don't get the card. Revisit if Home's fetch gate ever widens |

**Release note:** internal (`internal: true`, `CURRENT_VERSION` untouched). v2 is admin-gated and no
V1-visible line changes (§2.5). It is written at the finish step, once the draft PR number exists.

**Riskiest task: Task 2** (the parity proof). Dispatch `xivrp-implementer-deep`, then run one
task-scoped review.

**Main baselines** (`c228d709`): test 3203 · lint 0 errors / 903 warnings · knip files 15 / exports
181 / types 140 / duplicate exports 24.

---

## Task 1 — Pure derivation: `home/teamSummaryRows.ts`

**Files:** create `frontend/src/components/home/teamSummaryRows.ts` and
`frontend/src/components/home/teamSummaryRows.test.ts`. Touch nothing else.

**Contract** (names are binding; later tasks import them):

```ts
export type BookKey = 'I' | 'II' | 'III' | 'IV';
export type MaterialKey = 'twine' | 'glaze' | 'solvent';
export type SummaryRoleLabel = 'main' | 'alt' | 'substitute';

export interface TeamSummaryRow {
  player: SnapshotPlayer;
  gearPercent: number;                         // calculatePlayerCompletion(player.gear, player.job)
  booksBalance: Record<BookKey, number>;       // PageBalance.bookI..bookIV, missing → 0
  booksNeeded: Record<BookKey, number>;        // calculatePlayerBooks(gear).floor1..floor4
  matsReceived: Record<MaterialKey, number>;   // MaterialBalance.twine/glaze/solvent, missing → 0
  matsNeeded: Record<MaterialKey, number>;     // calculatePlayerMaterials(gear, tomeWeapon)
}

export interface TeamSummaryTotals {
  playerCount: number;
  gearPercent: number;                         // Math.round(mean of row gearPercent); 0 when no rows
  booksBalance: Record<BookKey, number>;
  booksNeeded: Record<BookKey, number>;
  matsReceived: Record<MaterialKey, number>;
  matsNeeded: Record<MaterialKey, number>;
  booksHave: number; booksNeed: number;        // sums across I–IV (the Books tile)
  matsHave: number;  matsNeed: number;         // sums across T/G/S (the Materials tile)
}

export function buildTeamSummaryRows(
  players: SnapshotPlayer[], pageBalances: PageBalance[], materialBalances: MaterialBalance[],
): TeamSummaryRow[];
export function filterMainsOnly(
  rows: TeamSummaryRow[], registrationsByPlayer: Record<string, StaticCharacterRegistration[]>,
): TeamSummaryRow[];
export function teamSummaryTotals(rows: TeamSummaryRow[]): TeamSummaryTotals;
export function roleLabelsByPlayer(
  registrationsByPlayer: Record<string, StaticCharacterRegistration[]>,
): Record<string, SummaryRoleLabel>;
```

**Behaviour** (each bullet is at least one test):
1. `buildTeamSummaryRows` keeps only `configured && !isSubstitute` players (R-D13-F), ordered with
   `sortPlayersByRole(players, DEFAULT_SETTINGS.displayOrder, 'standard')`.
2. A player with no `PageBalance` / `MaterialBalance` entry gets zeros, never `undefined`.
3. `booksNeeded` maps `floor1..floor4` → `I..IV`; `matsNeeded` takes `twine/glaze/solvent` from
   `calculatePlayerMaterials(player.gear, player.tomeWeapon)`. Use real gear fixtures, never mocks of
   the calc utils: the numbers are the point. Give each book key and each material key a distinct
   non-zero value in at least one test, so a swapped key fails.
4. `filterMainsOnly` keeps a row iff `playerHasMainRole(row.player.id, registrationsByPlayer)`.
5. `teamSummaryTotals([])` is all zeros (no `NaN`). With rows, `gearPercent` is the rounded mean,
   `playerCount` is the row count, and the four grand sums equal their per-key sums.
6. `roleLabelsByPlayer` labels each player by its primary registration (`isPrimaryForStatic`, else the
   first). A `roleInStatic` outside main/alt/substitute, or an empty list, produces **no key**.

Re-express, don't transcribe: `TeamSummaryEnhanced.tsx:230-255` (row builder) and `:295-311` (totals)
are the likeliest jscpd clones (`.jscpd.json`: minTokens 50, minLines 5). Loop over the key arrays
rather than writing one line per key.

**Done when:** `pnpm vitest run src/components/home/teamSummaryRows.test.ts` is green, `pnpm lint`
has 0 errors, and `pnpm dupes` reports no clone involving `teamSummaryRows.ts`. Commit:
`feat(v2): D13 Task 1 — Team Summary row derivation`.

---

## Task 2 — The card: `home/TeamSummaryCard.tsx` + V1 parity test (RISKIEST)

**Files:** create `frontend/src/components/home/TeamSummaryCard.tsx`,
`frontend/src/components/home/TeamSummaryCard.test.tsx`,
`frontend/src/components/home/TeamSummaryCard.parity.test.tsx`; modify `frontend/src/components/ui/ProgressBar.tsx`
**additively** (below). Touch nothing else. Before any UI code, read `docs/UI_COMPONENTS.md` (Quick
Reference) and run `pnpm check:design-system`.

**Props:** `{ groupId: string; tierId: string | undefined }`. The card reads its own data, as
`RoleBisCard` does:
- players from `useTierPlayers()`;
- `pageBalances` / `materialBalances` from `useLootTrackingStore` **selectors**;
- the group's registrations from `useStaticCharacterStore((s) => s.registrationsByGroup[groupId]) ?? EMPTY_REGISTRATIONS`,
  where `EMPTY_REGISTRATIONS` is a **module-level constant**. Never write `?? {}` inside a selector:
  under Zustand 5 and React 19 a fresh object on every read loops the first mount (precedent
  `tierStore.ts:15,845` `EMPTY_PLAYERS`);
- tier names from `getTierById(tierId)`, imported from **`../../gamedata`** (the barrel, which is what
  `Home.test.tsx` mocks).

The card **fetches nothing** (Home owns fetching, Task 3). Every derived value comes from Task 1's
exports.

**Renders:** a `CardShell` with `title="Team Summary"` and a lucide `Users` icon.
- **`headerRight`:** a `Toggle` labelled **"Mains only"**, rendered only when the static has any
  registrations. It is local state, off by default and not persisted (V1 parity).
- **Description:** "Book and material progress for all players. Values show current balance vs.
  needed."
- **Four tiles** in a `grid grid-cols-2 lg:grid-cols-4` over `teamSummaryTotals` of the **filtered**
  rows (R-D13-D). Tiles are a small local component, since there is no shared stat-tile primitive.
  - **Players:** `{playerCount}/8`.
  - **Avg BiS progress:** `{gearPercent}%`, with a `ProgressBar`.
  - **Books collected:** `{booksHave}/{booksNeed}`.
  - **Materials received:** `{matsHave}/{matsNeed}`.
- **Table:** a `<table>` in an `overflow-x-auto` wrapper, with an sr-only `<caption>`.
  - **Columns:** Player · Gear · I · II · III · IV · T · G · S, each `<th scope="col">`.
  - **Floor headers:** `text-floor-{1..4}` plus `title={tier.floors[n]}`, and an `<abbr>` or
    `aria-label` naming the floor (precedent `LootHistoryTable.tsx:769-784`).
  - **Material headers:** `text-material-<m>`, `title={tier.upgradeMaterials.<m>}`, and the same
    `<abbr>`/`aria-label` treatment.
- **Player cell:** `JobIcon`, the name, and a `Tag variant="label"` chip, shown when
  `roleLabelsByPlayer` has the player **and "Mains only" is off**. Main is `tone="accent"`, Alt is
  `tone="info"` and Sub is `tone="muted"`.
- **Gear cell:** `{n}%` plus `<ProgressBar value={n / 100} … />` with an accessible label. Colour
  follows V1's thresholds using tokens only: 100 → `success`, ≥ 75 → `warning`, ≥ 50 → `accent`,
  and anything below → `muted`.
- **`ProgressBar` change:** add a `muted` key to `ProgressBarColor` and `COLOR_TOKEN`
  (`var(--color-text-muted)`). It is additive, and the component's only consumers are `home/*`.
- **Value cells:**
  - `needed === 0` shows a muted `-`.
  - Otherwise the cell reads `current/needed`, with the `/needed` part muted.
  - Colour: `current >= needed` → `text-status-success`, else the column's floor or material token.
- **Footer:** `<th scope="row">Team Total</th>`, then the rounded mean gear %, then every per-column
  `balance/needed` sum.
- **Legend:** `I–IV = Books (Floor 1–4)` · `T = <twine name>` · `G = <glaze name>` ·
  `S = <solvent name>` · `Green = Complete`.
- **Empty state:** decided on the **unfiltered** rows (V1 `:341`). With no configured non-sub
  players, render `EmptyStateInvite` titled "No configured players", with no action. With "Mains
  only" on and zero mains, render the table with no body rows and zero totals.
- **No tier** (`tierId` undefined, or `getTierById` returns `undefined`): render nothing.

**Design system:** no raw `<button>`/`<input>`, no hex or palette colours, nothing below `text-xs`.

**`TeamSummaryCard.test.tsx`** covers every rule above:
- the toggle appears only when registrations exist;
- the filter drops a non-main row;
- chip tones, and chips hidden under "Mains only";
- the `-` cell, and success colouring at `current >= needed`;
- tile values and footer sums;
- header `title`s come from the tier, and the legend uses the tier's material names;
- the empty state on the unfiltered rows, and the no-tier null render;
- `aria-valuenow` on a gear bar;
- **one test on the real `useStaticCharacterStore` with no registrations for the group**, which
  proves the empty-constant selector does not loop.

**`TeamSummaryCard.parity.test.tsx` is the D-42 proof.** It must fail if any number differs.

- **Setup:**
  - `vi.stubGlobal('matchMedia', …)` returning `matches: false` (V1 calls it unguarded at
    `TeamSummaryEnhanced.tsx:173-180`, and `src/test/setup.ts` has none), and clear `localStorage`.
  - Seed the **real** stores (`useLootTrackingStore.setState`, `useStaticCharacterStore.setState`,
    and the tier store as an existing tier-store test does) with one fixture: at least 4 configured
    non-sub players with mixed gear, 1 sub, 1 unconfigured, partial balances, and registrations
    covering main, alt and sub.
  - Replace V1's `fetchPageBalances` / `fetchMaterialBalances` with resolved no-ops, so its mount
    effect makes no request.
- **Render:**
  - `TeamSummaryEnhanced` in its own container, with `players` = the same `configured && !isSubstitute`
    list sorted the same way and `tierInfo` = `getTierById(tierId)`.
  - `TeamSummaryCard` in another container.
  - Query each only through `within(container)`: both render the same heading, toggle and legend.
- **Assert:**
  - The **expected row count** and **name order**, hard-coded.
  - For each player, the gear % and the seven value cells are equal across the two tables.
  - The footer rows are equal.
  - The four tile values are equal: v2's "Avg BiS progress" against V1's "BiS Progress".
  - Chip text is equal with "Mains only" off.
  - Literal anchors exist in both: a `-` cell, an incomplete `c/n` cell, a success cell, a non-zero
    book balance and a non-zero material balance.
- **Mains-only pass:** toggle "Mains only" in both tables and re-assert the rows, the footer and the
  tiles.
- Import V1's file read-only; never mock it.

**Mutation check (paste in the report):** swap `bookIII`/`bookIV` in `teamSummaryRows.ts`, run the
parity test, and paste the red line. Then revert it.

**Done when:** all three test files are green, `pnpm check:design-system:strict` passes, and
`pnpm dupes` reports no new clone involving `TeamSummaryCard.tsx` or `teamSummaryRows.ts`. Commit:
`feat(v2): D13 Task 2 — TeamSummaryCard and its V1 parity test`.

---

## Task 3 — Wire the card into Home

**Files:** modify `frontend/src/components/home/Home.tsx` and
`frontend/src/components/home/Home.test.tsx`. Touch nothing else.

1. **Mount (R-D13-C, R-D13-J):** in `TwoRegionDashboard`'s `main` column, render
   `<TeamSummaryCard groupId={group.id} tierId={tierId} />` directly below `<RoleBisCard />`, only when
   `group.userRole` is truthy.
2. **Fetch (R-D13-G):** inside the existing membership-gated effect:
   - add `fetchPageBalances(group.id, tierId)` and `fetchMaterialBalances(group.id, tierId)` to the
     `Promise.all` that already carries `fetchLootLog` + `fetchPageLedger`, so one toast covers the
     whole group;
   - add `fetchRegistrations(group.id)` under `isMember`. It is not tier-gated and swallows its own
     errors.

   Read each action with a store selector and add it to the effect's dependency array.
3. **Comments:** update `Home.tsx`'s header comment, both the layout paragraph (`:4-7`: the main
   region now holds the Team Summary) and the fetch paragraph.
4. **Test mocks (`Home.test.tsx`):**
   - `lootTrackingStore` gains the two balance actions, plus `pageBalances: []` and
     `materialBalances: []`.
   - Add a `staticCharacterStore` mock with `registrationsByGroup: {}` and `fetchRegistrations`.
   - Add `getTierById` to the `../../gamedata` mock, returning a **full** `RaidTier` (4 floors plus
     `upgradeMaterials`).
   - Add a `toastStore` mock.
5. **New cases:**
   - A member with a tier triggers all three new fetches with the right ids.
   - A non-member triggers none of them and does not render the card.
   - A member without a tier fetches registrations but not balances.
   - When **two** fetches in the group reject (a balance fetch and `fetchLootLog`), exactly **one**
     "Failed to load loot data" toast fires.
   - The "Team Summary" heading renders after "BiS progress by role" in DOM order.
   - Every existing Home test stays green.

**Done when:** `pnpm vitest run src/components/home` is green and `pnpm lint` has 0 errors. Commit:
`feat(v2): D13 Task 3 — Team Summary on static Home`.

---

## Task 4 — Delete the dead plain-`TeamSummary` family (R-D13-I)

**Files:** delete `frontend/src/components/loot/SummaryPanel.tsx` and
`frontend/src/components/team/TeamSummary.tsx`. Remove line 7
(`export { SummaryPanel } from './SummaryPanel';`) from `frontend/src/components/loot/index.ts`.
Do **not** touch `utils/calculations.ts`, `types/index.ts` or `team/TeamSummaryEnhanced.tsx`.

1. **Prove the files are dead before deleting.** Run
   `grep -rn "SummaryPanel\|team/TeamSummary'" frontend/src --include=*.ts --include=*.tsx`. The
   expected hits are exactly `loot/SummaryPanel.tsx:7,11,21,29` and `loot/index.ts:7`. Paste the
   output in the report. Any other hit → stop and report `BLOCKED`.
2. **Knip counts.** Run `pnpm deadcode` and compare its section counts with the **main baseline**
   (files 15 · exports 181 · types 140). Every section must be ≤ baseline; exports are expected to
   drop by the removed `SummaryPanel` re-export. Paste both sets of counts.
3. `pnpm build` (runs `tsc -b`) and `pnpm test` are green.

Commit: `chore(v2): D13 Task 4 — drop SummaryPanel and the plain TeamSummary`.

---

## Finish (controller)

1. **Browser pass:** Home at `/group/DEVTST?shell=v2` (dev-auth recipe in memory). Check the card, the
   "Mains only" toggle, the chip tones, and light and dark themes. Shots → `docs/redesign/pr-shots/`.
2. One `redesign-reviewer` whole-branch dispatch, then one fix wave.
3. **Slice-end write-back** (one commit):
   - `phase-d-loot-plan.md`: close `:92-94`, `:158-159`, `:241` (SummaryPanel's fate) and correct
     the stale `loot/index.ts:8` to `:7`.
   - Add "Team Summary mobile collapse" to the `ROLLOUT_ROADMAP.md` §7b Phase-P list.
   - Note the D-42 delta, so D14's write-back names the mobile collapse and the label change.
4. Internal release note, the gates, and a draft PR.
5. **Holistic-review list:** R-D13-C placement, R-D13-H row links.
