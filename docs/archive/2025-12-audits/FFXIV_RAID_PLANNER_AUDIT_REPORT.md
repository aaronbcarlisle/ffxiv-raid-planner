# FFXIV Raid Planner - Comprehensive Codebase Audit Report

**Date:** December 29, 2025  
**Codebase Version:** Development Main Branch  
**Auditor:** Claude (Anthropic)

---

## Executive Summary

The FFXIV Raid Planner is a well-architected web application with a clean separation of concerns between frontend (React/TypeScript) and backend (FastAPI/Python). The codebase demonstrates solid engineering fundamentals with room for optimization and modernization to reach production-grade quality.

**Overall Assessment:** 🟢 Good foundation with actionable improvements needed

| Area | Rating | Priority Items |
|------|--------|----------------|
| Frontend/UX | B+ | Error boundaries, loading states, accessibility |
| UI Design | A- | Minor polish, skeleton loading, animations |
| Backend | B+ | Caching, rate limiting, database migrations |
| Code Quality | B+ | Testing, documentation, dead code removal |

---

## Part 1: Frontend/UX Experience

### 1.1 Error Handling & Recovery

**Current State:**
- Basic error states in stores (`error: string | null`)
- Minimal user feedback on failures
- No automatic retry mechanisms

**Issues Found:**

```typescript
// tierStore.ts - Error handling is generic
catch (error) {
  set({
    error: error instanceof Error ? error.message : 'Failed to fetch tiers',
    isLoading: false,
  });
}
```

**Recommendations:**

1. **Add Error Boundaries** (Critical)
```typescript
// Create ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service (Sentry, etc.)
    console.error('Uncaught error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}
```

2. **Implement Toast Notifications** (High Priority)
```typescript
// Create a toast system for transient errors/success messages
// The Toast.tsx component exists but isn't integrated
import { useToast } from '../hooks/useToast';

// Usage in stores:
try {
  await updatePlayer(groupId, tierId, playerId, data);
  toast.success('Player updated');
} catch (error) {
  toast.error('Failed to update player');
}
```

3. **Add Retry Logic for Network Failures**
```typescript
// api.ts - Add exponential backoff
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isNetworkError(error)) {
      await sleep(delay);
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}
```

### 1.2 Loading States & Skeleton UI

**Current State:**
- Basic "Loading..." text indicators
- No skeleton screens
- Flash of empty content

**Issues Found:**

```typescript
// GroupView.tsx - Abrupt loading state
if (isLoading) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <p className="text-text-muted">Loading...</p>
    </div>
  );
}
```

**Recommendations:**

1. **Add Skeleton Components** (Medium Priority)
```typescript
// components/ui/Skeleton.tsx
export function PlayerCardSkeleton() {
  return (
    <div className="bg-bg-card rounded-lg border border-border-subtle p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded bg-bg-hover" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-bg-hover rounded w-24" />
          <div className="h-3 bg-bg-hover rounded w-32" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-3 bg-bg-hover rounded" />
        ))}
      </div>
    </div>
  );
}
```

2. **Implement Suspense Boundaries** (Medium Priority)
```typescript
// Use React Suspense for code-split routes
const GroupView = lazy(() => import('./pages/GroupView'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// In App.tsx
<Suspense fallback={<PageSkeleton />}>
  <Routes>...</Routes>
</Suspense>
```

### 1.3 Optimistic Updates & Perceived Performance

**Current State:**
- Optimistic updates exist for drag-and-drop reordering
- Most operations wait for server response

**Issues Found:**

```typescript
// PlayerCard gear updates wait for server
const handleGearChange = (slot: string, updates: Partial<GearSlotStatus>) => {
  const newGear = player.gear.map((g) => ...);
  onUpdate({ gear: newGear }); // This waits for server
};
```

**Recommendations:**

1. **Extend Optimistic Updates to Gear Changes** (Medium Priority)
```typescript
// tierStore.ts - Add optimistic gear updates
updatePlayerOptimistic: async (groupId, tierId, playerId, data) => {
  const previousTier = get().currentTier;
  
  // Apply optimistically
  set((state) => ({
    currentTier: {
      ...state.currentTier,
      players: state.currentTier?.players?.map(p =>
        p.id === playerId ? { ...p, ...data } : p
      ),
    },
  }));
  
  try {
    await authRequest(`/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch (error) {
    // Rollback on failure
    set({ currentTier: previousTier });
    throw error;
  }
}
```

### 1.4 Accessibility (A11y)

**Current State:**
- Basic semantic HTML
- Missing ARIA labels in interactive components
- No keyboard navigation for custom dropdowns

**Issues Found:**

```typescript
// JobPicker dropdown lacks proper ARIA
<div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-auto...">
  {roleOrder.map((role) => (
    <div key={role}>
      // Missing role="listbox", aria-labelledby, etc.
    </div>
  ))}
</div>
```

**Recommendations:**

1. **Add ARIA Labels** (High Priority)
```typescript
// JobPicker with proper ARIA
<div
  role="listbox"
  aria-labelledby="job-picker-label"
  aria-activedescendant={selectedJobId}
>
  {roles.map((role) => (
    <div role="group" aria-label={getRoleDisplayName(role)}>
      {jobsByRole[role].map((job) => (
        <button
          role="option"
          aria-selected={player.job === job.abbreviation}
          id={`job-option-${job.abbreviation}`}
        >
          ...
        </button>
      ))}
    </div>
  ))}
</div>
```

2. **Implement Keyboard Navigation** (High Priority)
```typescript
// Add to dropdown components
const handleKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, items.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      selectItem(items[focusedIndex]);
      break;
    case 'Escape':
      setIsOpen(false);
      break;
  }
};
```

3. **Add Focus Management for Modals** (Medium Priority)
```typescript
// Modal.tsx - Trap focus and manage aria
export function Modal({ children, isOpen, onClose, title }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isOpen) {
      const firstFocusable = modalRef.current?.querySelector('button, input');
      firstFocusable?.focus();
    }
  }, [isOpen]);
  
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
    >
      <h2 id="modal-title">{title}</h2>
      {children}
    </div>
  );
}
```

### 1.5 Form Validation & User Feedback

**Current State:**
- Minimal client-side validation
- Inconsistent error display

**Recommendations:**

1. **Add Client-Side Validation** (Medium Priority)
```typescript
// Create useForm hook or use react-hook-form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  tierId: z.string().min(1, 'Select a tier'),
});

// Usage
const { register, handleSubmit, errors } = useForm({
  resolver: zodResolver(schema),
});
```

---

## Part 2: UI Design & Visual Polish

### 2.1 Design System Consistency

**Current State:**
- Well-defined CSS custom properties (Teal Glow theme)
- Some inline Tailwind inconsistencies
- Missing component-level tokens

**Issues Found:**

```css
/* index.css - Good foundation */
--color-bg-primary: #050508;
--color-accent: #14b8a6;

/* But components use raw values sometimes */
// In components:
className="bg-teal-500/20" // Should use theme variable
className="text-zinc-400"   // Should use --color-text-muted
```

**Recommendations:**

1. **Create Design Token System** (Medium Priority)
```css
/* index.css - Add semantic tokens */
@theme {
  /* Existing tokens... */
  
  /* Component-specific tokens */
  --btn-primary-bg: linear-gradient(135deg, var(--color-accent), var(--color-accent-deep));
  --btn-primary-hover: brightness(1.1);
  --card-shadow: 0 0 20px rgba(20, 184, 166, 0.1);
  --card-border-hover: rgba(20, 184, 166, 0.3);
  
  /* Spacing scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
}
```

2. **Standardize Button Components** (Low Priority)
```typescript
// components/ui/Button.tsx
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({ 
  variant = 'primary',
  size = 'md',
  children,
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded font-medium transition-all',
        variants[variant],
        sizes[size],
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

### 2.2 Animation & Micro-interactions

**Current State:**
- Basic transitions on hover
- No entrance/exit animations
- Missing feedback animations

**Recommendations:**

1. **Add Page Transitions** (Low Priority)
```typescript
// Use framer-motion or CSS animations
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.2 }}
  >
    <Outlet />
  </motion.div>
</AnimatePresence>
```

2. **Add List Animations** (Low Priority)
```css
/* Add to index.css */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.player-card-enter {
  animation: slideIn 0.2s ease-out;
}
```

### 2.3 Responsive Design Improvements

**Current State:**
- Good breakpoint system (custom 3xl at 1400px)
- Some mobile layout issues

**Issues Found:**

```typescript
// Header.tsx - Gets cramped on mobile
<div className="flex items-center gap-4 min-w-0">
  {/* All elements stay visible on mobile */}
</div>
```

**Recommendations:**

1. **Add Mobile Header Redesign** (Medium Priority)
```typescript
// Collapse header elements into hamburger menu on mobile
<div className="sm:hidden">
  <MobileMenu>
    <StaticSwitcher />
    <TierSelector />
    <SettingsPopover />
  </MobileMenu>
</div>
<div className="hidden sm:flex items-center gap-4">
  {/* Desktop layout */}
</div>
```

2. **Improve Touch Targets** (High Priority)
```css
/* Ensure minimum 44px touch targets */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Mobile-specific padding */
@media (max-width: 640px) {
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.25rem;
  }
}
```

### 2.4 Dark Mode Refinements

**Current State:**
- Single dark theme (Teal Glow)
- No light mode option

**Recommendations:**

1. **Consider Adding Light Mode** (Low Priority - Future)
```css
/* index.css - Prepare for theming */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --color-bg-primary: #fafafa;
    --color-bg-secondary: #f5f5f5;
    --color-text-primary: #18181b;
    /* etc. */
  }
}
```

---

## Part 3: Backend Architecture & API

### 3.1 API Design & RESTful Compliance

**Current State:**
- Clean RESTful structure
- Consistent endpoint naming
- Proper HTTP status codes

**Issues Found:**

```python
# static_groups.py - Some endpoint inconsistencies
@router.post("/{group_id}/members")  # Should include body schema in OpenAPI
async def add_member(
    group_id: str,
    user_id: str,  # This is a query param, should be in body
    role: MemberRoleEnum = MemberRoleEnum.MEMBER,
    ...
):
```

**Recommendations:**

1. **Standardize Request Bodies** (Medium Priority)
```python
# Create proper request schema
class AddMemberRequest(BaseModel):
    user_id: str
    role: MemberRoleEnum = MemberRoleEnum.MEMBER

@router.post("/{group_id}/members")
async def add_member(
    group_id: str,
    data: AddMemberRequest,
    ...
):
```

2. **Add API Versioning** (Low Priority - Future)
```python
# Prepare for API versioning
app.include_router(auth_router, prefix="/api/v1")
app.include_router(static_groups_router, prefix="/api/v1")

# Or use header-based versioning
@app.middleware("http")
async def api_version_middleware(request: Request, call_next):
    version = request.headers.get("X-API-Version", "1")
    # Route to appropriate handler
```

### 3.2 Database & ORM Optimization

**Current State:**
- Async SQLAlchemy with proper session management
- Good relationship definitions
- Missing database migrations

**Issues Found:**

```python
# database.py - Auto-creates tables, no migrations
async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

**Recommendations:**

1. **Add Alembic Migrations** (Critical for Production)
```bash
# Setup
pip install alembic
alembic init alembic

# Configure alembic.ini
sqlalchemy.url = driver://user:pass@localhost/dbname

# Usage
alembic revision --autogenerate -m "Add new field"
alembic upgrade head
```

2. **Add Database Indexes** (High Priority)
```python
# models/snapshot_player.py
class SnapshotPlayer(Base):
    __tablename__ = "snapshot_players"
    
    # Add composite index for common queries
    __table_args__ = (
        Index('ix_snapshot_players_tier_sort', 'tier_snapshot_id', 'sort_order'),
        Index('ix_snapshot_players_user', 'user_id'),
    )
```

3. **Optimize N+1 Queries** (Medium Priority)
```python
# Use selectinload consistently
result = await session.execute(
    select(TierSnapshot)
    .where(TierSnapshot.static_group_id == group_id)
    .options(
        selectinload(TierSnapshot.players)
        .selectinload(SnapshotPlayer.user)
    )
)
```

### 3.3 Caching Strategy

**Current State:**
- Simple in-memory cache for XIVAPI items
- No Redis/distributed caching
- No HTTP caching headers

**Issues Found:**

```python
# bis.py - Simple dict cache
_item_cache: dict[int, dict] = {}

# Problem: Cache is per-worker, not shared
# Problem: No TTL/invalidation
```

**Recommendations:**

1. **Add Redis Caching** (High Priority for Production)
```python
# cache.py
import redis.asyncio as redis
from functools import wraps

redis_client = redis.from_url(settings.redis_url)

def cached(ttl: int = 3600):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{hash(args + tuple(kwargs.items()))}"
            cached_value = await redis_client.get(key)
            if cached_value:
                return json.loads(cached_value)
            
            result = await func(*args, **kwargs)
            await redis_client.setex(key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator

# Usage
@cached(ttl=86400)  # 24 hours
async def fetch_item_from_xivapi(item_id: int) -> dict:
    ...
```

2. **Add HTTP Cache Headers** (Medium Priority)
```python
# Add response headers for static data
from fastapi.responses import JSONResponse

@router.get("/bis/presets/{job}")
async def get_bis_presets(job: str):
    data = await _get_presets(job)
    return JSONResponse(
        content=data,
        headers={
            "Cache-Control": "public, max-age=3600",
            "ETag": hashlib.md5(json.dumps(data).encode()).hexdigest(),
        }
    )
```

### 3.4 Rate Limiting & Security

**Current State:**
- No rate limiting
- Basic CORS configuration
- JWT authentication

**Issues Found:**

```python
# config.py - Wide open CORS for dev
cors_origins: str = "http://localhost:5173,http://localhost:5174,..."

# No rate limiting middleware
```

**Recommendations:**

1. **Add Rate Limiting** (Critical for Production)
```python
# Install slowapi
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Usage
@router.post("/api/auth/discord/callback")
@limiter.limit("10/minute")
async def discord_callback(request: Request, ...):
    ...
```

2. **Tighten CORS for Production** (High Priority)
```python
# config.py - Production CORS
@property
def cors_origins_list(self) -> list[str]:
    if self.environment == "production":
        return [self.frontend_url]  # Only allow your domain
    return [origin.strip() for origin in self.cors_origins.split(",")]
```

3. **Add Security Headers** (Medium Priority)
```python
from starlette.middleware import Middleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

# In production
if settings.environment == "production":
    app.add_middleware(HTTPSRedirectMiddleware)
    
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

### 3.5 Error Handling & Logging

**Current State:**
- Basic exception classes
- Minimal logging
- No structured error responses

**Issues Found:**

```python
# permissions.py - Custom exceptions exist
class NotFound(Exception):
    pass

class PermissionDenied(Exception):
    pass

# But no centralized error handling
```

**Recommendations:**

1. **Add Centralized Exception Handler** (High Priority)
```python
# errors.py
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

class APIError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message

@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "path": request.url.path,
            }
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            }
        }
    )
```

2. **Add Structured Logging** (High Priority)
```python
# logging_config.py
import structlog

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()

# Usage
logger.info("player_updated", player_id=player_id, group_id=group_id)
```

---

## Part 4: Code Quality & Maintenance

### 4.1 Testing Coverage

**Current State:**
- No test files found
- No testing configuration

**Recommendations:**

1. **Add Frontend Tests** (Critical)
```typescript
// __tests__/stores/tierStore.test.ts
import { useTierStore } from '../stores/tierStore';
import { renderHook, act } from '@testing-library/react-hooks';

describe('tierStore', () => {
  beforeEach(() => {
    useTierStore.setState({ tiers: [], currentTier: null });
  });

  it('should fetch tiers', async () => {
    const { result } = renderHook(() => useTierStore());
    
    await act(async () => {
      await result.current.fetchTiers('group-123');
    });
    
    expect(result.current.tiers).toHaveLength(1);
  });
});
```

2. **Add Backend Tests** (Critical)
```python
# tests/test_static_groups.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_create_static_group():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/static-groups",
            json={"name": "Test Static"},
            headers={"Authorization": f"Bearer {test_token}"}
        )
        assert response.status_code == 201
        assert response.json()["name"] == "Test Static"
```

3. **Add E2E Tests** (Medium Priority)
```typescript
// cypress/e2e/group-view.cy.ts
describe('Group View', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/group/ABC123');
  });

  it('should display player cards', () => {
    cy.get('[data-testid="player-card"]').should('have.length', 8);
  });

  it('should update gear on checkbox click', () => {
    cy.get('[data-testid="gear-checkbox-weapon"]').first().click();
    cy.get('[data-testid="completion-count"]').should('contain', '1/11');
  });
});
```

### 4.2 Dead Code & Unused Files

**Files to Review/Remove:**

1. **Design Mockups in morgue folder** - Can be archived
```
design/morgue/concept-a-dark-dashboard.jsx
design/morgue/concept-a-enhanced-with-priority.jsx
design/morgue/concept-a-spreadsheet-style.jsx
...
```

2. **Unused React asset**
```
frontend/src/assets/react.svg  # Default Vite asset, not used
```

3. **Potentially unused components** - Verify usage:
```typescript
// frontend/src/components/player/AddSlotCard.tsx - Verify if used
// frontend/src/components/player/RoleJobSelector.tsx - Verify if used
```

### 4.3 Type Safety Improvements

**Issues Found:**

```typescript
// types/index.ts - Some loose typing
export interface SnapshotPlayer {
  role: string;  // Should be Role type
  position?: RaidPosition | null;  // Redundant null | undefined
}

// api.ts - Any types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DebouncedFn<T extends (...args: any[]) => any>
```

**Recommendations:**

1. **Tighten Type Definitions**
```typescript
// types/index.ts
export interface SnapshotPlayer {
  role: Role;  // Use union type
  position?: RaidPosition;  // Remove redundant null
}
```

2. **Remove ESLint Disables**
```typescript
// api.ts - Use proper generics instead
type AnyFunction = (...args: unknown[]) => unknown;

export type DebouncedFn<T extends AnyFunction> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};
```

### 4.4 Code Organization

**Current Structure:** Good, but some improvements possible

**Recommendations:**

1. **Create Hooks Directory** (Low Priority)
```
frontend/src/hooks/
  useDebounce.ts
  useLocalStorage.ts
  useMediaQuery.ts
  useClickOutside.ts
```

2. **Group Related Utilities**
```
frontend/src/utils/
  formatting/
    date.ts
    numbers.ts
  validation/
    schema.ts
  calculations/
    priority.ts
    gear.ts
```

3. **Add Barrel Exports Consistently**
```typescript
// components/index.ts
export * from './auth';
export * from './layout';
export * from './player';
export * from './ui';
```

### 4.5 Documentation Improvements

**Current State:**
- Excellent CLAUDE.md project guide
- Inline comments present but inconsistent
- No API documentation beyond endpoint list

**Recommendations:**

1. **Add JSDoc Comments** (Medium Priority)
```typescript
/**
 * Calculate player needs for gear acquisition
 * @param player - The snapshot player to analyze
 * @returns PlayerNeeds object with raid/tome needs and upgrade counts
 * @example
 * const needs = calculatePlayerNeeds(player);
 * console.log(`${needs.raidNeed} raid pieces needed`);
 */
export function calculatePlayerNeeds(player: SnapshotPlayer): PlayerNeeds {
  ...
}
```

2. **Add OpenAPI Descriptions** (Medium Priority)
```python
@router.get(
    "/bis/presets/{job}",
    response_model=BiSPresetsResponse,
    summary="Get BiS presets for a job",
    description="""
    Returns curated Best-in-Slot gear sets from The Balance Discord.
    
    Sources checked in order:
    1. Local preset cache (all 21 jobs)
    2. GitHub xiv-gear-planner/static-bis-sets fallback
    
    Filter by category to show only Savage or Ultimate BiS sets.
    """,
)
async def get_bis_presets(
    job: str = Path(..., description="Job abbreviation (e.g., DRG, WHM)"),
    category: str | None = Query(None, description="Filter: 'savage', 'ultimate', or None for all"),
):
```

---

## Part 5: Performance Optimization

### 5.1 Bundle Size Analysis

**Recommendations:**

1. **Add Bundle Analyzer** (Medium Priority)
```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
    }),
  ],
});
```

2. **Code Split Routes** (Medium Priority)
```typescript
// App.tsx
const Dashboard = lazy(() => import('./pages/Dashboard'));
const GroupView = lazy(() => import('./pages/GroupView'));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="group/:shareCode" element={<GroupView />} />
  </Routes>
</Suspense>
```

### 5.2 Render Optimization

**Issues Found:**

```typescript
// GroupView.tsx - Large component, could benefit from memo
const renderPlayerCard = (player: SnapshotPlayer) => {
  // This function recreates on every render
};
```

**Recommendations:**

1. **Memoize Expensive Components** (Medium Priority)
```typescript
// PlayerCard.tsx
export const PlayerCard = memo(function PlayerCard({...}: PlayerCardProps) {
  ...
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  return (
    prevProps.player.id === nextProps.player.id &&
    prevProps.player.updatedAt === nextProps.player.updatedAt &&
    prevProps.viewMode === nextProps.viewMode
  );
});
```

2. **Use useCallback for Handlers**
```typescript
// Already done in GroupView, but ensure consistency
const handleUpdatePlayer = useCallback(async (playerId: string, updates: Partial<SnapshotPlayer>) => {
  // ... stable reference
}, [currentGroup?.id, currentTier?.tierId, updatePlayer]);
```

### 5.3 Network Optimization

**Recommendations:**

1. **Add Request Deduplication** (Medium Priority)
```typescript
// api.ts - Dedupe simultaneous identical requests
const pendingRequests = new Map<string, Promise<unknown>>();

export async function dedupeRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }
  
  const promise = fn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}
```

2. **Implement SWR Pattern** (Low Priority - Future)
```typescript
// Consider using react-query or SWR for data fetching
import useSWR from 'swr';

function useGroup(shareCode: string) {
  return useSWR(
    `/api/static-groups/by-code/${shareCode}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );
}
```

---

## Priority Action Items

### Critical (Do First)
1. ✅ Add database migrations (Alembic)
2. ✅ Add rate limiting for production
3. ✅ Add basic test suite (frontend + backend)
4. ✅ Add error boundaries and toast notifications

### High Priority
1. ✅ Add ARIA labels and keyboard navigation
2. ✅ Implement Redis caching for external API calls
3. ✅ Add structured logging
4. ✅ Tighten production CORS/security headers
5. ✅ Add database indexes for common queries

### Medium Priority
1. Add skeleton loading states
2. Extend optimistic updates to gear changes
3. Add JSDoc/OpenAPI documentation
4. Implement code splitting
5. Add mobile-responsive header

### Low Priority (Future)
1. Add light mode theme option
2. Add page transition animations
3. Consider SWR/React Query
4. Archive design mockups
5. API versioning preparation

---

## Conclusion

The FFXIV Raid Planner codebase is well-structured with a clear separation of concerns. The main areas requiring attention before production deployment are:

1. **Testing infrastructure** - Currently no tests
2. **Database migrations** - Using auto-create instead of migrations
3. **Production security** - Rate limiting, caching, security headers
4. **Accessibility** - ARIA labels and keyboard navigation

The UI and UX are polished with a cohesive design system. The frontend state management with Zustand is clean and the API design follows RESTful conventions. With the recommended improvements, this application would be ready for production deployment.

**Estimated Effort for Critical Items:** 2-3 weeks  
**Estimated Effort for All Items:** 6-8 weeks
