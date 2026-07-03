/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AvailabilityRecommendation } from './availabilityUtils';

// The design-system Select is Radix-based and impractical to drive in jsdom, so
// mock it with a native <select> to exercise the duration-change wiring.
vi.mock('../ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui')>();
  return {
    ...actual,
    Select: ({
      value,
      onChange,
      options,
      'aria-label': ariaLabel,
    }: {
      value: string;
      onChange: (v: string) => void;
      options: { value: string; label: string }[];
      'aria-label'?: string;
    }) => (
      <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
  };
});

import { BestTimesCard } from './BestTimesCard';
import { PersonLayerEntryPoint } from './PersonLayerEntryPoint';

function expectedWhen(startIso: string): string {
  const start = new Date(startIso);
  const weekday = start.toLocaleDateString('en-US', { weekday: 'short' });
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${time}`;
}

function makeRec(overrides: Partial<AvailabilityRecommendation>): AvailabilityRecommendation {
  return {
    id: '2026-07-06|18:00|60',
    startIso: '2026-07-06T18:00:00.000Z',
    endIso: '2026-07-06T19:00:00.000Z',
    slotKeys: [],
    availableCount: 8,
    totalMembers: 8,
    availableNames: [],
    missingNames: [],
    ...overrides,
  };
}

const recLow = makeRec({
  id: '2026-07-08|20:00|60',
  startIso: '2026-07-08T20:00:00.000Z',
  endIso: '2026-07-08T21:00:00.000Z',
  availableCount: 5,
  totalMembers: 8,
});
const recHigh = makeRec({
  id: '2026-07-06|18:00|60',
  startIso: '2026-07-06T18:00:00.000Z',
  endIso: '2026-07-06T19:00:00.000Z',
  availableCount: 8,
  totalMembers: 8,
});
const recMid = makeRec({
  id: '2026-07-07|19:00|60',
  startIso: '2026-07-07T19:00:00.000Z',
  endIso: '2026-07-07T20:00:00.000Z',
  availableCount: 7,
  totalMembers: 8,
});

describe('BestTimesCard', () => {
  it('renders rows in the given order without re-sorting', () => {
    const unsorted = [recLow, recHigh, recMid];
    render(
      <BestTimesCard
        recommendations={unsorted}
        durationMinutes={60}
        onDurationChange={vi.fn()}
        canManage={false}
      />,
    );

    const html = document.body.innerHTML;
    const idxLow = html.indexOf(expectedWhen(recLow.startIso));
    const idxHigh = html.indexOf(expectedWhen(recHigh.startIso));
    const idxMid = html.indexOf(expectedWhen(recMid.startIso));

    expect(idxLow).toBeGreaterThanOrEqual(0);
    expect(idxHigh).toBeGreaterThan(idxLow);
    expect(idxMid).toBeGreaterThan(idxHigh);

    const fills = screen.getAllByTestId('progress-fill');
    expect(fills[0]).toHaveStyle({ width: '63%' }); // 5/8
    expect(fills[1]).toHaveStyle({ width: '100%' }); // 8/8
    expect(fills[2]).toHaveStyle({ width: '88%' }); // 7/8
  });

  it('renders the n/N text via progress-fill width, not aria', () => {
    render(
      <BestTimesCard
        recommendations={[recHigh]}
        durationMinutes={60}
        onDurationChange={vi.fn()}
        canManage={false}
      />,
    );

    expect(screen.getByText('8/8')).toBeInTheDocument();
    const fill = screen.getByTestId('progress-fill');
    expect(fill).toHaveStyle({ width: '100%' });
    const track = fill.parentElement;
    expect(track).not.toHaveAttribute('role', 'progressbar');
  });

  it('renders the scheduled marker only for the matching rec', () => {
    render(
      <BestTimesCard
        recommendations={[recHigh, recMid]}
        durationMinutes={60}
        onDurationChange={vi.fn()}
        scheduledSlotIds={new Set(['2026-07-06|18:00'])}
        canManage={false}
      />,
    );

    expect(screen.getAllByText('· scheduled')).toHaveLength(1);
  });

  it('does not render the scheduled marker when no slot matches', () => {
    render(
      <BestTimesCard
        recommendations={[recMid]}
        durationMinutes={60}
        onDurationChange={vi.fn()}
        scheduledSlotIds={new Set(['2026-07-06|18:00'])}
        canManage={false}
      />,
    );

    expect(screen.queryByText('· scheduled')).not.toBeInTheDocument();
  });

  it('fires onDurationChange with a number when the duration select changes', () => {
    const onDurationChange = vi.fn();
    render(
      <BestTimesCard
        recommendations={[recHigh]}
        durationMinutes={60}
        onDurationChange={onDurationChange}
        canManage={false}
      />,
    );

    fireEvent.change(screen.getByLabelText('Session length'), { target: { value: '90' } });
    expect(onDurationChange).toHaveBeenCalledWith(90);
    expect(onDurationChange).toHaveBeenCalledTimes(1);
  });

  it('duration select exposes exactly the five duration options', () => {
    render(
      <BestTimesCard
        recommendations={[]}
        durationMinutes={60}
        onDurationChange={vi.fn()}
        canManage={false}
      />,
    );

    const select = screen.getByLabelText('Session length');
    const options = Array.from(select.querySelectorAll('option')).map((o) => ({
      value: o.getAttribute('value'),
      label: o.textContent,
    }));
    expect(options).toEqual([
      { value: '60', label: '1h' },
      { value: '90', label: '1.5h' },
      { value: '120', label: '2h' },
      { value: '150', label: '2.5h' },
      { value: '180', label: '3h' },
    ]);
  });

  it('renders rows as buttons that fire onProposeSession when canManage', () => {
    const onProposeSession = vi.fn();
    render(
      <BestTimesCard
        recommendations={[recHigh]}
        durationMinutes={60}
        onDurationChange={vi.fn()}
        canManage
        onProposeSession={onProposeSession}
      />,
    );

    const when = expectedWhen(recHigh.startIso);
    const button = screen.getByRole('button', { name: `Propose session ${when}` });
    fireEvent.click(button);
    expect(onProposeSession).toHaveBeenCalledWith(recHigh);
  });

  it('renders no row buttons when canManage is false', () => {
    render(
      <BestTimesCard
        recommendations={[recHigh, recMid]}
        durationMinutes={60}
        onDurationChange={vi.fn()}
        canManage={false}
        onProposeSession={vi.fn()}
      />,
    );

    expect(screen.queryAllByRole('button', { name: /Propose session/ })).toHaveLength(0);
  });

  it('renders the empty state when there are no recommendations', () => {
    render(
      <BestTimesCard
        recommendations={[]}
        durationMinutes={60}
        onDurationChange={vi.fn()}
        canManage={false}
      />,
    );

    expect(screen.getByText('Not enough availability data yet.')).toBeInTheDocument();
  });
});

describe('PersonLayerEntryPoint', () => {
  it('renders title, description, and fires onAction from the action button', () => {
    const onAction = vi.fn();
    render(
      <PersonLayerEntryPoint
        title="Your availability"
        description="Your typical week lives on your profile — leads pull it into this static's grid."
        actionLabel="Edit"
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Your availability')).toBeInTheDocument();
    expect(
      screen.getByText("Your typical week lives on your profile — leads pull it into this static's grid."),
    ).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button).toHaveTextContent(/^Edit$/);
    expect(button.textContent).not.toContain('→');
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders a custom icon when provided', () => {
    const icon: ReactNode = <svg data-testid="custom-icon" />;
    render(
      <PersonLayerEntryPoint
        title="Title"
        description="Description"
        actionLabel="Go"
        onAction={vi.fn()}
        icon={icon}
      />,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
