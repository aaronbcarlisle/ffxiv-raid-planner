# Security Policy

## Supported Versions

FFXIV Raid Planner is a continuously deployed web application. The production site at
[www.xivraidplanner.app](https://www.xivraidplanner.app) always runs the latest `main`,
and only that deployed version is supported. There are no maintained release branches.

## Reporting a Vulnerability

Please report vulnerabilities **privately** using GitHub's private vulnerability reporting:

**[→ Report a vulnerability](https://github.com/aaronbcarlisle/ffxiv-raid-planner/security/advisories/new)**

Please do **not** open a public issue, pull request, or discussion for security problems —
the production app holds real user data, and public disclosure before a fix puts those
users at risk.

A useful report includes:

- The affected endpoint, page, or component
- Steps to reproduce (a curl command or minimal script is ideal)
- What an attacker gains (impact), and any constraints (e.g. requires Member role)

This is a solo-maintained project: expect an acknowledgment within **7 days** and a fix
timeline in the initial response. You'll be credited in the advisory unless you prefer
otherwise.

## Testing Ground Rules

- **Do not test against production.** The app is fully self-hostable for testing — see
  the [development setup in the README](README.md#getting-started) to run it locally
  with SQLite and your own Discord OAuth app.
- Never access, modify, or exfiltrate data belonging to other users. If a vulnerability
  exposes someone else's data, stop at proof-of-access and report it.
- No automated scanning, fuzzing, or denial-of-service testing against
  `xivraidplanner.app` or its API.

## Scope

This repository covers the web app (React frontend, FastAPI backend). The Dalamud
companion plugin lives in a separate repository; issues in how *this* API authenticates
plugin requests (API keys, PKCE browser sign-in) are in scope here.
