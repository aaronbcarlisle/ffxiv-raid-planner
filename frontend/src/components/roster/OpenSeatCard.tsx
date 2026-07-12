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
