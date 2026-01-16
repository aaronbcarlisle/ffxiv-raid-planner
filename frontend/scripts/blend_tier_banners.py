#!/usr/bin/env python3
"""
Blend Raid Tier Banners

Creates composite banner images by blending individual floor images for each raid tier.
The script fetches HD floor images from XIVAPI and blends them horizontally with
gradient transitions to create a single banner per tier.

Usage:
    # Generate banners from existing floor images
    python scripts/blend-tier-banners.py

    # Fetch fresh images from XIVAPI first, then blend
    python scripts/blend-tier-banners.py --fetch

    # Adjust the overlap ratio (default: 0.35)
    python scripts/blend-tier-banners.py --overlap 0.4

Output:
    - public/images/raid-tiers/{tier-id}.png (composite banners)
    - public/images/raid-tiers/floors/{floor}_{tier}.png (individual floor images)

The tier IDs match those in src/gamedata/raid-tiers.ts:
    - aac-heavyweight (M9S-M12S)
    - aac-cruiserweight (M5S-M8S)
    - aac-light-heavyweight (M1S-M4S)
    - anabaseios (P9S-P12S)
"""

from PIL import Image
import os
import argparse
import urllib.request
import sys

# Get the script's directory and project paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'public', 'images', 'raid-tiers')
FLOORS_DIR = os.path.join(OUTPUT_DIR, 'floors')

# XIVAPI base URL for HD images
XIVAPI_BASE = 'https://xivapi.com/i/112000'

# Tier definitions matching raid-tiers.ts
# Format: tier_id -> (display_name, floor_ids, xivapi_image_ids)
TIERS = {
    'aac-heavyweight': {
        'name': 'AAC Heavyweight',
        'floors': ['M9S', 'M10S', 'M11S', 'M12S'],
        'image_ids': [112638, 112640, 112642, 112644],
    },
    'aac-cruiserweight': {
        'name': 'AAC Cruiserweight',
        'floors': ['M5S', 'M6S', 'M7S', 'M8S'],
        'image_ids': [112598, 112600, 112602, 112604],
    },
    'aac-light-heavyweight': {
        'name': 'AAC Light-heavyweight',
        'floors': ['M1S', 'M2S', 'M3S', 'M4S'],
        'image_ids': [112568, 112570, 112572, 112574],
    },
    'anabaseios': {
        'name': 'Pandaemonium Anabaseios',
        'floors': ['P9S', 'P10S', 'P11S', 'P12S'],
        'image_ids': [112525, 112527, 112529, 112531],
    },
}


def fetch_floor_images(tier_id: str, tier_data: dict) -> bool:
    """Fetch HD floor images from XIVAPI for a tier."""
    print(f"  Fetching images for {tier_data['name']}...")

    os.makedirs(FLOORS_DIR, exist_ok=True)

    for floor, image_id in zip(tier_data['floors'], tier_data['image_ids']):
        url = f"{XIVAPI_BASE}/{image_id}_hr1.png"
        # Convert tier_id to filename format (e.g., "aac-heavyweight" -> "Heavyweight")
        tier_suffix = tier_data['name'].split()[-1]
        output_path = os.path.join(FLOORS_DIR, f"{floor}_{tier_suffix}.png")

        if os.path.exists(output_path):
            print(f"    {floor}: Already exists, skipping")
            continue

        try:
            print(f"    {floor}: Downloading from {url}")
            urllib.request.urlretrieve(url, output_path)
        except Exception as e:
            print(f"    {floor}: Failed to download - {e}")
            return False

    return True


def create_horizontal_gradient_mask(width: int, height: int) -> Image.Image:
    """Create a gradient mask from transparent (left) to opaque (right)."""
    mask = Image.new('L', (width, height), 0)
    for x in range(width):
        value = int(255 * x / width)
        for y in range(height):
            mask.putpixel((x, y), value)
    return mask


def blend_images_horizontal(images: list, overlap_ratio: float = 0.35) -> Image.Image:
    """
    Blend multiple images horizontally with gradient transitions.

    Args:
        images: List of PIL Image objects to blend
        overlap_ratio: How much each image overlaps with the next (0.0-1.0)

    Returns:
        PIL Image of the blended result
    """
    if not images:
        return None

    height = images[0].height
    single_width = images[0].width
    overlap = int(single_width * overlap_ratio)

    # Calculate final width
    final_width = single_width + (len(images) - 1) * (single_width - overlap)

    # Create result canvas
    result = Image.new('RGBA', (final_width, height), (0, 0, 0, 0))

    # Create gradient mask for blending
    gradient_mask = create_horizontal_gradient_mask(overlap, height)

    x_offset = 0
    for i, img in enumerate(images):
        if i == 0:
            # First image: paste fully
            result.paste(img, (0, 0))
            x_offset = single_width - overlap
        else:
            # Paste the non-overlapping part
            non_overlap = img.crop((overlap, 0, single_width, height))
            result.paste(non_overlap, (x_offset + overlap, 0))

            # Blend the overlap region using gradient mask
            overlap_region = img.crop((0, 0, overlap, height))
            result.paste(overlap_region, (x_offset, 0), gradient_mask)

            x_offset += single_width - overlap

    return result


def process_tier(tier_id: str, tier_data: dict, overlap_ratio: float = 0.35) -> bool:
    """Process a single tier and create its composite banner."""
    print(f"Processing {tier_data['name']}...")

    # Build floor image paths
    tier_suffix = tier_data['name'].split()[-1]
    floor_files = [f"{floor}_{tier_suffix}.png" for floor in tier_data['floors']]

    # Load images
    images = []
    for f in floor_files:
        path = os.path.join(FLOORS_DIR, f)
        if not os.path.exists(path):
            print(f"  Warning: {f} not found, skipping tier")
            return False
        img = Image.open(path).convert('RGBA')
        images.append(img)

    if len(images) < 2:
        print(f"  Error: Need at least 2 images to blend")
        return False

    # Blend images
    blended = blend_images_horizontal(images, overlap_ratio)

    # Save with tier ID as filename
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, f"{tier_id}.png")
    blended.save(output_path, 'PNG')
    print(f"  Saved: {tier_id}.png ({blended.size[0]}x{blended.size[1]})")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='Blend raid tier floor images into composite banners',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        '--fetch', '-f',
        action='store_true',
        help='Fetch fresh HD images from XIVAPI before blending'
    )
    parser.add_argument(
        '--overlap', '-o',
        type=float,
        default=0.35,
        help='Overlap ratio between images 0.0-1.0 (default: 0.35)'
    )
    parser.add_argument(
        '--tier', '-t',
        choices=list(TIERS.keys()),
        help='Process only a specific tier'
    )
    args = parser.parse_args()

    print(f"Output directory: {OUTPUT_DIR}")
    print()

    # Determine which tiers to process
    tiers_to_process = {args.tier: TIERS[args.tier]} if args.tier else TIERS

    # Fetch images if requested
    if args.fetch:
        print("Fetching floor images from XIVAPI...")
        for tier_id, tier_data in tiers_to_process.items():
            if not fetch_floor_images(tier_id, tier_data):
                print(f"Failed to fetch images for {tier_id}")
                sys.exit(1)
        print()

    # Process each tier
    print("Creating composite banners...")
    success_count = 0
    for tier_id, tier_data in tiers_to_process.items():
        if process_tier(tier_id, tier_data, args.overlap):
            success_count += 1

    print()
    print(f"Done! Created {success_count}/{len(tiers_to_process)} tier banners.")


if __name__ == '__main__':
    main()
