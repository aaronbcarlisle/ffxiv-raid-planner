/**
 * ProgressRing Component
 *
 * A circular progress indicator that transitions from gray to accent color.
 * Used to display gear completion progress on player cards.
 * - Low progress (0-25%): muted gray
 * - Progress (26%+): accent teal
 */

import { LongPressTooltip } from '../primitives/LongPressTooltip';

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
 * Transitions from gray (low) to accent teal (high/complete).
 */
function getProgressColor(percentage: number): { stroke: string; text: string } {
  if (percentage >= 26) {
    // Any meaningful progress - accent teal (including complete)
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
    <LongPressTooltip
      content={
        <span>
          <span className="font-medium">{value}/{max}</span>
          <span className="text-text-secondary ml-1">({Math.round(percentage)}% complete)</span>
        </span>
      }
    >
      <div
        className={`relative inline-flex items-center justify-center ${className}`}
        style={{ width: diameter, height: diameter }}
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
          {/* Glow effect for high progress */}
          {percentage >= 75 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              className="stroke-accent opacity-30"
              strokeWidth={strokeWidth + 4}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ filter: 'blur(3px)' }}
            />
          )}
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
    </LongPressTooltip>
  );
}

export default ProgressRing;
