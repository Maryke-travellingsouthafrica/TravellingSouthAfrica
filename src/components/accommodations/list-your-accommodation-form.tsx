"use client";

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useUser } from '@/firebase';
import { AccommodationListingForm } from '@/components/add-listing/listing-form-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Translatable } from '@/components/translatable';

export function ListYourAccommodationForm() {
    const { user, isUserLoading } = useUser();

    return (
        <section id="list-accommodation" className="py-16 md:py-24 bg-secondary">
            <div className="container mx-auto px-4 max-w-4xl">
                {isUserLoading ? (
                    <p className="text-center"><Translatable text="Loading..." /></p>
                ) : user ? (
                    <AccommodationListingForm user={user} />
                ) : (
                    <div className="flex items-center justify-center">
                        <Card className="max-w-md text-center">
                            <CardHeader>
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Lock className="h-6 w-6" />
                                </div>
                                <CardTitle className="font-headline text-2xl">
                                    <Translatable text="Login Required" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    <Translatable text="Please log in or create an account to add your listing." />
                                </p>
                                <Button asChild className="mt-6">
                                    <Link href={`/login?redirect=${encodeURIComponent('/accommodations#list-accommodation')}`}>
                                        <Translatable text="Login or Register" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </section>
    );
}
