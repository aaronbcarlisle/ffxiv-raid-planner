/**
 * SmartSuggestionsPanel — compact inline panel for a source-farm card.
 *
 * Shows who likely needs the reward, who is actively hunting, who can buy
 * with tokens, and who has passed. Driven by the suggestion service output.
 * Only static_only and dossier_public intents from members reach this view.
 *
 * Design rules:
 *  - Max 3 names per label before collapsing to "+ N more"
 *  - "Missing sync: N players" shown last
 *  - Never shows token counts (static-level view respects privacy)
 */

import { AlertCircle, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { XivIcon } from '../ui/XivIcon';
import type { MemberSuggestionEntry, StaticCollectionSuggestion } from '../../stores/collectionIntentStore';
import { resolveUiLocale } from '../../gamedata/mount-farm-i18n';

const MAX_NAMES = 3;

function nameList(members: MemberSuggestionEntry[], isJapanese: boolean): string {
  const names = members
    .map(m => m.displayName ?? (isJapanese ? '不明' : 'Unknown'))
    .slice(0, MAX_NAMES);
  const rest = members.length - MAX_NAMES;
  return rest > 0 ? (isJapanese ? `${names.join('、')} 他${rest}人` : `${names.join(', ')} +${rest}`) : (isJapanese ? names.join('、') : names.join(', '));
}

interface SuggestionRowProps {
  icon: React.ReactNode;
  label: string;
  names: string;
  colorClass: string;
}

function SuggestionRow({ icon, label, names, colorClass }: SuggestionRowProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`flex-shrink-0 ${colorClass}`}>{icon}</span>
      <span className={`font-semibold flex-shrink-0 ${colorClass}`}>{label}:</span>
      <span className="text-text-secondary truncate">{names}</span>
    </div>
  );
}

interface SmartSuggestionsPanelProps {
  /** The suggestion entry for this source group's catalog item (or the primary one) */
  suggestion: StaticCollectionSuggestion;
}

export function SmartSuggestionsPanel({ suggestion }: SmartSuggestionsPanelProps) {
  const { i18n } = useTranslation();
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const isJapanese = uiLocale.startsWith('ja');
  const hunting   = suggestion.members.filter(m => m.intent === 'hunting' && m.ownershipState !== 'have');
  const missing   = suggestion.members.filter(m => m.ownershipState === 'missing' && m.intent == null);
  const canBuy    = suggestion.members.filter(m => m.canBuy && m.ownershipState !== 'have' && m.intent !== 'pass' && m.intent !== 'hidden');
  const passing   = suggestion.members.filter(m => m.intent === 'pass' || m.intent === 'hidden');
  const noSync    = suggestion.members.filter(m => m.confidence === 'low' && m.ownershipState === 'unknown' && m.intent == null);

  const hasSignal = hunting.length > 0 || missing.length > 0 || canBuy.length > 0;

  if (!hasSignal && passing.length === 0 && noSync.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-2.5 bg-accent/5 border-t border-border-subtle/40">
      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">
        {isJapanese ? 'おすすめ' : 'Smart Suggestions'}
      </p>

      {hunting.length > 0 && (
        <SuggestionRow
          icon={<Search size={11} />}
          label={isJapanese ? '希望' : 'Hunting'}
          names={nameList(hunting, isJapanese)}
          colorClass="text-status-info"
        />
      )}

      {missing.length > 0 && (
        <SuggestionRow
          icon={<XivIcon name="earthlyStar" size={11} />}
          label={isJapanese ? 'おすすめ' : 'Suggested'}
          names={nameList(missing, isJapanese)}
          colorClass="text-status-warning"
        />
      )}

      {canBuy.length > 0 && (
        <SuggestionRow
          icon={<XivIcon name="gil" size={11} />}
          label={isJapanese ? '交換可' : 'Can buy'}
          names={nameList(canBuy, isJapanese)}
          colorClass="text-amber-400"
        />
      )}

      {passing.length > 0 && (
        <SuggestionRow
          icon={<X size={11} />}
          label={isJapanese ? 'パス' : 'Passed'}
          names={nameList(passing, isJapanese)}
          colorClass="text-text-muted"
        />
      )}

      {noSync.length > 0 && (
        <SuggestionRow
          icon={<AlertCircle size={11} />}
          label={isJapanese ? '未同期' : 'Missing sync'}
          names={isJapanese ? `${noSync.length}人` : `${noSync.length} player${noSync.length === 1 ? '' : 's'}`}
          colorClass="text-text-muted opacity-60"
        />
      )}
    </div>
  );
}
