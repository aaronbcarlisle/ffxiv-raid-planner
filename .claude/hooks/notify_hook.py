"""Notification hook: surface Claude Code notifications (needs input / permission /
idle / agent completed) as a Windows toast.

CURRENTLY UNWIRED (2026-07-28): not referenced by .claude/settings.json — the
built-in notification settings (inputNeededNotifEnabled / agentPushNotifEnabled /
voiceEnabled) are on trial as the replacement. Re-add a Notification hook entry
pointing here to bring the toast back.
Always exits 0 — notification failures must never affect the session.
"""
import json
import os
import subprocess
import sys

PS1 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notify.ps1")


def main():
    title, message = "Claude Code", "Attention needed"
    try:
        data = json.load(sys.stdin)
        message = data.get("message") or message
        title = data.get("title") or title
    except Exception:
        pass
    try:
        subprocess.run(
            ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
             "-File", PS1, "-Title", str(title)[:80], "-Message", str(message)[:200]],
            capture_output=True, timeout=25,
        )
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
