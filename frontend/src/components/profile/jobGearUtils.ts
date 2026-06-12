import type { GearSnapshot, PlayerJobProfile } from '../../stores/playerProfileStore';

function isSameJob(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left.toUpperCase() === right.toUpperCase());
}

export function hasUsableGearSnapshot(snapshot: GearSnapshot | null | undefined): snapshot is GearSnapshot {
  return Boolean(
    snapshot
    && snapshot.gear.some((slot) => (
      Boolean(slot.equippedItemId)
      || Boolean(slot.equippedItemName)
      || Boolean(slot.equippedItemLevel && slot.equippedItemLevel > 0)
      || Boolean(slot.itemLevel && slot.itemLevel > 0)
    ))
  );
}

export function resolveJobGearSnapshot(
  jobProfile: PlayerJobProfile,
  gearSnapshots: Record<string, GearSnapshot[]>,
): GearSnapshot | null {
  if (
    jobProfile.gearSnapshot
    && isSameJob(jobProfile.gearSnapshot.job, jobProfile.job)
    && hasUsableGearSnapshot(jobProfile.gearSnapshot)
  ) {
    return jobProfile.gearSnapshot;
  }

  let best: GearSnapshot | null = null;
  for (const snapshots of Object.values(gearSnapshots)) {
    for (const snapshot of snapshots) {
      if (!isSameJob(snapshot.job, jobProfile.job)) continue;
      if (!hasUsableGearSnapshot(snapshot)) continue;
      if (!best) {
        best = snapshot;
        continue;
      }
      if (snapshot.syncedAt && (!best.syncedAt || snapshot.syncedAt > best.syncedAt)) {
        best = snapshot;
      }
    }
  }
  return best;
}

export function getJobGearState(jobProfile: PlayerJobProfile, snapshot: GearSnapshot | null): string {
  if (snapshot?.source === 'plugin') return `${snapshot.job} loadout`;
  if (snapshot?.source === 'manual') return 'Manual entry';
  if (snapshot?.source === 'lodestone' || snapshot?.source === 'xivapi' || snapshot?.source === 'tomestone') {
    return 'Current equipped job only';
  }
  if (snapshot) return snapshot.source || 'Unknown source';
  if (jobProfile.readiness === 'needs_gear') return 'No gear saved for this job yet';
  return 'No gear saved for this job yet';
}

export function formatGearSourceLabel(source: string): string {
  switch (source) {
    case 'plugin':
      return 'Plugin';
    case 'tomestone':
    case 'xivapi':
    case 'lodestone':
      return 'Lodestone fallback';
    case 'manual':
      return 'Manual';
    case 'roster_sync':
      return 'Imported';
    default:
      return source || 'Unknown source';
  }
}

function formatAgeWithVerb(value: string | null, verb: string): string {
  if (!value) return `${verb} never`;
  const age = Date.now() - new Date(value).getTime();
  const hour = 3600_000;
  const day = 86400_000;
  if (age < hour) return `${verb} just now`;
  if (age < day) return `${verb} ${Math.floor(age / hour)}h ago`;
  const days = Math.floor(age / day);
  if (days === 1) return `${verb} yesterday`;
  if (days < 7) return `${verb} ${days} days ago`;
  if (days < 30) return `${verb} ${Math.floor(days / 7)} weeks ago`;
  return `${verb} ${Math.floor(days / 30)} months ago`;
}

export function formatGearActivity(snapshot: GearSnapshot): string {
  switch (snapshot.source) {
    case 'plugin':
      return formatAgeWithVerb(snapshot.syncedAt, 'Synced');
    case 'tomestone':
    case 'xivapi':
    case 'lodestone':
      return formatAgeWithVerb(snapshot.syncedAt, 'Refreshed');
    case 'manual':
      return formatAgeWithVerb(snapshot.syncedAt ?? snapshot.updatedAt, 'Updated');
    case 'roster_sync':
      return formatAgeWithVerb(snapshot.syncedAt ?? snapshot.updatedAt, 'Imported');
    default:
      return formatAgeWithVerb(snapshot.syncedAt ?? snapshot.updatedAt, 'Updated');
  }
}

export function getVisibilityLabel(jobProfile: PlayerJobProfile): string {
  if (jobProfile.readiness === 'not_ready') return 'Private';
  if (jobProfile.priority === 'learning' || jobProfile.priority === 'casual') return 'Application only';
  return 'Public';
}
