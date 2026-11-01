/**
 * Tests storage.rules against the local Storage emulator. Nothing here can reach
 * production: it refuses to start unless it is inside an emulator run on a `demo-`
 * project, which has no cloud resources behind it.
 *
 * Usage:
 *   firebase emulators:exec --only storage --project demo-tsa-reviews "npx tsx scripts/test-storage-rules.ts"
 */

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectStorageEmulator,
  deleteObject,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';
import ADMIN_EMAILS from '../functions/src/admin-emails.json';

const projectId = process.env.GCLOUD_PROJECT ?? '';
const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '';
if (!projectId.startsWith('demo-') || !emulatorHost) {
  throw new Error(`Refusing to run: needs a demo- project inside emulators:exec (project "${projectId}", host "${emulatorHost}").`);
}

const [hostName, port] = emulatorHost.replace(/^https?:\/\//, '').split(':');
const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const MB = 1024 * 1024;
const IMAGE = { contentType: 'image/png' };

const apps: FirebaseApp[] = [];

type Identity = { uid: string; email?: string; provider?: 'password' | 'anonymous' };

function connect(identity?: Identity) {
  const app = initializeApp({ projectId, apiKey: 'demo', storageBucket: `${projectId}.appspot.com` }, `storage-${apps.length}`);
  const storage = getStorage(app);
  connectStorageEmulator(storage, hostName, Number(port), identity
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
  return storage;
}

const bytes = (size = 16) => new Uint8Array(size);
const put = (storage: FirebaseStorage, path: string, size?: number, metadata = IMAGE) =>
  uploadBytes(ref(storage, path), bytes(size), metadata);

async function denied(action: Promise<unknown>) {
  await assert.rejects(action, (error: { code?: string }) => {
    assert.equal(error.code, 'storage/unauthorized');
    return true;
  });
}

let anon: FirebaseStorage;
let alice: FirebaseStorage;
let bob: FirebaseStorage;
let anonymousAccount: FirebaseStorage;
let admin: FirebaseStorage;

before(() => {
  anon = connect();
  alice = connect({ uid: ALICE, email: 'alice@example.com' });
  bob = connect({ uid: BOB, email: 'bob@example.com' });
  anonymousAccount = connect({ uid: 'anon-uid', provider: 'anonymous' });
  admin = connect({ uid: 'admin-uid', email: ADMIN_EMAILS[0] });
});

after(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
});

const ADMIN_ONLY_PATHS = {
  'blog-images': 'blog-images/cover.png',
  events: 'events/poster.png',
  listings: 'listings/accommodations/listing1/photo.png',
  towns: 'towns/photo.png',
};

for (const [name, path] of Object.entries(ADMIN_ONLY_PATHS)) {
  describe(`${name} (admin only)`, () => {
    const newPath = path.replace('.png', '-new.png');

    before(() => put(admin, path));

    for (const email of ADMIN_EMAILS) {
      test(`admin ${email} can upload and overwrite`, async () => {
        const storage = connect({ uid: `uid-${email}`, email });
        await put(storage, `${newPath}.${email}`);
        await put(storage, `${newPath}.${email}`);
      });
    }

    test('anyone can read', async () => {
      await getBytes(ref(anon, path));
    });

    for (const [who, getStorageFor] of [
      ['a normal user', () => bob],
      ['an anonymous account', () => anonymousAccount],
      ['signed out', () => anon],
    ] as [string, () => FirebaseStorage][]) {
      test(`${who} cannot upload, overwrite or delete`, async () => {
        await denied(put(getStorageFor(), newPath));
        await denied(put(getStorageFor(), path));
        await denied(deleteObject(ref(getStorageFor(), path)));
      });
    }

    for (const email of ['tristan@industrialgrowthhub.com', 'kassoratechnology@gmail.com']) {
      test(`former admin ${email} cannot upload, overwrite or delete`, async () => {
        const storage = connect({ uid: `uid-${email}`, email });
        await denied(put(storage, newPath));
        await denied(put(storage, path));
        await denied(deleteObject(ref(storage, path)));
      });
    }
  });
}

describe('admin deletes', () => {
  test('an admin can delete blog and event images', async () => {
    for (const path of ['blog-images/to-delete.png', 'events/to-delete.png']) {
      await put(admin, path);
      await deleteObject(ref(admin, path));
    }
  });
  test('listing and town photos stay undeletable, as before', async () => {
    for (const path of ['listings/accommodations/listing1/keep.png', 'towns/keep.png']) {
      await put(admin, path);
      await denied(deleteObject(ref(admin, path)));
    }
  });
  test('admin limits still apply to listing and town photos', async () => {
    await denied(put(admin, 'listings/accommodations/listing1/big.png', 10 * MB));
    await denied(put(admin, 'towns/big.png', 5 * MB));
    await denied(put(admin, 'towns/notes.txt', 16, { contentType: 'text/plain' }));
  });
});

describe('submissions (Add Your Listing)', () => {
  const own = (file: string, collection = 'accommodations', uid = ALICE) => `submissions/${collection}/${uid}/${Date.now()}_${file}`;

  test('a signed-in user can upload to their own folder, for every listing type', async () => {
    for (const collection of ['accommodations', 'service_providers', 'restaurants', 'attractions']) {
      await put(alice, own('photo.png', collection));
    }
  });
  test('PNG and JPEG both work, just under the 10 MB limit', async () => {
    await put(alice, own('photo.jpg'), 10 * MB - 1, { contentType: 'image/jpeg' });
  });
  test('10 MB or more is denied', async () => {
    await denied(put(alice, own('big.png'), 10 * MB));
  });
  test('a non-image is denied', async () => {
    await denied(put(alice, own('page.html'), 16, { contentType: 'text/html' }));
    await denied(put(alice, own('doc.pdf'), 16, { contentType: 'application/pdf' }));
  });
  test('another user\'s folder is denied, including overwriting their photo', async () => {
    const path = own('alices-photo.png');
    await put(alice, path);
    await denied(put(bob, path));
    await denied(put(bob, own('new.png')));
  });
  test('an admin cannot write into someone else\'s folder either', async () => {
    await denied(put(admin, own('new.png')));
  });
  test('signed out and anonymous accounts are denied', async () => {
    await denied(put(anon, own('photo.png')));
    await denied(put(anonymousAccount, own('photo.png', 'accommodations', 'anon-uid')));
  });
  test('an unknown listing type is denied', async () => {
    await denied(put(alice, own('photo.png', 'blog')));
  });
  test('paths outside the folder layout are denied', async () => {
    await denied(put(alice, 'submissions/photo.png'));
    await denied(put(alice, `submissions/accommodations/${ALICE}/nested/photo.png`));
  });
  test('deleting is denied, as before', async () => {
    const path = own('keep.png');
    await put(alice, path);
    await denied(deleteObject(ref(alice, path)));
  });
  test('anyone can read a submitted photo', async () => {
    const path = own('public.png');
    await put(alice, path);
    await getBytes(ref(anon, path));
  });
});

describe('image types', () => {
  const uploaders: [string, () => FirebaseStorage, string][] = [
    ['blog-images', () => admin, 'blog-images/type-check'],
    ['events', () => admin, 'events/type-check'],
    ['listings', () => admin, 'listings/accommodations/listing1/type-check'],
    ['towns', () => admin, 'towns/type-check'],
    ['submissions', () => alice, `submissions/accommodations/${ALICE}/type-check`],
  ];

  for (const [name, getStorageFor, path] of uploaders) {
    test(`${name} accepts PNG, JPEG and WEBP`, async () => {
      for (const contentType of ['image/png', 'image/jpeg', 'image/webp']) {
        await put(getStorageFor(), `${path}-${contentType.slice(6)}`, 16, { contentType });
      }
    });
    test(`${name} refuses SVG, GIF and other files`, async () => {
      for (const contentType of ['image/svg+xml', 'image/gif', 'text/html', 'application/pdf']) {
        await denied(put(getStorageFor(), `${path}-refused`, 16, { contentType }));
      }
    });
  }
});

describe('everything else', () => {
  test('unknown paths are closed to everyone', async () => {
    await denied(put(admin, 'other/file.png'));
    await denied(put(alice, 'other/file.png'));
    await denied(getBytes(ref(anon, 'other/file.png')));
  });
});
