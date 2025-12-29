/**
 * Badge - Unified badge component with variants
 */

import { type ReactNode } from 'react';

type BadgeVariant =
  | 'default'
  | 'raid'
  | 'tome'
  | 'augmented'
  | 'crafted'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'tank'
  | 'healer'
  | 'melee'
  | 'ranged'
  | 'caster';

type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    'bg-surface-elevated text-text-secondary border-border-default',
  // Gear source variants
  raid: 'bg-gear-raid/20 text-gear-raid border-gear-raid/40',
  tome: 'bg-gear-tome/20 text-gear-tome border-gear-tome/40',
  augmented: 'bg-gear-augmented/20 text-gear-augmented border-gear-augmented/40',
  crafted: 'bg-gear-crafted/20 text-gear-crafted border-gear-crafted/40',
  // Status variants
  success: 'bg-status-success/20 text-status-success border-status-success/40',
  warning: 'bg-status-warning/20 text-status-warning border-status-warning/40',
  error: 'bg-status-error/20 text-status-error border-status-error/40',
  info: 'bg-status-info/20 text-status-info border-status-info/40',
  // Role variants
  tank: 'bg-role-tank/20 text-role-tank border-role-tank/40',
  healer: 'bg-role-healer/20 text-role-healer border-role-healer/40',
  melee: 'bg-role-melee/20 text-role-melee border-role-melee/40',
  ranged: 'bg-role-ranged/20 text-role-ranged border-role-ranged/40',
  caster: 'bg-role-caster/20 text-role-caster border-role-caster/40',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded border font-semibold whitespace-nowrap ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}
