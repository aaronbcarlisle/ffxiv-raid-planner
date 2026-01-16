# Session 8: DevOps - CI Backend Tests

**Duration:** 2 hours
**Issues:** P1-DEVOPS-002
**Priority:** HIGH

---

## Pre-Session Checklist

- [ ] Access to GitHub Actions configuration
- [ ] Backend tests passing locally
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to add backend tests to the CI workflow. Currently only frontend checks run.

## Issue: Backend Not in CI Workflow (P1-DEVOPS-002)

**Location:** `.github/workflows/ci.yml`

**Current state:** CI only runs frontend checks (tsc, lint, test, build).

**Required changes:**

1. First, read the existing `.github/workflows/ci.yml` to understand the current structure.

2. Add a new job for backend checks:

```yaml
  backend:
    name: Backend Checks
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: 'pip'
          cache-dependency-path: backend/requirements*.txt

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run linting
        run: ruff check .

      - name: Run type checking
        run: mypy app --ignore-missing-imports || true  # Warning only for now

      - name: Run tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          JWT_SECRET_KEY: test-secret-key-for-ci-only-32chars
          DEBUG: "false"
        run: pytest tests/ -q --tb=short
```

3. Consider adding the backend job to the `needs` of any deployment job, so deployment only happens if both frontend and backend pass.

**Environment variables for tests:**
The backend tests need certain env vars. Check `backend/app/config.py` to see what's required, and provide test values in the workflow.

**Important considerations:**
- Use PostgreSQL service container (tests may require real DB)
- If tests can run with SQLite, that's simpler (no service needed)
- Cache pip dependencies for faster runs
- Run ruff for linting consistency

**Testing:**
1. Push to a feature branch
2. Verify CI runs both frontend and backend jobs
3. Both should pass

Commit: "ci: add backend checks to CI workflow"
```

---

## Expected Outcomes

### Files Modified
- `.github/workflows/ci.yml`

### CI Jobs After Fix
```
Jobs:
1. frontend (existing)
   - tsc --noEmit
   - lint
   - test
   - build

2. backend (new)
   - ruff check
   - mypy (optional)
   - pytest
```

### Verification
1. Push branch to GitHub
2. Go to Actions tab
3. Verify both jobs appear
4. Verify both jobs pass

---

## Alternative: SQLite for Tests

If tests can run without PostgreSQL:

```yaml
  backend:
    name: Backend Checks
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: 'pip'
          cache-dependency-path: backend/requirements*.txt

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run tests
        env:
          DATABASE_URL: sqlite:///./test.db
          JWT_SECRET_KEY: test-secret-key-for-ci-only-32chars
          DEBUG: "false"
        run: pytest tests/ -q
```

Check if tests support SQLite by looking at `conftest.py` and test fixtures.

---

## Troubleshooting

### Tests fail in CI but pass locally
- Check environment variables match
- Database connection issues with service container
- Async issues with SQLite (may need aiosqlite)

### Ruff not found
- Ensure `ruff` is in `requirements-dev.txt`
- Or add explicit pip install: `pip install ruff`

### Mypy errors
- Start with `--ignore-missing-imports`
- Can make mypy errors non-blocking initially

---

## Rollback Plan

```bash
git checkout .github/workflows/ci.yml
```

---

## Commit Message

```
ci: add backend checks to CI workflow

Adds new backend job to run:
- ruff check (linting)
- pytest (tests)

Uses PostgreSQL service container for integration tests.
Caches pip dependencies for faster runs.

Addresses: P1-DEVOPS-002
```
