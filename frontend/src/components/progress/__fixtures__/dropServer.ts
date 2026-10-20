/**
 * A fake drops route over a test's mocked `api` (S2a-3a·G3): GET `…/drops` lists the drops,
 * newest first; POST prepends one for the body's recipient and note; DELETE `…/drops/{id}`
 * removes it. Every other GET answers `[]`. `gate()` holds the next POST until released.
 */
import { vi } from 'vitest';
import type { api as Api } from '../../../services/api';
import { apiDrop } from './progressFixtures';

type ApiDrop = ReturnType<typeof apiDrop>;

export function serveDrops(api: typeof Api, initial: ApiDrop[] = []) {
  let drops = [...initial];
  let held: Promise<void> | null = null;
  vi.mocked(api.get).mockImplementation((url: string) => Promise.resolve((url.endsWith('/drops') ? [...drops] : []) as never));
  vi.mocked(api.post).mockImplementation(async (_url: string, body?: unknown) => {
    const { recipient_user_id: recipient, notes } = body as { recipient_user_id: string | null; notes: string | null };
    if (held) await held;
    const created = apiDrop(`d${drops.length + 1}`, recipient, { notes, dropped_at: '2026-10-02T00:00:00Z' });
    drops = [created, ...drops];
    return created as never;
  });
  vi.mocked(api.delete).mockImplementation((url: string) => {
    drops = drops.filter((d) => !url.endsWith(`/drops/${d.id}`));
    return Promise.resolve(undefined as never);
  });
  return {
    list: () => drops,
    /** Holds every POST until the returned release runs. */
    gate: () => {
      let release = () => {};
      held = new Promise<void>((resolve) => {
        release = () => {
          held = null;
          resolve();
        };
      });
      return () => release();
    },
  };
}
