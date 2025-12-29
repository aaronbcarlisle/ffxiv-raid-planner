/**
 * VisuallyHidden - Hides content visually while keeping it accessible to screen readers
 */

import { type ReactNode } from 'react';

interface VisuallyHiddenProps {
  children: ReactNode;
  /** Render as a different element (default: span) */
  as?: 'span' | 'div' | 'label';
}

export function VisuallyHidden({ children, as: Component = 'span' }: VisuallyHiddenProps) {
  return (
    <Component
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </Component>
  );
}
