/**
 * ListingTab — the Recruiting page's Listing tab (RH1d, R-RH-L).
 *
 * A slim status card (Live/Hidden from `group.isPublic && discovery.enabled`,
 * plus the waiting count) sits above the existing `DiscoveryTab` editor, which
 * owns the listing's full builder AND the status write path (M9: the header's
 * status `Select` does not render on this tab, so the editor's own status
 * cards are the single place to change it). The card itself neither reads nor
 * writes the status label — it shows only Live/Hidden and the waiting count
 * (the status label stays in `RecruitHeader`'s subtitle) — and has no
 * `Select`, no checklist, no preview and no fill button.
 *
 * Between the two sits the static's objectives editor (S2a-5a·C2a, O-4), V1's
 * `ObjectiveGoalsPanel` unedited.
 */
import { CardShell } from '../ui/CardShell';
import { DiscoveryTab } from '../settings/DiscoveryTab';
import { ObjectiveGoalsPanel } from '../static-group/ObjectiveGoalsPanel';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import type { RecruitTab } from './recruitTabs';
import type { StaticGroup } from '../../types';

interface ListingTabProps {
  group: StaticGroup;
  onTabChange: (tab: RecruitTab) => void;
}

export function ListingTab({ group, onTabChange }: ListingTabProps) {
  const applicants = useJoinRequestStore((s) => s.applicants);
  const pendingCount = applicants?.groupId === group.id ? applicants.pendingCount : 0;
  const discovery = group.settings?.discovery;
  const live = !!group.isPublic && !!discovery?.enabled;

  const parts = [live ? 'Live' : 'Hidden'];
  if (live) {
    if (pendingCount > 0) parts.push(`${pendingCount} waiting`);
  } else {
    parts.push('listing off');
  }

  return (
    <div className="flex flex-col gap-4">
      <CardShell as="div" className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${live ? 'text-status-success' : 'text-text-secondary'}`}>
          {parts.join(' · ')}
        </span>
      </CardShell>
      {/* The objectives editor (S2a-5a·C2a, R-M-6, O-4). `canManage` is literal: `RecruitPage` redirects
          anyone who can't manage the static, so this tab only mounts for those who can. The panel saves
          on its own, outside Save Listing and Cancel. `key` restarts its form on a static switch, as
          Home keeps the unkeyed store warm. */}
      <div data-testid="listing-objectives">
        <CardShell as="div">
          <ObjectiveGoalsPanel key={group.id} groupId={group.id} canManage />
        </CardShell>
      </div>
      <DiscoveryTab group={group} onClose={() => onTabChange('applicants')} />
    </div>
  );
}
