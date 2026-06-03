/**
 * Tests for FFXIV world/DC data and utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  DATA_CENTERS,
  DC_NAMES,
  getWorldsForDC,
  getDCForWorld,
  TIMEZONES,
  LANGUAGES,
  RAID_DAYS,
  TIME_SLOTS,
} from './worlds';

describe('DATA_CENTERS', () => {
  it('contains at least 11 data centers', () => {
    expect(DATA_CENTERS.length).toBeGreaterThanOrEqual(11);
  });

  it('each DC has a name, region, and at least one world', () => {
    for (const dc of DATA_CENTERS) {
      expect(dc.name).toBeTruthy();
      expect(dc.region).toBeTruthy();
      expect(dc.worlds.length).toBeGreaterThan(0);
    }
  });

  it('includes major DCs from each region', () => {
    const names = DC_NAMES;
    expect(names).toContain('Aether');
    expect(names).toContain('Primal');
    expect(names).toContain('Crystal');
    expect(names).toContain('Dynamis');
    expect(names).toContain('Chaos');
    expect(names).toContain('Light');
    expect(names).toContain('Elemental');
    expect(names).toContain('Gaia');
    expect(names).toContain('Mana');
    expect(names).toContain('Meteor');
    expect(names).toContain('Materia');
  });
});

describe('getWorldsForDC', () => {
  it('returns worlds for a valid DC', () => {
    const worlds = getWorldsForDC('Aether');
    expect(worlds).toContain('Jenova');
    expect(worlds).toContain('Gilgamesh');
    expect(worlds.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown DC', () => {
    expect(getWorldsForDC('NonexistentDC')).toEqual([]);
  });
});

describe('getDCForWorld', () => {
  it('finds DC for a known world', () => {
    expect(getDCForWorld('Jenova')).toBe('Aether');
    expect(getDCForWorld('Tonberry')).toBe('Elemental');
    expect(getDCForWorld('Moogle')).toBe('Chaos');
  });

  it('is case-insensitive', () => {
    expect(getDCForWorld('jenova')).toBe('Aether');
    expect(getDCForWorld('TONBERRY')).toBe('Elemental');
  });

  it('returns null for unknown world', () => {
    expect(getDCForWorld('UnknownWorld')).toBeNull();
  });
});

describe('TIMEZONES', () => {
  it('contains common timezones', () => {
    const values = TIMEZONES.map(t => t.value);
    expect(values).toContain('Asia/Tokyo');
    expect(values).toContain('America/New_York');
    expect(values).toContain('Europe/London');
    expect(values).toContain('UTC');
  });

  it('each timezone has value and label', () => {
    for (const tz of TIMEZONES) {
      expect(tz.value).toBeTruthy();
      expect(tz.label).toBeTruthy();
    }
  });
});

describe('LANGUAGES', () => {
  it('contains major FFXIV languages', () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('ja');
    expect(codes).toContain('de');
    expect(codes).toContain('fr');
  });

  it('each language has code and label', () => {
    for (const l of LANGUAGES) {
      expect(l.code).toBeTruthy();
      expect(l.label).toBeTruthy();
    }
  });
});

describe('RAID_DAYS', () => {
  it('contains all 7 days', () => {
    expect(RAID_DAYS).toHaveLength(7);
    expect(RAID_DAYS[0]).toBe('Monday');
    expect(RAID_DAYS[6]).toBe('Sunday');
  });
});

describe('TIME_SLOTS', () => {
  it('has 48 slots (24 hours x 2)', () => {
    expect(TIME_SLOTS).toHaveLength(48);
  });

  it('starts at 00:00 and ends at 23:30', () => {
    expect(TIME_SLOTS[0]).toBe('00:00');
    expect(TIME_SLOTS[TIME_SLOTS.length - 1]).toBe('23:30');
  });
});
