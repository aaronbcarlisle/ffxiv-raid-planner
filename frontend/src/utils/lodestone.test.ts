import { describe, expect, it } from 'vitest';
import { parseLodestoneCharacterId } from './lodestone';

describe('parseLodestoneCharacterId', () => {
  it('accepts a bare numeric character ID', () => {
    expect(parseLodestoneCharacterId('12345678')).toBe(12345678);
    expect(parseLodestoneCharacterId('  12345678  ')).toBe(12345678);
  });

  it('accepts Lodestone character URLs on regional subdomains', () => {
    expect(parseLodestoneCharacterId('https://na.finalfantasyxiv.com/lodestone/character/12345678/')).toBe(12345678);
    expect(parseLodestoneCharacterId('https://eu.finalfantasyxiv.com/lodestone/character/98765/')).toBe(98765);
    expect(parseLodestoneCharacterId('https://jp.finalfantasyxiv.com/lodestone/character/42')).toBe(42);
  });

  it('accepts the bare finalfantasyxiv.com domain', () => {
    expect(parseLodestoneCharacterId('https://finalfantasyxiv.com/lodestone/character/12345678/')).toBe(12345678);
  });

  it('rejects hostnames that merely end with the domain string', () => {
    expect(parseLodestoneCharacterId('https://evilfinalfantasyxiv.com/lodestone/character/12345678/')).toBeNull();
    expect(parseLodestoneCharacterId('https://notfinalfantasyxiv.com/lodestone/character/12345678/')).toBeNull();
  });

  it('rejects the domain used as a subdomain of another host', () => {
    expect(parseLodestoneCharacterId('https://finalfantasyxiv.com.attacker.example/lodestone/character/12345678/')).toBeNull();
  });

  it('rejects unrelated hosts and malformed paths', () => {
    expect(parseLodestoneCharacterId('https://example.com/lodestone/character/12345678/')).toBeNull();
    expect(parseLodestoneCharacterId('https://na.finalfantasyxiv.com/lodestone/free-company/123/')).toBeNull();
    expect(parseLodestoneCharacterId('not a url or id')).toBeNull();
  });
});
