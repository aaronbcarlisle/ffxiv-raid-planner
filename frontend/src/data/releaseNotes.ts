/**
 * Release Notes Data
 *
 * Central source of truth for version tracking and release history.
 * Update CURRENT_VERSION and add new release entries when deploying.
 */

export const CURRENT_VERSION = '1.0.0';

export type ReleaseCategory = 'feature' | 'fix' | 'improvement' | 'breaking';

export interface CommitInfo {
  hash: string; // Short commit hash (7 chars)
  message: string;
  date?: string;
}

export interface ReleaseItem {
  category: ReleaseCategory;
  title: string;
  description?: string;
  details?: string; // Extended description shown when expanded
  commits?: CommitInfo[]; // Related commits
  image?: string; // Path to image/gif shown when expanded
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
        details:
          'Complete documentation system with role-based guides (Leads vs Members), common tasks reference, and technical documentation. Includes Getting Started guides, API reference, loot math explanations, and design system documentation.',
        commits: [
          { hash: 'c9f1672', message: 'Add comprehensive documentation system' },
          { hash: '899eec2', message: 'Comment out unused ImagePlaceholder function' },
        ],
      },
      {
        category: 'feature',
        title: 'API reference & cookbook',
        description: 'Full API documentation with Python and curl examples',
        details:
          'Interactive API documentation covering all endpoints: authentication, static groups, tier snapshots, players, loot logging, and BiS import. Includes a cookbook with copy-paste Python and curl examples for common workflows.',
      },
      {
        category: 'feature',
        title: 'Loot math documentation',
        description: 'Detailed explanations of priority calculations and formulas',
        details:
          'Deep dive into how priority scores are calculated, including role-based weighting, slot value weights, weapon priority system, and the book/page economy. Includes actual formulas and code references.',
      },
      {
        category: 'feature',
        title: 'Release notes system',
        description: 'Track updates with version history and new release notifications',
        details:
          'New release banner appears when updates are deployed. Dismissible by clicking X or viewing release notes. Version history page shows all releases with categorized changes.',
      },
      {
        category: 'improvement',
        title: 'Syntax-highlighted code blocks',
        description: 'Documentation code examples now have proper syntax highlighting',
        details:
          'Added prism-react-renderer for syntax highlighting in documentation. Supports Python, bash/curl, JSON, TypeScript, and JavaScript with a custom dark theme matching the app design.',
      },
      {
        category: 'fix',
        title: 'Weapon job tracking in loot log',
        description: 'Fixed weapon logging to properly track job assignments',
        details:
          'Weapon drops now correctly record which job the weapon was assigned to. This affects both the loot log history and weapon priority calculations.',
        commits: [
          { hash: 'a3c454b', message: 'Fix weapon job tracking in loot log and priority updates' },
          { hash: '24acf84', message: 'Improve weapon logging with job tracking and extra loot tagging' },
        ],
      },
      {
        category: 'fix',
        title: 'Auth persistence improvements',
        description: 'Better handling of login state across sessions',
        details:
          'Fixed issues where users would be logged out unexpectedly. Improved token refresh handling and session persistence in localStorage.',
        commits: [
          { hash: '6054c9f', message: 'Fix three major issues: auth persistence, universal tomestone, weapon priority' },
        ],
      },
      {
        category: 'fix',
        title: 'Universal tomestone integration',
        description: 'Fixed TypeScript errors for universal tomestone tracking',
        image: '/images/release-notes/universal-tomestone.gif',
        commits: [
          { hash: '7a43c87', message: 'Fix TypeScript errors for Universal Tomestone integration' },
        ],
      },
      {
        category: 'improvement',
        title: 'Auto-expand weapon priority on ties',
        description: 'Weapon priority section now auto-expands when there are rolling ties',
        details:
          'When multiple players are tied for weapon priority, the weapon priority section automatically expands to show the tie-breaker information.',
        image: '/images/release-notes/universal-tomestone.gif',
        commits: [{ hash: 'fe1cb55', message: 'Auto-expand weapon priority section when rolling ties' }],
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
