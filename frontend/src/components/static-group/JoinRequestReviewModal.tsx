/**
 * JoinRequestReviewModal — "Recruitment Dossier" style review modal for
 * static leaders to evaluate join request applications.
 *
 * Uses application-time snapshot data (selectedJob, gearSnapshotSummary,
 * readinessAtApply, fitSnapshot) so later profile changes don't rewrite
 * the submitted application.
 *
 * AR 2.0 — reorganized into labeled sections:
 *  1. Applicant (always shown)
 *  2. Job Fit (from fitSnapshot)
 *  3. Gear & BiS (from fitSnapshot)
 *  4. Goal Alignment (counts only — no goal text)
 *  5. Schedule & Comms
 *  Decision panel (sticky bottom with fit indicator dot)
 *
 * TODO: notification click should open this modal with the request id
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Clock, Copy, ExternalLink, Eye, ScrollText, Target, UserPlus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { JobIcon } from '../ui/JobIcon';
import { SafeAvatar } from '../ui/SafeAvatar';
import { ReadinessBadge } from '../profile/ReadinessBadge';
import { SourceBadge } from '../profile/SourceBadge';
import { GoalAlignmentSummary } from './GoalAlignmentSummary';
import { formatSyncAge, getFreshness, freshnessColor } from '../profile/freshness';
import { useModal } from '../../hooks/useModal';
import { useDevice } from '../../hooks/useDevice';
import { getJobDisplayName } from '../../gamedata/jobs';
import type { JoinRequest, DiscoverySettings } from '../../types';

// --- Status display ---

// --- Section header helper ---

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.22em] mb-1.5" style={{ color: '#8b6914' }}>
      {label}
    </p>
  );
}

// --- Fit indicator dot ---

type FitLevel = 'strong' | 'partial' | 'risk' | 'unknown';

function deriveFitLevel(request: JoinRequest, discoverySettings?: DiscoverySettings): FitLevel {
  const snap = request.fitSnapshot;
  if (!snap) {
    // Fall back to job/role matching
    const neededJobs = discoverySettings?.neededJobs?.map((j) => j.toLowerCase()) ?? [];
    const neededRoles = discoverySettings?.neededRoles?.map((r) => r.toLowerCase()) ?? [];
    const jobMatches = request.selectedJob && neededJobs.includes(request.selectedJob);
    const roleMatches = request.selectedRole && neededRoles.includes(request.selectedRole);
    if (jobMatches || roleMatches) return 'partial';
    return 'unknown';
  }

  let score = 0;
  let factors = 0;

  // Job fit
  const neededJobs = discoverySettings?.neededJobs?.map((j) => j.toLowerCase()) ?? [];
  if (neededJobs.length > 0) {
    factors++;
    const jobMatches = snap.job && neededJobs.includes(snap.job.toLowerCase());
    if (jobMatches) score++;
  }

  // Gear fit (has data)
  if (snap.gearSummary) {
    factors++;
    score++; // Having gear data is already positive
  }

  // Goal alignment
  if (snap.goalAlignment) {
    factors++;
    const { aligned = 0, conflicts = 0, partial = 0 } = snap.goalAlignment;
    if (conflicts > aligned) score--; // More conflicts than alignments is bad
    else if (aligned > 0) score++;
    else if (partial > 0) score += 0.5;
  }

  // Schedule overlap
  if (snap.scheduleOverlap !== null && snap.scheduleOverlap !== undefined) {
    factors++;
    if (snap.scheduleOverlap.length > 0) score++;
  }

  if (factors === 0) return 'unknown';
  const ratio = score / factors;
  if (ratio >= 0.75) return 'strong';
  if (ratio >= 0.4) return 'partial';
  if (ratio < 0) return 'risk';
  return 'partial';
}

// --- Parchment ornamental divider ---

function ParchmentDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: 'rgba(184,147,58,0.25)' }} />
      <span className="text-xs select-none" style={{ color: 'rgba(184,147,58,0.6)' }}>✦</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(184,147,58,0.25)' }} />
    </div>
  );
}

// --- Props ---

interface JoinRequestReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: JoinRequest;
  staticName: string;
  groupId?: string;
  discoverySettings?: DiscoverySettings;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onMarkUnderReview: (id: string) => Promise<void>;
  onAddToRoster?: (request: JoinRequest) => void;
}

export function JoinRequestReviewModal({
  isOpen,
  onClose,
  request,
  staticName,
  groupId,
  discoverySettings,
  onAccept,
  onDecline,
  onMarkUnderReview,
  onAddToRoster,
}: JoinRequestReviewModalProps) {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const [showFullMessage, setShowFullMessage] = useState(false);
  const [showWindows, setShowWindows] = useState(false);
  const acceptConfirm = useModal();
  const { prefersReducedMotion } = useDevice();
  const statusConfig: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'default' }> = {
    pending: { label: t('joinRequest.review.pending'), variant: 'warning' },
    under_review: { label: t('joinRequest.review.underReview'), variant: 'info' },
    accepted: { label: t('joinRequest.review.accepted'), variant: 'success' },
    declined: { label: t('joinRequest.review.declined'), variant: 'default' },
    cancelled: { label: t('joinRequest.review.cancelled'), variant: 'default' },
  };
  const readinessExplanations: Record<string, string> = {
    ready: t('joinRequest.review.readinessReady'),
    in_progress: t('joinRequest.review.readinessInProgress'),
    needs_gear: t('joinRequest.review.readinessNeedsGear'),
    not_ready: t('joinRequest.review.readinessNotReady'),
    unknown: t('joinRequest.review.readinessUnknown'),
  };
  const fitDotStyle: Record<FitLevel, { color: string; label: string }> = {
    strong: { color: '#4a9e5a', label: t('discover.fitScoreStrong') },
    partial: { color: '#d4aa4a', label: t('discover.fitScorePartial') },
    risk: { color: '#c04040', label: t('joinRequest.review.riskFactors') },
    unknown: { color: '#8c7a60', label: t('discover.fitScoreUnknown') },
  };

  const isActionable = request.status === 'pending' || request.status === 'under_review';
  const requester = request.requester;
  const gearSummary = request.gearSnapshotSummary;
  const gearFreshness = gearSummary?.syncedAt ? getFreshness(gearSummary.syncedAt) : 'none';
  const isStaleGear = gearFreshness === 'stale' || gearFreshness === 'old';
  const statusInfo = statusConfig[request.status] ?? statusConfig.pending;

  // AR 2.0: fit indicator
  const fitLevel = deriveFitLevel(request, discoverySettings);
  const fitDot = fitDotStyle[fitLevel];

  // Fit matching (for job fit section)
  const neededRoles = discoverySettings?.neededRoles?.map((r) => r.toLowerCase()) ?? [];
  const neededJobs = discoverySettings?.neededJobs?.map((j) => j.toLowerCase()) ?? [];
  const roleMatches = request.selectedRole && neededRoles.includes(request.selectedRole);
  const jobMatches = request.selectedJob && neededJobs.includes(request.selectedJob);
  const hasNeeds = neededRoles.length > 0 || neededJobs.length > 0;

  const hasFitSnapshot = request.fitSnapshot != null;

  const handleCopyDiscord = async () => {
    if (!request.contactDiscord) return;
    await navigator.clipboard.writeText(request.contactDiscord);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = async (action: 'accept' | 'decline' | 'under_review') => {
    setIsProcessing(true);
    try {
      if (action === 'accept') await onAccept(request.id);
      else if (action === 'decline') await onDecline(request.id);
      else await onMarkUnderReview(request.id);
      if (action === 'accept') {
        setAcceptSuccess(true); // Show post-accept CTA instead of closing
      } else if (action === 'decline') {
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const formattedDate = new Date(request.createdAt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const avatar = request.characterAvatarUrlAtApply || requester?.avatarUrl;
  const applicantName = request.characterNameAtApply || requester?.displayName || 'Unknown Adventurer';

  const dossierMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.88, y: 36, filter: 'blur(10px)' },
        animate: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] as const } },
      };

  // Derived snapshot fields
  const snap = request.fitSnapshot;
  const snapAltJobs = snap?.altJobs ?? [];
  const snapGoalAlignment = snap?.goalAlignment ?? null;
  const snapScheduleOverlap = snap?.scheduleOverlap;
  const snapLanguages = snap?.languages ?? [];
  const snapComms = snap?.commsPreference ?? null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('joinRequest.review.recruitmentDossier')}
      size="4xl"
      hideDefaultHeader
      animateBackdrop
    >
      {/* ── Chrome bar — close button outside parchment in modal overlay area ── */}
      {/* design-system-ignore: modal chrome close control */}
      <div className="sticky top-0 z-30 flex justify-end px-2 py-1.5 flex-shrink-0 bg-surface-card">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('joinRequest.review.closeDossier')}
          className="w-7 h-7 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Full parchment surface ── */}
      {/* design-system-ignore: custom document surface with raw buttons */}
      <motion.div
        className="relative flex flex-col"
        {...dossierMotion}
        style={{
          background: '#faf7f0',
          border: '2px solid #b8933a',
          boxShadow:
            'inset 0 0 0 1px rgba(184,147,58,0.18), inset 0 0 0 5px rgba(184,147,58,0.06),' +
            '0 0 0 1px rgba(184,147,58,0.3), 0 8px 40px rgba(0,0,0,0.55)',
        }}
      >
        {/* Top gold rule */}
        <div
          style={{
            height: 4,
            background: 'linear-gradient(90deg, #6a4710, #b8933a, #d4aa4a, #e0c060, #d4aa4a, #b8933a, #6a4710)',
            flexShrink: 0,
          }}
        />

        {/* Corner ornaments */}
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <div
            key={corner}
            className="absolute pointer-events-none select-none"
            style={{
              width: 48,
              height: 48,
              zIndex: 1,
              ...(corner === 'tl' || corner === 'bl' ? { left: 8 } : { right: 8 }),
              ...(corner === 'tl' || corner === 'tr' ? { top: 8 } : { bottom: 62 }),
              transform: `scale(${corner === 'tr' || corner === 'br' ? -1 : 1}, ${corner === 'bl' || corner === 'br' ? -1 : 1})`,
            }}
          >
            <svg viewBox="0 0 48 48" width="48" height="48" fill="none" aria-hidden="true">
              <path d="M6 32 L6 6 L32 6" stroke="#b8933a" strokeWidth="2" strokeLinecap="square"/>
              <path d="M10 28 L10 10 L28 10" stroke="#d4aa4a" strokeWidth="0.8" strokeLinecap="square" opacity="0.5"/>
              <path d="M3 6 L6 3 L9 6 L6 9 Z" fill="#b8933a"/>
              <circle cx="10" cy="28" r="1.5" fill="rgba(184,147,58,0.55)"/>
              <circle cx="28" cy="10" r="1.5" fill="rgba(184,147,58,0.55)"/>
            </svg>
          </div>
        ))}

        {/* Decorative accent triangle */}
        <div
          className="absolute top-0 right-0 overflow-hidden pointer-events-none select-none"
          style={{ width: 56, height: 56, zIndex: 5 }}
        >
          <div
            style={{
              position: 'absolute', top: 0, right: 0,
              width: 56, height: 56,
              clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
              background: 'linear-gradient(135deg, #7a1515 0%, #4a0d0d 100%)',
              opacity: 0.85,
            }}
          />
        </div>

        {/* Document header */}
        <div
          className="px-6 pt-3 pb-3 text-center"
          style={{ borderBottom: '1px solid rgba(184,147,58,0.22)', background: 'linear-gradient(180deg, rgba(240,230,206,0.55) 0%, transparent 100%)' }}
        >
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <div className="h-px flex-1 max-w-[48px]" style={{ background: 'linear-gradient(90deg, transparent, #b8933a)' }} />
            <div className="flex items-center gap-1.5">
              <ScrollText className="w-4 h-4 flex-shrink-0" style={{ color: '#8b6914' }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.38em]" style={{ color: '#8b6914' }}>
                {t('joinRequest.review.recruitmentDossier')}
              </p>
            </div>
            <div className="h-px flex-1 max-w-[48px]" style={{ background: 'linear-gradient(90deg, #b8933a, transparent)' }} />
          </div>
          <h2
            className="font-display font-bold text-2xl leading-tight"
            style={{ color: '#2d1e13', fontFamily: '"Exo 2", var(--font-display), serif' }}
          >
            {t('joinRequest.review.adventurerSeeksEnlistment')}
          </h2>
          <p className="text-xs italic mt-1.5" style={{ color: '#7a5c3a' }}>
            {t('joinRequest.review.submittedTo')}{' '}
            <span style={{ fontWeight: 600, color: '#4a2d14' }}>{staticName}</span>{' '}
            {t('joinRequest.review.forYourConsideration')}
          </p>
        </div>

        {/* ── Dossier body ── */}
        {acceptSuccess ? (
          /* Post-accept success state */
          <div className="p-10 text-center space-y-4">
            <div
              className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
              style={{ background: '#d4efda', border: '2px solid #4a9e5a' }}
            >
              <Check className="w-7 h-7" style={{ color: '#2a7a3a' }} />
            </div>
            <h3 className="font-display font-bold text-xl" style={{ color: '#2d1e13' }}>
              {t('joinRequest.review.applicantAccepted', { name: applicantName })}
            </h3>
            <p className="text-sm" style={{ color: '#5c3d2e' }}>
              {t('joinRequest.review.addedAsMember', { staticName })}
              {!request.rosterPlayerId && ` ${t('joinRequest.review.addToRosterToComplete')}`}
            </p>
            {request.rosterPlayerId && (
              <Badge variant="success" size="sm">{t('joinRequest.review.onRoster')}</Badge>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row">
            {/* ── Mobile portrait header (sm:hidden) ── */}
            <div
              className="sm:hidden flex items-center gap-3 px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(184,147,58,0.18)', background: 'rgba(240,230,206,0.35)' }}
            >
              <div
                className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
                style={{ border: '1.5px solid #b8933a', background: '#e8d9b8' }}
              >
                <SafeAvatar
                  src={avatar}
                  alt=""
                  className="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center" style={{ opacity: 0.35 }}>
                      <ScrollText className="w-6 h-6" style={{ color: '#b8933a' }} />
                    </div>
                  }
                />
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-base leading-tight truncate" style={{ color: '#2d1e13' }}>
                  {applicantName}
                </p>
                {request.characterWorldAtApply && (
                  <p className="text-xs truncate" style={{ color: '#5c3d2e' }}>{request.characterWorldAtApply}</p>
                )}
                <div className="mt-1">
                  <Badge variant={statusInfo.variant} size="sm">{statusInfo.label}</Badge>
                </div>
              </div>
            </div>

            {/* ── Left: Portrait column (desktop only) ── */}
            <div
              className="hidden sm:flex flex-shrink-0 flex-col items-center p-5 gap-4"
              style={{ width: 164, borderRight: '1px solid rgba(184,147,58,0.22)' }}
            >
              {/* Portrait frame */}
              <div
                className="w-full rounded-lg overflow-hidden flex-shrink-0"
                style={{
                  height: 188,
                  border: '2px solid #b8933a',
                  boxShadow:
                    'inset 0 0 0 1px rgba(184,147,58,0.2), 0 3px 12px rgba(0,0,0,0.35)',
                  background: '#e8d9b8',
                }}
              >
                <SafeAvatar
                  src={avatar}
                  alt=""
                  className="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center" style={{ opacity: 0.35 }}>
                      <ScrollText className="w-10 h-10" style={{ color: '#b8933a' }} />
                    </div>
                  }
                />
              </div>

              {/* Applied date */}
              <div className="text-center w-full">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#8b6914' }}>
                  {t('joinRequest.review.submitted')}
                </p>
                <p className="text-xs font-semibold" style={{ color: '#2d1e13' }}>{formattedDate}</p>
              </div>

              {/* Status badge */}
              <Badge variant={statusInfo.variant} size="sm">{statusInfo.label}</Badge>

              {/* Discord copy */}
              {isActionable && request.contactDiscord && (
                <div className="w-full">
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-center" style={{ color: '#8b6914' }}>
                    Discord
                  </p>
                  {/* design-system-ignore: compact parchment copy button in portrait column */}
                  <button
                    type="button"
                    onClick={handleCopyDiscord}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg transition-colors"
                    style={{
                      background: '#f0e6ce',
                      border: '1px solid rgba(184,147,58,0.3)',
                      color: '#4a2d14',
                    }}
                    title={copied ? t('common.copied') : `${t('common.copy')}: ${request.contactDiscord}`}
                  >
                    <span className="truncate">{request.contactDiscord}</span>
                    {copied
                      ? <Check className="w-3 h-3 flex-shrink-0" style={{ color: '#2a7a3a' }} />
                      : <Copy className="w-3 h-3 flex-shrink-0 opacity-50" />}
                  </button>
                </div>
              )}
            </div>

            {/* ── Right: Content ── */}
            <div className="flex-1 min-w-0 p-5 space-y-4">

              {/* ══════════════════════════════════════════
                  SECTION 1 — Applicant (always shown)
                  ══════════════════════════════════════════ */}
              <div data-testid="section-applicant">
                <SectionHeader label="Adventurer" />
                <p className="font-display font-bold text-xl leading-tight" style={{ color: '#2d1e13' }}>
                  {applicantName}
                </p>
                {request.characterWorldAtApply && (
                  <p className="text-sm mt-0.5" style={{ color: '#5c3d2e' }}>
                    {request.characterWorldAtApply}
                    {request.characterDcAtApply && (
                      <span style={{ color: '#8c7a60' }}> · {request.characterDcAtApply}</span>
                    )}
                  </p>
                )}

                {/* Profile note */}
                {request.playerProfileId && (
                  <div
                    className="rounded-lg px-3 py-2 text-xs mt-2"
                    style={{
                      background: 'rgba(240,230,206,0.5)',
                      border: '1px solid rgba(184,147,58,0.15)',
                      color: '#5c3d2e',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#2d1e13' }}>Player Hub snapshot</span>
                    {' — '}
                    {request.profileShareCodeAtApply
                      ? 'full profile was shared with this application.'
                      : 'profile was private; this dossier shows only the application snapshot.'}
                  </div>
                )}

                {/* Application message */}
                {request.message && (
                  <div className="mt-3">
                    <SectionHeader label={t('joinRequest.review.inTheirOwnWords')} />
                    <blockquote className="rounded-lg px-4 py-3"
                      style={{
                        background: 'rgba(240,230,206,0.45)',
                        borderLeft: '3px solid rgba(184,147,58,0.5)',
                        border: '1px solid rgba(184,147,58,0.15)',
                        borderLeftWidth: 3,
                      }}
                    >
                      <p className={`text-sm italic leading-relaxed break-words ${showFullMessage ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}
                        style={{ color: '#3a2410' }}
                      >
                        "{request.message}"
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <footer className="text-xs font-medium" style={{ color: '#8c7a60' }}>— {applicantName}</footer>
                        {request.message.length > 160 && (
                          {/* design-system-ignore: parchment inline expand toggle */}<button type="button"
                            onClick={() => setShowFullMessage(!showFullMessage)}
                            className="text-xs underline underline-offset-2 ml-2 flex-shrink-0"
                            style={{ color: '#8b6914' }}
                          >
                            {showFullMessage ? t('common.showLess') : t('joinRequest.review.readFullMessage')}
                          </button>
                        )}
                      </div>
                    </blockquote>
                  </div>
                )}
              </div>

              <ParchmentDivider />

              {/* ══════════════════════════════════════════
                  No fit snapshot notice (legacy applications)
                  ══════════════════════════════════════════ */}
              {!hasFitSnapshot && (
                <div
                  data-testid="no-fit-snapshot-notice"
                  className="rounded-lg px-3 py-2.5 text-xs"
                  style={{
                    background: 'rgba(240,230,206,0.35)',
                    border: '1px solid rgba(184,147,58,0.15)',
                    color: '#5c3d2e',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#2d1e13' }}>{t('joinRequest.review.noFitSnapshot')}</span>
                  {' — '}
                  {t('joinRequest.review.submittedBeforeSnapshots')}
                </div>
              )}

              {hasFitSnapshot && (
                <>
                  {/* ══════════════════════════════════════════
                      SECTION 2 — Job Fit
                      ══════════════════════════════════════════ */}
                  <div data-testid="section-job-fit">
                    <SectionHeader label={t('joinRequest.review.jobFit')} />

                    {/* Applying job */}
                    {(snap?.job || request.selectedJob) ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <JobIcon job={(snap?.job || request.selectedJob)!.toUpperCase()} size="lg" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display font-bold text-base leading-tight" style={{ color: '#2d1e13' }}>
                                {getJobDisplayName((snap?.job || request.selectedJob)!.toUpperCase())}
                              </span>
                              <span className="text-xs font-mono" style={{ color: '#8c7a60' }}>
                                {(snap?.job || request.selectedJob)!.toUpperCase()}
                              </span>
                              {request.selectedRole && (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full capitalize"
                                  style={{ background: '#f0e6ce', border: '1px solid rgba(184,147,58,0.3)', color: '#5c3d2e' }}
                                >
                                  {request.selectedRole}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Static needs match */}
                        {hasNeeds && (
                          <div
                            className="rounded-lg px-3 py-2"
                            style={{
                              background: (roleMatches || jobMatches) ? 'rgba(74,158,90,0.08)' : 'rgba(240,230,206,0.35)',
                              border: `1px solid ${(roleMatches || jobMatches) ? 'rgba(74,158,90,0.25)' : 'rgba(184,147,58,0.15)'}`,
                            }}
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ background: (roleMatches || jobMatches) ? '#4a9e5a' : '#c0a882' }} />
                              <span style={{ color: '#2d1e13' }}>
                                {(roleMatches || jobMatches)
                                  ? [
                                      jobMatches ? `${(snap?.job || request.selectedJob)!.toUpperCase()} matches a needed job` : '',
                                      roleMatches ? `${request.selectedRole} matches a needed role` : '',
                                    ].filter(Boolean).join(' — ')
                                  : 'No specific role/job match against current needs'}
                              </span>
                            </div>
                            <p className="text-xs mt-1" style={{ color: '#8c7a60' }}>
                              Recruiting:{' '}
                              {[
                                ...neededRoles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)),
                                ...neededJobs.map((j) => j.toUpperCase()),
                              ].join(', ') || 'Any'}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs italic" style={{ color: '#8c7a60' }}>{t('joinRequest.review.noJobSpecified')}</p>
                    )}

                    {/* Alt jobs */}
                    {(snapAltJobs.length > 0 || (request.includedAltJobs && request.includedAltJobs.length > 0)) && (
                      <div className="mt-2">
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] mb-1" style={{ color: '#8b6914' }}>
                          {t('joinRequest.modal.alsoAvailableAs')}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {snapAltJobs.length > 0
                            ? snapAltJobs.map((job) => (
                                <div key={job} className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                                  style={{ background: '#f5ede0', border: '1px solid rgba(184,147,58,0.2)' }}
                                >
                                  <JobIcon job={job.toUpperCase()} size="sm" />
                                  <span className="text-xs font-bold" style={{ color: '#2d1e13' }}>{job.toUpperCase()}</span>
                                </div>
                              ))
                            : request.includedAltJobs!.map((alt) => (
                                <div key={alt.job} className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                                  style={{ background: '#f5ede0', border: '1px solid rgba(184,147,58,0.2)' }}
                                >
                                  <JobIcon job={alt.job.toUpperCase()} size="sm" />
                                  <span className="text-xs font-bold" style={{ color: '#2d1e13' }}>{alt.job.toUpperCase()}</span>
                                  <ReadinessBadge readiness={alt.readiness} />
                                </div>
                              ))
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  <ParchmentDivider />

                  {/* ══════════════════════════════════════════
                      SECTION 3 — Gear & BiS
                      ══════════════════════════════════════════ */}
                  <div data-testid="section-gear-bis" className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                    {/* Gear Snapshot */}
                    <div>
                      <SectionHeader label="Gear Snapshot" />
                      {snap?.gearSummary ? (
                        <div className="space-y-1">
                          <span className="text-sm font-bold" style={{ color: '#2d1e13' }}>{snap.gearSummary}</span>
                          {gearSummary && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <SourceBadge source={gearSummary.source} />
                              {gearSummary.syncedAt && (
                                <span className={`text-xs ${freshnessColor(gearFreshness)}`}>{formatSyncAge(gearSummary.syncedAt)}</span>
                              )}
                              {isStaleGear && (
                                <span className="text-[10px] font-medium" style={{ color: '#92400e' }}>· Stale</span>
                              )}
                            </div>
                          )}
                          {gearSummary?.completeSlotsCount != null && (
                            <p className="text-xs" style={{ color: '#5c3d2e' }}>{gearSummary.completeSlotsCount} slots complete</p>
                          )}
                        </div>
                      ) : gearSummary ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold" style={{ color: '#2d1e13' }}>iLv {gearSummary.avgItemLevel}</span>
                            {isStaleGear && (
                              <span className="text-[10px] font-medium" style={{ color: '#92400e' }}>· Stale</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <SourceBadge source={gearSummary.source} />
                            <span className={`text-xs ${freshnessColor(gearFreshness)}`}>{formatSyncAge(gearSummary.syncedAt)}</span>
                          </div>
                          {gearSummary.completeSlotsCount != null && (
                            <p className="text-xs" style={{ color: '#5c3d2e' }}>{gearSummary.completeSlotsCount} slots complete</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs italic" style={{ color: '#8c7a60' }}>No data</p>
                      )}
                    </div>

                    {/* BiS Target */}
                    <div>
                      <SectionHeader label="BiS Target" />
                      {snap?.selectedBisTargetName !== undefined ? (
                        snap.selectedBisTargetName ? (
                          <div className="flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#8b6914' }} />
                            <span className="text-sm font-semibold" style={{ color: '#2d1e13' }}>
                              {snap.selectedBisTargetName}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs italic" style={{ color: '#8c7a60' }}>Private</p>
                        )
                      ) : (
                        <p className="text-xs italic" style={{ color: '#8c7a60' }}>No data</p>
                      )}
                    </div>

                    {/* Readiness */}
                    <div>
                      <SectionHeader label="Readiness" />
                      {request.readinessAtApply ? (
                        <div className="space-y-1">
                          <ReadinessBadge readiness={request.readinessAtApply} />
                          <p className="text-xs leading-snug" style={{ color: '#5c3d2e' }}>
                            {readinessExplanations[request.readinessAtApply] ?? readinessExplanations.unknown}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs italic" style={{ color: '#8c7a60' }}>Not self-rated</p>
                      )}
                    </div>
                  </div>

                  <ParchmentDivider />

                  {/* ══════════════════════════════════════════
                      SECTION 4 — Goal Alignment
                      ══════════════════════════════════════════ */}
                  <div data-testid="section-goal-alignment">
                    <SectionHeader label="Goal Alignment" />
                    {snapGoalAlignment ? (
                      <div className="flex items-center gap-4 flex-wrap">
                        {[
                          { key: 'aligned', label: 'Aligned', color: '#4a9e5a' },
                          { key: 'partial', label: 'Partial', color: '#d4aa4a' },
                          { key: 'conflicts', label: 'Conflicts', color: '#c04040' },
                        ].map(({ key, label, color }) => (
                          <div key={key} className="flex items-center gap-1.5">
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                              style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
                            >
                              {snapGoalAlignment[key as keyof typeof snapGoalAlignment]}
                            </span>
                            <span className="text-xs" style={{ color: '#5c3d2e' }}>{label}</span>
                          </div>
                        ))}
                        <p className="text-[10px] w-full mt-0.5" style={{ color: '#8c7a60' }}>
                          {t('joinRequest.review.publicGoalsOnly')}
                        </p>
                      </div>
                    ) : request.playerProfileId && (groupId ?? request.staticGroupId) ? (
                      <GoalAlignmentSummary
                        groupId={groupId ?? request.staticGroupId}
                        profileId={request.playerProfileId}
                        snapshot={request.goalAlignmentSnapshot}
                      />
                    ) : (
                      <p className="text-xs italic" style={{ color: '#8c7a60' }}>{t('joinRequest.review.noGoalData')}</p>
                    )}
                  </div>

                  <ParchmentDivider />

                  {/* ══════════════════════════════════════════
                      SECTION 5 — Schedule & Comms
                      ══════════════════════════════════════════ */}
                  <div data-testid="section-schedule-comms">
                    <SectionHeader label={t('joinRequest.review.scheduleAndComms')} />
                    <div className="space-y-2">
                      {/* Schedule overlap from fit_snapshot */}
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] mb-1" style={{ color: '#8b6914' }}>
                          {t('profile.overview.availability')}
                        </p>
                        {snapScheduleOverlap !== null && snapScheduleOverlap !== undefined ? (
                          snapScheduleOverlap.length > 0 ? (
                            <div className="flex items-start gap-2 text-sm" style={{ color: '#5c3d2e' }}>
                              <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#8c7a60' }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{snapScheduleOverlap.join(' / ')}</span>
                                  {request.availabilitySummary?.timezone && (
                                    <span style={{ color: '#8c7a60' }}>{request.availabilitySummary.timezone}</span>
                                  )}
                                  {request.availabilitySummary?.detailLevel === 'exact' &&
                                    (request.availabilitySummary?.exactWindows?.length ?? 0) > 0 && (
                                    {/* design-system-ignore: parchment inline toggle */}<button type="button"
                                      onClick={() => setShowWindows(!showWindows)}
                                      className="text-xs underline underline-offset-2 transition-colors"
                                      style={{ color: '#8b6914' }}
                                    >
                                      {showWindows ? t('joinRequest.review.hideWindows') : t('joinRequest.review.showWindows')}
                                    </button>
                                  )}
                                </div>
                                {showWindows && request.availabilitySummary?.exactWindows && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {request.availabilitySummary.exactWindows.map((w) => (
                                      <span key={w.dayOfWeek} className="rounded-full px-2 py-0.5 text-xs"
                                        style={{ border: '1px solid rgba(184,147,58,0.2)', background: '#f5ede0', color: '#5c3d2e' }}
                                      >
                                        {w.dayLabel}: {w.slots.join(', ')}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs italic" style={{ color: '#8c7a60' }}>{t('common.unknown')}</p>
                          )
                        ) : request.availabilitySummary ? (
                          <div className="flex items-start gap-2 text-sm" style={{ color: '#5c3d2e' }}>
                            <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#8c7a60' }} />
                            <span>
                              {(request.availabilitySummary.dayLabels?.length ?? 0) > 0
                                ? request.availabilitySummary.dayLabels!.join(' / ')
                                : `${request.availabilitySummary.configuredDays}d`}
                              {request.availabilitySummary.timezone && `, ${request.availabilitySummary.timezone}`}
                            </span>
                          </div>
                        ) : request.availabilityNote ? (
                          <div className="flex items-start gap-2 text-sm" style={{ color: '#5c3d2e' }}>
                            <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#8c7a60' }} />
                            <span>{request.availabilityNote}</span>
                          </div>
                        ) : (
                          <p className="text-xs italic" style={{ color: '#8c7a60' }}>{t('common.unknown')}</p>
                        )}
                      </div>

                      {/* Languages */}
                      {snapLanguages.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.22em] mb-1" style={{ color: '#8b6914' }}>
                            Languages
                          </p>
                          <div className="flex gap-1.5 flex-wrap">
                            {snapLanguages.map((lang) => (
                              <span
                                key={lang}
                                className="inline-flex items-center px-2 py-0.5 text-xs rounded-full"
                                style={{ background: '#f5ede0', border: '1px solid rgba(184,147,58,0.2)', color: '#5c3d2e' }}
                              >
                                {lang}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Comms preference */}
                      {snapComms && (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.22em] mb-1" style={{ color: '#8b6914' }}>
                            Comms
                          </p>
                          <span
                            className="inline-flex items-center px-2 py-0.5 text-xs rounded-full capitalize"
                            style={{ background: '#f5ede0', border: '1px solid rgba(184,147,58,0.2)', color: '#5c3d2e' }}
                          >
                            {snapComms}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Legacy sections when no fit_snapshot: keep old gear/availability rendering */}
              {!hasFitSnapshot && (
                <>
                  {/* Job / role */}
                  {request.selectedJob ? (
                    <div>
                      <SectionHeader label="Applying As" />
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <JobIcon job={request.selectedJob.toUpperCase()} size="lg" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-base leading-tight" style={{ color: '#2d1e13' }}>
                              {getJobDisplayName(request.selectedJob.toUpperCase())}
                            </span>
                            <span className="text-xs font-mono" style={{ color: '#8c7a60' }}>
                              {request.selectedJob.toUpperCase()}
                            </span>
                            {request.selectedRole && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full capitalize"
                                style={{ background: '#f0e6ce', border: '1px solid rgba(184,147,58,0.3)', color: '#5c3d2e' }}
                              >
                                {request.selectedRole}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (request.roleInterest?.length || request.jobInterest?.length) ? (
                    <div>
                      <SectionHeader label="Roles &amp; Jobs" />
                      <div className="flex gap-1.5 flex-wrap">
                        {request.roleInterest?.map((role) => (
                          <span key={role} className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full capitalize"
                            style={{ background: '#f0e6ce', border: '1px solid rgba(184,147,58,0.3)', color: '#5c3d2e' }}>{role}</span>
                        ))}
                        {request.jobInterest?.map((job) => (
                          <span key={job} className="inline-flex items-center px-1.5 py-0.5 text-xs rounded-full font-mono"
                            style={{ background: '#f5ede0', border: '1px solid rgba(184,147,58,0.2)', color: '#5c3d2e' }}>{job.toUpperCase()}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Legacy gear + readiness grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                    <div>
                      <SectionHeader label="Gear Snapshot" />
                      {gearSummary ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold" style={{ color: '#2d1e13' }}>iLv {gearSummary.avgItemLevel}</span>
                            {isStaleGear && (
                              <span className="text-[10px] font-medium" style={{ color: '#92400e' }}>· Stale</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <SourceBadge source={gearSummary.source} />
                            <span className={`text-xs ${freshnessColor(gearFreshness)}`}>{formatSyncAge(gearSummary.syncedAt)}</span>
                          </div>
                          {gearSummary.completeSlotsCount != null && (
                            <p className="text-xs" style={{ color: '#5c3d2e' }}>{gearSummary.completeSlotsCount} slots complete</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs italic" style={{ color: '#8c7a60' }}>
                          No gear snapshot submitted
                          {request.playerProfileId && !request.profileShareCodeAtApply
                            ? ' · Profile was private at time of application'
                            : ''}
                        </p>
                      )}
                    </div>

                    <div>
                      <SectionHeader label="Readiness" />
                      {request.readinessAtApply ? (
                        <div className="space-y-1">
                          <ReadinessBadge readiness={request.readinessAtApply} />
                          <p className="text-xs leading-snug" style={{ color: '#5c3d2e' }}>
                            {readinessExplanations[request.readinessAtApply] ?? readinessExplanations.unknown}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs italic" style={{ color: '#8c7a60' }}>{t('joinRequest.review.notSelfRated')}</p>
                      )}
                    </div>
                  </div>

                  {/* Legacy alt jobs */}
                  {request.includedAltJobs && request.includedAltJobs.length > 0 && (
                    <div>
                      <SectionHeader label={t('joinRequest.modal.alsoAvailableAs')} />
                      <div className="flex gap-2 flex-wrap">
                        {request.includedAltJobs.map((alt) => (
                          <div key={alt.job} className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                            style={{ background: '#f5ede0', border: '1px solid rgba(184,147,58,0.2)' }}
                          >
                            <JobIcon job={alt.job.toUpperCase()} size="sm" />
                            <span className="text-xs font-bold" style={{ color: '#2d1e13' }}>{alt.job.toUpperCase()}</span>
                            <ReadinessBadge readiness={alt.readiness} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Legacy availability */}
                  {(request.availabilitySummary || request.availabilityNote) && (
                    <div>
                      <SectionHeader label={t('profile.overview.availability')} />
                      {request.availabilitySummary ? (
                        <div className="flex items-start gap-2 text-sm" style={{ color: '#5c3d2e' }}>
                          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#8c7a60' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>
                                {(request.availabilitySummary.dayLabels?.length ?? 0) > 0
                                  ? request.availabilitySummary.dayLabels!.join(' / ')
                                  : `${request.availabilitySummary.configuredDays}d`}
                                {request.availabilitySummary.timezone && `, ${request.availabilitySummary.timezone}`}
                                <span style={{ color: '#8c7a60' }}>
                                  {request.availabilitySummary.detailLevel === 'exact'
                                    ? ` · ${t('joinRequest.modal.exactWindows')}`
                                    : ` · ${t('joinRequest.review.summaryOnly')}`}
                                </span>
                              </span>
                              {request.availabilitySummary.detailLevel === 'exact' &&
                                (request.availabilitySummary.exactWindows?.length ?? 0) > 0 && (
                                {/* design-system-ignore: parchment inline toggle */}<button type="button"
                                  onClick={() => setShowWindows(!showWindows)}
                                  className="text-xs underline underline-offset-2 transition-colors"
                                  style={{ color: '#8b6914' }}
                                >
                                  {showWindows ? t('joinRequest.review.hideWindows') : t('joinRequest.review.showWindows')}
                                </button>
                              )}
                            </div>
                            {showWindows && request.availabilitySummary.exactWindows && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {request.availabilitySummary.exactWindows.map((w) => (
                                  <span key={w.dayOfWeek} className="rounded-full px-2 py-0.5 text-xs"
                                    style={{ border: '1px solid rgba(184,147,58,0.2)', background: '#f5ede0', color: '#5c3d2e' }}
                                  >
                                    {w.dayLabel}: {w.slots.join(', ')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : request.availabilityNote ? (
                        <div className="flex items-start gap-2 text-sm" style={{ color: '#5c3d2e' }}>
                          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#8c7a60' }} />
                          <span>{request.availabilityNote}</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Legacy goal alignment */}
                  {request.playerProfileId && (groupId ?? request.staticGroupId) && (
                    <div>
                      <SectionHeader label="Goal Alignment" />
                      <GoalAlignmentSummary
                        groupId={groupId ?? request.staticGroupId}
                        profileId={request.playerProfileId}
                        snapshot={request.goalAlignmentSnapshot}
                      />
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        )}

        {/* Bottom gold rule */}
        <div
          style={{
            height: 2,
            background: 'linear-gradient(90deg, #6a4710, #b8933a, #d4aa4a, #e0c060, #d4aa4a, #b8933a, #6a4710)',
            flexShrink: 0,
          }}
        />

        {/* ── Dark action bar (decision panel) ── */}
        <div
          className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap flex-shrink-0"
          style={{ background: '#1a1108' }}
        >
          {/* Left: fit indicator + secondary actions */}
          <div className="flex items-center gap-3">
            {/* Fit indicator dot */}
            {!acceptSuccess && (
              <div className="flex items-center gap-1.5" title={fitDot.label}>
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: fitDot.color, boxShadow: `0 0 4px ${fitDot.color}88` }}
                />
                <span className="text-xs" style={{ color: fitDot.color }}>
                  {fitDot.label}
                </span>
              </div>
            )}
            {request.profileShareCodeAtApply && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => window.open(`/profile/${request.profileShareCodeAtApply}`, '_blank')}
              >
                View Profile
              </Button>
            )}
          </div>

          {/* Right: primary actions */}
          <div className="flex items-center gap-2">
            {acceptSuccess ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => { setAcceptSuccess(false); onClose(); }}>
                  Done
                </Button>
                {!request.rosterPlayerId && onAddToRoster && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                    onClick={() => { setAcceptSuccess(false); onAddToRoster(request); onClose(); }}
                  >
                    Add to Roster
                  </Button>
                )}
              </>
            ) : isActionable ? (
              <>
                {request.status !== 'under_review' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => handleAction('under_review')}
                    disabled={isProcessing}
                  >
                    Maybe Later
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<X className="w-3.5 h-3.5" />}
                  onClick={() => handleAction('decline')}
                  disabled={isProcessing}
                >
                  Decline
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                  onClick={acceptConfirm.open}
                  disabled={isProcessing}
                >
                  Accept
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                {request.status === 'accepted' && !request.rosterPlayerId && onAddToRoster && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                    onClick={() => { onAddToRoster(request); onClose(); }}
                  >
                    Add to Roster
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Accept confirmation */}
      {acceptConfirm.isOpen && (
        <ConfirmModal
          isOpen={acceptConfirm.isOpen}
          title="Accept Application"
          message={`Accept this applicant and add them to ${staticName} as a member?${
            request.selectedJob ? ` They applied as ${request.selectedJob.toUpperCase()}.` : ''
          }`}
          confirmLabel="Accept"
          variant="default"
          onConfirm={() => { acceptConfirm.close(); handleAction('accept'); }}
          onCancel={acceptConfirm.close}
        />
      )}
    </Modal>
  );
}


// --- Dev-only mock data for visual testing ---

const MOCK_REQUESTS: Record<string, JoinRequest> = {
  complete: {
    id: 'mock-complete',
    staticGroupId: 'mock-group',
    staticGroupName: 'Mock Static',
    requesterUserId: 'mock-user',
    requester: { id: 'mock-user', displayName: 'warrior_of_light' },
    status: 'pending',
    message: 'Hey! I\'m a DNC main looking for a midcore static for this tier. I cleared M1S-M3S in PF and want a consistent group for M4S prog. I have experience raiding since Endwalker and I\'m flexible with my schedule.',
    roleInterest: ['ranged'],
    jobInterest: ['dnc'],
    availabilityNote: 'Tue/Thu 8-11pm EST, Sat afternoons flexible',
    contactDiscord: 'warrior_of_light',
    characterNameAtApply: 'Warrior of Light',
    characterWorldAtApply: 'Gilgamesh',
    characterDcAtApply: 'Aether',
    selectedJob: 'dnc',
    selectedRole: 'ranged',
    includedAltJobs: [
      { job: 'BRD', role: 'ranged', priority: 'preferred_alt', readiness: 'ready' },
      { job: 'RDM', role: 'caster', priority: 'flex', readiness: 'in_progress' },
    ],
    gearSnapshotSummary: { job: 'DNC', avgItemLevel: 710, source: 'lodestone', syncedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    readinessAtApply: 'ready',
    profileShareCodeAtApply: 'DEMO1234',
    fitSnapshot: {
      job: 'DNC',
      altJobs: ['BRD', 'RDM'],
      gearSummary: 'iL710 avg',
      selectedBisTargetName: 'Savage BiS',
      goalAlignment: { aligned: 3, partial: 1, conflicts: 0, missing: 0, unknown: 1 },
      scheduleOverlap: ['Tue', 'Thu', 'Sat'],
      languages: ['EN', 'JP'],
      commsPreference: 'voice',
      snapshotAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  noSnapshot: {
    id: 'mock-no-snap',
    staticGroupId: 'mock-group',
    requesterUserId: 'mock-user-legacy',
    requester: { id: 'mock-user-legacy', displayName: 'legacy_player' },
    status: 'pending',
    message: 'Can play tank or healer, flexible with jobs.',
    roleInterest: ['tank', 'healer'],
    jobInterest: ['pld', 'war', 'whm', 'sge'],
    availabilityNote: 'Weekends only',
    contactDiscord: 'legacy_player',
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  staleGear: {
    id: 'mock-stale',
    staticGroupId: 'mock-group',
    requesterUserId: 'mock-user-2',
    requester: { id: 'mock-user-2', displayName: 'stale_player' },
    status: 'pending',
    message: 'Looking for a static!',
    characterNameAtApply: 'Stale Gear Player',
    characterWorldAtApply: 'Cactuar',
    characterDcAtApply: 'Aether',
    selectedJob: 'war',
    selectedRole: 'tank',
    gearSnapshotSummary: { job: 'WAR', avgItemLevel: 680, source: 'xivapi', syncedAt: new Date(Date.now() - 45 * 86400000).toISOString() },
    readinessAtApply: 'needs_gear',
    fitSnapshot: {
      job: 'WAR',
      altJobs: [],
      gearSummary: 'iL680 avg',
      selectedBisTargetName: null,
      goalAlignment: null,
      scheduleOverlap: [],
      languages: [],
      commsPreference: null,
      snapshotAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  noGear: {
    id: 'mock-no-gear',
    staticGroupId: 'mock-group',
    requesterUserId: 'mock-user-3',
    requester: { id: 'mock-user-3', displayName: 'No Gear Player' },
    status: 'under_review',
    message: 'I just hit max level, looking for a chill group.',
    availabilityNote: 'Most evenings PST',
    selectedJob: 'whm',
    selectedRole: 'healer',
    readinessAtApply: 'not_ready',
    fitSnapshot: {
      job: 'WHM',
      altJobs: [],
      gearSummary: null,
      selectedBisTargetName: null,
      goalAlignment: { aligned: 0, partial: 0, conflicts: 0, missing: 2, unknown: 1 },
      scheduleOverlap: null,
      languages: ['EN'],
      commsPreference: null,
      snapshotAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
};

const MOCK_DISCOVERY: DiscoverySettings = {
  enabled: true,
  recruitmentStatus: 'open',
  neededRoles: ['ranged', 'caster'],
  neededJobs: ['dnc', 'blm'],
};

/**
 * Dev-only preview component for visually testing the review modal.
 * Renders demo buttons for each mock variant. Only renders in development.
 */
export function DevReviewModalPreview() {
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const activeRequest = activeDemo ? MOCK_REQUESTS[activeDemo] : null;

  const noop = async () => { /* demo — no real API call */ };

  if (import.meta.env.PROD) return null;

  return (
    <div className="border border-dashed border-accent/30 rounded-lg p-3 mt-4">
      <p className="text-xs text-accent font-medium mb-2">Dev: Preview Review Modal</p>
      <div className="flex gap-2 flex-wrap">
        {Object.entries(MOCK_REQUESTS).map(([key, req]) => (
          <Button key={key} variant="ghost" size="sm" onClick={() => setActiveDemo(key)}>
            {key} ({req.status})
          </Button>
        ))}
      </div>
      {activeRequest && (
        <JoinRequestReviewModal
          isOpen={!!activeDemo}
          onClose={() => setActiveDemo(null)}
          request={activeRequest}
          staticName="Demo Static FC"
          discoverySettings={MOCK_DISCOVERY}
          onAccept={noop}
          onDecline={noop}
          onMarkUnderReview={noop}
        />
      )}
    </div>
  );
}
