import sharp from 'sharp';
import { DEFAULT_OG_IMAGE, getOgImageVersion, getPostBySlug } from '@/lib/blog';

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 630;
// WhatsApp silently drops previews whose image is much over ~300 KB.
const MAX_BYTES = 290 * 1024;

/**
 * Share image for a blog post: the cover photo cropped to 1200×630 and
 * compressed to a small JPEG. Lives outside /api/ on purpose — robots.txt
 * disallows /api/, and Facebook's crawler honours that.
 */
async function renderJpeg(sourceUrl: string): Promise<Buffer> {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Image fetch failed with ${response.status}`);
  const input = Buffer.from(await response.arrayBuffer());

  const resized = await sharp(input)
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .flatten({ background: '#ffffff' })
    .toBuffer();

  let output = resized;
  for (const quality of [82, 74, 66, 58, 50, 42, 34]) {
    output = await sharp(resized).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (output.length <= MAX_BYTES) break;
  }
  return output;
}

async function buildResponse(request: Request, slug: string, includeBody: boolean): Promise<Response> {
  const post = await getPostBySlug(slug);
  if (!post) return new Response('Not found', { status: 404 });

  // Fall back to the site default image if the post has no cover or it can't be fetched.
  const sources = post.imageUrl ? [post.imageUrl, DEFAULT_OG_IMAGE] : [DEFAULT_OG_IMAGE];

  for (const source of sources) {
    try {
      const jpeg = await renderJpeg(source);
      // Only a URL carrying the current cover's version hash is safe to cache
      // forever; anything else may go stale when the cover is replaced.
      const isVersioned =
        source === post.imageUrl &&
        new URL(request.url).searchParams.get('v') === getOgImageVersion(post.imageUrl);

      return new Response(includeBody ? new Uint8Array(jpeg) : null, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(jpeg.length),
          'Cache-Control': isVersioned
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
        },
      });
    } catch (error) {
      console.error(`Error building share image from ${source}:`, error);
    }
  }

  return Response.redirect(DEFAULT_OG_IMAGE, 302);
}

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  return buildResponse(request, slug, true);
}

// Some crawlers probe with HEAD first and check the type and length.
export async function HEAD(request: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  return buildResponse(request, slug, false);
}
