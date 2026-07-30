// R-8 / R-39 (Phase D) — the generic monochrome slot glyph.
//
// R-8 splits the old coloured letter square (slot AND status AND floor in one
// 16px element) so each element says one thing. These tests pin the two
// properties that make it "an icon, not a status": it carries no colour of its
// own, and it is decorative by default because R-39 always renders it beside
// the slot name.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { GearSlotIcon } from './GearSlotIcon';
import { GEAR_SLOT_ICONS } from '../../types';

describe('GearSlotIcon', () => {
  it('is decorative by default — R-39 renders it next to the slot name', () => {
    const { container } = render(<GearSlotIcon slot="head" />);
    const el = container.querySelector('span');

    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(el?.getAttribute('role')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('takes an accessible name when it stands alone', () => {
    render(<GearSlotIcon slot="head" label="Head" />);
    expect(screen.getByRole('img', { name: 'Head' })).toBeTruthy();
  });

  it('label={true} uses the slot display name', () => {
    render(<GearSlotIcon slot="bracelet" label />);
    // GEAR_SLOT_NAMES.bracelet is "Wrists", not "Bracelet".
    expect(screen.getByRole('img', { name: 'Wrists' })).toBeTruthy();
  });

  it('maps the loot-log-only "ring" value to the shared ring art', () => {
    // `LootSlot` includes a bare 'ring' with no GEAR_SLOT_ICONS entry of its
    // own; without the mapping this would render `url(undefined)`.
    const { container } = render(<GearSlotIcon slot="ring" />);
    const style = container.querySelector('span')?.getAttribute('style') ?? '';

    expect(style).toContain(GEAR_SLOT_ICONS.ring1);
    expect(style).not.toContain('undefined');
  });

  it('label={true} reads "Ring" for the bare loot slot', () => {
    render(<GearSlotIcon slot="ring" label />);
    expect(screen.getByRole('img', { name: 'Ring' })).toBeTruthy();
  });

  it('carries no colour of its own — it inherits currentColor', () => {
    const { container } = render(<GearSlotIcon slot="weapon" />);
    const el = container.querySelector('span');

    expect(el?.className).toContain('bg-current');
    // No hardcoded colour anywhere in the inline style (R-45 / DoD 5).
    expect(el?.getAttribute('style') ?? '').not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });

  it('honours a custom size', () => {
    const { container } = render(<GearSlotIcon slot="feet" size={24} />);
    const style = container.querySelector('span')?.getAttribute('style') ?? '';

    expect(style).toContain('width: 24px');
    expect(style).toContain('height: 24px');
  });
});
