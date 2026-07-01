/**
 * SegmentedToggle — one segmented view switch (shared `ui/`, F6c Board).
 *
 * Value-generic: the same control drives Roster's Cards⇄Board and (F6d) Loot's
 * Priority⇄History. Presentational (props-in / callbacks-out, no store imports);
 * held to shared-layer error-level DS rules. Composes the `Button` primitive
 * (active = primary fill, inactive = ghost) inside a bordered pill container —
 * no raw `<button>`. Visual target: `mockups/02-roster-board.html` `.seg`.
 */
import type { ReactNode } from 'react';
import { Button } from '../primitives/Button';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedToggleProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible label for the option group (meaning-bearing, not icon-only). */
  ariaLabel: string;
  size?: 'sm' | 'md';
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'sm',
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex gap-0.5 rounded-lg border border-border-default bg-surface-elevated p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Button
            key={opt.value}
            variant={active ? 'primary' : 'ghost'}
            size={size}
            aria-pressed={active}
            leftIcon={opt.icon}
            onClick={() => {
              if (!active) onChange(opt.value);
            }}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}
