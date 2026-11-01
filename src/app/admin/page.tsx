'use client';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isAdmin } from '@/lib/admin';
import { Translatable } from '@/components/translatable';
import { AdminListingsPanel } from '@/components/admin/admin-listings-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { AdminRouteHighlightsPanel } from '@/components/admin/admin-route-highlights-panel';
import { SiteTrafficPanel } from '@/components/admin/site-traffic-panel';
import { AdminTownsPanel } from '@/components/admin/admin-towns-panel';
import { AdminBlogManager } from '@/components/admin/admin-blog-manager';
import { AdminEventsManager } from '@/components/admin/admin-events-manager';
import { AdminReviewsManager } from '@/components/admin/admin-reviews-manager';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isAdmin(user)) {
      router.push('/login?redirect=/admin');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isAdmin(user)) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p><Translatable text="Loading..." /></p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold font-headline text-primary">Admin Dashboard</h1>
          <p className="mt-2 text-lg text-muted-foreground">Manage user-submitted listings and site content.</p>
        </div>
        <Button asChild>
          <Link href="/add-your-listing">
            <PlusCircle className="mr-2 h-4 w-4" />
            <Translatable text="Add Listing" />
          </Link>
        </Button>
      </div>
      <Tabs defaultValue="accommodations" className="mt-8">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-8">
          <TabsTrigger value="accommodations">Accommodations</TabsTrigger>
          <TabsTrigger value="service_providers">Services</TabsTrigger>
          <TabsTrigger value="attractions">Attractions</TabsTrigger>
          <TabsTrigger value="site-traffic">Site Traffic</TabsTrigger>
          <TabsTrigger value="manage-towns">Manage Towns</TabsTrigger>
          <TabsTrigger value="manage-blog">Blog Posts</TabsTrigger>
          <TabsTrigger value="manage-events">Events</TabsTrigger>
          <TabsTrigger value="manage-reviews">Reviews</TabsTrigger>
        </TabsList>
        <TabsContent value="accommodations">
          <AdminListingsPanel collectionName="accommodations" />
        </TabsContent>
        <TabsContent value="service_providers">
          <AdminListingsPanel collectionName="service_providers" />
        </TabsContent>
        <TabsContent value="attractions">
          <AdminListingsPanel collectionName="attractions" />
        </TabsContent>
        <TabsContent value="site-traffic">
          <SiteTrafficPanel />
        </TabsContent>
        <TabsContent value="manage-towns">
          <AdminTownsPanel />
        </TabsContent>
        <TabsContent value="manage-blog">
          <AdminBlogManager />
        </TabsContent>
        <TabsContent value="manage-events">
          <AdminEventsManager />
        </TabsContent>
        <TabsContent value="manage-reviews">
          <AdminReviewsManager />
        </TabsContent>
      </Tabs>

      <div className="mt-8">
        <AdminRouteHighlightsPanel />
      </div>
    </div>
  );
}

    