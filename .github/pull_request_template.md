## Summary

<!-- Brief description of what this PR does and why -->

## Changes

<!-- List key changes -->

---

## Required Checks

### Release Notes
- [ ] This PR does **not** touch `frontend/src/` or `backend/app/` (skip below)
- [ ] `frontend/src/data/releaseNotes.ts` updated
  - [ ] User-facing change: normal entry added
  - [ ] Internal-only change: entry has `internal: true`, `CURRENT_VERSION` not bumped

### Fork PR Guard (if workflows changed)
- [ ] This PR does **not** modify `.github/workflows/` (skip below)
- [ ] Any PR-write action (labels, comments, assignees) has fork guard:
  ```yaml
  if: github.event.pull_request.head.repo.full_name == github.repository
  ```

### General
- [ ] No AI attribution in commits or PR body
- [ ] `git diff --check` passes (no whitespace errors)
- [ ] CI passes: types, lint, design system, tests, build
