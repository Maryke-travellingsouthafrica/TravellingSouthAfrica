import Link from 'next/link';
import { notFound } from 'next/navigation';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { Translatable } from '@/components/translatable';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { LinkifiedText } from '@/components/linkified-text';
import { CalendarDays, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { towns } from '@/lib/data/towns';
import { provinces } from '@/lib/data/provinces';
import {
  formatEventDateRange,
  getEventEnd,
  getEventStart,
  slugifyEventTitle,
  type TimestampLike,
} from '@/lib/events';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://travellingsouthafrica.co.za';

export const dynamic = 'force-dynamic';

interface EventItem {
  id: string;
  title: string;
  description: string;
  startDate: TimestampLike;
  endDate: TimestampLike;
  /** Legacy single-date field on docs written before start/end dates existed. */
  eventDate?: TimestampLike;
  townSlug?: string;
  imageUrl?: string;
}

/**
 * Finds an event by its title slug, mirroring how the sights pages resolve
 * Firestore-backed docs that carry no stored slug. Falls back to the document
 * ID so a link keeps working if a title is later edited, and prefers the
 * soonest event when two share a title.
 *
 * Past events stay reachable here on purpose — only the listing hides them, so
 * an existing link or search result never lands on a 404 part-way through.
 */
async function getEventBySlug(slug: string): Promise<EventItem | null> {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const snapshot = await getDocs(collection(firestore, 'events'));

    const events = snapshot.docs.map((doc) => {
      const plainObject = JSON.parse(JSON.stringify(doc.data()));
      return { id: doc.id, ...plainObject } as EventItem;
    });

    const matches = events.filter((event) => slugifyEventTitle(event.title) === slug || event.id === slug);
    if (matches.length === 0) return null;

    return matches.sort(
      (a, b) => (getEventStart(a)?.getTime() ?? Infinity) - (getEventStart(b)?.getTime() ?? Infinity)
    )[0];
  } catch (error) {
    console.error('Error fetching event:', error);
    return null;
  }
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const event = await getEventBySlug(params.slug);

  if (!event) {
    return {
      title: 'Event Not Found',
      description: 'The event you are looking for does not exist on Travelling South Africa.',
    };
  }

  const townName = event.townSlug ? towns.find((t) => t.slug === event.townSlug)?.name : undefined;
  const formattedDate = formatEventDateRange(event);
  const title = `${event.title}${townName ? ` in ${townName}` : ''} | Travel SA | TravellingSA`;
  const description = `${formattedDate ? `${formattedDate}. ` : ''}${event.description}`.slice(0, 300);

  return {
    title,
    description,
    alternates: {
      canonical: `/events/${params.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/events/${params.slug}`,
      ...(event.imageUrl
        ? {
            images: [
              {
                url: event.imageUrl,
                width: 600,
                height: 400,
                alt: event.title,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function EventDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const event = await getEventBySlug(params.slug);

  if (!event) {
    notFound();
  }

  const town = event.townSlug ? towns.find((t) => t.slug === event.townSlug) : undefined;
  const townName = town?.name || event.townSlug;
  const province = town ? provinces.find((p) => p.slug === town.provinceSlug) : undefined;
  const formattedDate = formatEventDateRange(event);
  const start = getEventStart(event);
  const end = getEventEnd(event);

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Upcoming Events',
        item: `${siteUrl}/events`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: event.title,
        item: `${siteUrl}/events/${params.slug}`,
      },
    ],
  };

  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    ...(event.imageUrl ? { image: event.imageUrl } : {}),
    ...(start ? { startDate: start.toISOString() } : {}),
    ...(end ? { endDate: end.toISOString() } : {}),
    ...(townName
      ? {
          location: {
            '@type': 'Place',
            name: townName,
            address: {
              '@type': 'PostalAddress',
              addressLocality: townName,
              ...(province ? { addressRegion: province.name } : {}),
              addressCountry: 'ZA',
            },
          },
        }
      : {}),
    url: `${siteUrl}/events/${params.slug}`,
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />
      <section className="relative h-[60vh] text-white">
        <ImageWithFallback
          src={event.imageUrl}
          alt={`${event.title}${townName ? `, an event in ${townName}, South Africa` : ' in South Africa'}`}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
        <div className="relative z-10 flex h-full flex-col items-start justify-end p-8 md:p-16">
          <h1 className="text-4xl md:text-6xl font-bold font-headline">
            <Translatable text={event.title} />
          </h1>
          {formattedDate && (
            <div className="flex items-center text-xl mt-2">
              <CalendarDays className="w-5 h-5 mr-2" />
              {formattedDate}
            </div>
          )}
          {townName && (
            <div className="flex items-center text-xl mt-2">
              <MapPin className="w-5 h-5 mr-2" />
              <Translatable text={townName} />
              {province && <>, <Translatable text={province.name} /></>}
            </div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <h2 className="font-headline text-3xl font-bold mb-4">
              <Translatable text={`About ${event.title}`} />
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
              {/* Descriptions are plain admin-typed text, so any bare URL in the
                  body is linkified on render rather than at entry. */}
              <LinkifiedText text={event.description} />
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="font-headline text-2xl font-bold"><Translatable text="Event Info" /></h3>
            <div className="text-muted-foreground space-y-2">
              {formattedDate && (
                <p>
                  <strong><Translatable text="Dates:" /></strong> {formattedDate}
                </p>
              )}
              {townName && (
                <p>
                  <strong><Translatable text="Location:" /></strong>{' '}
                  {town ? (
                    <Link href={`/towns/${town.slug}`} className="text-primary hover:underline">
                      <Translatable text={town.name} />
                    </Link>
                  ) : (
                    <Translatable text={townName} />
                  )}
                  {province && <>, <Translatable text={province.name} /></>}
                </p>
              )}
              <p className="pt-2">
                <Link href="/events" className="text-primary hover:underline">
                  <Translatable text="Back to all events" />
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
