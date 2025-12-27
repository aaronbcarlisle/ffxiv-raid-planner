# FFXIV Raid Planner - Unified Audit Plan

**Date:** December 27, 2025
**Status:** Phase 4 Complete - Ready for optimization
**Sources:** Consolidated from two separate audit documents + UI mockups

---

## Executive Summary

This unified plan combines findings from two independent audits and two interactive mockups. Both audits identified the same core issues and proposed similar solutions, with minor variations in implementation details.

### Priority Matrix

| Category | Priority | Description |
|----------|----------|-------------|
| Legacy Code Removal | HIGH | Remove Phase 1-3 backend models/routers |
| Code Deduplication | HIGH | Extract shared `authRequest` + backend constants |
| Header Simplification | HIGH | Single-row header with settings popover |
| Color Palette Update | MEDIUM | Darker "Obsidian & Amber" theme |
| Component Organization | MEDIUM | Add index exports, split large components |
| Performance | LOW | Add useMemo/useCallback optimizations |

---

## Part 1: Backend Cleanup

### 1.1 Legacy Code Removal

**Files to DELETE:**
```
backend/app/models/static.py        # Replaced by StaticGroup
backend/app/models/player.py        # Replaced by SnapshotPlayer
backend/app/routers/statics.py      # Replaced by static_groups.py
backend/app/routers/players.py      # Replaced by tiers.py
backend/app/schemas/static.py       # Legacy schemas
```

**Files to MODIFY (keep only shared types):**
- `backend/app/schemas/player.py` - Keep `GearSlotStatus`, `TomeWeaponStatus`

**Verification before deletion:**
```bash
# Ensure no frontend code uses legacy endpoints
grep -r "/api/statics" frontend/src --include="*.ts" --include="*.tsx"
```

### 1.2 Create Shared Constants Module

**Create:** `backend/app/constants.py`

```python
"""Shared constants and factory functions for player/gear creation."""

from typing import Any

DEFAULT_GEAR_SLOTS = [
    "weapon", "head", "body", "hands", "legs", "feet",
    "earring", "necklace", "bracelet", "ring1", "ring2",
]

OPTIMAL_PARTY_COMP = [
    {"template_role": "tank", "position": "T1", "tank_role": "MT"},
    {"template_role": "tank", "position": "T2", "tank_role": "OT"},
    {"template_role": "pure-healer", "position": "H1", "tank_role": None},
    {"template_role": "barrier-healer", "position": "H2", "tank_role": None},
    {"template_role": "melee", "position": "M1", "tank_role": None},
    {"template_role": "melee", "position": "M2", "tank_role": None},
    {"template_role": "physical-ranged", "position": "R1", "tank_role": None},
    {"template_role": "magical-ranged", "position": "R2", "tank_role": None},
]


def create_default_gear() -> list[dict[str, Any]]:
    """Create default gear configuration for a new player."""
    return [
        {"slot": slot, "bisSource": "raid", "hasItem": False, "isAugmented": False}
        for slot in DEFAULT_GEAR_SLOTS
    ]


def create_default_gear_ring2_tome() -> list[dict[str, Any]]:
    """Create default gear with ring2 as tome source (ring restriction)."""
    gear = create_default_gear()
    for slot in gear:
        if slot["slot"] == "ring2":
            slot["bisSource"] = "tome"
    return gear


def create_default_tome_weapon() -> dict[str, Any]:
    """Create default tome weapon status."""
    return {"pursuing": False, "hasItem": False, "isAugmented": False}
```

**Then update:** `backend/app/routers/tiers.py` to import from constants

---

## Part 2: Frontend API Consolidation

### 2.1 Create Shared API Client

**Create:** `frontend/src/services/apiClient.ts`

```typescript
/**
 * Shared API client with authentication and automatic token refresh.
 * Replaces duplicate authRequest functions in stores.
 */
import { useAuthStore } from '../stores/authStore';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function authRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const accessToken = useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Ignore JSON parse errors
    }

    // Handle 401 with token refresh
    if (response.status === 401) {
      const refreshed = await useAuthStore.getState().refreshAccessToken();
      if (refreshed) {
        const newToken = useAuthStore.getState().accessToken;
        headers['Authorization'] = `Bearer ${newToken}`;

        const retryResponse = await fetch(url, {
          ...options,
          headers: { ...headers, ...options.headers },
        });

        if (retryResponse.ok) {
          return retryResponse.status === 204
            ? (undefined as T)
            : retryResponse.json();
        }

        try {
          const data = await retryResponse.json();
          message = data.detail || `HTTP ${retryResponse.status}`;
        } catch {
          message = `HTTP ${retryResponse.status}`;
        }
        throw new ApiError(message, retryResponse.status);
      }
    }

    throw new ApiError(message, response.status);
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string) => authRequest<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown) =>
    authRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    authRequest<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    authRequest<T>(endpoint, { method: 'DELETE' }),
};
```

### 2.2 Update Stores

**Remove duplicate `authRequest` from:**
- `frontend/src/stores/staticGroupStore.ts`
- `frontend/src/stores/tierStore.ts`

**Add import:**
```typescript
import { authRequest } from '../services/apiClient';
```

---

## Part 3: Component Organization

### 3.1 Create Index Exports

**Create:** `frontend/src/components/player/index.ts`
```typescript
export { PlayerCard } from './PlayerCard';
export { SortablePlayerCard } from './SortablePlayerCard';
export { EmptySlotCard } from './EmptySlotCard';
export { AddSlotCard } from './AddSlotCard';
export { AddPlayerModal } from './AddPlayerModal';
export { InlinePlayerEdit } from './InlinePlayerEdit';
export { GearTable } from './GearTable';
export { NeedsFooter } from './NeedsFooter';
export { JobPicker } from './JobPicker';
export { PositionSelector } from './PositionSelector';
export { TankRoleSelector } from './TankRoleSelector';
export { RoleJobSelector } from './RoleJobSelector';
```

**Create:** `frontend/src/components/team/index.ts`
```typescript
export { TeamSummary } from './TeamSummary';
```

**Create:** `frontend/src/components/layout/index.ts`
```typescript
export { Header } from './Header';
export { Layout } from './Layout';
```

---

## Part 4: UI/UX Redesign

### 4.1 Color Palette: "Obsidian & Amber"

Both audits proposed similar darker palettes. Unified version:

```css
@theme {
  /* Backgrounds - Deep blacks with subtle blue undertone */
  --color-bg-primary: #050508;
  --color-bg-secondary: #0a0a10;
  --color-bg-card: #0e0e14;
  --color-bg-elevated: #141420;
  --color-bg-hover: #1a1a28;

  /* Accent - Warm, rich gold */
  --color-accent: #d4a422;
  --color-accent-dim: rgba(212, 164, 34, 0.15);
  --color-accent-bright: #f0c040;
  --color-accent-muted: #8a7428;

  /* Borders - Ultra subtle */
  --color-border-default: #1f1f2e;
  --color-border-subtle: #14141e;
  --color-border-highlight: #d4a422;

  /* Text - Slightly softer contrast */
  --color-text-primary: #f0f0f5;
  --color-text-secondary: #9090a0;
  --color-text-muted: #505060;

  /* Role colors - UNCHANGED (preserve visual identity) */
  --color-role-tank: #4a90c2;
  --color-role-healer: #4ab87a;
  --color-role-melee: #c24a4a;
  --color-role-ranged: #c29a4a;
  --color-role-caster: #a24ac2;

  /* Gear sources */
  --color-source-raid: #c44444;
  --color-source-tome: #44aa44;

  /* Status */
  --color-status-success: #50d070;
  --color-status-warning: #d0c050;
  --color-status-error: #d05050;
  --color-status-info: #50a0d0;
}
```

### 4.2 Header Redesign

**Current (3 rows):**
```
Row 1: [Logo]                           [My Statics] [User]
Row 2: [Static Name] [Owner] [⚙️] CODE  [Tier ▼] [+Add] [🗑]
Row 3: [Party] [Loot] [Stats]           [Sort] [G1/G2] [View]
```

**New (2 rows):**
```
Row 1: [Logo] / Static Name CODE        [Tier ▼] [⚙️] [User]
Row 2: [Party] [Loot] [Stats]           [Sort] [G1/G2] [View]
```

**Key changes:**
- Combine logo + static context in one row
- Settings popover (⚙️) contains: Add Player, New Tier, Rollover, Settings, Delete Tier
- Share code inline with static name
- ~50% vertical space reduction

### 4.3 Create SettingsPopover Component

**Create:** `frontend/src/components/ui/SettingsPopover.tsx`

See mockup file `header-redesign-mockup.jsx` for full implementation.

Key features:
- Single gear icon trigger
- Popover with grouped actions
- Player count badge on "Add Player"
- Danger styling for "Delete Tier"

### 4.4 Update PlayerCard Styling

Replace full-border role styling with left-accent bar:

```tsx
<div
  className="relative bg-bg-card rounded-lg border border-border-subtle"
  style={{
    borderLeftWidth: '3px',
    borderLeftColor: roleColor,
  }}
>
```

---

## Part 5: Implementation Phases

### Phase 1: Backend Cleanup (30 min)
- [ ] Verify no frontend uses legacy `/api/statics` endpoints
- [ ] Delete legacy model/router/schema files
- [ ] Create `backend/app/constants.py`
- [ ] Update `tiers.py` to use shared constants
- [ ] Update `models/__init__.py` and `schemas/__init__.py`

### Phase 2: Frontend API Consolidation (45 min)
- [ ] Create `frontend/src/services/apiClient.ts`
- [ ] Update `staticGroupStore.ts` to use shared client
- [ ] Update `tierStore.ts` to use shared client
- [ ] Remove duplicate `authRequest` functions

### Phase 3: Component Organization (30 min)
- [ ] Create `components/player/index.ts`
- [ ] Create `components/team/index.ts`
- [ ] Create `components/layout/index.ts`
- [ ] Update imports to use barrel exports

### Phase 4: UI/UX Updates (60 min)
- [ ] Update `index.css` with new color palette
- [ ] Create `SettingsPopover.tsx` component
- [ ] Update `Header.tsx` to single-row layout
- [ ] Remove `TierSelector` from GroupView (merged into header)
- [ ] Update PlayerCard with left-accent styling

### Phase 5: Verification (30 min)
- [ ] Run TypeScript check: `pnpm tsc --noEmit`
- [ ] Run linting: `pnpm lint`
- [ ] Manual testing of all features
- [ ] Verify color palette applied correctly

---

## Appendix A: File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/app/models/static.py` | DELETE | Legacy model |
| `backend/app/models/player.py` | DELETE | Legacy model |
| `backend/app/routers/statics.py` | DELETE | Legacy router |
| `backend/app/routers/players.py` | DELETE | Legacy router |
| `backend/app/schemas/static.py` | DELETE | Legacy schemas |
| `backend/app/constants.py` | CREATE | Shared constants |
| `backend/app/routers/tiers.py` | UPDATE | Use shared constants |
| `frontend/src/services/apiClient.ts` | CREATE | Shared API client |
| `frontend/src/stores/staticGroupStore.ts` | UPDATE | Use shared client |
| `frontend/src/stores/tierStore.ts` | UPDATE | Use shared client |
| `frontend/src/components/player/index.ts` | CREATE | Barrel export |
| `frontend/src/components/team/index.ts` | CREATE | Barrel export |
| `frontend/src/components/layout/index.ts` | CREATE | Barrel export |
| `frontend/src/components/ui/SettingsPopover.tsx` | CREATE | Actions menu |
| `frontend/src/components/layout/Header.tsx` | UPDATE | Single-row layout |
| `frontend/src/index.css` | UPDATE | New color palette |

---

## Appendix B: Mockup Reference

Two interactive React mockups are available:

1. **`simplified-header-mockup.jsx`**
   - Before/after comparison toggle
   - Full color palette reference card
   - Player card styling examples

2. **`header-redesign-mockup.jsx`**
   - SettingsPopover implementation
   - TierDropdown component
   - ShareCodeButton with copy feedback
   - MiniPlayerCard with role-color bar

Both mockups demonstrate the "Obsidian & Amber" color palette and can be previewed in any React environment.

---

## Appendix C: Color Palette Quick Reference

```
Background Hierarchy (darkest → lightest):
#050508 → #0a0a10 → #0e0e14 → #141420 → #1a1a28

Gold Accent Hierarchy:
#8a7428 (muted) → #d4a422 (primary) → #f0c040 (bright)

Role Colors (unchanged):
Tank:    #4a90c2
Healer:  #4ab87a
Melee:   #c24a4a
Ranged:  #c29a4a
Caster:  #a24ac2
```

---

**Estimated Total Time:** 3-4 hours
**Risk Level:** Low (mostly deletions and consolidations)
**Breaking Changes:** None (legacy code was unused)
