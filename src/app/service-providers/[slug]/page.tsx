import type { Metadata } from 'next';
import { generateListingMetadata, renderListingPage } from '@/lib/public-listing-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  return generateListingMetadata('service-provider', slug);
}

export default async function ServiceProviderPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  return renderListingPage('service-provider', slug);
}
