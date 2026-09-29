/**
 * GroupRoute — the Recruiting sub-route under each shell (R-RH-G).
 *
 * `/group/:shareCode/recruit` is registered next to the group route with the
 * same gate. V1 never renders the page: the route replace-redirects to the
 * static and the classic GroupView mounts there. V2 renders NewShell on the
 * path itself (NewShell decides what body to show).
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ shell: 'legacy' as 'legacy' | 'v2' }));

vi.mock('../lib/shellPreference', () => ({ useResolvedShell: () => mocks.shell }));
vi.mock('./GroupView', () => ({ GroupView: () => <div data-testid="legacy-shell" /> }));
vi.mock('./NewShell', () => ({ NewShell: () => <div data-testid="new-shell-mock" /> }));

import { GroupRoute } from './GroupRoute';

function LocationProbe() {
  const loc = useLocation();
  const type = useNavigationType();
  return <div data-testid="location" data-path={loc.pathname + loc.search} data-type={type} />;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <LocationProbe />
      <Routes>
        <Route path="/group/:shareCode" element={<GroupRoute />} />
        <Route path="/group/:shareCode/recruit" element={<GroupRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.shell = 'legacy';
});

describe('GroupRoute — /group/:shareCode/recruit', () => {
  it('legacy: replace-redirects to /group/:shareCode and renders the classic GroupView there', () => {
    renderAt('/group/abc/recruit?rtab=listing');
    const probe = screen.getByTestId('location');
    expect(probe.getAttribute('data-path')).toBe('/group/abc');
    expect(probe.getAttribute('data-type')).toBe('REPLACE');
    expect(screen.getByTestId('legacy-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('new-shell-mock')).toBeNull();
  });

  it('v2: renders NewShell on the recruit path itself', async () => {
    mocks.shell = 'v2';
    renderAt('/group/abc/recruit');
    expect(await screen.findByTestId('new-shell-mock')).toBeInTheDocument();
    expect(screen.getByTestId('location').getAttribute('data-path')).toBe('/group/abc/recruit');
    expect(screen.queryByTestId('legacy-shell')).toBeNull();
  });

  it('legacy on the plain group route is untouched (no redirect, GroupView)', () => {
    renderAt('/group/abc?tab=roster');
    expect(screen.getByTestId('location').getAttribute('data-path')).toBe('/group/abc?tab=roster');
    expect(screen.getByTestId('legacy-shell')).toBeInTheDocument();
  });
});
