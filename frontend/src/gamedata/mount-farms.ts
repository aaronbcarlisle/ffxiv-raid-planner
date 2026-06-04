/**
 * Mount Farm Content Catalog
 *
 * Static catalog of Extreme trials grouped by expansion.
 * Each entry includes the trial, mount reward, totem currency, and totem target.
 *
 * UPDATE THIS FILE when new Extreme trials are added (typically each odd patch).
 */

export type Expansion = 'DT' | 'EW' | 'ShB' | 'SB' | 'HW' | 'ARR';

export interface MountFarmTrial {
  id: string;
  expansion: Expansion;
  patch: string;
  dutyName: string;
  mountName: string;
  /** FFXIV Mount.exd row ID — used by plugin PlayerState.IsMountUnlocked(). Approximate; verify against game data. */
  mountId: number | null;
  totemName: string | null;
  /** FFXIV Item.exd row ID for the totem item — used by plugin inventory scan. Approximate; verify against game data. */
  totemItemId: number | null;
  totemTarget: number;
  sortOrder: number;
}

export const EXPANSIONS: { id: Expansion; name: string; shortName: string }[] = [
  { id: 'DT', name: 'Dawntrail', shortName: 'DT' },
  { id: 'EW', name: 'Endwalker', shortName: 'EW' },
  { id: 'ShB', name: 'Shadowbringers', shortName: 'ShB' },
  { id: 'SB', name: 'Stormblood', shortName: 'SB' },
  { id: 'HW', name: 'Heavensward', shortName: 'HW' },
  { id: 'ARR', name: 'A Realm Reborn', shortName: 'ARR' },
];

export const MOUNT_FARM_TRIALS: MountFarmTrial[] = [
  // ==========================================
  // DAWNTRAIL (7.x)
  // ==========================================
  { id: 'dt-valigarmanda', expansion: 'DT', patch: '7.0', dutyName: 'Worqor Lar Dor (Extreme)', mountName: 'Valigarmanda', mountId: 330, totemName: 'Valigarmanda Totem', totemItemId: 44123, totemTarget: 99, sortOrder: 1 },
  { id: 'dt-zoraal-ja', expansion: 'DT', patch: '7.0', dutyName: 'Everkeep (Extreme)', mountName: 'Lynx of Imperious Wind', mountId: 331, totemName: 'Zoraal Ja Totem', totemItemId: 44124, totemTarget: 99, sortOrder: 2 },
  { id: 'dt-sphene', expansion: 'DT', patch: '7.1', dutyName: 'The Interphos (Extreme)', mountName: 'Sphene', mountId: 345, totemName: 'Sphene Totem', totemItemId: 44350, totemTarget: 99, sortOrder: 3 },
  { id: 'dt-senary', expansion: 'DT', patch: '7.2', dutyName: 'Senary Unaspected Aetherial Node (Extreme)', mountName: 'Senary Node', mountId: 350, totemName: 'Senary Totem', totemItemId: 44600, totemTarget: 99, sortOrder: 4 },
  { id: 'dt-perfected-brute-bomber', expansion: 'DT', patch: '7.3', dutyName: 'Blasting Zone (Extreme)', mountName: 'Brute Bomber', mountId: 355, totemName: 'Brute Bomber Totem', totemItemId: 44800, totemTarget: 99, sortOrder: 5 },

  // ==========================================
  // ENDWALKER (6.x)
  // ==========================================
  { id: 'ew-zodiark', expansion: 'EW', patch: '6.0', dutyName: 'The Dark Inside (Extreme)', mountName: 'Lynx of Fallen Shadow', mountId: 282, totemName: 'Zodiark Totem', totemItemId: 36810, totemTarget: 99, sortOrder: 1 },
  { id: 'ew-hydaelyn', expansion: 'EW', patch: '6.0', dutyName: 'The Mothercrystal (Extreme)', mountName: 'Lynx of Divine Light', mountId: 283, totemName: 'Hydaelyn Totem', totemItemId: 36811, totemTarget: 99, sortOrder: 2 },
  { id: 'ew-endsinger', expansion: 'EW', patch: '6.1', dutyName: 'The Final Day (Extreme)', mountName: 'Lynx of Eternal Darkness', mountId: 295, totemName: 'Endsinger Totem', totemItemId: 38263, totemTarget: 99, sortOrder: 3 },
  { id: 'ew-barbariccia', expansion: 'EW', patch: '6.2', dutyName: 'Storm\'s Crown (Extreme)', mountName: 'Lynx of Fallen Shadow', mountId: 301, totemName: 'Barbariccia Totem', totemItemId: 38949, totemTarget: 99, sortOrder: 4 },
  { id: 'ew-rubicante', expansion: 'EW', patch: '6.3', dutyName: 'Mount Ordeals (Extreme)', mountName: 'Lynx of Abyssal Grief', mountId: 308, totemName: 'Rubicante Totem', totemItemId: 39575, totemTarget: 99, sortOrder: 5 },
  { id: 'ew-golbez', expansion: 'EW', patch: '6.4', dutyName: 'The Voidcast Dais (Extreme)', mountName: 'Lynx of Righteous Fire', mountId: 314, totemName: 'Golbez Totem', totemItemId: 40201, totemTarget: 99, sortOrder: 6 },
  { id: 'ew-zeromus', expansion: 'EW', patch: '6.5', dutyName: 'The Abyssal Fracture (Extreme)', mountName: 'Lynx of Imperious Wind', mountId: 320, totemName: 'Zeromus Totem', totemItemId: 40827, totemTarget: 99, sortOrder: 7 },

  // ==========================================
  // SHADOWBRINGERS (5.x)
  // ==========================================
  { id: 'shb-titania', expansion: 'ShB', patch: '5.0', dutyName: 'The Dancing Plague (Extreme)', mountName: 'Titania', mountId: 232, totemName: 'Fae Totem', totemItemId: 28636, totemTarget: 99, sortOrder: 1 },
  { id: 'shb-innocence', expansion: 'ShB', patch: '5.0', dutyName: 'The Crown of the Immaculate (Extreme)', mountName: 'Innocence', mountId: 233, totemName: 'Immaculate Totem', totemItemId: 28637, totemTarget: 99, sortOrder: 2 },
  { id: 'shb-hades', expansion: 'ShB', patch: '5.1', dutyName: 'The Minstrel\'s Ballad: Hades\'s Elegy', mountName: 'Hades', mountId: 241, totemName: 'Hades Totem', totemItemId: 30109, totemTarget: 99, sortOrder: 3 },
  { id: 'shb-warrior-of-light', expansion: 'ShB', patch: '5.3', dutyName: 'The Seat of Sacrifice (Extreme)', mountName: 'Warrior of Light', mountId: 253, totemName: 'Warrior of Light Totem', totemItemId: 31357, totemTarget: 99, sortOrder: 4 },
  { id: 'shb-emerald', expansion: 'ShB', patch: '5.4', dutyName: 'Castrum Marinum (Extreme)', mountName: 'Emerald Gwiber', mountId: 261, totemName: 'Emerald Totem', totemItemId: 32799, totemTarget: 99, sortOrder: 5 },
  { id: 'shb-diamond', expansion: 'ShB', patch: '5.5', dutyName: 'The Cloud Deck (Extreme)', mountName: 'Diamond Gwiber', mountId: 270, totemName: 'Diamond Totem', totemItemId: 33691, totemTarget: 99, sortOrder: 6 },

  // ==========================================
  // STORMBLOOD (4.x)
  // ==========================================
  { id: 'sb-susano', expansion: 'SB', patch: '4.0', dutyName: 'The Pool of Tribute (Extreme)', mountName: 'Reveling Kamuy', mountId: 169, totemName: 'Susano Totem', totemItemId: 21197, totemTarget: 99, sortOrder: 1 },
  { id: 'sb-lakshmi', expansion: 'SB', patch: '4.0', dutyName: 'Emanation (Extreme)', mountName: 'Blissful Kamuy', mountId: 170, totemName: 'Lakshmi Totem', totemItemId: 21198, totemTarget: 99, sortOrder: 2 },
  { id: 'sb-shinryu', expansion: 'SB', patch: '4.1', dutyName: 'The Minstrel\'s Ballad: Shinryu\'s Domain', mountName: 'Shinryu', mountId: 179, totemName: 'Shinryu Totem', totemItemId: 22027, totemTarget: 99, sortOrder: 3 },
  { id: 'sb-byakko', expansion: 'SB', patch: '4.2', dutyName: 'The Jade Stoa (Extreme)', mountName: 'Auspicious Kamuy', mountId: 183, totemName: 'Byakko Totem', totemItemId: 22637, totemTarget: 99, sortOrder: 4 },
  { id: 'sb-tsukuyomi', expansion: 'SB', patch: '4.3', dutyName: 'The Minstrel\'s Ballad: Tsukuyomi\'s Pain', mountName: 'Lunar Kamuy', mountId: 191, totemName: 'Tsukuyomi Totem', totemItemId: 23270, totemTarget: 99, sortOrder: 5 },
  { id: 'sb-suzaku', expansion: 'SB', patch: '4.4', dutyName: 'Hells\' Kier (Extreme)', mountName: 'Euphonious Kamuy', mountId: 196, totemName: 'Suzaku Totem', totemItemId: 24244, totemTarget: 99, sortOrder: 6 },
  { id: 'sb-seiryu', expansion: 'SB', patch: '4.5', dutyName: 'The Wreath of Snakes (Extreme)', mountName: 'Legendary Kamuy', mountId: 200, totemName: 'Seiryu Totem', totemItemId: 24631, totemTarget: 99, sortOrder: 7 },

  // ==========================================
  // HEAVENSWARD (3.x)
  // ==========================================
  { id: 'hw-bismarck', expansion: 'HW', patch: '3.0', dutyName: 'The Limitless Blue (Extreme)', mountName: 'White Lanner', mountId: 70, totemName: 'Bismarck Totem', totemItemId: 13619, totemTarget: 99, sortOrder: 1 },
  { id: 'hw-ravana', expansion: 'HW', patch: '3.0', dutyName: 'Thok ast Thok (Extreme)', mountName: 'Rose Lanner', mountId: 71, totemName: 'Ravana Totem', totemItemId: 13620, totemTarget: 99, sortOrder: 2 },
  { id: 'hw-thordan', expansion: 'HW', patch: '3.1', dutyName: 'The Minstrel\'s Ballad: Thordan\'s Reign', mountName: 'Round Lanner', mountId: 80, totemName: 'Thordan Totem', totemItemId: 14298, totemTarget: 99, sortOrder: 3 },
  { id: 'hw-sephirot', expansion: 'HW', patch: '3.2', dutyName: 'Containment Bay S1T7 (Extreme)', mountName: 'Warring Lanner', mountId: 90, totemName: 'Sephirot Totem', totemItemId: 15431, totemTarget: 99, sortOrder: 4 },
  { id: 'hw-nidhogg', expansion: 'HW', patch: '3.3', dutyName: 'The Minstrel\'s Ballad: Nidhogg\'s Rage', mountName: 'Dark Lanner', mountId: 98, totemName: 'Nidhogg Totem', totemItemId: 16133, totemTarget: 99, sortOrder: 5 },
  { id: 'hw-sophia', expansion: 'HW', patch: '3.4', dutyName: 'Containment Bay P1T6 (Extreme)', mountName: 'Sophia Lanner', mountId: 105, totemName: 'Sophia Totem', totemItemId: 16825, totemTarget: 99, sortOrder: 6 },
  { id: 'hw-zurvan', expansion: 'HW', patch: '3.5', dutyName: 'Containment Bay Z1T9 (Extreme)', mountName: 'Demonic Lanner', mountId: 112, totemName: 'Zurvan Totem', totemItemId: 17461, totemTarget: 99, sortOrder: 7 },

  // ==========================================
  // A REALM REBORN (2.x)
  // ==========================================
  { id: 'arr-garuda', expansion: 'ARR', patch: '2.0', dutyName: 'The Howling Eye (Extreme)', mountName: 'Xanthos', mountId: 18, totemName: 'Garuda Totem', totemItemId: 7812, totemTarget: 99, sortOrder: 1 },
  { id: 'arr-titan', expansion: 'ARR', patch: '2.0', dutyName: 'The Navel (Extreme)', mountName: 'Gullfaxi', mountId: 19, totemName: 'Titan Totem', totemItemId: 7813, totemTarget: 99, sortOrder: 2 },
  { id: 'arr-ifrit', expansion: 'ARR', patch: '2.0', dutyName: 'The Bowl of Embers (Extreme)', mountName: 'Aithon', mountId: 17, totemName: 'Ifrit Totem', totemItemId: 7811, totemTarget: 99, sortOrder: 3 },
  { id: 'arr-leviathan', expansion: 'ARR', patch: '2.2', dutyName: 'The Whorleater (Extreme)', mountName: 'Enbarr', mountId: 33, totemName: 'Leviathan Totem', totemItemId: 8543, totemTarget: 99, sortOrder: 4 },
  { id: 'arr-ramuh', expansion: 'ARR', patch: '2.3', dutyName: 'The Striking Tree (Extreme)', mountName: 'Markab', mountId: 38, totemName: 'Ramuh Totem', totemItemId: 9383, totemTarget: 99, sortOrder: 5 },
  { id: 'arr-shiva', expansion: 'ARR', patch: '2.4', dutyName: 'Akh Afah Amphitheatre (Extreme)', mountName: 'Boreas', mountId: 46, totemName: 'Shiva Totem', totemItemId: 10125, totemTarget: 99, sortOrder: 6 },
];

export function getTrialsByExpansion(expansion: Expansion): MountFarmTrial[] {
  return MOUNT_FARM_TRIALS
    .filter(t => t.expansion === expansion)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getTrialById(id: string): MountFarmTrial | undefined {
  return MOUNT_FARM_TRIALS.find(t => t.id === id);
}

export function getAllTrialIds(): string[] {
  return MOUNT_FARM_TRIALS.map(t => t.id);
}
