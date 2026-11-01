/**
 * Checks the ?redirect= handling shared by /login and /signup: only paths on this
 * site are followed, so a crafted link can't send someone elsewhere after sign-in.
 *
 * Usage:
 *   npx tsx scripts/test-auth-redirect.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPostAuthPath, getRedirectFromSearch, getSafeRedirectPath, withRedirect } from '../src/lib/auth-redirect';

test('same-site paths are allowed', () => {
  for (const path of ['/', '/admin', '/accommodations/casa-abc123', '/accommodations/casa-abc123#reviews', '/towns?province=gauteng']) {
    assert.equal(getSafeRedirectPath(path), path);
  }
});

test('anything that could leave the site is refused', () => {
  const unsafe = [
    'https://evil.com',
    'http://evil.com',
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r\n/evil.com',
    'javascript:alert(1)',
    'evil.com',
    ' /admin',
    ' //evil.com',
  ];
  for (const path of unsafe) {
    assert.equal(getSafeRedirectPath(path), null, JSON.stringify(path));
  }
});

test('a missing redirect is refused', () => {
  assert.equal(getSafeRedirectPath(null), null);
  assert.equal(getSafeRedirectPath(undefined), null);
  assert.equal(getSafeRedirectPath(''), null);
});

test('after signing in you go to the redirect, else the dashboard', () => {
  assert.equal(getPostAuthPath('?redirect=%2Faccommodations%2Fcasa-abc123%23reviews'), '/accommodations/casa-abc123#reviews');
  assert.equal(getPostAuthPath(''), '/dashboard');
  assert.equal(getPostAuthPath('?redirect=https%3A%2F%2Fevil.com'), '/dashboard');
  assert.equal(getPostAuthPath('?redirect=%2F%2Fevil.com'), '/dashboard');
  assert.equal(getPostAuthPath('?redirect=%2F%09%2Fevil.com'), '/dashboard');
});

test('links between login and sign-up keep the redirect', () => {
  const back = '/accommodations/casa-abc123#reviews';
  const href = withRedirect('/signup', back);
  assert.equal(href, '/signup?redirect=%2Faccommodations%2Fcasa-abc123%23reviews');
  assert.equal(getRedirectFromSearch(href.slice(href.indexOf('?'))), back);
  assert.equal(withRedirect('/login', null), '/login');
});
