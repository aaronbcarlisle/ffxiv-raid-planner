"""PreToolUse guard for Bash/PowerShell tool calls.

Four mechanical gates (see CLAUDE.md CI/CD section and the pr-checklist skill):
  1. Push guard    — `git push` that would update `main`: an explicit or
                     wildcard refspec, `:`, `--all`/`--mirror`, `HEAD` or a bare
                     push while on main, and a push without refspecs that
                     `remote.<name>.push` or `push.default` sends there
                     (`matching`, or `upstream` tracking main). Permission deny
                     rules can't express this: #279 showed only a trailing `*`
                     expands, so `git push * main` never matched.
  2. Force guard   — plain `--force` / `-f` / `+refspec` pushes. `--force-with-lease`
                     is allowed (it refuses to overwrite commits you haven't
                     fetched), so stacked branches can be restacked.
  3. Commit guard  — `git commit` with frontend TS staged must pass `tsc -b`
                     (project-build mode; stricter than `tsc --noEmit`, matches CI).
  4. Merge guard   — `gh pr merge` and the REST merge endpoints
                     (`gh api … pulls/N/merge` / `merge-async`, used for stacks)
                     require `gh pr checks` fully green. Main's branch protection
                     enforces this server-side too; the hook catches it earlier.

Commands are tokenized (quotes, escapes, comments and heredoc bodies handled;
PowerShell escapes with a backtick, so its Windows paths keep their
backslashes), so text inside an `echo`, a commit message or a quoted argument
never trips a gate. Each simple command runs in the directory it would really
run in: the hook input's `cwd`, moved by `cd` / `Set-Location` into a directory
that exists and by `pushd` / `popd`, restored when a bash subshell ends, then
`git -C`. That keeps the gates right for agents in `.claude/worktrees/`.
The user-level ~/.claude/hooks/bash_guard.py (abc-claude) runs the same push, force
and merge gates on the owner's machines. This copy stays as the backstop for
cloud sessions and contributors without that setup; only the commit gate is
specific to this repo.

Exit 0 = allow. Exit 2 = block the tool call; stderr is fed back to Claude.
Fails OPEN on unexpected errors (a broken guard must not brick the run).
"""
import fnmatch
import json
import os
import re
import subprocess
import sys

# Fallback anchor only: the hook input's `cwd` is where the command really runs.
PROJECT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
TAIL = 3000  # max chars of tool output to feed back

PROTECTED = {"main"}
TO_MAIN = ("this push would update `main`. Push a feature branch and open a draft PR "
           "instead (see pr-checklist skill).")
# git global options that take their value as the NEXT token (`-C dir`, `-c k=v`).
GIT_GLOBAL_WITH_ARG = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"}
# Global options that change the repo or config the push sees; lookups reuse them.
GIT_GLOBAL_KEPT = {"-c", "--git-dir", "--work-tree"}
# `git push` options that take their value as the NEXT token.
PUSH_OPT_WITH_ARG = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}
# `gh pr merge` options that take their value as the NEXT token.
MERGE_OPT_WITH_ARG = {"-t", "--subject", "-b", "--body", "-F", "--body-file",
                      "-A", "--author-email", "--match-head-commit", "-R", "--repo"}
CD_COMMANDS = {"cd", "chdir", "set-location", "sl"}
PUSHD_COMMANDS = {"pushd", "push-location"}
POPD_COMMANDS = {"popd", "pop-location"}
# Words that can come before a command without changing it: `if git push …; then`.
COMMAND_PREFIXES = {"{", "}", "!", "if", "then", "elif", "else", "do", "while", "until",
                    "time", "command", "exec", "nohup", "env"}
MERGE_ENDPOINT = re.compile(r"(?:^|/)repos/([^/]+/[^/]+)/pulls/(\d+)/merge(?:-async)?/?$|(?:^|/)pulls/(\d+)/merge(?:-async)?/?$")
HEREDOC = re.compile(r"<<-?[ \t]*(['\"]?)\\?([A-Za-z_][\w.-]*)\1([^\n]*)\n.*?\n[ \t]*\2[ \t]*(?=\n|$)", re.DOTALL)
HERESTRING = re.compile(r"@(['\"])[ \t]*\r?\n.*?\r?\n\1@", re.DOTALL)
OP_CHARS = ";&|()<>\n"
SEPARATORS = {";", "(", ")", "\n"}  # single-character tokens; `&` and `|` runs also separate
# A quoted word made only of these keeps its quotes, so it never reads as syntax.
QUOTE_KEPT = set(OP_CHARS + "{}!")


def run(cmd, cwd, timeout=280):
    return subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, check=False,
                          encoding="utf-8", errors="replace", timeout=timeout)


def git(args, cwd, opts=()):
    return subprocess.run(["git", "-C", cwd] + list(opts) + args, capture_output=True, check=False,
                          encoding="utf-8", errors="replace", timeout=10)


def tokens(cmd, powershell=False):
    """Shell tokens of `cmd`: words without their quotes, and operators.

    `&`, `|`, `<` and `>` group into one operator (`&&`, `>>`, `2>&`); `;`,
    `(`, `)` and newlines stand alone. A heredoc body becomes a `<<` `HEREDOC`
    pair, a PowerShell here-string an empty word, and `#` comments are dropped.
    """
    cmd = HEREDOC.sub(lambda m: "<<HEREDOC" + m.group(3), cmd)
    if powershell:
        cmd = HERESTRING.sub("''", cmd)
    esc = "`" if powershell else "\\"
    toks, word, quoted, i, n = [], "", False, 0, len(cmd)

    def add(word, quoted):
        if word or quoted:
            toks.append(f"'{word}'" if quoted and word and set(word) <= QUOTE_KEPT else word)

    while i < n:
        c = cmd[i]
        if c == esc and i + 1 < n:
            if cmd[i + 1] != "\n":  # an escaped newline continues the line
                word += cmd[i + 1]
                quoted = True
            i += 2
        elif c in "'\"":
            quoted, i = True, i + 1
            while i < n and cmd[i] != c:
                if c == '"' and cmd[i] == esc and i + 1 < n and (powershell or cmd[i + 1] in '$`"\\\n'):
                    i += 1
                word += cmd[i]
                i += 1
            i += 1
        elif c == "#" and not word and not quoted:
            i = cmd.find("\n", i)
            i = n if i < 0 else i
        elif c in " \t\r" or c in OP_CHARS:
            fd = word if c in "<>" and word.isdigit() and not quoted else ""  # 2>, 1>>
            if not fd:
                add(word, quoted)
            word, quoted = "", False
            j = i + 1
            if c in "&|<>":
                while j < n and cmd[j] in "&|<>":
                    j += 1
            if c in OP_CHARS:
                toks.append(fd + cmd[i:j])
            i = j
        else:
            word += c
            i += 1
    add(word, quoted)
    return toks


def is_separator(t):
    """True for a token that ends a simple command: `;`, `&&`, `|`, `(`, …"""
    return t in SEPARATORS or (bool(t) and set(t) <= set("&|"))


def is_redirect(t):
    return t[:1] != "'" and bool(set(t) & set("<>"))


def strip_prefixes(seg):
    """`seg` without leading assignments (`FOO=bar`, `$x =`) and words like `if` or `{`."""
    while seg:
        if seg[0] in COMMAND_PREFIXES or re.match(r"^[A-Za-z_]\w*=", seg[0]):
            seg = seg[1:]
        elif len(seg) > 1 and seg[1] == "=" and seg[0].startswith("$"):
            seg = seg[2:]
        else:
            break
    return seg


def arguments(seg):
    """The words after a command's name, minus options, redirects and their targets."""
    out, i = [], 1
    while i < len(seg):
        if is_redirect(seg[i]):
            i += 2
            continue
        if not seg[i].startswith("-"):
            out.append(seg[i])
        i += 1
    return out


def resolve(base, path):
    """`path` seen from `base`, with ~, $HOME, $VAR, $env:VAR and /d/x drive paths expanded."""
    path = re.sub(r"^\$\{?HOME\}?(?=[/\\]|$)", "~", path)
    path = re.sub(r"(?i)\$\{?env:(\w+)\}?", lambda m: os.environ.get(m.group(1), m.group(0)), path)
    path = os.path.expanduser(os.path.expandvars(path))
    m = re.match(r"^/([a-zA-Z])(?:/|$)(.*)", path)  # Git Bash /d/x → D:/x
    if m and os.name == "nt":
        path = f"{m.group(1).upper()}:/{m.group(2)}"
    return os.path.normpath(os.path.join(base, path))


def commands(toks, cwd, powershell=False):
    """(directory, tokens) per simple command, after the directory changes before it.

    `cd` / `Set-Location` move only into a directory that exists (a failed `cd`
    leaves the shell where it was), `pushd` / `popd` keep a stack, and a bash
    subshell's `cd`s end with it. PowerShell parentheses aren't subshells.
    """
    stack, subshells, seg = [], [], []
    for t in toks + [";"]:
        if not is_separator(t):
            seg.append(t)
            continue
        seg = strip_prefixes(seg)
        name = seg[0].lower() if seg else ""
        if name in POPD_COMMANDS:
            if stack:
                cwd = stack.pop()
        elif name in CD_COMMANDS or name in PUSHD_COMMANDS:
            args = arguments(seg)
            target = resolve(cwd, args[0]) if args else ""
            if target and os.path.isdir(target):
                if name in PUSHD_COMMANDS:
                    stack.append(cwd)
                cwd = target
        elif seg:
            yield cwd, seg
        seg = []
        if t == "(" and not powershell:
            subshells.append((cwd, list(stack)))
        elif t == ")" and subshells and not powershell:
            cwd, stack = subshells.pop()


def git_call(cwd, toks):
    """(directory, subcommand, args, kept global options) for a git command, else None."""
    if os.path.basename(toks[0]).lower() not in ("git", "git.exe"):
        return None
    opts, j = [], 1
    while j < len(toks) and toks[j].startswith("-"):
        t = toks[j]
        if t in GIT_GLOBAL_WITH_ARG and j + 1 < len(toks):
            if t == "-C":
                cwd = resolve(cwd, toks[j + 1])
            elif t in GIT_GLOBAL_KEPT:
                opts += [t, toks[j + 1]]
            j += 2
        else:
            if t.startswith(("--git-dir=", "--work-tree=")):
                opts.append(t)
            j += 1  # --no-pager, --bare, …
    if j >= len(toks):
        return None
    return cwd, toks[j], toks[j + 1:], opts


def git_config(cwd, opts):
    """Effective config as {key: [values]}. git lowercases section and variable
    names but keeps a subsection's case (`branch.Feat/X.merge`)."""
    config = {}
    for entry in git(["config", "--list", "-z"], cwd, opts).stdout.split("\0"):
        key, _, value = entry.partition("\n")
        if key:
            config.setdefault(key, []).append(value)
    return config


def refspec_updates_main(spec, current):
    """True if refspec `spec` would update main."""
    spec = spec.lstrip("+")
    if spec.startswith("^"):  # a negative refspec only excludes
        return False
    src, colon, dst = spec.partition(":")
    if not colon:
        dst = src  # `main` updates `main`
    if not dst:  # `:` pushes every matching branch; git rejects `main:`
        return not src
    if dst in ("HEAD", "@"):
        dst = current
    dst = dst.removeprefix("refs/heads/")
    return any(fnmatch.fnmatchcase(b, dst) for b in PROTECTED)  # also `refs/heads/*`


def check_push(cwd, args, opts=()):
    """An error message if this `git push` targets main or forces, else None."""
    positional, repo, forced, k = [], None, False, 0
    while k < len(args):
        a = args[k]
        if a in ("--all", "--mirror", "--branches"):
            return TO_MAIN
        if a in PUSH_OPT_WITH_ARG or is_redirect(a):  # `2>&` `1` isn't a refspec
            if a == "--repo" and k + 1 < len(args):
                repo = args[k + 1]
            k += 2
            continue
        if a.startswith("--repo="):
            repo = a.split("=", 1)[1]
        elif a == "--force" or (a.startswith("-") and not a.startswith("--") and "f" in a[1:]):
            forced = True
        elif not a.startswith("-"):
            positional.append(a)
        k += 1
    current = git(["branch", "--show-current"], cwd, opts).stdout.strip()
    config = git_config(cwd, opts)

    def get(key):
        return (config.get(key) or [""])[-1]

    # A repository argument wins over --repo (git-push(1)); with neither, git
    # uses the branch's push remote.
    remote = (positional[0] if positional else repo or get(f"branch.{current}.pushremote")
              or get("remote.pushdefault") or get(f"branch.{current}.remote") or "origin")
    # Without refspecs, remote.<name>.push decides, else push.default.
    refspecs = positional[1:] or config.get(f"remote.{remote}.push", [])
    if not refspecs:
        mode = get("push.default") or "simple"
        if mode == "matching":
            refspecs = [":"]
        elif mode in ("upstream", "tracking"):
            refspecs = ["HEAD:" + (get(f"branch.{current}.merge") or current)]
        elif mode != "nothing":  # simple, current
            refspecs = ["HEAD"]
    if any(refspec_updates_main(r, current) for r in refspecs):
        return TO_MAIN
    if forced or any(r.startswith("+") for r in positional[1:]):
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
            if args[k] in MERGE_OPT_WITH_ARG or is_redirect(args[k]):
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
            elif t in ("-f", "-F", "--field", "--raw-field", "--input") or is_redirect(t):
                has_fields = has_fields or not is_redirect(t)
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
        powershell = data.get("tool_name") == "PowerShell"
        calls = list(commands(tokens(cmd, powershell), data.get("cwd") or PROJECT, powershell))
    except Exception:
        return 0  # fail open

    for cwd, toks in calls:
        # --- Push and force guards ---
        git_ = None
        try:
            git_ = git_call(cwd, toks)
            if git_ and git_[1] == "push":
                why = check_push(git_[0], git_[2], git_[3])
                if why:
                    return block(f"PUSH BLOCKED by push guard hook: {why}\n")
        except Exception:
            pass  # fail open

        # --- Commit guard ---
        if git_ and git_[1] == "commit":
            try:
                out = tsc_failure(git_[0])
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
