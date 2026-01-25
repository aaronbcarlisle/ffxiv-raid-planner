/**
 * Select Component
 *
 * Custom dropdown using Radix UI Select for full styling control.
 * Matches the design system with proper dark theme support.
 *
 * @example
 * <Select
 *   value={role}
 *   onChange={setRole}
 *   placeholder="Select a role..."
 *   options={[
 *     { value: 'tank', label: 'Tank' },
 *     { value: 'healer', label: 'Healer' },
 *   ]}
 * />
 */

import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { forwardRef, useState, useEffect, type ReactNode } from 'react';

// Counteract Radix's scroll-lock which breaks sticky positioning
function usePreventScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    const body = document.body;

    const override = () => {
      body.style.setProperty('position', 'static', 'important');
      body.style.setProperty('overflow', 'visible', 'important');
      body.style.setProperty('pointer-events', 'auto', 'important');

      // Also remove aria-hidden from siblings
      document.querySelectorAll('[data-aria-hidden="true"]').forEach(el => {
        el.removeAttribute('data-aria-hidden');
        el.removeAttribute('aria-hidden');
      });
    };

    // Apply immediately and on any DOM changes
    override();
    const observer = new MutationObserver(override);
    observer.observe(body, { attributes: true, attributeFilter: ['style', 'data-scroll-locked'] });

    return () => {
      observer.disconnect();
      // Remove the properties we set instead of restoring potentially stale values
      // (the original captured style could contain Radix's pointer-events: none)
      body.style.removeProperty('position');
      body.style.removeProperty('overflow');
      body.style.removeProperty('pointer-events');
    };
  }, [isOpen]);
}

export interface SelectOption {
  value: string;
  label: string;
  /** Optional icon to display before the label */
  icon?: ReactNode;
  /** Optional group for categorizing options in SearchableSelect */
  group?: string;
}

export interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled,
  className = '',
}: SelectProps) {
  const [open, setOpen] = useState(false);

  // Prevent Radix scroll-lock from breaking sticky nav
  usePreventScrollLock(open);

  // Filter out empty-value options (Radix doesn't allow empty string values)
  // Use the empty option's label as placeholder if provided
  const emptyOption = options.find(opt => opt.value === '');
  const effectivePlaceholder = emptyOption?.label || placeholder;
  const validOptions = options.filter(opt => opt.value !== '');

  // Find the selected option to render its icon in the trigger
  const selectedOption = validOptions.find(opt => opt.value === value);

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      onOpenChange={setOpen}
    >
      <SelectPrimitive.Trigger
        id={id}
        className={`
          inline-flex items-center justify-between
          min-h-[44px] sm:min-h-0
          bg-surface-elevated border border-border-default rounded-lg
          pl-4 pr-3 py-2
          text-sm
          focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:border-border-subtle
          transition-colors
          data-[placeholder]:text-text-muted
          ${className}
        `}
      >
        {/* Custom value display with icon support */}
        {selectedOption ? (
          <span className="flex items-center gap-2 truncate">
            {selectedOption.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
            <span className="truncate">{selectedOption.label}</span>
          </span>
        ) : (
          <span className="text-text-muted">{effectivePlaceholder}</span>
        )}
        <SelectPrimitive.Icon className="ml-auto pl-2">
          <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      {/* No Portal - renders inline to avoid scroll-lock breaking sticky nav */}
      <SelectPrimitive.Content
        className="
          overflow-hidden
          bg-surface-overlay border border-border-default rounded-lg
          shadow-lg shadow-black/50
          z-50
          min-w-[var(--radix-select-trigger-width)]
          max-h-[var(--radix-select-content-available-height)]
        "
        position="popper"
        sideOffset={4}
        align="start"
        collisionPadding={16}
        avoidCollisions
      >
        <SelectPrimitive.Viewport className="p-1">
          {validOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} icon={option.icon}>
              {option.label}
            </SelectItem>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Root>
  );
}

interface SelectItemProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  icon?: ReactNode;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ children, icon, ...props }, ref) => {
    return (
      <SelectPrimitive.Item
        ref={ref}
        className="
          relative flex items-center
          px-8 py-2 min-h-[44px] sm:min-h-0 rounded
          text-sm text-text-primary
          cursor-pointer
          select-none
          outline-none
          data-[highlighted]:bg-surface-interactive
          data-[disabled]:text-text-disabled data-[disabled]:pointer-events-none
        "
        {...props}
      >
        <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
          <Check className="w-4 h-4" />
        </SelectPrimitive.ItemIndicator>
        {icon && <span className="mr-2 flex-shrink-0">{icon}</span>}
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  }
);

SelectItem.displayName = 'SelectItem';

export default Select;
