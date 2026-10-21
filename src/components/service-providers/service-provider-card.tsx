'use client';
import { useState } from 'react';
import { Briefcase } from 'lucide-react';
import { serviceCategoriesMap } from '@/lib/service-categories';
import { ListingCard } from '@/components/listings/listing-card';
import { ListingDetailsDialog } from '@/components/listings/listing-details-dialog';
import { getListingPath, getListingUrl } from '@/lib/listing-links';

export function ServiceProviderCard({ listing }: { listing: any }) {
  const [open, setOpen] = useState(false);
  const CategoryIcon = serviceCategoriesMap[listing.category]?.icon || Briefcase;

  return (
    <>
      <ListingCard
        listing={listing}
        categoryIcon={CategoryIcon}
        showStars
        detailHref={getListingPath('service-provider', listing)}
        shareUrl={getListingUrl('service-provider', listing)}
        onOpenDetails={() => setOpen(true)}
      />
      <ListingDetailsDialog kind="service-provider" listing={listing} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
