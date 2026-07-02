/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TriStateToggle } from './TriStateToggle';

beforeEach(() => {
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
    }))
  );
});

describe('TriStateToggle', () => {
  it('renders three labeled segments', () => {
    render(<TriStateToggle value="have" onChange={vi.fn()} />);
    expect(screen.getByText('Have')).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('marks the active segment with aria-pressed', () => {
    render(<TriStateToggle value="missing" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Missing/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Have/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onChange with the clicked state', () => {
    const onChange = vi.fn();
    render(<TriStateToggle value="have" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Unknown/ }));
    expect(onChange).toHaveBeenCalledWith('unknown');
  });

  it('honors custom labels', () => {
    render(<TriStateToggle value="have" onChange={vi.fn()} labels={{ have: 'Owned', missing: 'Need', unknown: 'Unsure' }} />);
    expect(screen.getByText('Owned')).toBeInTheDocument();
    expect(screen.getByText('Need')).toBeInTheDocument();
    expect(screen.getByText('Unsure')).toBeInTheDocument();
  });

  it('does not fire onChange when disabled', () => {
    const onChange = vi.fn();
    render(<TriStateToggle value="have" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('button', { name: /Missing/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
