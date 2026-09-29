/**
 * tierConfig — the Static Finder's fit-tier and recruitment-status tone
 * tables (R-RH-K), moved from `FinderCard.tsx` verbatim so the Applicants tab
 * (RH1c) can render the same tier tag without importing the card component.
 */
import type { Tone } from '../ui/Tag';

export const TIER_CONFIG: Record<string, { label: string; tone: Tone }> = {
  strong: { label: 'Strong fit', tone: 'success' },
  good: { label: 'Good fit', tone: 'info' },
  partial: { label: 'Partial fit', tone: 'warning' },
  weak: { label: 'Weak fit', tone: 'error' },
  unknown: { label: 'Not enough info', tone: 'muted' },
};

export const RECRUITMENT_TONE: Record<string, Tone> = {
  open: 'success', selective: 'warning', limited: 'warning', paused: 'muted', closed: 'error',
};
