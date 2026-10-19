/**
 * ProgressPage — the V2 Progress tab (S2a-2). This task ships the header, the
 * tier row and the members-only card for outsiders; the farm rows follow.
 *
 * `canManage`, `currentUserId` and `isViewingAs` are part of the slot contract
 * (R-S2-4) and are consumed by the farm rows and their menus in later tasks.
 *
 * R-S2-19: a viewer with no role (guest or outsider) sees the tier row and the
 * members-only card in place of the matrix, and no `collection-` request fires.
 */
import { ListChecks } from 'lucide-react';
import { MembersOnlyCard } from '../auth';
import { PageHeader } from '../layout/PageHeader';
import { getTierById } from '../../gamedata';
import { useLootTrackingStore, weekClockKeyOf } from '../../stores/lootTrackingStore';
import type { MemberRole, PageMode, StaticGroup, TierSnapshot } from '../../types';
import { TierRow } from './TierRow';

interface ProgressPageProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  canManage: boolean;
  /** The effective role (View As aware); null/undefined for a guest or outsider. */
  userRole: MemberRole | null | undefined;
  currentUserId: string | null;
  isViewingAs: boolean;
  onNavigate: (tab: PageMode, extra?: Record<string, string>) => void;
}

export function ProgressPage({ group, tier, userRole, onNavigate }: ProgressPageProps) {
  // The shared week clock (Home/Schedule precedent). The store holds a number
  // from the first render, so "known" means a server response has written it for
  // THIS tier (RosterCard's `clockResolved`).
  const storeWeek = useLootTrackingStore((s) => s.currentWeek);
  const clockResolved = useLootTrackingStore(
    (s) => tier != null && s.weekClockKey === weekClockKeyOf(group.id, tier.tierId),
  );
  const week = clockResolved && Number.isFinite(storeWeek) ? storeWeek : null;

  const tierName = tier ? (getTierById(tier.tierId)?.name ?? tier.tierId) : null;

  return (
    <div data-testid="progress-screen">
      <PageHeader
        icon={<ListChecks size={14} className="text-accent" />}
        title="Progress"
        subtitle={`Every track ${group.name} is working on, the tier first${week !== null ? ` · Week ${week}` : ''}`}
      />
      <div className="space-y-4">
        {tierName !== null && (
          <TierRow
            tierName={tierName}
            week={week}
            onOpenBoard={() => onNavigate('roster', { rview: 'board' })}
          />
        )}
        {userRole == null && <MembersOnlyCard staticName={group.name} subject="Farms" />}
      </div>
    </div>
  );
}
