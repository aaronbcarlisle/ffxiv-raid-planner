/**
 * PageContainer - Consistent container widths for different page types
 *
 * 4-Tier Container System (rail-derived):
 * - data:     2160px - Data-dense spine pages (Roster, Loot) on ultrawide
 * - standard: 1760px - Home, Schedule (dashboards)
 * - focus:    1100px - Player Hub, settings, forms
 * - doc:       960px - Docs / reading
 *
 * Width ceilings cap the content column; the context rail lives outside them.
 * Widths come from --container-{tier} tokens in tokens.generated.css.
 *
 * @example
 * <PageContainer variant="data">
 *   <PlayerGrid />
 * </PageContainer>
 */

import type { ReactNode } from 'react';

export type ContainerVariant = 'data' | 'standard' | 'focus' | 'doc';

interface PageContainerProps {
  /** Container width variant */
  variant?: ContainerVariant | 'wide' | 'narrow' | 'compact';
  /** Additional className */
  className?: string;
  /** Content */
  children: ReactNode;
}

// deprecated alias: maps old tier names to new rail-derived names
const DEPRECATED_ALIASES: Record<string, ContainerVariant> = {
  wide: 'standard',
  narrow: 'focus',
  compact: 'doc',
};

const CONTAINER_CLASSES: Record<ContainerVariant, string> = {
  data: 'max-w-data',       // 2160px — data-dense spine pages (Roster, Loot)
  standard: 'max-w-standard', // 1760px — dashboards (Home, Schedule)
  focus: 'max-w-focus',     // 1100px — Player Hub, settings, forms
  doc: 'max-w-doc',         // 960px  — docs / reading
};

export function PageContainer({
  variant = 'standard',
  className = '',
  children,
}: PageContainerProps) {
  // Resolve deprecated aliases before lookup
  const resolved: ContainerVariant =
    DEPRECATED_ALIASES[variant as string] ?? (variant as ContainerVariant);
  return (
    <div className={`mx-auto ${CONTAINER_CLASSES[resolved]} ${className}`}>
      {children}
    </div>
  );
}
