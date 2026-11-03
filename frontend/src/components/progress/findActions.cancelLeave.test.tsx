/**
 * S2a-4a fix wave: the Share prompt's Cancel has the same `leaveTo` as Share (R-F-6, design §3.2).
 * Cancel takes focus when the prompt opens, and Safari and Firefox on macOS give a clicked button no
 * focus, so a pointer press on Share leaves focus on Cancel. When the write lands Cancel goes, and
 * focus must reach the row's toggle, never <body>. Cancel's own path still hands focus to I want this,
 * since that layout effect runs before `ActionButton`'s microtask looks (`findActions.prompt.test`).
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

const LYNX = 'Lynx of Righteous Fire';

const ITEM: FindItem = {
  id: 'cat-lynx',
  name: LYNX,
  category: 'mount',
  sourceType: 'extreme',
  duty: 'Worqor Lar Dor (Extreme)',
  expansion: 'dt',
  token: null,
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

const row = () => screen.getByTestId('find-row');
const toggle = () => screen.getByRole('button', { name: `Show details for ${LYNX}` });
const cancel = () => within(row()).getByRole('button', { name: 'Cancel' });
const share = () => within(row()).getByRole('button', { name: 'Share' });

async function openPrompt() {
  render(
    <StrictMode>
      <MemoryRouter initialEntries={['/?tab=progress&pview=find']}>
        <ul>
          <Harness />
        </ul>
      </MemoryRouter>
    </StrictMode>,
    { wrapper: TooltipWrapper },
  );
  fireEvent.click(within(row()).getByRole('button', { name: /I want this/ }));
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

describe('a pointer press on Share that leaves focus on Cancel', () => {
  it('lands on the row\'s toggle when the write removes Cancel, never <body>', async () => {
    await openPrompt();
    // `fireEvent.click` moves no focus, as those browsers don't: Cancel still holds it.
    fireEvent.click(share());
    expect(cancel()).toHaveFocus();
    expect(await within(row()).findByText('Wanted ✓')).toBeInTheDocument();
    await waitFor(() => expect(toggle()).toHaveFocus());
    expect(vi.mocked(api.put)).toHaveBeenCalledTimes(1);
  });
});
