import { getJobIconUrl } from '../../gamedata';

interface JobIconProps {
  job: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function JobIcon({ job, size = 'md', className = '' }: JobIconProps) {
  const iconUrl = getJobIconUrl(job);

  if (!iconUrl) {
    // Fallback to abbreviation if no icon
    return (
      <span
        className={`${sizeClasses[size]} flex items-center justify-center bg-surface-interactive rounded text-xs font-medium text-text-secondary ${className}`}
      >
        {job.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={job}
      className={`${sizeClasses[size]} ${className}`}
      loading="lazy"
    />
  );
}
