import { initializeFirebase } from '@/firebase';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { toDate, type TimestampLike } from '@/lib/events';
import {
  formatReviewerName,
  getReviewId,
  REVIEWS_PAGE_SIZE,
  type Review,
  type ReviewContent,
  type ReviewListingType,
  type ReviewPage,
  type ReviewStatus,
} from '@/lib/reviews';

const { firestore } = initializeFirebase();
const reviewsCollection = collection(firestore, 'reviews');

/** Keeps stored text tidy and leaves `visitDate` out when it wasn't given. */
function cleanContent({ rating, title, body }: ReviewContent) {
  return { rating, title: title.trim(), body: body.trim() };
}

/**
 * A paging cursor at the Timestamp's full precision: going through a Date would
 * round it to the millisecond and could skip a review written moments apart.
 */
function toCursor(value: TimestampLike) {
  const { seconds, nanoseconds } = (value ?? {}) as { seconds?: number; nanoseconds?: number };
  return typeof seconds === 'number' ? new Timestamp(seconds, nanoseconds ?? 0) : null;
}

/**
 * The next page of a listing's approved reviews, newest first. The first page is
 * rendered on the server, so `after` is the createdAt of the last review shown.
 */
export async function getApprovedReviews(listingId: string, after: TimestampLike): Promise<ReviewPage> {
  const cursor = toCursor(after);
  const q = query(
    reviewsCollection,
    where('listingId', '==', listingId),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(REVIEWS_PAGE_SIZE + 1)
  );
  const snapshot = await getDocs(q);
  const reviews = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Review[];
  return { reviews: reviews.slice(0, REVIEWS_PAGE_SIZE), hasMore: reviews.length > REVIEWS_PAGE_SIZE };
}

/**
 * The signed-in user's review of a listing, whatever its status. This is a query
 * rather than a get because the rules can only allow reading a doc that exists.
 */
export async function getUserReview(listingId: string, userId: string): Promise<Review | null> {
  const q = query(reviewsCollection, where('listingId', '==', listingId), where('userId', '==', userId), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const review = snapshot.docs[0];
  return { id: review.id, ...review.data() } as Review;
}

/**
 * Creates a user's review of a listing as pending, returning it for display.
 * Only the short reviewer name is stored, because approved reviews are public.
 */
export async function createReview(
  listing: { id: string; type: ReviewListingType; title: string },
  user: { uid: string; displayName: string | null },
  content: ReviewContent
): Promise<Review> {
  const id = getReviewId(listing.id, user.uid);
  const fields = {
    listingId: listing.id,
    listingType: listing.type,
    listingTitle: listing.title,
    userId: user.uid,
    userName: formatReviewerName(user.displayName),
    status: 'pending' as const,
    ...cleanContent(content),
    ...(content.visitDate ? { visitDate: content.visitDate } : {}),
  };
  await setDoc(doc(firestore, 'reviews', id), {
    ...fields,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id, ...fields, createdAt: new Date(), updatedAt: new Date() };
}

/** Saves an author's edit, which sends the review back to pending. */
export async function updateReview(id: string, content: ReviewContent) {
  await updateDoc(doc(firestore, 'reviews', id), {
    ...cleanContent(content),
    visitDate: content.visitDate || deleteField(),
    status: 'pending',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a review by ID.
 */
export async function deleteReview(id: string) {
  await deleteDoc(doc(firestore, 'reviews', id));
}

/**
 * Fetches every review for the admin dashboard, newest first. Sorted in memory
 * because the Pending/Approved/Rejected filters all need the full set for counts.
 */
export async function getAllReviews(): Promise<Review[]> {
  const snapshot = await getDocs(reviewsCollection);
  const reviews = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Review[];
  return reviews.sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
}

/**
 * Approves or rejects a review. `moderatedBy` is the admin's uid rather than their
 * email, because approved reviews are public documents.
 */
export async function moderateReview(id: string, status: ReviewStatus, adminUid: string) {
  await updateDoc(doc(firestore, 'reviews', id), {
    status,
    moderatedAt: serverTimestamp(),
    moderatedBy: adminUid,
  });
}
