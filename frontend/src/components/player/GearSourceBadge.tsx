/**
 * GearSourceBadge Component
 *
 * Displays a colored badge showing the current gear source category.
 * Used in GearTable to show what gear is actually equipped.
 */

import type { GearSourceCategory } from '../../types';
import { GEAR_SOURCE_NAMES } from '../../types';

interface GearSourceBadgeProps {
  source: GearSourceCategory;
  compact?: boolean;
}

/**
 * Background, text, and border colors for each source category
 * Uses design system gear tokens from index.css
 * @see --color-gear-*
 */
const SOURCE_STYLES: Record<GearSourceCategory, string> = {
  savage:   'bg-gear-raid/20 text-gear-raid border-gear-raid/40',
  tome_up:  'bg-gear-augmented/20 text-gear-augmented border-gear-augmented/40',
  catchup:  'bg-gear-catchup/20 text-gear-catchup border-gear-catchup/40',
  tome:     'bg-gear-tome/15 text-gear-tome/80 border-gear-tome/30',
  relic:    'bg-gear-relic/20 text-gear-relic border-gear-relic/40',
  crafted:  'bg-gear-crafted/20 text-gear-crafted border-gear-crafted/40',
  prep:     'bg-gear-prep/20 text-gear-prep border-gear-prep/40',
  normal:   'bg-gear-normal/15 text-gear-normal border-gear-normal/30',
  unknown:  'bg-gear-unknown/10 text-gear-unknown border-gear-unknown/20',
};

// Short labels for compact mode
const COMPACT_LABELS: Record<GearSourceCategory, string> = {
  savage:   'Sav',
  tome_up:  'Aug',
  catchup:  'Ctch',
  tome:     'Tome',
  relic:    'Rel',
  crafted:  'Crft',
  prep:     'Prev',
  normal:   'Norm',
  unknown:  '???',
};

export function GearSourceBadge({ source, compact = false }: GearSourceBadgeProps) {
  const label = compact ? COMPACT_LABELS[source] : GEAR_SOURCE_NAMES[source];
  const styles = SOURCE_STYLES[source];

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border ${styles}`}
      title={GEAR_SOURCE_NAMES[source]}
    >
      {label}
    </span>
  );
}

export default GearSourceBadge;
