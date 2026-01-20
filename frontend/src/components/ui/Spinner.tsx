/**
 * Spinner - Unified loading indicator component
 *
 * Provides consistent loading spinners across the application.
 */

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type SpinnerColor = 'accent' | 'current';

interface SpinnerProps {
  /** Size variant */
  size?: SpinnerSize;
  /** Color variant - 'accent' uses theme accent, 'current' inherits text color */
  color?: SpinnerColor;
  /** Optional custom className */
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}

const SIZE_CLASSES = {
  sm: 'w-4 h-4 border',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
  xl: 'w-10 h-10 border-2',
  '2xl': 'w-12 h-12 border-[2.5px]',
};

const COLOR_CLASSES: Record<SpinnerColor, string> = {
  accent: 'border-accent',
  current: 'border-current',
};

export function Spinner({ size = 'md', color = 'accent', className = '', label = 'Loading' }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`${SIZE_CLASSES[size]} ${COLOR_CLASSES[color]} border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}

/**
 * Centered spinner with optional text
 */
export function SpinnerOverlay({
  size = 'lg',
  text,
  className = '',
}: SpinnerProps & { text?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Spinner size={size} />
      {text && <p className="text-text-muted text-sm">{text}</p>}
    </div>
  );
}
