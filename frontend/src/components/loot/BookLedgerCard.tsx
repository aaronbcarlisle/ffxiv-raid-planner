/**
 * BookLedgerCard — the v2 Loot Log "Books" home (R-14) (spec §2.5/§5.7): players ×
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
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, MoreVertical, Trash2 } from 'lucide-react';
import { CardShell, SegmentedToggle, JobIcon, ContextMenu, type ContextMenuItem } from '../ui';
import { Button, IconButton } from '../primitives';
import { EditBookBalanceModal } from '../history/EditBookBalanceModal';
import { PlayerLedgerModal } from '../history/PlayerLedgerModal';
import { MarkFloorClearedModal } from '../history/MarkFloorClearedModal';
import { jumpMenuAnchor } from '../roster/rosterLedgerJumps';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { toast } from '../../stores/toastStore';
import type { ResetConfig } from '../ui/ResetConfirmModal';
import type { SnapshotPlayer } from '../../types';

export interface BookLedgerCardProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  /**
   * D7 (R-16): column/row kebab items hand their ResetConfig to the host's
   * single confirm gate.
   */
  onResetConfig: (config: ResetConfig) => void;
  /**
   * The DISPLAYED week (Log's `logWeek.week`, which can diverge from the
   * clock) — every write this card makes keys off THIS week: the scoped
   * fetch, `adjustBookBalance`'s week-of-record, and
   * `MarkFloorClearedModal`'s default.
   */
  currentWeek: number;
  /**
   * The clock's current week (`clock.currentWeek`). Used ONLY to phrase the
   * scope toggle's "This week" label (R-D7f) honestly once `currentWeek`
   * above is the displayed week rather than the clock's.
   */
  clockWeek: number;
  canEdit: boolean;
  effectiveUserId?: string;
  className?: string;
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

/**
 * D7b (R-16 4/4): the column/row kebab's single grid-root menu state — the
 * `FloorMenuState`/`LogGridMenuState` shape (`LogWeekGrid.tsx`) re-applied to
 * this card. ONE mount shared by every column header and every row, never
 * one instance per column/row.
 */
type BooksMenuState =
  | { kind: 'column'; x: number; y: number; floor: number }
  | { kind: 'row'; x: number; y: number; playerId: string; playerName: string };

/**
 * The kebab's ONE item, computed from the menu target + the card's own
 * `scope` toggle (This week / All time) — label and config flip together
 * (D7-h). A single `if`/`else` resolving to one object literal, never two
 * branch-local array literals per surface (jscpd containment).
 */
function buildBooksMenuItem(
  menu: BooksMenuState,
  scope: 'week' | 'all',
  currentWeek: number,
  onResetConfig: (config: ResetConfig) => void
): ContextMenuItem[] {
  let label: string;
  let config: ResetConfig;
  if (menu.kind === 'column') {
    if (scope === 'week') {
      label = `Reset Floor ${menu.floor} books (Week ${currentWeek})`;
      config = { scope: 'floor', target: 'books', week: currentWeek, floor: menu.floor };
    } else {
      label = `Reset ALL Floor ${menu.floor} books`;
      config = { scope: 'floor', target: 'books', floor: menu.floor };
    }
  } else if (scope === 'week') {
    label = `Reset ${menu.playerName}'s Week ${currentWeek} books`;
    config = {
      scope: 'week', target: 'books', week: currentWeek, playerId: menu.playerId, playerName: menu.playerName,
    };
  } else {
    label = `Reset ALL ${menu.playerName}'s books`;
    config = { scope: 'all', target: 'books', playerId: menu.playerId, playerName: menu.playerName };
  }
  return [{
    label,
    icon: <Trash2 className="h-4 w-4" />,
    danger: true,
    onClick: () => onResetConfig(config),
  }];
}

export function BookLedgerCard({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  clockWeek,
  canEdit,
  effectiveUserId,
  onResetConfig,
  className,
}: BookLedgerCardProps) {
  const { pageBalances, fetchPageBalances, adjustBookBalance, markFloorCleared, fetchPageLedger } =
    useLootTrackingStore();
  // `pageLedger` is subscribed on its own (not just via the whole-store
  // destructure above) so its identity is tracked as an explicit effect dep
  // below — see the fetch effect comment for why.
  const pageLedger = useLootTrackingStore((s) => s.pageLedger);
  const [searchParams, setSearchParams] = useSearchParams();
  const [scope, setScope] = useState<'week' | 'all'>('all');
  const [editState, setEditState] = useState<EditState | null>(null);
  const [ledgerState, setLedgerState] = useState<LedgerState | null>(null);
  const [showMarkCleared, setShowMarkCleared] = useState(false);
  const [booksMenu, setBooksMenu] = useState<BooksMenuState | null>(null);

  // D7b (R-16 4/4): both triggers (kebab click + right-click) into the SAME
  // grid-root state — the `openFloorMenu` idiom `LogWeekGrid.tsx`'s
  // `FloorSection` already establishes, re-applied one level down (column
  // header + row here, instead of floor header). `jumpMenuAnchor` supplies
  // the keyboard-invoked (Shift+F10/menu-key) fallback anchor.
  const openColumnMenu = (e: ReactMouseEvent<HTMLElement>, floor: number) => {
    const { x, y } = jumpMenuAnchor(e, e.currentTarget.getBoundingClientRect());
    setBooksMenu({ kind: 'column', x, y, floor });
  };
  const openRowMenu = (e: ReactMouseEvent<HTMLElement>, playerId: string, playerName: string) => {
    const { x, y } = jumpMenuAnchor(e, e.currentTarget.getBoundingClientRect());
    setBooksMenu({ kind: 'row', x, y, playerId, playerName });
  };

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const scopedWeek = scope === 'week' ? currentWeek : undefined;
  // R-D7f: `currentWeek` is the DISPLAYED week, which can diverge from the
  // clock — the toggle must not claim "This week" for a backlogged view.
  // `WeekScopeControl.tsx`'s same shape: honest only when they match.
  const thisWeekLabel =
    currentWeek === clockWeek ? `This week (Week ${currentWeek})` : `Week ${currentWeek}`;

  // `clearWeekPageLedger`/`clearAllPageLedger` (lootTrackingStore.ts) internally
  // call `fetchPageBalances(groupId, tierId)` UNSCOPED as part of their own
  // refresh — that overwrites the shared `pageBalances` slice with all-time
  // data even while this card's scope toggle still reads "This week". This
  // effect does NOT guarantee it lands last relative to that unscoped write —
  // `pageLedger` (bumped by every ledger mutation: reset, adjust, mark-cleared)
  // is a CORRECTIVE BACKSTOP that re-issues our scoped
  // `fetchPageBalances(groupId, tierId, scopedWeek)` whenever the ledger
  // changes, so a stale unscoped write eventually gets overwritten. The actual
  // ordering guarantee for the reset flow is the POST-AWAIT second trigger in
  // `Loot.tsx`'s `handleResetConfirm` (the `await fetchPageLedger(groupId, tierId)`
  // that runs after the book op) — that call is LOAD-BEARING and must not be
  // removed on the assumption this card self-heals. The `adjustBookBalance`
  // path is unaffected by any of this: it relies on this card's own
  // `refetch()` at ~line 200, not on this effect.
  useEffect(() => {
    fetchPageBalances(groupId, tierId, scopedWeek);
  }, [groupId, tierId, scope, currentWeek, fetchPageBalances, scopedWeek, pageLedger]);

  const refetch = () => fetchPageBalances(groupId, tierId, scopedWeek);

  const rows = pageBalances.filter((b) => playersById.get(b.playerId)?.isSubstitute !== true);

  // ── C7 (D-05): the roster's "Edit Books" jump lands here ──
  // Mirrors `LootHistoryTable`'s deep-link effect (the sibling that owns
  // `?entry=`): the param IS the highlight (nothing stored to desync), the row
  // scrolls in once it exists, and the param clears itself after the pulse so
  // the same jump can be repeated. Legacy drove this from
  // `highlightedBookPlayerId` state (`SectionedLogView.tsx:1401`); the F6d
  // Loot screen left it unbuilt until a v2 navigation produced it — C7 is that
  // navigation. `null` when the param names a row this card doesn't render.
  const highlightParam = searchParams.get('book');
  const highlightPlayerId = rows.some((b) => b.playerId === highlightParam) ? highlightParam : null;

  useEffect(() => {
    if (!highlightParam) return;
    // Don't start the clock before the balances arrive. The jump navigates
    // Roster → Loot, which mounts this card with an EMPTY `pageBalances` — the
    // fetch above is what fills it. Clearing on that first render would delete
    // `book` before the row ever existed whenever the fetch takes longer than
    // the timeout: right screen, no highlight, and the jump unrepeatable
    // without going back to the roster (PR #200 review). The effect re-runs
    // when the rows land.
    if (!highlightPlayerId && rows.length === 0) return;
    // Scroll + pulse only when there IS a row — but clear the param either way.
    // A jump can legitimately land on nothing: this card filters substitutes
    // out (`rows`, above), and a player can be removed between the jump and the
    // landing. An uncleared param would then survive in the address bar and
    // ride into every deep link copied from this route afterwards (director
    // C7 finding 1).
    const scrollTimer = highlightPlayerId
      ? setTimeout(() => {
          document
            .getElementById(`book-row-${highlightPlayerId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100)
      : null;
    const clearTimer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.delete('book');
          return params;
        },
        { replace: true }
      );
    }, 2500);
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightParam, highlightPlayerId, rows.length, setSearchParams]);

  return (
    <CardShell
      as="div"
      title="Books"
      className={className}
      headerRight={
        <div className="flex items-center gap-2">
          <SegmentedToggle
            size="sm"
            ariaLabel="Books scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'week', label: thisWeekLabel },
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
            {BOOK_KEYS.map(([label], idx) => {
              const floor = idx + 1;
              return (
                <th
                  key={label}
                  className="px-3 py-2 text-center text-text-secondary"
                  onContextMenu={
                    canEdit
                      ? (e) => {
                          e.preventDefault();
                          openColumnMenu(e, floor);
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Book {label}</span>
                    {canEdit && (
                      <IconButton
                        aria-label={`Book ${label} actions`}
                        icon={<MoreVertical className="h-4 w-4" />}
                        variant="ghost"
                        size="sm"
                        aria-haspopup="menu"
                        onClick={(e) => openColumnMenu(e, floor)}
                      />
                    )}
                  </div>
                </th>
              );
            })}
            <th className="px-3 py-2 w-16" />
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
                className={`border-b border-border-default last:border-b-0${
                  highlightPlayerId === b.playerId ? ' highlight-pulse' : ''
                }`}
                onContextMenu={
                  canEdit
                    ? (e) => {
                        e.preventDefault();
                        openRowMenu(e, b.playerId, b.playerName);
                      }
                    : undefined
                }
              >
                <td className="px-3 py-2 text-text-primary">
                  <div className="flex items-center gap-1.5">
                    {player?.job && <JobIcon job={player.job} size="sm" />}
                    <span className="truncate max-w-[100px]">{b.playerName}</span>
                  </div>
                </td>
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
                  <div className="flex items-center justify-center gap-0.5">
                    <IconButton
                      aria-label={`${b.playerName}'s ledger`}
                      icon={<History className="w-4 h-4" />}
                      variant="ghost"
                      size="sm"
                      onClick={() => setLedgerState({ playerId: b.playerId, playerName: b.playerName })}
                    />
                    {/* D7b (R-16 4/4): gates on `canEdit` ONLY — never
                        `rowCanEdit`. The member-own-row exception above
                        grants cell editing on this player's own row, not a
                        bulk-reset door onto it (D7-g). */}
                    {canEdit && (
                      <IconButton
                        aria-label={`${b.playerName} book actions`}
                        icon={<MoreVertical className="w-4 h-4" />}
                        variant="ghost"
                        size="sm"
                        aria-haspopup="menu"
                        onClick={(e) => openRowMenu(e, b.playerId, b.playerName)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* D7b (R-16 4/4): ONE `ContextMenu` mount at the card root — every
          column header and every row share this single state, never a
          per-column or per-row menu instance (D6/D7's own rule, re-applied). */}
      {booksMenu && (
        <ContextMenu
          x={booksMenu.x}
          y={booksMenu.y}
          items={buildBooksMenuItem(booksMenu, scope, currentWeek, onResetConfig)}
          onClose={() => setBooksMenu(null)}
        />
      )}

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
