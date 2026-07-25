/**
 * @vitest-environment jsdom
 *
 * AdminLayout — the Stage-1 T5 fitting seam (matrix A3).
 *
 * Under v2 chrome the bar above is `h-14` (3.5rem), not the legacy Header's
 * 4rem, and AppChrome owns the page's single `<main id="main-content">` — so
 * the nested `<main>` becomes a `<div>` (two <main> landmarks on one page is an
 * a11y defect). The gate is the chrome context, whose provider exists only
 * inside AppChrome; the without-provider rows are the legacy pin, asserting the
 * ORIGINAL element and class literals byte-for-byte.
 *
 * A1/A2 (the AdminSidebar and its mobile FAB) are KEPT unchanged — stubbed here
 * so this suite is about the wrapper only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../components/admin/AdminSidebar', () => ({
  AdminSidebar: () => <div data-testid="admin-sidebar" />,
}));

import { AdminLayout } from './AdminLayout';
import { V2ChromeContext } from '../lib/chromeContext';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 'u1', isAdmin: true } as unknown as User,
    isAuthenticated: true,
    isLoading: false,
    authInitialized: true,
  });
});

function renderAdmin(inV2Chrome?: boolean) {
  const layout = (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<div data-testid="admin-outlet" />} />
      </Route>
    </Routes>
  );
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      {inV2Chrome ? <V2ChromeContext.Provider value={true}>{layout}</V2ChromeContext.Provider> : layout}
    </MemoryRouter>,
  );
}

describe('AdminLayout — legacy chrome (the pin)', () => {
  it('keeps the nested <main> and the 4rem height reservation', () => {
    const { container } = renderAdmin(false);
    const wrapper = container.querySelector('div.flex');
    expect(wrapper?.className).toBe('flex min-h-[calc(100vh-4rem)]');
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main?.className).toBe('flex-1 p-6 overflow-y-auto');
    expect(main).toContainElement(screen.getByTestId('admin-outlet'));
    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
  });
});

describe('AdminLayout — v2 chrome seam (A3)', () => {
  it('reserves 3.5rem (the v2 top bar) instead of 4rem', () => {
    const { container } = renderAdmin(true);
    const wrapper = container.querySelector('div.flex');
    expect(wrapper?.className).toBe('flex min-h-[calc(100vh-3.5rem)]');
  });

  it('renders the content area as a <div> so AppChrome owns the only <main>', () => {
    const { container } = renderAdmin(true);
    expect(container.querySelector('main')).toBeNull();
    const content = container.querySelector('div.flex-1');
    expect(content?.className).toBe('flex-1 p-6 overflow-y-auto');
    expect(content).toContainElement(screen.getByTestId('admin-outlet'));
  });

  it('leaves the sidebar (A1/A2) untouched', () => {
    renderAdmin(true);
    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
  });
});
