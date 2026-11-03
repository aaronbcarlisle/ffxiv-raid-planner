/**
 * ProgressToolbar (S2a-4a·A2 Task TA2; R-F-4, D-5, E-7): the Progress view bar. In DOM order it
 * holds the "Progress view" switch (Tracks · Find), Track a farm for leads only, then the page's
 * `editBar` node, which is hidden in Find. Its testid is `progress-view-bar`; the `editBar` keeps
 * its own (`progress-toolbar`, `EditStatusesBar`).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProgressToolbar } from './ProgressToolbar';

type Props = ComponentProps<typeof ProgressToolbar>;

function renderBar(props: Partial<Props> = {}) {
  const onView = vi.fn();
  const onTrackFarm = vi.fn();
  const base: Props = {
    view: 'tracks',
    onView,
    lead: true,
    editBar: <div data-testid="edit-bar-stub">edit bar</div>,
    onTrackFarm,
    ...props,
  };
  render(<ProgressToolbar {...base} />);
  return { onView: base.onView as typeof onView, onTrackFarm: base.onTrackFarm as typeof onTrackFarm };
}

const bar = () => screen.getByTestId('progress-view-bar');
const viewSwitch = () => within(bar()).getByRole('group', { name: 'Progress view' });
const trackAFarm = () => within(bar()).queryByRole('button', { name: 'Track a farm' });

describe('ProgressToolbar: the switch', () => {
  it('renders under the testid progress-view-bar with a "Progress view" group of Tracks then Find', () => {
    renderBar();
    expect(within(viewSwitch()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tracks', 'Find']);
  });

  it('presses the current view: Tracks', () => {
    renderBar({ view: 'tracks' });
    expect(within(viewSwitch()).getByRole('button', { name: 'Tracks' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(viewSwitch()).getByRole('button', { name: 'Find' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('presses the current view: Find', () => {
    renderBar({ view: 'find' });
    expect(within(viewSwitch()).getByRole('button', { name: 'Find' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(viewSwitch()).getByRole('button', { name: 'Tracks' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onView with the other view, once, and not on a re-click of the current one', () => {
    const { onView } = renderBar({ view: 'tracks' });
    fireEvent.click(within(viewSwitch()).getByRole('button', { name: 'Tracks' }));
    expect(onView).not.toHaveBeenCalled();
    fireEvent.click(within(viewSwitch()).getByRole('button', { name: 'Find' }));
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith('find');
  });

  it('calls onView("tracks") from Find', () => {
    const { onView } = renderBar({ view: 'find' });
    fireEvent.click(within(viewSwitch()).getByRole('button', { name: 'Tracks' }));
    expect(onView).toHaveBeenCalledWith('tracks');
  });

  it('renders for a non-lead with no edit bar: the switch alone', () => {
    renderBar({ lead: false, editBar: null });
    expect(viewSwitch()).toBeInTheDocument();
    expect(within(bar()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tracks', 'Find']);
  });
});

describe('ProgressToolbar: Track a farm', () => {
  it('is absent when the reader is not a lead', () => {
    renderBar({ lead: false });
    expect(trackAFarm()).not.toBeInTheDocument();
  });

  it('is a secondary Button with an icon for a lead, and calls onTrackFarm once', () => {
    const { onTrackFarm, onView } = renderBar({ lead: true });
    const button = trackAFarm()!;
    expect(button).toBeInTheDocument();
    // `variant="secondary"` (R-F-4): not ghost on bg-surface-elevated.
    expect(button).toHaveClass('bg-surface-elevated');
    expect(button.querySelector('svg')).not.toBeNull();
    fireEvent.click(button);
    expect(onTrackFarm).toHaveBeenCalledTimes(1);
    expect(onView).not.toHaveBeenCalled();
  });

  it('stays in Find', () => {
    renderBar({ lead: true, view: 'find' });
    expect(trackAFarm()).toBeInTheDocument();
  });
});

describe('ProgressToolbar: the edit bar', () => {
  it('renders the editBar node in Tracks', () => {
    renderBar({ view: 'tracks' });
    expect(within(bar()).getByTestId('edit-bar-stub')).toBeInTheDocument();
  });

  it('hides the editBar node in Find', () => {
    renderBar({ view: 'find' });
    expect(screen.queryByTestId('edit-bar-stub')).not.toBeInTheDocument();
  });

  it('holds, in DOM order, the switch, then Track a farm, then the edit bar', () => {
    renderBar();
    const order = [viewSwitch(), trackAFarm()!, screen.getByTestId('edit-bar-stub')];
    expect(order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(order[1].compareDocumentPosition(order[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
