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

// Background, text, and border colors for each source category
const SOURCE_STYLES: Record<GearSourceCategory, string> = {
  savage:   'bg-amber-500/20 text-amber-400 border-amber-500/40',
  tome_up:  'bg-teal-500/20 text-teal-400 border-teal-500/40',
  catchup:  'bg-blue-500/20 text-blue-400 border-blue-500/40',
  tome:     'bg-teal-600/15 text-teal-400/80 border-teal-600/30',
  relic:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  crafted:  'bg-orange-500/20 text-orange-400 border-orange-500/40',
  prep:     'bg-purple-500/20 text-purple-300 border-purple-500/40',
  normal:   'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  unknown:  'bg-zinc-600/10 text-zinc-500 border-zinc-600/20',
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
