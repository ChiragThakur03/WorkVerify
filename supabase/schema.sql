-- ============================================================================
-- WorkVerify — Production Supabase PostgreSQL Schema
-- Real-Work Based Technical Skill, Job-Match & Experience Verification Platform
-- Run this migration in your Supabase SQL Editor to initialize or upgrade tables.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users, Auth Identities & Adaptive Onboarding State
CREATE TABLE IF NOT EXISTS public.wv_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_code TEXT,
  email_verification_expires_at TIMESTAMPTZ,
  password_reset_token TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  google_id TEXT UNIQUE,
  linked_providers_json JSONB DEFAULT '[]'::jsonb,
  full_name TEXT NOT NULL,
  role_title TEXT DEFAULT 'Software Engineer',
  bio TEXT DEFAULT '',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  primary_role TEXT DEFAULT 'developer', -- 'developer' | 'recruiter' | 'other'
  secondary_roles_json JSONB DEFAULT '[]'::jsonb,
  active_role TEXT DEFAULT 'developer',
  onboarding_answers_json JSONB DEFAULT '{}'::jsonb,
  github_username TEXT,
  github_connected BOOLEAN DEFAULT FALSE,
  github_avatar_url TEXT,
  github_profile_url TEXT,
  github_connected_at TIMESTAMPTZ,
  profile_slug TEXT UNIQUE NOT NULL,
  is_public_profile BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Non-destructive column upgrades for existing deployments
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS email_verification_code TEXT;
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS linked_providers_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS primary_role TEXT DEFAULT 'developer';
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS secondary_roles_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS active_role TEXT DEFAULT 'developer';
ALTER TABLE public.wv_users ADD COLUMN IF NOT EXISTS onboarding_answers_json JSONB DEFAULT '{}'::jsonb;

-- 2. Authenticated User Sessions
CREATE TABLE IF NOT EXISTS public.wv_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.wv_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Server-Only OAuth Credentials (Never exposed to client browser)
CREATE TABLE IF NOT EXISTS public.wv_github_tokens (
  user_id TEXT PRIMARY KEY REFERENCES public.wv_users(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT 'read:user public_repo',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Normalized Repositories Collected from GitHub REST API
CREATE TABLE IF NOT EXISTS public.wv_repositories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.wv_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  html_url TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_fork BOOLEAN DEFAULT FALSE,
  is_empty BOOLEAN DEFAULT FALSE,
  primary_language TEXT,
  languages_json JSONB DEFAULT '{}'::jsonb,
  manifests_json JSONB DEFAULT '[]'::jsonb,
  source_files_json JSONB DEFAULT '[]'::jsonb,
  excluded_files_count INTEGER DEFAULT 0,
  total_commits_sampled INTEGER DEFAULT 0,
  user_attributed_commits INTEGER DEFAULT 0,
  pull_requests_count INTEGER DEFAULT 0,
  stars_count INTEGER DEFAULT 0,
  has_readme BOOLEAN DEFAULT TRUE,
  created_at_gh TIMESTAMPTZ,
  pushed_at_gh TIMESTAMPTZ,
  commits_json JSONB DEFAULT '[]'::jsonb,
  prs_json JSONB DEFAULT '[]'::jsonb,
  data_quality_notes JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Claimed Skills & Deterministic Evidence Assessments
CREATE TABLE IF NOT EXISTS public.wv_skill_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.wv_users(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Language / Framework',
  claimed_by_user BOOLEAN DEFAULT TRUE,
  evidence_band TEXT NOT NULL DEFAULT 'Insufficient Evidence',
  evidence_score INTEGER NOT NULL DEFAULT 0,
  breakdown_json JSONB DEFAULT '{}'::jsonb,
  supporting_repos_json JSONB DEFAULT '[]'::jsonb,
  supporting_commits_json JSONB DEFAULT '[]'::jsonb,
  positive_signals_json JSONB DEFAULT '[]'::jsonb,
  missing_signals_json JSONB DEFAULT '[]'::jsonb,
  limitations_json JSONB DEFAULT '[]'::jsonb,
  assessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Public GitHub Analysis Runs (Repository & Profile Scans — No Login Required)
CREATE TABLE IF NOT EXISTS public.wv_public_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.wv_users(id) ON DELETE SET NULL,
  session_id TEXT,
  target_type TEXT NOT NULL, -- 'repository' | 'profile'
  canonical_url TEXT NOT NULL,
  owner_login TEXT NOT NULL,
  repo_name TEXT,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  cached_until TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Saved Job Descriptions & Extracted Requirement Schemas
CREATE TABLE IF NOT EXISTS public.wv_job_descriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.wv_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  role_category TEXT NOT NULL,
  seniority TEXT NOT NULL DEFAULT 'Unspecified',
  raw_text TEXT NOT NULL,
  required_skills_json JSONB DEFAULT '[]'::jsonb,
  preferred_skills_json JSONB DEFAULT '[]'::jsonb,
  inferred_skills_json JSONB DEFAULT '[]'::jsonb,
  responsibilities_json JSONB DEFAULT '[]'::jsonb,
  expected_signals_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Saved Recruiter Candidate Assessments (Distinct Evidence Strength vs JD Match)
CREATE TABLE IF NOT EXISTS public.wv_recruiter_assessments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.wv_users(id) ON DELETE CASCADE,
  candidate_username TEXT NOT NULL,
  candidate_display_name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'profile',
  job_title TEXT NOT NULL,
  role_category TEXT NOT NULL,
  evidence_strength_score INTEGER NOT NULL DEFAULT 0,
  jd_match_score INTEGER NOT NULL DEFAULT 0,
  guidance_classification TEXT NOT NULL,
  candidate_overview_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Job Description Match Results
CREATE TABLE IF NOT EXISTS public.wv_job_matches (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.wv_users(id) ON DELETE CASCADE,
  job_description_id TEXT REFERENCES public.wv_job_descriptions(id) ON DELETE CASCADE,
  candidate_username TEXT NOT NULL,
  match_score INTEGER NOT NULL DEFAULT 0,
  guidance_classification TEXT NOT NULL,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Operations, Rate-Limit & Privacy Audit Logs
CREATE TABLE IF NOT EXISTS public.wv_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT NOT NULL,
  rate_limit_remaining INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Serverless State Synchronization Store (for Vercel Serverless Cold-Start Hydration)
CREATE TABLE IF NOT EXISTS public.wv_kv_store (
  key TEXT PRIMARY KEY,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wv_sessions_user ON public.wv_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_wv_repos_user_id ON public.wv_repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_wv_claims_user_id ON public.wv_skill_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_wv_users_slug ON public.wv_users(profile_slug);
CREATE INDEX IF NOT EXISTS idx_wv_public_url ON public.wv_public_analyses(canonical_url);
CREATE INDEX IF NOT EXISTS idx_wv_jds_user_id ON public.wv_job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_wv_recruiter_assessments_user_id ON public.wv_recruiter_assessments(user_id);
