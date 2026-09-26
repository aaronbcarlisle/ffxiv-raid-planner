/**
 * HubSideCards — the three side cards in Overview column 3.
 * R-PH1-F: Characters · Your availability · Profile setup (hidden when done).
 */

import { useEffect, useState } from 'react';
import { CardShell } from '../../ui/CardShell';
import { Button } from '../../primitives/Button';
import { LinkText } from '../../ui/LinkText';
import { SafeAvatar } from '../../ui/SafeAvatar';
import { InitialsAvatar } from '../../ui/InitialsAvatar';
import { Tag } from '../../ui/Tag';
import { ProgressBar } from '../../ui/ProgressBar';
import { EmptyStateInvite } from '../../ui/EmptyStateInvite';
import { usePersonalAvailabilityStore } from '../../../stores/personalAvailabilityStore';
import { usePlayerProfileStore } from '../../../stores/playerProfileStore';
import { getInitials } from '../../../utils/initials';
import { formatSyncAge, formatSource } from '../freshness';
import { hasUsableGearSnapshot } from '../jobGearUtils';
import { deriveProfileSetup } from './profileSetup';
import type { GearSnapshot, PlayerProfile } from '../../../stores/playerProfileStore';
import type { HubTab } from './hubTabs';

/** local day abbreviations — not copied from any existing file (R-PH1-F, R-PH1-K). */
const DAY_ABBR: Record<string, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
};

interface HubSideCardsProps {
  profile: PlayerProfile | null;
  gearSnapshots: Record<string, GearSnapshot[]>;
  onOpenLinkModal: () => void;
  onAddJob: () => void;
  setTab: (tab: HubTab) => void;
}

/** Newest usable gear snapshot across all characters and sources. */
function newestUsableSnapshot(gearSnapshots: Record<string, GearSnapshot[]>): GearSnapshot | null {
  let latest: GearSnapshot | null = null;
  for (const snaps of Object.values(gearSnapshots)) {
    for (const snap of snaps) {
      if (!hasUsableGearSnapshot(snap)) continue;
      const t = snap.syncedAt ?? snap.createdAt;
      if (!latest || t > (latest.syncedAt ?? latest.createdAt)) latest = snap;
    }
  }
  return latest;
}

// ─── Characters Card ────────────────────────────────────────────────────────

function CharactersCard({
  profile,
  gearSnapshots,
  onOpenLinkModal,
  setTab,
}: {
  profile: PlayerProfile | null;
  gearSnapshots: Record<string, GearSnapshot[]>;
  onOpenLinkModal: () => void;
  setTab: (tab: HubTab) => void;
}) {
  const fetchProfile = usePlayerProfileStore((s) => s.fetchProfile);
  const error = usePlayerProfileStore((s) => s.error);
  const characters = profile?.characters ?? [];
  const mainChar = characters.find((c) => c.isMain) ?? characters[0];
  const alts = characters.filter((c) => c !== mainChar);
  const ordered = mainChar ? [mainChar, ...alts] : characters;

  const gearSnap = newestUsableSnapshot(gearSnapshots);
  // Use syncedAt ?? createdAt for display (same rule as the pick comparison)
  const gearLine = gearSnap
    ? `Gear · ${formatSyncAge(gearSnap.syncedAt ?? gearSnap.createdAt)} · ${formatSource(gearSnap.source)}`
    : 'No gear saved yet';

  // Error branch: a failed profile load is distinct from "no character linked yet".
  // Show Retry immediately without falsely suggesting the user must link a character.
  if (error) {
    return (
      <CardShell title="Characters" as="div">
        <p className="text-xs text-status-error mb-2">Failed to load profile.</p>
        <Button variant="ghost" size="xs" onClick={() => void fetchProfile()}>Retry</Button>
      </CardShell>
    );
  }

  if (characters.length === 0) {
    return (
      <CardShell title="Characters" as="div">
        <EmptyStateInvite
          title="No character linked"
          description="Link your Lodestone character to get started."
          action={{ label: 'Link character', onClick: onOpenLinkModal }}
        />
      </CardShell>
    );
  }

  return (
    <CardShell title="Characters" as="div">
      <ul className="flex flex-col gap-2 mb-3">
        {ordered.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <SafeAvatar
              src={c.avatarUrl}
              alt=""
              className="h-6 w-6 flex-none rounded-full object-cover"
              fallback={
                <InitialsAvatar
                  initials={getInitials(c.name)}
                  size={24}
                  className="bg-accent/15 text-accent"
                  textSize="2xs"
                />
              }
            />
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{c.name}</span>
            <span className="text-xs text-text-muted truncate">{c.server}</span>
            {c.isMain && <Tag variant="label" tone="accent">Main</Tag>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted mb-2">{gearLine}</p>
      <LinkText onClick={() => setTab('characters')}>Manage →</LinkText>
    </CardShell>
  );
}

// ─── Your Availability Card ─────────────────────────────────────────────────

function AvailabilityCard({ setTab }: { setTab: (tab: HubTab) => void }) {
  const { days, fetchPersonalAvailability } = usePersonalAvailabilityStore();

  useEffect(() => {
    fetchPersonalAvailability();
  }, [fetchPersonalAvailability]);

  const configured = days.filter((d) => d.slots.length > 0);
  let summary = 'Not set yet';
  if (configured.length > 0) {
    const hours = configured.reduce((t, d) => t + d.slots.length, 0) / 2;
    const dayLabels = configured.map((d) => DAY_ABBR[d.dayOfWeek] ?? d.dayOfWeek).join(' / ');
    const hStr = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
    summary = `${configured.length} day${configured.length !== 1 ? 's' : ''} · ${hStr}h · ${dayLabels}`;
  }

  return (
    <CardShell title="Your availability" as="div">
      <p className="text-sm text-text-secondary mb-2">{summary}</p>
      <LinkText onClick={() => setTab('availability')}>Edit →</LinkText>
    </CardShell>
  );
}

// ─── Profile Setup Card ─────────────────────────────────────────────────────

function ProfileSetupCard({
  profile,
  gearSnapshots,
  onOpenLinkModal,
  onAddJob,
  setTab,
}: {
  profile: PlayerProfile | null;
  gearSnapshots: Record<string, GearSnapshot[]>;
  onOpenLinkModal: () => void;
  onAddJob: () => void;
  setTab: (tab: HubTab) => void;
}) {
  const error = usePlayerProfileStore((s) => s.error);
  const { days } = usePersonalAvailabilityStore();
  const [showChecklist, setShowChecklist] = useState(false);

  // When the profile load errored, don't render "Link character" — that would
  // mislead the user into thinking they haven't linked yet (R-PH1-F).
  if (error) return null;

  const setup = deriveProfileSetup(profile, gearSnapshots, days, {
    onOpenLinkModal,
    onAddJob,
    setTab,
  });

  if (setup.allDone) return null;

  const allItems = [...setup.checks, ...setup.optionalChecks];

  return (
    <CardShell title="Profile setup" as="div">
      <ProgressBar
        value={setup.readyPct / 100}
        ariaLabel="Profile setup progress"
        className="mb-2"
      />
      <p className="text-xs text-text-muted mb-3">{setup.completedCount} of {setup.totalCount} done</p>

      {setup.nextStep && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-sm text-text-secondary">{setup.nextStep.label}</span>
          <Button variant="accent-subtle" size="xs" onClick={setup.nextStep.action}>
            {setup.nextStep.label}
          </Button>
        </div>
      )}

      <Button
        variant="ghost"
        size="xs"
        trailing="chevron"
        aria-expanded={showChecklist}
        onClick={() => setShowChecklist((v) => !v)}
      >
        {showChecklist ? 'Hide checklist' : 'Show checklist'}
      </Button>

      {showChecklist && (
        <ul className="mt-2 flex flex-col gap-1">
          {allItems.map((c) => (
            <li key={c.key} className={`flex items-center gap-2 text-xs ${c.done ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
              <span aria-hidden="true">{c.done ? '✓' : '○'}</span>
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

// ─── Exported composite ─────────────────────────────────────────────────────

export function HubSideCards({ profile, gearSnapshots, onOpenLinkModal, onAddJob, setTab }: HubSideCardsProps) {
  return (
    <div className="flex flex-col gap-4 self-start">
      <CharactersCard
        profile={profile}
        gearSnapshots={gearSnapshots}
        onOpenLinkModal={onOpenLinkModal}
        setTab={setTab}
      />
      <AvailabilityCard setTab={setTab} />
      <ProfileSetupCard
        profile={profile}
        gearSnapshots={gearSnapshots}
        onOpenLinkModal={onOpenLinkModal}
        onAddJob={onAddJob}
        setTab={setTab}
      />
    </div>
  );
}
