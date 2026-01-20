# XIV Raid Planner Documentation Implementation Plan

This document provides phase-by-phase tasks for restructuring the user documentation. Each phase is designed to be a single PR.

**Reference:** See `DOCS_STYLE_GUIDE.md` for tone, formatting, and component usage.

---

## Overview

### Current State
```
/docs                     → DocsIndex.tsx (hub page)
/docs/getting-started     → QuickStartDocs.tsx (role selection)
/docs/guides/leads        → LeadsGuideDocs.tsx (595 lines)
/docs/guides/members      → MembersGuideDocs.tsx (609 lines)  
/docs/guides/common-tasks → CommonTasksDocs.tsx (751 lines)
/docs/loot-math           → LootMathDocs.tsx (906 lines)
/docs/api                 → ApiDocs.tsx (keep as-is)
/docs/api/cookbook        → ApiCookbook.tsx (keep as-is)
/docs/roadmap             → RoadmapDocs.tsx (keep as-is)
/docs/release-notes       → ReleaseNotes.tsx (keep as-is)
/docs/design-system       → DesignSystem.tsx (keep as-is)
```

### Target State
```
/docs                     → DocsIndex.tsx (simplified landing)
/docs/quick-start         → QuickStartGuide.tsx (NEW - unified guide)
/docs/how-to              → HowToDocs.tsx (restructured from CommonTasks)
/docs/understanding-priority → UnderstandingPriority.tsx (simplified from LootMath)
/docs/faq                 → FAQDocs.tsx (NEW - consolidated)
/docs/api                 → ApiDocs.tsx (unchanged)
/docs/api/cookbook        → ApiCookbook.tsx (unchanged)
/docs/roadmap             → RoadmapDocs.tsx (unchanged)
/docs/release-notes       → ReleaseNotes.tsx (unchanged)
/docs/design-system       → DesignSystem.tsx (unchanged)

DEPRECATED:
/docs/getting-started     → Redirect to /docs/quick-start
/docs/guides/leads        → Redirect to /docs/quick-start
/docs/guides/members      → Redirect to /docs/quick-start
/docs/guides/common-tasks → Redirect to /docs/how-to
/docs/loot-math           → Redirect to /docs/understanding-priority
```

---

## Phase 1: Create Unified Quick Start Guide

**Goal:** Replace the three-page getting started flow (QuickStart → Leads/Members) with a single, streamlined guide.

**Branch name:** `docs/unified-quick-start`

### Files to Create

#### `frontend/src/pages/QuickStartGuide.tsx`

**Structure:**
```
1. Header
   - Breadcrumb: Documentation / Quick Start
   - Title: "Get Started with XIV Raid Planner"
   - Subtitle: "Set up your static in under 5 minutes"

2. Sidebar Navigation (NAV_GROUPS)
   - Getting Started
     - overview
     - login
   - Create Your Static
     - create-static
     - add-roster
   - Set Up Gear
     - import-bis
     - claim-cards
   - Start Tracking
     - log-loot
     - next-steps

3. Content Sections

   ## Overview
   - What is XIV Raid Planner? (2-3 sentences)
   - What you'll set up (bullet list)
   - Time estimate: ~5 minutes
   
   ## 1. Log in with Discord
   - Step 1: Click "Login with Discord"
   - Step 2: Authorize (we only need basic profile)
   - Step 3: You're in!
   - InfoBox(tip): "You can log in on mobile too"
   
   ## 2. Create your static
   - Step 1: Go to Dashboard → Create Static
   - Step 2: Enter static name
   - Step 3: Select raid tier
   - Step 4: Choose content type (Savage/Ultimate)
   - InfoBox(info): "You can add more tiers later"
   
   ## 3. Set up your roster
   - Step 1: Add 8 player slots
   - Step 2: Set names and jobs for each
   - Step 3: Review and create
   
   **Role callout box:**
   > **For static leads:** You'll set up the roster. Members will claim their cards after joining.
   > **For members:** Your lead will set this up. Skip to "Claim your card" below.
   
   ## 4. Import BiS sets
   - Why import BiS (1 sentence)
   - Step 1: Click menu on player card → Import BiS
   - Step 2: Paste XIVGear/Etro link OR choose a preset
   - Step 3: Click Import
   - InfoBox(tip): "The Balance presets are great if you don't have a custom set"
   - Link: "More import options →" (/docs/how-to#bis-import)
   
   ## 5. Invite your team (Leads) / Join & claim your card (Members)
   
   ### If you're a static lead:
   - Step 1: Open Static Settings → Invitations
   - Step 2: Create invite link (set role, expiration)
   - Step 3: Share link in Discord
   
   ### If you're joining a static:
   - Step 1: Click the invite link from your lead
   - Step 2: Accept the invitation
   - Step 3: Find your player card and click "Claim"
   - InfoBox(info): "Claiming lets you edit your own gear"
   
   ## 6. Start tracking loot
   - Brief overview of Loot Priority tab
   - How to log a drop (3 steps)
   - Link: "Understanding priority →" (/docs/understanding-priority)
   
   ## Next steps
   - LinkCard: How-To Guides (/docs/how-to)
   - LinkCard: Understanding Priority (/docs/understanding-priority)
   - LinkCard: FAQ (/docs/faq)
```

**Tone examples to use:**

```tsx
// Overview intro
<p>
  XIV Raid Planner helps your static track gear, manage loot fairly, and stay
  organized throughout a raid tier. No more spreadsheets, no more arguments
  about who gets what.
</p>

// Step instruction
<Step number={1} title="Click Login with Discord">
  <p>
    Find the <strong>Login</strong> button in the top-right corner. We only
    ask for your basic Discord profile—no access to your servers or messages.
  </p>
</Step>

// Role-specific callout
<div className="grid md:grid-cols-2 gap-4 my-6">
  <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
    <h4 className="font-medium text-accent mb-2">For Static Leads</h4>
    <p className="text-sm text-text-secondary">
      You'll create the static and set up the roster. Your members will claim
      their cards after you invite them.
    </p>
  </div>
  <div className="bg-membership-member/10 border border-membership-member/30 rounded-lg p-4">
    <h4 className="font-medium text-membership-member mb-2">For Members</h4>
    <p className="text-sm text-text-secondary">
      Your lead will set things up. Once you get an invite, just join and
      claim your player card.
    </p>
  </div>
</div>
```

### Files to Modify

#### `frontend/src/App.tsx`

Add new route:
```tsx
<Route path="docs/quick-start" element={<QuickStartGuide />} />
```

Keep old routes temporarily (for redirects in Phase 6).

### Acceptance Criteria

- [ ] Single page covers full setup flow for both leads and members
- [ ] Page loads at `/docs/quick-start`
- [ ] Sidebar navigation works with scroll tracking
- [ ] All internal links work
- [ ] Tone matches style guide
- [ ] No content exceeds length guidelines

---

## Phase 2: Restructure Common Tasks → How-To

**Goal:** Transform CommonTasksDocs from a reference dump into task-oriented "How do I...?" guides.

**Branch name:** `docs/how-to-restructure`

### Files to Create

#### `frontend/src/pages/HowToDocs.tsx`

**Rename and restructure from CommonTasksDocs.tsx**

**New Structure:**
```
1. Header
   - Title: "How-To Guides"
   - Subtitle: "Quick guides for common tasks"

2. Sidebar Navigation (NAV_GROUPS)
   - Gear & BiS
     - import-bis
     - track-gear
     - understand-checkboxes
   - Loot Tracking  
     - log-loot
     - quick-log
     - adjust-priority
   - Books & Pages
     - mark-clears
     - track-balances
   - Sharing & Access
     - invite-members
     - share-codes
     - permissions

3. Content Sections (rewritten for task focus)

   ## Import your BiS set
   - When to use: First-time setup, job change
   - Steps (simplified from current)
   - Supported sources: XIVGear, Etro, Presets
   - InfoBox(tip): Presets from The Balance
   
   ## Track your gear progress
   - What checkboxes mean
   - Raid BiS vs Tome BiS states
   - How iLv is calculated (brief, link to priority page for details)
   
   ## Log a loot drop
   - Using Quick Log (recommended)
   - Manual logging alternative
   - What happens after logging
   
   ## Mark floor clears
   - Why track clears (book earnings)
   - Steps to mark a clear
   - Who gets credit
   
   ## Invite members to your static
   - Creating invite links
   - Setting permissions
   - Expiration and limits
   
   ## Use share codes
   - What share codes do (read-only access)
   - Share codes vs invite links (comparison table)
   - Tier-specific sharing tip
   
   ## Understand permissions
   - Simplified permissions table (4 roles)
   - What each role can do
   - How to change roles
```

**Key changes from CommonTasksDocs:**
1. Remove duplicate content (BiS import details now in Quick Start)
2. Lead with user intent ("Log a loot drop" not "Quick Log")
3. Shorter sections, link to deep dives
4. Remove iLv calculation details (move to Understanding Priority)
5. Remove slot weights table (move to Understanding Priority)

### Files to Modify

#### `frontend/src/App.tsx`

Add new route:
```tsx
<Route path="docs/how-to" element={<HowToDocs />} />
```

### Acceptance Criteria

- [ ] Each section answers a "How do I...?" question
- [ ] No section exceeds 300 lines
- [ ] Duplicate content removed (links to other pages instead)
- [ ] All steps are numbered and testable
- [ ] Page loads at `/docs/how-to`

---

## Phase 3: Simplify Loot Math → Understanding Priority

**Goal:** Make the priority system accessible to non-technical users while preserving technical details for those who want them.

**Branch name:** `docs/understanding-priority`

### Files to Create

#### `frontend/src/pages/UnderstandingPriority.tsx`

**Rename and simplify from LootMathDocs.tsx**

**New Structure:**
```
1. Header
   - Title: "Understanding Priority"
   - Subtitle: "How loot distribution works"

2. Sidebar Navigation (NAV_GROUPS)
   - The Basics
     - how-it-works
     - your-score
   - What Affects Priority
     - role-priority
     - gear-need
     - loot-received
   - Weapons
     - weapon-priority
     - main-vs-alt
   - Books & Pages
     - book-system
     - exchange-costs
   - Technical Reference
     - formulas
     - tables

3. Content Sections

   ## How priority works (THE SIMPLE VERSION)
   - One paragraph explanation
   - Visual: Simple score breakdown graphic
   - Key point: Higher score = gets loot first
   - Key point: Everyone starts roughly equal, diverges based on drops
   
   ## Your priority score
   - Three factors (role, need, received)
   - Simple example with real numbers
   - InfoBox(tip): "Check your score in the Loot Priority tab"
   
   ## Role priority
   - What it is (your static's priority order)
   - Default order and why
   - How to change it (leads only)
   - Points range: 0-100
   
   ## Gear need
   - Based on what slots you're missing
   - Not all slots equal (body/legs worth more)
   - Updates automatically as you get gear
   
   ## Loot received
   - Small penalty per item received
   - Prevents one person getting everything
   - Resets each tier
   
   ## Weapon priority
   - Separate system for weapons
   - Main jobs first, then alts
   - How to set your weapon priority list
   
   ## Main job vs alt weapons
   - Main job bonus explained simply
   - When alts get considered
   - Tie-breaking
   
   ## Books and pages
   - What they are (bad luck protection)
   - Which floor gives which book
   - Visual: 4-card layout from current page
   
   ## Exchange costs
   - Table of costs (simplified)
   - Link to in-app tracker
   
   ## Technical reference (COLLAPSED BY DEFAULT)
   - Full formulas with code
   - Slot weight table
   - Role weight calculation
   - InfoBox(info): "This section is for the curious. You don't need to understand the math to use the tool."
```

**Key changes from LootMathDocs:**
1. Lead with simple explanations, not formulas
2. Use progressive disclosure for technical content
3. Add more examples with real numbers
4. Friendlier section titles
5. Remove redundant content (basics already in How-To)

### Acceptance Criteria

- [ ] Non-technical user can understand priority in first 3 sections
- [ ] Technical details preserved but in collapsible/final sections
- [ ] Includes concrete examples with numbers
- [ ] Page loads at `/docs/understanding-priority`
- [ ] Tone is explanatory, not academic

---

## Phase 4: Create FAQ Page

**Goal:** Consolidate scattered Q&A content into a searchable FAQ.

**Branch name:** `docs/faq-page`

### Files to Create

#### `frontend/src/pages/FAQDocs.tsx`

**New page consolidating Q&A from MembersGuideDocs and scattered InfoBoxes**

**Structure:**
```
1. Header
   - Title: "Frequently Asked Questions"
   - Subtitle: "Quick answers to common questions"

2. Optional: Search/filter input

3. Sidebar Navigation (NAV_GROUPS)
   - Getting Started
   - Gear & BiS
   - Loot & Priority
   - Permissions
   - Troubleshooting

4. Content (Q&A format)

   ## Getting Started
   
   ### What is XIV Raid Planner?
   A web app for tracking your static's gear progress and managing loot fairly.
   No spreadsheets required.
   
   ### Is it free?
   Yes, completely free. No ads, no premium tier.
   
   ### Do I need to create an account?
   You'll log in with Discord, but we only use it for authentication.
   We don't access your servers or messages.
   
   ### Can I be in multiple statics?
   Yes! Join as many as you want. Switch between them using the dropdown
   in the header.
   
   ## Gear & BiS
   
   ### What BiS sources are supported?
   XIVGear, Etro, and curated presets from The Balance.
   
   ### I don't have a custom BiS. What should I use?
   Use one of The Balance presets—they're solid starting points for any job.
   
   ### What if I switch jobs mid-tier?
   Update your job on your player card and re-import BiS for the new job.
   Your gear progress will reset for that card.
   
   ### What do the checkbox states mean?
   - Unchecked: Don't have it
   - Checked: Have the raid drop
   - For tome BiS: Half-check = have tome piece, full check = augmented
   
   ## Loot & Priority
   
   ### How is priority calculated?
   Based on your role, what gear you need, and what you've already received.
   See [Understanding Priority](/docs/understanding-priority) for details.
   
   ### The priority list said I should get an item, but my lead gave it to someone else?
   Priority is a suggestion, not a rule. Your lead has final say.
   Talk to them if you have concerns.
   
   ### How do weapons work differently?
   Weapons use a separate priority system. Main jobs get priority,
   then alts based on each player's weapon priority list.
   
   ### What are books/pages?
   Bad-luck protection. Earn books by clearing floors, exchange them for gear
   if drops don't go your way.
   
   ## Permissions
   
   ### What can members do vs leads?
   Members can edit their own card. Leads can edit anyone's card and log loot.
   See the [permissions table](/docs/how-to#permissions) for the full breakdown.
   
   ### How do I become a lead?
   Ask your static owner to promote you in Static Settings → Members.
   
   ### What's the difference between share codes and invite links?
   Share codes give read-only access (viewer). Invite links let people join
   as members or leads.
   
   ## Troubleshooting
   
   ### My BiS import isn't working
   Make sure you're using a valid XIVGear or Etro URL. The link should
   contain the gearset ID. Private/unlisted sets should still work.
   
   ### I can't edit my player card
   You need to claim the card first. Click on your card and look for the
   "Claim" button. If someone else claimed it, ask your lead to reassign.
   
   ### My gear progress looks wrong
   Check that your BiS is imported correctly. The app compares your checkboxes
   against your BiS to calculate progress.
   
   ### The page isn't loading / shows an error
   Try refreshing. If the problem persists, clear your browser cache or
   try a different browser. Still stuck? Report it in our Discord.
```

### Content Sources

Pull Q&A content from:
1. `MembersGuideDocs.tsx` - "Tips & FAQ" section (lines 531-586)
2. Various `InfoBox` components with question-like content
3. Common support questions (if you have access to these)

### Files to Modify

#### `frontend/src/App.tsx`

Add new route:
```tsx
<Route path="docs/faq" element={<FAQDocs />} />
```

### Acceptance Criteria

- [ ] All existing Q&A content consolidated
- [ ] Organized by topic category
- [ ] Each answer is 2-4 sentences max
- [ ] Links to detailed pages where appropriate
- [ ] Page loads at `/docs/faq`

---

## Phase 5: Simplify Docs Landing Page

**Goal:** Make the docs index page cleaner with clear paths for different user needs.

**Branch name:** `docs/landing-simplify`

### Files to Modify

#### `frontend/src/pages/DocsIndex.tsx`

**Simplify the current page**

**New Structure:**
```
1. Header (simplified)
   - Title: "Documentation"
   - Subtitle: "Everything you need to use XIV Raid Planner"

2. Primary Action Cards (large, prominent)
   
   [🚀 Quick Start]           [❓ FAQ]
   New here? Get set up       Got questions? We've
   in 5 minutes.              got answers.
   
3. Guide Cards (medium)
   
   [📋 How-To Guides]         [🎯 Understanding Priority]
   Step-by-step guides        How loot distribution
   for common tasks           works under the hood

4. Reference Section (smaller, grouped)
   
   For Developers
   - API Reference
   - API Cookbook
   
   Project Info
   - Release Notes
   - Roadmap
   - Design System

5. Remove or minimize:
   - Quick links bar (consolidate into cards)
   - Separate "User Docs" vs "Developer Docs" columns
   - Excessive section tags on cards
```

**Key changes:**
1. Fewer, larger action cards
2. Clear visual hierarchy
3. Quick Start and FAQ most prominent
4. Developer docs de-emphasized (still accessible)
5. Remove redundant quick links

### Acceptance Criteria

- [ ] Primary paths (Quick Start, FAQ) immediately visible
- [ ] No scrolling needed to see all main options
- [ ] Developer docs clearly separated but accessible
- [ ] Clean, uncluttered design
- [ ] All links work

---

## Phase 6: Deprecate Old Pages & Set Up Redirects

**Goal:** Remove old pages and redirect to new structure.

**Branch name:** `docs/cleanup-redirects`

### Files to Delete

After verifying all content has been migrated:

- [ ] `frontend/src/pages/QuickStartDocs.tsx` (replaced by QuickStartGuide)
- [ ] `frontend/src/pages/LeadsGuideDocs.tsx` (merged into QuickStartGuide)
- [ ] `frontend/src/pages/MembersGuideDocs.tsx` (merged into QuickStartGuide)
- [ ] `frontend/src/pages/CommonTasksDocs.tsx` (replaced by HowToDocs)
- [ ] `frontend/src/pages/LootMathDocs.tsx` (replaced by UnderstandingPriority)

### Files to Modify

#### `frontend/src/App.tsx`

Update routes with redirects:

```tsx
import { Navigate } from 'react-router-dom';

// New routes
<Route path="docs/quick-start" element={<QuickStartGuide />} />
<Route path="docs/how-to" element={<HowToDocs />} />
<Route path="docs/understanding-priority" element={<UnderstandingPriority />} />
<Route path="docs/faq" element={<FAQDocs />} />

// Redirects from old routes
<Route path="docs/getting-started" element={<Navigate to="/docs/quick-start" replace />} />
<Route path="docs/guides/leads" element={<Navigate to="/docs/quick-start" replace />} />
<Route path="docs/guides/members" element={<Navigate to="/docs/quick-start" replace />} />
<Route path="docs/guides/common-tasks" element={<Navigate to="/docs/how-to" replace />} />
<Route path="docs/loot-math" element={<Navigate to="/docs/understanding-priority" replace />} />
```

#### Update all internal links

Search for and update links in:
- All docs pages
- Any components that link to docs
- README.md if applicable

**Search patterns:**
```
/docs/getting-started → /docs/quick-start
/docs/guides/leads → /docs/quick-start
/docs/guides/members → /docs/quick-start  
/docs/guides/common-tasks → /docs/how-to
/docs/loot-math → /docs/understanding-priority
```

### Acceptance Criteria

- [ ] All old routes redirect correctly
- [ ] No 404s for old URLs
- [ ] All internal links updated
- [ ] Old files deleted
- [ ] No console warnings about removed components

---

## Phase 7 (Optional): Add Screenshots

**Goal:** Add visual aids to key documentation sections.

**Branch name:** `docs/screenshots`

### Screenshots Needed

| Location | Screenshot | Description |
|----------|------------|-------------|
| Quick Start | Login button | Header with login button highlighted |
| Quick Start | Create static wizard | Wizard dialog |
| Quick Start | Player card | Card with menu open |
| How-To | BiS import modal | Modal with URL input |
| How-To | Gear checkboxes | Different checkbox states |
| How-To | Quick Log modal | Modal with recipient selection |
| Understanding Priority | Loot Priority tab | Tab showing priority list |

### Implementation

1. Create `/public/docs/images/` directory
2. Add screenshots (PNG, ~800px wide max)
3. Create reusable `DocImage` component:

```tsx
function DocImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-6">
      <img
        src={src}
        alt={alt}
        className="rounded-lg border border-border-subtle w-full"
        loading="lazy"
      />
      {caption && (
        <figcaption className="mt-2 text-sm text-text-muted text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
```

4. Add images to relevant sections

### Acceptance Criteria

- [ ] Images load correctly
- [ ] Alt text provided for all images
- [ ] Images are appropriately sized (not huge files)
- [ ] Captions explain what user is seeing

---

## Dependency Graph

```
Phase 1 (Quick Start) ─────┐
                           │
Phase 2 (How-To) ──────────┼──→ Phase 5 (Landing) ──→ Phase 6 (Cleanup)
                           │
Phase 3 (Priority) ────────┤
                           │
Phase 4 (FAQ) ─────────────┘

Phase 7 (Screenshots) - Can be done anytime after Phase 1-4
```

**Recommended order:** 1 → 2 → 3 → 4 → 5 → 6 → 7

Phases 1-4 can technically be done in parallel, but doing them sequentially helps maintain consistency.

---

## Testing Checklist

After each phase, verify:

- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm lint` passes
- [ ] All new routes load correctly
- [ ] Sidebar navigation works
- [ ] Scroll tracking updates active section
- [ ] All internal links work
- [ ] No console errors
- [ ] Mobile responsive layout works
- [ ] Breadcrumbs show correct path

---

## Notes for Claude Code

1. **Reference the style guide** (`DOCS_STYLE_GUIDE.md`) for tone and formatting
2. **One phase per PR** - Don't combine phases
3. **Test navigation** - Sidebar and scroll tracking are finicky
4. **Preserve components** - Reuse existing `Section`, `Step`, `InfoBox` components
5. **Check imports** - Make sure all Lucide icons are imported
6. **Update App.tsx** - Don't forget to add routes
7. **Redirects last** - Only set up redirects in Phase 6 after content is ready
