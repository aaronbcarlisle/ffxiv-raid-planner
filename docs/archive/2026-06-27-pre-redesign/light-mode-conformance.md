# Light-Mode Conformance — Wave 4 sweep targets

> Tracked backlog for **Plan J Tasks 2–4** (theme/light-mode offender conversion), which runs as a
> once-over sweep in **Wave 4** (per `ROADMAP.md`) after the feature set is final. Hardcoded
> dark colors/gradients that ignore the theme go here; convert them to tokens
> (`color-mix(in srgb, var(--color-accent) X%, transparent)`, `var(--color-overlay-raise)`,
> `var(--gradient-rail)`, parchment/seal tokens). See [DESIGN_SYSTEM_SUMMARY.md](../DESIGN_SYSTEM_SUMMARY.md#-theme-tokens--accent-tints).

## Reported in Wave 1 manual smoke (2026-06-26)

These surfaces stay dark in **light** mode and must be tokenized:

- **Schedule page cards** — the "recurring series", "Discord sync", and "Dalamud plugin" panels
  (`components/schedule/ScheduleUpcomingPanel.tsx` and the recurring/integration cards). The same
  dark card style recurs on the **Gear & Sync** page.
- **`components/group/PluginPage.tsx`** — new plugin-setup page (moved out of Gear & Sync). Install-step
  medallions use `rgba(20,184,166,…)`; the API-key panel uses `rgba(255,255,255,0.02)`. Convert to
  accent `color-mix` + `--color-overlay-raise`.
- **`components/group/MorePage.tsx`** — card sections.
- **`components/group/GearSyncDashboard.tsx`** — the SYNC HEALTH / BIS PROGRESS / ROLE COVERAGE / STALE
  MEMBERS / RECENT SYNC / TEAM SUMMARY dashboard cards.

## Already done (do not re-flag)

- **Rail gradient** — `AppRail.tsx` now uses `var(--gradient-rail)` (themed). Both the static rail and
  the Player Hub rail route through `AppRail`, so both are covered.
- **Token foundation** — rail-gradient / overlay-raise / parchment-seal tokens landed in
  `ui/wave1-enforcement` (Plan J Task 1).
