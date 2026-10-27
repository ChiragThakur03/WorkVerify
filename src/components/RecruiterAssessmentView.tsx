import React, { useState, useEffect } from 'react';
import {
  Upload,
  Play,
  Check,
  AlertTriangle,
  X,
  GitCommit,
  FolderGit2,
  ClipboardCheck,
  Share2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  BookmarkCheck,
  ShieldCheck,
} from 'lucide-react';
import {
  UserProfileData,
  JobDescriptionMatchReport,
  ExtractedJobDescription,
  RequirementEvidenceState,
  SkillAssessmentResult,
  NormalizedRepository,
  SupportedSkillCatalogItem,
  SavedRecruiterAssessmentItem,
} from '../types/workverify';
import { RecruiterView } from './RecruiterView';
import { apiFetch } from '../lib/apiClient';
import {
  MatchScoreRing,
  EvidenceMeterBar,
} from './VisualAssets';

interface CandidateOverviewData {
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  profileUrl: string;
  repositoriesAnalyzed: number;
  originalReposCount: number;
  forkedReposCount: number;
  totalAttributedCommits: number;
  skillAssessments: SkillAssessmentResult[];
  normalizedRepositories: NormalizedRepository[];
}

interface RecruiterAssessmentViewProps {
  user: UserProfileData | null;
  savedJobDescriptions: ExtractedJobDescription[];
  supportedCatalog: SupportedSkillCatalogItem[];
  initialTargetUrl?: string;
  initialJobTitle?: string;
  initialSavedAssessment?: SavedRecruiterAssessmentItem | null;
  onAssessmentSaved?: (savedAssessments: SavedRecruiterAssessmentItem[]) => void;
  onTogglePublicProfile: (nextPublic: boolean) => Promise<void>;
}

function getEvidenceStateTone(state: RequirementEvidenceState): 'teal' | 'amber' | 'neutral' {
  switch (state) {
    case 'Strong supporting evidence':
      return 'teal';
    case 'Partial supporting evidence':
      return 'amber';
    default:
      return 'neutral';
  }
}

export const RecruiterAssessmentView: React.FC<RecruiterAssessmentViewProps> = ({
  user,
  savedJobDescriptions,
  supportedCatalog,
  initialTargetUrl,
  initialJobTitle,
  initialSavedAssessment,
  onAssessmentSaved,
  onTogglePublicProfile,
}) => {
  const [subMode, setSubMode] = useState<'jd-evaluator' | 'shared-dossier'>('jd-evaluator');
  const [targetUrl, setTargetUrl] = useState(initialTargetUrl || '');
  const [jobTitle, setJobTitle] = useState(
    initialJobTitle ||
      (user?.onboarding?.recruiterPrefs?.hiringRoles?.[0]
        ? `${user.onboarding.recruiterPrefs.hiringRoles[0]} Software Engineer`
        : '') ||
      savedJobDescriptions[0]?.title ||
      'Full-Stack Software Engineer'
  );
  const [jobDescriptionText, setJobDescriptionText] = useState(
    savedJobDescriptions[0]?.rawText ||
      'We are hiring a Full-Stack Software Engineer to build and maintain production web applications.\n\nRequired Qualifications:\n- Strong proficiency in TypeScript and React\n- Experience building backend APIs with Node.js\n- Familiarity with SQL / PostgreSQL or automated testing\n\nPreferred Qualifications:\n- Experience with Docker & CI/CD pipelines or Python'
  );
  const [requiredSkills, setRequiredSkills] = useState<string[]>(
    savedJobDescriptions[0]?.requiredSkills || [
      'TypeScript',
      'React',
      'Node.js',
      'SQL & PostgreSQL',
    ]
  );
  const [preferredSkills, setPreferredSkills] = useState<string[]>(
    savedJobDescriptions[0]?.preferredSkills || ['Docker & CI/CD', 'Python']
  );

  const [newReqSkill, setNewReqSkill] = useState('');
  const [newPrefSkill, setNewPrefSkill] = useState('');

  const [isAssessing, setIsAssessing] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [candidateOverview, setCandidateOverview] = useState<CandidateOverviewData | null>(null);
  const [evidenceStrengthScore, setEvidenceStrengthScore] = useState<number>(0);
  const [matchReport, setMatchReport] = useState<JobDescriptionMatchReport | null>(null);

  const [showJdEditor, setShowJdEditor] = useState(true);
  const [expandedRequirement, setExpandedRequirement] = useState<string | null>(null);
  const [showInterviewPrompts, setShowInterviewPrompts] = useState(false);

  useEffect(() => {
    if (initialSavedAssessment) {
      setTargetUrl(initialSavedAssessment.targetUrl);
      setJobTitle(initialSavedAssessment.jobTitle);
      setEvidenceStrengthScore(initialSavedAssessment.evidenceStrengthScore);
      setMatchReport(initialSavedAssessment.jobMatchReport);
      setCandidateOverview(initialSavedAssessment.candidateOverview);
      setShowJdEditor(false);
      setSavedNotice('Loaded saved candidate assessment from your workspace history.');
    }
  }, [initialSavedAssessment]);

  useEffect(() => {
    if (initialTargetUrl && initialTargetUrl.trim() && !initialSavedAssessment) {
      setTargetUrl(initialTargetUrl);
      if (initialJobTitle && initialJobTitle.trim()) {
        setJobTitle(initialJobTitle);
      }
      setSubMode('jd-evaluator');
      void runRecruiterAssessment(initialTargetUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTargetUrl, initialJobTitle, initialSavedAssessment]);

  const handleParseJdPreview = async (textToParse: string, explicitTitle?: string) => {
    try {
      const res = await apiFetch('/api/jobs/parse-preview', {
        method: 'POST',
        body: JSON.stringify({ rawText: textToParse, title: explicitTitle }),
      });
      const data = await res.json();
      if (res.ok && data.jobDescription) {
        const parsed: ExtractedJobDescription = data.jobDescription;
        setJobTitle(parsed.title);
        setRequiredSkills(parsed.requiredSkills);
        setPreferredSkills(parsed.preferredSkills);
      }
    } catch {
      // Fallback silent
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const inferredTitle = file.name.replace(/\.(txt|md|json)$/i, '').replace(/[-_]/g, ' ');
      setJobDescriptionText(text);
      await handleParseJdPreview(text, inferredTitle);
    } catch {
      setErrorMsg(
        'Could not read uploaded file. Please paste the job description text directly.'
      );
    }
  };

  const runRecruiterAssessment = async (
    overrideUrl?: string,
    overrideJd?: ExtractedJobDescription,
    autoSave = true
  ) => {
    const urlToAssess = (overrideUrl ?? targetUrl).trim();
    if (!urlToAssess) {
      setErrorMsg('Please enter a candidate GitHub profile or repository URL to evaluate.');
      return;
    }

    setIsAssessing(true);
    setErrorMsg(null);
    setSavedNotice(null);
    try {
      const payload = {
        targetUrl: urlToAssess,
        jobDescriptionText: overrideJd ? overrideJd.rawText : jobDescriptionText,
        jobTitle: overrideJd ? overrideJd.title : jobTitle,
        requiredSkills: overrideJd ? overrideJd.requiredSkills : requiredSkills,
        preferredSkills: overrideJd ? overrideJd.preferredSkills : preferredSkills,
        saveAssessment: Boolean(user && autoSave),
      };

      const res = await apiFetch('/api/recruiter/assess', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run recruiter assessment.');
      }

      setCandidateOverview(data.candidateOverview);
      setEvidenceStrengthScore(
        typeof data.evidenceStrengthScore === 'number' ? data.evidenceStrengthScore : 0
      );
      setMatchReport(data.jobMatchReport);
      setShowJdEditor(false);
      if (data.recruiterAssessments && onAssessmentSaved) {
        onAssessmentSaved(data.recruiterAssessments);
        setSavedNotice('Assessment automatically saved to your Recruiter Pipeline.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Recruiter candidate assessment failed.');
    } finally {
      setIsAssessing(false);
    }
  };

  const handleSaveCurrentAssessment = async () => {
    if (!user || !candidateOverview || !matchReport) return;
    setIsSavingReport(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/recruiter/assessments', {
        method: 'POST',
        body: JSON.stringify({
          candidateUsername: candidateOverview.username,
          candidateDisplayName: candidateOverview.displayName,
          targetUrl: targetUrl || candidateOverview.profileUrl,
          targetType: 'profile',
          jobTitle: matchReport.jobDescription.title,
          roleCategory: matchReport.jobDescription.roleCategory,
          evidenceStrengthScore,
          jdMatchScore: matchReport.matchScore,
          guidanceClassification: matchReport.guidanceClassification,
          candidateOverview,
          jobMatchReport: matchReport,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save assessment.');
      }
      if (data.recruiterAssessments && onAssessmentSaved) {
        onAssessmentSaved(data.recruiterAssessments);
      }
      setSavedNotice('Assessment saved to your Recruiter Workspace history.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not save assessment.');
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleSelectSavedJd = (jd: ExtractedJobDescription) => {
    setJobTitle(jd.title);
    setJobDescriptionText(jd.rawText);
    setRequiredSkills(jd.requiredSkills);
    setPreferredSkills(jd.preferredSkills);
    if (targetUrl.trim()) {
      void runRecruiterAssessment(targetUrl, jd);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Mode Switcher */}
      <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#0B4F4A]">
            Recruiter Technical Verification
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111919] mt-1">
            Evaluate Candidate GitHub Evidence Against a Role
          </h1>
        </div>

        {user && user.activeRole === 'developer' && (
          <div className="inline-flex items-center p-1 bg-[#F8F9F8] border border-[#E2E8E7] rounded-lg self-start">
            <button
              type="button"
              onClick={() => setSubMode('jd-evaluator')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 ${
                subMode === 'jd-evaluator'
                  ? 'bg-[#0B4F4A] text-white'
                  : 'text-[#526362] hover:text-[#111919]'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Candidate Evaluator</span>
            </button>
            <button
              type="button"
              onClick={() => setSubMode('shared-dossier')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 ${
                subMode === 'shared-dossier'
                  ? 'bg-[#0B4F4A] text-white'
                  : 'text-[#526362] hover:text-[#111919]'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>My Shareable Profile</span>
            </button>
          </div>
        )}
      </div>

      {subMode === 'shared-dossier' && user ? (
        <RecruiterView user={user} onTogglePublicProfile={onTogglePublicProfile} />
      ) : (
        <div className="space-y-8">
          {/* Input Configuration Bar */}
          <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <label
                  htmlFor="recruiter-candidate-url"
                  className="block text-xs font-medium text-[#526362] mb-1.5"
                >
                  Candidate GitHub Profile or Repository URL
                </label>
                <input
                  id="recruiter-candidate-url"
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://github.com/username or https://github.com/owner/repo"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
                />
              </div>

              <div className="w-full md:w-64">
                <label
                  htmlFor="recruiter-job-title"
                  className="block text-xs font-medium text-[#526362] mb-1.5"
                >
                  Target Role Title
                </label>
                <input
                  id="recruiter-job-title"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Senior Backend Engineer"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
                />
              </div>

              <button
                type="button"
                disabled={isAssessing}
                onClick={() => void runRecruiterAssessment()}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg transition-colors inline-flex items-center justify-center gap-2 shrink-0 h-[42px]"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {isAssessing
                    ? 'Evaluating Candidate...'
                    : 'Generate Evidence Report'}
                </span>
              </button>
            </div>

            {/* Toggle for JD Text & Skill Requirements Editor */}
            <div className="pt-3 border-t border-[#E2E8E7] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-[#526362]">
                <span className="font-medium text-[#111919]">Required Skills:</span>
                <span>{requiredSkills.join(', ') || 'None'}</span>
                {preferredSkills.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-medium text-[#111919]">Preferred:</span>
                    <span>{preferredSkills.join(', ')}</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowJdEditor(!showJdEditor)}
                className="font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>
                  {showJdEditor
                    ? 'Hide Job Description & Skill Weights'
                    : 'Edit Job Description & Skill Weights'}
                </span>
              </button>
            </div>

            {showJdEditor && (
              <div className="pt-4 border-t border-[#E2E8E7] grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="recruiter-jd-textarea"
                      className="font-medium text-[#111919]"
                    >
                      Job Description Text
                    </label>
                    <div className="flex items-center gap-3">
                      {savedJobDescriptions.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {savedJobDescriptions.slice(0, 2).map((jd) => (
                            <button
                              key={jd.id}
                              type="button"
                              onClick={() => handleSelectSavedJd(jd)}
                              className="px-2 py-0.5 text-[11px] bg-[#EEF6F5] text-[#0B4F4A] rounded font-medium"
                            >
                              {jd.title.split(' (')[0]}
                            </button>
                          ))}
                        </div>
                      )}
                      <label className="font-semibold text-[#0B4F4A] hover:underline cursor-pointer inline-flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload (.txt/.md)</span>
                        <input
                          type="file"
                          accept=".txt,.md,.json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          void handleParseJdPreview(jobDescriptionText, jobTitle)
                        }
                        className="font-medium text-[#526362] hover:text-[#111919] underline"
                      >
                        Re-extract skills
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="recruiter-jd-textarea"
                    rows={5}
                    value={jobDescriptionText}
                    onChange={(e) => setJobDescriptionText(e.target.value)}
                    placeholder="Paste job description requirements and responsibilities..."
                    className="w-full p-3 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A] focus:bg-white leading-relaxed"
                  />
                </div>

                <div className="lg:col-span-5 space-y-4 text-xs bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-4">
                  <div>
                    <div className="font-semibold text-[#111919] mb-2">
                      Required Skills (60 pts weight)
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {requiredSkills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-1 bg-white border border-[#CBD5D4] rounded-md inline-flex items-center gap-1.5"
                        >
                          {sk}
                          <button
                            type="button"
                            aria-label={`Remove required skill ${sk}`}
                            onClick={() =>
                              setRequiredSkills(requiredSkills.filter((s) => s !== sk))
                            }
                            className="text-[#526362] hover:text-[#B91C1C]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <select
                        aria-label="Add Required Skill"
                        value={newReqSkill}
                        onChange={(e) => setNewReqSkill(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-[#CBD5D4] rounded-md"
                      >
                        <option value="">+ Add required skill...</option>
                        {supportedCatalog.map((item) => (
                          <option key={item.name} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (newReqSkill && !requiredSkills.includes(newReqSkill)) {
                            setRequiredSkills([...requiredSkills, newReqSkill]);
                            setPreferredSkills(
                              preferredSkills.filter((p) => p !== newReqSkill)
                            );
                            setNewReqSkill('');
                          }
                        }}
                        className="px-3 py-1.5 font-semibold bg-[#0B4F4A] text-white rounded-md"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E2E8E7]">
                    <div className="font-semibold text-[#111919] mb-2">
                      Preferred Skills (15 pts weight)
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {preferredSkills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-1 bg-white border border-[#E2E8E7] rounded-md inline-flex items-center gap-1.5"
                        >
                          {sk}
                          <button
                            type="button"
                            aria-label={`Remove preferred skill ${sk}`}
                            onClick={() =>
                              setPreferredSkills(
                                preferredSkills.filter((s) => s !== sk)
                              )
                            }
                            className="text-[#526362] hover:text-[#B91C1C]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <select
                        aria-label="Add Preferred Skill"
                        value={newPrefSkill}
                        onChange={(e) => setNewPrefSkill(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-[#CBD5D4] rounded-md"
                      >
                        <option value="">+ Add preferred skill...</option>
                        {supportedCatalog.map((item) => (
                          <option key={item.name} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            newPrefSkill &&
                            !preferredSkills.includes(newPrefSkill) &&
                            !requiredSkills.includes(newPrefSkill)
                          ) {
                            setPreferredSkills([...preferredSkills, newPrefSkill]);
                            setNewPrefSkill('');
                          }
                        }}
                        className="px-3 py-1.5 font-semibold bg-[#263333] text-white rounded-md"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {savedNotice && (
              <div
                role="status"
                className="p-3 bg-[#EEF6F5] border border-[#CBE0DD] rounded-lg text-xs text-[#0B4F4A] flex items-center justify-between gap-2"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <BookmarkCheck className="w-4 h-4 shrink-0" />
                  <span>{savedNotice}</span>
                </span>
              </div>
            )}
          </section>

          {/* Candidate Assessment Output — Prioritized & Clean */}
          {matchReport && candidateOverview && (
            <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-8">
              {/* 1. Candidate & Repository Identity + Dual Distinct Score Rings (Evidence Strength vs. JD Match) */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-[#E2E8E7]">
                <div className="space-y-2.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="font-mono font-semibold text-[#0B4F4A]">
                      @{candidateOverview.username}
                    </span>
                    <span className="text-[#CBD5D4]">·</span>
                    <span className="text-[#526362]">
                      {candidateOverview.originalReposCount} Original Repos ·{' '}
                      {candidateOverview.forkedReposCount} Forks Isolated ·{' '}
                      {candidateOverview.totalAttributedCommits} Attributed Commits
                    </span>
                    <a
                      href={candidateOverview.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
                    >
                      <span>GitHub Profile</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <h2 className="text-2xl font-bold text-[#111919]">
                    {candidateOverview.displayName} — {matchReport.jobDescription.title}
                  </h2>

                  <p className="text-xs text-[#526362] leading-relaxed">
                    {matchReport.recruiterAssessment.recruiterSummary}
                  </p>

                  {user && (
                    <div className="pt-1 flex items-center gap-3">
                      <button
                        type="button"
                        disabled={isSavingReport}
                        onClick={() => void handleSaveCurrentAssessment()}
                        className="px-3.5 py-1.5 text-xs font-semibold text-[#0B4F4A] bg-[#EEF6F5] hover:bg-[#DDECE9] border border-[#CBE0DD] rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        <span>
                          {isSavingReport ? 'Saving...' : 'Save Assessment to Pipeline'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Dual Distinct Metrics: Technical Evidence Strength vs. Job-Description Match */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
                  {/* Metric A: Technical Evidence Strength (Independent of JD) */}
                  <div className="bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-4 flex items-center gap-4">
                    <MatchScoreRing
                      score={evidenceStrengthScore}
                      label="Evidence"
                    />
                    <div className="space-y-1 max-w-[150px] text-xs">
                      <div className="font-semibold text-[#111919] inline-flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#0B4F4A]" />
                        <span>Evidence Strength</span>
                      </div>
                      <p className="text-[11px] text-[#526362] leading-relaxed">
                        Overall code depth, commit authorship &amp; multi-signal verification across original repos.
                      </p>
                    </div>
                  </div>

                  {/* Metric B: Job-Description Match Score (Specific to Target Role) */}
                  <div className="bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-4 flex items-center gap-5">
                    <MatchScoreRing
                      score={matchReport.matchScore}
                      label="JD Match"
                    />
                    <div className="space-y-2 w-40 text-xs">
                      <EvidenceMeterBar
                        label="Required (60)"
                        score={matchReport.scoreBreakdown.requiredSkillsPoints}
                        max={matchReport.scoreBreakdown.requiredSkillsMax}
                        tone="teal"
                      />
                      <EvidenceMeterBar
                        label="Preferred (15)"
                        score={matchReport.scoreBreakdown.preferredSkillsPoints}
                        max={matchReport.scoreBreakdown.preferredSkillsMax}
                        tone="muted"
                      />
                      <EvidenceMeterBar
                        label="Depth (25)"
                        score={
                          matchReport.scoreBreakdown.projectRelevancePoints +
                          matchReport.scoreBreakdown.attributionReliabilityPoints
                        }
                        max={25}
                        tone="amber"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Key Strengths & Missing Evidence */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-6 border-b border-[#E2E8E7] text-xs">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#0B4F4A]">
                    Verified Technical Strengths
                  </h3>
                  {matchReport.recruiterAssessment.strengths.length === 0 ? (
                    <p className="text-[#526362]">
                      No strong multi-signal matches were found for the required technologies.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-[#263333]">
                      {matchReport.recruiterAssessment.strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                          <Check className="w-4 h-4 text-[#0B4F4A] shrink-0 mt-0.5" />
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#B45309]">
                    Missing Public Evidence &amp; Verification Limitations
                  </h3>
                  {matchReport.recruiterAssessment.gapsAndConcerns.length === 0 ? (
                    <p className="text-[#0B4F4A]">
                      All stated required technologies have supporting public code evidence.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-[#263333]">
                      {matchReport.recruiterAssessment.gapsAndConcerns.map((gap, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                          <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* 3. Job Requirement Alignment & Direct Source Links */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#111919]">
                    Job Requirement Alignment &amp; Source Evidence
                  </h3>
                  <span className="text-xs text-[#526362]">
                    Click any requirement to inspect supporting repositories &amp; commits
                  </span>
                </div>

                <div className="divide-y divide-[#E2E8E7]">
                  {matchReport.requirementEvaluations.map((req) => {
                    const rowKey = `${req.requirementType}_${req.skillName}`;
                    const isExpanded = expandedRequirement === rowKey;
                    return (
                      <div key={rowKey} className="py-3.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRequirement(isExpanded ? null : rowKey)
                          }
                          className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold text-[#111919] group-hover:text-[#0B4F4A]">
                              {req.skillName}
                            </span>
                            <span className="text-xs font-mono text-[#526362]">
                              {req.requirementType}
                            </span>
                            <span
                              className={`text-xs ${
                                req.evidenceState === 'Strong supporting evidence'
                                  ? 'text-[#0B4F4A] font-semibold'
                                  : req.evidenceState === 'Partial supporting evidence'
                                  ? 'text-[#B45309] font-medium'
                                  : 'text-[#526362]'
                              }`}
                            >
                              {req.evidenceState}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 sm:w-56">
                            <div className="flex-1">
                              <EvidenceMeterBar
                                score={req.skillEvidenceScore}
                                max={100}
                                tone={getEvidenceStateTone(req.evidenceState)}
                                showValue={false}
                              />
                            </div>
                            <span className="text-xs font-mono font-semibold tabular-nums text-[#111919] w-12 text-right">
                              {req.skillEvidenceScore}/100
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-[#526362]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#526362]" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-[#E2E8E7] text-xs space-y-2.5 bg-[#F8F9F8] p-4 rounded-xl">
                            <p className="text-[#263333] leading-relaxed">
                              {req.explanation}
                            </p>

                            {(req.supportingRepos.length > 0 ||
                              req.supportingCommits.length > 0) && (
                              <div className="flex flex-wrap items-center gap-4 pt-1">
                                {req.supportingRepos.map((sr) => (
                                  <a
                                    key={sr.repoName}
                                    href={sr.htmlUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
                                  >
                                    <FolderGit2 className="w-3.5 h-3.5" />
                                    <span>
                                      {sr.repoName}{' '}
                                      <span className="opacity-80">
                                        ({sr.matchingFilesCount > 0
                                          ? `${sr.matchingFilesCount} code ${sr.matchingFilesCount === 1 ? 'file' : 'files'}`
                                          : '0 code files'}
                                        , {sr.attributedCommitsCount} {sr.attributedCommitsCount === 1 ? 'commit' : 'commits'})
                                      </span>
                                    </span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ))}
                                {req.supportingCommits.slice(0, 3).map((sc) => (
                                  <a
                                    key={sc.shortSha}
                                    href={sc.htmlUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-[#263333] hover:text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
                                  >
                                    <GitCommit className="w-3.5 h-3.5 text-[#188078]" />
                                    <span>
                                      {sc.shortSha}: {sc.message.slice(0, 48)}
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
              </div>

              {/* 4. Collapsible Commit-Grounded Interview Prompts */}
              <div className="pt-4 border-t border-[#E2E8E7]">
                <button
                  type="button"
                  onClick={() => setShowInterviewPrompts(!showInterviewPrompts)}
                  className="text-xs font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1.5"
                >
                  <span>
                    {showInterviewPrompts
                      ? 'Hide Commit-Grounded Interview Questions'
                      : `Show ${matchReport.recruiterAssessment.interviewQuestions.length} Evidence-Grounded Interview Questions`}
                  </span>
                  {showInterviewPrompts ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showInterviewPrompts && (
                  <div className="mt-4 divide-y divide-[#E2E8E7] text-xs">
                    {matchReport.recruiterAssessment.interviewQuestions.map((q) => (
                      <div key={q.id} className="py-3.5 space-y-1">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-[#0B4F4A]">
                          <span>{q.topic}</span>
                          <span>·</span>
                          <span className="text-[#526362]">{q.targetRepoOrSkill}</span>
                        </div>
                        <p className="font-semibold text-[#111919] text-sm">
                          “{q.question}”
                        </p>
                        <p className="text-[#526362]">
                          Context: {q.motivatingEvidence}
                        </p>
                      </div>
                    ))}
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
