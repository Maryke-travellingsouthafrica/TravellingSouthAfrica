'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Star,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

/** Adds https:// to a stored URL that has no scheme, e.g. "www.example.co.za". */
export function withHttps(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;
}

type ListingCardProps = {
  listing: any;
  categoryIcon: React.ElementType;
  /** Decorative 5-star row beside the badge (Service Providers only). */
  showStars?: boolean;
  /** Prefix https:// onto website URLs stored without a scheme. */
  normalizeWebsiteUrl?: boolean;
  /** Clamp the description to 3 lines so cards in a row stay even. */
  clampDescription?: boolean;
  /** When set, the image and title open the details view and a "View details →" link is shown. */
  onOpenDetails?: () => void;
};

export function ListingCard({
  listing,
  categoryIcon: CategoryIcon,
  showStars = false,
  normalizeWebsiteUrl = false,
  clampDescription = false,
  onOpenDetails,
}: ListingCardProps) {
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

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.physicalAddress || `${listing.name}, ${listing.townSlug}`)}`;
  const websiteUrl = listing.websiteUrl && normalizeWebsiteUrl ? withHttps(listing.websiteUrl) : listing.websiteUrl;

  return (
    <Card className="flex flex-col overflow-hidden bg-white transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardHeader className="p-0">
        <div
          className={`relative group aspect-video${onOpenDetails ? ' cursor-pointer' : ''}`}
          onClick={onOpenDetails}
        >
          {images.length > 0 ? (
            <>
              <ImageWithFallback
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
      </CardHeader>
      <CardContent className="p-5 flex flex-col flex-1 space-y-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
              <div>
                <Badge variant="secondary" className="mb-2">
                    <CategoryIcon className="h-3 w-3 mr-1.5" />
                    {listing.category}
                </Badge>
                <h3 className="text-2xl font-bold text-primary leading-tight">
                  {onOpenDetails ? (
                    <button type="button" onClick={onOpenDetails} className="text-left hover:underline">
                      {listing.name}
                    </button>
                  ) : (
                    listing.name
                  )}
                </h3>
              </div>
              {showStars && (
                <div className="flex items-center gap-0.5 text-yellow-400 mt-1 shrink-0">
                    <Star className="h-4 w-4" />
                    <Star className="h-4 w-4" />
                    <Star className="h-4 w-4" />
                    <Star className="h-4 w-4" />
                    <Star className="h-4 w-4" />
                </div>
              )}
          </div>

          {listing.townSlug && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{listing.townSlug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
            </div>
          )}
        </div>

        {listing.description && (clampDescription ? (
          // The wrapper takes the flex-grow; a stretched <p> would show lines past the clamp.
          <div className="flex-grow">
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{listing.description}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed flex-grow">{listing.description}</p>
        ))}

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
          {websiteUrl && (
            <Button asChild className="w-full sm:w-auto flex-1">
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                <Globe className="h-4 w-4 mr-2" />
                Visit Website
              </a>
            </Button>
          )}
          {listing.physicalAddress && (
             <Button asChild variant="outline" className="w-full sm:w-auto flex-1">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Get Directions
              </a>
            </Button>
          )}
        </div>

        {onOpenDetails && (
          <button
            type="button"
            onClick={onOpenDetails}
            className="self-start text-sm text-primary font-medium hover:underline"
          >
            View details →
          </button>
        )}
      </CardContent>
    </Card>
  );
}
