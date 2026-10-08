
'use client';
 
import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ListingCard } from '@/components/listings/listing-card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AccessibleDialogContent } from "@/components/ui/AccessibleDialogContent";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
 
interface Listing {
  id: string;
  name: string;
  category?: string;
  townSlug?: string;
  description?: string;
  imageUrls?: string[];
  contactPhone?: string;
  contactEmail?: string;
  physicalAddress?: string;
  websiteUrl?: string;
  bookingSiteUrl?: string;
}
 
function formatTownName(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
 
// ── Image Carousel (used inside card AND modal) ────────────────────────────
function ImageCarousel({
  images,
  name,
  height = 'h-52',
  sizes,
}: {
  images: string[];
  name: string;
  height?: string;
  sizes: string;
}) {
  const [idx, setIdx] = useState(0);

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((current) => (current === 0 ? images.length - 1 : current - 1));
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((current) => (current === images.length - 1 ? 0 : current + 1));
  };
 
  if (!images || images.length === 0) {
    return (
      <div className={`w-full ${height} bg-muted flex items-center justify-center`}>
        <Building2 className="h-12 w-12 text-muted-foreground" />
      </div>
    );
  }
 
  return (
    <div className={`relative w-full ${height} overflow-hidden group`}>
      <Image
        src={images[idx]}
        alt={`${name} – photo ${idx + 1}`}
        fill
        sizes={sizes}
        className="object-cover transition-opacity duration-300"
      />
 
      {images.length > 1 && (
        <>
          {/* Prev / Next buttons */}
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
 
          {/* Dot indicators */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === idx ? 'bg-white scale-125' : 'bg-white/60'
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
 
          {/* Counter */}
          <span className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">
            {idx + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
}
 
// ── Detail Modal ────────────────────────────────────────────────────────────
function AccommodationModal({
  listing,
  open,
  onClose,
}: {
  listing: Listing | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!listing) return null;
 
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <AccessibleDialogContent
        title={listing.name}
        description={`Detailed information for ${listing.name}`}
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <ImageCarousel
          images={listing.imageUrls || []}
          name={listing.name}
          height="h-72"
          sizes="(max-width: 640px) 100vw, 640px"
        />

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {listing.category && (
            <Badge variant="secondary">{listing.category}</Badge>
          )}
          {listing.townSlug && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {formatTownName(listing.townSlug)}
            </span>
          )}
        </div>
 
        {/* Description */}
        {listing.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-4">
            {listing.description}
          </p>
        )}

        {/* Contact details */}
        <div className="space-y-2 pt-4 mt-4 border-t">
          <h4 className="font-semibold text-sm">Contact</h4>
          {listing.contactPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <a href={`tel:${listing.contactPhone}`} className="hover:underline">
                {listing.contactPhone}
              </a>
            </div>
          )}
          {listing.contactEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <a href={`mailto:${listing.contactEmail}`} className="hover:underline truncate">
                {listing.contactEmail}
              </a>
            </div>
          )}
          {listing.physicalAddress && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{listing.physicalAddress}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 pt-4 mt-4 border-t">
          {listing.websiteUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={listing.websiteUrl} target="_blank" rel="noopener noreferrer">
                <Globe className="h-4 w-4 mr-2" />
                Visit Website
              </a>
            </Button>
          )}
          {listing.bookingSiteUrl && (
            <Button asChild size="sm">
              <a href={listing.bookingSiteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Book Now
              </a>
            </Button>
          )}
          {listing.contactPhone && (
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${listing.contactPhone}`}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </a>
            </Button>
          )}
        </div>
      </AccessibleDialogContent>
    </Dialog>
  );
}
 
// ── Grid (exported) ─────────────────────────────────────────────────────────
// Cards share the Service Providers card layout; the image, title and
// "View details →" link open the modal below.
export function AccommodationGrid({ listings }: { listings: Listing[] }) {
  const [selected, setSelected] = useState<Listing | null>(null);

  return (
    <>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            categoryIcon={Building2}
            normalizeWebsiteUrl
            clampDescription
            onOpenDetails={() => setSelected(listing)}
          />
        ))}
      </div>
 
      <AccommodationModal
        listing={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
