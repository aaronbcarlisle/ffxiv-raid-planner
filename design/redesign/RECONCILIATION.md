# V2 Redesign — Reconciliation & Backlog

**Created:** 2026-07-23
**Status:** ACTIVE — the durable backlog for the V2 redesign. **Bucket A (doc false-done) was resolved 2026-07-23** — the roadmap status docs now describe the dual-shell / legacy-default reality. **Bucket B is the live backlog.** This doc remains an interim ground-truth for "what is actually done," alongside `PRODUCT_MODEL.md`.
**Purpose:** A ground-truth reconciliation of every "done / complete / merged / shipped" claim against the actual code on `redesign/foundation`, plus the real remaining backlog. Produced after an evidence-based audit (three independent read-only agents) triggered by the observation that the autonomous build workflow left the docs asserting more than the code delivers.

> **Decision of record (2026-07-23):** Keep the V2 branch, change how we work. The branch is ~68% pure additions, fully reversible at the DB layer (3 additive migrations, working downgrades, none applied to production), and CI-hardened. The four Ring-0 in-static screens (Home, Roster, Loot, Schedule) are genuinely wired to real data. The failure was **process and plan-fidelity, not code recoverability.** Work resumes step-by-step, gated by a plan-fidelity guardian (`xivrp-director`).

---

## How to read this document

Two buckets:

- **Bucket A — Falsely marked DONE:** a doc / commit / release note *explicitly* claims completion, but the code contradicts it. These are the corrections that must land first — a guardian cannot enforce plan-fidelity against docs that lie.
- **Bucket B — Planned but never built:** real redesign goals that nothing explicitly claims done. Mostly deferred *honestly* (release notes and code comments say "deferred / navigate-only"). This is the genuine remaining backlog.

**Verified genuinely DONE (not in either bucket).** To keep the picture honest: 16 of the 17 Phase-A items were verified landed in code — open-seat configure/remove (`OpenSeatCard.tsx`), board per-row gating (`GearBoard.tsx:149`), interim tome toggle (`useRosterCardActions.tsx:223-241`), Danger-Zone delete (`MorePage.tsx:381`), rail stubs, activity feed folding loot/material (`StaticActivityFeed.tsx:63`), 404 catch-all, auth-429 false-logout fix (`authStore.ts:442,451`), BYDAY recurrence (`CreateSessionModal.tsx:104-113`), assign-anyway (`FloorCard.tsx:146`), TopBar icon order. The **changelog / release notes are accurate** — the flip entries are self-corrected by the later Phase-R and 2.1.0 entries (retitled "limited preview" under the 2026-07-25 launch gate). The problem is concentrated in two roadmap *status* docs.

Type tags: `[REVERTED]` `[STUBBED]` `[NEVER-BUILT]` `[PARTIAL]` `[DOC-STALE-ONLY]`.

---

## Bucket A — Falsely marked DONE

> **✅ ALL RESOLVED 2026-07-23.** A1/A2 fixed in `FOUNDATION_ROADMAP.md` (F6 status cell + §2.1 flip-to-default note now state the Phase-R dual-shell / legacy-default reality; §3.1 "More is deleted" corrected). A3 fixed in `ROLLOUT_ROADMAP.md` (Phase A headline downgraded to 16/17, item 10 partial). A4 stale comment fixed in `CommandPalette.tsx`. Entries below are retained as the audit record.

### A1. `[REVERTED]` "Parity flip / legacy deletion COMPLETE" — the cutover was undone
- **Claim:** `FOUNDATION_ROADMAP.md:49,67` — v2 is the *only* group route; legacy chrome, `?shell=` gate + escape hatch, and all legacy-only tab bodies deleted (~25k lines).
- **Code:** `GroupRoute.tsx:19-25` renders legacy `GroupView` as the **default**; `shellPreference.ts:62` default `'legacy'`; legacy tab bodies restored at `GroupViewContent.tsx:900/940/977/1087`. Phase R (#174, `329c394`) resurrected everything P3 (#173) deleted.
- **Truth:** The hard cutover was reversed; legacy is the default shell. This is a *status* document that was never updated after Phase R. **Largest single source of "marked done but isn't."**
- **Fix:** Rewrite the F6 / parity-flip status in `FOUNDATION_ROADMAP.md` to reflect the dual-shell, legacy-default reality.

### A2. `[REVERTED]` "More page is deleted" — it is present and reachable
- **Claim:** `FOUNDATION_ROADMAP.md:85` — "`More` is deleted".
- **Code:** `MorePage.tsx` renders in v2 (`GroupViewContent.tsx:1154`); reachable via ⌘K "Go to More" (`CommandPalette.tsx:131`) and mobile bottom nav (`GroupViewContent.tsx:1239`).
- **Truth:** Deleted at P3, restored at Phase R; it is a live v2 surface. See also B4 (it should ultimately be deleted + re-homed).
- **Fix:** Correct the claim in `FOUNDATION_ROADMAP.md`; track the real deletion in Bucket B4.

### A3. `[PARTIAL]` Phase A "all 17 items landed" overstates item 10 (void'd-promise sweep)
- **Claim:** `ROLLOUT_ROADMAP.md:90` — "Phase A ✅ COMPLETE … All 17 items landed as 13 tasks."
- **Code / self-disclosure:** The same doc (`:95-98`) and `SESSION_HANDOFF.md:69-73` both list a still-owed "void-fix micro-slice": unguarded `Home.tsx` mount fetches, remaining `actionsForPlayer` rejection sites (claim/release/reset/duplicate — the same dropped-rejection class item 10 targeted), and frozen-file void calls (`SplitClearPlanner` ×4, `LodestoneSearchModal` ×12).
- **Truth:** 16/17 genuinely done; item 10 (the unhandled-rejection sweep) is partial by the roadmap's own admission. Low severity, but the headline overstates.
- **Fix:** Downgrade the Phase-A headline to "16/17; item 10 partial," or complete the void-fix micro-slice and then mark it done.

### A4. `[DOC-STALE-ONLY]` Comment claims the Settings ⌘K action is a no-op
- **Claim:** `CommandPalette.tsx:143` — "Still a no-op in v2 until the settings host is mounted."
- **Code:** `V2SettingsHost` is mounted (`NewShell.tsx:367`); the action works. `FOUNDATION_ROADMAP.md:62` confirms "Settings-host mounted — RESOLVED."
- **Truth:** Stale comment; no functional impact.
- **Fix:** Delete the stale comment.

---

## Bucket B — Planned but never built (the real backlog)

Ordered user-facing / functional first. These are honestly-deferred or silently-dropped goals — the redesign's actual thesis, still unrealized.

### B4. `[STUBBED]` The "More" junk drawer — to be deleted + every item re-homed
- **Intent:** `PRODUCT_MODEL.md §5` ("Delete it. Each item gets a real home") + `REDESIGN_SPEC.md §7` (🗑️ delete-as-surface).
- **Code:** `MorePage.tsx` is a live v2 surface whose **"Exports"** (`:286`) and **"Activity Log"** (`:298`) cards are "Coming soon" placeholders that do nothing.
- **Work:** Give Exports and Activity Log real homes (or cut them), then delete the More surface.

### B7. `[PARTIAL]` The 4-tab collapse is cosmetic
- **Intent:** `REDESIGN_SPEC.md §3.2` — four tabs not five; extra destinations genuinely re-homed; ≤2 levels deep.
- **Code:** Desktop `Spine.tsx:12-17` is a clean 4 tabs, but `goals` / `plugin` / `more` remain full reachable pages via ⌘K and mobile bottom nav (`GroupViewContent.tsx:1140/1154/1219/1239`). Removed from the tab bar, not from the app.
- **Work:** Depends on B4/B5/B6 landing real homes; then remove the off-spine reachability.

### B5. `[NEVER-BUILT]` Tracking / Goals — fold into the Progress Engine tracks
- **Intent:** `PRODUCT_MODEL.md §5, §3.3` — Tracking folds into Progress-Engine content tracks.
- **Code:** pageMode `goals` renders the legacy Tracking body verbatim in v2 (`GroupViewContent.tsx:1140`), reachable via ⌘K "Go to Tracking" (`CommandPalette.tsx:119`). Only Home's display-only `TrackCard` gestures at the concept.

### B6. `[NEVER-BUILT]` Plugin — re-home into Settings / Player Hub
- **Intent:** `PRODUCT_MODEL.md §5` / `REDESIGN_SPEC.md §7` (♻️ Plugin → Player Hub/Settings — "setup, not a daily destination").
- **Code:** pageMode `plugin` renders legacy `PluginPage` in v2 (`GroupViewContent.tsx:1219`), reachable via ⌘K "Go to Plugin" (`CommandPalette.tsx:127`).

### B2. `[NEVER-BUILT]` Player Hub (Person-layer home)
- **Intent:** `REDESIGN_SPEC.md §5.5` — a first-class blueprint screen.
- **Code:** Rail "Player Hub" → `/profile`, the **legacy** `Profile` page (`NewShell.tsx:319`; `App.tsx:160`). `FOUNDATION_ROADMAP.md:48` concedes it was "light-passed (Ring-1, deferred)."

### B3. `[NEVER-BUILT]` Static Finder (recruitment-as-matching)
- **Intent:** `REDESIGN_SPEC.md §5.6`.
- **Code:** Rail "Static Finder" → `/discover`, the **legacy** `Discover` page (`NewShell.tsx:327`).

### B8. `[PARTIAL]` Person-layer context rail — built only as an in-static switcher
- **Intent:** `PRODUCT_MODEL.md §3.1` / `REDESIGN_SPEC.md §3.1` — a persistent Person-layer rail across the app.
- **Code:** `AppRail` mounts **only** inside `/group/:shareCode`; its Person targets are hardcoded `isActive:false` ("NewShell only renders on /group routes", `NewShell.tsx:317`). Everywhere else the app is still the legacy `Layout`/`Header`. The rail is a static-avatar switcher, not the Person layer.

### B1. `[PARTIAL]` ⌘K "do anything" — navigate-only shipped
- **Intent:** `REDESIGN_SPEC.md §3.4/§5.7` — ⌘K should do anything (log a drop, log the week, RSVP, who-needs-X).
- **Code:** `CommandPalette.tsx:15` — "Actions … are DEFERRED — navigate-only is the scope." Only tab-nav + switch-static exist. (F6a release note honestly says "navigate-only.")

### B9. `[PERF-DEBT · PRE-EXISTING]` Whole-roster re-render on every gear tick
- **Symptom:** Toggling have/augmented on one player card re-renders **every** card in the roster, not just the one clicked. Felt as ~1s lag in the dev build; masked (but still present as wasted work) in prod. **Not a redesign regression** — identical on `main`, so it already ships in live V1.
- **Cause:** `PlayerGrid.tsx:385` — the shared `renderCardProps` `useMemo` includes `allPlayers: players` and lists `players` in its deps (`:424`). Every optimistic update (`tierStore.ts:272` `.map`) makes a new `players` array → new props object → `memo` bypassed on all `PlayerCardRenderer`s.
- **Fix (cheap, O(1)):** `allPlayers` is only consumed lazily inside `AssignUserModal` when it's open (`PlayerCard.tsx:853/870` → `AssignUserModal.tsx:110`); it is dead weight on the normal render path. Decouple it from the shared bundle (pass live players only where the modal needs it, or read from the store at the modal). **Shared code — main-targeted, not a v1-parity change; verify parity-neutral (SHARED-DRIFT lens) before touching.** May be mooted by the V2 roster rework — do not prioritize until then.

---

## Next moves (sequencing)

1. **Correct the status docs (A1–A4)** — make `FOUNDATION_ROADMAP.md` / `ROLLOUT_ROADMAP.md` describe the dual-shell, legacy-default reality. Prerequisite for the guardian.
2. **Stand up `xivrp-director`** — the plan-fidelity + anti-regression guardian, charter enforcing against `PRODUCT_MODEL.md` (source of truth), this doc, and V1-parity.
3. **Ring-model the Bucket B backlog** — Ring-0 polish (void-fix micro-slice A3, mobile TopBar overlap) → IA collapse (B4/B5/B6/B7) → Person layer (B2/B3/B8) → ⌘K actions (B1). Tasks chosen one-by-one with the user; no surface replacement without a user-reviewed affordance-parity matrix.
4. **(2026-07-25) Coverage re-sequencing — RATIFIED.** The user directed 100% V2 coverage ("anything that can be clicked, navigated to, or reached via V2 should have 100% coverage of V2 versions"). `V2_COVERAGE_PLAN.md` is the ratified staged plan: it pulls **B8 (v2 chrome on every route) ahead of the IA collapse (B4–B7)**; the ring order in item 3 then resumes (IA collapse → B2/B3 → B1). Intent only — no bucket status changes here; execution starts after Phase G merges (plan §6 D1), and the Stage-1 chrome parity matrix (D5) is a pre-code hard gate.
   **Update (2026-07-25, later): Stages 0–1 EXECUTED and user-merged (PRs #176–#181) — B8 is closed at chrome level** (director matrix sweep + live-validation checklist both passed; see the plan's execution-status header). The v2 opt-in stays DARK behind the D7 admin gate pending the user's un-gate decision. Next per the ring order: Stage 2 (IA collapse B4–B7) → Stage 3 (Player Hub B2) → Stage 4 (Static Finder B3) → Stage 5 (docs/admin fit incl. the /admin v2 scrollbar carry-forward) → Stage 6 (⌘K B1).

## Governing rule (why we're here)

The documented root cause (`ROLLOUT_ROADMAP.md §0`) is that V2 was built to per-slice specs **without ever verifying affordance-parity with V1**, so simplifications compounded and docs drifted from the tree. Every change from here forward is verified against the product model and against V1-parity before it is called done. **"Done" means demonstrated in the running app, not asserted in a doc.**
