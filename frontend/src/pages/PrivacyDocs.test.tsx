/**
 * @vitest-environment jsdom
 *
 * PrivacyDocs — AD1b discloses the admin action log (data table row plus a
 * privacy-changes history card).
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '../components/primitives';
import { PrivacyDocs } from './PrivacyDocs';

// jsdom implements neither matchMedia (read by useDevice inside Tooltip) nor scrollTo.
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
    })),
  );
  vi.stubGlobal('scrollTo', vi.fn());
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/docs/privacy']}>
      <TooltipProvider>
        <PrivacyDocs />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe('PrivacyDocs admin action log disclosure', () => {
  it('lists the Admin Action Log in the data table and says no IP addresses are kept', () => {
    renderPage();
    expect(screen.getByRole('cell', { name: 'Admin Action Log' })).toBeTruthy();
    expect(screen.getAllByText(/No IP addresses/).length).toBeGreaterThan(0);
  });

  it('adds a privacy-changes history card headed v2.1.52 - Admin Action Log', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'v2.1.52 - Admin Action Log' }),
    ).toBeTruthy();
    expect(screen.getByText(/does not record IP addresses, browser details or secrets/)).toBeTruthy();
  });
});
