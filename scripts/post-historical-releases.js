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
 * Format a single item for Discord display
 * Mirrors the release notes page format: "• **Title** — Description"
 */
function formatReleaseItem(item) {
  if (item.description) {
    return `• **${item.title}** — ${item.description}`;
  }
  return `• **${item.title}**`;
}

/**
 * Build a release embed mirroring the release notes page (same as discord-changelog.js)
 */
function buildReleaseEmbed(release) {
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

  // If we have items, group them by category and build a rich description
  if (release.items && release.items.length > 0) {
    // Group items by category
    const groupedItems = {};
    for (const item of release.items) {
      if (!groupedItems[item.category]) {
        groupedItems[item.category] = [];
      }
      groupedItems[item.category].push(item);
    }

    // Build description with categories - mirroring release notes page format
    const sections = [];
    for (const category of CATEGORY_ORDER) {
      const items = groupedItems[category];
      if (items && items.length > 0) {
        const label = CATEGORY_LABELS[category] || category;
        const itemList = items.map(formatReleaseItem).join('\n');
        sections.push(`**${label}** (${items.length})\n${itemList}`);
      }
    }

    let description = sections.join('\n\n');

    // Add "view in browser" link at the end
    const linkText = `\n\n[[view in browser]](${versionAnchor})`;

    // Check if we exceed the limit
    if ((description + linkText).length > RELEASE_DESCRIPTION_LIMIT) {
      // Truncate by removing descriptions, keeping just titles
      const truncatedSections = [];
      for (const category of CATEGORY_ORDER) {
        const items = groupedItems[category];
        if (items && items.length > 0) {
          const label = CATEGORY_LABELS[category] || category;
          const itemList = items.map(i => `• **${i.title}**`).join('\n');
          truncatedSections.push(`**${label}** (${items.length})\n${itemList}`);
        }
      }

      description = truncatedSections.join('\n\n');

      // If still too long, limit items per category
      if ((description + linkText).length > RELEASE_DESCRIPTION_LIMIT) {
        const limitedSections = [];
        const maxItemsPerCategory = 5;

        for (const category of CATEGORY_ORDER) {
          const items = groupedItems[category];
          if (items && items.length > 0) {
            const label = CATEGORY_LABELS[category] || category;
            const displayItems = items.slice(0, maxItemsPerCategory);
            let itemList = displayItems.map(i => `• **${i.title}**`).join('\n');
            if (items.length > maxItemsPerCategory) {
              itemList += `\n  *...and ${items.length - maxItemsPerCategory} more*`;
            }
            limitedSections.push(`**${label}** (${items.length})\n${itemList}`);
          }
        }

        description = limitedSections.join('\n\n');
      }
    }

    embed.setDescription(description + linkText);
  } else if (release.highlights && release.highlights.length > 0) {
    // Fall back to highlights-only format
    let description = release.highlights.map(h => `• ${h}`).join('\n');
    description += `\n\n[[view in browser]](${versionAnchor})`;
    embed.setDescription(description);
  } else {
    embed.setDescription(`[[view in browser]](${versionAnchor})`);
  }

  return embed;
}

/**
 * Preview an embed (for dry-run mode)
 */
function previewEmbed(release, embed) {
  const data = embed.toJSON();
  console.log('\n' + '═'.repeat(60));
  console.log(`RELEASE: v${release.version}`);
  console.log('═'.repeat(60));
  if (data.author) {
    console.log(`Author: ${data.author.name} (${data.author.url})`);
  }
  console.log(`Title: ${data.title}`);
  console.log(`URL: ${data.url}`);
  console.log(`Color: #${data.color.toString(16).padStart(6, '0')}`);
  console.log(`Timestamp: ${new Date(data.timestamp).toISOString()}`);
  console.log('─'.repeat(60));
  console.log('Description:');
  console.log(data.description);
  console.log('═'.repeat(60));
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
      const embed = buildReleaseEmbed(release);
      previewEmbed(release, embed);
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
      const embed = buildReleaseEmbed(release);

      console.log(`\nPosting v${release.version}...`);
      await channel.send({ embeds: [embed] });
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
