/**
 * FinderCard — minimal V2 card (Task 2, R-SF-N/R): name, DC/server and the
 * tier `Tag`. Reason rows, the Looking For row, the footer and join actions
 * land in Task 3.
 */
import { Tag, type Tone } from '../ui/Tag';
import type { FinderItem } from './types';

const TIER_CONFIG: Record<string, { label: string; tone: Tone }> = {
  strong: { label: 'Strong fit', tone: 'success' },
  good: { label: 'Good fit', tone: 'info' },
  partial: { label: 'Partial fit', tone: 'warning' },
  weak: { label: 'Weak fit', tone: 'error' },
  unknown: { label: 'Not enough info', tone: 'muted' },
};

export function FinderCard({ item }: { item: FinderItem }) {
  const tier = item.fitV2 ? TIER_CONFIG[item.fitV2.tier] : null;
  const location = [item.dataCenter, item.server].filter(Boolean).join(' — ');

  return (
    <div
      data-testid="finder-card"
      className="bg-surface-card border border-border-default rounded-lg p-4 flex flex-col gap-1.5"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-display font-semibold text-text-primary break-words min-w-0">
          {item.name}
        </h3>
        {tier && (
          <Tag variant="label" tone={tier.tone} className="flex-shrink-0">
            {tier.label}
          </Tag>
        )}
      </div>
      {location && <p className="text-text-secondary text-sm">{location}</p>}
    </div>
  );
}
