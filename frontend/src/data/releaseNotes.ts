/**
 * Release Notes Data
 *
 * Central source of truth for version tracking and release history.
 * Update CURRENT_VERSION and add new release entries when deploying.
 *
 * WARNING: This file's structure is parsed by scripts/discord-changelog.js
 * to generate Discord release announcements. If you modify the format of
 * CURRENT_VERSION or RELEASES, ensure the changelog script still works.
 */

export const CURRENT_VERSION = '1.12.0';

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
  link?: { href: string; label: string }; // Link to related page
}

export interface Release {
  version: string;
  date: string; // Full ISO 8601 format: 'YYYY-MM-DDTHH:MM:SSZ'
  title?: string;
  highlights?: string[]; // 1-2 key items for banner display
  items: ReleaseItem[];
}

// Releases ordered newest-first
export const RELEASES: Release[] = [
  {
    version: '1.12.0',
    date: '2026-01-30T22:00:00Z',
    title: 'Flexible Priority Settings',
    highlights: ['Priority modes for different group styles', 'Per-job and per-player priority adjustments'],
    items: [
      {
        category: 'feature',
        title: 'Priority mode selection',
        description: 'Choose how loot priority is calculated and displayed for your static',
        details:
          'Three modes available: Automatic (system calculates and highlights top priority - default), Manual (show priority scores but no highlighting), and Disabled (equal priority for all players - great for groups that rotate loot equally).',
      },
      {
        category: 'feature',
        title: 'Job priority modifiers',
        description: 'Fine-tune priority for specific jobs in your static',
        details:
          'Add per-job adjustments from -100 to +100 in Group Settings → Priority → Advanced Options. For example, give +20 priority to PCT if they need extra gear focus, or -15 to tanks if healers should get priority.',
      },
      {
        category: 'feature',
        title: 'Per-player priority adjustments',
        description: 'Adjust individual player priority for catch-up or balancing',
        details:
          'Right-click any player card and select "Adjust Priority" to set a modifier from -100 to +100. Useful when a new member joins mid-tier and needs catch-up priority, or to balance out a player who got lucky early.',
      },
      {
        category: 'feature',
        title: 'Enhanced fairness scoring (opt-in)',
        description: 'Add drought bonuses and balance penalties based on loot history',
        details:
          'Enable in Group Settings → Priority → Advanced Options. Players who haven\'t received drops recently get a "drought bonus" while players with more than average drops get a small penalty. Helps ensure more even distribution over time.',
      },
      {
        category: 'improvement',
        title: 'Priority breakdown tooltips',
        description: 'Hover over priority scores to see exactly how they\'re calculated',
        details:
          'The tooltip now shows role priority, gear need, job modifiers, player modifiers, and any enhanced scoring adjustments. Makes it easy to understand why one player has higher priority than another.',
      },
    ],
  },
  {
    version: '1.11.1',
    date: '2026-01-28T12:00:00Z',
    title: 'Privacy Enhancement',
    highlights: ['Removed email collection from Discord login'],
    items: [
      {
        category: 'improvement',
        title: 'Removed email collection from Discord OAuth',
        description: 'Discord login no longer requests or stores your email address',
        details:
          'I reviewed my data practices and found that email addresses were being collected during Discord login but never used by any feature. This update removes email from the OAuth scope entirely - Discord will no longer ask for email permission when you log in. Any previously stored email data has been purged from the database. This change improves privacy with no impact on functionality.',
        commits: [{ hash: '428c7a3', message: 'fix: remove email collection from Discord OAuth' }],
      },
    ],
  },
  {
    version: '1.11.0',
    date: '2026-01-25T18:30:00Z',
    title: 'Group Settings & Material Logging',
    highlights: ['Hide setup banners option', 'Auto-augment gear when logging materials'],
    items: [
      {
        category: 'feature',
        title: 'Hide setup banners in group settings',
        description: 'New toggles to hide "Unclaimed" and "No BiS configured" banners on player cards',
        details:
          'Group settings now include two new toggles: "Hide Unclaimed Banners" suppresses the ownership prompts on unclaimed player cards, and "Hide BiS Banners" suppresses the BiS import prompts. Useful for statics that prefer a cleaner card appearance.',
        commits: [{ hash: '879f036', message: 'feat: add hide setup banners settings and material logging enhancements' }],
      },
      {
        category: 'feature',
        title: 'Auto-augment gear when logging materials',
        description: 'Material logging modals now offer to automatically mark gear as augmented',
        details:
          'When logging twine, glaze, solvent, or universal tomestone, a checkbox lets you simultaneously mark the corresponding gear slot as augmented. The system tracks which slot was augmented for each material entry, enabling precise undo on deletion. Note: A one-time data migration will sync existing material entries with gear status using heuristics for entries logged before this feature.',
        commits: [{ hash: '879f036', message: 'feat: add hide setup banners settings and material logging enhancements' }],
      },
      {
        category: 'feature',
        title: 'Alt+Click navigation to material entries',
        description: 'Alt+Click on tome gear slots to jump to the corresponding material entry',
        details:
          'Alt+Click on any tome gear slot icon navigates to the Log tab and highlights the material entry that augmented that slot. Also available via context menu "Jump to Material Entry".',
        commits: [{ hash: '879f036', message: 'feat: add hide setup banners settings and material logging enhancements' }],
      },
      {
        category: 'fix',
        title: 'Universal Tomestone priority calculation',
        description: 'Fixed priority showing for players who already have the tome weapon',
        details:
          'Universal Tomestone priority now correctly shows for players pursuing the tome weapon who don\'t have it yet, rather than incorrectly showing for players who already have it.',
        commits: [{ hash: '879f036', message: 'feat: add hide setup banners settings and material logging enhancements' }],
      },
      {
        category: 'fix',
        title: 'BiS import index for multi-set XIVGear sheets',
        description: 'Fixed preset selection importing wrong set when XIVGear sheet has separators',
        details:
          'BiS import now uses original XIVGear array indices instead of filtered indices, fixing an issue where presets with separators (like DNC, WHM, BLM, PCT, SMN) would import the wrong gear set.',
        commits: [{ hash: '34e081c', message: 'fix: correct BiS preset index mismatch for multi-set XIVGear sheets' }],
      },
    ],
  },
  {
    version: '1.10.2',
    date: '2026-01-25T04:00:00Z',
    title: 'Mobile UX Polish',
    highlights: ['Improved mobile layouts', 'Better touch targets'],
    items: [
      {
        category: 'improvement',
        title: 'Improved mobile drawer layouts',
        description: 'Bottom drawers now have better spacing and touch targets',
        details:
          'Gear table, BiS import, and loot priority drawers have been redesigned for mobile with larger buttons, better scroll behavior, and improved visual hierarchy.',
      },
      {
        category: 'fix',
        title: 'Fixed player card context menu on mobile',
        description: 'Long-press context menu now works reliably on touch devices',
      },
    ],
  },
  {
    version: '1.10.1',
    date: '2026-01-24T18:00:00Z',
    title: 'Bug Fixes',
    items: [
      {
        category: 'fix',
        title: 'Fixed tier snapshot creation',
        description: 'Creating new tiers now properly initializes player slots',
      },
      {
        category: 'fix',
        title: 'Fixed loot history week selector',
        description: 'Week dropdown now correctly shows available weeks',
      },
    ],
  },
  {
    version: '1.10.0',
    date: '2026-01-23T20:00:00Z',
    title: 'Heavyweight Tier Support',
    highlights: ['AAC Heavyweight (M9S-M12S) raid tier', 'New tier rollover flow'],
    items: [
      {
        category: 'feature',
        title: 'AAC Heavyweight tier support',
        description: 'Full support for the 7.4 savage raid tier (M9S-M12S)',
        details:
          'Item levels, floor drops, and upgrade materials are configured for the new tier. Create a new heavyweight snapshot to start tracking your static\'s progress.',
      },
      {
        category: 'feature',
        title: 'Tier rollover flow',
        description: 'Easily create a new tier snapshot with your existing roster',
        details:
          'When creating a new tier, you can now choose to copy your current roster. Player names, jobs, and positions are preserved - just update BiS links for the new tier.',
      },
    ],
  },
];
