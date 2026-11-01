/**
 * Fills the local emulators with test accounts and content. It refuses to run
 * unless the emulator hosts are set and the project is a demo- one, and it never
 * loads service-account.json, so it can't write to production.
 *
 * Safe to re-run: accounts and docs keep the same IDs and are updated in place,
 * and anything you added while testing (reviews, ratings) is left alone.
 *
 * Usage (with the emulators already running):
 *   npm run seed
 */

import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { getListingPath } from '../src/lib/listing-links';
import { endOfSaDay, getSaDateString, slugifyEventTitle, startOfSaDay } from '../src/lib/events';

const ENV_FILE = '.env.development.local';
if (existsSync(ENV_FILE)) {
  const env = parse(readFileSync(ENV_FILE));
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID']) {
    process.env[key] ??= env[key];
  }
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

if (!firestoreHost || !authHost || !projectId.startsWith('demo-')) {
  console.error(
    'Refusing to seed: this only runs against the emulators.\n' +
      `  FIRESTORE_EMULATOR_HOST: ${firestoreHost || '(not set)'}\n` +
      `  FIREBASE_AUTH_EMULATOR_HOST: ${authHost || '(not set)'}\n` +
      `  Project (must start with demo-): ${projectId || '(not set)'}`
  );
  process.exit(1);
}

// Loaded only after the checks above, so nothing is set up until they pass.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
admin.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

const PASSWORD = 'Test1234!';
const IMAGE = (text: string) => `https://placehold.co/800x500/png?text=${encodeURIComponent(text)}`;

async function seedUser(uid: string, email: string, displayName: string) {
  const auth = admin.auth();
  let userId = uid;
  try {
    userId = (await auth.getUserByEmail(email)).uid;
    await auth.updateUser(userId, { password: PASSWORD, displayName });
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') throw error;
    await auth.createUser({ uid, email, password: PASSWORD, displayName });
  }
  // The same profile doc the sign-up page creates.
  await db.doc(`users/${userId}`).set({ id: userId, name: displayName, email, role: 'free', profileImageUrl: null }, { merge: true });
  return userId;
}

/** A published listing: the public doc, plus the submission the admin panel lists it from. */
async function seedListing(collectionName: string, id: string, owner: { uid: string; email: string }, fields: Record<string, unknown>) {
  const shared = {
    ...fields,
    submittedBy: owner.uid,
    ownerUid: owner.uid,
    ownerEmail: owner.email,
    createdAt: Timestamp.now(),
  };
  await db.doc(`${collectionName}_submissions/${id}`).set({ ...shared, status: 'approved' }, { merge: true });
  await db.doc(`${collectionName}/${id}`).set(
    { ...shared, status: 'approved', approved: true, approvedAt: FieldValue.serverTimestamp(), approvedBy: 'maryke@travellingsouthafrica.co.za' },
    { merge: true }
  );
}

async function main() {
  // Answers on any path means the Auth emulator is up, whatever the status code.
  try {
    await fetch(`http://${authHost}/`, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.error(`The emulators are not running at ${authHost}. Start them first with: npm run emulators`);
    process.exit(1);
  }

  const marykeId = await seedUser('seed-maryke', 'maryke@travellingsouthafrica.co.za', 'Maryke Admin');
  const charlesId = await seedUser('seed-charles', 'charles@travellingsouthafrica.co.za', 'Charles Admin');
  const reviewerId = await seedUser('seed-reviewer', 'reviewer@test.com', 'Thandi Reviewer');
  const ownerId = await seedUser('seed-owner', 'owner@test.com', 'Olivia Owner');

  const maryke = { uid: marykeId, email: 'maryke@travellingsouthafrica.co.za' };
  const owner = { uid: ownerId, email: 'owner@test.com' };

  const contact = (name: string) => ({
    contactPhone: '+27 21 000 0000',
    contactEmail: `${name}@example.com`,
    websiteUrl: 'https://example.com',
    bookingSiteUrl: '',
  });

  await seedListing('accommodations', 'seedAccommodation1', maryke, {
    name: 'Table View Guesthouse',
    category: 'Guest House',
    townSlug: 'cape-town',
    physicalAddress: '1 Test Road, Cape Town',
    description: 'A quiet test guesthouse with mountain views, used for trying out reviews locally.',
    imageUrls: [IMAGE('Table View Guesthouse')],
    ...contact('tableview'),
  });
  // Owned by owner@test.com: signed in as them, the page should refuse a review of it.
  await seedListing('accommodations', 'seedAccommodation2', owner, {
    name: 'Owner Test Lodge',
    category: 'Lodge',
    townSlug: 'knysna',
    physicalAddress: '2 Lagoon Drive, Knysna',
    description: 'A test lodge owned by owner@test.com, for checking you cannot review your own listing.',
    imageUrls: [IMAGE('Owner Test Lodge')],
    ...contact('ownerlodge'),
  });
  await seedListing('service_providers', 'seedProvider1', maryke, {
    name: 'Durban Test Car Hire',
    category: 'Car Hire & Transport',
    townSlug: 'durban',
    physicalAddress: '3 Beach Road, Durban',
    description: 'A test car hire company, for checking service provider cards and reviews.',
    imageUrls: [IMAGE('Durban Test Car Hire')],
    ...contact('carhire'),
  });
  await seedListing('service_providers', 'seedProvider2', maryke, {
    name: 'Stellenbosch Test Bistro',
    category: 'Restaurant',
    townSlug: 'stellenbosch',
    physicalAddress: '4 Oak Street, Stellenbosch',
    description: 'A test restaurant, which is stored as a service provider just as real ones are.',
    imageUrls: [IMAGE('Stellenbosch Test Bistro')],
    ...contact('bistro'),
  });
  await seedListing('attractions', 'seedAttraction1', maryke, {
    name: 'Test Waterfall Reserve',
    category: 'Nature',
    townSlug: 'knysna',
    physicalAddress: '5 Forest Road, Knysna',
    description: 'A test attraction, for checking reviews on the sights pages.',
    imageUrls: [IMAGE('Test Waterfall Reserve')],
    ...contact('waterfall'),
  });

  const post = (title: string, slug: string, published: boolean) => ({
    title,
    slug,
    published,
    caption: `${title}: a short caption for testing.`,
    content: `<p>This is the body of "${title}", used for local testing.</p>`,
    author: 'Travelling South Africa',
    imageUrl: IMAGE(title),
    date: Timestamp.now(),
  });
  await db.doc('blogPosts/seedPostPublished').set(post('A Published Test Post', 'a-published-test-post', true), { merge: true });
  await db.doc('blogPosts/seedPostDraft').set(post('A Draft Test Post', 'a-draft-test-post', false), { merge: true });

  // Two weeks ahead, so it always shows as upcoming. Stored the way the admin form stores it.
  const eventDay = getSaDateString(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  await db.doc('events/seedEvent1').set(
    {
      title: 'Test Food Festival',
      description: 'A one-day test event, for checking event dates and pages.',
      startDate: Timestamp.fromDate(startOfSaDay(eventDay)),
      endDate: Timestamp.fromDate(endOfSaDay(eventDay)),
      townSlug: 'cape-town',
      imageUrl: IMAGE('Test Food Festival'),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  console.log(`Seeded project ${projectId}. Password for every account: ${PASSWORD}\n`);
  console.log('Accounts');
  console.log(`  maryke@travellingsouthafrica.co.za   admin   ${marykeId}`);
  console.log(`  charles@travellingsouthafrica.co.za  admin   ${charlesId}`);
  console.log(`  reviewer@test.com                    user    ${reviewerId}`);
  console.log(`  owner@test.com                       owner of Owner Test Lodge   ${ownerId}\n`);
  console.log('Pages (http://localhost:3000)');
  console.log(`  ${getListingPath('accommodation', { id: 'seedAccommodation1', name: 'Table View Guesthouse' })}`);
  console.log(`  ${getListingPath('accommodation', { id: 'seedAccommodation2', name: 'Owner Test Lodge' })}`);
  console.log(`  ${getListingPath('service-provider', { id: 'seedProvider1', name: 'Durban Test Car Hire' })}`);
  console.log(`  ${getListingPath('service-provider', { id: 'seedProvider2', name: 'Stellenbosch Test Bistro' })}`);
  console.log(`  /sights/${slugifyEventTitle('Test Waterfall Reserve')}`);
  console.log(`  ${getListingPath('event', { id: 'seedEvent1', title: 'Test Food Festival' })}`);
  console.log('  /blog/a-published-test-post');
  process.exit(0);
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
