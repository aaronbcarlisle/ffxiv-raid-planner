/**
 * LoginButton — redirectTo (GUEST-1 R-G1-6).
 *
 * With `redirectTo`, a click calls login(redirectTo) so AuthCallback returns
 * the guest to where they were. Without it, the click stays V1's bare login()
 * (pin): callers such as ProtectedRoute set auth_redirect themselves and rely
 * on bare login() leaving it alone (vet I-6). The store is mocked, so the
 * sessionStorage write itself is authStore.login.test.ts's to prove (vet M-3).
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoginButton } from './LoginButton';

const loginMock = vi.hoisted(() => vi.fn());
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ login: loginMock, isLoading: false }),
}));

function clickLogin() {
  fireEvent.click(screen.getByRole('button', { name: /login with discord/i }));
}

describe('LoginButton', () => {
  beforeEach(() => {
    loginMock.mockClear();
  });

  it('passes redirectTo to login', () => {
    render(<LoginButton redirectTo="/group/ABC?tab=schedule" />);

    clickLogin();

    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(loginMock).toHaveBeenCalledWith('/group/ABC?tab=schedule');
  });

  it('(pin) calls bare login() with no argument when the prop is absent (V1 parity)', () => {
    render(<LoginButton />);

    clickLogin();

    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(loginMock.mock.calls[0]).toEqual([]);
  });
});
