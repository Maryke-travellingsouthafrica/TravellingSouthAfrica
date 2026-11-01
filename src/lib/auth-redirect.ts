const SAME_SITE_BASE = 'https://same-site.invalid';

/**
 * The given ?redirect= value if it stays on this site, else null. Parsing it the
 * way a browser would catches tricks a prefix check misses, such as "//evil.com",
 * "/\evil.com" and "/<tab>/evil.com".
 */
export function getSafeRedirectPath(redirect: string | null | undefined): string | null {
  if (!redirect || !redirect.startsWith('/')) return null;
  try {
    return new URL(redirect, SAME_SITE_BASE).origin === SAME_SITE_BASE ? redirect : null;
  } catch {
    return null;
  }
}

/** The safe ?redirect= path in a query string such as window.location.search, or null. */
export function getRedirectFromSearch(search: string) {
  return getSafeRedirectPath(new URLSearchParams(search).get('redirect'));
}

/** Where to send someone after they log in or sign up. */
export function getPostAuthPath(search: string) {
  return getRedirectFromSearch(search) ?? '/dashboard';
}

/** A link to /login or /signup that keeps the page they should come back to. */
export function withRedirect(path: '/login' | '/signup', redirect: string | null) {
  return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}
