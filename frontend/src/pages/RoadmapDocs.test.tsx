import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RoadmapDocs from './RoadmapDocs';

beforeAll(() => {
  // jsdom lacks these; the page scrolls and observes on mount.
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollIntoView = (() => {}) as Element['scrollIntoView'];
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/docs/roadmap']}>
      <RoadmapDocs />
    </MemoryRouter>,
  );
}

function section(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`#${id}`);
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

describe('RoadmapDocs', () => {
  it('lists Mobile Optimization under Planned, not In Progress (R-P1-E)', () => {
    const { container } = renderPage();
    const planned = section(container, 'planned');
    expect(within(planned).getByText('Mobile Optimization')).toBeInTheDocument();
    const inProgress = section(container, 'in-progress');
    expect(within(inProgress).queryByText('Mobile Optimization')).not.toBeInTheDocument();
  });

  it('gives Mobile Optimization one item and drops the legacy-era ones (OQ-2)', () => {
    const { container } = renderPage();
    const planned = section(container, 'planned');
    // Planned phase cards render collapsed; expand the Mobile Optimization card.
    fireEvent.click(within(planned).getByRole('button', { name: /Mobile Optimization/ }));
    expect(within(planned).getByText('Mobile layout for the new interface')).toBeInTheDocument();
    expect(within(planned).getByText('Planned - part of the new interface')).toBeInTheDocument();
    expect(screen.queryByText('Responsive layouts for phone screens')).not.toBeInTheDocument();
    expect(screen.queryByText('Touch-friendly controls and bottom navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('PWA support for home screen install')).not.toBeInTheDocument();
    expect(screen.queryByText('Device capability detection')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional polish and refinements')).not.toBeInTheDocument();
  });

  it('no longer lists the "Large component files" known issue, but keeps the section (OQ-1)', () => {
    const { container } = renderPage();
    expect(screen.queryByText('Large component files')).not.toBeInTheDocument();
    const issues = section(container, 'known-issues');
    expect(within(issues).getByText('No known issues right now.')).toBeInTheDocument();
    expect(within(issues).queryByText(/tracked internally/i)).not.toBeInTheDocument();
    // The docs nav still lists the section.
    expect(screen.getAllByText('Known issues').length).toBeGreaterThan(0);
  });
});
