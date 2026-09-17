import { provinces } from '@/lib/data/provinces';
import { towns as allTowns } from '@/lib/data/towns';
import { MAJOR_TOWNS } from '@/lib/data/major-towns';
import { sights as allSights } from '@/lib/data/sights';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Translatable } from '@/components/translatable';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { fetchTownPhotoMap, getServerFirestore, resolveTownImage } from '@/lib/town-image';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://travellingsouthafrica.co.za';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const province = provinces.find((p) => p.slug === params.slug);
  if (!province) {
    return {
      title: "Province Not Found",
      description: "The province you are looking for does not exist on Travelling South Africa.",
    };
  }

  const title = `${province.name} Travel Guide | Travelling South Africa | Travel SA`;
  const description = `Your complete travel guide to ${province.name} with Travelling South Africa (Travel SA). Discover the best towns, sights, and routes for your trip.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/provinces/${province.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/provinces/${province.slug}`,
      images: [
        {
          url: PlaceHolderImages.find(p => p.id === province.imageId)?.imageUrl || '',
          width: 600,
          height: 400,
          alt: `A scenic view of ${province.name}`,
        }
      ]
    }
  };
}

export async function generateStaticParams() {
  return provinces.map((province) => ({
    slug: province.slug,
  }));
}

export default async function ProvinceDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const province = provinces.find((p) => p.slug === params.slug);

  if (!province) {
    notFound();
  }

  const curatedSlugs = MAJOR_TOWNS[province.slug];
  const provinceTowns = curatedSlugs
    ? curatedSlugs
        .map((slug) => {
          const town = allTowns.find(t => t.slug === slug && t.provinceSlug === province.slug);
          if (!town && process.env.NODE_ENV !== 'production') {
            console.warn(`MAJOR_TOWNS['${province.slug}']: town slug "${slug}" not found in towns.ts — skipping`);
          }
          return town;
        })
        .filter((t): t is typeof allTowns[number] => Boolean(t))
        .slice(0, 10)
    : allTowns.filter(t => t.provinceSlug === province.slug).slice(0, 10);
  const provinceSights = allSights.filter(s => s.provinceSlug === province.slug).slice(0, 5);
  const townPhotos = await fetchTownPhotoMap(getServerFirestore());

  const heroImage = PlaceHolderImages.find((p) => p.id === province.imageId);

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
        name: 'Provinces',
        item: `${siteUrl}/provinces`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: province.name,
        item: `${siteUrl}/provinces/${province.slug}`,
      },
    ],
  };

  const provinceSchema = {
    '@context': 'https://schema.org',
    '@type': 'AdministrativeArea',
    name: province.name,
    description: province.description,
    image: heroImage?.imageUrl,
    containedInPlace: {
      '@type': 'Country',
      name: 'South Africa',
    },
    url: `${siteUrl}/provinces/${province.slug}`,
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(provinceSchema) }} />
      <section className="relative h-[50vh] text-white">
        {heroImage && (
          <Image
            src={heroImage.imageUrl}
            alt={`Hero image for ${province.name}, South Africa`}
            fill
            sizes="100vw"
            className="object-cover"
            priority
            data-ai-hint={heroImage.imageHint}
          />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
          <h1 className="text-5xl font-bold font-headline">
            <Translatable text={province.name} />
          </h1>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <p className="text-lg text-center text-muted-foreground">
            <Translatable text={province.description} />
          </p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">{province.keyFacts.capital}</p>
              <p className="text-muted-foreground"><Translatable text="Capital" /></p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">{province.keyFacts.area}</p>
              <p className="text-muted-foreground"><Translatable text="Area (km²)" /></p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">{province.keyFacts.population}</p>
              <p className="text-muted-foreground"><Translatable text="Population" /></p>
            </div>
             <div>
              <p className="text-3xl font-bold text-primary">{province.keyFacts.languages.split(',').length}</p>
              <p className="text-muted-foreground"><Translatable text="Languages" /></p>
            </div>
          </div>
        </div>
      </section>

      {provinceSights.length > 0 && (
        <section className="bg-secondary py-16 lg:py-24">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold font-headline md:text-4xl">
              <Translatable text={`Top Sights in ${province.name}`} />
            </h2>
            <Carousel opts={{ loop: true, align: 'start' }} className="w-full">
              <CarouselContent>
                {provinceSights.map((sight) => {
                  const image = PlaceHolderImages.find((p) => p.id === sight.imageId);
                  const altText = `${sight.name} - a popular tourist attraction in ${sight.location}, ${province.name}`;
                  return (
                    <CarouselItem key={sight.slug} className="md:basis-1/2 lg:basis-1/3">
                      <div className="p-1">
                        <Link href={`/sights/${sight.slug}`}>
                          <Card className="group overflow-hidden">
                            <CardContent className="p-0">
                              <div className="relative h-64">
                                {image && (
                                  <Image
                                    src={image.imageUrl}
                                    alt={altText}
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    data-ai-hint={image.imageHint}
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <div className="absolute bottom-0 left-0 p-6 text-white">
                                  <h3 className="text-2xl font-bold font-headline">
                                    <Translatable text={sight.name} />
                                  </h3>
                                  <div className="flex items-center mt-1">
                                    <MapPin className="w-4 h-4 mr-1" />
                                    <Translatable text={sight.location} />
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex" />
              <CarouselNext className="hidden sm:flex" />
            </Carousel>
          </div>
        </section>
      )}

      {provinceTowns.length > 0 && (
        <section className="py-16 lg:py-24">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold font-headline md:text-4xl">
              <Translatable text={`Major Towns in ${province.name}`} />
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {provinceTowns.map((town) => {
                    const { url: imageUrl, hint: imageHint } = resolveTownImage(town, townPhotos.get(town.slug));
                    const altText = `A view of ${town.name}, a town in the ${province.name} province`;
                    return (
                        <Link href={`/towns/${town.slug}`} key={town.slug}>
                            <Card className="group overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1">
                                {imageUrl && (
                                    <div className="relative h-40 w-full">
                                        <Image
                                            src={imageUrl}
                                            alt={altText}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                            data-ai-hint={imageHint}
                                        />
                                    </div>
                                )}
                                <CardContent className="p-4">
                                    <h3 className="font-headline text-xl font-bold"><Translatable text={town.name} /></h3>
                                    <p className="text-muted-foreground flex items-center mt-1">
                                        <Translatable text={province.name} />
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
