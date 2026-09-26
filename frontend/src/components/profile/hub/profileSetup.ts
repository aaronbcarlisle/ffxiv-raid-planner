/**
 * profileSetup — derives the seven profile-readiness checks from existing
 * client data and maps the next incomplete step to Hub tab actions.
 *
 * Pure: no side-effects, no store imports. Callers supply the availability
 * data and callbacks so this stays testable without mocking.
 *
 * R-PH1-F: seven checks mirroring OverviewTab:249-257, order mirroring :263-275,
 * mapped to Hub actions instead of V1 onNavigate strings.
 */

import type { GearSnapshot, PlayerProfile } from '../../../stores/playerProfileStore';
import { hasUsableGearSnapshot } from '../jobGearUtils';
import type { PersonalAvailabilityDay } from '../../../stores/personalAvailabilityStore';
import type { HubTab } from './hubTabs';

interface SetupCheck {
  key: string;
  done: boolean;
  label: string;
}

interface SetupNextStep {
  label: string;
  action: () => void;
}

export interface ProfileSetupResult {
  checks: SetupCheck[];
  optionalChecks: SetupCheck[];
  completedCount: number;
  totalCount: number;
  readyPct: number;
  allDone: boolean;
  nextStep: SetupNextStep | null;
}

export interface SetupCallbacks {
  onOpenLinkModal: () => void;
  onAddJob: () => void;
  setTab: (tab: HubTab) => void;
}

export function deriveProfileSetup(
  profile: PlayerProfile | null,
  gearSnapshots: Record<string, GearSnapshot[]>,
  availabilityDays: PersonalAvailabilityDay[],
  callbacks: SetupCallbacks,
): ProfileSetupResult {
  const hasCharacter = (profile?.characters.length ?? 0) > 0;
  const hasMainJob = profile?.jobProfiles.some((j) => j.priority === 'main') ?? false;
  const hasAnyGear = Object.values(gearSnapshots).some((s) => s.some(hasUsableGearSnapshot));
  const configuredDays = availabilityDays.filter((d) => d.slots.length > 0);
  const availabilityDayCount = configuredDays.length;
  const hasReadyJob = profile?.jobProfiles.some((j) => j.readiness !== 'unknown') ?? false;
  const visibilityConfigured = profile != null && profile.visibility !== 'private';
  const shareConfigured = profile != null && profile.shareEnabled && !!profile.shareCode && visibilityConfigured;
  const hasAltJob = profile?.jobProfiles.some((j) => j.priority !== 'main') ?? false;

  const checks: SetupCheck[] = [
    { key: 'character', done: hasCharacter, label: 'Character linked' },
    { key: 'main-job', done: hasMainJob, label: 'Main job selected' },
    { key: 'gear', done: hasAnyGear, label: 'Gear saved' },
    { key: 'availability', done: availabilityDayCount > 0, label: 'Availability set' },
    { key: 'readiness', done: hasReadyJob, label: 'Job readiness set' },
    { key: 'visibility', done: visibilityConfigured, label: 'Profile visibility configured' },
    { key: 'sharing', done: shareConfigured, label: 'Share preview available' },
  ];
  const optionalChecks: SetupCheck[] = [
    { key: 'alt-job', done: hasAltJob, label: 'Alt/flex job added' },
  ];
  const completedCount = checks.filter((c) => c.done).length;
  const totalCount = checks.length;

  let nextStep: SetupNextStep | null = null;
  if (!hasCharacter) {
    nextStep = { label: 'Link character', action: callbacks.onOpenLinkModal };
  } else if (!hasMainJob) {
    nextStep = { label: 'Set main job', action: callbacks.onAddJob };
  } else if (!hasAnyGear) {
    nextStep = { label: 'Check gear', action: () => callbacks.setTab('characters') };
  } else if (availabilityDayCount === 0) {
    nextStep = { label: 'Set availability', action: () => callbacks.setTab('availability') };
  } else if (!hasReadyJob) {
    nextStep = { label: 'Set readiness', action: () => callbacks.setTab('characters') };
  } else if (!visibilityConfigured || !shareConfigured) {
    nextStep = { label: 'Configure sharing', action: () => callbacks.setTab('sharing') };
  }

  return {
    checks,
    optionalChecks,
    completedCount,
    totalCount,
    readyPct: Math.round((completedCount / totalCount) * 100),
    allDone: completedCount === totalCount,
    nextStep,
  };
}
