# Agent & Contributor Instructions

Rules for AI agents (Codex, Claude, Copilot, etc.) and human contributors working on this repo.

**Read `CLAUDE.md` for full project context.** This file covers the PR-critical rules that every agent must follow.

---

## Absolute Rules

1. **No AI attribution.** Never add "Co-Authored-By: Claude", "Generated with Claude Code", or any AI tool credit to commits, PRs, or code comments.
2. **No touching `backend/app/database.py`** without explicit owner approval.
3. **No pushing** unless explicitly instructed.

---

## Release Notes Requirement

Any PR that changes files under `frontend/src/` or `backend/app/` **must** update:

```
frontend/src/data/releaseNotes.ts
```

- **Internal-only changes** (tests, refactors, CI fixes, backend plumbing, security hardening, workflow changes): use `internal: true` so the entry is hidden from users but satisfies CI.
- Do **NOT** bump `CURRENT_VERSION` for internal-only entries.
- **User-facing changes** get a normal visible release note.
- Dates: full ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`). Each item needs a `commits` array.

---

## Fork PR Guard (GitHub Actions)

Any workflow that **writes to PRs** must include:

```yaml
if: github.event.pull_request.head.repo.full_name == github.repository
```

Write operations requiring this guard:
- Adding/creating labels
- Assigning reviewers or assignees
- Creating/updating PR comments
- Modifying PR metadata

**Reason:** Fork PRs get a read-only `GITHUB_TOKEN`; write actions fail without this guard.

---

## Pre-PR Audit

Before marking a branch as ready, verify:

```powershell
# Check if app code changed
git diff --name-only | Select-String "frontend/src|backend/app"

# Check if release notes were updated
git diff --name-only | Select-String "releaseNotes.ts"

# Check if workflows changed
git diff --name-only | Select-String ".github/workflows"

# Check for PR-writing actions in workflow changes
git diff | Select-String "addLabels|createLabel|addAssignees|createComment|updateComment|pull-requests: write"
```

1. If `frontend/src/` or `backend/app/` changed but `releaseNotes.ts` did not → **stop and add the release note**.
2. If `.github/workflows/` changed and the diff contains PR-write actions → **confirm the fork guard exists**.
3. Run `git diff --check` to catch whitespace errors.

---

## Design System

Before implementing UI, read `docs/UI_COMPONENTS.md` and run `pnpm check:design-system`. Never use raw HTML elements (`<button>`, `<input>`, `<select>`) — use the design system primitives.

---

## CI Checks

All PRs must pass: `tsc --noEmit`, `lint`, `check:design-system:strict`, `test`, `build`.
