/**
 * SuggestedFarmsCard — Tracking tab, above Goals.
 * Read-only; renders only when `collectionSuggestions.length > 0`.
 * R-PH1-I: up to 3 rows (mount · duty · Owned / {current}/{target}), then +N more.
 */

import type { CollectionSuggestion } from '../../../stores/playerProfileStore';
import { CardShell } from '../../ui/CardShell';

interface SuggestedFarmsCardProps {
  collectionSuggestions: CollectionSuggestion[];
}

export function SuggestedFarmsCard({ collectionSuggestions }: SuggestedFarmsCardProps) {
  if (collectionSuggestions.length === 0) return null;

  const visible = collectionSuggestions.slice(0, 3);
  const extra = collectionSuggestions.length - visible.length;

  return (
    <CardShell title="Suggested farms">
      <ul className="flex flex-col divide-y divide-border-subtle">
        {visible.map((s) => (
          <li key={s.trialId} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{s.mountName}</p>
              <p className="truncate text-xs text-text-muted">{s.dutyName}</p>
            </div>
            <span className="flex-none text-xs text-text-secondary">
              {s.hasMount ? 'Owned' : `${s.currentCount}/${s.totemTarget}`}
            </span>
          </li>
        ))}
      </ul>
      {extra > 0 && (
        <p className="mt-2 text-xs text-text-muted">+{extra} more</p>
      )}
    </CardShell>
  );
}
