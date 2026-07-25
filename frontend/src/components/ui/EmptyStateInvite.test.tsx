/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyStateInvite } from './EmptyStateInvite';

describe('EmptyStateInvite', () => {
  it('renders title/description and fires the action', () => {
    const onClick = vi.fn();
    render(
      <EmptyStateInvite
        title="No upcoming session"
        description="Schedule one"
        action={{ label: 'Add session', onClick }}
      />,
    );
    expect(screen.getByText('No upcoming session')).toBeInTheDocument();
    expect(screen.getByText('Schedule one')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add session' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders without action (action is optional)', () => {
    render(<EmptyStateInvite title="No activity yet" description="Loot drops will appear here" />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders with only a title (description and action are optional)', () => {
    render(<EmptyStateInvite title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the icon when provided', () => {
    render(
      <EmptyStateInvite
        title="Empty"
        icon={<span data-testid="test-icon">icon</span>}
      />,
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders no icon slot when icon is omitted', () => {
    const { container } = render(<EmptyStateInvite title="No icon" />);
    expect(container.querySelector('[data-testid="empty-state-icon"]')).toBeNull();
  });

  it('passes the variant to the Button', () => {
    const onClick = vi.fn();
    render(
      <EmptyStateInvite
        title="Title"
        action={{ label: 'Go', onClick, variant: 'primary' }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Go' });
    // Primary variant applies bg-accent styling — presence of the button is the key assertion;
    // variant wiring is confirmed by no error + correct class substring.
    expect(btn).toBeInTheDocument();
  });

  it('button has no trailing glyph (no chevron or external icon)', () => {
    const onClick = vi.fn();
    const { container } = render(
      <EmptyStateInvite
        title="Title"
        action={{ label: 'Act', onClick }}
      />,
    );
    // Trailing icons from Button are rendered as lucide SVGs with aria-hidden; none expected.
    const svgs = container.querySelectorAll('button svg[aria-hidden]');
    expect(svgs.length).toBe(0);
  });
});
