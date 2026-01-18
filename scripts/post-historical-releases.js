/**
 * Post Historical Release Announcements to Discord
 *
 * Utility script to post release embeds for historical versions that
 * were released before the Discord changelog integration was added.
 *
 * Usage:
 *   node post-historical-releases.js --releases 0.1.0,0.2.0,0.3.0
 *   node post-historical-releases.js --releases 0.1.0 --dry-run
 *
 * Environment variables:
 *   DISCORD_BOT_TOKEN - Discord bot token
 *   DISCORD_CHANGELOG_CHANNEL_ID - Channel ID to post to
 */

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const RELEASE_NOTES_PATH = join(__dirname, '../frontend/src/data/releaseNotes.ts');
const RELEASE_NOTES_URL = 'https://www.xivraidplanner.app/docs/release-notes';

// Author info (hardcoded per CLAUDE.md)
const COMMIT_AUTHOR = 'Aaron Carlisle';
const COMMIT_AUTHOR_GITHUB = 'aaronbcarlisle';

// Category labels for display (same as discord-changelog.js)
const CATEGORY_LABELS = {
  feature: 'New Features',
  improvement: 'Improvements',
  fix: 'Bug Fixes',
  breaking: 'Breaking Changes',
};

// Category order for display
const CATEGORY_ORDER = ['feature', 'improvement', 'fix', 'breaking'];

// Category emoji colors (matching the release notes page badges)
const CATEGORY_EMOJIS = {
  feature: '🟢',
  improvement: '🔵',
  fix: '🔴',
  breaking: '🟠',
};

// Category colors for embed borders (hex values for Discord)
const CATEGORY_COLORS = {
  feature: 0x10b981,   // Green
  improvement: 0x3b82f6, // Blue
  fix: 0xef4444,       // Red
  breaking: 0xf59e0b,  // Orange
};

/**
 * Parse release items from a release block
 * Extracts category, title, and description from each item
 */
function parseReleaseItems(itemsContent) {
  const items = [];

  // Match each item object - look for category, title, and optional description
  const itemPattern = /\{\s*category:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"](?:,\s*description:\s*['"]([^'"]*?)['"])?/g;
  let match;
  while ((match = itemPattern.exec(itemsContent)) !== null) {
    items.push({
      category: match[1],
      title: match[2],
      description: match[3] || null,
    });
  }

  return items;
}

/**
 * Extract nested array content by counting brackets
 */
function extractArrayContent(content, startIndex) {
  let depth = 0;
  let start = -1;

  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '[') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        return content.substring(start, i);
      }
    }
  }
  return '';
}

/**
 * Parse all releases from releaseNotes.ts
 */
function parseAllReleases() {
  const content = readFileSync(RELEASE_NOTES_PATH, 'utf-8');

  // Extract the RELEASES array content
  const releasesMatch = content.match(/export const RELEASES:\s*Release\[\]\s*=\s*\[([\s\S]*?)^\];/m);
  if (!releasesMatch) {
    throw new Error('Could not parse RELEASES array from releaseNotes.ts');
  }

  const releasesContent = releasesMatch[1];
  const releases = [];

  // Match release headers to find version, date, title, then parse items separately
  const releaseHeaderPattern = /\{\s*version:\s*['"]([^'"]+)['"],\s*date:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]*?)['"]?,?\s*highlights:\s*\[([\s\S]*?)\],\s*items:\s*\[/g;

  let match;
  while ((match = releaseHeaderPattern.exec(releasesContent)) !== null) {
    const version = match[1];
    const date = match[2];
    const title = match[3] || '';

    // Parse highlights array
    const highlightsStr = match[4];
    const highlights = [];
    const highlightMatches = highlightsStr.matchAll(/['"]([^'"]+)['"]/g);
    for (const hm of highlightMatches) {
      highlights.push(hm[1]);
    }

    // Extract the items array content by counting brackets
    // match.index + match[0].length points to right after "items: ["
    const itemsStartIndex = match.index + match[0].length - 1; // -1 to include the opening [
    const itemsStr = extractArrayContent(releasesContent, itemsStartIndex);
    const items = parseReleaseItems(itemsStr);

    releases.push({ version, date, title, highlights, items });
  }

  return releases;
}

// Discord embed description limit (actual limit is 4096, but we use a reasonable max)
const RELEASE_DESCRIPTION_LIMIT = 3500;

/**
 * Format a single item for Discord display (plain bullet, no colored emoji)
 */
function formatReleaseItem(item) {
  if (item.description) {
    return `• **${item.title}** — ${item.description}`;
  }
  return `• **${item.title}**`;
}

/**
 * Build release announcement embed - single embed with all categories
 * Colored emoji circles are placed next to section headers, not items
 * Returns an array with a single embed for consistency with API
 */
function buildReleaseEmbeds(release) {
  const versionAnchor = `${RELEASE_NOTES_URL}#v${release.version}`;

  const embed = new EmbedBuilder()
    .setColor(0x14b8a6) // Teal accent color
    .setTitle(`v${release.version} — ${release.title}`)
    .setURL(versionAnchor)
    .setAuthor({
      name: COMMIT_AUTHOR,
      url: `https://github.com/${COMMIT_AUTHOR_GITHUB}`,
      iconURL: `https://github.com/${COMMIT_AUTHOR_GITHUB}.png`,
    })
    .setTimestamp(new Date(release.date)); // Use the actual release date

  // If we have items, build a single description with all categories
  if (release.items && release.items.length > 0) {
    // Group items by category
    const groupedItems = {};
    for (const item of release.items) {
      if (!groupedItems[item.category]) {
        groupedItems[item.category] = [];
      }
      groupedItems[item.category].push(item);
    }

    // Build description with sections
    const sections = [];
    for (const category of CATEGORY_ORDER) {
      const items = groupedItems[category];
      if (items && items.length > 0) {
        const label = CATEGORY_LABELS[category] || category;
        const emoji = CATEGORY_EMOJIS[category] || '⚪';

        // Section header with colored emoji (H2 in Discord markdown)
        let section = `${emoji} ## ${label}\n`;

        // Add items (plain bullets, no colored emoji)
        section += items.map(item => {
          if (item.description) {
            return `• **${item.title}** — ${item.description}`;
          }
          return `• **${item.title}**`;
        }).join('\n');

        sections.push(section);
      }
    }

    let description = sections.join('\n\n');

    // Truncate if too long
    if (description.length > RELEASE_DESCRIPTION_LIMIT) {
      // Try without descriptions
      const shortSections = [];
      for (const category of CATEGORY_ORDER) {
        const items = groupedItems[category];
        if (items && items.length > 0) {
          const label = CATEGORY_LABELS[category] || category;
          const emoji = CATEGORY_EMOJIS[category] || '⚪';

          let section = `${emoji} ## ${label}\n`;
          section += items.map(item => `• **${item.title}**`).join('\n');
          shortSections.push(section);
        }
      }
      description = shortSections.join('\n\n');

      // If still too long, truncate with ellipsis
      if (description.length > RELEASE_DESCRIPTION_LIMIT) {
        description = description.substring(0, RELEASE_DESCRIPTION_LIMIT - 3) + '...';
      }
    }

    embed.setDescription(description);
  } else if (release.highlights && release.highlights.length > 0) {
    // Fall back to highlights-only format
    const description = release.highlights.map(h => `• ${h}`).join('\n');
    embed.setDescription(description);
  }

  return [embed];
}

/**
 * Preview embeds (for dry-run mode)
 */
function previewEmbeds(release, embeds) {
  console.log('\n' + '═'.repeat(60));
  console.log(`RELEASE: v${release.version} (${embeds.length} embeds)`);
  console.log('═'.repeat(60));

  for (let i = 0; i < embeds.length; i++) {
    const data = embeds[i].toJSON();
    if (i > 0) console.log('─'.repeat(60));
    console.log(`\n[Embed ${i + 1}]`);
    if (data.author) {
      console.log(`Author: ${data.author.name}`);
    }
    console.log(`Title: ${data.title}`);
    if (data.url) console.log(`URL: ${data.url}`);
    console.log(`Color: #${data.color.toString(16).padStart(6, '0')}`);
    if (data.timestamp) {
      console.log(`Timestamp: ${new Date(data.timestamp).toISOString()}`);
    }
    if (data.description) {
      console.log('Description:');
      console.log(data.description);
    }
  }
  console.log('\n' + '═'.repeat(60));
}

/**
 * Main function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const releasesArg = args.find(a => a.startsWith('--releases=')) || args[args.indexOf('--releases') + 1];
  const dryRun = args.includes('--dry-run');

  if (!releasesArg || releasesArg.startsWith('--')) {
    console.error('Usage: node post-historical-releases.js --releases 0.1.0,0.2.0,0.3.0 [--dry-run]');
    console.error('\nOptions:');
    console.error('  --releases  Comma-separated list of version numbers to post');
    console.error('  --dry-run   Preview embeds without posting to Discord');
    process.exit(1);
  }

  const requestedVersions = releasesArg.replace('--releases=', '').split(',').map(v => v.trim());

  // Validate environment variables (unless dry run)
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANGELOG_CHANNEL_ID;

  if (!dryRun) {
    if (!token) {
      console.error('DISCORD_BOT_TOKEN is required (or use --dry-run)');
      process.exit(1);
    }
    if (!channelId) {
      console.error('DISCORD_CHANGELOG_CHANNEL_ID is required (or use --dry-run)');
      process.exit(1);
    }
  }

  // Parse releases from file
  console.log('Parsing release notes...');
  const allReleases = parseAllReleases();
  console.log(`Found ${allReleases.length} releases`);

  // Find requested releases
  const releasesToPost = [];
  for (const version of requestedVersions) {
    const release = allReleases.find(r => r.version === version);
    if (!release) {
      console.error(`Release v${version} not found in releaseNotes.ts`);
      console.error('Available versions:', allReleases.map(r => r.version).join(', '));
      process.exit(1);
    }
    releasesToPost.push(release);
  }

  // Sort by version (oldest first for chronological posting)
  releasesToPost.sort((a, b) => {
    const aParts = a.version.split('.').map(Number);
    const bParts = b.version.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
    }
    return 0;
  });

  console.log(`\nWill post ${releasesToPost.length} releases (oldest first):`);
  releasesToPost.forEach(r => console.log(`  - v${r.version}: ${r.title}`));

  if (dryRun) {
    console.log('\n[DRY RUN MODE - Not posting to Discord]');
    for (const release of releasesToPost) {
      const embeds = buildReleaseEmbeds(release);
      previewEmbeds(release, embeds);
    }
    console.log('\nDry run complete. Run without --dry-run to post to Discord.');
    return;
  }

  // Create Discord client and post
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    console.log('\nLogging in to Discord...');
    await client.login(token);

    console.log('Fetching channel...');
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      console.error(`Channel ${channelId} not found or not a text channel`);
      process.exit(1);
    }

    // Post each release with a small delay between them
    for (let i = 0; i < releasesToPost.length; i++) {
      const release = releasesToPost[i];
      const embeds = buildReleaseEmbeds(release);

      console.log(`\nPosting v${release.version} (${embeds.length} embeds)...`);
      await channel.send({ embeds });
      console.log(`  ✓ Posted v${release.version}: ${release.title}`);

      // Small delay between posts to avoid rate limiting
      if (i < releasesToPost.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n✓ All releases posted successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    client.destroy();
  }
}

main();
