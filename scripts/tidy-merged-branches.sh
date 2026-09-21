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
# So: delete only when a branch has at least one MERGED PR and no OPEN one.
# No PR at all, a closed-unmerged PR, or checked out in a worktree -> keep and
# say why. `-D` (not `-d`) is required because of the squash-merge blindness
# above; it is safe here only because the merge is confirmed through the API
# rather than inferred from the commit graph.
#
# Usage:
#   scripts/tidy-merged-branches.sh             # delete
#   scripts/tidy-merged-branches.sh --dry-run   # report only, delete nothing
#
# Runs automatically from .githooks/post-merge when you opt in with
#   git config xrp.tidyBranches true
#
set -euo pipefail

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

default_branch="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)"
default_branch="${default_branch#origin/}"
current="$(git branch --show-current 2>/dev/null || true)"

# Branches checked out in ANY worktree: git refuses to delete these anyway, and
# they are someone's live working state.
worktree_branches="$(git worktree list --porcelain | awk '/^branch /{sub(/^refs\/heads\//, "", $2); print $2}')"

deleted=0
kept=0

while IFS= read -r b; do
  [ -z "$b" ] && continue
  [ "$b" = "$default_branch" ] && continue
  [ "$b" = "$current" ] && continue

  if printf '%s\n' "$worktree_branches" | grep -qxF "$b"; then
    printf '[tidy] kept (in worktree):    %s\n' "$b"
    kept=$((kept + 1))
    continue
  fi

  # One API call per branch. `--state all` so a reused branch name surfaces
  # every PR it ever headed, not just the newest.
  states="$(gh pr list --head "$b" --state all --limit 20 --json state,number \
              --jq '.[] | "\(.state) \(.number)"' 2>/dev/null || true)"

  if [ -z "$states" ]; then
    printf '[tidy] kept (no PR):          %s\n' "$b"
    kept=$((kept + 1))
    continue
  fi

  if printf '%s\n' "$states" | grep -q '^OPEN '; then
    n="$(printf '%s\n' "$states" | awk '/^OPEN /{print $2; exit}')"
    printf '[tidy] kept (PR #%s open):    %s\n' "$n" "$b"
    kept=$((kept + 1))
    continue
  fi

  if printf '%s\n' "$states" | grep -q '^MERGED '; then
    n="$(printf '%s\n' "$states" | awk '/^MERGED /{print $2; exit}')"
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '[tidy] WOULD DELETE (PR #%s merged): %s\n' "$n" "$b"
    else
      git branch -D "$b" >/dev/null
      printf '[tidy] deleted (PR #%s merged): %s\n' "$n" "$b"
    fi
    deleted=$((deleted + 1))
    continue
  fi

  n="$(printf '%s\n' "$states" | awk '{print $2; exit}')"
  printf '[tidy] kept (PR #%s closed unmerged): %s\n' "$n" "$b"
  kept=$((kept + 1))
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)

if [ "$deleted" -eq 0 ] && [ "$kept" -eq 0 ]; then
  exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
  printf -- '- %d would be deleted, %d kept\n' "$deleted" "$kept"
else
  printf -- '- %d deleted, %d kept\n' "$deleted" "$kept"
fi
