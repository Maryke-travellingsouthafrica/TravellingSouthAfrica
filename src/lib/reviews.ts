/**
 * Shared types, limits and helpers for listing reviews.
 *
 * A review lives in the top-level `reviews` collection under the ID
 * `${listingId}_${userId}`, so a user has at most one per listing. The listing
 * doc carries `ratingAverage`, `ratingCount` and `ratingBreakdown`, counting
 * approved reviews only and written only by the Cloud Function. Missing values
 * mean "no reviews yet".
 *
 * The limits here are repeated in firestore.rules, and the stats maths in
 * functions/src/review-stats.ts (the functions package can't import from src).
 */

import { getListingPath } from '@/lib/listing-links';
import { getSaDateString, SA_TIME_ZONE, slugifyEventTitle, toDate, type TimestampLike } from '@/lib/events';

export type ReviewListingType = 'accommodation' | 'service_provider' | 'restaurant' | 'attraction';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export const REVIEW_LISTING_TYPE_LABELS: Record<ReviewListingType, string> = {
  accommodation: 'Accommodation',
  service_provider: 'Service provider',
  restaurant: 'Restaurant',
  attraction: 'Attraction',
};

export const REVIEW_LIMITS = {
  titleMin: 3,
  titleMax: 80,
  bodyMin: 20,
  bodyMax: 2000,
} as const;

export const REVIEWS_PAGE_SIZE = 5;

/** The part of a review its author writes. `visitDate` is a yyyy-MM month. */
export interface ReviewContent {
  rating: number;
  title: string;
  body: string;
  visitDate?: string;
}

export interface Review extends ReviewContent {
  id: string;
  listingId: string;
  listingType: ReviewListingType;
  listingTitle: string;
  userId: string;
  userName: string;
  status: ReviewStatus;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  moderatedAt?: TimestampLike;
  moderatedBy?: string;
}

/** What a listing doc needs for its rating to be shown. */
export interface ListingRatingFields {
  ratingAverage?: number;
  ratingCount?: number;
  ratingBreakdown?: Partial<Record<string, number>>;
}

export interface ReviewPage {
  reviews: Review[];
  hasMore: boolean;
}

export function getReviewId(listingId: string, userId: string) {
  return `${listingId}_${userId}`;
}

/** Characters as Firestore rules count them, so an emoji doesn't count twice. */
function charCount(text: string) {
  return Array.from(text).length;
}

export function countReviewChars(text: string) {
  return charCount(text.trim());
}

export type ReviewErrors = Partial<Record<keyof ReviewContent, string>>;

/** Checks a review before saving; an empty result means it is valid. */
export function validateReview(content: ReviewContent, now: Date = new Date()): ReviewErrors {
  const errors: ReviewErrors = {};
  const titleLength = countReviewChars(content.title);
  const bodyLength = countReviewChars(content.body);

  if (!Number.isInteger(content.rating) || content.rating < 1 || content.rating > 5) {
    errors.rating = 'Please choose a star rating.';
  }
  if (titleLength < REVIEW_LIMITS.titleMin || titleLength > REVIEW_LIMITS.titleMax) {
    errors.title = `Your title must be ${REVIEW_LIMITS.titleMin}–${REVIEW_LIMITS.titleMax} characters.`;
  }
  if (bodyLength < REVIEW_LIMITS.bodyMin || bodyLength > REVIEW_LIMITS.bodyMax) {
    errors.body = `Your review must be ${REVIEW_LIMITS.bodyMin}–${REVIEW_LIMITS.bodyMax} characters.`;
  }
  if (content.visitDate) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(content.visitDate)) {
      errors.visitDate = 'Please enter the month as yyyy-mm.';
    } else if (content.visitDate > getCurrentSaMonth(now)) {
      errors.visitDate = 'Your visit month cannot be in the future.';
    }
  }
  return errors;
}

/** The current month in South Africa, as yyyy-MM. */
export function getCurrentSaMonth(now: Date = new Date()) {
  return getSaDateString(now).slice(0, 7);
}

/** Average to 1 decimal, count and per-star counts; anything but a whole 1–5 is ignored. */
export function computeRatingStats(ratings: number[]) {
  const valid = ratings.filter((r) => Number.isInteger(r) && r >= 1 && r <= 5);
  const ratingBreakdown: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const rating of valid) ratingBreakdown[rating]++;

  const total = valid.reduce((sum, rating) => sum + rating, 0);
  return {
    ratingAverage: valid.length ? Math.round((total / valid.length) * 10) / 10 : 0,
    ratingCount: valid.length,
    ratingBreakdown,
  };
}

/** The listing's rating, or null when there is nothing to show. */
export function getListingRating(listing: ListingRatingFields | null | undefined) {
  const count = listing?.ratingCount;
  const average = listing?.ratingAverage;
  if (typeof count !== 'number' || count <= 0 || typeof average !== 'number') return null;
  return { average, count };
}

/** Rows for the 5→1 breakdown bars. */
export function getRatingBreakdownRows(listing: ListingRatingFields) {
  const count = listing.ratingCount ?? 0;
  return [5, 4, 3, 2, 1].map((stars) => {
    const starCount = listing.ratingBreakdown?.[stars] ?? 0;
    return { stars, count: starCount, percent: count > 0 ? Math.round((starCount / count) * 100) : 0 };
  });
}

/** "4.6", always to 1 decimal. */
export function formatRatingValue(average: number) {
  return average.toFixed(1);
}

/** "Based on 12 reviews". */
export function formatRatingBasis(count: number) {
  return `Based on ${count} ${count === 1 ? 'review' : 'reviews'}`;
}

/**
 * "Thandi Mokoena" -> "Thandi M.". This is what gets stored, because approved
 * reviews are public documents: a full name or an email must never be saved.
 */
export function formatReviewerName(displayName: string | null | undefined) {
  const name = (displayName ?? '').trim();
  if (!name || name.includes('@')) return 'Traveller';

  const parts = name.split(/\s+/);
  const lastInitial = parts.length > 1 ? ` ${Array.from(parts[parts.length - 1])[0].toUpperCase()}.` : '';
  return `${parts[0]}${lastInitial}`.slice(0, 60);
}

const reviewDate = new Intl.DateTimeFormat('en-ZA', { timeZone: SA_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' });
// A visit month is a label rather than an instant, so it is read back in UTC to stay on the same month.
const visitMonth = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' });

/** "12 March 2026" in South African time, or null when there is no date yet. */
export function formatReviewDate(value: TimestampLike) {
  const date = toDate(value);
  return date ? reviewDate.format(date) : null;
}

/** "2026-03" -> "Mar 2026". */
export function formatVisitMonth(visitDate: string) {
  const [year, month] = visitDate.split('-').map(Number);
  return visitMonth.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** The listing's public page for the admin view; restaurants don't have one. */
export function getReviewListingHref(review: Pick<Review, 'listingId' | 'listingType' | 'listingTitle'>) {
  const listing = { id: review.listingId, name: review.listingTitle };
  switch (review.listingType) {
    case 'accommodation':
      return getListingPath('accommodation', listing);
    case 'service_provider':
      return getListingPath('service-provider', listing);
    case 'attraction':
      return `/sights/${slugifyEventTitle(review.listingTitle)}`;
    default:
      return null;
  }
}

/** The JSON-LD AggregateRating for a listing, or null without any approved reviews. */
export function buildAggregateRating(listing: ListingRatingFields) {
  const rating = getListingRating(listing);
  if (!rating) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: rating.average,
    reviewCount: rating.count,
    bestRating: 5,
  };
}
