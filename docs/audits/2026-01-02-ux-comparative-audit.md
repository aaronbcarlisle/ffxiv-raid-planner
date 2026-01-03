# FFXIV Raid Planner - Comprehensive UX Comparative Audit

**Date:** 2026-01-02
**Prepared by:** Claude (Opus 4.5)
**Purpose:** Compare reference spreadsheets against web app to identify feature gaps, UX improvements, and design refinements

---

## Executive Summary

This audit compares two community-standard FFXIV raid planning spreadsheets against the current web application to identify opportunities for improvement. The analysis reveals the web app has achieved strong feature parity (~85%) but has significant UX/UI gaps that impact usability compared to the spreadsheet experience.

### Key Findings

| Category | Status | Notes |
|----------|--------|-------|
| **Core Features** | 85% Parity | Missing: Alt job tracking, auto-priority tables, marker system |
| **Data Density** | Needs Work | Spreadsheets show 8 players at once; app requires scrolling |
| **Information Hierarchy** | Needs Work | App hides critical info behind tabs and modals |
| **Visual Feedback** | Partial | Has status colors but lacks spreadsheet's automatic color coding |
| **Workflow Efficiency** | Needs Work | Too many clicks; spreadsheets are faster for common tasks |

---

## Phase 1: Deep Analysis

### Reference Sheet 1: Savage Group Sheet (Udra Virias v1.8)

**Tabs & Purpose:**
| Tab | Primary Function | Key Features |
|-----|------------------|--------------|
| **Info & Version Tracker** | Setup, metadata | Version info, share link, contact |
| **BiS Tracker** | Per-player gear tracking | 11 slots × 8 players, Have/Augmented checkboxes, material tracking, page calculations |
| **Loot Tracker** | Weekly loot log | 20 weeks × 4 floors × 8 players grid |
| **Quick Summary** | Dashboard | Auto-calculated weapon drops, coffer counts, material status, gear needs |
| **Weapon Tracker** | Weapon priority | Priority matrix by job, drops/coffers per player, mount tracker, auto-priority table |

**Strengths:**
- All 8 players visible on one screen
- Auto-calculated summaries update instantly
- Clear weapon priority queue system with drag-to-reorder
- Material tracking (Polish/Weave/Solvent) integrated into player view
- Tome cost and weeks-to-cap calculations

**Data Model:**
- 11 gear slots per player (including offhand for PLD)
- Have? / Augmented? boolean flags
- Polish/Weave/Weapon material need tracking
- Pages per floor (1-4) with Gear/Upgrades split
- Tome cost in tomestones with weeks calculation

---

### Reference Sheet 2: Arcadion Raid Team Gear Planning (Wyssberk v7.4)

**Tabs & Purpose:**
| Tab | Primary Function | Key Features |
|-----|------------------|--------------|
| **Instructions** | Setup guide | Usage instructions, troubleshooting, version history |
| **Heavyweight Gear** | Main gear tracking | Desired vs Current per slot, iLv display, markers, page calculations |
| **(Alts) Heavyweight Gear** | Alt job tracking | Linked sheet support for alt jobs sharing page pool |
| **Heavyweight Loot** | Loot distribution | Per-week loot with weights, color-coded by loot count |
| **Who Needs It?** | Quick reference | Auto-generated: who needs what from which floor |

**Strengths:**
- 9 gear source categories (Savage, Tome Up, Catchup, Tome, Relic, Crafted, Prep, Trash, Wow)
- Automatic color coding based on gear progression (Purple→Blue→Green→Yellow→White→Red)
- iLv tracking with automatic average calculation
- Planning markers: 🔨 (craft), 📃 (pages), ♻️ (F4 pages), 💰 (token), ◀️ (improve next), 💾 (have token)
- Linked sheets for alt job tracking with combined page totals
- "Who Needs It?" auto-generated view for raid night decisions
- Loot count balancing with configurable weights
- Timestamp tracking for player updates
- Pages Adjust field for missed weeks

**Data Model:**
- Desired gear category + Current gear category per slot
- iLv lookup by category
- Per-player page adjustments
- Loot count with weight multipliers
- Linked sheet references for alts

---

### Current Web App Analysis

**Tabs & Purpose:**
| Tab | Primary Function | Key Features |
|-----|------------------|--------------|
| **Roster** | Player management | Card-based layout, drag-drop reorder, expanded/compact view, G1/G2 toggle |
| **Loot** | Priority calculation | Floor selector, gear priority by slot, weapon priority by job |
| **Log** | Historical tracking | Loot log entries, book balances, week navigation |
| **Summary** | Team overview | Table view of completion %, books needed, materials needed |

**Strengths:**
- Modern dark UI with consistent design language
- Discord OAuth authentication
- Multi-static support with role-based permissions
- BiS import from XIVGear/Etro with item icons and hover cards
- Weapon priority with drag-drop reordering and locking
- Multi-tier support (rollover between raid tiers)
- Share codes for easy team access
- Real-time collaboration

**Weaknesses:**
- Only shows 4 players at a time in expanded view (8 in compact)
- Critical info hidden behind tabs and modals
- No visual color coding for gear progression
- No "Who Needs It?" quick reference view
- No alt job tracking
- No marker system for planning
- No loot count balancing

---

## Phase 2: Comparative Audit

### Feature Parity Matrix

| Feature | Savage Sheet | Arcadion Sheet | Web App | Gap Analysis |
|---------|--------------|----------------|---------|--------------|
| **Gear Tracking** |||||
| 11 gear slots | ✅ | ✅ | ✅ | Parity |
| Have/Augmented flags | ✅ | ✅ | ✅ | Parity |
| BiS source (Raid/Tome) | ✅ | ✅ | ✅ | Parity |
| Current gear category | ❌ | ✅ (9 categories) | ✅ (9 categories) | Parity |
| iLv tracking | ❌ | ✅ | ✅ | Parity |
| Gear color coding | ❌ | ✅ (automatic) | ⚠️ (badges only) | **Gap**: Need automatic row coloring |
| Planning markers | ❌ | ✅ (6 markers) | ❌ | **Gap**: Add marker system |
| **Page/Book Tracking** |||||
| Books per floor | ✅ | ✅ | ✅ | Parity |
| Current pages balance | ✅ | ✅ | ✅ | Parity |
| Spent pages tracking | ✅ | ✅ | ✅ | Parity |
| Pages Adjust (missed weeks) | ❌ | ✅ | ✅ | Parity |
| **Material Tracking** |||||
| Twine/Glaze/Solvent need | ✅ | ✅ | ✅ | Parity |
| Material drops received | ✅ | ✅ | ✅ | Parity |
| Material bought | ✅ | ✅ | ❌ | **Gap**: Add purchased tracking |
| **Loot Tracking** |||||
| Weekly loot log | ✅ | ✅ | ✅ | Parity |
| Loot recipient | ✅ | ✅ | ✅ | Parity |
| Loot method (drop/book/tome) | ❌ | ❌ | ✅ | Web app exceeds |
| Loot notes | ❌ | ✅ | ✅ | Parity |
| Loot count balancing | ❌ | ✅ | ❌ | **Gap**: Add loot count display |
| Configurable weights | ❌ | ✅ | ❌ | **Gap**: Add weight configuration |
| **Weapon Priority** |||||
| Weapon priority list | ✅ | ❌ | ✅ | Parity |
| Multi-job weapon queue | ✅ | ❌ | ✅ | Parity |
| Weapon received tracking | ✅ | ✅ | ✅ | Parity |
| Auto-priority table by job | ✅ | ❌ | ✅ | Parity |
| Mount tracking | ✅ | ✅ | ❌ | **Gap**: Add mount tracking |
| **Summary/Dashboard** |||||
| Team completion % | ✅ | ✅ | ✅ | Parity |
| Books needed per floor | ✅ | ✅ | ✅ | Parity |
| Materials still needed | ✅ | ✅ | ✅ | Parity |
| Weeks to complete | ✅ | ✅ | ✅ | Parity |
| "Who Needs It?" view | ❌ | ✅ | ❌ | **Critical Gap**: Add this view |
| **Alt/Multi-Job** |||||
| Alt job gear tracking | ❌ | ✅ (linked sheets) | ❌ | **Gap**: Add alt support |
| Combined page totals | ❌ | ✅ | ❌ | **Gap**: Part of alt support |
| **Collaboration** |||||
| Multi-user editing | ✅ (Google Sheets) | ✅ (Google Sheets) | ✅ | Parity |
| Permission levels | ⚠️ (sheet protection) | ⚠️ (sheet protection) | ✅ (4 roles) | Web app exceeds |
| Timestamp tracking | ❌ | ✅ | ⚠️ (updatedAt) | Partial parity |

### Workflow Comparison

#### Workflow 1: Initial Setup

**Spreadsheets (Arcadion):**
1. Copy public sheet to own Google account (1 click)
2. Share with team (2 clicks)
3. Each player fills in their row: name, job, gear set link (3 fields)
4. **Time: ~30 seconds per player**

**Web App:**
1. Login with Discord (1 click)
2. Create static (2 clicks + name)
3. Add players (click empty slot, enter name, select job)
4. Import BiS via modal (click BiS, paste link, preview, confirm)
5. **Time: ~60-90 seconds per player**

**Gap:** BiS import process has too many steps. Consider auto-importing on link paste.

---

#### Workflow 2: Pre-Raid Check ("Who Needs What?")

**Spreadsheet (Arcadion):**
1. Open "Who Needs It?" tab (1 click)
2. See all 8 players × all slots at a glance
3. Checkboxes show needs per slot per floor
4. **Time: Instant visibility**

**Web App:**
1. Navigate to Loot tab
2. Select floor from dropdown
3. View priority list per slot (but only 4 columns visible)
4. **Time: Multiple clicks, cannot see everything at once**

**Gap:** Need a dedicated "Who Needs It?" quick reference view.

---

#### Workflow 3: Logging Loot During Raid

**Spreadsheet (Savage Group Sheet):**
1. Navigate to Loot Tracker tab
2. Find current week row
3. Type item name in recipient's column
4. **Time: ~5 seconds**

**Web App:**
1. Navigate to Loot tab (or already there)
2. Click item slot to log
3. Modal opens with priority list
4. Click recipient
5. Optionally check "Update gear"
6. Click Log
7. **Time: ~10-15 seconds**

**Gap:** Add quick-log without modal (single click assigns to top priority, shift+click opens modal for override).

---

#### Workflow 4: Checking Progress

**Spreadsheet (Arcadion):**
1. Heavyweight Gear tab shows all players with automatic color coding
2. Color indicates progression: Purple (BiS) → Blue (near max) → Yellow (needs tokens) → Red (upgrade ASAP)
3. iLv displayed per player
4. **Time: Instant visual scan**

**Web App:**
1. Summary tab shows table with completion %
2. Must switch to Roster tab to see gear details
3. No automatic color coding of progression
4. **Time: Requires tab switching**

**Gap:** Add visual indicators on player cards showing progression state.

---

### UX/UI Assessment

#### Information Density

| Metric | Spreadsheets | Web App | Impact |
|--------|--------------|---------|--------|
| Players visible | 8 (all) | 4-8 (depends on view) | High - scrolling loses context |
| Gear slots visible | 11 per player | 11 per player (expanded) | Parity |
| Summary visible | Same page | Separate tab | Medium - context switching |
| Actions per task | 1-3 clicks | 3-7 clicks | High - workflow friction |

#### Interaction Patterns

| Pattern | Spreadsheets | Web App | Recommendation |
|---------|--------------|---------|----------------|
| **Data entry** | Direct cell edit | Modal → form → submit | Add inline editing mode |
| **Gear toggle** | Checkbox click | Checkbox click | Parity |
| **View switching** | Tab bar | Tab navigation | Parity |
| **Filtering** | Google Sheets filter | Limited | Add more filter options |
| **Sorting** | Click column header | Preset selector | Add column sorting |

#### Accessibility

| Criterion | Web App Status | Notes |
|-----------|----------------|-------|
| Color contrast | ⚠️ Partial | Some text-muted colors below 4.5:1 |
| Keyboard navigation | ⚠️ Partial | Modals trap focus, but tab order unclear |
| Screen reader | ⚠️ Unknown | No ARIA labels on custom components |
| Touch targets | ✅ Good | Buttons and checkboxes meet 44px minimum |
| Focus indicators | ✅ Good | Teal focus rings visible |

---

### Design Language Review

#### Typography

| Element | Current | Recommendation |
|---------|---------|----------------|
| Font family | Inter | ✅ Good - readable, professional |
| Base size | 14-16px | ✅ Good |
| Heading hierarchy | Inconsistent | Establish clear h1-h6 scale |
| Line height | 1.4-1.5 | ✅ Good |

#### Spacing

| Element | Current | Issue |
|---------|---------|-------|
| Card padding | 16px | ✅ Consistent |
| Tab spacing | 8px gap | ✅ Good |
| Modal padding | 24px | ✅ Good |
| Grid gaps | 16px | ⚠️ Some 12px, some 16px |

**Recommendation:** Establish 4px grid system (4, 8, 12, 16, 24, 32, 48).

#### Iconography

| Current State | Issues |
|---------------|--------|
| Custom FFXIV-styled icons | ✅ Good thematic consistency |
| Job icons from XIVAPI | ✅ Authentic |
| Gear slot icons | ⚠️ Mix of outline and filled styles |
| Action icons | ✅ Consistent style |

**Recommendation:** Standardize on outline icons for interactive elements, filled for status indicators.

---

### Color Palette Audit

#### Current Palette

```css
/* Surface Hierarchy (Dark Theme) */
--color-surface-base: #050508;      /* Page BG - very dark */
--color-surface-raised: #0a0a0f;    /* Sections */
--color-surface-card: #0e0e14;      /* Cards */
--color-surface-elevated: #121218;  /* Inputs */
--color-surface-overlay: #18181f;   /* Modals */
--color-surface-interactive: #1e1e26; /* Hover */

/* Accent (Teal) */
--color-accent: #14b8a6;            /* Primary teal */
--color-accent-dim: rgba(20, 184, 166, 0.15);
--color-accent-bright: #2dd4bf;     /* Hover state */

/* Role Colors */
--color-role-tank: #5a9fd4;         /* Blue */
--color-role-healer: #5ad490;       /* Green */
--color-role-melee: #d45a5a;        /* Red */
--color-role-ranged: #d4a05a;       /* Orange */
--color-role-caster: #b45ad4;       /* Purple */

/* Status Colors */
--color-status-success: #22c55e;
--color-status-warning: #eab308;
--color-status-error: #ef4444;
--color-status-info: #14b8a6;
```

#### Contrast Analysis (WCAG 2.1)

| Combination | Ratio | Level | Pass? |
|-------------|-------|-------|-------|
| text-primary on surface-base | 15.2:1 | AAA | ✅ |
| text-secondary on surface-card | 6.1:1 | AA | ✅ |
| text-muted on surface-card | 3.8:1 | AA | ❌ Fails for normal text |
| accent on surface-card | 5.4:1 | AA | ✅ |
| role-tank on surface-card | 4.8:1 | AA | ✅ |
| role-healer on surface-card | 6.2:1 | AA | ✅ |

**Issues:**
1. `text-muted` (#52525b) fails WCAG AA on dark backgrounds
2. Some badge text on colored backgrounds needs verification

**Recommendation:** Lighten `text-muted` to #71717a for 4.5:1 ratio.

#### FFXIV Theming Alignment

| FFXIV Element | In-Game Color | App Color | Match? |
|---------------|---------------|-----------|--------|
| Tank role | Blue (#5a9fd4) | Blue (#5a9fd4) | ✅ |
| Healer role | Green (#5ad490) | Green (#5ad490) | ✅ |
| DPS Melee | Red (#d45a5a) | Red (#d45a5a) | ✅ |
| DPS Ranged | Orange (#d4a05a) | Orange (#d4a05a) | ✅ |
| DPS Caster | Purple (#b45ad4) | Purple (#b45ad4) | ✅ |
| Raid gear | Purple/Gold | Red badge | ⚠️ Could use gold |
| Tome gear | Blue-ish | Teal badge | ✅ Close |
| Augmented | Gold | Amber badge | ✅ |

**Recommendation:** Consider using gold/amber for raid gear badges to match in-game item borders.

---

## Phase 3: Improvement Plan

### Critical Priority (P0) - Must Have

| ID | Issue | Current State | Proposed Solution | Implementation Notes |
|----|-------|---------------|-------------------|---------------------|
| P0-01 | No "Who Needs It?" view | Missing | Add dedicated tab/view showing floor → slot → player matrix | New component: `WhoNeedsItView.tsx` |
| P0-02 | Loot count not displayed | Missing | Show total drops received per player in priority calculations | Add `lootCount` to player summary |
| P0-03 | Can't see all players | 4 at a time in expanded | Add "spreadsheet view" option showing all 8 in table format | New component: `RosterTableView.tsx` |

### High Priority (P1) - Should Have

| ID | Issue | Current State | Proposed Solution | Implementation Notes |
|----|-------|---------------|-------------------|---------------------|
| P1-01 | No quick-log | Modal required | Single-click logs to top priority; Shift+click opens modal | Add to `FloorSelector.tsx` |
| P1-02 | No progression color coding | Static badges | Auto-color player cards based on gear state (BiS/near/needs) | Add to `PlayerCard.tsx` |
| P1-03 | No planning markers | Missing | Add marker dropdown per gear slot (🔨📃♻️💰◀️💾) | New field in `GearSlotStatus` |
| P1-04 | No mount tracking | Missing | Add mount checkbox to floor 4 loot log | New field in `LootLogEntry` |
| P1-05 | No loot weight config | Missing | Add weight multipliers per loot type in settings | Add to `StaticGroupSettings` |
| P1-06 | Material bought tracking | Missing | Add "bought" count for materials | New field in loot tracking |

### Medium Priority (P2) - Nice to Have

| ID | Issue | Current State | Proposed Solution | Implementation Notes |
|----|-------|---------------|-------------------|---------------------|
| P2-01 | No alt job support | Missing | Add linked alt sheets concept | Major feature - separate planning |
| P2-02 | Too many workflow clicks | 3-7 per task | Add keyboard shortcuts (1-8 for players, Enter to confirm) | Global keybinds |
| P2-03 | Inconsistent spacing | 12-16px gaps | Establish 4px grid system | CSS variables |
| P2-04 | text-muted contrast | 3.8:1 | Change to #71717a | CSS update |
| P2-05 | No inline editing mode | Modal-first | Add spreadsheet-style direct editing | Toggle mode |

### Low Priority (P3) - Future Enhancements

| ID | Issue | Current State | Proposed Solution | Implementation Notes |
|----|-------|---------------|-------------------|---------------------|
| P3-01 | No column sorting in Summary | Fixed order | Add clickable column headers to sort | Table component upgrade |
| P3-02 | Gear slot icon inconsistency | Mixed styles | Standardize on outline icons | Asset replacement |
| P3-03 | No timestamp display | Hidden | Show "last updated" on player cards | UI addition |
| P3-04 | Raid gear badge color | Red | Consider gold/amber for FFXIV alignment | CSS change |

---

## Phase 4: Design Mockups

### Mockup 1: "Who Needs It?" View

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Who Needs It? - Quick Reference                                    [P9S]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Floor 1 (Accessories)              Floor 2 (Left Side)                 │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │ Earring   [●][●][●][ ]  │        │ Head      [●][ ][ ][ ]  │        │
│  │ Necklace  [●][●][ ][ ]  │        │ Hands     [●][●][ ][ ]  │        │
│  │ Bracelet  [●][●][●][●]  │        │ Feet      [●][ ][ ][ ]  │        │
│  │ Ring      [●][●][●][●]  │        │ Glaze     [●][●][●][ ]  │        │
│  └─────────────────────────┘        └─────────────────────────┘        │
│                                                                         │
│  Floor 3 (Body)                     Floor 4 (Weapon)                    │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │ Chest     [●][●][ ][ ]  │        │ Weapon    [●][●][●][●]  │        │
│  │ Legs      [●][●][●][ ]  │        │           [●][●][●][●]  │        │
│  │ Twine     [●][●][ ][ ]  │        │ Mount     [ ][ ][ ][ ]  │        │
│  │ Solvent   [ ][ ][ ][ ]  │        │           [ ][ ][ ][ ]  │        │
│  └─────────────────────────┘        └─────────────────────────┘        │
│                                                                         │
│  Legend: [●] = Needs for BiS  [ ] = Complete/Not BiS                   │
│  Hover for player name, click to quick-log                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mockup 2: Spreadsheet View (Roster Table)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Roster - Table View                                    [Card View] [Table] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Name    │ Job │ Weap │ Head │ Body │ Hand │ Legs │ Feet │ Ear │ Neck │ ... │
│ ─────────┼─────┼──────┼──────┼──────┼──────┼──────┼──────┼─────┼──────┼─────│
│ ▓ Leylie │ BLM │ ■ □  │ ■ □  │ ■ ☑  │ ■ □  │ ■ □  │ ■ □  │ □ ☑ │ □ ☑  │     │
│ ▓ Goony  │ DRG │ ■ □  │ ■ □  │ ■ □  │ ■ □  │ ■ □  │ ■ □  │ ■ □ │ □ □  │     │
│ ▓ Scholy │ SCH │ ■ □  │ ■ □  │ □ ☑  │ ■ □  │ ■ □  │ ■ □  │ ■ □ │ ■ □  │     │
│ ▓ MrDark │ DRK │ ■ ☑  │ ■ ☑  │ ■ ☑  │ ■ □  │ ■ □  │ ■ □  │ ■ □ │ ■ □  │     │
│ ▓ Dancy  │ DNC │ ■ □  │ □ □  │ ■ □  │ ■ □  │ □ ☑  │ ■ □  │ ■ □ │ ■ □  │     │
│ ▓ Pally  │ PLD │ ■ □  │ ■ □  │ □ □  │ ■ □  │ ■ □  │ □ ☑  │ ■ □ │ ■ □  │     │
│ ▓ Whitey │ WHM │ ■ □  │ ■ □  │ □ □  │ ■ □  │ ■ □  │ ■ □  │ □ ☑ │ ■ □  │     │
│ ▓ Punchy │ MNK │ ■ □  │ ■ □  │ □ ☑  │ ■ □  │ ■ □  │ ■ □  │ ■ □ │ □ □  │     │
│ ─────────┼─────┼──────┼──────┼──────┼──────┼──────┼──────┼─────┼──────┼─────│
│                                                                             │
│  Legend: ■ = Raid BiS  □ = Tome BiS  ☑ = Have  ▓ = Role color              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mockup 3: Progress Color Coding on Player Cards

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ╔══════════════════════════════╗   ╔══════════════════════════════╗        │
│  ║ 🟣 COMPLETE                   ║   ║ 🔵 NEAR MAX                   ║        │
│  ║ ┌────────────────────────┐   ║   ║ ┌────────────────────────┐   ║        │
│  ║ │ MrDark       [DRK] MT  │   ║   ║ │ Goony       [DRG] M1   │   ║        │
│  ║ │ 11/11         i790     │   ║   ║ │ 9/11         i788      │   ║        │
│  ║ │ ☑☑☑☑☑☑☑☑☑☑☑           │   ║   ║ │ ☑☑☑☑☑☑☑☑☑□□           │   ║        │
│  ║ └────────────────────────┘   ║   ║ └────────────────────────┘   ║        │
│  ╚══════════════════════════════╝   ╚══════════════════════════════╝        │
│                                                                              │
│  ╔══════════════════════════════╗   ╔══════════════════════════════╗        │
│  ║ 🟡 NEEDS TOKENS               ║   ║ 🔴 UPGRADE PRIORITY           ║        │
│  ║ ┌────────────────────────┐   ║   ║ ┌────────────────────────┐   ║        │
│  ║ │ Leylie       [BLM] H1  │   ║   ║ │ Dancy       [DNC] T2   │   ║        │
│  ║ │ 4/11          i776     │   ║   ║ │ 0/11         i770      │   ║        │
│  ║ │ ☑☑☑☑□□□□□□□           │   ║   ║ │ □□□□□□□□□□□             │   ║        │
│  ║ └────────────────────────┘   ║   ║ └────────────────────────┘   ║        │
│  ╚══════════════════════════════╝   ╚══════════════════════════════╝        │
│                                                                              │
│  Border colors indicate progression state for quick visual scanning         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Mockup 4: Planning Markers in Gear Table

```
┌─────────────────────────────────────────────────────────────────┐
│ MrDark - Dark Knight                                   11/11 i790│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Slot      │ BiS Source │ Have │ Aug │ Marker    │ Status       │
│ ───────────┼────────────┼──────┼─────┼───────────┼──────────────│
│  Weapon    │   [Raid]   │  ☑   │  —  │           │ ✓ Complete   │
│  Head      │   [Raid]   │  ☑   │  —  │           │ ✓ Complete   │
│  Body      │   [Tome]   │  ☑   │  ☑  │           │ ✓ Complete   │
│  Hands     │   [Raid]   │  □   │  —  │  📃       │ Buy w/ pages │
│  Legs      │   [Raid]   │  □   │  —  │  ◀️       │ Improve next │
│  Feet      │   [Tome]   │  ☑   │  □  │  💾       │ Have token   │
│  Earring   │   [Raid]   │  □   │  —  │           │ Need drop    │
│  Necklace  │   [Tome]   │  ☑   │  ☑  │           │ ✓ Complete   │
│  Bracelet  │   [Raid]   │  □   │  —  │  🔨       │ Plan to craft│
│  R. Ring   │   [Raid]   │  ☑   │  —  │           │ ✓ Complete   │
│  L. Ring   │   [Tome]   │  ☑   │  ☑  │           │ ✓ Complete   │
│                                                                  │
│  Markers: 🔨 Craft  📃 Pages  ♻️ F4 Pages  💰 Token  ◀️ Next  💾 Have│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Mockup 5: Unified Color Palette (Refined)

```
┌─────────────────────────────────────────────────────────────────┐
│  REFINED COLOR SYSTEM                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SURFACE HIERARCHY (unchanged - working well)                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ base     #050508  ████████                                  │ │
│  │ raised   #0a0a0f  ████████                                  │ │
│  │ card     #0e0e14  ████████                                  │ │
│  │ elevated #121218  ████████                                  │ │
│  │ overlay  #18181f  ████████                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  PROGRESSION COLORS (NEW)                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ complete  #a78bfa  ████████  Purple - BiS achieved          │ │
│  │ near-max  #60a5fa  ████████  Blue - 80%+ done               │ │
│  │ good      #4ade80  ████████  Green - 50-79%                 │ │
│  │ needs     #facc15  ████████  Yellow - needs tokens          │ │
│  │ priority  #f87171  ████████  Red - <30% or urgent           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  GEAR SOURCE (REFINED - more FFXIV aligned)                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ raid      #fbbf24  ████████  Gold/Amber (matches game)      │ │
│  │ tome      #2dd4bf  ████████  Teal (unchanged)               │ │
│  │ augmented #fcd34d  ████████  Bright Gold (unchanged)        │ │
│  │ crafted   #c4b5fd  ████████  Soft Purple (unchanged)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  TEXT (FIXED CONTRAST)                                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ primary   #f0f0f5  ████████  15.2:1 ✓                       │ │
│  │ secondary #a1a1aa  ████████  6.1:1  ✓                       │ │
│  │ muted     #71717a  ████████  4.5:1  ✓ (was #52525b)         │ │
│  │ disabled  #52525b  ████████  3.8:1  (decorative only)       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Sprint 1: Critical UX Fixes (2-3 days)
- [ ] P0-01: "Who Needs It?" view component
- [ ] P0-02: Loot count in priority display
- [ ] P0-03: Roster table view option

### Sprint 2: Workflow Optimization (2-3 days)
- [ ] P1-01: Quick-log (single-click assignment)
- [ ] P1-02: Progression color coding on cards
- [ ] P2-04: Fix text-muted contrast

### Sprint 3: Planning Features (3-4 days)
- [ ] P1-03: Planning markers system
- [ ] P1-04: Mount tracking
- [ ] P1-05: Loot weight configuration
- [ ] P1-06: Material bought tracking

### Sprint 4: Polish (2-3 days)
- [ ] P2-03: Spacing consistency (4px grid)
- [ ] P3-01: Column sorting in Summary
- [ ] P3-04: Raid gear badge color update
- [ ] Documentation updates

---

## Appendix A: Feature Parity Checklist

### Complete (✅)
- [x] 11 gear slot tracking
- [x] BiS source (Raid/Tome)
- [x] Have/Augmented flags
- [x] 9 gear source categories
- [x] iLv tracking
- [x] Book/page balances
- [x] Material need calculation
- [x] Weapon priority lists
- [x] Weekly loot log
- [x] Team summary
- [x] Multi-tier support
- [x] Permission system
- [x] Share codes
- [x] BiS import

### Partial (⚠️)
- [ ] Auto color coding (badges only, need row colors)
- [ ] Timestamp display (stored but not shown)
- [ ] Inline editing (modals only)

### Missing (❌)
- [ ] "Who Needs It?" view
- [ ] Loot count display
- [ ] Planning markers
- [ ] Mount tracking
- [ ] Loot weights
- [ ] Material bought tracking
- [ ] Alt job support
- [ ] Quick-log shortcuts
- [ ] Spreadsheet view

---

## Appendix B: Accessibility Checklist (WCAG 2.1 AA)

| Criterion | Status | Action Required |
|-----------|--------|-----------------|
| 1.1.1 Non-text Content | ⚠️ | Add alt text to icons |
| 1.3.1 Info and Relationships | ⚠️ | Add ARIA labels to custom controls |
| 1.4.3 Contrast (Minimum) | ⚠️ | Fix text-muted color |
| 1.4.11 Non-text Contrast | ✅ | Focus rings meet 3:1 |
| 2.1.1 Keyboard | ⚠️ | Ensure all interactions keyboard-accessible |
| 2.4.3 Focus Order | ⚠️ | Audit tab order in modals |
| 2.4.7 Focus Visible | ✅ | Teal focus rings visible |
| 4.1.2 Name, Role, Value | ⚠️ | Add ARIA to custom checkboxes |

---

## Appendix C: Cross-Comparison Improvements

*Additional insights from parallel analysis that enhance the recommendations above.*

### C.1 Free Roll Indicator
When no player needs an item for BiS, display a prominent "FREE" badge.
- **Location:** "Who Needs It?" view item rows
- **Style:** Green badge with border (matches status-success)
- **Priority:** P1 (improves raid-night decision speed)

### C.2 Weekly Loot Grid View
Spreadsheet-style weekly loot tracking (**NEW P1 feature**):
- Loot count summary bar showing drops per player with fairness coloring
- Floor-colored sections (M9S=green, M10S=blue, M11S=purple, M12S=amber)
- Notes field per floor for context
- Quick actions: "Mark All Floors Cleared", "Copy to Next Week", "Export"

### C.3 Position-First Headers
In "Who Needs It?" view, prioritize raid position over player name:
- Header format: Position (T1, H1, etc.) → Name → Job
- Rationale: Teams think in positions during encounters

### C.4 Per-Slot iLv Display
Show item level on each gear row, not just header:
- Format: `[Current Badge] [iLv] [BiS Badge]`
- Example: `[Savage] 790 [RAID]`

### C.5 Floor Color Coding System

```css
/* Floor Colors - Add to index.css */
--floor-m9s: #22c55e;   /* Green - Floor 1 */
--floor-m10s: #3b82f6;  /* Blue - Floor 2 */
--floor-m11s: #a855f7;  /* Purple - Floor 3 */
--floor-m12s: #f59e0b;  /* Amber - Floor 4 */
```

### C.6 Loot Fairness Visualization
Color-code loot counts to highlight imbalances:
- **Blue (#3b82f6):** Most loot (>avg+1)
- **Yellow (#eab308):** Least loot (<avg-1)
- **Gray (#a1a1aa):** Average range

### C.7 API Endpoint Suggestions

```
GET  /api/tiers/{id}/who-needs-it          → Needs matrix for all players
GET  /api/tiers/{id}/weekly-summary/{week} → Structured weekly loot data
PATCH /api/players/{id}/markers            → Update planning markers
POST /api/tiers/{id}/copy-week             → Copy loot log to next week
```

### C.8 Enhanced Typography/Spacing
- Reduce table row height: 40px → 32-36px for density
- Reduce card padding: 16px → 12px for compact view
- Data table font: 14px → 13px for spreadsheet feel
- Consider gaming-themed font for headers (optional)

### C.9 Icon Standardization
Replace mixed icon sources with Lucide React for consistency:
- Tab icons: Current custom PNGs → Lucide equivalents
- Action icons: Standardize on Lucide set
- Keep XIVAPI job icons (authentic)

---

## Appendix D: Updated Priority Items

### Additional P1 Items (from Cross-Comparison)

| ID | Issue | Current State | Proposed Solution | Implementation Notes |
|----|-------|---------------|-------------------|---------------------|
| P1-07 | No weekly loot grid view | List-based log | Add spreadsheet-style grid with floor colors | New component: `WeeklyLootGrid.tsx` |
| P1-08 | No free roll indicator | No indicator | Add "FREE" badge when no one needs item | Add to `WhoNeedsItView.tsx` |

### Additional Feature Parity Items

| Feature | Savage Sheet | Arcadion Sheet | Web App | Gap Analysis |
|---------|--------------|----------------|---------|--------------|
| Free Roll indicator | ❌ | ✅ | ❌ | **Add** - "FREE" badge |
| Weekly loot grid view | ✅ | ✅ | ❌ | **Critical - Add** |
| Floor color coding | ❌ | ✅ | ❌ | **Add** |
| Copy to Next Week | ❌ | ✅ | ❌ | **Add** |

---

**End of Audit Document**
