/**
 * Dashboard — the Stage-3 PH1 seam: under V2 chrome `/dashboard` redirects to
 * the Player Hub; the legacy page (no provider) still renders MyStaticsPanel.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { V2ChromeContext } from '../lib/chromeContext';

const authState = { isAuthenticated: true, isLoading: false, authInitialized: true };

vi.mock('../stores/authStore', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAuthStore: () => authState,
}));
vi.mock('../components/dashboard/MyStaticsPanel', () => ({
  MyStaticsPanel: () => <div data-testid="my-statics-panel" />,
}));

function renderDashboard(inV2Chrome: boolean) {
  const routes = (
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<div data-testid="profile-route" />} />
      </Routes>
    </MemoryRouter>
  );
  return render(inV2Chrome ? <V2ChromeContext.Provider value={true}>{routes}</V2ChromeContext.Provider> : routes);
}

describe('Dashboard — V2 seam', () => {
  it('under V2 chrome lands on /profile (the Hub Overview)', () => {
    renderDashboard(true);
    expect(screen.getByTestId('profile-route')).toBeInTheDocument();
    expect(screen.queryByTestId('my-statics-panel')).toBeNull();
  });

  it('without the provider renders MyStaticsPanel as before', () => {
    renderDashboard(false);
    expect(screen.getByTestId('my-statics-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-route')).toBeNull();
  });
});
