# F2 duplication baseline (jscpd)

- Captured: 2026-06-28 on `redesign/f2-anti-regression`.
- Scope: `frontend/src` (excludes tests, gamedata, generated CSS, e2e).
- Current duplication: **4.16%** (pinned `threshold` in `frontend/.jscpd.json` = ceil(4.16) = 5).
- Policy: gate fails on duplication ABOVE the threshold (new copy-paste). The
  existing backlog is intentionally not deduped here — dedupe happens at F3/F4/F6
  when the duplicated components are rebuilt.
