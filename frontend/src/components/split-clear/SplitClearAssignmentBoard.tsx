import { type FocusEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SnapshotPlayer, SplitClearAssignment, SplitLootTarget, SplitRunSlot } from '../../types';
import type { SplitClearAssignmentUpdate } from '../../stores/splitClearStore';
import { getSplitClearWarnings } from '../../utils/splitClear';
import { Badge } from '../primitives';
import { Checkbox, Input, Select } from '../ui';
import { JobIcon } from '../ui/JobIcon';

// ── Constants ──────────────────────────────────────────────────────────────────

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

// ── Shared save hook ───────────────────────────────────────────────────────────

interface UsePlayerEditProps {
  assignment: SplitClearAssignment | undefined;
  canEdit: boolean;
  onSave: (update: SplitClearAssignmentUpdate) => void;
}

function usePlayerEdit({ assignment, canEdit, onSave }: UsePlayerEditProps) {
  const [mainName, setMainName] = useState(assignment?.mainCharacterName ?? '');
  const [mainWorld, setMainWorld] = useState(assignment?.mainCharacterWorld ?? '');
  const [altName, setAltName] = useState(assignment?.altCharacterName ?? '');
  const [altWorld, setAltWorld] = useState(assignment?.altCharacterWorld ?? '');

  function saveOnBlur(field: keyof SplitClearAssignmentUpdate) {
    return (e: FocusEvent<HTMLInputElement>) => {
      if (!canEdit) return;
      const val = e.currentTarget.value.trim() || null;
      onSave({ [field]: val });
    };
  }

  function patch<K extends keyof SplitClearAssignmentUpdate>(
    field: K,
    value: SplitClearAssignmentUpdate[K],
  ) {
    if (!canEdit) return;
    onSave({ [field]: value });
  }

  return { mainName, setMainName, mainWorld, setMainWorld, altName, setAltName, altWorld, setAltWorld, saveOnBlur, patch };
}

// ── Desktop table row ──────────────────────────────────────────────────────────

interface PlayerRowProps {
  player: SnapshotPlayer;
  assignment: SplitClearAssignment | undefined;
  warnings: string[];
  canEdit: boolean;
  onSave: (update: SplitClearAssignmentUpdate) => void;
}

function PlayerRow({ player, assignment, warnings, canEdit, onSave }: PlayerRowProps) {
  const a = assignment;
  const { mainName, setMainName, mainWorld, setMainWorld, altName, setAltName, altWorld, setAltWorld, saveOnBlur, patch } =
    usePlayerEdit({ assignment, canEdit, onSave });
  const hasWarnings = warnings.length > 0;

  return (
    <tr
      className={`border-b border-border-subtle transition-colors hover:bg-surface-elevated/40 ${
        hasWarnings ? 'bg-status-warning/5' : ''
      }`}
    >
      {/* Player */}
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {player.job && <JobIcon job={player.job} size="sm" />}
          <span className="text-sm font-medium text-text-primary">{player.name || '—'}</span>
          {hasWarnings && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-status-warning flex-shrink-0"
              aria-hidden="true"
              title={warnings.join('\n')}
            />
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
            aria-label={`Main character name for ${player.name}`}
          />
          <Input
            value={mainWorld}
            onChange={setMainWorld}
            onBlur={saveOnBlur('mainCharacterWorld')}
            placeholder="World"
            disabled={!canEdit}
            className="w-20 text-xs"
            aria-label={`Main character world for ${player.name}`}
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
            aria-label={`Alt character name for ${player.name}`}
          />
          <Input
            value={altWorld}
            onChange={setAltWorld}
            onBlur={saveOnBlur('altCharacterWorld')}
            placeholder="Alt world"
            disabled={!canEdit}
            className="w-20 text-xs"
            aria-label={`Alt character world for ${player.name}`}
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
          aria-label={`Run A character for ${player.name}`}
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
          aria-label={`Run B character for ${player.name}`}
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
            aria-label={`Loot target for ${player.name}`}
          />
          {a?.lootTarget === 'funnel_job' && (
            <Input
              value={a?.lootTargetJob ?? ''}
              onChange={v => patch('lootTargetJob', v || null)}
              placeholder="e.g. DRG"
              disabled={!canEdit}
              className="w-24 text-xs"
              aria-label={`Funnel job for ${player.name}`}
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
          aria-label={`Run A cleared for ${player.name}`}
        />
      </td>

      {/* Run B cleared */}
      <td className="px-3 py-2 text-center">
        <Checkbox
          checked={a?.runBCleared ?? false}
          onChange={v => patch('runBCleared', v)}
          disabled={!canEdit}
          label=""
          aria-label={`Run B cleared for ${player.name}`}
        />
      </td>

      {/* Status */}
      <td className="px-3 py-2 max-w-[180px]">
        {hasWarnings ? (
          <ul className="space-y-0.5" aria-label={`Warnings for ${player.name}`}>
            {warnings.map(w => (
              <li key={w} className="flex items-start gap-1 text-[11px] text-status-warning">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-status-success">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Ready
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Mobile member card ─────────────────────────────────────────────────────────

interface MobileMemberCardProps {
  player: SnapshotPlayer;
  assignment: SplitClearAssignment | undefined;
  warnings: string[];
  canEdit: boolean;
  onSave: (update: SplitClearAssignmentUpdate) => void;
}

function MobileMemberCard({ player, assignment, warnings, canEdit, onSave }: MobileMemberCardProps) {
  const a = assignment;
  const { mainName, setMainName, mainWorld, setMainWorld, altName, setAltName, altWorld, setAltWorld, saveOnBlur, patch } =
    usePlayerEdit({ assignment, canEdit, onSave });
  const hasWarnings = warnings.length > 0;

  return (
    <div
      className={`rounded-xl border bg-surface-raised p-3 space-y-3 ${
        hasWarnings ? 'border-status-warning/30' : 'border-border-subtle'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {player.job && <JobIcon job={player.job} size="sm" />}
          <span className="text-sm font-medium text-text-primary truncate">{player.name || '—'}</span>
          {player.job && (
            <span className="text-[10px] text-text-muted hidden xs:inline">{player.job}</span>
          )}
        </div>
        {hasWarnings ? (
          <Badge variant="warning" size="sm">
            {warnings.length} issue{warnings.length !== 1 ? 's' : ''}
          </Badge>
        ) : (
          <Badge variant="success" size="sm">Ready</Badge>
        )}
      </div>

      {/* Characters */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Main</p>
          <Input
            value={mainName}
            onChange={setMainName}
            onBlur={saveOnBlur('mainCharacterName')}
            placeholder="Character name"
            disabled={!canEdit}
            className="text-xs"
            aria-label={`Main character name for ${player.name}`}
          />
          <Input
            value={mainWorld}
            onChange={setMainWorld}
            onBlur={saveOnBlur('mainCharacterWorld')}
            placeholder="World"
            disabled={!canEdit}
            className="text-xs"
            aria-label={`Main character world for ${player.name}`}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Alt</p>
          <Input
            value={altName}
            onChange={setAltName}
            onBlur={saveOnBlur('altCharacterName')}
            placeholder="Alt name"
            disabled={!canEdit}
            className="text-xs"
            aria-label={`Alt character name for ${player.name}`}
          />
          <Input
            value={altWorld}
            onChange={setAltWorld}
            onBlur={saveOnBlur('altCharacterWorld')}
            placeholder="Alt world"
            disabled={!canEdit}
            className="text-xs"
            aria-label={`Alt character world for ${player.name}`}
          />
        </div>
      </div>

      {/* Run assignments */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Run A</p>
          <Select
            value={a?.runACharacter ?? ''}
            onChange={v => patch('runACharacter', runSlotFromString(v))}
            options={RUN_SLOT_OPTIONS}
            disabled={!canEdit}
            className="text-xs"
            aria-label={`Run A character for ${player.name}`}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Run B</p>
          <Select
            value={a?.runBCharacter ?? ''}
            onChange={v => patch('runBCharacter', runSlotFromString(v))}
            options={RUN_SLOT_OPTIONS}
            disabled={!canEdit}
            className="text-xs"
            aria-label={`Run B character for ${player.name}`}
          />
        </div>
      </div>

      {/* Loot target */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Loot target</p>
        <Select
          value={a?.lootTarget ?? 'normal'}
          onChange={v => patch('lootTarget', lootTargetFromString(v))}
          options={LOOT_TARGET_OPTIONS}
          disabled={!canEdit}
          className="text-xs"
          aria-label={`Loot target for ${player.name}`}
        />
        {a?.lootTarget === 'funnel_job' && (
          <Input
            value={a?.lootTargetJob ?? ''}
            onChange={v => patch('lootTargetJob', v || null)}
            placeholder="e.g. DRG"
            disabled={!canEdit}
            className="text-xs"
            aria-label={`Funnel job for ${player.name}`}
          />
        )}
      </div>

      {/* Weekly clear status */}
      <div className="flex gap-4 pt-1 border-t border-border-subtle">
        <Checkbox
          checked={a?.runACleared ?? false}
          onChange={v => patch('runACleared', v)}
          disabled={!canEdit}
          label="Run A cleared"
        />
        <Checkbox
          checked={a?.runBCleared ?? false}
          onChange={v => patch('runBCleared', v)}
          disabled={!canEdit}
          label="Run B cleared"
        />
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-1 pt-1 border-t border-border-subtle">
          {warnings.map(w => (
            <p key={w} className="flex items-start gap-1 text-[11px] text-status-warning">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────────

interface SplitClearAssignmentBoardProps {
  players: SnapshotPlayer[];
  assignmentMap: Map<string, SplitClearAssignment>;
  canEdit: boolean;
  onUpdate: (playerId: string, update: SplitClearAssignmentUpdate) => void;
}

export function SplitClearAssignmentBoard({
  players,
  assignmentMap,
  canEdit,
  onUpdate,
}: SplitClearAssignmentBoardProps) {
  return (
    <>
      {/* Desktop table */}
      <div
        className="hidden sm:block overflow-x-auto rounded-xl border border-border-subtle"
        data-testid="split-clear-board"
      >
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
              <th className="px-3 py-2.5 text-center" aria-label="Run A cleared">A ✓</th>
              <th className="px-3 py-2.5 text-center" aria-label="Run B cleared">B ✓</th>
              <th className="px-3 py-2.5">Status</th>
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
                  onSave={update => onUpdate(player.id, update)}
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

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {players.map(player => {
          const assignment = assignmentMap.get(player.id);
          const warnings = getSplitClearWarnings(player, assignment);
          return (
            <MobileMemberCard
              key={player.id}
              player={player}
              assignment={assignment}
              warnings={warnings}
              canEdit={canEdit}
              onSave={update => onUpdate(player.id, update)}
            />
          );
        })}
        {players.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">
            No players in the current roster.
          </p>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-text-muted px-1">
        Weekly clears, lockouts, and chest eligibility are manual.{' '}
        Does not claim alt-character or lockout coverage.
      </p>
    </>
  );
}
