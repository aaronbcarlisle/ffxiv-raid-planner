/**
 * NeedsYouCard — Overview's "Needs you" card (R-PH2-J).
 * Rows are AttentionRows over the Hub's usePlayerOverview data: pending RSVPs
 * and drops the caller is first in line for, across every static. Markup is
 * written fresh (not imported from home/), per ring 0.
 */

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, CalendarClock, Gem } from 'lucide-react';
import { CardShell } from '../../ui/CardShell';
import { AttentionRow } from '../../ui/AttentionRow';
import { EmptyStateInvite } from '../../ui/EmptyStateInvite';
import { Tag } from '../../ui/Tag';
import { Button } from '../../primitives/Button';
import { formatSessionStart } from './overviewFormat';
import type { OverviewActionItem, OverviewActionItemType, PlayerOverview } from './usePlayerOverview';

interface NeedsYouCardProps {
  data: PlayerOverview | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

const ACTION_LABEL: Record<OverviewActionItemType, string> = {
  rsvp_pending: 'RSVP',
  loot_priority: 'View loot',
};

function itemIcon(type: OverviewActionItemType): ReactNode {
  return type === 'rsvp_pending' ? <CalendarClock size={18} /> : <Gem size={18} />;
}

function itemMeta(item: OverviewActionItem): string {
  if (item.type === 'rsvp_pending' && item.startsAt != null) {
    return `${formatSessionStart(item.startsAt)} · ${item.detail}`;
  }
  return item.detail;
}

export function NeedsYouCard({ data, error, retry }: NeedsYouCardProps) {
  const navigate = useNavigate();

  // Defensive: the backend only ever builds `/group/...` hrefs, but a dead
  // action button must never render (director F13; AttentionRow requires one).
  const items = (data?.actionItems ?? []).filter((item) => item.href.startsWith('/group/'));

  return (
    <CardShell
      title="Needs you"
      icon={<BellRing size={14} />}
      headerRight={<span className="text-xs text-text-muted">Across your statics</span>}
    >
      {!data && !error ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-surface-interactive" />
          ))}
        </div>
      ) : error && !data ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-sm text-text-secondary">Couldn&apos;t load what needs you.</p>
          <Button size="sm" variant="secondary" onClick={retry}>Retry</Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyStateInvite
          icon={<BellRing className="h-5 w-5" />}
          title="Nothing needs you right now."
          description="Session RSVPs and loot you're first in line for show up here."
        />
      ) : (
        <div className="flex flex-col divide-y divide-border-subtle">
          {items.map((item) => (
            <AttentionRow
              key={item.href}
              icon={itemIcon(item.type)}
              title={<>{item.title} <Tag variant="label">{item.staticName}</Tag></>}
              meta={itemMeta(item)}
              action={{ label: ACTION_LABEL[item.type], onClick: () => navigate(item.href) }}
            />
          ))}
        </div>
      )}
    </CardShell>
  );
}
