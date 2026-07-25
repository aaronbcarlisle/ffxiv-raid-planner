# Session 2: Critical Performance - Admin Dashboard N+1 Query

**Duration:** 3 hours
**Issues:** P0-PERF-001
**Priority:** CRITICAL

---

## Pre-Session Checklist

- [ ] Backend virtual environment activated
- [ ] All tests passing (`pytest tests/ -q`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to fix a critical N+1 query performance issue in the Admin Dashboard. The current implementation loads entire tier_snapshots and memberships collections for EVERY group, then counts them in Python. This causes 5-10+ second load times with 50+ groups.

**Location:** `backend/app/routers/static_groups.py` - the `/api/static-groups/admin/list` endpoint (around lines 359-450)

**Current problem analysis:**

The code defines subqueries for counts (lines 361-372) but NEVER uses them:
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
```

Instead, it uses selectinload to eager load ENTIRE collections:
```python
.options(
    selectinload(StaticGroup.tier_snapshots),  # N+1!
    selectinload(StaticGroup.memberships),     # N+1!
)
```

Then counts in Python:
```python
tier_count=len(group.tier_snapshots) if group.tier_snapshots else 0,
member_count=len(group.memberships) if group.memberships else 0,
```

**Required fix:**

1. Modify the SELECT to include the scalar subqueries:
```python
query = (
    select(
        StaticGroup,
        member_count_subq.label('member_count'),
        tier_count_subq.label('tier_count'),
    )
    .options(selectinload(StaticGroup.owner))  # Only load owner relationship
)
```

2. Update the result iteration to unpack the computed columns:
```python
result = await session.execute(query)
for group, member_count, tier_count in result.unique().all():
    items.append(AdminStaticGroupListItem(
        # ... other fields from group ...
        member_count=member_count,
        tier_count=tier_count,
    ))
```

3. Remove the selectinload for tier_snapshots and memberships (we only need counts)

**Important considerations:**
- Keep the existing filtering logic (search, date range)
- Keep the existing pagination (skip/limit)
- Keep the existing ordering
- Ensure the owner relationship is still loaded for owner info

**Testing:**
1. Run `pytest tests/test_admin_system.py -v`
2. Verify query count using SQLAlchemy echo mode
3. Target: 2-3 queries max regardless of group count

After fixing, commit with message: "perf(admin): fix N+1 query in admin dashboard list"
```

---

## Expected Outcomes

### Files Modified
- `backend/app/routers/static_groups.py`

### Query Before (with 50 groups)
```
SELECT ... FROM static_groups  -- 1 query
SELECT ... FROM tier_snapshots WHERE static_group_id = ?  -- 50 queries
SELECT ... FROM memberships WHERE static_group_id = ?  -- 50 queries
= 101 queries total
```

### Query After (with 50 groups)
```
SELECT
    static_groups.*,
    (SELECT COUNT(*) FROM memberships WHERE ...) as member_count,
    (SELECT COUNT(*) FROM tier_snapshots WHERE ...) as tier_count
FROM static_groups
= 1-2 queries total
```

### Tests to Verify
```bash
pytest tests/test_admin_system.py -v

# To verify query count, temporarily enable echo:
# In database.py: echo=True
# Check console output during API call
```

### Performance Target
- Before: 5-10+ seconds for 50 groups
- After: < 500ms for 50 groups

---

## Debugging Tips

If the query doesn't work as expected:

1. Check that scalar_subquery is correlate correctly:
```python
.correlate(StaticGroup)  # Must reference the outer query's table
```

2. Verify tuple unpacking matches SELECT order:
```python
# SELECT order: StaticGroup, member_count, tier_count
for group, member_count, tier_count in result.unique().all():
```

3. If getting duplicate rows, ensure `.unique()` is called on result

---

## Rollback Plan

```bash
git checkout backend/app/routers/static_groups.py
```

---

## Commit Message Template

```
perf(admin): fix N+1 query in admin dashboard list

- Use scalar subqueries for member_count and tier_count
- Remove eager loading of tier_snapshots and memberships collections
- Reduces query count from O(n) to O(1)

Before: 5-10+ seconds for 50 groups
After: < 500ms for 50 groups

Addresses: P0-PERF-001
```
