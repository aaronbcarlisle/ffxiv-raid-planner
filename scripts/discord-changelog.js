/**
 * Discord Changelog Notification Script
 *
 * Posts changelog updates to Discord when PRs are merged to main.
 * - Posts release announcements when a new version is detected
 * - Posts commit info for all merges
 *
 * Environment variables:
 * - DISCORD_BOT_TOKEN: Discord bot token
 * - DISCORD_CHANGELOG_CHANNEL_ID: Channel ID to post to
 * - COMMIT_SHA: The commit hash
 * - COMMIT_MESSAGE: The commit message
 * - COMMIT_AUTHOR: The commit author name
 * - GITHUB_REPOSITORY: The repository (e.g., "user/repo")
 */

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const RELEASE_NOTES_PATH = join(__dirname, '../frontend/src/data/releaseNotes.ts');
const RELEASE_NOTES_URL = 'https://www.xivraidplanner.app/docs/release-notes';

/**
 * Parse releaseNotes.ts to extract version and release info
 */
function parseReleaseNotes() {
  if (!existsSync(RELEASE_NOTES_PATH)) {
    console.error(`Release notes file not found: ${RELEASE_NOTES_PATH}`);
    return null;
  }

  const content = readFileSync(RELEASE_NOTES_PATH, 'utf-8');

  // Extract CURRENT_VERSION
  const versionMatch = content.match(/export const CURRENT_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!versionMatch) {
    console.error('Could not parse CURRENT_VERSION from releaseNotes.ts');
    return null;
  }
  const currentVersion = versionMatch[1];

  // Extract the first release object (latest release)
  // Match the first object in the RELEASES array
  const releasesMatch = content.match(/export const RELEASES:\s*Release\[\]\s*=\s*\[([\s\S]*?)^\];/m);
  if (!releasesMatch) {
    console.error('Could not parse RELEASES array from releaseNotes.ts');
    return { currentVersion, latestRelease: null };
  }

  // Find the first release object
  const releasesContent = releasesMatch[1];
  const firstReleaseMatch = releasesContent.match(/\{\s*version:\s*['"]([^'"]+)['"],\s*date:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)?['"]?,?\s*highlights:\s*\[([\s\S]*?)\]/);

  if (!firstReleaseMatch) {
    console.error('Could not parse first release object');
    return { currentVersion, latestRelease: null };
  }

  const version = firstReleaseMatch[1];
  const date = firstReleaseMatch[2];
  const title = firstReleaseMatch[3] || '';

  // Parse highlights array
  const highlightsStr = firstReleaseMatch[4];
  const highlights = [];
  const highlightMatches = highlightsStr.matchAll(/['"]([^'"]+)['"]/g);
  for (const match of highlightMatches) {
    highlights.push(match[1]);
  }

  return {
    currentVersion,
    latestRelease: {
      version,
      date,
      title,
      highlights,
    },
  };
}

/**
 * Check if the version changed in this commit
 */
function didVersionChange() {
  try {
    // Check if releaseNotes.ts was modified in this commit
    const diffOutput = execSync(
      'git diff HEAD~1 --name-only -- frontend/src/data/releaseNotes.ts',
      { encoding: 'utf-8' }
    ).trim();

    if (!diffOutput) {
      return false;
    }

    // Check if CURRENT_VERSION specifically changed
    const versionDiff = execSync(
      'git diff HEAD~1 -- frontend/src/data/releaseNotes.ts | grep -E "^[+-]export const CURRENT_VERSION"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    // If we see both a - and + line for CURRENT_VERSION, it changed
    return versionDiff.includes('-export const CURRENT_VERSION') &&
           versionDiff.includes('+export const CURRENT_VERSION');
  } catch (error) {
    // grep returns exit code 1 if no matches, which throws
    // This means the version didn't change
    return false;
  }
}

/**
 * Build the release announcement embed
 */
function buildReleaseEmbed(release) {
  const embed = new EmbedBuilder()
    .setColor(0x14b8a6) // Teal accent color
    .setTitle(`v${release.version} — ${release.title}`)
    .setURL(RELEASE_NOTES_URL)
    .setTimestamp();

  if (release.highlights && release.highlights.length > 0) {
    const highlightText = release.highlights.map(h => `• ${h}`).join('\n');
    embed.addFields({ name: 'Highlights', value: highlightText });
  }

  embed.addFields({
    name: '\u200B',
    value: `📖 **[View Full Release Notes](${RELEASE_NOTES_URL})**`,
  });

  return embed;
}

/**
 * Build the commit info embed
 */
function buildCommitEmbed(sha, message, author, repository) {
  const shortSha = sha.substring(0, 7);
  const commitUrl = `https://github.com/${repository}/commit/${sha}`;

  // Clean up the commit message - take first line only
  const firstLine = message.split('\n')[0].trim();

  const embed = new EmbedBuilder()
    .setColor(0x6b7280) // Gray for regular commits
    .setTitle('Merged to main')
    .setDescription(`\`${shortSha}\` — ${firstLine}`)
    .addFields({ name: 'Author', value: author, inline: true })
    .addFields({ name: 'Link', value: `[View Commit](${commitUrl})`, inline: true })
    .setTimestamp();

  return embed;
}

/**
 * Main function
 */
async function main() {
  // Get environment variables
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANGELOG_CHANNEL_ID;
  const commitSha = process.env.COMMIT_SHA || process.env.GITHUB_SHA;
  const commitMessage = process.env.COMMIT_MESSAGE || '';
  const commitAuthor = process.env.COMMIT_AUTHOR || 'Unknown';
  const repository = process.env.GITHUB_REPOSITORY || 'unknown/unknown';

  // Validate required environment variables
  if (!token) {
    console.error('DISCORD_BOT_TOKEN is required');
    process.exit(1);
  }

  if (!channelId) {
    console.error('DISCORD_CHANGELOG_CHANNEL_ID is required');
    process.exit(1);
  }

  if (!commitSha) {
    console.error('COMMIT_SHA or GITHUB_SHA is required');
    process.exit(1);
  }

  console.log('Parsing release notes...');
  const releaseInfo = parseReleaseNotes();

  if (!releaseInfo) {
    console.error('Failed to parse release notes, exiting');
    process.exit(1);
  }

  console.log(`Current version: ${releaseInfo.currentVersion}`);

  // Check if this is a new version release
  const isNewRelease = didVersionChange();
  console.log(`Version changed in this commit: ${isNewRelease}`);

  // Create Discord client
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    console.log('Logging in to Discord...');
    await client.login(token);

    console.log('Fetching channel...');
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
      console.error(`Channel ${channelId} not found or not a text channel`);
      process.exit(1);
    }

    const embeds = [];

    // Add release embed if new version
    if (isNewRelease && releaseInfo.latestRelease) {
      console.log(`New release detected: v${releaseInfo.latestRelease.version}`);
      embeds.push(buildReleaseEmbed(releaseInfo.latestRelease));
    }

    // Add commit embed
    embeds.push(buildCommitEmbed(commitSha, commitMessage, commitAuthor, repository));

    // Send the message
    console.log('Sending message to Discord...');
    await channel.send({ embeds });

    console.log('Message sent successfully!');
  } catch (error) {
    console.error('Error sending Discord message:', error);
    process.exit(1);
  } finally {
    // Clean up
    client.destroy();
  }
}

// Run
main();
