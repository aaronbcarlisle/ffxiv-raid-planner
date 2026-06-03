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


def _parse(text: str) -> tuple[str | None, str | None]:
    rev = _REV_RE.search(text)
    down = _DOWN_RE.search(text)
    rev_val = rev.group(1) if rev else None
    if down is None or down.group(1) == "None":
        down_val = None
    else:
        down_val = down.group(1).strip("'\"")
    return rev_val, down_val


def main() -> int:
    files = sorted(p for p in VERSIONS_DIR.glob("*.py") if p.name != "__init__.py")
    if not files:
        print(f"ERROR: no migration files found in {VERSIONS_DIR}")
        return 1

    revisions: dict[str, str] = {}
    down_of: dict[str, str | None] = {}
    errors: list[str] = []

    for path in files:
        rev, down = _parse(path.read_text(encoding="utf-8"))
        if rev is None:
            errors.append(f"{path.name}: could not parse a `revision` id")
            continue
        if rev in revisions:
            errors.append(
                f"duplicate revision id '{rev}' in {path.name} "
                f"and {revisions[rev]}"
            )
            continue
        revisions[rev] = path.name
        down_of[rev] = down

    all_revs = set(revisions)

    # Dangling down_revision references.
    for rev, down in down_of.items():
        if down is not None and down not in all_revs:
            errors.append(
                f"{revisions[rev]}: down_revision '{down}' does not match any "
                f"known revision"
            )

    roots = [r for r, d in down_of.items() if d is None]
    used_as_down = {d for d in down_of.values() if d is not None}
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
            "chain is linear (see backend/alembic/README or run "
            "`alembic heads`)."
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
