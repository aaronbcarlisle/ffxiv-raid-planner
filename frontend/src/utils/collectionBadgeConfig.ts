/**
 * Shared badge palette for Collection features.
 *
 * Single source of truth used by:
 * - CollectionsCenterTab (Player Hub)
 * - DutyFarmCard / SuggestionFarmCard (Static Suggested Farms)
 * - SourceFarmCard / CatalogBrowse (Static Browse Catalog)
 *
 * Expansion labels follow the rule:
 *   - Full name ("Dawntrail") on ≥ sm breakpoints
 *   - Abbreviation ("DT") on xs (mobile)
 */

// ── Source type ───────────────────────────────────────────────────────────────

export interface SourceTypeBadgeConfig {
  label: string;
  colorClass: string;       // full "bg-X/20 text-X border-X/40" class string
  leftBorderClass: string;  // for border-l-4 accent on cards
}

export const SOURCE_TYPE_BADGE: Record<string, SourceTypeBadgeConfig> = {
  extreme:          { label: 'Extreme',         colorClass: 'bg-status-warning/20 text-status-warning border-status-warning/40',    leftBorderClass: 'border-l-status-warning'   },
  savage:           { label: 'Savage',          colorClass: 'bg-status-error/20 text-status-error border-status-error/40',          leftBorderClass: 'border-l-status-error'     },
  ultimate:         { label: 'Ultimate',        colorClass: 'bg-purple-500/20 text-purple-400 border-purple-500/40',                leftBorderClass: 'border-l-purple-500'       },
  criterion:        { label: 'Criterion',       colorClass: 'bg-status-info/20 text-status-info border-status-info/40',             leftBorderClass: 'border-l-status-info'      },
  chaotic_alliance: { label: 'Chaotic Alliance',colorClass: 'bg-accent/20 text-accent border-accent/40',                           leftBorderClass: 'border-l-accent'           },
  collaboration:    { label: 'Collaboration',   colorClass: 'bg-pink-500/20 text-pink-400 border-pink-500/40',                     leftBorderClass: 'border-l-pink-500'         },
  field_operation:  { label: 'Field Op',        colorClass: 'bg-text-muted/20 text-text-muted border-text-muted/40',               leftBorderClass: 'border-l-border-default'   },
};

const JA_SOURCE_TYPE_LABELS: Record<string, string> = {
  extreme: '極',
  savage: '零式',
  ultimate: '絶',
  criterion: '異聞',
  chaotic_alliance: 'カオティック',
  collaboration: 'コラボ',
  field_operation: 'フィールド',
};

/** Active-chip class for source type filter buttons. */
export const SOURCE_TYPE_ACTIVE_CLASS: Record<string, string> = {
  extreme:  'bg-status-warning/20 text-status-warning ring-1 ring-status-warning/50',
  savage:   'bg-status-error/20 text-status-error ring-1 ring-status-error/50',
  ultimate: 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50',
  criterion:'bg-status-info/20 text-status-info ring-1 ring-status-info/50',
  chaotic_alliance: 'bg-accent/20 text-accent ring-1 ring-accent/50',
  collaboration: 'bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/50',
  field_operation: 'bg-surface-raised text-text-secondary ring-1 ring-border-default',
};

// ── Category ──────────────────────────────────────────────────────────────────

export interface CategoryBadgeConfig {
  label: string;
  colorClass: string;   // text color
  bgClass: string;      // background tint
  borderClass: string;  // border tint
}

export const CATEGORY_BADGE: Record<string, CategoryBadgeConfig> = {
  mount:       { label: 'Mount',  colorClass: 'text-status-warning', bgClass: 'bg-status-warning/15', borderClass: 'border-status-warning/40' },
  orchestrion: { label: 'Music',  colorClass: 'text-status-info',    bgClass: 'bg-status-info/15',    borderClass: 'border-status-info/40'    },
  minion:      { label: 'Minion', colorClass: 'text-status-success',  bgClass: 'bg-status-success/15', borderClass: 'border-status-success/40' },
  weapon:      { label: 'Weapon', colorClass: 'text-role-melee',     bgClass: 'bg-role-melee/15',     borderClass: 'border-role-melee/40'     },
  glam:        { label: 'Glam',   colorClass: 'text-text-secondary',  bgClass: 'bg-surface-elevated',  borderClass: 'border-border-subtle'     },
  card:        { label: 'Card',   colorClass: 'text-text-secondary',  bgClass: 'bg-surface-elevated',  borderClass: 'border-border-subtle'     },
  other:       { label: 'Rare',   colorClass: 'text-text-secondary',  bgClass: 'bg-surface-elevated',  borderClass: 'border-border-subtle'     },
};

const JA_CATEGORY_LABELS: Record<string, string> = {
  mount: 'マウント',
  orchestrion: 'オーケストリオン譜',
  minion: 'ミニオン',
  weapon: '武器',
  glam: 'ミラプリ',
  card: 'カード',
  other: 'レア',
};

// ── Expansion ─────────────────────────────────────────────────────────────────

/** Full expansion names, used on desktop. */
export const EXPANSION_FULL: Record<string, string> = {
  dt:  'Dawntrail',
  ew:  'Endwalker',
  shb: 'Shadowbringers',
  sb:  'Stormblood',
  hw:  'Heavensward',
  arr: 'A Realm Reborn',
};

const EXPANSION_FULL_JA: Record<string, string> = {
  dt: '黄金のレガシー',
  ew: '暁月のフィナーレ',
  shb: '漆黒のヴィランズ',
  sb: '紅蓮のリベレーター',
  hw: '蒼天のイシュガルド',
  arr: '新生エオルゼア',
};

/** Abbreviated expansion names, used on mobile (xs). */
export const EXPANSION_SHORT: Record<string, string> = {
  dt: 'DT', ew: 'EW', shb: 'ShB', sb: 'SB', hw: 'HW', arr: 'ARR',
};

const EXPANSION_SHORT_JA: Record<string, string> = {
  dt: '黄金',
  ew: '暁月',
  shb: '漆黒',
  sb: '紅蓮',
  hw: '蒼天',
  arr: '新生',
};

/** Sort order: newest first. */
export const EXPANSION_ORDER: Record<string, number> = {
  dt: 0, ew: 1, shb: 2, sb: 3, hw: 4, arr: 5,
};

export const EXPANSION_KEYS = ['dt', 'ew', 'shb', 'sb', 'hw', 'arr'] as const;

/** Normalise raw expansion strings (e.g. "DT" → "dt"). */
export function expKey(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase();
}

/** Full label with graceful fallback to the raw value. */
export function expansionLabel(raw: string | null | undefined): string {
  return EXPANSION_FULL[expKey(raw)] ?? raw ?? '';
}

/** Short label with graceful fallback. */
export function expansionShortLabel(raw: string | null | undefined): string {
  return EXPANSION_SHORT[expKey(raw)] ?? expKey(raw).toUpperCase();
}

function isJapaneseLocale(locale?: string): boolean {
  return (locale ?? '').toLowerCase().startsWith('ja');
}

export function getCollectionSourceTypeLabel(raw: string | null | undefined, locale?: string): string {
  if (!raw) {
    return '';
  }
  return isJapaneseLocale(locale)
    ? JA_SOURCE_TYPE_LABELS[raw] ?? SOURCE_TYPE_BADGE[raw]?.label ?? raw
    : SOURCE_TYPE_BADGE[raw]?.label ?? raw;
}

export function getCollectionCategoryLabel(raw: string | null | undefined, locale?: string): string {
  if (!raw) {
    return '';
  }
  return isJapaneseLocale(locale)
    ? JA_CATEGORY_LABELS[raw] ?? CATEGORY_BADGE[raw]?.label ?? raw
    : CATEGORY_BADGE[raw]?.label ?? raw;
}

export function getCollectionExpansionLabel(raw: string | null | undefined, locale?: string): string {
  if (!raw) {
    return '';
  }
  return isJapaneseLocale(locale)
    ? EXPANSION_FULL_JA[expKey(raw)] ?? raw
    : expansionLabel(raw);
}

export function getCollectionExpansionShortLabel(raw: string | null | undefined, locale?: string): string {
  if (!raw) {
    return '';
  }
  return isJapaneseLocale(locale)
    ? EXPANSION_SHORT_JA[expKey(raw)] ?? expKey(raw).toUpperCase()
    : expansionShortLabel(raw);
}
