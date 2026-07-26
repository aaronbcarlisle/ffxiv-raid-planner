# Phase B Step 0 — Prod Analytics Mining Report (audit output, preserved verbatim)

> ⚠️ **ATTRIBUTION CORRECTION (director sweep 2026-07-26, verified via git archaeology):** the "V2 shell tabs (sidebar_switch)" section below is MISLABELED. `sidebar_switch`/`sidebar_plugin` are emitted ONLY by the LEGACY shell's SidebarNav (introduced by PR #144, 2026-06-26; mounted at GroupView.tsx:394). `tab_switch` keys (players/loot/history/stats/...) are the RETIRED pre-#144 legacy tab bar (TabNavigation.tsx, deleted in #144; `stats` was labeled "Summary — Team-wide gear statistics"). V2's Spine emits tab_switch with surface:'spine' and has ~ZERO events in this window (Spine landed 2026-06-30 admin-gated; snapshot ends 2026-07-12). So: tab_switch = legacy era 1 (~10.5 wks), sidebar_switch = legacy era 2 (~2.3 wks), v2 = no data. NEVER read the two event families as a legacy-vs-v2 comparison.

Source: railway_prod_copy @ localhost:5433, 2026-07-12 snapshot. All numbers from SQL.

## Headline
- 8,921 events · window 2026-04-13 → 2026-07-12 (~13 wks) · 247 distinct users (of 1,389 registered = 17.8%) · 1,384 sessions
- Last 8wk: 5,972 events. error_reports: 517 rows / 78 users.
- Category split: navigation 7,859 · player 518 · feature 329 · wizard 85 · loot 83 · admin 47

## Tab usage (tab_switch = LEGACY ERA 1, the retired pre-#144 tab bar; all-time; events / distinct users)
players 540/91 · loot 514/76 · history 366/70 · stats 212/59 · schedule 116/34 · home 49/16 · mount-farms 33/14

## ~~V2 tabs~~ LEGACY ERA 2 tabs (sidebar_switch = the post-#144 legacy SidebarNav, NOT v2 — see correction banner): overview 136/31 · roster 125/29 · gear 97/25 · schedule 96/24 · goals 69/22 · more 38/18 · (sidebar_plugin event 8/5)

## Roster view_mode_change: expanded 203 (71 users) vs compact 126 (51 users)

## Non-group paths (events/users)
/group/:code 5,928/222 · / 913/174 · /dashboard 741/137 · /auth/callback 400/218 · /profile 165/29 · /admin/overview 74/2 · /docs/release-notes 60/25 · /discover 57/12 · /invite/* ~250 · /plugin-auth 25/11 · /docs 24/9 · /docs/roadmap 14/5 · /admin/usage 12/2 · /admin/errors 11/2 · /docs/quick-start 11/10

## CRITICAL FINDINGS
1. **page_url has ZERO query strings** (analytics.ts:73 uses location.pathname) — tab mining from page_url impossible; tab data comes only from tab_switch/sidebar_switch events; NO sub-tab tracking exists anywhere.
2. **DEAD WIRING**: player_gear_changed, loot_logged, loot_deleted, modal_open/close, tier_changed, player_update, tier_create = 0 events EVER. analytics.ts:50-58 subscribes to eventBus events that have only 2 live emitters repo-wide (MEMBER_ROLE_CHANGED, MOUNT_FARM_SCHEDULE). Dead since PR #76. **On-card gear-edit frequency is unanswerable from data.** Modal ranking impossible.
3. Proxy for Phase C: expanded-view preference (203/126 events, 71/51 users) suggests the detailed card is the majority daily driver.

## Events WITH data (direct analytics.track calls; all-time / 8wk / users)
page_view 5,460/3,803/247 · player_configure 225/140/32 (role: melee 58, healer 57, tank 51, ranged 33, caster 26; top job WHM 20) · bis_import 182/120/86 (preset 109, xivgear 66, etro 7) · player_claim 103/69/94 (positions even 10–16 each) · loot_log 66/22/17 (M9S 24, M11S 19, M10S 17, M12S 6; drop 63/book 3) · setup_wizard_start 54/37/42 · setup_wizard_complete 31/22/28 (91% conversion) · static_create 31/22/28 · material_log 17/6/5 (solvent 7, twine 7, glaze 3) · member_role_changed 9/8/4 (all → lead) · bis_import_error 8/7/6 (malformed links) · api_key_create 7/7/7 · sidebar_plugin 8/8/5

## Error-URL corroboration (small-N, error-biased; 127 frontend error URLs w/ tab=)
roster 96 · collections 13 · players 5 · jobs-gear 3 · schedule 3 · sync 2 · gear 2 · goals 2 · home 1 · summary 1 · availability 1

## Caveats
- DNT users invisible (collector disables on doNotTrack=1).
- Snapshot ends 2026-07-12T14:56Z.
- AnalyticsDailyAggregate: event_count rollup covers ONLY 2026-03-19→04-13 (pre-raw-events; job retired when raw storage began). Aggregate-only window totals: page_view 1,616, tab_switch 1,269, loot_log 304, player_configure 139, view_mode_change 138, material_log 88, bis_import 78, wizard_start 32, static_create 19, wizard_complete 19, player_claim 16.
- ui_shell_toggle/banner_dismiss = 0 expected (instrumentation not in prod build at snapshot).
- error_reports split: unhandled_rejection 255 / backend_error 254 / js_error 8.
