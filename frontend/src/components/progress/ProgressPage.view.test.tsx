/**
 * ProgressPage's view rules (S2a-4a·A2 Task TA2; R-F-3, R-F-4, E-1, E-7, D-4, D-5, D-9, C-4): the
 * "Progress view" switch for every role (testid `progress-view-bar`), `?farm=suggested|catalog`
 * mapped to Find once, `?track` winning over `?pview=find`, the switch to Find (the discard guard
 * first, then one write that sets `pview=find` and clears `track` and `edit`, and edit-statuses
 * mode ends), Track a farm for leads, the control count and the DOM order. While `pview=find`
 * the matrix region is an empty `<section aria-label="Find">` (A2b fills it).
 *
 * Every URL assertion reads the FINAL location through the harness's `LocationProbe`: React
 * Router 7 builds each write from the render-time params, so two writes in one handler clobber
 * each other (R-D11-B) and leave a URL these assertions reject.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

import {
  actionOf,
  loadedMatrix,
  menuOf,
  panel,
  pick,
  renderAt,
  search,
  seedPage,
  setUpPage,
  tearDownPage,
  trackOf,
} from './__fixtures__/pageHarness';
import { goal } from './__fixtures__/progressFixtures';

const bar = () => screen.getByTestId('progress-view-bar');
const viewSwitch = () => within(bar()).getByRole('group', { name: 'Progress view' });
const toView = (name: 'Tracks' | 'Find') => fireEvent.click(within(viewSwitch()).getByRole('button', { name }));
const trackAFarm = () => screen.queryByRole('button', { name: 'Track a farm' });
const editStatuses = () => screen.queryByRole('button', { name: 'Edit statuses' });
const findRegion = () => screen.queryByRole('region', { name: 'Find' });
const matrix = () => screen.queryByTestId('progress-matrix');

const discardDialog = () => screen.queryByRole('dialog', { name: 'Discard changes?' });

/** Waits for the page's first paint of the bar (the store is seeded, so the farms are in). */
const ready = () => screen.findByTestId('progress-view-bar');

/**
 * The bar's controls, as a reader meets them: the switch's group is ONE control (C-8), and every
 * other focusable control (buttons, links, form fields) counts once.
 */
function controlsOf(root: HTMLElement): string[] {
  const out: string[] = [];
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[role="group"][aria-label="Progress view"]'));
  for (const g of groups) out.push(`group:${g.getAttribute('aria-label')}`);
  const focusables = root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role="button"], [role="link"]');
  for (const el of Array.from(focusables)) {
    if (groups.some((g) => g.contains(el))) continue;
    out.push(el.getAttribute('aria-label') ?? el.textContent ?? '');
  }
  return out;
}

function Jump({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      jump
    </button>
  );
}

beforeEach(() => {
  setUpPage();
  // jsdom has none.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(tearDownPage);

describe('the switch is there for every role (D-4, E-7)', () => {
  it.each([
    ['an owner', 'owner', true],
    ['a lead', 'lead', true],
    ['a member', 'member', false],
    ['a viewer', 'viewer', false],
  ] as const)('shows %s the "Progress view" switch in progress-view-bar, Tracks pressed', async (_who, userRole, canManage) => {
    seedPage();
    renderAt('/?tab=progress', { userRole, canManage });
    await ready();
    await loadedMatrix();
    expect(within(viewSwitch()).getByRole('button', { name: 'Tracks' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(viewSwitch()).getByRole('button', { name: 'Find' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the switch with no active farm', async () => {
    seedPage({}, [goal('done', { title: 'Done Farm', status: 'complete', completedAt: '2026-10-01T00:00:00Z' })]);
    renderAt('/?tab=progress', { userRole: 'member', canManage: false });
    await ready();
    expect(viewSwitch()).toBeInTheDocument();
  });

  it('gives a member the switch alone, and keeps the old progress-toolbar absent for them', async () => {
    seedPage();
    renderAt('/?tab=progress', { userRole: 'member', canManage: false });
    await ready();
    await loadedMatrix();
    expect(controlsOf(bar())).toEqual(['group:Progress view']);
    expect(screen.queryByTestId('progress-toolbar')).not.toBeInTheDocument();
  });
});

describe('arriving in Find (R-F-3 rules 1 and 2, D-9)', () => {
  it('?pview=find shows an empty Find region in place of the matrix, Find pressed', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find');
    await ready();
    const region = findRegion()!;
    expect(region).toBeInTheDocument();
    expect(region.tagName).toBe('SECTION');
    expect(region).toBeEmptyDOMElement();
    expect(matrix()).not.toBeInTheDocument();
    expect(within(viewSwitch()).getByRole('button', { name: 'Find' })).toHaveAttribute('aria-pressed', 'true');
    expect(search().get('pview')).toBe('find');
  });

  it.each(['catalog', 'suggested'])('?farm=%s opens Find and removes farm, in the final URL', async (farm) => {
    seedPage();
    renderAt(`/?tab=progress&farm=${farm}`);
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    expect(search().has('farm')).toBe(false);
    expect(search().get('tab')).toBe('progress');
    expect(findRegion()).toBeInTheDocument();
    expect(matrix()).not.toBeInTheDocument();
  });

  it('maps ?farm once: switching back to Tracks from it stays in Tracks', async () => {
    seedPage();
    renderAt('/?tab=progress&farm=catalog');
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    toView('Tracks');
    await loadedMatrix();
    expect(search().has('pview')).toBe(false);
    expect(search().has('farm')).toBe(false);
    expect(findRegion()).not.toBeInTheDocument();
  });

  it('leaves another ?farm value in Tracks', async () => {
    seedPage();
    renderAt('/?tab=progress&farm=bogus');
    await ready();
    await loadedMatrix();
    expect(search().has('pview')).toBe(false);
    expect(findRegion()).not.toBeInTheDocument();
  });

  it('?pview=find&track=<id> opens Tracks with that row open, and pview is gone from the final URL', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find&track=hot');
    await screen.findByTestId('progress-expansion');
    await waitFor(() => expect(search().has('pview')).toBe(false));
    expect(trackOf()).toBe('hot');
    expect(search().get('tab')).toBe('progress');
    expect(findRegion()).not.toBeInTheDocument();
    expect(within(viewSwitch()).getByRole('button', { name: 'Tracks' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a ?track that arrives while in Find wins: Tracks, the row open, pview dropped', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', {}, <Jump to="/?tab=progress&pview=find&track=calm" />);
    await ready();
    expect(findRegion()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'jump' }));
    await screen.findByTestId('progress-expansion');
    await waitFor(() => expect(search().has('pview')).toBe(false));
    expect(trackOf()).toBe('calm');
  });
});

describe('switching to Find (R-F-3 rule 3, D-9, C-4)', () => {
  it('with ?track open, leaves pview=find and no track in the final URL, written in place', async () => {
    seedPage();
    renderAt('/?tab=progress&track=hot');
    await screen.findByTestId('progress-expansion');
    toView('Find');
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    expect(search().has('track')).toBe(false);
    expect(search().has('edit')).toBe(false);
    expect(search().get('tab')).toBe('progress');
    expect(actionOf()).toBe('REPLACE');
    expect(panel()).not.toBeInTheDocument();
    expect(findRegion()).toBeInTheDocument();
  });

  it('back to Tracks drops pview and does not reopen the row', async () => {
    seedPage();
    renderAt('/?tab=progress&track=hot');
    await screen.findByTestId('progress-expansion');
    toView('Find');
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    toView('Tracks');
    await loadedMatrix();
    expect(search().has('pview')).toBe(false);
    expect(search().has('track')).toBe(false);
    expect(panel()).not.toBeInTheDocument();
  });

  describe('with a dirty Edit', () => {
    async function dirtyEdit() {
      seedPage();
      renderAt('/?tab=progress&track=hot');
      await screen.findByTestId('progress-expansion');
      fireEvent.click(menuOf('Hot Farm'));
      pick('Edit');
      const block = await screen.findByTestId('progress-edit-block');
      fireEvent.change(within(block).getByRole('textbox', { name: 'Notes' }), { target: { value: 'Edited notes' } });
    }

    it('asks "Discard changes?" first and leaves the URL alone; Keep editing keeps the edit', async () => {
      await dirtyEdit();
      toView('Find');
      expect(discardDialog()).toBeInTheDocument();
      expect(search().has('pview')).toBe(false);
      expect(trackOf()).toBe('hot');

      fireEvent.click(within(discardDialog()!).getByRole('button', { name: 'Keep editing' }));
      expect(discardDialog()).not.toBeInTheDocument();
      expect(search().has('pview')).toBe(false);
      expect(trackOf()).toBe('hot');
      expect(screen.getByTestId('progress-edit-block')).toBeInTheDocument();
      expect(findRegion()).not.toBeInTheDocument();
    });

    it('Discard then switches: pview=find, no track, no edit, in the final URL', async () => {
      await dirtyEdit();
      toView('Find');
      fireEvent.click(within(discardDialog()!).getByRole('button', { name: 'Discard' }));
      await waitFor(() => expect(search().get('pview')).toBe('find'));
      expect(search().has('track')).toBe(false);
      expect(search().has('edit')).toBe(false);
      expect(screen.queryByTestId('progress-edit-block')).not.toBeInTheDocument();
      expect(findRegion()).toBeInTheDocument();
    });
  });

  it('ends edit-statuses mode: Find hides the edit bar, and Tracks again shows "Edit statuses", not Done', async () => {
    seedPage();
    renderAt('/?tab=progress');
    await loadedMatrix();
    fireEvent.click(editStatuses()!);
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();

    toView('Find');
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    expect(screen.queryByTestId('progress-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

    toView('Tracks');
    await loadedMatrix();
    expect(editStatuses()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bo, Hot Farm,/ })).not.toBeInTheDocument();
  });
});

describe('Track a farm (D-5)', () => {
  it.each([
    ['a member', 'member'],
    ['a viewer', 'viewer'],
  ] as const)('is absent for %s', async (_who, userRole) => {
    seedPage();
    renderAt('/?tab=progress', { userRole, canManage: false });
    await ready();
    await loadedMatrix();
    expect(trackAFarm()).not.toBeInTheDocument();
  });

  it.each([
    ['an owner', 'owner'],
    ['a lead', 'lead'],
  ] as const)('is there for %s', async (_who, userRole) => {
    seedPage();
    renderAt('/?tab=progress', { userRole, canManage: true });
    await ready();
    expect(within(bar()).getByRole('button', { name: 'Track a farm' })).toBeInTheDocument();
  });

  it('sets pview=find and clears track in the final URL', async () => {
    seedPage();
    renderAt('/?tab=progress&track=hot');
    await screen.findByTestId('progress-expansion');
    fireEvent.click(trackAFarm()!);
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    expect(search().has('track')).toBe(false);
    expect(search().get('tab')).toBe('progress');
    expect(findRegion()).toBeInTheDocument();
  });
});

describe('the control count (R-F-4, R-S2-17): four or fewer for a lead', () => {
  it('at rest: the switch, Track a farm, Edit statuses', async () => {
    seedPage();
    renderAt('/?tab=progress');
    await loadedMatrix();
    const controls = controlsOf(bar());
    expect(controls.length).toBeLessThanOrEqual(4);
    expect(controls).toEqual(['group:Progress view', 'Track a farm', 'Edit statuses']);
  });

  it('in edit mode: the switch, Track a farm, Mark Need, Done', async () => {
    seedPage();
    renderAt('/?tab=progress');
    await loadedMatrix();
    fireEvent.click(editStatuses()!);
    const controls = controlsOf(bar());
    expect(controls.length).toBeLessThanOrEqual(4);
    expect(controls).toEqual(['group:Progress view', 'Track a farm', 'Mark everyone without a status as Need', 'Done']);
  });

  it('in Find: the switch and Track a farm', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find');
    await ready();
    const controls = controlsOf(bar());
    expect(controls.length).toBeLessThanOrEqual(4);
    expect(controls).toEqual(['group:Progress view', 'Track a farm']);
  });
});

describe('DOM order (D-5)', () => {
  it('is the switch, then Track a farm, then Edit statuses, all inside progress-view-bar', async () => {
    seedPage();
    renderAt('/?tab=progress');
    await loadedMatrix();
    const s = viewSwitch();
    const t = within(bar()).getByRole('button', { name: 'Track a farm' });
    const e = within(bar()).getByRole('button', { name: 'Edit statuses' });
    expect(s.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(t.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The bar comes before the matrix, so Tab from Edit statuses still reaches the tier row.
    expect(bar().compareDocumentPosition(matrix()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
