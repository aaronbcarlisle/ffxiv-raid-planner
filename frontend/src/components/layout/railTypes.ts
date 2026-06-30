import type React from 'react';

/**
 * Legacy — used by SidebarRail (the Static-layer collapsible rail consumed by SidebarNav).
 * Do NOT add new usages; the Person-layer rail uses RailEntry below.
 */
export interface RailNavItem {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  icon: React.FC<{ size?: number; className?: string }>;
  isActive: boolean;
  onSelect: () => void;
}

// ─── Person-layer rail (72px fixed, DS §3.9) ────────────────────────────────

export type RailItemVariant = 'icon' | 'avatar';

/** A standard icon-based nav item (e.g. Player Hub, Static Finder). */
export interface RailIconItem {
  kind: 'icon';
  id: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  isActive: boolean;
  onSelect: () => void;
}

/** An avatar chip item (e.g. one per static the user belongs to). */
export interface RailAvatarItem {
  kind: 'avatar';
  id: string;
  label: string;
  /** Two-letter initials shown when no imageUrl is available. */
  initials: string;
  /** Optional image URL; falls back to initials if absent. */
  imageUrl?: string;
  /** Accent color for the avatar border / background tint. */
  accent?: string;
  isActive: boolean;
  onSelect: () => void;
}

/** A visual separator between groups of rail items. */
export interface RailDivider {
  kind: 'divider';
  id: string;
}

export type RailEntry = RailIconItem | RailAvatarItem | RailDivider;
