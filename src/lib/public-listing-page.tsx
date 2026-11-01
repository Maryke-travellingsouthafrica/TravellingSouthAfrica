import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ListingDetailView } from '@/components/listings/listing-detail-view';
import { buildListingSlug, getListingPath, getSiteUrl, type ListingKind } from '@/lib/listing-links';
import { getInitialReviews, getPublicListing, type PublicListing } from '@/lib/public-listings';
import { buildAggregateRating } from '@/lib/reviews';
import { towns } from '@/lib/data/towns';

const LOGO_PATH = '/2026%20Logo%20(1)-Photoroom.png';

const REVIEW_LISTING_TYPES = { accommodation: 'accommodation', 'service-provider': 'service_provider' } as const;

/** The business's JSON-LD, only once it has approved reviews to show for it. */
function buildRatedBusinessSchema(kind: keyof typeof REVIEW_LISTING_TYPES, listing: PublicListing) {
  const aggregateRating = buildAggregateRating(listing);
  if (!aggregateRating) return null;

  const image = (listing.imageUrls as string[] | undefined)?.find(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': kind === 'accommodation' ? 'LodgingBusiness' : 'LocalBusiness',
    name: listing.name,
    url: `${getSiteUrl()}${getListingPath(kind, listing)}`,
    ...(listing.description ? { description: listing.description } : {}),
    ...(image ? { image } : {}),
    ...(listing.contactPhone ? { telephone: listing.contactPhone } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(listing.physicalAddress ? { streetAddress: listing.physicalAddress } : {}),
      ...(getTownName(listing.townSlug) ? { addressLocality: getTownName(listing.townSlug) } : {}),
      addressCountry: 'ZA',
    },
    aggregateRating,
  };
}

function getTownName(townSlug?: string) {
  if (!townSlug) return undefined;
  return towns.find((t) => t.slug === townSlug)?.name ?? townSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Collapses whitespace and cuts at a word boundary so previews stay short. */
function trimDescription(text: string | undefined, max: number) {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, '').trimEnd() + '…';
}

const NOT_FOUND_METADATA: Metadata = {
  title: 'Listing not found',
  robots: { index: false, follow: false },
};

export async function generateListingMetadata(kind: ListingKind, slug: string): Promise<Metadata> {
  const listing = await getPublicListing(kind, slug);
  if (!listing) return NOT_FOUND_METADATA;

  const townName = getTownName(listing.townSlug);
  const short = trimDescription(listing.description, 150);
  const description =
    [short, townName].filter(Boolean).join(' – ') || `${listing.name} on Travelling South Africa`;
  const url = `${getSiteUrl()}${getListingPath(kind, listing)}`;
  const image = (listing.imageUrls as string[] | undefined)?.find(Boolean) ?? `${getSiteUrl()}${LOGO_PATH}`;

  return {
    title: listing.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: 'Travelling South Africa',
      title: listing.name,
      description,
      url,
      images: [{ url: image, alt: listing.name }],
    },
    twitter: { card: 'summary_large_image', title: listing.name, description, images: [image] },
  };
}

export async function renderListingPage(kind: Exclude<ListingKind, 'event'>, slug: string) {
  const listing = await getPublicListing(kind, slug);
  if (!listing) notFound();

  // Old name in the link (listing renamed): send them to the current URL.
  if (slug !== buildListingSlug(listing.name, listing.id)) permanentRedirect(getListingPath(kind, listing));

  const initialReviewPage = await getInitialReviews(listing.id);
  const businessSchema = buildRatedBusinessSchema(kind, listing);

  return (
    <>
      {businessSchema && (
        <script
          type="application/ld+json"
          // Listing text comes from submissions, so it mustn't be able to close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema).replace(/</g, '\\u003c') }}
        />
      )}
      <ListingDetailView
        listing={listing as any}
        townName={getTownName(listing.townSlug)}
        backHref={kind === 'accommodation' ? '/accommodations' : '/service-providers'}
        backLabel={kind === 'accommodation' ? 'All accommodation' : 'All service providers'}
        shareUrl={`${getSiteUrl()}${getListingPath(kind, listing)}`}
        reviewListingType={REVIEW_LISTING_TYPES[kind]}
        initialReviewPage={initialReviewPage}
      />
    </>
  );
}
