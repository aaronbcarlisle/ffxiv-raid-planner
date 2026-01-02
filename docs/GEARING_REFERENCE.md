# FFXIV Gearing Reference

Game-specific data for the current raid tier. Update when new patches release.

## Current Tier: AAC Heavyweight (Savage) - Patch 7.4

- **Floors:** M9S, M10S, M11S, M12S
- **Savage gear:** iLvl 790 (weapon 795)
- **Tome gear:** iLvl 780 (augmented 790)

## Floor Drops

| Floor | Gear | Materials | Special |
|-------|------|-----------|---------|
| M9S | Accessories | Glaze | - |
| M10S | Head, Hands, Feet | Glaze | Universal Tomestone |
| M11S | Body, Legs | Twine, Solvent | - |
| M12S | Weapon | - | - |

## Tome Costs

| Slot | Cost | Weeks |
|------|------|-------|
| Weapon | 500 | 2 (+Univ) |
| Body/Legs | 825 | 2 |
| Head/Hands/Feet | 495 | 1-2 |
| Accessories | 375 | 1 |

## Priority Orders

**Display Order:** Tank > Healer > Melee > Ranged > Caster

**Loot Priority:** Melee > Ranged > Caster > Tank > Healer

See `utils/priority.ts` and `utils/weaponPriority.ts` for scoring algorithms.

## Ring Handling

FFXIV restricts two identical raid rings. One ring typically tome (ring2 default), one raid.

## BiS Sources

- **XIVGear:** `xivgear.app` - Primary BiS planning tool
- **Etro:** `etro.gg` - Alternative BiS planning
- **The Balance:** Discord community BiS recommendations
- **Static BiS Sets:** GitHub repo with community-maintained presets
