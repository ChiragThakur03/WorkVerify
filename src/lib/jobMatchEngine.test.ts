import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubTargetUrl } from './jobMatchEngine.ts';

describe('parseGitHubTargetUrl — URL and Shorthand Validation', () => {
  it('parses full HTTPS profile and repository URLs', () => {
    const prof = parseGitHubTargetUrl('https://github.com/sindresorhus');
    assert.equal(prof.valid, true);
    assert.equal(prof.type, 'profile');
    assert.equal(prof.owner, 'sindresorhus');
    assert.equal(prof.canonicalUrl, 'https://github.com/sindresorhus');

    const repo = parseGitHubTargetUrl('https://github.com/facebook/react');
    assert.equal(repo.valid, true);
    assert.equal(repo.type, 'repository');
    assert.equal(repo.owner, 'facebook');
    assert.equal(repo.repo, 'react');
    assert.equal(repo.canonicalUrl, 'https://github.com/facebook/react');
  });

  it('parses shorthand usernames, @usernames, owner/repo, and www.github.com links with query strings or subpaths', () => {
    const shorthandRepo = parseGitHubTargetUrl('github.com/vercel/next.js/tree/canary?tab=readme-ov-file#getting-started');
    assert.equal(shorthandRepo.valid, true);
    assert.equal(shorthandRepo.type, 'repository');
    assert.equal(shorthandRepo.owner, 'vercel');
    assert.equal(shorthandRepo.repo, 'next.js');

    const wwwProfile = parseGitHubTargetUrl('www.github.com/octocat?tab=repositories');
    assert.equal(wwwProfile.valid, true);
    assert.equal(wwwProfile.type, 'profile');
    assert.equal(wwwProfile.owner, 'octocat');

    const atUser = parseGitHubTargetUrl('@torvalds');
    assert.equal(atUser.valid, true);
    assert.equal(atUser.type, 'profile');
    assert.equal(atUser.owner, 'torvalds');
  });

  it('rejects non-GitHub hosts and reserved GitHub paths', () => {
    const gitlab = parseGitHubTargetUrl('https://gitlab.com/owner/repo');
    assert.equal(gitlab.valid, false);

    const reserved = parseGitHubTargetUrl('https://github.com/settings');
    assert.equal(reserved.valid, false);
  });
});
