'use client';

import { useState } from 'react';
import { Check, Facebook, Link2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is blocked on insecure origins and in some in-app browsers.
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground mr-1">Share:</span>
      <Button asChild variant="outline" size="sm">
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
          <MessageCircle />
          WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={facebookHref} target="_blank" rel="noopener noreferrer">
          <Facebook />
          Facebook
        </a>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={copyLink}>
        {copied ? <Check /> : <Link2 />}
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
    </div>
  );
}
