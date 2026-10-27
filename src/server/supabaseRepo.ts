import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeAndAnalyzeRepository,
  evaluateSkillEvidence,
  NormalizedRepository,
  SkillAssessmentResult,
  RawRepositoryInput,
} from '../lib/verificationEngine.ts';
import {
  ExtractedJobDescription,
  JobDescriptionMatchReport,
  RoleRecommendationItem,
  parseJobDescription,
  evaluateJobDescriptionMatch,
  recommendSuitableRoles,
  inferRoleCategoryFromSkillsAndTitle,
} from '../lib/jobMatchEngine.ts';
import type {
  PrimaryWorkspaceRole,
  LinkedIdentityItem,
  UserOnboardingState,
  SavedRecruiterAssessmentItem,
} from '../types/workverify.ts';

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  details: string;
  rateLimitRemaining?: number;
  createdAt: string;
}

export interface PublicAnalysisRecord {
  id: string;
  userId: string | null;
  sessionId: string | null;
  targetType: 'repository' | 'profile';
  targetUrl: string;
  ownerLogin: string;
  repoName: string | null;
  summaryTitle: string;
  repositoriesCount: number;
  topSkills: { skillName: string; evidenceBand: string; evidenceScore: number }[];
  createdAt: string;
}

export interface StoredJobDescription extends ExtractedJobDescription {
  userId: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface UserAccountRecord {
  id: string;
  email: string;
  emailVerified: boolean;
  passwordHashServerOnly?: string; // Never exposed to client
  emailVerificationCodeServerOnly?: string;
  emailVerificationTokenServerOnly?: string;
  emailVerificationExpiresAt?: string | null;
  passwordResetTokenServerOnly?: string;
  passwordResetCodeServerOnly?: string;
  passwordResetExpiresAt?: string | null;
  googleId?: string | null;
  linkedProviders: LinkedIdentityItem[];
  fullName: string;
  roleTitle: string;
  bio: string;
  activeRole: PrimaryWorkspaceRole;
  onboarding: UserOnboardingState;
  githubUsername: string;
  githubConnected: boolean;
  githubAvatarUrl: string;
  githubProfileUrl: string;
  githubConnectedAt: string | null;
  oauthAccessTokenServerOnly?: string; // Never exposed to client
  profileSlug: string;
  isPublicProfile: boolean; // Defaults to false (private)
  publishedAt: string | null;
  lastAnalyzedAt: string | null;
  claimedSkills: string[];
  rawRepositories: RawRepositoryInput[];
  normalizedRepositories: NormalizedRepository[];
  skillAssessments: SkillAssessmentResult[];
  roleRecommendations: RoleRecommendationItem[];
  jobMatchReports: JobDescriptionMatchReport[];
  createdAt: string;
}

interface PersistentStoreState {
  users: UserAccountRecord[];
  sessions: SessionRecord[];
  auditLogs: AuditLogEntry[];
  jobDescriptions: StoredJobDescription[];
  publicAnalyses: PublicAnalysisRecord[];
  recruiterAssessments: SavedRecruiterAssessmentItem[];
}

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', '.data')
  : path.resolve(process.cwd(), '.data');
const LEGACY_PROTOTYPE_DB_PATH = path.join(DATA_DIR, 'workverify-db.json');
const PROD_DB_FILE_PATH = path.join(DATA_DIR, 'workverify-prod-db.json');

// Remove legacy prototype seed database if present so prototype data never leaks
try {
  if (fs.existsSync(LEGACY_PROTOTYPE_DB_PATH)) {
    fs.rmSync(LEGACY_PROTOTYPE_DB_PATH, { force: true });
  }
} catch {
  // Ignore
}

let supabaseClient: SupabaseClient | null = null;
let supabaseInitAttempted = false;
let supabaseHydrated = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseInitAttempted) {
    supabaseInitAttempted = true;
    const url = (process.env.SUPABASE_URL || '').trim();
    const key = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    ).trim();
    if (url && key && url.startsWith('http') && !url.includes('your-project-ref')) {
      try {
        supabaseClient = createClient(url, key, {
          auth: { persistSession: false },
        });
      } catch (err) {
        console.error('Supabase initialization error:', err);
        supabaseClient = null;
      }
    }
  }
  return supabaseClient;
}

export function getSupabaseStatus() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const hasServiceKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your-supabase')
  );
  const hasAnonKey = Boolean(
    process.env.SUPABASE_ANON_KEY &&
      !process.env.SUPABASE_ANON_KEY.includes('your-supabase')
  );
  const configured = Boolean(
    url &&
      url.startsWith('http') &&
      !url.includes('your-project-ref') &&
      (hasServiceKey || hasAnonKey)
  );

  const googleOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      !process.env.GOOGLE_CLIENT_ID.includes('your-google')
  );

  const githubOAuthConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      !process.env.GITHUB_CLIENT_ID.includes('your-github')
  );

  const missingEnvVars: string[] = [];
  if (!url || url.includes('your-project-ref')) missingEnvVars.push('SUPABASE_URL');
  if (!hasServiceKey && !hasAnonKey) missingEnvVars.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!googleOAuthConfigured) {
    missingEnvVars.push('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET');
  }
  if (!githubOAuthConfigured) {
    missingEnvVars.push('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET');
  }

  return {
    provider: 'Supabase PostgreSQL',
    configured,
    projectUrl: configured ? url : null,
    authMode: hasServiceKey
      ? 'Service Role Key (Server-Side Admin)'
      : hasAnonKey
      ? 'Anon Key (RLS Mode)'
      : 'Isolated Server-Side Relational Store (Configure SUPABASE_URL for cloud sync)',
    googleOAuthConfigured,
    githubOAuthConfigured,
    githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()),
    missingEnvVars,
  };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

function generateUniqueSlug(baseName: string, existingUsers: UserAccountRecord[]): string {
  const baseSlug =
    baseName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'developer';

  let candidate = baseSlug;
  let counter = 1;
  while (existingUsers.some((u) => u.profileSlug.toLowerCase() === candidate.toLowerCase())) {
    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
  return candidate;
}

export function createDefaultOnboardingState(
  primaryRole: PrimaryWorkspaceRole = 'developer',
  completed = false
): UserOnboardingState {
  return {
    completed,
    completedAt: completed ? new Date().toISOString() : null,
    primaryRole,
    secondaryRoles: [],
    developerPrefs: {
      currentStatus: 'Actively job hunting',
      targetRole: 'Full-Stack',
      mainGoal: 'Verify skills & check job readiness',
    },
    recruiterPrefs: {
      hiringContext: 'Hiring Manager / Technical Recruiter',
      hiringRoles: ['Full-Stack', 'Backend'],
      evaluationPriority: 'Required skills & code ownership',
    },
    otherPrefs: {
      primaryIntent: 'Inspect a public GitHub profile or repo',
      focusNotes: '',
    },
  };
}

function normalizeStoredUserRecord(raw: any): UserAccountRecord {
  const nowIso = raw.createdAt || new Date().toISOString();
  const hasPassword = Boolean(raw.passwordHashServerOnly && raw.passwordHashServerOnly.includes(':'));
  const emailVerified = typeof raw.emailVerified === 'boolean' ? raw.emailVerified : false;

  const defaultProviders: LinkedIdentityItem[] = [];
  if (hasPassword && raw.email) {
    defaultProviders.push({
      provider: 'email',
      providerId: raw.email.toLowerCase(),
      email: raw.email.toLowerCase(),
      displayName: raw.fullName || raw.email,
      verified: emailVerified,
      linkedAt: nowIso,
    });
  }
  if (raw.googleId) {
    defaultProviders.push({
      provider: 'google',
      providerId: raw.googleId,
      email: raw.email.toLowerCase(),
      displayName: raw.fullName,
      verified: true,
      linkedAt: nowIso,
    });
  }
  if (raw.githubConnected && raw.githubUsername) {
    defaultProviders.push({
      provider: 'github',
      providerId: raw.githubUsername.toLowerCase(),
      email: raw.email.toLowerCase(),
      displayName: `@${raw.githubUsername}`,
      verified: true,
      linkedAt: raw.githubConnectedAt || nowIso,
    });
  }

  const linkedProviders: LinkedIdentityItem[] =
    Array.isArray(raw.linkedProviders) && raw.linkedProviders.length > 0
      ? raw.linkedProviders
      : defaultProviders;

  const defaultOnboarding = createDefaultOnboardingState('developer', false);
  const rawOnboarding = raw.onboarding || {};
  const onboarding: UserOnboardingState = {
    completed: Boolean(rawOnboarding.completed),
    completedAt: rawOnboarding.completedAt || null,
    primaryRole:
      rawOnboarding.primaryRole === 'recruiter' || rawOnboarding.primaryRole === 'other'
        ? rawOnboarding.primaryRole
        : 'developer',
    secondaryRoles: Array.isArray(rawOnboarding.secondaryRoles)
      ? rawOnboarding.secondaryRoles
      : [],
    developerPrefs: {
      ...defaultOnboarding.developerPrefs,
      ...(rawOnboarding.developerPrefs || {}),
    },
    recruiterPrefs: {
      ...defaultOnboarding.recruiterPrefs,
      ...(rawOnboarding.recruiterPrefs || {}),
    },
    otherPrefs: {
      ...defaultOnboarding.otherPrefs,
      ...(rawOnboarding.otherPrefs || {}),
    },
  };

  const activeRole: PrimaryWorkspaceRole =
    raw.activeRole === 'recruiter' || raw.activeRole === 'other' || raw.activeRole === 'developer'
      ? raw.activeRole
      : onboarding.primaryRole;

  return {
    ...raw,
    emailVerified,
    linkedProviders,
    onboarding,
    activeRole,
    claimedSkills: Array.isArray(raw.claimedSkills) ? raw.claimedSkills : [],
    rawRepositories: Array.isArray(raw.rawRepositories) ? raw.rawRepositories : [],
    normalizedRepositories: Array.isArray(raw.normalizedRepositories)
      ? raw.normalizedRepositories
      : [],
    skillAssessments: Array.isArray(raw.skillAssessments) ? raw.skillAssessments : [],
    roleRecommendations: Array.isArray(raw.roleRecommendations) ? raw.roleRecommendations : [],
    jobMatchReports: Array.isArray(raw.jobMatchReports) ? raw.jobMatchReports : [],
    createdAt: nowIso,
  };
}

function recomputeUserAnalysis(
  rawUser: UserAccountRecord,
  userJobDescriptions: StoredJobDescription[] = []
): UserAccountRecord {
  const user = normalizeStoredUserRecord(rawUser);
  const rawRepos = user.rawRepositories || [];
  if (rawRepos.length === 0 && !user.lastAnalyzedAt) {
    // Genuine empty state for users who have not analyzed any repositories yet
    const emptyJobMatches = userJobDescriptions.map((jd) =>
      evaluateJobDescriptionMatch(jd, [], user.githubUsername || user.fullName || 'candidate')
    );
    return {
      ...user,
      normalizedRepositories: [],
      skillAssessments: [],
      roleRecommendations: [],
      jobMatchReports: emptyJobMatches,
    };
  }

  const nowIso = user.lastAnalyzedAt || new Date().toISOString();
  const normalizedRepositories = rawRepos.map((repo) =>
    normalizeAndAnalyzeRepository(
      repo,
      user.githubUsername || user.fullName,
      user.fullName
    )
  );

  const seenSkills = new Set<string>();
  const skillAssessments: SkillAssessmentResult[] = [];

  for (const claimed of user.claimedSkills) {
    const assessment = evaluateSkillEvidence(claimed, true, normalizedRepositories, nowIso);
    seenSkills.add(assessment.skillName.toLowerCase());
    skillAssessments.push(assessment);
  }

  for (const repo of normalizedRepositories) {
    if (repo.isFork) continue;
    for (const signal of repo.detectedTechnologies) {
      const key = signal.skillName.toLowerCase();
      if (!seenSkills.has(key)) {
        seenSkills.add(key);
        const autoAssessment = evaluateSkillEvidence(
          signal.skillName,
          false,
          normalizedRepositories,
          nowIso
        );
        skillAssessments.push(autoAssessment);
      }
    }
  }

  skillAssessments.sort((a, b) => {
    if (a.claimedByUser !== b.claimedByUser) return a.claimedByUser ? -1 : 1;
    return b.evidenceScore - a.evidenceScore;
  });

  const roleRecommendations = recommendSuitableRoles(normalizedRepositories, nowIso);

  const jobMatchReports = userJobDescriptions
    .map((jd) =>
      evaluateJobDescriptionMatch(
        jd,
        normalizedRepositories,
        user.githubUsername || user.fullName || 'candidate',
        undefined,
        nowIso
      )
    )
    .sort((a, b) => b.matchScore - a.matchScore);

  return {
    ...user,
    normalizedRepositories,
    skillAssessments,
    roleRecommendations,
    jobMatchReports,
  };
}

function loadStore(): PersistentStoreState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(PROD_DB_FILE_PATH)) {
    try {
      const content = fs.readFileSync(PROD_DB_FILE_PATH, 'utf8');
      const parsed = JSON.parse(content) as Partial<PersistentStoreState>;
      return {
        users: Array.isArray(parsed.users)
          ? parsed.users.map((u) => normalizeStoredUserRecord(u))
          : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        jobDescriptions: Array.isArray(parsed.jobDescriptions) ? parsed.jobDescriptions : [],
        publicAnalyses: Array.isArray(parsed.publicAnalyses) ? parsed.publicAnalyses : [],
        recruiterAssessments: Array.isArray(parsed.recruiterAssessments)
          ? parsed.recruiterAssessments
          : [],
      };
    } catch (err) {
      console.error('Error reading store, initializing empty production store:', err);
    }
  }

  // Production store starts 100% clean — zero preloaded users, zero sample repos
  const emptyState: PersistentStoreState = {
    users: [],
    sessions: [],
    auditLogs: [],
    jobDescriptions: [],
    publicAnalyses: [],
    recruiterAssessments: [],
  };
  saveStore(emptyState, true);
  return emptyState;
}

function saveStore(state: PersistentStoreState, skipRemoteSync = false): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(PROD_DB_FILE_PATH, JSON.stringify(state, null, 2), 'utf8');
  if (!skipRemoteSync) {
    void syncStateToSupabase(state);
  }
}

async function syncStateToSupabase(state: PersistentStoreState): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from('wv_kv_store').upsert({
      key: 'workverify_prod_state',
      state_json: state,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Supabase state sync warning:', err instanceof Error ? err.message : err);
  }
}

export async function ensureSupabaseHydrated(): Promise<void> {
  if (supabaseHydrated) return;
  supabaseHydrated = true;
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from('wv_kv_store')
      .select('state_json')
      .eq('key', 'workverify_prod_state')
      .maybeSingle();

    if (!error && data && data.state_json && typeof data.state_json === 'object') {
      const remote = data.state_json as Partial<PersistentStoreState>;
      const hydrated: PersistentStoreState = {
        users: Array.isArray(remote.users)
          ? remote.users.map((u) => normalizeStoredUserRecord(u))
          : [],
        sessions: Array.isArray(remote.sessions) ? remote.sessions : [],
        auditLogs: Array.isArray(remote.auditLogs) ? remote.auditLogs : [],
        jobDescriptions: Array.isArray(remote.jobDescriptions) ? remote.jobDescriptions : [],
        publicAnalyses: Array.isArray(remote.publicAnalyses) ? remote.publicAnalyses : [],
        recruiterAssessments: Array.isArray(remote.recruiterAssessments)
          ? remote.recruiterAssessments
          : [],
      };
      saveStore(hydrated, true);
    }
  } catch (err) {
    console.warn('Supabase cold-start hydration warning:', err instanceof Error ? err.message : err);
  }
}

/**
 * Strips server-only OAuth tokens, password hashes, and raw reset tokens before returning user record to client APIs.
 */
export function sanitizeUserForClient(user: UserAccountRecord) {
  const normalized = normalizeStoredUserRecord(user);
  const {
    oauthAccessTokenServerOnly: _token,
    passwordHashServerOnly: pwHash,
    emailVerificationCodeServerOnly: verifyCode,
    emailVerificationTokenServerOnly: _verifyToken,
    emailVerificationExpiresAt: _verifyExp,
    passwordResetTokenServerOnly: _resetToken,
    passwordResetCodeServerOnly: _resetCode,
    passwordResetExpiresAt: _resetExp,
    rawRepositories: _rawRepos,
    ...safeUser
  } = normalized;

  return {
    ...safeUser,
    hasPassword: Boolean(pwHash && pwHash.includes(':')),
    pendingVerificationPreviewCode: !normalized.emailVerified ? verifyCode || null : null,
  };
}

async function syncUserToSupabase(user: UserAccountRecord, log?: AuditLogEntry): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  try {
    await sb.from('wv_users').upsert({
      id: user.id,
      email: user.email,
      password_hash: user.passwordHashServerOnly || '',
      email_verified: user.emailVerified,
      email_verification_code: user.emailVerificationCodeServerOnly || null,
      email_verification_expires_at: user.emailVerificationExpiresAt || null,
      password_reset_token: user.passwordResetTokenServerOnly || null,
      password_reset_expires_at: user.passwordResetExpiresAt || null,
      google_id: user.googleId || null,
      linked_providers_json: user.linkedProviders || [],
      full_name: user.fullName,
      role_title: user.roleTitle,
      bio: user.bio,
      onboarding_completed: user.onboarding?.completed ?? false,
      primary_role: user.onboarding?.primaryRole ?? 'developer',
      secondary_roles_json: user.onboarding?.secondaryRoles ?? [],
      active_role: user.activeRole ?? 'developer',
      onboarding_answers_json: user.onboarding ?? {},
      github_username: user.githubUsername,
      github_connected: user.githubConnected,
      github_avatar_url: user.githubAvatarUrl,
      github_profile_url: user.githubProfileUrl,
      github_connected_at: user.githubConnectedAt,
      profile_slug: user.profileSlug,
      is_public_profile: user.isPublicProfile,
      published_at: user.publishedAt,
      last_analyzed_at: user.lastAnalyzedAt,
      updated_at: new Date().toISOString(),
    });

    if (log) {
      await sb.from('wv_audit_logs').insert({
        id: log.id,
        user_id: log.userId,
        action: log.action,
        status: log.status,
        details: log.details,
        rate_limit_remaining: log.rateLimitRemaining ?? null,
        created_at: log.createdAt,
      });
    }
  } catch (err) {
    console.warn('Supabase sync warning:', err instanceof Error ? err.message : err);
  }
}

async function deleteUserFromSupabase(userId: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from('wv_repositories').delete().eq('user_id', userId);
    await sb.from('wv_skill_claims').delete().eq('user_id', userId);
    await sb.from('wv_job_descriptions').delete().eq('user_id', userId);
    await sb.from('wv_job_matches').delete().eq('user_id', userId);
    await sb.from('wv_recruiter_assessments').delete().eq('user_id', userId);
    await sb.from('wv_github_tokens').delete().eq('user_id', userId);
  } catch (err) {
    console.warn('Supabase delete sync warning:', err instanceof Error ? err.message : err);
  }
}

function createSessionForUser(store: PersistentStoreState, userId: string): SessionRecord {
  const nowIso = new Date().toISOString();
  const token = `wv_sess_${crypto.randomBytes(24).toString('hex')}`;
  const session: SessionRecord = {
    token,
    userId,
    createdAt: nowIso,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  };
  store.sessions.push(session);
  return session;
}

export const dbRepository = {
  // ==========================================================================
  // 1. Authentication, Email Verification, Password Reset & Identity Linking
  // ==========================================================================
  registerUser(payload: {
    email: string;
    password: string;
    fullName: string;
    roleTitle?: string;
  }): {
    user: UserAccountRecord;
    token: string;
    verificationToken: string;
    verificationCode: string;
  } {
    const store = loadStore();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const cleanName = (payload.fullName || '').trim();
    const password = payload.password || '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      throw new Error('Please provide a valid email address (including any Gmail or work email).');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (!cleanName) {
      throw new Error('Please provide your full name.');
    }

    if (store.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists. Please sign in.');
    }

    const nowIso = new Date().toISOString();
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const slug = generateUniqueSlug(cleanName, store.users);
    const verificationCode = generateSixDigitCode();
    const verificationToken = `wv_verify_${crypto.randomBytes(20).toString('hex')}`;
    const verificationExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const newUser: UserAccountRecord = {
      id: userId,
      email: cleanEmail,
      emailVerified: false,
      passwordHashServerOnly: hashPassword(password),
      emailVerificationCodeServerOnly: verificationCode,
      emailVerificationTokenServerOnly: verificationToken,
      emailVerificationExpiresAt: verificationExpiresAt,
      googleId: null,
      linkedProviders: [
        {
          provider: 'email',
          providerId: cleanEmail,
          email: cleanEmail,
          displayName: cleanName,
          verified: false,
          linkedAt: nowIso,
        },
      ],
      fullName: cleanName,
      roleTitle: (payload.roleTitle || 'Software Engineer').trim(),
      bio: '',
      activeRole: 'developer',
      onboarding: createDefaultOnboardingState('developer', false),
      githubUsername: '',
      githubConnected: false,
      githubAvatarUrl: '',
      githubProfileUrl: '',
      githubConnectedAt: null,
      profileSlug: slug,
      isPublicProfile: false, // Default strictly private!
      publishedAt: null,
      lastAnalyzedAt: null,
      claimedSkills: [],
      rawRepositories: [],
      normalizedRepositories: [],
      skillAssessments: [],
      roleRecommendations: [],
      jobMatchReports: [],
      createdAt: nowIso,
    };

    const session = createSessionForUser(store, userId);

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'USER_ACCOUNT_REGISTERED',
      status: 'SUCCESS',
      details: `Created new WorkVerify account for ${cleanEmail} (Email verification pending, onboarding pending).`,
      createdAt: nowIso,
    };

    store.users.push(newUser);
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(newUser, log);

    return {
      user: newUser,
      token: session.token,
      verificationToken,
      verificationCode,
    };
  },

  loginUser(payload: {
    email: string;
    password: string;
  }): { user: UserAccountRecord; token: string } {
    const store = loadStore();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const password = payload.password || '';

    const user = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (!user.passwordHashServerOnly) {
      const providers = user.linkedProviders.map((p) => p.provider).join(', ');
      throw new Error(
        `This account was created via ${providers || 'OAuth'} and does not have a password set yet. Sign in with Google or use Forgot Password to set a password.`
      );
    }

    if (!verifyPassword(password, user.passwordHashServerOnly)) {
      throw new Error('Invalid email or password.');
    }

    const session = createSessionForUser(store, user.id);
    const userJds = store.jobDescriptions.filter((j) => j.userId === user.id);
    const refreshedUser = recomputeUserAnalysis(user, userJds);

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId: user.id,
      action: 'USER_SIGNED_IN',
      status: 'SUCCESS',
      details: `Signed in via email/password (${cleanEmail}).`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);

    return { user: refreshedUser, token: session.token };
  },

  verifyUserEmail(payload: {
    userId?: string | null;
    tokenOrCode: string;
  }): UserAccountRecord {
    const store = loadStore();
    const cleanInput = (payload.tokenOrCode || '').trim();
    if (!cleanInput) {
      throw new Error('Please enter your 6-digit verification code or verification token.');
    }

    const uIdx = store.users.findIndex((u) => {
      if (payload.userId && u.id === payload.userId) {
        return (
          u.emailVerificationCodeServerOnly === cleanInput ||
          u.emailVerificationTokenServerOnly === cleanInput
        );
      }
      return (
        u.emailVerificationTokenServerOnly === cleanInput ||
        (payload.userId ? false : u.emailVerificationCodeServerOnly === cleanInput)
      );
    });

    if (uIdx === -1) {
      throw new Error('Invalid or expired email verification code.');
    }

    const current = normalizeStoredUserRecord(store.users[uIdx]);
    if (
      current.emailVerificationExpiresAt &&
      new Date(current.emailVerificationExpiresAt).getTime() < Date.now()
    ) {
      throw new Error('Verification code has expired. Please request a new code.');
    }

    const updatedProviders = current.linkedProviders.map((p) =>
      p.provider === 'email' ? { ...p, verified: true } : p
    );

    const updatedUser: UserAccountRecord = {
      ...current,
      emailVerified: true,
      emailVerificationCodeServerOnly: undefined,
      emailVerificationTokenServerOnly: undefined,
      emailVerificationExpiresAt: null,
      linkedProviders: updatedProviders,
    };

    const userJds = store.jobDescriptions.filter((j) => j.userId === updatedUser.id);
    const computed = recomputeUserAnalysis(updatedUser, userJds);
    store.users[uIdx] = computed;

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId: computed.id,
      action: 'EMAIL_VERIFIED',
      status: 'SUCCESS',
      details: `Verified email address ${computed.email}.`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(computed, log);

    return computed;
  },

  resendEmailVerification(payload: {
    userId?: string | null;
    email?: string | null;
  }): {
    user: UserAccountRecord;
    verificationCode: string;
    verificationToken: string;
  } {
    const store = loadStore();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const uIdx = store.users.findIndex((u) =>
      payload.userId ? u.id === payload.userId : u.email.toLowerCase() === cleanEmail
    );

    if (uIdx === -1) {
      throw new Error('Account not found.');
    }

    const current = normalizeStoredUserRecord(store.users[uIdx]);
    if (current.emailVerified) {
      return {
        user: current,
        verificationCode: '',
        verificationToken: '',
      };
    }

    const verificationCode = generateSixDigitCode();
    const verificationToken = `wv_verify_${crypto.randomBytes(20).toString('hex')}`;
    const verificationExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const updatedUser: UserAccountRecord = {
      ...current,
      emailVerificationCodeServerOnly: verificationCode,
      emailVerificationTokenServerOnly: verificationToken,
      emailVerificationExpiresAt: verificationExpiresAt,
    };

    store.users[uIdx] = updatedUser;
    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId: updatedUser.id,
      action: 'EMAIL_VERIFICATION_RESENT',
      status: 'SUCCESS',
      details: `Generated fresh email verification code for ${updatedUser.email}.`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(updatedUser, log);

    return {
      user: updatedUser,
      verificationCode,
      verificationToken,
    };
  },

  requestPasswordReset(email: string): {
    found: boolean;
    resetToken?: string;
    resetCode?: string;
    email: string;
  } {
    const store = loadStore();
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const uIdx = store.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (uIdx === -1) {
      // Return consistent response without leaking whether arbitrary emails exist
      return { found: false, email: cleanEmail };
    }

    const current = normalizeStoredUserRecord(store.users[uIdx]);
    const resetToken = `wv_rst_${crypto.randomBytes(24).toString('hex')}`;
    const resetCode = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const updatedUser: UserAccountRecord = {
      ...current,
      passwordResetTokenServerOnly: resetToken,
      passwordResetCodeServerOnly: resetCode,
      passwordResetExpiresAt: expiresAt,
    };

    store.users[uIdx] = updatedUser;
    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId: updatedUser.id,
      action: 'PASSWORD_RESET_REQUESTED',
      status: 'WARNING',
      details: `Issued time-limited password reset token (expires in 60m) for ${cleanEmail}.`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(updatedUser, log);

    return {
      found: true,
      resetToken,
      resetCode,
      email: cleanEmail,
    };
  },

  resetPasswordWithToken(payload: {
    email?: string;
    tokenOrCode: string;
    newPassword: string;
  }): { user: UserAccountRecord; token: string } {
    const store = loadStore();
    const cleanToken = (payload.tokenOrCode || '').trim();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const newPassword = payload.newPassword || '';

    if (!cleanToken) {
      throw new Error('Please provide your password reset token or 6-digit reset code.');
    }
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const uIdx = store.users.findIndex((u) => {
      if (u.passwordResetTokenServerOnly === cleanToken) return true;
      if (
        u.passwordResetCodeServerOnly === cleanToken &&
        (!cleanEmail || u.email.toLowerCase() === cleanEmail)
      ) {
        return true;
      }
      return false;
    });

    if (uIdx === -1) {
      throw new Error('Invalid or expired password reset token.');
    }

    const current = normalizeStoredUserRecord(store.users[uIdx]);
    if (
      !current.passwordResetExpiresAt ||
      new Date(current.passwordResetExpiresAt).getTime() < Date.now()
    ) {
      throw new Error('This password reset token has expired. Please request a new one.');
    }

    const nowIso = new Date().toISOString();
    const hasEmailProvider = current.linkedProviders.some((p) => p.provider === 'email');
    const nextProviders: LinkedIdentityItem[] = hasEmailProvider
      ? current.linkedProviders.map((p) =>
          p.provider === 'email' ? { ...p, verified: true } : p
        )
      : [
          ...current.linkedProviders,
          {
            provider: 'email',
            providerId: current.email.toLowerCase(),
            email: current.email.toLowerCase(),
            displayName: current.fullName,
            verified: true,
            linkedAt: nowIso,
          },
        ];

    const updatedUser: UserAccountRecord = {
      ...current,
      emailVerified: true,
      passwordHashServerOnly: hashPassword(newPassword),
      passwordResetTokenServerOnly: undefined,
      passwordResetCodeServerOnly: undefined,
      passwordResetExpiresAt: null,
      linkedProviders: nextProviders,
    };

    const userJds = store.jobDescriptions.filter((j) => j.userId === updatedUser.id);
    const computed = recomputeUserAnalysis(updatedUser, userJds);
    store.users[uIdx] = computed;

    // Revoke older sessions on password reset and issue a fresh session
    store.sessions = store.sessions.filter((s) => s.userId !== computed.id);
    const session = createSessionForUser(store, computed.id);

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId: computed.id,
      action: 'PASSWORD_RESET_COMPLETED',
      status: 'SUCCESS',
      details: 'Password reset completed and active sessions rotated.',
      createdAt: nowIso,
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(computed, log);

    return { user: computed, token: session.token };
  },

  changePassword(
    userId: string,
    payload: { currentPassword?: string; newPassword: string }
  ): UserAccountRecord {
    const store = loadStore();
    const uIdx = store.users.findIndex((u) => u.id === userId);
    if (uIdx === -1) throw new Error('Authenticated user not found.');

    const current = normalizeStoredUserRecord(store.users[uIdx]);
    const newPassword = payload.newPassword || '';
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    if (current.passwordHashServerOnly && current.passwordHashServerOnly.includes(':')) {
      if (!payload.currentPassword || !verifyPassword(payload.currentPassword, current.passwordHashServerOnly)) {
        throw new Error('Current password is incorrect.');
      }
    }

    const nowIso = new Date().toISOString();
    const hasEmailProvider = current.linkedProviders.some((p) => p.provider === 'email');
    const nextProviders: LinkedIdentityItem[] = hasEmailProvider
      ? current.linkedProviders
      : [
          ...current.linkedProviders,
          {
            provider: 'email',
            providerId: current.email.toLowerCase(),
            email: current.email.toLowerCase(),
            displayName: current.fullName,
            verified: current.emailVerified,
            linkedAt: nowIso,
          },
        ];

    const updatedUser: UserAccountRecord = {
      ...current,
      passwordHashServerOnly: hashPassword(newPassword),
      linkedProviders: nextProviders,
    };

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const computed = recomputeUserAnalysis(updatedUser, userJds);
    store.users[uIdx] = computed;

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'PASSWORD_UPDATED',
      status: 'SUCCESS',
      details: 'Updated account password in Settings.',
      createdAt: nowIso,
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(computed, log);
    return computed;
  },

  authenticateOrLinkGoogle(payload: {
    googleId: string;
    email: string;
    emailVerified: boolean;
    fullName: string;
    avatarUrl?: string;
    currentUserId?: string | null;
  }): { user: UserAccountRecord; token: string; linkedToExisting: boolean } {
    const store = loadStore();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const googleId = (payload.googleId || '').trim();
    if (!googleId || !cleanEmail) {
      throw new Error('Invalid Google identity payload.');
    }

    const nowIso = new Date().toISOString();

    // Case 1: Explicit linking requested by an already-authenticated user
    if (payload.currentUserId) {
      const conflictUser = store.users.find(
        (u) =>
          u.id !== payload.currentUserId &&
          (u.googleId === googleId ||
            u.linkedProviders?.some((p) => p.provider === 'google' && p.providerId === googleId))
      );
      if (conflictUser) {
        throw new Error('This Google account is already linked to another WorkVerify account.');
      }

      const uIdx = store.users.findIndex((u) => u.id === payload.currentUserId);
      if (uIdx === -1) throw new Error('Authenticated user not found.');

      const current = normalizeStoredUserRecord(store.users[uIdx]);
      const filteredProviders = current.linkedProviders.filter((p) => p.provider !== 'google');
      const nextProviders: LinkedIdentityItem[] = [
        ...filteredProviders,
        {
          provider: 'google',
          providerId: googleId,
          email: cleanEmail,
          displayName: payload.fullName || cleanEmail,
          verified: payload.emailVerified,
          linkedAt: nowIso,
        },
      ];

      const updatedUser: UserAccountRecord = {
        ...current,
        googleId,
        emailVerified:
          current.emailVerified ||
          (payload.emailVerified && current.email.toLowerCase() === cleanEmail),
        linkedProviders: nextProviders,
      };

      const userJds = store.jobDescriptions.filter((j) => j.userId === updatedUser.id);
      const computed = recomputeUserAnalysis(updatedUser, userJds);
      store.users[uIdx] = computed;

      const session = createSessionForUser(store, computed.id);
      const log: AuditLogEntry = {
        id: `log_${Date.now()}`,
        userId: computed.id,
        action: 'GOOGLE_IDENTITY_LINKED',
        status: 'SUCCESS',
        details: `Explicitly linked Google account (${cleanEmail}) to existing WorkVerify identity.`,
        createdAt: nowIso,
      };
      store.auditLogs.unshift(log);
      saveStore(store);
      void syncUserToSupabase(computed, log);

      return { user: computed, token: session.token, linkedToExisting: true };
    }

    // Case 2: Unauthenticated sign-in / sign-up via Google
    // 2a. Look up by exact googleId first
    const byGoogleIdx = store.users.findIndex(
      (u) =>
        u.googleId === googleId ||
        u.linkedProviders?.some((p) => p.provider === 'google' && p.providerId === googleId)
    );
    if (byGoogleIdx !== -1) {
      const existing = normalizeStoredUserRecord(store.users[byGoogleIdx]);
      const userJds = store.jobDescriptions.filter((j) => j.userId === existing.id);
      const computed = recomputeUserAnalysis(existing, userJds);
      const session = createSessionForUser(store, computed.id);
      saveStore(store);
      return { user: computed, token: session.token, linkedToExisting: true };
    }

    // 2b. Check if an account with the same email exists
    const byEmailIdx = store.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (byEmailIdx !== -1) {
      const existing = normalizeStoredUserRecord(store.users[byEmailIdx]);
      // Security rule: NEVER merge accounts just because an unverified or ambiguous email matches!
      if (!existing.emailVerified || !payload.emailVerified) {
        throw new Error(
          'An account with this email already exists, but its email ownership was not verified yet. For your security, please sign in with your password, verify your email, and link Google from Settings.'
        );
      }

      // Both existing account email and Google email are verified -> safe canonical identity link
      const nextProviders: LinkedIdentityItem[] = [
        ...existing.linkedProviders.filter((p) => p.provider !== 'google'),
        {
          provider: 'google',
          providerId: googleId,
          email: cleanEmail,
          displayName: payload.fullName || cleanEmail,
          verified: true,
          linkedAt: nowIso,
        },
      ];
      const updatedUser: UserAccountRecord = {
        ...existing,
        googleId,
        linkedProviders: nextProviders,
      };
      const userJds = store.jobDescriptions.filter((j) => j.userId === updatedUser.id);
      const computed = recomputeUserAnalysis(updatedUser, userJds);
      store.users[byEmailIdx] = computed;

      const session = createSessionForUser(store, computed.id);
      const log: AuditLogEntry = {
        id: `log_${Date.now()}`,
        userId: computed.id,
        action: 'GOOGLE_VERIFIED_IDENTITY_LINKED',
        status: 'SUCCESS',
        details: `Signed in with Google and linked verified identity (${cleanEmail}).`,
        createdAt: nowIso,
      };
      store.auditLogs.unshift(log);
      saveStore(store);
      void syncUserToSupabase(computed, log);
      return { user: computed, token: session.token, linkedToExisting: true };
    }

    // 2c. Create a new canonical user account via Google OAuth
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const displayName = (payload.fullName || cleanEmail.split('@')[0] || 'User').trim();
    const slug = generateUniqueSlug(displayName, store.users);

    const newUser: UserAccountRecord = {
      id: userId,
      email: cleanEmail,
      emailVerified: Boolean(payload.emailVerified),
      googleId,
      linkedProviders: [
        {
          provider: 'google',
          providerId: googleId,
          email: cleanEmail,
          displayName,
          verified: Boolean(payload.emailVerified),
          linkedAt: nowIso,
        },
      ],
      fullName: displayName,
      roleTitle: 'Software Engineer',
      bio: '',
      activeRole: 'developer',
      onboarding: createDefaultOnboardingState('developer', false),
      githubUsername: '',
      githubConnected: false,
      githubAvatarUrl: payload.avatarUrl || '',
      githubProfileUrl: '',
      githubConnectedAt: null,
      profileSlug: slug,
      isPublicProfile: false,
      publishedAt: null,
      lastAnalyzedAt: null,
      claimedSkills: [],
      rawRepositories: [],
      normalizedRepositories: [],
      skillAssessments: [],
      roleRecommendations: [],
      jobMatchReports: [],
      createdAt: nowIso,
    };

    const session = createSessionForUser(store, userId);
    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'USER_REGISTERED_VIA_GOOGLE',
      status: 'SUCCESS',
      details: `Created WorkVerify account via Google OAuth (${cleanEmail}).`,
      createdAt: nowIso,
    };

    store.users.push(newUser);
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(newUser, log);

    return { user: newUser, token: session.token, linkedToExisting: false };
  },

  unlinkAuthProvider(
    userId: string,
    provider: 'email' | 'google' | 'github'
  ): UserAccountRecord {
    const store = loadStore();
    const uIdx = store.users.findIndex((u) => u.id === userId);
    if (uIdx === -1) throw new Error('User not found.');

    const current = normalizeStoredUserRecord(store.users[uIdx]);

    if (provider === 'github') {
      return this.disconnectGitHub(userId);
    }

    // Lockout protection: count remaining viable platform login methods ('email' or 'google')
    const loginProviders = current.linkedProviders.filter(
      (p) => p.provider === 'email' || p.provider === 'google'
    );
    const targetExists = loginProviders.some((p) => p.provider === provider);
    if (!targetExists) {
      throw new Error(`Provider "${provider}" is not currently linked to your account.`);
    }

    if (loginProviders.length <= 1) {
      throw new Error(
        `Cannot unlink ${
          provider === 'google' ? 'Google' : 'Email/Password'
        } because it is your only active sign-in method. Add a password or link another sign-in provider first so you don't get locked out.`
      );
    }

    const updatedUser: UserAccountRecord = {
      ...current,
      googleId: provider === 'google' ? null : current.googleId,
      passwordHashServerOnly:
        provider === 'email' ? undefined : current.passwordHashServerOnly,
      linkedProviders: current.linkedProviders.filter((p) => p.provider !== provider),
    };

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const computed = recomputeUserAnalysis(updatedUser, userJds);
    store.users[uIdx] = computed;

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'AUTH_PROVIDER_UNLINKED',
      status: 'WARNING',
      details: `Unlinked ${provider} sign-in provider from account.`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(computed, log);

    return computed;
  },

  // ==========================================================================
  // 2. Adaptive Onboarding & Multi-Role Workspace Switching
  // ==========================================================================
  saveOnboardingPreferences(
    userId: string,
    payload: {
      primaryRole: PrimaryWorkspaceRole;
      secondaryRoles?: PrimaryWorkspaceRole[];
      developerPrefs?: Partial<UserOnboardingState['developerPrefs']>;
      recruiterPrefs?: Partial<UserOnboardingState['recruiterPrefs']>;
      otherPrefs?: Partial<UserOnboardingState['otherPrefs']>;
      completed?: boolean;
    }
  ): UserAccountRecord {
    const store = loadStore();
    const uIdx = store.users.findIndex((u) => u.id === userId);
    if (uIdx === -1) throw new Error('Authenticated user not found.');

    const current = normalizeStoredUserRecord(store.users[uIdx]);
    const nowIso = new Date().toISOString();

    const primaryRole: PrimaryWorkspaceRole =
      payload.primaryRole === 'recruiter' || payload.primaryRole === 'other'
        ? payload.primaryRole
        : 'developer';

    const cleanSecondary = Array.isArray(payload.secondaryRoles)
      ? Array.from(
          new Set(
            payload.secondaryRoles.filter(
              (r): r is PrimaryWorkspaceRole =>
                (r === 'developer' || r === 'recruiter' || r === 'other') &&
                r !== primaryRole
            )
          )
        )
      : current.onboarding.secondaryRoles.filter((r) => r !== primaryRole);

    const nextOnboarding: UserOnboardingState = {
      completed: payload.completed !== undefined ? payload.completed : true,
      completedAt: nowIso,
      primaryRole,
      secondaryRoles: cleanSecondary,
      developerPrefs: {
        ...current.onboarding.developerPrefs,
        ...(payload.developerPrefs || {}),
      },
      recruiterPrefs: {
        ...current.onboarding.recruiterPrefs,
        ...(payload.recruiterPrefs || {}),
      },
      otherPrefs: {
        ...current.onboarding.otherPrefs,
        ...(payload.otherPrefs || {}),
      },
    };

    const nextRoleTitle =
      primaryRole === 'developer' && nextOnboarding.developerPrefs.targetRole
        ? `${nextOnboarding.developerPrefs.targetRole} Developer`
        : primaryRole === 'recruiter' && nextOnboarding.recruiterPrefs.hiringContext
        ? nextOnboarding.recruiterPrefs.hiringContext
        : current.roleTitle;

    const updatedUser: UserAccountRecord = {
      ...current,
      roleTitle: nextRoleTitle,
      activeRole: primaryRole,
      onboarding: nextOnboarding,
    };

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const computed = recomputeUserAnalysis(updatedUser, userJds);
    store.users[uIdx] = computed;

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'ONBOARDING_PREFERENCES_SAVED',
      status: 'SUCCESS',
      details: `Configured primary workspace role: ${primaryRole}${
        cleanSecondary.length > 0 ? ` (secondary: ${cleanSecondary.join(', ')})` : ''
      }.`,
      createdAt: nowIso,
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(computed, log);

    return computed;
  },

  switchActiveRole(userId: string, nextRole: PrimaryWorkspaceRole): UserAccountRecord {
    const store = loadStore();
    const uIdx = store.users.findIndex((u) => u.id === userId);
    if (uIdx === -1) throw new Error('User not found.');

    if (nextRole !== 'developer' && nextRole !== 'recruiter' && nextRole !== 'other') {
      throw new Error('Invalid workspace role.');
    }

    const current = normalizeStoredUserRecord(store.users[uIdx]);
    const secondaryRoles = new Set(current.onboarding.secondaryRoles);
    if (nextRole !== current.onboarding.primaryRole) {
      secondaryRoles.add(nextRole);
    }

    const updatedUser: UserAccountRecord = {
      ...current,
      activeRole: nextRole,
      onboarding: {
        ...current.onboarding,
        secondaryRoles: Array.from(secondaryRoles),
      },
    };

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const computed = recomputeUserAnalysis(updatedUser, userJds);
    store.users[uIdx] = computed;
    saveStore(store);
    void syncUserToSupabase(computed);

    return computed;
  },

  getUserBySessionToken(token?: string | null): UserAccountRecord | null {
    if (!token || !token.trim()) return null;
    const store = loadStore();
    const cleanToken = token.trim();
    const session = store.sessions.find((s) => s.token === cleanToken);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      store.sessions = store.sessions.filter((s) => s.token !== cleanToken);
      saveStore(store);
      return null;
    }

    const user = store.users.find((u) => u.id === session.userId);
    if (!user) return null;

    const userJds = store.jobDescriptions.filter((j) => j.userId === user.id);
    return recomputeUserAnalysis(user, userJds);
  },

  revokeSessionToken(token?: string | null): void {
    if (!token) return;
    const store = loadStore();
    store.sessions = store.sessions.filter((s) => s.token !== token.trim());
    saveStore(store);
  },

  getUserById(userId: string): UserAccountRecord | null {
    const store = loadStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user) return null;
    const userJds = store.jobDescriptions.filter((j) => j.userId === user.id);
    return recomputeUserAnalysis(user, userJds);
  },

  // ==========================================================================
  // 3. Saved Recruiter Candidate Assessments (Scoped strictly to owning user)
  // ==========================================================================
  getRecruiterAssessmentsForUser(userId: string): SavedRecruiterAssessmentItem[] {
    const store = loadStore();
    return store.recruiterAssessments
      .filter((a) => a.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  saveRecruiterAssessment(
    userId: string,
    payload: Omit<SavedRecruiterAssessmentItem, 'id' | 'userId' | 'createdAt'>
  ): SavedRecruiterAssessmentItem {
    const store = loadStore();
    const nowIso = new Date().toISOString();
    const entry: SavedRecruiterAssessmentItem = {
      ...payload,
      id: `rassess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId,
      createdAt: nowIso,
    };

    store.recruiterAssessments = [entry, ...store.recruiterAssessments].slice(0, 100);
    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'RECRUITER_ASSESSMENT_SAVED',
      status: 'SUCCESS',
      details: `Saved candidate assessment for @${entry.candidateUsername} against "${entry.jobTitle}" (Evidence Strength: ${entry.evidenceStrengthScore}/100, JD Match: ${entry.jdMatchScore}/100).`,
      createdAt: nowIso,
    };
    store.auditLogs.unshift(log);
    saveStore(store);

    const sb = getSupabaseClient();
    if (sb) {
      void sb
        .from('wv_recruiter_assessments')
        .upsert({
          id: entry.id,
          user_id: entry.userId,
          candidate_username: entry.candidateUsername,
          candidate_display_name: entry.candidateDisplayName,
          target_url: entry.targetUrl,
          target_type: entry.targetType,
          job_title: entry.jobTitle,
          role_category: entry.roleCategory,
          evidence_strength_score: entry.evidenceStrengthScore,
          jd_match_score: entry.jdMatchScore,
          guidance_classification: entry.guidanceClassification,
          candidate_overview_json: entry.candidateOverview,
          match_report_json: entry.jobMatchReport,
          created_at: entry.createdAt,
        })
        .then(() => undefined, () => undefined);
    }

    return entry;
  },

  deleteRecruiterAssessment(
    userId: string,
    assessmentId: string
  ): SavedRecruiterAssessmentItem[] {
    const store = loadStore();
    const target = store.recruiterAssessments.find(
      (a) => a.id === assessmentId && a.userId === userId
    );
    if (!target) {
      throw new Error('Recruiter assessment not found or access denied.');
    }

    store.recruiterAssessments = store.recruiterAssessments.filter(
      (a) => !(a.id === assessmentId && a.userId === userId)
    );
    saveStore(store);

    const sb = getSupabaseClient();
    if (sb) {
      void sb
        .from('wv_recruiter_assessments')
        .delete()
        .eq('id', assessmentId)
        .eq('user_id', userId)
        .then(() => undefined, () => undefined);
    }

    return this.getRecruiterAssessmentsForUser(userId);
  },

  // ==========================================================================
  // 4. Job Descriptions (Scoped strictly to the owning user)
  // ==========================================================================
  getJobDescriptionsForUser(userId: string): StoredJobDescription[] {
    const store = loadStore();
    return store.jobDescriptions.filter((j) => j.userId === userId);
  },

  saveJobDescription(
    userId: string,
    rawText: string,
    explicitTitle?: string
  ): { jobDescription: StoredJobDescription; user: UserAccountRecord } {
    const store = loadStore();
    const uIdx = store.users.findIndex((u) => u.id === userId);
    if (uIdx === -1) throw new Error('Authenticated user not found');

    const parsedJd = parseJobDescription(rawText, explicitTitle);
    const storedJd: StoredJobDescription = {
      ...parsedJd,
      userId,
    };
    store.jobDescriptions.unshift(storedJd);

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const updatedUser = recomputeUserAnalysis(store.users[uIdx], userJds);
    store.users[uIdx] = updatedUser;

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'JOB_DESCRIPTION_SAVED',
      status: 'SUCCESS',
      details: `Saved job description "${storedJd.title}" (${storedJd.requiredSkills.length} required, ${storedJd.preferredSkills.length} preferred skills).`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(updatedUser, log);

    return { jobDescription: storedJd, user: updatedUser };
  },

  updateJobDescription(
    userId: string,
    jdId: string,
    payload: {
      title?: string;
      requiredSkills?: string[];
      preferredSkills?: string[];
      rawText?: string;
    }
  ): { jobDescription: StoredJobDescription; user: UserAccountRecord } {
    const store = loadStore();
    const jdIdx = store.jobDescriptions.findIndex(
      (j) => j.id === jdId && j.userId === userId
    );
    if (jdIdx === -1) throw new Error('Job description not found or access denied.');

    const currentJd = store.jobDescriptions[jdIdx];
    let updatedJd: StoredJobDescription;

    if (payload.rawText !== undefined && payload.rawText.trim() !== currentJd.rawText.trim()) {
      const reparsed = parseJobDescription(
        payload.rawText,
        payload.title || currentJd.title,
        currentJd.id
      );
      updatedJd = {
        ...reparsed,
        userId,
        requiredSkills:
          payload.requiredSkills !== undefined
            ? Array.from(new Set(payload.requiredSkills.map((s) => s.trim()).filter(Boolean)))
            : reparsed.requiredSkills,
        preferredSkills:
          payload.preferredSkills !== undefined
            ? Array.from(new Set(payload.preferredSkills.map((s) => s.trim()).filter(Boolean)))
            : reparsed.preferredSkills,
      };
    } else {
      const nextRequired =
        payload.requiredSkills !== undefined
          ? Array.from(new Set(payload.requiredSkills.map((s) => s.trim()).filter(Boolean)))
          : currentJd.requiredSkills;
      const nextPreferred =
        payload.preferredSkills !== undefined
          ? Array.from(
              new Set(
                payload.preferredSkills
                  .map((s) => s.trim())
                  .filter((s) => Boolean(s) && !nextRequired.includes(s))
              )
            )
          : currentJd.preferredSkills.filter((s) => !nextRequired.includes(s));
      const nextTitle = payload.title !== undefined ? payload.title.trim() : currentJd.title;

      updatedJd = {
        ...currentJd,
        title: nextTitle || currentJd.title,
        roleCategory: inferRoleCategoryFromSkillsAndTitle(
          nextTitle || currentJd.title,
          nextRequired
        ),
        requiredSkills: nextRequired,
        preferredSkills: nextPreferred,
      };
    }

    store.jobDescriptions[jdIdx] = updatedJd;

    const uIdx = store.users.findIndex((u) => u.id === userId);
    if (uIdx === -1) throw new Error('User not found');

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const updatedUser = recomputeUserAnalysis(store.users[uIdx], userJds);
    store.users[uIdx] = updatedUser;

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'JOB_REQUIREMENTS_UPDATED',
      status: 'SUCCESS',
      details: `Updated requirements for "${updatedJd.title}" and recalculated match scores.`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(updatedUser, log);

    return { jobDescription: updatedJd, user: updatedUser };
  },

  deleteJobDescription(userId: string, jdId: string): UserAccountRecord {
    const store = loadStore();
    const target = store.jobDescriptions.find(
      (j) => j.id === jdId && j.userId === userId
    );
    if (!target) throw new Error('Job description not found or access denied.');

    store.jobDescriptions = store.jobDescriptions.filter(
      (j) => !(j.id === jdId && j.userId === userId)
    );

    const uIdx = store.users.findIndex((u) => u.id === userId);
    if (uIdx === -1) throw new Error('User not found');

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const updatedUser = recomputeUserAnalysis(store.users[uIdx], userJds);
    store.users[uIdx] = updatedUser;

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'JOB_DESCRIPTION_REMOVED',
      status: 'WARNING',
      details: `Removed job description "${target.title}".`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(updatedUser, log);
    return updatedUser;
  },

  // ==========================================================================
  // 5. Public Analysis History (Scoped by userId or anonymous sessionId)
  // ==========================================================================
  recordPublicAnalysis(
    record: Omit<PublicAnalysisRecord, 'id' | 'createdAt'>
  ): PublicAnalysisRecord {
    const store = loadStore();
    const entry: PublicAnalysisRecord = {
      ...record,
      id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    store.publicAnalyses = [
      entry,
      ...store.publicAnalyses.filter(
        (p) =>
          !(
            p.targetUrl === entry.targetUrl &&
            p.userId === entry.userId &&
            p.sessionId === entry.sessionId
          )
      ),
    ].slice(0, 50);
    saveStore(store);
    return entry;
  },

  getPublicAnalysesForContext(
    userId: string | null,
    sessionId: string | null
  ): PublicAnalysisRecord[] {
    const store = loadStore();
    if (userId) {
      return store.publicAnalyses.filter((p) => p.userId === userId).slice(0, 10);
    }
    if (sessionId) {
      return store.publicAnalyses.filter((p) => p.sessionId === sessionId).slice(0, 10);
    }
    return [];
  },

  // ==========================================================================
  // 6. Public Profile Lookup (Strict Privacy Enforcement)
  // ==========================================================================
  getPublicProfileBySlug(
    slug: string
  ): {
    status: 'FOUND_PUBLIC' | 'PRIVATE_PROFILE' | 'NOT_FOUND';
    profile: ReturnType<typeof sanitizeUserForClient> | null;
  } {
    const store = loadStore();
    const cleanSlug = (slug || '').trim().toLowerCase();
    const user = store.users.find((u) => u.profileSlug.toLowerCase() === cleanSlug);
    if (!user) {
      return { status: 'NOT_FOUND', profile: null };
    }
    if (!user.isPublicProfile) {
      return { status: 'PRIVATE_PROFILE', profile: null };
    }
    const userJds = store.jobDescriptions.filter((j) => j.userId === user.id);
    const computed = recomputeUserAnalysis(user, userJds);
    return {
      status: 'FOUND_PUBLIC',
      profile: sanitizeUserForClient(computed),
    };
  },

  // ==========================================================================
  // 7. Workspace Mutations & GitHub Connection (Strict User Ownership)
  // ==========================================================================
  updateClaimedSkills(userId: string, claimedSkills: string[]): UserAccountRecord {
    const store = loadStore();
    const idx = store.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found');

    const cleanedSkills = Array.from(
      new Set(claimedSkills.map((s) => s.trim()).filter(Boolean))
    );

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const updatedUser = recomputeUserAnalysis(
      {
        ...store.users[idx],
        claimedSkills: cleanedSkills,
        lastAnalyzedAt: store.users[idx].lastAnalyzedAt || new Date().toISOString(),
      },
      userJds
    );

    store.users[idx] = updatedUser;
    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'UPDATE_SKILL_CLAIMS',
      status: 'SUCCESS',
      details: `Updated claimed skills (${cleanedSkills.length} active claims) and recalculated evidence scores.`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(updatedUser, log);
    return updatedUser;
  },

  updateProfileMetadata(
    userId: string,
    payload: {
      fullName?: string;
      roleTitle?: string;
      bio?: string;
      isPublicProfile?: boolean;
      profileSlug?: string;
    }
  ): UserAccountRecord {
    const store = loadStore();
    const idx = store.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found');

    const current = normalizeStoredUserRecord(store.users[idx]);
    const nextIsPublic =
      typeof payload.isPublicProfile === 'boolean'
        ? payload.isPublicProfile
        : current.isPublicProfile;

    let nextSlug = current.profileSlug;
    if (payload.profileSlug !== undefined && payload.profileSlug.trim()) {
      const requestedSlug = payload.profileSlug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-');
      const conflict = store.users.some(
        (u) => u.id !== userId && u.profileSlug.toLowerCase() === requestedSlug
      );
      if (conflict) {
        throw new Error(`Profile slug "${requestedSlug}" is already taken.`);
      }
      nextSlug = requestedSlug;
    }

    const updatedUser: UserAccountRecord = {
      ...current,
      fullName: payload.fullName !== undefined ? payload.fullName.trim() : current.fullName,
      roleTitle: payload.roleTitle !== undefined ? payload.roleTitle.trim() : current.roleTitle,
      bio: payload.bio !== undefined ? payload.bio.trim() : current.bio,
      profileSlug: nextSlug,
      isPublicProfile: nextIsPublic,
      publishedAt: nextIsPublic ? current.publishedAt || new Date().toISOString() : null,
    };

    store.users[idx] = updatedUser;
    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: nextIsPublic ? 'PUBLISH_SHARED_PROFILE' : 'UNPUBLISH_SHARED_PROFILE',
      status: 'SUCCESS',
      details: nextIsPublic
        ? `Published shareable recruiter profile at /profile/${updatedUser.profileSlug}`
        : 'Set profile visibility to Private (external access disabled).',
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(updatedUser, log);
    return updatedUser;
  },

  saveCollectedGitHubData(
    userId: string,
    payload: {
      githubUsername: string;
      githubAvatarUrl: string;
      githubProfileUrl: string;
      displayName?: string;
      bio?: string;
      oauthToken?: string;
      repositories: RawRepositoryInput[];
      rateLimitRemaining?: number;
      collectionNote?: string;
    }
  ): UserAccountRecord {
    const store = loadStore();
    const idx = store.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found');

    const current = normalizeStoredUserRecord(store.users[idx]);
    const nowIso = new Date().toISOString();

    const desiredSlug = payload.githubUsername
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-');
    const slugConflict = store.users.some(
      (u) => u.id !== userId && u.profileSlug.toLowerCase() === desiredSlug
    );

    const nextProviders: LinkedIdentityItem[] = [
      ...current.linkedProviders.filter((p) => p.provider !== 'github'),
      {
        provider: 'github',
        providerId: payload.githubUsername.toLowerCase(),
        email: current.email,
        displayName: `@${payload.githubUsername}`,
        verified: Boolean(payload.oauthToken),
        linkedAt: current.githubConnectedAt || nowIso,
      },
    ];

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const updatedUser = recomputeUserAnalysis(
      {
        ...current,
        fullName: current.fullName || payload.displayName || payload.githubUsername,
        bio: current.bio || payload.bio || '',
        githubUsername: payload.githubUsername,
        githubConnected: true,
        githubAvatarUrl: payload.githubAvatarUrl,
        githubProfileUrl: payload.githubProfileUrl,
        githubConnectedAt: current.githubConnectedAt || nowIso,
        oauthAccessTokenServerOnly:
          payload.oauthToken || current.oauthAccessTokenServerOnly,
        linkedProviders: nextProviders,
        profileSlug: slugConflict ? current.profileSlug : desiredSlug || current.profileSlug,
        lastAnalyzedAt: nowIso,
        rawRepositories: payload.repositories,
      },
      userJds
    );

    store.users[idx] = updatedUser;
    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'GITHUB_SYNC_COMPLETED',
      status: 'SUCCESS',
      details:
        payload.collectionNote ||
        `Synced ${payload.repositories.length} live public repositories for @${payload.githubUsername}.`,
      rateLimitRemaining: payload.rateLimitRemaining,
      createdAt: nowIso,
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(updatedUser, log);
    return updatedUser;
  },

  disconnectGitHub(userId: string): UserAccountRecord {
    const store = loadStore();
    const idx = store.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found');

    const current = normalizeStoredUserRecord(store.users[idx]);
    const updatedUser: UserAccountRecord = {
      ...current,
      githubConnected: false,
      githubUsername: '',
      githubAvatarUrl: '',
      githubProfileUrl: '',
      githubConnectedAt: null,
      oauthAccessTokenServerOnly: undefined,
      linkedProviders: current.linkedProviders.filter((p) => p.provider !== 'github'),
      isPublicProfile: false,
      publishedAt: null,
      rawRepositories: [],
      normalizedRepositories: [],
      skillAssessments: [],
      roleRecommendations: [],
      lastAnalyzedAt: null,
    };

    const userJds = store.jobDescriptions.filter((j) => j.userId === userId);
    const computed = recomputeUserAnalysis(updatedUser, userJds);
    store.users[idx] = computed;

    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'GITHUB_DISCONNECTED',
      status: 'WARNING',
      details:
        'Disconnected GitHub account, revoked stored OAuth tokens, cleared repository cache, and unpublished shared profile links.',
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(computed, log);
    return computed;
  },

  deleteAccountData(userId: string): UserAccountRecord {
    const store = loadStore();
    const idx = store.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found');

    const current = normalizeStoredUserRecord(store.users[idx]);
    const purgedUser: UserAccountRecord = {
      ...current,
      githubUsername: '',
      githubConnected: false,
      githubAvatarUrl: '',
      githubProfileUrl: '',
      githubConnectedAt: null,
      oauthAccessTokenServerOnly: undefined,
      linkedProviders: current.linkedProviders.filter((p) => p.provider !== 'github'),
      isPublicProfile: false,
      publishedAt: null,
      lastAnalyzedAt: null,
      claimedSkills: [],
      rawRepositories: [],
      normalizedRepositories: [],
      skillAssessments: [],
      roleRecommendations: [],
      jobMatchReports: [],
    };

    // Cascade delete dependent records for this user
    store.jobDescriptions = store.jobDescriptions.filter((j) => j.userId !== userId);
    store.publicAnalyses = store.publicAnalyses.filter((p) => p.userId !== userId);
    store.recruiterAssessments = store.recruiterAssessments.filter((a) => a.userId !== userId);

    store.users[idx] = purgedUser;
    const log: AuditLogEntry = {
      id: `log_${Date.now()}`,
      userId,
      action: 'ACCOUNT_DATA_DELETED',
      status: 'WARNING',
      details:
        'Purged all stored repositories, commit attributions, skill claims, saved job descriptions, recruiter assessments, OAuth tokens, and published profile snapshots.',
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(log);
    saveStore(store);
    void syncUserToSupabase(purgedUser, log);
    void deleteUserFromSupabase(userId);
    return purgedUser;
  },

  getAuditLogs(userId: string): AuditLogEntry[] {
    const store = loadStore();
    return store.auditLogs.filter((l) => l.userId === userId).slice(0, 25);
  },

  appendAuditLog(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): AuditLogEntry {
    const store = loadStore();
    const full: AuditLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    store.auditLogs.unshift(full);
    saveStore(store);
    return full;
  },
};
