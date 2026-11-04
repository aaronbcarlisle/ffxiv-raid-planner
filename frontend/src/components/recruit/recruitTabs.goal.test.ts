/**
 * `goal` is a one-shot arrival param of the static route: `withCarriedParams`
 * must never carry it onto another URL (C2b review), or a held View As read lets
 * `goal=objectives` ride Recruit and back to the static route on a Spine tab change.
 */
import { describe, it, expect } from 'vitest';
import { recruitUrl, withCarriedParams } from './recruitTabs';

describe('withCarriedParams — goal is not carried', () => {
  it.each(['objectives', 'farms'])('drops goal=%s and keeps viewAs, adminMode and tier', (goal) => {
    const search = `?goal=${goal}&viewAs=u2&adminMode=1&tier=t1`;

    const toRecruit = withCarriedParams(recruitUrl('abc', 'listing'), search);
    const recruit = new URLSearchParams(toRecruit.split('?')[1]);
    expect(toRecruit.startsWith('/group/abc/recruit?')).toBe(true);
    expect(recruit.has('goal')).toBe(false);
    expect(recruit.get('rtab')).toBe('listing');
    expect(recruit.get('viewAs')).toBe('u2');
    expect(recruit.get('adminMode')).toBe('1');
    expect(recruit.get('tier')).toBe('t1');

    const toGroup = withCarriedParams('/group/abc?tab=overview', search);
    const group = new URLSearchParams(toGroup.split('?')[1]);
    expect(toGroup.startsWith('/group/abc?')).toBe(true);
    expect(group.has('goal')).toBe(false);
    expect(group.get('tab')).toBe('overview');
    expect(group.get('viewAs')).toBe('u2');
    expect(group.get('adminMode')).toBe('1');
    expect(group.get('tier')).toBe('t1');
  });
});
