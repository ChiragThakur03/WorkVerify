import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePathname,
  resolveCanonicalRoute,
  getRoleWorkspaceNavItems,
} from './navigationRouting';

test('normalizePathname strips trailing slashes and maps legacy recruiterProfile query param', () => {
  assert.equal(normalizePathname('/app/inspector/', ''), '/app/inspector');
  assert.equal(normalizePathname('/', ''), '/');
  assert.equal(
    normalizePathname('/', '?recruiterProfile=octocat-verified'),
    '/profile/octocat-verified'
  );
});

test('resolveCanonicalRoute keeps authenticated onboarded users inside /app/* workspace shell', () => {
  assert.equal(resolveCanonicalRoute('/', true, true), '/app');
  assert.equal(resolveCanonicalRoute('/login', true, true), '/app');
  assert.equal(resolveCanonicalRoute('/analyze', true, true), '/app/inspector');
  assert.equal(resolveCanonicalRoute('/applicant', true, true), '/app/job-match');
  assert.equal(
    resolveCanonicalRoute('/recruiter/assessment', true, true),
    '/app/assess'
  );
  assert.equal(resolveCanonicalRoute('/app/inspector', true, true), '/app/inspector');
  assert.equal(resolveCanonicalRoute('/app/skills', true, true), '/app/skills');
});

test('resolveCanonicalRoute routes authenticated un-onboarded users to /onboarding', () => {
  assert.equal(resolveCanonicalRoute('/app', true, false), '/onboarding');
  assert.equal(resolveCanonicalRoute('/analyze', true, false), '/onboarding');
  assert.equal(resolveCanonicalRoute('/', true, false), '/onboarding');
});

test('resolveCanonicalRoute preserves public landing page and maps /app/inspector for anonymous visitors', () => {
  assert.equal(resolveCanonicalRoute('/', false, false), '/');
  assert.equal(resolveCanonicalRoute('/analyze', false, false), '/analyze');
  assert.equal(resolveCanonicalRoute('/app/inspector', false, false), '/analyze');
  assert.equal(resolveCanonicalRoute('/login', false, false), '/login');
});

test('getRoleWorkspaceNavItems returns distinct role-specific navigation items including Public URL Inspector', () => {
  const counts = {
    skillsCount: 6,
    reposCount: 4,
    jobDescriptionsCount: 2,
    recruiterAssessmentsCount: 3,
  };

  const devNav = getRoleWorkspaceNavItems('developer', counts);
  assert.equal(devNav[0].path, '/app');
  assert.equal(devNav[0].label, 'Overview & Goals');
  assert.ok(devNav.some((i) => i.path === '/app/inspector' && i.label === 'Public URL Inspector'));
  assert.ok(devNav.some((i) => i.path === '/app/skills'));

  const recNav = getRoleWorkspaceNavItems('recruiter', counts);
  assert.equal(recNav[0].path, '/app');
  assert.ok(recNav[0].label.startsWith('Candidate Pipeline'));
  assert.ok(recNav.some((i) => i.path === '/app/assess' && i.label === 'Candidate Evaluator'));
  assert.ok(recNav.some((i) => i.path === '/app/inspector' && i.label === 'Public URL Inspector'));
  assert.ok(!recNav.some((i) => i.path === '/app/skills'));
});
