import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useAvailabilityStore } from './availabilityStore';
import type { AvailabilityDateSummary } from '../types';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

function resetAvailabilityStore() {
  useAvailabilityStore.setState({
    data: [],
    layeredData: [],
    templateData: [],
    isLoading: false,
    isLoadingTemplate: false,
    error: null,
  });
}

const datedFixture: AvailabilityDateSummary[] = [
  { date: '2026-07-01', responses: [{ id: 'r1', userId: 'u1', username: 'Alice', date: '2026-07-01', slots: ['20:00'], source: 'dated' }] },
];

const layeredFixture: AvailabilityDateSummary[] = [
  { date: '2026-07-01', responses: [{ id: null, userId: 'u2', username: 'Bob', date: '2026-07-01', slots: ['21:00'], source: 'personal_template' }] },
];

describe('availabilityStore fetchAvailability', () => {
  afterEach(() => {
    resetAvailabilityStore();
    vi.clearAllMocks();
  });

  it('with no options: the URL has no include_templates, `data` is set, `layeredData` untouched', async () => {
    vi.mocked(api.get).mockResolvedValue(datedFixture);
    useAvailabilityStore.setState({ layeredData: layeredFixture });

    await useAvailabilityStore.getState().fetchAvailability('g1', '2026-07-01', '2026-07-07');

    const url = vi.mocked(api.get).mock.calls[0][0] as string;
    expect(url).not.toContain('include_templates');
    expect(useAvailabilityStore.getState().data).toEqual(datedFixture);
    expect(useAvailabilityStore.getState().layeredData).toEqual(layeredFixture);
  });

  it('with { includeTemplates: true }: the URL has it, `layeredData` is set and `data` is untouched', async () => {
    vi.mocked(api.get).mockResolvedValue(layeredFixture);
    useAvailabilityStore.setState({ data: datedFixture });

    await useAvailabilityStore.getState().fetchAvailability('g1', '2026-07-01', '2026-07-07', {
      includeTemplates: true,
    });

    const url = vi.mocked(api.get).mock.calls[0][0] as string;
    expect(url).toContain('include_templates=true');
    expect(useAvailabilityStore.getState().layeredData).toEqual(layeredFixture);
    expect(useAvailabilityStore.getState().data).toEqual(datedFixture);
  });

  it('layered: a response from a superseded request is dropped, even if it resolves later', async () => {
    let resolveFirst!: (value: AvailabilityDateSummary[]) => void;
    let resolveSecond!: (value: AvailabilityDateSummary[]) => void;
    const first = new Promise<AvailabilityDateSummary[]>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<AvailabilityDateSummary[]>((resolve) => {
      resolveSecond = resolve;
    });
    vi.mocked(api.get).mockReturnValueOnce(first).mockReturnValueOnce(second);

    const firstFetch = useAvailabilityStore
      .getState()
      .fetchAvailability('g1', '2026-07-01', '2026-07-07', { includeTemplates: true });
    const secondFetch = useAvailabilityStore
      .getState()
      .fetchAvailability('g1', '2026-07-08', '2026-07-14', { includeTemplates: true });

    resolveSecond(layeredFixture);
    await secondFetch;
    resolveFirst([{ date: '2026-06-24', responses: [] }]);
    await firstFetch;

    expect(useAvailabilityStore.getState().layeredData).toEqual(layeredFixture);
    expect(useAvailabilityStore.getState().isLoading).toBe(false);
  });

  it('legacy: a response from a superseded request is dropped, even if it resolves later', async () => {
    let resolveFirst!: (value: AvailabilityDateSummary[]) => void;
    let resolveSecond!: (value: AvailabilityDateSummary[]) => void;
    const first = new Promise<AvailabilityDateSummary[]>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<AvailabilityDateSummary[]>((resolve) => {
      resolveSecond = resolve;
    });
    vi.mocked(api.get).mockReturnValueOnce(first).mockReturnValueOnce(second);

    const firstFetch = useAvailabilityStore
      .getState()
      .fetchAvailability('g1', '2026-07-01', '2026-07-07');
    const secondFetch = useAvailabilityStore
      .getState()
      .fetchAvailability('g1', '2026-07-08', '2026-07-14');

    resolveSecond(datedFixture);
    await secondFetch;
    resolveFirst([{ date: '2026-06-24', responses: [] }]);
    await firstFetch;

    expect(useAvailabilityStore.getState().data).toEqual(datedFixture);
    expect(useAvailabilityStore.getState().isLoading).toBe(false);
  });

  it('clearAvailability empties both `data` and `layeredData`', () => {
    useAvailabilityStore.setState({ data: datedFixture, layeredData: layeredFixture });

    useAvailabilityStore.getState().clearAvailability();

    expect(useAvailabilityStore.getState().data).toEqual([]);
    expect(useAvailabilityStore.getState().layeredData).toEqual([]);
  });
});
