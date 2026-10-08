'use client';
import { Briefcase } from 'lucide-react';
import { serviceCategoriesMap } from '@/lib/service-categories';
import { ListingCard } from '@/components/listings/listing-card';

export function ServiceProviderCard({ listing }: { listing: any }) {
  const CategoryIcon = serviceCategoriesMap[listing.category]?.icon || Briefcase;

  return <ListingCard listing={listing} categoryIcon={CategoryIcon} showStars />;
}
