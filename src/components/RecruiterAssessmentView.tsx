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
  CheckCircle2,
  XCircle,
  Copy,
  Sparkles,
  BarChart3,
  Layers,
  LayoutDashboard,
  HelpCircle,
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
  RequirementCoverageDonut,
  TechStackDistributionBar,
  AuthorshipAttributionGauge,
  EngineeringRigorGrid,
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
  const [reportViewTab, setReportViewTab] = useState<
    'visual-dashboard' | 'requirements' | 'interview' | 'tech-tree'
  >('visual-dashboard');
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);

  const handleCopyQuestion = (text: string, id: string) => {
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      setCopiedQuestionId(id);
      setTimeout(() => setCopiedQuestionId(null), 2000);
    }
  };

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

          {/* Candidate Assessment Output — Visual Primary Report */}
          {matchReport && candidateOverview && (() => {
            const strongReqs = matchReport.requirementEvaluations.filter(
              (r) => r.evidenceState === 'Strong supporting evidence'
            ).length;
            const partialReqs = matchReport.requirementEvaluations.filter(
              (r) => r.evidenceState === 'Partial supporting evidence'
            ).length;
            const missingReqs = matchReport.requirementEvaluations.filter(
              (r) =>
                r.evidenceState === 'No supporting evidence found' ||
                r.evidenceState === 'Inconclusive due to insufficient data'
            ).length;

            const candidateTechItems = candidateOverview.skillAssessments
              .filter((s) => s.evidenceScore > 5)
              .sort((a, b) => b.evidenceScore - a.evidenceScore)
              .slice(0, 8)
              .map((s) => ({
                name: s.skillName,
                count: s.evidenceScore,
              }));

            const repos = candidateOverview.normalizedRepositories;
            const hasTests = repos.some((r) =>
              r.meaningfulFilePaths.some((f) => /test|spec|__tests__/i.test(f))
            );
            const testFilesCount = repos.reduce(
              (acc, r) =>
                acc + r.meaningfulFilePaths.filter((f) => /test|spec|__tests__/i.test(f)).length,
              0
            );
            const hasCiCd = repos.some((r) =>
              r.meaningfulFilePaths.some((f) => /\.github\/workflows|circleci|\.travis/i.test(f))
            );
            const hasContainer = repos.some((r) =>
              r.meaningfulFilePaths.some((f) => /docker|compose/i.test(f))
            );
            const hasTypes = repos.some((r) =>
              r.meaningfulFilePaths.some((f) => /tsconfig|\.tsx?$/i.test(f))
            );

            return (
              <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 sm:p-8 space-y-8 shadow-xs">
                {/* 1. Header with Visual Verdict Banner & Identity */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-[#E2E8E7]">
                  <div className="space-y-3 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {matchReport.matchScore >= 75 ? (
                        <span className="px-3 py-1 text-xs font-bold text-white bg-[#0B4F4A] rounded-full inline-flex items-center gap-1.5 shadow-xs">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Strong Match · Interview Recommended</span>
                        </span>
                      ) : matchReport.matchScore >= 50 ? (
                        <span className="px-3 py-1 text-xs font-bold text-[#92400E] bg-[#FBF7EE] border border-[#F3E3C3] rounded-full inline-flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Moderate Fit · Explore Highlighted Gaps</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 text-xs font-bold text-[#526362] bg-[#F2F5F4] border border-[#CBD5D4] rounded-full inline-flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Significant Evidence Gaps</span>
                        </span>
                      )}
                      <span className="text-xs font-mono font-semibold text-[#0B4F4A]">
                        @{candidateOverview.username}
                      </span>
                      <span className="text-[#CBD5D4]">·</span>
                      <span className="text-xs text-[#526362]">
                        {candidateOverview.originalReposCount} Repos · {candidateOverview.totalAttributedCommits} Commits
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111919]">
                      {candidateOverview.displayName || candidateOverview.username} — {matchReport.jobDescription.title}
                    </h2>

                    <p className="text-xs sm:text-sm text-[#526362] leading-relaxed">
                      {matchReport.recruiterAssessment.recruiterSummary}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {user && (
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
                      )}
                      <a
                        href={candidateOverview.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-xs font-medium text-[#263333] border border-[#CBD5D4] hover:bg-[#F8F9F8] rounded-lg inline-flex items-center gap-1.5"
                      >
                        <span>GitHub Profile</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Dual Hero Score Rings */}
                  <div className="flex items-center gap-4 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-4 shrink-0">
                    <div className="flex flex-col items-center">
                      <MatchScoreRing
                        score={matchReport.matchScore}
                        size={84}
                        label="JD Match"
                        customColor={matchReport.matchScore >= 70 ? '#0B4F4A' : matchReport.matchScore >= 45 ? '#D97706' : '#526362'}
                      />
                      <span className="text-[11px] font-semibold text-[#111919] mt-1.5">
                        Role Fit
                      </span>
                    </div>

                    <div className="h-14 w-px bg-[#E2E8E7]" />

                    <div className="flex flex-col items-center">
                      <MatchScoreRing
                        score={evidenceStrengthScore}
                        size={84}
                        label="Evidence"
                        customColor="#188078"
                      />
                      <span className="text-[11px] font-semibold text-[#111919] mt-1.5">
                        Code Strength
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Visual Executive Scorecard Strip (3 Visual Widgets) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Widget A: Score Formula Breakdown */}
                  <div className="lg:col-span-4 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#111919] uppercase tracking-wider">
                        Score Breakdown (100 pts)
                      </span>
                      <span className="text-xs font-mono font-bold text-[#0B4F4A]">
                        {matchReport.matchScore} / 100
                      </span>
                    </div>
                    <div className="space-y-3">
                      <EvidenceMeterBar
                        label="Required Skills (60 max)"
                        score={matchReport.scoreBreakdown.requiredSkillsPoints}
                        max={matchReport.scoreBreakdown.requiredSkillsMax}
                        tone="teal"
                      />
                      <EvidenceMeterBar
                        label="Preferred Skills (15 max)"
                        score={matchReport.scoreBreakdown.preferredSkillsPoints}
                        max={matchReport.scoreBreakdown.preferredSkillsMax}
                        tone="muted"
                      />
                      <EvidenceMeterBar
                        label="Code Depth & Attributed Work (25 max)"
                        score={
                          matchReport.scoreBreakdown.projectRelevancePoints +
                          matchReport.scoreBreakdown.attributionReliabilityPoints
                        }
                        max={25}
                        tone="amber"
                      />
                    </div>
                    <div className="text-[11px] text-[#526362] pt-2 border-t border-[#E2E8E7]">
                      {matchReport.scoreBreakdown.formulaSummary}
                    </div>
                  </div>

                  {/* Widget B: Requirements Coverage Donut */}
                  <div className="lg:col-span-4 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#111919] uppercase tracking-wider">
                        Requirement Fulfillment
                      </span>
                      <span className="text-xs font-mono font-bold text-[#111919]">
                        {matchReport.requirementEvaluations.length} total
                      </span>
                    </div>
                    <div className="py-1 flex justify-center">
                      <RequirementCoverageDonut
                        strongCount={strongReqs}
                        partialCount={partialReqs}
                        missingCount={missingReqs}
                        size={110}
                        title="Met"
                      />
                    </div>
                    <div className="text-[11px] text-[#526362] text-center pt-2 border-t border-[#E2E8E7]">
                      {strongReqs} of {matchReport.requirementEvaluations.length} requirements supported with strong multi-signal code evidence
                    </div>
                  </div>

                  {/* Widget C: Code Rigor & Authorship Integrity */}
                  <div className="lg:col-span-4 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#111919] uppercase tracking-wider">
                        Code Integrity & Rigor
                      </span>
                      <span className="text-[11px] font-mono text-[#0B4F4A] font-semibold">
                        @{candidateOverview.username}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 bg-white border border-[#E2E8E7] rounded-lg">
                        <div className="text-[#526362] text-[11px]">Automated Tests</div>
                        <div className="font-semibold text-[#111919] mt-0.5 flex items-center gap-1.5">
                          {hasTests ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#0B4F4A]" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#526362]" />
                          )}
                          <span>{hasTests ? `${testFilesCount} Test Files` : 'No Tests Found'}</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-white border border-[#E2E8E7] rounded-lg">
                        <div className="text-[#526362] text-[11px]">CI/CD Pipeline</div>
                        <div className="font-semibold text-[#111919] mt-0.5 flex items-center gap-1.5">
                          {hasCiCd ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#0B4F4A]" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#526362]" />
                          )}
                          <span>{hasCiCd ? 'Automated CI' : 'No CI Config'}</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-white border border-[#E2E8E7] rounded-lg">
                        <div className="text-[#526362] text-[11px]">Type Strictness</div>
                        <div className="font-semibold text-[#111919] mt-0.5 flex items-center gap-1.5">
                          {hasTypes ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#0B4F4A]" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#526362]" />
                          )}
                          <span>{hasTypes ? 'Strict Types' : 'Dynamic / Untyped'}</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-white border border-[#E2E8E7] rounded-lg">
                        <div className="text-[#526362] text-[11px]">Container Config</div>
                        <div className="font-semibold text-[#111919] mt-0.5 flex items-center gap-1.5">
                          {hasContainer ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#0B4F4A]" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#526362]" />
                          )}
                          <span>{hasContainer ? 'Docker / Compose' : 'No Containers'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#526362] pt-2 border-t border-[#E2E8E7]">
                      {candidateOverview.originalReposCount} original repos analyzed · {candidateOverview.forkedReposCount} forks isolated
                    </div>
                  </div>
                </div>

                {/* 3. Visual Report Navigation Tabs */}
                <div className="border-b border-[#E2E8E7] bg-[#F8F9F8] px-4 rounded-xl flex items-center gap-3 overflow-x-auto">
                  {[
                    { id: 'visual-dashboard', label: 'Visual Scorecard & Matrix', icon: LayoutDashboard },
                    { id: 'requirements', label: `Requirement Audit (${matchReport.requirementEvaluations.length})`, icon: BarChart3 },
                    { id: 'interview', label: `Interview Guide (${matchReport.recruiterAssessment.interviewQuestions.length})`, icon: HelpCircle },
                    { id: 'tech-tree', label: 'Architecture & Rigor', icon: Layers },
                  ].map((tab) => {
                    const IconComp = tab.icon;
                    const isActive = reportViewTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setReportViewTab(tab.id as any)}
                        className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-2 ${
                          isActive
                            ? 'border-[#0B4F4A] text-[#0B4F4A]'
                            : 'border-transparent text-[#526362] hover:text-[#111919]'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 4. Tab 1: Visual Scorecard & Matrix (Visual Primary) */}
                {reportViewTab === 'visual-dashboard' && (
                  <div className="space-y-8">
                    {/* Visual Requirement Fulfillment Matrix Grid */}
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-[#111919]">
                            Job Requirement Evidence Matrix
                          </h3>
                          <p className="text-xs text-[#526362]">
                            Deterministic comparison of candidate code evidence against each job requirement
                          </p>
                        </div>
                        <span className="text-xs font-mono text-[#0B4F4A] bg-[#EEF6F5] px-2.5 py-1 rounded-md font-semibold">
                          {strongReqs} Strong · {partialReqs} Partial · {missingReqs} Gaps
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {matchReport.requirementEvaluations.map((req) => {
                          const isStrong = req.evidenceState === 'Strong supporting evidence';
                          const isPartial = req.evidenceState === 'Partial supporting evidence';
                          return (
                            <div
                              key={`${req.requirementType}_${req.skillName}`}
                              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                                isStrong
                                  ? 'bg-[#EEF6F5]/50 border-[#C5DDD9]'
                                  : isPartial
                                  ? 'bg-[#FBF7EE]/60 border-[#F3E3C3]'
                                  : 'bg-[#F8F9F8] border-[#E2E8E7]'
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                                      req.requirementType === 'Required'
                                        ? 'bg-[#0B4F4A] text-white'
                                        : 'bg-[#E2E8E7] text-[#263333]'
                                    }`}
                                  >
                                    {req.requirementType}
                                  </span>
                                  <span
                                    className={`text-xs font-semibold inline-flex items-center gap-1 ${
                                      isStrong
                                        ? 'text-[#0B4F4A]'
                                        : isPartial
                                        ? 'text-[#D97706]'
                                        : 'text-[#526362]'
                                    }`}
                                  >
                                    {isStrong ? (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    ) : isPartial ? (
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {isStrong ? 'Strong' : isPartial ? 'Partial' : 'Missing'}
                                    </span>
                                  </span>
                                </div>

                                <div>
                                  <h4 className="text-base font-bold text-[#111919]">
                                    {req.skillName}
                                  </h4>
                                  <p className="text-xs text-[#526362] line-clamp-2 mt-1 leading-relaxed">
                                    {req.explanation}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-[#E2E8E7]/70">
                                <EvidenceMeterBar
                                  label="Evidence Score"
                                  score={req.skillEvidenceScore}
                                  max={100}
                                  tone={isStrong ? 'teal' : isPartial ? 'amber' : 'neutral'}
                                  showValue={true}
                                />
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-[#526362]">
                                  {req.supportingRepos.slice(0, 2).map((sr) => (
                                    <span
                                      key={sr.repoName}
                                      className="px-2 py-0.5 bg-white border border-[#CBD5D4] rounded text-[#0B4F4A] inline-flex items-center gap-1"
                                    >
                                      <FolderGit2 className="w-3 h-3" />
                                      <span>{sr.repoName} ({sr.attributedCommitsCount}c)</span>
                                    </span>
                                  ))}
                                  {req.supportingRepos.length === 0 && (
                                    <span className="text-[#839594]">No public repos</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tech Stack Distribution Bar */}
                    {candidateTechItems.length > 0 && (
                      <div className="p-5 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl space-y-3">
                        <TechStackDistributionBar
                          items={candidateTechItems}
                          title="Candidate Technology Distribution (Evaluated Repositories)"
                        />
                      </div>
                    )}

                    {/* Visual Strengths vs Gaps Comparison Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Strengths Card */}
                      <div className="p-5 bg-[#EEF6F5]/60 border border-[#C5DDD9] rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-[#0B4F4A] flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#0B4F4A]" />
                            <span>Verified Technical Strengths</span>
                          </h4>
                          <span className="text-[11px] font-mono font-semibold text-[#0B4F4A] bg-white px-2 py-0.5 rounded border border-[#C5DDD9]">
                            {matchReport.recruiterAssessment.strengths.length} verified
                          </span>
                        </div>
                        {matchReport.recruiterAssessment.strengths.length === 0 ? (
                          <p className="text-xs text-[#526362]">
                            No strong multi-signal matches were identified.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {matchReport.recruiterAssessment.strengths.map((str, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-white border border-[#D3E5E2] rounded-lg text-xs text-[#263333] flex items-start gap-2.5 leading-relaxed"
                              >
                                <span className="w-5 h-5 rounded-full bg-[#EEF6F5] text-[#0B4F4A] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                                  ✓
                                </span>
                                <div>{str}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Gaps & Limitations Card */}
                      <div className="p-5 bg-[#FBF7EE]/60 border border-[#F3E3C3] rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-[#B45309] flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                            <span>Evidence Gaps &amp; Verification Limitations</span>
                          </h4>
                          <span className="text-[11px] font-mono font-semibold text-[#B45309] bg-white px-2 py-0.5 rounded border border-[#F3E3C3]">
                            {matchReport.recruiterAssessment.gapsAndConcerns.length} flagged
                          </span>
                        </div>
                        {matchReport.recruiterAssessment.gapsAndConcerns.length === 0 ? (
                          <div className="p-3 bg-white border border-[#E2E8E7] rounded-lg text-xs text-[#0B4F4A]">
                            All required technical qualifications have supporting public repository evidence.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {matchReport.recruiterAssessment.gapsAndConcerns.map((gap, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-white border border-[#F3E3C3] rounded-lg text-xs text-[#263333] flex items-start gap-2.5 leading-relaxed"
                              >
                                <span className="w-5 h-5 rounded-full bg-[#FEF3C7] text-[#D97706] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                                  !
                                </span>
                                <div>{gap}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Tab 2: Detailed Requirement Audit */}
                {reportViewTab === 'requirements' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#111919]">
                        Detailed Source Breakdown &amp; Attribution Files
                      </h3>
                      <span className="text-xs text-[#526362]">
                        Click any requirement to expand supporting commits and source trees
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
                              onClick={() => setExpandedRequirement(isExpanded ? null : rowKey)}
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
                )}

                {/* 6. Tab 3: Commit-Grounded Interview Guide (Visual Prompt Cards) */}
                {reportViewTab === 'interview' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#111919]">
                          Commit-Grounded Technical Interview Guide
                        </h3>
                        <p className="text-xs text-[#526362]">
                          Interview questions dynamically grounded in the candidate's actual commits, architectural decisions, and observed code gaps.
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-[#0B4F4A] bg-[#EEF6F5] px-2.5 py-1 rounded-md">
                        {matchReport.recruiterAssessment.interviewQuestions.length} questions
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {matchReport.recruiterAssessment.interviewQuestions.map((q, idx) => {
                        const isCopied = copiedQuestionId === q.id;
                        return (
                          <div
                            key={q.id}
                            className="p-5 bg-[#F8F9F8] border border-[#E2E8E7] hover:border-[#CBD5D4] rounded-xl space-y-3 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#0B4F4A] bg-[#EEF6F5] border border-[#C5DDD9] px-2 py-0.5 rounded">
                                  Q{idx + 1}
                                </span>
                                <span className="text-xs font-semibold text-[#111919]">
                                  {q.topic}
                                </span>
                                <span className="text-xs text-[#CBD5D4]">·</span>
                                <span className="text-xs font-mono text-[#526362]">
                                  {q.targetRepoOrSkill}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCopyQuestion(q.question, q.id)}
                                className="px-2.5 py-1 text-[11px] font-medium text-[#0B4F4A] bg-white border border-[#CBD5D4] hover:bg-[#EEF6F5] rounded-md transition-colors inline-flex items-center gap-1.5 shrink-0"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#0B4F4A]" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Prompt</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="text-base font-semibold text-[#111919] leading-snug">
                              “{q.question}”
                            </p>

                            <div className="p-3 bg-white border border-[#E2E8E7] rounded-lg text-xs text-[#526362] flex items-start gap-2">
                              <span className="font-semibold text-[#0B4F4A] shrink-0">Motivating Evidence:</span>
                              <span className="leading-relaxed">{q.motivatingEvidence}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 7. Tab 4: Architecture & Engineering Rigor */}
                {reportViewTab === 'tech-tree' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-[#111919] mb-1">
                        Repository Engineering Rigor Signals
                      </h3>
                      <p className="text-xs text-[#526362]">
                        Automated inspection of testing frameworks, CI/CD pipelines, containerization, and configuration integrity
                      </p>
                    </div>

                    <EngineeringRigorGrid
                      hasTests={hasTests}
                      testFilesCount={testFilesCount}
                      hasCiCd={hasCiCd}
                      hasContainer={hasContainer}
                      hasTypes={hasTypes}
                      manifestsCount={repos.reduce((acc, r) => acc + (r.meaningfulFilePaths.some((f) => /package\.json|pyproject|cargo|go\.mod/i.test(f)) ? 1 : 0), 0)}
                    />

                    <AuthorshipAttributionGauge
                      ownerCommits={candidateOverview.totalAttributedCommits}
                      totalCommits={repos.reduce((acc, r) => acc + r.commits.length, 0)}
                      ownerLogin={candidateOverview.username}
                      distinctAuthorsCount={2}
                    />

                    {/* Repository List with Attribution */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-sm font-semibold text-[#111919]">
                        Analyzed Repositories ({repos.length})
                      </h4>
                      <div className="divide-y divide-[#E2E8E7] border border-[#E2E8E7] rounded-xl overflow-hidden bg-white text-xs">
                        {repos.map((r) => (
                          <div
                            key={r.name}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8F9F8] transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#111919]">{r.name}</span>
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                                    r.isFork
                                      ? 'bg-[#FBF7EE] text-[#B45309]'
                                      : 'bg-[#EEF6F5] text-[#0B4F4A]'
                                  }`}
                                >
                                  {r.isFork ? 'Fork (Isolated)' : 'Original Repo'}
                                </span>
                                {r.primaryLanguage && (
                                  <span className="text-[#526362]">· {r.primaryLanguage}</span>
                                )}
                              </div>
                              <p className="text-[#526362] line-clamp-1">
                                {r.description || 'No description provided.'}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-right font-mono shrink-0">
                              <div>
                                <div className="font-bold text-[#0B4F4A]">
                                  {r.candidateAttributedCommits} / {r.commits.length}
                                </div>
                                <div className="text-[10px] text-[#526362]">attributed commits</div>
                              </div>
                              <a
                                href={r.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 text-xs text-[#0B4F4A] hover:bg-[#EEF6F5] border border-[#C5DDD9] rounded-md inline-flex items-center gap-1"
                              >
                                <span>Code</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      )}
    </div>
  );
};
