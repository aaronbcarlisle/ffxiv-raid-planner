/**
 * FindFooter — the line under the matrix (S2a-4a·A3 Task TA3; R-F-7, design §3.4, D-4): "{A} and
 * {B} want {farm} · Find" for the first wanted item nobody tracks yet (`topWanted`), for every
 * member role. One wanter reads "wants"; past two it names two and adds "and {k} more". Names
 * come from the roster map, "A member" for anyone not in it, never the join's Discord name (S-2).
 * Find (`LinkText`, named "Find {farm}") is the page's: it opens Find with that row expanded and
 * its toggle focused.
 */
import { LinkText } from '../ui/LinkText';
import type { FindItem } from '../../utils/findModel';

interface FindFooterProps {
  item: FindItem;
  /** Roster names by user id (`memberNames`). */
  names: Map<string, string>;
  onFind: () => void;
}

export function FindFooter({ item, names, onFind }: FindFooterProps) {
  const wanters = item.wantedBy;
  if (wanters.length === 0) return null;
  const shown = wanters.slice(0, 2).map((id) => names.get(id) ?? 'A member');
  const more = wanters.length - shown.length;
  const who = shown.length === 1 ? shown[0] : more > 0 ? `${shown[0]}, ${shown[1]} and ${more} more` : `${shown[0]} and ${shown[1]}`;
  const verb = wanters.length === 1 ? 'wants' : 'want';

  return (
    <p className="px-1 text-xs text-text-secondary">
      {`${who} ${verb} ${item.name}`}
      <span aria-hidden>{' · '}</span>
      <LinkText onClick={onFind} aria-label={`Find ${item.name}`}>
        Find
      </LinkText>
    </p>
  );
}
