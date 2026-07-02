/**
 * Central registry of FFXIV game icons used as UI concept icons.
 *
 * Existing sprites in public/icons/ were extracted from game textures with
 * transparent backgrounds. New icons downloaded via scripts/fetch-concept-icons.py
 * from XIVAPI. Add new entries there + re-run the script to add more.
 */

export const XIV_ICONS = {
  // ── Navigation sprites (pre-processed, transparent bg) ──────────────────
  party:        '/icons/party-transparent-bg.png',
  schedule:     '/icons/schedule-transparent-bg.png',
  loot:         '/icons/loot-transparent-bg.png',
  goals:        '/icons/mount-farms-transparent-bg.png',
  history:      '/icons/history-transparent-bg.png',
  stats:        '/icons/stats-transparent-bg.png',
  options:      '/icons/player-options-transparent-bg.png',

  // ── Loot & economy ───────────────────────────────────────────────────────
  materia:      '/icons/xiv-materia.png',       // Piety Materia VIII (gem crystal)
  tomestone:    '/icons/xiv-tomestone.png',     // Allagan Tomestone of Poetics
  gil:          '/icons/xiv-gil.png',           // Gil

  // ── Content & rewards ────────────────────────────────────────────────────
  sword:        '/icons/xiv-sword.png',         // Antiquated Deathbringer (raid weapon)
  orchestrion:  '/icons/xiv-orchestrion.png',   // Orchestrion Roll (music reward)

  // ── Magic & aether ───────────────────────────────────────────────────────
  crystal:      '/icons/xiv-crystal.png',       // Wind Crystal (aether / sparkle)
  earthlyStar:  '/icons/xiv-earthly-star.png',  // Earthly Star — AST action (star/priority)

  // ── Social ───────────────────────────────────────────────────────────────
  handshake:    '/icons/xiv-handshake.png',     // Fellowship/social bond — share/preview profile
} as const;

export type XivIconKey = keyof typeof XIV_ICONS;
