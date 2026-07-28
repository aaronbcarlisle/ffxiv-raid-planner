"""PostToolUse hook for Edit/Write: scoped ESLint on the touched frontend file.

Errors only (--quiet) — legacy files carry deliberate warn-level design-system
debt that byte-for-byte slices must NOT fix, so warnings are suppressed.
Exit 2 feeds stderr back to Claude as feedback (the edit itself already happened).
Fails OPEN on unexpected errors.
"""
import json
import os
import subprocess
import sys

# No hardcoded machine paths (checked-in hook): hooks run with cwd = project
# dir; the payload `cwd` is authoritative when present.
ROOT = os.getcwd()
TAIL = 2500


def main():
    global ROOT
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    ROOT = data.get("cwd") or ROOT
    fp = (data.get("tool_input") or {}).get("file_path", "").replace("\\", "/")
    if "/frontend/src/" not in fp or not fp.endswith((".ts", ".tsx")):
        return 0
    try:
        r = subprocess.run(
            f'pnpm -C frontend exec eslint --quiet "{fp}"',
            shell=True, cwd=ROOT, capture_output=True, text=True, timeout=110,
        )
    except Exception:
        return 0  # fail open
    if r.returncode != 0:
        out = (r.stdout + r.stderr).strip()
        if not out:
            return 0
        sys.stderr.write(
            f"post-edit lint hook — ESLint errors in {fp} (errors only; leave "
            f"pre-existing warn-level debt in legacy files untouched):\n\n" + out[-TAIL:]
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
