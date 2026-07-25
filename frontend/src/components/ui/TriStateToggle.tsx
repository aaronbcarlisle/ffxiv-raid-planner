/* eslint-disable design-system/no-raw-button */
/**
 * TriStateToggle — a segmented control for a three-way ownership state
 * (have / missing / unknown). One bordered group, each segment is an
 * icon + label with a tooltip, status-colored when active, and exposes
 * `aria-pressed` for assistive tech.
 */
import { Check, X, HelpCircle } from 'lucide-react';
import { Tooltip } from '../primitives';

export type TriState = 'have' | 'missing' | 'unknown';

interface TriStateToggleProps {
  value: TriState;
  onChange: (value: TriState) => void;
  /** Override the visible labels (defaults: Have / Missing / Unknown) */
  labels?: Partial<Record<TriState, string>>;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_LABELS: Record<TriState, string> = {
  have: 'Have',
  missing: 'Missing',
  unknown: 'Unknown',
};

const SEGMENTS: Array<{
  state: TriState;
  icon: typeof Check;
  hint: string;
  activeClass: string;
}> = [
  { state: 'have', icon: Check, hint: 'Have — you own this', activeClass: 'bg-status-success/10 text-status-success' },
  { state: 'missing', icon: X, hint: 'Missing — you do not own this yet', activeClass: 'bg-status-error/10 text-status-error' },
  { state: 'unknown', icon: HelpCircle, hint: 'Unknown — not tracked', activeClass: 'bg-surface-elevated text-text-secondary' },
];

export function TriStateToggle({ value, onChange, labels, disabled = false, className = '' }: TriStateToggleProps) {
  const resolved = { ...DEFAULT_LABELS, ...labels };

  return (
    <div
      role="group"
      className={`inline-flex items-stretch rounded-md border border-border-default overflow-hidden divide-x divide-border-default ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {SEGMENTS.map(({ state, icon: Icon, hint, activeClass }) => {
        const isActive = value === state;
        const label = resolved[state];
        return (
          <Tooltip key={state} content={hint}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={isActive}
              aria-label={label}
              onClick={() => { if (!disabled) onChange(state); }}
              className={`flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
              } ${
                isActive
                  ? activeClass
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.035]'
              }`}
            >
              <Icon size={13} className="flex-shrink-0" />
              <span className="leading-none">{label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
