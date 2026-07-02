const formatterCache = new Map<string, Intl.DateTimeFormat>();

interface TimeZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cacheKey = `${timeZone}::parts`;
  const existing = formatterCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

function getTimeZoneParts(date: Date, timeZone: string): TimeZoneParts {
  const values = getFormatter(timeZone).formatToParts(date);
  const lookup = Object.fromEntries(
    values
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour,
    minute: lookup.minute,
    second: lookup.second,
  };
}

function parseDatetimeLocalValue(value: string): TimeZoneParts {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second: 0,
  };
}

function formatDatetimeLocalParts(parts: TimeZoneParts): string {
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-') + `T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatInTimeZone(
  isoString: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US'
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(isoString));
}

export function toZonedDatetimeLocalValue(isoString: string, timeZone: string): string {
  return formatDatetimeLocalParts(getTimeZoneParts(new Date(isoString), timeZone));
}

export function fromZonedDatetimeLocalValue(value: string, timeZone: string): string {
  const target = parseDatetimeLocalValue(value);
  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second
  );

  const firstGuess = new Date(targetAsUtc);
  const firstGuessParts = getTimeZoneParts(firstGuess, timeZone);
  const firstGuessAsUtc = Date.UTC(
    firstGuessParts.year,
    firstGuessParts.month - 1,
    firstGuessParts.day,
    firstGuessParts.hour,
    firstGuessParts.minute,
    firstGuessParts.second
  );

  const corrected = new Date(firstGuess.getTime() + (targetAsUtc - firstGuessAsUtc));
  const correctedParts = getTimeZoneParts(corrected, timeZone);
  const correctedAsUtc = Date.UTC(
    correctedParts.year,
    correctedParts.month - 1,
    correctedParts.day,
    correctedParts.hour,
    correctedParts.minute,
    correctedParts.second
  );

  const finalDate = new Date(corrected.getTime() + (targetAsUtc - correctedAsUtc));
  return finalDate.toISOString();
}

export function addDurationInTimeZone(value: string, durationMs: number, timeZone: string): string {
  const utcStart = fromZonedDatetimeLocalValue(value, timeZone);
  const endDate = new Date(new Date(utcStart).getTime() + durationMs);
  return toZonedDatetimeLocalValue(endDate.toISOString(), timeZone);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Advance an ISO datetime by 7-day increments until it falls in the future.
 *
 * Used when creating a session from an availability recommendation — the
 * recommendation's `startIso` may be a past date (the week the availability
 * data was entered), so we project it forward to the next upcoming occurrence
 * of the same weekday and time.
 *
 * If the input is already in the future it is returned unchanged.
 */
export function resolveNearestUpcomingDatetime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  while (date.getTime() <= now) {
    date.setTime(date.getTime() + WEEK_MS);
  }
  return date.toISOString();
}

