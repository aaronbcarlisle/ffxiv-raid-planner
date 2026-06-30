import { describe, it, expect } from 'vitest';
import { pageModeFromTabParam } from './useGroupViewState';

describe('pageModeFromTabParam — legacy ?tab= aliases', () => {
  it.each([
    ['overview','overview'],['roster','roster'],['schedule','schedule'],['goals','goals'],['gear','gear'],['plugin','plugin'],['more','more'],
    ['home','overview'],['players','roster'],
    ['loot','gear'],['priority','gear'],['weapon','gear'],['log','gear'],['history','gear'],['summary','gear'],
    ['mount-farms','goals'],['collections','goals'],
  ] as const)('maps ?tab=%s -> %s', (param, expected) => {
    expect(pageModeFromTabParam(param)).toBe(expected);
  });
  it('returns null for absent / unknown', () => {
    expect(pageModeFromTabParam(null)).toBeNull();
    expect(pageModeFromTabParam('')).toBeNull();
    expect(pageModeFromTabParam('bogus')).toBeNull();
  });
});
