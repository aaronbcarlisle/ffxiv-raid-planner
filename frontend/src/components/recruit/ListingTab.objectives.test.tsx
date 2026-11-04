/**
 * The objectives editor on Listing (S2a-5a·C2a Task C2-2; R-M-6, O-4, P-80, P-82, Review Focus 1, 3).
 * Real `ListingTab`, `ObjectiveGoalsPanel`, `DiscoveryTab` and stores over a mocked api: a test
 * decides what each objectives read does (served, held or rejected), and every write is recorded.
 *
 * Every "doesn't" case first proves the editor is on screen, so none of them passes on a Listing
 * with no editor.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscoverySettings, StaticGroup } from '../../types';
import type { StaticObjectiveGoal } from '../../stores/objectiveGoalStore';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  authRequest: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    authRequest: mocks.authRequest,
    api: { get: mocks.get, post: mocks.post, put: mocks.put, patch: mocks.patch, delete: mocks.delete },
  };
});
vi.mock('../../lib/shellPreference', () => ({ useResolvedShell: () => 'v2' }));

import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useObjectiveGoalStore } from '../../stores/objectiveGoalStore';
import { ListingTab } from './ListingTab';

// ── Fixtures ────────────────────────────────────────────────────────────────

function groupOf(id: string, discovery: Partial<DiscoverySettings> = { enabled: true, recruitmentStatus: 'open' }): StaticGroup {
  return {
    id,
    name: `Static ${id}`,
    shareCode: id,
    isPublic: true,
    ownerId: 'u1',
    memberCount: 8,
    userRole: 'owner',
    settings: { discovery },
  } as StaticGroup;
}
const G1 = groupOf('g1');
const G2 = groupOf('g2');

function objective(id: string, groupId: string, title: string, overrides: Partial<StaticObjectiveGoal> = {}): StaticObjectiveGoal {
  return {
    id,
    staticGroupId: groupId,
    createdById: null,
    category: 'savage_bis',
    title,
    description: null,
    priority: 'required',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}
const G1_ROW = 'First static objective';
const G2_ROW = 'Second static objective';

// ── The api ─────────────────────────────────────────────────────────────────

const objectivesUrl = (groupId: string) => `/api/static-groups/${groupId}/objective-goals`;

interface Held {
  url: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}
let held: Held[] = [];
/** What the server holds. A group with no entry has its reads held; one in `failing` has them rejected. */
let lists: Record<string, StaticObjectiveGoal[]> = {};
let failing: Set<string> = new Set();

function apiGet(url: string): Promise<unknown> {
  if (failing.has(url)) return Promise.reject(new Error('boom'));
  if (url in lists) return Promise.resolve(lists[url]);
  return new Promise((resolve, reject) => held.push({ url, resolve, reject }));
}

/** The server keeps what's posted, so the store's refetch after a create finds it. */
function apiPost(url: string, body: { title: string; category: string; priority: string }): Promise<unknown> {
  const groupId = url.split('/')[3];
  const created = objective(`new-${(lists[url] ?? []).length}`, groupId, body.title, { category: body.category, priority: body.priority });
  lists[url] = [...(lists[url] ?? []), created];
  return Promise.resolve(created);
}

const serve = (groupId: string, list: StaticObjectiveGoal[]) => {
  lists[objectivesUrl(groupId)] = list;
};

const reads = (groupId: string) => mocks.get.mock.calls.filter(([url]) => String(url) === objectivesUrl(groupId)).length;

/** Every call on an objective route, whichever verb and client sent it, reads aside. */
const objectiveWrites = () =>
  [mocks.post, mocks.put, mocks.patch, mocks.delete, mocks.authRequest].flatMap((fn) =>
    fn.mock.calls.filter(([url]) => String(url).includes('/objective-goals')),
  );

const listingSaves = () =>
  mocks.authRequest.mock.calls.filter(([url, init]) => String(url) === '/api/static-groups/g1' && init?.method === 'PUT');

async function answer(groupId: string, list: StaticObjectiveGoal[]) {
  const url = objectivesUrl(groupId);
  await waitFor(() => expect(held.some((h) => h.url === url)).toBe(true));
  const call = held.find((h) => h.url === url)!;
  held = held.filter((h) => h !== call);
  await act(async () => call.resolve(list));
}

// ── Rendering ───────────────────────────────────────────────────────────────

function renderListing(group: StaticGroup = G1) {
  const onTabChange = vi.fn();
  const ui = (g: StaticGroup) => <ListingTab group={g} onTabChange={onTabChange} />;
  const view = render(ui(group));
  return { onTabChange, switchTo: (g: StaticGroup) => view.rerender(ui(g)) };
}

const editor = () => within(screen.getByTestId('listing-objectives'));

/** The editor on screen with its first load settled. */
async function settledEditor(groupId = 'g1') {
  await screen.findByTestId('listing-objectives');
  await waitFor(() => expect(reads(groupId)).toBeGreaterThan(0));
  await act(async () => undefined);
  return editor();
}

const titleInput = () => screen.queryByPlaceholderText('e.g., Clear The Futures Rewritten (Ultimate)');
const listingDescription = () => screen.getByPlaceholderText(/^Tell recruits about your static/);

beforeEach(() => {
  held = [];
  lists = {};
  failing = new Set();
  Object.values(mocks).forEach((fn) => fn.mockReset());
  mocks.get.mockImplementation(apiGet);
  mocks.post.mockImplementation(apiPost);
  mocks.authRequest.mockImplementation(async (url: string) => ({ id: url.split('/').pop(), name: 'Saved', settings: {} }));
  useJoinRequestStore.setState({ applicants: null });
  useObjectiveGoalStore.setState({ objectives: [], loading: false, error: null, objectivesError: null });
});

// A held read left unanswered would land on the next test's store.
afterEach(async () => {
  const left = held;
  held = [];
  await act(async () => left.forEach((h) => h.resolve([])));
});

// ── Its place ───────────────────────────────────────────────────────────────

describe('the editor\'s place', () => {
  it('sits between the status card and the builder, as a sibling of both (O-4)', async () => {
    serve('g1', []);
    renderListing();
    const block = await screen.findByTestId('listing-objectives');
    expect(block.previousElementSibling).toHaveTextContent(/^Live$/);
    expect(block.nextElementSibling).toContainElement(screen.getByRole('button', { name: 'Save Listing' }));
    expect(block.nextElementSibling).toContainElement(screen.getByText('List in Static Finder'));
  });

  it('comes in a CardShell, with the panel\'s own heading', async () => {
    serve('g1', []);
    renderListing();
    const block = await screen.findByTestId('listing-objectives');
    expect(block.firstElementChild).toHaveClass('bg-surface-card');
    expect(within(block).getByRole('heading', { name: 'Static Objectives' })).toBeInTheDocument();
  });

  it('fetches this static\'s list once', async () => {
    serve('g1', [objective('a', 'g1', G1_ROW)]);
    renderListing();
    expect(await screen.findByText(G1_ROW)).toBeInTheDocument();
    expect(reads('g1')).toBe(1);
  });

  it('manages: its row actions show, whatever the group object says, RecruitPage being the guard', async () => {
    serve('g1', [objective('a', 'g1', G1_ROW)]);
    renderListing({ ...G1, userRole: undefined } as StaticGroup);
    expect(await screen.findByText(G1_ROW)).toBeInTheDocument();
    expect(editor().getByRole('button', { name: 'Add Static Goal' })).toBeInTheDocument();
    expect(editor().getByRole('button', { name: 'Edit objective' })).toBeInTheDocument();
    expect(editor().getByRole('button', { name: 'Delete objective' })).toBeInTheDocument();
  });
});

// ── Add ─────────────────────────────────────────────────────────────────────

describe('Add Static Goal', () => {
  it('shows the four fields (P-80)', async () => {
    serve('g1', []);
    renderListing();
    const panel = await settledEditor();
    fireEvent.click(panel.getByRole('button', { name: 'Add Static Goal' }));
    expect(panel.getByText('Category')).toBeInTheDocument();
    expect(panel.getByText('Priority')).toBeInTheDocument();
    expect(panel.getByText('Title')).toBeInTheDocument();
    expect(panel.getByText('Description (optional)')).toBeInTheDocument();
  });

  it('sends no POST on Cancel, and the builder\'s Cancel is untouched (P-80)', async () => {
    serve('g1', []);
    const { onTabChange } = renderListing();
    const panel = await settledEditor();
    fireEvent.click(panel.getByRole('button', { name: 'Add Static Goal' }));
    fireEvent.change(titleInput()!, { target: { value: 'Never sent' } });
    fireEvent.click(panel.getByRole('button', { name: 'Cancel' }));

    expect(titleInput()).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(objectiveWrites()).toEqual([]);
    expect(onTabChange).not.toHaveBeenCalled();
    expect(panel.getByRole('button', { name: 'Add Static Goal' })).toBeInTheDocument();
  });

  it('keeps a title with quotes, a backslash and a dollar as it is, through the POST and the list', async () => {
    const title = `Ifrit's "Wings" \\u0041 $& 100%…`;
    serve('g1', []);
    renderListing();
    const panel = await settledEditor();
    fireEvent.click(panel.getByRole('button', { name: 'Add Static Goal' }));
    fireEvent.change(titleInput()!, { target: { value: title } });
    fireEvent.click(panel.getByRole('button', { name: 'Save' }));

    expect(await panel.findByText(title)).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0][0]).toBe(objectivesUrl('g1'));
    expect(mocks.post.mock.calls[0][1]).toMatchObject({ title });
  });
});

// ── Load states ─────────────────────────────────────────────────────────────

describe('the load states', () => {
  it('shows "No objectives set" with Add on an empty load (P-82)', async () => {
    serve('g1', []);
    renderListing();
    const panel = await settledEditor();
    expect(panel.getByText('No objectives set')).toBeInTheDocument();
    fireEvent.click(panel.getByRole('button', { name: 'Add static goal' }));
    expect(titleInput()).toBeInTheDocument();
  });

  it('shows the error on a rejected load, and Retry refetches (P-82)', async () => {
    failing.add(objectivesUrl('g1'));
    renderListing();
    const panel = await settledEditor();
    expect(panel.getByText("Couldn't load objectives.")).toBeInTheDocument();
    expect(reads('g1')).toBe(1);

    failing.clear();
    serve('g1', [objective('a', 'g1', G1_ROW)]);
    fireEvent.click(panel.getByRole('button', { name: 'Retry' }));
    expect(await panel.findByText(G1_ROW)).toBeInTheDocument();
    expect(reads('g1')).toBe(2);
    expect(panel.queryByText("Couldn't load objectives.")).toBeNull();
  });

  it('keeps listing Not Doing objectives, which the Home card hides (Review Focus 3)', async () => {
    serve('g1', [objective('n', 'g1', 'Skipped thing', { priority: 'not_doing' })]);
    renderListing();
    const panel = await settledEditor();
    expect(panel.getByText('Skipped thing')).toBeInTheDocument();
    expect(panel.getByText('not doing')).toBeInTheDocument();
    expect(panel.queryByText('No objectives set')).toBeNull();
  });
});

// ── Separate saves ──────────────────────────────────────────────────────────

describe('two separate saves', () => {
  it('Save Listing calls no objective route', async () => {
    serve('g1', [objective('a', 'g1', G1_ROW)]);
    renderListing();
    const panel = await settledEditor();
    expect(panel.getByText(G1_ROW)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Listing' }));
    await waitFor(() => expect(listingSaves()).toHaveLength(1));
    await act(async () => undefined);
    expect(objectiveWrites()).toEqual([]);
    expect(reads('g1')).toBe(1);
  });

  it('Save Listing leaves an unsaved objective form as it was', async () => {
    serve('g1', []);
    renderListing();
    const panel = await settledEditor();
    fireEvent.click(panel.getByRole('button', { name: 'Add Static Goal' }));
    fireEvent.change(titleInput()!, { target: { value: 'Half typed' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Listing' }));
    await waitFor(() => expect(listingSaves()).toHaveLength(1));
    await act(async () => undefined);
    expect(titleInput()).toHaveValue('Half typed');
    expect(objectiveWrites()).toEqual([]);
  });

  it('puts no objective in the listing\'s saved settings', async () => {
    serve('g1', [objective('a', 'g1', G1_ROW)]);
    renderListing();
    const panel = await settledEditor();
    expect(panel.getByText(G1_ROW)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Listing' }));
    await waitFor(() => expect(listingSaves()).toHaveLength(1));
    expect(String(listingSaves()[0][1].body)).not.toContain(G1_ROW);
  });

  it('adding an objective neither saves the listing nor disturbs its unsaved edits', async () => {
    serve('g1', []);
    const { onTabChange } = renderListing();
    const panel = await settledEditor();

    const description = listingDescription();
    fireEvent.change(description, { target: { value: 'An unsaved pitch' } });

    fireEvent.click(panel.getByRole('button', { name: 'Add Static Goal' }));
    fireEvent.change(titleInput()!, { target: { value: 'New objective' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save' }));

    expect(await panel.findByText('New objective')).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(reads('g1')).toBe(2);
    expect(listingSaves()).toEqual([]);
    expect(mocks.authRequest).not.toHaveBeenCalled();
    expect(onTabChange).not.toHaveBeenCalled();
    expect(listingDescription()).toBe(description);
    expect(description).toHaveValue('An unsaved pitch');
  });
});

// ── A static switch ─────────────────────────────────────────────────────────

describe('a static switch', () => {
  it('replaces the old rows with the new static\'s when its fetch lands (Review Focus 1)', async () => {
    serve('g1', [objective('a', 'g1', G1_ROW)]);
    const { switchTo } = renderListing();
    const panel = await settledEditor();
    expect(panel.getByText(G1_ROW)).toBeInTheDocument();

    switchTo(G2);
    await answer('g2', [objective('b', 'g2', G2_ROW)]);
    expect(await screen.findByText(G2_ROW)).toBeInTheDocument();
    expect(screen.queryByText(G1_ROW)).toBeNull();
    expect(reads('g2')).toBe(1);
  });

  it('empties the list when the new static has none', async () => {
    serve('g1', [objective('a', 'g1', G1_ROW)]);
    const { switchTo } = renderListing();
    const panel = await settledEditor();
    expect(panel.getByText(G1_ROW)).toBeInTheDocument();

    switchTo(G2);
    await answer('g2', []);
    expect(await screen.findByText('No objectives set')).toBeInTheDocument();
    expect(screen.queryByText(G1_ROW)).toBeNull();
  });

  it('restarts the panel: an open form does not carry over to the new static', async () => {
    serve('g1', []);
    serve('g2', []);
    const { switchTo } = renderListing();
    const panel = await settledEditor();
    fireEvent.click(panel.getByRole('button', { name: 'Add Static Goal' }));
    fireEvent.change(titleInput()!, { target: { value: 'For the first static' } });

    switchTo(G2);
    await waitFor(() => expect(reads('g2')).toBe(1));
    await act(async () => undefined);
    expect(titleInput()).toBeNull();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
