/**
 * TryNewUiBanner — legacy→v2 opt-in entry point (Phase R §5).
 * Shown only on a legacy-resolved group route, dismissible with persistence,
 * and its CTA must fire telemetry + preference + strip ?shell=.
 *
 * Launch gate: admin-only until the v2 coverage Stage-1 launch criterion
 * (V2_COVERAGE_PLAN.md) — non-admins and guests must never see the banner.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TryNewUiBanner } from './TryNewUiBanner';
import { useShellPreferenceStore } from '../../lib/shellPreference';
import { useAuthStore } from '../../stores/authStore';

const track = vi.fn();
vi.mock('../../services/analytics', () => ({ analytics: { track: (...a: unknown[]) => track(...a) } }));

function renderAt(url = '/group/ABC') {
  return render(<MemoryRouter initialEntries={[url]}><TryNewUiBanner /></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
  useShellPreferenceStore.setState({ preference: null });
  // Launch-gate default: an admin viewer, so the pre-gate rendering tests
  // below keep exercising the banner's own behavior.
  useAuthStore.setState({ user: { id: 'u1', isAdmin: true } as never });
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
  it('does not render for a non-admin user (launch gate)', () => {
    useAuthStore.setState({ user: { id: 'u2', isAdmin: false } as never });
    renderAt();
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
  });
  it('does not render for guests (launch gate)', () => {
    useAuthStore.setState({ user: null });
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

  it('merges a caller className onto the root (the Header mobile row passes sm:hidden w-full)', () => {
    render(
      <MemoryRouter initialEntries={['/group/ABC']}>
        <TryNewUiBanner className="sm:hidden w-full" />
      </MemoryRouter>
    );
    const root = screen.getByRole('button', { name: /try the new ui/i }).closest('div');
    expect(root?.className).toContain('sm:hidden');
    expect(root?.className).toContain('w-full');
  });
});
