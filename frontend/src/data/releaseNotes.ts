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

export const CURRENT_VERSION = '1.1.0';

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
    version: '1.1.0',
    date: '2026-01-20T08:00:00Z',
    title: 'BiS Source Confirmation Dialogs',
    highlights: ['Confirmation when changing BiS source with imported data', 'Gear progress reset on source change'],
    items: [
      {
        category: 'feature',
        title: 'BiS source change confirmation',
        description: 'Shows confirmation when changing BiS source on slots with imported item data',
        details:
          'When you change the BiS source (Raid/Tome/Crafted) on a slot that has imported item data, a confirmation dialog now appears showing a visual comparison of your current gear icon and name versus the new source. Full item tooltip available on hover. Helps prevent accidental loss of imported BiS configurations.',
        commits: [{ hash: '8bcd8b4', message: 'feat: add confirmation dialogs for BiS source changes' }],
      },
      {
        category: 'improvement',
        title: 'Gear progress reset on source change',
        description: 'Changing BiS source now properly resets all gear progress and metadata',
        details:
          'When changing BiS source, hasItem, isAugmented, and all item metadata are now reset. Switching to Tome starts unchecked. This ensures accurate tracking when you change your BiS target.',
        commits: [{ hash: '8bcd8b4', message: 'feat: add confirmation dialogs for BiS source changes' }],
      },
      {
        category: 'improvement',
        title: 'ConfirmModal header prop',
        description: 'ConfirmModal now supports custom header content above the warning box',
        commits: [{ hash: '8bcd8b4', message: 'feat: add confirmation dialogs for BiS source changes' }],
      },
    ],
  },
  {
    version: '1.0.15',
    date: '2026-01-20T02:15:00Z',
    title: 'Discord Workflow Path Fix',
    highlights: ['Fixed version detection from scripts directory'],
    items: [
      {
        category: 'fix',
        title: 'Version detection working directory',
        description:
          'Fixed git diff path resolution when Discord changelog script runs from scripts/ directory. Now uses absolute path via git rev-parse.',
        commits: [{ hash: '55122f4', message: 'fix: use absolute path in didVersionChange for workflow compatibility' }],
      },
    ],
  },
  {
    version: '1.0.14',
    date: '2026-01-20T00:41:13Z',
    title: 'Discord Version Detection Fix',
    highlights: ['Fixed release announcement detection'],
    items: [
      {
        category: 'fix',
        title: 'Discord release announcement detection',
        description: 'Now triggers on any releaseNotes.ts change',
        details:
          'Simplified version detection to trigger a release announcement whenever releaseNotes.ts is modified, rather than specifically checking for CURRENT_VERSION line changes. This is more reliable and less error-prone.',
        commits: [{ hash: 'fbe6b03', message: 'fix(discord): improve version change detection reliability' }],
      },
    ],
  },
  {
    version: '1.0.13',
    date: '2026-01-20T00:27:08Z',
    title: 'Discord Changelog Improvements',
    highlights: ['Release-only embeds', 'Dominant category colors'],
    items: [
      {
        category: 'improvement',
        title: 'Release-only Discord embeds',
        description: 'Version releases now post a single clean embed',
        details:
          'When a new version is released, only the release announcement embed is posted to Discord. Previously, both a release embed and a commit embed were posted, cluttering the changelog channel.',
        commits: [{ hash: '8f38e0d', message: 'fix(discord): post release-only embeds and use dominant category color' }],
      },
      {
        category: 'improvement',
        title: 'Dominant category embed colors',
        description: 'Discord embed borders reflect the most common change type',
        details:
          'The left border color on Discord release embeds now reflects the dominant category. A release with 8 fixes and 3 features shows red (fix color). Previously used priority order where any release with features always showed green.',
        commits: [{ hash: '8f38e0d', message: 'fix(discord): post release-only embeds and use dominant category color' }],
      },
    ],
  },
  {
    version: '1.0.12',
    date: '2026-01-19T23:51:47Z',
    title: 'UI Consistency Sprint',
    highlights: ['Unified loading spinners', 'Consistent border radius'],
    items: [
      {
        category: 'improvement',
        title: 'Unified Spinner Component',
        description: 'Consistent loading indicators across all pages',
        details:
          'All loading spinners now use a unified Spinner component with consistent sizing (sm/md/lg/xl/2xl) and styling. Button loading states also use the same component.',
        commits: [{ hash: '7da0bd5', message: 'feat: UI consistency sprint - spinners, border radius, error patterns' }],
      },
      {
        category: 'improvement',
        title: 'Standardized Border Radius',
        description: 'Consistent rounded corners throughout the UI',
        details:
          'Eliminated mixed border radius values. Now uses a clear scale: rounded (4px) for tooltips, rounded-lg (8px) for cards/buttons/containers, rounded-xl (12px) for feature sections.',
        commits: [{ hash: '7da0bd5', message: 'feat: UI consistency sprint - spinners, border radius, error patterns' }],
      },
      {
        category: 'improvement',
        title: 'ErrorBox Component',
        description: 'Simple inline error display for modals and panels',
        details:
          'New ErrorBox component for contextual errors. Pattern: ErrorMessage (dismissible/retryable), ErrorBox (simple inline), InlineError (form validation), toast (transient).',
        commits: [{ hash: '7da0bd5', message: 'feat: UI consistency sprint - spinners, border radius, error patterns' }],
      },
      {
        category: 'fix',
        title: 'Dashboard Toggle Size',
        description: 'Grid/list toggle now matches adjacent button sizes',
        commits: [{ hash: '541ed19', message: 'fix: dashboard toggle size and user menu focus ring' }],
      },
    ],
  },
  {
    version: '1.0.11',
    date: '2026-01-18T18:27:33Z',
    title: 'Security Hardening Sprint',
    highlights: ['CSRF protection', 'OAuth hardening'],
    items: [
      {
        category: 'improvement',
        title: 'CSRF Protection',
        description: 'Double-submit cookie pattern for all state-changing requests',
        details:
          'All POST, PUT, DELETE requests now require a CSRF token to prevent cross-site request forgery attacks. The token is automatically handled by the frontend API client.',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'improvement',
        title: 'OAuth State Hardening',
        description: 'Client fingerprint binding prevents session fixation',
        details:
          'OAuth state tokens are now bound to client fingerprints, preventing session fixation attacks where an attacker could trick a user into authenticating to the attacker\'s account.',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'improvement',
        title: 'SSRF Protection',
        description: 'Redirect rejection on all external API calls',
        details:
          'All external HTTP requests (BiS imports from XIVGear, Etro, etc.) now reject redirects to prevent server-side request forgery attacks that could access internal services.',
        commits: [{ hash: '2262f5c', message: 'fix(security): Session 4 - CSP header and SSRF prevention (#33)' }],
      },
      {
        category: 'improvement',
        title: 'Request Size Limits',
        description: '10MB limit prevents DoS attacks',
        details:
          'All API requests are now limited to 10MB to prevent denial-of-service attacks through oversized payloads.',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'improvement',
        title: 'Request ID Tracking',
        description: 'UUID correlation for all requests',
        details:
          'Every API request now receives a unique request ID for correlation in logs. Makes debugging and security auditing much easier.',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'improvement',
        title: 'JWT Algorithm Restriction',
        description: 'Type-safe HS256/384/512 only',
        details:
          'JWT token verification is now restricted to HMAC algorithms only (HS256, HS384, HS512), preventing algorithm confusion attacks.',
        commits: [{ hash: '4db4624', message: 'fix: Phase 1 Critical Issues - Auth Hardening & Admin Performance (#31)' }],
      },
      {
        category: 'improvement',
        title: 'Security Event Logging',
        description: 'Permission denials and admin access logged',
        details:
          'Security-relevant events like permission denials and admin access are now logged for audit purposes.',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'fix',
        title: 'Database Constraints',
        description: 'CHECK constraints on week_number columns',
        details:
          'Added CHECK constraints to ensure week_number values are always positive integers, preventing invalid data from being stored.',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
    ],
  },
  {
    version: '1.0.10',
    date: '2026-01-16T11:32:44Z',
    title: 'Loot Priority UX & Score Tooltips',
    highlights: ['Weapon priority tie styling redesign', 'Priority score breakdown tooltips'],
    items: [
      {
        category: 'feature',
        title: 'Weapon priority connector line styling',
        description: 'Redesigned tie group visualization with collapsible sections',
        details:
          'Tied weapon priority entries now display with a connector line (dots + vertical line) design. Tie sections are collapsible - click the chevron to expand/collapse. After rolling for winner, the winner\'s job icon and name appear inline in the header for quick visibility without expanding.',
      },
      {
        category: 'feature',
        title: 'Priority score breakdown tooltips',
        description: 'Hover over any priority score to see the full calculation breakdown',
        details:
          'Both Gear Priority and Weapon Priority scores now show tooltips on hover with the full breakdown. Gear scores show: Role Priority, Gear Needed (weighted), Loot Adjustment. Weapon scores show: Main Job Bonus, Role Priority, List Position. Enhanced scores also display No Drops Bonus and Fair Share Adjustment when active.',
      },
      {
        category: 'improvement',
        title: 'Gear slot icons in priority panels',
        description: 'Gear Priority and Who Needs It panels display slot icons',
        details:
          'Each gear slot in the Gear Priority and Who Needs It panels now shows the corresponding gear slot icon (same icons used in player cards without imported BiS). Icons are locally stored with multiple color variants available.',
      },
      {
        category: 'improvement',
        title: 'Icon Gallery developer tool',
        description: 'Visual reference page for all custom icons',
        details:
          'New /icon-gallery.html page shows all gear slot icons (10 color variants), upgrade material icons (original + silhouettes), and job icons. Includes XIVAPI URLs and regeneration commands for icon processing.',
      },
      {
        category: 'improvement',
        title: 'BiS import modal improvements',
        description: 'Better UX for importing gear sets',
        details:
          'BiS import modal now defaults to the first preset in the list. Select component highlights selected items more clearly. Gear tooltips always show on hover for quick reference.',
        commits: [
          { hash: '6e5ca21', message: 'feat: BiS modal UX improvements and gear tooltips' },
          { hash: '940af1d', message: 'feat: default BiS import preset to first item in list' },
        ],
      },
      {
        category: 'fix',
        title: 'Select highlight styling',
        description: 'Fixed Select component to show proper highlight on selected items',
        details:
          'The Select dropdown now properly highlights the currently selected item with the accent color, making it clearer which option is active.',
        commits: [{ hash: 'c746be3', message: 'fix: Select highlight styling and player reassignment state sync' }],
      },
      {
        category: 'fix',
        title: 'Player reassignment state sync',
        description: 'Fixed state synchronization when reassigning players',
        details:
          'When reassigning a player to a different user, the UI state now properly syncs to reflect the change immediately without requiring a refresh.',
        commits: [{ hash: 'c746be3', message: 'fix: Select highlight styling and player reassignment state sync' }],
      },
      {
        category: 'fix',
        title: 'Healer slot label updates',
        description: 'Healer position labels now correctly reflect selected job type',
        details:
          'When selecting a job in healer slots, the label now updates to show the specific healer type (Pure Healer/Shield Healer) based on the selected job rather than the template position.',
        commits: [
          { hash: '72d6528', message: 'fix: show specific healer type in slot label for all positions' },
          { hash: 'd3bcd19', message: 'fix: update slot label when healer type differs from position' },
          { hash: '690c8df', message: 'fix: update healer quick-select buttons based on selected job type' },
        ],
      },
      {
        category: 'fix',
        title: 'Modal backdrop rendering',
        description: 'Removed backdrop blur from modals to prevent rendering artifacts',
        details:
          'Modal backdrops no longer use backdrop-blur CSS which was causing visual artifacts on some systems. The overlay effect now uses opacity alone for consistent rendering.',
        commits: [{ hash: '01e6d4d', message: 'fix: remove backdrop blur from Modal to prevent rendering artifacts' }],
      },
    ],
  },
  {
    version: '1.0.9',
    date: '2026-01-15T22:56:32Z',
    title: 'Session Stability',
    highlights: ['Fixed session timeouts', 'Improved token refresh'],
    items: [
      {
        category: 'fix',
        title: 'Session timeout after 15 minutes',
        description: 'Fixed 401 errors that occurred after ~15 minutes of active use',
        details:
          'The access token expires every 15 minutes and should automatically refresh. However, when multiple API calls failed simultaneously, each tried to refresh independently, hitting rate limits and causing errors. Now uses a singleton pattern where all failing requests share a single refresh, preventing rate limit issues.',
        commits: [{ hash: 'a611b64', message: 'fix: session expiry auth handling and UI improvements (#30)' }],
      },
      {
        category: 'improvement',
        title: 'Admin pages use standard API client',
        description: 'Admin Dashboard and View As now use the shared API wrapper',
        details:
          'Previously, admin pages used raw fetch() calls that bypassed automatic token refresh. Now they use the standard API client with automatic 401 handling, retry logic, and proper error types.',
        commits: [{ hash: 'e4080bb', message: 'fix: use api wrapper for automatic token refresh in admin pages (#24)' }],
      },
    ],
  },
  {
    version: '1.0.8',
    date: '2026-01-11T19:05:13Z',
    title: 'Admin Assignment & Polish',
    highlights: ['Assign players to users', 'Role-colored badges'],
    items: [
      {
        category: 'feature',
        title: 'Admin player assignment',
        description: 'Owners and admins can assign Discord users to player cards',
        details:
          'Right-click a player card and select "Assign Player" to link a Discord user. Choose from existing members or enter a user ID manually. The assigned user can then edit their own player card. If the user isn\'t already a member, they\'ll be added with Member role automatically.',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'feature',
        title: 'Role-colored player badges',
        description: 'Linked users show their membership role with colored badges',
        details:
          'Player cards now display the linked user\'s role with color-coded badges: Owner (teal), Lead (purple), Member (blue), and Linked-only (amber for users linked but not members). Makes it easy to see who has what permissions at a glance.',
        commits: [{ hash: '94850ad', message: 'feat(admin): navigation-based admin mode + player badge colors (#22)' }],
      },
      {
        category: 'feature',
        title: 'Double-click confirm pattern',
        description: 'Dangerous actions require click-to-arm, click-to-confirm',
        details:
          'Destructive actions like revoking invitations or clearing history now use a double-click confirmation pattern. First click arms the button (shows "Confirm?"), second click executes. Auto-resets after 3 seconds or when you click away.',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'improvement',
        title: 'Modal header icons',
        description: 'All modals now have contextual icons in their headers',
        details:
          'Modals display relevant icons next to their titles for better visual context. Danger modals show trash/reset icons in red/warning colors, action modals show contextual icons like package for loot or gem for materials.',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'improvement',
        title: 'Job icons in recipient dropdowns',
        description: 'Loot recipient selectors show job icons',
        details:
          'When selecting a loot recipient, you now see job icons next to player names, making it easier to identify the correct player especially when multiple players have similar names.',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'improvement',
        title: 'Static Settings polish',
        description: 'Tab icons and proper danger button styling',
        details:
          'The Static Settings modal now displays icons on each tab and uses proper danger button styling for destructive actions like deleting a static or leaving a group.',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'fix',
        title: 'Race condition handling',
        description: 'Membership creation handles concurrent requests gracefully',
        details:
          'When two requests try to create the same membership simultaneously, the system now handles this gracefully by returning the existing membership instead of throwing an error. Prevents "already a member" errors during rapid operations.',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'fix',
        title: 'Input validation for user IDs',
        description: 'Discord ID and UUID format validation in assignment modal',
        details:
          'The manual user ID input now validates the format before submission. Accepts Discord IDs (17-19 digit snowflakes) or UUIDs. Shows inline error message for invalid formats.',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'improvement',
        title: 'Comprehensive test coverage',
        description: '23 new backend tests for player assignment',
        details:
          'Added comprehensive test coverage for the admin player assignment feature, including permission checks, edge cases, race conditions, and integration tests. Backend now has 160 tests total.',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
    ],
  },
  {
    version: '1.0.7',
    date: '2026-01-11T10:04:21Z',
    title: 'Audit Complete',
    highlights: ['Skeleton loaders', 'Reusable hooks'],
    items: [
      {
        category: 'feature',
        title: 'Skeleton loading states',
        description: 'Loading placeholders for Dashboard static cards',
        details:
          'Dashboard now shows skeleton placeholders while loading your statics instead of a blank screen. Both grid and list views have dedicated skeleton components that match the final layout, improving perceived performance.',
        commits: [{ hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' }],
      },
      {
        category: 'feature',
        title: 'useModal hook',
        description: 'Reusable modal state management',
        details:
          'New useModal and useModalWithData hooks eliminate boilerplate for modal open/close state. useModalWithData also handles passing data to the modal when opening it.',
        commits: [{ hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' }],
      },
      {
        category: 'feature',
        title: 'useDebounce hook',
        description: 'Debounce utilities for values and callbacks',
        details:
          'New useDebounce hook for debouncing values (useful for search inputs) and useDebouncedCallback for debouncing function calls. Prevents excessive API calls and re-renders during rapid input.',
        commits: [{ hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' }],
      },
      {
        category: 'feature',
        title: 'ErrorMessage component',
        description: 'Error display with retry button',
        details:
          'New ErrorMessage component displays errors consistently with an optional retry button. InlineError variant for compact inline display. Both support custom styling and messaging.',
        commits: [{ hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' }],
      },
      {
        category: 'improvement',
        title: 'Button component variants',
        description: 'Added success and link button variants',
        details:
          'Button component now has 7 variants: primary, secondary, danger, warning, success, ghost, and link. All variants support loading states, disabled states, and icon placement.',
        commits: [{ hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' }],
      },
      {
        category: 'improvement',
        title: 'Audit resolution',
        description: 'All actionable audit items resolved',
        details:
          'Completed all P0-P2 audit items from v1.0.1-v1.0.6 audits. Only R-002 (props drilling) remains intentionally deferred as hooks adequately mitigate the issue.',
        commits: [
          { hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' },
          { hash: 'd10870b', message: 'perf: Add React.memo to list items to prevent unnecessary re-renders (MEDIUM-002) (#20)' },
          { hash: '39b13c1', message: 'refactor: Split SectionedLogView component (HIGH-008) (#19)' },
        ],
      },
    ],
  },
  {
    version: '1.0.6',
    date: '2026-01-11T03:23:27Z',
    title: 'Security Hardening',
    highlights: ['httpOnly cookie auth', 'XSS protection'],
    items: [
      {
        category: 'improvement',
        title: 'httpOnly cookie authentication',
        description: 'Tokens now stored in secure httpOnly cookies instead of localStorage',
        details:
          'Authentication tokens are now stored in httpOnly cookies that JavaScript cannot access. This protects against XSS attacks that could steal tokens from localStorage. Cookies are automatically sent with requests via credentials: include.',
        commits: [{ hash: 'c992e6e', message: 'security: migrate JWT tokens to httpOnly cookies (#18)' }],
      },
      {
        category: 'improvement',
        title: 'SameSite cookie protection',
        description: 'Cookies set with SameSite=Lax to prevent CSRF attacks',
        details:
          'All authentication cookies use SameSite=Lax attribute, preventing cross-site request forgery attacks. Cookies are only sent with same-site requests or top-level navigation.',
        commits: [{ hash: 'c992e6e', message: 'security: migrate JWT tokens to httpOnly cookies (#18)' }],
      },
      {
        category: 'improvement',
        title: 'Secure flag for production',
        description: 'Cookies only sent over HTTPS in production',
        details:
          'Authentication cookies in production are marked with the Secure flag, ensuring they are only transmitted over encrypted HTTPS connections.',
        commits: [{ hash: 'c992e6e', message: 'security: migrate JWT tokens to httpOnly cookies (#18)' }],
      },
      {
        category: 'improvement',
        title: 'Protected logout endpoint',
        description: 'Logout requires authentication to prevent CSRF logout attacks',
        details:
          'The logout endpoint now requires a valid access token. This prevents malicious sites from forcing users to logout via cross-site requests.',
        commits: [{ hash: 'da9e2d5', message: 'security: protect logout endpoint from CSRF by requiring authentication' }],
      },
      {
        category: 'fix',
        title: 'Token refresh on logout',
        description: 'Logout now works even with expired access tokens',
        details:
          'If your access token has expired when you click logout, the app now automatically refreshes it first to ensure cookies are properly cleared on the server.',
        commits: [{ hash: 'd57d175', message: 'fix: address cookie security issues in logout' }],
      },
      {
        category: 'fix',
        title: 'Auth state persistence',
        description: 'Fixed stale authentication state after cookie expiry',
        details:
          'The app no longer persists isAuthenticated to localStorage, preventing cases where the UI showed you as logged in after cookies expired. Auth state is now verified with the backend on app load.',
        commits: [{ hash: 'c992e6e', message: 'security: migrate JWT tokens to httpOnly cookies (#18)' }],
      },
    ],
  },
  {
    version: '1.0.5',
    date: '2026-01-10T18:28:06Z',
    title: 'Shortcuts & Polish',
    highlights: ['Redesigned shortcuts', 'Shortcut hints in menus'],
    items: [
      {
        category: 'improvement',
        title: 'Redesigned keyboard shortcuts',
        description: 'Browser-friendly shortcuts that never conflict with browser defaults',
        details:
          'Management shortcuts changed from Ctrl+P/T/R to Alt+Shift+P/N/R/S to avoid conflicts with browser Print, New Tab, and Refresh. Week navigation now uses Alt+Arrow instead of Ctrl+Arrow. All shortcuts now work reliably across Chrome, Firefox, and Safari.',
        commits: [{ hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' }],
      },
      {
        category: 'feature',
        title: 'Shortcut hints in settings menu',
        description: 'Keyboard shortcuts shown in the gear icon dropdown menu',
        details:
          'The settings gear menu now displays keyboard shortcuts next to each action (Add Player, New Tier, etc.). Makes shortcuts more discoverable without opening the help modal.',
        commits: [{ hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' }],
      },
      {
        category: 'improvement',
        title: 'Readable shortcut notation',
        description: 'Shortcuts shown as Ctrl+S instead of symbols like ⌃S',
        details:
          'All keyboard shortcuts throughout the app now use word notation (Ctrl+, Alt+, Shift+) instead of Mac-style symbols. More readable for all users regardless of platform.',
        commits: [{ hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' }],
      },
      {
        category: 'feature',
        title: 'Tips carousel in header',
        description: 'Rotating tips and tricks shown in the header bar',
        details:
          'A subtle tips carousel in the header shows helpful hints that cycle every 15 seconds. Tips are context-aware based on your current tab. Click to cycle faster, or dismiss permanently.',
        commits: [{ hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' }],
      },
      {
        category: 'fix',
        title: 'V key works on Weapon Priorities',
        description: 'Expand/collapse all now works on the Loot tab weapon priorities',
        details:
          'Pressing V on the Loot tab now properly toggles expand/collapse on the Weapon Priorities view. Previously only worked on Players and Log tabs.',
        commits: [{ hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' }],
      },
      {
        category: 'fix',
        title: 'Week navigation keyboard shortcut',
        description: 'Alt+Arrow now properly navigates weeks on Log tab',
        details:
          'Fixed the week navigation keyboard shortcuts on the Log tab. Alt+Left goes to previous week, Alt+Right to next week. Previously used Ctrl+Arrow which conflicted with browser cursor navigation.',
        commits: [
          { hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' },
          { hash: 'dbe36ec', message: 'fix: Resolve duplicate View As banners, focus ring artifacts, and Shift+S navigation' },
        ],
      },
    ],
  },
  {
    version: '1.0.4',
    date: '2026-01-10T23:52:39Z',
    title: 'Design System & UX',
    highlights: ['Cross-week navigation', 'Enhanced shortcuts'],
    items: [
      {
        category: 'feature',
        title: 'Cross-week loot navigation',
        description: 'Jump to loot entries in any week from player cards',
        details:
          'Clicking "Go to loot entry" from a player card now automatically switches to the correct week and highlights the entry. Previously required manually selecting the week first.',
        commits: [{ hash: 'c32f6b7', message: 'Design System V2 Migration - Complete Semantic Token Implementation (#15)' }],
      },
      {
        category: 'feature',
        title: 'Enhanced keyboard shortcuts',
        description: 'New shortcuts for logging and navigation',
        details:
          'Alt+L opens Log Loot modal, Alt+M opens Log Material modal, Alt+B opens Mark Floor Cleared. Shift+S navigates to My Statics. Shift+? shows keyboard shortcuts help. All shortcuts shown in menus and tooltips.',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'feature',
        title: 'Shift+Click to copy links',
        description: 'Quick link copying from player cards and loot entries',
        details:
          'Shift+Click on player cards or loot entries in the grid view to instantly copy a shareable link. Faster than right-click > Copy URL for power users.',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'feature',
        title: 'Keyboard Shortcuts in User menu',
        description: 'Quick access to shortcuts help from user dropdown',
        details:
          'New "Keyboard Shortcuts" item in the user dropdown menu with "?" hotkey hint. Opens the same help modal as pressing Shift+?.',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'improvement',
        title: 'Hotkey hints in UI',
        description: 'Keyboard shortcuts shown in tooltips and menus',
        details:
          'Action buttons (Log Loot, Log Material, Mark Floor Cleared) now show their hotkey in tooltips. My Statics menu item shows Shift+S hint. Improved discoverability for power users.',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'improvement',
        title: 'GearTable UI improvements',
        description: 'Cleaner gear table with better visual hierarchy',
        details:
          'Removed cramped Item name column for better small-screen support. CurrentSource column hidden by default (available in code for future use). BiS source toggle converted to compact button.',
        commits: [{ hash: 'c32f6b7', message: 'Design System V2 Migration - Complete Semantic Token Implementation (#15)' }],
      },
      {
        category: 'improvement',
        title: 'BiS Import modal enhancements',
        description: 'Job and gear icons in import modal',
        details:
          'BiS Import modal now shows job icons in preset list and gear slot icons when previewing imported sets. Easier to verify you\'re importing the right configuration.',
        commits: [{ hash: 'c32f6b7', message: 'Design System V2 Migration - Complete Semantic Token Implementation (#15)' }],
      },
      {
        category: 'fix',
        title: 'Week switching visual bug',
        description: 'Loot entries now appear immediately when navigating across weeks',
        details:
          'Fixed bug where loot entries wouldn\'t appear after jumping to a different week via player card navigation. Required refresh or manual week toggle before. Now updates instantly.',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'fix',
        title: 'Job change confirmation',
        description: 'Proper confirmation when changing player job',
        details:
          'Changing a player\'s job now shows a confirmation dialog warning about gear reset. Player card highlights briefly after job change to confirm the update.',
        commits: [{ hash: 'c32f6b7', message: 'Design System V2 Migration - Complete Semantic Token Implementation (#15)' }],
      },
    ],
  },
  {
    version: '1.0.3',
    date: '2026-01-09T23:53:42Z',
    title: 'Keyboard Shortcuts',
    highlights: ['Keyboard shortcuts', 'Documentation updates'],
    items: [
      {
        category: 'feature',
        title: 'Keyboard shortcuts',
        description: 'Quick navigation and controls for power users',
        details:
          'Press ? to see all available shortcuts. Use 1-4 to switch tabs (Players/Loot/Log/Summary), v and g to toggle view modes on the Players tab, and Escape to close modals. All modals now close with Escape key.',
        commits: [{ hash: '8e949e5', message: 'Add keyboard shortcuts for common actions' }],
      },
      {
        category: 'improvement',
        title: 'Updated documentation',
        description: 'Comprehensive status document updates and user guides',
        details:
          'Updated CONSOLIDATED_STATUS.md to reflect completed items from previous releases. Added keyboard shortcuts documentation to Member Guide and developer docs.',
        commits: [{ hash: '6795b62', message: 'Update status docs: mark completed items from previous PRs' }],
      },
    ],
  },
  {
    version: '1.0.2',
    date: '2026-01-09T23:06:02Z',
    title: 'UX Improvements',
    highlights: ['Grid view for loot logging', 'Material editing & sub filtering'],
    items: [
      {
        category: 'feature',
        title: 'Weekly Loot Grid view',
        description: 'Spreadsheet-style grid for viewing and logging weekly loot',
        details:
          'New grid view in the Log tab shows loot distribution across players by floor. Click cells to log items, right-click for context menus. Includes loot count summary bar with fairness indicators and floor-colored headers.',
        commits: [
          { hash: '99b8fb8', message: 'Add context menus, subs toggle, and floor selector alignment' },
          { hash: '4222d36', message: 'UX improvements phase 2 - quick wins' },
        ],
      },
      {
        category: 'feature',
        title: 'Unified floor selectors',
        description: 'Consistent colored floor tabs across all panels',
        details:
          'Floor selectors in Gear Priorities, Who Needs It, and Log By Floor views now all use the same floor-colored button tab style. Improved visual consistency and accessibility with aria-pressed attributes.',
        commits: [{ hash: '1944057', message: 'Implement four UX improvements' }],
      },
      {
        category: 'feature',
        title: 'Smart tab navigation',
        description: 'Automatic tab selection when switching statics',
        details:
          'When switching to a static with no players, automatically shows the Players tab. When switching to a static with players, preserves your current tab selection. Prevents confusion when navigating between statics.',
        commits: [{ hash: '1944057', message: 'Implement four UX improvements' }],
      },
      {
        category: 'feature',
        title: 'Dashboard context menus',
        description: 'Right-click static cards for quick actions',
        details:
          'Static group cards on the Dashboard now have context menus with quick access to Open, Rename, Copy Share Code, and Delete (for owners). Streamlines common management tasks.',
        commits: [{ hash: '1944057', message: 'Implement four UX improvements' }],
      },
      {
        category: 'feature',
        title: 'Release Notes navigation',
        description: 'Collapsible version sections with scroll-synced nav',
        details:
          'Release Notes page redesigned with collapsible version sections and a sticky navigation panel. Click version numbers to jump to that release. Auto-expands sections when scrolling or navigating via URL hash.',
        commits: [{ hash: '1944057', message: 'Implement four UX improvements' }],
      },
      {
        category: 'improvement',
        title: 'Subs toggle styling',
        description: 'Substitute players toggle matches G1/G2 style',
        details:
          'The Subs toggle button now has the same icon and accent color style as G1/G2 toggles. Works independently from group view toggles - you can show subs without enabling G1/G2 split.',
        commits: [{ hash: '15a7d36', message: 'Fix UX issues from manual testing' }],
      },
      {
        category: 'improvement',
        title: 'Admin Dashboard improvements',
        description: 'Better column headers and view-as functionality',
        details:
          'Column sort icons now always rendered to prevent layout shift when sorting. Added reserved space for action icons in the Actions column.',
        commits: [
          { hash: '4dee7da', message: 'Address PR #11 feedback and add admin UX improvements' },
          { hash: '15a7d36', message: 'Fix UX issues from manual testing' },
        ],
      },
      {
        category: 'improvement',
        title: 'Accessibility enhancements',
        description: 'Keyboard navigation and screen reader support',
        details:
          'Grid cells now have proper keyboard navigation with role="button", tabIndex, and Enter/Space handlers. Floor selector buttons have aria-pressed. Version navigation has aria-labels. Subs toggle has aria-label.',
        commits: [
          { hash: '24e00c1', message: 'Address PR feedback: accessibility attrs for grid cells, event listener cleanup' },
          { hash: '6bcaf91', message: 'Address PR feedback: consistent setPageMode, aria-labels for toggles and nav' },
          { hash: 'd565ee9', message: 'Address PR feedback: canEdit check, aria-pressed, status updates' },
        ],
      },
      {
        category: 'fix',
        title: 'Grid context menu permissions',
        description: 'Edit/Delete options now respect canEdit permission',
        details:
          'Fixed security bug where grid context menu showed Edit/Delete options to users without edit permission. Now properly checks canEdit before displaying these options.',
        commits: [{ hash: 'd565ee9', message: 'Address PR feedback: canEdit check, aria-pressed, status updates' }],
      },
      {
        category: 'fix',
        title: 'Loot edit gear sync',
        description: 'Editing loot recipient now updates both player cards',
        details:
          'When editing a loot entry and changing the recipient, the old recipient\'s gear checkbox is now properly unchecked and the new recipient\'s is checked. Previously only worked for new entries.',
        commits: [{ hash: '15a7d36', message: 'Fix UX issues from manual testing' }],
      },
      {
        category: 'fix',
        title: 'Grid URL highlight',
        description: 'Deep links to loot entries now highlight in grid view',
        details:
          'URLs with ?entry=123 parameter now properly highlight the corresponding cell in grid view with a pulse animation. Previously only worked in list view.',
        commits: [{ hash: '15a7d36', message: 'Fix UX issues from manual testing' }],
      },
      {
        category: 'fix',
        title: 'Layout shift fixes',
        description: 'Prevented UI jumping when switching views',
        details:
          'Fixed layout shift when switching between By Floor and Timeline views in Log tab. Floor filter now uses invisible class instead of conditional rendering.',
        commits: [{ hash: '15a7d36', message: 'Fix UX issues from manual testing' }],
      },
      {
        category: 'feature',
        title: 'Material log editing',
        description: 'Edit existing material entries from Log tab',
        details:
          'Click existing material cells in grid view or use context menu in list view to edit material log entries. Supports changing recipient, week, and notes.',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'feature',
        title: 'Substitute player filtering',
        description: 'Subs excluded from priority calculations by default',
        details:
          'Substitute players are now excluded from Loot Priority tab, Summary tab, and Mark Floor Cleared modal. Loot logging modals have an "Include Subs" checkbox to optionally include substitutes in recipient lists.',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'fix',
        title: 'Admin banner display',
        description: 'Fixed admin access banner not appearing',
        details:
          'Admin users now correctly see the amber "Admin Access" banner when viewing statics they don\'t belong to. The isAdminAccess flag is now properly returned from all API endpoints.',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'fix',
        title: 'Admin dashboard sorting',
        description: 'Fixed sorting by member count, tier count, and owner',
        details:
          'Sorting in Admin Dashboard now works correctly for computed columns (member count, tier count) and owner information using optimized subqueries.',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'fix',
        title: 'iLv calculation accuracy',
        description: 'Fixed inflated averages for unconfigured gear',
        details:
          'Players with few gear slots configured no longer show inflated iLv. Unknown/unconfigured slots now use crafted gear baseline (770) instead of being excluded from the average.',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'fix',
        title: 'Mark Floor Cleared state reset',
        description: 'Modal now resets properly when reopened',
        details:
          'Fixed bug where Mark Floor Cleared modal retained previous selections. Modal state now properly resets when opened.',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
    ],
  },
  {
    version: '1.0.1',
    date: '2026-01-09T11:35:01Z',
    title: 'Performance & Reliability',
    highlights: ['Bulk group duplication', '228 automated tests'],
    items: [
      {
        category: 'feature',
        title: 'Bulk group duplication',
        description: 'Duplicate static groups with a single API call',
        details:
          'New bulk duplication endpoint replaces 40+ individual API calls with a single transaction. Includes options to copy tiers and players, with proper reset of tracking data and ownership.',
        commits: [
          { hash: '0ba99c7', message: 'Combined audit improvements: performance, testing, and utilities' },
        ],
      },
      {
        category: 'feature',
        title: 'Frontend utilities',
        description: 'New error handler, logger, and event bus utilities',
        details:
          'Centralized error parsing with HTTP status messages, development-aware logging with scoping and timing, and pub/sub event bus for cross-component communication.',
        commits: [
          { hash: '0ba99c7', message: 'Combined audit improvements: performance, testing, and utilities' },
        ],
      },
      {
        category: 'feature',
        title: 'Skeleton loading components',
        description: 'Loading placeholder components for better perceived performance',
        details:
          'New skeleton components show loading states while data is being fetched, improving user experience during slow network conditions.',
      },
      {
        category: 'improvement',
        title: 'Database performance',
        description: 'Added 6 database indexes for faster queries',
        details:
          'New indexes on snapshot_players.position, loot entries, material entries, and page ledger entries. Improves query performance especially for large groups with extensive loot history.',
        commits: [
          { hash: '0ba99c7', message: 'Combined audit improvements: performance, testing, and utilities' },
        ],
      },
      {
        category: 'improvement',
        title: 'Zustand selector hooks',
        description: '11 new selector hooks for optimized component re-renders',
        details:
          'Specialized selector hooks like useTierPlayers, usePlayersByGroup, and useCurrentTierMeta prevent unnecessary re-renders by only subscribing to relevant state slices.',
        commits: [
          { hash: '0ba99c7', message: 'Combined audit improvements: performance, testing, and utilities' },
        ],
      },
      {
        category: 'improvement',
        title: 'Bundle optimization',
        description: 'Vite manual chunks for faster loading',
        details:
          'Split vendor bundles into react-vendor, state management, drag-and-drop, Radix UI, and icons. Improves caching and reduces initial load time.',
      },
      {
        category: 'improvement',
        title: 'Production config validation',
        description: 'Automatic validation of production environment settings',
        details:
          'Backend now validates JWT secret strength, debug mode, SQLite rejection for production, and warns about missing CORS configuration. Prevents common deployment mistakes.',
      },
      {
        category: 'improvement',
        title: 'Comprehensive test suite',
        description: '238 automated tests across backend and frontend',
        details:
          'Backend: 96 tests covering auth, config validation, group duplication, tier activation, and API response validation. Frontend: 142 tests for error handling, logging, event bus, and Zustand selectors.',
        commits: [
          { hash: '0df6fa9', message: 'Add comprehensive integration tests for PR #9' },
        ],
      },
      {
        category: 'fix',
        title: 'Tier activation logic',
        description: 'Fixed bug where re-activating an active tier could cause issues',
        details:
          'Changed tier deactivation from SELECT+loop to bulk UPDATE statement. Now properly handles edge cases like re-activating already active tiers and ensures only one tier is active per group.',
        commits: [
          { hash: '037caba', message: 'Fix tier activation bug and update test dates' },
          { hash: '050dfb4', message: 'Fix useShallow import and tier duplication is_active handling' },
        ],
      },
      {
        category: 'fix',
        title: 'Auth store circular dependency',
        description: 'Fixed initialization error on app load',
        details:
          'Resolved circular dependency between authStore and api modules by extracting API_BASE_URL to a separate config module. Prevents "Cannot access before initialization" errors.',
        commits: [
          { hash: 'b1b8b39', message: 'Fix circular dependency between authStore and api' },
        ],
      },
      {
        category: 'fix',
        title: 'Group duplication improvements',
        description: 'Fixed settings deep copy and active tier handling',
        details:
          'Group settings are now properly deep copied to prevent shared references. Only one tier remains active after duplication, even if source had multiple active tiers.',
        commits: [
          { hash: '360ecf2', message: 'Address final PR feedback' },
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-09T06:19:03Z',
    title: 'Documentation & Polish',
    highlights: ['Comprehensive documentation', 'Deep linking & Copy URL'],
    items: [
      {
        category: 'feature',
        title: 'Documentation hub',
        description: 'New /docs section with guides for leads and members',
        details:
          'Complete documentation system with role-based guides (Leads vs Members), common tasks reference, and technical documentation. Includes Getting Started guides, API reference, loot math explanations, and design system documentation.',
        link: { href: '/docs', label: 'View Documentation' },
        commits: [{ hash: 'c9f1672', message: 'Add comprehensive documentation system' }],
      },
      {
        category: 'feature',
        title: 'Roadmap & Status page',
        description: 'Development plan and current state visibility',
        details:
          'New page showing completed phases, planned features, and known issues. Helps users understand what features exist and what\'s coming next.',
        link: { href: '/docs/roadmap', label: 'View Roadmap' },
        commits: [{ hash: '0bda88a', message: 'Add Roadmap & Status documentation page' }],
      },
      {
        category: 'feature',
        title: 'API reference & cookbook',
        description: 'Full API documentation with Python and curl examples',
        details:
          'Interactive API documentation covering all endpoints: authentication, static groups, tier snapshots, players, loot logging, and BiS import. Includes a cookbook with copy-paste examples for common workflows.',
        link: { href: '/docs/api', label: 'View API Docs' },
      },
      {
        category: 'feature',
        title: 'Loot math documentation',
        description: 'Detailed explanations of priority calculations and formulas',
        details:
          'Deep dive into how priority scores are calculated, including role-based weighting, slot value weights, weapon priority system, and the book/page economy.',
        link: { href: '/docs/loot-math', label: 'View Loot Math' },
      },
      {
        category: 'feature',
        title: 'Release notes system',
        description: 'Track updates with version history and new release notifications',
        details:
          'New release banner appears when updates are deployed. Dismissible by clicking X or viewing release notes. Version history page shows all releases with categorized changes.',
        link: { href: '/docs/release-notes', label: 'View Release Notes' },
      },
      {
        category: 'feature',
        title: 'Deep linking & shareable URLs',
        description: 'Share links to specific tabs, views, players, and loot entries',
        details:
          'URLs now capture your current view state. Share a link to jump directly to a specific tab, floor, sort order, or even highlight a specific player card or loot entry. Parameters include: tab, subtab, floor, view, groups, sort, logLayout, logView, weaponFilter, player, and entry.',
        commits: [
          { hash: 'deb7919', message: 'Add extended deep linking and Copy URL features' },
          { hash: '24c4b66', message: 'Add URL deep linking for tabs and documentation anchors' },
        ],
      },
      {
        category: 'feature',
        title: 'Copy URL for players and loot entries',
        description: 'Right-click player cards or hover loot entries to copy shareable links',
        details:
          'New "Copy URL" option in player card context menu and on loot entry hover. When someone follows the link, the item briefly highlights with a teal glow animation to draw attention.',
        commits: [{ hash: 'deb7919', message: 'Add extended deep linking and Copy URL features' }],
      },
      {
        category: 'improvement',
        title: 'Auto-expand weapon priority on ties',
        description: 'Weapon priority section now auto-expands when there are rolling ties',
        details:
          'When multiple players are tied for weapon priority, the weapon priority section automatically expands to show the tie-breaker information.',
        image: '/images/release-notes/weapon-priorities.gif',
        commits: [{ hash: 'fe1cb55', message: 'Auto-expand weapon priority section when rolling ties' }],
      },
      {
        category: 'fix',
        title: 'Weapon job tracking in loot log',
        description: 'Fixed weapon logging to properly track job assignments',
        details:
          'Weapon drops now correctly record which job the weapon was assigned to. This affects both the loot log history and weapon priority calculations.',
        image: '/images/release-notes/weapon-type.png',
        commits: [
          { hash: 'a3c454b', message: 'Fix weapon job tracking in loot log and priority updates' },
          { hash: '24acf84', message: 'Improve weapon logging with job tracking and extra loot tagging' },
        ],
      },
      {
        category: 'fix',
        title: 'Universal tomestone integration',
        description: 'Fixed TypeScript errors for universal tomestone tracking',
        image: '/images/release-notes/universal-tomestone.gif',
        commits: [{ hash: '7a43c87', message: 'Fix TypeScript errors for Universal Tomestone integration' }],
      },
      {
        category: 'fix',
        title: 'Auth persistence improvements',
        description: 'Better handling of login state across sessions',
        details:
          'Fixed issues where users would be logged out unexpectedly. Improved token refresh handling and session persistence.',
        commits: [{ hash: '6054c9f', message: 'Fix auth persistence and session handling' }],
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-01-05T01:30:50Z',
    title: 'Design System v2 & Accessibility',
    highlights: ['WCAG compliance', 'Improved components'],
    items: [
      {
        category: 'feature',
        title: 'Design System v2',
        description: 'Major component library update with improved accessibility',
        details:
          'Comprehensive update to the design system including new tokens, icons, forms, menus, navigation, and scroll-lock fixes. Improved contrast ratios and keyboard navigation.',
        link: { href: '/docs/design-system', label: 'View Design System' },
        commits: [
          { hash: 'd5f8f8d', message: 'Design System v2 + UX Improvements' },
          { hash: 'd08c5e1', message: 'Design System v2.2.0: Menus, navigation, and scroll-lock fixes' },
          { hash: '293681d', message: 'Design System v2.1.0: Tokens, icons, forms, and accessibility fixes' },
        ],
      },
      {
        category: 'improvement',
        title: 'WCAG accessibility updates',
        description: 'Improved color contrast, keyboard navigation, and screen reader support',
        details:
          'Updated Radix Select components, improved tooltip layouts, fixed scroll-lock issues for better accessibility compliance.',
        commits: [
          { hash: '587b095', message: 'Design System WCAG updates: Radix Select, tooltips layout, scroll-lock fixes' },
          { hash: 'aec35db', message: 'Fix Radix Select scroll-lock breaking sticky nav' },
        ],
      },
      {
        category: 'improvement',
        title: 'Sidebar navigation',
        description: 'Added collapsible navigation panel to documentation pages',
        details:
          'Documentation pages now have a sticky sidebar with grouped navigation. All sections are collapsible and support scroll tracking.',
        commits: [
          { hash: '82be733', message: 'Add sidebar navigation to DesignSystem page' },
          { hash: '17a305e', message: 'Grouped navigation and Nav Panel section' },
        ],
      },
      {
        category: 'fix',
        title: 'Scroll tracking improvements',
        description: 'Fixed navigation highlighting to use "most recently scrolled past" algorithm',
        commits: [
          { hash: 'b914b38', message: 'Improve nav scroll tracking with better algorithm' },
          { hash: 'c1c5fe6', message: 'Fix nav click race condition with scroll lock pattern' },
        ],
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-01-03T20:08:30Z',
    title: 'UX Enhancements',
    highlights: ['Player card redesign', 'Weekly loot grid'],
    items: [
      {
        category: 'feature',
        title: 'Weekly Loot Grid view',
        description: 'Visual grid showing who got what loot each week',
        details:
          'New grid view displaying loot distribution across the raid group by week. Click on cells to quickly log loot.',
        commits: [{ hash: '542760f', message: 'Add Weekly Loot Grid view' }],
      },
      {
        category: 'feature',
        title: 'Weapon priority job selector',
        description: 'Redesigned modal with selection order badges',
        details:
          'Weapon priority modal redesigned with a single panel layout and popup job selector. Shows numbered badges indicating selection order.',
        commits: [
          { hash: '3978085', message: 'Redesign Weapon Priority modal: single panel with popup job selector' },
          { hash: '16d79c0', message: 'Add selection order badges to weapon priority job selector' },
        ],
      },
      {
        category: 'improvement',
        title: 'Player card header redesign',
        description: 'Progress bar showing BiS completion percentage',
        details:
          'Player cards now show a visual progress bar in the header indicating BiS completion. Average item level displayed alongside.',
        commits: [{ hash: '61670c0', message: 'Redesign player card header with progress bar' }],
      },
      {
        category: 'improvement',
        title: 'Checkbox and loot sync',
        description: 'Checking gear boxes now prompts to log loot entry',
        details:
          'When you check a gear slot as obtained, you\'re prompted to log the corresponding loot entry. Keeps gear tracking and loot history in sync.',
        commits: [{ hash: '5af0dd4', message: 'Checkbox to loot entry sync with confirmation prompts' }],
      },
      {
        category: 'improvement',
        title: 'Confirmation modals',
        description: 'Added confirmation dialogs for destructive actions',
        commits: [{ hash: '12b0351', message: 'UX improvements: confirmation modals, expanded lists, and grid presets' }],
      },
      {
        category: 'fix',
        title: 'iLv calculation accuracy',
        description: 'Fixed item level calculations for tome gear augmentation states',
        commits: [{ hash: '4f3f762', message: 'Fix iLv calculation accuracy and checkbox behavior' }],
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-01-02T23:03:29Z',
    title: 'Parity Implementation',
    highlights: ['Gear categories', 'iLv tracking'],
    items: [
      {
        category: 'feature',
        title: 'Gear source categories',
        description: '9 categories for tracking current equipment source',
        details:
          'Track where your current gear came from: Savage, Tome (upgraded), Tome (base), Catchup, Crafted, Relic, Prep, Normal, or Unknown. Helps understand gear progression.',
        commits: [{ hash: 'ec257d0', message: 'Parity Implementation: Gear Categories, iLv Tracking, and Adjustments' }],
      },
      {
        category: 'feature',
        title: 'Item level tracking',
        description: 'Average iLv calculated and displayed per player',
        details:
          'Each player card now shows their average item level based on currently equipped gear. Calculated from gear source categories and tier configuration.',
        commits: [{ hash: '50d00d1', message: 'Parity Phases 2-4: Frontend types, iLv tracking, adjustments' }],
      },
      {
        category: 'feature',
        title: 'Mid-tier roster adjustments',
        description: 'Loot and page adjustments for players joining mid-tier',
        details:
          'New adjustment fields allow fair priority calculations for players who join after the tier has started. Positive adjustments count extra drops, negative ignore drops.',
        commits: [{ hash: 'f332a5c', message: 'Add parity adjustment fields' }],
      },
      {
        category: 'fix',
        title: 'BiS import currentSource inference',
        description: 'Fixed gear source detection when importing BiS sets',
        commits: [{ hash: '55196e3', message: 'Fix BiS import currentSource inference' }],
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-01-02T02:34:34Z',
    title: 'Loot Tracking Redesign',
    highlights: ['Week selector', 'Unified overview'],
    items: [
      {
        category: 'feature',
        title: 'Week selector',
        description: 'Navigate loot history by raid week',
        details:
          'New week selector lets you browse loot history week by week. See what dropped each week and who received items.',
        commits: [
          { hash: 'b9ae0fb', message: 'Week Selector Enhancement' },
          { hash: '599e280', message: 'Fix week selector in quick log modals' },
        ],
      },
      {
        category: 'feature',
        title: 'Unified week overview',
        description: 'Single view showing all loot activity for a week',
        details:
          'Consolidated view combining loot drops, book earnings, and material usage for each week.',
        commits: [{ hash: '249b005', message: 'Unified Week Overview UI' }],
      },
      {
        category: 'feature',
        title: 'Weapon priority quick-log',
        description: 'Log weapon drops directly from priority panel',
        details:
          'Added Log button to weapon priority entries for quick access to logging weapons without navigating away.',
        commits: [
          { hash: '1ee37f1', message: 'Weapon Priority Quick-Log' },
          { hash: '04c4587', message: 'Add Log button to all weapon priority entries' },
        ],
      },
      {
        category: 'improvement',
        title: 'Summary tab redesign',
        description: 'Cleaner layout with better information hierarchy',
        commits: [{ hash: '9ca9095', message: 'Summary Tab Redesign' }],
      },
      {
        category: 'improvement',
        title: 'Sectioned log layout',
        description: 'Log tab reorganized with Week/All Time toggle',
        commits: [{ hash: 'cd96bcc', message: 'Log tab redesign: sectioned layout with Week/All Time toggle' }],
      },
      {
        category: 'fix',
        title: 'Auto-set week start date',
        description: 'First loot entry automatically sets the tier start date',
        commits: [{ hash: '78f8ee5', message: 'Auto-set week_start_date on first loot entry' }],
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2025-12-28T16:38:52Z',
    title: 'BiS Import System',
    highlights: ['XIVGear integration', 'Item hover cards'],
    items: [
      {
        category: 'feature',
        title: 'BiS import from XIVGear',
        description: 'Import your BiS set directly from XIVGear.app',
        details:
          'Paste a XIVGear URL to automatically import your BiS configuration. Supports all jobs and automatically detects gear sources.',
        commits: [{ hash: '01b1b0b', message: 'BiS import from XIVGear' }],
      },
      {
        category: 'feature',
        title: 'BiS presets',
        description: 'Pre-configured BiS sets for all 21 combat jobs',
        details:
          'Quick-select from curated BiS presets for each job. Filtered by tier and includes GCD-specific options.',
        commits: [
          { hash: '20ec083', message: 'BiS presets with GCD, auto-filter by tier' },
          { hash: '04e33e3', message: 'Add BiS presets for all 21 combat jobs with descriptions' },
        ],
      },
      {
        category: 'feature',
        title: 'Item icons with hover cards',
        description: 'Gear slots show item icons with detailed hover information',
        details:
          'Hover over any gear slot to see the item name, icon, and stats. Icons are fetched from game data and cached.',
        commits: [
          { hash: '404b716', message: 'Item icons with hover cards' },
          { hash: '8e28955', message: 'BiS presets dropdown and in-game gear slot names' },
        ],
      },
      {
        category: 'fix',
        title: 'BiS icon persistence',
        description: 'Fixed item icons not persisting after refresh',
        commits: [{ hash: '41af3b4', message: 'Fix BiS icon persistence and improve DnD/cursor UX' }],
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2025-12-28T04:48:02Z',
    title: 'Design & Branding',
    highlights: ['Teal Glow theme', 'Drag-and-drop'],
    items: [
      {
        category: 'feature',
        title: 'Teal Glow design system',
        description: 'New dark theme with teal accent colors',
        details:
          'Complete visual redesign with a professional dark theme. Teal (#14b8a6) accent color throughout with role-specific colors for tank, healer, and DPS.',
        commits: [{ hash: '4173d34', message: 'Implement Teal Glow design system' }],
      },
      {
        category: 'feature',
        title: 'Drag-and-drop reordering',
        description: 'Rearrange players and groups with drag-and-drop',
        details:
          'Drag players to reorder within a group or swap between groups. Supports insert-between mode and visual drop indicators.',
        commits: [
          { hash: 'ae5e682', message: 'Redesign drag-and-drop with clean architecture' },
          { hash: 'a3f2a99', message: 'Add insert-between mode for drag-and-drop' },
          { hash: 'bc29d64', message: 'Improve drag-and-drop UX with swap indicator' },
        ],
      },
      {
        category: 'feature',
        title: 'Sort presets',
        description: 'Quick sort options: Role, Priority, Custom order',
        details:
          'Sort the raid roster by role (tanks, healers, DPS), by loot priority score, or maintain a custom order with drag-and-drop.',
        commits: [{ hash: '3afa7c6', message: 'Add drag-and-drop reordering, sort presets, group view' }],
      },
      {
        category: 'improvement',
        title: 'Cross-group drag',
        description: 'Drag players between G1 and G2, positions auto-swap',
        details:
          'Dragging a player to the other group automatically swaps their position (T1↔T2, H1↔H2, etc.).',
        commits: [
          { hash: '5b98c72', message: 'Fix cross-group swap to update both cards positions' },
          { hash: '780b085', message: 'Wide layout, header consolidation, cross-group drag' },
        ],
      },
      {
        category: 'improvement',
        title: 'New branding',
        description: 'Updated logo and home page hero',
        commits: [
          { hash: '57ee0df', message: 'Update branding and home page hero' },
          { hash: '0dc3b3a', message: 'UX improvements and new branding' },
        ],
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2025-12-28T08:19:41Z',
    title: 'Teams & Invitations',
    highlights: ['Invitation system', 'Player ownership'],
    items: [
      {
        category: 'feature',
        title: 'Invitation system',
        description: 'Invite links with role, expiration, and max uses',
        details:
          'Generate invite links to add members to your static. Set the role they\'ll receive, expiration time, and maximum number of uses.',
        commits: [{ hash: '4848e3d', message: 'Add invitations system and player-user linking' }],
      },
      {
        category: 'feature',
        title: 'Player ownership',
        description: 'Members can claim and edit their own player card',
        details:
          'Use "Take Ownership" to link your Discord account to a player card. You can then edit your own gear without Lead permissions.',
        commits: [
          { hash: 'fd8552b', message: 'Add linked players section to Members panel' },
          { hash: 'bc6d024', message: 'Fix Take Ownership and update ownership icons' },
        ],
      },
      {
        category: 'feature',
        title: 'Tier snapshots',
        description: 'Separate rosters for each raid tier',
        details:
          'Keep your roster across raid tiers. Roll over from one tier to the next without losing your setup. Switch between tiers to view historical progress.',
        commits: [{ hash: 'b73f8a3', message: 'Add tier snapshots and roster system' }],
      },
      {
        category: 'feature',
        title: 'AAC Heavyweight tier',
        description: 'Added M5S-M8S tier configuration',
        commits: [{ hash: '2f2a924', message: 'Add AAC Heavyweight tier, reduce layout padding' }],
      },
      {
        category: 'improvement',
        title: 'Member role management',
        description: 'Owners and leads can change member roles',
        commits: [{ hash: 'ae2db72', message: 'Fix member role update endpoint to accept JSON body' }],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2025-12-27T18:33:42Z',
    title: 'Authentication & Groups',
    highlights: ['Discord login', 'Static groups'],
    items: [
      {
        category: 'feature',
        title: 'Discord OAuth authentication',
        description: 'Login with your Discord account',
        details:
          'Secure authentication using Discord OAuth. Your Discord username and avatar are used throughout the app.',
        commits: [{ hash: 'bac1bf0', message: 'Add Discord OAuth authentication foundation' }],
      },
      {
        category: 'feature',
        title: 'Static groups',
        description: 'Create and manage multiple statics',
        details:
          'Create static groups with unique share codes. Invite members, assign roles (Owner, Lead, Member), and manage multiple statics from one account.',
        commits: [
          { hash: '99d1681', message: 'Add static groups and memberships' },
          { hash: '19fef0b', message: 'Add frontend auth components' },
        ],
      },
      {
        category: 'feature',
        title: 'Share codes',
        description: 'Easy-to-share 8-character codes for each static',
        details:
          'Each static gets a unique share code. Share it with others to give them view access, or use invite links for member access.',
      },
      {
        category: 'feature',
        title: 'Role-based permissions',
        description: 'Owner, Lead, Member, and Viewer access levels',
        details:
          'Owners have full control. Leads can manage tiers and players. Members can edit their claimed players. Viewers have read-only access.',
      },
      {
        category: 'fix',
        title: 'JWT secret persistence',
        description: 'Fixed authentication tokens across deployments',
        commits: [{ hash: '394d713', message: 'Fix JWT secret persistence across deployments' }],
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2025-12-23T00:31:38Z',
    title: 'Initial Release',
    highlights: ['Core features', 'Loot priority'],
    items: [
      {
        category: 'feature',
        title: 'Gear tracking',
        description: 'Track BiS progress for your entire static',
        details:
          'Mark gear slots as obtained and augmented. See completion percentage at a glance. Track both raid drops and tome gear.',
      },
      {
        category: 'feature',
        title: 'Loot priority system',
        description: 'Smart loot suggestions based on need and fairness',
        details:
          'Priority scores consider who needs the item, role priority for the slot, and past loot distribution. Helps make fair loot decisions.',
      },
      {
        category: 'feature',
        title: 'Weapon priority tracking',
        description: 'Track weapon needs across multiple jobs per player',
        details:
          'Players can set priority for weapons across their jobs. The system tracks who has received weapon drops and suggests fair distribution.',
      },
      {
        category: 'feature',
        title: 'Book/page tracking',
        description: 'Track book drops and spending for tome upgrades',
        details:
          'Log book drops from each floor. Track spending on tome upgrade materials. See who has books to spend and who needs more.',
      },
      {
        category: 'feature',
        title: 'FastAPI backend',
        description: 'RESTful API with SQLite/PostgreSQL support',
        commits: [{ hash: 'fc9d8c2', message: 'Add FastAPI backend with data persistence' }],
      },
      {
        category: 'feature',
        title: 'React frontend',
        description: 'Modern React app with TypeScript and Tailwind CSS',
        commits: [{ hash: '3e00a27', message: 'Add frontend with Phase 1 core features' }],
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
