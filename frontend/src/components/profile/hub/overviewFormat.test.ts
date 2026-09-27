import { describe, expect, it } from 'vitest';
import { formatSessionStart } from './overviewFormat';

// Intl time strings contain U+202F (narrow no-break space) between the time
// and its AM/PM marker in some locales/runtimes; normalize by code point
// before comparing (reference_intl_narrow_nbsp). Written via codePointAt,
// never a literal escape in source, so no stray byte can sneak back in.
const NARROW_NBSP = 0x202f;
const NBSP = 0x00a0;

function normalize(s: string): string {
  return Array.from(s)
    .map((ch) => {
      const code = ch.codePointAt(0);
      return code === NARROW_NBSP || code === NBSP ? ' ' : ch;
    })
    .join('');
}

describe('formatSessionStart', () => {
  it('formats against the same Intl options used by the callers', () => {
    const iso = '2026-10-03T18:30:00Z';
    const expected = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));

    expect(normalize(formatSessionStart(iso))).toBe(normalize(expected));
  });
});
