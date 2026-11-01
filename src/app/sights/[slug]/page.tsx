import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
} from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import { sights } from '@/lib/data/sights';
import { provinces } from '@/lib/data/provinces';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Translatable } from '@/components/translatable';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { towns } from "@/lib/data/towns";
import { getGoogleMapsEmbedUrl } from '@/lib/maps';
import { ListingReviews } from '@/components/reviews/listing-reviews';
import { getInitialReviews } from '@/lib/public-listings';
import { buildAggregateRating } from '@/lib/reviews';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://travellingsouthafrica.co.za';

export const dynamic = "force-dynamic";

function slugify(name: string) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function getFirestoreAttraction(slug: string) {
  try {
    const app =
      !getApps().length
        ? initializeApp(firebaseConfig)
        : getApp();

    const db = getFirestore(app);

    const snapshot = await getDocs(collection(db, "attractions"));

    const attractions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as any),
    }));

    return attractions.find(
      (a) => a.approved && slugify(a.name) === slug
    );
  } catch (err) {
    console.error("Firestore fetch failed", err);
    return null;
  }
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const sight = sights.find((p) => p.slug === params.slug);

  let dataForMeta;

  if (sight) {
    dataForMeta = {
        name: sight.name,
        description: `Your travel guide to ${sight.name} with Travelling South Africa (Travel SA). Find info on tickets, hours, and the best time to visit this iconic SA attraction.`,
        slug: sight.slug,
        imageUrl: PlaceHolderImages.find(p => p.id === sight.imageId)?.imageUrl || ''
    }
  } else {
    const firestoreAttraction = await getFirestoreAttraction(params.slug);
    if (firestoreAttraction) {
        dataForMeta = {
            name: firestoreAttraction.name,
            description: `Your travel guide to ${firestoreAttraction.name} with Travelling South Africa (Travel SA). Find info on tickets, hours, and the best time to visit this iconic SA attraction.`,
            slug: params.slug,
            imageUrl: firestoreAttraction.imageUrls?.[0] || ''
        }
    }
  }

  if (!dataForMeta) {
    return {
      title: "Sight Not Found",
      description: "The sight or attraction you are looking for does not exist on Travelling South Africa.",
    };
  }

  const title = `${dataForMeta.name} Guide | Travel South Africa | TravellingSA`;
  
  return {
    title,
    description: dataForMeta.description,
    alternates: {
      canonical: `/sights/${dataForMeta.slug}`,
    },
    openGraph: {
      title,
      description: dataForMeta.description,
      url: `${siteUrl}/sights/${dataForMeta.slug}`,
      images: [
        {
          url: dataForMeta.imageUrl,
          width: 600,
          height: 400,
          alt: `A scenic view of ${dataForMeta.name}`,
        }
      ]
    }
  };
}

export async function generateStaticParams() {
  return sights.map((sight) => ({
    slug: sight.slug,
  }));
}

export default async function SightDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  let sight = sights.find((p) => p.slug === params.slug);
  let firestoreAttraction: any = null;

  if (!sight) {
    firestoreAttraction = await getFirestoreAttraction(params.slug);

    if (!firestoreAttraction) {
      notFound();
    }
  }

  const townForAttraction = firestoreAttraction ? towns.find(t => t.slug === firestoreAttraction.townSlug) : null;

  const data = sight
    ? {
        name: sight.name,
        description: sight.description,
        category: sight.category,
        location: sight.location,
        imageUrl:
          PlaceHolderImages.find(p => p.id === sight.imageId)?.imageUrl,
        mapLocation: sight.mapLocation,
        visitorInfo: sight.visitorInfo,
        provinceSlug: sight.provinceSlug,
        websiteUrl: undefined,
      }
    : {
        name: firestoreAttraction.name,
        description: firestoreAttraction.description,
        category: firestoreAttraction.category,
        location: townForAttraction?.name || firestoreAttraction.townSlug,
        imageUrl: firestoreAttraction.imageUrls?.[0] || '',
        mapLocation: firestoreAttraction.physicalAddress || `${firestoreAttraction.name}, ${townForAttraction?.name || firestoreAttraction.townSlug}, South Africa`,
        visitorInfo: {
          bestTime: "Contact venue",
          entryFee: "Varies",
          openingHours: "See website",
        },
        provinceSlug: townForAttraction?.provinceSlug || "",
        websiteUrl: firestoreAttraction.websiteUrl,
      };

  const province = provinces.find(p => p.slug === data.provinceSlug);
  // Only sights backed by a Firestore listing can be reviewed; the static guides aren't listings.
  const initialReviewPage = firestoreAttraction ? await getInitialReviews(firestoreAttraction.id) : null;
  const aggregateRating = firestoreAttraction ? buildAggregateRating(firestoreAttraction) : null;

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
        name: 'Sights',
        item: `${siteUrl}/sights`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: data.name,
        item: `${siteUrl}/sights/${params.slug}`,
      },
    ],
  };

  const attractionSchema = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: data.name,
    description: data.description,
    image: data.imageUrl,
    address: {
      '@type': 'PostalAddress',
      addressLocality: data.location,
      addressRegion: province?.name,
      addressCountry: 'ZA',
    },
    url: `${siteUrl}/sights/${params.slug}`,
    ...(aggregateRating ? { aggregateRating } : {}),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(attractionSchema) }} />
      <section className="relative h-[60vh] text-white">
        {data.imageUrl && (
          <Image
            src={data.imageUrl}
            alt={`Hero image of ${data.name}, a popular attraction in ${data.location}`}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
        <div className="relative z-10 flex h-full flex-col items-start justify-end p-8 md:p-16">
          <Badge variant="secondary" className="text-lg">
            <Translatable text={data.category} />
          </Badge>
          <h1 className="mt-4 text-4xl md:text-6xl font-bold font-headline">
            <Translatable text={data.name} />
          </h1>
          <div className="flex items-center text-xl mt-2">
            <MapPin className="w-5 h-5 mr-2" />
            <Translatable text={data.location} />
            {province && <>, <Translatable text={province.name} /></>}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
                <h2 className="font-headline text-3xl font-bold mb-4"><Translatable text={`About ${data.name}`} /></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                    <Translatable text={data.description} />
                </p>
            </div>
            <div className="space-y-4">
                <h3 className="font-headline text-2xl font-bold"><Translatable text="Visitor Info" /></h3>
                <div className="text-muted-foreground space-y-2">
                    <p><strong><Translatable text="Best time to visit:" /></strong> <Translatable text={data.visitorInfo.bestTime} /></p>
                    <p><strong><Translatable text="Entry Fee:" /></strong> <Translatable text={data.visitorInfo.entryFee} /></p>
                    <p><strong><Translatable text="Opening Hours:" /></strong> <Translatable text={data.visitorInfo.openingHours} /></p>
                    {data.websiteUrl && (
                      <p>
                        <strong><Translatable text="Website:" /></strong>{' '}
                        <a href={data.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <Translatable text="Visit Website" />
                        </a>
                      </p>
                    )}
                </div>
            </div>
        </div>
      </section>

      {data.mapLocation && (
        <section className="container mx-auto px-4 pb-16">
          <div className="max-w-4xl mx-auto">
              <h2 className="font-headline text-3xl font-bold mb-4"><Translatable text="Location" /></h2>
              <div className="aspect-video overflow-hidden rounded-lg">
                  <iframe 
                      src={getGoogleMapsEmbedUrl(data.mapLocation)}
                      width="100%" 
                      height="100%" 
                      style={{border:0}} 
                      allowFullScreen={false} 
                      loading="lazy" 
                      referrerPolicy="no-referrer-when-downgrade">
                  </iframe>
              </div>
          </div>
        </section>
      )}

      {firestoreAttraction && initialReviewPage && (
        <section className="container mx-auto px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <ListingReviews
              listing={{
                id: firestoreAttraction.id,
                name: firestoreAttraction.name,
                submittedBy: firestoreAttraction.submittedBy,
                ownerUid: firestoreAttraction.ownerUid,
                ratingAverage: firestoreAttraction.ratingAverage,
                ratingCount: firestoreAttraction.ratingCount,
                ratingBreakdown: firestoreAttraction.ratingBreakdown,
              }}
              listingType="attraction"
              initialPage={initialReviewPage}
            />
          </div>
        </section>
      )}
    </div>
  );
}
