import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isVendorOrGeneratedFile,
  classifyCommitWorkCategory,
  normalizeAndAnalyzeRepository,
  evaluateSkillEvidence,
  RawRepositoryInput,
} from './verificationEngine';

const SAMPLE_NOW = '2026-10-26T06:00:00.000Z';

test('isVendorOrGeneratedFile excludes node_modules, lockfiles, dist, and minified bundles', () => {
  assert.equal(isVendorOrGeneratedFile('node_modules/react/index.js'), true);
  assert.equal(isVendorOrGeneratedFile('package-lock.json'), true);
  assert.equal(isVendorOrGeneratedFile('dist/assets/index.bundle.js'), true);
  assert.equal(isVendorOrGeneratedFile('src/vendor/chart.min.js'), true);
  assert.equal(isVendorOrGeneratedFile('src/components/SkillMatrix.tsx'), false);
  assert.equal(isVendorOrGeneratedFile('server/db/schema.sql'), false);
});

test('Step 5 Rule: package.json React dependency alone without candidate source commits yields Insufficient Evidence', () => {
  const dependencyOnlyRepo: RawRepositoryInput = {
    id: 'repo-dep-only',
    name: 'starter-template',
    fullName: 'candidate/starter-template',
    htmlUrl: 'https://github.com/candidate/starter-template',
    description: 'Boilerplate project with React listed in package.json only',
    isFork: false,
    primaryLanguage: 'JavaScript',
    languages: { JavaScript: 1200 },
    filePaths: ['package.json', 'package-lock.json', 'README.md'],
    manifests: [
      {
        fileName: 'package.json',
        dependencies: ['react', 'react-dom'],
      },
    ],
    commits: [
      {
        sha: 'a1b2c3d4e5f60001',
        message: 'Initial commit with package.json',
        date: '2026-09-10T10:00:00Z',
        authorName: 'Candidate Dev',
        authorLogin: 'candidate',
        htmlUrl: 'https://github.com/candidate/starter-template/commit/a1b2c3d4e5f60001',
        additions: 25,
        deletions: 0,
        filesChanged: ['package.json', 'README.md'],
      },
    ],
    pullRequests: [],
    starsCount: 0,
    hasReadme: true,
    createdAt: '2026-09-10T09:00:00Z',
    pushedAt: '2026-09-10T10:00:00Z',
  };

  const normalized = normalizeAndAnalyzeRepository(dependencyOnlyRepo, 'candidate', 'Candidate Dev');
  const assessment = evaluateSkillEvidence('React', true, [normalized], SAMPLE_NOW);

  assert.equal(assessment.evidenceBand, 'Insufficient Evidence');
  assert.ok(assessment.evidenceScore <= 15, `Expected score <= 15, got ${assessment.evidenceScore}`);
  assert.equal(assessment.breakdown.attributedWorkSignal, 0);
  assert.ok(
    assessment.missingOrWeakSignals.some((m) => m.includes('zero candidate-attributed source commits'))
  );
});

test('Step 4 Rule: Forked repository without candidate commits is isolated and never grants Strong/Moderate Evidence', () => {
  const forkedRepo: RawRepositoryInput = {
    id: 'repo-fork-1',
    name: 'fastapi-production-boilerplate',
    fullName: 'candidate/fastapi-production-boilerplate',
    htmlUrl: 'https://github.com/candidate/fastapi-production-boilerplate',
    description: 'Forked Python FastAPI repository',
    isFork: true,
    primaryLanguage: 'Python',
    languages: { Python: 84000 },
    filePaths: [
      'requirements.txt',
      'app/main.py',
      'app/routers/users.py',
      'app/models/item.py',
      'app/db/session.py',
    ],
    manifests: [
      {
        fileName: 'requirements.txt',
        dependencies: ['fastapi', 'uvicorn', 'sqlalchemy', 'pydantic'],
      },
    ],
    commits: [
      {
        sha: '9988776655443322',
        message: 'feat: add async sqlalchemy session pool',
        date: '2026-08-01T12:00:00Z',
        authorName: 'Upstream Maintainer',
        authorLogin: 'upstream-author',
        htmlUrl: 'https://github.com/candidate/fastapi-production-boilerplate/commit/9988776655443322',
        additions: 240,
        deletions: 15,
        filesChanged: ['app/main.py', 'app/db/session.py'],
      },
    ],
    pullRequests: [],
    starsCount: 0,
    hasReadme: true,
    createdAt: '2026-08-01T10:00:00Z',
    pushedAt: '2026-08-02T10:00:00Z',
  };

  const normalized = normalizeAndAnalyzeRepository(forkedRepo, 'candidate', 'Candidate Dev');
  assert.equal(normalized.isFork, true);
  assert.equal(normalized.candidateAttributedCommits, 0);

  const pythonAssessment = evaluateSkillEvidence('Python', true, [normalized], SAMPLE_NOW);
  assert.equal(pythonAssessment.evidenceBand, 'Insufficient Evidence');
  assert.ok(pythonAssessment.limitations.some((l) => l.includes('forked repository')));
});

test('Step 6 Rule: Raw commit spam (many tiny 1-line edits) does not produce Strong Evidence', () => {
  const tinyCommits = Array.from({ length: 12 }, (_, idx) => ({
    sha: `tinycommit000${idx}`,
    message: `chore: tweak spacing ${idx}`,
    date: '2026-10-01T12:00:00Z',
    authorName: 'Candidate Dev',
    authorLogin: 'candidate',
    htmlUrl: `https://github.com/candidate/tiny-edits/commit/tinycommit000${idx}`,
    additions: 2,
    deletions: 1,
    filesChanged: ['src/index.ts'],
  }));

  const spamRepo: RawRepositoryInput = {
    id: 'repo-spam',
    name: 'tiny-edits',
    fullName: 'candidate/tiny-edits',
    htmlUrl: 'https://github.com/candidate/tiny-edits',
    description: 'Repo with many 2-line commits on a single file',
    isFork: false,
    primaryLanguage: 'TypeScript',
    languages: { TypeScript: 900 },
    filePaths: ['package.json', 'tsconfig.json', 'src/index.ts'],
    manifests: [{ fileName: 'package.json', dependencies: [], devDependencies: ['typescript'] }],
    commits: tinyCommits,
    pullRequests: [],
    starsCount: 0,
    hasReadme: true,
    createdAt: '2026-10-01T10:00:00Z',
    pushedAt: '2026-10-01T14:00:00Z',
  };

  const normalized = normalizeAndAnalyzeRepository(spamRepo, 'candidate', 'Candidate Dev');
  assert.equal(normalized.candidateAttributedCommits, 12);
  assert.equal(normalized.substantiveAttributedCommits, 0);

  const tsAssessment = evaluateSkillEvidence('TypeScript', true, [normalized], SAMPLE_NOW);
  assert.notEqual(tsAssessment.evidenceBand, 'Strong Evidence');
  assert.notEqual(tsAssessment.evidenceBand, 'Moderate Evidence');
  assert.equal(tsAssessment.evidenceBand, 'Weak Evidence');
});

test('Step 8 Rule: Multi-repository substantive contributions across React & TypeScript yield Strong Evidence', () => {
  const makeSubstantiveRepo = (id: string, name: string): RawRepositoryInput => ({
    id,
    name,
    fullName: `candidate/${name}`,
    htmlUrl: `https://github.com/candidate/${name}`,
    description: 'Production TypeScript and React application',
    isFork: false,
    primaryLanguage: 'TypeScript',
    languages: { TypeScript: 48000, CSS: 4200 },
    filePaths: [
      'package.json',
      'tsconfig.json',
      'src/App.tsx',
      'src/components/Dashboard.tsx',
      'src/components/EvidenceTable.tsx',
      'src/hooks/useVerification.ts',
      'src/utils/parser.ts',
      'node_modules/react/index.js',
    ],
    manifests: [
      {
        fileName: 'package.json',
        dependencies: ['react', 'react-dom'],
        devDependencies: ['typescript', 'vite'],
      },
    ],
    commits: [
      {
        sha: `${id}-sha-1`,
        message: 'feat: implement evidence matrix table and filter controls',
        date: '2026-07-15T10:00:00Z',
        authorName: 'Candidate Dev',
        authorLogin: 'candidate',
        htmlUrl: `https://github.com/candidate/${name}/commit/${id}-sha-1`,
        additions: 145,
        deletions: 12,
        filesChanged: ['src/App.tsx', 'src/components/EvidenceTable.tsx'],
      },
      {
        sha: `${id}-sha-2`,
        message: 'fix: resolve state sync issue in useVerification hook',
        date: '2026-09-20T15:30:00Z',
        authorName: 'Candidate Dev',
        authorLogin: 'candidate',
        htmlUrl: `https://github.com/candidate/${name}/commit/${id}-sha-2`,
        additions: 64,
        deletions: 19,
        filesChanged: ['src/hooks/useVerification.ts', 'src/components/Dashboard.tsx'],
      },
      {
        sha: `${id}-sha-3`,
        message: 'feat: add deterministic parser and breakdown drawer',
        date: '2026-10-18T11:00:00Z',
        authorName: 'Candidate Dev',
        authorLogin: 'candidate',
        htmlUrl: `https://github.com/candidate/${name}/commit/${id}-sha-3`,
        additions: 112,
        deletions: 8,
        filesChanged: ['src/utils/parser.ts', 'src/components/Dashboard.tsx'],
      },
    ],
    pullRequests: [],
    starsCount: 14,
    hasReadme: true,
    createdAt: '2026-07-01T00:00:00Z',
    pushedAt: '2026-10-18T11:00:00Z',
  });

  const repo1 = normalizeAndAnalyzeRepository(makeSubstantiveRepo('r1', 'work-verify-ui'), 'candidate');
  const repo2 = normalizeAndAnalyzeRepository(makeSubstantiveRepo('r2', 'telemetry-console'), 'candidate');

  const reactAssessment = evaluateSkillEvidence('React', true, [repo1, repo2], SAMPLE_NOW);
  assert.equal(reactAssessment.evidenceBand, 'Strong Evidence');
  assert.ok(reactAssessment.evidenceScore >= 75);
  assert.equal(reactAssessment.supportingRepos.length, 2);

  const commitCategory = classifyCommitWorkCategory(
    'fix: resolve state sync issue in useVerification hook',
    ['src/hooks/useVerification.ts']
  );
  assert.equal(commitCategory, 'Bug Fixing');
});

test('Zero-File Invariant: Frontend repositories with zero backend/server files yield Insufficient Evidence (score <= 15) for Node.js', () => {
  const frontendOnlyRepo: RawRepositoryInput = {
    id: 'repo-frontend-only',
    name: 'stratxcel-frontend',
    fullName: 'candidate/stratxcel-frontend',
    htmlUrl: 'https://github.com/candidate/stratxcel-frontend',
    description: 'React + Vite frontend application',
    isFork: false,
    primaryLanguage: 'TypeScript',
    languages: { TypeScript: 95000, CSS: 5000 },
    filePaths: [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'src/App.tsx',
      'src/main.tsx',
      'src/components/Hero.tsx',
      'src/components/About.tsx',
      'src/hooks/useSmoothScroll.ts',
      'src/index.css',
    ],
    manifests: [
      {
        fileName: 'package.json',
        dependencies: ['react', 'react-dom', 'framer-motion'],
        devDependencies: ['vite', 'typescript'],
      },
    ],
    commits: [
      {
        sha: 'fe1234567890aaaa',
        message: 'feat: add interactive hero section and smooth scroll',
        date: '2026-10-15T12:00:00Z',
        authorName: 'Candidate Dev',
        authorLogin: 'candidate',
        htmlUrl: 'https://github.com/candidate/stratxcel-frontend/commit/fe1234567890aaaa',
        additions: 150,
        deletions: 12,
        filesChanged: ['src/App.tsx', 'src/components/Hero.tsx'],
      },
    ],
    pullRequests: [],
    starsCount: 3,
    hasReadme: true,
    createdAt: '2026-08-01T00:00:00Z',
    pushedAt: '2026-10-15T12:00:00Z',
  };

  const normalized = normalizeAndAnalyzeRepository(frontendOnlyRepo, 'candidate', 'Candidate Dev');

  // React should have verified source files
  const reactAssessment = evaluateSkillEvidence('React', true, [normalized], SAMPLE_NOW);
  assert.ok(reactAssessment.breakdown.sourceFilesSignal > 0);

  // Node.js MUST NOT be verified: zero server files, zero backend manifests
  const nodeAssessment = evaluateSkillEvidence('Node.js', true, [normalized], SAMPLE_NOW);
  assert.equal(nodeAssessment.evidenceBand, 'Insufficient Evidence');
  assert.equal(nodeAssessment.breakdown.sourceFilesSignal, 0);
  assert.ok(
    nodeAssessment.evidenceScore <= 15,
    `Expected Node.js score <= 15 for frontend repo, got ${nodeAssessment.evidenceScore}`
  );
  assert.equal(
    nodeAssessment.supportingRepos.length,
    0,
    'Frontend repo with 0 Node.js files must not be listed as a supporting repo for Node.js'
  );
});
