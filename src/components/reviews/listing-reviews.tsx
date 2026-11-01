'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Edit2, Loader2, MessageSquarePlus, Trash2 } from 'lucide-react';
import { useUser } from '@/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Translatable } from '@/components/translatable';
import { RatingStars } from '@/components/reviews/rating-stars';
import { ReviewForm } from '@/components/reviews/review-form';
import { useToast } from '@/hooks/use-toast';
import {
  formatRatingBasis,
  formatRatingValue,
  formatReviewDate,
  formatVisitMonth,
  getListingRating,
  getRatingBreakdownRows,
  type ListingRatingFields,
  type Review,
  type ReviewContent,
  type ReviewListingType,
  type ReviewPage,
  type ReviewStatus,
} from '@/lib/reviews';
import { createReview, deleteReview, getApprovedReviews, getUserReview, updateReview } from '@/services/reviewsService';

export type ReviewableListing = ListingRatingFields & {
  id: string;
  name: string;
  submittedBy?: string;
  ownerUid?: string;
};

const STATUS_BADGES: Record<ReviewStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100' },
};

const THANKS_MESSAGE = "Thanks! Your review will appear once it's approved.";

function RatingSummary({ listing }: { listing: ReviewableListing }) {
  const rating = getListingRating(listing);
  if (!rating) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="space-y-1">
        <p className="text-4xl font-bold leading-none">{formatRatingValue(rating.average)}</p>
        <RatingStars value={rating.average} />
        <p className="text-sm font-medium">
          <Translatable text={`${formatRatingValue(rating.average)} out of 5`} />
        </p>
        <p className="text-sm text-muted-foreground">
          <Translatable text={formatRatingBasis(rating.count)} />
        </p>
      </div>
      <ul className="space-y-1.5">
        {getRatingBreakdownRows(listing).map((row) => (
          <li key={row.stars} className="grid grid-cols-[3.5rem_1fr_2rem] items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              <Translatable text={row.stars === 1 ? '1 star' : `${row.stars} stars`} />
            </span>
            <Progress
              value={row.percent}
              aria-label={`${row.stars} stars: ${row.count}`}
              className="h-2 [&>div]:bg-yellow-400"
            />
            <span className="text-right text-muted-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewBody({ review }: { review: Review }) {
  return (
    <>
      <RatingStars value={review.rating} />
      <h3 className="font-semibold break-words">{review.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words">{review.body}</p>
    </>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const written = formatReviewDate(review.createdAt);
  const meta = [review.userName, review.visitDate && `Visited ${formatVisitMonth(review.visitDate)}`, written]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="space-y-1.5 border-t pt-5 first:border-t-0 first:pt-0">
      <ReviewBody review={review} />
      <p className="text-xs text-muted-foreground">{meta}</p>
    </article>
  );
}

/** The Reviews section on a listing's public page. The first page of reviews is rendered on the server. */
export function ListingReviews({
  listing,
  listingType,
  initialPage,
}: {
  listing: ReviewableListing;
  listingType: ReviewListingType;
  initialPage: ReviewPage;
}) {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const { toast } = useToast();

  const [reviews, setReviews] = useState(initialPage.reviews);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // undefined while unknown, null once we know the user hasn't reviewed this listing.
  const [ownReview, setOwnReview] = useState<Review | null | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Anonymous accounts can't review, so they count as signed out here.
  const reviewer = user && !user.isAnonymous ? user : null;
  const reviewerId = reviewer?.uid;
  const isOwnListing = !!reviewerId && (listing.submittedBy === reviewerId || listing.ownerUid === reviewerId);

  useEffect(() => {
    if (!reviewerId) {
      setOwnReview(null);
      return;
    }
    let cancelled = false;
    setOwnReview(undefined);
    getUserReview(listing.id, reviewerId)
      .then((review) => {
        if (!cancelled) setOwnReview(review);
      })
      .catch((error) => {
        console.error('Error fetching your review:', error);
        if (!cancelled) setOwnReview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [listing.id, reviewerId]);

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      const page = await getApprovedReviews(listing.id, reviews[reviews.length - 1]?.createdAt);
      setReviews((prev) => [...prev, ...page.reviews.filter((r) => !prev.some((p) => p.id === r.id))]);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error('Error loading more reviews:', error);
      toast({ variant: 'destructive', title: 'Could not load more reviews', description: 'Please try again.' });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSubmit = async (content: ReviewContent) => {
    if (!reviewer) return;
    try {
      if (ownReview) {
        await updateReview(ownReview.id, content);
        const { visitDate: _previousVisit, ...rest } = ownReview;
        setOwnReview({ ...rest, ...content, title: content.title.trim(), body: content.body.trim(), status: 'pending' });
        // An edited review stops being public until it is approved again.
        setReviews((prev) => prev.filter((r) => r.id !== ownReview.id));
      } else {
        const created = await createReview(
          { id: listing.id, type: listingType, title: listing.name },
          { uid: reviewer.uid, displayName: reviewer.displayName },
          content
        );
        setOwnReview(created);
      }
      setIsFormOpen(false);
      setShowThanks(true);
    } catch (error) {
      console.error('Error saving review:', error);
      toast({ variant: 'destructive', title: 'Could not save your review', description: 'Please check it and try again.' });
    }
  };

  const handleDelete = async () => {
    if (!ownReview) return;
    setIsDeleting(true);
    try {
      await deleteReview(ownReview.id);
      setReviews((prev) => prev.filter((r) => r.id !== ownReview.id));
      setOwnReview(null);
      setShowThanks(false);
      setIsDeleteOpen(false);
      toast({ title: 'Your review was deleted' });
    } catch (error) {
      console.error('Error deleting review:', error);
      toast({ variant: 'destructive', title: 'Could not delete your review', description: 'Please try again.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderWritePanel = () => {
    if (isUserLoading || (reviewer && ownReview === undefined)) return <Skeleton className="h-10 w-44" />;

    if (!reviewer) {
      return (
        <Button asChild variant="outline">
          <Link href={`/login?redirect=${encodeURIComponent(`${pathname}#reviews`)}`}>
            <Translatable text="Sign in to leave a review" />
          </Link>
        </Button>
      );
    }

    if (isFormOpen) {
      return (
        <div className="rounded-lg border p-4 sm:p-5">
          <ReviewForm
            key={ownReview?.id ?? 'new'}
            initial={ownReview ?? undefined}
            submitLabel={ownReview ? 'Save changes' : 'Submit review'}
            onSubmit={handleSubmit}
            onCancel={() => setIsFormOpen(false)}
          />
        </div>
      );
    }

    if (ownReview) {
      const badge = STATUS_BADGES[ownReview.status];
      return (
        <div className="space-y-2 rounded-lg border bg-secondary/30 p-4 sm:p-5">
          {showThanks && (
            <p role="status" className="text-sm font-medium text-primary">
              <Translatable text={THANKS_MESSAGE} />
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              <Translatable text="Your review" />
            </h3>
            <Badge variant="outline" className={badge.className}>
              <Translatable text={badge.label} />
            </Badge>
          </div>
          <ReviewBody review={ownReview} />
          {ownReview.visitDate && (
            <p className="text-xs text-muted-foreground">
              <Translatable text={`Visited ${formatVisitMonth(ownReview.visitDate)}`} />
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setShowThanks(false); setIsFormOpen(true); }}>
              <Edit2 className="h-4 w-4 mr-1" />
              <Translatable text="Edit" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              <Translatable text="Delete" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <Translatable text="Editing sends your review back for approval." />
          </p>
        </div>
      );
    }

    if (isOwnListing) {
      return (
        <p className="text-sm text-muted-foreground">
          <Translatable text="You can't review your own listing." />
        </p>
      );
    }

    return (
      <Button onClick={() => setIsFormOpen(true)}>
        <MessageSquarePlus className="h-4 w-4 mr-2" />
        <Translatable text="Write a review" />
      </Button>
    );
  };

  return (
    <Card id="reviews" className="scroll-mt-24 bg-white">
      <CardContent className="space-y-6 p-5 sm:p-8">
        <h2 className="text-2xl font-bold font-headline text-primary">
          <Translatable text="Reviews" />
        </h2>

        <RatingSummary listing={listing} />

        {renderWritePanel()}

        {reviews.length > 0 ? (
          <div className="space-y-5">
            {reviews.map((review) => (
              <ReviewItem key={review.id} review={review} />
            ))}
          </div>
        ) : (
          !getListingRating(listing) && (
            <p className="text-sm text-muted-foreground">
              <Translatable text={`No reviews yet — be the first to review ${listing.name}.`} />
            </p>
          )
        )}

        {hasMore && (
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore} className="w-full sm:w-auto">
            {isLoadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Translatable text="Load more" />
          </Button>
        )}
      </CardContent>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Translatable text="Delete your review?" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Translatable text="This action cannot be undone." />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              <Translatable text="Cancel" />
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              <Translatable text="Delete" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
