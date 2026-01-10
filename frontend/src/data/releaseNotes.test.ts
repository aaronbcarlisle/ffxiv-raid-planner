/**
 * Unit tests for release notes utilities
 */

import { describe, it, expect } from 'vitest';
import {
  CURRENT_VERSION,
  RELEASES,
  getLatestRelease,
  isNewerVersion,
  type ReleaseCategory,
} from './releaseNotes';

describe('releaseNotes', () => {
  describe('CURRENT_VERSION', () => {
    it('is a valid semver string', () => {
      expect(CURRENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('matches the latest release version', () => {
      const latest = getLatestRelease();
      expect(CURRENT_VERSION).toBe(latest?.version);
    });
  });

  describe('RELEASES', () => {
    it('is an array of releases', () => {
      expect(Array.isArray(RELEASES)).toBe(true);
      expect(RELEASES.length).toBeGreaterThan(0);
    });

    it('releases are ordered newest-first', () => {
      for (let i = 1; i < RELEASES.length; i++) {
        const current = RELEASES[i - 1];
        const previous = RELEASES[i];
        // Newer version should have higher major.minor.patch
        const currentParts = current.version.split('.').map(Number);
        const previousParts = previous.version.split('.').map(Number);

        // Compare version numbers
        const currentValue =
          currentParts[0] * 10000 + currentParts[1] * 100 + currentParts[2];
        const previousValue =
          previousParts[0] * 10000 + previousParts[1] * 100 + previousParts[2];

        expect(currentValue).toBeGreaterThanOrEqual(previousValue);
      }
    });

    it('each release has required fields', () => {
      RELEASES.forEach((release) => {
        expect(release.version).toBeDefined();
        expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(release.date).toBeDefined();
        expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Array.isArray(release.items)).toBe(true);
      });
    });

    it('each release item has required fields', () => {
      RELEASES.forEach((release) => {
        release.items.forEach((item) => {
          expect(item.category).toBeDefined();
          expect(['feature', 'fix', 'improvement', 'breaking']).toContain(
            item.category
          );
          expect(item.title).toBeDefined();
          expect(typeof item.title).toBe('string');
        });
      });
    });

    it('highlights array contains 1-2 items when present', () => {
      RELEASES.forEach((release) => {
        if (release.highlights) {
          expect(release.highlights.length).toBeGreaterThanOrEqual(1);
          expect(release.highlights.length).toBeLessThanOrEqual(2);
        }
      });
    });
  });

  describe('getLatestRelease', () => {
    it('returns the first release in the array', () => {
      const latest = getLatestRelease();
      expect(latest).toBe(RELEASES[0]);
    });

    it('returns a valid release object', () => {
      const latest = getLatestRelease();
      expect(latest).toBeDefined();
      expect(latest?.version).toBeDefined();
      expect(latest?.date).toBeDefined();
      expect(latest?.items).toBeDefined();
    });
  });

  describe('isNewerVersion', () => {
    it('returns true when lastSeen is null', () => {
      expect(isNewerVersion('1.0.0', null)).toBe(true);
    });

    it('returns true when current differs from lastSeen', () => {
      expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
      expect(isNewerVersion('2.0.0', '1.0.0')).toBe(true);
      expect(isNewerVersion('1.1.0', '1.0.0')).toBe(true);
    });

    it('returns false when current equals lastSeen', () => {
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
      expect(isNewerVersion('1.0.1', '1.0.1')).toBe(false);
    });

    // Note: This function does simple string comparison, not semantic versioning
    it('uses string equality not semantic comparison', () => {
      // Even though 1.0.0 < 1.0.1 semantically, this returns true
      // because the strings are different
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
    });
  });

  describe('v1.0.2 release', () => {
    const v102 = RELEASES.find((r) => r.version === '1.0.2');

    it('exists in releases', () => {
      expect(v102).toBeDefined();
    });

    it('has UX Improvements title', () => {
      expect(v102?.title).toBe('UX Improvements');
    });

    it('has appropriate highlights', () => {
      expect(v102?.highlights).toContain('Grid view for loot logging');
      expect(v102?.highlights).toContain('Material editing & sub filtering');
    });

    it('has feature items', () => {
      const features = v102?.items.filter((i) => i.category === 'feature');
      expect(features?.length).toBeGreaterThan(0);

      const featureTitles = features?.map((f) => f.title) || [];
      expect(featureTitles).toContain('Weekly Loot Grid view');
      expect(featureTitles).toContain('Unified floor selectors');
      expect(featureTitles).toContain('Smart tab navigation');
      expect(featureTitles).toContain('Dashboard context menus');
      expect(featureTitles).toContain('Release Notes navigation');
    });

    it('has improvement items', () => {
      const improvements = v102?.items.filter(
        (i) => i.category === 'improvement'
      );
      expect(improvements?.length).toBeGreaterThan(0);

      const improvementTitles = improvements?.map((i) => i.title) || [];
      expect(improvementTitles).toContain('Subs toggle styling');
      expect(improvementTitles).toContain('Admin Dashboard improvements');
      expect(improvementTitles).toContain('Accessibility enhancements');
    });

    it('has fix items', () => {
      const fixes = v102?.items.filter((i) => i.category === 'fix');
      expect(fixes?.length).toBeGreaterThan(0);

      const fixTitles = fixes?.map((f) => f.title) || [];
      expect(fixTitles).toContain('Grid context menu permissions');
      expect(fixTitles).toContain('Loot edit gear sync');
      expect(fixTitles).toContain('Grid URL highlight');
      expect(fixTitles).toContain('Layout shift fixes');
    });

    it('all items have descriptions', () => {
      v102?.items.forEach((item) => {
        expect(item.description).toBeDefined();
        expect(typeof item.description).toBe('string');
        expect(item.description!.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Release categories', () => {
  const allCategories = new Set<ReleaseCategory>();

  RELEASES.forEach((release) => {
    release.items.forEach((item) => {
      allCategories.add(item.category);
    });
  });

  it('uses only valid categories', () => {
    const validCategories: ReleaseCategory[] = [
      'feature',
      'fix',
      'improvement',
      'breaking',
    ];
    allCategories.forEach((cat) => {
      expect(validCategories).toContain(cat);
    });
  });

  it('has feature releases', () => {
    expect(allCategories.has('feature')).toBe(true);
  });

  it('has fix releases', () => {
    expect(allCategories.has('fix')).toBe(true);
  });

  it('has improvement releases', () => {
    expect(allCategories.has('improvement')).toBe(true);
  });
});

describe('Release dates', () => {
  it('all dates are valid ISO format', () => {
    RELEASES.forEach((release) => {
      const date = new Date(release.date);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });

  it('dates are not in the future (too far)', () => {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1); // Allow up to 1 year in future

    RELEASES.forEach((release) => {
      const date = new Date(release.date);
      expect(date.getTime()).toBeLessThanOrEqual(maxDate.getTime());
    });
  });
});
