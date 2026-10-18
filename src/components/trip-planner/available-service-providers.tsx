'use client';
 
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getListingPath } from '@/lib/listing-links';
import {
  collection,
  query,
  where,
  getDocs,
  Firestore,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, MapPin, Phone, Mail, Globe, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Translatable } from '../translatable';
import { useToast } from '@/hooks/use-toast';
import { serviceCategoriesMap } from '@/lib/service-categories';
import { Dialog } from '@/components/ui/dialog';
import { GetDirectionsButton, actionRowClass } from '@/components/listings/get-directions-button';
import { AccessibleDialogContent } from '@/components/ui/AccessibleDialogContent';
 
interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  townSlug: string;
  description: string;
  imageUrls?: string[];
  contactPhone?: string;
  contactEmail?: string;
  physicalAddress?: string;
  websiteUrl?: string;
  bookingSiteUrl?: string;
}
 
interface AvailableServiceProvidersProps {
  selectedTrip: any;
  firestore: Firestore;
  onSave: (ids: string[]) => void;
}
 
const getCategoryIcon = (category: string) => {
  return serviceCategoriesMap[category]?.icon || Briefcase;
};
 
// ── Mini image carousel ──────────────────────────────────────────────────────
function MiniCarousel({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = React.useState(0);
 
  if (!images || images.length === 0) {
    return (
      <div className="w-full h-44 bg-muted flex items-center justify-center rounded-t-lg">
        <Briefcase className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }
 
  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((i) => (i - 1 + images.length) % images.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((i) => (i + 1) % images.length);
  };
 
  return (
    <div className="relative w-full h-44 overflow-hidden rounded-t-lg group">
      <img
        src={images[idx]}
        alt={`${name} photo ${idx + 1}`}
        className="w-full h-full object-cover transition-opacity duration-300"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            onClick={next}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/50'}`}
              />
            ))}
          </div>
          <span className="absolute top-1.5 right-1.5 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full z-10">
            {idx + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}
 
// ── Detail modal ─────────────────────────────────────────────────────────────
function ServiceProviderDetailModal({
  provider,
  isSelected,
  onToggle,
  onClose,
}: {
  provider: ServiceProvider;
  isSelected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = React.useState(0);
  const images = provider.imageUrls || [];
 
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); };
 
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <AccessibleDialogContent
        title={
          <Link href={getListingPath('service-provider', provider)} className="hover:underline">
            {provider.name}
          </Link>
        }
        description={`Details for ${provider.name}`}
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        {/* Image gallery */}
        <div className="relative w-full h-64 bg-muted overflow-hidden rounded-lg group -mt-2">
          {images.length > 0 ? (
            <>
              <img
                src={images[idx]}
                alt={`${provider.name} photo ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {images.map((_: string, i: number) => (
                      <button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                        className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                  <span className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">
                    {idx + 1} / {images.length}
                  </span>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Briefcase className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
 
        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 pt-3 overflow-x-auto">
            {images.map((url: string, i: number) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all ${i === idx ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
 
        {/* Content */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            {provider.category && (
              <span className="bg-secondary text-xs px-2 py-0.5 rounded-full">{provider.category}</span>
            )}
            {provider.townSlug && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {provider.townSlug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </span>
            )}
          </div>
 
          {provider.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{provider.description}</p>
          )}
 
          {/* Contact details */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
            {provider.contactPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <a href={`tel:${provider.contactPhone}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {provider.contactPhone}
                </a>
              </div>
            )}
            {provider.contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a href={`mailto:${provider.contactEmail}`} onClick={(e) => e.stopPropagation()} className="hover:underline truncate">
                  {provider.contactEmail}
                </a>
              </div>
            )}
            {provider.physicalAddress && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{provider.physicalAddress}</span>
              </div>
            )}
          </div>
 
          {/* Action buttons (four buttons wrap to 2×2 on small screens) */}
          <div className={actionRowClass(provider)}>
            <Button
              onClick={onToggle}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
            >
              {isSelected ? '✓ Selected' : '+ Add to Trip'}
            </Button>
            {provider.websiteUrl && (
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={provider.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <Globe className="h-3.5 w-3.5 mr-1.5" /> Website
                </a>
              </Button>
            )}
            <GetDirectionsButton item={provider} size="sm" className="flex-1" />
            {provider.bookingSiteUrl && (
              <Button asChild size="sm" className="flex-1">
                <a href={provider.bookingSiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Book Now
                </a>
              </Button>
            )}
          </div>
        </div>
      </AccessibleDialogContent>
    </Dialog>
  );
}
 
// ── Main component ────────────────────────────────────────────────────────────
export function AvailableServiceProviders({
  selectedTrip,
  firestore,
  onSave,
}: AvailableServiceProvidersProps) {
  const { toast } = useToast();
  const [availableProviders, setAvailableProviders] = useState<ServiceProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedTrip?.serviceProviderIds || []);
  const [detailProvider, setDetailProvider] = useState<ServiceProvider | null>(null);
  const [showAll, setShowAll] = useState(false);
 
  const townSlugs = useMemo(() => selectedTrip?.towns?.map((t: any) => t.slug) || [], [selectedTrip]);
 
  useEffect(() => {
    setSelectedIds(selectedTrip?.serviceProviderIds || []);
  }, [selectedTrip?.id, selectedTrip?.serviceProviderIds]);
 
  useEffect(() => {
    if (!townSlugs || townSlugs.length === 0) {
      setAvailableProviders([]);
      return;
    }
 
    const fetchProviders = async () => {
      setIsLoading(true);
      try {
        const providersRef = collection(firestore, 'service_providers');
        const q = query(
          providersRef,
          where('approved', '==', true),
          where('townSlug', 'in', townSlugs.slice(0, 10))
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as ServiceProvider[];
        setAvailableProviders(results);
      } catch (error) {
        console.error('Error fetching service providers:', error);
        toast({ variant: 'destructive', title: 'Error fetching service providers' });
      } finally {
        setIsLoading(false);
      }
    };
 
    fetchProviders();
  }, [firestore, townSlugs.join(','), toast]);
 
  const handleToggle = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    setSelectedIds(newIds);
    onSave(newIds);
    toast({
      title: selectedIds.includes(id) ? 'Service Provider Removed' : 'Service Provider Added',
      description: availableProviders.find(p => p.id === id)?.name,
    });
  };
 
  const displayedProviders = showAll ? availableProviders : availableProviders.slice(0, 4);
 
  return (
    <>
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-headline">
              <Translatable text="Service Providers" />
            </CardTitle>
          </div>
          {availableProviders.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading service providers...</p>
          )}
 
          {!isLoading && townSlugs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              <Translatable text="Add towns to your trip to see available service providers." />
            </p>
          )}
 
          {!isLoading && townSlugs.length > 0 && availableProviders.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No service providers found for your selected towns yet.
            </p>
          )}
 
          {!isLoading && availableProviders.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedProviders.map((provider) => {
                  const isSelected = selectedIds.includes(provider.id);
                  const CategoryIcon = getCategoryIcon(provider.category);
                  return (
                    <div
                      key={provider.id}
                      className={`rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40'
                      }`}
                    >
                      {/* Carousel — click opens detail */}
                      <div onClick={() => setDetailProvider(provider)}>
                        <MiniCarousel images={provider.imageUrls || []} name={provider.name} />
                      </div>
 
                      {/* Info */}
                      <div className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{provider.name}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {provider.category && (
                                <span className="text-xs bg-secondary px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <CategoryIcon className="h-2.5 w-2.5" />
                                  {provider.category}
                                </span>
                              )}
                              {provider.townSlug && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {provider.townSlug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="shrink-0 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                              ✓
                            </span>
                          )}
                        </div>
 
                        {provider.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {provider.description}
                          </p>
                        )}
 
                        {provider.contactPhone && (
                          <a
                            href={`tel:${provider.contactPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Phone className="h-2.5 w-2.5" /> {provider.contactPhone}
                          </a>
                        )}
 
                        {/* Action row */}
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleToggle(provider.id)}
                          >
                            {isSelected ? 'Remove' : '+ Select'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2"
                            onClick={() => setDetailProvider(provider)}
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
 
              {availableProviders.length > 4 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `Show ${availableProviders.length - 4} More`}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
 
      {/* Detail modal */}
      {detailProvider && (
        <ServiceProviderDetailModal
          provider={detailProvider}
          isSelected={selectedIds.includes(detailProvider.id)}
          onToggle={() => handleToggle(detailProvider.id)}
          onClose={() => setDetailProvider(null)}
        />
      )}
    </>
  );
}