/**
 * S2a-5a·C1 Task C1-1 — the patch on a Find row's body line (R-M-1, O-1).
 *
 * The line reads "{duty} · {type} · {expansion} · Patch 7.2". A null or empty patch adds nothing,
 * and a viewer sees it: it isn't a count.
 *
 * Each "adds nothing" case first renders the same row with a patch, so it can't pass on a row that
 * never shows one.
 */
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberSuggestionEntry } from '../../stores/collectionIntentStore';
import type { FindItem } from '../../utils/findModel';
import { FindRow } from './FindRow';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';

// ── Fixtures ────────────────────────────────────────────────────────────────

const NAME = 'Lynx of Righteous Fire';
const LINE = 'Worqor Lar Dor (Extreme) · Extreme · Dawntrail';

function item(over: Partial<FindItem> = {}): FindItem {
  return {
    id: 'cat-lynx',
    name: NAME,
    category: 'mount',
    sourceType: 'extreme',
    duty: 'Worqor Lar Dor (Extreme)',
    expansion: 'dt',
    patch: '7.2',
    token: { name: 'Valigarmanda Totem', cost: 99 },
    pluginReady: true,
    members: [],
    wantedBy: [],
    tracking: null,
    trackable: true,
    ...over,
  };
}

const AYA: MemberSuggestionEntry = {
  userId: 'u1',
  displayName: 'discord-u1-handle',
  ownershipState: 'missing',
  intent: 'hunting',
  tokenCount: 37,
  canBuy: false,
  confidence: 'high',
  reasons: [],
};

type RowProps = ComponentProps<typeof FindRow>;

function renderRow(props: Partial<RowProps> = {}) {
  const all: RowProps = {
    item: item(),
    names: new Map([['u1', 'Aya']]),
    expanded: false,
    onToggle: vi.fn(),
    action: null,
    readerIsViewer: false,
    ...props,
  };
  return render(
    <MemoryRouter initialEntries={['/?tab=progress&pview=find']}>
      <FindRow {...all} />
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
}

/** The element the toggle's `aria-controls` names. */
function bodyOf(): HTMLElement {
  const id = screen.getByRole('button', { name: `Show details for ${NAME}` }).getAttribute('aria-controls');
  const el = id ? document.getElementById(id) : null;
  expect(el).not.toBeNull();
  return el!;
}

const bodyText = () => (bodyOf().textContent ?? '').replace(/\s+/g, ' ').trim();

/** The row's text with the body taken out: what the collapsed line shows. */
function collapsedText(container: HTMLElement): string {
  const id = bodyOf().id;
  const clone = container.cloneNode(true) as HTMLElement;
  Array.from(clone.querySelectorAll<HTMLElement>('[id]'))
    .find((e) => e.id === id)
    ?.remove();
  return (clone.textContent ?? '').replace(/\s+/g, ' ');
}

beforeEach(() => {
  stubCanHover();
});

// ── The line ────────────────────────────────────────────────────────────────

describe('the body line', () => {
  it('reads "{duty} · {type} · {expansion} · Patch 7.2"', () => {
    renderRow();
    expect(bodyText()).toBe(`${LINE} · Patch 7.2`);
  });

  it('prints the patch as given: 7.10 is not 7.1', () => {
    renderRow({ item: item({ patch: '7.10' }) });
    expect(bodyText()).toBe(`${LINE} · Patch 7.10`);
  });

  it.each([
    ['null', null],
    ['empty', ''],
  ])('adds nothing with a %s patch: no "Patch" and no trailing " · "', (_label, patch) => {
    const patched = renderRow();
    expect(bodyText()).toBe(`${LINE} · Patch 7.2`);
    patched.unmount();

    renderRow({ item: item({ patch }) });
    expect(bodyText()).toBe(LINE);
    expect(bodyText()).not.toMatch(/Patch/);
    expect(bodyText()).not.toMatch(/·\s*$/);
  });

  it('has no leading " · " when the patch is the only part', () => {
    renderRow({ item: item({ duty: null, sourceType: null, expansion: null, patch: '7.2' }) });
    expect(bodyText()).toBe('Patch 7.2');
  });

  it('stays in the body: the collapsed line does not gain it', () => {
    const { container } = renderRow();
    expect(bodyText()).toContain('Patch 7.2');
    expect(collapsedText(container)).not.toMatch(/Patch/);
  });
});

// ── Who sees it ─────────────────────────────────────────────────────────────

describe('a viewer', () => {
  it('sees the patch, which is not a count, while the counts stay hidden', () => {
    renderRow({ item: item({ members: [AYA] }), expanded: true, readerIsViewer: true });
    expect(screen.getByText(`${LINE} · Patch 7.2`)).toBeVisible();
    expect(bodyText()).not.toMatch(/37/);
  });
});
