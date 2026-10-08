import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Calendar, ImageIcon, User } from 'lucide-react';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Badge } from '@/components/ui/badge';
import { BlogPostContent } from '@/components/Blog/BlogPostContent';
import { ShareButtons } from '@/components/Blog/ShareButtons';
import {
  BLOG_SITE_URL,
  DEFAULT_OG_IMAGE,
  getOgImageUrl,
  getPostBySlug,
  getPostDescription,
  getPostUrl,
} from '@/lib/blog';

// ISR: pages are rendered on first request and refreshed in the background, so a
// newly published or edited post gets correct share tags without a redeploy.
export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

function formatDate(dateMs: number) {
  return new Date(dateMs).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Africa/Johannesburg',
  });
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const post = await getPostBySlug(params.slug);

  if (!post) {
    return {
      title: 'Article Not Found',
      description: 'The article you are looking for does not exist on Travelling South Africa.',
    };
  }

  const title = post.title;
  const description = getPostDescription(post);
  const url = getPostUrl(post);
  const imageUrl = getOgImageUrl(post);
  // The generated share image is always 1200×630; the site default has its own size.
  const imageSize = post.imageUrl ? { width: 1200, height: 630 } : { width: 1140, height: 530 };

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'article',
      url,
      siteName: 'Travelling South Africa',
      locale: 'en_ZA',
      title,
      description,
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          type: 'image/jpeg',
          ...imageSize,
          alt: title,
        },
      ],
      ...(post.dateMs ? { publishedTime: new Date(post.dateMs).toISOString() } : {}),
      ...(post.author ? { authors: [post.author] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function BlogPostPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const post = await getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const title = post.title;
  const url = getPostUrl(post);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: getPostDescription(post),
    image: post.imageUrl ? getOgImageUrl(post) : DEFAULT_OG_IMAGE,
    ...(post.dateMs ? { datePublished: new Date(post.dateMs).toISOString() } : {}),
    ...(post.author ? { author: { '@type': 'Person', name: post.author } } : {}),
    publisher: { '@type': 'Organization', name: 'Travelling South Africa', url: BLOG_SITE_URL },
    mainEntityOfPage: url,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      {/* Hero — same treatment as the article image on the blog list */}
      <section className="relative h-[45vh] min-h-[320px] w-full overflow-hidden bg-muted">
        {post.imageUrl ? (
          <ImageWithFallback
            src={post.imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0">
          <div className="container mx-auto px-4 pb-6">
            <div className="max-w-3xl mx-auto">
              <Badge variant="secondary" className="text-[11px] mb-2">Article</Badge>
              <h1 className="text-white font-bold text-2xl md:text-4xl leading-tight drop-shadow-sm">
                {title}
              </h1>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto space-y-4">
          <Link
            href="/instagram"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            All articles
          </Link>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {post.dateMs ? formatDate(post.dateMs) : 'Date unknown'}
            </span>
            {post.author && (
              <>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {post.author}
                </span>
              </>
            )}
          </div>

          {/* Caption */}
          {post.caption && (
            <p className="text-base font-medium text-foreground italic border-l-2 border-primary pl-3">
              {post.caption}
            </p>
          )}

          <BlogPostContent content={post.content} postId={post.id} />

          <div className="pt-6 mt-6 border-t border-border/50">
            <ShareButtons url={url} title={title} />
          </div>
        </div>
      </section>
    </article>
  );
}
