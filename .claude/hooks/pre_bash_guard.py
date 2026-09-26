"""PreToolUse guard for Bash/PowerShell tool calls.

Three mechanical gates (see CLAUDE.md CI/CD section and the pr-checklist skill):
  1. Commit guard  — `git commit` with frontend TS staged must pass `tsc -b`
                     (project-build mode; stricter than `tsc --noEmit`, matches CI).
  2. Merge guard   — `gh pr merge` requires `gh pr checks` fully green. Main's
                     branch protection enforces this server-side too; the hook
                     catches it earlier and also covers non-protected branches.
  3. Push guard    — `git push` that targets `main` (explicit refspec, `HEAD`
                     or a bare push while on main, `--all`/`--mirror`). Permission
                     deny rules can't express this: #279 showed only a trailing
                     `*` expands, so `git push * main` never matched.

Exit 0 = allow. Exit 2 = block the tool call; stderr is fed back to Claude.
Fails OPEN on unexpected errors (a broken guard must not brick the run).
"""
import json
import os
import re
import subprocess
import sys

# Hooks do NOT run with cwd = the project directory — they inherit the session
# shell's cwd, which moves whenever a Bash call cd's somewhere. Anchor on
# `$CLAUDE_PROJECT_DIR` so repo-relative commands below resolve from the project
# root regardless of where the session shell happens to be (same fix as PR #222).
# No hardcoded machine paths so this file can be checked in.
ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
TAIL = 3000  # max chars of tool output to feed back


def run(cmd, timeout=280):
    return subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True, timeout=timeout)


PROTECTED = {"main", "refs/heads/main"}


def push_targets_main(cmd):
    """True if any `git push` in `cmd` would update main on a remote."""
    for seg in re.split(r"&&|\|\||[;|\n]", cmd):
        m = re.search(r"\bgit\b(?:\s+-C\s+\S+)?\s+push\b(.*)", seg)
        if not m:
            continue
        toks = m.group(1).split()
        flags = [t for t in toks if t.startswith("-")]
        if "--all" in flags or "--mirror" in flags:
            return True
        refspecs = [t.strip("'\"") for t in toks if not t.startswith("-")][1:]
        current = None
        if not refspecs or any(r.lstrip("+") == "HEAD" for r in refspecs):
            current = run("git branch --show-current", timeout=10).stdout.strip()
            if current in PROTECTED:
                return True
        for r in refspecs:
            dst = r.lstrip("+").split(":")[-1]
            if dst in PROTECTED:
                return True
    return False


def main():
    global ROOT
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or ROOT
    tool_input = data.get("tool_input") or {}
    cmd = tool_input.get("command", "")
    if not cmd:
        return 0

    # --- Push guard ---
    try:
        if push_targets_main(cmd):
            sys.stderr.write(
                "PUSH BLOCKED by push guard hook: this push would update `main`. "
                "Push a branch and open a draft PR instead (see pr-checklist skill).\n"
            )
            return 2
    except Exception:
        pass  # fail open

    # --- Commit guard ---
    if re.search(r"\bgit\b[^|;&]*?\bcommit\b", cmd):
        try:
            staged = run("git diff --cached --name-only", timeout=30)
            files = staged.stdout.split()
            if any(f.startswith("frontend/") and f.endswith((".ts", ".tsx")) for f in files):
                r = run("pnpm -C frontend exec tsc -b")
                if r.returncode != 0:
                    sys.stderr.write(
                        "COMMIT BLOCKED by pre-commit guard hook: `tsc -b` failed. "
                        "This is project-build mode (what CI runs) — stricter than `tsc --noEmit`. "
                        "Fix the type errors, then retry the commit.\n\n"
                        + (r.stdout + r.stderr)[-TAIL:]
                    )
                    return 2
        except subprocess.TimeoutExpired:
            sys.stderr.write(
                "COMMIT BLOCKED by pre-commit guard hook: `tsc -b` timed out (>280s). "
                "Run `pnpm -C frontend exec tsc -b` yourself, confirm it passes, then retry.\n"
            )
            return 2
        except Exception:
            return 0  # fail open

    # --- Merge guard ---
    m = re.search(r"\bgh\s+pr\s+merge\b\s*(.*)", cmd)
    if m:
        # `--auto` only ARMS auto-merge: GitHub itself refuses to merge until
        # every required check is green, so pending checks are fine here.
        # Blocking it forces a manual wait-and-merge for no safety gain.
        if re.search(r"(^|\s)--auto\b", m.group(1)):
            return 0
        try:
            selector = ""
            for tok in m.group(1).split():
                if tok.startswith("-"):
                    continue
                selector = tok
                break
            r = run(f"gh pr checks {selector}".strip(), timeout=60)
            if r.returncode != 0:
                sys.stderr.write(
                    "MERGE BLOCKED by merge guard hook: never merge over a red or pending "
                    "check (see pr-checklist skill / CLAUDE.md CI/CD). Wait for checks to "
                    "finish green, then retry. `gh pr checks` output:\n\n"
                    + (r.stdout + r.stderr)[-TAIL:]
                )
                return 2
        except Exception:
            return 0  # fail open

    return 0


if __name__ == "__main__":
    sys.exit(main())
