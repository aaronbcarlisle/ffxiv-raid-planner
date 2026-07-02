#!/usr/bin/env python3
"""
Download FFXIV concept icons from XIVAPI for use as UI icons.

Adds game-thematic icons for domain concepts (materia, tomestones, gil, etc.)
alongside the existing bundled sprite set in public/icons/.

Run with:  python scripts/fetch-concept-icons.py
"""

import urllib.request
from pathlib import Path

XIVAPI_BASE = 'https://xivapi.com'

# name -> XIVAPI icon path (verified via API)
ICONS: dict[str, str] = {
    # --- Loot & currency ---
    'xiv-materia':      '/i/020000/020278.png',  # Piety Materia VIII (gem crystal)
    'xiv-tomestone':    '/i/065000/065023.png',  # Allagan Tomestone of Poetics
    'xiv-gil':          '/i/065000/065002.png',  # Gil
    # --- Rewards & content ---
    'xiv-orchestrion':  '/i/025000/025945.png',  # Orchestrion Roll (music)
    'xiv-sword':        '/i/034000/034244.png',  # Antiquated Deathbringer (DRK relic)
    # --- Magic & aether ---
    'xiv-crystal':      '/i/020000/020010.png',  # Wind Crystal (aether/sparkle)
    # --- Actions ---
    'xiv-earthly-star': '/i/003000/003143.png',  # Earthly Star (AST — priority star)
    # --- Social ---
    'xiv-handshake':    '/i/065000/065042.png',  # Fellowship/social bond (share/profile)
}


UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'


def fetch(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req) as resp:
        dest.write_bytes(resp.read())


def main() -> None:
    output_dir = Path(__file__).parent.parent / 'public' / 'icons'
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f'Saving icons to: {output_dir}\n')
    ok = 0
    for name, path in ICONS.items():
        url = XIVAPI_BASE + path
        dest = output_dir / f'{name}.png'
        try:
            fetch(url, dest)
            size = dest.stat().st_size
            print(f'  OK  {name}.png  ({size:,} bytes)')
            ok += 1
        except Exception as exc:
            print(f'  ERR {name}.png  -- {exc}')

    print(f'\nDone: {ok}/{len(ICONS)} icons downloaded.')


if __name__ == '__main__':
    main()
