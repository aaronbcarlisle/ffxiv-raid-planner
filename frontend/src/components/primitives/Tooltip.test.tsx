/**
 * Tooltip's `disableHoverableContent` (S2a-2·F4 fix wave): off by default, so every
 * other caller keeps hoverable content; on, the tooltip closes the moment the pointer
 * leaves its trigger and its content cannot take the pointer.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip, TooltipProvider } from './Tooltip';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(hover: hover) and (pointer: fine)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

function renderTip(disableHoverableContent?: boolean) {
  render(
    <TooltipProvider>
      <Tooltip content="Tip text" delayDuration={0} disableHoverableContent={disableHoverableContent}>
        <button type="button">trigger</button>
      </Tooltip>
    </TooltipProvider>,
  );
  const trigger = screen.getByRole('button', { name: 'trigger' });
  fireEvent.focus(trigger);
  return trigger;
}

const contentEl = () => document.querySelector<HTMLElement>('[data-radix-popper-content-wrapper] > [data-side]');

describe('Tooltip disableHoverableContent', () => {
  it('leaves the content pointer-reachable by default', async () => {
    renderTip();
    await waitFor(() => expect(contentEl()).not.toBeNull());
    expect(contentEl()).not.toHaveClass('pointer-events-none');
  });

  it('lets the pointer pass through the content when set (the Root prop, below, does the closing)', async () => {
    renderTip(true);
    await waitFor(() => expect(contentEl()).not.toBeNull());
    expect(contentEl()).toHaveClass('pointer-events-none');
  });

  it('closes as soon as the pointer leaves the trigger when set', async () => {
    const trigger = renderTip(true);
    fireEvent.pointerMove(trigger, { pointerType: 'mouse' });
    await waitFor(() => expect(contentEl()).not.toBeNull());
    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    await waitFor(() => expect(contentEl()).toBeNull());
  });
});
