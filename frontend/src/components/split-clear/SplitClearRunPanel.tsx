import type { SnapshotPlayer } from '../../types';
import type { DraftPlayerAssignment } from '../../utils/splitClearSuggestionService';
import { TONE_CHIP_CLASS, formatLootTarget } from '../../utils/splitClearHelpers';
import { formatSyncLabel, isSyncStale } from '../../utils/splitClearScoringService';
import { JobIcon } from '../ui/JobIcon';

// ── Per-player row inside a run panel ──────────────────────────────────────────

interface RunPanelRowProps {
  player: SnapshotPlayer | undefined;
  assignment: DraftPlayerAssignment;
  run: 'A' | 'B';
  showLoot?: boolean;
}

function RunPanelRow({ player, assignment, run, showLoot = false }: RunPanelRowProps) {
  const isRunA = run === 'A';

  const charName   = isRunA ? assignment.runACharacterName   : assignment.runBCharacterName;
  const charWorld  = isRunA ? assignment.runACharacterWorld  : assignment.runBCharacterWorld;
  const isMain     = isRunA ? assignment.runAIsMain          : assignment.runBIsMain;
  const lastSynced = isRunA ? assignment.runALastSyncedAt    : assignment.runBLastSyncedAt;
  const hasLink    = isRunA ? !!assignment.runACharacterLinkId : !!assignment.runBCharacterLinkId;
  const slotLabel  = isRunA ? assignment.runACharacter       : assignment.runBCharacter;

  const isUnset = !charName;

  const chipClass =
    isUnset ? TONE_CHIP_CLASS.warning :
    isMain  ? TONE_CHIP_CLASS.info :
              TONE_CHIP_CLASS.suggested;

  const chipLabel =
    isUnset             ? 'Needs alt' :
    hasLink && isMain   ? 'Main' :
    hasLink && !isMain  ? 'Alt' :
    slotLabel === 'main' ? 'Main' :
    slotLabel === 'alt'  ? 'Alt' :
    'Manual';

  const syncStale = hasLink && !!lastSynced && isSyncStale(lastSynced);

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border-subtle/40 last:border-0">
      {/* Player identity */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {player?.job && <JobIcon job={player.job} size="sm" />}
        <span className="text-xs font-medium text-text-primary truncate">
          {player?.name ?? '—'}
        </span>
      </div>

      {/* Character info */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${chipClass}`}
          aria-label={`Run ${run} character slot for ${player?.name ?? 'player'}`}
        >
          {chipLabel}
        </span>

        {charName && (
          <span
            className="text-[10px] text-text-muted truncate max-w-[90px]"
            title={charWorld ? `${charName} @ ${charWorld}` : charName}
          >
            {charName}
            {charWorld && <span className="opacity-60"> @ {charWorld}</span>}
          </span>
        )}

        {syncStale && (
          <span className="text-[9px] text-status-warning font-medium" title="Stale sync">
            {formatSyncLabel(lastSynced, null)}
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
  const isRunA = run === 'A';

  const mainCount = assignments.filter(a => (isRunA ? a.runAIsMain : a.runBIsMain)).length;
  const altCount  = assignments.filter(a => {
    const name = isRunA ? a.runACharacterName : a.runBCharacterName;
    const isMn = isRunA ? a.runAIsMain        : a.runBIsMain;
    return name && !isMn;
  }).length;

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
