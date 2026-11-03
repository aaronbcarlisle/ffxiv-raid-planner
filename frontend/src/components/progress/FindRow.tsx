/**
 * FindRow — one farm in Find (S2a-4a·A2b, R-F-5, D-10): about 56 px collapsed, with the name, the
 * source duty and type, the exchange (P-75), the plugin-ready label (P-71), "{n} want(s)", the
 * Tracking ✓ link (P-60, every role) and the action slot.
 *
 * The toggle is a disclosure `IconButton`. The body is always in the DOM so `aria-controls`
 * resolves, and is `hidden` and `inert` while collapsed. Expanded it lists every member's state
 * (P-58): names come from the roster `names` map, "A member" for anyone not in it, never the join's
 * Discord username (S-2). Token counts are hidden from a viewer (B1) and when the count is null.
 */
import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { IconButton } from '../primitives/IconButton';
import { VisuallyHidden } from '../primitives/VisuallyHidden';
import { Tag } from '../ui/Tag';
import { SOURCE_TYPE_BADGE, expansionLabel } from '../../utils/collectionBadgeConfig';
import type { FindItem } from '../../utils/findModel';
import { useProgressView } from './useProgressView';

interface FindRowProps {
  item: FindItem;
  /** Roster names by user id (`memberNames`). */
  names: Map<string, string>;
  expanded: boolean;
  onToggle: () => void;
  /** The row's action (Track, I want this, …); null while Find is read-only. */
  action: ReactNode;
  /** A viewer sees no token counts in the body (B1, P-58). */
  readerIsViewer: boolean;
}

type Member = FindItem['members'][number];

function stateLabel(m: Member): string {
  if (m.ownershipState === 'have') return 'Have';
  if (m.intent === 'hunting') return 'Want';
  if (m.intent === 'interested') return 'Interested';
  if (m.intent === 'pass') return 'Passed';
  return m.ownershipState === 'missing' ? 'Missing' : 'Unknown';
}

/** "{cost} {token}", or the token alone when the catalog has no cost (it reads as 0). */
function exchangeText(token: NonNullable<FindItem['token']>): string {
  return token.cost > 0 ? `${token.cost} ${token.name}` : token.name;
}

export function FindRow({ item, names, expanded, onToggle, action, readerIsViewer }: FindRowProps) {
  const bodyId = useId();
  const { setProgressView } = useProgressView();
  const wants = item.wantedBy.length;
  const typeLabel = item.sourceType ? (SOURCE_TYPE_BADGE[item.sourceType]?.label ?? item.sourceType) : null;

  const meta: ReactNode[] = [];
  if (item.duty) meta.push(<span key="duty">{item.duty}</span>);
  if (typeLabel) meta.push(<span key="type">{typeLabel}</span>);
  if (item.token) meta.push(<span key="token">{exchangeText(item.token)}</span>);
  if (wants > 0) meta.push(<span key="wants" className="text-text-primary">{`${wants} ${wants === 1 ? 'wants' : 'want'}`}</span>);

  return (
    <li data-testid="find-row" className="rounded-lg border border-border-subtle bg-surface-card">
      <div className="flex min-h-14 items-center gap-2 px-2 py-1.5">
        <IconButton
          aria-label={`Show details for ${item.name}`}
          aria-expanded={expanded}
          aria-controls={bodyId}
          variant="ghost"
          size="sm"
          icon={<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />}
          onClick={onToggle}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-secondary">
            {meta.flatMap((node, i) => (i === 0 ? [node] : [<span key={`sep-${i}`} aria-hidden>{' · '}</span>, node]))}
            {item.pluginReady && (
              <Tag variant="label" tone="info" className="ml-1">
                Plugin ready
              </Tag>
            )}
          </p>
        </div>
        {item.tracking !== null && (
          <Tag variant="nav" tone="success" onNavigate={() => setProgressView({ pview: 'tracks', track: item.tracking })}>
            Tracking ✓
          </Tag>
        )}
        {action}
      </div>
      <div id={bodyId} hidden={!expanded} inert={!expanded} className="space-y-2 border-t border-border-subtle px-3 py-2 text-xs text-text-secondary">
        {item.members.length > 0 && (
          <ul className="space-y-0.5">
            {item.members.map((m) => (
              <li key={m.userId}>
                <span className="text-text-primary">{`${names.get(m.userId) ?? 'A member'}: ${stateLabel(m)}`}</span>
                {!readerIsViewer && m.tokenCount !== null && (
                  <>
                    {` · ${m.tokenCount} ${item.token?.name ?? 'tokens'}`}
                    {m.canBuy && (
                      <>
                        <span aria-hidden>{' ✓'}</span>
                        <VisuallyHidden>, can buy</VisuallyHidden>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <p>
          {[item.duty, typeLabel, item.expansion ? expansionLabel(item.expansion) : null].filter((p) => p !== null && p !== '').join(' · ')}
        </p>
      </div>
    </li>
  );
}
