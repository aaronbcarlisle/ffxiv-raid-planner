import { describe, it, expect } from 'vitest';
import {
  extractCommitSha,
  authorNeedsUpdate,
  isReleaseEmbed,
  matchReleaseCommitSha,
  parseFirstParentLog,
} from './rewrite-changelog-authors.js';

describe('rewrite-changelog-authors', () => {
  describe('extractCommitSha', () => {
    it('pulls the full SHA out of a commit embed URL', () => {
      const embed = { url: 'https://github.com/aaronbcarlisle/ffxiv-raid-planner/commit/45760f6abc1234def5678901234567890abcdef0' };
      expect(extractCommitSha(embed)).toBe('45760f6abc1234def5678901234567890abcdef0');
    });

    it('accepts a short (7-char) SHA', () => {
      const embed = { url: 'https://github.com/owner/repo/commit/45760f6' };
      expect(extractCommitSha(embed)).toBe('45760f6');
    });

    it('returns null for a release-notes embed (not a commit)', () => {
      const embed = { url: 'https://www.xivraidplanner.app/docs/release-notes#v1.18.0' };
      expect(extractCommitSha(embed)).toBeNull();
    });

    it('returns null when the embed has no URL', () => {
      expect(extractCommitSha({})).toBeNull();
      expect(extractCommitSha(null)).toBeNull();
    });
  });

  describe('authorNeedsUpdate', () => {
    const desired = { name: 'RiririFRin', url: 'https://github.com/RiririFRin', iconURL: 'https://example.com/a.png' };

    it('is true when the current author name differs', () => {
      const current = { name: 'Aaron Carlisle', url: 'https://github.com/aaronbcarlisle' };
      expect(authorNeedsUpdate(current, desired)).toBe(true);
    });

    it('is true when only the profile URL differs', () => {
      const current = { name: 'RiririFRin', url: 'https://github.com/aaronbcarlisle' };
      expect(authorNeedsUpdate(current, desired)).toBe(true);
    });

    it('is false when name and url already match (idempotent re-run)', () => {
      const current = { name: 'RiririFRin', url: 'https://github.com/RiririFRin' };
      expect(authorNeedsUpdate(current, desired)).toBe(false);
    });

    it('handles discord.js JSON shape (no url present on current)', () => {
      const current = { name: 'Aaron Carlisle' };
      expect(authorNeedsUpdate(current, desired)).toBe(true);
    });

    it('is false when there is no desired author (resolution failed) to avoid clobbering', () => {
      const current = { name: 'Aaron Carlisle', url: 'https://github.com/aaronbcarlisle' };
      expect(authorNeedsUpdate(current, null)).toBe(false);
    });
  });

  describe('isReleaseEmbed', () => {
    it('is true for a public release embed linking to the release-notes page', () => {
      const embed = {
        title: 'v1.18.0 — Raid Schedule & Availability',
        url: 'https://www.xivraidplanner.app/docs/release-notes#v1.18.0',
      };
      expect(isReleaseEmbed(embed)).toBe(true);
    });

    it('is true for an internal [Dev] release embed (no URL)', () => {
      const embed = { title: '🔧 [Dev] v1.18.1 — Refactor notes' };
      expect(isReleaseEmbed(embed)).toBe(true);
    });

    it('is false for a commit embed (links to a commit)', () => {
      const embed = {
        title: 'feat: add schedule tab',
        url: 'https://github.com/owner/repo/commit/45760f6',
      };
      expect(isReleaseEmbed(embed)).toBe(false);
    });

    it('is false for an arbitrary embed with no version title and no release URL', () => {
      expect(isReleaseEmbed({ title: 'Use Crafting Log icon for the Schedule tab' })).toBe(false);
      expect(isReleaseEmbed(null)).toBe(false);
    });
  });

  describe('matchReleaseCommitSha', () => {
    // Two v1.18.0-touching commits 11 hours apart (RiririFRin's feature, Aaron's doc audit)
    const releaseCommits = [
      { sha: 'b9010c1', timestampMs: Date.parse('2026-05-27T22:35:04-04:00') },
      { sha: '45760f6', timestampMs: Date.parse('2026-05-27T11:35:36-04:00') },
    ];

    it('matches a message to the release commit that most recently preceded it', () => {
      // Posted ~3 min after RiririFRin's commit landed
      const posted = Date.parse('2026-05-27T11:38:00-04:00');
      expect(matchReleaseCommitSha(posted, releaseCommits)).toBe('45760f6');
    });

    it('matches the later message to the later commit (disambiguates duplicate versions)', () => {
      const posted = Date.parse('2026-05-27T22:37:00-04:00');
      expect(matchReleaseCommitSha(posted, releaseCommits)).toBe('b9010c1');
    });

    it('tolerates the message clock being slightly before the commit (small skew)', () => {
      // Message stamped 1 min before the commit time — still the right match
      const posted = Date.parse('2026-05-27T11:34:50-04:00');
      expect(matchReleaseCommitSha(posted, releaseCommits)).toBe('45760f6');
    });

    it('returns null when no release commit is within the lookback window', () => {
      const posted = Date.parse('2026-05-26T08:00:00-04:00'); // before any release commit
      expect(matchReleaseCommitSha(posted, releaseCommits)).toBeNull();
    });

    it('returns null for empty inputs', () => {
      expect(matchReleaseCommitSha(Date.now(), [])).toBeNull();
      expect(matchReleaseCommitSha(Date.now(), null)).toBeNull();
    });
  });

  describe('parseFirstParentLog', () => {
    it('parses sha|iso lines into {sha, timestampMs}', () => {
      const stdout =
        '45760f6|2026-05-27T11:35:36-04:00\n' +
        'b9010c1|2026-05-27T22:35:04-04:00\n';
      expect(parseFirstParentLog(stdout)).toEqual([
        { sha: '45760f6', timestampMs: Date.parse('2026-05-27T11:35:36-04:00') },
        { sha: 'b9010c1', timestampMs: Date.parse('2026-05-27T22:35:04-04:00') },
      ]);
    });

    it('ignores blank lines and trailing whitespace', () => {
      const stdout = '\n45760f6|2026-05-27T11:35:36-04:00\n\n';
      const parsed = parseFirstParentLog(stdout);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].sha).toBe('45760f6');
    });

    it('skips malformed lines (missing date or unparseable timestamp)', () => {
      const stdout = 'deadbeef|not-a-date\nbadline\n45760f6|2026-05-27T11:35:36-04:00\n';
      const parsed = parseFirstParentLog(stdout);
      expect(parsed).toEqual([
        { sha: '45760f6', timestampMs: Date.parse('2026-05-27T11:35:36-04:00') },
      ]);
    });

    it('returns [] for empty or nullish input', () => {
      expect(parseFirstParentLog('')).toEqual([]);
      expect(parseFirstParentLog(null)).toEqual([]);
    });
  });
});
