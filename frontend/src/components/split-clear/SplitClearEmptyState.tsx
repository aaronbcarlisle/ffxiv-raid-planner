import { Scissors, Wand2, Edit3 } from 'lucide-react';
import type { SnapshotPlayer, SplitClearData } from '../../types';
import { TONE_CHIP_CLASS } from '../../utils/splitClearHelpers';
import { computeCharacterSourceSummary } from '../../utils/splitClearScoringService';
import { Button } from '../primitives';

// ── Source preview chip ────────────────────────────────────────────────────────

function SourcePreviewChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        active ? TONE_CHIP_CLASS.success : TONE_CHIP_CLASS.neutral
      }`}
    >
      {label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SplitClearEmptyStateProps {
  players: SnapshotPlayer[];
  data: SplitClearData;
  canEdit: boolean;
  isSaving: boolean;
  onGenerateDraft: () => void;
  onStartManually: () => void;
}

export function SplitClearEmptyState({
  players,
  data,
  canEdit,
  isSaving,
  onGenerateDraft,
  onStartManually,
}: SplitClearEmptyStateProps) {
  const rosterCount = players.length;
  const priorityCount = players.filter(p => (p.weaponPriorities?.length ?? 0) > 0).length;

  const playerCharacters = data.playerCharacters ?? {};
  const charSummary = computeCharacterSourceSummary(
    players.map(p => p.id),
    playerCharacters,
  );

  const allLinked   = charSummary.linkedCount === rosterCount && rosterCount > 0;
  const altsLabel   = charSummary.altCount === 0
    ? `Alts — none`
    : `Alts ${charSummary.altCount}/${rosterCount} members`;

  const totalLinked = Object.values(playerCharacters).reduce((n, cs) => n + cs.length, 0);

  return (
    <div className="rounded-xl border border-accent/20 bg-surface-raised p-6 space-y-5">
      {/* Identity */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent/10 shrink-0">
          <Scissors className="h-5 w-5 text-accent" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-text-primary">Split Clear Composer</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Plan main/alt runs and loot targets using roster and weapon priority.
          </p>
        </div>
      </div>

      {/* Available data */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
          Available data
        </p>
        <div className="flex flex-wrap gap-1.5" aria-label="Available data sources">
          <SourcePreviewChip label={`Roster ${rosterCount}/${rosterCount}`} active />
          <SourcePreviewChip
            label={`Linked chars ${charSummary.linkedCount}/${rosterCount}${totalLinked > 0 ? ` (${totalLinked} total)` : ''}`}
            active={allLinked}
          />
          <SourcePreviewChip
            label={altsLabel}
            active={charSummary.altCount === rosterCount && rosterCount > 0}
          />
          <SourcePreviewChip
            label={priorityCount > 0 ? `Priority ${priorityCount}/${rosterCount}` : 'Priority missing'}
            active={priorityCount > 0}
          />
          {charSummary.recentSyncCount > 0 && (
            <SourcePreviewChip
              label={`Sync ${charSummary.recentSyncCount} recent${charSummary.staleSyncCount > 0 ? ` / ${charSummary.staleSyncCount} stale` : ''}`}
              active={charSummary.staleSyncCount === 0}
            />
          )}
          <SourcePreviewChip label="Loot log — not used" active={false} />
          <SourcePreviewChip label="Plugin — sync context only" active={false} />
        </div>
      </div>

      {/* Actions — editor only */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="accent-subtle"
            leftIcon={<Wand2 className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onGenerateDraft}
            disabled={isSaving}
            aria-label="Generate draft plan"
          >
            Generate draft
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<Edit3 className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onStartManually}
            disabled={isSaving}
            aria-label="Start manually"
          >
            Start manually
          </Button>
        </div>
      )}
    </div>
  );
}
