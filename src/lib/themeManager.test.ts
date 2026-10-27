import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTheme,
  getNextTheme,
  resolveInitialTheme,
} from './themeManager.ts';

test('normalizeTheme returns valid light or dark theme values', () => {
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('  DARK '), 'dark');
  assert.equal(normalizeTheme('invalid', 'light'), 'light');
  assert.equal(normalizeTheme(null, 'dark'), 'dark');
});

test('getNextTheme toggles between light and dark deterministically', () => {
  assert.equal(getNextTheme('light'), 'dark');
  assert.equal(getNextTheme('dark'), 'light');
});

test('resolveInitialTheme prioritizes saved user preference over system preference', () => {
  assert.equal(resolveInitialTheme('dark', false), 'dark');
  assert.equal(resolveInitialTheme('light', true), 'light');
  assert.equal(resolveInitialTheme(null, true), 'dark');
  assert.equal(resolveInitialTheme(null, false), 'light');
  assert.equal(resolveInitialTheme(undefined, undefined), 'light');
});
