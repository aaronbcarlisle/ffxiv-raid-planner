# Documentation Pages Implementation Plan

Create 3 new React documentation pages matching the existing Design System page style.

## Summary

| Page | Route | Status in DocsIndex |
|------|-------|---------------------|
| Loot & Priority Math | `/docs/loot-math` | Already listed as "coming-soon" |
| API Reference | `/docs/api` | Already listed as "coming-soon" |
| Getting Started | `/docs/getting-started` | **New entry needed** |

---

## Files to Create

```
frontend/src/pages/
├── LootMathDocs.tsx        # ~600-800 lines
├── ApiDocs.tsx             # ~800-1000 lines
└── GettingStartedDocs.tsx  # ~500-700 lines
```

## Files to Modify

- `frontend/src/App.tsx` - Add 3 lazy imports and routes
- `frontend/src/pages/DocsIndex.tsx` - Update statuses, add Getting Started entry

---

## Page 1: Loot & Priority Math (`/docs/loot-math`)

### Navigation Structure

**Concepts**
- How Priority Works (overview)
- Role Priority
- Slot Value Weights

**Gear Priority**
- Gear Priority Scoring
- Loot Adjustments
- Material Priority (Twine/Glaze/Solvent)

**Weapon Priority**
- Weapon Priority System
- Main Job Bonus
- Off-Job Weapons

**Advanced**
- Book/Page Economy
- Mid-Tier Roster Changes

**Technical Reference**
- Formulas & Code
- Reference Tables

### Key Content

**Conceptual Section** (for end users):
- "Priority ensures fair loot distribution across your static"
- Role priority: DPS tends to benefit more from gear (customizable per static)
- Higher-value slots (weapon, body, legs) weighted more heavily

**Technical Appendix** (for power users):
```
Priority Score = Role Priority + (Weighted Need × 10) - (Loot Adjustment × 15)

Role Priority = (5 - roleIndex) × 25
  - Default order: melee > ranged > caster > tank > healer
  - Scores: 125, 100, 75, 50, 25

Slot Weights:
  - Weapon: 3.0
  - Body/Legs: 1.5 each
  - Head/Hands/Feet: 1.0 each
  - Accessories: 0.8 each

Weapon Priority Score = Role × 100 + (1000 - Rank × 100) + Main Job Bonus (2000)
```

### Source Files to Reference
- `frontend/src/utils/priority.ts:37-59` - `calculatePriorityScore()`
- `frontend/src/utils/weaponPriority.ts:31-126` - `getWeaponPriorityForJob()`
- `frontend/src/gamedata/costs.ts:104-116` - `SLOT_VALUE_WEIGHTS`

---

## Page 2: API Reference (`/docs/api`)

### Navigation Structure

**Getting Started**
- Overview
- Authentication
- Error Handling

**Auth Endpoints**
- Discord OAuth
- Token Management

**Static Groups**
- CRUD Operations
- Membership

**Tier Snapshots**
- CRUD Operations
- Rollover

**Players**
- CRUD Operations
- Claim/Release
- Gear Updates

**Loot Tracking**
- Loot Log
- Page Ledger
- Material Log

**BiS Import**
- Presets
- XIVGear/Etro Import

**Invitations**
- Create & Accept

### Component Pattern

Create an `EndpointCard` component for consistent API documentation:

```tsx
<EndpointCard
  method="GET"
  path="/api/static-groups/{id}"
  description="Get a static group by ID"
  auth={true}
  response={`{
    id: string,
    name: string,
    shareCode: string,
    ...
  }`}
/>
```

Method color coding:
- GET: blue
- POST: green
- PUT: amber
- DELETE: red

### Key Endpoints to Document

**Auth** (5 endpoints)
- `GET /api/auth/discord` - Get OAuth URL
- `POST /api/auth/discord/callback` - Handle callback
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

**Static Groups** (8 endpoints)
- CRUD, membership, transfer ownership

**Tiers** (6 endpoints)
- CRUD, rollover

**Players** (5 endpoints)
- CRUD, claim/release

**Loot Tracking** (10+ endpoints)
- Loot log, page ledger, material log, balances

**BiS Import** (3 endpoints)
- Presets, XIVGear, Etro

**Invitations** (5 endpoints)
- Create, list, accept, revoke

---

## Page 3: Getting Started (`/docs/getting-started`)

### Navigation Structure

**First Steps**
- Welcome
- Logging In

**Managing Your Static**
- Creating a Static
- Joining a Static
- Inviting Members
- Roles & Permissions

**Setting Up a Tier**
- Creating a Tier
- Adding Players
- Importing BiS

**Tracking Gear**
- Gear Checkboxes
- Current vs BiS
- iLv Tracking

**Loot Distribution**
- Priority Basics
- Logging Loot
- Quick Log Modal

**Book & Page Tracking**
- Marking Floor Clears
- Page Balances

### Content Style

User-friendly, action-oriented language:
- "Click the **Login with Discord** button..."
- "Navigate to **Dashboard** and select **Create Static**..."
- Step-by-step walkthroughs

### Key Workflows to Document

1. **New User Flow**: Login → Join static via invite → Claim player card → Import BiS
2. **Static Lead Flow**: Create static → Create tier → Add players → Invite members
3. **Weekly Raid Flow**: Log loot → Mark floor clears → Track page balances

---

## Implementation Steps

### Step 1: Update App.tsx Routes

Add after line 17:
```tsx
const LootMathDocs = lazy(() => import('./pages/LootMathDocs'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const GettingStartedDocs = lazy(() => import('./pages/GettingStartedDocs'));
```

Add routes after line 60:
```tsx
<Route path="docs/loot-math" element={<LootMathDocs />} />
<Route path="docs/api" element={<ApiDocs />} />
<Route path="docs/getting-started" element={<GettingStartedDocs />} />
```

### Step 2: Update DocsIndex.tsx

1. Change `loot-math` status from `'coming-soon'` to `'available'`
2. Change `api-docs` status from `'coming-soon'` to `'available'`
3. Replace "Data Models" entry with "Getting Started" entry:
```tsx
{
  id: 'getting-started',
  title: 'Getting Started',
  description: 'User guide for setting up your static, tracking gear, and distributing loot.',
  icon: BookOpen,
  href: '/docs/getting-started',
  status: 'available',
  sections: [
    'Login & Account Setup',
    'Creating/Joining a Static',
    'Setting Up Tiers',
    'Importing BiS',
    'Tracking Gear Progress',
    'Loot Distribution',
  ],
}
```

### Step 3: Create LootMathDocs.tsx

Follow DesignSystem.tsx pattern:
1. Define `NAV_GROUPS` with sections listed above
2. Create `Section` and `Subsection` components (or extract shared)
3. Implement `NavSidebar` with scroll tracking
4. Write content for each section
5. Add `FormulaBlock` component for formulas

### Step 4: Create ApiDocs.tsx

1. Define `NAV_GROUPS` for API categories
2. Create `EndpointCard` component
3. Document each endpoint with method, path, description
4. Include request/response JSON examples
5. Add code blocks for auth headers

### Step 5: Create GettingStartedDocs.tsx

1. Define `NAV_GROUPS` for user guide sections
2. Write friendly, step-by-step content
3. Use numbered lists for sequential steps
4. Cross-link to other doc pages where relevant

---

## Verification

After implementation:
1. Navigate to `/docs` - all 4 cards should be "Available"
2. Test each page loads correctly
3. Verify sidebar navigation and scroll tracking works
4. Check mobile responsiveness
5. Verify links between doc pages work
6. Run `pnpm tsc --noEmit` to check for type errors
7. Run `pnpm lint` to check for lint errors
