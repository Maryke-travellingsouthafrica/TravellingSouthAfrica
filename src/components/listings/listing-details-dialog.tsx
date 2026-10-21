'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronLeft, ChevronRight, ExternalLink, Globe, Mail, MapPin, Phone, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { AccessibleDialogContent } from '@/components/ui/AccessibleDialogContent';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { GetDirectionsButton } from '@/components/listings/get-directions-button';
import { ShareButton } from '@/components/listings/share-button';
import { withHttps } from '@/components/listings/listing-card';
import { ACTION_BASE, ACTION_GHOST, ACTION_PRIMARY, ACTION_SECONDARY } from '@/components/listings/listing-action-styles';
import { getListingPath, getListingUrl, type ListingKind } from '@/lib/listing-links';
import { cn } from '@/lib/utils';

function formatTownName(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function ImageCarousel({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((current) => (current === 0 ? images.length - 1 : current - 1));
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((current) => (current === images.length - 1 ? 0 : current + 1));
  };

  return (
    <div className="relative w-full h-72 overflow-hidden group">
      <ImageWithFallback
        src={images[idx]}
        alt={`${name} – photo ${idx + 1}`}
        fill
        sizes="(max-width: 640px) 100vw, 640px"
        className="object-cover transition-opacity duration-300"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/60'}`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
          <span className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">
            {idx + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
}

/** Details popup shared by accommodation and service-provider cards. Empty sections are not rendered. */
export function ListingDetailsDialog({
  listing,
  kind,
  open,
  onClose,
}: {
  listing: any | null;
  kind: Exclude<ListingKind, 'event'>;
  open: boolean;
  onClose: () => void;
}) {
  if (!listing) return null;

  const images: string[] = (listing.imageUrls || []).filter(Boolean);
  const hasContact = listing.contactPhone || listing.contactEmail || listing.physicalAddress;
  const bookingUrl = listing.bookingSiteUrl;
  const websiteUrl = listing.websiteUrl;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <AccessibleDialogContent
        title={
          <Link href={getListingPath(kind, listing)} className="hover:underline">
            {listing.name}
          </Link>
        }
        description={`Detailed information for ${listing.name}`}
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        // The dialog is portalled, but React events still bubble to the card it was opened from.
        onClick={(e) => e.stopPropagation()}
      >
        {images.length > 0 ? (
          <ImageCarousel images={images} name={listing.name} />
        ) : (
          // Accommodation has always shown a placeholder; service providers omit the block.
          kind === 'accommodation' && (
            <div className="w-full h-72 bg-muted flex items-center justify-center">
              <Building2 className="h-12 w-12 text-muted-foreground" />
            </div>
          )
        )}

        {(listing.category || listing.townSlug) && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {listing.category && <Badge variant="secondary">{listing.category}</Badge>}
            {listing.townSlug && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {formatTownName(listing.townSlug)}
              </span>
            )}
          </div>
        )}

        {listing.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-4 whitespace-pre-line break-words">
            {listing.description}
          </p>
        )}

        {hasContact && (
          <div className="space-y-2 pt-4 mt-4 border-t">
            <h4 className="font-semibold text-sm">Contact</h4>
            {listing.contactPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <a href={`tel:${listing.contactPhone}`} className="hover:underline">{listing.contactPhone}</a>
              </div>
            )}
            {listing.contactEmail && (
              <div className="flex items-center gap-2 text-sm min-w-0">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a href={`mailto:${listing.contactEmail}`} className="hover:underline truncate">{listing.contactEmail}</a>
              </div>
            )}
            {listing.physicalAddress && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground break-words">{listing.physicalAddress}</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-4 mt-4 border-t sm:flex sm:flex-wrap sm:items-center">
          {bookingUrl && (
            <Button asChild className={cn(ACTION_BASE, ACTION_PRIMARY, 'col-span-2 sm:col-auto')}>
              <a href={withHttps(bookingUrl)} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Book Now
              </a>
            </Button>
          )}
          {websiteUrl && (
            <Button
              asChild
              variant={bookingUrl ? 'outline' : 'default'}
              className={cn(ACTION_BASE, bookingUrl ? ACTION_SECONDARY : cn(ACTION_PRIMARY, 'col-span-2 sm:col-auto'))}
            >
              <a href={withHttps(websiteUrl)} target="_blank" rel="noopener noreferrer">
                <Globe />
                Website
              </a>
            </Button>
          )}
          {listing.contactPhone && (
            <Button asChild variant="outline" className={cn(ACTION_BASE, ACTION_SECONDARY)}>
              <a href={`tel:${listing.contactPhone}`}>
                <Phone />
                Call
              </a>
            </Button>
          )}
          <GetDirectionsButton item={listing} className={cn(ACTION_BASE, ACTION_SECONDARY, '[&_svg]:mr-0')} />
          <Button asChild variant="outline" className={cn(ACTION_BASE, ACTION_SECONDARY)}>
            <Link href="/plan-your-trip">
              <Plus />
              Add to Trip
            </Link>
          </Button>
          <span title="Share" className="flex">
            <ShareButton
              iconOnly
              url={getListingUrl(kind, listing)}
              title={listing.name}
              text={`${listing.name} on Travelling South Africa`}
              className={cn(ACTION_BASE, ACTION_GHOST, 'w-full sm:w-11 px-0')}
            />
          </span>
        </div>
      </AccessibleDialogContent>
    </Dialog>
  );
}
