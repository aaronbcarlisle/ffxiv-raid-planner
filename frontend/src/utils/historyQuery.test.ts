import { describe, it, expect } from 'vitest';
import {
  parseHistoryQuery,
  filterHistoryItemsByQuery,
  hasQueryToken,
  toggleQueryToken,
  removeQueryKey,
  type HistoryQueryContext,
} from './historyQuery';
import type { HistoryItem } from '../components/loot/logWeekGridData';
import type { LootLogEntry, MaterialLogEntry } from '../types';

function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'M9S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'M9S',
    materialType: 'twine',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    createdAt: '2026-06-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

function loot(overrides: Partial<LootLogEntry> = {}): HistoryItem {
  return { kind: 'loot', entry: makeLootEntry(overrides) };
}

function mat(overrides: Partial<MaterialLogEntry> = {}): HistoryItem {
  return { kind: 'material', entry: makeMaterialEntry(overrides) };
}

// Roster: two same-prefixed names for the T-11 exactness case.
const NAMES: Record<string, string> = { p1: 'Tank One', p2: 'Healer Two', p3: 'Tank One Alt' };
const JOBS: Record<string, string> = { p1: 'PLD', p2: 'WHM', p3: 'WAR' };
const ctx: HistoryQueryContext = {
  playerNameOf: (i) => NAMES[i.entry.recipientPlayerId] ?? i.entry.recipientPlayerName,
  playerJobOf: (i) => JOBS[i.entry.recipientPlayerId] ?? '',
};

function names(items: HistoryItem[]): string[] {
  return items.map((i) => ctx.playerNameOf(i));
}

function filter(query: string, items: HistoryItem[]): HistoryItem[] {
  return filterHistoryItemsByQuery(items, parseHistoryQuery(query), ctx);
}

describe('T-1 tokenizer / quoting', () => {
  it('a quoted two-word player value is one token and matches the whole name', () => {
    const items = [
      loot({ id: 1, recipientPlayerId: 'p1' }), // Tank One
      loot({ id: 2, recipientPlayerId: 'p2' }), // Healer Two
    ];
    const result = filter('player:"Tank One"', items);
    expect(result.map((i) => i.entry.id)).toEqual([1]);
  });

  it('a bare two-word value degrades to v1 behaviour: player:tank + free term one', () => {
    const items = [
      loot({ id: 1, recipientPlayerId: 'p1' }), // "Tank One" — matches player:tank AND free 'one'
      loot({ id: 2, recipientPlayerId: 'p3' }), // "Tank One Alt" — also matches both
      loot({ id: 3, recipientPlayerId: 'p2' }), // "Healer Two" — matches neither
    ];
    const result = filter('player:Tank One', items);
    expect(result.map((i) => i.entry.id).sort()).toEqual([1, 2]);
  });

  it('an unterminated quote groups to end-of-string but stays LENIENT (R-15 + R-D10-Q)', () => {
    // p1 = "Tank One", p3 = "Tank One Alt", p2 = "Healer Two".
    const items = [
      loot({ id: 1, recipientPlayerId: 'p1' }),
      loot({ id: 2, recipientPlayerId: 'p3' }),
      loot({ id: 3, recipientPlayerId: 'p2' }),
    ];

    // Grouping (R-15): the quote never closes, so this is ONE token — the
    // space does not split it. If it had split, `One` would survive as a free
    // term and Healer Two would still be excluded, so grouping alone is not
    // what this asserts; the discriminator is that p3 is INCLUDED.
    const open = filter('player:"Tank One', items);
    expect(open.map((i) => i.entry.id)).toEqual([1, 2]);

    // Leniency (R-D10-Q): a malformed quote does NOT buy exact-match
    // semantics, because the user is mid-typing. Close the quote and the
    // same query narrows to the one exact name — that contrast is the point.
    const closed = filter('player:"Tank One"', items);
    expect(closed.map((i) => i.entry.id)).toEqual([1]);
  });

  it('a leading unterminated quote is a free term, not a filter (R-15)', () => {
    const items = [
      loot({ id: 1, recipientPlayerId: 'p1' }), // name doesn't contain "player:alice"
    ];
    const parsed = parseHistoryQuery('"player:alice');
    expect(parsed.filters).toEqual([]);
    expect(parsed.terms).toEqual(['player:alice']);
    expect(filterHistoryItemsByQuery(items, parsed, ctx)).toEqual([]);
  });
});

describe('T-2 alternation vs repeated keys (R-36)', () => {
  it('floor:m9s,m10s ORs within one token', () => {
    const items = [
      loot({ id: 1, floor: 'M9S' }),
      loot({ id: 2, floor: 'M10S' }),
      loot({ id: 3, floor: 'M11S' }),
    ];
    const result = filter('floor:m9s,m10s', items);
    expect(result.map((i) => i.entry.id).sort()).toEqual([1, 2]);
  });

  it('floor:m9s floor:m10s ANDs across two tokens of the same key — matches nothing', () => {
    const items = [loot({ id: 1, floor: 'M9S' }), loot({ id: 2, floor: 'M10S' })];
    const result = filter('floor:m9s floor:m10s', items);
    expect(result).toEqual([]);
  });
});

describe('T-3 quoted alternation', () => {
  it('player:"Tank One","Healer Two" returns both players rows', () => {
    const items = [
      loot({ id: 1, recipientPlayerId: 'p1' }),
      loot({ id: 2, recipientPlayerId: 'p2' }),
      loot({ id: 3, recipientPlayerId: 'p3' }),
    ];
    const result = filter('player:"Tank One","Healer Two"', items);
    expect(result.map((i) => i.entry.id).sort()).toEqual([1, 2]);
  });
});

describe('T-4 type aliases (R-47)', () => {
  const items = [
    loot({ id: 1, isExtra: false }),
    loot({ id: 2, isExtra: true }),
    mat({ id: 3 }),
  ];

  it('type:gear === type:loot -> loot rows only', () => {
    expect(filter('type:gear', items).map((i) => i.entry.id).sort()).toEqual([1, 2]);
    expect(filter('type:loot', items).map((i) => i.entry.id).sort()).toEqual([1, 2]);
  });

  it('type:materials === type:material -> material rows only', () => {
    expect(filter('type:materials', items).map((i) => i.entry.id)).toEqual([3]);
    expect(filter('type:material', items).map((i) => i.entry.id)).toEqual([3]);
  });

  it('extra / bis survive as aliases', () => {
    expect(filter('type:extra', items).map((i) => i.entry.id)).toEqual([2]);
    expect(filter('type:bis', items).map((i) => i.entry.id)).toEqual([1]);
  });

  it('control: the defect being fixed — v1 raw substring would fail type:gear', () => {
    // 'loot'.includes('gear') is false, which is why v1's structured filter
    // silently returns nothing for `type:gear` (AllWeeksView.tsx:234). The
    // alias table exists precisely so this slice does not reproduce that.
    expect(filter('type:gear', items).length).toBeGreaterThan(0);
  });
});

describe('T-5 source: (R-36, R-9) — carried over from historyItems.test.ts as a move', () => {
  const raidDrop = makeLootEntry({ id: 1, method: 'drop', recipientPlayerId: 'p1' });
  const tomeDrop = makeLootEntry({ id: 2, method: 'tome', recipientPlayerId: 'p2' });
  const purchaseDrop = makeLootEntry({ id: 3, method: 'purchase', recipientPlayerId: 'p1' });
  const bookDrop = makeLootEntry({ id: 4, method: 'book', recipientPlayerId: 'p2' });
  const material = makeMaterialEntry({ id: 5, recipientPlayerId: 'p1' });
  const items: HistoryItem[] = [
    { kind: 'loot', entry: raidDrop },
    { kind: 'loot', entry: tomeDrop },
    { kind: 'loot', entry: purchaseDrop },
    { kind: 'loot', entry: bookDrop },
    { kind: 'material', entry: material },
  ];

  it('source=all passes everything through', () => {
    expect(filter('source:all', items)).toHaveLength(items.length);
  });

  it('source=raid picks only method=drop loot', () => {
    const result = filter('source:raid', items);
    expect(result.map((i) => i.entry.id)).toEqual([1]);
  });

  it('source=tome picks method=tome and method=purchase loot', () => {
    const result = filter('source:tome', items);
    expect(result.map((i) => i.entry.id).sort((a, b) => a - b)).toEqual([2, 3]);
  });

  it('source=book picks only method=book loot', () => {
    const result = filter('source:book', items);
    expect(result.map((i) => i.entry.id)).toEqual([4]);
  });

  it('source=material picks only material items', () => {
    const result = filter('source:material', items);
    expect(result.map((i) => i.kind)).toEqual(['material']);
  });

  it('an unrecognised source value matches nothing and is reported in unknownValues (R-D10-K)', () => {
    const parsed = parseHistoryQuery('source:tomes');
    expect(filterHistoryItemsByQuery(items, parsed, ctx)).toEqual([]);
    expect(parsed.unknownValues).toEqual([{ key: 'source', value: 'tomes' }]);
  });
});

describe('T-6 neutral colon + unknown key (R-30, R-D10-G)', () => {
  const items = [loot({ id: 1 }), loot({ id: 2 }), mat({ id: 3 })];

  it('a trailing colon on a known key is neutral — every row returns, no unknown key reported', () => {
    const parsed = parseHistoryQuery('player:');
    expect(parsed.unknownKeys).toEqual([]);
    expect(parsed.filters).toEqual([]);
    expect(filterHistoryItemsByQuery(items, parsed, ctx)).toHaveLength(items.length);
  });

  it('an unknown key with a value never narrows the set, and is reported', () => {
    const parsed = parseHistoryQuery('colour:blue');
    expect(parsed.unknownKeys).toEqual(['colour']);
    expect(filterHistoryItemsByQuery(items, parsed, ctx)).toHaveLength(items.length);
  });

  it('an unknown key with no value is reported the same way (R-D10-G)', () => {
    const parsed = parseHistoryQuery('colour:');
    expect(parsed.unknownKeys).toEqual(['colour']);
    expect(filterHistoryItemsByQuery(items, parsed, ctx)).toHaveLength(items.length);
  });

  it('an unknown key never narrows even alongside a real filter', () => {
    const parsed = parseHistoryQuery('colour:blue type:materials');
    expect(parsed.unknownKeys).toEqual(['colour']);
    expect(filterHistoryItemsByQuery(items, parsed, ctx).map((i) => i.entry.id)).toEqual([3]);
  });
});

describe('T-7 token writers', () => {
  it('hasQueryToken is exact — a substring-matching query does not light an unrelated pill', () => {
    expect(hasQueryToken('player:ali', 'player', 'Tank One', true)).toBe(false);
    expect(hasQueryToken('player:ali', 'player', 'ali', false)).toBe(true);
  });

  it('hasQueryToken compares the quoting form too (R-D10-L)', () => {
    const q = 'player:"Tank One"';
    expect(hasQueryToken(q, 'player', 'Tank One', true)).toBe(true);
    expect(hasQueryToken(q, 'player', 'Tank One', false)).toBe(false);
  });

  it('toggle adds a new token when none exists', () => {
    expect(toggleQueryToken('', 'floor', 'm9s', false)).toBe('floor:m9s');
  });

  it('toggle again removes it, emptying the token entirely', () => {
    const withToken = toggleQueryToken('', 'floor', 'm9s', false);
    expect(toggleQueryToken(withToken, 'floor', 'm9s', false)).toBe('');
  });

  it('a second value joins the existing token\'s comma list rather than adding a new token', () => {
    const q = toggleQueryToken('', 'floor', 'm9s', false);
    expect(toggleQueryToken(q, 'floor', 'm10s', false)).toBe('floor:m9s,m10s');
  });

  it('removing one of two comma values leaves the other, not an empty token', () => {
    const q = 'floor:m9s,m10s';
    expect(toggleQueryToken(q, 'floor', 'm9s', false)).toBe('floor:m10s');
  });

  it('whitespace between untouched tokens normalises to single spaces', () => {
    const q = 'floor:m9s    type:gear';
    expect(toggleQueryToken(q, 'player', 'Tank One', true)).toBe(
      'floor:m9s type:gear player:"Tank One"',
    );
  });

  it('a player value always comes back quoted regardless of the quoted flag on removal lookups', () => {
    expect(toggleQueryToken('', 'player', 'Tank One', true)).toBe('player:"Tank One"');
  });

  it('removeQueryKey strips every token of that key and leaves the rest untouched', () => {
    expect(removeQueryKey('floor:m9s,m10s type:gear', 'floor')).toBe('type:gear');
    expect(removeQueryKey('type:gear', 'floor')).toBe('type:gear');
  });
});

describe('T-11 player exactness (R-D10-J)', () => {
  const items = [
    loot({ id: 1, recipientPlayerId: 'p1' }), // Tank One
    loot({ id: 2, recipientPlayerId: 'p3' }), // Tank One Alt
  ];

  it('a quoted value matches only the exact name', () => {
    expect(filter('player:"Tank One"', items).map((i) => i.entry.id)).toEqual([1]);
  });

  it('a bare value matches both via substring', () => {
    expect(filter('player:tank', items).map((i) => i.entry.id).sort()).toEqual([1, 2]);
  });
});

describe('additional per-key coverage', () => {
  it('method: filters by the raw method value', () => {
    const items = [loot({ id: 1, method: 'drop' }), loot({ id: 2, method: 'tome' })];
    expect(filter('method:drop', items).map((i) => i.entry.id)).toEqual([1]);
    // NOTE: this does NOT — and cannot — demonstrate R-D10-M's "raw only, no
    // label clause". Every METHOD_INFO label is the capitalised raw value
    // (`lootMethodDisplay.ts:10-13`), so under case-insensitive substring the
    // two are indistinguishable by any input. That is precisely why the label
    // clause was dropped as dead code rather than kept and tested.
  });

  it('slot also matches a material\'s slotAugmented (R-D10-N)', () => {
    const items = [
      mat({ id: 1, materialType: 'twine', slotAugmented: 'legs' }),
      mat({ id: 2, materialType: 'glaze', slotAugmented: 'head' }),
    ];
    expect(filter('slot:legs', items).map((i) => i.entry.id)).toEqual([1]);
  });

  it('week: matches numeric week and reports a non-numeric value as unknown', () => {
    const items = [loot({ id: 1, weekNumber: 3 }), loot({ id: 2, weekNumber: 4 })];
    expect(filter('week:3', items).map((i) => i.entry.id)).toEqual([1]);
    const parsed = parseHistoryQuery('week:three');
    expect(parsed.unknownValues).toEqual([{ key: 'week', value: 'three' }]);
    expect(filterHistoryItemsByQuery(items, parsed, ctx)).toEqual([]);
  });

  it('week: takes a WHOLE number — 3abc is unknown, not a silent week 3 (R-D10-R)', () => {
    // parseInt('3abc', 10) is 3, so a laxer check would filter to week 3
    // while reporting nothing — the user asked for something the parser
    // could not honour and would never be told.
    const items = [loot({ id: 1, weekNumber: 3 }), loot({ id: 2, weekNumber: 4 })];
    const parsed = parseHistoryQuery('week:3abc');
    expect(parsed.unknownValues).toEqual([{ key: 'week', value: '3abc' }]);
    expect(filterHistoryItemsByQuery(items, parsed, ctx)).toEqual([]);
  });

  it('free-text week shorthand (w3 / week3 / week 3) matches like v1', () => {
    const items = [loot({ id: 1, weekNumber: 3 }), loot({ id: 2, weekNumber: 4 })];
    expect(filter('w3', items).map((i) => i.entry.id)).toEqual([1]);
    expect(filter('week3', items).map((i) => i.entry.id)).toEqual([1]);
    expect(filter('week 3', items).map((i) => i.entry.id)).toEqual([1]);
  });

  it('job: matches by substring', () => {
    const items = [loot({ id: 1, recipientPlayerId: 'p1' }), loot({ id: 2, recipientPlayerId: 'p2' })];
    expect(filter('job:pld', items).map((i) => i.entry.id)).toEqual([1]);
  });

  it('free terms narrow AND-wise with structured filters', () => {
    const items = [
      loot({ id: 1, recipientPlayerId: 'p1', floor: 'M9S' }),
      loot({ id: 2, recipientPlayerId: 'p2', floor: 'M9S' }),
    ];
    expect(names(filter('floor:m9s healer', items))).toEqual(['Healer Two']);
  });
});

describe('R-D10-D · toggle and light agree across repeated keys', () => {
  it('a value carried by a LATER token of the same key can still be toggled off', () => {
    // A hand-typed repeated key ANDs to empty (T-2) but is legal input.
    // `hasQueryToken` lights the pill off the second token, so a click must
    // clear it there too — editing only the first token would light a pill
    // that can never be switched off.
    const q = 'floor:m9s floor:m10s';
    expect(hasQueryToken(q, 'floor', 'm10s', false)).toBe(true);
    const off = toggleQueryToken(q, 'floor', 'm10s', false);
    expect(off).toBe('floor:m9s');
    expect(hasQueryToken(off, 'floor', 'm10s', false)).toBe(false);
  });

  it('a value in EVERY token of that key is cleared from all of them', () => {
    const q = 'floor:m9s,m10s player:tank floor:m10s';
    expect(toggleQueryToken(q, 'floor', 'm10s', false)).toBe('floor:m9s player:tank');
  });

  it('adding still targets the first token of that key, leaving others alone', () => {
    const q = 'floor:m9s player:tank floor:m11s';
    expect(toggleQueryToken(q, 'floor', 'm10s', false)).toBe('floor:m9s,m10s player:tank floor:m11s');
  });
});

describe('review fixes — S1 / S3 / S4 / N8', () => {
  it('S1: a pill click after an UNTERMINATED quote lands as its own token', () => {
    // `player:"Tank` is the exact mid-typing state R-D10-Q exists for. Emitting
    // it verbatim lets its open quote swallow whatever is appended, producing
    // ONE token whose bare value is `Tank floor:m9s` — pill unlit, table empty,
    // and NEITHER hint line fires (the key is known, the value merely unmatched).
    // The open token STAYS last and keeps its own spelling; the new token is
    // inserted before it, so there is nothing after the quote to swallow.
    const next = toggleQueryToken('player:"Tank', 'floor', 'm9s', false);
    expect(next).toBe('floor:m9s player:"Tank');

    // The pill must now light, which is the user-visible half of the bug.
    expect(hasQueryToken(next, 'floor', 'm9s', false)).toBe(true);

    const parsed = parseHistoryQuery(next);
    expect(parsed.filters.map((f) => f.key).sort()).toEqual(['floor', 'player']);
    // …and normalising did not silently change what `player:` means: R-D10-Q
    // says an unterminated quote was lenient, and `player:Tank` still is.
    expect(parsed.unknownKeys).toEqual([]);
  });

  it('S1: an unterminated FREE term keeps its meaning after a pill click', () => {
    // Rewriting it at all risks promoting a free term into a `player:` filter;
    // moving the appended token in front of it avoids touching it.
    const next = toggleQueryToken('"player:alice', 'floor', 'm9s', false);
    expect(next).toBe('floor:m9s "player:alice');
    const parsed = parseHistoryQuery(next);
    expect(parsed.terms).toEqual(['player:alice']);
    expect(parsed.filters.map((f) => f.key)).toEqual(['floor']);
  });

  it('S3: a stale weaponJob on a non-weapon row is NOT searchable', () => {
    // The edit API keeps `weapon_job` when a slot moves away from weapon, so a
    // Body row can carry a stale job. The Slot cell hides it; the matcher must
    // agree, or `slot:pld` surfaces a row displaying no PLD anywhere.
    // Both rows go to p2 (WHM), NOT p1 (PLD) — otherwise the free-term half
    // passes through `job:` and proves nothing about weaponJob.
    const stale = loot({ id: 1, itemSlot: 'body', weaponJob: 'PLD', recipientPlayerId: 'p2' });
    const real = loot({ id: 2, itemSlot: 'weapon', weaponJob: 'PLD', recipientPlayerId: 'p2' });
    expect(filter('slot:pld', [stale, real]).map((i) => i.entry.id)).toEqual([2]);
    expect(filter('pld', [stale, real]).map((i) => i.entry.id)).toEqual([2]);
  });

  it('S4: free text reaches the aug {slot} readout, not just slot:', () => {
    // "legs" is what someone types to find which twine went into legs.
    const twine = mat({ id: 1, materialType: 'twine', slotAugmented: 'legs' });
    const other = mat({ id: 2, materialType: 'glaze', slotAugmented: 'head' });
    expect(filter('legs', [twine, other]).map((i) => i.entry.id)).toEqual([1]);
    expect(filter('slot:legs', [twine, other]).map((i) => i.entry.id)).toEqual([1]);
  });

  it('N8: an empty query returns everything — the R-37 first-mount invariant', () => {
    const items = [loot({ id: 1 }), mat({ id: 2 }), loot({ id: 3, weekNumber: 9 })];
    expect(filter('', items)).toHaveLength(3);
    expect(filter('   ', items)).toHaveLength(3);
  });

  it('N8: tokens of DIFFERENT keys AND together', () => {
    const hit = loot({ id: 1, weekNumber: 2, method: 'tome', recipientPlayerId: 'p1' });
    const wrongWeek = loot({ id: 2, weekNumber: 3, method: 'tome', recipientPlayerId: 'p1' });
    const wrongSource = loot({ id: 3, weekNumber: 2, method: 'drop', recipientPlayerId: 'p1' });
    const wrongPlayer = loot({ id: 4, weekNumber: 2, method: 'tome', recipientPlayerId: 'p2' });
    const q = 'week:2 source:tome player:"Tank One"';
    expect(filter(q, [hit, wrongWeek, wrongSource, wrongPlayer]).map((i) => i.entry.id)).toEqual([1]);
  });
});

describe('review round 1 — the unterminated MULTIWORD case (Copilot)', () => {
  it('a pill click after player:"Tank One does not split the name', () => {
    // The first S1 fix rewrote the open token as bare `player:Tank One`, which
    // re-tokenizes as `player:Tank` + a free `One` — a different filter. This
    // is the defect-behind-the-defect: patching the SYMPTOM (rewrite the token)
    // instead of the CAUSE (never append after an open quote).
    const next = toggleQueryToken('player:"Tank One', 'floor', 'm9s', false);
    expect(next).toBe('floor:m9s player:"Tank One');

    const parsed = parseHistoryQuery(next);
    expect(parsed.terms).toEqual([]); // no stray `One`
    const player = parsed.filters.find((f) => f.key === 'player');
    expect(player?.values.map((v) => v.text)).toEqual(['Tank One']);
    // Still LENIENT (R-D10-Q) — an unterminated quote never bought exactness.
    expect(player?.values[0].quoted).toBe(false);
    expect(hasQueryToken(next, 'floor', 'm9s', false)).toBe(true);
  });

  it('serializeToken never emits a bare value containing whitespace', () => {
    // The round-trip invariant behind the fix: editing the open token itself
    // must not produce `player:Tank One,"Healer Two"`, which re-parses wrong.
    const next = toggleQueryToken('player:"Tank One', 'player', 'Healer Two', true);
    expect(next).toBe('player:"Tank One","Healer Two"');
    const values = parseHistoryQuery(next).filters[0].values.map((v) => v.text);
    expect(values).toEqual(['Tank One', 'Healer Two']);
  });
});

describe('review round 4 — the "week 3" shorthand (Copilot, Medium)', () => {
  it('week 3 filters by week, not by "contains a 3"', () => {
    // The tokenizer splits unquoted whitespace, so `week 3` arrives as TWO
    // terms. Matched independently: `week` hits every row (the matcher tests
    // `week ${n}`.includes(term)) and `3` hits anything containing a 3 — so a
    // WEEK 4 row on floor M3S came back for a query that said week 3.
    const wanted = loot({ id: 1, weekNumber: 3, floor: 'M9S' });
    const decoy = loot({ id: 2, weekNumber: 4, floor: 'M3S' });
    expect(filter('week 3', [wanted, decoy]).map((i) => i.entry.id)).toEqual([1]);
  });

  it('the single-token forms are unchanged, and a lone "week" still is not a filter', () => {
    const w3 = loot({ id: 1, weekNumber: 3 });
    const w4 = loot({ id: 2, weekNumber: 4 });
    expect(filter('w3', [w3, w4]).map((i) => i.entry.id)).toEqual([1]);
    expect(filter('week3', [w3, w4]).map((i) => i.entry.id)).toEqual([1]);
    // Control: only an ADJACENT week+number pair is joined. A bare `week`
    // keeps its v1 behaviour rather than becoming a week filter for nothing.
    expect(filter('week', [w3, w4])).toHaveLength(2);
  });

  it('two adjacent ordinary terms are NOT joined — they still AND', () => {
    // Discriminator for the join CONDITION, not just the join itself:
    // widening it to "any adjacent pair" swallows the second term, and every
    // other test in this file still passes. (Found by a mutation that killed
    // zero — the mutation was fine; the control was missing.)
    const hit = loot({ id: 1, recipientPlayerId: 'p1', method: 'book' }); // Tank One + book
    const wrongMethod = loot({ id: 2, recipientPlayerId: 'p1', method: 'drop' });
    const wrongPlayer = loot({ id: 3, recipientPlayerId: 'p2', method: 'book' });
    expect(filter('tank book', [hit, wrongMethod, wrongPlayer]).map((i) => i.entry.id)).toEqual([1]);
  });
});
