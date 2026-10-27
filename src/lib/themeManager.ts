export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'workverify_theme';

export function normalizeTheme(value: unknown, fallback: AppTheme = 'light'): AppTheme {
  if (value === 'dark' || value === 'light') {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase();
    if (cleaned === 'dark') return 'dark';
    if (cleaned === 'light') return 'light';
  }
  return fallback;
}

export function getNextTheme(current: AppTheme): AppTheme {
  return current === 'dark' ? 'light' : 'dark';
}

export function resolveInitialTheme(
  storedValue?: string | null,
  prefersDark?: boolean
): AppTheme {
  if (storedValue === 'dark' || storedValue === 'light') {
    return storedValue;
  }
  if (typeof prefersDark === 'boolean') {
    return prefersDark ? 'dark' : 'light';
  }
  return 'light';
}

export function readBrowserTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') {
    return attr;
  }
  return 'light';
}

export function applyThemeToDocument(theme: AppTheme): void {
  const normalized = normalizeTheme(theme);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', normalized);
    document.documentElement.classList.toggle('dark', normalized === 'dark');
    document.documentElement.style.colorScheme = normalized;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage access errors
    }
  }
}
