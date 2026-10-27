/**
 * WorkVerify — Deterministic Technology Detection, Contribution Analysis,
 * and Skill Claim Evidence Scoring Engine.
 *
 * Core Principles:
 * 1. Scores represent Evidence Strength (0-100 points mapped to deterministic bands),
 *    NEVER a percentage of personal expertise.
 * 2. Dependency manifest presence alone (e.g. "react" in package.json) is only an
 *    initial signal (max 15 pts) and automatically resolves to "Insufficient Evidence"
 *    without candidate-attributed source file commits.
 * 3. Forked repositories are labeled and isolated; unauthored code in a fork never
 *    counts as candidate-attributed evidence.
 * 4. Vendor, lockfile, and generated artifacts (node_modules, dist, package-lock.json, etc.)
 *    are excluded before technology detection and contribution analysis.
 * 5. Raw commit count does not equal skill: many tiny 1-line commits are normalized
 *    against substantive code changes, file breadth, and multi-week continuity.
 */

export type EvidenceBand =
  | 'Strong Evidence'
  | 'Moderate Evidence'
  | 'Weak Evidence'
  | 'Insufficient Evidence';

export type WorkCategory =
  | 'Feature Development'
  | 'Bug Fixing'
  | 'Testing & Quality'
  | 'Documentation'
  | 'Maintenance & Config';

export interface RawCommitRecord {
  sha: string;
  message: string;
  date: string;
  authorName: string;
  authorLogin: string;
  authorEmail?: string;
  htmlUrl: string;
  additions: number;
  deletions: number;
  filesChanged: string[];
}

export interface RawPullRequestRecord {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  mergedAt?: string | null;
  authorLogin: string;
  htmlUrl: string;
  bodySnippet?: string;
}

export interface DependencyManifest {
  fileName: string; // e.g., 'package.json', 'requirements.txt', 'Cargo.toml', 'pom.xml'
  dependencies: string[];
  devDependencies?: string[];
  htmlUrl?: string;
}

export interface RawRepositoryInput {
  id: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string;
  isFork: boolean;
  primaryLanguage: string | null;
  languages: Record<string, number>; // bytes per language
  filePaths: string[];
  manifests: DependencyManifest[];
  commits: RawCommitRecord[];
  pullRequests: RawPullRequestRecord[];
  starsCount: number;
  hasReadme: boolean;
  createdAt: string;
  pushedAt: string;
}

export interface ProcessedCommit extends RawCommitRecord {
  isCandidateAttributed: boolean;
  workCategory: WorkCategory;
  meaningfulFilesChanged: string[];
  excludedFilesCount: number;
  isSubstantiveChange: boolean;
}

export interface NormalizedRepository {
  id: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string;
  isFork: boolean;
  isEmptyOrInsufficient: boolean;
  primaryLanguage: string | null;
  languages: Record<string, number>;
  meaningfulFilePaths: string[];
  excludedVendorFilesCount: number;
  manifests: DependencyManifest[];
  detectedTechnologies: DetectedTechSignal[];
  commits: ProcessedCommit[];
  pullRequests: RawPullRequestRecord[];
  totalCommitsSampled: number;
  candidateAttributedCommits: number;
  substantiveAttributedCommits: number;
  activitySpanDays: number;
  workBreakdown: Record<WorkCategory, number>;
  dataQualityNotes: string[];
  starsCount: number;
  hasReadme: boolean;
  createdAt: string;
  pushedAt: string;
}

export interface DetectedTechSignal {
  skillName: string;
  category: 'Language' | 'Framework' | 'Database & Data' | 'Infrastructure & Tooling';
  fromManifest: boolean;
  manifestSources: string[];
  fromLanguageMetadata: boolean;
  matchingSourceFiles: string[];
  attributedCommitCount: number;
  substantiveCommitCount: number;
  attributedCommitShas: { sha: string; message: string; htmlUrl: string; date: string }[];
}

export interface EvidenceScoreBreakdown {
  manifestSignal: number; // 0 - 15
  sourceFilesSignal: number; // 0 - 25
  attributedWorkSignal: number; // 0 - 30
  multiRepoConsistency: number; // 0 - 15
  recencyAndContinuity: number; // 0 - 15
  totalScore: number; // 0 - 100
}

export interface SkillAssessmentResult {
  skillName: string;
  category: 'Language' | 'Framework' | 'Database & Data' | 'Infrastructure & Tooling';
  claimedByUser: boolean;
  systemDetected: boolean;
  evidenceBand: EvidenceBand;
  evidenceScore: number;
  breakdown: EvidenceScoreBreakdown;
  supportingRepos: {
    repoName: string;
    fullName: string;
    htmlUrl: string;
    isFork: boolean;
    matchingFilesCount: number;
    attributedCommitsCount: number;
    manifestNames: string[];
  }[];
  supportingCommits: {
    sha: string;
    shortSha: string;
    repoName: string;
    message: string;
    date: string;
    htmlUrl: string;
    workCategory: WorkCategory;
  }[];
  positiveSignals: string[];
  missingOrWeakSignals: string[];
  limitations: string[];
  assessedAt: string;
}

export interface TechRuleDefinition {
  canonicalName: string;
  aliases: string[];
  category: 'Language' | 'Framework' | 'Database & Data' | 'Infrastructure & Tooling';
  extensions: string[];
  manifestPackages: string[];
  languageKeys: string[];
  pathPatterns: RegExp[];
}

export const SUPPORTED_TECHNOLOGIES: TechRuleDefinition[] = [
  {
    canonicalName: 'TypeScript',
    aliases: ['ts', 'typescript'],
    category: 'Language',
    extensions: ['.ts', '.tsx'],
    manifestPackages: ['typescript', 'ts-node', 'tsx'],
    languageKeys: ['TypeScript'],
    pathPatterns: [/tsconfig\.json$/i],
  },
  {
    canonicalName: 'JavaScript',
    aliases: ['js', 'javascript', 'ecmascript', 'es6'],
    category: 'Language',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    manifestPackages: ['eslint', 'vite', 'webpack'],
    languageKeys: ['JavaScript'],
    pathPatterns: [],
  },
  {
    canonicalName: 'React',
    aliases: ['reactjs', 'react.js', 'react'],
    category: 'Framework',
    extensions: ['.tsx', '.jsx'],
    manifestPackages: ['react', 'react-dom'],
    languageKeys: [],
    pathPatterns: [/components\/.*\.(tsx|jsx)$/i, /hooks\/use[A-Z].*\.(ts|tsx|js|jsx)$/i, /App\.(tsx|jsx)$/i],
  },
  {
    canonicalName: 'Next.js',
    aliases: ['nextjs', 'next', 'next.js'],
    category: 'Framework',
    extensions: [],
    manifestPackages: ['next'],
    languageKeys: [],
    pathPatterns: [/next\.config\.(js|mjs|ts)$/i, /app\/.*\/page\.(tsx|jsx|js)$/i, /pages\/.*\.(tsx|jsx)$/i],
  },
  {
    canonicalName: 'Node.js',
    aliases: ['nodejs', 'node', 'node.js', 'express'],
    category: 'Framework',
    extensions: ['.ts', '.js', '.mjs'],
    manifestPackages: ['express', 'fastify', 'nestjs', '@nestjs/core', 'koa', 'ws', 'dotenv'],
    languageKeys: [],
    pathPatterns: [/server\.(ts|js)$/i, /routes\/.*\.(ts|js)$/i, /controllers\/.*\.(ts|js)$/i, /middleware\/.*\.(ts|js)$/i],
  },
  {
    canonicalName: 'Python',
    aliases: ['py', 'python', 'python3', 'fastapi', 'django', 'flask'],
    category: 'Language',
    extensions: ['.py'],
    manifestPackages: ['fastapi', 'django', 'flask', 'pydantic', 'pytest', 'numpy', 'pandas', 'uvicorn', 'sqlalchemy'],
    languageKeys: ['Python'],
    pathPatterns: [/requirements\.txt$/i, /pyproject\.toml$/i],
  },
  {
    canonicalName: 'SQL & PostgreSQL',
    aliases: ['sql', 'postgresql', 'postgres', 'supabase', 'prisma', 'drizzle'],
    category: 'Database & Data',
    extensions: ['.sql', '.prisma'],
    manifestPackages: ['pg', 'prisma', '@prisma/client', 'drizzle-orm', '@supabase/supabase-js', 'typeorm', 'sequelize', 'psycopg2'],
    languageKeys: ['PLpgSQL', 'SQL', 'TSQL'],
    pathPatterns: [/migrations\/.*\.sql$/i, /schema\.(sql|prisma|ts)$/i, /db\/.*\.(ts|js|py|sql)$/i],
  },
  {
    canonicalName: 'Java',
    aliases: ['java', 'spring', 'spring boot', 'jvm'],
    category: 'Language',
    extensions: ['.java'],
    manifestPackages: ['spring-boot-starter', 'junit', 'lombok', 'hibernate-core'],
    languageKeys: ['Java'],
    pathPatterns: [/pom\.xml$/i, /build\.gradle$/i, /src\/main\/java\/.*\.java$/i],
  },
  {
    canonicalName: 'C / C++',
    aliases: ['c', 'c++', 'cpp', 'cxx'],
    category: 'Language',
    extensions: ['.c', '.cpp', '.cc', '.h', '.hpp'],
    manifestPackages: ['cmake', 'conan'],
    languageKeys: ['C', 'C++'],
    pathPatterns: [/CMakeLists\.txt$/i, /Makefile$/i],
  },
  {
    canonicalName: 'HTML & CSS',
    aliases: ['html', 'css', 'tailwindcss', 'tailwind', 'html/css', 'scss'],
    category: 'Language',
    extensions: ['.html', '.css', '.scss'],
    manifestPackages: ['tailwindcss', '@tailwindcss/vite', 'postcss', 'sass', 'autoprefixer'],
    languageKeys: ['HTML', 'CSS', 'SCSS'],
    pathPatterns: [/tailwind\.config\.(js|ts)$/i, /index\.css$/i, /styles\/.*\.css$/i],
  },
  {
    canonicalName: 'Go',
    aliases: ['golang', 'go'],
    category: 'Language',
    extensions: ['.go'],
    manifestPackages: ['gin-gonic', 'cobra', 'gorm'],
    languageKeys: ['Go'],
    pathPatterns: [/go\.mod$/i, /cmd\/.*\.go$/i, /internal\/.*\.go$/i],
  },
  {
    canonicalName: 'Rust',
    aliases: ['rust', 'cargo', 'rs'],
    category: 'Language',
    extensions: ['.rs'],
    manifestPackages: ['tokio', 'serde', 'axum', 'actix-web'],
    languageKeys: ['Rust'],
    pathPatterns: [/Cargo\.toml$/i, /src\/lib\.rs$/i, /src\/main\.rs$/i],
  },
  {
    canonicalName: 'Docker & CI/CD',
    aliases: ['docker', 'containers', 'github actions', 'ci/cd'],
    category: 'Infrastructure & Tooling',
    extensions: ['.dockerfile', '.yml', '.yaml'],
    manifestPackages: [],
    languageKeys: ['Dockerfile'],
    pathPatterns: [/Dockerfile$/i, /docker-compose\.ya?ml$/i, /\.github\/workflows\/.*\.ya?ml$/i],
  },
];

const VENDOR_AND_GENERATED_PATTERNS: RegExp[] = [
  /(^|\/)node_modules\//i,
  /(^|\/)vendor\//i,
  /(^|\/)dist\//i,
  /(^|\/)build\//i,
  /(^|\/)\.next\//i,
  /(^|\/)out\//i,
  /(^|\/)coverage\//i,
  /(^|\/)__pycache__\//i,
  /(^|\/)\.venv\//i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /Cargo\.lock$/i,
  /poetry\.lock$/i,
  /\.min\.(js|css)$/i,
  /\.bundle\.js$/i,
  /\.map$/i,
  /\.DS_Store$/i,
];

/**
 * Step 4 helper: Checks whether a file path is a vendor, lockfile, or generated build artifact.
 */
export function isVendorOrGeneratedFile(filePath: string): boolean {
  const normalized = filePath.trim().replace(/\\/g, '/');
  if (!normalized) return true;
  return VENDOR_AND_GENERATED_PATTERNS.some((regex) => regex.test(normalized));
}

/**
 * Step 6 helper: Classifies commit work category from commit message and touched files.
 */
export function classifyCommitWorkCategory(
  message: string,
  meaningfulFiles: string[]
): WorkCategory {
  const msg = message.toLowerCase().trim();

  if (
    meaningfulFiles.length > 0 &&
    meaningfulFiles.every((f) => /\.(md|txt|rst)$/i.test(f) || /^docs\//i.test(f))
  ) {
    return 'Documentation';
  }
  if (/^(docs|doc)(\(.*\))?:|\breadme\b|\bdocumentation\b|\bjavadoc\b|\bcomment/i.test(msg)) {
    return 'Documentation';
  }

  if (
    meaningfulFiles.length > 0 &&
    meaningfulFiles.every((f) => /\.(test|spec)\.(ts|tsx|js|jsx|py|go|java)$/i.test(f) || /__tests__\//i.test(f))
  ) {
    return 'Testing & Quality';
  }
  if (/^(test|tests|refactor)(\(.*\))?:|\bunit test|\bintegration test|\bcoverage\b/i.test(msg)) {
    return 'Testing & Quality';
  }

  if (/^(fix|bug|hotfix|patch)(\(.*\))?:|\bfix(ed|es|ing)?\b|\bbug\b|\bresolve[sd]?\b|\bcrash\b|\bissue\b/i.test(msg)) {
    return 'Bug Fixing';
  }

  if (/^(chore|ci|build|deps|bump|release)(\(.*\))?:|\bdependenc(y|ies)\b|\bupgrade\b|\blint\b|\bconfig\b/i.test(msg)) {
    return 'Maintenance & Config';
  }

  return 'Feature Development';
}

/**
 * Checks if a commit belongs to the candidate based on GitHub username or full name.
 */
export function isCommitAttributedToCandidate(
  commit: RawCommitRecord,
  candidateGithubUsername: string,
  candidateName?: string
): boolean {
  const targetLogin = candidateGithubUsername.trim().toLowerCase();
  if (!targetLogin) return false;

  const commitLogin = (commit.authorLogin || '').trim().toLowerCase();
  const commitName = (commit.authorName || '').trim().toLowerCase();

  // Exclude automated bots
  if (
    commitLogin.includes('[bot]') ||
    commitLogin === 'dependabot' ||
    commitLogin === 'renovate' ||
    commitLogin === 'github-actions'
  ) {
    return false;
  }

  if (commitLogin && commitLogin === targetLogin) {
    return true;
  }

  if (candidateName && candidateName.trim().length >= 3) {
    const normalizedCandidateName = candidateName.trim().toLowerCase();
    if (commitName === normalizedCandidateName || commitName === targetLogin) {
      return true;
    }
  }

  return false;
}

/**
 * Canonicalizes a skill claim name to match our supported catalog or returns a clean title-case custom skill.
 */
export function resolveCanonicalSkill(inputSkill: string): TechRuleDefinition {
  const cleaned = inputSkill.trim().toLowerCase();
  for (const tech of SUPPORTED_TECHNOLOGIES) {
    if (
      tech.canonicalName.toLowerCase() === cleaned ||
      tech.aliases.some((a) => a.toLowerCase() === cleaned)
    ) {
      return tech;
    }
  }
  // Custom technology fallback
  const safeToken = cleaned.replace(/[^a-z0-9]/g, '');
  return {
    canonicalName: inputSkill.trim(),
    aliases: [cleaned],
    category: 'Framework',
    extensions: safeToken ? [`.${safeToken}`] : [],
    manifestPackages: [cleaned],
    languageKeys: [inputSkill.trim()],
    pathPatterns: safeToken ? [new RegExp(safeToken, 'i')] : [],
  };
}

/**
 * Step 4, 5 & 6: Normalizes a raw repository, filters vendor files, attributes commits,
 * and detects technology signals within that repository.
 */
export function normalizeAndAnalyzeRepository(
  rawRepo: RawRepositoryInput,
  candidateGithubUsername: string,
  candidateName?: string
): NormalizedRepository {
  // 1. Deduplicate and filter file paths
  const uniquePaths = Array.from(new Set(rawRepo.filePaths.map((p) => p.trim()).filter(Boolean)));
  const meaningfulFilePaths: string[] = [];
  let excludedVendorFilesCount = 0;

  for (const filePath of uniquePaths) {
    if (isVendorOrGeneratedFile(filePath)) {
      excludedVendorFilesCount++;
    } else {
      meaningfulFilePaths.push(filePath);
    }
  }

  // 2. Deduplicate commits by SHA and process attribution + file filtering
  const seenShas = new Set<string>();
  const processedCommits: ProcessedCommit[] = [];
  const workBreakdown: Record<WorkCategory, number> = {
    'Feature Development': 0,
    'Bug Fixing': 0,
    'Testing & Quality': 0,
    'Documentation': 0,
    'Maintenance & Config': 0,
  };

  for (const commit of rawRepo.commits) {
    if (!commit.sha || seenShas.has(commit.sha)) continue;
    seenShas.add(commit.sha);

    const meaningfulChanged: string[] = [];
    let commitExcludedCount = 0;
    for (const f of commit.filesChanged || []) {
      if (isVendorOrGeneratedFile(f)) {
        commitExcludedCount++;
        excludedVendorFilesCount++;
      } else {
        meaningfulChanged.push(f);
      }
    }

    const isAttributed = isCommitAttributedToCandidate(
      commit,
      candidateGithubUsername,
      candidateName
    );
    const workCategory = classifyCommitWorkCategory(commit.message, meaningfulChanged);
    // A commit is substantive if it modifies at least 1 meaningful source file and has >= 8 lines changed
    const totalLinesChanged = (commit.additions || 0) + (commit.deletions || 0);
    const isSubstantiveChange =
      isAttributed &&
      meaningfulChanged.length > 0 &&
      totalLinesChanged >= 8 &&
      workCategory !== 'Documentation';

    if (isAttributed) {
      workBreakdown[workCategory] = (workBreakdown[workCategory] || 0) + 1;
    }

    processedCommits.push({
      ...commit,
      isCandidateAttributed: isAttributed,
      workCategory,
      meaningfulFilesChanged: meaningfulChanged,
      excludedFilesCount: commitExcludedCount,
      isSubstantiveChange,
    });
  }

  // Compute activity span across candidate-attributed commits
  const attributedDates = processedCommits
    .filter((c) => c.isCandidateAttributed && c.date)
    .map((c) => new Date(c.date).getTime())
    .filter((t) => !Number.isNaN(t));

  let activitySpanDays = 0;
  if (attributedDates.length >= 2) {
    const minDate = Math.min(...attributedDates);
    const maxDate = Math.max(...attributedDates);
    activitySpanDays = Math.max(1, Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)));
  } else if (attributedDates.length === 1) {
    activitySpanDays = 1;
  }

  const candidateAttributedCommits = processedCommits.filter((c) => c.isCandidateAttributed).length;
  const substantiveAttributedCommits = processedCommits.filter((c) => c.isSubstantiveChange).length;

  const isEmptyOrInsufficient =
    meaningfulFilePaths.length < 2 && candidateAttributedCommits === 0;

  // 3. Detect technologies in this repository
  const detectedTechnologies: DetectedTechSignal[] = [];
  const allManifestDeps = new Map<string, string[]>(); // lowerDep -> manifest fileNames
  for (const manifest of rawRepo.manifests || []) {
    const allDeps = [...(manifest.dependencies || []), ...(manifest.devDependencies || [])];
    for (const dep of allDeps) {
      const lower = dep.toLowerCase().trim();
      const existing = allManifestDeps.get(lower) || [];
      if (!existing.includes(manifest.fileName)) {
        existing.push(manifest.fileName);
      }
      allManifestDeps.set(lower, existing);
    }
  }

  for (const tech of SUPPORTED_TECHNOLOGIES) {
    const manifestSourcesSet = new Set<string>();
    for (const pkg of tech.manifestPackages) {
      const lowerPkg = pkg.toLowerCase();
      for (const [depName, files] of allManifestDeps.entries()) {
        if (depName === lowerPkg || depName.startsWith(`${lowerPkg}/`)) {
          files.forEach((f) => manifestSourcesSet.add(f));
        }
      }
    }

    const fromManifest = manifestSourcesSet.size > 0;
    const fromLanguageMetadata =
      (rawRepo.primaryLanguage !== null &&
        tech.languageKeys.some((k) => k.toLowerCase() === rawRepo.primaryLanguage!.toLowerCase())) ||
      Object.keys(rawRepo.languages || {}).some((langKey) =>
        tech.languageKeys.some((k) => k.toLowerCase() === langKey.toLowerCase())
      );

    // Match meaningful source files for this technology
    const matchingSourceFiles = meaningfulFilePaths.filter((filePath) => {
      const lowerPath = filePath.toLowerCase();
      const extMatch = tech.extensions.some((ext) => lowerPath.endsWith(ext));
      const patternMatch = tech.pathPatterns.some((pat) => pat.test(filePath));

      // Special precision check for React vs generic TypeScript/JavaScript:
      // For React, require .tsx/.jsx or React-specific path patterns or manifest presence
      if (tech.canonicalName === 'React') {
        if (patternMatch) return true;
        if ((lowerPath.endsWith('.tsx') || lowerPath.endsWith('.jsx')) && (fromManifest || lowerPath.includes('component') || lowerPath.includes('app'))) {
          return true;
        }
        return false;
      }

      // Special precision check for Node.js:
      if (tech.canonicalName === 'Node.js') {
        if (patternMatch) return true;
        if (fromManifest && (lowerPath.includes('server') || lowerPath.includes('api') || lowerPath.includes('worker') || lowerPath.includes('route'))) {
          return true;
        }
        return false;
      }

      return extMatch || patternMatch;
    });

    // Match candidate-attributed commits that touched matching files for this tech
    const matchingCommits = processedCommits.filter((commit) => {
      if (!commit.isCandidateAttributed) return false;
      return commit.meaningfulFilesChanged.some((changedFile) => {
        const lowerFile = changedFile.toLowerCase();
        if (tech.canonicalName === 'React') {
          return (
            lowerFile.endsWith('.tsx') ||
            lowerFile.endsWith('.jsx') ||
            tech.pathPatterns.some((p) => p.test(changedFile))
          );
        }
        return (
          tech.extensions.some((ext) => lowerFile.endsWith(ext)) ||
          tech.pathPatterns.some((p) => p.test(changedFile))
        );
      });
    });

    const substantiveTechCommits = matchingCommits.filter((c) => c.isSubstantiveChange);

    if (
      fromManifest ||
      fromLanguageMetadata ||
      matchingSourceFiles.length > 0 ||
      matchingCommits.length > 0
    ) {
      detectedTechnologies.push({
        skillName: tech.canonicalName,
        category: tech.category,
        fromManifest,
        manifestSources: Array.from(manifestSourcesSet),
        fromLanguageMetadata,
        matchingSourceFiles,
        attributedCommitCount: matchingCommits.length,
        substantiveCommitCount: substantiveTechCommits.length,
        attributedCommitShas: matchingCommits.slice(0, 5).map((c) => ({
          sha: c.sha,
          message: c.message,
          htmlUrl: c.htmlUrl,
          date: c.date,
        })),
      });
    }
  }

  // 4. Data Quality & Limitation notes per repository
  const dataQualityNotes: string[] = [];
  if (rawRepo.isFork) {
    dataQualityNotes.push(
      'Forked repository: Upstream commits not authored by candidate are excluded from skill attribution.'
    );
  }
  if (excludedVendorFilesCount > 0) {
    dataQualityNotes.push(
      `Excluded ${excludedVendorFilesCount} vendor, lockfile, or generated build artifact(s) from analysis.`
    );
  }
  if (isEmptyOrInsufficient) {
    dataQualityNotes.push(
      'Insufficient repository data: Fewer than 2 meaningful source files or zero candidate-attributed commits.'
    );
  }
  if (candidateAttributedCommits > 0 && substantiveAttributedCommits === 0) {
    dataQualityNotes.push(
      'Commits found are small configuration/documentation edits (< 8 lines changed); substantive code evidence is limited.'
    );
  }

  return {
    id: rawRepo.id,
    name: rawRepo.name,
    fullName: rawRepo.fullName,
    htmlUrl: rawRepo.htmlUrl,
    description: rawRepo.description,
    isFork: rawRepo.isFork,
    isEmptyOrInsufficient,
    primaryLanguage: rawRepo.primaryLanguage,
    languages: rawRepo.languages,
    meaningfulFilePaths,
    excludedVendorFilesCount,
    manifests: rawRepo.manifests,
    detectedTechnologies,
    commits: processedCommits,
    pullRequests: rawRepo.pullRequests || [],
    totalCommitsSampled: processedCommits.length,
    candidateAttributedCommits,
    substantiveAttributedCommits,
    activitySpanDays,
    workBreakdown,
    dataQualityNotes,
    starsCount: rawRepo.starsCount,
    hasReadme: rawRepo.hasReadme,
    createdAt: rawRepo.createdAt,
    pushedAt: rawRepo.pushedAt,
  };
}

/**
 * Step 7 & 8: Deterministic Skill Claim Matcher and Evidence Strength Evaluator.
 *
 * Scoring Formula (Max 100 Evidence Strength Points):
 * - Manifest & Language Metadata Signal (0 - 15 pts)
 * - Meaningful Source File Presence (0 - 25 pts)
 * - Candidate-Attributed Substantive Commits (0 - 30 pts)
 * - Multi-Repository Corroboration (0 - 15 pts)
 * - Activity Span & Recency (0 - 15 pts)
 *
 * Hard Invariant Gates:
 * - If `attributedWorkSignal === 0` (e.g. only in package.json or only in unedited fork),
 *   total score is capped at <= 18 and band is forced to "Insufficient Evidence".
 */
export function evaluateSkillEvidence(
  skillInput: string,
  claimedByUser: boolean,
  normalizedRepos: NormalizedRepository[],
  referenceNowIso: string = new Date().toISOString()
): SkillAssessmentResult {
  const techRule = resolveCanonicalSkill(skillInput);
  const skillName = techRule.canonicalName;

  // Separate original repositories from forks
  const originalReposWithTech: {
    repo: NormalizedRepository;
    signal: DetectedTechSignal;
  }[] = [];
  const forkedReposWithTech: {
    repo: NormalizedRepository;
    signal: DetectedTechSignal;
  }[] = [];

  for (const repo of normalizedRepos) {
    const match = repo.detectedTechnologies.find(
      (t) => t.skillName.toLowerCase() === skillName.toLowerCase()
    );
    if (match) {
      if (repo.isFork) {
        forkedReposWithTech.push({ repo, signal: match });
      } else {
        originalReposWithTech.push({ repo, signal: match });
      }
    }
  }

  const allReposWithTech = [...originalReposWithTech, ...forkedReposWithTech];
  const systemDetected = allReposWithTech.length > 0;

  // Aggregate metrics primarily from original repositories (plus candidate-attributed commits in forks if any)
  let hasManifestInOriginal = false;
  let hasLangMetaInOriginal = false;
  let totalMatchingFilesInOriginal = 0;
  let totalAttributedCommits = 0;
  let totalSubstantiveCommits = 0;
  let reposWithAttributedWork = 0;
  let maxActivitySpanDays = 0;
  let mostRecentCommitTime = 0;

  const supportingRepos: SkillAssessmentResult['supportingRepos'] = [];
  const supportingCommits: SkillAssessmentResult['supportingCommits'] = [];

  for (const { repo, signal } of allReposWithTech) {
    if (!repo.isFork) {
      if (signal.fromManifest) hasManifestInOriginal = true;
      if (signal.fromLanguageMetadata) hasLangMetaInOriginal = true;
      totalMatchingFilesInOriginal += signal.matchingSourceFiles.length;
    }

    totalAttributedCommits += signal.attributedCommitCount;
    totalSubstantiveCommits += signal.substantiveCommitCount;

    if (signal.attributedCommitCount > 0 && !repo.isFork) {
      reposWithAttributedWork++;
      if (repo.activitySpanDays > maxActivitySpanDays) {
        maxActivitySpanDays = repo.activitySpanDays;
      }
    }

    supportingRepos.push({
      repoName: repo.name,
      fullName: repo.fullName,
      htmlUrl: repo.htmlUrl,
      isFork: repo.isFork,
      matchingFilesCount: signal.matchingSourceFiles.length,
      attributedCommitsCount: signal.attributedCommitCount,
      manifestNames: signal.manifestSources,
    });

    for (const c of signal.attributedCommitShas) {
      const fullCommit = repo.commits.find((rc) => rc.sha === c.sha);
      const t = new Date(c.date).getTime();
      if (!Number.isNaN(t) && t > mostRecentCommitTime) {
        mostRecentCommitTime = t;
      }
      supportingCommits.push({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        repoName: repo.name,
        message: c.message,
        date: c.date,
        htmlUrl: c.htmlUrl,
        workCategory: fullCommit?.workCategory || 'Feature Development',
      });
    }
  }

  // 1. Manifest & Language Metadata Signal (0 - 15 pts)
  let manifestSignal = 0;
  if (hasManifestInOriginal && hasLangMetaInOriginal) {
    manifestSignal = 15;
  } else if (hasManifestInOriginal || hasLangMetaInOriginal) {
    manifestSignal = 12;
  } else if (forkedReposWithTech.some((f) => f.signal.fromManifest || f.signal.fromLanguageMetadata)) {
    manifestSignal = 5;
  }

  // 2. Source Files Signal (0 - 25 pts)
  let sourceFilesSignal = 0;
  if (totalMatchingFilesInOriginal >= 8) {
    sourceFilesSignal = 25;
  } else if (totalMatchingFilesInOriginal >= 4) {
    sourceFilesSignal = 18;
  } else if (totalMatchingFilesInOriginal >= 2) {
    sourceFilesSignal = 12;
  } else if (totalMatchingFilesInOriginal === 1) {
    sourceFilesSignal = 6;
  }

  // 3. Candidate-Attributed Work Signal (0 - 30 pts)
  // Notice: Substantive commits are required for high points; raw tiny commits alone cap at 10 pts.
  let attributedWorkSignal = 0;
  if (totalSubstantiveCommits >= 5) {
    attributedWorkSignal = 30;
  } else if (totalSubstantiveCommits >= 3) {
    attributedWorkSignal = 24;
  } else if (totalSubstantiveCommits >= 2) {
    attributedWorkSignal = 18;
  } else if (totalSubstantiveCommits === 1) {
    attributedWorkSignal = 12;
  } else if (totalAttributedCommits >= 1) {
    // Only tiny/non-substantive commits found
    attributedWorkSignal = 8;
  }

  // 4. Multi-Repository Consistency (0 - 15 pts)
  let multiRepoConsistency = 0;
  if (reposWithAttributedWork >= 3) {
    multiRepoConsistency = 15;
  } else if (reposWithAttributedWork === 2) {
    multiRepoConsistency = 11;
  } else if (reposWithAttributedWork === 1) {
    multiRepoConsistency = 6;
  }

  // 5. Recency & Activity Continuity (0 - 15 pts)
  let recencyAndContinuity = 0;
  if (totalAttributedCommits > 0) {
    // Continuity component (0 - 8 pts)
    if (maxActivitySpanDays >= 30) {
      recencyAndContinuity += 8;
    } else if (maxActivitySpanDays >= 7) {
      recencyAndContinuity += 5;
    } else {
      recencyAndContinuity += 2;
    }

    // Recency component (0 - 7 pts)
    const refTime = new Date(referenceNowIso).getTime();
    const daysSinceLastCommit =
      mostRecentCommitTime > 0
        ? Math.max(0, (refTime - mostRecentCommitTime) / (1000 * 60 * 60 * 24))
        : 999;

    if (daysSinceLastCommit <= 90) {
      recencyAndContinuity += 7;
    } else if (daysSinceLastCommit <= 240) {
      recencyAndContinuity += 5;
    } else if (daysSinceLastCommit <= 365) {
      recencyAndContinuity += 3;
    } else {
      recencyAndContinuity += 1;
    }
  }

  let totalScore =
    manifestSignal +
    sourceFilesSignal +
    attributedWorkSignal +
    multiRepoConsistency +
    recencyAndContinuity;

  // HARD GATE 1: Dependency-only or zero candidate-attributed commits -> Insufficient Evidence
  if (attributedWorkSignal === 0 || totalAttributedCommits === 0) {
    totalScore = Math.min(totalScore, 15);
  }
  // HARD GATE 2: No substantive commits -> cannot exceed Weak Evidence (max 42)
  else if (totalSubstantiveCommits === 0) {
    totalScore = Math.min(totalScore, 42);
  }

  let evidenceBand: EvidenceBand = 'Insufficient Evidence';
  if (
    totalScore >= 75 &&
    attributedWorkSignal >= 18 &&
    sourceFilesSignal >= 12
  ) {
    evidenceBand = 'Strong Evidence';
  } else if (totalScore >= 45 && attributedWorkSignal >= 12) {
    evidenceBand = 'Moderate Evidence';
  } else if (totalScore >= 20 && totalAttributedCommits >= 1) {
    evidenceBand = 'Weak Evidence';
  } else {
    evidenceBand = 'Insufficient Evidence';
  }

  // Build explainable signals & limitations
  const positiveSignals: string[] = [];
  const missingOrWeakSignals: string[] = [];
  const limitations: string[] = [];

  if (hasManifestInOriginal) {
    positiveSignals.push(
      `${skillName} dependencies verified in project manifest files across original repositories.`
    );
  }
  if (totalMatchingFilesInOriginal > 0) {
    positiveSignals.push(
      `${totalMatchingFilesInOriginal} non-vendor ${skillName} source file(s) inspected.`
    );
  }
  if (totalSubstantiveCommits > 0) {
    positiveSignals.push(
      `${totalSubstantiveCommits} substantive candidate-attributed commit(s) modifying ${skillName} source files.`
    );
  }
  if (reposWithAttributedWork >= 2) {
    positiveSignals.push(
      `Consistent evidence corroborated across ${reposWithAttributedWork} independent original repositories.`
    );
  }
  if (maxActivitySpanDays >= 14) {
    positiveSignals.push(
      `Sustained development continuity observed over ${maxActivitySpanDays} days.`
    );
  }

  // Explain why evidence is weak or insufficient
  if (hasManifestInOriginal && totalAttributedCommits === 0) {
    missingOrWeakSignals.push(
      `${skillName} dependency was detected in manifest files, but zero candidate-attributed source commits were established.`
    );
  } else if (!hasManifestInOriginal && totalMatchingFilesInOriginal === 0) {
    missingOrWeakSignals.push(
      `No ${skillName} source files or dependency manifests found in original public repositories.`
    );
  }

  if (totalAttributedCommits > 0 && totalSubstantiveCommits === 0) {
    missingOrWeakSignals.push(
      `Attributed commits touching ${skillName} files are tiny edits (< 8 lines); substantive feature or bugfix implementation was not established.`
    );
  }

  if (reposWithAttributedWork === 1 && evidenceBand !== 'Insufficient Evidence') {
    missingOrWeakSignals.push(
      `Evidence is concentrated in a single original repository; multi-project corroboration is limited.`
    );
  }

  if (forkedReposWithTech.length > 0) {
    limitations.push(
      `${forkedReposWithTech.length} forked repository(${forkedReposWithTech.map((f) => f.repo.name).join(', ')}) containing ${skillName} was excluded from primary authorship scoring.`
    );
  }

  limitations.push(
    'Public GitHub history reflects observable repository activity only and does not capture private enterprise repositories or pair-programming context.'
  );

  return {
    skillName,
    category: techRule.category,
    claimedByUser,
    systemDetected,
    evidenceBand,
    evidenceScore: totalScore,
    breakdown: {
      manifestSignal,
      sourceFilesSignal,
      attributedWorkSignal,
      multiRepoConsistency,
      recencyAndContinuity,
      totalScore,
    },
    supportingRepos,
    supportingCommits: supportingCommits.slice(0, 8),
    positiveSignals,
    missingOrWeakSignals,
    limitations,
    assessedAt: referenceNowIso,
  };
}
