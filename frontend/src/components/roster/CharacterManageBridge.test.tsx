/**
 * CharacterManageBridge — unit tests
 *
 * Covers:
 *   - Trigger renders, panel not shown initially
 *   - Clicking the trigger opens the modal hosting RosterCharacterPanel
 */

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SnapshotPlayer } from '../../types';
import { CharacterManageBridge } from './CharacterManageBridge';

vi.mock('./RosterCharacterPanel', () => ({
  RosterCharacterPanel: () => <div data-testid="char-panel" />,
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

describe('CharacterManageBridge', () => {
  it('opens the character panel in a modal', () => {
    render(<CharacterManageBridge groupId="g1" players={PLAYERS} canEdit />);

    expect(screen.queryByTestId('char-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /manage characters/i }));

    expect(screen.getByTestId('char-panel')).toBeInTheDocument();
  });

  it('closes the modal when the close button is clicked', () => {
    render(<CharacterManageBridge groupId="g1" players={PLAYERS} canEdit />);

    fireEvent.click(screen.getByRole('button', { name: /manage characters/i }));
    expect(screen.getByTestId('char-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close modal/i }));
    expect(screen.queryByTestId('char-panel')).not.toBeInTheDocument();
  });
});
