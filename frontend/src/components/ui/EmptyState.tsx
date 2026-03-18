/**
 * EmptyState - Reusable empty state display for when content areas have no data.
 *
 * Provides consistent visual treatment across Dashboard, GroupView, and History views.
 */

import type { ReactNode } from 'react';
import { Button } from '../primitives/Button';

interface EmptyStateProps {
  icon: ReactNode;
  heading: string;
  description: string;
  /** Optional CTA button */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, heading, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4 text-accent">
        {icon}
      </div>
      <h3 className="font-display text-lg text-text-primary mb-2">{heading}</h3>
      <p className="text-text-secondary text-sm max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="primary" size="md">
          {action.label}
        </Button>
      )}
    </div>
  );
}
