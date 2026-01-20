# XIV Raid Planner User Documentation Audit & Recommendations

## Executive Summary

This audit analyzes the current user documentation for FFXIV Raid Planner against industry best practices and gaming community documentation standards. The goal is to create documentation that is **clear, fun, and easy to follow** for users.

**Key Findings:**
- Current docs are comprehensive but **dense and overwhelming**
- Structure is solid but **tone is too technical/formal**
- Missing **visual aids** and **progressive disclosure**
- Some content is **redundant across pages**
- **Excellent technical accuracy** but lacking personality

**Recommendation:** Complete restructure with a friendlier tone, cleaner hierarchy, and gaming-appropriate voice.

---

## Current Documentation Structure

### Pages Analyzed
| Page | Route | Lines | Purpose |
|------|-------|-------|---------|
| DocsIndex | `/docs` | 251 | Hub/landing page |
| QuickStartDocs | `/docs/getting-started` | 254 | Role selection |
| LeadsGuideDocs | `/docs/guides/leads` | 595 | Guide for static leads |
| MembersGuideDocs | `/docs/guides/members` | 609 | Guide for members |
| CommonTasksDocs | `/docs/guides/common-tasks` | 751 | Reference for all users |
| LootMathDocs | `/docs/loot-math` | 906 | Priority system explanation |
| RoadmapDocs | `/docs/roadmap` | 474 | Development status |
| ReleaseNotes | `/docs/release-notes` | 808 | Version history |
| ApiDocs | `/docs/api` | ~1200 | Developer API reference |

**EXCLUDED FROM SCOPE:** Release Notes and System Design (per your request)

---

## Best Practices Research Summary

Based on research into user documentation standards and gaming community writing:

### Core Principles for Great User Docs

1. **Know Your Audience**
   - FFXIV raiders are generally tech-savvy
   - Familiar with game terminology (BiS, savage, tomes, etc.)
   - Expect gaming-appropriate tone (not corporate)

2. **Progressive Disclosure**
   - Lead with the essentials
   - Hide complexity until needed
   - Use expandable sections for advanced details

3. **Show, Don't Just Tell**
   - Screenshots and GIFs are essential
   - Visual examples > text explanations
   - Before/after comparisons work well

4. **Gaming-Appropriate Tone**
   - Friendly and conversational
   - Can be fun without being unprofessional
   - Use "you" language (second person)
   - Avoid corporate/technical jargon where possible

5. **Scannable Structure**
   - Users scan, they don't read
   - Clear headings and visual hierarchy
   - Bullet points for lists (but not everything)
   - Short paragraphs (2-3 sentences max)

6. **Task-Oriented Organization**
   - Organize by what users want to DO
   - Not by how the system is built
   - Answer "How do I...?" questions

---

## Issues Identified

### 1. **Dense & Overwhelming Content**

**Problem:** Pages like CommonTasksDocs (751 lines) and LootMathDocs (906 lines) dump too much information at once.

**Examples:**
- Common Tasks has 10 sections with deep subsections
- Loot Math dives into formulas immediately
- Every detail is shown upfront

**Impact:** Users feel overwhelmed and skip reading

### 2. **Tone is Too Formal/Technical**

**Problem:** The docs read like corporate technical documentation, not a gaming community tool.

**Current tone examples:**
- "The loot priority system calculates who should get each drop based on role and need."
- "Priority = Role Weight + Need Score - Loot Received"
- "Each savage floor drops books (pages) that can be accumulated..."

**These are accurate but clinical.** A gaming audience expects warmer, more engaging writing.

### 3. **Redundant Content Across Pages**

**Problem:** The same information appears in multiple places:
- BiS import explained in: Leads Guide, Members Guide, Common Tasks
- Permissions table in: Leads Guide, Members Guide, Common Tasks
- Loot priority overview in: Common Tasks AND Loot Math

**Impact:** Maintenance burden and user confusion about "source of truth"

### 4. **Missing Visual Aids**

**Problem:** Image placeholders exist but no actual screenshots:
```tsx
{/* <ImagePlaceholder
  src="/docs/images/import-bis.gif"
  alt="Importing BiS from XIVGear"
  caption="Importing a BiS set from XIVGear"
/> */}
```

**Impact:** Users struggle to match written steps to actual UI

### 5. **Navigation Can Be Confusing**

**Problem:** 
- DocsIndex separates "User Docs" from "Developer Docs" but Loot Math is in Developer section (users need it!)
- Getting Started → Leads/Members → Common Tasks creates unnecessary depth
- Quick links are helpful but limited

### 6. **No Clear "Happy Path"**

**Problem:** New users don't have a clear minimal path to success:
- "Just show me how to set up my static in 2 minutes"
- "I just want to track my gear, what's the minimum I need?"

### 7. **Excessive Nesting in Sidebar Navigation**

**Problem:** Each guide has collapsible nav groups that add cognitive load. For example, LeadsGuideDocs has:
- Setup (3 items)
- Roster (2 items)  
- Loot Management (3 items)
- Reference (2 items)

This creates 10 navigation items for a single guide.

---

## Recommendations

### A. Restructure Documentation Hierarchy

**Current Structure:**
```
/docs (Index)
├── /docs/getting-started (QuickStart)
│   ├── /docs/guides/leads
│   ├── /docs/guides/members
│   └── /docs/guides/common-tasks
├── /docs/loot-math
├── /docs/api
├── /docs/roadmap
└── /docs/release-notes
```

**Proposed Structure:**
```
/docs (Simplified Landing)
├── /docs/quick-start          ← Single unified getting started guide
├── /docs/how-to               ← Task-based guides (renamed from common-tasks)
│   ├── #bis-import
│   ├── #gear-tracking
│   ├── #loot-logging
│   └── #book-tracking
├── /docs/understanding-priority  ← Renamed, friendlier Loot Math
├── /docs/faq                   ← NEW: Consolidate scattered FAQs
├── /docs/api                   ← Keep as-is (developer audience)
├── /docs/roadmap              ← Keep as-is
└── /docs/release-notes        ← Keep as-is
```

**Key Changes:**
1. **Merge Leads + Members guides** → Single Quick Start with role-specific callouts
2. **Rename "Common Tasks"** → "How To" (task-oriented)
3. **Rename "Loot Math"** → "Understanding Priority" (friendlier)
4. **Add FAQ page** → Consolidate scattered Q&A content

### B. Adopt a Friendlier Tone

**Before (current):**
> "The loot priority system calculates who should get each drop based on role and need. Priority is calculated from role weight + need score."

**After (proposed):**
> "Loot priority helps your static decide who gets that shiny drop. It considers your role, what gear you still need, and what you've already picked up this tier. Fair and transparent—no more spreadsheet arguments!"

**Tone Guidelines:**
- Use "you" and "your" liberally
- Short sentences (under 20 words)
- Occasional personality (but not forced)
- Gaming terminology is fine (BiS, savage, etc.)
- Explain jargon if it's OUR jargon (not FFXIV's)

### C. Create Visual Documentation

**Priority screenshots needed:**
1. Creating a static (wizard flow)
2. Importing BiS (modal + result)
3. Gear checkbox states
4. Loot priority tab
5. Quick Log modal
6. Book tracking panel

**Format recommendations:**
- Annotated screenshots with callouts
- Short GIFs for multi-step flows (3-5 seconds)
- Light/dark mode versions where UI differs

### D. Implement Progressive Disclosure

**Pattern:** Show essentials first, hide details in expandable sections.

**Example for Priority System:**

```
# How Priority Works

Your priority score determines who gets loot first. Higher score = higher priority.

[Show Simple Version]
┌─────────────────────────────────────────────┐
│ 🏆 Priority = Role Bonus + Need - Received  │
└─────────────────────────────────────────────┘

▼ See the full formula (click to expand)
  └── Role Weight: (5 - roleIndex) × 25
  └── Need Score: Sum of missing slot weights
  └── Loot Adjustment: -15 per item received
  └── [Link to Technical Reference]
```

### E. Consolidate Duplicate Content

**Create single source of truth for:**

| Topic | Location | Currently Duplicated In |
|-------|----------|------------------------|
| BiS Import | `/docs/how-to#bis-import` | Leads, Members, Common Tasks |
| Permissions | `/docs/how-to#permissions` | Leads, Members, Common Tasks |
| Priority Overview | `/docs/understanding-priority` | Common Tasks, Loot Math |

**Other pages link TO these, not copy FROM them.**

### F. Add Quick-Reference Cards

**For DocsIndex, add visual "cheat sheet" cards:**

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ 🚀 Just getting started?│  │ 📋 Need a quick how-to? │
│                         │  │                         │
│ → Quick Start Guide     │  │ → Import BiS            │
│   5-minute setup        │  │ → Log Loot Drops        │
│                         │  │ → Track Floor Clears    │
└─────────────────────────┘  └─────────────────────────┘
```

---

## Proposed New Documentation Pages

### 1. Simplified Landing Page (`/docs`)

**Goals:**
- Immediate value proposition
- 3 clear paths: Quick Start, How-To, Deep Dive
- No scrolling needed to understand what's available

### 2. Unified Quick Start Guide (`/docs/quick-start`)

**Structure:**
1. What is XIV Raid Planner? (30 seconds)
2. Create Your Static (2 minutes)
3. Import Your BiS (1 minute)
4. Invite Your Team (1 minute)
5. You're Ready! (next steps)

**Key change:** Role-specific callouts WITHIN the guide, not separate guides.

```
## 3. Import BiS Sets

Import your Best-in-Slot gearset so we know what you're working toward.

**If you're a static lead:** You can import BiS for everyone.
**If you're a member:** Import your own after claiming your card.

[Steps here]
```

### 3. Task-Based How-To Guide (`/docs/how-to`)

**Structure by user intent:**
- "I want to import my BiS"
- "I want to track what gear I have"
- "I want to know who gets the next drop"
- "I want to log a loot drop"
- "I want to track our book progress"
- "I want to understand permissions"

**Each section:** 3-5 steps max, screenshot, link to deep dive if needed.

### 4. Understanding Priority (`/docs/understanding-priority`)

**Reframe from "math" to "understanding":**
- Lead with WHY (fair loot distribution)
- Simple explanation first
- Expandable technical details
- Interactive examples if possible

### 5. FAQ Page (`/docs/faq`)

**Consolidate existing Q&A from:**
- Members Guide "Tips & FAQ" section
- Scattered InfoBoxes with common questions

**Categories:**
- Getting Started
- Gear & BiS
- Loot & Priority
- Permissions & Access
- Troubleshooting

---

## Implementation Plan

### Phase 1: Content Restructure (High Priority)

1. [ ] Create new simplified `/docs` landing page
2. [ ] Merge Leads + Members guides into unified Quick Start
3. [ ] Rename and restructure Common Tasks → How-To
4. [ ] Rename Loot Math → Understanding Priority
5. [ ] Create FAQ page from existing content

### Phase 2: Tone & Style Update (Medium Priority)

6. [ ] Rewrite Quick Start with friendlier tone
7. [ ] Rewrite How-To sections with conversational voice
8. [ ] Simplify Understanding Priority language
9. [ ] Add personality to intro paragraphs

### Phase 3: Visual Additions (Medium Priority)

10. [ ] Create/capture key screenshots
11. [ ] Add annotated images to Quick Start
12. [ ] Add GIFs for multi-step processes
13. [ ] Replace placeholder ImagePlaceholder components

### Phase 4: Polish & Optimization (Lower Priority)

14. [ ] Implement progressive disclosure (expandable sections)
15. [ ] Add "quick reference" cards to landing page
16. [ ] Review and fix broken internal links
17. [ ] Add search functionality (if not present)
18. [ ] Mobile responsiveness check

---

## Files That Will Change

| Current File | Action |
|--------------|--------|
| `DocsIndex.tsx` | Major rewrite - simpler, friendlier |
| `QuickStartDocs.tsx` | Major rewrite - unified guide |
| `LeadsGuideDocs.tsx` | Deprecate - merge into Quick Start |
| `MembersGuideDocs.tsx` | Deprecate - merge into Quick Start |
| `CommonTasksDocs.tsx` | Rename + restructure → HowToDocs.tsx |
| `LootMathDocs.tsx` | Rename + simplify → UnderstandingPriorityDocs.tsx |
| NEW: `FAQDocs.tsx` | Create from existing Q&A content |

---

## Tone Examples

### Before & After Comparisons

**Section Headers:**
- Before: "Importing BiS"
- After: "Import Your BiS Set"

**Introduction paragraphs:**
- Before: "Import your Best-in-Slot gearset to populate slot data with item names, icons, and sources."
- After: "Got your BiS planned out? Let's import it so we can track your progress toward that sweet gear."

**Step instructions:**
- Before: "Click the 3-dot menu (⋮) on your player card and select 'Import BiS', or right-click the card to access the context menu."
- After: "Right-click your player card (or tap the ⋮ menu) and hit 'Import BiS'."

**Technical explanations:**
- Before: "Priority = Role Weight + Need Score - Loot Received"
- After: "Your priority goes up based on your role and what gear you still need. It goes down a bit each time you get a drop—keeps things fair!"

---

## Success Metrics

After implementing these changes, the documentation should:

1. **Be completable** - New user can set up a static in under 5 minutes
2. **Be scannable** - Key information visible without scrolling
3. **Be findable** - Users can find specific tasks in under 10 seconds
4. **Feel friendly** - Tone matches gaming community expectations
5. **Be maintainable** - No duplicate content across pages

---

## Questions for Review

Before implementation, please confirm:

1. **Should we keep separate Leads/Members pages** as an ALTERNATIVE to the merged guide, or fully deprecate?
2. **API docs and Cookbook** - Should these remain separate or be consolidated?
3. **Design System page** - Is this user-facing or dev-only? (Currently in "Technical Reference")
4. **Priority for screenshots** - Do you have assets to share, or should we plan to capture them?

---

## Summary of Feedback on Release Notes & Roadmap

You mentioned these are mostly optimized to your liking. A few minor suggestions:

### Release Notes
- **Strength:** Great categorization (New, Fix, Improved, Breaking)
- **Strength:** Expandable items with commit details
- **Suggestion:** Consider adding a "Highlights" or "TL;DR" at the top of major releases

### Roadmap
- **Strength:** Visual progress bar is excellent
- **Strength:** Phase cards with expand/collapse work well
- **Suggestion:** Consider adding estimated timeline hints for planned features (if comfortable sharing)
- **Suggestion:** "Known Issues" section is great—could link to GitHub issues if public

---

*Audit completed: January 2026*
*Analyst: Claude (AI Assistant)*
