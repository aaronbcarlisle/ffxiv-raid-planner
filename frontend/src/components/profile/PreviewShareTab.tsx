import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Clock, Info, ScrollText } from 'lucide-react';
import { SafeAvatar } from '../ui/SafeAvatar';
import { Button } from '../primitives/Button';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { JobIcon } from '../ui/JobIcon';
import { ReadinessBadge } from './ReadinessBadge';
import { PriorityBadge } from './PriorityBadge';
import { SourceBadge } from './SourceBadge';
import { getFreshness, freshnessColor } from './freshness';
import type { PlayerProfile, GearSnapshot } from '../../stores/playerProfileStore';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import { toast } from '../../stores/toastStore';
import { staggerContainerProps, staggerItemProps } from '../../lib/motion';
import { GameIcon } from '../ui/GameIcon';
import { buildPublicProfileUrl } from '../../utils/publicUrl';
import { formatGearActivity, hasUsableGearSnapshot, resolveJobGearSnapshot } from './jobGearUtils';
import { formatDayOfWeekLabel } from '../schedule/availabilityUtils';

interface PreviewShareTabProps {
  profile: PlayerProfile;
  gearSnapshots: Record<string, GearSnapshot[]>;
}

export function PreviewShareTab({ profile, gearSnapshots }: PreviewShareTabProps) {
  const { t, i18n } = useTranslation();
  const { updateProfile, rotateShareCode } = usePlayerProfileStore();
  const availabilityDays = usePersonalAvailabilityStore((s) => s.days);
  const [rotating, setRotating] = useState(false);
  const uiLocale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const visibilityOptions = [
    { value: 'private', label: t('profile.preview.visibilityPrivate') },
    { value: 'shareable', label: t('profile.preview.visibilityShareable') },
    { value: 'discoverable', label: t('profile.preview.visibilityDiscoverable') },
  ];

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

  const hasAnyGearSnapshots = Object.values(gearSnapshots).some((s) => s.some(hasUsableGearSnapshot));
  const hasMinimumSetup = mainCharacter && mainJob;

  const jobGearMap: Record<string, GearSnapshot | null> = {};
  for (const jp of jobProfiles) {
    jobGearMap[jp.id] = resolveJobGearSnapshot(jp, gearSnapshots);
  }

  const shareUrl = profile.shareCode && profile.shareEnabled
    ? buildPublicProfileUrl(profile.shareCode)
    : null;

  const configuredDays = availabilityDays.filter((d) => d.slots.length > 0);
  const dayLabels = configuredDays.map((d) => formatDayOfWeekLabel(d.dayOfWeek as never, uiLocale));

  const handleVisibilityChange = async (value: string) => {
    try {
      await updateProfile({ visibility: value });
      toast.success(t('profile.preview.visibilityUpdated'));
    } catch {
      toast.error(t('profile.preview.failedToUpdateVisibility'));
    }
  };

  const handleToggleShare = async () => {
    try {
      const enabling = !profile.shareEnabled;
      await updateProfile({ shareEnabled: enabling });
      toast.success(enabling ? t('profile.preview.sharingEnabled') : t('profile.preview.sharingDisabled'));
    } catch {
      toast.error(t('profile.preview.failedToToggleSharing'));
    }
  };

  const handleRotateCode = async () => {
    setRotating(true);
    try {
      await rotateShareCode();
      toast.success(t('profile.preview.shareLinkRegenerated'));
    } catch {
      toast.error(t('profile.preview.failedToRegenerateLink'));
    } finally {
      setRotating(false);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success(t('profile.preview.shareLinkCopied'));
    }
  };

  const mainJobSnapshot = mainJob ? jobGearMap[mainJob.id] : null;

  return (
    <motion.div {...staggerContainerProps} className="space-y-4">
      {/* Share controls */}
      <motion.div {...staggerItemProps} className="bg-surface-raised rounded-lg border border-border-default p-4">
        <h3 className="font-display font-semibold text-text-primary mb-1">{t('profile.preview.profileSharing')}</h3>
        <p className="text-sm text-text-tertiary mb-4">
          {t('profile.preview.profileSharingDesc')}
        </p>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Label className="text-sm text-text-secondary font-medium">{t('profile.preview.whoCanSee')}</Label>
            <Select
              value={profile.visibility}
              onChange={handleVisibilityChange}
              options={visibilityOptions}
              className="w-full sm:w-72"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant={profile.shareEnabled ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleToggleShare}
            >
              {profile.shareEnabled ? t('profile.preview.disableSharing') : t('profile.preview.enableSharing')}
            </Button>

            {profile.shareEnabled && (
              <Button variant="ghost" size="sm" onClick={handleRotateCode} disabled={rotating}>
                {rotating ? t('profile.preview.regenerating') : t('profile.preview.regenerateLink')}
              </Button>
            )}
          </div>

          {shareUrl && profile.visibility !== 'private' && (
            <div className="rounded-lg border border-border-default bg-surface-base px-3 py-2">
              <p className="mb-1 text-xs font-medium text-text-tertiary">{t('profile.preview.shareLink')}</p>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate select-all font-mono text-sm text-text-secondary">{shareUrl}</span>
                <Button variant="secondary" size="sm" onClick={handleCopyLink}>{t('profile.preview.copyLink')}</Button>
              </div>
            </div>
          )}

          {profile.shareEnabled && profile.visibility === 'private' && (
            <div className="text-sm text-status-warning bg-status-warning/10 rounded-lg px-4 py-3 border border-status-warning/20">
              {t('profile.preview.privateWarningPrefix')} <strong>{t('profile.preview.visibilityPrivateShort')}</strong>.
              {' '}
              {t('profile.preview.privateWarningSuffix')} <strong>{t('profile.preview.visibilityShareableShort')}</strong>{t('profile.preview.privateWarningPeriod')}
            </div>
          )}
        </div>
      </motion.div>

      {/* Application preview section header */}
      <motion.div {...staggerItemProps} className="flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-[#b8933a] flex-shrink-0" />
        <div>
          <h3 className="font-display font-semibold text-text-primary leading-tight">{t('profile.preview.applicationPreview')}</h3>
          <p className="text-xs text-text-tertiary">
            {t('profile.preview.applicationPreviewDesc')}
          </p>
        </div>
      </motion.div>

      {!hasMinimumSetup ? (
        <motion.div {...staggerItemProps} className="bg-surface-raised rounded-lg border border-border-default p-6 text-center">
          <div className="mb-2 text-text-tertiary"><GameIcon name="scroll-quill" size="xl" /></div>
          <p className="text-text-secondary text-sm">
            {t('profile.preview.completeSetupToPreview')}
          </p>
        </motion.div>
      ) : (
        <motion.div {...staggerItemProps}>
          {/* GC dossier card — parchment document surface */}
          <div className="rounded-lg border-2 border-[#b8933a] bg-[#faf7f0] overflow-hidden"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(184,147,58,0.15), 0 4px 20px rgba(0,0,0,0.35)' }}>

            {/* Top gold gradient rule */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #6a4710, #b8933a, #d4aa4a, #e0c060, #d4aa4a, #b8933a, #6a4710)', flexShrink: 0 }} />

            {/* Header band */}
            <div className="px-5 py-4 border-b border-[#b8933a]/25 bg-gradient-to-r from-[#f0e6ce]/70 to-[#faf7f0]">
              <p className="text-[10px] font-bold text-[#8b6914] uppercase tracking-[0.2em]">
                {t('profile.preview.applicationPreview')}
              </p>
              <p className="text-sm text-[#5c3d2e] mt-0.5">
                {t('profile.preview.whatLeadSees')}
              </p>
            </div>

            <div className="p-5 space-y-5">
              {/* Character identity */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#f0e6ce]/50 flex-shrink-0 border-2 border-[#b8933a]/40">
                  <SafeAvatar
                    src={mainCharacter.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center text-[#b8933a]/40">
                        <GameIcon name="shield-person" size="xl" />
                      </div>
                    }
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[#2d1e13] text-xl leading-tight">
                    {mainCharacter.name}
                  </div>
                  <div className="text-sm text-[#5c3d2e] mt-0.5">
                    {mainCharacter.server}
                    {mainCharacter.dataCenter && (
                      <span className="text-[#8c7a60]"> [{mainCharacter.dataCenter}]</span>
                    )}
                  </div>
                  {profile.bio && (
                    <p className="mt-1 text-xs text-[#8c7a60] line-clamp-2 italic">"{profile.bio}"</p>
                  )}
                </div>
              </div>

              {/* Ornamental divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#b8933a]/25" />
                <span className="text-[#b8933a]/60 text-xs select-none">✦</span>
                <div className="flex-1 h-px bg-[#b8933a]/25" />
              </div>

              {/* Main Job */}
              <div>
                <p className="text-[10px] font-bold text-[#8b6914] uppercase tracking-[0.15em] mb-2">{t('profile.preview.mainJob')}</p>
                <div className="flex items-center gap-3">
                  <JobIcon job={mainJob.job} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-[#2d1e13] text-lg leading-tight">
                      {getJobDisplayName(mainJob.job)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <ReadinessBadge readiness={mainJob.readiness} />
                      {mainJobSnapshot && (
                        <>
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-[#e8f0e8] border border-green-700/20 text-green-900">
                            iLv {mainJobSnapshot.avgItemLevel}
                          </span>
                          <SourceBadge source={mainJobSnapshot.source} />
                          <span className={`text-xs ${freshnessColor(getFreshness(mainJobSnapshot.syncedAt))}`}>
                            {formatGearActivity(mainJobSnapshot)}
                          </span>
                        </>
                      )}
                      {!mainJobSnapshot && hasAnyGearSnapshots && (
                        <span className="text-xs text-[#8c7a60]">{t('profile.preview.noGearSavedForJob')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alt Jobs */}
              {altJobs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[#8b6914] uppercase tracking-[0.15em] mb-2">
                    {t('profile.preview.alsoAvailableAs')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {altJobs.slice(0, 6).map((jp) => {
                      const snap = jobGearMap[jp.id];
                      return (
                        <div
                          key={jp.id}
                          className="flex items-center gap-1.5 bg-[#f5ede0]/80 rounded-lg px-2.5 py-1.5 border border-[#b8933a]/20"
                        >
                          <JobIcon job={jp.job} size="sm" />
                          <span className="text-sm font-semibold text-[#2d1e13]">{jp.job}</span>
                          <PriorityBadge priority={jp.priority} />
                          <ReadinessBadge readiness={jp.readiness} />
                          {snap && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-[#e8f0e8] border border-green-700/20 text-green-900">
                              iLv {snap.avgItemLevel}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {altJobs.length > 6 && (
                      <span className="text-xs text-[#8c7a60] self-center">{t('profile.overview.more', { count: altJobs.length - 6 })}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Availability (derived from personal availability store if set) */}
              {dayLabels.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[#8b6914] uppercase tracking-[0.15em] mb-1.5">{t('profile.overview.availability')}</p>
                  <div className="flex items-center gap-2 text-sm text-[#5c3d2e]">
                    <Clock className="w-4 h-4 text-[#8c7a60] flex-shrink-0" />
                    <span>{dayLabels.join(' / ')}</span>
                  </div>
                </div>
              )}

              {/* Ornamental divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#b8933a]/25" />
                <span className="text-[#b8933a]/60 text-xs select-none">✦</span>
                <div className="flex-1 h-px bg-[#b8933a]/25" />
              </div>

              {/* Privacy / snapshot disclaimer */}
              <div className="flex items-start gap-2 rounded-lg bg-[#f5ede0]/60 px-3 py-2.5 border border-[#b8933a]/20">
                <Info className="w-3.5 h-3.5 text-[#8c7a60] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#5c3d2e] leading-relaxed">
                  {t('profile.preview.snapshotDisclaimer')}
                  <strong className="text-[#2d1e13]"> {t('profile.preview.privateNotesNeverIncluded')}</strong>
                </p>
              </div>
            </div>

            {/* Bottom gold gradient rule */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #6a4710, #b8933a, #d4aa4a, #b8933a, #6a4710)', flexShrink: 0 }} />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
