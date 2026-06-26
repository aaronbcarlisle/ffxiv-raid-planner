import { XIV_ICONS, type XivIconKey } from '../../utils/xivIcons';

interface XivIconProps {
  name: XivIconKey;
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Renders a bundled FFXIV game icon.
 * All icons live in public/icons/ — see src/utils/xivIcons.ts for the map
 * and scripts/fetch-concept-icons.py to add new ones.
 */
export function XivIcon({ name, size = 16, className = '', alt = '' }: XivIconProps) {
  return (
    <img
      src={XIV_ICONS[name]}
      alt={alt}
      width={size}
      height={size}
      className={`inline-block flex-shrink-0 object-contain ${className}`}
      draggable={false}
    />
  );
}
