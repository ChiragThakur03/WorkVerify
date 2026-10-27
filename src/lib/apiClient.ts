const SESSION_TOKEN_KEY = 'wv_auth_session_token';
const ANON_SESSION_KEY = 'wv_anon_session_id';

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage restriction
  }
}

export function getOrCreateAnonSessionId(): string {
  try {
    let existing = localStorage.getItem(ANON_SESSION_KEY);
    if (!existing) {
      existing = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(ANON_SESSION_KEY, existing);
    }
    return existing;
  } catch {
    return 'anon_ephemeral';
  }
}

export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getStoredSessionToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-wv-session', token);
  }
  headers.set('x-wv-anon-id', getOrCreateAnonSessionId());
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}
