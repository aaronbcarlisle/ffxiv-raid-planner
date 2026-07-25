/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightDockPanel } from './RightDockPanel';

describe('RightDockPanel', () => {
  it('renders children when open', () => {
    render(<RightDockPanel isOpen onClose={vi.fn()} width="48rem"><div>DOCK_BODY</div></RightDockPanel>);
    expect(screen.getByText('DOCK_BODY')).toBeInTheDocument();
  });

  it('keeps children mounted but hides the panel when closed', () => {
    render(<RightDockPanel isOpen={false} onClose={vi.fn()} width="48rem"><div>DOCK_BODY</div></RightDockPanel>);
    // Content stays mounted (so re-opening is instant)…
    const body = screen.getByText('DOCK_BODY');
    expect(body).toBeInTheDocument();
    // …but the panel is inert and not shown as the backdrop is gone.
    const panel = body.closest('[role="dialog"]');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByTestId('rightdock-backdrop')).not.toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<RightDockPanel isOpen onClose={onClose} width="48rem"><div>DOCK_BODY</div></RightDockPanel>);
    fireEvent.click(screen.getByTestId('rightdock-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
