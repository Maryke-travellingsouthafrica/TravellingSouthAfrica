'use client';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Check, Copy, Facebook, Mail, MessageCircle, MessageSquareText, Share2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { AccessibleDialogContent } from '@/components/ui/AccessibleDialogContent';
import { useToast } from '@/hooks/use-toast';
import { stripEmoji } from '@/lib/share-text';

/** Copies text to the clipboard; returns false when the browser blocks it. */
export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // In-app browsers (WhatsApp, Instagram) and insecure origins block the async API; try the legacy path.
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

type ShareButtonProps = {
  url: string;
  title: string;
  text?: string;
  size?: ButtonProps['size'];
  className?: string;
  /** Compact icon-only button for cards; also stops the click opening the card's modal or link. */
  iconOnly?: boolean;
};

function getShareLinks(url: string, rawTitle: string, isMobile: boolean) {
  const title = stripEmoji(rawTitle);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const both = encodeURIComponent(`${title} ${url}`);
  return [
    { label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${both}` },
    { label: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: 'X', icon: Share2, href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { label: 'Email', icon: Mail, href: `mailto:?subject=${t}&body=${both}` },
    ...(isMobile ? [{ label: 'SMS', icon: MessageSquareText, href: `sms:?&body=${both}` }] : []),
  ];
}

/**
 * Opens the native share sheet where available; otherwise a dialog of plain share links.
 * navigator.share is called synchronously in the click handler: awaiting anything first
 * uses up the user gesture, which is why clipboard writes fail in some mobile browsers.
 */
export function ShareButton({ url, title, text, size, className, iconOnly = false }: ShareButtonProps) {
  const { toast } = useToast();
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // User agent is only readable after mount (SSR has no navigator).
  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  const handleShare = (e: MouseEvent) => {
    // Cards are often wrapped in a link or have their own click handler.
    e.stopPropagation();
    e.preventDefault();

    const data = { url, title, text };
    const canNativeShare =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      navigator.canShare?.(data) !== false;

    if (!canNativeShare) {
      setFallbackOpen(true);
      return;
    }

    navigator.share(data).catch((error: unknown) => {
      // Dismissing the share sheet is not an error and must not open the fallback.
      if ((error as Error)?.name === 'AbortError') return;
      setFallbackOpen(true);
    });
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    setCopied(ok);
    setCopyBlocked(!ok);
    if (ok) {
      toast({ title: 'Link copied' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Clipboard is blocked here: select the link so it can be copied by hand.
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  const trigger = iconOnly ? (
    <Button
      type="button"
      variant="outline"
      size={size ?? 'icon'}
      className={className}
      onClick={handleShare}
      aria-label={`Share ${title}`}
    >
      <Share2 className="h-4 w-4" />
    </Button>
  ) : (
    <Button type="button" variant="outline" size={size} className={className} onClick={handleShare}>
      <Share2 className="h-4 w-4 mr-2" />
      Share
    </Button>
  );

  return (
    <>
      {trigger}
      <Dialog open={fallbackOpen} onOpenChange={(open) => { setFallbackOpen(open); if (!open) setCopyBlocked(false); }}>
        {/* Dialogs are portalled but React events still bubble to the parent card/link. */}
        <AccessibleDialogContent
          title={`Share ${title}`}
          description="Choose how to share this link"
          className="max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-2">
            {getShareLinks(url, title, isMobile).map(({ label, icon: Icon, href }) => (
              <Button key={label} asChild variant="outline">
                <a href={href} target="_blank" rel="noopener noreferrer">
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </a>
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input ref={inputRef} readOnly value={url} aria-label="Link" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" onClick={handleCopy} aria-label="Copy link">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {copyBlocked && <p className="text-sm text-muted-foreground">Press and hold the link to copy it</p>}
        </AccessibleDialogContent>
      </Dialog>
    </>
  );
}
