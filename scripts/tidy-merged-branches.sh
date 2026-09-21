#!/usr/bin/env bash
#
# Delete local branches whose pull request has been MERGED.
#
# Why this exists: this repo squash-merges, so a merged branch's commits never
# become ancestors of main. `git branch --merged main` therefore lists nothing
# and `git branch -d` refuses every merged branch. Meanwhile GitHub's
# delete-branch-on-merge removes the REMOTE branch automatically, so the local
# copy is the only thing left behind - every merge, forever.
#
# The authority here is the PULL REQUEST state, not the git graph and not the
# "[gone]" upstream marker. "[gone]" is wrong in both directions:
#   * A branch whose remote was deleted without ever being merged still reads
#     [gone] - e.g. a local branch that tracked a Dependabot branch and never
#     had a PR of its own.
#   * A branch merged before delete-branch-on-merge was enabled does NOT read
#     [gone], because its remote is still there.
# And an OPEN PR must always win: a branch parked as a draft PR on purpose has
# to survive any sweep.
#
# So: delete only when a branch has a MERGED PR **whose head commit is exactly
# the local tip**, and no OPEN one. That SHA match is what makes `-D` safe. A
# merged PR alone is NOT enough - it says a branch by this name merged once, not
# that THIS ref is what merged:
#   * you keep committing on a branch after its PR landed, without a new PR yet;
#   * you reuse a branch name whose old PR merged long ago.
# In both cases the PR reads MERGED while the local tip holds commits that were
# never merged, and `-D` would drop them to the reflog silently, from a hook,
# with no prompt. Comparing against `headRefOid` closes exactly the gap that
# `-d` normally closes and that the squash-merge blindness forces us to give up.
#
# PRs from forks are ignored (`headRepositoryOwner`): `gh pr list --head` matches
# on branch NAME across repositories, and generic names like `patch-1` or
# `fix/typo` are what fork PRs get by default - a merged fork PR must never
# authorise deleting a same-named local branch here.
#
# No PR at all, a closed-unmerged PR, a tip past the merged head, or checked out
# in a worktree -> keep and say why.
#
# Usage:
#   scripts/tidy-merged-branches.sh             # delete
#   scripts/tidy-merged-branches.sh --dry-run   # report only, delete nothing
#
# Runs automatically from .githooks/post-merge when you opt in with
#   git config xrp.tidyBranches true
#
set -euo pipefail

# Per-branch PR lookup cap. A branch name with this many PRs is pathological;
# if we ever hit it the list may be truncated and the branch is kept untouched
# rather than judged on partial data (see the truncation guard below).
PR_LIMIT="${PR_LIMIT:-100}"

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
elif [ -n "${1:-}" ]; then
  echo "usage: $(basename "$0") [--dry-run]" >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "[tidy] gh CLI not on PATH - skipping (PR state is the only safe authority here)." >&2
  exit 0
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "[tidy] gh is not authenticated ('gh auth login') - skipping." >&2
  exit 0
fi

# Same-repo owner, resolved once: fork PRs share the branch-name namespace.
repo_owner="$(gh repo view --json owner --jq '.owner.login' 2>/dev/null || true)"
if [ -z "$repo_owner" ]; then
  echo "[tidy] could not resolve the repo owner - skipping." >&2
  exit 0
fi

default_branch="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)"
default_branch="${default_branch#origin/}"
current="$(git branch --show-current 2>/dev/null || true)"

# Branches checked out in ANY worktree: git refuses to delete these anyway, and
# they are someone's live working state.
worktree_branches="$(git worktree list --porcelain | awk '/^branch /{sub(/^refs\/heads\//, "", $2); print $2}')"

deleted=0
kept=0

while IFS= read -r b; do
  b="${b#refs/heads/}"
  [ -z "$b" ] && continue
  [ "$b" = "$default_branch" ] && continue
  [ "$b" = "$current" ] && continue

  if printf '%s\n' "$worktree_branches" | grep -qxF "$b"; then
    printf '[tidy] kept (in worktree):    %s\n' "$b"
    kept=$((kept + 1))
    continue
  fi

  # One API call per branch. `--state all` so a reused branch name surfaces
  # every PR it ever headed, not just the newest. The owner comes back as a
  # field and is filtered in shell - nothing is interpolated into the jq program.
  rows="$(gh pr list --head "$b" --state all --limit "$PR_LIMIT" \
            --json state,number,headRefOid,headRepositoryOwner \
            --jq '.[] | "\(.state) \(.number) \(.headRefOid) \(.headRepositoryOwner.login)"' \
          2>/dev/null || true)"

  # Truncation would break the rule that an OPEN PR always wins: the open row
  # could be the one that got cut, leaving a MERGED row to authorise a delete.
  # We cannot prove a negative from a truncated list, so refuse to act on one.
  if [ "$(printf '%s\n' "$rows" | grep -c .)" -ge "$PR_LIMIT" ]; then
    printf '[tidy] kept (>=%s PRs, list may be truncated): %s\n' "$PR_LIMIT" "$b"
    kept=$((kept + 1))
    continue
  fi

  rows="$(printf '%s\n' "$rows" | awk -v o="$repo_owner" 'NF && $4 == o')"

  if [ -z "$rows" ]; then
    printf '[tidy] kept (no PR):          %s\n' "$b"
    kept=$((kept + 1))
    continue
  fi

  if printf '%s\n' "$rows" | grep -q '^OPEN '; then
    n="$(printf '%s\n' "$rows" | awk '/^OPEN /{print $2; exit}')"
    printf '[tidy] kept (PR #%s open):    %s\n' "$n" "$b"
    kept=$((kept + 1))
    continue
  fi

  # A MERGED PR proves a branch by this name merged; the OID proves THIS ref is
  # what merged. Only the pair authorises -D.
  # Fully qualified: `git rev-parse <name>` follows gitrevisions disambiguation,
  # which puts refs/tags/<name> AHEAD of refs/heads/<name>. A tag sharing a
  # branch name would otherwise make local_tip the tag's object rather than the
  # tip of the ref we are about to delete - and the whole guard rests on this.
  local_tip="$(git rev-parse --verify --quiet "refs/heads/$b" || true)"
  n="$(printf '%s\n' "$rows" | awk -v tip="$local_tip" '$1 == "MERGED" && $3 == tip {print $2; exit}')"

  if [ -n "$n" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '[tidy] WOULD DELETE (PR #%s merged): %s\n' "$n" "$b"
      deleted=$((deleted + 1))
    # Compare-and-delete: `git update-ref -d <ref> <oldvalue>` fails unless the
    # ref still points at the SHA we checked, so the guard holds at deletion
    # time and not merely at read time. `git branch -D` has no such check, and
    # this runs unattended from a hook while other processes touch the repo.
    elif git update-ref -d "refs/heads/$b" "$local_tip" 2>/dev/null; then
      printf '[tidy] deleted (PR #%s merged): %s\n' "$n" "$b"
      deleted=$((deleted + 1))
    else
      printf '[tidy] kept (ref moved during the run): %s\n' "$b"
      kept=$((kept + 1))
    fi
    continue
  fi

  if printf '%s\n' "$rows" | grep -q '^MERGED '; then
    n="$(printf '%s\n' "$rows" | awk '/^MERGED /{print $2; exit}')"
    printf '[tidy] kept (local commits beyond PR #%s): %s\n' "$n" "$b"
    kept=$((kept + 1))
    continue
  fi

  n="$(printf '%s\n' "$rows" | awk '{print $2; exit}')"
  printf '[tidy] kept (PR #%s closed unmerged): %s\n' "$n" "$b"
  kept=$((kept + 1))
# Full refnames, not %(refname:short): "short" DISAMBIGUATES, so a tag sharing a
# branch name turns the branch into "heads/<name>" - which then misses its own
# PR lookup and resolves no ref. Strip the prefix ourselves for the exact name.
done < <(git for-each-ref --format='%(refname)' refs/heads/)

if [ "$deleted" -eq 0 ] && [ "$kept" -eq 0 ]; then
  exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
  printf -- '- %d would be deleted, %d kept\n' "$deleted" "$kept"
else
  printf -- '- %d deleted, %d kept\n' "$deleted" "$kept"
fi
