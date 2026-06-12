import type { GearSnapshot, PlayerGoal, PlayerProfile } from '../../stores/playerProfileStore';
import type { StaticGroupListItem } from '../../types';
import type { PersonalAvailabilityDay } from '../../stores/personalAvailabilityStore';
import { COLLECTION_GOAL_TYPES } from '../../stores/playerProfileStore';
import { getFreshness } from './freshness';
import { hasUsableGearSnapshot } from './jobGearUtils';

export type ProfileDataDomain =
  | 'character'
  | 'mainGear'
  | 'altGear'
  | 'collections'
  | 'availability'
  | 'sharing'
  | 'staticSnapshot'
  | 'applicationSnapshot';

export type ProfileDomainStatus = 'Fresh' | 'Recent' | 'Stale' | 'Missing' | 'Manual' | 'Coming later';
export type ProfileDomainSource = 'Plugin' | 'Lodestone' | 'Tomestone' | 'Manual' | 'Player Hub' | 'Not set';

export interface ProfileSyncDomain {
  id: ProfileDataDomain;
  label: string;
  status: ProfileDomainStatus;
  source: ProfileDomainSource;
  lastSyncedAt?: string | null;
  whereUsed: string;
  primaryAction: string;
  targetTab?: 'sync' | 'jobs-gear' | 'collections' | 'availability' | 'preview';
  blockingReason?: string;
}

function latestSnapshot(gearSnapshots: Record<string, GearSnapshot[]>): GearSnapshot | null {
  let latest: GearSnapshot | null = null;
  for (const snapshots of Object.values(gearSnapshots)) {
    for (const snapshot of snapshots) {
      if (!hasUsableGearSnapshot(snapshot)) continue;
      if (!latest || (snapshot.syncedAt && (!latest.syncedAt || snapshot.syncedAt > latest.syncedAt))) {
        latest = snapshot;
      }
    }
  }
  return latest;
}

function gearStatus(snapshot: GearSnapshot | null): ProfileDomainStatus {
  if (!snapshot?.syncedAt || !hasUsableGearSnapshot(snapshot)) return 'Missing';
  const freshness = getFreshness(snapshot.syncedAt);
  if (freshness === 'fresh') return 'Fresh';
  if (freshness === 'recent') return 'Recent';
  return 'Stale';
}

export function buildProfileSyncDomains({
  profile,
  gearSnapshots,
  goals,
  personalAvailability,
  primaryStatic,
  staticGroups,
}: {
  profile: PlayerProfile | null;
  gearSnapshots: Record<string, GearSnapshot[]>;
  goals: PlayerGoal[];
  personalAvailability: PersonalAvailabilityDay[];
  primaryStatic?: StaticGroupListItem | null;
  staticGroups?: StaticGroupListItem[];
}): ProfileSyncDomain[] {
  const characters = profile?.characters ?? [];
  const jobs = profile?.jobProfiles ?? [];
  const mainSnapshot = latestSnapshot(gearSnapshots);
  const usableSnapshots = Object.values(gearSnapshots).flat().filter(hasUsableGearSnapshot);
  const hasAltGear = jobs.some((job) => (
    job.priority !== 'main'
    && usableSnapshots.some((snapshot) => snapshot.job.toUpperCase() === job.job.toUpperCase())
  ));
  const mainSource = mainSnapshot?.source === 'plugin'
    ? 'Plugin'
    : mainSnapshot?.source === 'manual'
      ? 'Manual'
      : mainSnapshot
        ? 'Lodestone'
        : 'Not set';
  const hasCollectionGoals = goals.some((goal) => COLLECTION_GOAL_TYPES.includes(goal.goalType as never));
  const configuredAvailabilityDays = personalAvailability.filter((day) => day.slots.length > 0).length;
  const staticCount = staticGroups?.length ?? (primaryStatic ? 1 : 0);
  const sharingReady = !!profile?.shareEnabled && profile.visibility !== 'private' && !!profile.shareCode;
  const readinessReady = characters.length > 0
    && jobs.some((job) => job.priority === 'main')
    && !!mainSnapshot
    && jobs.some((job) => job.readiness !== 'unknown')
    && sharingReady;

  return [
    {
      id: 'character',
      label: 'Character',
      status: characters.length > 0 ? 'Fresh' : 'Missing',
      source: characters.length > 0 ? 'Lodestone' : 'Not set',
      whereUsed: 'Identity for applications, public previews, and roster links.',
      primaryAction: characters.length > 0 ? 'Manage linked character' : 'Link character',
      targetTab: 'sync',
      blockingReason: characters.length === 0 ? 'No linked character yet.' : undefined,
    },
    {
      id: 'mainGear',
      label: 'Main job gear',
      status: gearStatus(mainSnapshot),
      source: mainSource,
      lastSyncedAt: mainSnapshot?.syncedAt,
      whereUsed: 'Applications, roster links, and profile previews.',
      primaryAction: mainSnapshot ? 'Refresh status' : 'Check gear',
      targetTab: 'jobs-gear',
      blockingReason: characters.length === 0 ? 'Link a character before syncing gear.' : undefined,
    },
    {
      id: 'altGear',
      label: 'Alt job gear',
      status: hasAltGear ? 'Recent' : 'Missing',
      source: hasAltGear ? 'Plugin' : 'Not set',
      whereUsed: 'Plugin uploads can store one gear set per job. Lodestone fallback only refreshes the current equipped job.',
      primaryAction: 'Manage jobs',
      targetTab: 'jobs-gear',
    },
    {
      id: 'collections',
      label: 'Collections',
      status: hasCollectionGoals ? 'Manual' : 'Missing',
      source: hasCollectionGoals ? 'Manual' : 'Not set',
      whereUsed: 'Farm recommendations and future static matching.',
      primaryAction: 'Open collections',
      targetTab: 'collections',
      blockingReason: hasCollectionGoals ? undefined : 'No collection farm progress yet.',
    },
    {
      id: 'availability',
      label: 'Availability',
      status: configuredAvailabilityDays > 0 ? 'Manual' : 'Missing',
      source: configuredAvailabilityDays > 0 ? 'Manual' : 'Not set',
      whereUsed: 'Schedule quick fill and future schedule fit checks.',
      primaryAction: configuredAvailabilityDays > 0 ? 'Edit availability' : 'Set availability',
      targetTab: 'availability',
      blockingReason: configuredAvailabilityDays === 0 ? 'No personal weekly default set.' : undefined,
    },
    {
      id: 'sharing',
      label: 'Sharing',
      status: sharingReady ? 'Fresh' : 'Missing',
      source: sharingReady ? 'Player Hub' : 'Not set',
      whereUsed: 'Controls what static leads can preview.',
      primaryAction: 'Configure sharing',
      targetTab: 'preview',
      blockingReason: sharingReady ? undefined : 'Profile preview is private or not enabled.',
    },
    {
      id: 'staticSnapshot',
      label: 'Roster link',
      status: staticCount > 0 ? 'Manual' : 'Missing',
      source: staticCount > 0 ? 'Player Hub' : 'Not set',
      whereUsed: staticCount > 1
        ? `Connected to ${staticCount} statics.`
        : 'Keeps your static roster identity connected.',
      primaryAction: staticCount > 1 ? 'Use My Statics menu' : primaryStatic ? 'Open static' : 'Find a static',
      targetTab: primaryStatic ? undefined : 'sync',
      blockingReason: staticCount > 0 ? undefined : 'Join or create a static to connect roster links.',
    },
    {
      id: 'applicationSnapshot',
      label: 'Ready to apply',
      status: readinessReady ? 'Fresh' : 'Missing',
      source: readinessReady ? 'Player Hub' : 'Not set',
      whereUsed: 'Request to Join keeps a copy of what you chose to share.',
      primaryAction: readinessReady ? 'Open Static Finder' : 'Complete setup',
      targetTab: readinessReady ? undefined : 'preview',
      blockingReason: readinessReady ? undefined : 'Character, main job, gear, readiness, and sharing are not all ready.',
    },
  ];
}
