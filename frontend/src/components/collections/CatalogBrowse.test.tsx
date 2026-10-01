// ROLE-1 R-R1-9: the catalog's "Track" button follows the server — creating a
// collection goal is lead-only — so it is hidden for non-managers in BOTH
// shells. A catalog fallback still hides it for a STATE reason (R-R1-0).
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogBrowse } from './CatalogBrowse';
import { CollectionsHub } from './CollectionsHub';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CatalogItem } from '../../stores/collectionGoalStore';

// CollectionsHub mounts Modals, whose useDevice reads matchMedia (jsdom has none).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function makeItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'item-1',
    externalSource: 'test',
    externalId: null,
    name: 'Shiny Test Mount',
    category: 'mount',
    expansion: 'dt',
    patch: null,
    iconUrl: null,
    imageUrl: null,
    sourceText: null,
    sourceType: 'extreme',
    sourceDutyName: 'Test Trial',
    sourceDutyKey: 'test-trial',
    tokenName: null,
    tokenCost: null,
    tokenItemId: null,
    gameMountId: null,
    tradeable: null,
    rarityOwnedPercent: null,
    isCurated: true,
    notes: null,
    ...overrides,
  };
}

// Orchestrion present so CatalogBrowse doesn't append the curated fallback's
// orchestrion rows — that would add Track buttons from non-live items.
const liveCatalog: CatalogItem[] = [
  makeItem(),
  makeItem({ id: 'item-2', name: 'Test Music Roll', category: 'orchestrion', sourceDutyKey: 'test-trial-2', sourceDutyName: 'Test Trial 2' }),
];

function seedStore(overrides: Record<string, unknown> = {}) {
  useCollectionGoalStore.setState({
    catalog: liveCatalog,
    catalogLoaded: true,
    catalogLoading: false,
    catalogError: null,
    fetchCatalog: vi.fn().mockResolvedValue(undefined),
    fetchGoals: vi.fn().mockResolvedValue(undefined),
    fetchParticipants: vi.fn().mockResolvedValue(undefined),
    goals: [],
    ...overrides,
  });
}

beforeEach(() => {
  seedStore();
});

describe('CatalogBrowse — Track follows canManage (R-R1-9)', () => {
  it('canManage false: no Track button on an untracked reward', () => {
    render(<CatalogBrowse groupId="g1" activeGoals={[]} canManage={false} />);
    expect(screen.getByText('Shiny Test Mount', { selector: 'span.flex-1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Track/ })).not.toBeInTheDocument();
  });

  it('canManage true: Track is present on an untracked reward (pin)', () => {
    render(<CatalogBrowse groupId="g1" activeGoals={[]} canManage />);
    expect(screen.getAllByRole('button', { name: /Track/ }).length).toBeGreaterThan(0);
  });

  it('canManage true on the catalog fallback: still no Track (state, pin)', () => {
    seedStore({ catalog: [], catalogError: 'down' });
    render(<CatalogBrowse groupId="g1" activeGoals={[]} canManage />);
    expect(screen.getByText(/showing built-in curated farms/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Track/ })).not.toBeInTheDocument();
  });
});

describe('CollectionsHub — passes canManage into the catalog sub-view (R-R1-9)', () => {
  function renderHub(canManage: boolean) {
    return render(
      <MemoryRouter initialEntries={['/?farm=catalog']}>
        <CollectionsHub groupId="g1" currentUserId="me" canManage={canManage} isViewer={false} />
      </MemoryRouter>,
    );
  }

  it('canManage false: no Track on the catalog tab', () => {
    renderHub(false);
    expect(screen.getByText('Shiny Test Mount', { selector: 'span.flex-1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Track/ })).not.toBeInTheDocument();
  });

  it('canManage true: Track is present on the catalog tab (pin)', () => {
    renderHub(true);
    expect(screen.getAllByRole('button', { name: /Track/ }).length).toBeGreaterThan(0);
  });
});
