/**
 * Dropdown - Radix-based dropdown menu with consistent styling
 *
 * Features:
 * - Full keyboard navigation (Arrow keys, Enter, Escape)
 * - Focus management
 * - Collision detection (stays in viewport)
 * - Consistent FFXIV-themed styling
 */

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { forwardRef, type ReactNode } from 'react';

// ============================================================================
// Root & Trigger
// ============================================================================

interface DropdownProps {
  children: ReactNode;
  /** Open state (controlled) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
}

export function Dropdown({ children, open, onOpenChange, disabled }: DropdownProps) {
  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      {disabled ? (
        <span className="cursor-not-allowed opacity-50">{children}</span>
      ) : (
        children
      )}
    </DropdownMenuPrimitive.Root>
  );
}

interface DropdownTriggerProps {
  children: ReactNode;
  /** Render as child element instead of wrapping */
  asChild?: boolean;
  className?: string;
}

export const DropdownTrigger = forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ children, asChild = true, className = '' }, ref) => {
    return (
      <DropdownMenuPrimitive.Trigger ref={ref} asChild={asChild} className={className}>
        {children}
      </DropdownMenuPrimitive.Trigger>
    );
  }
);

DropdownTrigger.displayName = 'DropdownTrigger';

// ============================================================================
// Content (the dropdown panel)
// ============================================================================

interface DropdownContentProps {
  children: ReactNode;
  /** Alignment along the trigger edge */
  align?: 'start' | 'center' | 'end';
  /** Side to open on */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Offset from trigger */
  sideOffset?: number;
  /** Min width matching trigger */
  matchTriggerWidth?: boolean;
  className?: string;
}

export const DropdownContent = forwardRef<HTMLDivElement, DropdownContentProps>(
  (
    {
      children,
      align = 'start',
      side = 'bottom',
      sideOffset = 4,
      matchTriggerWidth = false,
      className = '',
    },
    ref
  ) => {
    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          align={align}
          side={side}
          sideOffset={sideOffset}
          className={`
            z-50 rounded-lg
            bg-surface-overlay border border-border-default
            shadow-xl
            min-w-[8rem] overflow-hidden py-1
            animate-in fade-in-0 zoom-in-95
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
            data-[side=bottom]:slide-in-from-top-2
            data-[side=left]:slide-in-from-right-2
            data-[side=right]:slide-in-from-left-2
            data-[side=top]:slide-in-from-bottom-2
            ${matchTriggerWidth ? 'w-[var(--radix-dropdown-menu-trigger-width)]' : ''}
            ${className}
          `}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    );
  }
);

DropdownContent.displayName = 'DropdownContent';

// ============================================================================
// Items
// ============================================================================

interface DropdownItemProps {
  children: ReactNode;
  /** Icon to display before text */
  icon?: ReactNode;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Danger/destructive action styling */
  danger?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Click handler */
  onSelect?: () => void;
  className?: string;
}

export const DropdownItem = forwardRef<HTMLDivElement, DropdownItemProps>(
  (
    {
      children,
      icon,
      shortcut,
      danger = false,
      disabled = false,
      onSelect,
      className = '',
    },
    ref
  ) => {
    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        disabled={disabled}
        onSelect={onSelect}
        className={`
          flex items-center gap-2 px-3 py-2 text-sm cursor-pointer
          outline-none select-none
          transition-colors duration-fast
          ${
            danger
              ? 'text-status-error hover:bg-status-error/10 focus:bg-status-error/10'
              : 'text-text-primary hover:bg-surface-interactive focus:bg-surface-interactive'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
          ${className}
        `}
      >
        {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
        <span className="flex-1">{children}</span>
        {shortcut && (
          <span className="ml-auto text-xs text-text-muted">{shortcut}</span>
        )}
      </DropdownMenuPrimitive.Item>
    );
  }
);

DropdownItem.displayName = 'DropdownItem';

// ============================================================================
// Checkbox Item
// ============================================================================

interface DropdownCheckboxItemProps {
  children: ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const DropdownCheckboxItem = forwardRef<HTMLDivElement, DropdownCheckboxItemProps>(
  ({ children, checked, onCheckedChange, disabled = false, className = '' }, ref) => {
    return (
      <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        checked={checked}
        onCheckedChange={onCheckedChange}
        onSelect={(e) => e.preventDefault()} // Prevent menu from closing on checkbox toggle
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 text-sm cursor-pointer
          outline-none select-none
          transition-colors duration-fast
          text-text-primary hover:bg-surface-interactive focus:bg-surface-interactive
          ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
          ${className}
        `}
      >
        <span className="w-4 h-4 flex items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <svg
              className="w-4 h-4 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        <span className="flex-1">{children}</span>
      </DropdownMenuPrimitive.CheckboxItem>
    );
  }
);

DropdownCheckboxItem.displayName = 'DropdownCheckboxItem';

// ============================================================================
// Separator & Label
// ============================================================================

export function DropdownSeparator({ className = '' }: { className?: string }) {
  return (
    <DropdownMenuPrimitive.Separator
      className={`my-1 h-px bg-border-default ${className}`}
    />
  );
}

export function DropdownLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={`px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide ${className}`}
    >
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

// ============================================================================
// Sub-menu
// ============================================================================

interface DropdownSubProps {
  children: ReactNode;
}

export function DropdownSub({ children }: DropdownSubProps) {
  return <DropdownMenuPrimitive.Sub>{children}</DropdownMenuPrimitive.Sub>;
}

interface DropdownSubTriggerProps {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export const DropdownSubTrigger = forwardRef<HTMLDivElement, DropdownSubTriggerProps>(
  ({ children, icon, className = '' }, ref) => {
    return (
      <DropdownMenuPrimitive.SubTrigger
        ref={ref}
        className={`
          flex items-center gap-2 px-3 py-2 text-sm cursor-pointer
          outline-none select-none
          transition-colors duration-fast
          text-text-primary hover:bg-surface-interactive focus:bg-surface-interactive
          data-[state=open]:bg-surface-interactive
          ${className}
        `}
      >
        {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
        <span className="flex-1">{children}</span>
        <svg
          className="w-4 h-4 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </DropdownMenuPrimitive.SubTrigger>
    );
  }
);

DropdownSubTrigger.displayName = 'DropdownSubTrigger';

export const DropdownSubContent = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string }
>(({ children, className = '' }, ref) => {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        ref={ref}
        sideOffset={2}
        alignOffset={-5}
        className={`
          z-50 rounded-lg
          bg-surface-overlay border border-border-default
          shadow-xl
          min-w-[8rem] overflow-hidden py-1
          animate-in fade-in-0 zoom-in-95
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
          data-[side=left]:slide-in-from-right-2
          data-[side=right]:slide-in-from-left-2
          ${className}
        `}
      >
        {children}
      </DropdownMenuPrimitive.SubContent>
    </DropdownMenuPrimitive.Portal>
  );
});

DropdownSubContent.displayName = 'DropdownSubContent';
