import { type FocusEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Scissors } from 'lucide-react';
import type { SnapshotPlayer } from '../../types';
import type { SplitClearAssignment, SplitLootTarget, SplitRunSlot } from '../../types';
import type { SplitClearAssignmentUpdate } from '../../stores/splitClearStore';
import { useSplitClearStore } from '../../stores/splitClearStore';
import { getSplitClearReadiness, getSplitClearWarnings } from '../../utils/splitClear';
import { Button } from '../primitives';
import { Checkbox, Input, Select } from '../ui';
import { JobIcon } from '../ui/JobIcon';

interface SplitClearPlannerProps {
  groupId: string;
  players: SnapshotPlayer[];
  canEdit: boolean;
}

const LOOT_TARGET_OPTIONS = [
  { value: 'funnel_main', label: 'Funnel → Main' },
  { value: 'funnel_job', label: 'Funnel → Job' },
  { value: 'normal', label: 'Normal' },
];

const RUN_SLOT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'main', label: 'Main' },
  { value: 'alt', label: 'Alt' },
];

function runSlotFromString(v: string): SplitRunSlot {
  if (v === 'main' || v === 'alt') return v;
  return null;
}

function lootTargetFromString(v: string): SplitLootTarget {
  if (v === 'funnel_main' || v === 'funnel_job') return v;
  return 'normal';
}

interface PlayerRowProps {
  player: SnapshotPlayer;
  assignment: SplitClearAssignment | undefined;
  warnings: string[];
  canEdit: boolean;
  onSave: (update: SplitClearAssignmentUpdate) => void;
}

function PlayerRow({ player, assignment, warnings, canEdit, onSave }: PlayerRowProps) {
  const a = assignment;

  // Local state for text inputs so typing is smooth; save happens on blur.
  const [mainName, setMainName] = useState(a?.mainCharacterName ?? '');
  const [mainWorld, setMainWorld] = useState(a?.mainCharacterWorld ?? '');
  const [altName, setAltName] = useState(a?.altCharacterName ?? '');
  const [altWorld, setAltWorld] = useState(a?.altCharacterWorld ?? '');

  function saveOnBlur(field: keyof SplitClearAssignmentUpdate) {
    return (e: FocusEvent<HTMLInputElement>) => {
      if (!canEdit) return;
      const val = e.currentTarget.value.trim() || null;
      onSave({ [field]: val });
    };
  }

  function patch<K extends keyof SplitClearAssignmentUpdate>(field: K, value: SplitClearAssignmentUpdate[K]) {
    if (!canEdit) return;
    onSave({ [field]: value });
  }

  const hasWarnings = warnings.length > 0;

  return (
    <tr className={`border-b border-border-subtle transition-colors hover:bg-surface-elevated/40 ${hasWarnings ? 'bg-status-warning/5' : ''}`}>
      {/* Player */}
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {player.job && <JobIcon job={player.job} size="sm" />}
          <span className="text-sm font-medium text-text-primary">{player.name || '—'}</span>
          {hasWarnings && (
            <span title={warnings.join('\n')}>
              <AlertTriangle className="h-3.5 w-3.5 text-status-warning flex-shrink-0" />
            </span>
          )}
        </div>
      </td>

      {/* Main character */}
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Input
            value={mainName}
            onChange={setMainName}
            onBlur={saveOnBlur('mainCharacterName')}
            placeholder="Character name"
            disabled={!canEdit}
            className="w-28 text-xs"
          />
          <Input
            value={mainWorld}
            onChange={setMainWorld}
            onBlur={saveOnBlur('mainCharacterWorld')}
            placeholder="World"
            disabled={!canEdit}
            className="w-20 text-xs"
          />
        </div>
      </td>

      {/* Alt character */}
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Input
            value={altName}
            onChange={setAltName}
            onBlur={saveOnBlur('altCharacterName')}
            placeholder="Alt name"
            disabled={!canEdit}
            className="w-28 text-xs"
          />
          <Input
            value={altWorld}
            onChange={setAltWorld}
            onBlur={saveOnBlur('altCharacterWorld')}
            placeholder="Alt world"
            disabled={!canEdit}
            className="w-20 text-xs"
          />
        </div>
      </td>

      {/* Run A */}
      <td className="px-3 py-2">
        <Select
          value={a?.runACharacter ?? ''}
          onChange={v => patch('runACharacter', runSlotFromString(v))}
          options={RUN_SLOT_OPTIONS}
          disabled={!canEdit}
          className="w-24 text-xs"
        />
      </td>

      {/* Run B */}
      <td className="px-3 py-2">
        <Select
          value={a?.runBCharacter ?? ''}
          onChange={v => patch('runBCharacter', runSlotFromString(v))}
          options={RUN_SLOT_OPTIONS}
          disabled={!canEdit}
          className="w-24 text-xs"
        />
      </td>

      {/* Job */}
      <td className="px-3 py-2">
        <span className="text-sm text-text-secondary">{player.job || '—'}</span>
      </td>

      {/* Loot target */}
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Select
            value={a?.lootTarget ?? 'normal'}
            onChange={v => patch('lootTarget', lootTargetFromString(v))}
            options={LOOT_TARGET_OPTIONS}
            disabled={!canEdit}
            className="w-36 text-xs"
          />
          {a?.lootTarget === 'funnel_job' && (
            <Input
              value={a?.lootTargetJob ?? ''}
              onChange={v => patch('lootTargetJob', v || null)}
              placeholder="e.g. DRG"
              disabled={!canEdit}
              className="w-24 text-xs"
            />
          )}
        </div>
      </td>

      {/* Run A cleared */}
      <td className="px-3 py-2 text-center">
        <Checkbox
          checked={a?.runACleared ?? false}
          onChange={v => patch('runACleared', v)}
          disabled={!canEdit}
          label=""
        />
      </td>

      {/* Run B cleared */}
      <td className="px-3 py-2 text-center">
        <Checkbox
          checked={a?.runBCleared ?? false}
          onChange={v => patch('runBCleared', v)}
          disabled={!canEdit}
          label=""
        />
      </td>

      {/* Warnings */}
      <td className="px-3 py-2 max-w-[180px]">
        {hasWarnings ? (
          <ul className="space-y-0.5">
            {warnings.map(w => (
              <li key={w} className="flex items-start gap-1 text-[11px] text-status-warning">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-status-success">
            <CheckCircle2 className="h-3 w-3" />
            Ready
          </span>
        )}
      </td>
    </tr>
  );
}

export function SplitClearPlanner({ groupId, players, canEdit }: SplitClearPlannerProps) {
  const { data, isSaving, error, toggleMode, updateAssignment, resetWeek } = useSplitClearStore();
  const [resetConfirm, setResetConfirm] = useState(false);

  if (!data) return null;

  // Hidden from read-only members when the feature isn't active.
  if (!data.enabled && !canEdit) return null;

  // Compact enable CTA for leads/owners when split mode is off.
  if (!data.enabled) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Scissors className="h-4 w-4 text-text-muted flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">Split Clear Planner</p>
              <p className="text-xs text-text-muted">Optional main/alt planning for split-clear runs</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="accent-subtle"
            onClick={() => void toggleMode(groupId, true)}
            disabled={isSaving}
          >
            Enable split planning
          </Button>
        </div>
      </div>
    );
  }

  const assignmentMap = new Map(data.assignments.map(a => [a.snapshotPlayerId, a]));
  const readiness = getSplitClearReadiness(players, data.assignments);

  function handleReset() {
    if (!resetConfirm) { setResetConfirm(true); setTimeout(() => setResetConfirm(false), 3000); return; }
    setResetConfirm(false);
    void resetWeek(groupId);
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Scissors className="h-5 w-5 text-accent flex-shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Split Clear Planner</h2>
            <p className="text-xs text-text-muted">
              {readiness.altCount}/{readiness.memberCount} members have alts assigned
              {readiness.issueMemberCount > 0 ? ` · ${readiness.issueMemberCount} assignment issue${readiness.issueMemberCount !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={handleReset}
              disabled={isSaving}
            >
              {resetConfirm ? 'Confirm reset?' : 'Reset week'}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border-subtle" data-testid="split-clear-board">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-raised text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              <th className="px-3 py-2.5">Player</th>
              <th className="px-3 py-2.5">Main Character</th>
              <th className="px-3 py-2.5">Alt Character</th>
              <th className="px-3 py-2.5">Run A</th>
              <th className="px-3 py-2.5">Run B</th>
              <th className="px-3 py-2.5">Job</th>
              <th className="px-3 py-2.5">Loot Target</th>
              <th className="px-3 py-2.5 text-center">A ✓</th>
              <th className="px-3 py-2.5 text-center">B ✓</th>
              <th className="px-3 py-2.5">Warnings</th>
            </tr>
          </thead>
          <tbody className="bg-surface-base">
            {players.map(player => {
              const assignment = assignmentMap.get(player.id);
              const warnings = getSplitClearWarnings(player, assignment);
              return (
                <PlayerRow
                  key={player.id}
                  player={player}
                  assignment={assignment}
                  warnings={warnings}
                  canEdit={canEdit}
                  onSave={update => void updateAssignment(groupId, player.id, update)}
                />
              );
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-text-muted">
                  No players in the current roster.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-text-muted px-1">
        Weekly clears, lockouts, and chest eligibility are manual.{' '}
        Does not claim alt-character or lockout coverage.
      </p>
    </div>
  );
}
