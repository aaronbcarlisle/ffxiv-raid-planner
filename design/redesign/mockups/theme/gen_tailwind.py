#!/usr/bin/env python3
"""Generate a Tailwind 4 theme.css from tokens.json + tokens.light.json.
Architecture:
  :root            -> primitive vars + semantic vars (dark = base)
  [data-theme=light] -> semantic var overrides only
  @theme           -> namespaced Tailwind tokens that REFERENCE the semantic vars
                      (so bg-surface-card / text-role-tank / rounded-card theme-switch for free)
"""
import json, re

def load(p): return json.load(open(p))
d = load("tokens.json")
light = load("tokens.light.json")

def walk(node, path, out):
    if isinstance(node, dict):
        if "$value" in node:
            out[".".join(path)] = node["$value"]
        else:
            for k,v in node.items():
                if k.startswith("$"): continue
                walk(v, path+[k], out)

prim, sem, comp = {}, {}, {}
walk(d["primitive"], [], prim)
walk(d["semantic"], [], sem)
walk(d["component"], [], comp)
lightflat = {}
walk(light["semantic"], [], lightflat)

def cssvar(path): return "--" + path.replace(".","-")

def resolve_ref(v):
    """Turn {primitive.color.teal.500} into var(--primitive-color-teal-500)."""
    if not isinstance(v, str): return v
    m = re.fullmatch(r"\{([^}]+)\}", v.strip())
    if m:
        return f"var(--{m.group(1).replace('.','-')})"
    return v

# ---- build :root ----
root_lines = [":root {"]
root_lines.append("  /* ---------- TIER 1: primitives (raw values) ---------- */")
for k,v in prim.items():
    if isinstance(v, list):  # fontFamily
        v = ", ".join(f'"{x}"' if " " in x else x for x in v)
    if isinstance(v,(str,int,float)):
        root_lines.append(f"  --primitive-{k.replace('.','-')}: {v};")
root_lines.append("")
root_lines.append("  /* ---------- TIER 2: semantic (intent) — dark base; light overrides below ---------- */")
for k,v in sem.items():
    if isinstance(v, dict):  # composite typography — skip from var layer, handled in @theme text
        continue
    if isinstance(v, list):
        v = ", ".join(f'"{x}"' if " " in x else x for x in v)
    root_lines.append(f"  --semantic-{k.replace('.','-')}: {resolve_ref(v)};")
root_lines.append("")
root_lines.append("  /* ---------- TIER 3: component (per-component) ---------- */")
for k,v in comp.items():
    if isinstance(v, dict): continue
    if isinstance(v, list):
        v = ", ".join(f'"{x}"' if " " in x else x for x in v)
    root_lines.append(f"  --component-{k.replace('.','-')}: {resolve_ref(v)};")
root_lines.append("}")

# ---- light overrides (semantic only) ----
light_lines = ['', '[data-theme="light"] {',
               "  /* Only the SEMANTIC tier is overridden — the whole point of the tiered model. */"]
for k,v in lightflat.items():
    light_lines.append(f"  --semantic-{k.replace('.','-')}: {resolve_ref(v)};")
light_lines.append("}")

# ---- @theme: map namespaced Tailwind tokens onto semantic vars ----
theme = ['', '@theme {',
  "  /* Namespaced tokens here AUTO-GENERATE utilities (bg-*, text-*, rounded-*, …).",
  "     They reference the semantic vars above, so every utility theme-switches for free. */", '']

# colors -> --color-* namespace  (bg-surface-card, text-role-tank, border-default, etc.)
theme.append("  /* surfaces */")
for name in ["base","raised","card","elevated","overlay","interactive"]:
    theme.append(f"  --color-surface-{name}: var(--semantic-color-surface-{name});")
theme.append("  /* accent */")
for name in ["default","hover","dim","muted","deep","on-accent"]:
    theme.append(f"  --color-accent-{name}: var(--semantic-color-accent-{name});")
theme.append("  /* text */")
for name in ["primary","secondary","tertiary","muted","disabled","on-accent"]:
    theme.append(f"  --color-text-{name}: var(--semantic-color-text-{name});")
theme.append("  /* borders (note: Tailwind border-* utilities) */")
for name in ["subtle","default","highlight","focus"]:
    theme.append(f"  --color-border-{name}: var(--semantic-color-border-{name});")
theme.append("  /* roles */")
for name in ["tank","healer","melee","ranged","caster"]:
    theme.append(f"  --color-role-{name}: var(--semantic-color-role-{name});")
theme.append("  /* gear sources */")
for name in ["raid","tome","base-tome","augmented","crafted"]:
    theme.append(f"  --color-gear-{name}: var(--semantic-color-gear-source-{name});")
theme.append("  /* membership */")
for name in ["owner","lead","member","viewer","linked"]:
    theme.append(f"  --color-membership-{name}: var(--semantic-color-membership-{name});")
theme.append("  /* status */")
for name in ["success","warning","error","info"]:
    theme.append(f"  --color-status-{name}: var(--semantic-color-status-{name});")

# fonts -> --font-* namespace
theme.append("")
theme.append("  /* fonts -> font-display / font-sans / font-mono */")
for name in ["display","sans","mono"]:
    theme.append(f"  --font-{name}: var(--primitive-font-family-{name});")

# text sizes -> --text-* namespace (text-hero, text-title, …)
theme.append("")
theme.append("  /* type scale -> text-hero / text-title / … */")
for name in ["hero","title","section","lg","body","sm","caption","micro"]:
    theme.append(f"  --text-{name}: var(--primitive-font-size-{name});")

# radii -> --radius-* namespace (rounded-card uses component token)
theme.append("")
theme.append("  /* radii -> rounded-sm/base/lg/xl/pill + component rounded-card/button */")
for name in ["sm","base","lg","xl","pill"]:
    theme.append(f"  --radius-{name}: var(--primitive-radius-{name});")
theme.append(f"  --radius-card: var(--component-card-radius);")
theme.append(f"  --radius-button: var(--component-button-radius);")

# spacing -> --spacing-* (keep Tailwind's base but expose named steps)
theme.append("")
theme.append("  /* spacing steps -> p-1/2/3/4/6/8/12 already exist; expose container widths */")
for name in ["data","standard","focus","doc"]:
    theme.append(f"  --container-{name}: var(--primitive-size-container-{name});")

theme.append("}")

out = "\n".join(["/* ============================================================",
  "   theme.css — generated from tokens.json + tokens.light.json",
  "   Tailwind CSS 4. Import after `@import \"tailwindcss\";`.",
  "   DO NOT hand-edit — regenerate via Style Dictionary / this script.",
  "   ============================================================ */",
  '@import "tailwindcss";', ''] + root_lines + light_lines + theme + [''])
open("theme.css","w").write(out)
print("Wrote theme.css")
print("  primitives:", len(prim), "| semantic:", len([k for k,v in sem.items() if not isinstance(v,dict)]), "| component:", len([k for k,v in comp.items() if not isinstance(v,dict)]))
# sanity: show a themed chain
print("  example utilities generated: bg-surface-card, text-role-tank, rounded-card, max-w-data, font-display, text-hero")
