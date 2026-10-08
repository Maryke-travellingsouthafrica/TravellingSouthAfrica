'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { ImageIcon, Calendar, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Translatable } from '@/components/translatable';
import { getPublishedBlogPosts } from '@/services/blogService';
import { getBlogPostSlug } from '@/lib/slug';

interface BlogPost {
  id: string;
  slug?: string;
  title: string;
  caption: string;
  content: string;
  author: string;
  imageUrl: string;
  date?: { seconds: number };
  published: boolean;
}

function PostSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse flex flex-col">
      <div className="h-44 bg-muted" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-muted rounded w-1/4" />
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    </Card>
  );
}

function formatDate(timestamp: { seconds: number }) {
  return new Date(timestamp.seconds * 1000).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function truncateCaption(caption: string | undefined, maxLength = 100) {
  if (!caption) return null;
  if (caption.length <= maxLength) return caption;
  return caption.slice(0, maxLength).trimEnd() + '…';
}

interface PostCardProps {
  post: BlogPost;
}

function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const caption = truncateCaption(post.caption);
  // Each post has its own page (and share preview) at /blog/[slug].
  const openPost = () => router.push(`/blog/${getBlogPostSlug(post)}`);

  return (
    <Card
      className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col h-full cursor-pointer border border-border/60"
      onClick={openPost}
    >
      {/* Image — reduced height for better proportions */}
      <div className="relative h-44 w-full overflow-hidden bg-muted flex-shrink-0">
        {post.imageUrl ? (
          <ImageWithFallback
            src={post.imageUrl}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        {/* Subtle gradient only at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute top-2.5 left-2.5">
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5 font-medium">
            Article
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Date */}
        {post.date && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(post.date)}
          </p>
        )}

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">
          {post.title}
        </h3>

        {/* Caption */}
        <p className="flex-1 text-xs text-muted-foreground leading-relaxed">
          {caption ?? <span className="italic">No caption</span>}
        </p>

        {/* Read More */}
        <div className="pt-2 border-t border-border/50 mt-1">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              openPost();
            }}
          >
            Read article
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </Card>
  );
}

export function OurBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublishedPosts();
  }, []);

  const fetchPublishedPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const publishedPosts = await getPublishedBlogPosts();
      setPosts(publishedPosts);
    } catch (err: any) {
      console.error('Error fetching published blog posts:', err);
      setError('Could not load blog posts.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ImageIcon className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          <Translatable text="Blog posts unavailable right now." />
        </p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ImageIcon className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          <Translatable text="No blog posts published yet." />
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
