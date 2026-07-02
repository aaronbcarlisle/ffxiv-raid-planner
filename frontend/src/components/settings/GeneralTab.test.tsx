/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeneralTab } from './GeneralTab';

const updatePreferences = vi.fn();
vi.mock('../../stores/authStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: (sel?: any) => {
    const state = { user: { id: 'u', tabPersistence: 'remember' }, updatePreferences };
    return sel ? sel(state) : state;
  },
}));

describe('GeneralTab', () => {
  it('renders the tab-persistence control', () => {
    render(<GeneralTab />);
    expect(screen.getByText(/reset tabs to default/i)).toBeInTheDocument();
  });

  it('flips the preference to reset when toggled on', () => {
    render(<GeneralTab />);
    fireEvent.click(screen.getByRole('switch'));
    expect(updatePreferences).toHaveBeenCalledWith({ tabPersistence: 'reset' });
  });
});
