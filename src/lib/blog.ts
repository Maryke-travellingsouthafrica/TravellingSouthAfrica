import { cache } from 'react';
import { createHash } from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { getBlogPostSlug, slugify } from '@/lib/slug';

/**
 * Blog URLs are always built on the www host. The apex domain 308-redirects to
 * www, and link-preview crawlers (WhatsApp in particular) do not reliably follow
 * a redirect on og:url / og:image — so this deliberately ignores
 * NEXT_PUBLIC_SITE_URL rather than risk it pointing at the apex.
 */
export const BLOG_SITE_URL = 'https://www.travellingsouthafrica.co.za';

/** Site-wide default share image (same one the root layout uses). */
export const DEFAULT_OG_IMAGE = 'https://i.ibb.co/nNDFjwr0/Why-2025-Is-Africas-Year-for-Travellers-1140x530.jpg';

const tidy = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

export interface BlogPostData {
  id: string;
  slug: string;
  title: string;
  caption: string;
  content: string;
  author: string;
  imageUrl: string;
  /** Publish date as epoch milliseconds, or null when the doc has no usable date. */
  dateMs: number | null;
}

/**
 * All published posts, newest first. Read with the client SDK (as the events
 * pages do) — Firestore rules allow public reads of published posts, so no
 * Admin credentials are needed on the host. The `published == true` filter is
 * required by those rules, not just a convenience.
 */
export const getPublishedPosts = cache(async (): Promise<BlogPostData[]> => {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const firestore = getFirestore(app);
  const snapshot = await getDocs(query(collection(firestore, 'blogPosts'), where('published', '==', true)));

  const posts = snapshot.docs.map((doc) => {
    const data = doc.data();
    const dateMs = typeof data.date?.toMillis === 'function' ? (data.date.toMillis() as number) : null;
    return {
      id: doc.id,
      slug: getBlogPostSlug({ id: doc.id, slug: data.slug, title: data.title }),
      // Admin-typed text often carries stray leading/trailing/double spaces.
      title: tidy(data.title),
      caption: tidy(data.caption),
      content: data.content ?? '',
      author: tidy(data.author),
      imageUrl: data.imageUrl ?? '',
      dateMs,
    };
  });

  return posts.sort((a, b) => (b.dateMs ?? 0) - (a.dateMs ?? 0));
});

/**
 * Finds a published post by its slug, falling back to the document ID and then
 * to a slug computed from the title, so links keep working for posts that have
 * no stored slug yet. Returns null when nothing matches or the read fails.
 */
export async function getPostBySlug(slug: string): Promise<BlogPostData | null> {
  try {
    return findPostBySlug(await getPublishedPosts(), slug);
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

export function findPostBySlug(posts: BlogPostData[], slug: string): BlogPostData | null {
  return (
    posts.find((post) => post.slug === slug) ??
    posts.find((post) => post.id === slug) ??
    posts.find((post) => slugify(post.title) === slug) ??
    null
  );
}

export function getPostUrl(post: Pick<BlogPostData, 'slug'>): string {
  return `${BLOG_SITE_URL}/blog/${post.slug}`;
}

/** Short hash of the cover image URL — changes whenever the cover is replaced. */
export function getOgImageVersion(imageUrl: string): string {
  return createHash('sha1').update(imageUrl).digest('hex').slice(0, 8);
}

/**
 * Absolute URL of the post's share image. The `v` param busts crawler caches
 * when the cover image changes, which is what lets the image route send long
 * cache headers.
 */
export function getOgImageUrl(post: Pick<BlogPostData, 'slug' | 'imageUrl'>): string {
  if (!post.imageUrl) return DEFAULT_OG_IMAGE;
  return `${getPostUrl(post)}/og.jpg?v=${getOgImageVersion(post.imageUrl)}`;
}

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Strips HTML tags and Markdown link syntax, leaving plain text for meta descriptions. */
export function toPlainText(content: string): string {
  return content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => HTML_ENTITIES[entity])
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The post's caption, or the first ~155 characters of its body cut on a word boundary. */
export function getPostDescription(post: Pick<BlogPostData, 'caption' | 'content'>, maxLength = 155): string {
  if (post.caption) return post.caption;

  const text = toPlainText(post.content);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}
