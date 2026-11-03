/**
 * S2a-4a·A3 TA3 — the footer line under the matrix (R-F-7; design §3.4, D-4).
 *
 * `FindFooter({ item, names, onFind })`, given the top untracked wanted item (`topWanted`):
 * - `<p className="text-xs text-text-secondary">` "{A} and {B} want {farm}"; "{A} wants {farm}"
 *   for one wanter; past two it names two and adds "and {k} more";
 * - names come from the roster `names` map, "A member" for anyone not in it, never the join's
 *   Discord name (S-2);
 * - then " · " and a `LinkText` "Find" whose accessible name is "Find {farm}", which calls `onFind`.
 *
 * The page's half (the URL, the expanded row and the focus) is `ProgressPage.findActions.test.tsx`'s.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberSuggestionEntry } from '../../stores/collectionIntentStore';
import type { FindItem } from '../../utils/findModel';
import { FindFooter } from './FindFooter';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';

// ── Fixtures ────────────────────────────────────────────────────────────────

const FARM = 'Lynx of Righteous Fire';

function wanter(userId: string): Omit<MemberSuggestionEntry, 'displayName'> {
  return { userId, ownershipState: 'missing', intent: 'hunting', tokenCount: 3, canBuy: false, confidence: 'high', reasons: [] };
}

function item(wantedBy: string[], over: Partial<FindItem> = {}): FindItem {
  return {
    id: 'cat-lynx',
    name: FARM,
    category: 'mount',
    sourceType: 'extreme',
    duty: 'Worqor Lar Dor (Extreme)',
    expansion: 'dt',
    token: { name: 'Valigarmanda Totem', cost: 99 },
    pluginReady: false,
    members: wantedBy.map(wanter),
    wantedBy,
    tracking: null,
    trackable: true,
    ...over,
  };
}

const NAMES = new Map<string, string>([
  ['u1', 'Aya'],
  ['u2', 'Bo'],
  ['u3', 'Cy'],
  ['u4', 'Di'],
  ['u5', 'Ŝéra «Ω» "q" $1 $&'],
]);

function renderFooter(it: FindItem, names = NAMES) {
  const onFind = vi.fn();
  const view = render(
    <MemoryRouter initialEntries={['/?tab=progress']}>
      <FindFooter item={it} names={names} onFind={onFind} />
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
  return { ...view, onFind };
}

/** `LinkText` with an action renders a button; a link would do as well. */
const findLink = (farm = FARM) =>
  screen.queryByRole('button', { name: `Find ${farm}` }) ?? screen.getByRole('link', { name: `Find ${farm}` });

/** The footer's paragraph (the only one rendered). */
function line(): HTMLElement {
  const p = document.body.querySelector('p');
  expect(p).not.toBeNull();
  return p as HTMLElement;
}
const lineText = () => (line().textContent ?? '').replace(/\s+/g, ' ').trim();
/** The sentence alone, without the " · Find" tail (whether or not the link sits inside the paragraph). */
const sentence = () => lineText().replace(/\s*·\s*Find$/, '');

beforeEach(() => {
  stubCanHover();
});

// ── Wording ─────────────────────────────────────────────────────────────────

describe('the wording (§3.4)', () => {
  it('two wanters: "{A} and {B} want {farm}", with roster names', () => {
    renderFooter(item(['u1', 'u2']));
    expect(sentence()).toBe(`Aya and Bo want ${FARM}`);
  });

  it('one wanter: "{A} wants {farm}"', () => {
    renderFooter(item(['u1']));
    expect(sentence()).toBe(`Aya wants ${FARM}`);
  });

  it('three wanters: names two, then "and 1 more", and the verb is "want"', () => {
    renderFooter(item(['u1', 'u2', 'u3']));
    const text = sentence();
    expect(text).toMatch(/^Aya\b/);
    expect(text).toContain('Bo');
    expect(text).not.toContain('Cy');
    expect(text).toMatch(new RegExp(`and 1 more want ${FARM}$`));
  });

  it('four wanters: "and 2 more"', () => {
    renderFooter(item(['u1', 'u2', 'u3', 'u4']));
    const text = sentence();
    expect(text).not.toMatch(/Cy|Di/);
    expect(text).toMatch(new RegExp(`and 2 more want ${FARM}$`));
  });

  it('someone not in the roster names is "A member", never the join\'s Discord name', () => {
    renderFooter(item(['u1', 'u9']));
    expect(sentence()).toBe(`Aya and A member want ${FARM}`);
    expect(document.body.textContent).not.toMatch(/discord-/);
  });

  it('keeps quotes, $ and unicode in a name and in the farm literally', () => {
    const farm = 'Wings «Ω» "q" $1 … \\u00e9';
    renderFooter(item(['u5'], { name: farm }));
    expect(findLink(farm)).toBeInTheDocument();
    expect(sentence()).toBe(`Ŝéra «Ω» "q" $1 $& wants ${farm}`);
  });

  it('is a text-xs text-text-secondary paragraph, then " · " and the Find link', () => {
    const { container } = renderFooter(item(['u1', 'u2']));
    expect(line()).toHaveClass('text-xs', 'text-text-secondary');
    expect((container.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe(`Aya and Bo want ${FARM} · Find`);
  });
});

// ── The link ────────────────────────────────────────────────────────────────

describe('the Find link', () => {
  it('reads "Find" with the accessible name "Find {farm}", and one press calls onFind once', () => {
    const { onFind } = renderFooter(item(['u1', 'u2']));
    const link = findLink();
    expect(link).toHaveTextContent(/^Find$/);
    fireEvent.click(link);
    expect(onFind).toHaveBeenCalledTimes(1);
  });
});
