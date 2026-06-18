import { UserPlus } from 'lucide-react';
import type { SplitCharacterCandidate } from '../../types';
import { Button } from '../primitives';
import { formatSyncLabel, isSyncStale } from '../../utils/splitClearScoringService';

// ── Sync freshness badge ───────────────────────────────────────────────────────

function SyncBadge({ candidate }: { candidate: SplitCharacterCandidate }) {
  const stale = isSyncStale(candidate.lastSyncedAt);
  const label = formatSyncLabel(candidate.lastSyncedAt, candidate.syncSource);
  return (
    <span
      className={`text-[9px] font-medium px-1 py-0.5 rounded ${
        stale ? 'text-status-warning bg-status-warning/10' : 'text-status-success bg-status-success/10'
      }`}
    >
      {label}
    </span>
  );
}

// ── Character option button ────────────────────────────────────────────────────

interface CharacterOptionProps {
  candidate: SplitCharacterCandidate;
  isSelected: boolean;
  isConflict: boolean;  // other run already uses this character
  onSelect: (id: string) => void;
}

function CharacterOption({ candidate, isSelected, isConflict, onSelect }: CharacterOptionProps) {
  const label = candidate.isMain ? 'Main' : 'Alt';
  return (
    <button
      type="button"
      onClick={() => onSelect(candidate.id)}
      disabled={isConflict && !isSelected}
      className={`
        flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors
        ${isSelected
          ? 'border-accent bg-accent/10 text-text-primary'
          : isConflict
            ? 'border-border-subtle/40 bg-surface-base opacity-40 cursor-not-allowed text-text-muted'
            : 'border-border-subtle bg-surface-base hover:border-accent/50 text-text-secondary hover:text-text-primary'
        }
      `}
      aria-pressed={isSelected}
      aria-label={`${label} character: ${candidate.name} @ ${candidate.server}${isConflict ? ' (used in other run)' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`text-[9px] font-bold uppercase tracking-wide ${
            candidate.isMain ? 'text-role-tank' : 'text-text-muted'
          }`}
        >
          {label}
        </span>
        <span className="text-[11px] font-semibold">{candidate.name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-text-muted">{candidate.server}</span>
        {candidate.lastSyncedAt !== undefined && <SyncBadge candidate={candidate} />}
      </div>
    </button>
  );
}

// ── CharacterSelector ──────────────────────────────────────────────────────────

interface CharacterSelectorProps {
  label: string;
  candidates: SplitCharacterCandidate[];
  selectedId: string | null;
  conflictId: string | null;  // character selected in the OTHER run (warn on duplicate)
  onChange: (id: string | null) => void;
  canEdit: boolean;
}

export function CharacterSelector({
  label,
  candidates,
  selectedId,
  conflictId,
  onChange,
  canEdit,
}: CharacterSelectorProps) {
  if (!canEdit) {
    // Read-only: show selected character name or placeholder
    const selected = candidates.find(c => c.id === selectedId);
    return (
      <div className="space-y-0.5">
        <span className="text-[10px] text-text-muted uppercase tracking-wide">{label}</span>
        <p className="text-xs text-text-primary">
          {selected ? `${selected.name} @ ${selected.server}` : <span className="text-text-muted">—</span>}
        </p>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="space-y-1">
        <span className="text-[10px] text-text-muted uppercase tracking-wide">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={<UserPlus className="h-3 w-3" aria-hidden="true" />}
          className="text-[10px]"
          disabled
        >
          No linked characters
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-text-muted uppercase tracking-wide">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {candidates.map(c => (
          <CharacterOption
            key={c.id}
            candidate={c}
            isSelected={selectedId === c.id}
            isConflict={conflictId === c.id && selectedId !== c.id}
            onSelect={(id) => onChange(selectedId === id ? null : id)}
          />
        ))}
      </div>
    </div>
  );
}
