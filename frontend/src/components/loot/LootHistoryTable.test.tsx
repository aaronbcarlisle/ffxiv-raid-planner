import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { LootHistoryTable } from './LootHistoryTable';
import { historyRowDomId } from './logWeekGridData';
import { parseHistoryQuery } from '../../utils/historyQuery';
import { GEAR_SLOT_ICONS } from '../../types';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Aria',
    job: 'WHM',
    role: 'healer',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    ...overrides,
  } as unknown as SnapshotPlayer;
}

function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 2,
    floor: 'M10S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-24T12:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 2,
    floor: 'M10S',
    materialType: 'twine',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    createdAt: '2026-06-24T12:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

const floors = ['M9S', 'M10S', 'M11S', 'M12S'];
const players = [makePlayer()];

/**
 * D10: the table takes a PARSED query where it used to take `HistoryFilterState`.
 * Fixtures go through the real parser rather than hand-built objects so a test
 * exercises the same shape `Loot` hands down — a hand-rolled `{ filters: [...] }`
 * could drift from what `parseHistoryQuery` actually emits and still pass.
 */
function q(query = '') {
  return parseHistoryQuery(query);
}

/**
 * A UTC-pinned range generator: week N starts Jun 16 2026 UTC + (N-1) weeks.
 * Week 3 therefore spans Jun 30 - Jul 7. Built from `Date.UTC` so that a
 * formatter which lost its `timeZone: 'UTC'` renders a DIFFERENT day — note
 * this only bites off UTC (it does locally, `America/New_York`; a UTC CI
 * runner cannot tell the two apart, so treat this as a local guard).
 */
const rangeOfWeek = (week: number) => ({
  start: new Date(Date.UTC(2026, 5, 16 + (week - 1) * 7)),
  end: new Date(Date.UTC(2026, 5, 23 + (week - 1) * 7)),
});

/**
 * Reports the live query string, so a test can assert that the deep-link
 * effect CLEANED UP rather than inferring it from the absence of a pulse.
 * Inert: outside the table, no role, no aria.
 */
function LocationProbe() {
  return <span data-testid="location-search">{useLocation().search}</span>;
}

function search(): string {
  return screen.getByTestId('location-search').textContent ?? '';
}

/** One author for the default prop set — `renderTable` and the T-9 rerender both read it. */
function tableProps(overrides: Partial<Parameters<typeof LootHistoryTable>[0]> = {}) {
  return {
    lootLog: [],
    materialLog: [],
    players,
    floors,
    query: q(),
    currentWeek: 3,
    rangeOfWeek,
    logsLoading: false,
    logsFailed: false,
    canEdit: true,
    onEdit: vi.fn(),
    onCopyLink: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

function renderTable(overrides: Partial<Parameters<typeof LootHistoryTable>[0]> = {}, initialEntries: string[] = ['/']) {
  const props = tableProps(overrides);
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LootHistoryTable {...props} />
      <LocationProbe />
    </MemoryRouter>
  );
}

/** Row-scoped: the kebab's accessible name is row-specific, so match the shared middle. */
function openKebab(container: HTMLElement) {
  fireEvent.keyDown(within(container).getByRole('button', { name: /entry actions/ }), { key: 'Enter' });
}

/** Column order is the table's contract: Week · Floor · Slot · Player · Method · Date · Type · ⋮ */
const COL = { week: 0, floor: 1, slot: 2, player: 3, method: 4, date: 5, type: 6, actions: 7 } as const;

function rowIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr[id]')).map((tr) => tr.id);
}

/**
 * Separators are the only `<tbody>` rows without an entry id (the empty-state
 * row aside). Read as ` | `-joined span text, not raw `textContent`: JSX drops
 * the whitespace between sibling elements, so a plain concatenation would run
 * "WEEK 3" straight into the range.
 */
function separatorText(tr: Element): string {
  return Array.from(tr.querySelectorAll('span'))
    .map((sp) => sp.textContent?.trim() ?? '')
    .join(' | ');
}

function separatorTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr:not([id])')).map(separatorText);
}

/** The interleave, in DOM order: entry ids as-is, separators as `sep:<text>`. */
function rowSequence(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr')).map((tr) =>
    tr.id ? tr.id : `sep:${separatorText(tr)}`
  );
}

function cell(rowId: string, col: number): HTMLElement {
  const row = document.getElementById(rowId);
  if (!row) throw new Error(`row ${rowId} not rendered`);
  return row.querySelectorAll('td')[col];
}

function header(label: string): HTMLElement {
  return screen.getByRole('columnheader', { name: label });
}

const GEAR_SLOT_ART = '/images/gear-slots/';

function spansWithGearArt(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('span')).filter((s) =>
    (s.getAttribute('style') ?? '').includes(GEAR_SLOT_ART)
  );
}

describe('LootHistoryTable', () => {
  describe('headers + caption', () => {
    it('renders seven sortable column headers, an sr-only Actions header and a caption', () => {
      const { container } = renderTable({ lootLog: [makeLootEntry()] });

      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(8);

      expect(header('Week')).toHaveAttribute('aria-sort', 'descending');
      for (const label of ['Floor', 'Slot', 'Player', 'Method', 'Date', 'Type']) {
        expect(header(label)).toHaveAttribute('aria-sort', 'none');
      }

      const actions = header('Actions');
      expect(actions).toHaveTextContent('Actions');
      expect(within(actions).queryByRole('button')).not.toBeInTheDocument();

      const caption = container.querySelector('caption');
      expect(caption).not.toBeNull();
      expect(caption).toHaveClass('sr-only');
      expect(caption?.textContent?.trim()).not.toBe('');
    });
  });

  describe('sorting', () => {
    it('renders the default order (week desc, newest first within a week) from out-of-order seeding', () => {
      // Seeded deliberately NOT in display order: [loot W1 old, mat W2 old, loot W2 new, loot W1 new].
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 1, createdAt: '2026-06-17T10:00:00Z' }),
        makeLootEntry({ id: 3, weekNumber: 2, createdAt: '2026-06-24T12:00:00Z' }),
        makeLootEntry({ id: 4, weekNumber: 1, createdAt: '2026-06-17T12:00:00Z' }),
      ];
      const materialLog = [makeMaterialEntry({ id: 2, weekNumber: 2, createdAt: '2026-06-24T10:00:00Z' })];
      const { container } = renderTable({ lootLog, materialLog });

      expect(rowIds(container)).toEqual(['loot-entry-3', 'material-entry-2', 'loot-entry-4', 'loot-entry-1']);
    });

    it('clicking Player sorts A→Z, again Z→A, and clicking Week (inactive) restores the natural desc', () => {
      const roster = [
        makePlayer({ id: 'p1', name: 'Aria' }),
        makePlayer({ id: 'p2', name: 'Zed' }),
        makePlayer({ id: 'p3', name: 'Mira' }),
      ];
      // createdAt order (desc) is Zed, Aria, Mira — distinct from every name order,
      // so the default and both Player directions are three different sequences.
      const lootLog = [
        makeLootEntry({ id: 1, recipientPlayerId: 'p2', recipientPlayerName: 'Zed', createdAt: '2026-06-24T12:00:00Z' }),
        makeLootEntry({ id: 2, recipientPlayerId: 'p1', recipientPlayerName: 'Aria', createdAt: '2026-06-24T11:00:00Z' }),
        makeLootEntry({ id: 3, recipientPlayerId: 'p3', recipientPlayerName: 'Mira', createdAt: '2026-06-24T10:00:00Z' }),
      ];
      const { container } = renderTable({ lootLog, players: roster });
      expect(rowIds(container)).toEqual(['loot-entry-1', 'loot-entry-2', 'loot-entry-3']);

      fireEvent.click(screen.getByRole('button', { name: 'Player' }));
      expect(rowIds(container)).toEqual(['loot-entry-2', 'loot-entry-3', 'loot-entry-1']);
      expect(header('Player')).toHaveAttribute('aria-sort', 'ascending');
      expect(header('Week')).toHaveAttribute('aria-sort', 'none');

      fireEvent.click(screen.getByRole('button', { name: 'Player' }));
      expect(rowIds(container)).toEqual(['loot-entry-1', 'loot-entry-3', 'loot-entry-2']);
      expect(header('Player')).toHaveAttribute('aria-sort', 'descending');

      fireEvent.click(screen.getByRole('button', { name: 'Week' }));
      expect(rowIds(container)).toEqual(['loot-entry-1', 'loot-entry-2', 'loot-entry-3']);
      expect(header('Week')).toHaveAttribute('aria-sort', 'descending');
      expect(header('Player')).toHaveAttribute('aria-sort', 'none');
    });

    it('keeps ties newest-first under a text sort (Player asc)', () => {
      const roster = [makePlayer({ id: 'p1', name: 'Aria' }), makePlayer({ id: 'p2', name: 'Zed' })];
      // Three Aria rows with three createdAts, plus a NEWER Zed row so the default
      // order (Zed first) differs from Player asc (Aria's three first) — the
      // assertion can't pass on the unsorted default.
      const lootLog = [
        makeLootEntry({ id: 1, recipientPlayerId: 'p1', recipientPlayerName: 'Aria', createdAt: '2026-06-24T10:00:00Z' }),
        makeLootEntry({ id: 2, recipientPlayerId: 'p1', recipientPlayerName: 'Aria', createdAt: '2026-06-24T12:00:00Z' }),
        makeLootEntry({ id: 3, recipientPlayerId: 'p1', recipientPlayerName: 'Aria', createdAt: '2026-06-24T11:00:00Z' }),
        makeLootEntry({ id: 4, recipientPlayerId: 'p2', recipientPlayerName: 'Zed', createdAt: '2026-06-24T13:00:00Z' }),
      ];
      const { container } = renderTable({ lootLog, players: roster });
      expect(rowIds(container)).toEqual(['loot-entry-4', 'loot-entry-2', 'loot-entry-3', 'loot-entry-1']);

      fireEvent.click(screen.getByRole('button', { name: 'Player' }));
      expect(rowIds(container)).toEqual(['loot-entry-2', 'loot-entry-3', 'loot-entry-1', 'loot-entry-4']);
    });
  });

  describe('Floor cell (R-33 / R-45 / D9a-r)', () => {
    it('renders a token-toned floor chip with no inline colour', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, floor: 'M10S' })] });
      const chip = within(cell('loot-entry-1', COL.floor)).getByText('M10S');
      expect(chip).toHaveClass('text-floor-2', 'bg-floor-2/10');
      expect(chip.getAttribute('style')).toBeNull();
    });

    it('falls back to the muted tone for a floor the tier does not know', () => {
      expect(() => renderTable({ lootLog: [makeLootEntry({ id: 1, floor: 'XYZ' })] })).not.toThrow();
      const chip = within(cell('loot-entry-1', COL.floor)).getByText('XYZ');
      expect(chip).toHaveClass('text-text-secondary');
      expect(chip.className).not.toMatch(/text-floor-/);
    });

    it('renders an em dash — and no Tag — for an empty floor', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, floor: '' })] });
      const floorCell = cell('loot-entry-1', COL.floor);
      expect(floorCell.textContent?.trim()).toBe('—');
      expect(floorCell.querySelector('[class*="text-floor-"]')).toBeNull();
      expect(floorCell.querySelector('.bg-surface-elevated')).toBeNull();
    });
  });

  describe('Slot cell (R-39)', () => {
    it('leads a loot row with the aria-hidden slot glyph and the slot display name', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'body' })] });
      const slotCell = cell('loot-entry-1', COL.slot);
      const glyph = slotCell.querySelector('[aria-hidden="true"]');
      expect(glyph).not.toBeNull();
      expect(glyph?.getAttribute('style')).toContain(GEAR_SLOT_ICONS.body);
      expect(slotCell).toHaveTextContent('Body');
    });

    it('leads a material row with the material dot, never the gear-slot art', () => {
      renderTable({ materialLog: [makeMaterialEntry({ id: 5, materialType: 'twine' })] });
      const slotCell = cell('material-entry-5', COL.slot);
      expect(slotCell.querySelector('span.bg-material-twine')).not.toBeNull();
      expect(spansWithGearArt(slotCell)).toHaveLength(0);
      expect(slotCell).toHaveTextContent('Twine');
    });

    it("maps the loot-log 'ring' value to the shared ring art and the generic 'Ring' name", () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'ring' })] });
      const slotCell = cell('loot-entry-1', COL.slot);
      expect(slotCell).toHaveTextContent('Ring');
      expect(slotCell.querySelector('[aria-hidden="true"]')?.getAttribute('style')).toContain(GEAR_SLOT_ICONS.ring1);
    });

    it('renders an unknown slot as raw text with no glyph, without throwing', () => {
      expect(() => renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'not_a_slot' })] })).not.toThrow();
      const slotCell = cell('loot-entry-1', COL.slot);
      expect(slotCell).toHaveTextContent('not_a_slot');
      expect(slotCell.querySelector('[aria-hidden="true"]')).toBeNull();
      expect(spansWithGearArt(slotCell)).toHaveLength(0);
    });
  });

  describe('weapon row (R-38)', () => {
    it("shows the WEAPON's job in Slot and the RECIPIENT's job in Player — never swapped", () => {
      // Recipient is a WHM; the weapon that dropped is a DRG weapon.
      renderTable({
        lootLog: [makeLootEntry({ id: 1, itemSlot: 'weapon', weaponJob: 'DRG' })],
        players: [makePlayer({ id: 'p1', job: 'WHM' })],
      });
      const slotCell = cell('loot-entry-1', COL.slot);
      expect(within(slotCell).getByAltText('DRG')).toBeInTheDocument();
      expect(within(slotCell).queryByAltText('WHM')).not.toBeInTheDocument();

      const playerCell = cell('loot-entry-1', COL.player);
      expect(within(playerCell).getByAltText('WHM')).toBeInTheDocument();
      expect(within(playerCell).queryByAltText('DRG')).not.toBeInTheDocument();
    });

    it('renders no job icon in Slot for a non-weapon row', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'body' })] });
      expect(cell('loot-entry-1', COL.slot).querySelector('img')).toBeNull();
    });

    it('ignores a stale weaponJob on a non-weapon row (the edit API keeps weapon_job when the slot changes)', () => {
      // A weapon entry later edited to Body keeps its old `weaponJob`; the icon
      // is gated on the slot, not on the field's presence.
      renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'body', weaponJob: 'DRG' })] });
      const slotCell = cell('loot-entry-1', COL.slot);
      expect(slotCell.querySelector('img')).toBeNull();
      expect(within(slotCell).queryByAltText('DRG')).not.toBeInTheDocument();
      expect(slotCell).toHaveTextContent('Body');
    });
  });

  describe('Player cell', () => {
    it('renders the resolved roster name with the job icon', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      const playerCell = cell('loot-entry-1', COL.player);
      expect(playerCell).toHaveTextContent('Aria');
      expect(within(playerCell).getByAltText('WHM')).toBeInTheDocument();
    });

    it('falls back to the stored recipient name, with no job icon, when the player is unknown', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, recipientPlayerId: 'ghost', recipientPlayerName: 'Departed Player' })],
        players: [],
      });
      const playerCell = cell('loot-entry-1', COL.player);
      expect(playerCell).toHaveTextContent('Departed Player');
      expect(playerCell.querySelector('img')).toBeNull();
    });
  });

  describe('Method / Date cells', () => {
    it('renders the method label, falling back to the raw method for an unknown one', () => {
      renderTable({
        lootLog: [
          makeLootEntry({ id: 1, method: 'book' }),
          makeLootEntry({ id: 2, method: 'tome' }),
          makeLootEntry({ id: 3, method: 'xyz' as LootLogEntry['method'] }),
        ],
      });
      expect(cell('loot-entry-1', COL.method)).toHaveTextContent('Book');
      expect(cell('loot-entry-2', COL.method)).toHaveTextContent('Tome');
      expect(cell('loot-entry-3', COL.method)).toHaveTextContent('xyz');
    });

    it('renders an absolute date (date half asserted only — the time half is local, D9a-o)', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, createdAt: '2026-06-24T15:45:00Z' })] });
      // Built the same way the component does (Intl, local tz) — a literal
      // 'Jun 24' fails on runners at UTC+8:15 or later, where the local date
      // is already Jun 25.
      const expectedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
        new Date('2026-06-24T15:45:00Z'),
      );
      expect(cell('loot-entry-1', COL.date).textContent?.startsWith(`${expectedDate}, `)).toBe(true);
    });

    it('renders an em dash for an unparseable date instead of throwing (M4)', () => {
      expect(() =>
        renderTable({ lootLog: [makeLootEntry({ id: 1, createdAt: 'not-a-date' })] }),
      ).not.toThrow();
      expect(cell('loot-entry-1', COL.date).textContent?.trim()).toBe('—');
    });
  });

  describe('Type cell (R-34 / R-D9a-A / D9a-t)', () => {
    it('renders BiS for a loot row and Extra when isExtra — the old badge copy is gone', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 }), makeLootEntry({ id: 2, isExtra: true })] });
      expect(cell('loot-entry-1', COL.type)).toHaveTextContent('BiS');
      expect(cell('loot-entry-2', COL.type)).toHaveTextContent('Extra');
      expect(screen.queryByText('BiS need')).toBeNull();
      expect(screen.queryByText('free / sell')).toBeNull();
    });

    it('renders aug body for a material with slotAugmented body', () => {
      renderTable({ materialLog: [makeMaterialEntry({ id: 5, slotAugmented: 'body' })] });
      expect(cell('material-entry-5', COL.type)).toHaveTextContent('aug body');
    });

    it('renders aug tome wpn for slotAugmented null AND tome_weapon (never the raw enum)', () => {
      renderTable({
        materialLog: [
          makeMaterialEntry({ id: 5, slotAugmented: null }),
          makeMaterialEntry({ id: 6, slotAugmented: 'tome_weapon' }),
        ],
      });
      expect(cell('material-entry-5', COL.type)).toHaveTextContent('aug tome wpn');
      expect(cell('material-entry-6', COL.type)).toHaveTextContent('aug tome wpn');
      expect(screen.queryByText(/tome_weapon/)).toBeNull();

      const tag = within(cell('material-entry-5', COL.type)).getByText('aug tome wpn');
      expect(tag.className).toContain('whitespace-nowrap');
    });
  });

  describe('filters + empty', () => {
    it('applies the parsed query prop to narrow rendered rows', () => {
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 2, method: 'drop' }),
        makeLootEntry({ id: 2, weekNumber: 2, method: 'tome' }),
      ];
      renderTable({ lootLog, query: q('source:tome') });
      expect(document.getElementById('loot-entry-2')).toBeInTheDocument();
      expect(document.getElementById('loot-entry-1')).not.toBeInTheDocument();
    });

    it('matches player: and job: through the ROSTER, exactly as the cells render them', () => {
      // The query context must read the SAME `playersById` map the Player cell
      // and the player sort key read: `player:` against the roster name (not
      // the stale snapshot name frozen on the entry) and `job:` against the
      // roster job behind the cell's icon. Wire either to something else and
      // the table would filter on a value the user cannot see.
      const lootLog = [
        makeLootEntry({ id: 1, recipientPlayerId: 'p1', recipientPlayerName: 'Stale Snapshot Name' }),
        makeLootEntry({ id: 2, recipientPlayerId: 'p2', recipientPlayerName: 'Bob' }),
      ];
      const roster = [
        makePlayer({ id: 'p1', name: 'Renamed', job: 'WHM' }),
        makePlayer({ id: 'p2', name: 'Bob', job: 'DRK' }),
      ];

      const renamed = renderTable({ lootLog, players: roster, query: q('player:renamed') });
      expect(document.getElementById('loot-entry-1')).toBeInTheDocument();
      expect(document.getElementById('loot-entry-2')).not.toBeInTheDocument();
      renamed.unmount();

      // The name ON THE ENTRY matches nothing — the ctx never falls back to it
      // while the roster has the player.
      const stale = renderTable({ lootLog, players: roster, query: q('player:"Stale Snapshot Name"') });
      expect(document.querySelectorAll('tbody tr[id]')).toHaveLength(0);
      stale.unmount();

      renderTable({ lootLog, players: roster, query: q('job:drk') });
      expect(document.getElementById('loot-entry-2')).toBeInTheDocument();
      expect(document.getElementById('loot-entry-1')).not.toBeInTheDocument();
    });

    it('distinguishes "nothing logged" from "nothing matches" (R-34)', () => {
      const { container, unmount } = renderTable({ lootLog: [], materialLog: [] });
      const emptyCell = screen.getByText('No loot or materials logged this tier.');
      expect(emptyCell.tagName).toBe('TD');
      expect(emptyCell).toHaveAttribute('colspan', '8');
      expect(container.querySelectorAll('tbody td')).toHaveLength(1);
      expect(screen.getAllByRole('columnheader')).toHaveLength(8);
      expect(screen.queryByText('No entries match your filters.')).not.toBeInTheDocument();
      unmount();

      // Same zero rows on screen, different cause: the tier HAS entries and the
      // filter excludes them. The shipped single message conflated the two.
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        query: q('week:9'),
      });
      expect(screen.getByText('No entries match your filters.')).toBeInTheDocument();
      expect(screen.queryByText('No loot or materials logged this tier.')).not.toBeInTheDocument();
    });

    it('renders no week separator alongside an empty state', () => {
      const { container } = renderTable({ lootLog: [], materialLog: [] });
      // One row total = the empty-state row; there is no week band to draw.
      expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(container.querySelector('tbody tr:not([id]) td')).toHaveAttribute('colspan', '8');
    });

    it('says the load FAILED rather than claiming the tier is empty', () => {
      renderTable({ lootLog: [], materialLog: [], logsFailed: true });
      expect(screen.getByText("Couldn't load this tier's entries.")).toBeInTheDocument();
      // The falsehood this replaces: empty arrays after a failed request are
      // not evidence of an empty tier.
      expect(screen.queryByText('No loot or materials logged this tier.')).not.toBeInTheDocument();
      // And no count is asserted either — "0 entries" would be equally untrue.
      expect(screen.getByRole('status')).toHaveTextContent('');
    });

    it('never claims a load failure while it is HOLDING logs — zero rows is the filter', () => {
      // A stale `logsFailed` must not outrank the evidence in the component's
      // own hands. The tier has an entry; the filter excludes it.
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        query: q('week:9'),
        logsFailed: true,
      });
      expect(screen.getByText('No entries match your filters.')).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load this tier's entries.")).not.toBeInTheDocument();
      // And the count is a real one here — zero IS the honest answer.
      expect(screen.getByRole('status')).toHaveTextContent('0 entries');
    });

    it('prefers "loading" over "failed" while a retry is in flight', () => {
      renderTable({ lootLog: [], materialLog: [], logsLoading: true, logsFailed: true });
      expect(screen.getByText('Loading entries…')).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load this tier's entries.")).not.toBeInTheDocument();
    });

    it('withholds the "nothing logged" claim while the logs are still loading (M1)', () => {
      const { unmount } = renderTable({ lootLog: [], materialLog: [], logsLoading: true });
      expect(screen.getByText('Loading entries…')).toBeInTheDocument();
      // The claim is about the TIER; empty-because-unfetched must not assert it.
      expect(screen.queryByText('No loot or materials logged this tier.')).not.toBeInTheDocument();
      expect(screen.queryByText('No entries match your filters.')).not.toBeInTheDocument();
      unmount();

      // Same empty arrays, load finished — now the claim is earned.
      renderTable({ lootLog: [], materialLog: [], logsLoading: false });
      expect(screen.getByText('No loot or materials logged this tier.')).toBeInTheDocument();
    });

    it('keeps rendering rows while loading — only the empty message is withheld', () => {
      const { container } = renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        logsLoading: true,
      });
      expect(rowIds(container)).toEqual(['loot-entry-1']);
      expect(screen.queryByText('Loading entries…')).not.toBeInTheDocument();
    });

    it('renders material rows with the material-entry id', () => {
      const materialLog = [makeMaterialEntry({ id: 5, weekNumber: 2 })];
      renderTable({ materialLog });
      expect(document.getElementById('material-entry-5')).toBeInTheDocument();
    });
  });

  describe('week separators (R-29 / R-D9b-A / R-D9b-B / R-D9b-E)', () => {
    const threeWeeks = [
      makeLootEntry({ id: 1, weekNumber: 3, createdAt: '2026-07-01T12:00:00Z' }),
      makeLootEntry({ id: 2, weekNumber: 3, createdAt: '2026-07-01T10:00:00Z' }),
      makeLootEntry({ id: 3, weekNumber: 2, createdAt: '2026-06-24T10:00:00Z' }),
      makeLootEntry({ id: 4, weekNumber: 1, createdAt: '2026-06-17T10:00:00Z' }),
    ];

    it('precedes each week group with one separator: pill, UTC range, current marker, count', () => {
      const { container } = renderTable({ lootLog: threeWeeks });

      // currentWeek is 3. The ranges are UTC-pinned: a formatter that lost
      // `timeZone: 'UTC'` reads Jun 29 / Jul 6 in a UTC-negative zone.
      expect(rowSequence(container)).toEqual([
        'sep:WEEK 3 | Jun 30 – Jul 7 · current | 2 entries',
        'loot-entry-1',
        'loot-entry-2',
        'sep:WEEK 2 | Jun 23 – Jun 30 | 1 entry',
        'loot-entry-3',
        'sep:WEEK 1 | Jun 16 – Jun 23 | 1 entry',
        'loot-entry-4',
      ]);
    });

    it('spans the separator across every column, the kebab included', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      const cells = container.querySelectorAll('tbody tr:not([id]) > td');
      expect(cells).toHaveLength(3);
      for (const td of cells) {
        expect(td).toHaveAttribute('colspan', '8');
      }
    });

    it('tints ONLY the current week pill, with the measured accent-hover token', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      const pills = Array.from(container.querySelectorAll('tbody tr:not([id]) span')).filter((sp) =>
        (sp.textContent ?? '').startsWith('WEEK ')
      );
      expect(pills.map((pill) => pill.textContent)).toEqual(['WEEK 3', 'WEEK 2', 'WEEK 1']);
      expect(pills[0]).toHaveClass('bg-accent/15', 'text-accent-hover');
      expect(pills[0]).not.toHaveClass('bg-surface-elevated');
      for (const past of pills.slice(1)) {
        expect(past).toHaveClass('bg-surface-elevated', 'text-text-secondary');
        expect(past).not.toHaveClass('text-accent-hover');
      }
    });

    it('marks the current week in TEXT as well as tint, so the signal is not colour-only', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      const withCurrent = separatorTexts(container).filter((t) => t.includes('· current'));
      expect(withCurrent).toHaveLength(1);
      expect(withCurrent[0]).toContain('WEEK 3');
    });

    it('drops every separator under a non-week sort, and restores them on the way back', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      expect(separatorTexts(container)).toHaveLength(3);

      fireEvent.click(screen.getByRole('button', { name: 'Player' }));
      expect(separatorTexts(container)).toEqual([]);
      expect(rowIds(container)).toHaveLength(4);

      fireEvent.click(screen.getByRole('button', { name: 'Date' }));
      expect(separatorTexts(container)).toEqual([]);

      fireEvent.click(screen.getByRole('button', { name: 'Week' }));
      expect(separatorTexts(container)).toHaveLength(3);
    });

    it('keeps separators under week ASC (R-D9b-E: the axis, not the direction)', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      fireEvent.click(screen.getByRole('button', { name: 'Week' }));

      expect(header('Week')).toHaveAttribute('aria-sort', 'ascending');
      expect(rowSequence(container)).toEqual([
        'sep:WEEK 1 | Jun 16 – Jun 23 | 1 entry',
        'loot-entry-4',
        'sep:WEEK 2 | Jun 23 – Jun 30 | 1 entry',
        'loot-entry-3',
        'sep:WEEK 3 | Jun 30 – Jul 7 · current | 2 entries',
        'loot-entry-1',
        'loot-entry-2',
      ]);
    });

    it('renders no range, and no stray separator dot, when rangeOfWeek returns null', () => {
      const { container } = renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 3 }), makeLootEntry({ id: 2, weekNumber: 2 })],
        rangeOfWeek: () => null,
      });
      expect(separatorTexts(container)).toEqual([
        'WEEK 3 | current | 1 entry',
        'WEEK 2 | 1 entry',
      ]);
    });

    it('counts only the rows the filter left, per week', () => {
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 3, method: 'drop' }),
        makeLootEntry({ id: 2, weekNumber: 3, method: 'tome' }),
        makeLootEntry({ id: 3, weekNumber: 2, method: 'tome' }),
      ];
      const { container } = renderTable({ lootLog, query: q('source:tome') });
      expect(separatorTexts(container)).toEqual([
        'WEEK 3 | Jun 30 – Jul 7 · current | 1 entry',
        'WEEK 2 | Jun 23 – Jun 30 | 1 entry',
      ]);
    });

    it('counts material rows in the separator total (entries, not just drops — R-D9b-A)', () => {
      const { container } = renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        materialLog: [makeMaterialEntry({ id: 9, weekNumber: 2 })],
      });
      expect(separatorTexts(container)).toEqual(['WEEK 2 | Jun 23 – Jun 30 | 2 entries']);
    });
  });

  describe('stats count (R-34 / R-D9b-C)', () => {
    it('counts the filtered set and splits gear vs material when both are present', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 }), makeLootEntry({ id: 2, weekNumber: 3 })],
        materialLog: [makeMaterialEntry({ id: 9, weekNumber: 2 })],
      });
      expect(screen.getByRole('status')).toHaveTextContent('3 entries (2 gear, 1 material)');
    });

    it('omits the split when one kind is absent, and reads it off the FILTERED set', () => {
      const props = {
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 }), makeLootEntry({ id: 2, weekNumber: 3 })],
        materialLog: [makeMaterialEntry({ id: 9, weekNumber: 3 })],
      };
      const { unmount } = renderTable(props);
      expect(screen.getByRole('status')).toHaveTextContent('3 entries (2 gear, 1 material)');
      unmount();

      // Week 2 leaves one loot row and no materials — the split must vanish.
      renderTable({ ...props, query: q('week:2') });
      expect(screen.getByRole('status')).toHaveTextContent('1 entry');
      expect(screen.getByRole('status').textContent).not.toContain('gear');
    });

    it('stays blank rather than claiming "0 entries" while the logs are loading', () => {
      const { unmount } = renderTable({ lootLog: [], materialLog: [], logsLoading: true });
      const status = screen.getByRole('status');
      // Mounted (a live region inserted pre-populated is not reliably
      // announced) but silent — there is no count to report yet.
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent('');
      unmount();

      // A count that IS knowable still renders while loading — only the
      // unknowable one is withheld.
      renderTable({ lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })], logsLoading: true });
      expect(screen.getByRole('status')).toHaveTextContent('1 entry');
    });

    it('reads 0 entries when nothing matches', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        query: q('week:9'),
      });
      expect(screen.getByRole('status')).toHaveTextContent('0 entries');
    });

    it('sits inside the table card above the header row, not in a table cell', () => {
      const { container } = renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      const status = screen.getByRole('status');
      const table = container.querySelector('table')!;
      expect(status.closest('table')).toBeNull();
      expect(status.parentElement).toBe(table.parentElement);
      expect(status.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('kebab', () => {
    it('shows Edit/Copy link/Delete for a loot row when canEdit is true', async () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      openKebab(document.getElementById('loot-entry-1')!);
      expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });

    it('hides Edit for a material row even when canEdit is true (loot rows only)', async () => {
      renderTable({ materialLog: [makeMaterialEntry({ id: 5 })] });
      openKebab(document.getElementById('material-entry-5')!);
      expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });

    it('hides Edit and Delete but keeps Copy link when canEdit is false', async () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })], canEdit: false });
      openKebab(document.getElementById('loot-entry-1')!);
      expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('fires onEdit with the underlying entry when the kebab Edit item is selected', async () => {
      const onEdit = vi.fn();
      const entry = makeLootEntry({ id: 1, weekNumber: 2 });
      renderTable({ lootLog: [entry], onEdit });
      openKebab(document.getElementById('loot-entry-1')!);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
      expect(onEdit).toHaveBeenCalledWith(entry);
    });

    it('fires onCopyLink(item) with the loot ref when Copy link is selected', async () => {
      const onCopyLink = vi.fn();
      const entry = makeLootEntry({ id: 1 });
      renderTable({ lootLog: [entry], onCopyLink });
      openKebab(document.getElementById('loot-entry-1')!);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy link' }));
      expect(onCopyLink).toHaveBeenCalledWith({ kind: 'loot', entry });
    });

    it('fires onDelete(item) with the material ref when Delete is selected', async () => {
      const onDelete = vi.fn();
      const entry = makeMaterialEntry({ id: 5 });
      renderTable({ materialLog: [entry], onDelete });
      openKebab(document.getElementById('material-entry-5')!);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      expect(onDelete).toHaveBeenCalledWith({ kind: 'material', entry });
    });

    // R-D6b precedent (`LogWeekGrid.tsx:519` — `${label} entry actions — ${floorName}`):
    // the name names the ROW, so tabbing the column tells a screen-reader user
    // which entry the focused menu would edit or delete.
    it('names every kebab by its own slot and recipient, never a shared "Entry actions"', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })], materialLog: [makeMaterialEntry({ id: 5 })] });
      expect(
        within(document.getElementById('loot-entry-1')!).getByRole('button', {
          name: 'Body entry actions — Aria',
        }),
      ).toBeInTheDocument();
      expect(
        within(document.getElementById('material-entry-5')!).getByRole('button', {
          name: 'Twine entry actions — Aria',
        }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Entry actions' })).not.toBeInTheDocument();
    });

    it('resolves the kebab name through the roster, exactly as the Player cell does', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, itemSlot: 'earring', recipientPlayerName: 'Stale Snapshot Name' })],
        players: [makePlayer({ name: 'Renamed' })],
      });
      expect(
        within(document.getElementById('loot-entry-1')!).getByRole('button', {
          name: 'Ears entry actions — Renamed',
        }),
      ).toBeInTheDocument();
    });
  });

  describe('inert row (D9a-i)', () => {
    it('the row carries no tabindex, no cursor-pointer and no aria-label', () => {
      const { container } = renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      const tr = container.querySelector('tbody tr')!;
      expect(tr).not.toHaveAttribute('tabindex');
      expect(tr).not.toHaveAttribute('aria-label');
      expect(tr).not.toHaveClass('cursor-pointer');
    });
  });

  describe('deep-link highlight', () => {
    beforeEach(() => {
      // jsdom doesn't implement scrollIntoView.
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('marks the row matching ?entry= as highlight-pulse and clears the param after 2.5s', () => {
      const lootLog = [makeLootEntry({ id: 1, weekNumber: 2 })];
      renderTable({ lootLog }, ['/?entry=1']);

      const row = document.getElementById('loot-entry-1')!;
      expect(row).toHaveClass('highlight-pulse');

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(row).not.toHaveClass('highlight-pulse');
    });

    it('honors entryType=material for the deep link', () => {
      const materialLog = [makeMaterialEntry({ id: 5, weekNumber: 2 })];
      renderTable({ materialLog }, ['/?entry=5&entryType=material']);

      const row = document.getElementById('material-entry-5')!;
      expect(row).toHaveClass('highlight-pulse');
    });

    it('does not highlight when the entry id is not present in the unfiltered log', () => {
      const lootLog = [makeLootEntry({ id: 1, weekNumber: 2 })];
      renderTable({ lootLog }, ['/?entry=999']);
      expect(document.getElementById('loot-entry-1')).not.toHaveClass('highlight-pulse');
    });

    /**
     * The D9b obligation named in the plan row. `RosterCard.tsx:281-297`'s C7
     * jump lands here with whatever History filter the user last left behind,
     * so "found" must be decided against the RAW logs, not the rendered rows.
     * If it were decided against the filtered set, a jump to a filtered-out
     * entry would leave `?entry=` stuck in the URL forever — and the next
     * filter change would suddenly pulse a row nobody asked for.
     */
    it('resolves ?entry= against the UNFILTERED logs, so a filtered-out entry still self-clears', () => {
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 3 }),
        makeLootEntry({ id: 7, weekNumber: 2 }),
      ];
      // Week 3 only: entry 7 exists in the tier but is not on screen.
      renderTable({ lootLog, query: q('week:3') }, ['/?entry=7']);
      expect(document.getElementById('loot-entry-7')).not.toBeInTheDocument();
      expect(search()).toContain('entry=7');

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      // The param is GONE: the effect ran, which it only does when the id
      // resolved. Resolve against `rows` instead and this assertion fails,
      // because the effect would never have armed.
      expect(search()).not.toContain('entry=7');
      expect(document.getElementById('loot-entry-1')).not.toHaveClass('highlight-pulse');
    });

    /**
     * T-9 (D10), the third case the D10 row adds to the pair above. The pin
     * proves the id RESOLVES while a filter hides the row; this proves what the
     * user then sees, and pins the resolution to the RAW logs a second way —
     * through the clear timer's ORIGIN. Widen the query inside the 2.5 s window
     * and the row appears ALREADY PULSING, then self-clears on the schedule the
     * FIRST render started.
     *
     * Derive `entryFound` from `rows` instead and the first assertion still
     * passes (the row is visible once the query clears, so the effect arms
     * then) — but the timer would have started 500 ms late, so the param is
     * still in the URL at t=2500 and the last two assertions fail. That late
     * re-arm is exactly the bug: a pulse fired at whatever moment the user
     * happened to change the filter.
     */
    it('an ?entry= the active query filters out is still found — pulses when the query widens, on the ORIGINAL clock', () => {
      const props = tableProps({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 3 }), makeLootEntry({ id: 7, weekNumber: 2 })],
      });
      const tree = (query: ReturnType<typeof q>) => (
        <MemoryRouter initialEntries={['/?entry=7']}>
          <LootHistoryTable {...props} query={query} />
          <LocationProbe />
        </MemoryRouter>
      );
      const { rerender } = render(tree(q('week:3')));
      expect(document.getElementById('loot-entry-7')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(500);
      });
      rerender(tree(q('')));

      expect(document.getElementById('loot-entry-7')).toHaveClass('highlight-pulse');
      expect(document.getElementById('loot-entry-1')).not.toHaveClass('highlight-pulse');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(search()).not.toContain('entry=7');
      expect(document.getElementById('loot-entry-7')).not.toHaveClass('highlight-pulse');
    });

    it('never arms the effect for an id absent from the raw logs (the control for the above)', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, weekNumber: 3 })] }, ['/?entry=404']);
      expect(search()).toContain('entry=404');

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      // Still there — nothing resolved, so nothing cleaned up. This is what
      // separates "found but filtered out" from "not found at all".
      expect(search()).toContain('entry=404');
    });

    it('still pulses the right row with week separators rendered between the rows', () => {
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 3 }),
        makeLootEntry({ id: 7, weekNumber: 2 }),
        makeLootEntry({ id: 8, weekNumber: 1 }),
      ];
      const { container } = renderTable({ lootLog }, ['/?entry=7']);

      expect(separatorTexts(container)).toHaveLength(3);
      expect(document.getElementById('loot-entry-7')).toHaveClass('highlight-pulse');
      expect(document.getElementById('loot-entry-1')).not.toHaveClass('highlight-pulse');
      // The separator rows are inert decoration — never a pulse target.
      for (const sep of container.querySelectorAll('tbody tr:not([id])')) {
        expect(sep).not.toHaveClass('highlight-pulse');
      }
    });

    it('scrolls the element whose id historyRowDomId returns (one author for effect + row)', () => {
      const scrolled: Element[] = [];
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: function (this: Element) {
          scrolled.push(this);
        },
      });
      const entry = makeLootEntry({ id: 42, weekNumber: 2 });
      renderTable({ lootLog: [entry] }, ['/?entry=42']);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const expectedId = historyRowDomId({ kind: 'loot', id: entry.id });
      expect(scrolled.map((el) => el.id)).toEqual([expectedId]);
      expect(document.getElementById(expectedId)).toHaveClass('highlight-pulse');
    });
  });

  describe('F-4 aria-hidden hazard sweep', () => {
    it('every aria-hidden lead-in in a Slot cell sits inside the inline-flex wrapper', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, itemSlot: 'body' })],
        materialLog: [makeMaterialEntry({ id: 5, materialType: 'glaze' })],
      });
      const leadIns = [
        ...Array.from(cell('loot-entry-1', COL.slot).querySelectorAll('[aria-hidden="true"]')),
        ...Array.from(cell('material-entry-5', COL.slot).querySelectorAll('[aria-hidden="true"]')),
      ];
      expect(leadIns.length).toBeGreaterThan(0);
      leadIns.forEach((el) => {
        expect(el.parentElement?.className).toContain('inline-flex');
      });
    });

    it('every aria-hidden element that is itself a flex/grid container carries role="presentation"', () => {
      const { container } = renderTable({
        lootLog: [makeLootEntry({ id: 1, itemSlot: 'weapon', weaponJob: 'DRG' })],
        materialLog: [makeMaterialEntry({ id: 5, materialType: 'solvent', slotAugmented: 'legs' })],
      });
      const ariaHiddenEls = container.querySelectorAll('[aria-hidden="true"]');
      ariaHiddenEls.forEach((el) => {
        const isFlexOrGrid = /\b(flex|inline-flex|grid|inline-grid)\b/.test(el.className);
        if (isFlexOrGrid) {
          expect(el.getAttribute('role')).toBe('presentation');
        }
      });
    });
  });
});
