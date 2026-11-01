/**
 * Helpers behind the local testing npm scripts. Everything is tied to the demo-
 * project in .env.development.local, so the production project in .firebaserc is
 * never used.
 *
 *   node scripts/emulators.mjs start   builds the functions and starts the emulators,
 *                                      keeping their data in ./emulator-data
 *   node scripts/emulators.mjs check   stops `npm run dev:emulators` from starting
 *                                      unless the flag is set and the emulators are up
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const ENV_FILE = '.env.development.local';
const DATA_DIR = './emulator-data';

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function loadEmulatorEnv() {
  if (!existsSync(ENV_FILE)) fail(`${ENV_FILE} is missing, so the emulators can't be used.`);
  const env = parse(readFileSync(ENV_FILE));
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
  if (env.NEXT_PUBLIC_USE_EMULATORS !== 'true') fail(`NEXT_PUBLIC_USE_EMULATORS must be true in ${ENV_FILE}.`);
  if (!projectId.startsWith('demo-')) fail(`NEXT_PUBLIC_FIREBASE_PROJECT_ID must be a demo- project in ${ENV_FILE}, not "${projectId}".`);
  return { projectId };
}

// The UI starts last, so it answering means the other emulators are ready too.
async function emulatorsAreRunning() {
  try {
    return (await fetch('http://127.0.0.1:4000/', { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}

async function check() {
  loadEmulatorEnv();
  if (!(await emulatorsAreRunning())) fail('The emulators are not running. Start them first with: npm run emulators');
}

function start() {
  const { projectId } = loadEmulatorEnv();

  const build = spawnSync('npm', ['--prefix', 'functions', 'run', 'build'], { stdio: 'inherit', shell: true });
  if (build.status !== 0) fail('The functions build failed, so the emulators were not started.');

  mkdirSync(DATA_DIR, { recursive: true });

  const emulators = spawn(
    'firebase',
    ['emulators:start', '--project', projectId, `--import=${DATA_DIR}`, `--export-on-exit=${DATA_DIR}`],
    // The emulator's first load of the functions can pass the default 10 second limit.
    { stdio: 'inherit', shell: true, env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: '120' } }
  );

  // Ctrl+C reaches the emulators too, and they need to stay alive long enough to export their data.
  process.on('SIGINT', () => {});
  emulators.on('exit', (code) => process.exit(code ?? 0));
}

const command = process.argv[2];
if (command === 'start') start();
else if (command === 'check') await check();
else fail('Usage: node scripts/emulators.mjs start|check');
