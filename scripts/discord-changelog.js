/**
 * Discord Changelog Notification Script
 *
 * Posts changelog updates to Discord when PRs are merged to main.
 * - Posts release announcements when a new version is detected
 * - Posts commit info for all merges
 * - Uses AI to generate concise summaries
 *
 * Environment variables:
 * - DISCORD_BOT_TOKEN: Discord bot token
 * - DISCORD_CHANGELOG_CHANNEL_ID: Channel ID to post to
 * - ANTHROPIC_API_KEY: Anthropic API key for AI summarization
 * - COMMIT_SHA: The commit hash
 * - COMMIT_MESSAGE: The full commit message (title + body)
 * - GITHUB_REPOSITORY: The repository (e.g., "user/repo")
 */

import Anthropic from '@anthropic-ai/sdk';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const RELEASE_NOTES_PATH = join(__dirname, '../frontend/src/data/releaseNotes.ts');
const APP_BASE_URL = 'https://www.xivraidplanner.app';
const RELEASE_NOTES_URL = `${APP_BASE_URL}/docs/release-notes`;
const APP_THUMBNAIL_URL = `${APP_BASE_URL}/og-image.png`;
// Hardcoded per CLAUDE.md: "NEVER add AI attribution to commits or PRs"
const COMMIT_AUTHOR = 'Aaron Carlisle';
const COMMIT_AUTHOR_GITHUB = 'aaronbcarlisle';

// Discord embed limits (https://discord.com/developers/docs/resources/channel#embed-limits)
const DISCORD_TITLE_LIMIT = 256;
const DISCORD_DESCRIPTION_LIMIT = 1000; // Rich descriptions for detailed changelogs
const TRUNCATION_MESSAGE_RESERVE = 50; // Space for the truncation hint

// AI model configuration
const AI_MODEL = 'claude-3-5-haiku-latest';
const AI_TIMEOUT_MS = 10000; // 10 second timeout for API calls

// Summarization configuration
const MAX_HIGHLIGHTS_WHEN_TRUNCATED = 2; // Max highlights shown when description exceeds limit
const SENTENCE_BOUNDARY_MIN_FRACTION = 0.5; // Only use sentence boundary if at least 50% into text

// Commit type colors for visual identification
const COMMIT_TYPE_COLORS = {
  feat: 0x10b981,     // Green for features
  feature: 0x10b981,
  fix: 0xef4444,      // Red for bug fixes
  bugfix: 0xef4444,
  docs: 0x3b82f6,     // Blue for docs
  style: 0x8b5cf6,    // Purple for style
  refactor: 0x6b7280, // Gray for refactor
  perf: 0xf59e0b,     // Orange for performance
  test: 0x06b6d4,     // Cyan for tests
  build: 0x6b7280,    // Gray for build
  ci: 0x6b7280,       // Gray for CI
  chore: 0x6b7280,    // Gray for chores
  revert: 0xf59e0b,   // Orange for reverts
  security: 0x8b5cf6, // Purple for security
  breaking: 0xf59e0b, // Orange for breaking changes
};

// Anthropic client (initialized lazily)
let anthropicClient = null;

// Patterns that indicate AI-generated content (for skip detection)
// Note: co-authored-by is handled separately below to strip ALL co-authors
// Using 'gi' flags so patterns can be used directly with .replace() without recreating
const AI_CONTENT_PATTERNS = [
  /generated (?:with|by) (?:claude|copilot|cursor)/gi,
  /🤖.*claude/gi,
];

// AI attribution patterns to strip from descriptions (per CLAUDE.md policy)
// Only strips AI-specific co-authors, preserves human collaborators
const AI_ATTRIBUTION_PATTERNS = [
  /co-authored-by:.*(?:anthropic|claude|copilot|cursor|openai|github\.com\/apps).*$/gim,
  // Robot emoji pattern: Only matches lines STARTING with 🤖 followed by AI attribution text.
  // The ^ anchor is intentional - we DON'T want to strip "feat: 🤖 add bot" (legitimate use).
  // Must run before the "generated with/by" pattern so we strip the emoji + phrase together.
  /^\s*🤖\s*(?:Generated|Made|Created|Authored).*$/gim,
  /generated (?:with|by) (?:claude|copilot|cursor|ai|gpt|llm).*$/gim,
];

/**
 * Strip AI attributions from text (per CLAUDE.md policy)
 * Used by fallback path when AI summarization is unavailable
 */
function stripAIAttributions(text) {
  if (!text) return text;

  let result = text;
  for (const pattern of AI_ATTRIBUTION_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Clean up extra blank lines left by removed attributions
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Sanitize AI terminology from text to keep changelog neutral
 * Replaces AI-related terms with functional descriptions
 */
function sanitizeAITerminology(text) {
  if (!text) return text;

  return text
    .replace(/\bAI[- ]powered\b/gi, 'automated')
    .replace(/\bAI[- ]driven\b/gi, 'smart')
    .replace(/\bAI[- ]summarization\b/gi, 'smart summarization')
    .replace(/\bAI[- ]generated\b/gi, 'auto-generated')
    .replace(/\bartificial intelligence\b/gi, 'automation')
    .replace(/\bwith AI\b/gi, 'with automation')
    .replace(/\busing AI\b/gi, 'using automation')
    // Standalone "AI" only when clearly about AI features (not "RAID" or similar)
    .replace(/\bAI\b(?=\s+(?:feature|tool|system|integration|capability|assistant))/gi, 'smart');
}

/**
 * Check if a commit message is primarily AI-generated content
 * Returns true if the commit should be skipped
 */
function isAIOnlyCommit(message) {
  if (!message || !message.trim()) {
    return true;
  }

  // Remove all AI attribution lines and see what's left
  // Patterns already have 'gi' flags, use directly with .replace()
  let cleaned = message;
  for (const pattern of AI_CONTENT_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove common metadata patterns
  cleaned = cleaned
    .replace(/co-authored-by:.*$/gim, '')
    .replace(/signed-off-by:.*$/gim, '')
    .trim();

  // If nothing meaningful remains (just whitespace/newlines), it's AI-only
  const meaningfulContent = cleaned.replace(/[\s\n]+/g, '');
  return meaningfulContent.length < 5; // Less than 5 chars of real content
}

/**
 * Get or create the Anthropic client
 */
function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return null;
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Use AI to generate a concise summary of a commit message
 * Returns null if AI summarization fails, times out, or is unavailable
 */
async function summarizeWithAI(commitMessage, maxLength = DISCORD_DESCRIPTION_LIMIT) {
  const client = getAnthropicClient();
  if (!client) {
    console.log('ANTHROPIC_API_KEY not set, skipping AI summarization');
    return null;
  }

  try {
    // Create a timeout promise to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API call timed out')), AI_TIMEOUT_MS);
    });

    const apiPromise = client.messages.create({
      model: AI_MODEL,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Summarize this git commit message for a Discord changelog post.

STRICT RULES:
- Keep it under ${maxLength} characters
- Focus on WHAT changed and WHY, not HOW
- Use bullet points for multiple changes
- NEVER use the words: AI, artificial intelligence, Claude, Copilot, Cursor, LLM, GPT, machine learning, neural, model
- NEVER include "Co-Authored-By", "Generated by", or similar attributions
- If the commit adds AI/ML features, describe them by their function (e.g., "smart summarization" not "AI summarization")
- Replace AI terminology with neutral alternatives (e.g., "automated" instead of "AI-powered")
- Output ONLY the summary, nothing else

Commit message:
${commitMessage}

Summary:`
      }]
    });

    // Race between API call and timeout
    const response = await Promise.race([apiPromise, timeoutPromise]);

    const summary = response.content[0]?.text?.trim();
    if (summary && summary.length <= maxLength) {
      return summary;
    }
    // If summary is too long, truncate it
    if (summary) {
      return summary.substring(0, maxLength - 3) + '...';
    }
    return null;
  } catch (error) {
    console.error('AI summarization failed:', error.message);
    return null;
  }
}

/**
 * Detect commit type from conventional commit message and return color
 */
function getCommitTypeColor(title) {
  const lowerTitle = title.toLowerCase();

  // Check for conventional commit format: type(scope): message or type: message
  const conventionalMatch = lowerTitle.match(/^(\w+)(?:\([^)]*\))?:/);
  if (conventionalMatch) {
    const type = conventionalMatch[1];
    if (COMMIT_TYPE_COLORS[type]) {
      return COMMIT_TYPE_COLORS[type];
    }
  }

  // Fallback: check if title starts with common keywords
  for (const [type, color] of Object.entries(COMMIT_TYPE_COLORS)) {
    if (lowerTitle.startsWith(type)) {
      return color;
    }
  }

  return 0x6b7280; // Default gray for general changes
}

/**
 * Smartly summarize commit body to fit within character limit
 * Prioritizes bullet points and truncates at sentence boundaries
 */
function summarizeBody(body, maxLength) {
  if (!body || body.length <= maxLength) {
    return body;
  }

  const TRUNCATION_SUFFIX = '...';
  const suffixLength = TRUNCATION_SUFFIX.length;

  const lines = body.split('\n').map(l => l.trim()).filter(l => l);

  // Check if body has bullet points (-, *, •)
  const bulletLines = lines.filter(l => /^[-*•]\s/.test(l));

  if (bulletLines.length > 0) {
    // Prioritize bullet points - take as many as fit
    let summary = '';
    const moreIndicator = '\n...';
    let bulletsAdded = 0;
    for (const bullet of bulletLines) {
      const cleanBullet = bullet.replace(/^[-*•]\s*/, '• ');
      if ((summary + cleanBullet + '\n' + moreIndicator).length <= maxLength) {
        summary += cleanBullet + '\n';
        bulletsAdded++;
      } else {
        break;
      }
    }
    if (summary && bulletLines.length > bulletsAdded) {
      return (summary.trim() + moreIndicator).substring(0, maxLength);
    }
    // Fallback: ensure result doesn't exceed maxLength (multi-byte Unicode safety)
    const fallback = summary.trim() || body.substring(0, maxLength - suffixLength) + TRUNCATION_SUFFIX;
    return fallback.length > maxLength ? fallback.substring(0, maxLength) : fallback;
  }

  // No bullets - truncate at sentence or line boundary
  const reserveForSuffix = suffixLength;
  const truncateAt = maxLength - reserveForSuffix;
  let truncated = body.substring(0, truncateAt);

  // Try to end at a sentence boundary. Only use it if reasonably far into
  // the text (at least 50%) to avoid extremely short summaries.
  const lastPeriod = truncated.lastIndexOf('. ');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);

  if (cutPoint > truncateAt * SENTENCE_BOUNDARY_MIN_FRACTION) {
    truncated = truncated.substring(0, cutPoint + 1);
  }

  return (truncated.trim() + TRUNCATION_SUFFIX).substring(0, maxLength);
}

/**
 * Parse release items from a release block
 * Extracts category, title, and description from each item
 */
function parseReleaseItems(itemsContent) {
  const items = [];

  // Match each item object - look for category, title, and optional description
  // Pattern captures category, title, and optionally description
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
  // Validate inputs
  if (!content || typeof content !== 'string') {
    console.warn('extractArrayContent: invalid content provided');
    return '';
  }
  if (startIndex < 0 || startIndex >= content.length) {
    console.warn(`extractArrayContent: startIndex ${startIndex} out of bounds (content length: ${content.length})`);
    return '';
  }

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

  // Unbalanced brackets - log warning for debugging
  if (depth !== 0) {
    console.warn(`extractArrayContent: unbalanced brackets (final depth: ${depth})`);
  }

  return '';
}

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
    console.error('Expected format: export const CURRENT_VERSION = "1.0.0"');
    return null;
  }
  const currentVersion = versionMatch[1];

  // Extract the RELEASES array content
  const releasesMatch = content.match(/export const RELEASES:\s*Release\[\]\s*=\s*\[([\s\S]*?)^\];/m);
  if (!releasesMatch) {
    console.error('Could not parse RELEASES array from releaseNotes.ts');
    console.error('Expected format: export const RELEASES: Release[] = [...]');
    return { currentVersion, latestRelease: null };
  }

  const releasesContent = releasesMatch[1];

  // Find the first release header - match version, date, title, highlights, then parse items separately
  const firstReleaseMatch = releasesContent.match(
    /\{\s*version:\s*['"]([^'"]+)['"],\s*date:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]*)?['"]?,?\s*highlights:\s*\[([\s\S]*?)\],\s*items:\s*\[/
  );

  if (!firstReleaseMatch) {
    console.error('Could not parse first release object from RELEASES array');
    console.error('Expected format: { version: "1.0.0", date: "2024-01-01", title: "Title", highlights: [...], items: [...] }');
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

  // Extract the items array content by counting brackets
  const itemsStartIndex = firstReleaseMatch.index + firstReleaseMatch[0].length - 1;
  const itemsStr = extractArrayContent(releasesContent, itemsStartIndex);
  const items = parseReleaseItems(itemsStr);

  return {
    currentVersion,
    latestRelease: {
      version,
      date,
      title,
      highlights,
      items,
    },
  };
}

/**
 * Check if the release notes file was modified in this commit.
 * Any modification to releaseNotes.ts triggers a release announcement.
 *
 * Trade-off: This approach trades precision for simplicity. We treat any change
 * as a potential new release instead of parsing CURRENT_VERSION, avoiding the
 * previous bug-prone grep logic. Since all changes to main require code review,
 * non-release edits (typo fixes in old notes) can be batched with version bumps
 * or the duplicate announcement is acceptable.
 */
function didVersionChange() {
  try {
    const diffOutput = execSync(
      'git diff HEAD~1 --name-only -- frontend/src/data/releaseNotes.ts',
      { encoding: 'utf-8' }
    ).trim();

    console.log(`Release notes file changed: ${diffOutput ? 'yes' : 'no'}`);
    return diffOutput.length > 0;
  } catch (error) {
    console.error('Error checking for release notes changes:', error.message);
    return false;
  }
}

// Category labels for display
const CATEGORY_LABELS = {
  feature: 'New Features',
  improvement: 'Improvements',
  fix: 'Bug Fixes',
  breaking: 'Breaking Changes',
};

// Category order for display (features first, then improvements, fixes, breaking)
const CATEGORY_ORDER = ['feature', 'improvement', 'fix', 'breaking'];

// Category section arrow (used for H3 headers)
const CATEGORY_ARROW = '▸';

// Category colors for embed borders (hex values for Discord)
const CATEGORY_COLORS = {
  feature: 0x10b981,   // Green
  improvement: 0x3b82f6, // Blue
  fix: 0xef4444,       // Red
  breaking: 0xf59e0b,  // Orange
};

// Discord embed description limit (actual limit is 4096, but we use a reasonable max)
const RELEASE_DESCRIPTION_LIMIT = 3500;

// Max items per category when truncating for length
const MAX_ITEMS_PER_CATEGORY_WHEN_TRUNCATED = 5;

/**
 * Build a footer string showing item counts by category
 * e.g., "3 features • 2 improvements • 1 fix"
 */
function buildReleaseFooter(items) {
  if (!items || items.length === 0) {
    return null;
  }

  const counts = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }

  // Build parts in priority order, using singular/plural forms
  const parts = [];
  const labels = {
    feature: ['feature', 'features'],
    improvement: ['improvement', 'improvements'],
    fix: ['fix', 'fixes'],
    breaking: ['breaking change', 'breaking changes'],
  };

  for (const category of CATEGORY_ORDER) {
    const count = counts[category];
    if (count > 0) {
      const [singular, plural] = labels[category] || [category, `${category}s`];
      parts.push(`${count} ${count === 1 ? singular : plural}`);
    }
  }

  return parts.join(' • ');
}

/**
 * Determine the dominant category color for an embed based on item counts
 * Uses the category with the most items. Ties broken by priority: breaking > feature > fix > improvement
 * Falls back to teal if no items match
 */
function getDominantCategoryColor(items) {
  if (!items || items.length === 0) {
    return 0x14b8a6; // Teal fallback
  }

  const counts = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }

  // Find the category with the most items
  // Ties broken by priority: breaking > feature > fix > improvement
  const priority = ['breaking', 'feature', 'fix', 'improvement'];
  let dominantCategory = null;
  let maxCount = 0;

  for (const cat of priority) {
    const count = counts[cat] || 0;
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = cat;
    }
  }

  return CATEGORY_COLORS[dominantCategory] || 0x14b8a6; // Teal fallback
}


/**
 * Build release announcement embed - single embed with all categories
 * Uses H3 headers for category names and plain bullets for items
 * Returns an array with a single embed for consistency with API
 */
function buildReleaseEmbeds(release) {
  const versionAnchor = `${RELEASE_NOTES_URL}#v${release.version}`;

  // Use dominant category color based on release content
  const embedColor = release.items && release.items.length > 0
    ? getDominantCategoryColor(release.items)
    : 0x14b8a6; // Teal fallback

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`v${release.version} — ${release.title}`)
    .setURL(versionAnchor)
    .setAuthor({
      name: COMMIT_AUTHOR,
      url: `https://github.com/${COMMIT_AUTHOR_GITHUB}`,
      iconURL: `https://github.com/${COMMIT_AUTHOR_GITHUB}.png`,
    });

  // Use the release.date which contains the full ISO timestamp from releaseNotes.ts
  // This is the accurate merge/release time, backfilled from git commit history
  embed.setTimestamp(new Date(release.date));

  // Add footer with item counts (e.g., "3 features • 2 improvements • 1 fix")
  const footerText = buildReleaseFooter(release.items);
  if (footerText) {
    embed.setFooter({ text: footerText });
  }

  // If we have items, build description with H3 headers for each category
  if (release.items && release.items.length > 0) {
    // Group items by category
    const groupedItems = {};
    for (const item of release.items) {
      if (!groupedItems[item.category]) {
        groupedItems[item.category] = [];
      }
      groupedItems[item.category].push(item);
    }

    // Build description with H3 headers and plain bullets
    const sections = [];
    for (const category of CATEGORY_ORDER) {
      const items = groupedItems[category];
      if (items && items.length > 0) {
        const label = CATEGORY_LABELS[category] || category;

        // Build item list with plain bullets
        const itemList = items.map(item => {
          if (item.description) {
            return `• **${item.title}** — ${item.description}`;
          }
          return `• **${item.title}**`;
        }).join('\n');

        // Build section with H3 header and arrow
        sections.push(`### ${CATEGORY_ARROW} ${label}\n${itemList}`);
      }
    }

    // Join sections and set as description
    let description = sections.join('\n\n');

    // Truncate if description too long (Discord limit is 4096)
    if (description.length > RELEASE_DESCRIPTION_LIMIT) {
      // Try without descriptions on items
      const shortSections = [];
      for (const category of CATEGORY_ORDER) {
        const items = groupedItems[category];
        if (items && items.length > 0) {
          const label = CATEGORY_LABELS[category] || category;
          const itemList = items.map(item => `• **${item.title}**`).join('\n');
          shortSections.push(`### ${CATEGORY_ARROW} ${label}\n${itemList}`);
        }
      }
      description = shortSections.join('\n\n');

      // If still too long, limit items per category
      if (description.length > RELEASE_DESCRIPTION_LIMIT) {
        const limitedSections = [];
        for (const category of CATEGORY_ORDER) {
          const items = groupedItems[category];
          if (items && items.length > 0) {
            const label = CATEGORY_LABELS[category] || category;
            const displayItems = items.slice(0, MAX_ITEMS_PER_CATEGORY_WHEN_TRUNCATED);
            let itemList = displayItems.map(item => `• **${item.title}**`).join('\n');
            if (items.length > MAX_ITEMS_PER_CATEGORY_WHEN_TRUNCATED) {
              itemList += `\n*...and ${items.length - MAX_ITEMS_PER_CATEGORY_WHEN_TRUNCATED} more*`;
            }
            limitedSections.push(`### ${CATEGORY_ARROW} ${label}\n${itemList}`);
          }
        }
        description = limitedSections.join('\n\n');
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
 * Build a single release embed (legacy format for backward compatibility)
 * @deprecated Use buildReleaseEmbeds which returns an array for consistent API
 */
function buildReleaseEmbed(release) {
  // Return the first (and only) embed for backward compatibility with tests
  return buildReleaseEmbeds(release)[0];
}

/**
 * Build the commit info embed with compact, visually appealing format
 * Uses AI to generate a concise summary of the commit message
 */
async function buildCommitEmbed(sha, message, repository) {
  const shortSha = sha.substring(0, 7);
  const commitUrl = `https://github.com/${repository}/commit/${sha}`;

  // Split into title and body
  const lines = message.split('\n');
  let title = sanitizeAITerminology(stripAIAttributions((lines[0] || '').trim()));

  // Fallback title if commit message is empty or was only AI attribution
  if (!title) {
    title = shortSha;
  }

  // Get commit type color
  const color = getCommitTypeColor(title);

  // Truncate title if too long (Unicode-aware to avoid splitting surrogate pairs)
  if (title.length > DISCORD_TITLE_LIMIT) {
    const codePoints = [...title];
    title = codePoints.slice(0, DISCORD_TITLE_LIMIT - 3).join('') + '...';
  }

  // Get body (everything after first line, skip leading blank lines)
  const bodyLines = lines.slice(1);
  const bodyStartIndex = bodyLines.findIndex(line => line.trim() !== '');
  const body = bodyStartIndex >= 0
    ? bodyLines.slice(bodyStartIndex).join('\n').trim()
    : '';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setURL(commitUrl)
    .setAuthor({
      name: COMMIT_AUTHOR,
      url: `https://github.com/${COMMIT_AUTHOR_GITHUB}`,
      iconURL: `https://github.com/${COMMIT_AUTHOR_GITHUB}.png`,
    })
    .setTimestamp();

  // Add AI-summarized body as description if present
  if (body) {
    // Try AI summarization first, fall back to simple truncation
    let description = await summarizeWithAI(message, DISCORD_DESCRIPTION_LIMIT);
    if (!description) {
      // Strip AI attributions before summarizing (per CLAUDE.md policy)
      const cleanBody = stripAIAttributions(body);
      description = summarizeBody(cleanBody, DISCORD_DESCRIPTION_LIMIT);
    }
    // Only set description if we have meaningful content
    if (description && description.trim()) {
      embed.setDescription(description);
    }
  }

  // Add footer with commit SHA (author info is in the embed author field)
  embed.setFooter({ text: shortSha });

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

  // Skip commits that are purely AI-generated (no meaningful content)
  if (isAIOnlyCommit(commitMessage)) {
    console.log('Commit appears to be AI-only content, skipping Discord notification');
    process.exit(0);
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

    // Add release embed if new version (skip commit embed for releases)
    if (isNewRelease && releaseInfo.latestRelease) {
      console.log(`New release detected: v${releaseInfo.latestRelease.version}`);
      const releaseEmbeds = buildReleaseEmbeds(releaseInfo.latestRelease);
      embeds.push(...releaseEmbeds);
      console.log(`Generated ${releaseEmbeds.length} release embeds`);
    } else {
      // Only add commit embed for non-release commits
      console.log('Generating commit summary...');
      embeds.push(await buildCommitEmbed(commitSha, commitMessage, repository));
    }

    // Send the message (Discord allows up to 10 embeds per message)
    console.log(`Sending ${embeds.length} embeds to Discord...`);
    await channel.send({ embeds });

    console.log('Message sent successfully!');
  } catch (error) {
    console.error('Error sending Discord message:', error.message || error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Clean up
    client.destroy();
  }
}

// Run (only when executed directly, not when imported for tests)
// Use URL comparison for robust cross-platform detection
import { pathToFileURL } from 'url';
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}

// Export for testing
export {
  parseReleaseNotes,
  parseReleaseItems,
  extractArrayContent,
  buildCommitEmbed,
  buildReleaseEmbed,
  buildReleaseEmbeds,
  getCommitTypeColor,
  getDominantCategoryColor,
  buildReleaseFooter,
  summarizeBody,
  summarizeWithAI,
  isAIOnlyCommit,
  stripAIAttributions,
  sanitizeAITerminology,
  COMMIT_TYPE_COLORS,
  DISCORD_TITLE_LIMIT,
  DISCORD_DESCRIPTION_LIMIT,
  TRUNCATION_MESSAGE_RESERVE,
  RELEASE_NOTES_PATH,
  COMMIT_AUTHOR_GITHUB,
  AI_MODEL,
  AI_TIMEOUT_MS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_ARROW,
  CATEGORY_COLORS,
  RELEASE_DESCRIPTION_LIMIT,
  APP_THUMBNAIL_URL,
};
