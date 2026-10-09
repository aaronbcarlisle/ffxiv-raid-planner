/**
 * Tooltip - Radix-based tooltip with consistent styling
 *
 * Automatically disabled on touch devices where hover interactions
 * are not available. Use the `disabled` prop to manually disable.
 */

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ReactNode } from 'react';
import { useDevice } from '../../hooks/useDevice';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  /** Placement side */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignment along the side */
  align?: 'start' | 'center' | 'end';
  /** Offset from the trigger element (px) */
  sideOffset?: number;
  /** Delay before showing (ms) — set on Root so it overrides the root provider */
  delayDuration?: number;
  /**
   * Deprecated: skip-delay is now a global behavior owned by the single
   * app-root `TooltipProvider`. Accepted for back-compat but no longer used
   * per instance (each `<Tooltip>` used to spin up its own provider, which was
   * a major roster-render cost). Kept optional so existing call sites compile.
   */
  skipDelayDuration?: number;
  /** Explicitly disable the tooltip */
  disabled?: boolean;
  /**
   * Radix's `disableHoverableContent` on the Root: the tooltip closes the moment the
   * pointer leaves its trigger, instead of staying open while the pointer crosses to the
   * content, so it never holds open over the neighbour below it. The content also gets
   * `pointer-events-none`, which only keeps it from catching the pointer on the way; the
   * Root prop is what does the closing. Off by default: other tooltips keep hoverable
   * content so it can be read or selected.
   */
  disableHoverableContent?: boolean;
}

export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  sideOffset = 4,
  delayDuration = 500,
  disabled,
  disableHoverableContent,
}: TooltipProps) {
  const { canHover } = useDevice();

  // On touch devices where hover isn't available, just render children
  if (!canHover) {
    return <>{children}</>;
  }

  // No per-instance Provider — a single one lives at the app root. The
  // per-tooltip delay is set on Root (Radix lets Root override the provider).
  // When disabled, still render the same structure to avoid unmounting children,
  // but use open={false} to prevent the tooltip from showing.
  return (
    <TooltipPrimitive.Root
      open={disabled ? false : undefined}
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
    >
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={`z-50 rounded bg-surface-raised px-3 py-2 text-sm text-text-primary shadow-xl border border-border-default animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95${disableHoverableContent ? ' pointer-events-none' : ''}`}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-surface-raised" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** Provider for tooltips - wrap your app with this for shared delay behavior */
export const TooltipProvider = TooltipPrimitive.Provider;
