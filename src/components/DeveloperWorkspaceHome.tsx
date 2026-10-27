import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  Check,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Search,
  Briefcase,
  FileCode2,
  SlidersHorizontal,
  ShieldCheck,
} from 'lucide-react';
import {
  UserProfileData,
  ExtractedJobDescription,
  PublicAnalysisHistoryItem,
} from '../types/workverify';
import { EvidenceMeterBar } from './VisualAssets';
import { apiFetch } from '../lib/apiClient';

interface DeveloperWorkspaceHomeProps {
  user: UserProfileData;
  jobDescriptions: ExtractedJobDescription[];
  publicAnalyses: PublicAnalysisHistoryItem[];
  isSyncing: boolean;
  onSyncGitHub: (username?: string) => Promise<void>;
  onNavigate: (path: string, optionalUrl?: string) => void;
}

const TARGET_ROLE_EXPECTED_SKILLS: Record<string, string[]> = {
  'Full-Stack': ['TypeScript', 'React', 'Node.js', 'SQL & PostgreSQL'],
  Frontend: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS'],
  Backend: ['Node.js', 'Python', 'SQL & PostgreSQL', 'Docker & CI/CD'],
  'Data / ML': ['Python', 'SQL & PostgreSQL', 'Docker & CI/CD'],
  'DevOps / Cloud': ['Docker & CI/CD', 'Go', 'Python', 'Node.js'],
  Mobile: ['TypeScript', 'React', 'Node.js'],
  Systems: ['Rust', 'C++', 'Go', 'Docker & CI/CD'],
};

export const DeveloperWorkspaceHome: React.FC<DeveloperWorkspaceHomeProps> = ({
  user,
  jobDescriptions,
  publicAnalyses,
  isSyncing,
  onSyncGitHub,
  onNavigate,
}) => {
  const [githubInput, setGithubInput] = useState(user.githubUsername || '');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);

  const devPrefs = user.onboarding?.developerPrefs || {
    currentStatus: 'Actively job hunting',
    targetRole: 'Full-Stack',
    mainGoal: 'Check job readiness',
  };

  const hasConnectedRepos = Boolean(
    user.githubConnected && user.normalizedRepositories.length > 0
  );

  // Compute target role alignment & gaps based on onboarding targetRole
  const targetRoleGapAnalysis = useMemo(() => {
    const expectedSkills =
      TARGET_ROLE_EXPECTED_SKILLS[devPrefs.targetRole] ||
      TARGET_ROLE_EXPECTED_SKILLS['Full-Stack'];

    const verifiedStrengths: { skillName: string; score: number; band: string }[] = [];
    const gapsOrWeak: { skillName: string; score: number; band: string; reason: string }[] = [];

    for (const reqSkill of expectedSkills) {
      const found = user.skillAssessments.find(
        (s) => s.skillName.toLowerCase() === reqSkill.toLowerCase()
      );
      if (
        found &&
        (found.evidenceBand === 'Strong Evidence' ||
          found.evidenceBand === 'Moderate Evidence')
      ) {
        verifiedStrengths.push({
          skillName: reqSkill,
          score: found.evidenceScore,
          band: found.evidenceBand,
        });
      } else if (found) {
        gapsOrWeak.push({
          skillName: reqSkill,
          score: found.evidenceScore,
          band: found.evidenceBand,
          reason:
            found.missingOrWeakSignals[0] ||
            'Detected in manifests or minor files without substantive attributed commits.',
        });
      } else {
        gapsOrWeak.push({
          skillName: reqSkill,
          score: 0,
          band: 'No public evidence found',
          reason: `No public repositories in @${
            user.githubUsername || 'your profile'
          } currently contain source files or attributed commits for ${reqSkill}.`,
        });
      }
    }

    // Determine single clear next action
    let nextBestAction = {
      title: 'Compare your repositories against a real Job Description',
      description:
        'Paste a target job description to calculate your requirement-by-requirement readiness score.',
      ctaLabel: 'Open Job Match & Readiness',
      ctaPath: '/app/job-match',
    };

    if (!hasConnectedRepos) {
      nextBestAction = {
        title: 'Connect your GitHub account to verify your engineering skills',
        description:
          'Link your GitHub identity via OAuth or enter your public GitHub username below to analyze your repositories and commit history.',
        ctaLabel: 'Connect GitHub Below',
        ctaPath: '#connect-github-section',
      };
    } else if (gapsOrWeak.length > 0) {
      const topGap = gapsOrWeak[0];
      nextBestAction = {
        title: `Strengthen public evidence for ${topGap.skillName} (${devPrefs.targetRole} focus)`,
        description: `${topGap.reason} Push authored source files and substantive commits, or test your current readiness against a ${devPrefs.targetRole} job description.`,
        ctaLabel: 'Compare Against Target Job Description',
        ctaPath: '/app/job-match',
      };
    } else if (jobDescriptions.length === 0) {
      nextBestAction = {
        title: `Benchmark your ${devPrefs.targetRole} evidence against a target Job Description`,
        description: `All core ${devPrefs.targetRole} skills have supporting evidence. Add a real job posting to verify requirement-level alignment.`,
        ctaLabel: 'Add Target Job Description',
        ctaPath: '/app/job-match',
      };
    }

    return {
      expectedSkills,
      verifiedStrengths,
      gapsOrWeak,
      nextBestAction,
    };
  }, [devPrefs.targetRole, user.skillAssessments, user.githubUsername, hasConnectedRepos, jobDescriptions.length]);

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = githubInput.trim();
    if (!raw) {
      setConnectError('Please enter your public GitHub username or profile URL.');
      return;
    }
    const cleaned = raw
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/^(www\.)?github\.com\//i, '')
      .split('/')[0]
      .replace(/^@/, '')
      .trim();
    if (!cleaned) {
      setConnectError('Please enter a valid GitHub username.');
      return;
    }
    setConnectError(null);
    try {
      await onSyncGitHub(cleaned);
    } catch (err: any) {
      setConnectError(err.message || 'Could not collect GitHub repositories.');
    }
  };

  const handleStartGitHubOAuth = async () => {
    setOauthMessage(null);
    try {
      const origin = window.location.origin;
      const res = await apiFetch(`/api/auth/github/url?origin=${encodeURIComponent(origin)}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        setOauthMessage(
          data.error ||
            'GitHub OAuth is not configured in environment secrets yet. Use the Direct Public GitHub Username Collector below to connect your repositories.'
        );
        return;
      }
      window.open(data.url, 'github_oauth_popup', 'width=620,height=720');
    } catch (err: any) {
      setOauthMessage(err.message || 'Could not initiate GitHub OAuth.');
    }
  };

  const originalReposCount = user.normalizedRepositories.filter((r) => !r.isFork).length;
  const forkedReposCount = user.normalizedRepositories.filter((r) => r.isFork).length;
  const totalAttributedCommits = user.normalizedRepositories
    .filter((r) => !r.isFork)
    .reduce((acc, r) => acc + r.candidateAttributedCommits, 0);
  const verifiedSkillsCount = user.skillAssessments.filter(
    (s) => s.evidenceBand === 'Strong Evidence' || s.evidenceBand === 'Moderate Evidence'
  ).length;

  return (
    <div className="space-y-8">
      {/* Personalized Developer Context Header */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#0B4F4A]">
              <span>Developer Workspace</span>
              <span>·</span>
              <span>Target: {devPrefs.targetRole}</span>
              <span>·</span>
              <span className="text-[#526362]">{devPrefs.currentStatus}</span>
              <span>·</span>
              <span className="text-[#526362]">Goal: {devPrefs.mainGoal}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111919]">
              {hasConnectedRepos
                ? `${user.fullName} — Verified Engineering Evidence`
                : `Welcome to your Developer Workspace, ${user.fullName}`}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/onboarding')}
              className="px-3 py-1.5 text-xs font-medium text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg inline-flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Edit Goals</span>
            </button>
            {hasConnectedRepos && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => void onSyncGitHub(user.githubUsername)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Refresh GitHub'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Single Clear Recommended Next Action */}
        <div className="p-4 bg-[#FBF7EE] border border-[#F3E3C3] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#92400E]">
              Recommended Next Action
            </div>
            <div className="text-sm font-bold text-[#111919]">
              {targetRoleGapAnalysis.nextBestAction.title}
            </div>
            <p className="text-xs text-[#263333]">
              {targetRoleGapAnalysis.nextBestAction.description}
            </p>
          </div>
          {targetRoleGapAnalysis.nextBestAction.ctaPath.startsWith('/') && (
            <button
              type="button"
              onClick={() => onNavigate(targetRoleGapAnalysis.nextBestAction.ctaPath)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5 shrink-0"
            >
              <span>{targetRoleGapAnalysis.nextBestAction.ctaLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* HONEST SETUP STATE WHEN GITHUB IS NOT CONNECTED YET */}
      {!hasConnectedRepos ? (
        <section
          id="connect-github-section"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          <div className="lg:col-span-8 bg-white border border-[#E2E8E7] rounded-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-[#0B4F4A]">
                <GitBranch className="w-4 h-4" />
                <span>No GitHub Account Connected Yet</span>
              </div>
              <h2 className="text-xl font-bold text-[#111919]">
                Connect your GitHub identity to verify your {devPrefs.targetRole} skills
              </h2>
              <p className="text-xs text-[#526362] leading-relaxed">
                WorkVerify never fabricates repository counts or skill scores. Connect your GitHub account via OAuth (read-only public scope: <code className="font-mono">read:user public_repo</code>) or enter your public GitHub username to fetch and analyze your real repositories, source files, and commit history.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleStartGitHubOAuth}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-2 transition-colors"
              >
                <span>Connect GitHub via OAuth</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-[#526362]">
                Requests minimum read-only public permissions
              </span>
            </div>

            {oauthMessage && (
              <div className="p-3.5 bg-[#FBF7EE] border border-[#F3E3C3] rounded-lg text-xs text-[#92400E]">
                {oauthMessage}
              </div>
            )}

            <form
              onSubmit={handleConnectSubmit}
              className="pt-5 border-t border-[#E2E8E7] space-y-3"
            >
              <label
                htmlFor="dev-home-gh-username"
                className="block text-xs font-semibold text-[#111919]"
              >
                Or verify your public GitHub username directly via GitHub REST API:
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  id="dev-home-gh-username"
                  type="text"
                  value={githubInput}
                  onChange={(e) => setGithubInput(e.target.value)}
                  placeholder="e.g., octocat or https://github.com/username"
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg inline-flex items-center justify-center gap-2 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isSyncing ? 'Analyzing Live GitHub...' : 'Import & Verify My GitHub'}
                  </span>
                </button>
              </div>
              {connectError && (
                <div
                  role="alert"
                  className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B]"
                >
                  {connectError}
                </div>
              )}
            </form>
          </div>

          {/* Secondary Tools Card: Public URL Inspector & Job Match */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-[#E2E8E7] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#111919]">
                <Search className="w-4 h-4 text-[#0B4F4A]" />
                <span>Third-Party Public URL Inspector</span>
              </div>
              <p className="text-xs text-[#526362] leading-relaxed">
                Want to inspect a specific public repository or another developer’s GitHub URL without connecting it as your own identity?
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/app/inspector')}
                className="text-xs font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
              >
                <span>Open Public URL Inspector</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white border border-[#E2E8E7] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#111919]">
                <Briefcase className="w-4 h-4 text-[#D97706]" />
                <span>Job Description Readiness</span>
              </div>
              <p className="text-xs text-[#526362] leading-relaxed">
                Compare any public GitHub URL against required and preferred skills in a job description.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/app/job-match')}
                className="text-xs font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
              >
                <span>Open Job Matcher</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* POPULATED DEVELOPER WORKSPACE WHEN GITHUB IS CONNECTED */
        <div className="space-y-8">
          {/* 4-Metric Connected Evidence Strip */}
          <section className="bg-white border border-[#E2E8E7] rounded-xl p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
              <div>
                <div className="text-[#526362]">Connected GitHub Account</div>
                <div className="mt-1 text-lg font-bold font-mono text-[#0B4F4A]">
                  @{user.githubUsername}
                </div>
                <div className="mt-0.5 text-[#526362]">
                  {user.isPublicProfile ? 'Public Dossier Published' : 'Private Workspace'}
                </div>
              </div>

              <div>
                <div className="text-[#526362]">Original Repositories</div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#111919]">
                  {originalReposCount}
                </div>
                <div className="mt-0.5 text-[#526362]">
                  <span className="font-mono font-semibold text-[#B45309]">
                    {forkedReposCount}
                  </span>{' '}
                  forks isolated
                </div>
              </div>

              <div>
                <div className="text-[#526362]">Attributed Commits</div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#111919]">
                  {totalAttributedCommits}
                </div>
                <div className="mt-0.5 text-[#526362]">
                  Across non-forked source trees
                </div>
              </div>

              <div>
                <div className="text-[#526362]">Verified Technologies</div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#0B4F4A]">
                  {verifiedSkillsCount}{' '}
                  <span className="text-sm font-normal text-[#526362]">
                    / {user.skillAssessments.length}
                  </span>
                </div>
                <div className="mt-0.5 text-[#526362]">
                  Strong or Moderate evidence
                </div>
              </div>
            </div>
          </section>

          {/* Target Role Alignment & Gap Analysis */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#E2E8E7]">
                <div>
                  <div className="text-xs font-mono text-[#0B4F4A]">
                    Career Goal Alignment
                  </div>
                  <h2 className="text-base font-bold text-[#111919] mt-0.5">
                    Evidence vs. {devPrefs.targetRole} Core Expectations
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/app/skills')}
                  className="text-xs font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
                >
                  <span>Full Skill Matrix ({user.skillAssessments.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <div className="font-semibold text-[#0B4F4A] flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>
                      Verified {devPrefs.targetRole} Strengths (
                      {targetRoleGapAnalysis.verifiedStrengths.length})
                    </span>
                  </div>
                  {targetRoleGapAnalysis.verifiedStrengths.length === 0 ? (
                    <p className="text-[#526362]">
                      None of the default {devPrefs.targetRole} core skills have reached Strong or Moderate evidence yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {targetRoleGapAnalysis.verifiedStrengths.map((item) => (
                        <div key={item.skillName} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#111919]">
                              {item.skillName}
                            </span>
                            <span className="font-mono font-semibold text-[#0B4F4A]">
                              {item.score}/100 ({item.band})
                            </span>
                          </div>
                          <EvidenceMeterBar
                            score={item.score}
                            max={100}
                            tone="teal"
                            showValue={false}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="font-semibold text-[#B45309] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                    <span>
                      Evidence Gaps &amp; Limitations ({targetRoleGapAnalysis.gapsOrWeak.length})
                    </span>
                  </div>
                  {targetRoleGapAnalysis.gapsOrWeak.length === 0 ? (
                    <p className="text-[#0B4F4A]">
                      All core skills for {devPrefs.targetRole} have strong or moderate public code evidence!
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {targetRoleGapAnalysis.gapsOrWeak.map((gap) => (
                        <div
                          key={gap.skillName}
                          className="p-2.5 bg-[#F8F9F8] border border-[#E2E8E7] rounded-lg space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#111919]">
                              {gap.skillName}
                            </span>
                            <span className="font-mono text-[11px] text-[#B45309]">
                              {gap.band}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#526362]">{gap.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Top Observed Skills & Secondary Tools */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#111919]">
                    Strongest Detected Skills
                  </h2>
                  <button
                    type="button"
                    onClick={() => onNavigate('/app/repositories')}
                    className="text-xs font-semibold text-[#0B4F4A] hover:underline"
                  >
                    Inspect {user.normalizedRepositories.length} Repos →
                  </button>
                </div>

                <div className="divide-y divide-[#E2E8E7] text-xs">
                  {user.skillAssessments.slice(0, 5).map((sk) => (
                    <div
                      key={sk.skillName}
                      className="py-2.5 flex items-center justify-between gap-4"
                    >
                      <div>
                        <span className="font-semibold text-[#111919]">{sk.skillName}</span>
                        <span className="ml-2 text-[11px] text-[#526362]">
                          {sk.evidenceBand}
                        </span>
                      </div>
                      <span className="font-mono font-semibold tabular-nums text-[#0B4F4A]">
                        {sk.evidenceScore}/100
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Secondary Tool: Public GitHub URL Inspector */}
              <div className="bg-[#EEF6F5] border border-[#CBE0DD] rounded-xl p-5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0B4F4A] flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4" />
                    <span>Secondary Tool: Public GitHub URL Inspector</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#526362]">
                    {publicAnalyses.length} recent scans
                  </span>
                </div>
                <p className="text-[#263333] leading-relaxed">
                  Inspect any standalone public repository or external GitHub profile without overwriting your connected <code className="font-mono">@{user.githubUsername}</code> workspace.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('/app/inspector')}
                  className="font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
                >
                  <span>Inspect a Public Repository or Profile URL</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* Saved Job Descriptions & Recent Public Analyses */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#111919]">
                  Saved Job Description Comparisons ({ user.jobMatchReports.length })
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/app/job-match')}
                  className="text-xs font-semibold text-[#0B4F4A] hover:underline"
                >
                  Compare New JD →
                </button>
              </div>

              {user.jobMatchReports.length === 0 ? (
                <p className="text-xs text-[#526362] py-4">
                  No job descriptions saved yet. Add a target job description to calculate your readiness score and uncover missing requirements.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E8E7] text-xs">
                  {user.jobMatchReports.slice(0, 4).map((rep) => (
                    <div
                      key={rep.jobDescription.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="font-semibold text-[#111919]">
                          {rep.jobDescription.title}
                        </div>
                        <div className="text-[11px] text-[#526362]">
                          {rep.guidanceClassification} · {rep.jobDescription.roleCategory}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-bold text-sm text-[#0B4F4A]">
                          {rep.matchScore}%
                        </span>
                        <button
                          type="button"
                          onClick={() => onNavigate('/app/job-match')}
                          className="text-[#0B4F4A] font-semibold hover:underline"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#111919] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0B4F4A]" />
                  <span>Best-Fit Engineering Role Categories</span>
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/app/job-match')}
                  className="text-xs font-semibold text-[#0B4F4A] hover:underline"
                >
                  View Role Details →
                </button>
              </div>

              {user.roleRecommendations.length === 0 ? (
                <p className="text-xs text-[#526362] py-4">
                  Connect repositories with authored source commits to generate role recommendations.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E8E7] text-xs">
                  {user.roleRecommendations.slice(0, 4).map((role) => (
                    <div
                      key={role.roleId}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="font-semibold text-[#111919]">{role.roleTitle}</div>
                        <div className="text-[11px] text-[#526362]">
                          {role.fitClassification} · Supported:{' '}
                          {role.wellSupportedRequirements.slice(0, 3).join(', ') || 'None'}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm text-[#0B4F4A] shrink-0">
                        {role.alignmentScore}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
