/**
 * TryNewUiBanner — legacy→v2 opt-in entry point (Phase R §5).
 * Shown only on a legacy-resolved group route, dismissible with persistence,
 * and its CTA must fire telemetry + preference + strip ?shell=.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TryNewUiBanner } from './TryNewUiBanner';
import { useShellPreferenceStore } from '../../lib/shellPreference';

const track = vi.fn();
vi.mock('../../services/analytics', () => ({ analytics: { track: (...a: unknown[]) => track(...a) } }));

function renderAt(url = '/group/ABC') {
  return render(<MemoryRouter initialEntries={[url]}><TryNewUiBanner /></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
  useShellPreferenceStore.setState({ preference: null });
});

describe('TryNewUiBanner', () => {
  it('renders the CTA on a legacy group route', () => {
    renderAt();
    expect(screen.getByRole('button', { name: /try the new ui/i })).toBeInTheDocument();
  });
  it('does not render when the shell resolves to v2', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt();
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
  });
  it('does not render when previously dismissed', () => {
    localStorage.setItem('ui-shell-banner-dismissed', 'true');
    renderAt();
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
  });
  it('CTA click fires telemetry, sets the preference, and strips ?shell=', () => {
    renderAt('/group/ABC?shell=legacy');
    fireEvent.click(screen.getByRole('button', { name: /try the new ui/i }));
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_toggle',
      { direction: 'to-v2', surface: 'legacy-banner' });
    expect(useShellPreferenceStore.getState().preference).toBe('v2');
    // The banner can only disappear if ?shell=legacy was actually stripped:
    // with the param intact the resolver keeps resolving legacy (param wins
    // over preference) and the banner stays. This makes the URL strip
    // observable through real behavior, not just implementation calls.
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
  });
  it('dismiss hides it, persists, and fires ui_shell_banner_dismiss', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
    expect(localStorage.getItem('ui-shell-banner-dismissed')).toBe('true');
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_banner_dismiss', {});
  });
});
