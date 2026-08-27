/**
 * CSRF client support (double-submit / synchronizer token).
 *
 * The API issues a per-session token at login/setup and returns it from
 * /api/auth/me. This module stores it in sessionStorage and injects it into
 * every same-origin state-changing /api request as the X-CSRF-Token header,
 * which the server's csrfProtect middleware requires from browsers.
 * Server-to-server scripts (no Origin header) are exempt on the server side.
 */
const CSRF_STORAGE_KEY = 'dme_csrf_token';

export function storeCsrfToken(token: string | null) {
  if (token) sessionStorage.setItem(CSRF_STORAGE_KEY, token);
  else sessionStorage.removeItem(CSRF_STORAGE_KEY);
}

export function getCsrfToken(): string | null {
  try {
    return sessionStorage.getItem(CSRF_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function installCsrfClient() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      window.location.origin,
    );
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const token = getCsrfToken();
    if (
      url.pathname.startsWith('/api/') &&
      method !== 'GET' &&
      method !== 'HEAD' &&
      method !== 'OPTIONS' &&
      token
    ) {
      init = {
        ...init,
        headers: { ...(init?.headers ?? {}), 'X-CSRF-Token': token },
      };
    }
    return originalFetch(input, init);
  };
}
