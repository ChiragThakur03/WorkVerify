import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Compass,
  Plus,
  Trash2,
  Upload,
  Check,
  AlertTriangle,
  FolderGit2,
  SlidersHorizontal,
  X,
  Play,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  UserProfileData,
  ExtractedJobDescription,
  JobDescriptionMatchReport,
  RoleRecommendationItem,
  SupportedSkillCatalogItem,
  ApplicationGuidanceClassification,
} from '../types/workverify';
import { apiFetch } from '../lib/apiClient';
import {
  MatchScoreRing,
  EvidenceMeterBar,
  EmptyInspectionIllustration,
} from './VisualAssets';

interface JobMatchingViewProps {
  user: UserProfileData | null;
  jobDescriptions: ExtractedJobDescription[];
  supportedCatalog: SupportedSkillCatalogItem[];
  initialTargetUrl?: string;
  onAddJobDescription: (rawText: string, title?: string) => Promise<void>;
  onUpdateJobDescription: (
    id: string,
    payload: {
      title?: string;
      requiredSkills?: string[];
      preferredSkills?: string[];
      rawText?: string;
    }
  ) => Promise<void>;
  onDeleteJobDescription: (id: string) => Promise<void>;
}

function getGuidanceTone(classification: ApplicationGuidanceClassification): string {
  switch (classification) {
    case 'Strong Evidence Match':
      return 'text-[#0B4F4A] bg-[#EEF6F5] border-[#CBE0DD]';
    case 'Partial Evidence Match':
      return 'text-[#188078] bg-[#EEF6F5] border-[#CBE0DD]';
    case 'Significant Evidence Gaps':
      return 'text-[#92400E] bg-[#FBF7EE] border-[#F3E3C3]';
    default:
      return 'text-[#526362] bg-[#F2F5F4] border-[#E2E8E7]';
  }
}

export const JobMatchingView: React.FC<JobMatchingViewProps> = ({
  user,
  jobDescriptions,
  supportedCatalog,
  initialTargetUrl,
  onAddJobDescription,
  onUpdateJobDescription,
  onDeleteJobDescription,
}) => {
  const hasConnectedWorkspaceRepos = Boolean(
    user && user.githubConnected && user.normalizedRepositories.length > 0
  );

  const [activeMode, setActiveMode] = useState<'readiness' | 'roles'>('readiness');
  const [targetUrl, setTargetUrl] = useState(
    initialTargetUrl || (user?.githubUsername ? `https://github.com/${user.githubUsername}` : '')
  );

  const [localJds, setLocalJds] = useState<Array<{ rawText: string; title?: string }>>([
    {
      title: 'Full-Stack Product Engineer',
      rawText:
        'Required Qualifications:\n- Strong proficiency in TypeScript and React\n- Experience building backend services with Node.js\n- Familiarity with SQL / PostgreSQL or automated testing\n\nPreferred Qualifications:\n- Experience with Docker & CI/CD or Python',
    },
  ]);
  const [evaluatedReports, setEvaluatedReports] = useState<JobDescriptionMatchReport[]>([]);
  const [evaluatedRoles, setEvaluatedRoles] = useState<RoleRecommendationItem[]>([]);
  const [evaluatedUsername, setEvaluatedUsername] = useState<string>('');
  const [isEvaluatingUrl, setIsEvaluatingUrl] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [selectedJdId, setSelectedJdId] = useState<string>(
    user?.jobMatchReports?.[0]?.jobDescription.id || jobDescriptions[0]?.id || ''
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [newJdTitle, setNewJdTitle] = useState('');
  const [newJdText, setNewJdText] = useState('');
  const [isSavingJd, setIsSavingJd] = useState(false);

  const [showEditRequirements, setShowEditRequirements] = useState(false);
  const [showFullRequirementTable, setShowFullRequirementTable] = useState(false);
  const [skillToAddReq, setSkillToAddReq] = useState('');
  const [skillToAddPref, setSkillToAddPref] = useState('');

  const usingLiveUrlEvaluation = evaluatedReports.length > 0 || !hasConnectedWorkspaceRepos;
  const reports: JobDescriptionMatchReport[] =
    evaluatedReports.length > 0
      ? evaluatedReports
      : hasConnectedWorkspaceRepos
      ? user?.jobMatchReports || []
      : [];
  const roleRecommendations: RoleRecommendationItem[] =
    evaluatedRoles.length > 0
      ? evaluatedRoles
      : hasConnectedWorkspaceRepos
      ? user?.roleRecommendations || []
      : [];

  const activeReport: JobDescriptionMatchReport | undefined =
    reports.find((r) => r.jobDescription.id === selectedJdId) || reports[0];

  const runLiveUrlApplicantEvaluation = async (
    urlToUse?: string,
    jdsToUse?: Array<{ rawText: string; title?: string }>
  ) => {
    const cleanUrl = (urlToUse ?? targetUrl).trim();
    if (!cleanUrl) {
      setEvalError('Please enter a public GitHub profile or repository URL.');
      return;
    }
    setIsEvaluatingUrl(true);
    setEvalError(null);
    try {
      const jdPayload = jdsToUse ?? localJds;
      const res = await apiFetch('/api/applicant/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          targetUrl: cleanUrl,
          jobDescriptions: jdPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to evaluate GitHub URL against job descriptions.');
      }
      setEvaluatedReports(data.jobMatchReports || []);
      setEvaluatedRoles(data.roleRecommendations || []);
      setEvaluatedUsername(data.candidateOverview?.username || data.username || cleanUrl);
      if (data.jobMatchReports?.[0]?.jobDescription?.id) {
        setSelectedJdId(data.jobMatchReports[0].jobDescription.id);
      }
    } catch (err: any) {
      setEvalError(err.message || 'Applicant evaluation failed.');
    } finally {
      setIsEvaluatingUrl(false);
    }
  };

  useEffect(() => {
    if (initialTargetUrl && initialTargetUrl.trim()) {
      setTargetUrl(initialTargetUrl);
      void runLiveUrlApplicantEvaluation(initialTargetUrl, localJds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTargetUrl]);

  const handleUploadJdFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setNewJdText(content);
      if (!newJdTitle.trim()) {
        setNewJdTitle(file.name.replace(/\.(txt|md|json)$/i, '').replace(/[-_]/g, ' '));
      }
    } catch {
      // Ignore file error
    }
  };

  const handleCreateJd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJdText.trim()) return;
    setIsSavingJd(true);
    try {
      if (hasConnectedWorkspaceRepos && evaluatedReports.length === 0) {
        await onAddJobDescription(newJdText, newJdTitle.trim() || undefined);
      } else {
        const nextLocalJds = [
          ...localJds,
          { rawText: newJdText.trim(), title: newJdTitle.trim() || undefined },
        ];
        setLocalJds(nextLocalJds);
        if (targetUrl.trim()) {
          await runLiveUrlApplicantEvaluation(targetUrl, nextLocalJds);
        }
      }
      setNewJdTitle('');
      setNewJdText('');
      setShowAddForm(false);
    } finally {
      setIsSavingJd(false);
    }
  };

  const updateLocalOrSavedJdSkills = async (
    nextReq: string[],
    nextPref: string[]
  ) => {
    if (!activeReport) return;
    if (hasConnectedWorkspaceRepos && evaluatedReports.length === 0) {
      await onUpdateJobDescription(activeReport.jobDescription.id, {
        requiredSkills: nextReq,
        preferredSkills: nextPref,
      });
    } else if (targetUrl.trim()) {
      const syntheticRawText = `Required Qualifications:\n${nextReq
        .map((s) => `- ${s}`)
        .join('\n')}\n\nPreferred Qualifications:\n${nextPref
        .map((s) => `- ${s}`)
        .join('\n')}`;
      const updatedLocalJds = localJds.map((item, idx) =>
        idx === 0 || item.title === activeReport.jobDescription.title
          ? { title: activeReport.jobDescription.title, rawText: syntheticRawText }
          : item
      );
      setLocalJds(updatedLocalJds);
      await runLiveUrlApplicantEvaluation(targetUrl, updatedLocalJds);
    }
  };

  const handleAddRequiredSkillToActive = async () => {
    if (!activeReport || !skillToAddReq) return;
    const currentReq = activeReport.jobDescription.requiredSkills;
    if (currentReq.includes(skillToAddReq)) return;
    const nextReq = [...currentReq, skillToAddReq];
    const nextPref = activeReport.jobDescription.preferredSkills.filter(
      (p) => p !== skillToAddReq
    );
    setSkillToAddReq('');
    await updateLocalOrSavedJdSkills(nextReq, nextPref);
  };

  const handleRemoveRequiredSkillFromActive = async (skill: string) => {
    if (!activeReport) return;
    const nextReq = activeReport.jobDescription.requiredSkills.filter((s) => s !== skill);
    const currentPref = activeReport.jobDescription.preferredSkills;
    await updateLocalOrSavedJdSkills(nextReq, currentPref);
  };

  const handleAddPreferredSkillToActive = async () => {
    if (!activeReport || !skillToAddPref) return;
    const currentPref = activeReport.jobDescription.preferredSkills;
    const currentReq = activeReport.jobDescription.requiredSkills;
    if (currentPref.includes(skillToAddPref) || currentReq.includes(skillToAddPref)) return;
    setSkillToAddPref('');
    await updateLocalOrSavedJdSkills(currentReq, [...currentPref, skillToAddPref]);
  };

  const handleRemovePreferredSkillFromActive = async (skill: string) => {
    if (!activeReport) return;
    const nextPref = activeReport.jobDescription.preferredSkills.filter((s) => s !== skill);
    const currentReq = activeReport.jobDescription.requiredSkills;
    await updateLocalOrSavedJdSkills(currentReq, nextPref);
  };

  return (
    <div className="space-y-8">
      {/* Header & Target GitHub Input */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#0B4F4A]">
              <span>Applicant Job Match &amp; Role Readiness</span>
              {(evaluatedUsername || user?.githubUsername) && (
                <>
                  <span>·</span>
                  <span>
                    {(evaluatedUsername || user?.githubUsername || '')
                      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
                      .replace(/^@/, '')}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111919] mt-1">
              Compare GitHub Evidence Against Job Descriptions
            </h1>
          </div>

          <div className="inline-flex items-center p-1 bg-[#F8F9F8] border border-[#E2E8E7] rounded-lg self-start">
            <button
              type="button"
              onClick={() => setActiveMode('readiness')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 ${
                activeMode === 'readiness'
                  ? 'bg-[#0B4F4A] text-white'
                  : 'text-[#526362] hover:text-[#111919]'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Job Readiness ({reports.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('roles')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 ${
                activeMode === 'roles'
                  ? 'bg-[#0B4F4A] text-white'
                  : 'text-[#526362] hover:text-[#111919]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Best-Matching Roles ({roleRecommendations.length})</span>
            </button>
          </div>
        </div>

        {/* Target URL Input Bar */}
        <div className="pt-4 border-t border-[#E2E8E7] flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor="applicant-github-url"
              className="block text-xs font-medium text-[#526362] mb-1.5"
            >
              GitHub Profile or Repository URL to Evaluate
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#526362] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="applicant-github-url"
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://github.com/username or https://github.com/owner/repository"
                className="w-full pl-10 pr-3 py-2.5 text-sm font-mono bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={isEvaluatingUrl}
            onClick={() => void runLiveUrlApplicantEvaluation()}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg inline-flex items-center gap-2 shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {isEvaluatingUrl
                ? 'Analyzing GitHub Evidence...'
                : 'Evaluate Against Job Descriptions'}
            </span>
          </button>
        </div>

        {evalError && (
          <div
            role="alert"
            className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{evalError}</span>
          </div>
        )}
      </section>

      {/* Best-Matching Roles Strip (Always visible when available or in Roles Mode) */}
      {activeMode === 'roles' ? (
        <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#111919]">
              Recommended Engineering Role Categories
            </h2>
            <p className="text-xs text-[#526362] mt-0.5">
              Ranked by verified source files and attributed commits across original repositories.
            </p>
          </div>

          {roleRecommendations.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <EmptyInspectionIllustration />
              <p className="text-xs text-[#526362]">
                Enter a GitHub profile or repository URL above and click{' '}
                <strong>Evaluate Against Job Descriptions</strong> to discover suitable roles.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8E7]">
              {roleRecommendations.map((role: RoleRecommendationItem, idx: number) => (
                <div
                  key={role.roleId}
                  className="py-6 first:pt-2 last:pb-2 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                >
                  <div className="lg:col-span-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-[#0B4F4A] font-semibold">#{idx + 1}</span>
                      <span className="text-[#526362]">·</span>
                      <span
                        className={
                          role.fitClassification === 'Strong Fit'
                            ? 'text-[#0B4F4A] font-semibold'
                            : role.fitClassification === 'Moderate Fit'
                            ? 'text-[#188078]'
                            : 'text-[#B45309]'
                        }
                      >
                        {role.fitClassification}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#111919]">
                      {role.roleTitle}
                    </h3>
                    <div className="pt-1 max-w-[200px]">
                      <EvidenceMeterBar
                        label="Role Fit"
                        score={role.alignmentScore}
                        max={100}
                        tone={
                          role.fitClassification === 'Strong Fit'
                            ? 'teal'
                            : role.fitClassification === 'Moderate Fit'
                            ? 'muted'
                            : 'amber'
                        }
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-8 space-y-4 text-xs">
                    <p className="text-[#263333] leading-relaxed">
                      {role.whyRecommended}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E2E8E7]">
                      <div>
                        <div className="font-semibold text-[#0B4F4A] mb-1.5">
                          Supported Skills
                        </div>
                        <ul className="space-y-1 text-[#263333]">
                          {role.wellSupportedRequirements.map((w) => (
                            <li key={w} className="flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-[#0B4F4A] shrink-0" />
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="font-semibold text-[#B45309] mb-1.5">
                          Important Gaps &amp; Next Action
                        </div>
                        {role.importantGaps.length > 0 ? (
                          <ul className="space-y-1 text-[#526362]">
                            {role.importantGaps.map((g) => (
                              <li key={g} className="flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
                                <span>{g}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-[#0B4F4A]">
                            All core skills for this role category are supported.
                          </div>
                        )}
                        {role.readinessImprovements[0] && (
                          <p className="mt-2 text-[#263333] bg-[#FBF7EE] px-3 py-2 rounded-lg">
                            {role.readinessImprovements[0]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          {/* Job Description Selector & Add JD Form */}
          <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#111919]">
                  Compared Job Descriptions
                </h2>
                <p className="text-xs text-[#526362]">
                  Select a job description to inspect your match score, supported skills, and gaps.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3.5 py-2 text-xs font-semibold text-[#0B4F4A] bg-[#EEF6F5] hover:bg-[#DDECE9] rounded-lg inline-flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddForm ? 'Close JD Form' : 'Add Job Description'}</span>
              </button>
            </div>

            {showAddForm && (
              <form
                onSubmit={handleCreateJd}
                className="p-5 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[#111919]">
                    New Job Description
                  </div>
                  <label className="text-xs font-semibold text-[#0B4F4A] hover:underline cursor-pointer inline-flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File (.txt / .md)</span>
                    <input
                      type="file"
                      accept=".txt,.md,.json"
                      onChange={handleUploadJdFile}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label
                    htmlFor="applicant-new-jd-title"
                    className="block text-xs font-medium text-[#526362] mb-1"
                  >
                    Job Title (Optional)
                  </label>
                  <input
                    id="applicant-new-jd-title"
                    type="text"
                    value={newJdTitle}
                    onChange={(e) => setNewJdTitle(e.target.value)}
                    placeholder="e.g., Full-Stack Platform Engineer"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5D4] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="applicant-new-jd-text"
                    className="block text-xs font-medium text-[#526362] mb-1"
                  >
                    Job Description Text
                  </label>
                  <textarea
                    id="applicant-new-jd-text"
                    rows={4}
                    value={newJdText}
                    onChange={(e) => setNewJdText(e.target.value)}
                    placeholder="Paste required qualifications, preferred skills, and responsibilities..."
                    className="w-full p-3 text-xs bg-white border border-[#CBD5D4] rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-[#526362] bg-white border border-[#CBD5D4] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingJd || !newJdText.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg"
                  >
                    {isSavingJd ? 'Comparing...' : 'Extract & Compare'}
                  </button>
                </div>
              </form>
            )}

            {reports.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <EmptyInspectionIllustration />
                <p className="text-xs text-[#526362] max-w-md mx-auto">
                  Enter your public GitHub URL above and click{' '}
                  <strong>Evaluate Against Job Descriptions</strong> to generate your readiness report.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {reports.map((rep, index) => {
                  const isSelected = activeReport?.jobDescription.id === rep.jobDescription.id;
                  return (
                    <div
                      key={rep.jobDescription.id}
                      onClick={() => setSelectedJdId(rep.jobDescription.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-colors flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'bg-[#EEF6F5] border-[#0B4F4A]'
                          : 'bg-white border-[#E2E8E7] hover:border-[#CBD5D4]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-mono text-[#0B4F4A] font-semibold">
                            Rank #{index + 1} · {rep.jobDescription.roleCategory}
                          </div>
                          <h3 className="text-sm font-semibold text-[#111919] mt-0.5">
                            {rep.jobDescription.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-base font-bold font-mono tabular-nums text-[#0B4F4A]">
                            {rep.matchScore}%
                          </span>
                          {reports.length > 1 && !usingLiveUrlEvaluation && (
                            <button
                              type="button"
                              aria-label={`Delete ${rep.jobDescription.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDeleteJobDescription(rep.jobDescription.id);
                              }}
                              className="p-1 text-[#526362] hover:text-[#B91C1C]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#526362] pt-2 border-t border-[#E2E8E7]">
                        <span>{rep.guidanceClassification}</span>
                        <span className="font-mono">
                          {
                            rep.strongestMatchingAreas.filter(
                              (r) => r.requirementType === 'Required'
                            ).length
                          }
                          /{rep.jobDescription.requiredSkills.length} required supported
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Active Job Description Visual Comparison & Prioritized Findings */}
          {activeReport && (
            <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-8">
              {/* Top Visual Match Header + Best-Matching Role Highlight */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#E2E8E7]">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span
                      className={`px-2.5 py-0.5 font-semibold border rounded-md ${getGuidanceTone(
                        activeReport.guidanceClassification
                      )}`}
                    >
                      {activeReport.guidanceClassification}
                    </span>
                    {roleRecommendations[0] && (
                      <span className="text-[#526362]">
                        Best-Matching Role:{' '}
                        <strong className="text-[#111919]">
                          {roleRecommendations[0].roleTitle} (
                          {roleRecommendations[0].alignmentScore}%)
                        </strong>
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-[#111919]">
                    {activeReport.jobDescription.title}
                  </h2>
                  <p className="text-xs text-[#526362] leading-relaxed">
                    {activeReport.guidanceExplanation}
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowEditRequirements(!showEditRequirements)}
                      className="text-xs font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1.5"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>
                        {showEditRequirements
                          ? 'Hide Skill Editor'
                          : 'Customize Extracted Required & Preferred Skills'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Circular Visual Match Score Ring + Sub-scores */}
                <div className="flex items-center gap-6 shrink-0 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-4">
                  <MatchScoreRing
                    score={activeReport.matchScore}
                    label="JD Match"
                  />
                  <div className="space-y-2 w-44 text-xs">
                    <EvidenceMeterBar
                      label="Required Skills"
                      score={activeReport.scoreBreakdown.requiredSkillsPoints}
                      max={activeReport.scoreBreakdown.requiredSkillsMax}
                      tone="teal"
                    />
                    <EvidenceMeterBar
                      label="Preferred Skills"
                      score={activeReport.scoreBreakdown.preferredSkillsPoints}
                      max={activeReport.scoreBreakdown.preferredSkillsMax}
                      tone="muted"
                    />
                    <EvidenceMeterBar
                      label="Depth & Recency"
                      score={
                        activeReport.scoreBreakdown.projectRelevancePoints +
                        activeReport.scoreBreakdown.attributionReliabilityPoints
                      }
                      max={25}
                      tone="amber"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Interactive Skill Requirement Editor */}
              {showEditRequirements && (
                <div className="p-4 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div>
                    <div className="font-semibold text-[#111919] mb-2">
                      Required Skills ({activeReport.jobDescription.requiredSkills.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeReport.jobDescription.requiredSkills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-1 bg-white border border-[#CBD5D4] rounded-md inline-flex items-center gap-1.5"
                        >
                          {sk}
                          <button
                            type="button"
                            onClick={() => void handleRemoveRequiredSkillFromActive(sk)}
                            className="text-[#526362] hover:text-[#B91C1C]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={skillToAddReq}
                        onChange={(e) => setSkillToAddReq(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-[#CBD5D4] rounded-md"
                      >
                        <option value="">+ Add required skill...</option>
                        {supportedCatalog.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleAddRequiredSkillToActive()}
                        className="px-3 py-1.5 font-semibold bg-[#0B4F4A] text-white rounded-md"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-[#111919] mb-2">
                      Preferred Skills ({activeReport.jobDescription.preferredSkills.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeReport.jobDescription.preferredSkills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-1 bg-white border border-[#E2E8E7] rounded-md inline-flex items-center gap-1.5"
                        >
                          {sk}
                          <button
                            type="button"
                            onClick={() => void handleRemovePreferredSkillFromActive(sk)}
                            className="text-[#526362] hover:text-[#B91C1C]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={skillToAddPref}
                        onChange={(e) => setSkillToAddPref(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-[#CBD5D4] rounded-md"
                      >
                        <option value="">+ Add preferred skill...</option>
                        {supportedCatalog.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleAddPreferredSkillToActive()}
                        className="px-3 py-1.5 font-semibold bg-[#263333] text-white rounded-md"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Prioritized 3-Column Open Layout: Strongest Supported Skills, Important Gaps, Recommended Next Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 1. Strongest Supported Skills */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8E7]">
                    <h3 className="text-sm font-semibold text-[#0B4F4A]">
                      Strongest Supported Skills
                    </h3>
                    <span className="text-xs font-mono text-[#0B4F4A]">
                      {activeReport.strongestMatchingAreas.length}
                    </span>
                  </div>

                  {activeReport.strongestMatchingAreas.length === 0 ? (
                    <p className="text-xs text-[#526362]">
                      No requirements currently reach strong multi-signal evidence.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E2E8E7]">
                      {activeReport.strongestMatchingAreas.map((item) => (
                        <div
                          key={`${item.requirementType}_${item.skillName}`}
                          className="py-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#111919]">
                              {item.skillName}{' '}
                              <span className="font-normal text-[#526362]">
                                ({item.requirementType})
                              </span>
                            </span>
                            <span className="font-mono font-semibold text-[#0B4F4A]">
                              {item.skillEvidenceScore}/100
                            </span>
                          </div>
                          <EvidenceMeterBar
                            score={item.skillEvidenceScore}
                            max={100}
                            tone="teal"
                            showValue={false}
                          />
                          <p className="text-[11px] text-[#526362]">{item.explanation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Important Gaps & Partial Signals */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8E7]">
                    <h3 className="text-sm font-semibold text-[#B45309]">
                      Important Gaps &amp; Partial Signals
                    </h3>
                    <span className="text-xs font-mono text-[#B45309]">
                      {activeReport.partialMatches.length + activeReport.gapsToAddress.length}
                    </span>
                  </div>

                  {activeReport.partialMatches.length === 0 &&
                  activeReport.gapsToAddress.length === 0 ? (
                    <p className="text-xs text-[#0B4F4A]">
                      All required and preferred skills have strong supporting evidence.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E2E8E7]">
                      {[...activeReport.partialMatches, ...activeReport.gapsToAddress].map(
                        (item) => (
                          <div
                            key={`${item.requirementType}_${item.skillName}`}
                            className="py-3 space-y-1"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[#111919]">
                                {item.skillName}{' '}
                                <span className="font-normal text-[#526362]">
                                  ({item.requirementType})
                                </span>
                              </span>
                              <span className="text-[11px] font-medium text-[#B45309]">
                                {item.evidenceState}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#526362]">{item.explanation}</p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Recommended Next Actions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8E7]">
                    <h3 className="text-sm font-semibold text-[#111919]">
                      Recommended Next Actions
                    </h3>
                    <span className="text-xs font-mono text-[#526362]">
                      {activeReport.recommendedNextSteps.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activeReport.recommendedNextSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-[#FBF7EE] border border-[#F3E3C3] rounded-xl space-y-1 text-xs"
                      >
                        <div className="font-semibold text-[#92400E]">
                          {step.targetArea}
                        </div>
                        <p className="font-medium text-[#111919] leading-relaxed">
                          {step.action}
                        </p>
                        <p className="text-[11px] text-[#526362]">{step.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Progressive Disclosure for Full Requirement-by-Requirement Table */}
              <div className="pt-4 border-t border-[#E2E8E7]">
                <button
                  type="button"
                  onClick={() =>
                    setShowFullRequirementTable(!showFullRequirementTable)
                  }
                  className="text-xs font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1.5"
                >
                  <span>
                    {showFullRequirementTable
                      ? 'Hide Detailed Requirement Breakdown'
                      : `View All ${activeReport.requirementEvaluations.length} Requirement Evaluations & Source Links`}
                  </span>
                  {showFullRequirementTable ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showFullRequirementTable && (
                  <div className="mt-4 overflow-x-auto border border-[#E2E8E7] rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E2E8E7] bg-[#F8F9F8] text-[11px] font-semibold text-[#526362]">
                          <th className="py-3 px-4">Requirement</th>
                          <th className="py-3 px-3">Type</th>
                          <th className="py-3 px-3">Evidence State</th>
                          <th className="py-3 px-3">Skill Score</th>
                          <th className="py-3 px-4">Supporting Repositories</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8E7]">
                        {activeReport.requirementEvaluations.map((req) => (
                          <tr key={`${req.requirementType}_${req.skillName}`}>
                            <td className="py-3 px-4 font-semibold text-[#111919]">
                              {req.skillName}
                            </td>
                            <td className="py-3 px-3 text-[#526362]">
                              {req.requirementType}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={
                                  req.evidenceState === 'Strong supporting evidence'
                                    ? 'text-[#0B4F4A] font-semibold'
                                    : req.evidenceState === 'Partial supporting evidence'
                                    ? 'text-[#B45309] font-medium'
                                    : 'text-[#526362]'
                                }
                              >
                                {req.evidenceState}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums text-[#111919]">
                              {req.skillEvidenceScore}/100
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-[#526362]">
                              {req.supportingRepos.length > 0
                                ? req.supportingRepos
                                    .map(
                                      (r) =>
                                        `${r.repoName} (${r.matchingFilesCount}f, ${r.attributedCommitsCount}c)`
                                    )
                                    .join(', ')
                                : 'No public repo signal'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
