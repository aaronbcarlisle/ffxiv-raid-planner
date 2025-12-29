/**
 * Tooltip - Radix-based tooltip with consistent styling
 */

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  /** Placement side */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignment along the side */
  align?: 'start' | 'center' | 'end';
  /** Offset from the trigger element (px) */
  sideOffset?: number;
  /** Delay before showing (ms) */
  delayDuration?: number;
  /** Skip delay when moving between tooltips */
  skipDelayDuration?: number;
}

export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  sideOffset = 4,
  delayDuration = 200,
  skipDelayDuration = 100,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            className="z-50 rounded-md bg-[#0a0a0f] px-3 py-2 text-sm text-text-primary shadow-xl border border-border-default animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-[#0a0a0f]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/** Provider for tooltips - wrap your app with this for shared delay behavior */
export const TooltipProvider = TooltipPrimitive.Provider;
