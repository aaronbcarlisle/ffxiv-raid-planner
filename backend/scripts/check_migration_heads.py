#!/usr/bin/env python3
"""Validate the Alembic migration graph without a database or alembic install.

Catches the recurring class of deploy failures where two feature branches each
add a migration off the same parent, producing multiple heads. `alembic upgrade
head` then refuses to run ("Multiple head revisions are present") and the
Railway healthcheck fails because uvicorn never starts.

This parses every migration file's ``revision`` / ``down_revision`` and asserts:
  * exactly one head (a revision no other migration builds on),
  * exactly one root (the initial migration, down_revision = None),
  * no dangling down_revision (references a revision that doesn't exist),
  * no duplicate revision ids.

Pure stdlib so it can run as a fast, isolated CI step. Exits non-zero on any
problem and prints the offending revisions.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parent.parent / "alembic" / "versions"

# Matches both styles used in this repo:
#   revision = 'abc'                 and   revision: str = "abc"
#   down_revision = None             and   down_revision: Union[str, None] = "abc"
_REV_RE = re.compile(r"^revision[^=\n]*=\s*['\"]([^'\"]+)['\"]", re.M)
_DOWN_RE = re.compile(r"^down_revision[^=\n]*=\s*(None|['\"][^'\"]+['\"])", re.M)
# Handles merge migrations where down_revision is a tuple spanning multiple lines:
#   down_revision: Union[str, Sequence[str], None] = (
#       "abc123",
#       "def456",
#   )
_DOWN_TUPLE_RE = re.compile(
    r"^down_revision[^=\n]*=\s*\(([^)]+)\)", re.M | re.S
)
# Presence of *any* down_revision assignment, so we can tell an explicit
# `down_revision = None` (a legitimate root) apart from a file that omits the
# assignment entirely (a mistake we must flag, not silently treat as a root).
_DOWN_PRESENT_RE = re.compile(r"^down_revision\b\s*[:=]", re.M)


def _parse(text: str) -> tuple[str | None, list[str], bool]:
    rev = _REV_RE.search(text)
    rev_val = rev.group(1) if rev else None
    down_present = _DOWN_PRESENT_RE.search(text) is not None

    # Try scalar first, then tuple (merge migrations)
    down = _DOWN_RE.search(text)
    if down is not None and down.group(1) != "None":
        down_vals = [down.group(1).strip("'\"")]
    else:
        tuple_match = _DOWN_TUPLE_RE.search(text)
        if tuple_match:
            down_vals = re.findall(r"['\"]([^'\"]+)['\"]", tuple_match.group(1))
        else:
            down_vals = []  # None or missing → root

    return rev_val, down_vals, down_present


def main() -> int:
    files = sorted(p for p in VERSIONS_DIR.glob("*.py") if p.name != "__init__.py")
    if not files:
        print(f"ERROR: no migration files found in {VERSIONS_DIR}")
        return 1

    revisions: dict[str, str] = {}
    down_of: dict[str, list[str]] = {}
    errors: list[str] = []

    for path in files:
        rev, downs, down_present = _parse(path.read_text(encoding="utf-8"))
        if rev is None:
            errors.append(f"{path.name}: could not parse a `revision` id")
            continue
        if not down_present:
            errors.append(
                f"{path.name}: no `down_revision` assignment found - every "
                f"migration needs one (use `down_revision = None` only for the "
                f"initial migration)"
            )
            continue
        if rev in revisions:
            errors.append(
                f"duplicate revision id '{rev}' in {path.name} "
                f"and {revisions[rev]}"
            )
            continue
        revisions[rev] = path.name
        down_of[rev] = downs

    all_revs = set(revisions)

    # Dangling down_revision references.
    for rev, downs in down_of.items():
        for down in downs:
            if down not in all_revs:
                errors.append(
                    f"{revisions[rev]}: down_revision '{down}' does not match any "
                    f"known revision"
                )

    roots = [r for r, d in down_of.items() if not d]
    used_as_down = {d for downs in down_of.values() for d in downs}
    heads = sorted(all_revs - used_as_down)

    if len(roots) != 1:
        errors.append(
            "expected exactly one root migration (down_revision = None), found "
            f"{len(roots)}: {sorted(revisions[r] for r in roots)}"
        )

    if len(heads) != 1:
        errors.append(
            "expected exactly one head, found "
            f"{len(heads)}: {[revisions[h] for h in heads]}. "
            "Two migrations likely share a down_revision - re-parent one so the "
            "chain is linear. Run `alembic heads` (or `alembic history`) from "
            "backend/ to see the fork, then point one head's down_revision at "
            "the other so they form a single line."
        )

    if errors:
        print("Alembic migration graph check FAILED:\n")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"OK: {len(all_revs)} migrations form a single linear chain.")
    print(f"  root: {revisions[roots[0]]}")
    print(f"  head: {revisions[heads[0]]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
