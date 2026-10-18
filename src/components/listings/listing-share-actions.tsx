'use client';
import { Link2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/components/listings/share-button';
import { getListingUrl, getWhatsAppShareUrl, type ListingKind } from '@/lib/listing-links';

/** Admin row actions: copy the public link, or open WhatsApp with the link prefilled. */
export function ListingShareActions({
  kind,
  listing,
}: {
  kind: ListingKind;
  listing: { id: string; name?: string; title?: string };
}) {
  const { toast } = useToast();
  const url = getListingUrl(kind, listing);

  const handleCopy = async () => {
    const copied = await copyToClipboard(url);
    toast(copied ? { title: 'Link copied' } : { variant: 'destructive', title: 'Could not copy the link', description: url });
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        <Link2 className="h-4 w-4 mr-1" />
        Copy link
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={getWhatsAppShareUrl(kind, listing)} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4 mr-1" />
          WhatsApp
        </a>
      </Button>
    </>
  );
}
