# Git hooks

Versioned git hooks for this repo. They are **not** active until you point git
at this directory (git only runs hooks from `.git/hooks` by default):

```bash
git config core.hooksPath .githooks
```

Run that once per clone. To skip hooks for a single push (rarely needed):
`git push --no-verify`.

## `pre-push`

Runs the two fast, no-database migration guards before a push reaches the
remote:

- `backend/scripts/check_migration_heads.py` — single linear migration chain
  (no multiple heads / dangling parents).
- `backend/scripts/check_migration_dialect.py` — no integer defaults on boolean
  columns (`sa.text("0")`), which SQLite accepts but PostgreSQL rejects.

Both are pure-stdlib Python, so any `python`/`python3`/`py` on PATH works — no
venv or dependencies needed. Full migration execution against PostgreSQL still
runs in CI (the **Migration Execution (PostgreSQL)** job); this hook is the
local first line of defence.
