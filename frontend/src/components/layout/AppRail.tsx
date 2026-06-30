/**
 * AppRail — 72px Person-layer nav rail (DS §3.9 LOCKED).
 *
 * Fixed-width icon-only rail: SkipLink → logo → icon/avatar entries → footer.
 * All colors come from nav.* / surface.nav tokens (Task 1); zero hardcoded colors.
 */
import type React from 'react';
import { Tooltip } from '../primitives';
import { SkipLink } from './SkipLink';
import type { RailEntry, RailIconItem, RailAvatarItem } from './railTypes';

export interface AppRailProps {
  /** Optional logo / wordmark block rendered above the nav entries. */
  logo?: React.ReactNode;
  /** Ordered list of Person-layer rail entries (icon items, avatar items, dividers). */
  entries: RailEntry[];
  /** Optional footer node rendered below the entries (e.g. <UserMenu variant="rail" collapsed />). */
  footer?: React.ReactNode;
}

// ─── RailItem ────────────────────────────────────────────────────────────────

interface RailIconItemProps { entry: RailIconItem }
interface RailAvatarItemProps { entry: RailAvatarItem }

function RailIconItemButton({ entry }: RailIconItemProps) {
  const Icon = entry.icon;
  return (
    <Tooltip content={entry.label} side="right" sideOffset={12} delayDuration={300}>
      {/* design-system-ignore: custom active pill + avatar/icon variants per §3.9 */}
      <button
        type="button"
        onClick={entry.onSelect}
        aria-current={entry.isActive ? 'page' : undefined}
        className={[
          'relative flex w-full items-center justify-center',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset',
          'transition-colors duration-fast',
          // §3.9 LOCKED: inactive items surface hover bg + icon shift; active items keep accent state.
          // Inactive color lives in className so hover: can override it (inline style would block hover).
          entry.isActive
            ? 'text-[var(--color-nav-item-icon-active,var(--color-accent))]'
            : 'text-[var(--color-nav-item-icon-inactive)] hover:bg-[var(--color-nav-item-bg-hover)] hover:text-[var(--color-nav-item-icon-hover)]',
        ].join(' ')}
        style={{ height: 'var(--nav-item-target-size, 44px)' }}
      >
        {/* Left-edge active pill */}
        {entry.isActive && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 pointer-events-none rounded-r"
            style={{
              width: 'var(--nav-item-active-indicator-size, 3px)',
              background: 'var(--color-nav-item-active-indicator, var(--color-accent))',
            }}
          />
        )}
        <Icon
          size={24}
          aria-hidden="true"
        />
        <span className="sr-only">{entry.label}</span>
      </button>
    </Tooltip>
  );
}

function RailAvatarItemButton({ entry }: RailAvatarItemProps) {
  return (
    <Tooltip content={entry.label} side="right" sideOffset={12} delayDuration={300}>
      {/* design-system-ignore: custom active pill + avatar/icon variants per §3.9 */}
      <button
        type="button"
        onClick={entry.onSelect}
        aria-current={entry.isActive ? 'page' : undefined}
        className={[
          'relative flex w-full items-center justify-center',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset',
          'transition-colors duration-fast',
          // §3.9 LOCKED: inactive avatar items surface hover bg; avatar chip keeps its border treatment.
          !entry.isActive && 'hover:bg-[var(--color-nav-item-bg-hover)]',
        ].filter(Boolean).join(' ')}
        style={{ height: 'var(--nav-item-target-size, 44px)' }}
      >
        {/* Left-edge active pill */}
        {entry.isActive && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 pointer-events-none rounded-r"
            style={{
              width: 'var(--nav-item-active-indicator-size, 3px)',
              background: 'var(--color-nav-item-active-indicator, var(--color-accent))',
            }}
          />
        )}
        {entry.imageUrl ? (
          <img
            src={entry.imageUrl}
            alt=""
            aria-hidden="true"
            className="rounded-full object-cover"
            style={{
              width: 'var(--nav-item-icon-size, 24px)',
              height: 'var(--nav-item-icon-size, 24px)',
              border: entry.isActive
                ? '2px solid var(--color-nav-item-active-indicator, var(--color-accent))'
                : '1px solid var(--color-border-default)',
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex items-center justify-center rounded-full text-xs font-semibold"
            style={{
              width: 'var(--nav-item-icon-size, 24px)',
              height: 'var(--nav-item-icon-size, 24px)',
              background: entry.accent ?? 'var(--color-accent-dim)',
              border: entry.isActive
                ? '2px solid var(--color-nav-item-active-indicator, var(--color-accent))'
                : '1px solid var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          >
            {entry.initials}
          </span>
        )}
        <span className="sr-only">{entry.label}</span>
      </button>
    </Tooltip>
  );
}

// ─── AppRail ─────────────────────────────────────────────────────────────────

export function AppRail({ logo, entries, footer }: AppRailProps) {
  return (
    <>
      <SkipLink />
      <nav
        aria-label="Primary navigation"
        className="w-[72px] shrink-0 flex flex-col border-r border-border-default"
        style={{ background: 'var(--color-surface-nav, var(--color-surface-raised))' }}
      >
        {/* ── Logo block ── */}
        {logo && (
          <div className="flex items-center justify-center h-[72px] shrink-0 border-b border-border-default">
            {logo}
          </div>
        )}

        {/* ── Nav entries ── */}
        {/* min-h-0 lets the flex child shrink below its content so overflow-y-auto can scroll */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto py-2">
          {entries.map((entry) => {
            if (entry.kind === 'divider') {
              return (
                <hr
                  key={entry.id}
                  aria-hidden="true"
                  className="mx-4 my-2 border-border-default"
                />
              );
            }
            if (entry.kind === 'icon') {
              return <RailIconItemButton key={entry.id} entry={entry} />;
            }
            // entry.kind === 'avatar'
            return <RailAvatarItemButton key={entry.id} entry={entry} />;
          })}
        </div>

        {/* ── Footer ── */}
        {footer && (
          <div className="shrink-0 border-t border-border-default">
            {footer}
          </div>
        )}
      </nav>
    </>
  );
}
