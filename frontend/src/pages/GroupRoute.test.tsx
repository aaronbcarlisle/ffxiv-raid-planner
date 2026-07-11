/**
 * GroupRoute — the Phase R dual-shell gate (3-way precedence).
 * Replaces the P2 gate test, which asserted a v2 default; the dual-shell
 * default is LEGACY (ROLLOUT_ROADMAP §2, user decision 2026-07-11).
 */
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupRoute } from './GroupRoute';
import { useShellPreferenceStore } from '../lib/shellPreference';

vi.mock('./GroupView', () => ({ GroupView: () => <div data-testid="legacy-shell" /> }));
vi.mock('./NewShell', () => ({ NewShell: () => <div data-testid="new-shell-mock" /> }));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/group/:shareCode" element={<GroupRoute />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useShellPreferenceStore.setState({ preference: null });
});

describe('GroupRoute precedence', () => {
  it('bare URL + no preference → legacy (the default)', () => {
    renderAt('/group/ABC');
    expect(screen.getByTestId('legacy-shell')).toBeInTheDocument();
  });
  it('preference v2 → NewShell', async () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt('/group/ABC');
    expect(await screen.findByTestId('new-shell-mock')).toBeInTheDocument();
  });
  it('?shell=legacy beats a v2 preference', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt('/group/ABC?shell=legacy');
    expect(screen.getByTestId('legacy-shell')).toBeInTheDocument();
  });
  it('?shell=v2 beats the legacy default', async () => {
    renderAt('/group/ABC?shell=v2');
    expect(await screen.findByTestId('new-shell-mock')).toBeInTheDocument();
  });
  it('unrecognized ?shell= falls through to the preference', async () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt('/group/ABC?shell=classic');
    expect(await screen.findByTestId('new-shell-mock')).toBeInTheDocument();
  });
  it('a preference change remounts the shell in place (no reload)', async () => {
    renderAt('/group/ABC');
    expect(screen.getByTestId('legacy-shell')).toBeInTheDocument();
    act(() => useShellPreferenceStore.getState().setPreference('v2'));
    expect(await screen.findByTestId('new-shell-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-shell')).toBeNull();
  });
});
