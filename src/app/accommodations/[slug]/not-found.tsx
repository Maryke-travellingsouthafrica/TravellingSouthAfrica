import type { Metadata } from 'next';
import { ListingNotFound } from '@/components/listings/listing-not-found';

export const metadata: Metadata = {
  title: 'Listing not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <ListingNotFound kind="listing" />;
}
