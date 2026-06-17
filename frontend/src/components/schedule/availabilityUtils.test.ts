import { describe, expect, it } from 'vitest';
import {
  getAvailabilitySlotKeyForPresetColumn,
  getNextAvailabilityColumn,
  isAfterMidnightPresetSlot,
} from './availabilityUtils';

describe('availability preset slot mapping', () => {
  it('maps prime after-midnight weekday slots to the next day', () => {
    expect(getAvailabilitySlotKeyForPresetColumn('MO', '23:30', 'prime')).toBe('MO|23:30');
    expect(getAvailabilitySlotKeyForPresetColumn('MO', '00:00', 'prime')).toBe('TU|00:00');
    expect(getAvailabilitySlotKeyForPresetColumn('SU', '01:30', 'prime')).toBe('MO|01:30');
  });

  it('maps prime after-midnight date slots to the next calendar date', () => {
    expect(getAvailabilitySlotKeyForPresetColumn('2026-06-18', '23:30', 'prime')).toBe('2026-06-18|23:30');
    expect(getAvailabilitySlotKeyForPresetColumn('2026-06-18', '00:00', 'prime')).toBe('2026-06-19|00:00');
  });

  it('does not shift non-cross-midnight presets', () => {
    expect(getAvailabilitySlotKeyForPresetColumn('MO', '00:00', 'full')).toBe('MO|00:00');
    expect(getAvailabilitySlotKeyForPresetColumn('MO', '18:00', 'evening')).toBe('MO|18:00');
  });

  it('identifies only the cross-midnight part of the prime preset', () => {
    expect(isAfterMidnightPresetSlot('00:00', 'prime')).toBe(true);
    expect(isAfterMidnightPresetSlot('01:30', 'prime')).toBe(true);
    expect(isAfterMidnightPresetSlot('18:00', 'prime')).toBe(false);
    expect(isAfterMidnightPresetSlot('00:00', 'full')).toBe(false);
  });

  it('supports weekday and date next-column calculation', () => {
    expect(getNextAvailabilityColumn('FR')).toBe('SA');
    expect(getNextAvailabilityColumn('2026-06-18')).toBe('2026-06-19');
  });
});
