/**
 * Popover - Radix-based popover for custom floating content
 *
 * Use this for custom content layouts (grids, forms, etc.)
 * Use Dropdown for menu-style lists of items.
 */

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { forwardRef, type ReactNode } from 'react';

// ============================================================================
// Root
// ============================================================================

interface PopoverProps {
  children: ReactNode;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Default open state for uncontrolled usage */
  defaultOpen?: boolean;
}

export function Popover({ children, open, onOpenChange, defaultOpen }: PopoverProps) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      {children}
    </PopoverPrimitive.Root>
  );
}

// ============================================================================
// Trigger
// ============================================================================

interface PopoverTriggerProps {
  children: ReactNode;
  asChild?: boolean;
  className?: string;
}

export const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ children, asChild = true, className = '' }, ref) => {
    return (
      <PopoverPrimitive.Trigger ref={ref} asChild={asChild} className={className}>
        {children}
      </PopoverPrimitive.Trigger>
    );
  }
);

PopoverTrigger.displayName = 'PopoverTrigger';

// ============================================================================
// Content
// ============================================================================

interface PopoverContentProps {
  children: ReactNode;
  /** Alignment along the trigger edge */
  align?: 'start' | 'center' | 'end';
  /** Side to open on */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Offset from trigger */
  sideOffset?: number;
  /** Offset along the alignment axis */
  alignOffset?: number;
  /** Collision padding from viewport edges */
  collisionPadding?: number;
  className?: string;
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  (
    {
      children,
      align = 'start',
      side = 'bottom',
      sideOffset = 4,
      alignOffset = 0,
      collisionPadding = 8,
      className = '',
    },
    ref
  ) => {
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          side={side}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          collisionPadding={collisionPadding}
          className={`
            z-50 rounded-lg
            bg-surface-overlay border border-border-default
            shadow-xl
            animate-in fade-in-0 zoom-in-95
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
            data-[side=bottom]:slide-in-from-top-2
            data-[side=left]:slide-in-from-right-2
            data-[side=right]:slide-in-from-left-2
            data-[side=top]:slide-in-from-bottom-2
            ${className}
          `}
          onOpenAutoFocus={(e) => e.preventDefault()} // Don't auto-focus first focusable
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    );
  }
);

PopoverContent.displayName = 'PopoverContent';

// ============================================================================
// Close button
// ============================================================================

interface PopoverCloseProps {
  children: ReactNode;
  asChild?: boolean;
  className?: string;
}

export const PopoverClose = forwardRef<HTMLButtonElement, PopoverCloseProps>(
  ({ children, asChild = true, className = '' }, ref) => {
    return (
      <PopoverPrimitive.Close ref={ref} asChild={asChild} className={className}>
        {children}
      </PopoverPrimitive.Close>
    );
  }
);

PopoverClose.displayName = 'PopoverClose';
