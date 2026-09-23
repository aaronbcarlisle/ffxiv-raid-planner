---
name: pr-checklist
description: Pre-PR requirements for the FFXIV Raid Planner repo — the CI-enforced release-notes entry in releaseNotes.ts (internal vs public, CURRENT_VERSION rules, pr/prTitle over commits), the GitHub Actions fork-PR guard, and the pre-PR audit checklist. Use before opening, updating, or declaring ready any PR that touches frontend/src, backend/app, or .github/workflows.
---

# Pre-PR Checklist (FFXIV Raid Planner)

PRs to main run: `build` (`tsc -b && vite build`), `lint`, `check:design-system:strict`, `test`. All must pass.

> **⚠️ `tsc --noEmit` ≠ `tsc -b`** — The build script runs `tsc -b` (project build mode), which is stricter than `tsc --noEmit`. Running `tsc --noEmit` locally will NOT catch all the same errors CI catches. Always run `pnpm build` before pushing to confirm the build is clean.

## Release Notes Requirement

Any PR that touches `frontend/src/` or `backend/app/` **must** add or update an entry in `frontend/src/data/releaseNotes.ts`.

**Internal-only changes** (tests, refactors, CI fixes, backend plumbing, security hardening with no visible user change, workflow updates):
```ts
{ internal: true, ... }
```
This hides the entry from users but satisfies CI. Do **NOT** bump `CURRENT_VERSION` for internal-only entries.

**User-facing changes** (bug fixes, features, improvements visible to users) get a normal public release note entry. **Always bump `CURRENT_VERSION`** to match the new version string — including patch releases (e.g. `1.26.0` → `1.26.1`). The `scripts/discord-changelog.test.js` suite enforces that `CURRENT_VERSION` equals the version of the latest non-internal release entry; CI will fail if they differ.

Dates must be full ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`).

**Every item needs a `description`** (CI-enforced on the latest release). The title is a headline; the description is the sentence users actually read on the release-notes page.

**Reference the change with `pr` + `prTitle`, not `commits`.** Add `pr: <number>` (links to `/pull/{n}` on the release-notes page) and `prTitle: '<the PR title>'` (shown next to the `#n` link, like a commit message). The PR number is known as soon as you open the PR, is stable, and survives squash-merge — unlike a commit SHA, which doesn't exist until merge. The old pattern of `commits: [{ hash: 'pending', ... }]` left dead `/commit/pending` links because the placeholder was never backfilled; the page now refuses to link a non-SHA hash. Use `commits` only when you have a **real** short SHA (historical entries) — and you may include both `pr` and `commits`, the page renders a "Pull Request" section and a "Related Commits" section independently. Example:
```ts
{ category: 'fix', title: 'Short headline', description: 'What changed and why it matters.', pr: 128, prTitle: 'fix(scope): the PR title' }
```

## Draft-first PRs — the bots fire on ready, not per push

Since 2026-09-23 `claude-code-review.yml` triggers on `opened` / `ready_for_review` / `reopened` only (no `synchronize`) and skips docs-only PRs, and the Copilot ruleset no longer reviews on push. So:

1. **Open as a draft** (`gh pr create --draft`) while the branch is still moving. CI runs on every push regardless (`ci.yml` skips drafts — flip to ready when you want the full gate).
2. **Mark ready exactly once**, when the branch is final. That `ready_for_review` event is the AI review.
3. **Fix commits after ready get no automatic re-review.** Comment `@claude review` on the PR to request one; Copilot re-review is the "re-request review" button.
4. **Docs-only / agent-prompt / SDD-artifact PRs** get no Claude review by design (`paths-ignore`). Do not wait for one.

## A green review check is not a review

`claude-review` posted nothing for ~4.5 months while its check stayed green (two bugs in one commit: `pull-requests: read` + the plugin missing `--comment`; fixed in #194/#195). It still reports green while skipping in six cases: bot-authored PRs, **fork PRs** (no secrets/OIDC), the `skip-claude-review` label, a `[skip-review]`/`[skip-claude]`/`[no-review]` marker in the head commit message, draft PRs, and any PR that modifies `claude-code-review.yml` itself (the action's anti-tamper validation). Copilot files some findings as suppressed comments that are not review threads, and `claude[bot]` edits its comment in place, so a fresh review keeps its old timestamp. Before treating a PR as reviewed, confirm an actual review comment exists from `claude[bot]` or Copilot — never trust the check mark alone.

## Fork PR Guard (GitHub Actions)

Any GitHub Actions workflow (new or updated) that **writes to PRs** must include a fork guard:
```yaml
if: github.event.pull_request.head.repo.full_name == github.repository
```

Write operations that require this guard:
- Adding/creating labels
- Assigning reviewers or assignees
- Creating/updating PR comments
- Modifying PR metadata

**Why:** Fork PRs receive a read-only `GITHUB_TOKEN`. Without the guard, write actions fail with `HttpError: Resource not accessible by integration`.

Existing guarded workflows: `pr-automation`, `release-notes-reminder`.

## Screenshots (PR rule) — shrink before committing

Every PR with visible UI changes embeds screenshots. They are committed under `docs/redesign/pr-shots/` and embedded as raw URLs pinned to the commit SHA.

**Shrink them first — CI enforces a 120 KB budget per file:**

```bash
python scripts/shrink-pr-shots.py docs/redesign/pr-shots/d7b-*.png
```

That converts to 900px WebP — the exact width PR bodies render at — and replaces the originals. Measured on D7a's eleven shots: **2.22 MB → 170 KB (8%)**, no visible difference. Embed the resulting `.webp` paths.

The `Screenshot size budget` step in the `Scripts Tests` job fails the PR if any screenshot it **adds or modifies** exceeds 120 KB. Files already in history are grandfathered and never checked. Escape hatch for a shot that genuinely needs the detail: add its filename to `docs/redesign/pr-shots/.size-exceptions` with a comment saying why.

> **The old "netted out before merge" convention is RETIRED.** It was meant to keep screenshot blobs out of `main`, but three of four slices shipped without doing it, and git keeps every blob forever — by the time it was noticed, `pr-shots/` was 52.8 MB across 179 files. Deleting them now would reclaim nothing. Shots **stay** in the repo as durable evidence for merged PR bodies; the size budget is what keeps them cheap. Do not re-introduce a netting-out step.

## Pre-PR Audit Checklist

Before declaring a branch ready, run:
```powershell
git diff --name-only | Select-String "frontend/src|backend/app"
git diff --name-only | Select-String "releaseNotes.ts"
git diff --name-only | Select-String ".github/workflows"
git diff --name-only | Select-String "pr-shots"
```

1. If `frontend/src/` or `backend/app/` changed and `releaseNotes.ts` did **not** change → stop and add the release note entry.
2. If `.github/workflows/` changed and the workflow writes to PRs → confirm the fork guard exists.
3. If screenshots were added → run `python scripts/shrink-pr-shots.py` on them, or `node scripts/check-pr-shots.mjs <files>` to confirm they are within budget.
4. Run `git diff --check` to catch whitespace errors.
