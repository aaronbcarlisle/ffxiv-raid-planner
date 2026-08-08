/**
 * WeekScopeControl — the Log tab's week pill (spec §2.3/§5.4, R-22): a
 * chevron+dropdown stepper fed by the shared `WeekClock`, and the host for
 * the clock's mutations ("Start next week" / "Revert week"). The mutations
 * stay clock-bound (`clock.currentWeek`/`clock.maxWeek`), never
 * `displayedWeek` — when the two diverge, both confirmation surfaces name
 * the split so a user viewing a past week can't accidentally revert the
 * clock's actual current week.
 *
 * Props beyond the plain vocabulary (`clock`, `displayedWeek`,
 * `onWeekChange`, `onFollowClock`, `canEdit`, `lootLog`, `materialLog`,
 * `pageLedger`, `players`):
 *   - `canPrev`/`canNext`: the caller owns the step bounds. `useLogWeek`'s
 *     `LogWeek.canPrev`/`canNext` already encode the true clamp range
 *     (`week > 1` / `week < max(clock.maxWeek, clock.currentWeek)`) —
 *     recomputing that here from `clock.maxWeek` alone would drift from the
 *     hook's actual formula.
 *   - `groupId`/`tierId`: the revert pre-check (below) calls
 *     `fetchLootLog`/`fetchMaterialLog`/`fetchPageLedger` off
 *     `useLootTrackingStore.getState()`, which require `(groupId, tierId,
 *     week?)` — `clock` (`WeekClock`) closes over them internally but never
 *     exposes them.
 *
 * Revert flow (D-41's pre-check, director B3 — one confirmation per path,
 * ruled): the dropdown item fires the pre-check directly — re-entrancy
 * guarded by `isReverting`, fetches loot/material/page-ledger fresh, then
 * re-reads the store for entries at `clock.currentWeek`. A fetch failure
 * toasts and aborts (no modal). Data found ⇒ Task 2's
 * `RevertWeekSummaryModal` is the only confirmation (itemized, `week`
 * always `clock.currentWeek`, carries the divergence line via its optional
 * `notice` prop). Nothing found ⇒ a lightweight `ConfirmModal` is the only
 * confirmation (also carries the divergence line) — reverting never happens
 * with zero UI, since that path is where the divergence would otherwise go
 * unstated. `isReverting` also drives the actual mutation's in-flight state
 * and guards re-entrancy there too.
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
  /** Required by the revert pre-check's store fetches — see file-header note. */
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
  const [showStartNextConfirm, setShowStartNextConfirm] = useState(false);
  const [showRevertSummary, setShowRevertSummary] = useState(false);
  const [showEmptyRevertConfirm, setShowEmptyRevertConfirm] = useState(false);
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
      setShowStartNextConfirm(false);
    }
  };

  // Shared by the empty-week ConfirmModal and Task 2's RevertWeekSummaryModal
  // — the actual mutation, exactly once regardless of which path led here.
  const executeRevert = async () => {
    if (isReverting) return;
    setIsReverting(true);
    try {
      await revertWeek();
      toast.success('Week reverted');
      onFollowClock();
      setShowRevertSummary(false);
      setShowEmptyRevertConfirm(false);
    } catch {
      toast.error('Failed to revert the week');
    } finally {
      setIsReverting(false);
    }
  };

  // Fired directly by the "Revert week" dropdown item (director B3, one
  // confirmation per path): guard re-entrancy → fetch loot/material/ledger
  // fresh → re-check the store for entries at the clock's current week →
  // data opens the summary modal, nothing opens the lightweight confirm.
  const handleRevertClick = async () => {
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
      return;
    }

    const fresh = useLootTrackingStore.getState();
    const hasData =
      fresh.lootLog.some((e) => e.weekNumber === currentWeek) ||
      fresh.materialLog.some((e) => e.weekNumber === currentWeek) ||
      fresh.pageLedger.some((e) => e.weekNumber === currentWeek);

    setIsReverting(false);

    if (hasData) {
      setShowRevertSummary(true);
    } else {
      setShowEmptyRevertConfirm(true);
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
                <DropdownItem onSelect={() => setShowStartNextConfirm(true)}>
                  Start next week
                </DropdownItem>
                <DropdownItem
                  // Guard: reverting from Week 1 would open a modal reading "Week 0".
                  disabled={currentWeek <= 1}
                  onSelect={() => void handleRevertClick()}
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
        isOpen={showStartNextConfirm}
        title="Start next week"
        message={
          <div className="space-y-2">
            <p>{`Advance the week clock to Week ${currentWeek + 1}? Logged data is never modified.`}</p>
            {isDiverged && <p>{divergenceLine}</p>}
          </div>
        }
        variant="default"
        confirmLabel="Start next week"
        onConfirm={handleStartNextWeek}
        onCancel={() => setShowStartNextConfirm(false)}
      />

      <ConfirmModal
        isOpen={showEmptyRevertConfirm}
        title="Revert week"
        message={
          <div className="space-y-2">
            <p>{`Move the clock back to Week ${currentWeek - 1}? Entries logged for Week ${currentWeek} will appear as future-week entries.`}</p>
            {isDiverged && <p>{divergenceLine}</p>}
          </div>
        }
        variant="warning"
        confirmLabel="Revert week"
        onConfirm={executeRevert}
        onCancel={() => setShowEmptyRevertConfirm(false)}
      />

      <RevertWeekSummaryModal
        isOpen={showRevertSummary}
        week={currentWeek}
        lootLog={lootLog}
        materialLog={materialLog}
        pageLedger={pageLedger}
        players={players}
        isReverting={isReverting}
        notice={isDiverged ? divergenceLine : undefined}
        onConfirm={executeRevert}
        onCancel={() => setShowRevertSummary(false)}
      />
    </>
  );
}
