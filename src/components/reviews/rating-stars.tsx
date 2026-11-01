import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRatingValue, getListingRating, type ListingRatingFields } from '@/lib/reviews';

/** Five stars filled to `value`, including part-filled ones for an average. */
export function RatingStars({ value, className }: { value: number; className?: string }) {
  return (
    <span role="img" aria-label={`${formatRatingValue(value)} out of 5 stars`} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={cn('relative inline-block h-4 w-4', className)}>
          <Star className="absolute inset-0 h-full w-full text-muted-foreground/40" />
          <Star
            className="absolute inset-0 h-full w-full fill-yellow-400 text-yellow-400"
            style={{ clipPath: `inset(0 ${100 - Math.min(Math.max(value - star + 1, 0), 1) * 100}% 0 0)` }}
          />
        </span>
      ))}
    </span>
  );
}

/** The compact "★ 4.6 (12)" shown on listing cards. Renders nothing without approved reviews. */
export function RatingBadge({ listing, className }: { listing: ListingRatingFields | null | undefined; className?: string }) {
  const rating = getListingRating(listing);
  if (!rating) return null;

  return (
    <span
      role="img"
      aria-label={`Rated ${formatRatingValue(rating.average)} out of 5 from ${rating.count} ${rating.count === 1 ? 'review' : 'reviews'}`}
      className={cn('inline-flex items-center gap-1 text-sm font-medium', className)}
    >
      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      {formatRatingValue(rating.average)}
      <span className="font-normal opacity-80">({rating.count})</span>
    </span>
  );
}
