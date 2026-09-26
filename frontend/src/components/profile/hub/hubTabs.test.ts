import { describe, expect, it } from 'vitest';
import { hubTabParams, resolveHubTab } from './hubTabs';

const resolve = (search: string) => resolveHubTab(new URLSearchParams(search));

describe('resolveHubTab', () => {
  it.each([
    ['sync', 'characters'],
    ['jobs-gear', 'characters'],
    ['jobs', 'characters'],
    ['gear', 'characters'],
    ['preview', 'sharing'],
    ['share', 'sharing'],
    ['collections', 'tracking'],
    ['goals', 'tracking'],
    ['statics', 'overview'],
  ])('legacy ?tab=%s lands on %s and asks for a rewrite', (legacy, tab) => {
    expect(resolve(`tab=${legacy}`)).toEqual({ tab, canonical: false });
  });

  it.each(['characters', 'availability', 'tracking', 'sharing'])('canonical ?tab=%s needs no rewrite', (tab) => {
    expect(resolve(`tab=${tab}`)).toEqual({ tab, canonical: true });
  });

  it('no tab is Overview, already canonical', () => {
    expect(resolve('')).toEqual({ tab: 'overview', canonical: true });
    expect(resolve('coll=browse')).toEqual({ tab: 'overview', canonical: true });
  });

  it('an explicit ?tab=overview is rewritten away', () => {
    expect(resolve('tab=overview')).toEqual({ tab: 'overview', canonical: false });
  });

  it('an unknown id lands on Overview and is rewritten', () => {
    expect(resolve('tab=bogus')).toEqual({ tab: 'overview', canonical: false });
    expect(resolve('tab=constructor')).toEqual({ tab: 'overview', canonical: false });
  });

  it('focus=availability wins only when tab is absent', () => {
    expect(resolve('focus=availability')).toEqual({ tab: 'availability', canonical: false });
    expect(resolve('tab=availability&focus=availability')).toEqual({ tab: 'availability', canonical: true });
    expect(resolve('tab=sync&focus=availability')).toEqual({ tab: 'characters', canonical: false });
    expect(resolve('focus=gear')).toEqual({ tab: 'overview', canonical: true });
  });
});

describe('hubTabParams', () => {
  const params = (search: string) => new URLSearchParams(search);

  it('sets tab and keeps unrelated params', () => {
    expect(hubTabParams(params('x=1&focus=gear'), 'tracking', true).toString()).toBe('x=1&focus=gear&tab=tracking');
  });

  it('deletes tab for Overview, keeping unrelated params', () => {
    expect(hubTabParams(params('tab=sharing&x=1'), 'overview', true).toString()).toBe('x=1');
  });

  it('drops a leftover focus=availability only when going to Overview', () => {
    expect(hubTabParams(params('tab=availability&focus=availability'), 'overview', true).toString()).toBe('');
    expect(hubTabParams(params('focus=availability'), 'availability', true).toString())
      .toBe('focus=availability&tab=availability');
    expect(hubTabParams(params('tab=availability&focus=availability'), 'sharing', true).toString())
      .toBe('tab=sharing&focus=availability');
  });

  it('clears registered sub-tab params only when remember is false', () => {
    expect(hubTabParams(params('tab=tracking&coll=browse&x=1'), 'sharing', true).toString())
      .toBe('tab=sharing&coll=browse&x=1');
    expect(hubTabParams(params('tab=tracking&coll=browse&x=1'), 'sharing', false).toString())
      .toBe('tab=sharing&x=1');
  });

  it('does not mutate its input', () => {
    const prev = params('tab=tracking&coll=browse');
    hubTabParams(prev, 'overview', false);
    expect(prev.toString()).toBe('tab=tracking&coll=browse');
  });
});
