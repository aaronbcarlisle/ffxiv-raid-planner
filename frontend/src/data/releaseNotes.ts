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

export const CURRENT_VERSION = '1.26.0';

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
  /**
   * Preferred way to reference the change: the GitHub PR number. Unlike a
   * commit SHA, the PR number is known the moment the PR is opened, is stable,
   * and survives squash-merge — so it never needs the post-merge backfill that
   * left `commits` entries stuck on a placeholder 'pending' hash. The page
   * links it to `/pull/{pr}`. Prefer this over `commits` for new entries.
   */
  pr?: number;
  /** PR title, shown next to the `#pr` link (like a commit's message). */
  prTitle?: string;
  commits?: CommitInfo[]; // Related commits (real short SHAs only; complements `pr`)
  image?: string; // Path to image/gif shown when expanded
  link?: { href: string; label: string }; // Link to related page
}

export interface Release {
  version: string;
  date: string; // Full ISO 8601 format: 'YYYY-MM-DDTHH:MM:SSZ'
  title?: string;
  highlights?: string[]; // 1-2 key items for banner display
  items: ReleaseItem[];
  /**
   * Dev-only release note. When true, this entry is posted to the Discord
   * changelog (for posterity) but hidden from the release-notes page and the
   * "what's new" banner. Place `internal: true` as the LAST field of the object
   * (the changelog script detects it after the `items` array). Do NOT bump
   * CURRENT_VERSION for an internal-only entry — CURRENT_VERSION should always
   * track the latest *public* release so the banner stays correct.
   */
  internal?: boolean;
}

// Releases ordered newest-first
export const RELEASES: Release[] = [
  {
    version: '1.26.0',
    date: '2026-06-23T12:00:00Z',
    title: 'Collections Center, Suggested Farms & Dawntrail plugin sync',
    highlights: [
      'Player Hub now includes a Collections Center to track mounts, music, weapons, and more',
      'All 8 Dawntrail extreme trial mounts verified for automatic plugin sync',
    ],
    items: [
      {
        category: 'feature',
        title: 'Collections Center — personal reward tracker in Player Hub',
        description:
          'Player Hub → Collections is now a full Collections Center. Track intent (Hunting / Interested / Pass / Hidden) and ownership for mounts, music, minions, weapons, and rare drops from one page. ' +
          'Each reward has a visibility control: Private (only you), Shared with statics (feeds Suggested Farms), or Public on dossier. ' +
          'A share prompt appears when a Hunting or Interested reward is left Private. ' +
          'Browse the full active catalog or filter to your personal list by category, expansion, or content type.',
        pr: 141,
        prTitle: 'feat(collections): Collections Center, Suggested Farms & Dawntrail plugin sync',
        commits: [{ hash: '7d9e416', message: 'feat(collections): Collections & Farms hub with participant states and drop log' }],
      },
      {
        category: 'improvement',
        title: 'Suggested Farms — smart duty cards surfaced from Player Hub intents',
        description:
          'Static Collections & Farms opens on a Suggested Farms tab driven by Player Hub reward intents and plugin-synced collection facts. Suggestions appear even with no manually created static goals — roster members who share their Player Hub preferences automatically surface their wants to static leads.',
        pr: 141,
        prTitle: 'feat(collections): Collections Center, Suggested Farms & Dawntrail plugin sync',
        commits: [{ hash: 'd0a03ad', message: 'fix(collections): correct filter chip count semantics and hide phantom Savage chip' }],
      },
      {
        category: 'improvement',
        title: 'Static Browse Catalog — grouped duty cards with full labels',
        description:
          'Static Collections → Browse Catalog now renders grouped duty cards: one card per duty showing all rewards (mount, music, weapons) together. ' +
          'Full source-type label (Extreme / Ultimate / Savage) and expansion name on desktop; compact labels on mobile. ' +
          'Token cost shown as an amber pill. Cards animate on expand/collapse. Badge colors shared from a single config across Player Hub and Static Browse.',
        pr: 141,
        prTitle: 'feat(collections): Collections Center, Suggested Farms & Dawntrail plugin sync',
        commits: [{ hash: 'bf4c8dc', message: 'feat(collections): redesign catalog as source/duty farm cards' }],
      },
      {
        category: 'fix',
        title: 'Ultimate weapon token cost corrected to 1× per weapon (was 7×)',
        description:
          'Futures Rewritten, Dancing Mad, Dragonsong\'s Reprise, and The Omega Protocol ultimate weapon rows now show 1× totem per weapon — matching the actual in-game exchange. ' +
          'EX mount pity costs (99×) are unaffected. Can-buy scoring now correctly triggers at tokenCount ≥ 1 for ultimates.',
        pr: 141,
        prTitle: 'feat(collections): Collections Center, Suggested Farms & Dawntrail plugin sync',
        commits: [{ hash: 'bf4c8dc', message: 'feat(collections): redesign catalog as source/duty farm cards' }],
      },
      {
        category: 'fix',
        title: 'Public dossier — Hunting and Interested shown in separate sections',
        description:
          'The public profile dossier now renders "Actively Hunting" and "Interested In" as two distinct labelled sections instead of combining everything under a single "Hunting (N)" header.',
        pr: 141,
        prTitle: 'feat(collections): Collections Center, Suggested Farms & Dawntrail plugin sync',
        commits: [{ hash: 'bf4c8dc', message: 'feat(collections): redesign catalog as source/duty farm cards' }],
      },
      {
        category: 'improvement',
        title: 'All 8 Dawntrail extreme trial mounts now plugin-ready',
        description:
          'game_mount_id and token_item_id populated for all 8 DT extreme trial farms (Wings of Ruin through Wings of Nihility). IDs verified against Garland Tools API and FFXIV Collect, matching Mount.exd and Item.exd RowIds used by the Dalamud plugin for automatic ownership detection.',
        pr: 141,
        prTitle: 'feat(collections): Collections Center, Suggested Farms & Dawntrail plugin sync',
        commits: [{ hash: '1e329e3', message: 'feat(collections): expand catalog to all expansions and fix Player Hub sync' }],
      },
      {
        category: 'improvement',
        title: 'Suggested Farms duty cards show expansion tag',
        description: 'Each duty card in Suggested Farms now displays the expansion abbreviation (e.g. DT, EW, SHB) alongside the content-type badge so leads can quickly identify which content tier a suggestion belongs to.',
        pr: 141,
        prTitle: 'feat(collections): Collections Center, Suggested Farms & Dawntrail plugin sync',
        commits: [{ hash: '8cf366c', message: 'fix(collections): honest chip labels for curated-only categories' }],
      },
      {
        category: 'improvement',
        title: 'Player Hub write-through works without an existing Player Hub profile',
        description: 'Toggling "Wanted" on a mount farm now auto-creates a private Player Hub profile when the user has not yet visited Player Hub, ensuring the intent always reaches Suggested Farms.',
        pr: 141,
        prTitle: 'feat(collections): Collections Center, Suggested Farms & Dawntrail plugin sync',
        commits: [{ hash: 'd0a03ad', message: 'fix(collections): correct filter chip count semantics and hide phantom Savage chip' }],
      },
      {
        category: 'improvement',
        title: '/xrp resolve-ids — plugin Lumina ID resolver command',
        description:
          'New plugin diagnostic command resolves every catalog mount and token name against local Lumina sheets (Mount.exd / Item.exd). Includes an alias map for catalog display names that differ from Lumina Singular names. Writes collection_resolved_ids.json and auto-POSTs exact matches to the backend.',
        commits: [{ hash: '1e329e3', message: 'feat(collections): expand catalog to all expansions and fix Player Hub sync' }],
        internal: true,
      },
      {
        category: 'fix',
        title: 'C# CollectionSyncResult now includes skippedNoId field',
        description:
          'Plugin-side Models.cs updated to deserialize skippedNoId from the backend sync response, matching the Phase 3 schema change.',
        commits: [{ hash: '1e329e3', message: 'feat(collections): expand catalog to all expansions and fix Player Hub sync' }],
        internal: true,
      },
      {
        category: 'improvement',
        title: 'Bulk mount farm update uses batched write-through',
        description: 'Bulk progress updates now resolve profiles, catalog items, intents, and snapshots in 4 batch queries instead of N per-row queries, reducing database overhead for large statics.',
        commits: [{ hash: 'd0a03ad', message: 'fix(collections): correct filter chip count semantics and hide phantom Savage chip' }],
        internal: true,
      },
    ],
  },
  {
    version: '1.26.0',
    date: '2026-06-21T23:59:00Z',
    title: 'Catalog game ID population — stable plugin sync IDs (Phase 2 & 3)',
    items: [
      {
        category: 'improvement',
        title: 'game_mount_id and token_item_id added to catalog items (EW → ARR)',
        description:
          'CollectionCatalogItem now carries stable Mount.exd and Item.exd IDs for all pre-Dawntrail extreme trial mounts (ARR → EW). Dawntrail IDs are left null pending external Lumina verification — no IDs are guessed.',
      },
      {
        category: 'fix',
        title: 'source_duty_key fallback removed from ownership (Have) path',
        description:
          'Plugin sync no longer sets Have state from source_duty_key alone. Only game_mount_id exact matches can confirm ownership. Mounts in the payload without a stable mount_id are now counted in skipped_no_id. Token count fallback (token_name) is preserved — token updates do not set ownership.',
      },
      {
        category: 'improvement',
        title: 'Catalog audit endpoint — expanded per-expansion and DT breakdown',
        description:
          'GET /api/admin/collection-catalog/audit now reports plugin sync readiness per category and per expansion, with a dedicated dt_detail block listing which DT mount and token IDs are missing.',
      },
      {
        category: 'improvement',
        title: 'Plugin ready / Manual only indicator on mount farm chips',
        description:
          'Subtle Zap icon on mount reward chips indicates whether the plugin can detect ownership automatically (bright = plugin ready when game_mount_id present, dim = manual only). No indicator for orchestrion, minion, or weapon.',
      },
    ],
    internal: true,
  },
  {
    version: '1.26.0',
    date: '2026-06-21T23:00:00Z',
    title: 'Plugin bridge for collection participant states',
    items: [
      {
        category: 'feature',
        title: 'POST /api/plugin/collections/sync — plugin updates your collection states',
        description:
          'New endpoint lets the Dalamud plugin report which mounts you own and how many tokens you hold. Backend matches these to your active collection goals by source_duty_key / trial_id and updates your participant state (Have/token count). Manual Pass is never overwritten.',
      },
      {
        category: 'improvement',
        title: 'Source badges in member rows (Plugin / Hub)',
        description:
          'Member rows in SourceFarmCard now show a small "Plugin" or "Hub" badge when the state was set by the plugin or Player Hub rather than manually.',
      },
      {
        category: 'improvement',
        title: 'Catalog sync import report',
        description:
          'sync_from_ffxiv_collect now returns a detailed report: imported counts per category, skipped total, skipped breakdown by source type, and category counts after the full import.',
      },
      {
        category: 'feature',
        title: 'Plugin: Sync Collections button in Character window tray',
        description:
          'CollectionSyncService reads mount ownership (PlayerState.IsMountUnlocked) and token counts (InventoryManager) from game memory and posts to the new collection sync endpoint. "Sync Collections" appears in the ... overflow menu in the Character sync tray.',
      },
    ],
    internal: true,
  },
  {
    version: '1.26.0',
    date: '2026-06-21T20:00:00Z',
    title: 'Collections redesigned as source/duty farm cards',
    highlights: [
      'Collections now shows one card per duty (mount + music + minions in one place)',
      'Category chips hide when empty, Minions tab now has curated trial content',
    ],
    items: [
      {
        category: 'feature',
        title: 'Source/duty farm cards replace flat reward rows',
        description:
          'Collections & Farms groups all rewards from the same extreme/savage/ultimate into one card — mount, music, minion, and weapons appear together instead of as separate disconnected rows. Cards have colored left borders (amber=Extreme, red=Savage, blue=Ultimate) and expand to show participants, token exchange info, and a Copy Farm Plan button for Discord.',
        pr: 141,
        prTitle: 'feat(collections): Collections Center, Suggested Farms & Dawntrail plugin sync',
        commits: [{ hash: 'bf4c8dc', message: 'feat(collections): redesign catalog as source/duty farm cards' }],
      },
      {
        category: 'improvement',
        title: 'Category chips now show counts and hide when 0',
        description:
          'The Mounts/Music/Minions/Weapons/Rare filter chips only appear when there is at least one farm in that category. Selecting a chip narrows the visible cards without destroying the grouping. Search and source-type (Extreme/Savage/Ultimate) + expansion filters also apply.',
      },
      {
        category: 'fix',
        title: 'Minions tab no longer empty — curated trial minions added',
        description:
          'Four trial minions (Wind-up Ultros, Poogie, Seikret Fledgling, Vigorwasp) are now seeded as curated catalog entries so the Minions chip always has content even before the FFXIV Collect sync runs.',
      },
    ],
  },
  {
    version: '1.26.0',
    date: '2026-06-21T18:00:00Z',
    title: 'FFXIV Collect background sync for mounts, minions, orchestrion',
    items: [
      {
        category: 'improvement',
        title: 'Catalog auto-syncs from FFXIV Collect on first server start',
        description: 'Background task runs 5 seconds after startup and imports mounts, minions, and orchestrion from FFXIV Collect if not already synced. Fixes pagination bug (count vs total), source duty name extraction, and owned-percent parsing. Curated internal rows always take precedence via Python-level deduplication.',
      },
    ],
    internal: true,
  },
  {
    version: '1.26.0',
    date: '2026-06-21T12:00:00Z',
    title: 'Full orchestrion roll catalog — all expansions, no live fetch',
    items: [
      {
        category: 'fix',
        title: 'Music tab populated with 38 curated orchestrion rolls (HW–DT)',
        description: 'All orchestrion rolls farmable from extreme trials are now hardcoded in the curated catalog — no FFXIV Collect API call required. Data sourced from the FFXIV wiki covers every extreme from Heavensward through Dawntrail (38 rolls). Also corrects two previously wrong ShB entries: Castrum Marinum drops "The Black Wolf Stalks Again" (not "Rise") and Cloud Deck drops "In the Arms of War" (not "Black & White"). The background auto-sync that caused 5-minute startup hangs is removed.',
      },
    ],
    internal: true,
  },
  {
    version: '1.26.0',
    date: '2026-06-21T00:00:00Z',
    title: 'Collections catalog expanded — all expansions + Player Hub sync',
    items: [
      {
        category: 'fix',
        title: 'Collections catalog expanded to all expansions',
        description: 'Browse Catalog now shows mounts and ultimate weapons for Shadowbringers, Stormblood, Heavensward, and A Realm Reborn. Endwalker data corrected (mount names, totem names, and missing Endsinger entry). All catalog entries now carry a source_duty_key matching the internal trial ID so the Player Hub collections tab and group catalog stay in sync.',
      },
      {
        category: 'fix',
        title: 'Player Hub collection suggestions include group goal participation',
        description: 'When a static group tracks a Collection Goal and a member has logged participation, that farm now surfaces as a Player Hub collection suggestion — bridging group goal activity into the personal collections view.',
      },
    ],
    internal: true,
  },
  {
    version: '1.26.0',
    date: '2026-06-20T00:00:00Z',
    title: 'Collections & Farms Hub',
    items: [
      {
        category: 'feature',
        title: 'Collections & Farms Hub',
        description: 'Backend models, router, and store for collection goals with participant states (need/want/have/pass), drop log, priority modes, and participant summary counts on the goal list.',
      },
    ],
    internal: true,
  },
  {
    version: '1.26.0',
    date: '2026-06-19T10:00:00Z',
    title: 'Split Clear Planner, Loot Intelligence & Character Registry',
    highlights: [
      'Plan main/alt split runs with per-player Run A / Run B assignments and weekly clear tracking',
      'Loot drop recommendations rank candidates by character identity, weapon priority, and loot history',
    ],
    items: [
      {
        category: 'feature',
        title: 'Split Clear Planner for raid statics',
        description: 'Leads can enable a split-clear planning board under the Roster tab. Each member gets a row for their main and alt character, Run A / Run B assignments, loot target notes, and per-run weekly clear checkboxes. Weekly clear status is manually tracked; no lockout detection is performed.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'feature',
        title: 'Generate Draft split plan',
        description: 'The Split Clear Planner can generate a suggested draft from existing Lodestone data and weapon priorities with a confidence badge, per-player suggestions, and a change summary before applying. Dismissing the draft discards it without saving.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Split Clear Composer — redesigned planning flow',
        description: 'The split-clear board is a three-state composer: empty state with source previews, draft-review panel with Run A / Run B side-by-side panels, and a manage board.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Character-linked split assignment composer',
        description: 'Split Clear Planner reads linked Player Hub characters instead of requiring manual text entry. Each roster member\'s characters appear as selector chips; leads pick which goes into Run A and which into Run B.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Weighted draft scoring with per-player reasons',
        description: 'Draft generation uses a weighted scoring system and surfaces per-player reasons in a collapsible "Why these assignments?" panel.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'feature',
        title: 'Roster → Characters sub-tab',
        description: 'A new "Characters" sub-tab in the Roster segmented control. Leads can link Player Hub characters or add manual entries with main/alt/substitute roles and an optional job tag.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Split Planner uses registered character list',
        description: 'The draft generator prefers static character registrations (when available) over the full Player Hub profile when building character candidate lists.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Loot Log records the receiving character',
        description: 'When logging a drop or book purchase, a character picker appears for any player who has registered characters. The primary character is pre-selected; you can switch to any alt.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Priority view shows registered character context',
        description: 'Weapon Priority cards display the registered character name next to each entry when one is linked to that player and job. Character context is additive and degrades gracefully when no registration exists.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Team Summary "Mains only" filter',
        description: 'A new toggle in the Team Summary header filters the progress table to roster players whose registered role is "main". Hidden for statics without character registrations.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'feature',
        title: 'Loot drop recommendations in Log Loot',
        description: 'When logging a drop or weapon coffer, a ranked candidate list shows who should receive the item and why. Combines registered character identity, weapon priority rank, BiS need, and loot log history. Leads can always override.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Weapon coffers use existing weapon priority',
        description: 'The recommendation panel ranks weapon coffer candidates using the static\'s current weapon priority order. Priority rank #1 receives the highest bonus; players whose weapon is already received are deprioritised.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'fix',
        title: 'Backend resolves Player Hub character name when snapshotting loot',
        description: 'Loot log entries for Player Hub linked registrations now auto-resolve the character name from the linked PlayerCharacter record so the snapshot is always populated.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'fix',
        title: 'Recurring sessions display the next upcoming date',
        description: 'Session cards for recurring events now show the next scheduled occurrence rather than the original creation date.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'fix',
        title: 'Cancel a single occurrence without deleting the series',
        description: 'The delete button on recurring session cards opens a choice: "Cancel [date] only" or "Delete entire series." Cancelling one occurrence marks it as skipped while leaving all future occurrences intact.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Track whether a weapon was a direct drop or weapon coffer',
        description: 'The Quick Log Weapon modal now has a "Via weapon coffer" checkbox. The weapon priority card shows a Drop or Coffer badge next to each player who has already received their weapon this tier.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'improvement',
        title: 'Split Clear board auto-refreshes after linking characters',
        description: 'Returning to the Roster tab after linking characters on the Profile page (Sync Center) now silently re-fetches split-clear data so the character chips appear without a manual page refresh.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
      {
        category: 'feature',
        title: 'Dalamud plugin: Split Clear overlay',
        description: 'The in-game plugin shows a Split Clear overlay when you enter a savage raid with split-clear mode active. It displays your run assignment (Run A or Run B), your character and world for that run, your loot target, and your teammates in the same run. A "Mark Run Cleared" button updates the split-clear status for all players in your run at once.',
        pr: 140,
        prTitle: 'feat: Split Clear Planner, Loot Intelligence, Character Registry, and Plugin Overlay',
      },
    ],
  },
  {
    version: '1.25.0',
    date: '2026-06-18T00:00:00Z',
    title: 'Gear Sync, Scheduling, and Discord Delivery',
    highlights: [
      'Recurring raid schedules now power Discord events and reminders together',
      'Gear imports, BiS comparisons, and Player Hub sync are more reliable',
    ],
    items: [
      {
        category: 'feature',
        title: 'Recurring events: view and cancel individual occurrences',
        description: 'Recurring raid sessions now show a "View occurrences" calendar button that lists the next 4 weeks of upcoming dates. Leads can cancel individual occurrences without affecting the whole series, and restore them later.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'feature',
        title: 'Discord events and reminders share one raid schedule',
        description: 'Native Discord scheduled events and webhook reminders now derive from the same generated raid occurrence. Event edits, one-off cancellations, and recurring times stay aligned, while a failure in one Discord delivery path no longer blocks the other.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'feature',
        title: 'Discord Guild Events: official bot via install-claim flow',
        description: 'Discord Events now use a shared XIVRaidPlanner bot instead of per-static bot tokens. Leads connect their server in one click — generate a link code, invite the bot, run /xrp link <code> — no token management required. Upcoming occurrences can include their event banner and planner link, while the integrations panel shows connection status, permission health, and Sync/Disconnect actions.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'fix',
        title: 'Stale app chunk recovery',
        description: 'Minor bug fix: browsers with an older cached app shell now reload once and show a clear update message instead of getting stuck on a generic dynamic import error after deployments.',
        pr: 136,
        prTitle: 'fix: recover stale chunks and stabilize scheduler availability',
      },
      {
        category: 'fix',
        title: 'Scheduler drag selection reliability',
        description: 'Scheduler drag-selection no longer misses slots when selecting another column while previous slot updates are still saving or animating. Cross-midnight preset views now map after-midnight slots to the next day so Prime raid time, Evening, and Full day stay consistent.',
        pr: 136,
        prTitle: 'fix: recover stale chunks and stabilize scheduler availability',
      },
      {
        category: 'fix',
        title: 'Windows dev startup resilience',
        description: 'The local development startup script now resolves Windows npm/pnpm command shims before launching the frontend server, preventing PowerShell from trying to execute a .ps1 shim as a Win32 application. The backend example env also documents optional Discord bot/interactions variables used by local Discord event testing.',
        pr: 136,
        prTitle: 'fix: recover stale chunks and stabilize scheduler availability',
      },
      {
        category: 'fix',
        title: 'Leads can now access group settings',
        description: 'The settings gear icon in the group header was previously only visible to the Owner. Leads can now open group settings to manage roster, tiers, invitations, and other options. The destructive "Delete Static" action remains restricted to the Owner only.',
        pr: 134,
        prTitle: 'hotfix: allow leads to access group settings',
      },
      {
        category: 'fix',
        title: 'Plugin collection sync now feeds Player Hub first',
        description: 'Mount and token syncs from the plugin now update Player Hub collection goals first, then mirror that same collection progress into Static Mount Farms for every static the player belongs to.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'fix',
        title: 'Ultimate farm catalog token metadata completed',
        description: 'Added curated one-token exchange metadata for all Ultimate reward farms, including Dreadwyrm, Ultima, Colossus, Dragonsong, Omega, Oracle, and Mad Harlequin totems with their weapon set exchanges.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'fix',
        title: 'BiS checks now handle swapped ring slots',
        description: 'Gear sync now treats the two ring slots as an interchangeable pair, so correct Tome/Raid rings equipped in the opposite order no longer show as BiS mismatches.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'fix',
        title: 'XIVGear links now populate selected BiS sets',
        description: 'Pasted XIVGear sheet links now use the full URL import path and preserve the chosen set index, so linked BiS targets populate the intended gear check instead of silently using the wrong set.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'improvement',
        title: 'XIVGear sheet imports can show multiple set options',
        description: 'When a XIVGear sheet contains several sets, the BiS import flow now asks which set to link and shows labels with set name, job, GCD, and original set index.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'improvement',
        title: 'Static invite links can be permanent',
        description: 'Static leads can now create invite links that never expire. Existing 7-day invites still keep their normal expiration behavior, and revoked permanent invites remain disabled.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'fix',
        title: 'Objectives panel moved to compact right-rail layout',
        description: 'The Objective Command Center no longer renders as large horizontal cards in the center column. Official Objectives, Active Farms, and Member Interest are now shown as compact rows in the right-side Goals & Objectives panel, keeping the Overview to one screen at 1080p.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'fix',
        title: 'Notification badge and panel count stay in sync',
        description: 'The notification badge now reflects both server notifications and unread release notes, so the displayed count always matches what you see when the panel opens. The panel also fetches the latest server notifications each time it is opened, preventing stale counts mid-session.',
        pr: 133,
        prTitle: 'feat: v1.24.0 — Goals Alignment, Multi-BiS, Notification Center, Objective Command Center, Fit Scores, Application Review 2.0',
      },
      {
        category: 'fix',
        title: 'Anonymous activity preference now applies to activity log entries',
        description: 'Enabling "Anonymous Activity" in the user menu now correctly anonymizes your name in the static activity feed going forward. Previously the preference was stored but not applied when writing new entries, so your name would still appear regardless of the setting.',
        pr: 133,
        prTitle: 'feat: v1.24.0 — Goals Alignment, Multi-BiS, Notification Center, Objective Command Center, Fit Scores, Application Review 2.0',
      },
      {
        category: 'fix',
        title: 'Discord webhook failures now alert leads and surface delivery status inline',
        description: 'When a scheduled session or reminder fails to post to Discord, all group leads and the owner receive a notification with the HTTP error details. The Integrations settings panel now also shows the status code and error text from the most recent failed delivery beneath the webhook status chip.',
        pr: 133,
        prTitle: 'feat: v1.24.0 — Goals Alignment, Multi-BiS, Notification Center, Objective Command Center, Fit Scores, Application Review 2.0',
      },
      {
        category: 'fix',
        title: 'BiS presets automatically fetch gear data when added',
        description: 'Adding a preset from the "Add Preset" tab now immediately retrieves full gear slot data (item names, item level, materia) from XIVGear after the targets are created. The preset\'s purpose is also derived from its category (Savage, Ultimate, etc.) rather than always defaulting to Savage.',
        pr: 133,
        prTitle: 'feat: v1.24.0 — Goals Alignment, Multi-BiS, Notification Center, Objective Command Center, Fit Scores, Application Review 2.0',
      },
      {
        category: 'fix',
        title: 'Claiming a roster slot now auto-links your Player Hub BiS',
        description: 'When a player claims their slot in the static roster, BiS gear items and currently-equipped gear are now both automatically pulled from Player Hub. The BiS target is fetched from XIVGear or Etro if not already cached. The player\'s latest gear snapshot from Player Hub is used to populate the "currently wearing" comparison immediately — showing BiS matched, upgrade needed, or not detected without requiring a Lodestone sync or manual import. Leads assigning a member receive the same treatment. Everything can still be overridden manually.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'fix',
        title: 'Player Hub syncs now propagate live to roster slots',
        description: 'When a player syncs in Player Hub (via plugin or Lodestone), all roster slots they hold are updated immediately. Gear data (equipped vs BiS comparison) propagates per-job. Character identity (name, world, avatar) propagates across all slots — so name changes, server transfers, and new avatar imports no longer require a re-claim or manual roster edit.',
        pr: 135,
        prTitle: 'feat: improve gear sync, scheduling, and Discord delivery',
      },
      {
        category: 'fix',
        title: '"This static" filter now correctly shows all group notifications',
        description: 'Vote notifications, webhook failure alerts, and other group-scoped messages were previously excluded from the "This static" notification filter because they rely on URL matching, which could fail if the URL format varied. Notifications are now tagged with their group ID at creation time and matched precisely — no more missing notifications in this view.',
        pr: 133,
        prTitle: 'feat: v1.24.0 — Goals Alignment, Multi-BiS, Notification Center, Objective Command Center, Fit Scores, Application Review 2.0',
      },
    ],
  },
  // ── v1.24.0 ──────────────────────────────────────────────────────────────
  {
    version: '1.24.0',
    date: '2026-06-15T00:00:00Z',
    title: 'Goals Alignment, Multi-BiS, and Recruitment Intelligence',
    highlights: ['Static Objectives & goal alignment', 'Personalized fit scores on Static Finder'],
    items: [
      // ── Goals Alignment V1.1 ────────────────────────────────────────────
      {
        category: 'feature',
        title: 'Static Objectives & Content Suggestions',
        description:
          'Leads can now define static objective goals (Savage BiS, Ultimate Clear, Mount Farm, etc.) with priority levels (Required, Preferred, Optional). Any member can propose content suggestions and the group votes on them; leads can promote a winning suggestion directly into a static objective goal.',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'feature',
        title: 'Roster alignment badges per member',
        description:
          "The Members panel now shows a compact color-coded badge for each member indicating how well their public goals align with the static's objectives: green dots for aligned goals, yellow for partial, red for conflicts, and grey for missing data. Hovering shows a breakdown count.",
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'feature',
        title: 'Goal alignment captured on join requests',
        description:
          "Applicant goal alignment is now captured at apply time and shown in the Recruitment Dossier. Leaders instantly see how well each applicant's public goals match the static's objectives — without the applicant needing to change anything.",
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'feature',
        title: 'Declare matchable personal goals using static objective categories',
        description:
          'The goal creation flow now lets you choose between a private personal task (no matching) and a matchable personal objective that uses the same category taxonomy as static goals (Savage BiS, Ultimate Clear, etc.). Matchable goals are used for roster alignment, Static Finder, and join-request scoring.',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'feature',
        title: 'Static Objectives widget on Overview',
        description:
          "The Overview page right column now shows a compact list of the static's active objective goals (category + priority). Owners and leads see a \"Manage goals →\" link; members see \"View goals →\".",
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'improvement',
        title: 'Overview Goals & Farms module unifies objectives, farms, and suggestions',
        description:
          'The three separate Overview widgets (Static Objectives, Collection Goals, Member Interest) are now one cohesive "Goals & Farms" card with sub-sections for official objectives, active reward farms, and open member suggestions.',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'improvement',
        title: 'Discovery page filters by objective category and hides goal conflicts',
        description:
          "Static listing cards now show the group's objective categories. Logged-in users with a public Player Hub profile can filter by objective category and optionally hide statics whose goals conflict with their own.",
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'improvement',
        title: 'Privacy-safe goal matching',
        description:
          'All goal alignment checks use only goals the player has marked public. Private goal text is never included in join-request snapshots or API responses.',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'improvement',
        title: 'Settings tabs reduced from 7 to 5',
        description:
          'Static Settings previously had 7 tabs that caused horizontal scroll on smaller screens. Discovery, Invitations, and Join Requests are now consolidated into a single Recruitment tab, and Goals is relabelled "Goals & Farms".',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'improvement',
        title: 'Recruitment tab now has four focused sub-sections',
        description:
          'Recruitment splits into Overview (status cards, pending application CTA), Listing (the full Static Finder form), Requests (join request review), and Invitations — each independently scrollable.',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'improvement',
        title: 'Goals & Farms tab has four focused sub-sections',
        description:
          'Goals & Farms separates Official Objectives, Collection Goals (farms), and Content Suggestions into their own sub-sections under an Overview card that shows counts and CTAs at a glance.',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'improvement',
        title: 'Collection Goals: Ultimate as a first-class content type',
        description:
          "Collection goals now separate what you're tracking (reward type) from where it comes from (content type). Ultimate is no longer bundled under Savage — create an Ultimate goal, pick from six preset duties (FRU, TOP, DSR, TEA, UwU, UCoB), and the creation flow is now a guided wizard.",
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'fix',
        title: 'Applicants no longer see repeated permission errors on static pages',
        description:
          "Pending applicants visiting a discoverable static's Overview, Schedule, or Mount Farms pages no longer receive repeated 'You are not a member' toast errors. Member-only API calls are now skipped until the join request is accepted.",
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'fix',
        title: 'Objectives panel no longer shows "Failed to fetch" during unrelated errors',
        description:
          "The Static Objectives panel in Settings previously shared a single error field with all other objective store operations. A failure in any operation would surface a raw error string. The objectives error is now tracked separately with a friendly 'Couldn't load objectives.' message and Retry button.",
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      // ── Notification Center ──────────────────────────────────────────────
      {
        category: 'feature',
        title: 'Notification Center',
        description:
          'Clicking the unread badge in the user menu now opens a Notification Center modal. See notification titles, bodies, and timestamps; click any notification with a link to navigate directly; mark individual notifications read or use "Mark all read" at the bottom.',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'fix',
        title: 'Unread count now correctly reflects server read state',
        description:
          'The notification store was using camelCase field names that did not match the snake_case JSON the API returns, causing the unread count to always equal the total. Fields are now correctly mapped.',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'fix',
        title: 'Suggestion vote notifications link to the correct location',
        description:
          'Notifications created when a member votes on a content suggestion previously used the static UUID and linked to Settings → Goals. They now use the share code and link to the Overview Goals & Farms module.',
        pr: 131,
        prTitle: 'feat(goals-v1.1): static objectives, content suggestions, voting, roster alignment, discovery filters',
      },
      {
        category: 'fix',
        title: 'Self-vote no longer creates a spurious notification',
        description:
          'Voting on your own content suggestion no longer triggers a notification to yourself. Duplicate vote-update notifications are also suppressed.',
        pr: 134,
        prTitle: 'fix(notifications): Notification Center polish',
      },
      {
        category: 'fix',
        title: 'Overview notification rail shows only current-static highlights',
        description:
          'The Overview rail now shows contextual static items (pending applications, upcoming sessions) rather than items from the global inbox.',
        pr: 134,
        prTitle: 'fix(notifications): Notification Center polish',
      },
      // ── Multi-BiS ───────────────────────────────────────────────────────
      {
        category: 'feature',
        title: 'Shared Multi-BiS target system',
        description:
          'BiS target sets are now shared across Player Hub and roster views via a unified backend table. Each player/job can hold multiple named targets (Savage, Farm, Speed, etc.); one is marked active at a time. A new BiS Target Manager modal replaces both the old Player Hub modal and the localStorage-only roster panel.',
        pr: 132,
        prTitle: 'feat(bis): Multi-BiS persistence, privacy, compare UI, roster migration',
      },
      {
        category: 'improvement',
        title: 'Multi-BiS: persistence, privacy, and expanded purposes',
        description:
          'BiS targets now persist to the backend exclusively — the old localStorage-only roster panel is retired. Targets support a "visible to members" toggle (private by default). Purpose options expanded to include Savage Prog, Savage Reclear, Week 1, Alt Job, and Parse. Job cards show a live compare status when both gear and a BiS target are present.',
        pr: 132,
        prTitle: 'feat(bis): Multi-BiS persistence, privacy, compare UI, roster migration',
      },
      {
        category: 'improvement',
        title: 'Sync tab restructured into five focused sections',
        description:
          'The Player Hub Sync tab now has five clearly separated sections: Sync Status, Sync Sources, Sync Coverage, Sync Log, and Privacy — replacing one long undifferentiated panel.',
        pr: 132,
        prTitle: 'feat(bis): Multi-BiS persistence, privacy, compare UI, roster migration',
      },
      {
        category: 'improvement',
        title: 'Jobs & Gear adds "Manage Sync" shortcut',
        description:
          '"Manage Sync" button in the Jobs & Gear header navigates directly to the Sync tab, making the connection between the two surfaces discoverable.',
        pr: 132,
        prTitle: 'feat(bis): Multi-BiS persistence, privacy, compare UI, roster migration',
      },
      {
        category: 'improvement',
        title: 'Activity feed uses cleaner labels',
        description:
          'Anonymous totem updates now read "A member updated collection progress", manual updates read "updated … progress", and the plugin aggregate reads "Shared mount data updated".',
        pr: 132,
        prTitle: 'feat(bis): Multi-BiS persistence, privacy, compare UI, roster migration',
      },
      {
        category: 'fix',
        title: 'Rate limiter test isolation fixed',
        description:
          'The shared in-memory rate limiter was causing order-dependent flakiness in the test suite. Fixed with a three-layer autouse fixture; tests that need real rate-limit behavior opt in explicitly.',
        pr: 132,
        prTitle: 'feat(bis): Multi-BiS persistence, privacy, compare UI, roster migration',
      },
      // ── Objective Command Center ─────────────────────────────────────────
      {
        category: 'feature',
        title: 'Objective Command Center on Overview',
        description:
          'Static leads now see a per-objective dashboard card on the Overview that links roster readiness, goal alignment (public goals only), BiS readiness (public targets only), linked collection goals, next scheduled session, and a suggested next action into one actionable summary.',
        pr: 133,
        prTitle: 'feat(overview): Objective Command Center',
      },
      // ── Static Finder Fit Score ──────────────────────────────────────────
      {
        category: 'feature',
        title: 'Static Finder shows personalized fit scores',
        description:
          'Authenticated users with a Player Hub profile now see a deterministic fit summary on each static listing card: goal alignment, job match, schedule overlap, comms compatibility, and BiS readiness. Private goals and BiS targets are never used.',
        pr: 135,
        prTitle: 'feat(discovery): Static Finder fit score',
      },
      {
        category: 'improvement',
        title: 'Static Finder adds fit-based filters',
        description:
          'New filter controls let players hide goal conflicts, require schedule overlap, and filter by language directly from the discovery page.',
        pr: 135,
        prTitle: 'feat(discovery): Static Finder fit score',
      },
      // ── Application Review 2.0 ───────────────────────────────────────────
      {
        category: 'improvement',
        title: 'Application review modal reorganized into clear sections',
        description:
          'The join request review modal now shows Applicant Snapshot, Job Fit, Gear & BiS (public only), Goal Alignment counts, Schedule & Comms, and a sticky Decision Panel — replacing one long unsectioned form.',
        pr: 136,
        prTitle: 'feat(recruitment): Application Review 2.0',
      },
      {
        category: 'improvement',
        title: 'Applications snapshot fit data at submission time',
        description:
          "When a player submits a join request, their public goals, public BiS target name, gear summary, and schedule overlap are snapshotted so leads see stable data even after the applicant's profile changes.",
        pr: 136,
        prTitle: 'feat(recruitment): Application Review 2.0',
      },
    ],
  },
  {
    version: '1.23.8',
    date: '2026-06-11T00:00:00Z',
    items: [
      {
        category: 'fix',
        title: 'Recent Activity no longer leaks plugin sync actor names',
        description:
          'Plugin-sourced mount and totem rows now show "A member obtained…" instead of the player\'s name, preventing personal plugin sync details from appearing on the Static Overview. Manual entries continue to show the actor name. The old ambiguous "Plugin synced N mounts" aggregate is replaced with "Shared mount data synced" (system-level, no actor count).',
      },
      {
        category: 'improvement',
        title: 'Activity privacy model: static vs personal separation',
        description:
          'Derived activity rows are now tagged with visibility (static/private) and actor display (named/anonymous/system). Static Overview only shows static-scoped rows. Plugin sync personal details carry visibility: private and are filtered out at the derivation layer before they can reach the UI.',
      },
      {
        category: 'improvement',
        title: 'Dossier modal entrance animation tightened',
        description:
          'JoinRequestReviewModal now uses scale 0.98 → 1.0 (was 0.96) with y 8px → 0 and a 180ms backdrop fade, giving the Recruitment Dossier a more polished entrance. Animation is disabled when prefers-reduced-motion is set.',
      },
      {
        category: 'improvement',
        title: 'Recent Activity and Collection Goals rows animate on insert',
        description:
          'New activity rows fade/slide in at 140ms when they appear. Collection goal rows use framer-motion layout animations for add/remove. All animations are skipped automatically under prefers-reduced-motion.',
      },
    ],
    internal: true,
  },
  {
    version: '1.23.7',
    date: '2026-06-11T00:00:00Z',
    items: [
      {
        category: 'feature',
        title: 'Collection Goals: group-level farm tracking with server-side persistence',
        description:
          'Leads and owners can now create, edit, and delete Collection Goals directly from the Static Overview. Supported types: mount, token/totem, minion, orchestrion roll, glamour, and custom reward. Token goals show a current/target counter. Goals persist to the database (owners and leads only; members are view-only, enforced server-side). Empty state guides users: "Track mounts, tokens, and rewards your group wants to farm." Raid progression is intentionally excluded to keep Collection Goals separate from tier work.',
      },
      {
        category: 'improvement',
        title: 'Schedule Farm carries duty context into CreateSessionModal',
        description:
          '"Schedule Farm" on the Static Overview now pre-fills the CreateSessionModal with the farm\'s duty name, content type, and member-need counts instead of just navigating to the Schedule tab empty-handed. The event-bus handoff preserves all farm context across the tab switch.',
      },
      {
        category: 'fix',
        title: 'Recent Activity populates on first Overview visit',
        description:
          'mount farm progress is now fetched on Overview mount so Recent Activity rows appear immediately — no longer requires visiting the Mount Farms tab first.',
      },
      {
        category: 'improvement',
        title: 'Preview application and Review Dossier now draw from the same data source',
        description:
          'A shared normalizeApplicationSnapshot() mapper is used by both the compact Command Brief preview and the Join Request Review Modal Dossier, ensuring the two views show consistent field values and copy.',
      },
      {
        category: 'improvement',
        title: 'Raid Prep rows are keyboard-accessible buttons',
        description:
          'Each player row in the Raid Prep section is now a focusable button that navigates to the Roster tab, with hover/focus states and proper aria-labels.',
      },
    ],
    internal: true,
  },
  {
    version: '1.23.6',
    date: '2026-06-11T00:00:00Z',
    items: [
      {
        category: 'improvement',
        title: 'Overview: Recent Activity, Best Next Farm, and Collection Goals',
        description:
          'Static Overview now surfaces mount farm activity. Recent Activity (center column) shows up to 5 derived rows from mount farm progress data — who obtained a mount, updated currency, or started tracking — without flooding Notifications. Best Next Farm (right column) shows the top scorer from the recommendation engine with a Schedule Farm CTA. Collection Goals copy updated to "No static collection goals yet" with a Create Static Goal CTA. Routine mount tracking events are separated from actionable notifications.',
      },
    ],
    internal: true,
  },
  {
    version: '1.23.5',
    date: '2026-06-11T00:00:00Z',
    items: [
      {
        category: 'fix',
        title: 'Static Overview V1 correctness pass',
        description:
          'Pending applications now appear in the notification rail (not suppressed by deduplication). Application teaser merged into Command Brief as an ivory/gold parchment inset — no longer a separate dark card. "Static Readiness" renamed to "Raid Prep" with compact per-member text rows (iLv · BiS · readiness). "Not rated" readiness label corrected to "Not self-rated". Application preview now shows the submitted readiness badge and consistent gear copy. Backend permission tests confirm lead can accept/decline and regular members are blocked via direct API.',
      },
    ],
    internal: true,
  },
  {
    version: '1.23.4',
    date: '2026-06-11T00:00:00Z',
    items: [
      {
        category: 'improvement',
        title: 'Static Overview dashboard redesigned',
        description:
          'The Overview tab now uses an asymmetric three-column layout with a Command Brief status bar, a dark-themed application teaser card, and a renamed Static Readiness section showing per-member iLv, BiS progress, and readiness state. Notification deduplication prevents the same application from appearing in both the notification rail and the featured teaser.',
      },
    ],
    internal: true,
  },
  {
    version: '1.23.3',
    date: '2026-06-11T00:00:00Z',
    items: [
      {
        category: 'fix',
        title: 'Discord session preview no longer posts twice',
        description:
          'The "Post latest session" button now uses deduplication: repeated posts edit the existing Discord message instead of creating duplicates. A loading state on the button prevents double-clicks.',
      },
      {
        category: 'improvement',
        title: 'Jobs & Gear card cleanup',
        description:
          'Plugin-synced job cards no longer show debug metadata. "Unknown" readiness is hidden when gear exists, "Below target" / "Missing gear" badges are now contextually accurate, and Ultimate weapon coffer rows in Collections show the duty name as the primary title.',
      },
    ],
    internal: true,
  },
  {
    version: '1.23.2',
    date: '2026-06-11T00:00:00Z',
    items: [
      {
        category: 'feature',
        title: 'Multi-job saved gearset sync',
        description:
          'The plugin now reads all saved gearsets from the game and uploads them in one batch. Each job with a saved gearset gets its own gear snapshot. Jobs without saved gearsets remain manual.',
      },
    ],
    internal: true,
  },
  {
    version: '1.23.1',
    date: '2026-06-11T00:00:00Z',
    items: [
      {
        category: 'fix',
        title: 'Gear sync freshness accuracy',
        description:
          'Plugin gear sync no longer updates the "synced at" timestamp when the gear payload is identical to existing data. A separate plugin heartbeat timestamp tracks connection status independently.',
      },
    ],
    internal: true,
  },
  {
    version: '1.23.0',
    date: '2026-06-08T08:00:00Z',
    title: 'Solo Player Hub & Join Requests',
    highlights: [
      'Your raider profile for statics, schedules, and applications',
      'Request to Join with profile-connected applications',
    ],
    items: [
      {
        category: 'feature',
        title: 'Schedule reminders and availability control',
        description:
          'Added reminder presets for at-start, 15-minute, 1-hour, 6-hour, 12-hour, and 24-hour reminders, Ultimate scheduling, and per-session availability tracking controls for fixed-session statics.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'improvement',
        title: 'Jobs & Gear sync polish',
        description:
          'Jobs & Gear now keeps gear attached to the matching job profile, hides full item lists until opened, and makes Plugin, Lodestone fallback, Manual, and Imported gear freshness clear.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'fix',
        title: 'Sync Center and Ultimate session drafts',
        description:
          'Sync Center now uses a plugin-first setup flow with fallbacks tucked into advanced options, and creating a session from Ultimate content now opens an Ultimate draft with the correct duty and neutral session copy.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Player Hub raider profile',
        description:
          'Player Hub is now organized around Overview, Sync, Jobs & Gear, Collections, Availability, Goals, and Share. Keep your raider profile current in one place for applications, schedules, roster links, farm recommendations, and future matching features.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Application snapshots from Player Hub',
        description:
          "Request to Join keeps a copy of your selected character, job, readiness, gear, availability summary, sharing state, and selected alt/flex job details when you apply. Private notes and goals stay private, while exact availability windows are included only when the applicant opts in.",
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Recruitment Dossier — parchment review modal',
        description:
          'Parchment-style recruitment dossier modal for reviewing applications. Shows character avatar, name, world, job, gear level, readiness, alt jobs, availability, Discord handle, and static fit matching with an authentic Grand Company aesthetic.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Add to Roster onboarding',
        description:
          'After accepting an applicant, leaders can add them to the roster with prefilled character data. Roster slot includes name, job, world, avatar, and Lodestone ID.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Character linking & gear sync',
        description:
          'Search and link your FFXIV character from Lodestone with gear preview. Refresh the currently equipped job from Lodestone fallback, or use plugin uploads for job-matched gear freshness.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Main & alt job tracking',
        description:
          'Track main, preferred alt, flex, emergency, and casual jobs with readiness status. Saved gear auto-links to matching job profiles.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Personal availability configuration',
        description:
          "Set per-day availability windows to share with statics. Availability is included in applications at the applicant's chosen detail level (summary or exact windows).",
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Goals & collections tracking',
        description:
          'Track FFXIV in-game goals — BiS targets, mounts, titles, and custom objectives. Collections tab shows mounts, minions, and ultimate weapon coffers.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Share & application preview',
        description:
          'Enable a shareable link to your profile. The application preview shows exactly what static leads see: job, gear level, availability, and readiness in a premium parchment dossier card.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
      {
        category: 'feature',
        title: 'Static home dashboard',
        description:
          'New Home tab for static groups: roster quick-stats (size, avg iLv, pending apps), next scheduled session, and a pending applications panel for leaders.',
        commits: [{ hash: '05a4b7b', message: 'feat: add solo player hub foundation' }],
      },
    ],
  },
  // ── Upstream entries (origin/main) ─────────────────────────────────────
  {
    version: '1.22.6',
    date: '2026-06-08T06:00:00Z',
    title: 'Release notes show pull requests',
    items: [
      {
        category: 'improvement',
        title: 'Release entries now link to their pull request, with a title',
        description:
          'Each release item now shows the pull request that introduced it — with the PR title next to the number — and keeps its commit links where available. Every past entry was backfilled, so the references are complete instead of showing a bare number.',
        pr: 128,
        prTitle: 'feat(release-notes): show PR titles + backfill PR links across all entries',
      },
    ],
  },
  {
    version: '1.22.5',
    date: '2026-06-08T04:00:00Z',
    title: 'Release notes commit links',
    items: [
      {
        category: 'fix',
        title: 'Fixed broken "pending" commit links on this page',
        description:
          'Some release entries showed a "pending" commit link that led to a 404 — a placeholder used while a change is still in review. Those now link to the pull request that introduced the change, and the page no longer shows dead links for entries that are still mid-review.',
        pr: 127,
        prTitle: 'fix(release-notes): fix broken commit links + adopt PR-link model',
      },
    ],
  },
  {
    version: '1.22.4',
    date: '2026-06-08T02:00:00Z',
    title: 'Player name editing fix',
    items: [
      {
        category: 'fix',
        title: 'Typing a space no longer drops you out of name editing',
        description:
          'When renaming a player, pressing the space bar used to deselect the field and stop the edit, making it impossible to enter names with spaces. Spaces (and every other key) now stay in the name box until you press Enter or click away.',
        pr: 125,
        prTitle: 'fix(player): keep focus when typing a space while editing a name',
      },
    ],
  },
  {
    version: '1.22.3',
    date: '2026-06-08T00:00:00Z',
    title: 'Documentation accuracy pass',
    items: [
      {
        category: 'improvement',
        title: 'Documentation refresh',
        description:
          'Audited the in-app guides (Quick Start, How-To, Gear Math, Privacy, Roadmap, API) and the developer docs against the current code. Reconciled the roadmap and status to reflect shipped features (scheduling, Lodestone sync, mount farms, plugin sign-in, static discovery), and corrected stale labels, the share-code length, priority-formula details, and gearing material costs.',
        pr: 123,
        prTitle: 'docs: comprehensive documentation audit & accuracy pass',
      },
    ],
    internal: true,
  },
  {
    version: '1.22.2',
    date: '2026-06-07T00:00:00Z',
    title: 'Discord Schedule Links',
    highlights: ['Production Discord planner links', 'Schedule reminder mention controls'],
    items: [
      {
        category: 'fix',
        title: 'Discord planner links',
        description:
          'Schedule announcements and reminders now link to the deployed planner instead of localhost, with session deep links so raid members land directly on the relevant Schedule entry.',
        pr: 119,
        prTitle: 'fix: harden Discord schedule links and mentions',
      },
      {
        category: 'improvement',
        title: 'Webhook mention targeting',
        description:
          'Schedule webhook settings now support no ping, @here, or a specific Discord role, with safer mention restrictions so reminders only notify the intended target.',
        pr: 119,
        prTitle: 'fix: harden Discord schedule links and mentions',
      },
    ],
  },
  {
    version: '1.22.1',
    date: '2026-06-06T00:00:00Z',
    title: 'Mount Farms Reliability Patch',
    highlights: ['Clearer Mount Farms errors', 'Curated farm catalog guardrails'],
    items: [
      {
        category: 'fix',
        title: 'Mount Farms loading reliability',
        description:
          'Improved Mount Farms error handling so deployment route mismatches no longer appear as a bare "Not Found" message. The tab now shows clearer guidance, includes a retry action, and logs safer diagnostics in development.',
        pr: 115,
        prTitle: 'fix: add Mount Farms route coverage and production error handling',
      },
      {
        category: 'fix',
        title: 'Mount Farms route guardrails',
        description:
          'Added backend route-registration coverage for Mount Farms static-group and plugin endpoints, plus frontend store tests for the exact static-group Mount Farms endpoint. This helps catch missing backend route artifacts before release.',
        pr: 115,
        prTitle: 'fix: add Mount Farms route coverage and production error handling',
      },
      {
        category: 'fix',
        title: 'Curated farm catalog guardrails',
        description:
          'Cleaned up invalid Dawntrail farm entries, added validation so bogus duties cannot reappear, and preserved the new rare reward / Ultimate weapon farm foundation without exposing unverified token data.',
        pr: 118,
        prTitle: 'fix: curate farm catalog and support rare reward farms',
      },
    ],
  },
  {
    version: '1.22.0',
    date: '2026-06-04T00:00:00Z',
    title: 'Mount Farm Tracker',
    highlights: ['Track mount farm progress for your static', 'Totem counting and farm recommendations'],
    items: [
      {
        category: 'feature',
        title: 'Mount Farm Tracker',
        description:
          'New "Mount Farms" tab in the static view. Track which Extreme trial mounts each member has, who wants which mount, and how many totems everyone has collected. Covers all expansions from ARR through Dawntrail.',
        pr: 114,
        prTitle: 'feat: Mount Farm Tracker with plugin sync and schedule integration',
      },
      {
        category: 'feature',
        title: 'Plugin automation',
        description:
          'Mount ownership and totem counts can be automatically synced from the Dalamud plugin. The plugin reads your unlocked mounts and inventory totem counts, then pushes them to the tracker. Manual corrections always remain available and are respected.',
        pr: 114,
        prTitle: 'feat: Mount Farm Tracker with plugin sync and schedule integration',
      },
      {
        category: 'feature',
        title: 'Farm recommendations',
        description:
          'A smart recommendation banner suggests the best mount to farm next based on how many members still need it, want it, or are close to buying it with totems.',
        pr: 114,
        prTitle: 'feat: Mount Farm Tracker with plugin sync and schedule integration',
      },
      {
        category: 'feature',
        title: 'Completion tracking',
        description:
          'Progress bars per expansion show how many trials your static has fully completed. Members who have enough totems to buy a mount are highlighted with a "can buy" badge. Source indicators show whether data came from plugin sync or manual entry.',
        pr: 114,
        prTitle: 'feat: Mount Farm Tracker with plugin sync and schedule integration',
      },
      {
        category: 'feature',
        title: 'Event categories and content linking',
        description:
          'Schedule sessions now support event categories (Raid, Farm, Reclear, Prog, Social) with color-coded badges on session cards. The "Schedule Farm" action from Mount Farms now pre-fills the category and duty name automatically.',
        pr: 114,
        prTitle: 'feat: Mount Farm Tracker with plugin sync and schedule integration',
      },
      {
        category: 'improvement',
        title: 'Session tile view and share button',
        description:
          'The Schedule tab now offers a tile/grid layout for viewing sessions on desktop, showing more events at a glance. Each session card has a share button that copies a formatted summary or uses Web Share API.',
        pr: 114,
        prTitle: 'feat: Mount Farm Tracker with plugin sync and schedule integration',
      },
      {
        category: 'improvement',
        title: 'Bundled plugin sync',
        description:
          'The `/xrp sync` command now syncs both gear and mount farms in one step. Use `/xrp gearsync` or `/xrp mountsync` for targeted syncs.',
        pr: 114,
        prTitle: 'feat: Mount Farm Tracker with plugin sync and schedule integration',
      },
    ],
  },
  {
    version: '1.21.2',
    date: '2026-06-04T00:00:00Z',
    title: 'Availability timetable redesign',
    highlights: ['Time range presets', 'Sticky headers & section dividers'],
    items: [
      {
        category: 'improvement',
        title: 'Time range presets',
        description:
          'The availability grid now offers three preset views: Prime Raid Time (6 PM – 2 AM), Evening (4 PM – midnight), and Full Day (all 24 hours). Prime raid time is the default — no more scrolling past morning hours to mark your evening availability.',
        pr: 112,
        prTitle: 'feat(schedule): redesign availability timetable UX',
      },
      {
        category: 'improvement',
        title: 'Sticky headers & section dividers',
        description:
          'Weekday/date column headers stick to the top while scrolling through the full-day view. Time-of-day section dividers (Morning, Afternoon, Evening, Late Night) provide visual anchoring. The prime preset shows an "After Midnight (+1 day)" divider at the midnight crossing.',
        pr: 112,
        prTitle: 'feat(schedule): redesign availability timetable UX',
      },
      {
        category: 'improvement',
        title: 'Hidden slots indicator',
        description:
          'When using a filtered preset, a warning badge shows how many of your selected slots are in hidden hours — one click to expand to full day.',
        pr: 112,
        prTitle: 'feat(schedule): redesign availability timetable UX',
      },
    ],
  },
  {
    version: '1.21.1',
    date: '2026-06-03T23:00:00Z',
    title: 'Design system lint cleanup',
    items: [
      {
        category: 'improvement',
        title: 'Suppress raw button lint warnings',
        description:
          'Added eslint-disable comments to 56 files that intentionally use raw <button> elements (toggles, selectors, context menus, etc.) where the Button/IconButton primitives do not fit. Zero lint warnings remain.',
        pr: 110,
        prTitle: 'chore(frontend): suppress raw button design-system lint warnings',
      },
    ],
    internal: true,
  },
  {
    version: '1.21.0',
    date: '2026-06-01T12:00:00Z',
    title: 'Find a Static',
    highlights: ['Static Finder recruitment board', 'Request to join & applicant inbox'],
    items: [
      {
        category: 'feature',
        title: 'Find a Static — recruitment board',
        description:
          'A new /discover page lets players search and browse statics recruiting for current and upcoming tiers. Search by name or description, filter by role, job, data center, server, intensity, status, timezone, and language. Sort by recently updated, most members, or name. Filters sync to the URL for shareable links.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
      {
        category: 'feature',
        title: 'Listing setup with live preview',
        description:
          'Owners and leads can configure their recruitment listing from the new Listing tab in static settings. A status banner shows whether the listing is live, and a preview card at the bottom shows exactly what players will see. All fields use dropdowns and chips.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
      {
        category: 'feature',
        title: '"Suggest from static" assisted setup',
        description:
          'Click "Suggest from static" to auto-fill empty listing fields from your schedule sessions, availability templates, and roster data. Only empty fields are filled — existing values are never overwritten.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
      {
        category: 'improvement',
        title: 'Listing cards with copy link and expandable details',
        description:
          'Each listing card shows recruitment status, location, schedule, needed roles/jobs, and a contact blurb. Long descriptions expand inline. Copy a direct link to any static with the copy button. Request-to-join is coming in a future update.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
      {
        category: 'improvement',
        title: 'Structured contact info for listings',
        description:
          'Owners can now add a Discord tag, server invite link, Lodestone/community URL, or freeform contact instructions to their listing. Contact info shows prominently on listing cards so recruits know exactly how to reach you.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
      {
        category: 'improvement',
        title: 'Cozier listing cards and clearer setup',
        description:
          'Listing cards now have clear sections for Raid Nights, Looking For, and About. The settings form is organized into labeled sections with warmer copy. Filters are split into two rows so dropdowns no longer overlap. Privacy reassurance is more prominent throughout.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
      {
        category: 'improvement',
        title: 'Privacy-safe listings',
        description:
          'Member count is now hidden by default — owners opt in with a toggle. Contact URLs are validated (https only). Description and contact fields have a clear "this is public" warning. Unsafe URL protocols (javascript:, data:) are blocked.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
      {
        category: 'feature',
        title: 'Request to join from Static Finder',
        description:
          'Players browsing the recruitment board can send a join request directly from discovery cards or when viewing a discoverable static. Includes role/job interest, a short message, and availability note.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
      {
        category: 'feature',
        title: 'Join request inbox for leads',
        description:
          'Owners and leads can review incoming applications in the new Requests tab under static settings. Accept to add as member, or decline. A pending count badge shows unread requests.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
      {
        category: 'improvement',
        title: 'Privacy-safe applicant handling',
        description:
          'Applicants can now provide a temporary Discord handle so the lead can reach them. The handle — along with the message and availability note — is automatically deleted once the request is accepted, declined, or cancelled. No Discord account data from login is ever shared with leads.',
        pr: 99,
        prTitle: 'feat(1.21.0): Static Finder, public recruitment board with privacy-safe listings',
      },
    ],
  },
  {
    version: '1.20.1',
    date: '2026-06-03T16:00:00Z',
    title: 'Gear Sync Safety & Tomestone Refresh',
    highlights: ['Auto-sync safety gates', 'Manual sync overwrite confirmation'],
    items: [
      {
        category: 'improvement',
        title: 'Safer automatic gear sync',
        description:
          'Auto-sync now applies conservative safety gates before writing gear. It skips sync when the upstream active job doesn\'t match the player\'s registered job, when the upstream item level is lower than saved gear, when the upstream payload is incomplete, when the provider identity doesn\'t match the linked character, and it never clears stored gear just because an upstream slot is missing. This prevents auto-sync from destroying Ultimate BiS sets, manually curated gear, or overwriting good data with stale provider snapshots.',
        pr: 109,
        prTitle: 'fix(gear-sync): v1.20.1 — auto-sync safety gates & Tomestone refresh',
      },
      {
        category: 'improvement',
        title: 'Manual sync overwrite confirmation',
        description:
          'Manually syncing gear now shows a warning and requires confirmation before applying when risky conditions are detected — wrong job, lower item level, incomplete gear, or server/name mismatch. Safe syncs proceed without interruption.',
        pr: 109,
        prTitle: 'fix(gear-sync): v1.20.1 — auto-sync safety gates & Tomestone refresh',
      },
      {
        category: 'improvement',
        title: 'Force refresh & Tomestone link',
        description:
          'Force Refresh now bypasses the local preview cache so you always get the latest data Tomestone has. Tomestone\'s upstream refresh requires a browser visit, so if data looks stale the app links you directly to the character\'s Tomestone page to click Refresh there. Full Tomestone API integration for automatic refresh is in progress.',
        pr: 109,
        prTitle: 'fix(gear-sync): v1.20.1 — auto-sync safety gates & Tomestone refresh',
      },
    ],
  },
  {
    version: '1.20.0',
    date: '2026-06-03T12:00:00Z',
    title: 'Plugin browser sign-in',
    highlights: ['One-click plugin authentication', 'No more API key copy/paste'],
    items: [
      {
        category: 'feature',
        title: 'Sign in to the Dalamud plugin from your browser',
        description:
          'The XIV Raid Planner Dalamud plugin can now authenticate via a one-click browser flow. Click "Sign in with browser" in the plugin\'s config window, approve on the web app, and the plugin receives an API key automatically — no more copying and pasting xrp_ tokens. Manual key entry remains available under Advanced for custom or self-hosted servers.',
        pr: 89,
        prTitle: 'Plugin browser sign-in (loopback OAuth + PKCE)',
      },
    ],
  },
  {
    version: '1.19.3',
    date: '2026-05-31T18:00:00Z',
    title: 'Mobile UI Polish and CI Reliability',
    highlights: ['Mobile controls stay on-screen', 'Fork PR automation skips safely'],
    items: [
      {
        category: 'fix',
        title: 'Dropdown menus no longer overflow on mobile',
        description:
          'Job picker, static switcher, and tier selector dropdowns are now clamped to viewport width so they stay on-screen at 360–430px.',
        pr: 98,
        prTitle: '[Fix and CICD] Mobile Polish and CI/CD .md fixes',
        commits: [{ hash: 'dee3a1d', message: 'fix(mobile): prevent dropdown overflow, sticky modal footer, tighter grids', date: '2026-05-31T18:00:00Z' }],
      },
      {
        category: 'fix',
        title: 'Session modal buttons always reachable',
        description:
          'Create/Edit Session modal now uses a sticky footer so Save and Cancel buttons stay visible even when the form content is long.',
        pr: 98,
        prTitle: '[Fix and CICD] Mobile Polish and CI/CD .md fixes',
        commits: [{ hash: 'dee3a1d', message: 'fix(mobile): prevent dropdown overflow, sticky modal footer, tighter grids', date: '2026-05-31T18:00:00Z' }],
      },
      {
        category: 'fix',
        title: 'Release notes wrap correctly on mobile',
        description:
          'Long release titles, descriptions, badges, dates, and expanded commit details now wrap inside the card instead of overflowing on phone widths.',
        pr: 98,
        prTitle: '[Fix and CICD] Mobile Polish and CI/CD .md fixes',
        commits: [{ hash: '6b605d9', message: 'fix(release-notes): prevent mobile overflow', date: '2026-05-31T18:00:00Z' }],
      },
      {
        category: 'improvement',
        title: 'Tighter availability grid on small screens',
        description:
          'Reduced column minimums in the availability grid so less horizontal scrolling is needed on phones.',
        pr: 98,
        prTitle: '[Fix and CICD] Mobile Polish and CI/CD .md fixes',
        commits: [{ hash: 'dee3a1d', message: 'fix(mobile): prevent dropdown overflow, sticky modal footer, tighter grids', date: '2026-05-31T18:00:00Z' }],
      },
      {
        category: 'improvement',
        title: 'Fork PR automation skips safely',
        description:
          'PR automation and release-note reminder workflows now document and enforce fork-safe guards so read-only fork tokens do not fail CI.',
        pr: 98,
        prTitle: '[Fix and CICD] Mobile Polish and CI/CD .md fixes',
        commits: [{ hash: '4192132', message: 'fix(ci): skip fork-PR workflows, add v1.19.3 internal release note', date: '2026-05-31T18:00:00Z' }],
      },
      {
        category: 'fix',
        title: 'Player card header no longer overflows on mobile',
        description:
          'Long player names wrap naturally at a smaller font size, badges (MT/OT, position) wrap via flex-wrap, and right-side metrics stay pinned.',
        commits: [{ hash: '7445c9d', message: 'fix(mobile): player card header responsive layout', date: '2026-06-01T08:00:00Z' }],
      },
      {
        category: 'improvement',
        title: 'Two-row mobile header',
        description:
          'The static name drops to its own full-width row below the logo on mobile instead of competing for space with icons.',
        commits: [{ hash: '74acb18', message: 'fix(mobile): two-row header layout', date: '2026-06-01T08:00:00Z' }],
      },
      {
        category: 'improvement',
        title: 'Contributor and agent checklist guidance',
        description:
          'AGENTS.md, CLAUDE.md, and the pull request template now call out release note requirements, fork PR guard checks, and pre-PR audit commands.',
        pr: 98,
        prTitle: '[Fix and CICD] Mobile Polish and CI/CD .md fixes',
        commits: [{ hash: '43d89f2', message: 'docs: add contributor/agent PR rules and PR template', date: '2026-05-31T18:00:00Z' }],
      },
    ],
  },
  {
    version: '1.19.2',
    date: '2026-05-31T12:00:00Z',
    title: 'Typical Week Availability',
    highlights: ['Recurring schedule templates', 'Best permanent raid window finder'],
    items: [
      {
        category: 'feature',
        title: 'Typical week availability grid',
        description:
          'Members can now mark their standing weekly schedule — "I\'m always free on Saturday evenings" — separate from specific-week availability. A "Typical week" toggle in the Availability tab switches the grid to weekday columns instead of dates.',
        pr: 94,
        prTitle: 'feat(schedule): recurring availability templates and best-window finder',
      },
      {
        category: 'feature',
        title: 'Best recurring raid window recommendations',
        description:
          'In Typical week mode, the top panel shows the three best permanent raid windows based on the static\'s combined weekly templates. Clicking "Create recurring session" pre-fills a weekly-recurring session on the right weekday.',
        pr: 94,
        prTitle: 'feat(schedule): recurring availability templates and best-window finder',
      },
      {
        category: 'fix',
        title: 'Availability grid shows full 24-hour range',
        description:
          'The grid was incorrectly capped at 12:00 PM, hiding all morning slots.',
        pr: 94,
        prTitle: 'feat(schedule): recurring availability templates and best-window finder',
      },
    ],
  },
  {
    version: '1.19.1',
    date: '2026-05-31T12:00:00Z',
    title: 'Availability Grid Fix',
    highlights: ['Full 24-hour availability grid'],
    items: [
      {
        category: 'fix',
        title: 'Availability grid now shows all hours',
        description:
          'The availability grid was incorrectly capped at 12:00 PM, hiding all morning slots. It now shows the full 24-hour range.',
        pr: 93,
        prTitle: 'fix(schedule): show full 24-hour range in availability grid',
        commits: [{ hash: '9342852', message: 'fix(schedule): show full 24-hour range in availability grid', date: '2026-05-31T12:00:00Z' }],
      },
    ],
  },
  {
    version: '1.19.0',
    date: '2026-05-29T12:00:00Z',
    title: 'Tomestone Sync & BiS Comparison',
    highlights: ['Equipped gear shown alongside BiS', 'Lodestone avatar on player cards'],
    items: [
      {
        category: 'feature',
        title: 'Tomestone sync — equipped gear display',
        description:
          'After a Lodestone sync, each gear slot tooltip now shows both the BiS target and what the player currently has equipped, pulled from the Tomestone API.',
        commits: [{ hash: '2b56895', message: 'feat(pr3): Tomestone sync — equipped gear, avatar, tooltip redesign', date: '2026-05-29T12:00:00Z' }],
      },
      {
        category: 'feature',
        title: 'BiS comparison badges on gear tooltips',
        description:
          'Hover any gear slot to instantly see one of four states: "BiS matched ✓", "Upgrade needed", "Not currently detected", or "No BiS target configured". Item level diff vs BiS is shown inline.',
        commits: [{ hash: '2b56895', message: 'feat(pr3): Tomestone sync — equipped gear, avatar, tooltip redesign', date: '2026-05-29T12:00:00Z' }],
      },
      {
        category: 'feature',
        title: 'Lodestone avatar on player cards',
        description:
          'Player cards now show the character\'s Lodestone avatar after a successful sync.',
        commits: [{ hash: '2b56895', message: 'feat(pr3): Tomestone sync — equipped gear, avatar, tooltip redesign', date: '2026-05-29T12:00:00Z' }],
      },
      {
        category: 'feature',
        title: 'Discord webhook announcements for raid sessions',
        description:
          'Creating, updating, or deleting a raid session — and every RSVP change — now fires a real Discord announcement when a webhook is configured. A "Post latest session" button lets leads push the next upcoming session manually.',
        commits: [{ hash: 'ff0c759', message: 'feat(schedule): wire Discord webhook to session lifecycle', date: '2026-05-30T12:00:00Z' }],
      },
      {
        category: 'improvement',
        title: 'Recurring session creation from availability',
        description:
          'Clicking "Create session" from an availability recommendation now pre-fills the correct future date (not a past week) and automatically sets the session as weekly-recurring on the right weekday.',
        commits: [{ hash: 'ff0c759', message: 'feat(schedule): wire Discord webhook to session lifecycle', date: '2026-05-30T12:00:00Z' }],
      },
    ],
  },
  {
    version: '1.18.0',
    date: '2026-05-27T12:00:00Z',
    title: 'Raid Schedule & Availability',
    highlights: ['Schedule tab with RSVPs', 'When2Meet-style availability grid'],
    items: [
      {
        category: 'feature',
        title: 'Raid session scheduling',
        description:
          "New Schedule tab where leads can post one-off or recurring raid sessions. Times are stored in the static's timezone and auto-convert to each member's local time, and everyone can RSVP as available, tentative, or unavailable.",
        pr: 83,
        prTitle: 'Add schedule availability and tighten dev auth gating',
        commits: [{ hash: '81a5c8b', message: 'Add schedule availability and tighten dev auth gating' }],
      },
      {
        category: 'feature',
        title: 'Availability heat map',
        description:
          "A When2Meet-style grid lets members paint when they're free across the coming week. Overlapping slots are highlighted so the static can spot the strongest raid windows at a glance.",
        pr: 83,
        prTitle: 'Add schedule availability and tighten dev auth gating',
        commits: [{ hash: '81a5c8b', message: 'Add schedule availability and tighten dev auth gating' }],
      },
      {
        category: 'fix',
        title: 'Member sessions hydrate on load',
        description:
          'Fixed a case where a logged-in member could fail to load after a refresh, which blocked member-only edit and save actions until re-login.',
        pr: 83,
        prTitle: 'Add schedule availability and tighten dev auth gating',
        commits: [{ hash: '81a5c8b', message: 'Add schedule availability and tighten dev auth gating' }],
      },
    ],
  },
  {
    version: '1.17.0',
    date: '2026-03-19T12:00:00Z',
    title: 'Loot Log Restructure',
    highlights: ['Tab rename: Loot → Priority', 'All Weeks loot view'],
    items: [
      {
        category: 'improvement',
        title: 'Tab rename: Loot → Priority, Log → Loot Log',
        description: 'Clearer tab names that match their actual function. "Priority" shows loot rankings, "Loot Log" is where you track drops.',
        pr: 81,
        prTitle: 'Loot Log restructure, All Weeks view, materials in Who Needs It',
        commits: [{ hash: 'fb93dd3', message: 'feat: restructure Loot/Log tabs with rename, All Weeks view, and multi-entry badges' }],
      },
      {
        category: 'feature',
        title: 'All Weeks loot view',
        description: 'New "All Weeks" sub-view in the Loot Log tab shows every loot and material entry across all weeks in a filterable, sortable table with smart search.',
        pr: 81,
        prTitle: 'Loot Log restructure, All Weeks view, materials in Who Needs It',
        commits: [{ hash: 'fb93dd3', message: 'feat: restructure Loot/Log tabs with rename, All Weeks view, and multi-entry badges' }],
      },
      {
        category: 'improvement',
        title: 'Sub-view rename: Week → Grid, History → List',
        description: 'Layout toggle labels now match what they display — a spreadsheet grid or a chronological list.',
        pr: 81,
        prTitle: 'Loot Log restructure, All Weeks view, materials in Who Needs It',
        commits: [{ hash: 'fb93dd3', message: 'feat: restructure Loot/Log tabs with rename, All Weeks view, and multi-entry badges' }],
      },
      {
        category: 'feature',
        title: 'Multi-entry grid badges',
        description: 'Grid cells with multiple loot entries (e.g., raid drop + book purchase) now show a ×N badge. Click the badge to see all entries for that slot.',
        pr: 81,
        prTitle: 'Loot Log restructure, All Weeks view, materials in Who Needs It',
        commits: [{ hash: 'fb93dd3', message: 'feat: restructure Loot/Log tabs with rename, All Weeks view, and multi-entry badges' }],
      },
      {
        category: 'improvement',
        title: 'URL backward compatibility',
        description: '?tab=loot still works (maps to Priority tab). ?tab=priority added as new canonical URL.',
        pr: 81,
        prTitle: 'Loot Log restructure, All Weeks view, materials in Who Needs It',
        commits: [{ hash: 'fb93dd3', message: 'feat: restructure Loot/Log tabs with rename, All Weeks view, and multi-entry badges' }],
      },
    ],
  },
  {
    version: '1.16.0',
    date: '2026-03-19T08:00:00Z',
    title: 'Analytics & Error Reporting',
    highlights: ['Admin analytics dashboard', 'Automatic error tracking'],
    items: [
      {
        category: 'feature',
        title: 'Admin analytics dashboard',
        description: 'Redesigned admin area with sidebar navigation, KPI cards, growth charts, top users/statics tables, and feature usage analytics',
        pr: 76,
        prTitle: 'Add analytics, usage tracking, and error reporting',
        commits: [{ hash: 'e1cb8fd', message: 'feat: add admin dashboard shell with sidebar, overview page, and Recharts charts' }],
      },
      {
        category: 'feature',
        title: 'Automatic error reporting',
        description: 'Frontend and backend errors are now captured automatically with grouped error log, severity filtering, and mark-as-reviewed workflow',
        pr: 76,
        prTitle: 'Add analytics, usage tracking, and error reporting',
        commits: [{ hash: '4a40d1e', message: 'feat: add usage analytics and error log admin pages' }],
      },
      {
        category: 'feature',
        title: 'Usage analytics tracking',
        description: 'Tracks feature usage across the app including tab switches, BiS imports, loot logging, wizard usage, and more',
        pr: 76,
        prTitle: 'Add analytics, usage tracking, and error reporting',
        commits: [{ hash: '279a8ca', message: 'feat: add analytics tracking points across frontend' }],
      },
      {
        category: 'feature',
        title: 'Discord error alerts',
        description: 'Critical and recurring errors trigger Discord webhook notifications for proactive monitoring',
        pr: 76,
        prTitle: 'Add analytics, usage tracking, and error reporting',
        commits: [{ hash: 'cc4e6e7', message: 'feat: add Discord webhook alerts and analytics data retention task' }],
      },
      {
        category: 'improvement',
        title: 'Data retention',
        description: 'Raw analytics events older than 90 days are automatically aggregated into daily rollups to keep the database lean',
        pr: 76,
        prTitle: 'Add analytics, usage tracking, and error reporting',
        commits: [{ hash: 'cc4e6e7', message: 'feat: add Discord webhook alerts and analytics data retention task' }],
      },
    ],
  },
  {
    version: '1.15.1',
    date: '2026-03-19T06:00:00Z',
    title: 'Gear Slot Highlighting',
    highlights: ['Alt+click highlights specific gear row'],
    items: [
      {
        category: 'improvement',
        title: 'Gear slot row highlight',
        description: 'Alt+clicking a log entry now highlights the specific gear slot row on the player card instead of the entire card',
        pr: 75,
        prTitle: 'feat: gear slot row highlight + weapon nav fixes',
        commits: [{ hash: '6dd8d11', message: 'feat: highlight gear slot row instead of whole card on alt+click' }],
      },
      {
        category: 'fix',
        title: 'Weapon navigation accuracy',
        description: 'Alt+clicking the weapon row now navigates to the main weapon drop, not extra/alt weapons from Weapon Priorities',
        pr: 75,
        prTitle: 'feat: gear slot row highlight + weapon nav fixes',
        commits: [{ hash: '27bd846', message: 'fix: prefer main weapon over extra/alt when navigating from gear slot' }],
      },
      {
        category: 'fix',
        title: 'Consistent weapon display',
        description: 'All weapon log entries now show the job icon and abbreviation, including historical entries',
        pr: 75,
        prTitle: 'feat: gear slot row highlight + weapon nav fixes',
        commits: [{ hash: 'b7b48cd', message: 'fix: show job icon on all weapon log entries' }],
      },
    ],
  },
  {
    version: '1.15.0',
    date: '2026-03-19T04:00:00Z',
    title: 'UI Polish',
    highlights: ['Exo 2 display font', 'Smooth page transitions and animations'],
    items: [
      {
        category: 'improvement',
        title: 'Typography upgrade',
        description: 'Exo 2 display font for headings and titles, Inter for body text',
        pr: 74,
        prTitle: 'feat: frontend UI upgrade — typography, motion, polish',
        commits: [{ hash: 'f164cbb', message: 'feat: UI upgrade phases 1-2 — typography, depth, and motion system' }],
      },
      {
        category: 'improvement',
        title: 'Motion system',
        description: 'Smooth page transitions, staggered grid reveals, shimmer skeleton loading, and toast enter/exit animations',
        details:
          'Built on framer-motion with reusable animation presets. All animations respect prefers-reduced-motion. Framer-motion split into its own bundle chunk for optimal loading.',
        commits: [
          { hash: 'f164cbb', message: 'feat: UI upgrade phases 1-2 — typography, depth, and motion system' },
          { hash: '52d8944', message: 'feat: phase 4 — loading and toast polish' },
        ],
      },
      {
        category: 'improvement',
        title: 'Landing page refresh',
        description: 'Hero gradient atmosphere, staggered entrance animation, feature card icons, and tier timeline visualization',
        pr: 74,
        prTitle: 'feat: frontend UI upgrade — typography, motion, polish',
        commits: [{ hash: 'a36a82c', message: 'feat: phase 3 — landing page transformation' }],
      },
      {
        category: 'improvement',
        title: 'Visual depth',
        description: 'Card hover glow effects, progress ring glow at 75%+ completion, and shadow-xl on modals',
        pr: 74,
        prTitle: 'feat: frontend UI upgrade — typography, motion, polish',
        commits: [{ hash: 'e00dca8', message: 'feat: phase 5 — surface atmosphere and card polish' }],
      },
      {
        category: 'fix',
        title: 'Dark Reader compatibility',
        description: 'Added darkreader-lock meta tag to prevent the Dark Reader extension from conflicting with the built-in theme system',
        pr: 74,
        prTitle: 'feat: frontend UI upgrade — typography, motion, polish',
        commits: [{ hash: 'ce6db1d', message: 'fix: prevent Dark Reader from overriding app theme' }],
      },
      {
        category: 'fix',
        title: 'Skeleton design system compliance',
        description: 'Fixed 9 hardcoded bg-slate-* colors in skeleton components with semantic design tokens',
        pr: 74,
        prTitle: 'feat: frontend UI upgrade — typography, motion, polish',
        commits: [{ hash: 'f164cbb', message: 'feat: UI upgrade phases 1-2 — typography, depth, and motion system' }],
      },
      {
        category: 'improvement',
        title: 'Bundle size monitoring',
        description: 'Added size-limit for tracking JS and CSS bundle sizes during development',
        pr: 74,
        prTitle: 'feat: frontend UI upgrade — typography, motion, polish',
        commits: [{ hash: '19ed38b', message: 'feat: phase 6 — bundle size monitoring' }],
      },
    ],
  },
  {
    version: '1.14.0',
    date: '2026-03-01T08:00:00Z',
    title: 'Plugin API',
    highlights: ['API key auth for Dalamud plugin', 'Server-side loot priority'],
    items: [
      {
        category: 'feature',
        title: 'API key authentication',
        description: 'Generate API keys to connect the Dalamud plugin to your static',
        details:
          'Create and manage API keys from your user menu. Keys use the xrp_ prefix, are hashed with SHA-256, and can be revoked at any time. Manage keys under Settings > API Keys.',
        pr: 70,
        prTitle: 'feat: API key auth and server-side priority for Dalamud plugin',
        commits: [{ hash: 'f0581b0', message: 'feat: add API key auth system and server-side priority endpoint' }],
      },
      {
        category: 'feature',
        title: 'Server-side loot priority',
        description: 'Loot priority calculations are now available via API for the in-game overlay',
        details:
          'The priority algorithm has been ported server-side so the Dalamud plugin can display accurate priority rankings in-game without needing the web app open.',
        pr: 70,
        prTitle: 'feat: API key auth and server-side priority for Dalamud plugin',
        commits: [{ hash: 'fb253ce', message: 'test: add tests for API key system and priority calculator' }],
      },
      {
        category: 'improvement',
        title: 'Ring slot normalization',
        description: 'Loot log ring entries correctly map to ring1/ring2 gear slots',
        pr: 70,
        prTitle: 'feat: API key auth and server-side priority for Dalamud plugin',
        commits: [{ hash: '9a9ce72', message: 'fix: handle ring slot name mismatch between loot log and gear' }],
      },
    ],
  },
  {
    version: '1.13.0',
    date: '2026-02-23T08:00:00Z',
    title: 'Light Mode',
    highlights: ['Light mode theme with day/night toggle'],
    items: [
      {
        category: 'feature',
        title: 'Light mode theme',
        description: 'Switch between dark and light themes via the toggle in your user menu',
        details:
          'Full light mode support with carefully tuned colors for readability. The app respects your OS preference by default, and your choice persists across sessions. All surfaces, text, badges, glows, and role colors adapt automatically.',
        pr: 68,
        prTitle: 'feat: add light mode theme with floating day/night toggle',
        commits: [{ hash: '0234686', message: 'feat: add light mode theme with floating day/night toggle' }],
      },
    ],
  },
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
          'Three modes available: Automatic (system calculates and highlights top priority - default), Manual (show priority scores but no highlighting), and Disabled (equal priority for all players - great for groups that rotate loot equally). All existing statics default to Automatic mode, so your current priority behavior is unchanged. To switch modes, go to Group Settings → Priority.',
        pr: 66,
        prTitle: 'feat: verbose loot priority control and streamlined week/floor drop wizards',
        commits: [{ hash: 'bd5c0d7', message: 'feat: add flexible priority settings for loot distribution' }],
      },
      {
        category: 'feature',
        title: 'Job priority modifiers',
        description: 'Fine-tune priority for specific jobs in your static',
        details:
          'Add per-job adjustments from -100 to +100 in Group Settings → Priority → Advanced Options. For example, give +20 priority to PCT if they need extra gear focus, or -15 to tanks if healers should get priority.',
        pr: 66,
        prTitle: 'feat: verbose loot priority control and streamlined week/floor drop wizards',
        commits: [{ hash: 'bd5c0d7', message: 'feat: add flexible priority settings for loot distribution' }],
      },
      {
        category: 'feature',
        title: 'Per-player priority adjustments',
        description: 'Adjust individual player priority for catch-up or balancing',
        details:
          'Right-click any player card and select "Adjust Priority" to set a modifier from -100 to +100. Useful when a new member joins mid-tier and needs catch-up priority, or to balance out a player who got lucky early.',
        pr: 66,
        prTitle: 'feat: verbose loot priority control and streamlined week/floor drop wizards',
        commits: [{ hash: 'bd5c0d7', message: 'feat: add flexible priority settings for loot distribution' }],
      },
      {
        category: 'feature',
        title: 'Enhanced fairness scoring (opt-in)',
        description: 'Add drought bonuses and balance penalties based on loot history',
        details:
          'Enable in Group Settings → Priority → Advanced Options. Players who haven\'t received drops recently get a "drought bonus" while players with more than average drops get a small penalty. Helps ensure more even distribution over time.',
        pr: 66,
        prTitle: 'feat: verbose loot priority control and streamlined week/floor drop wizards',
        commits: [{ hash: 'bd5c0d7', message: 'feat: add flexible priority settings for loot distribution' }],
      },
      {
        category: 'improvement',
        title: 'Priority breakdown tooltips',
        description: 'Hover over priority scores to see exactly how they\'re calculated',
        details:
          'The tooltip now shows role priority, gear need, job modifiers, player modifiers, and any enhanced scoring adjustments. Makes it easy to understand why one player has higher priority than another.',
        pr: 66,
        prTitle: 'feat: verbose loot priority control and streamlined week/floor drop wizards',
        commits: [{ hash: 'bd5c0d7', message: 'feat: add flexible priority settings for loot distribution' }],
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
        pr: 64,
        prTitle: 'fix: remove email collection from Discord OAuth',
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
        pr: 62,
        prTitle: 'feat: Add hide setup banners settings and material logging enhancements',
        commits: [{ hash: '879f036', message: 'feat: add hide setup banners settings and material logging enhancements' }],
      },
      {
        category: 'feature',
        title: 'Auto-augment gear when logging materials',
        description: 'Material logging modals now offer to automatically mark gear as augmented',
        details:
          'When logging twine, glaze, solvent, or universal tomestone, a checkbox lets you simultaneously mark the corresponding gear slot as augmented. The system tracks which slot was augmented for each material entry, enabling precise undo on deletion. Note: A one-time data migration will sync existing material entries with gear status using heuristics for entries logged before this feature.',
        pr: 62,
        prTitle: 'feat: Add hide setup banners settings and material logging enhancements',
        commits: [{ hash: '879f036', message: 'feat: add hide setup banners settings and material logging enhancements' }],
      },
      {
        category: 'feature',
        title: 'Alt+Click navigation to material entries',
        description: 'Alt+Click on tome gear slots to jump to the corresponding material entry',
        details:
          'Alt+Click on any tome gear slot icon navigates to the Log tab and highlights the material entry that augmented that slot. Also available via context menu "Jump to Material Entry".',
        pr: 62,
        prTitle: 'feat: Add hide setup banners settings and material logging enhancements',
        commits: [{ hash: '879f036', message: 'feat: add hide setup banners settings and material logging enhancements' }],
      },
      {
        category: 'fix',
        title: 'Universal Tomestone priority calculation',
        description: 'Fixed priority showing for players who already have the tome weapon',
        details:
          'Universal Tomestone priority now correctly shows for players pursuing the tome weapon who don\'t have it yet, rather than incorrectly showing for players who already have it.',
        pr: 62,
        prTitle: 'feat: Add hide setup banners settings and material logging enhancements',
        commits: [{ hash: '879f036', message: 'feat: add hide setup banners settings and material logging enhancements' }],
      },
      {
        category: 'fix',
        title: 'BiS import index for multi-set XIVGear sheets',
        description: 'Fixed preset selection importing wrong set when XIVGear sheet has separators',
        details:
          'BiS import now uses original XIVGear array indices instead of filtered indices, fixing an issue where presets with separators (like DNC, WHM, BLM, PCT, SMN) would import the wrong gear set.',
        pr: 62,
        prTitle: 'feat: Add hide setup banners settings and material logging enhancements',
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
        title: 'Mobile layout improvements',
        description: 'Better scroll containment, filter alignment, and touch-friendly buttons across Log and Loot tabs',
        details:
          'Log tab now has proper scroll containment with the week selector spanning full width. Loot tab filter bars are aligned consistently between Gear Priority and Weapon Priority tabs. Loot log entries now use icon buttons for Copy URL, Edit, and Delete actions.',
        pr: 60,
        prTitle: 'feat: Mobile UX Optimization',
        commits: [{ hash: '5bcb066', message: 'fix: mobile UX polish - scroll containment, filter alignment, icon buttons' }],
      },
      {
        category: 'improvement',
        title: 'Dashboard side padding',
        description: 'Increased side padding on the dashboard for better breathing room on all screen sizes',
      },
    ],
  },
  {
    version: '1.10.1',
    date: '2026-01-24T21:00:00Z',
    title: 'Multi-Set BiS Link Fix',
    highlights: ['BiS badge links to correct set', 'Fixed for DNC, WHM, BLM, PCT, SMN'],
    items: [
      {
        category: 'fix',
        title: 'BiS badge links to correct set for multi-set XIVGear presets',
        description:
          'Fixed an issue where the BiS badge would link to the wrong set when using XIVGear presets with multiple gear sets (e.g., DNC 7.4 Baseline vs 7.4 BiS)',
        details:
          'Jobs affected: DNC, WHM, BLM, PCT, SMN. When these jobs import BiS from presets with multiple sets, the system now correctly remembers which set was selected. Re-importing will use the same set, and the BiS badge will link directly to it.',
        pr: 59,
        prTitle: 'fix: store setIndex in shortlink bisLinks for multi-set XIVGear sheets',
        commits: [{ hash: '3f7403f', message: 'fix: store setIndex in shortlink bisLinks for multi-set XIVGear sheets' }],
      },
    ],
  },
  {
    version: '1.10.0',
    date: '2026-01-24T17:00:00Z',
    title: 'Materia in Gear Tooltips',
    highlights: ['View materia melds in gear tooltips', 'No need to visit BiS links'],
    items: [
      {
        category: 'feature',
        title: 'Materia display in gear tooltips',
        description: 'View materia melds directly in gear slot tooltips without visiting your BiS link',
        details:
          'Gear tooltips now show melded materia with stat values (e.g., "54 DET"). Hover over materia for full details including the materia name and exact stat bonus. Materia data is imported automatically when you import a BiS from XIVGear or Etro.',
        pr: 58,
        prTitle: 'feat: add materia display to gear tooltips (L-003)',
        commits: [{ hash: '13103b6', message: 'feat: add materia display to gear tooltips (L-003)' }],
      },
      {
        category: 'improvement',
        title: 'High-resolution materia icons',
        description: 'Materia icons now use higher resolution images for better clarity',
        pr: 58,
        prTitle: 'feat: add materia display to gear tooltips (L-003)',
        commits: [{ hash: '13103b6', message: 'feat: add materia display to gear tooltips (L-003)' }],
      },
    ],
  },
  {
    version: '1.9.2',
    date: '2026-01-24T15:30:00Z',
    title: 'Member Permissions & Edit Books',
    highlights: ['Members can only edit their own cards', 'Edit Books shortcut for members'],
    items: [
      {
        category: 'fix',
        title: 'Member permissions fix',
        description: 'Members can now only edit name, position, and tank role on their own player cards',
        details:
          'Fixed a bug where members could edit other players\' name, position, and tank role. Now properly enforces that members can only edit their own claimed player card. Owners, leads, and admins retain full editing access to all cards.',
        pr: 57,
        prTitle: 'fix: member permissions and add Edit Books feature',
        commits: [{ hash: 'fb13b60', message: 'fix: member permissions and add Edit Books feature' }],
      },
      {
        category: 'feature',
        title: 'Edit Books context menu',
        description: 'Quick access to edit your book counts from the player card context menu',
        details:
          'Members now see an "Edit Books" option in their player card context menu. Clicking it navigates to the Log tab and highlights their row in the Books panel. Members can edit only their own book cells and view their own book history. Owners and leads see this option on all player cards.',
        pr: 57,
        prTitle: 'fix: member permissions and add Edit Books feature',
        commits: [{ hash: '7fc96a8', message: 'fix: show Edit Books menu for owners/leads/admins on any card' }],
      },
      {
        category: 'improvement',
        title: 'Mark Floor Cleared hidden from members',
        description: 'The "Mark Floor Cleared" button is now only visible to owners and leads',
        details:
          'Members no longer see the "Mark Floor Cleared" button in the Books panel, since awarding books to the party is a lead/owner responsibility. Members can still edit their own individual book counts.',
      },
    ],
  },
  {
    version: '1.9.1',
    date: '2026-01-20T17:00:00Z',
    title: 'Error Modal Overlay',
    highlights: ['Errors display as dismissible modal', 'One-click bug reporting'],
    items: [
      {
        category: 'improvement',
        title: 'Error modal overlay',
        description: 'Errors now display as a dismissible modal overlay instead of redirecting to a full-page error',
        details:
          'When an error occurs while viewing a static, you now see a modal overlay instead of losing your current view. The modal includes the error message, technical details (URL, timestamp, stack trace), a copy button for bug reports, and a direct link to the Discord #bug-reports channel. Dismiss with X button or Esc key. Full-page errors are only shown for initial load failures when no content exists.',
        pr: 54,
        prTitle: 'feat: show errors as dismissible modal overlay',
        commits: [{ hash: 'a4a8525', message: 'feat: show errors as dismissible modal overlay instead of full page redirect' }],
      },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-01-20T08:00:00Z',
    title: 'BiS Support for Crafted and Base Tome Gear',
    highlights: ['BiS support for crafted and base tome gear', 'One-click fix for miscategorized slots'],
    items: [
      {
        category: 'feature',
        title: 'BiS source auto-detection and fix',
        description: 'Automatically detects and offers to fix miscategorized BiS sources for crafted and base tome gear',
        details:
          'When BiS is imported with crafted gear (e.g., Rinascita, Claro) or unaugmented tome gear (e.g., Bygone Brass), the system now detects if the BiS source is incorrectly set. A warning banner appears with "Update BiS Source" to fix all slots at once, or use individual fix buttons on each row. Fixes preserve your gear progress and item metadata.',
        pr: 52,
        prTitle: 'feat: add confirmation dialogs for BiS source changes',
        commits: [{ hash: '08f8bce', message: 'feat: add BiS source auto-detection for crafted and base tome gear' }],
      },
      {
        category: 'feature',
        title: 'BiS source change confirmation',
        description: 'Shows confirmation when changing BiS source on slots with imported item data',
        details:
          'When you change the BiS source (Raid/Tome/Crafted) on a slot that has imported item data, a confirmation dialog now appears showing a visual comparison of your current gear icon and name versus the new source. Full item tooltip available on hover. Helps prevent accidental loss of imported BiS configurations.',
        pr: 52,
        prTitle: 'feat: add confirmation dialogs for BiS source changes',
        commits: [{ hash: '8bcd8b4', message: 'feat: add confirmation dialogs for BiS source changes' }],
      },
      {
        category: 'improvement',
        title: 'Gear progress reset on source change',
        description: 'Changing BiS source now properly resets all gear progress and metadata',
        details:
          'When changing BiS source, hasItem, isAugmented, and all item metadata are now reset. Switching to Tome starts unchecked. This ensures accurate tracking when you change your BiS target.',
        pr: 52,
        prTitle: 'feat: add confirmation dialogs for BiS source changes',
        commits: [{ hash: '8bcd8b4', message: 'feat: add confirmation dialogs for BiS source changes' }],
      },
      {
        category: 'improvement',
        title: 'ConfirmModal header prop',
        description: 'ConfirmModal now supports custom header content above the warning box',
        pr: 52,
        prTitle: 'feat: add confirmation dialogs for BiS source changes',
        commits: [{ hash: '8bcd8b4', message: 'feat: add confirmation dialogs for BiS source changes' }],
      },
    ],
  },
  {
    version: '1.8.5',
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
    version: '1.8.4',
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
        pr: 50,
        prTitle: 'fix(discord): improve version change detection reliability',
        commits: [{ hash: 'fbe6b03', message: 'fix(discord): improve version change detection reliability' }],
      },
    ],
  },
  {
    version: '1.8.3',
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
        pr: 49,
        prTitle: 'fix(discord): post release-only embeds and use dominant category color',
        commits: [{ hash: '8f38e0d', message: 'fix(discord): post release-only embeds and use dominant category color' }],
      },
      {
        category: 'improvement',
        title: 'Dominant category embed colors',
        description: 'Discord embed borders reflect the most common change type',
        details:
          'The left border color on Discord release embeds now reflects the dominant category. A release with 8 fixes and 3 features shows red (fix color). Previously used priority order where any release with features always showed green.',
        pr: 49,
        prTitle: 'fix(discord): post release-only embeds and use dominant category color',
        commits: [{ hash: '8f38e0d', message: 'fix(discord): post release-only embeds and use dominant category color' }],
      },
    ],
  },
  {
    version: '1.8.2',
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
        pr: 48,
        prTitle: 'feat: UI consistency sprint - spinners, border radius, error patterns',
        commits: [{ hash: '7da0bd5', message: 'feat: UI consistency sprint - spinners, border radius, error patterns' }],
      },
      {
        category: 'improvement',
        title: 'Standardized Border Radius',
        description: 'Consistent rounded corners throughout the UI',
        details:
          'Eliminated mixed border radius values. Now uses a clear scale: rounded (4px) for tooltips, rounded-lg (8px) for cards/buttons/containers, rounded-xl (12px) for feature sections.',
        pr: 48,
        prTitle: 'feat: UI consistency sprint - spinners, border radius, error patterns',
        commits: [{ hash: '7da0bd5', message: 'feat: UI consistency sprint - spinners, border radius, error patterns' }],
      },
      {
        category: 'improvement',
        title: 'ErrorBox Component',
        description: 'Simple inline error display for modals and panels',
        details:
          'New ErrorBox component for contextual errors. Pattern: ErrorMessage (dismissible/retryable), ErrorBox (simple inline), InlineError (form validation), toast (transient).',
        pr: 48,
        prTitle: 'feat: UI consistency sprint - spinners, border radius, error patterns',
        commits: [{ hash: '7da0bd5', message: 'feat: UI consistency sprint - spinners, border radius, error patterns' }],
      },
      {
        category: 'fix',
        title: 'Dashboard Toggle Size',
        description: 'Grid/list toggle now matches adjacent button sizes',
        pr: 48,
        prTitle: 'feat: UI consistency sprint - spinners, border radius, error patterns',
        commits: [{ hash: '541ed19', message: 'fix: dashboard toggle size and user menu focus ring' }],
      },
    ],
  },
  {
    version: '1.8.1',
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
        pr: 38,
        prTitle: 'feat: security hardening sprint',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'improvement',
        title: 'OAuth State Hardening',
        description: 'Client fingerprint binding prevents session fixation',
        details:
          'OAuth state tokens are now bound to client fingerprints, preventing session fixation attacks where an attacker could trick a user into authenticating to the attacker\'s account.',
        pr: 38,
        prTitle: 'feat: security hardening sprint',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'improvement',
        title: 'SSRF Protection',
        description: 'Redirect rejection on all external API calls',
        details:
          'All external HTTP requests (BiS imports from XIVGear, Etro, etc.) now reject redirects to prevent server-side request forgery attacks that could access internal services.',
        pr: 33,
        prTitle: 'fix(security): Session 4 - CSP header and SSRF prevention',
        commits: [{ hash: '2262f5c', message: 'fix(security): Session 4 - CSP header and SSRF prevention (#33)' }],
      },
      {
        category: 'improvement',
        title: 'Request Size Limits',
        description: '10MB limit prevents DoS attacks',
        details:
          'All API requests are now limited to 10MB to prevent denial-of-service attacks through oversized payloads.',
        pr: 38,
        prTitle: 'feat: security hardening sprint',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'improvement',
        title: 'Request ID Tracking',
        description: 'UUID correlation for all requests',
        details:
          'Every API request now receives a unique request ID for correlation in logs. Makes debugging and security auditing much easier.',
        pr: 38,
        prTitle: 'feat: security hardening sprint',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'improvement',
        title: 'JWT Algorithm Restriction',
        description: 'Type-safe HS256/384/512 only',
        details:
          'JWT token verification is now restricted to HMAC algorithms only (HS256, HS384, HS512), preventing algorithm confusion attacks.',
        pr: 31,
        prTitle: 'fix: Phase 1 Critical Issues - Auth Hardening & Admin Performance',
        commits: [{ hash: '4db4624', message: 'fix: Phase 1 Critical Issues - Auth Hardening & Admin Performance (#31)' }],
      },
      {
        category: 'improvement',
        title: 'Security Event Logging',
        description: 'Permission denials and admin access logged',
        details:
          'Security-relevant events like permission denials and admin access are now logged for audit purposes.',
        pr: 38,
        prTitle: 'feat: security hardening sprint',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
      {
        category: 'fix',
        title: 'Database Constraints',
        description: 'CHECK constraints on week_number columns',
        details:
          'Added CHECK constraints to ensure week_number values are always positive integers, preventing invalid data from being stored.',
        pr: 38,
        prTitle: 'feat: security hardening sprint',
        commits: [{ hash: 'da40d4d', message: 'feat: security hardening sprint (#38)' }],
      },
    ],
  },
  {
    version: '1.8.0',
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
        pr: 27,
        prTitle: 'feat: Setup Wizard, PlayerSetupBanner, and UX improvements',
        commits: [{ hash: 'c746be3', message: 'fix: Select highlight styling and player reassignment state sync' }],
      },
      {
        category: 'fix',
        title: 'Player reassignment state sync',
        description: 'Fixed state synchronization when reassigning players',
        details:
          'When reassigning a player to a different user, the UI state now properly syncs to reflect the change immediately without requiring a refresh.',
        pr: 27,
        prTitle: 'feat: Setup Wizard, PlayerSetupBanner, and UX improvements',
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
        pr: 27,
        prTitle: 'feat: Setup Wizard, PlayerSetupBanner, and UX improvements',
        commits: [{ hash: '01e6d4d', message: 'fix: remove backdrop blur from Modal to prevent rendering artifacts' }],
      },
    ],
  },
  {
    version: '1.7.1',
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
        pr: 30,
        prTitle: 'fix: session expiry auth handling and UI improvements',
        commits: [{ hash: 'a611b64', message: 'fix: session expiry auth handling and UI improvements (#30)' }],
      },
      {
        category: 'improvement',
        title: 'Admin pages use standard API client',
        description: 'Admin Dashboard and View As now use the shared API wrapper',
        details:
          'Previously, admin pages used raw fetch() calls that bypassed automatic token refresh. Now they use the standard API client with automatic 401 handling, retry logic, and proper error types.',
        pr: 24,
        prTitle: 'fix: use api wrapper for automatic token refresh in admin pages',
        commits: [{ hash: 'e4080bb', message: 'fix: use api wrapper for automatic token refresh in admin pages (#24)' }],
      },
    ],
  },
  {
    version: '1.7.0',
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
        pr: 23,
        prTitle: 'v1.0.8: Admin Player Assignment & Modal Polish',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'feature',
        title: 'Role-colored player badges',
        description: 'Linked users show their membership role with colored badges',
        details:
          'Player cards now display the linked user\'s role with color-coded badges: Owner (teal), Lead (purple), Member (blue), and Linked-only (amber for users linked but not members). Makes it easy to see who has what permissions at a glance.',
        pr: 22,
        prTitle: 'feat(admin): navigation-based admin mode + player badge colors',
        commits: [{ hash: '94850ad', message: 'feat(admin): navigation-based admin mode + player badge colors (#22)' }],
      },
      {
        category: 'feature',
        title: 'Double-click confirm pattern',
        description: 'Dangerous actions require click-to-arm, click-to-confirm',
        details:
          'Destructive actions like revoking invitations or clearing history now use a double-click confirmation pattern. First click arms the button (shows "Confirm?"), second click executes. Auto-resets after 3 seconds or when you click away.',
        pr: 23,
        prTitle: 'v1.0.8: Admin Player Assignment & Modal Polish',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'improvement',
        title: 'Modal header icons',
        description: 'All modals now have contextual icons in their headers',
        details:
          'Modals display relevant icons next to their titles for better visual context. Danger modals show trash/reset icons in red/warning colors, action modals show contextual icons like package for loot or gem for materials.',
        pr: 23,
        prTitle: 'v1.0.8: Admin Player Assignment & Modal Polish',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'improvement',
        title: 'Job icons in recipient dropdowns',
        description: 'Loot recipient selectors show job icons',
        details:
          'When selecting a loot recipient, you now see job icons next to player names, making it easier to identify the correct player especially when multiple players have similar names.',
        pr: 23,
        prTitle: 'v1.0.8: Admin Player Assignment & Modal Polish',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'improvement',
        title: 'Static Settings polish',
        description: 'Tab icons and proper danger button styling',
        details:
          'The Static Settings modal now displays icons on each tab and uses proper danger button styling for destructive actions like deleting a static or leaving a group.',
        pr: 23,
        prTitle: 'v1.0.8: Admin Player Assignment & Modal Polish',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'fix',
        title: 'Race condition handling',
        description: 'Membership creation handles concurrent requests gracefully',
        details:
          'When two requests try to create the same membership simultaneously, the system now handles this gracefully by returning the existing membership instead of throwing an error. Prevents "already a member" errors during rapid operations.',
        pr: 23,
        prTitle: 'v1.0.8: Admin Player Assignment & Modal Polish',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'fix',
        title: 'Input validation for user IDs',
        description: 'Discord ID and UUID format validation in assignment modal',
        details:
          'The manual user ID input now validates the format before submission. Accepts Discord IDs (17-19 digit snowflakes) or UUIDs. Shows inline error message for invalid formats.',
        pr: 23,
        prTitle: 'v1.0.8: Admin Player Assignment & Modal Polish',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
      {
        category: 'improvement',
        title: 'Comprehensive test coverage',
        description: '23 new backend tests for player assignment',
        details:
          'Added comprehensive test coverage for the admin player assignment feature, including permission checks, edge cases, race conditions, and integration tests. Backend now has 160 tests total.',
        pr: 23,
        prTitle: 'v1.0.8: Admin Player Assignment & Modal Polish',
        commits: [{ hash: '69384d7', message: 'v1.0.8: Admin Player Assignment & Modal Polish (#23)' }],
      },
    ],
  },
  {
    version: '1.6.0',
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
        pr: 21,
        prTitle: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011)',
        commits: [{ hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' }],
      },
      {
        category: 'feature',
        title: 'useModal hook',
        description: 'Reusable modal state management',
        details:
          'New useModal and useModalWithData hooks eliminate boilerplate for modal open/close state. useModalWithData also handles passing data to the modal when opening it.',
        pr: 21,
        prTitle: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011)',
        commits: [{ hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' }],
      },
      {
        category: 'feature',
        title: 'useDebounce hook',
        description: 'Debounce utilities for values and callbacks',
        details:
          'New useDebounce hook for debouncing values (useful for search inputs) and useDebouncedCallback for debouncing function calls. Prevents excessive API calls and re-renders during rapid input.',
        pr: 21,
        prTitle: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011)',
        commits: [{ hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' }],
      },
      {
        category: 'feature',
        title: 'ErrorMessage component',
        description: 'Error display with retry button',
        details:
          'New ErrorMessage component displays errors consistently with an optional retry button. InlineError variant for compact inline display. Both support custom styling and messaging.',
        pr: 21,
        prTitle: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011)',
        commits: [{ hash: 'f66f59c', message: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011) (#21)' }],
      },
      {
        category: 'improvement',
        title: 'Button component variants',
        description: 'Added success and link button variants',
        details:
          'Button component now has 7 variants: primary, secondary, danger, warning, success, ghost, and link. All variants support loading states, disabled states, and icon placement.',
        pr: 21,
        prTitle: 'feat: Complete audit cleanup tasks (U-001, D-001, R-008, U-004, U-011)',
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
    version: '1.5.1',
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
        pr: 18,
        prTitle: 'security: migrate JWT tokens to httpOnly cookies',
        commits: [{ hash: 'c992e6e', message: 'security: migrate JWT tokens to httpOnly cookies (#18)' }],
      },
      {
        category: 'improvement',
        title: 'SameSite cookie protection',
        description: 'Cookies set with SameSite=Lax to prevent CSRF attacks',
        details:
          'All authentication cookies use SameSite=Lax attribute, preventing cross-site request forgery attacks. Cookies are only sent with same-site requests or top-level navigation.',
        pr: 18,
        prTitle: 'security: migrate JWT tokens to httpOnly cookies',
        commits: [{ hash: 'c992e6e', message: 'security: migrate JWT tokens to httpOnly cookies (#18)' }],
      },
      {
        category: 'improvement',
        title: 'Secure flag for production',
        description: 'Cookies only sent over HTTPS in production',
        details:
          'Authentication cookies in production are marked with the Secure flag, ensuring they are only transmitted over encrypted HTTPS connections.',
        pr: 18,
        prTitle: 'security: migrate JWT tokens to httpOnly cookies',
        commits: [{ hash: 'c992e6e', message: 'security: migrate JWT tokens to httpOnly cookies (#18)' }],
      },
      {
        category: 'improvement',
        title: 'Protected logout endpoint',
        description: 'Logout requires authentication to prevent CSRF logout attacks',
        details:
          'The logout endpoint now requires a valid access token. This prevents malicious sites from forcing users to logout via cross-site requests.',
        pr: 18,
        prTitle: 'security: migrate JWT tokens to httpOnly cookies',
        commits: [{ hash: 'da9e2d5', message: 'security: protect logout endpoint from CSRF by requiring authentication' }],
      },
      {
        category: 'fix',
        title: 'Token refresh on logout',
        description: 'Logout now works even with expired access tokens',
        details:
          'If your access token has expired when you click logout, the app now automatically refreshes it first to ensure cookies are properly cleared on the server.',
        pr: 18,
        prTitle: 'security: migrate JWT tokens to httpOnly cookies',
        commits: [{ hash: 'd57d175', message: 'fix: address cookie security issues in logout' }],
      },
      {
        category: 'fix',
        title: 'Auth state persistence',
        description: 'Fixed stale authentication state after cookie expiry',
        details:
          'The app no longer persists isAuthenticated to localStorage, preventing cases where the UI showed you as logged in after cookies expired. Auth state is now verified with the backend on app load.',
        pr: 18,
        prTitle: 'security: migrate JWT tokens to httpOnly cookies',
        commits: [{ hash: 'c992e6e', message: 'security: migrate JWT tokens to httpOnly cookies (#18)' }],
      },
    ],
  },
  {
    version: '1.5.0',
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
        pr: 22,
        prTitle: 'feat(admin): navigation-based admin mode + player badge colors',
        commits: [{ hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' }],
      },
      {
        category: 'feature',
        title: 'Shortcut hints in settings menu',
        description: 'Keyboard shortcuts shown in the gear icon dropdown menu',
        details:
          'The settings gear menu now displays keyboard shortcuts next to each action (Add Player, New Tier, etc.). Makes shortcuts more discoverable without opening the help modal.',
        pr: 22,
        prTitle: 'feat(admin): navigation-based admin mode + player badge colors',
        commits: [{ hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' }],
      },
      {
        category: 'improvement',
        title: 'Readable shortcut notation',
        description: 'Shortcuts shown as Ctrl+S instead of symbols like ⌃S',
        details:
          'All keyboard shortcuts throughout the app now use word notation (Ctrl+, Alt+, Shift+) instead of Mac-style symbols. More readable for all users regardless of platform.',
        pr: 22,
        prTitle: 'feat(admin): navigation-based admin mode + player badge colors',
        commits: [{ hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' }],
      },
      {
        category: 'feature',
        title: 'Tips carousel in header',
        description: 'Rotating tips and tricks shown in the header bar',
        details:
          'A subtle tips carousel in the header shows helpful hints that cycle every 15 seconds. Tips are context-aware based on your current tab. Click to cycle faster, or dismiss permanently.',
        pr: 22,
        prTitle: 'feat(admin): navigation-based admin mode + player badge colors',
        commits: [{ hash: 'c908dca', message: 'feat: Overhaul keyboard shortcuts system' }],
      },
      {
        category: 'fix',
        title: 'V key works on Weapon Priorities',
        description: 'Expand/collapse all now works on the Loot tab weapon priorities',
        details:
          'Pressing V on the Loot tab now properly toggles expand/collapse on the Weapon Priorities view. Previously only worked on Players and Log tabs.',
        pr: 22,
        prTitle: 'feat(admin): navigation-based admin mode + player badge colors',
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
    version: '1.4.0',
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
        pr: 15,
        prTitle: 'Design System V2 Migration - Complete Semantic Token Implementation',
        commits: [{ hash: 'c32f6b7', message: 'Design System V2 Migration - Complete Semantic Token Implementation (#15)' }],
      },
      {
        category: 'feature',
        title: 'Enhanced keyboard shortcuts',
        description: 'New shortcuts for logging and navigation',
        details:
          'Alt+L opens Log Loot modal, Alt+M opens Log Material modal, Alt+B opens Mark Floor Cleared. Shift+S navigates to My Statics. Shift+? shows keyboard shortcuts help. All shortcuts shown in menus and tooltips.',
        pr: 16,
        prTitle: 'refactor(GroupView): extract hooks and components for better maintainability',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'feature',
        title: 'Shift+Click to copy links',
        description: 'Quick link copying from player cards and loot entries',
        details:
          'Shift+Click on player cards or loot entries in the grid view to instantly copy a shareable link. Faster than right-click > Copy URL for power users.',
        pr: 16,
        prTitle: 'refactor(GroupView): extract hooks and components for better maintainability',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'feature',
        title: 'Keyboard Shortcuts in User menu',
        description: 'Quick access to shortcuts help from user dropdown',
        details:
          'New "Keyboard Shortcuts" item in the user dropdown menu with "?" hotkey hint. Opens the same help modal as pressing Shift+?.',
        pr: 16,
        prTitle: 'refactor(GroupView): extract hooks and components for better maintainability',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'improvement',
        title: 'Hotkey hints in UI',
        description: 'Keyboard shortcuts shown in tooltips and menus',
        details:
          'Action buttons (Log Loot, Log Material, Mark Floor Cleared) now show their hotkey in tooltips. My Statics menu item shows Shift+S hint. Improved discoverability for power users.',
        pr: 16,
        prTitle: 'refactor(GroupView): extract hooks and components for better maintainability',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'improvement',
        title: 'GearTable UI improvements',
        description: 'Cleaner gear table with better visual hierarchy',
        details:
          'Removed cramped Item name column for better small-screen support. CurrentSource column hidden by default (available in code for future use). BiS source toggle converted to compact button.',
        pr: 15,
        prTitle: 'Design System V2 Migration - Complete Semantic Token Implementation',
        commits: [{ hash: 'c32f6b7', message: 'Design System V2 Migration - Complete Semantic Token Implementation (#15)' }],
      },
      {
        category: 'improvement',
        title: 'BiS Import modal enhancements',
        description: 'Job and gear icons in import modal',
        details:
          'BiS Import modal now shows job icons in preset list and gear slot icons when previewing imported sets. Easier to verify you\'re importing the right configuration.',
        pr: 15,
        prTitle: 'Design System V2 Migration - Complete Semantic Token Implementation',
        commits: [{ hash: 'c32f6b7', message: 'Design System V2 Migration - Complete Semantic Token Implementation (#15)' }],
      },
      {
        category: 'fix',
        title: 'Week switching visual bug',
        description: 'Loot entries now appear immediately when navigating across weeks',
        details:
          'Fixed bug where loot entries wouldn\'t appear after jumping to a different week via player card navigation. Required refresh or manual week toggle before. Now updates instantly.',
        pr: 16,
        prTitle: 'refactor(GroupView): extract hooks and components for better maintainability',
        commits: [{ hash: 'fd5ea3e', message: 'refactor(GroupView): extract hooks and components for better maintainability (#16)' }],
      },
      {
        category: 'fix',
        title: 'Job change confirmation',
        description: 'Proper confirmation when changing player job',
        details:
          'Changing a player\'s job now shows a confirmation dialog warning about gear reset. Player card highlights briefly after job change to confirm the update.',
        pr: 15,
        prTitle: 'Design System V2 Migration - Complete Semantic Token Implementation',
        commits: [{ hash: 'c32f6b7', message: 'Design System V2 Migration - Complete Semantic Token Implementation (#15)' }],
      },
    ],
  },
  {
    version: '1.3.0',
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
        pr: 14,
        prTitle: 'Update status documentation to reflect completed items',
        commits: [{ hash: '8e949e5', message: 'Add keyboard shortcuts for common actions' }],
      },
      {
        category: 'improvement',
        title: 'Updated documentation',
        description: 'Comprehensive status document updates and user guides',
        details:
          'Updated CONSOLIDATED_STATUS.md to reflect completed items from previous releases. Added keyboard shortcuts documentation to Member Guide and developer docs.',
        pr: 14,
        prTitle: 'Update status documentation to reflect completed items',
        commits: [{ hash: '6795b62', message: 'Update status docs: mark completed items from previous PRs' }],
      },
    ],
  },
  {
    version: '1.2.0',
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
        pr: 10,
        prTitle: 'UX Improvements Phase 1 & 2',
        commits: [{ hash: '1944057', message: 'Implement four UX improvements' }],
      },
      {
        category: 'feature',
        title: 'Smart tab navigation',
        description: 'Automatic tab selection when switching statics',
        details:
          'When switching to a static with no players, automatically shows the Players tab. When switching to a static with players, preserves your current tab selection. Prevents confusion when navigating between statics.',
        pr: 10,
        prTitle: 'UX Improvements Phase 1 & 2',
        commits: [{ hash: '1944057', message: 'Implement four UX improvements' }],
      },
      {
        category: 'feature',
        title: 'Dashboard context menus',
        description: 'Right-click static cards for quick actions',
        details:
          'Static group cards on the Dashboard now have context menus with quick access to Open, Rename, Copy Share Code, and Delete (for owners). Streamlines common management tasks.',
        pr: 10,
        prTitle: 'UX Improvements Phase 1 & 2',
        commits: [{ hash: '1944057', message: 'Implement four UX improvements' }],
      },
      {
        category: 'feature',
        title: 'Release Notes navigation',
        description: 'Collapsible version sections with scroll-synced nav',
        details:
          'Release Notes page redesigned with collapsible version sections and a sticky navigation panel. Click version numbers to jump to that release. Auto-expands sections when scrolling or navigating via URL hash.',
        pr: 10,
        prTitle: 'UX Improvements Phase 1 & 2',
        commits: [{ hash: '1944057', message: 'Implement four UX improvements' }],
      },
      {
        category: 'improvement',
        title: 'Subs toggle styling',
        description: 'Substitute players toggle matches G1/G2 style',
        details:
          'The Subs toggle button now has the same icon and accent color style as G1/G2 toggles. Works independently from group view toggles - you can show subs without enabling G1/G2 split.',
        pr: 10,
        prTitle: 'UX Improvements Phase 1 & 2',
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
        pr: 10,
        prTitle: 'UX Improvements Phase 1 & 2',
        commits: [{ hash: 'd565ee9', message: 'Address PR feedback: canEdit check, aria-pressed, status updates' }],
      },
      {
        category: 'fix',
        title: 'Loot edit gear sync',
        description: 'Editing loot recipient now updates both player cards',
        details:
          'When editing a loot entry and changing the recipient, the old recipient\'s gear checkbox is now properly unchecked and the new recipient\'s is checked. Previously only worked for new entries.',
        pr: 10,
        prTitle: 'UX Improvements Phase 1 & 2',
        commits: [{ hash: '15a7d36', message: 'Fix UX issues from manual testing' }],
      },
      {
        category: 'fix',
        title: 'Grid URL highlight',
        description: 'Deep links to loot entries now highlight in grid view',
        details:
          'URLs with ?entry=123 parameter now properly highlight the corresponding cell in grid view with a pulse animation. Previously only worked in list view.',
        pr: 10,
        prTitle: 'UX Improvements Phase 1 & 2',
        commits: [{ hash: '15a7d36', message: 'Fix UX issues from manual testing' }],
      },
      {
        category: 'fix',
        title: 'Layout shift fixes',
        description: 'Prevented UI jumping when switching views',
        details:
          'Fixed layout shift when switching between By Floor and Timeline views in Log tab. Floor filter now uses invisible class instead of conditional rendering.',
        pr: 10,
        prTitle: 'UX Improvements Phase 1 & 2',
        commits: [{ hash: '15a7d36', message: 'Fix UX issues from manual testing' }],
      },
      {
        category: 'feature',
        title: 'Material log editing',
        description: 'Edit existing material entries from Log tab',
        details:
          'Click existing material cells in grid view or use context menu in list view to edit material log entries. Supports changing recipient, week, and notes.',
        pr: 13,
        prTitle: 'Fix admin system bugs: banner display, permissions, sorting',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'feature',
        title: 'Substitute player filtering',
        description: 'Subs excluded from priority calculations by default',
        details:
          'Substitute players are now excluded from Loot Priority tab, Summary tab, and Mark Floor Cleared modal. Loot logging modals have an "Include Subs" checkbox to optionally include substitutes in recipient lists.',
        pr: 13,
        prTitle: 'Fix admin system bugs: banner display, permissions, sorting',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'fix',
        title: 'Admin banner display',
        description: 'Fixed admin access banner not appearing',
        details:
          'Admin users now correctly see the amber "Admin Access" banner when viewing statics they don\'t belong to. The isAdminAccess flag is now properly returned from all API endpoints.',
        pr: 13,
        prTitle: 'Fix admin system bugs: banner display, permissions, sorting',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'fix',
        title: 'Admin dashboard sorting',
        description: 'Fixed sorting by member count, tier count, and owner',
        details:
          'Sorting in Admin Dashboard now works correctly for computed columns (member count, tier count) and owner information using optimized subqueries.',
        pr: 13,
        prTitle: 'Fix admin system bugs: banner display, permissions, sorting',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'fix',
        title: 'iLv calculation accuracy',
        description: 'Fixed inflated averages for unconfigured gear',
        details:
          'Players with few gear slots configured no longer show inflated iLv. Unknown/unconfigured slots now use crafted gear baseline (770) instead of being excluded from the average.',
        pr: 13,
        prTitle: 'Fix admin system bugs: banner display, permissions, sorting',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
      {
        category: 'fix',
        title: 'Mark Floor Cleared state reset',
        description: 'Modal now resets properly when reopened',
        details:
          'Fixed bug where Mark Floor Cleared modal retained previous selections. Modal state now properly resets when opened.',
        pr: 13,
        prTitle: 'Fix admin system bugs: banner display, permissions, sorting',
        commits: [{ hash: '7804947', message: 'Fix admin system bugs: banner display, permissions, sorting' }],
      },
    ],
  },
  {
    version: '1.1.0',
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
        pr: 8,
        prTitle: 'Fix three major issues: auth persistence, universal tomestone, weapon priority',
        commits: [{ hash: 'c9f1672', message: 'Add comprehensive documentation system' }],
      },
      {
        category: 'feature',
        title: 'Roadmap & Status page',
        description: 'Development plan and current state visibility',
        details:
          'New page showing completed phases, planned features, and known issues. Helps users understand what features exist and what\'s coming next.',
        link: { href: '/docs/roadmap', label: 'View Roadmap' },
        pr: 8,
        prTitle: 'Fix three major issues: auth persistence, universal tomestone, weapon priority',
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
        pr: 8,
        prTitle: 'Fix three major issues: auth persistence, universal tomestone, weapon priority',
        commits: [{ hash: 'deb7919', message: 'Add extended deep linking and Copy URL features' }],
      },
      {
        category: 'improvement',
        title: 'Auto-expand weapon priority on ties',
        description: 'Weapon priority section now auto-expands when there are rolling ties',
        details:
          'When multiple players are tied for weapon priority, the weapon priority section automatically expands to show the tie-breaker information.',
        image: '/images/release-notes/weapon-priorities.gif',
        pr: 8,
        prTitle: 'Fix three major issues: auth persistence, universal tomestone, weapon priority',
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
        pr: 8,
        prTitle: 'Fix three major issues: auth persistence, universal tomestone, weapon priority',
        commits: [{ hash: '7a43c87', message: 'Fix TypeScript errors for Universal Tomestone integration' }],
      },
      {
        category: 'fix',
        title: 'Auth persistence improvements',
        description: 'Better handling of login state across sessions',
        details:
          'Fixed issues where users would be logged out unexpectedly. Improved token refresh handling and session persistence.',
        pr: 8,
        prTitle: 'Fix three major issues: auth persistence, universal tomestone, weapon priority',
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
        pr: 5,
        prTitle: 'Parity Implementation: Gear Categories, iLv Tracking, and Adjustments',
        commits: [{ hash: 'ec257d0', message: 'Parity Implementation: Gear Categories, iLv Tracking, and Adjustments' }],
      },
      {
        category: 'feature',
        title: 'Item level tracking',
        description: 'Average iLv calculated and displayed per player',
        details:
          'Each player card now shows their average item level based on currently equipped gear. Calculated from gear source categories and tier configuration.',
        pr: 5,
        prTitle: 'Parity Implementation: Gear Categories, iLv Tracking, and Adjustments',
        commits: [{ hash: '50d00d1', message: 'Parity Phases 2-4: Frontend types, iLv tracking, adjustments' }],
      },
      {
        category: 'feature',
        title: 'Mid-tier roster adjustments',
        description: 'Loot and page adjustments for players joining mid-tier',
        details:
          'New adjustment fields allow fair priority calculations for players who join after the tier has started. Positive adjustments count extra drops, negative ignore drops.',
        pr: 5,
        prTitle: 'Parity Implementation: Gear Categories, iLv Tracking, and Adjustments',
        commits: [{ hash: 'f332a5c', message: 'Add parity adjustment fields' }],
      },
      {
        category: 'fix',
        title: 'BiS import currentSource inference',
        description: 'Fixed gear source detection when importing BiS sets',
        pr: 5,
        prTitle: 'Parity Implementation: Gear Categories, iLv Tracking, and Adjustments',
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
        pr: 4,
        prTitle: 'Loot Tracking System Redesign (Phases 2-5)',
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
        pr: 4,
        prTitle: 'Loot Tracking System Redesign (Phases 2-5)',
        commits: [{ hash: '9ca9095', message: 'Summary Tab Redesign' }],
      },
      {
        category: 'improvement',
        title: 'Sectioned log layout',
        description: 'Log tab reorganized with Week/All Time toggle',
        pr: 4,
        prTitle: 'Loot Tracking System Redesign (Phases 2-5)',
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
 * Get the latest (most recent) *public* release.
 * Skips `internal` (dev-only) entries so the banner and any "latest release"
 * UI never surface a Discord-only note.
 */
export function getLatestRelease(releases: Release[] = RELEASES): Release | undefined {
  return releases.find((r) => !r.internal);
}

/**
 * Check if the current version is newer than the last-seen version
 */
export function isNewerVersion(current: string, lastSeen: string | null): boolean {
  if (!lastSeen) return true;
  return current !== lastSeen;
}
