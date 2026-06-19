import { type FocusEvent, useState } from 'react';
import { CheckCircle2, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  SnapshotPlayer,
  SplitCharacterCandidate,
  SplitClearAssignment,
  SplitLootTarget,
  SplitRunSlot,
} from '../../types';
import type { SplitClearAssignmentUpdate } from '../../stores/splitClearStore';
import { useSplitClearStore } from '../../stores/splitClearStore';
import { useAuthStore } from '../../stores/authStore';
import { getSplitClearWarnings } from '../../utils/splitClear';
import { TONE_CHIP_CLASS } from '../../utils/splitClearHelpers';
import { Checkbox, Input, Select } from '../ui';
import { JobIcon } from '../ui/JobIcon';
import { CharacterSelector } from './CharacterSelector';

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

// ── Compact warning chips ──────────────────────────────────────────────────────

function compactWarningLabel(warning: string): string {
  if (/no main character/i.test(warning)) return 'No main';
  if (/no alt character/i.test(warning)) return 'No alt';
  if (/no main job/i.test(warning)) return 'No job';
  if (/run a is unassigned/i.test(warning)) return 'Run A unset';
  if (/run b is unassigned/i.test(warning)) return 'Run B unset';
  if (/same character is assigned to both/i.test(warning)) return 'Duplicate';
  if (/main and alt resolve to the same/i.test(warning)) return 'Same char';
  if (/loot target job is not selected/i.test(warning)) return 'No loot job';
  return 'Issue';
}

function WarningChips({ warnings, playerName }: { warnings: string[]; playerName: string }) {
  if (warnings.length === 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${TONE_CHIP_CLASS.success}`}>
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Ready
      </span>
    );
  }
  return (
    <div
      className="flex flex-wrap gap-1"
      aria-label={`Warnings for ${playerName}: ${warnings.join(', ')}`}
    >
      {warnings.map(w => (
        <span
          key={w}
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TONE_CHIP_CLASS.warning}`}
          title={w}
        >
          {compactWarningLabel(w)}
        </span>
      ))}
    </div>
  );
}

// ── Run slot badge (linked) ────────────────────────────────────────────────────

function RunSlotBadge({ char }: { char: SplitCharacterCandidate | null }) {
  if (!char) {
    return (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TONE_CHIP_CLASS.neutral}`}>
        —
      </span>
    );
  }
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${char.isMain ? TONE_CHIP_CLASS.info : TONE_CHIP_CLASS.suggested}`}
      title={`${char.name} @ ${char.server}`}
    >
      {char.isMain ? 'Main' : 'Alt'}
    </span>
  );
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

// ── Character select handlers ──────────────────────────────────────────────────

function makeRunASelector(
  candidates: SplitCharacterCandidate[],
  canEdit: boolean,
  onSave: (u: SplitClearAssignmentUpdate) => void,
) {
  return (id: string | null) => {
    if (!canEdit) return;
    const c = id ? candidates.find(x => x.id === id) : null;
    onSave({
      runACharacterLinkId: id,
      runACharacter: c ? (c.isMain ? 'main' : 'alt') : null,
    });
  };
}

function makeRunBSelector(
  candidates: SplitCharacterCandidate[],
  canEdit: boolean,
  onSave: (u: SplitClearAssignmentUpdate) => void,
) {
  return (id: string | null) => {
    if (!canEdit) return;
    const c = id ? candidates.find(x => x.id === id) : null;
    onSave({
      runBCharacterLinkId: id,
      runBCharacter: c ? (c.isMain ? 'main' : 'alt') : null,
    });
  };
}

// ── Desktop table row — grouped columns ───────────────────────────────────────

interface PlayerRowProps {
  player: SnapshotPlayer;
  assignment: SplitClearAssignment | undefined;
  candidates: SplitCharacterCandidate[];
  warnings: string[];
  canEdit: boolean;
  isOwnRow: boolean;
  onSave: (update: SplitClearAssignmentUpdate) => void;
}

function PlayerRow({ player, assignment, candidates, warnings, canEdit, isOwnRow, onSave }: PlayerRowProps) {
  const a = assignment;
  const { mainName, setMainName, mainWorld, setMainWorld, altName, setAltName, altWorld, setAltWorld, saveOnBlur, patch } =
    usePlayerEdit({ assignment, canEdit, onSave });

  const hasLinked = candidates.length > 0;
  const runALinkId = a?.runACharacterLinkId ?? null;
  const runBLinkId = a?.runBCharacterLinkId ?? null;
  const runALinkedChar = candidates.find(c => c.id === runALinkId) ?? null;
  const runBLinkedChar = candidates.find(c => c.id === runBLinkId) ?? null;

  const selectRunA = makeRunASelector(candidates, canEdit, onSave);
  const selectRunB = makeRunBSelector(candidates, canEdit, onSave);

  return (
    <tr className="border-b border-border-subtle transition-colors hover:bg-surface-elevated/30">
      {/* Player */}
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {player.job && <JobIcon job={player.job} size="sm" />}
          <span className="text-sm font-medium text-text-primary">{player.name || '—'}</span>
        </div>
      </td>

      {/* Characters */}
      <td className="px-3 py-2">
        {hasLinked ? (
          <div className="space-y-2">
            <CharacterSelector
              label="Run A"
              candidates={candidates}
              selectedId={runALinkId}
              conflictId={runBLinkId}
              onChange={selectRunA}
              canEdit={canEdit}
            />
            <CharacterSelector
              label="Run B"
              candidates={candidates}
              selectedId={runBLinkId}
              conflictId={runALinkId}
              onChange={selectRunB}
              canEdit={canEdit}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            {isOwnRow && canEdit && (
              <Link
                to="/profile?tab=sync"
                className="inline-flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover hover:underline"
              >
                <Link2 className="h-3 w-3" aria-hidden="true" />
                Link your Player Hub characters
              </Link>
            )}
            <div>
              <p className="text-[10px] font-semibold text-text-muted mb-0.5">Main</p>
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
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-muted mb-0.5">Alt</p>
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
            </div>
          </div>
        )}
      </td>

      {/* Runs */}
      <td className="px-3 py-2">
        {hasLinked ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-text-muted w-5">A</span>
              <RunSlotBadge char={runALinkedChar} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-text-muted w-5">B</span>
              <RunSlotBadge char={runBLinkedChar} />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-text-muted w-5">A</span>
              <Select
                value={a?.runACharacter ?? ''}
                onChange={v => patch('runACharacter', runSlotFromString(v))}
                options={RUN_SLOT_OPTIONS}
                disabled={!canEdit}
                className="w-20 text-xs"
                aria-label={`Run A character for ${player.name}`}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-text-muted w-5">B</span>
              <Select
                value={a?.runBCharacter ?? ''}
                onChange={v => patch('runBCharacter', runSlotFromString(v))}
                options={RUN_SLOT_OPTIONS}
                disabled={!canEdit}
                className="w-20 text-xs"
                aria-label={`Run B character for ${player.name}`}
              />
            </div>
          </div>
        )}
      </td>

      {/* Loot */}
      <td className="px-3 py-2">
        <div className="space-y-1">
          <Select
            value={a?.lootTarget ?? 'normal'}
            onChange={v => patch('lootTarget', lootTargetFromString(v))}
            options={LOOT_TARGET_OPTIONS}
            disabled={!canEdit}
            className="w-32 text-xs"
            aria-label={`Loot target for ${player.name}`}
          />
          {a?.lootTarget === 'funnel_job' && (
            <Input
              value={a?.lootTargetJob ?? ''}
              onChange={v => patch('lootTargetJob', v || null)}
              placeholder="e.g. DRG"
              disabled={!canEdit}
              className="w-20 text-xs"
              aria-label={`Funnel job for ${player.name}`}
            />
          )}
        </div>
      </td>

      {/* Weekly clear checkboxes */}
      <td className="px-3 py-2">
        <div className="space-y-1.5">
          <Checkbox
            checked={a?.runACleared ?? false}
            onChange={v => patch('runACleared', v)}
            disabled={!canEdit}
            label="A"
            aria-label={`Run A cleared for ${player.name}`}
          />
          <Checkbox
            checked={a?.runBCleared ?? false}
            onChange={v => patch('runBCleared', v)}
            disabled={!canEdit}
            label="B"
            aria-label={`Run B cleared for ${player.name}`}
          />
        </div>
      </td>

      {/* Status — compact warning chips */}
      <td className="px-3 py-2 min-w-[80px]">
        <WarningChips warnings={warnings} playerName={player.name} />
      </td>
    </tr>
  );
}

// ── Mobile member card ─────────────────────────────────────────────────────────

interface MobileMemberCardProps {
  player: SnapshotPlayer;
  assignment: SplitClearAssignment | undefined;
  candidates: SplitCharacterCandidate[];
  warnings: string[];
  canEdit: boolean;
  isOwnRow: boolean;
  onSave: (update: SplitClearAssignmentUpdate) => void;
}

function MobileMemberCard({ player, assignment, candidates, warnings, canEdit, isOwnRow, onSave }: MobileMemberCardProps) {
  const a = assignment;
  const { mainName, setMainName, mainWorld, setMainWorld, altName, setAltName, altWorld, setAltWorld, saveOnBlur, patch } =
    usePlayerEdit({ assignment, canEdit, onSave });

  const hasLinked = candidates.length > 0;
  const runALinkId = a?.runACharacterLinkId ?? null;
  const runBLinkId = a?.runBCharacterLinkId ?? null;
  const runALinkedChar = candidates.find(c => c.id === runALinkId) ?? null;
  const runBLinkedChar = candidates.find(c => c.id === runBLinkId) ?? null;

  const selectRunA = makeRunASelector(candidates, canEdit, onSave);
  const selectRunB = makeRunBSelector(candidates, canEdit, onSave);

  const hasWarnings = warnings.length > 0;

  return (
    <div
      className={`rounded-xl border bg-surface-raised p-3 space-y-3 ${
        hasWarnings ? 'border-status-warning/30' : 'border-border-subtle'
      }`}
    >
      {/* Header: player + status chips */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {player.job && <JobIcon job={player.job} size="sm" />}
          <span className="text-sm font-medium text-text-primary truncate">{player.name || '—'}</span>
        </div>
        <WarningChips warnings={warnings} playerName={player.name} />
      </div>

      {/* Characters / run selectors */}
      {hasLinked ? (
        <div className="space-y-2">
          <CharacterSelector
            label="Run A"
            candidates={candidates}
            selectedId={runALinkId}
            conflictId={runBLinkId}
            onChange={selectRunA}
            canEdit={canEdit}
          />
          <CharacterSelector
            label="Run B"
            candidates={candidates}
            selectedId={runBLinkId}
            conflictId={runALinkId}
            onChange={selectRunB}
            canEdit={canEdit}
          />
          {/* Run slot summary badges */}
          <div className="flex gap-3 pt-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-text-muted">A</span>
              <RunSlotBadge char={runALinkedChar} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-text-muted">B</span>
              <RunSlotBadge char={runBLinkedChar} />
            </div>
          </div>
        </div>
      ) : (
        <>
          {isOwnRow && canEdit && (
            <Link
              to="/profile?tab=sync"
              className="inline-flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover hover:underline"
            >
              <Link2 className="h-3 w-3" aria-hidden="true" />
              Link your Player Hub characters
            </Link>
          )}
          {/* Manual text inputs */}
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

          {/* Manual run slot selectors */}
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
        </>
      )}

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

      {/* Weekly clears */}
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
  const playerCharacters = useSplitClearStore(s => s.data?.playerCharacters ?? {});
  const currentUserId = useAuthStore(s => s.user?.id);

  return (
    <>
      {/* Desktop table — 6 grouped columns */}
      <div
        className="hidden sm:block overflow-x-auto rounded-xl border border-border-subtle"
        data-testid="split-clear-board"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-raised text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              <th className="px-3 py-2.5">Player</th>
              <th className="px-3 py-2.5">Characters</th>
              <th className="px-3 py-2.5">Runs</th>
              <th className="px-3 py-2.5">Loot</th>
              <th className="px-3 py-2.5">Weekly</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="bg-surface-base">
            {players.map(player => {
              const assignment = assignmentMap.get(player.id);
              const candidates = playerCharacters[player.id] ?? [];
              const warnings = getSplitClearWarnings(player, assignment);
              return (
                <PlayerRow
                  key={player.id}
                  player={player}
                  assignment={assignment}
                  candidates={candidates}
                  warnings={warnings}
                  canEdit={canEdit}
                  isOwnRow={!!currentUserId && player.userId === currentUserId}
                  onSave={update => onUpdate(player.id, update)}
                />
              );
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">
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
          const candidates = playerCharacters[player.id] ?? [];
          const warnings = getSplitClearWarnings(player, assignment);
          return (
            <MobileMemberCard
              key={player.id}
              player={player}
              assignment={assignment}
              candidates={candidates}
              warnings={warnings}
              canEdit={canEdit}
              isOwnRow={!!currentUserId && player.userId === currentUserId}
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
