/**
 * MembersOnlyCard (GUEST-2 R-G2-4) — the one gate card Schedule and Tracking
 * share. A guest gets a Login action that returns to the current path; a
 * signed-in outsider gets the invite copy and no action.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { useAuthStore } from '../../stores/authStore';
import { MembersOnlyCard } from './MembersOnlyCard';

const loginMock = vi.fn();

function renderCard() {
  return render(
    <MemoryRouter initialEntries={['/group/X?tab=goals']}>
      <MembersOnlyCard staticName="Test Static" subject="Objectives and farms" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  loginMock.mockReset();
  useAuthStore.setState({
    user: null,
    isLoading: false,
    authInitialized: true,
    login: loginMock,
  } as never);
});

describe('MembersOnlyCard', () => {
  it('a guest sees the members-only copy and a Login with Discord button that returns to this path', () => {
    renderCard();

    expect(screen.getByTestId('members-only-card')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Members only' })).toBeInTheDocument();
    expect(
      screen.getByText('Objectives and farms are shared with members of Test Static. Log in to ask to join.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Login with Discord' }));
    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(loginMock).toHaveBeenCalledWith('/group/X?tab=goals');
  });

  it('while auth is loading the label is Connecting... and a click does not restart login', () => {
    useAuthStore.setState({ isLoading: true } as never);
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Connecting...' }));
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('a signed-in non-member sees the invite copy and no button', () => {
    useAuthStore.setState({ user: { id: 'u9' } } as never);
    renderCard();

    expect(screen.getByRole('heading', { name: 'Members only' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Objectives and farms are shared with members of Test Static. Ask a lead for an invite, or send a join request if the static is recruiting.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('before the auth bootstrap resolves, no user shows the shared line only: no Login, no guest copy', () => {
    useAuthStore.setState({ authInitialized: false } as never);
    renderCard();

    expect(screen.getByRole('heading', { name: 'Members only' })).toBeInTheDocument();
    expect(screen.getByText('Objectives and farms are shared with members of Test Static.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Log in to ask to join/)).toBeNull();
  });

  it('a persisted user before the bootstrap resolves sees the signed-in copy at once, no button', () => {
    useAuthStore.setState({ user: { id: 'u9' }, authInitialized: false } as never);
    renderCard();

    expect(
      screen.getByText(
        'Objectives and farms are shared with members of Test Static. Ask a lead for an invite, or send a join request if the static is recruiting.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
