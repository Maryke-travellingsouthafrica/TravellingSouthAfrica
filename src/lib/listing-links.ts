import { slugify } from '@/lib/slug';

/**
 * Public, shareable listing pages.
 *
 * A listing's URL is `<readable-name>-<firestoreDocId>`. The page is resolved by
 * the doc ID alone, so renaming a listing never breaks an old link — the name part
 * is only for people (and WhatsApp previews) and is redirected to the current one.
 */

export type ListingKind = 'accommodation' | 'service-provider' | 'event';

const BASE_PATHS: Record<ListingKind, string> = {
  accommodation: '/accommodations',
  'service-provider': '/service-providers',
  event: '/events',
};

/** Absolute site origin: NEXT_PUBLIC_SITE_URL, else production. No trailing slash. */
export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://travellingsouthafrica.co.za').replace(/\/+$/, '');
}

/** `casa-del-sonder-AbC123…` — the slug for a listing's current name. */
export function buildListingSlug(name: string | undefined | null, id: string) {
  const namePart = slugify(name);
  return namePart ? `${namePart}-${id}` : id;
}

/** Candidate Firestore doc IDs encoded in a slug, most likely first. */
export function getListingIdCandidates(slug: string): string[] {
  const decoded = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  const last = decoded.slice(decoded.lastIndexOf('-') + 1);
  return last && last !== decoded ? [last, decoded] : [decoded];
}

export function getListingPath(kind: ListingKind, listing: { id: string; name?: string; title?: string }) {
  return `${BASE_PATHS[kind]}/${buildListingSlug(listing.name ?? listing.title, listing.id)}`;
}

export function getListingUrl(kind: ListingKind, listing: { id: string; name?: string; title?: string }) {
  return `${getSiteUrl()}${getListingPath(kind, listing)}`;
}

/** wa.me link with the message the team sends to a business owner. */
export function getWhatsAppShareUrl(kind: ListingKind, listing: { id: string; name?: string; title?: string }) {
  const name = listing.name ?? listing.title ?? 'your business';
  const message = `Hi! We've created a listing for ${name} on Travelling South Africa: ${getListingUrl(kind, listing)}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
