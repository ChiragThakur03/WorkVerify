import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';
import {
  dbRepository,
  sanitizeUserForClient,
  getSupabaseStatus,
  ensureSupabaseHydrated,
  syncStateToSupabase,
  syncUserToSupabase,
  UserAccountRecord,
} from './src/server/supabaseRepo.ts';
import {
  collectGitHubUserEvidence,
  collectSingleGitHubRepository,
} from './src/server/githubCollector.ts';
import {
  SUPPORTED_TECHNOLOGIES,
  normalizeAndAnalyzeRepository,
  evaluateSkillEvidence,
  SkillAssessmentResult,
} from './src/lib/verificationEngine.ts';
import {
  parseGitHubTargetUrl,
  buildSingleRepositoryReport,
  parseJobDescription,
  evaluateJobDescriptionMatch,
  recommendSuitableRoles,
  inferRoleCategoryFromSkillsAndTitle,
} from './src/lib/jobMatchEngine.ts';

dotenv.config();

const PORT = 3000;

// Bounded per-IP rate limiter for public analysis endpoints
const ipRequestCounters = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 35;

function checkInboundRateLimit(req: express.Request, res: express.Response): boolean {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  const entry = ipRequestCounters.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRequestCounters.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      error: 'Too many analysis requests from this client. Please wait 60 seconds and try again.',
    });
    return false;
  }
  return true;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = decodeURIComponent(pair.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function extractSessionToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers['x-wv-session'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.wv_session) {
    return cookies.wv_session;
  }
  return null;
}

function extractAnonSessionId(req: express.Request): string | null {
  const headerId = req.headers['x-wv-anon-id'];
  if (typeof headerId === 'string' && headerId.trim()) {
    return headerId.trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.wv_anon_id || null;
}

function setSessionCookie(res: express.Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const cookieValue = `wv_session=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; ${isProd ? 'Secure; ' : ''}Max-Age=${7 * 24 * 3600}`;
  res.setHeader('Set-Cookie', cookieValue);
}

function clearSessionCookie(res: express.Response): void {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  res.setHeader(
    'Set-Cookie',
    `wv_session=; Path=/; HttpOnly; SameSite=Lax; ${isProd ? 'Secure; ' : ''}Max-Age=0`
  );
}

function resolveAuthenticatedUser(req: express.Request): UserAccountRecord | null {
  const token = extractSessionToken(req);
  return dbRepository.getUserBySessionToken(token);
}

function resolveRedirectUri(req: express.Request): string {
  const clientOrigin = (req.query.origin as string | undefined)?.trim();
  if (clientOrigin && clientOrigin.startsWith('http')) {
    return `${clientOrigin.replace(/\/$/, '')}/auth/callback`;
  }
  const envAppUrl = (process.env.APP_URL || '').trim();
  if (envAppUrl && envAppUrl.startsWith('http') && !envAppUrl.includes('MY_APP_URL')) {
    return `${envAppUrl.replace(/\/$/, '')}/auth/callback`;
  }
  const vercelProdUrl = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (vercelProdUrl) {
    return `https://${vercelProdUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/auth/callback`;
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}/auth/callback`;
}

function computeCandidateEvidenceStrengthScore(skills: SkillAssessmentResult[]): number {
  if (!skills || skills.length === 0) return 0;
  const topSkills = skills.slice(0, 5);
  const sum = topSkills.reduce((acc, s) => acc + s.evidenceScore, 0);
  return Math.round(sum / topSkills.length);
}

export const app = express();
app.use(express.json({ limit: '2mb' }));

// Hydrate persistent state from Supabase PostgreSQL on serverless cold starts
app.use(async (_req, _res, next) => {
  await ensureSupabaseHydrated();
  next();
});

function registerApiRoutes(app: express.Express) {
  // ==========================================================================
  // 1. Session & Workspace Bootstrap (Never preloads a fake user!)
  // ==========================================================================
  app.get('/api/me', (req, res) => {
    try {
      const user = resolveAuthenticatedUser(req);
      const anonSessionId = extractAnonSessionId(req);
      const supabaseStatus = getSupabaseStatus();
      const supportedCatalog = SUPPORTED_TECHNOLOGIES.map((t) => ({
        name: t.canonicalName,
        category: t.category,
        aliases: t.aliases,
      }));

      if (!user) {
        return res.json({
          authenticated: false,
          user: null,
          jobDescriptions: [],
          recruiterAssessments: [],
          publicAnalyses: dbRepository.getPublicAnalysesForContext(null, anonSessionId),
          auditLogs: [],
          supabaseStatus,
          supportedCatalog,
        });
      }

      res.json({
        authenticated: true,
        user: sanitizeUserForClient(user),
        jobDescriptions: dbRepository.getJobDescriptionsForUser(user.id),
        recruiterAssessments: dbRepository.getRecruiterAssessmentsForUser(user.id),
        publicAnalyses: dbRepository.getPublicAnalysesForContext(user.id, anonSessionId),
        auditLogs: dbRepository.getAuditLogs(user.id),
        supabaseStatus,
        supportedCatalog,
      });
    } catch (error: any) {
      console.error('Error in GET /api/me:', error);
      res.status(500).json({ error: error.message || 'Failed to load session state' });
    }
  });

  // ==========================================================================
  // 2. Authentication, Email Verification & Password Recovery Endpoints
  // ==========================================================================
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, fullName, roleTitle } = req.body || {};
      const { user, token, verificationCode, verificationToken } =
        dbRepository.registerUser({
          email,
          password,
          fullName,
          roleTitle,
        });
      setSessionCookie(res, token);
      await syncUserToSupabase(user);
      res.status(201).json({
        authenticated: true,
        token,
        user: sanitizeUserForClient(user),
        verificationCode,
        verificationToken,
        jobDescriptions: dbRepository.getJobDescriptionsForUser(user.id),
        recruiterAssessments: dbRepository.getRecruiterAssessmentsForUser(user.id),
        auditLogs: dbRepository.getAuditLogs(user.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const { user, token } = dbRepository.loginUser({ email, password });
      setSessionCookie(res, token);
      await syncUserToSupabase(user);
      res.json({
        authenticated: true,
        token,
        user: sanitizeUserForClient(user),
        jobDescriptions: dbRepository.getJobDescriptionsForUser(user.id),
        recruiterAssessments: dbRepository.getRecruiterAssessmentsForUser(user.id),
        auditLogs: dbRepository.getAuditLogs(user.id),
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Invalid email or password.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractSessionToken(req);
    dbRepository.revokeSessionToken(token);
    clearSessionCookie(res);
    res.json({ authenticated: false, user: null });
  });

  app.post('/api/auth/verify-email', (req, res) => {
    try {
      const currentUser = resolveAuthenticatedUser(req);
      const { tokenOrCode } = req.body || {};
      const updated = dbRepository.verifyUserEmail({
        userId: currentUser?.id || null,
        tokenOrCode: tokenOrCode || '',
      });
      res.json({
        user: sanitizeUserForClient(updated),
        auditLogs: dbRepository.getAuditLogs(updated.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Email verification failed.' });
    }
  });

  app.post('/api/auth/resend-verification', (req, res) => {
    try {
      const currentUser = resolveAuthenticatedUser(req);
      const { email } = req.body || {};
      if (!currentUser && !email) {
        return res.status(400).json({ error: 'Please sign in or provide your email address.' });
      }
      const { user, verificationCode, verificationToken } =
        dbRepository.resendEmailVerification({
          userId: currentUser?.id || null,
          email: email || currentUser?.email || null,
        });
      res.json({
        user: sanitizeUserForClient(user),
        verificationCode,
        verificationToken,
        auditLogs: dbRepository.getAuditLogs(user.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to resend verification email.' });
    }
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    try {
      const { email } = req.body || {};
      const result = dbRepository.requestPasswordReset(email || '');
      res.json({
        sent: true,
        email: result.email,
        resetCode: result.resetCode || null,
        resetToken: result.resetToken || null,
        message:
          'If an account exists for this email, a 6-digit password reset code and time-limited reset token have been issued.',
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Could not process password reset request.' });
    }
  });

  app.post('/api/auth/reset-password', (req, res) => {
    try {
      const { email, tokenOrCode, newPassword } = req.body || {};
      const { user, token } = dbRepository.resetPasswordWithToken({
        email,
        tokenOrCode,
        newPassword,
      });
      setSessionCookie(res, token);
      res.json({
        authenticated: true,
        token,
        user: sanitizeUserForClient(user),
        jobDescriptions: dbRepository.getJobDescriptionsForUser(user.id),
        recruiterAssessments: dbRepository.getRecruiterAssessmentsForUser(user.id),
        auditLogs: dbRepository.getAuditLogs(user.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Password reset failed.' });
    }
  });

  // ==========================================================================
  // 3. Public GitHub Analyzer — No GitHub Login Required
  // ==========================================================================
  app.post('/api/public/analyze', async (req, res) => {
    if (!checkInboundRateLimit(req, res)) return;

    try {
      const rawUrl = (req.body?.targetUrl as string) || '';
      const forceRefresh = Boolean(req.body?.forceRefresh);
      const parsed = parseGitHubTargetUrl(rawUrl);

      if (!parsed.valid || !parsed.type || !parsed.owner) {
        return res.status(400).json({
          error: parsed.error || 'Invalid GitHub URL.',
        });
      }

      const currentUser = resolveAuthenticatedUser(req);
      const anonSessionId = extractAnonSessionId(req);
      const token = currentUser?.oauthAccessTokenServerOnly;
      const nowIso = new Date().toISOString();

      if (parsed.type === 'repository' && parsed.repo) {
        const collected = await collectSingleGitHubRepository(
          parsed.owner,
          parsed.repo,
          token,
          forceRefresh
        );
        const normalizedRepo = normalizeAndAnalyzeRepository(
          collected.repository,
          collected.owner,
          collected.owner
        );
        const singleRepoReport = buildSingleRepositoryReport(
          normalizedRepo,
          collected.owner,
          nowIso
        );

        dbRepository.recordPublicAnalysis({
          userId: currentUser?.id || null,
          sessionId: anonSessionId,
          targetType: 'repository',
          targetUrl: parsed.canonicalUrl!,
          ownerLogin: collected.owner,
          repoName: collected.repoName,
          summaryTitle: `${collected.owner}/${collected.repoName}`,
          repositoriesCount: 1,
          topSkills: singleRepoReport.skillAssessments.slice(0, 4).map((s) => ({
            skillName: s.skillName,
            evidenceBand: s.evidenceBand,
            evidenceScore: s.evidenceScore,
          })),
        });

        if (currentUser) {
          dbRepository.appendAuditLog({
            userId: currentUser.id,
            action: 'PUBLIC_REPO_ANALYZED',
            status: 'SUCCESS',
            details: `Analyzed live public repository ${collected.owner}/${collected.repoName} (${singleRepoReport.ownershipVsAttribution.ownerAttributedCommits}/${singleRepoReport.ownershipVsAttribution.totalCommitsSampled} owner-attributed commits).`,
            rateLimitRemaining: collected.rateLimit.remaining,
          });
        }

        return res.json({
          targetType: 'repository',
          targetUrl: parsed.canonicalUrl,
          rawRepositories: [collected.repository],
          singleRepoReport,
          rateLimit: collected.rateLimit,
          warnings: collected.warnings,
          publicAnalyses: dbRepository.getPublicAnalysesForContext(
            currentUser?.id || null,
            anonSessionId
          ),
        });
      }

      // Profile URL analysis via live GitHub REST API
      const collected = await collectGitHubUserEvidence(parsed.owner, token, forceRefresh);
      const normalizedRepositories = collected.repositories.map((r) =>
        normalizeAndAnalyzeRepository(r, collected.username, collected.displayName)
      );

      const seenSkills = new Set<string>();
      const skillAssessments: SkillAssessmentResult[] = [];
      for (const repo of normalizedRepositories) {
        if (repo.isFork) continue;
        for (const sig of repo.detectedTechnologies) {
          const key = sig.skillName.toLowerCase();
          if (!seenSkills.has(key)) {
            seenSkills.add(key);
            skillAssessments.push(
              evaluateSkillEvidence(sig.skillName, true, normalizedRepositories, nowIso)
            );
          }
        }
      }
      skillAssessments.sort((a, b) => b.evidenceScore - a.evidenceScore);

      const roleRecommendations = recommendSuitableRoles(normalizedRepositories, nowIso);

      dbRepository.recordPublicAnalysis({
        userId: currentUser?.id || null,
        sessionId: anonSessionId,
        targetType: 'profile',
        targetUrl: parsed.canonicalUrl!,
        ownerLogin: collected.username,
        repoName: null,
        summaryTitle: `@${collected.username} (${collected.displayName})`,
        repositoriesCount: normalizedRepositories.length,
        topSkills: skillAssessments.slice(0, 5).map((s) => ({
          skillName: s.skillName,
          evidenceBand: s.evidenceBand,
          evidenceScore: s.evidenceScore,
        })),
      });

      if (currentUser) {
        dbRepository.appendAuditLog({
          userId: currentUser.id,
          action: 'PUBLIC_PROFILE_ANALYZED',
          status: 'SUCCESS',
          details: `Analyzed live public GitHub profile @${collected.username} (${normalizedRepositories.length} repositories, ${skillAssessments.length} detected technologies).`,
          rateLimitRemaining: collected.rateLimit.remaining,
        });
      }

      return res.json({
        targetType: 'profile',
        targetUrl: parsed.canonicalUrl,
        rawRepositories: collected.repositories,
        profileReport: {
          username: collected.username,
          displayName: collected.displayName,
          avatarUrl: collected.avatarUrl,
          bio: collected.bio,
          profileUrl: collected.profileUrl,
          normalizedRepositories,
          skillAssessments,
          roleRecommendations,
          analyzedAt: nowIso,
        },
        rateLimit: collected.rateLimit,
        warnings: collected.warnings,
        publicAnalyses: dbRepository.getPublicAnalysesForContext(
          currentUser?.id || null,
          anonSessionId
        ),
      });
    } catch (error: any) {
      res.status(422).json({
        error: error.message || 'Failed to analyze public GitHub target.',
      });
    }
  });

  // ==========================================================================
  // 4. Applicant Public URL + Multi-JD Evaluation Endpoint
  // ==========================================================================
  app.post('/api/applicant/evaluate', async (req, res) => {
    if (!checkInboundRateLimit(req, res)) return;

    try {
      const currentUser = resolveAuthenticatedUser(req);
      const rawUrl = ((req.body?.targetUrl as string) || '').trim();
      const jobDescriptionsInput = req.body?.jobDescriptions as
        | { id?: string; title?: string; rawText: string; requiredSkills?: string[]; preferredSkills?: string[] }[]
        | undefined;

      let normalizedRepositories = currentUser?.normalizedRepositories || [];
      let candidateUsername = currentUser?.githubUsername || currentUser?.fullName || 'applicant';
      let rateLimit = undefined;
      let warnings: string[] = [];

      if (rawUrl) {
        const parsed = parseGitHubTargetUrl(rawUrl);
        if (!parsed.valid || !parsed.type || !parsed.owner) {
          return res.status(400).json({
            error: parsed.error || 'Please provide a valid GitHub profile or repository URL.',
          });
        }

        const token = currentUser?.oauthAccessTokenServerOnly;
        if (parsed.type === 'repository' && parsed.repo) {
          const collected = await collectSingleGitHubRepository(parsed.owner, parsed.repo, token);
          normalizedRepositories = [
            normalizeAndAnalyzeRepository(collected.repository, collected.owner, collected.owner),
          ];
          candidateUsername = collected.owner;
          rateLimit = collected.rateLimit;
          warnings = collected.warnings;
        } else {
          const collected = await collectGitHubUserEvidence(parsed.owner, token);
          normalizedRepositories = collected.repositories.map((r) =>
            normalizeAndAnalyzeRepository(r, collected.username, collected.displayName)
          );
          candidateUsername = collected.username;
          rateLimit = collected.rateLimit;
          warnings = collected.warnings;
        }
      } else if (normalizedRepositories.length === 0) {
        return res.status(400).json({
          error:
            'Please provide a public GitHub profile or repository URL (or connect your GitHub account in your workspace) to evaluate against job descriptions.',
        });
      }

      const nowIso = new Date().toISOString();
      const parsedJds = (jobDescriptionsInput || [])
        .filter((j) => j && typeof j.rawText === 'string' && j.rawText.trim())
        .map((j, idx) => {
          const base = parseJobDescription(j.rawText, j.title, j.id || `jd_eval_${idx}`);
          return {
            ...base,
            requiredSkills: Array.isArray(j.requiredSkills)
              ? j.requiredSkills
              : base.requiredSkills,
            preferredSkills: Array.isArray(j.preferredSkills)
              ? j.preferredSkills
              : base.preferredSkills,
          };
        });

      const jobMatchReports = parsedJds
        .map((jd) =>
          evaluateJobDescriptionMatch(jd, normalizedRepositories, candidateUsername, undefined, nowIso)
        )
        .sort((a, b) => b.matchScore - a.matchScore);

      const roleRecommendations = recommendSuitableRoles(normalizedRepositories, nowIso);

      const seenSkills = new Set<string>();
      const skillAssessments: SkillAssessmentResult[] = [];
      for (const repo of normalizedRepositories) {
        if (repo.isFork) continue;
        for (const sig of repo.detectedTechnologies) {
          const key = sig.skillName.toLowerCase();
          if (!seenSkills.has(key)) {
            seenSkills.add(key);
            skillAssessments.push(
              evaluateSkillEvidence(sig.skillName, true, normalizedRepositories, nowIso)
            );
          }
        }
      }
      skillAssessments.sort((a, b) => b.evidenceScore - a.evidenceScore);

      res.json({
        candidateUsername,
        repositoriesAnalyzed: normalizedRepositories.length,
        normalizedRepositories,
        skillAssessments,
        roleRecommendations,
        jobMatchReports,
        rateLimit,
        warnings,
      });
    } catch (error: any) {
      res.status(422).json({
        error: error.message || 'Failed to evaluate applicant readiness.',
      });
    }
  });

  // ==========================================================================
  // 5. Recruiter Mode — Candidate Assessment Against Job Description
  // ==========================================================================
  app.post('/api/recruiter/assess', async (req, res) => {
    if (!checkInboundRateLimit(req, res)) return;

    try {
      const rawUrl = (req.body?.targetUrl as string) || '';
      const jobDescriptionText = (req.body?.jobDescriptionText as string) || '';
      const jobTitle = (req.body?.jobTitle as string) || '';
      const overrideRequired = req.body?.requiredSkills as string[] | undefined;
      const overridePreferred = req.body?.preferredSkills as string[] | undefined;
      const saveAssessment = Boolean(req.body?.saveAssessment);

      const parsed = parseGitHubTargetUrl(rawUrl);
      if (!parsed.valid || !parsed.type || !parsed.owner) {
        return res.status(400).json({
          error: parsed.error || 'Please provide a valid candidate GitHub profile or repository URL.',
        });
      }

      if (
        !jobDescriptionText.trim() &&
        (!Array.isArray(overrideRequired) || overrideRequired.length === 0)
      ) {
        return res.status(400).json({
          error: 'Please paste a job description or specify at least one required technical skill.',
        });
      }

      let jd = parseJobDescription(jobDescriptionText, jobTitle);
      if (Array.isArray(overrideRequired)) {
        const cleanReq = Array.from(new Set(overrideRequired.map((s) => s.trim()).filter(Boolean)));
        jd = {
          ...jd,
          requiredSkills: cleanReq,
          roleCategory: inferRoleCategoryFromSkillsAndTitle(jd.title, cleanReq),
        };
      }
      if (Array.isArray(overridePreferred)) {
        const cleanPref = Array.from(
          new Set(
            overridePreferred
              .map((s) => s.trim())
              .filter((s) => Boolean(s) && !jd.requiredSkills.includes(s))
          )
        );
        jd = {
          ...jd,
          preferredSkills: cleanPref,
        };
      }

      const currentUser = resolveAuthenticatedUser(req);
      const token = currentUser?.oauthAccessTokenServerOnly;
      const nowIso = new Date().toISOString();

      if (parsed.type === 'repository' && parsed.repo) {
        const collected = await collectSingleGitHubRepository(parsed.owner, parsed.repo, token);
        const normalizedRepo = normalizeAndAnalyzeRepository(
          collected.repository,
          collected.owner,
          collected.owner
        );
        const singleRepoReport = buildSingleRepositoryReport(
          normalizedRepo,
          collected.owner,
          nowIso
        );
        const jobMatchReport = evaluateJobDescriptionMatch(
          jd,
          [normalizedRepo],
          collected.owner,
          undefined,
          nowIso
        );
        const roleRecommendations = recommendSuitableRoles([normalizedRepo], nowIso);
        const evidenceStrengthScore = computeCandidateEvidenceStrengthScore(
          singleRepoReport.skillAssessments
        );

        const candidateOverview = {
          username: collected.owner,
          displayName: collected.owner,
          avatarUrl: '',
          bio: normalizedRepo.description,
          profileUrl: `https://github.com/${collected.owner}`,
          repositoriesAnalyzed: 1,
          originalReposCount: normalizedRepo.isFork ? 0 : 1,
          forkedReposCount: normalizedRepo.isFork ? 1 : 0,
          totalAttributedCommits: singleRepoReport.ownershipVsAttribution.ownerAttributedCommits,
          skillAssessments: singleRepoReport.skillAssessments,
          normalizedRepositories: [normalizedRepo],
        };

        let savedRecord = null;
        if (currentUser && saveAssessment) {
          savedRecord = dbRepository.saveRecruiterAssessment(currentUser.id, {
            candidateUsername: collected.owner,
            candidateDisplayName: `${collected.owner}/${collected.repoName}`,
            targetUrl: parsed.canonicalUrl!,
            targetType: 'repository',
            jobTitle: jd.title,
            roleCategory: jd.roleCategory,
            evidenceStrengthScore,
            jdMatchScore: jobMatchReport.matchScore,
            guidanceClassification: jobMatchReport.guidanceClassification,
            candidateOverview,
            jobMatchReport,
          });
        }

        if (currentUser) {
          dbRepository.appendAuditLog({
            userId: currentUser.id,
            action: 'RECRUITER_CANDIDATE_ASSESSMENT',
            status: 'SUCCESS',
            details: `Recruiter assessment completed for repository ${collected.owner}/${collected.repoName} against "${jd.title}" (Evidence Strength: ${evidenceStrengthScore}/100, JD Match: ${jobMatchReport.matchScore}/100).`,
            rateLimitRemaining: collected.rateLimit.remaining,
          });
        }

        return res.json({
          targetType: 'repository',
          targetUrl: parsed.canonicalUrl,
          evidenceStrengthScore,
          jdMatchScore: jobMatchReport.matchScore,
          candidateOverview,
          singleRepoReport,
          jobMatchReport,
          roleRecommendations,
          savedAssessment: savedRecord,
          recruiterAssessments: currentUser
            ? dbRepository.getRecruiterAssessmentsForUser(currentUser.id)
            : [],
          rateLimit: collected.rateLimit,
          warnings: collected.warnings,
        });
      }

      // Profile-level candidate assessment
      const collected = await collectGitHubUserEvidence(parsed.owner, token);
      const normalizedRepositories = collected.repositories.map((r) =>
        normalizeAndAnalyzeRepository(r, collected.username, collected.displayName)
      );

      const seenSkills = new Set<string>();
      const skillAssessments: SkillAssessmentResult[] = [];
      for (const repo of normalizedRepositories) {
        if (repo.isFork) continue;
        for (const sig of repo.detectedTechnologies) {
          const key = sig.skillName.toLowerCase();
          if (!seenSkills.has(key)) {
            seenSkills.add(key);
            skillAssessments.push(
              evaluateSkillEvidence(sig.skillName, true, normalizedRepositories, nowIso)
            );
          }
        }
      }
      skillAssessments.sort((a, b) => b.evidenceScore - a.evidenceScore);

      const jobMatchReport = evaluateJobDescriptionMatch(
        jd,
        normalizedRepositories,
        collected.username,
        undefined,
        nowIso
      );
      const roleRecommendations = recommendSuitableRoles(normalizedRepositories, nowIso);
      const evidenceStrengthScore = computeCandidateEvidenceStrengthScore(skillAssessments);

      const totalAttributedCommits = normalizedRepositories
        .filter((r) => !r.isFork)
        .reduce((acc, r) => acc + r.commits.filter((c) => c.isCandidateAttributed).length, 0);

      const candidateOverview = {
        username: collected.username,
        displayName: collected.displayName,
        avatarUrl: collected.avatarUrl,
        bio: collected.bio,
        profileUrl: collected.profileUrl,
        repositoriesAnalyzed: normalizedRepositories.length,
        originalReposCount: normalizedRepositories.filter((r) => !r.isFork).length,
        forkedReposCount: normalizedRepositories.filter((r) => r.isFork).length,
        totalAttributedCommits,
        skillAssessments,
        normalizedRepositories,
      };

      let savedRecord = null;
      if (currentUser && saveAssessment) {
        savedRecord = dbRepository.saveRecruiterAssessment(currentUser.id, {
          candidateUsername: collected.username,
          candidateDisplayName: collected.displayName || collected.username,
          targetUrl: parsed.canonicalUrl!,
          targetType: 'profile',
          jobTitle: jd.title,
          roleCategory: jd.roleCategory,
          evidenceStrengthScore,
          jdMatchScore: jobMatchReport.matchScore,
          guidanceClassification: jobMatchReport.guidanceClassification,
          candidateOverview,
          jobMatchReport,
        });
      }

      if (currentUser) {
        dbRepository.appendAuditLog({
          userId: currentUser.id,
          action: 'RECRUITER_CANDIDATE_ASSESSMENT',
          status: 'SUCCESS',
          details: `Recruiter assessment completed for @${collected.username} against "${jd.title}" (Evidence Strength: ${evidenceStrengthScore}/100, JD Match: ${jobMatchReport.matchScore}/100, ${jobMatchReport.guidanceClassification}).`,
          rateLimitRemaining: collected.rateLimit.remaining,
        });
      }

      return res.json({
        targetType: 'profile',
        targetUrl: parsed.canonicalUrl,
        evidenceStrengthScore,
        jdMatchScore: jobMatchReport.matchScore,
        candidateOverview,
        jobMatchReport,
        roleRecommendations,
        savedAssessment: savedRecord,
        recruiterAssessments: currentUser
          ? dbRepository.getRecruiterAssessmentsForUser(currentUser.id)
          : [],
        rateLimit: collected.rateLimit,
        warnings: collected.warnings,
      });
    } catch (error: any) {
      res.status(422).json({
        error: error.message || 'Failed to complete recruiter candidate assessment.',
      });
    }
  });

  // ==========================================================================
  // 6. Stateless Job Description Preview Parser
  // ==========================================================================
  app.post('/api/jobs/parse-preview', (req, res) => {
    try {
      const { rawText, title } = req.body || {};
      const parsed = parseJobDescription(rawText || '', title);
      res.json({ jobDescription: parsed });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to parse job description' });
    }
  });

  // ==========================================================================
  // 7. Protected Workspace Endpoints (Require Server-Side Authentication)
  // ==========================================================================
  const requireAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const user = resolveAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in or create a WorkVerify account.',
      });
    }
    (req as any).currentUser = user;
    next();
  };

  app.post('/api/onboarding', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const {
        primaryRole,
        secondaryRoles,
        developerPrefs,
        recruiterPrefs,
        otherPrefs,
        completed,
      } = req.body || {};
      const updated = dbRepository.saveOnboardingPreferences(currentUser.id, {
        primaryRole,
        secondaryRoles,
        developerPrefs,
        recruiterPrefs,
        otherPrefs,
        completed,
      });
      res.json({
        user: sanitizeUserForClient(updated),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save onboarding preferences.' });
    }
  });

  app.post('/api/workspace/role', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const { role } = req.body || {};
      const updated = dbRepository.switchActiveRole(currentUser.id, role);
      res.json({
        user: sanitizeUserForClient(updated),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to switch workspace role.' });
    }
  });

  app.post('/api/auth/change-password', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const { currentPassword, newPassword } = req.body || {};
      const updated = dbRepository.changePassword(currentUser.id, {
        currentPassword,
        newPassword,
      });
      res.json({
        user: sanitizeUserForClient(updated),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update password.' });
    }
  });

  app.post('/api/auth/unlink-provider', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const { provider } = req.body || {};
      const updated = dbRepository.unlinkAuthProvider(currentUser.id, provider);
      res.json({
        user: sanitizeUserForClient(updated),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to unlink authentication provider.' });
    }
  });

  app.get('/api/recruiter/assessments', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      res.json({
        recruiterAssessments: dbRepository.getRecruiterAssessmentsForUser(currentUser.id),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load recruiter assessments.' });
    }
  });

  app.post('/api/recruiter/assessments', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const payload = req.body || {};
      const saved = dbRepository.saveRecruiterAssessment(currentUser.id, payload);
      res.status(201).json({
        savedAssessment: saved,
        recruiterAssessments: dbRepository.getRecruiterAssessmentsForUser(currentUser.id),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to save recruiter assessment.' });
    }
  });

  app.delete('/api/recruiter/assessments/:id', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const assessmentId = req.params.id;
      const remaining = dbRepository.deleteRecruiterAssessment(currentUser.id, assessmentId);
      res.json({
        recruiterAssessments: remaining,
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete recruiter assessment.' });
    }
  });

  app.post('/api/jobs', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const { rawText, title } = req.body || {};
      if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return res.status(400).json({ error: 'Please paste or upload job description text.' });
      }
      const { jobDescription, user } = dbRepository.saveJobDescription(
        currentUser.id,
        rawText,
        title
      );
      res.json({
        jobDescription,
        jobDescriptions: dbRepository.getJobDescriptionsForUser(currentUser.id),
        user: sanitizeUserForClient(user),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save job description' });
    }
  });

  app.put('/api/jobs/:id', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const jdId = req.params.id;
      const { title, requiredSkills, preferredSkills, rawText } = req.body || {};
      const { jobDescription, user } = dbRepository.updateJobDescription(
        currentUser.id,
        jdId,
        {
          title,
          requiredSkills,
          preferredSkills,
          rawText,
        }
      );
      res.json({
        jobDescription,
        jobDescriptions: dbRepository.getJobDescriptionsForUser(currentUser.id),
        user: sanitizeUserForClient(user),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update job description' });
    }
  });

  app.delete('/api/jobs/:id', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const jdId = req.params.id;
      const user = dbRepository.deleteJobDescription(currentUser.id, jdId);
      res.json({
        jobDescriptions: dbRepository.getJobDescriptionsForUser(currentUser.id),
        user: sanitizeUserForClient(user),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete job description' });
    }
  });

  app.post('/api/skills', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const { claimedSkills } = req.body || {};
      if (!Array.isArray(claimedSkills)) {
        return res.status(400).json({ error: 'claimedSkills must be an array of skill names.' });
      }
      const updated = dbRepository.updateClaimedSkills(currentUser.id, claimedSkills);
      res.json({
        user: sanitizeUserForClient(updated),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update claimed skills' });
    }
  });

  app.patch('/api/profile', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const { fullName, roleTitle, bio, isPublicProfile, profileSlug } = req.body || {};
      const updated = dbRepository.updateProfileMetadata(currentUser.id, {
        fullName,
        roleTitle,
        bio,
        isPublicProfile,
        profileSlug,
      });
      res.json({
        user: sanitizeUserForClient(updated),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update profile settings' });
    }
  });

  app.post('/api/github/sync', requireAuth, async (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const rawTarget = (
        (req.body?.username as string) ||
        currentUser.githubUsername ||
        ''
      ).trim();

      if (!rawTarget) {
        return res.status(400).json({
          error: 'Please enter a valid GitHub username or profile URL to analyze.',
        });
      }

      const parsed = parseGitHubTargetUrl(rawTarget);
      if (!parsed.valid || !parsed.owner) {
        return res.status(400).json({
          error: parsed.error || 'Invalid GitHub username or URL.',
        });
      }

      if (parsed.type === 'repository' && parsed.repo) {
        const collected = await collectSingleGitHubRepository(
          parsed.owner,
          parsed.repo,
          currentUser.oauthAccessTokenServerOnly,
          true
        );
        const updated = await dbRepository.saveCollectedGitHubData(currentUser.id, {
          githubUsername: collected.owner,
          githubAvatarUrl: currentUser.githubAvatarUrl || '',
          githubProfileUrl: `https://github.com/${collected.owner}`,
          repositories: [collected.repository],
          rateLimitRemaining: collected.rateLimit.remaining,
          collectionNote: `Collected repository ${collected.owner}/${collected.repoName} from live GitHub REST API.`,
        });
        return res.json({
          user: sanitizeUserForClient(updated),
          auditLogs: dbRepository.getAuditLogs(currentUser.id),
          rateLimit: collected.rateLimit,
          warnings: collected.warnings,
          source: 'github-rest-api',
        });
      }

      const collected = await collectGitHubUserEvidence(
        parsed.owner,
        currentUser.oauthAccessTokenServerOnly,
        true
      );

      const updated = await dbRepository.saveCollectedGitHubData(currentUser.id, {
        githubUsername: collected.username,
        githubAvatarUrl: collected.avatarUrl,
        githubProfileUrl: collected.profileUrl,
        displayName: collected.displayName,
        bio: collected.bio,
        repositories: collected.repositories,
        rateLimitRemaining: collected.rateLimit.remaining,
        collectionNote: `Collected ${collected.repositories.length} live public repositories from GitHub REST API for @${collected.username}.`,
      });

      res.json({
        user: sanitizeUserForClient(updated),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
        rateLimit: collected.rateLimit,
        warnings: collected.warnings,
        source: 'github-rest-api',
      });
    } catch (error: any) {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      dbRepository.appendAuditLog({
        userId: currentUser.id,
        action: 'GITHUB_SYNC_FAILED',
        status: 'ERROR',
        details: error.message || 'GitHub API collection failed.',
      });
      res.status(422).json({
        error: error.message || 'Failed to collect repositories from GitHub API.',
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    }
  });

  app.post('/api/github/disconnect', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const updated = dbRepository.disconnectGitHub(currentUser.id);
      res.json({
        user: sanitizeUserForClient(updated),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to disconnect GitHub' });
    }
  });

  app.delete('/api/account/data', requireAuth, (req, res) => {
    try {
      const currentUser: UserAccountRecord = (req as any).currentUser;
      const purged = dbRepository.deleteAccountData(currentUser.id);
      res.json({
        user: sanitizeUserForClient(purged),
        jobDescriptions: dbRepository.getJobDescriptionsForUser(currentUser.id),
        recruiterAssessments: dbRepository.getRecruiterAssessmentsForUser(currentUser.id),
        auditLogs: dbRepository.getAuditLogs(currentUser.id),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete account data' });
    }
  });

  // ==========================================================================
  // 8. Google OAuth & GitHub OAuth Popup Authorization & Unified Callback
  // ==========================================================================
  app.get('/api/auth/google/url', (req, res) => {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const redirectUri = resolveRedirectUri(req);
    const currentSessionToken = extractSessionToken(req) || '';

    if (!clientId || clientId.includes('your-google')) {
      return res.status(400).json({
        configured: false,
        redirectUri,
        error: `Google OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET) are not configured in environment secrets yet. Authorized redirect URI: ${redirectUri}`,
      });
    }

    const statePayload = Buffer.from(
      JSON.stringify({
        provider: 'google',
        ts: Date.now(),
        sessionToken: currentSessionToken,
        redirectUri,
      })
    ).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state: `wv_google_${statePayload}`,
    });

    res.json({
      configured: true,
      redirectUri,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    });
  });

  app.get('/api/auth/github/url', (req, res) => {
    const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
    const redirectUri = resolveRedirectUri(req);
    const currentSessionToken = extractSessionToken(req) || '';

    if (!clientId || clientId.includes('your-github')) {
      return res.status(400).json({
        configured: false,
        redirectUri,
        error:
          'GITHUB_CLIENT_ID is not configured in environment secrets yet. You can connect and verify any public GitHub username directly via the REST API collector below, or configure GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET.',
      });
    }

    const statePayload = Buffer.from(
      JSON.stringify({
        provider: 'github',
        ts: Date.now(),
        sessionToken: currentSessionToken,
        redirectUri,
      })
    ).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user public_repo',
      state: `wv_github_${statePayload}`,
    });

    res.json({
      configured: true,
      redirectUri,
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    });
  });

  const oauthCallbackHandler = async (req: express.Request, res: express.Response) => {
    const code = req.query.code as string | undefined;
    const rawState = (req.query.state as string | undefined) || '';

    let stateMeta: {
      provider?: 'google' | 'github';
      sessionToken?: string;
      redirectUri?: string;
    } = {};

    if (rawState.startsWith('wv_google_')) {
      try {
        stateMeta = JSON.parse(
          Buffer.from(rawState.slice('wv_google_'.length), 'base64url').toString('utf8')
        );
        stateMeta.provider = 'google';
      } catch {
        stateMeta = { provider: 'google' };
      }
    } else if (rawState.startsWith('wv_github_')) {
      try {
        stateMeta = JSON.parse(
          Buffer.from(rawState.slice('wv_github_'.length), 'base64url').toString('utf8')
        );
        stateMeta.provider = 'github';
      } catch {
        stateMeta = { provider: 'github' };
      }
    }

    const resolvedSessionToken = stateMeta.sessionToken || extractSessionToken(req);
    const existingAuthenticatedUser =
      dbRepository.getUserBySessionToken(resolvedSessionToken);

    // Handle Google OAuth Callback
    if (stateMeta.provider === 'google' || req.path.includes('/google/')) {
      const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
      const googleClientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
      const redirectUri = stateMeta.redirectUri || resolveRedirectUri(req);

      if (!code || !googleClientId || !googleClientSecret) {
        return res.status(400).send(`
          <html>
            <body style="font-family: sans-serif; padding: 24px; background: #0A0F0E; color: #F8FAFC;">
              <h3>Google OAuth Incomplete</h3>
              <p>Missing authorization code or server GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.</p>
              <script>
                setTimeout(() => { if (window.opener) window.close(); }, 3000);
              </script>
            </body>
          </html>
        `);
      }

      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: googleClientId,
            client_secret: googleClientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }).toString(),
        });

        const tokenData: any = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(
            tokenData.error_description || tokenData.error || 'Failed to exchange Google OAuth code.'
          );
        }

        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const googleProfile: any = await profileRes.json();
        if (!profileRes.ok || !googleProfile.sub || !googleProfile.email) {
          throw new Error('Could not retrieve verified email and profile from Google.');
        }

        const { token: newSessionToken } = await dbRepository.authenticateOrLinkGoogle({
          googleId: String(googleProfile.sub),
          email: String(googleProfile.email),
          emailVerified: Boolean(googleProfile.email_verified),
          fullName: String(googleProfile.name || googleProfile.email.split('@')[0]),
          avatarUrl: googleProfile.picture ? String(googleProfile.picture) : undefined,
          currentUserId: existingAuthenticatedUser?.id || null,
        });

        setSessionCookie(res, newSessionToken);
        return res.send(`
          <html>
            <body style="font-family: sans-serif; padding: 24px; background: #0A0F0E; color: #F8FAFC;">
              <h3>Google Account Connected</h3>
              <p>Authentication complete. Returning to WorkVerify...</p>
              <script>
                try {
                  localStorage.setItem('wv_auth_session_token', ${JSON.stringify(newSessionToken)});
                } catch (e) {}
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'OAUTH_AUTH_SUCCESS',
                    provider: 'google',
                    token: ${JSON.stringify(newSessionToken)}
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/app';
                }
              </script>
            </body>
          </html>
        `);
      } catch (error: any) {
        console.error('Google OAuth callback error:', error);
        return res.status(400).send(`
          <html>
            <body style="font-family: sans-serif; padding: 24px; background: #0A0F0E; color: #F8FAFC;">
              <h3>Google Authentication Error</h3>
              <p>${error.message || 'Could not complete Google authentication.'}</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'OAUTH_AUTH_ERROR',
                    provider: 'google',
                    error: ${JSON.stringify(error.message || 'Google authentication failed.')}
                  }, '*');
                }
              </script>
            </body>
          </html>
        `);
      }
    }

    // Handle GitHub OAuth Callback (Separate from platform login when already signed in!)
    const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();

    if (!code || !clientId || !clientSecret) {
      return res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; padding: 24px; background: #0A0F0E; color: #F8FAFC;">
            <h3>GitHub OAuth Incomplete</h3>
            <p>Missing authorization code or server OAuth credentials.</p>
            <script>
              setTimeout(() => { if (window.opener) window.close(); }, 2500);
            </script>
          </body>
        </html>
      `);
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      const tokenData: any = await tokenRes.json();
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        throw new Error(tokenData.error_description || 'Failed to obtain GitHub access token');
      }

      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'WorkVerify-Skill-Verification-Platform/2.0',
        },
      });
      const ghUser: any = await userRes.json();
      const login = ghUser.login;

      const collected = await collectGitHubUserEvidence(login, accessToken, true);
      let currentUser = existingAuthenticatedUser;
      let sessionToken = resolvedSessionToken;

      if (!currentUser) {
        // Check if a user already connected this exact GitHub username
        const reg = dbRepository.registerUser({
          email: ghUser.email || `${login}@users.noreply.github.com`,
          password: `gh_oauth_${Date.now()}_${Math.random()}`,
          fullName: collected.displayName || login,
          roleTitle: 'Software Developer',
        });
        currentUser = reg.user;
        sessionToken = reg.token;
        setSessionCookie(res, reg.token);
      }

      await dbRepository.saveCollectedGitHubData(currentUser.id, {
        githubUsername: collected.username,
        githubAvatarUrl: collected.avatarUrl,
        githubProfileUrl: collected.profileUrl,
        displayName: collected.displayName,
        bio: collected.bio,
        oauthToken: accessToken,
        repositories: collected.repositories,
        rateLimitRemaining: collected.rateLimit.remaining,
        collectionNote: `Authorized via GitHub OAuth (read:user public_repo) and analyzed ${collected.repositories.length} public repositories for @${collected.username}.`,
      });

      res.send(`
        <html>
          <body style="font-family: sans-serif; padding: 24px; background: #0A0F0E; color: #F8FAFC;">
            <h3>GitHub Connected Successfully</h3>
            <p>Your public repositories and commit evidence have been linked to your WorkVerify account. Closing window...</p>
            <script>
              try {
                localStorage.setItem('wv_auth_session_token', ${JSON.stringify(sessionToken || '')});
              } catch (e) {}
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_AUTH_SUCCESS',
                  provider: 'github',
                  token: ${JSON.stringify(sessionToken || '')}
                }, '*');
                window.close();
              } else {
                window.location.href = '/app';
              }
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('GitHub OAuth callback error:', error);
      res.status(500).send(`
        <html>
          <body style="font-family: sans-serif; padding: 24px; background: #0A0F0E; color: #F8FAFC;">
            <h3>GitHub Authorization Error</h3>
            <p>${error.message || 'Could not complete GitHub authorization.'}</p>
          </body>
        </html>
      `);
    }
  };

  app.get(
    [
      '/auth/callback',
      '/auth/callback/',
      '/api/auth/google/callback',
      '/api/auth/google/callback/',
      '/api/auth/github/callback',
      '/api/auth/github/callback/',
    ],
    oauthCallbackHandler
  );

  // ==========================================================================
  // 9. Publicly Shared Candidate Profile Endpoint (Strict Privacy Enforcement)
  // ==========================================================================
  app.get('/api/recruiter/profile/:slug', (req, res) => {
    try {
      const slug = req.params.slug;
      const result = dbRepository.getPublicProfileBySlug(slug);
      if (result.status === 'PRIVATE_PROFILE') {
        return res.status(403).json({
          status: 'PRIVATE_PROFILE',
          error:
            'This WorkVerify profile is set to Private by its owner. Candidates must explicitly publish their profile to allow external recruiter access.',
        });
      }
      if (result.status === 'NOT_FOUND' || !result.profile) {
        return res.status(404).json({
          status: 'NOT_FOUND',
          error: 'No published WorkVerify profile exists at this URL.',
        });
      }
      res.json({ status: 'FOUND_PUBLIC', profile: result.profile });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load recruiter profile' });
    }
  });

  // ==========================================================================
  // 10. Retrieve Supabase PostgreSQL DDL Migration Script & System Status
  // ==========================================================================
  app.get('/api/operations/schema', (_req, res) => {
    try {
      const sqlPath = path.resolve(process.cwd(), 'supabase/schema.sql');
      const sql = fs.existsSync(sqlPath)
        ? fs.readFileSync(sqlPath, 'utf8')
        : '-- Schema file not found';
      res.json({ sql, supabaseStatus: getSupabaseStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to read schema.sql' });
    }
  });
}

registerApiRoutes(app);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WorkVerify production server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
