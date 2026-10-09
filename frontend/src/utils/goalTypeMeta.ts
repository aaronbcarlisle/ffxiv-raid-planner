/**
 * goalTypeMeta — display labels and icons for a collection goal's type. Lifted out
 * of `RewardGoalCard` so the Progress matrix (and S2a-4's TrackCard, Ring 0) read the
 * same names. `utils/` is not ring-typed (R-S2-5, vet I-5); the icons are lucide
 * component references, so this stays a `.ts` file and callers render `<Icon size />`.
 */
import { Music, Package, Star, Trophy, type LucideIcon } from 'lucide-react';
import type { CollectionGoalType } from '../stores/collectionGoalStore';

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
