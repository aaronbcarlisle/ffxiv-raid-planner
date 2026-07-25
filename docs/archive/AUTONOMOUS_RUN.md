> **⛔ DEPRECATED / ARCHIVED 2026-07-23.** This was the plan for running the redesign
> **autonomously** (auto squash-merging slice PRs, self-gated CI). That approach produced
> regressions and doc-drift and was **abandoned in the 2026-07-23 pivot** — the redesign
> now proceeds **step-by-step with the user**, guarded by the `xivrp-director` agent.
> Retained for historical reference only. Plan of record: `design/redesign/ROLLOUT_ROADMAP.md`;
> ground truth: `design/redesign/RECONCILIATION.md`.

---

# Autonomous Run — F6d → F6e → Parity-Flip-Ready

> Setup + kickoff for running the remainder of the redesign autonomously, starting AFTER
> `f6c-board` is squash-merged and bookkeeping is pushed. Written 2026-07-01.
> Human touchpoints: kickoff · async spec skims (F6d, F6e, parity-flip) · holistic design
> review + flip go/no-go · foundation→main review. Everything else is autonomous,
> including squash-merging slice PRs.

---

## 1. One-time setup checklist (do these before kickoff)

- [ ] **f6c-board merged.** Confirm `redesign/foundation` head has advanced past `a7c9a61`
      and the post-merge bookkeeping commit is pushed. Note the new head SHA — the kickoff
      prompt below has a `<FOUNDATION_HEAD>` placeholder for it.
- [x] **Permissions — DONE 2026-07-01.** `.claude/settings.local.json` now has
      `defaultMode: acceptEdits` + broad allows (`git`/`gh`/`pnpm`/`node`/`npx` on both
      shells, localhost HTTP, backend-start commands, chrome-devtools + playwright MCP
      servers) + a deny list (`push --force`, `reset --hard`, `repo delete`). Residual
      risk: a command shape outside these prefixes still prompts — if a run stalls on
      one, add the prefix, or restart with `claude --permission-mode auto` (research
      preview: a server-side classifier approves safe actions and blocks dangerous
      ones; the deny list still applies on top). `--dangerously-skip-permissions` is
      the last resort only, since it approves EVERYTHING including what auto mode
      would catch.
- [x] **GitHub merge authority — VERIFIED 2026-07-01.** `gh` authed as `aaronbcarlisle`
      (ADMIN, `repo` scope). `redesign/foundation` has NO branch protection and NO
      rulesets → self-merge unblocked. Consequence: GitHub will NOT force CI green
      before merge — the run must gate itself (see §3.1). `main` keeps 5 required
      checks + required reviews (user-merged, unaffected).
- [x] **Reviewer model pin — DONE 2026-07-01.** `model: fable` added to
      `.claude/agents/redesign-reviewer.md` frontmatter (below `effort: xhigh`).
- [x] **Quality-gate hooks — DONE 2026-07-01.** `.claude/settings.local.json` now wires
      three hooks (scripts in `.claude/hooks/`, gitignored, all fail OPEN):
      **commit guard** (PreToolUse on Bash/PowerShell: `git commit` with frontend TS
      staged runs `tsc -b` first — mechanically enforces the "`tsc -b` ≠ `tsc --noEmit`"
      CI footgun; blocks with the type errors on failure), **merge guard** (`gh pr merge`
      requires `gh pr checks` green — mechanical enforcement of §3.1 never-merge-red),
      and **post-edit lint** (PostToolUse on Edit/Write: scoped `eslint --quiet` on the
      touched `frontend/src` file — errors only, so legacy warn-level debt stays
      untouched per byte-for-byte) + a **Notification hook** (Windows toast when the
      run pauses/needs input). These fire deterministically, including inside
      subagents — do not remove them to "unblock" a step; fix the underlying failure.
- [ ] **Channels (optional, recommended) — user step.** First-party Telegram channel
      (research preview; prereqs VERIFIED 2026-07-01: Claude Code 2.1.198 ≥ 2.1.80,
      Bun 1.3.11 installed, individual account = no org gate). One-time setup:
      1. Telegram → [@BotFather](https://t.me/BotFather) → `/newbot` → name it →
         copy the token.
      2. In any Claude Code session: `/plugin install telegram@claude-plugins-official`
         (if not found: `/plugin marketplace update claude-plugins-official`), then
         `/reload-plugins`, then `/telegram:configure <token>` (saved to
         `~/.claude/channels/telegram/.env`).
      3. Restart: `claude --channels plugin:telegram@claude-plugins-official`
         — the KICKOFF SESSION must include this flag (events only arrive while a
         session with the channel is open).
      4. DM your bot anything → it replies a pairing code →
         `/telegram:access pair <code>` → `/telegram:access policy allowlist`
         (lock to your account ONLY — allowlisted senders can approve permission
         relays, so never add anyone else).
      Result: the run messages you at spec pauses, you reply from your phone in the
      same chat; permission prompts relay as `yes <id>` / `no <id>`. Without this,
      the Notification-hook toast covers pause alerts on this machine only.
      (Zero-setup alternative: **Remote Control** — drive the local session from the
      Claude mobile app; see code.claude.com/docs/en/remote-control.)
- [ ] **Dev environment for browser validation.** Chrome (with the devtools MCP plugin)
      available; ports 8001/5174 free. The run starts backend/frontend itself as
      background tasks (backend MUST run from `backend/`, see SESSION_HANDOFF).
- [ ] **Model.** Start the session on **Fable 5**, effort default **high** (the run bumps
      itself to ultracode at the moments listed in §3).

## 2. Kickoff (one fresh session, repo root)

Start a fresh Claude Code session at `D:\FFXIV\Dev\xrp-dev\ffxiv-raid-planner` and paste:

> Continuing the FFXIV Raid Planner redesign — **autonomous run**, per
> `design/redesign/AUTONOMOUS_RUN.md` (read it, §3–§5 are your standing orders).
> Foundation head = `<FOUNDATION_HEAD>` (f6c-board merged). Remaining plan:
> **F6d (Loot) → F6e (Schedule) → parity-flip prepared (NOT merged)**, then stop for my
> design-review checkpoint. Orient: `SESSION_HANDOFF.md` → `.superpowers/sdd/progress.md`
> → `design/redesign/FOUNDATION_ROADMAP.md` §2.1 → memory. Use the proven cadence
> unchanged per slice: spec (ultracode) → **PAUSE for my async spec skim** →
> writing-plans → subagent-driven-development (implementers **sonnet-5** by default,
> haiku for mechanical sweeps, opus/fable ONLY for tasks the plan explicitly flags
> riskiest; reviewer = `redesign-reviewer` per task + final whole-branch, dispatched
> diff-scoped per §5) →
> browser-validation → PR into `redesign/foundation` → pr-review-loop → **you
> squash-merge it yourself** → bookkeeping + SESSION_HANDOFF + ledger updates, then
> continue to the next slice. Standing authorizations and stop conditions are in
> AUTONOMOUS_RUN.md §3/§4. NO AI attribution, byte-for-byte legacy until the flip,
> internal release notes only, no CURRENT_VERSION bump while flag-gated.

At each **spec pause**, the DEFAULT is: reply "approved" (or notes), then start a
**fresh session** and paste the continuation line the run leaves at the top of
`SESSION_HANDOFF.md`. Fresh-per-slice is now the rule, not an option: a long session
replays its entire context on every turn — cache reads were ~2/3 of the June run's
token cost — and the handoff file (§5, mandatory) makes the restart lossless.
Replying in-session is the fallback only when a slice is trivially small.

## 3. Standing authorizations (the run acts without asking)

0. **Snapshot FIRST (mandatory step 0, before any other action):**
   ```bash
   git fetch origin
   git tag -a pre-autonomous-run -m "Snapshot: foundation before autonomous run (post f6c-board)" <FOUNDATION_HEAD>
   git branch foundation-pre-auto <FOUNDATION_HEAD>
   git push origin pre-autonomous-run foundation-pre-auto
   mkdir -p /d/FFXIV/Dev/xrp-dev/.snapshots/pre-autonomous-run
   cp SESSION_HANDOFF.md .superpowers/sdd/progress.md /d/FFXIV/Dev/xrp-dev/.snapshots/pre-autonomous-run/
   cp -r "C:/Users/aaron/.claude/projects/D--FFXIV-Dev-xrp-dev-ffxiv-raid-planner/memory" /d/FFXIV/Dev/xrp-dev/.snapshots/pre-autonomous-run/memory
   ```
   The artifact snapshot lives OUTSIDE the repo (never committed — the repo is public).
   The tag/backup-branch are protected from the run itself by the settings deny list
   (no tag/branch deletion, no force-push). Report the created refs in the first
   status message, then proceed.
1. **Self-merge:** after a slice's pr-review-loop closes clean (all findings fixed,
   pushed-back with documented rationale, or explicitly deferred), AND
   `gh pr checks <n> --watch` reports every PR check passing (`redesign/foundation` is
   unprotected, so GitHub will not enforce this — the run must), run
   `gh pr merge --squash` on the slice PR. Never merge over a red or pending check
   (the PreToolUse merge-guard hook also enforces this mechanically — if it blocks,
   the checks are not green; fix that, never bypass the hook). Then do post-merge bookkeeping exactly as
   F1–F6c did (doc commit on foundation, push, update memory/handoff/ledger).
2. **Plan-time decisions:** make each call per established doctrine (feature-identity
   audit, byte-for-byte, defer-design-taste, route-out-of-ring0), document it in the PR
   body, AND append it to the **"Decisions to ratify"** list in `SESSION_HANDOFF.md`.
3. **Specs/plans:** write F6d, F6e, and parity-flip specs + plans without checking in —
   but pause after each spec for the async skim (§2).
4. **Model + effort self-management:** ultracode for spec writing, whole-branch-review
   adjudication, and contested pr-review-loop findings; high for the implement loop;
   reviewer always xhigh on fable (pinned in the agent def — do not override down).
   Implementer dispatches default `model: sonnet-5`; haiku for mechanical sweeps
   (grep-and-list, suppression audits, rename passes); opus/fable ONLY where the plan
   explicitly flags a task riskiest (aggregation, assembly, byte-for-byte
   reproduction). Bump, don't cruise, at judgment forks — escalating one flagged task
   to fable is cheap; running the whole loop on opus is not (opus was 72% of June
   spend, and per-task review catches what a cheaper implementer misses).
5. **Environment:** start/stop dev servers, run the full CI gate, use browser MCP for
   validation, retry transient failures.

## 4. Hard stop conditions (end turn and wait for the user)

- A spec is finished (async skim pause — F6d, F6e, parity-flip).
- **F6e is merged and the parity-flip spec/plan is ready** → STOP. The user runs the
  holistic design review (deferred-taste list in memory `feedback-defer-holistic-review`
  + F6b/F6c accepted-deviation lists) and gives the flip go/no-go. Do NOT merge the flip.
- Anything touching production users or `main` (foundation→main PR is user-reviewed).
- A contested review finding where doctrine genuinely doesn't decide it (rare; prefer
  deciding + ratify-list).
- CI red that survives two distinct fix attempts (don't thrash; write up and stop).

## 5. Per-slice invariants (unchanged from F1–F6c — fold into every dispatch)

- BYTE-FOR-BYTE legacy; only sanctioned legacy edits = behavior-neutral promote-and-
  repoint extractions, test-locked, documented in the PR body.
- No new `eslint-suppressions.json` entries; prune the slice's domain entries when real.
- Gate green on land: `pnpm build` · `pnpm lint` (0 err) · `pnpm check:design-system:strict`
  · `pnpm test` · `pnpm tokens:check` · `git diff --check`.
- Internal release note (`{ internal: true }`), no version bump, backfill `pr:0`→N.
- NO AI attribution anywhere. Document deliberate decisions in the PR body.
- Write `SESSION_HANDOFF.md` + the progress ledger BEFORE starting the next slice
  (this is the context-summarization safety net — never skip it).
- Browser validation after first mount + final pre-PR pass (dev-auth `/api/dev-auth/login/0`
  → `/group/DEVTST?shell=v2`).
- **PRs with UI updates/changes MUST include screenshots** (user rule, 2026-07-01): capture the
  changed surfaces during browser validation (chrome-devtools MCP `take_screenshot` — light + dark
  where tokens changed, before/after where a surface was redesigned) and embed them in the PR body
  (commit under `docs/redesign/pr-shots/` or upload via `gh` — images must be visible in the PR,
  not just referenced as local paths). Visual context is part of the review record.
- **Reviewer dispatches are diff-scoped:** task brief + review-package diff + the spec
  section it implements + global constraints — never whole-repo orientation dumps or
  full spec/plan documents. The whole-branch review is the one exception: it gets the
  full branch diff package (that breadth is its job). This matches the agent's own
  "don't broaden the search" rule and keeps its xhigh reasoning spent on the diff.

## 6. Slice order + notes

| # | Slice | Notes |
|---|---|---|
| 1 | **F6d — Loot** | Biggest remaining slice. Spec must settle: unified `RecipientPicker` (kills QuickLogDropModal+AddLootEntryModal forks), Priority⇄History via `SegmentedToggle`, FloorCard/FloorDropRow/PriorityRow/FairnessSummary/WeekGroupHeader, **full week-clock semantics** (first real consumer), and the `need.up` GearBoardCell priority highlight reserved in f6c-board. |
| 2 | **F6e — Schedule** | SessionRsvpCard (shared w/ Home), AvailabilityHeatmap (read-only aggregate; per-member editing re-homes to Person layer), WeekNavigatorStrip. Depends on F6d's week clock. |
| 3 | **Parity-flip (prepare only)** | Spec + plan + branch: flip `?shell=v2` to default, delete legacy GroupView chrome, prune remaining suppressions, re-enable remaining contrast harness screens, public release note + version bump (first user-facing entry). Riskiest slice — implementers opus/fable. **Stops before merge for the user checkpoint.** |

After the user checkpoint: polish slice from the design review → flip merges →
foundation→main PR (user reviews + merges) → post-flip cleanup (`/docs/design-system`
page rebuild, Rings 1→3 per PRODUCT_MODEL §7) is the NEXT roadmap, out of this run's scope.

---

## 7. Snapshot · rollback · A/B (user recipes)

The run's step 0 (§3.0) creates: tag `pre-autonomous-run` + branch `foundation-pre-auto`
(both pushed) + an artifact copy (SESSION_HANDOFF, SDD ledger, memory dir) at
`D:\FFXIV\Dev\xrp-dev\.snapshots\pre-autonomous-run\`. `main` is never touched by the
run, and every slice lands as ONE squash commit on `redesign/foundation` — so the run's
entire output is a short, linear, per-slice commit range.

**Review what the run did (cheapest A/B):**
```bash
git log --oneline pre-autonomous-run..redesign/foundation   # one commit per slice
git diff pre-autonomous-run..redesign/foundation --stat
gh pr list --state merged --base redesign/foundation        # each slice PR = full record
```

**Live A/B (both versions running side-by-side):**
```bash
git worktree add ../ffxiv-raid-planner-preauto pre-autonomous-run
cd ../ffxiv-raid-planner-preauto/frontend && pnpm install && pnpm dev --port 5175
```
→ pre-run UI at `:5175`, post-run UI at `:5174`, both against the shared backend `:8001`
(F6 slices are frontend-only; if a slice ever touches `backend/`, run a second backend
from the worktree on another port). Compare `/group/DEVTST?shell=v2` in two tabs.
Cleanup: `git worktree remove ../ffxiv-raid-planner-preauto`.

**Full rollback (discard the run entirely):**
```bash
git checkout redesign/foundation
git reset --hard pre-autonomous-run
git push --force-with-lease origin redesign/foundation
```
Then restore the artifact snapshot: copy SESSION_HANDOFF.md + `.superpowers/sdd/progress.md`
back from `.snapshots\pre-autonomous-run\`, and restore the memory dir from the same place
(the run updates memory as it merges slices — rolled-back memory would otherwise describe
merged work that no longer exists). Merged slice PRs stay closed on GitHub (harmless
history). These commands are deliberately DENIED to the run itself — only you can do this.

**Partial rollback (keep some slices):** each slice is one squash commit, so
`git reset --hard <sha-of-last-slice-to-keep>` + the same force-push, or
`git revert <slice-sha>` to keep history append-only.
