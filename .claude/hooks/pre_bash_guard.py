"""PreToolUse guard for Bash/PowerShell tool calls.

Four mechanical gates (see CLAUDE.md CI/CD section and the pr-checklist skill):
  1. Push guard    — `git push` that targets `main` (explicit refspec, `HEAD`
                     or a bare push while on main, `--all`/`--mirror`). Permission
                     deny rules can't express this: #279 showed only a trailing
                     `*` expands, so `git push * main` never matched.
  2. Force guard   — plain `--force` / `-f` / `+refspec` pushes. `--force-with-lease`
                     is allowed (it refuses to overwrite commits you haven't
                     fetched), so stacked branches can be restacked.
  3. Commit guard  — `git commit` with frontend TS staged must pass `tsc -b`
                     (project-build mode; stricter than `tsc --noEmit`, matches CI).
  4. Merge guard   — `gh pr merge` and the REST merge endpoints
                     (`gh api … pulls/N/merge` / `merge-async`, used for stacks)
                     require `gh pr checks` fully green. Main's branch protection
                     enforces this server-side too; the hook catches it earlier.

Commands are tokenized (quotes respected, heredoc bodies dropped), so text
inside an `echo` or a commit message never trips a gate. Each simple command
runs in the directory it would really run in: the hook input's `cwd`, moved by
`cd` / `Set-Location`, then `git -C`. That keeps the gates right for agents in
`.claude/worktrees/`.

Exit 0 = allow. Exit 2 = block the tool call; stderr is fed back to Claude.
Fails OPEN on unexpected errors (a broken guard must not brick the run).
"""
import json
import os
import re
import shlex
import subprocess
import sys

# Fallback anchor only: the hook input's `cwd` is where the command really runs.
PROJECT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
TAIL = 3000  # max chars of tool output to feed back

PROTECTED = {"main", "refs/heads/main"}
TO_MAIN = ("this push would update `main`. Push a feature branch and open a draft PR "
           "instead (see pr-checklist skill).")
# git global options that take their value as the NEXT token (`-C dir`, `-c k=v`).
GIT_GLOBAL_WITH_ARG = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"}
# `git push` options that take their value as the NEXT token.
PUSH_OPT_WITH_ARG = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}
# `gh pr merge` options that take their value as the NEXT token.
MERGE_OPT_WITH_ARG = {"-t", "--subject", "-b", "--body", "-F", "--body-file",
                      "-A", "--author-email", "--match-head-commit", "-R", "--repo"}
CD_COMMANDS = {"cd", "chdir", "pushd", "set-location", "sl", "push-location"}
MERGE_ENDPOINT = re.compile(r"(?:^|/)repos/([^/]+/[^/]+)/pulls/(\d+)/merge(?:-async)?/?$|(?:^|/)pulls/(\d+)/merge(?:-async)?/?$")
HEREDOC = re.compile(r"<<-?[ \t]*(['\"]?)([A-Za-z_]\w*)\1([^\n]*)\n.*?\n[ \t]*\2[ \t]*(?=\n|$)", re.S)
SEPARATOR_CHARS = set(";&|()\n")


def run(cmd, cwd, timeout=280):
    return subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True,
                          encoding="utf-8", errors="replace", timeout=timeout)


def segments(cmd):
    """The simple commands in `cmd`, each as a token list."""
    cmd = HEREDOC.sub(lambda m: "<<HEREDOC" + m.group(3), cmd)
    lex = shlex.shlex(cmd, posix=True, punctuation_chars=";&|()<>\n")
    lex.whitespace = " \t\r"
    lex.whitespace_split = True
    try:
        toks = list(lex)
    except ValueError:  # unbalanced quotes — best effort
        toks = cmd.split()
    seg = []
    for t in toks:
        # `&&`, `;`, `|`, newline… end a command; `>`, `2>&1` are redirects.
        if set(t) <= SEPARATOR_CHARS:
            if seg:
                yield seg
            seg = []
        else:
            seg.append(t)
    if seg:
        yield seg


def resolve(base, path):
    path = os.path.expanduser(path.replace("$HOME", "~").replace("${HOME}", "~"))
    m = re.match(r"^/([a-zA-Z])(?:/|$)(.*)", path)  # Git Bash /d/x → D:/x
    if m and os.name == "nt":
        path = f"{m.group(1).upper()}:/{m.group(2)}"
    return os.path.normpath(os.path.join(base, path))


def commands(cmd, cwd):
    """(directory, tokens) per simple command, tracking `cd` between them."""
    for seg in segments(cmd):
        while seg and re.match(r"^[A-Za-z_]\w*=", seg[0]):  # FOO=bar cmd
            seg = seg[1:]
        if not seg:
            continue
        if seg[0].lower() in CD_COMMANDS:
            args = [a for a in seg[1:] if not a.startswith("-")]
            if args:
                cwd = resolve(cwd, args[0])
            continue
        yield cwd, seg


def git_call(cwd, toks):
    """(directory, subcommand, args) when `toks` is a git command, else None."""
    if os.path.basename(toks[0]).lower() not in ("git", "git.exe"):
        return None
    j = 1
    while j < len(toks) and toks[j].startswith("-"):
        if toks[j] in GIT_GLOBAL_WITH_ARG:
            if toks[j] == "-C" and j + 1 < len(toks):
                cwd = resolve(cwd, toks[j + 1])
            j += 2
        else:
            j += 1  # --no-pager, --git-dir=x, --bare, …
    if j >= len(toks):
        return None
    return cwd, toks[j], toks[j + 1:]


def check_push(cwd, args):
    """An error message if this `git push` targets main or forces, else None."""
    positional, forced, k = [], False, 0
    while k < len(args):
        a = args[k]
        if a in ("--all", "--mirror", "--branches"):
            return TO_MAIN
        if a in PUSH_OPT_WITH_ARG:
            k += 2
            continue
        if a == "--force" or (a.startswith("-") and not a.startswith("--") and "f" in a[1:]):
            forced = True
        elif not a.startswith("-"):
            positional.append(a)
        k += 1
    refspecs = positional[1:]  # positional[0] is the remote
    if not refspecs or any(r.lstrip("+") == "HEAD" for r in refspecs):
        current = run("git branch --show-current", cwd, timeout=10).stdout.strip()
        if current in PROTECTED:
            return TO_MAIN
    for r in refspecs:
        if r.lstrip("+").split(":")[-1] in PROTECTED:
            return TO_MAIN
    if forced or any(r.startswith("+") for r in refspecs):
        return ("plain force-push. Use `git push --force-with-lease --force-if-includes`, "
                "which refuses to overwrite commits you haven't fetched.")
    return None


def tsc_failure(cwd):
    """`tsc -b` output if TS is staged in this checkout and it fails, else None."""
    staged = run("git diff --cached --name-only", cwd, timeout=30)
    if not any(f.startswith("frontend/") and f.endswith((".ts", ".tsx")) for f in staged.stdout.split()):
        return None
    top = run("git rev-parse --show-toplevel", cwd, timeout=10).stdout.strip() or cwd
    if not os.path.isdir(os.path.join(top, "frontend", "node_modules")):
        return None  # a worktree without an install can't typecheck; CI still gates it
    r = run("pnpm -C frontend exec tsc -b", top)
    return None if r.returncode == 0 else (r.stdout + r.stderr)[-TAIL:]


def merge_target(toks):
    """(PR selector, repo or None) when `toks` merges a PR without `--auto`, else None."""
    if os.path.basename(toks[0]).lower() not in ("gh", "gh.exe") or len(toks) < 3:
        return None
    if toks[1:3] == ["pr", "merge"]:
        args, selector, repo, k = toks[3:], "", None, 0
        if "--auto" in args:
            # `--auto` only ARMS auto-merge: GitHub itself refuses to merge until
            # every required check is green, so pending checks are fine here.
            return None
        while k < len(args):
            if args[k] in MERGE_OPT_WITH_ARG:
                if args[k] in ("-R", "--repo") and k + 1 < len(args):
                    repo = args[k + 1]
                k += 2
                continue
            if not args[k].startswith("-") and not selector:
                selector = args[k]
            k += 1
        return selector, repo
    if toks[1] == "api":
        method, has_fields, endpoint, k = None, False, None, 2
        while k < len(toks):
            t = toks[k]
            if t in ("-X", "--method") and k + 1 < len(toks):
                method = toks[k + 1].upper()
                k += 2
                continue
            if t.startswith("--method="):
                method = t.split("=", 1)[1].upper()
            elif t in ("-f", "-F", "--field", "--raw-field", "--input"):
                has_fields = True
                k += 2
                continue
            elif not t.startswith("-") and endpoint is None:
                endpoint = t
            k += 1
        if (method or ("POST" if has_fields else "GET")) == "GET" or not endpoint:
            return None
        m = MERGE_ENDPOINT.search(endpoint)
        if m:
            repo = m.group(1)
            if repo and "{" in repo:
                repo = None  # `{owner}/{repo}` placeholders mean the current repo
            return (m.group(2) or m.group(3)), repo
    return None


def block(msg):
    sys.stderr.write(msg)
    return 2


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    cmd = (data.get("tool_input") or {}).get("command", "")
    if not cmd:
        return 0
    try:
        calls = list(commands(cmd, data.get("cwd") or PROJECT))
    except Exception:
        return 0  # fail open

    for cwd, toks in calls:
        # --- Push and force guards ---
        git = None
        try:
            git = git_call(cwd, toks)
            if git and git[1] == "push":
                why = check_push(git[0], git[2])
                if why:
                    return block(f"PUSH BLOCKED by push guard hook: {why}\n")
        except Exception:
            pass  # fail open

        # --- Commit guard ---
        if git and git[1] == "commit":
            try:
                out = tsc_failure(git[0])
                if out:
                    return block(
                        "COMMIT BLOCKED by pre-commit guard hook: `tsc -b` failed. "
                        "This is project-build mode (what CI runs) — stricter than `tsc --noEmit`. "
                        "Fix the type errors, then retry the commit.\n\n" + out
                    )
            except subprocess.TimeoutExpired:
                return block(
                    "COMMIT BLOCKED by pre-commit guard hook: `tsc -b` timed out (>280s). "
                    "Run `pnpm -C frontend exec tsc -b` yourself, confirm it passes, then retry.\n"
                )
            except Exception:
                pass  # fail open

        # --- Merge guard ---
        try:
            target = merge_target(toks)
            if target:
                selector, repo = target
                checks = f"gh pr checks {selector}".strip() + (f" -R {repo}" if repo else "")
                r = run(checks, cwd, timeout=60)
                if r.returncode != 0:
                    return block(
                        "MERGE BLOCKED by merge guard hook: never merge over a red or pending "
                        "check (see pr-checklist skill / CLAUDE.md CI/CD). Wait for checks to "
                        f"finish green, then retry. `{checks}` output:\n\n"
                        + (r.stdout + r.stderr)[-TAIL:]
                    )
        except Exception:
            pass  # fail open

    return 0


if __name__ == "__main__":
    sys.exit(main())
