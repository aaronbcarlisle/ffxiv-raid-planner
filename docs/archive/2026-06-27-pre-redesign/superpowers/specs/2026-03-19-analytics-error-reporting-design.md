# Analytics, Usage Tracking & Error Reporting — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Version:** 1.0

## Context

The FFXIV Raid Planner has ~967 users and 356 statics but no visibility into how the platform is used, what features are popular, or what errors users encounter silently. A Reddit user recently reported BiS import network errors that went unnoticed because there's no error reporting system. This design adds:

1. **Admin analytics dashboard** — Platform health metrics, growth charts, top users/statics
2. **Usage analytics** — Track which features users interact with to guide development
3. **Error reporting** — Automatically capture and surface frontend + backend errors
4. **Discord alerts** — Proactive notification for critical/recurring errors

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Fully self-hosted | ~967 users, PostgreSQL handles trivially, no external dependencies |
| Collection method | Event bus extension | Existing `eventBus.ts` already emits many actions; extend and batch-POST |
| Error scope | Frontend + backend | Full picture when something breaks |
| Error grouping | Fingerprint-based | "47 users hit BiS import timeout" vs 47 individual entries |
| Dashboard layout | Sidebar navigation | Room to grow, error badge visibility, professional admin panel |
| Charts | Recharts | Most popular React charting lib, declarative, ~45KB gzipped |
| Alerts | Discord webhook | Already using Discord for auth; immediate notification |
| Retention | 90 days raw → aggregate | Keep DB lean while preserving long-term trends |

---

## Data Architecture

### Table: `analytics_events`

Stores every tracked user action. High-write, time-series data.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer, PK, autoincrement | |
| `user_id` | String(36), FK → users.id, nullable, indexed | Anonymous for unauthenticated actions |
| `session_id` | String(36), indexed | Generated per browser session (sessionStorage) |
| `event_category` | String(30) | `navigation`, `feature`, `action`, `engagement`, `admin` |
| `event_name` | String(50), indexed | `tab_switch`, `bis_import`, `loot_logged`, etc. |
| `event_data` | JSON, nullable | Flexible payload: `{ tab: "loot", method: "book" }` |
| `page_url` | String(500), nullable | Current page path (no domain) |
| `created_at` | Text | ISO 8601 timestamp |

**Indexes:** `(event_name)`, `(user_id)`, `(session_id)`, `(created_at)` for time-range queries.

### Table: `error_reports`

Stores individual error occurrences with full context.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer, PK, autoincrement | |
| `fingerprint` | String(64), indexed | SHA-256 hash of `type + message + location` |
| `user_id` | String(36), FK → users.id, nullable, indexed | |
| `session_id` | String(36), nullable | |
| `error_type` | String(30) | `api_error`, `js_error`, `unhandled_rejection`, `backend_error` |
| `message` | Text | Error message |
| `stack_trace` | Text, nullable | Stack trace (if available) |
| `context` | JSON | `{ url, browser, action, request_url, status_code, component, method, request_id }` |
| `severity` | String(10) | `warning`, `error`, `critical` |
| `source` | String(10) | `frontend`, `backend` |
| `is_reviewed` | Boolean, default false | Admin has seen this |
| `created_at` | Text | ISO 8601 timestamp |

**Indexes:** `(fingerprint)`, `(user_id)`, `(created_at)`, `(is_reviewed, created_at)`.

### Table: `analytics_daily_aggregates`

Rolled-up daily stats for long-term retention. Populated nightly from raw events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer, PK, autoincrement | |
| `date` | String(10) | `YYYY-MM-DD` |
| `metric_name` | String(50), indexed | `total_users`, `total_statics`, `event_count`, etc. |
| `metric_value` | Float | |
| `dimension_key` | String(100), nullable | Deterministic serialization of dimensions, e.g. `event_name=bis_import`. Used for unique constraint. |
| `dimensions` | JSON, nullable | Full dimension data for querying: `{ event_name: "bis_import" }` |

**Unique constraint:** `(date, metric_name, dimension_key)` to prevent duplicate aggregates. The `dimension_key` is a text column (not JSON) so PostgreSQL can enforce uniqueness. For events without dimensions, `dimension_key` is NULL (and the unique constraint treats NULLs as distinct, which is the desired behavior — one aggregate per metric per day with no dimensions).

---

## Backend Architecture

### New Router: `analytics.py` (`/api/analytics/`)

**Authenticated endpoints** (any logged-in user — `user_id` extracted from JWT):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analytics/events` | POST | Receive batch of frontend events (max 50 per request). Rate limited: 10 req/min per user. |
| `/api/analytics/errors` | POST | Receive frontend error report. Rate limited: 30 req/min per user. |

> **Note:** Both endpoints require authentication. Users must be logged in to use the app, so there are no anonymous tracking scenarios. The `user_id` column in `analytics_events` is still nullable to handle edge cases where the auth context is unavailable (e.g., error during login flow), but the typical path always has a user.

**Admin endpoints** (requires `is_admin`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/analytics/overview` | GET | KPI cards: total users, statics, avg claimed cards, error count (24h) |
| `/api/admin/analytics/growth?range=30d` | GET | Time-series for growth charts (users + statics over time) |
| `/api/admin/analytics/usage?range=30d` | GET | Feature usage: event counts by category/name |
| `/api/admin/analytics/top-users?limit=10` | GET | Users with most statics created/joined |
| `/api/admin/analytics/top-statics?limit=10` | GET | Statics with most loot log activity |
| `/api/admin/analytics/errors?status=unreviewed&page=1` | GET | Grouped errors: fingerprint, message, count, affected users, first/last seen |
| `/api/admin/analytics/errors/{fingerprint}` | GET | Error group detail with individual occurrences |
| `/api/admin/analytics/errors/{fingerprint}/review` | POST | Mark error group as reviewed |

**Request/response schemas** use existing Pydantic patterns from `backend/app/schemas/`.

### Backend Error Capture

Modify `register_exception_handlers()` in `backend/app/exceptions.py`:

```python
# In the generic exception handler (unhandled 500s):
# After logging, also write to error_reports table
async def _capture_backend_error(request, exc, severity="error"):
    fingerprint = hashlib.sha256(
        f"{type(exc).__name__}:{str(exc)}:{request.url.path}".encode()
    ).hexdigest()
    # Insert into error_reports with source="backend"
```

Also capture `ExternalServiceError` instances inside the existing `app_exception_handler` with a type check (since `ExternalServiceError` is a subclass of `AppException` and is caught by the same handler). Add capture logic for Discord OAuth, xivgear, and etro fetch failures.

### Discord Webhook Service

**New file: `backend/app/services/discord_webhook.py`**

```python
class DiscordWebhookService:
    async def send_error_alert(fingerprint, message, count, affected_users):
        # Embed format: red sidebar, error details, link to admin dashboard
        # Rate limit: max 1 per fingerprint per hour (in-memory tracker)
```

**Trigger conditions:**
- New error fingerprint with 3+ occurrences within 1 hour
- Any error with `severity=critical`
- Configurable via `DISCORD_WEBHOOK_URL` env var (optional — no webhook if not set)

### Data Retention Task

**New file: `backend/app/tasks/analytics_retention.py`**

Runs as a repeating background task on a 6-hour interval (via `asyncio.create_task` in the FastAPI lifespan handler). Uses idempotent logic to ensure it runs exactly once per day regardless of app restarts:

1. Check if aggregation has already run today by querying `analytics_daily_aggregates` for today's date — skip if already present
2. Query events older than 90 days
3. Upsert into `analytics_daily_aggregates` (counts by event_name per day) — upsert prevents duplicate aggregates on re-runs
4. Delete raw events older than 90 days
5. Delete individual error reports older than 90 days (keep aggregates)
6. Log: "Aggregated X events, deleted Y raw records"

> **Multi-worker safety:** If the app runs multiple workers (`uvicorn --workers N`), each worker runs its own retention task. The idempotent "check if already run today" logic and upsert aggregation handle this safely — no distributed locking needed.

---

## Frontend Architecture

### Analytics Collector

**New file: `frontend/src/services/analytics.ts`**

```typescript
class AnalyticsCollector {
  private buffer: AnalyticsEvent[] = [];
  private sessionId: string; // from sessionStorage
  private flushInterval: number; // 30 second timer

  // Subscribe to existing event bus events (~10 currently exist).
  // Most of the 36+ tracked events will need direct analytics.track() calls
  // in components, not event bus subscriptions.
  init(): void {
    // Respect Do Not Track
    if (navigator.doNotTrack === '1') return;
    eventBus.on(Events.PLAYER_UPDATED, (data) => this.track('action', 'player_update', data));
    eventBus.on(Events.LOOT_LOGGED, (data) => this.track('action', 'loot_logged', data));
    eventBus.on(Events.MODAL_OPENED, (data) => this.track('navigation', 'modal_open', data));
    // ... subscribe to all existing event bus events

    // Start 30s flush timer
    this.flushInterval = setInterval(() => this.flush(), 30000);

    // Flush on page unload using fetch with keepalive (NOT sendBeacon).
    // sendBeacon can't set credentials or custom headers for cross-origin requests.
    // fetch with keepalive: true supports credentials and survives page unload.
    window.addEventListener('beforeunload', () => this.flush(true));
  }

  track(category: string, name: string, data?: Record<string, unknown>): void {
    this.buffer.push({ category, name, data, pageUrl: location.pathname, timestamp: new Date().toISOString() });
  }

  private flush(isUnload = false): void {
    if (this.buffer.length === 0) return;
    const events = [...this.buffer];
    this.buffer = [];
    if (isUnload) {
      // Use fetch with keepalive for page unload — supports credentials + CORS
      fetch(`${API_BASE_URL}/api/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        credentials: 'include',
        keepalive: true,
      }).catch(() => {}); // Best-effort on unload
    } else {
      api.post('/api/analytics/events', { events }).catch(() => {
        // Re-add to buffer on failure (will retry next flush)
        this.buffer.unshift(...events);
      });
    }
  }
}

export const analytics = new AnalyticsCollector();
```

**Initialization:** Call `analytics.init()` in `App.tsx` after auth initialization.

**Respects `navigator.doNotTrack`** — if set, collector is a no-op.

### Error Reporter

**New file: `frontend/src/services/errorReporter.ts`**

```typescript
class ErrorReporter {
  private recentFingerprints = new Map<string, number>(); // fingerprint → timestamp

  init(): void {
    window.onerror = (msg, source, line, col, error) => this.report('js_error', error || msg, { source, line, col });
    window.onunhandledrejection = (event) => this.report('unhandled_rejection', event.reason);
  }

  report(type: string, error: unknown, extra?: Record<string, unknown>): void {
    const parsed = parseApiError(error); // reuse existing errorHandler
    const fingerprint = this.computeFingerprint(type, parsed.message);

    // Client-side dedup: skip if same fingerprint within 5 minutes
    const lastSent = this.recentFingerprints.get(fingerprint);
    if (lastSent && Date.now() - lastSent < 300_000) return;
    this.recentFingerprints.set(fingerprint, Date.now());

    api.post('/api/analytics/errors', {
      fingerprint, errorType: type, message: parsed.message,
      stackTrace: error instanceof Error ? error.stack : undefined,
      context: { url: location.href, browser: navigator.userAgent, ...extra },
      severity: parsed.status && parsed.status >= 500 ? 'critical' : 'error',
    }).catch(() => {}); // Don't recurse on error reporting failures
  }
}

export const errorReporter = new ErrorReporter();
```

**Integration with existing `handleApiError()`** in `lib/errorHandler.ts`:
Add a single line at the end of `handleApiError()`:
```typescript
errorReporter.report('api_error', error, { action: context });
```

### Events to Track

**50+ event types across 7 categories:**

| Category | Event Name | Trigger Point | Event Data |
|----------|-----------|---------------|------------|
| **navigation** | `tab_switch` | `TabNavigation` component | `{ tab: "players"\|"loot"\|"history"\|"stats" }` |
| **navigation** | `page_view` | Route changes (App.tsx) | `{ page: "home"\|"dashboard"\|"admin"\|"docs/*" }` |
| **navigation** | `modal_open` | Existing `MODAL_OPENED` event | `{ modal: "bis_import"\|"confirm"\|"assign_user" }` |
| **navigation** | `docs_view` | Docs page components | `{ page: "quickstart"\|"faq"\|"api"\|"release-notes" }` |
| **player** | `player_claim` | `usePlayerActions.claimPlayer` | `{ position }` |
| **player** | `player_release` | `usePlayerActions.releasePlayer` | `{}` |
| **player** | `player_configure` | Player setup complete | `{ job, role }` |
| **player** | `gear_toggle_has` | `GearStatusCheckbox` click | `{ slot, value }` |
| **player** | `gear_toggle_augmented` | `GearStatusCheckbox` augmented | `{ slot, value }` |
| **player** | `bis_import` | `BiSImportModal` success | `{ source: "xivgear"\|"etro", job }` |
| **player** | `bis_import_error` | `BiSImportModal` failure | `{ source, errorType }` |
| **player** | `player_reorder` | Drag-drop complete | `{}` |
| **loot** | `loot_log` | `lootTrackingStore.logLoot` | `{ floor, slot, method: "drop"\|"book"\|"tome"\|"purchase" }` |
| **loot** | `loot_delete` | Loot log deletion | `{ floor, slot }` |
| **loot** | `material_log` | Material log entry | `{ floor, materialType, method }` |
| **loot** | `page_ledger_entry` | Book tracking | `{ floor, bookType, transactionType }` |
| **loot** | `floor_cleared` | Mark floor cleared | `{ floor, week }` |
| **loot** | `week_advance` | Advance week number | `{ fromWeek, toWeek }` |
| **feature** | `filter_toggle` | Filter/view controls | `{ filter, value }` |
| **feature** | `view_mode_change` | ViewModeToggle | `{ mode: "compact"\|"expanded" }` |
| **feature** | `group_view_toggle` | GroupViewToggle | `{ view: "g1"\|"g2"\|"all" }` |
| **feature** | `sort_mode_change` | SortModeSelector | `{ mode }` |
| **feature** | `weapon_priority_set` | Weapon priority action | `{ action: "set"\|"lock"\|"unlock" }` |
| **feature** | `keyboard_shortcut` | useKeyboardShortcuts | `{ shortcut }` |
| **feature** | `theme_toggle` | useTheme | `{ theme: "dark"\|"light" }` |
| **feature** | `summary_tab_view` | Stats/Summary tab active | `{}` |
| **admin** | `api_key_create` | apiKeyStore.createKey | `{}` |
| **admin** | `static_create` | staticGroupStore.createGroup | `{ method: "wizard"\|"direct" }` |
| **admin** | `static_duplicate` | Group duplication | `{}` |
| **admin** | `tier_create` | tierStore.createTier | `{ tierId }` |
| **admin** | `invitation_create` | invitationStore.createInvite | `{ role }` |
| **wizard** | `setup_wizard_start` | SetupWizard opened | `{}` |
| **wizard** | `setup_wizard_step` | Step navigation | `{ step: 1\|2\|3\|4 }` |
| **wizard** | `setup_wizard_complete` | Wizard finish | `{ playerCount }` |
| **wizard** | `setup_wizard_abandon` | Wizard closed without finish | `{ lastStep }` |
| **wizard** | `log_week_wizard` | Log Week wizard used | `{ floor, week }` |
| **wizard** | `log_floor_wizard` | Log Floor wizard used | `{ floor }` |
| **engagement** | `share_code_copy` | Copy share code | `{ method: "click"\|"shift_click" }` |
| **engagement** | `player_link_copy` | Copy player deep link | `{}` |
| **engagement** | `tier_share_link` | Shift+click share code | `{}` |

---

## Admin Dashboard UI

### Sidebar Navigation

Replace the current `AdminDashboard.tsx` single-page with a sidebar-based admin layout.

**New file: `pages/AdminLayout.tsx`**
- Renders sidebar + content area
- Sidebar items: Overview, Statics, Usage Analytics, Error Log
- Error Log item shows red badge with unreviewed count
- Route: `/admin` with nested routes `/admin/overview`, `/admin/statics`, `/admin/usage`, `/admin/errors`

**New file: `pages/admin/AdminOverview.tsx`**
- KPI cards row: Total Users, Active Statics, Avg Cards/Static, Errors (24h)
- Each card shows value + week-over-week change with up/down indicator
- Growth charts (Recharts): User Growth (AreaChart) + Static Creation (BarChart)
- Time range selector: 7d / 30d / 90d / All
- Tables: Top Users by Statics Created + Most Active Statics (Loot Logging)
- Quick stats row: BiS Imports (7d), Loot Entries (7d), API Keys Active

**Move existing content: `pages/admin/AdminStatics.tsx`**
- Current AdminDashboard.tsx content (searchable/sortable table, View As, pagination)
- No changes to functionality

**New file: `pages/admin/AdminUsage.tsx`**
- Event distribution bar chart (by category)
- Tab visit donut chart (players vs loot vs history vs stats)
- Top 20 events table with counts, unique users, and 7-day trend sparklines
- Feature adoption table (BiS imports, API keys, weapon priorities, wizards)
- Time range selector

**New file: `pages/admin/AdminErrors.tsx`**
- Grouped error list: fingerprint, truncated message, occurrence count, affected users count, first/last seen, severity badge, reviewed status
- Sort by: count, last seen, severity
- Filter by: source (frontend/backend), severity, reviewed status
- Click to expand: shows last 10 individual occurrences with full context
- "Mark Reviewed" button per group (dismisses from unreviewed count)
- Bulk "Mark All Reviewed" button

### Component Reuse

| Need | Existing Component |
|------|-------------------|
| KPI card layout | New `AdminKpiCard` component (simple, follows design system) |
| Tables | Reuse patterns from existing `AdminDashboard.tsx` table |
| Badges | Existing `Badge` from `primitives/Badge.tsx` |
| Buttons | Existing `Button` from `primitives/Button.tsx` |
| Loading | Existing `Skeleton` from `ui/Skeleton.tsx` |
| Select (time range) | Existing `Select` from `ui/Select.tsx` |
| Search | Existing `Input` from `ui/Input.tsx` |

---

## Implementation Phases

### Phase 1: Foundation (Backend + Frontend Services)
- Create 3 DB tables + Alembic migration
- Create `analytics.py` router (POST events, POST errors)
- Create `AnalyticsCollector` service + wire to event bus
- Create `ErrorReporter` service + wire to `handleApiError` + `window.onerror`
- Add tracking calls to ~15 highest-value event points
- **Milestone:** Events and errors flowing into database

### Phase 2: Admin Dashboard Shell
- Create `AdminLayout.tsx` with sidebar navigation
- Create `AdminOverview.tsx` with KPI cards + growth charts (Recharts)
- Implement admin analytics GET endpoints (overview, growth, top-users, top-statics)
- Move existing admin content to `AdminStatics.tsx`
- **Milestone:** Working Overview tab with real data

### Phase 3: Usage Analytics + Error Log
- Create `AdminUsage.tsx` with charts and tables
- Create `AdminErrors.tsx` with grouped errors, drill-down, mark-reviewed
- Implement remaining admin GET endpoints (usage, errors, error detail)
- Add remaining ~35 tracking event points across components
- **Milestone:** Full admin dashboard operational

### Phase 4: Alerts + Retention
- Create `discord_webhook.py` service
- Add webhook trigger to error capture flow
- Create retention task (90-day aggregate + cleanup)
- Add `DISCORD_WEBHOOK_URL` to deployment config
- **Milestone:** Proactive alerts + sustainable data retention

---

## Files to Create

| File | Purpose |
|------|---------|
| `backend/app/models/analytics.py` | AnalyticsEvent, ErrorReport, AnalyticsDailyAggregate models |
| `backend/app/schemas/analytics.py` | Pydantic schemas for analytics endpoints |
| `backend/app/routers/analytics.py` | Analytics + admin analytics endpoints |
| `backend/app/services/discord_webhook.py` | Discord webhook alert service |
| `backend/app/tasks/analytics_retention.py` | Nightly aggregation + cleanup |
| `backend/alembic/versions/XXX_add_analytics_tables.py` | Migration |
| `frontend/src/services/analytics.ts` | AnalyticsCollector (event bus → batch POST) |
| `frontend/src/services/errorReporter.ts` | ErrorReporter (errors → POST) |
| `frontend/src/pages/AdminLayout.tsx` | Sidebar navigation wrapper |
| `frontend/src/pages/admin/AdminOverview.tsx` | KPI + growth charts |
| `frontend/src/pages/admin/AdminStatics.tsx` | Existing admin table (moved) |
| `frontend/src/pages/admin/AdminUsage.tsx` | Feature usage analytics |
| `frontend/src/pages/admin/AdminErrors.tsx` | Error log with grouping |
| `frontend/src/components/admin/AdminKpiCard.tsx` | Reusable KPI card component |
| `frontend/src/components/admin/AdminSidebar.tsx` | Sidebar navigation component |

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Initialize analytics + errorReporter, update admin routes (current `/admin/statics` becomes nested `/admin/statics` under new layout; add redirect from old path) |
| `frontend/src/lib/errorHandler.ts` | Add `errorReporter.report()` call in `handleApiError()` |
| `frontend/src/pages/GroupView.tsx` | Add `analytics.track()` for tab switches |
| `frontend/src/components/player/BiSImportModal.tsx` | Track import success/failure |
| `frontend/src/stores/lootTrackingStore.ts` | Track loot logging method |
| `frontend/src/hooks/useGroupViewState.ts` | Track view mode, sort, filter changes |
| `frontend/src/components/wizard/SetupWizard.tsx` | Track wizard start/complete/abandon |
| `backend/app/main.py` | Register analytics router, start retention task |
| `backend/app/exceptions.py` | Add error capture to exception handlers |
| `backend/app/models/__init__.py` | Export new models |
| `frontend/package.json` | Add `recharts` dependency |

---

## Verification

### End-to-end testing plan:

1. **Events flowing:** Open app → switch tabs → check `analytics_events` table has entries
2. **Error capture:** Trigger a network error (disconnect backend) → check `error_reports` table
3. **Admin overview:** Log in as admin → navigate to `/admin` → verify KPI cards show correct counts
4. **Growth charts:** Verify charts render with correct time-range filtering
5. **Usage tab:** Verify event distribution and top events match raw data
6. **Error log:** Verify errors are grouped by fingerprint, counts are correct, drill-down works
7. **Mark reviewed:** Mark an error group reviewed → verify badge count decreases
8. **Discord webhook:** Set `DISCORD_WEBHOOK_URL` → trigger 3+ errors → verify webhook fires
9. **Retention:** Manually insert old events → run retention task → verify aggregation + deletion
10. **Existing tests:** Run `pnpm test` (508 tests) + `pytest tests/ -q` (346 tests) — all pass
11. **CI pipeline:** `tsc --noEmit`, `lint`, `check:design-system:strict`, `build` — all pass
