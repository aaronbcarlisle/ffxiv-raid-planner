/**
 * Every param the page drops from the URL stays dropped (S2a-4a fix wave; R-F-3 rule 1, R-S3-3, E-8,
 * A2-M3, R-D11-B). React Router 7 builds each write from the render-time params, so two writes in one
 * effect flush share a start and the last one wins: the drop that lost comes back, and an effect whose
 * own values did not change never runs again. These are the renders that need two drops at once:
 *
 * - **cold:** the URL arrives with both on the first render;
 * - **seeded:** the same, with the shell's `?tier=` write landing in the same flush, from a setter
 *   captured at its first render, as `NewShell`'s does on a cold entry;
 * - **late:** that stale write lands after the page has settled, so it brings everything back at once;
 * - **mounted:** the URL arrives on a page whose goals have already loaded, so the id's own drop and
 *   the `?edit` drop run in the same flush.
 *
 * The final URL is what counts, so each test waits for the page to go quiet before reading it.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

import { farmEditTitleId } from './farmFocus';
import { fetchGoals, loadedMatrix, panel, renderAt, search, seedPage, setUpPage, tearDownPage } from './__fixtures__/pageHarness';

const TIER = 'aac-heavyweight';

/** The shell's write: `tier` added to the params of the render it was captured in. */
function useStaleTierWrite() {
  const [, setSearchParams] = useSearchParams();
  const stale = useRef(setSearchParams);
  return () =>
    stale.current(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('tier', TIER);
        return params;
      },
      { replace: true },
    );
}

/** Seeds `tier` once, in the effect flush right after the page's. */
function TierSeeder() {
  const seed = useStaleTierWrite();
  const once = useRef(seed);
  useEffect(() => {
    once.current();
  }, []);
  return null;
}

/** The same stale write, when the test says: it restores the URL of the first render. */
function LateTierSeeder() {
  const seed = useStaleTierWrite();
  return (
    <button type="button" onClick={seed}>
      seed tier
    </button>
  );
}

function Jump({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      jump
    </button>
  );
}

/** Lets queued URL writes and their renders land, so a later clobber cannot pass unnoticed. */
async function quiet() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const inFind = () => screen.queryByRole('region', { name: 'Find' }) !== null;
const editBlockOn = (id: string) => document.getElementById(farmEditTitleId(id)) !== null;
const seedTierLate = () => fireEvent.click(screen.getByRole('button', { name: 'seed tier' }));
const jump = () => fireEvent.click(screen.getByRole('button', { name: 'jump' }));

beforeEach(() => {
  setUpPage();
  Element.prototype.scrollIntoView = vi.fn();
  seedPage();
});

afterEach(tearDownPage);

/** Tracks, on the real row, with `pview` and the foreign `?edit` gone and the row's Edit off. */
async function expectHotOpen() {
  await waitFor(() => expect(search().get('track')).toBe('hot'));
  await waitFor(() => expect(search().has('pview')).toBe(false));
  await waitFor(() => expect(search().has('edit')).toBe(false));
  await quiet();
  expect(search().get('track')).toBe('hot');
  expect(search().has('pview')).toBe(false);
  expect(search().has('edit')).toBe(false);
  expect(search().get('tab')).toBe('progress');
  expect(inFind()).toBe(false);
  await waitFor(() => expect(panel()).toBeInTheDocument());
  expect(editBlockOn('hot')).toBe(false);
  expect(editBlockOn('calm')).toBe(false);
}

/** Tracks with no row open: `track` and `edit` both gone, and nothing else disturbed. */
async function expectNoRow() {
  await waitFor(() => expect(search().has('track')).toBe(false));
  await waitFor(() => expect(search().has('edit')).toBe(false));
  await quiet();
  expect(search().has('track')).toBe(false);
  expect(search().has('edit')).toBe(false);
  expect(search().get('tab')).toBe('progress');
  expect(panel()).not.toBeInTheDocument();
}

describe('?pview=find&track=hot&edit=calm: rule 1 and the ?edit drop', () => {
  const URL = '/?tab=progress&pview=find&track=hot&edit=calm';

  it('cold: ends in Tracks on hot, with pview and edit both gone', async () => {
    renderAt(URL);
    await loadedMatrix();
    await expectHotOpen();
  });

  it('cold, with the tier seeded in the same flush: both drops hold, and the tier stays', async () => {
    renderAt(URL, {}, <TierSeeder />);
    await loadedMatrix();
    await expectHotOpen();
    expect(search().get('tier')).toBe(TIER);
  });

  it('with the goals still loading, only the new params re-arm the drops: both still hold', async () => {
    // The seed lands in the first flush, so `pview` and `edit` come back unchanged, and nothing the
    // goals fetch would flip is there to run the effect again.
    fetchGoals.mockReturnValue(new Promise(() => undefined));
    renderAt(URL, {}, <TierSeeder />);
    await waitFor(() => expect(search().get('tier')).toBe(TIER));
    await waitFor(() => expect(search().has('pview')).toBe(false));
    await waitFor(() => expect(search().has('edit')).toBe(false));
    await quiet();
    expect(search().get('track')).toBe('hot');
    expect(search().has('pview')).toBe(false);
    expect(search().has('edit')).toBe(false);
  });

  it('a late stale write brings all of it back: both go again, and the tier stays', async () => {
    renderAt(URL, {}, <LateTierSeeder />);
    await loadedMatrix();
    await expectHotOpen();
    seedTierLate();
    await waitFor(() => expect(search().get('tier')).toBe(TIER));
    await expectHotOpen();
    expect(search().get('tier')).toBe(TIER);
  });

  it('mounted: the same URL arriving on a loaded page ends the same way', async () => {
    renderAt('/?tab=progress', {}, <Jump to={URL} />);
    await loadedMatrix();
    await quiet();
    jump();
    await expectHotOpen();
  });
});

describe('?track=bogus&edit=calm: the stale-id clear and the ?edit drop', () => {
  const URL = '/?tab=progress&track=bogus&edit=calm';

  it('cold: track and edit both go', async () => {
    renderAt(URL);
    await loadedMatrix();
    await expectNoRow();
  });

  it('cold, with the tier seeded in the same flush: both go, and the tier stays', async () => {
    renderAt(URL, {}, <TierSeeder />);
    await loadedMatrix();
    await expectNoRow();
    expect(search().get('tier')).toBe(TIER);
  });

  it('a late stale write brings both back: both go again, and the tier stays', async () => {
    renderAt(URL, {}, <LateTierSeeder />);
    await loadedMatrix();
    await expectNoRow();
    seedTierLate();
    await waitFor(() => expect(search().get('tier')).toBe(TIER));
    await expectNoRow();
    expect(search().get('tier')).toBe(TIER);
  });

  it('mounted: the goals are in, so both drops fall in one flush, and neither is lost', async () => {
    renderAt('/?tab=progress', {}, <Jump to={URL} />);
    await loadedMatrix();
    await quiet();
    jump();
    await expectNoRow();
  });

  it('mounted, with pview too: all three go and the page stays in Tracks (?track won)', async () => {
    renderAt('/?tab=progress', {}, <Jump to="/?tab=progress&pview=find&track=bogus&edit=calm" />);
    await loadedMatrix();
    await quiet();
    jump();
    await expectNoRow();
    expect(search().has('pview')).toBe(false);
    expect(inFind()).toBe(false);
  });
});

describe('?track=tier&edit=calm on a past tier: the tier rule and the ?edit drop (E-8)', () => {
  const URL = '/?tab=progress&track=tier&edit=calm';

  it('cold: track and edit both go', async () => {
    renderAt(URL);
    await loadedMatrix();
    await expectNoRow();
  });

  it('cold, with the tier seeded in the same flush: both go, and the tier stays', async () => {
    renderAt(URL, {}, <TierSeeder />);
    await loadedMatrix();
    await expectNoRow();
    expect(search().get('tier')).toBe(TIER);
  });
});

describe('a drop with ?farm in the same URL (rule 2 writes on its own)', () => {
  it('?farm=catalog&edit=calm: Find opens, and farm and edit are both gone', async () => {
    renderAt('/?tab=progress&farm=catalog&edit=calm', {}, <TierSeeder />);
    await waitFor(() => expect(inFind()).toBe(true));
    await waitFor(() => expect(search().has('edit')).toBe(false));
    await quiet();
    expect(search().get('pview')).toBe('find');
    expect(search().has('farm')).toBe(false);
    expect(search().has('edit')).toBe(false);
    expect(search().get('tier')).toBe(TIER);
  });

  it('?farm=catalog&track=hot&edit=calm: ?track wins, and farm, pview and edit are all gone', async () => {
    renderAt('/?tab=progress&farm=catalog&track=hot&edit=calm', {}, <TierSeeder />);
    await loadedMatrix();
    await waitFor(() => expect(search().has('farm')).toBe(false));
    await expectHotOpen();
    expect(search().get('tier')).toBe(TIER);
  });
});

describe('what must not be dropped', () => {
  it('?pview=find&edit=calm keeps Find and drops only edit', async () => {
    renderAt('/?tab=progress&pview=find&edit=calm');
    await waitFor(() => expect(search().has('edit')).toBe(false));
    await quiet();
    expect(search().get('pview')).toBe('find');
    expect(inFind()).toBe(true);
  });

  it('?track=hot&edit=hot keeps both and opens Edit on the row', async () => {
    renderAt('/?tab=progress&track=hot&edit=hot');
    await loadedMatrix();
    await quiet();
    expect(search().get('track')).toBe('hot');
    expect(search().get('edit')).toBe('hot');
    expect(editBlockOn('hot')).toBe(true);
  });
});
