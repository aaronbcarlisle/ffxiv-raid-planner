/**
 * CharacterSelector — unit tests
 *
 * Verifies the empty-candidates state messaging updated for
 * Roster → Characters integration.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharacterSelector } from './CharacterSelector';

vi.mock('../../utils/splitClearScoringService', () => ({
  isSyncStale: () => false,
  formatSyncLabel: () => 'Synced',
}));

describe('CharacterSelector', () => {
  it('shows "No registered characters" when candidates is empty and canEdit', () => {
    render(
      <CharacterSelector
        label="Run A"
        candidates={[]}
        selectedId={null}
        conflictId={null}
        onChange={vi.fn()}
        canEdit={true}
      />,
    );
    const btn = screen.getByRole('button', { name: /no registered characters/i });
    expect(btn).toBeTruthy();
    expect(btn).toHaveAttribute('title', 'Register characters in Roster → Characters');
    expect(btn).toBeDisabled();
  });

  it('shows nothing interactive when candidates is empty and not canEdit', () => {
    render(
      <CharacterSelector
        label="Run A"
        candidates={[]}
        selectedId={null}
        conflictId={null}
        onChange={vi.fn()}
        canEdit={false}
      />,
    );
    // Read-only mode: shows a dash, no button
    expect(screen.queryByRole('button')).toBeNull();
  });
});
