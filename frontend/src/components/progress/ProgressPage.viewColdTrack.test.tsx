/**
 * ProgressPage's cold `?pview=find&track=<id>` entry (S2a-4a·A4 Task TA4 fix; R-F-3 rule 1, R-D11-B).
 * A cold entry carries no `tier`, and the shell seeds `tier` with its own write in the same tick as
 * the page's rule-1 write (`pview` dropped). React Router 7 builds each write from the render-time
 * params, so the later write used to bring `pview=find` back; the rule-1 effect saw the same
 * (`find`, `track`) pair and never ran again. Here a sibling seeds `tier` from a setter captured at
 * its first render, in the effect flush right after the page's, so the two writes collide as they
 * do live. The final URL is what counts.
 */
import { screen, waitFor } from '@testing-library/react';
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

import { loadedMatrix, panel, renderAt, search, seedPage, setUpPage, tearDownPage } from './__fixtures__/pageHarness';

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

beforeEach(() => {
  setUpPage();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(tearDownPage);

describe('a cold ?pview=find&track entry with the tier seeded in the same tick', () => {
  it('ends in Tracks with the row open, pview gone, tier seeded', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find&track=hot', {}, <TierSeeder />);
    await waitFor(() => expect(search().get('tier')).toBe('aac-heavyweight'));
    await loadedMatrix();
    await waitFor(() => expect(search().has('pview')).toBe(false));
    expect(search().get('track')).toBe('hot');
    expect(search().get('tab')).toBe('progress');
    expect(screen.queryByRole('region', { name: 'Find' })).not.toBeInTheDocument();
    await waitFor(() => expect(panel()).toBeInTheDocument());
  });
});
