/**
 * Static fallback catalog — mirrors catalog_data.py.
 * Shown when the API catalog is unavailable. Track buttons are disabled in fallback mode.
 * sourceDutyKey MUST match the trial_id in MOUNT_FARM_CATALOG for Player Hub sync.
 */
import type { CatalogItem } from '../stores/collectionGoalStore';

type Exp = 'dt' | 'ew' | 'shb' | 'sb' | 'hw' | 'arr';

function mount(
  id: string,
  name: string,
  expansion: Exp,
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
    tokenItemId: null,
    gameMountId: null,
  };
}

function orchestrion(
  id: string,
  name: string,
  expansion: Exp,
  sourceDutyName: string,
  sourceDutyKey: string,
  patch: string,
  notes?: string,
): CatalogItem {
  return {
    id: `fallback-${id}`,
    externalSource: 'internal',
    externalId: id,
    name,
    category: 'orchestrion',
    expansion,
    patch,
    iconUrl: null,
    imageUrl: null,
    sourceText: `Rare drop — ${sourceDutyName}`,
    sourceType: 'extreme',
    sourceDutyName,
    sourceDutyKey,
    tokenName: null,
    tokenCost: null,
    tradeable: false,
    rarityOwnedPercent: null,
    isCurated: true,
    notes: notes ?? null,
    tokenItemId: null,
    gameMountId: null,
  };
}

function weapon(
  id: string,
  name: string,
  expansion: Exp,
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
    tokenItemId: null,
    gameMountId: null,
  };
}

export const FALLBACK_CATALOG: CatalogItem[] = [
  // ── Dawntrail Extreme Mounts ──────────────────────────────────────────────
  mount('dt-ex2-mount', 'Wings of Ruin', 'dt', 'Worqor Lar Dor (Extreme)', 'dt-valigarmanda', '7.0', 'Skyruin Totem', 99),
  mount('dt-ex3-mount', 'Wings of Resolve', 'dt', 'Everkeep (Extreme)', 'dt-zoraal-ja', '7.0', 'Resilient Totem', 99),
  mount('dt-ex4-mount', 'Wings of Eternity', 'dt', "The Minstrel's Ballad: Sphene's Burden", 'dt-sphene', '7.1', 'Totem Eternal', 99),
  mount('dt-ex5-mount', 'Wings of the Knighthood', 'dt', 'Recollection (Extreme)', 'dt-recollection', '7.2', 'Knight Totem', 99),
  mount('dt-ex6-mount', 'Wings of Death', 'dt', "The Minstrel's Ballad: Necron's Embrace", 'dt-necron-embrace', '7.2', 'Grave Totem', 99),
  mount('dt-ex7-mount', 'Felyne Support Team Cart Horn', 'dt', 'The Windward Wilds (Extreme)', 'dt-windward-wilds', '7.2', 'Guardian Arkveld Certificate', 99),
  mount('dt-ex8-mount', 'Wings of Mist', 'dt', 'Hell on Rails (Extreme)', 'dt-hell-on-rails', '7.25', null, null, 'Totem exchange not yet available'),
  mount('dt-ex9-mount', 'Wings of Nihility', 'dt', 'The Unmaking (Extreme)', 'dt-unmaking', '7.25', null, null, 'Totem exchange not yet available'),
  // ── Dawntrail Ultimates ───────────────────────────────────────────────────
  weapon('dt-ult1-weapons', 'Ultimate Edenmorn Weapons', 'dt', 'Futures Rewritten (Ultimate)', 'ult-fru', '7.0', 'Oracle Totem', 1),
  weapon('dt-ult2-weapons', 'Palazzo Diamond Weapons', 'dt', 'Dancing Mad (Ultimate)', 'ult-dmu', '7.2', "Mad Harlequin's Totem", 1),
  // ── Endwalker Extreme Mounts ──────────────────────────────────────────────
  mount('ew-ex1-mount', 'Lynx of Fallen Shadow', 'ew', 'The Dark Inside (Extreme)', 'ew-zodiark', '6.0', 'Zodiark Totem', 99),
  mount('ew-ex2-mount', 'Lynx of Divine Light', 'ew', 'The Mothercrystal (Extreme)', 'ew-hydaelyn', '6.0', 'Hydaelyn Totem', 99),
  mount('ew-ex3-mount', 'Lynx of Eternal Darkness', 'ew', 'The Final Day (Extreme)', 'ew-endsinger', '6.1', 'Endsinger Totem', 99),
  mount('ew-ex4-mount', 'Lynx of Imperial Sorrow', 'ew', "Storm's Crown (Extreme)", 'ew-barbariccia', '6.2', 'Barbariccia Totem', 99),
  mount('ew-ex5-mount', 'Lynx of Abyssal Grief', 'ew', 'Mount Ordeals (Extreme)', 'ew-rubicante', '6.3', 'Rubicante Totem', 99),
  mount('ew-ex6-mount', 'Lynx of Righteous Fire', 'ew', 'The Voidcast Dais (Extreme)', 'ew-golbez', '6.4', 'Golbez Totem', 99),
  mount('ew-ex7-mount', 'Lynx of Imperious Wind', 'ew', 'The Abyssal Fracture (Extreme)', 'ew-zeromus', '6.5', 'Zeromus Totem', 99),
  // ── Endwalker Ultimates ───────────────────────────────────────────────────
  weapon('ew-ult1-weapons', 'Ultimate Weapons of the Heavens', 'ew', "Dragonsong's Reprise (Ultimate)", 'ult-dsr', '6.11', 'Dragonsong Totem', 1),
  weapon('ew-ult2-weapons', 'Ultimate Omega Weapons', 'ew', 'The Omega Protocol (Ultimate)', 'ult-top', '6.31', 'Omega Totem', 1),
  // ── Dawntrail Extreme Orchestrion ────────────────────────────────────────────
  orchestrion('dt-valigarmanda-orch', 'The Skyruin', 'dt', 'Worqor Lar Dor (Extreme)', 'dt-valigarmanda', '7.0'),
  orchestrion('dt-zoraal-ja-orch', 'Seeking Purpose', 'dt', 'Everkeep (Extreme)', 'dt-zoraal-ja', '7.0'),
  orchestrion('dt-sphene-orch', 'Paved in Solitude', 'dt', "The Minstrel's Ballad: Sphene's Burden", 'dt-sphene', '7.1'),
  orchestrion('dt-recollection-orch', 'Roses of May (Dawntrail)', 'dt', 'Recollection (Extreme)', 'dt-recollection', '7.2'),
  orchestrion('dt-necron-orch', 'FINAL FANTASY IX: The Final Battle (Dawntrail)', 'dt', "The Minstrel's Ballad: Necron's Embrace", 'dt-necron-embrace', '7.2', 'Direct drop — no faded copy craft required'),
  orchestrion('dt-hell-on-rails-orch', 'FINAL FANTASY IX: Battle 2 (Dawntrail)', 'dt', 'Hell on Rails (Extreme)', 'dt-hell-on-rails', '7.25'),
  orchestrion('dt-unmaking-orch', 'FINAL FANTASY V: The Final Battle (Dawntrail)', 'dt', 'The Unmaking (Extreme)', 'dt-unmaking', '7.25'),
  // ── Endwalker Extreme Orchestrion ────────────────────────────────────────────
  orchestrion('ew-zodiark-orch', 'Endcaller', 'ew', 'The Dark Inside (Extreme)', 'ew-zodiark', '6.0'),
  orchestrion('ew-hydaelyn-orch', 'Your Answer', 'ew', 'The Mothercrystal (Extreme)', 'ew-hydaelyn', '6.0'),
  orchestrion('ew-endsinger-orch', 'The Final Day', 'ew', 'The Final Day (Extreme)', 'ew-endsinger', '6.1'),
  orchestrion('ew-barbariccia-orch', 'Battle with the Four Fiends (Buried Memory)', 'ew', "Storm's Crown (Extreme)", 'ew-barbariccia', '6.2'),
  orchestrion('ew-rubicante-orch', 'Forged in Crimson', 'ew', 'Mount Ordeals (Extreme)', 'ew-rubicante', '6.3'),
  orchestrion('ew-golbez-orch', 'Voidcast Savior', 'ew', 'The Voidcast Dais (Extreme)', 'ew-golbez', '6.4'),
  orchestrion('ew-zeromus-orch', 'FINAL FANTASY IV: The Final Battle (Endwalker)', 'ew', 'The Abyssal Fracture (Extreme)', 'ew-zeromus', '6.5'),
  // ── Shadowbringers Extreme Orchestrion ───────────────────────────────────────
  orchestrion('shb-titania-orch', 'What Angel Wakes Me', 'shb', 'The Dancing Plague (Extreme)', 'shb-titania', '5.0'),
  orchestrion('shb-innocence-orch', 'Insanity', 'shb', 'The Crown of the Immaculate (Extreme)', 'shb-innocence', '5.0'),
  orchestrion('shb-hades-orch-1', 'Shadowbringers', 'shb', "The Minstrel's Ballad: Hades's Elegy", 'shb-hades', '5.1'),
  orchestrion('shb-hades-orch-2', 'Invincible', 'shb', "The Minstrel's Ballad: Hades's Elegy", 'shb-hades', '5.1'),
  orchestrion('shb-wol-orch', 'To the Edge', 'shb', 'The Seat of Sacrifice (Extreme)', 'shb-warrior-of-light', '5.3'),
  orchestrion('shb-emerald-orch', 'The Black Wolf Stalks Again', 'shb', 'Castrum Marinum (Extreme)', 'shb-emerald', '5.4'),
  orchestrion('shb-diamond-orch', 'In the Arms of War', 'shb', 'The Cloud Deck (Extreme)', 'shb-diamond', '5.5'),
  // ── Stormblood Extreme Orchestrion ───────────────────────────────────────────
  orchestrion('sb-susano-orch', 'Revelation', 'sb', 'The Pool of Tribute (Extreme)', 'sb-susano', '4.0'),
  orchestrion('sb-lakshmi-orch', "Beauty's Wicked Wiles", 'sb', 'Emanation (Extreme)', 'sb-lakshmi', '4.0'),
  orchestrion('sb-shinryu-orch-1', "The Worm's Head", 'sb', "The Minstrel's Ballad: Shinryu's Domain", 'sb-shinryu', '4.1'),
  orchestrion('sb-shinryu-orch-2', "The Worm's Tail", 'sb', "The Minstrel's Ballad: Shinryu's Domain", 'sb-shinryu', '4.1'),
  orchestrion('sb-byakko-orch', 'The Jade Stoa', 'sb', 'The Jade Stoa (Extreme)', 'sb-byakko', '4.2'),
  orchestrion('sb-tsukuyomi-orch', 'Under the Moonlight', 'sb', "The Minstrel's Ballad: Tsukuyomi's Pain", 'sb-tsukuyomi', '4.3'),
  orchestrion('sb-suzaku-orch', 'Sunrise', 'sb', "Hells' Kier (Extreme)", 'sb-suzaku', '4.4'),
  orchestrion('sb-seiryu-orch', "From the Dragon's Wake", 'sb', 'The Wreath of Snakes (Extreme)', 'sb-seiryu', '4.5'),
  // ── Heavensward Extreme Orchestrion ──────────────────────────────────────────
  orchestrion('hw-bismarck-orch-1', 'Limitless Blue', 'hw', 'The Limitless Blue (Extreme)', 'hw-bismarck', '3.0'),
  orchestrion('hw-bismarck-orch-2', 'Woe That Is Madness', 'hw', 'The Limitless Blue (Extreme)', 'hw-bismarck', '3.0'),
  orchestrion('hw-ravana-orch-1', 'The Hand That Gives the Rose', 'hw', 'Thok ast Thok (Extreme)', 'hw-ravana', '3.0'),
  orchestrion('hw-ravana-orch-2', 'Unbending Steel', 'hw', 'Thok ast Thok (Extreme)', 'hw-ravana', '3.0'),
  orchestrion('hw-thordan-orch', 'Heroes', 'hw', "The Minstrel's Ballad: Thordan's Reign", 'hw-thordan', '3.1'),
  orchestrion('hw-sephirot-orch', 'Fiend', 'hw', 'Containment Bay S1T7 (Extreme)', 'hw-sephirot', '3.2'),
  orchestrion('hw-nidhogg-orch', 'Revenge of the Horde', 'hw', "The Minstrel's Ballad: Nidhogg's Rage", 'hw-nidhogg', '3.3'),
  orchestrion('hw-sophia-orch', 'Equilibrium', 'hw', 'Containment Bay P1T6 (Extreme)', 'hw-sophia', '3.4'),
  orchestrion('hw-zurvan-orch', 'Infinity', 'hw', 'Containment Bay Z1T9 (Extreme)', 'hw-zurvan', '3.5'),
  // ── Shadowbringers Extreme Mounts ─────────────────────────────────────────
  mount('shb-titania-mount', 'Titania', 'shb', 'The Dancing Plague (Extreme)', 'shb-titania', '5.0', 'Fae Totem', 99),
  mount('shb-innocence-mount', 'Innocence', 'shb', 'The Crown of the Immaculate (Extreme)', 'shb-innocence', '5.0', 'Immaculate Totem', 99),
  mount('shb-hades-mount', 'Hades', 'shb', "The Minstrel's Ballad: Hades's Elegy", 'shb-hades', '5.1', 'Hades Totem', 99),
  mount('shb-wol-mount', 'Warrior of Light', 'shb', 'The Seat of Sacrifice (Extreme)', 'shb-warrior-of-light', '5.3', 'Warrior of Light Totem', 99),
  mount('shb-emerald-mount', 'Emerald Gwiber', 'shb', 'Castrum Marinum (Extreme)', 'shb-emerald', '5.4', 'Emerald Totem', 99),
  mount('shb-diamond-mount', 'Diamond Gwiber', 'shb', 'The Cloud Deck (Extreme)', 'shb-diamond', '5.5', 'Diamond Totem', 99),
  // ── Shadowbringers Ultimate ───────────────────────────────────────────────
  weapon('shb-ult-tea', 'Ultimate Alexander Weapons', 'shb', 'The Epic of Alexander (Ultimate)', 'ult-tea', '5.11', 'Colossus Totem', 1),
  // ── Stormblood Extreme Mounts ─────────────────────────────────────────────
  mount('sb-susano-mount', 'Reveling Kamuy', 'sb', 'The Pool of Tribute (Extreme)', 'sb-susano', '4.0', 'Susano Totem', 99),
  mount('sb-lakshmi-mount', 'Blissful Kamuy', 'sb', 'Emanation (Extreme)', 'sb-lakshmi', '4.0', 'Lakshmi Totem', 99),
  mount('sb-shinryu-mount', 'Shinryu', 'sb', "The Minstrel's Ballad: Shinryu's Domain", 'sb-shinryu', '4.1', 'Shinryu Totem', 99),
  mount('sb-byakko-mount', 'Auspicious Kamuy', 'sb', 'The Jade Stoa (Extreme)', 'sb-byakko', '4.2', 'Byakko Totem', 99),
  mount('sb-tsukuyomi-mount', 'Lunar Kamuy', 'sb', "The Minstrel's Ballad: Tsukuyomi's Pain", 'sb-tsukuyomi', '4.3', 'Tsukuyomi Totem', 99),
  mount('sb-suzaku-mount', 'Euphonious Kamuy', 'sb', "Hells' Kier (Extreme)", 'sb-suzaku', '4.4', 'Suzaku Totem', 99),
  mount('sb-seiryu-mount', 'Legendary Kamuy', 'sb', 'The Wreath of Snakes (Extreme)', 'sb-seiryu', '4.5', 'Seiryu Totem', 99),
  // ── Stormblood Ultimates ──────────────────────────────────────────────────
  weapon('sb-ult-ucob', 'Ultimate Dreadwyrm Weapons', 'sb', 'The Unending Coil of Bahamut (Ultimate)', 'ult-ucob', '4.11', 'Dreadwyrm Totem', 1),
  weapon('sb-ult-uwu', 'Ultima Weapons', 'sb', "The Weapon's Refrain (Ultimate)", 'ult-uwu', '4.31', 'Ultima Totem', 1),
  // ── Heavensward Extreme Mounts ────────────────────────────────────────────
  mount('hw-bismarck-mount', 'White Lanner', 'hw', 'The Limitless Blue (Extreme)', 'hw-bismarck', '3.0', 'Bismarck Totem', 99),
  mount('hw-ravana-mount', 'Rose Lanner', 'hw', 'Thok ast Thok (Extreme)', 'hw-ravana', '3.0', 'Ravana Totem', 99),
  mount('hw-thordan-mount', 'Round Lanner', 'hw', "The Minstrel's Ballad: Thordan's Reign", 'hw-thordan', '3.1', 'Thordan Totem', 99),
  mount('hw-sephirot-mount', 'Warring Lanner', 'hw', 'Containment Bay S1T7 (Extreme)', 'hw-sephirot', '3.2', 'Sephirot Totem', 99),
  mount('hw-nidhogg-mount', 'Dark Lanner', 'hw', "The Minstrel's Ballad: Nidhogg's Rage", 'hw-nidhogg', '3.3', 'Nidhogg Totem', 99),
  mount('hw-sophia-mount', 'Sophia Lanner', 'hw', 'Containment Bay P1T6 (Extreme)', 'hw-sophia', '3.4', 'Sophia Totem', 99),
  mount('hw-zurvan-mount', 'Demonic Lanner', 'hw', 'Containment Bay Z1T9 (Extreme)', 'hw-zurvan', '3.5', 'Zurvan Totem', 99),
  // ── A Realm Reborn Extreme Mounts ─────────────────────────────────────────
  mount('arr-garuda-mount', 'Xanthos', 'arr', 'The Howling Eye (Extreme)', 'arr-garuda', '2.0', 'Garuda Totem', 99),
  mount('arr-titan-mount', 'Gullfaxi', 'arr', 'The Navel (Extreme)', 'arr-titan', '2.0', 'Titan Totem', 99),
  mount('arr-ifrit-mount', 'Aithon', 'arr', 'The Bowl of Embers (Extreme)', 'arr-ifrit', '2.0', 'Ifrit Totem', 99),
  mount('arr-leviathan-mount', 'Enbarr', 'arr', 'The Whorleater (Extreme)', 'arr-leviathan', '2.2', 'Leviathan Totem', 99),
  mount('arr-ramuh-mount', 'Markab', 'arr', 'The Striking Tree (Extreme)', 'arr-ramuh', '2.3', 'Ramuh Totem', 99),
  mount('arr-shiva-mount', 'Boreas', 'arr', 'Akh Afah Amphitheatre (Extreme)', 'arr-shiva', '2.4', 'Shiva Totem', 99),
];
