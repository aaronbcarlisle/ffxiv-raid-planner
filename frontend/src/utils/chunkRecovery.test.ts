import { describe, expect, it, vi } from 'vitest';

import {
  attemptChunkReload,
  buildChunkRecoveryUrl,
  clearChunkReloadGuard,
  hasAttemptedChunkReload,
  isChunkLoadError,
} from './chunkRecovery';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('chunk recovery', () => {
  it('detects dynamic import failures from Vite/browser messages', () => {
    expect(isChunkLoadError(new Error('error loading dynamically imported module: https://www.xivraidplanner.app/assets/GroupView-D4tlpFl.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('ChunkLoadError: Loading chunk GroupView failed'))).toBe(true);
  });

  it('does not classify normal runtime errors as stale chunks', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('adds a cache-busting refresh parameter', () => {
    expect(buildChunkRecoveryUrl('https://www.xivraidplanner.app/group/ABC?tab=schedule', 123)).toBe(
      'https://www.xivraidplanner.app/group/ABC?tab=schedule&refresh=123',
    );
  });

  it('reload guard prevents repeated automatic reload attempts', () => {
    const storage = createStorage();
    const assign = vi.fn();
    const win = {
      location: {
        href: 'https://www.xivraidplanner.app/dashboard',
        assign,
      },
      sessionStorage: storage,
    };

    expect(attemptChunkReload(win)).toBe(true);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(hasAttemptedChunkReload(storage)).toBe(true);
    expect(attemptChunkReload(win)).toBe(false);
    expect(assign).toHaveBeenCalledTimes(1);

    clearChunkReloadGuard(storage);
    expect(hasAttemptedChunkReload(storage)).toBe(false);
  });
});
