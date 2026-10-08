/** Slugs are capped so shared blog links stay tidy; the cut lands on a word boundary. */
export const MAX_SLUG_LENGTH = 60;

// Words a truncated slug should not end on ("...-where-the" reads as cut off).
const TRAILING_STOP_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'how', 'in', 'is', 'of', 'on', 'or', 'that', 'the', 'to',
  'when', 'where', 'why', 'with',
]);

/**
 * Turns a title into a URL slug: lowercase, hyphenated, ASCII only. Accents are
 * folded to their base letter, apostrophes are dropped ("Africa's" → "africas"),
 * and emojis / punctuation become word breaks.
 */
export function slugify(text: string | undefined | null, maxLength = MAX_SLUG_LENGTH): string {
  if (!text) return '';

  const words = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’‘`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .split('-')
    .filter(Boolean);

  const kept: string[] = [];
  let length = 0;
  for (const word of words) {
    const next = length + word.length + (kept.length > 0 ? 1 : 0);
    if (next > maxLength) break;
    kept.push(word);
    length = next;
  }

  // A single word longer than the cap would otherwise produce an empty slug.
  if (kept.length === 0 && words.length > 0) return words[0].slice(0, maxLength);

  if (kept.length < words.length) {
    while (kept.length > 1 && TRAILING_STOP_WORDS.has(kept[kept.length - 1])) kept.pop();
  }

  return kept.join('-');
}

/** Returns `base`, or `base-2`, `base-3`… — the first that is not already taken. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * The slug a blog post is linked by: its stored `slug`, else one computed from
 * the title (posts created before slugs existed), else the document ID.
 */
export function getBlogPostSlug(post: { id: string; slug?: string; title?: string }): string {
  return post.slug || slugify(post.title) || post.id;
}
