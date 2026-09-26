import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HubIdentityHeader } from './HubIdentityHeader';
import type { GearSnapshot, PlayerCharacter, PlayerJobProfile, PlayerProfile } from '../../../stores/playerProfileStore';

const HOUR = 3600_000;
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

function character(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
  return {
    id: 'c1', lodestoneId: '1', name: 'Rin Applicant', server: 'Balmung', dataCenter: 'Crystal',
    avatarUrl: null, isMain: true, createdAt: '', updatedAt: '', ...overrides,
  };
}

function job(overrides: Partial<PlayerJobProfile> = {}): PlayerJobProfile {
  return {
    id: 'j1', job: 'BRD', role: 'ranged', priority: 'main', readiness: 'ready', notes: null,
    gearSnapshotId: null, gearSnapshot: null, bisTargets: [], createdAt: '', updatedAt: '', ...overrides,
  };
}

function profile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    id: 'p1', userId: 'u1', visibility: 'shareable', shareCode: 'P1', shareEnabled: true, bio: null,
    characters: [character()], jobProfiles: [job()], createdAt: '', updatedAt: '', ...overrides,
  };
}

function snapshot(overrides: Partial<GearSnapshot>): GearSnapshot {
  return {
    id: 's', characterId: 'c1', job: 'BRD', gear: [{ slot: 'head', equippedItemId: 1 }], avgItemLevel: 700,
    source: 'plugin', syncedAt: null, lastPluginSeenAt: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

function renderHeader(props: Partial<Parameters<typeof HubIdentityHeader>[0]> = {}) {
  return render(
    <HubIdentityHeader profile={profile()} gearSnapshots={{}} userName="discord-user" staticCount={2} {...props} />,
  );
}

describe('HubIdentityHeader', () => {
  it('shows the main character, world and summary', () => {
    renderHeader({
      profile: profile({
        characters: [character({ id: 'alt', name: 'Alt Char', isMain: false }), character()],
        jobProfiles: [job({ id: 'j2', job: 'DNC', priority: 'flex' }), job()],
      }),
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Rin Applicant' })).toBeInTheDocument();
    expect(screen.getByText('Balmung · Crystal')).toBeInTheDocument();
    expect(screen.getByText('2 characters · 2 jobs · member of 2 statics')).toBeInTheDocument();
    expect(screen.getByText('BRD main')).toBeInTheDocument();
    expect(screen.getByText('Discord linked')).toBeInTheDocument();
    expect(screen.getByText('RA')).toBeInTheDocument();
  });

  it('pluralizes each count independently', () => {
    renderHeader({ staticCount: 1 });
    expect(screen.getByText('1 character · 1 job · member of 1 static')).toBeInTheDocument();
  });

  it('omits the data center when it is not set', () => {
    renderHeader({ profile: profile({ characters: [character({ dataCenter: null })] }) });
    expect(screen.getByText('Balmung')).toBeInTheDocument();
  });

  it('falls back to the user without a character (and without a profile)', () => {
    const { unmount } = renderHeader({ profile: profile({ characters: [], jobProfiles: [] }) });
    expect(screen.getByRole('heading', { level: 1, name: 'discord-user' })).toBeInTheDocument();
    expect(screen.getByText('No character linked yet')).toBeInTheDocument();
    expect(screen.queryByText('Balmung')).toBeNull();
    expect(screen.queryByText(/ main$/)).toBeNull();
    unmount();

    renderHeader({ profile: null });
    expect(screen.getByRole('heading', { level: 1, name: 'discord-user' })).toBeInTheDocument();
    expect(screen.getByText('No character linked yet')).toBeInTheDocument();
    expect(screen.queryByText(/^(Private|Shareable|Discoverable)/)).toBeNull();
  });

  it('dates the plugin chip from the newest usable plugin snapshot only', () => {
    // upper (source: 'PLUGIN', hoursAgo(1)) is the newest when .toLowerCase() is applied;
    // without it, upper would be excluded and 'newest' (3h ago) would win — so the
    // assertion 'Synced 1h ago' is the mutation sentinel for the .toLowerCase() call.
    renderHeader({
      gearSnapshots: {
        c1: [
          snapshot({ id: 'old', syncedAt: hoursAgo(120) }),
          snapshot({ id: 'newest', syncedAt: hoursAgo(200), lastPluginSeenAt: hoursAgo(3) }),
          snapshot({ id: 'lodestone', source: 'lodestone', syncedAt: hoursAgo(0.1) }),
          snapshot({ id: 'unusable', gear: [{ slot: 'head' }], syncedAt: hoursAgo(0.1) }),
        ],
        c2: [snapshot({ id: 'upper', source: 'PLUGIN', syncedAt: hoursAgo(1) })],
      },
    });
    expect(screen.getByText('Plugin · Synced 1h ago')).toBeInTheDocument();
    expect(screen.queryByText('Plugin not synced')).toBeNull();
  });

  it('reads Plugin not synced with only Lodestone or unusable snapshots', () => {
    renderHeader({
      gearSnapshots: {
        c1: [
          snapshot({ source: 'lodestone', syncedAt: hoursAgo(1) }),
          snapshot({ gear: [], syncedAt: hoursAgo(1) }),
        ],
      },
    });
    expect(screen.getByText('Plugin not synced')).toBeInTheDocument();
  });

  it.each([
    ['private', true, 'Private', 'text-text-secondary'],
    ['private', false, 'Private', 'text-text-secondary'],
    ['shareable', true, 'Shareable', 'text-status-info'],
    ['shareable', false, 'Shareable · link off', 'text-status-info'],
    ['discoverable', true, 'Discoverable', 'text-status-success'],
    ['discoverable', false, 'Discoverable · link off', 'text-status-success'],
  ])('visibility %s (share link %s) → %j', (visibility, shareEnabled, label, toneClass) => {
    renderHeader({ profile: profile({ visibility, shareEnabled }) });
    expect(screen.getByText(label)).toHaveClass(toneClass);
  });
});
