import type { Metadata } from 'next';
import { generateListingMetadata, renderListingPage } from '@/lib/public-listing-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  return generateListingMetadata('accommodation', slug);
}

export default async function AccommodationPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  return renderListingPage('accommodation', slug);
}
