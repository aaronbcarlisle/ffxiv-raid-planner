/**
 * Spinner - Unified loading indicator component
 *
 * Provides consistent loading spinners across the application.
 */

interface SpinnerProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional custom className */
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}

const SIZE_CLASSES = {
  sm: 'w-4 h-4 border',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
};

export function Spinner({ size = 'md', className = '', label = 'Loading' }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`${SIZE_CLASSES[size]} border-accent border-t-transparent rounded-full animate-spin ${className}`}
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
