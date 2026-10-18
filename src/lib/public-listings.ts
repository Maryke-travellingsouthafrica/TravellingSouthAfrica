import { cache } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { getListingIdCandidates, type ListingKind } from '@/lib/listing-links';

/**
 * Server-side reads for the public listing pages (client SDK, same as the existing
 * server pages — Firestore rules already allow public reads of these collections).
 *
 * "Published" means the doc exists in the public collection with `approved === true`.
 * Pending submissions live in `<collection>_submissions` and are never read here.
 * The `status` field on public docs is a stale copy from submission time (it still
 * says "pending" on approved listings), so it must not be used as the filter.
 */

export const LISTING_COLLECTIONS: Record<ListingKind, string> = {
  accommodation: 'accommodations',
  'service-provider': 'service_providers',
  event: 'events',
};

export type PublicListing = { id: string; [key: string]: any };

function getFirestoreInstance() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

// Timestamps aren't serialisable across the server/client boundary.
function serialise(id: string, data: Record<string, unknown>): PublicListing {
  return { id, ...JSON.parse(JSON.stringify(data)) };
}

/** Looks a listing up by the doc ID embedded in its slug; null when missing or unpublished. */
export const getPublicListing = cache(async (kind: ListingKind, slug: string): Promise<PublicListing | null> => {
  try {
    const firestore = getFirestoreInstance();
    for (const id of getListingIdCandidates(slug)) {
      if (!id || id.includes('/')) continue;
      const snap = await getDoc(doc(firestore, LISTING_COLLECTIONS[kind], id));
      if (!snap.exists()) continue;
      const data = snap.data();
      if (kind !== 'event' && data.approved !== true) return null;
      return serialise(snap.id, data);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching ${kind} listing:`, error);
    return null;
  }
});

/** Every published listing of a kind, for the sitemap. */
export async function getAllPublicListings(kind: ListingKind): Promise<PublicListing[]> {
  const firestore = getFirestoreInstance();
  const ref = collection(firestore, LISTING_COLLECTIONS[kind]);
  const snap = await getDocs(kind === 'event' ? ref : query(ref, where('approved', '==', true)));
  return snap.docs.map((d) => serialise(d.id, d.data()));
}
