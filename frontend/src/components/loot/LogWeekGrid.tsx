/**
 * LogWeekGrid — v2 Log tab's weekly-grid chassis (Phase-D D5, Task 3).
 *
 * Renders Task 2's `buildLogWeekGrid` output: 4 floor sections, ascending
 * F1→F4 (the §4 mockup order — Priority's floor Queues run 4→1, but the Log
 * reads as a record top-to-bottom, so the order deliberately differs from
 * FloorCard's stack). One `LogWeekGridProps` shape is the whole contract —
 * Task 4 wires this straight into `Loot.tsx`'s Log view.
 *
 * Header treatment (R-19 + R-D5b, user-ruled): matches FloorCard's shipped
 * header EXACTLY — `FLOOR_ACCENT_CLASS[n]` stripe, duty name as
 * `Tag variant="label" tone="muted"` (only when gamedata actually names the
 * floor — `floorName !== 'Floor N'`, same guard FloorCard uses to avoid the
 * "Floor N" chip beside "Floor N" heading duplication PR #224 caught), and
 * `Floor {n}` / `· Book {numeral}`. NO tint band. Floor colour appears ONLY
 * in the header — every cell body stays neutral, which is why the accent
 * class lives on the header bar `div`, not on the section/table wrapper (a
 * FloorCard difference: FloorCard's whole card carries the accent border
 * because FloorCard IS one floor's surface; here one wrapper holds all 4
 * floors, so the stripe has to scope to just the header row per floor).
 *
 * Table semantics: a real `<table>` per floor (F-4/history-parity call —
 * legacy `WeeklyLootGrid` is a div/flex layout with no header row at all;
 * this file is a re-expression, never a transcription — reference-only,
 * never imported from). Each floor's `<thead>` row leads with a visually
 * blank `<td>` — a pure column-alignment filler so the `<tbody>` row's
 * leading `<th scope="row">Loot</th>` lines up under it; it describes no
 * column of data, so it takes no `scope` (or any header semantics at all —
 * it is deliberately a `<td>`, not a `<th>`, the conventional blank-corner
 * pattern) and is excluded from the "column count" the per-floor
 * gear+material `<th scope="col">` count is measured against (F1 4 · F2 5 ·
 * F3 4 · F4 1, tested against the loot table shape, not this filler). An
 * earlier draft carried a `<th>` with an sr-only "Recipient" name to satisfy
 * `jsx-a11y/control-has-associated-label`; review caught that a header cell
 * here gives AT no real column to describe, and browser heuristics resolve
 * it against the `<tbody>` row's OWN header ("Loot") instead — a false
 * label. The plain `<td>` needs no such name because it isn't a header.
 *
 * Column-header content: gear headers pair `GearSlotIcon` (decorative,
 * unlabeled — the header ALSO spells the slot name, so a `label` would
 * double-read) with the label text, both inside ONE `inline-flex items-center
 * gap-1` wrapper span (F-4: `GearSlotIcon`'s own aria-hidden span is
 * `inline-block`; the app-wide index.css rule
 * `[aria-hidden="true"]:not([role="presentation"])... { display: revert
 * !important }` reverts that to `inline` — losing its explicit width/height —
 * UNLESS a flex/grid ancestor blockifies it, which this wrapper does. The
 * wrapper itself is NOT aria-hidden — it carries the real, announced label
 * text, so hiding it would silence the column name). Material headers colour
 * the label text itself via `style={{ color: MATERIAL_TOKEN[material] }}`
 * (the shared material→token map `NeedMatrix` already reuses from
 * `FloorDropRow`, per director F-13's "one derivation" rule) — no separate
 * icon, no duplicate label; the coloured text IS the column name.
 *
 * Cell body: `RecipientBadge` (`./RecipientBadge.tsx` — extracted D6 Task 2 so
 * `LogCellEntriesMenu` shares it) — role-tinted per its `roleVar` helper
 * (`NeedMatrix.tsx:46`'s pattern), `JobIcon` + name, `min-h-7` reserved on
 * its wrapper so empty↔filled never shifts row height (legacy's fixed-28px
 * rationale, `WeeklyLootGrid.tsx:374-376`, re-expressed as `min-h-7`). An unknown
 * `recipientPlayerId` (player left the roster) falls back to
 * `entry.recipientPlayerName` in `var(--color-text-secondary)`, no job icon —
 * the record survives the player. A second+ entry's `×N` route is
 * `LogCellEntriesMenu` (`./LogCellEntriesMenu.tsx`, D6 Task 2) — a REAL
 * trigger button, mounted D6a Task 4. Editing the main control always
 * targets `entries[0]` (newest — Task 2 sorts DESC); the chip menu reaches
 * every other entry.
 *
 * Interactivity (R-17 / director F-15): `Button variant="ghost" size="sm"`
 * is the cell's edit control — never `IconButton` for IT (that's
 * `NeedMatrix`'s pattern for a single glyph; here the control's accessible
 * name already carries the recipient, so a text-capable `Button` is the
 * right primitive, not a workaround). `canEdit=false` drops the `Button`
 * entirely — bare badge/dash + an `sr-only` sentence, `NeedMatrix.tsx:226-
 * 229`'s read-only pattern. `canEdit && !canAssignMaterial`: EMPTY material
 * cells take the same read-only branch (F-12 — no enabled button whose
 * handler cannot act, `FloorCard.tsx:174-180` precedent); filled material
 * cells stay editable regardless (the edit door needs no suggestion pool).
 *
 * D6a Task 4 anatomy: a FILLED interactive cell is no longer one lone
 * `Button` — it's a `<span className="group flex items-center gap-1">`
 * holding up to three siblings, no button nested in another: the edit
 * `Button` (`flex-1`), `LogCellEntriesMenu`'s chip trigger (multi-entry
 * only), and a hover/focus-revealed kebab `IconButton` (R-D6b, every filled
 * cell) that opens the SAME `buildEntryMenuItems` menu the right-click does
 * — one items list, two triggers, anchored to its own rect rather than the
 * cursor. An EMPTY interactive cell keeps the single-`Button` shape (no
 * chip, no kebab — there's nothing yet to open a menu about). The multi-
 * entry accessible name folds the count in (`… (newest of N)`, the D5-owed
 * fix) so it's announced on both the edit button and the chip trigger.
 *
 * D6a Task 6 wiring: the modifier layer is live on the edit control — plain
 * click/AT-activation (`detail===0`) edits `entries[0]` (D6-c: a cell's
 * PRIMARY action, never the jump), Shift+Click copies a Log deep link,
 * Alt+Click jumps to the recipient's roster card, and `useAltHeld` swaps the
 * cursor to a pointer only while Alt is held AND a jump target resolves.
 * Empty-cell modifier clicks are no-ops (D6-h). Alt+Enter does **not** ride
 * the same jump route (D6a browser pass, F3, live-falsified in Chrome):
 * Chrome's keyboard-activation click on a focused `<button>` does not carry
 * `altKey`, so a trusted Alt+Enter fires the PRIMARY action (edit) — same as
 * a plain click, never the jump. The keyboard/AT jump routes are the
 * per-cell kebab and Shift+F10/menu-key → "Jump to {player}" in the context
 * menu below, per D6-c's own rationale ("the AT route to the jump is the
 * context menu") — no separate keydown handler exists or is needed. The
 * context menu (right-click anywhere in the filled cell — the ×N chip, the
 * kebab, or the cell's own padding, not just the edit button; PR #244 r3
 * fix moved `onContextMenu` from the edit `Button` to the FILLED-cell
 * wrapper `<span className="group ...">` so the whole cell is the target —
 * or the cell's own hover/focus-revealed kebab — one kebab per filled cell,
 * so two trigger routes total) is Edit / Copy link / Jump to {player} (only
 * when the recipient resolves) / Delete (danger, routed through `Loot.tsx`'s
 * existing confirm modals — legacy parity, `SectionedLogView.tsx:901-906` +
 * `:262-275`). Shift+F10/menu-key fires `contextmenu` on whichever control
 * has focus (edit button, chip, or kebab); it bubbles to the wrapper's
 * handler same as a mouse right-click, so `e.currentTarget` there is always
 * the wrapper — one anchor rect for both input methods. Read-only
 * (`canEdit=false`) cells stay fully inert — no modifiers, no menu, no
 * kebab (D6-l, a named divergence from legacy's viewer-facing copy/jump —
 * see `phase-d-loot-plan.md` §5).
 *
 * D6b Task 4 remainder (teaching tooltip + hover-×): every FILLED
 * interactive cell's edit `Button` is wrapped in a `Tooltip` carrying the
 * file-local `CellTeachingTooltip` — the R-27 modifier legend (Click/
 * Shift+Click/Alt+Click/Right-click), the Alt row omitted when no jump
 * target resolves (same `canJump` gate `jump` already computes). An EMPTY
 * interactive cell's `Button` gets a one-line "Click to log {label}" tooltip
 * instead. The anatomy's new sibling — a hover/focus-revealed `×` `IconButton`
 * between the ×N chip and the kebab (R-27 + D6-e) — deletes the NEWEST entry
 * only (older entries: chip menu → edit door, or History). Read-only cells
 * render no trigger at all, so they carry no tooltip either (D6-l holds).
 * NOT yet shipped here: the count bar/legend mounted below the grid, and the
 * floor-header "Log floor" kebab.
 */
import { useMemo, useState } from 'react';
import { ClipboardList, MoreVertical, X } from 'lucide-react';
import { Button, IconButton, Tooltip } from '../primitives';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '../primitives/Dropdown';
import { Tag } from '../ui';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { GearSlotIcon } from '../ui/GearSlotIcon';
import { useAltHeld } from '../../hooks/useAltHeld';
import { jumpMenuAnchor } from '../roster/rosterLedgerJumps';
import { FLOOR_TEXT_CLASS, FLOOR_ACCENT_CLASS } from './floorClasses';
import { MATERIAL_TOKEN } from './FloorDropRow';
import { RecipientBadge, resolveRecipient, type RecipientLike } from './RecipientBadge';
import { LogCellEntriesMenu } from './LogCellEntriesMenu';
import {
  buildLogWeekGrid, logCellDomId, type LogGridFloor, type LogGridEntryRef, type HighlightEntryRef,
} from './logWeekGridData';
import type { FloorNumber } from '../../gamedata/loot-tables';
import type {
  GearSlot, LootLogEntry, MaterialLogEntry, MaterialType, SnapshotPlayer,
} from '../../types';

export interface LogWeekGridProps {
  floors: string[];
  week: number;
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  /** Full roster incl. subs — a sub who received loot must still render a badge. */
  players: SnapshotPlayer[];
  canEdit: boolean;
  /** False on a degenerate empty roster — see the F-12 gating note above. */
  canAssignMaterial: boolean;
  onAssignGear: (item: { slot: GearSlot | 'ring'; label: string; floorNumber: FloorNumber }) => void;
  onEditGear: (entry: LootLogEntry) => void;
  onAssignMaterial: (material: MaterialType, floorNumber: FloorNumber) => void;
  onEditMaterial: (entry: MaterialLogEntry) => void;
  /**
   * D6 Task 3 → D6a Task 6 tightens to required (TS now enforces every mount
   * wires it). Shift+Click on a filled cell (R-18). Context-menu "Copy link"
   * — see `buildEntryMenuItems`.
   */
  onCopyEntryLink: (ref: LogGridEntryRef) => void;
  /** D6 Task 3 → required. Alt+Click / context-menu "Jump to {name}" — the R-18 jump gate. */
  onJumpToPlayer: (playerId: string) => void;
  /** D6 Task 3 → required. context-menu "Delete" (danger, after a separator). */
  onDeleteEntry: (ref: LogGridEntryRef) => void;
  /**
   * D6a Task 6: the `?entry=` deep-link target (`Loot.tsx`'s consumption
   * effect, gated on the Log view). The matching filled cell's wrapper span
   * gets `id={logCellDomId(ref)}` and ` highlight-pulse` appended — the exact
   * `LootEntryRow.tsx:80-83` idiom. `null` when nothing is highlighted.
   */
  highlightEntry: HighlightEntryRef | null;
  /**
   * D6b Task B: the floor-header kebab's "Log floor" item — opens the
   * ALREADY-shipped `LogWeekWizard` single-floor run at this floor
   * (`Loot.tsx` wires it to `setWizardState({ floor })`). Required (B-R2 —
   * lands required directly, no optional shim); `FloorSection` gates its
   * kebab on `canEdit` alone.
   */
  onLogFloor: (floor: FloorNumber) => void;
}

/** The grid-root right-click menu's state — ONE mount, never per-cell (director F-15). */
interface LogGridMenuState {
  x: number;
  y: number;
  ref: LogGridEntryRef;
  jumpPlayerId: string | null;
}

interface GridCellProps<E extends RecipientLike> {
  entries: E[];
  label: string;
  floorName: string;
  interactive: boolean;
  playerMap: Map<string, SnapshotPlayer>;
  /** Shared Alt-held state — ONE `useAltHeld()` call at the `LogWeekGrid` top level (D6 Task 3). */
  altHeld: boolean;
  /** Builds this cell's `LogGridEntryRef` — the caller knows its own kind ('loot'/'material'), so
   *  `GridCell` never has to discriminate a generic `E` at runtime. */
  buildRef: (entry: E) => LogGridEntryRef;
  onEmpty: () => void;
  onFilled: (entry: E) => void;
  /** D6a Task 6 tightened these to required (`LogWeekGridProps` already requires both) — D6b Task 4
   *  remainder fold-in (ruling B-R5) drops the now-dead optional-guards this left behind. */
  onCopyEntryLink: (ref: LogGridEntryRef) => void;
  onJumpToPlayer: (playerId: string) => void;
  /** Opens the grid-root context menu (the `LogWeekGrid`-level `setMenu`). */
  onOpenMenu: (state: LogGridMenuState) => void;
  /** D6b Task 4 remainder: the hover-× (R-27 + D6-e) — deletes the newest entry only. */
  onDeleteEntry: (ref: LogGridEntryRef) => void;
  /** D6a Task 6: the screen-level `?entry=` target — `null` when nothing is highlighted. */
  highlightEntry: HighlightEntryRef | null;
}

/**
 * CellTeachingTooltip — R-27's per-cell modifier legend, mounted on the
 * FILLED interactive cell's edit `Button` (D6b Task 4 remainder). A
 * re-expression of the roster kebab's own teaching tooltip
 * (`RosterCard.tsx`'s "Player Options" hint, R-076) for THIS grid's own
 * modifier set — data-driven so the four rows aren't hand-repeated JSX
 * (jscpd headroom) — never a transcription of `history/`'s
 * `EntryPopover`/`WeeklyLootGrid` (jscpd is blocking CI; those files don't
 * teach modifier chips at all). The Alt row only renders when a jump target
 * actually resolves (`canJump`) — the same "affordance exists only when the
 * target does" rule `GridCell`'s own `jump` gate below already applies.
 */
const CELL_TEACHING_ROWS: { key: string; desc: string; jumpOnly?: boolean }[] = [
  { key: 'Click', desc: 'Edit entry' },
  { key: 'Shift+Click', desc: 'Copy link' },
  { key: 'Alt+Click', desc: 'Go to player', jumpOnly: true },
  { key: 'Right-click', desc: 'More options' },
];

function CellTeachingTooltip({ canJump }: { canJump: boolean }) {
  return (
    <div className="space-y-1 text-xs">
      {CELL_TEACHING_ROWS.filter((row) => !row.jumpOnly || canJump).map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <kbd className="rounded bg-surface-base px-1 py-0.5 font-mono text-xs">{row.key}</kbd>
          <span className="text-text-muted">{row.desc}</span>
        </div>
      ))}
    </div>
  );
}

/** One `<td>`'s body — shared by gear and material cells (both entry shapes satisfy `RecipientLike`). */
function GridCell<E extends RecipientLike>({
  entries, label, floorName, interactive, playerMap, altHeld, buildRef,
  onEmpty, onFilled, onCopyEntryLink, onJumpToPlayer, onOpenMenu, onDeleteEntry, highlightEntry,
}: GridCellProps<E>) {
  const newest = entries[0];
  const recipient = newest ? resolveRecipient(newest, playerMap) : undefined;
  const isMulti = entries.length > 1;
  // D6a Task 6 (F1 fix, PR #244 review): the highlighted ref is found by
  // SEARCHING the whole cell, not assumed to be `newest`. A deep link copied
  // before a second entry landed in the same cell can target an OLDER entry —
  // `Loot.tsx`'s `?entry=` validation matches against the WHOLE unfiltered
  // log, not just each cell's newest — so a link like that used to validate,
  // re-point the week, and then silently no-op scroll: nothing in the cell
  // ever carried that entry's DOM id. Search every entry so the id + pulse
  // land on whichever one actually matches, wherever it sits in the cell.
  const highlightedRef = highlightEntry
    ? entries.map(buildRef).find((r) => r.kind === highlightEntry.kind && r.entry.id === highlightEntry.id)
    : undefined;

  // D6a Task 4: the interactive branch's ×N route lives entirely in
  // `LogCellEntriesMenu` now — the edit control's content is the badge
  // alone, never a chip (there's nothing to click-through to on a control
  // that already opens the newest entry).
  const content = newest && recipient ? (
    <RecipientBadge color={recipient.color} name={recipient.name} job={recipient.job} />
  ) : (
    <span className="text-text-muted italic">—</span>
  );

  const body = <span className="inline-flex min-h-7 items-center gap-1">{content}</span>;

  if (!interactive) {
    // D6-l + review fix: a multi-entry read-only cell keeps a STATIC ×N span
    // (D5's chip styling, reproduced verbatim — never a button, never
    // aria-hidden, so the F-4 sweep is unaffected) alongside the sr-only
    // sentence. There's no `LogCellEntriesMenu` trigger here (Viewer-role
    // cells render no controls at all), so the sighted ×N signal would
    // otherwise be lost entirely for share-code viewers while screen-reader
    // users still get it from the sentence — restored so both audiences see
    // the count, not just one.
    //
    // F2 (director M2) fix: the chip sits INSIDE this span's own
    // `inline-flex ... gap-1` wrapper — D5's original shape
    // (`020b4e42:LogWeekGrid.tsx:161-171`) — not outside `body`, so
    // `gap-1`/`items-center` apply to it instead of it landing flush on the
    // text baseline. This is a fresh wrapper, not the shared `body` above:
    // `body` also backs the interactive branch's edit button, which must
    // NOT gain a chip in its content (its ×N route is `LogCellEntriesMenu`,
    // a sibling of the button, not part of it).
    //
    // F1 (director R2) fix: this wrapper also carries the `?entry=`
    // deep-link landing contract — `id={logCellDomId(ref)}` +
    // ` highlight-pulse` when this cell holds the highlighted entry, reusing
    // the exact `highlightedRef` plumbing the interactive branch uses below
    // (PR #244 F1 follow-up: `highlightedRef` is found by searching every
    // entry in the cell, not assumed to be `newest` — see the derivation's
    // own comment above). No control is added (no button/role/tabIndex/onClick
    // — D6-l keeps viewer cells inert) and the span is never aria-hidden (the
    // F-4 sweep stays green).
    const sentence = recipient
      ? (isMulti ? `${label}: ${recipient.name}, ${entries.length} entries` : `${label}: ${recipient.name}`)
      : `${label}: not logged`;
    return (
      <>
        <span
          id={highlightedRef ? logCellDomId(highlightedRef) : undefined}
          className={`inline-flex min-h-7 items-center gap-1${highlightedRef ? ' highlight-pulse' : ''}`}
        >
          {content}
          {isMulti && (
            <span className="rounded bg-accent/20 px-1 text-xs font-bold text-accent">×{entries.length}</span>
          )}
        </span>
        <span className="sr-only">{sentence}</span>
      </>
    );
  }

  // D6a Task 4 (the D5-owed fold-in fix): a multi-entry cell's accessible
  // name carries the count too, so it's announced on BOTH the edit button
  // and the chip trigger, not just the chip.
  const ariaLabel = recipient
    ? (isMulti
      ? `Edit ${label} for ${recipient.name} — ${floorName} (newest of ${entries.length})`
      : `Edit ${label} for ${recipient.name} — ${floorName}`)
    : `Log ${label} — ${floorName}`;

  // D6 Task 3 (director F-15): the jump gate — one `playerMap` lookup, no
  // re-resolution in `FloorSection`. This is what makes the "affordance
  // exists only when the target does" claim true, matching `Roster.tsx:361`'s
  // own `players.some(...)` guard on the consuming side.
  const jump = newest && playerMap.has(newest.recipientPlayerId)
    ? () => onJumpToPlayer(newest.recipientPlayerId)
    : null;

  const copyLink = () => {
    if (!newest) return;
    onCopyEntryLink(buildRef(newest));
  };

  // PR #244 r3 fix: `requestMenu` now anchors off whatever element it's
  // called on — the FILLED-cell WRAPPER span (below), not the edit `Button`
  // — so its rect arg is typed generically rather than pinned to a button.
  const requestMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (!newest) return;
    const { x, y } = jumpMenuAnchor(e, e.currentTarget.getBoundingClientRect());
    onOpenMenu({
      x,
      y,
      ref: buildRef(newest),
      jumpPlayerId: jump ? newest.recipientPlayerId : null,
    });
  };

  const editButton = (
    <Button
      variant="ghost"
      size="sm"
      className={`${newest ? 'flex-1' : 'w-full'} justify-start${altHeld && jump ? ' cursor-pointer' : ''}`}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (!newest) {
          if (e.shiftKey || e.altKey) return;              // D6-h: empty interactive cell modifiers are no-ops
          onEmpty();
          return;
        }
        if (e.shiftKey) { copyLink(); return; }             // R-18: Shift copies
        if (e.altKey)   { if (jump) jump(); return; }       // R-18: Alt jumps; no target → no-op
        onFilled(newest);                                   // plain + AT (detail===0): edit (D6-c)
      }}
    >
      {body}
    </Button>
  );

  // Empty interactive cells keep the single-`Button` shape — no chip, no
  // kebab (there's nothing yet to open a menu about) — wrapped in a
  // one-line teaching tooltip (D6b Task 4 remainder).
  if (!newest) {
    // Fold-in #1 (Task A review): pin the same 400ms delay the filled-cell
    // tooltip below uses — this one used to fall through to the provider's
    // 500ms default, giving the grid two different hover delays for no
    // reason.
    return <Tooltip content={`Click to log ${label}`} delayDuration={400}>{editButton}</Tooltip>;
  }

  // D6b Task 4 remainder: the hover-× (R-27 + D6-e) deletes the NEWEST entry
  // only — an older entry's route is the chip menu's edit door or History,
  // the same "interim, same shape as D5's edit-newest" contract the edit
  // button and kebab already share. Controller ruling B-R1: the
  // ` — ${floorName}` suffix (a deliberate deviation from the plan's literal
  // string) keeps the family consistent with the kebab's own D6a-fixed
  // label — two same-recipient same-slot cells on different floors would
  // otherwise collide. `recipientName` (not `recipient.name` directly)
  // because TS can't correlate `recipient`'s `newest`-derived nullability
  // across the `!newest` return above — the runtime value is always
  // resolved here (`resolveRecipient` never itself returns undefined), but
  // the fallback keeps this defensive against a future refactor and never
  // renders "undefined".
  const recipientName = recipient ? recipient.name : newest.recipientPlayerName;

  // R-D6b (ruled): every FILLED interactive cell's sibling row gains a
  // hover/focus-revealed kebab opening the SAME `buildEntryMenuItems` items
  // the right-click context menu opens — one items list, two triggers.
  // Anchored to the kebab's own rect (not the cursor), the
  // `useRosterCardActions` kebab-menu shape in miniature.
  const openKebabMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onOpenMenu({
      x: r.left,
      y: r.bottom,
      ref: buildRef(newest),
      jumpPlayerId: jump ? newest.recipientPlayerId : null,
    });
  };

  return (
    <span
      id={highlightedRef ? logCellDomId(highlightedRef) : undefined}
      className={`group flex items-center gap-1${highlightedRef ? ' highlight-pulse' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        requestMenu(e);
      }}
    >
      <Tooltip content={<CellTeachingTooltip canJump={jump != null} />} delayDuration={400}>
        {editButton}
      </Tooltip>
      {isMulti && (
        <LogCellEntriesMenu
          entryRefs={entries.map(buildRef)}
          playerMap={playerMap}
          cellLabel={label}
          floorName={floorName}
          // Same edit door `onFilled` already targets (kind-discriminated
          // onEditGear/onEditMaterial — `FloorSection` binds the right one
          // per cell-kind). `ref.entry` is guaranteed to be this cell's `E`
          // at runtime (`buildRef` built every ref FROM an `E`); the
          // generic can't express that statically, hence the cast.
          onEdit={(ref) => onFilled(ref.entry as unknown as E)}
        />
      )}
      <IconButton
        aria-label={`Delete ${label} entry for ${recipientName} — ${floorName}`}
        icon={<X className="h-3 w-3" />}
        variant="ghost"
        size="sm"
        className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
        onClick={() => onDeleteEntry(buildRef(newest))}
      />
      <IconButton
        aria-label={`${label} entry actions — ${floorName}`}
        icon={<MoreVertical className="h-3.5 w-3.5" />}
        variant="ghost"
        size="sm"
        aria-haspopup="menu"
        className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
        onClick={openKebabMenu}
      />
    </span>
  );
}

interface FloorSectionProps {
  floor: LogGridFloor;
  week: number;
  playerMap: Map<string, SnapshotPlayer>;
  canEdit: boolean;
  canAssignMaterial: boolean;
  altHeld: boolean;
  onAssignGear: LogWeekGridProps['onAssignGear'];
  onEditGear: LogWeekGridProps['onEditGear'];
  onAssignMaterial: LogWeekGridProps['onAssignMaterial'];
  onEditMaterial: LogWeekGridProps['onEditMaterial'];
  onCopyEntryLink: LogWeekGridProps['onCopyEntryLink'];
  onJumpToPlayer: LogWeekGridProps['onJumpToPlayer'];
  onOpenMenu: (state: LogGridMenuState) => void;
  /** D6b Task 4 remainder: the hover-× — passed to every `GridCell` (gear + material alike). */
  onDeleteEntry: LogWeekGridProps['onDeleteEntry'];
  highlightEntry: LogWeekGridProps['highlightEntry'];
  /** D6b Task B: the floor-header kebab's "Log floor" item. */
  onLogFloor: LogWeekGridProps['onLogFloor'];
  isFirst: boolean;
}

function FloorSection({
  floor, week, playerMap, canEdit, canAssignMaterial, altHeld,
  onAssignGear, onEditGear, onAssignMaterial, onEditMaterial,
  onCopyEntryLink, onJumpToPlayer, onOpenMenu, onDeleteEntry, highlightEntry, onLogFloor, isFirst,
}: FloorSectionProps) {
  const {
    floorNumber, floorName, bookNumeral, gearCells, materialCells,
  } = floor;
  // Same guard FloorCard.tsx:127 uses — a "Floor N" chip beside "Floor N"
  // heading is the duplication PR #224's review caught at the other header sites.
  const hasDutyName = floorName !== `Floor ${floorNumber}`;

  return (
    <div className={isFirst ? '' : 'border-t border-border-default'}>
      <div
        className={`flex items-center gap-3 border-b border-border-default bg-surface-base px-4 py-3 ${FLOOR_ACCENT_CLASS[floorNumber]}`}
      >
        {hasDutyName && <Tag variant="label" tone="muted">{floorName}</Tag>}
        <span className={`font-display text-sm font-bold ${FLOOR_TEXT_CLASS[floorNumber]}`}>Floor {floorNumber}</span>
        <span className="text-xs text-text-muted">· Book {bookNumeral}</span>
        {/* D6b Task B (R-25): the floor-header door into the single-floor
            wizard run — gated on `canEdit` alone (the prop is required, so
            no presence check). NOT a standing button: D7 later adds this
            floor's resets to this same menu. */}
        {canEdit && (
          <Dropdown>
            <DropdownTrigger asChild>
              <IconButton
                aria-label={`${floorName} actions`}
                icon={<MoreVertical className="h-4 w-4" />}
                variant="ghost"
                size="sm"
                className="ml-auto"
              />
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownItem icon={<ClipboardList className="h-4 w-4" />} onSelect={() => onLogFloor(floorNumber)}>
                Log floor
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            {floorName} — Floor {floorNumber}, Book {bookNumeral}, week {week} record
          </caption>
          <thead>
            <tr>
              {/* Column-alignment filler above the "Loot" row header — a conventional
                  blank corner cell (`<td>`, not `<th>`): a header cell here would give
                  AT no real column to describe (browser heuristics resolve it against
                  the ROW header below, "Loot" — a false label), so it stays a plain,
                  unlabeled `<td>` instead of reaching for an sr-only name to satisfy it. */}
              {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- empty corner cell (role=cell, not a control); the rule is upstream-off and over-broad via the a11yRecommendedWarn mapping */}
              <td className="px-3 py-2" />
              {gearCells.map((cell) => (
                <th key={cell.slot} scope="col" className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <GearSlotIcon slot={cell.slot} size={16} />
                    {cell.label}
                  </span>
                </th>
              ))}
              {materialCells.map((cell) => (
                <th
                  key={cell.material}
                  scope="col"
                  className="border-l border-border-default bg-surface-base px-3 py-2 text-left text-xs font-medium text-text-muted"
                >
                  <span style={{ color: MATERIAL_TOKEN[cell.material] }}>{cell.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="px-3 py-2 text-left text-xs uppercase tracking-wide text-text-muted">
                Loot
              </th>
              {gearCells.map((cell) => (
                <td key={cell.slot} className="px-3 py-2">
                  <GridCell
                    entries={cell.entries}
                    label={cell.label}
                    floorName={floorName}
                    interactive={canEdit}
                    playerMap={playerMap}
                    altHeld={altHeld}
                    buildRef={(entry) => ({ kind: 'loot', entry })}
                    onEmpty={() => onAssignGear({ slot: cell.slot, label: cell.label, floorNumber })}
                    onFilled={onEditGear}
                    onCopyEntryLink={onCopyEntryLink}
                    onJumpToPlayer={onJumpToPlayer}
                    onOpenMenu={onOpenMenu}
                    onDeleteEntry={onDeleteEntry}
                    highlightEntry={highlightEntry}
                  />
                </td>
              ))}
              {materialCells.map((cell) => {
                const isEmpty = cell.entries.length === 0;
                // F-12: an empty material cell with no suggestion pool renders read-only,
                // never an enabled button whose handler cannot act. A filled cell's edit
                // door needs no suggestion pool, so it stays editable regardless.
                const interactive = canEdit && (!isEmpty || canAssignMaterial);
                return (
                  <td key={cell.material} className="border-l border-border-default bg-surface-base px-3 py-2">
                    <GridCell
                      entries={cell.entries}
                      label={cell.label}
                      floorName={floorName}
                      interactive={interactive}
                      playerMap={playerMap}
                      altHeld={altHeld}
                      buildRef={(entry) => ({ kind: 'material', entry })}
                      onEmpty={() => onAssignMaterial(cell.material, floorNumber)}
                      onFilled={onEditMaterial}
                      onCopyEntryLink={onCopyEntryLink}
                      onJumpToPlayer={onJumpToPlayer}
                      onOpenMenu={onOpenMenu}
                      onDeleteEntry={onDeleteEntry}
                      highlightEntry={highlightEntry}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The grid-root right-click menu's items, in R-18 order: Edit · Copy link ·
 * Jump to {name} (only when the jump target actually resolved — the same
 * gate `GridCell`'s `jump` closure already applied, recorded here as
 * `jumpPlayerId`) · separator + Delete (danger). `onCopyEntryLink` /
 * `onJumpToPlayer` / `onDeleteEntry` are required on `LogWeekGridProps`
 * (D6a Task 6) — every cell reaching this menu is already `canEdit`-gated
 * (interactive branch), so no per-item `canEdit` check is needed here either.
 */
function buildEntryMenuItems(
  menu: LogGridMenuState,
  playerMap: Map<string, SnapshotPlayer>,
  onEditGear: LogWeekGridProps['onEditGear'],
  onEditMaterial: LogWeekGridProps['onEditMaterial'],
  onCopyEntryLink: LogWeekGridProps['onCopyEntryLink'],
  onJumpToPlayer: LogWeekGridProps['onJumpToPlayer'],
  onDeleteEntry: LogWeekGridProps['onDeleteEntry'],
): ContextMenuItem[] {
  const { ref, jumpPlayerId } = menu;
  const items: ContextMenuItem[] = [
    {
      label: 'Edit',
      onClick: () => (ref.kind === 'loot' ? onEditGear(ref.entry) : onEditMaterial(ref.entry)),
    },
    { label: 'Copy link', onClick: () => onCopyEntryLink(ref) },
  ];
  if (jumpPlayerId) {
    const player = playerMap.get(jumpPlayerId);
    if (player) {
      items.push({ label: `Jump to ${player.name}`, onClick: () => onJumpToPlayer(jumpPlayerId) });
    }
  }
  items.push({ separator: true });
  items.push({ label: 'Delete', danger: true, onClick: () => onDeleteEntry(ref) });
  return items;
}

export function LogWeekGrid(props: LogWeekGridProps) {
  const {
    floors, week, lootLog, materialLog, players, canEdit, canAssignMaterial,
    onAssignGear, onEditGear, onAssignMaterial, onEditMaterial,
    onCopyEntryLink, onJumpToPlayer, onDeleteEntry, highlightEntry, onLogFloor,
  } = props;

  const grid = useMemo(
    () => buildLogWeekGrid({
      floors, week, lootLog, materialLog,
    }),
    [floors, week, lootLog, materialLog],
  );
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  // D6 Task 3: ONE `useAltHeld()` call at the grid top level, passed down —
  // never one hook instance per cell.
  const altHeld = useAltHeld();
  // D6 Task 3: ONE `ContextMenu` mount at the grid root — every floor's cells
  // share this single state, never a per-floor or per-cell menu instance.
  const [menu, setMenu] = useState<LogGridMenuState | null>(null);

  return (
    <div
      data-testid="log-week-grid"
      className="overflow-hidden rounded-lg border border-border-default bg-surface-card"
    >
      {grid.map((floor, idx) => (
        <FloorSection
          key={floor.floorNumber}
          floor={floor}
          week={week}
          playerMap={playerMap}
          canEdit={canEdit}
          canAssignMaterial={canAssignMaterial}
          altHeld={altHeld}
          onAssignGear={onAssignGear}
          onEditGear={onEditGear}
          onAssignMaterial={onAssignMaterial}
          onEditMaterial={onEditMaterial}
          onCopyEntryLink={onCopyEntryLink}
          onJumpToPlayer={onJumpToPlayer}
          onOpenMenu={setMenu}
          onDeleteEntry={onDeleteEntry}
          highlightEntry={highlightEntry}
          onLogFloor={onLogFloor}
          isFirst={idx === 0}
        />
      ))}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildEntryMenuItems(menu, playerMap, onEditGear, onEditMaterial, onCopyEntryLink, onJumpToPlayer, onDeleteEntry)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
