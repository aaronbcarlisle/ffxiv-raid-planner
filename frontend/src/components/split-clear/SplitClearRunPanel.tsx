import type { SnapshotPlayer } from '../../types';
import type { DraftPlayerAssignment } from '../../utils/splitClearSuggestionService';
import { TONE_CHIP_CLASS, formatLootTarget } from '../../utils/splitClearHelpers';
import { JobIcon } from '../ui/JobIcon';

// ── Per-player row inside a run panel ──────────────────────────────────────────

interface RunPanelRowProps {
  player: SnapshotPlayer | undefined;
  assignment: DraftPlayerAssignment;
  run: 'A' | 'B';
  showLoot?: boolean;
}

function RunPanelRow({ player, assignment, run, showLoot = false }: RunPanelRowProps) {
  const slot = run === 'A' ? assignment.runACharacter : assignment.runBCharacter;
  const charName = slot === 'main'
    ? assignment.mainCharacterName
    : slot === 'alt'
      ? assignment.altCharacterName
      : null;
  const world = slot === 'main'
    ? assignment.mainCharacterWorld
    : slot === 'alt'
      ? assignment.altCharacterWorld
      : null;

  const chipClass =
    slot === 'main' ? TONE_CHIP_CLASS.info :
    slot === 'alt'  ? TONE_CHIP_CLASS.suggested :
    TONE_CHIP_CLASS.warning;

  const chipLabel =
    slot === 'main' ? 'Main' :
    slot === 'alt'  ? 'Alt'  :
    'Needs alt';

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border-subtle/40 last:border-0">
      {/* Player identity */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {player?.job && <JobIcon job={player.job} size="sm" />}
        <span className="text-xs font-medium text-text-primary truncate">
          {player?.name ?? '—'}
        </span>
      </div>

      {/* Slot chip + character name + optional loot */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${chipClass}`}
          aria-label={`Run ${run} character slot for ${player?.name ?? 'player'}`}
        >
          {chipLabel}
        </span>
        {charName && (
          <span className="text-[10px] text-text-muted truncate max-w-[80px]" title={world ? `${charName} @ ${world}` : charName}>
            {charName}
          </span>
        )}
        {showLoot && assignment.lootTarget !== 'normal' && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TONE_CHIP_CLASS.info}`}>
            {formatLootTarget(assignment.lootTarget)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Run panel ──────────────────────────────────────────────────────────────────

interface SplitClearRunPanelProps {
  run: 'A' | 'B';
  assignments: DraftPlayerAssignment[];
  players: SnapshotPlayer[];
}

export function SplitClearRunPanel({ run, assignments, players }: SplitClearRunPanelProps) {
  const playerMap = new Map(players.map(p => [p.id, p]));

  const mainCount = assignments.filter(a =>
    (run === 'A' ? a.runACharacter : a.runBCharacter) === 'main'
  ).length;
  const altCount = assignments.filter(a =>
    (run === 'A' ? a.runACharacter : a.runBCharacter) === 'alt'
  ).length;

  return (
    <div
      role="region"
      className="flex-1 rounded-xl border border-border-subtle bg-surface-raised p-3 space-y-2"
      aria-label={`Run ${run} panel`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
          Run {run}
        </h3>
        <span className="text-[10px] text-text-muted tabular-nums">
          {mainCount}M · {altCount}A
        </span>
      </div>

      <div>
        {assignments.map(a => (
          <RunPanelRow
            key={a.playerId}
            player={playerMap.get(a.playerId)}
            assignment={a}
            run={run}
            showLoot={run === 'A'}
          />
        ))}
      </div>
    </div>
  );
}
