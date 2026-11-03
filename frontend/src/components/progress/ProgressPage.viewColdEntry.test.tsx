/**
 * ProgressPage's cold `?farm` entry (S2a-4a·A2 Task TA2 fix; R-F-3 rule 2, R-D11-B). A cold entry
 * to `?tab=progress&farm=catalog` carries no `tier`, and the shell seeds `tier` with its own
 * write (`NewShell`'s tier-selection effect) in the same tick as the page's `?farm` mapping.
 * React Router 7 builds each write from the render-time params, so the later write used to
 * clobber the earlier one and the page stayed in Tracks with `farm` still in the URL. Here a
 * sibling seeds `tier` from a setter captured at its first render, in the effect flush right
 * after the page's, so the two writes collide as they do live. The final URL is what counts.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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

import { loadedMatrix, renderAt, search, seedPage, setUpPage, tearDownPage } from './__fixtures__/pageHarness';

/** Seeds `tier` once, on mount, through the setter of its FIRST render (stale by the time it runs). */
function TierSeeder() {
  const [, setSearchParams] = useSearchParams();
  const stale = useRef(setSearchParams);
  useEffect(() => {
    stale.current(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('tier', 'aac-heavyweight');
        return params;
      },
      { replace: true },
    );
  }, []);
  return null;
}

const findRegion = () => screen.queryByRole('region', { name: 'Find' });

beforeEach(() => {
  setUpPage();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(tearDownPage);

describe('a cold ?farm entry with the tier seeded in the same tick', () => {
  it.each(['catalog', 'suggested'])('?farm=%s ends in Find, farm removed, tier seeded', async (farm) => {
    seedPage();
    renderAt(`/?tab=progress&farm=${farm}`, {}, <TierSeeder />);
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    expect(search().has('farm')).toBe(false);
    expect(search().get('tier')).toBe('aac-heavyweight');
    expect(search().get('tab')).toBe('progress');
    expect(findRegion()).toBeInTheDocument();
  });

  it('still maps once: back to Tracks stays in Tracks', async () => {
    seedPage();
    renderAt('/?tab=progress&farm=catalog', {}, <TierSeeder />);
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    fireEvent.click(screen.getByRole('button', { name: 'Tracks' }));
    await loadedMatrix();
    expect(search().has('pview')).toBe(false);
    expect(search().has('farm')).toBe(false);
    expect(search().get('tier')).toBe('aac-heavyweight');
  });
});
