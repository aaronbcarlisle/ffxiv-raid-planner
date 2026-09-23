# Icons and Assets

> Part of the [UI component inventory](../UI_COMPONENTS.md) — moved here verbatim on 2026-09-23 so the entry doc stays small. Quick Reference, decision tree, tokens and the compliance checker live there.


### Gear Slot Icons

**Path:** `types/index.ts` (GEAR_SLOT_ICONS constant)

**Purpose:** Generic gear slot icons for UI elements.

**Usage:**
```tsx
import { GEAR_SLOT_ICONS, GearSlot } from '../types';

<img
  src={GEAR_SLOT_ICONS[slot as GearSlot]}
  alt=""
  className="w-4 h-4 brightness-[3.0]"
/>
```

**Available Slots:** weapon, head, body, hands, legs, feet, earring, necklace, bracelet, ring1, ring2

**Icon Variants:** Located in `public/images/gear-slots/{variant}/`
- `white` (active) - Used with `brightness-[3.0]` filter
- `gray`, `black`, `teal`, `gold`, `gold-vibrant`, `gold-rich`, `gold-bright`, `amber`, `yellow`

**Regenerate:** `cd frontend && python scripts/colorize-gear-icons.py`

---

### Material Icons

**Path:** `public/images/materials/{variant}/`

**Purpose:** Upgrade material icons (twine, glaze, solvent, tomestone).

**Variants:**
- `original/` - Full-color XIVAPI originals (for Photoshop editing)
- `white/`, `white-flat/`, `gray/`, `black/`, `teal/`, `gold-vibrant/` - Processed silhouettes

**Files:** twine.png, glaze.png, solvent.png, tomestone.png

**Regenerate:** `cd frontend && python scripts/process-material-icons.py`

---

### Icon Gallery (Developer Tool)

**URL:** `http://localhost:5174/icon-gallery.html`

**Purpose:** Visual reference for all custom icons in the application.

**Contents:**
- All gear slot icon variants with color comparison
- Upgrade material icons (original and silhouettes)
- Job icons by role (from XIVAPI)
- Visual comparison section
- XIVAPI URLs and regeneration commands

**When to use:** Choosing icon variants, verifying icon appearance, referencing XIVAPI URLs.
