/**
 * HistorySearch — the v2 History tab's search box, hint line and three pill
 * rows (Phase D, D10, spec §3.4 / R-30 / R-36 / R-47). Standalone and fully
 * controlled: the query string is the only state, owned by the caller
 * (`Loot.tsx`) — this component reads it, writes it back through
 * `onQueryChange`, and never holds a second copy.
 *
 * Composition modeled on the Priority floor-pill row (`Loot.tsx:1035-1050`,
 * R-19): a `text-xs uppercase tracking-wide text-text-tertiary` label, a
 * `role="group"` + `aria-label` wrapper, `Tag variant="filter"` pills.
 *
 * R-D10-I: the clear `✕` is a SIBLING `IconButton` in the search row, never
 * `Input`'s `rightIcon` slot — that slot is unused codebase-wide and reserves
 * only padding, while `IconButton` carries a 44px touch target below `sm:`.
 * Neither `ui/Input.tsx` nor `primitives/IconButton.tsx` is edited by this
 * file; the composition is entirely at the call site.
 *
 * The three pill rows read the LIVE `query` prop via `hasQueryToken` /
 * `removeQueryKey` (immediate — no debounce), so a click lights the pill on
 * the same frame. `unknownKeys`/`unknownValues` come from the CALLER's
 * debounced parse (per-prop docs below) — warning mid-keystroke would be
 * noise the box itself never produces.
 *
 * No Week or Source pill row (R-D10-A) — both keys survive only as tokens,
 * named in the placeholder (R-D10-P) so they stay discoverable. The
 * placeholder still omits `Ctrl+Shift+F` — it already carries four keys of
 * syntax teaching (R-D10-P's other job) — and instead the shortcut is
 * surfaced as a `(^⇧F)` hint at the end of the search row (D11, R-D11-J,
 * spec §6's sketch).
 */
import { useRef, type RefObject } from 'react';
import { Search, X } from 'lucide-react';
import { Input, Tag, type Tone } from '../ui';
import { IconButton } from '../primitives';
import type { SnapshotPlayer } from '../../types';
import {
  hasQueryToken,
  toggleQueryToken,
  removeQueryKey,
  parseHistoryQuery,
  KNOWN_KEYS,
  SOURCE_SUGGESTIONS,
  type HistoryQueryKey,
} from '../../utils/historyQuery';

export interface HistorySearchProps {
  /** The whole, undebounced query string — the only state this control has. */
  query: string;
  onQueryChange: (next: string) => void;
  /** From the caller's DEBOUNCED parse — warning mid-keystroke would be noise. */
  unknownKeys: string[];
  /** From the caller's DEBOUNCED parse. */
  unknownValues: { key: 'source' | 'week'; value: string }[];
  /** Tier floor names in order (`M9S`…), feeding the Floor pill row. */
  floors: string[];
  /** Configured players, caller-filtered and sort-ordered — feeds the Player pill row. */
  players: SnapshotPlayer[];
  /**
   * Optional caller-supplied ref to the search input (D11, R-35's
   * `Ctrl+Shift+F` focuses through this). Resolved once alongside the
   * internal ref — see `ref` below — and used for BOTH the `<Input>` and
   * `clearSearch`, so a caller-supplied ref keeps N5's clear-focus-restore
   * working instead of dropping focus to `<body>`. Optional so every test
   * that renders the control bare keeps working unchanged.
   */
  inputRef?: RefObject<HTMLInputElement | null>;
}

const PLACEHOLDER = 'Search — player:"Tank One", floor:m9s,m10s, source:tome, week:3';

// N1: derived, never re-typed. The hint line is the discovery surface, so a
// second hand-maintained copy of either vocabulary would eventually advertise
// a key that no longer parses — or omit one that does.
const KNOWN_KEYS_HINT = KNOWN_KEYS.join(', ');
const SOURCE_VALUES_HINT = SOURCE_SUGGESTIONS.join(', ');

function quoteJoin(values: string[]): string {
  return values.map((v) => `"${v}"`).join(', ');
}

/** Whether ANY token of `key` exists in the live query — backs each row's `[All]` pill (R-D10-L). */
function hasAnyToken(query: string, key: HistoryQueryKey): boolean {
  return parseHistoryQuery(query).filters.some((f) => f.key === key);
}

/**
 * Clicking an ALREADY-lit `All` pill is a no-op and must stay one. Running
 * `removeQueryKey` anyway re-joins the token list, which normalises the
 * whitespace a user may be in the middle of typing after (N7).
 */
function clearKey(query: string, key: HistoryQueryKey): string {
  return hasAnyToken(query, key) ? removeQueryKey(query, key) : query;
}

export function HistorySearch({
  query,
  onQueryChange,
  unknownKeys,
  unknownValues,
  floors,
  players,
  inputRef,
}: HistorySearchProps) {
  const unknownSourceValues = unknownValues.filter((v) => v.key === 'source').map((v) => v.value);
  const unknownWeekValues = unknownValues.filter((v) => v.key === 'week').map((v) => v.value);

  const hintParts: string[] = [];
  if (unknownKeys.length > 0) {
    const label = unknownKeys.length === 1 ? 'filter' : 'filters';
    hintParts.push(
      `Unknown ${label} ${quoteJoin(unknownKeys)} — ignored. Try: ${KNOWN_KEYS_HINT}`,
    );
  }
  if (unknownSourceValues.length > 0) {
    const label = unknownSourceValues.length === 1 ? 'source' : 'sources';
    hintParts.push(
      `Unknown ${label} ${quoteJoin(unknownSourceValues)} — nothing matches. Try: ${SOURCE_VALUES_HINT}`,
    );
  }
  if (unknownWeekValues.length > 0) {
    const label = unknownWeekValues.length === 1 ? 'week' : 'weeks';
    hintParts.push(
      `Unknown ${label} ${quoteJoin(unknownWeekValues)} — nothing matches. Use a week number.`,
    );
  }

  // N5: the clear button unmounts itself the moment the query empties, which
  // drops a keyboard user's focus to <body>. Hand it back to the box they were
  // searching in. (V1's raw button has the same hole — this is a fix, not
  // parity debt. `Input` already forwards its ref, so nothing shared changes.)
  //
  // M2: resolved ONCE and used by BOTH the `<Input>` below and `clearSearch` —
  // a caller-supplied `inputRef` (D11's only caller, R-35's `Ctrl+Shift+F`)
  // must be the same ref clearing focuses back to, or the internal one is
  // never attached and clearing drops focus to <body>.
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? internalRef;
  const clearSearch = () => {
    onQueryChange('');
    ref.current?.focus();
  };

  const toggle = (key: HistoryQueryKey, value: string, quoted: boolean) => {
    onQueryChange(toggleQueryToken(query, key, value, quoted));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <Input
          ref={ref}
          value={query}
          onChange={onQueryChange}
          fullWidth
          leftIcon={<Search className="h-4 w-4" />}
          placeholder={PLACEHOLDER}
          aria-label="Search history"
        />
        {query.length > 0 && (
          <IconButton
            aria-label="Clear search"
            variant="ghost"
            size="sm"
            icon={<X className="h-4 w-4" />}
            onClick={clearSearch}
          />
        )}
        {/* R-D11-J: unconditional (unlike the clear button) — a plain inline
            span with no flex/grid display of its own, since index.css's
            aria-hidden rule reverts `display` on this element (the F-4
            hazard `LootHistoryTable.tsx` documents at its slot cell). */}
        <span aria-hidden="true" className="text-xs text-text-tertiary">
          (^⇧F)
        </span>
      </div>

      {/* R-D10-C: always mounted, text emptied when there is nothing to say —
          a live region inserted already populated is not reliably announced
          (D9b's lesson). */}
      <div role="status" className="flex flex-col gap-0.5 text-xs text-status-warning">
        {hintParts.map((part) => (
          <p key={part}>{part}</p>
        ))}
      </div>

      <div role="group" aria-label="Type filter" className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs uppercase tracking-wide text-text-tertiary">Type</span>
        <Tag
          variant="filter"
          tone="accent"
          pressed={!hasAnyToken(query, 'type')}
          onClick={() => onQueryChange(clearKey(query, 'type'))}
        >
          All
        </Tag>
        <Tag
          variant="filter"
          tone="accent"
          pressed={hasQueryToken(query, 'type', 'gear', false)}
          onClick={() => toggle('type', 'gear', false)}
        >
          Gear
        </Tag>
        <Tag
          variant="filter"
          tone="accent"
          pressed={hasQueryToken(query, 'type', 'materials', false)}
          onClick={() => toggle('type', 'materials', false)}
        >
          Materials
        </Tag>
      </div>

      <div role="group" aria-label="Floor filter" className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs uppercase tracking-wide text-text-tertiary">Floor</span>
        <Tag
          variant="filter"
          tone="accent"
          pressed={!hasAnyToken(query, 'floor')}
          onClick={() => onQueryChange(clearKey(query, 'floor'))}
        >
          All
        </Tag>
        {floors.map((floor, index) => {
          const value = floor.toLowerCase();
          const tone = `floor-${(index % 4) + 1}` as Tone;
          return (
            <Tag
              key={floor}
              variant="filter"
              tone={tone}
              pressed={hasQueryToken(query, 'floor', value, false)}
              onClick={() => toggle('floor', value, false)}
            >
              {floor}
            </Tag>
          );
        })}
      </div>

      <div role="group" aria-label="Player filter" className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs uppercase tracking-wide text-text-tertiary">Player</span>
        <Tag
          variant="filter"
          tone="accent"
          pressed={!hasAnyToken(query, 'player')}
          onClick={() => onQueryChange(clearKey(query, 'player'))}
        >
          All
        </Tag>
        {players.map((player) => (
          <Tag
            key={player.id}
            variant="filter"
            tone="accent"
            pressed={hasQueryToken(query, 'player', player.name, true)}
            onClick={() => toggle('player', player.name, true)}
          >
            {player.name}
          </Tag>
        ))}
      </div>
    </div>
  );
}
