import { describe, it, expect } from 'vitest';
import { buildBisUrl, bisLinkTooltip } from './bisLinkMeta';

// C5 (D-09): the BiS-link affordance's URL + tooltip builders, forked from the
// byte-frozen legacy PlayerCardStatus. These tests pin the legacy behavior for
// every bisLink format the app stores.

describe('buildBisUrl', () => {
  it('passes full URLs through unchanged', () => {
    expect(buildBisUrl('https://etro.gg/gearset/abc-123')).toBe('https://etro.gg/gearset/abc-123');
    expect(buildBisUrl('https://xivgear.app/?page=sl|xyz')).toBe('https://xivgear.app/?page=sl|xyz');
  });

  it('only passes through real http(s) schemes (PR #193 review round 5)', () => {
    expect(buildBisUrl('http://etro.gg/gearset/abc')).toBe('http://etro.gg/gearset/abc');
    // A bare id that merely starts with "http" is an Etro gearset id, not a URL —
    // passing it through would emit a same-origin relative href on an external link.
    expect(buildBisUrl('httpfoo')).toBe('https://etro.gg/gearset/httpfoo');
    expect(buildBisUrl('http:abc')).toBe('https://etro.gg/gearset/http:abc');
  });

  it('builds a selectedIndex URL for 4-part GitHub presets (bis|job|tier|index)', () => {
    expect(buildBisUrl('bis|sge|current|2')).toBe(
      'https://xivgear.app/?page=bis|sge|current&selectedIndex=2'
    );
  });

  it('drops a non-numeric preset index but keeps the page path', () => {
    expect(buildBisUrl('bis|sge|current|x')).toBe('https://xivgear.app/?page=bis|sge|current');
  });

  it('treats a 3-part bis| link as a plain xivgear page', () => {
    expect(buildBisUrl('bis|sge|current')).toBe('https://xivgear.app/?page=bis|sge|current');
  });

  it('builds selectedIndex URLs for shortlinks, including index 0', () => {
    expect(buildBisUrl('sl|uuid-123|2')).toBe('https://xivgear.app/?page=sl|uuid-123&selectedIndex=2');
    expect(buildBisUrl('sl|uuid-123|0')).toBe('https://xivgear.app/?page=sl|uuid-123&selectedIndex=0');
  });

  it('omits selectedIndex for shortlinks without a numeric set index', () => {
    expect(buildBisUrl('sl|uuid-123')).toBe('https://xivgear.app/?page=sl|uuid-123');
    expect(buildBisUrl('sl|uuid-123|bad')).toBe('https://xivgear.app/?page=sl|uuid-123');
  });

  it('routes any other piped value to xivgear as-is', () => {
    expect(buildBisUrl('weird|thing')).toBe('https://xivgear.app/?page=weird|thing');
  });

  it('treats a bare value as an Etro gearset id', () => {
    expect(buildBisUrl('abcd-1234')).toBe('https://etro.gg/gearset/abcd-1234');
  });
});

describe('bisLinkTooltip', () => {
  it('names the source for full URLs', () => {
    expect(bisLinkTooltip('https://etro.gg/gearset/abc')).toBe('Open in Etro');
    expect(bisLinkTooltip('https://xivgear.app/?page=x')).toBe('Open in XIVGear');
    expect(bisLinkTooltip('https://example.com/set')).toBe('Open BiS link');
  });

  it('labels shortlink presets as curated', () => {
    expect(bisLinkTooltip('sl|uuid-123')).toBe('Open curated BiS in XIVGear');
  });

  it('maps GitHub-preset tier codes to display names', () => {
    expect(bisLinkTooltip('bis|sge|current|1')).toBe('Open Savage BiS in XIVGear');
    expect(bisLinkTooltip('bis|sge|fru|0')).toBe('Open FRU BiS in XIVGear');
    expect(bisLinkTooltip('bis|sge|zz|0')).toBe('Open ZZ BiS in XIVGear');
    expect(bisLinkTooltip('bis|x')).toBe('Open curated BiS in XIVGear');
  });

  it('falls back to Etro for bare gearset ids', () => {
    expect(bisLinkTooltip('abcd-1234')).toBe('Open in Etro');
  });

  it('treats an "http"-prefixed non-URL as a gearset id, matching buildBisUrl (round 5)', () => {
    expect(bisLinkTooltip('httpfoo')).toBe('Open in Etro');
  });
});
