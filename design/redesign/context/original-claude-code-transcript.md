# XIV Raid Planner — Full Redesign Brainstorm (Recovered Transcript)

> **What this is.** The complete, recovered transcript of the Claude Code session you lost to an accidental `/clear`. Reconstructed directly from the session's on-disk JSONL log (`856b0e80-….jsonl`, one session, 2,632 records). This is the *real* conversation — not the observer-log paraphrase.
>
> **Session:** 2026-06-27, **11:10 → 14:32** · model `claude-sonnet-4-5` · Claude Code SDK v2.1.195
> **Project:** `D:\\FFXIV\\Dev\\xrp-dev\\ffxiv-raid-planner`
>
> **How to read it.** Your turns are marked **🧑 Aaron**; Claude's are **🤖 Claude**. Substantive design responses are reproduced verbatim. Long sequences of tool calls (screenshots, file reads, seeding, git) are collapsed into short *working notes* in italics so the intellectual thread stays readable. The `[SKILL INJECTION]` marker is where the *brainstorming* skill loaded (10k-char body omitted).


---

## Phase 1 — Cataloguing the existing UI (11:10–11:56)

_Goal: screenshot every page, tab, and modal of the live app to build an audit reference._

**🧑 Aaron:**

Go through every single page, tab, modal, window, etc for the app running on this url: http://localhost:5174/ and take a screen shot of the page in the browser and save the screen shot of each page, element, modal, etc inside this folder: D:\FFXIV\Dev\xrp-dev\ffxiv-raid-planner\design\app-ui-reference

Be as thorough as possible. If you need to create local mock data so pages and sections show all of the different ui elements/views, feel free. 

This is to catalog the UI/UX of all the pages and UI elements, windows etc of the app. This will help audit and identify how to better simplify and make the app more robust and intuitive to use. Currently, it's a gian mess and workflows and features are all over the place without any clear workflow/design language. 

I currently have another claude session working through the huge refactor/polish of the entire app. This is another piece of that puzzle.

_🤖 Claude (working): I'll tackle this systematically. This is a thorough UI cataloging task. Let me start by recalling my established browser workflow for this app and understanding its route structure. This is a large app. Let me find the route definitions to map out all the top-level pages, and check the target folder._

**🤖 Claude:**

The folder exists and is empty. I have the full route map. The `GroupView` (`/group/:shareCode`) is the heavyweight with many tabs/modals/panels. Let me confirm the dev server is up and load the browser tooling.

_🤖 Claude (working): Server is up, and `take_screenshot` supports `filePath`. Now let me establish the browser session, log in via dev-auth (owner), and set a wide viewport for the 120rem layout. A browser is already running. Let me connect to it via list_pages._

**🤖 Claude:**

The chrome-devtools-mcp profile is locked by another running browser (likely the other refactor session). I'll switch to the claude-in-chrome extension, which drives your actual Chrome. Let me load those tools and check tab context.

_🧑 Aaron — [interrupted the previous response]_

**🧑 Aaron:**

I just opened a chrome window for you to use called: XIV Raid Planner UI Catalog Window

_🤖 Claude (working): Let me load the claude-in-chrome tools and find your window. The claude-in-chrome extension isn't connected. Let me retry chrome-devtools-mcp now that you've opened a window — it may attach to it. Still locked by the other session's browser — I won't kill that. I'll use the Playwright MCP instead, which launches its own isolated browser and won't conflict. Let me load those tools. Playwright is loaded. Let me establish the pipeline: log in via dev-auth, set a wide viewport, and verify I can save a screenshot to the target folder. Login endpoint hit. Playwright saves to `.playwright-mcp/` relative to cwd. Let me verify auth worked and check what data exists by loading the dashboard. Auth works — I'm DevOwner, owner of "Dev Test Static" (DEVTST). Let me check whether the tier/roster is still seeded. One tier, zero players — the roster needs reseeding. Let me inspect the tier structure and the player-creation contract so I can seed a rich, varied roster._

**🤖 Claude:**

The roster IS seeded (8 configured players) — the list endpoint just omits players. They have no gear/BiS progress though. For a rich catalog I'll enrich a few players (gear progress, BiS links, a substitute, an unconfigured one) and seed some loot history. Let me get the player list and CSRF token.

**🤖 Claude:**

I have all 8 players + CSRF. Now let me seed varied gear/BiS/progress states across the roster so the cards, gear tables, and priority views show their full range. I'll create a task list to track the catalog sweep, then run the seed.

_🤖 Claude (working): Now seeding. Let me mark the task in progress and run a seed script that enriches all 8 players with varied gear/BiS states plus a substitute and a fresh player. All 8 players enriched. Now let me seed loot history. Let me check the loot-log POST contract from the store. Let me find the loot/material entry payload types so I seed valid entries. Floors are strings like "M9S". Let me grab the method/material enums and floor list, then seed loot + material entries across two weeks. Now seeding loot + material history across two weeks. The browser page closed (it was still sitting on the login JSON endpoint). Let me re-open the app and retry the seed._

_🧑 Aaron — [interrupted the previous response]_

**🧑 Aaron:**

the window you just launched has the light them on, toggle it to dark before taking screenshots

_🤖 Claude (working): Good catch. Let me switch to dark theme via localStorage and reload. The theme uses a `data-theme` attribute. Let me check the exact localStorage key `useTheme` reads. `theme` key is correct — I've set it to dark. Let me reload and verify the dark theme applied. Dark theme confirmed, and demo data is seeded. Let me mark seeding done and create organized subfolders for the catalog. Let me verify the page renders correctly (dark theme + seeded roster) with one inline screenshot before committing to the file-saving sweep._

**🤖 Claude:**

Dark theme is applied and the seeded roster renders beautifully — gear states, party grouping, substitute, and a fresh card all show. Now let me confirm absolute-path saving works and learn the GroupView tab keys for URL-driven navigation.

_🤖 Claude (working): The GroupView nav was recently redesigned. Let me find the sidebar nav config to get exact tab keys._

**🤖 Claude:**

No matches — the live dev server is serving the **other session's refactor branch**, not my working tree. That's fine; I'll catalog what's live and drive navigation through the DOM. Let me extract the sidebar nav targets directly from the page.

**🤖 Claude:**

Now I have the full nav map. Left rail: Overview, Schedule, Roster, Tracking, Loot Log, Plugin, More. Roster sub-tabs: Members, Characters, Split Planner. Settings tabs: General, Static, Priority, Goals & Farms, Recruitment. Let me start the GroupView sweep — first verify absolute-path saving works with the current roster (Members/grid).

_🤖 Claude (working): Absolute path resolved correctly into the target folder. Now I'll sweep the left-rail tabs. Let me click **Overview** and capture it. Let me continue through the rail tabs — Schedule next. Tracking next. Loot Log next. Let me view the Loot Log page to understand its sub-views before capturing variants. The "Loot Log" section has 4 sub-tabs: Log, Priority, Sync, Summary (currently on Sync). Let me capture each. First, Log. Log sub-tab shows the weekly grid with seeded drops + books ledger. Let me capture the List and All Weeks variants, then Priority and Summary sub-tabs. Now All Weeks view. Now Priority sub-tab. Priority has its own sub-tabs: Gear Priority, Weapon Priority, Who Needs It (+ floor selector). Let me capture Weapon Priority and Who Needs It. Now the Summary sub-tab (Team Summary). Now the Plugin tab. Now the "More" nav item — let me see what it reveals. "More" is a hub page (Tools & Management, Data & History, Danger Zone). Let me save it full-page. Now back to Roster for its sub-views (list view, Characters, Split Planner). Let me find the grid/list view toggle controls. Let me capture the **Characters** roster sub-tab. Now Split Planner. GroupView main tabs are captured. Let me check whether Schedule has sub-views (sessions vs availability) before moving on. Schedule has Upcoming/Calendar sub-views. Let me capture the Calendar view. Main GroupView tabs are well covered. Let me move to modals/panels. Marking task 4 done, starting task 5 with the Settings slide-out panel. Settings slide-out panel opened with tabs: General, Static, Priority, Goals & Farms, Recruitment, Members. Let me capture each. First, General. Settings panel fully captured. Let me close it and capture the action modals. Starting with the Tier actions menu and the Add Player flow. Let me go to Roster first. Now let me open the **Add Player** modal. Add Player modal captured. (Settings panel is still docked on the right — I'll close it after.) Saving this modal. Let me close the modal and the settings panel for clean subsequent captures. Now the **Player options menu** (per-card context menu). Excellent — the full player context menu (BiS & Gear / Loot Priority / Clipboard / Player Management). Saving it. Now let me open the sub-modals. First **Update BiS** (import modal). BiS import modal confirmed. Let me cancel, reopen the menu, and capture **Weapon Priorities**. Now **Adjust Priority**. Now **BiS Target Sets**. Now **Edit Books**. That's still the BiS Targets modal (its close is an X, so my text-based close missed). Let me switch to Escape-based closing, which is more reliable. Now reopen the menu and capture **Edit Books**. Now **Edit Flex roles**. Now **Assign User**. Now **Reset Gear**. Now the **Tier actions menu** (top bar). The menu didn't open via JS click (likely pointer-event driven). Let me use a real Playwright click. The tier actions menu (Create New Tier, Copy to New Tier, Delete Tier). Saving, then I'll open Create New Tier. Now the **Invite** modal. "Invite" opens the Settings → Recruitment → Invitations panel (sub-tabs: Overview, Listing, Requests, Invitations). Saving. Now the loot logging modals. Let me close the panel, go to Loot Log → Log, and open **Log Loot**. The Log Loot Drop modal (with priority recommendation panel). Saving. Now **Log Material**. Now the **Log Week wizard** (multi-step). The Log Week wizard, step 1 (Gear Drops). Let me capture all 3 steps. Captured all 3 wizard steps. Let me cancel out (not submit) and capture the **Mark Floor Cleared** modal. Now the **User menu**. The radix user-menu needs a real pointer event. Let me click the visible one with Playwright's `:visible` selector. User menu (My Statics, Player Hub, Documentation, API Keys, notifications, Dark Mode, Anonymous activity, Logout). Saving. Let me capture the **Switch static** menu and the **Delete Tier** modal, then wrap this section. Delete Tier is disabled ("Cannot delete the last tier") — expected with one tier. Let me grab the keyboard-shortcuts overlay, then move on. The keyboard shortcuts overlay (full reference). Saving — this completes the GroupView modal set. GroupView modals are thoroughly captured (28 shots). Let me close this and move to the top-level pages. Let me verify by listing what's saved so far._

**🤖 Claude:**

Yes — confirmed. **45 screenshots saved so far** (9.6 MB) in `design/app-ui-reference/`, all in dark theme:

- **`03-groupview-tabs/`** (17): Roster (members/characters/split-planner), Overview, Schedule (+calendar), Tracking, Loot Log (grid/list/all-weeks), Priority (gear/weapon/who-needs-it), Sync, Team Summary, Plugin, More hub.
- **`04-groupview-modals/`** (28): all 6 Settings tabs, Add Player, the full player context menu + its sub-modals (BiS import, weapon priorities, adjust priority, BiS targets, edit books, flex roles, assign user, reset gear), tier actions menu + create tier, recruitment/invitations, log loot/material, the 3-step Log Week wizard, mark floor cleared, user menu, switch-static menu, keyboard shortcuts.

Still to do: top-level pages (Dashboard, Discover, Player Hub/Profile), Docs + Design System, Admin, and the empty `01-public-auth/`/`02-top-level/` folders. Continuing now.

_🤖 Claude (working): Now the top-level pages. Starting with the **Player Hub / Profile**. Player Hub with its own nav (Overview, Sync & Gear, Jobs & Gear, Tracking, Availability, Share, My Statics). Let me capture each. Now the **Static Finder** (Discover) page. Now the **Dashboard**. Dashboard = "My Statics". Let me capture the **Create Static wizard** (4-step SetupWizard). Create Static wizard, step 1 (Details). Let me fill a name and advance to capture steps 2-3. Steps 1-3 of the Create Static wizard captured (I won't submit step 3). Let me close it and move to Docs + Design System. Now the Docs sweep. Starting with the docs index. Now the **Design System** reference page (into folder 06). Let me check the design system page structure for any tabs/sections. The design system is one long reference page — the full-page capture covers all sections. Docs section complete. Moving to Admin + misc. Admin redirected to dashboard — DevOwner isn't an admin. Let me check the dev-auth setup for an admin user or how admin is granted. The backend dev-auth lives on the other branch. Let me probe whether dev users 1 or 2 are admins (via fetch, which is how dev-login sets cookies)._

**🤖 Claude:**

None of the dev users are admin. To catalog the admin dashboard, I'll grant admin to the dev test user in the local dev DB (consistent with "create local mock data"). Let me find the DB connection string.

_🤖 Claude (working): It's SQLite. Let me grant admin to the dev owner in the DB. Admin granted. Let me refresh the session and load the admin overview. Admin access works now. Capturing the admin pages. Admin done. Now the misc routes. Let me capture **plugin-auth**. Let me create a real invitation code (to show the proper invite-accept UI later), then capture the invite page. Invite code `ADHZ47F4` created. Let me capture the invite-accept page. Task 7 done. Now the public/logged-out pages. Let me mark task 7 complete, log out, and capture the landing/login state. Logged out. Let me clear persisted auth state (keeping dark theme) and load the landing page. The logged-out landing/login page. Saving. Now the logged-out **public static viewer** (DEVTST is public — read-only mode). Public viewer with the "Log in to send a request" banner. Now the logged-out **invite-accept** page. Let me capture the logged-out **Static Finder** (public discovery), then wrap up. All areas captured. Now cleanup: revert the temporary admin grant and log back in as the owner so the window is left usable. Logged back in as owner. Let me do a final inventory and clean up Playwright's temp artifacts from the repo root. 79 screenshots, 15 MB. The `.playwright-mcp` temp dir isn't gitignored — let me remove that clutter from the repo root. All 79 screenshots are saved and the temp dir is cleaned. Let me add an index README so the catalog is navigable for the audit._

**🤖 Claude:**

Done. The full UI catalog is saved to `design/app-ui-reference/` — **79 dark-theme screenshots** plus a `README.md` index.

## What was captured

| Folder | Count | Coverage |
|---|---|---|
| `01-public-auth/` | 4 | Landing/login, public read-only static viewer, invite-accept (logged out), public Static Finder |
| `02-top-level/` | 12 | Player Hub (7 sub-views), Dashboard, Static Finder, Create Static wizard (3 steps) |
| `03-groupview-tabs/` | 17 | Every rail tab + sub-tab: Roster (members/characters/split-planner), Overview, Schedule (+calendar), Tracking, Loot Log (grid/list/all-weeks), Priority (gear/weapon/who-needs-it), Sync, Team Summary, Plugin, More |
| `04-groupview-modals/` | 28 | All 6 Settings tabs, Add Player, full player context menu + its 8 sub-modals, tier actions + create tier, invitations, log loot/material, 3-step Log Week wizard, mark-floor-cleared, user menu, switch-static, keyboard shortcuts |
| `05-docs/` | 11 | All documentation pages |
| `06-design-system/` | 1 | Full design-system reference (one long page) |
| `07-admin-misc/` | 6 | Admin Overview/Statics/Usage/Errors, plugin-auth, invite-accept |

## How it was done
- The live dev server is running the **other session's refactor branch**, so the catalog reflects that in-progress UI (newer rail nav: Overview/Tracking/Loot Log/More).
- Used the **Playwright MCP** (own isolated browser) since the chrome-devtools-mcp profile was locked by the other session — no interference.
- Logged in via dev-auth and **seeded `DEVTST`** with a varied 8-player roster (full BiS, partial, off-BiS, substitute, fresh), 2 weeks of loot/material history, and an invitation so every UI state renders meaningfully.

## Cleanup / things to know
- Temporarily granted admin to the dev user to capture the admin pages, then **reverted it** (back to `is_admin=0`).
- Logged the window back in as **Dev Owner** and left it on the group view — usable.
- Removed Playwright's `.playwright-mcp` temp dir from the repo root.
- The seeded roster/loot/invite data was **left in place** (useful for the ongoing refactor; say the word if you want it wiped).

One gap worth noting: the **public profile** (`/profile/:shareCode`) and **Delete Tier** modal weren't captured — the dev profile isn't shared and Delete Tier is disabled with only one tier. I can seed those states if you want them too.


---

## Phase 2 — UX research, audit & the structural fork (12:39–12:54)

_Goal: research UX principles, audit the catalogued UI, diagnose what's broken, and pick a navigation backbone._

**🧑 Aaron:**

Now that we have a catalog. Research UX development and learn the principles behind robust, userfriendly UX development. Determine what makes an app easy to use, what foundational rules and design should be followed. Then do a comprehensive audit of the UI using the catalog + code base and determine how we can simplify, cleanup, polish and create/update the app so that it's flow and use is fun, simple, easy, convenient and scalable. Identify critical design and layout issues within the app and create a UX/UI visual plan on the design and flow of the app. Each page, each element each design choice should have a reason and it should compliment the overall goal of the app and it's user base. 

Identify any plugins, tools, etc you can use to create a visual mockup of the redesign, restructure of the site. This can be as exstensive as needed. It could be from the ground up if that makes sense.

A couple things to consider. Having a flexible and scalable backend is super important. Simplicity in development and development designed in a way that allows other contributors to easily jump and add new features and updates. The front-end needs to prioritize the user base, but pair with the backend in a seemless way. Updating a section in one UI element, just to realize there's 6 other UI elements that need the update is kinda how we got here in the first place. There shouldn't be 10 ways to navigate to the roster page or 16 ways to log loot (being sarcastic). It should be intuitive enough for any user to be able to get started and getting value out of the app as well as powerful enough for users to grow in preficiency of mastering the app by learning optimal/fast ways for using the app e.g., shortcuts, advanced features, etc. 

The design-system is a great start already. 

When considering the redesign, evaluate the work being done in the UI/UX overhaul. Your primary focus is to supply a visual mockup that thoroughly tells a story of the app and how to use it. The visual language, the flow of the site, etc.

Does tha make sense?

**🤖 Claude:**

This is exactly the kind of work to approach deliberately — it's a redesign with a huge solution space, and getting the direction right before producing mockups matters. Let me start with the brainstorming skill, which is the right process for creative/design work before implementation.

_⚙️ invoked the *brainstorming* skill — 10k-char skill body omitted_

**🤖 Claude:**

This makes complete sense. Before I produce anything, let me ground myself in the existing overhaul direction — my notes mention queued UI overhaul plans (A–M), and you said to evaluate the in-progress work. Let me pull that context and set up the brainstorming track.

**🤖 Claude:**

This is critical context — there's already a coordinated 12-plan overhaul (A–M) with a roadmap and a strategic "design-language & app audit" plan (L). My deliverable should evaluate and complement that, not reinvent it. Let me read the roadmap and the strategic plan.

**🤖 Claude:**

I've now got the full picture. Here's where my head is before I start producing — and where I need your steer.

## What I found

You already have a **mature, well-sequenced overhaul program**: 13 plans (A–M), a dependency-ordered ROADMAP, a stacked-branch release strategy, and a strategic "design-language & app audit" plan (L) whose philosophy is exactly right — *the design system is the canon; make illegal UI unrepresentable; enforce via lint*.

But here's the gap, and I think it's the one you're feeling: **that program is almost entirely bottom-up.** It renames nav items, consolidates duplicate buttons, standardizes modals, and sweeps for redundancy — all reactive cleanup against the *current* structure. Plan L Phase 3 even lists the smoking guns: "delete-static ×2, dual static selectors, dual roster jumps, objective-edit ×2." Those are the "10 ways to the roster" symptoms — but the program treats them as **cleanup tasks, not as evidence of a missing top-down design.**

There is **no single artifact that defines the target**: the ideal information architecture, the one canonical navigation model, the core user journeys, and the visual language every screen should express. That's the north star the cleanup work is missing — and it's exactly what you're asking me to produce: *a visual mockup that tells the story of the app and how to use it.*

So my instinct is to build that north star, then **measure the A–M program against it** (what gets us there, what's missing, what should be re-sequenced).

Before I do the UX research → audit → mockups, three forks genuinely change what I produce:

**🤖 Claude:**

Got it — **clean-slate, re-architect the IA, coded HTML/Tailwind prototypes** (and I'll flag if I think ground-up is warranted). Let me set up the track and then give you the diagnosis + the structural fork I need you to weigh in on.

**🤖 Claude:**

# The diagnosis

## The lens I'm judging against (applied UX canon)

I'm not going to recite textbooks — here are the **10 rules** this redesign must satisfy, each tied to why it matters for *your* app and users (static leads + members):

1. **IA mirrors jobs-to-be-done, not the data model.** Users think in tasks ("set up my roster," "who gets this drop," "when do we raid"), not in `TierSnapshot` / `loot-log` / `page-ledger`.
2. **One home per task; one canonical way to do it** (Jakob's consistency). Power gets a *fast path*, not a *second place*.
3. **≤2 levels of navigation depth** (Hick's law, Miller's 7±2). Burying the core action 3 tabs deep is the cardinal sin here.
4. **Information scent** (Nielsen): a label must predict what's behind it. If you're renaming nav items to fix confusion, the labels were carrying no scent.
5. **Recognition over recall** + **visible affordances** (Norman): clickable looks clickable; text doesn't secretly navigate.
6. **Progressive disclosure**: simple by default, power on demand. This is *the* lever for "easy for beginners, powerful for masters."
7. **Feedback & forgiveness**: clear state, undo, confirm-before-destroy (your double-click-confirm is good).
8. **Speed for experts**: a command palette + surfaced shortcuts beat 10 redundant buttons.
9. **One design system, enforced** (your Plan L philosophy — keep it).
10. **Components as owned, reusable units** so a contributor adds a feature in one place, not six.

## The six critical problems (what's actually broken)

**1. You have four parallel navigation systems fighting over the same destinations.** The left rail *(Overview/Schedule/Roster/Tracking/Loot Log/Plugin/More)*, the header context-switcher *(Player Hub / Finder / static / tier)*, the settings slide-out *(its own 6 tabs)*, and the **"More" page — a second grid of nav cards**. Settings, Recruitment, Plugin, Loot History, Split Planner are each reachable 3–4 ways. Your own Plan A/I confirm it: "SidebarNav/ProfileSidebarNav duplication," "dual static selectors," "dual roster jumps," "My Statics in two places." **The "More" page is the tell — it's a junk drawer of things the IA couldn't place.**

**2. Tab-state is nested 3 deep and sprawls across ~9 independent URL params.** I watched the catalog produce `tab` → `sub` → `subtab` → plus `rsub`, `sched`, `logLayout`, `lsec`, `gsub`, `rcsub`. The core in-raid action — **"who needs this drop"** — lives at *Loot Log → Priority → Who Needs It*, **three clicks deep**. That's a Hick's-law and information-scent failure.

**3. Labels lie.** "Loot Log" actually contains **four different jobs** (Log, Priority, Sync, Summary). "Tracking" means mount farms. "Overview" and "Roster" overlap. Gear progress — a *core* job — **has no home of its own**; it's smeared across player cards, Loot Log→Sync, and Team Summary.

**4. "Update one, miss six" is structural, not accidental.** It's caused by per-screen component forking with no single source of truth. Confirmed in your own plans: recipient picker forked across **QuickLogDropModal vs AddLootEntryModal** (→ the recurring "can't select that player" bug, Plan H); **two catalog browsers**, **two availability editors**, **delete-static ×2**, **objective-edit ×2**. That *is* the "16 ways to log loot" disease.

**5. Onboarding & empty states are an afterthought.** A new user lands into the full rail + context switcher + tier selector + settings panel at once — maximum cognitive load, zero "what do I do first." Empty Player Hub just says "Not Shared." No command palette, shortcuts buried.

**6. The design *system* is good; *conformance* is poor.** Tokens, role colors, and the type scale are genuinely strong. But ~460 arbitrary `text-[Npx]` (down to 7–8px), ~181 inline hardcoded colors bypassing tokens, inconsistent modal headers, raw buttons. So screens look subtly different from each other even though the system is right.

## My honest call on ambition

**Re-architect the IA, keep and enforce the visual design system.** I looked hard for a reason to go full ground-up, and I don't see one: your *visual* identity (dark, teal, role colors, Exo 2 / Inter, the token system) is coherent and good — it's an asset. The disease is 100% **information architecture + component ownership + conformance**, not the look. Ground-up would throw away real value and add risk for no visual payoff. If the audit of specific screens later turns up a visually broken area, I'll flag it — but the strategic answer is *new skeleton, same skin (enforced).*

This means roughly: **Plan L's enforcement philosophy, the design-system standardization (F), recipient consolidation (H), and account controls (M) survive and feed the new plan; the evolutionary nav renames (I) and the rail/settings structure (A/B/C) get superseded** by a designed IA rather than a shuffled one.

## Mockup tooling (you asked me to pin this down)

**Standalone HTML + Tailwind prototype screens that `@import` your real `index.css` design tokens**, rendered in the browser and screenshotted via Playwright (and optionally clickable). Why this over the alternatives: it's true-to-product (same tokens → mockups *are* an implementation reference), lives in `design/mockups/`, needs no app wiring, and **won't touch the other session's branch.** I'll assemble the screens + flow arrows into a single "story of the app" walkthrough. (v0/Figma would diverge from your tokens and not be reusable.)

---

Before I design the visual language and build the mockups, I need you to pick the **navigation backbone** — this is the one decision everything hangs off:

**🤖 Claude:**

Of course — what would you like to clarify or dig into before you choose? A few things I can expand on if useful:

- **What any of these actually means in practice** — e.g., how the Command palette (Cmd-K) would feel day-to-day, or what "role-scoped Settings" replaces.
- **Whether these two questions are even independent** — they're related. (My honest take: the **Jobs nav + Command palette** backbone and the **Layered simple→power** balance are the same philosophy from two angles, and they're what I'd build. The "Progressive guided shell" and "Two explicit modes" options also pair naturally with each other.)
- **How a choice maps onto your specific complaints** — e.g., exactly how each backbone kills "10 ways to the roster / 16 ways to log loot."
- **Migration cost / risk** of each, or how each plays with the backend.
- **Whether the 4 jobs (Roster · Gear · Loot · Schedule) are the right four** — that carving is itself a design decision worth challenging (e.g., should "Recruitment" or "Tracking/mount farms" be top-level? where do plugin + analytics live?).

What's on your mind?

**🧑 Aaron:**

Can you break down each option and list the pros, cons of each and give me your opinion?

**🤖 Claude:**

Absolutely. Here's each option dissected the same way — what it is, pros, cons, how it attacks *your specific* complaints, build cost, and backend fit — then my opinion.

---

# Question 1 — The navigation backbone

## Option A — Jobs nav + Command palette

**What it is:** One global rail for *context only* (active static, Player Hub, Finder, you). Inside a static, the primary nav is the 4 jobs — **Roster · Gear · Loot · Schedule** — plus a role-scoped Settings. `Cmd-K` is the universal "go anywhere / do anything" for speed.

**Pros**
- **Directly kills the redundancy.** "One home per task" becomes a literal rule: there is exactly one Roster page, one Loot page. The "More" junk drawer disappears. Cmd-K becomes the *one* fast-path, so you stop sprinkling duplicate buttons everywhere.
- **Flattest depth.** "Who needs this drop" and "log loot" become first-class on the Loot page (≤2 levels) instead of 3 tabs deep.
- **Most familiar pattern** (Linear, GitHub, Notion, Vercel all do exactly this) → low learning curve (Jakob's law: people already know it).
- **Scales cleanly.** New feature = a section on a job page *or* a Cmd-K action, with one owning component. Contributors have an obvious place to put things.
- **Best backend pairing.** 4 jobs map to clean API/store boundaries (roster, gear, loot, schedule). One store owns one job; UI components are thin views over it.

**Cons**
- Cmd-K is a *new* surface to build and teach (though shortcuts already exist, so it's an extension, not a leap).
- A few features need a deliberate home decision (recruitment, mount-farm tracking, plugin, analytics) — see my note at the end.
- Slightly less "in-your-face" for the daily power user than Option B (one extra click to switch jobs vs. everything-on-one-screen).

**Beginner vs. power:** Excellent both ways — clean 4-tab default for beginners, Cmd-K + shortcuts for masters.
**Build cost:** Medium. **Risk:** Low (proven pattern).

---

## Option B — Roster-spine workspace

**What it is:** The roster is *always* on screen as the spine. Loot, Gear, Schedule slide in as panels/toolbars over it instead of full page changes.

**Pros**
- **Fastest for the weekly power user** — log loot *while looking at the roster*, near-zero page loads.
- The roster genuinely *is* the heart of the app, so making it permanent has conceptual appeal.
- Great for the in-raid loot moment specifically (drop happens → panel → log → done, roster never leaves).

**Cons**
- **Worst for beginners.** A dense two-region workspace with sliding panels is intimidating cold; high cognitive load (violates progressive disclosure).
- **Hardest to build and keep clean** — panel/overlay state management is where complexity (and your "update one, miss six" bugs) breeds. It fights the goal of *simple-to-contribute-to*.
- Doesn't scale gracefully — Schedule, Recruitment, analytics, Player Hub don't want to live "over the roster"; you'd end up with full pages anyway, so you get *both* paradigms (worst of both).
- Mobile/responsive is painful.

**Beginner vs. power:** Power ✅, beginner ❌.
**Build cost:** High. **Risk:** Medium-high.

---

## Option C — Progressive guided shell

**What it is:** A maturity-aware home that surfaces "what to do next" (set up roster → import BiS → log this week) and adapts to the static's state. Power users flip to a "Pro mode" with full nav + Cmd-K.

**Pros**
- **Best onboarding and growth narrative** — directly nails your "intuitive enough for anyone to get value, powerful enough to master" ask.
- The "next up" home is genuinely useful even for veterans (a weekly to-do: log this week, 2 floors left).
- Lowest cognitive load on day one.

**Cons**
- **Two modes = two experiences to design, build, test, and keep in sync** — which is *literally the maintenance trap you're trying to escape.*
- "Adaptive" UIs risk **hiding things** and breaking muscle memory (the UI moves under you).
- Doesn't itself solve the IA — under the hood it still needs a real nav (it's a *layer on top of* Option A, not an alternative to it).
- Mode toggle is a discoverability problem.

**Beginner vs. power:** Beginner ✅✅, power ✅ (once they find Pro mode).
**Build cost:** High (it's Option A *plus* a guided layer + a second mode). **Risk:** Medium.

---

### My opinion on Q1

**Build Option A as the skeleton — and steal the single best idea from C: a maturity-aware "home" as the Roster landing / first screen, *without* a separate mode.** 

Reasoning: A is the only option that structurally cures your disease (redundancy + depth) *and* is cheap to maintain *and* scales for contributors *and* pairs cleanly with the backend. B optimizes one moment (in-raid loot) at the cost of everything else and is a maintenance magnet — I'd reject it. C's strength (onboarding/"what's next") is real, but it's a *feature you add to A*, not a different backbone — and its two-mode version recreates the exact "keep six things in sync" problem. So: **A's structure + a contextual "next up" strip that fades as the static matures** gives you C's onboarding win for ~10% of C's cost. That combination also satisfies Question 2's "layered" answer automatically.

---

# Question 2 — Simple vs. power balance

## Option 1 — Layered (simple default, power revealed)
**Pros:** One UI to build/maintain; power is *additive* (Cmd-K, bulk-select, shortcuts) so it never clutters the default; teachable progressively. Matches how the best tools work.
**Cons:** Power features must be *discoverable* or they go unused (mitigated by surfacing shortcut hints, an "?" affordance, Cmd-K hint in the header).
**Verdict:** Lowest cost, best ceiling.

## Option 2 — Power-dense by default
**Pros:** Fewer clicks for the daily lead; everything visible.
**Cons:** **Punishes the beginner and the member** (who are most of your headcount — members just check their gear/priority and RSVP). Dense screens are exactly what your current app already does wrong (tiny text, every control shown). Doubles down on the problem.
**Verdict:** Wrong audience priority.

## Option 3 — Two explicit modes
**Pros:** Clean separation; each mode is purpose-built.
**Cons:** Two experiences to maintain (the trap), mode-discovery problem, muscle-memory breakage. Same objections as Option C above.
**Verdict:** Cost ≫ benefit.

### My opinion on Q2
**Option 1, unambiguously.** It's the only one that serves your *actual* user mix (a few leads + mostly members) with a single maintainable UI, and it's the natural partner to Q1-Option A. Power is layered *onto* the clean default, never bolted *beside* it.

---

# Bottom line

> **Q1 → Option A (Jobs nav + Cmd-K), with C's "what's next" home folded in as a feature, not a mode.**
> **Q2 → Option 1 (Layered).**

They're really *one* decision: a clean, jobs-based, ≤2-level app that's obvious by default and fast once you learn it. That's the backbone I'd design the mockups around.

**One thing I'd flag now** (the "are the 4 jobs right?" question): I'd make the top-level **Roster · Gear · Loot · Schedule**, and place the rest deliberately — **Recruitment** and **mount-farm/Tracking** live as sections inside Roster and Gear respectively (or under a static's Settings), **Plugin** becomes a Settings/Player-Hub concern (it's setup, not a daily job), and **Admin/Analytics** stays a separate top-level area gated to admins. We can pressure-test that carving when I design the IA in detail.

Want me to lock in **A + Layered** and move to designing the detailed IA + visual language (then mockups)? Or would you like to challenge the 4-job carving first?


---

## Phase 3 — The identity crisis: "what even is this app?" (13:07–13:33)

_The heart of the brainstorm — resolving whether this is a tool for leads or for individuals, and finding the core._

**🧑 Aaron:**

I think I understand. Maybe this will help. The original purpose of this app was simple, replace google sheets the ffxiv raiding community has been using for their statics to track gear progress and priority while raiding the latest savage tier. After the original implimentation, many users have asked for more dense control over priorities, some have asked to define priorities ahead of time, others wanted no priorities. Users asked for ways to track mount farms, ulitimates, alt accounts and hardcore gear funnelling. They've asked for scheduling (which most groups have used when2meet to identify best times). Users have asked for analytics of raids (fflogs integration). Strat integration so it's easy to look up the static's strats for each raid in the tier. And, much more.

Essentially, the idea of the app has morphed into something that's more of a hub, a hub for leads to manage their statics effectively and tailored towards they're groups preferences and the content they'r tackling and for individuals to manage what groups/statics they're in, coordinate those groups/statics easily and track progress. 

It really feels like this app could really become a swissarmyknife of a ton of overwhelming features. This perspective isn't scalable and will be hard to maintain. The app needs to have a fundamental purpose and vision while providing scalable solutions for additional features and functions. 

I'm having a hard time determining this; is this a hub for users to manage their statics, or is it a hub for raid leads managing their groups and statics while individual options are secondary/built-in? Is the roster page the most important? Or, is it a hub for the user?

What designs best solve this problem, what layouts, what structures. I'm having a hard time breaking this down into something that's clear, consice and easy to see a long-term roadmap for. It was much easier when it was simply an app for raid leads managing their statics for savage content, but it's grown into so much more that I no longer know what the core focus or design should be.

**🤖 Claude:**

This is the most important question in the whole project — and honestly, you getting stuck here is a *good* sign, because every "swiss-army-knife that became unmaintainable" app failed to answer it. Let me give you a framework that I think dissolves the tension, then my opinion.

## The trap: you're treating "lead vs individual" as a priority fight

It isn't a priority fight — it's a **layering** problem. The two aren't competing for the same throne; they live at **different altitudes.** Every successful "hub" tool that serves both individuals and teams (Slack, Linear, Notion, GitHub, Discord) resolves it the same way:

> **A personal front door → that opens into shared workspaces → that contain the work.**

- **You** (the person) are the *identity and front door*. You log in as a raider who belongs to N statics, has characters/alts, gear that follows you, and availability.
- **A static** is a *shared workspace*. It has a roster, a loot history, a schedule, strats, analytics.
- **Lead vs member is a role *inside* a workspace** — handled by permissions, not by building two apps. The lead sees edit controls; the member sees their slice; the viewer reads. Same UI, progressive permissions.

So the answer to *"is it a hub for users or a hub for leads?"* is: **it's a hub for raiders, in which each static is a workspace operated mostly by its lead but serving everyone in it.** You don't choose. You stack them.

This single decision kills the "two experiences to maintain" fear — there's **one app**, two altitudes (Person layer, Static layer), and roles modulate what you can do.

## The discipline that stops the swiss-army-knife sprawl: a strong core + concentric rings

A hub dies when every feature is a *peer* — a flat pile of equal tabs. The fix is to admit the app has **a center of gravity** and everything else orbits it. Yours is obvious from the history: **the progression loop is the core. It's what replaced the sheet; it's the thing nothing else does as well; it's what you do every week of a tier.**

```
        ┌─────────────────────────────────────────────┐
        │  RING 3 · Long game                          │
        │   mounts · ultimates · alts · gear funneling │
        │   ┌───────────────────────────────────────┐ │
        │   │ RING 2 · Intelligence                  │ │
        │   │   FFLogs / analytics                   │ │
        │   │   ┌─────────────────────────────────┐  │ │
        │   │   │ RING 1 · Coordination           │  │ │
        │   │   │   schedule · strats · recruit   │  │ │
        │   │   │   ┌───────────────────────────┐ │  │ │
        │   │   │   │  RING 0 · THE CORE LOOP    │ │  │ │
        │   │   │   │  Roster → Gear → Loot      │ │  │ │
        │   │   │   │  (the reason it exists)    │ │  │ │
        │   │   │   └───────────────────────────┘ │  │ │
        │   │   └─────────────────────────────────┘  │ │
        │   └───────────────────────────────────────┘ │
        └─────────────────────────────────────────────┘
```

**The rule that makes this scalable and gives you your roadmap:** *every new feature must declare (a) its layer — Person or Static — and (b) its ring.* If it can't, it doesn't ship. That one rule answers "where does this go?" forever, and your long-term roadmap stops being "what do we bolt on next" and becomes **"make Ring 0 flawless, then deepen each ring outward."** FFLogs? Static layer, Ring 2. Mount farms? Static layer, Ring 3. Alt accounts? Person layer. Strats? Static layer, Ring 1. Pre-defined vs no priorities? A Ring 0 *setting*, not a new surface.

## Answering your three direct questions

- **"Hub for users, or hub for leads?"** → Both, at different layers. Person layer = front door; Static layer = workspace; lead/member = role. Don't build two apps.
- **"Is the roster the most important page?"** → It's the most important **static-level** surface (the spine of Ring 0). But it is *not* the front door. When you log in, you land in the **Person layer** (your statics + what needs your attention), then *enter* a static and the roster/progression loop is what greets you. So: roster = heart of the workspace; personal home = heart of the account.
- **"What's the core focus/vision?"** → I'd state it as:

> **"From gearsheet to game plan — the home base for a FFXIV static and the raiders in it."**
> Core promise: *nail gear + loot for the current tier better than any spreadsheet.* Everything else earns its place by making that loop better or by helping run the static that does it.

That keeps the soul of the original app (it's still, fundamentally, the **progression tool**) while giving a principled home for everything it's growing into.

## Why this beats the two "pure" alternatives

- **Pure lead command-center** (static-first, person is just auth): focused, but starves the members (most of your headcount) and can't house the multi-static / personal-progress needs that are clearly emerging. Caps your growth.
- **Pure personal raider hub** (person-first, statics are incidental): great for individuals, but dilutes the lead workflows (loot/gear management) that *are* the app's actual value — you drift into a generic profile site.
- **Layered hub (recommended):** keeps the valuable core *and* serves the individual, with a rule that prevents sprawl. It's also the cleanest **engineering** boundary — Person-domain vs Static-domain, core module vs ring modules behind stable interfaces — so a contributor adding "FFLogs" knows exactly where it lives and what it can't touch.

## How this snaps onto the navigation choice

This is why I pushed **Jobs nav + Cmd-K (Option A)**: the global rail *is the Person layer* (you, your statics, Finder), and the in-static tabs *are Ring 0 + the rings* (Roster · Gear · Loot · Schedule, with Ring 2/3 features nested where they belong). The structure and the vision are the same shape.

---

**My recommendation to lock:** *Layered hub (Person → Static workspaces, roles not separate apps) + progression loop as the protected core + concentric rings + "declare layer & ring" as the scalability rule.*

Before I turn this into the detailed IA and the mockups, two things I'd love your gut on:

1. Does the **layered hub + "progression core, everything orbits it"** framing feel *true* to where you want this to go — or does part of you actually want the center of gravity to be the **person/community** (more like a raider social hub) rather than the **progression tool**?
2. Any feature on your wishlist that you feel **refuses to fit a ring** — because that's exactly where we pressure-test the model before I commit it to a layout.

**🧑 Aaron:**

1. 100% my gut wants this to be a progression based tool. Discord and FFXIV have already solved and provided the social hub element. This will contain ways for statics to find members looking for a group and vise versa and their may be some personal flare there, but it's for finding the right group for the right job/content/vibe, not for socializing.
2. For two, maybe you can help be better visualize how this fits in. Currently, there is a built in system for setting goals, browsing content, etc. But, it's all over the place in terms of functionality and integration, same with the scheduling options. The goal tracking and content tracking is a nice way to track progress and scheduling is super important for users to determine their availibility and for raid leads to determine the appropriate raid times for their static. If these are going to be integrated and valuable within the app, then it feels like they need to be foundational to the app, not thrown in as an additional feature. There's a part of me that feels like all of this just add unecisarry complexity because of how it's currently integrated, but maybe if it's done right, these could be powerful additonal features.

**🤖 Claude:**

Both answers are gold, and #2 contains the key insight you're circling — let me name it, because it's the thing that'll unstick you.

## The reframe: "foundational vs. extra complexity" is decided by *integration*, not by the feature

A capability is **foundational** when it's *woven into the loop you already run.* It's **dead-weight complexity** when it's *a separate place you have to remember to go visit.* **Same feature, opposite outcome.** Your current app chose "separate place" for both scheduling and goals — that's *why* they feel scattered and bolted-on. The features aren't the problem; their wiring is. So the question isn't "do these belong?" — it's "**are they threaded through the spine, or parked beside it?**"

That changes everything about how they fit.

## The refined model: one spine, run on a clock, with one progress engine

Your core isn't four equal jobs — it's **one weekly loop with a clock:**

```
        THE STATIC'S WEEK  (the unit everything runs on)
   ┌────────────────────────────────────────────────────────┐
   │  ROSTER ──▶ SCHEDULE ──▶ [ RAID ] ──▶ LOOT ──▶ PROGRESS  │
   │   who        when/who      clear      who gets   toward  │
   │              's coming                 the drop   BiS     │
   └────────────────────────────────────────────────────────┘
        ▲ availability (Person layer) feeds the schedule
        ▲ priority + gear board feed loot & progress
```

**Scheduling becomes foundational** not by being a bigger when2meet tab, but by becoming **the app's clock.** Notice the app *already* runs on "Week 1 / 2 / 3" for loot — that's a schedule concept that's currently disconnected from actual scheduling. Unify them: **one "week" is both the loot-tracking unit *and* the raid-session unit.** Then:
- **Availability is a Person-layer input** you set once and it follows you to every static.
- It **aggregates into the Static layer** as the heatmap the lead uses to pick times.
- The *outputs* show up **where you already are**: the static home says *"Next session Fri 8pm — 7/8 in, Healer Two tentative,"* RSVP is one tap, loot is logged against that same week. The deep calendar/heatmap still has a page — but its value is sprinkled through the loop, not quarantined in a tab.

**Goal/content tracking becomes foundational** by recognizing you don't have "a gear tracker *and* a goals tracker" — you have **one progress engine** (*target + per-member progress*), and **the savage gear board is just its flagship, best-dressed instance.** Everything else is a lighter **track** on the same engine:

```
  PROGRESS ENGINE  (target → per-member status)
   ├─ Savage tier      ← flagship track: BiS + loot priority (the full loop)
   ├─ Ultimate         ← lighter track: per-member clears, no loot priority
   ├─ Mount farm       ← lighter track: per-member mount count
   └─ Gear funnel/alts  ← lighter track: who's funneling what to whom
```

So "browse content / set goals" stops being a vague junk drawer and becomes one clean action — **"add a track for what your static is working on"** — that reuses Roster + Schedule + the progress spine but skips loot/priority when it doesn't apply. That's *scalable by construction*: a new content type is a new track config, not a new subsystem.

## What this does to your worry

You said part of you feels these add unnecessary complexity. **You're right about today's version and wrong about the feature.** Today: scheduling re-implements when2meet as an island, and goals re-implement progress-tracking as a vaguer parallel to your excellent gear board → complexity with no payoff. Reframed: scheduling is the clock; goals are tracks on the engine you already nailed → the *same* capabilities become powerful and *cheaper to maintain* because they share the spine.

## And it makes the roadmap legible

- **Ring 0 (protect this, make it flawless):** the savage loop on the weekly clock — Roster · the week/session backbone · Gear/Progress · Loot. This is the wedge; nothing ships until it's clean.
- **Ring 1 (deepen the spine):** rich scheduling (availability heatmap, Discord reminders), recruitment-as-*matching* (right group for the content/vibe — your framing), strats reference.
- **Ring 2:** intelligence — FFLogs/analytics.
- **Ring 3:** more content tracks — ultimates, mounts, funneling/alts.

Every future request now has an obvious home or an obvious "not yet." That's your long-term clarity.

---

So my recommendation, refined with your input:

> **A progression tool, organized as a static's weekly loop on a schedule clock, powered by one progress engine where savage gear is the flagship track. Personal layer feeds the static layer (availability, characters, recruitment-matching). Scheduling and tracking are foundational *because they're woven into the spine*, not because they're big tabs.**

Does this land? Specifically: do you buy (a) **scheduling = the app's clock, with the "week" unifying loot + sessions**, and (b) **goals/mounts/ultimates = lighter "tracks" on the same engine as the gear board** rather than a separate goals system? If yes, I'll lock the vision and move into the detailed IA + the first mockups that *show* this spine in action.

**🧑 Aaron:**

Also, the docs/CONSOLIDATED_STATUS.md contain the roadmap and features that have been added or want to be added, which should provide some additional insight, but it doesn't feel like a clear roadmap that's built with a core.

_🤖 Claude (working): Yes — let me read it. Mapping your *actual* feature inventory onto the model is the real proof it works (and produces the clear, core-anchored roadmap you're missing)._

_🧑 Aaron — [interrupted the previous response]_

**🧑 Aaron:**

I posted my additional comment just as you finished your response. Let me answer your question first. I think the way you put it lands and feels like a solid direction to move in. The app isn't a personal tool for tracking personal goals, it's a tool for manaing statics/groups doing content with progression in mind. The concept of the Progress Engine and the rings/tracks you laid out sound managable and purposeful. I like it!

The docs/CONSOLIDATED_STATUS.md feels more like an inventory now and it's worth looking through to determine what items fit and don't fit, where and why.

Could we create a document outlying the apps core model? Essentially the source of truth that simplifies and answers all the questions we've just gone through. What is this app? How does everything nest. What's it's goal. What fits inside of it and what is the roadmap. Where are we now and where do we want to go.

I really like how you've broken it down and simplified it's design. Lets continue!


---

## Phase 4 — Writing the canonical PRODUCT_MODEL (13:34–14:01)

_Goal: capture the locked vision as a source-of-truth doc and clean up deprecated documentation._

**🤖 Claude:**

Love it — vision locked: **a progression tool for managing statics doing content, built on the weekly loop + Progress Engine, with rings/tracks and the Person→Static layering.** Let me read the inventory, map every feature onto the model, then write the source-of-truth core model doc.

**🤖 Claude:**

I've now got the full inventory (and two of the wishlist tensions — *mount ownership being character-vs-group* and *goals-vs-gear duplication* — turn out to be things the model **resolves**, which is a great sign). Let me write the source-of-truth doc.

**🤖 Claude:**

Good news — `OUTSTANDING_WORK.md` was in the same batch I just read, so it's already folded into the model (Multi-BiS persistence, notifications, FFLogs, Discord bot, mobile, alt-job tracking, the mount-farm character-vs-group model, Collection Goals, account controls). Let me add one explicit cross-check note + place the few items unique to it (Recent Activity feed, Command Brief, Ariyala, webhook-status), so nothing looks orphaned.

**🤖 Claude:**

Written to **`docs/PRODUCT_MODEL.md`** — the canonical source of truth. Here's what it locks (and what I'd like you to sanity-check before I build the IA + first mockups on top of it):

**The spine of the doc**
- **Vision:** *"From gearsheet to game plan — the home base for a FFXIV static and the raiders in it"* — a **progression tool**, with one honesty test: a static opens it to answer *what are we working on, when do we play, who gets the next drop, how close are we to done.*
- **Two layers:** Person (you, your characters, availability, the statics you're in) ↔ Static (the shared, role-scoped workspace). Lead vs member = permissions, never two apps.
- **The weekly-loop spine:** Roster → Schedule → Raid → Loot → Progress, all organized by the **week** — which unifies the loot-week and the session-week into one clock (that's *why* scheduling is foundational, not a bolt-on).
- **One Progress Engine, many tracks:** savage tier = the flagship track; mounts/ultimates/funneling are lighter tracks on the *same* engine (kills the goals-vs-gear duplication).
- **Concentric rings:** Ring 0 core loop → 1 coordination → 2 intelligence (FFLogs) → 3 long game.
- **The "where does it go?" rule:** every feature declares *layer + ring/track + woven-or-parked* — your contributor contract and anti-sprawl guarantee.

**The payoff sections**
- A **full inventory map** of every shipped/planned feature (from both `CONSOLIDATED_STATUS.md` and `OUTSTANDING_WORK.md`) onto the model, with verdicts (✅ keep / ♻️ re-home / 🆕 planned / ⚠️ misplaced→fix). The "More" page, the catch-all Overview, the 3-deep tabs, and the duplicated components all get an explicit fix.
- It even **resolves two of your standing tensions**: mount ownership (character-level Person data → aggregated to Static) and goals-vs-gear (one engine).
- **Where we are / where we're going:** a core-anchored roadmap, plus how this re-scopes the A–M plans (enforcement/F/H/M survive as execution; the structural nav plans are superseded by a top-down IA).

**Three things I want your gut on before I continue:**
1. **Vision line** — does *"from gearsheet to game plan"* feel right, or do you want different framing?
2. **Non-goals** — I drew a hard line: no social feed; "Recent Activity" stays as fairness/transparency (who got what this week), **not** a social surface. Agree?
3. **In-static nav labels** — I deliberately left the exact top-nav wording (e.g., Roster · Schedule · Loot · Progress vs. Gear) to the **IA design step** so we pick them against real mockups. Good to defer?

I held off committing to git (your repo rule is commit-only-when-asked, and another session is active) — say the word and I'll commit it.

Give it a read and flag any placement you disagree with. Once you're happy, I'll move to **Task 11/12: the detailed IA + the first coded mockups** that show this spine in action.

**🧑 Aaron:**

Vision line, different framing. Sure, the intent was to replace those spreadsheets, but I'd rather this be a project that is it's own thing. Relating it to the gearsheets feels like it's putting down the ones who set those sheets up for the community and potentially limits it's vision by association.
Non-goals: Agreed!
In-static nav labels: Good to defer.

The PRODUCT_MODEL feels good. In regards to all of the existing files under the docs folder, they all seem depricated at this point. There's a lot of documentation spread throughout the app which also makes the clear vision of the tool to decipher. I suggest we archive all existing/irrelevant documentation and replace it with a newer and more clear source of truth.

**🤖 Claude:**

Two things: the vision reframe (quick), and a real plan for the docs consolidation (it touches a lot and there's a coordination wrinkle I want to flag). Let me fix the vision line and inventory the actual docs folder first.

**🤖 Claude:**

Vision reframed — dropped the gearsheet framing entirely:

> **The home base for a FFXIV static — and the raiders in it.**
> A progression tool that keeps a static aligned on *what they're working on, when they play, who earns the next drop, and how close everyone is to their goal* — every part of running a raid group, in one place built for it.

Now the docs cleanup. I inventoried the folder — **~60 files**, and you're right, most are deprecated planning/audit/session artifacts that obscure the vision. Here's my proposed sort (and one coordination flag I need your call on):

**🤖 Claude:**

## ✅ KEEP — the new clean source-of-truth set (living docs)

| Doc | Role |
|---|---|
| **`PRODUCT_MODEL.md`** | **Tier-1 canonical** — what the app is, the model, the rule. (just written) |
| **`REDESIGN_SPEC.md`** *(coming next)* | **Tier-1 canonical** — the IA, visual language, flows + mockups |
| `CODING_STANDARDS.md` | contributor reference |
| `DESIGN_SYSTEM_SUMMARY.md` + `DESIGN_SYSTEM_ENFORCEMENT.md` | design-system reference (pairs with the live `/docs/design-system` page) |
| `GEARING_REFERENCE.md` + `GEARING_MATH.md` | FFXIV domain facts (durable) |
| `UI_COMPONENTS.md` | component inventory (will be regenerated after the redesign) |
| `PRIVACY.md` | legal/privacy |
| `frontend/src/data/releaseNotes.ts` | **stays the changelog** (CI-enforced) — no separate status doc needed |

*(I'd later merge the two design-system docs into one `DESIGN_SYSTEM.md` and the two gearing docs into one `GEARING.md`, but that's polish, not now.)*

## 📦 ARCHIVE — deprecated (implemented, obsolete, or folded into the model)

Move to `docs/archive/2026-06-27-pre-redesign/`:
- **Inventories now folded into PRODUCT_MODEL §5–7:** `CONSOLIDATED_STATUS.md`, `OUTSTANDING_WORK.md`
- **Implemented feature plans:** `BIS_SOURCE_PLAN`, `PRIORITY_*` (4 files), `SETUP_WIZARD_PLAN`, `UI_REORGANIZATION_PLAN`, `MOBILE_*` (2)
- **Completed audit/session programs:** all of `plans/` (COMBINED_AUDIT + SESSION_01–12 + index), all of `implementation/` (parity-audit, ux-audit, +2)
- **Point-in-time audits / docs-process:** `audits/light-mode-conformance.md`, `USER_DOCS_AUDIT.md`, `DOCS_IMPLEMENTATION_PLAN.md`
- (`archive/` is already archived — leave it.)

**Borderline — your call:** `DOCS_STYLE_GUIDE.md` (governs the in-app `/docs` user pages — keep if those stay) and `audits/enforcement.md` (CLAUDE.md cites it as the live enforcement surface — I'd keep it).

## ⚠️ HOLD — needs your call (coordination risk)

**`docs/superpowers/`** — the A–M plans, `ROADMAP.md`, `NEXT_SESSION_PROMPT.md`, specs. Under the new model these are *superseded* (the structural ones) or *re-scoped as execution* (enforcement/F/H/M). **But the other Claude session is actively executing against them** — the live app you cataloged is on their branch. If I archive these now, I could pull the rug out from that session.

My recommendation: **leave `superpowers/` in place for now**, drop a one-line banner at the top of `ROADMAP.md` pointing to `PRODUCT_MODEL.md` as the new vision authority, and archive them properly once you've coordinated with / wrapped up the other session.

## One more thing
`CLAUDE.md` (root + project) links many of the docs I'd archive. I'd **update its "Key References / Additional Documentation" sections** to point at the new clean set — otherwise those links break.

---

**Confirm and I'll execute** (move files via `git mv` so history is preserved, write a `docs/README.md` index mapping the new set, and update CLAUDE.md). Three quick decisions:

1. **Archive scope above** — good as-is, or pull anything out of the archive bucket?
2. **`superpowers/`** — leave-in-place-with-banner (my rec), or archive now too?
3. **CLAUDE.md** — OK for me to update its doc references to the new set?

**🧑 Aaron:**

1, Archive scope above
2. superpowers/ I stopped the other claude session a while ago after it wrapped up it's PR work. As far as I'm concerned, we can diverge from whatever works was remaining. It feels pointless to do all that polish on a system/design that's going to fundamentally be redesigned anyways. 
3. Update CLAUDE.md to point to the cononical files moving forward. There's no reason to reference anything else at this point.

**🤖 Claude:**

All confirmed. Executing the archive (plain `mv` so it's robust regardless of tracked state — rename detection still kicks in at commit). Then I'll update both CLAUDE.md files and write the new index.

_🤖 Claude (working): Archive complete — `docs/` is now clean (10 living items). Now the index + CLAUDE.md updates. Let me read both CLAUDE.md files to edit their doc references precisely. Now updating the project `CLAUDE.md` to point at the canonical set and drop the archived references. Project CLAUDE.md done. Now the root workspace CLAUDE.md — let me read its references section and update. Now the clean doc-map index at `docs/README.md`._

**🤖 Claude:**

Documentation is consolidated. Here's the new state:

**`docs/` is now clean** — 9 living docs + the index:
- **`PRODUCT_MODEL.md`** (source of truth) · **`README.md`** (doc map)
- Living references: `UI_COMPONENTS`, `DESIGN_SYSTEM_SUMMARY`, `DESIGN_SYSTEM_ENFORCEMENT`, `audits/enforcement.md`, `CODING_STANDARDS`, `GEARING_REFERENCE` + `GEARING_MATH`, `DOCS_STYLE_GUIDE`, `PRIVACY`

**54 files archived** into `docs/archive/2026-06-27-pre-redesign/` — the A–M overhaul plans + ROADMAP, the 12 audit sessions, parity/UX implementation docs, all the implemented feature plans, mobile plans, and the old `CONSOLIDATED_STATUS` / `OUTSTANDING_WORK` inventories.

**Both `CLAUDE.md` files updated** — root and project now point to `PRODUCT_MODEL.md` as "read first" and reference only the canonical set (no dead links to archived docs). Changelog stays `releaseNotes.ts`.

---

**One housekeeping flag before we build mockups:** all of this redesign work (the new docs, the archive moves, the CLAUDE.md edits) is currently **uncommitted in the working tree on `perf/roster-dnd`** — which also still has the in-flight drag-and-drop changes from earlier. That's a messy mix. I'd recommend we put the redesign initiative on its own branch (e.g. `redesign/foundation`) and commit the doc/model work as a clean checkpoint. I won't touch git without your go — want me to:

- **(a)** set up a `redesign/` branch and commit the model + docs cleanup as a checkpoint, or
- **(b)** leave git alone for now and just keep moving?

Either way, I'm ready for the **main event: Task 11 + 12 — designing the detailed IA and building the first coded mockups** (the visual story of the app). The mockups will be standalone HTML in `design/mockups/` using your real design tokens, so they won't touch app code regardless of the git decision.

Want me to proceed to the IA + first mockups now?


---

## Phase 5 — The IA + first coded mockup (14:03–14:24)

_Goal: design the detailed information architecture and render the keystone Home screen._

**🧑 Aaron:**

a

**🤖 Claude:**

On it — setting up the `redesign/foundation` branch and committing the model + docs as a checkpoint, while leaving the in-flight DnD changes untouched. First, quick recon of the git state so I commit only the right files.

**🤖 Claude:**

Important catch before I commit: we're actually on **`ui/F-design-system`** (one of the A–M overhaul branches), not `perf/roster-dnd` — the branch was switched at some point, and the DnD changes aren't in this tree (so nothing of yours is at risk). The only uncommitted work here is my redesign output: `CLAUDE.md`, the `docs/` changes, and the untracked screenshot catalog.

I'll branch `redesign/foundation` off the current HEAD (zero-risk, nothing lost) and commit just the **model + docs** as you asked (leaving the 15 MB screenshot catalog untracked unless you want it in). We can cleanly rebase this onto `main` later if you'd prefer a slate with none of the A–M code.

**🤖 Claude:**

Checkpoint committed. ✅

- **Branch `redesign/foundation`** created (off `ui/F-design-system`), commit `2b4c293`: PRODUCT_MODEL.md + README.md + 54 docs archived + both CLAUDE.md repointed (57 files).
- **Left untracked as you'd expect:** the 15 MB screenshot catalog (`design/app-ui-reference/`) — say the word and I'll commit it separately; and a stray `.playwright-mcp` temp deletion (harmless).
- We can cleanly **rebase this onto `main`** later if you want a slate without the A–M code — easy now that it's a committed commit rather than a dirty tree.

Now — **the main event.** I'll design the detailed IA and build the first coded mockups. Let me pull your real design tokens so the mockups are true-to-product, not approximations.

**🤖 Claude:**

I have the full token set (dark + light). Now I'll build the mockups. First, the **detailed IA** the mockups realize, then I'll scaffold the harness and render the keystone screen.

## The IA (what the mockups implement)

**Global context rail (Person layer)** — always present, ~72px: logo → personal home · **Player Hub** · **Static Finder** · divider · **active static** (switcher) · user menu (footer). This is the *only* global nav.

**Top bar (inside a static):** `Static ▾` · `Track/Tier ▾` (Heavyweight Savage · M9S–M12S) · `Week 3` · right: `⌘K` · notifications · settings (role-scoped) · theme.

**In-static nav — the spine (5 flat items, ≤2 levels deep):** `Home · Roster · Gear · Loot · Schedule`.
- **Home** = the weekly-loop dashboard (next session, this week's loot, what needs you, progress, activity).
- **Roster** = who (cards, jobs, BiS, characters) — setup woven in, no banner chaos.
- **Gear** = the BiS/progress board (the job that had no home).
- **Loot** = priority + logging + history, with the unified recipient picker; "who needs this drop" is first-class.
- **Schedule** = sessions + availability (the clock).

**`⌘K` command palette** = the single power fast-path (go anywhere / log loot / who-needs-X / switch static).

Let me scaffold the harness with your real tokens and build the keystone screen (shell + Home).

_🤖 Claude (working): Now the keystone screen — the app shell + the **Home / weekly-loop dashboard**, the screen that tells the whole story. Now let me render it. I'll point the browser at the file, size a tall viewport to capture the full page, and screenshot it. Playwright blocks `file://`. Let me serve the mockups over a local static server, then point the browser at it. Server's up. Let me load the mockup, size the viewport, and render it. Let me view the rendered mockup to check quality._

**🤖 Claude:**

Here's the keystone screen rendered — true-to-product (your actual tokens, role colors, Exo 2 / Inter, dark theme). This is the **Home / weekly-loop dashboard**, and it demonstrates the whole model in one view:

**What it shows (mapped to the model):**
- **Context rail** (Person layer): logo, Player Hub, Static Finder, your active static (CS) + another you're in (LP), settings, you. The *only* global nav.
- **Top bar:** `Static ▾ / Tier ▾`, the `⌘K` command palette, notifications, settings, theme.
- **The spine:** `Home · Roster · Gear · Loot · Schedule` — flat, ≤2 levels, with the `M9S–M12S` track + `WEEK 3` clock.
- **The weekly loop, at a glance:** Next session (RSVP in one tap) → This week's loot (floor progress + one "Log this week" CTA, *not* 3 logging surfaces) → Roster readiness. The week is the unit; scheduling *is* the clock.
- **"Needs your attention":** the old `PlayerSetupBanner` chaos and the "More" junk drawer, replaced by one prioritized action list (no BiS, unclaimed sub, join request).
- **BiS progress by role** + **Recent activity** (note the privacy-anonymized plugin row — fairness/transparency, not a social feed).
- **"Also tracking": Mount Farm** as a *Ring 3 track on the same Progress Engine* — proving the model scales without a new subsystem.

Files: `design/mockups/01-static-home.html` (+ `tokens.css`, `app.css`); render in `design/mockups/renders/`.

**Before I build the rest**, does the **visual language + layout direction** land for you? Then I'll produce the remaining hero screens to complete the story:

| # | Screen | What it proves |
|---|--------|----------------|
| 2 | **Roster** | clean cards, BiS/setup woven in, one player menu |
| 3 | **Loot** | "who needs this drop" first-class + the **unified recipient picker** (kills the recurring bug) |
| 4 | **Gear** | the BiS/progress board — the job that had no home |
| 5 | **Schedule** | sessions + availability as the clock |
| 6 | **⌘K command palette** | the power fast-path overlay |
| 7 | **Player Hub** | the Person-layer home (your statics + what needs you) |

Want me to **proceed through all of these**, or adjust the visual direction / reorder first? (I can also drop a quick **light-mode** render of this screen if you want to sanity-check theming.)


---

## Phase 6 — The Gear/Loot/Log terminology fix + fidelity boundaries (14:22–14:32)

_The exact point your observer log picked up. Resolving the muddy terminology and pinning down what the mockups are authoritative for._

**🧑 Aaron:**

I'm liking it so far. My only confusion (and this has always been a confusion for me since starting this app) is determing the difference between Gear, Loot, and Log. You log loot which is basically just gear (except for mounts). Log sounds like a history book, but could also be a call to action. Loot sounds like you're looting a body or it could mean a list of loot and gear could mean either one (like managing gear) which the roster already does (in terms of showing who has what). 

Perhaps part of this redisign is also creating a glossary of the apps language and their definitions. 

I think the Loot tab makes sense, since there's no Log tab around it. AS for Gear, I'm not 100% what that tab will have. Is it just a summary of progress?

When you're done with the mockup/design, we can do a comprehensive review of what you have. I think creating a flow graph of how everything is connected and works together (essentially a visual that show how the app is meant to function at the UX level).

**🤖 Claude:**

You've put your finger on the single muddiest part of the app's language — and it's worth fixing properly, because "Gear vs Loot vs Log" being fuzzy is a *symptom* of three overlapping homes for related ideas. Let me untangle it.

## The diagnosis: three words, fuzzy because the homes overlap

- **"Log"** — you nailed it: it's a *verb* (an action) masquerading as a *noun* (a place). "Log loot" is something you *do*; the record of it is "history." It should **never be a tab.**
- **"Gear"** — genuinely ambiguous: the equipment? managing it? progress toward it? And Roster *already* shows who-has-what. A "Gear" tab is a 4th view of data that lives in Roster, Loot, and Home.
- **"Loot"** — you're right it's fine *because nothing competes with it.* It's the one unambiguous domain word.

## The fix: drop "Gear" as a tab → 4 clean tabs

> **Home · Roster · Loot · Schedule**

Each owns one thing, with a verb you can say out loud:

| Tab | Owns | Say it as |
|---|---|---|
| **Home** | this week at a glance | "check what's up this week" |
| **Roster** | the **people + their gear toward BiS** | "set up players / see who needs what" |
| **Loot** | **distributing drops**: priority + logging + history | "see who's up next / record a drop" |
| **Schedule** | when you raid + availability | "find raid time / RSVP" |

**Where the "Gear" content goes** (answering "is it just a summary?" — yes, which is why it shouldn't be its own tab):
- **Roster gets a view toggle: `Cards ⇄ Board`.** Cards = the people (default). **Board** = the classic gearsheet matrix (rows = players, cols = slots, cells = have/need) — the bird's-eye power view, kept and loved, but living where gear naturally belongs: *the roster's state.*
- The **per-drop "who needs this slot"** view lives in **Loot** (it's a distribution question).
- The **at-a-glance progress** lives on **Home** (the readiness card).

So gear isn't lost — it has *three purposeful homes* instead of one ambiguous tab. And **"Log" disappears as a noun**: inside Loot you have **Priority** and **History**, with *"Log a drop" / "Log this week"* as action buttons.

## Your glossary idea — yes, and it's foundational

A consistent vocabulary is a real UX principle (Nielsen's "match the real world" + "consistency"). I'll make a **glossary part of the canonical model.** Seed:

| Term | Definition |
|---|---|
| **Static** | your raid group (never "group" in UI) |
| **Track** | something the static is progressing through; the savage **Tier** is the flagship track, mounts/ultimates are lighter tracks |
| **Tier** | the current savage raid tier (a track) |
| **Roster** | the people in the static + their gear toward BiS |
| **BiS** | the best-in-slot target set for a job |
| **Loot** | the domain of distributing drops (priority + log + history) |
| **Drop** | one piece of loot that dropped |
| **Priority** | who's next in line for a slot, by the fairness rules |
| **Log (v.)** | to record a drop or a week — an action, never a place |
| **Book / Page** | clear currency used to buy gear |
| **Week** | the unit the loop runs on — one raid week = one loot week |

I'll grow this in the redesign spec.

---

**Two confirmations before I keep building:**
1. **Adopt the 4-tab spine** (`Home · Roster · Loot · Schedule`, Roster = Cards ⇄ Board, Loot = Priority + History)? I'll update mockup #1's nav and build the rest on it.
2. Good to **proceed through the remaining hero screens** (Roster cards+board, Loot priority+recipient picker, Schedule, ⌘K, Player Hub)?

And noted for after: a **UX flow graph** — how every screen and action connects (the app's intended flow at the UX level) — as part of the comprehensive review once the mockups are done. That'll pair perfectly with the glossary and the spec.

_🧑 Aaron — [Image #1] btw, this is the view on widescreen_

_🧑 Aaron — [Image: source: D:\FFXIV\Dev\xrp-dev\ffxiv-raid-planner\design\mockups\renders\01-static-home-widescreen.png]_

**🤖 Claude:**

Good catch — that's a real problem. The content is capped at 1280px and centered, so on an ultrawide it floats in a sea of dead space. Your app's DNA is actually *wide* (the old layout used 120rem), so the dashboard should use that width with intent rather than hugging the middle. I'll do two things: **raise the width cap** and **restructure Home into a proper two-region dashboard** (main actions left, ambient info in a right column) so width reads as designed, not empty. I'll also apply the **4-tab spine** (dropped Gear) we just landed on — shout if you want Gear back.

_🤖 Claude (working): Now I'll restructure Home into the two-region dashboard. Given the layout change, I'll rewrite the screen cleanly rather than patch seams. Now re-render at widescreen (~2000px) to verify it fills the space with intent._

**🤖 Claude:**

Fixed — the widescreen now reads as **designed, not empty**:

- **Width cap raised to 1760px** (matching your wide-layout DNA) so the dashboard breathes.
- **Two-region dashboard**: actionable stuff on the left (Needs your attention, BiS progress), ambient stuff in a right column (Recent activity, the Mount Farm track). The space is *used with intent* instead of a lonely center.
- **4-tab spine applied**: `Home · Roster · Loot · Schedule` (Gear dropped — its content lives in Roster's Board view, Home's readiness, and Loot's who-needs-it).

It'll still center gracefully on a normal laptop and collapse to one column on narrow/mobile.

This is a solid foundation. I'll now **build out the rest of the story** on this same chrome and present them as a set:

1. **Roster** — Cards ⇄ **Board** (the gearsheet matrix), one player menu, BiS woven in
2. **Loot** — Priority + History, with the **unified recipient picker** (the "who gets this drop" moment that kills the recurring bug)
3. **Schedule** — sessions + availability heatmap as the clock
4. **⌘K command palette** — the power fast-path
5. **Player Hub** — the Person-layer home (your statics + what needs you across them)

I'll render each at both normal and widescreen widths so we can sanity-check the layout, then we'll do your **comprehensive review + the UX flow graph**. Kicking off with Roster now — I'll surface the batch as they're ready.

**🧑 Aaron:**

To address your questions. I like the 4-tab spine and I'm good to start working through the rest. 

One thing to clarify: In terms of individual UI elements (buttons, dropdowns, sections, panels, text, font, color palette, etc basically the stuff covered in the design-system: is your mockup supposed to also reflect those design decisions, or is the mockup simply meant to define the structure and flow of the UI?

**🤖 Claude:**

Great question to pin down before I build more — let me draw the line clearly, because the mockups are doing a bit of both and you should know what to read into them.

## Three layers of fidelity (and which the mockup owns)

| Layer | Example | Is the mockup authoritative? |
|---|---|---|
| **Structure & flow** | what's on each screen, the nav, the journey, where the gear board lives | **Yes — this is the mockup's whole job.** |
| **Visual language direction** | dark theme, teal accent, role colors, card density, hierarchy, "feel" | **Directionally yes** — and it uses your *real tokens* (the colors/fonts are pulled verbatim from `index.css`), so it's a faithful preview, not a guess. |
| **Atomic component specs** | exact button padding/states, dropdown behavior, the component API | **No.** That stays the **design-system's** job. |

## The important nuance

The mockup is built as standalone HTML, so when you see a button or a dropdown, my `app.css` is **approximating** your real `Button`/`Select` components — using your tokens, but not importing the actual components. So:

- **Treat mockup atoms as "this should be the design-system's `Button`/`Select`/etc.,"** not as a new spec. The mockup *expresses* your design system; it doesn't fork or replace it. Your design system is good and survives — we keep and enforce it (per the product model).
- **Where the redesign introduces genuinely new UI**, the mockup is also *proposing* those components: the **context rail**, the **⌘K command palette**, the **unified recipient picker**, the **gear-board cell**, the **track card**. Those don't exist yet — the mockup floats a design, and we'd then formalize them *into* the design system.

## My recommendation

Keep the mockups at **structure + flow + visual-language direction** (true-to-token, faithful, but not pixel-exact component specs). Then, in the written spec + comprehensive review, I'll include a **"screen → components" map** marking each element as **existing** (use the design-system as-is), **refine** (small change needed), or **new** (formalize into the design-system). That keeps the mockup about the big picture and routes atomic-component decisions to where they belong — *after* the IA is locked, so we're not pixel-polishing buttons on a layout that might still move.

If you'd rather, I can *also* produce a dedicated **component & states sheet** (every button/dropdown/input variant, hover/focus/disabled) — but I'd do that *after* the screen set is approved, not now.

**So:** mockups = the app's skeleton + skin direction; design-system = the authoritative atoms (extended with the new components the mockups introduce).

Sound right? If so, I'll keep going with Roster → Loot → Schedule → ⌘K → Player Hub at this same fidelity, flagging new components as I go.

_🧑 Aaron — [Image #2] this is how it looks now, btw_

_🧑 Aaron — [Image: source: C:\Users\aaron\Desktop\Screenshot 2026-06-27 103018.png]_

**🤖 Claude:**

That widescreen view looks great — balanced and intentional now. And yes, you've got my fidelity approach right: **mockups = structure + flow + visual-language direction (true-to-token); the design-system stays the authority for atomic components, extended with the new pieces the mockups introduce.** Proceeding on that basis.

Building **Roster** now (Cards view first, then the Board/matrix). Same chrome, your real tokens.

_🧑 Aaron — [interrupted the previous response]_


---

## Appendix — Decisions Locked During This Session

A condensed index of the durable conclusions, so a fresh session can resume cleanly.

**App identity & vision**
- It's a **progression tool**, not a social hub (Discord + FFXIV already own the social layer).
- Vision: *"The home base for a FFXIV static — and the raiders in it."* (The "gearsheet" framing was deliberately dropped, to avoid limiting the vision by association.)
- **Two layers, not two apps:** Person layer (you, characters, availability, your statics) ↔ Static layer (the shared workspace). **Lead vs member = permissions/roles**, never separate builds.

**The structural model**
- **Progression loop is the protected core (Ring 0):** Roster → Schedule → Raid → Loot → Progress, all run on **the week** as a unifying clock (loot-week = session-week).
- **One Progress Engine, many tracks:** savage tier = flagship track (full BiS + loot priority); mounts, ultimates, gear-funnelling/alts = lighter tracks on the same engine. Kills the goals-vs-gear duplication.
- **Concentric rings:** 0 core loop · 1 coordination (schedule, strats, recruitment-as-matching) · 2 intelligence (FFLogs/analytics) · 3 long game (mounts, ultimates, alts).
- **Anti-sprawl rule:** every new feature must declare its **layer + ring/track + woven-or-parked**, or it doesn't ship.

**Navigation backbone**
- Chosen: **Option A — Jobs nav + ⌘K command palette**, with Option C's "what's next" home folded in *as a feature, not a separate mode*; **Layered** simple→power (Option 1). Rejected the roster-spine workspace (B, maintenance magnet) and two-mode designs (the sync trap).
- Global context rail = the Person layer only (~72px). In-static spine ≤2 levels deep.

**The 4-tab decision (Phase 6)**
- Spine finalised as **Home · Roster · Loot · Schedule** — **"Gear" dropped as a tab** (it was a 4th view of data already living in Roster/Loot/Home).
- **"Log" is always a verb** → action buttons inside Loot ("Log a drop" / "Log this week"); the record is **History**. Never a tab.
- Gear's three homes: **Roster Board** (the gearsheet matrix, via a `Cards ⇄ Board` toggle), **Loot** (per-drop "who needs this slot"), **Home** (readiness card).
- **Glossary is canonical:** Static, Track, Tier, Roster, BiS, Loot, Drop, Priority, Log (v.), Book/Page, Week. ("Static" never "group" in UI.)

**Mockup fidelity boundary**
- Mockups are authoritative for **structure + flow + visual-language direction** (built on the *real* tokens from `index.css`). They are **not** authoritative for atomic component specs — that stays the design system's job.
- New UI the mockups introduce (context rail, ⌘K palette, unified recipient picker, gear-board cell, track card) are **proposals** to formalise into the design system *after* IA lock.

**Docs & git housekeeping**
- Wrote **`docs/PRODUCT_MODEL.md`** as Tier-1 source of truth; **`REDESIGN_SPEC.md`** queued as the second canonical doc.
- **54 files archived** to `docs/archive/2026-06-27-pre-redesign/`; both `CLAUDE.md` files repointed to the canonical set.
- Committed as **`redesign/foundation`** branch (off `ui/F-design-system`), commit `2b4c293` (57 files). The 15 MB screenshot catalog (`design/app-ui-reference/`) left untracked. Can be rebased onto `main` later for a clean slate.

**What was being built next when the session ended**
- Remaining hero-screen mockups at the agreed fidelity, each at normal + widescreen: **Roster (Cards ⇄ Board) → Loot (priority + unified recipient picker + history) → Schedule (sessions + availability heatmap) → ⌘K palette → Player Hub.**
- Then: the **UX flow graph** (screen + action connections) and a **comprehensive review** with a screen→components map (existing / refine / new).
