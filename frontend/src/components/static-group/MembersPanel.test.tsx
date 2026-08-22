/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembersPanel } from './MembersPanel';
import { TooltipProvider } from '../primitives';
import type { Membership, LinkedPlayerInfo } from '../../types';

beforeEach(() => {
  // jsdom has no matchMedia; Tooltip -> useDevice depends on it.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

// MembersPanel is a SHARED V1+V2 surface (static-group/MembersPanel.tsx) — Task 6
// (Phase D feedback-polish) swapped its avatarless-member/linked-player fallback
// over to the shared InitialsAvatar primitive under ruling R-V2 ("centering-only":
// swap is eligible only if V1's rendered output changes in glyph centering and
// nothing else). These tests pin that the visible text/color/size contract is
// byte-for-byte unchanged — only the centering mechanism (role="presentation") is new.

vi.mock('../../services/api', () => ({
  authRequest: vi.fn(),
}));

import { authRequest } from '../../services/api';

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'm1',
    userId: 'u1',
    staticGroupId: 'g1',
    role: 'member',
    joinedAt: '2026-01-01T00:00:00Z',
    user: {
      id: 'u1',
      discordId: 'd1',
      discordUsername: 'noavatar',
      displayName: 'No Avatar',
    },
    ...overrides,
  };
}

function linkedPlayer(overrides: Partial<LinkedPlayerInfo> = {}): LinkedPlayerInfo {
  return {
    playerId: 'p1',
    playerName: 'Some Player',
    playerJob: 'WAR',
    tierId: 't1',
    user: {
      id: 'u2',
      discordId: 'd2',
      discordUsername: 'linkeduser',
      displayName: 'Linked User',
    },
    ...overrides,
  };
}

function renderPanel() {
  // No currentUserRole -> canManage is false, so MembersPanel never calls
  // fetchRosterAlignment (a separate store/API surface unrelated to this swap).
  return render(
    <TooltipProvider>
      <MembersPanel groupId="g1" />
    </TooltipProvider>,
  );
}

describe('MembersPanel avatarless fallback (Task 6 InitialsAvatar swap, R-V2)', () => {
  it('members-list fallback: renders the same first-initial, through the shared primitive', async () => {
    vi.mocked(authRequest).mockImplementation(async (url: string) => {
      if (url.includes('/linked-players')) return [] as unknown;
      return [membership()] as unknown;
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText('No Avatar')).toBeInTheDocument());

    // Same text the pre-swap code produced: charAt(0).toUpperCase() of "No Avatar" = "N"
    const chip = screen.getByText('N');
    expect(chip).toHaveAttribute('role', 'presentation'); // InitialsAvatar's signature
    expect(chip).toHaveAttribute('aria-hidden', 'true');
    // Same Tailwind color classes as the pre-swap <div>/<span> pair (bg-accent/20 + text-accent)
    expect(chip.className).toContain('bg-accent/20');
    expect(chip.className).toContain('text-accent');
    expect(chip.style.width).toBe('32px');
    expect(chip.style.height).toBe('32px');
  });

  it('linked-players fallback: renders the same first-initial with membership-linked tokens', async () => {
    vi.mocked(authRequest).mockImplementation(async (url: string) => {
      if (url.includes('/linked-players')) return [linkedPlayer()] as unknown;
      return [] as unknown; // no members, so the linked player isn't filtered out
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText('Linked User')).toBeInTheDocument());

    const chip = screen.getByText('L');
    expect(chip).toHaveAttribute('role', 'presentation');
    expect(chip.className).toContain('bg-membership-linked/20');
    expect(chip.className).toContain('text-membership-linked');
    expect(chip.style.width).toBe('32px');
  });

  it('does not render the initials fallback when avatarUrl is present', async () => {
    vi.mocked(authRequest).mockImplementation(async (url: string) => {
      if (url.includes('/linked-players')) return [] as unknown;
      return [membership({ user: {
        id: 'u1', discordId: 'd1', discordUsername: 'has-avatar',
        displayName: 'Has Avatar', avatarUrl: 'https://cdn.discordapp.com/avatars/x.png',
      } })] as unknown;
    });
    renderPanel();

    await waitFor(() => expect(screen.getByText('Has Avatar')).toBeInTheDocument());
    expect(screen.queryByText('H')).not.toBeInTheDocument();
  });
});
