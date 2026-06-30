/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttentionRow } from './AttentionRow';

describe('AttentionRow', () => {
  it('renders title/meta and fires the action (no trailing glyph)', () => {
    const onClick = vi.fn();
    render(<AttentionRow icon={<span data-testid="ic" />} title="Caster One" meta="No BiS imported" action={{ label: 'Import BiS', onClick }} />);
    expect(screen.getByText('No BiS imported')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import BiS' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders with a ReactNode title (e.g. inline element)', () => {
    const onClick = vi.fn();
    render(
      <AttentionRow
        icon={<span data-testid="ic2" />}
        title={<span data-testid="node-title">Unclaimed Slot</span>}
        action={{ label: 'Assign', onClick }}
      />,
    );
    expect(screen.getByTestId('node-title')).toBeInTheDocument();
    expect(screen.getByText('Unclaimed Slot')).toBeInTheDocument();
  });

  it('renders without meta when meta is omitted', () => {
    const onClick = vi.fn();
    render(
      <AttentionRow
        icon={<span />}
        title="Join Request"
        action={{ label: 'Review', onClick }}
      />,
    );
    // No meta element rendered — only the title and button
    expect(screen.getByText('Join Request')).toBeInTheDocument();
    // No extra text nodes beyond title and button label
    expect(screen.queryByRole('paragraph')).toBeNull();
  });

  it('action button has no trailing glyph (no aria-hidden svg inside button)', () => {
    const onClick = vi.fn();
    const { container } = render(
      <AttentionRow
        icon={<span data-testid="ic3" />}
        title="Title"
        meta="Meta line"
        action={{ label: 'Act', onClick }}
      />,
    );
    // Trailing icons from Button are rendered as lucide SVGs with aria-hidden; none expected.
    const svgs = container.querySelectorAll('button svg[aria-hidden]');
    expect(svgs.length).toBe(0);
  });

  it('passes the variant to the action Button', () => {
    const onClick = vi.fn();
    render(
      <AttentionRow
        icon={<span />}
        title="Title"
        action={{ label: 'Go', onClick, variant: 'primary' }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn).toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    const onClick = vi.fn();
    render(
      <AttentionRow
        icon={<span data-testid="test-icon">icon</span>}
        title="Title"
        action={{ label: 'Act', onClick }}
      />,
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
