# FFXIV Raid Planner - Audit Implementation Plan
**Generated:** 2026-01-10
**Based on:** 2026-01-10 Comprehensive Audit Report
**Total Issues:** 44 (3 Critical, 8 High, 23 Medium, 10 Low)

---

## Overview

This implementation plan prioritizes fixes from the comprehensive audit based on:
1. **Security impact** - Vulnerabilities that could lead to data breaches
2. **Production stability** - Issues affecting reliability/performance
3. **User experience** - Performance and usability improvements
4. **Code maintainability** - Technical debt reduction

Phases are organized by priority level (P0-P3) with realistic time estimates and dependencies.

---

## Phase 1: Critical Fixes (P0) - Week 1

**Goal:** Address production-breaking and critical performance issues
**Duration:** 3-5 days
**Prerequisites:** None

### Task 1.1: Fix Session Auto-Commit Pattern
**Issue:** CRITICAL-001
**File:** `backend/app/database.py`
**Estimated Time:** 2 hours
**Dependencies:** None

**Steps:**
1. Remove auto-commit from `get_session()` dependency
2. Add explicit `await session.commit()` to all write operations:
   - `POST /api/static-groups` - create group
   - `PUT /api/static-groups/{id}` - update group
   - `POST /api/static-groups/{id}/duplicate` - duplicate
   - All tier CRUD operations
   - All player CRUD operations
   - All loot tracking operations
3. Test all write endpoints to ensure commits happen
4. Test rollback behavior on errors

**Verification:**
```bash
# Run all backend tests
cd backend && pytest tests/ -v

# Manual verification
# 1. Create a group - should persist
# 2. Trigger an error during creation - should rollback
# 3. Check database directly to confirm
```

**Files Affected:**
- `backend/app/database.py` (1 change)
- `backend/app/routers/static_groups.py` (5 commits)
- `backend/app/routers/tiers.py` (6 commits)
- `backend/app/routers/loot_tracking.py` (8 commits)

---

### Task 1.2: Configure Connection Pool
**Issue:** CRITICAL-002
**File:** `backend/app/database.py`
**Estimated Time:** 1 hour
**Dependencies:** None

**Steps:**
1. Add pool configuration to `create_async_engine()`:
   ```python
   from sqlalchemy.pool import QueuePool

   engine = create_async_engine(
       settings.async_database_url,
       echo=settings.debug,
       poolclass=QueuePool,
       pool_size=20,
       max_overflow=10,
       pool_pre_ping=True,
       pool_recycle=3600,
       connect_args={
           "server_settings": {
               "statement_timeout": "30000"
           }
       } if "postgresql" in settings.async_database_url else {}
   )
   ```
2. Add environment variables for tuning:
   - `DB_POOL_SIZE` (default 20)
   - `DB_MAX_OVERFLOW` (default 10)
   - `DB_STATEMENT_TIMEOUT` (default 30000ms)
3. Document pool settings in README
4. Monitor pool usage in production logs

**Verification:**
```bash
# Load test with 100 concurrent requests
# Monitor connection pool metrics in logs
```

**Files Affected:**
- `backend/app/database.py` (1 file)
- `backend/app/config.py` (3 new settings)
- `README.md` (documentation)

---

### Task 1.3: Fix N+1 Query in Admin Dashboard
**Issue:** CRITICAL-003
**File:** `backend/app/routers/static_groups.py`
**Estimated Time:** 3 hours
**Dependencies:** None

**Steps:**
1. Replace relationship loading with subquery counts:
   ```python
   member_count_subq = (
       select(func.count(Membership.id))
       .where(Membership.static_group_id == StaticGroup.id)
       .correlate(StaticGroup)
       .scalar_subquery()
   )

   tier_count_subq = (
       select(func.count(TierSnapshot.id))
       .where(TierSnapshot.static_group_id == StaticGroup.id)
       .correlate(StaticGroup)
       .scalar_subquery()
   )

   query = (
       select(
           StaticGroup,
           member_count_subq.label('member_count'),
           tier_count_subq.label('tier_count')
       )
       .options(selectinload(StaticGroup.owner))
   )
   ```

2. Update response construction to use subquery results
3. Remove unnecessary `selectinload()` calls
4. Add query performance logging

**Verification:**
```bash
# Create 50 test groups with 10 members and 5 tiers each
# Time the admin dashboard endpoint
# Should go from 5-10s to <500ms
```

**Files Affected:**
- `backend/app/routers/static_groups.py` (1 endpoint)
- `backend/app/schemas/admin.py` (potentially)

---

**Phase 1 Summary:**
- Total Time: 6 hours
- Issues Fixed: 3
- Impact: Production stability, database performance, scalability

---

## Phase 2: High-Priority Security (P1) - Week 2

**Goal:** Address critical security vulnerabilities
**Duration:** 5-7 days
**Prerequisites:** Phase 1 complete

### Task 2.1: Migrate to httpOnly Cookies
**Issue:** HIGH-001
**Files:** `backend/app/routers/auth.py`, `frontend/src/stores/authStore.ts`
**Estimated Time:** 6 hours
**Dependencies:** None

**Steps:**

**Backend:**
1. Modify Discord callback to set httpOnly cookies:
   ```python
   @router.post("/discord/callback")
   async def discord_callback(response: Response, data: DiscordCallback):
       # ... existing OAuth flow ...

       # Set httpOnly cookies instead of returning in body
       response.set_cookie(
           key="access_token",
           value=access_token,
           httponly=True,
           secure=True,  # HTTPS only
           samesite="lax",
           max_age=settings.jwt_access_token_expire_minutes * 60
       )
       response.set_cookie(
           key="refresh_token",
           value=refresh_token,
           httponly=True,
           secure=True,
           samesite="lax",
           max_age=settings.jwt_refresh_token_expire_days * 86400
       )
       return {"message": "Login successful", "user": user_data}
   ```

2. Update `get_current_user` to read from cookies:
   ```python
   async def get_current_user(
       request: Request,
       session: AsyncSession = Depends(get_session)
   ):
       token = request.cookies.get("access_token")
       if not token:
           raise HTTPException(status_code=401, detail="Not authenticated")
       # ... rest of validation ...
   ```

3. Add logout endpoint to clear cookies:
   ```python
   @router.post("/logout")
   async def logout(response: Response):
       response.delete_cookie("access_token")
       response.delete_cookie("refresh_token")
       return {"message": "Logged out"}
   ```

**Frontend:**
1. Remove token storage from authStore persist config:
   ```typescript
   persist(
     (set, get) => ({ /* ... */ }),
     {
       name: 'auth-storage',
       partialize: (state) => ({
         user: state.user,  // ✅ Only persist user data
         // Remove: accessToken, refreshToken
       }),
     }
   )
   ```

2. Update API client to use credentials:
   ```typescript
   const response = await fetch(url, {
     credentials: 'include',  // ✅ Send cookies
     headers: {
       'Content-Type': 'application/json',
       // Remove: Authorization header
     },
   });
   ```

3. Update logout to call backend:
   ```typescript
   logout: async () => {
     await api.post('/api/auth/logout');
     set({ user: null });
   }
   ```

**Verification:**
- Test login flow - cookies should be set
- Verify httpOnly flag in browser DevTools
- Test API calls work with cookies
- Test logout clears cookies
- Test token refresh

**Files Affected:**
- `backend/app/routers/auth.py` (3 endpoints)
- `backend/app/dependencies.py` (1 function)
- `frontend/src/stores/authStore.ts` (3 functions)
- `frontend/src/services/api.ts` (1 configuration)

---

### Task 2.2: Add Content-Security-Policy Header
**Issue:** HIGH-002
**File:** `backend/app/middleware/security.py`
**Estimated Time:** 3 hours
**Dependencies:** None

**Steps:**
1. Add CSP header to SecurityHeadersMiddleware:
   ```python
   if settings.environment == "production":
       csp_directives = [
           "default-src 'self'",
           "script-src 'self' 'unsafe-inline'",  # Vite inline scripts
           "style-src 'self' 'unsafe-inline'",   # Tailwind CSS
           "img-src 'self' data: https://cdn.discordapp.com https://xivapi.com",
           "connect-src 'self' https://discord.com",
           "font-src 'self'",
           "object-src 'none'",
           "base-uri 'self'",
           "form-action 'self'",
           "frame-ancestors 'none'",
       ]
       response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
   ```

2. Test CSP doesn't break functionality:
   - Discord avatars load
   - XIVApi icons load
   - OAuth redirect works
   - Tailwind styles apply
   - Vite dev mode works

3. Add CSP reporting (optional):
   ```python
   "report-uri /api/csp-violations"
   ```

4. Monitor CSP violations in production

**Verification:**
```bash
# Check headers in production
curl -I https://api.your-domain.com/health

# Test frontend loads without CSP errors
# Check browser console for CSP violations
```

**Files Affected:**
- `backend/app/middleware/security.py` (1 function)

---

### Task 2.3: Fix SSRF in BiS Import
**Issue:** HIGH-003
**Files:** `backend/app/routers/bis.py`
**Estimated Time:** 4 hours
**Dependencies:** None

**Steps:**
1. Create SSRF-safe HTTP client utility:
   ```python
   # backend/app/utils/http_client.py
   import httpx
   import ipaddress
   from urllib.parse import urlparse

   ALLOWED_HOSTS = {
       "raw.githubusercontent.com",
       "api.xivgear.app",
       "www.garlandtools.org",
   }

   async def safe_external_request(url: str, timeout: float = 10.0):
       parsed = urlparse(url)

       # Validate allowed hosts
       if parsed.hostname not in ALLOWED_HOSTS:
           raise ValueError("Unauthorized external host")

       # Prevent private IP ranges
       try:
           ip = ipaddress.ip_address(parsed.hostname)
           if ip.is_private or ip.is_loopback or ip.is_link_local:
               raise ValueError("Private IPs not allowed")
       except ValueError:
           pass  # Hostname, not IP

       # Make request without following redirects
       async with httpx.AsyncClient(follow_redirects=False) as client:
           response = await client.get(url, timeout=timeout)

           # Reject redirects
           if response.status_code in (301, 302, 307, 308):
               raise ValueError("Redirects not allowed")

           return response
   ```

2. Replace all external API calls:
   ```python
   # In bis.py
   from app.utils.http_client import safe_external_request

   response = await safe_external_request(
       f"https://raw.githubusercontent.com/..."
   )
   ```

3. Add input validation for job/tier names
4. Add rate limiting per external endpoint

**Verification:**
```bash
# Test valid requests work
# Test redirect attack fails
# Test private IP attack fails
# Test invalid host fails
```

**Files Affected:**
- `backend/app/utils/http_client.py` (new file)
- `backend/app/routers/bis.py` (3 endpoints)

---

### Task 2.4: Add Database Health Check
**Issue:** HIGH-004
**File:** `backend/app/main.py`
**Estimated Time:** 1 hour
**Dependencies:** None

**Steps:**
1. Update health endpoint:
   ```python
   @app.get("/health")
   async def health_check(session: AsyncSession = Depends(get_session)):
       try:
           await session.execute(select(1))
           return {
               "status": "healthy",
               "version": "0.1.0",
               "database": "connected"
           }
       except Exception as e:
           logger.error("health_check_failed", error=str(e))
           return JSONResponse(
               status_code=503,
               content={
                   "status": "unhealthy",
                   "version": "0.1.0",
                   "database": "disconnected"
               }
           )
   ```

2. Test health check returns 503 when DB is down
3. Configure Railway health check timeout
4. Add monitoring alerts on health check failures

**Verification:**
```bash
# Stop database, check health endpoint returns 503
# Restart database, check returns 200
```

**Files Affected:**
- `backend/app/main.py` (1 endpoint)
- `railway.json` (health check config)

---

### Task 2.5: Add Loot Log Pagination
**Issue:** HIGH-005
**Files:** `backend/app/routers/loot_tracking.py`, `frontend/src/stores/lootTrackingStore.ts`
**Estimated Time:** 3 hours
**Dependencies:** None

**Steps:**

**Backend:**
1. Add pagination parameters:
   ```python
   @router.get("/{group_id}/tiers/{tier_id}/loot-log")
   async def get_loot_log(
       group_id: str,
       tier_id: str,
       week: int | None = None,
       limit: int = 100,
       offset: int = 0,
       ...
   ):
       limit = min(max(1, limit), 500)  # Cap at 500
       query = query.limit(limit).offset(offset)

       # Return total count for pagination UI
       total = await session.execute(
           select(func.count()).select_from(query.subquery())
       )

       return {
           "entries": results,
           "total": total.scalar(),
           "limit": limit,
           "offset": offset
       }
   ```

**Frontend:**
1. Update store to handle pagination:
   ```typescript
   fetchLootLog: async (tierId: string, options?: {
     week?: number;
     limit?: number;
     offset?: number;
   }) => {
       const params = new URLSearchParams({
           week: options?.week?.toString() || '',
           limit: options?.limit?.toString() || '100',
           offset: options?.offset?.toString() || '0',
       });
       const response = await api.get(
           `/api/static-groups/${groupId}/tiers/${tierId}/loot-log?${params}`
       );
       // Update state with paginated data
   }
   ```

2. Add pagination UI to SectionedLogView (optional for now)

**Verification:**
- Test fetching page 1 (offset 0, limit 100)
- Test fetching page 2 (offset 100, limit 100)
- Verify total count is accurate

**Files Affected:**
- `backend/app/routers/loot_tracking.py` (1 endpoint)
- `backend/app/schemas/loot_tracking.py` (response schema)
- `frontend/src/stores/lootTrackingStore.ts` (1 function)

---

### Task 2.6: Create Foreign Key Index
**Issue:** HIGH-006
**File:** `backend/alembic/versions/`
**Estimated Time:** 1 hour
**Dependencies:** None

**Steps:**
1. Create Alembic migration:
   ```bash
   cd backend
   alembic revision -m "add_foreign_key_indexes"
   ```

2. Add index creation:
   ```python
   def upgrade():
       op.create_index(
           "ix_loot_log_entries_recipient_player_id",
           "loot_log_entries",
           ["recipient_player_id"]
       )
       op.create_index(
           "ix_snapshot_players_tier_snapshot_id",
           "snapshot_players",
           ["tier_snapshot_id"]
       )
       # Add more as needed

   def downgrade():
       op.drop_index("ix_loot_log_entries_recipient_player_id")
       op.drop_index("ix_snapshot_players_tier_snapshot_id")
   ```

3. Test migration up/down
4. Deploy to production

**Verification:**
```bash
# Run migration
alembic upgrade head

# Check indexes created
psql -c "\d loot_log_entries"

# Verify query performance improves
```

**Files Affected:**
- `backend/alembic/versions/XXXX_add_foreign_key_indexes.py` (new)

---

### Task 2.7: Implement Request ID Tracking
**Issue:** HIGH-007
**Files:** `backend/app/middleware/request_id.py` (new), `backend/app/main.py`
**Estimated Time:** 2 hours
**Dependencies:** None

**Steps:**
1. Create RequestIDMiddleware:
   ```python
   # backend/app/middleware/request_id.py
   import uuid
   import structlog
   from starlette.middleware.base import BaseHTTPMiddleware

   class RequestIDMiddleware(BaseHTTPMiddleware):
       async def dispatch(self, request: Request, call_next):
           request_id = str(uuid.uuid4())
           request.state.request_id = request_id

           with structlog.contextvars.bound_contextvars(request_id=request_id):
               response = await call_next(request)

           response.headers["X-Request-ID"] = request_id
           return response
   ```

2. Add to app:
   ```python
   # backend/app/main.py
   from app.middleware.request_id import RequestIDMiddleware
   app.add_middleware(RequestIDMiddleware)
   ```

3. Update logger calls to include request_id automatically
4. Test request ID appears in logs and response headers

**Verification:**
```bash
# Make API request
curl -I https://api.your-domain.com/health
# Verify X-Request-ID header present

# Check logs for request_id field
```

**Files Affected:**
- `backend/app/middleware/request_id.py` (new)
- `backend/app/main.py` (1 line)

---

**Phase 2 Summary:**
- Total Time: 20 hours (~5 days)
- Issues Fixed: 7
- Impact: Major security hardening, production monitoring

---

## Phase 3: Frontend Optimization (P1/P2) - Week 3

**Goal:** Improve frontend performance and maintainability
**Duration:** 5-7 days
**Prerequisites:** None (can run parallel to Phase 2)

### Task 3.1: Split SectionedLogView Component
**Issue:** HIGH-008
**File:** `frontend/src/components/history/SectionedLogView.tsx`
**Estimated Time:** 8 hours
**Dependencies:** None

**Steps:**
1. Extract LootLogList component:
   ```tsx
   // components/history/LootLogList.tsx
   export const LootLogList = memo(({
     entries,
     onEdit,
     onDelete,
     viewMode
   }: LootLogListProps) => {
       // List rendering logic
   });
   ```

2. Extract LootLogFilters component:
   ```tsx
   // components/history/LootLogFilters.tsx
   export const LootLogFilters = ({
     selectedFloor,
     onFloorChange,
     selectedWeek,
     onWeekChange
   }: LootLogFiltersProps) => {
       // Filter UI logic
   };
   ```

3. Extract LootLogModals component:
   ```tsx
   // components/history/LootLogModals.tsx
   export const LootLogModals = ({
     editEntry,
     onSave,
     onCancel
   }: LootLogModalsProps) => {
       // Modal logic
   };
   ```

4. Refactor SectionedLogView to orchestrate:
   ```tsx
   export const SectionedLogView = () => {
       const [selectedFloor, setSelectedFloor] = useState('all');
       const [editEntry, setEditEntry] = useState(null);

       return (
           <>
               <LootLogFilters
                   selectedFloor={selectedFloor}
                   onFloorChange={setSelectedFloor}
               />
               <LootLogList
                   entries={filteredEntries}
                   onEdit={setEditEntry}
               />
               <LootLogModals
                   editEntry={editEntry}
                   onCancel={() => setEditEntry(null)}
               />
           </>
       );
   };
   ```

5. Update tests for each component
6. Verify functionality unchanged

**Verification:**
- All loot log features work
- No regressions in behavior
- File sizes: SectionedLogView <400 lines, each extracted component <400 lines

**Files Affected:**
- `frontend/src/components/history/SectionedLogView.tsx` (refactored)
- `frontend/src/components/history/LootLogList.tsx` (new)
- `frontend/src/components/history/LootLogFilters.tsx` (new)
- `frontend/src/components/history/LootLogModals.tsx` (new)

---

### Task 3.2: Add React.memo to List Items
**Issue:** MEDIUM-002
**Files:** Multiple components
**Estimated Time:** 4 hours
**Dependencies:** None

**Steps:**
1. Identify list components needing memoization:
   - PlayerGrid player cards
   - LootPriorityPanel entries
   - SectionedLogView log entries
   - WeaponPriorityList weapon items

2. Extract and memoize list item components:
   ```tsx
   // Before
   {players.map(player => (
       <PlayerCard key={player.id} player={player} />
   ))}

   // After
   const MemoizedPlayerCard = memo(PlayerCard);
   {players.map(player => (
       <MemoizedPlayerCard key={player.id} player={player} />
   ))}
   ```

3. Ensure props are stable (use useCallback for handlers)
4. Measure performance improvement with React DevTools Profiler

**Verification:**
- Use React DevTools Profiler
- Verify only changed items re-render
- Test with 8-player roster

**Files Affected:**
- `frontend/src/components/player/PlayerCard.tsx` (already memoized)
- `frontend/src/components/player/PlayerGrid.tsx` (use memo)
- `frontend/src/components/loot/LootPriorityPanel.tsx` (extract + memo)
- `frontend/src/components/history/SectionedLogView.tsx` (extract + memo)
- `frontend/src/components/weapon-priority/WeaponPriorityList.tsx` (extract + memo)

---

### Task 3.3: Standardize Error Display Patterns
**Issue:** MEDIUM-003
**Files:** All stores
**Estimated Time:** 4 hours
**Dependencies:** None

**Steps:**
1. Document error handling pattern:
   ```typescript
   // Pattern for user actions
   try {
       await api.save(data);
       showToast({ message: 'Saved', type: 'success' });
   } catch (error) {
       const parsed = parseApiError(error);
       showToast({ message: parsed.message, type: 'error' });
       logger.error('save_failed', { error: parsed });
       throw error; // Re-throw for component handling if needed
   }
   ```

2. Update all store actions to follow pattern:
   - authStore: login, refresh, logout
   - staticGroupStore: create, update, delete
   - tierStore: all CRUD operations
   - lootTrackingStore: all CRUD operations

3. Add error display tests
4. Document pattern in CLAUDE.md

**Verification:**
- Test each action shows appropriate toast
- Test errors are logged
- Test error messages are user-friendly

**Files Affected:**
- `frontend/src/stores/authStore.ts`
- `frontend/src/stores/staticGroupStore.ts`
- `frontend/src/stores/tierStore.ts`
- `frontend/src/stores/lootTrackingStore.ts`

---

**Phase 3 Summary:**
- Total Time: 16 hours (~4 days)
- Issues Fixed: 3
- Impact: Better frontend performance, improved maintainability

---

## Phase 4: Backend Improvements (P2) - Week 4

**Goal:** Address medium-priority backend issues
**Duration:** 3-5 days
**Prerequisites:** Phase 1 complete

### Task 4.1: Strengthen OAuth State Validation
**Issue:** MEDIUM-004
**Files:** `backend/app/routers/auth.py`
**Estimated Time:** 2 hours
**Dependencies:** None

**Steps:**
1. Bind state to client IP and user agent
2. Validate on callback
3. Test state CSRF attack fails

**Files Affected:**
- `backend/app/routers/auth.py` (2 endpoints)

---

### Task 4.2: Add CSRF Protection
**Issue:** MEDIUM-005
**File:** `backend/app/main.py`
**Estimated Time:** 2 hours
**Dependencies:** Task 2.1 (cookie migration)

**Steps:**
1. Add CSRFMiddleware
2. Update frontend to send CSRF token
3. Test CSRF attacks fail

**Files Affected:**
- `backend/app/main.py`
- `frontend/src/services/api.ts`

---

### Task 4.3: Validate BiS Path Input
**Issue:** MEDIUM-006
**File:** `backend/app/routers/bis.py`
**Estimated Time:** 1 hour
**Dependencies:** None

**Steps:**
1. Add job/tier whitelists
2. Validate extracted values
3. Test invalid inputs rejected

**Files Affected:**
- `backend/app/routers/bis.py`

---

### Task 4.4: Optimize Week Data Query
**Issue:** MEDIUM-011
**File:** `backend/app/routers/loot_tracking.py`
**Estimated Time:** 1 hour
**Dependencies:** None

**Steps:**
1. Replace 3 queries with 1 UNION
2. Test performance improvement

**Files Affected:**
- `backend/app/routers/loot_tracking.py`

---

### Task 4.5: Add Database Constraints
**Issue:** MEDIUM-012
**Files:** `backend/app/models/*.py`, `backend/alembic/versions/`
**Estimated Time:** 2 hours
**Dependencies:** None

**Steps:**
1. Add CHECK constraints to models
2. Create migration
3. Test constraints enforced

**Files Affected:**
- `backend/app/models/loot_log_entry.py`
- `backend/app/models/page_ledger_entry.py`
- `backend/alembic/versions/XXXX_add_check_constraints.py`

---

### Task 4.6: Add Request Size Limits
**Issue:** MEDIUM-013
**Files:** `backend/app/middleware/request_limit.py` (new), `backend/app/main.py`
**Estimated Time:** 1 hour
**Dependencies:** None

**Steps:**
1. Create RequestSizeLimitMiddleware
2. Add to app with 10MB limit
3. Test large payloads rejected

**Files Affected:**
- `backend/app/middleware/request_limit.py` (new)
- `backend/app/main.py`

---

### Task 4.7: Add Security Event Logging
**Issue:** MEDIUM-010
**File:** `backend/app/permissions.py`
**Estimated Time:** 2 hours
**Dependencies:** None

**Steps:**
1. Add logging to permission checks
2. Log admin privilege usage
3. Log failed auth attempts
4. Set up log monitoring alerts

**Files Affected:**
- `backend/app/permissions.py`
- `backend/app/routers/auth.py`

---

### Task 4.8: Add Migration Tests
**Issue:** MEDIUM-014
**File:** `backend/tests/test_migrations.py` (new)
**Estimated Time:** 3 hours
**Dependencies:** None

**Steps:**
1. Create migration test suite
2. Test upgrade/downgrade paths
3. Add to CI pipeline

**Files Affected:**
- `backend/tests/test_migrations.py` (new)
- `.github/workflows/` (CI config)

---

**Phase 4 Summary:**
- Total Time: 14 hours (~3.5 days)
- Issues Fixed: 8
- Impact: Better security, data integrity, testing

---

## Phase 5: Code Quality & Documentation (P3) - Week 5

**Goal:** Address low-priority issues and improve documentation
**Duration:** 2-3 days
**Prerequisites:** None (can be ongoing)

### Task 5.1: Standardize Logger Usage
**Issue:** LOW-002
**Files:** Multiple
**Estimated Time:** 1 hour

**Steps:**
1. Replace all `console.log/warn/error` with `logger`
2. Update CLAUDE.md with logging guidelines

---

### Task 5.2: Review ESLint Disables
**Issue:** LOW-001
**Files:** 4 files
**Estimated Time:** 30 minutes

**Steps:**
1. Review each `eslint-disable` comment
2. Remove if no longer needed
3. Document why needed if kept

---

### Task 5.3: Change Debug Default to False
**Issue:** LOW-003
**File:** `backend/app/config.py`
**Estimated Time:** 5 minutes

**Steps:**
1. Change `debug: bool = True` to `debug: bool = False`
2. Test development still works

---

### Task 5.4: Add OpenAPI Examples
**Issue:** MEDIUM-015
**Files:** All routers
**Estimated Time:** 6 hours

**Steps:**
1. Add request/response examples to all endpoints
2. Generate updated OpenAPI docs
3. Test Swagger UI shows examples

---

### Task 5.5: Document Backup Strategy
**Issue:** LOW-007
**Files:** `README.md`, `docs/`
**Estimated Time:** 1 hour

**Steps:**
1. Document Railway backup configuration
2. Add manual backup script
3. Document restore procedure

---

**Phase 5 Summary:**
- Total Time: 9 hours (~2 days)
- Issues Fixed: 5+
- Impact: Better maintainability, documentation

---

## Summary & Timeline

### Total Implementation Time
- **Phase 1 (P0):** 6 hours (~1 week with testing)
- **Phase 2 (P1 Security):** 20 hours (~1 week with testing)
- **Phase 3 (P1/P2 Frontend):** 16 hours (~1 week with testing)
- **Phase 4 (P2 Backend):** 14 hours (~1 week with testing)
- **Phase 5 (P3 Quality):** 9 hours (~1 week with testing)

**Total:** ~65 hours pure development + ~20 hours testing/review = **85 hours**

### Recommended Schedule (5-Week Sprint)

**Week 1 - Critical Fixes (P0)**
- Mon-Tue: Session management + connection pool (Tasks 1.1, 1.2)
- Wed-Thu: N+1 query fix (Task 1.3)
- Fri: Testing & deployment

**Week 2 - Security Hardening (P1)**
- Mon-Tue: Cookie migration (Task 2.1)
- Wed: CSP + SSRF (Tasks 2.2, 2.3)
- Thu: Health check + pagination (Tasks 2.4, 2.5)
- Fri: Indexes + request IDs (Tasks 2.6, 2.7)

**Week 3 - Frontend Optimization (P1/P2)**
- Mon-Wed: Split SectionedLogView (Task 3.1)
- Thu: Add React.memo (Task 3.2)
- Fri: Error patterns (Task 3.3)

**Week 4 - Backend Improvements (P2)**
- Mon-Tue: OAuth + CSRF + BiS validation (Tasks 4.1-4.3)
- Wed: Query optimization + constraints (Tasks 4.4, 4.5)
- Thu: Request limits + logging (Tasks 4.6, 4.7)
- Fri: Migration tests (Task 4.8)

**Week 5 - Polish & Documentation (P3)**
- Mon: Logger standardization (Task 5.1)
- Tue: ESLint review + debug default (Tasks 5.2, 5.3)
- Wed-Thu: OpenAPI docs (Task 5.4)
- Fri: Backup documentation + final review (Task 5.5)

---

## Risk Mitigation

### High-Risk Changes
1. **Cookie Migration (Task 2.1)** - Breaking change for existing users
   - **Mitigation:** Deploy with backward compatibility period
   - **Rollback Plan:** Keep localStorage code commented for quick revert

2. **Session Management (Task 1.1)** - Could break existing sessions
   - **Mitigation:** Test thoroughly in staging
   - **Rollback Plan:** Simple revert of commit pattern

3. **Component Refactoring (Task 3.1)** - Risk of breaking functionality
   - **Mitigation:** Comprehensive testing before merge
   - **Rollback Plan:** Keep old component file until verified

### Testing Strategy
- All tasks require:
  - Unit tests (backend)
  - Component tests (frontend)
  - Integration tests (E2E)
  - Manual QA in staging
- Critical tasks (P0/P1) require:
  - Load testing
  - Security testing
  - Rollback drills

### Deployment Strategy
- Phase 1: Deploy immediately after testing (production stability)
- Phase 2: Deploy incrementally (feature flags if needed)
- Phase 3: Deploy as complete set (frontend consistency)
- Phase 4: Deploy incrementally (backend improvements)
- Phase 5: Deploy as complete set (documentation)

---

## Success Metrics

### Phase 1 (P0)
- [ ] Admin dashboard loads in <500ms (from 5-10s)
- [ ] Database connection pool usage logged
- [ ] No transaction-related errors in production

### Phase 2 (P1)
- [ ] Zero XSS vectors via localStorage
- [ ] CSP violations = 0 in production
- [ ] SSRF attacks blocked in security testing
- [ ] Health check returns 503 when DB down
- [ ] Request IDs in all logs

### Phase 3 (P1/P2)
- [ ] SectionedLogView component <400 lines
- [ ] React DevTools shows reduced re-renders
- [ ] Consistent error display across all actions

### Phase 4 (P2)
- [ ] OAuth state CSRF attacks fail
- [ ] Database constraints prevent invalid data
- [ ] All migrations tested up/down

### Phase 5 (P3)
- [ ] Zero `console.log` in production code
- [ ] OpenAPI docs have examples for all endpoints
- [ ] Backup/restore documented and tested

---

## Maintenance After Implementation

### Ongoing Tasks
1. **Weekly:** Review new ESLint disables
2. **Monthly:** Dependency updates (npm audit, pip-audit)
3. **Quarterly:** Performance audit
4. **Annually:** Full security audit

### Monitoring Alerts
- Health check failures
- CSP violations
- Rate limit exceeded
- Database connection pool exhausted
- Request ID missing in logs
- Security event anomalies

---

**End of Implementation Plan**
