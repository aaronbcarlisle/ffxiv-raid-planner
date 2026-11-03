/**
 * S2a-4a fix wave: "All farm sources" never heads an empty list when Wanted has the match (R-F-5).
 * `all` is the catalog's rows, so a wanted item the catalog lacks (a failed catalog, built from its
 * suggestion row) matches in Wanted alone. The section goes then, with nothing else disturbed.
 */
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../stores/collectionGoalStore';
import type { StaticCollectionSuggestion } from '../../stores/collectionIntentStore';
import { buildFindList, type FindFilters } from '../../utils/findModel';
import { FindList } from './FindList';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';

const NO_FILTERS: FindFilters = { category: null, source: null, expansion: null };

const LYNX: StaticCollectionSuggestion = {
  catalogItemId: 'cat-lynx',
  catalogItemName: 'Lynx of Righteous Fire',
  catalogItemCategory: 'mount',
  expansion: 'dt',
  sourceDutyName: 'Worqor Lar Dor (Extreme)',
  sourceType: 'extreme',
  staticGoalId: null,
  suggestedFarmScore: 5,
  reasonSummary: '',
  members: [{ userId: 'u1', displayName: 'discord-u1', ownershipState: 'missing', intent: 'hunting', tokenCount: null, canBuy: false, confidence: 'high', reasons: [] }],
};

const STEED = {
  id: 'cat-steed',
  externalSource: 'ffxivcollect',
  externalId: null,
  name: 'Abyssal Steed',
  category: 'mount',
  expansion: 'ew',
  patch: '6.0',
  iconUrl: null,
  imageUrl: null,
  sourceText: null,
  sourceType: 'extreme',
  sourceDutyName: 'The Abyssal Fracture (Extreme)',
  sourceDutyKey: 'abyss',
  tokenName: null,
  tokenCost: null,
  tokenItemId: null,
  gameMountId: null,
  tradeable: false,
  rarityOwnedPercent: null,
  isCurated: true,
  notes: null,
} satisfies CatalogItem;

function renderList({ query = '', filters = NO_FILTERS, catalog = [STEED], suggestions = [LYNX], loading = false }: {
  query?: string;
  filters?: FindFilters;
  catalog?: CatalogItem[];
  suggestions?: StaticCollectionSuggestion[];
  loading?: boolean;
}) {
  return render(
    <MemoryRouter initialEntries={['/?tab=progress&pview=find']}>
      <FindList
        list={buildFindList({ catalog, suggestions, goals: [], groupId: 'g1', query, filters })}
        query={query}
        onQuery={vi.fn()}
        filters={filters}
        onFilters={vi.fn()}
        renderAction={() => null}
        names={new Map()}
        expandedId={null}
        onExpand={vi.fn()}
        error={null}
        onRetry={vi.fn()}
        catalogFallback={false}
        onRetryCatalog={vi.fn()}
        searchRef={createRef<HTMLInputElement>()}
        readerIsViewer={false}
        loading={loading}
      />
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
}

const wantedRegion = () => screen.queryByRole('region', { name: /^Wanted by your static/ });
const allRegion = () => screen.queryByRole('region', { name: /^All farm sources/ });

beforeEach(stubCanHover);

describe('a match in Wanted alone', () => {
  it('a search: Wanted lists it, there is no All section, and no "no match" line', () => {
    renderList({ query: 'lynx' });
    expect(screen.getByRole('region', { name: 'Wanted by your static (1)' })).toBeInTheDocument();
    expect(allRegion()).not.toBeInTheDocument();
    expect(screen.queryByText(/No farms match/)).not.toBeInTheDocument();
  });

  it('a filter: the same', () => {
    renderList({ filters: { ...NO_FILTERS, expansion: 'dt' } });
    expect(screen.getByRole('region', { name: 'Wanted by your static (1)' })).toBeInTheDocument();
    expect(allRegion()).not.toBeInTheDocument();
    expect(screen.queryByText(/No farms match/)).not.toBeInTheDocument();
  });

  it('no search at all, with an empty catalog: the same', () => {
    renderList({ catalog: [] });
    expect(screen.getByRole('region', { name: 'Wanted by your static (1)' })).toBeInTheDocument();
    expect(allRegion()).not.toBeInTheDocument();
  });
});

describe('what stays', () => {
  it('a catalog match keeps its section beside Wanted', () => {
    renderList({});
    expect(wantedRegion()).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'All farm sources (1)' })).toBeInTheDocument();
  });

  it('a catalog match alone keeps its section', () => {
    renderList({ query: 'steed' });
    expect(wantedRegion()).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'All farm sources (1)' })).toBeInTheDocument();
  });

  it('nothing matching anywhere keeps the "no match" line, with no section', () => {
    renderList({ query: 'zz' });
    expect(allRegion()).not.toBeInTheDocument();
    expect(screen.getByText('No farms match "zz"')).toBeInTheDocument();
  });

  it('an empty list with nothing wanted and no search still shows the All section (nothing else explains it)', () => {
    renderList({ catalog: [], suggestions: [] });
    expect(screen.getByRole('region', { name: 'All farm sources (0)' })).toBeInTheDocument();
  });
});
