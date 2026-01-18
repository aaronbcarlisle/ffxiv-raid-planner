import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import {
  parseReleaseNotes,
  buildCommitEmbed,
  buildReleaseEmbed,
  getCommitTypeColor,
  summarizeBody,
  summarizeWithAI,
  isAIOnlyCommit,
  stripAIAttributions,
  COMMIT_TYPE_COLORS,
  DISCORD_TITLE_LIMIT,
  DISCORD_DESCRIPTION_LIMIT,
  TRUNCATION_MESSAGE_RESERVE,
  RELEASE_NOTES_PATH,
} from './discord-changelog.js';

describe('discord-changelog', () => {
  describe('constants', () => {
    it('DISCORD_TITLE_LIMIT is 256', () => {
      expect(DISCORD_TITLE_LIMIT).toBe(256);
    });

    it('DISCORD_DESCRIPTION_LIMIT is 500 for concise posts', () => {
      expect(DISCORD_DESCRIPTION_LIMIT).toBe(500);
    });

    it('TRUNCATION_MESSAGE_RESERVE is 50', () => {
      expect(TRUNCATION_MESSAGE_RESERVE).toBe(50);
    });

    it('has commit type colors for common types', () => {
      expect(COMMIT_TYPE_COLORS.feat).toBe(0x10b981);
      expect(COMMIT_TYPE_COLORS.fix).toBe(0xef4444);
      expect(COMMIT_TYPE_COLORS.docs).toBe(0x3b82f6);
    });
  });

  describe('parseReleaseNotes', () => {
    it('returns parsed release notes from the actual file', () => {
      // This tests against the actual releaseNotes.ts file
      const result = parseReleaseNotes();

      expect(result).not.toBeNull();
      expect(result.currentVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.latestRelease).toBeDefined();
      expect(result.latestRelease.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.latestRelease.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(result.latestRelease.highlights)).toBe(true);
    });

    it('RELEASE_NOTES_PATH points to an existing file', () => {
      expect(existsSync(RELEASE_NOTES_PATH)).toBe(true);
    });

    it('currentVersion matches latestRelease.version', () => {
      const result = parseReleaseNotes();
      expect(result.currentVersion).toBe(result.latestRelease.version);
    });
  });

  describe('getCommitTypeColor', () => {
    it('returns green for feat commits', () => {
      expect(getCommitTypeColor('feat: add feature')).toBe(0x10b981);
    });

    it('returns red for fix commits', () => {
      expect(getCommitTypeColor('fix: repair bug')).toBe(0xef4444);
    });

    it('returns blue for docs commits', () => {
      expect(getCommitTypeColor('docs: update readme')).toBe(0x3b82f6);
    });

    it('handles scoped commits', () => {
      expect(getCommitTypeColor('feat(ui): add button')).toBe(0x10b981);
      expect(getCommitTypeColor('fix(api): handle error')).toBe(0xef4444);
    });

    it('returns default gray for unknown types', () => {
      expect(getCommitTypeColor('random commit message')).toBe(0x6b7280);
    });

    it('is case insensitive', () => {
      expect(getCommitTypeColor('FEAT: uppercase feature')).toBe(0x10b981);
      expect(getCommitTypeColor('FIX: uppercase fix')).toBe(0xef4444);
    });
  });

  describe('summarizeBody', () => {
    it('returns body as-is if under max length', () => {
      const body = 'Short body text.';
      expect(summarizeBody(body, 500)).toBe('Short body text.');
    });

    it('returns empty string for empty body', () => {
      expect(summarizeBody('', 500)).toBe('');
      expect(summarizeBody(null, 500)).toBe(null);
    });

    it('prioritizes bullet points when present', () => {
      const body = `Some intro text.

- First bullet point
- Second bullet point
- Third bullet point

Some outro text.`;
      const result = summarizeBody(body, 100);
      expect(result).toContain('First bullet');
    });

    it('normalizes different bullet styles to dots', () => {
      const body = `* Star bullet
- Dash bullet`;
      const result = summarizeBody(body, 500);
      expect(result).toContain('Star bullet');
      expect(result).toContain('Dash bullet');
    });

    it('truncates at sentence boundary when no bullets', () => {
      const body = 'First sentence here. Second sentence here. Third sentence is much longer and continues.';
      const result = summarizeBody(body, 60);
      expect(result).toContain('First sentence');
    });

    it('enforces strict character limit', () => {
      const longBody = 'x'.repeat(600);
      const result = summarizeBody(longBody, 100);
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('summarizeWithAI', () => {
    it('returns null when ANTHROPIC_API_KEY is not set', async () => {
      // In test environment, API key should not be set
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const result = await summarizeWithAI('feat: test commit\n\nSome body text');
      expect(result).toBeNull();

      // Restore if it was set
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    });
  });

  describe('stripAIAttributions', () => {
    it('removes AI Co-Authored-By lines', () => {
      const text = `Some content

Co-Authored-By: Claude <noreply@anthropic.com>`;
      expect(stripAIAttributions(text)).toBe('Some content');
    });

    it('preserves human Co-Authored-By lines', () => {
      const text = `Some content

Co-Authored-By: Jane Smith <jane@example.com>`;
      expect(stripAIAttributions(text)).toContain('Co-Authored-By: Jane Smith');
    });

    it('removes Generated with/by lines', () => {
      const text = `Feature implementation

Generated with Claude Code`;
      expect(stripAIAttributions(text)).toBe('Feature implementation');
    });

    it('removes Copilot Co-Authored-By lines', () => {
      const text = `Content here

Co-Authored-By: GitHub Copilot`;
      expect(stripAIAttributions(text)).toBe('Content here');
    });

    it('removes emoji robot lines', () => {
      const text = `Content

🤖 Generated by AI`;
      expect(stripAIAttributions(text)).toBe('Content');
    });

    it('handles null and empty input', () => {
      expect(stripAIAttributions(null)).toBe(null);
      expect(stripAIAttributions('')).toBe('');
    });

    it('removes multiple AI attribution types', () => {
      const text = `Real content here

Co-Authored-By: Claude <noreply@anthropic.com>
Generated with Copilot`;
      expect(stripAIAttributions(text)).toBe('Real content here');
    });

    it('preserves Signed-Off-By (DCO signatures)', () => {
      const text = `Real content

Signed-Off-By: Developer <dev@example.com>`;
      expect(stripAIAttributions(text)).toContain('Signed-Off-By: Developer');
    });
  });

  describe('isAIOnlyCommit', () => {
    it('returns true for empty messages', () => {
      expect(isAIOnlyCommit('')).toBe(true);
      expect(isAIOnlyCommit('   ')).toBe(true);
      expect(isAIOnlyCommit(null)).toBe(true);
    });

    it('returns true for messages with only AI attribution', () => {
      expect(isAIOnlyCommit('Co-Authored-By: Claude <noreply@anthropic.com>')).toBe(true);
      expect(isAIOnlyCommit('Generated with Claude Code')).toBe(true);
      expect(isAIOnlyCommit('Co-Authored-By: GitHub Copilot')).toBe(true);
    });

    it('returns false for normal commit messages', () => {
      expect(isAIOnlyCommit('feat: add new feature')).toBe(false);
      expect(isAIOnlyCommit('fix: repair bug in login flow')).toBe(false);
    });

    it('returns false for commits with AI attribution AND real content', () => {
      const message = `feat: add new feature

This implements the new dashboard.

Co-Authored-By: Claude <noreply@anthropic.com>`;
      expect(isAIOnlyCommit(message)).toBe(false);
    });

    it('returns true for messages with only metadata', () => {
      expect(isAIOnlyCommit('Signed-Off-By: Someone')).toBe(true);
    });
  });

  describe('buildCommitEmbed', () => {
    it('creates embed with title from commit message', async () => {
      const embed = await buildCommitEmbed('abc1234567890', 'feat: add new feature', 'user/repo');
      const data = embed.toJSON();

      expect(data.title).toBe('feat: add new feature');
      expect(data.url).toBe('https://github.com/user/repo/commit/abc1234567890');
    });

    it('uses green color for feat commits', async () => {
      const embed = await buildCommitEmbed('abc1234', 'feat: add new feature', 'user/repo');
      const data = embed.toJSON();

      expect(data.color).toBe(0x10b981);
    });

    it('uses red color for fix commits', async () => {
      const embed = await buildCommitEmbed('abc1234', 'fix: repair bug', 'user/repo');
      const data = embed.toJSON();

      expect(data.color).toBe(0xef4444);
    });

    it('truncates long titles to 256 characters', async () => {
      const longTitle = 'a'.repeat(300);
      const embed = await buildCommitEmbed('abc1234', longTitle, 'user/repo');
      const data = embed.toJSON();

      expect(data.title.length).toBeLessThanOrEqual(DISCORD_TITLE_LIMIT);
      expect(data.title.endsWith('...')).toBe(true);
    });

    it('uses shortSha as fallback when message is empty', async () => {
      const embed = await buildCommitEmbed('abc1234567890', '', 'user/repo');
      const data = embed.toJSON();

      expect(data.title).toBe('abc1234');
    });

    it('strips AI attributions from title', async () => {
      const embed = await buildCommitEmbed('abc1234', 'Generated with Claude Code', 'user/repo');
      const data = embed.toJSON();

      // Should fall back to shortSha since title was AI attribution
      expect(data.title).toBe('abc1234');
    });

    it('omits description when body is only AI attributions', async () => {
      const message = `feat: add feature

Co-Authored-By: Claude <noreply@anthropic.com>`;
      const embed = await buildCommitEmbed('abc1234', message, 'user/repo');
      const data = embed.toJSON();

      // Should have title but no description
      expect(data.title).toBe('feat: add feature');
      expect(data.description).toBeUndefined();
    });

    it('includes commit body as description (fallback summarization)', async () => {
      const message = `feat: add feature

This is the commit body with more details.`;
      const embed = await buildCommitEmbed('abc1234', message, 'user/repo');
      const data = embed.toJSON();

      // Without API key, should fall back to summarizeBody
      expect(data.description).toBe('This is the commit body with more details.');
    });

    it('strips AI attributions from fallback description', async () => {
      const message = `feat: add feature

This is the commit body.

Co-Authored-By: Claude <noreply@anthropic.com>`;
      const embed = await buildCommitEmbed('abc1234', message, 'user/repo');
      const data = embed.toJSON();

      // Without API key, should fall back to summarizeBody with stripped attributions
      expect(data.description).not.toContain('Co-Authored-By');
      expect(data.description).not.toContain('Claude');
      expect(data.description).toContain('This is the commit body');
    });

    it('summarizes long descriptions', async () => {
      const longBody = 'x'.repeat(600);
      const message = `feat: title\n\n${longBody}`;
      const embed = await buildCommitEmbed('abc1234', message, 'user/repo');
      const data = embed.toJSON();

      expect(data.description.length).toBeLessThanOrEqual(DISCORD_DESCRIPTION_LIMIT);
    });

    it('sets footer with short SHA and author', async () => {
      const embed = await buildCommitEmbed('abc1234567890', 'feat: test', 'user/repo');
      const data = embed.toJSON();

      expect(data.footer.text).toContain('abc1234');
      expect(data.footer.text).toContain('Aaron Carlisle');
    });
  });

  describe('buildReleaseEmbed', () => {
    it('creates embed with version and title', () => {
      const release = {
        version: '1.0.0',
        title: 'Initial Release',
        highlights: ['Feature 1', 'Feature 2'],
      };
      const embed = buildReleaseEmbed(release);
      const data = embed.toJSON();

      expect(data.title).toBe('v1.0.0 — Initial Release');
    });

    it('includes highlights in description', () => {
      const release = {
        version: '1.0.0',
        title: 'Test Release',
        highlights: ['Highlight 1', 'Highlight 2'],
      };
      const embed = buildReleaseEmbed(release);
      const data = embed.toJSON();

      expect(data.description).toContain('• Highlight 1');
      expect(data.description).toContain('• Highlight 2');
    });

    it('handles empty highlights', () => {
      const release = {
        version: '1.0.0',
        title: 'No Highlights',
        highlights: [],
      };
      const embed = buildReleaseEmbed(release);
      const data = embed.toJSON();

      // Should still have the link to release notes
      expect(data.description).toContain('View Full Release Notes');
    });

    it('does not have leading newlines when highlights are empty', () => {
      const release = {
        version: '1.0.0',
        title: 'No Highlights',
        highlights: [],
      };
      const embed = buildReleaseEmbed(release);
      const data = embed.toJSON();

      // Description should start with the link, not newlines
      expect(data.description.startsWith('[View Full Release Notes]')).toBe(true);
    });

    it('includes link to full release notes in description', () => {
      const release = {
        version: '1.0.0',
        title: 'Test',
        highlights: [],
      };
      const embed = buildReleaseEmbed(release);
      const data = embed.toJSON();

      expect(data.description).toContain('View Full Release Notes');
    });

    it('uses teal accent color', () => {
      const release = {
        version: '1.0.0',
        title: 'Test',
        highlights: [],
      };
      const embed = buildReleaseEmbed(release);
      const data = embed.toJSON();

      expect(data.color).toBe(0x14b8a6);
    });
  });

  describe('embed combinations', () => {
    it('can build both release and commit embeds for the same message', async () => {
      // Simulates scenario where a version bump commit triggers both embeds
      const release = {
        version: '1.0.5',
        title: 'New Features',
        highlights: ['Feature A', 'Feature B'],
      };
      const commitMessage = `chore: bump version to 1.0.5

- Added Feature A
- Added Feature B`;

      const releaseEmbed = buildReleaseEmbed(release);
      const commitEmbed = await buildCommitEmbed('abc1234', commitMessage, 'user/repo');

      const releaseData = releaseEmbed.toJSON();
      const commitData = commitEmbed.toJSON();

      // Both embeds should be valid and have distinct content
      expect(releaseData.title).toBe('v1.0.5 — New Features');
      expect(commitData.title).toBe('chore: bump version to 1.0.5');

      // Release embed has teal color, commit embed has gray (chore type)
      expect(releaseData.color).toBe(0x14b8a6);
      expect(commitData.color).toBe(0x6b7280);
    });

    it('release and commit embeds have compatible structure for Discord API', async () => {
      const release = {
        version: '2.0.0',
        title: 'Major Release',
        highlights: ['Breaking changes'],
      };
      const releaseEmbed = buildReleaseEmbed(release);
      const commitEmbed = await buildCommitEmbed('def5678', 'feat: major update', 'owner/repo');

      // Both should be valid EmbedBuilder instances that can be sent together
      const embeds = [releaseEmbed, commitEmbed];

      // Verify each embed has required structure
      embeds.forEach((embed) => {
        const data = embed.toJSON();
        expect(data).toHaveProperty('title');
        expect(data).toHaveProperty('color');
        expect(typeof data.title).toBe('string');
        expect(typeof data.color).toBe('number');
      });
    });
  });
});
