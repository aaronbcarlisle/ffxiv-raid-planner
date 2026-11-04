/**
 * S2a-4a·A3 TA3 fix wave — the Share prompt's geometry and its focus under StrictMode (S-6; R-F-6;
 * design §3.2).
 *
 * - **Geometry:** in the prompt Cancel is the LAST control, after Share, with no CSS reordering, so it
 *   sits at the slot's right edge where I want this was: a second press on the same spot cancels.
 * - **StrictMode:** `main.tsx` renders under `<StrictMode>`, which simulates an unmount of every new
 *   effect. The trigger's "focus left with me" cleanup must not fire for that simulated unmount:
 *   Escape and Cancel return focus to I want this, the prompt opens on Cancel, and after a successful
 *   write the control that is gone hands focus to the row's toggle, never <body>.
 *
 * The action is rendered inside a real `FindRow` (the toggle it lands on) and, for the write cases,
 * under a harness that reads the member's row from the store as the page does.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

import { api } from '../../services/api';
import { useCollectionIntentStore, type CollectionIntent } from '../../stores/collectionIntentStore';
import { useToastStore } from '../../stores/toastStore';
import type { FindItem } from '../../utils/findModel';
import { MemberFindAction } from './findActions';
import { FindRow } from './FindRow';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';

// ── Fixtures ────────────────────────────────────────────────────────────────

const LYNX = 'Lynx of Righteous Fire';
const PROMPT = 'Your want is private. Share it with your statics?';

const ITEM: FindItem = {
  id: 'cat-lynx',
  name: LYNX,
  category: 'mount',
  sourceType: 'extreme',
  duty: 'Worqor Lar Dor (Extreme)',
  expansion: 'dt',
  patch: null,
  token: { name: 'Valigarmanda Totem', cost: 99 },
  pluginReady: false,
  members: [],
  wantedBy: [],
  tracking: null,
  trackable: true,
};

const PRIVATE: CollectionIntent = {
  id: 'intent-1',
  profileId: 'profile-u2',
  catalogItemId: 'cat-lynx',
  intent: 'interested',
  priority: 'high',
  visibility: 'private',
  notes: 'mine',
  updatedAt: '2026-10-01T00:00:00Z',
};

/** The page's half: the member's row comes from the store, so a write re-renders the action. */
function Harness() {
  const existing = useCollectionIntentStore((s) => s.myIntents['cat-lynx']);
  return (
    <FindRow
      item={ITEM}
      names={new Map()}
      expanded={false}
      onToggle={() => {}}
      readerIsViewer={false}
      action={<MemberFindAction item={ITEM} groupId="g1" existing={existing} intents="ready" onRetry={() => {}} />}
    />
  );
}

function renderStrict() {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={['/?tab=progress&pview=find']}>
        <ul>
          <Harness />
        </ul>
      </MemoryRouter>
    </StrictMode>,
    { wrapper: TooltipWrapper },
  );
}

const row = () => screen.getByTestId('find-row');
const toggle = () => screen.getByRole('button', { name: `Show details for ${LYNX}` });
const want = () => within(row()).getByRole('button', { name: /I want this/ });
const cancel = () => within(row()).getByRole('button', { name: 'Cancel' });
const share = () => within(row()).getByRole('button', { name: 'Share' });

/** As a reader does it: focus the control, then press it. */
function press(el: HTMLElement) {
  el.focus();
  fireEvent.click(el);
}

async function openPrompt() {
  renderStrict();
  press(want());
  expect(await within(row()).findByText(PROMPT)).toBeInTheDocument();
  await waitFor(() => expect(cancel()).toHaveFocus());
}

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  useToastStore.getState().clearAll();
  useCollectionIntentStore.setState({ myIntents: { 'cat-lynx': PRIVATE }, myIntentsLoaded: true, suggestions: {}, suggestionsLoading: {}, suggestionsError: {} });
  vi.mocked(api.put).mockImplementation(async (url: string, body?: unknown) => ({
    id: 'intent-1',
    profile_id: 'profile-u2',
    catalog_item_id: url.slice('/api/me/collection-intent/'.length),
    updated_at: '2026-10-02T00:00:00Z',
    ...(body as Record<string, unknown>),
  }));
});

afterEach(() => {
  useCollectionIntentStore.setState({ myIntents: {}, myIntentsLoaded: false, suggestions: {}, suggestionsLoading: {}, suggestionsError: {} });
  useToastStore.getState().clearAll();
});

// ── Geometry (S-6) ──────────────────────────────────────────────────────────

describe('the prompt\'s DOM order (S-6)', () => {
  it('Cancel is the last control, after Share, with no CSS reordering between it and the row', async () => {
    await openPrompt();
    const c = cancel();
    const s = share();
    expect(s.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nothing after Cancel in the slot, and the slot is the last thing in the row's header.
    expect(c.parentElement!.lastElementChild).toBe(c);
    const header = toggle().parentElement!;
    expect(header.lastElementChild).toBe(c.parentElement);
    for (let el: HTMLElement | null = c; el !== null && el !== row(); el = el.parentElement) {
      expect(el.className).not.toMatch(/flex-row-reverse|flex-col-reverse|\border-/);
    }
  });

  it('a second press on the trigger\'s spot cancels: no PUT, and focus is back on I want this', async () => {
    await openPrompt();
    // The reader's pointer has not moved: the focused control is the one under it.
    fireEvent.click(document.activeElement as HTMLElement);
    await waitFor(() => expect(within(row()).queryByText(PROMPT)).toBeNull());
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    await waitFor(() => expect(want()).toHaveFocus());
  });
});

// ── Focus under StrictMode ──────────────────────────────────────────────────

describe('focus under StrictMode', () => {
  it('Cancel returns focus to I want this, not to the row toggle', async () => {
    await openPrompt();
    press(cancel());
    await waitFor(() => expect(within(row()).queryByText(PROMPT)).toBeNull());
    await waitFor(() => expect(want()).toHaveFocus());
    // Settled: the simulated unmount's cleanup has had its turn and moved nothing.
    await new Promise((r) => setTimeout(r, 0));
    expect(want()).toHaveFocus();
    expect(toggle()).not.toHaveFocus();
  });

  it('Escape returns focus to I want this, not to the row toggle', async () => {
    await openPrompt();
    const prevented = !fireEvent.keyDown(cancel(), { key: 'Escape', code: 'Escape' });
    expect(prevented).toBe(true);
    await waitFor(() => expect(want()).toHaveFocus());
    await new Promise((r) => setTimeout(r, 0));
    expect(want()).toHaveFocus();
    expect(toggle()).not.toHaveFocus();
  });

  it('after Share the control is gone and focus lands on the row toggle, never <body>', async () => {
    await openPrompt();
    press(share());
    expect(await within(row()).findByText('Wanted ✓')).toBeInTheDocument();
    await waitFor(() => expect(toggle()).toHaveFocus());
    expect(vi.mocked(api.put)).toHaveBeenCalledTimes(1);
  });

  it('after a successful I want this with no row, focus lands on the row toggle, never <body>', async () => {
    useCollectionIntentStore.setState({ myIntents: {} });
    renderStrict();
    press(want());
    expect(within(row()).queryByText(PROMPT)).toBeNull();
    expect(await within(row()).findByText('Wanted ✓')).toBeInTheDocument();
    await waitFor(() => expect(toggle()).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });
});
