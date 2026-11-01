/**
 * Tests the review security rules and the onReviewWritten / approveListing Cloud
 * Functions against the local Firebase emulators. Nothing here can reach
 * production: it refuses to start unless it is inside an emulator run on a
 * `demo-` project, which has no cloud resources behind it.
 *
 * Usage (build the functions first):
 *   npm --prefix functions run build
 *   firebase emulators:exec --only firestore,functions --project demo-tsa-reviews "npx tsx scripts/test-review-rules.ts"
 *
 * If the emulator reports "Cannot determine backend specification", it timed out
 * starting up: set FUNCTIONS_DISCOVERY_TIMEOUT=120 and run it again.
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import ADMIN_EMAILS from '../functions/src/admin-emails.json';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  terminate,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT ?? '';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (!projectId.startsWith('demo-') || !emulatorHost) {
  throw new Error(`Refusing to run: needs a demo- project inside emulators:exec (project "${projectId}", host "${emulatorHost}").`);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
admin.initializeApp({ projectId });
const adminDb = admin.firestore();

const [emulatorHostName, emulatorPort] = emulatorHost.split(':');
const ADMIN_EMAIL = 'maryke@travellingsouthafrica.co.za';
const LISTING_ID = 'listing1';
const LISTING_NAME = 'Casa Del Sol';
const OWNER = 'owner-uid';
const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const ADMIN_UID = 'admin-uid';

const apps: FirebaseApp[] = [];
const clients: Firestore[] = [];

type Identity = { uid: string; email?: string; provider?: 'password' | 'anonymous' };

function connect(identity?: Identity) {
  const app = initializeApp({ projectId, apiKey: 'demo' }, `client-${apps.length}`);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, emulatorHostName, Number(emulatorPort), identity
    ? {
        mockUserToken: {
          sub: identity.uid,
          user_id: identity.uid,
          ...(identity.email ? { email: identity.email } : {}),
          firebase: { sign_in_provider: identity.provider ?? 'password', identities: {} },
        },
      }
    : undefined);
  apps.push(app);
  clients.push(db);
  return db;
}

async function allowed(action: Promise<unknown>) {
  await action;
}

async function denied(action: Promise<unknown>) {
  await assert.rejects(action, (error: { code?: string }) => {
    assert.match(error.code ?? '', /permission-denied/);
    return true;
  });
}

/** The doc a real client creates: Alice's valid review, with any fields overridden. */
function newReview(overrides: Record<string, unknown> = {}) {
  return {
    listingId: LISTING_ID,
    listingType: 'accommodation',
    listingTitle: LISTING_NAME,
    userId: ALICE,
    userName: 'Alice S.',
    rating: 5,
    title: 'Lovely stay',
    body: 'A really lovely place to stay for a weekend.',
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function seedReview(id: string, overrides: Record<string, unknown> = {}) {
  const now = admin.firestore.Timestamp.now();
  return adminDb.doc(`reviews/${id}`).set({ ...newReview(overrides), createdAt: now, updatedAt: now, ...overrides });
}

async function clearCollection(name: string) {
  const snapshot = await adminDb.collection(name).get();
  await Promise.all(snapshot.docs.map((d: { ref: { delete: () => Promise<unknown> } }) => d.ref.delete()));
}

/** Waits for a trigger to do its work, since it runs just after the write. */
async function waitFor(check: () => Promise<boolean>, label: string) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail(`Timed out waiting for: ${label}`);
}

const ratingOf = async (id = LISTING_ID, collectionName = 'accommodations') => {
  const data = (await adminDb.doc(`${collectionName}/${id}`).get()).data();
  return { average: data?.ratingAverage, count: data?.ratingCount, breakdown: data?.ratingBreakdown };
};

let anon: Firestore;
let alice: Firestore;
let bob: Firestore;
let owner: Firestore;
let adminClient: Firestore;
let anonymousAccount: Firestore;

const ALICE_REVIEW = `${LISTING_ID}_${ALICE}`;

before(() => {
  anon = connect();
  alice = connect({ uid: ALICE, email: 'alice@example.com' });
  bob = connect({ uid: BOB, email: 'bob@example.com' });
  owner = connect({ uid: OWNER, email: 'owner@example.com' });
  adminClient = connect({ uid: ADMIN_UID, email: ADMIN_EMAIL });
  anonymousAccount = connect({ uid: 'anon-uid', provider: 'anonymous' });
});

after(async () => {
  await Promise.all(clients.map((db) => terminate(db)));
  await Promise.all(apps.map((app) => deleteApp(app)));
  // The Admin SDK keeps sockets open, which would stop the test process exiting.
  setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
});

beforeEach(async () => {
  await Promise.all(['reviews', 'accommodations', 'attractions', 'mail', 'accommodations_submissions', 'blogPosts'].map(clearCollection));
  await adminDb.doc(`accommodations/${LISTING_ID}`).set({ name: LISTING_NAME, approved: true, submittedBy: OWNER, ownerUid: OWNER });
  await adminDb.doc('accommodations/unpublished').set({ name: 'Hidden', approved: false, submittedBy: OWNER, ownerUid: OWNER });
});

describe('creating a review', () => {
  const reviewRef = (db: Firestore, id = ALICE_REVIEW) => doc(db, 'reviews', id);

  test('a signed-in user can create their own review', async () => {
    await allowed(setDoc(reviewRef(alice), newReview()));
  });
  test('with a valid visit month', async () => {
    await allowed(setDoc(reviewRef(alice), newReview({ visitDate: '2026-03' })));
  });
  test('signed out is denied', async () => {
    await denied(setDoc(reviewRef(anon), newReview()));
  });
  test('an anonymous account is denied', async () => {
    await denied(setDoc(reviewRef(anonymousAccount, `${LISTING_ID}_anon-uid`), newReview({ userId: 'anon-uid' })));
  });
  test('a doc ID for another user is denied', async () => {
    await denied(setDoc(reviewRef(alice, `${LISTING_ID}_${BOB}`), newReview()));
  });
  test('a doc ID for another listing is denied', async () => {
    await denied(setDoc(reviewRef(alice, `other_${ALICE}`), newReview()));
  });
  test('writing as someone else is denied', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ userId: BOB })));
  });
  test('status tampering is denied', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ status: 'approved' })));
  });
  for (const rating of [0, 6, 3.5, '5', null]) {
    test(`rating ${JSON.stringify(rating)} is denied`, async () => {
      await denied(setDoc(reviewRef(alice), newReview({ rating })));
    });
  }
  test('rating limits 1 and 5 are allowed', async () => {
    await allowed(setDoc(reviewRef(alice), newReview({ rating: 1 })));
    await allowed(setDoc(reviewRef(bob, `${LISTING_ID}_${BOB}`), newReview({ rating: 5, userId: BOB })));
  });
  test('a title that is too short or too long is denied', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ title: 'ab' })));
    await denied(setDoc(reviewRef(alice), newReview({ title: 'a'.repeat(81) })));
  });
  test('a body that is too short or too long is denied', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ body: 'too short' })));
    await denied(setDoc(reviewRef(alice), newReview({ body: 'a'.repeat(2001) })));
  });
  test('whitespace padding does not satisfy the limits', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ body: ' '.repeat(50) })));
    await denied(setDoc(reviewRef(alice), newReview({ title: '  a  ' })));
  });
  test('an invalid visit month is denied', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ visitDate: '2026-13' })));
    await denied(setDoc(reviewRef(alice), newReview({ visitDate: 'March 2026' })));
  });
  test('extra fields are denied', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ helpfulVotes: 100 })));
    await denied(setDoc(reviewRef(alice), newReview({ moderatedBy: ADMIN_UID })));
  });
  test('missing fields are denied', async () => {
    const { body: _body, ...withoutBody } = newReview();
    await denied(setDoc(reviewRef(alice), withoutBody));
  });
  test('backdating is denied', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ createdAt: new Date('2020-01-01') })));
  });
  test('an unknown listing type is denied', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ listingType: 'event' })));
  });
  test('a listing that does not exist is denied', async () => {
    await denied(setDoc(reviewRef(alice, `nope_${ALICE}`), newReview({ listingId: 'nope' })));
  });
  test('an unpublished listing is denied', async () => {
    await denied(setDoc(reviewRef(alice, `unpublished_${ALICE}`), newReview({ listingId: 'unpublished', listingTitle: 'Hidden' })));
  });
  test('a title that is not the listing\'s real name is denied', async () => {
    await denied(setDoc(reviewRef(alice), newReview({ listingTitle: 'Somewhere Else' })));
  });
  test('reviewing your own listing is denied', async () => {
    await denied(setDoc(reviewRef(owner, `${LISTING_ID}_${OWNER}`), newReview({ userId: OWNER })));
  });
  test('a second review of the same listing is denied', async () => {
    await seedReview(ALICE_REVIEW);
    await denied(setDoc(reviewRef(alice), newReview()));
  });
});

describe('reading reviews', () => {
  beforeEach(async () => {
    await seedReview('approved_x', { status: 'approved', userId: 'x' });
    await seedReview(ALICE_REVIEW, { status: 'pending' });
    await seedReview('rejected_x', { status: 'rejected', userId: 'x' });
  });

  test('anyone can read an approved review', async () => {
    await allowed(getDoc(doc(anon, 'reviews', 'approved_x')));
  });
  test('signed out cannot read a pending or rejected review', async () => {
    await denied(getDoc(doc(anon, 'reviews', ALICE_REVIEW)));
    await denied(getDoc(doc(anon, 'reviews', 'rejected_x')));
  });
  test('another user cannot read someone else\'s pending review', async () => {
    await denied(getDoc(doc(bob, 'reviews', ALICE_REVIEW)));
  });
  test('the author can read their own pending review', async () => {
    await allowed(getDoc(doc(alice, 'reviews', ALICE_REVIEW)));
  });
  test('the author can read their own rejected review', async () => {
    await seedReview(`listing2_${ALICE}`, { status: 'rejected', listingId: 'listing2' });
    await allowed(getDoc(doc(alice, 'reviews', `listing2_${ALICE}`)));
  });
  test('an admin can read everything', async () => {
    await allowed(getDoc(doc(adminClient, 'reviews', 'rejected_x')));
    const all = await getDocs(collection(adminClient, 'reviews'));
    assert.equal(all.size, 3);
  });
  test('the public query returns only approved reviews, using the composite index shape', async () => {
    const page = await getDocs(query(
      collection(anon, 'reviews'),
      where('listingId', '==', LISTING_ID),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(6)
    ));
    assert.deepEqual(page.docs.map((d) => d.id), ['approved_x']);
  });
  test('an unfiltered list is denied to the public and to normal users', async () => {
    await denied(getDocs(collection(anon, 'reviews')));
    await denied(getDocs(collection(bob, 'reviews')));
  });
  test('the "my review" query works, and is empty rather than denied with no review', async () => {
    const mine = await getDocs(query(collection(alice, 'reviews'), where('listingId', '==', LISTING_ID), where('userId', '==', ALICE), limit(1)));
    assert.equal(mine.size, 1);
    const none = await getDocs(query(collection(bob, 'reviews'), where('listingId', '==', LISTING_ID), where('userId', '==', BOB), limit(1)));
    assert.equal(none.size, 0);
  });
  test('listing another user\'s reviews by userId is denied', async () => {
    await denied(getDocs(query(collection(bob, 'reviews'), where('userId', '==', ALICE))));
  });
});

describe('author updates', () => {
  const edit = { rating: 3, title: 'Changed my mind', body: 'Actually it was only an average place to stay.' };
  const ref = (db: Firestore) => doc(db, 'reviews', ALICE_REVIEW);

  test('the author can edit, staying pending', async () => {
    await seedReview(ALICE_REVIEW);
    await allowed(updateDoc(ref(alice), { ...edit, status: 'pending', updatedAt: serverTimestamp() }));
  });
  test('editing an approved review sends it back to pending', async () => {
    await seedReview(ALICE_REVIEW, { status: 'approved' });
    await allowed(updateDoc(ref(alice), { ...edit, status: 'pending', updatedAt: serverTimestamp() }));
    assert.equal((await adminDb.doc(`reviews/${ALICE_REVIEW}`).get()).data().status, 'pending');
  });
  test('editing an approved review without resetting status is denied', async () => {
    await seedReview(ALICE_REVIEW, { status: 'approved' });
    await denied(updateDoc(ref(alice), { ...edit, updatedAt: serverTimestamp() }));
  });
  test('an author cannot approve their own review', async () => {
    await seedReview(ALICE_REVIEW);
    await denied(updateDoc(ref(alice), { status: 'approved', updatedAt: serverTimestamp() }));
  });
  test('an invalid rating is denied', async () => {
    await seedReview(ALICE_REVIEW);
    await denied(updateDoc(ref(alice), { rating: 9, status: 'pending', updatedAt: serverTimestamp() }));
  });
  test('short text is denied', async () => {
    await seedReview(ALICE_REVIEW);
    await denied(updateDoc(ref(alice), { body: 'short', status: 'pending', updatedAt: serverTimestamp() }));
  });
  test('protected fields cannot change', async () => {
    await seedReview(ALICE_REVIEW);
    for (const change of [{ userId: BOB }, { listingId: 'other' }, { listingTitle: 'Other' }, { userName: 'Fake' }, { createdAt: new Date('2020-01-01') }, { moderatedBy: ALICE }]) {
      await denied(updateDoc(ref(alice), { ...change, status: 'pending', updatedAt: serverTimestamp() }));
    }
  });
  test('the visit month can be removed', async () => {
    await seedReview(ALICE_REVIEW, { visitDate: '2026-03' });
    await allowed(updateDoc(ref(alice), { visitDate: deleteField(), status: 'pending', updatedAt: serverTimestamp() }));
  });
  test('another user cannot edit it', async () => {
    await seedReview(ALICE_REVIEW);
    await denied(updateDoc(ref(bob), { ...edit, status: 'pending', updatedAt: serverTimestamp() }));
  });
  test('signed out cannot edit it', async () => {
    await seedReview(ALICE_REVIEW);
    await denied(updateDoc(ref(anon), { ...edit, status: 'pending', updatedAt: serverTimestamp() }));
  });
});

describe('admin moderation', () => {
  const ref = (db: Firestore) => doc(db, 'reviews', ALICE_REVIEW);
  const moderation = (status: string) => ({ status, moderatedAt: serverTimestamp(), moderatedBy: ADMIN_UID });

  beforeEach(() => seedReview(ALICE_REVIEW));

  test('an admin can approve and reject', async () => {
    await allowed(updateDoc(ref(adminClient), moderation('approved')));
    await allowed(updateDoc(ref(adminClient), moderation('rejected')));
  });
  test('an admin cannot change what the reviewer wrote', async () => {
    await denied(updateDoc(ref(adminClient), { ...moderation('approved'), rating: 1 }));
    await denied(updateDoc(ref(adminClient), { ...moderation('approved'), body: 'Rewritten by somebody else entirely.' }));
  });
  test('an admin cannot record another moderator', async () => {
    await denied(updateDoc(ref(adminClient), { ...moderation('approved'), moderatedBy: 'someone-else' }));
  });
  test('an unknown status is denied', async () => {
    await denied(updateDoc(ref(adminClient), moderation('featured')));
  });
  test('a normal user cannot moderate', async () => {
    await denied(updateDoc(ref(bob), { status: 'approved', moderatedAt: serverTimestamp(), moderatedBy: BOB }));
  });
});

describe('deleting a review', () => {
  const ref = (db: Firestore) => doc(db, 'reviews', ALICE_REVIEW);
  beforeEach(() => seedReview(ALICE_REVIEW));

  test('the author can delete it', async () => {
    await allowed(deleteDoc(ref(alice)));
  });
  test('an admin can delete it', async () => {
    await allowed(deleteDoc(ref(adminClient)));
  });
  test('another user cannot', async () => {
    await denied(deleteDoc(ref(bob)));
  });
  test('signed out cannot', async () => {
    await denied(deleteDoc(ref(anon)));
  });
});

describe('listing documents', () => {
  const ref = (db: Firestore) => doc(db, 'accommodations', LISTING_ID);

  test('anyone can still read a listing', async () => {
    await allowed(getDoc(ref(anon)));
  });
  test('an admin can still edit a listing', async () => {
    await allowed(updateDoc(ref(adminClient), { contactPhone: '+27 21 000 0000' }));
  });
  test('an admin client cannot write rating fields', async () => {
    await denied(updateDoc(ref(adminClient), { ratingAverage: 5 }));
    await denied(updateDoc(ref(adminClient), { ratingCount: 100 }));
    await denied(updateDoc(ref(adminClient), { ratingBreakdown: { '5': 100 } }));
    await denied(setDoc(doc(adminClient, 'accommodations', 'new'), { name: 'New', ratingCount: 5 }));
  });
  test('an admin edit is fine on a listing that already has a rating', async () => {
    await adminDb.doc(`accommodations/${LISTING_ID}`).update({ ratingAverage: 4, ratingCount: 1 });
    await allowed(updateDoc(ref(adminClient), { contactPhone: '+27 21 000 0000' }));
  });
  test('a normal user or the owner cannot write to a listing', async () => {
    await denied(updateDoc(ref(bob), { ratingAverage: 5 }));
    await denied(updateDoc(ref(owner), { ratingAverage: 5 }));
    await denied(updateDoc(ref(anon), { ratingAverage: 5 }));
  });
  test('an admin can still delete a listing', async () => {
    await allowed(deleteDoc(ref(adminClient)));
  });
});

describe('blogPosts', () => {
  // The same fields src/services/blogService.js writes for the admin blog manager.
  const newPost = (overrides: Record<string, unknown> = {}) => ({
    title: 'A post',
    caption: 'A caption',
    content: '<p>Some content</p>',
    author: 'Travelling South Africa',
    imageUrl: 'https://example.com/image.jpg',
    published: false,
    slug: 'a-post',
    date: serverTimestamp(),
    ...overrides,
  });
  const seedPost = (id: string, published: boolean) =>
    adminDb.doc(`blogPosts/${id}`).set({ ...newPost({ published }), date: admin.firestore.Timestamp.now() });

  for (const email of ADMIN_EMAILS) {
    test(`admin ${email} can create, edit, publish and delete a post`, async () => {
      const db = connect({ uid: `uid-${email}`, email });
      const created = await addDoc(collection(db, 'blogPosts'), newPost());
      await allowed(updateDoc(created, { title: 'An edited post' }));
      await allowed(updateDoc(created, { published: true }));
      await allowed(deleteDoc(created));
    });
  }

  for (const email of ['tristan@industrialgrowthhub.com', 'kassoratechnology@gmail.com']) {
    test(`former admin ${email} has no admin access`, async () => {
      const db = connect({ uid: `uid-${email}`, email });
      await seedPost('live', true);
      await seedReview(ALICE_REVIEW);
      await denied(addDoc(collection(db, 'blogPosts'), newPost()));
      await denied(updateDoc(doc(db, 'blogPosts', 'live'), { title: 'Edited' }));
      await denied(deleteDoc(doc(db, 'blogPosts', 'live')));
      await denied(updateDoc(doc(db, 'accommodations', LISTING_ID), { contactPhone: '+27 21 000 0000' }));
      await denied(updateDoc(doc(db, 'reviews', ALICE_REVIEW), { status: 'approved', moderatedAt: serverTimestamp(), moderatedBy: `uid-${email}` }));
      await denied(getDocs(collection(db, 'reviews')));
    });
  }

  test('the admin blog manager can list drafts and published posts', async () => {
    await seedPost('draft', false);
    await seedPost('live', true);
    const all = await getDocs(query(collection(adminClient, 'blogPosts'), orderBy('date', 'desc')));
    assert.equal(all.size, 2);
  });

  for (const [who, getDb] of [
    ['a normal user', () => bob],
    ['a listing owner', () => owner],
    ['an anonymous account', () => anonymousAccount],
    ['signed out', () => anon],
  ] as [string, () => Firestore][]) {
    test(`${who} cannot create a post`, async () => {
      await denied(addDoc(collection(getDb(), 'blogPosts'), newPost({ published: true })));
    });
    test(`${who} cannot edit or unpublish a post`, async () => {
      await seedPost('live', true);
      await denied(updateDoc(doc(getDb(), 'blogPosts', 'live'), { title: 'Defaced' }));
      await denied(updateDoc(doc(getDb(), 'blogPosts', 'live'), { published: false }));
    });
    test(`${who} cannot delete a post`, async () => {
      await seedPost('live', true);
      await denied(deleteDoc(doc(getDb(), 'blogPosts', 'live')));
    });
  }

  test('anyone can still read published posts', async () => {
    await seedPost('live', true);
    await seedPost('draft', false);
    await allowed(getDoc(doc(anon, 'blogPosts', 'live')));
    const published = await getDocs(query(collection(anon, 'blogPosts'), where('published', '==', true)));
    assert.deepEqual(published.docs.map((d) => d.id), ['live']);
  });

  test('the public blog list query works signed out and signed in', async () => {
    await seedPost('live', true);
    await seedPost('draft', false);
    for (const db of [anon, bob]) {
      const posts = await getDocs(query(collection(db, 'blogPosts'), where('published', '==', true), orderBy('date', 'desc')));
      assert.deepEqual(posts.docs.map((d) => d.id), ['live']);
    }
  });

  test('only admins can read a draft', async () => {
    await seedPost('draft', false);
    await allowed(getDoc(doc(adminClient, 'blogPosts', 'draft')));
    for (const db of [anon, bob, owner, anonymousAccount]) {
      await denied(getDoc(doc(db, 'blogPosts', 'draft')));
    }
  });

  test('an unfiltered list is denied to everyone but admins', async () => {
    await seedPost('live', true);
    for (const db of [anon, bob, owner, anonymousAccount]) {
      await denied(getDocs(collection(db, 'blogPosts')));
      await denied(getDocs(query(collection(db, 'blogPosts'), orderBy('date', 'desc'))));
    }
  });

  test('former admins cannot read drafts', async () => {
    await seedPost('draft', false);
    const db = connect({ uid: 'uid-tristan', email: 'tristan@industrialgrowthhub.com' });
    await denied(getDoc(doc(db, 'blogPosts', 'draft')));
  });
});

describe('onReviewWritten', () => {
  const approve = (id: string) => adminDb.doc(`reviews/${id}`).update({ status: 'approved' });

  test('a new pending review emails the admins and leaves the rating alone', async () => {
    await seedReview(ALICE_REVIEW, { title: 'Nice <b>place</b>' });

    // Reviews seeded by earlier tests can still be queuing their own emails, so find this one by its title.
    const emailsForThisReview = async () => {
      const mail = await adminDb.collection('mail').get();
      return mail.docs
        .map((d: { data: () => any }) => d.data())
        .filter((m: any) => m.message.html.includes('Nice &lt;b&gt;place&lt;/b&gt;'));
    };
    await waitFor(async () => (await emailsForThisReview()).length > 0, 'notification email');

    const emails = await emailsForThisReview();
    assert.equal(emails.length, 1);
    assert.ok(emails[0].to.includes(ADMIN_EMAIL));
    assert.match(emails[0].message.subject, /Casa Del Sol/);
    assert.doesNotMatch(emails[0].message.html, /<b>place<\/b>/);
    assert.equal((await ratingOf()).count, undefined);
  });

  test('approving, adding, editing, rejecting and deleting all keep the rating right', async () => {
    await seedReview(ALICE_REVIEW, { rating: 5 });
    await seedReview(`${LISTING_ID}_${BOB}`, { rating: 4, userId: BOB });
    await approve(ALICE_REVIEW);
    await waitFor(async () => (await ratingOf()).count === 1, 'first approval');
    assert.equal((await ratingOf()).average, 5);

    await approve(`${LISTING_ID}_${BOB}`);
    await waitFor(async () => (await ratingOf()).count === 2, 'second approval');
    const two = await ratingOf();
    assert.equal(two.average, 4.5);
    assert.deepEqual(two.breakdown, { '1': 0, '2': 0, '3': 0, '4': 1, '5': 1 });

    // An author's edit sends it back to pending, so it stops counting.
    await adminDb.doc(`reviews/${ALICE_REVIEW}`).update({ rating: 1, status: 'pending' });
    await waitFor(async () => (await ratingOf()).count === 1, 'edit back to pending');
    assert.equal((await ratingOf()).average, 4);

    await adminDb.doc(`reviews/${`${LISTING_ID}_${BOB}`}`).update({ status: 'rejected' });
    await waitFor(async () => (await ratingOf()).count === undefined, 'rejection clears the rating');
    assert.equal((await ratingOf()).average, undefined);
    assert.equal((await ratingOf()).breakdown, undefined);

    await approve(ALICE_REVIEW);
    await waitFor(async () => (await ratingOf()).count === 1, 're-approval');
    assert.equal((await ratingOf()).average, 1);
    await adminDb.doc(`reviews/${ALICE_REVIEW}`).delete();
    await waitFor(async () => (await ratingOf()).count === undefined, 'delete clears the rating');
  });

  test('a review of a listing that no longer exists does not fail or create the listing', async () => {
    await seedReview(`gone_${ALICE}`, { listingId: 'gone', status: 'approved' });
    // Give the trigger time to run, then check it did not create a doc.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    assert.equal((await adminDb.doc('accommodations/gone').get()).exists, false);
  });

  test('other collections are written to the right place', async () => {
    await adminDb.doc('attractions/sight1').set({ name: 'A Sight', approved: true, submittedBy: OWNER });
    await seedReview(`sight1_${ALICE}`, { listingId: 'sight1', listingType: 'attraction', listingTitle: 'A Sight', status: 'approved', rating: 2 });
    await waitFor(async () => (await ratingOf('sight1', 'attractions')).count === 1, 'attraction rating');
    assert.equal((await ratingOf('sight1', 'attractions')).average, 2);
  });
});

describe('approveListing', () => {
  /** Calls the callable function over HTTP with an unsigned token, which the emulator accepts. */
  async function callApproveListing(submissionId: string) {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: ADMIN_UID,
      user_id: ADMIN_UID,
      email: ADMIN_EMAIL,
      aud: projectId,
      iss: `https://securetoken.google.com/${projectId}`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.`;
    const functionsHost = process.env.TEST_FUNCTIONS_HOST ?? '127.0.0.1:5001';
    const response = await fetch(`http://${functionsHost}/${projectId}/us-central1/approveListing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: { submissionId, collectionName: 'accommodations' } }),
    });
    assert.equal(response.status, 200, await response.clone().text());
  }

  test('a rating smuggled in through a submission is not published', async () => {
    await adminDb.doc('accommodations_submissions/forged').set({
      name: 'Forged',
      status: 'pending',
      submittedBy: BOB,
      ratingAverage: 5,
      ratingCount: 999,
      ratingBreakdown: { '5': 999 },
    });
    await callApproveListing('forged');
    const published = (await adminDb.doc('accommodations/forged').get()).data();
    assert.equal(published.approved, true);
    assert.equal(published.ratingAverage, undefined);
    assert.equal(published.ratingCount, undefined);
    assert.equal(published.ratingBreakdown, undefined);
  });

  test('re-approving a listing restores its real rating', async () => {
    await adminDb.doc('accommodations_submissions/back').set({ name: 'Back Again', status: 'pending', submittedBy: BOB });
    await seedReview(`back_${ALICE}`, { listingId: 'back', listingTitle: 'Back Again', status: 'approved', rating: 4 });
    await callApproveListing('back');
    const published = (await adminDb.doc('accommodations/back').get()).data();
    assert.equal(published.ratingCount, 1);
    assert.equal(published.ratingAverage, 4);
  });
});
