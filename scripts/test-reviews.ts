/**
 * Checks the review maths and validation helpers, and that the Cloud Function's
 * copy of the stats maths agrees with the app's.
 *
 * Usage:
 *   npx tsx scripts/test-reviews.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAggregateRating,
  computeRatingStats,
  formatRatingBasis,
  formatRatingValue,
  formatReviewDate,
  formatReviewerName,
  formatVisitMonth,
  getListingRating,
  getRatingBreakdownRows,
  getReviewId,
  getReviewListingHref,
  validateReview,
} from '../src/lib/reviews';
import {
  computeRatingStats as functionStats,
  escapeHtml,
  ratingStatsMatch,
} from '../functions/src/review-stats';

const validReview = { rating: 4, title: 'Lovely stay', body: 'A really lovely place to stay for a weekend.' };

test('stats: empty', () => {
  assert.deepEqual(computeRatingStats([]), {
    ratingAverage: 0,
    ratingCount: 0,
    ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  });
});

test('stats: average rounds to 1 decimal', () => {
  assert.equal(computeRatingStats([5, 5, 4]).ratingAverage, 4.7);
  assert.equal(computeRatingStats([5, 4]).ratingAverage, 4.5);
  assert.equal(computeRatingStats([1, 1, 2]).ratingAverage, 1.3);
  assert.equal(computeRatingStats([3]).ratingAverage, 3);
});

test('stats: breakdown counts each star', () => {
  assert.deepEqual(computeRatingStats([5, 5, 4, 1]).ratingBreakdown, { '1': 1, '2': 0, '3': 0, '4': 1, '5': 2 });
});

test('stats: invalid ratings are ignored', () => {
  const stats = computeRatingStats([5, 0, 6, 3.5, NaN]);
  assert.equal(stats.ratingCount, 1);
  assert.equal(stats.ratingAverage, 5);
});

test('stats: the Cloud Function agrees with the app', () => {
  for (const ratings of [[], [5], [5, 5, 4], [1, 2, 3, 4, 5], [1, 1, 2], [4, 4, 4, 5, 3, 2, 5], [5, 0, 6, 3.5]]) {
    assert.deepEqual(functionStats(ratings), computeRatingStats(ratings), `ratings: ${ratings}`);
  }
});

test('function: ignores non-numeric ratings', () => {
  assert.equal(functionStats(['5', null, undefined, 4]).ratingCount, 1);
});

test('function: spots when a listing already holds the stats', () => {
  const stats = functionStats([5, 4]);
  assert.equal(ratingStatsMatch({ ...stats }, stats), true);
  // Firestore returns map keys in its own order.
  const reordered = { '5': 1, '4': 1, '3': 0, '2': 0, '1': 0 };
  assert.equal(ratingStatsMatch({ ...stats, ratingBreakdown: reordered }, stats), true);
  assert.equal(ratingStatsMatch({ ...stats, ratingCount: 3 }, stats), false);
  assert.equal(ratingStatsMatch({}, stats), false);
});

test('function: no reviews means no rating fields', () => {
  const none = functionStats([]);
  assert.equal(ratingStatsMatch({ name: 'A listing' }, none), true);
  assert.equal(ratingStatsMatch({ ratingCount: 2, ratingAverage: 4 }, none), false);
});

test('function: escapes review text for the admin email', () => {
  assert.equal(escapeHtml('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
  assert.equal(escapeHtml(undefined), '');
});

test('validate: a good review has no errors', () => {
  assert.deepEqual(validateReview(validReview), {});
  assert.deepEqual(validateReview({ ...validReview, visitDate: '2026-03' }, new Date('2026-11-01T12:00:00Z')), {});
});

test('validate: rating must be a whole 1–5', () => {
  for (const rating of [0, 6, 3.5, NaN]) {
    assert.ok(validateReview({ ...validReview, rating }).rating, `rating: ${rating}`);
  }
  for (const rating of [1, 2, 3, 4, 5]) {
    assert.equal(validateReview({ ...validReview, rating }).rating, undefined);
  }
});

test('validate: title limits', () => {
  assert.ok(validateReview({ ...validReview, title: 'ab' }).title);
  assert.equal(validateReview({ ...validReview, title: 'abc' }).title, undefined);
  assert.equal(validateReview({ ...validReview, title: 'a'.repeat(80) }).title, undefined);
  assert.ok(validateReview({ ...validReview, title: 'a'.repeat(81) }).title);
});

test('validate: body limits', () => {
  assert.ok(validateReview({ ...validReview, body: 'a'.repeat(19) }).body);
  assert.equal(validateReview({ ...validReview, body: 'a'.repeat(20) }).body, undefined);
  assert.equal(validateReview({ ...validReview, body: 'a'.repeat(2000) }).body, undefined);
  assert.ok(validateReview({ ...validReview, body: 'a'.repeat(2001) }).body);
});

test('validate: surrounding spaces do not count', () => {
  assert.ok(validateReview({ ...validReview, title: '  a  ' }).title);
  assert.ok(validateReview({ ...validReview, body: ' '.repeat(50) }).body);
});

test('validate: an emoji counts once, as the rules count it', () => {
  assert.ok(validateReview({ ...validReview, title: '😀😀' }).title);
  assert.equal(validateReview({ ...validReview, title: '😀😀😀' }).title, undefined);
});

test('validate: visit month', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  assert.ok(validateReview({ ...validReview, visitDate: '2026-13' }, now).visitDate);
  assert.ok(validateReview({ ...validReview, visitDate: 'March' }, now).visitDate);
  assert.ok(validateReview({ ...validReview, visitDate: '2026-12' }, now).visitDate);
  assert.equal(validateReview({ ...validReview, visitDate: '2026-11' }, now).visitDate, undefined);
});

test('validate: the current month is judged in South African time', () => {
  // 23:00 UTC on 31 October is already 1 November in South Africa.
  const now = new Date('2026-10-31T23:00:00Z');
  assert.equal(validateReview({ ...validReview, visitDate: '2026-11' }, now).visitDate, undefined);
});

test('listing rating: missing values mean no reviews', () => {
  assert.equal(getListingRating({}), null);
  assert.equal(getListingRating(null), null);
  assert.equal(getListingRating({ ratingCount: 0, ratingAverage: 0 }), null);
  assert.deepEqual(getListingRating({ ratingCount: 12, ratingAverage: 4.6 }), { average: 4.6, count: 12 });
});

test('breakdown rows run 5 to 1 with percentages', () => {
  const rows = getRatingBreakdownRows({
    ratingCount: 4,
    ratingBreakdown: { '5': 2, '4': 1, '3': 0, '2': 0, '1': 1 },
  });
  assert.deepEqual(rows.map((r) => r.stars), [5, 4, 3, 2, 1]);
  assert.deepEqual(rows.map((r) => r.percent), [50, 25, 0, 0, 25]);
  assert.deepEqual(rows.map((r) => r.count), [2, 1, 0, 0, 1]);
  assert.ok(getRatingBreakdownRows({}).every((r) => r.percent === 0));
});

test('formatting', () => {
  assert.equal(formatRatingValue(4.6), '4.6');
  assert.equal(formatRatingValue(4), '4.0');
  assert.equal(formatRatingBasis(1), 'Based on 1 review');
  assert.equal(formatRatingBasis(12), 'Based on 12 reviews');
  assert.equal(formatVisitMonth('2026-03'), 'Mar 2026');
  assert.equal(formatVisitMonth('2026-01'), 'Jan 2026');
  assert.equal(getReviewId('abc', 'uid1'), 'abc_uid1');
});

test('review dates use South African time', () => {
  // 23:00 UTC on 31 October is already 1 November in South Africa.
  assert.equal(formatReviewDate(new Date('2026-10-31T23:00:00Z')), '1 November 2026');
  assert.equal(formatReviewDate({ seconds: Date.UTC(2026, 9, 31, 23) / 1000 }), '1 November 2026');
  assert.equal(formatReviewDate(undefined), null);
});

test('reviewer names never expose a surname or an email', () => {
  assert.equal(formatReviewerName('Thandi Mokoena'), 'Thandi M.');
  assert.equal(formatReviewerName('  Thandi   van der Merwe '), 'Thandi M.');
  assert.equal(formatReviewerName('Thandi'), 'Thandi');
  assert.equal(formatReviewerName('thandi@example.com'), 'Traveller');
  assert.equal(formatReviewerName(''), 'Traveller');
  assert.equal(formatReviewerName(null), 'Traveller');
});

test('admin links go to each listing type\'s public page', () => {
  const review = { listingId: 'abc123', listingTitle: 'Casa Del Sol' };
  assert.equal(getReviewListingHref({ ...review, listingType: 'accommodation' }), '/accommodations/casa-del-sol-abc123');
  assert.equal(getReviewListingHref({ ...review, listingType: 'service_provider' }), '/service-providers/casa-del-sol-abc123');
  assert.equal(getReviewListingHref({ ...review, listingType: 'attraction' }), '/sights/casa-del-sol');
  assert.equal(getReviewListingHref({ ...review, listingType: 'restaurant' }), null);
});

test('AggregateRating only appears with approved reviews', () => {
  assert.equal(buildAggregateRating({}), null);
  assert.equal(buildAggregateRating({ ratingCount: 0, ratingAverage: 0 }), null);
  assert.deepEqual(buildAggregateRating({ ratingCount: 12, ratingAverage: 4.6 }), {
    '@type': 'AggregateRating',
    ratingValue: 4.6,
    reviewCount: 12,
    bestRating: 5,
  });
});
