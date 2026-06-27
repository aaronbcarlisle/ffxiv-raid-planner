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

  it('does not render content when closed', () => {
    render(<RightDockPanel isOpen={false} onClose={vi.fn()} width="48rem"><div>DOCK_BODY</div></RightDockPanel>);
    expect(screen.queryByText('DOCK_BODY')).not.toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<RightDockPanel isOpen onClose={onClose} width="48rem"><div>DOCK_BODY</div></RightDockPanel>);
    fireEvent.click(screen.getByTestId('rightdock-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
