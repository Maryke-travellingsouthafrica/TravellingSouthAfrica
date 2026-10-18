
// @ts-nocheck
'use client';

import { useAccommodationsForTowns } from '@/firebase/firestore/use-accommodations';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { WithId } from '@/firebase/firestore/use-collection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, MapPin, Mountain, Bed, Trash2, Download, Sparkles, Car, ArrowRightLeft, ArrowUp, ArrowDown, ExternalLink, Route, Minus, X } from 'lucide-react';
import { Translatable } from '../translatable';
import { format } from 'date-fns';
import { AddToTripDialog } from './add-to-trip-dialog';
import Link from 'next/link';
import { Phone, Mail, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { GetDirectionsButton, actionRowClass } from '@/components/listings/get-directions-button';

import { provinces } from '@/lib/data/provinces';
import { towns } from '@/lib/data/towns';
import { routes } from '@/lib/data/routes';
import { sights } from '@/lib/data/sights';
import { PlaceHolderImages } from '@/lib/placeholder-images';


import { createTrip, updateTripItems, type TripTown, updateTripTowns } from '@/firebase/firestore/trips';
import { AccessibleDialogContent } from "@/components/ui/AccessibleDialogContent";
import { Dialog, DialogHeader } from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarInset,
  SidebarMenuAction,
} from '@/components/ui/sidebar';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError, errorEmitter } from '@/firebase';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import jsPDF from 'jspdf';
import { Textarea } from '../ui/textarea';
import { PlanTripHero } from './page-hero';
import { TripCreatorBar } from './trip-creator-bar';
import { useIsMobile } from '@/hooks/use-mobile';
import { AvailableServiceProviders } from './available-service-providers';


interface Trip {
  name: string;
  towns?: TripTown[];
  sightIds?: string[];
  accommodationIds?: string[];
  serviceProviderIds?: string[];
  createdAt?: { seconds: number; nanoseconds: number };
}

type DialogState = {
  isOpen: boolean;
  type: 'town' | null;
}

const findTownSlug = (name: string, allTowns: { slug: string, name: string }[]) => {
    const cleanName = name.split('(')[0].trim().toLowerCase();
    const town = allTowns.find(t => t.name.toLowerCase().startsWith(cleanName));
    return town?.slug;
};

const nationalRoutesList = ['N1', 'N10', 'N11', 'N12', 'N14', 'N17', 'N18', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9'];

const n1DetailedRouteFromUser = [
    { town: 'Beitbridge / Musina', distance: 19, cumulative: 19 },
    { town: 'Polokwane', distance: 201, cumulative: 220 },
    { town: 'Pretoria', distance: 47, cumulative: 267 },
    { town: 'Centurion', distance: 26, cumulative: 293 },
    { town: 'Midrand', distance: 19, cumulative: 312 },
    { town: 'Johannesburg', distance: 27, cumulative: 339 },
    { town: 'Lenasia', distance: 35, cumulative: 374 },
    { town: 'Vanderbijlpark', distance: 53, cumulative: 427 },
    { town: 'Vaal River', distance: 10, cumulative: 437 },
    { town: 'Kroonstad', distance: 121, cumulative: 558 },
    { town: 'Ventersburg', distance: 52, cumulative: 610 },
    { town: 'Bloemfontein', distance: 116, cumulative: 726 },
    { town: 'Colesberg', distance: 113, cumulative: 839 },
    { town: 'Hanover', distance: 75, cumulative: 914 },
    { town: 'Beaufort West', distance: 241, cumulative: 1155 },
    { town: 'Laingsburg', distance: 199, cumulative: 1354 },
    { town: 'Matjiesfontein', distance: 29, cumulative: 1383 },
    { town: 'Touws River', distance: 56, cumulative: 1439 },
    { town: 'De Doorns', distance: 44, cumulative: 1483 },
    { town: 'Worcester', distance: 33, cumulative: 1516 },
    { town: 'Paarl', distance: 59, cumulative: 1575 },
    { town: 'Cape Town', distance: 62, cumulative: 1637 },
];

const summaryRoutesData = [
  { name: 'N1', towns: ['Polokwane', 'Pretoria', 'Johannesburg', 'Bloemfontein', 'Cape Town'] },
  { name: 'N2', towns: ['Durban', 'Mthatha', 'East London', 'Port Elizabeth', 'Cape Town'] },
  { name: 'N3', towns: ['Johannesburg', 'Pietermaritzburg', 'Durban'] },
  { name: 'N4', towns: ['Pretoria', 'Mbombela'] },
  { name: 'N5', towns: ['Harrismith'] },
  { name: 'N6', towns: ['East London', 'Bloemfontein'] },
  { name: 'N7', towns: ['Cape Town', 'Springbok', 'Vioolsdrif'] },
  { name: 'N8', towns: ['Groblershoop', 'Kimberley', 'Bloemfontein', 'Ladybrand'] },
  { name: 'N9', towns: ['George', 'Graaff-Reinet', 'Middelburg', 'Colesberg'] },
  { name: 'N10', towns: ['Port Elizabeth', 'Middelburg', 'Upington', 'Nakop border control'] },
  { name: 'N11', towns: ['Groblersbrug', 'Mokopane', 'Middelburg', 'Ermelo', 'Newcastle', 'Ladysmith'] },
  { name: 'N12', towns: ['George', 'Oudtshoorn', 'Victoria West', 'Kimberley', 'Potchefstroom', 'Johannesburg', 'eMalahleni (Witbank)'] },
  { name: 'N14', towns: ['Springbok', 'Upington', 'Krugersdorp', 'Pretoria'] },
  { name: 'N17', towns: ['Johannesburg', 'Springs', 'Evander', 'Ermelo', 'Swaziland border'] },
  { name: 'N18', towns: ['Warrenton', 'Vryburg', 'Mahikeng', 'Miga'] },
];

const SummaryRoute = ({ routeName, townNames, onSelectRoute }: { routeName: string, townNames: string[], onSelectRoute: (slug: string) => void }) => {
    const routeSlug = `${routeName.toLowerCase()}-route`;
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <Button variant="link" className="p-0 h-auto font-bold text-sm" onClick={() => onSelectRoute(routeSlug)}>
                {routeName}
            </Button>
            <div className="flex flex-wrap gap-x-2">
                {townNames.map((townName, index) => {
                    const townSlug = findTownSlug(townName, towns);
                    return (
                        <React.Fragment key={townName}>
                            {townSlug ? (
                                <Link href={`/towns/${townSlug}`} className="underline hover:text-primary text-sm" target="_blank">
                                    <Translatable text={townName} />
                                </Link>
                            ) : (
                                <span className="text-sm"><Translatable text={townName} /></span>
                            )}
                            {index < townNames.length - 1 && ','}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

const NationalRoadsGuide = ({ onSelectRoute }: { onSelectRoute: (slug: string) => void }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl"><Translatable text="National Roads – Quick Route Planning" /></CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-4">
                <p><Translatable text="This shows you the routes you can follow on the country's 15 national roads" /></p>

                <p className="font-bold"><Translatable text="South African National Roads:" /></p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {nationalRoutesList.sort().map(r => (
                        <Button key={r} variant="link" className="p-0 h-auto" onClick={() => onSelectRoute(`${r.toLowerCase()}-route`)}>
                            {r}
                        </Button>
                    ))}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                    <h3 className="font-bold text-foreground mb-2"><Translatable text="N1 Detailed route" /></h3>
                     <div className="font-mono text-xs bg-muted/50 p-4 rounded-lg text-foreground overflow-x-auto">
                        <div className="grid grid-cols-3 font-bold border-b pb-1 mb-1 min-w-[300px]">
                            <span><Translatable text="Town" /></span>
                            <span className="text-right"><Translatable text="Distance" /></span>
                            <span className="text-right"><Translatable text="Cumulative" /></span>
                        </div>
                        <div className="min-w-[300px]">
                            {n1DetailedRouteFromUser.map((item, index) => (
                               <div key={index} className="grid grid-cols-3">
                                   <span><Translatable text={item.town} /></span>
                                   <span className="text-right">{item.distance}</span>
                                   <span className="text-right">{item.cumulative}</span>
                               </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                    <p className="font-bold text-foreground"><Translatable text="Summary routes" /></p>
                    <p><Translatable text="Click on route number (eg N1) for a detailed listing or on a town for details about the town" />.</p>
                    <div className="space-y-2 mt-2">
                        {summaryRoutesData.map(route => (
                            <SummaryRoute key={route.name} routeName={route.name} townNames={route.towns} onSelectRoute={onSelectRoute} />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// ── Mini image carousel for use inside the card list ────────────────────────
function MiniCarousel({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = React.useState(0);
 
  if (!images || images.length === 0) {
    return (
      <div className="w-full h-44 bg-muted flex items-center justify-center rounded-t-lg">
        <Bed className="h-10 w-10 text-muted-foreground" />
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
 
// ── Full detail modal ────────────────────────────────────────────────────────
function AccommodationDetailModal({
  accommodation,
  isSelected,
  onToggle,
  onClose,
}: {
  accommodation: any;
  isSelected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = React.useState(0);
  const images = accommodation.imageUrls || [];
 
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); };
 
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <AccessibleDialogContent
        title={accommodation.name}
        description={`Details for ${accommodation.name}`}
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image gallery */}
        <div className="relative w-full h-64 bg-muted overflow-hidden rounded-lg group -mt-2">
          {images.length > 0 ? (
            <>
              <img
                src={images[idx]}
                alt={`${accommodation.name} photo ${idx + 1}`}
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
              <Bed className="h-16 w-16 text-muted-foreground" />
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
              {accommodation.category && (
                <span className="bg-secondary text-xs px-2 py-0.5 rounded-full">{accommodation.category}</span>
              )}
              {accommodation.townSlug && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {accommodation.townSlug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
              )}
            </div>
 
          {/* Description */}
          {accommodation.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{accommodation.description}</p>
          )}
 
          {/* Contact details */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
            {accommodation.contactPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <a href={`tel:${accommodation.contactPhone}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {accommodation.contactPhone}
                </a>
              </div>
            )}
            {accommodation.contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a href={`mailto:${accommodation.contactEmail}`} onClick={(e) => e.stopPropagation()} className="hover:underline truncate">
                  {accommodation.contactEmail}
                </a>
              </div>
            )}
            {accommodation.physicalAddress && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{accommodation.physicalAddress}</span>
              </div>
            )}
          </div>
 
          {/* Action buttons (four buttons wrap to 2×2 on small screens) */}
          <div className={actionRowClass(accommodation)}>
            <Button
              onClick={onToggle}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
            >
              {isSelected ? '✓ Selected' : '+ Add to Trip'}
            </Button>
            {accommodation.websiteUrl && (
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={accommodation.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <Globe className="h-3.5 w-3.5 mr-1.5" /> Website
                </a>
              </Button>
            )}
            <GetDirectionsButton item={accommodation} size="sm" className="flex-1" />
            {accommodation.bookingSiteUrl && (
              <Button asChild size="sm" className="flex-1">
                <a href={accommodation.bookingSiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
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
 
// ── Main AccommodationCard component ────────────────────────────────────────
function AccommodationCard({
  selectedTrip,
  firestore,
  onSave,
  onAccommodationsLoaded,
  toast,
}: {
  selectedTrip: any;
  firestore: any;
  onSave: (ids: string[]) => void;
  onAccommodationsLoaded: (accommodations: any[]) => void;
  toast: any;
}) {
  const townSlugs = selectedTrip?.towns?.map((t: any) => t.slug) || [];
  const { accommodations, isLoading } = useAccommodationsForTowns(firestore, townSlugs);
 
  useEffect(() => {
    if (accommodations) {
      onAccommodationsLoaded(accommodations);
    }
  }, [accommodations, onAccommodationsLoaded]);
 
  const [selectedIds, setSelectedIds] = React.useState<string[]>(
    selectedTrip?.accommodationIds || []
  );
  const [showAll, setShowAll] = React.useState(false);
  const [detailAccommodation, setDetailAccommodation] = React.useState<any | null>(null);
 
  useEffect(() => {
    setSelectedIds(selectedTrip?.accommodationIds || []);
  }, [selectedTrip?.id, selectedTrip?.accommodationIds]);
 
  const handleToggle = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    setSelectedIds(newIds);
    onSave(newIds);
    toast({
      title: selectedIds.includes(id) ? 'Accommodation Removed' : 'Accommodation Added',
      description: accommodations.find((a: any) => a.id === id)?.name,
    });
  };
 
  const displayedAccommodations = showAll ? accommodations : accommodations.slice(0, 4);
 
  return (
    <>
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Bed className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-headline">
              <Translatable text="Accommodation" />
            </CardTitle>
          </div>
          {accommodations && accommodations.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading accommodations...</p>
          )}
 
          {!isLoading && townSlugs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              <Translatable text="Add towns to your trip to see available accommodations." />
            </p>
          )}
 
          {!isLoading && townSlugs.length > 0 && accommodations && accommodations.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p><Translatable text="No approved accommodations found for your selected towns yet." /></p>
              <Button asChild variant="outline" size="sm">
                <Link href="/add-your-listing" target="_blank">
                  <PlusCircle className="mr-2 h-3 w-3" /> Add a Listing
                </Link>
              </Button>
            </div>
          )}
 
          {!isLoading && accommodations && accommodations.length > 0 && (
            <>
              {/* Card grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedAccommodations.map((accommodation: any) => {
                  const isSelected = selectedIds.includes(accommodation.id);
                  return (
                    <div
                      key={accommodation.id}
                      className={`rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40'
                      }`}
                    >
                      {/* Image carousel — click opens detail */}
                      <div onClick={() => setDetailAccommodation(accommodation)}>
                        <MiniCarousel images={accommodation.imageUrls || []} name={accommodation.name} />
                      </div>
 
                      {/* Info */}
                      <div className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{accommodation.name}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {accommodation.category && (
                                <span className="text-xs bg-secondary px-1.5 py-0.5 rounded-full">
                                  {accommodation.category}
                                </span>
                              )}
                              {accommodation.townSlug && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {accommodation.townSlug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
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
 
                        {accommodation.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {accommodation.description}
                          </p>
                        )}
 
                        {accommodation.contactPhone && (
                          <a
                            href={`tel:${accommodation.contactPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Phone className="h-2.5 w-2.5" /> {accommodation.contactPhone}
                          </a>
                        )}
 
                        {/* Action row */}
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleToggle(accommodation.id)}
                          >
                            {isSelected ? 'Remove' : '+ Select'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2"
                            onClick={() => setDetailAccommodation(accommodation)}
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
 
              {accommodations.length > 4 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `Show ${accommodations.length - 4} More`}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
 
      {/* Detail modal */}
      {detailAccommodation && (
        <AccommodationDetailModal
          accommodation={detailAccommodation}
          isSelected={selectedIds.includes(detailAccommodation.id)}
          onToggle={() => handleToggle(detailAccommodation.id)}
          onClose={() => setDetailAccommodation(null)}
        />
      )}
    </>
  );
}


// ── Sight detail modal ───────────────────────────────────────────────────────
function SightDetailModal({
  sight,
  isSelected,
  onToggle,
  onClose,
}: {
  sight: any;
  isSelected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = React.useState(0);
  const images = sight.imageUrls || [];

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <AccessibleDialogContent
        title={sight.name}
        description={`Details for ${sight.name}`}
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image gallery */}
        <div className="relative w-full h-64 bg-muted overflow-hidden rounded-lg group -mt-2">
          {images.length > 0 ? (
            <>
              <img
                src={images[idx]}
                alt={`${sight.name} photo ${idx + 1}`}
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
              <Mountain className="h-16 w-16 text-muted-foreground" />
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
            {sight.category && (
              <span className="bg-secondary text-xs px-2 py-0.5 rounded-full">{sight.category}</span>
            )}
            {sight.townSlug && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {sight.townSlug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </span>
            )}
          </div>

          {sight.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{sight.description}</p>
          )}

          {sight.physicalAddress && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{sight.physicalAddress}</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              onClick={onToggle}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
            >
              {isSelected ? '✓ Selected' : '+ Add to Trip'}
            </Button>
            {sight.websiteUrl && (
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={sight.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <Globe className="h-3.5 w-3.5 mr-1.5" /> Website
                </a>
              </Button>
            )}
            <GetDirectionsButton item={sight} size="sm" className="flex-1" />
          </div>
        </div>
      </AccessibleDialogContent>
    </Dialog>
  );
}

// SIGHTS CARD
function AvailableSights({
  selectedTrip,
  firestore,
  onSave,
  toast,
}: {
  selectedTrip: any;
  firestore: any;
  onSave: (ids: string[]) => void;
  toast: any;
}) {
  const townSlugs = useMemo(() => selectedTrip?.towns?.map((t: any) => t.slug) || [], [selectedTrip]);
  const [availableSights, setAvailableSights] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!townSlugs || townSlugs.length === 0) {
      setAvailableSights([]);
      return;
    }

    const fetchSights = async () => {
      setIsLoading(true);
      try {
        // Fetch from Firestore 'attractions'
        const attractionsRef = collection(firestore, 'attractions');
        const q = query(
          attractionsRef,
          where('approved', '==', true),
          where('townSlug', 'in', townSlugs.slice(0, 10))
        );
        const snapshot = await getDocs(q);
        const firestoreSights = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            slug: doc.id,
            name: data.name,
            category: data.category,
            townSlug: data.townSlug,
            imageUrls: data.imageUrls || [],
            description: data.description,
            websiteUrl: data.websiteUrl,
            physicalAddress: data.physicalAddress,
          };
        });

        // Filter static sights
        const townMap = new Map(towns.map(t => [t.slug, t.name]));
        const selectedTownNames = new Set(townSlugs.map((slug: string) => townMap.get(slug)).filter(Boolean));
        const staticSightsResults = sights
          .filter(s => selectedTownNames.has(s.location))
          .map(s => {
            const image = PlaceHolderImages.find(p => p.id === s.imageId);
            return {
              id: s.slug,
              slug: s.slug,
              name: s.name,
              category: s.category,
              townSlug: towns.find(t => t.name === s.location)?.slug || '',
              imageUrls: image ? [image.imageUrl] : [],
              description: s.description,
              mapLocation: s.mapLocation,
            };
          });

        const combinedSights = [...firestoreSights, ...staticSightsResults];
        const uniqueSights = Array.from(new Map(combinedSights.map(s => [s.name.toLowerCase(), s])).values());
        setAvailableSights(uniqueSights);
      } catch (error) {
        console.error("Error fetching sights:", error);
        toast({
          variant: "destructive",
          title: "Error fetching sights",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSights();
  }, [firestore, townSlugs.join(','), toast]);

  const [selectedIds, setSelectedIds] = useState<string[]>(selectedTrip?.sightIds || []);
  const [showAll, setShowAll] = useState(false);
  const [detailSight, setDetailSight] = useState<any | null>(null);

  useEffect(() => {
    setSelectedIds(selectedTrip?.sightIds || []);
  }, [selectedTrip?.id, selectedTrip?.sightIds]);

  const handleToggle = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    setSelectedIds(newIds);
    onSave(newIds);
    toast({
      title: selectedIds.includes(id) ? 'Sight Removed' : 'Sight Added',
      description: availableSights.find(s => s.id === id)?.name,
    });
  };

  const townNameMap = useMemo(() => new Map(towns.map(t => [t.slug, t.name])), []);
  const displayedSights = showAll ? availableSights : availableSights.slice(0, 4);

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Mountain className="h-6 w-6 text-primary" />
          <CardTitle className="text-xl font-headline">
            <Translatable text="Sights" />
          </CardTitle>
        </div>
         {availableSights.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </span>
          )}
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading sights...</p>}
        {!isLoading && townSlugs.length === 0 && (
          <p className="text-sm text-muted-foreground">Add towns to see available sights.</p>
        )}
        {!isLoading && townSlugs.length > 0 && availableSights.length === 0 && (
          <p className="text-sm text-muted-foreground">No sights found for your selected towns.</p>
        )}
        {!isLoading && availableSights.length > 0 && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayedSights.map((sight) => {
              const isSelected = selectedIds.includes(sight.id);
              return (
                <div
                  key={sight.id}
                  className={`rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40'
                  }`}
                >
                  {/* Image carousel — click opens detail */}
                  <div onClick={() => setDetailSight(sight)}>
                    <MiniCarousel images={sight.imageUrls || []} name={sight.name} />
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{sight.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {sight.category && (
                            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded-full">
                              {sight.category}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {townNameMap.get(sight.townSlug) || sight.townSlug}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="shrink-0 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                          ✓
                        </span>
                      )}
                    </div>

                    {sight.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {sight.description}
                      </p>
                    )}

                    {/* Action row */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleToggle(sight.id)}
                      >
                        {isSelected ? 'Remove' : '+ Select'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2"
                        onClick={() => setDetailSight(sight)}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {availableSights.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-4"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show Less' : `Show ${availableSights.length - 4} More`}
            </Button>
          )}
          </>
        )}
      </CardContent>
    </Card>

    {/* Detail modal */}
    {detailSight && (
      <SightDetailModal
        sight={detailSight}
        isSelected={selectedIds.includes(detailSight.id)}
        onToggle={() => handleToggle(detailSight.id)}
        onClose={() => setDetailSight(null)}
      />
    )}
    </>
  );
}


export function TripPlanner({ user }: { user: User }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const tripsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, `users/${user.uid}/trips`);
  }, [firestore, user]);
  
  const { data: trips, isLoading: tripsLoading } = useCollection<Trip>(tripsQuery);
  
  const [selectedTrip, setSelectedTrip] = useState<WithId<Trip> | null>(null);
  
  const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false, type: null });

  const [tripAccommodations, setTripAccommodations] = useState<any[]>([]);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const tripIdFromQuery = searchParams.get('tripId');

  const handleMinimizeTrip = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tripId');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  useEffect(() => {
    if (tripsLoading) {
      return; // Wait until trips are loaded
    }
  
    if (tripIdFromQuery) {
      const tripFromQuery = trips?.find((t) => t.id === tripIdFromQuery);
      if (tripFromQuery) {
        setSelectedTrip(tripFromQuery);
      } else if (trips) {
        // If the tripId in the URL doesn't match any loaded trip (and trips are loaded), clear the URL
        handleMinimizeTrip();
      }
    } else {
      // If there's no tripId in the URL, no trip should be selected
      setSelectedTrip(null);
    }
  }, [tripIdFromQuery, trips, tripsLoading, handleMinimizeTrip]);
  

  const handleSelectTrip = (trip: WithId<Trip>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tripId', trip.id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleCreateTrip = (name: string, routeSlug?: string, reverse?: boolean) => {
    let initialTowns: TripTown[] = [];
    if (routeSlug) {
        const routeData = routes.find(r => r.slug === routeSlug);
        if (routeData) {
            let townSlugs = routeData.townSlugs;
            if (reverse) {
                townSlugs = [...townSlugs].reverse();
            }
            initialTowns = townSlugs.map(slug => ({ slug, notes: '' }));
        }
    }

    createTrip(firestore, {
      name: name,
      userId: user.uid,
      towns: initialTowns,
    });
    toast({
        title: "Trip Created!",
        description: `Your trip "${name}" has been created.`,
    });
  };

  const handleSelectRouteForCreation = (routeSlug: string) => {
    const routeData = routes.find(r => r.slug === routeSlug);
    if(routeData) {
        handleCreateTrip(routeData.name, routeSlug, false);
        toast({
          title: "Trip Created from Route!",
          description: `A new trip "${routeData.name}" has been created for you.`,
      });
    }
  };

  const handleTownsSave = (selectedSlugs: string[]) => {
    if (!selectedTrip) return;
    const currentTowns = selectedTrip.towns || [];
    const newTowns: TripTown[] = selectedSlugs.map(slug => {
        return currentTowns.find(t => t.slug === slug) || { slug, notes: '' };
    });
    
    updateTripTowns(firestore, user.uid, selectedTrip.id, newTowns);
    
    toast({
        title: "Itinerary Updated!",
        description: `Towns in "${selectedTrip.name}" have been updated.`,
    });
  };


  const handleItemsSave = (itemType: 'sightIds' | 'accommodationIds' | 'serviceProviderIds', selectedSlugs: string[]) => {
    if (!selectedTrip) return;

    updateTripItems(firestore, user.uid, selectedTrip.id, itemType, selectedSlugs);
    
    toast({
        title: "Itinerary Updated!",
        description: `Your trip "${selectedTrip.name}" has been updated.`,
    });
  };

  const handleDeleteTrip = (tripId: string) => {
    
    const tripDocRef = doc(firestore, `users/${user.uid}/trips`, tripId);
    
    deleteDoc(tripDocRef)
      .then(() => {
        toast({
            title: "Trip Deleted",
            description: "Your trip has been successfully deleted.",
        });
        if (tripId === tripIdFromQuery) {
          handleMinimizeTrip();
        }
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: tripDocRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);

        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "Could not delete trip. You may not have permission.",
        });
    });
  }
  const handleDownloadPdf = async () => {
    if (!selectedTrip) {
        toast({
            variant: "destructive",
            title: "Download Failed",
            description: "No trip selected.",
        });
        return;
    }

    let serviceProvidersData: any[] = [];
    if (selectedTrip.serviceProviderIds && selectedTrip.serviceProviderIds.length > 0) {
        const providersRef = collection(firestore, 'service_providers');
        const q = query(providersRef, where('__name__', 'in', selectedTrip.serviceProviderIds.slice(0, 10)));
        const snapshot = await getDocs(q);
        serviceProvidersData = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    }

    // Sights added from the trip planner can come from either the static sights
    // data (slug id) or the Firestore `attractions` collection (doc id) — the
    // same two sources AvailableSights merges when listing them for selection.
    let sightsData: any[] = [];
    if (selectedTrip.sightIds && selectedTrip.sightIds.length > 0) {
        const staticSightMatches = selectedTrip.sightIds
            .map(sightId => sights.find(s => s.slug === sightId))
            .filter((s): s is typeof sights[number] => Boolean(s));

        const unmatchedSightIds = selectedTrip.sightIds.filter(
            sightId => !sights.some(s => s.slug === sightId)
        );

        let firestoreSightMatches: any[] = [];
        if (unmatchedSightIds.length > 0) {
            const attractionsRef = collection(firestore, 'attractions');
            const q = query(attractionsRef, where('__name__', 'in', unmatchedSightIds.slice(0, 10)));
            const snapshot = await getDocs(q);
            firestoreSightMatches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        sightsData = [...staticSightMatches, ...firestoreSightMatches];
    }

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    let cursorY = margin;

    const addFooter = (pageNumber: number, totalPages: number) => {
        doc.setFontSize(8);
        doc.setTextColor(150);
        const footerText = `Page ${pageNumber} of ${totalPages} | Generated by Travelling South Africa on ${format(new Date(), 'd MMM yyyy')} | https://travellingsouthafrica.co.za`;
        const footerY = pageHeight - 10;
        doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });
    };

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.setFont('helvetica', 'bold');
    doc.text(selectedTrip.name, margin, cursorY);
    cursorY += 10;

    if (selectedTrip.createdAt) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Created on ${format(new Date(selectedTrip.createdAt.seconds * 1000), 'd MMMM, yyyy')}`, margin, cursorY);
        cursorY += 15;
    }

    // Itinerary - Towns
    if (selectedTrip.towns && selectedTrip.towns.length > 0) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("Itinerary", margin, cursorY);
        cursorY += 10;

        selectedTrip.towns.forEach((tripTown, index) => {
            const town = towns.find(t => t.slug === tripTown.slug);
            if (!town) return;

            const province = provinces.find(p => p.slug === town.provinceSlug);

            if (cursorY > pageHeight - 40) {
                doc.addPage();
                cursorY = margin;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(`${index + 1}. ${town.name} (${province?.name || 'N/A'})`, margin, cursorY);
            cursorY += 8;

            if (tripTown.notes) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const notesLines = doc.splitTextToSize(tripTown.notes, pageWidth - margin * 2 - 5);
                notesLines.forEach((line: string) => {
                    if (cursorY > pageHeight - 20) {
                        doc.addPage();
                        cursorY = margin;
                    }
                    doc.text(line, margin + 5, cursorY);
                    cursorY += 5;
                });
            }
            cursorY += 5;
        });
    } else {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text("No towns have been added to this itinerary yet.", margin, cursorY);
    }

    // Sights
    if (sightsData.length > 0) {
        cursorY += 5;
        if (cursorY > pageHeight - 40) {
            doc.addPage();
            cursorY = margin;
        }
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("Sights to See", margin, cursorY);
        cursorY += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        sightsData.forEach(sight => {
            const location = sight.location || towns.find(t => t.slug === sight.townSlug)?.name || 'N/A';

            if (cursorY > pageHeight - 20) {
                doc.addPage();
                cursorY = margin;
            }
            doc.text(`- ${sight.name} (${location})`, margin + 5, cursorY);
            cursorY += 5;

            if (sight.description) {
                const descLines = doc.splitTextToSize(sight.description, pageWidth - margin * 2 - 10);
                descLines.forEach((line: string) => {
                    if (cursorY > pageHeight - 20) {
                        doc.addPage();
                        cursorY = margin;
                    }
                    doc.text(line, margin + 10, cursorY);
                    cursorY += 5;
                });
            }
        });
    }

    // Accommodation
    if (selectedTrip.accommodationIds && selectedTrip.accommodationIds.length > 0) {
        cursorY += 5;
        if (cursorY > pageHeight - 40) {
            doc.addPage();
            cursorY = margin;
        }
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("Accommodation", margin, cursorY);
        cursorY += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        selectedTrip.accommodationIds.forEach((accommodationId: string) => {
            const accommodation = tripAccommodations.find(a => a.id === accommodationId);
            if (accommodation) {
                if (cursorY > pageHeight - 20) {
                    doc.addPage();
                    cursorY = margin;
                }
                doc.text(`- ${accommodation.name} (${accommodation.category || 'N/A'}) - ${accommodation.townSlug?.replace(/-/g, ' ')}`, margin + 5, cursorY);
                cursorY += 5;
                if (accommodation.contactPhone) {
                    doc.text(`  Phone: ${accommodation.contactPhone}`, margin + 10, cursorY);
                    cursorY += 5;
                }
                if (accommodation.websiteUrl) {
                    doc.text(`  Website: ${accommodation.websiteUrl}`, margin + 10, cursorY);
                    cursorY += 5;
                }
            }
        });
    }

    // Service Providers
    if (serviceProvidersData.length > 0) {
        cursorY += 5;
        if (cursorY > pageHeight - 40) { doc.addPage(); cursorY = margin; }
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("Service Providers", margin, cursorY);
        cursorY += 10;

        const groupedProviders = serviceProvidersData.reduce((acc, provider) => {
            const category = provider.category || 'Uncategorized';
            if (!acc[category]) acc[category] = [];
            acc[category].push(provider);
            return acc;
        }, {});

        Object.entries(groupedProviders).forEach(([category, providers]) => {
            if (cursorY > pageHeight - 20) { doc.addPage(); cursorY = margin; }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(category, margin, cursorY);
            cursorY += 7;

            (providers as any[]).forEach(provider => {
                if (cursorY > pageHeight - 30) { doc.addPage(); cursorY = margin; }
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`- ${provider.name}`, margin + 5, cursorY);
                cursorY += 5;
                
                doc.setFont('helvetica', 'normal');
                if (provider.description) {
                    const descLines = doc.splitTextToSize(provider.description, pageWidth - margin * 2 - 10);
                    descLines.forEach((line: string) => {
                        if (cursorY > pageHeight - 20) { doc.addPage(); cursorY = margin; }
                        doc.text(line, margin + 10, cursorY);
                        cursorY += 5;
                    });
                }
                if (provider.contactPhone) { doc.text(`  Phone: ${provider.contactPhone}`, margin + 10, cursorY); cursorY += 5; }
                if (provider.contactEmail) { doc.text(`  Email: ${provider.contactEmail}`, margin + 10, cursorY); cursorY += 5; }
                if (provider.websiteUrl) { doc.text(`  Website: ${provider.websiteUrl}`, margin + 10, cursorY); cursorY += 5; }
                cursorY += 3;
            });
        });
    }

    // Add footers to all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
    }

    doc.save(`${selectedTrip.name.replace(/ /g, '_')}_itinerary.pdf`);

    toast({
        title: "Download Started",
        description: `Your itinerary "${selectedTrip.name}.pdf" is being downloaded.`,
    });
  };

  const handleDeleteTown = (townSlug: string) => {
    if (!selectedTrip || !selectedTrip.towns) return;

    const newTowns = selectedTrip.towns.filter(t => t.slug !== townSlug);
    updateTripTowns(firestore, user.uid, selectedTrip.id, newTowns);
    toast({
        title: "Town Removed",
        description: `${towns.find(t => t.slug === townSlug)?.name} has been removed from your itinerary.`
    });
  }

  const handleReorderTown = (index: number, direction: 'up' | 'down') => {
    if (!selectedTrip || !selectedTrip.towns) return;
    
    const newTowns = [...selectedTrip.towns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newTowns.length) return;

    const [movedItem] = newTowns.splice(index, 1);
    newTowns.splice(targetIndex, 0, movedItem);
    
    updateTripTowns(firestore, user.uid, selectedTrip.id, newTowns);
  }

  const handleSaveNotes = (townSlug: string) => {
    if (!selectedTrip || !selectedTrip.towns) return;

    const newTowns = selectedTrip.towns.map(t => 
      t.slug === townSlug ? { ...t, notes: editingNotes[townSlug] } : t
    );

    updateTripTowns(firestore, user.uid, selectedTrip.id, newTowns);

    setEditingNotes(prev => {
        const newEditing = {...prev};
        delete newEditing[townSlug];
        return newEditing;
    })
    
    toast({
        title: "Notes Saved",
        description: `Your notes for ${towns.find(t => t.slug === townSlug)?.name} have been saved.`
    });
  }
  
  const handleReverseTrip = () => {
    if (!selectedTrip || !selectedTrip.towns) return;
    const reversedTowns = [...selectedTrip.towns].reverse();
    updateTripTowns(firestore, user.uid, selectedTrip.id, reversedTowns);
    toast({
        title: "Trip Reversed",
        description: "The sequence of towns in your trip has been reversed."
    });
  }

  const provinceMap = useMemo(() => new Map(provinces.map(p => [p.slug, p.name])), []);

  const handleGetMultiStopDirections = () => {
      if (!selectedTrip || !selectedTrip.towns || selectedTrip.towns.length < 2) {
          return;
      }
  
      if (selectedTrip.towns.length > 10) {
          toast({
              variant: "destructive",
              title: "Too Many Stops",
              description: "Google Maps directions can only handle up to 10 stops at a time.",
          });
          return;
      }

      const locationStrings = selectedTrip.towns.map(tripTown => {
          const town = towns.find(t => t.slug === tripTown.slug);
          if (!town) return null;
          const provinceName = provinceMap.get(town.provinceSlug) || '';
          return `${town.name}, ${provinceName}, South Africa`;
      }).filter((item): item is string => item !== null);
  
      if (locationStrings.length < 2) {
          return;
      }

      const destination = locationStrings.pop()!;
      const waypoints = locationStrings.join('|');
      
      const url = `https://www.google.com/maps/dir/?api=1&origin=&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
      
      window.open(url, '_blank');
  };

  const dataMap = useMemo(() => ({
    town: { title: "Add Towns", items: towns, provinces: provinces },
  }), []);

  const currentDialogData = dialogState.type ? dataMap[dialogState.type] : null;

  if (isMobile === undefined) {
    return null; // or a loading spinner
  }

  const mainContent = (
    <div className="space-y-6" onClick={(e) => e.stopPropagation()}>
        {selectedTrip ? (
          <>
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-3xl md:text-4xl font-bold font-headline text-primary">{selectedTrip.name}</h1>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleMinimizeTrip}>
                        <Minus className="h-5 w-5" />
                        <span className="sr-only">Minimize Trip</span>
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleReverseTrip} variant="outline" size="sm">
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        <Translatable text="Reverse Trip" />
                    </Button>
                    <Button onClick={handleDownloadPdf} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        <Translatable text="Download PDF Itinerary" />
                    </Button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-6 w-6 text-primary"/>
                            <CardTitle className="text-xl font-headline"><Translatable text="Towns" /></CardTitle>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setDialogState({ isOpen: true, type: 'town' })}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {(selectedTrip.towns?.length ?? 0) > 0 ? (
                          <>
                            <Accordion type="multiple" className="w-full">
                                {selectedTrip.towns?.map((townData, index) => {
                                    const town = towns.find(t => t.slug === townData.slug);
                                    if (!town) return null;
                                    const isEditing = editingNotes.hasOwnProperty(townData.slug);
                                    return (
                                        <AccordionItem value={town.slug} key={town.slug}>
                                            <div className="flex items-center group">
                                                <div className="flex flex-col py-1">
                                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleReorderTown(index, 'up')} disabled={index === 0}>
                                                        <ArrowUp className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleReorderTown(index, 'down')} disabled={index === selectedTrip.towns!.length - 1}>
                                                        <ArrowDown className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <span className="font-medium flex-grow pl-2"><Translatable text={town.name} /></span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTown(town.slug)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <AccordionTrigger className="w-8 hover:no-underline" />
                                            </div>
                                            <AccordionContent>
                                                <div className="pl-8 space-y-4">
                                                    <div>
                                                        <Label htmlFor={`notes-${town.slug}`}><Translatable text="My Notes" /></Label>
                                                        <Textarea 
                                                            id={`notes-${town.slug}`} 
                                                            value={isEditing ? editingNotes[townData.slug] : townData.notes || ''}
                                                            onChange={(e) => setEditingNotes(prev => ({...prev, [townData.slug]: e.target.value}))}
                                                            placeholder="Add your personal notes for this town..."
                                                            className="mt-1"
                                                        />
                                                        {isEditing && (
                                                            <Button size="sm" className="mt-2" onClick={() => handleSaveNotes(townData.slug)}><Translatable text="Save Notes" /></Button>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button asChild variant="outline" size="sm"><Link href={`/towns/${town.slug}`} target="_blank">View Details</Link></Button>
                                                        <Button asChild variant="outline" size="sm"><Link href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(town.name + ", " + (provinces.find(p => p.slug === town.provinceSlug)?.name || 'South Africa'))}`} target="_blank">Map</Link></Button>
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )
                                })}
                            </Accordion>
                            {selectedTrip.towns && selectedTrip.towns.length >= 2 && (
                              <div className="mt-6 pt-6 border-t">
                                  <Button 
                                      onClick={handleGetMultiStopDirections}
                                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                                      size="lg"
                                  >
                                      <Car className="mr-2 h-5 w-5" />
                                      <Translatable text="Map All Stops" />
                                  </Button>
                              </div>
                            )}
                          </>
                        ) : (
                            <p className="text-sm text-muted-foreground"><Translatable text="No towns added yet."/></p>
                        )}
                    </CardContent>
                </Card>

                <AvailableSights
                    selectedTrip={selectedTrip}
                    firestore={firestore}
                    onSave={(ids) => handleItemsSave('sightIds', ids)}
                    toast={toast}
                />
                
                <AccommodationCard
                    selectedTrip={selectedTrip}
                    firestore={firestore}
                    onSave={(ids) => handleItemsSave('accommodationIds', ids)}
                    onAccommodationsLoaded={setTripAccommodations}
                    toast={toast}
                />
                <AvailableServiceProviders
                  selectedTrip={selectedTrip}
                  firestore={firestore}
                  onSave={(ids) => handleItemsSave('serviceProviderIds', ids)}
                />
            </div>
            </>
        ) : (
            <div onClick={(e) => e.stopPropagation()}>
                <NationalRoadsGuide onSelectRoute={handleSelectRouteForCreation} />
            </div>
        )}
    </div>
  );

  return (
    <>
      <div className="relative">
        <PlanTripHero />
        <TripCreatorBar onTripCreate={handleCreateTrip} />
      </div>

      {isMobile ? (
        <div className="p-4" onClick={() => { if (selectedTrip) { handleMinimizeTrip(); } }}>
            <Accordion type="single" collapsible className="w-full mb-4">
                <AccordionItem value="my-trips">
                    <AccordionTrigger>
                        <h2 className="text-xl font-bold font-headline">
                            <Translatable text="My Trips"/> ({trips?.length || 0})
                        </h2>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="flex flex-col gap-1 py-2">
                            {tripsLoading && <p className="text-sm text-muted-foreground text-center p-4"><Translatable text="Loading trips..."/></p>}
                            {trips && trips.map(trip => (
                                <div key={trip.id} className="flex items-center justify-between group rounded-md hover:bg-accent">
                                    <Button
                                        onClick={() => handleSelectTrip(trip)}
                                        variant="ghost"
                                        className={`flex-grow justify-start ${selectedTrip?.id === trip.id ? 'bg-accent/50' : ''}`}
                                    >
                                        <Route className="mr-2 h-4 w-4" />
                                        <span>{trip.name}</span>
                                    </Button>
                                    <Button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip.id); }}
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                             {trips && trips.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center p-4">
                                    <Translatable text="You have no saved trips."/>
                                </p>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            {mainContent}
        </div>
      ) : (
        <SidebarProvider>
            <div className="flex min-h-[calc(100vh_-_350px)]">
            <Sidebar collapsible="none" className="max-h-[calc(100vh_-_80px)] top-20 sticky">
                <SidebarHeader>
                    <h2 className="text-xl font-bold font-headline px-2 pt-1">
                        <Translatable text="My Trips"/>
                    </h2>
                </SidebarHeader>

                <SidebarContent>
                    <SidebarMenu>
                    {tripsLoading && (
                        <SidebarMenuItem>
                        <p className="text-sm text-muted-foreground text-center p-4">
                            <Translatable text="Loading trips..."/>
                        </p>
                        </SidebarMenuItem>
                    )}

                    {trips && trips.map(trip => (
                        <SidebarMenuItem key={trip.id}>
                            <SidebarMenuButton
                                onClick={() => handleSelectTrip(trip)}
                                isActive={selectedTrip?.id === trip.id}
                            >
                                <Route />
                                <span>{trip.name}</span>
                            </SidebarMenuButton>
                            <SidebarMenuAction
                                onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip.id); }}
                                className="text-muted-foreground hover:text-destructive"
                                showOnHover
                            >
                                <Trash2 />
                            </SidebarMenuAction>
                        </SidebarMenuItem>
                    ))}
                    
                    {trips && trips.length === 0 && (
                        <SidebarMenuItem>
                        <p className="text-sm text-muted-foreground text-center p-4">
                            <Translatable text="You have no saved trips."/>
                        </p>
                        </SidebarMenuItem>
                    )}
                    </SidebarMenu>
                </SidebarContent>
            </Sidebar>

            <SidebarInset>
                <div className="container mx-auto px-4 py-8" onClick={() => { if (selectedTrip) { handleMinimizeTrip(); } }}>
                    {mainContent}
                </div>
            </SidebarInset>
            </div>
        </SidebarProvider>
      )}

      {currentDialogData && dialogState.type === 'town' && (
            <AddToTripDialog 
                isOpen={dialogState.isOpen}
                onOpenChange={(isOpen) => setDialogState({ isOpen, type: null })}
                title={currentDialogData.title}
                items={currentDialogData.items}
                provinces={currentDialogData.provinces}
                selectedItems={(selectedTrip?.towns?.map(t => t.slug)) || []}
                onSave={(selectedSlugs) => handleTownsSave(selectedSlugs)}
            />
      )}
    </>
  );
}
