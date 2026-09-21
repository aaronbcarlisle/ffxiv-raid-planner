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
# the local tip**, and no OPEN one. That SHA match is what makes the delete safe. A
# merged PR alone is NOT enough - it says a branch by this name merged once, not
# that THIS ref is what merged:
#   * you keep committing on a branch after its PR landed, without a new PR yet;
#   * you reuse a branch name whose old PR merged long ago.
# In both cases the PR reads MERGED while the local tip holds commits that were
# never merged, and the delete would drop them to the reflog silently, from a hook,
# with no prompt. Comparing against the merged PR's last commit closes exactly
# the gap that `-d` normally closes and that squash-merge blindness forces us to
# give up. Note it is the PR's commit list, NOT `headRefOid`: the latter tracks
# the head ref's current oid and moves if anyone pushes to a surviving head
# branch after the merge, which would make a never-merged tip look authorised.
#
# PRs from forks are ignored (by head-repository node id, NOT owner login - a
# fork may be owned by the same account): `gh pr list --head` matches
# on branch NAME across repositories, and generic names like `patch-1` or
# `fix/typo` are what fork PRs get by default - a merged fork PR must never
# authorise deleting a same-named local branch here.
#
# The delete itself is `git update-ref -d refs/heads/<b> <local_tip>`, an
# expected-old-value transaction, so the SHA guard holds at deletion time and
# not merely at read time - `git branch -D` has no such check. That trade costs
# two things `-D` does for free, both restored explicitly below: it does not
# remove the branch's config stanza, and it does not refuse a branch checked out
# in another worktree.
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

# `gh pr view --json commits` asks for commits(first:100) and does not paginate,
# so a PR at or above this count has a commit list we cannot trust to end at the
# at-merge head. Not a knob - it mirrors gh's own page size.
COMMIT_PAGE=100

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

# Which repository every `gh` call below talks to, derived from THIS checkout's
# origin remote and passed explicitly. `gh` honours a `GH_REPO` environment
# override, and this runs from a hook in whatever shell the user happened to be
# in: with `GH_REPO` set, `gh pr list` returns another repository's pull
# requests entirely (demonstrated - it listed cli/cli's). Naming the repo on
# every call removes the question.
origin_url="$(git remote get-url origin 2>/dev/null || true)"
if [ -z "$origin_url" ]; then
  echo "[tidy] no 'origin' remote - skipping." >&2
  exit 0
fi
repo_slug="${origin_url%.git}"
repo_slug="${repo_slug%/}"
case "$repo_slug" in
  *://*) repo_slug="${repo_slug#*://}"; repo_slug="${repo_slug#*@}" ;;  # [scheme://][user@]host/owner/repo
  *@*:*) repo_slug="${repo_slug#*@}"; repo_slug="${repo_slug/:/\/}" ;;  # user@host:owner/repo
esac
case "$repo_slug" in
  */*/*) ;;  # host/owner/repo - the form gh accepts, and the only one we trust
  *)
    echo "[tidy] could not parse the origin remote ('$origin_url') - skipping." >&2
    exit 0
    ;;
esac

# This repository's node id. Identity is compared by ID, not by owner login:
# GitHub allows a fork owned by the SAME account or org, so a matching owner
# does not prove the PR head lives in this repo - and a merged PR from such a
# fork could otherwise authorise deleting a same-named local ref. The id is also
# immune to a rename. (`gh repo view` takes the repo positionally, not --repo.)
repo_id="$(gh repo view "$repo_slug" --json id --jq '.id' 2>/dev/null || true)"
if [ -z "$repo_id" ]; then
  echo "[tidy] could not resolve the repository id - skipping." >&2
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

  if printf '%s\n' "$worktree_branches" | grep -qxF -- "$b"; then
    printf '[tidy] kept (in worktree):    %s\n' "$b"
    kept=$((kept + 1))
    continue
  fi

  # One API call per branch. `--state all` so a reused branch name surfaces
  # every PR it ever headed, not just the newest. The head repository's id comes
  # back as a field and is filtered in shell - nothing is interpolated into jq.
  # Deliberately lean: asking for `commits` here too would blow GitHub's node
  # budget at this limit ("requesting up to 1,000,000 possible nodes"), so the
  # at-merge oid is fetched per candidate below instead.
  rows="$(gh pr list --repo "$repo_slug" --head "$b" --state all --limit "$PR_LIMIT" \
            --json state,number,headRepository \
            --jq '.[] | "\(.state) \(.number) \(.headRepository.id // "-")"' \
          2>/dev/null || true)"

  # Truncation would break the rule that an OPEN PR always wins: the open row
  # could be the one that got cut, leaving a MERGED row to authorise a delete.
  # We cannot prove a negative from a truncated list, so refuse to act on one.
  if [ "$(printf '%s\n' "$rows" | grep -c .)" -ge "$PR_LIMIT" ]; then
    printf '[tidy] kept (>=%s PRs, list may be truncated): %s\n' "$PR_LIMIT" "$b"
    kept=$((kept + 1))
    continue
  fi

  # A null head repository (deleted fork) can never match, so it is dropped too.
  rows="$(printf '%s\n' "$rows" | awk -v id="$repo_id" 'NF && $3 == id')"

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
  # what merged. Only the pair authorises a delete.
  # Fully qualified: `git rev-parse <name>` follows gitrevisions disambiguation,
  # which puts refs/tags/<name> AHEAD of refs/heads/<name>. A tag sharing a
  # branch name would otherwise make local_tip the tag's object rather than the
  # tip of the ref we are about to delete - and the whole guard rests on this.
  local_tip="$(git rev-parse --verify --quiet "refs/heads/$b" || true)"

  # One targeted lookup per merged candidate (usually exactly one). We compare
  # against the PR's LAST COMMIT, never `headRefOid`: `headRefOid` is the head
  # ref's CURRENT oid and keeps moving after the merge, so if the head branch
  # survived (anything merged before delete-branch-on-merge was enabled) and
  # someone pushed to it, `headRefOid` would be a commit that never merged - and
  # a local branch at that tip would look authorised. A merged PR's commit list
  # is fixed at merge, so its last commit is the immutable at-merge snapshot.
  # `gh pr view --json commits` does NOT paginate - it asks for commits(first:100)
  # - so on a PR with more commits `last` is the 100th, not the at-merge head.
  # Same shape as the list truncation above: we cannot tell a real mismatch from
  # a cut-off list, so say so instead of reporting a wrong reason.
  n=""
  indeterminate=""
  for cand in $(printf '%s\n' "$rows" | awk '$1 == "MERGED" {print $2}'); do
    info="$(gh pr view "$cand" --repo "$repo_slug" --json commits \
              --jq '"\(.commits | length) \((.commits | last | .oid) // "-")"' 2>/dev/null || true)"
    cand_count="${info%% *}"
    cand_tip="${info##* }"
    case "$cand_count" in ''|*[!0-9]*) continue ;; esac
    if [ "$cand_count" -ge "$COMMIT_PAGE" ]; then
      indeterminate="$cand"
      continue
    fi
    if [ "$cand_tip" != "-" ] && [ "$cand_tip" = "$local_tip" ]; then
      n="$cand"
      break
    fi
  done

  if [ -z "$n" ] && [ -n "$indeterminate" ]; then
    printf '[tidy] kept (PR #%s has >=%s commits, at-merge head not determinable): %s\n' \
      "$indeterminate" "$COMMIT_PAGE" "$b"
    kept=$((kept + 1))
    continue
  fi

  if [ -n "$n" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '[tidy] WOULD DELETE (PR #%s merged): %s\n' "$n" "$b"
      deleted=$((deleted + 1))
    # Compare-and-delete: `git update-ref -d <ref> <oldvalue>` fails unless the
    # ref still points at the SHA we checked, so the guard holds at deletion
    # time and not merely at read time. `git branch -D` has no such check, and
    # this runs unattended from a hook while other processes touch the repo.
    # The worktree snapshot above was taken before this branch's API calls, and
    # `update-ref` is plumbing: unlike `git branch -D` it will happily delete a
    # branch another worktree has checked out. Re-read the list here so the
    # window is a few milliseconds rather than the whole run.
    elif git worktree list --porcelain \
           | awk '/^branch /{sub(/^refs\/heads\//, "", $2); print $2}' \
           | grep -qxF -- "$b"; then
      printf '[tidy] kept (checked out in a worktree): %s\n' "$b"
      kept=$((kept + 1))
    elif git update-ref -d "refs/heads/$b" "$local_tip" 2>/dev/null; then
      # `git branch -d/-D` also drops the branch's config stanza; `update-ref`
      # does not, so an opted-in clone would otherwise accumulate one dead
      # `branch.<name>.*` section per merged branch forever, invisibly.
      # Guarded: the stanza belongs to whatever branch holds the name NOW, so if
      # something recreated it between the delete and here, leave its config
      # alone. (A narrowing, not a lock - git has no transaction spanning a ref
      # delete and a config write.)
      if ! git show-ref --verify --quiet "refs/heads/$b"; then
        git config --remove-section "branch.$b" 2>/dev/null || true
      fi
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
