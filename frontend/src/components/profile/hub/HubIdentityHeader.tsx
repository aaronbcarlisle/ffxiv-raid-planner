import { Tag, type Tone } from '../../ui/Tag';
import { SafeAvatar } from '../../ui/SafeAvatar';
import { InitialsAvatar } from '../../ui/InitialsAvatar';
import type { GearSnapshot, PlayerProfile } from '../../../stores/playerProfileStore';
import { getInitials } from '../../../utils/initials';
import { formatSyncAge } from '../freshness';
import { hasUsableGearSnapshot } from '../jobGearUtils';

interface HubIdentityHeaderProps {
  profile: PlayerProfile | null;
  gearSnapshots: Record<string, GearSnapshot[]>;
  /** Shown (and used for initials) when no character is linked. */
  userName: string;
  staticCount: number;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function snapshotTime(snapshot: GearSnapshot): string | null {
  return snapshot.lastPluginSeenAt ?? snapshot.syncedAt;
}

/** Newest usable plugin snapshot — the same filter as the Sync section, so the two never disagree. */
function latestPluginSnapshot(gearSnapshots: Record<string, GearSnapshot[]>): GearSnapshot | null {
  let latest: GearSnapshot | null = null;
  let latestMs = -Infinity;
  for (const snapshot of Object.values(gearSnapshots).flat()) {
    if (snapshot.source?.toLowerCase() !== 'plugin' || !hasUsableGearSnapshot(snapshot)) continue;
    const time = snapshotTime(snapshot);
    const ms = time ? new Date(time).getTime() : -Infinity;
    if (!latest || ms > latestMs) {
      latest = snapshot;
      latestMs = ms;
    }
  }
  return latest;
}

function visibilityChip(profile: PlayerProfile): { label: string; tone: Tone } {
  if (profile.visibility === 'private') return { label: 'Private', tone: 'muted' };
  const linkOff = profile.shareEnabled ? '' : ' · link off';
  return profile.visibility === 'shareable'
    ? { label: `Shareable${linkOff}`, tone: 'info' }
    : { label: `Discoverable${linkOff}`, tone: 'success' };
}

export function HubIdentityHeader({ profile, gearSnapshots, userName, staticCount }: HubIdentityHeaderProps) {
  const characters = profile?.characters ?? [];
  const jobProfiles = profile?.jobProfiles ?? [];
  const mainCharacter = characters.find((c) => c.isMain) ?? characters[0];
  const mainJob = jobProfiles.find((j) => j.priority === 'main');
  const name = mainCharacter?.name ?? userName;
  const pluginSnapshot = latestPluginSnapshot(gearSnapshots);
  const visibility = profile ? visibilityChip(profile) : null;

  const summary = mainCharacter
    ? `${plural(characters.length, 'character')} · ${plural(jobProfiles.length, 'job')} · member of ${plural(staticCount, 'static')}`
    : 'No character linked yet';

  return (
    <header className="flex items-center gap-4 py-4">
      <SafeAvatar
        src={mainCharacter?.avatarUrl}
        className="h-16 w-16 flex-none rounded-full object-cover"
        fallback={
          <InitialsAvatar
            initials={getInitials(name)}
            size={64}
            textSize="sm"
            fontWeight="bold"
            className="bg-accent/15 text-accent"
          />
        }
      />
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-bold leading-tight text-text-primary">{name}</h1>
        {mainCharacter && (
          <p className="truncate text-sm text-text-secondary">
            {mainCharacter.server}
            {mainCharacter.dataCenter && ` · ${mainCharacter.dataCenter}`}
          </p>
        )}
        <p className="text-sm text-text-secondary">{summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {mainJob && <Tag variant="label" tone="accent">{`${mainJob.job} main`}</Tag>}
          <Tag variant="label" tone="success">Discord linked</Tag>
          {pluginSnapshot ? (
            <Tag variant="label" tone="success">{`Plugin · ${formatSyncAge(snapshotTime(pluginSnapshot))}`}</Tag>
          ) : (
            <Tag variant="label" tone="muted">Plugin not synced</Tag>
          )}
          {visibility && <Tag variant="label" tone={visibility.tone}>{visibility.label}</Tag>}
        </div>
      </div>
    </header>
  );
}
