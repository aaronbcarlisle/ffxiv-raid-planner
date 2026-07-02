/**
 * AttentionRow — one prioritized "needs you" action item.
 *
 * Shared ui/ component (presentational, no store imports). Renders a flex row
 * with a leading status icon, a grow region (title + optional meta line), and
 * a trailing action Button.
 *
 * Design system: token-only (no raw hex/rgb). Action Button carries no trailing
 * glyph per §4.1 lexicon (attention actions are neither disclosures nor
 * leave-app links).
 *
 * Spec: §5.7 of design/redesign/specs/2026-06-30-f6b-home-design.md
 */

import type { ReactNode } from 'react';
import { Button, type ButtonVariant } from '../primitives/Button';

interface AttentionRowProps {
  /** Leading status icon node. The slot is tinted via text-status-warning so
   *  icon SVGs pick up the warning color via currentColor. */
  icon: ReactNode;
  /** Row headline — may be a string or a ReactNode (e.g. text + inline Tag). */
  title: ReactNode;
  /** Optional sub-line shown below the title in tertiary style. */
  meta?: string;
  /** Trailing call-to-action Button (label only, no trailing glyph). */
  action: {
    label: string;
    onClick: () => void;
    variant?: ButtonVariant;
  };
}

export function AttentionRow({ icon, title, meta, action }: AttentionRowProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Icon slot — status-warning tinted; icon SVGs inherit via currentColor */}
      <div className="shrink-0 text-status-warning" aria-hidden="true">
        {icon}
      </div>

      {/* Grow region: title + optional meta */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary leading-snug">
          {title}
        </div>
        {meta != null && (
          <p className="text-xs text-text-tertiary mt-0.5">{meta}</p>
        )}
      </div>

      {/* Trailing action — size sm, no trailing glyph */}
      <div className="shrink-0">
        <Button
          variant={action.variant ?? 'accent-subtle'}
          size="sm"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      </div>
    </div>
  );
}
