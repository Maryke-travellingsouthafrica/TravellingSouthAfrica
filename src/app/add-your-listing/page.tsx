"use client";

import { useEffect } from 'react';
import { useUser } from '@/firebase';
import { ListingFormTabs } from '@/components/add-listing/listing-form-tabs';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Translatable } from '@/components/translatable';
import { AddListingHero } from '@/components/add-listing/add-listing-hero';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AddYourListingPage() {
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    document.title = 'Add Your Listing – Travelling South Africa';
  }, []);

  if (isUserLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p><Translatable text="Loading..." /></p>
      </div>
    );
  }

  return (
    <>
      <AddListingHero />
      <div className="container mx-auto px-4 py-16">
        {user ? (
          <ListingFormTabs user={user} />
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
                  <Link href="/login?redirect=/add-your-listing">
                    <Translatable text="Login or Register" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
