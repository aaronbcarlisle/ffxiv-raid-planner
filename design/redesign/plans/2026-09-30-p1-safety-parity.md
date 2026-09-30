# P1 · Safety + quick parity

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** under admin View As, nothing deletes the static or removes the member being viewed. Delete Static is hidden on both surfaces, and the API refuses a static delete, and removal of the viewed member, whenever the client's new `X-View-As` header is present. The slice also adds two V2 Home fixes (D-58's "View schedule" link, a surfaced RSVP failure) and the public roadmap corrections.

**Architecture:**
- **Task 1 (riskiest):** the backend guard in `permissions.py`, called first in two handlers, plus the client header: `services/api.ts` holds the viewed user id, and `viewAsStore` keeps it in sync through one subscription.
- **Task 2:** `StaticTab` and `MorePage` hide Delete Static under View As; `MorePage`'s Danger Zone never renders empty.
- **Task 3:** V2 Home's "View schedule" link and RSVP error toast, the roadmap page, and the release note.

**Size:** about 550 changed lines, roughly 60% of them tests. That is over HOME_STRETCH's S band (under 300) but well under the ~1,500 slice cap, so it stays one PR.

**Tech stack:** FastAPI, pytest + aiosqlite (`backend/tests/`, factories in `tests/factories.py`) · React 19 · Zustand · Vitest + Testing Library.

**Spec (binding):** `design/redesign/HOME_STRETCH.md` §4 P1 (`:81-88`) and §2 HS-9, HS-12, HS-20, HS-30. Also parity matrix D-50 (`specs/v1-v2-parity-matrix.md:413`), D-58 (`:476`) and §13.3 item 2 (`:686-690`), plus `CLAUDE.md` § UI rules, § Product rules and § Pitfalls.

**Plan-vet:** pending. Dispatch `xivrp-director` before Task 1 (slice-loop §0). OQ-1 is open.

**Tests first:** each implementer writes its task's listed tests first and shows them failing before any production edit. The repo's slice-loop has no `test-author` step, and its own agents take precedence over the global default.

## Owner questions

- **OQ-1 (HS-12 leaves this open): the Known Issues section after its only entry is dropped.** `KNOWN_ISSUES` (`RoadmapDocs.tsx:361-367`) has one entry. Without it, the section (`:686-709`) renders an empty card above "These issues are tracked internally…", and the docs nav still lists "Known issues" (`:55`). **Recommended:** keep the section and the nav entry. While the list is empty, render one line, "No known issues right now.", and omit the "tracked internally" footnote. The alternative is to hide both the section and the nav entry. Task 3 uses the recommendation unless the owner rules otherwise first; the alternative changes about 10 lines.

## Spec premises checked against the code

| HOME_STRETCH cites | Code says | Ruling |
|---|---|---|
| `StaticTab.tsx:305` gates Delete | **Confirmed.** `{isOwner && (` at `:305`. `isOwner` reads the raw `group.userRole` (`:39`), which View As never adjusts. | R-P1-C |
| `MorePage.tsx:379-386` | **Confirmed.** But the section gate `isMember && (isOwner \|\| !!onLeaveStatic)` (`:351`) would render an **empty Danger Zone** under View As as an owner, because Leave is already withheld there. | R-P1-C changes the gate too |
| Leave is hidden under View As (`GroupViewContent.tsx:1191`) | **Confirmed.** `{...(!viewAsUser ? { onLeaveStatic … } : {})}`. `:1192-1194` is the comment; the call itself is `removeMember(currentGroup.id, effectiveUserId)` at `:1205`, where `effectiveUserId` is set at `:374`. The frontend part of D-50 is therefore **Delete only**. | Task 2 |
| `viewAsStore.ts:20` (per-static) | **Confirmed.** `groupId: string`. | — |
| `useViewAsUrlSync.ts:38-44` (clears on unmount) | **Corrected to `:39-45`.** Existing test at `useViewAsUrlSync.test.tsx:117`. | — |
| `services/audit.py:140-145` reads the header | **Confirmed.** Comment at `:140-143`, read at `:144-145`, recorded only when `actor.is_admin`, capped to 36 chars (`:154`). It expects the **viewed user's id** (`User.id`), which is `viewAsUser.userId`. | R-P1-B sends that value |
| `static_groups.py:682` | **Confirmed.** The `@router.delete("/{group_id}")` handler runs from `:683`. The members DELETE route is `:1216` (`remove_member`; self-removal branch `:1245`). | R-P1-A |
| (implied) the client can add a header | Headers are built once in `authRequest`, `services/api.ts:139-141`. They are spread after `options.headers` (`:182`) and reused by the 401 retry (`:220`), and every `api.*` helper goes through them. `deleteGroup`/`removeMember` (`staticGroupStore.ts:268,383`) and `MembersPanel.tsx:128` use `authRequest`. CORS allows any header (`main.py:176`). | R-P1-B |
| — (found) | 12 test files mock `viewAsStore` with no `getState` (for example `GroupViewContent.test.tsx:80`, `Roster.test.tsx:71`), and `viewAsStore` already imports `api` (`viewAsStore.ts:9`). If `api.ts` read the store, it would add an import cycle and risk those suites. | R-P1-B: a setter plus one subscription |
| Matrix §13.3 item 2: "StaticTab re-gates… so the deeper flow *likely* re-blocks" | **Wrong.** The backend returns a virtual `owner` to a non-member admin (`permissions.py:229-254`), and `require_owner` passes any admin (`:281-282`). An admin viewing as the owner can open Settings ▸ Static and delete the static today. | The D-50 danger is real; Finish closes §13.3 item 2 with this |
| `Home.tsx:331-335`, `:334` | **Path corrected** to `components/home/Home.tsx` (`pages/Home.tsx` is the landing page). Lines confirmed: `onRsvp` at `:334` discards `submitRsvp`'s promise, and the store rethrows (`scheduleStore.ts:203-224`). D-58's countdown chip has already shipped (`SessionRsvpCard.tsx:283,312`), so only the link is owed. | R-P1-D |
| `RoadmapDocs.tsx` | **Path:** `pages/RoadmapDocs.tsx`. Phase 9 is at `:190-203`, with `status: 'in-progress'` at `:194`. | R-P1-E, OQ-1 |
| `MyStaticsPanel.tsx:284`, `YourStaticsCard.tsx:60` | **Confirmed.** Both call `deleteGroup` and are mounted outside the group view, so View As is already cleared there. | Tested in Task 1 |

## Rulings (bind every task)

- **R-P1-A (backend guard).** `backend/app/permissions.py` gains:
  - `VIEW_AS_HEADER = "X-View-As"` and `VIEW_AS_REFUSAL = "Not available while viewing as another user"`. The message contains none of the auth patterns in `api.ts:105-112`, so the client toasts it as a true 403.
  - `view_as_user_id(request: Request) -> str | None`, which returns the header's value, or `None` when the header is missing or empty.
  - The **first statement** of `delete_static_group` is `if view_as_user_id(request): raise PermissionDenied(VIEW_AS_REFUSAL)`. The first statement of `remove_member` is `if view_as_user_id(request) == user_id: raise PermissionDenied(VIEW_AS_REFUSAL)`.
  - The check happens before any DB read, so no audit row is written. It depends on the header's presence alone, not on `is_admin`: HS-30 says "only when that header is present", and a forged header can only refuse the sender's own request. `audit.py` is not edited. Other destructive verbs under View As stay open (HS-30).
- **R-P1-B (client header).**
  - `services/api.ts` gains a module-level `let viewAsUserId: string | null = null` and `export function setViewAsHeaderUserId(id: string | null)`.
  - `authRequest` adds `'X-View-As': viewAsUserId` to its `headers` record only when the id is non-empty. That record comes after `options.headers`, so callers can't override the header, and the retry reuses it.
  - `stores/viewAsStore.ts` adds one line at module scope: `useViewAsStore.subscribe((s) => setViewAsHeaderUserId(s.viewAsUser?.userId ?? null))`.
  - Every method carries the header while it is set, as HS-30 says. As a side effect, admin writes under View As now record `impersonating_user_id` in the audit log, which is what `audit.py:140-145` was built for.
- **R-P1-C (Delete hidden).**
  - Both components read `useIsViewingAs()` (`viewAsStore.ts:114`); no new props.
  - `StaticTab`: `const canDelete = isOwner && !isViewingAs` gates the footer button (`:305`) and the confirm branch (`:151`).
  - `MorePage`: `showDelete = isOwner && !isViewingAs` and `showLeave = !isOwner && !!onLeaveStatic`. The section gate becomes `isMember && (showDelete || showLeave)`.
  - Markup and classes are unchanged. The raw `<button>`s stay under the file's existing eslint-disable; restyling is not P1's job. Outside View As, both components render as they do today.
- **R-P1-D (V2 Home).**
  - Pass `headerActions={<LinkText onClick={() => onNavigate('schedule')}>View schedule</LinkText>}` to `SessionRsvpCard`. The shared card is not edited, because Schedule uses it too. Legacy parity is plain navigation (`StaticHomeTab.tsx:348-355`), with no session deep link. The placement is judged in Phase P.
  - RSVP: `handleRsvp = async (status) => { try { await submitRsvp(group.id, nextSession.id, status); } catch { toast.error('Failed to save RSVP'); } }`, which mirrors V2 `Schedule.tsx:211-217`. It uses `await`, not `.catch`, because `Home.test.tsx`'s `submitRsvp` mock returns `undefined`.
- **R-P1-E (roadmap).**
  - Phase 9 gets `status: 'planned'`.
  - Its four "Complete - …" items stay: they are true of the current interface, and #320 kept shipped items inside planned phases.
  - The fifth item becomes `{ title: 'Mobile layout for the new interface', description: 'Planned - part of the new interface' }`.
  - The "Large component files" issue is deleted, and the empty state follows OQ-1.
- **R-P1-F (release note, Task 3).**
  - Version `2.1.55` with a `CURRENT_VERSION` bump. Items:
    - (a) public, `fix`: under View As, site admins can no longer delete the static or remove the member they are viewing as;
    - (b) public, `fix`: the roadmap now lists the mobile phase as planned for the new interface, and the stale known issue is gone;
    - (c) `improvement`, `internal: true` (V2 is admin-gated): Home's next-session card links to the schedule and reports a failed RSVP.
  - Strings are single-quoted, with `'` escaped as `\'`. `pr`/`prTitle` are set after the PR opens. If V1B takes 2.1.55 first, take the next patch.
- **R-P1-G (V1 labels).** Every V1-visible edit is sanctioned by HOME_STRETCH §1 (P1). The PR body copies this table.

  | File | Label | Importer evidence |
  |---|---|---|
  | `backend/app/permissions.py`, `routers/static_groups.py` | V1-visible sanctioned (HS-30) | the API serves both shells |
  | `services/api.ts`, `stores/viewAsStore.ts` | V1-visible sanctioned (HS-30) | shared client; the header exists only under admin View As |
  | `components/settings/StaticTab.tsx` | V1-visible sanctioned (D-50) | `SettingsPanel.tsx:19`, mounted by V1 `GroupView.tsx:99-101` and V2 `V2SettingsHost.tsx:35` |
  | `components/group/MorePage.tsx` | V1-visible sanctioned (D-50) | `GroupViewContent.tsx:1164`, rendered by both shells; V1 reaches More via `SidebarNav.tsx:37` (`GroupView.tsx:394`) |
  | `components/home/Home.tsx` | V2-only | only importer is `NewShell.tsx:20` |
  | `pages/RoadmapDocs.tsx` | V1-visible sanctioned (HS-12) | public `/docs/roadmap`, independent of the shell |

## Review Focus

- The header's lifecycle: it is present only while `viewAsUser` is set. After `stopViewAs()` (unmount, `useViewAsUrlSync.ts:39-45`), an admin's own delete from Profile sends no header and succeeds.
- The members guard compares the **path `user_id` to the header**, never to `current_user.id`: an admin removing a *different* member under View As still gets a 204. A refused call writes no audit row and deletes nothing.
- Admin moderation delete under `?adminMode` (no View As, so no header) still works and still writes `admin_override=True`.
- `MorePage` under View As as an owner shows no Danger Zone at all, not an empty one. Legacy snapshot and MorePage tests pass unedited outside View As.

## Task 1 — D-50 backend guard + client `X-View-As` header (RISKIEST · `xivrp-implementer-deep`, `model: fable`)

**Files.** Create `backend/tests/test_view_as_guard.py`. Modify `backend/app/permissions.py`, `backend/app/routers/static_groups.py`, `frontend/src/services/api.ts`, `frontend/src/services/api.test.ts` and `frontend/src/stores/viewAsStore.ts`.
**Interfaces produced:** `permissions.VIEW_AS_HEADER`, `VIEW_AS_REFUSAL`, `view_as_user_id`; `api.setViewAsHeaderUserId`; the 403s.

1. **Backend tests first** (`test_view_as_guard.py`). Build an `admin_user` + `admin_headers` fixture the way `test_audit_emits_static.py:31-43` does; groups and members come from `tests/factories.py`.
   - An admin (non-member) runs `DELETE /api/static-groups/{id}` with `X-View-As: <owner id>`: 403, `detail == VIEW_AS_REFUSAL`, the group still exists, and there are zero `AuditLog` rows.
   - The real owner (non-admin) runs the same delete with `X-View-As: anything`: 403 (the header's presence alone, HS-30).
   - An admin runs the delete with **no header**: 204, and one `static.deleted` row with `admin_override is True` (moderation path).
   - An admin who owns the static runs the delete with no header: 204 (the admin's own delete outside View As).
   - The owner sends `X-View-As: ""`: 204 (empty counts as absent).
   - An admin runs `DELETE …/members/{member_id}` with `X-View-As: <member_id>`: 403, the membership still exists, and there are zero audit rows (View-As Leave).
   - An admin runs `DELETE …/members/{other_member_id}` with `X-View-As: <member_id>`: 204 (other removals are not blocked).
   - A member leaves themselves with no header: 204 (unchanged).
   - An admin who is a real member leaves themselves while `X-View-As: <another id>` is set: 204.
2. Implement R-P1-A.
3. **Client tests first** (extend `services/api.test.ts`). Stub `fetch`, and seed a CSRF token through `document.cookie = 'csrf_token=t'` so DELETE passes.
   - After `useViewAsStore.setState({ viewAsUser: <fixture userId 'u-view'> })`, both `api.delete('/api/static-groups/g1')` and `api.get(...)` send `X-View-As: u-view`.
   - After `useViewAsStore.getState().stopViewAs()`, no `X-View-As` key is sent.
   - A fresh module with the store never set sends no key.
   - A 401 → refresh → retry still carries the header (mock `useAuthStore.getState().refreshAccessToken` to resolve `true`).
   - `setState` with `viewAsUser.userId === ''` sends no key.
4. Implement R-P1-B.
5. **Gates.** From `<worktree>/backend`: `D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/backend/venv/Scripts/python.exe -m pytest tests/test_view_as_guard.py tests/test_audit_emits_static.py tests/test_audit_helper.py tests/test_static_groups.py -q`, then `… -m pytest tests/ -q` (paste the count), then `D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/backend/venv/Scripts/ruff.exe check app/permissions.py app/routers/static_groups.py tests/test_view_as_guard.py` (0 new). From the worktree root: `pnpm -C frontend test src/services/api.test.ts`, `pnpm -C frontend build`, and `pnpm -C frontend test` (the whole suite, so the 12 `viewAsStore`-mocking files are re-run). No release note in this task (Task 3 owns it).

**Ad hoc mutation checks (execute and paste):**
- Delete the `subscribe` line: the "sends X-View-As" test fails.
- Change the members check to `if view_as_user_id(request):`: the other-member 204 test gets a 403.
- Compare against `current_user.id`: the View-As Leave test gets a 204.
- Return the raw header, so `""` counts: the empty-header test gets a 403.
- Move the static guard below `session.delete(group)`: the group-still-exists assertion fails.

## Task 2 — D-50 frontend: Delete Static hidden under View As (`xivrp-implementer`)

**Files.** Create `frontend/src/components/settings/StaticTab.viewAs.test.tsx`. Modify `frontend/src/components/settings/StaticTab.tsx`, `frontend/src/components/group/MorePage.tsx` and `frontend/src/components/group/MorePage.test.tsx`.
**Interfaces consumed:** `useIsViewingAs` (existing). Nothing from Task 1 at runtime.

1. **Tests first.** Use the real `viewAsStore` through `setState`, and reset it in `afterEach`.
   - `StaticTab.viewAs.test.tsx` (mock `staticGroupStore`; wrap in `MemoryRouter`):
     - an owner group with no View As shows the "Delete Static" button;
     - the same group under View As shows no button;
     - `{ userRole: 'owner', isAdminAccess: true }` with no View As (the `?adminMode` moderation path) shows the button.
   - `MorePage.test.tsx`:
     - `userRole="owner"` under View As: no "Delete Static" button and no "Danger Zone" text;
     - an owner outside View As: the existing test at `:134` passes unedited;
     - a member with `onLeaveStatic` wired outside View As: the existing Leave tests at `:154-187` pass unedited.
2. Implement R-P1-C.
3. **Gates:** `pnpm -C frontend test src/components/settings src/components/group/MorePage.test.tsx`, `pnpm -C frontend lint` (0 errors), `pnpm -C frontend check:design-system:strict`.

**Ad hoc mutation check:** keep the button gate but restore the old section gate. The "no Danger Zone" test should fail.

## Task 3 — D-58 link, Home RSVP rejection, public roadmap, release note (`xivrp-implementer`)

**Files.** Create `frontend/src/pages/RoadmapDocs.test.tsx`. Modify `frontend/src/components/home/Home.tsx`, `frontend/src/components/home/Home.test.tsx`, `frontend/src/pages/RoadmapDocs.tsx` and `frontend/src/data/releaseNotes.ts`.

1. **Tests first.**
   - `Home.test.tsx`:
     - with a next session, a "View schedule" button calls `onNavigate('schedule')`;
     - with no session, there is no "View schedule" button (the "Add session" invite stays);
     - when `mocks.submitRsvp` rejects, clicking "I'm in" leads to `toast.error('Failed to save RSVP')` exactly once (`waitFor`);
     - the existing "fires submitRsvp" test (`:237`) passes unedited.
   - `RoadmapDocs.test.tsx` (`MemoryRouter`):
     - "Mobile Optimization" is inside `#planned`, not `#in-progress`;
     - "Large component files" is absent;
     - "No known issues right now." is shown (per OQ-1).
2. Implement R-P1-D and R-P1-E, then write the R-P1-F entry with the Edit tool.
3. **Gates:** `pnpm -C frontend test src/components/home/Home.test.tsx src/pages/RoadmapDocs.test.tsx`, then `pnpm -C frontend build`, and `npm test` in `scripts/` (the changelog suite checks `CURRENT_VERSION`).

**Ad hoc mutation check:** drop the `catch`. The rejection test should see no toast.

## Finish (controller)

1. **Browser walk** (dev-auth admin; shots to `docs/redesign/pr-shots/p1-*`, shrunk):
   - `/group/DEVTST?viewAs=<owner id>` in **both shells**: More and Settings ▸ Static show no Delete; DevTools shows `X-View-As` on requests.
   - `curl` the static DELETE and the viewed member's DELETE with the header: both 403.
   - `?adminMode=true` without `viewAs`: Delete is shown.
   - Profile ▸ Your statics: deleting a throwaway admin-owned static returns 204 with no header.
   - V2 Home: "View schedule" opens Schedule; an RSVP with the API stopped shows the toast.
   - `/docs/roadmap`.
2. **Write-backs, one commit:**
   - The matrix rows D-50 (`:413`) and D-58 (`:476`) get `**✅ SHIPPED (P1 #NNN, <date>)**`.
   - §13.3 item 2 closes with the corrected premise above.
   - The PRODUCT_MODEL §6.1 "Parity rows still owed" row (`docs/PRODUCT_MODEL.md:244`) drops D-50 and D-58.
   - HOME_STRETCH §4 P1 is ticked with the PR.
3. **PR:** the `pr-checklist` skill, the release-note `pr`/`prTitle`, and the slice-loop §5 gates with counts in the PR body, plus the R-P1-G table as the sanctioned-edit justification. `gh pr create --draft`.
4. **Carried, not P1 (HS-30 scope):**
   - Other View-As writes still act as the admin: rename, visibility, transfer, other member removals, `MembersPanel`.
   - A 403 on a Home RSVP double-toasts (`api.ts:251` plus the handler), the same as Schedule.
