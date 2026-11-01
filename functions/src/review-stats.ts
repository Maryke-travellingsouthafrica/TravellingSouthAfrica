// Rating maths for a listing's approved reviews. Mirrors computeRatingStats() in
// src/lib/reviews.ts, which this package can't import; scripts/test-reviews.ts
// checks the two agree.
export const computeRatingStats = (ratings: unknown[]) => {
  const valid = ratings.filter((r): r is number => Number.isInteger(r) && (r as number) >= 1 && (r as number) <= 5);
  const ratingBreakdown: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const rating of valid) ratingBreakdown[rating]++;

  const total = valid.reduce((sum, rating) => sum + rating, 0);
  return {
    ratingAverage: valid.length ? Math.round((total / valid.length) * 10) / 10 : 0,
    ratingCount: valid.length,
    ratingBreakdown,
  };
};

// Whether a listing doc already holds these stats, so a recalculation can skip the write.
export const ratingStatsMatch = (
  listing: Record<string, unknown>,
  stats: ReturnType<typeof computeRatingStats>
) => {
  if (stats.ratingCount === 0) {
    return listing.ratingAverage === undefined && listing.ratingCount === undefined && listing.ratingBreakdown === undefined;
  }
  return (
    listing.ratingAverage === stats.ratingAverage &&
    listing.ratingCount === stats.ratingCount &&
    JSON.stringify(sortedBreakdown(listing.ratingBreakdown)) === JSON.stringify(stats.ratingBreakdown)
  );
};

// Firestore doesn't keep map key order, so compare in star order.
const sortedBreakdown = (breakdown: unknown) => {
  const counts = (breakdown ?? {}) as Record<string, number>;
  return { "1": counts["1"], "2": counts["2"], "3": counts["3"], "4": counts["4"], "5": counts["5"] };
};

// Review text is written by the public, so it must be escaped before going in an email.
export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
