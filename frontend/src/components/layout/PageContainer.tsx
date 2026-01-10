/**
 * PageContainer - Consistent container widths for different page types
 *
 * 5-Tier Container System:
 * - data:    2560px - Data-dense, grid content (GroupView, data tables)
 * - wide:    1920px - Documentation with sidebar (API Docs, Guides)
 * - focus:   1280px - Focused content, simple docs (ReleaseNotes)
 * - narrow:  1152px - Card grids, dashboards (Dashboard)
 * - compact:  896px - Marketing, landing pages (Home)
 *
 * @example
 * <PageContainer variant="data">
 *   <PlayerGrid />
 * </PageContainer>
 */

import type { ReactNode } from 'react';

export type ContainerVariant = 'data' | 'wide' | 'focus' | 'narrow' | 'compact';

interface PageContainerProps {
  /** Container width variant */
  variant?: ContainerVariant;
  /** Additional className */
  className?: string;
  /** Content */
  children: ReactNode;
}

const CONTAINER_CLASSES: Record<ContainerVariant, string> = {
  data: 'max-w-[160rem]',    // 2560px - GroupView, data grids
  wide: 'max-w-[120rem]',    // 1920px - Docs with sidebar
  focus: 'max-w-[80rem]',    // 1280px - Simple docs
  narrow: 'max-w-6xl',       // 1152px - Dashboard
  compact: 'max-w-4xl',      // 896px - Home page
};

export function PageContainer({
  variant = 'wide',
  className = '',
  children,
}: PageContainerProps) {
  return (
    <div className={`mx-auto ${CONTAINER_CLASSES[variant]} ${className}`}>
      {children}
    </div>
  );
}
