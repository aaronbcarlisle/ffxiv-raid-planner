# XIV Raid Planner Documentation Style Guide

This guide defines the tone, voice, and formatting standards for all user-facing documentation. Reference this when writing or editing docs.

---

## Voice & Tone

### Core Principles

1. **Friendly, not corporate** — You're helping a fellow raider, not writing enterprise software docs
2. **Confident, not condescending** — Assume users are smart but new to YOUR tool
3. **Concise, not terse** — Be brief but don't sacrifice clarity for brevity
4. **Fun, not forced** — Personality is good; trying too hard is cringe

### The XIV Raid Planner Voice

Imagine you're a helpful static member explaining the tool to a new recruit in Discord. You're:
- Knowledgeable but approachable
- Efficient with their time
- Genuinely want them to succeed
- Comfortable with FFXIV terminology

### Do's and Don'ts

| ✅ Do | ❌ Don't |
|-------|----------|
| Use "you" and "your" | Use "the user" or "one" |
| Write in present tense | Write in future tense ("will be displayed") |
| Use contractions (you'll, it's, don't) | Write formally (you will, it is, do not) |
| Use active voice | Use passive voice |
| Explain OUR jargon | Explain FFXIV jargon (BiS, savage, etc.) |
| Be direct | Hedge excessively ("perhaps", "might want to") |

### Gaming-Appropriate Language

**Acceptable gaming terms (no explanation needed):**
- BiS, savage, tome/tomestone, augmented
- Static, raid tier, floor (M9S, M10S, etc.)
- Job names (WAR, WHM, BLM, etc.)
- Role names (tank, healer, melee, ranged, caster)
- Books/pages (the exchange currency)

**Our terms that DO need brief explanation on first use:**
- Player card (the UI element representing a player)
- Loot priority (our calculation system)
- Weapon priority list (the ordered job list for weapons)
- Share code (the read-only access code)

---

## Tone Examples

### Section Introductions

**❌ Too formal:**
> "The loot priority system calculates who should get each drop based on role and need. Priority is calculated from role weight combined with need score."

**❌ Too casual:**
> "So like, the loot system figures out who gets stuff lol. It's pretty smart!"

**✅ Just right:**
> "Loot priority helps your static decide who gets each drop—fairly and transparently. It factors in your role, what you still need, and what you've already picked up."

### Step Instructions

**❌ Too verbose:**
> "Navigate to the player card interface element and locate the three-dot menu icon (⋮) positioned in the upper right corner of the card. Click on this icon to reveal the context menu, then select the 'Import BiS' option from the available menu items."

**❌ Too terse:**
> "Menu → Import BiS"

**✅ Just right:**
> "Right-click your player card (or tap the ⋮ menu) and select **Import BiS**."

### Explaining Concepts

**❌ Too technical:**
> "Priority Score = (5 - roleIndex) × 25 + Σ(slotWeight × !isComplete) - (lootReceived × 15)"

**✅ Just right:**
> "Your priority score is based on three things:
> - **Role bonus** — Determined by your static's role priority order
> - **Gear need** — Higher if you're missing valuable slots
> - **Loot received** — Goes down a bit each time you get a drop"

### Error States & Edge Cases

**❌ Too alarming:**
> "WARNING: If you do not import BiS data, the priority calculations will be incorrect and loot distribution may be unfair."

**✅ Just right:**
> "**Heads up:** Priority works best when everyone has their BiS imported. Without it, we can't tell what gear you actually need."

---

## Formatting Standards

### Headings

```markdown
# Page Title (H1) — One per page only

## Major Section (H2) — Primary content divisions

### Subsection (H3) — Within a major section

#### Detail Header (H4) — Rarely needed, use sparingly
```

**Heading style:**
- Use sentence case ("Import your BiS set" not "Import Your BiS Set")
- Be descriptive ("Track your gear progress" not "Gear Tracking")
- Keep under 6 words when possible

### Paragraphs

- **Maximum 3 sentences per paragraph**
- **Maximum 25 words per sentence** (aim for 15-20)
- One idea per paragraph
- Use line breaks between paragraphs

### Lists

**Use bullet lists for:**
- Features or options (unordered)
- Requirements (unordered)
- Quick reference items (unordered)

**Use numbered lists for:**
- Sequential steps (must be done in order)
- Ranked items (priority matters)

**List item style:**
- Start with capital letter
- No period at end (unless full sentences)
- Parallel structure (all start with verbs, or all are nouns)

### Steps/Instructions

Use the existing `Step` component pattern:

```tsx
<Step number={1} title="Open the import modal">
  <p>Right-click your player card and select <strong>Import BiS</strong>.</p>
</Step>
```

**Step guidelines:**
- Keep title under 8 words
- Description should be 1-2 sentences
- Use `<strong>` for UI elements they need to find/click
- Include keyboard shortcuts in parentheses if available

### Callout Boxes

Use the existing `InfoBox` component:

```tsx
<InfoBox type="tip" title="Pro tip">
  You can Shift+click the share code to copy a tier-specific URL.
</InfoBox>
```

**When to use each type:**

| Type | Use For | Example |
|------|---------|---------|
| `tip` | Helpful shortcuts, best practices | "Keyboard shortcut: Press ? for all shortcuts" |
| `info` | Additional context, clarifications | "Your lead can also do this for you" |
| `warning` | Gotchas, important caveats | "This action cannot be undone" |

**Callout guidelines:**
- One callout per section maximum
- Title is optional but helps scannability
- Keep content under 3 sentences

### Links

**Internal links:**
```tsx
<Link to="/docs/how-to#bis-import">Import BiS guide</Link>
```

**External links:**
```tsx
<a href="https://xivgear.app" target="_blank" rel="noopener noreferrer">
  XIVGear <ExternalLink className="w-3 h-3 inline" />
</a>
```

**Link text guidelines:**
- Descriptive text ("Import BiS guide" not "click here")
- Include external icon for outside links
- Use relative paths for internal links

### Code/Technical Content

For keyboard shortcuts:
```tsx
<kbd className="px-1.5 py-0.5 text-xs bg-surface-elevated border border-border-default rounded">?</kbd>
```

For technical terms inline:
```tsx
<code className="text-accent">slotWeight</code>
```

For code blocks (API docs, formulas):
```tsx
<CodeBlock code={`const priority = roleBonus + needScore - lootPenalty;`} />
```

### Tables

Use tables for:
- Permission matrices
- Reference data (costs, weights)
- Feature comparisons

Keep tables simple:
- Maximum 4-5 columns
- Left-align text, right-align numbers
- Use consistent column widths

---

## Content Structure

### Page Template

Every documentation page should follow this structure:

```
1. Header
   - Breadcrumb navigation
   - Page title (H1)
   - One-sentence description

2. Quick Summary (optional)
   - TL;DR for scanners
   - Jump links to sections

3. Main Content
   - Organized by user task/intent
   - Progressive disclosure (simple → complex)
   - Visual aids where helpful

4. Related Links (optional)
   - "Next steps" or "Learn more"
   - Max 3-4 links
```

### Section Length Guidelines

| Content Type | Target Length |
|--------------|---------------|
| Page intro | 2-3 sentences |
| Section intro | 1-2 sentences |
| Step description | 1-2 sentences |
| Callout content | 1-3 sentences |
| FAQ answer | 2-4 sentences |

### Progressive Disclosure

Always lead with the simple version. Hide complexity:

```tsx
// Good: Simple first, details expandable
<p>Priority helps decide who gets loot. Higher score = higher priority.</p>

<details>
  <summary>See the full formula</summary>
  <p>Priority = roleBonus + needScore - lootPenalty</p>
  {/* Technical details here */}
</details>
```

---

## FFXIV-Specific Terminology

### Capitalize These
- Job names: Warrior, White Mage, Black Mage (or abbreviations: WAR, WHM, BLM)
- Role names when specific: Tank, Healer, Melee DPS
- Proper nouns: The Balance, Lodestone, XIVGear, Etro

### Don't Capitalize These
- Generic references: "your static", "the raid tier", "savage drops"
- Our feature names: "loot priority", "weapon priority", "player card"
- Actions: "import BiS", "log loot", "mark cleared"

### Abbreviations

Always acceptable without definition:
- BiS (Best-in-Slot)
- iLv / ilvl (item level)
- DPS, DoT, HoT
- M9S, M10S, M11S, M12S (floor abbreviations)

Define on first use:
- Aug (augmented) — "augmented (aug) tomestone gear"

---

## Component Usage Reference

### Available Components

```tsx
// Section header with anchor
<Section id="section-id" title="Section Title">

// Subsection within a section
<Subsection title="Subsection Title">

// Numbered step
<Step number={1} title="Step title">

// Callout boxes
<InfoBox type="tip|info|warning" title="Optional Title">

// Link to internal page
<Link to="/docs/page#section">

// Link card for navigation
<LinkCard href="/docs/page" title="Title" description="Description" />

// Permission badge
<PermissionBadge allowed={true|false} />

// Formula display (Loot Math page)
<FormulaBlock formula="x = y + z" description="What this means" />

// Code display
<CodeBlock code={`const x = 1;`} />
```

### Navigation Sidebar

Each page with sections should define:

```tsx
const NAV_GROUPS = [
  {
    label: 'Group Label',
    items: [
      { id: 'section-id', label: 'Display Label' },
    ],
  },
];
```

Keep navigation groups to 3-4 max, with 2-4 items each.

---

## Quality Checklist

Before considering documentation complete, verify:

### Content
- [ ] Answers "How do I...?" questions
- [ ] No unexplained jargon (our jargon, not FFXIV's)
- [ ] Steps are testable/verifiable
- [ ] No duplicate content (link instead)

### Tone
- [ ] Uses "you/your" consistently
- [ ] No passive voice
- [ ] Contractions used naturally
- [ ] Friendly but not unprofessional

### Structure
- [ ] Paragraphs ≤ 3 sentences
- [ ] Sentences ≤ 25 words (target 15-20)
- [ ] One H1 per page
- [ ] Logical heading hierarchy

### Formatting
- [ ] UI elements in `<strong>` tags
- [ ] Keyboard shortcuts in `<kbd>` tags
- [ ] External links have icon
- [ ] Tables have consistent alignment

### Accessibility
- [ ] Images have alt text
- [ ] Links have descriptive text
- [ ] Color is not only indicator
- [ ] Headings used for structure (not styling)

---

## File Naming Conventions

```
/frontend/src/pages/
├── DocsIndex.tsx          # Landing page
├── QuickStartGuide.tsx    # Unified getting started
├── HowToDocs.tsx          # Task-based guides
├── UnderstandingPriority.tsx  # Priority system explained
├── FAQDocs.tsx            # Consolidated FAQ
├── ApiDocs.tsx            # API reference (unchanged)
├── RoadmapDocs.tsx        # Roadmap (unchanged)
└── ReleaseNotes.tsx       # Release notes (unchanged)
```

Route naming: `/docs/kebab-case`
- `/docs/quick-start`
- `/docs/how-to`
- `/docs/understanding-priority`
- `/docs/faq`
