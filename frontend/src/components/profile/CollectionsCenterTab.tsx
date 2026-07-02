/**
 * CollectionsCenterTab — redesigned Player Hub collection command center.
 *
 * Design improvements over v1:
 * - Compact header: title + subtitle + inline stat pills (no large empty stat boxes)
 * - "My Priorities" / "Browse Catalog" tab naming (clearer intent)
 * - Full expansion names in filters: Dawntrail, Endwalker, Shadowbringers, …
 * - Want / Farming / Have quick actions always visible on collapsed cards
 * - Browse Catalog grouped by source duty for a catalog feel
 * - Compact inline share-with-statics prompt, not a large banner
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe, Lock, Search, Users, X } from 'lucide-react';
import { Button } from '../primitives/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Skeleton } from '../ui/Skeleton';
import type {
  CatalogPlayerEntry,
  IntentValue,
  IntentVisibility,
} from '../../stores/collectionIntentStore';
import { useCollectionIntentStore } from '../../stores/collectionIntentStore';
import { toast } from '../../stores/toastStore';
import {
  CATEGORY_BADGE as CATEGORY_CONFIG,
  SOURCE_TYPE_BADGE as SOURCE_TYPE_CONFIG,
  EXPANSION_ORDER,
  expKey,
} from '../../utils/collectionBadgeConfig';
import {
  getLocalizedDutyNameByText,
  getLocalizedRewardNameByText,
  resolveUiLocale,
} from '../../gamedata/mount-farm-i18n';

function getIntentConfig(t: (key: string, options?: Record<string, unknown>) => string): Record<IntentValue, { label: string; colorClass: string; bgClass: string; borderClass: string }> {
  return {
    hunting:    { label: t('profile.collectionsCenter.intentWant'), colorClass: 'text-status-info', bgClass: 'bg-status-info/10', borderClass: 'border-status-info/40' },
    interested: { label: t('profile.collectionsCenter.intentFarming'), colorClass: 'text-status-warning', bgClass: 'bg-status-warning/10', borderClass: 'border-status-warning/40' },
    pass:       { label: t('profile.collectionsCenter.intentPass'), colorClass: 'text-text-muted', bgClass: 'bg-surface-raised', borderClass: 'border-border-subtle' },
    hidden:     { label: t('profile.collectionsCenter.intentHidden'), colorClass: 'text-text-muted', bgClass: 'bg-surface-raised', borderClass: 'border-border-subtle' },
  };
}

const FULL_INTENT_ORDER: IntentValue[] = ['hunting', 'interested', 'pass', 'hidden'];

function getFullIntentLabels(t: (key: string, options?: Record<string, unknown>) => string): Record<IntentValue, string> {
  return {
    hunting: t('profile.collectionsCenter.intentHunting'),
    interested: t('profile.collectionsCenter.intentInterested'),
    pass: t('profile.collectionsCenter.intentPass'),
    hidden: t('profile.collectionsCenter.intentHidden'),
  };
}

function getVisibilityOptions(t: (key: string, options?: Record<string, unknown>) => string) {
  return [
    { value: 'private', label: t('profile.collectionsCenter.privateOnlyYou') },
    { value: 'static_only', label: t('profile.collectionsCenter.sharedWithStatics') },
    { value: 'dossier_public', label: t('profile.collectionsCenter.publicOnDossier') },
  ];
}

function getCategoryLabel(category: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  switch (category) {
    case 'mount':
      return t('collections.typeMount');
    case 'orchestrion':
      return t('collections.typeOrchestrion');
    case 'minion':
      return t('collections.typeMinion');
    case 'weapon':
      return t('collections.typeWeapon');
    case 'glam':
      return t('collections.typeGlam');
    case 'card':
      return t('profile.collectionsCenter.typeCard');
    case 'other':
      return t('profile.collectionsCenter.typeOther');
    default:
      return category ?? '';
  }
}

function getExpansionDisplay(expansion: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  switch (expKey(expansion)) {
    case 'dt':
      return t('profile.collectionsCenter.expansionDt');
    case 'ew':
      return t('profile.collectionsCenter.expansionEw');
    case 'shb':
      return t('profile.collectionsCenter.expansionShb');
    case 'sb':
      return t('profile.collectionsCenter.expansionSb');
    case 'hw':
      return t('profile.collectionsCenter.expansionHw');
    case 'arr':
      return t('profile.collectionsCenter.expansionArr');
    default:
      return expansion ?? '';
  }
}

function getSourceTypeLabel(sourceType: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  switch (sourceType) {
    case 'extreme':
      return t('profile.collectionsCenter.sourceExtreme');
    case 'savage':
      return t('profile.collectionsCenter.sourceSavage');
    case 'ultimate':
      return t('profile.collectionsCenter.sourceUltimate');
    case 'criterion':
      return t('profile.collectionsCenter.sourceCriterion');
    case 'chaotic_alliance':
      return t('profile.collectionsCenter.sourceChaoticAlliance');
    case 'collaboration':
      return t('profile.collectionsCenter.sourceCollaboration');
    case 'field_operation':
      return t('profile.collectionsCenter.sourceFieldOperation');
    default:
      return sourceType ?? '';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface DutyGroup {
  dutyKey: string;
  dutyName: string | null;
  expansionKey: string | null;
  expansionLabel: string | null;
  sourceType: string | null;
  items: CatalogPlayerEntry[];
}

function groupBySourceDuty(entries: CatalogPlayerEntry[]): DutyGroup[] {
  const map = new Map<string, CatalogPlayerEntry[]>();
  for (const e of entries) {
    const key = e.sourceDutyName ?? '__none__';
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()]
    .map(([key, items]): DutyGroup => {
      const first = items[0];
      return {
        dutyKey:        key,
        dutyName:       key === '__none__' ? null : key,
        expansionKey:   first?.expansion ?? null,
        expansionLabel: first?.expansion ?? null,
        sourceType:     first?.sourceType ?? null,
        items,
      };
    })
    .sort((a, b) => {
      const ea = EXPANSION_ORDER[expKey(a.expansionKey)] ?? 99;
      const eb = EXPANSION_ORDER[expKey(b.expansionKey)] ?? 99;
      if (ea !== eb) return ea - eb;
      return (a.dutyName ?? '').localeCompare(b.dutyName ?? '');
    });
}

// ── Callbacks type ────────────────────────────────────────────────────────────

interface RewardCallbacks {
  onWant:             (id: string, currentVis: IntentVisibility) => void;
  onFarming:          (id: string, currentVis: IntentVisibility) => void;
  onIntentClear:      (id: string) => void;
  onFullIntent:       (id: string, intent: IntentValue, vis: IntentVisibility) => void;
  onVisibilityChange: (id: string, vis: IntentVisibility) => void;
  onOwnershipChange:  (id: string, state: 'have' | 'missing' | 'unknown') => void;
  onTokenChange:      (id: string, count: number | null) => void;
}

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({ label, value, colorClass, icon }: {
  label: string; value: number; colorClass: string; icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border-subtle bg-surface-raised text-xs whitespace-nowrap">
      {icon}
      <span className={`font-bold tabular-nums ${colorClass}`}>{value}</span>
      <span className="text-text-muted">{label}</span>
    </span>
  );
}

// ── FilterChip ────────────────────────────────────────────────────────────────

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    /* design-system-ignore: compact filter chip with active/inactive states */
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? 'border-accent/50 bg-accent/15 text-accent'
          : 'border-border-default bg-surface-elevated text-text-secondary hover:border-accent/30 hover:text-accent'
      }`}
    >
      {label}
    </button>
  );
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

function FilterBar({
  catalog,
  categoryFilter, expansionFilter, sourceTypeFilter,
  onCategoryChange, onExpansionChange, onSourceTypeChange,
}: {
  catalog: CatalogPlayerEntry[];
  categoryFilter: string | null; expansionFilter: string | null; sourceTypeFilter: string | null;
  onCategoryChange: (v: string | null) => void;
  onExpansionChange: (v: string | null) => void;
  onSourceTypeChange: (v: string | null) => void;
}) {
  const { t } = useTranslation();
  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const e of catalog) if (e.catalogItemCategory) s.add(e.catalogItemCategory);
    return [...s].sort();
  }, [catalog]);

  const expansions = useMemo(() => {
    const s = new Set<string>();
    for (const e of catalog) if (e.expansion) s.add(expKey(e.expansion));
    return [...s].sort((a, b) => (EXPANSION_ORDER[a] ?? 99) - (EXPANSION_ORDER[b] ?? 99));
  }, [catalog]);

  const sourceTypes = useMemo(() => {
    const s = new Set<string>();
    for (const e of catalog) if (e.sourceType) s.add(e.sourceType);
    return [...s].sort();
  }, [catalog]);

  if (categories.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised/40 px-3 py-2.5 flex flex-col gap-2">
      {categories.length > 1 && (
        <div className="flex flex-wrap items-start gap-1.5">
          <span className="text-[10px] text-text-muted pt-1 mr-1 min-w-[5.5rem]">{t('profile.collectionsCenter.rewardType')}</span>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={!categoryFilter} label={t('common.all')} onClick={() => onCategoryChange(null)} />
            {categories.map(cat => (
              <FilterChip
                key={cat}
                active={categoryFilter === cat}
                label={getCategoryLabel(cat, t)}
                onClick={() => onCategoryChange(categoryFilter === cat ? null : cat)}
              />
            ))}
          </div>
        </div>
      )}

      {expansions.length > 1 && (
        <div className="flex flex-wrap items-start gap-1.5">
          <span className="text-[10px] text-text-muted pt-1 mr-1 min-w-[5.5rem]">{t('profile.collectionsCenter.expansion')}</span>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={!expansionFilter} label={t('common.all')} onClick={() => onExpansionChange(null)} />
            {expansions.map(ek => (
              <FilterChip
                key={ek}
                active={expansionFilter === ek}
                label={getExpansionDisplay(ek, t)}
                onClick={() => onExpansionChange(expansionFilter === ek ? null : ek)}
              />
            ))}
          </div>
        </div>
      )}

      {sourceTypes.length > 1 && (
        <div className="flex flex-wrap items-start gap-1.5">
          <span className="text-[10px] text-text-muted pt-1 mr-1 min-w-[5.5rem]">{t('profile.collectionsCenter.source')}</span>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={!sourceTypeFilter} label={t('common.all')} onClick={() => onSourceTypeChange(null)} />
            {sourceTypes.map(st => (
              <FilterChip
                key={st}
                active={sourceTypeFilter === st}
                label={getSourceTypeLabel(st, t)}
                onClick={() => onSourceTypeChange(sourceTypeFilter === st ? null : st)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── VisibilityIcon ────────────────────────────────────────────────────────────

function VisibilityBadge({ visibility, intent }: { visibility: IntentVisibility | null; intent: IntentValue | null }) {
  const { t } = useTranslation();
  if (!intent || (intent !== 'hunting' && intent !== 'interested')) return null;
  if (visibility === 'static_only')   return <Users  size={11} className="text-accent flex-shrink-0" aria-label={t('profile.collectionsCenter.sharedWithStatics')} />;
  if (visibility === 'dossier_public') return <Globe  size={11} className="text-accent flex-shrink-0" aria-label={t('profile.collectionsCenter.publicOnDossier')} />;
  return                                      <Lock   size={11} className="text-text-muted opacity-40 flex-shrink-0" aria-label={t('common.private')} />;
}

// ── Quick action buttons (always visible, no expansion required) ───────────────

function QuickActions({
  entry, onWant, onFarming, onIntentClear, onOwnershipChange,
}: Pick<RewardCallbacks, 'onWant' | 'onFarming' | 'onIntentClear' | 'onOwnershipChange'> & { entry: CatalogPlayerEntry }) {
  const { t } = useTranslation();
  const id = entry.catalogItemId;
  const vis = entry.visibility ?? 'private';
  const isOwned    = entry.ownershipState === 'have';
  const isWanting  = entry.intent === 'hunting';
  const isFarming  = entry.intent === 'interested';

  if (isOwned) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-status-success bg-status-success/15 border border-status-success/40 px-2 py-0.5 rounded-full">
        <Check size={9} /> {t('profile.collectionsCenter.owned')}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
      {/* Want */}
      {/* eslint-disable-next-line design-system/no-raw-button */}
      <button
        type="button"
        onClick={() => isWanting ? onIntentClear(id) : onWant(id, vis)}
        title={isWanting ? t('profile.collectionsCenter.removeWant') : t('profile.collectionsCenter.markAsWanted')}
        className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${
          isWanting
            ? 'border-status-info bg-status-info/25 text-status-info'
            : 'border-border-default bg-surface-elevated text-text-secondary hover:border-status-info/60 hover:text-status-info hover:bg-status-info/10'
        }`}
      >
        {isWanting && <Check size={9} />}
        {t('profile.collectionsCenter.intentWant')}
      </button>

      {/* Farming */}
      {!isWanting && (
        // eslint-disable-next-line design-system/no-raw-button
        <button
          type="button"
          onClick={() => isFarming ? onIntentClear(id) : onFarming(id, vis)}
          title={isFarming ? t('profile.collectionsCenter.removeFarming') : t('profile.collectionsCenter.markAsFarming')}
          className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${
            isFarming
              ? 'border-status-warning bg-status-warning/25 text-status-warning'
              : 'border-border-default bg-surface-elevated text-text-secondary hover:border-status-warning/60 hover:text-status-warning hover:bg-status-warning/10'
          }`}
        >
          {isFarming && <Check size={9} />}
          {t('profile.collectionsCenter.intentFarming')}
        </button>
      )}

      {/* Have */}
      {/* eslint-disable-next-line design-system/no-raw-button */}
      <button
        type="button"
        onClick={() => onOwnershipChange(id, 'have')}
        title={t('profile.collectionsCenter.markAsOwned')}
        className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border border-border-default bg-surface-elevated text-text-secondary hover:border-status-success/60 hover:text-status-success hover:bg-status-success/10 font-semibold transition-colors"
      >
        {t('profile.collectionsCenter.have')}
      </button>
    </div>
  );
}

// ── RewardCard ────────────────────────────────────────────────────────────────

function RewardCard({ entry, compact = false, ...cbs }: { entry: CatalogPlayerEntry; compact?: boolean } & RewardCallbacks) {
  const { t, i18n } = useTranslation();
  const id = entry.catalogItemId;
  const [expanded, setExpanded] = useState(false);
  const [shareDismissed, setShareDismissed] = useState(false);
  const [tokenInput, setTokenInput] = useState(entry.tokenCount?.toString() ?? '');
  const [prevTokenCount, setPrevTokenCount] = useState(entry.tokenCount);
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const localizedItemName = getLocalizedRewardNameByText(entry.catalogItemName, uiLocale) || entry.catalogItemName;
  const localizedDutyName = getLocalizedDutyNameByText(entry.sourceDutyName, uiLocale) || entry.sourceDutyName;
  if (prevTokenCount !== entry.tokenCount) {
    setPrevTokenCount(entry.tokenCount);
    setTokenInput(entry.tokenCount?.toString() ?? '');
  }

  const catCfg      = CATEGORY_CONFIG[entry.catalogItemCategory ?? ''] ?? null;
  const catLabel    = getCategoryLabel(entry.catalogItemCategory, t);
  const expLabel    = getExpansionDisplay(entry.expansion, t);
  const isPlugin    = entry.snapshotSource === 'plugin';
  const isOwned     = entry.ownershipState === 'have';
  const currentVis  = (entry.visibility ?? 'private') as IntentVisibility;
  const showShare   = !shareDismissed
    && (entry.intent === 'hunting' || entry.intent === 'interested')
    && entry.visibility === 'private';

  const intentConfig = getIntentConfig(t);
  const fullIntentLabels = getFullIntentLabels(t);
  const visibilityOptions = getVisibilityOptions(t);
  const cfg = entry.intent ? intentConfig[entry.intent] : null;

  function handleTokenBlur() {
    const n = parseInt(tokenInput, 10);
    const count = tokenInput === '' || isNaN(n) ? null : Math.max(0, n);
    if (count !== entry.tokenCount) cbs.onTokenChange(id, count);
  }

  return (
    <div className={`rounded-lg border transition-colors ${
      expanded ? 'border-border-default' : 'border-border-subtle hover:border-border-default'
    } overflow-hidden`}>
      {/* ── Collapsed row ── */}
      {/* design-system-ignore: div-as-row to avoid button-inside-button — quick actions are sibling buttons */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-raised/20 hover:bg-surface-raised/40 transition-colors">
        {/* Expand toggle zone (left 60% of row) */}
        {/* design-system-ignore: div acting as expand trigger to avoid button nesting */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded(e => !e)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(ex => !ex)}
          className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
        >
          {/* Category badge */}
          {catLabel && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest flex-shrink-0 min-w-[3.5rem] text-center ${
              catCfg
                ? `${catCfg.colorClass} ${catCfg.bgClass} ${catCfg.borderClass}`
                : 'border-border-subtle bg-surface-elevated text-text-muted'
            }`}>
              {catLabel}
            </span>
          )}

          {/* Name + source */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-text-primary truncate block">
              {localizedItemName}
            </span>
            {!compact && (localizedDutyName || expLabel) && (
              <span className="text-[10px] text-text-muted truncate block mt-0.5">
                {[localizedDutyName, expLabel].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          {/* Intent badge */}
          {cfg && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${cfg.colorClass} ${cfg.bgClass} ${cfg.borderClass}`}>
              {fullIntentLabels[entry.intent!]}
            </span>
          )}

          {/* Visibility indicator */}
          <VisibilityBadge visibility={entry.visibility} intent={entry.intent} />
        </div>

        {/* Quick actions — sibling to the expand zone, NOT nested in it */}
        <QuickActions
          entry={entry}
          onWant={cbs.onWant}
          onFarming={cbs.onFarming}
          onIntentClear={cbs.onIntentClear}
          onOwnershipChange={cbs.onOwnershipChange}
        />

        {/* design-system-ignore: standalone expand chevron button */}
        <button
          type="button"
          aria-label={expanded ? t('profile.collectionsCenter.collapse') : t('profile.collectionsCenter.expand')}
          onClick={() => setExpanded(e => !e)}
          className="flex-shrink-0 p-1 rounded hover:bg-surface-raised text-text-muted transition-colors"
        >
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* ── Expanded controls ── */}
      {expanded && (
        <div className="border-t border-border-subtle/50 bg-surface-raised/10 px-3 py-3 flex flex-col gap-2.5">
          {/* Full intent selector */}
          <div>
            <p className="text-[10px] font-medium text-text-muted mb-1.5">{t('profile.collectionsCenter.intent')}</p>
            <div className="flex flex-wrap gap-1.5">
              {/* eslint-disable-next-line design-system/no-raw-button */}
              <button
                type="button"
                onClick={() => cbs.onIntentClear(id)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  !entry.intent
                    ? 'border-border-default bg-surface-elevated text-text-primary font-semibold'
                    : 'border-border-subtle text-text-muted hover:border-border-default'
                }`}
              >
                {t('common.none')}
              </button>
              {FULL_INTENT_ORDER.map(iv => {
                const c = intentConfig[iv];
                const active = entry.intent === iv;
                return (
                  // eslint-disable-next-line design-system/no-raw-button
                  <button
                    key={iv}
                    type="button"
                    onClick={() => cbs.onFullIntent(id, iv, currentVis)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium ${
                      active
                        ? `${c.colorClass} ${c.bgClass} ${c.borderClass}`
                        : 'border-border-subtle text-text-muted hover:border-border-default'
                    }`}
                    >
                    {fullIntentLabels[iv]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visibility + Ownership (only when intent is hunting/interested) */}
          {(entry.intent === 'hunting' || entry.intent === 'interested') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-medium text-text-muted mb-1">{t('profile.collectionsCenter.visibility')}</p>
                <Select
                  value={currentVis}
                  onChange={value => cbs.onVisibilityChange(id, value as IntentVisibility)}
                  options={visibilityOptions}
                />
              </div>
              <div>
                <p className="text-[10px] font-medium text-text-muted mb-1">{t('profile.collectionsCenter.ownership')}</p>
                {/* design-system-ignore: compact ownership toggle chips */}
                <div className="flex gap-1">
                  {(['have', 'missing', 'unknown'] as const).map(state => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => cbs.onOwnershipChange(id, state)}
                      className={`text-[10px] py-1.5 rounded border transition-colors flex-1 font-medium ${
                        entry.ownershipState === state
                          ? state === 'have'
                            ? 'border-status-success/50 bg-status-success/10 text-status-success'
                            : state === 'missing'
                            ? 'border-status-error/50 bg-status-error/10 text-status-error'
                            : 'border-border-default bg-surface-elevated text-text-secondary'
                          : 'border-border-subtle text-text-muted hover:border-border-default'
                      }`}
                    >
                      {state === 'have' ? '✓' : state === 'missing' ? '✗' : '?'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Token count */}
          {!isOwned && (
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-text-muted">{t('profile.collectionsCenter.tokensCollected')}</span>
              {/* design-system-ignore: small inline number input */}
              <input
                type="number"
                min={0}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onBlur={handleTokenBlur}
                placeholder="0"
                disabled={isPlugin}
                className="w-20 text-xs px-2 py-1 rounded border border-border-subtle bg-surface-base text-text-primary focus:border-accent focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              />
              {isPlugin && <span className="text-[10px] text-accent opacity-60">{t('profile.collectionsCenter.syncedFromPlugin')}</span>}
            </div>
          )}

          {/* Visibility description */}
          {entry.intent && entry.visibility && (
            <p className="text-[10px] text-text-muted">
              {entry.visibility === 'private'        && t('profile.collectionsCenter.visibilityPrivateDesc')}
              {entry.visibility === 'static_only'    && t('profile.collectionsCenter.visibilityStaticDesc')}
              {entry.visibility === 'dossier_public' && t('profile.collectionsCenter.visibilityPublicDesc')}
            </p>
          )}

          {/* Share prompt (compact, inline) */}
          {showShare && (
            <div className="flex items-center gap-2 rounded border border-status-info/25 bg-status-info/5 px-2.5 py-2">
              <Users size={11} className="flex-shrink-0 text-accent" />
              <p className="text-[11px] text-text-secondary flex-1 min-w-0">
                {t('profile.collectionsCenter.sharePrompt')}
              </p>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button
                  size="xs"
                  variant="accent-subtle"
                  onClick={() => { cbs.onVisibilityChange(id, 'static_only'); setShareDismissed(true); }}
                >
                  {t('profile.collectionsCenter.share')}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setShareDismissed(true)}
                  className="text-text-muted"
                >
                  {t('profile.collectionsCenter.keepPrivate')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DutyGroupSection (Browse Catalog) ─────────────────────────────────────────

function DutyGroupSection({ group, ...cbs }: { group: DutyGroup } & RewardCallbacks) {
  const { t, i18n } = useTranslation();
  const srcCfg   = group.sourceType ? SOURCE_TYPE_CONFIG[group.sourceType] ?? null : null;
  const srcLabel = getSourceTypeLabel(group.sourceType, t);
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);
  const localizedDutyName = getLocalizedDutyNameByText(group.dutyName, uiLocale) || group.dutyName;

  return (
    <div className="rounded-lg border border-border-subtle overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-raised/60 border-b border-border-subtle/40">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary truncate">
            {localizedDutyName ?? t('profile.collectionsCenter.otherRewards')}
          </span>
          {srcLabel && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${
              srcCfg ? srcCfg.colorClass : 'border-border-subtle bg-surface-elevated text-text-muted'
            }`}>
              {srcLabel}
            </span>
          )}
        </div>
        {group.expansionLabel && (
          <span className="text-[10px] text-text-muted flex-shrink-0">{getExpansionDisplay(group.expansionLabel, t)}</span>
        )}
      </div>

      {/* Reward rows */}
      <div className="divide-y divide-border-subtle/30">
        {group.items.map(item => (
          <RewardCard key={item.catalogItemId} entry={item} compact={true} {...cbs} />
        ))}
      </div>
    </div>
  );
}

// ── My Priorities view ────────────────────────────────────────────────────────

function MyPrioritiesView({ items, onBrowse, ...cbs }: { items: CatalogPlayerEntry[]; onBrowse: () => void } & RewardCallbacks) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised/30 px-6 py-10 text-center">
        <Search size={28} className="mx-auto mb-3 text-text-muted opacity-30" />
        <p className="font-semibold text-text-primary text-sm">{t('profile.collectionsCenter.nothingTrackedYet')}</p>
        <p className="mt-1 text-xs text-text-secondary">
          {t('profile.collectionsCenter.nothingTrackedDesc')}
        </p>
        <Button size="sm" variant="accent-subtle" onClick={onBrowse} className="mt-4">
          {t('profile.collectionsTabs.browse')}
        </Button>
      </div>
    );
  }

  const grouped: Record<IntentValue, CatalogPlayerEntry[]> = {
    hunting: [], interested: [], pass: [], hidden: [],
  };
  for (const item of items) if (item.intent) grouped[item.intent].push(item);

  const sections = ([
    { key: 'hunting',    label: t('profile.collectionsCenter.intentWant'), items: grouped.hunting    },
    { key: 'interested', label: t('profile.collectionsCenter.intentFarming'), items: grouped.interested },
    { key: 'pass',       label: t('profile.collectionsCenter.intentPass'), items: grouped.pass       },
    { key: 'hidden',     label: t('profile.collectionsCenter.intentHidden'),  items: grouped.hidden     },
  ] as { key: IntentValue; label: string; items: CatalogPlayerEntry[] }[]).filter(s => s.items.length > 0);

  const sectionColorClass: Record<IntentValue, string> = {
    hunting:    'text-status-info',
    interested: 'text-status-warning',
    pass:       'text-text-muted',
    hidden:     'text-text-muted',
  };

  return (
    <div className="flex flex-col gap-4">
      {sections.map(section => (
        <div key={section.key}>
          <div className="flex items-center gap-2 mb-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${sectionColorClass[section.key]}`}>
              {section.label}
            </h4>
            <span className="text-[10px] text-text-muted">({section.items.length})</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {section.items.map(item => (
              <RewardCard key={item.catalogItemId} entry={item} {...cbs} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Browse Catalog view ───────────────────────────────────────────────────────

function BrowseCatalogView({ items, ...cbs }: { items: CatalogPlayerEntry[] } & RewardCallbacks) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupBySourceDuty(items), [items]);

  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-text-muted py-8 opacity-60">
        {t('profile.collectionsCenter.noRewardsMatch')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-text-muted mb-1">
        {t('profile.collectionsCenter.browseSummary', { duties: groups.length, rewards: items.length })}
      </p>
      {groups.map(g => (
        <DutyGroupSection key={g.dutyKey} group={g} {...cbs} />
      ))}
    </div>
  );
}

// ── CollectionsCenterTab (main) ───────────────────────────────────────────────

export function CollectionsCenterTab({
  view: viewProp,
  onViewChange,
}: {
  view?: 'priorities' | 'browse';
  onViewChange?: (v: 'priorities' | 'browse') => void;
} = {}) {
  const { t, i18n } = useTranslation();
  const {
    myCatalog, myCatalogLoaded, fetchMyCatalog,
    upsertIntent, deleteIntent, upsertSnapshot,
  } = useCollectionIntentStore();
  const uiLocale = resolveUiLocale(i18n.resolvedLanguage);

  const [viewInternal, setViewInternal] = useState<'priorities' | 'browse'>('priorities');
  const view = viewProp ?? viewInternal;
  const setView = (v: 'priorities' | 'browse') => {
    setViewInternal(v);
    onViewChange?.(v);
  };
  const [categoryFilter,  setCategoryFilter]  = useState<string | null>(null);
  const [expansionFilter, setExpansionFilter] = useState<string | null>(null);
  const [sourceTypeFilter,setSourceTypeFilter] = useState<string | null>(null);
  const [searchQuery,     setSearchQuery]     = useState('');

  useEffect(() => {
    if (!myCatalogLoaded) fetchMyCatalog();
  }, [myCatalogLoaded, fetchMyCatalog]);

  // Client-side filtering (filters stored by raw expansion key, e.g. "dt").
  // Text search matches the reward name and its source duty (e.g. a raid name).
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return myCatalog.filter(e =>
      (!categoryFilter   || e.catalogItemCategory === categoryFilter) &&
      (!expansionFilter  || expKey(e.expansion) === expansionFilter) &&
      (!sourceTypeFilter || e.sourceType === sourceTypeFilter) &&
      (!q ||
        e.catalogItemName.toLowerCase().includes(q) ||
        (e.sourceDutyName ?? '').toLowerCase().includes(q) ||
        getLocalizedRewardNameByText(e.catalogItemName, uiLocale).toLowerCase().includes(q) ||
        getLocalizedDutyNameByText(e.sourceDutyName, uiLocale).toLowerCase().includes(q))
    );
  }, [myCatalog, categoryFilter, expansionFilter, sourceTypeFilter, searchQuery, uiLocale]);

  // My Priorities: items with any intent, sorted
  const priorityItems = useMemo(() => {
    const intentOrder: Record<IntentValue, number> = { hunting: 0, interested: 1, pass: 2, hidden: 3 };
    return filteredCatalog
      .filter(e => e.intent !== null)
      .sort((a, b) => (intentOrder[a.intent!] ?? 4) - (intentOrder[b.intent!] ?? 4));
  }, [filteredCatalog]);

  // Compact summary stats (always from full catalog, unfiltered)
  const stats = useMemo(() => ({
    hunting:    myCatalog.filter(e => e.intent === 'hunting').length,
    shared:     myCatalog.filter(e => (e.intent === 'hunting' || e.intent === 'interested') && e.visibility === 'static_only').length,
    withTokens: myCatalog.filter(e => e.ownershipState !== 'have' && e.tokenCount != null && e.tokenCount > 0).length,
    public:     myCatalog.filter(e => e.visibility === 'dossier_public').length,
  }), [myCatalog]);

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const getEntry = useCallback((id: string) =>
    myCatalog.find(e => e.catalogItemId === id), [myCatalog]
  );

  const onWant = useCallback(async (id: string, vis: IntentVisibility) => {
    try {
      await upsertIntent(id, { intent: 'hunting', priority: getEntry(id)?.priority ?? 'medium', visibility: vis });
    } catch { toast.error(t('profile.collectionsCenter.failedToUpdateIntent')); }
  }, [upsertIntent, getEntry, t]);

  const onFarming = useCallback(async (id: string, vis: IntentVisibility) => {
    try {
      await upsertIntent(id, { intent: 'interested', priority: getEntry(id)?.priority ?? 'medium', visibility: vis });
    } catch { toast.error(t('profile.collectionsCenter.failedToUpdateIntent')); }
  }, [upsertIntent, getEntry, t]);

  const onIntentClear = useCallback(async (id: string) => {
    try { await deleteIntent(id); }
    catch { toast.error(t('profile.collectionsCenter.failedToRemoveIntent')); }
  }, [deleteIntent, t]);

  const onFullIntent = useCallback(async (id: string, intent: IntentValue, vis: IntentVisibility) => {
    try {
      await upsertIntent(id, { intent, priority: getEntry(id)?.priority ?? 'medium', visibility: vis });
    } catch { toast.error(t('profile.collectionsCenter.failedToUpdateIntent')); }
  }, [upsertIntent, getEntry, t]);

  const onVisibilityChange = useCallback(async (id: string, vis: IntentVisibility) => {
    const e = getEntry(id);
    if (!e?.intent) return;
    try {
      await upsertIntent(id, { intent: e.intent, priority: e.priority ?? 'medium', visibility: vis });
    } catch { toast.error(t('profile.collectionsCenter.failedToUpdateVisibility')); }
  }, [upsertIntent, getEntry, t]);

  const onOwnershipChange = useCallback(async (id: string, state: 'have' | 'missing' | 'unknown') => {
    try { await upsertSnapshot(id, { ownershipState: state }); }
    catch { toast.error(t('profile.collectionsCenter.failedToUpdateOwnership')); }
  }, [upsertSnapshot, t]);

  const onTokenChange = useCallback(async (id: string, count: number | null) => {
    const e = getEntry(id);
    try { await upsertSnapshot(id, { ownershipState: e?.ownershipState ?? 'unknown', tokenCount: count }); }
    catch { toast.error(t('profile.collectionsCenter.failedToUpdateTokenCount')); }
  }, [upsertSnapshot, getEntry, t]);

  const callbacks: RewardCallbacks = {
    onWant, onFarming, onIntentClear, onFullIntent,
    onVisibilityChange, onOwnershipChange, onTokenChange,
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (!myCatalogLoaded) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-11 rounded-lg" />)}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* ── Compact header ── */}
      <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
        {/* Stat pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          <StatPill
            label={t('profile.collectionsCenter.hunting')}
            value={stats.hunting}
            colorClass="text-status-info"
            icon={<span className="text-[9px]">🎯</span>}
          />
          <StatPill
            label={t('profile.collectionsCenter.shared')}
            value={stats.shared}
            colorClass="text-accent"
            icon={<Users size={9} className="text-accent" />}
          />
          <StatPill
            label={t('profile.collectionsCenter.canBuy')}
            value={stats.withTokens}
            colorClass="text-status-warning"
            icon={<span className="text-[9px]">💰</span>}
          />
          <StatPill
            label={t('common.public')}
            value={stats.public}
            colorClass="text-accent"
            icon={<Globe size={9} className="text-accent" />}
          />
        </div>

        {/* Inner tab toggle — only shown when not controlled by parent */}
        {viewProp === undefined && (
          <div className="flex gap-1 bg-surface-base rounded-lg p-1">
            {([
              { id: 'priorities' as const, label: `${t('profile.collectionsTabs.priorities')}${priorityItems.length > 0 ? ` (${priorityItems.length})` : ''}` },
              { id: 'browse'     as const, label: t('profile.collectionsTabs.browse') },
            ]).map(tab => (
              /* design-system-ignore: view toggle tab */
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  view === tab.id
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <FilterBar
        catalog={myCatalog}
        categoryFilter={categoryFilter}
        expansionFilter={expansionFilter}
        sourceTypeFilter={sourceTypeFilter}
        onCategoryChange={setCategoryFilter}
        onExpansionChange={setExpansionFilter}
        onSourceTypeChange={setSourceTypeFilter}
      />

      {/* ── Search (matches reward and duty/raid names) ── */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('profile.collectionsCenter.searchPlaceholder')}
          className="pl-8 pr-8"
        />
        {searchQuery && (
          // eslint-disable-next-line design-system/no-raw-button
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label={t('profile.collectionsCenter.clearSearch')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Compact privacy legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] text-text-muted">
        <span className="flex items-center gap-1"><Lock size={9} className="opacity-40" /> {t('profile.collectionsCenter.privateOnlyYou')}</span>
        <span className="flex items-center gap-1"><Users size={9} className="text-accent" /> {t('profile.collectionsCenter.sharedFeedsFarms')}</span>
        <span className="flex items-center gap-1"><Globe size={9} className="text-accent" /> {t('profile.collectionsCenter.publicOnDossier')}</span>
      </div>

      {/* ── Content ──
          Browse Catalog: the reward list gets its own bounded scroll so the
          stats/filters/search above stay in view while only the list scrolls. */}
      {view === 'priorities' ? (
        <MyPrioritiesView
          items={priorityItems}
          onBrowse={() => setView('browse')}
          {...callbacks}
        />
      ) : (
        <div className="max-h-[58vh] overflow-y-auto -mx-1 px-1" style={{ scrollbarGutter: 'stable' }}>
          <BrowseCatalogView items={filteredCatalog} {...callbacks} />
        </div>
      )}
    </div>
  );
}
