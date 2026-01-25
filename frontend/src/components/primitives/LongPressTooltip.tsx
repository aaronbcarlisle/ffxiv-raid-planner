/**
 * LongPressTooltip - Tooltip that shows on hover (desktop) or long press (mobile)
 *
 * On desktop: Uses standard Radix tooltip with hover behavior
 * On mobile: Shows tooltip content on long press gesture, positioned near touch point
 */

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useDevice } from '../../hooks/useDevice';

interface LongPressTooltipProps {
  children: ReactNode;
  content: ReactNode;
  /** Placement side */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignment along the side */
  align?: 'start' | 'center' | 'end';
  /** Offset from the trigger element (px) */
  sideOffset?: number;
  /** Delay before showing on hover (ms) - desktop only */
  delayDuration?: number;
  /** Long press duration (ms) - mobile only */
  longPressDuration?: number;
  /** Explicitly disable the tooltip */
  disabled?: boolean;
}

export function LongPressTooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  sideOffset = 4,
  delayDuration = 500,
  longPressDuration = 500,
  disabled,
}: LongPressTooltipProps) {
  const { canHover } = useDevice();
  const [showMobileTooltip, setShowMobileTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number; showAbove: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Store initial touch position for movement detection and tooltip positioning
    const touch = e.touches[0];
    touchStartPosRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
    isLongPressRef.current = false;

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;

      // Position tooltip near touch point
      const touchY = touchStartPosRef.current?.y || 0;
      const touchX = touchStartPosRef.current?.x || 0;

      // Need at least 150px above for tooltip, otherwise show below
      const showAbove = touchY > 150;

      setTooltipPosition({
        x: touchX,
        y: touchY,
        showAbove,
      });
      setShowMobileTooltip(true);

      // Auto-hide after 3 seconds (tracked for cleanup)
      clearAutoHideTimer();
      autoHideTimerRef.current = setTimeout(() => setShowMobileTooltip(false), 3000);
    }, longPressDuration);
  }, [longPressDuration, clearAutoHideTimer]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimer();

    // If it was a long press, prevent default actions and stop propagation
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
    }
  }, [clearTimer]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long press if user moves finger too much
    if (touchStartPosRef.current) {
      const moveThreshold = 10; // pixels
      const deltaX = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);

      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        clearTimer();
      }
    }
  }, [clearTimer]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Always prevent context menu on this element to avoid parent handlers
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      clearAutoHideTimer();
    };
  }, [clearTimer, clearAutoHideTimer]);

  // Disabled - just render children
  if (disabled) {
    return <>{children}</>;
  }

  // Desktop - use standard Radix tooltip with hover
  if (canHover) {
    return (
      <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={100}>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side={side}
              align={align}
              sideOffset={sideOffset}
              className="z-50 rounded bg-surface-raised px-3 py-2 text-sm text-text-primary shadow-xl border border-border-default animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
            >
              {content}
              <TooltipPrimitive.Arrow className="fill-surface-raised" />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    );
  }

  // Mobile - use long press to show tooltip
  return (
    <>
      <div
        ref={triggerRef}
        className="inline-block"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onContextMenu={handleContextMenu}
      >
        {children}
      </div>
      {showMobileTooltip && tooltipPosition && (
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => setShowMobileTooltip(false)}
          onTouchStart={() => setShowMobileTooltip(false)}
        >
          <div
            className="fixed z-[101] rounded bg-surface-raised px-3 py-2 text-sm text-text-primary shadow-xl border border-border-default animate-in fade-in-0 zoom-in-95"
            style={{
              // Center horizontally on screen to avoid cutoff on edges
              left: '50%',
              top: tooltipPosition.showAbove ? tooltipPosition.y - 16 : tooltipPosition.y + 24,
              transform: tooltipPosition.showAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
              maxWidth: 'calc(100vw - 2rem)',
              width: 'max-content',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      )}
    </>
  );
}
