# V1 → V2 Affordance-Parity Matrix (Phase B deliverable)

**Status: RULED — Phase B user checkpoint completed 2026-07-26 (guided walkthrough).** Per
`ROLLOUT_ROADMAP.md` §5 step 4, the user ruled all 68 decision units in a section-by-section
walkthrough: **66 ruled** (see the **Ruling** column) and 2 initially deferred (D-67, D-68) —
**both closed same-day by the flow-map walkthrough** (`systems-flow-map.md` F-10/F-11), so **all
68 units now carry rulings**. This marked
matrix is now the **binding restoration backlog for Phases C and D**. Headline tallies:
§1 Roster feeds Phase C (D-01…D-10 all RESTORE — the expanded gear-table card returns in full);
§3 established the **History-vs-Logging split** (D-30: the weekly grid is a *logging* surface;
D-31/D-72: History becomes a single find-it table); §10/D-52 **drops the More tab** and moves
Plugin into documentation. Standing riders: the ex-D-56 mobile-access rider (restored desktop
controls must restore their phone-width access), and the §9 flow map mandate — **satisfied** by
the ruled `systems-flow-map.md`, which remains the binding Phase-D design input it produced.

---

## 0. Scope, method, and how to read this

### 0.1 Scope

**In scope:** every user-visible affordance on the **in-static surfaces** — Roster, Loot Priority,
Loot History/Books, Schedule, Settings, Goals/Tracking, Plugin, More — plus the in-static chrome
(Spine, group TopBar, ⌘K, mobile bottom nav) where it changes what is reachable.

**Out of scope — already covered:** chrome-level affordances on **non-group routes** (legacy
`Header` → AppRail + slim TopBar) are the subject of the signed `stage1-chrome-parity-matrix.md`
and are **not re-enumerated here**. Where an in-static row's destination is a non-group route, it is
noted but not re-litigated.

**Previously out of scope, now closed:** the legacy **Overview / Static Home** tab
(`StaticHomeTab`) was missing from the first five audits. A follow-up audit (`legacy-overview.md`,
O-01…O-60) closed the gap; it is ruled in **§9**. The former placeholder unit **D-51 is dissolved**.

### 0.2 Method

Six audit sources plus a code fact-check, all read in full; this matrix is a compression of them,
not a re-derivation from code:

| Source (scratchpad `phase-b/`) | Rows | Covers |
|---|---|---|
| `legacy-roster.md` | R-001…R-189 (189) | Legacy roster: PlayerCard, GearTable, InlinePlayerEdit, DnD, modals, sort, keyboard |
| `legacy-loot-history.md` | L-01…L-260 (260) + **P-01…P-19** (19) | Legacy Loot Priority, Loot Log/History, Books, Settings-Priority, loot keyboard, **permission diffs** |
| `legacy-schedule-settings-goals-plugin.md` | S-1…S-61 (61), ST-1…ST-66 (66), G-1…G-28 (28), **P-1…P-15** (15), M-1…M-15 (15) | Legacy Schedule, Settings panel, Goals/Farms, **Plugin**, More page |
| `legacy-overview.md` | **O-01…O-60 (60)** | Legacy Overview / `StaticHomeTab` — notifications, next raid, tier progress, command brief, hero panel, activity, presence grid, best-next-farm, goals/farms rail, split clears, its modals |
| `v2-inventory.md` | V2H (10), V2R (**26**), V2L (21), V2S (13), V2ST (8), V2M (13) = **91 body rows**; V2K (18) chrome; NEW-01…06 | The v2 shell as built. **Carries a correction note** (V2R-25/V2R-26 added 2026-07-26); see §11 — where this inventory is *silent* rather than positive, absence is not evidence |
| `analytics-report.md` | — | Prod usage, `railway_prod_copy` @ localhost:5433 |
| `ambiguity-factcheck.md` | Q1…Q8 | **Code-verified verdicts** closing 8 of the 10 open ambiguities (2026-07-26). Each affected row below carries the verdict inline and cites the file:line the fact-check verified |

> ⚠ **ID collision (source-level, not resolved by the sources):** the loot audit numbers its
> permission diffs **`P-01`…`P-19` (zero-padded)** while the schedule/settings audit numbers the
> **Plugin** surface **`P-1`…`P-15` (unpadded)**. This document preserves both forms verbatim and
> always qualifies them: `P-03 (loot-perm)` vs `P-3 (plugin)`. Any downstream tooling must treat
> them as two namespaces.

### 0.3 Usage data — caveats (carry these into every ruling)

Numbers below come **only** from `analytics-report.md`; nothing is estimated. Window
**2026-04-13 → 2026-07-12** (~13 weeks), **8,921 events**, **247 distinct users** of 1,389
registered (17.8%), 1,384 sessions.

1. **DNT undercount.** The collector disables itself on `doNotTrack=1`; those users are invisible.
2. **No sub-tab tracking anywhere.** `page_url` carries **zero query strings**
   (`analytics.ts:73` uses `location.pathname`), so tab data exists **only** via the
   `tab_switch` / `sidebar_switch` events. Every sub-tab split in this matrix (Who-Needs-It vs
   Gear Priority vs Weapon Priority; Grid vs List vs All Weeks; Sessions vs Availability vs
   Integrations) is **unmeasurable**.
3. **Dead workflow instrumentation.** `player_gear_changed`, `loot_logged`, `loot_deleted`,
   `modal_open`/`modal_close`, `tier_changed`, `player_update`, `tier_create` = **0 events ever**
   (dead since PR #76 — `analytics.ts:50-58` subscribes to event-bus events with only 2 live
   emitters repo-wide). **On-card gear-edit frequency is unanswerable from data**, and modal
   ranking is impossible. This is precisely the data the roadmap expected to have for Phase C.
4. **Snapshot ends 2026-07-12T14:56Z.** `AnalyticsDailyAggregate` rollups cover only
   2026-03-19 → 04-13. `ui_shell_toggle` / `banner_dismiss` = 0 as expected (instrumentation not
   in the prod build at snapshot).
5. **Error-URL corroboration is small-N and error-biased** (127 frontend error URLs carrying a
   `tab=`), usable only as a weak tie-breaker.
6. **`stats` = Team Summary — CONFIRMED.** The retired tab bar labelled its `stats` tab
   *"Summary — Team-wide gear statistics"* (`git show 67f5393^:frontend/src/components/ui/TabNavigation.tsx:27-33`).
   D-42's reading is verified, not inferred.
7. **⚠ THE TWO NAVIGATION EVENTS ARE TWO ERAS OF THE *LEGACY* SHELL — NEVER A LEGACY-vs-V2
   COMPARISON.** Verified by git archaeology (director sweep 2026-07-26):
   - **`tab_switch`** (`players / loot / history / stats / schedule / home / mount-farms`) comes
     from the **pre-#144 legacy tab bar** (`TabNavigation.tsx`, **unmounted** from GroupView in
     PR #144 on 2026-06-26 and later relocated — not deleted — to `components/layout/` in #158
     `2ffde63`; live at HEAD with the DesignSystem showcase as its sole consumer;
     the seven keys are exactly the seven tabs listed at `TabNavigation.tsx:27-33`). It covers the
     **first ~10.5 weeks** of the window.
   - **`sidebar_switch` / `sidebar_plugin`** (`overview / roster / gear / schedule / goals / more`)
     comes from the **post-#144 legacy `SidebarNav`** (`GroupView.tsx:394`). It covers the
     **last ~2.3 weeks** only.
   - **v2 has no usage data at all.** The Spine emits `tab_switch` with `surface:'spine'` and has
     ~zero events in the window (it landed 2026-06-30, admin-gated; the snapshot ends 07-12).

   Consequences applied throughout this document: **every cross-shell ratio has been deleted or
   downgraded**; the two families are labelled *era 1* / *era 2* wherever quoted; and no row may
   argue "v2 is more/less used than legacy". Counts across eras are additionally **not
   window-normalised** (~4.5× difference), so even legacy-era-1-vs-era-2 comparisons need that
   division stated. Unaffected: single-event internal ratios such as `view_mode_change`
   (expanded vs compact), which come from one control in one shell.

### 0.4 Legend

| Term | Meaning |
|---|---|
| **KEPT** | A v2 equivalent exists and does the same job in the same or an obviously equivalent way. Recorded in the per-section KEPT ledger, **no ruling needed**. |
| **LOST** | No v2 affordance does this job. |
| **CHANGED** | The job is still doable in v2 but through a different interaction, a different location, or with a materially different scope. **Where equivalence is arguable, the row is CHANGED, never KEPT** — the user decides. |
| **Ruling** | `restore` (rebuild it in v2) · `drop` (accept the loss, deliberately) · `redesign` (keep the capability, new form — scope defined in C/D). |
| *(annotation)* | Inside a KEPT ledger, `(…not separately evidenced…)` marks a sub-step whose v2 existence is implied by a shared component but not individually listed in `v2-inventory.md`. Verify at implementation; not a ruling. |

**68 active decision units — 31 LOST · 37 CHANGED.** 72 D-IDs have been issued (D-01…D-72);
**four are tombstoned** and retained so earlier review references stay resolvable:

| Tombstone | Why | Where its rows went |
|---|---|---|
| **D-21** | v2's zero-tier state verified to exist (fact-check Q4) | §1.K KEPT |
| **D-51** | Overview coverage gap closed by the follow-up audit | replaced by D-57…D-71 |
| **D-53** | all six shortcuts verified to fire under v2 **with live targets** | §1.K KEPT |
| **D-56** | resets verified re-homed to V2L-05; nothing independently rulable remains | R-017 → §1.K · L-08/09/10 + P-15 (loot-perm) → §3.K + a **dependent rider** on D-01/D-06/D-07/D-23 *(rider SUPERSEDED 2026-07-26: all mobile work consolidated into one end-phase mobile pass — see phase-c-roster-plan.md §1 riders)* |

D-37 is mixed (LOST for its edit path, CHANGED for its create path; counted LOST). **Re-classified
by verification:** D-12 CHANGED → LOST; D-07 LOST → CHANGED. **Split for rulability:** D-31 → D-31 +
D-72 · D-66 → D-66 + D-70 · D-67 → D-67 + D-71. IDs are never re-used or renumbered.

---

## 1. Roster

> **Usage — both figures are LEGACY** (caveat 7; v2 has no data). **Legacy era 1** (`tab_switch`,
> ~10.5 wks): **players 540 events / 91 users** — #1 of seven tabs. **Legacy era 2**
> (`sidebar_switch`, ~2.3 wks): **roster 125 / 29** — #2 of six. Both describe the same legacy
> roster under two navigation chromes.
>
> **`view_mode_change`: expanded 203 events / 71 users vs compact 126 / 51** — this one is
> *unaffected* by the attribution correction (one control, one shell, internal ratio), which makes
> it the single most load-bearing datapoint in the matrix: the detailed card was the majority daily
> driver. Supporting: `player_configure` 225/32, `bis_import` 182/86 (preset 109 · xivgear 66 ·
> etro 7), `player_claim` 103/94. Error-URL corroboration: `tab=roster` 96 of 127. **No data on
> on-card gear editing** (caveat 3).

| D-ID | What | Class | Legacy rows | V2 today | Usage signal | Ruling |
|---|---|---|---|---|---|---|
| **D-01** | The **expanded ⇄ compact card axis** itself: two card densities, a mobile floating density FAB, re-click-to-expand-all, the `V` shortcut, and the expanded-only "active BiS target" chip. | LOST | R-014, R-015, R-023, R-065, R-066, R-087, R-165 | absent — v2 has one card density (V2R-10…V2R-17) | **expanded 203/71 vs compact 126/51** — strongest single datapoint in the matrix ⚠ *Counting note (C1, 2026-07-26): the v2 restore emits `view_mode_change` with a `shell:'v2'` field and does NOT re-emit on a re-click of the active Expanded control (legacy re-emitted on every click; v2 routes re-clicks to expand/collapse-all). v2 series will run strictly lower for identical behavior — never compare raw counts across shells.* | **RESTORE** *(restyled — Phase C centerpiece; ruled 2026-07-26)* ⚠ *C1-checkpoint amendments (2026-07-26): per-card collapse REJECTED (density = global view toggle); re-click-to-expand-all clarified as SECTION-level (expands/folds the light-party groups, cards keep their density) → ships in C6 with D-08's chevrons — ✅ **SHIPPED (C6, 2026-07-27)** via `SegmentedToggle.onReselect`: re-clicking the active **Expanded** control expands every folded section, or folds them all when everything rendered is open. Bound to Expanded only (legacy's `expandAllSignal` parity); a re-click on Compact stays inert. Fold-all acts on exactly the sections `RosterCards` renders — both follow one `visibleRosterSections` expression — so it can never fold a section the user cannot see; the mobile FAB deferred to the consolidated end-phase mobile pass.* ⚠ *C5 (2026-07-26): the expanded-only active-BiS-target chip SHIPPED — it extends the progress line's BiS block (one axis: every BiS concern on that axis) and opens the same manager as the kebab's "BiS Targets"; chip data INHERITS the modal-populated `useSharedBisStore` (no roster prefetch, no backend work — plan vet finding 7). Director-fold delta (2026-07-26): the chip is a `Tag variant="nav"` with the chevron, not legacy's ghost button — a pill that goes somewhere must look like it goes somewhere.* |
| **D-02** | **Editing and inspecting gear on the card**: click-to-cycle each slot (2-state raid/crafted/base-tome, 3-state augmented-tome), hover item card with stats/materia/equipped-vs-BiS, the Status-column tooltip that teaches the cycle. | LOST | R-088, R-093, R-096, R-097 | **RESTORED (C2, 2026-07-26)** — the expanded card's gear table click-to-cycles through the shared state machine with `canEditGear` gating, hover item card, and header + per-circle cycle hints; compact pips carry the hover item card (inspection) but stay non-editing; Board editing (V2R-21/22) unchanged | ⚠ *Counting note (C2, 2026-07-26): `player_gear_changed` fires for the FIRST time ever as of C2 — emitted from the v2 Cards surface ONLY, payload `{slot, state, shell:'v2'}`. The Board mutates through the same shared path and deliberately does NOT emit; legacy never will. The series is v2-Cards-only with a zero pre-C2 baseline — never read it as app-wide gear-edit volume and never compare it against legacy-era series (same era-misattribution hazard as the D-01/C1 note).* | **RESTORE** *(click-to-cycle + hover inspect on the restored D-01 card; ruled 2026-07-26)* ⚠ *C2 recorded delta: the Status-column HEADER hint renders only when the circles actually cycle (legacy showed it to all roles, R-097) — deliberate appearance-matches-behavior choice.* |
| **D-03** | **Per-slot BiS-source assignment**: the R/T/C/BT selector popover (with the reset-warning confirm), the per-slot "Fix" button, and the "N slots need BiS source updates" banner that bulk-corrects them. | LOST | R-086, R-091, R-092 | **RESTORED (C3, 2026-07-26)** — the shared `BiSSourceSelector` + `BiSSourceFixBanner` leaves remount on the expanded card's gear table with legacy mutation shapes through `computeGearSlotUpdate`; read-only viewers get the disabled selector trigger (legacy parity) | no data (correctly none — source changes never emitted in either shell) | **RESTORE** *(selector + Fix + bulk banner return with the restored gear table; ruled 2026-07-26)* ⚠ *C3 recorded deltas: (1) weapon-row selector + "+" toggle deferred to C4 (static R/+T glyph until then — delivered in C4); (2) the Fix button is `Button variant="warning" size="xs"` — same warning tokens as legacy's raw button but pill geometry (~30×22, rounded-lg) vs legacy's 24px square (`IconButton` has no warning variant and forces a 44px mobile min); (3) the bulk-fix handler does NOT swallow rejections (legacy PlayerCard does, making the shared banner toast success on failure) — v2-only, banner's own failure toast now fires; (4) legacy-faithful a11y quirk carried over: a DISABLED trigger's aria-label is the permission reason, shadowing the R/T/BT/C value for viewers; (5) the trigger badge's `text-gear-X` on `bg-gear-X/20` measures ~3.0–3.5:1 in light theme and is INVISIBLE to the contrast e2e pin (axe can't parse oklab alpha tints → "incomplete") — frozen shared-leaf debt queued for a shared-leaf contrast slice (plan §2.1 C3 addendum).* |
| **D-04** | **Tome-weapon tracking**: the weapon row's "+" toggle and the tome-weapon sub-row with its own 3-state circle and material-entry jump. | CHANGED | R-094, R-095 | **RESTORED (C4, 2026-07-26)** — the shared `WeaponBiSSelector` remounts in the weapon row's BiS cell (replacing C1's static R/+T placeholder glyph) and, while pursuing, the sub-row renders with its own 3-state circle mutating `tomeWeapon.hasItem/isAugmented` through the legacy `tomeWeapon` spread (its own player field — never `computeGearSlotUpdate`); the kebab Track/Stop item (V2R-14) reads the same store field so both affordances stay in sync; the material jump rides same-route URL params (`tab=gear&lview=history&entry&entryType=material`) into `LootHistoryTable`'s self-clearing highlight | no data (correctly none — tome-weapon changes never emitted in either shell; the C2 `player_gear_changed` series covers the 11 gear-slot cycles only) | **RESTORE** *(sub-row + own progress circle + material jump; ruled 2026-07-26)* ⚠ *C4 recorded deltas: (1) **RULED on PR #191 (2026-07-26, supersedes the interim plain-activation build):** the sub-row gains the indented weapon slot icon and the material jump lives ON the icon as the C7/D-55 jump family's reference implementation — Alt+Click for mouse (a plain mouse click NEVER navigates), Enter for keyboard, AT browse-mode activation accepted via the click `detail === 0` discriminator (director F3 reconciled with the Alt-only ruling; Safari/VO is inconsistent on that signal — the durable AT route is C7's context-menu jump), and the hover cursor REFLECTS the modifier — default arrow normally, pointer only while Alt is held (a persistent hand would advertise a plain click the gate won't honor). Hand-rolled `role="link"` remains a recorded primitive deviation (`design-system-ignore` in-code: no primitive carries an Alt-gated event); (2) the jump is NOT edit-gated — navigation, not mutation, so viewers can follow the record (verified legacy parity: legacy passes `onNavigateToMaterialEntry` down with no permission branch); (3) `Roster.tsx` fetches the material log in its own mount batch — **NOT because the data was unreachable** (correction, third revision of this delta: the legacy-chrome host `GroupViewContent.tsx:321-327` fetches loot + material logs for roster/gear pageModes in BOTH shells, un-gated on slots — the "could never light" claims in the first two revisions were wrong) but as the established v2 self-sufficiency pattern: v2 surfaces own their data (Loot.tsx mount batch; Roster's pre-C4 lootLog/currentWeek batch duplicate the same host effect) so nothing breaks when the legacy chrome and its effects dissolve; the idempotent duplicate GET is accepted and pre-dates C4; (4) the sub-row's `text-gear-tome` "T" badge and the shared selector's tinted R/+ sit on alpha-tinted backgrounds → invisible to the contrast e2e pin (the C3 oklab blindspot) — same frozen shared-leaf debt, queued for the shared-leaf contrast slice; (5) the shared `WeaponBiSSelector` "+" toggle exposes neither its purpose nor its on/off state to AT (accessible name is literally "+", no `aria-pressed`; tooltip-only purpose is also touch-invisible) — legacy-identical quirk inherited by remounting the FROZEN leaf (C3's carried-over-quirk precedent), recorded as shared-leaf a11y debt riding the queued shared-leaf slice.* |
| **D-05** | **Cross-navigation out of gear into the ledgers**: Alt+Click a gear slot → its loot entry; right-click a slot → "Jump to Loot/Material Entry"; card kebab "Edit Books" → the Books panel row. | LOST | R-045, R-089, R-090, L-12, L-13, L-14 | absent — v2 deep-links run the other way only (V2L-17 "Copy link", V2R-19 `?player=`) | no data | **RESTORE** *(all three gear→ledger jumps on the restored card; ruled 2026-07-26)* ✅ **SHIPPED (C7, 2026-07-27).** All three legs live, on the ruled jump family (Alt+Click mouse · Enter keyboard · detail-0 AT · pointer cursor only while Alt is held — the C4 sub-row's shape generalised to the 11 slots). **Recorded deltas:** (a) availability and destination now come from ONE derivation (`rosterLedgerJumps.buildSlotJumpTargets`, legacy's precedence preserved verbatim from `useViewNavigation.ts:150-165`) instead of legacy's two — a slot can no longer advertise a jump that resolves to nothing, so legacy's "No loot entry found" toast has no reachable trigger and is not restored; (b) a tome-weapon material (universal tomestone, no `slotAugmented`) deliberately does NOT attach to the weapon row — the C4 sub-row owns it; (c) the slot context menu **replaces** the card's own right-click menu on the icon (legacy `stopPropagation` parity) and anchors to the icon when the keyboard context-menu key fires it with no coordinates; (d) the jump hint rides INSIDE the item hover card when the slot has item data (legacy `GearTable.tsx:184-205`), and gets its own tooltip otherwise. **The Books leg was new navigation work as the plan predicted** (premise re-verified before building): `?book={playerId}` + `BookLedgerCard`-owned anchor scroll, pulse, and self-clear — the `LootHistoryTable` `?entry=` pattern, mirrored. The two highlights are mutually exclusive by construction (each jump clears the other's param), and a `book` param that matches no row still self-clears — `BookLedgerCard` filters substitutes out, so the kebab item (shown on a substitute card, legacy parity) can land on nothing; it lands on the Books panel with no highlight rather than stranding the param in the address bar and in later copied deep links (director C7 finding 1). "Edit Books" returns to the kebab as **navigation only** — F6c's re-home of the books EDITING surface to `BookLedgerCard` stands, and legacy's item was itself only a jump (`PlayerCard.tsx:388-398`); gate = legacy's (owner/lead/admin any card, member their own). Live-verified both roles.* |
| **D-06** | **The sort-preset *control*** — the selector offering Standard / DPS First / Healer First / Custom. | LOST *(control only)* | R-009, R-035, R-160, R-161, R-162, R-163 | **⚠ CORRECTED twice — the *apply* machinery is intact; the UI *and the hydration* are gone.** v2 still runs `SORT_PRESETS` via `sortPlayersByRole` over whatever its own hook instance holds (`Roster.tsx:175-178`), and drag still writes `'custom'` (`usePlayerActions.ts:178-182`) — but the **Phase-C vet (2026-07-26) found the per-tier `sort-preset-{tierId}` hydration exists only in the legacy hosts**, so v2's own instance defaults to Standard and never receives the stored value. What v2 lacks is `SortModeSelector` (R-009) **and** the hydration. **The actual defect:** v2 silently *ignores* a stored "Healer First" preset (this row's earlier "gets that order with no way to change it" description had it inverted) | no data | **RESTORE** *(selector **+ v2-side per-tier hydration** return in the v2 roster toolbar — slice C6; ruled 2026-07-26, mechanism corrected same day by the Phase-C vet)* ✅ **RESTORED (C6, 2026-07-27):** `SortModeSelector` remounted in the v2 toolbar (shared leaf, not forked), and `useRosterSortPreset` supplies the missing hydration — it re-runs on TIER CHANGE, applies through the RAW state setter (hydration restores a preference, it must not push a URL param), and an explicit `?sort=` suppresses it so a deep link is never overwritten. ⚠ *C6 recorded deltas (2026-07-27): (1) **read** order is v2 key → legacy `sort-preset-{tierId}` → `standard`, so a preset set in the frozen shell carries INTO v2; **writes** go to `v2-sort-preset-{tierId}` only — writing legacy's key would change what the frozen shell renders next visit, a V1-visible effect with zero file diff (same call C1 made for the density key, plan §5). Continuity therefore flows legacy → v2, never back. (2) The selector gains an accessible name ("Sort players"); legacy renders it unlabelled, so the preset names alone had to say what the control did. (3) The selector is Cards-only. The Board's rows still follow the preset (it receives the same sorted players), so this is a PLACEMENT call — the Board simply carries no view controls of its own — not a claim that sorting is inert there.* ⚠ *C6 director-fold correction (2026-07-27): the "writes go to the v2 key only" claim was FALSE when first written — `Roster.tsx` passed the tierId overload to `usePlayerActions`, so every **drag-reorder** wrote `'custom'` to LEGACY's `sort-preset-{tierId}` (a V1-visible write from inside v2, pre-dating C6 but contradicting this row), and that `'custom'` never reached the v2 key, so a later visit hydrated a stale preset over the user's own ordering. Both paths now go through the same v2 wrapper; pinned by a test that drives the drag callback directly.* |
| **D-07** | **The "Separate Subs" *toggle*** — subs in their own section vs merged into the main grid (distinct from show/hide). | **CHANGED** *(was LOST — corrected)* | R-012, R-157 | **⚠ CORRECTED twice.** `RosterCards.tsx:362-364,400-403` does read `subsView` and sections/merges accordingly — but the **Phase-C vet (2026-07-26) found the `S` shortcut does NOT reach it live**: `S` mutates the GroupViewContent instance of the per-instance `useGroupViewState`, while v2's Roster reads its own instance and observes only URL changes on remount. The earlier "reachable via `S` / discoverability loss" reading (fact-check Q5) was wrong — with no live route to the state, this is a **capability loss** in v2 today | no data | **RESTORE** *(visible toolbar toggle **+ v2-side `S` binding** — slice C6; ruled 2026-07-26, liveness corrected same day by the Phase-C vet)* ✅ **RESTORED (C6, 2026-07-27):** a visible "Separate subs" toggle in the v2 toolbar, plus `useRosterViewShortcuts` — a capture-phase owner of `S` **and `G`**, calling the setters on the instance this screen actually reads. ⚠ *C6 recorded deltas (2026-07-27): (1) **Show Subs now GATES Separate Subs** — the toggle is disabled, and `S` inert, while the substitutes section is hidden. v1 lets both toggle independently, so "separate" could apply to a section that isn't rendered at all; this is a deliberate v2 behaviour rule (C1-checkpoint correction (c)), not parity. (2) `G` is owned here too even though it is D-05's axis, because an unowned `G` press under v2 is worse than inert: the frozen handler's `setGroupView` writes legacy's `group-view-groups-{id}` localStorage and the `groups` URL param, silently changing what the frozen shell renders next visit — though note v2's OWN toggle has always performed that same write (`Roster.tsx` passes `group.id`), so owning the key relocates the write rather than preventing it; the real gain is that the toggle now reaches the instance this screen reads.* ⚠ *C6 director-fold deltas (2026-07-27): (3) the gate in delta (1) is narrowed to `subsHidden && subsView` — merged substitutes render inside the main grid whatever "Show subs" says, so disabling the control there stranded the user with substitutes they had just switched off and no way back; the shortcut carries the same rule. (4) Both toggles and the grouping button carry a `Tooltip` naming their shortcut (`S` / `G`) and what the current state means — legacy taught both keys this way (`GroupViewContent.tsx:832-869`, `GroupViewToggle.tsx:13-36`) and C6 is the first slice where those keys do anything in v2, so shipping them unlabelled would have lost the affordance. (5) The grouping button carries its pressed state VISUALLY (accent fill), not just via `aria-pressed` — the two states were previously identical to sighted users.* ⚠ *INHERITED-INCONSISTENCY DEBT (recorded at PR #199 review round 2, Copilot; code change DECLINED): "Show subs" does not mean the same thing in both groupings. With substitutes MERGED (`subsView` off), the grouped view renders them inside G1/G2 regardless of `subsHidden`, while the flat view filters them out of the main grid — so the same two toggles hide substitutes in one grouping and show them in the other. This is exact legacy behaviour (`PlayerGrid.tsx:640` gates its flat grid on `subsView || subsHidden`; its grouped branch does not), inherited verbatim by the C1-era `RosterCards`, and the same function drives both shells' notion of the setting. Changing it would make v2's flat view show substitutes v1's hides — a visible cross-shell divergence in a line outside C6's restore scope — so it is queued for the holistic "revisit when whole" list. The C6 gate rationale has been narrowed accordingly: it is the GROUPED view where a disabled control would strand the user.* |
| **D-08** | **Section collapse** — per-section chevrons for G1/G2/Unassigned/Substitutes, persisted per static+tier. | LOST | R-022, R-159 | V2R-07 sections are always expanded | no data | **RESTORE** *(per-section chevrons + persistence; ruled 2026-07-26)* ✅ **RESTORED (C6, 2026-07-27):** `useRosterSections` + a chevron on every section head, persisted per static+tier. Folding drops a section's GRID only — the header and its chevron always stay reachable. Density and folding stay independent (legacy parity), so a folded group reveals its cards at whatever density is current. ⚠ *C6 recorded deltas (2026-07-27): (1) **Unassigned folds too** — v2's grouped view renders a fourth section that legacy's `CollapsedState` (`g1`/`g2`/`subs`) had no slot for. (2) v2-scoped key `v2-roster-collapse-{groupId}-{tierId}`: v2 folds start fresh rather than inheriting legacy's, the honest trade for keeping the freeze strict — a fold is a transient layout preference, not a configured setting. (3) The chevron is its own control rather than the whole header row, so the section's BiS progress bar is not swallowed into a button's accessible name. (4, director fold) Routing Unassigned through the shared section head restores its `<h3>` — legacy renders section labels as headings, and the v2 head had been using a bare span. (5, PR-#199 review) **Fold-all preserves off-screen sections**, where legacy rebuilds from `{}` in both branches (`PlayerGrid.tsx:512`): under legacy, folding Substitutes, hiding the section, then folding all silently expands it again when it returns. Expand-all still resets everything — expanding a section nobody can see has no visible effect. Deliberate divergence from the faithful port.* |
| **D-09** | **Player-card status badges** — SUB, BiS-link badge (opens xivgear/etro in a new tab, source-aware tooltip), "You", linked-user avatar+name badge, weapon-priority "+N" badge. | LOST | R-077, R-078, R-079, R-080, R-081, R-155 | **RESTORED (C5, 2026-07-26) — dissolved into the C1 one-axis homes**, not re-assembled as legacy's single strip: SUB + the "+N" weapon-priority tag join the header identity cluster; the BiS-link affordance rides the progress line (the BiS story's axis) as a real external anchor (new tab, `noopener`, source-aware tooltip + aria-label); "You"/linked-user complete the footer's claim story | no data | **RESTORE** *(full badge row on the v2 card; ruled 2026-07-26)* ⚠ *C5 recorded deltas (2026-07-26): (1) placement — one badge row → three one-axis homes (header identity cluster / progress line / footer claim story), per the C1 ruling; (2) membership-role color coding on the "You"/linked-user badges dropped — the role is named in the tooltip instead (v2 `Tag` tones); (3) the SUB tooltip copy says "static", not legacy's "raid group"; (4) badges render as constrained primitives (`Tag`/`LinkText`), never bare accent text; (5, director fold) SUB riding the header identity cluster wraps a substitute card's header to a second line at compact widths — accepted layout cost of the one-axis placement (visible in `c5-compact-owner-dark.png`, Melee Two).* ⚠ *PR-#193-review round-5 deltas (2026-07-26, Copilot — both accepted): (6) a claimed card whose `linked_user` didn't hydrate (it's optional in the API schema) now renders a generic "Claimed" tag instead of nothing — legacy left that case blank (`PlayerCardStatus:197` gates on `isLinkedToOther && linkedUser`), which v2 cannot inherit because the footer owns the ENTIRE claim story under the one-axis ruling; (7) the forked BiS-link builders test a real `^https?://` scheme where legacy tested `startsWith('http')` — legacy's check passed gearset ids like "httpfoo" straight into `href`, emitting a same-origin relative link on a `target="_blank"` anchor. Deliberate divergence from the byte-frozen fork, documented in `bisLinkMeta.ts`.* |
| **D-10** | **Card metrics beyond the number** — the completed/total **progress ring**, and the **per-slot "Now vs BiS" hover breakdown** behind the average-iLv readout. | LOST | R-074, R-075 | **⚠ CORRECTED — v2 *does* show average iLvl** on the card, under an "iLvl" label (`RosterCard.tsx:658-693` post-C5; a row the v2 inventory missed — see §11 note). Genuinely lost: R-074's `ProgressRing` and R-075's long-press/hover comparison panel (per-slot BiS iLv, equipped-vs-target two-column view). The bare number survives; the *explanation* behind it does not. **→ RESTORED (C5, 2026-07-26):** the Now-vs-BiS hover panel returns behind the iLvl readout (`NowVsBisPanel` — per-slot BiS iLv, with the equipped "Now" column when sync data covers ≥ half the slots), and the readout itself goes **equipped-first** with BiS-target fallback (legacy `PlayerCardHeader` parity — v2 previously always showed the BiS-target average) | no data | **RESTORE** *(progress ring + Now-vs-BiS hover panel; ruled 2026-07-26)* ⚠ *AMENDED at the C1 checkpoint (2026-07-26): the progress ring is DROPPED — the restored card's BiS progress bar serves in its place. The Now-vs-BiS hover breakdown still restores (C5).* ⚠ *C5 recorded deltas (2026-07-26): the panel is restyled to the v2 12px floor (legacy ran its column header at 10px), and the headline number switches from always-BiS-average to legacy's equipped-first semantics — the placeholder "—" carries no hover (nothing to explain).* ⚠ *C5 director-fold deltas (2026-07-26): (1) the legacy color discriminator RESTORED — the number renders `text-accent` when equipped-derived, default otherwise (a hover is not a visible discriminator); (2) the GearBoard row subtitle goes equipped-first through the same shared `rosterIlv` helper, so the two v2 roster views always print the same number; (3) legacy's redundant native `title` on the readout dropped — the panel says both averages.* ⚠ *INHERITED-SEMANTICS DEBT (recorded at PR #193 review round 2, Copilot; DECLINED as out of restore scope): the number both shells label "BiS target avg" is really a current-progress estimate — `calculateAverageItemLevel` deliberately ignores an imported `itemLevel` while `hasItem` is false and prices unowned slots at `currentSource` (pinned intentional in `calculations.test.ts:116-122`), so an unowned i790 slot over crafted reads i770 and the panel's per-slot deltas compare against that. This is exact legacy semantics (same fallbacks in frozen `PlayerCardHeader.getSlotItemLevel`, same label in its tooltip) and the same function drives BOTH shells' cards, the Board and the team averages — re-labeling or computing a true ownership-independent target is a both-shells product call, queued for the holistic "revisit when whole" list, not a C5 unilateral change.* ⚠ *Same debt, second face (recorded at review round 10, claude-review; code change DECLINED): the panel's ROWS and its "BiS target avg" FOOTER come from different functions — rows from legacy `PlayerCardHeader.getSlotItemLevel` (which prices an owned `crafted` BiS slot at the tier's crafted level), the footer from `calculateAverageItemLevel` (which has no `crafted` case and takes the imported `itemLevel`). So an owned crafted-BiS slot whose import differs from the tier's crafted level shows a row that disagrees with the average printed below it. Legacy pairs those exact two functions in the exact same panel (`PlayerCardHeader.tsx:30, :129, :473`), so this is v1's behavior, not a C5 regression; the restored panel keeps it rather than silently printing different numbers than v1. `NowVsBisPanel.tsx`'s docstring inherited legacy's inaccurate "mirrors calculateAverageItemLevel" comment and has been corrected to name the real source and this consequence. Resolving it = the same both-shells product call as above.* |
| **D-11** | **Card identity & personalization display** — roster title, roster note, flex-role chips, and the Lodestone character portrait with role-ring + job badge. | LOST | R-068, R-073 | **⚠ CORRECTED — R-064 (the 3px role-colour accent edge) IS present** in v2 (`RosterCard.tsx:542-546` post-C5, another inventory miss) and has been moved to §1.K. Genuinely lost: the Lodestone portrait frame (R-068) and the whole personalization display (R-073). The *editor* survives (V2R-14 "Flex Roles") — only the card-side rendering is gone. **→ REDESIGN SHIPPED (C5, 2026-07-26), LEAN:** the Lodestone portrait rides `PlayerIdentity`'s existing avatar seam on the **expanded** card (role ring + job badge come with it; `SafeAvatar` allowlist + initials fallback), and the roster title renders as a single accent line under the header (expanded only) | no data | **REDESIGN** *(identity returns selectively — e.g. portrait + title on the expanded card; per-element calls made in Phase C design; ruled 2026-07-26)* ⚠ *C5 per-element calls (2026-07-26, evidenced by the C5 PR screenshots — portrait in both `c5-expanded-owner-*.png`, roster title live in `c5-bis-target-chip-dark.png` + `c5-expanded-owner-light.png`): portrait YES (expanded only), roster title YES (expanded only), roster note NO, flex-role chips NO — both stay editor-only; the compact card is untouched.* |
| **D-12** | **Lodestone character sync** — kebab "Lodestone Sync / Re-sync" and the whole search→preview→sync→compare modal (search, mock mode, URL/ID paste, linked panel, gear preview grid, sync, overwrite warning, identity-only fallback, post-sync compare, mismatch notices). *Rider: the card's sync **status line** (R-072) survives in reduced form as V2R-17 and is accounted in §1.K — restoring the flow should restore its character/server and job-mismatch detail too.* | **LOST** *(was CHANGED — re-classified by the fact-check)* | R-041, R-132, R-133, R-134, R-135, R-136, R-137, R-138, R-139, R-140, R-141 | **✅ VERIFIED (fact-check Q3): `RosterCharacterPanel` has NO Lodestone search** — only "Link Player Hub character" (`RosterCharacterMemberCard.tsx:85-91`), "Add manual character" (`:92-101`) and a passive `CharacterSyncBadge`. The same panel is mounted by **both** shells (legacy `GroupViewContent.tsx:948`, v2 `CharacterManageBridge.tsx:31`), so V2R-06 is not a re-home. With the card kebab gone, **`LodestoneSearchModal` has no entry point anywhere in v2's in-static surfaces** | no data | **REDESIGN** *(re-home the flow into the Characters modal / Player Hub path rather than the card kebab; rider R-072 detail restores with it; ruled 2026-07-26)* ⚠ *Rider amended at the C1 checkpoint (2026-07-26): the R-072 sync-line detail returns as a REDESIGNED, leaner treatment — v1's sync block bloats the card ("too much information… we can do better in v2"); the character/server + job-mismatch information is kept, the form is new (C5).* ✅ *Rider SHIPPED in C5 (2026-07-26): the footer sync line names the character (+ sync age); server, sync provenance and the job-mismatch explanation live in the hover detail; a mismatch also keeps a visible warning glyph + warning-colored dot, so it never hides behind the hover (live in `c5-sync-mismatch-dark.png`). No sub-12px text (legacy's block ran at 11px). Director-fold refinements (2026-07-26): the line renders as TWO segments — the name truncates at crowded widths, the age never does — and the detail hover is a `LongPressTooltip` (same pattern as the iLvl panel, keeps a touch path); keyboard/AT reachability of the hover detail rides the consolidated end-phase mobile/a11y pass. PR-#193-review fix (2026-07-26, Copilot): sync STATUS keys on `lastSync` itself, not Lodestone identity — a Player Hub claim auto-links sync data with no lodestone fields (`tiers.py _auto_link_bis_from_hub`), and the line now reads "Player Hub · synced Xh ago" there instead of contradicting the equipped-first headline with "Not synced"; the job-mismatch warning fires on hub syncs too. (Legacy had the same blind spot invisibly — its sync block simply didn't render without Lodestone identity; v1 byte-frozen, debt recorded here.) The flow re-home itself remains C8.* |
| **D-13** | **PlayerSetupBanner** — the contextual banner on the card with role-specific CTA (owner/lead → "Assign Player", member → "Take Ownership", claimed-no-BiS → "Import BiS"), its hidden states, and its admin View-As re-routing. | CHANGED | R-082, R-083, R-084, R-085, R-181, R-182 | V2R-16 inline "Assign"/"Import" button inside the BiS line + V2H-05 "Needs your attention" list on Home (3 rows max per category) | `player_claim` 103 events/94 users; `bis_import` 182/86 | **KEEP V2** *(inline button + Home attention list is the v2 answer; banner not restored; ruled 2026-07-26)* |
| **D-14** | **Open-seat configure form** — the permission-denied panel, role filter chips, searchable role-grouped job dropdown for non-template slots, template quick-pick, and Escape-closes-picker-then-form semantics. | CHANGED | R-099, R-100, R-101, R-102, R-103, R-104, R-105, R-106, R-184 | V2R-08 inline form = name `Input` + `JobPicker` only; V2R-09 remove (no confirm). No denied-state panel: the card simply isn't interactive | `player_configure` 225 events/32 users | **KEEP V2** *(lean name + JobPicker form stands; legacy machinery stays gone; ruled 2026-07-26)* |
| **D-15** | **Job-change hand-off to BiS import** — legacy's 3-button confirm offers "Change Job **and Update BiS**" (opens BiSImportModal immediately). | CHANGED | R-059 | V2R-13 is a 2-option radio: keep current BiS / unlink BiS. No import hand-off | `bis_import` 182/86 | **RESTORE** *(third option "Change Job and Update BiS" → straight into import; ruled 2026-07-26)* ✅ **SHIPPED (C7, 2026-07-27).** The radio gains a third mode, "Update BiS for the new job", and the commit button names the chosen outcome — in that mode it reads legacy's exact string **"Change Job & Update BiS"** (`&`, not "and": user ruling 2026-07-27, PlayerCard.tsx:825 is the source of truth for the copy). **Recorded deltas:** (a) v2 keeps its radio + single commit button rather than legacy's three stacked buttons — same three outcomes, one axis; (b) the hand-off fires only after the mutation resolves, so a failed job change never opens an import for a job the card did not switch to — same ordering legacy had (`PlayerCard.tsx:233-245` awaits `onUpdate` first); recorded for the invariant, not as a behaviour change; (c) it reaches the import through the kebab's own opener (the C5 `getMenuAction` pattern), so no second import-modal state exists on the card; (d) the modal's old "Re-import BiS from the card menu after switching jobs" footnote is dropped — the option it pointed at is now in the dialog. Live-verified: mode selected → job committed → import modal opened; keep-mode opens nothing.* |
| **D-16** | **Per-card "Adjust Priority"** — the priority-modifier (−100…+100) editor opened from that player's kebab. | CHANGED | R-044, R-151 | V2L-06 "Adjustments" — one table for **all** players, in the Loot toolbar, combining `lootAdjustment` + `priorityModifier` | no data | **KEEP V2** *(centralized Adjustments table stands; no per-card entry; ruled 2026-07-26)* |
| **D-17** | **Roster sub-tab axis** — Members / Characters / Split Planner as peer sub-tabs (URL `rsub`), Characters kept mounted to preserve state. | CHANGED | R-007, R-185 | V2R-01 Cards ⇄ Board (URL `rview`); Characters becomes a **modal** (V2R-06); Split Planner absent (→ D-18) | no data | **KEEP V2** *(Cards ⇄ Board + Characters-as-modal stands; Split Planner entry handled by D-18; ruled 2026-07-26)* |
| **D-18** | **Split Clear Planner** — the whole surface, reachable from the roster sub-tabs and from the More page. | LOST | R-186, M-4 | **not rendered in v2** — v2 never wires `onOpenSplitPlanner` (V2M-04); explicitly the "clearest v2-dropped row" in the More-page audit | no data | **RESTORE** *(wire the existing surface into v2; entry point TBD with the flow map — the original "from More" plan is void since D-52 drops the More tab; ruled 2026-07-26, entry point amended same day)* |
| **D-19** | **Drag-reorder affordance details** — the card *header* as the grab handle, the drag ghost's fidelity, and the registered `KeyboardSensor` (focus + arrow-key reordering). | CHANGED | R-027, R-032, R-034 | **⚠ PARTLY CORRECTED — v2 does render a `DragOverlay` ghost** (`RosterCards.tsx:203-214,432`), but a **reduced one**: a `CardShell` stand-in rather than legacy's full `PlayerCard` clone (the file comment at `:201` says so). Handle: whole card in Reorder mode vs legacy's header-only. **`KeyboardSensor` VERIFIED PRESENT** — v2's `RosterCards.tsx:290` calls the same shared `useDragAndDrop` hook, whose sensor set registers `KeyboardSensor` + `sortableKeyboardCoordinates` (`useDragAndDrop.ts:58-67`); accessible reorder is intact — R-032 stays homed here as a verified-KEPT aspect of this unit. Remaining delta = ghost fidelity + handle area only | no data | **KEEP V2** *(whole-card grab + simple ghost accepted; ruled 2026-07-26)* |
| **D-20** | **Static/tier error modal** — API error with a technical-details block, "Copy" (2s confirm) and "Report Bug" → Discord. | LOST | R-005 | **⚠ CORRECTED — present in v2.** This row originally said "absent from the v2 inventory" — an inference from the inventory doc, not code. The **Phase-C vet (2026-07-26) found the full modal shipping v2-side**: `ShellContentStates.tsx:215-273` (technical-details block, 2-s Copy confirm, Report Bug → Discord), mounted v2-only at `NewShell.tsx:128` | `error_reports`: **517 rows / 78 users** (255 unhandled_rejection · 254 backend_error · 8 js_error) | **RESTORE → ⚠ CORRECTED: ALREADY SHIPPED** *(ruled 2026-07-26; same-day Phase-C vet found it already in v2 — see the V2-today cell. Treated as KEPT; the Phase-C closeout verifies it, incl. that no second modal stacks)* |
| ~~**D-21**~~ | ~~Zero-tier state — the "No Raid Tiers" panel and its "Create First Tier" CTA~~ **DISSOLVED — no ruling needed.** | ~~CHANGED~~ → **KEPT** | R-001, R-002 → moved to §1.K | **✅ VERIFIED (fact-check Q4): the v2 zero-tier state exists** — `ShellContentStates.tsx:192-203` renders a "No Raid Tiers" `EmptyState` with a "Create First Tier" CTA gated on `canEdit`, i.e. the same affordance under the same gate | *(n/a)* | — |

### 1.K — Roster KEPT ledger

| Legacy | → v2 | Note |
|---|---|---|
| **R-001, R-002 zero-tier panel + "Create First Tier"** *(ex-D-21)* | `ShellContentStates.tsx:192-203` | ✅ fact-check Q4 — same `EmptyState` + CTA, same `canEdit` gate |
| **R-164 `` ` `` / 1–4 tab shortcuts** *(ex-D-53)* | shared `useGroupViewKeyboardShortcuts` | ✅ fact-check Q5 — the hook is mounted **unconditionally** at `GroupViewContent.tsx:487` and **fires under v2**: `` ` ``=overview, 1=schedule, 2=roster, 3=goals, 4=gear (`useGroupViewKeyboardShortcuts.ts:93-97`) |
| **R-166 `G`, R-167 `S`, R-168 `Escape`, R-169 `Alt+Shift+P`, R-171 `Alt+[`/`Alt+]`, R-172 `Mod+[`/`Mod+]`** *(ex-D-53 — the whole unit dissolved)* | same hook, live v2 targets | ⚠ **CORRECTED (Phase-C vet 2026-07-26)** — the "all six fire against live targets" claim was wrong for the view-state keys: `useGroupViewState` is **per-instance** `useState`; the shortcut hook mutates the GroupViewContent instance while v2's Roster mounts its own (`Roster.tsx:122-132`) and re-reads only the URL on remount — so `G`/`S` (and `V`) do **not** reach the v2 roster live (a tab round-trip makes them *appear* to work). Still genuinely live under v2: `Escape` (`:280-284`), `Alt+Shift+P` (`:264-268`), tier cycling (`:250-261`), static cycling (`:238-249`), and the `` ` ``/1-4 tab keys (pageMode lives on the instance that drives the slots). Phase-C slices C1/C6 add v2-side bindings for `V`/`G`/`S` |
| **R-064 role-colour accent edge** *(ex-D-11)* | `RosterCard.tsx:313-318` | ✅ director sweep — present in v2; **missing from `v2-inventory.md`** (correction filed, §11 note) |
| **R-072 Lodestone sync status line** *(ex-D-12)* | V2R-17 | ✅ **RESTORED leaner (C5, 2026-07-26)**: the line names the character (+ sync age); server, provenance and the job-mismatch explanation live in the hover detail, with a visible warning glyph + dot on mismatch. Redesigned per the C1-checkpoint rider — not v1's three-line block |
| **R-017 mobile reset-data buttons** *(ex-D-56)* | V2L-05 | ✅ RE-HOMED — same six reset scopes in the History toolbar's Reset menu, `canEdit`-gated; verified to render at phone widths (`LootToolbar.tsx:39` root div carries no responsive class; `resetMenu` at `:43`) |
| R-003, R-004 admin + join-request banners | V2K-17 | Same banners via the v2 banners slot |
| R-008 Add Player | V2R-05 | Same shared `AddPlayerModal` flow |
| R-010 card-order lock ⇄ R-011 show subs | V2R-04 "Reorder", V2R-03 "Show subs" | Lock/Reorder is the same gate with inverted polarity |
| R-013 G1/G2 toggle · R-024 Unassigned · R-025 flat grid · R-026 subs section | V2R-02, V2R-07 | Grouping dropdown + party-grouped sections with aggregate BiS bars |
| R-018 `?player=` deep link · R-019 new-player scroll+pulse · R-020 30s gear poll · R-021 light-party header | V2R-19, shared `GroupViewContent` effects, V2R-07 | R-019/R-020 live in the shared host both shells render *(not separately listed in the v2 inventory)* |
| R-028, R-029, R-030, R-033 drag swap / insert / cross-group position swap / mobile disable | V2R-18 | v2 states "cross-group swap/insert" explicitly |
| R-036, R-037 right-click + kebab menus | V2R-14 | Both entry points preserved |
| R-038, R-039, R-040 Import/Update BiS · Unlink BiS · BiS Targets | V2R-14 | |
| R-042 Weapon Priorities · R-043 + R-056 + R-116/117/118 Reset Gear (3 modes) | V2R-14 | v2 kebab names all three reset modes |
| R-046…R-049 Copy / Copy URL / Paste / Duplicate; R-058 paste confirm | V2R-14, V2R-20 | *(paste confirm step not separately evidenced)* |
| R-050, R-051, R-114, R-115 Take / Release ownership | V2R-14 | |
| R-052 + R-152/153/154 Flex roles (title, note, ≤4 role chips) | V2R-14 "Flex Roles" | Editor kept; card-side *display* is D-11 |
| R-053, R-156 Mark as Sub/Main · R-055 Remove Player | V2R-14 | |
| R-054, R-060, R-061, R-107…R-113 Assign User (owner + admin scopes, dropdown, manual ID, add-to-static, reassign confirm, unassign) | V2R-14 "Assign User (owner) / (Admin)" | Same modal |
| R-057 Unlink-BiS confirm | V2R-14 | |
| R-063 highlight pulse | V2R-19 | |
| R-067 job icon → JobPicker | V2R-12 | v2 uses a dedicated "Change job" icon button instead of the job icon itself |
| R-069 name double-click edit | V2R-10 | *(pencil-icon affordance not separately evidenced)* |
| R-070, R-071 Tank-role and Position selectors | V2R-11 | Rendered inline on every v2 card |
| R-119…R-125 BiSImportModal (presets, URL + validation hint, multi-set picker, job-mismatch warning, diff list, reset-have checkbox, footer states) | reached from V2R-14 | Same modal |
| R-126, R-127 duplicate cross-references | — | Not separate controls |
| R-128…R-131 BiSTargetManagerModal (Saved / Add Preset / Paste Link / Manual) | V2R-14 "BiS Targets" | |
| R-142…R-150 WeaponPriorityModal + Grid + JobSelectorPanel (locks, drag reorder, mobile chevrons, received, remove, main-job warning, reset, add jobs) | V2R-14 "Weapon Priorities"; also V2L-13 | Same components |
| R-158 show-subs cross-ref | V2R-03 | |
| R-170 Alt+Shift+N / Alt+Shift+R · R-173 Shift+S | V2K-08 (both named in v2), Stage-1 §7 | |
| R-174…R-180 permission model (owner/lead edit-all, member own-card, viewer read-only, canManageRoster, canResetGear, claim membership, assign scope) | V2R-14 gating, V2R-22 `canEditGear` | v2's Board model is **stricter-correct** (NEW-04) |
| R-188 `WorldSelect` | — | Not a roster affordance (consumed by Characters / Settings-Discovery / Split Planner); no parity implication |
| R-189 Roster page header | `Roster.tsx:393-399` header | |

---

## 2. Loot Priority

> **Usage — both figures are LEGACY** (caveat 7; v2 has no data). **Legacy era 1** (~10.5 wks):
> **loot 514 events / 76 users** — #2 of seven. **Legacy era 2** (~2.3 wks): **gear 97 / 25** — #3
> of six. Workflow: **`loot_log` 66 events / 17 users all-time** (M9S 24 · M11S 19 · M10S 17 ·
> M12S 6; **drop 63 / book 3**), `material_log` 17/5 (solvent 7 · twine 7 · glaze 3). The
> aggregate-only window (2026-03-19→04-13) additionally recorded `loot_log` 304 and `material_log`
> 88, so logging volume is materially higher than the raw window alone suggests. **The three legacy
> priority sub-tabs cannot be ranked against each other** (caveat 2).

| D-ID | What | Class | Legacy rows | V2 today | Usage signal | Ruling |
|---|---|---|---|---|---|---|
| **D-22** | **The "Who Needs It" matrix** — legacy's *default* priority view: player × slot dot grid (click a dot to log), FREE/count column, material pie-donut cells, mobile chip cards with ×N counters, the legend, and the all/F1-F4 floor tabs that dim it. | LOST | L-30, L-37, L-38, L-39, L-40, L-41, L-42, L-43, P-03 (loot-perm) | **absent.** V2L-01 states it plainly: v2's Priority view is per-floor `FloorCard` ranked queues (V2L-08); `WhoNeedsItMatrix` is imported only by the legacy panel and does not appear in the v2 tree | loot tab 514/76; **sub-tab split unmeasurable** | **RESTORE** *(matrix returns as a v2 Priority view alongside the floor-card queues — see D-23's switcher; ruled 2026-07-26)* |
| **D-23** | **The Loot Priority sub-tab axis** — Who Needs It / Gear Priority / Weapon Priority as three peer views, with mobile swipe between them, responsive header title, and remembered sub-tab. | CHANGED | L-15, L-16, L-17, L-18, L-21, L-22 | V2L-01 replaces the axis with a single Priority view (four floor cards) ⇄ History; weapon priority becomes a collapsible bridge (→ D-27) | unmeasurable | **REDESIGN** *(no legacy sub-tab axis; Priority view gains an internal switcher — Queues ⇄ Matrix — to host the restored D-22; ruled 2026-07-26)* |
| **D-24** | **Floor selection** — F1–F4 filter pills that scope the priority list to one floor (shared `FilterBar`). | CHANGED | L-24, L-35 | V2L-08 renders **all four floors at once** as cards (4→1 order), auto-collapsing a floor once its week is fully logged | `loot_log` by fight: M9S 24 · M11S 19 · M10S 17 · M12S 6 | **REDESIGN** *(floor scoping rethought in Phase D — cards stay, scoping mechanism to be designed; ruled 2026-07-26)* |
| **D-25** | **Priority-score transparency** — the hover breakdown on every score badge (role / need / job / player / loot-adjust / drought / balance; weapon: main-job bonus / role / rank) and the "Loot history adjustments active" badge. | LOST | L-20, L-27, L-59 | absent from the v2 inventory — `PriorityRow` ranks recipients but no score-breakdown affordance is listed | no data | **RESTORE** *(score-breakdown hover + adjustments-active badge on v2 ranked rows; ruled 2026-07-26)* |
| **D-26** | **Logging from the priority list** — per-slot "Log" buttons, per-material "Log" buttons, and "+ Log Floor" (single-floor wizard). | CHANGED | L-25, L-26, L-28, L-34, P-01, P-02 (loot-perm) | V2L-09 per-row **"Assign"** → `RecipientPicker` fixed to that slot/material; V2L-12 opens the wizard **week-scoped only**. **No single-floor wizard entry exists in v2.** ⚠ **Coupled to D-30:** legacy's *other* single-floor entry is the weekly grid's floor-header "Log Floor" (L-142, inside D-30). Ruling **D-30 `drop` + D-26 `restore`** would leave single-floor logging with no home at all — decide the pair together | `loot_log` 66/17 · `material_log` 17/5 | **RESTORE** *(keep v2 per-row Assign; "+ Log Floor" single-floor wizard entry returns on each floor card — resolves the D-30 coupling; ruled 2026-07-26)* |
| **D-27** | **Weapon Priority as a top-level view** — its own sub-tab with the full role-sectioned list in the main content area. | CHANGED | L-29 | V2L-13 demotes it to a collapsible "Weapon priorities" link in the **Floor-4 card footer**, expanding the same legacy `WeaponPriorityList` | unmeasurable | **REDESIGN** *(promote to a more visible entry than the Floor-4 footer link — own card or peer entry, designed in Phase D; ruled 2026-07-26)* |
| **D-28** | **QuickLogDropModal** — week `NumberInput`, priority-labelled recipient select ("Top Priority"/"2nd"/"3rd"), "Mark X as acquired", weapon-only "Extra loot", the "This will:" action preview, and its footer. | CHANGED | L-31, L-61, L-63, L-64, L-65, L-66, L-67 | V2L-11 `RecipientPicker` (mode=assign/log/edit): scope toggle (By priority / All members / Off-spec-free), search, ranked radio rows, method (drop/tome/purchase/**book**), week, extra/free checkbox, notes, character auto-pick. **Superset in scope; no "this will:" preview, no explicit acquired checkbox evidenced** | no data (`modal_open` dead — caveat 3) | **KEEP V2 + ADDITIONS** *(RecipientPicker stands; add the "This will:" action preview + acquired visibility; rename the expandable "Details" section to "Options"; ruled 2026-07-26)* |
| **D-29** | **Loot recommendation candidates** — the ranked candidate panel inside the log modals: click-to-fill, Main/Alt/Player badges, per-candidate reasons + warnings tooltip, "already received" chip, show-more/fewer, and a high/medium/low **confidence** header. | LOST | L-62, L-68, L-69, L-70, L-71, L-72, L-178 | absent — V2L-11 has a ranked list and character auto-pick, but no reasons/warnings/confidence layer | no data | **RESTORE** *(full reasons/warnings/confidence candidate layer inside RecipientPicker; ruled 2026-07-26)* |

### 2.K — Loot Priority KEPT ledger

| Legacy | → v2 | Note |
|---|---|---|
| L-32 + L-73…L-78 QuickLogWeaponModal (week select, priority recipient w/ "(Main)", mark-acquired, via-coffer, auto-detected off-job extra) | V2L-13 log buttons open `QuickLogWeaponModal` | Same modal, reached from the bridge |
| L-33 + L-79…L-83 QuickLogMaterialModal (week, floor, recipient, Drop/Book method, gear-update + slot/tome-weapon select) | V2L-20 | Opened from a material row's Assign |
| L-36 role `FilterBar` | inside `WeaponPriorityList` | |
| L-44…L-58, L-60 WeaponPriorityList internals — role "Show:" chips + URL sync, `V` expand-all, per-section persistence, mobile flat grid, desktop role sections, character-registration badge, both empty states, RoleSection click + right-click expand-all, both card styles' roll/reroll and log buttons, tie-group expansion, received-players footer | V2L-13 mounts the **same legacy component** | ⚠ the defect `P-05 (loot-perm)` — roll/reroll is not role-gated — travels with it into v2 (accounted at §12-A6) |
| L-84…L-99 LogWeekWizard — shell + week input, stepper, Back/Next/Submit, partial-failure retry, GearStep floor tabs + include checkboxes + No-Drops/Restore-All + per-slot/per-material recipient & drop toggles, BooksStep bulk + per-floor + per-player selection, ConfirmStep summary/detail/skipped/empty | V2L-12 opens the shared `LogWeekWizard` | Wizard body identical; only the *entry points* changed (D-26) |
| L-11 wizard bottom-level mount | V2L-12 | |
| L-101 the central `canEdit` definition · P-04 weapon log gating · P-06 modals never mount for non-editors · P-07 history editing set · P-18 wizard reachability | V2L-08/09/10/12 `canEdit` cluster | Same role set |

---

## 3. Loot History / Books

> **Usage — ⚠ era-1 only, same caveat D-42 carries** (caveat 7). **Legacy era 1** (`tab_switch`,
> ~10.5 wks): **history 366 events / 70 users** — #3 of seven. **Legacy era 2 has no counterpart
> key at all**: `SidebarNav` folded History into `gear`, so the 366/70 measures a tab that stopped
> existing on 2026-06-26 and has *no* comparable successor figure in either later shell. It sizes
> historical demand for the surface; it cannot size demand today. Which of the three layouts
> (Grid / List / All Weeks) users chose is **unmeasurable** (caveat 2) — `logLayout` lived in the
> URL query string, which analytics never captured.

| D-ID | What | Class | Legacy rows | V2 today | Usage signal | Ruling |
|---|---|---|---|---|---|---|
| **D-30** | **The weekly spreadsheet grid** (`WeeklyLootGrid`) — floors × slots × materials for the scoped week: click-to-log / click-to-edit cells, per-floor header right-click menu (Log Floor / Reset floor loot / Reset floor books), floor-header "Log Floor" button, recipient badges with hover inline-delete ×, "×N" multi-entry badge → EntryPopover, per-cell hover tooltip teaching every modifier, and the loot-fairness legend. | LOST | L-108, L-141, L-142, L-143, L-144, L-145, L-146, L-147, L-148, L-149, L-150, L-151, L-152, L-153, L-154 | **absent.** v2's History is a single week-grouped list table (V2L-16); no grid, no per-cell logging, no per-floor header actions | era-1 history 366/70; layout split unmeasurable | **RESTORE, RE-HOMED** *(user ruling: history vs logging were conflated — the grid is a **logging** surface (fill empty slots), History is a record. Bring the grid back; where it lives and how it's displayed is a Phase-D design decision. Anchor ruling for the §3 History-vs-Logging split; ruled 2026-07-26)* |
| **D-31** | **All Weeks view — the cross-week TABLE** *(split: search moved to D-72)*: a whole-tier flat table with All/Gear/Materials toggle, floor chips, **sortable columns** (Week/Floor/Slot/Player/Method/Date/Type), row click-to-edit, a row context menu including "View Week N in Grid/List", stats footer and filtered-vs-empty states. | LOST | L-107, L-158, L-159, L-160, L-161, L-162, L-163, L-164, L-165, L-166 | **absent** — V2L-16 groups by week; there is no flat cross-week table and no column sorting anywhere in v2 | era-1 history 366/70; layout split unmeasurable | **RESTORE — AS THE HISTORY MODEL** *(user ruling: this IS what the History tab should be — filter/sort/find previously logged entries; lean v1's table over v2's week-grouped list, merging v2's pills. Part of the D-30 split; ruled 2026-07-26)* |
| **D-72** | **Cross-week SEARCH** *(split out of D-31 — rulable independently)*: the search box with **structured filter syntax** (`slot: player: type: floor: method: week: job:` + free text, 200 ms debounce), its `Ctrl+Shift+F` focus shortcut and clear button. "Which week did Alice get her weapon?" is answerable in legacy and not in v2. | LOST | L-155, L-156, L-157 | **absent** — but note the natural landing spot already exists: **V2L-04's Week/Player/Source filter pills** could absorb most of this without rebuilding the All-Weeks table, so D-72 can be ruled `restore` even if D-31 is ruled `drop` | no data | **RESTORE — MERGED INTO THE HISTORY TAB** *(user ruling: take the best of the structured search + v2's filter pills; History's identity = finding previously logged entries. Part of the D-30 split; ruled 2026-07-26)* |
| **D-32** | **List view** — By Floor ⇄ Timeline toggle, floor filter chips (kept mounted-but-invisible to avoid layout shift), floor-grouped sections with expand/collapse + right-click expand-all, chronological flat mode, and their persistence. | CHANGED | L-109, L-110, L-111, L-112, L-132, L-134, L-170, L-171 | V2L-16 is week-grouped only — no floor grouping, no timeline/floor axis, no section collapse. Filtering moves to Week/Player/**Source** pills (V2L-04, a v2 addition) | unmeasurable | **FOLD INTO UNIFIED TAB** *(superseded — floor filtering + chronological sort are covered by the unified History table's filters/sortable columns (D-31); no separate List view; ruled 2026-07-26)* |
| **D-33** | **The layout axis itself** — the Grid / List / All Weeks segmented control, its mobile floating equivalent, and the persisted `logLayout` (default **grid**). | LOST | L-105, L-123, L-131, L-136, L-174 | absent — v2 has exactly one history layout | unmeasurable | **REDESIGN — DISSOLVED INTO ONE TAB** *(user ruling: no three-layout switcher; a single History tab combines the best v1+v2 features (D-31/D-72), and the weekly grid re-homes as a logging surface (D-30); ruled 2026-07-26)* |
| **D-34** | **Entry row actions** — inline Copy/Edit/Delete icon buttons on each row and the right-click context menu, whose non-editor items are **"Copy URL" and "Jump to {player}"**. | CHANGED | L-127, L-168, L-169, P-09 (loot-perm) | V2L-17 kebab: Edit (loot only) / Copy link / Delete. **"Jump to {player}" is gone**; actions move from inline icons + right-click to a kebab | no data (`loot_deleted` dead) | **KEEP V2 + JUMP** *(kebab model stands; "Jump to {player}" returns as a kebab item, pairing with restored D-05; ruled 2026-07-26)* |
| **D-35** | **Free-form log entry points** — "+ Log Loot" and "+ Log Material" buttons opening a blank modal (and their Alt+L / Alt+M shortcuts), plus the toolbar "Log Week". | CHANGED | L-138, L-139, L-140 | V2L-10 "Log a drop" (free-form fight+slot) and V2L-12 "Log this week's loot" exist; **no free-form material entry point** — materials can only be logged from a floor row's Assign (V2L-09) | `material_log` 17 events/5 users | **RESTORE (MATERIAL ENTRY)** *(free-form "Log material" entry point + Alt+M returns; "Log a drop" already covers loot; ruled 2026-07-26)* |
| **D-36** | **AddLootEntryModal** (add + edit) — week/floor, floor-filtered slot select, recommendation panel, recipient select with **"Include Subs" / "Show all players"** widening checkboxes and the "No one needs this item!" hint, character selector, Drop/Book method, "also mark acquired", notes, and edit-mode recipient preservation. | CHANGED | L-175, L-176, L-177, L-179, L-180, L-181, L-182, L-183, L-184, L-185, L-186 | V2L-11 `RecipientPicker` mode=log/edit covers scope widening (By priority / All members / Off-spec-free), method (superset: drop/tome/purchase/book), week, notes, character auto-pick. **The recommendation panel does not survive (→ D-29)**; the "no one needs this" hint has no stated v2 equivalent | Phase-A item 12 already removed `disableAssign` so an empty queue is still assignable | **KEEP V2 + HINT** *(RecipientPicker stands; the "no one needs this" empty-queue hint returns; rec panel already restored via D-29; ruled 2026-07-26)* |
| **D-37** | **Material log entries — create blank and EDIT** — LogMaterialModal's week/floor, material-type button group filtered to the floor's drops, recipient + widening checkboxes, Drop/Book method, mode-dependent gear-update (universal tomestone / solvent / twine-glaze) **with edit-mode old-vs-new augmentation reconciliation**, notes. | LOST *(edit)* / CHANGED *(create)* | L-187, L-188, L-189, L-190, L-191, L-192, L-193, L-194 | Creation survives only via V2L-09 → V2L-20 (`QuickLogMaterialModal`). **V2L-17 states Edit is "loot rows only"** — a logged material entry cannot be corrected in v2, only deleted (V2L-18) and re-logged | `material_log` 17/5 (+88 in the aggregate window) | **RESTORE (EDIT)** *(material entries become editable in v2 with old-vs-new gear reconciliation; ruled 2026-07-26)* |
| **D-38** | **The Books surface's shape** — a collapsible right sidebar (persisted) with mobile Loot/Books panel tabs. | CHANGED | L-106, L-114, L-135 | V2L-15 `BookLedgerCard` — an inline card in the History view. No collapse, no sidebar, no mobile panel-tab axis | no data | **REDESIGN (PLACEMENT)** *(Books' home decided in the Phase-D history/logging redesign — books are forward-looking purchase currency, may belong with the logging side, not History; ruled 2026-07-26)* |
| **D-39** | **Books reset context menus** — right-click a book **column** → "Reset Floor N Books" (week) / "Reset All Floor N Books" (all-time); right-click a **row** → "Reset [Player]'s W{n} Books" / "Reset All [Player]'s Books". | LOST | L-117, L-118, P-14 (loot-perm) | absent — V2L-05's reset menu is week-scoped or ALL-scoped only; **no per-floor and no per-player reset** | no data | **RESTORE** *(per-floor + per-player book resets return; entry point per the D-38 placement design; ruled 2026-07-26)* |
| **D-40** | **Week stepper** — sliding 3-dot week navigator with click-to-jump, per-week status dots (loot/books/mats logged) and their tooltips, prev/next chevrons, "Go to Current Week", "Start Next Week" and "Revert Week" inline, plus the mobile stepper row. | CHANGED | L-100, L-208, L-209, L-210, L-211, L-212, L-213 | V2L-02 week-scope **dropdown pill** (date range + loot/books/mats type dots) + V2L-03 Start-next / Revert. **No stepper, no "go to current week", no chevrons**; v2 also surfaces "Week N" in the TopBar (V2K-09, desktop-only) | no data | **KEEP V2 + CHEVRONS** *(dropdown pill stands; add prev/next stepping + go-to-current affordance; ruled 2026-07-26)* |
| **D-41** | **Revert-week safety** — the pre-check that fetches the latest week and, if anything is logged, shows a **data-summary modal listing the loot/materials/books that will move**. | CHANGED | L-102, L-104, L-206, L-207 | V2L-03 uses a plain confirm ("Move the clock back…"); **no data summary is evidenced** | no data | **RESTORE** *(pre-check + data-summary modal before reverting; ruled 2026-07-26)* |
| **D-42** | **Team Summary (the "Jobs" sub-tab)** — per-player row of gear %, books I–IV, materials T/G/S with current/needed cells and Main/Alt/Sub chips; aggregate stat cards; Team Total footer; "Mains only" filter; mobile collapse; legend; empty state. | LOST | L-04, L-214, L-215, L-216, L-217, L-218, L-219, L-220 | **absent.** V2L-14 `FairnessSummary` (4 stat cards: drops this tier, most/fewest recipients, distribution, this-week count) is a *different, much smaller* artifact. Known gap D-P3-3 | **era-1 `stats` = 212 events / 59 users** — #4 of seven. ✅ **The mapping is now confirmed**, not inferred: the retired tab bar labelled it *"Summary — Team-wide gear statistics"* (`TabNavigation.tsx:27-33`). ⚠ But it is **era-1 only** — the tab was retired with the bar on 2026-06-26, so this sizes past demand, not present | **RESTORE** *(full Team Summary table returns in v2; home = D-43; ruled 2026-07-26)* |
| **D-43** | **The Gear tab's sub-tab axis** — four sub-tabs Sync / BiS / Jobs / History with URL `?sub=` + per-static localStorage. **Residue after verification (this is all that remains rulable here):** the *shape of the axis* — v2 offers two views where legacy offered four. The two missing destinations are ruled elsewhere and this row must follow them: **Jobs → D-42** (if Team Summary is restored, this row decides whether it returns as a Loot sub-view or lands somewhere else entirely) and **Sync → already safe** (PluginPage keeps its own instance, §7.K). Rule D-42 first; if D-42 is `drop`, D-43 collapses to a no-op. | CHANGED | L-01, L-02, L-03 | V2L-01 has two views (Priority ⇄ History, URL `lview`). **✅ VERIFIED (fact-check Q1) — the audits were not in conflict; there are TWO independent mount points:** `gearSubTab==='sync'` mounts `GearSyncDashboard` **inline** at `GroupViewContent.tsx:1008-1012`, and `PluginPage.tsx:85` mounts a **second, independent instance**. Since the plugin tab is unslotted, v2 keeps the PluginPage instance (§7.K) and drops only the Gear-tab one. **The ruling is therefore about the sub-tab axis, not about losing the dashboard** | tab-level only | **REDESIGN (PLACEMENT)** *(no sub-tab axis returns; restored Team Summary's home decided in Phase D — user leans Overview/Home; ruled 2026-07-26)* |
| **D-44** | **Mobile loot-log surfaces** — swipeable Loot ⇄ Books panels, the mobile loot panel (LootCountBar + Grid/List/AllWeeks), and the floating "Log Loot" / "Log Material" FABs. | CHANGED | L-120, L-122, L-124, L-172, L-173 | v2 relies on the shared mobile bottom nav (V2K-15) + the same desktop body; **no loot FABs and no Loot/Books swipe axis are evidenced** | no data | **REDESIGN** *(mobile logging ergonomics designed within the Phase-D history/logging rework — FAB or equivalent quick-log considered there; ruled 2026-07-26)* |

### 3.K — Loot History / Books KEPT ledger

| Legacy | → v2 | Note |
|---|---|---|
| **L-08, L-09, L-10 mobile reset buttons + P-15 (loot-perm) their gate** *(ex-D-56)* | V2L-05 | ✅ RE-HOMED — the three reset actions land in the History toolbar's Reset menu (same six scopes), which renders at phone widths (`LootToolbar.tsx:39,43`). P-15's legacy gate was `canManageRoster(userRole, isAdminAccess)` (`GroupViewContent.tsx:1393`) vs V2L-05's `canEdit` — the same single admin-as-member divergence documented at **§12-A11** |
| L-06 More-page → Loot History navigation | V2M-03 (`lview=history`) | Wiring differs per shell, destination equivalent |
| L-103 "Start Next Week" | V2L-03 | |
| L-113 books Week/All-Time toggle · L-133 its persistence | V2L-15 "This week / All time" `SegmentedToggle` | *(URL persistence not separately evidenced)* |
| L-115 + P-10 per-cell click-to-edit incl. the member-own-row exception · L-116 + P-11 "View book history" | V2L-15 (cell edit `canEdit` **or** own row; ledger icon) | Member-own-row exception explicitly preserved |
| L-119 + P-13 + P-19 "Mark Floor Cleared" (button + reachability) | V2L-15 "Mark floor cleared" | ✅ fact-check Q7 — capability KEPT, **gate genuinely diverges**: v2 (`BookLedgerCard.tsx:120-124`) gates on `canEdit` only; legacy (`SectionedLogView.tsx:1472`) adds `userRole !== 'member'`. `canEdit` is otherwise identically shaped (`useStaticPermissions.ts:57` vs `HistoryView.tsx:241`). Divergence is a single edge case — see §12-A11 |
| L-121 mobile books panel · L-126 books context-menu render | V2L-15 | *(mobile treatment not separately evidenced)* |
| L-125 `LootLogModals` composite · L-129 reset orchestration | V2L-18, V2L-19 | v2 splits them into per-purpose modals |
| L-128 `?entry=&entryType=` deep-link scroll+highlight | V2L-16 (2.5 s, self-clearing) | Identical behaviour |
| L-137 reset dropdown (week loot/books/data + all-time loot/books/all data) | V2L-05 + V2L-19 type-to-confirm | Same six items |
| L-195…L-198 MarkFloorClearedModal (week/floor, player checklist + select-all, notes, submit) | V2L-15 | |
| L-199…L-205 EditBookBalanceModal (current/new, delta preview, notes, save-disabled-at-zero) + PlayerLedgerModal (history table, double-click-confirm Clear History, close) + P-12 its gate | V2L-15 | |
| L-221…L-243 Settings ▸ Priority in full (mode sub-nav, permission banner, mode selector, role/job/player editors, `V` expand-all, presets, all Advanced toggles + inputs, PlayerAdjustmentsModal, sticky Save, info tooltips) + P-16, P-17 | V2ST-01 **pure reuse** — same `SettingsPanel`; also deep-openable via V2L-07 "Rules" | See §5 |
| L-244 More-page Loot History card | V2M-03 | |

---

## 4. Schedule

> **Usage — both figures are LEGACY** (caveat 7; v2 has no data). **Legacy era 1** (~10.5 wks):
> schedule **116 events / 34 users**. **Legacy era 2** (~2.3 wks): schedule **96 / 24**. The
> earlier draft read this pair as "v2 is holding its audience" — that was **wrong on both counts**
> (neither figure is v2, and the windows differ ~4.5×). Taken at face value the two legacy eras
> suggest schedule use *rose* per-week after the nav change; no v2 inference is available.
> Error-URL corroboration: `tab=schedule` 3, `tab=availability` 1 (small-N).

| D-ID | What | Class | Legacy rows | V2 today | Usage signal | Ruling |
|---|---|---|---|---|---|---|
| **D-45** | **The "Upcoming" landing view** — the whole `ScheduleUpcomingPanel`: Upcoming/Calendar switcher, clickable Next-Session card, next-3 mini-list + "View all", Recurring Series card, Discord Sync card (status, manager-clickable), Dalamud Plugin card, the empty state with its three dashboard cards + "View calendar & availability", and the bottom "Add a session" shortcut. | LOST | S-1, S-2, S-3, S-4, S-5, S-6, S-7, S-8 | **absent** — v2 opens straight onto the week navigator (V2S-01) + session list. The next-session *content* survives on Home (V2H-02), not in Schedule | era-1 schedule 116/34 · era-2 96/24 — **both legacy** (caveat 7); no v2 data | **KEEP V2** *(straight-to-sessions stands; Home carries the next-session summary; ruled 2026-07-26)* |
| **D-46** | **Schedule sub-tabs** — Sessions / Availability / Integrations with count badges ("Setup"/"View"), plus the "Next scheduled raid" banner and its "View best overlap" jump. | CHANGED | S-9, S-11 | v2 is one page: sessions + heatmap (V2S-08) + best times (V2S-10) stacked; **availability editing moves behind an "Edit week" modal** (V2S-09); **Integrations leaves Schedule entirely** → Settings ▸ Integrations (V2ST-04) / More (V2M-05) | no data | **KEEP V2** *(single stacked page + Integrations in Settings stands; ruled 2026-07-26)* |
| **D-47** | **Session density toggle** — Tiles ⇄ List, persisted to `schedule-session-view`. | LOST | S-13 | absent — V2S-02 renders one card form (`SessionRsvpCard` variants are driven by *position*, not user choice) | no data | **DROP** *(one card form stands; the toggle sunsets; ruled 2026-07-26)* |
| **D-48** | **Session card badges** — the **category** badge, the **Discord** mirror-sync / "Discord issue" badge, and the **reminder-label** badge. | CHANGED | S-15 | **⚠ CORRECTED — two of the three claimed losses were false.** `SessionRsvpCard.tsx:329-337` renders the cross-tz "your time" line (S-19 ✓) and `:297,372` the "Availability not required" banner (S-23 ✓); both moved to §4.K. What genuinely does not survive is S-15's badge row: v2 shows the recurring-summary tag but **no category, no Discord mirror/issue state, and no reminder label** — so a lead cannot tell from the card whether an event actually mirrored to Discord | no data | **RESTORE** *(all three badges return — category, Discord mirror/issue, reminder label; ruled 2026-07-26)* |
| **D-49** | **Availability recommendations beyond "propose"** — "Copy proposal to Discord" (multi-window formatted text) and the **typical-week / recurring** recommendations with their duration quick-sets and "Create recurring session". | CHANGED | S-51, S-53, S-54 | V2S-10 `BestTimesCard` covers ranked *this-week* windows + duration select + propose. **No Discord copy; no recurring-window recommendations** | no data | **RESTORE** *(Discord copy + recurring-window recommendations both return on BestTimesCard; ruled 2026-07-26)* |

### 4.K — Schedule KEPT ledger

| Legacy | → v2 | Note |
|---|---|---|
| S-10 Add Session · S-12 empty state · S-14 session render + deep-link scroll | V2S-01, V2S-04, V2S-12 | |
| S-16 Share · S-17 View occurrences · S-18 Edit/Delete · S-22 full-layout header row incl. "Copy Discord message" | V2S-03 kebab (Edit / Share / Copy for Discord / Manage occurrences / Delete) | Icon row → kebab; item set preserved |
| **S-19 cross-timezone "your time" line** *(ex-D-48)* | `SessionRsvpCard.tsx:329-337` | ✅ director sweep — present in v2 |
| **S-23 "Availability not required" banner** *(ex-D-48)* | `SessionRsvpCard.tsx:297,372` | ✅ director sweep — present in v2, same substitution for the RSVP strip |
| S-20 RSVP quick buttons · S-21 totals + attendee preview + "You:" · S-24 per-member RSVP list w/ notes | V2S-02, V2H-02 | |
| S-25, S-26 delete confirm + recurring choice | V2S-06 | ⚠ v2 cancels the **rendered** occurrence, legacy the next one (NEW-05) — deliberate v2 fix |
| S-27, S-28, S-29 OccurrenceListModal (cancel/restore, out-of-window exceptions, refresh) | V2S-07 | |
| S-30…S-41 CreateSessionModal in full (title/description, banner picker + upload + URL, Discord delivery block w/ per-offset overrides, category, content/duty, start/end + clamping, timezone, recurring, track-availability, BYDAY picker, initial RSVP, footer) | V2S-05 — same modal | Phase-A item 9 fixed BYDAY seeding |
| S-42…S-46 AvailabilityGrid (this-week ⇄ typical-week, editable/view-only badge + stats, drag-to-paint w/ optimistic rollback, time presets, hover tooltip) · S-47…S-50 QuickFillHelper + typical-week import | V2S-09 mounts the **legacy `AvailabilityGrid`** in a modal ("Task 10 stopgap") | ✅ fact-check Q6 — the modal mounts the **full** grid (`Schedule.tsx:484-501`); no mode-lock prop exists (`AvailabilityGrid.tsx:43-52`), so the typical-week toggle (`:551-568`) **and** QuickFillHelper (`:618`, this-week + `canEditAvailability`) are both reachable inside it. Despite the "Edit week" label, nothing is lost |
| S-52 "Create session from this time" | V2S-10 propose-on-click | |
| S-55…S-60 ScheduleIntegrationsPanel (Discord reminders + webhook, save/test/post, connect + claim code, connected state sync/disconnect, permission-fix flow, calendar feed copy/Google/regenerate/revoke) | V2ST-04 Integrations tab (same component, ST-61) | Reachable in v2 via Settings / More, not Schedule (→ D-46) |
| S-61 `?sessionId=` deep link | V2S-12 | v2 also scopes the week and handles recurring next-occurrence |

---

## 5. Settings

> **Usage.** Settings is a slide-out panel, not a tab — **there is no tab-level event for it**, and
> sub-tab tracking does not exist (caveat 2). Indirect signals only: `member_role_changed` 9
> events / 4 users (all → lead), `api_key_create` 7/7.

**Zero decision units.** `V2ST-01` states it explicitly: the v2 host renders the **same**
`StaticSettingsHost` / `SettingsPanel` the legacy shell uses — *"pure reuse … `StaticSettingsHost`
is unchanged."* Every settings affordance is therefore KEPT by construction; only the entry points
differ (and v2 has strictly more of them).

### 5.K — Settings KEPT ledger

| Legacy | → v2 | Note |
|---|---|---|
| ST-1 tab bar (General/Static/Priority/Goals & Farms/Recruitment/Integrations/Members), role filtering, pending-request badge, mobile swipe | V2ST-04 (same `visible(role, isAdmin)` predicate) | |
| ST-2 General ▸ "Reset tabs to default" (account-scoped) | V2ST-04 | |
| ST-3…ST-10 Static tab (name, public toggle, hide unclaimed/BiS banners, Lodestone auto-sync + interval, share-link copy, type-to-confirm Delete, role-split save) | V2ST-04; Delete also reachable from V2M-13 | |
| ST-11…ST-24 Priority tab (identical to L-221…L-243) | V2ST-04; deep-open via V2L-07 "Rules" (V2ST-06) | |
| ST-25…ST-37 Goals & Farms (sub-nav, overview cards, objectives CRUD + empty state, farms new/delete/empty, 5-step CreateCollectionGoalModal, suggestions filter/vote/promote/close/delete, SuggestContentModal, PromoteToGoalModal) | V2ST-04 "Goals & Farms" incl. its Overview/Objectives/Farms/Suggestions sub-nav | |
| ST-38…ST-50 Recruitment ▸ Overview + Listing (full DiscoveryTab: section nav, list toggle + status cards, description + quick-fill chips + vibe + world, fill-from-schedule, raid days/times/tz, recruiting role cards, languages + comms, contact, live preview + quality checklist, save) | V2ST-04 Recruitment; deep-open to Requests/Invitations via V2ST-05 | |
| ST-51…ST-56 Requests (show-resolved, review/maybe-later/decline/accept, add-to-roster, copy Discord handle, empty state, JoinRequestReviewModal) | V2ST-05 — reachable from V2H-05(c), V2M-01, V2K-10 fallback | v2 adds *more* entry points than legacy |
| ST-57…ST-60 Invitations (create form, copy link, double-click-confirm revoke, status badges) | V2ST-05 `section:'invitations'`; V2K-10 TopBar invite | |
| ST-61 Integrations tab | V2ST-04 | Same panel as S-55…S-60 |
| ST-62…ST-66 Members (role dropdown w/ lead-vs-owner rules, roster-alignment badge, remove + unlink-card sub-toggle, linked-players unlink, empty state) | V2ST-04 Members | |

---

## 6. Goals / Tracking

> **Usage — both figures are LEGACY** (caveat 7; v2 has no data). **Legacy era 1** (~10.5 wks):
> `mount-farms` **33 events / 14 users** — the least-used era-1 tab. **Legacy era 2** (~2.3 wks):
> `goals` **69 / 22** — clicks on the legacy `SidebarNav`'s Goals entry. Error-URL corroboration:
> `tab=collections` 13, `tab=goals` 2.

**Zero decision units for the surface's contents.** `GoalsPage`, `ObjectiveGoalsPanel` and
`CollectionsHub` have **no slot check** in `GroupViewContent.tsx:1140-1152` — both shells render the
identical component tree. The only Goals-adjacent regression is *reachability*, handled as a
cross-cutting row (**D-52**).

### 6.K — Goals / Tracking KEPT ledger

| Legacy | → v2 | Note |
|---|---|---|
| G-1 Objectives ⇄ Farms switcher (`?goal=`) · G-2 ObjectiveGoalsPanel (= ST-27/28) | same component, no slot | |
| G-3…G-6 Collections hub tabs (Suggested / Active / Browse) + count badge, Custom Goal, stats strip, active-tab empty state | same component | |
| G-7…G-12 RewardGoalCard (View / Log Drop / Copy Plan, progress display), RewardGoalDetailModal (edit/delete + sub-tabs), ParticipantsPanel (my-status quick-set, grouped lists), DropHistoryPanel | same component | ⚠ `G-13` LogDropModal has **no role check** — carried into v2, flagged at §12-A7 |
| G-13, G-14 LogDropModal, RewardGoalModal | same component | |
| G-15…G-19 Suggested tab (refresh, empty state), DutyFarmCard (expand + copy plan, Make Active Farm / View Farm, per-member intent list) | same component | |
| G-20…G-23 Browse Catalog (search + filter chips + fallback/retry), SourceFarmCard (expand, copy plan, per-reward Track), TrackFromCatalogModal, SmartSuggestionsPanel | same component | ⚠ `G-21`, `G-22` Track flows are **not role-gated** — carried into v2, flagged at §12-A7 |

---

## 7. Plugin

> **Usage — LEGACY** (caveat 7; v2 has no data). **Legacy era 2** (~2.3 wks): `sidebar_plugin`
> **8 events / 5 users** — clicks on the legacy `SidebarNav`'s Plugin entry; era 1 had no plugin
> tab key. `/plugin-auth` page: 25 events / 11 users. `api_key_create`: 7 / 7. Lowest-traffic
> in-static surface measured.

**Zero decision units.** `PluginPage` has no slot check (`GroupViewContent.tsx:1220-1225`) — both
shells render it identically. Reachability is **D-52**.

### 7.K — Plugin KEPT ledger

| Legacy | → v2 | Note |
|---|---|---|
| P-1 (plugin) installation steps | same component | |
| P-2…P-7 (plugin) GearSyncDashboard (sync health, BiS progress, role coverage, stale members, recent activity) | same component | ✅ fact-check Q1 — `PluginPage.tsx:85` is a **second, independent** `GearSyncDashboard` instance; the plugin tab is unslotted, so this one survives in v2 regardless of what D-43 rules for the Gear-tab instance |
| P-9…P-13 (plugin) ApiKeyManager (create + 10-key cap, name modal, one-time copy, key list + revoke, empty state) | same component (account-scoped, no static role) | |
| P-14, P-15 (plugin) `/plugin-auth` consent page (Discord sign-in, Authorize/Cancel, loopback + S256 validation) | separate route, unchanged by the shell | |

---

## 8. More page

> **Usage — LEGACY** (caveat 7; v2 has no data). **Legacy era 2** (~2.3 wks): `more`
> **38 events / 18 users** — clicks on the legacy `SidebarNav`'s More entry; era 1 had no More key.

`MorePage` is one shared component; only the **prop wiring** differs per shell
(`GroupViewContent.tsx:1159-1214`). Two wiring deltas matter.

| D-ID | What | Class | Legacy rows | V2 today | Usage signal | Ruling |
|---|---|---|---|---|---|---|
| **D-50** | **Danger Zone behaviour under admin View-As** — "Leave Static" is **suppressed** while an admin impersonates, but "Delete Static" is **not**, so an impersonated owner still sees the button. | CHANGED | M-12, M-13 | V2M-12/13 — same component both shells. **✅ VERIFIED (fact-check Q8), asymmetry confirmed:** Leave is withheld because the host drops `onLeaveStatic` under view-as (`GroupViewContent.tsx:1186-1194`); Delete stays because `MorePage`'s `isOwner` reads the **view-as-adjusted** role (`GroupViewContent.tsx:367,1213`; `MorePage.tsx:74,379-386`). ⚠ **PROBABLE, not certain:** the downstream `StaticTab` re-gates on the store's `group.userRole`, which is **not** view-as-adjusted (`V2SettingsHost.tsx:19`, `StaticTab.tsx:40`), so the deeper delete flow likely re-blocks — unverifiable from the frontend alone. **These are the two decision points still open in the Phase-G PR body** | Plan M self-service leave came from a real prod user report | **REDESIGN — SUPPRESS BOTH** *(under View-As neither Leave nor Delete is actionable; closes both Phase-G decision points; backend re-gate verification stays a follow-up (§13.3); ruled 2026-07-26)* |

*(Split Planner — the More page's other v2 wiring drop — is ruled as **D-18** with its roster
sub-tab twin.)*

### 8.K — More page KEPT ledger

| Legacy | → v2 | Note |
|---|---|---|
| M-1 Requests · M-2 Lead Tools (both `canManage`-only) | V2M-01, V2M-02 | |
| M-3 Loot History · M-5 Integrations (w/ inline Discord status) · M-6 Dalamud Plugin · M-7 Settings · M-10 Session History | V2M-03, V2M-05, V2M-06, V2M-07, V2M-10 | |
| M-8 Exports · M-9 Activity Log | V2M-08, V2M-09 | Still "Coming soon" stubs in both shells |
| M-11 "Switch to classic UI" section | V2M-11 / NEW-06 | v2-exclusive by construction; on mobile it is the **only** reachable v2→legacy affordance |
| M-14 Danger-Zone section suppression when empty · M-15 section headers | shared component | |

---

## 9. Overview / Static Home

> **Usage — ⚠ BOTH FIGURES ARE LEGACY; the earlier draft's reading of this section was wrong**
> (caveat 7). **Legacy era 1** (`tab_switch`, ~10.5 wks): `home` **49 events / 16 users**, the
> least-used era-1 tab — but Home was *one tab among seven* then. **Legacy era 2**
> (`sidebar_switch`, ~2.3 wks): `overview` **136 / 31**, the most-clicked era-2 entry — and in that
> era Overview is the **landing tab**. Both measure the **legacy** Overview; v2 Home has **no usage
> data whatsoever**.
>
> Stated neutrally: **Overview usage rose sharply once it became the landing surface** — 1.9× the
> users (31 vs 16) in a window ~4.5× shorter. The previous draft claimed "#1 v2 tab, ~2.8× legacy
> Home" and advised against re-adding density; that inference is **retracted in full** — it
> compared two legacy eras, mislabelled one as v2, and mis-stated the multiple. **Nothing in the
> data argues for or against restoring these modules**; if anything the era-2 rise shows the tab
> gets attention when it lands first. Rule D-57…D-71 on product judgement, not on these numbers.
> Error-URL corroboration: `tab=home` 1 (small-N).
>
> V2 Home also carries modules with **no legacy Overview counterpart** — notably **V2H-03** (the
> "This week's loot" summary card) and V2H-01's dynamic weekly subtitle. They need no ruling here
> (nothing legacy maps to them) but belong in the picture when weighing this section's density.

> **Gap closed.** `legacy-overview.md` (O-01…O-60) enumerates `StaticHomeTab`
> (`GroupViewContent.tsx:899-936` → `StaticHomeTab.tsx`, 1811 lines) — a three-column command
> centre. v2 Home (`components/home/**`, V2H-01…V2H-10) is a **different product**: a weekly-loop
> status page, not a launcher. Nearly every row below is therefore a genuine judgement call rather
> than an oversight, and several v2 answers are *better* than the legacy ones (D-69).

> **⚠ USER CHECKPOINT MANDATE (2026-07-26) — "two competing dashboards".** While ruling this
> section the user flagged a structural problem that outranks individual cells: the **static Home**
> ("This week") and the **Player Hub Overview** read as two competing dashboards — overlapping
> modules (activity, goals, collections/farms), confusing naming (the rail's Home icon opens the
> *Player Hub*, while the static's first Spine tab is also *Home*), and the Player Hub embedding
> its own second sidebar. Direct quotes: *"I keep getting confused between the home section when
> you have a static selected, vs Overview inside the Player hub. It's almost like two competing
> Dashboards"* and *"there's a lot of major systems competing for placement inside the app; I just
> want to make sure the flow between these systems are intuitive and have a clear flow map.
> Currently, that flow map eludes me."* **Consequences:** (1) D-67 and D-68 are ⏸ DEFERRED until a
> systems **flow map** (Player Hub · static Home · Roster · Loot · Schedule · Goals/Farms · Split
> Planner · Settings · Static Finder) exists and the dashboard identities are decided; (2) that
> flow map is a **required Phase-D design input** — Home-placement rulings in this section
> (D-42-on-Home lean, D-66, D-70) are directional and get final placement there.

| D-ID | What | Class | Legacy rows | V2 today | Usage signal | Ruling |
|---|---|---|---|---|---|---|
| ~~**D-51**~~ | ~~Overview audit gap (procedural placeholder)~~ **DISSOLVED** — the gap is closed by `legacy-overview.md`; superseded by D-57…D-69. | — | *(none)* | — | — | — |
| **D-57** | **Notifications module** — actionable rows in the left rail: up to 3 pending-application rows ("New application received / From {name}" + relative time → Requests panel), an imminent-raid row shown only when the next session is **within 48 h** (countdown → Schedule), the "All caught up" empty state and a loading skeleton. | CHANGED | O-03, O-04, O-05, O-06 | V2H-05 "Needs your attention" carries the pending-requests row (manage-only "Review" → Requests) and an equivalent "You're all caught up" empty state. **No imminent-raid notification**: V2H-02 shows the next session whenever one exists, without the ≤48 h urgency framing or countdown | era-1 home 49/16 (legacy) | **KEEP V2** *(hero card already shows the next session; no separate urgency row; ruled 2026-07-26)* |
| **D-58** | **Next Raid module** — populated card with countdown badge, content name, date/time range, an **8-dot RSVP grid**, ready count, and a "View Schedule" button; "No sessions scheduled" empty state with an "Add a session" link; skeleton. | CHANGED | O-07, O-08, O-09 | V2H-02 hero card — **strictly more capable in one axis** (RSVP avatar stack, N-in/M-tentative counts, and an inline 3-button RSVP strip that legacy's read-only dots never had) and less in another (no countdown badge, no 8-slot readiness grid, no "View Schedule" nav). Empty → `EmptyStateInvite` + "Add session" | era-1 schedule 116/34 (legacy) | **KEEP V2 + ADDITIONS** *(hero card stands; add countdown badge + View-Schedule affordance; readiness grid optional per design; ruled 2026-07-26)* |
| **D-59** | **Tier Progress module** — tier name, big "BiS Ready" fraction, glow progress bar, **per-player readiness dots** (tooltip each), avg-iLv row; renders nothing at all when no configured non-sub players exist. | CHANGED | O-10 | V2H-04 roster-readiness card (avg iLvl / % BiS / raider count + "BiS complete" bar + "N/M BiS slots obtained · K need setup") and V2H-06 BiS-by-role bars cover the aggregates. **The per-player readiness dots have no v2 equivalent** | no data | **COVERED BY D-42** *(no separate dots — the restored Team Summary (leaning Home per D-43) is the per-player readout; ruled 2026-07-26)* |
| **D-60** | **Command Brief — status chips + adaptive primary CTA** — clickable chips ("Next raid {countdown}" / "No sessions scheduled" → Schedule; "{N}/8 players configured" → Roster) and one adaptive primary CTA that is "Schedule a raid" or "Set up roster" depending on state. | CHANGED | O-12, O-13, O-14, O-17, O-18 | V2H-01's dynamic subtitle states next-session/floors/loot as **text**, and V2H-05 rows carry the roster prompts. **No clickable chip row and no single adaptive CTA** — v2 spreads the same signals across cards | era-2 overview 136/31 (legacy) | **REDESIGN** *(make v2's existing subtitle/prompt elements clickable rather than adding a chip row — Phase P polish; ruled 2026-07-26)* |
| **D-61** | **Featured application preview** — the "{N} applications pending" chip, the parchment "New Application" card (avatar, name, world, applying job + `ReadinessBadge` + avg iLv, message excerpt, relative time, "Review Dossier"), and the "+{N-1} more · View all" link. | CHANGED | O-11, O-15, O-16 | V2H-05(c) shows a pending-requests row with a "Review" button (manage-only) that opens the Requests panel. **No applicant identity, job-fit, iLv, or message preview on Home** — recruiting triage moves entirely into Settings ▸ Recruitment | no direct data (`modal_open` dead) | **KEEP V2** *(count + Review link on Home; dossier lives in Recruitment; ruled 2026-07-26)* |
| **D-62** | **Group Hero Panel** — identity header (shield, static name, tier), stat strip (Avg iLv / BiS Ready / roster count), **up to 8 per-player rows** (role accent bar, job icon, name, iLv, gear fraction, readiness label — each a button → Roster), "View full roster" footer, and a "Roster not configured / Open Roster" empty state. | CHANGED | O-19, O-20, O-21, O-22, O-23 | V2H-04 covers the stat strip. **No identity header, no per-player rows, no roster-nav footer, no empty-state CTA** | roster led both legacy eras (era-1 540/91, era-2 125/29) | **COVERED BY D-42** *(restored Team Summary carries the per-player rows; identity/nav folds into existing Home design; ruled 2026-07-26)* |
| **D-63** | **Recent Activity module** — up to 10 rows from the backend **`GET /api/static-groups/{id}/activity-log`** (falling back to farm-derived items), actor anonymisation honouring `activityDisplayMode`, a manager-only "Open Mount Farms" link on the empty state, and a "View all activity" footer → Goals ▸ Farms. | CHANGED | O-24, O-25, O-26, O-27 | V2H-07 feed merges mount-farm + loot + material **client-side** (`deriveActivityItems`/`deriveLootActivityItems`), top 5, privacy-filtered, no click targets, "No recent activity yet". **Note the substantive delta: v2 Home does not consume the `activity-log` endpoint at all**, and there is no "view all" path | v2's feed gained loot rows in Phase A (item 6) | **RESTORE (BACKEND FEED)** *(v2 Home consumes the activity-log endpoint again — richer types, server-side anonymisation — plus a view-all path; ruled 2026-07-26)* |
| **D-64** | **Roster Presence grid** — the right-rail 8-slot avatar grid: filled slots show avatar/job icon + first name, empty slots a dashed placeholder, every slot a button → Roster; plus its empty state and "Open Roster" footer. | LOST | O-28, O-29, O-30 | **absent** — v2 Home has no seat-level presence view of any kind | no data | **DROP** *(user disliked this in v1 — two roster views on one page, both linking to Roster, was redundant; the D-42 Team Summary is the single per-player artifact on Home; ruled 2026-07-26)* |
| **D-65** | **Best Next Farm + the Schedule-Farm handoff** — the #1 ranked `FarmScore` card (duty, mount, "{N} demand", members-missing / can-buy counts) with a **"Schedule Farm Session" button that cross-navigates to Schedule and opens `CreateSessionModal` pre-filled** with the farm context (via `MOUNT_FARM_SCHEDULE` on the event bus, consumed at `ScheduleTab.tsx:60-68`); plus empty state → Goals ▸ Farms and skeleton. | CHANGED | O-31, O-32, O-33, O-60 | V2H-08 `TrackCard` is **display-only** (lead non-flagship track, "N of M have it", Ring-3 tag, progress bar, no click target). **V2H-10 already records the loss**: v2 Home has no `onScheduleFarm` prop. The pre-filled-session handoff is gone end-to-end | era-1 `mount-farms` 33/14; era-2 `goals` 69/22 — both legacy | **REDESIGN** *(the pre-filled Schedule handoff returns, but from the Goals page rather than Home; ruled 2026-07-26)* |
| **D-66** | **Official Objectives on Home** *(split: Member Interest moved to D-70)* — up to 3 objectives with category + priority badges, an error state, a role-varying empty state ("Add objective →" for managers, static text otherwise) and a "+{N-3} more · Manage/View →" overflow link into Settings ▸ Goals. **The static's declared goals, visible on the landing screen.** | LOST | O-34, O-35, O-36, O-37 | **absent from v2 Home.** The objectives themselves survive in Settings ▸ Goals & Farms (ST-27/ST-28) and on the Goals page (G-2) — but nothing surfaces "what this static is working toward" where users land | era-2 `goals` 69/22 (legacy) | **RESTORE** *(objectives module returns on Home — up to 3 + overflow link; ruled 2026-07-26)* |
| **D-70** | **Member Interest on Home** *(split out of D-66)* — up to 3 open content suggestions with vote counts, a "Suggest content →" link available to **every** role, a footer link whose **destination forks by role** (managers → Settings ▸ Goals; members → the Suggest modal), the module footer "Manage/View goals →", and the `SuggestContentModal` itself reached from Home. | LOST | O-43, O-44, O-45, O-46, O-59 | **absent from v2 Home.** Separable from D-66 because it is the one place a *non-manager* could contribute from the landing screen — suggesting content is the members' half of the goals loop, and only Settings carries it in v2. ⚠ **Seam note: O-46 is the module-LEVEL "Manage/View goals →" footer shared by Objectives, Active Farms and Member Interest** — if D-66 or D-67 is `restore` while D-70 is `drop`, the footer travels with whichever half survives | no data | **RESTORE** *(Member Interest returns on Home alongside restored D-66 Objectives — members keep the landing-screen entry into the goals loop; ruled 2026-07-26)* |
| **D-67** | **Active Farms — DISPLAY on Home** *(split: mutation moved to D-71)* — up to 3 collection-goal rows (status dot, content-type badge, goal-type text, count fraction, progress bar) plus their loading skeleton. | LOST | O-38, O-42 | **absent from v2 Home** as a list — V2H-08 `TrackCard` shows **one** lead non-flagship track, read-only. Rulable on its own: "show N active farms on Home" is a display decision independent of whether Home can edit them. ⚠ **Seam note: O-39 (homed in D-71) bundles the farms empty state WITH its create button** — if D-67 is `restore` and D-71 is `drop`, restore the empty-state copy with the button omitted | no data | **REDESIGN — RULED via flow map F-10 (2026-07-26)** *(Home carries ONE evolved TrackCard pointing into the new Progress Spine tab; the full farm list lives on the Progress tab; O-39 empty-state copy returns button-less on the card's empty form — see `systems-flow-map.md`)* |
| **D-71** | **Active Farms — MUTATION from Home** *(split out of D-67)* — the empty-state "Create Collection Goal" button, the manager-only **"+ Add farm"** footer (static count text for everyone else), the **per-row 2-step delete** (trash → check/✕ → `deleteGoal`), and the 5-step `CreateCollectionGoalModal` opened from Home. | LOST | O-39, O-40, O-41, O-58 | **absent from v2 Home** — and this is the sharper question of the two: legacy let a manager **create and delete farms from the landing screen**, including a destructive delete two clicks from page load. v2 confines both to Settings ▸ Goals & Farms / the Goals page. Ruling `drop` here is defensible on safety grounds even if D-67 is ruled `restore` | no data | **DROP** *(Home stays read-only for farms; create/delete confined to Goals/Settings; if D-67 later restores the display, the empty-state copy returns without the create button; ruled 2026-07-26)* |
| **D-68** | **Split Clears readiness card** — data-gated card showing "Alts assigned {x}/{y}" plus an amber "{N} members need attention" line, with an "Open Split Planner" button. | LOST | O-47 | **absent** — and the destination surface is itself dropped in v2 (**rule together with D-18**) | no data | **REDESIGN — RULED via flow map F-11 (2026-07-26)** *(no standalone Home card — split-clear readiness folds into Home's role-adaptive attention section as a data-gated row, linking to the Split Planner wherever F-04's Phase-D deferral lands it — see `systems-flow-map.md`)* |
| **D-69** | **One-click applicant dossier from Home** — `JoinRequestReviewModal` opened straight off the Overview (full dossier: job fit, gear & BiS, goal alignment, schedule; Maybe Later / Decline / Accept-with-confirm; View Profile; Discord copy; read-full-message and exact-windows toggles). | CHANGED | O-51, O-52, O-53, O-54, O-55, O-56, O-57 | V2H-05(c) "Review" routes to **Settings ▸ Recruitment ▸ Requests** (V2ST-05), from which the same modal opens. **v2's route is arguably better:** O-52 records that the Overview mount omitted `groupId`, `discoverySettings` and `onAddToRoster`, so its dossier could never show the "Add to Roster" CTA and computed Job Fit without static needs. The loss is *immediacy* (one click from Home), not capability | `member_role_changed` 9/4 (all → lead) | **KEEP V2** *(Recruitment route is the correct, fully-wired path; consistent with D-61; ruled 2026-07-26)* |

### 9.K — Overview KEPT ledger

| Legacy | → v2 | Note |
|---|---|---|
| O-01 Overview `PageHeader` (icon + "Overview" + "Command center for your static.") | V2H-01 | Header slot preserved; v2 re-frames it as "This week" with a **dynamic** subtitle assembled from schedule/loot state — a copy/identity change, not a capability change |
| O-49 mount data-fetch effect — `canManage`-gated `fetchGroupRequests`; `isMember`-gated sessions, recommendations, farm progress, goals, objectives, suggestions, split-clear (deliberately gated to avoid 403 toast spam for applicants) | V2H-09 | Same shape: v2 gates its mount fetches on `group.userRole` and fetches join-requests only when `canManage` |

*(O-02, O-48 and O-50 are legacy-side defects, accounted in §12. O-31's missing `canManage` gate is
flagged there too but ruled here inside D-65.)*

---

## 10. Cross-cutting

> **Usage.** No keyboard-shortcut instrumentation exists in either shell — **every row here is
> "no data"** unless stated. v2's countervailing addition is the ⌘K palette (NEW-01).

| D-ID | What | Class | Legacy rows | V2 today | Usage signal | Ruling |
|---|---|---|---|---|---|---|
| **D-52** | **Desktop reachability of Tracking, More and Plugin.** Legacy's sidebar carried a nav entry per pageMode (enumerated for Roster as R-006). | CHANGED | R-006 | V2K-14: the Spine has **4 tabs only** (Home/Roster/Loot/Schedule) — *"Goals/More/Plugin have no Spine entry — ⌘K or mobile nav only"*. **Amended by fact-check Q5:** there is a third path — the number-key shortcuts fire under v2 and **`3` lands on Goals** (the shared `GoalsPage`), so Tracking has an undiscoverable-but-working keyboard route; More and Plugin have none | ⚠ **CORRECTED.** `goals 69/22 · more 38/18 · plugin 8/5` are **era-2 clicks on the legacy `SidebarNav` entries** — i.e. on *the very affordance v2 removed*. They are evidence of demand for those destinations, and cannot support the earlier claim that they are "reached today without a Spine entry" | **REDESIGN — DROP THE MORE TAB** *(user ruling: More is dropped as a nav destination; anything useful on it gets re-homed elsewhere in Phase D. Plugin is NOT a tab — it moves into the documentation pages, with at most a banner/notice/button in an appropriate place linking there; open design question: is the plugin static-level or individual-level? (lean: Player-Hub-side subscription, or an option inside the static layout). Goals' desktop path decided with the flow map (§9 mandate); ruled 2026-07-26)* |
| ~~**D-53**~~ | ~~Roster keyboard shortcuts with no v2 target~~ **DISSOLVED — the premise was false.** | ~~CHANGED~~ → **KEPT** | R-166, R-167, R-168, R-169, R-171, R-172 → §1.K | **✅ VERIFIED (director sweep): all six fire under v2 against live targets.** The hook is mounted **unconditionally** (`GroupViewContent.tsx:487`); `G` → `setGroupView` (`:118-121`, consumed `Roster.tsx:124,406-407,431`), `S` → `setSubsView` (`:127-130`, consumed `:126,432`), `Alt+Shift+P` (`:264-268`), `Alt+[`/`]` (`:250-261`), `Mod+[`/`]` (`:238-249`), `Escape` (`:280-284`). Two consequences carried elsewhere: `S` is now the **only** route to D-07's dropped toggle, and the shortcuts-help surface advertises bindings that *are* dead (§12-A16) | *(n/a)* | — |
| **D-54** | **Loot/History keyboard shortcuts and the `log:*` event bus they drive** — `4` (Loot tab), `v` expand-all, `g` grid/list, `Alt+1/2/3` sub-tab + view/entry-type, `Alt+←/→` week, `Alt+L` log loot, `Alt+U` log material, `Alt+B` mark floor cleared, `Alt+P` Settings ▸ Priority; plus the nine `log:*` custom-event listeners. | LOST | L-130, L-245, L-246, L-247, L-248, L-249, L-250, L-251, L-252, L-253 | **Explicitly not registered in v2** — the sources state these bind only when `legacyLootSurface` is present (`!slots?.gear`). The listeners they drive are unmounted with the legacy view | no data | **RESTORE (IN PHASE D)** *(the shortcut set returns rebound to the NEW loot/history surfaces as part of the Phase-D rework; bindings may shift where surfaces changed; ruled 2026-07-26)* |
| **D-55** | **Modifier-key affordances** — `Shift+Click` copies a deep link (player card, grid cells, All-Weeks rows) and `Alt+Click` jumps to the related player, **both available to every role including viewers**; plus the kebab tooltip that teaches them. | CHANGED | R-062, R-076, L-167, P-08 (loot-perm) · **cross-cited (homed elsewhere): L-144, L-145 → D-30; L-162, L-163 → D-31** | v2 exposes explicit **buttons** instead: V2R-20 "Copy URL", V2L-17 "Copy link". No modifier-click behaviour is evidenced anywhere in v2. ⚠ **RULE THIS AFTER D-30 AND D-31** — four of the eight surfaces these modifiers act on (grid cells, All-Weeks rows) exist only inside those units. If both are ruled `drop`, most of D-55 is moot and only the player-card `Shift+Click` (R-062) remains live | no data | **REDESIGN — SHORTCUTS/RIGHT-CLICK, NOT BUTTONS** *(user ruling: deep-link copy + player jump return as modifier-clicks and/or right-click context items on the restored surfaces (D-30/D-31 both return); dedicated buttons de-emphasized — this is a deliberate superuser affordance, discovered over time, not a prominent control; ruled 2026-07-26)* *(refinement ruled 2026-07-26 on PR #191: slot-icon jumps are **Alt+Click ONLY — a plain mouse click must never navigate** ("forcing the alt modifier makes it an intentional action"); keyboard Enter and detail-0 AT activation ride the same affordance; **the hover cursor reflects the modifier** — default arrow normally, pointer only while Alt is held, so an icon never advertises a plain click it won't honor; first shipped on the C4 tome sub-row icon as the family's reference implementation)* ⚠ *ROSTER HALF ✅ **SHIPPED (C7, 2026-07-27)**: **R-062** Shift+Click anywhere on the card copies its deep link (legacy `PlayerCard.tsx:517-538` parity down to the details — mousedown suppressed so the modifier click doesn't flash focus, the Shift-selection cleared, focus dropped afterwards; available to every role, viewers included) and **R-076** the kebab tooltip that teaches both modifier-clicks. **Ruled 2026-07-27: Shift+Click JOINS the kebab's "Copy URL" item, it does not replace it** — the ruling de-emphasizes prominent dedicated buttons, and a menu item is both low-key and the only keyboard/AT-reachable route to the link. Recorded deltas: the tooltip's "Player Options" heading is `aria-hidden` (Radix wires the content as `aria-describedby`, and the heading only repeats the trigger's own name), and the Shift row is omitted when the host supplies no copy handler — the hint never teaches an action the card cannot perform. The card body carries a justified `design-system-ignore`: it is NOT a control (a plain click deliberately does nothing), so a role would promise an activation that must never exist. The LOOT half stays open for Phase D.* |
| ~~**D-56**~~ | ~~Mobile "Controls" sheet contents (v2 row: V2K-16)~~ **DISSOLVED — nothing independently rulable remains.** | ~~CHANGED~~ → **rider** | R-017 → §1.K · L-08, L-09, L-10, P-15 (loot-perm) → §3.K (re-homed) · **R-016, L-07 remain here as the rider's rows** | **✅ VERIFIED (fact-check Q2):** all three reset buttons sit inside `pageMode==='gear' && !slots?.gear && gearSubTab==='history' && canManageRoster(...)` (`GroupViewContent.tsx:1393-1442`, the sheet = **V2K-16**) — suppressed under v2, never double-rendered — and the capability is **RE-HOMED to V2L-05**, which **does render at phone widths** (`LootToolbar.tsx:39` root carries no responsive class; the menu renders whenever `canEdit`, `:43`). Everything else the sheet exposed was a mirror of a control ruled elsewhere. **⚠ DEPENDENT RIDER (carry into C/D):** *whatever D-01, D-06, D-07 or D-23 is ruled `restore`, its mobile access must be restored with it* — v2 suppresses the sheet's Roster/Gear sections wholesale, so a restored desktop control would otherwise have no phone-width equivalent | no data | — |

### 10.K — Cross-cutting KEPT ledger

Deep links survive across the board: `?player=` (R-018 → V2R-19), `?entry=&entryType=`
(L-128 → V2L-16), `?sessionId=` (S-61 → V2S-12), and v2 adds `?tab=roster&player=` copy-out
(V2R-20). `Alt+Shift+N` / `Alt+Shift+R` (R-170) are named verbatim in V2K-08; `Shift+S`
(R-173) is confirmed by the Stage-1 matrix §7. In-static chrome rows not otherwise cited map as:
V2K-06 StaticPicker + V2K-07 tier breadcrumb (tier switching), V2K-09 week indicator (desktop-only
"Week N"), V2K-10 invite, V2K-11 notification bell, V2K-12 theme, V2K-13 settings gear
(= V2ST-02), V2K-17 banners (= R-003/R-004), V2K-18 rail "Switch to classic UI" (desktop; the
mobile counterpart is M-11/V2M-11).

---

## 11. V2-only additions (recorded for the audit — no ruling needed)

| ID | Addition | Why it matters here |
|---|---|---|
| NEW-01 | **⌘K Command Palette** — navigate, open settings, switch static, shortcut reference in one keyboard-first surface | The partial answer to D-52/D-53: it is how Goals/More/Plugin are reached on desktop today |
| NEW-02 | **Roster Board** — static-wide gear matrix (party rows × 11 slots + BiS column) | Legacy's `GearTable` was per-player inside an expanded card only. Board is the *reason* D-02 was considered acceptable |
| NEW-03 | **Board next-upgrade glyph (●)** computed live against the Loot priority queue | No legacy counterpart |
| NEW-04 | **Per-row gear-edit permission** (`canEditGear`) | Fixes the flip-era bug that *"wrongly locked members out of their own gear"* — strictly better than a screen-level gate |
| NEW-05 | **Recurring delete cancels the rendered occurrence** (legacy cancelled the *next* one) | A deliberate correctness fix inside an otherwise-KEPT flow (S-25/S-26) |
| NEW-06 | **"Switch to classic UI" as a first-class More-page section** | The only mobile-reachable v2→legacy escape |

> **⚠ Correction filed against `v2-inventory.md` (director sweep 2026-07-26).** The inventory's
> V2R rows **omitted two affordances that exist at HEAD**, and this matrix's first draft inherited
> the blind spot as two false LOST claims: the **average-iLvl readout** on the roster card
> (now **V2R-25**, `RosterCard.tsx:250,389-391`, under an "iLvl" label) and the **3px role-colour
> accent edge** (now **V2R-26**, `:313-318`). Both are corrected in D-10 and D-11; R-064 moved to
> §1.K. A correction note appending V2R-25/V2R-26 has been filed on `v2-inventory.md` so downstream
> consumers do not re-inherit the gap (V2R subtotal → 26, body rows → 91). Treat any
> "absent from v2" claim resting on inventory *silence* — rather than on a positive statement like
> V2L-01's or V2R-15's — as needing the same spot-check.

---

## 12. Appendix — audit incidentals (candidate cleanup items — **not parity rulings**)

These are defects, dead code and unreachable affordances the audits surfaced. None require a
restore/drop/redesign ruling; all are candidates for the Phase-E/F sweeps. Rows marked
**[accounted here]** have this appendix as their coverage home; rows marked **[cross-ref]** are
accounted in a KEPT ledger and merely flagged here.

| # | Finding | Source |
|---|---|---|
| A1 | ~~Legacy Overview was never audited~~ — **CLOSED.** `legacy-overview.md` (O-01…O-60) landed and is ruled in §9 (D-57…D-69). The matrix now covers every in-static surface. | closed |
| A2 | **Dead analytics event-bus instrumentation** — `loot_logged`, `loot_deleted`, `modal_open/close`, `tier_changed`, `player_update`, `tier_create` have **never fired in prod** (dead since PR #76; `analytics.ts:50-58` listens to events with 2 live emitters repo-wide). Re-wiring is a prerequisite for any data-informed Phase-C card decision. ⚠ *C2 (2026-07-26): `player_gear_changed` left this list — it now fires from the v2 Cards surface only (see the D-02 counting note); the rest remain dead.* | analytics-report §CRITICAL 2 |
| A3 | **L-19 — tooltips advertise bindings that do not exist.** The Loot Priority sub-tab buttons advertise `Alt+1/2/3` for matrix/gear/weapon, but the registered global shortcut switches the *outer* Gear sub-tab; no listener exists for the panel's internal sub-tabs. **[accounted here]** | L-19 |
| A4 | **L-23 — undocumented reset default.** With tab-persistence = "reset", `setPageMode` forces the loot sub-tab back to `'gear'`, not the documented default `'matrix'`. **[accounted here]** | L-23 |
| A5 | **Blank-content states with no fallback UI (three siblings).** **L-05** — with zero configured players, none of BiS/History/Jobs renders any fallback, so the user gets an empty panel. **R-183** — the roster grid renders zero cards with no empty-state message or CTA; the only way back in is the toolbar Add Player. **O-02** — legacy Overview renders the `PageHeader` and then nothing at all when `currentGroup` is falsy. **[accounted here]** | L-05, R-183, O-02 |
| A6 | **P-05 (loot-perm) — viewers can roll the dice.** Weapon-priority tie-break Roll/Reroll is **not** gated by `showLogButtons`; members *and viewers* can reroll a tie. The defect ships into v2 unchanged, since V2L-13 mounts the same component. **[accounted here]** | P-05 |
| A7 | **Non-role-gated farm mutations.** `G-13` LogDropModal (logs a drop and flips a participant to "have"), `G-21` per-reward "Track", and `G-22` TrackFromCatalogModal all lack an explicit role check — any authenticated viewer of the card can mutate. **[cross-ref — §6.K]** | G-13, G-21, G-22 |
| A8 | **R-031 — unreachable edge drop zones.** `useDragAndDrop` computes drop updates for `edge-start/edge-end/-g1/-g2` ids, but no `useDroppable` element with an `edge-` id is ever rendered. **[accounted here]** | R-031 |
| A9 | **Dead / unmounted components.** Loot+history: `FloorSelector` (L-254), `SummaryPanel` (L-255), `WeekSelector` (L-256), `UnifiedWeekOverview` (L-257), `PageBalancesPanel` (L-258, v2-only consumer), `LootLogPanel` (L-259), `DeleteLootConfirmModal` (L-260, v2-only consumer). Roster: `GearSourceBadge` (R-187, only the design-system showcase references it), `GearTable`'s `compact` branch (R-098 — `PlayerCardGear` never passes it; the icon row users see is a separate implementation). Tracking: the whole orphaned `components/mount-farms/**` tree (G-24…G-28 — MountFarmTab incl. its recommendation hero and plugin-sync onboarding, MountFarmSummary, MountFarmDetail's per-member bulk edit) has **zero import sites** outside its own chain and tests. **[accounted here]** ⚠ Do not sweep anything the user rules `restore` — **G-27's per-member bulk edit and MountFarmDetail have no live equivalent in either shell**. | L-254…L-260, R-187, R-098, G-24…G-28 |
| A10 | **P-8 (plugin) — a card that never renders.** `GearSyncDashboard`'s "Team Summary" shortcut requires an `onViewStats` prop that `PluginPage` does not pass. Note it would have pointed at the surface lost in **D-42**. **[accounted here]** | P-8 (plugin) |
| A11 | **P-13 / P-19 (loot-perm) — permission delta, now code-verified (fact-check Q7).** v2 gates "Mark floor cleared" on `canEdit` only (`BookLedgerCard.tsx:120-124`); legacy adds `userRole !== 'member'` (`SectionedLogView.tsx:1472`). **Exactly one case diverges:** a site-admin whose *static* role is `member`, with admin mode on (`isAdminAccess=true`), sees the action in v2 but not in legacy. Not a parity loss (v2 is the permissive side) — decide whether to re-assert the legacy double-gate. **[cross-ref — §3.K]** | P-13, P-19 |
| A12 | **O-50 — legacy Overview computes `canManage` without `isAdminAccess`.** `GroupViewContent.tsx:910` passes `canManageRoster(userRole).allowed`, omitting the second argument that Roster and Gear-history pass (`:1393`). An admin-mode viewer without a real owner/lead role therefore sees **no** manager affordance on Overview (O-11, O-15, O-16, O-25, O-35, O-39, O-40, O-41, O-45, O-46 and the O-17/O-18 gating) while the same session gets manager affordances everywhere else. A legacy inconsistency — worth fixing if any D-57…D-69 row is ruled `restore`. | O-50 |
| A13 | **O-48 — "Open Split Planner" doesn't open the Split Planner.** The Split Clears card calls `onNavigate('roster')` with no sub-tab, and the Overview wrapper forwards a sub-tab only when `tab === 'goals'` (`GroupViewContent.tsx:907-909`), so it lands on the Roster default view — unlike the More-page quick action (`:1178`), which sets `rsub: 'split-planner'`. Dead-ends the user one click short. | O-48 |
| A14 | **O-31 — "Schedule Farm Session" is not `canManage`-gated at the Overview end.** Any member or viewer can trigger the cross-tab handoff; the actual permission check only happens later, inside `CreateSessionModal`. Same class as A6/A7. **[cross-ref — ruled inside D-65]** | O-31 |
| A15 | **Stale test comment.** `PluginPage.test.tsx:4` claims the component was "deleted in Task 2". It *was* deleted in `cf25c92` — and restored in `9c8a770`; it is live at HEAD (fact-check Q1). Delete the comment before it misleads a future dead-code sweep. | fact-check Q1 |
| A16 | **v2's own shortcut documentation advertises dead or retargeted bindings** — same defect class as A3, but shipped in v2 rather than legacy. `components/ui/keyboardShortcutGroups.ts:21-45` feeds both the ⌘K palette footer (V2K-05) and the shortcuts-help overlay, and lists **`Alt+1`–`Alt+3`**, **`V` "Expand/collapse"**, **`G` "grid view"** and **`Alt+←/→`**. Under v2: the `Alt+*` loot bindings are **not registered at all** (D-54 — they require `!slots?.gear`), `V`'s expand/collapse target does not exist (D-01), and `G` toggles **light-party grouping**, not a grid view. A user who reads v2's own help gets four wrong answers. | `keyboardShortcutGroups.ts:21-45` |
| A17 | **"Coming soon" stubs persist in both shells.** M-8 (Exports) and M-9 (Activity Log) render as non-interactive `opacity-60` cards with a "Coming soon" badge on the More page — carried into v2 unchanged as V2M-08/V2M-09. The redesign brief prohibits stubs, and this matrix is the last surface where they would plausibly get a ruling before the un-gate: **either build them, or delete the cards.** Flagged rather than ruled because there is no legacy→v2 delta — the defect is identical on both sides. **[cross-ref — home is §8.K]** | M-8, M-9 |

---

## 13. Coverage ledger — 100 % reconciliation

### 13.1 Legacy rows (713 total)

| Source namespace | Rows | In active decision units | In KEPT ledgers | In tombstone riders | In appendix (as home) | Σ |
|---|---|---|---|---|---|---|
| `R-001…R-189` (roster) | 189 | 78 | 106 | 1 *(R-016 → D-56 rider)* | 4 *(R-031, R-098, R-183, R-187)* | **189** |
| `L-01…L-260` (loot/history) | 260 | 150 | 99 | 1 *(L-07 → D-56 rider)* | 10 *(L-05, L-19, L-23, L-254…L-260)* | **260** |
| `P-01…P-19` (loot permission diffs) | 19 | 6 | 12 | 0 | 1 *(P-05)* | **19** |
| `S-1…S-61` (schedule) | 61 | 15 | 46 | 0 | 0 | **61** |
| `ST-1…ST-66` (settings) | 66 | 0 | 66 | 0 | 0 | **66** |
| `G-1…G-28` (goals/tracking) | 28 | 0 | 23 | 0 | 5 *(G-24…G-28)* | **28** |
| `P-1…P-15` (plugin) | 15 | 0 | 14 | 0 | 1 *(P-8)* | **15** |
| `M-1…M-15` (more page) | 15 | 3 *(M-4→D-18; M-12, M-13→D-50)* | 12 | 0 | 0 | **15** |
| `O-01…O-60` (overview) | 60 | 55 *(D-57…D-71)* | 2 *(O-01, O-49)* | 0 | 3 *(O-02, O-48, O-50)* | **60** |
| **Total** | **713** | **307** | **380** | **2** | **24** | **713** |

**Arithmetic:** 189 + 260 + 19 + 61 + 66 + 28 + 15 + 15 + 60 = **713** source rows
(the original 653 + the 60-row Overview audit).
307 (active decision units) + 380 (KEPT) + 2 (tombstone riders) + 24 (appendix-home) = **713**. ✔

**Accounting rule, stated precisely (the previous "exactly once" sentence was false — corrected):**
every legacy ID has **exactly one accounting home**, and the five columns above are disjoint. Some
IDs are additionally **cross-cited** in a second unit's row where the ruling depends on them; those
citations are labelled and **never counted twice**:

| Cross-cited ID | Accounting home | Also cited in | Why |
|---|---|---|---|
| **L-144, L-145** | D-30 (weekly grid) | D-55 | the grid cells are what `Shift+`/`Alt+Click` act on |
| **L-162, L-163** | D-31 (All Weeks table) | D-55 | same, for All-Weeks rows |
| G-13, G-21, G-22 | §6.K KEPT | §12-A7 | defect flags on KEPT rows |
| P-13, P-19 | §3.K KEPT | §12-A11 | permission-delta flag |
| M-8, M-9 | §8.K KEPT | §12-A17 | stub flag |
| O-31 | D-65 | §12-A14 | missing role gate |
| P-05 | §12-A6 *(appendix is its home)* | §2.K | defect travels with a KEPT component |

**Deltas from the previous draft** (verification-driven; no row left the document or changed
namespace): roster decision 91 → **78** and KEPT 94 → **106** — R-001, R-002 (D-21 dissolved),
R-164 + R-166…R-172 (D-53 dissolved), R-064 (D-11 corrected), R-072 (D-12 rider), R-017 (D-56
re-homed), less R-016 to the rider column. Loot decision 154 → **150** (L-08, L-09, L-10 re-homed;
L-07 to the rider). Loot-perm 7 → **6** (P-15 re-homed). Schedule 17 → **15** (S-19, S-23 corrected
to KEPT).

**Cross-section decision units** (why per-namespace decision counts exceed the per-section tables):
D-05 spans roster + loot (R-045, R-089, R-090, L-12, L-13, L-14); D-18 spans roster + More (R-186,
M-4); D-55 spans roster + loot (R-062, R-076, L-167, P-08); the dissolved D-56 spanned both.

Per-section decision-unit spread: Roster 20 · Loot Priority 8 · Loot History/Books **16** ·
Schedule 5 · Settings 0 · Goals 0 · Plugin 0 · More 1 · Overview **15** · Cross-cutting **3** =
**68 active** (31 LOST · 37 CHANGED), from **72 issued IDs** less the **4 tombstones**
(D-21, D-51, D-53, D-56).

### 13.2 V2 rows

`v2-inventory.md` now contains **115** rows after the correction note (§11): the **91 body rows**
are V2H (10) + V2R (**26** — V2R-25/V2R-26 added) + V2L (21) + V2S (13) + V2ST (8) + V2M (13). The
remaining 24 are V2K (18, in-static chrome) + NEW-01…06 (6, v2-only additions).

| Namespace | Rows | Where accounted |
|---|---|---|
| V2H-01…10 | 10 | §9 decision units D-57…D-71 + §9.K (V2H-10 is the recorded loss, ruled inside D-65) |
| V2R-01…26 | 26 | §1 decision units + §1.K (V2R-25, V2R-26 added by the §11 correction; cited in D-10, D-11, §1.K) |
| V2L-01…21 | 21 | §2/§3 decision units + §2.K/§3.K (V2L-21 = the TopBar week indicator, cited in D-40 and §10.K) |
| V2S-01…13 | 13 | §4 decision units + §4.K |
| V2ST-01…08 | 8 | §5/§5.K (V2ST-04, V2ST-05 cited there; V2ST-06 in §3.K) |
| V2M-01…13 | 13 | §8 + §8.K (V2M-04 in D-18) |
| **Body-row subtotal** | **91** | see coverage note below *(was 89 before the V2R correction)* |
| V2K-01…18 | 18 | §10 (D-52; V2K-16 in the D-56 tombstone) + §10.K |
| NEW-01…06 | 6 | §11 |
| **Total** | **115** | see coverage note below |

**V2 coverage note (honesty over ✔):** the v2 side is an *inventory*, not an accounting ledger —
v2 rows only need citation where a legacy row maps to them. **10 of 115 rows are v2-only with no
legacy counterpart and are cited nowhere in §1–§12:** V2R-23, V2R-24, V2S-11, V2S-13, V2ST-03,
V2ST-07, V2ST-08, V2K-02, V2K-03, V2K-04. All ten are additive v2 capabilities (Board glyph/legend,
person-layer entry, shared week clock, dock container, palette rows); none hides a legacy delta.
The earlier "✔ all cited" claim was an overclaim and is withdrawn.

### 13.3 Open ambiguities (do not resolve silently)

**Resolved 2026-07-26** by `ambiguity-factcheck.md` — 8 of the original 10, each stated as fact with
its file:line inside the affected row: D-43 (Q1, two mount points — not a conflict) · D-56 (Q2,
resets suppressed under v2 → re-homed to V2L-05 → unit dissolved) · **D-12 (Q3, no Lodestone search
in `RosterCharacterPanel` → re-classified LOST)** · **D-21 (Q4, v2 zero-tier state exists →
dissolved to KEPT)** · **D-53 (Q5 + sweep, all shortcuts fire under v2 → unit dissolved; `3` reaches
Goals, which also amends D-52)** · §4.K (Q6, full AvailabilityGrid in the modal) · A11 (Q7, gate
divergence confirmed, single edge case) · D-50 (Q8, View-As asymmetry confirmed). The tenth — the
Overview coverage gap — was closed by `legacy-overview.md` (§9). The director sweep then closed two
more (below) and re-opened one.

**Closed by the director sweep (2026-07-26):**
- ~~`stats` = Team Summary was an unverified reading~~ → **CONFIRMED.** The retired tab bar labelled
  it *"Summary — Team-wide gear statistics"* (`git show 67f5393^:…/TabNavigation.tsx:27-33`).
  D-42's usage figure is correctly attributed — subject only to the era-1 caveat now on the row.
- ~~D-56's mobile reachability of V2L-05~~ → **RESOLVED.** `LootToolbar.tsx:39` (the root div)
  carries no responsive class and the reset menu renders whenever `canEdit` (`:43`), so V2L-05
  **is** available at phone widths. The reset re-home is complete; the residual is deleted.

**Still open — two items:**

1. **§0.2 — `P-` namespace collision** between the loot audit (`P-01…P-19`) and the plugin audit
   (`P-1…P-15`). Cosmetic, but must not be silently merged by tooling.
2. **D-50 — PROBABLE, not certain (fact-check Q8's own caveat):** the impersonated-owner Delete
   button is visible, and the downstream `StaticTab` re-gates on a **non**-view-as-adjusted
   `group.userRole`, so the deeper flow *likely* re-blocks. **Not verifiable from the frontend
   alone** — it depends on backend admin-viewing semantics, so closing it needs a backend read or a
   live View-As test, not another code sweep.

**Newly opened by verification — since CLOSED:**
3. ~~**D-19 — `KeyboardSensor` unverified.**~~ **CLOSED (2026-07-26, code-verified):** v2's
   `RosterCards.tsx:290` calls the same shared `useDragAndDrop` hook as legacy, whose sensor set
   registers `KeyboardSensor` with `sortableKeyboardCoordinates` (`useDragAndDrop.ts:58-67`).
   Accessible (non-pointer) roster reordering is intact in v2; no a11y regression. D-19's remaining
   delta is ghost fidelity + grab-handle area only (R-032 stays homed in D-19 — accounting
   unchanged).

---

*Next step: the user marks every ⏳ `restore` / `drop` / `redesign`. That marked file becomes the
binding backlog for Phase C (roster) and Phase D (loot/history QoL), per `ROLLOUT_ROADMAP.md` §5
step 4 and the standing rule in §8.*
