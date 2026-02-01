# Priority Tab UX Reorganization Plan

**Status:** Planned (not yet implemented)
**Created:** 2026-02-01

## Overview
Reorganize the Priority tab in Static Settings to improve UX through:
1. Converting Advanced Options to a subtab (Mode | Advanced)
2. Fixing checkbox alignment issues
3. Reorganizing settings with toggle-controlled expandable sections
4. Fixing content cutoff issues

## Files to Modify

### Primary Changes
- `frontend/src/components/settings/PriorityTab.tsx` - Add subtab navigation, restructure layout
- `frontend/src/components/priority/AdvancedOptions.tsx` - Convert to flat layout with toggle sections
- `frontend/src/components/ui/Checkbox.tsx` - Fix vertical alignment
- `frontend/src/components/loot/LootPriorityPanel.tsx` - Update Log Floor button style

### Potentially New Files
- `frontend/src/components/settings/PriorityModeTab.tsx` - Mode selection subtab (optional, could keep inline)
- `frontend/src/components/settings/PriorityAdvancedTab.tsx` - Advanced settings subtab (optional, could keep inline)

---

## Implementation Details

### 1. Fix Checkbox Alignment

**Problem**: Checkbox uses `items-center` which centers it between label and description.

**Solution**: Change to `items-start` with top padding to align checkbox with label text baseline.

```tsx
// In Checkbox.tsx, change line 39:
// FROM:
<label className={`flex items-center gap-2 ...`}>

// TO:
<label className={`flex items-start gap-2 ...`}>

// And add self-alignment to the checkbox wrapper to keep it vertically centered with label text
// Add pt-0.5 or adjust to align with the first line of text
```

### 2. Add Subtabs to PriorityTab

**New Layout**:
```
[Mode] [Advanced]  <- Subtabs

--- Mode Tab ---
Priority Mode
[Mode Selector]

Role Priority Order (or Job/Player based on mode)
[Editor]

--- Advanced Tab ---
Calculation Preset
[Preset Dropdown]

☐ Show priority scores
  Display numeric priority scores in the loot panel

☐ Enable enhanced fairness
  [Expandable: Drought/Balance settings when checked]

☐ Enable Player Loot Adjustments
  [Expandable: Player adjustment grid when checked]

☐ Custom Multipliers
  [Expandable: Role/Gear/Loot multipliers when checked]
```

### 3. Reorganize AdvancedOptions Component

Convert from nested collapsible sections to flat toggle-driven sections:

```tsx
// New structure (conceptual):
<div className="space-y-4">
  {/* Calculation Preset - always visible */}
  <div>
    <Label>Calculation Preset</Label>
    <PresetSelector ... />
  </div>

  {/* Show Priority Scores - simple checkbox */}
  <Checkbox label="Show priority scores" ... />

  {/* Enhanced Fairness - toggle with expandable */}
  <ToggleSection
    label="Enable enhanced fairness"
    description="Adds drought bonus and balance penalty"
    checked={options.enableEnhancedFairness}
    onChange={...}
  >
    {/* Drought/Balance multipliers grid */}
  </ToggleSection>

  {/* Player Loot Adjustments - toggle with expandable */}
  <ToggleSection
    label="Enable Player Loot Adjustments"
    description="Per-player priority adjustments for roster changes"
    checked={options.useLootAdjustments}
    onChange={...}
  >
    {/* Player adjustment list */}
  </ToggleSection>

  {/* Custom Multipliers - toggle with expandable */}
  <ToggleSection
    label="Custom Multipliers"
    description="Fine-tune priority calculation weights"
    checked={options.preset === 'custom'}
    onChange={...}
  >
    {/* Multiplier inputs grid */}
  </ToggleSection>
</div>
```

### 4. Fix Content Cutoff

**Problem**: Content gets clipped above sticky footer.

**Solution**: Add proper padding-bottom to scrollable content area to account for footer height.

```tsx
// In PriorityTab.tsx scrollable content div:
<div className="flex-1 overflow-y-auto space-y-6 min-h-0 pb-20" ...>
  {/* Content */}
</div>
```

### 5. Create ToggleSection Component (Optional Helper)

A reusable component for checkbox + expandable content pattern:

```tsx
interface ToggleSectionProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function ToggleSection({ label, description, checked, onChange, disabled, children }: ToggleSectionProps) {
  return (
    <div className="space-y-3">
      <Checkbox
        label={label}
        description={description}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      {checked && (
        <div className="ml-6 pl-4 border-l-2 border-border-default">
          {children}
        </div>
      )}
    </div>
  );
}
```

### 6. Update "Log Floor" Button Style

**File**: `frontend/src/components/loot/LootPriorityPanel.tsx` (around line 663-671)

**Problem**: The "Log Floor" button uses `variant="secondary"` with an icon, but should match the "+ Log Loot" and "+ Log Material" button style.

**Current**:
```tsx
<Button
  variant="secondary"
  size="sm"
  onClick={() => setLogFloorWizardOpen(true)}
  leftIcon={<ClipboardList className="w-3 h-3" />}
  className="text-xs"
>
  Log Floor
</Button>
```

**Updated**:
```tsx
<Button
  size="sm"
  onClick={() => setLogFloorWizardOpen(true)}
>
  + Log Floor
</Button>
```

Changes:
- Remove `variant="secondary"` (use default primary)
- Remove `leftIcon` prop
- Remove `className="text-xs"`
- Add "+" prefix to text

---

## Visual Mockup

```
┌─────────────────────────────────────────────────────┐
│ ⚙ Static Settings                              [X] │
├─────────────────────────────────────────────────────┤
│ ⚙ General  ≣ Priority  👥 Members  ✉ Invitations  │
├─────────────────────────────────────────────────────┤
│     [ Mode ]  [ Advanced ]        <- subtabs       │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Calculation Preset                                  │
│ ┌─────────────────────────────────────────────────┐│
│ │ Balanced (Recommended)                        ▼ ││
│ └─────────────────────────────────────────────────┘│
│ ⚡ Equal weight to role priority, gear need...     │
│                                                     │
│ ☑ Show priority scores                             │
│   Display numeric priority scores in the loot panel│
│                                                     │
│ ☑ Enable enhanced fairness                         │
│   Adds drought bonus and balance penalty           │
│   ├─────────────────────────────────────────────── │
│   │ Drought Bonus Multiplier    Drought Bonus Cap  │
│   │ [  10  ]                    [   5  ]           │
│   │ Balance Penalty Mult.       Balance Penalty Cap│
│   │ [  15  ]                    [   3  ]           │
│   └─────────────────────────────────────────────── │
│                                                     │
│ ☐ Enable Player Loot Adjustments                   │
│   Per-player priority adjustments for roster...    │
│                                                     │
│ ☐ Custom Multipliers                               │
│   Fine-tune priority calculation weights           │
│                                                     │
├─────────────────────────────────────────────────────┤
│                              [ 💾 Save Changes ]   │ <- sticky
└─────────────────────────────────────────────────────┘
```

---

## Implementation Order

1. **Fix Checkbox alignment** (`Checkbox.tsx`)
   - Change from `items-center` to `items-start`
   - Add appropriate top offset to align with label text

2. **Add subtabs to PriorityTab** (`PriorityTab.tsx`)
   - Add state for active subtab ('mode' | 'advanced')
   - Create tab navigation UI
   - Wrap existing mode content in conditional
   - Move Advanced Options into 'advanced' subtab

3. **Refactor AdvancedOptions** (`AdvancedOptions.tsx`)
   - Remove outer collapsible wrapper (no longer needed as it's a subtab)
   - Add Calculation Preset at top
   - Reorganize with toggle-controlled expandable sections
   - Move Player Loot Adjustments from PriorityTab into here

4. **Fix content cutoff** (`PriorityTab.tsx`)
   - Add bottom padding to scrollable area

5. **Update Log Floor button style** (`LootPriorityPanel.tsx`)
   - Change from `variant="secondary"` to default primary
   - Remove icon, add "+" prefix to match other log buttons

6. **Test all interactions**
   - Verify checkbox alignment across all usages
   - Test subtab navigation
   - Verify all toggle sections expand/collapse correctly
   - Confirm sticky footer doesn't clip content
   - Test save functionality works with new structure
   - Verify Log Floor button matches Log Loot/Material style

---

## Verification

1. Visual check: Checkboxes align with label text (not centered with description)
2. Visual check: Subtabs navigate correctly between Mode and Advanced
3. Visual check: Toggle sections expand/collapse with visual indent
4. Visual check: No content clipped above sticky footer
5. Functional check: Settings persist after save
6. Functional check: Preset changes correctly update multiplier values
7. Responsive check: Layout works on mobile widths
8. Visual check: "Log Floor" button matches "+ Log Loot" and "+ Log Material" style
