/* eslint-disable design-system/no-raw-button */
/**
 * Tag — a small pill whose **semantics are required by its type**, so an
 * ambiguous "is this clickable?" tag can't be written:
 *
 * - `variant="label"`  → non-interactive. `onClick`/`href` are a type error.
 * - `variant="filter"` → a pressable toggle (`pressed` + `onClick`), `aria-pressed`.
 * - `variant="nav"`    → navigates: requires `href` **or** `onNavigate`, renders a chevron.
 *
 * Color is a semantic token (`tone`), never an arbitrary string.
 */
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export type Tone = 'accent' | 'success' | 'warning' | 'error' | 'muted' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  accent: 'bg-accent/15 text-accent border-accent/30',
  success: 'bg-status-success/10 text-status-success border-status-success/30',
  warning: 'bg-status-warning/10 text-status-warning border-status-warning/30',
  error: 'bg-status-error/10 text-status-error border-status-error/30',
  muted: 'bg-surface-elevated text-text-secondary border-border-default',
  info: 'bg-status-info/10 text-status-info border-status-info/30',
};

interface TagBase {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}

type TagProps =
  | (TagBase & { variant: 'label'; onClick?: never; href?: never; onNavigate?: never; pressed?: never })
  | (TagBase & { variant: 'filter'; pressed: boolean; onClick: () => void; href?: never; onNavigate?: never })
  | (TagBase & { variant: 'nav'; href: string; onNavigate?: never; onClick?: never; pressed?: never })
  | (TagBase & { variant: 'nav'; onNavigate: () => void; href?: never; onClick?: never; pressed?: never });

const BASE = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border';

export function Tag(props: TagProps) {
  const { children, tone = 'muted', icon, className = '' } = props;
  const toneClass = TONE_CLASS[tone];

  if (props.variant === 'label') {
    return (
      <span className={`${BASE} ${toneClass} ${className}`}>
        {icon}
        {children}
      </span>
    );
  }

  if (props.variant === 'filter') {
    return (
      <button
        type="button"
        aria-pressed={props.pressed}
        onClick={props.onClick}
        className={`${BASE} cursor-pointer transition-colors ${props.pressed ? toneClass : 'bg-transparent text-text-muted border-border-subtle hover:text-text-primary'} ${className}`}
      >
        {icon}
        {children}
      </button>
    );
  }

  // variant === 'nav'
  const navClass = `${BASE} ${toneClass} cursor-pointer transition-colors hover:brightness-110 ${className}`;
  const inner = (
    <>
      {icon}
      {children}
      <ChevronRight size={12} className="flex-shrink-0 opacity-70" />
    </>
  );
  if ('href' in props && props.href) {
    return <a href={props.href} className={navClass}>{inner}</a>;
  }
  return <button type="button" onClick={props.onNavigate} className={navClass}>{inner}</button>;
}
