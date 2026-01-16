#!/usr/bin/env python3
"""
Download gear slot icons from XIVAPI and colorize them in multiple variants.

This script:
1. Downloads gear slot icons from XIVAPI
2. Creates multiple color variants for comparison
3. Saves them locally in public/images/gear-slots/
"""

import os
from pathlib import Path
from urllib.request import urlretrieve
from PIL import Image

# Gear slot icon URLs from XIVAPI
GEAR_ICONS = {
    'weapon': 'https://xivapi.com/img-misc/gear/mainhand.png',
    'head': 'https://xivapi.com/img-misc/gear/head.png',
    'body': 'https://xivapi.com/img-misc/gear/body.png',
    'hands': 'https://xivapi.com/img-misc/gear/hands.png',
    'legs': 'https://xivapi.com/img-misc/gear/legs.png',
    'feet': 'https://xivapi.com/img-misc/gear/feet.png',
    'earring': 'https://xivapi.com/img-misc/gear/ear.png',
    'necklace': 'https://xivapi.com/img-misc/gear/neck.png',
    'bracelet': 'https://xivapi.com/img-misc/gear/wrist.png',
    'ring': 'https://xivapi.com/img-misc/gear/ring.png',
}

# Color variants to generate
# Format: (name, RGB tuple)
COLOR_VARIANTS = {
    'white': (255, 255, 255),
    'black': (0, 0, 0),
    'gray': (160, 160, 160),
    'teal': (20, 184, 166),  # Tailwind teal-500, app's accent color
    'gold': (255, 210, 100),  # Original attempt
    'gold-vibrant': (255, 195, 0),  # More saturated gold
    'gold-rich': (218, 165, 32),  # Goldenrod - classic gold
    'gold-bright': (255, 215, 0),  # Pure gold color
    'amber': (245, 158, 11),  # Tailwind amber-500
    'yellow': (250, 204, 21),  # Tailwind yellow-400
}


def colorize_icon(image: Image.Image, target_rgb: tuple) -> Image.Image:
    """
    Colorize a grayscale/white icon to the target color.

    The input icons are white/gray silhouettes on transparent backgrounds.
    We tint them to the target color while preserving the alpha channel.
    """
    # Ensure RGBA mode
    if image.mode != 'RGBA':
        image = image.convert('RGBA')

    width, height = image.size
    result = Image.new('RGBA', (width, height))

    pixels = image.load()
    result_pixels = result.load()

    for y in range(height):
        for x in range(width):
            r_val, g_val, b_val, a_val = pixels[x, y]

            if a_val > 0:
                # Calculate luminance of original pixel (0-1 range)
                luminance = (r_val + g_val + b_val) / 3 / 255

                # Apply target color proportional to luminance
                new_r = int(target_rgb[0] * luminance)
                new_g = int(target_rgb[1] * luminance)
                new_b = int(target_rgb[2] * luminance)

                result_pixels[x, y] = (new_r, new_g, new_b, a_val)
            else:
                result_pixels[x, y] = (0, 0, 0, 0)

    return result


def main():
    # Determine output directory
    script_dir = Path(__file__).parent
    base_output_dir = script_dir.parent / 'public' / 'images' / 'gear-slots'

    # Create temp dir for downloads
    temp_dir = base_output_dir / 'temp'
    temp_dir.mkdir(parents=True, exist_ok=True)

    print(f"Output directory: {base_output_dir}")
    print(f"Generating {len(COLOR_VARIANTS)} color variants for {len(GEAR_ICONS)} icons...\n")

    # Download all icons first
    downloaded = {}
    for slot, url in GEAR_ICONS.items():
        temp_path = temp_dir / f'{slot}.png'
        try:
            urlretrieve(url, temp_path)
            downloaded[slot] = temp_path
            print(f"Downloaded {slot}")
        except Exception as e:
            print(f"ERROR downloading {slot}: {e}")

    print()

    # Generate each color variant
    for variant_name, color_rgb in COLOR_VARIANTS.items():
        variant_dir = base_output_dir / variant_name
        variant_dir.mkdir(parents=True, exist_ok=True)

        print(f"Generating {variant_name} variant (RGB: {color_rgb})...")

        for slot, temp_path in downloaded.items():
            try:
                with Image.open(temp_path) as img:
                    colorized = colorize_icon(img, color_rgb)
                    output_path = variant_dir / f'{slot}.png'
                    colorized.save(output_path, 'PNG')
            except Exception as e:
                print(f"  ERROR processing {slot}: {e}")

        print(f"  Saved to {variant_dir}")

    # Also save to root for the default (use gold-vibrant as default)
    print("\nSetting gold-vibrant as default...")
    default_color = COLOR_VARIANTS['gold-vibrant']
    for slot, temp_path in downloaded.items():
        try:
            with Image.open(temp_path) as img:
                colorized = colorize_icon(img, default_color)
                output_path = base_output_dir / f'{slot}.png'
                colorized.save(output_path, 'PNG')
        except Exception as e:
            print(f"  ERROR processing {slot}: {e}")

    # Clean up temp files
    print("\nCleaning up temp files...")
    for temp_path in downloaded.values():
        if temp_path.exists():
            temp_path.unlink()
    if temp_dir.exists():
        temp_dir.rmdir()

    print("\nDone!")
    print("\nTo test different variants, update GEAR_SLOT_ICONS in types/index.ts:")
    print()
    for variant_name in COLOR_VARIANTS.keys():
        print(f"  // {variant_name.upper()} variant:")
        print(f"  weapon: '/images/gear-slots/{variant_name}/weapon.png',")
        print()


if __name__ == '__main__':
    main()
