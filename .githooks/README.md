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

## `post-merge` — local branch cleanup (opt-in)

Deletes local branches whose PR has merged, after a `git pull` onto `main`.
**Off unless you opt in:**

```bash
git config xrp.tidyBranches true    # enable   (per clone)
git config xrp.tidyBranches false   # disable
```

A merge on GitHub can't fire a local hook, so the next pull onto `main` is the
first moment your machine learns a branch merged — and since
delete-branch-on-merge already removed the remote, the local copy is the only
leftover. The hook exits silently when you haven't opted in, when you're not on
`main`, or when `gh` is missing or unauthenticated; it never fails the pull.

The decision logic lives in
[`scripts/tidy-merged-branches.sh`](../scripts/tidy-merged-branches.sh), which
you can also run by hand (`--dry-run` reports without deleting). **A branch is
deleted only when it has a MERGED PR and no OPEN one** — the pull request, not
the git graph, is the authority, because the two obvious signals are both wrong
here:

- `git branch --merged main` lists **nothing**. We squash-merge, so a merged
  branch's commits never become ancestors of `main` and `git branch -d` refuses
  every one of them. (That's why the script uses `-D` — safe only because the
  merge is confirmed through the API rather than inferred from the graph.)
- The `[gone]` upstream marker is wrong in both directions: a branch whose
  remote was deleted without ever merging still reads `[gone]`, while a branch
  merged before delete-branch-on-merge was enabled does not.

Branches with an open PR (a parked draft, say), with no PR at all, with a
closed-unmerged PR, or checked out in another worktree are kept, and the script
prints which case each one hit.
