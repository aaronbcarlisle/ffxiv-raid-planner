/**
 * LogCellEntriesMenu — the ×N multi-entry route (Phase-D D6, Task 2).
 *
 * D5's `LogWeekGrid` renders a STATIC `×N` chip on a multi-entry cell —
 * there's no way to reach any entry but the newest (which the cell's own
 * edit `Button` already targets). This is that route: the chip itself
 * becomes the `Dropdown` trigger, opening a menu of every entry in the cell,
 * newest-first (`entryRefs` is rendered in the order given — `cell.entries`
 * is already createdAt-DESC per `logWeekGridData.ts`'s `byNewestFirst`, so
 * this component never re-sorts). Task 4 mounts it into the grid in place
 * of the static chip once a cell's `entries.length > 1`.
 *
 * Trigger geometry (director F-13): `Button size="xs"` — `px-2 py-0.5
 * text-xs` (`Button.tsx:46`) — NOT `size="sm"` with className px overrides;
 * same-property Tailwind utilities resolve by stylesheet order, so an
 * override would silently lose. `variant="accent-subtle"` (D6a browser-pass
 * fix, F2): the D5 chip look (`rounded bg-accent/20 font-bold text-accent`,
 * `LogWeekGrid.tsx`'s static `×N` span) was originally reproduced as
 * `variant="ghost"` plus className overrides, but ghost's own `bg-transparent`
 * (`Button.tsx:32-33`) and the shared base's `rounded-lg`/`font-semibold`
 * (`Button.tsx:74`, applied regardless of variant) are the SAME same-property
 * stylesheet-order fight this comment already warns about, this time against
 * the variant/base utilities rather than the size prop — confirmed live in
 * Chrome (fill stayed transparent, corners stayed `rounded-lg`, weight stayed
 * 600). `accent-subtle` ships that exact look as its OWN variant
 * (`bg-accent/10 text-accent border border-accent/30`, `Button.tsx:30-31`) —
 * no className fill/radius/weight overrides needed or attempted; accept the
 * primitive's look rather than re-fighting it.
 *
 * Row content shares `RecipientBadge`/`resolveRecipient` with `LogWeekGrid`
 * (`./RecipientBadge.tsx`, extracted this same task) — one `playerMap`
 * lookup structure, no second resolution path.
 */
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel } from '../primitives/Dropdown';
import { Button } from '../primitives';
import { RecipientBadge, resolveRecipient } from './RecipientBadge';
import type { LogGridEntryRef } from './logWeekGridData';
import type { SnapshotPlayer } from '../../types';

export interface LogCellEntriesMenuProps {
  /** newest-first (cell.entries order), length >= 2 — the grid never mounts this for a single-entry cell. */
  entryRefs: LogGridEntryRef[];
  /** the grid's memoized map — one lookup structure (director F-8). */
  playerMap: Map<string, SnapshotPlayer>;
  /** the grid's own cell label — 'Ears', 'Ring', 'Glaze', 'Tome'… */
  cellLabel: string;
  floorName: string;
  onEdit: (ref: LogGridEntryRef) => void;
}

/**
 * Short date for a menu row — `Jan 5` form, not a full timestamp. UTC-pinned
 * (F4, PR #244 review) so the shown date never shifts a day depending on the
 * viewer's local offset — the `WeekScopeControl.formatWeekDate` precedent in
 * this same folder.
 */
function shortDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

/** Muted secondary text per ref kind — loot's method (+ extra flag) or material's augmented slot. */
function secondaryText(ref: LogGridEntryRef): string {
  if (ref.kind === 'loot') {
    return `${ref.entry.method}${ref.entry.isExtra ? ' · extra' : ''}`;
  }
  return ref.entry.slotAugmented ?? 'no slot';
}

export function LogCellEntriesMenu({
  entryRefs, playerMap, cellLabel, floorName, onEdit,
}: LogCellEntriesMenuProps) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button
          variant="accent-subtle"
          size="xs"
          aria-label={`${entryRefs.length} entries for ${cellLabel} — ${floorName}`}
        >
          {`×${entryRefs.length}`}
        </Button>
      </DropdownTrigger>
      <DropdownContent align="start">
        <DropdownLabel>{`${entryRefs.length} ${cellLabel} entries`}</DropdownLabel>
        {entryRefs.map((ref) => {
          const recipient = resolveRecipient(ref.entry, playerMap);
          return (
            <DropdownItem key={`${ref.kind}-${ref.entry.id}`} onSelect={() => onEdit(ref)}>
              <span className="flex flex-1 items-center justify-between gap-3">
                <RecipientBadge color={recipient.color} name={recipient.name} job={recipient.job} />
                <span className="whitespace-nowrap text-xs text-text-muted">
                  {`${secondaryText(ref)} · ${shortDate(ref.entry.createdAt)}`}
                </span>
              </span>
            </DropdownItem>
          );
        })}
      </DropdownContent>
    </Dropdown>
  );
}
