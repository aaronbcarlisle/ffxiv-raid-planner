import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Select } from '../ui/Select';
import { JobIcon } from '../ui/JobIcon';
import { ReadinessChecklist } from './ReadinessChecklist';
import { PriorityBadge } from './PriorityBadge';
import { ReadinessBadge } from './ReadinessBadge';
import { formatSyncAge, getFreshness, freshnessColor } from './freshness';
import type { PlayerProfile, GearSnapshot } from '../../stores/playerProfileStore';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import { toast } from '../../stores/toastStore';
import { staggerContainer, staggerItem } from '../../lib/motion';

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private — only you can see' },
  { value: 'shareable', label: 'Shareable — anyone with the link' },
  { value: 'discoverable', label: 'Discoverable — visible to statics' },
];

interface PreviewShareTabProps {
  profile: PlayerProfile;
  gearSnapshots: Record<string, GearSnapshot[]>;
}

export function PreviewShareTab({ profile, gearSnapshots }: PreviewShareTabProps) {
  const { updateProfile, rotateShareCode } = usePlayerProfileStore();
  const [rotating, setRotating] = useState(false);

  const characters = profile.characters;
  const jobProfiles = profile.jobProfiles;
  const mainCharacter = characters.find((c) => c.isMain) ?? characters[0];
  const mainJob = jobProfiles.find((j) => j.priority === 'main');
  const altJobs = jobProfiles
    .filter((j) => j.priority !== 'main')
    .sort((a, b) => {
      const order = { preferred_alt: 0, flex: 1, emergency: 2, casual: 3 };
      return (order[a.priority as keyof typeof order] ?? 4) - (order[b.priority as keyof typeof order] ?? 4);
    });

  const hasAnyGearSnapshots = Object.values(gearSnapshots).some((s) => s.length > 0);
  const hasMinimumSetup = mainCharacter && mainJob;

  const jobGearMap: Record<string, GearSnapshot | null> = {};
  for (const jp of jobProfiles) {
    let best: GearSnapshot | null = null;
    for (const snaps of Object.values(gearSnapshots)) {
      for (const snap of snaps) {
        if (snap.job === jp.job && (!best || (snap.syncedAt && (!best.syncedAt || snap.syncedAt > best.syncedAt)))) {
          best = snap;
        }
      }
    }
    jobGearMap[jp.job] = best;
  }

  const shareUrl = profile.shareCode && profile.shareEnabled
    ? `${window.location.origin}/profile/${profile.shareCode}`
    : null;

  const handleVisibilityChange = async (value: string) => {
    try {
      await updateProfile({ visibility: value });
      toast.success('Visibility updated');
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  const handleToggleShare = async () => {
    try {
      const enabling = !profile.shareEnabled;
      await updateProfile({ shareEnabled: enabling });
      toast.success(enabling ? 'Sharing enabled' : 'Sharing disabled');
    } catch {
      toast.error('Failed to toggle sharing');
    }
  };

  const handleRotateCode = async () => {
    setRotating(true);
    try {
      await rotateShareCode();
      toast.success('Share link regenerated — old links no longer work');
    } catch {
      toast.error('Failed to regenerate link');
    } finally {
      setRotating(false);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard');
    }
  };

  return (
    <motion.div {...staggerContainer} className="space-y-6">
      {/* Share controls */}
      <motion.div {...staggerItem} className="bg-surface-raised rounded-lg border border-border-default p-5">
        <h3 className="font-display font-semibold text-text-primary mb-1">Profile Sharing</h3>
        <p className="text-sm text-text-tertiary mb-4">
          Control who can see your profile. Private means only you. Shareable lets anyone with the link view a read-only summary.
          Private notes and personal goals are never shown publicly.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm text-text-secondary font-medium">Visibility</label> {/* design-system-ignore */}
            <Select
              value={profile.visibility}
              onChange={handleVisibilityChange}
              options={VISIBILITY_OPTIONS}
              className="w-64"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant={profile.shareEnabled ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleToggleShare}
            >
              {profile.shareEnabled ? 'Disable Sharing' : 'Enable Sharing'}
            </Button>

            {profile.shareEnabled && (
              <Button variant="ghost" size="sm" onClick={handleRotateCode} disabled={rotating}>
                {rotating ? 'Regenerating…' : 'Regenerate Link'}
              </Button>
            )}
          </div>

          {shareUrl && profile.visibility !== 'private' && (
            <div className="flex items-center gap-2 bg-surface-base rounded-lg px-3 py-2 border border-border-default">
              <span className="text-sm text-text-secondary font-mono flex-1 truncate select-all">{shareUrl}</span>
              <Button variant="secondary" size="sm" onClick={handleCopyLink}>Copy Link</Button>
            </div>
          )}

          {profile.shareEnabled && profile.visibility === 'private' && (
            <div className="text-sm text-status-warning bg-status-warning/10 rounded-lg px-4 py-3 border border-status-warning/20">
              Your share link exists, but your profile is still <strong>Private</strong>.
              Change visibility to <strong>Shareable</strong> to let others view it.
            </div>
          )}
        </div>
      </motion.div>

      {/* Application preview */}
      <motion.div {...staggerItem}>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-display font-semibold text-text-primary">Application Preview</h3>
          <Badge variant="info" size="sm">Preview</Badge>
        </div>
        <p className="text-sm text-text-tertiary mb-4">
          This is what a static lead sees when reviewing your shared profile. Full application workflow coming soon.
        </p>
      </motion.div>

      {!hasMinimumSetup ? (
        <motion.div {...staggerItem} className="bg-surface-raised rounded-lg border border-border-default p-6 text-center">
          <div className="text-2xl mb-2 text-text-tertiary">&#128221;</div>
          <p className="text-text-secondary text-sm">
            Complete your character and job setup to see a preview of your application profile.
          </p>
        </motion.div>
      ) : (
        <motion.div {...staggerItem} className="bg-surface-raised rounded-lg border border-accent/20 p-5 space-y-5">
          {/* Character */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-elevated flex-shrink-0">
              {mainCharacter.avatarUrl ? (
                <img src={mainCharacter.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-tertiary text-lg">?</div>
              )}
            </div>
            <div>
              <div className="font-display font-bold text-text-primary text-lg">{mainCharacter.name}</div>
              <div className="text-sm text-text-secondary">
                {mainCharacter.server}
                {mainCharacter.dataCenter && <span className="text-text-tertiary"> [{mainCharacter.dataCenter}]</span>}
              </div>
            </div>
          </div>

          {/* Main Job — prominent */}
          <div className="bg-surface-base/50 rounded-lg p-4 border border-border-default">
            <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Main Job</div>
            <div className="flex items-center gap-3">
              <JobIcon job={mainJob.job} size="lg" />
              <div>
                <div className="font-display font-bold text-text-primary text-lg">{getJobDisplayName(mainJob.job)}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <ReadinessBadge readiness={mainJob.readiness} />
                  {jobGearMap[mainJob.job] && (
                    <>
                      <Badge variant="info" size="sm">iLv {jobGearMap[mainJob.job]!.avgItemLevel}</Badge>
                      <span className={`text-xs ${freshnessColor(getFreshness(jobGearMap[mainJob.job]!.syncedAt))}`}>
                        {formatSyncAge(jobGearMap[mainJob.job]!.syncedAt)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Alt/Flex Jobs */}
          {altJobs.length > 0 && (
            <div>
              <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Other Jobs</div>
              <div className="space-y-2">
                {altJobs.map((jp) => (
                  <div key={jp.id} className="flex items-center gap-3 py-1">
                    <JobIcon job={jp.job} size="md" />
                    <span className="text-text-primary text-sm font-medium">{getJobDisplayName(jp.job)}</span>
                    <PriorityBadge priority={jp.priority} />
                    <ReadinessBadge readiness={jp.readiness} />
                    {jobGearMap[jp.job] && (
                      <Badge variant="default" size="sm">iLv {jobGearMap[jp.job]!.avgItemLevel}</Badge>
                    )}
                    {jp.notes && (
                      <span className="text-xs text-text-tertiary italic hidden sm:inline">{jp.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Readiness */}
          <ReadinessChecklist profile={profile} hasGearSnapshots={hasAnyGearSnapshots} />
        </motion.div>
      )}
    </motion.div>
  );
}
