/**
 * Take Ownership is a write the server refuses to viewers (P0a R-P0-5/6), so the
 * card hides it from them in both places it appears: the setup-banner button and
 * the context menu. A member with no card still sees both, and self-release stays.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SnapshotPlayer, StaticSettings } from '../../types';
import type { MemberRole } from '../../utils/permissions';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Heavy children are irrelevant to the claim affordances.
vi.mock('./PlayerCardHeader', () => ({ PlayerCardHeader: () => null }));
vi.mock('./PlayerCardStatus', () => ({ PlayerCardStatus: () => null }));
vi.mock('./PlayerCardGear', () => ({ PlayerCardGear: () => null }));
vi.mock('./NeedsFooter', () => ({ NeedsFooter: () => null }));
vi.mock('./BiSSourceFixBanner', () => ({ BiSSourceFixBanner: () => null }));
vi.mock('./BiSImportModal', () => ({ BiSImportModal: () => null }));
vi.mock('../bis/BiSTargetManagerModal', () => ({ BiSTargetManagerModal: () => null }));
vi.mock('./LodestoneSearchModal', () => ({ LodestoneSearchModal: () => null }));
vi.mock('./FlexRolesModal', () => ({ FlexRolesModal: () => null }));
vi.mock('../weapon-priority/WeaponPriorityModal', () => ({ WeaponPriorityModal: () => null }));
vi.mock('./AssignUserModal', () => ({ AssignUserModal: () => null }));
vi.mock('./PriorityAdjustModal', () => ({ PriorityAdjustModal: () => null }));

import { PlayerCard } from './PlayerCard';
import { TooltipProvider } from '../primitives/Tooltip';

const player = {
  id: 'p1',
  name: 'Aria',
  job: 'PLD',
  role: 'tank',
  configured: true,
  sortOrder: 0,
  gear: [],
  isSubstitute: false,
  bisLink: 'https://xivgear.app/?page=sl|x',
} as unknown as SnapshotPlayer;

function renderCard(userRole: MemberRole, extra: { player?: SnapshotPlayer } = {}) {
  return render(
    <TooltipProvider>
      <PlayerCard
        player={extra.player ?? player}
        settings={{} as StaticSettings}
        viewMode="expanded"
        contentType="savage"
        clipboardPlayer={null}
        currentUserId="u1"
        userRole={userRole}
        userHasClaimedPlayer={false}
        groupId="g1"
        tierId="t1"
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onCopy={vi.fn()}
        onPaste={vi.fn()}
        onDuplicate={vi.fn()}
        onClaimPlayer={vi.fn()}
        onReleasePlayer={vi.fn()}
      />
    </TooltipProvider>,
  );
}

function openMenu() {
  fireEvent.contextMenu(screen.getByTestId('player-card'));
}

describe('PlayerCard Take Ownership', () => {
  it('is hidden from a viewer with no card, in the banner and the context menu', () => {
    renderCard('viewer');
    expect(screen.queryByRole('button', { name: /Take Ownership/ })).not.toBeInTheDocument();
    openMenu();
    expect(screen.queryByText('Take Ownership')).not.toBeInTheDocument();
  });

  it('is shown to a member with no card, in the banner and the context menu', () => {
    renderCard('member');
    expect(screen.getByRole('button', { name: /Take Ownership/ })).toBeInTheDocument();
    openMenu();
    expect(screen.getAllByText('Take Ownership').length).toBeGreaterThan(1);
  });

  it('keeps Release Ownership for a viewer on their own card', () => {
    renderCard('viewer', { player: { ...player, userId: 'u1' } as SnapshotPlayer });
    openMenu();
    expect(screen.getByText('Release Ownership')).toBeInTheDocument();
  });
});
