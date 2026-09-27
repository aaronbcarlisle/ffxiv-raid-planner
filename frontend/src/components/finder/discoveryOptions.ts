// Imported by legacy pages/Discover.tsx: edits here change V1.
//
// Moved byte-for-byte from pages/Discover.tsx (R-SF-M): same values, labels
// and order. V1's own RECRUITMENT_OPTIONS stays in Discover.tsx — its list
// (open/limited/closed) lacks the 'selective' and 'paused' the recruitment
// form writes, so V2 gets its own FINDER_RECRUITMENT_OPTIONS below.

import {
  RAID_JOBS,
  DC_NAMES,
  getWorldsForDC,
  TIMEZONES,
  LANGUAGES,
} from '../../gamedata';
import type { SelectOption } from '../ui/Select';

export const JOB_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any job' },
  ...RAID_JOBS.map(j => ({ value: j.abbreviation, label: `${j.abbreviation} — ${j.name}` })),
];

export const INTENSITY_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any vibe' },
  { value: 'casual', label: 'Casual' },
  { value: 'midcore', label: 'Midcore' },
  { value: 'hardcore', label: 'Hardcore' },
];

export const DC_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any data center' },
  ...DC_NAMES.map(dc => ({ value: dc, label: dc })),
];

export const TZ_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any timezone' },
  ...TIMEZONES.map(tz => ({ value: tz.value, label: tz.label })),
];

export const LANG_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any language' },
  ...LANGUAGES.map(l => ({ value: l.code, label: l.label })),
];

export const GOAL_CATEGORY_LABELS: Record<string, string> = {
  ultimate_clear:     'Ultimate — Clear',
  ultimate_farm:      'Ultimate — Farm',
  savage_bis:         'Savage — BiS',
  savage_mount:       'Savage — Mount',
  savage_achievement: 'Savage — Achievement',
  savage_alt_jobs:    'Savage — Alt Jobs',
  criterion_title:    'Criterion — Title',
  gil_farm:           'Gil Farm',
  loot_farm:          'Loot Farm',
  mount_farm:         'Mount Farm',
  custom:             'Custom',
};

export const GOAL_CATEGORY_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any objectives' },
  { value: 'ultimate_clear',     label: 'Ultimate — Clear' },
  { value: 'ultimate_farm',      label: 'Ultimate — Farm' },
  { value: 'savage_bis',         label: 'Savage — BiS' },
  { value: 'savage_mount',       label: 'Savage — Mount' },
  { value: 'savage_achievement', label: 'Savage — Achievement' },
  { value: 'savage_alt_jobs',    label: 'Savage — Alt Jobs' },
  { value: 'criterion_title',    label: 'Criterion — Title' },
  { value: 'gil_farm',           label: 'Gil Farm' },
  { value: 'loot_farm',          label: 'Loot Farm' },
  { value: 'mount_farm',         label: 'Mount Farm' },
  { value: 'custom',             label: 'Custom' },
];

/** The data center → server option builder V1's inline useMemo used (moved, R-SF-M). */
export function buildServerOptions(dataCenter: string): SelectOption[] {
  return dataCenter
    ? [{ value: '', label: 'Any server' }, ...getWorldsForDC(dataCenter).map(w => ({ value: w, label: w }))]
    : [{ value: '', label: 'Select data center first' }];
}

/**
 * V2's own recruitment-status list (m9). V1's RECRUITMENT_OPTIONS
 * (Discover.tsx) is not moved: it lacks 'selective' and 'paused', which the
 * recruitment form writes (components/settings/DiscoveryTab.tsx). This list
 * matches the form's four values, labels and order.
 */
export const FINDER_RECRUITMENT_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any status' },
  { value: 'open', label: 'Open' },
  { value: 'selective', label: 'Selective' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
];
