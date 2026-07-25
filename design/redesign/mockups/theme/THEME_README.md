# theme.css — Tailwind 4 starter (generated from tokens)

A ready-to-drop Tailwind CSS 4 theme generated from `tokens.json` + `tokens.light.json`. **Verified against Tailwind v4.3.1** — the custom utilities below actually compile.

## What it gives you

Real Tailwind utilities, generated from the tokens, that **theme-switch for free**:

| Utility family | Examples |
|---|---|
| Surfaces | `bg-surface-base` `bg-surface-card` `bg-surface-overlay` |
| Accent | `bg-accent-default` `text-accent-on-accent` `border-accent-default` |
| Text | `text-text-primary` `text-text-secondary` `text-text-tertiary` |
| Borders | `border-border-default` `border-border-highlight` |
| Roles | `text-role-tank` `bg-role-healer` `border-role-melee` … |
| Gear sources | `text-gear-raid` `bg-gear-tome` `text-gear-augmented` … |
| Membership | `text-membership-owner` `bg-membership-lead` … |
| Status | `text-status-success` `bg-status-error` … |
| Type | `font-display` `font-sans` `text-hero` `text-title` `text-section` |
| Radii | `rounded-sm/base/lg/xl/pill` `rounded-card` `rounded-button` |
| Containers | `max-w-data` (2160) `max-w-standard` (1760) `max-w-focus` (1100) `max-w-doc` (960) |

## How it's structured (and why)

```
:root
  --primitive-*   raw values (teal-500, ink-2, …)
  --semantic-*    intent, references primitives  ← dark base
  --component-*   per-component, references semantic
[data-theme="light"]
  --semantic-*    light overrides ONLY            ← re-theme flips just this tier
@theme
  --color-* --font-* --text-* --radius-* --container-*
                  Tailwind-namespaced tokens that reference --semantic-*
                  → generate utilities that theme-switch automatically
```

A utility like `bg-surface-card` resolves: `--color-surface-card` → `--semantic-color-surface-card` → `#0e0e14` in dark, `#ffffff` under `[data-theme="light"]`. **You never change a utility to switch themes** — only the semantic tier flips.

## Wiring it into the app

1. Replace the contents of your global stylesheet's import with `theme.css` (it already begins with `@import "tailwindcss";`). With the Vite plugin (`@tailwindcss/vite`) no further config is needed.
2. Set `data-theme="light"` on `<html>` to switch themes (default/no attribute = dark).
3. **Don't hand-edit `theme.css`.** It's generated. Edit `tokens.json` and regenerate.

## Regenerating (make it a real build step)

`gen_tailwind.py` is the reference generator (proves the round-trip). For production, replace it with **Style Dictionary** (v4, DTCG-native) as a `pnpm` script + CI step so `tokens.json` is the single source and `theme.css` is a build artifact. The Python script is fine to start; swap it when you wire CI.

## Note on the old `index.css`

The atoms here are byte-for-byte the same values as the current `frontend/src/index.css` (verified). So adopting this is **not** a visual change — it's the same colors/type, now tiered and Tailwind-native. The structural tokens (containers, the rail width, component tokens) are the new additions.

## Caveats

- A few `--color-*` utilities point at semantic vars that only exist in dark (e.g. `accent-muted`, `accent-deep`, `border-focus`, `text-disabled`) — these don't have light overrides yet because the v2 light theme didn't define them. They fall back to the dark value in light mode. Add light values to `tokens.light.json` if/when you want them to differ.
- Opacity utilities like `bg-status-success/20` work via Tailwind's `--alpha()`; confirm against your real components.
- `text-micro` (11px) is the smallest type token; the 9px readable floor is a lint rule, not a token.
