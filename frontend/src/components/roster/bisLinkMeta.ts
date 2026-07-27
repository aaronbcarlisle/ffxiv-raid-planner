/**
 * BiS-link URL + tooltip builders for the v2 roster card (C5, D-09 / R-078).
 *
 * Forked from the byte-frozen legacy `PlayerCardStatus`: same stored formats,
 * same destinations. Formats — full http(s) URLs pass through; GitHub presets
 * `bis|job|tier[|setIndex]` and shortlinks `sl|uuid[|setIndex]` open in XIVGear
 * (with `selectedIndex` when the trailing set index parses, including 0); any
 * other piped value opens as an XIVGear page; a bare id is an Etro gearset.
 */

const XIVGEAR_PAGE = 'https://xivgear.app/?page=';

/**
 * A stored link is only a URL when it carries a real http(s) scheme. Legacy
 * tested `startsWith('http')`, which also matched gearset ids like "httpfoo"
 * and emitted them as a same-origin relative href on an external link — the
 * one deliberate divergence from the fork (PR #193 review round 5).
 */
const HTTP_SCHEME = /^https?:\/\//i;

/** Trailing set index of a piped link; null when absent or non-numeric. */
function parseSetIndex(part: string | undefined): number | null {
  const n = parseInt(part ?? '', 10);
  return Number.isNaN(n) ? null : n;
}

function xivgearUrl(page: string, setIndex: number | null): string {
  return setIndex === null
    ? `${XIVGEAR_PAGE}${page}`
    : `${XIVGEAR_PAGE}${page}&selectedIndex=${setIndex}`;
}

export function buildBisUrl(bisLink: string): string {
  if (HTTP_SCHEME.test(bisLink)) return bisLink;
  if (!bisLink.includes('|')) return `https://etro.gg/gearset/${bisLink}`;

  const parts = bisLink.split('|');
  if (bisLink.startsWith('bis|') && parts.length === 4) {
    return xivgearUrl(parts.slice(0, 3).join('|'), parseSetIndex(parts[3]));
  }
  if (bisLink.startsWith('sl|')) {
    return xivgearUrl(`sl|${parts[1]}`, parts.length >= 3 ? parseSetIndex(parts[2]) : null);
  }
  return `${XIVGEAR_PAGE}${bisLink}`;
}

/** Tier-code → user-facing set name for GitHub-preset tooltips. */
const TIER_DISPLAY_NAMES: Record<string, string> = {
  current: 'Savage BiS',
  fru: 'FRU BiS',
  top: 'TOP BiS',
  dsr: 'DSR BiS',
  tea: 'TEA BiS',
  ucob: 'UCoB BiS',
  uwu: 'UWU BiS',
};

export function bisLinkTooltip(bisLink: string): string {
  if (HTTP_SCHEME.test(bisLink)) {
    if (bisLink.includes('etro.gg')) return 'Open in Etro';
    if (bisLink.includes('xivgear')) return 'Open in XIVGear';
    return 'Open BiS link';
  }
  if (bisLink.startsWith('sl|')) return 'Open curated BiS in XIVGear';
  if (bisLink.startsWith('bis|')) {
    const tier = bisLink.split('|')[2];
    if (!tier) return 'Open curated BiS in XIVGear';
    return `Open ${TIER_DISPLAY_NAMES[tier] ?? `${tier.toUpperCase()} BiS`} in XIVGear`;
  }
  // Mirror buildBisUrl's last two branches: any other piped value is an
  // XIVGear page, and only a bare id is an Etro gearset. The tooltip doubles
  // as the anchor's aria-label, so naming the wrong destination misleads
  // sighted and AT users alike (PR #193 review round 6).
  if (bisLink.includes('|')) return 'Open in XIVGear';
  return 'Open in Etro';
}
