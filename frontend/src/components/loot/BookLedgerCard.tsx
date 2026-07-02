/**
 * BookLedgerCard — the v2 Loot History "Books" home (spec §2.5/§5.7): players ×
 * Books I–IV sourced from `pageBalances`, cell-click adjust, a per-row ledger,
 * and mark-floor-cleared — reusing the three legacy book modals UNMODIFIED
 * (`EditBookBalanceModal`, `PlayerLedgerModal`, `MarkFloorClearedModal`; ring0,
 * `history/` stays untouched).
 *
 * Scope toggle (This week / All time) re-fetches `pageBalances` scoped to the
 * current week vs. cumulative; defaults to all-time (spec parity with the
 * legacy `PageBalancesPanel`'s default `viewMode`).
 *
 * Member-own-row exception (spec §5.7): a non-editor can still adjust the
 * balances on their OWN row (`playersById.get(b.playerId)?.userId === effectiveUserId`)
 * — every other row's cells render as plain text.
 */
import { useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { CardShell, SegmentedToggle } from '../ui';
import { Button, IconButton } from '../primitives';
import { EditBookBalanceModal } from '../history/EditBookBalanceModal';
import { PlayerLedgerModal } from '../history/PlayerLedgerModal';
import { MarkFloorClearedModal } from '../history/MarkFloorClearedModal';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer } from '../../types';

export interface BookLedgerCardProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
  effectiveUserId?: string;
}

type BookType = 'I' | 'II' | 'III' | 'IV';
type BookKey = 'bookI' | 'bookII' | 'bookIII' | 'bookIV';

const BOOK_KEYS: ReadonlyArray<readonly [BookType, BookKey]> = [
  ['I', 'bookI'],
  ['II', 'bookII'],
  ['III', 'bookIII'],
  ['IV', 'bookIV'],
] as const;

interface EditState {
  playerId: string;
  playerName: string;
  bookType: BookType;
  currentValue: number;
}

interface LedgerState {
  playerId: string;
  playerName: string;
}

export function BookLedgerCard({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  canEdit,
  effectiveUserId,
}: BookLedgerCardProps) {
  const { pageBalances, fetchPageBalances, adjustBookBalance, markFloorCleared, fetchPageLedger } =
    useLootTrackingStore();
  // `pageLedger` is subscribed on its own (not just via the whole-store
  // destructure above) so its identity is tracked as an explicit effect dep
  // below — see the fetch effect comment for why.
  const pageLedger = useLootTrackingStore((s) => s.pageLedger);
  const [scope, setScope] = useState<'week' | 'all'>('all');
  const [editState, setEditState] = useState<EditState | null>(null);
  const [ledgerState, setLedgerState] = useState<LedgerState | null>(null);
  const [showMarkCleared, setShowMarkCleared] = useState(false);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const scopedWeek = scope === 'week' ? currentWeek : undefined;

  // `clearWeekPageLedger`/`clearAllPageLedger` (lootTrackingStore.ts) internally
  // call `fetchPageBalances(groupId, tierId)` UNSCOPED as part of their own
  // refresh — that overwrites the shared `pageBalances` slice with all-time
  // data even while this card's scope toggle still reads "This week". This
  // effect does NOT guarantee it lands last relative to that unscoped write —
  // `pageLedger` (bumped by every ledger mutation: reset, adjust, mark-cleared)
  // is a CORRECTIVE BACKSTOP that re-issues our scoped
  // `fetchPageBalances(groupId, tierId, scopedWeek)` whenever the ledger
  // changes, so a stale unscoped write eventually gets overwritten. The actual
  // ordering guarantee for the reset flow is the POST-AWAIT second trigger at
  // `Loot.tsx:287` (`fetchPageLedger` called after `await`ing the reset) — that
  // call is LOAD-BEARING and must not be removed on the assumption this card
  // self-heals. The `adjustBookBalance` path is unaffected by any of this: it
  // relies on this card's own `refetch()` at ~line 200, not on this effect.
  useEffect(() => {
    fetchPageBalances(groupId, tierId, scopedWeek);
  }, [groupId, tierId, scope, currentWeek, fetchPageBalances, scopedWeek, pageLedger]);

  const refetch = () => fetchPageBalances(groupId, tierId, scopedWeek);

  const rows = pageBalances.filter((b) => playersById.get(b.playerId)?.isSubstitute !== true);

  return (
    <CardShell
      as="div"
      title="Books"
      headerRight={
        <div className="flex items-center gap-2">
          <SegmentedToggle
            size="sm"
            ariaLabel="Books scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'week', label: 'This week' },
              { value: 'all', label: 'All time' },
            ]}
          />
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setShowMarkCleared(true)}>
              Mark floor cleared
            </Button>
          )}
        </div>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default">
            <th className="px-3 py-2 text-left text-text-secondary">Player</th>
            {BOOK_KEYS.map(([label]) => (
              <th key={label} className="px-3 py-2 text-center text-text-secondary">
                Book {label}
              </th>
            ))}
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const player = playersById.get(b.playerId);
            const rowCanEdit = canEdit || (!!effectiveUserId && player?.userId === effectiveUserId);

            return (
              <tr
                id={`book-row-${b.playerId}`}
                key={b.playerId}
                className="border-b border-border-default last:border-b-0"
              >
                <td className="px-3 py-2 text-text-primary">{b.playerName}</td>
                {BOOK_KEYS.map(([label, key]) => (
                  <td key={label} className="px-3 py-2 text-center">
                    {rowCanEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditState({
                            playerId: b.playerId,
                            playerName: b.playerName,
                            bookType: label,
                            currentValue: b[key],
                          })
                        }
                      >
                        {b[key]}
                      </Button>
                    ) : (
                      <span className="text-text-primary">{b[key]}</span>
                    )}
                  </td>
                ))}
                <td className="px-1 py-2 text-center">
                  <IconButton
                    aria-label={`${b.playerName}'s ledger`}
                    icon={<History className="w-4 h-4" />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setLedgerState({ playerId: b.playerId, playerName: b.playerName })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {editState && (
        <EditBookBalanceModal
          isOpen={!!editState}
          onClose={() => setEditState(null)}
          onSubmit={async (adjustment, notes) => {
            try {
              await adjustBookBalance(
                groupId,
                tierId,
                editState.playerId,
                editState.bookType,
                adjustment,
                currentWeek,
                notes
              );
              toast.success(`Updated Book ${editState.bookType} for ${editState.playerName}`);
              await refetch();
            } catch {
              toast.error('Failed to update book balance');
              throw new Error('Failed to update');
            }
          }}
          playerName={editState.playerName}
          bookType={editState.bookType}
          currentBalance={editState.currentValue}
        />
      )}

      {ledgerState && (
        <PlayerLedgerModal
          isOpen={!!ledgerState}
          onClose={() => setLedgerState(null)}
          groupId={groupId}
          tierId={tierId}
          playerId={ledgerState.playerId}
          playerName={ledgerState.playerName}
          canEdit={canEdit}
          onHistoryCleared={refetch}
        />
      )}

      {showMarkCleared && (
        <MarkFloorClearedModal
          isOpen={showMarkCleared}
          onClose={() => setShowMarkCleared(false)}
          onSubmit={async (request) => {
            await markFloorCleared(groupId, tierId, request);
            await Promise.all([refetch(), fetchPageLedger(groupId, tierId)]);
          }}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
        />
      )}
    </CardShell>
  );
}
