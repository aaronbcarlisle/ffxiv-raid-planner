/**
 * Release Notes Data
 *
 * Central source of truth for version tracking and release history.
 * Update CURRENT_VERSION and add new release entries when deploying.
 */

export const CURRENT_VERSION = '1.0.0';

export type ReleaseCategory = 'feature' | 'fix' | 'improvement' | 'breaking';

export interface ReleaseItem {
  category: ReleaseCategory;
  title: string;
  description?: string;
}

export interface Release {
  version: string;
  date: string; // ISO format: 'YYYY-MM-DD'
  title?: string;
  highlights?: string[]; // 1-2 key items for banner display
  items: ReleaseItem[];
}

// Releases ordered newest-first
export const RELEASES: Release[] = [
  {
    version: '1.0.0',
    date: '2026-01-08',
    title: 'Documentation & Polish',
    highlights: ['Comprehensive documentation', 'Release notes system'],
    items: [
      {
        category: 'feature',
        title: 'Documentation hub',
        description: 'New /docs section with guides for leads and members',
      },
      {
        category: 'feature',
        title: 'API reference & cookbook',
        description: 'Full API documentation with Python and curl examples',
      },
      {
        category: 'feature',
        title: 'Loot math documentation',
        description: 'Detailed explanations of priority calculations and formulas',
      },
      {
        category: 'feature',
        title: 'Release notes system',
        description: 'Track updates with version history and new release notifications',
      },
      {
        category: 'improvement',
        title: 'Syntax-highlighted code blocks',
        description: 'Documentation code examples now have proper syntax highlighting',
      },
      {
        category: 'fix',
        title: 'Weapon job tracking in loot log',
        description: 'Fixed weapon logging to properly track job assignments',
      },
      {
        category: 'fix',
        title: 'Auth persistence improvements',
        description: 'Better handling of login state across sessions',
      },
    ],
  },
];

/**
 * Get the latest (most recent) release
 */
export function getLatestRelease(): Release | undefined {
  return RELEASES[0];
}

/**
 * Check if the current version is newer than the last-seen version
 */
export function isNewerVersion(current: string, lastSeen: string | null): boolean {
  if (!lastSeen) return true;
  return current !== lastSeen;
}
