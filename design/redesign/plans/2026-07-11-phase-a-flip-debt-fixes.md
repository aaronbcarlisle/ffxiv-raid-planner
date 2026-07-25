# Phase A — v2 Flip-Debt Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the v2 flip debt — no capability dead-ends or correctness traps left in
v2 — and close the three Phase-R follow-ups, per the APPROVED spec
`design/redesign/specs/2026-07-11-phase-a-flip-debt-fixes.md` (all §6 skim defaults
ratified: Leave Static ships now · Archive removed outright · BYDAY engine fix included ·
ScheduleIntegrationsPanel void fixes included · tome toggle-only · More-page classic-UI
entry at all viewports · PriorityRow folded into centering · NotFound CTA → `/` ·
open-seat configure = new inline v2 form).

**Architecture:** 13 independent fix tasks (Tasks 2–14 ≈ spec items A1–A13) on branch
`redesign/phase-a-flip-debt`, sequenced so the file-overlap pairs compose: Task 2 (A1)
before Task 11 (A10) — A1 deletes the `Roster.tsx:322` void site A10 must not re-fix;
Task 4 (A3) before Task 11 — both touch `useRosterCardActions.tsx` in disjoint regions;
Task 5 (A4) before Task 6 (A5) — both thread optional props through
`GroupViewContent.tsx` → `MorePage.tsx`; Task 3 (A2) after Task 2 — disjoint
`Roster.tsx` regions. Legacy stays byte-frozen; every legacy-shared edit is an
enumerated bugfix justified in the PR body.

**Tech Stack:** React 19 + TS + Zustand 5 + react-router 7 + Vitest (frontend);
FastAPI + SQLAlchemy + pytest (backend, Task 14b only); Playwright (smoke gates).

## Global Constraints

- **NO AI attribution** on any commit or PR — absolute, non-negotiable.
- **Never touch `main`.** Branch `redesign/phase-a-flip-debt`, PR into `redesign/foundation`.
- **Byte-for-byte freeze**: files restored from `f45a241` in Phase R are NOT touched by
  any task (Task 15 verifies branch-changed-files ∩ frozen inventory = ∅). Frozen files
  named inside tasks are reference-only.
- **Legacy-shared files** (`GroupViewContent.tsx`, `MorePage.tsx`, `Header.tsx`,
  `CreateSessionModal.tsx`, `utils/recurrence.ts`, `ScheduleIntegrationsPanel.tsx`,
  `stores/authStore.ts`, `App.tsx`, `backend/app/routers/dev_auth.py`): edits are ONLY
  the enumerated bugfixes / additive optional props their tasks describe; both smoke
  suites must stay green in ONE run (Task 15); each edit gets a PR-body justification line.
- **Design system**: new UI uses primitives + semantic tokens only; `text-xs` floor;
  user-facing copy says "static", never "group"; lucide-react icons.
- **Commit guard**: a PreToolUse hook blocks `git commit` when staged frontend `.ts/.tsx`
  fail `tsc -b` — keep the tree compiling at every commit.
- **Release note**: ONE internal entry (`internal: true`), NO `CURRENT_VERSION` bump —
  appended at PR time (needs the PR number); NOT part of any task.
- **Full CI gate before PR** (Task 15): `pnpm build` · `pnpm lint` (0 errors) ·
  `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` ·
  `git diff --check` · backend `pytest tests/ -q` · both Playwright smoke suites in one run.
- Frontend commands run from `frontend/` with pnpm. Backend: `cd backend`,
  `source venv/Scripts/activate` (Windows-layout venv — there is no `venv/bin/`), `pytest`.
- Implementer model: **sonnet-5 for every task** (no task flagged riskiest — spec §3;
  the two both-shell-heavy tasks, 5 and 10, get extra reviewer attention instead).
  Reviewer: `redesign-reviewer` after every task and at whole-branch.
- Grounding record: `.superpowers/sdd/phase-a-grounding.md` (session-local, not
  committed) — implementers may consult their item's section for file:line evidence.
  Line numbers were verified at `810a48d`; earlier tasks' edits shift later tasks'
  numbers — always anchor by string, not line.

---

### Task 1: Branch + plan-of-record docs commit

**Files:**
- Commit (currently untracked in the working tree):
  `design/redesign/specs/2026-07-11-phase-a-flip-debt-fixes.md`,
  `design/redesign/plans/2026-07-11-phase-a-flip-debt-fixes.md` (this plan).
- Do NOT commit: `SESSION_HANDOFF.md`, `design/redesign/AUTONOMOUS_RUN.md`
  (session artifacts), anything under `.superpowers/`.

**Interfaces:**
- Consumes: nothing.
- Produces: the working branch every later task commits to.

- [ ] **Step 1: Create the branch off foundation**

```bash
git -C "D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner" checkout -b redesign/phase-a-flip-debt
git rev-parse --abbrev-ref HEAD   # expect: redesign/phase-a-flip-debt
git log --oneline -1              # expect: 810a48d ...
```

- [ ] **Step 2: Commit the docs (no frontend TS staged → commit guard no-op)**

```bash
git add "design/redesign/specs/2026-07-11-phase-a-flip-debt-fixes.md" "design/redesign/plans/2026-07-11-phase-a-flip-debt-fixes.md"
git commit -m "docs(redesign): phase-a spec (approved) + implementation plan"
```

---
### Task 2: Add-player dead-end — toolbar → AddPlayerModal; open-seat configure/remove (A1)

The v2 Roster screen reinvented add-player as a raw blank-slot call: `Roster.tsx:321-323` wires BOTH the toolbar "Add player" button and every open-seat card CTA to `void playerActions.handleAddPlayer()` → `tierStore.addPlayer` → a blank `configured: false` slot with no configure or remove affordance (unconfigured players never mount `RosterCard`, so the kebab's Remove is unreachable — the slot is permanently stuck). The correct flow already exists and is already mounted above `<Roster/>`: `useGroupActions().onAddPlayer` opens `AddPlayerModal` and creates + configures atomically (`groupActionsContext.tsx:147,169-215`; `<GroupActionModals>` wraps the v2 tree at `NewShell.tsx:340-358`). This task (1) rewires the toolbar to that shared flow, and (2) gives each open-seat card its own **Configure** (new inline v2 form: name `Input` + `JobPicker`, submitting through `playerActions.handleConfigurePlayer`) and **Remove** (`actionsForPlayer(player).onRemove()`) affordances, both gated on the `canManage` prop (which IS the legacy roster-manage gate — `NewShell.tsx:84` computes it as `canManageRoster(userRole, isAdminAccess).allowed`, the same check legacy `InlinePlayerEdit`/`EmptySlotCard` use). Per the approved skim default §6.8: `AddPlayerModal` stays create-only and unmodified; the open-seat configure is a NEW inline form; no raw blank-slot path remains on any visible button (`usePlayerActions.handleAddPlayer` simply becomes uncalled — `handleDuplicatePlayer` uses the tierStore `addPlayer` action directly, not this wrapper; it is left in place per the no-change-to-`usePlayerActions.ts` constraint).

Execution-order notes: Task 11 (void-promise sweep) later fixes the OTHER `void` sites in `Roster.tsx` (:193/:194/:285-299) — do NOT touch those here; this task deletes the :321-323 void site entirely (Task 11 knows). Task 3 edits the GearBoard call-site region of `Roster.tsx` after this task — keep edits strictly scoped to the add-player wiring and the `RosterCards` props. `pages/groupActionsContext.tsx` and `components/player/AddPlayerModal.tsx` need NO changes (verified: `onAddPlayer`/`handleAddPlayerSubmit` are correct and reusable as-is). Reference-only (read to mirror, never edit): `components/player/PlayerGrid.tsx` (FROZEN — f45a241 restore set) plus `components/player/EmptySlotCard.tsx` and `components/player/InlinePlayerEdit.tsx` (legacy-only, not in the frozen inventory, but equally do-not-edit here). The 6 DEVTST orphan slots are cleaned up at browser-validation time via the NEW v2 Remove affordance (validates the fix live) — no plan step, no script, no migration. Spec-shorthand correction the implementer must know: the spec writes `handleConfigurePlayer(player.id, {name, job, role})`, but the REAL verified signature is positional — `handleConfigurePlayer(playerId: string, name: string, job: string, role: string): Promise<void>` (`hooks/usePlayerActions.ts:92-101`); use the positional form. Role is DERIVED from the job exactly as legacy `InlinePlayerEdit.handleSubmit` does: `getRoleForJob(job) || ''` (`InlinePlayerEdit.tsx:175`); the submit guard mirrors legacy's requirements (non-empty trimmed name AND a picked job), expressed as a disabled Save button.

**Files:**
- Create: `frontend/src/components/roster/OpenSeatCard.tsx` (new v2 open-seat card: invite state + inline configure form + remove)
- Create: `frontend/src/components/roster/OpenSeatCard.test.tsx`
- Modify: `frontend/src/components/roster/RosterCards.tsx` (open-seat branch → `OpenSeatCard`; prop surface: `onAddPlayer` removed, `onConfigurePlayer` added; header docs)
- Modify: `frontend/src/components/roster/Roster.tsx` (add-player wiring → `useGroupActions().onAddPlayer`; pass `onConfigurePlayer` to `RosterCards`)
- Test: `frontend/src/components/roster/RosterCards.test.tsx` (open-seat configure/remove coverage; scaffold updates)
- Test: `frontend/src/components/roster/Roster.test.tsx` (add-player assertion re-targeted to `useGroupActions().onAddPlayer`; open-seat routing test)
- Test: `frontend/src/components/roster/RosterCards.reorder.test.tsx` (mechanical prop swap only — compile-forced)

**Interfaces:**
- Consumes: `useGroupActions(): GroupActions` from `pages/groupActionsContext.tsx` (`GroupActions.onAddPlayer: () => void`, defined at `pages/GroupViewContent.tsx:80-86`); `usePlayerActions().handleConfigurePlayer(playerId: string, name: string, job: string, role: string): Promise<void>`; `RosterCardActions.onRemove?: () => void` (`hooks/useRosterCardActions.tsx:92`) via the existing `actionsForPlayer` factory (`Roster.tsx:304-319`); `JobPicker` (`components/player/JobPicker.tsx` — `{ selectedJob: string; onJobSelect: (job: string) => void; templateRole?: TemplateRole }`); `Input` (`components/ui` — `{ value, onChange: (value: string) => void, size, fullWidth, ... }`); `Button`/`IconButton` from `components/primitives`; `CardShell`, `EmptyStateInvite` from `components/ui`; `getRoleForJob`, `getValidRole` from `gamedata`; `TEMPLATE_ROLE_INFO` from `utils/constants`.
- Produces: `OpenSeatCard` component — `export interface OpenSeatCardProps { player: SnapshotPlayer; canManage: boolean; onConfigure: (name: string, job: string, role: string) => Promise<void> | void; onRemove?: () => void; }`; `RosterCardsProps` change — REMOVES `onAddPlayer: () => void`, ADDS `onConfigurePlayer: (playerId: string, name: string, job: string, role: string) => Promise<void> | void` (breaking for `RosterCards` callers; verified call sites are only `Roster.tsx` + the two RosterCards test files, all updated here).

#### Cycle 1 — `OpenSeatCard` (new component, TDD)

- [ ] **Step 1: Write the failing OpenSeatCard test** — create `frontend/src/components/roster/OpenSeatCard.test.tsx` with exactly:

```tsx
// `@testing-library/user-event` is not a dependency of this project, so this
// suite drives interaction via `fireEvent` (established convention — see
// RosterToolbar.test.tsx). OpenSeatCard is the Phase A A1 open-seat card:
// per-seat Configure (inline name + JobPicker form, role derived from job)
// and Remove affordances, both gated on the roster-manage permission
// (`canManage` — same gate legacy EmptySlotCard/InlinePlayerEdit use).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SnapshotPlayer } from '../../types';
import { OpenSeatCard } from './OpenSeatCard';

function makeOpenSeat(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p9',
    tierSnapshotId: 't1',
    name: '',
    job: '',
    role: 'healer',
    configured: false,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '',
    updatedAt: '',
    position: 'H1',
    templateRole: 'pure-healer',
    ...overrides,
  } as unknown as SnapshotPlayer;
}

const onConfigure = vi.fn();
const onRemove = vi.fn();

beforeEach(() => {
  onConfigure.mockClear();
  onRemove.mockClear();
});

describe('OpenSeatCard', () => {
  it('renders the seat title with Configure + Remove affordances for a manager', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    // TEMPLATE_ROLE_INFO['pure-healer'].shortLabel === 'Healer'.
    expect(screen.getByText('Open seat · Healer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove open seat' })).toBeInTheDocument();
  });

  it('hides both affordances when the user cannot manage the roster', () => {
    render(
      <OpenSeatCard
        player={makeOpenSeat()}
        canManage={false}
        onConfigure={onConfigure}
        onRemove={onRemove}
      />
    );
    expect(screen.getByText('Open seat · Healer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configure' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove open seat' })).toBeNull();
  });

  it('renders no Remove affordance when onRemove is not provided', () => {
    render(<OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} />);
    expect(screen.queryByRole('button', { name: 'Remove open seat' })).toBeNull();
  });

  it('fires onRemove when the Remove affordance is clicked', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove open seat' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables Save until BOTH a non-empty name and a job are set (legacy InlinePlayerEdit guard)', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

    // Form open, both fields empty → disabled.
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    // Name only → still disabled (no job picked).
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'Aria Moonfall' } });
    expect(save).toBeDisabled();

    // Pick a job from the template quick-select (pure-healer → WHM available).
    fireEvent.click(screen.getByTitle('WHM - White Mage'));
    expect(save).toBeEnabled();

    // Whitespace-only name → disabled again (trim guard).
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: '   ' } });
    expect(save).toBeDisabled();
  });

  it('submits trimmed name + job + role DERIVED from the job via getRoleForJob', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: '  Aria Moonfall  ' } });
    fireEvent.click(screen.getByTitle('WHM - White Mage'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onConfigure).toHaveBeenCalledTimes(1);
    expect(onConfigure).toHaveBeenCalledWith('Aria Moonfall', 'WHM', 'healer');
  });

  it('Cancel closes the form and returns to the invite state', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByLabelText('Player name')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Player name')).toBeNull();
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument();
    expect(onConfigure).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — from `frontend/`:

```bash
pnpm test src/components/roster/OpenSeatCard.test.tsx
```

Expected failure signature: the whole file errors with `Failed to resolve import "./OpenSeatCard" from "src/components/roster/OpenSeatCard.test.tsx"` (module does not exist yet).

- [ ] **Step 3: Implement `OpenSeatCard`** — create `frontend/src/components/roster/OpenSeatCard.tsx` with exactly:

```tsx
/**
 * OpenSeatCard — v2 open-seat (unconfigured player) card (Phase A, A1).
 *
 * Replaces the dead-end open-seat `EmptyStateInvite` whose only action was the
 * GLOBAL add-player handler (which spawned yet another blank slot elsewhere).
 * Every affordance here is scoped to THIS seat's player id:
 *   - Configure — a small inline form (name `Input` + the shared `JobPicker`,
 *     import-only reuse like `RosterCard`'s inline job picker) that submits
 *     name/job + a role DERIVED from the job (`getRoleForJob`, mirroring legacy
 *     `InlinePlayerEdit.handleSubmit`); the parent routes it through
 *     `usePlayerActions.handleConfigurePlayer`, which flips `configured: true`
 *     on this exact id.
 *   - Remove — deletes this seat (parent wires `actionsForPlayer(player).onRemove`).
 *     No confirm dialog: an open seat holds no data, matching legacy
 *     `EmptySlotCard`'s direct remove.
 * Both affordances are gated on `canManage` — the same roster-manage permission
 * legacy `EmptySlotCard`/`InlinePlayerEdit` check (`canManageRoster`), passed
 * down from `NewShell.tsx:84` as the Roster slot's `canManage`.
 *
 * Deliberate: Save is DISABLED until a non-empty (trimmed) name AND a job are
 * both set — the declarative form of legacy `InlinePlayerEdit`'s submit guard
 * (`InlinePlayerEdit.tsx:165-177`, which blocks on empty name / missing job).
 */
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { CardShell, EmptyStateInvite, Input } from '../ui';
import { Button, IconButton } from '../primitives';
import { JobPicker } from '../player/JobPicker';
import { getRoleForJob, getValidRole } from '../../gamedata';
import { TEMPLATE_ROLE_INFO } from '../../utils/constants';
import type { SnapshotPlayer } from '../../types';

export interface OpenSeatCardProps {
  player: SnapshotPlayer;
  /** Roster-manage permission (`canManageRoster`) — gates BOTH affordances. */
  canManage: boolean;
  /** Configure THIS seat: (name, job, role-derived-from-job). */
  onConfigure: (name: string, job: string, role: string) => Promise<void> | void;
  /** Remove THIS seat (already bound to this player's id by the parent). */
  onRemove?: () => void;
}

/** "Tank" / "Healer" / "Melee" / ... label for an unconfigured seat's role. */
function seatRoleLabel(player: SnapshotPlayer): string {
  if (player.templateRole) return TEMPLATE_ROLE_INFO[player.templateRole].shortLabel;
  const role = getValidRole(player.role);
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function OpenSeatCard({ player, canManage, onConfigure, onRemove }: OpenSeatCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [job, setJob] = useState(player.job);

  const roleLabel = seatRoleLabel(player);
  const canSubmit = name.trim().length > 0 && !!job;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    // Mirror legacy InlinePlayerEdit.handleSubmit: role is DERIVED from the job.
    void onConfigure(name.trim(), job, getRoleForJob(job) || '');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setName(player.name);
    setJob(player.job);
  };

  return (
    <CardShell as="div" className="relative overflow-hidden border-dashed">
      {/* Neutral accent edge — open seats have no role color of their own. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: 'var(--color-border-default)' }}
      />

      {canManage && onRemove && (
        <div className="absolute right-2 top-2 z-10">
          <IconButton
            aria-label="Remove open seat"
            variant="ghost"
            size="sm"
            icon={<Minus className="h-4 w-4" />}
            onClick={onRemove}
          />
        </div>
      )}

      {isEditing && canManage ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-medium text-text-primary">
            {player.position ? `Configure seat · ${player.position}` : `Configure seat · ${roleLabel}`}
          </p>
          <Input
            value={name}
            onChange={setName}
            placeholder="Player name"
            aria-label="Player name"
            size="sm"
            fullWidth
          />
          <JobPicker
            selectedJob={job}
            onJobSelect={setJob}
            templateRole={player.templateRole ?? undefined}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={!canSubmit}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <EmptyStateInvite
          icon={<Plus className="h-5 w-5" />}
          title={`Open seat · ${roleLabel}`}
          description={
            player.position
              ? `Waiting for a player to fill the ${player.position} slot.`
              : `Waiting for a player to fill this ${roleLabel.toLowerCase()} slot.`
          }
          action={canManage ? { label: 'Configure', onClick: () => setIsEditing(true) } : undefined}
        />
      )}
    </CardShell>
  );
}
```

- [ ] **Step 4: Run tests, verify pass** — from `frontend/`:

```bash
pnpm test src/components/roster/OpenSeatCard.test.tsx
```

All 7 tests pass.

#### Cycle 2 — `RosterCards` open-seat branch + prop surface

- [ ] **Step 5: Write the failing RosterCards tests** — edit `frontend/src/components/roster/RosterCards.test.tsx`.

First, the scaffold. Current (RosterCards.test.tsx:1-2):

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

Replace with:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

Current (RosterCards.test.tsx:34-56):

```tsx
const stubActions = {
  onUpdate: vi.fn(),
  onCopy: vi.fn(),
  onDuplicate: vi.fn(),
};

const actionsForPlayer = vi.fn(() => stubActions);

const baseProps = {
  reorderMode: false,
  canManage: true,
  userRole: 'owner' as const,
  currentUserId: 'u1',
  isAdminAccess: false,
  clipboardPlayer: null,
  actionsForPlayer,
  onAddPlayer: vi.fn(),
};

describe('RosterCards', () => {
  beforeEach(() => {
    actionsForPlayer.mockClear();
  });
```

Replace with:

```tsx
const stubActions = {
  onUpdate: vi.fn(),
  onCopy: vi.fn(),
  onDuplicate: vi.fn(),
  onRemove: vi.fn(),
};

const actionsForPlayer = vi.fn(() => stubActions);
const onConfigurePlayer = vi.fn();

const baseProps = {
  reorderMode: false,
  canManage: true,
  userRole: 'owner' as const,
  currentUserId: 'u1',
  isAdminAccess: false,
  clipboardPlayer: null,
  actionsForPlayer,
  onConfigurePlayer,
};

describe('RosterCards', () => {
  beforeEach(() => {
    actionsForPlayer.mockClear();
    onConfigurePlayer.mockClear();
    stubActions.onRemove.mockClear();
  });
```

Then replace the open-seat test. Current (RosterCards.test.tsx:93-118):

```tsx
  it('renders an EmptyStateInvite "open seat" card for an unconfigured position', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({
        id: 'p2',
        name: '',
        configured: false,
        position: 'H1',
        templateRole: 'pure-healer',
      }),
    ];

    render(
      <RosterCards
        players={players}
        groupView
        subsView={false}
        subsHidden={false}
        {...baseProps}
      />
    );

    expect(screen.getAllByTestId('roster-card')).toHaveLength(1);
    expect(screen.getByText(/Open seat · Healer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add player' })).toBeInTheDocument();
  });
```

Replace with:

```tsx
  it('renders an OpenSeatCard with per-seat Configure/Remove for an unconfigured position', () => {
    const players = [
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({
        id: 'p2',
        name: '',
        job: '',
        configured: false,
        position: 'H1',
        templateRole: 'pure-healer',
      }),
    ];

    render(
      <RosterCards
        players={players}
        groupView
        subsView={false}
        subsHidden={false}
        {...baseProps}
      />
    );

    expect(screen.getAllByTestId('roster-card')).toHaveLength(1);
    expect(screen.getByText(/Open seat · Healer/i)).toBeInTheDocument();
    // Phase A A1: the old GLOBAL "Add player" CTA (which spawned another blank
    // slot elsewhere) is gone — replaced by per-seat affordances.
    expect(screen.queryByRole('button', { name: 'Add player' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove open seat' })).toBeInTheDocument();
    // The open seat gets REAL bound actions too (previously only configured
    // cards invoked the factory — the kebab Remove was unreachable).
    expect(actionsForPlayer).toHaveBeenCalledWith(players[1]);
  });

  it("wires the open seat's Remove to that seat's own onRemove", () => {
    const players = [
      makePlayer({
        id: 'p2',
        name: '',
        job: '',
        configured: false,
        position: 'H1',
        templateRole: 'pure-healer',
      }),
    ];

    render(
      <RosterCards
        players={players}
        groupView={false}
        subsView={false}
        subsHidden={false}
        {...baseProps}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove open seat' }));
    expect(stubActions.onRemove).toHaveBeenCalledTimes(1);
  });

  it("submits the inline configure form through onConfigurePlayer with THAT seat's id", () => {
    const players = [
      makePlayer({
        id: 'p2',
        name: '',
        job: '',
        configured: false,
        position: 'H1',
        templateRole: 'pure-healer',
      }),
    ];

    render(
      <RosterCards
        players={players}
        groupView={false}
        subsView={false}
        subsHidden={false}
        {...baseProps}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'New Healer' } });
    fireEvent.click(screen.getByTitle('WHM - White Mage'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onConfigurePlayer).toHaveBeenCalledTimes(1);
    expect(onConfigurePlayer).toHaveBeenCalledWith('p2', 'New Healer', 'WHM', 'healer');
  });

  it('hides the open-seat Configure/Remove affordances without roster-manage permission', () => {
    const players = [
      makePlayer({
        id: 'p2',
        name: '',
        job: '',
        configured: false,
        position: 'H1',
        templateRole: 'pure-healer',
      }),
    ];

    render(
      <RosterCards
        players={players}
        groupView={false}
        subsView={false}
        subsHidden={false}
        {...baseProps}
        canManage={false}
      />
    );

    expect(screen.getByText(/Open seat · Healer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configure' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove open seat' })).toBeNull();
  });
```

- [ ] **Step 6: Run it, verify it fails** — from `frontend/`:

```bash
pnpm test src/components/roster/RosterCards.test.tsx
```

Expected failure signatures (component still renders the old `EmptyStateInvite` branch; the unknown `onConfigurePlayer` prop is ignored at runtime): the rewritten open-seat test fails at `expect(screen.queryByRole('button', { name: 'Add player' })).toBeNull()` ("expected … <button> … to be null" — the old CTA is still rendered), and the Remove-wiring and submit tests fail with `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Configure"` / `"Remove open seat"`. NOTE: the permission-hiding test ("hides the open-seat Configure/Remove affordances without roster-manage permission") passes VACUOUSLY pre-implementation — the old branch never renders those buttons for anyone, so its `queryByRole(...).toBeNull()` assertions hold trivially; it only gains discriminating power once the affordances exist for managers. Expect 3 failures, not 4.

- [ ] **Step 7: Implement the RosterCards changes** — five edits to `frontend/src/components/roster/RosterCards.tsx`, plus one compile-forced mechanical edit to the reorder test.

Edit 7a — header doc, open-seat sentence. Current (RosterCards.tsx:4-8):

```
 * The Cards view's body: groups the roster into Light Party 1 / Light Party 2
 * / Unassigned / Substitutes sections (reusing `groupPlayersByLightParty`) and
 * renders one `RosterCard` (Task 5) per configured player, or a dashed
 * `EmptyStateInvite` "open seat" card for an unconfigured position. Visual
 * target: `mockups/02-roster-cards.html` `.party-head` + `.pcards`; behaviour:
```

Replace with:

```
 * The Cards view's body: groups the roster into Light Party 1 / Light Party 2
 * / Unassigned / Substitutes sections (reusing `groupPlayersByLightParty`) and
 * renders one `RosterCard` (Task 5) per configured player, or an `OpenSeatCard`
 * (per-seat Configure/Remove, Phase A A1) for an unconfigured position. Visual
 * target: `mockups/02-roster-cards.html` `.party-head` + `.pcards`; behaviour:
```

Edit 7b — header doc, the `onAddPlayer` sentence. Current (RosterCards.tsx:38-43):

```
 *     handlers in a `useCallback` per player. `renderPlayer` calls
 *     `actionsForPlayer(player)` per card so Task 10's assembly (which wires
 *     `usePlayerActions`' playerId-taking handlers) only has to supply one
 *     factory function, not pre-bind N objects itself. `onAddPlayer` is the
 *     one genuinely global action (opens the add flow) and is a separate,
 *     ungrouped prop.
```

Replace with:

```
 *     handlers in a `useCallback` per player. `renderPlayer` calls
 *     `actionsForPlayer(player)` per card — for OPEN seats too (Phase A A1),
 *     so their Remove is bound to that exact seat's id. `onConfigurePlayer` is
 *     the one playerId-FIRST prop (the open-seat inline form submits through
 *     it; the assembly wires `usePlayerActions.handleConfigurePlayer`, which
 *     flips `configured: true` on that id).
```

Edit 7c — header doc, the "Recruit" bullet. Current (RosterCards.tsx:54-57):

```
 *   - "Recruit" (Static Finder) is deferred — `EmptyStateInvite` renders a
 *     single "Add player" action wired to `onAddPlayer`. Recruiting from the
 *     Static Finder is a separate, not-yet-built screen (REDESIGN_SPEC §5.6
 *     Static Finder), out of scope here.
```

Replace with:

```
 *   - "Recruit" (Static Finder) is deferred — open seats render `OpenSeatCard`
 *     (per-seat Configure/Remove; Phase A A1 removed the global "Add player"
 *     CTA that spawned blank slots). Recruiting from the Static Finder is a
 *     separate, not-yet-built screen (REDESIGN_SPEC §5.6), out of scope here.
```

Edit 7d — imports. Current (RosterCards.tsx:67-69):

```tsx
import { Plus } from 'lucide-react';
import { CardShell, EmptyStateInvite, PlayerIdentity, ProgressBar, Tag } from '../ui';
import { RosterCard } from './RosterCard';
```

Replace with:

```tsx
import { CardShell, PlayerIdentity, ProgressBar, Tag } from '../ui';
import { OpenSeatCard } from './OpenSeatCard';
import { RosterCard } from './RosterCard';
```

And the now-unused constants import. Current (RosterCards.tsx:76):

```tsx
import { TEMPLATE_ROLE_INFO } from '../../utils/constants';
```

Delete that line entirely (`TEMPLATE_ROLE_INFO`'s only use moves into `OpenSeatCard`; `getValidRole` stays — the drag overlay still uses it).

Edit 7e — prop surface. Current (RosterCards.tsx:122-123):

```tsx
  /** The one genuinely global action — opens the add-player flow. */
  onAddPlayer: () => void;
```

Replace with:

```tsx
  /**
   * Configure an OPEN seat in place (Phase A A1) — playerId-FIRST, mirroring
   * `usePlayerActions.handleConfigurePlayer`: sets name/job/role and flips
   * `configured: true` on that exact id.
   */
  onConfigurePlayer: (playerId: string, name: string, job: string, role: string) => Promise<void> | void;
```

Current (RosterCards.tsx:274-276, in the destructuring):

```tsx
  actionsForPlayer,
  onAddPlayer,
  onReorder,
```

Replace with:

```tsx
  actionsForPlayer,
  onConfigurePlayer,
  onReorder,
```

Edit 7f — delete the label helper (it moved into `OpenSeatCard`). Current (RosterCards.tsx:215-220):

```tsx
/** "Tank" / "Healer" / "Melee" / ... label for an unconfigured seat's role. */
function emptySeatRoleLabel(player: SnapshotPlayer): string {
  if (player.templateRole) return TEMPLATE_ROLE_INFO[player.templateRole].shortLabel;
  const role = getValidRole(player.role);
  return role.charAt(0).toUpperCase() + role.slice(1);
}
```

Delete the whole block (including the doc comment).

Edit 7g — the open-seat branch. Current (RosterCards.tsx:333-358):

```tsx
  const renderPlayer = (player: SnapshotPlayer): ReactNode => {
    if (!player.configured) {
      const roleLabel = emptySeatRoleLabel(player);
      const highlightClass = player.id === highlightedPlayerId ? ' highlight-pulse rounded-lg' : '';
      return (
        <div key={player.id} id={`player-card-${player.id}`} className={`relative${highlightClass}`}>
          <CardShell as="div" className="relative overflow-hidden border-dashed">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
              style={{ backgroundColor: 'var(--color-border-default)' }}
            />
            <EmptyStateInvite
              icon={<Plus className="h-5 w-5" />}
              title={`Open seat · ${roleLabel}`}
              description={
                player.position
                  ? `Add a player to fill the ${player.position} slot.`
                  : `Add a player to fill this ${roleLabel.toLowerCase()} slot.`
              }
              action={{ label: 'Add player', onClick: onAddPlayer }}
            />
          </CardShell>
        </div>
      );
    }
```

Replace with:

```tsx
  const renderPlayer = (player: SnapshotPlayer): ReactNode => {
    if (!player.configured) {
      const highlightClass = player.id === highlightedPlayerId ? ' highlight-pulse rounded-lg' : '';
      // Open seats get REAL per-seat actions too (Phase A A1): the factory
      // binds Remove to THIS seat's id, and Configure submits through
      // `onConfigurePlayer(player.id, …)` — never a global add that would
      // spawn yet another blank slot elsewhere.
      const seatActions = actionsForPlayer(player);
      return (
        <div key={player.id} id={`player-card-${player.id}`} className={`relative${highlightClass}`}>
          <OpenSeatCard
            player={player}
            canManage={canManage}
            onConfigure={(name, job, role) => onConfigurePlayer(player.id, name, job, role)}
            onRemove={seatActions.onRemove}
          />
        </div>
      );
    }
```

Edit 7h — **mechanical, compile-forced** (explicitly piggybacking per the TDD exception: `tsc -b` fails on the removed/added required prop; no behavior under test changes). In `frontend/src/components/roster/RosterCards.reorder.test.tsx`, current (RosterCards.reorder.test.tsx:57-59):

```tsx
  actionsForPlayer: () => ({ onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn() }),
  onAddPlayer: vi.fn(),
  onReorder: vi.fn(),
```

Replace with:

```tsx
  actionsForPlayer: () => ({ onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn() }),
  onConfigurePlayer: vi.fn(),
  onReorder: vi.fn(),
```

- [ ] **Step 8: Run tests, verify pass** — from `frontend/`:

```bash
pnpm test src/components/roster/RosterCards.test.tsx src/components/roster/RosterCards.reorder.test.tsx src/components/roster/OpenSeatCard.test.tsx
```

All three suites pass. (Note: `Roster.tsx` is now type-broken at its `RosterCards` call site — expected mid-cycle; Cycle 3 fixes it. Vitest does not typecheck, so these runs are green.)

#### Cycle 3 — `Roster` wiring: toolbar → shared modal; configure plumbed through

- [ ] **Step 9: Write the failing Roster tests** — edit `frontend/src/components/roster/Roster.test.tsx`.

First the scaffold. Current (Roster.test.tsx:9):

```tsx
import { render, screen, act } from '@testing-library/react';
```

Replace with:

```tsx
import { render, screen, act, fireEvent } from '@testing-library/react';
```

Add the groupActionsContext mock. Current (Roster.test.tsx:58-61):

```tsx
vi.mock('../../stores/viewAsStore', () => ({
  useViewAsStore: (selector: (s: { viewAsUser: null }) => unknown) =>
    selector({ viewAsUser: null }),
}));
```

Replace with:

```tsx
vi.mock('../../stores/viewAsStore', () => ({
  useViewAsStore: (selector: (s: { viewAsUser: null }) => unknown) =>
    selector({ viewAsUser: null }),
}));

// Phase A A1: Roster's "Add player" goes through the SHARED AddPlayerModal
// flow (useGroupActions().onAddPlayer). Roster renders WITHOUT a
// <GroupActionModals> provider in this suite, so the context hook must be
// mocked (it throws outside a provider). Same shape NewShell.roster.test.tsx
// already uses.
const groupActionsOnAddPlayer = vi.fn();
vi.mock('../../pages/groupActionsContext', () => ({
  useGroupActions: () => ({
    onTierChange: vi.fn(),
    onAddPlayer: groupActionsOnAddPlayer,
    onNewTier: vi.fn(),
    onRollover: vi.fn(),
    onDeleteTier: vi.fn(),
  }),
}));
```

Extend the existing `beforeEach` with mock clears. Current (Roster.test.tsx:148-149):

```tsx
beforeEach(() => {
  window.history.pushState({}, '', '/group/DEVTST?tab=roster');
```

Replace with:

```tsx
beforeEach(() => {
  groupActionsOnAddPlayer.mockClear();
  playerActions.handleAddPlayer.mockClear();
  playerActions.handleConfigurePlayer.mockClear();
  window.history.pushState({}, '', '/group/DEVTST?tab=roster');
```

Then add two tests inside the main `describe('Roster', …)` block, immediately after the existing test ending with `expect(screen.queryByText('●')).not.toBeInTheDocument();` and its closing `});` (i.e. before the describe-block's final `});`):

```tsx
  // Phase A A1 — the toolbar's Add player must open the SHARED AddPlayerModal
  // flow (create + configure atomically), NEVER the raw blank-slot primitive
  // (which left permanently-stuck `configured: false` slots).
  it('wires the toolbar "Add player" to useGroupActions().onAddPlayer, not the raw blank-slot primitive', () => {
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' })]));

    fireEvent.click(screen.getByRole('button', { name: /add player/i }));

    expect(groupActionsOnAddPlayer).toHaveBeenCalledTimes(1);
    expect(playerActions.handleAddPlayer).not.toHaveBeenCalled();
  });

  // Phase A A1 — an open seat's inline configure routes through
  // handleConfigurePlayer with THAT seat's id (real RosterCards + OpenSeatCard;
  // only the RosterCard leaf is stubbed in this suite).
  it("routes an open seat's inline configure to handleConfigurePlayer with that seat's id", () => {
    renderRoster(makeTier([
      makePlayer({ id: 'p1', name: 'Tank One', position: 'T1' }),
      makePlayer({ id: 'p2', name: '', job: '', configured: false, position: 'H1', templateRole: 'pure-healer' }),
    ]));

    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'New Healer' } });
    fireEvent.click(screen.getByTitle('WHM - White Mage'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(playerActions.handleConfigurePlayer).toHaveBeenCalledWith('p2', 'New Healer', 'WHM', 'healer');
  });
```

- [ ] **Step 10: Run it, verify it fails** — from `frontend/`:

```bash
pnpm test src/components/roster/Roster.test.tsx
```

Expected failure signatures: the toolbar test fails with `AssertionError: expected "spy" to be called 1 times, but got 0 times` (Roster still calls `playerActions.handleAddPlayer`); the open-seat routing test fails with `TypeError: onConfigurePlayer is not a function` on the Save click (Roster still passes the removed `onAddPlayer` prop and does not pass `onConfigurePlayer`). All pre-existing tests still pass.

- [ ] **Step 11: Implement the Roster wiring** — three edits to `frontend/src/components/roster/Roster.tsx`.

Edit 11a — import. Current (Roster.tsx:49-52):

```tsx
import { useGroupViewState } from '../../hooks/useGroupViewState';
import { usePlayerActions } from '../../hooks/usePlayerActions';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { useAuthStore } from '../../stores/authStore';
```

Replace with:

```tsx
import { useGroupViewState } from '../../hooks/useGroupViewState';
import { usePlayerActions } from '../../hooks/usePlayerActions';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { useGroupActions } from '../../pages/groupActionsContext';
import { useAuthStore } from '../../stores/authStore';
```

Edit 11b — replace the broken local handler with the shared-flow hook. Current (Roster.tsx:321-323):

```tsx
  const handleAddPlayer = useCallback(() => {
    void playerActions.handleAddPlayer();
  }, [playerActions]);
```

Replace with:

```tsx
  // "Add player" → the SHARED AddPlayerModal flow (groupActionsContext) — the
  // same modal legacy's toolbar and the v2 TopBar use. It creates AND
  // configures the player atomically (name/job/position/tankRole), so no blank
  // `configured: false` slot is ever left behind (Phase A A1). The raw
  // blank-slot wrapper (`playerActions.handleAddPlayer`) is intentionally no
  // longer called from any visible button; the store-level addPlayer primitive
  // still backs the shared modal flow and duplicate-player. `<GroupActionModals>`
  // is guaranteed to be an ancestor: NewShell.tsx:340 wraps the whole v2 tree.
  const { onAddPlayer } = useGroupActions();
```

Edit 11c — toolbar call site. Current (Roster.tsx:351-354):

```tsx
          canManage={canManage}
          onAddPlayer={handleAddPlayer}
        />
      </div>
```

Replace with:

```tsx
          canManage={canManage}
          onAddPlayer={onAddPlayer}
        />
      </div>
```

Edit 11d — RosterCards call site. Current (Roster.tsx:382-384):

```tsx
          actionsForPlayer={actionsForPlayer}
          onAddPlayer={handleAddPlayer}
          onReorder={playerActions.handleReorder}
```

Replace with:

```tsx
          actionsForPlayer={actionsForPlayer}
          onConfigurePlayer={playerActions.handleConfigurePlayer}
          onReorder={playerActions.handleReorder}
```

(Do NOT touch the `void fetchLootLog/fetchCurrentWeek` effect at :193/:194 or the `handleCopyUrl`/`handlePastePlayer` void sites at :285-299 — Task 11 owns those. Do NOT touch the GearBoard call site — Task 3 edits that region next.)

- [ ] **Step 12: Run tests, verify pass** — from `frontend/`:

```bash
pnpm test src/components/roster/Roster.test.tsx
```

All tests pass, including the two new ones.

#### Full-suite verification + commit

- [ ] **Step 13: Run the full suites of every touched/adjacent file** — from `frontend/`:

```bash
pnpm test src/components/roster
pnpm test src/pages/NewShell.roster.test.tsx src/pages/GroupViewContent.rosterSlot.test.tsx src/pages/groupActionsContext.test.tsx
```

The first command covers `Roster.test.tsx`, `RosterCards.test.tsx`, `RosterCards.reorder.test.tsx`, `RosterToolbar.test.tsx` (prop contract unchanged — must stay green untouched), `OpenSeatCard.test.tsx`, and the rest of the roster folder. The second covers the integration neighbors: `NewShell.roster.test.tsx` (already mocks `./groupActionsContext` with an `onAddPlayer` spy, so Roster's new hook call resolves there) and the context suite that already locks the `onAddPlayer` → modal behavior this task now rides on.

- [ ] **Step 14: Build + lint + design-system gates** — from `frontend/` (build is REQUIRED here: it is the only gate that catches the `RosterCards` prop-surface change across all call sites — vitest does not typecheck):

```bash
pnpm build
pnpm lint
pnpm check:design-system
```

All three must be clean. (`OpenSeatCard.tsx` uses only primitives/ui components, semantic tokens, `text-xs`+ sizes, and lucide icons — no new violations expected.)

- [ ] **Step 15: Commit** — from the repo root:

```bash
cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git add frontend/src/components/roster/OpenSeatCard.tsx frontend/src/components/roster/OpenSeatCard.test.tsx frontend/src/components/roster/RosterCards.tsx frontend/src/components/roster/RosterCards.test.tsx frontend/src/components/roster/RosterCards.reorder.test.tsx frontend/src/components/roster/Roster.tsx frontend/src/components/roster/Roster.test.tsx
git commit -m "fix(redesign): phase-a A1 — toolbar Add player opens AddPlayerModal; open seats get per-seat configure/remove"
```

---

### Task 3: Member gear self-edit on the Board — per-row canEditGear replaces screen-wide canManage (A2)

The Board (`GearBoard`) is the ONLY place gear can be edited in v2 (Cards are read-only pips by design), yet it gates every cell on one screen-wide `canManage` — the ROSTER-management permission from `NewShell.tsx` — so a Member has no way to edit their own claimed player's gear anywhere in v2. This task replaces GearBoard's `canManage` prop with the exact trio `Roster.tsx` already passes to `RosterCards` (`userRole` / `currentUserId` / `isAdminAccess`), computes `canEditGear(...).allowed` once per player row, and withholds `onCycle` entirely for non-editable rows (the existing pattern). Concrete call on `cycle()`: its `if (!canManage) return;` guard is **removed with no replacement** — `cycle` is only reachable through the per-row `onCycle` closures, which are withheld for non-editable rows, and `GearBoardCell` additionally no-ops while `disabled` (GearBoardCell.tsx:55-64), so a re-derived guard would be dead code. `GearBoardCell.tsx` needs ZERO changes (verified: its `disabled`/`onCycle` contract is already per-cell generic). All files touched are v2-only; `components/player/GearTable.tsx` (the legacy per-player `canEditGear` pattern at :472) is byte-FROZEN and is a reference only — do not edit it. Blocked-cell tooltip/reason (legacy `disabledTooltip` parity) is explicitly OUT of scope — deferred polish (spec §4). **Execution-order note:** Task 2 (A1) has already edited `Roster.tsx` in the add-player wiring + RosterCards regions before this task runs; this task's only `Roster.tsx` edit is the `<GearBoard>` JSX call-site block, which Task 2 does not touch — the string anchors below target that block exactly.

**Files:**
- Modify: `frontend/src/components/roster/GearBoard.tsx` (imports, props interface, function signature, `cycle()` guard, row-render loop, per-cell `disabled`/`onCycle`)
- Modify: `frontend/src/components/roster/Roster.tsx` (the `<GearBoard>` call site only — inside the `rosterView === 'board'` branch)
- Test: `frontend/src/components/roster/GearBoard.test.tsx` (all 8 existing tests re-propped + 1 new same-render per-row test)

**Interfaces:**
- Consumes: `canEditGear(userRole: MemberRole | null | undefined, player: SnapshotPlayer, currentUserId?: string, isAdmin?: boolean): PermissionCheck` (`frontend/src/utils/permissions.ts:107-118`; `PermissionCheck = { allowed: boolean; reason?: string }`); `MemberRole` (defined identically in `types/index.ts:625`; structurally compatible with `permissions.ts`'s own `MemberRole`); Roster.tsx locals already in scope: `userRole` (:165), `effectiveUserId` (:166), `isAdminAccess` (:162). Nothing from other tasks.
- Produces: changed `GearBoardProps` — `canManage: boolean` REMOVED, replaced by `userRole: MemberRole | null | undefined; currentUserId: string | null; isAdminAccess: boolean` (contract-identical to the trio in `RosterCardsProps`, RosterCards.tsx:94-96). `GearBoard` remains the only consumer-facing export; `Roster.tsx` is its only call site (verified by grep — no other importer).

- [ ] **Step 1: Write the failing per-row test.** Two edits to `frontend/src/components/roster/GearBoard.test.tsx`. First, add `within` to the testing-library import.

Current (GearBoard.test.tsx:2):
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```
Replace with:
```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
```

Second, append the new test inside the `describe('GearBoard', ...)` block, using the suite's existing `player()`/`gear()` fixtures. Anchor on the final test + describe close.

Current (GearBoard.test.tsx:71-78, the last test block and describe close):
```tsx
  it('swallows a rejected onUpdate without an unhandled promise rejection', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('api failed'));
    const factory = () => ({ onUpdate });
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage actionsForPlayer={factory} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  });
});
```
Replace with:
```tsx
  it('swallows a rejected onUpdate without an unhandled promise rejection', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('api failed'));
    const factory = () => ({ onUpdate });
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage actionsForPlayer={factory} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  });

  // A2 (member gear self-edit): the gate must be PER ROW, not screen-wide.
  // A member with a claimed player edits their OWN row's cells while another
  // player's row in the SAME render stays inert — this is the test that
  // proves the screen-wide canManage bug dead.
  it('gates per ROW: a member cycles their own claimed row while another row in the same render stays inert', () => {
    const ownUpdate = vi.fn();
    const otherUpdate = vi.fn();
    const own = player({ id: 'own', name: 'Own Player', userId: 'u-member', gear: gear(0) });
    const other = player({
      id: 'other', name: 'Other Player', job: 'WHM', role: 'healer', position: 'H1',
      userId: 'u-someone-else', gear: gear(0),
    });
    render(
      <GearBoard
        players={[own, other]}
        userRole="member"
        currentUserId="u-member"
        isAdminAccess={false}
        actionsForPlayer={(p) => ({ onUpdate: p.id === 'own' ? ownUpdate : otherUpdate })}
      />,
    );

    const ownRow = screen.getByText('Own Player').closest('tr');
    const otherRow = screen.getByText('Other Player').closest('tr');
    expect(ownRow).not.toBeNull();
    expect(otherRow).not.toBeNull();

    // Own claimed row (player.userId === currentUserId): cells interactive.
    const ownCell = within(ownRow as HTMLElement).getAllByRole('checkbox')[0];
    expect(ownCell).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(ownCell);
    expect(ownUpdate).toHaveBeenCalledTimes(1);

    // Another player's row, SAME render: cells inert, click is a no-op.
    const otherCell = within(otherRow as HTMLElement).getAllByRole('checkbox')[0];
    expect(otherCell).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(otherCell);
    expect(otherUpdate).not.toHaveBeenCalled();
  });
});
```

(Note: at this point the new test passes props `GearBoardProps` does not yet declare — vitest transpiles without type-checking, so the test RUNS and fails on behavior, which is exactly the failing signal we want. The stale `canManage` references in the old tests are cleaned up in Step 4.)

- [ ] **Step 2: Run it, verify it fails.**
```bash
cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/frontend
pnpm test src/components/roster/GearBoard.test.tsx
```
Expected: 8 pass, 1 fail. The new test fails on its first assertion — `expect(ownCell).toHaveAttribute('aria-disabled', 'false')` with `Received: aria-disabled="true"` — because GearBoard still destructures the (now-unsupplied) `canManage`, which is `undefined`, so every cell renders disabled.

- [ ] **Step 3: Implement — GearBoard.tsx per-row gate.** Six anchored edits to `frontend/src/components/roster/GearBoard.tsx`.

Edit 1 — imports. Current (GearBoard.tsx:35-37):
```tsx
import { bisSlotTotals } from '../../utils/rosterReadiness';
import { getRoleColor, getValidRole } from '../../gamedata';
import type { GearSlot, SnapshotPlayer } from '../../types';
```
Replace with:
```tsx
import { bisSlotTotals } from '../../utils/rosterReadiness';
import { canEditGear } from '../../utils/permissions';
import { getRoleColor, getValidRole } from '../../gamedata';
import type { GearSlot, MemberRole, SnapshotPlayer } from '../../types';
```

Edit 2 — props interface. Current (GearBoard.tsx:46-50):
```tsx
export interface GearBoardProps {
  players: SnapshotPlayer[];
  tierId?: string;
  canManage: boolean;
  actionsForPlayer: (player: SnapshotPlayer) => {
```
Replace with:
```tsx
export interface GearBoardProps {
  players: SnapshotPlayer[];
  tierId?: string;
  /**
   * Per-row gear-edit gate inputs — the exact trio `RosterCards` receives
   * (RosterCards.tsx), fed to `canEditGear(userRole, player, currentUserId,
   * isAdminAccess)` once per player row. Owner/lead/admin rows are all
   * editable; a member's OWN claimed row (`player.userId === currentUserId`)
   * is editable while every other row stays inert; viewers edit nothing.
   * Replaces the old screen-wide `canManage` (the ROSTER-management
   * permission, which wrongly locked members out of their own gear).
   */
  userRole: MemberRole | null | undefined;
  currentUserId: string | null;
  isAdminAccess: boolean;
  actionsForPlayer: (player: SnapshotPlayer) => {
```

Edit 3 — function signature. Current (GearBoard.tsx:69):
```tsx
export function GearBoard({ players, tierId, canManage, actionsForPlayer, priorities }: GearBoardProps) {
```
Replace with:
```tsx
export function GearBoard({ players, tierId, userRole, currentUserId, isAdminAccess, actionsForPlayer, priorities }: GearBoardProps) {
```

Edit 4 — `cycle()` guard removal (no replacement guard — see intro). Current (GearBoard.tsx:78-80):
```tsx
  const cycle = async (player: SnapshotPlayer, slot: GearSlot) => {
    if (!canManage) return;
    const g = player.gear.find((x) => x.slot === slot);
```
Replace with:
```tsx
  // No permission guard inside `cycle`: it is only reachable via the per-row
  // `onCycle` closures below, which are withheld entirely for non-editable
  // rows (and `GearBoardCell` additionally no-ops while `disabled`).
  const cycle = async (player: SnapshotPlayer, slot: GearSlot) => {
    const g = player.gear.find((x) => x.slot === slot);
```

Edit 5 — per-row `editable`, computed once per player row. Current (GearBoard.tsx:131-133):
```tsx
              {section.rows.map((player) => {
                const role = getValidRole(player.role);
                const { obtained, total } = playerBis(player);
```
Replace with:
```tsx
              {section.rows.map((player) => {
                const role = getValidRole(player.role);
                // Per-row gear-edit gate (legacy GearTable's per-player
                // canEditGear pattern, adapted to one-row-per-player).
                const editable = canEditGear(userRole, player, currentUserId ?? undefined, isAdminAccess).allowed;
                const { obtained, total } = playerBis(player);
```

Edit 6 — per-cell props. Current (GearBoard.tsx:158-159):
```tsx
                                disabled={!canManage}
                                onCycle={canManage ? () => void cycle(player, slot) : undefined}
```
Replace with:
```tsx
                                disabled={!editable}
                                onCycle={editable ? () => void cycle(player, slot) : undefined}
```

- [ ] **Step 4: Re-prop the 8 pre-existing tests** (pure mechanical re-propping piggybacking on Step 3's prop-contract change — the old `canManage` prop no longer exists, so without this the old tests drive `userRole: undefined` → all rows inert and tests 4/8 fail; explicitly sanctioned as compile-forced mechanical work, not new behavior). Eight anchored edits to `frontend/src/components/roster/GearBoard.test.tsx`.

Edit 1 — add the owner-gate fixture. Current (GearBoard.test.tsx:22):
```tsx
const noop = () => ({ onUpdate: vi.fn() });
```
Replace with:
```tsx
const noop = () => ({ onUpdate: vi.fn() });

/** Owner-level gate — every row editable (replaces the old bare `canManage`). */
const OWNER_GATE = { userRole: 'owner', currentUserId: 'u-owner', isAdminAccess: false } as const;
```

Edit 2 — test "renders a party-divider row...". Current:
```tsx
    render(<GearBoard players={[player({ id: 'a', name: 'Tank One' })]} canManage actionsForPlayer={noop} />);
```
Replace with:
```tsx
    render(<GearBoard players={[player({ id: 'a', name: 'Tank One' })]} {...OWNER_GATE} actionsForPlayer={noop} />);
```

Edit 3 — test "shows the X/11 BiS summary". Current:
```tsx
    render(<GearBoard players={[player({ id: 'a', gear: gear(7) })]} canManage actionsForPlayer={noop} />);
```
Replace with:
```tsx
    render(<GearBoard players={[player({ id: 'a', gear: gear(7) })]} {...OWNER_GATE} actionsForPlayer={noop} />);
```

Edit 4 — test "renders the \"No BiS imported\" row...". Current:
```tsx
    render(<GearBoard players={[noBis]} canManage actionsForPlayer={noop} />);
```
Replace with:
```tsx
    render(<GearBoard players={[noBis]} {...OWNER_GATE} actionsForPlayer={noop} />);
```

Edit 5 — tests "cycling a cell calls the per-player onUpdate..." AND "swallows a rejected onUpdate..." share this identical render line; replace BOTH occurrences (Edit tool `replace_all: true`). Current (appears twice):
```tsx
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage actionsForPlayer={factory} />);
```
Replace with (both occurrences):
```tsx
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} {...OWNER_GATE} actionsForPlayer={factory} />);
```

Edit 6 — the old screen-wide read-only test becomes the member-on-unowned-row gating test (the `canManage={false}` semantic maps to "member with no claim on this row"; the fixture player gets a non-matching `userId`). Current (whole block):
```tsx
  it('is read-only when canManage is false (cells non-interactive)', () => {
    const onUpdate = vi.fn();
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage={false} actionsForPlayer={() => ({ onUpdate })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onUpdate).not.toHaveBeenCalled();
  });
```
Replace with:
```tsx
  it('is read-only for a member on a row they do not own (cells non-interactive)', () => {
    const onUpdate = vi.fn();
    render(<GearBoard players={[player({ id: 'a', gear: gear(0), userId: 'u-someone-else' })]} userRole="member" currentUserId="u-member" isAdminAccess={false} actionsForPlayer={() => ({ onUpdate })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onUpdate).not.toHaveBeenCalled();
  });
```

Edit 7 — test "renders exactly one next-upgrade glyph...". Current:
```tsx
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage actionsForPlayer={noop} priorities={priorities} />);
```
Replace with:
```tsx
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} {...OWNER_GATE} actionsForPlayer={noop} priorities={priorities} />);
```

Edit 8 — test "renders no next-upgrade glyphs when `priorities` is omitted". Current:
```tsx
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} canManage actionsForPlayer={noop} />);
```
Replace with:
```tsx
    render(<GearBoard players={[player({ id: 'a', gear: gear(0) })]} {...OWNER_GATE} actionsForPlayer={noop} />);
```

- [ ] **Step 5: Run the GearBoard suite, verify all pass.**
```bash
cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/frontend
pnpm test src/components/roster/GearBoard.test.tsx
```
Expected: 9 tests pass (8 re-propped + the new per-row test).

- [ ] **Step 6: Verify the stale Roster call site fails the build** (this compile failure is the failing check that drives the call-site edit — `Roster.tsx` still passes the removed `canManage` prop and omits the new required trio).
```bash
cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/frontend
pnpm build
```
Expected: `tsc -b` fails at `src/components/roster/Roster.tsx` on the `<GearBoard` element — TS2739 (missing properties `userRole`, `currentUserId`, `isAdminAccess` from type `GearBoardProps`) and/or TS2322 (`canManage` does not exist on type `IntrinsicAttributes & GearBoardProps`).

- [ ] **Step 7: Implement — Roster.tsx call site.** One anchored edit inside the `rosterView === 'board'` branch. `userRole`, `effectiveUserId`, and `isAdminAccess` are already computed locally (Roster.tsx:160-166) and already passed in this exact shape to `<RosterCards>` a few lines below — nothing new is derived. `canManage` stays a `RosterProps` prop (RosterToolbar and CharacterManageBridge still consume it); only GearBoard stops receiving it.

Current (Roster.tsx:357-363, inside `{rosterView === 'board' ? (`):
```tsx
        <GearBoard
          players={sortedPlayers}
          tierId={tierId}
          canManage={canManage}
          actionsForPlayer={actionsForPlayer}
          priorities={priorities}
        />
```
Replace with:
```tsx
        <GearBoard
          players={sortedPlayers}
          tierId={tierId}
          userRole={userRole}
          currentUserId={effectiveUserId ?? null}
          isAdminAccess={isAdminAccess}
          actionsForPlayer={actionsForPlayer}
          priorities={priorities}
        />
```

- [ ] **Step 8: Run the build, verify it passes.**
```bash
cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/frontend
pnpm build
```
Expected: `tsc -b && vite build` completes with no errors.

- [ ] **Step 9: Spot-check the Roster suite** (the board-view tests render with mocked authStore user `u1` + `group.userRole: 'owner'` → owner gate ⇒ the Board still renders editable; these tests must pass unchanged).
```bash
cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/frontend
pnpm test src/components/roster/Roster.test.tsx
```
Expected: all tests pass with no edits to that file.

- [ ] **Step 10: Full suites of every touched surface + lint + design-system.**
```bash
cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/frontend
pnpm test src/components/roster/GearBoard.test.tsx src/components/roster/Roster.test.tsx src/components/roster/GearBoardCell.test.tsx src/pages/NewShell.roster.test.tsx
pnpm lint
pnpm check:design-system
```
Expected: all four test files green (GearBoardCell + NewShell.roster confirm the untouched cell contract and slot integration still hold); lint and design-system report no new violations.

- [ ] **Step 11: Commit.**
```bash
cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git add frontend/src/components/roster/GearBoard.tsx frontend/src/components/roster/Roster.tsx frontend/src/components/roster/GearBoard.test.tsx
git commit -m "fix(redesign): phase-a — member gear self-edit on the Board (per-row canEditGear replaces screen-wide canManage)"
```

---

### Task 4: Tome-weapon interim affordance — kebab toggle in useRosterCardActions (A3)

The tome-weapon "pursuing" toggle exists only in the frozen legacy shell (`WeaponBiSSelector` inside `GearTable.tsx:301-427`); v2 has **no `tomeWeapon` affordance** (only an inert pass-through in `Roster.tsx`'s paste handler plus test fixtures), so a v2-only user cannot start or stop tracking an interim tome weapon at all. Fix: one direct-action item in the v2 roster kebab's "BiS & Gear" section (adjacent to "Weapon Priorities"), mirroring the existing "Mark as Sub" direct-action pattern — the mutation is just the generic `actions.onUpdate({ tomeWeapon: {...} })`, which already resolves to the same tierStore path legacy uses (`Roster.tsx:306` → `usePlayerActions.handleUpdatePlayer` → `updatePlayer`). **Deliberately toggle-only:** the tome weapon's have/augmented states stay legacy-only until Phase C restores the GearTable — the dual shell is the escape hatch meanwhile (approved skim default §6.4). FROZEN, reference-only, do NOT edit: `frontend/src/components/player/GearTable.tsx`, `frontend/src/components/player/PlayerCard.tsx`. Also do NOT modify or delete `frontend/src/components/player/BiSSourceSelector.tsx` (not frozen, but its sole importer is frozen `GearTable`). No changes to `Roster.tsx`, `usePlayerActions.ts`, or any store — the plumbing already exists. Order note: Task 11 (void sweep) later edits `useRosterCardActions.tsx` around former lines :447/:632 — a different region; your insertion shifts line numbers below it, which is harmless because all edits (yours and Task 11's) anchor on strings, not line numbers.

**Files:**
- Modify: `frontend/src/hooks/useRosterCardActions.tsx` (lucide import list at top; `buildMenuItems` "BiS & Gear" section, after the "Weapon Priorities" item)
- Test: `frontend/src/hooks/useRosterCardActions.test.tsx` (`makePlayer()` fixture + 4 new tests appended to the existing `describe`)

**Interfaces:**
- Consumes (all pre-existing — nothing from other tasks):
  - `RosterCardActions.onUpdate: (updates: Partial<SnapshotPlayer>) => Promise<void> | void` (`useRosterCardActions.tsx:85`)
  - `editPermission: PermissionCheck` — already computed in the hook via `canEditPlayer(userRole, player, uid, isAdminAccess)` (`useRosterCardActions.tsx:373`), destructured into `buildMenuItems`; `editTip = editPermission.allowed ? undefined : editPermission.reason` (`:186`)
  - `TomeWeaponStatus { pursuing: boolean; hasItem: boolean; isAugmented: boolean }` (`types/index.ts:245-249`) — a **required** field on `SnapshotPlayer` (`types/index.ts:851`), but test doubles omit it, so the item handles `player.tomeWeapon` being `undefined` defensively (`?.`)
  - `ContextMenuItem` label-variant shape `{ label, icon?, onClick?, disabled?, tooltip?, ... }` (`components/ui/ContextMenu.tsx:13-23`)
  - `BookMarked` icon from `lucide-react` (existence verified: already imported at `pages/DesignSystem.tsx:80`; distinct from `Swords`, which the adjacent "Weapon Priorities" item uses)
- Produces:
  - Two new kebab labels in the "BiS & Gear" section: `'Track Tome Weapon'` (when `pursuing` is falsy) ⇄ `'Stop Tracking Tome Weapon'` (when `pursuing` is true) — reviewers/browser-validation look for these exact strings
  - Test fixture change: `makePlayer()` in `useRosterCardActions.test.tsx` now defaults `tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false }` — any later task touching this suite inherits that default
  - No exported TS signature changes (`RosterCardActions`, `RosterCardActionParams`, `RosterCardActionResult` all unchanged)

- [ ] **Step 1: Give the test fixture a default `tomeWeapon`** — part of arranging the failing tests: without it the new item's label/payload would be non-deterministic (production type requires the field; the double omits it).

  Current (`frontend/src/hooks/useRosterCardActions.test.tsx:60-70`):
  ```tsx
  const makePlayer = (overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer =>
    ({
      id: 'p1',
      name: 'Aria',
      job: 'PLD',
      role: 'tank',
      gear: [],
      weaponPriorities: [],
      isSubstitute: false,
      ...overrides,
    }) as unknown as SnapshotPlayer;
  ```
  Replace with:
  ```tsx
  const makePlayer = (overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer =>
    ({
      id: 'p1',
      name: 'Aria',
      job: 'PLD',
      role: 'tank',
      gear: [],
      weaponPriorities: [],
      isSubstitute: false,
      tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
      ...overrides,
    }) as unknown as SnapshotPlayer;
  ```

- [ ] **Step 2: Write the failing tests** — append four tests inside the existing `describe('useRosterCardActions', ...)` block, reusing the suite's own scaffolding (`renderHook`/`act` are already imported at line 9; `labelOrHeader` helper at lines 73-78; the fresh-`actions` override pattern matches the existing Take/Release tests at lines 145/160). There is no prior payload-assertion precedent in this file (no existing test asserts a `toHaveBeenCalledWith` payload on a menu action); follow the shape below exactly.

  Current (`frontend/src/hooks/useRosterCardActions.test.tsx:190-193` — end of the file):
  ```tsx
      const { getByTestId } = render(<>{result.current.modalsNode}</>);
      expect(getByTestId('bis-import')).toBeInTheDocument();
    });
  });
  ```
  Replace with:
  ```tsx
      const { getByTestId } = render(<>{result.current.modalsNode}</>);
      expect(getByTestId('bis-import')).toBeInTheDocument();
    });

    it('adds the tome-weapon toggle to BiS & Gear, directly after Weapon Priorities', () => {
      const { result } = renderHook(() => useRosterCardActions({ ...base, player: makePlayer() }));
      const labels = result.current.menuItems.map(labelOrHeader);

      expect(labels).toContain('Track Tome Weapon');
      // Inside the BiS & Gear section (before the next section header)…
      const idx = labels.indexOf('Track Tome Weapon');
      expect(idx).toBeGreaterThan(labels.indexOf('BiS & Gear'));
      expect(idx).toBeLessThan(labels.indexOf('Player Management'));
      // …immediately after its weapon-slot sibling.
      expect(labels[labels.indexOf('Weapon Priorities') + 1]).toBe('Track Tome Weapon');
    });

    it('flips the label to Stop Tracking Tome Weapon while pursuing', () => {
      const { result } = renderHook(() =>
        useRosterCardActions({
          ...base,
          player: makePlayer({ tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false } }),
        }),
      );
      const labels = result.current.menuItems.map(labelOrHeader);
      expect(labels).toContain('Stop Tracking Tome Weapon');
      expect(labels).not.toContain('Track Tome Weapon');
    });

    it('disables the tome-weapon toggle for a viewer', () => {
      const { result } = renderHook(() =>
        useRosterCardActions({ ...base, userRole: 'viewer', player: makePlayer() }),
      );
      const item = result.current.menuItems.find(
        (i) => 'label' in i && i.label === 'Track Tome Weapon',
      );
      expect(item).toBeDefined();
      expect(item && 'disabled' in item ? item.disabled : undefined).toBe(true);
    });

    it('onClick toggles pursuing via actions.onUpdate (spread of the existing status)', () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useRosterCardActions({
          ...base,
          player: makePlayer(),
          actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
        }),
      );
      const item = result.current.menuItems.find(
        (i) => 'label' in i && i.label === 'Track Tome Weapon',
      );
      expect(item).toBeDefined();
      act(() => {
        if (item && 'onClick' in item) item.onClick?.();
      });
      expect(onUpdate).toHaveBeenCalledWith({
        tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
      });
    });
  });
  ```

- [ ] **Step 3: Run it, verify it fails** — from `frontend/`:
  ```bash
  pnpm test src/hooks/useRosterCardActions.test.tsx
  ```
  Expected: exactly the 4 new tests fail, all 9 pre-existing tests still pass (the fixture default must not break them — if any pre-existing test fails, stop and diagnose before proceeding). Failure signatures: `AssertionError: expected [ …labels… ] to include 'Track Tome Weapon'`, `…to include 'Stop Tracking Tome Weapon'`, and twice `AssertionError: expected undefined not to be undefined` (the `expect(item).toBeDefined()` in the viewer/onClick tests).

- [ ] **Step 4: Implement — add the `BookMarked` import.**

  Current (`frontend/src/hooks/useRosterCardActions.tsx:45-48`):
  ```tsx
  import {
    ClipboardPaste,
    Copy,
    CopyPlus,
  ```
  Replace with:
  ```tsx
  import {
    BookMarked,
    ClipboardPaste,
    Copy,
    CopyPlus,
  ```

- [ ] **Step 5: Implement — insert the menu item after "Weapon Priorities".** Same fields as its neighbors (`label`/`icon`/`onClick`/`disabled`/`tooltip`), gated by `editPermission` exactly like "Weapon Priorities" above it, onClick mirroring the "Mark as Sub" direct-action precedent (`useRosterCardActions.tsx:259-265`).

  Current (`frontend/src/hooks/useRosterCardActions.tsx:214-220`):
  ```tsx
    items.push({
      label: 'Weapon Priorities',
      icon: <Swords className={ICON} />,
      onClick: open.weaponPriority,
      disabled: !editPermission.allowed,
      tooltip: editTip,
    });
  ```
  Replace with:
  ```tsx
    items.push({
      label: 'Weapon Priorities',
      icon: <Swords className={ICON} />,
      onClick: open.weaponPriority,
      disabled: !editPermission.allowed,
      tooltip: editTip,
    });
    // Interim tome-weapon affordance (Phase A / A3): toggles `pursuing` ONLY.
    // The tome weapon's have/augmented states stay legacy-only until Phase C
    // restores the full GearTable in v2 — the dual shell covers them meanwhile.
    // `player.tomeWeapon` is required in production but read defensively (`?.`)
    // because test doubles may omit it.
    items.push({
      label: player.tomeWeapon?.pursuing ? 'Stop Tracking Tome Weapon' : 'Track Tome Weapon',
      icon: <BookMarked className={ICON} />,
      onClick: () =>
        actions.onUpdate({
          tomeWeapon: { ...player.tomeWeapon, pursuing: !player.tomeWeapon?.pursuing },
        }),
      disabled: !editPermission.allowed,
      tooltip: editTip,
    });
  ```

- [ ] **Step 6: Run tests, verify pass** — from `frontend/`:
  ```bash
  pnpm test src/hooks/useRosterCardActions.test.tsx
  ```
  Expected: all 13 tests pass (9 pre-existing + 4 new).

- [ ] **Step 7: Full suites of every touched surface** — from `frontend/`, run the hook's suite plus `RosterCard.test.tsx` (it renders the real hook end-to-end through the kebab, so the new item flows through it — its fixture uses `tomeWeapon: {}`, which the `?.` handles, and it only asserts presence of specific labels, so the additive item must not break it):
  ```bash
  pnpm test src/hooks/useRosterCardActions.test.tsx src/components/roster/RosterCard.test.tsx
  ```
  Expected: both files fully green. Then confirm compile + lint + design-system cleanliness on the diff:
  ```bash
  pnpm build
  pnpm lint
  pnpm check:design-system
  ```
  Expected: `pnpm build` succeeds (`tsc -b` clean); `pnpm lint` and `pnpm check:design-system` report no NEW violations in `useRosterCardActions.tsx` / `useRosterCardActions.test.tsx` (pre-existing warnings elsewhere are out of scope).

- [ ] **Step 8: Commit** — from the repo root:
  ```bash
  cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
  git add frontend/src/hooks/useRosterCardActions.tsx frontend/src/hooks/useRosterCardActions.test.tsx
  git commit -m "fix(redesign): phase-a — tome-weapon pursuing toggle reachable in v2 (roster kebab)"
  ```

---

### Task 5: Danger Zone — Delete retarget · Leave Static (Plan M §1) · Archive removed (A4)

MorePage's Danger Zone is dead in BOTH shells: all three buttons call `onOpenSettings('danger')`, but `'danger'` is not a `SettingsTab`, so `SettingsPanel` silently falls back to General — Delete Static is unreachable from here, Leave/Archive never act. Three sub-fixes: (1) Delete retargets to the real `'static'` tab (where StaticTab's working type-the-name delete flow lives); (2) Leave Static is implemented for real — the backend self-leave endpoint (owner-guard + `unlink_players=true` default) and `staticGroupStore.removeMember` (zero call sites today) already exist; MorePage gains a lightweight `ConfirmModal` and GroupViewContent prebinds the real handler (this is the real prod request from the Grimm report / Plan M §1); (3) the Archive button is removed outright — no backend/model/endpoint exists and no "Coming soon" placeholder (archive semantics are an undecided product question). Every touched file is SHARED between shells — each edit is an enumerated bugfix, diffs stay minimal and additive, and both smoke suites (`e2e/smoke.spec.ts` + `e2e/smoke-legacy.spec.ts`) must stay green (verified in Task 15; neither suite exercises the More page's Danger Zone, so the exposure here is compile/prop-threading level). ORDER NOTE: Task 6 (A5) later adds a second optional MorePage prop (`onSwitchToClassicUi?: () => void`) and edits the same GroupViewContent call-site region — this task's insertion is anchored immediately after `onOpenPlugin` and leaves the `canManage`/`userRole` tail lines untouched so Task 6 can anchor on them cleanly. No release-note edit in this task (the internal entry lands at PR time; no version bump anywhere in this phase). Backend: no changes (`static_groups.py:1110-1164` self-leave is reference-only).

**Files:**
- Modify: `frontend/src/components/group/MorePage.tsx` (Danger Zone buttons, props, new ConfirmModal — shared, both shells)
- Modify: `frontend/src/pages/GroupViewContent.tsx` (line-98 store destructure + `onLeaveStatic` threading at the `pageMode === 'more'` MorePage call site — shared, both shells)
- Test: `frontend/src/components/group/MorePage.test.tsx` (Danger Zone currently has ZERO coverage — new tests for all three behaviors)
- Test: `frontend/src/pages/GroupViewContent.slots.test.tsx` (prop wiring, both shell halves)
- Reference only (NO edits): `frontend/src/stores/staticGroupStore.ts` (`removeMember` at :364-370 already calls `DELETE /api/static-groups/{groupId}/members/{userId}`, which the backend defaults to `unlink_players=true`; `setCurrentGroup` at :277-279), `frontend/src/components/settings/StaticTab.tsx` (delete-flow precedent), `frontend/src/components/ui/ConfirmModal.tsx`, `backend/app/routers/static_groups.py`

**Interfaces:**
- Consumes: `removeMember(groupId: string, userId: string): Promise<void>` and `setCurrentGroup(group: StaticGroup | null): void` from `useStaticGroupStore` (both already in `StaticGroupState`, staticGroupStore.ts:35/:41); `toast.success(message: string, duration?: number)` / `toast.error(message: string, duration?: number)` from `stores/toastStore` (already imported in GVC at :32); `navigate` from `useNavigate()` (already at GVC :97); `effectiveUserId` (GVC :358, viewAs-aware — the file's existing "current user id" pattern, used verbatim at :1045/:1135); `ConfirmModal` props `{ isOpen, title, message, confirmLabel?, variant?, icon?, onConfirm: () => Promise<void> | void, onCancel: () => void }` (`components/ui/ConfirmModal.tsx:14-29`). Nothing from other tasks.
- Produces: `MorePageProps.onLeaveStatic?: () => void | Promise<void>` (optional, additive — PRESCRIBED CROSS-TASK CONTRACT: Task 6 depends on this exact name/shape; do not rename). MorePage owns the ConfirmModal + confirm state locally; GroupViewContent prebinds the real handler and passes it in the `pageMode === 'more'` branch (both shells — the branch has no slot gate).

Decisions locked by the approved spec (§6.1) and made concrete here:
- **Confirm weight:** lightweight `ConfirmModal` (variant `danger`, `LogOut` icon), NOT the type-the-name flow — leaving is reversible by re-invite. Copy says "static" (never "group") and states claimed players will be unlinked. `unlink_players` stays at the backend default `true`; no toggle exposed.
- **Post-leave local state:** `removeMember` already prunes the leaver from `currentGroup.members`; the handler additionally calls `setCurrentGroup(null)` — the minimal mirror of `deleteGroup`'s cleanup (staticGroupStore.ts:261-264 nulls `currentGroup`; StaticTab then navigates). The stale `groups` list entry self-heals: the redirect target `Profile.tsx` calls `fetchGroups()` on mount (:186), so no explicit refetch is needed in the handler.
- **Redirect:** `navigate('/profile?tab=statics')` — the StaticTab delete precedent (StaticTab.tsx:135).
- **Errors:** handler catches and `toast.error`s (mirrors `StaticTab.handleDelete`, :136-141) and never rethrows, so `ConfirmModal.handleConfirm`'s un-caught `await onConfirm()` can't produce an unhandled rejection.
- **Missing-prop degradation:** the Leave button renders only when `onLeaveStatic` is wired; additionally the whole Danger Zone section hides when it would render zero buttons (non-owner member + no handler). Owner never sees Leave (existing `isOwner` branching preserved); backend owner-guard backstops.
- **Raw `<button>` styling kept:** the Danger Zone buttons are pre-existing raw buttons under the file-level `/* eslint-disable design-system/no-raw-button */`; this task rewires/removes them without introducing new raw elements (net −1 raw button). The new modal is the design-system `ConfirmModal`.

#### Cycle 1 — Delete retargets to the real `'static'` tab; Archive removed

- [ ] **Step 1: Write the failing tests** — append these two tests inside the existing `describe('MorePage', ...)` block of `frontend/src/components/group/MorePage.test.tsx` (after the `'keeps the Integrations card copy unchanged'` test, before the closing `});`). They reuse the suite's existing `renderMorePage` helper and store mocks unchanged:

```tsx
  // ── Danger Zone (Phase A Task 5 / A4) ──

  it("owner: Delete Static opens the settings panel on the real 'static' tab (not the dead 'danger' id)", () => {
    const onOpenSettings = vi.fn();
    renderMorePage({ onOpenSettings });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Static' }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledWith('static');
  });

  it('owner: Archive Static is removed outright (no button, no Coming-soon placeholder)', () => {
    renderMorePage();
    expect(screen.queryByText('Archive Static')).toBeNull();
  });
```

- [ ] **Step 2: Run, verify both fail** — from `frontend/`:

```bash
pnpm test src/components/group/MorePage.test.tsx
```

Expected: the Delete test fails with `expected "spy" to be called with arguments: [ 'static' ]` (received `'danger'`); the Archive test fails with `expect(element).toBeNull()` (the `Archive Static` button is found). The 5 pre-existing tests stay green.

- [ ] **Step 3: Implement** — one edit in `frontend/src/components/group/MorePage.tsx`.

Current (MorePage.tsx:328-353):

```tsx
            <div className="flex flex-wrap gap-2">
              {!isOwner && (
                <button
                  onClick={() => onOpenSettings('danger')}
                  className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                >
                  Leave Static
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => onOpenSettings('danger')}
                    className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                  >
                    Archive Static
                  </button>
                  <button
                    onClick={() => onOpenSettings('danger')}
                    className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                  >
                    Delete Static
                  </button>
                </>
              )}
            </div>
```

Replace with (Delete → the real `'static'` tab, Archive gone, Leave untouched until Cycle 2):

```tsx
            <div className="flex flex-wrap gap-2">
              {!isOwner && (
                <button
                  onClick={() => onOpenSettings('danger')}
                  className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                >
                  Leave Static
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => onOpenSettings('static')}
                  className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                >
                  Delete Static
                </button>
              )}
            </div>
```

(No dangling imports from the Archive removal — the Archive button used no icon of its own; `AlertTriangle`/`Sword`/`Download`/`Activity` all remain in use by other cards.)

- [ ] **Step 4: Run, verify pass** — from `frontend/`:

```bash
pnpm test src/components/group/MorePage.test.tsx
```

Expected: all 7 tests pass.

#### Cycle 2 — Leave Static: `onLeaveStatic` prop + ConfirmModal in MorePage

- [ ] **Step 5: Write the failing tests** — three edits to `frontend/src/components/group/MorePage.test.tsx`.

Edit 5a — the new tests mount `ConfirmModal` → `Modal` → `useDevice`, which requires `window.matchMedia` (jsdom has none — same stub `WeekScopeControl.test.tsx:10-26` uses), and the flow tests need `waitFor`.

Current (MorePage.test.tsx:14):

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
```

Replace with:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

Edit 5b — Current (MorePage.test.tsx:49-51):

```tsx
  beforeEach(() => {
    vi.clearAllMocks();
  });
```

Replace with:

```tsx
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no matchMedia; ConfirmModal -> Modal -> useDevice needs it
    // (Modal's hooks run even while isOpen is false). Same stub as
    // WeekScopeControl.test.tsx.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });
```

Edit 5c — append these four tests right after the two Cycle-1 tests (still inside the `describe` block). Note: until Step 7 lands, `onLeaveStatic` is an excess property on `Partial<MorePageProps>` — vitest (esbuild) still runs the file; `pnpm build` only needs to be clean at commit time (Step 13):

```tsx
  it('owner: never sees Leave Static, even when onLeaveStatic is wired', () => {
    renderMorePage({ onLeaveStatic: vi.fn() });
    expect(screen.queryByText('Leave Static')).toBeNull();
  });

  it('member: clicking Leave Static opens the confirm modal; confirming calls onLeaveStatic (settings panel never involved)', async () => {
    const onLeaveStatic = vi.fn().mockResolvedValue(undefined);
    const onOpenSettings = vi.fn();
    renderMorePage({ userRole: 'member' as MemberRole, canManage: false, onLeaveStatic, onOpenSettings });

    fireEvent.click(screen.getByRole('button', { name: 'Leave Static' }));

    // The confirm modal opens with the unlink warning; nothing fired yet.
    expect(screen.getByText(/claimed will be unlinked/i)).toBeInTheDocument();
    expect(onLeaveStatic).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Leave Static' }));

    await waitFor(() => expect(onLeaveStatic).toHaveBeenCalledTimes(1));
    expect(onOpenSettings).not.toHaveBeenCalled();
    // The modal closes after the handler resolves.
    await waitFor(() => expect(screen.queryByText(/claimed will be unlinked/i)).toBeNull());
  });

  it('member: cancelling the confirm modal closes it without calling onLeaveStatic', async () => {
    const onLeaveStatic = vi.fn();
    renderMorePage({ userRole: 'member' as MemberRole, canManage: false, onLeaveStatic });

    fireEvent.click(screen.getByRole('button', { name: 'Leave Static' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/claimed will be unlinked/i)).toBeNull());
    expect(onLeaveStatic).not.toHaveBeenCalled();
  });

  it('member: Leave Static (and the then-empty Danger Zone) are absent when onLeaveStatic is not wired', () => {
    renderMorePage({ userRole: 'member' as MemberRole, canManage: false });
    expect(screen.queryByText('Leave Static')).toBeNull();
    expect(screen.queryByText('Danger Zone')).toBeNull();
  });
```

- [ ] **Step 6: Run, verify the red/green split** — from `frontend/`:

```bash
pnpm test src/components/group/MorePage.test.tsx
```

Expected: 3 of the 4 new tests FAIL — the member-flow test with `TestingLibraryElementError: Unable to find an element with the text: /claimed will be unlinked/i` (clicking Leave still calls `onOpenSettings('danger')`, no modal), the cancel test with `Unable to find an accessible element with the role "button" and name "Cancel"`, and the no-prop test because `Leave Static` is found (the button currently renders for any non-owner member). The owner test passes from the start — it is a deliberate regression PIN of existing gating (owner never had a Leave button), not a red-first test; call this out and proceed.

- [ ] **Step 7: Implement** — six small edits to `frontend/src/components/group/MorePage.tsx`.

Edit 7a — Current (MorePage.tsx:1-6):

```tsx
/* eslint-disable design-system/no-raw-button */
import {
  Users, Settings, Link2, Book, Sword, Download, Activity,
  AlertTriangle, ChevronRight, Clock, ExternalLink, CheckCircle, XCircle, PlugZap,
} from 'lucide-react';
import type { MemberRole, PageMode } from '../../types';
```

Replace with:

```tsx
/* eslint-disable design-system/no-raw-button */
import { useState } from 'react';
import {
  Users, Settings, Link2, Book, Sword, Download, Activity,
  AlertTriangle, ChevronRight, Clock, ExternalLink, CheckCircle, XCircle, PlugZap, LogOut,
} from 'lucide-react';
import type { MemberRole, PageMode } from '../../types';
```

Edit 7b — Current (MorePage.tsx:10):

```tsx
import { DashboardCard, IconMedallion, SectionLabel } from '../ui/DashboardCard';
```

Replace with:

```tsx
import { DashboardCard, IconMedallion, SectionLabel } from '../ui/DashboardCard';
import { ConfirmModal } from '../ui/ConfirmModal';
```

Edit 7c — Current (MorePage.tsx:24-26, end of `MorePageProps`):

```tsx
  canManage: boolean;
  userRole: MemberRole | null;
}
```

Replace with:

```tsx
  canManage: boolean;
  userRole: MemberRole | null;
  /** Self-service leave (non-owners). The caller (GroupViewContent) prebinds
   *  the real handler — removeMember + toast + redirect. The Leave Static
   *  button renders only when this is wired, so hosts that don't pass it
   *  degrade gracefully to no button. */
  onLeaveStatic?: () => void | Promise<void>;
}
```

Edit 7d — Current (MorePage.tsx:37-41, function destructure tail):

```tsx
  onOpenIntegrations,
  onOpenPlugin,
  canManage,
  userRole,
}: MorePageProps) {
```

Replace with:

```tsx
  onOpenIntegrations,
  onOpenPlugin,
  canManage,
  userRole,
  onLeaveStatic,
}: MorePageProps) {
```

Edit 7e — Current (MorePage.tsx:57-58):

```tsx
  const isOwner = userRole === 'owner';
  const isMember = !!userRole && userRole !== 'viewer';
```

Replace with:

```tsx
  const isOwner = userRole === 'owner';
  const isMember = !!userRole && userRole !== 'viewer';
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
```

Edit 7f — Current (MorePage.tsx:308-309, the section gate):

```tsx
      {/* Danger Zone */}
      {isMember && (
```

Replace with:

```tsx
      {/* Danger Zone — hidden entirely when it would render no buttons
          (non-owner member whose host didn't wire onLeaveStatic). */}
      {isMember && (isOwner || !!onLeaveStatic) && (
```

Edit 7g — Current (the Leave button as it stands AFTER Step 3 — the only remaining `onOpenSettings('danger')` in the file):

```tsx
              {!isOwner && (
                <button
                  onClick={() => onOpenSettings('danger')}
                  className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                >
                  Leave Static
                </button>
              )}
```

Replace with:

```tsx
              {!isOwner && onLeaveStatic && (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                >
                  Leave Static
                </button>
              )}
```

Edit 7h — Current (MorePage.tsx:355-360, end of file after the Danger Zone section):

```tsx
        </section>
      )}

    </div>
  );
}
```

Replace with:

```tsx
        </section>
      )}

      {/* Leave Static confirm — deliberately lighter than delete's
          type-the-name flow: leaving is reversible by re-invite. */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="Leave Static?"
        message="You will be removed from this static's roster, and any players you've claimed will be unlinked from your account. You can rejoin later with a new invite."
        confirmLabel="Yes, Leave Static"
        variant="danger"
        icon={<LogOut className="w-5 h-5 text-status-error" />}
        onConfirm={async () => {
          await onLeaveStatic?.();
          setShowLeaveConfirm(false);
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />

    </div>
  );
}
```

- [ ] **Step 8: Run, verify pass** — from `frontend/`:

```bash
pnpm test src/components/group/MorePage.test.tsx
```

Expected: all 11 tests pass.

#### Cycle 3 — GroupViewContent threads the real handler (both shells)

- [ ] **Step 9: Write the failing tests** — four edits to `frontend/src/pages/GroupViewContent.slots.test.tsx`, reusing the suite's capture-mock pattern (the MorePage mock renders a button only when an optional prop is passed, so prop presence/absence and the wired handler are both assertable).

Edit 9a — Current (GroupViewContent.slots.test.tsx:86-88):

```tsx
vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: () => ({ currentGroup, groups: [currentGroup] }),
}));
```

Replace with (spies referenced lazily inside the hook body — same hoisting-safe shape as `settingsPanelOpenSpy` below it):

```tsx
const removeMemberSpy = vi.fn().mockResolvedValue(undefined);
const setCurrentGroupSpy = vi.fn();
vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: () => ({
    currentGroup,
    groups: [currentGroup],
    removeMember: removeMemberSpy,
    setCurrentGroup: setCurrentGroupSpy,
  }),
}));
```

Edit 9b — Current (GroupViewContent.slots.test.tsx:160-174, the MorePage capture mock):

```tsx
vi.mock('../components/group/MorePage', () => ({
  MorePage: (props: {
    onOpenIntegrations: () => void;
    onOpenLootHistory: () => void;
    onOpenSplitPlanner?: () => void;
  }) => (
    <div data-testid="more-page">
      <button onClick={() => props.onOpenIntegrations()}>open-integrations</button>
      <button onClick={() => props.onOpenLootHistory()}>open-loot-history</button>
      {props.onOpenSplitPlanner && (
        <button onClick={props.onOpenSplitPlanner}>open-split-planner</button>
      )}
    </div>
  ),
}));
```

Replace with:

```tsx
vi.mock('../components/group/MorePage', () => ({
  MorePage: (props: {
    onOpenIntegrations: () => void;
    onOpenLootHistory: () => void;
    onOpenSplitPlanner?: () => void;
    onLeaveStatic?: () => void | Promise<void>;
  }) => (
    <div data-testid="more-page">
      <button onClick={() => props.onOpenIntegrations()}>open-integrations</button>
      <button onClick={() => props.onOpenLootHistory()}>open-loot-history</button>
      {props.onOpenSplitPlanner && (
        <button onClick={props.onOpenSplitPlanner}>open-split-planner</button>
      )}
      {props.onLeaveStatic && (
        <button onClick={() => { void props.onLeaveStatic?.(); }}>leave-static</button>
      )}
    </div>
  ),
}));
```

Edit 9c — Current (GroupViewContent.slots.test.tsx:214-216, tail of the first describe's beforeEach):

```tsx
    settingsPanelOpenSpy.mockClear();
  });
  afterEach(() => { mockAddedPlayer = null; });
```

Replace with:

```tsx
    settingsPanelOpenSpy.mockClear();
    removeMemberSpy.mockClear();
    setCurrentGroupSpy.mockClear();
  });
  afterEach(() => { mockAddedPlayer = null; });
```

Edit 9d — two new tests. First, in the v2 (all-slots) describe — Current (GroupViewContent.slots.test.tsx:284-290):

```tsx
  it("wires MorePage's onOpenLootHistory to setPageMode('gear', { lview: 'history' })", () => {
    mockPageMode = 'more';
    renderContent();
    screen.getByText('open-loot-history').click();
    expect(setPageMode).toHaveBeenCalledTimes(1);
    expect(setPageMode).toHaveBeenCalledWith('gear', { lview: 'history' });
  });
```

Replace with (existing test kept verbatim, new test appended):

```tsx
  it("wires MorePage's onOpenLootHistory to setPageMode('gear', { lview: 'history' })", () => {
    mockPageMode = 'more';
    renderContent();
    screen.getByText('open-loot-history').click();
    expect(setPageMode).toHaveBeenCalledTimes(1);
    expect(setPageMode).toHaveBeenCalledWith('gear', { lview: 'history' });
  });

  // ── Leave Static (Phase A Task 5 / A4): GroupViewContent prebinds the real
  //    self-leave handler — removeMember(currentGroup.id, effectiveUserId)
  //    then setCurrentGroup(null) — and passes it to MorePage. ──
  it('passes onLeaveStatic to MorePage and wires it to removeMember + setCurrentGroup(null)', async () => {
    mockPageMode = 'more';
    renderContent();
    screen.getByText('leave-static').click();
    await waitFor(() => expect(removeMemberSpy).toHaveBeenCalledTimes(1));
    expect(removeMemberSpy).toHaveBeenCalledWith('g1', 'u1');
    expect(setCurrentGroupSpy).toHaveBeenCalledWith(null);
  });
```

Second, in the legacy (slotless) describe — Current (GroupViewContent.slots.test.tsx:359-368, end of file):

```tsx
  it("wires onOpenLootHistory to the legacy gear History sub-tab (setGearSubTab('history') + setPageMode('gear')), not the v2 lview form", () => {
    renderSlotless();
    screen.getByText('open-loot-history').click();
    expect(setGearSubTab).toHaveBeenCalledTimes(1);
    expect(setGearSubTab).toHaveBeenCalledWith('history');
    expect(setPageMode).toHaveBeenCalledTimes(1);
    // Exactly one argument — the lview extra-params form belongs to v2 only.
    expect(setPageMode).toHaveBeenCalledWith('gear');
  });
});
```

Replace with:

```tsx
  it("wires onOpenLootHistory to the legacy gear History sub-tab (setGearSubTab('history') + setPageMode('gear')), not the v2 lview form", () => {
    renderSlotless();
    screen.getByText('open-loot-history').click();
    expect(setGearSubTab).toHaveBeenCalledTimes(1);
    expect(setGearSubTab).toHaveBeenCalledWith('history');
    expect(setPageMode).toHaveBeenCalledTimes(1);
    // Exactly one argument — the lview extra-params form belongs to v2 only.
    expect(setPageMode).toHaveBeenCalledWith('gear');
  });

  it('passes onLeaveStatic in the legacy (slotless) shell too — the Danger Zone bugfix reaches both shells', () => {
    renderSlotless();
    expect(screen.getByText('leave-static')).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run, verify both new tests fail** — from `frontend/`:

```bash
pnpm test src/pages/GroupViewContent.slots.test.tsx
```

Expected: both new tests fail with `TestingLibraryElementError: Unable to find an element with the text: leave-static` (GroupViewContent doesn't pass the prop yet, so the capture mock never renders the button). All pre-existing tests in the suite stay green.

- [ ] **Step 11: Implement** — two edits to `frontend/src/pages/GroupViewContent.tsx`.

Edit 11a — Current (GroupViewContent.tsx:98):

```tsx
  const { currentGroup, groups, error: groupError } = useStaticGroupStore();
```

Replace with:

```tsx
  const { currentGroup, groups, error: groupError, removeMember, setCurrentGroup } = useStaticGroupStore();
```

Edit 11b — Current (GroupViewContent.tsx:1169-1175, tail of the MorePage call site in the `pageMode === 'more'` branch):

```tsx
                onOpenIntegrations={() => {
                  useSettingsPanelStore.getState().open({ tab: 'integrations' });
                }}
                onOpenPlugin={() => setPageMode('plugin')}
                canManage={canManageRoster(userRole).allowed}
                userRole={userRole ?? null}
              />
```

Replace with (insertion sits after `onOpenPlugin`; Task 6 anchors on a different, untouched region of this call site — the `onOpenSplitPlanner` conditional-spread block above — so keep everything outside this insertion byte-identical):

```tsx
                onOpenIntegrations={() => {
                  useSettingsPanelStore.getState().open({ tab: 'integrations' });
                }}
                onOpenPlugin={() => setPageMode('plugin')}
                onLeaveStatic={async () => {
                  // Self-service leave (A4 / Plan M §1). Backend self-leave
                  // defaults unlink_players=true; owner never sees the button
                  // (MorePage gates it) and the backend owner-guard backstops.
                  if (!effectiveUserId) return;
                  try {
                    await removeMember(currentGroup.id, effectiveUserId);
                    // Minimal mirror of deleteGroup's local cleanup: drop the
                    // loaded static. The groups list self-heals — Profile
                    // calls fetchGroups() on mount at the redirect target.
                    setCurrentGroup(null);
                    toast.success(`You left ${currentGroup.name}`);
                    navigate('/profile?tab=statics');
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to leave static');
                  }
                }}
                canManage={canManageRoster(userRole).allowed}
                userRole={userRole ?? null}
              />
```

(`currentGroup` is narrowed non-null here — the call site sits inside the existing `{currentGroup && (` guard at :1146, and TypeScript propagates the narrowing of a destructured `const` into the closure. `toast` (:32), `navigate` (:97), and `effectiveUserId` (:358) are all already in scope — no new imports.)

- [ ] **Step 12: Run, verify pass** — from `frontend/`:

```bash
pnpm test src/pages/GroupViewContent.slots.test.tsx
```

Expected: full suite green, including the two new tests.

#### Wrap-up

- [ ] **Step 13: Full suites of every touched file + repo gates** — from `frontend/`:

```bash
pnpm test src/components/group/MorePage.test.tsx src/pages/GroupViewContent.test.tsx src/pages/GroupViewContent.slots.test.tsx src/pages/GroupViewContent.rosterSlot.test.tsx src/pages/GroupViewContent.gearSlot.test.tsx src/pages/GroupViewContent.canManageRoster.test.tsx
pnpm build
pnpm lint
pnpm check:design-system
```

Expected: all suites green (the four sibling GroupViewContent characterization suites never render `pageMode 'more'` and mock the store, so the destructure change is inert there); `pnpm build` (tsc -b — the CI-strict check) clean now that `onLeaveStatic` exists on `MorePageProps`; lint and design-system clean (no new raw elements — net one raw button removed; new UI is the design-system `ConfirmModal`).

- [ ] **Step 14: Commit** — from the repo root:

```bash
git add frontend/src/components/group/MorePage.tsx frontend/src/components/group/MorePage.test.tsx frontend/src/pages/GroupViewContent.tsx frontend/src/pages/GroupViewContent.slots.test.tsx
git commit -m "fix(redesign): phase-a — danger zone: delete retargets to Static tab, self-service Leave Static, Archive removed (A4)"
```

---

### Task 6: Shell/nav trio — rail stubs · rail-less UserMenu predicate · mobile shell toggle (A5)

Three related shell/nav gaps in one slice. **(a)** The v2 AppRail's Player Hub / Static Finder entries are comment-only no-ops whose comments name routes that don't exist (`/player-hub`, `/find-static`) — the real routes are `/profile` and `/discover`. **(b)** `Header.tsx:66`'s `railPresent = !!user || isGroupRoute` is only ever consumed inside the `user ?` render branch, where `!!user` makes it ALWAYS true — so the header UserMenu is `sm:hidden` on every route for every signed-in user, leaving `/discover`, `/docs*`, `/dashboard`, `/admin*`, `/profile/:shareCode`, and `/` (none of which render a rail) with no desktop sign-out; `Header.avatar.test.tsx` currently asserts this bug as correct and must flip. **(c)** On mobile NEITHER shell-toggle direction is reachable: the legacy banner wrapper is `hidden sm:block` and v2's only toggle lives in the AppRail UserMenu (`AppRail.tsx:141` is `hidden sm:flex`) — a desktop v2 opt-in mirrored to `User.ui_shell` traps a phone in v2. Fix = two one-way affordances: a below-`sm` `TryNewUiBanner` instance in the legacy Header, and a "Switch to classic UI" section on the v2 More page (new optional `onSwitchToClassicUi` prop threaded NewShell → GroupViewContent → MorePage, telemetry surface `'v2-more-page'`), rendered **at all viewports** per the approved skim default §6.5. `Header.tsx` is a sanctioned Phase-R shared edit (NOT byte-frozen), enumerated for exactly fixes (b) and (c1) — keep the diffs additive/minimal so the legacy smoke suite stays green.

> **EXECUTION-ORDER NOTE (binding):** Task 5 (A4) ran before this task and already edited `MorePage.tsx` (Delete-Static retarget, new optional `onLeaveStatic?: () => void | Promise<void>` prop + local ConfirmModal, Archive button removed), `GroupViewContent.tsx` (leave handler threaded into the MorePage call site around lines 1143–1178), `MorePage.test.tsx`, and `GroupViewContent.slots.test.tsx`. Every "Current code" anchor below in those four files was deliberately chosen from regions Task 5 does not touch, but surrounding text may differ slightly from the line hints — edit by string-anchor, and if a nearby Task-5 addition sits where you'd insert (e.g. an `onLeaveStatic` line right after an anchor), insert alongside it without disturbing it. If an anchor genuinely no longer exists verbatim, STOP and re-read the file before improvising.

> **Screenshots note:** this task changes visible UI (mobile banner row, More-page section). Per the project's PR-screenshots rule, the phase's PR must embed mobile-viewport screenshots of the legacy Header banner row and the v2 More page — flag this to whoever assembles the PR; no browser step is required inside this task.

**Files:**
- Modify: `frontend/src/pages/NewShell.tsx` (rail entry `onSelect` stubs at ~:309/:317; `useShellToggle` import; `ShellContent` handler + `GroupViewContent` call)
- Modify: `frontend/src/components/layout/Header.tsx` (SHARED — sanctioned edit, fixes b + c1 only: predicate at ~:66, consumer at ~:404-407, mobile banner row after ~:428)
- Modify (rewrite): `frontend/src/components/layout/Header.avatar.test.tsx` (currently asserts the (b) bug as correct)
- Modify: `frontend/src/components/layout/TryNewUiBanner.tsx` (optional `className` prop + right-aligned dismiss on full-width rows)
- Modify: `frontend/src/components/layout/TryNewUiBanner.test.tsx` (className merge test)
- Modify: `frontend/src/components/group/MorePage.tsx` (SHARED, contains Task 5's edits — optional `onSwitchToClassicUi` prop + "Interface" section)
- Modify: `frontend/src/components/group/MorePage.test.tsx` (contains Task 5's edits — new prop tests)
- Modify: `frontend/src/pages/GroupViewContent.tsx` (SHARED, contains Task 5's edits — thread the new optional prop)
- Modify: `frontend/src/pages/GroupViewContent.slots.test.tsx` (contains Task 5's edits — capture-mock + wiring tests)
- Modify: `frontend/src/hooks/useShellToggle.ts` (widen the `surface` union with `'v2-more-page'`)
- Modify: `frontend/src/pages/NewShell.rail.test.tsx` (rail-entry navigation tests)
- Modify: `frontend/src/pages/NewShell.slot.test.tsx` (v2 onSwitchToClassicUi threading test)
- Reference only (do NOT edit): `frontend/src/components/auth/UserMenu.tsx` (:307-316 — the `switchShell('legacy')` pattern being mirrored), `frontend/src/components/layout/AppRail.tsx` (:141 `hidden sm:flex` — why v2 mobile has no toggle), `frontend/src/pages/DesignSystem.tsx` (confirm-only, Step 5), `frontend/src/lib/shellPreference.ts` (`useShellPreferenceStore`, `Shell`)

**Interfaces:**
- Consumes: `useShellToggle(surface): (target: Shell) => void` (`hooks/useShellToggle.ts:13`); `analytics.track('navigation', 'ui_shell_toggle', { direction, surface })` event shape (Phase R Task 7); `navigate` already bound at `NewShell.tsx:177`; `TryNewUiBanner` (self-gates on `resolvedShell === 'legacy' && !dismissed`); `MorePageProps.onOpenSplitPlanner?: () => void` optional-prop precedent; `GroupViewContentProps` (`GroupViewContent.tsx:88-94`); `useShellPreferenceStore` / `Shell` from `lib/shellPreference`.
- Produces: `onSwitchToClassicUi?: () => void` on **both** `MorePageProps` and `GroupViewContentProps` (v2-only pass-through — legacy never passes it); `useShellToggle(surface: 'legacy-banner' | 'v2-user-menu' | 'v2-more-page')` (widened union); `TryNewUiBanner({ className }: { className?: string })`; `Header.tsx` `data-rail-present` attribute now reflects `hasOwnRailUserMenu = isGroupRoute || location.pathname === '/profile'` (was: always `'true'` for signed-in users).

---

#### (a) Rail stubs → real routes

- [ ] **Step 1: Write the failing rail-navigation tests** — append a new describe to `frontend/src/pages/NewShell.rail.test.tsx`, reusing its existing `mockNavigate` + `renderShell` scaffolding (the icon entries render as buttons whose accessible name is the `sr-only` label span, same as the avatar entries the suite already clicks).

Current (NewShell.rail.test.tsx:145-150 — end of file):
```tsx
  it('falls back to a bare href when there is no saved tab for the target static', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Beta Static' }));
    expect(mockNavigate).toHaveBeenCalledWith('/group/XYZ');
  });
});
```

Replace with:
```tsx
  it('falls back to a bare href when there is no saved tab for the target static', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Beta Static' }));
    expect(mockNavigate).toHaveBeenCalledWith('/group/XYZ');
  });
});

describe('NewShell rail Person-layer entries — navigate to real routes (Phase A, A5a)', () => {
  it('Player Hub navigates to /profile', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Player Hub' }));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('Static Finder navigates to /discover', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Static Finder' }));
    expect(mockNavigate).toHaveBeenCalledWith('/discover');
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — from `frontend/`:
```bash
pnpm test src/pages/NewShell.rail.test.tsx
```
Expected: the 2 new tests fail with `AssertionError: expected "spy" to be called with arguments: [ '/profile' ] … Number of calls: 0` (and the `/discover` twin); the 2 existing tests still pass.

- [ ] **Step 3: Implement — replace the two stub `onSelect` bodies** in `frontend/src/pages/NewShell.tsx`. `navigate` is already bound at :177 and already in the memo's dep array, so no other change is needed.

Current (NewShell.tsx:300-318):
```tsx
  const personLayerEntries = useMemo<RailEntry[]>(() => [
    {
      kind: 'icon',
      id: 'player-hub',
      label: 'Player Hub',
      icon: Home,
      // Player Hub is active when we're not in any static context (future F6b);
      // in F6a (always inside a static route) it is never active.
      isActive: false,
      onSelect: () => { /* F6b: navigate to /player-hub */ },
    },
    {
      kind: 'icon',
      id: 'static-finder',
      label: 'Static Finder',
      icon: Globe,
      isActive: false,
      onSelect: () => { /* F6b: navigate to /find-static */ },
    },
```

Replace with:
```tsx
  const personLayerEntries = useMemo<RailEntry[]>(() => [
    {
      kind: 'icon',
      id: 'player-hub',
      label: 'Player Hub',
      icon: Home,
      // NewShell only renders on /group/:shareCode routes, so the Person-layer
      // targets (/profile, /discover) can never be the active route here —
      // isActive stays hardcoded false (wiring it would be dead code).
      isActive: false,
      onSelect: () => navigate('/profile'),
    },
    {
      kind: 'icon',
      id: 'static-finder',
      label: 'Static Finder',
      icon: Globe,
      isActive: false,
      onSelect: () => navigate('/discover'),
    },
```

- [ ] **Step 4: Run tests, verify pass** — from `frontend/`:
```bash
pnpm test src/pages/NewShell.rail.test.tsx
```
All 4 tests pass.

---

#### (b) Rail-less UserMenu predicate

- [ ] **Step 5: Confirm DesignSystem.tsx mounts no real rail UserMenu** (the one page the audit left un-inspected). From `frontend/`:
```bash
rg -n "UserMenu" src/pages/DesignSystem.tsx
rg -n "UserMenu" src/pages/DesignSystem.tsx -B 5 | rg "import" || echo "no UserMenu import — expected, proceed"
```
Expected: exactly one match (~line 3381) — `<UserMenu />` inside a `CodeBlock` `code={` … `}` template-literal (a documentation string, not a mount), and NO `import` of UserMenu anywhere in the file. This confirms `/docs*` routes have no rail of their own, so the predicate below is complete. If you instead find a real `<UserMenu variant="rail" …/>` mount, STOP and flag it in your summary — the predicate would need that route added.

- [ ] **Step 6: Rewrite the avatar-gating test** — `frontend/src/components/layout/Header.avatar.test.tsx` currently encodes the bug (asserts `data-rail-present="true"` on `/dashboard`, a rail-less page). Overwrite the whole file with the version below. It keeps the suite's existing conventions (jsdoc env pragma, `vi.mock` store shapes, `matchMedia` stub, ThemeProvider wrapper) and adds: a hoisted switchable `currentGroup` (needed for the group-route cases and reused by (c1) later), structural stubs for the group-route-only leaves (`TryNewUiBanner`, `StaticSwitcher`/`TierSelector`, the `../ui` barrel pieces Header imports), and both directions of the predicate.

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../hooks/useTheme';

vi.mock('../auth', () => ({ UserMenu: () => <div data-testid="header-usermenu">U</div>, LoginButton: () => <div>login</div> }));
// minimal store mocks: signed-in user; currentGroup is switchable (hoisted) so
// the group-route cases can simulate a loaded static.
const mocks = vi.hoisted(() => ({
  currentGroup: null as Record<string, unknown> | null,
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', isAdmin: false }, isLoading: false }),
  useAuthHydrated: () => true,
}));
vi.mock('../../stores/staticGroupStore', () => ({ useStaticGroupStore: () => ({ currentGroup: mocks.currentGroup, groups: [], fetchGroups: vi.fn() }) }));
vi.mock('../../stores/tierStore', () => ({ useTierStore: () => ({ tiers: [], currentTier: null }) }));
vi.mock('../../stores/viewAsStore', () => ({ useViewAsStore: () => ({ viewAsUser: null }) }));
vi.mock('../../stores/invitationStore', () => ({ useInvitationStore: () => ({ invitations: [], fetchInvitations: vi.fn() }) }));
vi.mock('../../stores/joinRequestStore', () => ({ useJoinRequestStore: Object.assign(() => 0, { getState: () => ({ fetchGroupRequests: vi.fn() }) }) }));
// Structural stubs for the group-route renders: this suite asserts Header's own
// responsive wrappers, not these leaves. The banner stub surfaces the className
// Header passes it (the mobile instance carries the below-sm classes; the
// banner's own self-gating is covered by TryNewUiBanner.test.tsx).
vi.mock('./TryNewUiBanner', () => ({
  TryNewUiBanner: ({ className }: { className?: string }) => (
    <div data-testid="try-banner-stub" className={className} />
  ),
}));
vi.mock('../static-group', () => ({
  StaticSwitcher: () => <div data-testid="static-switcher-stub" />,
  TierSelector: () => null,
}));
vi.mock('../ui', () => ({
  TierActionsMenu: () => null,
  TipsCarousel: () => null,
  DiscordIcon: () => null,
  GitHubIcon: () => null,
  ThemeToggle: () => null,
}));

import { Header } from './Header';

beforeEach(() => {
  mocks.currentGroup = null;
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
});

function renderHeaderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}><Header /></MemoryRouter>
    </ThemeProvider>
  );
}

function userMenuWrapper(): HTMLElement {
  return screen.getByTestId('header-usermenu').closest('[data-rail-present]') as HTMLElement;
}

describe('Header avatar gating — routes WITHOUT their own rail keep the header UserMenu', () => {
  // /profile/SOMECODE is PublicProfile (someone else's shared profile, no rail)
  // — it must NOT be swallowed by a startsWith('/profile') match.
  it.each(['/dashboard', '/discover', '/docs', '/profile/SOMECODE'])(
    'shows the header UserMenu at all widths on %s (no rail there)',
    (path) => {
      renderHeaderAt(path);
      const wrapper = userMenuWrapper();
      expect(wrapper.getAttribute('data-rail-present')).toBe('false');
      expect(wrapper.className).not.toContain('sm:hidden');
    },
  );
});

describe('Header avatar gating — routes WITH their own rail hide the desktop avatar', () => {
  // Group routes (both shells render a rail/sidebar UserMenu) and the own
  // Player Hub at exactly /profile (ProfileSidebarNav → SidebarRail footer).
  it.each(['/group/ABC', '/profile'])(
    'hides the header UserMenu on desktop on %s (route renders its own rail UserMenu)',
    (path) => {
      renderHeaderAt(path);
      const wrapper = userMenuWrapper();
      expect(wrapper.getAttribute('data-rail-present')).toBe('true');
      expect(wrapper.className).toContain('sm:hidden');
    },
  );
});
```

- [ ] **Step 7: Run it, verify it fails** — from `frontend/`:
```bash
pnpm test src/components/layout/Header.avatar.test.tsx
```
Expected: all 4 cases in the "routes WITHOUT their own rail" describe fail with `expected 'true' to be 'false'` (the `!!user` term forces the old predicate true everywhere); both "routes WITH their own rail" cases already pass (they are the regression lock).

- [ ] **Step 8: Implement the predicate** in `frontend/src/components/layout/Header.tsx` — two anchored edits.

Current (Header.tsx:63-66):
```tsx
  // The AppRail (with its user-menu footer) is present whenever the user is
  // signed in or on a group route. When it is, the header avatar is redundant
  // on desktop — keep it only for mobile (< sm), where there is no rail.
  const railPresent = !!user || isGroupRoute;
```

Replace with:
```tsx
  // Routes that render their OWN rail + UserMenu (group routes in both shells,
  // and the Player Hub at exactly /profile) make the header avatar redundant on
  // desktop — keep it only for mobile (< sm), where the rail is hidden. On
  // every other route (/discover, /docs*, /dashboard, /admin*, /profile/:code,
  // /) the header avatar is the ONLY sign-out affordance, so it must show.
  // Exact match for /profile on purpose: /profile/:shareCode is PublicProfile,
  // which has no rail.
  const hasOwnRailUserMenu = isGroupRoute || location.pathname === '/profile';
```

Current (Header.tsx:404-407):
```tsx
              <span
                data-rail-present={railPresent ? 'true' : 'false'}
                className={railPresent ? 'sm:hidden' : ''}
              >
```

Replace with:
```tsx
              <span
                data-rail-present={hasOwnRailUserMenu ? 'true' : 'false'}
                className={hasOwnRailUserMenu ? 'sm:hidden' : ''}
              >
```

- [ ] **Step 9: Run tests, verify pass** (the settings suite also renders Header — check it wasn't disturbed) — from `frontend/`:
```bash
pnpm test src/components/layout/Header.avatar.test.tsx src/components/layout/Header.settings.test.tsx
```
All tests pass.

---

#### (c2) v2 More-page "Switch to classic UI" — MorePage prop + section

- [ ] **Step 10: Write the failing MorePage tests** — append to `frontend/src/components/group/MorePage.test.tsx`, reusing its `renderMorePage(overrides)` helper. (The overrides object won't typecheck until the prop exists — vitest doesn't typecheck, so the tests fail at runtime as intended; `tsc` becomes clean after Step 12.)

Current (MorePage.test.tsx:66-69 — inside the split-planner wired test; Task 5 does not touch this block):
```tsx
    fireEvent.click(screen.getByText('Split Planner'));

    expect(onOpenSplitPlanner).toHaveBeenCalledTimes(1);
  });
```

Replace with:
```tsx
    fireEvent.click(screen.getByText('Split Planner'));

    expect(onOpenSplitPlanner).toHaveBeenCalledTimes(1);
  });

  it('does not render the Switch to classic UI section when onSwitchToClassicUi is not wired (legacy shell)', () => {
    renderMorePage();
    expect(screen.queryByRole('button', { name: /switch to classic ui/i })).toBeNull();
    expect(screen.queryByText('Interface')).toBeNull();
  });

  it('renders the Switch to classic UI button at all viewports when onSwitchToClassicUi is wired (v2) and clicking fires it', () => {
    const onSwitchToClassicUi = vi.fn();
    renderMorePage({ onSwitchToClassicUi });

    const button = screen.getByRole('button', { name: /switch to classic ui/i });
    // All-viewports contract (approved skim §6.5): no responsive hiding on the
    // button or its section — on mobile this is the ONLY v2→legacy path.
    expect(button.className).not.toMatch(/(^|\s)(hidden|sm:hidden|max-sm:hidden)(\s|$)/);
    expect(button.closest('section')?.className ?? '').not.toMatch(/(^|\s)(hidden|sm:hidden|max-sm:hidden)(\s|$)/);
    fireEvent.click(button);
    expect(onSwitchToClassicUi).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 11: Run it, verify it fails** — from `frontend/`:
```bash
pnpm test src/components/group/MorePage.test.tsx
```
Expected: the no-prop test passes (nothing renders yet — that's fine), the wired test fails with `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name /switch to classic ui/i`.

- [ ] **Step 12: Implement the MorePage prop + section** — four anchored edits to `frontend/src/components/group/MorePage.tsx` (Task 5 has already edited this file — anchors below avoid its regions).

Edit 1 — lucide import. Current (unique — the file has one lucide-react import; if Task 5 added icon names to it, the closing line is unchanged):
```tsx
} from 'lucide-react';
```
Replace with:
```tsx
  ArrowLeftRight,
} from 'lucide-react';
```

Edit 2 — Button primitive import. Current (MorePage.tsx:10):
```tsx
import { DashboardCard, IconMedallion, SectionLabel } from '../ui/DashboardCard';
```
Replace with:
```tsx
import { DashboardCard, IconMedallion, SectionLabel } from '../ui/DashboardCard';
import { Button } from '../primitives';
```
(If Task 5's edits already import `Button` from `'../primitives'`, skip adding the duplicate line.)

Edit 3 — props interface. Current (MorePage.tsx:19-21):
```tsx
  /** Legacy shell only — v2 dropped the card (D-P3-2); rendered only when the
   *  caller wires it. */
  onOpenSplitPlanner?: () => void;
```
Replace with:
```tsx
  /** Legacy shell only — v2 dropped the card (D-P3-2); rendered only when the
   *  caller wires it. */
  onOpenSplitPlanner?: () => void;
  /** v2 shell only (Phase A, A5c) — the classic-UI escape hatch. Legacy never
   *  passes it, so the Interface section renders exclusively in v2 — at ALL
   *  viewports (approved skim §6.5): on mobile it is the only reachable
   *  v2→legacy affordance (the rail UserMenu is hidden below sm); on desktop
   *  it is harmless redundancy with the rail entry. */
  onSwitchToClassicUi?: () => void;
```

Edit 4 — destructuring. Current (MorePage.tsx:36 — two-space indent, trailing comma; unique):
```tsx
  onOpenSplitPlanner,
```
Replace with:
```tsx
  onOpenSplitPlanner,
  onSwitchToClassicUi,
```

Edit 5 — the section itself, between "Data & History" and the Danger Zone (Task 5 edits the Danger Zone's interior, not these closing lines). Current (MorePage.tsx:300-306 — end of the Session History card and the Data & History section; `View schedule` appears exactly once in the file):
```tsx
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              View schedule <ChevronRight size={12} />
            </div>
          </DashboardCard>

        </div>
      </section>
```
Replace with:
```tsx
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              View schedule <ChevronRight size={12} />
            </div>
          </DashboardCard>

        </div>
      </section>

      {/* Interface — v2-only classic-UI escape hatch (Phase A, A5c). Rendered
          only when the caller wires onSwitchToClassicUi (NewShell does; the
          legacy chrome never passes it). Deliberately NOT responsive-gated —
          renders at all viewports (approved skim §6.5). Kept visually separate
          from the Danger Zone below: switching UIs is safe and reversible. */}
      {onSwitchToClassicUi && (
        <section>
          <SectionLabel className="mb-3">Interface</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DashboardCard title="New UI" icon={<ArrowLeftRight size={13} />} accentColor="teal">
              <p className="text-xs text-text-secondary mb-4">
                You're viewing the redesigned interface. Switch back to the
                classic UI at any time — nothing about your static's data or
                settings changes.
              </p>
              <Button variant="secondary" size="sm" onClick={onSwitchToClassicUi}>
                Switch to classic UI
              </Button>
            </DashboardCard>
          </div>
        </section>
      )}
```

- [ ] **Step 13: Run tests, verify pass** — from `frontend/`:
```bash
pnpm test src/components/group/MorePage.test.tsx
```
All tests pass (including Task 5's).

#### (c2) — GroupViewContent threading

- [ ] **Step 14: Write the failing wiring tests** — three anchored edits to `frontend/src/pages/GroupViewContent.slots.test.tsx` (Task 5 has already edited this file — anchors avoid its regions; if a Task-5 `onLeaveStatic` line sits immediately after an anchor, leave it in place).

Edit 1 — capture-mock props type. Current (unique within this file):
```tsx
    onOpenSplitPlanner?: () => void;
```
Replace with:
```tsx
    onOpenSplitPlanner?: () => void;
    onSwitchToClassicUi?: () => void;
```

Edit 2 — capture-mock render body. Current:
```tsx
      {props.onOpenSplitPlanner && (
        <button onClick={props.onOpenSplitPlanner}>open-split-planner</button>
      )}
```
Replace with:
```tsx
      {props.onOpenSplitPlanner && (
        <button onClick={props.onOpenSplitPlanner}>open-split-planner</button>
      )}
      {props.onSwitchToClassicUi && (
        <button onClick={props.onSwitchToClassicUi}>switch-to-classic-ui</button>
      )}
```

Edit 3 — v2-half test. Current (the existing split-planner v2-gate test — Task 5 does not touch it):
```tsx
  it('does NOT pass onOpenSplitPlanner to MorePage when slots are present', () => {
    mockPageMode = 'more';
    renderContent();
    expect(screen.queryByText('open-split-planner')).toBeNull();
  });
```
Replace with:
```tsx
  it('does NOT pass onOpenSplitPlanner to MorePage when slots are present', () => {
    mockPageMode = 'more';
    renderContent();
    expect(screen.queryByText('open-split-planner')).toBeNull();
  });

  // ── onSwitchToClassicUi pass-through (Phase A, A5c): GroupViewContent is a
  //    pure conduit — MorePage receives the handler exactly when the chrome
  //    provides it (NewShell does; legacy never does — pinned below). ──
  it('forwards onSwitchToClassicUi to MorePage when the chrome provides it', () => {
    mockPageMode = 'more';
    const onSwitchToClassicUi = vi.fn();
    render(
      <MemoryRouter>
        <GroupViewContent actions={actions} slots={slots} onSwitchToClassicUi={onSwitchToClassicUi} />
      </MemoryRouter>,
    );
    screen.getByText('switch-to-classic-ui').click();
    expect(onSwitchToClassicUi).toHaveBeenCalledTimes(1);
  });
```

Edit 4 — legacy-half test. Current (end of the legacy loot-history wiring test; the 4-line block incl. the comment is unique — Task 5 may have appended tests after it, which is fine):
```tsx
    expect(setPageMode).toHaveBeenCalledTimes(1);
    // Exactly one argument — the lview extra-params form belongs to v2 only.
    expect(setPageMode).toHaveBeenCalledWith('gear');
  });
```
Replace with:
```tsx
    expect(setPageMode).toHaveBeenCalledTimes(1);
    // Exactly one argument — the lview extra-params form belongs to v2 only.
    expect(setPageMode).toHaveBeenCalledWith('gear');
  });

  it('passes NO switch-to-classic affordance when the chrome provides none (legacy)', () => {
    renderSlotless();
    expect(screen.queryByText('switch-to-classic-ui')).toBeNull();
  });
```

- [ ] **Step 15: Run it, verify it fails** — from `frontend/`:
```bash
pnpm test src/pages/GroupViewContent.slots.test.tsx
```
Expected: `forwards onSwitchToClassicUi…` fails with `Unable to find an element with the text: switch-to-classic-ui` (GVC drops the unknown prop); the legacy-half test passes already (nothing is forwarded yet); all pre-existing tests still pass. (The new prop in the render call is a TS error until Step 16 — vitest doesn't typecheck, so only the runtime failure shows.)

- [ ] **Step 16: Implement the GVC pass-through** — three anchored edits to `frontend/src/pages/GroupViewContent.tsx` (Task 5 edited the MorePage call site region — the spread block below is untouched by it).

Edit 1 — props interface. Current (GroupViewContent.tsx:91-93):
```tsx
  /** Chrome-triggered actions the content's toolbar/bodies invoke (add-player, tier ops).
   *  Fed from the shared GroupActions context (`useGroupActions()`) by each chrome. */
  actions: GroupActions;
```
Replace with:
```tsx
  /** Chrome-triggered actions the content's toolbar/bodies invoke (add-player, tier ops).
   *  Fed from the shared GroupActions context (`useGroupActions()`) by each chrome. */
  actions: GroupActions;
  /** v2 only (Phase A, A5c): NewShell threads the classic-UI escape hatch down
   *  to the More page. The legacy chrome never passes it, so the More page's
   *  "Switch to classic UI" section renders exclusively in v2. */
  onSwitchToClassicUi?: () => void;
```

Edit 2 — signature. Current (GroupViewContent.tsx:96):
```tsx
export function GroupViewContent({ slots, actions }: GroupViewContentProps) {
```
Replace with:
```tsx
export function GroupViewContent({ slots, actions, onSwitchToClassicUi }: GroupViewContentProps) {
```
(If Task 5 added props to this destructure, keep them and add `onSwitchToClassicUi` alongside.)

Edit 3 — MorePage call site. Current (GroupViewContent.tsx:1162-1168 — the onOpenSplitPlanner conditional-spread, explicitly untouched by Task 5):
```tsx
                {...(!slots?.roster ? {
                  // Legacy shell only — v2 dropped the Split Planner card (D-P3-2).
                  onOpenSplitPlanner: () => {
                    // One history entry: switch to Roster and the Split Planner sub-tab together.
                    setPageMode('roster', { rsub: 'split-planner' });
                  },
                } : {})}
```
Replace with:
```tsx
                {...(!slots?.roster ? {
                  // Legacy shell only — v2 dropped the Split Planner card (D-P3-2).
                  onOpenSplitPlanner: () => {
                    // One history entry: switch to Roster and the Split Planner sub-tab together.
                    setPageMode('roster', { rsub: 'split-planner' });
                  },
                } : {})}
                onSwitchToClassicUi={onSwitchToClassicUi}
```

- [ ] **Step 17: Run tests, verify pass** — from `frontend/`:
```bash
pnpm test src/pages/GroupViewContent.slots.test.tsx
```
All tests pass.

#### (c2) — NewShell handler + telemetry surface

- [ ] **Step 18: Write the failing v2-threading test** — three anchored edits to `frontend/src/pages/NewShell.slot.test.tsx` (this suite renders `ShellContent` with a loaded group + non-empty tiers, so the mocked GroupViewContent actually mounts — the right home for this wiring lock).

Edit 1 — imports. Current (NewShell.slot.test.tsx:13-15):
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
```
Replace with:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useShellPreferenceStore } from '../lib/shellPreference';
```

Edit 2 — analytics mock + capture-mock upgrade. Current (NewShell.slot.test.tsx:23-27):
```tsx
vi.mock('./GroupViewContent', () => ({
  GroupViewContent: (p: { slots?: { overview?: unknown } }) => (
    <div data-testid="gvc" data-has-overview={String(!!p.slots?.overview)} />
  ),
}));
```
Replace with:
```tsx
// Real analytics buffers + fetches — spy instead (same shape as
// TryNewUiBanner.test.tsx). The toggle handler under test fires through it.
const track = vi.fn();
vi.mock('../services/analytics', () => ({ analytics: { track: (...a: unknown[]) => track(...a) } }));

vi.mock('./GroupViewContent', () => ({
  GroupViewContent: (p: { slots?: { overview?: unknown }; onSwitchToClassicUi?: () => void }) => (
    <div data-testid="gvc" data-has-overview={String(!!p.slots?.overview)}>
      {p.onSwitchToClassicUi && (
        <button onClick={p.onSwitchToClassicUi}>switch-to-classic</button>
      )}
    </div>
  ),
}));
```

Edit 3 — beforeEach reset + the new test. Current (NewShell.slot.test.tsx:62-74):
```tsx
beforeEach(() => {
  mocks.currentGroup = { id: 'g1', name: 'Crescent', userRole: 'owner' };
  mocks.tier = { tierId: 't1', players: [] };
  mocks.canEdit = true;
});

const renderShell = () => render(<MemoryRouter><ShellContent /></MemoryRouter>);

describe('NewShell ShellContent slot wiring', () => {
  it('passes an overview slot to GroupViewContent when a static is active', () => {
    renderShell();
    expect(screen.getByTestId('gvc')).toHaveAttribute('data-has-overview', 'true');
  });
```
Replace with:
```tsx
beforeEach(() => {
  mocks.currentGroup = { id: 'g1', name: 'Crescent', userRole: 'owner' };
  mocks.tier = { tierId: 't1', players: [] };
  mocks.canEdit = true;
  track.mockClear();
  localStorage.clear();
  useShellPreferenceStore.setState({ preference: null });
});

const renderShell = () => render(<MemoryRouter><ShellContent /></MemoryRouter>);

describe('NewShell ShellContent slot wiring', () => {
  it('passes an overview slot to GroupViewContent when a static is active', () => {
    renderShell();
    expect(screen.getByTestId('gvc')).toHaveAttribute('data-has-overview', 'true');
  });

  it('threads a v2-only onSwitchToClassicUi that flips the shell to legacy with v2-more-page telemetry', () => {
    renderShell();
    fireEvent.click(screen.getByText('switch-to-classic'));
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_toggle',
      { direction: 'to-legacy', surface: 'v2-more-page' });
    expect(useShellPreferenceStore.getState().preference).toBe('legacy');
  });
```

- [ ] **Step 19: Run it, verify it fails** — from `frontend/`:
```bash
pnpm test src/pages/NewShell.slot.test.tsx
```
Expected: the new test fails with `Unable to find an element with the text: switch-to-classic` (ShellContent doesn't pass the prop yet); the 2 existing tests still pass.

- [ ] **Step 20: Implement — NewShell handler + widen the `useShellToggle` union.** The union widening is a type-only change that the telemetry assertion above forces; it rides in this step (called out per the mechanical-piggyback exception).

Edit 1 — `frontend/src/hooks/useShellToggle.ts`. Current (line 2):
```ts
 * useShellToggle — the ONE path both toggle affordances use to switch shells.
```
Replace with:
```ts
 * useShellToggle — the ONE path every shell-toggle affordance uses to switch shells.
```
Current (line 13):
```ts
export function useShellToggle(surface: 'legacy-banner' | 'v2-user-menu') {
```
Replace with:
```ts
export function useShellToggle(surface: 'legacy-banner' | 'v2-user-menu' | 'v2-more-page') {
```

Edit 2 — `frontend/src/pages/NewShell.tsx` import. Current (line 19):
```tsx
import { useStaticNavMemory } from '../hooks/useStaticNavMemory';
```
Replace with:
```tsx
import { useStaticNavMemory } from '../hooks/useStaticNavMemory';
import { useShellToggle } from '../hooks/useShellToggle';
```

Edit 3 — the handler inside `ShellContent`. Current (NewShell.tsx:62):
```tsx
  const { canEdit: canManage, userRole, isAdminAccess } = useStaticPermissions();
```
Replace with:
```tsx
  const { canEdit: canManage, userRole, isAdminAccess } = useStaticPermissions();

  // Phase A (A5c): v2→legacy escape hatch handed to the More page. Constructed
  // ONLY here (the v2 chrome) — the legacy route renders GroupViewContent
  // without it, so MorePage's "Switch to classic UI" section is v2-exclusive.
  // On mobile this is the only reachable v2→legacy affordance (AppRail and its
  // UserMenu toggle are hidden below sm). Mirrors UserMenu's switchShell call.
  const switchShell = useShellToggle('v2-more-page');
```

Edit 4 — the GroupViewContent call. Current (NewShell.tsx:165-168):
```tsx
      <GroupViewContent
        actions={useGroupActions()}
        slots={{ overview, roster, gear: loot, schedule }}
      />
```
Replace with:
```tsx
      <GroupViewContent
        actions={useGroupActions()}
        slots={{ overview, roster, gear: loot, schedule }}
        onSwitchToClassicUi={() => switchShell('legacy')}
      />
```

- [ ] **Step 21: Run tests, verify pass** — from `frontend/`:
```bash
pnpm test src/pages/NewShell.slot.test.tsx src/pages/GroupViewContent.slots.test.tsx src/components/group/MorePage.test.tsx
```
All tests pass.

---

#### (c1) Legacy→v2 opt-in reachable on mobile

- [ ] **Step 22: Write the failing mobile-banner tests** — two files.

Edit 1 — `frontend/src/components/layout/TryNewUiBanner.test.tsx`: append a className-merge test. Current (TryNewUiBanner.test.tsx:52-59 — end of file):
```tsx
  it('dismiss hides it, persists, and fires ui_shell_banner_dismiss', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
    expect(localStorage.getItem('ui-shell-banner-dismissed')).toBe('true');
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_banner_dismiss', {});
  });
});
```
Replace with:
```tsx
  it('dismiss hides it, persists, and fires ui_shell_banner_dismiss', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
    expect(localStorage.getItem('ui-shell-banner-dismissed')).toBe('true');
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_banner_dismiss', {});
  });

  it('merges a caller className onto the root (the Header mobile row passes sm:hidden w-full)', () => {
    render(
      <MemoryRouter initialEntries={['/group/ABC']}>
        <TryNewUiBanner className="sm:hidden w-full" />
      </MemoryRouter>
    );
    const root = screen.getByRole('button', { name: /try the new ui/i }).closest('div');
    expect(root?.className).toContain('sm:hidden');
    expect(root?.className).toContain('w-full');
  });
});
```

Edit 2 — `frontend/src/components/layout/Header.avatar.test.tsx`: append the mobile-row describe (the banner stub from Step 6 already surfaces the className). Current (end of the file written in Step 6):
```tsx
describe('Header avatar gating — routes WITH their own rail hide the desktop avatar', () => {
  // Group routes (both shells render a rail/sidebar UserMenu) and the own
  // Player Hub at exactly /profile (ProfileSidebarNav → SidebarRail footer).
  it.each(['/group/ABC', '/profile'])(
    'hides the header UserMenu on desktop on %s (route renders its own rail UserMenu)',
    (path) => {
      renderHeaderAt(path);
      const wrapper = userMenuWrapper();
      expect(wrapper.getAttribute('data-rail-present')).toBe('true');
      expect(wrapper.className).toContain('sm:hidden');
    },
  );
});
```
Replace with:
```tsx
describe('Header avatar gating — routes WITH their own rail hide the desktop avatar', () => {
  // Group routes (both shells render a rail/sidebar UserMenu) and the own
  // Player Hub at exactly /profile (ProfileSidebarNav → SidebarRail footer).
  it.each(['/group/ABC', '/profile'])(
    'hides the header UserMenu on desktop on %s (route renders its own rail UserMenu)',
    (path) => {
      renderHeaderAt(path);
      const wrapper = userMenuWrapper();
      expect(wrapper.getAttribute('data-rail-present')).toBe('true');
      expect(wrapper.className).toContain('sm:hidden');
    },
  );
});

describe('Header mobile shell opt-in row (Phase A, A5c)', () => {
  // jsdom can't evaluate media queries — assert the responsive classNames and
  // structure, per this suite's conventions. The stub bypasses the banner's
  // self-gating, so BOTH instances render whenever Header mounts them.
  it('mounts a second, below-sm TryNewUiBanner instance on a loaded group route', () => {
    mocks.currentGroup = { id: 'g1', name: 'S', userRole: 'owner' };
    renderHeaderAt('/group/ABC');
    const banners = screen.getAllByTestId('try-banner-stub');
    expect(banners).toHaveLength(2);
    // Desktop instance: unchanged, inside the `hidden sm:block` wrapper.
    expect(banners.some((b) => b.parentElement?.className === 'hidden sm:block')).toBe(true);
    // Mobile instance: the banner itself carries the below-sm classes (no
    // wrapper div, so a dismissed banner leaves no phantom flex-wrap row).
    expect(banners.map((b) => b.className)).toContain('sm:hidden w-full');
  });

  it('renders no banner instances off group routes', () => {
    renderHeaderAt('/dashboard');
    expect(screen.queryAllByTestId('try-banner-stub')).toHaveLength(0);
  });
});
```

- [ ] **Step 23: Run it, verify it fails** — from `frontend/`:
```bash
pnpm test src/components/layout/TryNewUiBanner.test.tsx src/components/layout/Header.avatar.test.tsx
```
Expected failures: the className-merge test fails (`expected 'flex items-center gap-1.5 …' to contain 'sm:hidden'` — the prop doesn't exist yet), and the mobile-row test fails with `expected [ …(1) ] to have a length of 2` (only the desktop instance renders). The off-group-routes test passes already.

- [ ] **Step 24: Implement — TryNewUiBanner `className` prop + Header mobile row.**

Edit 1 — `frontend/src/components/layout/TryNewUiBanner.tsx`. Current (TryNewUiBanner.tsx:21-47 — the whole component):
```tsx
export function TryNewUiBanner() {
  const resolvedShell = useResolvedShell();
  const toggle = useShellToggle('legacy-banner');
  const [dismissed, setDismissed] = useState(readDismissed);

  if (resolvedShell !== 'legacy' || dismissed) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 pl-2.5 pr-1 py-1">
      <Sparkles size={14} className="text-accent flex-shrink-0" aria-hidden />
      <Button variant="ghost" size="sm" onClick={() => toggle('v2')}>
        Try the new UI
      </Button>
      <IconButton
        icon={<X size={13} />}
        aria-label="Dismiss new UI banner"
        size="sm"
        variant="ghost"
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* session-only */ }
          analytics.track('navigation', 'ui_shell_banner_dismiss', {});
          setDismissed(true);
        }}
      />
    </div>
  );
}
```
Replace with:
```tsx
export function TryNewUiBanner({ className = '' }: { className?: string }) {
  const resolvedShell = useResolvedShell();
  const toggle = useShellToggle('legacy-banner');
  const [dismissed, setDismissed] = useState(readDismissed);

  if (resolvedShell !== 'legacy' || dismissed) return null;

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 pl-2.5 pr-1 py-1 ${className}`.trim()}>
      <Sparkles size={14} className="text-accent flex-shrink-0" aria-hidden />
      <Button variant="ghost" size="sm" onClick={() => toggle('v2')}>
        Try the new UI
      </Button>
      {/* ml-auto: on the full-width mobile row the dismiss sits at the right
          edge; in the shrink-wrapped desktop pill it resolves to zero. */}
      <span className="ml-auto">
        <IconButton
          icon={<X size={13} />}
          aria-label="Dismiss new UI banner"
          size="sm"
          variant="ghost"
          onClick={() => {
            try { localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* session-only */ }
            analytics.track('navigation', 'ui_shell_banner_dismiss', {});
            setDismissed(true);
          }}
        />
      </span>
    </div>
  );
}
```

Edit 2 — `frontend/src/components/layout/Header.tsx`: the mobile row, after the StaticSwitcher second row. Current (Header.tsx:416-428):
```tsx
        {/* Mobile second row: Static Switcher gets full width */}
        {isGroupRoute && currentGroup && (
          <div className="sm:hidden w-full">
            <StaticSwitcher
              currentGroup={currentGroup}
              groups={groups}
              onFetchGroups={fetchGroups}
              isMember={isMember}
              userRole={userRole ?? undefined}
              fullWidthMobile
            />
          </div>
        )}
```
Replace with:
```tsx
        {/* Mobile second row: Static Switcher gets full width */}
        {isGroupRoute && currentGroup && (
          <div className="sm:hidden w-full">
            <StaticSwitcher
              currentGroup={currentGroup}
              groups={groups}
              onFetchGroups={fetchGroups}
              isMember={isMember}
              userRole={userRole ?? undefined}
              fullWidthMobile
            />
          </div>
        )}

        {/* Mobile shell opt-in (Phase A, A5c): the desktop banner above is
            hidden sm:block and v2's AppRail (whose UserMenu holds the v2
            toggle) is hidden sm:flex — without this row a phone could never
            opt in to the new UI. The banner self-gates (legacy-resolved shell
            + not dismissed) and returns null otherwise, so no empty wrapper is
            left behind — same dismiss persistence + telemetry as the desktop
            instance. (v2 never renders this: Layout suppresses the Header
            entirely when the v2 shell is active on group routes.) */}
        {isGroupRoute && currentGroup && (
          <TryNewUiBanner className="sm:hidden w-full" />
        )}
```

- [ ] **Step 25: Run tests, verify pass** — from `frontend/`:
```bash
pnpm test src/components/layout/TryNewUiBanner.test.tsx src/components/layout/Header.avatar.test.tsx src/components/layout/Header.settings.test.tsx
```
All tests pass. (Header.settings renders Header on a group route with a currentGroup — it now mounts two real banner instances; its label/aria queries are unaffected.)

---

- [ ] **Step 26: Full suites of every touched file + repo gates** — from `frontend/`:
```bash
pnpm test src/pages/NewShell.rail.test.tsx src/pages/NewShell.slot.test.tsx src/pages/NewShell.banners.test.tsx src/pages/NewShell.authGuard.test.tsx src/pages/NewShell.gear.test.tsx src/pages/NewShell.roster.test.tsx src/pages/NewShell.schedule.test.tsx src/components/layout/Header.avatar.test.tsx src/components/layout/Header.settings.test.tsx src/components/layout/SettingsGear.test.tsx src/components/layout/TryNewUiBanner.test.tsx src/components/group/MorePage.test.tsx src/pages/GroupViewContent.slots.test.tsx src/pages/GroupViewContent.test.tsx
pnpm test
pnpm build
pnpm lint
pnpm check:design-system
```
All must pass — `Header.tsx` and `MorePage.tsx` are legacy-shared, so the full run is the both-shells green check. `pnpm build` runs `tsc -b` (stricter than `tsc --noEmit`) and must be clean before committing.

- [ ] **Step 27: Commit** — from the repo root:
```bash
cd D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git add frontend/src/pages/NewShell.tsx frontend/src/pages/NewShell.rail.test.tsx frontend/src/pages/NewShell.slot.test.tsx frontend/src/components/layout/Header.tsx frontend/src/components/layout/Header.avatar.test.tsx frontend/src/components/layout/TryNewUiBanner.tsx frontend/src/components/layout/TryNewUiBanner.test.tsx frontend/src/components/group/MorePage.tsx frontend/src/components/group/MorePage.test.tsx frontend/src/pages/GroupViewContent.tsx frontend/src/pages/GroupViewContent.slots.test.tsx frontend/src/hooks/useShellToggle.ts
git commit -m "fix(redesign): phase-a — A5 shell/nav trio: rail entries navigate, rail-less UserMenu restored, mobile shell toggle both ways"
```

---

### Task 7: Home activity feed — fold loot/material into the v2 feed (new util, additive only) (A6)

The v2 Home "Recent activity" card (`StaticActivityFeed`) derives rows exclusively from mount-farm/plugin data — loot and material drops never appear, even though `Home.tsx` already fetches the loot log. This task adds a NEW derivation util (`utils/lootActivity.ts`) with its **own** item/icon type union, merges its output with the existing mount-derived rows in the v2-only `StaticActivityFeed` (sort by `createdAt` desc, slice 5), and adds a `fetchMaterialLog` call to Home's existing membership-gated mount effect. This is a v2-side improvement, not a parity restore (legacy's feed never showed loot either). **Critically: `utils/staticActivity.ts` gets ZERO edits and `StaticActivityItem`'s type/icon unions must NOT widen** — the FROZEN legacy `StaticHomeTab.tsx` keys an exhaustive `Record<StaticActivityItem['icon'], …>` on that union, and widening it breaks `tsc -b`. `utils/staticActivity.test.ts` must pass UNMODIFIED as the freeze-proof. Standalone task: no dependency on any other Phase A task.

**Files:**
- Create: `frontend/src/utils/lootActivity.ts` (new derivation util with its own `LootActivityItem` type)
- Create: `frontend/src/utils/lootActivity.test.ts`
- Modify: `frontend/src/components/home/StaticActivityFeed.tsx` (imports, icon-badge map keyed on a widened component-local union, merge+sort+slice)
- Modify: `frontend/src/components/home/StaticActivityFeed.test.tsx` (add lootTrackingStore mock + loot/material/interleave/cap tests)
- Modify: `frontend/src/components/home/Home.tsx` (store read + membership-gated mount effect adds `fetchMaterialLog`)
- Modify: `frontend/src/components/home/Home.test.tsx` (lootTrackingStore mock shape + fetch assertions)
- Reference only — DO NOT EDIT: `frontend/src/utils/staticActivity.ts` (legacy-shared; new file chosen instead), `frontend/src/utils/staticActivity.test.ts` (must pass unmodified), `frontend/src/components/static-group/StaticHomeTab.tsx` (FROZEN)

**Interfaces:**
- Consumes (all existing at head, no other task involved):
  - `relativeTime(iso: string): string` — exported from `frontend/src/utils/staticActivity.ts:23` (pure, untouched)
  - `deriveActivityItems(data: MountFarmData, currentUserId?: string | null, activityDisplayMode?: 'named' | 'anonymous' | null): StaticActivityItem[]` — `utils/staticActivity.ts:62` (called as-is, unchanged)
  - `GEAR_SLOT_NAMES: Record<GearSlot, string>` — `frontend/src/types/index.ts:485`
  - `UPGRADE_MATERIAL_DISPLAY_NAMES: Record<UpgradeMaterialType, string>` — `frontend/src/gamedata/loot-tables.ts:128`
  - `LootLogEntry` / `MaterialLogEntry` — `frontend/src/types/index.ts:1237/1287` (both carry `recipientPlayerName: string`, `floor: string`, `createdAt: string`; loot carries `itemSlot: string`; material carries `materialType: MaterialType`)
  - `useLootTrackingStore` state/actions — `lootLog: LootLogEntry[]`, `materialLog: MaterialLogEntry[]`, `fetchMaterialLog: (groupId: string, tierId: string, week?: number) => Promise<void>` (`stores/lootTrackingStore.ts:48,54,72`; note `fetchMaterialLog` RE-THROWS on error, lootTrackingStore.ts:269)
- Produces (new, from `frontend/src/utils/lootActivity.ts`; no later task depends on them):
  - `export interface LootActivityItem { key: string; type: 'loot_received' | 'material_received'; icon: 'loot' | 'material'; label: string; createdAt: string; time: string; }`
  - `export function deriveLootActivityItems(lootLog: LootLogEntry[], materialLog: MaterialLogEntry[]): LootActivityItem[]`

- [ ] **Step 1: Write the failing util test** — create `frontend/src/utils/lootActivity.test.ts` with exactly this content (clock frozen the same way `staticActivity.test.ts` does, so `time` is deterministic):

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { deriveLootActivityItems } from './lootActivity';
import type { LootLogEntry, MaterialLogEntry } from '../types';

// Loot/material fold for the v2 Home activity feed (Phase A / A6).
// Labels are terse, mount-row style:
//   loot     → "{recipient} received {slot display name} — {fight}"
//   material → "{recipient} received {material display name}"
// Slot names come from GEAR_SLOT_NAMES, material names from
// UPGRADE_MATERIAL_DISPLAY_NAMES — the same sources LootEntryRow uses.
// `relativeTime` reads Date.now(), so the clock is frozen for determinism.

const NOW = '2026-06-30T12:00:00Z';

function lootEntry(partial: Partial<LootLogEntry> & { id: number }): LootLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M11S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-30T11:58:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'alice',
    ...partial,
  };
}

function materialEntry(partial: Partial<MaterialLogEntry> & { id: number }): MaterialLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M10S',
    materialType: 'twine',
    recipientPlayerId: 'p2',
    recipientPlayerName: 'Bob',
    method: 'drop',
    createdAt: '2026-06-30T11:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'alice',
    ...partial,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('deriveLootActivityItems', () => {
  it('returns [] for empty inputs', () => {
    expect(deriveLootActivityItems([], [])).toEqual([]);
  });

  it('formats a loot row: recipient, slot display name, fight, relative time (exact output)', () => {
    const items = deriveLootActivityItems([lootEntry({ id: 1 })], []);
    expect(items).toEqual([
      {
        key: 'loot-1',
        type: 'loot_received',
        icon: 'loot',
        label: 'Alice received Body — M11S',
        createdAt: '2026-06-30T11:58:00Z',
        time: '2m ago',
      },
    ]);
  });

  it('falls back to the raw itemSlot when it has no display name', () => {
    const items = deriveLootActivityItems([lootEntry({ id: 2, itemSlot: 'mystery_slot' })], []);
    expect(items[0].label).toBe('Alice received mystery_slot — M11S');
  });

  it('formats a material row: recipient + material display name, no fight (exact output)', () => {
    const items = deriveLootActivityItems([], [materialEntry({ id: 7 })]);
    expect(items).toEqual([
      {
        key: 'material-7',
        type: 'material_received',
        icon: 'material',
        label: 'Bob received Twine',
        createdAt: '2026-06-30T11:00:00Z',
        time: '1h ago',
      },
    ]);
  });

  it('merges both logs sorted by createdAt desc', () => {
    const items = deriveLootActivityItems(
      [
        lootEntry({ id: 1, createdAt: '2026-06-30T09:00:00Z' }),
        lootEntry({ id: 2, createdAt: '2026-06-30T11:58:00Z' }),
      ],
      [materialEntry({ id: 7, createdAt: '2026-06-30T11:00:00Z' })],
    );
    expect(items.map((i) => i.key)).toEqual(['loot-2', 'material-7', 'loot-1']);
  });
});
```

- [ ] **Step 2: Run it, verify it fails** — from `frontend/`:

```bash
pnpm test src/utils/lootActivity.test.ts
```

Expected failure: the suite errors at import time with `Failed to resolve import "./lootActivity" from "src/utils/lootActivity.test.ts"` (the module does not exist yet).

- [ ] **Step 3: Implement the util** — create `frontend/src/utils/lootActivity.ts` with exactly this content:

```ts
/**
 * lootActivity — loot/material "recent activity" derivation for the v2 Home feed.
 *
 * Deliberately a SEPARATE file from `utils/staticActivity.ts`: that file's
 * `StaticActivityItem` type/icon unions are keyed exhaustively by the FROZEN
 * legacy `StaticHomeTab.tsx` (`Record<StaticActivityItem['icon'], …>`), so they
 * must never widen. Loot rows get their own item type + icon union instead and
 * are merged with mount rows locally by the v2-only `StaticActivityFeed`.
 *
 * No anonymization needed: loot/material entries carry `recipientPlayerName`
 * unconditionally and are already shown by name to all static members in
 * Loot History / WeeklyLootGrid — unlike mount plugin-sync rows, whose
 * anonymization exists to avoid leaking personal Dalamud sync timestamps.
 *
 * Labels are terse, mount-row style (method distinction deferred to polish):
 *   loot     → "{recipient} received {slot display name} — {fight}"
 *   material → "{recipient} received {material display name}"
 */

import { GEAR_SLOT_NAMES } from '../types';
import type { LootLogEntry, MaterialLogEntry } from '../types';
import { UPGRADE_MATERIAL_DISPLAY_NAMES } from '../gamedata/loot-tables';
import { relativeTime } from './staticActivity';

export interface LootActivityItem {
  key: string;
  type: 'loot_received' | 'material_received';
  icon: 'loot' | 'material';
  label: string;
  createdAt: string;
  time: string;
}

export function deriveLootActivityItems(
  lootLog: LootLogEntry[],
  materialLog: MaterialLogEntry[],
): LootActivityItem[] {
  const items: LootActivityItem[] = [];

  for (const entry of lootLog) {
    const slotName =
      GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] ?? entry.itemSlot;
    items.push({
      key: `loot-${entry.id}`,
      type: 'loot_received',
      icon: 'loot',
      label: `${entry.recipientPlayerName} received ${slotName} — ${entry.floor}`,
      createdAt: entry.createdAt,
      time: relativeTime(entry.createdAt),
    });
  }

  for (const entry of materialLog) {
    items.push({
      key: `material-${entry.id}`,
      type: 'material_received',
      icon: 'material',
      label: `${entry.recipientPlayerName} received ${UPGRADE_MATERIAL_DISPLAY_NAMES[entry.materialType]}`,
      createdAt: entry.createdAt,
      time: relativeTime(entry.createdAt),
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}
```

(`UPGRADE_MATERIAL_DISPLAY_NAMES[entry.materialType]` type-checks: `MaterialType` in `types/index.ts:1284` and `UpgradeMaterialType` in `gamedata/loot-tables.ts:13` are identical string unions — `components/loot/LootEntryRow.tsx:122` already does this exact index.)

- [ ] **Step 4: Run tests, verify pass** — from `frontend/`:

```bash
pnpm test src/utils/lootActivity.test.ts
```

All 5 tests pass.

- [ ] **Step 5: Freeze-proof — the shared util and its test are untouched** — from `frontend/`:

```bash
pnpm test src/utils/staticActivity.test.ts
```

All 5 existing `deriveActivityItems` tests MUST pass with ZERO modifications to either `src/utils/staticActivity.ts` or `src/utils/staticActivity.test.ts`. Then from the repo root confirm no accidental edits:

```bash
git status --porcelain frontend/src/utils/staticActivity.ts frontend/src/utils/staticActivity.test.ts frontend/src/components/static-group/StaticHomeTab.tsx
```

Expected output: empty (no lines). If any of these three files shows as modified, STOP and revert that file before proceeding.

- [ ] **Step 6: Write the failing feed tests** — edit `frontend/src/components/home/StaticActivityFeed.test.tsx`. Four edits:

Current (StaticActivityFeed.test.tsx:1-3):
```ts
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MountFarmData } from '../../stores/mountFarmStore';
```
Replace with:
```ts
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MountFarmData } from '../../stores/mountFarmStore';
import type { LootLogEntry, MaterialLogEntry } from '../../types';
```

Current (StaticActivityFeed.test.tsx:7-10):
```ts
const mocks = vi.hoisted(() => ({
  data: null as MountFarmData | null,
  user: { id: 'u1', activityDisplayMode: 'named' } as User,
}));
```
Replace with:
```ts
const mocks = vi.hoisted(() => ({
  data: null as MountFarmData | null,
  user: { id: 'u1', activityDisplayMode: 'named' } as User,
  lootLog: [] as LootLogEntry[],
  materialLog: [] as MaterialLogEntry[],
}));
```

Current (StaticActivityFeed.test.tsx:16-18):
```ts
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: User }) => unknown) => selector({ user: mocks.user }),
}));
```
Replace with (adds the lootTrackingStore mock, mirroring the suite's existing selector-mock shape):
```ts
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: User }) => unknown) => selector({ user: mocks.user }),
}));
vi.mock('../../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (
    selector: (s: { lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[] }) => unknown,
  ) => selector({ lootLog: mocks.lootLog, materialLog: mocks.materialLog }),
}));
```

Current (StaticActivityFeed.test.tsx:57-61):
```ts
describe('StaticActivityFeed', () => {
  beforeEach(() => {
    mocks.data = null;
    mocks.user = { id: 'u1', activityDisplayMode: 'named' };
  });
```
Replace with (fixtures + resets):
```ts
function makeLootEntry(partial: Partial<LootLogEntry> & { id: number }): LootLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M11S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-30T11:59:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'alice',
    ...partial,
  };
}

function makeMaterialEntry(partial: Partial<MaterialLogEntry> & { id: number }): MaterialLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M10S',
    materialType: 'twine',
    recipientPlayerId: 'p2',
    recipientPlayerName: 'Bob',
    method: 'drop',
    createdAt: '2026-06-30T11:57:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'alice',
    ...partial,
  };
}

describe('StaticActivityFeed', () => {
  beforeEach(() => {
    mocks.data = null;
    mocks.user = { id: 'u1', activityDisplayMode: 'named' };
    mocks.lootLog = [];
    mocks.materialLog = [];
  });
```

Current (StaticActivityFeed.test.tsx:81-88, the end of the file):
```ts
  it('renders activity rows with label and relative time when data is present', () => {
    mocks.data = dataWithMount();
    render(<StaticActivityFeed />);
    expect(screen.getByText('Alice obtained Wings of Ruin')).toBeInTheDocument();
    // No empty state once rows exist.
    expect(screen.queryByText(/no activity yet this week/i)).not.toBeInTheDocument();
  });
});
```
Replace with:
```ts
  it('renders activity rows with label and relative time when data is present', () => {
    mocks.data = dataWithMount();
    render(<StaticActivityFeed />);
    expect(screen.getByText('Alice obtained Wings of Ruin')).toBeInTheDocument();
    // No empty state once rows exist.
    expect(screen.queryByText(/no activity yet this week/i)).not.toBeInTheDocument();
  });

  it('renders a loot row with recipient, slot name, and fight', () => {
    mocks.lootLog = [makeLootEntry({ id: 1 })];
    render(<StaticActivityFeed />);
    expect(screen.getByText('Alice received Body — M11S')).toBeInTheDocument();
    expect(screen.queryByText(/no activity yet this week/i)).not.toBeInTheDocument();
  });

  it('renders a material row with recipient and material name', () => {
    mocks.materialLog = [makeMaterialEntry({ id: 7 })];
    render(<StaticActivityFeed />);
    expect(screen.getByText('Bob received Twine')).toBeInTheDocument();
  });

  it('interleaves loot, mount, and material rows by recency', () => {
    mocks.data = dataWithMount(); // "Alice obtained Wings of Ruin" @ 11:58
    mocks.lootLog = [makeLootEntry({ id: 1, createdAt: '2026-06-30T11:59:00Z' })]; // newest
    mocks.materialLog = [makeMaterialEntry({ id: 7, createdAt: '2026-06-30T11:57:00Z' })]; // oldest
    render(<StaticActivityFeed />);
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Alice received Body — M11S');
    expect(rows[1]).toContain('Alice obtained Wings of Ruin');
    expect(rows[2]).toContain('Bob received Twine');
  });

  it('caps the merged feed at 5 rows', () => {
    mocks.data = dataWithMount(); // 1 mount row
    mocks.lootLog = [1, 2, 3, 4, 5, 6].map((n) =>
      makeLootEntry({ id: n, createdAt: `2026-06-30T11:5${n}:00Z` }),
    ); // 6 loot rows → 7 candidates total
    render(<StaticActivityFeed />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});
```

- [ ] **Step 7: Run it, verify the new tests fail** — from `frontend/`:

```bash
pnpm test src/components/home/StaticActivityFeed.test.tsx
```

Expected: the 4 pre-existing tests still pass; the 4 new tests fail — first signature: `TestingLibraryElementError: Unable to find an element with the text: Alice received Body — M11S` (the component doesn't read the loot log yet).

- [ ] **Step 8: Implement the feed merge (+ mechanical Home.test mock-shape piggyback)** — three edits to `frontend/src/components/home/StaticActivityFeed.tsx`:

Current (StaticActivityFeed.tsx:9-11, header comment):
```ts
 * Boundary discipline (ring0): reads stores (`mountFarmStore` + `authStore` —
 * ring0→store is allowed) and the not-ring-typed `utils/staticActivity` derivation,
 * and composes shared `ui/` components. It NEVER imports a ring1/ring3 component —
```
Replace with:
```ts
 * Boundary discipline (ring0): reads stores (`mountFarmStore` + `authStore` +
 * `lootTrackingStore` — ring0→store is allowed) and the not-ring-typed
 * `utils/staticActivity` + `utils/lootActivity` derivations,
 * and composes shared `ui/` components. It NEVER imports a ring1/ring3 component —
```

Current (StaticActivityFeed.tsx:19-32):
```ts
import { Activity, Plug, Sparkles, Target, Trophy, type LucideIcon } from 'lucide-react';
import { CardShell } from '../ui/CardShell';
import { EmptyStateInvite } from '../ui/EmptyStateInvite';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import { useAuthStore } from '../../stores/authStore';
import { deriveActivityItems, type StaticActivityItem } from '../../utils/staticActivity';

/** Source badge per activity icon — token-clean tints (no raw color). */
const ICON_BADGE: Record<StaticActivityItem['icon'], { Icon: LucideIcon; className: string }> = {
  mount: { Icon: Trophy, className: 'bg-status-warning/15 text-status-warning' },
  currency: { Icon: Target, className: 'bg-status-info/15 text-status-info' },
  plugin: { Icon: Plug, className: 'bg-accent/15 text-accent' },
  tracking: { Icon: Sparkles, className: 'bg-membership-lead/15 text-membership-lead' },
};
```
Replace with:
```ts
import { Activity, Gem, Package, Plug, Sparkles, Target, Trophy, type LucideIcon } from 'lucide-react';
import { CardShell } from '../ui/CardShell';
import { EmptyStateInvite } from '../ui/EmptyStateInvite';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import { useAuthStore } from '../../stores/authStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { deriveActivityItems, type StaticActivityItem } from '../../utils/staticActivity';
import { deriveLootActivityItems, type LootActivityItem } from '../../utils/lootActivity';

/**
 * The merged feed row. Component-LOCAL union: `StaticActivityItem`'s own icon
 * union must never widen (the frozen legacy StaticHomeTab keys an exhaustive
 * Record on it), so loot/material icons live in `LootActivityItem` and only
 * this render type sees both.
 */
type FeedIcon = StaticActivityItem['icon'] | LootActivityItem['icon'];

interface FeedRow {
  key: string;
  icon: FeedIcon;
  label: string;
  createdAt: string;
  time: string;
}

/** Source badge per activity icon — token-clean tints (no raw color). */
const ICON_BADGE: Record<FeedIcon, { Icon: LucideIcon; className: string }> = {
  mount: { Icon: Trophy, className: 'bg-status-warning/15 text-status-warning' },
  currency: { Icon: Target, className: 'bg-status-info/15 text-status-info' },
  plugin: { Icon: Plug, className: 'bg-accent/15 text-accent' },
  tracking: { Icon: Sparkles, className: 'bg-membership-lead/15 text-membership-lead' },
  loot: { Icon: Package, className: 'bg-gear-raid/15 text-gear-raid' },
  material: { Icon: Gem, className: 'bg-gear-augmented/15 text-gear-augmented' },
};
```
(Icon choices follow existing loot surfaces: `Package` = gear drop in `QuickLogDropModal.tsx`/`LogWeekWizard`, `Gem` = material in `QuickLogMaterialModal.tsx`. Color tokens `gear-raid`/`gear-augmented` are the same ones `LootEntryRow.tsx` badges use; `text-gear-raid`/`text-gear-augmented` utilities exist — see `primitives/Badge.tsx`.)

Current (StaticActivityFeed.tsx:34-38):
```ts
export function StaticActivityFeed() {
  const data = useMountFarmStore((s) => s.data);
  const user = useAuthStore((s) => s.user);

  const items = data ? deriveActivityItems(data, user?.id, user?.activityDisplayMode) : [];
```
Replace with:
```ts
export function StaticActivityFeed() {
  const data = useMountFarmStore((s) => s.data);
  const user = useAuthStore((s) => s.user);
  const lootLog = useLootTrackingStore((s) => s.lootLog);
  const materialLog = useLootTrackingStore((s) => s.materialLog);

  const mountItems = data ? deriveActivityItems(data, user?.id, user?.activityDisplayMode) : [];
  const lootItems = deriveLootActivityItems(lootLog, materialLog);
  // Pure recency — a big raid night dominating the feed IS the recent activity.
  const items: FeedRow[] = [...mountItems, ...lootItems]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
```
The rest of the component (the `return (` JSX) is unchanged — `item.key`, `item.icon`, `item.label`, `item.time` all exist on `FeedRow`.

**Mechanical piggyback (compile/render-forced, explicitly allowed):** `Home.tsx` renders `StaticActivityFeed` live in `Home.test.tsx`, whose lootTrackingStore mock does not yet provide `materialLog` — after this step the feed would select `undefined` and `deriveLootActivityItems` would throw, failing every Home test. Extend the mock SHAPE now (assertions come in Step 10). Three edits to `frontend/src/components/home/Home.test.tsx`:

Current (Home.test.tsx:19-23):
```ts
  lootLog: [] as unknown[],
  pageLedger: [] as unknown[],
  currentWeek: 3,
  fetchLootLog: vi.fn(),
  fetchPageLedger: vi.fn(),
```
Replace with:
```ts
  lootLog: [] as unknown[],
  materialLog: [] as unknown[],
  pageLedger: [] as unknown[],
  currentWeek: 3,
  fetchLootLog: vi.fn(),
  fetchPageLedger: vi.fn(),
  fetchMaterialLog: vi.fn().mockResolvedValue(undefined),
```

Current (Home.test.tsx:38-47):
```ts
vi.mock('../../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      lootLog: mocks.lootLog,
      pageLedger: mocks.pageLedger,
      currentWeek: mocks.currentWeek,
      fetchLootLog: mocks.fetchLootLog,
      fetchPageLedger: mocks.fetchPageLedger,
    }),
}));
```
Replace with:
```ts
vi.mock('../../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      lootLog: mocks.lootLog,
      materialLog: mocks.materialLog,
      pageLedger: mocks.pageLedger,
      currentWeek: mocks.currentWeek,
      fetchLootLog: mocks.fetchLootLog,
      fetchPageLedger: mocks.fetchPageLedger,
      fetchMaterialLog: mocks.fetchMaterialLog,
    }),
}));
```

Current (Home.test.tsx:129-133):
```ts
  mocks.lootLog = [];
  mocks.pageLedger = [];
  mocks.currentWeek = 3;
  mocks.fetchLootLog = vi.fn();
  mocks.fetchPageLedger = vi.fn();
```
Replace with:
```ts
  mocks.lootLog = [];
  mocks.materialLog = [];
  mocks.pageLedger = [];
  mocks.currentWeek = 3;
  mocks.fetchLootLog = vi.fn();
  mocks.fetchPageLedger = vi.fn();
  mocks.fetchMaterialLog = vi.fn().mockResolvedValue(undefined);
```
(`mockResolvedValue` because Step 12's implementation chains `.catch()` on the returned promise — a bare `vi.fn()` returns `undefined` and would crash.)

- [ ] **Step 9: Run tests, verify pass** — from `frontend/`:

```bash
pnpm test src/components/home/StaticActivityFeed.test.tsx src/components/home/Home.test.tsx
```

All 8 feed tests and all 8 existing Home tests pass.

- [ ] **Step 10: Write the failing Home fetch assertions** — two edits to `frontend/src/components/home/Home.test.tsx`:

Current (Home.test.tsx:216-221):
```ts
  it('membership-gates the fetch effect: non-members skip group-request + session fetches', () => {
    const nonMemberGroup = { id: 'g1', name: 'Crescent', userRole: null } as unknown as StaticGroup;
    renderHome({ group: nonMemberGroup, canManage: false });
    expect(mocks.fetchGroupRequests).not.toHaveBeenCalled();
    expect(mocks.fetchSessions).not.toHaveBeenCalled();
  });
```
Replace with:
```ts
  it('membership-gates the fetch effect: non-members skip group-request + session fetches', () => {
    const nonMemberGroup = { id: 'g1', name: 'Crescent', userRole: null } as unknown as StaticGroup;
    renderHome({ group: nonMemberGroup, canManage: false });
    expect(mocks.fetchGroupRequests).not.toHaveBeenCalled();
    expect(mocks.fetchSessions).not.toHaveBeenCalled();
    expect(mocks.fetchMaterialLog).not.toHaveBeenCalled();
  });
```

Current (Home.test.tsx:223-229):
```ts
  it('fetches on mount for members (sessions, loot, progress) and group-requests when canManage', () => {
    renderHome();
    expect(mocks.fetchSessions).toHaveBeenCalledWith('g1');
    expect(mocks.fetchLootLog).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchPageLedger).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchGroupRequests).toHaveBeenCalledWith('g1');
  });
```
Replace with:
```ts
  it('fetches on mount for members (sessions, loot, progress) and group-requests when canManage', () => {
    renderHome();
    expect(mocks.fetchSessions).toHaveBeenCalledWith('g1');
    expect(mocks.fetchLootLog).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchPageLedger).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchMaterialLog).toHaveBeenCalledWith('g1', 't1');
    expect(mocks.fetchGroupRequests).toHaveBeenCalledWith('g1');
  });
```

- [ ] **Step 11: Run it, verify it fails** — from `frontend/`:

```bash
pnpm test src/components/home/Home.test.tsx
```

Expected: the members-fetch test fails with `AssertionError: expected "spy" to be called with arguments: [ 'g1', 't1' ]` and `Number of calls: 0` for `fetchMaterialLog` (Home never calls it yet). The other 7 tests pass (the suite has 8 tests total; Step 10 extends two existing ones rather than adding new tests).

- [ ] **Step 12: Implement the Home fetch** — three edits to `frontend/src/components/home/Home.tsx`:

Current (Home.tsx:86-87):
```ts
  const fetchLootLog = useLootTrackingStore((s) => s.fetchLootLog);
  const fetchPageLedger = useLootTrackingStore((s) => s.fetchPageLedger);
```
Replace with:
```ts
  const fetchLootLog = useLootTrackingStore((s) => s.fetchLootLog);
  const fetchPageLedger = useLootTrackingStore((s) => s.fetchPageLedger);
  const fetchMaterialLog = useLootTrackingStore((s) => s.fetchMaterialLog);
```

Current (Home.tsx:106-109):
```ts
      if (tierId) {
        fetchLootLog(group.id, tierId);
        fetchPageLedger(group.id, tierId);
      }
```
Replace with:
```ts
      if (tierId) {
        fetchLootLog(group.id, tierId);
        fetchPageLedger(group.id, tierId);
        // fetchMaterialLog re-throws on failure (lootTrackingStore) — swallow like
        // the ScheduleTab mount-fetch precedent so this new call can't become an
        // unhandled-rejection site. Feeds the activity feed only; non-fatal.
        void fetchMaterialLog(group.id, tierId).catch(() => undefined);
      }
```

Current (Home.tsx:119-121):
```ts
    fetchLootLog,
    fetchPageLedger,
  ]);
```
Replace with:
```ts
    fetchLootLog,
    fetchPageLedger,
    fetchMaterialLog,
  ]);
```

Why the `.catch`: `fetchMaterialLog` re-throws on error (`stores/lootTrackingStore.ts:264-270`), and the sibling `fetchLootLog`/`fetchPageLedger` calls here are unguarded — mirroring them verbatim would add a NEW unhandled-rejection site. Per the task exception, the new line (only) gets the codebase's mount-fetch guard pattern (`ScheduleTab.tsx:75-76`: `void fetchSessions(groupId).catch(() => undefined);`). The pre-existing unguarded `fetchLootLog`/`fetchPageLedger` calls are NOT touched — flagged as a discovered follow-up, out of scope here.

- [ ] **Step 13: Run tests, verify pass** — from `frontend/`:

```bash
pnpm test src/components/home/Home.test.tsx
```

All 8 tests pass.

- [ ] **Step 14: Full suites of every touched file + build** — from `frontend/`:

```bash
pnpm test src/utils/lootActivity.test.ts src/utils/staticActivity.test.ts src/components/home/StaticActivityFeed.test.tsx src/components/home/Home.test.tsx
pnpm build
pnpm lint
pnpm check:design-system
```

All four suites green — `staticActivity.test.ts` in particular passes UNMODIFIED (re-run of the Step 5 freeze-proof). `pnpm build` runs `tsc -b`, which proves the frozen `StaticHomeTab.tsx`'s exhaustive `Record<StaticActivityItem['icon'], …>` still compiles (the union was never widened). Lint + design-system checks must report no new violations in the touched files.

- [ ] **Step 15: Commit** — from the repo root:

```bash
git add frontend/src/utils/lootActivity.ts frontend/src/utils/lootActivity.test.ts frontend/src/components/home/StaticActivityFeed.tsx frontend/src/components/home/StaticActivityFeed.test.tsx frontend/src/components/home/Home.tsx frontend/src/components/home/Home.test.tsx
git commit -m "feat(redesign): phase-a — fold loot/material into the v2 Home activity feed (A6)"
```

---

### Task 8: 404 catch-all route — lazy NotFound inside Layout (A7)

`App.tsx`'s `<Routes>` tree has no `path="*"` route anywhere, so an unknown URL matches nothing — not even the `path="/"` Layout parent — and the app renders a truly blank page (no Header, no nav, nothing). This task adds a lazy `pages/NotFound.tsx` composed from the established `EmptyState` primitive and registers `<Route path="*" element={<NotFound />} />` as the LAST child **inside** the Layout route, so Header/nav chrome mounts around the 404 page. The CTA navigates to `/` unconditionally (approved skim default §6.7 — the index route already handles auth-state routing). Invalid `/group/:shareCode` codes keep their existing shell-internal "not found" handling in both shells — explicitly OUT of scope here. `App.tsx` is legacy-SHARED: the edit is strictly additive (one lazy import + one route line); a wildcard route only ever matches URLs that matched nothing before, so no existing route resolution — legacy or v2 — can change. Standalone task: no dependency on any other Phase A task.

**Files:**
- Create: `frontend/src/pages/NotFound.tsx`
- Create: `frontend/src/pages/NotFound.test.tsx`
- Modify: `frontend/src/App.tsx` (legacy-shared, ADDITIVE ONLY — one lazy-import line + one `<Route path="*">` line inside the Layout route)
- Modify: `frontend/src/App.test.tsx` (add an App-level catch-all route test; existing ErrorFallback tests preserved byte-for-byte)

**Interfaces:**
- Consumes: `EmptyState` from `frontend/src/components/ui` (barrel; props `{ icon: ReactNode; heading: string; description: string; action?: { label: string; onClick: () => void }; className?: string }` — `components/ui/EmptyState.tsx:10-20`); `useNavigate()` from `react-router-dom`; `Compass` from `lucide-react`; App.tsx's existing named-export lazy pattern `lazy(() => import('./pages/X').then(m => ({ default: m.X })))`; `ThemeProvider` from `frontend/src/hooks/useTheme` (App-level test wrapper — `useTheme` throws without it, `useTheme.ts:97`). Nothing from other tasks.
- Produces: `export function NotFound(): ReactElement` (named export in `frontend/src/pages/NotFound.tsx`). No later task consumes it.

- [ ] **Step 1: Write the failing NotFound unit test.** Create `frontend/src/pages/NotFound.test.tsx` with exactly:

```tsx
/**
 * @vitest-environment jsdom
 *
 * NotFound — global 404 page (Phase A, A7).
 * Renders heading + description + CTA; CTA navigates to '/' unconditionally
 * (approved skim default §6.7 — the index route handles auth-state routing).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mock useNavigate ─────────────────────────────────────────────────────────
// Must be declared before vi.mock so the factory can close over it.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { NotFound } from './NotFound';

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('NotFound', () => {
  it('renders the heading, description, and CTA', () => {
    render(
      <MemoryRouter initialEntries={['/this/route/does-not-exist']}>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText("This page doesn't exist or has moved.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Home' })).toBeInTheDocument();
  });

  it('CTA navigates to / unconditionally', () => {
    render(
      <MemoryRouter initialEntries={['/this/route/does-not-exist']}>
        <NotFound />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** From `frontend/`:

```bash
pnpm test src/pages/NotFound.test.tsx
```

Expected failure: the suite errors at collection with a module-resolution failure — `Error: Failed to load url ./NotFound (resolved id: ./NotFound) in .../frontend/src/pages/NotFound.test.tsx. Does the file exist?` — because `pages/NotFound.tsx` does not exist yet.

- [ ] **Step 3: Implement `pages/NotFound.tsx`.** Create `frontend/src/pages/NotFound.tsx` with exactly:

```tsx
/**
 * NotFound — global 404 page for unmatched URLs (Phase A, A7).
 *
 * Registered as the catch-all `path="*"` child INSIDE App.tsx's Layout route,
 * so the app Header/nav chrome mounts around it (an unmatched URL previously
 * matched nothing at all and rendered a blank page). Invalid /group/:shareCode
 * codes are NOT handled here — each shell keeps its own "not found" state.
 *
 * The CTA goes to '/' unconditionally: the index route already routes by auth
 * state, so Home is always a safe landing.
 */

import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export function NotFound() {
  const navigate = useNavigate();

  return (
    // Layout's <main> is a flex column; flex-1 centers the state vertically
    // within it (same full-page treatment as the shell content states).
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <EmptyState
        icon={<Compass className="w-8 h-8" />}
        heading="Page not found"
        description="This page doesn't exist or has moved."
        action={{ label: 'Back to Home', onClick: () => navigate('/') }}
      />
    </div>
  );
}
```

(Design-system notes: `EmptyState` composes the `Button` primitive internally for the CTA; icon sizing `w-8 h-8` mirrors Discover.tsx's `<Search className="w-8 h-8" />` empty-state precedent; tokens only, no raw interactive elements, copy contains no "group".)

- [ ] **Step 4: Run tests, verify pass.** From `frontend/`:

```bash
pnpm test src/pages/NotFound.test.tsx
```

Both tests pass (2 passed).

- [ ] **Step 5: Write the failing App-level catch-all test.** Replace the ENTIRE contents of `frontend/src/App.test.tsx` with the following (the two existing ErrorFallback test bodies and their describe/beforeEach are preserved byte-for-byte; the imports section is reworked — `afterEach`/`vi` added, `MemoryRouter` + `ThemeProvider` imports added, `import { ErrorFallback } from './App'` widened to `import App, { ErrorFallback } from './App'` — new module mocks are added above the `./App` import, and a new describe block is appended):

```tsx
/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// ── A7 catch-all test mocks ──────────────────────────────────────────────────
// App's mount effect fires initializeAuth() (GET /api/auth/me), analytics.init()
// and errorReporter.init(); none of these may hit the network in jsdom. Only
// initializeAuth is overridden — everything else on authStore stays REAL because
// Layout/Header read useAuthStore/useAuthHydrated from the same module.
vi.mock('./stores/authStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./stores/authStore')>();
  return { ...actual, initializeAuth: vi.fn() };
});
vi.mock('./services/analytics', () => ({ analytics: { init: vi.fn(), track: vi.fn() } }));
vi.mock('./services/errorReporter', () => ({ errorReporter: { init: vi.fn() } }));

import App, { ErrorFallback } from './App';
import { ThemeProvider } from './hooks/useTheme';

describe('App error fallback', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('shows stale chunk recovery copy after an automatic reload has already been attempted', () => {
    window.sessionStorage.setItem('xrp_chunk_reload_attempted', '1');

    render(
      <ErrorFallback
        error={new Error('error loading dynamically imported module: https://www.xivraidplanner.app/assets/GroupView-D4tlpFl.js')}
        resetErrorBoundary={() => {}}
      />,
    );

    expect(screen.getByText('The app was updated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('keeps normal errors on the generic fallback', () => {
    render(
      <ErrorFallback
        error={new Error('Cannot read properties of undefined')}
        resetErrorBoundary={() => {}}
      />,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('App catch-all route (A7)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom has no matchMedia; ThemeProvider (useTheme.ts:20) and useDevice
    // (Header/PageTransition) require it. Same stub shape as
    // CommandPalette.test.tsx.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders NotFound INSIDE Layout chrome at an unmatched path', async () => {
    // Mirrors main.tsx's provider nesting (Router > ThemeProvider > App); App
    // itself renders no router, so MemoryRouter controls the location.
    render(
      <MemoryRouter initialEntries={['/this/route/does-not-exist']}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </MemoryRouter>,
    );

    // NotFound is a lazy route — wait for the chunk, then assert 404 content…
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Home' })).toBeInTheDocument();
    // …AND the app Header chrome (<header> = banner role, logo alt text),
    // proving the wildcard mounted INSIDE the Layout route — an unmatched URL
    // used to render literally nothing, Layout included.
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByAltText('FFXIV Raid Planner')).toBeInTheDocument();
  }, 10_000); // explicit test timeout: must exceed findByRole's 5s waitFor so the
  // pre-fix failure is the TestingLibraryElementError, not vitest's own 5s default
});
```

- [ ] **Step 6: Run it, verify the new test fails.** From `frontend/`:

```bash
pnpm test src/App.test.tsx
```

Expected: the two `App error fallback` tests still pass; `renders NotFound INSIDE Layout chrome at an unmatched path` fails after the 5s `findByRole` timeout with `TestingLibraryElementError: Unable to find role="heading" and name "Page not found"` — no route matches `/this/route/does-not-exist`, so `<Routes>` renders null (the blank-page bug reproduced). (The `it()` carries an explicit `10_000` timeout precisely so the findByRole waitFor expires FIRST — without it, vitest's default 5s test timeout races it and you may see `Error: Test timed out in 5000ms.` instead; both signify the same red state.)

- [ ] **Step 7: Implement the App.tsx route (additive only — two one-line insertions).**

Edit 1 — register the lazy import alongside the other lazy pages.

Current (`frontend/src/App.tsx:29`):
```tsx
const PluginAuth = lazy(() => import('./pages/PluginAuth').then(m => ({ default: m.PluginAuth })));
```

Replace with:
```tsx
const PluginAuth = lazy(() => import('./pages/PluginAuth').then(m => ({ default: m.PluginAuth })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
```

Edit 2 — add the wildcard as the LAST child inside the Layout route.

Current (`frontend/src/App.tsx:188-190`):
```tsx
            {/* Legacy redirect for old /design-system URL */}
            <Route path="design-system" element={<DesignSystemPage />} />
          </Route>
```

Replace with:
```tsx
            {/* Legacy redirect for old /design-system URL */}
            <Route path="design-system" element={<DesignSystemPage />} />
            {/* Catch-all 404 (A7) — MUST stay the LAST child inside the Layout
                route so Header/nav chrome mounts around the not-found page.
                Do NOT add a second top-level wildcard: route ranking already
                lets /auth/callback, /invite/:inviteCode and /plugin-auth win
                over "/" + "*", so this one splat catches every other URL. */}
            <Route path="*" element={<NotFound />} />
          </Route>
```

- [ ] **Step 8: Run the App suite, verify all pass.** From `frontend/`:

```bash
pnpm test src/App.test.tsx
```

All 3 tests pass.

- [ ] **Step 9: Full suites of every touched file + repo gates.** From `frontend/`:

```bash
pnpm test src/App.test.tsx src/pages/NotFound.test.tsx
pnpm lint
pnpm check:design-system
pnpm build
```

All green (`pnpm build` runs `tsc -b`, which is stricter than `tsc --noEmit` — required before pushing). The Playwright smoke suites (`e2e/smoke.spec.ts`, `e2e/smoke-legacy.spec.ts`) are unaffected by construction: a wildcard route only matches URLs that previously matched nothing, so no existing legacy or v2 route resolution changes.

- [ ] **Step 10: Commit.** From the repo root:

```bash
git add frontend/src/pages/NotFound.tsx frontend/src/pages/NotFound.test.tsx frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "fix(redesign): phase-a — 404 catch-all route renders lazy NotFound inside Layout (A7)"
```

---

### Task 9: Auth 429 false-logout — status-aware refresh failure handling (A8)

`refreshAccessToken` in `frontend/src/stores/authStore.ts` throws a status-less `Error` on any `!response.ok` and a single catch clears `user`/`isAuthenticated` for 401, 429, 5xx, and network failures alike — but the backend rate-limits `POST /api/auth/refresh` to 10/min (`backend/app/rate_limit.py:74`, applied at `backend/app/routers/auth.py:302`), so a burst of concurrent auth traffic can 429 the refresh and falsely log the user out. There is a second site with the same shape: `fetchUser`'s else-branch force-clears state whenever `refreshAccessToken()` returns false, for any reason — it must also be fixed or the symptom survives. The fix branches on `response.status`: 401/403 is a real auth failure (cancel the scheduled proactive refresh, clear state, return false); anything else non-ok (429/5xx) and a rejected fetch (network) return false **without touching state or the scheduled refresh** — the un-cancelled proactive timer plus the reactive 401 retry in `services/api.ts` are the retry story (no new backoff logic). `services/api.ts` needs no change (it never clears auth state itself). Explicitly out of scope: `fetchUser`'s retry-catch branch (authStore.ts:503-511) — it cannot 429 today (`GET /api/auth/me` carries no rate-limit decorator) and fixing it properly needs a status-carrying `authRequest` refactor; leave it byte-untouched. `authStore.ts` is core-shared (never restored/frozen — not in the f45a241 inventory), so both shells benefit identically; keep the diff surgical (only the two named regions). Standalone task — no dependency on any other Phase A task.

**Files:**
- Modify: `frontend/src/stores/authStore.ts` (two regions only: the `refreshAccessToken` function body at :425-470, and `fetchUser`'s refresh-failed else-branch at :513-520)
- Create: `frontend/src/stores/authStore.refreshAccessToken.test.ts`
- Test: `frontend/src/stores/authStore.initializeAuth.test.ts` (add a third case; keep both existing cases green)

**Interfaces:**
- Consumes: `useAuthStore` and its existing method signature `refreshAccessToken: () => Promise<boolean>` (unchanged); module-private helpers `cancelScheduledRefresh(): void` and `scheduleTokenRefresh(expiresIn: number, refreshFn: () => Promise<boolean>): void` (unchanged); `initializeAuth(): Promise<void>` (unchanged). Nothing from other tasks.
- Produces: no new exports. Behavioral contract only (siblings/reviewers may rely on it): `refreshAccessToken()` clears `user`/`isAuthenticated` and cancels the scheduled refresh ONLY on HTTP 401/403; on 429/5xx/network it returns `false` with state and the scheduled proactive refresh left intact. `fetchUser` no longer clears auth state in its refresh-failed else-branch (it only sets `isLoading: false`; `refreshAccessToken` has already decided).

- [ ] **Step 1: Write the failing test — new dedicated suite for `refreshAccessToken` status branching.** Create `frontend/src/stores/authStore.refreshAccessToken.test.ts` with exactly this content (the `vi.mock` scaffolding, `mockUser` fixture, and beforeEach/afterEach reset mirror `authStore.initializeAuth.test.ts` byte-for-byte where applicable). `cancelScheduledRefresh` is module-private, so its semantics are asserted indirectly via fake timers + fetch call counts (the last two cases) — this IS cleanly observable, no faking needed:

```typescript
/**
 * refreshAccessToken — status-aware failure handling (Phase A, item A8).
 *
 * A refresh failure is only a real logout when the backend says the refresh
 * token is invalid (401/403). Transient failures — 429 (the backend auth tier
 * is rate-limited to 10/min), 5xx, network — must leave the session AND the
 * scheduled proactive refresh untouched, so the un-cancelled timer plus the
 * reactive 401 retry in services/api.ts can recover the session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

vi.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:8001',
  isProduction: false,
  isLocalhostApi: false,
}));

vi.mock('../services/api', () => ({
  storeCSRFTokenFromResponse: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    scope: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

import { useAuthStore } from './authStore';

const mockUser: User = {
  id: 'dev-member-user',
  discordId: '1234567890',
  discordUsername: 'DevMember',
  displayName: 'DevMember',
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function errorResponse(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tokenOkResponse(): Response {
  return new Response(
    JSON.stringify({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * When the proactive refresh timer fires for expiresIn=3600:
 * (3600 - REFRESH_BUFFER_SECONDS 60) * 1000.
 */
const PROACTIVE_REFRESH_MS = 3_540_000;

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.persist.clearStorage();
    // Pre-seed an authenticated session so "cleared" vs "kept" is observable.
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      authInitialized: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears auth state and returns false on 401 (refresh token invalid)', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('clears auth state and returns false on 403', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(403, 'Forbidden'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('keeps auth state and returns false on 429 (rate limited)', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(429, 'Rate limit exceeded'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('keeps auth state and returns false on 500', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('keeps auth state and returns false when fetch rejects (network error)', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('leaves the scheduled proactive refresh pending after a transient (429) failure', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      // 1: successful refresh — schedules the proactive timer
      .mockResolvedValueOnce(tokenOkResponse())
      // 2: reactive refresh call hits the rate limit
      .mockResolvedValueOnce(errorResponse(429, 'Rate limit exceeded'))
      // 3: the surviving proactive timer fires and retries
      .mockResolvedValueOnce(tokenOkResponse());
    vi.stubGlobal('fetch', fetchMock);

    await useAuthStore.getState().refreshAccessToken();
    const transient = await useAuthStore.getState().refreshAccessToken();

    expect(transient).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // The proactive timer scheduled by the first success must survive the 429
    // (cancelScheduledRefresh must NOT have been called) and fire a 3rd fetch.
    await vi.advanceTimersByTimeAsync(PROACTIVE_REFRESH_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('cancels the scheduled proactive refresh on 401', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      // 1: successful refresh — schedules the proactive timer
      .mockResolvedValueOnce(tokenOkResponse())
      // 2: real auth failure — must cancel the timer
      .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    await useAuthStore.getState().refreshAccessToken();
    await useAuthStore.getState().refreshAccessToken();

    // The cancelled timer must NOT fire a third refresh attempt.
    await vi.advanceTimersByTimeAsync(PROACTIVE_REFRESH_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** From `frontend/`:

```bash
pnpm test src/stores/authStore.refreshAccessToken.test.ts
```

Expected: **4 failures, 3 passes**. The three passing cases (`401 …`, `403 …`, `cancels the scheduled proactive refresh on 401`) are regression pins — the current code clears state and cancels on *everything*, so they already hold. The four failures pin the bug:
- `keeps auth state and returns false on 429 (rate limited)` — `AssertionError: expected null to deeply equal { id: 'dev-member-user', … }` (current catch nulls `user`)
- `keeps auth state and returns false on 500` — same signature
- `keeps auth state and returns false when fetch rejects (network error)` — same signature
- `leaves the scheduled proactive refresh pending after a transient (429) failure` — `AssertionError: expected false to be true` on `isAuthenticated` (and the fetch count would be 2, not 3)

- [ ] **Step 3: Implement — status-aware branching in `refreshAccessToken`.** In `frontend/src/stores/authStore.ts`, replace the entire function body. The success path (CSRF capture, `TokenResponse` parse, `scheduleTokenRefresh`, `return true`) and the singleton-`refreshPromise` mechanics stay byte-identical; only the failure handling changes. The JSDoc above the function (authStore.ts:411-424) makes no claim about failure behavior and stays untouched.

Current (authStore.ts:425-470):

```typescript
      refreshAccessToken: async () => {
        // If a refresh is already in progress, return the existing promise
        // This prevents multiple concurrent refresh requests from hitting rate limits
        if (refreshPromise) {
          return refreshPromise;
        }

        // Create and store the refresh promise
        refreshPromise = (async () => {
          try {
            // Call refresh endpoint directly - avoid authRequest to prevent infinite loop
            const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
            });

            if (!response.ok) {
              throw new Error('Refresh failed');
            }

            // Capture CSRF token from response header for cross-domain scenarios
            storeCSRFTokenFromResponse(response);

            // Parse response to get new token expiry
            const tokenResponse: TokenResponse = await response.json();

            // Schedule next proactive refresh before the new token expires
            scheduleTokenRefresh(tokenResponse.expiresIn, get().refreshAccessToken);

            return true;
          } catch {
            // Refresh failed - cancel any scheduled refresh and log out user
            cancelScheduledRefresh();
            set({
              user: null,
              isAuthenticated: false,
            });
            return false;
          } finally {
            // Clear the promise so future refreshes can proceed
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },
```

Replace with:

```typescript
      refreshAccessToken: async () => {
        // If a refresh is already in progress, return the existing promise
        // This prevents multiple concurrent refresh requests from hitting rate limits
        if (refreshPromise) {
          return refreshPromise;
        }

        // Create and store the refresh promise
        refreshPromise = (async () => {
          try {
            // Call refresh endpoint directly - avoid authRequest to prevent infinite loop
            const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
            });

            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                // Real auth failure: the refresh token is expired/invalid.
                // Cancel the proactive refresh and log the user out.
                cancelScheduledRefresh();
                set({
                  user: null,
                  isAuthenticated: false,
                });
              }
              // Transient failure (429 rate limit, 5xx): leave the session and
              // the scheduled proactive refresh intact — the un-cancelled timer
              // plus the reactive 401 retry in services/api.ts will recover.
              return false;
            }

            // Capture CSRF token from response header for cross-domain scenarios
            storeCSRFTokenFromResponse(response);

            // Parse response to get new token expiry
            const tokenResponse: TokenResponse = await response.json();

            // Schedule next proactive refresh before the new token expires
            scheduleTokenRefresh(tokenResponse.expiresIn, get().refreshAccessToken);

            return true;
          } catch {
            // Network failure (fetch rejected): transient by definition —
            // return false without touching state or the scheduled refresh
            return false;
          } finally {
            // Clear the promise so future refreshes can proceed
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },
```

- [ ] **Step 4: Run the new suite, verify all 7 pass.** From `frontend/`:

```bash
pnpm test src/stores/authStore.refreshAccessToken.test.ts
```

Expected: 7 passed, 0 failed.

- [ ] **Step 5: Write the failing test — initializeAuth third case (pins the `fetchUser` else-branch fix at the real app-load repro path).** In `frontend/src/stores/authStore.initializeAuth.test.ts`, insert the new case after the existing second test and before the closing `});` of the describe block.

Current (authStore.initializeAuth.test.ts:119-124 — end of the second test and of the describe block):

```typescript
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.authInitialized).toBe(true);
  });
});
```

Replace with:

```typescript
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.authInitialized).toBe(true);
  });

  it('retains a persisted session when the refresh call is rate-limited (429)', async () => {
    // Simulate app load with a persisted session: zustand persist only stores
    // `user` (isAuthenticated is derived, never persisted, so it starts false).
    useAuthStore.setState({ user: mockUser, isAuthenticated: false });

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    await initializeAuth();

    const state = useAuthStore.getState();
    // The transient 429 must NOT force a logout — the persisted user survives
    // and the reactive 401 retry in services/api.ts recovers the session later.
    expect(state.user).toEqual(mockUser);
    expect(state.isLoading).toBe(false);
    expect(state.authInitialized).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 6: Run it, verify the new case fails and both existing cases pass.** From `frontend/`:

```bash
pnpm test src/stores/authStore.initializeAuth.test.ts
```

Expected: **1 failure, 2 passes**. The new case fails with `AssertionError: expected null to deeply equal { id: 'dev-member-user', … }` — `refreshAccessToken` (fixed in Step 3) now correctly returns false without clearing, but `fetchUser`'s else-branch still force-nulls `user`. The existing `hydrates a valid cookie session…` and `still marks auth as initialized…` (401-then-401) cases must both still pass.

- [ ] **Step 7: Implement — `fetchUser` else-branch stops clearing.** In `frontend/src/stores/authStore.ts`, replace only the refresh-failed else-branch. The retry-catch branch directly above it (authStore.ts:503-511, `logger.error('fetchUser retry failed', …)` + its clearing `set()`) is **deliberately left byte-untouched** — it cannot 429 today (`GET /api/auth/me` has no rate limit) and fixing it needs a status-carrying `authRequest` refactor (recorded as out of scope, plan §4).

Current (authStore.ts:513-520):

```typescript
          } else {
            logger.error('fetchUser refresh failed, clearing auth state');
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
```

Replace with:

```typescript
          } else {
            // refreshAccessToken has already decided what happens to the
            // session: it cleared user/isAuthenticated for a real auth failure
            // (401/403) and left them intact for transient failures
            // (429/5xx/network). Only settle the loading flag here.
            logger.warn('fetchUser refresh failed; session state decided by refreshAccessToken');
            set({ isLoading: false });
          }
```

- [ ] **Step 8: Run both suites, verify all pass.** From `frontend/`:

```bash
pnpm test src/stores/authStore.initializeAuth.test.ts src/stores/authStore.refreshAccessToken.test.ts
```

Expected: 10 passed, 0 failed (3 initializeAuth + 7 refreshAccessToken). Confirm the 401-then-401 case (`still marks auth as initialized when no valid cookie session exists`) still ends with `user` null — a real auth failure still logs out (now cleared by `refreshAccessToken` itself instead of the else-branch).

- [ ] **Step 9: Full verification — authStore is core-shared (both shells), so run the full frontend suite plus the build.** From `frontend/`:

```bash
pnpm test
pnpm build
```

Expected: all vitest tests pass and the build is clean (`tsc -b` is stricter than `tsc --noEmit`). Note: the Playwright smoke suites (legacy + v2, which exercise the auth flows live) are NOT part of `pnpm test` — they run at the Task 15 gate.

- [ ] **Step 10: Commit.** From the repo root:

```bash
git add frontend/src/stores/authStore.ts frontend/src/stores/authStore.refreshAccessToken.test.ts frontend/src/stores/authStore.initializeAuth.test.ts
git commit -m "fix(redesign): phase-a — auth 429 false-logout: refresh failure handling is now status-aware (A8)"
```

---

### Task 10: BYDAY recurrence divergence — picker seeding + engine fix (A9)

The app has three "next occurrence" engines and they disagree exactly when a recurring session's single BYDAY differs from DTSTART's weekday: the frontend `computeNextOccurrence` single-BYDAY fast path (`utils/recurrence.ts:221-243`) never reads the BYDAY value (it advances from DTSTART's own weekday), while the backend engine (`backend/app/services/recurrence.py`) honors BYDAY unconditionally — and the session picker guarantees the mismatch by hardcoding the new-session default to `{'SA'}` regardless of the picked date (`CreateSessionModal.tsx:75-80`), never re-seeding on start-time change. This task fixes both halves: (1) the picker seeds the recurrence day from the chosen start date (re-seeding while the picker is untouched; a dirty flag set on the first manual toggle stops re-seeding; edit flow keeps rule-derived days), and (2) the engine's single-BYDAY path honors `rule.byday` like the multi-day branch and the backend, keeping the O(1) `advanceWeeks` path when BYDAY is empty or already equals DTSTART's weekday. Both touched files are **legacy-shared** (`CreateSessionModal.tsx` is rendered by frozen legacy `ScheduleTab.tsx`/`StaticHomeTab.tsx` AND v2 `Schedule.tsx`; `recurrence.ts` is imported by frozen legacy `SessionCard.tsx:146` plus v2 `Schedule.tsx`/`scheduleWeek.ts`) — these are the enumerated cross-shell bugfixes approved in the spec (skim default §6.2): existing mismatched sessions change to match what Discord/backend already does, which is the correct direction. **Both smoke suites (`frontend/e2e/smoke.spec.ts` and `frontend/e2e/smoke-legacy.spec.ts`) must stay green** — they run at the branch level per the global constraints header. The PR body must include a behavior-change justification paragraph (see the commit step). Two deliberate scope notes: (a) the generalized day-scan now honors `INTERVAL` (Monday-based week index anchored to DTSTART's week, mirroring backend `_advance`) — this also aligns multi-BYDAY `INTERVAL>1` rules with the backend, which previously recurred every week in the frontend; the picker never emits `INTERVAL`, so no picker-created session changes. (b) The third naive engine (`backend/app/services/discord_webhook.py:_next_occurrence_iso`, RSVP-message text only) is out of scope — do not touch it. Standalone task: no dependencies on other tasks.

**Files:**
- Modify: `frontend/src/utils/recurrence.ts` (WEEKLY branch of `computeNextOccurrence`, the single-BYDAY fast path + day-scan region)
- Modify: `frontend/src/components/schedule/CreateSessionModal.tsx` (day-picker seeding: `parseDaysFromRule` default, `getInitialFormState`, `toggleDay`, `handleStartChange`, init effect)
- Test: `frontend/src/utils/recurrence.test.ts` (new divergence + regression cases)
- Test: `frontend/src/components/schedule/CreateSessionModal.test.tsx` (new-session seeding, re-seed, dirty flag, edit-flow cases)
- Test: `backend/tests/test_recurrence.py` (extend: explicit single-BYDAY≠DTSTART oracle pins — backend app code is reference-only, NOT modified)
- Reference only (FROZEN — do not edit): `frontend/src/components/schedule/SessionCard.tsx`, `frontend/src/components/schedule/ScheduleTab.tsx`, `frontend/src/components/schedule/StaticHomeTab.tsx`. Reference only (not frozen, no change needed): `backend/app/services/recurrence.py`, `frontend/src/components/schedule/scheduleWeek.ts`.

**Interfaces:**
- Consumes: `computeNextOccurrence(startTimeIso: string, rruleStr: string | null | undefined, after?: Date, cancelledDates?: ReadonlySet<string>, timezone?: string): Date | null` and module-internal helpers `localWeekday(date: Date, timezone: string): number`, `getZonedParts`, `localToUtcMs`, `addWeeksInTimezoneWallClock` (all already in `recurrence.ts`); `CreateSessionModalProps` and `ScheduleSessionCreate` from `frontend/src/types` (only `title`, `startTime`, `endTime`, `timezone` are required); `toZonedDatetimeLocalValue(isoString: string, timeZone: string): string` from `utils/timezone.ts`; `generate_occurrences` from `app.services.recurrence` (backend oracle). Nothing from other tasks.
- Produces: no new exports. Behavioral contract for reviewers: `computeNextOccurrence` now honors a single explicit BYDAY that differs from DTSTART's weekday (day-scan, backend-parity) and honors `INTERVAL` in the day-scan; module-private helpers `weekdayFromDatetimeLocal(value: string): string | null` and `seedSelectedDays(rule: string | null | undefined, startTimeLocal: string): Set<string>` inside `CreateSessionModal.tsx`.

- [ ] **Step 1: Pin the backend oracle (write the reference tests)** — The backend engine is the semantic oracle for this fix, but `backend/tests/test_recurrence.py` has no explicit single-BYDAY≠DTSTART-weekday case (all its single-BYDAY tests use a DTSTART already on the BYDAY day). Add one section pinning it. **TDD exception, called out explicitly:** these tests pass immediately with NO backend change — they pin existing correct behavior as the oracle; there is no backend implementation step. Append at the very end of `backend/tests/test_recurrence.py` (after the last test, `test_next_occurrence_non_recurring_legacy_utc_cancellation`, which ends the file at line 654):

```python


# ──────────────────────────────────────────────────────────────────────────────
# Single BYDAY diverging from DTSTART's weekday (oracle pins for frontend A9 fix)
# ──────────────────────────────────────────────────────────────────────────────


def test_weekly_single_byday_differs_from_dtstart_weekday():
    """DTSTART is a Thursday but BYDAY=SA — occurrences must land on Saturday.

    Oracle pin for the frontend engine fix (Phase A / A9): a single explicit
    BYDAY is honored even when it differs from DTSTART's own weekday.
    """
    # 2020-01-02 is a Thursday; the Saturday of that week is 2020-01-04.
    occs = generate_occurrences(
        "2020-01-02T20:00:00+00:00",
        "2020-01-02T23:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=SA",
        after=datetime(2020, 1, 1, tzinfo=timezone.utc),
        count=3,
    )
    assert [o.occurrence_date for o in occs] == ["2020-01-04", "2020-01-11", "2020-01-18"]
    for o in occs:
        assert datetime.fromisoformat(o.start_time).weekday() == 5, "not a Saturday"


def test_weekly_single_byday_divergent_interval_2():
    """INTERVAL=2 with a divergent single BYDAY: weeks are Monday-based and
    anchored to DTSTART's week — Jan 4 (week 0), then Jan 18 (week 2), Feb 1 (week 4).
    """
    occs = generate_occurrences(
        "2020-01-02T20:00:00+00:00",  # Thursday
        "2020-01-02T23:00:00+00:00",
        "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA",
        after=datetime(2020, 1, 5, tzinfo=timezone.utc),  # past the first Saturday
        count=2,
    )
    assert [o.occurrence_date for o in occs] == ["2020-01-18", "2020-02-01"]


def test_weekly_single_byday_divergent_with_timezone():
    """Thu Jan 15 2026 7 PM PST DTSTART (= Fri 03:00 UTC) with BYDAY=SA must
    produce Saturday-local occurrences: Sat Jan 17 7 PM PST = Sun Jan 18 03:00 UTC,
    crossing the UTC day boundary.
    """
    occs = generate_occurrences(
        "2026-01-16T03:00:00+00:00",  # Thu Jan 15 2026 7 PM PST (UTC-8, no DST in Jan)
        "2026-01-16T06:00:00+00:00",
        "FREQ=WEEKLY;BYDAY=SA",
        after=datetime(2026, 1, 14, tzinfo=timezone.utc),
        count=2,
        timezone_name="America/Los_Angeles",
    )
    assert [o.occurrence_date for o in occs] == ["2026-01-17", "2026-01-24"]
    assert occs[0].start_time == "2026-01-18T03:00:00+00:00"
```

- [ ] **Step 2: Run the backend oracle tests, verify they PASS** — (Git Bash, from repo root)

```bash
cd backend && source venv/Scripts/activate && pytest tests/test_recurrence.py -q
```

Expected: all tests pass, including the three new ones (`41 passed` — 38 existing + 3 new). If any NEW test fails, STOP: the oracle derivation is wrong — do not proceed to the frontend fix; re-check the expected dates against `_advance`/`_advance_local` (`backend/app/services/recurrence.py:120-169`) and the seeding block (`:244-271`).

- [ ] **Step 3: Write the failing frontend engine tests** — In `frontend/src/utils/recurrence.test.ts`, insert a new describe block. The suite uses no fixtures beyond the `FIXED_AFTER` const (line 6) — plain `computeNextOccurrence` calls with ISO strings, matching the existing style.

Current (recurrence.test.ts:239, unique anchor):
```ts
  describe('addWeeksInTimezoneWallClock', () => {
```

Replace with:
```ts
  describe('WEEKLY rrule — single BYDAY diverging from DTSTART weekday (backend parity)', () => {
    // Oracle: backend/app/services/recurrence.py honors BYDAY unconditionally.
    // Pinned by backend/tests/test_recurrence.py::test_weekly_single_byday_differs_from_dtstart_weekday
    // and the two tests after it. Expected values below are the backend's outputs.
    it('UTC: BYDAY=SA with a Thursday DTSTART lands on Saturday, not Thursday', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu
      const rrule = 'FREQ=WEEKLY;BYDAY=SA';
      const result = computeNextOccurrence(start, rrule, FIXED_AFTER);
      // Saturday of DTSTART's week = 2020-01-04 (backend oracle), not Thu 2020-01-02
      expect(result?.toISOString()).toBe('2020-01-04T20:00:00.000Z');
    });

    it('UTC: advances week by week on the BYDAY weekday', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu
      const rrule = 'FREQ=WEEKLY;BYDAY=SA';
      const after = new Date('2020-01-05T00:00:00Z'); // Sunday, past the first Saturday
      const result = computeNextOccurrence(start, rrule, after);
      expect(result?.toISOString()).toBe('2020-01-11T20:00:00.000Z');
    });

    it('timezone crossing a UTC day boundary: Thu 7 PM PST DTSTART with BYDAY=SA lands on Saturday local', () => {
      // Thu Jan 15 2026 7 PM PST = 2026-01-16T03:00:00Z (Friday UTC).
      // BYDAY=SA must resolve to Sat Jan 17 7 PM PST = 2026-01-18T03:00:00Z.
      const start = '2026-01-16T03:00:00Z';
      const rrule = 'FREQ=WEEKLY;BYDAY=SA';
      const after = new Date('2026-01-14T00:00:00Z');
      const result = computeNextOccurrence(start, rrule, after, undefined, 'America/Los_Angeles');
      expect(result?.toISOString()).toBe('2026-01-18T03:00:00.000Z');
    });

    it('INTERVAL=2 divergent single BYDAY only lands in on-interval weeks (Mon-based, anchored to DTSTART week)', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu; first Saturday hit is Jan 4 (week 0)
      const rrule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA';
      const after = new Date('2020-01-05T00:00:00Z'); // past Jan 4
      const result = computeNextOccurrence(start, rrule, after);
      // Jan 11 is week 1 (off-interval) — next hit is Jan 18 (week 2), per backend oracle
      expect(result?.toISOString()).toBe('2020-01-18T20:00:00.000Z');
    });

    it('skips a cancelled divergent occurrence and returns the following week', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu
      const rrule = 'FREQ=WEEKLY;BYDAY=SA';
      const cancelled = new Set(['2020-01-04']);
      const result = computeNextOccurrence(start, rrule, FIXED_AFTER, cancelled);
      expect(result?.toISOString()).toBe('2020-01-11T20:00:00.000Z');
    });

    it('regression: empty BYDAY still recurs on DTSTART weekday (fast path)', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu
      const rrule = 'FREQ=WEEKLY';
      const after = new Date('2020-01-06T00:00:00Z'); // Monday
      const result = computeNextOccurrence(start, rrule, after);
      expect(result?.toISOString()).toBe('2020-01-09T20:00:00.000Z');
    });

    it('regression: single BYDAY equal to DTSTART weekday gives the same result as before', () => {
      const start = '2020-01-02T20:00:00Z'; // Thu
      const rrule = 'FREQ=WEEKLY;BYDAY=TH';
      const after = new Date('2020-01-06T00:00:00Z'); // Monday
      const result = computeNextOccurrence(start, rrule, after);
      expect(result?.toISOString()).toBe('2020-01-09T20:00:00.000Z');
    });
  });

  describe('addWeeksInTimezoneWallClock', () => {
```

- [ ] **Step 4: Run the engine tests, verify the expected failures** — (from `frontend/`)

```bash
pnpm test src/utils/recurrence.test.ts
```

Expected: exactly 5 of the 7 new tests FAIL against the current fast path, with these signatures (the two `regression:` tests pass — they pin behavior that must NOT change):
- `UTC: BYDAY=SA with a Thursday DTSTART…` → expected `'2020-01-04T20:00:00.000Z'`, received `'2020-01-02T20:00:00.000Z'` (Thursday returned, BYDAY ignored)
- `UTC: advances week by week…` → expected `'2020-01-11…'`, received `'2020-01-09T20:00:00.000Z'`
- `timezone crossing a UTC day boundary…` → expected `'2026-01-18…'`, received `'2026-01-16T03:00:00.000Z'`
- `INTERVAL=2 divergent…` → expected `'2020-01-18…'`, received `'2020-01-16T20:00:00.000Z'`
- `skips a cancelled divergent occurrence…` → expected `'2020-01-11…'`, received `'2020-01-02T20:00:00.000Z'`

All pre-existing tests still pass. If a different set fails, STOP and re-check the test code against this plan before touching the implementation.

- [ ] **Step 5: Implement the engine fix** — Replace the entire single-BYDAY fast path + day-scan region of the WEEKLY branch in `frontend/src/utils/recurrence.ts`. The fast path is kept for `byday.length === 0` and for a single BYDAY that already equals DTSTART's weekday (computed local when `timezone` is given, UTC otherwise — the same way the day-scan matches candidates); anything else falls into the day-scan, now generalized to `length >= 1` and gated on the rule's `INTERVAL` (Monday-based week index anchored to DTSTART's week, mirroring backend `_advance`: `base = current + interval weeks; week_start = base - base.weekday()`).

Current (recurrence.ts:221-279 — quote is verbatim and unique):
```ts
    if (rule.byday.length <= 1) {
      // Fast path: single (or missing) BYDAY.
      // When timezone is provided, advance by local calendar weeks to preserve
      // the wall-clock time across DST (e.g. "every Thu 7 PM" stays 7 PM after
      // spring-forward). Without timezone, fall back to naïve 7×DAY_MS advance.
      const advanceWeeks = (d: Date): Date => {
        if (timezone) {
          return new Date(addWeeksInTimezoneWallClock(d.toISOString(), rule.interval, timezone));
        }
        return new Date(d.getTime() + rule.interval * 7 * DAY_MS);
      };

      const candidate = new Date(dtstart.getTime());
      while (candidate.getTime() <= afterMs) {
        candidate.setTime(advanceWeeks(candidate).getTime());
      }
      // Skip cancelled occurrences (guard: max 104 weeks ≈ 2 years)
      for (let skip = 0; skip < 104; skip++) {
        if (!isCancelled(candidate)) return candidate;
        candidate.setTime(advanceWeeks(candidate).getTime());
      }
      return null;
    }

    // Multiple BYDAY: scan days to find the next matching weekday.
    // When timezone is provided, scan local calendar dates at the session's
    // wall-clock time so 7 PM CDT (midnight UTC) stays Thursday, not Friday,
    // and the local time is preserved across DST transitions.
    if (timezone) {
      const { year: sy, month: sm, day: sd, hour, minute, second } = getZonedParts(
        dtstart.toISOString(), timezone,
      );
      let y = sy, mo = sm, d = sd;
      for (let i = 0; i < 730; i++) {
        const utcMs = localToUtcMs(y, mo, d, hour, minute, second, timezone);
        if (utcMs > afterMs) {
          const candidate = new Date(utcMs);
          if (rule.byday.includes(localWeekday(candidate, timezone))) {
            if (!isCancelled(candidate)) return candidate;
          }
        }
        // Advance local date by one calendar day (Date.UTC handles month/year overflow)
        const next = new Date(Date.UTC(y, mo - 1, d + 1));
        y = next.getUTCFullYear(); mo = next.getUTCMonth() + 1; d = next.getUTCDate();
      }
      return null;
    }

    // No timezone: UTC-naïve day-by-day scan
    const candidate = new Date(dtstart.getTime());
    for (let i = 0; i < 730; i++) {
      if (candidate.getTime() > afterMs) {
        if (rule.byday.includes(candidate.getUTCDay())) {
          if (!isCancelled(candidate)) return new Date(candidate.getTime());
        }
      }
      candidate.setTime(candidate.getTime() + DAY_MS);
    }
    return null;
```

Replace with:
```ts
    // DTSTART's weekday, computed the same way the day-scan matches candidates:
    // local weekday when a timezone is provided, UTC weekday otherwise.
    const dtstartWeekday = timezone ? localWeekday(dtstart, timezone) : dtstart.getUTCDay();

    if (rule.byday.length === 0 || (rule.byday.length === 1 && rule.byday[0] === dtstartWeekday)) {
      // Fast O(1) path: no BYDAY (recur on dtstart's own weekday), or a single
      // BYDAY that already equals dtstart's weekday — advancing whole weeks
      // from dtstart always lands on the right day.
      // When timezone is provided, advance by local calendar weeks to preserve
      // the wall-clock time across DST (e.g. "every Thu 7 PM" stays 7 PM after
      // spring-forward). Without timezone, fall back to naïve 7×DAY_MS advance.
      const advanceWeeks = (d: Date): Date => {
        if (timezone) {
          return new Date(addWeeksInTimezoneWallClock(d.toISOString(), rule.interval, timezone));
        }
        return new Date(d.getTime() + rule.interval * 7 * DAY_MS);
      };

      const candidate = new Date(dtstart.getTime());
      while (candidate.getTime() <= afterMs) {
        candidate.setTime(advanceWeeks(candidate).getTime());
      }
      // Skip cancelled occurrences (guard: max 104 weeks ≈ 2 years)
      for (let skip = 0; skip < 104; skip++) {
        if (!isCancelled(candidate)) return candidate;
        candidate.setTime(advanceWeeks(candidate).getTime());
      }
      return null;
    }

    // BYDAY divergent from DTSTART's weekday, or multiple BYDAY: scan days to
    // find the next matching weekday. This honors an explicit BYDAY exactly like
    // the backend engine (backend/app/services/recurrence.py) — the previous
    // single-BYDAY fast path silently recurred on dtstart's own weekday instead.
    // INTERVAL is honored by only accepting weeks whose Monday-based index from
    // dtstart's week is a multiple of the interval (backend _advance semantics:
    // base = current + interval weeks; week_start = base - base.weekday()).
    const dtstartDaysFromMonday = (dtstartWeekday + 6) % 7;
    const inIntervalWeek = (daysFromDtstart: number): boolean =>
      Math.floor((dtstartDaysFromMonday + daysFromDtstart) / 7) % rule.interval === 0;

    // When timezone is provided, scan local calendar dates at the session's
    // wall-clock time so 7 PM CDT (midnight UTC) stays Thursday, not Friday,
    // and the local time is preserved across DST transitions.
    if (timezone) {
      const { year: sy, month: sm, day: sd, hour, minute, second } = getZonedParts(
        dtstart.toISOString(), timezone,
      );
      let y = sy, mo = sm, d = sd;
      for (let i = 0; i < 730; i++) {
        const utcMs = localToUtcMs(y, mo, d, hour, minute, second, timezone);
        if (utcMs > afterMs && inIntervalWeek(i)) {
          const candidate = new Date(utcMs);
          if (rule.byday.includes(localWeekday(candidate, timezone))) {
            if (!isCancelled(candidate)) return candidate;
          }
        }
        // Advance local date by one calendar day (Date.UTC handles month/year overflow)
        const next = new Date(Date.UTC(y, mo - 1, d + 1));
        y = next.getUTCFullYear(); mo = next.getUTCMonth() + 1; d = next.getUTCDate();
      }
      return null;
    }

    // No timezone: UTC-naïve day-by-day scan
    const candidate = new Date(dtstart.getTime());
    for (let i = 0; i < 730; i++) {
      if (candidate.getTime() > afterMs && inIntervalWeek(i)) {
        if (rule.byday.includes(candidate.getUTCDay())) {
          if (!isCancelled(candidate)) return new Date(candidate.getTime());
        }
      }
      candidate.setTime(candidate.getTime() + DAY_MS);
    }
    return null;
```

Consistency notes for the implementer (do not skip): in the timezone path `i` counts local calendar days elapsed from dtstart's local date and `dtstartWeekday` is the local weekday — the pair is consistent; in the UTC path `i` counts UTC days and `dtstartWeekday` is `getUTCDay()` — also consistent. `rule.interval` is always `>= 1` (clamped in `parseRRule`), so `% rule.interval` is safe, and interval=1 makes `inIntervalWeek` always true — the multi-BYDAY interval=1 behavior (everything the picker creates) is byte-identical to today.

- [ ] **Step 6: Run the engine tests, verify all pass** — (from `frontend/`)

```bash
pnpm test src/utils/recurrence.test.ts
```

Expected: the full file passes (all pre-existing tests — single-BYDAY-matched, multi-BYDAY, DST wall-clock, legacy UTC-key cancellation — plus the 7 new ones).

- [ ] **Step 7: Write the failing picker-seeding tests** — In `frontend/src/components/schedule/CreateSessionModal.test.tsx`, reuse the suite's existing scaffolding: the `renderModal(props?)` helper (line 45), the `baseSession` fixture (line 24, `recurrenceRule: 'FREQ=WEEKLY;BYDAY=SA,SU'`), `fireEvent`/`screen`, day buttons asserted via `className` containing `bg-accent` (the suite's established pattern), and the `ScheduleSessionCreate` type already imported at line 22. Date facts used: 2026-07-09 is a Thursday, 2026-07-10 a Friday; `2026-07-09T11:00:00Z` = Thu Jul 9 2026 8 PM JST (same local date in Asia/Tokyo). Append the new tests inside the `describe('CreateSessionModal', …)` block.

Current (CreateSessionModal.test.tsx:101-110 — the last test, unique anchor):
```ts
  it('respects trackAvailability toggle', () => {
    renderModal({ editSession: { ...baseSession, trackAvailability: true } });

    expect(screen.getByText('Track availability')).toBeInTheDocument();
    expect(screen.getByText(/Members are expected to mark/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Track availability'));
    expect(screen.getByText(/fixed sessions where attendance is expected/)).toBeInTheDocument();
  });
});
```

Replace with:
```ts
  it('respects trackAvailability toggle', () => {
    renderModal({ editSession: { ...baseSession, trackAvailability: true } });

    expect(screen.getByText('Track availability')).toBeInTheDocument();
    expect(screen.getByText(/Members are expected to mark/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Track availability'));
    expect(screen.getByText(/fixed sessions where attendance is expected/)).toBeInTheDocument();
  });

  it('seeds the recurrence day from the chosen start date for a new session', () => {
    renderModal();

    fireEvent.change(screen.getByTestId('session-start-input'), {
      target: { value: '2026-07-09T20:00' }, // Thursday
    });
    fireEvent.click(screen.getByText('Recurring weekly'));

    expect(screen.getByRole('button', { name: 'Thu' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Sat' }).className).not.toContain('bg-accent');
  });

  it('re-seeds the day when the start date changes while the picker is untouched', () => {
    renderModal();
    fireEvent.click(screen.getByText('Recurring weekly'));

    const startInput = screen.getByTestId('session-start-input');
    fireEvent.change(startInput, { target: { value: '2026-07-09T20:00' } }); // Thursday
    expect(screen.getByRole('button', { name: 'Thu' }).className).toContain('bg-accent');

    fireEvent.change(startInput, { target: { value: '2026-07-10T20:00' } }); // Friday
    expect(screen.getByRole('button', { name: 'Fri' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Thu' }).className).not.toContain('bg-accent');
  });

  it('stops re-seeding after the user manually toggles a day', () => {
    renderModal();
    fireEvent.click(screen.getByText('Recurring weekly'));

    const startInput = screen.getByTestId('session-start-input');
    fireEvent.change(startInput, { target: { value: '2026-07-09T20:00' } }); // Thursday → TH seeded
    fireEvent.click(screen.getByRole('button', { name: 'Mon' })); // manual pick → picker is dirty

    fireEvent.change(startInput, { target: { value: '2026-07-10T20:00' } }); // Friday — must NOT re-seed

    expect(screen.getByRole('button', { name: 'Thu' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Mon' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Fri' }).className).not.toContain('bg-accent');
  });

  it('seeds from an initialDraft start date on open', () => {
    const draft: ScheduleSessionCreate = {
      title: 'Prog Night',
      startTime: '2026-07-09T11:00:00Z', // Thu Jul 9 2026 8 PM JST
      endTime: '2026-07-09T14:00:00Z',
      timezone: 'Asia/Tokyo',
      isRecurring: true,
      recurrenceRule: null,
    };
    renderModal({ initialDraft: draft });

    expect(screen.getByRole('button', { name: 'Thu' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Sat' }).className).not.toContain('bg-accent');
  });

  it('keeps rule-derived days when editing, even after the start date changes', () => {
    renderModal({ editSession: baseSession }); // BYDAY=SA,SU

    fireEvent.change(screen.getByTestId('session-start-input'), {
      target: { value: '2026-07-09T20:00' }, // Thursday
    });

    expect(screen.getByRole('button', { name: 'Sat' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Sun' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Thu' }).className).not.toContain('bg-accent');
  });
});
```

- [ ] **Step 8: Run the modal tests, verify the expected failures** — (from `frontend/`)

```bash
pnpm test src/components/schedule/CreateSessionModal.test.tsx
```

Expected: the first four new tests FAIL — in each, the `Thu`/`Fri` button className does not contain `bg-accent` (the current code always seeds `{'SA'}` and never re-seeds), e.g. `expect(received).toContain('bg-accent')` failing on the `Thu` assertion. The fifth new test (`keeps rule-derived days when editing…`) PASSES already — it is a regression pin for the edit flow that must keep passing after the change. All five pre-existing tests still pass.

- [ ] **Step 9: Implement the picker seeding** — Six small edits to `frontend/src/components/schedule/CreateSessionModal.tsx`, all additive.

Edit 9a — add the helpers between `parseDaysFromRule` and `buildRecurrenceRule`.

Current (CreateSessionModal.tsx:75-82):
```ts
function parseDaysFromRule(rule: string | null | undefined): Set<string> {
  if (!rule) return new Set(['SA']);
  const match = rule.match(/BYDAY=([A-Z,]+)/);
  if (!match) return new Set(['SA']);
  return new Set(match[1].split(','));
}

function buildRecurrenceRule(days: Set<string>): string {
```

Replace with:
```ts
function parseDaysFromRule(rule: string | null | undefined): Set<string> {
  if (!rule) return new Set(['SA']);
  const match = rule.match(/BYDAY=([A-Z,]+)/);
  if (!match) return new Set(['SA']);
  return new Set(match[1].split(','));
}

// JS Date#getUTCDay() order — index 0 = Sunday.
const ICS_WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/**
 * ICS weekday code for a datetime-local value ("YYYY-MM-DDTHH:mm").
 * datetime-local values in this modal are wall-clock in the session's timezone
 * (see toZonedDatetimeLocalValue / fromZonedDatetimeLocalValue), so the calendar
 * date part alone determines the weekday the user sees — parse it directly,
 * UTC-anchored, to avoid browser-local reinterpretation.
 */
function weekdayFromDatetimeLocal(value: string): string | null {
  const [datePart] = value.split('T');
  if (!datePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(parsed.getTime())) return null;
  return ICS_WEEKDAYS[parsed.getUTCDay()];
}

/**
 * Default recurrence days: an existing rule wins (edit flow keeps user intent);
 * otherwise derive from the chosen start date; 'SA' only while start is blank.
 */
function seedSelectedDays(rule: string | null | undefined, startTimeLocal: string): Set<string> {
  if (rule) return parseDaysFromRule(rule);
  const weekday = startTimeLocal ? weekdayFromDatetimeLocal(startTimeLocal) : null;
  return weekday ? new Set([weekday]) : new Set(['SA']);
}

function buildRecurrenceRule(days: Set<string>): string {
```

Edit 9b — seed from the initial start time in `getInitialFormState`.

Current (CreateSessionModal.tsx:110-120):
```ts
function getInitialFormState(editSession?: ScheduleSession | null, initialDraft?: ScheduleSessionCreate | null) {
  const source = editSession ?? initialDraft ?? null;
  const timezone = source?.timezone ?? getBrowserTimezone();
  return {
    title: source?.title ?? '',
    description: source?.description ?? '',
    startTime: source?.startTime ? toZonedDatetimeLocalValue(source.startTime, timezone) : '',
    endTime: source?.endTime ? toZonedDatetimeLocalValue(source.endTime, timezone) : '',
    timezone,
    isRecurring: source?.isRecurring ?? false,
    selectedDays: parseDaysFromRule(source?.recurrenceRule),
```

Replace with:
```ts
function getInitialFormState(editSession?: ScheduleSession | null, initialDraft?: ScheduleSessionCreate | null) {
  const source = editSession ?? initialDraft ?? null;
  const timezone = source?.timezone ?? getBrowserTimezone();
  const startTime = source?.startTime ? toZonedDatetimeLocalValue(source.startTime, timezone) : '';
  return {
    title: source?.title ?? '',
    description: source?.description ?? '',
    startTime,
    endTime: source?.endTime ? toZonedDatetimeLocalValue(source.endTime, timezone) : '',
    timezone,
    isRecurring: source?.isRecurring ?? false,
    selectedDays: seedSelectedDays(source?.recurrenceRule, startTime),
```

Edit 9c — add the dirty ref.

Current (CreateSessionModal.tsx:173):
```ts
  const initializedForRef = useRef<string | null>(null);
```

Replace with:
```ts
  const initializedForRef = useRef<string | null>(null);
  // First manual day toggle stops start-date re-seeding of the picker (new sessions only).
  const daysDirtyRef = useRef(false);
```

Edit 9d — reset the dirty flag when the modal (re)initializes.

Current (CreateSessionModal.tsx:180-182):
```ts
    const sessionKey = editSession?.id ?? initialDraft?.title ?? '__create__';
    if (initializedForRef.current === sessionKey) return;
    initializedForRef.current = sessionKey;
```

Replace with:
```ts
    const sessionKey = editSession?.id ?? initialDraft?.title ?? '__create__';
    if (initializedForRef.current === sessionKey) return;
    initializedForRef.current = sessionKey;
    daysDirtyRef.current = false;
```

Edit 9e — mark the picker dirty on manual toggle.

Current (CreateSessionModal.tsx:208-209):
```ts
  const toggleDay = (day: string) => {
    setSelectedDays((prev) => {
```

Replace with:
```ts
  const toggleDay = (day: string) => {
    daysDirtyRef.current = true;
    setSelectedDays((prev) => {
```

Edit 9f — re-seed on start change while new + untouched.

Current (CreateSessionModal.tsx:266-268):
```ts
  const handleStartChange = (value: string) => {
    setStartTime(value);
    if (value && !endTime) {
```

Replace with:
```ts
  const handleStartChange = (value: string) => {
    setStartTime(value);
    if (!editSession && !daysDirtyRef.current && value) {
      const weekday = weekdayFromDatetimeLocal(value);
      if (weekday) setSelectedDays(new Set([weekday]));
    }
    if (value && !endTime) {
```

- [ ] **Step 10: Run the modal tests, verify all pass** — (from `frontend/`)

```bash
pnpm test src/components/schedule/CreateSessionModal.test.tsx
```

Expected: all 10 tests pass (5 pre-existing + 5 new), including the edit-flow regression pin.

- [ ] **Step 11: Run the full suites of every touched file + consumers + build** — `recurrence.ts`'s actual importers are frozen legacy `SessionCard.tsx`, v2 `Schedule.tsx`/`scheduleWeek.ts`, and `OccurrenceListModal.tsx` (which uses only the untouched `getOccurrenceDateKey*` exports); running the whole schedule component directory covers them all. (from `frontend/`)

```bash
pnpm test src/utils/recurrence.test.ts src/components/schedule
pnpm build
```

Then the backend suite again (Git Bash, from repo root):

```bash
cd backend && source venv/Scripts/activate && pytest tests/test_recurrence.py -q
```

Expected: everything green and `pnpm build` (tsc -b + vite) clean. Contingency (verified NOT to fire at head — every existing consumer fixture has BYDAY matching its DTSTART weekday, so no consumer test changes behavior): if a `Schedule.test.tsx` / `scheduleWeek.test.ts` case fails on a genuinely divergent fixture (single BYDAY ≠ DTSTART weekday now resolving to the BYDAY day, the backend/Discord truth), update ONLY that fixture's expected date to the backend-parity value — never weaken the engine fix. **`SessionCard.test.tsx` is FROZEN (f45a241 restore set) and its fixture is non-divergent (tz UTC, BYDAY=TH on a Thursday DTSTART, stays on the fast path): if it fails, do NOT edit it — STOP and treat the failure as proof your implementation deviated from this plan.** Any other failure likewise means implementation deviation.

- [ ] **Step 12: Commit** — (from repo root; PR body for the branch must include this justification: "Cross-shell bugfix to shared `utils/recurrence.ts` (imported by frozen legacy SessionCard): the single-BYDAY fast path silently ignored the BYDAY value; it now honors it, matching the backend reminder engine and Discord. Existing sessions whose single BYDAY diverges from their start weekday will change their displayed next occurrence to match what Discord/backend already announce — the correct direction. Picker now seeds the recurrence day from the chosen start date, so new sessions no longer create the mismatch.")

```bash
git add frontend/src/utils/recurrence.ts frontend/src/utils/recurrence.test.ts frontend/src/components/schedule/CreateSessionModal.tsx frontend/src/components/schedule/CreateSessionModal.test.tsx backend/tests/test_recurrence.py
git commit -m "fix(redesign): phase-a — A9 BYDAY divergence: seed picker day from start date, honor single BYDAY in frontend engine (backend-parity)"
```

---

### Task 11: Void'd-promise sweep — Groups A+B (14 v2 + 7 legacy-shared sites) (A10)

Sweeps every verified `void <re-throwing store action>` call site in the v2 tree (Group A) plus the same bug class in the legacy-shared `ScheduleIntegrationsPanel.tsx` (Group B). Mechanism: these store actions re-throw after rollback/error-recording, so a void'd call becomes a browser `unhandledrejection` → `errorReporter.ts:36-38` catches it → phantom `POST /api/analytics/errors`. It also fixes the lying **"Link copied to clipboard"** toast in `Roster.tsx`, which fires before/regardless of the clipboard write. Fixes apply the two existing precedent shapes verbatim: **mutation** = `await` in try/catch + `toast.error(err instanceof Error ? err.message : 'Failed to <verb>')` (ScheduleIntegrationsPanel's own guarded handlers `:256-267`/`:286-295`/`:297-334`; Loot.tsx delete handlers); **clipboard** = success toast/message ONLY after the write resolves, error on reject (`Loot.tsx` copyLink `.then(onSuccess, onError)` / `SessionList.tsx:139-146` / `ShellContentStates.tsx:114-127`). For **mount fetches**, the investigation is already done (verify in Step 1): neither `Roster.tsx` nor `Loot.tsx` selects or renders `lootTrackingStore.error` anywhere in their trees (zero `.error` selectors in either file), so a bare `.catch(() => {})` would make failures fully silent — each mount-fetch batch instead gets ONE aggregated `Promise.all(...).catch(() => toast.error(...))` (Promise.all attaches handlers to every member promise, so multiple simultaneous rejections still produce exactly one toast and zero unhandled rejections).

**Execution-order notes (Tasks 2-4 already ran):** Task 2 (A1) rewired `Roster.tsx`'s add-player handler — the grounding's `Roster.tsx:322` `void playerActions.handleAddPlayer()` site **NO LONGER EXISTS in its original form; do NOT re-fix or re-anchor it**. Tasks 2/3 edited other `Roster.tsx` regions and Task 4 (A3) inserted a menu item in `useRosterCardActions.tsx`, so all line numbers below are approximate — **edit by the verbatim string anchors**. Source-file anchors live in regions untouched by Tasks 2-4; the two `Roster.test.tsx` scaffold anchors in Step 2(a)/(f) are written against the **post-Task-2** state of that file (Task 2 extended the RTL import with `fireEvent` and prepended three `mockClear()` lines inside the `beforeEach`).

**DO NOT TOUCH — Group C (verified NOT bugs; the store action does not re-throw, or the site is already guarded):**
- `pages/GroupViewContent.tsx:333,342` `void fetchSplitClear(...)` — splitClearStore.fetchData does not re-throw.
- `components/static-group/StaticHomeTab.tsx:1660` — same store call, safe; file is FROZEN anyway.
- `components/roster/RosterCharacterPanel.tsx:29` `void fetchRegistrations(groupId)` — does not re-throw.
- `components/roster/GearBoard.tsx:159` — `cycle` (:78-88) already try/catches its `onUpdate` call.
- `components/schedule/Schedule.tsx:130,135,294` — fetchSessions/fetchAvailability do not re-throw; `:160` Promise.all has per-item try/catch.
- `pages/ShellContentStates.tsx:240` — handleCopyError already implements the correct pattern.
- `lib/shellPreference.ts:51`, `components/player/PlayerCard.tsx:942` — already `.catch(() => {})`'d (PlayerCard is FROZEN besides).
- `Loot.tsx` mount-effect `void fetchWeekDataTypes(...)` and `refresh()`'s `void fetchTier(...)` — neither store action re-throws; **leave both bare**.

**DO NOT TOUCH — Group D (FROZEN files, report-only; already recorded in the spec §4 deferred list):** `components/player/LodestoneSearchModal.tsx` (12 void'd handler sites), `components/split-clear/SplitClearPlanner.tsx` (4 sites against re-throwing splitClearStore actions — live bug, deferred to its own bugfix-only slice), `components/schedule/ScheduleTab.tsx:75-76` (already caught), `components/schedule/ScheduleUpcomingPanel.tsx:74-75` (stores don't re-throw). If any step appears to require editing one of these, STOP and flag it.

**Group B is fixed in this slice** — `ScheduleIntegrationsPanel.tsx` is legacy-shared (rendered by frozen `ScheduleTab.tsx` AND `SettingsPanel.tsx`, both shells), and this is the enumerated pure bugfix matching the file's OWN in-file precedent, not a surface replacement. It signals success/failure via `setIntegrationMessage(...)` — **NOT toast** — so every Group B fix uses `setIntegrationMessage('Failed to …')`, matching `handleConnectDiscord`/`handleDisconnectDiscord`/`handleSyncAllDiscord`. Both Playwright smoke suites (`frontend/e2e/smoke.spec.ts` + `frontend/e2e/smoke-legacy.spec.ts`) must stay green at the phase gate; the PR body carries the per-site justification block at the end of this task.

**Files:**
- Modify: `frontend/src/components/roster/Roster.tsx` (mount-fetch effect; `handleCopyUrl`; `handlePastePlayer` + its `onPaste` call site)
- Modify: `frontend/src/components/roster/RosterCard.tsx` (`commitName`, `commitJobChange`, `onNameKeyDown` re-prop, toast import)
- Modify: `frontend/src/hooks/useRosterCardActions.tsx` (BiSImportModal `onImport`, Unlink-BiS confirm onClick, toast import)
- Modify: `frontend/src/components/loot/Loot.tsx` (mount-fetch effect; `refresh()` fetchCurrentWeek)
- Modify: `frontend/src/components/schedule/ScheduleIntegrationsPanel.tsx` (LEGACY-SHARED — the 7 enumerated sites ONLY, minimal additive diffs)
- Test: `frontend/src/components/roster/Roster.test.tsx`
- Test: `frontend/src/components/roster/RosterCard.test.tsx`
- Test: `frontend/src/hooks/useRosterCardActions.test.tsx`
- Test: `frontend/src/components/loot/Loot.test.tsx`
- Test: `frontend/src/components/schedule/ScheduleIntegrationsPanel.test.tsx`

**Interfaces:**
- Consumes: `toast.success/error(message: string)` from `stores/toastStore.ts` (already imported in Roster.tsx:55 and Loot.tsx:84; NEW import in RosterCard.tsx and useRosterCardActions.tsx); `RosterCardActions.onUpdate: (updates: Partial<SnapshotPlayer>) => Promise<void> | void` (useRosterCardActions.tsx:85); `usePlayerActions().handleUpdatePlayer: (playerId: string, updates: Partial<SnapshotPlayer>) => Promise<void>`; lootTrackingStore `fetchLootLog/fetchMaterialLog/fetchPageLedger/fetchCurrentWeek` (all re-throw); scheduleStore `updateSettings/sendTestReminder/postSessionPreview/regenerateCalendar/revokeCalendar: (groupId, …) => Promise<void>` (all re-throw). Nothing from other tasks.
- Produces: nothing exported changes. Internal conversions only: `RosterCard.commitName`/`commitJobChange` and `Roster.handlePastePlayer` become `async`; the `onImport`/Unlink onClick callbacks in useRosterCardActions become async closures (still assignable to their `=> void` prop types). New user-visible strings pinned by tests: `"Couldn't copy the link"`, `'Failed to load loot data'`, `'Failed to refresh the week clock'`, and the seven ScheduleIntegrationsPanel `'Failed to …'` messages listed in Steps 19/21 (Cycle E).

---

#### Cycle A — Roster.tsx (4 live sites: mount fetches ×2, copy-url toast, paste)

- [ ] **Step 1: Confirm the mount-fetch investigation finding** (decides `.catch(() => {})` vs `toast.error` per the approved spec). Run from the repo root:

```bash
grep -n "\.error" frontend/src/components/roster/Roster.tsx frontend/src/components/loot/Loot.tsx | grep -v "toast.error" | grep -v "logger.error"
```

Expected output: **no lines selecting a store `error` field** (Loot.tsx's only hits are its own `toast.error`/`logger.error` calls, excluded by the filters — you may see zero lines total). Neither screen renders `lootTrackingStore.error`, so bare-swallow is forbidden; use the aggregated `toast.error` shape. If this grep ever DID show a store-error selector being rendered, you would switch that screen's mount-fetch fix to `.catch(() => {})` — it doesn't, so proceed as written.

- [ ] **Step 2: Write the failing Roster tests.** Edit `frontend/src/components/roster/Roster.test.tsx`:

(a) Extend the RTL import. **Task 2 already added `fireEvent` to this line** — the post-Task-2 current line is (Roster.test.tsx:9):
```tsx
import { render, screen, act, fireEvent } from '@testing-library/react';
```
Replace with (adds only `waitFor`):
```tsx
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
```

(b) Add a mutable clipboard-player slot the hoisted mock reads at call time (same closure mechanics as the suite's existing `setGroupView` consts). Current (Roster.test.tsx:19):
```tsx
const setClipboardPlayer = vi.fn();
```
Replace with:
```tsx
const setClipboardPlayer = vi.fn();
let mockClipboardPlayer: SnapshotPlayer | null = null;
```

(c) Point the `useGroupViewState` mock at it. Current (inside the factory, Roster.test.tsx:31):
```tsx
    clipboardPlayer: null,
```
Replace with:
```tsx
    clipboardPlayer: mockClipboardPlayer,
```

(d) Extend the RosterCard stub so tests can drive the per-player actions (raw `<button>` is fine — design-system rules are off for `**/*.test.tsx`). Current (Roster.test.tsx:65-69):
```tsx
vi.mock('./RosterCard', () => ({
  RosterCard: ({ player }: { player: SnapshotPlayer }) => (
    <div data-testid="roster-card">{player.name}</div>
  ),
}));
```
Replace with:
```tsx
vi.mock('./RosterCard', () => ({
  RosterCard: ({ player, actions }: {
    player: SnapshotPlayer;
    actions: { onCopyUrl?: () => void; onPaste?: () => void };
  }) => (
    <div data-testid="roster-card">
      {player.name}
      <button data-testid={`copy-url-${player.id}`} onClick={() => actions.onCopyUrl?.()}>
        copy url
      </button>
      <button data-testid={`paste-${player.id}`} onClick={() => actions.onPaste?.()}>
        paste
      </button>
    </div>
  ),
}));
```

(e) Add the toast-store import. Current (Roster.test.tsx:77):
```tsx
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
```
Replace with:
```tsx
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useToastStore } from '../../stores/toastStore';
```

(f) Reset clipboard/toast/paste state per test. **Task 2 already prepended three `mockClear()` lines inside this `beforeEach`** (between its opening line and the `pushState` line), so do NOT anchor on a `beforeEach(() => {` + `pushState` two-line block — anchor on the single `pushState` line, which is unique in the file. Current (unique line inside the existing `beforeEach`):
```tsx
  window.history.pushState({}, '', '/group/DEVTST?tab=roster');
```
Replace with (inserts the three new lines immediately after it):
```tsx
  window.history.pushState({}, '', '/group/DEVTST?tab=roster');
  mockClipboardPlayer = null;
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  useToastStore.setState({ toasts: [] });
```

(g) Append this new describe block at the very end of the file (after the closing `});` of `describe('Roster — ?player= deep link', …)`):

```tsx
// A10 void'd-promise sweep: every site below previously void'd a re-throwing
// store action (unhandled rejection → phantom /api/analytics/errors POST), and
// handleCopyUrl toasted "Link copied" before/regardless of the clipboard write.
// Vitest fails the run on genuine unhandled rejections — a free regression guard.
describe("Roster — A10 void'd-promise fixes", () => {
  it('handleCopyUrl: success toast fires only after the clipboard write resolves', async () => {
    let resolveWrite!: () => void;
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => new Promise<void>((res) => { resolveWrite = res; })) },
    });
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One' })]));
    fireEvent.click(screen.getByTestId('copy-url-p1'));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    // Write still pending — the old code toasted success synchronously here.
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(false);
    resolveWrite();
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'success' && t.message === 'Link copied to clipboard',
      )).toBe(true);
    });
  });

  it('handleCopyUrl: a rejected clipboard write shows an error toast and never a success toast', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One' })]));
    fireEvent.click(screen.getByTestId('copy-url-p1'));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === "Couldn't copy the link",
      )).toBe(true);
    });
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(false);
  });

  it('handlePastePlayer: a rejected update surfaces an error toast instead of an unhandled rejection', async () => {
    mockClipboardPlayer = makePlayer({ id: 'src', name: 'Source' });
    playerActions.handleUpdatePlayer.mockRejectedValueOnce(new Error('update failed'));
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One' })]));
    fireEvent.click(screen.getByTestId('paste-p1'));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'update failed',
      )).toBe(true);
    });
  });

  it('mount fetches: rejecting store fetches surface ONE error toast instead of unhandled rejections', async () => {
    useLootTrackingStore.setState({
      fetchLootLog: vi.fn().mockRejectedValue(new Error('boom')),
      fetchCurrentWeek: vi.fn().mockRejectedValue(new Error('boom')),
    });
    renderRoster(makeTier([makePlayer({ id: 'p1', name: 'Tank One' })]));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.filter(
        (t) => t.type === 'error' && t.message === 'Failed to load loot data',
      )).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 3: Run it, verify it fails.** From `frontend/`:

```bash
pnpm test src/components/roster/Roster.test.tsx
```

Expected: the 4 new tests fail — the first with `expected true to be false` (success toast already present while the write is pending), the second/third with `waitFor` timeouts (no error toast ever appears; the second also finds a success toast), the fourth with a `waitFor` timeout **plus** Vitest reporting `Unhandled Rejection: Error: boom`. All pre-existing tests still pass.

- [ ] **Step 4: Implement the Roster.tsx fixes.**

Edit 1 — mount fetches. Current (Roster.tsx:191-196):
```tsx
  useEffect(() => {
    if (group.id && tierId) {
      void fetchLootLog(group.id, tierId);
      void fetchCurrentWeek(group.id, tierId);
    }
  }, [group.id, tierId, fetchLootLog, fetchCurrentWeek]);
```
Replace with:
```tsx
  useEffect(() => {
    if (group.id && tierId) {
      // A10: both fetches re-throw after recording store error state, but this
      // screen never renders lootTrackingStore.error — a bare catch would make
      // failures fully silent, so surface ONE toast for the pair (Promise.all
      // attaches handlers to every member, so nothing escapes unhandled).
      void Promise.all([
        fetchLootLog(group.id, tierId),
        fetchCurrentWeek(group.id, tierId),
      ]).catch(() => toast.error('Failed to load loot data'));
    }
  }, [group.id, tierId, fetchLootLog, fetchCurrentWeek]);
```

Edit 2 — the lying copy toast. Current (Roster.tsx:280-287):
```tsx
  // Copy a deep-link to a player card (replicates GroupViewContent.handleCopyUrl).
  const handleCopyUrl = useCallback((playerId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'roster');
    url.searchParams.set('player', playerId);
    void navigator.clipboard.writeText(url.toString());
    toast.success('Link copied to clipboard');
  }, []);
```
Replace with:
```tsx
  // Copy a deep-link to a player card (replicates GroupViewContent.handleCopyUrl).
  // A10 clipboard shape (Loot.tsx copyLink / SessionList.tsx precedent): success
  // fires only after the write resolves; a rejected write gets an error toast,
  // never a false "Link copied".
  const handleCopyUrl = useCallback((playerId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'roster');
    url.searchParams.set('player', playerId);
    navigator.clipboard.writeText(url.toString()).then(
      () => toast.success('Link copied to clipboard'),
      () => toast.error("Couldn't copy the link"),
    );
  }, []);
```

Edit 3 — paste (mutation shape). Current (Roster.tsx:289-300):
```tsx
  // Paste = overwrite a card's config from the clipboard player (legacy parity).
  const handlePastePlayer = useCallback((playerId: string, source: SnapshotPlayer) => {
    void playerActions.handleUpdatePlayer(playerId, {
      job: source.job,
      role: source.role,
      gear: source.gear,
      tomeWeapon: source.tomeWeapon,
      isSubstitute: source.isSubstitute,
      notes: source.notes,
      bisLink: source.bisLink,
    });
  }, [playerActions]);
```
Replace with:
```tsx
  // Paste = overwrite a card's config from the clipboard player (legacy parity).
  // A10 mutation shape: handleUpdatePlayer chains to tierStore.updatePlayer,
  // which re-throws after rollback — await + toast so a failed paste can't
  // become an unhandled rejection.
  const handlePastePlayer = useCallback(async (playerId: string, source: SnapshotPlayer) => {
    try {
      await playerActions.handleUpdatePlayer(playerId, {
        job: source.job,
        role: source.role,
        gear: source.gear,
        tomeWeapon: source.tomeWeapon,
        isSubstitute: source.isSubstitute,
        notes: source.notes,
        bisLink: source.bisLink,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to paste player');
    }
  }, [playerActions]);
```

Edit 4 — mechanical re-prop forced by Edit 3's async conversion (called out explicitly, no separate test): `handlePastePlayer` now returns `Promise<void>` (it never rejects — it catches internally), so its call site keeps the codebase's `void` convention. Current (Roster.tsx:310):
```tsx
      onPaste: () => { if (clipboardPlayer) handlePastePlayer(player.id, clipboardPlayer); },
```
Replace with:
```tsx
      onPaste: () => { if (clipboardPlayer) void handlePastePlayer(player.id, clipboardPlayer); },
```

`toast` is already imported (Roster.tsx:55) — no import change. Do NOT touch the add-player handler (Task 2/A1 owns it).

- [ ] **Step 5: Run tests, verify pass.** From `frontend/`:

```bash
pnpm test src/components/roster/Roster.test.tsx
```

Expected: all tests pass, zero unhandled-rejection reports.

---

#### Cycle B — RosterCard.tsx (commitName :200, commitJobChange :227)

- [ ] **Step 6: Write the failing RosterCard tests.** Edit `frontend/src/components/roster/RosterCard.test.tsx`:

(a) Extend imports. Current (RosterCard.test.tsx:1):
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
```
Replace with:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```
And current (RosterCard.test.tsx:6):
```tsx
import type { SnapshotPlayer } from '../../types';
```
Replace with:
```tsx
import type { SnapshotPlayer } from '../../types';
import { useToastStore } from '../../stores/toastStore';
```

(b) Reset toasts per test. Current (end of the existing `beforeEach`, RosterCard.test.tsx:23-24):
```tsx
    }))
  );
});
```
Replace with:
```tsx
    }))
  );
  useToastStore.setState({ toasts: [] });
});
```

(c) Append this describe block at the very end of the file:

```tsx
// A10: actions.onUpdate chains to tierStore.updatePlayer, which re-throws after
// rollback — commitName/commitJobChange previously void'd it (unhandled
// rejection → phantom /api/analytics/errors POST + silent failure).
describe("RosterCard — A10 void'd-promise fixes", () => {
  function renderWithActions(rejecting: RosterCardActions) {
    return render(
      <TooltipProvider>
        <RosterCard
          player={makePlayer()}
          userRole="owner"
          currentUserId="u1"
          isAdminAccess={false}
          canManage
          clipboardPlayer={null}
          reorderMode={false}
          groupId="g1"
          tierId="tier1"
          contentType="savage"
          actions={rejecting}
        />
      </TooltipProvider>
    );
  }

  it('commitName: a rejected onUpdate surfaces an error toast instead of an unhandled rejection', async () => {
    const rejecting: RosterCardActions = {
      onUpdate: vi.fn().mockRejectedValue(new Error('rename failed')),
      onCopy: vi.fn(),
      onDuplicate: vi.fn(),
    };
    renderWithActions(rejecting);
    fireEvent.doubleClick(screen.getByText('Tank One'));
    const input = screen.getByLabelText('Player name');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'rename failed',
      )).toBe(true);
    });
  });

  it('commitJobChange: a rejected onUpdate surfaces an error toast instead of an unhandled rejection', async () => {
    const rejecting: RosterCardActions = {
      onUpdate: vi.fn().mockRejectedValue(new Error('job change failed')),
      onCopy: vi.fn(),
      onDuplicate: vi.fn(),
    };
    renderWithActions(rejecting);
    fireEvent.click(screen.getByRole('button', { name: /change job/i }));
    // JobPicker (real, full-picker mode) — pick a different job than PLD.
    fireEvent.click(screen.getByText('WAR'));
    // Card-owned confirm modal → primary action commits.
    fireEvent.click(screen.getByRole('button', { name: 'Change Job' }));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'job change failed',
      )).toBe(true);
    });
  });
});
```

- [ ] **Step 7: Run it, verify it fails.** From `frontend/`:

```bash
pnpm test src/components/roster/RosterCard.test.tsx
```

Expected: both new tests fail with `waitFor` timeouts (no error toast) plus Vitest-reported `Unhandled Rejection: Error: rename failed` / `Error: job change failed`. Pre-existing tests still pass.

- [ ] **Step 8: Implement the RosterCard.tsx fixes.**

Edit 1 — toast import. Current (RosterCard.tsx:40-43):
```tsx
import {
  useRosterCardActions,
  type RosterCardActions,
} from '../../hooks/useRosterCardActions';
```
Replace with:
```tsx
import {
  useRosterCardActions,
  type RosterCardActions,
} from '../../hooks/useRosterCardActions';
import { toast } from '../../stores/toastStore';
```

Edit 2 — commitName (mutation shape; async conversion — `setIsEditingName(false)` moves BEFORE the await so the edit UI still exits immediately, exactly as the old fire-and-forget behaved). Current (RosterCard.tsx:196-202):
```tsx
  const commitName = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== player.name) void actions.onUpdate({ name: trimmed });
    setIsEditingName(false);
  };
```
Replace with:
```tsx
  const commitName = async () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    const trimmed = draftName.trim();
    setIsEditingName(false);
    if (trimmed && trimmed !== player.name) {
      // A10 mutation shape: onUpdate chains to tierStore.updatePlayer, which
      // re-throws after rollback — await + toast so a failed rename can't
      // become an unhandled rejection (phantom /api/analytics/errors POST).
      try {
        await actions.onUpdate({ name: trimmed });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to rename player');
      }
    }
  };
```

Edit 3 — mechanical re-prop forced by Edit 2 (commitName now returns a never-rejecting `Promise<void>`; keep the `void` convention at the expression call site — `onBlur={commitName}` at :313 needs no change, an async handler is a valid `() => void` callback). Current (RosterCard.tsx:205):
```tsx
    if (e.key === 'Enter') commitName();
```
Replace with:
```tsx
    if (e.key === 'Enter') void commitName();
```

Edit 4 — commitJobChange (mutation shape; `setPendingJob(null)` moves BEFORE the await so the confirm modal still closes immediately, as before). Current (RosterCard.tsx:221-229):
```tsx
  const commitJobChange = () => {
    if (!pendingJob) return;
    const nextRole = getRoleForJob(pendingJob);
    const updates: Partial<SnapshotPlayer> = { job: pendingJob };
    if (nextRole) updates.role = nextRole;
    if (jobChangeMode === 'unlink') updates.bisLink = '';
    void actions.onUpdate(updates);
    setPendingJob(null);
  };
```
Replace with:
```tsx
  const commitJobChange = async () => {
    if (!pendingJob) return;
    const nextRole = getRoleForJob(pendingJob);
    const updates: Partial<SnapshotPlayer> = { job: pendingJob };
    if (nextRole) updates.role = nextRole;
    if (jobChangeMode === 'unlink') updates.bisLink = '';
    setPendingJob(null);
    // A10 mutation shape — see commitName.
    try {
      await actions.onUpdate(updates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change job');
    }
  };
```

(`onClick={commitJobChange}` at :476 needs no change — an async handler is a valid MouseEventHandler.)

- [ ] **Step 9: Run tests, verify pass.** From `frontend/`:

```bash
pnpm test src/components/roster/RosterCard.test.tsx
```

---

#### Cycle C — useRosterCardActions.tsx (BiSImportModal onImport :447, Unlink-BiS confirm :632)

- [ ] **Step 10: Write the failing hook tests.** Edit `frontend/src/hooks/useRosterCardActions.test.tsx`:

(a) Extend imports. Current (useRosterCardActions.test.tsx:9-10):
```tsx
import { renderHook, act, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
```
Replace with:
```tsx
import { renderHook, act, render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
```
And current (useRosterCardActions.test.tsx:12):
```tsx
import type { ContextMenuItem } from '../components/ui';
```
Replace with:
```tsx
import type { ContextMenuItem } from '../components/ui';
import { useToastStore } from '../stores/toastStore';
```

(b) Upgrade the BiSImportModal stub to a props-capturing mock (the Loot.test.tsx `vi.hoisted` capture-bucket precedent; keeps the `data-testid="bis-import"` contract the existing open-modal test asserts). Current (useRosterCardActions.test.tsx:31-33):
```tsx
vi.mock('../components/player/BiSImportModal', () => ({
  BiSImportModal: (p: { isOpen: boolean }) => (p.isOpen ? <div data-testid="bis-import" /> : null),
}));
```
Replace with:
```tsx
const { bisImportPropsLog } = vi.hoisted(() => ({
  bisImportPropsLog: [] as Array<Record<string, unknown>>,
}));
vi.mock('../components/player/BiSImportModal', () => ({
  BiSImportModal: (p: { isOpen: boolean } & Record<string, unknown>) => {
    bisImportPropsLog.push(p);
    return p.isOpen ? <div data-testid="bis-import" /> : null;
  },
}));
```

(c) Add a suite-level `beforeEach` immediately after the `makePlayer` helper's closing line (`  }) as unknown as SnapshotPlayer;`) and before the `labelOrHeader` comment block:
```tsx
beforeEach(() => {
  bisImportPropsLog.length = 0;
  useToastStore.setState({ toasts: [] });
});
```

(d) Append this describe block at the very end of the file:

```tsx
// A10: both sites void'd actions.onUpdate, which re-throws (tierStore rollback
// contract) — a rejected import/unlink escaped as an unhandled rejection.
describe("useRosterCardActions — A10 void'd-promise fixes", () => {
  it('BiS import onImport: a rejected onUpdate surfaces an error toast instead of an unhandled rejection', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('import failed'));
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer(),
        actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
      }),
    );
    render(<>{result.current.modalsNode}</>);
    // BiSImportModal renders unconditionally (isOpen-gated internally), so its
    // props — including onImport — are captured without opening the modal.
    const props = bisImportPropsLog[bisImportPropsLog.length - 1];
    await act(async () => {
      await (props.onImport as (u: { gear: never[]; bisLink?: string }) => Promise<void> | void)({
        gear: [],
        bisLink: 'https://xivgear.app/#/x',
      });
    });
    expect(onUpdate).toHaveBeenCalledWith({ gear: [], bisLink: 'https://xivgear.app/#/x' });
    expect(useToastStore.getState().toasts.some(
      (t) => t.type === 'error' && t.message === 'import failed',
    )).toBe(true);
  });

  it('Unlink BiS confirm: a rejected onUpdate surfaces an error toast (and still fired the update)', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('unlink failed'));
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer({ bisLink: 'https://xivgear.app/#/x' }),
        actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
      }),
    );
    const item = result.current.menuItems.find((i) => 'label' in i && i.label === 'Unlink BiS')!;
    act(() => {
      if ('onClick' in item) item.onClick?.();
    });
    render(<>{result.current.modalsNode}</>);
    fireEvent.click(screen.getByRole('button', { name: 'Unlink BiS' }));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'unlink failed',
      )).toBe(true);
    });
    expect(onUpdate).toHaveBeenCalledWith({ bisLink: '' });
  });
});
```

- [ ] **Step 11: Run it, verify it fails.** From `frontend/`:

```bash
pnpm test src/hooks/useRosterCardActions.test.tsx
```

Expected: both new tests fail — the first at the toast assertion (`expected false to be true`) with an `Unhandled Rejection: Error: import failed` report, the second with a `waitFor` timeout plus `Unhandled Rejection: Error: unlink failed`. Pre-existing tests still pass.

- [ ] **Step 12: Implement the hook fixes.**

Edit 1 — toast import. Current (useRosterCardActions.tsx:62-63):
```tsx
import { Modal, RadioGroup, type ContextMenuItem } from '../components/ui';
import { Button } from '../components/primitives';
```
Replace with:
```tsx
import { Modal, RadioGroup, type ContextMenuItem } from '../components/ui';
import { Button } from '../components/primitives';
import { toast } from '../stores/toastStore';
```

Edit 2 — BiSImportModal onImport (mutation shape; the async closure is still assignable to BiSImportModal's `onImport: (updates: { gear: GearSlotStatus[]; bisLink?: string }) => void`). Current (useRosterCardActions.tsx:446-448):
```tsx
        onImport={(updates) => {
          void actions.onUpdate(updates);
        }}
```
Replace with:
```tsx
        onImport={async (updates) => {
          // A10 mutation shape: onUpdate re-throws (tierStore rollback contract).
          try {
            await actions.onUpdate(updates);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to import BiS');
          }
        }}
```

Edit 3 — Unlink-BiS confirm (`setShowUnlink(false)` moves before the await so the modal still closes immediately, as the old fire-and-forget did). Current (useRosterCardActions.tsx:628-635):
```tsx
          <Button
            type="button"
            variant="warning"
            onClick={() => {
              void actions.onUpdate({ bisLink: '' });
              setShowUnlink(false);
            }}
          >
```
Replace with:
```tsx
          <Button
            type="button"
            variant="warning"
            onClick={async () => {
              setShowUnlink(false);
              // A10 mutation shape: onUpdate re-throws (tierStore rollback contract).
              try {
                await actions.onUpdate({ bisLink: '' });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to unlink BiS');
              }
            }}
          >
```

- [ ] **Step 13: Run tests, verify pass.** From `frontend/`:

```bash
pnpm test src/hooks/useRosterCardActions.test.tsx
```

---

#### Cycle D — Loot.tsx (mount fetches ×4, refresh() fetchCurrentWeek)

- [ ] **Step 14: Write the failing Loot tests.** Append this describe block at the very end of `frontend/src/components/loot/Loot.test.tsx` (all imports it needs — `fireEvent`, `waitFor`, `act`, `useToastStore`, `useLootTrackingStore`, `pickerCalls` — already exist in the suite):

```tsx
// A10 void'd-promise sweep: the mount effect void'd four re-throwing fetches
// (fetchWeekDataTypes does NOT re-throw — left bare), and refresh() void'd the
// re-throwing fetchCurrentWeek (fetchTier does not re-throw — left bare).
describe("Loot — A10 void'd-promise fixes", () => {
  it('mount fetches: rejecting store fetches surface ONE error toast instead of unhandled rejections', async () => {
    useLootTrackingStore.setState({
      fetchLootLog: vi.fn().mockRejectedValue(new Error('boom')),
      fetchMaterialLog: vi.fn().mockRejectedValue(new Error('boom')),
      fetchPageLedger: vi.fn().mockRejectedValue(new Error('boom')),
      fetchCurrentWeek: vi.fn().mockRejectedValue(new Error('boom')),
    });
    renderLoot({ tier: makeTier(players) });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.filter(
        (t) => t.type === 'error' && t.message === 'Failed to load loot data',
      )).toHaveLength(1);
    });
  });

  it('refresh(): a rejecting fetchCurrentWeek surfaces an error toast instead of an unhandled rejection', async () => {
    renderLoot({ tier: makeTier(players) });
    // Re-stub AFTER mount. The mount effect re-runs with the rejecting stub too
    // (fetchCurrentWeek is a dep) — the fixed effect catches that with the
    // 'Failed to load loot data' toast; the refresh-specific message below is
    // the discriminating assertion for THIS site.
    act(() => {
      useLootTrackingStore.setState({
        fetchCurrentWeek: vi.fn().mockRejectedValue(new Error('boom')),
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /log a drop/i }));
    const picker = pickerCalls[pickerCalls.length - 1];
    act(() => {
      (picker.onSuccess as () => void)();
    });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'Failed to refresh the week clock',
      )).toBe(true);
    });
  });
});
```

- [ ] **Step 15: Run it, verify it fails.** From `frontend/`:

```bash
pnpm test src/components/loot/Loot.test.tsx
```

Expected: both new tests fail with `waitFor` timeouts plus Vitest-reported `Unhandled Rejection: Error: boom` (four of them for the mount test). Pre-existing tests — including `'fetches loot log, material log, page ledger, current week, and week data types on mount'` — still pass.

- [ ] **Step 16: Implement the Loot.tsx fixes.**

Edit 1 — mount effect (the four re-throwing fetches get one aggregated catch; `fetchWeekDataTypes` never re-throws — **leave it bare**). Current (Loot.tsx:185-192):
```tsx
  useEffect(() => {
    if (!groupId || !tierId) return;
    void fetchLootLog(groupId, tierId);
    void fetchMaterialLog(groupId, tierId);
    void fetchPageLedger(groupId, tierId);
    void fetchCurrentWeek(groupId, tierId);
    void fetchWeekDataTypes(groupId, tierId);
  }, [groupId, tierId, fetchLootLog, fetchMaterialLog, fetchPageLedger, fetchCurrentWeek, fetchWeekDataTypes]);
```
Replace with:
```tsx
  useEffect(() => {
    if (!groupId || !tierId) return;
    // A10: these four re-throw after recording store error state, but this
    // screen never renders lootTrackingStore.error — surface ONE toast for the
    // batch instead of letting a failure become an unhandled rejection.
    // fetchWeekDataTypes never re-throws (store catches internally) — left bare.
    void Promise.all([
      fetchLootLog(groupId, tierId),
      fetchMaterialLog(groupId, tierId),
      fetchPageLedger(groupId, tierId),
      fetchCurrentWeek(groupId, tierId),
    ]).catch(() => toast.error('Failed to load loot data'));
    void fetchWeekDataTypes(groupId, tierId);
  }, [groupId, tierId, fetchLootLog, fetchMaterialLog, fetchPageLedger, fetchCurrentWeek, fetchWeekDataTypes]);
```

Edit 2 — refresh() (`fetchTier` does NOT re-throw — **leave it bare**). Current (Loot.tsx:199-204):
```tsx
  const refresh = useCallback(() => {
    if (groupId && tierId) {
      void fetchTier(groupId, tierId);
      void fetchCurrentWeek(groupId, tierId);
    }
  }, [groupId, tierId, fetchTier, fetchCurrentWeek]);
```
Replace with:
```tsx
  const refresh = useCallback(() => {
    if (groupId && tierId) {
      void fetchTier(groupId, tierId);
      // A10: fetchCurrentWeek re-throws (fetchTier does not) — catch so a
      // failed week-clock refresh can't become an unhandled rejection.
      void fetchCurrentWeek(groupId, tierId).catch(() => toast.error('Failed to refresh the week clock'));
    }
  }, [groupId, tierId, fetchTier, fetchCurrentWeek]);
```

`toast` is already imported (Loot.tsx:84) — no import change.

- [ ] **Step 17: Run tests, verify pass.** From `frontend/`:

```bash
pnpm test src/components/loot/Loot.test.tsx
```

- [ ] **Step 18: v2 gate + first commit.** From `frontend/`:

```bash
pnpm test src/components/roster/Roster.test.tsx src/components/roster/RosterCard.test.tsx src/hooks/useRosterCardActions.test.tsx src/components/loot/Loot.test.tsx
pnpm build
```

Both must be clean (`pnpm build` runs `tsc -b`, which is what CI runs — it verifies the async conversions type-check). Then commit from the repo root:

```bash
git add frontend/src/components/roster/Roster.tsx frontend/src/components/roster/Roster.test.tsx frontend/src/components/roster/RosterCard.tsx frontend/src/components/roster/RosterCard.test.tsx frontend/src/hooks/useRosterCardActions.tsx frontend/src/hooks/useRosterCardActions.test.tsx frontend/src/components/loot/Loot.tsx frontend/src/components/loot/Loot.test.tsx
git commit -m "fix(redesign): phase-a — A10 void'd-promise sweep, v2 sites (Roster, RosterCard, card actions, Loot)"
```

---

#### Cycle E — ScheduleIntegrationsPanel.tsx (Group B, legacy-shared bugfix — 7 sites)

This file signals via `setIntegrationMessage` (rendered at :351-361 as `{error || integrationMessage}`), **not toast** — every fix below matches the file's own precedent handlers (`handleConnectDiscord` :256-267 et al.). Minimal additive diffs only; nothing else in this file may change.

- [ ] **Step 19: Write the failing panel tests.** Append this describe block at the very end of `frontend/src/components/schedule/ScheduleIntegrationsPanel.test.tsx` (all imports — `fireEvent`, `waitFor` unused here, `screen`, `seedStore`, `makeSettings`, `makeSession` — already exist; no new imports needed):

```tsx
// A10 void'd-promise sweep (Group B — legacy-shared, pure bugfix): these seven
// handlers void'd re-throwing scheduleStore actions / clipboard writes with no
// reject path. The store mocks here keep `error` null, so the failure
// integrationMessage is what renders. Vitest fails the run on genuine unhandled
// rejections — a free regression guard for every site below.
describe("ScheduleIntegrationsPanel — A10 void'd-promise fixes", () => {
  it('save failure sets the failure message and never "Webhook saved." (no unhandled rejection)', async () => {
    const updateSettings = vi.fn(async () => { throw new Error('nope'); });
    seedStore({ settings: makeSettings(), updateSettings });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Failed to save reminder settings. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Webhook saved.')).not.toBeInTheDocument();
  });

  it('send-test failure sets the failure message (no unhandled rejection)', async () => {
    const sendTestReminder = vi.fn(async () => { throw new Error('nope'); });
    seedStore({ settings: makeSettings({ webhookConfigured: true }), sendTestReminder });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Send test'));
    expect(await screen.findByText('Failed to send the test reminder. Please try again.')).toBeInTheDocument();
  });

  it('post-session failure sets the failure message and re-enables the button (finally still runs)', async () => {
    const postSessionPreview = vi.fn(async () => { throw new Error('nope'); });
    seedStore({
      settings: makeSettings({ webhookConfigured: true }),
      sessions: [makeSession()],
      postSessionPreview,
    });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Post session'));
    expect(await screen.findByText('Failed to post the session to Discord. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Post session')).toBeInTheDocument();
  });

  it('claim-code copy failure sets the failure message and never "Copied!"', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    seedStore({ settings: makeSettings({ discordOfficialBotAvailable: true }) });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Connect Discord'));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy' }));
    expect(await screen.findByText('Failed to copy the link code.')).toBeInTheDocument();
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
  });

  it('calendar-URL copy failure sets the failure message and keeps the button label "Copy URL"', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    seedStore({ settings: makeSettings({ calendarUrl: 'https://x/cal.ics', calendarEnabled: true }) });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }));
    expect(await screen.findByText('Failed to copy the calendar URL.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy URL' })).toBeInTheDocument();
  });

  it('regenerate failure sets the failure message (no unhandled rejection)', async () => {
    const regenerateCalendar = vi.fn(async () => { throw new Error('nope'); });
    seedStore({ settings: makeSettings({ calendarUrl: 'https://x/cal.ics', calendarEnabled: true }), regenerateCalendar });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Regenerate'));
    expect(await screen.findByText('Failed to regenerate the calendar link. Please try again.')).toBeInTheDocument();
  });

  it('revoke failure sets the failure message (no unhandled rejection)', async () => {
    const revokeCalendar = vi.fn(async () => { throw new Error('nope'); });
    seedStore({ settings: makeSettings({ calendarUrl: 'https://x/cal.ics', calendarEnabled: true }), revokeCalendar });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Revoke'));
    expect(await screen.findByText('Failed to revoke the calendar link. Please try again.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 20: Run it, verify it fails.** From `frontend/`:

```bash
pnpm test src/components/schedule/ScheduleIntegrationsPanel.test.tsx
```

Expected: all 7 new tests fail with `findByText` timeouts (the failure messages never render), plus Vitest-reported `Unhandled Rejection: Error: nope` / `Error: denied` for each. Pre-existing tests (23) still pass.

- [ ] **Step 21: Implement the 7 panel fixes** (each anchor is verbatim-unique in the file).

Site 1 — `handleSaveIntegrations` body (wrap the await + success writes in try/catch per in-file precedent). Current (ScheduleIntegrationsPanel.tsx:239-253):
```tsx
    await updateSettings(groupId, {
      webhookUrl: webhookUrl || undefined,
      reminderChannelLabel: channelLabel || null,
      mentionTarget,
      mentionRoleId: mentionTarget === 'role' ? normalizedRoleId : null,
      enableAtStartReminder: enableAtStart,
      enable15mReminder: enable15m,
      enable24hReminder: enable24h,
      enable1hReminder: enable1h,
      enable6hReminder: enable6h,
      enable12hReminder: enable12h,
      enableMissingRsvpReminder: enableMissingRsvp,
    });
    setWebhookUrl('');
    setIntegrationMessage('Webhook saved.');
```
Replace with:
```tsx
    // A10: updateSettings re-throws — without the catch a failed Save was an
    // unhandled rejection with NO error path at all (in-file precedent:
    // handleConnectDiscord / handleDisconnectDiscord).
    try {
      await updateSettings(groupId, {
        webhookUrl: webhookUrl || undefined,
        reminderChannelLabel: channelLabel || null,
        mentionTarget,
        mentionRoleId: mentionTarget === 'role' ? normalizedRoleId : null,
        enableAtStartReminder: enableAtStart,
        enable15mReminder: enable15m,
        enable24hReminder: enable24h,
        enable1hReminder: enable1h,
        enable6hReminder: enable6h,
        enable12hReminder: enable12h,
        enableMissingRsvpReminder: enableMissingRsvp,
      });
      setWebhookUrl('');
      setIntegrationMessage('Webhook saved.');
    } catch {
      setIntegrationMessage('Failed to save reminder settings. Please try again.');
    }
```

Site 2 — send test (`.then(onSuccess, onError)` — the Loot.tsx copyLink two-callback shape). Current (ScheduleIntegrationsPanel.tsx:510):
```tsx
                    onClick={() => void sendTestReminder(groupId).then(() => setIntegrationMessage('Test reminder sent!'))}
```
Replace with:
```tsx
                    onClick={() => void sendTestReminder(groupId).then(
                      () => setIntegrationMessage('Test reminder sent!'),
                      () => setIntegrationMessage('Failed to send the test reminder. Please try again.'),
                    )}
```

Site 3 — post session (insert `.catch` between `.then` and `.finally` — `.finally` passes rejections through, so without the catch it stayed unhandled). Current (ScheduleIntegrationsPanel.tsx:523-525):
```tsx
                      void postSessionPreview(groupId)
                        .then(() => setIntegrationMessage('Session posted to Discord.'))
                        .finally(() => setPostingPreview(false));
```
Replace with:
```tsx
                      void postSessionPreview(groupId)
                        .then(() => setIntegrationMessage('Session posted to Discord.'))
                        .catch(() => setIntegrationMessage('Failed to post the session to Discord. Please try again.'))
                        .finally(() => setPostingPreview(false));
```

Site 4 — claim-code copy (clipboard shape with the file's own message setter). Current (ScheduleIntegrationsPanel.tsx:753):
```tsx
                          onClick={() => void navigator.clipboard.writeText(discordClaimCode ?? '').then(() => setIntegrationMessage('Copied!'))}
```
Replace with:
```tsx
                          onClick={() => void navigator.clipboard.writeText(discordClaimCode ?? '').then(
                            () => setIntegrationMessage('Copied!'),
                            () => setIntegrationMessage('Failed to copy the link code.'),
                          )}
```

Site 5 — `handleCopyCalendarUrl` (try/catch inside the async fn; a rejected write previously threw out of the void'd call at :902). Current (ScheduleIntegrationsPanel.tsx:336-340):
```tsx
  const handleCopyCalendarUrl = async () => {
    if (!settings?.calendarUrl) return;
    await navigator.clipboard.writeText(settings.calendarUrl);
    setIntegrationMessage('Copied!');
  };
```
Replace with:
```tsx
  const handleCopyCalendarUrl = async () => {
    if (!settings?.calendarUrl) return;
    // A10 clipboard shape: success message only after the write resolves; a
    // rejected write must not escape the void'd call site as an unhandled rejection.
    try {
      await navigator.clipboard.writeText(settings.calendarUrl);
      setIntegrationMessage('Copied!');
    } catch {
      setIntegrationMessage('Failed to copy the calendar URL.');
    }
  };
```

Site 6 — regenerate. Current (ScheduleIntegrationsPanel.tsx:925):
```tsx
                    onClick={() => void regenerateCalendar(groupId)}
```
Replace with:
```tsx
                    onClick={() => void regenerateCalendar(groupId).catch(() => setIntegrationMessage('Failed to regenerate the calendar link. Please try again.'))}
```

Site 7 — revoke. Current (ScheduleIntegrationsPanel.tsx:934):
```tsx
                    onClick={() => void revokeCalendar(groupId)}
```
Replace with:
```tsx
                    onClick={() => void revokeCalendar(groupId).catch(() => setIntegrationMessage('Failed to revoke the calendar link. Please try again.'))}
```

- [ ] **Step 22: Run tests, verify pass.** From `frontend/`:

```bash
pnpm test src/components/schedule/ScheduleIntegrationsPanel.test.tsx
```

Expected: all 30 tests pass (23 pre-existing + 7 new), zero unhandled-rejection reports.

- [ ] **Step 23: Full gate for every touched suite + repo checks.** From `frontend/`:

```bash
pnpm test src/components/roster/Roster.test.tsx src/components/roster/RosterCard.test.tsx src/hooks/useRosterCardActions.test.tsx src/components/loot/Loot.test.tsx src/components/schedule/ScheduleIntegrationsPanel.test.tsx
pnpm build
pnpm lint
pnpm check:design-system
```

All must pass (lint/design-system: the only raw `<button>`s added live in `*.test.tsx`, which the config exempts; no colors or shipped UI were added). Then verify no frozen or out-of-scope file was touched — from the repo root:

```bash
git status --porcelain | grep -v '^??'
```

Expected: exactly the two remaining MODIFIED entries (`frontend/src/components/schedule/ScheduleIntegrationsPanel.tsx` and its `.test.tsx`) — in particular NO diff to `SplitClearPlanner.tsx`, `LodestoneSearchModal.tsx`, `ScheduleTab.tsx`, `ScheduleUpcomingPanel.tsx`, `StaticHomeTab.tsx`, or `PlayerCard.tsx`. (Untracked `??` entries — `SESSION_HANDOFF.md`, `design/redesign/AUTONOMOUS_RUN.md`, `.superpowers/` — are session artifacts Task 1 deliberately leaves uncommitted; the grep filters them out.)

- [ ] **Step 24: Commit (Group B).** From the repo root:

```bash
git add frontend/src/components/schedule/ScheduleIntegrationsPanel.tsx frontend/src/components/schedule/ScheduleIntegrationsPanel.test.tsx
git commit -m "fix(redesign): phase-a — A10 void'd-promise sweep, ScheduleIntegrationsPanel (legacy-shared bugfix)"
```

**PR-body justification block (Group B — the PR step copies these lines verbatim; legacy-shared file, pure bugfix matching in-file precedent, no visual or affordance change; both smoke suites — `frontend/e2e/smoke.spec.ts` and `frontend/e2e/smoke-legacy.spec.ts` — must be green at the phase gate):**

- `ScheduleIntegrationsPanel.tsx` handleSaveIntegrations (Save button): `await updateSettings(...)` had no try/catch — a failed Save was an unhandled rejection with no error path at all; now try/catch + `setIntegrationMessage` failure text, the file's own handleConnectDiscord precedent.
- `ScheduleIntegrationsPanel.tsx` Send test: `sendTestReminder(...).then(success)` had no reject handler — added the failure `setIntegrationMessage` as the `.then` onRejected callback.
- `ScheduleIntegrationsPanel.tsx` Post session: `.then(...).finally(...)` passed rejections through unhandled — added `.catch` with a failure `setIntegrationMessage`; `.finally` still resets the posting flag.
- `ScheduleIntegrationsPanel.tsx` claim-code Copy: clipboard `.then(success)` had no reject handler (silent failure + unhandled rejection) — added the failure `setIntegrationMessage` callback.
- `ScheduleIntegrationsPanel.tsx` handleCopyCalendarUrl: a rejected clipboard write threw out of the async handler uncaught — wrapped in try/catch with a failure `setIntegrationMessage`.
- `ScheduleIntegrationsPanel.tsx` Regenerate: `void regenerateCalendar(groupId)` had no catch against a re-throwing store action — added `.catch` with a failure `setIntegrationMessage`.
- `ScheduleIntegrationsPanel.tsx` Revoke: `void revokeCalendar(groupId)` had no catch against a re-throwing store action — added `.catch` with a failure `setIntegrationMessage`.

---

### Task 12: Assign-anyway — material row always assignable; RecipientPicker empty-pool fallback (A11)

Two sub-bugs under one symptom ("Assign is dead when nobody needs the drop"), both v2-only. (1) `FloorCard.tsx:142` disables the material row's Assign when the priority queue is empty and the :143 handler no-ops on empty — material Assign is fully blocked. Fix: always fire with `row.top ?? players[0]` as the suggested recipient (`QuickLogMaterialModal`'s own recipient Select lists ALL eligible players, so it handles the no-needers case gracefully once given any `suggestedPlayer` — which stays a required, always-populated `SnapshotPlayer`, satisfied at `Loot.tsx:507`). One refinement over the spec's literal "drop `disableAssign={!row.top}`": `players` (`mainRosterPlayers` = configured non-subs, `Loot.tsx:139-142`) is NOT statically guaranteed non-empty — on a fresh static with zero configured players, `players[0]` is `undefined` at runtime (tsconfig has no `noUncheckedIndexedAccess`, so it still compiles as `SnapshotPlayer`). We therefore keep the `disableAssign` prop but weaken it to `players.length === 0` — disabled only when there is literally nobody to assign to; with any roster player present the button is always enabled, which is the spec behavior. (2) `RecipientPicker.tsx:216` always opens the non-edit branch on `scope='priority'` — an empty pool renders "No players match." with submit permanently disabled until the user discovers the All-members toggle. Fix: fall back to `scope='all'` (guaranteed non-empty while any player is configured, `recipientRanking.ts:87-101`) with the first entry pre-selected, in the shared non-edit branch (both `assign` and `log` modes — the picker should never open into an empty list; users can re-toggle freely). Legacy `LootPriorityPanel.tsx` has its own independent gating and is FROZEN — out of scope, do not touch. Standalone task; no dependency on other Phase A tasks.

**Files:**
- Modify: `frontend/src/components/loot/FloorCard.tsx` (materialRows `FloorDropRow` props, lines ~140-143)
- Modify: `frontend/src/components/loot/RecipientPicker.tsx` (mount-transition effect, non-edit branch, lines ~215-223)
- Test: `frontend/src/components/loot/FloorCard.test.tsx` (REPLACE the zero-needers disable test at lines 95-124; add an empty-roster guard pin)
- Test: `frontend/src/components/loot/RecipientPicker.test.tsx` (two new empty-pool tests + a non-empty-pool scope regression pin)

**Interfaces:**
- Consumes: `onAssignMaterial: (material: MaterialType, suggested: SnapshotPlayer) => void` and `players: SnapshotPlayer[]` (both existing `FloorCardProps`, `FloorCard.tsx:29,40`); `disableAssign?: boolean` (`FloorDropRowProps`, `FloorDropRow.tsx:20` — unchanged); `buildRecipientEntries(args: { players; slot; scope; settings; lootLog; currentWeek; enhancedActive }): RecipientEntry[]` and `type PickerScope = 'priority' | 'all' | 'offspec'` (`utils/recipientRanking.ts:16,51` — `PickerScope` is already imported in `RecipientPicker.tsx:26`). Nothing from other tasks.
- Produces: nothing new (behavior-only; no signature/prop changes — later tasks and reviewers rely only on the fixed behavior).

- [ ] **Step 1: Write the failing FloorCard test** — in `frontend/src/components/loot/FloorCard.test.tsx`, REPLACE the test that pins the buggy disable (verbatim current code, lines 95-124):

Current (FloorCard.test.tsx:95-124):
```tsx
  it('disables a material row Assign when the row has zero needers (no-op guard)', () => {
    // Fully raid-geared player with no tome pieces and no tome weapon → neither
    // Floor 2 material (glaze / universal_tomestone) has a needer.
    const player: SnapshotPlayer = {
      id: 'a', tierSnapshotId: 't1', name: 'Alice', job: 'PLD', role: 'tank',
      configured: true, sortOrder: 0, isSubstitute: false,
      gear: [
        { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'hands', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: false },
      ],
      tomeWeapon: {}, weaponPriorities: [],
    } as unknown as SnapshotPlayer;
    const onAssignMaterial = vi.fn();
    render(
      <FloorCard
        {...baseProps}
        floorNumber={2}
        floorName="M10S"
        players={[player]}
        onAssignMaterial={onAssignMaterial}
      />
    );
    const glazeRow = screen.getByText('Glaze').closest('div.border-b') as HTMLElement;
    const assign = within(glazeRow).getByRole('button', { name: 'Assign' });
    expect(assign).toBeDisabled();
    fireEvent.click(assign);
    expect(onAssignMaterial).not.toHaveBeenCalled();
  });
```

Replace with (same zero-needer fixture, inverted expectations, plus the empty-roster guard pin):
```tsx
  it('keeps a material row Assign enabled with zero needers and falls back to the first roster player (A11)', () => {
    // Fully raid-geared player with no tome pieces and no tome weapon → neither
    // Floor 2 material (glaze / universal_tomestone) has a needer. Assign must
    // still work: the modal's own Select allows immediate reassignment, so the
    // handler fires with players[0] as the suggested recipient.
    const player: SnapshotPlayer = {
      id: 'a', tierSnapshotId: 't1', name: 'Alice', job: 'PLD', role: 'tank',
      configured: true, sortOrder: 0, isSubstitute: false,
      gear: [
        { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'hands', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: false },
        { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: false },
      ],
      tomeWeapon: {}, weaponPriorities: [],
    } as unknown as SnapshotPlayer;
    const onAssignMaterial = vi.fn();
    render(
      <FloorCard
        {...baseProps}
        floorNumber={2}
        floorName="M10S"
        players={[player]}
        onAssignMaterial={onAssignMaterial}
      />
    );
    const glazeRow = screen.getByText('Glaze').closest('div.border-b') as HTMLElement;
    const assign = within(glazeRow).getByRole('button', { name: 'Assign' });
    expect(assign).not.toBeDisabled();
    fireEvent.click(assign);
    expect(onAssignMaterial).toHaveBeenCalledWith('glaze', expect.objectContaining({ id: 'a' }));
  });

  it('disables material Assign only when the roster is empty (nobody to assign to)', () => {
    // Degenerate guard pin: with zero configured players, players[0] would be
    // undefined at runtime — the ONLY case the button stays disabled.
    const onAssignMaterial = vi.fn();
    render(
      <FloorCard
        {...baseProps}
        floorNumber={2}
        floorName="M10S"
        players={[]}
        onAssignMaterial={onAssignMaterial}
      />
    );
    const glazeRow = screen.getByText('Glaze').closest('div.border-b') as HTMLElement;
    const assign = within(glazeRow).getByRole('button', { name: 'Assign' });
    expect(assign).toBeDisabled();
    fireEvent.click(assign);
    expect(onAssignMaterial).not.toHaveBeenCalled();
  });
```

Leave the existing non-empty-pool test `"a material row's Assign calls onAssignMaterial with the top-priority player"` (FloorCard.test.tsx:179-208) completely untouched — it covers the normal top-priority path and must still pass after the fix.

- [ ] **Step 2: Run it, verify it fails** — from the repo root:
```bash
cd frontend && pnpm test src/components/loot/FloorCard.test.tsx
```
Expected: 1 failure — `keeps a material row Assign enabled with zero needers…` fails at `expect(assign).not.toBeDisabled()` with "Received element is disabled". The `disables material Assign only when the roster is empty` pin PASSES even against the current buggy code (empty roster ⇒ `row.top` undefined ⇒ disabled) — that is expected; it exists to trip a naive fix that deletes `disableAssign` entirely. All other FloorCard tests stay green.

- [ ] **Step 3: Implement the FloorCard fix** — in `frontend/src/components/loot/FloorCard.tsx`, inside the `materialRows.map` `FloorDropRow`:

Current (FloorCard.tsx:140-143):
```tsx
              canEdit={canEdit}
              // Zero needers → no suggested recipient → Assign would be a no-op.
              disableAssign={!row.top}
              onAssign={() => row.top && onAssignMaterial(row.material, row.top)}
```

Replace with:
```tsx
              canEdit={canEdit}
              // A11: always assignable while anyone is on the roster. Zero
              // needers → fall back to the first roster player as the suggested
              // recipient (QuickLogMaterialModal's own Select allows immediate
              // reassignment). Disabled only in the degenerate empty-roster
              // case, where players[0] would be undefined.
              disableAssign={players.length === 0}
              onAssign={() => onAssignMaterial(row.material, row.top ?? players[0])}
```

No other change in this file. `row.top` is `SnapshotPlayer | undefined` (`entries[0]?.player`, FloorCard.tsx:94) and `players[0]` types as `SnapshotPlayer`, so `row.top ?? players[0]` satisfies `onAssignMaterial`'s `suggested: SnapshotPlayer` parameter; the `disableAssign` guard makes it non-undefined at runtime whenever the handler can fire. `FloorDropRow.tsx` is deliberately NOT touched — its `disableAssign` prop mechanism is correct and now carries the weaker condition.

- [ ] **Step 4: Run tests, verify pass** —
```bash
cd frontend && pnpm test src/components/loot/FloorCard.test.tsx
```
Expected: all FloorCard tests pass, including the untouched `"a material row's Assign calls onAssignMaterial with the top-priority player"`.

- [ ] **Step 5: Write the failing RecipientPicker tests** — in `frontend/src/components/loot/RecipientPicker.test.tsx`. Two insertions, reusing the suite's existing `makePlayer` fixture and `baseProps` (lines 35-54) and its gear-mutation pattern (e.g. lines 104-107).

Insertion 1 — two new tests at the end of `describe('RecipientPicker (assign mode)', …)`:

Current (RecipientPicker.test.tsx:165-169 — end of the search-filter test and the describe's closing brace):
```tsx
    // Clearing the search restores visibility and re-enables submit.
    fireEvent.change(screen.getByPlaceholderText('Search players…'), { target: { value: '' } });
    expect(submit).toBeEnabled();
  });
});
```

Replace with:
```tsx
    // Clearing the search restores visibility and re-enables submit.
    fireEvent.change(screen.getByPlaceholderText('Search players…'), { target: { value: '' } });
    expect(submit).toBeEnabled();
  });

  it('falls back to All members with a pre-selected recipient when nobody needs the item (A11)', () => {
    // Both players already hold the raid-BiS earring → the 'priority' scope
    // pool (needers only) is EMPTY. The picker must not open into a dead-end:
    // it opens on 'all' (never empty while anyone is configured) with the
    // first entry pre-selected, so submit is immediately usable.
    const gearedCaster = makePlayer('c1', 'Caster One', 'BLM');
    gearedCaster.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    const gearedMelee = makePlayer('m1', 'Melee One', 'SAM');
    gearedMelee.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    render(
      <RecipientPicker {...baseProps} players={[gearedCaster, gearedMelee]} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'By priority' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('No players match.')).not.toBeInTheDocument();
    // First 'all'-scope entry (alphabetical among non-needers) is pre-selected
    // and submit is enabled with a named recipient — not the bare disabled 'Assign'.
    const submit = screen.getByRole('button', { name: 'Assign to Caster One' });
    expect(submit).toBeEnabled();
  });

  it('opens on By priority when the priority pool is non-empty (fallback must not swallow the normal path)', () => {
    // Default fixture: both players need the earring (hasItem: false) → pool
    // non-empty → normal path. Payload-level pin for this path already exists in
    // 'lists ranked eligible players with reasons and confirms the top pick';
    // this adds the explicit scope-toggle assertion.
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    expect(screen.getByRole('button', { name: 'By priority' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'false');
  });
});
```

Insertion 2 — one slim log-mode case (the fallback lives in the SHARED non-edit branch; log mode's placeholder initial slot is Floor 1's first gear drop, `earring`, via `firstSlotForFloor(1)` — `FLOOR_LOOT_TABLES[1].gearDrops[0] === 'earring'`):

Current (RecipientPicker.test.tsx:180-182 — end of the log-mode describe):
```tsx
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].method).toBe('book');
  });
});
```

Replace with:
```tsx
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].method).toBe('book');
  });

  it('log mode falls back to All members when nobody needs the initial placeholder slot (shared branch, A11)', () => {
    // Log mode opens on firstSlotForFloor(1) = earring. Both players already
    // hold it → empty priority pool → same 'all' fallback as assign mode.
    const gearedCaster = makePlayer('c1', 'Caster One', 'BLM');
    gearedCaster.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    const gearedMelee = makePlayer('m1', 'Melee One', 'SAM');
    gearedMelee.gear = [
      { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: true },
    ] as SnapshotPlayer['gear'];
    render(<RecipientPicker {...baseProps} players={[gearedCaster, gearedMelee]} mode="log" />);
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('No players match.')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run them, verify they fail** —
```bash
cd frontend && pnpm test src/components/loot/RecipientPicker.test.tsx
```
Expected: exactly 2 failures, both at `expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'true')` — received `"false"` (the picker still opens on 'priority'): `falls back to All members with a pre-selected recipient when nobody needs the item (A11)` and `log mode falls back to All members when nobody needs the initial placeholder slot (shared branch, A11)`. The pin `opens on By priority when the priority pool is non-empty…` PASSES against current code (that is its purpose). All pre-existing tests stay green.

- [ ] **Step 7: Implement the RecipientPicker fallback** — in `frontend/src/components/loot/RecipientPicker.tsx`, in the mount-transition effect's non-edit branch (`PickerScope` is already imported at line 26; no import changes needed):

Current (RecipientPicker.tsx:215-223):
```tsx
      } else {
        setScope('priority');
        // Pin the default recipient: top of the initial priority ranking for the
        // opening drop context (scope always resets to 'priority' on open).
        const initialSlot: GearSlot | 'ring' = mode === 'log' ? firstSlotForFloor(1) : (item?.slot ?? 'weapon');
        const initialEntries = buildRecipientEntries({
          players, slot: initialSlot, scope: 'priority', settings, lootLog, currentWeek, enhancedActive,
        });
        setSelectedId(initialEntries[0]?.player.id ?? null);
```

Replace with:
```tsx
      } else {
        // Pin the default recipient: top of the initial priority ranking for the
        // opening drop context. A11: when NOBODY needs the slot the priority
        // pool is empty — opening on it would render "No players match." with
        // submit permanently disabled until the user discovers the All-members
        // toggle. Fall back to 'all' scope instead (guaranteed non-empty while
        // any player is configured — recipientRanking.ts appends the
        // needers-then-rest list) with its first entry pre-selected. Shared by
        // assign AND log mode; the user can re-toggle scopes freely after open.
        const initialSlot: GearSlot | 'ring' = mode === 'log' ? firstSlotForFloor(1) : (item?.slot ?? 'weapon');
        const priorityEntries = buildRecipientEntries({
          players, slot: initialSlot, scope: 'priority', settings, lootLog, currentWeek, enhancedActive,
        });
        const initialScope: PickerScope = priorityEntries.length > 0 ? 'priority' : 'all';
        const initialEntries = priorityEntries.length > 0
          ? priorityEntries
          : buildRecipientEntries({
              players, slot: initialSlot, scope: 'all', settings, lootLog, currentWeek, enhancedActive,
            });
        setScope(initialScope);
        setSelectedId(initialEntries[0]?.player.id ?? null);
```

The rest of the branch (`setWeek(currentWeek);` onward) is untouched. The edit-mode branch (lines 194-214, opens on `'all'` with the entry's recipient) is untouched — it already never opens empty.

- [ ] **Step 8: Run tests, verify pass** —
```bash
cd frontend && pnpm test src/components/loot/RecipientPicker.test.tsx
```
Expected: all RecipientPicker tests pass — the two new fallback tests, the new scope pin, and every pre-existing test (in particular `lists ranked eligible players with reasons and confirms the top pick`, which pins the non-empty-pool payload, and the edit-mode suite, whose open-on-'all' prefill is unaffected).

- [ ] **Step 9: Full suites of every touched file + build** —
```bash
cd frontend && pnpm test src/components/loot/FloorCard.test.tsx src/components/loot/RecipientPicker.test.tsx
cd frontend && pnpm build
```
Expected: both suites fully green; `pnpm build` (tsc -b + vite) clean — the `row.top ?? players[0]` expression and the `initialScope: PickerScope` annotation must compile with no new errors.

- [ ] **Step 10: Commit** — from the repo root:
```bash
git add frontend/src/components/loot/FloorCard.tsx frontend/src/components/loot/FloorCard.test.tsx frontend/src/components/loot/RecipientPicker.tsx frontend/src/components/loot/RecipientPicker.test.tsx
git commit -m "fix(redesign): phase-a — assign-anyway: material rows always assignable; RecipientPicker empty-pool fallback to All members (A11)"
```

---

### Task 13: Quick wins — initials centering (leading-none ×4) · TopBar order + divider (A12)

Two v2-only visual fixes. **(a)** Avatar-initials chips render their glyphs optically low: the spans flex/grid-center the *line box*, but Inter's ascent/descent metrics offset the ink inside the default `text-xs` line box. The codebase's own convention for this exact chip shape is `leading-none` (UserMenu badges :107/:227, OverviewTab :576–:610, RosterCard:372, DashboardCard) — four sites just don't follow it: the `AppRail` rail-avatar fallback, both `PlayerIdentity` fallbacks (rsvp-row + inline), and `PriorityRow`'s initials glyph (same defect class, approved as a scope +1 per skim default §6.6 — **note it as "+1 file beyond the named surfaces" in the PR body**). **(b)** The TopBar affordance cluster currently renders ⌘K · invite · bell · **settings · theme**; target is ⌘K · invite · bell · **theme · │ · settings** (established inline divider, ContextSwitcher.tsx:165 precedent — no new primitive). Investigated per spec: `IconButton`'s default size **is already `'md'`** (`frontend/src/components/primitives/IconButton.tsx:44`, `size = 'md'`), identical to its new md-sized neighbors, so ThemeToggle.tsx needs **no edit** — deliberately untouched, which also keeps this task fully v2-only (ThemeToggle is shared with legacy `Header.tsx:392`). All four modified source files are v2-authored, absent from the Phase-R frozen inventory. Standalone task: no dependency on any other Phase A task. Live visual verification ('DT'/'TE' initials at both chip sizes, both themes, plus the TopBar cluster screenshot) happens in the post-plan chrome-devtools browser-validation pass — no browser steps here.

**Files:**
- Modify: `frontend/src/components/layout/AppRail.tsx` (RailAvatarItemButton fallback initials span, ~:111-126)
- Modify: `frontend/src/components/ui/PlayerIdentity.tsx` (two SafeAvatar fallback spans: rsvp-row ~:104-111, inline ~:159-166)
- Modify: `frontend/src/components/ui/PriorityRow.tsx` (initials chip span, ~:49-59)
- Modify: `frontend/src/components/layout/TopBar.tsx` (affordance cluster ~:154-156 + header diagram comment :4)
- Test: `frontend/src/components/layout/AppRail.test.tsx` (add 1 className pin)
- Test: `frontend/src/components/ui/PlayerIdentity.test.tsx` (add 2 className pins)
- Test: `frontend/src/components/ui/PriorityRow.test.tsx` (add 1 className pin)
- Test: `frontend/src/components/layout/TopBar.test.tsx` (add 1 DOM-order test)
- Re-run only (no edits): `frontend/src/components/layout/TopBar.invite.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks. Existing internals only: `AppRail`/`RailEntry` (`components/layout/railTypes`), `PlayerIdentity` props, `PriorityRow` props, `TopBar({ onOpenPalette, onOpenNotifications })`, `IconButton` (`size` default `'md'`), Radix `Tooltip` (`asChild` trigger — buttons are direct DOM children of the cluster div).
- Produces: no new exports. DOM contract reviewers rely on: TopBar affordance cluster order `[⌘K button, invite button?, bell button, theme button, <span class="w-px h-4 bg-border-subtle flex-shrink-0" aria-hidden>, settings button]`; all four initials spans' class lists now contain `leading-none`.

All className pins below follow each suite's existing precedent (`expect(el.className).toContain(...)` in AppRail.test.tsx §3.9 tests; `ring.className` checks in PlayerIdentity.test.tsx; `querySelector` + attribute checks in PriorityRow.test.tsx; `compareDocumentPosition` DOM-order pattern from AppRail.test.tsx's skip-link test). No suite pins the old className strings or the old cluster order (grepped), so no existing assertions break.

- [ ] **Step 1: Write the failing AppRail centering pin** — in `frontend/src/components/layout/AppRail.test.tsx`, append a test inside `describe('AppRail', ...)`.

  Current (AppRail.test.tsx:162-166):
  ```tsx
  it('inactive avatar items carry hover-bg class (§3.9)', () => {
    render(<AppRail entries={makeEntries()} />);
    const avatarBtn = screen.getByRole('button', { name: 'My Static' });
    expect(avatarBtn.className).toContain('hover:bg-[var(--color-nav-item-bg-hover)]');
  });
  ```
  Replace with:
  ```tsx
  it('inactive avatar items carry hover-bg class (§3.9)', () => {
    render(<AppRail entries={makeEntries()} />);
    const avatarBtn = screen.getByRole('button', { name: 'My Static' });
    expect(avatarBtn.className).toContain('hover:bg-[var(--color-nav-item-bg-hover)]');
  });

  // A12: flex centers the line box, not the glyph ink — leading-none collapses the
  // line box so initials sit optically centered (codebase convention: UserMenu
  // badges, RosterCard:372, DashboardCard). jsdom can't paint; pin the class.
  it('avatar fallback initials span carries leading-none (A12 centering)', () => {
    render(<AppRail entries={makeEntries()} />);
    const initialsSpan = screen.getByText('MS');
    expect(initialsSpan.className).toContain('leading-none');
  });
  ```

- [ ] **Step 2: Run it, verify it fails** — from `frontend/`:
  ```bash
  pnpm test src/components/layout/AppRail.test.tsx
  ```
  Expected: 1 failure — `AssertionError: expected 'flex items-center justify-center rounded-full text-xs font-semibold' to contain 'leading-none'`. All other AppRail tests stay green.

- [ ] **Step 3: Implement — add `leading-none` to the AppRail fallback span** — in `frontend/src/components/layout/AppRail.tsx` (RailAvatarItemButton, the no-image fallback).

  Current (AppRail.tsx:111-113):
  ```tsx
          <span
            aria-hidden="true"
            className="flex items-center justify-center rounded-full text-xs font-semibold"
  ```
  Replace with:
  ```tsx
          <span
            aria-hidden="true"
            className="flex items-center justify-center rounded-full text-xs font-semibold leading-none"
  ```

- [ ] **Step 4: Run tests, verify pass** — from `frontend/`:
  ```bash
  pnpm test src/components/layout/AppRail.test.tsx
  ```
  Expected: all tests pass.

- [ ] **Step 5: Write the two failing PlayerIdentity centering pins** — in `frontend/src/components/ui/PlayerIdentity.test.tsx`. Two insertions:

  **(5a) inline-variant pin** — Current (PlayerIdentity.test.tsx:22-26):
  ```tsx
  it('shows initials fallback when no avatarUrl', () => {
    render(<PlayerIdentity name="Healer Two" job="WHM" role="healer" />);
    // Initials derived from name ("HT") appear in the avatar fallback
    expect(screen.getByText('HT')).toBeInTheDocument();
  });
  ```
  Replace with:
  ```tsx
  it('shows initials fallback when no avatarUrl', () => {
    render(<PlayerIdentity name="Healer Two" job="WHM" role="healer" />);
    // Initials derived from name ("HT") appear in the avatar fallback
    expect(screen.getByText('HT')).toBeInTheDocument();
  });

  it('inline avatar fallback initials carry leading-none (A12 centering)', () => {
    // A12: flex centers the line box, not the glyph ink — leading-none collapses
    // the line box so initials sit optically centered in the 32px chip.
    render(<PlayerIdentity name="Healer Two" job="WHM" role="healer" />);
    expect(screen.getByText('HT').className).toContain('leading-none');
  });
  ```

  **(5b) rsvp-row pin** — Current (PlayerIdentity.test.tsx:109-112, last test of the rsvp-row describe):
  ```tsx
  it('emits the sr-only role label when role is set with no textual signal', () => {
    render(<PlayerIdentity name="A" variant="rsvp-row" role="tank" />);
    expect(screen.getByText('Tank')).toHaveClass('sr-only');
  });
  ```
  Replace with:
  ```tsx
  it('emits the sr-only role label when role is set with no textual signal', () => {
    render(<PlayerIdentity name="A" variant="rsvp-row" role="tank" />);
    expect(screen.getByText('Tank')).toHaveClass('sr-only');
  });
  it('rsvp-row avatar fallback initials carry leading-none (A12 centering)', () => {
    render(<PlayerIdentity name="Alice Ray" variant="rsvp-row" />);
    expect(screen.getByText('AR').className).toContain('leading-none');
  });
  ```

- [ ] **Step 6: Run them, verify both fail** — from `frontend/`:
  ```bash
  pnpm test src/components/ui/PlayerIdentity.test.tsx
  ```
  Expected: exactly 2 failures, both — `AssertionError: expected 'w-full h-full rounded-full bg-surface-interactive flex items-center justify-center text-xs font-medium text-text-secondary' to contain 'leading-none'`.

- [ ] **Step 7: Implement — add `leading-none` to both PlayerIdentity fallback spans** — in `frontend/src/components/ui/PlayerIdentity.tsx`. The two spans have identical className strings, so each anchor includes its (unique) child expression.

  **(7a) rsvp-row fallback** — Current (PlayerIdentity.tsx:104-111):
  ```tsx
            fallback={
              <span
                className="w-full h-full rounded-full bg-surface-interactive flex items-center justify-center text-xs font-medium text-text-secondary"
                aria-hidden="true"
              >
                {getInitials(name)}
              </span>
            }
  ```
  Replace with:
  ```tsx
            fallback={
              <span
                className="w-full h-full rounded-full bg-surface-interactive flex items-center justify-center text-xs font-medium text-text-secondary leading-none"
                aria-hidden="true"
              >
                {getInitials(name)}
              </span>
            }
  ```

  **(7b) inline fallback** — Current (PlayerIdentity.tsx:159-166):
  ```tsx
          fallback={
            <span
              className="w-full h-full rounded-full bg-surface-interactive flex items-center justify-center text-xs font-medium text-text-secondary"
              aria-hidden="true"
            >
              {initials}
            </span>
          }
  ```
  Replace with:
  ```tsx
          fallback={
            <span
              className="w-full h-full rounded-full bg-surface-interactive flex items-center justify-center text-xs font-medium text-text-secondary leading-none"
              aria-hidden="true"
            >
              {initials}
            </span>
          }
  ```

- [ ] **Step 8: Run tests, verify pass** — from `frontend/`:
  ```bash
  pnpm test src/components/ui/PlayerIdentity.test.tsx
  ```
  Expected: all tests pass (the pre-existing ring/sr-only assertions are unaffected — none pin the fallback span's full class list).

- [ ] **Step 9: Write the failing PriorityRow centering pin** — in `frontend/src/components/ui/PriorityRow.test.tsx` (suite exists; do NOT create a new file), append inside `describe('PriorityRow', ...)`.

  Current (PriorityRow.test.tsx:46-49):
  ```tsx
  it('renders no "+N eligible" text when entries.length <= maxVisible', () => {
    render(<PriorityRow entries={entries.slice(0, 3)} />);
    expect(screen.queryByText(/eligible/)).not.toBeInTheDocument();
  });
  ```
  Replace with:
  ```tsx
  it('renders no "+N eligible" text when entries.length <= maxVisible', () => {
    render(<PriorityRow entries={entries.slice(0, 3)} />);
    expect(screen.queryByText(/eligible/)).not.toBeInTheDocument();
  });

  it('avatar initials glyph carries leading-none (A12 centering)', () => {
    // A12: grid place-items-center centers the line box, not the glyph ink —
    // leading-none collapses the line box (same fix as AppRail/PlayerIdentity).
    render(<PriorityRow entries={entries} />);
    const initialsSpan = screen.getByText('CO'); // initials('Caster One')
    expect(initialsSpan.className).toContain('leading-none');
  });
  ```

- [ ] **Step 10: Run it, verify it fails** — from `frontend/`:
  ```bash
  pnpm test src/components/ui/PriorityRow.test.tsx
  ```
  Expected: 1 failure — `AssertionError: expected 'grid h-[22px] w-[22px] flex-none place-items-center rounded-full border-2 bg-surface-interactive text-[10px] font-bold text-text-secondary' to contain 'leading-none'`.

- [ ] **Step 11: Implement — add `leading-none` to the PriorityRow initials span** — in `frontend/src/components/ui/PriorityRow.tsx`.

  Current (PriorityRow.tsx:55):
  ```tsx
              className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full border-2 bg-surface-interactive text-[10px] font-bold text-text-secondary"
  ```
  Replace with:
  ```tsx
              className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full border-2 bg-surface-interactive text-[10px] font-bold text-text-secondary leading-none"
  ```

- [ ] **Step 12: Run tests, verify pass** — from `frontend/`:
  ```bash
  pnpm test src/components/ui/PriorityRow.test.tsx
  ```
  Expected: all tests pass.

- [ ] **Step 13: Write the failing TopBar order test** — in `frontend/src/components/layout/TopBar.test.tsx`, append inside `describe('TopBar', ...)`. Uses the suite's existing `renderTopBar()` helper (which returns the `render(...)` result) and role/name queries; the DOM-order technique (`compareDocumentPosition` + `DOCUMENT_POSITION_FOLLOWING`) is the codebase's established pattern (AppRail.test.tsx skip-link test). `span.w-px` is a safe unique selector: no other `w-px` element exists anywhere in TopBar's render tree (grepped `components/layout/`, `components/ui/`, `pages/` — only ContextSwitcher has one, and TopBar does not render ContextSwitcher). Tooltip triggers use Radix `asChild`, so the IconButtons are direct children of the cluster div — but this test deliberately avoids parent/child structure assumptions and only asserts relative document order.

  Current (TopBar.test.tsx:121-126):
  ```tsx
  it('opens the command palette via the ⌘K affordance', () => {
    const onOpenPalette = vi.fn();
    renderTopBar(onOpenPalette);
    fireEvent.click(screen.getByRole('button', { name: 'Command palette' }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });
  ```
  Replace with:
  ```tsx
  it('opens the command palette via the ⌘K affordance', () => {
    const onOpenPalette = vi.fn();
    renderTopBar(onOpenPalette);
    fireEvent.click(screen.getByRole('button', { name: 'Command palette' }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  // A12: affordance order is ⌘K · invite · bell · theme · │ · settings — theme
  // joins the passive affordances; settings sits isolated after the divider.
  it('orders the affordances ⌘K · invite · bell · theme · divider · settings (A12)', () => {
    const { container } = renderTopBar();
    const palette = screen.getByRole('button', { name: 'Command palette' });
    const invite = screen.getByRole('button', { name: 'Invite members' });
    const bell = screen.getByRole('button', { name: /^Notifications/ });
    const theme = screen.getByRole('button', { name: 'Toggle theme' });
    const settings = screen.getByRole('button', { name: 'Settings' });
    const divider = container.querySelector('span.w-px');
    expect(divider).not.toBeNull();
    expect(divider).toHaveAttribute('aria-hidden');
    // compareDocumentPosition: if a precedes b, a.compareDocumentPosition(b)
    // carries DOCUMENT_POSITION_FOLLOWING (same pattern as AppRail.test.tsx).
    const precedes = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(precedes(palette, invite)).toBe(true);
    expect(precedes(invite, bell)).toBe(true);
    expect(precedes(bell, theme)).toBe(true);
    expect(precedes(theme, divider!)).toBe(true);
    expect(precedes(divider!, settings)).toBe(true);
  });
  ```

- [ ] **Step 14: Run it, verify it fails** — from `frontend/`:
  ```bash
  pnpm test src/components/layout/TopBar.test.tsx
  ```
  Expected: 1 failure on the new test at `expect(divider).not.toBeNull()` — `AssertionError: expected null not to be null` (no `span.w-px` exists in TopBar yet). The five pre-existing tests stay green.

- [ ] **Step 15: Implement — swap SettingsGear/ThemeToggle and insert the divider** — in `frontend/src/components/layout/TopBar.tsx`. The divider is the exact established inline span (ContextSwitcher.tsx:165 precedent); no new primitive, no new imports. IconButton's default size is `'md'` (primitives/IconButton.tsx:44), matching SettingsGear/palette/invite, so ThemeToggle is NOT edited.

  Current (TopBar.tsx:154-156):
  ```tsx
          <NotificationBell onOpen={onOpenNotifications} />
          <SettingsGear />
          <ThemeToggle />
  ```
  Replace with:
  ```tsx
          <NotificationBell onOpen={onOpenNotifications} />
          <ThemeToggle />
          <span className="w-px h-4 bg-border-subtle flex-shrink-0" aria-hidden />
          <SettingsGear />
  ```

  Also update the now-stale header diagram comment (comment-only mechanical piggyback on this step — no separate test):

  Current (TopBar.tsx:4):
  ```tsx
 *   [StaticPicker] › [TierSelector] [⋮]   [Week n ‹ ›]   ──spacer──   [⌘K][🔔][⚙][☾]
  ```
  Replace with:
  ```tsx
 *   [StaticPicker] › [TierSelector] [⋮]   [Week n ‹ ›]   ──spacer──   [⌘K][🔔][☾]│[⚙]
  ```

- [ ] **Step 16: Run tests, verify pass** — from `frontend/`:
  ```bash
  pnpm test src/components/layout/TopBar.test.tsx
  ```
  Expected: all tests pass, including the new order test.

- [ ] **Step 17: Full suites of every touched file + invite suite + build/lint/DS gates** — from `frontend/`:
  ```bash
  pnpm test src/components/layout/AppRail.test.tsx src/components/ui/PlayerIdentity.test.tsx src/components/ui/PriorityRow.test.tsx src/components/layout/TopBar.test.tsx src/components/layout/TopBar.invite.test.tsx
  pnpm build
  pnpm lint
  pnpm check:design-system
  ```
  Expected: all five suites green (TopBar.invite.test.tsx has no order-dependent assertions — re-run confirms), clean `tsc -b` build, no new lint or design-system violations (`leading-none`, `w-px`, `h-4`, `bg-border-subtle` are all token-safe utilities; a raw decorative `<span aria-hidden>` divider matches the existing ContextSwitcher/WeekStepper convention and is not a flagged element).

- [ ] **Step 18: Commit** — from the repo root (`D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner`):
  ```bash
  git add frontend/src/components/layout/AppRail.tsx frontend/src/components/layout/AppRail.test.tsx frontend/src/components/ui/PlayerIdentity.tsx frontend/src/components/ui/PlayerIdentity.test.tsx frontend/src/components/ui/PriorityRow.tsx frontend/src/components/ui/PriorityRow.test.tsx frontend/src/components/layout/TopBar.tsx frontend/src/components/layout/TopBar.test.tsx
  git commit -m "fix(redesign): phase-a — A12 quick wins: initials leading-none centering (x4) + TopBar theme/divider/settings order"
  ```

---

### Task 14: Phase-R follow-ups — slot-gate splitClear fetch · dev_auth tab_persistence normalization (A13)

Two Phase-R follow-ups. **(a)** `GroupViewContent.tsx` fires the legacy split-clear fetch unconditionally on the roster tab in two effects (mount at :331-335, visibility-refresh at :340-344) — pure waste + guest 403 noise when v2's roster slot is mounted (v2 dropped the Split Planner card, D-P3-2). Fix: add the file's canonical legacy-roster predicate `!slots?.roster` (already used at :713, :1162-1168, :1196) to both trigger conditions and dependency arrays. The cleanup effect (:336, `clearSplitClear`) stays **unconditional** — it is a store-local reset that must run on unmount in both shells; gating it would risk stale split-clear state on a shell round-trip. **(b)** `dev_login` in `backend/app/routers/dev_auth.py` already force-normalizes the dev static's `is_public`/discovery settings on every login (:418-429) but never resets the logging-in user's `tab_persistence` (a `users` column, default `'remember'` — see `backend/app/models/user.py:43-45`); a manual Settings toggle can PATCH it to `'reset'`, silently changing tab-restore behavior under smoke-legacy. Fix: normalize the resolved logging-in `user` (not a 3-user sweep) to `'remember'` before the commit, mirroring the is_public precedent. ORDER NOTE: Tasks 5/6 edited GroupViewContent's MorePage region (~:1143-1178); this task's region (:326-344) is disjoint, so head anchors are safe — edit by string anchor as always. `GroupViewContent.tsx` is **legacy-shared** (this is the enumerated gating bugfix — minimal additive diff; legacy behavior preserved: `slots` undefined ⇒ `!slots?.roster` is `true` ⇒ the fetch keeps firing exactly as today). **FREEZE NOTE (plan-verification correction):** all four restored `GroupViewContent.*.test.tsx` suites — including `GroupViewContent.rosterSlot.test.tsx` — are in the f45a241 byte-frozen restore set and MUST NOT be edited. The new gating tests therefore live in a NEW suite file, `GroupViewContent.splitClearGate.test.tsx`, which clones the rosterSlot suite's mock scaffolding (read it as a reference only) and hoists the `splitClearStore` mock to shared `vi.fn()`s. Two commits: frontend fix first, then backend fix.

**Files:**
- Modify: `frontend/src/pages/GroupViewContent.tsx` (split-clear fetch effects, :326-344)
- Create: `frontend/src/pages/GroupViewContent.splitClearGate.test.tsx` (new suite — clones the FROZEN rosterSlot suite's scaffolding with a hoisted `useSplitClearStore` mock; the frozen suite itself is untouched)
- Modify: `backend/app/routers/dev_auth.py` (`dev_login`, insert normalization before `await session.commit()`)
- Test: `backend/tests/test_dev_auth.py` (new `TestDevLoginTabPersistenceNormalization` class — first `dev_login` coverage in the suite)

**Interfaces:**
- Consumes: `GroupViewContentProps.slots?: Partial<Record<GroupTab, React.ReactNode>>` (GroupViewContent.tsx:90); `useSplitClearStore()` → `fetchData: (groupId: string) => Promise<void>` / `clearData: () => void` (stores/splitClearStore.ts:29-33); `useVisibilityRefresh(callback: () => void, minHiddenMs = 2000): void` (hooks/useVisibilityRefresh.ts:9); backend `async def dev_login(user_index: int, response: Response, session: AsyncSession = Depends(get_session)) -> dict` (dev_auth.py:387-392); `User.tab_persistence: Mapped[str]` default `"remember"` (models/user.py:43-45); test factory `create_user(session, *, discord_id: str | None = None, discord_username: str = "testuser", discord_avatar: str | None = None) -> User` (tests/factories.py:14-33 — it does NOT accept a `tab_persistence` kwarg; set the attribute post-create); `Settings.environment: str = "development"` / `Settings.dev_auth_mode: bool = False` (app/config.py:43, 78 — both real mutable fields, so `monkeypatch.setattr` on the module-level `dev_auth.settings` instance works). Nothing from other tasks.
- Produces: nothing (no new exports; behavioral contracts only — v2 roster slot suppresses the split-clear fetch; every dev login leaves the logging-in dev user at `tab_persistence='remember'`).

- [ ] **Step 1: Write the failing frontend tests** — CREATE `frontend/src/pages/GroupViewContent.splitClearGate.test.tsx` with exactly this content. It clones the mock scaffolding of the FROZEN `GroupViewContent.rosterSlot.test.tsx` (do NOT edit that file — read it only if you want to compare) and hoists the `splitClearStore` mock to shared `vi.fn()`s so call counts are observable. `useVisibilityRefresh` is mocked as a bare `vi.fn()`, and GroupViewContent registers exactly ONE visibility-refresh callback (verified: single call site at GroupViewContent.tsx:340), so `.mock.calls.at(-1)![0]` reliably grabs the latest render's callback.

  ```tsx
  /**
   * GroupViewContent — split-clear fetch slot gating (Phase A, A13a).
   *
   * The legacy split-clear fetch must fire on the roster tab ONLY when the
   * legacy roster body owns the region (no `slots.roster`). This suite clones
   * the mock scaffolding of `GroupViewContent.rosterSlot.test.tsx` — that suite
   * is part of the f45a241 byte-frozen restore set and must not be edited, so
   * the gating tests live here with a hoisted `splitClearStore` mock instead.
   */
  import { render } from '@testing-library/react';
  import { MemoryRouter } from 'react-router-dom';
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import type { AddedPlayerSignal } from './groupActionsContext';

  // ── Mock the state hook: pageMode pinned to 'roster' ──
  const noop = vi.fn();
  function makeState() {
    return {
      searchParams: new URLSearchParams(),
      setSearchParams: noop,
      pageMode: 'roster',
      setPageMode: noop,
      gearSubTab: 'sync', setGearSubTab: noop,
      lootSubTab: 'gear', setLootSubTab: noop,
      viewMode: 'compact', setViewMode: noop,
      groupView: false, setGroupView: noop, setGroupViewState: noop,
      subsView: false, setSubsView: noop,
      selectedFloor: 1, setSelectedFloor: noop,
      sortPreset: 'standard', setSortPreset: noop, setSortPresetState: noop,
      editingPlayerId: null, setEditingPlayerId: noop,
      clipboardPlayer: null, setClipboardPlayer: noop,
      showCreateTierModal: false, setShowCreateTierModal: noop,
      showSettingsModal: false, setShowSettingsModal: noop,
      showRolloverDialog: false, setShowRolloverDialog: noop,
      showDeleteTierConfirm: false, setShowDeleteTierConfirm: noop,
      showKeyboardHelp: false, setShowKeyboardHelp: noop,
      showLogLootModal: false, setShowLogLootModal: noop,
      showLogMaterialModal: false, setShowLogMaterialModal: noop,
      showMarkFloorClearedModal: false, setShowMarkFloorClearedModal: noop,
      showLogWeekWizard: false, setShowLogWeekWizard: noop,
      logWeekWizardFloor: null, setLogWeekWizardFloor: noop,
      logWeekWizardWeek: null, setLogWeekWizardWeek: noop,
      playerModalCount: 0, setPlayerModalCount: noop,
      highlightedPlayerId: null, setHighlightedPlayerId: noop,
      highlightedSlot: null, setHighlightedSlot: noop,
      highlightedEntry: null, setHighlightedEntry: noop,
      highlightedBookPlayerId: null, setHighlightedBookPlayerId: noop,
    };
  }
  vi.mock('../hooks/useGroupViewState', () => ({
    useGroupViewState: () => makeState(),
  }));

  // ── Stores ──
  const currentTier = { id: 'snap1', tierId: 'm5s', contentType: 'savage', players: [] as unknown[] };
  const currentGroup = { id: 'g1', name: 'Test Static', shareCode: 'DEVTST', settings: {}, userRole: 'owner' };
  vi.mock('../stores/tierStore', () => ({
    useTierStore: () => ({ currentTier, tiers: [currentTier], isSaving: false, fetchTier: vi.fn() }),
  }));
  vi.mock('../stores/staticGroupStore', () => ({
    useStaticGroupStore: () => ({ currentGroup, groups: [currentGroup] }),
  }));
  vi.mock('../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1', isAdmin: false } }) }));
  vi.mock('../stores/viewAsStore', () => ({ useViewAsStore: () => ({ viewAsUser: null }) }));
  vi.mock('../stores/lootTrackingStore', () => ({
    useLootTrackingStore: () => ({
      currentWeek: 1, maxWeek: 1, fetchCurrentWeek: vi.fn(), fetchLootLog: vi.fn(),
      lootLog: [], fetchMaterialLog: vi.fn(), materialLog: [],
    }),
  }));
  vi.mock('../stores/mountFarmStore', () => ({ useMountFarmStore: { getState: () => ({ data: null }) } }));
  // A13: hoisted to shared vi.fn()s so the gating tests below can assert call
  // counts (the restored GroupViewContent suites keep their inline mocks).
  const splitClearFetchData = vi.fn();
  const splitClearClearData = vi.fn();
  vi.mock('../stores/splitClearStore', () => ({
    useSplitClearStore: () => ({ fetchData: splitClearFetchData, clearData: splitClearClearData }),
  }));
  vi.mock('../stores/settingsPanelStore', () => ({
    useSettingsPanelStore: { getState: () => ({ open: vi.fn(), close: vi.fn() }) },
  }));

  // ── Hooks ──
  vi.mock('../hooks/useGroupViewKeyboardShortcuts', () => ({
    useGroupViewKeyboardShortcuts: vi.fn(),
  }));
  vi.mock('../hooks/usePlayerActions', () => ({ usePlayerActions: () => ({ handleAddPlayer: vi.fn() }) }));
  vi.mock('../components/dnd/useDragAndDrop', () => ({
    useDragAndDrop: () => ({ sensors: [], handleDragStart: vi.fn(), handleDragOver: vi.fn(), handleDragEnd: vi.fn(), handleDragCancel: vi.fn() }),
  }));
  vi.mock('../hooks/useDevice', () => ({ useDevice: () => ({ isSmallScreen: false }) }));
  vi.mock('../hooks/useSwipe', () => ({ useSwipe: () => ({}) }));
  vi.mock('../hooks/useViewNavigation', () => ({
    useViewNavigation: () => ({ handleNavigateToPlayer: vi.fn(), handleNavigateToLootEntry: vi.fn(), handleNavigateToMaterialEntry: vi.fn(), handleNavigateToBooksPanel: vi.fn() }),
  }));
  vi.mock('../hooks/useVisibilityRefresh', () => ({ useVisibilityRefresh: vi.fn() }));
  vi.mock('../hooks/useUrlTabState', () => ({ useUrlTabState: (_k: string, _v: unknown, d: string) => [d, vi.fn()] }));
  vi.mock('../lib/eventBus', () => ({
    useEventBus: vi.fn(),
    eventBus: { emit: vi.fn(), on: vi.fn(() => vi.fn()) },
    Events: { MEMBER_ROLE_CHANGED: 'membership:role-changed', MOUNT_FARM_SCHEDULE: 'mount-farm:schedule' },
  }));

  // ── GroupActions context ──
  vi.mock('./groupActionsContext', () => ({
    useGroupActionModalOpen: () => false,
    useGroupAddedPlayer: (): AddedPlayerSignal | null => null,
    useGroupClearAddedPlayer: () => vi.fn(),
  }));

  // ── Heavy roster body leaves — the legacy roster body actually mounts at
  //    pageMode='roster', so stub them out (their internals aren't under test). ──
  vi.mock('../components/player/PlayerGrid', () => ({
    PlayerGrid: () => <div data-testid="legacy-player-grid" />,
  }));
  vi.mock('../components/player/RosterDragOverlay', () => ({
    RosterDragOverlay: () => null,
  }));
  vi.mock('../components/roster/RosterCharacterPanel', () => ({
    RosterCharacterPanel: () => null,
  }));
  vi.mock('../components/split-clear/SplitClearPlanner', () => ({
    SplitClearPlanner: () => null,
  }));
  vi.mock('../components/ui', async (orig) => {
    const actual = await orig<typeof import('../components/ui')>();
    return { ...actual, MobileBottomNav: () => <div data-testid="mobile-nav" /> };
  });

  import { GroupViewContent } from './GroupViewContent';
  import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';

  const actions = { onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(), onRollover: vi.fn(), onDeleteTier: vi.fn() };
  const renderContent = (props: Partial<React.ComponentProps<typeof GroupViewContent>> = {}) =>
    render(<MemoryRouter><GroupViewContent actions={actions} {...props} /></MemoryRouter>);

  describe('GroupViewContent — split-clear fetch slot gating (A13)', () => {
    beforeEach(() => {
      splitClearFetchData.mockClear();
    });

    it('LEGACY (no slots): the roster tab fires the split-clear fetch', () => {
      renderContent();
      expect(splitClearFetchData).toHaveBeenCalledWith('g1');
    });

    it('V2 (slots.roster provided): the split-clear fetch does NOT fire', () => {
      renderContent({ slots: { roster: <div data-testid="v2-roster" /> } });
      expect(splitClearFetchData).not.toHaveBeenCalled();
    });

    it('visibility refresh honors the same gate (legacy fires, v2 does not)', () => {
      renderContent();
      const legacyRefresh = vi.mocked(useVisibilityRefresh).mock.calls.at(-1)![0];
      splitClearFetchData.mockClear();
      legacyRefresh();
      expect(splitClearFetchData).toHaveBeenCalledWith('g1');

      renderContent({ slots: { roster: <div data-testid="v2-roster" /> } });
      const v2Refresh = vi.mocked(useVisibilityRefresh).mock.calls.at(-1)![0];
      splitClearFetchData.mockClear();
      v2Refresh();
      expect(splitClearFetchData).not.toHaveBeenCalled();
    });
  });
  ```
  TDD note: the LEGACY test passes at head by design — it is the regression pin that proves the gate does not break legacy (where `slots` is undefined). The red tests are the two v2 assertions.

- [ ] **Step 2: Run it, verify it fails** — from `frontend/`:
  ```bash
  pnpm test src/pages/GroupViewContent.splitClearGate.test.tsx
  ```
  Expected: 2 failures, 1 pass (the new LEGACY pin passes at head by design). Failure signatures: `V2 (slots.roster provided): the split-clear fetch does NOT fire` → `AssertionError: expected "spy" to not be called at all, but actually been called 1 times` (called with `'g1'`); `visibility refresh honors the same gate` → same `expected "spy" to not be called at all` signature on the final assertion.

- [ ] **Step 3: Implement the gate** — one edit to `frontend/src/pages/GroupViewContent.tsx`.

  Current (GroupViewContent.tsx:331-344):
  ```tsx
    useEffect(() => {
      if (pageMode === 'roster' && currentGroup?.id) {
        void fetchSplitClear(currentGroup.id);
      }
    }, [pageMode, currentGroup?.id, fetchSplitClear]);
    useEffect(() => { return () => clearSplitClear(); }, [clearSplitClear]);

    // Silently refetch split-clear data when the user returns from another tab
    // (e.g. after linking characters on the profile page).
    useVisibilityRefresh(useCallback(() => {
      if (pageMode === 'roster' && currentGroup?.id) {
        void fetchSplitClear(currentGroup.id);
      }
    }, [pageMode, currentGroup?.id, fetchSplitClear]));
  ```
  Replace with:
  ```tsx
    // Gated on `!slots?.roster` so a v2 roster slot (which dropped the legacy
    // Split Planner, D-P3-2) doesn't fire the split-clear fetch; no-op on
    // legacy (`slots` undefined).
    useEffect(() => {
      if (pageMode === 'roster' && !slots?.roster && currentGroup?.id) {
        void fetchSplitClear(currentGroup.id);
      }
    }, [pageMode, slots?.roster, currentGroup?.id, fetchSplitClear]);
    useEffect(() => { return () => clearSplitClear(); }, [clearSplitClear]);

    // Silently refetch split-clear data when the user returns from another tab
    // (e.g. after linking characters on the profile page). Same `!slots?.roster`
    // gate as the mount fetch above.
    useVisibilityRefresh(useCallback(() => {
      if (pageMode === 'roster' && !slots?.roster && currentGroup?.id) {
        void fetchSplitClear(currentGroup.id);
      }
    }, [pageMode, slots?.roster, currentGroup?.id, fetchSplitClear]));
  ```
  The cleanup effect (`clearSplitClear`) is deliberately left unconditional — do not gate it. `slots?.roster` in a dependency array is the same optional-member-chain shape as the existing `currentGroup?.id` deps, so `react-hooks/exhaustive-deps` accepts it.

- [ ] **Step 4: Run tests, verify pass** — from `frontend/`:
  ```bash
  pnpm test src/pages/GroupViewContent.splitClearGate.test.tsx
  ```
  Expected: all 3 tests pass.

- [ ] **Step 5: Run the five pre-existing GroupViewContent suites** (all UNMODIFIED — the four restored ones are frozen, run-only — but GroupViewContent.tsx changed, legacy-shared, so all must stay green) — from `frontend/`:
  ```bash
  pnpm test src/pages/GroupViewContent.test.tsx src/pages/GroupViewContent.rosterSlot.test.tsx src/pages/GroupViewContent.slots.test.tsx src/pages/GroupViewContent.gearSlot.test.tsx src/pages/GroupViewContent.canManageRoster.test.tsx
  ```
  Expected: all suites pass, zero file modifications (`git status` must show none of these five test files as modified).

- [ ] **Step 6: Type-check + lint the touched frontend files** — from `frontend/` (CI runs `tsc -b`, which is stricter than `tsc --noEmit`):
  ```bash
  pnpm build
  pnpm exec eslint src/pages/GroupViewContent.tsx src/pages/GroupViewContent.splitClearGate.test.tsx
  ```
  Expected: build succeeds; eslint reports no new errors on either file.

- [ ] **Step 7: Commit the frontend fix** — from the repo root:
  ```bash
  git add frontend/src/pages/GroupViewContent.tsx frontend/src/pages/GroupViewContent.splitClearGate.test.tsx
  git commit -m "fix(redesign): phase-a — slot-gate the legacy split-clear fetch off the v2 roster slot (A13a)"
  ```

- [ ] **Step 8: Write the failing backend test** — two edits to `backend/tests/test_dev_auth.py`.

  Edit 1 — extend the imports.

  Current (test_dev_auth.py:5-12, first lines of the import block):
  ```python
  import pytest
  import pytest_asyncio
  from sqlalchemy import select
  from sqlalchemy.ext.asyncio import AsyncSession

  from app.models import Membership, MemberRole, SnapshotPlayer, User, UserAvailability
  from app.routers.dev_auth import DEV_USERS, _merge_duplicate_dev_users
  from tests.factories import (
  ```
  Replace with:
  ```python
  import pytest
  import pytest_asyncio
  from fastapi import Response
  from sqlalchemy import select
  from sqlalchemy.ext.asyncio import AsyncSession

  from app.models import Membership, MemberRole, SnapshotPlayer, User, UserAvailability
  from app.routers import dev_auth as dev_auth_module
  from app.routers.dev_auth import DEV_USERS, _merge_duplicate_dev_users, dev_login
  from tests.factories import (
  ```

  Edit 2 — append the new test class at the end of the file (after the closing line of `test_merge_duplicate_dev_member_repairs_links_and_removes_duplicate`, i.e. after line 97's final assert). The file-level `pytestmark = pytest.mark.asyncio` already covers the new async tests; the `session` fixture comes from `tests/conftest.py:113-123`. `dev_login` is called directly (FastAPI's route decorator returns the original function), with a real `fastapi.Response` — no HTTP client or dev-mode conftest infra exists for dev_auth, so the dev-mode guard is opened by monkeypatching the module-level `settings` instance that `_require_dev_mode` reads (dev_auth.py:36, 66-76; both are declared `Settings` fields so instance `setattr` is valid, and `monkeypatch` restores them at teardown):
  ```python


  class TestDevLoginTabPersistenceNormalization:
      """dev_login must reset drifted tab_persistence so e2e suites start stable (A13)."""

      @pytest.fixture
      def dev_mode(self, monkeypatch):
          """Open the dev-auth guard for direct dev_login calls.

          dev_auth reads the module-level `settings` object (dev_auth.py:36), so
          patch that instance; monkeypatch restores both attributes at teardown.
          """
          monkeypatch.setattr(dev_auth_module.settings, "environment", "development")
          monkeypatch.setattr(dev_auth_module.settings, "dev_auth_mode", True)

      async def test_dev_login_resets_drifted_tab_persistence(
          self,
          session: AsyncSession,
          dev_mode,
      ):
          seeded = await create_user(
              session,
              discord_id=DEV_USERS[0]["discord_id"],
              discord_username=DEV_USERS[0]["discord_username"],
          )
          seeded.tab_persistence = "reset"
          await session.flush()

          result = await dev_login(user_index=0, response=Response(), session=session)

          assert result["user_id"] == seeded.id
          row = (
              await session.execute(
                  select(User).where(User.discord_id == DEV_USERS[0]["discord_id"])
              )
          ).scalar_one()
          assert row.tab_persistence == "remember"

      async def test_dev_login_normalizes_only_the_logging_in_user(
          self,
          session: AsyncSession,
          dev_mode,
      ):
          owner = await create_user(
              session,
              discord_id=DEV_USERS[0]["discord_id"],
              discord_username=DEV_USERS[0]["discord_username"],
          )
          owner.tab_persistence = "reset"
          member = await create_user(
              session,
              discord_id=DEV_USERS[1]["discord_id"],
              discord_username=DEV_USERS[1]["discord_username"],
          )
          member.tab_persistence = "reset"
          await session.flush()

          await dev_login(user_index=1, response=Response(), session=session)

          member_row = (
              await session.execute(
                  select(User).where(User.discord_id == DEV_USERS[1]["discord_id"])
              )
          ).scalar_one()
          owner_row = (
              await session.execute(
                  select(User).where(User.discord_id == DEV_USERS[0]["discord_id"])
              )
          ).scalar_one()
          assert member_row.tab_persistence == "remember"
          # Deliberate: no 3-user sweep — each suite self-restores its own
          # login's preconditions (Phase A spec A13b).
          assert owner_row.tab_persistence == "reset"
  ```
  Notes on fixture reality: `create_user` (tests/factories.py:14-33) has no `tab_persistence` kwarg, so the attribute is set post-create (the column default seeds `'remember'`; the test overwrites it to `'reset'` before flush). Seeding by the exact `DEV_USERS` discord ids (`dev_owner_001`, `dev_member_002`) makes `_get_or_create_user` resolve the seeded rows instead of creating new ones. `dev_login` commits the session itself; the session fixture uses `expire_on_commit=False`, and re-querying by discord_id keeps the assertions independent of ORM identity.

- [ ] **Step 9: Run it, verify it fails** — from the repo root (Git Bash):
  ```bash
  cd backend && source venv/Scripts/activate && pytest tests/test_dev_auth.py -q
  ```
  Expected: 2 failures, 1 pass (the pre-existing merge test). Both new tests fail on the `== "remember"` assertion with `AssertionError: assert 'reset' == 'remember'` (no normalization exists yet). If either fails earlier with `404 Not Found` from `_require_dev_mode`, the `dev_mode` fixture isn't being applied — fix the fixture wiring, not the guard.

- [ ] **Step 10: Implement the normalization** — one edit to `backend/app/routers/dev_auth.py`, inside `dev_login`, between the is_public block and the commit. `user` (not `owner`) is correct: it is the resolved logging-in user across all three `user_index` branches (dev_auth.py:409-416).

  Current (dev_auth.py:431-433):
  ```python
      await session.commit()

      role_label = {0: "owner", 1: "member", 2: "applicant (no membership)"}.get(user_index, "member")
  ```
  Replace with:
  ```python
      # Reset drifted preference state so e2e suites get a stable starting point
      # (mirrors the is_public normalization above).
      if user.tab_persistence != "remember":
          user.tab_persistence = "remember"

      await session.commit()

      role_label = {0: "owner", 1: "member", 2: "applicant (no membership)"}.get(user_index, "member")
  ```
  Do not touch `user.updated_at` — parity with the is_public precedent, which doesn't bump `group.updated_at` for its normalization either. No new imports needed.

- [ ] **Step 11: Run tests, verify pass** — from the repo root (Git Bash):
  ```bash
  cd backend && source venv/Scripts/activate && pytest tests/test_dev_auth.py -q
  ```
  Expected: all 3 tests pass (`test_dev_auth.py` is the full existing suite for `dev_auth.py`).

- [ ] **Step 12: Full-suite check of every touched file** — the frontend full check already ran in Steps 5-6 (all five GroupViewContent suites + `pnpm build` + targeted eslint); the backend full check is Step 11. Re-run only if any implementation changed since those steps:
  ```bash
  cd frontend && pnpm test src/pages/GroupViewContent.test.tsx src/pages/GroupViewContent.rosterSlot.test.tsx src/pages/GroupViewContent.slots.test.tsx src/pages/GroupViewContent.gearSlot.test.tsx src/pages/GroupViewContent.canManageRoster.test.tsx
  cd backend && source venv/Scripts/activate && pytest tests/test_dev_auth.py -q
  ```
  Expected: everything green.

- [ ] **Step 13: Commit the backend fix** — from the repo root:
  ```bash
  git add backend/app/routers/dev_auth.py backend/tests/test_dev_auth.py
  git commit -m "fix(redesign): phase-a — dev_login normalizes tab_persistence to remember (A13b)"
  ```

---

### Task 15: Full gate + freeze verification

**Files:** none new (fallout fixes only).

**Interfaces:**
- Consumes: the whole branch (Tasks 1–14 committed).
- Produces: a PR-ready branch.

- [ ] **Step 1: Freeze check** — no file restored in Phase R is touched by this branch:

```bash
cd "D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner"
git diff --diff-filter=D --name-only f45a241 cf25c92 | sort > /tmp/phase-a-frozen.txt
git diff --name-only 810a48d..HEAD | sort > /tmp/phase-a-changed.txt
comm -12 /tmp/phase-a-frozen.txt /tmp/phase-a-changed.txt
# expect: NO output. (GroupRoute.tsx / GroupRoute.test.tsx / flip.spec.ts appear in the
# frozen list but were replaced with new code in Phase R; no Phase A task touches them
# either, so zero intersection is still the expected result — no exclusions needed.)
```

- [ ] **Step 2: Full CI gate**

```bash
cd frontend
pnpm build                          # tsc -b && vite build — must be clean
pnpm lint                           # 0 errors
pnpm check:design-system:strict
pnpm test                           # full Vitest suite green
pnpm tokens:check
git diff --check
cd ../backend && source venv/Scripts/activate && pytest tests/ -q   # all green incl. the new dev_login test
```

- [ ] **Step 3: Both smoke suites in ONE run** — needs live dev servers (backend :8001 +
  frontend :5174, each started as a BACKGROUND task per memory `project_dev_server_startup`):

```bash
cd frontend && pnpm exec playwright test e2e/smoke.spec.ts e2e/smoke-legacy.spec.ts
# expect: all green in a single run. Shared-file edits that reach both shells:
# Tasks 5 (A4), 6 (A5), 8 (A7), 9 (A8), 10 (A9), 11 (A10 Group B), 14 (A13a).
```

- [ ] **Step 4: Fix any fallout** (each fix stays within its originating task's file
  scope — a frozen file may NEVER carry a fix), then commit:

```bash
git add -A && git commit -m "chore(redesign): phase-a — full-gate fallout"
```
(Skip the commit if there was no fallout.)

---

## Post-task pipeline (execution session drives these; not subagent tasks)

1. **Whole-branch review** — `redesign-reviewer` over `git diff 810a48d..HEAD` with the
   spec + this plan; adjudicate findings at ultracode effort (per memory
   `feedback_effort_allocation`).
2. **Browser validation** (spec §5 exit gate; both shells wherever shared surfaces
   changed; chrome-devtools MCP): dev servers up; `/api/dev-auth/login/0` →
   `/group/DEVTST` (legacy default; `?shell=v2` for v2). **A2 verification needs a
   NON-owner login** (`/api/dev-auth/login/2`) to prove member self-edit. Checklist:
   - Add-player round-trip: toolbar Add → AddPlayerModal → configured player appears;
     open-seat Configure inline form works; open-seat Remove works — **delete the 6
     DEVTST orphan slots live via the new Remove affordance** (validates A1).
   - Member gear self-edit on the Board as user 2: own row editable, other rows inert.
   - Tome-weapon kebab toggle: label flips, persists across reload.
   - Leave Static (non-owner: confirm → toast → redirect to /profile?tab=statics) and
     Delete Static retarget (owner: lands on Settings → Static tab) — BOTH shells.
   - Rail: Player Hub → `/profile`, Static Finder → `/discover`.
   - Header UserMenu (sign-out) visible on `/discover`, `/docs`, `/dashboard`;
     still rail-only on `/profile` and group routes.
   - Mobile viewport (~390px): legacy banner reachable → switches to v2; v2 More-page
     "Switch to classic UI" → back to legacy (full round-trip).
   - Home activity feed shows loot + material rows interleaved with mount rows.
   - `/nonexistent-url` renders NotFound INSIDE Layout (Header visible).
   - Assign with zero needers: material-row Assign enabled → modal pre-filled with a
     fallback recipient; gear-row picker opens on All members with a pre-selected entry.
   - TopBar order ⌘K · invite · bell · theme · │ · settings; initials optically centered
     ('DT'/'TE'), both themes, both chip sizes (+ PriorityRow chips).
   - Schedule: new session on a Thursday defaults the day picker to TH; a legacy
     BYDAY≠DTSTART session's next-occurrence now matches the backend (spot-check one).
   Capture screenshots (mobile viewport for the toggle; light + dark for
   centering/TopBar), copy them OUT of the session scratchpad into
   `docs/redesign/pr-shots/phase-a-*.png`, commit.
3. **PR** into `redesign/foundation`: embed the screenshots; the body includes the
   **shared-file justification table** — one line per legacy-shared edit:
   `GroupViewContent.tsx` (A4/A5c additive optional-prop threading + A13a fetch gate),
   `MorePage.tsx` (A4 danger-zone bugfix + A5c additive prop),
   `Header.tsx` (A5b predicate bugfix + A5c mobile banner row),
   `CreateSessionModal.tsx` (A9 picker seeding),
   `utils/recurrence.ts` (A9 engine bugfix — existing mismatched sessions now match
   backend/Discord truth, the correct direction),
   `ScheduleIntegrationsPanel.tsx` (A10 Group B — 7 void'd-promise bugfixes matching
   in-file precedent; per-site lines from Task 11),
   `stores/authStore.ts` (A8 status-aware refresh),
   `App.tsx` (A7 additive catch-all route),
   `backend/app/routers/dev_auth.py` (A13b normalization) —
   plus the deferred/reported list (spec §4: frozen-file void sites, discord_webhook
   engine, fetchUser retry-catch, GearBoard tooltips, Archive product decision,
   divider primitive, LootPriorityPanel parity — **plus two plan-time discoveries**:
   Home.tsx's pre-existing unguarded re-throwing mount fetches [found in Task 7; same
   bug class, outside the A10 sweep's grep shape] and returned-but-not-awaited kebab
   onClick promises [Mark-as-Sub precedent, which the new tome toggle mirrors]). Also
   note in the body: A9's generalized day-scan now honors INTERVAL for multi-BYDAY
   rules too (backend parity; picker never emits INTERVAL, so no picker-created session
   changes); A11 keeps `disableAssign` weakened to `players.length === 0` (empty-roster
   guard — `players[0]` is not statically non-null); A4's Leave handler uses
   `effectiveUserId` (viewAs-aware — an admin in View As leaves on behalf of the
   impersonated user, consistent with View As semantics); A12's PriorityRow is the
   approved scope +1 (spec §6.6). THEN append the internal release-note entry (the PR
   number now exists):

   ```ts
   {
     internal: true,
     category: 'fix',
     title: 'Phase A — v2 flip-debt fixes',
     description: 'Thirteen fixes clearing v2 capability dead-ends and correctness traps (add-player flow, member gear self-edit, tome-weapon toggle, Danger Zone incl. self-service Leave Static, shell/nav gaps, loot in the activity feed, 404 page, auth 429 false-logout, BYDAY recurrence divergence, void-promise sweep, assign-with-no-needers, visual quick wins) plus the Phase-R follow-ups.',
     pr: <PR#>, prTitle: '<the PR title>',
   },
   ```

   Push, ensure CI green. NO AI attribution anywhere.
4. **pr-review-loop** until clean → squash-merge (merge guard requires checks green) →
   delete branch.
5. **Bookkeeping**: SESSION_HANDOFF.md · memory (`project_redesign_execution`) ·
   `.superpowers/sdd/progress.md` ledger · ROLLOUT_ROADMAP §3 status. Then **Phase G is
   USER-OWNED** (foundation→main, ROLLOUT_ROADMAP §4 checklist) — hard stop for the user.

## Self-review notes (spec → plan coverage + assembly reconciliation)

- Spec §2 A1–A13 → Tasks 2–14 one-to-one (A5's three sub-fixes co-tasked in Task 6;
  A12's two quick wins co-tasked in Task 13; A13's two follow-ups co-tasked in Task 14).
- Spec §3 sequencing → header Architecture note + per-task ORDER notes (A1↔A10 Roster,
  A3↔A10 kebab hook, A4↔A5 MorePage/GVC, A2 after A1).
- Spec §5 exit gate → Task 15 (CI + freeze + one-run smoke) + pipeline §2 (browser
  validation checklist incl. DEVTST orphan cleanup, non-owner login, mobile viewport,
  light/dark screenshots).
- Spec §6 skim defaults → all folded into the owning tasks (see Goal).
- Spec §4 deferred list → PR body (pipeline §3); no task touches a deferred item.
- **Cross-task contracts reconciled at assembly:** MorePageProps gains
  `onLeaveStatic?: () => void | Promise<void>` (Task 5) and
  `onSwitchToClassicUi?: () => void` (Task 6) — both drafted against disjoint anchors;
  Task 6 explicitly anchors on regions Task 5 doesn't touch. RosterCardsProps drops
  `onAddPlayer` / gains `onConfigurePlayer` (Task 2) — verified no other task passes
  `onAddPlayer` to RosterCards. GearBoardProps swaps `canManage` for the
  userRole/currentUserId/isAdminAccess trio (Task 3) — Task 2 doesn't touch the
  GearBoard call-site block. `App.test.tsx` is edited ONLY by Task 8 (full-file
  replacement is safe). `useRosterCardActions.test.tsx` `makePlayer()` gains a default
  `tomeWeapon` in Task 4; Task 11 edits the same suite later and inherits it.
- **Release note ownership:** every task intentionally omits `releaseNotes.ts`; the ONE
  internal entry lands at PR time (pipeline §3) — this satisfies the CI check because
  the check runs on the PR diff, which will include it.
- **Known accepted risks (disclosed in the owning sections):** Task 11 batches
  mount-fetch catches per effect via `Promise.all(...)` (one toast, not 2–4); 403s can
  double-toast on mutation sites (matches existing Loot.tsx precedent); Task 10's
  day-scan INTERVAL alignment also corrects multi-BYDAY interval>1 rules (backend
  parity); Task 9's three pre-passing regression pins and Task 14's pre-passing legacy
  pin are explicit TDD exceptions.
- **Adversarial verification record (2026-07-12, 14 verifiers: 13 per-section + 1
  cross-cutting seam check):** 3 distinct blockers found and FIXED in this document —
  (1) Task 14 originally edited FROZEN `GroupViewContent.rosterSlot.test.tsx` (the
  spec's own §2 prescription violated the freeze); relocated to a NEW suite
  `GroupViewContent.splitClearGate.test.tsx`, frozen suite untouched, Task 15's
  zero-intersection freeze check stays exact. (2)+(3) Task 11's two `Roster.test.tsx`
  scaffold anchors were stale post-Task-2 (RTL import + beforeEach block); re-anchored
  against the post-Task-2 state. Also fixed: 7× `venv/bin` → `venv/Scripts` (Windows
  venv layout, empirically verified), Task 10's contingency no longer permits editing
  frozen `SessionCard.test.tsx` (STOP-and-flag instead), Task 8's App-level test gained
  an explicit `10_000` it-timeout so the stated red signature is deterministic, plus
  ~15 prose/count corrections (test tallies, line hints, importer lists, claim
  wording). All 14 verifier verdicts adjudicated; no findings rejected.
