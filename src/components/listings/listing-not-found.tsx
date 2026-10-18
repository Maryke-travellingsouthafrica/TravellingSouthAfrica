import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Friendly 404 for public listing pages: unknown, pending or removed listings. */
export function ListingNotFound({ kind }: { kind: 'listing' | 'event' }) {
  return (
    <div className="container mx-auto px-4 py-16">
      <Card className="max-w-lg mx-auto text-center">
        <CardContent className="p-8">
          <SearchX className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold font-headline text-primary">
            {kind === 'event' ? 'Event not found' : 'Listing not found'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {kind === 'event'
              ? "We couldn't find that event. It may have been removed or the link may be incorrect."
              : "We couldn't find that listing. It may not be published yet, or the link may be incorrect."}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            {kind === 'event' ? (
              <>
                <Button asChild>
                  <Link href="/events">All events</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/">Home</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild>
                  <Link href="/accommodations">Accommodations</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/service-providers">Service Providers</Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
