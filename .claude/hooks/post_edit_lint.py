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
Fails OPEN on unexpected errors. Files outside this repo (scratchpad, another
drive) are skipped.
"""
import json
import os
import shutil
import subprocess
import sys
from collections import Counter

# Hooks do NOT run with cwd = the project directory — they inherit the session
# shell's cwd, which moves whenever a Bash call cd's somewhere (PR #222). The
# checks run from the top of the checkout that holds the edited file, so an
# agent editing in `.claude/worktrees/<name>/` is linted against its own tree.
# `$CLAUDE_PROJECT_DIR` identifies the repo. No hardcoded machine paths.
PROJECT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
ROOT = PROJECT
TAIL = 2500


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, timeout=110, **kw)


def git_dirs(path):
    """(checkout top level, shared .git dir) for `path`, or None outside git."""
    r = subprocess.run(
        ["git", "-C", path, "rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"],
        capture_output=True, encoding="utf-8", errors="replace", timeout=10,
    )
    lines = r.stdout.splitlines()
    if r.returncode != 0 or len(lines) < 2:
        return None
    return lines[0], os.path.normcase(os.path.normpath(lines[1]))


def eslint(fp, rel):
    if not os.path.isdir(os.path.join(ROOT, "frontend", "node_modules")):
        return None  # a worktree without `pnpm install`; CI and `pnpm lint` still gate it
    r = run(f'pnpm -C frontend exec eslint --quiet --format json "{fp}"', shell=True,
            encoding="utf-8", errors="replace")
    if r.returncode == 0:
        return None
    try:
        # When ESLint exits 1 (findings), `pnpm exec` appends its own
        # ERR_PNPM_RECURSIVE_EXEC line to stdout: decode only the leading report.
        results, _ = json.JSONDecoder().raw_decode(r.stdout.lstrip())
    except ValueError:
        # No JSON report means ESLint itself failed (exit 2, pnpm error). Say why.
        return ("ESLint could not run — this is not a lint result. Its output:\n\n"
                + (r.stderr or r.stdout).strip()[-TAIL:])
    errors = [
        f"  {rel}:{m.get('line', 0)}:{m.get('column', 0)} {m.get('ruleId') or 'error'}: {m.get('message', '')}"
        for res in results for m in res.get("messages", []) if m.get("severity") == 2
    ]
    if not errors:
        return None
    return (
        f"ESLint errors in {rel} (errors only; leave pre-existing warn-level debt "
        f"in legacy files untouched):\n" + "\n".join(errors)[-TAIL:]
    )


def ruff_bin():
    for base in (ROOT, PROJECT):  # a worktree has no venv of its own
        for cand in ("backend/venv/Scripts/ruff.exe", "backend/venv/bin/ruff", "backend/.venv/bin/ruff"):
            p = os.path.join(base, cand)
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


def _identity(issue, lines):
    """Rule + message + the flagged line's text: survives the line moving,
    but a new violation can't cancel against a different removed one."""
    row = issue["location"]["row"]
    text = lines[row - 1].strip() if 0 < row <= len(lines) else ""
    return issue["code"], issue["message"], text


def ruff_delta(fp, rel):
    ruff = ruff_bin()
    if not ruff:
        return None
    with open(fp, "rb") as f:
        src = f.read()
    now = ruff_issues(ruff, rel, src)
    base = run(["git", "show", f"HEAD:{rel}"])
    old = base.stdout if base.returncode == 0 else b""
    before = ruff_issues(ruff, rel, old) if old else []
    old_lines = old.decode("utf-8", "replace").splitlines()
    new_lines = src.decode("utf-8", "replace").splitlines()
    seen = Counter(_identity(i, old_lines) for i in before)
    new = []
    for i in now:
        key = _identity(i, new_lines)
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
    fp = (data.get("tool_input") or {}).get("file_path", "").replace("\\", "/")
    if not fp or not os.path.isfile(fp):
        return 0
    try:
        mine = git_dirs(os.path.dirname(fp))
        project = git_dirs(os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or PROJECT)
        if not mine or not project or mine[1] != project[1]:
            return 0  # not in this repo or one of its worktrees
        ROOT = mine[0]
        rel = os.path.relpath(fp, ROOT).replace("\\", "/")
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0  # e.g. relpath across drives
    if rel.startswith(".."):
        return 0

    msgs = []
    checks = [crlf]
    if rel.startswith("frontend/src/") and rel.endswith((".ts", ".tsx")):
        checks.append(eslint)
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
