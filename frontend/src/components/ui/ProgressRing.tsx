/**
 * ProgressRing Component
 *
 * A circular progress indicator with color-coded thresholds.
 * Used to display gear completion progress on player cards.
 */

interface ProgressRingProps {
  /** Current value (e.g., 5) */
  value: number;
  /** Maximum value (e.g., 11) */
  max: number;
  /** Ring size */
  size?: 'sm' | 'md' | 'lg';
  /** Show "X/Y" text inside the ring */
  showLabel?: boolean;
  /** Optional custom className */
  className?: string;
}

// Size configurations
const SIZE_CONFIG = {
  sm: { diameter: 32, strokeWidth: 3, fontSize: 'text-[10px]' },
  md: { diameter: 40, strokeWidth: 4, fontSize: 'text-xs' },
  lg: { diameter: 56, strokeWidth: 5, fontSize: 'text-sm' },
};

/**
 * Get the color class based on progress percentage.
 * Uses app design tokens for consistency.
 */
function getProgressColor(percentage: number): { stroke: string; text: string } {
  if (percentage >= 100) {
    // Complete - success green
    return { stroke: 'stroke-status-success', text: 'text-status-success' };
  }
  if (percentage >= 76) {
    // Near complete (9-10/11) - warning amber (almost there!)
    return { stroke: 'stroke-status-warning', text: 'text-status-warning' };
  }
  if (percentage >= 26) {
    // Mid progress (3-8/11) - accent teal
    return { stroke: 'stroke-accent', text: 'text-accent' };
  }
  // Low progress (0-2/11) - muted gray
  return { stroke: 'stroke-text-muted', text: 'text-text-muted' };
}

export function ProgressRing({
  value,
  max,
  size = 'md',
  showLabel = true,
  className = '',
}: ProgressRingProps) {
  const config = SIZE_CONFIG[size];
  const { diameter, strokeWidth, fontSize } = config;

  // Calculate ring dimensions
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = diameter / 2;

  // Calculate progress
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Get color based on progress
  const colors = getProgressColor(percentage);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: diameter, height: diameter }}
      title={`${value}/${max} (${Math.round(percentage)}%)`}
    >
      <svg
        width={diameter}
        height={diameter}
        className="transform -rotate-90"
      >
        {/* Background circle (track) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className="stroke-surface-elevated"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className={`${colors.stroke} transition-all duration-300 ease-out`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      {/* Center label */}
      {showLabel && (
        <span
          className={`absolute inset-0 flex items-center justify-center font-bold ${fontSize} ${colors.text}`}
        >
          {value}/{max}
        </span>
      )}
    </div>
  );
}

export default ProgressRing;
