# Plan M — Self-Service Leave, Danger-Zone Wiring & Account Data Controls

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Origin:** Production user report (2026-06-26). A member ("Grimm") tried to leave the **Girliepops** static; the **"Leave Static"** button "goes nowhere" and his membership persisted — an admin had to remove him manually from the DB. Two real defects + one missing feature surfaced:
1. **Bug (priority):** the danger-zone buttons are **non-functional stubs** — `Leave Static`, `Archive Static`, and `Delete Static` all just call `onOpenSettings('danger')` and never perform the action.
2. **Gap:** there is **no self-service account disconnect / data export / data deletion** anywhere in the app. The only way to remove a user's data today is a manual prod-DB operation.
3. **Design-system:** the three danger-zone controls are raw `<button>`s (must be `Button`).

**Goal:** Make the danger zone actually work — a member can leave a static, an owner can delete/archive — and give users a real **Account → Data & Privacy** surface to disconnect/export/delete their own account, so manual DB intervention is never required again.

**Architecture:** The leave/remove capability **already exists** end-to-end — `staticGroupStore.removeMember(groupId, userId)` → `DELETE /api/static-groups/{groupId}/members/{userId}`. The bug is purely that the UI button was never wired to it (it was stubbed to open the settings panel during the settings-dock work, B/C). Fix by calling the existing action with a confirm + toast + redirect. Account-level deletion is **new** backend work and must honor the FK map below (a naïve `DELETE FROM users` fails on `RESTRICT` constraints).

**Tech Stack:** React 19 + TS, Zustand, design-system primitives, Vitest/@testing-library (frontend); FastAPI + SQLAlchemy (async) + pytest (backend).

> **Line numbers are point-in-time — verify before editing.**

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- Design system: primitives/tokens only (`Button`, `ConfirmModal`, `Select`); run `pnpm check:design-system`. No raw `<button>`.
- "static" not "group" in user-facing copy.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** to `frontend/src/data/releaseNotes.ts` under the single rollout version **`2.0.0`**. **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it.
- Pre-PR gate: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`; backend `cd backend && pytest tests/ -q` where touched.

## Sequencing / hotspot note (see ROADMAP.md)

- **Section 1 is independent and should land early** (like Plan K's bug fixes). To keep it off the serialized `SettingsPanel.tsx` hotspot (owned by B→C→I), wire the leave action **directly in `MorePage.tsx`'s danger zone** (ConfirmModal in place) rather than routing through `onOpenSettings('danger')`. This removes the cross-plan dependency entirely.
- **Sections 2–3** touch the auth router + a new account settings surface; coordinate the owner **Delete Static** path with Plan I/B if they relocate the danger actions into `SettingsPanel`.

---

# Section 1 — Fix: "Leave Static" actually leaves *(PRIORITY — production defect)*

**Diagnosis:** `MorePage.tsx` danger zone (~320–345): the non-owner **Leave Static** button is `onClick={() => onOpenSettings('danger')}` — it opens the settings panel's danger section (which has no wired leave action), so nothing happens. The working path already exists: `staticGroupStore.removeMember(groupId, userId)` (~364) → `DELETE /api/static-groups/{groupId}/members/{userId}`. Current user id is on `authStore`.

## Task 1.1: Wire Leave Static to `removeMember(self)` with confirm + toast + redirect

**Files:** Modify `frontend/src/components/group/MorePage.tsx` (+ test).

- [ ] **Step 1: Write the failing test** (`/** @vitest-environment jsdom */`)
  - Render `MorePage` as a **non-owner member**; click **Leave Static** → a `ConfirmModal` appears; confirming calls the mocked `removeMember(groupId, currentUserId)`; on resolve a success toast fires and navigation goes to the statics list (My Statics/Player Hub). Assert `onOpenSettings` is **not** called by this button.
- [ ] **Step 2: Run → FAIL** — `cd frontend && pnpm test -- MorePage`.
- [ ] **Step 3: Implement**
  - Replace the raw `<button>` with the design-system `Button` (`variant` danger/destructive).
  - On click, open a `ConfirmModal` (`useModal`): title "Leave this static?", body explains they'll lose access and their roster slot is released (their player card stays with the static, unlinked — `snapshot_player.user_id` is `SET NULL` server-side), and **owned statics are unaffected**.
  - On confirm: `await removeMember(groupId, currentUserId)` from `staticGroupStore`; on success show a toast ("You've left {staticName}."), refresh the user's static list, and `navigate` away from the now-inaccessible static. Handle error with `ErrorMessage`/toast.
- [ ] **Step 4: Run → PASS.** Manual: as a member, Leave Static → confirm → you're removed and bounced to the statics list; re-opening the static by code shows viewer-only (or no membership). Verify against the DB that the membership row is gone.
- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/group/MorePage.tsx frontend/src/components/group/MorePage.test.tsx
git commit -m "fix(static): Leave Static actually removes your membership (was a no-op opening settings)"
```

## Task 1.2: Wire the owner danger actions (Delete / Archive)

**Files:** Modify `frontend/src/components/group/MorePage.tsx`; verify store/endpoint support.

- [ ] **Step 1:** **Delete Static** — wire to the existing owner delete path (`staticGroupStore` delete action → `DELETE /api/static-groups/{id}`; verify the symbol). `ConfirmModal` with **type-to-confirm** the static name (it cascades tier snapshots, loot history, schedule, memberships). Convert to `Button`; success toast + redirect.
- [ ] **Step 2:** **Archive Static** — if a backend archive capability exists, wire it; **if it does not, remove the button** (don't ship a stub). Decide explicitly; note the decision in the PR.
- [ ] **Step 3: Verify + Commit**
```bash
git add frontend/src/components/group/MorePage.tsx
git commit -m "fix(static): wire owner danger-zone actions (Delete; Archive or remove the stub)"
```

---

# Section 2 — Backend: self-service account deletion endpoint

**Diagnosis:** No endpoint lets a user delete their own account/data. A raw `DELETE FROM users` fails: several FKs to `users.id` are `RESTRICT` (no `ondelete`). Deletion must be ordered, transactional, and decide what happens to **owned statics** (esp. shared ones with other members).

### FK map to `users.id` (verified from `backend/app/models/`)

| Behavior on user delete | Tables (column) | Handling |
|---|---|---|
| **CASCADE** (auto) | `api_keys`, `notifications`, `mount_farm_progress`, `user_availability`, `schedule_availability_templates`, `personal_availability_templates`, `plugin_auth_codes`, `player_profiles`, `static_content_suggestions(+votes)`, `reward_participant_states`, `memberships` (ORM `delete-orphan`) | nothing extra |
| **SET NULL** (preserved, unlinked) | `snapshot_players.user_id`, `static_activity_log.actor_user_id`, `reward_drop_log.recipient/created_by`, `bis_target_sets.created_by`, `collection_goals.created_by_id`, `static_objective_goals.created_by_id` | leaves others' rosters intact — **correct** |
| **RESTRICT** (blocks delete — must handle first) | `static_groups.owner_id`, `loot_log_entries.created_by_user_id`, `material_log_entries.created_by_user_id`, `page_ledger_entries.created_by_user_id`, `invitations.created_by_id`, `static_join_requests.requester_user_id`/`resolved_by_user_id`, `schedule_sessions.created_by_id`, `schedule_rsvps.user_id`, schedule discord/link tables | explicit delete/reassign in order |

### Owned-statics decision (the one thing that needs a user/owner choice)

`static_groups.owner_id` is `NOT NULL`. For each static the user owns:
- **Solo static** (no other members) → delete the static (cascades its children via ORM).
- **Shared static** (other members exist) → **transfer ownership** to another member (default: longest-standing lead/member) — deleting it would wipe other people's data. The endpoint must support a caller-supplied `owned_static_disposition` map (`transfer:{newOwnerId}` | `delete`) and **refuse** to silently delete a shared static.

## Task 2.1: `DELETE /api/auth/me` (account self-deletion) + service

**Files:** Create `backend/app/services/account_deletion.py`; modify `backend/app/routers/auth.py`; tests in `backend/tests/`.

- [ ] **Step 1: Write failing tests** (`pytest`)
  - Seed a user who: owns a **solo** static, owns a **shared** static (2nd member present), is a **member** of a 3rd static, has loot/material/page-ledger entries, RSVPs, availability, an api key, a player-card link in someone else's roster.
  - Assert: with `disposition={shared: transfer→memberX}`, after delete → user row gone; solo static gone; shared static **survives** with `owner_id = memberX`; the 3rd static survives, user's membership gone; the foreign roster's `snapshot_player.user_id` is **NULL** (slot preserved); loot/material/page rows the user authored are removed (or reassigned per decision); api key gone. Whole thing in **one transaction** (failure → full rollback).
  - Assert: a shared static with **no disposition** → 409/422 (refuses to orphan/delete others' data).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `delete_account(session, user_id, disposition)`:
  1. Resolve owned statics; apply disposition (transfer `owner_id`, or `session.delete(static)` for solo/explicit-delete — ORM cascade handles children).
  2. Delete `RESTRICT` rows authored by the user that aren't owner-scoped (loot/material/page ledger, invitations, join requests, schedule sessions/rsvps).
  3. `session.delete(user)` (fires `memberships` delete-orphan + CASCADE/SET NULL).
  4. Commit; return a **receipt** dict (per-table counts removed, statics transferred/deleted, timestamp).
  - Router: `DELETE /api/auth/me` — auth required, body = disposition, returns the receipt. (Optionally gate behind a re-auth/confirmation token.)
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**
```bash
git add backend/app/services/account_deletion.py backend/app/routers/auth.py backend/tests/
git commit -m "feat(account): self-service account deletion with FK-safe ordered cascade + receipt"
```

## Task 2.2: `GET /api/auth/me/export` (data export / portability)

**Files:** Modify `backend/app/routers/auth.py` (+ test).

- [ ] **Step 1:** Test that an authenticated user gets a JSON bundle of their data (profile, memberships, owned statics, authored log entries, availability, player-card links) — read-only.
- [ ] **Step 2–3:** Implement the aggregation + return as a downloadable JSON. **Run → PASS.** Commit.
```bash
git add backend/app/routers/auth.py backend/tests/
git commit -m "feat(account): GET /api/auth/me/export returns a user's data bundle (portability)"
```

---

# Section 3 — Frontend: Account → Data & Privacy surface

**Diagnosis:** Nothing in the UI lets a user manage their account data. Add it to the user/account settings (the user-menu/account area produced by Plan A/B — coordinate placement).

## Task 3.1: "Data & Privacy" account section

**Files:** Create `frontend/src/components/settings/AccountDataControls.tsx` (+ test); wire into the account settings surface; add store actions (`authStore.deleteAccount`, `exportMyData`).

- [ ] **Step 1: Write failing test** — renders **Export my data** (calls export) and **Delete my account** (opens a multi-step `ConfirmModal`: type-to-confirm + shows which owned statics need transfer-vs-delete, surfacing shared statics with a member picker). Confirming calls `deleteAccount(disposition)`; on success logs out + shows the receipt.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the section with `Button`s + `ConfirmModal` + a per-owned-static disposition picker (`Select`: transfer→member | delete). On delete success, render the **receipt** (what was removed/transferred) so the user has confirmation — then sign out. Export triggers a JSON download.
- [ ] **Step 4: Run → PASS.** Manual: export downloads; delete walks the shared-static transfer flow, completes, shows receipt, logs out.
- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/settings/AccountDataControls.tsx frontend/src/components/settings/AccountDataControls.test.tsx frontend/src/stores/authStore.ts
git commit -m "feat(account): Data & Privacy controls — export + self-service account deletion"
```

---

# Final — Release notes + verification

**Files:** Modify `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1:** Public entries under **`2.0.0`** (do **not** bump `CURRENT_VERSION`): "Leave Static now actually removes you", "Manage your account data — export or delete your account", owner Delete Static wired. Each with `description` + `pr` + `prTitle` + full ISO date.
- [ ] **Step 2:** Full gate — `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`; `cd backend && pytest tests/ -q`; `cd scripts && npm test`.
- [ ] **Step 3:** Commit
```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): self-service leave + account data controls"
```

---

## Self-review notes

- **Section 1 is the production fix** and is intentionally decoupled from the `SettingsPanel` hotspot (handled in `MorePage`) so it can land early/independently.
- The leave capability already exists (`removeMember`); the bug was a stubbed button — verified against the store + endpoint.
- Account deletion honors the **RESTRICT/CASCADE/SET NULL** map above; shared owned statics **must** be transferred, never silently deleted — the endpoint refuses without a disposition.
- The deletion endpoint returns a **receipt** (the same artifact we produced manually for the first request) so users get confirmation in-app.
- **Line numbers are point-in-time** — verify before editing.
