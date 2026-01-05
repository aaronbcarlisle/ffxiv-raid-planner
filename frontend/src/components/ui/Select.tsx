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
import { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
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
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled} modal={false}>
      <SelectPrimitive.Trigger
        id={id}
        className={`
          inline-flex items-center justify-between
          w-full
          bg-surface-elevated border border-border-default rounded-lg
          pl-4 pr-3 py-2
          text-sm
          focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 focus:ring-offset-surface-base
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:border-border-subtle
          transition-colors
          data-[placeholder]:text-text-muted
          ${className}
        `}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="w-4 h-4 text-text-muted" />
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
      >
        <SelectPrimitive.Viewport className="p-1">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Root>
  );
}

const SelectItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ children, ...props }, ref) => {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className="
        relative flex items-center
        px-8 py-2 rounded
        text-sm text-text-primary
        cursor-pointer
        select-none
        outline-none
        data-[highlighted]:bg-accent data-[highlighted]:text-accent-contrast data-[highlighted]:font-bold
        data-[disabled]:text-text-disabled data-[disabled]:pointer-events-none
      "
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
        <Check className="w-4 h-4" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});

SelectItem.displayName = 'SelectItem';

export default Select;
