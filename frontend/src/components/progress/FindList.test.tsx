/**
 * S2a-4a·A2b TA2b — the Find list (R-F-5 `FindList`; design E-3, D-3, D-10, §3.2, §3.8; P-55,
 * P-64, P-65, P-66, P-67).
 *
 * `FindList({ list, query, onQuery, filters, onFilters, renderAction, names, expandedId, onExpand,
 * footer, error, onRetry, catalogFallback, onRetryCatalog, searchRef })` is presentational: the
 * lists come from the real `buildFindList`, and every change goes out through a callback.
 *
 * Order: the search `Input` "Search farms" (maxLength 200, `searchRef`, a Clear `IconButton`
 * "Clear search" while it has text) → three `role="group"` filter sets "Category", "Source",
 * "Expansion", each with "All" → Clear filters while any is set → "Wanted by your static ({n})" →
 * "All farm sources ({n})" → "No farms match "{q}"" when both are empty → `footer`.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createRef, type ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../stores/collectionGoalStore';
import type { MemberSuggestionEntry, StaticCollectionSuggestion } from '../../stores/collectionIntentStore';
import { buildFindList, type FindFilters } from '../../utils/findModel';
import { FindList } from './FindList';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';

// ── Fixtures ────────────────────────────────────────────────────────────────

const NO_FILTERS: FindFilters = { category: null, source: null, expansion: null };
const P55 = 'Nobody in your static has shared a want yet. Members add wants from Find or their Hub.';

function cat(id: string, over: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id,
    externalSource: 'ffxivcollect',
    externalId: null,
    name: id,
    category: 'mount',
    expansion: 'dt',
    patch: '7.0',
    iconUrl: null,
    imageUrl: null,
    sourceText: null,
    sourceType: 'extreme',
    sourceDutyName: `${id} duty`,
    sourceDutyKey: `${id}-key`,
    tokenName: null,
    tokenCost: null,
    tokenItemId: null,
    gameMountId: null,
    tradeable: false,
    rarityOwnedPercent: null,
    isCurated: true,
    notes: null,
    ...over,
  };
}

function member(userId: string, intent: MemberSuggestionEntry['intent']): MemberSuggestionEntry {
  return {
    userId,
    displayName: `discord-${userId}`,
    ownershipState: 'missing',
    intent,
    tokenCount: null,
    canBuy: false,
    confidence: 'high',
    reasons: [],
  };
}

function sug(catalogItemId: string, score: number, members: MemberSuggestionEntry[]): StaticCollectionSuggestion {
  return {
    catalogItemId,
    catalogItemName: catalogItemId,
    catalogItemCategory: 'mount',
    expansion: 'dt',
    sourceDutyName: `${catalogItemId} duty`,
    sourceType: 'extreme',
    staticGoalId: null,
    suggestedFarmScore: score,
    reasonSummary: '',
    members,
  };
}

const CATALOG = [
  cat('cat-lynx', { name: 'Lynx of Righteous Fire', sourceDutyName: 'Worqor Lar Dor (Extreme)', sourceDutyKey: 'worqor' }),
  cat('cat-music', { name: 'Orchestrion Roll: Ice Moon', category: 'orchestrion', sourceDutyName: 'Worqor Lar Dor (Extreme)', sourceDutyKey: 'worqor' }),
  cat('cat-ult', { name: 'Ultimate Blade', category: 'weapon', sourceType: 'ultimate', sourceDutyName: 'Futures Reborn (Ultimate)', sourceDutyKey: 'fru' }),
  cat('cat-ew', { name: 'Abyssal Steed', expansion: 'ew', sourceDutyName: 'The Abyssal Fracture (Extreme)', sourceDutyKey: 'abyss' }),
];
/** Lynx (score 9) then Abyssal Steed (score 3) are wanted; Music has a member who passed. */
const WANTS = [
  sug('cat-ew', 3, [member('u2', 'interested')]),
  sug('cat-lynx', 9, [member('u1', 'hunting')]),
  sug('cat-music', 1, [member('u1', 'pass')]),
];

function model(over: { suggestions?: StaticCollectionSuggestion[]; query?: string; filters?: FindFilters; catalog?: CatalogItem[] } = {}) {
  return buildFindList({
    catalog: over.catalog ?? CATALOG,
    suggestions: over.suggestions ?? WANTS,
    goals: [],
    groupId: 'g1',
    query: over.query ?? '',
    filters: over.filters ?? NO_FILTERS,
  });
}

type ListProps = ComponentProps<typeof FindList>;

function renderList(over: Partial<ListProps> = {}) {
  const searchRef = createRef<HTMLInputElement>();
  const cb = {
    onQuery: vi.fn(),
    onFilters: vi.fn(),
    onExpand: vi.fn(),
    onRetry: vi.fn(),
    onRetryCatalog: vi.fn(),
  };
  // Spread, so a reader-role prop the list may add (to pass FindRow's readerIsViewer) is welcome.
  const base = {
    list: model(),
    query: '',
    filters: NO_FILTERS,
    renderAction: () => null,
    names: new Map([['u1', 'Aya']]),
    expandedId: null,
    footer: <p data-testid="find-footer">footer</p>,
    error: null,
    catalogFallback: false,
    searchRef,
    readerIsViewer: false,
    ...cb,
    ...over,
  };
  const view = render(
    <MemoryRouter initialEntries={['/?tab=progress&pview=find']}>
      <FindList {...base} />
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
  const rerender = (next: Partial<ListProps>) =>
    view.rerender(
      <MemoryRouter initialEntries={['/?tab=progress&pview=find']}>
        <FindList {...base} {...next} />
      </MemoryRouter>,
    );
  return { ...view, ...cb, searchRef, rerender };
}

const searchBox = () => screen.getByLabelText('Search farms') as HTMLInputElement;
const wantedRegion = () => screen.queryByRole('region', { name: /^Wanted by your static/ });
const allRegion = () => screen.queryByRole('region', { name: /^All farm sources/ });
const group = (name: 'Category' | 'Source' | 'Expansion') => screen.getByRole('group', { name });
const allTag = (g: 'Category' | 'Source' | 'Expansion') => within(group(g)).getByRole('button', { name: /^All\b/ });
const toggles = (root: HTMLElement) =>
  within(root)
    .getAllByRole('button', { name: /^Show details for / })
    .map((b) => b.getAttribute('aria-label')!.replace('Show details for ', ''));
const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

beforeEach(() => {
  stubCanHover();
});

// ── The sections ────────────────────────────────────────────────────────────

describe('the sections', () => {
  it('render in order after the head, with their counts, and the footer last', () => {
    renderList();
    const wanted = screen.getByRole('region', { name: 'Wanted by your static (2)' });
    const all = screen.getByRole('region', { name: 'All farm sources (4)' });
    expect(wanted.tagName).toBe('SECTION');
    expect(all.tagName).toBe('SECTION');
    expect(wanted).toHaveAttribute('aria-labelledby');
    expect(before(searchBox(), group('Category'))).toBe(true);
    expect(before(group('Category'), group('Source'))).toBe(true);
    expect(before(group('Source'), group('Expansion'))).toBe(true);
    expect(before(group('Expansion'), wanted)).toBe(true);
    expect(before(wanted, all)).toBe(true);
    expect(before(all, screen.getByTestId('find-footer'))).toBe(true);
  });

  it('lists the wanted rows in the model\'s order, and every catalog row under All', () => {
    renderList();
    expect(toggles(wantedRegion()!)).toEqual(['Lynx of Righteous Fire', 'Abyssal Steed']);
    expect(toggles(allRegion()!)).toHaveLength(4);
  });

  it('shows P-55\'s line in the wanted section when nothing is wanted and no search or filter is set', () => {
    renderList({ list: model({ suggestions: [] }) });
    const wanted = wantedRegion();
    expect(wanted).not.toBeNull();
    expect(wanted!).toHaveTextContent(P55);
    expect(within(wanted!).queryAllByRole('button', { name: /^Show details for / })).toHaveLength(0);
  });

  it('with a search and nothing wanted, there is no P-55 line and no wanted section', () => {
    renderList({ list: model({ suggestions: [], query: 'lynx' }), query: 'lynx' });
    expect(screen.queryByText(P55)).not.toBeInTheDocument();
    expect(wantedRegion()).not.toBeInTheDocument();
    expect(allRegion()).toBeInTheDocument();
  });

  it('with a filter set and no wanted match, there is no wanted section', () => {
    const filters = { ...NO_FILTERS, category: 'weapon' };
    const list = model({ filters });
    expect(list.anyWanted).toBe(true);
    expect(list.wanted).toHaveLength(0);
    renderList({ list, filters });
    expect(wantedRegion()).not.toBeInTheDocument();
    expect(screen.queryByText(P55)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'All farm sources (1)' })).toBeInTheDocument();
  });

  it('gives every row body a distinct id, though an item shows in both sections', () => {
    renderList({ expandedId: 'cat-lynx' });
    const ids = screen.getAllByRole('button', { name: /^Show details for / }).map((b) => b.getAttribute('aria-controls'));
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    for (const id of ids) expect(document.getElementById(id!)).not.toBeNull();
  });

  it('expands the row named by expandedId and asks onExpand for another', () => {
    const { onExpand } = renderList({ expandedId: 'cat-music' });
    const all = allRegion()!;
    expect(within(all).getByRole('button', { name: 'Show details for Orchestrion Roll: Ice Moon' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(all).getByRole('button', { name: 'Show details for Ultimate Blade' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(within(all).getByRole('button', { name: 'Show details for Ultimate Blade' }));
    expect(onExpand).toHaveBeenCalledWith('cat-ult');
  });

  it('passes the roster names to the rows: the expanded body names Aya', () => {
    renderList({ expandedId: 'cat-music' });
    const t = within(allRegion()!).getByRole('button', { name: 'Show details for Orchestrion Roll: Ice Moon' });
    const body = document.getElementById(t.getAttribute('aria-controls')!)!;
    expect(body).toHaveTextContent(/Aya:/);
    expect(body.textContent).not.toMatch(/discord-/);
  });

  it('renders renderAction\'s output in each row', () => {
    renderList({ renderAction: (i) => <span data-testid={`act-${i.id}`}>act</span> });
    expect(screen.getByTestId('act-cat-ult')).toBeInTheDocument();
    expect(screen.getAllByTestId('act-cat-lynx')).toHaveLength(2);
  });
});

// ── Search (P-65) ───────────────────────────────────────────────────────────

describe('search', () => {
  it('is an input labelled "Search farms", maxLength 200, holding the query, on searchRef', () => {
    const { searchRef } = renderList({ query: 'lyn' });
    expect(searchBox().value).toBe('lyn');
    expect(searchBox()).toHaveAttribute('maxlength', '200');
    expect(searchRef.current).toBe(searchBox());
  });

  it('typing calls onQuery with the raw text: quotes, $, \\u, CRLF and unicode untouched', () => {
    const { onQuery } = renderList();
    const raw = 'a "b" $1 \\u00e9 … Ḁ';
    fireEvent.change(searchBox(), { target: { value: raw } });
    expect(onQuery).toHaveBeenLastCalledWith(raw);
  });

  it('has no Clear while the query is empty', () => {
    renderList();
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('shows Clear search while the query has text, and Clear empties it', () => {
    const list = model({ query: 'lynx' });
    const { onQuery } = renderList({ list, query: 'lynx' });
    expect(toggles(allRegion()!)).toEqual(['Lynx of Righteous Fire']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onQuery).toHaveBeenLastCalledWith('');
  });

  it('an empty match shows "No farms match "{q}"", with the query literal', () => {
    const q = 'zz "x" $1';
    renderList({ list: model({ query: q }), query: q });
    expect(screen.getByText(/No farms match/)).toHaveTextContent(/No farms match ["“]zz "x" \$1["”]/);
  });

  it('shows no no-match message while anything matches', () => {
    renderList({ list: model({ query: 'lynx' }), query: 'lynx' });
    expect(screen.queryByText(/No farms match/)).not.toBeInTheDocument();
  });
});

// ── Filters (P-64, P-66) ────────────────────────────────────────────────────

describe('filters', () => {
  it('has three labelled groups, each with "All" pressed and its other tags not', () => {
    renderList();
    for (const g of ['Category', 'Source', 'Expansion'] as const) {
      expect(allTag(g)).toHaveAttribute('aria-pressed', 'true');
      const others = within(group(g))
        .getAllByRole('button')
        .filter((b) => b !== allTag(g));
      expect(others.length).toBeGreaterThan(0);
      for (const o of others) expect(o).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('a Category tag sets the category and keeps the other two', () => {
    const filters = { ...NO_FILTERS, expansion: 'dt' };
    const { onFilters } = renderList({ list: model({ filters }), filters });
    fireEvent.click(within(group('Category')).getByRole('button', { name: /mount/i }));
    expect(onFilters).toHaveBeenLastCalledWith({ category: 'mount', source: null, expansion: 'dt' });
  });

  it('a Source tag sets the source', () => {
    const { onFilters } = renderList();
    fireEvent.click(within(group('Source')).getByRole('button', { name: /ultimate/i }));
    expect(onFilters).toHaveBeenLastCalledWith({ category: null, source: 'ultimate', expansion: null });
  });

  it('an Expansion tag sets the expansion', () => {
    const { onFilters } = renderList();
    fireEvent.click(within(group('Expansion')).getByRole('button', { name: /endwalker|\bew\b/i }));
    expect(onFilters).toHaveBeenLastCalledWith({ category: null, source: null, expansion: 'ew' });
  });

  it('each group shows its set value pressed and "All" not, and "All" clears only that group', () => {
    const filters = { category: 'mount', source: 'extreme', expansion: 'dt' };
    const { onFilters } = renderList({ list: model({ filters }), filters });
    expect(within(group('Category')).getByRole('button', { name: /mount/i })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group('Source')).getByRole('button', { name: /extreme/i })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group('Expansion')).getByRole('button', { name: /dawntrail|\bdt\b/i })).toHaveAttribute('aria-pressed', 'true');
    for (const g of ['Category', 'Source', 'Expansion'] as const) expect(allTag(g)).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(allTag('Source'));
    expect(onFilters).toHaveBeenLastCalledWith({ category: 'mount', source: null, expansion: 'dt' });
  });

  it('has no Clear filters while none is set', () => {
    renderList();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('Clear filters shows while any is set and resets all three', () => {
    const filters = { category: 'mount', source: null, expansion: 'ew' };
    const { onFilters } = renderList({ list: model({ filters }), filters });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onFilters).toHaveBeenLastCalledWith(NO_FILTERS);
  });
});

// ── Failures (E-5, P-67, §3.8) ──────────────────────────────────────────────

describe('failures', () => {
  it('a suggestions error shows the inline error and Retry in the wanted section; All still lists', () => {
    const { onRetry } = renderList({ list: model({ suggestions: [] }), error: 'Boom "x" $1' });
    const wanted = wantedRegion();
    expect(wanted).not.toBeNull();
    expect(wanted!).not.toHaveTextContent(P55);
    fireEvent.click(within(wanted!).getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(toggles(allRegion()!)).toHaveLength(4);
  });

  it('a catalog fallback puts a line and Retry above the lists', () => {
    const { onRetryCatalog, onRetry } = renderList({ catalogFallback: true });
    const retry = screen.getByRole('button', { name: /Retry/ });
    expect(before(retry, wantedRegion()!)).toBe(true);
    expect(before(retry, allRegion()!)).toBe(true);
    fireEvent.click(retry);
    expect(onRetryCatalog).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('has no Retry with no error and no fallback', () => {
    renderList();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });
});
