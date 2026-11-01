/**
 * Points the Firebase SDK at the local emulators when NEXT_PUBLIC_USE_EMULATORS is
 * set, in the browser and on the server alike. The SDK reads this setting itself
 * when getAuth(), getFirestore(), getStorage() and getFunctions() first run, which
 * covers every place the app calls them. (The client SDK ignores
 * FIRESTORE_EMULATOR_HOST, which only the Admin SDK reads.)
 *
 * Imported by config.ts so it always runs first. Without the flag, and in any
 * production build, this does nothing.
 */
if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && process.env.NODE_ENV !== 'production') {
  (globalThis as { __FIREBASE_DEFAULTS__?: unknown }).__FIREBASE_DEFAULTS__ = {
    emulatorHosts: {
      auth: '127.0.0.1:9099',
      firestore: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
      storage: '127.0.0.1:9199',
      functions: '127.0.0.1:5001',
    },
  };
}

export {};
