#!/usr/bin/env python3
"""Minimal W3C-token -> CSS-variables generator. Proves tokens.json is buildable.
Resolves {refs}, flattens to --token-path, emits :root CSS."""
import json, re

def load(p): return json.load(open(p))

def walk(node, path, out):
    if isinstance(node, dict):
        if "$value" in node:
            out[".".join(path)] = node["$value"]
        else:
            for k,v in node.items():
                if k.startswith("$"): continue
                walk(v, path+[k], out)

def resolve(val, flat, seen=None):
    if not isinstance(val, str): return val
    seen = seen or set()
    m = re.fullmatch(r"\{([^}]+)\}", val.strip())
    if m:
        ref = m.group(1)
        if ref in seen: return val
        return resolve(flat.get(ref, val), flat, seen|{ref})
    # inline refs inside a longer string (none expected, but safe)
    return val

d = load("tokens.json")
flat = {}
for tier in ("primitive","semantic","component"):
    walk(d[tier], [tier], flat)

# resolve references
resolved = {k: resolve(v, flat) for k,v in flat.items()}

# emit only color/dimension/number leaves as CSS vars (skip composite typography dicts)
lines = [":root {"]
for k,v in resolved.items():
    if isinstance(v,(dict,list)):
        if isinstance(v,list) and all(isinstance(x,str) for x in v):
            v = ", ".join(v)
        else:
            continue
    var = "--" + k.replace(".","-")
    lines.append(f"  {var}: {v};")
lines.append("}")
css = "\n".join(lines)
open("tokens.generated.css","w").write(css)
print(f"Generated {len([l for l in lines if l.strip().startswith('--')])} CSS variables")
# spot-check a few resolved chains
for probe in ["component.button.primary.bg","semantic.color.surface.card","semantic.color.accent.dim","component.card.radius"]:
    print(f"  {probe} = {resolved.get(probe)}")
