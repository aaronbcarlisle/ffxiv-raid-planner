/**
 * PriorityRow — inline ranked priority queue (F6d, spec §5.1; F5 catalog #19).
 * Mockup: 03-loot-priority.html `.pq` — up to N role-colored chips
 * (avatar initials + name + rank, first chip accent-highlighted) with a
 * "+N eligible" overflow. Shared ui/: presentational, no store imports.
 * Consumed by Loot's FloorDropRow now; Home is a future consumer.
 */

export interface PriorityRowEntry {
  playerId: string;
  name: string;
  /** Role slug (tank|healer|melee|ranged|caster) — drives the avatar token. */
  role: string;
  rank: number;
}

export interface PriorityRowProps {
  entries: PriorityRowEntry[];
  /** Chips shown before the "+N eligible" overflow. Default 3. */
  maxVisible?: number;
  emptyLabel?: string;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function PriorityRow({ entries, maxVisible = 3, emptyLabel = 'no one needs this' }: PriorityRowProps) {
  if (entries.length === 0) {
    return <span className="text-xs text-text-muted">{emptyLabel}</span>;
  }
  const visible = entries.slice(0, maxVisible);
  const overflow = entries.length - visible.length;

  return (
    <ul aria-label="Priority queue" className="flex min-w-0 items-center gap-2 overflow-hidden">
      {visible.map((entry, i) => {
        const top = i === 0;
        return (
          <li
            key={entry.playerId}
            data-top={top ? 'true' : undefined}
            className={`flex flex-none items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2.5 ${
              top ? 'border-accent bg-accent/15' : 'border-border-subtle bg-surface-interactive'
            }`}
          >
            <span
              aria-hidden
              /* design-system-ignore: 10px initials inside a 22px avatar glyph — decorative, name is adjacent */
              className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: `var(--color-role-${entry.role}, var(--color-text-muted))` }}
            >
              {initials(entry.name)}
            </span>
            <span className="truncate text-xs font-semibold text-text-primary">{entry.name}</span>
            <span className={`font-display text-xs font-extrabold ${top ? 'text-accent' : 'text-text-muted'}`}>
              #{entry.rank}
            </span>
          </li>
        );
      })}
      {overflow > 0 && <li className="flex-none text-xs text-text-tertiary">+{overflow} eligible</li>}
    </ul>
  );
}
