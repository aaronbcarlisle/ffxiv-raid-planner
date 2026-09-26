"""SessionStart hook: surface SESSION_HANDOFF.md (git-ignored, local) at startup,
resume and after compaction, so a fresh or compacted session sees the open work.

Prints a one-line header plus the first HEAD_LINES lines (capped at MAX_CHARS);
/resume reads the rest. Silent when the file is absent. Always exits 0.
"""
import os
import subprocess
import sys
import time

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
HEAD_LINES = 25
MAX_CHARS = 2500


def main():
    path = os.path.join(ROOT, "SESSION_HANDOFF.md")
    if not os.path.isfile(path):
        return 0
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            lines = f.read().splitlines()
        age_h = (time.time() - os.path.getmtime(path)) / 3600
        branch = subprocess.run(
            "git branch --show-current", shell=True, cwd=ROOT,
            capture_output=True, text=True, timeout=10,
        ).stdout.strip() or "?"
        head = "\n".join(lines[:HEAD_LINES])[:MAX_CHARS]
        more = f" ({len(lines) - HEAD_LINES} more lines — /resume reads it all)" if len(lines) > HEAD_LINES else ""
        out = (
            f"SESSION_HANDOFF.md (updated {age_h:.0f} h ago; current branch: {branch}){more}:\n"
            f"{head}\n"
        )
        # Windows Python defaults stdout to cp1252; the handoff has em-dashes/arrows.
        sys.stdout.buffer.write(out.encode("utf-8"))
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
