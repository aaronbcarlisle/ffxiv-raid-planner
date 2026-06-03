import { describe, it, expect } from 'vitest';
import { extractCommitSha, authorNeedsUpdate } from './rewrite-changelog-authors.js';

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
});
