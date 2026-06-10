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

describe('ReleaseItemRow pull-request link', () => {
  it('links the PR number to the GitHub pull request', () => {
    renderExpanded({
      category: 'fix',
      title: 'PR item',
      pr: 127,
    });

    const link = screen.getByRole('link', { name: '#127' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/aaronbcarlisle/ffxiv-raid-planner/pull/127'
    );
  });

  it('makes a PR-only item expandable', () => {
    // pr alone must count as expandable content, or the toggle is disabled and
    // the link can never be revealed.
    render(
      <ul>
        <ReleaseItemRow item={{ category: 'fix', title: 'PR only', pr: 99 }} />
      </ul>
    );
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('renders no PR link when pr is absent', () => {
    renderExpanded({
      category: 'fix',
      title: 'No PR',
      details: 'some detail to make it expandable',
    });

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows the PR title next to the #pr link', () => {
    renderExpanded({
      category: 'fix',
      title: 'PR with title',
      pr: 125,
      prTitle: 'fix(player): keep focus when typing a space',
    });

    expect(screen.getByRole('link', { name: '#125' })).toBeInTheDocument();
    expect(screen.getByText('fix(player): keep focus when typing a space')).toBeInTheDocument();
  });

  it('renders both the PR link and Related Commits when both are present', () => {
    renderExpanded({
      category: 'fix',
      title: 'PR and commits',
      pr: 98,
      prTitle: 'Mobile Polish and CI/CD fixes',
      commits: [{ hash: 'dee3a1d', message: 'fix(mobile): prevent dropdown overflow' }],
    });

    // PR link + its title...
    expect(screen.getByRole('link', { name: '#98' })).toHaveAttribute(
      'href',
      'https://github.com/aaronbcarlisle/ffxiv-raid-planner/pull/98'
    );
    expect(screen.getByText('Mobile Polish and CI/CD fixes')).toBeInTheDocument();
    // ...and the commit link + message both still render.
    expect(screen.getByRole('link', { name: 'dee3a1d' })).toHaveAttribute(
      'href',
      'https://github.com/aaronbcarlisle/ffxiv-raid-planner/commit/dee3a1d'
    );
    expect(screen.getByText('fix(mobile): prevent dropdown overflow')).toBeInTheDocument();
  });
});
