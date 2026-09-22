/**
 * historyQuery — the v2 History tab's search-string tokenizer, parser and
 * matcher, plus the pill token writers that keep the Type/Floor/Player rows
 * in sync with the same query string (Phase D, D10, spec §6/R-30/R-36/R-37/
 * R-47).
 *
 * Pure, storeless, hookless — no React import. Modelled on
 * `components/history/AllWeeksView.tsx:214-268` (v1's inline parser);
 * **never imports it** (R-43 — that file is frozen V1).
 *
 * Source-filter semantics (moved from `historyItems.ts`, deliberate):
 * `raid` = loot with `method === 'drop'`; `tome` = loot with
 * `method === 'tome' || method === 'purchase'`; `book` = loot with
 * `method === 'book'`, filtered separately from raid even though books buy
 * raid gear; `material` = material log items; `all` = everything. Any other
 * value matches nothing and is reported in `unknownValues` (R-D10-K).
 *
 * There is exactly ONE tokenizer (`tokenize`) — it backs `parseHistoryQuery`
 * *and* all three pill token writers below. Two tokenizers would be two
 * authors for the same syntax, which is the defect this slice removes
 * `HistoryFilters` to avoid in the first place (R-4).
 */
import type { HistoryItem } from '../components/loot/logWeekGridData';
import { slotNameOf } from './historyItems';

// ---------------------------------------------------------------------------
// Tokenizer — shared by the parser and the pill token writers.
// ---------------------------------------------------------------------------

/** One value inside a `key:value,value` token's comma list. Not exported. */
interface RawValue {
  text: string;
  quoted: boolean;
}

/** One whitespace-delimited token of the raw query string. Not exported. */
interface RawToken {
  /** The token's own source text, so a writer can pass it through untouched. */
  text: string;
  /** Lower-cased key, or null for a free term. */
  key: string | null;
  values: RawValue[];
  /** True when the token carries an unclosed quote — see `appendToken`. */
  unterminated: boolean;
}

/**
 * R-D10-R: `week:` takes a WHOLE number or nothing. `parseInt` alone accepts
 * `3abc` as 3, which would silently filter to week 3 while the user believes
 * they asked for something else — and, worse, would never reach
 * `unknownValues`, so the hint line could not explain it. One author for the
 * validity test and the match (`parseHistoryQuery` and `valueMatches`), or the
 * two drift and a value is reported unknown while still filtering.
 */
function weekValueOf(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? parseInt(text, 10) : null;
}

/**
 * Splits a token's `value,value` portion on commas outside quotes. Each
 * chunk's surrounding quotes are stripped; a chunk is `quoted` if a quote
 * character appeared anywhere in it (the writers only ever emit fully-quoted
 * or fully-bare chunks, so this is unambiguous in practice). Empty chunks
 * (`floor:,`) are dropped — that is what makes a trailing comma neutral.
 */
function splitValues(input: string): RawValue[] {
  const values: RawValue[] = [];
  let start = 0;
  let inQuotes = false;
  let sawQuote = false;

  // R-D10-Q: an UNTERMINATED quote is lenient — the value still runs to
  // end-of-string (R-15), but it does not buy the exact-match semantics a
  // closed quote does (R-D10-J). `player:"Tank` is a query mid-typing, and
  // exact-matching it would empty the table for the same reason the neutral
  // trailing colon exists (R-30). Only the final chunk can be affected: an
  // unterminated quote swallows everything after it.
  const pushChunk = (end: number, unterminated = false) => {
    const raw = input.slice(start, end);
    const text = raw.replace(/"/g, '').trim();
    if (text.length > 0) values.push({ text, quoted: sawQuote && !unterminated });
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      sawQuote = true;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      pushChunk(i);
      start = i + 1;
      sawQuote = false;
    }
  }
  pushChunk(input.length, inQuotes);
  return values;
}

/**
 * Classifies one token's text: the key is whatever precedes the FIRST colon
 * found outside quotes. No such colon (none at all, or a colon that only
 * appears once a quote has opened and never closed — e.g. `"player:alice`)
 * classifies the whole token as a free term. A colon literally at index 0
 * (an empty key) is treated the same way.
 */
function classifyToken(text: string): RawToken {
  let inQuotes = false;
  let colonIdx = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ':' && !inQuotes) {
      colonIdx = i;
      break;
    }
  }
  // An odd number of quotes means the token never closed one. The writers
  // need this: re-emitting such a token VERBATIM lets its open quote swallow
  // whatever is appended after it (see `appendToken`).
  const unterminated = (text.match(/"/g)?.length ?? 0) % 2 === 1;
  if (colonIdx <= 0) {
    return { text, key: null, values: [], unterminated };
  }
  const key = text.slice(0, colonIdx).toLowerCase();
  const values = splitValues(text.slice(colonIdx + 1));
  return { text, key, values, unterminated };
}

/**
 * Appends a new token to a tokenized query.
 *
 * An **unterminated** token can only ever be LAST — its open quote runs to
 * end-of-string (R-15) — so the fix for "the open quote swallows whatever we
 * append" is to keep it last, not to rewrite it. Appending after `player:"Tank
 * One` would otherwise produce ONE token whose value is `Tank One floor:m9s`:
 * pill unlit, table empty, and NEITHER hint line firing, because the key is
 * known and the value merely unmatched — the unexplained empty table R-D10-K
 * exists to prevent.
 *
 * Putting the new token before it preserves R-D10-D's promise that an
 * untouched token keeps its own spelling, and changes no semantics at all.
 */
function appendToken(tokens: RawToken[], newToken: string): string {
  const parts = tokens.map((t) => t.text);
  const trailingOpen = tokens.length > 0 && tokens[tokens.length - 1].unterminated;
  const tail = trailingOpen ? parts.pop() : undefined;
  parts.push(newToken);
  if (tail !== undefined) parts.push(tail);
  return parts.join(' ');
}

/**
 * Walks the raw string into whitespace-delimited tokens. A `"` toggles
 * "inside quotes"; whitespace *outside* quotes ends a token. An unterminated
 * quote therefore runs to end-of-string (R-15) — the defect R-30's table
 * names, since v1 splits on `/\s+/` unconditionally and FFXIV player names
 * are always two words.
 */
function tokenize(query: string): RawToken[] {
  const tokens: RawToken[] = [];
  let i = 0;
  const n = query.length;
  while (i < n) {
    while (i < n && /\s/.test(query[i])) i++;
    if (i >= n) break;
    const start = i;
    let inQuotes = false;
    while (i < n) {
      const ch = query[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        i++;
        continue;
      }
      if (!inQuotes && /\s/.test(ch)) break;
      i++;
    }
    tokens.push(classifyToken(query.slice(start, i)));
  }
  return tokens;
}

/**
 * Emits `key:value,value`. A value is quoted when it was quoted OR when it
 * contains whitespace — the second half is a **round-trip invariant**, not a
 * style choice: a bare value with a space re-tokenizes as two tokens, so
 * emitting one would silently change the query it came from. (Quoting a value
 * that arrived as an unterminated multiword also commits it to exact matching;
 * at the point the user clicked a pill they are no longer mid-typing that
 * token, and a committed quote beats a corrupted one.)
 */
function serializeToken(key: string, values: RawValue[]): string {
  const emit = (v: RawValue) => (v.quoted || /\s/.test(v.text) ? `"${v.text}"` : v.text);
  return `${key}:${values.map(emit).join(',')}`;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export type HistoryQueryKey =
  | 'player' | 'floor' | 'slot' | 'type' | 'method' | 'week' | 'job' | 'source';

/**
 * Every key the parser honours, in the order the hint line lists them.
 * EXPORTED so `HistorySearch`'s hint line derives its copy from this list
 * rather than re-typing it: the hint is the discovery surface, so a second
 * hand-maintained vocabulary there would eventually tell users about a key
 * that no longer parses, or omit one that does.
 */
export const KNOWN_KEYS: readonly HistoryQueryKey[] = [
  'player', 'floor', 'slot', 'type', 'method', 'week', 'job', 'source',
];

function isKnownKey(key: string): key is HistoryQueryKey {
  return (KNOWN_KEYS as readonly string[]).includes(key);
}

/**
 * `source:`'s closed vocabulary. `SOURCE_VALUES` drives matching (it includes
 * `all`); `SOURCE_SUGGESTIONS` is what the hint line offers, which omits `all`
 * because suggesting the no-op value to someone who mistyped is noise. Same
 * one-author reason as `KNOWN_KEYS`.
 */
const SOURCE_VALUES = new Set(['all', 'raid', 'tome', 'book', 'material']);
export const SOURCE_SUGGESTIONS: readonly string[] = ['raid', 'tome', 'book', 'material'];

/** One recognised `key:value,value` token. NOT exported (R-17). */
interface HistoryQueryFilter {
  key: HistoryQueryKey;
  values: RawValue[];
}

export interface ParsedHistoryQuery {
  /** AND across entries, OR within one entry's values (R-36). */
  filters: HistoryQueryFilter[];
  /** Free text, lower-cased, quotes stripped. */
  terms: string[];
  /** Recognised key, unrecognised — never filters anything (R-D10-G). */
  unknownKeys: string[];
  /** Recognised key, closed-vocabulary value that isn't in it — matches nothing (R-D10-K). */
  unknownValues: { key: 'source' | 'week'; value: string }[];
}

export interface HistoryQueryContext {
  playerNameOf: (item: HistoryItem) => string;
  playerJobOf: (item: HistoryItem) => string;
}

export function parseHistoryQuery(query: string): ParsedHistoryQuery {
  const tokens = tokenize(query);
  const filters: HistoryQueryFilter[] = [];
  const terms: string[] = [];
  const unknownKeys: string[] = [];
  const unknownValues: { key: 'source' | 'week'; value: string }[] = [];

  for (const token of tokens) {
    if (token.key === null) {
      const term = token.text.replace(/"/g, '').toLowerCase();
      if (term.length > 0) terms.push(term);
      continue;
    }

    if (!isKnownKey(token.key)) {
      if (!unknownKeys.includes(token.key)) unknownKeys.push(token.key);
      continue;
    }

    // Neutral: `key:` with an empty value list (nothing, or only commas) is
    // dropped rather than treated as a filter — the table must not empty
    // while the user is still typing the value (R-30).
    if (token.values.length === 0) continue;

    const key = token.key;
    filters.push({ key, values: token.values });

    if (key === 'source' || key === 'week') {
      for (const value of token.values) {
        const valid = key === 'source'
          ? SOURCE_VALUES.has(value.text.toLowerCase())
          : weekValueOf(value.text) !== null;
        if (valid) continue;
        const alreadyReported = unknownValues.some(
          (u) => u.key === key && u.value.toLowerCase() === value.text.toLowerCase(),
        );
        if (!alreadyReported) unknownValues.push({ key, value: value.text });
      }
    }
  }

  return { filters, terms, unknownKeys, unknownValues };
}

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

function rawSlotOf(item: HistoryItem): string {
  return item.kind === 'loot' ? item.entry.itemSlot : item.entry.materialType;
}

function matchesType(item: HistoryItem, value: string): boolean {
  switch (value) {
    case 'gear':
    case 'loot':
      return item.kind === 'loot';
    case 'materials':
    case 'material':
      return item.kind === 'material';
    case 'extra':
      return item.kind === 'loot' && item.entry.isExtra;
    case 'bis':
      return item.kind === 'loot' && !item.entry.isExtra;
    default:
      // v1 parity fallback: substring against the kind itself.
      return item.kind.toLowerCase().includes(value);
  }
}

function matchesSource(item: HistoryItem, value: string): boolean {
  if (value === 'all') return true;
  if (value === 'material') return item.kind === 'material';
  if (item.kind !== 'loot') return false;
  const { method } = item.entry;
  if (value === 'raid') return method === 'drop';
  if (value === 'tome') return method === 'tome' || method === 'purchase';
  if (value === 'book') return method === 'book';
  // Unrecognised value: matches nothing (R-D10-K) — reported separately in
  // ParsedHistoryQuery.unknownValues by the parser.
  return false;
}

function valueMatches(
  key: HistoryQueryKey,
  value: RawValue,
  item: HistoryItem,
  ctx: HistoryQueryContext,
): boolean {
  const v = value.text.toLowerCase();
  switch (key) {
    case 'player': {
      const name = ctx.playerNameOf(item).toLowerCase();
      // Quoted → whole-name exact match; bare → substring (R-D10-J).
      return value.quoted ? name === v : name.includes(v);
    }
    case 'job':
      return ctx.playerJobOf(item).toLowerCase().includes(v);
    case 'floor':
      return item.entry.floor.toLowerCase().includes(v);
    case 'slot': {
      const slotName = slotNameOf(item).toLowerCase();
      const rawSlot = rawSlotOf(item).toLowerCase();
      const weaponJob = weaponJobOf(item);
      const slotAugmented = item.kind === 'material' ? item.entry.slotAugmented : undefined;
      return (
        slotName.includes(v)
        || rawSlot.includes(v)
        || (!!weaponJob && weaponJob.toLowerCase().includes(v))
        || (!!slotAugmented && slotAugmented.toLowerCase().includes(v))
      );
    }
    case 'method':
      // Raw method only — every METHOD_INFO label is a capitalised raw, so a
      // label clause can never add a match under case-insensitive substring
      // (R-D10-M).
      return item.entry.method.toLowerCase().includes(v);
    case 'week': {
      const n = weekValueOf(value.text);
      return n !== null && item.entry.weekNumber === n;
    }
    case 'type':
      return matchesType(item, v);
    case 'source':
      return matchesSource(item, v);
    default:
      return false;
  }
}

/**
 * The weapon job a row actually SHOWS.
 *
 * The loot edit API keeps a non-null `weapon_job` when an entry's slot moves
 * away from weapon, so a Body row can carry a stale job. The Slot cell gates
 * its job icon on `itemSlot === 'weapon'` for that reason
 * (`LootHistoryTable.tsx:221`), and the matcher has to gate identically —
 * otherwise `slot:pld` surfaces a Body row displaying no PLD anywhere, which
 * is R-D10-N's defect with the sign flipped: searchable but invisible.
 * (The stale data itself is a D9a carry-over: the render gate landed, the
 * data-side fix did not.)
 */
function weaponJobOf(item: HistoryItem): string | null | undefined {
  return item.kind === 'loot' && item.entry.itemSlot === 'weapon' ? item.entry.weaponJob : undefined;
}

function termMatches(term: string, item: HistoryItem, ctx: HistoryQueryContext): boolean {
  // Week shorthand: w3, week3, week 3 (AllWeeksView.tsx:253-268, verbatim).
  const weekMatch = term.match(/^w(?:eek\s*)?(\d+)$/i);
  if (weekMatch) {
    return item.entry.weekNumber === parseInt(weekMatch[1], 10);
  }

  const name = ctx.playerNameOf(item).toLowerCase();
  const job = ctx.playerJobOf(item).toLowerCase();
  const slot = slotNameOf(item).toLowerCase();
  const rawSlot = rawSlotOf(item).toLowerCase();
  const floor = item.entry.floor.toLowerCase();
  const method = item.entry.method.toLowerCase();
  const kind = item.kind.toLowerCase();
  const weaponJob = weaponJobOf(item);
  // R-D10-S: free text reaches the `aug {slot}` readout too, not just `slot:`.
  // "legs" is what someone actually types to find which twine went into legs,
  // and R-D10-N's rule — visible-and-unsearchable is a defect on the tab whose
  // identity is *find* — binds harder on the un-keyed form than the keyed one.
  const slotAugmented = item.kind === 'material' ? item.entry.slotAugmented : undefined;
  const isExtra = item.kind === 'loot' && item.entry.isExtra;
  const isBis = item.kind === 'loot' && !item.entry.isExtra;
  const weekNumber = item.entry.weekNumber;

  return (
    name.includes(term)
    || job.includes(term)
    || slot.includes(term)
    || rawSlot.includes(term)
    || floor.includes(term)
    || method.includes(term)
    || kind.includes(term)
    || (!!weaponJob && weaponJob.toLowerCase().includes(term))
    || (!!slotAugmented && slotAugmented.toLowerCase().includes(term))
    || (term === 'extra' && isExtra)
    || (term === 'bis' && isBis)
    || `w${weekNumber}`.includes(term)
    || `week ${weekNumber}`.includes(term)
  );
}

export function filterHistoryItemsByQuery(
  items: HistoryItem[],
  parsed: ParsedHistoryQuery,
  ctx: HistoryQueryContext,
): HistoryItem[] {
  return items.filter((item) => {
    for (const filter of parsed.filters) {
      const matched = filter.values.some((value) => valueMatches(filter.key, value, item, ctx));
      if (!matched) return false;
    }
    for (const term of parsed.terms) {
      if (!termMatches(term, item, ctx)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Pill token writers — built on the same `tokenize` (R-4).
// ---------------------------------------------------------------------------

/**
 * Exact on the value AND its quoting form (R-D10-L), never substring — a
 * typed `player:ali` filters the table but lights no pill.
 */
export function hasQueryToken(
  q: string,
  key: HistoryQueryKey,
  value: string,
  quoted: boolean,
): boolean {
  const target = value.toLowerCase();
  return tokenize(q).some(
    (t) => t.key === key && t.values.some((v) => v.quoted === quoted && v.text.toLowerCase() === target),
  );
}

/**
 * Toggles one value on the first token matching `key`: removes it from that
 * token's list when present (dropping the whole token once its list empties),
 * otherwise appends it to that token's comma list, or adds a new token at the
 * end when no token of `key` exists yet (R-D10-D). Rewriting is
 * tokenize -> map -> join over the one `tokenize`, so whitespace between
 * tokens normalises to single spaces while every untouched token keeps its
 * own text.
 */
export function toggleQueryToken(
  q: string,
  key: HistoryQueryKey,
  value: string,
  quoted: boolean,
): string {
  const tokens = tokenize(q);
  const target = value.toLowerCase();
  const isTarget = (v: RawValue) => v.quoted === quoted && v.text.toLowerCase() === target;
  const firstIndex = tokens.findIndex((t) => t.key === key);

  if (firstIndex === -1) {
    return appendToken(tokens, serializeToken(key, [{ text: value, quoted }]));
  }

  // `hasQueryToken` lights the pill off ANY token carrying the key, so the
  // remove branch has to clear the value from ALL of them — otherwise a
  // hand-typed `floor:m9s floor:m10s` lights the M10S pill (found in the
  // second token) while a click edits only the first, and the pill can never
  // be switched off. The add branch stays on the first token, since that is
  // the one a subsequent read will report.
  const present = tokens.some((t) => t.key === key && t.values.some(isTarget));
  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.key !== key || (!present && i !== firstIndex)) {
      parts.push(t.text);
      continue;
    }
    const nextValues = present
      ? t.values.filter((v) => !isTarget(v))
      : [...t.values, { text: value, quoted }];
    if (nextValues.length === 0) continue; // drop the token entirely
    parts.push(serializeToken(key, nextValues));
  }
  return parts.join(' ');
}

/** Backs each row's `[All]` pill — lit exactly when no token of `key` exists. */
export function removeQueryKey(q: string, key: HistoryQueryKey): string {
  return tokenize(q)
    .filter((t) => t.key !== key)
    .map((t) => t.text)
    .join(' ');
}
