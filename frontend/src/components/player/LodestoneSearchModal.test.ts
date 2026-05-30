import { describe, expect, it } from 'vitest';
import { parseLodestoneCharacterId } from '../../utils/lodestone';

describe('parseLodestoneCharacterId', () => {
  it('extracts the ID from a full Lodestone URL', () => {
    expect(
      parseLodestoneCharacterId('https://na.finalfantasyxiv.com/lodestone/character/12345678/')
    ).toBe(12345678);
  });

  it('accepts a numeric character ID', () => {
    expect(parseLodestoneCharacterId('12345678')).toBe(12345678);
  });

  it('rejects invalid input', () => {
    expect(parseLodestoneCharacterId('https://example.com/nope/12345678')).toBeNull();
    expect(parseLodestoneCharacterId('https://example.com/lodestone/character/12345678/')).toBeNull();
    expect(parseLodestoneCharacterId('not a lodestone url')).toBeNull();
  });
});
