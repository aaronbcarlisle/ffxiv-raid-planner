import type { CSSProperties, ReactNode } from 'react';

// Gold label used across dashboard cards
const GOLD_LABEL = 'text-xs font-semibold text-[#c9a84c] uppercase tracking-widest leading-none';

// Left-accent bar variants
const ACCENT_STYLES: Record<string, CSSProperties> = {
  teal:   { borderLeft: '2px solid rgba(20,184,166,0.6)' },
  gold:   { borderLeft: '2px solid rgba(201,168,76,0.6)' },
  red:    { borderLeft: '2px solid rgba(239,68,68,0.55)' },
  yellow: { borderLeft: '2px solid rgba(234,179,8,0.55)' },
};

// Subtle inner gradient for glass feel — applied via inline style
const GLASS_GRADIENT: CSSProperties = {
  background: 'linear-gradient(160deg, #0e0e16 0%, #0a0a12 100%)',
};

interface DashboardCardProps {
  /** Gold uppercase label shown in the card header */
  title?: string;
  /** Icon shown left of the title */
  icon?: ReactNode;
  /** Element right-aligned in the header (badge, status pill, etc.) */
  badge?: ReactNode;
  children: ReactNode;
  /** Clickable card — adds hover glow + cursor-pointer */
  onClick?: () => void;
  /** Optional left accent colour bar */
  accentColor?: 'teal' | 'gold' | 'red' | 'yellow';
  /** Extra Tailwind classes */
  className?: string;
  /** Forward any extra inline styles */
  style?: CSSProperties;
}

/**
 * DashboardCard — shared dark-glass card used across Gear & Sync, Schedule,
 * More, and other dashboard panels.
 *
 * Provides: gradient background, consistent border, optional teal/gold/red
 * left-accent bar, and gold section-label header.
 */
export function DashboardCard({
  title,
  icon,
  badge,
  children,
  onClick,
  accentColor,
  className = '',
  style,
}: DashboardCardProps) {
  const accentStyle = accentColor ? ACCENT_STYLES[accentColor] : undefined;
  const combinedStyle = { ...GLASS_GRADIENT, ...accentStyle, ...style };

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        style={combinedStyle}
        className={`border border-border-default rounded-xl p-5 cursor-pointer hover:border-accent/40 hover:brightness-110 transition-all ${className}`}
      >
        <CardInner title={title} icon={icon} badge={badge}>{children}</CardInner>
      </div>
    );
  }

  return (
    <div
      style={combinedStyle}
      className={`border border-border-default rounded-xl p-5 ${className}`}
    >
      <CardInner title={title} icon={icon} badge={badge}>{children}</CardInner>
    </div>
  );
}

function CardInner({
  title, icon, badge, children,
}: { title?: string; icon?: ReactNode; badge?: ReactNode; children: ReactNode }) {
  return (
    <>
      {(title || icon || badge) && (
        <div className="flex items-center gap-2 mb-4">
          {icon && (
            <span className="text-text-secondary flex-shrink-0" aria-hidden>
              {icon}
            </span>
          )}
          {title && <span className={GOLD_LABEL}>{title}</span>}
          {badge && <span className="ml-auto">{badge}</span>}
        </div>
      )}
      {children}
    </>
  );
}

// ── IconMedallion ─────────────────────────────────────────────────────────────

interface IconMedallionProps {
  icon: ReactNode;
  color?: 'teal' | 'gold' | 'red' | 'yellow' | 'neutral';
  size?: 'sm' | 'md';
}

const MEDALLION_COLORS: Record<string, string> = {
  teal:    'bg-accent/15 text-accent',
  gold:    'bg-[#c9a84c]/15 text-[#c9a84c]',
  red:     'bg-red-400/15 text-red-400',
  yellow:  'bg-yellow-400/15 text-yellow-400',
  neutral: 'bg-surface-raised text-text-secondary',
};

/**
 * IconMedallion — small rounded icon badge for card headers and lists.
 */
export function IconMedallion({ icon, color = 'neutral', size = 'md' }: IconMedallionProps) {
  const sizeClass = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  return (
    <div className={`${sizeClass} rounded-lg flex items-center justify-center flex-shrink-0 ${MEDALLION_COLORS[color]}`}>
      {icon}
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

interface SectionLabelProps {
  children: ReactNode;
  color?: 'gold' | 'teal' | 'red';
  className?: string;
}

const LABEL_COLORS: Record<string, string> = {
  gold: 'text-[#c9a84c]',
  teal: 'text-accent',
  red:  'text-red-400',
};

/**
 * SectionLabel — gold/teal/red uppercase tracking-widest section header.
 */
export function SectionLabel({ children, color = 'gold', className = '' }: SectionLabelProps) {
  return (
    <h2 className={`text-xs font-semibold uppercase tracking-widest ${LABEL_COLORS[color]} ${className}`}>
      {children}
    </h2>
  );
}
