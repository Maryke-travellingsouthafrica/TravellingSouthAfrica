import { Translatable } from '@/components/translatable';
import { sights as staticSights } from '@/lib/data/sights';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { MapPin, Mountain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Metadata } from 'next';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, getDocs, Timestamp } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import { towns } from '@/lib/data/towns';
import { RatingBadge } from '@/components/reviews/rating-stars';
import type { ListingRatingFields } from '@/lib/reviews';

function slugify(name: string) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://travellingsouthafrica.co.za';

interface Attraction extends ListingRatingFields {
  id: string;
  name: string;
  townSlug: string;
  category: string;
  description: string;
  physicalAddress?: string;
  websiteUrl?: string;
  contactEmail?: string;
  imageUrls: string[];
  approved: boolean;
  ownerUid: string;
  ownerEmail: string;
  createdAt: Timestamp;
}


export const metadata: Metadata = {
  title: 'Top Sights in South Africa | Travel SA | TravellingSA',
  description: 'Explore the must-see sights and attractions in South Africa with Travelling South Africa (Travel SA). Your guide to Table Mountain, Kruger Park, and more.',
  alternates: {
    canonical: '/sights',
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${siteUrl}/`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Sights',
      item: `${siteUrl}/sights`,
    },
  ],
};

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'South African Sights and Attractions',
  itemListElement: staticSights.map((sight, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'TouristAttraction',
      name: sight.name,
      url: `${siteUrl}/sights/${sight.slug}`,
      description: sight.description,
    },
  })),
};

async function getAttractions() {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const attractionsRef = collection(firestore, 'attractions');
    const q = query(attractionsRef);
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const plainObject = JSON.parse(JSON.stringify(data));
        return { id: doc.id, ...plainObject };
    }) as Attraction[];

  } catch (error) {
    console.error("Error fetching approved attractions:", error);
    return [];
  }
}

export default async function SightsPage() {
    const approvedAttractions = await getAttractions();
    
    const townNameMap = new Map(towns.map(t => [t.slug, t.name]));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <section className="relative bg-cover bg-center py-16 text-white" style={{ backgroundImage: "url('https://i.ibb.co/bj4CV8rW/578251416429199326767899.jpg')" }}>
        <div className="absolute inset-0 bg-black/50" />
        <div className="container relative mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold font-headline text-white md:text-5xl">
            <Translatable text="Sights to See" />
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-neutral-200">
            <Translatable text="From majestic mountains and sprawling national parks to vibrant cultural hubs, explore the attractions that make South Africa unforgettable." />
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                {staticSights.map((sight) => {
                    const image = PlaceHolderImages.find(p => p.id === sight.imageId);
                    const altText = `${sight.name}, a top tourist attraction in ${sight.location}, South Africa`;
                    return (
                        <Link href={`/sights/${sight.slug}`} key={sight.slug}>
                            <Card className="group overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 h-full">
                                <div className="relative h-64 w-full">
                                    {image && (
                                        <Image
                                            src={image.imageUrl}
                                            alt={altText}
                                            fill
                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                                            data-ai-hint={image.imageHint}
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-0 left-0 w-full p-4 text-white">
                                        <Badge variant="secondary"><Translatable text={sight.category} /></Badge>
                                        <h2 className="font-headline text-xl font-bold mt-2"><Translatable text={sight.name} /></h2>
                                        <p className="flex items-center mt-1">
                                            <MapPin className="w-4 h-4 mr-1" />
                                            <Translatable text={sight.location} />
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            {approvedAttractions.length > 0 && (
                <div className="mt-16">
                    <h2 className="mb-12 text-center text-3xl font-bold font-headline md:text-4xl">
                        <Translatable text="Featured Attractions" />
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                        {approvedAttractions.map((attraction) => {
                            const locationName = townNameMap.get(attraction.townSlug) || attraction.townSlug;
                            const altText = `${attraction.name}, an attraction in ${locationName}, South Africa`;
                            return (
                              <Link href={`/sights/${slugify(attraction.name)}`} key={attraction.id}>
                                    <Card className="group overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 h-full">
                                        <div className="relative h-64 w-full">
                                            {attraction.imageUrls && attraction.imageUrls.length > 0 ? (
                                                <Image
                                                    src={attraction.imageUrls[0]}
                                                    alt={altText}
                                                    fill
                                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center bg-muted">
                                                    <Mountain className="h-16 w-16 text-muted-foreground"/>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            <div className="absolute bottom-0 left-0 w-full p-4 text-white">
                                                <Badge variant="secondary"><Translatable text={attraction.category} /></Badge>
                                                <h2 className="font-headline text-xl font-bold mt-2"><Translatable text={attraction.name} /></h2>
                                                <RatingBadge listing={attraction} className="mt-1 flex" />
                                                <p className="flex items-center mt-1">
                                                    <MapPin className="w-4 h-4 mr-1" />
                                                    <Translatable text={locationName} />
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
      </section>
    </>
  );
}
