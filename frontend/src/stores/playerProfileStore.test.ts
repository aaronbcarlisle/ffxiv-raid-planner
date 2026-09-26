/**
 * playerProfileStore.fetchProfile — request coordination (PR #282 review).
 *
 * The profile GET has several concurrent owners (V2 AppChrome rail portrait,
 * Profile.tsx mount, JoinRequestModal, post-mutation refreshes). Pins:
 *   • concurrent plain fetches coalesce onto ONE GET, and a settled GET is
 *     never reused;
 *   • a superseded GET's late response never overwrites the newer profile;
 *   • a superseded caller settles only once the newer GET has;
 *   • a post-mutation refresh issues its OWN GET (never joins a pre-mutation
 *     one) and its result wins.
 * Every test resolves its requests in the order that breaks the unguarded
 * store (newest first), so each fails without the fix.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { usePlayerProfileStore, type PlayerProfile } from './playerProfileStore';

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

interface PendingGet {
  resolve: (profile: PlayerProfile) => void;
}

let gets: PendingGet[] = [];

function profileFor(userId: string, characterName = 'Aria Frost'): PlayerProfile {
  return {
    id: `profile-${userId}`,
    userId,
    visibility: 'private',
    shareCode: null,
    shareEnabled: false,
    bio: null,
    characters: [{
      id: 'c1', lodestoneId: '1', name: characterName, server: 'Tonberry', dataCenter: null,
      avatarUrl: null, isMain: true, createdAt: '', updatedAt: '',
    }],
    jobProfiles: [],
    createdAt: '',
    updatedAt: '',
  };
}

/** Lets every queued microtask (store continuations) run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const store = () => usePlayerProfileStore.getState();

beforeEach(() => {
  gets = [];
  vi.mocked(api.get).mockImplementation(
    () => new Promise((resolve) => { gets.push({ resolve: resolve as PendingGet['resolve'] }); }),
  );
  usePlayerProfileStore.setState({ profile: null, loading: false, error: null });
});

afterEach(async () => {
  // Settle anything a failed test left pending so the module-level in-flight
  // slot never leaks into the next test.
  for (const pending of gets) pending.resolve(profileFor('cleanup'));
  await flush();
  vi.clearAllMocks();
});

describe('playerProfileStore.fetchProfile coordination', () => {
  it('coalesces concurrent fetches onto one GET, and never reuses a settled one', async () => {
    const first = store().fetchProfile();
    const second = store().fetchProfile();
    expect(api.get).toHaveBeenCalledTimes(1);

    gets[0].resolve(profileFor('u1'));
    await Promise.all([first, second]);
    expect(store().profile?.userId).toBe('u1');
    expect(store().loading).toBe(false);

    const third = store().fetchProfile();
    expect(api.get).toHaveBeenCalledTimes(2);
    gets[1].resolve(profileFor('u1', 'Refetched'));
    await third;
    expect(store().profile?.characters[0].name).toBe('Refetched');
  });

  it('discards a superseded GET that resolves late (previous-account response)', async () => {
    const preSwitch = store().fetchProfile();
    const postSwitch = store().fetchProfile({ force: true });
    expect(api.get).toHaveBeenCalledTimes(2);

    gets[1].resolve(profileFor('u2'));
    await flush();
    gets[0].resolve(profileFor('u1'));
    await Promise.all([preSwitch, postSwitch]);

    expect(store().profile?.userId).toBe('u2');
    expect(store().loading).toBe(false);
  });

  it('a superseded caller settles only after the newer GET, observing its profile', async () => {
    let olderSettled = false;
    const older = store().fetchProfile().then(() => { olderSettled = true; });
    const newer = store().fetchProfile({ force: true });

    gets[0].resolve(profileFor('u1', 'Stale'));
    await flush();
    expect(olderSettled).toBe(false);
    expect(store().profile).toBeNull();
    expect(store().loading).toBe(true);

    gets[1].resolve(profileFor('u1', 'Fresh'));
    await Promise.all([older, newer]);
    expect(store().profile?.characters[0].name).toBe('Fresh');
  });

  it('a post-mutation refresh issues its own GET and its result survives a late pre-mutation GET', async () => {
    vi.mocked(api.put).mockResolvedValue({});
    const mount = store().fetchProfile();
    const mutation = store().updateCharacter('c1', { isMain: true });
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));

    gets[1].resolve(profileFor('u1', 'After Edit'));
    await mutation;
    expect(store().profile?.characters[0].name).toBe('After Edit');

    gets[0].resolve(profileFor('u1', 'Before Edit'));
    await mount;
    expect(store().profile?.characters[0].name).toBe('After Edit');
  });
});
