/**
 * Backfill Discord changelog embed authors.
 *
 * One-off maintenance script. The changelog poster (discord-changelog.js)
 * historically hardcoded every embed's author to the repo owner, so commits by
 * other contributors were mis-attributed. This script walks the changelog
 * channel, re-resolves each commit embed's real author via the GitHub API, and
 * edits the bot's own messages IN PLACE (no deletes, no re-pings).
 *
 * It is idempotent: an embed whose author is already correct is left untouched,
 * so it's safe to run twice (e.g. a dry run followed by the real run).
 *
 * Environment variables:
 * - DISCORD_BOT_TOKEN              Discord bot token (must own the messages)
 * - DISCORD_CHANGELOG_CHANNEL_ID   Channel to scan
 * - GITHUB_TOKEN                   For authenticated GitHub API author lookups
 * - GITHUB_REPOSITORY             "owner/repo" the commits belong to
 * - SINCE_SHA                      Only edit embeds for commits at/after this
 *                                  commit's date (default: 45760f6, the #83 merge)
 * - DRY_RUN                        "true" (default) logs intended edits without
 *                                  applying them; "false" applies them
 * - MAX_MESSAGES                   Safety cap on messages scanned (default 500)
 */

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { fetchCommitAuthor, buildEmbedAuthor } from './discord-changelog.js';

const DEFAULT_SINCE_SHA = '45760f6'; // "Add schedule availability... (#83)" — first contributor merge
const DEFAULT_MAX_MESSAGES = 500;
const DISCORD_FETCH_PAGE = 100; // Discord API max per fetch
const GITHUB_API_TIMEOUT_MS = 10000;

// Matches the commit URL discord-changelog.js puts on commit embeds:
//   https://github.com/<owner>/<repo>/commit/<sha>
const COMMIT_URL_RE = /github\.com\/[^/]+\/[^/]+\/commit\/([0-9a-f]{7,40})/i;

/**
 * Extract the commit SHA an embed points at, or null if it isn't a commit
 * embed (e.g. a release-notes embed links to the docs site, not a commit).
 * Pure — unit-tested without Discord.
 */
export function extractCommitSha(embed) {
  if (!embed?.url) return null;
  const match = embed.url.match(COMMIT_URL_RE);
  return match ? match[1] : null;
}

/**
 * Decide whether an embed's author field needs rewriting.
 * Returns false when there's no desired author (resolution failed) so a failed
 * lookup never clobbers an existing author. Compares the human-visible name and
 * the profile URL; avatar differences alone don't warrant an edit.
 * Pure — unit-tested without Discord.
 */
export function authorNeedsUpdate(currentAuthor, desired) {
  if (!desired) return false;
  const currentName = currentAuthor?.name ?? null;
  const currentUrl = currentAuthor?.url ?? null;
  return currentName !== desired.name || currentUrl !== (desired.url ?? null);
}

/**
 * Look up a commit's committer date (ISO string) so we can bound the scan.
 * Returns null on failure — the caller then scans without a lower bound.
 */
async function fetchCommitDate(sha, repository, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repository}/commits/${sha}`,
      { headers, signal: controller.signal }
    );
    if (!res.ok) {
      console.warn(`Could not fetch SINCE commit ${sha} (HTTP ${res.status}); scanning without a date bound`);
      return null;
    }
    const data = await res.json();
    return data?.commit?.committer?.date || data?.commit?.author?.date || null;
  } catch (error) {
    console.warn(`Could not fetch SINCE commit ${sha}: ${error.message}; scanning without a date bound`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the bot's own changelog messages newest-first, stopping once we pass
 * the sinceTimestamp lower bound (or hit the safety cap). Returns an array of
 * discord.js Message objects, oldest first (so edits apply in chronological
 * order, which keeps logs readable).
 */
async function collectMessages(channel, botUserId, sinceTimestamp, maxMessages) {
  const collected = [];
  let before;

  while (collected.length < maxMessages) {
    const batch = await channel.messages.fetch({ limit: DISCORD_FETCH_PAGE, before });
    if (batch.size === 0) break;

    let reachedBound = false;
    for (const message of batch.values()) {
      before = message.id; // paginate from the oldest seen
      if (sinceTimestamp !== null && message.createdTimestamp < sinceTimestamp) {
        reachedBound = true;
        continue;
      }
      if (message.author?.id !== botUserId) continue;
      if (!message.embeds || message.embeds.length === 0) continue;
      collected.push(message);
    }

    if (reachedBound) break; // everything older than the bound from here on
    if (batch.size < DISCORD_FETCH_PAGE) break; // last page
  }

  return collected.reverse(); // oldest first
}

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANGELOG_CHANNEL_ID;
  const repository = process.env.GITHUB_REPOSITORY;
  const sinceSha = (process.env.SINCE_SHA || DEFAULT_SINCE_SHA).trim();
  const dryRun = (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
  const maxMessages = Number(process.env.MAX_MESSAGES) || DEFAULT_MAX_MESSAGES;

  if (!token) {
    console.error('DISCORD_BOT_TOKEN is required');
    process.exit(1);
  }
  if (!channelId) {
    console.error('DISCORD_CHANGELOG_CHANNEL_ID is required');
    process.exit(1);
  }
  if (!repository || repository === 'unknown/unknown') {
    console.error('GITHUB_REPOSITORY is required');
    process.exit(1);
  }

  console.log(`Mode: ${dryRun ? 'DRY RUN (no edits will be made)' : 'LIVE (editing messages)'}`);
  console.log(`Repository: ${repository}`);
  console.log(`Scanning embeds for commits at/after: ${sinceSha}`);

  const githubHeaders = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'xrp-discord-changelog-backfill',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    githubHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const sinceDate = await fetchCommitDate(sinceSha, repository, githubHeaders);
  const sinceTimestamp = sinceDate ? new Date(sinceDate).getTime() : null;
  console.log(`Date bound: ${sinceDate ? `>= ${sinceDate}` : 'none (scanning up to the message cap)'}`);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let unresolved = 0;

  try {
    await client.login(token);
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.error(`Channel ${channelId} not found or not a text channel`);
      process.exit(1);
    }

    const botUserId = client.user.id;
    const messages = await collectMessages(channel, botUserId, sinceTimestamp, maxMessages);
    console.log(`Found ${messages.length} bot changelog message(s) in range.\n`);

    for (const message of messages) {
      const embed = message.embeds[0];
      const sha = extractCommitSha(embed);
      if (!sha) {
        skipped++;
        continue; // release-notes / non-commit embed — leave as-is
      }

      scanned++;
      const author = await fetchCommitAuthor(sha, repository);
      if (!author) {
        unresolved++;
        console.log(`  • ${sha.substring(0, 7)} — could not resolve author, leaving unchanged`);
        continue;
      }

      const desired = buildEmbedAuthor(author);
      const current = embed.author ? { name: embed.author.name, url: embed.author.url } : null;

      if (!authorNeedsUpdate(current, desired)) {
        skipped++;
        continue; // already correct
      }

      console.log(
        `  • ${sha.substring(0, 7)} — "${current?.name ?? '(none)'}" → "${desired.name}"` +
        `${dryRun ? '  [dry run]' : ''}`
      );

      if (!dryRun) {
        const newEmbed = EmbedBuilder.from(embed).setAuthor(desired);
        await message.edit({ embeds: [newEmbed] });
      }
      updated++;
    }

    console.log(
      `\nDone. ${dryRun ? 'Would update' : 'Updated'} ${updated}, already-correct/skipped ${skipped}, ` +
      `unresolved ${unresolved} (of ${scanned} commit embeds).`
    );
    if (dryRun && updated > 0) {
      console.log('Re-run with DRY_RUN=false to apply these edits.');
    }
  } catch (error) {
    console.error('Backfill failed:', error.message || error);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    client.destroy();
  }
}

// Run only when executed directly (not when imported for tests)
import { pathToFileURL } from 'url';
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}
