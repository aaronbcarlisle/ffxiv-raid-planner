/**
 * @vitest-environment jsdom
 *
 * SettingsGear — v2 TopBar settings affordance.
 * Tests: single IconButton, aria-expanded/pressed track isOpen, click toggles, no badge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';

import { SettingsGear } from './SettingsGear';

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
  // Reset settings panel to closed state
  useSettingsPanelStore.setState({ isOpen: false });
});

describe('SettingsGear', () => {
  it('renders a single button with aria-label "Settings"', () => {
    render(<SettingsGear />);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('has aria-expanded="false" and aria-pressed="false" when panel is closed', () => {
    useSettingsPanelStore.setState({ isOpen: false });
    render(<SettingsGear />);
    const btn = screen.getByRole('button', { name: 'Settings' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('has aria-expanded="true" and aria-pressed="true" when panel is open', () => {
    useSettingsPanelStore.setState({ isOpen: true });
    render(<SettingsGear />);
    const btn = screen.getByRole('button', { name: 'Settings' });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking opens the panel when it is closed', () => {
    useSettingsPanelStore.setState({ isOpen: false });
    render(<SettingsGear />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(useSettingsPanelStore.getState().isOpen).toBe(true);
  });

  it('clicking closes the panel when it is open', () => {
    useSettingsPanelStore.setState({ isOpen: true });
    render(<SettingsGear />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
  });

  it('renders no badge element (no join-request count or unread indicator)', () => {
    const { container } = render(<SettingsGear />);
    // SettingsGear is a plain gear toggle with no notification badge
    expect(container.querySelector('.bg-status-error')).toBeNull();
    expect(container.querySelector('.bg-accent')).toBeNull();
  });
});
