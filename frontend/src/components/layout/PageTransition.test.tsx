/**
 * PageTransition — the animation key is the page identity (RH1b review, R-RH-G).
 *
 * A static's two routes share one key, so `/group/abc` ↔ `/group/abc/recruit`
 * keeps the routed child mounted (no cold refetch of the shell); a
 * static-to-static switch and every other pathname change still remount.
 * Mounting is observed through a counting child and its element identity.
 *
 * @vitest-environment jsdom
 */
import { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate, type NavigateFunction } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/useDevice', () => ({
  useDevice: () => ({ isSmallScreen: false, isTouch: false, canHover: true, prefersReducedMotion: false }),
}));

import { PageTransition } from './PageTransition';

let mounts = 0;
let navigateFn: NavigateFunction;

function Probe() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <div data-testid="probe" />;
}

/** Hands the router's navigate to the test (assigned in an effect, never during render). */
function Capture() {
  const navigate = useNavigate();
  useEffect(() => {
    navigateFn = navigate;
  }, [navigate]);
  return null;
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Capture />
      <Routes>
        <Route element={<PageTransition />}>
          <Route path="/group/:shareCode" element={<Probe />} />
          <Route path="/group/:shareCode/recruit" element={<Probe />} />
          <Route path="*" element={<Probe />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mounts = 0;
});

describe('PageTransition mounting (the key is the page identity)', () => {
  it('/group/abc → /group/abc/recruit keeps the routed child mounted (same key)', () => {
    renderAt('/group/abc');
    const before = screen.getByTestId('probe');
    expect(mounts).toBe(1);
    act(() => { navigateFn('/group/abc/recruit?rtab=listing'); });
    expect(mounts).toBe(1);
    expect(screen.getByTestId('probe')).toBe(before);
    act(() => { navigateFn('/group/abc?tab=roster'); });
    expect(mounts).toBe(1);
    expect(screen.getByTestId('probe')).toBe(before);
  });

  it('/group/abc → /group/def remounts (static-to-static keeps today\'s transition)', () => {
    renderAt('/group/abc');
    const before = screen.getByTestId('probe');
    act(() => { navigateFn('/group/def'); });
    expect(mounts).toBe(2);
    expect(screen.getByTestId('probe')).not.toBe(before);
  });

  it('off-group routes key on the pathname: /foo → /bar remounts, /foo → /foo?x=1 does not', () => {
    renderAt('/foo');
    act(() => { navigateFn('/foo?x=1'); });
    expect(mounts).toBe(1);
    act(() => { navigateFn('/bar'); });
    expect(mounts).toBe(2);
  });
});
