/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from './Tabs';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'roster', label: 'Roster' },
];

describe('Tabs', () => {
  it('marks the active tab with aria-selected', () => {
    render(<Tabs tabs={TABS} value="roster" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Roster' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
  });

  it('fires onChange with the clicked tab id', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} value="overview" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Roster' }));
    expect(onChange).toHaveBeenCalledWith('roster');
  });
});
