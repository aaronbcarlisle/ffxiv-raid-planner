/**
 * ToggleSwitch Component
 *
 * Simple toggle switch with animated state indicator.
 * - ON: Accent color background (or custom color) with dark circle on right
 * - OFF: Dark background with white circle on left
 */

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** Optional custom color (hex) for checked state - overrides accent color */
  color?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'sm',
  className = '',
  'aria-label': ariaLabel,
  color,
}: ToggleSwitchProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  // Size dimensions
  const dimensions = size === 'sm'
    ? { track: 'w-10 h-5', circle: 'w-3.5 h-3.5', translate: 'translate-x-5' }
    : { track: 'w-12 h-6', circle: 'w-4 h-4', translate: 'translate-x-6' };

  // Use inline style for custom color, class for default accent
  const trackStyle = checked && color ? { backgroundColor: color } : undefined;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`
        relative inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
        ${dimensions.track}
        ${checked && !color ? 'bg-accent' : !checked ? 'bg-surface-elevated' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      style={trackStyle}
    >
      {/* Circle indicator */}
      <span
        className={`
          absolute top-1/2 -translate-y-1/2 rounded-full shadow-sm transition-all duration-200
          ${dimensions.circle}
          ${checked ? `${dimensions.translate} bg-accent-contrast` : 'translate-x-1 bg-white'}
        `}
      />
    </button>
  );
}
