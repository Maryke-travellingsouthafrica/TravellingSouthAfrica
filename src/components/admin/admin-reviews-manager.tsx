'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Trash2, X } from 'lucide-react';
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
import { RatingStars } from '@/components/reviews/rating-stars';
import { useToast } from '@/hooks/use-toast';
import {
  formatReviewDate,
  formatVisitMonth,
  getReviewListingHref,
  REVIEW_LISTING_TYPE_LABELS,
  type Review,
  type ReviewStatus,
} from '@/lib/reviews';
import { deleteReview, getAllReviews, moderateReview } from '@/services/reviewsService';

const FILTERS: { status: ReviewStatus; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
];

export function AdminReviewsManager() {
  const { user } = useUser();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [filter, setFilter] = useState<ReviewStatus>('pending');
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setReviews(await getAllReviews());
      } catch (error: any) {
        console.error('Error fetching reviews:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch reviews' });
      } finally {
        setIsFetching(false);
      }
    };
    fetchReviews();
  }, [toast]);

  const counts = useMemo(() => {
    const totals: Record<ReviewStatus, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const review of reviews) totals[review.status]++;
    return totals;
  }, [reviews]);

  const visibleReviews = useMemo(() => reviews.filter((review) => review.status === filter), [reviews, filter]);

  // The list updates straight away and is put back if the save fails.
  const handleModerate = async (review: Review, status: ReviewStatus) => {
    if (!user) return;
    setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, status } : r)));
    try {
      await moderateReview(review.id, status, user.uid);
      toast({ title: 'Success', description: status === 'approved' ? 'Review approved' : 'Review rejected' });
    } catch (error: any) {
      console.error('Error moderating review:', error);
      setReviews((prev) => prev.map((r) => (r.id === review.id ? review : r)));
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update review' });
    }
  };

  const handleDelete = async () => {
    if (!reviewToDelete) return;
    const review = reviewToDelete;
    const previous = reviews;
    setReviewToDelete(null);
    setReviews((prev) => prev.filter((r) => r.id !== review.id));
    try {
      await deleteReview(review.id);
      toast({ title: 'Success', description: 'Review deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting review:', error);
      setReviews(previous);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete review' });
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reviews</h2>
        <p className="text-muted-foreground mt-1">Approve, reject and remove reviews of public listings</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ status, label }) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            {label} ({counts[status]})
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {isFetching ? (
          <Card>
            <CardContent className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : visibleReviews.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">No {filter} reviews.</CardContent>
          </Card>
        ) : (
          visibleReviews.map((review) => {
            const href = getReviewListingHref(review);
            return (
              <Card key={review.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {href ? (
                      <Link href={href} target="_blank" className="font-semibold text-primary hover:underline break-words">
                        {review.listingTitle}
                      </Link>
                    ) : (
                      <span className="font-semibold break-words">{review.listingTitle}</span>
                    )}
                    <Badge variant="secondary">{REVIEW_LISTING_TYPE_LABELS[review.listingType]}</Badge>
                  </div>

                  <div className="space-y-1">
                    <RatingStars value={review.rating} />
                    <h3 className="font-semibold break-words">{review.title}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{review.body}</p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {[
                      review.userName,
                      formatReviewDate(review.createdAt),
                      review.visitDate && `Visited ${formatVisitMonth(review.visitDate)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                    {review.status !== 'approved' && (
                      <Button size="sm" onClick={() => handleModerate(review, 'approved')}>
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    )}
                    {review.status !== 'rejected' && (
                      <Button variant="outline" size="sm" onClick={() => handleModerate(review, 'rejected')}>
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => setReviewToDelete(review)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog open={!!reviewToDelete} onOpenChange={(open) => { if (!open) setReviewToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewToDelete && `"${reviewToDelete.title}" by ${reviewToDelete.userName} will be permanently removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
