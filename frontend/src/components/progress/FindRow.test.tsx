/**
 * S2a-4a·A2b TA2b — a Find row (R-F-5 `FindRow`; design D-10, §3.2; P-58, P-60, P-71, P-75;
 * carried A1-M4, A1-M5).
 *
 * `FindRow({ item, names, expanded, onToggle, action, readerIsViewer })`:
 * - the toggle is an `IconButton` "Show details for {name}" with `aria-expanded` and `aria-controls`;
 * - the collapsed line shows the token as "{cost} {token}" (no count when the cost is 0), the
 *   plugin-ready label tag, and "1 wants" / "{n} want";
 * - the body is `inert` and `hidden` while collapsed; expanded it lists every member's state from
 *   the roster names ("A member" for an unknown one, never the join's Discord name), with counts
 *   hidden from a viewer (P-58) or when `tokenCount` is null;
 * - Tracking ✓ is a nav tag that opens `?track=<id>` in Tracks (P-60), for every reader.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberSuggestionEntry } from '../../stores/collectionIntentStore';
import type { FindItem } from '../../utils/findModel';
import { FindRow } from './FindRow';
import { LocationProbe } from './__fixtures__/LocationProbe';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A join row as the store holds it, Discord name included, so a leak would show. */
function m(
  userId: string,
  intent: MemberSuggestionEntry['intent'],
  ownershipState: MemberSuggestionEntry['ownershipState'],
  tokenCount: number | null,
): MemberSuggestionEntry {
  return {
    userId,
    displayName: `discord-${userId}-handle`,
    ownershipState,
    intent,
    tokenCount,
    canBuy: false,
    confidence: 'high',
    reasons: [],
  };
}

function item(over: Partial<FindItem> = {}): FindItem {
  return {
    id: 'cat-lynx',
    name: 'Lynx of Righteous Fire',
    category: 'mount',
    sourceType: 'extreme',
    duty: 'Worqor Lar Dor (Extreme)',
    expansion: 'dt',
    patch: null,
    token: { name: 'Valigarmanda Totem', cost: 99 },
    pluginReady: true,
    members: [],
    wantedBy: [],
    tracking: null,
    trackable: true,
    ...over,
  };
}

const NAMES = new Map<string, string>([
  ['u1', 'Aya'],
  ['u2', 'Bo'],
  ['u3', 'Ŝéra «Ω» "q" $1'],
]);

/** Aya wants it with 37 tokens, Bo has it (no count), u9 is not on the roster and wants it with 12. */
const MEMBERS = [m('u1', 'hunting', 'missing', 37), m('u2', null, 'have', null), m('u9', 'hunting', 'missing', 12)];

type RowProps = ComponentProps<typeof FindRow>;

function renderRow(props: Partial<RowProps> = {}, url = '/?tab=progress&pview=find') {
  const onToggle = vi.fn();
  const all: RowProps = {
    item: item(),
    names: NAMES,
    expanded: false,
    onToggle,
    action: null,
    readerIsViewer: false,
    ...props,
  };
  const view = render(
    <MemoryRouter initialEntries={[url]}>
      <FindRow {...all} />
      <LocationProbe />
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
  return { ...view, onToggle };
}

const toggleFor = (name: string) => screen.getByRole('button', { name: `Show details for ${name}` });

/** The element the toggle's `aria-controls` names. */
function bodyOf(name = 'Lynx of Righteous Fire'): HTMLElement {
  const id = toggleFor(name).getAttribute('aria-controls');
  expect(id).toBeTruthy();
  const el = document.getElementById(id!);
  expect(el).not.toBeNull();
  return el!;
}

/** The row's text with the body taken out: what the collapsed line shows. */
function metaText(container: HTMLElement, name = 'Lynx of Righteous Fire'): string {
  const id = toggleFor(name).getAttribute('aria-controls');
  const clone = container.cloneNode(true) as HTMLElement;
  Array.from(clone.querySelectorAll<HTMLElement>('[id]'))
    .find((e) => e.id === id)
    ?.remove();
  return (clone.textContent ?? '').replace(/\s+/g, ' ');
}

const search = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

function trackingControl(): HTMLElement | null {
  return screen.queryByRole('button', { name: /Tracking/ }) ?? screen.queryByRole('link', { name: /Tracking/ });
}

beforeEach(() => {
  stubCanHover();
});

// ── The toggle ──────────────────────────────────────────────────────────────

describe('the toggle', () => {
  it('is "Show details for {name}" with aria-expanded false and an aria-controls that resolves', () => {
    renderRow();
    const t = toggleFor('Lynx of Righteous Fire');
    expect(t).toHaveAttribute('aria-expanded', 'false');
    expect(bodyOf()).toBeTruthy();
  });

  it('reads aria-expanded true when expanded', () => {
    renderRow({ expanded: true });
    expect(toggleFor('Lynx of Righteous Fire')).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onToggle once when pressed', () => {
    const { onToggle } = renderRow();
    fireEvent.click(toggleFor('Lynx of Righteous Fire'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps quotes, $, an ellipsis and accents in the name literally (label and line)', () => {
    const name = 'Rock "n" Roll $& $1 \\u00e9 … Ḁé';
    const { container } = renderRow({ item: item({ name }) });
    expect(toggleFor(name)).toBeInTheDocument();
    expect(metaText(container, name)).toContain(name);
  });
});

// ── The collapsed line (P-75, P-71, D-10) ───────────────────────────────────

describe('the collapsed line', () => {
  it('shows the name, the source duty and the exchange as "{cost} {token}" (P-75)', () => {
    const { container } = renderRow();
    const text = metaText(container);
    expect(text).toContain('Lynx of Righteous Fire');
    expect(text).toContain('Worqor Lar Dor (Extreme)');
    expect(text).toMatch(/99\s*×?\s*Valigarmanda Totem/);
  });

  it('a token cost of 0 shows no count: never "0 Totem" or "0 ×" (A1-M4)', () => {
    const { container } = renderRow({ item: item({ token: { name: 'Valigarmanda Totem', cost: 0 } }) });
    const text = metaText(container);
    expect(text).not.toMatch(/(^|[^0-9])0\s*×?\s*Valigarmanda/);
    expect(text).not.toMatch(/0 ×/);
  });

  it('no token shows no exchange', () => {
    const { container } = renderRow({ item: item({ token: null }) });
    expect(metaText(container)).not.toMatch(/Totem/);
  });

  it('shows the plugin-ready label tag when pluginReady, as a non-interactive label (P-71)', () => {
    const { container } = renderRow();
    expect(metaText(container)).toMatch(/plugin.?ready/i);
    expect(screen.queryByRole('button', { name: /plugin.?ready/i })).not.toBeInTheDocument();
  });

  it('has no plugin-ready tag when not pluginReady', () => {
    const { container } = renderRow({ item: item({ pluginReady: false }) });
    expect(metaText(container)).not.toMatch(/plugin.?ready/i);
  });

  it('reads "1 wants" for one wanting member', () => {
    const { container } = renderRow({ item: item({ members: MEMBERS, wantedBy: ['u1'] }) });
    expect(metaText(container)).toMatch(/(?<!\d)1 wants/);
  });

  it('reads "2 want" (not "2 wants") for two', () => {
    const { container } = renderRow({ item: item({ members: MEMBERS, wantedBy: ['u1', 'u9'] }) });
    const text = metaText(container);
    expect(text).toMatch(/(?<!\d)2 want(?!s)/);
    expect(text).not.toMatch(/(?<!\d)2 wants/);
  });

  it('shows no want count when nobody wants it', () => {
    const { container } = renderRow({ item: item({ members: MEMBERS, wantedBy: [] }) });
    expect(metaText(container)).not.toMatch(/\d+ wants?/);
  });

  it('renders the action it is given', () => {
    renderRow({ action: <span data-testid="row-action">act</span> as ReactNode });
    expect(screen.getByTestId('row-action')).toBeInTheDocument();
  });
});

// ── The body (P-58, S-2) ────────────────────────────────────────────────────

describe('the body', () => {
  it('collapsed, it is inert and hidden', () => {
    renderRow({ item: item({ members: MEMBERS, wantedBy: ['u1', 'u9'] }) });
    const body = bodyOf();
    expect(body).toHaveAttribute('inert');
    expect(body.hidden).toBe(true);
    expect(body).not.toBeVisible();
  });

  it('expanded, it is neither inert nor hidden', () => {
    renderRow({ expanded: true, item: item({ members: MEMBERS, wantedBy: ['u1', 'u9'] }) });
    const body = bodyOf();
    expect(body).not.toHaveAttribute('inert');
    expect(body.hidden).toBe(false);
    expect(body).toBeVisible();
  });

  it('expanded, it lists every member\'s state by roster name; an unknown member is "A member"', () => {
    renderRow({ expanded: true, item: item({ members: MEMBERS, wantedBy: ['u1', 'u9'] }) });
    const items = within(bodyOf()).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const aya = items.find((li) => /Aya:/.test(li.textContent ?? ''));
    const bo = items.find((li) => /Bo:/.test(li.textContent ?? ''));
    const stranger = items.find((li) => /A member:/.test(li.textContent ?? ''));
    expect(aya).toHaveTextContent(/Aya: Want/);
    expect(bo).toHaveTextContent(/Bo: Have/);
    expect(stranger).toHaveTextContent(/A member: Want/);
  });

  it('never renders the join\'s Discord name, expanded or not (A1-M5, S-2)', () => {
    const { container, rerender } = renderRow({ expanded: true, item: item({ members: MEMBERS, wantedBy: ['u1', 'u9'] }) });
    expect(container.textContent).not.toMatch(/discord-/);
    rerender(
      <MemoryRouter>
        <FindRow item={item({ members: MEMBERS, wantedBy: ['u1'] })} names={new Map()} expanded onToggle={vi.fn()} action={null} readerIsViewer={false} />
      </MemoryRouter>,
    );
    expect(container.textContent).not.toMatch(/discord-/);
    expect(within(bodyOf()).getAllByRole('listitem').every((li) => /A member:/.test(li.textContent ?? ''))).toBe(true);
  });

  it('renders a roster name with quotes, $ and unicode literally', () => {
    renderRow({ expanded: true, item: item({ members: [m('u3', 'hunting', 'missing', null)], wantedBy: ['u3'] }) });
    expect(within(bodyOf()).getByRole('listitem')).toHaveTextContent('Ŝéra «Ω» "q" $1: Want');
  });

  it('shows token counts to a member reader, and none for a null tokenCount (P-58)', () => {
    renderRow({ expanded: true, readerIsViewer: false, item: item({ members: MEMBERS, wantedBy: ['u1', 'u9'] }) });
    const items = within(bodyOf()).getAllByRole('listitem');
    expect(items.find((li) => /Aya:/.test(li.textContent ?? ''))).toHaveTextContent(/(?<!\d)37(?!\d)/);
    expect(items.find((li) => /A member:/.test(li.textContent ?? ''))).toHaveTextContent(/(?<!\d)12(?!\d)/);
    const bo = items.find((li) => /Bo:/.test(li.textContent ?? ''))!;
    expect(bo.textContent).not.toMatch(/null|undefined|NaN/);
    expect(bo.textContent).not.toMatch(/\d/);
  });

  it('hides every token count from a viewer reader (P-58, B1)', () => {
    renderRow({ expanded: true, readerIsViewer: true, item: item({ members: MEMBERS, wantedBy: ['u1', 'u9'] }) });
    const body = bodyOf();
    expect(within(body).getAllByRole('listitem')).toHaveLength(3);
    expect(body.textContent).toMatch(/Aya: Want/);
    expect(body.textContent).not.toMatch(/(?<!\d)37(?!\d)/);
    expect(body.textContent).not.toMatch(/(?<!\d)12(?!\d)/);
  });

  it('expanded, it carries the source facts (the duty)', () => {
    renderRow({ expanded: true, item: item({ members: MEMBERS, wantedBy: ['u1'] }) });
    expect(bodyOf()).toHaveTextContent('Worqor Lar Dor (Extreme)');
  });
});

// ── Tracking ✓ (P-60) ───────────────────────────────────────────────────────

describe('Tracking ✓', () => {
  it('is absent on an untracked item', () => {
    renderRow();
    expect(trackingControl()).not.toBeInTheDocument();
  });

  it('is a nav tag (no aria-pressed) that opens ?track=<id> in Tracks', async () => {
    renderRow({ item: item({ tracking: 'goal-9' }) });
    const tag = trackingControl();
    expect(tag).not.toBeNull();
    expect(tag).not.toHaveAttribute('aria-pressed');
    fireEvent.click(tag!);
    await waitFor(() => expect(search().get('track')).toBe('goal-9'));
    expect(search().get('pview')).not.toBe('find');
    expect(search().get('tab')).toBe('progress');
  });

  it('shows for a viewer reader too', () => {
    renderRow({ readerIsViewer: true, item: item({ tracking: 'goal-9' }) });
    expect(trackingControl()).toBeInTheDocument();
  });
});

// ── The can-buy mark and the state words (P-58; review fixes) ──────────────

describe('the can-buy mark', () => {
  const buyer = { ...m('u1', 'hunting', 'missing', 37), canBuy: true };
  const saver = { ...m('u2', 'hunting', 'missing', 12), canBuy: false };
  const body = (over: Partial<RowProps>) => {
    renderRow({ expanded: true, item: item({ members: [buyer, saver], wantedBy: ['u1', 'u2'] }), ...over });
    const items = within(bodyOf()).getAllByRole('listitem');
    return {
      aya: items.find((li) => /Aya:/.test(li.textContent ?? ''))!,
      bo: items.find((li) => /Bo:/.test(li.textContent ?? ''))!,
    };
  };

  it('shows ✓ with a "can buy" reading beside the count when canBuy, for a member reader', () => {
    const { aya } = body({ readerIsViewer: false });
    expect(aya).toHaveTextContent(/37.*✓/);
    expect(within(aya).getByText(/can buy/)).toBeInTheDocument();
  });

  it('shows no mark when the member cannot buy', () => {
    const { bo } = body({ readerIsViewer: false });
    expect(bo).toHaveTextContent(/12/);
    expect(bo.textContent).not.toMatch(/✓|can buy/);
  });

  it('shows no mark to a viewer reader, who sees no counts', () => {
    const { aya } = body({ readerIsViewer: true });
    expect(aya.textContent).not.toMatch(/✓|can buy|37/);
  });
});

describe('the state words', () => {
  function stateOf(intent: MemberSuggestionEntry['intent'], own: MemberSuggestionEntry['ownershipState']): string {
    const { unmount } = renderRow({ expanded: true, item: item({ members: [m('u1', intent, own, null)] }) });
    const text = within(bodyOf()).getByRole('listitem').textContent ?? '';
    unmount();
    return text;
  }

  it.each([
    ['hunting', 'missing', 'Aya: Want'],
    ['interested', 'missing', 'Aya: Interested'],
    ['pass', 'missing', 'Aya: Passed'],
    [null, 'have', 'Aya: Have'],
    [null, 'missing', 'Aya: Missing'],
    [null, 'unknown', 'Aya: Unknown'],
    ['hunting', 'have', 'Aya: Have'],
    ['hidden', 'missing', 'Aya: Missing'],
    ['hidden', 'unknown', 'Aya: Unknown'],
    ['hidden', 'have', 'Aya: Have'],
  ] as const)('intent %s with ownership %s reads "%s"', (intent, own, expected) => {
    expect(stateOf(intent, own)).toBe(expected);
  });
});

// ── The count gate for a Have member (S2a-4a·A3 TA3, carried; V1 `collections/DutyFarmCard.tsx:203`) ──

describe('the count gate for a Have member', () => {
  it('shows no token count and no can-buy mark for a member who has it, even with a count and canBuy', () => {
    const owner = { ...m('u2', null, 'have', 40), canBuy: true };
    const hunter = { ...m('u1', 'hunting', 'missing', 37), canBuy: true };
    renderRow({ expanded: true, readerIsViewer: false, item: item({ members: [hunter, owner], wantedBy: ['u1'] }) });
    const items = within(bodyOf()).getAllByRole('listitem');
    const bo = items.find((li) => /Bo:/.test(li.textContent ?? ''))!;
    const aya = items.find((li) => /Aya:/.test(li.textContent ?? ''))!;
    expect(bo.textContent).toBe('Bo: Have');
    expect(aya).toHaveTextContent(/37.*✓/);
  });
});
