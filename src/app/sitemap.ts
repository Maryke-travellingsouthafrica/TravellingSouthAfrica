import type { MetadataRoute } from 'next';
import { provinces } from '@/lib/data/provinces';
import { towns } from '@/lib/data/towns';
import { sights } from '@/lib/data/sights';
import { routes } from '@/lib/data/routes';
import { getPostUrl, getPublishedPosts } from '@/lib/blog';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://travellingsouthafrica.co.za';

// Regenerated hourly so newly published blog posts appear without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticPages = [
    '',
    '/provinces',
    '/towns',
    '/sights',
    '/routes',
    '/accommodations',
    '/service-providers',
    '/service-providers/airlines',
    '/service-providers/attractions',
    '/service-providers/car-hire',
    '/service-providers/general',
    '/service-providers/hotels',
    '/service-providers/restaurants',
    '/service-providers/travel-agents',
    '/service-providers/vehicles',
    '/service-providers/technology',
    '/plan-your-trip',
    '/tools/currency-converter',
    '/tools/directions',
    '/tools/slang',
    '/add-your-listing',
    '/contact',
    '/privacy-policy',
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: (path === '' ? 'daily' : 'weekly') as 'daily' | 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));

  const provincePages = provinces.map((province) => ({
    url: `${siteUrl}/provinces/${province.slug}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const townPages = towns.map((town) => ({
    url: `${siteUrl}/towns/${town.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const sightPages = sights.map((sight) => ({
    url: `${siteUrl}/sights/${sight.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const routePages = routes.map((route) => ({
    url: `${siteUrl}/routes/${route.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // Blog posts come from Firestore; if that read fails the rest of the sitemap still ships.
  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const posts = await getPublishedPosts();
    blogPages = posts.map((post) => ({
      url: getPostUrl(post),
      lastModified: post.dateMs ? new Date(post.dateMs) : lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error);
  }

  return [...staticPages, ...provincePages, ...townPages, ...sightPages, ...routePages, ...blogPages];
}
