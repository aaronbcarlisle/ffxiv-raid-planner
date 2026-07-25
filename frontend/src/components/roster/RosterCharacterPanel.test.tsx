/**
 * RosterCharacterPanel — unit tests
 *
 * Covers:
 *   - Loading / error / empty-roster states
 *   - Per-player card: no characters, single registration, multiple registrations
 *   - Role badges (main, alt)
 *   - Primary-star badge
 *   - Editor vs viewer access controls
 *   - CTAs: "Link Player Hub character", "Add manually"
 *   - Configured count header
 *   - Modal open on CTA click
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SnapshotPlayer, StaticCharacterRegistration, LinkedCharacterSummary } from '../../types';
import { RosterCharacterPanel } from './RosterCharacterPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Warrior Main',
    job: 'WAR',
    role: 'tank',
    position: 'T1',
    configured: true,
    sortOrder: 0,
    gear: [],
    tomeWeapon: { hasTomeWeapon: false, isAugmented: false },
    weaponPriorities: [],
    isSubstitute: false,
    ...overrides,
  } as unknown as SnapshotPlayer;
}

function makeReg(overrides: Partial<StaticCharacterRegistration> = {}): StaticCharacterRegistration {
  return {
    id: 'reg1',
    staticGroupId: 'g1',
    snapshotPlayerId: 'p1',
    playerCharacterId: null,
    manualCharacterName: 'Test Character',
    manualWorld: 'Tonberry',
    manualDataCenter: 'Elemental',
    roleInStatic: 'alt',
    job: null,
    isPrimaryForStatic: false,
    source: 'manual',
    lastSyncedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    resolvedName: 'Test Character',
    resolvedWorld: 'Tonberry',
    resolvedDataCenter: 'Elemental',
    linkedCharacter: null,
    ...overrides,
  };
}

function makeAvailChar(overrides: Partial<LinkedCharacterSummary> = {}): LinkedCharacterSummary {
  return {
    id: 'c1',
    name: 'Hub Character',
    server: 'Tonberry',
    dataCenter: 'Elemental',
    isMain: false,
    avatarUrl: null,
    lastSyncedAt: null,
    ...overrides,
  };
}

// ── Store mock ─────────────────────────────────────────────────────────────────

const storeState: {
  registrationsByGroup: Record<string, Record<string, StaticCharacterRegistration[]>>;
  availableForLinkingByGroup: Record<string, Record<string, LinkedCharacterSummary[]>>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchRegistrations: ReturnType<typeof vi.fn>;
  createRegistration: ReturnType<typeof vi.fn>;
  updateRegistration: ReturnType<typeof vi.fn>;
  setPrimaryRegistration: ReturnType<typeof vi.fn>;
  deleteRegistration: ReturnType<typeof vi.fn>;
  clearGroup: ReturnType<typeof vi.fn>;
} = {
  registrationsByGroup: {},
  availableForLinkingByGroup: {},
  isLoading: false,
  isSaving: false,
  error: null,
  fetchRegistrations: vi.fn(),
  createRegistration: vi.fn(),
  updateRegistration: vi.fn(),
  setPrimaryRegistration: vi.fn(),
  deleteRegistration: vi.fn(),
  clearGroup: vi.fn(),
};

vi.mock('../../stores/staticCharacterStore', () => ({
  useStaticCharacterStore: () => storeState,
}));

vi.mock('../ui/JobIcon', () => ({ JobIcon: () => null }));
vi.mock('./CharacterSyncBadge', () => ({ CharacterSyncBadge: () => null }));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Modal uses useDevice which calls window.matchMedia — not available in JSDOM
vi.mock('../../hooks/useDevice', () => ({
  useDevice: () => ({ prefersReducedMotion: true, isMobile: false }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

const GROUP_ID = 'g1';
const PLAYER = makePlayer();

describe('RosterCharacterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.registrationsByGroup = {};
    storeState.availableForLinkingByGroup = {};
    storeState.isLoading = false;
    storeState.isSaving = false;
    storeState.error = null;
    storeState.fetchRegistrations.mockResolvedValue(undefined);
    storeState.createRegistration.mockResolvedValue(undefined);
    storeState.updateRegistration.mockResolvedValue(undefined);
    storeState.setPrimaryRegistration.mockResolvedValue(undefined);
    storeState.deleteRegistration.mockResolvedValue(undefined);
  });

  // ── Lifecycle / loading ─────────────────────────────────────────────────────

  it('calls fetchRegistrations with the groupId on mount', () => {
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(storeState.fetchRegistrations).toHaveBeenCalledWith(GROUP_ID);
  });

  it('shows loading skeleton when isLoading is true', () => {
    storeState.isLoading = true;
    const { container } = render(
      <RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />,
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(screen.queryByText('Warrior Main')).toBeNull();
  });

  it('shows error message when error is set', () => {
    storeState.error = 'Network failure';
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.getByText(/network failure/i)).toBeTruthy();
  });

  // ── Empty roster ────────────────────────────────────────────────────────────

  it('shows "No roster members found" when players list is empty', () => {
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[]} canEdit={false} />);
    expect(screen.getByText(/no roster members found/i)).toBeTruthy();
  });

  // ── Player card ─────────────────────────────────────────────────────────────

  it('renders player name in card header', () => {
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.getByText('Warrior Main')).toBeTruthy();
  });

  it('shows "No characters registered" empty state for player with no registrations', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: {} };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.getByText(/no characters registered/i)).toBeTruthy();
  });

  // ── Registration display ─────────────────────────────────────────────────────

  it('shows resolved character name and world when a registration exists', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: { p1: [makeReg()] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.getByText('Test Character')).toBeTruthy();
    expect(screen.getByText('Tonberry')).toBeTruthy();
  });

  it('shows "Alt" role badge for an alt registration', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: { p1: [makeReg({ roleInStatic: 'alt' })] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.getByText('Alt')).toBeTruthy();
  });

  it('shows "Main" role badge for a main registration', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: { p1: [makeReg({ roleInStatic: 'main' })] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.getByText('Main')).toBeTruthy();
  });

  it('shows primary star indicator for a primary registration', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: { p1: [makeReg({ isPrimaryForStatic: true })] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.getByLabelText('Primary character')).toBeTruthy();
  });

  it('renders multiple registrations under one player', () => {
    storeState.registrationsByGroup = {
      [GROUP_ID]: {
        p1: [
          makeReg({ id: 'r1', resolvedName: 'Alpha Character', manualCharacterName: 'Alpha Character' }),
          makeReg({ id: 'r2', resolvedName: 'Beta Character', manualCharacterName: 'Beta Character', roleInStatic: 'main' }),
        ],
      },
    };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.getByText('Alpha Character')).toBeTruthy();
    expect(screen.getByText('Beta Character')).toBeTruthy();
    expect(screen.getByText('Alt')).toBeTruthy();
    expect(screen.getByText('Main')).toBeTruthy();
  });

  // ── Editor controls ──────────────────────────────────────────────────────────

  it('shows set-primary and delete buttons for editor when character is not primary', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: { p1: [makeReg({ isPrimaryForStatic: false })] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={true} />);
    expect(screen.getByRole('button', { name: /set test character as primary/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /remove test character/i })).toBeTruthy();
  });

  it('does not show set-primary button when character is already primary', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: { p1: [makeReg({ isPrimaryForStatic: true })] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={true} />);
    expect(screen.queryByRole('button', { name: /set test character as primary/i })).toBeNull();
  });

  it('does not show edit controls for viewers', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: { p1: [makeReg({ isPrimaryForStatic: false })] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.queryByRole('button', { name: /set.*primary/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
  });

  // ── Empty-state CTAs ─────────────────────────────────────────────────────────

  it('shows "Add manually" CTA in empty state for editor', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: {} };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={true} />);
    expect(screen.getByRole('button', { name: /add manually/i })).toBeTruthy();
  });

  it('does not show add CTAs for viewers', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: {} };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={false} />);
    expect(screen.queryByRole('button', { name: /add manually/i })).toBeNull();
  });

  it('shows "Link Player Hub character" CTA when available characters exist and canEdit', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: {} };
    storeState.availableForLinkingByGroup = { [GROUP_ID]: { p1: [makeAvailChar()] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={true} />);
    expect(screen.getByText('Link Player Hub character')).toBeTruthy();
  });

  it('does not show link CTA when no available chars and canEdit', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: {} };
    storeState.availableForLinkingByGroup = { [GROUP_ID]: {} };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={true} />);
    expect(screen.queryByText('Link Player Hub character')).toBeNull();
  });

  // ── Configured count ─────────────────────────────────────────────────────────

  it('shows correct configured count in header', () => {
    const p1 = makePlayer({ id: 'p1', name: 'Player 1' });
    const p2 = makePlayer({ id: 'p2', name: 'Player 2' });
    storeState.registrationsByGroup = { [GROUP_ID]: { p1: [makeReg({ snapshotPlayerId: 'p1' })] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[p1, p2]} canEdit={false} />);
    expect(screen.getByText('1/2 configured')).toBeTruthy();
  });

  it('shows 0/N when no players are configured', () => {
    const p1 = makePlayer({ id: 'p1', name: 'Player 1' });
    const p2 = makePlayer({ id: 'p2', name: 'Player 2' });
    storeState.registrationsByGroup = { [GROUP_ID]: {} };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[p1, p2]} canEdit={false} />);
    expect(screen.getByText('0/2 configured')).toBeTruthy();
  });

  // ── Modal open on CTA click ──────────────────────────────────────────────────

  it('opens the add manual character modal when "Add manually" CTA is clicked', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: {} };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /add manually/i }));
    expect(screen.getByText('Add Character')).toBeTruthy();
    expect(screen.getByText(/for warrior main/i)).toBeTruthy();
  });

  it('opens the link modal when "Link Player Hub character" CTA is clicked', () => {
    storeState.registrationsByGroup = { [GROUP_ID]: {} };
    storeState.availableForLinkingByGroup = { [GROUP_ID]: { p1: [makeAvailChar()] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={true} />);
    fireEvent.click(screen.getByText('Link Player Hub character'));
    expect(screen.getByText('Link Character')).toBeTruthy();
    // Available character should appear in the modal
    expect(screen.getByText('Hub Character')).toBeTruthy();
  });

  it('shows character names from the available list inside link modal', () => {
    const avail = makeAvailChar({ id: 'c1', name: 'AltOne Duskwood', server: 'Leviathan', dataCenter: null });
    storeState.registrationsByGroup = { [GROUP_ID]: {} };
    storeState.availableForLinkingByGroup = { [GROUP_ID]: { p1: [avail] } };
    render(<RosterCharacterPanel groupId={GROUP_ID} players={[PLAYER]} canEdit={true} />);
    fireEvent.click(screen.getByText('Link Player Hub character'));
    expect(screen.getByText('AltOne Duskwood')).toBeTruthy();
    // server text is combined with optional dataCenter in one <p>; use regex
    expect(screen.getByText(/leviathan/i)).toBeTruthy();
  });
});
