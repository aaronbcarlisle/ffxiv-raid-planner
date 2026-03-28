/** Shared method display metadata for loot log views */

interface MethodInfo {
  label: string;
  textClass: string;
  badgeClass: string;
}

export const METHOD_INFO: Record<string, MethodInfo> = {
  drop: { label: 'Drop', textClass: 'text-status-success', badgeClass: 'bg-status-success/15 text-status-success' },
  purchase: { label: 'Purchase', textClass: 'text-status-warning', badgeClass: 'bg-status-warning/15 text-status-warning' },
  book: { label: 'Book', textClass: 'text-accent', badgeClass: 'bg-accent/15 text-accent' },
  tome: { label: 'Tome', textClass: 'text-blue-400', badgeClass: 'bg-blue-400/15 text-blue-400' },
};
