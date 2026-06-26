/* eslint-disable design-system/no-raw-button */
/**
 * LinkText / NavRow — make "navigational text" a real, obviously-navigational
 * component instead of plain text with an `onClick`. The type **requires** a
 * destination (`href`) or an action (`onClick`), so a dead label can't pretend
 * to navigate.
 *
 * - `LinkText` — inline link-styled text.
 * - `NavRow`   — a full-width row (icon + label + chevron) that navigates.
 */
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

type Destination =
  | { href: string; onClick?: never }
  | { href?: never; onClick: () => void };

type LinkTextProps = {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
} & Destination;

const LINK_CLASS =
  'inline-flex items-center gap-1 text-accent hover:text-accent-hover underline-offset-2 hover:underline cursor-pointer transition-colors';

export function LinkText({ children, icon, className = '', ...dest }: LinkTextProps) {
  if ('href' in dest && dest.href !== undefined) {
    return (
      <a href={dest.href} className={`${LINK_CLASS} ${className}`}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={dest.onClick} className={`${LINK_CLASS} ${className}`}>
      {icon}
      {children}
    </button>
  );
}

type NavRowProps = {
  label: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  className?: string;
} & Destination;

const ROW_CLASS =
  'flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-md text-text-secondary hover:text-text-primary hover:bg-white/[0.04] cursor-pointer transition-colors';

export function NavRow({ label, icon, description, className = '', ...dest }: NavRowProps) {
  const inner = (
    <>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{label}</span>
        {description && <span className="block text-xs text-text-muted truncate">{description}</span>}
      </span>
      <ChevronRight size={15} className="flex-shrink-0 text-text-muted" />
    </>
  );
  if ('href' in dest && dest.href !== undefined) {
    return <a href={dest.href} className={`${ROW_CLASS} ${className}`}>{inner}</a>;
  }
  return <button type="button" onClick={dest.onClick} className={`${ROW_CLASS} ${className}`}>{inner}</button>;
}
