/**
 * overviewFormat — one shared time formatter for the Hub's overview surfaces
 * (R-PH2-M). Both `NeedsYouCard` and `YourStaticsCard` call this instead of
 * each building their own `Intl.DateTimeFormat`.
 */

export function formatSessionStart(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
