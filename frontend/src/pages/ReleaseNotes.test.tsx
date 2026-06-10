/**
 * ReleaseNotes commit-link rendering
 *
 * Regression coverage: release-note entries are authored in the same PR as the
 * change they describe, so the final squash SHA isn't known yet and entries go
 * in with a placeholder hash ('pending'). The page must never render a
 * placeholder as a GitHub commit link — `/commit/pending` 404s. Only real SHAs
 * get linked; placeholders show the message alone.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReleaseItemRow } from './ReleaseNotes';
import type { ReleaseItem } from '../data/releaseNotes';

function renderExpanded(item: ReleaseItem) {
  render(
    <ul>
      <ReleaseItemRow item={item} />
    </ul>
  );
  // The row collapses commits behind a toggle button; expand to reveal them.
  fireEvent.click(screen.getByRole('button'));
}

describe('ReleaseItemRow commit links', () => {
  it('links a real commit SHA to GitHub', () => {
    renderExpanded({
      category: 'fix',
      title: 'Real SHA item',
      commits: [{ hash: '21b7ee1', message: 'a real squash-merge commit' }],
    });

    const link = screen.getByRole('link', { name: '21b7ee1' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/aaronbcarlisle/ffxiv-raid-planner/commit/21b7ee1'
    );
  });

  it('does NOT link a "pending" placeholder hash', () => {
    renderExpanded({
      category: 'fix',
      title: 'Pending item',
      commits: [{ hash: 'pending', message: 'a not-yet-merged change' }],
    });

    // The message is still shown for context...
    expect(screen.getByText('a not-yet-merged change')).toBeInTheDocument();
    // ...but there is no link at all (no broken /commit/pending anchor).
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('pending')).toBeNull();
  });

  it('handles a mix: links the real SHA, skips the placeholder', () => {
    renderExpanded({
      category: 'improvement',
      title: 'Mixed item',
      commits: [
        { hash: 'abc1234', message: 'merged change' },
        { hash: 'pending', message: 'pending change' },
      ],
    });

    // Exactly one link — the real SHA — and both messages are present.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'href',
      'https://github.com/aaronbcarlisle/ffxiv-raid-planner/commit/abc1234'
    );
    expect(screen.getByText('merged change')).toBeInTheDocument();
    expect(screen.getByText('pending change')).toBeInTheDocument();
  });
});
