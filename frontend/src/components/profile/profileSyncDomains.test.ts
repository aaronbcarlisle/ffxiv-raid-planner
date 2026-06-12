import { describe, expect, it } from 'vitest';
import { buildProfileSyncDomains } from './profileSyncDomains';

describe('buildProfileSyncDomains', () => {
  it('marks unavailable Player Hub systems as missing or coming later', () => {
    const domains = buildProfileSyncDomains({
      profile: null,
      gearSnapshots: {},
      goals: [],
      personalAvailability: [],
      primaryStatic: null,
    });

    expect(domains.find((domain) => domain.id === 'character')?.status).toBe('Missing');
    expect(domains.find((domain) => domain.id === 'availability')?.status).toBe('Missing');
    expect(domains.find((domain) => domain.id === 'altGear')?.status).toBe('Missing');
    expect(domains.find((domain) => domain.id === 'altGear')?.label).toBe('Alt job gear');
    expect(domains.find((domain) => domain.id === 'staticSnapshot')?.label).toBe('Roster link');
    expect(domains.find((domain) => domain.id === 'applicationSnapshot')?.label).toBe('Ready to apply');
    expect(domains.find((domain) => domain.id === 'applicationSnapshot')?.blockingReason).toContain('Character');
  });

  it('marks a complete profile as ready for application snapshots', () => {
    const domains = buildProfileSyncDomains({
      profile: {
        id: 'profile-1',
        userId: 'user-1',
        visibility: 'shareable',
        shareEnabled: true,
        shareCode: 'ABC123',
        bio: null,
        characters: [{ id: 'char-1', name: 'Test Char', server: 'Gilgamesh', isMain: true }],
        jobProfiles: [{ id: 'job-1', job: 'DNC', role: 'ranged', priority: 'main', readiness: 'ready' }],
        createdAt: '',
        updatedAt: '',
      } as never,
      gearSnapshots: {
        'char-1': [{
          id: 'snap-1',
          characterId: 'char-1',
          job: 'DNC',
          avgItemLevel: 710,
          source: 'plugin',
          syncedAt: new Date().toISOString(),
          gear: [{ slot: 'weapon', equippedItemName: 'Skyruin Chakrams', equippedItemLevel: 710 }],
          createdAt: '',
          updatedAt: '',
        }],
      } as never,
      goals: [],
      personalAvailability: [{ dayOfWeek: 'MO', slots: ['19:00'], timezone: 'Asia/Tokyo' }],
      primaryStatic: {
        id: 'group-1',
        name: 'Open Static',
        shareCode: 'STATIC1',
      } as never,
      staticGroups: [
        { id: 'group-1', name: 'Open Static', shareCode: 'STATIC1' },
        { id: 'group-2', name: 'Weekend Static', shareCode: 'STATIC2' },
      ] as never,
    });

    expect(domains.find((domain) => domain.id === 'mainGear')?.status).toBe('Fresh');
    expect(domains.find((domain) => domain.id === 'availability')?.status).toBe('Manual');
    expect(domains.find((domain) => domain.id === 'sharing')?.status).toBe('Fresh');
    expect(domains.find((domain) => domain.id === 'staticSnapshot')?.whereUsed).toContain('2 statics');
    expect(domains.find((domain) => domain.id === 'staticSnapshot')?.primaryAction).toBe('Use My Statics menu');
    expect(domains.find((domain) => domain.id === 'applicationSnapshot')?.status).toBe('Fresh');
  });
});
