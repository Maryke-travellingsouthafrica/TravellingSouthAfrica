'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { ListingCard } from '@/components/listings/listing-card';
import { ListingDetailsDialog } from '@/components/listings/listing-details-dialog';
import { getListingPath, getListingUrl } from '@/lib/listing-links';

// Cards share the Service Providers card layout; the image, title and
// "View details →" link open the shared details dialog below.
export function AccommodationGrid({ listings }: { listings: any[] }) {
  const [selected, setSelected] = useState<any | null>(null);

  return (
    <>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            categoryIcon={Building2}
            normalizeWebsiteUrl
            clampDescription
            detailHref={getListingPath('accommodation', listing)}
            shareUrl={getListingUrl('accommodation', listing)}
            onOpenDetails={() => setSelected(listing)}
          />
        ))}
      </div>

      <ListingDetailsDialog
        kind="accommodation"
        listing={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
