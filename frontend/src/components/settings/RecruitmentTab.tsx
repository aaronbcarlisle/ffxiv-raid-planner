/* eslint-disable design-system/no-raw-button */
/**
 * Recruitment Tab — sub-navigable static listing, requests, and invitations.
 *
 * Structure:
 *   Overview  |  Listing  |  Requests  |  Invitations
 *
 * Overview shows status cards and routes to the right section.
 * Listing renders the full DiscoveryTab with its own sticky Save footer.
 * Requests and Invitations each scroll independently.
 */

import { useState } from 'react';
import {
  CheckCircle2, XCircle, Globe, MailOpen, Users, Plus,
} from 'lucide-react';
import { DiscoveryTab } from './DiscoveryTab';
import { InvitationsPanel } from '../static-group/InvitationsPanel';
import { JoinRequestsPanel } from '../static-group/JoinRequestsPanel';
import { Button } from '../primitives';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useInvitationStore } from '../../stores/invitationStore';
import type { JoinRequest, StaticGroup } from '../../types';

export type RecruitmentSection = 'overview' | 'listing' | 'requests' | 'invitations';

interface RecruitmentTabProps {
  group: StaticGroup;
  canManage: boolean;
  highlightCreateInvite?: boolean;
  onAddToRoster?: (request: JoinRequest) => void;
  onClose: () => void;
  /** Override the initial sub-section (e.g. from badge routing). */
  initialSection?: RecruitmentSection;
}

// ─── Section sub-nav ─────────────────────────────────────────────────────────

const SECTIONS: { id: RecruitmentSection; label: string }[] = [
  { id: 'overview',     label: 'Overview' },
  { id: 'listing',      label: 'Listing' },
  { id: 'requests',     label: 'Requests' },
  { id: 'invitations',  label: 'Invitations' },
];

interface SubNavProps {
  active: RecruitmentSection;
  onChange: (s: RecruitmentSection) => void;
  pendingCount: number;
}

function SubNav({ active, onChange, pendingCount }: SubNavProps) {
  return (
    <div
      className="flex gap-1 pb-3 mb-0 border-b border-border-subtle flex-shrink-0 overflow-x-auto scrollbar-none"
      role="tablist"
    >
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={active === s.id}
          onClick={() => onChange(s.id)}
          className={`relative flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            active === s.id
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
          }`}
        >
          {s.label}
          {s.id === 'requests' && pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[9px] font-bold rounded-full bg-accent text-accent-contrast">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Overview section ────────────────────────────────────────────────────────

function StatusCard({
  label,
  value,
  valueClass = 'text-text-primary',
  accent = false,
  cta,
  onCta,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
  accent?: boolean;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 ${
        accent
          ? 'border-accent/30 bg-accent/5'
          : 'border-border-default bg-surface-elevated'
      }`}
    >
      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      <button
        type="button"
        className="text-xs text-accent hover:underline text-left mt-auto"
        onClick={onCta}
      >
        {cta}
      </button>
    </div>
  );
}

function RecruitmentOverview({
  group,
  pendingCount,
  canManage,
  onNavigate,
}: {
  group: StaticGroup;
  pendingCount: number;
  canManage: boolean;
  onNavigate: (s: RecruitmentSection) => void;
}) {
  const { invitations } = useInvitationStore();
  const discovery = group.settings?.discovery ?? { enabled: false, recruitmentStatus: 'closed' };
  const isListed = !!(group.isPublic && discovery.enabled);
  const activeInvitations = invitations.filter((inv) => inv.isValid);

  const STATUS_LABEL: Record<string, string> = {
    open: 'Open',
    limited: 'Limited',
    closed: 'Closed',
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-4" style={{ scrollbarGutter: 'stable' }}>
      {/* Status row */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className={`rounded-xl border p-4 flex flex-col gap-1 ${
            isListed
              ? 'border-status-success/30 bg-status-success/5'
              : 'border-border-default bg-surface-elevated'
          }`}
        >
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Listing</p>
          <div className="flex items-center gap-1.5">
            {isListed ? (
              <CheckCircle2 className="w-4 h-4 text-status-success" />
            ) : (
              <XCircle className="w-4 h-4 text-text-muted" />
            )}
            <p className={`text-sm font-semibold ${isListed ? 'text-status-success' : 'text-text-secondary'}`}>
              {isListed ? 'Live' : 'Hidden'}
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-accent hover:underline text-left mt-1"
            onClick={() => onNavigate('listing')}
          >
            Edit listing →
          </button>
        </div>

        <div className="rounded-xl border border-border-default bg-surface-elevated p-4 flex flex-col gap-1">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Recruitment</p>
          <p className="text-sm font-semibold text-text-primary">
            {STATUS_LABEL[discovery.recruitmentStatus ?? 'closed'] ?? 'Closed'}
          </p>
          <button
            type="button"
            className="text-xs text-accent hover:underline text-left mt-1"
            onClick={() => onNavigate('listing')}
          >
            Edit status →
          </button>
        </div>
      </div>

      {/* Action row */}
      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          label="Pending Requests"
          value={pendingCount}
          valueClass={pendingCount > 0 ? 'text-accent' : 'text-text-muted'}
          accent={pendingCount > 0}
          cta={pendingCount > 0 ? 'Review requests →' : 'No pending requests'}
          onCta={() => onNavigate('requests')}
        />
        <StatusCard
          label="Active Invitations"
          value={activeInvitations.length}
          cta={canManage ? 'Manage invitations →' : 'View invitations →'}
          onCta={() => onNavigate('invitations')}
        />
      </div>

      {/* Pending requests CTA */}
      {pendingCount > 0 && canManage && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MailOpen className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold text-accent">
              {pendingCount} application{pendingCount !== 1 ? 's' : ''} waiting for review
            </p>
          </div>
          <p className="text-xs text-text-secondary">
            Review each applicant&apos;s job, gear, and availability before accepting.
          </p>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Users className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('requests')}
            className="w-full justify-center"
          >
            Review Requests
          </Button>
        </div>
      )}

      {/* Empty state — no listing */}
      {!isListed && canManage && (
        <div className="rounded-xl border border-border-default bg-surface-elevated p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-text-muted" />
            <p className="text-sm font-medium text-text-secondary">Static Finder listing is off</p>
          </div>
          <p className="text-xs text-text-muted">
            {!group.isPublic
              ? 'Enable "Public Static" in General settings first, then configure your listing.'
              : 'Turn on your listing to appear in Static Finder and start receiving applications.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('listing')}
          >
            Set up listing
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecruitmentTab({
  group,
  canManage,
  highlightCreateInvite = false,
  onAddToRoster,
  onClose,
  initialSection,
}: RecruitmentTabProps) {
  const pendingCount = useJoinRequestStore((s) => s.pendingCount);

  const resolveDefault = (): RecruitmentSection => {
    if (initialSection) return initialSection;
    return pendingCount > 0 ? 'requests' : 'overview';
  };

  const [section, setSection] = useState<RecruitmentSection>(resolveDefault);

  return (
    <div className="flex flex-col flex-1 min-h-0 pt-1">
      <SubNav active={section} onChange={setSection} pendingCount={pendingCount} />

      <div className="flex flex-col flex-1 min-h-0 pt-4">
        {section === 'overview' && (
          <RecruitmentOverview
            group={group}
            pendingCount={pendingCount}
            canManage={canManage}
            onNavigate={setSection}
          />
        )}

        {section === 'listing' && (
          /* DiscoveryTab is already flex-col flex-1 with its own scroll + sticky footer */
          <DiscoveryTab group={group} onClose={onClose} />
        )}

        {section === 'requests' && (
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
            <JoinRequestsPanel
              groupId={group.id}
              discoverySettings={group.settings?.discovery}
              onAddToRoster={onAddToRoster}
              canAct={canManage}
            />
          </div>
        )}

        {section === 'invitations' && (
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
            <InvitationsPanel
              groupId={group.id}
              canManage={canManage}
              highlightCreateButton={highlightCreateInvite}
            />
          </div>
        )}
      </div>
    </div>
  );
}
