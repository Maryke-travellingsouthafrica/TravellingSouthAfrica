/**
 * Checks the admin lists in firestore.rules and storage.rules match
 * functions/src/admin-emails.json, which the app and the Cloud Functions both
 * import. Rules can't import files, so this is what keeps the copies honest.
 *
 * Usage:
 *   npx tsx scripts/test-admin-emails.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ADMIN_EMAILS from '../functions/src/admin-emails.json';

function adminEmailsIn(rulesFile: string) {
  const rules = readFileSync(path.join(__dirname, '..', rulesFile), 'utf8');
  const list = rules.match(/function isAdmin\(\)[\s\S]*?request\.auth\.token\.email in \[([\s\S]*?)\]/);
  assert.ok(list, `Could not find the admin list in ${rulesFile}`);
  return Array.from(list[1].matchAll(/'([^']+)'/g), (match) => match[1]);
}

for (const rulesFile of ['firestore.rules', 'storage.rules']) {
  test(`${rulesFile} has the same admins as admin-emails.json`, () => {
    assert.deepEqual([...adminEmailsIn(rulesFile)].sort(), [...ADMIN_EMAILS].sort());
  });
}

test('the admin list has no duplicates or blanks', () => {
  assert.equal(new Set(ADMIN_EMAILS).size, ADMIN_EMAILS.length);
  assert.ok(ADMIN_EMAILS.length > 0);
  assert.ok(ADMIN_EMAILS.every((email) => /^[^\s@]+@[^\s@]+$/.test(email)));
});
