'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Translatable } from '@/components/translatable';
import { RatingBadge } from '@/components/reviews/rating-stars';
import { sights as staticSights } from '@/lib/data/sights';
import { PlaceHolderImages } from '@/lib/placeholder-images';

function slugify(name: string) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface TownSight {
  id: string;
  slug: string;
  name: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  ratingAverage?: number;
  ratingCount?: number;
}

export function TownSights({ townSlug, townName }: { townSlug: string; townName: string }) {
  const firestore = useFirestore();
  const [sights, setSights] = useState<TownSight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
    let cancelled = false;

    async function load() {
      try {
        const snapshot = await getDocs(
          query(
            collection(firestore, 'attractions'),
            where('townSlug', '==', townSlug),
            where('approved', '==', true)
          )
        );
        if (cancelled) return;

        const firestoreSights: TownSight[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            slug: slugify(data.name),
            name: data.name,
            category: data.category,
            description: data.description,
            imageUrl: data.imageUrls?.[0],
            ratingAverage: data.ratingAverage,
            ratingCount: data.ratingCount,
          };
        });

        const staticTownSights: TownSight[] = staticSights
          .filter((s) => s.location === townName)
          .map((s) => ({
            id: s.slug,
            slug: s.slug,
            name: s.name,
            category: s.category,
            description: s.description,
            imageUrl: PlaceHolderImages.find((p) => p.id === s.imageId)?.imageUrl,
          }));

        const combined = [...firestoreSights, ...staticTownSights];
        const unique = Array.from(new Map(combined.map((s) => [s.name.toLowerCase(), s])).values());

        setSights(unique);
      } catch (error) {
        console.error('Error fetching town sights:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [firestore, townSlug, townName]);

  // A town with no sights simply omits the section, the same way the Map
  // section below is skipped entirely when a town has no mapEmbed.
  if (!isLoading && sights.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 border-t pt-8">
      <h2 className="font-headline text-2xl font-bold mb-4">
        <Translatable text="Sights to See" />
      </h2>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sights.map((sight) => (
            <Link href={`/sights/${sight.slug}`} key={sight.id}>
              <Card className="group overflow-hidden transition-all hover:shadow-lg h-full">
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                  <ImageWithFallback
                    src={sight.imageUrl}
                    alt={`${sight.name}, a sight near ${townName}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <CardContent className="p-4 space-y-2">
                  {sight.category && (
                    <Badge variant="secondary"><Translatable text={sight.category} /></Badge>
                  )}
                  <h3 className="font-headline text-lg font-bold"><Translatable text={sight.name} /></h3>
                  <RatingBadge listing={sight} />
                  {sight.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{sight.description}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
