/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobSelector } from './JobSelector';

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

describe('JobSelector', () => {
  it('calls onChange with the job appended in selection order', () => {
    const onChange = vi.fn();
    render(<JobSelector selectedJobs={['WAR']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /WHM/ }));
    expect(onChange).toHaveBeenCalledWith(['WAR', 'WHM']);
  });

  it('removes an already-selected job on click', () => {
    const onChange = vi.fn();
    render(<JobSelector selectedJobs={['WAR', 'WHM']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /WAR/ }));
    expect(onChange).toHaveBeenCalledWith(['WHM']);
  });

  it('renders existingJobs as already-selected (disabled)', () => {
    render(<JobSelector selectedJobs={[]} onChange={vi.fn()} existingJobs={['WAR']} />);
    expect(screen.getByRole('button', { name: /WAR/ })).toBeDisabled();
  });

  it('shows order badges when showOrderBadges is set', () => {
    render(<JobSelector selectedJobs={['WAR']} onChange={vi.fn()} showOrderBadges />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders role filter chips when showRoleFilters is set', () => {
    render(<JobSelector selectedJobs={[]} onChange={vi.fn()} showRoleFilters />);
    expect(screen.getByRole('button', { name: /Tanks/ })).toBeInTheDocument();
  });
});
