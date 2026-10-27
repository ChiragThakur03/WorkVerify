import React, { useState, useEffect, useCallback } from 'react';
import {
  UserProfileData,
  AuditLogItem,
  SupabaseConnectionStatus,
  SupportedSkillCatalogItem,
  ExtractedJobDescription,
  PublicAnalysisHistoryItem,
  SavedRecruiterAssessmentItem,
  PrimaryWorkspaceRole,
} from './types/workverify';
import { LandingPageView } from './components/LandingPageView';
import { AuthView, AuthScreenMode } from './components/AuthView';
import { OnboardingView } from './components/OnboardingView';
import { DeveloperWorkspaceHome } from './components/DeveloperWorkspaceHome';
import { RecruiterWorkspaceHome } from './components/RecruiterWorkspaceHome';
import { ExplorerWorkspaceHome } from './components/ExplorerWorkspaceHome';
import { WorkspaceEmptyStateView } from './components/WorkspaceEmptyStateView';
import { SharedProfilePageView } from './components/SharedProfilePageView';
import { SkillEvidenceView } from './components/SkillEvidenceView';
import { RepositoriesView } from './components/RepositoriesView';
import { ContributionsView } from './components/ContributionsView';
import { RecruiterAssessmentView } from './components/RecruiterAssessmentView';
import { JobMatchingView } from './components/JobMatchingView';
import { PublicAnalyzerView } from './components/PublicAnalyzerView';
import { SettingsPrivacyView } from './components/SettingsPrivacyView';
import { ThemeToggleButton } from './components/ThemeToggleButton';
import { apiFetch, setStoredSessionToken } from './lib/apiClient';
import {
  AppTheme,
  readBrowserTheme,
  applyThemeToDocument,
  getNextTheme,
} from './lib/themeManager';
import { parseGitHubTargetUrl } from './lib/jobMatchEngine';
import { LogOut, UserCheck, Terminal, Users, Compass } from 'lucide-react';

import {
  normalizePathname,
  resolveCanonicalRoute,
  getRoleWorkspaceNavItems,
} from './lib/navigationRouting';

function getAuthModeFromPath(path: string): AuthScreenMode {
  if (path === '/signup') return 'register';
  if (path === '/verify-email') return 'verify-email';
  if (path === '/forgot-password') return 'forgot-password';
  if (path === '/reset-password') return 'reset-password';
  return 'login';
}

export default function App() {
  const [theme, setTheme] = useState<AppTheme>(() => readBrowserTheme());
  const [currentPath, setCurrentPath] = useState<string>(() =>
    normalizePathname(window.location.pathname, window.location.search)
  );
  const [targetUrlParam, setTargetUrlParam] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('url') || '';
  });
  const [selectedSavedAssessment, setSelectedSavedAssessment] =
    useState<SavedRecruiterAssessmentItem | null>(null);

  const [user, setUser] = useState<UserProfileData | null>(null);
  const [jobDescriptions, setJobDescriptions] = useState<ExtractedJobDescription[]>([]);
  const [recruiterAssessments, setRecruiterAssessments] = useState<
    SavedRecruiterAssessmentItem[]
  >([]);
  const [publicAnalyses, setPublicAnalyses] = useState<PublicAnalysisHistoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConnectionStatus | null>(null);
  const [supportedCatalog, setSupportedCatalog] = useState<SupportedSkillCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => getNextTheme(prev));
  }, []);

  const navigate = useCallback(
    (path: string, optionalTargetUrl?: string, overrideUser?: UserProfileData | null) => {
      const activeUser = overrideUser !== undefined ? overrideUser : user;
      const resolved = resolveCanonicalRoute(
        path,
        Boolean(activeUser),
        Boolean(activeUser?.onboarding?.completed)
      );
      if (optionalTargetUrl !== undefined) {
        setTargetUrlParam(optionalTargetUrl);
      }
      if (resolved !== '/app/assess' && resolved !== '/recruiter/assessment') {
        setSelectedSavedAssessment(null);
      }
      setBannerError(null);
      window.history.pushState({}, '', resolved);
      setCurrentPath(resolved);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [user]
  );

  useEffect(() => {
    const handlePopState = () => {
      const raw = normalizePathname(window.location.pathname, window.location.search);
      const resolved = resolveCanonicalRoute(
        raw,
        Boolean(user),
        Boolean(user?.onboarding?.completed)
      );
      if (resolved !== raw) {
        window.history.replaceState({}, '', resolved);
      }
      setCurrentPath(resolved);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  useEffect(() => {
    if (isLoading) return;
    const resolved = resolveCanonicalRoute(
      currentPath,
      Boolean(user),
      Boolean(user?.onboarding?.completed)
    );
    if (resolved !== currentPath) {
      window.history.replaceState({}, '', resolved);
      setCurrentPath(resolved);
    }
  }, [isLoading, currentPath, user]);

  const fetchWorkspaceState = useCallback(async () => {
    try {
      setBannerError(null);
      const res = await apiFetch('/api/me');
      if (!res.ok) {
        throw new Error('Failed to load WorkVerify state.');
      }
      const data = await res.json();
      setUser(data.user || null);
      setJobDescriptions(data.jobDescriptions || []);
      setRecruiterAssessments(data.recruiterAssessments || []);
      setPublicAnalyses(data.publicAnalyses || []);
      setAuditLogs(data.auditLogs || []);
      setSupabaseStatus(data.supabaseStatus || null);
      setSupportedCatalog(data.supportedCatalog || []);
    } catch (err: any) {
      setBannerError(err.message || 'Could not load workspace data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorkspaceState();
  }, [fetchWorkspaceState]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        !origin.endsWith('.vercel.app')
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data.token) {
          setStoredSessionToken(event.data.token);
        }
        void fetchWorkspaceState();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR' && event.data?.error) {
        setBannerError(event.data.error);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchWorkspaceState]);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout network error
    }
    setStoredSessionToken(null);
    setUser(null);
    setJobDescriptions([]);
    setRecruiterAssessments([]);
    setAuditLogs([]);
    navigate('/', undefined, null);
  };

  const handleSwitchWorkspaceRole = async (nextRole: PrimaryWorkspaceRole) => {
    if (!user) return;
    setBannerError(null);
    try {
      const res = await apiFetch('/api/workspace/role', {
        method: 'POST',
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to switch workspace role.');
      }
      setUser(data.user);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      if (!currentPath.startsWith('/app')) {
        navigate('/app', undefined, data.user);
      } else if (currentPath !== '/app/settings') {
        navigate('/app', undefined, data.user);
      }
    } catch (err: any) {
      setBannerError(err.message || 'Could not switch workspace role.');
    }
  };

  const handleDeleteRecruiterAssessment = async (assessmentId: string) => {
    setBannerError(null);
    try {
      const res = await apiFetch(`/api/recruiter/assessments/${encodeURIComponent(assessmentId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete saved assessment.');
      }
      setRecruiterAssessments(data.recruiterAssessments || []);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    } catch (err: any) {
      setBannerError(err.message || 'Could not delete assessment.');
    }
  };

  const handleLegacyTabNavigation = (
    tab: 'evidence' | 'repositories' | 'contributions' | 'recruiter' | 'settings'
  ) => {
    if (tab === 'evidence') {
      navigate('/app/skills');
    } else if (tab === 'repositories') {
      navigate('/app/repositories');
    } else if (tab === 'contributions') {
      navigate('/app/contributions');
    } else if (tab === 'recruiter') {
      navigate('/app/assess');
    } else if (tab === 'settings') {
      navigate('/app/settings');
    }
  };

  const handleUpdateClaims = async (claimedSkills: string[]) => {
    setBannerError(null);
    const res = await apiFetch('/api/skills', {
      method: 'POST',
      body: JSON.stringify({ claimedSkills }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerError(data.error || 'Failed to update claimed skills.');
      return;
    }
    setUser(data.user);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
  };

  const handleSyncGitHub = async (usernameOrUrl?: string) => {
    setIsSyncing(true);
    setBannerError(null);
    try {
      let resolvedUsername = usernameOrUrl?.trim();
      if (resolvedUsername) {
        const parsed = parseGitHubTargetUrl(resolvedUsername);
        if (parsed.valid && parsed.owner) {
          resolvedUsername = parsed.owner;
        } else {
          resolvedUsername = resolvedUsername.replace(/^@/, '').trim();
        }
      }

      const res = await apiFetch('/api/github/sync', {
        method: 'POST',
        body: JSON.stringify({ username: resolvedUsername }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.auditLogs) setAuditLogs(data.auditLogs);
        throw new Error(data.error || 'Failed to collect GitHub repositories.');
      }
      setUser(data.user);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddJobDescription = async (rawText: string, title?: string) => {
    setBannerError(null);
    const res = await apiFetch('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ rawText, title }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerError(data.error || 'Failed to add job description.');
      return;
    }
    setUser(data.user);
    setJobDescriptions(data.jobDescriptions || []);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
  };

  const handleUpdateJobDescription = async (
    id: string,
    payload: {
      title?: string;
      requiredSkills?: string[];
      preferredSkills?: string[];
      rawText?: string;
    }
  ) => {
    setBannerError(null);
    const res = await apiFetch(`/api/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerError(data.error || 'Failed to update job description.');
      return;
    }
    setUser(data.user);
    setJobDescriptions(data.jobDescriptions || []);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
  };

  const handleDeleteJobDescription = async (id: string) => {
    setBannerError(null);
    const res = await apiFetch(`/api/jobs/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      setBannerError(data.error || 'Failed to delete job description.');
      return;
    }
    setUser(data.user);
    setJobDescriptions(data.jobDescriptions || []);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
  };

  const handleTogglePublicProfile = async (nextPublic: boolean) => {
    const res = await apiFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ isPublicProfile: nextPublic }),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setUser(data.user);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    }
  };

  const handleUpdateProfileMeta = async (payload: {
    fullName?: string;
    roleTitle?: string;
    bio?: string;
    isPublicProfile?: boolean;
  }) => {
    const res = await apiFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setUser(data.user);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    }
  };

  const handleDisconnectGitHub = async () => {
    const res = await apiFetch('/api/github/disconnect', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.user) {
      setUser(data.user);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    }
  };

  const handleDeleteAccountData = async () => {
    const res = await apiFetch('/api/account/data', { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.user) {
      setUser(data.user);
      setJobDescriptions([]);
      setRecruiterAssessments([]);
      setPublicAnalyses([]);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    }
  };

  const effectivePath = isLoading
    ? currentPath
    : resolveCanonicalRoute(
        currentPath,
        Boolean(user),
        Boolean(user?.onboarding?.completed)
      );

  // Route 1: Root Public Marketing Landing Page (Strictly for Anonymous Visitors)
  if (!isLoading && !user && effectivePath === '/') {
    return (
      <LandingPageView
        onNavigate={(path) => navigate(path)}
        onAnalyzeUrl={(url) => navigate('/analyze', url)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  const isAuthRoute =
    effectivePath === '/login' ||
    effectivePath === '/signup' ||
    effectivePath === '/verify-email' ||
    effectivePath === '/forgot-password' ||
    effectivePath === '/reset-password';

  const hasConnectedRepos = Boolean(
    user && user.githubConnected && user.normalizedRepositories.length > 0
  );

  const activeWorkspaceRole: PrimaryWorkspaceRole = user?.activeRole || 'developer';

  const roleNavItems = getRoleWorkspaceNavItems(activeWorkspaceRole, {
    skillsCount: user?.skillAssessments.length || 0,
    reposCount: user?.normalizedRepositories.length || 0,
    jobDescriptionsCount: jobDescriptions.length,
    recruiterAssessmentsCount: recruiterAssessments.length,
  });

  const isInsideAuthenticatedWorkspace =
    Boolean(user && user.onboarding?.completed) &&
    (effectivePath === '/app' || effectivePath.startsWith('/app/'));

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9F8] text-[#111919] transition-colors">
      {/* Unified Application Header */}
      <header className="sticky top-0 z-30 bg-[#F8F9F8]/95 backdrop-blur-xs border-b border-[#E2E8E7] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <a
              href={user ? '/app' : '/'}
              onClick={(e) => {
                e.preventDefault();
                navigate(user ? '/app' : '/');
              }}
              className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#111919] whitespace-nowrap shrink-0"
            >
              <span className="w-6 h-6 rounded-md bg-[#0B4F4A] text-white inline-flex items-center justify-center font-mono text-xs font-semibold">
                W
              </span>
              <span>WorkVerify</span>
            </a>

            {user && user.onboarding?.completed && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-[#0B4F4A] bg-[#EEF6F5] border border-[#CBE0DD] rounded-md">
                {activeWorkspaceRole === 'recruiter'
                  ? 'Recruiter Workspace'
                  : activeWorkspaceRole === 'other'
                  ? 'Explorer Workspace'
                  : 'Developer Workspace'}
              </span>
            )}
          </div>

          {!user && (
            <nav
              aria-label="Public Tool Navigation"
              className="hidden md:flex items-center gap-7 text-sm font-medium text-[#526362]"
            >
              <button
                type="button"
                onClick={() => navigate('/')}
                className="py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 border-transparent hover:text-[#111919]"
              >
                ← Back to Home
              </button>
              <button
                type="button"
                onClick={() => navigate('/analyze')}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  effectivePath === '/analyze'
                    ? 'border-[#0B4F4A] text-[#0B4F4A] font-semibold'
                    : 'border-transparent hover:text-[#111919]'
                }`}
              >
                Public URL Inspector
              </button>
            </nav>
          )}

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggleButton theme={theme} onToggle={handleToggleTheme} />

            {user ? (
              <>
                {/* 1-Click Role Switcher for Multi-Role / Adaptive Users */}
                <div
                  role="group"
                  aria-label="Switch Active Workspace Role"
                  className="hidden lg:inline-flex items-center p-0.5 bg-[#EEF6F5] border border-[#CBE0DD] rounded-lg text-[11px] font-semibold"
                >
                  {(
                    [
                      ['developer', 'Dev', Terminal],
                      ['recruiter', 'Recruiter', Users],
                      ['other', 'Explorer', Compass],
                    ] as const
                  ).map(([rKey, label, Icon]) => {
                    const isAct = activeWorkspaceRole === rKey;
                    return (
                      <button
                        key={rKey}
                        type="button"
                        onClick={() => void handleSwitchWorkspaceRole(rKey)}
                        className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
                          isAct
                            ? 'bg-[#0B4F4A] text-white'
                            : 'text-[#0B4F4A] hover:bg-[#DDECE9]'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/app')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B4F4A] bg-[#EEF6F5] border border-[#CBE0DD] rounded-lg hover:bg-[#DDECE9] transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#0B4F4A]" />
                  <span>{user.fullName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-3.5 py-2 text-xs font-semibold text-[#111919] bg-white border border-[#CBD5D4] rounded-lg hover:bg-[#F2F5F4] transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] rounded-lg hover:bg-[#0F6660] transition-colors whitespace-nowrap shrink-0"
                >
                  Create Account
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Unified Authenticated Role-Aware Workspace Navigation Bar */}
      {isInsideAuthenticatedWorkspace && (
        <div className="bg-white border-b border-[#E2E8E7] px-4 sm:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-6 overflow-x-auto">
            {roleNavItems.map((item) => {
              const isActive = effectivePath === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#0B4F4A] text-[#0B4F4A]'
                      : 'border-transparent text-[#526362] hover:text-[#111919]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        {bannerError && (
          <div
            role="alert"
            className="mb-6 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-center justify-between gap-4 text-xs text-[#991B1B]"
          >
            <span>{bannerError}</span>
            <button
              type="button"
              onClick={() => setBannerError(null)}
              className="font-semibold underline whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {effectivePath.startsWith('/profile/') ? (
          <SharedProfilePageView
            slug={decodeURIComponent(effectivePath.slice('/profile/'.length))}
            onNavigate={(path) => navigate(path)}
            onEvaluateCandidateInRecruiter={(url) =>
              navigate(user ? '/app/assess' : '/recruiter/assessment', url)
            }
          />
        ) : isLoading ? (
          <div className="bg-white border border-[#E2E8E7] rounded-xl p-8 space-y-4">
            <div className="h-6 w-64 bg-[#EEF6F5] rounded" />
            <div className="h-4 w-96 bg-[#F2F5F4] rounded" />
            <div className="grid grid-cols-4 gap-4 pt-4">
              <div className="h-20 bg-[#F8F9F8] rounded-lg" />
              <div className="h-20 bg-[#F8F9F8] rounded-lg" />
              <div className="h-20 bg-[#F8F9F8] rounded-lg" />
              <div className="h-20 bg-[#F8F9F8] rounded-lg" />
            </div>
          </div>
        ) : (
          <>
            {isAuthRoute && (
              <AuthView
                initialMode={getAuthModeFromPath(effectivePath)}
                currentUser={user}
                onAuthSuccess={({
                  user: authedUser,
                  token,
                  jobDescriptions: jds,
                  recruiterAssessments: rAssessments,
                  auditLogs: logs,
                  isNewRegistration,
                }) => {
                  if (token) setStoredSessionToken(token);
                  setUser(authedUser);
                  setJobDescriptions(jds || []);
                  setRecruiterAssessments(rAssessments || []);
                  setAuditLogs(logs || []);
                  if (isNewRegistration || !authedUser.onboarding?.completed) {
                    navigate('/onboarding', undefined, authedUser);
                  } else {
                    navigate('/app', undefined, authedUser);
                  }
                }}
                onUserUpdated={(updatedUser, logs) => {
                  setUser(updatedUser);
                  if (logs) setAuditLogs(logs);
                }}
                onNavigate={(path) => navigate(path)}
              />
            )}

            {effectivePath === '/onboarding' && (
              <>
                {!user ? (
                  <AuthView
                    initialMode="register"
                    onAuthSuccess={({
                      user: authedUser,
                      token,
                      jobDescriptions: jds,
                      recruiterAssessments: rAssessments,
                      auditLogs: logs,
                    }) => {
                      if (token) setStoredSessionToken(token);
                      setUser(authedUser);
                      setJobDescriptions(jds || []);
                      setRecruiterAssessments(rAssessments || []);
                      setAuditLogs(logs || []);
                      navigate('/onboarding', undefined, authedUser);
                    }}
                    onNavigate={(path) => navigate(path)}
                  />
                ) : (
                  <OnboardingView
                    user={user}
                    isSyncingGitHub={isSyncing}
                    onSyncGitHub={handleSyncGitHub}
                    onOnboardingComplete={(updatedUser, logs, nextRoute) => {
                      setUser(updatedUser);
                      if (logs) setAuditLogs(logs);
                      navigate(nextRoute || '/app', undefined, updatedUser);
                    }}
                  />
                )}
              </>
            )}

            {/* Anonymous Public Tools (/analyze, /applicant, /recruiter/assessment when signed out) */}
            {!user && effectivePath === '/analyze' && (
              <PublicAnalyzerView
                initialUrl={targetUrlParam}
                recentAnalyses={publicAnalyses}
                isAuthenticated={false}
                onAnalysisRecorded={(history) => setPublicAnalyses(history)}
                onOpenInRecruiterAssessment={(url) => navigate('/recruiter/assessment', url)}
                onOpenInApplicantMatcher={(url) => navigate('/applicant', url)}
                onSaveToWorkspace={async () => {
                  navigate('/login');
                }}
                onNavigate={(path) => navigate(path)}
              />
            )}

            {!user && effectivePath === '/applicant' && (
              <JobMatchingView
                user={null}
                jobDescriptions={jobDescriptions}
                supportedCatalog={supportedCatalog}
                initialTargetUrl={targetUrlParam}
                onAddJobDescription={handleAddJobDescription}
                onUpdateJobDescription={handleUpdateJobDescription}
                onDeleteJobDescription={handleDeleteJobDescription}
              />
            )}

            {!user && effectivePath === '/recruiter/assessment' && (
              <RecruiterAssessmentView
                user={null}
                savedJobDescriptions={jobDescriptions}
                supportedCatalog={supportedCatalog}
                initialTargetUrl={targetUrlParam}
                initialSavedAssessment={selectedSavedAssessment}
                onAssessmentSaved={(list) => setRecruiterAssessments(list)}
                onTogglePublicProfile={handleTogglePublicProfile}
              />
            )}

            {/* Authenticated Application Workspace Shell */}
            {(effectivePath === '/app' || effectivePath.startsWith('/app/')) && (
              <>
                {!user ? (
                  <AuthView
                    onAuthSuccess={({
                      user: authedUser,
                      token,
                      jobDescriptions: jds,
                      recruiterAssessments: rAssessments,
                      auditLogs: logs,
                      isNewRegistration,
                    }) => {
                      if (token) setStoredSessionToken(token);
                      setUser(authedUser);
                      setJobDescriptions(jds || []);
                      setRecruiterAssessments(rAssessments || []);
                      setAuditLogs(logs || []);
                      if (isNewRegistration || !authedUser.onboarding?.completed) {
                        navigate('/onboarding', undefined, authedUser);
                      } else {
                        navigate('/app', undefined, authedUser);
                      }
                    }}
                    onNavigate={(path) => navigate(path)}
                  />
                ) : !user.onboarding?.completed ? (
                  <OnboardingView
                    user={user}
                    isSyncingGitHub={isSyncing}
                    onSyncGitHub={handleSyncGitHub}
                    onOnboardingComplete={(updatedUser, logs, nextRoute) => {
                      setUser(updatedUser);
                      if (logs) setAuditLogs(logs);
                      navigate(nextRoute || '/app', undefined, updatedUser);
                    }}
                  />
                ) : (
                  <div className="space-y-6">
                    {effectivePath === '/app/settings' ? (
                      <SettingsPrivacyView
                        user={user}
                        auditLogs={auditLogs}
                        supabaseStatus={supabaseStatus}
                        onSyncGitHub={handleSyncGitHub}
                        onDisconnectGitHub={handleDisconnectGitHub}
                        onDeleteAccountData={handleDeleteAccountData}
                        onUpdateProfileMeta={handleUpdateProfileMeta}
                        onSwitchWorkspaceRole={handleSwitchWorkspaceRole}
                        onUserUpdated={(updatedUser, logs) => {
                          setUser(updatedUser);
                          if (logs) setAuditLogs(logs);
                        }}
                        onNavigate={(path) => navigate(path)}
                        isSyncing={isSyncing}
                        theme={theme}
                        onToggleTheme={handleToggleTheme}
                      />
                    ) : effectivePath === '/app/inspector' ? (
                      <PublicAnalyzerView
                        initialUrl={targetUrlParam}
                        recentAnalyses={publicAnalyses}
                        isAuthenticated={true}
                        onAnalysisRecorded={(history) => setPublicAnalyses(history)}
                        onOpenInRecruiterAssessment={(url) => navigate('/app/assess', url)}
                        onOpenInApplicantMatcher={(url) => navigate('/app/job-match', url)}
                        onSaveToWorkspace={async (targetUrlOrUsername) => {
                          await handleSyncGitHub(targetUrlOrUsername);
                          if (activeWorkspaceRole === 'developer') {
                            navigate('/app/skills');
                          }
                        }}
                        onNavigate={(path) => navigate(path)}
                      />
                    ) : effectivePath === '/app/job-match' || effectivePath === '/app/jobs' ? (
                      <JobMatchingView
                        user={user}
                        jobDescriptions={jobDescriptions}
                        supportedCatalog={supportedCatalog}
                        initialTargetUrl={targetUrlParam}
                        onAddJobDescription={handleAddJobDescription}
                        onUpdateJobDescription={handleUpdateJobDescription}
                        onDeleteJobDescription={handleDeleteJobDescription}
                      />
                    ) : effectivePath === '/app/assess' ? (
                      <RecruiterAssessmentView
                        user={user}
                        savedJobDescriptions={jobDescriptions}
                        supportedCatalog={supportedCatalog}
                        initialTargetUrl={targetUrlParam}
                        initialSavedAssessment={selectedSavedAssessment}
                        onAssessmentSaved={(list) => setRecruiterAssessments(list)}
                        onTogglePublicProfile={handleTogglePublicProfile}
                      />
                    ) : effectivePath === '/app/skills' ? (
                      !hasConnectedRepos ? (
                        <WorkspaceEmptyStateView
                          user={user}
                          isSyncing={isSyncing}
                          onSyncGitHub={handleSyncGitHub}
                          onNavigate={(path) => navigate(path)}
                        />
                      ) : (
                        <SkillEvidenceView
                          user={user}
                          supportedCatalog={supportedCatalog}
                          onUpdateClaims={handleUpdateClaims}
                          onSyncGitHub={handleSyncGitHub}
                          onNavigateTab={handleLegacyTabNavigation}
                          isSyncing={isSyncing}
                        />
                      )
                    ) : effectivePath === '/app/repositories' ? (
                      !hasConnectedRepos ? (
                        <WorkspaceEmptyStateView
                          user={user}
                          isSyncing={isSyncing}
                          onSyncGitHub={handleSyncGitHub}
                          onNavigate={(path) => navigate(path)}
                        />
                      ) : (
                        <RepositoriesView
                          repositories={user.normalizedRepositories}
                          githubUsername={user.githubUsername || 'disconnected'}
                        />
                      )
                    ) : effectivePath === '/app/contributions' ? (
                      !hasConnectedRepos ? (
                        <WorkspaceEmptyStateView
                          user={user}
                          isSyncing={isSyncing}
                          onSyncGitHub={handleSyncGitHub}
                          onNavigate={(path) => navigate(path)}
                        />
                      ) : (
                        <ContributionsView
                          repositories={user.normalizedRepositories}
                          githubUsername={user.githubUsername || 'disconnected'}
                        />
                      )
                    ) : activeWorkspaceRole === 'recruiter' ? (
                      <RecruiterWorkspaceHome
                        user={user}
                        recruiterAssessments={recruiterAssessments}
                        savedJobDescriptions={jobDescriptions}
                        onDeleteAssessment={handleDeleteRecruiterAssessment}
                        onSelectSavedAssessment={(item) => {
                          setSelectedSavedAssessment(item);
                          navigate('/app/assess', item.targetUrl);
                        }}
                        onNavigate={(path, url) => navigate(path, url)}
                      />
                    ) : activeWorkspaceRole === 'other' ? (
                      <ExplorerWorkspaceHome
                        user={user}
                        publicAnalyses={publicAnalyses}
                        onSwitchRole={handleSwitchWorkspaceRole}
                        onNavigate={(path, url) => navigate(path, url)}
                      />
                    ) : (
                      <DeveloperWorkspaceHome
                        user={user}
                        jobDescriptions={jobDescriptions}
                        publicAnalyses={publicAnalyses}
                        isSyncing={isSyncing}
                        onSyncGitHub={handleSyncGitHub}
                        onNavigate={(path, url) => navigate(path, url)}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Role-Aware Footer */}
      <footer className="border-t border-[#E2E8E7] bg-white px-4 sm:px-8 py-5 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#526362]">
          <div>
            WorkVerify — Real-Work Technical Skill &amp; Experience Verification Platform
          </div>
          <div className="flex items-center gap-5">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/app')}
                  className="hover:text-[#0B4F4A] transition-colors"
                >
                  Workspace Home
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/app/inspector')}
                  className="hover:text-[#0B4F4A] transition-colors"
                >
                  Public URL Inspector
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/app/settings')}
                  className="hover:text-[#0B4F4A] transition-colors"
                >
                  Settings &amp; Security
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="hover:text-[#0B4F4A] transition-colors"
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/analyze')}
                  className="hover:text-[#0B4F4A] transition-colors"
                >
                  Public URL Inspector
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="hover:text-[#0B4F4A] transition-colors"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
