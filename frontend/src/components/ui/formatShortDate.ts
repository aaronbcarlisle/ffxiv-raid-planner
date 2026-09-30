/**
 * Short session date, "Mon Sep 28", in a timezone (R-P0-12). Shared by
 * SessionRsvpCard's "Played · Mon Sep 28" chip and SessionList's
 * "next Fri Oct 2" scope note, so both read the same.
 *
 * en-US `format` inserts a comma ("Mon, Sep 28"), so the parts are joined by
 * hand. An invalid timezone falls back to the runtime's zone; an unparseable
 * instant yields null.
 */
const SHORT_DATE_OPTS: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

export function formatShortDate(instant: string | Date, timeZone?: string): string | null {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { ...SHORT_DATE_OPTS, timeZone }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', SHORT_DATE_OPTS).formatToParts(date);
  }
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('month')} ${part('day')}`;
}
