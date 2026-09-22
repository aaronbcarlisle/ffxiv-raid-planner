# Phase D · D10 — History search

**Branch:** `phase-d/d10-history-search` off `main` @ `a99da91d`
**Binding authority:** `specs/phase-d-loot-plan.md:197` (the D10 row)
**Rulings implemented:** R-30, R-36, R-47, R-37
**Status:** in progress — plan vetted by `xivrp-director` (APPROVE-WITH-REQUIRED-CHANGES); all 19
findings dispositioned in §2a.

---

## 0. Opening position — what this slice deletes

D10 is the only Phase-D slice whose **acceptance test is a deletion**. The D10 row states it
plainly: `HistoryFilters` / `DEFAULT_HISTORY_FILTERS` *dissolve into the query string*. If the
slice ships a query parser **beside** the pill state rather than **in place of** it, it has
failed R-30's actual argument — that two independent filter surfaces ANDed together give a user
two places to look when the table comes back empty.

Verified blast radius (grep over `frontend/src`, excluding the defining file):

| Symbol | Consumers outside `historyItems.ts` | Disposition |
|---|---|---|
| `HistoryFilters` | `Loot.tsx:16,173,931`, `Loot.test.tsx:10`, `LootToolbar.tsx:6,24` | file deleted; **no `HistoryFilters.test.tsx` exists** |
| `DEFAULT_HISTORY_FILTERS` | `Loot.tsx:198,387`, `LootHistoryTable.test.tsx` ×8, `historyItems.test.ts` | deleted |
| `HistoryFilterState` | `HistoryFilters.tsx`, `LootHistoryTable.tsx:70,85`, `historyItems.test.ts` | deleted |
| `filterHistoryItems` | `LootHistoryTable.tsx:64,456`, `historyItems.test.ts` | deleted (replaced by the query matcher) |
| `historyWeeks` | `HistoryFilters.tsx`, `Loot.tsx:198,934`, `historyItems.test.ts` | deleted — it fed the week pill, and §6 has no week pill |
| `HistorySource` | `HistoryFilters.tsx` only | the union moves into `historyQuery.ts` as `source:`'s value set |
| `matchesSource` (file-local) | — | moves to `historyQuery.ts`; the semantics comment moves with it |

Nothing outside v2's Loot subtree reads any of them — no `history/`, `stores/`, `hooks/`,
`gamedata/`, `primitives/` or `ui/` file. **V1's `history/` is untouched**: R-43 forbids editing
`AllWeeksView.tsx:214-268`, which is why v2 ships its own parser at all.

---

## 1. Scope

In:

- `utils/historyQuery.ts` (new) — tokenizer, parser, matcher, pill token writers.
- `components/loot/HistorySearch.tsx` (new) — search box, hint line, three pill rows.
- `components/loot/HistoryFilters.tsx` — **deleted**.
- `utils/historyItems.ts` — the filter half pruned; merge/sort untouched.
- `components/loot/LootHistoryTable.tsx` — `filters` prop → parsed query.
- `components/loot/Loot.tsx` — query state, debounce, placement; docblock `:16` and `:83-88`.
- `components/loot/LootToolbar.tsx` — docstring **`:6` and `:24`** (both name `HistoryFilters`;
  `:6` becomes doubly false once `weekControl` is Log-only).

Out, explicitly:

- **`Ctrl+Shift+F`** — R-35, owned by D11 with its focus/modal guard and registry entry. D10
  ships the box; D11 ships the binding **and** adds the `inputRef`/imperative handle
  `HistorySearchProps` deliberately does not expose yet, plus the placeholder's shortcut hint.
- Row click / kebab changes (R-31/R-32, D11) and the jumps (D12).
- Mobile affordances — one consolidated pass at Phase P.

---

## 2. Rulings taken this slice

Ruled by the user at plan time and during director disposition, 2026-09-22:

| # | Ruling | Rationale |
|---|---|---|
| **R-D10-A** | Pill set is **§6's**: Type `[All][Gear][Materials]`, Floor `[All][M9S…M12S]`, Player (every configured player). Week and Source keep their **tokens** but lose their controls | §6's sketch is the drawn target; the floor pills are R-36's worked example. Week is answered by the sort + separators. Both surviving token-only keys are named in the placeholder (R-D10-P) so they stay discoverable |
| **R-D10-B** | The Player row is **inline and wrapping** — no overflow menu, no dropdown | R-30's rationale is that pills *teach* the syntax; the filter with the most values is the worst one to hide. Accepted cost: History's control block is taller than Priority's or Log's |
| **R-D10-C** | An unknown key is surfaced in a **hint line under the box**, `role="status"` | The alternative (the table's stats row) is far from what you typed and shares a live region with the count, so two facts compete for one announcement |
| **R-D10-D** | Pills **merge into one token's comma list**; never a second token of the same key | Falls out of R-36: repeated keys AND, so `floor:m9s floor:m10s` is empty. Clicking two floors must produce `floor:m9s,m10s` — which is why the **value** splitter is quote-aware too |
| **R-D10-E** | All three rows use **one pill idiom** (`Tag variant="filter"`), Type included — not a `SegmentedToggle` | A segmented toggle asserts exactly-one-selected as component state. The query is the only state, and it can legally hold `type:gear,materials` or neither |
| **R-D10-F** | R-37 holds **by construction**: the query lives in `useState`, never enters the URL, so `copyLink` has nothing to delete | A `params.delete('q')` against a param nothing writes is dead code that reads as protection. Pinned by T-8 **and** by a comment at the `buildEntryLink` denylist (`Loot.tsx:234-248`), which keeps every param it does not explicitly delete |
| **R-D10-G** | An unknown key is surfaced **whether or not** it has a value (`colour:blue` and `colour:` both warn) | No real typing sequence passes through a *wrong* key then a colon — you type `floor` then `:`, never `f:` — so this adds no mid-type noise |
| **R-D10-H** | The search block renders **inside the History `grid`, immediately above `LootHistoryTable`** — below `FairnessSummary`, not above it | `FairnessSummary` sits between the toolbar and the table until D14 moves it Home (R-40). Placing the control adjacent to what it filters is right now **and** converges with §6's sketch once D14 lands; placing it above the card would be wrong in the interim and identical afterwards |
| **R-D10-I** | The clear `✕` is a **sibling `IconButton`** in the search row, not `Input`'s `rightIcon`. **No edit to `ui/Input.tsx` or `primitives/IconButton.tsx`** | `rightIcon` has **zero usages codebase-wide** (unproven slot) and is a decorative `absolute` wrapper reserving only `pr-8`/`pr-10` (`Input.tsx:119-125`, `:55-59`), while `IconButton` carries `min-h-[44px]` below `sm:` (`IconButton.tsx:34-37`) — a 44 px control inside the `h-10` input at phone widths. V1 dodged this with a `design-system-ignore`'d raw button (`AllWeeksView.tsx:449-459`). The hazard is not the visual; it is that the fix lands in `ui/Input.tsx`, which every V1 form renders. If the sibling composition cannot be made to look right, **stop and escalate** |
| **R-D10-J** | **`player:` — a quoted value matches the whole name exactly; a bare value stays substring** (USER) | Today's dropdown matches by id (`historyItems.ts:166`), so a name-substring pill would silently over-select whenever one roster name prefixes another. Pills always quote, so a pill still means "this player"; R-30's sanctioned typed `player:ali` still filters. **Two residuals, both accepted and disclosed:** (1) once a roster row is deleted the log keeps only `recipientPlayerName`, so a current same-named player's pill claims those rows; (2) `SnapshotPlayer.name` has no uniqueness constraint, so two configured slots sharing a name are one pill and one result set. An id-bearing token would fix (2) and defeat R-30 — the pills exist to *teach* a syntax the user can read and retype, and `player:#a3f1c2` is neither |
| **R-D10-K** | **An unknown value on a closed-vocabulary key (`source:`, `week:`) matches nothing and is surfaced** (USER) | A token you typed always narrows — that rule stays honest — and the hint line kills R-30's actual complaint, which is an empty table with nowhere to look for the cause. Distinct from an unknown *key*, which cannot be applied at all and so is ignored |
| **R-D10-L** | Pill lighting compares the value **and its quoting form** | Makes three things one fact: the pill is lit ⟺ clicking removes it ⟺ the query selects exactly that. Visible in the box, so it is teachable rather than invisible |
| **R-D10-M** | `method:` matches the **raw** method only — no label clause | Every `METHOD_INFO` label is the capitalised raw value (`lootMethodDisplay.ts:10-13`) and `methodLabelOf` falls back to the raw, so under case-insensitive substring a label clause can never add a match. Same standard that rejected `params.delete('q')` in R-D10-F |
| **R-D10-N** | `slot:` also matches a material's **`slotAugmented`** | The Type column renders `aug {slot}` per R-D9a-A, restored by R-34 precisely so "which slot did that twine go into?" is answerable. On the tab whose identity is *find*, visible-and-unsearchable is a defect. (`date:` is the same class but v1 has no date field either — parity-neutral, left alone) |
| **R-D10-Q** | An **unterminated** quote groups to end-of-string (R-15) but does **not** buy exact-match semantics — the value is treated as bare | Ruled at Task 1 build. The implementer flagged the case as unspecified and chose **exactness**; that choice was **overruled** — the shipped behaviour is bare/lenient. `player:"Tank` is a query *mid-typing*; exact-matching it empties the table for precisely the reason the neutral trailing colon exists (R-30). Leniency is the consistent answer |
| **R-D10-R** | `week:` takes a **whole number** (`/^\d+$/`) or it is an unknown value | Ruled at Task 1 build. `parseInt('3abc')` is `3`, so the laxer check filtered to week 3 while reporting nothing — the user asked for something the parser could not honour and would never be told, which is R-D10-K's failure mode reintroduced by a weaker test. One helper authors both the validity check and the match, or they drift |
| **R-D10-P** | The placeholder names `player:`, `floor:`, `source:` and `week:` and **must not mention `Ctrl+Shift+F`** | §6's sketch draws `(^⇧F)` on the search row and V1's placeholder advertises it (`AllWeeksView.tsx:446`), but the binding is D11's. Advertising an activation that will not fire is the D-55/R-31 rule inverted. The placeholder is also the only resting-state home for the two keys R-D10-A leaves control-less |

## 2a. Director verdict disposition

Plan vetted before implementation; verdict **APPROVE-WITH-REQUIRED-CHANGES**, 13 required + 2
should-fix + 4 nits. All 19 dispositioned — 17 accepted as plan edits, 2 escalated to the user
and ruled (R-6 → R-D10-J, R-3 → R-D10-K). Three findings were re-verified against the code
before acceptance rather than taken on report: `FairnessSummary`'s position (`Loot.tsx:1050-1060`
— confirmed), `rightIcon`'s zero usages (confirmed), and `METHOD_INFO`'s labels
(`lootMethodDisplay.ts:10-13` — confirmed all four are capitalised raws, so R-16 stands).

| # | Finding | Disposition |
|---|---|---|
| R-1 | No test proves the dissolution the D10 row makes the acceptance test | **Accepted** → T-10 |
| R-2 | Resting state teaches nothing; sketch would ship a dead `^⇧F` | **Accepted** → R-D10-P, §3.4 |
| R-3 | Unknown *value* empties the table silently | **Escalated → ruled** R-D10-K |
| R-4 | `ParsedHistoryQuery` cannot back the writers; two tokenizers | **Accepted** → §3.1's `RawToken` |
| R-5 | §3.4 and §3.2 contradict on player quoting | **Accepted** — resolved by R-D10-J/L: the pill quotes **always**, and the writer takes the quoting as an argument |
| R-6 | Player match silently changes from id-exact to name-substring | **Escalated → ruled** R-D10-J |
| R-7 | §3.6 invited re-wording an R-34-ruled string | **Accepted** — the four zero-row strings are **unchanged** this slice |
| R-8 | T-8 under-specified, and the missing delete is unrecorded | **Accepted** → T-8 rewritten, comment obligation in §3.5 |
| R-9 | The deletion drops `book`/`material` source coverage | **Accepted** → T-5 carries all five values as a move |
| R-10 | Nine filter-driven tests + the R-13/R-15 discriminator unaccounted | **Accepted** → §4's conversion list |
| R-11 | `FairnessSummary` sits between toolbar and table | **Accepted** → R-D10-H |
| R-12 | Clear button is the slice's shared-layer hazard | **Accepted** → R-D10-I |
| R-13 | Two doc consumers missed | **Accepted** → §1 names `LootToolbar.tsx:6,24` and `Loot.tsx:16` |
| R-14 | `aug {slot}` is visible but unsearchable | **Accepted** → R-D10-N |
| R-15 | Unbalanced-quote rule unstated and untested | **Accepted** → §3.1 rule + T-1 |
| R-16 | `method:` label clause is dead by construction | **Accepted** → R-D10-M |
| R-17 | `HistoryQueryFilter` export predicts knip +1 | **Accepted** → not exported |
| R-18 | D11 needs an input ref D10 doesn't leave | **Accepted** → §1's Out |
| R-19 | Citation drift on the Priority floor row | **Accepted** → `Loot.tsx:1000-1015` |

---

## 3. Implementation

### 3.1 `utils/historyQuery.ts` — tokenizer and parser

Pure, storeless, hookless, no React import. Modelled on `AllWeeksView.tsx:214-268`; **never
imports it** (R-43).

**One tokenizer, consumed by the parser AND all three writers** (R-4 — otherwise the slice ships
two, which is the "two authors" defect §3.3 claims to avoid):

```ts
interface RawValue { text: string; quoted: boolean }   // not exported
interface RawToken {                                    // not exported
  /** the token's own source text, so a writer can pass it through untouched. */
  text: string;
  /** lower-cased key, or null for a free term. */
  key: string | null;
  values: RawValue[];
}
function tokenize(query: string): RawToken[];           // not exported
```

Walk the string; a `"` toggles `inQuotes`; whitespace *outside* quotes ends a token. An
**unterminated quote runs to end-of-string** (R-15). `player:"Tank One"` therefore survives as
one token — the defect R-30's table names, since v1 splits on `/\s+/` at `:215` and FFXIV names
are always two words.

Classification uses the **first colon outside quotes**:

| Shape | Result |
|---|---|
| no colon, or colon at index 0 (`"player:alice` — the colon is inside quotes) | free term |
| `key:` with a **known** key, or a value list empty after dropping empties (`floor:,`) | **neutral** — dropped. The table does not empty while the user is still typing the word (R-30) |
| `key:value` with a **known** key | a filter; values split on commas **outside quotes**, each carrying its own `quoted` flag |
| any **unknown** key, with or without a value (R-D10-G) | recorded in `unknownKeys`, de-duped; filters nothing |

```ts
export type HistoryQueryKey =
  | 'player' | 'floor' | 'slot' | 'type' | 'method' | 'week' | 'job' | 'source';

interface HistoryQueryFilter { key: HistoryQueryKey; values: RawValue[] }  // NOT exported (R-17)

export interface ParsedHistoryQuery {
  filters: HistoryQueryFilter[];   // AND across entries, OR within values (R-36)
  terms: string[];                 // free text, lower-cased, quotes stripped
  unknownKeys: string[];           // surfaced; NEVER filters (R-D10-G)
  unknownValues: { key: 'source' | 'week'; value: string }[];  // surfaced; matches nothing (R-D10-K)
}
```

**Per-key predicates.** Substring semantics are kept from v1 wherever v1 had them — R-30 names a
freely typed `player:ali` as a case that must still filter.

| Key | Matches |
|---|---|
| `player` | **quoted** → `ctx.playerNameOf(item)` equals the value (case-insensitive); **bare** → contains it (R-D10-J) |
| `job` | `ctx.playerJobOf(item)` contains the value |
| `floor` | `item.entry.floor` contains the value |
| `slot` | `slotNameOf(item)` **or** the raw key (`itemSlot` / `materialType`) **or** `weaponJob` **or** a material's `slotAugmented` (R-D10-N) contains the value |
| `method` | the raw `item.entry.method` contains the value (R-D10-M) |
| `week` | a **whole number** (`/^\d+$/`) equal to `weekNumber` — **not** bare `parseInt`, which accepts `3abc` as 3 (R-D10-R); anything else matches nothing **and is reported in `unknownValues`** (R-D10-K) |
| `type` | **aliased** (R-47): `gear`\|`loot` → loot rows; `materials`\|`material` → material rows; `extra` → loot && `isExtra`; `bis` → loot && `!isExtra`; anything else falls back to v1's substring against the kind |
| `source` | `matchesSource` moved from `historyItems.ts` — `raid` = loot+`drop`, `tome` = loot+(`tome`\|`purchase`), `book` = loot+`book`, `material` = material rows, `all` = everything. An unrecognised value matches nothing **and is reported in `unknownValues`** |

**Free terms** keep v1's behaviour (`AllWeeksView.tsx:253-268`): each term must match *somewhere*
across name, job, slot, raw slot, floor, method, type, weapon job, `extra`, `bis`, `w{n}`,
`week {n}`. **Two deliberate deviations**, both closing find-surface gaps rather than changing
what v1 got right:

- **R-D10-S** — a term also reaches a material's `slotAugmented`, so the `aug {slot}` readout is
  searchable by the word a user would actually type (`legs`).
- **R-D10-T** — an adjacent `week` + digits pair is rejoined before matching. v1 splits
  `week 3` into two terms and matches them independently, so `week` hits every row and `3` hits
  anything containing a 3; a week-4 row on floor `M3S` came back for a query that said week 3.
  `w3` and `week3` are single tokens and always worked. Verbatim parity here would mean shipping
  a shorthand the docs advertise and the parser ignores.

```ts
export interface HistoryQueryContext {
  playerNameOf: (item: HistoryItem) => string;
  playerJobOf: (item: HistoryItem) => string;
}
export function parseHistoryQuery(query: string): ParsedHistoryQuery;
export function filterHistoryItemsByQuery(
  items: HistoryItem[], parsed: ParsedHistoryQuery, ctx: HistoryQueryContext,
): HistoryItem[];
```

### 3.2 `utils/historyQuery.ts` — the pill token writers

```ts
export function hasQueryToken(q: string, key: HistoryQueryKey, value: string, quoted: boolean): boolean;
export function toggleQueryToken(q: string, key: HistoryQueryKey, value: string, quoted: boolean): string;
export function removeQueryKey(q: string, key: HistoryQueryKey): string;
```

- **`hasQueryToken` is exact on the value *and its quoting form*** (case-insensitive), never
  substring — R-30 states it outright: a typed `player:ali` filters the table but **lights no
  pill**. `floor:m9s,m10s` lights **both** floor pills. The `quoted` argument is R-D10-L: a pill
  emitting `player:"Tank One"` is lit by that token and not by a bare `player:tank one`.
- **`toggleQueryToken`** removes the value from that key's list when present (dropping the whole
  token once its list empties), otherwise appends it to the existing token's comma list, or adds
  a new token at the end (R-D10-D). `quoted` decides emission, so the Player pills pass `true`
  unconditionally (R-D10-J needs exactness even for a single-word name) while Type and Floor
  pass `false`.
- **`removeQueryKey`** backs each row's `[All]` pill, which is lit exactly when no token of that
  key exists.
- Rewriting is tokenize → map → join over the **one** `tokenize`, so **whitespace between tokens
  normalises to single spaces** while every untouched token keeps its own `text`. Observable, so
  T-7 pins it.

### 3.3 `utils/historyItems.ts` — the prune

Delete `HistorySource`, `HistoryFilterState`, `DEFAULT_HISTORY_FILTERS`, `filterHistoryItems`,
`matchesSource` (moved) and `historyWeeks`. The file's docblock loses its source-filter
paragraph — that text moves to `historyQuery.ts`, where the semantics now live. Merge, sort,
`slotNameOf` and `methodLabelOf` are untouched; `slotNameOf` gains a second consumer (the
matcher), which is the point: **one author** for what a cell says and what a query matches.

### 3.4 `components/loot/HistorySearch.tsx` — the control block

```ts
export interface HistorySearchProps {
  query: string;
  onQueryChange: (next: string) => void;
  /** from the DEBOUNCED parse — warning mid-keystroke would be noise. */
  unknownKeys: string[];
  unknownValues: { key: 'source' | 'week'; value: string }[];
  floors: string[];
  /** configured players, caller-filtered and sort-ordered. */
  players: SnapshotPlayer[];
}
```

- **Search row:** a flex row holding `ui/Input` (`fullWidth`, `leftIcon={<Search/>}`) and, as a
  **sibling**, the clear `IconButton` (`variant="ghost" size="sm"`, `aria-label="Clear search"`),
  rendered only when the query is non-empty (R-D10-I; D-72 names the clear button, §6 draws it).
- **Placeholder** (R-D10-P), verbatim:
  `Search — player:"Tank One", floor:m9s,m10s, source:tome, week:3`
- **The pills read the LIVE `query`** via `hasQueryToken`, so a click lights immediately; only
  the *table* and the *hint line* are debounced. A pill that waited 200 ms would read as a
  dropped click.
- **Hint line:** a `role="status"` `text-xs` element in `status-warning` tone, **always mounted,
  text emptied when there is nothing to say** — D9b's lesson that a live region inserted already
  populated is not reliably announced. One line per fact:
  - `Unknown filter "colour" — ignored. Try: player, floor, slot, type, method, week, job, source`
    (plural: `Unknown filters "colour", "size" — ignored. Try: …`)
  - `Unknown source "tomes" — nothing matches. Try: raid, tome, book, material`
  - `Unknown week "three" — nothing matches. Use a week number.`
- **Three pill rows**, all `Tag variant="filter"`, each with a `text-xs uppercase tracking-wide
  text-text-tertiary` label and a `role="group"` + `aria-label`, copying the Priority floor row
  at `Loot.tsx:1000-1015` (R-19):
  - **Type:** `All` · `Gear` (`type:gear`) · `Materials` (`type:materials`), tone `accent`.
    R-47 is why the pill inserts the word on its face.
  - **Floor:** `All` · one pill per `floors[]` entry, tone `floor-{1..4}` by index, token
    `floor:{lowercased floor}`.
  - **Player:** one pill per configured player, tone `accent`, emitting `player:{name}` **always
    quoted** per §3.2.
- No `Week` and no `Source` row (R-D10-A); both keys live in the placeholder instead.

### 3.5 `components/loot/Loot.tsx` — state and placement

```ts
const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 200);              // existing hooks/useDebounce
const parsedQuery = useMemo(() => parseHistoryQuery(debouncedQuery), [debouncedQuery]);
```

`HistorySearch` does **not** go in the toolbar's `weekControl` slot — that slot is a flex row
with the action cluster to its right, and a full-width box plus three wrapping pill rows does not
belong there. `weekControl` becomes `null` on History. Per R-D10-H the block renders **inside the
existing History `grid`** (`Loot.tsx:1050-1060`), immediately above `<LootHistoryTable>` and below
`<FairnessSummary>`.

Two docblock obligations:

1. `Loot.tsx:83-88`'s session-local-filters paragraph is **rewritten, not amended** — it says
   "filters default to all/all/all", a state this slice deletes. The invariant it protects is
   unchanged and must be restated in the new vocabulary: an empty query on first mount shows
   everything, so an `?entry=` deep-link can never be hidden (R-37). `Loot.tsx:16`'s composition
   list drops `HistoryFilters` and gains `HistorySearch`.
2. **New, at the `buildEntryLink` denylist (`Loot.tsx:234-248`):** that function keeps every param
   it does not explicitly delete, so R-37 holds *only* while the query stays out of the URL. The
   absence of a `delete` is load-bearing and must say so, or a later slice URL-backs the query and
   silently reintroduces the failure R-37 describes.

### 3.6 `components/loot/LootHistoryTable.tsx`

`filters: HistoryFilterState` → `query: ParsedHistoryQuery`, and the row memo swaps
`filterHistoryItems(...)` for `filterHistoryItemsByQuery(..., queryCtx)`, where `queryCtx` is
built from the same `playersById` map that already backs `sortCtx`.

**Unchanged and load-bearing:** the `?entry=` highlight resolves `entryFound` against the raw
`lootLog` / `materialLog` props (`:414-421`), never against `rows`. D9b pinned that with a test
plus a control; both stay, and T-9 adds a third case. **The four zero-row strings and the stats
count are R-34-ruled and unchanged this slice** (R-7) — `No entries match your filters.` is
restored byte-for-byte from `AllWeeksView.tsx:534-535`.

---

## 4. Tests

Every new test is **mutation-checked before it is believed** — D9b shipped two that read as
correct and asserted nothing. The two live patterns to check for: a branch that never renders
because rows are on screen, and a mock that writes synchronously during `Promise.all` argument
evaluation.

`utils/historyQuery.test.ts` (new):

- **T-1 tokenizer** — `player:"Tank One"` is one token matching the two-word name; bare
  `player:Tank One` degrades to v1's behaviour (`player:tank` + a free `one`); an **unterminated**
  `player:"Tank` runs to end-of-string; a leading-quote `"player:alice` is a free term (R-15).
- **T-2 alternation (R-36)** — `floor:m9s,m10s` returns both floors; `floor:m9s floor:m10s` still
  returns none, proving repeated keys kept their AND meaning.
- **T-3 quoted alternation** — `player:"Tank One","Healer Two"` returns both players' rows.
- **T-4 aliases (R-47)** — `type:gear` ≡ `type:loot`, `type:materials` ≡ `type:material`,
  `extra`/`bis` survive. Control asserts the **defect being fixed**: v1's comparison returns
  nothing for `type:gear` (`'loot'.includes('gear')` is false, `AllWeeksView.tsx:234`).
- **T-5 `source:` (R-36, R-9)** — all five values carried over from
  `historyItems.test.ts:287-311` as a **move**: `raid` excludes books, `tome` returns both `tome`
  and `purchase` — which `method:tome,purchase` now reaches for the method half, but not
  `source:`'s loot-only gate, so a material logged under either method is swept in by one and not
  the other — `book`, `material`, `all`; plus
  `source:tomes` matches nothing and reports an unknown value (R-D10-K).
- **T-6 neutral colon + unknown key (R-30, R-D10-G)** — `player:` returns **every** row and
  reports no unknown key; `colour:blue` returns every row and reports `colour`; `colour:` also
  reports `colour`; an unknown key never narrows the set.
- **T-7 token writers** — `hasQueryToken` is exact (`player:ali` does not light Tank One) and
  quoting-aware (R-D10-L); toggle adds, toggle again removes, an emptied token disappears, a
  second value joins the comma list rather than repeating the key, whitespace normalises, and a
  player value comes back quoted.
- **T-11 player exactness (R-D10-J)** — with `Tank One` and `Tank One Alt` both on the roster,
  `player:"Tank One"` returns only the first while `player:tank` returns both.

`components/loot/HistorySearch.test.tsx` (new):

- pills light only on exact equality, including the `[All]` pills' "no token of this key" rule;
- clicking a second floor produces one comma token, not two tokens;
- the clear button appears only with a query and empties it;
- the hint line is mounted-but-empty with no unknown key, and renders the key, the `source:` and
  the `week:` messages correctly;
- the placeholder names `week:` and `source:` and does **not** mention `Ctrl+Shift+F` (R-D10-P).

`components/loot/Loot.test.tsx` (updated):

- **T-10 — the acceptance test (R-1).** Render History with rows spanning two floors; click a
  floor pill; assert **both** that the input's `value` now contains `floor:m9s` **and** (after the
  200 ms debounce) that the table narrowed to those rows; clear the box and assert every row
  returns. Mutation check: wiring the table to anything but the parsed box value must kill it.
  This is what proves the dissolution — a spy-based component test would still pass if the table
  kept a second source of truth.
- **T-8 (R-37, R-8).** In `Loot.test.tsx`, where `LootHistoryTable` is real (`:10-12`):
  `fireEvent.change` the **real** input to a non-empty query, open a row kebab → **Copy link**,
  and assert the captured clipboard string carries no `q` and no filter params — mirroring the
  existing copy-link tests at `:817-859`.
- **the R-13/R-15 discriminator must be converted, not dropped (R-10).**
  `Loot.test.tsx:1167-1185` uses `getByRole('button', { name: 'All weeks' })` at `:1177` as its
  *History* discriminator and its absence at `:1184` as its *Log* discriminator. After D10 that
  button does not exist. Replace both with the search box's presence/absence, or the R-15
  regression stops being caught.
- the assembly assert that `Loot` renders `HistorySearch` on History and not on Priority/Log.

`components/loot/LootHistoryTable.test.tsx` (updated):

- **Nine tests construct `filters`** (`:434, 453, 481, 627, 662, 685, 846` and neighbours) and
  must be converted to `ParsedHistoryQuery` fixtures. They carry D9b's four-state ladder and the
  per-week separator counts; **`:846` is the R-34 `?entry=`-against-unfiltered-logs pin the D9b
  row calls out** and survives unchanged in intent.
- **T-9** — an `?entry=` target that the current query filters out is still `entryFound`; D9b's
  existing test and its control stay.

---

## 5. Gates

Run from `frontend/`. Baselines **measured on this branch tip before any code** (identical to
`main` @ `a99da91d` apart from this plan), not carried over from the handoff:

| Gate | Baseline | Target |
|---|---|---|
| `pnpm test` | 233 files / **3001** tests, 0 failing | above 3001 |
| `pnpm lint` | **0 errors / 903 warnings** | unchanged (the ceiling is human-enforced only) |
| `pnpm knip` | **140** unused exported types, **181** unused exports | **+0 or lower** — this slice is a net deletion, so a *rise* means an export shipped without a consumer |
| `pnpm build` (`tsc -b && vite build`) | clean | clean — `tsc --noEmit` is **not** the same check |

Plus `pnpm check:design-system:strict`, `pnpm dupes`, `pnpm tokens:check`.

Live browser pass at `?shell=v2` → Loot → History, desktop: type a query; click each pill row;
round-trip a two-word player name; confirm the neutral colon does not empty the table; confirm
both hint-line messages announce; confirm an `?entry=` deep-link still highlights **while a query
is active**. Screenshots embedded in the PR. Vocabulary check on all new copy — "static", never
"group".

---

## 5a. Review findings folded in

**`redesign-reviewer`, whole branch, pre-commit: spec compliance PASS, no Must-fix.** It confirmed
the four things the slice actually claims — one filter state (the only filter state is
`Loot.tsx`'s `historyQuery` string; `HistorySearch` holds no `useState` at all), V1 untouched
(`git diff` over `components/history/` empty), the shared layer untouched (`ui/Input.tsx`,
`primitives/IconButton.tsx`, `ui/Tag.tsx` absent from the diff), and R-37 holding by construction.
It also re-derived every timing/DOM test rather than reading them, and found the prune's eleven
deleted tests accounted for case by case.

Four Should-fix and eight nits; all dispositioned, **all accepted**. Three were real defects:

| # | Finding | Fix |
|---|---|---|
| **S1** | **Functional bug.** A pill click while an unterminated quote sat in the box appended the new token *inside* the quote — pill unlit, table empty, no hint. `toggleQueryToken`/`removeQueryKey` re-emitted untouched tokens by raw `text` | **Superseded in review round 1** — see §5b. `appendToken` inserts the new token *before* a trailing unterminated one and leaves it verbatim; `serializeToken` quotes any whitespace-bearing value. `emitToken` no longer exists; 4 tests |
| **S2** | **Test pinned the wrong thing.** T-8's comment claimed it would catch a later slice URL-backing the query. It would not — `buildEntryLink` reads `window.location.href`, which `useUrlTabState` never touches under `MemoryRouter` | T-8 now also asserts the **router's** location; mutation-verified by actually URL-backing the query |
| **S3** | **Searchable-but-invisible.** `slot:`/free text matched a stale `weaponJob` on non-weapon rows — the Slot cell hides it (`itemSlot === 'weapon'` gate) because the edit API keeps `weapon_job` after a slot change | `weaponJobOf` gates identically; 1 test |
| **S4** | Free text could not reach `aug {slot}` though `slot:` could — `legs` is the natural query | added, as **R-D10-S**; 1 test |
| **N1** | The hint line re-typed the key and source vocabularies — drift on the discovery surface | `KNOWN_KEYS` / `SOURCE_SUGGESTIONS` exported and derived |
| **N2/N3/N4** | Three wrong doc claims: `h-9` (it is `h-10`), an `All`-pill sentence that stated the opposite of the code, and a stale citation **in a brand-new file** | corrected |
| **N5/N7** | Clear dropped focus to `<body>`; an idle `All` click still rewrote the query | `inputRef` focus restore, `clearKey` guard; 3 tests |
| **N6/N8** | Two overclaiming test titles; two unit cases with no direct heir after the prune | retitled with the reason they cannot assert more; `filter('')` and a cross-key AND restored |

**Every fix is mutation-verified by the controller** — S1, S3, S4, S2, N5 and N7 each kill ≥1 test
when reverted, and each mutation asserted its anchor was present *and unique* first.

⚠ **The harness itself failed twice, both times silently.** A `sed` escaping error made a mutation
a no-op (which reads exactly like a load-bearing test), and a `subprocess` cp1252 decode crash left
a mutation **in the working tree** — caught only because the next command grepped for the fix.
Mutation harnesses now assert their anchor and restore in a `finally`. A mutation that kills 0 is
first evidence about the *mutation*, not the test.

---

## 5b. PR #265 review rounds

The pre-PR reviews (§5a) were not the end of it. Three bot rounds on the PR itself, each after the
previous one looked clean — **Copilot filed new threads on every push**, which is the same pattern
D9b recorded and the reason "0 unresolved threads" is not an exit condition.

| Round | Finding | Disposition |
|---|---|---|
| 1 | **The S1 fix was wrong.** Normalising an unterminated token emitted it **bare**, so `player:"Tank One` became `player:Tank One` → re-tokenized as `player:Tank` + free `One`. A different filter, silently; the one-word regression could not see it | **Fixed at the cause** (`dd4c50e8`): `appendToken` inserts before a trailing open token instead of rewriting it; `serializeToken` quotes any whitespace-bearing value. `emitToken` deleted. +2 tests, both mutation-verified |
| 1 | Plan §3.1's `week:` row still described the `parseInt` behaviour R-D10-R rejected | Fixed |
| 1 | Two configured roster slots sharing a name are one pill and one result set (`SnapshotPlayer.name` has no uniqueness constraint) | **Declined, documented.** An id-bearing token closes it and defeats R-30 — the pills teach a syntax the user can read and retype, and `player:#a3f1c2` is neither. Recorded as R-D10-J's second residual |
| 1 | Release note missing | **Bot race** — reviewed `6a53e736`; the note landed in `26db65c8` |
| 2 | The **D10 row** and **R-37's own heading** still said "`copyLink` strips it" — the mechanism R-D10-F replaced | Fixed (`f9cf2ca2`). Both now state that nothing is stripped and the *absence* of the delete is load-bearing |
| 4 | **Three findings with NO threads**, inside collapsed "Previously missed" sections under a summary reading "Findings: None" — a thread sweep returns 0 and misses all three | See below |
| 4 | `week 3` filtered by "contains a 3". `w3`/`week3` are one token and hit the shorthand regex; `week 3` is **two** terms matched independently, so `week` matched every row and `3` matched any row containing a 3 — a week-4 row on floor `M3S` came back | **Fixed** (`45f5c48c`): `joinWeekShorthand` rejoins an adjacent `week` + digits pair (**R-D10-T**). Deviates from §3.1's v1-verbatim rule deliberately: a *documented* shorthand that silently filters by "contains 3" is a defect, not parity |
| 4 | The release note claimed `source:tome` covers purchases "the old Source filter could not express" — false; the deleted dropdown's Tome option already did | Fixed — the novelty is the **token**, not the grouping |
| 4 | "No `method:` token can express tome-or-purchase" was over-stated — comma alternation reaches the method half | Fixed: what `method:` cannot reach is `source:`'s **loot-only gate** |
| 5 | **The D9b mutation battery's first row could only ever report a compile error.** D10 deleted `filterHistoryItems` and the `filters` prop that row's mutant injects; a non-compiling mutant fails every test in the spec, so it reported a healthy kill count while proving nothing (claude[bot]) | **Fixed**: re-expressed in D10's vocabulary (row 1 now reads **2**), and the script gained an `INVALID MUTANT (did not compile)` verdict so the *class* is detected. The detector was itself verified by re-running the pre-fix mutation and watching it fire. D9b's table is marked superseded with the reason |
| 3 | **This plan and the R-30 build note still described `emitToken`** — the rejected mechanism — inside a bullet framed as a lesson worth carrying forward | Fixed. The bullet now carries the wrong-fix-then-right-fix arc, which is the transferable part |

| 6 | §3.1 still promised free terms are v1-verbatim "including the `w3` / `week 3` shorthand" — which R-D10-T had stopped being true one commit earlier | Fixed: the contract now names **both** deliberate deviations (R-D10-S, R-D10-T) and why each closes a find-surface gap |
| 7 | **The battery accepted a non-unique anchor** — `old not in src` then `replace(old, new, 1)`, so a duplicated anchor mutates the first occurrence and reports a kill for a defect never introduced. The script's own docstring records that exact failure from its first run | Fixed: `count(old) == 1` or `ANCHOR NOT UNIQUE (n)`. **This one contradicted this plan** — §5a claimed every mutation asserts its anchor present *and unique*, true of the ad-hoc harnesses and not of the checked-in battery |
| 7 | R-37 held **both** mechanisms at once: a warning saying nothing is stripped, under a heading and a paragraph both saying `copyLink` strips it | Heading and body now state what shipped; the original wording is kept inline, attributed and dated, so the ruling's history is not rewritten |
| 7 | R-D10-Q's rationale said the implementer "chose exactness" without saying the choice was overruled | Fixed |

**Seven rounds, and the count is the finding.** Two failure modes produced all of them, and neither
is local to a line:

1. **A doc describing the mechanism a ruling was *written* with rather than the one that
   *shipped*** — rounds 2, 3, 6 and part of 7. Each time it was the artifact a future reader would
   most trust: the phase plan's done-marker, the ruling's own heading, a "carry this forward"
   lesson, the free-term contract.
2. **Evidence that looks like protection but cannot fail** — rounds 1, 5 and the rest of 7: a
   mutant that could only ever report a compile error, an anchor check that did not check
   uniqueness, a test whose comment claimed a guarantee its harness could not deliver, and (in my
   own tooling) a `sed` that silently no-opped and a `subprocess` crash that left a mutation in
   the tree.

**The feature never failed a review round.** Every finding was in error handling added *during*
review, or in the audit trail describing it — the same shape D9b had, which is why that shape is
now recorded rather than just fixed.

**The through-line of rounds 2 and 3 is one failure mode: a doc that describes the mechanism a
ruling was *written with* rather than the one that *shipped*.** It bit three times on one branch,
each time in the artifact a future reader would most trust — the phase plan's done-marker, the
ruling's own heading, and a "carry this forward" lesson. An audit trail not re-derived from the
code after the last change is decoration, and this is the second slice running to prove it.

**Round 1 is the D9b lesson repeating exactly:** a fix introduced the next defect, and the cure was
to stop patching the symptom (rewrite the token) and address the cause (never append after an open
quote). The diff got smaller.

---

## 6. Measured results

All run from `frontend/` on the branch tip, by the controller rather than taken from a task report.
Baselines were measured on this branch before any code, not carried from the handoff.

| Gate | `main` @ `a99da91d` | D10 | Δ |
|---|---|---|---|
| `pnpm test` | 233 files / **3001** | 235 files / **3067** | **+2 files / +66** |
| `pnpm lint` | 0 errors / 903 warnings | 0 errors / **903** | **0** |
| `pnpm knip` — unused exported types | 140 | **140** | **+0** |
| `pnpm knip` — unused exports | 181 | **181** | **+0** |
| `pnpm build` (`tsc -b && vite build`) | clean | clean | — |
| `pnpm check:design-system:strict` | clean | clean | — |

**Test accounting.** +66 net = +48 (`historyQuery.test.ts`, new) +24 (`HistorySearch.test.tsx`,
new) +2 (`LootHistoryTable.test.tsx`) +3 (`Loot.test.tsx`) −11 (`historyItems.test.ts`, the pruned
`filterHistoryItems` ×9 and `historyWeeks` ×2). Five of those eleven are the `matchesSource` cases
**moved** into T-5, not lost — verified case by case at review. Nine of the new tests came from the
review round itself (§5a).

**knip holding rather than falling is the expected result**, not a miss: every symbol deleted had a
live consumer, so none of them were on knip's lists to begin with. A *rise* would have meant an
export shipped without one.

**The dissolution, verified by grep.** `HistoryFilters`, `DEFAULT_HISTORY_FILTERS`,
`HistoryFilterState`, `HistorySource`, `filterHistoryItems` and `historyWeeks` have **zero code
references** anywhere in `frontend/src`. The only surviving mentions are prose in docblocks that
describe the deletion. `HistoryFilters.tsx` is deleted (97 lines).

**Mutations re-verified by the controller** (each asserts its anchor exists *and is unique* before
applying, then restores and diffs byte-identical — a `sed` that silently fails to apply looks
exactly like a load-bearing test, and did once this session):

| Mutation | Kills |
|---|---|
| unterminated quote buys exactness again (R-D10-Q) | 1 |
| `week:` accepts `parseInt` slop again (R-D10-R) | 1 |
| repeated-key toggle reverts to first-token-only | 1 |
| multi-fact hint collapsed to one line | 1 |
| `useDebounce` removed from `Loot.tsx` — **T-10's "two clocks" assertion** | 1 (T-10) |

**Live browser pass**, `?shell=v2` → Loot → History, DEVTST, 1440×1100, **zero console errors or
warnings**:

- Comma alternation: M9S then M11S produced the single token `floor:m9s,m11s`, **both** pills lit,
  17 → 8 rows, stats line followed.
- Player exactness (R-D10-J): the Tank One pill emitted `player:"Tank One"` and returned **2 rows,
  Tank One only** — "Tank Two" was *not* swept in by the shared `Tank` prefix.
- Neutral colon (R-30): `player:` returned all **17** rows with an **empty** hint line and the
  Player `All` pill lit — the trailing-colon token is dropped, not applied.
- Hint line: `colour:blue source:tomes week:three` rendered all three messages as separate lines,
  over the byte-preserved `No entries match your filters.`
- **R-37, live:** with `source:tome player:"Tank Two" colour:x` in the box, the kebab's Copy link
  produced `…?tab=gear&lview=history&tier=aac-heavyweight&entry=70` — no query, no filter params,
  `shell` stripped as designed.
- Light theme checked; no token changes in this slice, so it is a spot-check rather than a gate.

Screenshots: `docs/redesign/pr-shots/d10-01…06`, shrunk with `scripts/shrink-pr-shots.py`
(349 KB → **123 KB** total; largest file 32 KB against CI's 120 KB per-file budget).

**Dev DB untouched.** The pass only read; no entry was logged or deleted. D9a's seed (loot 63–72,
materials 24/25/27) is still there and still dirty.
