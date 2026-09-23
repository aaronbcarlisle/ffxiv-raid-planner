---
name: slice-loop
description: Execute a V2 redesign slice plan in this repo — implement all tasks, ONE whole-branch review, one fix wave, draft PR. Replaces superpowers:subagent-driven-development here; never load that skill in this repo.
---

# Slice loop (XIV Raid Planner)

The repo's execution loop for a slice plan. It keeps the SDD mechanics that pay for themselves (a fresh implementer per task, briefs and reports as files, a ledger that survives compaction, review packages as diff files) and drops the ones D12 measured as the cost (a reviewer per task, fix rounds for Minors, mid-slice plan write-backs, per-ruling mutation batteries, 10–37 KB reports). CLAUDE.md § Slice loop is the ruling; this file is how to run it. The agent definitions in `.claude/agents/` carry the standing rules — dispatch prompts never restate them.

**Stop for only four things:** an irreversible or destructive operation; a security-sensitive action; a side effect outside the worktree (merge, push to a shared branch, publish); a plan so broken that every path forward is a guess. Everything else you rule on and ledger: `Ruling: <what> — <why> — cost if wrong: <…>`. Never merge — the user merges.

## 0. Setup (once per slice)

- Fresh session, on a branch off `main` (`feat/phase-<slice>-<name>`). Never implement on main.
- Plan = `design/redesign/plans/<date>-<slice>.md`, **3–4 tasks**. More than that: split now, run the first half, the rest is its own slice and PR. The spec the plan argues from lives under `design/redesign/specs/`.
- Workspace: `bash .claude/skills/slice-loop/scripts/sdd-workspace PLAN` prints `.superpowers/sdd/<plan>/` (git-ignored). Ledger = `<ws>/progress.md`, first line `# Slice ledger — plan: <path>`. If it already exists with `Task N: complete` lines, resume after them — never re-dispatch a completed task. After compaction, trust the ledger and `git log` over memory.
- Read the plan once; a todo per task; one conflict scan (task-vs-task shared files and interfaces, task-vs-global-constraints) written to the ledger as a table with rulings. Dispatch `xivrp-director` for a plan-vet only if the planning session did not already do it (the plan says so).

## 1. Task loop — no review inside it

For each task in plan order, never in parallel:

1. `BASE=$(git rev-parse HEAD)`; `bash .claude/skills/slice-loop/scripts/task-brief PLAN N` prints the brief path.
2. Dispatch per CLAUDE.md § Agent roster (`xivrp-implementer`; `-deep` for the flagged riskiest task; `model: haiku` when the brief contains the complete code) with [implementer-dispatch.md](implementer-dispatch.md): the brief path, interfaces from earlier tasks, your rulings, the report path. Never paste the plan or prior-task history.
3. Handle the status. **DONE** → ledger `Task N: complete (commits a7..b7)`, next task. **DONE_WITH_CONCERNS** → read them; a correctness or scope concern gets a same-agent fix message now, an observation goes to the ledger. **NEEDS_CONTEXT** → answer and re-dispatch. **BLOCKED** → more context, a more capable model, a smaller task, or a plan ruling — never the same dispatch again.
4. **Riskiest task only** (the plan flags one or none): `review-package PLAN $BASE HEAD` → `redesign-reviewer` with [whole-branch-review.md](whole-branch-review.md) scoped to that task. Critical/Important → same-agent fix now, re-review the fix diff. Minors → ledger `Task N: minor (batched): …`.

Batch small same-shape tasks into one dispatch. Between dispatches do ledger work; never poll. Never fix in the controller session.

## 2. Browser validation

After the last task, walk every touched v2 surface live (dev-auth login → `/group/DEVTST?shell=v2`; recipe in memory `feedback_browser_validation_process`). Shots go to `docs/redesign/pr-shots/`, shrunk per the `pr-checklist` skill. A live-only defect is a task-loop fix (same implementer), not a review finding.

## 3. Review once

`bash .claude/skills/slice-loop/scripts/review-package PLAN $(git merge-base main HEAD) HEAD` → dispatch `redesign-reviewer` with [whole-branch-review.md](whole-branch-review.md): the package path, plan + spec paths, the global constraints verbatim, and the ledger's batched-minor lines for triage. Never pre-judge findings in the prompt ("do not flag…", "at most Minor…").

## 4. One fix wave

- Critical/Important (plus any ⚠ item you confirm is a real gap) and the batched Minors → **one** dispatch to the implementer with the complete list. `FIX_BASE` = the head the review saw.
- Re-review the wave's diff only: `review-package PLAN FIX_BASE HEAD` → `redesign-reviewer` with [fix-wave-rereview.md](fix-wave-rereview.md).
- Residuals: park with a ruling in the ledger and disclose them in the PR body. A second wave only if a residual is Critical — then exactly one more, and say so in the PR body.
- Minors never trigger a wave on their own.

## 5. Finish

1. Plan/spec write-back **once**: only rulings that bind a later slice, one commit.
2. Invoke the `pr-checklist` skill: release note, screenshots, `git diff --check`, fork guard.
3. Gates on the branch, counts pasted into the PR body: `pnpm build`, `pnpm lint` (0 errors, warnings ≤ main's count), `pnpm check:design-system:strict`, `pnpm test`, `pnpm deadcode` unchanged; backend `pytest` if backend changed.
4. `gh pr create --draft`; push any late fixes to the draft; mark ready once. Bots run on ready. The user merges.
5. Final message = "Rulings I made" (every `Ruling:` line from the ledger, in order, with cost-if-wrong) + the PR link + the loop's numbers for this slice (tasks, fix waves, commits, artifact KB, wall clock) against D12's 8 / 8 rounds / 30 / 838 KB / ~12 h. Rewrite `SESSION_HANDOFF.md` (≤ ~5 KB). After the user merges: delete the workspace and the branch both ends.

## Ledger lines

`Task N: complete (commits a7..b7)` · `Task N: concern: …` · `Task N: minor (batched): …` · `Ruling: … — … — cost if wrong: …` · `Review: <package> — C/I/M = x/y/z` · `Fix wave: FIX_BASE..HEAD (<X> addressed, <Y> parked)` · `Parked: <finding> — Ruling: …`

## Rationalizations this loop refuses

| Excuse | Reality |
|--------|---------|
| "A task review here is cheap insurance" | It was 8 fix rounds and half a day on D12. The whole-branch review is the gate; the riskiest task is the one exception. |
| "This Minor really deserves its own round" | Then it is Important — rate it so and say why. Otherwise it batches. |
| "Write the ruling into the plan now while it's fresh" | The ledger holds it. The plan gets one write-back at the end. |
| "Add a mutation row per ruling to be safe" | One executed trace on the test you believe vacuous, pasted. Batteries are retired. |
| "I'll fix this myself, dispatching is overhead" | Controller fixes skip review and pollute your context. Dispatch. |
| "The report needs the design rationale" | The reviewer is told not to trust rationale. Files, gate output, concerns — ~40 lines. |
