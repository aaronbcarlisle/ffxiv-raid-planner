import type { ReactNode } from 'react';
import { SafeAvatar } from './SafeAvatar';
import { JobIcon } from './JobIcon';

// Role type matching the shared game-data vocabulary
type Role = 'tank' | 'healer' | 'melee' | 'ranged' | 'caster';

/**
 * Variant union.
 *  - 'inline'      — avatar badge + name + meta row (F6b, attention/activity rows). BUILT.
 *  - 'board-cell'  — compact cell for Roster Board (F6c). BUILT.
 *  - 'rsvp-row'    — RSVP roster row inside SessionRsvpCard (F6e). RESERVED — do not implement yet.
 */
type PlayerIdentityVariant = 'inline' | 'board-cell' | 'rsvp-row';

export interface PlayerIdentityProps {
  /** Player display name (required). Used for name text and initials fallback. */
  name: string;
  /** FFXIV job abbreviation (e.g. "BLM"). Shown as JobIcon badge and in subtitle. */
  job?: string;
  /** Role classification — drives the role-colored avatar ring. */
  role?: Role;
  /** Position slot (e.g. "R2", "T1"). Shown in subtitle alongside job. */
  position?: string;
  /**
   * Custom subtitle node.  When provided it replaces the auto-generated
   * "job · position" subtitle line.
   */
  subtitle?: ReactNode;
  /** Avatar image URL.  Passed through SafeAvatar's allowlist.  Falls back to initials. */
  avatarUrl?: string;
  /**
   * Layout variant.  'inline' (F6b) and 'board-cell' (F6c) are implemented.
   * 'rsvp-row' (F6e) is API-reserved.
   */
  variant?: PlayerIdentityVariant;
}

/**
 * Human-readable role labels used for the sr-only accessibility text.
 * Kept at module level (stable reference, no runtime allocation per render).
 */
const ROLE_LABELS: Record<Role, string> = {
  tank: 'Tank',
  healer: 'Healer',
  melee: 'Melee',
  ranged: 'Ranged',
  caster: 'Caster',
};

/** Derive up to two uppercase initials from a name string. */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * PlayerIdentity — role-colored avatar + name + job/role/position identity unit.
 *
 * Presentational (props-in / callbacks-out).  No store imports.
 * Shared layer: held to error-level design-system rules — token colors only, 12px text floor.
 *
 * a11y contract: role is never conveyed by color alone.  The job/position text
 * labels (visible in the subtitle) carry semantic meaning; the role ring is
 * decorative reinforcement only.
 */
export function PlayerIdentity({
  name,
  job,
  role,
  position,
  subtitle,
  avatarUrl,
  variant = 'inline',
}: PlayerIdentityProps) {
  // 'rsvp-row' remains reserved (F6e). 'inline' (F6b) and 'board-cell' (F6c) render.
  if (variant === 'rsvp-row') {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('PlayerIdentity: variant="rsvp-row" is reserved and not yet implemented (F6e).');
    }
    return null;
  }

  // Subtitle + a11y role signal (shared by both rendered variants).
  const autoSubtitle = [job, position].filter(Boolean).join(' · ');
  const subtitleContent = subtitle ?? (autoSubtitle || null);
  const hasTextualRoleSignal = !!(job || position || subtitle);
  const srRoleLabel = role && !hasTextualRoleSignal ? ROLE_LABELS[role] : null;

  if (variant === 'board-cell') {
    return (
      <div className="flex items-center gap-2.5">
        {job && (
          <span className="shrink-0" aria-hidden="true">
            <JobIcon job={job} size="sm" />
          </span>
        )}
        <div className="min-w-0">
          <div className="font-display text-sm font-bold text-text-primary truncate">{name}</div>
          {srRoleLabel && <span className="sr-only">{srRoleLabel}</span>}
          {subtitleContent && (
            <div className="text-xs text-text-tertiary truncate">{subtitleContent}</div>
          )}
        </div>
      </div>
    );
  }

  // Role ring: border-color via CSS var — never a literal hex.
  const ringStyle: React.CSSProperties = role
    ? { borderColor: `var(--color-role-${role})` }
    : {};

  // Initials for avatar fallback.
  const initials = getInitials(name);

  return (
    <div className="flex items-center gap-2">
      {/* Avatar zone: role-colored ring wrapping SafeAvatar; JobIcon badge overlaid */}
      <div
        data-testid="player-identity-ring"
        className="relative shrink-0 w-8 h-8 rounded-full border-2 border-transparent"
        style={ringStyle}
      >
        <SafeAvatar
          src={avatarUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover"
          fallback={
            <span
              className="w-full h-full rounded-full bg-surface-interactive flex items-center justify-center text-xs font-medium text-text-secondary"
              aria-hidden="true"
            >
              {initials}
            </span>
          }
        />
        {job && (
          /* Job icon as a small badge at the bottom-right of the avatar.
             aria-hidden: the job label is present in the subtitle text below,
             so this icon is purely decorative here. */
          <div
            className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface-card"
            aria-hidden="true"
          >
            <JobIcon job={job} size="xs" />
          </div>
        )}
      </div>

      {/* Text zone: name + subtitle */}
      <div className="min-w-0">
        {/* a11y: name text provides the primary identification */}
        <div className="text-sm font-medium text-text-primary truncate">{name}</div>
        {/* a11y §5.4: visually-hidden role label — only rendered when no other textual
            signal (job / position / subtitle) is already present. Avoids double-
            announcement when the subtitle already names the job/position. */}
        {srRoleLabel && <span className="sr-only">{srRoleLabel}</span>}
        {subtitleContent && (
          /* Subtitle carries job + position text labels — satisfies the a11y requirement
             that role is not conveyed by color alone when job/position are provided. */
          <div className="text-xs text-text-tertiary truncate">{subtitleContent}</div>
        )}
      </div>
    </div>
  );
}
