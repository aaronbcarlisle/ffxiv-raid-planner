import type { ReactNode } from 'react';
import { CalendarClock } from 'lucide-react';
import { CardShell } from '../ui';
import { Button } from '../primitives';

export interface PersonLayerEntryPointProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon?: ReactNode;
}

export function PersonLayerEntryPoint({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: PersonLayerEntryPointProps) {
  return (
    <CardShell as="div">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-default text-accent"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-base))' }}
        >
          {icon ?? <CalendarClock size={16} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="text-xs text-text-tertiary">{description}</p>
        </div>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </CardShell>
  );
}
