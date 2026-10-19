/**
 * goalTypeMeta — display labels and icons for a collection goal's type. Lifted out
 * of `RewardGoalCard` so the Progress matrix (and S2a-4's TrackCard, Ring 0) read the
 * same names. `utils/` is not ring-typed (R-S2-5, vet I-5); the icons are lucide
 * component references, so this stays a `.ts` file and callers render `<Icon size />`.
 */
import { Music, Package, Star, Trophy, type LucideIcon } from 'lucide-react';
import type {
  CollectionContentType,
  CollectionGoalStatus,
  CollectionGoalType,
  CollectionPriorityMode,
} from '../stores/collectionGoalStore';

export const GOAL_TYPE_LABELS: Record<CollectionGoalType, string> = {
  mount: 'Mount',
  token: 'Token',
  minion: 'Minion',
  orchestrion: 'Music',
  glam: 'Glamour',
  custom_reward: 'Custom',
  weapon: 'Weapon',
  weapon_coffer: 'Weapon Coffer',
  title: 'Title',
  clear_count: 'Clear Count',
};

export const GOAL_TYPE_ICONS: Record<CollectionGoalType, LucideIcon> = {
  mount: Trophy,
  token: Star,
  minion: Star,
  orchestrion: Music,
  glam: Star,
  custom_reward: Package,
  weapon: Star,
  weapon_coffer: Package,
  title: Star,
  clear_count: Star,
};

/** The server's seven content types, labelled as `CreateCollectionGoalModal` names them (R-S3-10). */
export const CONTENT_TYPE_LABELS: Record<CollectionContentType, string> = {
  extreme: 'Extreme',
  savage: 'Savage',
  ultimate: 'Ultimate',
  criterion: 'Criterion',
  chaotic_alliance: 'Chaotic Alliance',
  field_operation: 'Field Operation',
  custom: 'Other / Custom',
};

/** A priority mode's label and the one-line account of how it queues. */
interface PriorityModeMeta {
  label: string;
  help: string;
}

/**
 * Keyed by every mode: `satisfies` makes a missing or an extra mode a compile error, so the
 * options below can never drift from the server's modes (TG8 carry). Insertion order is the order
 * the Edit block offers them.
 */
const PRIORITY_MODE_META = {
  everyone_gets_one: { label: 'Everyone gets one', help: 'Need before Want, fewest totems first.' },
  priority_order: { label: 'Priority order', help: 'Need before Want, fewest totems first.' },
  free_roll: { label: 'Free roll', help: 'No queue: anyone can win the drop.' },
  desired_only: { label: 'Desired only', help: 'Only players who Need it are queued.' },
  custom: { label: 'Custom', help: 'Need before Want, fewest totems first.' },
} satisfies Record<CollectionPriorityMode, PriorityModeMeta>;

/** The priority modes (null = not set), each with a one-line account of how it queues (R-S3-10). */
export const PRIORITY_MODE_OPTIONS: readonly { value: CollectionPriorityMode | null; label: string; help: string }[] = [
  { value: null, label: 'Not set', help: 'Queues as Everyone gets one.' },
  ...(Object.entries(PRIORITY_MODE_META) as [CollectionPriorityMode, PriorityModeMeta][]).map(([value, meta]) => ({
    value,
    ...meta,
  })),
];

/** The statuses an active farm can hold, in the order Edit offers them (R-S3-10); `complete` is Mark finished's. */
export const GOAL_STATUS_OPTIONS: readonly { value: Exclude<CollectionGoalStatus, 'complete'>; label: string }[] = [
  { value: 'wanted', label: 'Wanted' },
  { value: 'farming', label: 'Farming' },
  { value: 'scheduled', label: 'Scheduled' },
];
