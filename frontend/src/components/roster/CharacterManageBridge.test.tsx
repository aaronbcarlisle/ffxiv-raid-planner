/**
 * CharacterManageBridge — unit tests
 *
 * Covers:
 *   - Trigger renders, panel not shown initially
 *   - Clicking the trigger opens the modal hosting RosterCharacterPanel
 *   - C8: the Lodestone sync section (D-12 flow re-home) — legacy's kebab entry
 *     (R-041) restored here, in the v2-owned wrapper, so the shared panel that
 *     both shells mount stays untouched
 */

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SnapshotPlayer } from '../../types';
import { CharacterManageBridge } from './CharacterManageBridge';

vi.mock('./RosterCharacterPanel', () => ({
  RosterCharacterPanel: () => <div data-testid="char-panel" />,
}));

// The real modal talks to /api/lodestone on mount. We only care that the bridge
// hands it the right target, so record the props instead. Typed to the contract
// the bridge actually passes, so `isOpen`/`onClose` stay real types rather than
// `unknown` needing a cast at every use.
interface MockLodestoneProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  playerId: string;
  playerName: string;
  tierId?: string;
  currentLodestoneId?: string | null;
}
const lodestoneProps = vi.fn();
vi.mock('../player/LodestoneSearchModal', () => ({
  LodestoneSearchModal: (props: MockLodestoneProps) => {
    lodestoneProps(props);
    return props.isOpen ? (
      <div data-testid="lodestone-modal">
        <button type="button" onClick={props.onClose}>close lodestone</button>
      </div>
    ) : null;
  },
}));

// Modal uses useDevice which calls window.matchMedia — not available in JSDOM
vi.mock('../../hooks/useDevice', () => ({
  useDevice: () => ({ isSmallScreen: false, isTouch: false, canHover: true, prefersReducedMotion: true }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const PLAYERS: SnapshotPlayer[] = [];

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

function openCharacters() {
  fireEvent.click(screen.getByRole('button', { name: /manage characters/i }));
}

describe('CharacterManageBridge', () => {
  it('opens the character panel in a modal', () => {
    render(<CharacterManageBridge groupId="g1" players={PLAYERS} canEdit />);

    expect(screen.queryByTestId('char-panel')).not.toBeInTheDocument();

    openCharacters();

    expect(screen.getByTestId('char-panel')).toBeInTheDocument();
  });

  it('closes the modal when the close button is clicked', () => {
    render(<CharacterManageBridge groupId="g1" players={PLAYERS} canEdit />);

    openCharacters();
    expect(screen.getByTestId('char-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close modal/i }));
    expect(screen.queryByTestId('char-panel')).not.toBeInTheDocument();
  });
});

describe('CharacterManageBridge — Lodestone sync (C8 / D-12)', () => {
  const players = [
    makePlayer({ id: 'p1', name: 'Warrior Main' }),
    makePlayer({ id: 'p2', name: 'Sage Main', job: 'SGE', lodestoneId: '910001', lodestoneName: 'Mock Raider', lodestoneServer: 'Gilgamesh' }),
  ];

  it('offers a Lodestone entry per player', () => {
    render(
      <CharacterManageBridge groupId="g1" players={players} canEdit userRole="owner" currentUserId="u1" isAdminAccess={false} />,
    );
    openCharacters();

    expect(screen.getByRole('button', { name: /Lodestone Sync for Warrior Main/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Re-sync Lodestone for Sage Main/i })).toBeInTheDocument();
  });

  it('names the linked character on a synced player', () => {
    render(
      <CharacterManageBridge groupId="g1" players={players} canEdit userRole="owner" currentUserId="u1" isAdminAccess={false} />,
    );
    openCharacters();

    expect(screen.getByText(/Mock Raider/)).toBeInTheDocument();
    expect(screen.getByText(/Gilgamesh/)).toBeInTheDocument();
  });

  it('opens the Lodestone modal on the player whose entry was clicked', () => {
    render(
      <CharacterManageBridge groupId="g1" players={players} canEdit userRole="owner" currentUserId="u1" isAdminAccess={false} tierId="t1" />,
    );
    openCharacters();

    expect(screen.queryByTestId('lodestone-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Re-sync Lodestone for Sage Main/i }));

    expect(screen.getByTestId('lodestone-modal')).toBeInTheDocument();
    expect(lodestoneProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isOpen: true,
        groupId: 'g1',
        playerId: 'p2',
        playerName: 'Sage Main',
        tierId: 't1',
        currentLodestoneId: '910001',
      }),
    );
  });

  // Stacking is unsafe here: each Modal registers its Escape handler on
  // `window` and the FIRST registered wins the `stopImmediatePropagation`
  // (`Modal.tsx:61-66`). With both open that is Characters, so Escape would shut
  // the modal BEHIND the user and the topmost sync modal would never see the
  // key; the two Tab traps compete for the same reason. (Only one closes, not
  // both — the first draft of this comment said otherwise.)
  it('hands off from Characters to Lodestone rather than stacking the two', () => {
    render(
      <CharacterManageBridge groupId="g1" players={players} canEdit userRole="owner" currentUserId="u1" isAdminAccess={false} />,
    );
    openCharacters();

    fireEvent.click(screen.getByRole('button', { name: /Lodestone Sync for Warrior Main/i }));

    expect(screen.getByTestId('lodestone-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('char-panel')).not.toBeInTheDocument();
  });

  it('returns to Characters when the Lodestone flow closes', () => {
    render(
      <CharacterManageBridge groupId="g1" players={players} canEdit userRole="owner" currentUserId="u1" isAdminAccess={false} />,
    );
    openCharacters();
    fireEvent.click(screen.getByRole('button', { name: /Lodestone Sync for Warrior Main/i }));

    fireEvent.click(screen.getByRole('button', { name: /close lodestone/i }));

    expect(screen.queryByTestId('lodestone-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('char-panel')).toBeInTheDocument();
  });

  // Legacy gates R-041 on canEditPlayer (per player), NOT on the roster-level
  // manage permission — a member can sync their own claimed card.
  it('lets a member sync their own card but not another player', () => {
    const own = makePlayer({ id: 'p1', name: 'Warrior Main', userId: 'u1' } as Partial<SnapshotPlayer>);
    const other = makePlayer({ id: 'p2', name: 'Sage Main', userId: 'u2' } as Partial<SnapshotPlayer>);

    render(
      <CharacterManageBridge
        groupId="g1"
        players={[own, other]}
        canEdit={false}
        userRole="member"
        currentUserId="u1"
        isAdminAccess={false}
      />,
    );
    openCharacters();

    expect(screen.getByRole('button', { name: /Lodestone Sync for Warrior Main/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Lodestone Sync for Sage Main/i })).toBeDisabled();
  });

  // Legacy renders a full PlayerCard — kebab and all — for substitutes
  // (`PlayerGrid.tsx:680-681`), and R-041 carries no isSubstitute condition. The
  // shared registry panel below keeps legacy's main-roster-only list.
  it('offers the entry to substitutes, who have no other v2 path to the flow', () => {
    const sub = makePlayer({ id: 'p3', name: 'Melee Two', isSubstitute: true });

    render(
      <CharacterManageBridge
        groupId="g1"
        players={players}
        syncPlayers={[...players, sub]}
        canEdit
        userRole="owner"
        currentUserId="u1"
        isAdminAccess={false}
      />,
    );
    openCharacters();

    expect(screen.getByRole('button', { name: /Lodestone Sync for Melee Two/i })).toBeEnabled();
    expect(screen.getByText('1/3 linked')).toBeInTheDocument();
  });

  // A disabled Button is `pointer-events-none`, so a native `title` can never
  // fire — the reason has to be rendered, not attached.
  it('shows why an entry is unavailable instead of only attaching a title', () => {
    render(
      <CharacterManageBridge groupId="g1" players={players} canEdit={false} userRole="viewer" currentUserId="u1" isAdminAccess={false} />,
    );
    openCharacters();

    expect(screen.getAllByText(/Viewers cannot edit players/i).length).toBeGreaterThan(0);
  });

  it('falls back to the same placeholder in the accessible name as on screen', () => {
    render(
      <CharacterManageBridge
        groupId="g1"
        players={[makePlayer({ id: 'p9', name: '' })]}
        canEdit
        userRole="owner"
        currentUserId="u1"
        isAdminAccess={false}
      />,
    );
    openCharacters();

    expect(screen.getByRole('button', { name: 'Lodestone Sync for —' })).toBeInTheDocument();
  });

  it('drops the sync target when that player leaves the roster mid-flow', () => {
    const { rerender } = render(
      <CharacterManageBridge groupId="g1" players={players} canEdit userRole="owner" currentUserId="u1" isAdminAccess={false} />,
    );
    openCharacters();
    fireEvent.click(screen.getByRole('button', { name: /Lodestone Sync for Warrior Main/i }));
    expect(screen.getByTestId('lodestone-modal')).toBeInTheDocument();

    // The player is removed while the flow is open (a poll or a roster edit).
    rerender(
      <CharacterManageBridge groupId="g1" players={[players[1]]} canEdit userRole="owner" currentUserId="u1" isAdminAccess={false} />,
    );

    // Not stranded between two shut dialogs — back in Characters.
    expect(screen.queryByTestId('lodestone-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('char-panel')).toBeInTheDocument();
  });

  it('disables every entry for a viewer', () => {
    render(
      <CharacterManageBridge groupId="g1" players={players} canEdit={false} userRole="viewer" currentUserId="u1" isAdminAccess={false} />,
    );
    openCharacters();

    expect(screen.getByRole('button', { name: /Lodestone Sync for Warrior Main/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Re-sync Lodestone for Sage Main/i })).toBeDisabled();
  });
});
