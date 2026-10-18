"use client";

import { useEffect, useState, useCallback } from 'react';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import Link from 'next/link';
import { ExternalLink, Instagram, ImageIcon, Film, Calendar, ArrowRight, Facebook, BookOpen } from 'lucide-react';
import { Translatable } from '@/components/translatable';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { InstagramPost } from '@/app/api/instagram/route';
import type { FacebookPost } from '@/app/api/facebook/route';
import { OurBlog } from '@/components/Blog/OurBlog';

// ── Platform types ────────────────────────────────────────────────────────────

type Platform = 'Instagram' | 'Facebook' | 'OurBlog';

const platforms: Platform[] = ['OurBlog', 'Instagram', 'Facebook'];

const platformMeta: Record<
  Platform,
  { icon: React.ElementType; label: string; handle: string; profileUrl: string }
> = {
  Instagram: {
    icon: Instagram,
    label: 'Instagram',
    handle: '@travellingsouthafrica.co.za',
    profileUrl: 'https://instagram.com/travellingsouthafrica.co.za',
  },
  Facebook: {
    icon: Facebook,
    label: 'Facebook',
    handle: 'travellingsouthafrica.co.za',
    profileUrl: 'https://www.facebook.com/travellingsouthafrica.co.za',
  },
  OurBlog: {
    icon: BookOpen,
    label: 'Our Blog',
    handle: 'travellingsouthafrica.co.za',
    profileUrl: 'https://travellingsouthafrica.co.za/instagram',
  },
};

// ── Unified post shape ────────────────────────────────────────────────────────

interface UnifiedPost {
  id: string;
  platform: Platform;
  imageUrl?: string;
  caption?: string;
  timestamp?: string;
  username?: string;
  permalink: string;
  mediaType: 'photo' | 'video' | 'carousel';
}

function normalizeInstagram(post: InstagramPost): UnifiedPost {
  return {
    id: post.id,
    platform: 'Instagram',
    imageUrl: post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url,
    caption: post.caption,
    timestamp: post.timestamp,
    permalink: post.permalink,
    mediaType:
      post.media_type === 'VIDEO'
        ? 'video'
        : post.media_type === 'CAROUSEL_ALBUM'
        ? 'carousel'
        : 'photo',
  };
}

function normalizeFacebook(post: FacebookPost): UnifiedPost {
  const imageUrl =
    post.full_picture ||
    post.attachments?.data?.[0]?.media?.image?.src;
  return {
    id: post.id,
    platform: 'Facebook',
    imageUrl,
    caption: post.message || post.story,
    timestamp: post.created_time,
    permalink: post.permalink_url,
    mediaType: post.attachments?.data?.[0]?.type === 'video_inline' ? 'video' : 'photo',
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function truncateCaption(caption: string | undefined, maxLength = 120) {
  if (!caption) return null;
  if (caption.length <= maxLength) return caption;
  return caption.slice(0, maxLength).trimEnd() + '…';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PostSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse">
      <div className="h-56 bg-muted" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-5 bg-muted rounded w-full" />
        <div className="h-5 bg-muted rounded w-2/3" />
        <div className="h-4 bg-muted rounded w-1/4 mt-4" />
      </div>
    </Card>
  );
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onPreview,
}: {
  post: UnifiedPost;
  onPreview: (post: UnifiedPost) => void;
}) {
  const caption = truncateCaption(post.caption);

  const mediaLabel =
    post.mediaType === 'video' ? 'Video' : post.mediaType === 'carousel' ? 'Gallery' : 'Photo';

  const viewLabel =
    post.platform === 'Instagram' ? 'View on Instagram' : 'View on Facebook';

  return (
    <Card
      className="group overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col h-full cursor-pointer"
      onClick={() => onPreview(post)}
    >
      {/* Image */}
      <div className="relative block h-56 w-full overflow-hidden bg-muted flex-shrink-0">
        {post.imageUrl ? (
          <ImageWithFallback
            src={post.imageUrl}
            alt={post.caption ?? `${post.platform} post`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
            {post.mediaType === 'video' ? (
              <Film className="h-3 w-3" />
            ) : (
              <ImageIcon className="h-3 w-3" />
            )}
            {mediaLabel}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        {post.timestamp && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(post.timestamp)}
          </p>
        )}

        <p className="flex-1 text-sm text-foreground leading-relaxed">
          {caption ? (
            caption
          ) : (
            <span className="italic text-muted-foreground">No caption</span>
          )}
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(post);
            }}
          >
            Preview
          </Button>

          <Link
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {viewLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

// ── Platform tab button ───────────────────────────────────────────────────────

function PlatformTab({
  platform,
  active,
  onClick,
}: {
  platform: Platform;
  active: boolean;
  onClick: () => void;
}) {
  const { icon: Icon, label } = platformMeta[platform];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border transition-all ${
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ── Feed section ──────────────────────────────────────────────────────────────

function PlatformFeed({ platform }: { platform: Platform }) {
  // Our Blog has its own component; the social platforms share the fetching feed below.
  // Keeping them in separate components means no hook is called conditionally.
  if (platform === 'OurBlog') {
    return <OurBlog />;
  }
  return <SocialFeed platform={platform} />;
}

function SocialFeed({ platform }: { platform: Exclude<Platform, 'OurBlog'> }) {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UnifiedPost | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const endpoint = platform === 'Instagram' ? '/api/instagram' : '/api/facebook';

    try {
      const res = await fetch(endpoint);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        setPosts([]);
        return;
      }

      const raw: UnifiedPost[] =
        platform === 'Instagram'
          ? (json.data ?? []).map(normalizeInstagram)
          : (json.data ?? []).map(normalizeFacebook);

      setPosts(raw);
    } catch {
      setError('Could not load posts.');
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const { icon: Icon } = platformMeta[platform];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: 9 }).map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg">
          <Translatable text="Posts unavailable right now." />
        </p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg">
          <Translatable text="No posts to display yet." />
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onPreview={setSelected} />
        ))}
      </div>

      {selected && (
        <Dialog open onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected.caption ? 'Post Preview' : 'Blog Preview'}</DialogTitle>
              <DialogDescription>
                Click a post card to open this preview, then use the link below to visit{' '}
                {selected.platform}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6">
              <div className="relative h-80 overflow-hidden rounded-lg bg-muted">
                {selected.imageUrl ? (
                  <ImageWithFallback
                    src={selected.imageUrl}
                    alt={selected.caption ?? 'Post preview'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 768px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {selected.timestamp && (
                  <p className="text-sm text-muted-foreground">{formatDate(selected.timestamp)}</p>
                )}

                <div className="space-y-3 text-sm leading-relaxed text-foreground">
                  {selected.caption ? (
                    <p>{selected.caption}</p>
                  ) : (
                    <p className="italic text-muted-foreground">No caption available.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{selected.mediaType}</Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={selected.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      Open on {selected.platform}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const [activePlatform, setActivePlatform] = useState<Platform>('OurBlog');
  const { icon: ActiveIcon, handle, profileUrl } = platformMeta[activePlatform];

  return (
    <>
      {/* Hero */}
      <section
        className="relative bg-cover bg-center py-20 text-white"
        style={{
          backgroundImage:
            "url('https://i.ibb.co/bj4CV8rW/578251416429199326767899.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-black/55" />
        <div className="container relative mx-auto px-4 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <ActiveIcon className="h-7 w-7 text-white/80" />
            <h1 className="text-4xl font-bold font-headline md:text-5xl">
              <Translatable text="Our Blog" />
            </h1>
          </div>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-neutral-200">
            <Translatable text="Follow along as we explore the beauty of South Africa — landscapes, wildlife, culture, and hidden gems." />
          </p>
          <Link
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ActiveIcon className="h-4 w-4" />
            <span>{handle}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Posts */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          {/* Platform tabs */}
          <div className="flex flex-wrap gap-3 mb-10">
            {platforms.map((p) => (
              <PlatformTab
                key={p}
                platform={p}
                active={activePlatform === p}
                onClick={() => setActivePlatform(p)}
              />
            ))}
          </div>

          {/* Feed — keyed by platform so state resets on tab switch */}
          <PlatformFeed key={activePlatform} platform={activePlatform} />
        </div>
      </section>
    </>
  );
}
