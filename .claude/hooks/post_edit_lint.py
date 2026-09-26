"""PostToolUse hook for Edit/Write: fast per-file checks on the touched file.

  1. frontend/src .ts/.tsx — scoped ESLint, errors only (--quiet). Legacy files
     carry deliberate warn-level design-system debt that byte-for-byte slices
     must NOT fix, so warnings are suppressed.
  2. backend .py — ruff pyflakes + syntax rules (F, E9), reported as a DELTA
     against HEAD. Ruff is not CI-gated and the backend carries ~1k legacy
     violations; only violations this edit introduced are fed back.
  3. Any text file whose .gitattributes eol is lf — warn if it now holds CRLF
     (CRLF in generated release notes broke the changelog test).

Exit 2 feeds stderr back to Claude as feedback (the edit itself already happened).
Fails OPEN on unexpected errors.
"""
import json
import os
import shutil
import subprocess
import sys
from collections import Counter

# Hooks do NOT run with cwd = the project directory — they inherit the session
# shell's cwd, which moves whenever a Bash call cd's somewhere. `$CLAUDE_PROJECT_DIR`
# is the only cwd-independent anchor (same fix as PR #222, which corrected the
# hook *script* paths in settings.json; this is the *target* path, one layer in).
# Without it, `pnpm -C frontend` below resolved to frontend/frontend after any
# `cd frontend`. No hardcoded machine paths, so this file stays checked in.
ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
TAIL = 2500


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, timeout=110, **kw)


def eslint(fp):
    r = run(f'pnpm -C frontend exec eslint --quiet "{fp}"', shell=True, text=True)
    out = (r.stdout + r.stderr).strip()
    if r.returncode == 0 or not out:
        return None
    if "ERR_PNPM" in out or "Cannot find module" in out:
        return ("ESLint could not run (frontend/node_modules looks broken) — this is "
                "not a lint result. Run `pnpm -C frontend install`, then `pnpm -C frontend lint`.")
    return (
        f"ESLint errors in {fp} (errors only; leave pre-existing warn-level debt "
        f"in legacy files untouched):\n\n" + out[-TAIL:]
    )


def ruff_bin():
    for cand in ("backend/venv/Scripts/ruff.exe", "backend/venv/bin/ruff", "backend/.venv/bin/ruff"):
        p = os.path.join(ROOT, cand)
        if os.path.isfile(p):
            return p
    return shutil.which("ruff")


def ruff_issues(ruff, rel, source):
    r = run(
        [ruff, "check", "--select", "F,E9", "--output-format", "json",
         "--stdin-filename", rel, "-"],
        input=source,
    )
    return json.loads(r.stdout.decode("utf-8") or "[]")


def ruff_delta(fp, rel):
    ruff = ruff_bin()
    if not ruff:
        return None
    with open(fp, "rb") as f:
        now = ruff_issues(ruff, rel, f.read())
    base = run(["git", "show", f"HEAD:{rel}"])
    before = ruff_issues(ruff, rel, base.stdout) if base.returncode == 0 else []
    seen = Counter((i["code"], i["message"]) for i in before)
    new = []
    for i in now:
        key = (i["code"], i["message"])
        if seen[key]:
            seen[key] -= 1
        else:
            new.append(f"  {rel}:{i['location']['row']}: {i['code']} {i['message']}")
    if not new:
        return None
    return "ruff (F, E9) — new since HEAD:\n" + "\n".join(new)[-TAIL:]


def crlf(fp, rel):
    """Mixed endings anywhere, or an all-CRLF file git doesn't track yet.

    An all-CRLF *tracked* file is a stale pre-.gitattributes checkout: Edit keeps
    its endings and git normalizes on commit, so it is not flagged.
    """
    with open(fp, "rb") as f:
        data = f.read()
    n_crlf = data.count(b"\r\n")
    if not n_crlf or b"\0" in data[:8000]:
        return None
    attr = run(["git", "check-attr", "eol", "--", rel], text=True).stdout
    if not attr.strip().endswith(": lf"):
        return None
    mixed = n_crlf < data.count(b"\n")
    tracked = run(["git", "ls-files", "--error-unmatch", "--", rel]).returncode == 0
    if not mixed and tracked:
        return None
    what = "mixed CRLF/LF" if mixed else "CRLF"
    return (
        f"{rel} now has {what} line endings; the repo is eol=lf. Convert it to LF "
        f"(re-Write the file, or `sed -i 's/\\r$//' {rel}`)."
    )


def main():
    global ROOT
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or ROOT
    fp = (data.get("tool_input") or {}).get("file_path", "").replace("\\", "/")
    if not fp or not os.path.isfile(fp):
        return 0
    rel = os.path.relpath(fp, ROOT).replace("\\", "/")
    if rel.startswith(".."):
        return 0

    msgs = []
    checks = [crlf]
    if rel.startswith("frontend/src/") and rel.endswith((".ts", ".tsx")):
        checks.append(lambda f, _r: eslint(f))
    if rel.startswith("backend/") and rel.endswith(".py"):
        checks.append(ruff_delta)
    for check in checks:
        try:
            m = check(fp, rel)
        except Exception:
            m = None  # fail open per check
        if m:
            msgs.append(m)
    if msgs:
        # UTF-8 explicitly: Windows Python defaults stderr to cp1252.
        sys.stderr.buffer.write(("post-edit lint hook:\n" + "\n\n".join(msgs)).encode("utf-8"))
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
