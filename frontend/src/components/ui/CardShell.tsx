import type { ReactNode } from 'react';

/**
 * CardShell — the token-clean shared card surface used across Home, Schedule,
 * and Player Hub. Supersedes the legacy DashboardCard (inline-hex debt).
 *
 * Provides: `surface-card` background, `border-subtle` edge, `rounded-lg`
 * corner radius, consistent padding, and an optional uppercase section header
 * (icon + title + right-aligned slot).
 *
 * Design-system rules (shared `ui/` layer — all at error level):
 * - No raw color (token classes only: bg-surface-card, border-border-subtle, text-text-tertiary)
 * - Readable text floor: title uses `text-xs` (12 px)
 * - A11y: title renders as a real `<h3>` heading element
 */

export interface CardShellProps {
  /** Optional uppercase section heading. Renders as a real <h3> for a11y. */
  title?: string;
  /** Icon shown left of the title; decorative, aria-hidden. */
  icon?: ReactNode;
  /** Element right-aligned in the header row (badge, status chip, etc.). */
  headerRight?: ReactNode;
  children: ReactNode;
  /** Extra Tailwind classes applied to the outer container. */
  className?: string;
  /**
   * Rendered element. Defaults to 'section' — use 'div' when the card is
   * nested inside another landmark (e.g. inside a <section>).
   */
  as?: 'section' | 'div';
}

export function CardShell({
  title,
  icon,
  headerRight,
  children,
  className = '',
  as: Container = 'section',
}: CardShellProps) {
  const hasHeader = Boolean(title || icon || headerRight);

  return (
    <Container
      className={`bg-surface-card border border-border-subtle rounded-lg p-4 ${className}`}
    >
      {hasHeader && (
        <div className="flex items-center gap-2 mb-4">
          {icon && (
            <span className="flex-shrink-0 text-text-tertiary" aria-hidden="true">
              {icon}
            </span>
          )}
          {title && (
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary leading-none">
              {title}
            </h3>
          )}
          {headerRight && <span className="ml-auto">{headerRight}</span>}
        </div>
      )}
      {children}
    </Container>
  );
}
