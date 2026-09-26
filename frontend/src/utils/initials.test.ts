import { describe, expect, it } from 'vitest';
import { getInitials } from './initials';

describe('getInitials', () => {
  it.each([
    ['Weeknight Static', 'WS'],
    ['the late night crew', 'TL'],
    ['Lady   of Light', 'LO'],
    ['Aether', 'AE'],
    ['x', 'X'],
    ['', ''],
  ])('%j → %j', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});
