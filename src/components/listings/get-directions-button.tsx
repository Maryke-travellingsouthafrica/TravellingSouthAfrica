'use client';
import { ExternalLink } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { getDirectionsUrl } from '@/lib/directions';

type GetDirectionsButtonProps = {
  item: any;
  size?: ButtonProps['size'];
  className?: string;
};

/**
 * Class for a Plan My Trip detail-modal action row (Add to Trip / Website / Get Directions / Book Now).
 * Up to three buttons keep the original flex row; with four, small screens get a 2×2 grid so labels
 * aren't squashed, and `sm` and up keeps the single flex row.
 */
export function actionRowClass(item: any) {
  const count = 1 + [item?.websiteUrl, getDirectionsUrl(item), item?.bookingSiteUrl].filter(Boolean).length;
  return count > 3
    ? 'grid grid-cols-2 gap-2 pt-2 border-t sm:flex sm:flex-wrap'
    : 'flex flex-wrap gap-2 pt-2 border-t';
}

/** The grey "Get Directions" button used on listing cards and Plan My Trip detail modals. */
export function GetDirectionsButton({ item, size, className }: GetDirectionsButtonProps) {
  const url = getDirectionsUrl(item);
  if (!url) return null;

  return (
    <Button asChild variant="outline" size={size} className={className}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        // Keep the click from reaching modal/card handlers (close, select toggle).
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Get Directions
      </a>
    </Button>
  );
}
