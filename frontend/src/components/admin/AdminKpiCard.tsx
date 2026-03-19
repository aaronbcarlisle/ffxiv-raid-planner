/**
 * Admin KPI Card - Displays a single key performance indicator
 *
 * Shows a label, value, and optional change indicator with direction.
 */

interface AdminKpiCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeDirection?: 'up' | 'down' | 'neutral';
}

const changeStyles = {
  up: 'text-status-success',
  down: 'text-status-error',
  neutral: 'text-text-muted',
} as const;

const changeIcons = {
  up: '\u2191',
  down: '\u2193',
  neutral: '\u2192',
} as const;

export function AdminKpiCard({ label, value, change, changeDirection = 'neutral' }: AdminKpiCardProps) {
  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-4">
      <p className="text-text-muted text-xs uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-display font-bold text-text-primary">
        {value}
      </p>
      {change && (
        <p className={`text-xs mt-1 ${changeStyles[changeDirection]}`}>
          <span aria-hidden="true">{changeIcons[changeDirection]}</span>{' '}
          {change}
        </p>
      )}
    </div>
  );
}
