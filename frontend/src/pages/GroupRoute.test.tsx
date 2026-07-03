import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, it, expect } from 'vitest';
vi.mock('./GroupView', () => ({ GroupView: () => <div data-testid="legacy" /> }));
vi.mock('./NewShell', () => ({ NewShell: () => <div data-testid="v2" /> }));
import { GroupRoute } from './GroupRoute';

const at = (url: string) => render(
  <MemoryRouter initialEntries={[url]}><Routes><Route path="group/:c" element={<GroupRoute />} /></Routes></MemoryRouter>
);
it('renders NewShell by default (bare route, no ?shell)', async () => {
  at('/group/ABC');
  expect(await screen.findByTestId('v2')).toBeInTheDocument();
});
it('renders NewShell for ?shell=v2 (no-op alias survives)', async () => {
  at('/group/ABC?shell=v2');
  expect(await screen.findByTestId('v2')).toBeInTheDocument();
});
it('renders legacy GroupView for ?shell=legacy (escape hatch)', () => {
  at('/group/ABC?shell=legacy');
  expect(screen.getByTestId('legacy')).toBeInTheDocument();
});
