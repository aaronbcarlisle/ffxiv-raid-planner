import { describe, it, expect } from 'vitest';
import {
  MAX_BYTES,
  isShot,
  parseExceptions,
  findOversized,
  formatReport,
} from './check-pr-shots.mjs';

const KB = 1024;

describe('isShot', () => {
  it('matches images under the pr-shots directory', () => {
    expect(isShot('docs/redesign/pr-shots/d7a-toolbar-reset-menu-dark.png')).toBe(true);
    expect(isShot('docs/redesign/pr-shots/d8-thing.webp')).toBe(true);
  });

  it('accepts Windows-style separators — git and the shell disagree on these', () => {
    expect(isShot('docs\\redesign\\pr-shots\\d7a-viewer.png')).toBe(true);
  });

  it('ignores non-images and images outside the directory', () => {
    expect(isShot('docs/redesign/pr-shots/.size-exceptions')).toBe(false);
    expect(isShot('docs/redesign/pr-shots/README.md')).toBe(false);
    expect(isShot('frontend/public/images/raid-tiers/aac-heavyweight.png')).toBe(false);
    // A sibling directory whose name merely starts the same way must not match.
    expect(isShot('docs/redesign/pr-shots-archive/old.png')).toBe(false);
  });
});

describe('parseExceptions', () => {
  it('reads one filename per line, ignoring comments and blanks', () => {
    const set = parseExceptions(`
      # a shot that genuinely needs the detail
      f6d-history-light.png

      c5-nowvsbis-hover-dark.png  # inline comment
    `);
    expect(set).toEqual(new Set(['f6d-history-light.png', 'c5-nowvsbis-hover-dark.png']));
  });

  it('reduces full paths to bare filenames so path spelling cannot defeat an exemption', () => {
    expect(parseExceptions('docs/redesign/pr-shots/big.png')).toEqual(new Set(['big.png']));
  });

  it('returns an empty set for empty input', () => {
    expect(parseExceptions('')).toEqual(new Set());
  });
});

describe('findOversized', () => {
  const entries = [
    { path: 'docs/redesign/pr-shots/small.webp', bytes: 15 * KB },
    { path: 'docs/redesign/pr-shots/huge.png', bytes: 240 * KB },
    { path: 'docs/redesign/pr-shots/big.png', bytes: 143 * KB },
  ];

  it('flags only files over the budget, largest first', () => {
    expect(findOversized(entries).map((o) => o.path)).toEqual([
      'docs/redesign/pr-shots/huge.png',
      'docs/redesign/pr-shots/big.png',
    ]);
  });

  it('treats the budget as exclusive — exactly at the limit passes', () => {
    expect(findOversized([{ path: 'a/at-limit.png', bytes: MAX_BYTES }])).toEqual([]);
    expect(findOversized([{ path: 'a/over.png', bytes: MAX_BYTES + 1 }])).toHaveLength(1);
  });

  it('honours the exception list by filename', () => {
    const exceptions = new Set(['huge.png']);
    expect(findOversized(entries, { exceptions }).map((o) => o.path)).toEqual([
      'docs/redesign/pr-shots/big.png',
    ]);
  });

  it('would have caught the D7a screenshots that prompted this check', () => {
    // Real sizes from the 11 shots committed in #257, all 1680x1050 PNGs.
    const d7a = [225, 239, 212, 144, 222, 224, 144, 229, 237, 203, 143].map((n, i) => ({
      path: `docs/redesign/pr-shots/d7a-${i}.png`,
      bytes: n * KB,
    }));
    expect(findOversized(d7a)).toHaveLength(11);
  });

  it('passes the same shots once converted to 900px WebP', () => {
    // Median 14.7 KB, worst case 50.8 KB measured across all 160 existing shots.
    const converted = [15, 16, 14, 51, 22].map((n, i) => ({
      path: `docs/redesign/pr-shots/d7a-${i}.webp`,
      bytes: n * KB,
    }));
    expect(findOversized(converted)).toEqual([]);
  });

  it('returns nothing for an empty change set', () => {
    expect(findOversized([])).toEqual([]);
  });
});

describe('formatReport', () => {
  it('names the offenders and gives a runnable fix command', () => {
    const report = formatReport([{ path: 'docs/redesign/pr-shots/huge.png', bytes: 240 * KB }]);
    expect(report).toContain('1 screenshot over the 120 KB budget');
    expect(report).toContain('240 KB');
    expect(report).toContain('python scripts/shrink-pr-shots.py docs/redesign/pr-shots/huge.png');
    expect(report).toContain('.size-exceptions');
  });

  it('pluralises correctly for multiple offenders', () => {
    const report = formatReport([
      { path: 'a/one.png', bytes: 200 * KB },
      { path: 'a/two.png', bytes: 200 * KB },
    ]);
    expect(report).toContain('2 screenshots over');
  });
});
