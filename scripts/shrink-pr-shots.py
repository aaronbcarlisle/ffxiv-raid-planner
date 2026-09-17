#!/usr/bin/env python3
"""
Shrink PR screenshots to the size they are actually displayed at.

PR bodies embed shots with `width="900"`. Capture tools save at the viewport
size (1680px wide for the standard desktop pass), so a committed screenshot
stores roughly 3.5x the pixels that ever render — and git keeps that blob
forever. Converting to 900px WebP measured 8% of the original bytes across
D7a's eleven shots, with no visible difference at the rendered width.

Run this before committing screenshots:

    python scripts/shrink-pr-shots.py docs/redesign/pr-shots/d7b-*.png

    # preview without writing
    python scripts/shrink-pr-shots.py --dry-run docs/redesign/pr-shots/d7b-*.png

    # keep the originals instead of replacing them
    python scripts/shrink-pr-shots.py --keep docs/redesign/pr-shots/d7b-*.png

By default each source file is replaced by a `.webp` sibling, because leaving
both would defeat the point. Embed the `.webp` path in the PR body.

`scripts/check-pr-shots.mjs` enforces the resulting budget in CI.

Requires Pillow (`pip install Pillow`), same as the other image scripts in this
repo (see frontend/scripts/blend_tier_banners.py).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - environment guidance, not logic
    sys.exit("Pillow is required: pip install Pillow")

# Must stay in sync with MAX_BYTES in scripts/check-pr-shots.mjs.
BUDGET_BYTES = 120 * 1024
TARGET_WIDTH = 900
WEBP_QUALITY = 82


def human(n: int) -> str:
    return f"{n / 1024:.0f} KB"


def shrink(path: Path, *, dry_run: bool, keep: bool, target_width: int = TARGET_WIDTH) -> tuple[int, int]:
    """Return (before_bytes, after_bytes). after == before when nothing changed."""
    before = path.stat().st_size

    with Image.open(path) as im:
        im.load()
        width, height = im.size
        if width > target_width:
            target_height = round(height * target_width / width)
            im = im.resize((target_width, target_height), Image.LANCZOS)
        # Screenshots are opaque; RGBA costs bytes for nothing.
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")

        out = path.with_suffix(".webp")
        if dry_run:
            import io

            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=WEBP_QUALITY, method=6)
            return before, buf.tell()

        im.save(out, "WEBP", quality=WEBP_QUALITY, method=6)

    after = out.stat().st_size
    if not keep and out != path:
        path.unlink()
    return before, after


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="+", help="screenshot paths to shrink")
    parser.add_argument("--dry-run", action="store_true", help="report sizes without writing")
    parser.add_argument("--keep", action="store_true", help="keep the original alongside the .webp")
    parser.add_argument("--width", type=int, default=TARGET_WIDTH, help=f"target width (default {TARGET_WIDTH})")
    args = parser.parse_args()

    paths = [Path(f) for f in args.files]
    missing = [p for p in paths if not p.is_file()]
    if missing:
        for p in missing:
            print(f"  ! not found: {p}", file=sys.stderr)
        return 2

    total_before = total_after = 0
    over_budget = []

    for path in paths:
        before, after = shrink(path, dry_run=args.dry_run, keep=args.keep, target_width=args.width)
        total_before += before
        total_after += after
        pct = (after / before * 100) if before else 100
        arrow = "would be" if args.dry_run else "->"
        print(f"  {path.name:52s} {human(before):>8s} {arrow} {human(after):>8s}  ({pct:.0f}%)")
        if after > BUDGET_BYTES:
            over_budget.append((path.name, after))

    if total_before:
        saved = total_before - total_after
        print(
            f"\n  {len(paths)} file(s): {human(total_before)} -> {human(total_after)} "
            f"(saved {human(saved)}, {saved / total_before * 100:.0f}%)"
        )

    if over_budget:
        print(f"\n  ! still over the {human(BUDGET_BYTES)} budget:", file=sys.stderr)
        for name, size in over_budget:
            print(f"      {human(size):>8s}  {name}", file=sys.stderr)
        print(
            "    Try a narrower --width, crop to the region that matters, or add the\n"
            "    filename to docs/redesign/pr-shots/.size-exceptions with a reason.",
            file=sys.stderr,
        )
        return 1

    if args.dry_run:
        print("\n  (dry run - nothing written)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
