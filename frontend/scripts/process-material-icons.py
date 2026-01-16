#!/usr/bin/env python3
"""
Process upgrade material icons to create generic silhouette versions.

This script:
1. Loads the original XIVAPI material icons
2. Creates silhouette versions (like the gear slot icons)
3. Generates multiple color variants

The originals have detailed colors and backgrounds - this creates
simple monochrome versions that match the gear slot icon style.
"""

import os
from pathlib import Path
from PIL import Image

# Color variants to generate (same as gear slot icons)
COLOR_VARIANTS = {
    'white': (255, 255, 255),
    'black': (0, 0, 0),
    'gray': (160, 160, 160),
    'teal': (20, 184, 166),
    'gold-vibrant': (255, 195, 0),
}

def create_silhouette(image: Image.Image, target_rgb: tuple) -> Image.Image:
    """
    Convert an icon to a solid color silhouette.

    Takes pixels with alpha > threshold and makes them the target color.
    Removes background and creates a clean silhouette.
    """
    if image.mode != 'RGBA':
        image = image.convert('RGBA')

    width, height = image.size
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))

    pixels = image.load()
    result_pixels = result.load()

    # Alpha threshold - pixels above this are considered part of the icon
    alpha_threshold = 128

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]

            if a > alpha_threshold:
                # Calculate luminance to preserve some depth
                luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255

                # Apply target color with luminance for subtle shading
                # Use a narrower range (0.6 to 1.0) for more uniform appearance
                factor = 0.6 + (luminance * 0.4)

                new_r = int(target_rgb[0] * factor)
                new_g = int(target_rgb[1] * factor)
                new_b = int(target_rgb[2] * factor)

                result_pixels[x, y] = (new_r, new_g, new_b, a)
            else:
                result_pixels[x, y] = (0, 0, 0, 0)

    return result


def create_flat_silhouette(image: Image.Image, target_rgb: tuple) -> Image.Image:
    """
    Create a completely flat silhouette (no shading).
    """
    if image.mode != 'RGBA':
        image = image.convert('RGBA')

    width, height = image.size
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))

    pixels = image.load()
    result_pixels = result.load()

    alpha_threshold = 128

    for y in range(height):
        for x in range(width):
            _, _, _, a = pixels[x, y]

            if a > alpha_threshold:
                result_pixels[x, y] = (target_rgb[0], target_rgb[1], target_rgb[2], a)
            else:
                result_pixels[x, y] = (0, 0, 0, 0)

    return result


def main():
    script_dir = Path(__file__).parent
    base_dir = script_dir.parent / 'public' / 'images' / 'materials'
    original_dir = base_dir / 'original'

    if not original_dir.exists():
        print(f"Error: Original icons not found at {original_dir}")
        print("Please download the icons first using:")
        print("  curl -O https://xivapi.com/i/021000/021686.png  # twine")
        print("  curl -O https://xivapi.com/i/027000/027636.png  # glaze")
        print("  curl -O https://xivapi.com/i/027000/027637.png  # solvent")
        print("  curl -O https://xivapi.com/i/026000/026652.png  # tomestone")
        return

    materials = ['twine', 'glaze', 'solvent', 'tomestone']

    print(f"Processing material icons from {original_dir}")
    print(f"Generating {len(COLOR_VARIANTS)} color variants...\n")

    # Generate shaded silhouettes (with luminance preserved)
    for variant_name, color_rgb in COLOR_VARIANTS.items():
        variant_dir = base_dir / variant_name
        variant_dir.mkdir(parents=True, exist_ok=True)

        print(f"Generating {variant_name} variant (RGB: {color_rgb})...")

        for material in materials:
            input_path = original_dir / f'{material}.png'
            if not input_path.exists():
                print(f"  Warning: {input_path} not found, skipping")
                continue

            try:
                with Image.open(input_path) as img:
                    silhouette = create_silhouette(img, color_rgb)
                    output_path = variant_dir / f'{material}.png'
                    silhouette.save(output_path, 'PNG')
            except Exception as e:
                print(f"  Error processing {material}: {e}")

        print(f"  Saved to {variant_dir}")

    # Also create flat versions (completely uniform color)
    flat_dir = base_dir / 'white-flat'
    flat_dir.mkdir(parents=True, exist_ok=True)
    print(f"\nGenerating flat white variant...")

    for material in materials:
        input_path = original_dir / f'{material}.png'
        if not input_path.exists():
            continue

        try:
            with Image.open(input_path) as img:
                flat = create_flat_silhouette(img, (255, 255, 255))
                output_path = flat_dir / f'{material}.png'
                flat.save(output_path, 'PNG')
        except Exception as e:
            print(f"  Error processing {material}: {e}")

    print(f"  Saved to {flat_dir}")

    print("\nDone!")
    print("\nOriginal icons are in: public/images/materials/original/")
    print("Processed icons are in: public/images/materials/{variant}/")
    print("\nYou can edit the originals in Photoshop and re-run this script,")
    print("or use the generated silhouettes directly.")


if __name__ == '__main__':
    main()
