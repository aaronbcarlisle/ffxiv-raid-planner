import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, it, expect } from 'vitest';
vi.mock('./GroupView', () => ({ GroupView: () => <div data-testid="legacy" /> }));
vi.mock('./NewShell', () => ({ NewShell: () => <div data-testid="v2" /> }));
import { GroupRoute } from './GroupRoute';

const at = (url: string) => render(
  <MemoryRouter initialEntries={[url]}><Routes><Route path="group/:c" element={<GroupRoute />} /></Routes></MemoryRouter>
);
it('renders legacy GroupView without ?shell=v2', () => { at('/group/ABC'); expect(screen.getByTestId('legacy')).toBeInTheDocument(); });
// NewShell is lazy-loaded behind Suspense; findByTestId waits for the Promise to resolve.
it('renders NewShell with ?shell=v2', async () => { at('/group/ABC?shell=v2'); expect(await screen.findByTestId('v2')).toBeInTheDocument(); });
