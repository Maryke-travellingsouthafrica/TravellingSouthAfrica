/**
 * One-off backfill: adds a `slug` field to existing `blogPosts` documents that
 * lack one, so each post has a stable public URL at /blog/[slug].
 *
 * Slugs come from the post title via src/lib/slug.ts (the same function the
 * admin uses for new posts), oldest post first, with duplicates suffixed
 * -2, -3, and so on. Posts that already have a slug are never touched, and
 * the only field ever written is `slug`.
 *
 * Safe by default: running the script with no flags (or with --dry-run) only
 * prints the planned changes. Nothing is written until you re-run it with
 * --confirm.
 *
 * Usage:
 *   npx tsx scripts/backfill-blog-slugs.ts --dry-run   (lists planned slugs)
 *   npx tsx scripts/backfill-blog-slugs.ts --confirm   (writes them)
 *
 * Requires: service-account.json in the project root (git-ignored), or
 * Application Default Credentials - same as scripts/seed-firestore.ts.
 */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { slugify, uniqueSlug } from '../src/lib/slug';

/**
 * Optional hand-picked slugs, keyed by document ID, for posts whose generated
 * slug reads awkwardly. Must already be valid slugs (lowercase, hyphenated).
 */
const SLUG_OVERRIDES: Record<string, string> = {
  MIezFJArsCvXrMQYF1Sn: 'town-spotlight-of-the-week-piketberg',
  DR7nKH9hNg5TxYL5X8HR: 'town-spotlight-of-the-week-fisherhaven',
  '29GOqJDmYNatsqTU1eQy': 'town-spotlight-of-the-week-sutherland',
  X9O3IcjbbL1IA8sJ4pe6: 'town-spotlight-of-the-week-st-lucia',
  Dy0vis3dvXGov0fYyHem: 'town-spotlight-of-the-week-birkenhead',
  '3VkK6l7gPyKwbCuk1zL6': 'town-spotlight-of-the-week-putsonderwater',
  zSreun3bBh8UpkAFA0UA: 'town-spotlight-of-the-week-vredefort',
  n2jAGHyyCW8M2zRczTcc: 'west-coast-flower-season-2026-must-visit-towns',
  '3jpbKkkV7odrNbGskZeT': 'oupoot-south-africas-last-knysna-elephant',
  axeGQMPdHppuzBwgclyJ: 'chasing-the-mist-winter-in-rheenendal',
  uglRY1MhprxflHRqE687: 'the-ghost-of-uniondale',
  VldQVZdcNdpk7dlKWUkG: 'the-garden-route-worlds-number-one-road-trip',
  btF4OO89DWNZ0vc700Sw: 'plan-my-trip-faq',
  '1UY1AcCl2JxvJOgpEVHv': 'beplan-my-reis-gereelde-vrae',
};

async function main() {
  const confirm = process.argv.includes('--confirm');
  if (confirm && process.argv.includes('--dry-run')) {
    console.error('Pass either --dry-run or --confirm, not both.');
    process.exit(1);
  }

  console.log('Initializing Firebase Admin SDK...');
  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log(`Loaded credentials for project: ${serviceAccount.project_id || 'unknown'}`);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    console.log('service-account.json not found, using Application Default Credentials.');
    admin.initializeApp();
  }

  const snapshot = await admin.firestore().collection('blogPosts').get();
  // Oldest first, so when two titles collide the earlier post keeps the plain slug.
  const docs = [...snapshot.docs].sort(
    (a, b) => (a.get('date')?.toMillis?.() ?? 0) - (b.get('date')?.toMillis?.() ?? 0)
  );

  const taken = new Set<string>();
  for (const doc of docs) {
    const existing = doc.get('slug');
    if (existing) taken.add(existing);
  }

  const planned: { id: string; title: string; slug: string }[] = [];
  for (const doc of docs) {
    if (doc.get('slug')) continue;
    const override = SLUG_OVERRIDES[doc.id];
    if (override && override !== slugify(override, Infinity)) {
      throw new Error(`Override for ${doc.id} is not a valid slug: "${override}"`);
    }
    const base = override || slugify(doc.get('title')) || doc.id.toLowerCase();
    const slug = uniqueSlug(base, taken);
    taken.add(slug);
    planned.push({ id: doc.id, title: String(doc.get('title') ?? '').replace(/\s+/g, ' ').trim(), slug });
  }

  console.log(`\n${snapshot.size} blog posts found; ${snapshot.size - planned.length} already have a slug.\n`);
  for (const item of planned) {
    console.log(`${item.id}\n  title: ${item.title}\n  slug:  ${item.slug}${SLUG_OVERRIDES[item.id] ? '  (override)' : ''}\n`);
  }

  const slugs = planned.map((item) => item.slug);
  const duplicates = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
  console.log(duplicates.length === 0 ? 'No duplicate slugs.\n' : `DUPLICATE SLUGS: ${duplicates.join(', ')}\n`);

  if (planned.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (!confirm) {
    console.log(`DRY RUN - ${planned.length} document(s) would get a slug. Nothing was written.`);
    console.log('Re-run with --confirm to apply.');
    return;
  }

  const batch = admin.firestore().batch();
  for (const item of planned) {
    batch.update(admin.firestore().collection('blogPosts').doc(item.id), { slug: item.slug });
  }
  await batch.commit();
  console.log(`Done - wrote slug on ${planned.length} document(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
