I'm beginning a large, multi-plan UI/UX overhaul of the FFXIV Raid Planner web app (`ffxiv-raid-planner/`). The planning is **done** — 12 implementation plans (A–L) plus a spec and an execution roadmap are written under `docs/superpowers/`. The current branch (`feature/ui-polish-pass`) is complete and is the base of the work; nothing merges to `main` until the entire overhaul is finished.

**Read these first, in order:**
1. `docs/superpowers/ROADMAP.md` — the execution order (4 waves), dependency graph, conflict-hotspot table, the **stacked-branch** model, and the version/release coordination. This is the source of truth for *how* to sequence.
2. The memory file `project_rail_settings_plans.md` (loaded into your context at session start) — one-line summary of every plan + key ⚠ flags.
3. `docs/superpowers/plans/` — the plans (A–L, plus **M**). Each is task-by-task with TDD steps and a verification gate.
   - **Plan M** (`2026-06-27-self-service-leave-and-account-data-controls.md`) was added from a production user report: the **"Leave Static" button is a no-op** (and Delete/Archive Static too) — they only open the settings panel. **M §1 (wire Leave Static to the existing `removeMember`) is a prioritized, independent bug fix — land it early (Wave 1/2), handled in `MorePage` off the `SettingsPanel` hotspot.** M §2–3 add a self-service account delete/export surface (the real "let users remove their own data" gap) for Wave 3.

**The model (from ROADMAP.md):**
- **Stacked chain:** each plan branch is cut off the *tip of the previous* plan branch, in dependency order, base = `feature/ui-polish-pass`. Nothing merges until all done; then PRs merge sequentially (current branch first).
- **Order:** Wave 1 (foundation: typography-scale doc, theme tokens, Plan K's `JobSelector`/`TriStateToggle` primitives, **Plan L Phase 0–1** enforcement + constrained primitives as lint-`warn`, and **Plan A** the global rail) → Wave 2 (B→C→I serialized; F, D parallel) → Wave 3 (E, G, H, K fixes) → Wave 4 (Plan L conformance sweeps; ratchet lint `warn→error`).
- **Version:** **Plan A (stack base) bumps `CURRENT_VERSION` once to `2.0.0`**; every other plan adds release-note *entries* under `2.0.0` and does **not** bump (keeps the changelog CI test green).

**How to execute:** Use the `superpowers:executing-plans` skill (or `superpowers:subagent-driven-development` for fresh-subagent-per-task with review checkpoints). Each task ends with the full gate — `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test` (plus backend `pytest` / `scripts` changelog test where touched). **Never claim a task done without showing the gate output.**

**Guardrails (non-negotiable):**
- NEVER add AI attribution to commits/PRs (no "Co-Authored-By", no "Generated with Claude").
- Design system is mandatory (primitives + semantic tokens); "static" not "group" in user-facing copy.
- Line numbers in the plans are point-in-time — **match on code/strings and verify before editing**.
- Per-wave manual smoke: toggle **light/dark** + walk the core flows (log loot, edit roster, schedule/availability, settings).
- ⚠ Plan C must **reconcile with the existing `lib/navPreferences.ts`** (a parallel session already started tab-persistence) — don't ship two systems.

**Start now with Wave 1:** create a branch off `feature/ui-polish-pass` for **Plan A** (`docs/superpowers/plans/2026-06-26-global-app-rail-and-usermenu.md`), set `CURRENT_VERSION` to `2.0.0` as part of it, and execute it task-by-task. First confirm you've read the roadmap and Plan A, then give me your branch name and the first task before writing code.
