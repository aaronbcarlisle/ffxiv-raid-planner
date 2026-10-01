/**
 * PlayerCardStatus (V1) — GUEST-2 R-G2-3. A guest's tier payload keeps `userId`
 * and sends `linkedUser: null`. V1's claimed-by badge needs `linkedUser`, so the
 * badge disappears: nothing names the claimant, and nothing reads as unclaimed.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlayerCardStatus } from './PlayerCardStatus';
import { TooltipProvider } from '../primitives';
import type { SnapshotPlayer } from '../../types';

// The badge's Tooltip reads useDevice, which needs matchMedia; jsdom has none.
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

const player = { id: 'p1', weaponPriorities: [] } as unknown as SnapshotPlayer;

function renderStatus(linkedUser: React.ComponentProps<typeof PlayerCardStatus>['linkedUser']) {
  return render(
    <TooltipProvider>
      <PlayerCardStatus
        role="tank"
        isSubstitute={false}
        userId="u-1"
        linkedUser={linkedUser}
        currentUserId=""
        player={player}
      />
    </TooltipProvider>,
  );
}

describe('PlayerCardStatus — claimed by someone else', () => {
  it('(pin) a guest payload (linkedUser null) renders no badge, no handle and no avatar', () => {
    const { container } = renderStatus(null);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('');
    expect(screen.queryByText(/discord|bram/i)).toBeNull();
  });

  it('(pin) a member payload still shows the linked user badge', () => {
    renderStatus({
      id: 'u-1',
      discordId: 'd1',
      discordUsername: 'bram',
      displayName: 'Bram',
      membershipRole: 'lead',
    });

    expect(screen.getByText('Bram')).toBeInTheDocument();
  });
});
