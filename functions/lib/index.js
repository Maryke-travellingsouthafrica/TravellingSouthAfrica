"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onContactMessageCreate = exports.onReviewWritten = exports.onAttractionsSubmission = exports.onServiceProvidersSubmission = exports.onRestaurantsSubmission = exports.onAccommodationsSubmission = exports.deleteListingSubmission = exports.unapproveListing = exports.approveListing = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const review_stats_1 = require("./review-stats");
const admin_emails_json_1 = __importDefault(require("./admin-emails.json"));
// Initialize Firebase Admin SDK
(0, app_1.initializeApp)();
const adminDb = (0, firestore_2.getFirestore)();
const isAdminByEmail = (email) => {
    if (!email)
        return false;
    return admin_emails_json_1.default.includes(email);
};
// Recalculates a listing's rating from its approved reviews. Safe to re-run, and
// does nothing when the listing doesn't exist (e.g. it was un-approved or deleted).
const recalculateListingRating = async (collectionName, listingId) => {
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
        const stats = (0, review_stats_1.computeRatingStats)(reviews.docs.map((review) => review.get("rating")));
        if ((0, review_stats_1.ratingStatsMatch)(listing.data() ?? {}, stats))
            return;
        transaction.update(listingRef, stats.ratingCount > 0
            ? stats
            : {
                ratingAverage: firestore_2.FieldValue.delete(),
                ratingCount: firestore_2.FieldValue.delete(),
                ratingBreakdown: firestore_2.FieldValue.delete(),
            });
    });
};
// Approve a listing submission
exports.approveListing = (0, https_1.onCall)(async (request) => {
    const { submissionId, collectionName } = request.data;
    const userEmail = request.auth?.token.email;
    logger.info(`approveListing called by ${userEmail} for ${collectionName}/${submissionId}`);
    if (!isAdminByEmail(userEmail)) {
        throw new https_1.HttpsError("permission-denied", "You must be an admin to approve listings.");
    }
    const submissionRef = adminDb.collection(`${collectionName}_submissions`).doc(submissionId);
    const submissionDoc = await submissionRef.get();
    if (!submissionDoc.exists) {
        throw new https_1.HttpsError("not-found", "Submission document not found.");
    }
    const data = submissionDoc.data();
    if (!data) {
        throw new https_1.HttpsError("internal", "Submission data is empty.");
    }
    // Submitters control their submission's fields, so a rating must never be copied across.
    delete data.ratingAverage;
    delete data.ratingCount;
    delete data.ratingBreakdown;
    await adminDb.collection(collectionName).doc(submissionId).set({
        ...data,
        approved: true,
        approvedAt: firestore_2.FieldValue.serverTimestamp(),
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
exports.unapproveListing = (0, https_1.onCall)(async (request) => {
    const { docId, collectionName } = request.data;
    const userEmail = request.auth?.token.email;
    logger.info(`unapproveListing called by ${userEmail} for ${collectionName}/${docId}`);
    if (!isAdminByEmail(userEmail)) {
        throw new https_1.HttpsError("permission-denied", "You must be an admin.");
    }
    await adminDb.collection(collectionName).doc(docId).delete();
    const submissionRef = adminDb.collection(`${collectionName}_submissions`).doc(docId);
    await submissionRef.update({ status: "pending" });
    return { success: true, message: "Listing has been un-approved and returned to pending." };
});
// Delete a listing submission entirely
exports.deleteListingSubmission = (0, https_1.onCall)(async (request) => {
    const { docId, collectionName } = request.data;
    const userEmail = request.auth?.token.email;
    logger.info(`deleteListingSubmission called by ${userEmail} for ${collectionName}/${docId}`);
    if (!isAdminByEmail(userEmail)) {
        throw new https_1.HttpsError("permission-denied", "You must be an admin to delete submissions.");
    }
    await adminDb.collection(collectionName).doc(docId).delete().catch(() => { });
    await adminDb.collection(`${collectionName}_submissions`).doc(docId).delete();
    return { success: true, message: "Submission has been deleted." };
});
const sendNotificationEmail = async (to, subject, html) => {
    await adminDb.collection("mail").add({ to, message: { subject, html } });
};
const defineListingNotification = (collectionName) => {
    return (0, firestore_1.onDocumentCreated)({ document: `${collectionName}_submissions/{listingId}` }, async (event) => {
        const snap = event.data;
        if (!snap)
            return;
        const listing = snap.data();
        const listingId = event.params.listingId;
        if (listing.status === "approved" ||
            (listing.ownerEmail && admin_emails_json_1.default.includes(listing.ownerEmail))) {
            logger.info(`Listing ${listingId} submitted by admin — no notification sent.`);
            return;
        }
        const listingType = collectionName
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());
        await sendNotificationEmail(admin_emails_json_1.default, `New Listing Submission: ${listing.name}`, `
          <p>A new <strong>${listingType}</strong> listing has been submitted for review.</p>
          <p><strong>Name:</strong> ${listing.name}</p>
          <p><strong>Town:</strong> ${listing.townSlug || "N/A"}</p>
          <p><strong>Submitted by:</strong> ${listing.ownerEmail || "Unknown"}</p>
          <p>Please log in to the admin panel to review and approve this listing.</p>
        `);
        logger.info(`Notification email queued for listing ${listingId} in ${collectionName}_submissions.`);
    });
};
exports.onAccommodationsSubmission = defineListingNotification("accommodations");
exports.onRestaurantsSubmission = defineListingNotification("restaurants");
exports.onServiceProvidersSubmission = defineListingNotification("service_providers");
exports.onAttractionsSubmission = defineListingNotification("attractions");
const REVIEW_LISTING_COLLECTIONS = {
    accommodation: "accommodations",
    service_provider: "service_providers",
    restaurant: "restaurants",
    attraction: "attractions",
};
// Keeps a listing's rating in step with its approved reviews, and tells the admins
// about each new review. Writes only to the listing and `mail`, so it can't re-trigger itself.
exports.onReviewWritten = (0, firestore_1.onDocumentWritten)({ document: "reviews/{reviewId}" }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const review = after ?? before;
    if (!review)
        return;
    // Only approved reviews count, so a change that never touched one can't move the rating.
    if (before?.status === "approved" || after?.status === "approved") {
        const collectionName = REVIEW_LISTING_COLLECTIONS[review.listingType];
        if (collectionName) {
            await recalculateListingRating(collectionName, review.listingId);
        }
        else {
            logger.warn(`Review ${event.params.reviewId} has unknown listing type ${review.listingType}.`);
        }
    }
    if (!before && after?.status === "pending") {
        // Keyed by the event so a redelivered event can't send a second email.
        await adminDb.collection("mail").doc(`review-${event.id}`).set({
            to: admin_emails_json_1.default,
            message: {
                subject: `New Review: ${review.listingTitle}`,
                html: `
            <p>A new review has been submitted and is waiting for approval.</p>
            <p><strong>Listing:</strong> ${(0, review_stats_1.escapeHtml)(review.listingTitle)}</p>
            <p><strong>Rating:</strong> ${(0, review_stats_1.escapeHtml)(review.rating)} out of 5</p>
            <p><strong>Reviewer:</strong> ${(0, review_stats_1.escapeHtml)(review.userName)}</p>
            <p><strong>Title:</strong> ${(0, review_stats_1.escapeHtml)(review.title)}</p>
            <p><strong>Review:</strong> ${(0, review_stats_1.escapeHtml)(review.body)}</p>
            <p>Please log in to the admin panel to approve or reject this review.</p>
          `,
            },
        });
        logger.info(`Notification email queued for review ${event.params.reviewId}.`);
    }
});
exports.onContactMessageCreate = (0, firestore_1.onDocumentCreated)({ document: "contactMessages/{messageId}" }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const message = snap.data();
    await sendNotificationEmail(admin_emails_json_1.default, `New Contact Message from ${message.name}: ${message.subject}`, `
        <p>You have received a new contact message.</p>
        <p><strong>Name:</strong> ${message.name}</p>
        <p><strong>Email:</strong> ${message.email}</p>
        <p><strong>Subject:</strong> ${message.subject}</p>
        <p><strong>Message:</strong> ${message.userMessage}</p>
      `);
    logger.info(`Contact notification email queued for message ${event.params.messageId}.`);
});
//# sourceMappingURL=index.js.map