'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, ChevronLeft, ChevronRight, ExternalLink, Globe, Mail, MapPin, Phone, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { GetDirectionsButton } from '@/components/listings/get-directions-button';
import { ShareButton } from '@/components/listings/share-button';
import { withHttps } from '@/components/listings/listing-card';
import { cn } from '@/lib/utils';

// Action-row styling, local to this page: the global primary (#00BFFF) fails AA with white text (2.1:1).
// Brand navy #0F4C81 is taken from the logo wordmark; white on it is 8.9:1.
const ACTION_BASE =
  'h-auto min-h-11 rounded-lg px-3 sm:px-4 text-sm font-medium whitespace-normal text-center leading-tight sm:whitespace-nowrap transition-colors duration-150 [&_svg]:size-[18px] focus-visible:ring-[#0F4C81]';
const ACTION_PRIMARY =
  'border-0 bg-[#0F4C81] text-white hover:bg-[#0A3D75] active:bg-[#08305c]';
const ACTION_SECONDARY =
  'border border-[#0F4C81]/30 bg-white text-foreground hover:border-[#0F4C81]/50 hover:bg-[#0F4C81]/5 hover:text-foreground active:bg-[#0F4C81]/10 [&_svg]:text-[#0F4C81]';
const ACTION_GHOST =
  'border-transparent bg-transparent text-[#0F4C81] hover:bg-[#0F4C81]/10 hover:text-[#0F4C81] active:bg-[#0F4C81]/15';

type DetailListing = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  imageUrls?: string[];
  contactPhone?: string;
  contactEmail?: string;
  physicalAddress?: string;
  websiteUrl?: string;
  bookingSiteUrl?: string;
  [key: string]: any;
};

/** Public detail page body for an accommodation or service provider. Reuses the site's modal/card styling. */
export function ListingDetailView({
  listing,
  townName,
  backHref,
  backLabel,
  shareUrl,
}: {
  listing: DetailListing;
  townName?: string;
  backHref: string;
  backLabel: string;
  shareUrl: string;
}) {
  const images = (listing.imageUrls || []).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="bg-secondary/50">
      <div className="container mx-auto px-4 py-6 sm:py-10 max-w-3xl">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-4">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        <Card className="overflow-hidden bg-white">
          {/* Image gallery */}
          <div className="relative w-full aspect-[4/3] sm:aspect-video bg-muted">
            {images.length > 0 ? (
              <>
                <ImageWithFallback
                  src={images[idx]}
                  alt={`${listing.name} – photo ${idx + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                  priority
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      aria-label="Previous image"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      aria-label="Next image"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <span className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      {idx + 1} / {images.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 p-2 bg-gray-100 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={`relative shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
                    i === idx ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <ImageWithFallback src={img} alt={`Thumbnail ${i + 1}`} fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}

          <CardContent className="p-5 sm:p-8 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {listing.category && <Badge variant="secondary">{listing.category}</Badge>}
                {townName && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {townName}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold font-headline text-primary leading-tight break-words">{listing.name}</h1>
            </div>

            {listing.description && (
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line break-words">
                {listing.description}
              </p>
            )}

            {(listing.contactPhone || listing.contactEmail || listing.physicalAddress) && (
              <div className="space-y-3 pt-4 border-t">
                <h2 className="font-semibold text-sm">Contact</h2>
                {listing.contactPhone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-primary shrink-0" />
                    <a href={`tel:${listing.contactPhone}`} className="hover:underline">
                      {listing.contactPhone}
                    </a>
                  </div>
                )}
                {listing.contactEmail && (
                  <div className="flex items-center gap-3 text-sm min-w-0">
                    <Mail className="h-4 w-4 text-primary shrink-0" />
                    <a href={`mailto:${listing.contactEmail}`} className="hover:underline truncate">
                      {listing.contactEmail}
                    </a>
                  </div>
                )}
                {listing.physicalAddress && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground break-words">{listing.physicalAddress}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-4 border-t sm:flex sm:flex-wrap sm:items-center">
              {listing.bookingSiteUrl && (
                <Button asChild className={cn(ACTION_BASE, ACTION_PRIMARY, 'col-span-2 sm:col-auto')}>
                  <a href={withHttps(listing.bookingSiteUrl)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    Book Now
                  </a>
                </Button>
              )}
              {listing.websiteUrl && (
                <Button
                  asChild
                  variant={listing.bookingSiteUrl ? 'outline' : 'default'}
                  className={cn(
                    ACTION_BASE,
                    listing.bookingSiteUrl ? ACTION_SECONDARY : cn(ACTION_PRIMARY, 'col-span-2 sm:col-auto'),
                  )}
                >
                  <a href={withHttps(listing.websiteUrl)} target="_blank" rel="noopener noreferrer">
                    <Globe />
                    Website
                  </a>
                </Button>
              )}
              <GetDirectionsButton item={listing} className={cn(ACTION_BASE, ACTION_SECONDARY, '[&_svg]:mr-0')} />
              <Button asChild variant="outline" className={cn(ACTION_BASE, ACTION_SECONDARY)}>
                {/* Plan My Trip adds items to a saved trip chosen after login, so it can't preselect this one. */}
                <Link href="/plan-your-trip">
                  <Plus />
                  Add to Trip
                </Link>
              </Button>
              <span title="Share" className="flex">
                <ShareButton
                  iconOnly
                  url={shareUrl}
                  title={listing.name}
                  text={`${listing.name} on Travelling South Africa`}
                  className={cn(ACTION_BASE, ACTION_GHOST, 'w-full sm:w-11 px-0')}
                />
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
