/**
 * Shared helpers for the events feature.
 *
 * Event docs carry `startDate` and `endDate` Firestore Timestamps (endDate ===
 * the same day as startDate for single-day events). Legacy docs written before
 * that change only have a single `eventDate` field, so every read here falls
 * back to it — a legacy doc still renders correctly on a detail page and in the
 * admin list until it is backfilled.
 */

/**
 * A Firestore Timestamp in any of the shapes it reaches the UI in: the client
 * SDK class, the `{ seconds, nanoseconds }` plain object left behind by the
 * JSON round-trip that server components do before passing data to the client,
 * or the `_seconds` form the Admin SDK serialises to.
 */
export type TimestampLike =
  | { toDate: () => Date }
  | { seconds: number }
  | { _seconds: number }
  | Date
  | string
  | null
  | undefined;

/** The date fields any event-shaped object may carry, current or legacy. */
export interface EventDateFields {
  startDate?: TimestampLike;
  endDate?: TimestampLike;
  /** @deprecated Legacy single-date field, kept only for un-backfilled docs. */
  eventDate?: TimestampLike;
}

/** Mirrors the slugify() used by the sights pages — titles become URL slugs. */
export function slugifyEventTitle(title: string) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Normalises any Timestamp-like value to a Date, or null when unusable. */
export function toDate(value: TimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof (value as any).toDate === 'function') return (value as any).toDate();
  const seconds = (value as any).seconds ?? (value as any)._seconds;
  if (typeof seconds === 'number') return new Date(seconds * 1000);
  return null;
}

/** The event's start, falling back to the legacy single date field. */
export function getEventStart(event: EventDateFields): Date | null {
  return toDate(event.startDate) ?? toDate(event.eventDate);
}

/** The event's end, falling back to the start (single-day event or legacy doc). */
export function getEventEnd(event: EventDateFields): Date | null {
  return toDate(event.endDate) ?? getEventStart(event);
}

/** Midnight at the start of the given day, local time. */
export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The last millisecond of the given day, local time. End dates are stored this
 * way so an event stays listed for the whole of its final day — the public
 * query compares endDate against the current instant, not against midnight.
 */
export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

const fullDate = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
const dayAndMonth = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long' });
const monthAndYear = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' });

/**
 * Formats an event's dates as a single date or a range, collapsing the parts
 * the two dates share:
 *   single day      -> "12 September 2026"
 *   same month      -> "12–27 September 2026"
 *   same year       -> "28 September – 3 October 2026"
 *   spanning a year -> "30 December 2026 – 2 January 2027"
 * Returns null when the event has no usable dates at all.
 */
export function formatEventDateRange(event: EventDateFields): string | null {
  const start = getEventStart(event);
  if (!start) return null;

  const end = getEventEnd(event) ?? start;
  if (end < start || isSameDay(start, end)) return fullDate.format(start);

  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${monthAndYear.format(end)}`;
    }
    return `${dayAndMonth.format(start)} – ${fullDate.format(end)}`;
  }

  return `${fullDate.format(start)} – ${fullDate.format(end)}`;
}

/** True when the event runs over more than one calendar day. */
export function isMultiDayEvent(event: EventDateFields) {
  const start = getEventStart(event);
  const end = getEventEnd(event);
  return !!(start && end && !isSameDay(start, end));
}
