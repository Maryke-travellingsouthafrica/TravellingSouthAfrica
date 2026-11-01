import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore as adminGetFirestore, FieldValue } from "firebase-admin/firestore";
import { computeRatingStats, escapeHtml, ratingStatsMatch } from "./review-stats";
import ADMIN_EMAILS from "./admin-emails.json";

// Initialize Firebase Admin SDK
initializeApp();
const adminDb = adminGetFirestore();

const isAdminByEmail = (email?: string) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
};

// Recalculates a listing's rating from its approved reviews. Safe to re-run, and
// does nothing when the listing doesn't exist (e.g. it was un-approved or deleted).
const recalculateListingRating = async (collectionName: string, listingId: string) => {
  const listingRef = adminDb.collection(collectionName).doc(listingId);
  const approvedReviews = adminDb
    .collection("reviews")
    .where("listingId", "==", listingId)
    .where("status", "==", "approved")
    .select("rating");

  await adminDb.runTransaction(async (transaction) => {
    const listing = await transaction.get(listingRef);
    if (!listing.exists) {
      logger.info(`Listing ${collectionName}/${listingId} not found — rating not updated.`);
      return;
    }

    const reviews = await transaction.get(approvedReviews);
    const stats = computeRatingStats(reviews.docs.map((review) => review.get("rating")));
    if (ratingStatsMatch(listing.data() ?? {}, stats)) return;

    transaction.update(
      listingRef,
      stats.ratingCount > 0
        ? stats
        : {
          ratingAverage: FieldValue.delete(),
          ratingCount: FieldValue.delete(),
          ratingBreakdown: FieldValue.delete(),
        }
    );
  });
};

// Approve a listing submission
export const approveListing = onCall(async (request) => {
  const { submissionId, collectionName } = request.data;
  const userEmail = request.auth?.token.email;

  logger.info(`approveListing called by ${userEmail} for ${collectionName}/${submissionId}`);

  if (!isAdminByEmail(userEmail)) {
    throw new HttpsError("permission-denied", "You must be an admin to approve listings.");
  }

  const submissionRef = adminDb.collection(`${collectionName}_submissions`).doc(submissionId);
  const submissionDoc = await submissionRef.get();

  if (!submissionDoc.exists) {
    throw new HttpsError("not-found", "Submission document not found.");
  }

  const data = submissionDoc.data();
  if (!data) {
    throw new HttpsError("internal", "Submission data is empty.");
  }

  // Submitters control their submission's fields, so a rating must never be copied across.
  delete data.ratingAverage;
  delete data.ratingCount;
  delete data.ratingBreakdown;

  await adminDb.collection(collectionName).doc(submissionId).set({
    ...data,
    approved: true,
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: userEmail,
  });

  await submissionRef.update({ status: "approved" });

  // Re-approving replaces the public doc, so restore the rating from any existing
  // reviews. A failure here shouldn't report the approval itself as failed.
  await recalculateListingRating(collectionName, submissionId).catch((error) => {
    logger.error(`Rating not restored for ${collectionName}/${submissionId}`, error);
  });

  return { success: true, message: `Listing ${submissionId} approved.` };
});

// Unapprove a listing (remove from public collection)
export const unapproveListing = onCall(async (request) => {
  const { docId, collectionName } = request.data;
  const userEmail = request.auth?.token.email;

  logger.info(`unapproveListing called by ${userEmail} for ${collectionName}/${docId}`);

  if (!isAdminByEmail(userEmail)) {
    throw new HttpsError("permission-denied", "You must be an admin.");
  }

  await adminDb.collection(collectionName).doc(docId).delete();

  const submissionRef = adminDb.collection(`${collectionName}_submissions`).doc(docId);
  await submissionRef.update({ status: "pending" });

  return { success: true, message: "Listing has been un-approved and returned to pending." };
});

// Delete a listing submission entirely
export const deleteListingSubmission = onCall(async (request) => {
  const { docId, collectionName } = request.data;
  const userEmail = request.auth?.token.email;

  logger.info(`deleteListingSubmission called by ${userEmail} for ${collectionName}/${docId}`);

  if (!isAdminByEmail(userEmail)) {
    throw new HttpsError("permission-denied", "You must be an admin to delete submissions.");
  }

  await adminDb.collection(collectionName).doc(docId).delete().catch(() => {});
  await adminDb.collection(`${collectionName}_submissions`).doc(docId).delete();

  return { success: true, message: "Submission has been deleted." };
});

const sendNotificationEmail = async (to: string[], subject: string, html: string) => {
  await adminDb.collection("mail").add({ to, message: { subject, html } });
};

const defineListingNotification = (collectionName: string) => {
  return onDocumentCreated(
    { document: `${collectionName}_submissions/{listingId}` },
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const listing = snap.data();
      const listingId = event.params.listingId;

      if (
        listing.status === "approved" ||
        (listing.ownerEmail && ADMIN_EMAILS.includes(listing.ownerEmail))
      ) {
        logger.info(`Listing ${listingId} submitted by admin — no notification sent.`);
        return;
      }

      const listingType = collectionName
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());

      await sendNotificationEmail(
        ADMIN_EMAILS,
        `New Listing Submission: ${listing.name}`,
        `
          <p>A new <strong>${listingType}</strong> listing has been submitted for review.</p>
          <p><strong>Name:</strong> ${listing.name}</p>
          <p><strong>Town:</strong> ${listing.townSlug || "N/A"}</p>
          <p><strong>Submitted by:</strong> ${listing.ownerEmail || "Unknown"}</p>
          <p>Please log in to the admin panel to review and approve this listing.</p>
        `
      );

      logger.info(`Notification email queued for listing ${listingId} in ${collectionName}_submissions.`);
    }
  );
};

export const onAccommodationsSubmission = defineListingNotification("accommodations");
export const onRestaurantsSubmission = defineListingNotification("restaurants");
export const onServiceProvidersSubmission = defineListingNotification("service_providers");
export const onAttractionsSubmission = defineListingNotification("attractions");

const REVIEW_LISTING_COLLECTIONS: Record<string, string> = {
  accommodation: "accommodations",
  service_provider: "service_providers",
  restaurant: "restaurants",
  attraction: "attractions",
};

// Keeps a listing's rating in step with its approved reviews, and tells the admins
// about each new review. Writes only to the listing and `mail`, so it can't re-trigger itself.
export const onReviewWritten = onDocumentWritten(
  { document: "reviews/{reviewId}" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const review = after ?? before;
    if (!review) return;

    // Only approved reviews count, so a change that never touched one can't move the rating.
    if (before?.status === "approved" || after?.status === "approved") {
      const collectionName = REVIEW_LISTING_COLLECTIONS[review.listingType];
      if (collectionName) {
        await recalculateListingRating(collectionName, review.listingId);
      } else {
        logger.warn(`Review ${event.params.reviewId} has unknown listing type ${review.listingType}.`);
      }
    }

    if (!before && after?.status === "pending") {
      // Keyed by the event so a redelivered event can't send a second email.
      await adminDb.collection("mail").doc(`review-${event.id}`).set({
        to: ADMIN_EMAILS,
        message: {
          subject: `New Review: ${review.listingTitle}`,
          html: `
            <p>A new review has been submitted and is waiting for approval.</p>
            <p><strong>Listing:</strong> ${escapeHtml(review.listingTitle)}</p>
            <p><strong>Rating:</strong> ${escapeHtml(review.rating)} out of 5</p>
            <p><strong>Reviewer:</strong> ${escapeHtml(review.userName)}</p>
            <p><strong>Title:</strong> ${escapeHtml(review.title)}</p>
            <p><strong>Review:</strong> ${escapeHtml(review.body)}</p>
            <p>Please log in to the admin panel to approve or reject this review.</p>
          `,
        },
      });

      logger.info(`Notification email queued for review ${event.params.reviewId}.`);
    }
  }
);

export const onContactMessageCreate = onDocumentCreated(
  { document: "contactMessages/{messageId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const message = snap.data();

    await sendNotificationEmail(
      ADMIN_EMAILS,
      `New Contact Message from ${message.name}: ${message.subject}`,
      `
        <p>You have received a new contact message.</p>
        <p><strong>Name:</strong> ${message.name}</p>
        <p><strong>Email:</strong> ${message.email}</p>
        <p><strong>Subject:</strong> ${message.subject}</p>
        <p><strong>Message:</strong> ${message.userMessage}</p>
      `
    );

    logger.info(`Contact notification email queued for message ${event.params.messageId}.`);
  }
);