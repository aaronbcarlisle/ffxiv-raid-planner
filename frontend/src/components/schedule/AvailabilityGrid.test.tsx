/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership } from '../../types';
import { AvailabilityGrid } from './AvailabilityGrid';

const mocks = vi.hoisted(() => {
  const availabilityState = {
    data: [],
    templateData: [],
    error: null,
    fetchAvailability: vi.fn(),
    submitAvailability: vi.fn(),
    fetchTemplates: vi.fn(),
    submitTemplate: vi.fn(),
  };
  const personalState = {
    days: [],
    fetchPersonalAvailability: vi.fn(),
  };
  const authState = {
    user: { id: 'user-1', discordUsername: 'Usagi' },
  };

  return { availabilityState, personalState, authState };
});

vi.mock('../../stores/availabilityStore', () => ({
  useAvailabilityStore: () => mocks.availabilityState,
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => mocks.authState,
}));

vi.mock('../../stores/personalAvailabilityStore', () => {
  const usePersonalAvailabilityStore = (selector?: (state: typeof mocks.personalState) => unknown) =>
    selector ? selector(mocks.personalState) : mocks.personalState;
  usePersonalAvailabilityStore.getState = () => mocks.personalState;
  return { usePersonalAvailabilityStore };
});

vi.mock('../../utils/timezone', () => ({
  getBrowserTimezone: () => 'UTC',
  resolveNearestUpcomingDatetime: (value: string) => value,
}));

vi.mock('./AvailabilityRecommendations', () => ({
  AvailabilityRecommendations: () => <div data-testid="availability-recommendations" />,
}));

vi.mock('./TemplateRecommendations', () => ({
  TemplateRecommendations: () => <div data-testid="template-recommendations" />,
}));

vi.mock('./QuickFillHelper', () => ({
  QuickFillHelper: () => <div data-testid="quick-fill-helper" />,
}));

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderGrid() {
  const members: Membership[] = [
    {
      id: 'member-1',
      userId: 'user-1',
      staticGroupId: 'group-1',
      role: 'member',
      joinedAt: '2026-06-17T00:00:00Z',
      user: {
        id: 'user-1',
        discordId: 'discord-1',
        discordUsername: 'Usagi',
      },
    },
  ];

  render(
    <MemoryRouter>
      <AvailabilityGrid
        groupId="group-1"
        canSubmit
        canCreateSession={false}
        sessions={[]}
        members={members}
        staticName="Test Static"
        shareCode="ABC123"
        onCreateSessionDraft={vi.fn()}
      />
    </MemoryRouter>
  );
}

describe('AvailabilityGrid drag selection', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.availabilityState.data = [];
    mocks.availabilityState.templateData = [];
    mocks.availabilityState.error = null;
    mocks.availabilityState.fetchAvailability.mockClear();
    mocks.availabilityState.fetchTemplates.mockClear();
    mocks.availabilityState.submitAvailability.mockReset();
    mocks.availabilityState.submitTemplate.mockReset();
    mocks.availabilityState.submitAvailability.mockResolvedValue(undefined);
    mocks.availabilityState.submitTemplate.mockResolvedValue(undefined);
  });

  it('drag-selects across columns and includes the final mouseup cell', async () => {
    renderGrid();
    const [firstCell, secondCell, thirdCell] = screen.getAllByTestId(/^avail-cell-/);

    fireEvent.mouseDown(firstCell);
    fireEvent.mouseEnter(secondCell);
    fireEvent.mouseUp(thirdCell);

    await waitFor(() => {
      expect(firstCell).toHaveAttribute('data-user-selected', 'true');
      expect(secondCell).toHaveAttribute('data-user-selected', 'true');
      expect(thirdCell).toHaveAttribute('data-user-selected', 'true');
    });
    expect(mocks.availabilityState.submitAvailability).toHaveBeenCalled();
  });

  it('keeps rapid second drags reliable while the previous save is still in flight', async () => {
    const firstSave = createDeferred();
    mocks.availabilityState.submitAvailability.mockReturnValueOnce(firstSave.promise);
    renderGrid();
    const [firstCell, secondCell, thirdCell, fourthCell] = screen.getAllByTestId(/^avail-cell-/);

    fireEvent.mouseDown(firstCell);
    fireEvent.mouseEnter(secondCell);
    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(firstCell).toHaveAttribute('data-user-selected', 'true');
      expect(secondCell).toHaveAttribute('data-user-selected', 'true');
    });

    fireEvent.mouseDown(thirdCell);
    fireEvent.mouseEnter(fourthCell);
    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(firstCell).toHaveAttribute('data-user-selected', 'true');
      expect(secondCell).toHaveAttribute('data-user-selected', 'true');
      expect(thirdCell).toHaveAttribute('data-user-selected', 'true');
      expect(fourthCell).toHaveAttribute('data-user-selected', 'true');
    });

    firstSave.resolve();
  });

  it('still supports click-to-toggle selection', async () => {
    renderGrid();
    const [cell] = screen.getAllByTestId(/^avail-cell-/);

    fireEvent.mouseDown(cell);
    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(cell).toHaveAttribute('data-user-selected', 'true');
    });

    fireEvent.mouseDown(cell);
    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(cell).toHaveAttribute('data-user-selected', 'false');
    });
  });
});
