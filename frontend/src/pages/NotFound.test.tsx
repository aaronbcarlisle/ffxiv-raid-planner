/**
 * @vitest-environment jsdom
 *
 * NotFound — global 404 page (Phase A, A7).
 * Renders heading + description + CTA; CTA navigates to '/' unconditionally
 * (approved skim default §6.7 — the index route handles auth-state routing).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mock useNavigate ─────────────────────────────────────────────────────────
// Must be declared before vi.mock so the factory can close over it.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { NotFound } from './NotFound';

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('NotFound', () => {
  it('renders the heading, description, and CTA', () => {
    render(
      <MemoryRouter initialEntries={['/this/route/does-not-exist']}>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText("This page doesn't exist or has moved.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Home' })).toBeInTheDocument();
  });

  it('CTA navigates to / unconditionally', () => {
    render(
      <MemoryRouter initialEntries={['/this/route/does-not-exist']}>
        <NotFound />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
