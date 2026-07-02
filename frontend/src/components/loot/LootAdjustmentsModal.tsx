/**
 * LootAdjustmentsModal — the re-homed "Adjust Priority" surface (F6d, spec §2.6).
 *
 * Consolidates two legacy, per-player knobs into ONE Loot-owned modal:
 *  - the roster-kebab "Adjust Priority" (`PriorityAdjustModal` — `priorityModifier`,
 *    a flat score offset), and
 *  - the settings "Player Loot Adjustments" (`PlayerAdjustmentsModal` —
 *    `lootAdjustment`, which weights fair-share history for mid-tier joins).
 *
 * Both legacy modals stay untouched and retire at the parity flip; this is a
 * NEW surface, not a repoint. Draft state is seeded from the player's current
 * values ONLY on the open transition (wasOpenRef pattern, mirrors
 * RecipientPicker.tsx) so a mid-open store churn can't silently reset in-progress
 * edits. Saving diffs the draft against that seed and reports only the players
 * whose loot adjustment OR priority modifier actually changed — but each
 * reported update always carries BOTH current values (Task 9's `onSave` payload
 * contract), since a player's row is a single unit even if only one knob moved.
 */
import { useEffect, useRef, useState } from 'react';
import { Gauge, RotateCcw } from 'lucide-react';
import { Modal, NumberInput, Label } from '../ui';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { toast } from '../../stores/toastStore';
import {
  PRIORITY_MODIFIER_MIN,
  PRIORITY_MODIFIER_MAX,
  PRIORITY_MODIFIER_STEP,
} from '../../utils/constants';
import type { SnapshotPlayer } from '../../types';

export interface AdjustmentUpdate {
  playerId: string;
  lootAdjustment: number;
  priorityModifier: number;
}

export interface LootAdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: SnapshotPlayer[];
  onSave: (updates: AdjustmentUpdate[]) => Promise<void>;
}

interface DraftEntry {
  lootAdjustment: number;
  priorityModifier: number;
}

function seedFrom(players: SnapshotPlayer[]): Record<string, DraftEntry> {
  const seed: Record<string, DraftEntry> = {};
  players.forEach((p) => {
    seed[p.id] = {
      lootAdjustment: p.lootAdjustment ?? 0,
      priorityModifier: p.priorityModifier ?? 0,
    };
  });
  return seed;
}

export function LootAdjustmentsModal({ isOpen, onClose, players, onSave }: LootAdjustmentsModalProps) {
  const [seed, setSeed] = useState<Record<string, DraftEntry>>({});
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fallback for a player with NO draft/seed entry (added to `players` mid-open,
  // after the open-transition seed ran): use the player's LIVE values rather than
  // literal zeros, so an untouched mid-open arrival never gets silently zeroed.
  const fallbackFor = (playerId: string): DraftEntry => {
    const p = players.find((x) => x.id === playerId);
    return { lootAdjustment: p?.lootAdjustment ?? 0, priorityModifier: p?.priorityModifier ?? 0 };
  };

  // Seed the draft ONLY on the open transition (closed -> open) — mirrors
  // RecipientPicker.tsx's wasOpenRef guard so an in-progress edit can't be
  // silently reverted by a mid-open roster refresh.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const nextSeed = seedFrom(players);
      setSeed(nextSeed);
      setDraft(nextSeed);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, players]);

  const handleChange = (playerId: string, field: keyof DraftEntry, value: number | null) => {
    setDraft((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? fallbackFor(playerId)),
        [field]: value ?? 0,
      },
    }));
  };

  const handleResetAll = () => {
    // Iterate `players` (not the draft keys) so a mid-open arrival is zeroed too.
    const next: Record<string, DraftEntry> = {};
    players.forEach((p) => {
      next[p.id] = { lootAdjustment: 0, priorityModifier: 0 };
    });
    setDraft(next);
  };

  const handleSave = async () => {
    const updates: AdjustmentUpdate[] = [];
    players.forEach((p) => {
      const entrySeed = seed[p.id] ?? fallbackFor(p.id);
      const entryDraft = draft[p.id] ?? entrySeed;
      const changed =
        entryDraft.lootAdjustment !== entrySeed.lootAdjustment ||
        entryDraft.priorityModifier !== entrySeed.priorityModifier;
      if (changed) {
        updates.push({
          playerId: p.id,
          lootAdjustment: entryDraft.lootAdjustment,
          priorityModifier: entryDraft.priorityModifier,
        });
      }
    });

    setIsSaving(true);
    try {
      await onSave(updates);
      onClose();
    } catch {
      toast.error('Failed to save adjustments');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Player adjustments
        </span>
      }
      size="md"
      footer={
        <div className="flex justify-between">
          <Button variant="ghost" onClick={handleResetAll}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset all
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">
          Loot adjustment weights fair-share history (mid-tier joins); priority modifier is a flat score offset.
        </p>

        <div className="space-y-2">
          {players.map((player) => {
            const entry = draft[player.id] ?? fallbackFor(player.id);
            return (
              <div
                key={player.id}
                className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-elevated p-3"
              >
                <JobIcon job={player.job} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{player.name}</span>
                <div>
                  <Label htmlFor={`loot-adj-${player.id}`} size="sm">Loot adj</Label>
                  <NumberInput
                    id={`loot-adj-${player.id}`}
                    value={entry.lootAdjustment}
                    onChange={(value) => handleChange(player.id, 'lootAdjustment', value)}
                    min={PRIORITY_MODIFIER_MIN}
                    max={PRIORITY_MODIFIER_MAX}
                    step={PRIORITY_MODIFIER_STEP}
                    size="sm"
                  />
                </div>
                <div>
                  <Label htmlFor={`priority-mod-${player.id}`} size="sm">Priority mod</Label>
                  <NumberInput
                    id={`priority-mod-${player.id}`}
                    value={entry.priorityModifier}
                    onChange={(value) => handleChange(player.id, 'priorityModifier', value)}
                    min={PRIORITY_MODIFIER_MIN}
                    max={PRIORITY_MODIFIER_MAX}
                    step={PRIORITY_MODIFIER_STEP}
                    size="sm"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {players.length === 0 && (
          <div className="py-8 text-center text-text-muted">No configured players in this tier.</div>
        )}
      </div>
    </Modal>
  );
}
