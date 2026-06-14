/**
 * FFXIV Data Center and World (Server) Data
 *
 * Static data for discovery settings and filters.
 * Source: FFXIV official world list as of Dawntrail (7.x).
 */

export interface DataCenter {
  name: string;
  region: string;
  worlds: string[];
}

export const DATA_CENTERS: DataCenter[] = [
  // Japan
  { name: 'Elemental', region: 'Japan', worlds: ['Aegis', 'Atomos', 'Carbuncle', 'Garuda', 'Gungnir', 'Kujata', 'Tonberry', 'Typhon'] },
  { name: 'Gaia', region: 'Japan', worlds: ['Alexander', 'Bahamut', 'Durandal', 'Fenrir', 'Ifrit', 'Ridill', 'Tiamat', 'Ultima'] },
  { name: 'Mana', region: 'Japan', worlds: ['Anima', 'Asura', 'Chocobo', 'Hades', 'Ixion', 'Masamune', 'Pandaemonium', 'Titan'] },
  { name: 'Meteor', region: 'Japan', worlds: ['Belias', 'Mandragora', 'Ramuh', 'Shinryu', 'Unicorn', 'Valefor', 'Yojimbo', 'Zeromus'] },
  // North America
  { name: 'Aether', region: 'North America', worlds: ['Adamantoise', 'Cactuar', 'Faerie', 'Gilgamesh', 'Jenova', 'Midgardsormr', 'Sargatanas', 'Siren'] },
  { name: 'Primal', region: 'North America', worlds: ['Behemoth', 'Excalibur', 'Exodus', 'Famfrit', 'Hyperion', 'Lamia', 'Leviathan', 'Ultros'] },
  { name: 'Crystal', region: 'North America', worlds: ['Balmung', 'Brynhildr', 'Coeurl', 'Diabolos', 'Goblin', 'Malboro', 'Mateus', 'Zalera'] },
  { name: 'Dynamis', region: 'North America', worlds: ['Cuchulainn', 'Golem', 'Halicarnassus', 'Kraken', 'Maduin', 'Marilith', 'Rafflesia', 'Seraph'] },
  // Europe
  { name: 'Chaos', region: 'Europe', worlds: ['Cerberus', 'Louisoix', 'Moogle', 'Omega', 'Phantom', 'Ragnarok', 'Sagittarius', 'Spriggan'] },
  { name: 'Light', region: 'Europe', worlds: ['Alpha', 'Lich', 'Odin', 'Phoenix', 'Raiden', 'Shiva', 'Twintania', 'Zodiark'] },
  // Oceania
  { name: 'Materia', region: 'Oceania', worlds: ['Bismarck', 'Ravana', 'Sephirot', 'Sophia', 'Zurvan'] },
];

/** Flat list of all DC names */
export const DC_NAMES = DATA_CENTERS.map(dc => dc.name);

/** Get worlds for a specific data center */
export function getWorldsForDC(dcName: string): string[] {
  const dc = DATA_CENTERS.find(d => d.name === dcName);
  return dc?.worlds ?? [];
}

/** Reverse lookup: find the data center for a given world/server name */
export function getDCForWorld(worldName: string): string | null {
  const lower = worldName.toLowerCase();
  for (const dc of DATA_CENTERS) {
    if (dc.worlds.some(w => w.toLowerCase() === lower)) {
      return dc.name;
    }
  }
  return null;
}

/** Common timezones for FFXIV players */
export const TIMEZONES = [
  { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
  { value: 'Asia/Seoul', label: 'KST (Seoul)' },
  { value: 'Asia/Shanghai', label: 'CST (Shanghai)' },
  { value: 'Asia/Bangkok', label: 'ICT (Bangkok)' },
  { value: 'Australia/Sydney', label: 'AEST (Sydney)' },
  { value: 'Australia/Perth', label: 'AWST (Perth)' },
  { value: 'Europe/London', label: 'GMT/BST (London)' },
  { value: 'Europe/Paris', label: 'CET/CEST (Paris)' },
  { value: 'Europe/Berlin', label: 'CET/CEST (Berlin)' },
  { value: 'America/New_York', label: 'EST/EDT (New York)' },
  { value: 'America/Chicago', label: 'CST/CDT (Chicago)' },
  { value: 'America/Denver', label: 'MST/MDT (Denver)' },
  { value: 'America/Los_Angeles', label: 'PST/PDT (Los Angeles)' },
  { value: 'Pacific/Auckland', label: 'NZST (Auckland)' },
  { value: 'UTC', label: 'UTC' },
];

/** Languages for FFXIV communities — codes stored as-is; custom entries use the full name as code */
export const LANGUAGES = [
  { code: 'en',  label: 'English' },
  { code: 'ja',  label: 'Japanese' },
  { code: 'th',  label: 'Thai' },
  { code: 'de',  label: 'German' },
  { code: 'fr',  label: 'French' },
  { code: 'ko',  label: 'Korean' },
  { code: 'zh',  label: 'Chinese' },
  { code: 'es',  label: 'Spanish' },
  { code: 'pt',  label: 'Portuguese' },
  { code: 'id',  label: 'Indonesian' },
  { code: 'fil', label: 'Filipino / Tagalog' },
  { code: 'vi',  label: 'Vietnamese' },
  { code: 'ms',  label: 'Malay' },
  { code: 'it',  label: 'Italian' },
  { code: 'ru',  label: 'Russian' },
];

/** Raid days */
export const RAID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** iCal BYDAY keys to human-readable day names */
export const ICAL_DAY_MAP: Record<string, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
};

/** Time slot options for schedule (30-min increments) */
export const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of ['00', '30']) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${m}`);
  }
}
