/**
 * recruitTabs — the Recruiting route's URL builder and the dock-section map (R-RH-H).
 */
import { describe, it, expect } from 'vitest';
import {
  RECRUIT_SECTION_MAP,
  RECRUIT_TAB_VALUES,
  recruitTabForSection,
  recruitUrl,
  recruitUrlForOpen,
  withCarriedParams,
} from './recruitTabs';

describe('recruitUrl', () => {
  it('bare: the route with no query', () => {
    expect(recruitUrl('abc')).toBe('/group/abc/recruit');
  });

  it('applicants is the default tab and is omitted from the URL', () => {
    expect(recruitUrl('abc', 'applicants')).toBe('/group/abc/recruit');
  });

  it('listing → ?rtab=listing', () => {
    expect(recruitUrl('abc', 'listing')).toBe('/group/abc/recruit?rtab=listing');
  });

  it('invites + create + tier → ?rtab=invites&create=1&tier=t1', () => {
    expect(recruitUrl('abc', 'invites', { create: true, tier: 't1' })).toBe(
      '/group/abc/recruit?rtab=invites&create=1&tier=t1',
    );
  });

  it('a null tier and create:false add nothing', () => {
    expect(recruitUrl('abc', 'applicants', { create: false, tier: null })).toBe('/group/abc/recruit');
  });
});

describe('RECRUIT_SECTION_MAP', () => {
  it('covers every RecruitmentSection with a RecruitTab', () => {
    expect(RECRUIT_SECTION_MAP).toEqual({
      overview: 'applicants',
      requests: 'applicants',
      listing: 'listing',
      invitations: 'invites',
    });
    for (const tab of Object.values(RECRUIT_SECTION_MAP)) {
      expect(RECRUIT_TAB_VALUES).toContain(tab);
    }
  });

  it.each([
    ['overview', 'applicants'],
    ['requests', 'applicants'],
    ['listing', 'listing'],
    ['invitations', 'invites'],
    ['nonsense', 'applicants'],
    ['constructor', 'applicants'],
    [null, 'applicants'],
    [undefined, 'applicants'],
  ])('recruitTabForSection(%s) → %s', (raw, tab) => {
    expect(recruitTabForSection(raw)).toBe(tab);
  });
});

describe('recruitUrlForOpen', () => {
  it('invitations + highlightCreateInvite + tier → the Invites create form on that tier', () => {
    expect(
      recruitUrlForOpen('abc', { tab: 'recruitment', section: 'invitations', highlightCreateInvite: true }, 't1'),
    ).toBe('/group/abc/recruit?rtab=invites&create=1&tier=t1');
  });

  it('highlightCreateInvite without a section lands on Applicants with no ?create= (the V1 bell toggle)', () => {
    expect(recruitUrlForOpen('abc', { tab: 'recruitment', highlightCreateInvite: true }, null)).toBe(
      '/group/abc/recruit',
    );
  });
});

describe('withCarriedParams', () => {
  it('carries viewAs/adminMode (and any other param) after the URL\'s own params, dropping rtab and create', () => {
    expect(
      withCarriedParams('/group/abc?tab=roster', '?rtab=listing&create=1&tier=t1&viewAs=u2&adminMode=true'),
    ).toBe('/group/abc?tab=roster&tier=t1&viewAs=u2&adminMode=true');
  });

  it('the URL\'s own params win over a carried duplicate', () => {
    expect(withCarriedParams('/group/abc/recruit?rtab=invites&tier=t1', 'tier=t9&adminMode=true')).toBe(
      '/group/abc/recruit?rtab=invites&tier=t1&adminMode=true',
    );
  });

  it('drops the extra keys it is told to (a consumed rcsub)', () => {
    expect(withCarriedParams('/group/abc/recruit?rtab=listing', 'rcsub=listing&adminMode=true', ['rcsub'])).toBe(
      '/group/abc/recruit?rtab=listing&adminMode=true',
    );
  });

  it('a bare URL with nothing to carry stays bare', () => {
    expect(withCarriedParams('/group/abc', '')).toBe('/group/abc');
    expect(withCarriedParams('/group/abc', 'rtab=listing&create=1')).toBe('/group/abc');
  });
});
