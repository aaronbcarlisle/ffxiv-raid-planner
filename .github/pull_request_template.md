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

### Design System
- [ ] This PR adds **no** new UI (skip below)
- [ ] Uses design-system primitives (no raw `<button>/<input>/<select>/<label>/<textarea>`)
- [ ] New navigational text is `LinkText`/`NavRow`; tab strips are `Tabs`; status pills are `Tag` with an explicit `variant`
- [ ] Colors are semantic tokens (no inline hex/`rgb()`, no `bg-[#…]`); text ≥ `text-xs` (no new sub-12px sizes)
- [ ] No **new** `design-system/*` lint warnings in changed files

### General
- [ ] No AI attribution in commits or PR body
- [ ] `git diff --check` passes (no whitespace errors)
- [ ] CI passes: types, lint, design system, tests, build
