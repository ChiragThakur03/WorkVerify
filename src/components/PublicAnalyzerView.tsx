import React, { useState, useEffect } from 'react';
import {
  Search,
  GitCommit,
  FileCode2,
  ExternalLink,
  AlertTriangle,
  FolderGit2,
  ArrowRight,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Briefcase,
  ClipboardCheck,
} from 'lucide-react';
import {
  SingleRepositoryInspectionReport,
  NormalizedRepository,
  SkillAssessmentResult,
  RoleRecommendationItem,
  PublicAnalysisHistoryItem,
  EvidenceBand,
} from '../types/workverify';
import { apiFetch } from '../lib/apiClient';
import {
  EvidenceMeterBar,
} from './VisualAssets';

interface PublicProfileReport {
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  profileUrl: string;
  normalizedRepositories: NormalizedRepository[];
  skillAssessments: SkillAssessmentResult[];
  roleRecommendations: RoleRecommendationItem[];
  analyzedAt: string;
}

interface PublicAnalyzerViewProps {
  initialUrl?: string;
  isAuthenticated: boolean;
  recentAnalyses: PublicAnalysisHistoryItem[];
  onAnalysisRecorded: (history: PublicAnalysisHistoryItem[]) => void;
  onOpenInRecruiterAssessment: (targetUrl: string) => void;
  onOpenInApplicantMatcher: (targetUrl: string) => void;
  onSaveToWorkspace: (targetUrl: string) => Promise<void>;
  onNavigate: (path: string) => void;
}

type AnalysisTab = 'overview' | 'skills' | 'repositories' | 'contributions' | 'job-match';

function getBandTone(band: EvidenceBand): 'teal' | 'muted' | 'amber' | 'neutral' {
  switch (band) {
    case 'Strong Evidence':
      return 'teal';
    case 'Moderate Evidence':
      return 'muted';
    case 'Weak Evidence':
      return 'amber';
    default:
      return 'neutral';
  }
}

function getBandTextClass(band: EvidenceBand): string {
  switch (band) {
    case 'Strong Evidence':
      return 'text-[#0B4F4A] font-semibold';
    case 'Moderate Evidence':
      return 'text-[#188078] font-medium';
    case 'Weak Evidence':
      return 'text-[#B45309] font-medium';
    default:
      return 'text-[#526362]';
  }
}

import { parseGitHubTargetUrl } from '../lib/jobMatchEngine';

function classifyGitHubInput(raw: string): {
  valid: boolean;
  kind: 'empty' | 'repository' | 'profile' | 'invalid';
  normalizedLabel: string;
  validationMessage?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, kind: 'empty', normalizedLabel: '' };
  }

  const parsed = parseGitHubTargetUrl(trimmed);
  if (!parsed.valid) {
    return {
      valid: false,
      kind: 'invalid',
      normalizedLabel: '',
      validationMessage:
        parsed.error ||
        'Enter a valid GitHub profile (https://github.com/username) or repository URL (https://github.com/owner/repository).',
    };
  }

  if (parsed.type === 'repository' && parsed.owner && parsed.repo) {
    return {
      valid: true,
      kind: 'repository',
      normalizedLabel: `${parsed.owner}/${parsed.repo}`,
    };
  }

  return {
    valid: true,
    kind: 'profile',
    normalizedLabel: `@${parsed.owner}`,
  };
}

export const PublicAnalyzerView: React.FC<PublicAnalyzerViewProps> = ({
  initialUrl,
  isAuthenticated,
  recentAnalyses,
  onAnalysisRecorded,
  onOpenInRecruiterAssessment,
  onOpenInApplicantMatcher,
  onSaveToWorkspace,
  onNavigate,
}) => {
  const [targetUrl, setTargetUrl] = useState(initialUrl || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    limit: number;
    remaining: number;
    resetAt: string;
  } | null>(null);

  const [resultType, setResultType] = useState<'repository' | 'profile' | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState<string>('');
  const [singleRepoReport, setSingleRepoReport] =
    useState<SingleRepositoryInspectionReport | null>(null);
  const [profileReport, setProfileReport] = useState<PublicProfileReport | null>(null);

  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const inputClassification = classifyGitHubInput(targetUrl);

  const runPublicAnalysis = async (urlToAnalyze: string, forceRefresh = false) => {
    const trimmed = urlToAnalyze.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a public GitHub profile or repository URL to analyze.');
      return;
    }

    const check = classifyGitHubInput(trimmed);
    if (!check.valid) {
      setErrorMsg(
        check.validationMessage ||
          'Please enter a valid public GitHub profile or repository URL.'
      );
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setWarnings([]);
    setSavedToast(false);
    try {
      const res = await apiFetch('/api/public/analyze', {
        method: 'POST',
        body: JSON.stringify({ targetUrl: trimmed, forceRefresh }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze public GitHub target.');
      }

      setAnalyzedUrl(data.targetUrl || trimmed);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      if (data.rateLimit) {
        setRateLimitInfo(data.rateLimit);
      }
      if (data.publicAnalyses) {
        onAnalysisRecorded(data.publicAnalyses);
      }

      setActiveTab('overview');
      setExpandedSkill(null);

      if (data.targetType === 'repository' && data.singleRepoReport) {
        setResultType('repository');
        setSingleRepoReport(data.singleRepoReport);
        setProfileReport(null);
      } else if (data.targetType === 'profile' && data.profileReport) {
        setResultType('profile');
        setProfileReport(data.profileReport);
        setSingleRepoReport(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not inspect the requested GitHub URL.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (initialUrl && initialUrl.trim()) {
      setTargetUrl(initialUrl);
      void runPublicAnalysis(initialUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  const handleSaveResultToWorkspace = async () => {
    if (!analyzedUrl) return;
    if (!isAuthenticated) {
      onNavigate('/login');
      return;
    }
    setIsSavingWorkspace(true);
    try {
      await onSaveToWorkspace(analyzedUrl);
      setSavedToast(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save analysis to workspace.');
    } finally {
      setIsSavingWorkspace(false);
    }
  };

  // Helper to render expandable skill rows with progressive disclosure
  const renderProgressiveSkillList = (skills: SkillAssessmentResult[]) => {
    if (skills.length === 0) {
      return (
        <div className="py-8 text-center text-xs text-[#526362]">
          No supported technologies were detected in the inspected source tree.
        </div>
      );
    }

    return (
      <div className="divide-y divide-[#E2E8E7]">
        {skills.map((skill) => {
          const isExpanded = expandedSkill === skill.skillName;
          const summaryLine =
            skill.positiveSignals[0] ||
            skill.missingOrWeakSignals[0] ||
            'Observed in repository signals.';

          return (
            <div key={skill.skillName} className="py-4">
              <button
                type="button"
                onClick={() =>
                  setExpandedSkill(isExpanded ? null : skill.skillName)
                }
                className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#111919] group-hover:text-[#0B4F4A] transition-colors">
                      {skill.skillName}
                    </span>
                    <span className={`text-xs ${getBandTextClass(skill.evidenceBand)}`}>
                      {skill.evidenceBand}
                    </span>
                    <span className="text-xs font-mono text-[#526362]">
                      {skill.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#526362] truncate max-w-2xl">
                    {summaryLine}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0 sm:w-56">
                  <div className="flex-1">
                    <EvidenceMeterBar
                      score={skill.evidenceScore}
                      max={100}
                      tone={getBandTone(skill.evidenceBand)}
                      showValue={false}
                    />
                  </div>
                  <span className="text-xs font-mono font-semibold tabular-nums text-[#111919] w-12 text-right">
                    {skill.evidenceScore}/100
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#526362]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#526362]" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-[#E2E8E7] bg-[#F8F9F8] rounded-xl p-4 space-y-4 text-xs">
                  {/* 5-Signal Formula Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <EvidenceMeterBar
                        label="Manifest"
                        score={skill.breakdown.manifestSignal}
                        max={15}
                        tone="muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <EvidenceMeterBar
                        label="Source Files"
                        score={skill.breakdown.sourceFilesSignal}
                        max={25}
                        tone="teal"
                      />
                    </div>
                    <div className="space-y-1">
                      <EvidenceMeterBar
                        label="Commits"
                        score={skill.breakdown.attributedWorkSignal}
                        max={30}
                        tone="teal"
                      />
                    </div>
                    <div className="space-y-1">
                      <EvidenceMeterBar
                        label="Multi-Repo"
                        score={skill.breakdown.multiRepoConsistency}
                        max={15}
                        tone="muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <EvidenceMeterBar
                        label="Recency"
                        score={skill.breakdown.recencyAndContinuity}
                        max={15}
                        tone="amber"
                      />
                    </div>
                  </div>

                  {/* Positive & Missing Signals */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {skill.positiveSignals.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-semibold text-[#0B4F4A]">
                          Supporting Evidence
                        </div>
                        <ul className="space-y-1 text-[#263333]">
                          {skill.positiveSignals.map((sig, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-[#0B4F4A] shrink-0 mt-0.5" />
                              <span>{sig}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {skill.missingOrWeakSignals.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-semibold text-[#B45309]">
                          Limitations &amp; Missing Signals
                        </div>
                        <ul className="space-y-1 text-[#526362]">
                          {skill.missingOrWeakSignals.map((sig, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
                              <span>{sig}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Supporting Repositories & Commits */}
                  {(skill.supportingRepos.length > 0 ||
                    skill.supportingCommits.length > 0) && (
                    <div className="pt-3 border-t border-[#E2E8E7] flex flex-wrap items-center gap-4">
                      {skill.supportingRepos.map((sr) => (
                        <a
                          key={sr.fullName}
                          href={sr.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-[#0B4F4A] hover:underline"
                        >
                          <FolderGit2 className="w-3.5 h-3.5" />
                          <span>
                            {sr.repoName}{' '}
                            <span className="opacity-80">
                              ({sr.matchingFilesCount > 0
                                ? `${sr.matchingFilesCount} code ${sr.matchingFilesCount === 1 ? 'file' : 'files'}`
                                : sr.manifestNames.length > 0
                                ? `manifest: ${sr.manifestNames[0]}`
                                : '0 files'}
                              , {sr.attributedCommitsCount} {sr.attributedCommitsCount === 1 ? 'commit' : 'commits'})
                            </span>
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                      {skill.supportingCommits.slice(0, 3).map((sc) => (
                        <a
                          key={sc.sha}
                          href={sc.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-[#263333] hover:text-[#0B4F4A] hover:underline"
                        >
                          <GitCommit className="w-3.5 h-3.5 text-[#188078]" />
                          <span>
                            {sc.shortSha}: {sc.message.slice(0, 42)}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Focused Tool Header & Single Prominent URL Input */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8E7]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#0B4F4A]">
              <span>Public URL Inspector</span>
              <span>·</span>
              <span className="text-[#526362]">
                {isAuthenticated
                  ? 'Standalone Evidence Lookup (Does not overwrite your workspace)'
                  : 'Read-Only GitHub Evidence Verification'}
              </span>
              {rateLimitInfo && (
                <>
                  <span>·</span>
                  <span className="text-[#526362]">
                    GitHub API Quota: {rateLimitInfo.remaining}/{rateLimitInfo.limit}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111919]">
              Inspect a Public GitHub Profile or Repository URL
            </h1>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(isAuthenticated ? '/app' : '/')}
            className="px-3.5 py-2 text-xs font-semibold text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg transition-colors self-start sm:self-center shrink-0"
          >
            {isAuthenticated ? '← Back to Workspace' : '← Back to Home'}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runPublicAnalysis(targetUrl);
          }}
          className="space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <label
              htmlFor="public-github-url-input"
              className="font-semibold text-[#111919]"
            >
              GitHub Profile or Repository URL
            </label>
            {inputClassification.kind === 'repository' && (
              <span className="font-mono text-[11px] font-semibold text-[#0B4F4A] bg-[#EEF6F5] px-2.5 py-0.5 rounded">
                Detected Repository: {inputClassification.normalizedLabel}
              </span>
            )}
            {inputClassification.kind === 'profile' && (
              <span className="font-mono text-[11px] font-semibold text-[#0B4F4A] bg-[#EEF6F5] px-2.5 py-0.5 rounded">
                Detected Profile: {inputClassification.normalizedLabel}
              </span>
            )}
            {inputClassification.kind === 'invalid' && (
              <span className="font-mono text-[11px] font-medium text-[#B45309]">
                Invalid GitHub URL format
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#526362] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="public-github-url-input"
                type="text"
                value={targetUrl}
                onChange={(e) => {
                  setTargetUrl(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="https://github.com/owner/repository or https://github.com/username"
                className="w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-2"
            >
              <span>
                {isAnalyzing ? 'Analyzing GitHub Evidence...' : 'Analyze URL'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-[#526362]">
            Accepts any public GitHub profile (<code className="font-mono">https://github.com/username</code>) or repository (<code className="font-mono">https://github.com/owner/repo</code>). Inspects source files, dependency manifests, fork isolation, and commit attribution live via the GitHub REST API.
          </p>
        </form>

        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg flex items-start gap-2.5 text-xs text-[#991B1B]"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="p-3.5 bg-[#FBF7EE] border border-[#F3E3C3] rounded-lg text-xs text-[#92400E] space-y-1">
            {warnings.map((w, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Loading Skeleton */}
      {isAnalyzing && (
        <section className="bg-white border border-[#E2E8E7] rounded-xl p-8 space-y-5 animate-pulse">
          <div className="h-5 w-56 bg-[#EEF6F5] rounded" />
          <div className="h-3 w-80 bg-[#F2F5F4] rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 border-t border-[#E2E8E7]">
            <div className="h-14 bg-[#F8F9F8] rounded-lg" />
            <div className="h-14 bg-[#F8F9F8] rounded-lg" />
            <div className="h-14 bg-[#F8F9F8] rounded-lg" />
            <div className="h-14 bg-[#F8F9F8] rounded-lg" />
          </div>
        </section>
      )}

      {/* Compact Tool Empty State (No Marketing Hero or Fabricated Profiles) */}
      {!resultType && !isAnalyzing && (
        <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 sm:p-8 space-y-5">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[#111919]">
              No URL analyzed in this view yet
            </h2>
            <p className="text-xs text-[#526362]">
              Paste a public GitHub profile or repository URL above and click <strong>Analyze URL</strong> to inspect real code evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#E2E8E7] text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-[#0B4F4A] flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Repository Inspection</span>
              </div>
              <p className="text-[#526362] leading-relaxed">
                Evaluates a single repository’s source tree, manifest dependencies, test/CI signals, and owner commit attribution ratio.
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-[#0B4F4A] flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Profile Inspection</span>
              </div>
              <p className="text-[#526362] leading-relaxed">
                Aggregates original vs. forked repositories across a public developer profile and computes 5-signal skill evidence scores.
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-[#0B4F4A] flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Downstream Evaluation</span>
              </div>
              <p className="text-[#526362] leading-relaxed">
                Send any analyzed URL directly into Job Description Readiness or Recruiter Candidate Assessment in one click.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* SINGLE REPOSITORY ANALYSIS OUTPUT — Summary Strip + Navigable Tabs */}
      {resultType === 'repository' && singleRepoReport && !isAnalyzing && (
        <section className="bg-white border border-[#E2E8E7] rounded-xl overflow-hidden">
          {/* Essential Top Summary */}
          <div className="p-6 border-b border-[#E2E8E7] space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <span
                    className={`font-medium ${
                      singleRepoReport.repository.isFork
                        ? 'text-[#B45309]'
                        : 'text-[#0B4F4A]'
                    }`}
                  >
                    {singleRepoReport.repository.isFork
                      ? 'Forked Repository (Isolated)'
                      : 'Original Repository'}
                  </span>
                  <span className="text-[#CBD5D4]">·</span>
                  <span className="font-mono text-[#526362]">
                    @{singleRepoReport.ownerLogin}
                  </span>
                  {singleRepoReport.repository.primaryLanguage && (
                    <>
                      <span className="text-[#CBD5D4]">·</span>
                      <span className="text-[#526362]">
                        {singleRepoReport.repository.primaryLanguage}
                      </span>
                    </>
                  )}
                </div>

                <h2 className="text-xl font-bold font-mono text-[#111919]">
                  {singleRepoReport.repository.fullName}
                </h2>
                <p className="text-xs text-[#526362] max-w-2xl">
                  {singleRepoReport.repository.description ||
                    'No repository description provided.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={singleRepoReport.repository.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-medium text-[#263333] border border-[#CBD5D4] hover:bg-[#F8F9F8] rounded-lg inline-flex items-center gap-1.5"
                >
                  <span>GitHub Source</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  disabled={isSavingWorkspace}
                  onClick={() => void handleSaveResultToWorkspace()}
                  className="px-3 py-1.5 text-xs font-medium text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg inline-flex items-center gap-1.5"
                >
                  {savedToast ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#0B4F4A]" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>{isAuthenticated ? 'Save to Workspace' : 'Sign In to Save'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInRecruiterAssessment(analyzedUrl)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5"
                >
                  <span>Recruiter Assessment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Key Evidence Indicators Strip (No Nested Boxes) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 border-t border-[#E2E8E7] text-xs">
              <div>
                <div className="text-[#526362]">Detected Technologies</div>
                <div className="text-sm font-semibold text-[#111919] mt-1 truncate">
                  {singleRepoReport.skillAssessments
                    .slice(0, 4)
                    .map((s) => s.skillName)
                    .join(', ') || 'None detected'}
                </div>
              </div>
              <div>
                <div className="text-[#526362]">Owner Commit Attribution</div>
                <div className="text-sm font-mono font-semibold text-[#0B4F4A] mt-1">
                  {singleRepoReport.ownershipVsAttribution.ownerAttributedCommits}/
                  {singleRepoReport.ownershipVsAttribution.totalCommitsSampled} commits (
                  {singleRepoReport.ownershipVsAttribution.ownerAttributionRatio}%)
                </div>
              </div>
              <div>
                <div className="text-[#526362]">Meaningful Source Files</div>
                <div className="text-sm font-mono font-semibold text-[#111919] mt-1">
                  {singleRepoReport.repository.meaningfulFilePaths.length} files
                </div>
              </div>
              <div>
                <div className="text-[#526362]">Engineering Signals</div>
                <div className="text-sm font-medium text-[#111919] mt-1">
                  {[
                    singleRepoReport.projectStructureSignals.hasTests && 'Tests',
                    singleRepoReport.projectStructureSignals.hasCiCd && 'CI/CD',
                    singleRepoReport.projectStructureSignals.hasContainerConfig && 'Docker',
                    singleRepoReport.projectStructureSignals.hasTypeConfig && 'Strict Types',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Standard source tree'}
                </div>
              </div>
            </div>
          </div>

          {/* Navigable Tabs */}
          <div className="border-b border-[#E2E8E7] bg-[#F8F9F8] px-6 flex items-center gap-6 overflow-x-auto">
            {(
              [
                ['overview', 'Overview'],
                ['skills', `Skills & Evidence (${singleRepoReport.skillAssessments.length})`],
                ['repositories', 'Repository Structure'],
                ['contributions', `Contributions (${singleRepoReport.repository.commits.length})`],
                ['job-match', 'Job Match'],
              ] as const
            ).map(([tabId, label]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tabId
                    ? 'border-[#0B4F4A] text-[#0B4F4A]'
                    : 'border-transparent text-[#526362] hover:text-[#111919]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="p-4 bg-[#EEF6F5] border border-[#CBE0DD] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[#0B4F4A]">
                      Ownership vs. Commit Attribution
                    </div>
                    <p className="text-xs text-[#263333]">
                      {singleRepoReport.ownershipVsAttribution.ownershipNote}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('skills')}
                    className="text-xs font-semibold text-[#0B4F4A] hover:underline shrink-0"
                  >
                    Expand all {singleRepoReport.skillAssessments.length} skills →
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#111919] mb-2">
                    Top Observed Skills (Click any skill to inspect formula &amp; commits)
                  </h3>
                  {renderProgressiveSkillList(
                    singleRepoReport.skillAssessments.slice(0, 5)
                  )}
                </div>
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="space-y-2">
                <p className="text-xs text-[#526362]">
                  Select any skill below to inspect its 5-part evidence breakdown, supporting files, and attributed commits.
                </p>
                {renderProgressiveSkillList(singleRepoReport.skillAssessments)}
              </div>
            )}

            {activeTab === 'repositories' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#111919] flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-[#0B4F4A]" />
                    <span>
                      Meaningful Source Paths (
                      {singleRepoReport.repository.meaningfulFilePaths.length})
                    </span>
                  </h3>
                  <p className="text-[#526362]">
                    {singleRepoReport.repository.excludedVendorFilesCount} generated lockfiles or vendor artifacts were excluded prior to analysis.
                  </p>
                  <div className="p-4 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl font-mono space-y-1.5 max-h-72 overflow-y-auto text-[#263333]">
                    {singleRepoReport.repository.meaningfulFilePaths.map((fp) => (
                      <div key={fp} className="truncate">
                        {fp}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#111919]">
                      Dependency Manifests
                    </h3>
                    <p className="text-[#526362] mt-1">
                      {singleRepoReport.projectStructureSignals.manifestsFound.length > 0
                        ? singleRepoReport.projectStructureSignals.manifestsFound.join(', ')
                        : 'No root dependency manifests detected.'}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-[#E2E8E7]">
                    <h3 className="text-sm font-semibold text-[#111919]">
                      Automated Testing &amp; Tooling
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-[#526362]">
                      <li>
                        • Test Files:{' '}
                        {singleRepoReport.projectStructureSignals.hasTests
                          ? `${singleRepoReport.projectStructureSignals.testFiles.length} detected`
                          : 'None detected'}
                      </li>
                      <li>
                        • CI/CD Workflow:{' '}
                        {singleRepoReport.projectStructureSignals.hasCiCd
                          ? 'Present'
                          : 'Not detected'}
                      </li>
                      <li>
                        • Container Config:{' '}
                        {singleRepoReport.projectStructureSignals.hasContainerConfig
                          ? 'Dockerfile / Compose present'
                          : 'Not detected'}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contributions' && (
              <div className="divide-y divide-[#E2E8E7] text-xs">
                {singleRepoReport.repository.commits.length === 0 ? (
                  <div className="py-6 text-[#526362]">
                    No commits sampled for this repository.
                  </div>
                ) : (
                  singleRepoReport.repository.commits.map((c) => (
                    <div
                      key={c.sha}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <a
                            href={c.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono font-semibold text-[#0B4F4A] hover:underline"
                          >
                            {c.sha.slice(0, 7)}
                          </a>
                          <span className="font-medium text-[#111919]">
                            {c.message}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#526362]">
                          {c.workCategory} · +{c.additions}/-{c.deletions} lines ·{' '}
                          {c.date.slice(0, 10)}
                        </div>
                      </div>

                      <span
                        className={`text-xs font-medium shrink-0 ${
                          c.isCandidateAttributed
                            ? 'text-[#0B4F4A]'
                            : 'text-[#B45309]'
                        }`}
                      >
                        {c.isCandidateAttributed
                          ? `Attributed to @${singleRepoReport.ownerLogin}`
                          : `External Author (${c.authorLogin})`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'job-match' && (
              <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-[#EEF6F5] border border-[#CBE0DD] rounded-xl space-y-3">
                  <Briefcase className="w-5 h-5 text-[#0B4F4A]" />
                  <h3 className="text-base font-semibold text-[#111919]">
                    Applicant Multi-JD Readiness &amp; Role Fit
                  </h3>
                  <p className="text-xs text-[#263333] leading-relaxed">
                    Compare this repository against multiple job descriptions to see supported requirements, gaps, and next steps.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenInApplicantMatcher(analyzedUrl)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5"
                  >
                    <span>Compare with Job Description</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-5 bg-[#FBF7EE] border border-[#F3E3C3] rounded-xl space-y-3">
                  <ClipboardCheck className="w-5 h-5 text-[#D97706]" />
                  <h3 className="text-base font-semibold text-[#111919]">
                    Recruiter Candidate Assessment
                  </h3>
                  <p className="text-xs text-[#263333] leading-relaxed">
                    Evaluate this repository against a specific job description and generate commit-grounded interview prompts.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenInRecruiterAssessment(analyzedUrl)}
                    className="px-4 py-2 text-xs font-semibold text-[#111919] bg-white border border-[#CBD5D4] hover:bg-[#F8F9F8] rounded-lg inline-flex items-center gap-1.5"
                  >
                    <span>Open in Recruiter Assessment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* PROFILE ANALYSIS OUTPUT — Summary Strip + Navigable Tabs */}
      {resultType === 'profile' && profileReport && !isAnalyzing && (
        <section className="bg-white border border-[#E2E8E7] rounded-xl overflow-hidden">
          {/* Essential Top Summary */}
          <div className="p-6 border-b border-[#E2E8E7] space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {profileReport.avatarUrl ? (
                  <img
                    src={profileReport.avatarUrl}
                    alt={profileReport.displayName}
                    className="w-12 h-12 rounded-xl border border-[#E2E8E7] object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#0B4F4A] text-white flex items-center justify-center font-bold text-base">
                    {profileReport.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-[#111919]">
                      {profileReport.displayName}
                    </h2>
                    <span className="text-xs font-mono text-[#526362]">
                      @{profileReport.username}
                    </span>
                  </div>
                  <p className="text-xs text-[#526362] mt-0.5 max-w-2xl">
                    {profileReport.bio || 'Public GitHub Developer Profile'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSavingWorkspace}
                  onClick={() => void handleSaveResultToWorkspace()}
                  className="px-3.5 py-2 text-xs font-medium text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg inline-flex items-center gap-1.5"
                >
                  {savedToast ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#0B4F4A]" />
                      <span>Saved to Workspace</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>{isAuthenticated ? 'Save to Workspace' : 'Sign In to Save'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInApplicantMatcher(analyzedUrl)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#0B4F4A] bg-[#EEF6F5] hover:bg-[#DDECE9] rounded-lg inline-flex items-center gap-1.5"
                >
                  <span>Compare with Job Description</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInRecruiterAssessment(analyzedUrl)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5"
                >
                  <span>Evaluate in Recruiter Mode</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Clean Key Evidence Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 border-t border-[#E2E8E7] text-xs">
              <div>
                <div className="text-[#526362]">Original Repositories</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#111919] mt-0.5">
                  {profileReport.normalizedRepositories.filter((r) => !r.isFork).length}
                </div>
              </div>
              <div>
                <div className="text-[#526362]">Forks Isolated</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#B45309] mt-0.5">
                  {profileReport.normalizedRepositories.filter((r) => r.isFork).length}
                </div>
              </div>
              <div>
                <div className="text-[#526362]">Verified Technologies</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#0B4F4A] mt-0.5">
                  {
                    profileReport.skillAssessments.filter(
                      (s) =>
                        s.evidenceBand === 'Strong Evidence' ||
                        s.evidenceBand === 'Moderate Evidence'
                    ).length
                  }{' '}
                  / {profileReport.skillAssessments.length}
                </div>
              </div>
              <div>
                <div className="text-[#526362]">Best-Fit Role</div>
                <div className="text-sm font-semibold text-[#111919] mt-1 truncate">
                  {profileReport.roleRecommendations[0]?.roleTitle || 'Insufficient Data'}
                </div>
              </div>
            </div>
          </div>

          {/* Navigable Tabs */}
          <div className="border-b border-[#E2E8E7] bg-[#F8F9F8] px-6 flex items-center gap-6 overflow-x-auto">
            {(
              [
                ['overview', 'Overview'],
                ['skills', `Skills & Evidence (${profileReport.skillAssessments.length})`],
                [
                  'repositories',
                  `Repositories (${profileReport.normalizedRepositories.length})`,
                ],
                ['contributions', 'Contributions'],
                ['job-match', 'Job Match & Roles'],
              ] as const
            ).map(([tabId, label]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tabId
                    ? 'border-[#0B4F4A] text-[#0B4F4A]'
                    : 'border-transparent text-[#526362] hover:text-[#111919]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#111919]">
                      Key Skill Evidence (Click any skill to expand supporting details)
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('skills')}
                      className="text-xs font-semibold text-[#0B4F4A] hover:underline"
                    >
                      View all {profileReport.skillAssessments.length} skills →
                    </button>
                  </div>
                  {renderProgressiveSkillList(profileReport.skillAssessments.slice(0, 6))}
                </div>
              </div>
            )}

            {activeTab === 'skills' && (
              <div>
                {renderProgressiveSkillList(profileReport.skillAssessments)}
              </div>
            )}

            {activeTab === 'repositories' && (
              <div className="divide-y divide-[#E2E8E7] text-xs">
                {profileReport.normalizedRepositories.length === 0 ? (
                  <div className="py-6 text-[#526362]">
                    No public repositories found on GitHub.
                  </div>
                ) : (
                  profileReport.normalizedRepositories.map((repo) => (
                    <div
                      key={repo.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-semibold text-sm text-[#111919]">
                            {repo.name}
                          </span>
                          <span
                            className={`text-[11px] font-medium ${
                              repo.isFork ? 'text-[#B45309]' : 'text-[#0B4F4A]'
                            }`}
                          >
                            {repo.isFork ? 'Fork (Isolated)' : 'Original'}
                          </span>
                          {repo.primaryLanguage && (
                            <span className="text-[#526362]">· {repo.primaryLanguage}</span>
                          )}
                        </div>
                        <p className="text-[#526362]">
                          {repo.description || 'No description provided.'}
                        </p>
                        <div className="font-mono text-[11px] text-[#526362]">
                          Attributed Commits:{' '}
                          {repo.commits.filter((c) => c.isCandidateAttributed).length}/
                          {repo.commits.length} · Meaningful Files:{' '}
                          {repo.meaningfulFilePaths.length}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const repoUrl = `https://github.com/${profileReport.username}/${repo.name}`;
                          setTargetUrl(repoUrl);
                          void runPublicAnalysis(repoUrl);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-[#0B4F4A] bg-[#EEF6F5] hover:bg-[#DDECE9] rounded-lg shrink-0 self-start sm:self-center"
                      >
                        Inspect Repo
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'contributions' && (
              <div className="divide-y divide-[#E2E8E7] text-xs">
                {profileReport.normalizedRepositories.flatMap((r) =>
                  r.commits.map((c) => ({ ...c, repoName: r.name }))
                ).length === 0 ? (
                  <div className="py-6 text-[#526362]">
                    No sampled commits available across public repositories.
                  </div>
                ) : (
                  profileReport.normalizedRepositories
                    .flatMap((r) => r.commits.map((c) => ({ ...c, repoName: r.name })))
                    .slice(0, 20)
                    .map((c) => (
                      <div
                        key={`${c.repoName}_${c.sha}`}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <a
                              href={c.htmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono font-semibold text-[#0B4F4A] hover:underline"
                            >
                              {c.sha.slice(0, 7)}
                            </a>
                            <span className="font-mono text-[#526362]">{c.repoName}</span>
                            <span className="text-[#111919] font-medium truncate max-w-lg">
                              {c.message}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`font-mono text-[11px] shrink-0 ${
                            c.isCandidateAttributed ? 'text-[#0B4F4A]' : 'text-[#B45309]'
                          }`}
                        >
                          {c.isCandidateAttributed
                            ? `Attributed (@${c.authorLogin})`
                            : `External (@${c.authorLogin})`}
                        </span>
                      </div>
                    ))
                )}
              </div>
            )}

            {activeTab === 'job-match' && (
              <div className="space-y-6">
                {profileReport.roleRecommendations.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[#111919]">
                      Recommended Role Categories
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profileReport.roleRecommendations.slice(0, 2).map((role) => (
                        <div
                          key={role.roleId}
                          className="p-4 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-[#111919]">
                              {role.roleTitle}
                            </span>
                            <span className="font-mono font-bold text-[#0B4F4A]">
                              {role.alignmentScore}% Fit
                            </span>
                          </div>
                          <p className="text-xs text-[#526362]">{role.whyRecommended}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenInApplicantMatcher(analyzedUrl)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5"
                  >
                    <span>Compare with Job Description</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenInRecruiterAssessment(analyzedUrl)}
                    className="px-4 py-2 text-xs font-semibold text-[#111919] border border-[#CBD5D4] hover:bg-[#F8F9F8] rounded-lg inline-flex items-center gap-1.5"
                  >
                    <span>Open in Recruiter Assessment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Session-Scoped Recent Public Inspections */}
      {recentAnalyses.length > 0 && (
        <section className="pt-2">
          <div className="text-xs font-mono uppercase tracking-wider text-[#526362] mb-3">
            Recent Session Inspections
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentAnalyses.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-white border border-[#E2E8E7] rounded-xl flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-mono font-semibold text-[#111919] truncate">
                    {item.summaryTitle}
                  </div>
                  <div className="text-[11px] text-[#526362] truncate">
                    {item.topSkills.map((t) => t.skillName).join(', ') || 'Analyzed'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTargetUrl(item.targetUrl);
                    void runPublicAnalysis(item.targetUrl);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-[#0B4F4A] bg-[#EEF6F5] hover:bg-[#DDECE9] rounded-md shrink-0"
                >
                  Reload
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
