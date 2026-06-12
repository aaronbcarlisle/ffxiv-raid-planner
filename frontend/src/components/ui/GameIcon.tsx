import type { SVGProps } from 'react';

type GameIconName =
  | 'rally-the-troops'
  | 'scroll-quill'
  | 'treasure-map'
  | 'rule-book'
  | 'quill-ink'
  | 'crossed-swords'
  | 'trophy'
  | 'flag'
  | 'shield-person'
  | 'checklist'
  | 'chest'
  | 'spyglass';

type GameIconSize = 'sm' | 'md' | 'lg' | 'xl';

interface GameIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: GameIconName;
  size?: GameIconSize;
}

const SIZE_MAP: Record<GameIconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

const ICON_PATHS: Record<GameIconName, string> = {
  'rally-the-troops':
    'M256 32l-48 80h-64l-32 48 48 32-16 64 64-16 48 48 48-48 64 16-16-64 48-32-32-48h-64zm-128 192l-48 32v160l176 80 176-80V256l-48-32-64 48v96l-64 32-64-32v-96z',
  'scroll-quill':
    'M352 48c-18 0-34 8-45 20L128 248v168h168L476 237c12-11 20-27 20-45 0-35-29-64-64-64-18 0-34 8-45 20l-3 3-3-3c-11-12-27-20-45-20h16zM96 240H64c-18 0-32 14-32 32v160c0 18 14 32 32 32h288c18 0 32-14 32-32v-32H160c-18 0-32-14-32-32V272c0-11-5-21-14-27z',
  'treasure-map':
    'M128 64L64 96v352l128-64 128 64 128-64 64 32V64l-64 32-128-64-128 64zm128 32l80 40v240l-80-40-80 40V136zm-144 16l48-24v240l-48 24zm288 0v240l-48 24V136z',
  'rule-book':
    'M128 48c-26 0-48 22-48 48v320c0 26 22 48 48 48h304V48zm32 48h208v48H160zm0 96h208v32H160zm0 80h144v32H160zm224 144H128c-9 0-16-7-16-16s7-16 16-16h256z',
  'quill-ink':
    'M400 48L192 320l-32 128 128-32L496 208c16-16 16-42 0-58l-38-38L496 48h-96zm-240 304c-18 0-32 14-32 32v32h32c18 0 32-14 32-32s-14-32-32-32zM80 416c-18 0-32 14-32 32v16h384v-48z',
  'crossed-swords':
    'M400 48l-96 96-48-48-32 32 48 48-128 128-48-48-32 32 48 48-64 64 64 64 64-64 48 48 32-32-48-48 128-128 48 48 32-32-48-48 96-96zm-288 304l-48 48 96 96 48-48z',
  trophy:
    'M160 48v32H64c0 80 48 144 112 168 16 44 52 76 96 84v68h-80v48h192v-48h-80v-68c44-8 80-40 96-84 64-24 112-88 112-168h-96V48zm-64 80h32v80c-32-16-32-56-32-80zm320 0v80c0 24 0 64-32 80V128z',
  flag:
    'M128 48v416h48V304l256-128L176 48zm48 48l160 80-160 80z',
  'shield-person':
    'M256 48L96 128v128c0 106 68 204 160 240 92-36 160-134 160-240V128zm0 64c26 0 48 22 48 48s-22 48-48 48-48-22-48-48 22-48 48-48zm0 128c53 0 96 28 96 64v16H160v-16c0-36 43-64 96-64z',
  checklist:
    'M128 64c-18 0-32 14-32 32v320c0 18 14 32 32 32h256c18 0 32-14 32-32V96c0-18-14-32-32-32zm48 64h160v32H176zm-32 8l24 24-24 24-24-24zm32 72h160v32H176zm-32 8l24 24-24 24-24-24zm32 72h160v32H176zm-32 8l24 24-24 24-24-24z',
  chest:
    'M96 128c-18 0-32 14-32 32v48h384v-48c0-18-14-32-32-32zm-32 128v128c0 18 14 32 32 32h320c18 0 32-14 32-32V256H288v32h-64v-32zm192 0h48v32h-48z',
  spyglass:
    'M416 80l-48 16-160 160-48-48c-12-12-32-12-44 0l-8 8c-12 12-12 32 0 44l8 8-64 64c-12 12-12 32 0 44l32 32c12 12 32 12 44 0l64-64 8 8c12 12 32 12 44 0l8-8c12-12 12-32 0-44l-48-48 160-160 16-48z',
};

export function GameIcon({ name, size = 'md', className = '', ...props }: GameIconProps) {
  const px = SIZE_MAP[size];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={px}
      height={px}
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export { type GameIconName, type GameIconSize };
