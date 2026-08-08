/**
 * WeekScopeControl — the Log tab's week pill (spec §2.3/§5.4, R-22): a
 * chevron+dropdown stepper fed by the shared `WeekClock`, and the host for
 * the clock's mutations ("Start next week" / "Revert week"). R-15 retires
 * the old Priority-view "scope" concept (`scopedWeek`) — this component now
 * lives only in the Log tab and steps a `displayedWeek` that can diverge
 * from the clock's `currentWeek`; the clock stays the sole source of truth
 * for the mutations, which name the split when it exists (R-22).
 *
 * Props beyond the brief's literal R-15 vocabulary list (`clock`,
 * `displayedWeek`, `onWeekChange`, `onFollowClock`, `canEdit`, `lootLog`,
 * `materialLog`, `pageLedger`, `players`) — both required to satisfy other,
 * more specific bullets in the same brief:
 *   - `canPrev`/`canNext`: "the caller owns the bounds" (task-3 resolution
 *     notes). `useLogWeek`'s `LogWeek.canPrev`/`canNext` already encode the
 *     true clamp range (`week > 1` / `week < max(clock.maxWeek,
 *     clock.currentWeek)`) — recomputing that here from `clock.maxWeek`
 *     alone would silently drift from the hook's actual formula. Task 4
 *     wires `canPrev={logWeek.canPrev}` / `canNext={logWeek.canNext}`.
 *   - `groupId`/`tierId`: D-41's pre-check (below) calls
 *     `fetchLootLog`/`fetchMaterialLog`/`fetchPageLedger` off
 *     `useLootTrackingStore.getState()`, and all three require `(groupId,
 *     tierId, week?)` — there is no path to those identifiers through
 *     `clock` (`useWeekClock.ts` closes over them internally but never
 *     exposes them) or any other listed prop. Every other Loot.tsx sibling
 *     that touches the store already takes these two as plain props
 *     (`RecipientPicker`, `LootResetMenu`, `QuickLogMaterialModal`, …), so
 *     this follows the established convention.
 *
 * D-41's revert pre-check (director B3, `v1-v2-parity-matrix.md:267`,
 * `phase-d-loot-design.md:466`): reverting is destructive-feeling, so
 * clicking "Revert week" no longer mutates on a single confirm. It re-fetches
 * the clock's current week fresh from the store and only then decides what
 * to show — mirroring `HistoryView.tsx:206-238`'s `handleRevertWeekClick`
 * (frozen, read-only reference):
 *   - the "Revert week" dropdown item opens a lightweight `ConfirmModal`
 *     (unchanged shape from before this task, now carrying the R-22
 *     divergence line when `displayedWeek !== clock.currentWeek`);
 *   - confirming it runs the pre-check: fetch loot/material/page-ledger
 *     fresh, then re-read the store for entries at `clock.currentWeek`;
 *   - a fetch failure toasts and aborts — no mutation, no further modal;
 *   - data found ⇒ the lightweight confirm hands off to Task 2's
 *     `RevertWeekSummaryModal` (the itemized "what's about to move" surface,
 *     `week` always `clock.currentWeek`, never `displayedWeek`) for the
 *     actual mutating confirm;
 *   - nothing found ⇒ reverts directly, exactly like `executeRevert` in the
 *     V1 reference — no second modal.
 * `isReverting` is owned here (brief bullet m6 — Task 2's modal consumes the
 * prop but doesn't produce it) and guards re-entrancy through both the
 * pre-check fetch and the actual mutation.
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, LocateFixed } from 'lucide-react';
import { Button, IconButton } from '../primitives';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../primitives/Dropdown';
import { ConfirmModal } from '../ui';
import { toast } from '../../stores/toastStore';
import { useLootTrackingStore, type WeekEntryType } from '../../stores/lootTrackingStore';
import { RevertWeekSummaryModal } from './RevertWeekSummaryModal';
import type { WeekClock } from '../../hooks/useWeekClock';
import type { LootLogEntry, MaterialLogEntry, PageLedgerEntry, SnapshotPlayer } from '../../types';

export interface WeekScopeControlProps {
  clock: WeekClock;
  displayedWeek: number;
  onWeekChange: (week: number) => void;
  onFollowClock: () => void;
  canEdit: boolean;
  /** Bounds the caller owns — see file-header note. */
  canPrev: boolean;
  canNext: boolean;
  /** Required by the D-41 pre-check's store fetches — see file-header note. */
  groupId: string;
  tierId: string;
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  pageLedger: PageLedgerEntry[];
  players: SnapshotPlayer[];
}

const DOT_COLOR: Record<WeekEntryType, string> = {
  loot: 'bg-accent',
  books: 'bg-membership-lead',
  mats: 'bg-status-warning',
};

/** UTC-pinned so the shown date never shifts a day from the mid-day UTC anchor. */
function formatWeekDate(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

type PendingMutation = 'start-next' | 'revert' | null;

export function WeekScopeControl({
  clock,
  displayedWeek,
  onWeekChange,
  onFollowClock,
  canEdit,
  canPrev,
  canNext,
  groupId,
  tierId,
  lootLog,
  materialLog,
  pageLedger,
  players,
}: WeekScopeControlProps) {
  const [pendingMutation, setPendingMutation] = useState<PendingMutation>(null);
  const [showRevertSummary, setShowRevertSummary] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  const { currentWeek, maxWeek, weekDataTypes, rangeOfWeek, startNextWeek, revertWeek } = clock;

  const label =
    displayedWeek === currentWeek ? `This week (Week ${displayedWeek})` : `Week ${displayedWeek}`;

  const weeks = Array.from({ length: maxWeek }, (_, i) => maxWeek - i);

  const isDiverged = displayedWeek !== currentWeek;
  const divergenceLine = `You're viewing Week ${displayedWeek}. This acts on the clock — Week ${currentWeek}.`;

  const handleStartNextWeek = async () => {
    try {
      await startNextWeek();
      toast.success('Week advanced');
      onFollowClock();
    } catch {
      toast.error('Failed to advance the week');
    } finally {
      setPendingMutation(null);
    }
  };

  // Shared by the "no data at the clock's week" pre-check branch and Task 2's
  // RevertWeekSummaryModal's own confirm — the actual mutation, exactly once.
  const executeRevert = async () => {
    if (isReverting) return;
    setIsReverting(true);
    try {
      await revertWeek();
      toast.success('Week reverted');
      onFollowClock();
      setShowRevertSummary(false);
    } catch {
      toast.error('Failed to revert the week');
    } finally {
      setIsReverting(false);
    }
  };

  // D-41's pre-check (director B3): fired by the lightweight ConfirmModal's
  // confirm button, mirroring `HistoryView.tsx:206-238`'s
  // `handleRevertWeekClick`. Re-entrancy guarded by `isReverting` — the same
  // flag Task 2's modal uses for its own in-flight state.
  const handleRevertPreCheck = async () => {
    if (isReverting) return;
    setIsReverting(true);

    try {
      const store = useLootTrackingStore.getState();
      await Promise.all([
        store.fetchLootLog(groupId, tierId),
        store.fetchMaterialLog(groupId, tierId),
        store.fetchPageLedger(groupId, tierId),
      ]);
    } catch {
      toast.error('Failed to check week data');
      setIsReverting(false);
      setPendingMutation(null);
      return;
    }

    const fresh = useLootTrackingStore.getState();
    const hasData =
      fresh.lootLog.some((e) => e.weekNumber === currentWeek) ||
      fresh.materialLog.some((e) => e.weekNumber === currentWeek) ||
      fresh.pageLedger.some((e) => e.weekNumber === currentWeek);

    setIsReverting(false);
    setPendingMutation(null);

    if (hasData) {
      setShowRevertSummary(true);
    } else {
      await executeRevert();
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <IconButton
          aria-label="Previous week"
          variant="ghost"
          size="sm"
          icon={<ChevronLeft size={16} />}
          disabled={!canPrev}
          onClick={() => onWeekChange(displayedWeek - 1)}
        />

        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="sm" trailing="chevron">
              {label}
            </Button>
          </DropdownTrigger>
          <DropdownContent align="start" className="w-56">
            {weeks.map((w) => {
              const range = rangeOfWeek(w);
              const types = weekDataTypes.get(w) ?? [];
              const rangeText = range
                ? ` · ${formatWeekDate(range.start)} – ${formatWeekDate(range.end)}`
                : '';
              return (
                <DropdownItem key={w} onSelect={() => onWeekChange(w)}>
                  <span
                    className="flex w-full items-center gap-2"
                    title={types.length ? types.join(', ') : undefined}
                  >
                    <span>{`Week ${w}${rangeText}`}</span>
                    {types.length > 0 && (
                      <span className="flex items-center gap-0.5" aria-hidden="true">
                        {types.map((t) => (
                          <span key={t} className={`h-1.5 w-1.5 rounded-full ${DOT_COLOR[t]}`} />
                        ))}
                      </span>
                    )}
                  </span>
                </DropdownItem>
              );
            })}

            {canEdit && (
              <>
                <DropdownSeparator />
                <DropdownItem onSelect={() => setPendingMutation('start-next')}>
                  Start next week
                </DropdownItem>
                <DropdownItem
                  // Guard: reverting from Week 1 would open a modal reading "Week 0".
                  disabled={currentWeek <= 1}
                  onSelect={() => setPendingMutation('revert')}
                >
                  Revert week
                </DropdownItem>
              </>
            )}
          </DropdownContent>
        </Dropdown>

        <IconButton
          aria-label="Next week"
          variant="ghost"
          size="sm"
          icon={<ChevronRight size={16} />}
          disabled={!canNext}
          onClick={() => onWeekChange(displayedWeek + 1)}
        />

        <IconButton
          aria-label={`Go to the current week (Week ${currentWeek})`}
          variant="ghost"
          size="sm"
          icon={<LocateFixed size={16} />}
          disabled={!isDiverged}
          onClick={onFollowClock}
        />
      </div>

      <ConfirmModal
        isOpen={pendingMutation === 'start-next'}
        title="Start next week"
        message={
          <>
            <p>{`Advance the week clock to Week ${currentWeek + 1}? Logged data is never modified.`}</p>
            {isDiverged && <p>{divergenceLine}</p>}
          </>
        }
        variant="default"
        confirmLabel="Start next week"
        onConfirm={handleStartNextWeek}
        onCancel={() => setPendingMutation(null)}
      />

      <ConfirmModal
        isOpen={pendingMutation === 'revert'}
        title="Revert week"
        message={
          <>
            <p>{`Move the clock back to Week ${currentWeek - 1}? Entries logged for Week ${currentWeek} will appear as future-week entries.`}</p>
            {isDiverged && <p>{divergenceLine}</p>}
          </>
        }
        variant="warning"
        confirmLabel="Revert week"
        onConfirm={handleRevertPreCheck}
        onCancel={() => setPendingMutation(null)}
      />

      <RevertWeekSummaryModal
        isOpen={showRevertSummary}
        week={currentWeek}
        lootLog={lootLog}
        materialLog={materialLog}
        pageLedger={pageLedger}
        players={players}
        isReverting={isReverting}
        onConfirm={executeRevert}
        onCancel={() => setShowRevertSummary(false)}
      />
    </>
  );
}
