"use client";

import { useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Translatable } from '@/components/translatable';
import { ListingTerms, ListingTermsAgreement, ListingTermsTrialNote } from '@/components/listing-terms';
import { Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addListing } from '@/firebase/firestore/listings';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/provider';

export function ListYourAccommodationForm() {
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if (files.length + imagePreviews.length > 6) {
                toast({ variant: 'destructive', title: 'You can upload a maximum of 6 photos.' });
                return;
            }
            setImageFiles(prev => [...prev, ...files]);
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setImagePreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in to submit a listing.' });
            return;
        }

        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);

        const data = {
            ownerUid: user.uid,
            ownerEmail: user.email,
            name: formData.get('propertyName') as string,
            category: formData.get('propertyType') as string,
            ownerName: formData.get('ownerName') as string,
            contactEmail: formData.get('email') as string,
            contactPhone: formData.get('phone') as string,
            websiteUrl: formData.get('website') as string,
            physicalAddress: formData.get('address') as string,
            description: formData.get('description') as string,
            approved: false,
        };

        const result = await addListing(firestore, 'accommodations', data, imageFiles);

        if (result.success) {
            setSuccess(true);
            setImagePreviews([]);
            setImageFiles([]);
        } else {
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: 'Please try again later.',
            });
        }

        setIsSubmitting(false);
    };

    if (success) {
        return (
            <section id="list-accommodation" className="py-16 md:py-24 bg-secondary">
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <h2 className="text-3xl font-bold text-primary">🎉 Listing Submitted!</h2>
                    <p className="text-muted-foreground mt-4">Thank you! Your listing has been submitted for review. We will be in touch within 2-3 business days.</p>
                </div>
            </section>
        );
    }

    return (
        <section id="list-accommodation" className="py-16 md:py-24 bg-secondary">
            <div className="container mx-auto px-4 max-w-4xl">
                <Card className="shadow-xl overflow-hidden">
                    <CardHeader className="text-center p-8">
                        <CardTitle className="text-3xl md:text-4xl font-bold font-headline text-primary">
                            <Translatable text="List Your Accommodation" />
                        </CardTitle>
                        <CardDescription className="text-lg text-muted-foreground max-w-3xl mx-auto mt-2">
                            <Translatable text="Own a hotel, guesthouse, or B&B? Get featured to tourists booking private tours. Start with a 60-day free trial — no payment required." />
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="propertyName"><Translatable text="Property Name*" /></Label>
                                    <Input id="propertyName" name="propertyName" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="propertyType"><Translatable text="Property Type*" /></Label>
                                    <Select name="propertyType" required>
                                        <SelectTrigger id="propertyType">
                                            <SelectValue placeholder="Select a type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hotel">Hotel</SelectItem>
                                            <SelectItem value="guest-house">Guest House</SelectItem>
                                            <SelectItem value="lodge">Lodge</SelectItem>
                                            <SelectItem value="b&b">Bed & Breakfast</SelectItem>
                                            <SelectItem value="self-catering">Self-Catering</SelectItem>
                                            <SelectItem value="backpackers">Backpackers</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ownerName"><Translatable text="Owner/Manager Name*" /></Label>
                                    <Input id="ownerName" name="ownerName" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email"><Translatable text="Email*" /></Label>
                                    <Input id="email" name="email" type="email" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone"><Translatable text="Phone/WhatsApp*" /></Label>
                                    <Input id="phone" name="phone" type="tel" placeholder="+27..." required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="website"><Translatable text="Website URL" /></Label>
                                    <Input id="website" name="website" type="url" placeholder="https://..." />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address"><Translatable text="Physical Address*" /></Label>
                                <Textarea id="address" name="address" required />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description"><Translatable text="Short Description*" /></Label>
                                <Textarea id="description" name="description" rows={4} placeholder="Describe your property... (max 300 characters)" maxLength={300} required />
                            </div>

                            <div className="space-y-2">
                                <Label><Translatable text="Key Amenities" /></Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {['WiFi', 'Pool', 'Parking', 'Breakfast Included', 'Air Conditioning', 'Pet Friendly', 'Wheelchair Accessible'].map(amenity => (
                                        <div key={amenity} className="flex items-center gap-2">
                                            <Checkbox id={amenity.toLowerCase().replace(/ /g, '-')} name="amenities[]" value={amenity} />
                                            <Label htmlFor={amenity.toLowerCase().replace(/ /g, '-')} className="font-normal"><Translatable text={amenity} /></Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="photos"><Translatable text="Upload Photos (up to 6)" /></Label>
                                <div className="flex items-center justify-center w-full">
                                    <label htmlFor="photos" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Camera className="w-8 h-8 mb-2 text-muted-foreground" />
                                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold"><Translatable text="Click to upload" /></span> or drag and drop</p>
                                            <p className="text-xs text-muted-foreground"><Translatable text="PNG, JPG" /></p>
                                        </div>
                                        <Input id="photos" type="file" className="hidden" multiple accept="image/png, image/jpeg" onChange={handleImageChange} />
                                    </label>
                                </div>
                                {imagePreviews.length > 0 && (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-4">
                                        {imagePreviews.map((src, index) => (
                                            <div key={index} className="relative aspect-square">
                                                <Image src={src} alt={`Preview ${index + 1}`} fill className="object-cover rounded-md" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <ListingTerms>
                                <div className="flex flex-row items-start space-x-3 pt-2">
                                    <Checkbox id="terms" required className="mt-1" />
                                    <div className="space-y-1 leading-none">
                                        <Label htmlFor="terms">
                                            <ListingTermsAgreement />
                                        </Label>
                                        <ListingTermsTrialNote />
                                    </div>
                                </div>
                            </ListingTerms>

                            <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
                                {isSubmitting ? <Translatable text="Submitting..." /> : <Translatable text="Submit Your Listing for Review" />}
                            </Button>
                            <p className="text-xs text-muted-foreground text-center pt-4">
                                <Translatable text="Submissions are reviewed within 2–3 business days." />
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
