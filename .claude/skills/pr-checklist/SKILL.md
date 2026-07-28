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

## Pre-PR Audit Checklist

Before declaring a branch ready, run:
```powershell
git diff --name-only | Select-String "frontend/src|backend/app"
git diff --name-only | Select-String "releaseNotes.ts"
git diff --name-only | Select-String ".github/workflows"
```

1. If `frontend/src/` or `backend/app/` changed and `releaseNotes.ts` did **not** change → stop and add the release note entry.
2. If `.github/workflows/` changed and the workflow writes to PRs → confirm the fork guard exists.
3. Run `git diff --check` to catch whitespace errors.

## Agent Prompt Template

Paste this block at the **end** of any coding agent task prompt to embed the checklist as a blocking requirement:

```
Before opening the PR, run the pr-checklist:
- Does this touch frontend/src/ or backend/app/?
  - Yes + user-facing → add public releaseNotes.ts entry, bump CURRENT_VERSION
  - Yes + internal only → add internal: true entry, no CURRENT_VERSION bump
  - No → no release note needed
- Use `pr` + `prTitle` fields in the release note, NOT `commits`
- Run: pnpm build (uses tsc -b — stricter than tsc --noEmit), pnpm lint, pnpm test, pnpm check:design-system:strict
- If .github/workflows/ changed and the workflow writes to PRs → confirm fork guard exists:
    if: github.event.pull_request.head.repo.full_name == github.repository
- Run git diff --check for whitespace errors
```
