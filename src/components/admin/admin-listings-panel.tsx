'use client';
import { useState, useEffect, useRef } from 'react';
import { useFirestore, useFunctions } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { approveListing, unapproveListing, deleteListingSubmission } from '@/firebase/firestore/admin-actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { z } from 'zod';
import Image from 'next/image';
import { ChevronDown, ChevronUp, Mail, Phone, Globe, MapPin, Tag, User, ExternalLink, ChevronLeft, ChevronRight, Settings, Trash2, Plus, Loader2 } from 'lucide-react';

interface Listing {
  id: string;
  name: string;
  status: 'pending' | 'approved';
  createdAt?: { seconds: number };
  ownerUid: string;
  ownerEmail?: string;
  contactEmail: string;
  contactPhone?: string;
  description?: string;
  category?: string;
  cuisine?: string;
  townSlug?: string;
  physicalAddress?: string;
  websiteUrl?: string;
  bookingSiteUrl?: string;
  imageUrls?: string[];
  [key: string]: any;
}

function ImageGallery({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No images uploaded</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full h-48 rounded-lg overflow-hidden">
        <Image src={images[currentIndex]} alt={`Listing image ${currentIndex + 1}`} fill sizes="33vw" className="object-cover" />
        {images.length > 1 && (
          <>
            <button onClick={() => setCurrentIndex(prev => (prev - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentIndex(prev => (prev + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-6 gap-1">
          {images.map((img, idx) => (
            <div key={idx} onClick={() => setCurrentIndex(idx)} className={`relative aspect-square rounded cursor-pointer overflow-hidden border-2 ${idx === currentIndex ? 'border-primary' : 'border-transparent'}`}>
              <Image src={img} alt={`Thumbnail ${idx + 1}`} fill sizes="5vw" className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManageListingDialog({
  listing,
  collectionName,
  open,
  onClose,
}: {
  listing: Listing;
  collectionName: string;
  open: boolean;
  onClose: () => void;
}) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [physicalAddress, setPhysicalAddress] = useState(listing.physicalAddress || '');
  const [contactPhone, setContactPhone] = useState(listing.contactPhone || '');
  const [contactEmail, setContactEmail] = useState(listing.contactEmail || '');
  const [contactEmailError, setContactEmailError] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState(listing.websiteUrl || '');
  const [bookingSiteUrl, setBookingSiteUrl] = useState(listing.bookingSiteUrl || '');
  const [imageUrls, setImageUrls] = useState<string[]>(listing.imageUrls || []);

  const handleSave = async () => {
    const trimmedEmail = contactEmail.trim();
    if (trimmedEmail && !z.string().email().safeParse(trimmedEmail).success) {
      setContactEmailError('Please enter a valid email address');
      return;
    }
    setIsSaving(true);
    try {
      const updates = { physicalAddress, contactPhone, contactEmail: trimmedEmail, websiteUrl, bookingSiteUrl, imageUrls };
      await updateDoc(doc(firestore, `${collectionName}_submissions`, listing.id), updates);
      // An approved listing also has a public copy (same id); keep it in sync so edits go live.
      if (listing.status === 'approved') {
        await updateDoc(doc(firestore, collectionName, listing.id), updates);
      }
      toast({ title: 'Listing updated successfully' });
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploading(true);
    try {
      const storage = getStorage();
      const urls: string[] = [];
      for (const file of files) {
        const storageRef = ref(storage, `listings/${collectionName}/${listing.id}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        urls.push(url);
      }
      setImageUrls(prev => [...prev, ...urls]);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (idx: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage: {listing.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <Label>Physical Address</Label>
              <Input value={physicalAddress} onChange={e => setPhysicalAddress(e.target.value)} placeholder="Enter address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Contact Phone</Label>
                <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+27 ..." />
              </div>
              <div className="space-y-1">
                <Label>Contact Email</Label>
                <Input type="email" value={contactEmail} onChange={e => { setContactEmail(e.target.value); setContactEmailError(''); }} placeholder="email@example.com" />
                {contactEmailError && <p className="text-sm font-medium text-destructive">{contactEmailError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Website URL</Label>
                <Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label>Booking Site URL</Label>
                <Input value={bookingSiteUrl} onChange={e => setBookingSiteUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Images</Label>
            {imageUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative group aspect-video rounded-lg overflow-hidden border">
                    <Image src={url} alt={`Image ${idx + 1}`} fill sizes="200px" className="object-cover" />
                    <button
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No images. Upload some below.</p>
            )}
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><Plus className="h-4 w-4 mr-2" />Add Images</>}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListingCard({
  listing,
  onApprove,
  onUnapprove,
  onDelete,
  collectionName
}: {
  listing: Listing;
  onApprove: (collectionName: string, id: string) => void;
  onUnapprove: (collectionName: string, id: string) => void;
  onDelete: (collectionName: string, id: string) => void;
  collectionName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [managing, setManaging] = useState(false);
  const isPending = !listing.status || listing.status === 'pending';

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{listing.name}</CardTitle>
            <CardDescription>
              Submitted by: {listing.ownerEmail} on {listing.createdAt ? format(new Date(listing.createdAt.seconds * 1000), 'd MMM yyyy') : 'N/A'}
            </CardDescription>
          </div>
          <Badge variant={isPending ? "default" : "secondary"} className={isPending ? '' : 'bg-green-100 text-green-800 border-green-200'}>
            {listing.status || 'pending'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 flex-1">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(listing.category || listing.cuisine) && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Tag className="h-3 w-3" />
              <span>{listing.category || listing.cuisine}</span>
            </div>
          )}
          {listing.townSlug && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{listing.townSlug.replace(/-/g, ' ')}</span>
            </div>
          )}
          {listing.contactPhone && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{listing.contactPhone}</span>
            </div>
          )}
          {listing.contactEmail && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{listing.contactEmail}</span>
            </div>
          )}
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded(!expanded)}>
          {expanded ? (
            <><ChevronUp className="h-4 w-4 mr-1" /> Show Less</>
          ) : (
            <><ChevronDown className="h-4 w-4 mr-1" /> Show More Details</>
          )}
        </Button>

        {expanded && (
          <div className="space-y-4 pt-2 border-t">
            <ImageGallery images={listing.imageUrls || []} />
            {listing.description && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Description</p>
                <p className="text-sm">{listing.description}</p>
              </div>
            )}
            {listing.physicalAddress && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Address</p>
                <div className="flex items-start gap-1 text-sm">
                  <MapPin className="h-3 w-3 mt-1 shrink-0" />
                  <span>{listing.physicalAddress}</span>
                </div>
              </div>
            )}
            {listing.ownerEmail && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Owner</p>
                <div className="flex items-center gap-1 text-sm">
                  <User className="h-3 w-3" />
                  <span>{listing.ownerEmail}</span>
                </div>
              </div>
            )}
            <div className="space-y-1">
              {listing.websiteUrl && (
                <div>
                  <a href={listing.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <Globe className="h-3 w-3" /><span>Website</span><ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {listing.bookingSiteUrl && (
                <div>
                  <a href={listing.bookingSiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /><span>Booking Site</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <div className="flex gap-2 w-full">
          {isPending ? (
            <Button className="flex-1" onClick={() => onApprove(collectionName, listing.id)}>Approve</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onUnapprove(collectionName, listing.id)}>Un-approve</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setManaging(true)}>
            <Settings className="h-4 w-4 mr-1" />Manage
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(collectionName, listing.id)}>Delete</Button>
        </div>
      </CardFooter>

      {managing && (
        <ManageListingDialog
          listing={listing}
          collectionName={collectionName}
          open={managing}
          onClose={() => setManaging(false)}
        />
      )}
    </Card>
  );
}

export function AdminListingsPanel({ collectionName }: { collectionName: string }) {
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  const [pendingListings, setPendingListings] = useState<Listing[]>([]);
  const [approvedListings, setApprovedListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const submissionsCollection = collection(firestore, `${collectionName}_submissions`);

    const pendingQuery = query(submissionsCollection, where("status", "==", "pending"));
    const approvedQuery = query(submissionsCollection, where("status", "==", "approved"));

    const unsubscribePending = onSnapshot(pendingQuery, snapshot => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setPendingListings(fetched);
      setIsLoading(false);
    }, error => {
      console.error(`Error fetching pending ${collectionName}:`, error);
      toast({ variant: "destructive", title: "Error fetching pending listings." });
      setIsLoading(false);
    });

    const unsubscribeApproved = onSnapshot(approvedQuery, snapshot => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setApprovedListings(fetched);
    }, error => {
      console.error(`Error fetching approved ${collectionName}:`, error);
      toast({ variant: "destructive", title: "Error fetching approved listings." });
    });

    return () => {
      unsubscribePending();
      unsubscribeApproved();
    };
  }, [collectionName, firestore, toast]);

  const handleApprove = async (collection: string, id: string) => {
    if (!id) {
        console.error("ERROR: docId is undefined or null");
        toast({
            variant: "destructive",
            title: "Approval Failed",
            description: "No document ID provided.",
        });
        return;
    }
    try {
      await approveListing(functions, collection, id);
      toast({ title: "Listing approved successfully" });
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: error.message || "An unexpected internal error occurred.",
      });
    }
  };

  const handleUnapprove = async (collection: string, id: string) => {
    try {
      await unapproveListing(functions, collection, id);
      toast({ title: "Listing Un-approved" });
    } catch (error: any) {
      console.error("Un-approval failed:", error);
      toast({
        variant: "destructive",
        title: "Un-approval Failed",
        description: error.message || "An unknown error occurred.",
      });
    }
  };

  const handleDelete = async (collection: string, id: string) => {
    try {
      await deleteListingSubmission(functions, collection, id);
      toast({ variant: "destructive", title: "Listing Deleted" });
    } catch (error: any) {
      console.error("Deletion failed:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error.message || "An unknown error occurred.",
      });
    }
  };

  if (isLoading) return <p>Loading listings...</p>;

  return (
    <div className="space-y-8 mt-4">
      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Pending Approval ({pendingListings.length})</h2>
        {pendingListings.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingListings.map(listing => (
              <ListingCard key={listing.id} listing={listing} onApprove={handleApprove} onUnapprove={handleUnapprove} onDelete={handleDelete} collectionName={collectionName} />
            ))}
          </div>
        ) : <p className="text-muted-foreground">No pending listings.</p>}
      </div>
      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Approved Listings ({approvedListings.length})</h2>
        {approvedListings.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {approvedListings.map(listing => (
              <ListingCard key={listing.id} listing={listing} onApprove={handleApprove} onUnapprove={handleUnapprove} onDelete={handleDelete} collectionName={collectionName} />
            ))}
          </div>
        ) : <p className="text-muted-foreground">No approved listings.</p>}
      </div>
    </div>
  );
}
