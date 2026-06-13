/**
 * Recruitment Tab — consolidated static listing, invitations, and join requests.
 *
 * Replaces the separate Listing, Invitations, and Requests tabs with a single
 * Recruitment tab so Settings does not scroll horizontally on smaller viewports.
 */

import { DiscoveryTab } from './DiscoveryTab';
import { InvitationsPanel } from '../static-group/InvitationsPanel';
import { JoinRequestsPanel } from '../static-group/JoinRequestsPanel';
import type { JoinRequest, StaticGroup } from '../../types';

interface RecruitmentTabProps {
  group: StaticGroup;
  canManage: boolean;
  highlightCreateInvite?: boolean;
  onAddToRoster?: (request: JoinRequest) => void;
  onClose: () => void;
}

export function RecruitmentTab({
  group,
  canManage,
  highlightCreateInvite = false,
  onAddToRoster,
  onClose,
}: RecruitmentTabProps) {
  return (
    <div className="space-y-0">
      {/* ── Static Listing / Discovery ── */}
      <DiscoveryTab group={group} onClose={onClose} />

      {/* ── Invitations ── */}
      <div className="border-t border-border-default pt-5 mt-5">
        <InvitationsPanel
          groupId={group.id}
          canManage={canManage}
          highlightCreateButton={highlightCreateInvite}
        />
      </div>

      {/* ── Join Requests (owner/lead only) ── */}
      {canManage && (
        <div className="border-t border-border-default pt-5 mt-5">
          <JoinRequestsPanel
            groupId={group.id}
            onAddToRoster={onAddToRoster}
            canAct={canManage}
          />
        </div>
      )}
    </div>
  );
}
