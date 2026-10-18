'use client';
import { Share2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

/** Copies text to the clipboard; returns false when the browser blocks it. */
export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type ShareButtonProps = {
  url: string;
  title: string;
  text?: string;
  size?: ButtonProps['size'];
  className?: string;
};

/** Opens the native share sheet where available, otherwise copies the link. */
export function ShareButton({ url, title, text, size, className }: ShareButtonProps) {
  const { toast } = useToast();

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // Dismissing the share sheet is not an error and must not fall through to a copy.
        if ((error as Error)?.name === 'AbortError') return;
      }
    }
    const copied = await copyToClipboard(url);
    toast(copied ? { title: 'Link copied' } : { variant: 'destructive', title: 'Could not copy the link', description: url });
  };

  return (
    <Button type="button" variant="outline" size={size} className={className} onClick={handleShare}>
      <Share2 className="h-4 w-4 mr-2" />
      Share
    </Button>
  );
}
