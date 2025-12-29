#!/usr/bin/env python3
"""
Normalize BiS preset display names to format:
  [GCD] Savage BiS
  [GCD] Savage BiS (descriptor)

For Ultimate:
  [GCD] [Ultimate] BiS
  [GCD] [Ultimate] BiS (descriptor)
"""

import json
import re

PRESETS_FILE = "/home/serapis/projects/ffxiv-raid-planner/backend/app/data/local_bis_presets.json"

# Words to strip from descriptors (case-insensitive)
STRIP_WORDS = [
    'bis', 'best-in-slot', 'best in slot', 'savage', 'current',
    'set', 'gear', 'gearset', 'prog', 'week 1', 'week1',
    'gcd', 'patch', 'ilvl', 'i790', 'i780', '7.4', '7.3', '7.2'
]

# Ultimate name mapping
ULTIMATE_NAMES = {
    'fru': 'FRU',
    'top': 'TOP',
    'dsr': 'DSR',
    'tea': 'TEA',
    'ucob': 'UCoB',
    'uwu': 'UWU',
}

def extract_gcd(text: str) -> tuple[str | None, str]:
    """Extract GCD from text like '2.50 Popcorn' -> ('2.50', 'Popcorn')"""
    if not text:
        return None, text

    # Pattern: starts with X.XX where X is 1-2 digits
    match = re.match(r'^(\d\.\d{2})\s*(.*)$', text.strip())
    if match:
        return match.group(1), match.group(2).strip()
    return None, text

def clean_descriptor(text: str, gcd: str = '') -> str:
    """Remove common words to get just the unique descriptor."""
    if not text:
        return ''

    result = text
    for word in STRIP_WORDS:
        # Remove word with optional surrounding spaces/punctuation
        pattern = rf'(?i)\b{re.escape(word)}\b[:\-,\s]*'
        result = re.sub(pattern, ' ', result)

    # Remove redundant GCD mentions (e.g., "2.5" or "2.50" when we already have it)
    if gcd:
        # Remove the exact GCD or shortened version
        short_gcd = gcd.rstrip('0').rstrip('.')  # 2.50 -> 2.5
        for g in [gcd, short_gcd]:
            pattern = rf'\b{re.escape(g)}\b[\s,\-]*'
            result = re.sub(pattern, ' ', result)

    # Clean up multiple spaces and trim
    result = re.sub(r'\s+', ' ', result).strip()
    # Remove leading/trailing punctuation
    result = re.sub(r'^[\-:,\s]+|[\-:,\s]+$', '', result)

    return result

def normalize_preset_name(preset: dict) -> str:
    """Generate normalized display name."""
    category = preset.get('category', 'savage')
    gcd = preset.get('gcd', '')
    original_name = preset.get('originalName', '')
    github_tier = preset.get('githubTier', '')

    # Try to extract GCD from original name if not in gcd field
    if not gcd:
        extracted_gcd, _ = extract_gcd(original_name)
        if extracted_gcd:
            gcd = extracted_gcd

    # Get unique descriptor from original name
    _, remainder = extract_gcd(original_name)
    descriptor = clean_descriptor(remainder, gcd)

    # Build the name
    parts = []

    # Add GCD if available
    if gcd:
        parts.append(gcd)

    # Add content type
    if category == 'ultimate':
        ultimate_name = ULTIMATE_NAMES.get(github_tier, github_tier.upper() if github_tier else 'Ultimate')
        parts.append(f'{ultimate_name} BiS')
    else:
        parts.append('Savage BiS')

    base_name = ' '.join(parts)

    # Add descriptor in parentheses if it exists and adds info
    if descriptor and descriptor.lower() not in ['', 'true', 'no']:
        return f'{base_name} ({descriptor})'

    return base_name

def main():
    with open(PRESETS_FILE, 'r') as f:
        data = json.load(f)

    changes = []

    for job_key, job_data in data.items():
        if job_key == '_meta':
            continue

        presets = job_data.get('presets', [])
        for preset in presets:
            old_name = preset.get('displayName', '')
            new_name = normalize_preset_name(preset)

            if old_name != new_name:
                changes.append((job_key.upper(), old_name, new_name))
                preset['displayName'] = new_name

    # Save updated file
    with open(PRESETS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Updated {len(changes)} preset names\n")

    # Show sample changes
    print("=== Sample changes ===")
    for job, old, new in changes[:15]:
        print(f"{job}: '{old}' -> '{new}'")

    if len(changes) > 15:
        print(f"\n... and {len(changes) - 15} more")

if __name__ == '__main__':
    main()
