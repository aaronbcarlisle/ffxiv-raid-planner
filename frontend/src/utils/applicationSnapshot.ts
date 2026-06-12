/**
 * Shared application snapshot normalizer.
 *
 * Both the compact CommandBrief preview (StaticHomeTab) and the full
 * JoinRequestReviewModal Dossier derive display fields from a JoinRequest.
 * This function is the single source of truth for that derivation so both
 * surfaces show the same facts/copy even if the request fields evolve.
 */

import type { JoinRequest } from '../types';

export interface ApplicationSnapshot {
  portrait: string | undefined;
  name: string;
  world: string | undefined;
  dc: string | undefined;
  applyingJob: string | undefined;
  applyingRole: string | undefined;
  altJobs: { job: string; readiness: string | undefined }[];
  avgItemLevel: number | undefined;
  gearSource: string | undefined;
  gearSyncedAt: string | undefined;
  missingGearCopy: string;
  readiness: string | undefined;
  availabilitySummary: string | undefined;
  message: string | undefined;
  privacyCopy: string;
  profileShareCode: string | undefined;
}

export function normalizeApplicationSnapshot(request: JoinRequest): ApplicationSnapshot {
  const portrait =
    request.characterAvatarUrlAtApply ?? request.requester?.avatarUrl ?? undefined;

  const name =
    request.characterNameAtApply ?? request.requester?.displayName ?? 'Unknown Adventurer';

  const world = request.characterWorldAtApply ?? undefined;
  const dc = request.characterDcAtApply ?? undefined;

  const applyingJob = request.selectedJob?.toUpperCase() ?? undefined;
  const applyingRole = request.selectedRole ?? undefined;

  const altJobs = (request.includedAltJobs ?? []).map((a) => ({
    job: a.job.toUpperCase(),
    readiness: a.readiness ?? undefined,
  }));

  const gear = request.gearSnapshotSummary;
  const avgItemLevel = gear?.avgItemLevel ?? undefined;
  const gearSource = gear?.source ?? undefined;
  const gearSyncedAt = gear?.syncedAt ?? undefined;

  const missingGearCopy =
    request.playerProfileId && !request.profileShareCodeAtApply
      ? 'No gear snapshot — profile was private at time of application'
      : 'No gear snapshot submitted';

  const readiness = request.readinessAtApply ?? undefined;

  const availabilitySummary = request.availabilitySummary
    ? (() => {
        const s = request.availabilitySummary;
        const days =
          (s.dayLabels?.length ?? 0) > 0
            ? s.dayLabels!.join(' / ')
            : `${s.configuredDays ?? 0} day${(s.configuredDays ?? 0) !== 1 ? 's' : ''}`;
        const tz = s.timezone ? `, ${s.timezone}` : '';
        return `${days}${tz}`;
      })()
    : (request.availabilityNote ?? undefined);

  const message = request.message ?? undefined;

  const privacyCopy = request.profileShareCodeAtApply
    ? 'Full profile was shared with this application.'
    : request.playerProfileId
      ? 'Profile was private — only application snapshot shown.'
      : 'No player profile linked.';

  const profileShareCode = request.profileShareCodeAtApply ?? undefined;

  return {
    portrait,
    name,
    world,
    dc,
    applyingJob,
    applyingRole,
    altJobs,
    avgItemLevel,
    gearSource,
    gearSyncedAt,
    missingGearCopy,
    readiness,
    availabilitySummary,
    message,
    privacyCopy,
    profileShareCode,
  };
}
