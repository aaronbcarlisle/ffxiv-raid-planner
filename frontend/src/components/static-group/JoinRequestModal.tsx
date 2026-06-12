import { useEffect, useState } from 'react';
import { Send, ExternalLink, ScrollText, Eye } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Label } from '../ui/Label';
import { Skeleton } from '../ui/Skeleton';
import { JobIcon } from '../ui/JobIcon';
import { SafeAvatar } from '../ui/SafeAvatar';
import { Checkbox } from '../ui/Checkbox';
import { PriorityBadge } from '../profile/PriorityBadge';
import { ReadinessBadge } from '../profile/ReadinessBadge';
import { SourceBadge } from '../profile/SourceBadge';
import { formatSyncAge, getFreshness, freshnessColor } from '../profile/freshness';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { PlayerJobProfile, GearSnapshot } from '../../stores/playerProfileStore';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { toast } from '../../stores/toastStore';
import type { JoinRequestCreatePayload, AltJobEntry, GearSnapshotSummary } from '../../types';
import { getJobDisplayName } from '../../gamedata/jobs';
import { GameIcon } from '../ui/GameIcon';
import { resolveJobGearSnapshot } from '../profile/jobGearUtils';

const DAY_LABELS: Record<string, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

interface JoinRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareCode: string;
  staticName: string;
  neededJobs?: string[];
  neededRoles?: string[];
  recruitmentStatus?: string;
}

interface JobCardProps {
  jp: PlayerJobProfile;
  snapshot: GearSnapshot | null;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}

function JobCard({ jp, snapshot, selected, onSelect, compact }: JobCardProps) {
  const freshness = snapshot?.syncedAt ? getFreshness(snapshot.syncedAt) : 'none';
  const isStale = freshness === 'stale' || freshness === 'old';

  return (
    /* design-system-ignore: selectable card toggle for job selection */
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        selected
          ? 'border-accent/50 bg-accent/10'
          : 'border-border-default bg-surface-elevated hover:border-border-hover'
      } ${compact ? 'p-2' : 'p-3'}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <JobIcon job={jp.job} size={compact ? 'sm' : 'md'} />
        <span className={`font-display font-semibold text-text-primary ${compact ? 'text-sm' : ''}`}>
          {jp.job}
        </span>
        <Badge variant={jp.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster'} size="sm">
          {jp.role}
        </Badge>
        <PriorityBadge priority={jp.priority} />
        <ReadinessBadge readiness={jp.readiness} />
      </div>
      {snapshot && !compact && (
        <div className="mt-1.5 flex items-center gap-2 text-xs flex-wrap">
          <span className="text-text-primary font-mono">iLv {snapshot.avgItemLevel}</span>
          <SourceBadge source={snapshot.source} />
          <span className={freshnessColor(freshness)}>
            {formatSyncAge(snapshot.syncedAt)}
          </span>
          {isStale && <Badge variant="warning" size="sm">Stale</Badge>}
        </div>
      )}
      {snapshot && compact && (
        <div className="mt-1 text-xs text-text-secondary">
          iLv {snapshot.avgItemLevel}
        </div>
      )}
    </button>
  );
}

export function JoinRequestModal({
  isOpen,
  onClose,
  shareCode,
  staticName,
  neededJobs,
  neededRoles,
  recruitmentStatus,
}: JoinRequestModalProps) {
  const {
    profile,
    gearSnapshots,
    loading: profileLoading,
    fetchProfile,
    fetchGearSnapshots,
    fetchJobProfiles,
  } = usePlayerProfileStore();
  const { createRequest } = useJoinRequestStore();
  const { days: personalAvailabilityDays, fetchPersonalAvailability } = usePersonalAvailabilityStore();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [includedAltIds, setIncludedAltIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [includeAvailabilitySummary, setIncludeAvailabilitySummary] = useState(true);
  const [includeExactAvailability, setIncludeExactAvailability] = useState(false);
  const [contactDiscord, setContactDiscord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load profile data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProfile();
      fetchJobProfiles();
      fetchPersonalAvailability();
    }
  }, [isOpen, fetchProfile, fetchJobProfiles, fetchPersonalAvailability]);

  // Fetch gear snapshots for all characters when profile loads
  useEffect(() => {
    if (isOpen && profile?.characters) {
      for (const char of profile.characters) {
        fetchGearSnapshots(char.id);
      }
    }
  }, [isOpen, profile?.characters, fetchGearSnapshots]);

  // Auto-select main job when profile loads
  useEffect(() => {
    if (profile?.jobProfiles && !selectedJobId) {
      const mainJob = profile.jobProfiles.find((j) => j.priority === 'main');
      if (mainJob) {
        setSelectedJobId(mainJob.id);
      } else if (profile.jobProfiles.length > 0) {
        setSelectedJobId(profile.jobProfiles[0].id);
      }
    }
  }, [profile?.jobProfiles, selectedJobId]);

  const characters = profile?.characters ?? [];
  const jobProfiles = profile?.jobProfiles ?? [];
  const mainCharacter = characters.find((c) => c.isMain) ?? characters[0];
  const selectedJobProfile = jobProfiles.find((j) => j.id === selectedJobId) ?? null;
  const altJobs = jobProfiles.filter((j) => j.id !== selectedJobId);

  const selectedSnapshot = selectedJobProfile
    ? resolveJobGearSnapshot(selectedJobProfile, gearSnapshots)
    : null;
  const configuredAvailabilityDays = personalAvailabilityDays.filter((day) => day.slots.length > 0);
  const availabilitySummary = includeAvailabilitySummary && configuredAvailabilityDays.length > 0
    ? {
        configuredDays: configuredAvailabilityDays.length,
        timezone: configuredAvailabilityDays[0].timezone,
        detailLevel: includeExactAvailability ? 'exact' as const : 'summary_only' as const,
        dayLabels: configuredAvailabilityDays.map((day) => DAY_LABELS[day.dayOfWeek] ?? day.dayOfWeek),
        source: 'player_hub' as const,
        ...(includeExactAvailability
          ? {
              exactWindows: configuredAvailabilityDays.map((day) => ({
                dayOfWeek: day.dayOfWeek,
                dayLabel: DAY_LABELS[day.dayOfWeek] ?? day.dayOfWeek,
                slots: day.slots,
              })),
            }
          : {}),
      }
    : null;
  const toggleAlt = (id: string) => {
    setIncludedAltIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Fit matching
  const selectedRole = selectedJobProfile?.role;
  const selectedJob = selectedJobProfile?.job?.toLowerCase();
  const roleMatches = selectedRole && neededRoles?.map((r) => r.toLowerCase()).includes(selectedRole);
  const jobMatches = selectedJob && neededJobs?.map((j) => j.toLowerCase()).includes(selectedJob);
  const hasMatch = roleMatches || jobMatches;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload: JoinRequestCreatePayload = {};
      if (message.trim()) payload.message = message.trim();
      if (availabilityNote.trim()) payload.availabilityNote = availabilityNote.trim();
      if (contactDiscord.trim()) payload.contactDiscord = contactDiscord.trim();

      // Legacy role/job interest arrays (for backwards compat with leader panel)
      if (selectedJobProfile) {
        payload.roleInterest = [selectedJobProfile.role];
        payload.jobInterest = [selectedJobProfile.job.toLowerCase()];

        const selectedAlts = altJobs.filter((j) => includedAltIds.has(j.id));
        for (const alt of selectedAlts) {
          if (!payload.roleInterest.includes(alt.role)) payload.roleInterest.push(alt.role);
          payload.jobInterest.push(alt.job.toLowerCase());
        }
      }

      // Profile-connected fields
      if (profile) {
        payload.playerProfileId = profile.id;
        if (mainCharacter) payload.playerCharacterId = mainCharacter.id;
        if (profile.shareEnabled && profile.shareCode) {
          payload.profileShareCodeAtApply = profile.shareCode;
        }
      }

      if (selectedJobProfile) {
        payload.selectedJob = selectedJobProfile.job.toLowerCase();
        payload.selectedRole = selectedJobProfile.role;
        payload.readinessAtApply = selectedJobProfile.readiness;

        if (selectedSnapshot) {
          payload.gearSnapshotSummary = {
            job: selectedSnapshot.job,
            avgItemLevel: selectedSnapshot.avgItemLevel,
            source: selectedSnapshot.source,
            syncedAt: selectedSnapshot.syncedAt,
            completeSlotsCount: selectedSnapshot.gear.filter((slot) => slot.equippedItemId || slot.equippedItemName).length,
          } satisfies GearSnapshotSummary;
        }

        if (availabilitySummary) {
          payload.availabilitySummary = availabilitySummary;
        }
        payload.includeExactAvailability = includeExactAvailability;

        const selectedAlts = altJobs.filter((j) => includedAltIds.has(j.id));
        if (selectedAlts.length > 0) {
          payload.includedAltJobs = selectedAlts.map((j): AltJobEntry => ({
            job: j.job,
            role: j.role,
            priority: j.priority,
            readiness: j.readiness,
          }));
        }
      }

      await createRequest(shareCode, payload);
      toast.success('Request sent! The static lead will review your application.');
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedJobId(null);
    setIncludedAltIds(new Set());
    setMessage('');
    setAvailabilityNote('');
    setIncludeAvailabilitySummary(true);
    setIncludeExactAvailability(false);
    setContactDiscord('');
    setShowPreview(false);
    onClose();
  };

  const hasCharacter = characters.length > 0;
  const hasJobs = jobProfiles.length > 0;
  const canSubmit = hasCharacter && hasJobs && selectedJobProfile && !isSubmitting;
  const hasGearSnapshot = !!selectedSnapshot;
  const gearFreshness = selectedSnapshot?.syncedAt ? getFreshness(selectedSnapshot.syncedAt) : 'none';
  const gearNeedsAttention = !selectedSnapshot || gearFreshness === 'stale' || gearFreshness === 'old';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2">
          <Send className="w-4 h-4 text-accent" />
          Request to Join
        </span>
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!canSubmit}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Send Request
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        {/* Static info header */}
        <div>
          <p className="text-sm text-text-secondary">
            Applying to <span className="font-semibold text-text-primary">{staticName}</span>
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {recruitmentStatus && (
              <Badge
                variant={recruitmentStatus === 'open' ? 'success' : recruitmentStatus === 'limited' ? 'warning' : 'default'}
                size="sm"
              >
                {recruitmentStatus}
              </Badge>
            )}
            {neededRoles && neededRoles.length > 0 && (
              <span className="text-xs text-text-tertiary">
                Looking for: {neededRoles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Loading state */}
        {profileLoading && !profile && (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
          </div>
        )}

        {/* Setup gates */}
        {!profileLoading && !hasCharacter && (
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-4 text-center">
            <div className="mb-2 text-status-warning"><GameIcon name="shield-person" size="xl" /></div>
            <p className="text-sm text-text-primary font-medium mb-1">Link a character first</p>
            <p className="text-xs text-text-secondary mb-3">
              Set up your Player Hub profile with a linked character before applying.
            </p>
            <Button size="sm" onClick={() => window.open('/profile', '_blank')}>
              Open Player Hub
            </Button>
          </div>
        )}

        {!profileLoading && hasCharacter && !hasJobs && (
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-4 text-center">
            <div className="mb-2 text-status-warning"><GameIcon name="crossed-swords" size="xl" /></div>
            <p className="text-sm text-text-primary font-medium mb-1">Set your main job first</p>
            <p className="text-xs text-text-secondary mb-3">
              Add at least one job profile in your Player Hub before applying.
            </p>
            <Button size="sm" onClick={() => window.open('/profile', '_blank')}>
              Open Player Hub
            </Button>
          </div>
        )}

        {/* Main content — only if profile is ready */}
        {!profileLoading && hasCharacter && hasJobs && (
          <>
            {/* Section 1: Applicant identity */}
            <div className="flex items-center gap-3 bg-surface-raised rounded-lg border border-border-default p-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0">
                {mainCharacter?.avatarUrl ? (
                  <img src={mainCharacter.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-tertiary">
                    <GameIcon name="shield-person" size="md" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold text-text-primary text-sm truncate">
                  {mainCharacter?.name ?? 'Unknown'}
                </div>
                <div className="text-xs text-text-secondary">
                  {mainCharacter?.server}
                  {mainCharacter?.dataCenter && <span className="text-text-tertiary"> [{mainCharacter.dataCenter}]</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {profile?.shareEnabled ? (
                  <Badge variant="success" size="sm">Profile Shared</Badge>
                ) : (
                  <Badge variant="default" size="sm">Profile Private</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open('/profile', '_blank')}
                  leftIcon={<ExternalLink className="w-3 h-3" />}
                >
                  Edit
                </Button>
              </div>
            </div>

            {/* Setup warnings and profile links */}
            <div className="rounded-lg border border-border-default bg-surface-raised p-3">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Player Hub checks</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-surface-elevated/70 px-3 py-2 text-xs">
                  <span className={hasGearSnapshot && !gearNeedsAttention ? 'text-status-success' : 'text-status-warning'}>
                    {hasGearSnapshot ? (gearNeedsAttention ? 'Gear may be stale' : 'Gear ready') : 'No gear saved'}
                  </span>
                  <Button variant="link" size="sm" onClick={() => window.open('/profile?tab=sync', '_blank')} className="ml-2">
                    Sync Center
                  </Button>
                </div>
                <div className="rounded-lg bg-surface-elevated/70 px-3 py-2 text-xs">
                  <span className={availabilitySummary ? 'text-status-success' : 'text-text-tertiary'}>
                    {availabilitySummary
                      ? `${availabilitySummary.configuredDays} availability days: ${availabilitySummary.dayLabels?.join(' / ')}`
                      : 'No availability summary included'}
                  </span>
                  <Button variant="link" size="sm" onClick={() => window.open('/profile?tab=availability', '_blank')} className="ml-2">
                    Availability
                  </Button>
                </div>
                <div className="rounded-lg bg-surface-elevated/70 px-3 py-2 text-xs sm:col-span-2">
                  <span className={profile?.shareEnabled && profile.visibility !== 'private' ? 'text-status-success' : 'text-text-tertiary'}>
                    {profile?.shareEnabled && profile.visibility !== 'private'
                      ? 'Profile preview can be shared'
                      : 'Profile is private; leads will see only this application snapshot'}
                  </span>
                  <Button variant="link" size="sm" onClick={() => window.open('/profile?tab=share', '_blank')} className="ml-2">
                    Sharing
                  </Button>
                </div>
              </div>
            </div>

            {/* Section 2: Apply As (primary job) */}
            <div>
              <Label>Apply As</Label>
              <div className="space-y-2 mt-1">
                {jobProfiles.map((jp) => (
                  <JobCard
                    key={jp.id}
                    jp={jp}
                    snapshot={resolveJobGearSnapshot(jp, gearSnapshots)}
                    selected={selectedJobId === jp.id}
                    onSelect={() => setSelectedJobId(jp.id)}
                  />
                ))}
              </div>
            </div>

            {/* Preview button */}
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Eye className="w-4 h-4" />}
                onClick={() => setShowPreview(true)}
              >
                Preview Application
              </Button>
            </div>

            {/* Section 3: Also Available (alt jobs) */}
            {altJobs.length > 0 && (
              <div>
                <Label description="Toggle jobs to include in your application">Also Available As</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {altJobs.map((jp) => (
                    <div key={jp.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={includedAltIds.has(jp.id)}
                        onChange={() => toggleAlt(jp.id)}
                        label=""
                      />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <JobIcon job={jp.job} size="sm" />
                        <span className="text-sm text-text-primary">{jp.job}</span>
                        <ReadinessBadge readiness={jp.readiness} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 4: Fit match */}
            {(neededRoles?.length || neededJobs?.length) ? (
              <div className="rounded-lg bg-surface-raised border border-border-default p-3">
                <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Fit</div>
                {hasMatch ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-status-success flex-shrink-0" />
                    <span className="text-text-primary">
                      {jobMatches && `Your ${getJobDisplayName(selectedJob!)} matches a needed job`}
                      {jobMatches && roleMatches && ' and '}
                      {roleMatches && !jobMatches && `Your ${selectedRole} role matches a needed role`}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-text-tertiary flex-shrink-0" />
                    <span className="text-text-secondary">No specific role/job match, but you can still apply</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Section 5: Discord handle */}
            <div>
              <Label htmlFor="join-discord" description="So the lead can reach you. Removed after they respond.">
                Discord handle
              </Label>
              <Input
                id="join-discord"
                value={contactDiscord}
                onChange={setContactDiscord}
                placeholder="e.g. username"
                maxLength={100}
              />
              <p className="text-xs text-text-muted mt-1">
                Your handle is only visible while the request is pending and is automatically deleted once accepted, declined, or cancelled.
              </p>
            </div>

            {/* Section 6: Availability */}
            <div className="space-y-3">
              <Label htmlFor="join-availability" description="Days/times you can raid, timezone, flexibility.">
                Availability
              </Label>
              <div className="rounded-lg border border-border-default bg-surface-raised p-3">
                <Checkbox
                  checked={includeAvailabilitySummary}
                  onChange={() => setIncludeAvailabilitySummary((value) => !value)}
                  label="Include Player Hub availability summary"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  Shares timezone and configured day labels from Player Hub, not exact time windows.
                </p>
                <div className="mt-3 border-t border-border-subtle pt-3">
                  <Checkbox
                    checked={includeExactAvailability}
                    onChange={() => setIncludeExactAvailability((value) => !value)}
                    label="Include exact available windows for this application"
                  />
                  <p className="mt-1 text-xs text-text-tertiary">
                    Optional. Exact windows are stored only in this application snapshot and are not shown on your public profile.
                  </p>
                </div>
              </div>
              <TextArea
                id="join-availability"
                value={availabilityNote}
                onChange={setAvailabilityNote}
                placeholder="e.g. Tue/Thu 8-11pm EST, flexible on weekends"
                maxLength={300}
                rows={2}
              />
              <p className="text-xs text-text-muted mt-1 text-right">{availabilityNote.length}/300</p>
            </div>

            {/* Section 7: Message */}
            <div>
              <Label htmlFor="join-message" description="Introduce yourself, your experience, goals, and why you want to join.">
                Message
              </Label>
              <TextArea
                id="join-message"
                value={message}
                onChange={setMessage}
                placeholder="Tell the lead about yourself and why you'd be a good fit..."
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-text-muted mt-1 text-right">{message.length}/500</p>
            </div>
          </>
        )}
      </div>
      <ApplicationPreviewModal
        isOpen={showPreview}
        onBack={() => setShowPreview(false)}
        onSend={async () => { setShowPreview(false); await handleSubmit(); }}
        isSubmitting={isSubmitting}
        canSubmit={!!canSubmit}
        character={mainCharacter ? { name: mainCharacter.name, server: mainCharacter.server, avatarUrl: mainCharacter.avatarUrl ?? undefined } : null}
        jobProfile={selectedJobProfile ? { job: selectedJobProfile.job, role: selectedJobProfile.role, readiness: selectedJobProfile.readiness } : null}
        snapshot={selectedSnapshot ? { avgItemLevel: selectedSnapshot.avgItemLevel } : null}
        altJobs={altJobs.map((j) => ({ job: j.job, role: j.role, readiness: j.readiness, id: j.id }))}
        includedAltIds={includedAltIds}
        availabilitySummary={availabilitySummary}
        message={message}
        shareEnabled={!!(profile?.shareEnabled)}
      />
    </Modal>
  );
}

// ─── Application Preview Modal ────────────────────────────────────────────────

interface ApplicationPreviewModalProps {
  isOpen: boolean;
  onBack: () => void;
  onSend: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  character: { name?: string; server?: string; avatarUrl?: string } | null;
  jobProfile: { job: string; role: string; readiness?: string } | null;
  snapshot: { avgItemLevel: number } | null;
  altJobs: { id: string; job: string; role: string; readiness: string }[];
  includedAltIds: Set<string>;
  availabilitySummary: { dayLabels?: string[]; timezone?: string; detailLevel: string } | null;
  message: string;
  shareEnabled: boolean;
}

function ApplicationPreviewModal({
  isOpen,
  onBack,
  onSend,
  isSubmitting,
  canSubmit,
  character,
  jobProfile,
  snapshot,
  altJobs,
  includedAltIds,
  availabilitySummary,
  message,
  shareEnabled,
}: ApplicationPreviewModalProps) {
  const includedAlts = altJobs.filter((j) => includedAltIds.has(j.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onBack}
      title={
        <span className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-accent" />
          Application Preview
        </span>
      }
      size="lg"
      footer={
        <div className="flex justify-between">
          <Button variant="secondary" onClick={onBack}>
            Back to Edit
          </Button>
          <Button
            variant="primary"
            onClick={onSend}
            loading={isSubmitting}
            disabled={!canSubmit}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Send Request
          </Button>
        </div>
      }
    >
      {/* Parchment preview */}
      {/* design-system-ignore: parchment document surface scoped to dossier context */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: '2px solid #b8933a',
          background: '#faf7f0',
          boxShadow: 'inset 0 0 0 1px rgba(184,147,58,0.12), 0 2px 12px rgba(139,105,20,0.18)',
        }}
      >
        {/* Gold top rule */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #8b6914, #b8933a, #d4aa4a, #b8933a, #8b6914)', flexShrink: 0 }} />

        {/* Preview header */}
        <div className="px-4 pt-3 pb-2.5 text-center" style={{ borderBottom: '1px solid rgba(184,147,58,0.2)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: '#8b6914' }}>
            ✦&nbsp;&nbsp;Application Preview&nbsp;&nbsp;✦
          </p>
          <p className="text-xs italic mt-0.5" style={{ color: '#7a5c3a' }}>
            This is what the static lead will see. Later Player Hub changes will not rewrite this.
          </p>
        </div>

        {/* Body row — portrait + identity */}
        <div className="flex gap-4 p-4">
          <div
            className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
            style={{ border: '1.5px solid #b8933a', background: '#e8d9b8' }}
          >
            <SafeAvatar
              src={character?.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
              fallback={
                <div className="w-full h-full flex items-center justify-center" style={{ background: '#e8d9b8' }}>
                  <ScrollText className="w-6 h-6" style={{ color: '#b8933a', opacity: 0.4 }} />
                </div>
              }
            />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Character identity */}
            <div>
              <p className="font-display font-bold text-base leading-tight" style={{ color: '#2d1e13' }}>
                {character?.name ?? <span style={{ color: '#8c7a60' }}>Character not set</span>}
              </p>
              {character?.server && (
                <p className="text-xs" style={{ color: '#7a5c3a' }}>{character.server}</p>
              )}
            </div>

            {/* Applying as */}
            {jobProfile && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#8b6914' }}>Applying as</p>
                <JobIcon job={jobProfile.job.toUpperCase()} size="sm" />
                <span className="text-sm font-semibold" style={{ color: '#2d1e13' }}>
                  {getJobDisplayName(jobProfile.job.toUpperCase())}
                </span>
                {jobProfile.readiness && <ReadinessBadge readiness={jobProfile.readiness} />}
                {snapshot ? (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
                    style={{ background: '#e8f0e8', border: '1px solid rgba(34,197,94,0.25)', color: '#166534' }}
                  >
                    iLv {snapshot.avgItemLevel}
                  </span>
                ) : (
                  <span className="text-[10px]" style={{ color: '#8c7a60' }}>No gear snapshot submitted</span>
                )}
              </div>
            )}

            {/* Included alt jobs */}
            {includedAlts.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#8b6914' }}>Also available</p>
                {includedAlts.map((alt) => (
                  <div key={alt.id} className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
                    style={{ background: '#f5ede0', border: '1px solid rgba(184,147,58,0.2)' }}
                  >
                    <JobIcon job={alt.job.toUpperCase()} size="sm" />
                    <span className="text-xs font-bold" style={{ color: '#2d1e13' }}>{alt.job.toUpperCase()}</span>
                    <ReadinessBadge readiness={alt.readiness} />
                  </div>
                ))}
              </div>
            )}

            {/* Availability */}
            {availabilitySummary && (
              <p className="text-xs" style={{ color: '#5c3d2e' }}>
                <span style={{ color: '#8b6914', fontWeight: 600 }}>Availability: </span>
                {availabilitySummary.dayLabels?.join(' / ')}
                {availabilitySummary.timezone ? `, ${availabilitySummary.timezone}` : ''}
                <span style={{ color: '#8c7a60' }}>
                  {availabilitySummary.detailLevel === 'exact' ? ' · exact windows' : ''}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Message preview */}
        {message.trim() && (
          <div className="px-4 pb-4">
            <p
              className="text-xs italic leading-relaxed px-3 py-2 rounded-lg"
              style={{
                background: 'rgba(240,230,206,0.45)',
                borderLeft: '2px solid rgba(184,147,58,0.4)',
                color: '#5c3d2e',
              }}
            >
              "{message}"
            </p>
          </div>
        )}

        {/* Profile sharing status */}
        <div
          className="px-4 py-2.5 flex items-center gap-2"
          style={{ borderTop: '1px solid rgba(184,147,58,0.15)', background: 'rgba(240,230,206,0.25)' }}
        >
          <Badge variant={shareEnabled ? 'success' : 'default'} size="sm">
            {shareEnabled ? 'Profile Shared' : 'Profile Private'}
          </Badge>
          <p className="text-xs" style={{ color: '#7a5c3a' }}>
            {shareEnabled
              ? 'The static lead will be able to view your full Player Hub profile.'
              : 'The static lead will see only this application snapshot.'}
          </p>
        </div>

        {/* Gold bottom rule */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #8b6914, #b8933a, #d4aa4a, #b8933a, #8b6914)', flexShrink: 0 }} />
      </div>
    </Modal>
  );
}
