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
leftover. The hook exits silently when you haven't opted in, when you're not on `main`,
or when `gh` is missing or unauthenticated (it checks `gh` itself, so the
unattended path stays quiet — run the script by hand and it *will* tell you why
it skipped). It never fails the pull.

The decision logic lives in
[`scripts/tidy-merged-branches.sh`](../scripts/tidy-merged-branches.sh), which
you can also run by hand (`--dry-run` reports without deleting). **A branch is
deleted only when it has a MERGED PR whose head commit is exactly the local
tip, and no OPEN one.** The pull request, not the git graph, is the authority,
because the two obvious signals are both wrong here:

- `git branch --merged main` lists **nothing**. We squash-merge, so a merged
  branch's commits never become ancestors of `main` and `git branch -d` refuses
  every one of them. (That's why the script uses `-D` — safe only because the
  merge is confirmed through the API rather than inferred from the graph.)
- The `[gone]` upstream marker is wrong in both directions: a branch whose
  remote was deleted without ever merging still reads `[gone]`, while a branch
  merged before delete-branch-on-merge was enabled does not.

The **SHA match** is what makes `-D` safe. A merged PR on its own only proves
that a branch by that name merged once — not that the local ref is what merged.
If you kept committing on a branch after its PR landed, or reused a branch name
whose old PR merged long ago, the PR still reads `MERGED` while the local tip
holds work that never was; without the OID check a background hook would drop it
to the reflog with no prompt. Fork PRs are ignored for the same reason
(`gh pr list --head` matches branch *names* across repositories, and `patch-1`
is exactly what a fork PR gets by default).

Branches with an open PR (a parked draft, say), with no PR at all, with a
closed-unmerged PR, with commits beyond the merged head, or checked out in
another worktree are kept, and the script prints which case each one hit.

The per-branch PR lookup is capped (`PR_LIMIT`), and a list that comes back at
the cap is treated as **possibly truncated**: the branch is kept untouched
rather than judged on partial data, because the open PR could be the row that
got cut. You cannot prove "no open PR" from an incomplete list.
