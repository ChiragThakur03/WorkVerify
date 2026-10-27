/**
 * WorkVerify — Public GitHub URL Parser, Job Description Parser,
 * Deterministic Job-Match Scoring Engine, Recruiter Report Generator,
 * and Role Recommendation Engine.
 *
 * Core Invariants:
 * 1. The 5-part Skill Evidence Score (in verificationEngine.ts) remains separate
 *    from the Job Description Match Score calculated here.
 * 2. Every requirement match state ('Strong supporting evidence', 'Partial supporting evidence',
 *    'No supporting evidence found', 'Inconclusive due to insufficient data') is traceable
 *    to specific repositories, manifests, files, and candidate-attributed commits.
 * 3. Repository ownership is distinguished from contribution attribution.
 * 4. Missing evidence is never automatically labeled as a personal inability; the engine
 *    explicitly distinguishes "no public evidence found" from "dependency-only / fork-only".
 */

import {
  NormalizedRepository,
  SkillAssessmentResult,
  SUPPORTED_TECHNOLOGIES,
  resolveCanonicalSkill,
  evaluateSkillEvidence,
} from './verificationEngine.ts';

export type GitHubTargetType = 'repository' | 'profile';

export interface ParsedGitHubTarget {
  valid: boolean;
  type?: GitHubTargetType;
  owner?: string;
  repo?: string;
  canonicalUrl?: string;
  error?: string;
}

/**
 * Validates and extracts GitHub profile or repository targets while preventing SSRF
 * and rejecting non-GitHub hosts or malformed URLs (Section 2 & Section 11).
 */
export function parseGitHubTargetUrl(rawInput: string): ParsedGitHubTarget {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Please enter a GitHub profile URL, repository URL, or GitHub username.',
    };
  }

  // Strip query parameters and URL hash fragments before shorthand inspection
  const withoutHashOrQuery = trimmed.split('#')[0].split('?')[0].trim();

  // Handle shorthand "@username", "username", "owner/repo", or "github.com/..." / "www.github.com/..." without protocol
  if (!trimmed.includes('://') && !trimmed.toLowerCase().startsWith('http')) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(withoutHashOrQuery) && !/^(www\.)?github\.com\//i.test(withoutHashOrQuery)) {
      return {
        valid: false,
        error: 'Unsupported host. WorkVerify only analyzes public repositories and profiles hosted on github.com.',
      };
    }

    const clean = withoutHashOrQuery
      .replace(/^@/, '')
      .replace(/^(www\.)?github\.com\//i, '')
      .replace(/^\/+|\/+$/g, '');
    const parts = clean.split('/').filter(Boolean);
    const validToken = /^[a-zA-Z0-9_.-]+$/;

    if (parts.length === 1 && validToken.test(parts[0])) {
      return {
        valid: true,
        type: 'profile',
        owner: parts[0],
        canonicalUrl: `https://github.com/${parts[0]}`,
      };
    }
    if (parts.length >= 2 && validToken.test(parts[0]) && validToken.test(parts[1])) {
      const repoName = parts[1].replace(/\.git$/i, '');
      return {
        valid: true,
        type: 'repository',
        owner: parts[0],
        repo: repoName,
        canonicalUrl: `https://github.com/${parts[0]}/${repoName}`,
      };
    }
    return {
      valid: false,
      error: 'Invalid GitHub target format. Expected https://github.com/<owner>/<repo> or https://github.com/<username>.',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: 'Malformed URL. Please provide a valid https://github.com/... link.',
    };
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return {
      valid: false,
      error: 'Unsupported URL protocol. Only HTTPS GitHub URLs are permitted.',
    };
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') {
    return {
      valid: false,
      error: `Unsupported host "${host}". WorkVerify only analyzes public repositories and profiles hosted on github.com.`,
    };
  }

  const reservedPaths = new Set([
    'settings',
    'marketplace',
    'explore',
    'topics',
    'trending',
    'collections',
    'events',
    'sponsors',
    'login',
    'join',
    'orgs',
    'search',
    'features',
    'pricing',
  ]);

  const segments = parsedUrl.pathname
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return {
      valid: false,
      error: 'URL points to the GitHub homepage. Please include a profile username or repository path.',
    };
  }

  const owner = segments[0];
  const validSegment = /^[a-zA-Z0-9_.-]+$/;
  if (reservedPaths.has(owner.toLowerCase()) || !validSegment.test(owner)) {
    return {
      valid: false,
      error: `"${owner}" is a reserved GitHub path or invalid username.`,
    };
  }

  if (segments.length === 1) {
    return {
      valid: true,
      type: 'profile',
      owner,
      canonicalUrl: `https://github.com/${owner}`,
    };
  }

  const repo = segments[1].replace(/\.git$/i, '');
  if (!validSegment.test(repo)) {
    return {
      valid: false,
      error: `Invalid repository name "${repo}".`,
    };
  }

  return {
    valid: true,
    type: 'repository',
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}

export interface SingleRepositoryInspectionReport {
  repository: NormalizedRepository;
  ownerLogin: string;
  ownershipVsAttribution: {
    totalCommitsSampled: number;
    ownerAttributedCommits: number;
    externalContributorCommits: number;
    ownerAttributionRatio: number;
    distinctAuthors: string[];
    ownershipNote: string;
  };
  projectStructureSignals: {
    hasReadme: boolean;
    hasTests: boolean;
    testFiles: string[];
    hasCiCd: boolean;
    ciFiles: string[];
    hasContainerConfig: boolean;
    hasTypeConfig: boolean;
    manifestsFound: string[];
  };
  skillAssessments: SkillAssessmentResult[];
  limitations: string[];
  analyzedAt: string;
}

/**
 * Generates a deep single-repository inspection report distinguishing repository ownership
 * from demonstrable commit attribution (Section 2).
 */
export function buildSingleRepositoryReport(
  repo: NormalizedRepository,
  ownerLogin: string,
  analyzedAt: string = new Date().toISOString()
): SingleRepositoryInspectionReport {
  const totalCommitsSampled = repo.commits.length;
  const ownerAttributedCommits = repo.commits.filter((c) => c.isCandidateAttributed).length;
  const externalContributorCommits = Math.max(0, totalCommitsSampled - ownerAttributedCommits);
  const ownerAttributionRatio =
    totalCommitsSampled > 0 ? Math.round((ownerAttributedCommits / totalCommitsSampled) * 100) : 0;

  const distinctAuthors = Array.from(
    new Set(repo.commits.map((c) => c.authorLogin || c.authorName).filter(Boolean))
  );

  let ownershipNote = '';
  if (repo.isFork) {
    ownershipNote =
      ownerAttributedCommits === 0
        ? `This repository is a fork owned by @${ownerLogin}, and 0 of the ${totalCommitsSampled} sampled commits are attributed to @${ownerLogin}. Ownership of a forked repository does not establish authorship of its code.`
        : `This repository is a fork owned by @${ownerLogin}, with ${ownerAttributedCommits}/${totalCommitsSampled} sampled commits attributed to @${ownerLogin}. Only @${ownerLogin}'s attributed commits count toward skill evidence.`;
  } else if (totalCommitsSampled === 0) {
    ownershipNote = `No commit history was accessible for @${ownerLogin}/${repo.name}. Repository ownership alone cannot verify authorship.`;
  } else if (externalContributorCommits > 0) {
    ownershipNote = `Multi-contributor repository: @${ownerLogin} authored ${ownerAttributedCommits} of ${totalCommitsSampled} sampled commits (${ownerAttributionRatio}%). Commits by other contributors (${distinctAuthors.filter((a) => a.toLowerCase() !== ownerLogin.toLowerCase()).join(', ') || 'external authors'}) are excluded from @${ownerLogin}'s personal skill attribution.`;
  } else {
    ownershipNote = `All ${ownerAttributedCommits} sampled commits in this original repository are attributed to @${ownerLogin}.`;
  }

  const testFiles = repo.meaningfulFilePaths.filter(
    (f) => /\.(test|spec)\.(ts|tsx|js|jsx|py|go|java|rs)$/i.test(f) || /(^|\/)(tests?|__tests__)\//i.test(f)
  );
  const ciFiles = repo.meaningfulFilePaths.filter((f) =>
    /\.github\/workflows\/.*\.ya?ml$/i.test(f) || /\.gitlab-ci\.yml$/i.test(f)
  );
  const hasContainerConfig = repo.meaningfulFilePaths.some(
    (f) => /Dockerfile$/i.test(f) || /docker-compose\.ya?ml$/i.test(f)
  );
  const hasTypeConfig = repo.meaningfulFilePaths.some(
    (f) => /tsconfig\.json$/i.test(f) || /pyproject\.toml$/i.test(f) || /Cargo\.toml$/i.test(f)
  );

  const skillAssessments = repo.detectedTechnologies.map((sig) =>
    evaluateSkillEvidence(sig.skillName, true, [repo], analyzedAt)
  );

  const limitations = [
    ...repo.dataQualityNotes,
    'A single-repository analysis evaluates only the files, manifests, and sampled commits within this repository. Multi-repository consistency requires a profile-level scan.',
  ];

  return {
    repository: repo,
    ownerLogin,
    ownershipVsAttribution: {
      totalCommitsSampled,
      ownerAttributedCommits,
      externalContributorCommits,
      ownerAttributionRatio,
      distinctAuthors,
      ownershipNote,
    },
    projectStructureSignals: {
      hasReadme: repo.hasReadme,
      hasTests: testFiles.length > 0,
      testFiles,
      hasCiCd: ciFiles.length > 0,
      ciFiles,
      hasContainerConfig,
      hasTypeConfig,
      manifestsFound: repo.manifests.map((m) => m.fileName),
    },
    skillAssessments,
    limitations,
    analyzedAt,
  };
}

// ============================================================================
// Section 6: Structured Job Description Analysis Engine
// ============================================================================

export type SeniorityLevel =
  | 'Early-Career / Junior'
  | 'Mid-Level'
  | 'Senior'
  | 'Staff / Principal'
  | 'Unspecified';

export interface ExtractedJobDescription {
  id: string;
  title: string;
  roleCategory: string;
  seniority: SeniorityLevel;
  rawText: string;
  requiredSkills: string[];
  preferredSkills: string[];
  inferredSkills: { skillName: string; reason: string }[];
  responsibilities: string[];
  expectedSignals: {
    testingRequired: boolean;
    architectureOrScale: boolean;
    databaseOrDataModeling: boolean;
    ciCdOrContainers: boolean;
  };
  parsingNotes: string[];
  createdAt: string;
}

const DOMAIN_INFERENCE_RULES: {
  pattern: RegExp;
  inferredSkill: string;
  reason: string;
}[] = [
  {
    pattern: /\b(rest\s*api|graphql|microservice|backend\s+service|http\s+server)\b/i,
    inferredSkill: 'Node.js',
    reason: 'Inferred from backend API / service architecture responsibilities',
  },
  {
    pattern: /\b(relational\s+database|schema\s+design|query\s+optimization|acid|transactions)\b/i,
    inferredSkill: 'SQL & PostgreSQL',
    reason: 'Inferred from relational database & query optimization requirements',
  },
  {
    pattern: /\b(single[- ]page\s+app|spa|component\s+library|frontend\s+state|responsive\s+ui)\b/i,
    inferredSkill: 'React',
    reason: 'Inferred from modern component-based frontend UI responsibilities',
  },
  {
    pattern: /\b(containerization|kubernetes|deployment\s+pipeline|continuous\s+integration)\b/i,
    inferredSkill: 'Docker & CI/CD',
    reason: 'Inferred from deployment pipeline & containerization responsibilities',
  },
];

function detectSkillsInLine(line: string): string[] {
  const found = new Set<string>();
  const lower = line.toLowerCase();

  for (const tech of SUPPORTED_TECHNOLOGIES) {
    const terms = [tech.canonicalName.toLowerCase(), ...tech.aliases.map((a) => a.toLowerCase())];
    for (const term of terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, 'i');
      if (regex.test(lower)) {
        found.add(tech.canonicalName);
        break;
      }
    }
  }
  return Array.from(found);
}

export function inferRoleCategoryFromSkillsAndTitle(
  title: string,
  requiredSkills: string[]
): string {
  const t = title.toLowerCase();
  if (/full[- ]?stack/i.test(t)) return 'Full-Stack Developer';
  if (/front[- ]?end|ui\s+engineer|react\s+developer/i.test(t)) return 'Frontend Developer';
  if (/back[- ]?end|api\s+engineer|distributed\s+systems/i.test(t)) return 'Backend Developer';
  if (/data\s+engineer|data\s+analyst|analytics|database/i.test(t)) return 'Data / SQL Engineer';
  if (/devops|platform\s+engineer|sre|infrastructure/i.test(t)) return 'DevOps / Platform Engineer';
  if (/python/i.test(t)) return 'Python Developer';

  const hasFrontend = requiredSkills.some((s) => ['React', 'Next.js', 'HTML & CSS'].includes(s));
  const hasBackend = requiredSkills.some((s) =>
    ['Node.js', 'Python', 'Go', 'Java', 'SQL & PostgreSQL'].includes(s)
  );
  if (hasFrontend && hasBackend) return 'Full-Stack Developer';
  if (hasFrontend) return 'Frontend Developer';
  if (hasBackend) return 'Backend Developer';
  return 'Software Engineer';
}

/**
 * Parses a raw job description string (and optional explicit title) into structured
 * Required, Preferred, and Inferred requirements, responsibilities, and seniority.
 */
export function parseJobDescription(
  rawText: string,
  explicitTitle?: string,
  customId?: string
): ExtractedJobDescription {
  const cleanedText = (rawText || '').trim();
  const lines = cleanedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Determine Job Title
  let title = (explicitTitle || '').trim();
  if (!title && lines.length > 0) {
    const firstLine = lines[0].replace(/^(job\s*title|role|position)\s*:\s*/i, '').trim();
    title = firstLine.length <= 80 ? firstLine : 'Software Engineering Role';
  }
  if (!title) {
    title = 'Unspecified Software Role';
  }

  // 2. Determine Seniority
  let seniority: SeniorityLevel = 'Unspecified';
  if (/\b(staff|principal|architect|lead)\b/i.test(cleanedText)) {
    seniority = 'Staff / Principal';
  } else if (/\b(senior|sr\.?|[5-9]\+\s*years)\b/i.test(cleanedText)) {
    seniority = 'Senior';
  } else if (/\b(mid[- ]level|[2-4]\+?\s*years)\b/i.test(cleanedText)) {
    seniority = 'Mid-Level';
  } else if (/\b(junior|entry[- ]level|intern|new\s+grad|early[- ]career|0-2\s*years)\b/i.test(cleanedText)) {
    seniority = 'Early-Career / Junior';
  }

  // 3. Scan lines with section awareness (Required vs Preferred vs Responsibilities)
  const requiredSet = new Set<string>();
  const preferredSet = new Set<string>();
  const responsibilities: string[] = [];

  let currentSection: 'general' | 'required' | 'preferred' | 'responsibilities' = 'general';

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect section headers (only skip line if it is a standalone header without inline skills)
    if (
      /^(required|requirements|must[- ]have|qualifications|minimum\s+qualifications|what\s+you\s+need)(\s+qualifications|\s+skills)?\s*:?$/i.test(
        lower
      ) &&
      line.length < 70
    ) {
      currentSection = 'required';
      continue;
    }
    if (
      /^(preferred|nice[- ]to[- ]have|bonus|desired|plus|good\s+to\s+have|optional)(\s+qualifications|\s+skills)?\s*:?$/i.test(
        lower
      ) &&
      line.length < 70
    ) {
      currentSection = 'preferred';
      continue;
    }
    if (
      /^(responsibilities|what\s+you\s+will\s+do|role\s+overview|duties|about\s+the\s+role)\s*:?$/i.test(
        lower
      ) &&
      line.length < 70
    ) {
      currentSection = 'responsibilities';
      continue;
    }

    const lineSkills = detectSkillsInLine(line);
    const isLineExplicitlyPreferred =
      /\b(preferred|nice to have|bonus|plus|optional|familiarity with|ideally)\b/i.test(lower);
    const isLineExplicitlyRequired =
      /\b(required|must have|strong experience|proficiency in|proficient in|solid understanding|experience with)\b/i.test(
        lower
      );

    for (const sk of lineSkills) {
      if (isLineExplicitlyPreferred || currentSection === 'preferred') {
        if (!requiredSet.has(sk)) {
          preferredSet.add(sk);
        }
      } else if (isLineExplicitlyRequired || currentSection === 'required') {
        requiredSet.add(sk);
        preferredSet.delete(sk);
      } else {
        // Mentioned in general text or responsibilities: treat as required if not already classified
        requiredSet.add(sk);
      }
    }

    // Collect responsibility bullets
    const strippedBullet = line.replace(/^[-*•\d.)]+\s*/, '').trim();
    if (
      (currentSection === 'responsibilities' ||
        /\b(build|design|develop|maintain|implement|collaborate|optimize|architect|write)\b/i.test(
          strippedBullet
        )) &&
      strippedBullet.length >= 20 &&
      strippedBullet.length <= 220 &&
      responsibilities.length < 6
    ) {
      responsibilities.push(strippedBullet);
    }
  }

  // 4. Separate Inferred Skills (never mixed silently into stated Required skills)
  const inferredSkills: { skillName: string; reason: string }[] = [];
  for (const rule of DOMAIN_INFERENCE_RULES) {
    if (
      rule.pattern.test(cleanedText) &&
      !requiredSet.has(rule.inferredSkill) &&
      !preferredSet.has(rule.inferredSkill)
    ) {
      inferredSkills.push({
        skillName: rule.inferredSkill,
        reason: rule.reason,
      });
    }
  }

  const requiredSkills = Array.from(requiredSet);
  const preferredSkills = Array.from(preferredSet);
  const roleCategory = inferRoleCategoryFromSkillsAndTitle(title, requiredSkills);

  const expectedSignals = {
    testingRequired: /\b(unit\s+tests?|integration\s+tests?|jest|pytest|tdd|automated\s+tests?|quality)\b/i.test(
      cleanedText
    ),
    architectureOrScale: /\b(distributed|scalable|high[- ]throughput|architecture|concurrency|performance|latency)\b/i.test(
      cleanedText
    ),
    databaseOrDataModeling: /\b(sql|postgres|supabase|database|schema|migration|query|data\s+model)\b/i.test(
      cleanedText
    ),
    ciCdOrContainers: /\b(docker|ci\/cd|github\s+actions|kubernetes|pipeline|container)\b/i.test(
      cleanedText
    ),
  };

  const parsingNotes: string[] = [];
  if (!cleanedText) {
    parsingNotes.push('Job description text is empty. Paste a job description to extract requirements.');
  } else if (requiredSkills.length === 0 && preferredSkills.length === 0) {
    parsingNotes.push(
      'No explicit supported technology keywords were detected in the text. You can manually add required or preferred skills below.'
    );
  }
  if (inferredSkills.length > 0) {
    parsingNotes.push(
      `Separated ${inferredSkills.length} inferred technology signal(s) from explicitly stated requirements.`
    );
  }

  return {
    id: customId || `jd_${Date.now()}`,
    title,
    roleCategory,
    seniority,
    rawText: cleanedText,
    requiredSkills,
    preferredSkills,
    inferredSkills,
    responsibilities,
    expectedSignals,
    parsingNotes,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Section 9: Separate Job Description Match Score & Explainability Engine
// ============================================================================

export type RequirementEvidenceState =
  | 'Strong supporting evidence'
  | 'Partial supporting evidence'
  | 'No supporting evidence found'
  | 'Inconclusive due to insufficient data';

export type ApplicationGuidanceClassification =
  | 'Strong Evidence Match'
  | 'Partial Evidence Match'
  | 'Significant Evidence Gaps'
  | 'Insufficient Data to Assess';

export interface JobMatchWeightsConfig {
  requiredSkillsMaxPoints: number; // default 60
  preferredSkillsMaxPoints: number; // default 15
  projectRelevanceMaxPoints: number; // default 15
  attributionReliabilityMaxPoints: number; // default 10
}

export const DEFAULT_JOB_MATCH_WEIGHTS: JobMatchWeightsConfig = {
  requiredSkillsMaxPoints: 60,
  preferredSkillsMaxPoints: 15,
  projectRelevanceMaxPoints: 15,
  attributionReliabilityMaxPoints: 10,
};

export interface RequirementEvaluationItem {
  skillName: string;
  requirementType: 'Required' | 'Preferred' | 'Inferred';
  evidenceState: RequirementEvidenceState;
  skillEvidenceBand: SkillAssessmentResult['evidenceBand'];
  skillEvidenceScore: number;
  creditRatio: number; // 1.0, 0.55, 0.15, or 0.0
  pointsAwarded: number;
  maxPointsPossible: number;
  supportingRepos: {
    repoName: string;
    htmlUrl: string;
    isFork: boolean;
    attributedCommitsCount: number;
    matchingFilesCount: number;
  }[];
  supportingCommits: {
    shortSha: string;
    repoName: string;
    message: string;
    htmlUrl: string;
  }[];
  explanation: string;
}

export interface InterviewQuestionItem {
  id: string;
  topic: string;
  question: string;
  motivatingEvidence: string;
  targetRepoOrSkill: string;
}

export interface JobDescriptionMatchReport {
  id: string;
  jobDescription: ExtractedJobDescription;
  candidateUsername: string;
  matchScore: number; // 0 - 100 (Distinct from Skill Evidence Score)
  guidanceClassification: ApplicationGuidanceClassification;
  guidanceExplanation: string;
  scoreBreakdown: {
    requiredSkillsPoints: number;
    requiredSkillsMax: number;
    preferredSkillsPoints: number;
    preferredSkillsMax: number;
    projectRelevancePoints: number;
    projectRelevanceMax: number;
    attributionReliabilityPoints: number;
    attributionReliabilityMax: number;
    formulaSummary: string;
  };
  requirementEvaluations: RequirementEvaluationItem[];
  strongestMatchingAreas: RequirementEvaluationItem[];
  partialMatches: RequirementEvaluationItem[];
  gapsToAddress: RequirementEvaluationItem[];
  recommendedNextSteps: {
    targetArea: string;
    action: string;
    rationale: string;
  }[];
  recruiterAssessment: {
    strengths: string[];
    gapsAndConcerns: string[];
    interviewQuestions: InterviewQuestionItem[];
    recruiterSummary: string;
    limitations: string[];
  };
  evaluatedAt: string;
}

/**
 * Evaluates a candidate's normalized repositories against an ExtractedJobDescription.
 * Keeps the Job Description Match Score strictly separate from the 5-part Skill Evidence Score.
 */
export function evaluateJobDescriptionMatch(
  jd: ExtractedJobDescription,
  normalizedRepos: NormalizedRepository[],
  candidateUsername: string,
  weights: JobMatchWeightsConfig = DEFAULT_JOB_MATCH_WEIGHTS,
  evaluatedAt: string = new Date().toISOString()
): JobDescriptionMatchReport {
  const originalRepos = normalizedRepos.filter((r) => !r.isFork);
  const forkedRepos = normalizedRepos.filter((r) => r.isFork);
  const totalRequired = jd.requiredSkills.length;
  const totalPreferred = jd.preferredSkills.length;

  // Handle empty JD or zero repositories
  if (
    (!jd.rawText.trim() && totalRequired === 0 && totalPreferred === 0) ||
    (totalRequired === 0 && totalPreferred === 0)
  ) {
    return {
      id: `match_${jd.id}`,
      jobDescription: jd,
      candidateUsername,
      matchScore: 0,
      guidanceClassification: 'Insufficient Data to Assess',
      guidanceExplanation:
        'The job description does not contain extractable technical skill requirements. Add required or preferred skills to compute an evidence alignment score.',
      scoreBreakdown: {
        requiredSkillsPoints: 0,
        requiredSkillsMax: weights.requiredSkillsMaxPoints,
        preferredSkillsPoints: 0,
        preferredSkillsMax: weights.preferredSkillsMaxPoints,
        projectRelevancePoints: 0,
        projectRelevanceMax: weights.projectRelevanceMaxPoints,
        attributionReliabilityPoints: 0,
        attributionReliabilityMax: weights.attributionReliabilityMaxPoints,
        formulaSummary: 'Insufficient job description requirements to compute match score.',
      },
      requirementEvaluations: [],
      strongestMatchingAreas: [],
      partialMatches: [],
      gapsToAddress: [],
      recommendedNextSteps: [
        {
          targetArea: 'Job Description Input',
          action: 'Specify at least one required technical skill in the Job Description editor.',
          rationale: 'WorkVerify requires explicit technical requirements to trace repository evidence.',
        },
      ],
      recruiterAssessment: {
        strengths: [],
        gapsAndConcerns: ['No explicit technical requirements were provided in the job description.'],
        interviewQuestions: [],
        recruiterSummary:
          'Cannot evaluate alignment until technical requirements are specified in the job description.',
        limitations: ['Empty or non-technical job description input.'],
      },
      evaluatedAt,
    };
  }

  if (normalizedRepos.length === 0) {
    return {
      id: `match_${jd.id}`,
      jobDescription: jd,
      candidateUsername,
      matchScore: 0,
      guidanceClassification: 'Insufficient Data to Assess',
      guidanceExplanation:
        'No public GitHub repositories were accessible for this profile. WorkVerify cannot assess alignment without observable repository data.',
      scoreBreakdown: {
        requiredSkillsPoints: 0,
        requiredSkillsMax: weights.requiredSkillsMaxPoints,
        preferredSkillsPoints: 0,
        preferredSkillsMax: weights.preferredSkillsMaxPoints,
        projectRelevancePoints: 0,
        projectRelevanceMax: weights.projectRelevanceMaxPoints,
        attributionReliabilityPoints: 0,
        attributionReliabilityMax: weights.attributionReliabilityMaxPoints,
        formulaSummary: 'Zero accessible public repositories.',
      },
      requirementEvaluations: [],
      strongestMatchingAreas: [],
      partialMatches: [],
      gapsToAddress: [],
      recommendedNextSteps: [
        {
          targetArea: 'Public Repository Visibility',
          action: 'Publish at least one original repository demonstrating your core technical stack.',
          rationale: 'No public repositories were found to evaluate against the job requirements.',
        },
      ],
      recruiterAssessment: {
        strengths: [],
        gapsAndConcerns: ['Zero public repositories available on GitHub for this candidate.'],
        interviewQuestions: [],
        recruiterSummary:
          'Insufficient public GitHub data to evaluate candidate technical evidence. Absence of public repositories does not imply lack of private industry experience.',
        limitations: ['Private enterprise repositories are not visible via public GitHub inspection.'],
      },
      evaluatedAt,
    };
  }

  // Allocate required vs preferred budgets:
  // If no preferred skills are listed, required skills absorb the full 75-point skill alignment budget.
  const effectiveRequiredMax =
    totalPreferred === 0
      ? weights.requiredSkillsMaxPoints + weights.preferredSkillsMaxPoints
      : totalRequired === 0
      ? 0
      : weights.requiredSkillsMaxPoints;

  const effectivePreferredMax =
    totalRequired === 0
      ? weights.requiredSkillsMaxPoints + weights.preferredSkillsMaxPoints
      : totalPreferred === 0
      ? 0
      : weights.preferredSkillsMaxPoints;

  const perRequiredMax = totalRequired > 0 ? effectiveRequiredMax / totalRequired : 0;
  const perPreferredMax = totalPreferred > 0 ? effectivePreferredMax / totalPreferred : 0;

  const requirementEvaluations: RequirementEvaluationItem[] = [];

  const evaluateSingleRequirement = (
    skillInput: string,
    requirementType: 'Required' | 'Preferred' | 'Inferred',
    maxPointsForThis: number
  ): RequirementEvaluationItem => {
    const canon = resolveCanonicalSkill(skillInput).canonicalName;
    const skillResult = evaluateSkillEvidence(canon, true, normalizedRepos, evaluatedAt);

    let evidenceState: RequirementEvidenceState = 'No supporting evidence found';
    let creditRatio = 0;
    let explanation = '';

    const originalSupporting = skillResult.supportingRepos.filter((r) => !r.isFork);
    const forkOnlySupporting = skillResult.supportingRepos.filter((r) => r.isFork);
    const totalAttributed = originalSupporting.reduce(
      (acc, r) => acc + r.attributedCommitsCount,
      0
    );

    if (skillResult.evidenceBand === 'Strong Evidence') {
      evidenceState = 'Strong supporting evidence';
      creditRatio = 1.0;
      explanation = `Strong multi-signal evidence (${skillResult.evidenceScore}/100 skill evidence score) across ${originalSupporting.length} original repository(ies) and ${totalAttributed} candidate-attributed commit(s).`;
    } else if (skillResult.evidenceBand === 'Moderate Evidence') {
      evidenceState = 'Strong supporting evidence';
      creditRatio = 0.85;
      explanation = `Moderate supporting evidence (${skillResult.evidenceScore}/100 skill evidence score) with ${totalAttributed} candidate-attributed commit(s) in ${originalSupporting.map((r) => r.repoName).join(', ')}.`;
    } else if (skillResult.evidenceBand === 'Weak Evidence') {
      evidenceState = 'Partial supporting evidence';
      creditRatio = 0.45;
      explanation = `Partial evidence (${skillResult.evidenceScore}/100): ${canon} files and ${totalAttributed} minor/initial commit(s) were detected, but substantive multi-file implementation is limited.`;
    } else {
      // Insufficient Evidence band: check if dependency-only or fork-only vs completely absent
      if (originalSupporting.length > 0 || forkOnlySupporting.length > 0) {
        evidenceState = 'Inconclusive due to insufficient data';
        creditRatio = 0.15;
        if (forkOnlySupporting.length > 0 && originalSupporting.length === 0) {
          explanation = `Inconclusive: ${canon} appears only in forked repository(${forkOnlySupporting.map((f) => f.repoName).join(', ')}) without candidate-attributed commits.`;
        } else {
          explanation = `Inconclusive: ${canon} is listed in dependency manifests (${originalSupporting.flatMap((r) => r.manifestNames).join(', ') || 'manifest'}), but zero candidate-attributed source commits were found.`;
        }
      } else {
        evidenceState = 'No supporting evidence found';
        creditRatio = 0.0;
        explanation = `No public evidence found for ${canon} across the ${normalizedRepos.length} analyzed repository(ies). Note: absence of public evidence does not prove lack of private experience.`;
      }
    }

    const pointsAwarded = Math.round(maxPointsForThis * creditRatio * 10) / 10;

    return {
      skillName: canon,
      requirementType,
      evidenceState,
      skillEvidenceBand: skillResult.evidenceBand,
      skillEvidenceScore: skillResult.evidenceScore,
      creditRatio,
      pointsAwarded,
      maxPointsPossible: Math.round(maxPointsForThis * 10) / 10,
      supportingRepos: skillResult.supportingRepos.map((r) => ({
        repoName: r.repoName,
        htmlUrl: r.htmlUrl,
        isFork: r.isFork,
        attributedCommitsCount: r.attributedCommitsCount,
        matchingFilesCount: r.matchingFilesCount,
      })),
      supportingCommits: skillResult.supportingCommits.slice(0, 3).map((c) => ({
        shortSha: c.shortSha,
        repoName: c.repoName,
        message: c.message,
        htmlUrl: c.htmlUrl,
      })),
      explanation,
    };
  };

  for (const reqSkill of jd.requiredSkills) {
    requirementEvaluations.push(
      evaluateSingleRequirement(reqSkill, 'Required', perRequiredMax)
    );
  }
  for (const prefSkill of jd.preferredSkills) {
    requirementEvaluations.push(
      evaluateSingleRequirement(prefSkill, 'Preferred', perPreferredMax)
    );
  }
  for (const inf of jd.inferredSkills) {
    requirementEvaluations.push(
      evaluateSingleRequirement(inf.skillName, 'Inferred', 0)
    );
  }

  const requiredSkillsPoints = Math.min(
    effectiveRequiredMax,
    Math.round(
      requirementEvaluations
        .filter((r) => r.requirementType === 'Required')
        .reduce((acc, r) => acc + r.pointsAwarded, 0)
    )
  );

  const preferredSkillsPoints = Math.min(
    effectivePreferredMax,
    Math.round(
      requirementEvaluations
        .filter((r) => r.requirementType === 'Preferred')
        .reduce((acc, r) => acc + r.pointsAwarded, 0)
    )
  );

  // 3. Project Relevance Score (0 - 15 pts)
  let projectRelevancePoints = 0;
  const reposWithRequiredMatches = originalRepos.filter((repo) =>
    repo.detectedTechnologies.some(
      (t) =>
        jd.requiredSkills.includes(t.skillName) && t.attributedCommitCount > 0
    )
  );
  if (reposWithRequiredMatches.length >= 2) {
    projectRelevancePoints += 9;
  } else if (reposWithRequiredMatches.length === 1) {
    projectRelevancePoints += 5;
  }

  const hasTestsInOriginal = originalRepos.some((r) =>
    r.meaningfulFilePaths.some((f) => /\.(test|spec)\./i.test(f) || /tests?\//i.test(f))
  );
  const hasSchemaOrMigrations = originalRepos.some((r) =>
    r.meaningfulFilePaths.some((f) => /\.(sql|prisma)$/i.test(f) || /migrations?\//i.test(f))
  );

  if (hasTestsInOriginal) projectRelevancePoints += 3;
  if (hasSchemaOrMigrations || originalRepos.some((r) => r.meaningfulFilePaths.length >= 8)) {
    projectRelevancePoints += 3;
  }
  projectRelevancePoints = Math.min(weights.projectRelevanceMaxPoints, projectRelevancePoints);

  // 4. Attribution Reliability Score (0 - 10 pts)
  let attributionReliabilityPoints = 0;
  const totalSubstantiveInOriginal = originalRepos.reduce(
    (acc, r) => acc + r.substantiveAttributedCommits,
    0
  );
  const totalSampledInOriginal = originalRepos.reduce(
    (acc, r) => acc + r.totalCommitsSampled,
    0
  );
  const totalAttributedInOriginal = originalRepos.reduce(
    (acc, r) => acc + r.candidateAttributedCommits,
    0
  );

  if (totalSubstantiveInOriginal >= 5) {
    attributionReliabilityPoints += 7;
  } else if (totalSubstantiveInOriginal >= 2) {
    attributionReliabilityPoints += 5;
  } else if (totalAttributedInOriginal >= 1) {
    attributionReliabilityPoints += 2;
  }

  if (
    totalSampledInOriginal > 0 &&
    totalAttributedInOriginal / totalSampledInOriginal >= 0.7
  ) {
    attributionReliabilityPoints += 3;
  }
  attributionReliabilityPoints = Math.min(
    weights.attributionReliabilityMaxPoints,
    attributionReliabilityPoints
  );

  const matchScore = Math.min(
    100,
    Math.round(
      requiredSkillsPoints +
        preferredSkillsPoints +
        projectRelevancePoints +
        attributionReliabilityPoints
    )
  );

  // Separate evaluations into Strongest, Partial, and Gaps
  const strongestMatchingAreas = requirementEvaluations.filter(
    (r) => r.evidenceState === 'Strong supporting evidence'
  );
  const partialMatches = requirementEvaluations.filter(
    (r) =>
      r.evidenceState === 'Partial supporting evidence' ||
      r.evidenceState === 'Inconclusive due to insufficient data'
  );
  const gapsToAddress = requirementEvaluations.filter(
    (r) => r.evidenceState === 'No supporting evidence found'
  );

  // Determine Application Guidance Classification
  const requiredEvals = requirementEvaluations.filter((r) => r.requirementType === 'Required');
  const supportedRequiredCount = requiredEvals.filter(
    (r) =>
      r.evidenceState === 'Strong supporting evidence' ||
      r.evidenceState === 'Partial supporting evidence'
  ).length;
  const requiredSupportRatio =
    requiredEvals.length > 0 ? supportedRequiredCount / requiredEvals.length : 1;

  let guidanceClassification: ApplicationGuidanceClassification = 'Partial Evidence Match';
  let guidanceExplanation = '';

  if (matchScore >= 72 && requiredSupportRatio >= 0.7) {
    guidanceClassification = 'Strong Evidence Match';
    guidanceExplanation = `Your public GitHub repositories provide verifiable evidence for ${supportedRequiredCount} of ${requiredEvals.length} required skills, backed by ${totalSubstantiveInOriginal} substantive attributed commits across ${reposWithRequiredMatches.length} relevant original project(s).`;
  } else if (matchScore >= 45 || requiredSupportRatio >= 0.45) {
    guidanceClassification = 'Partial Evidence Match';
    guidanceExplanation = `Your public work demonstrates ${supportedRequiredCount} of ${requiredEvals.length} required skills, with some requirements showing partial, dependency-only, or unrecorded public evidence. You can still apply while highlighting private work or addressing the key gaps below.`;
  } else {
    guidanceClassification = 'Significant Evidence Gaps';
    guidanceExplanation = `Accessible public repositories currently support ${supportedRequiredCount} of ${requiredEvals.length} explicit required skills (${matchScore}/100 alignment). If you have experience with the missing technologies in private repositories, document that context on your resume or build a focused public module.`;
  }

  // Build Practical Recommended Next Steps (Section 4.5)
  const recommendedNextSteps: JobDescriptionMatchReport['recommendedNextSteps'] = [];

  for (const gap of [...gapsToAddress, ...partialMatches].slice(0, 4)) {
    if (gap.evidenceState === 'Inconclusive due to insufficient data') {
      recommendedNextSteps.push({
        targetArea: `${gap.skillName} (${gap.requirementType})`,
        action: `Implement a working feature module in ${gap.skillName} within an original repository rather than relying on manifest dependencies or forked code.`,
        rationale: `${gap.skillName} was detected only in a manifest or fork without candidate-attributed source commits.`,
      });
    } else if (gap.evidenceState === 'Partial supporting evidence') {
      recommendedNextSteps.push({
        targetArea: `${gap.skillName} (${gap.requirementType})`,
        action: `Expand your existing ${gap.skillName} implementation with multi-file architecture and error handling.`,
        rationale: `Current ${gap.skillName} evidence consists of limited files or small edits.`,
      });
    } else {
      recommendedNextSteps.push({
        targetArea: `${gap.skillName} (${gap.requirementType})`,
        action: `Build or extend a public project demonstrating practical ${gap.skillName} usage aligned with ${jd.roleCategory} workflows.`,
        rationale: `No public repository evidence was found for ${gap.skillName}.`,
      });
    }
  }

  if (jd.expectedSignals.testingRequired && !hasTestsInOriginal) {
    recommendedNextSteps.push({
      targetArea: 'Automated Testing Evidence',
      action: 'Add unit or integration test suites (e.g., *.test.ts or pytest) to your primary repositories.',
      rationale: 'The job description emphasizes automated testing, and no test files were detected in your original repositories.',
    });
  }

  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps.push({
      targetArea: 'Architectural Documentation',
      action: 'Ensure each supporting repository README documents system design decisions, setup steps, and trade-offs.',
      rationale: 'Clear architectural documentation helps recruiters quickly contextualize your strong code evidence.',
    });
  }

  // Build Recruiter Assessment Sections (Section 3)
  const strengths: string[] = [];
  const gapsAndConcerns: string[] = [];

  for (const st of strongestMatchingAreas) {
    const repoNames = st.supportingRepos
      .filter((r) => !r.isFork)
      .map((r) => r.repoName)
      .join(', ');
    strengths.push(
      `${st.skillName} (${st.requirementType}): Verified across original repository(ies) [${repoNames}] with ${st.supportingRepos.reduce((a, b) => a + b.attributedCommitsCount, 0)} candidate-attributed commit(s).`
    );
  }
  if (hasTestsInOriginal) {
    strengths.push(
      'Testing Discipline: Automated unit/integration test files are present in candidate-authored repositories.'
    );
  }
  if (forkedRepos.length > 0) {
    gapsAndConcerns.push(
      `Fork Isolation Notice: ${forkedRepos.length} forked repository (${forkedRepos.map((f) => f.name).join(', ')}) was isolated so upstream authors' commits are not credited to @${candidateUsername}.`
    );
  }
  for (const gap of gapsToAddress) {
    gapsAndConcerns.push(
      `${gap.skillName} (${gap.requirementType}): No supporting evidence found in public repositories. (Note: This indicates absence of public GitHub evidence, not proof that the candidate lacks private experience.)`
    );
  }
  for (const pm of partialMatches) {
    gapsAndConcerns.push(`${pm.skillName} (${pm.requirementType}): ${pm.explanation}`);
  }

  // Generate Role-Specific Technical Interview Questions grounded in observed repos + JD (Section 3.E)
  const interviewQuestions: InterviewQuestionItem[] = [];

  for (const st of strongestMatchingAreas.slice(0, 2)) {
    const topRepo = st.supportingRepos.find((r) => !r.isFork) || st.supportingRepos[0];
    const topCommit = st.supportingCommits[0];
    if (topRepo) {
      interviewQuestions.push({
        id: `iq_strong_${st.skillName}`,
        topic: `${st.skillName} Architecture & Trade-offs`,
        question: `In "${topRepo.repoName}", how did you structure your ${st.skillName} implementation${topCommit ? ` (such as commit ${topCommit.shortSha}: "${topCommit.message}")` : ''}, and what would you change to scale it for this ${jd.title} role?`,
        motivatingEvidence: `Grounded in ${topRepo.matchingFilesCount} ${st.skillName} source files and ${topRepo.attributedCommitsCount} attributed commits in ${topRepo.repoName}.`,
        targetRepoOrSkill: `${topRepo.repoName} · ${st.skillName}`,
      });
    }
  }

  for (const gapOrPartial of [...partialMatches, ...gapsToAddress].slice(0, 2)) {
    if (gapOrPartial.evidenceState === 'Inconclusive due to insufficient data') {
      interviewQuestions.push({
        id: `iq_inc_${gapOrPartial.skillName}`,
        topic: `${gapOrPartial.skillName} Practical Depth Verification`,
        question: `We noticed ${gapOrPartial.skillName} is referenced in your repository manifests/forks, but public commit history on ${gapOrPartial.skillName} source files is limited. Can you walk us through a production feature or problem you solved using ${gapOrPartial.skillName}?`,
        motivatingEvidence: gapOrPartial.explanation,
        targetRepoOrSkill: gapOrPartial.skillName,
      });
    } else {
      interviewQuestions.push({
        id: `iq_gap_${gapOrPartial.skillName}`,
        topic: `${gapOrPartial.skillName} Requirement Exploration`,
        question: `This ${jd.title} position requires ${gapOrPartial.skillName}, which was not observed in your public GitHub repositories. Have you used ${gapOrPartial.skillName} in private/commercial work, or how would you approach ramping up on it?`,
        motivatingEvidence: `No public evidence found for ${gapOrPartial.skillName}; designed to clarify private industry experience during live interview.`,
        targetRepoOrSkill: gapOrPartial.skillName,
      });
    }
  }

  if (interviewQuestions.length === 0 && originalRepos[0]) {
    interviewQuestions.push({
      id: 'iq_general_1',
      topic: 'Project Design & Ownership',
      question: `Can you walk through the architecture of "${originalRepos[0].name}" and explain the most challenging bug or design trade-off you resolved?`,
      motivatingEvidence: `Based on ${originalRepos[0].candidateAttributedCommits} attributed commits in ${originalRepos[0].name}.`,
      targetRepoOrSkill: originalRepos[0].name,
    });
  }

  const recruiterSummary = `Candidate @${candidateUsername} shows a ${matchScore}/100 evidence alignment (${guidanceClassification}) against "${jd.title}". Out of ${requiredEvals.length} explicit required skill(s), ${strongestMatchingAreas.filter((r) => r.requirementType === 'Required').length} have strong supporting evidence and ${partialMatches.filter((r) => r.requirementType === 'Required').length} have partial/inconclusive signals across ${originalRepos.length} original repository(ies). This report summarizes observable GitHub evidence to structure technical interviewing and does not constitute an automated hiring decision.`;

  return {
    id: `match_${jd.id}`,
    jobDescription: jd,
    candidateUsername,
    matchScore,
    guidanceClassification,
    guidanceExplanation,
    scoreBreakdown: {
      requiredSkillsPoints,
      requiredSkillsMax: effectiveRequiredMax,
      preferredSkillsPoints,
      preferredSkillsMax: effectivePreferredMax,
      projectRelevancePoints,
      projectRelevanceMax: weights.projectRelevanceMaxPoints,
      attributionReliabilityPoints,
      attributionReliabilityMax: weights.attributionReliabilityMaxPoints,
      formulaSummary: `Required Skills (${requiredSkillsPoints}/${effectiveRequiredMax}) + Preferred Skills (${preferredSkillsPoints}/${effectivePreferredMax}) + Project Relevance (${projectRelevancePoints}/${weights.projectRelevanceMaxPoints}) + Attribution Reliability (${attributionReliabilityPoints}/${weights.attributionReliabilityMaxPoints}) = ${matchScore}/100`,
    },
    requirementEvaluations,
    strongestMatchingAreas,
    partialMatches,
    gapsToAddress,
    recommendedNextSteps,
    recruiterAssessment: {
      strengths,
      gapsAndConcerns,
      interviewQuestions,
      recruiterSummary,
      limitations: [
        'Public GitHub evidence reflects observable open-source and personal repositories only; private enterprise work is not captured.',
        'Absence of evidence for a requirement is reported as "No supporting evidence found" rather than proof of inability.',
        'WorkVerify does not infer personality, protected characteristics, or overall professional worth from commit logs.',
      ],
    },
    evaluatedAt,
  };
}

// ============================================================================
// Section 5: Role Recommendations Engine ("Find Suitable Roles")
// ============================================================================

export interface RoleArchetypeDefinition {
  id: string;
  roleTitle: string;
  category: string;
  coreSkills: string[];
  complementarySkills: string[];
  description: string;
}

export const ROLE_ARCHETYPES: RoleArchetypeDefinition[] = [
  {
    id: 'role_fullstack',
    roleTitle: 'Full-Stack Developer (TypeScript / React / Node.js)',
    category: 'Full-Stack Engineering',
    coreSkills: ['TypeScript', 'React', 'Node.js', 'SQL & PostgreSQL'],
    complementarySkills: ['Next.js', 'HTML & CSS', 'Docker & CI/CD'],
    description:
      'End-to-end web application engineering spanning React/Next.js interfaces, Node.js APIs, and relational PostgreSQL schemas.',
  },
  {
    id: 'role_frontend',
    roleTitle: 'Frontend / UI Engineer (React & TypeScript)',
    category: 'Frontend Engineering',
    coreSkills: ['React', 'TypeScript', 'JavaScript', 'HTML & CSS'],
    complementarySkills: ['Next.js', 'Node.js'],
    description:
      'Component architecture, interactive data dashboards, accessibility, and modern frontend state management.',
  },
  {
    id: 'role_backend',
    roleTitle: 'Backend & API Systems Engineer',
    category: 'Backend Engineering',
    coreSkills: ['Node.js', 'TypeScript', 'SQL & PostgreSQL'],
    complementarySkills: ['Python', 'Docker & CI/CD', 'Go', 'Rust'],
    description:
      'Server-side API design, relational database query optimization, background workers, and service reliability.',
  },
  {
    id: 'role_python_data',
    roleTitle: 'Python Backend & Data Services Developer',
    category: 'Python / Data Engineering',
    coreSkills: ['Python', 'SQL & PostgreSQL'],
    complementarySkills: ['Docker & CI/CD', 'Node.js', 'TypeScript'],
    description:
      'Python service development (FastAPI/SQLAlchemy), data reconciliation pipelines, and SQL analytics.',
  },
  {
    id: 'role_data_sql',
    roleTitle: 'Database & Data Engineer (SQL / PostgreSQL)',
    category: 'Data & Database Engineering',
    coreSkills: ['SQL & PostgreSQL', 'Python', 'TypeScript'],
    complementarySkills: ['Node.js', 'Docker & CI/CD'],
    description:
      'Schema modeling, SQL query planning, migrations, and data validation workflows.',
  },
  {
    id: 'role_devops',
    roleTitle: 'DevOps / Platform & Tooling Engineer',
    category: 'Platform & Infrastructure',
    coreSkills: ['Docker & CI/CD', 'Node.js', 'Python'],
    complementarySkills: ['Go', 'Rust', 'SQL & PostgreSQL'],
    description:
      'Containerized service packaging, CI/CD workflow automation, and developer productivity tooling.',
  },
];

export interface RoleRecommendationItem {
  roleId: string;
  roleTitle: string;
  category: string;
  description: string;
  alignmentScore: number; // 0 - 100
  fitClassification: 'Strong Fit' | 'Moderate Fit' | 'Emerging / Partial Fit';
  whyRecommended: string;
  detectedTechnologies: {
    skillName: string;
    evidenceBand: SkillAssessmentResult['evidenceBand'];
    evidenceScore: number;
  }[];
  supportingRepositories: {
    repoName: string;
    htmlUrl: string;
    primaryLanguage: string | null;
    attributedCommitsCount: number;
  }[];
  wellSupportedRequirements: string[];
  importantGaps: string[];
  readinessImprovements: string[];
}

/**
 * Analyzes demonstrated technical work across normalized repositories and recommends
 * technically justified role categories (Section 5). Never recommends a role based
 * solely on uncorroborated manifest dependencies.
 */
export function recommendSuitableRoles(
  normalizedRepos: NormalizedRepository[],
  evaluatedAt: string = new Date().toISOString()
): RoleRecommendationItem[] {
  const originalRepos = normalizedRepos.filter((r) => !r.isFork);
  if (originalRepos.length === 0) {
    return [];
  }

  // Pre-evaluate all supported skills on original repositories
  const skillMap = new Map<string, SkillAssessmentResult>();
  for (const tech of SUPPORTED_TECHNOLOGIES) {
    skillMap.set(
      tech.canonicalName,
      evaluateSkillEvidence(tech.canonicalName, true, normalizedRepos, evaluatedAt)
    );
  }

  const recommendations: RoleRecommendationItem[] = [];

  for (const archetype of ROLE_ARCHETYPES) {
    const wellSupportedRequirements: string[] = [];
    const importantGaps: string[] = [];
    const detectedTechnologies: RoleRecommendationItem['detectedTechnologies'] = [];
    const repoSet = new Map<
      string,
      {
        repoName: string;
        htmlUrl: string;
        primaryLanguage: string | null;
        attributedCommitsCount: number;
      }
    >();

    let corePoints = 0;
    const maxCorePoints = archetype.coreSkills.length * 100;

    for (const coreSkill of archetype.coreSkills) {
      const res = skillMap.get(coreSkill);
      if (!res) continue;

      // Do not credit dependency-only signals (Insufficient Evidence)
      if (res.evidenceBand === 'Strong Evidence' || res.evidenceBand === 'Moderate Evidence') {
        corePoints += res.evidenceScore;
        wellSupportedRequirements.push(`${coreSkill} (${res.evidenceBand})`);
        detectedTechnologies.push({
          skillName: coreSkill,
          evidenceBand: res.evidenceBand,
          evidenceScore: res.evidenceScore,
        });
        for (const sr of res.supportingRepos) {
          if (!sr.isFork && sr.attributedCommitsCount > 0) {
            const fullRepo = originalRepos.find((r) => r.name === sr.repoName);
            repoSet.set(sr.repoName, {
              repoName: sr.repoName,
              htmlUrl: sr.htmlUrl,
              primaryLanguage: fullRepo?.primaryLanguage || null,
              attributedCommitsCount: sr.attributedCommitsCount,
            });
          }
        }
      } else if (res.evidenceBand === 'Weak Evidence') {
        corePoints += res.evidenceScore * 0.5;
        importantGaps.push(`${coreSkill} (Weak evidence — needs deeper source implementation)`);
        detectedTechnologies.push({
          skillName: coreSkill,
          evidenceBand: res.evidenceBand,
          evidenceScore: res.evidenceScore,
        });
      } else {
        importantGaps.push(`${coreSkill} (No substantive attributed code evidence)`);
      }
    }

    let compBonus = 0;
    for (const compSkill of archetype.complementarySkills) {
      const res = skillMap.get(compSkill);
      if (
        res &&
        (res.evidenceBand === 'Strong Evidence' || res.evidenceBand === 'Moderate Evidence')
      ) {
        compBonus += 5;
        wellSupportedRequirements.push(`${compSkill} (${res.evidenceBand})`);
        detectedTechnologies.push({
          skillName: compSkill,
          evidenceBand: res.evidenceBand,
          evidenceScore: res.evidenceScore,
        });
      }
    }

    // Rule: Do not recommend a role if zero core skills have Strong/Moderate attributed evidence
    if (
      wellSupportedRequirements.filter((w) =>
        archetype.coreSkills.some((cs) => w.startsWith(cs))
      ).length === 0
    ) {
      continue;
    }

    const baseCoreScore = maxCorePoints > 0 ? (corePoints / maxCorePoints) * 88 : 0;
    const alignmentScore = Math.min(98, Math.round(baseCoreScore + Math.min(12, compBonus)));

    let fitClassification: RoleRecommendationItem['fitClassification'] = 'Emerging / Partial Fit';
    if (alignmentScore >= 72) {
      fitClassification = 'Strong Fit';
    } else if (alignmentScore >= 48) {
      fitClassification = 'Moderate Fit';
    }

    const supportingRepositories = Array.from(repoSet.values());
    const whyRecommended = `Recommended based on verified, candidate-attributed code in ${supportingRepositories.map((r) => r.repoName).join(', ')} supporting ${wellSupportedRequirements.slice(0, 4).join(', ')}.`;

    const readinessImprovements: string[] = [];
    for (const gap of importantGaps.slice(0, 3)) {
      const skillToken = gap.split(' (')[0];
      readinessImprovements.push(
        `Add a working ${skillToken} module with substantive source commits and tests in an original repository.`
      );
    }
    if (readinessImprovements.length === 0) {
      readinessImprovements.push(
        `Continue maintaining multi-repository consistency and document system architecture in project READMEs.`
      );
    }

    recommendations.push({
      roleId: archetype.id,
      roleTitle: archetype.roleTitle,
      category: archetype.category,
      description: archetype.description,
      alignmentScore,
      fitClassification,
      whyRecommended,
      detectedTechnologies,
      supportingRepositories,
      wellSupportedRequirements,
      importantGaps,
      readinessImprovements,
    });
  }

  return recommendations.sort((a, b) => b.alignmentScore - a.alignmentScore);
}
