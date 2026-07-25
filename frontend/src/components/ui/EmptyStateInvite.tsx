/**
 * EmptyStateInvite — empty state that invites the next action.
 *
 * Shared ui/ component (presentational, no store imports). Used when a card
 * or region has no content yet and wants to guide the user toward the action
 * that fills it — e.g. "No upcoming session · Schedule one · [Add session]".
 *
 * Design system: token-only (no raw hex/rgb). Action Button carries no trailing
 * glyph per §4.1 lexicon (empty-state actions are neither disclosures nor
 * leave-app links).
 */

import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from '../primitives/Button';

interface EmptyStateInviteProps {
  /** Optional leading icon rendered above the title. */
  icon?: ReactNode;
  /** Short label naming the absent thing. Required. */
  title: string;
  /** One-line elaboration shown below the title. */
  description?: string;
  /** When provided, renders an action Button below the description. */
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonVariant;
  };
}

export function EmptyStateInvite({ icon, title, description, action }: EmptyStateInviteProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
      {icon != null && (
        <div
          data-testid="empty-state-icon"
          className="text-text-tertiary mb-1"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description != null && (
        <p className="text-xs text-text-tertiary">{description}</p>
      )}
      {action != null && (
        <div className="mt-2">
          <Button
            variant={action.variant ?? 'accent-subtle'}
            size="sm"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
