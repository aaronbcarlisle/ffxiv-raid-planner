# Session 3: High Priority Security - Dependencies

**Duration:** 2-3 hours
**Issues:** P1-SEC-001, P1-SEC-004, P1-DEVOPS-001
**Priority:** HIGH

---

## Pre-Session Checklist

- [ ] Frontend dependencies installed (`pnpm install`)
- [ ] All tests passing (`pnpm test`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to fix dependency security issues and clean up lockfile problems. Work through each issue, creating commits after each fix.

## Issue 1: React Router DOM CVE Vulnerabilities (P1-SEC-001)

**Location:** `frontend/package.json`

**Current:** react-router-dom 7.11.0
**Target:** react-router-dom 7.12.0 (or latest patch)

**CVEs being fixed:**
- GHSA-h5cw-625j-3rxh (CSRF in Action processing)
- GHSA-2w69-qvjg-hvjx (XSS via Open Redirects)

**Steps:**
1. Update react-router-dom:
   ```bash
   cd frontend && pnpm update react-router-dom
   ```

2. Run tests to ensure no regressions:
   ```bash
   pnpm test
   ```

3. Build to verify compilation:
   ```bash
   pnpm build
   ```

4. Verify no audit warnings:
   ```bash
   pnpm audit
   ```

Commit: "fix(deps): update react-router-dom to fix CVE vulnerabilities"

---

## Issue 2: Remove Dual Lockfiles (P1-DEVOPS-001)

**Location:** `frontend/` directory

**Problem:** Both `package-lock.json` (npm) and `pnpm-lock.yaml` exist, causing build determinism issues.

**Steps:**
1. Delete the npm lockfile:
   ```bash
   rm frontend/package-lock.json
   ```

2. Verify pnpm still works:
   ```bash
   cd frontend && pnpm install
   pnpm test
   pnpm build
   ```

3. Add to .gitignore to prevent accidental npm usage:
   ```
   # Prevent npm lockfile (we use pnpm)
   package-lock.json
   ```

Commit: "chore(deps): remove npm lockfile, standardize on pnpm"

---

## Issue 3: Consider ecdsa CVE (P1-SEC-004) - OPTIONAL

**Location:** `backend/requirements.txt`

**Problem:** python-jose depends on ecdsa which has CVE-2024-23342.

**Note:** This is optional because:
1. We use HS256, not ECDSA algorithms
2. The vulnerability may not be exploitable in our use case
3. Migration to PyJWT is more involved

If you want to proceed:
1. Replace in requirements.txt:
   ```
   # Remove: python-jose[cryptography]>=3.3.0
   # Add: PyJWT[crypto]>=2.8.0
   ```

2. Update auth_utils.py to use PyJWT:
   ```python
   # Replace: from jose import jwt, JWTError
   # With: import jwt
   # from jwt.exceptions import InvalidTokenError as JWTError
   ```

3. Run tests: `pytest tests/test_auth_utils.py -v`

**Only proceed with this if time permits and all other fixes are complete.**

---

## Verification

After all changes:
```bash
cd frontend
pnpm audit  # Should show no high/critical vulnerabilities
pnpm test
pnpm build
pnpm lint
```
```

---

## Expected Outcomes

### Files Modified
- `frontend/package.json` (version bump)
- `frontend/pnpm-lock.yaml` (regenerated)
- `frontend/package-lock.json` (deleted)
- `frontend/.gitignore` (optionally updated)

### Verification Commands
```bash
# Check react-router version
cd frontend && pnpm list react-router-dom

# Verify no npm lockfile
ls frontend/package-lock.json  # Should error

# Security audit
cd frontend && pnpm audit

# Full test
pnpm test && pnpm build
```

---

## Rollback Plan

```bash
# Restore from git
git checkout frontend/package.json
git checkout frontend/pnpm-lock.yaml

# Regenerate
cd frontend && pnpm install
```

---

## Commit Messages

```
fix(deps): update react-router-dom to fix CVE vulnerabilities

Updates react-router-dom from 7.11.0 to 7.12.0 to address:
- GHSA-h5cw-625j-3rxh (CSRF)
- GHSA-2w69-qvjg-hvjx (XSS)

Addresses: P1-SEC-001
```

```
chore(deps): remove npm lockfile, standardize on pnpm

- Delete package-lock.json
- Regenerate pnpm-lock.yaml
- Add package-lock.json to .gitignore

This project uses pnpm exclusively. Dual lockfiles cause
build determinism issues.

Addresses: P1-DEVOPS-001
```
