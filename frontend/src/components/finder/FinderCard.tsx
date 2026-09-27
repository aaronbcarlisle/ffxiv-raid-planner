/**
 * FinderCard — the Static Finder's result card (Task 2 header + Task 3 body,
 * R-SF-N/P). Reason rows, the "Your time:" line, Looking for tags, the
 * footer's Copy link / Updated / View static, and the join action land here.
 */
import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CircleDot, X, Copy, Users } from 'lucide-react';
import { Tag, type Tone } from '../ui/Tag';
import { LinkText } from '../ui/LinkText';
import { IconButton } from '../primitives/IconButton';
import { TIMEZONES, LANGUAGES } from '../../gamedata';
import { GOAL_CATEGORY_LABELS } from './discoveryOptions';
import { reasonText, unknownScheduleTimeText } from './reasonCopy';
import { JoinAction } from './JoinAction';
import { ROLE_CHIP_LABELS, type FinderItem, type RoleKey } from './types';

const TIER_CONFIG: Record<string, { label: string; tone: Tone }> = {
  strong: { label: 'Strong fit', tone: 'success' },
  good: { label: 'Good fit', tone: 'info' },
  partial: { label: 'Partial fit', tone: 'warning' },
  weak: { label: 'Weak fit', tone: 'error' },
  unknown: { label: 'Not enough info', tone: 'muted' },
};

const REASON_ICON: Record<'match' | 'partial' | 'conflict', { Icon: typeof Check; className: string }> = {
  match: { Icon: Check, className: 'text-status-success' },
  partial: { Icon: CircleDot, className: 'text-status-warning' },
  conflict: { Icon: X, className: 'text-status-error' },
};

const RECRUITMENT_TONE: Record<string, Tone> = {
  open: 'success', selective: 'warning', limited: 'warning', paused: 'muted', closed: 'error',
};

interface LookingForEntry { role: string; priority: 'needed' | 'nice_to_have'; jobs: string[] }

function tzShortLabel(value: string): string {
  return (TIMEZONES.find(t => t.value === value)?.label ?? value).split(' ')[0];
}

function langLabel(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}

/** The listing's own schedule string, in its own terms (V1's card text). */
function listingScheduleText(item: FinderItem): string | null {
  if (!item.scheduleDays?.length) return null;
  const days = item.scheduleDays.map(d => (d.length > 3 ? d.slice(0, 3) : d)).join(', ');
  const start = item.scheduleStartTime ? ` ${item.scheduleStartTime}` : '';
  const end = item.scheduleEndTime ? `–${item.scheduleEndTime}` : '';
  const tz = item.timezone ? ` (${tzShortLabel(item.timezone)})` : '';
  return `${days}${start}${end}${tz}`;
}

function roleChip(role: string): string {
  return ROLE_CHIP_LABELS[role as RoleKey] ?? role;
}

function LookingForRow({ item }: { item: FinderItem }) {
  const entries = (item.recruitingRoles ?? []) as unknown as LookingForEntry[];

  if (entries.length > 0) {
    const ordered = [...entries].sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'needed' ? -1 : 1));
    const matchedRole = item.fitV2 && (item.fitV2.role.status === 'match' || item.fitV2.role.status === 'partial')
      ? item.fitV2.role.matchedRole
      : null;
    return (
      <div className="flex flex-wrap gap-1">
        {ordered.map((entry) => {
          const chip = roleChip(entry.role);
          const label = entry.role === matchedRole
            ? `${chip} — your fit`
            : entry.priority === 'needed' ? `${chip} open` : `${chip} (nice to have)`;
          return (
            <Fragment key={entry.role}>
              <Tag variant="label">{label}</Tag>
              {entry.jobs.map(j => <Tag key={j} variant="label" tone="muted">{j}</Tag>)}
            </Fragment>
          );
        })}
      </div>
    );
  }

  if (!item.neededRoles?.length && !item.neededJobs?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {item.neededRoles?.map(r => <Tag key={r} variant="label">{roleChip(r)}</Tag>)}
      {item.neededJobs?.map(j => <Tag key={j} variant="label" tone="muted">{j}</Tag>)}
    </div>
  );
}

export function FinderCard({ item, onRequestJoin }: { item: FinderItem; onRequestJoin: (item: FinderItem) => void }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const tier = item.fitV2 ? TIER_CONFIG[item.fitV2.tier] : null;
  const location = [item.dataCenter, item.server].filter(Boolean).join(' — ');
  const scheduleText = listingScheduleText(item);
  const hasContact = !!(item.contactMethod && item.contactValue);
  const longDescription = (item.description?.length ?? 0) > 120;

  const reasons = item.fitV2?.reasons ?? [];
  const nights = item.fitV2?.schedule.nights ?? [];
  const yourTimeText = item.fitV2?.schedule.status === 'unknown' ? unknownScheduleTimeText(nights) : null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/group/${item.shareCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div
      data-testid="finder-card"
      className="bg-surface-card border border-border-default rounded-lg p-4 flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-display font-semibold text-text-primary break-words min-w-0">
          {item.name}
        </h3>
        {tier && (
          <Tag variant="label" tone={tier.tone} className="flex-shrink-0">
            {tier.label}
          </Tag>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        {location && <span>{location}</span>}
        <Tag variant="label" tone={RECRUITMENT_TONE[item.recruitmentStatus] ?? 'muted'} className="capitalize">
          {item.recruitmentStatus}
        </Tag>
        {item.intensity && <Tag variant="label" tone="accent" className="capitalize">{item.intensity}</Tag>}
        {item.languages?.length ? <span>{item.languages.map(langLabel).join(', ')}</span> : null}
      </div>

      {scheduleText && <p className="text-xs text-text-secondary">{scheduleText}</p>}

      {item.objectiveCategories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.objectiveCategories.map(cat => (
            <Tag key={cat} variant="label">{GOAL_CATEGORY_LABELS[cat] ?? cat}</Tag>
          ))}
        </div>
      )}

      {item.description ? (
        <div>
          <p className={`text-text-secondary text-sm whitespace-pre-line ${!expanded && longDescription ? 'line-clamp-3' : ''}`}>
            {item.description}
          </p>
          {longDescription && (
            <LinkText onClick={() => setExpanded(e => !e)} className="text-xs mt-0.5">
              {expanded ? 'Show less' : 'Show more'}
            </LinkText>
          )}
        </div>
      ) : !hasContact ? (
        <p className="text-text-muted text-xs italic">No details yet. Open the listing to learn more.</p>
      ) : null}

      {hasContact && (
        <p className="text-xs text-text-secondary break-all">{item.contactValue}</p>
      )}

      {item.memberCount > 0 && (
        <p className="text-xs text-text-muted flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
        </p>
      )}

      {(reasons.length > 0 || yourTimeText) && (
        <div className="flex flex-col gap-1">
          {reasons.map((reason, i) => {
            const text = reasonText(reason, nights);
            if (!text) return null;
            const { Icon, className } = REASON_ICON[reason.status];
            return (
              <div key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${className}`} aria-label={reason.status} />
                <span>{text}</span>
              </div>
            );
          })}
          {yourTimeText && <p className="text-xs text-text-muted">{yourTimeText}</p>}
        </div>
      )}

      <LookingForRow item={item} />

      <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border-subtle">
        <div className="flex items-center gap-2 text-xs text-text-muted min-w-0">
          {item.lastUpdated && (
            <span className="truncate">Updated {new Date(item.lastUpdated).toLocaleDateString()}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <IconButton
            icon={copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4" />}
            aria-label={copied ? 'Link copied' : 'Copy listing link'}
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
          />
          <JoinAction item={item} onRequestJoin={onRequestJoin} />
          <LinkText onClick={() => navigate(`/group/${item.shareCode}`)}>View static</LinkText>
        </div>
      </div>
    </div>
  );
}
