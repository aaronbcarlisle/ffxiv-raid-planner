/**
 * Shared role display constants
 *
 * Common definitions for displaying membership roles across the application.
 * Uses semantic membership color tokens from the design system.
 */

import type { MemberRole } from '../types';

/**
 * Role badge color classes using semantic membership tokens
 */
export const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30',
  lead: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30',
  member: 'bg-membership-member/20 text-membership-member border-membership-member/30',
  viewer: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30',
};

/**
 * Human-readable role labels
 */
export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};
