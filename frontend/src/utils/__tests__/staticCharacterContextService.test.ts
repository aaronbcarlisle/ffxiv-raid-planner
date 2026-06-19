import { describe, it, expect } from 'vitest';
import {
  getPrimaryRegistration,
  getMainRegistrations,
  getAltRegistrations,
  formatCharacterLabel,
  getRegistrationForJob,
  playerHasMainRole,
} from '../staticCharacterContextService';
import type { StaticCharacterRegistration } from '../../types';

function makeReg(overrides: Partial<StaticCharacterRegistration>): StaticCharacterRegistration {
  return {
    id: 'reg-1',
    staticGroupId: 'group-1',
    snapshotPlayerId: 'player-1',
    roleInStatic: 'alt',
    isPrimaryForStatic: false,
    source: 'manual',
    manualCharacterName: null,
    resolvedName: null,
    job: null,
    lastSyncedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('getPrimaryRegistration', () => {
  it('returns null for empty array', () => {
    expect(getPrimaryRegistration([])).toBeNull();
  });

  it('returns the registration with isPrimaryForStatic=true', () => {
    const primary = makeReg({ id: 'primary', isPrimaryForStatic: true });
    const alt = makeReg({ id: 'alt', isPrimaryForStatic: false });
    expect(getPrimaryRegistration([alt, primary])?.id).toBe('primary');
  });

  it('falls back to first registration when none is primary', () => {
    const first = makeReg({ id: 'first' });
    const second = makeReg({ id: 'second' });
    expect(getPrimaryRegistration([first, second])?.id).toBe('first');
  });
});

describe('getMainRegistrations', () => {
  it('filters by roleInStatic=main', () => {
    const main = makeReg({ id: 'main', roleInStatic: 'main' });
    const alt = makeReg({ id: 'alt', roleInStatic: 'alt' });
    const regs = getMainRegistrations([main, alt]);
    expect(regs).toHaveLength(1);
    expect(regs[0].id).toBe('main');
  });
});

describe('getAltRegistrations', () => {
  it('filters by roleInStatic=alt', () => {
    const main = makeReg({ id: 'main', roleInStatic: 'main' });
    const alt = makeReg({ id: 'alt', roleInStatic: 'alt' });
    const regs = getAltRegistrations([main, alt]);
    expect(regs).toHaveLength(1);
    expect(regs[0].id).toBe('alt');
  });
});

describe('formatCharacterLabel', () => {
  it('uses resolvedName when present', () => {
    const reg = makeReg({ resolvedName: "R'in Ivalice", manualCharacterName: 'Fallback' });
    expect(formatCharacterLabel(reg)).toContain("R'in");
  });

  it('falls back to manualCharacterName', () => {
    const reg = makeReg({ resolvedName: null, manualCharacterName: 'Manual Name' });
    expect(formatCharacterLabel(reg)).toContain('Manual Name');
  });

  it('returns fallback string when no name available', () => {
    const reg = makeReg({ resolvedName: null, manualCharacterName: null });
    // The function returns '(unknown)' as the fallback
    expect(formatCharacterLabel(reg)).toBeTruthy();
    expect(formatCharacterLabel(reg)).not.toBe('');
  });
});

describe('getRegistrationForJob', () => {
  it('returns registration with matching job', () => {
    const drg = makeReg({ id: 'drg', job: 'DRG' });
    const nin = makeReg({ id: 'nin', job: 'NIN' });
    expect(getRegistrationForJob([drg, nin], 'DRG')?.id).toBe('drg');
  });

  it('falls back to primary when no matching job', () => {
    const drg = makeReg({ id: 'drg', job: 'DRG', isPrimaryForStatic: true });
    // No WHM in array — should fall back to primary (drg)
    expect(getRegistrationForJob([drg], 'WHM')?.id).toBe('drg');
  });

  it('returns null for empty array', () => {
    expect(getRegistrationForJob([], 'DRG')).toBeNull();
  });
});

describe('playerHasMainRole', () => {
  it('returns true when player has a main registration', () => {
    const main = makeReg({ id: 'main', roleInStatic: 'main' });
    const alt = makeReg({ id: 'alt', roleInStatic: 'alt' });
    const regsMap = { 'player-1': [main, alt] };
    expect(playerHasMainRole('player-1', regsMap)).toBe(true);
  });

  it('returns false when player has no main registration', () => {
    const alt = makeReg({ id: 'alt', roleInStatic: 'alt' });
    expect(playerHasMainRole('player-1', { 'player-1': [alt] })).toBe(false);
  });

  it('returns false for unknown playerId', () => {
    expect(playerHasMainRole('unknown', {})).toBe(false);
  });
});
