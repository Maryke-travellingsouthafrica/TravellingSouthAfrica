'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  getDocs,
  Firestore,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Star,
  ChevronLeft,
  ChevronRight,
  Car,
  Users,
  Compass,
  Truck,
  Wifi,
  Utensils,
  Bed,
  Briefcase,
  Wrench
} from 'lucide-react';
import { GetDirectionsButton } from '@/components/listings/get-directions-button';
import { Skeleton } from '@/components/ui/skeleton';

const categoryIcons: { [key: string]: React.ElementType } = {
  'Car Hire': Car,
  'Tour Operator': Users,
  'Guide': Compass,
  'Transport': Truck,
  'Technology': Wifi,
  'Restaurant': Utensils,
  'Hotel': Bed,
  'Travel Agent': Briefcase,
  'General': Wrench,
};

async function getServiceProviders(firestore: Firestore, category?: string) {
  try {
    const ref = collection(firestore, 'service_providers');
    const q = category
      ? query(ref, where('category', '==', category))
      : query(ref);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
  } catch (error) {
    console.error('Error fetching service providers:', error);
    return [];
  }
}

export function ServiceProviderCard({ listing }: { listing: any }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const images = listing.imageUrls || [];

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  };

  const CategoryIcon = categoryIcons[listing.category] || Wrench;

  return (
    <Card className="flex flex-col overflow-hidden bg-white transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardHeader className="p-0">
        <div className="relative group aspect-video">
          {images.length > 0 ? (
            <>
              <Image
                src={images[currentIndex]}
                alt={`${listing.name} - image ${currentIndex + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
              />
              {images.length > 1 && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                   <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-xs bg-black/50 px-2 py-1 rounded-full">
                    {currentIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Building2 className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 p-2 bg-gray-100 overflow-x-auto">
            {images.map((img: string, idx: number) => (
              <button key={idx} onClick={() => setCurrentIndex(idx)} className={`relative shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${idx === currentIndex ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <Image src={img} alt={`Thumbnail ${idx + 1}`} fill sizes="5vw" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-5 flex flex-col flex-1 space-y-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
              <div>
                <Badge variant="secondary" className="mb-2">
                    <CategoryIcon className="h-3 w-3 mr-1.5" />
                    {listing.category}
                </Badge>
                <h3 className="text-2xl font-bold text-primary leading-tight">{listing.name}</h3>
              </div>
              <div className="flex items-center gap-0.5 text-yellow-400 mt-1 shrink-0">
                  <Star className="h-4 w-4" />
                  <Star className="h-4 w-4" />
                  <Star className="h-4 w-4" />
                  <Star className="h-4 w-4" />
                  <Star className="h-4 w-4" />
              </div>
          </div>

          {listing.townSlug && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{listing.townSlug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
            </div>
          )}
        </div>

        {listing.description && (
          <p className="text-sm text-muted-foreground leading-relaxed flex-grow">{listing.description}</p>
        )}
        
        <div className="pt-4 border-t space-y-3">
          {listing.physicalAddress && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <span>{listing.physicalAddress}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
              {listing.contactPhone && (
                <a href={`tel:${listing.contactPhone}`} className="flex items-center gap-3 text-sm hover:text-primary transition-colors">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{listing.contactPhone}</span>
                </a>
              )}
              {listing.contactEmail && (
                <a href={`mailto:${listing.contactEmail}`} className="flex items-center gap-3 text-sm hover:text-primary transition-colors truncate">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{listing.contactEmail}</span>
                </a>
              )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-4 mt-auto">
          {listing.websiteUrl && (
            <Button asChild className="w-full sm:w-auto flex-1">
              <a href={listing.websiteUrl} target="_blank" rel="noopener noreferrer">
                <Globe className="h-4 w-4 mr-2" />
                Visit Website
              </a>
            </Button>
          )}
          {listing.physicalAddress && (
            <GetDirectionsButton item={listing} className="w-full sm:w-auto flex-1" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ServiceProviderListings({
  category,
  title,
  description,
  addListingHref = '/add-your-listing',
}: {
  category?: string;
  title: string;
  description: string;
  addListingHref?: string;
}) {
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

    setIsLoading(true);
    getServiceProviders(firestore, category).then(data => {
      setListings(data);
      setIsLoading(false);
    });
  }, [firestore, category]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Skeleton className="h-10 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto mt-4" />
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
             <Card key={i} className="animate-pulse">
                <CardHeader className="p-0">
                  <Skeleton className="w-full aspect-video rounded-t-lg"/>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-5 w-2/4"/>
                    <Skeleton className="h-4 w-1/3"/>
                    <Skeleton className="h-12 w-full"/>
                </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-secondary/50">
        <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-bold font-headline text-primary">{title}</h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{description}</p>
        </div>

        {listings.length > 0 ? (
            <>
            <p className="text-sm text-muted-foreground mb-6">
                {listings.length} {listings.length === 1 ? 'listing' : 'listings'} found
            </p>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {listings.map(listing => (
                  <ServiceProviderCard key={listing.id} listing={listing} />
                ))}
            </div>
            </>
        ) : (
            <div className="text-center py-16 max-w-lg mx-auto">
              <Card>
                <CardContent className="p-10">
                    <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold">No Listings Yet</h3>
                    <p className="text-lg text-muted-foreground mb-6 mt-2">
                      Be the first to showcase your service in the "{title}" category. Your listing could be the first one travelers see!
                    </p>
                    <Button asChild>
                      <Link href={addListingHref}>
                        List Your Service Now
                      </Link>
                    </Button>
                </CardContent>
              </Card>
            </div>
        )}
        </div>
    </div>
  );
}
