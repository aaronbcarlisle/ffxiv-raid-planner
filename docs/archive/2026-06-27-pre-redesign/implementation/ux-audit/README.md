# FFXIV Raid Planner - UX Implementation Package

**Created:** 2026-01-11

## Package Contents

| File | Purpose |
|------|---------|
| `FFXIV_RAID_PLANNER_UX_IMPLEMENTATION_PLAN.md` | Master implementation plan with all tasks organized by session |
| `ANALYSIS_AND_SUGGESTIONS.md` | Detailed analysis, concerns, and alternative approaches |
| `CLAUDE_CODE_PROMPT.md` | **Ready-to-use prompt for Claude Code** |
| `reference-images/` | Screenshots referenced in the audit |

## Quick Start

### 1. Copy to Project

Copy these files to your project's `docs/` folder or wherever you keep planning docs:

```bash
cp -r ffxiv-implementation-package/* ~/projects/ffxiv-raid-planner/docs/implementation/
```

### 2. Start Claude Code Session

Open Claude Code in your project directory and paste the contents of `CLAUDE_CODE_PROMPT.md` as your initial prompt.

### 3. Session Flow

**Session 1 (Critical Bugs) - Use Opus**
- BUG-002: Duplicate View As banners (5 min)
- BUG-003: Focus ring artifacts (30 min)
- UX-006: Fix Shift+S navigation (5 min)

**Session 2 (Shortcuts) - Use Sonnet**
- UX-001: Move shortcuts to tooltips
- UX-003: Keyboard shortcuts modal redesign
- UX-010: Add shortcut disable toggle

**Session 3 (Menus) - Use Sonnet**
- UX-008: Update menu item text
- FEAT-006: Admin player assignment
- FEAT-003: Floor section context menu

**Session 4 (Modals/Tips) - Use Sonnet**
- UX-005: Replace native prompts
- UX-004: Modal header icons
- FEAT-008: Permission-aware tips

**Session 5 (Polish) - Use Sonnet**
- UX-009: Linked tags in lists
- UX-007: Shift+click consistency

## Reference Images

| Screenshot | Shows |
|------------|-------|
| `173023.png` | Desired keyboard shortcuts layout (Unreal Engine style) |
| `173117.png` | Current keyboard shortcuts layout |
| `174719.png` | Focus ring bug on modal close button |
| `181045.png` | Inline shortcuts cluttering menu |
| `183111.png` | Focus ring bug on player card |
| `041624.png` | Duplicate View As banners |

## Important Notes

### Session Management

- Start fresh sessions when switching major areas
- Commit frequently with atomic changes
- Run design system check after styling changes
- Test manually in browser between tasks

### Model Selection

| Task Type | Model |
|-----------|-------|
| Complex debugging | Opus |
| Simple components | Sonnet |
| Security code | Opus |
| CSS/styling | Sonnet |

### What I Recommend Skipping

Based on my analysis:
- **UX-012 (Reset shortcut)** - Dangerous, keep menu-only
- **UX-011 (Floor filter hotkeys)** - Over-optimization
- **FEAT-002 (Progress wheel actions)** - Edge case

See `ANALYSIS_AND_SUGGESTIONS.md` for full reasoning.

## Contact

If you have questions about this implementation plan, refer back to the original audit notes or the parity audit document at `docs/audits/2026-01-02-ffxiv-raid-planner-parity-audit.md`.
