/**
 * Static fallback catalog — mirrors catalog_data.py.
 * Shown when the API catalog is unavailable. Track buttons are disabled in fallback mode.
 */
import type { CatalogItem } from '../stores/collectionGoalStore';

function mount(
  id: string,
  name: string,
  expansion: 'dt' | 'ew',
  sourceDutyName: string,
  sourceDutyKey: string,
  patch: string,
  tokenName: string | null,
  tokenCost: number | null,
  notes?: string,
): CatalogItem {
  return {
    id: `fallback-${id}`,
    externalSource: 'internal',
    externalId: id,
    name,
    category: 'mount',
    expansion,
    patch,
    iconUrl: null,
    imageUrl: null,
    sourceText: sourceDutyName,
    sourceType: 'extreme',
    sourceDutyName,
    sourceDutyKey,
    tokenName,
    tokenCost,
    tradeable: false,
    rarityOwnedPercent: null,
    isCurated: true,
    notes: notes ?? null,
  };
}

function weapon(
  id: string,
  name: string,
  expansion: 'dt' | 'ew',
  sourceDutyName: string,
  sourceDutyKey: string,
  patch: string,
  tokenName: string,
  tokenCost: number,
): CatalogItem {
  return {
    id: `fallback-${id}`,
    externalSource: 'internal',
    externalId: id,
    name,
    category: 'weapon',
    expansion,
    patch,
    iconUrl: null,
    imageUrl: null,
    sourceText: sourceDutyName,
    sourceType: 'ultimate',
    sourceDutyName,
    sourceDutyKey,
    tokenName,
    tokenCost,
    tradeable: false,
    rarityOwnedPercent: null,
    isCurated: true,
    notes: null,
  };
}

export const FALLBACK_CATALOG: CatalogItem[] = [
  // ── Dawntrail Extreme Mounts ──────────────────────────────────────────────
  mount('dt-ex2-mount', 'Wings of Ruin', 'dt', 'Worqor Lar Dor (Extreme)', 'dt-worqor-lar-dor-ex', '7.0', 'Skyruin Totem', 99),
  mount('dt-ex3-mount', 'Wings of Resolve', 'dt', 'Everkeep (Extreme)', 'dt-everkeep-ex', '7.0', 'Resilient Totem', 99),
  mount('dt-ex4-mount', 'Wings of Eternity', 'dt', "The Minstrel's Ballad: Sphene's Burden", 'dt-sphene-ex', '7.1', 'Totem of Eternal', 99),
  mount('dt-ex5-mount', 'Wings of the Knighthood', 'dt', 'Recollection (Extreme)', 'dt-recollection-ex', '7.2', 'Knight Totem', 99),
  mount('dt-ex6-mount', 'Wings of Death', 'dt', "The Minstrel's Ballad: Necron's Embrace", 'dt-necron-ex', '7.2', 'Grave Totem', 99),
  mount('dt-ex7-mount', 'Felyne Support Team Cart Horn', 'dt', 'The Windward Wilds (Extreme)', 'dt-windward-wilds-ex', '7.2', 'Guardian Arkveld Certificate', 99),
  mount('dt-ex8-mount', 'Wings of Mist', 'dt', 'Hell on Rails (Extreme)', 'dt-hell-on-rails-ex', '7.25', null, null, 'Totem exchange not yet available'),
  mount('dt-ex9-mount', 'Wings of Nihility', 'dt', 'The Unmaking (Extreme)', 'dt-unmaking-ex', '7.25', null, null, 'Totem exchange not yet available'),
  // ── Dawntrail Ultimates ───────────────────────────────────────────────────
  weapon('dt-ult1-weapons', 'Ultimate Edenmorn Weapons', 'dt', 'Futures Rewritten (Ultimate)', 'dt-futures-rewritten-ult', '7.0', 'Oracle Totem', 7),
  weapon('dt-ult2-weapons', 'Palazzo Diamond Weapons', 'dt', 'Dancing Mad (Ultimate)', 'dt-dancing-mad-ult', '7.2', "Mad Harlequin's Totem", 7),
  // ── Endwalker Extreme Mounts ──────────────────────────────────────────────
  mount('ew-ex1-mount', 'Lynx of Eternal Darkness', 'ew', 'The Dark Inside (Extreme)', 'ew-zodiark-ex', '6.0', 'Totem of the Fallen', 99),
  mount('ew-ex2-mount', 'Lynx of Righteous Fire', 'ew', 'The Mothercrystal (Extreme)', 'ew-hydaelyn-ex', '6.0', 'Totem of the Radiant', 99),
  mount('ew-ex3-mount', 'Lynx of Imperial Sorrow', 'ew', "Storm's Crown (Extreme)", 'ew-barbariccia-ex', '6.1', 'Totem of the Storm', 99),
  mount('ew-ex4-mount', 'Lynx of Divine Light', 'ew', 'Mount Ordeals (Extreme)', 'ew-rubicante-ex', '6.2', 'Totem of the Inferno', 99),
  mount('ew-ex5-mount', 'Lynx of Eternal Ice', 'ew', 'The Voidcast Dais (Extreme)', 'ew-golbez-ex', '6.3', 'Totem of the Dark', 99),
  mount('ew-ex6-mount', 'Lynx of Fallen Shadow', 'ew', 'The Abyssal Fracture (Extreme)', 'ew-anabaseios-ex', '6.4', 'Totem of the Lost', 99),
  // ── Endwalker Ultimates ───────────────────────────────────────────────────
  weapon('ew-ult1-weapons', 'Manderville Weapons', 'ew', "Dragonsong's Reprise (Ultimate)", 'ew-dsr-ult', '6.0', 'Totem of the Firmament', 7),
  weapon('ew-ult2-weapons', 'Anabaseios Weapons', 'ew', 'The Omega Protocol (Ultimate)', 'ew-top-ult', '6.2', 'Omega Totem', 7),
];
