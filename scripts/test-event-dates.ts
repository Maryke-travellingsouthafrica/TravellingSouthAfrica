/**
 * Checks the event date helpers give the same South African answers whatever
 * time zone the code runs in. Stored values below match what the admin form saves.
 *
 * Usage (must pass under each zone; the active zone is printed first):
 *   TZ=UTC npx tsx scripts/test-event-dates.ts
 *   TZ=Africa/Johannesburg npx tsx scripts/test-event-dates.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  endOfSaDay,
  formatEventDateRange,
  getEventEndDayPassed,
  getEventTimeLabel,
  getSaDateString,
  isMultiDayEvent,
  startOfSaDay,
} from '../src/lib/events';

console.log(`Runtime time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

/** The event doc the admin form produces for these yyyy-MM-dd days. */
const saved = (startDay: string, endDay: string = startDay) => ({
  startDate: startOfSaDay(startDay),
  endDate: endOfSaDay(endDay),
});

/** The plain `{ seconds, nanoseconds }` shape server pages pass around after their JSON round-trip. */
const asPlainTimestamp = (date: Date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 });

test('stored instants are fixed South African times', () => {
  assert.equal(startOfSaDay('2026-11-01').toISOString(), '2026-10-31T22:00:00.000Z');
  assert.equal(endOfSaDay('2026-11-01').toISOString(), '2026-11-01T21:59:59.999Z');
});

test('single day', () => {
  assert.equal(formatEventDateRange(saved('2026-11-01')), '1 November 2026');
  assert.equal(isMultiDayEvent(saved('2026-11-01')), false);
});

test('single day on the first of the year', () => {
  assert.equal(formatEventDateRange(saved('2027-01-01')), '1 January 2027');
  assert.equal(isMultiDayEvent(saved('2027-01-01')), false);
});

test('single day after the JSON round-trip server pages do', () => {
  const { startDate, endDate } = saved('2026-11-01');
  const event = { startDate: asPlainTimestamp(startDate), endDate: asPlainTimestamp(endDate) };
  assert.equal(formatEventDateRange(event), '1 November 2026');
  assert.equal(isMultiDayEvent(event), false);
});

test('two consecutive days stay a range', () => {
  assert.equal(formatEventDateRange(saved('2026-11-01', '2026-11-02')), '1–2 November 2026');
  assert.equal(isMultiDayEvent(saved('2026-11-01', '2026-11-02')), true);
});

test('same month', () => {
  assert.equal(formatEventDateRange(saved('2026-09-12', '2026-09-27')), '12–27 September 2026');
});

test('cross month', () => {
  assert.equal(formatEventDateRange(saved('2026-09-28', '2026-10-03')), '28 September – 3 October 2026');
});

test('cross year', () => {
  assert.equal(formatEventDateRange(saved('2026-12-30', '2027-01-02')), '30 December 2026 – 2 January 2027');
});

test('legacy doc with only eventDate', () => {
  const event = { eventDate: startOfSaDay('2026-11-01') };
  assert.equal(formatEventDateRange(event), '1 November 2026');
  assert.equal(isMultiDayEvent(event), false);
});

test('no usable dates', () => {
  assert.equal(formatEventDateRange({}), null);
});

test('admin edit prefill returns the days that were saved', () => {
  const { startDate, endDate } = saved('2026-11-01', '2026-11-03');
  assert.equal(getSaDateString(startDate), '2026-11-01');
  assert.equal(getSaDateString(endDate), '2026-11-03');
});

test('an event stays live for the whole of its final South African day', () => {
  const event = saved('2026-11-01');
  const lastMinute = new Date('2026-11-01T23:59:00+02:00');
  const nextDay = new Date('2026-11-02T00:00:00+02:00');

  // The public query keeps a doc while endDate >= now.
  assert.ok(event.endDate >= lastMinute);
  assert.ok(event.endDate < nextDay);
  assert.equal(getEventEndDayPassed(event, lastMinute), false);
  assert.equal(getEventEndDayPassed(event, nextDay), true);
});

test('date-only events report no start time', () => {
  assert.equal(getEventTimeLabel(saved('2026-11-01')), null);
});
