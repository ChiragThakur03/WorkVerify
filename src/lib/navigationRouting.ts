import { PrimaryWorkspaceRole } from '../types/workverify';

export interface WorkspaceNavItem {
  path: string;
  label: string;
}

/**
 * Normalizes a raw browser pathname and search query into a clean route path.
 */
export function normalizePathname(rawPath: string, rawSearch: string): string {
  const params = new URLSearchParams(rawSearch);
  const legacySlug = params.get('recruiterProfile');
  if (legacySlug) {
    return `/profile/${encodeURIComponent(legacySlug)}`;
  }
  const clean = rawPath.replace(/\/+$/, '') || '/';
  return clean;
}

/**
 * Resolves and canonicalizes a route path based on authentication and onboarding state.
 * - Authenticated & onboarded users stay inside the unified `/app/*` workspace shell.
 *   Legacy standalone paths (`/analyze`, `/applicant`, `/recruiter/assessment`, `/`)
 *   are mapped to their canonical `/app/*` counterparts (`/app/inspector`, `/app/job-match`, `/app/assess`, `/app`).
 * - Anonymous visitors accessing `/app/inspector` directly are mapped to `/analyze` so the
 *   focused Public URL Inspector works without rendering the marketing landing page.
 */
export function resolveCanonicalRoute(
  rawPath: string,
  isAuthenticated: boolean,
  isOnboardingCompleted: boolean
): string {
  const clean = rawPath.replace(/\/+$/, '') || '/';

  // Public shared profile links are always accessible as-is
  if (clean.startsWith('/profile/')) {
    return clean;
  }

  // Auth verification / password reset routes remain accessible
  if (
    clean === '/verify-email' ||
    clean === '/forgot-password' ||
    clean === '/reset-password'
  ) {
    return clean;
  }

  if (isAuthenticated) {
    if (!isOnboardingCompleted) {
      return '/onboarding';
    }
    if (clean === '/' || clean === '/login' || clean === '/signup') {
      return '/app';
    }
    if (clean === '/analyze' || clean === '/inspector') {
      return '/app/inspector';
    }
    if (clean === '/applicant') {
      return '/app/job-match';
    }
    if (clean === '/recruiter/assessment') {
      return '/app/assess';
    }
    return clean;
  }

  // Unauthenticated visitor
  if (clean === '/app/inspector' || clean === '/inspector') {
    return '/analyze';
  }
  if (clean === '/app/job-match' || clean === '/app/jobs') {
    return '/applicant';
  }
  if (clean === '/app/assess') {
    return '/recruiter/assessment';
  }

  return clean;
}

/**
 * Returns the role-aware navigation items for the unified authenticated application shell.
 */
export function getRoleWorkspaceNavItems(
  role: PrimaryWorkspaceRole,
  counts: {
    skillsCount: number;
    reposCount: number;
    jobDescriptionsCount: number;
    recruiterAssessmentsCount: number;
  }
): WorkspaceNavItem[] {
  if (role === 'recruiter') {
    return [
      {
        path: '/app',
        label: `Candidate Pipeline (${counts.recruiterAssessmentsCount})`,
      },
      {
        path: '/app/assess',
        label: 'Candidate Evaluator',
      },
      {
        path: '/app/jobs',
        label: `Job Requisitions (${counts.jobDescriptionsCount})`,
      },
      {
        path: '/app/inspector',
        label: 'Public URL Inspector',
      },
      {
        path: '/app/settings',
        label: 'Settings & Security',
      },
    ];
  }

  if (role === 'other') {
    return [
      {
        path: '/app',
        label: 'Explorer Home',
      },
      {
        path: '/app/inspector',
        label: 'Public URL Inspector',
      },
      {
        path: '/app/job-match',
        label: 'Job Benchmark',
      },
      {
        path: '/app/assess',
        label: 'Candidate Evaluator',
      },
      {
        path: '/app/settings',
        label: 'Settings & Security',
      },
    ];
  }

  // Default: Developer workspace
  return [
    {
      path: '/app',
      label: 'Overview & Goals',
    },
    {
      path: '/app/skills',
      label: `Skills & Evidence (${counts.skillsCount})`,
    },
    {
      path: '/app/repositories',
      label: `Repositories (${counts.reposCount})`,
    },
    {
      path: '/app/contributions',
      label: 'Contributions',
    },
    {
      path: '/app/job-match',
      label: `Job Match & Readiness (${counts.jobDescriptionsCount})`,
    },
    {
      path: '/app/inspector',
      label: 'Public URL Inspector',
    },
    {
      path: '/app/settings',
      label: 'Settings & Security',
    },
  ];
}
