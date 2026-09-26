import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HubSideCards } from './HubSideCards';
import type { GearSnapshot, PlayerProfile } from '../../../stores/playerProfileStore';

// ── store mocks ──────────────────────────────────────────────────────────────

const availState = { days: [] as { dayOfWeek: string; slots: string[]; timezone: string }[], fetchPersonalAvailability: vi.fn() };
vi.mock('../../../stores/personalAvailabilityStore', () => ({
  usePersonalAvailabilityStore: (sel?: (s: typeof availState) => unknown) =>
    sel ? sel(availState) : availState,
}));

const profileFetch = vi.fn();
vi.mock('../../../stores/playerProfileStore', () => ({
  usePlayerProfileStore: (sel: (s: { fetchProfile: typeof profileFetch }) => unknown) =>
    sel({ fetchProfile: profileFetch }),
}));

// ── helpers ──────────────────────────────────────────────────────────────────

const baseProfile: PlayerProfile = {
  id: 'p1', userId: 'u1', visibility: 'shareable', shareCode: 'ABC', shareEnabled: true, bio: null,
  characters: [{ id: 'c1', lodestoneId: '1', name: 'Rin Applicant', server: 'Balmung', dataCenter: 'Crystal', avatarUrl: null, isMain: true, createdAt: '', updatedAt: '' }],
  jobProfiles: [{ id: 'j1', job: 'BRD', role: 'ranged', priority: 'main', readiness: 'ready', notes: null, gearSnapshotId: null, gearSnapshot: null, bisTargets: [], createdAt: '', updatedAt: '' }],
  createdAt: '', updatedAt: '',
};

const usableSnap: GearSnapshot = {
  id: 's1', characterId: 'c1', job: 'BRD', source: 'plugin', syncedAt: '2026-09-26T00:00:00Z',
  lastPluginSeenAt: null, avgItemLevel: 700, createdAt: '', updatedAt: '',
  gear: [{ slot: 'weapon', equippedItemLevel: 700 }],
};

const setTab = vi.fn();
const onOpenLinkModal = vi.fn();
const onAddJob = vi.fn();

function renderCards(
  profile: PlayerProfile | null = baseProfile,
  gearSnapshots: Record<string, GearSnapshot[]> = {},
) {
  return render(
    <MemoryRouter>
      <HubSideCards
        profile={profile}
        gearSnapshots={gearSnapshots}
        onOpenLinkModal={onOpenLinkModal}
        onAddJob={onAddJob}
        setTab={setTab}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  availState.days = [];
  availState.fetchPersonalAvailability.mockReset();
  setTab.mockClear();
  onOpenLinkModal.mockClear();
  onAddJob.mockClear();
});

// ── Characters card ──────────────────────────────────────────────────────────

describe('Characters card', () => {
  it('shows character name and server', () => {
    renderCards();
    expect(screen.getByText('Rin Applicant')).toBeInTheDocument();
    expect(screen.getByText('Balmung')).toBeInTheDocument();
  });

  it('gear line shows newest usable snapshot info', () => {
    renderCards(baseProfile, { c1: [usableSnap] });
    // Gear line starts with "Gear ·"
    expect(screen.getByText(/Gear ·/)).toBeInTheDocument();
    expect(screen.getByText(/Plugin sync/)).toBeInTheDocument();
  });

  it('no gear shows "No gear saved yet"', () => {
    renderCards(baseProfile, {});
    expect(screen.getByText('No gear saved yet')).toBeInTheDocument();
  });

  it('empty state shown when no character; action opens link modal', () => {
    renderCards({ ...baseProfile, characters: [] });
    expect(screen.getByText('No character linked')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /link character/i }));
    expect(onOpenLinkModal).toHaveBeenCalledTimes(1);
  });

  it('Manage → switches to characters tab', () => {
    renderCards();
    fireEvent.click(screen.getByRole('button', { name: /manage/i }));
    expect(setTab).toHaveBeenCalledWith('characters');
  });
});

// ── Availability card ────────────────────────────────────────────────────────

describe('Availability card', () => {
  it('shows "Not set yet" when no days configured', () => {
    renderCards();
    expect(screen.getByText('Not set yet')).toBeInTheDocument();
  });

  it('shows day count, hours, and day abbreviations when days configured', () => {
    availState.days = [
      { dayOfWeek: 'MO', slots: ['18:00', '18:30', '19:00', '19:30'], timezone: 'UTC' },
      { dayOfWeek: 'WE', slots: ['20:00', '20:30'], timezone: 'UTC' },
    ];
    renderCards();
    expect(screen.getByText(/2 days · 3h · Mon \/ Wed/)).toBeInTheDocument();
  });

  it('Edit → switches to availability tab', () => {
    renderCards();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(setTab).toHaveBeenCalledWith('availability');
  });
});

// ── Profile setup card ───────────────────────────────────────────────────────

describe('Profile setup card', () => {
  it('hidden when all checks are done', () => {
    availState.days = [{ dayOfWeek: 'MO', slots: ['18:00', '18:30'], timezone: 'UTC' }];
    renderCards(baseProfile, { c1: [usableSnap] });
    // All done: no profile setup heading
    expect(screen.queryByText(/profile setup/i)).toBeNull();
  });

  it('visible with progress when setup incomplete', () => {
    renderCards({ ...baseProfile, characters: [] });
    expect(screen.getByText(/profile setup/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('checklist toggles aria-expanded on Show checklist button', () => {
    renderCards({ ...baseProfile, characters: [] });
    const btn = screen.getByRole('button', { name: /show checklist/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /hide checklist/i })).toHaveAttribute('aria-expanded', 'true');
  });
});
