import React, { useState } from 'react';
import {
  ClipboardCheck,
  Search,
  Trash2,
  ArrowRight,
  SlidersHorizontal,
  FolderGit2,
  Briefcase,
  Play,
} from 'lucide-react';
import {
  UserProfileData,
  SavedRecruiterAssessmentItem,
  ExtractedJobDescription,
} from '../types/workverify';

interface RecruiterWorkspaceHomeProps {
  user: UserProfileData;
  recruiterAssessments: SavedRecruiterAssessmentItem[];
  savedJobDescriptions: ExtractedJobDescription[];
  onDeleteAssessment: (id: string) => Promise<void>;
  onSelectSavedAssessment: (item: SavedRecruiterAssessmentItem) => void;
  onNavigate: (path: string, optionalTargetUrl?: string) => void;
}

export const RecruiterWorkspaceHome: React.FC<RecruiterWorkspaceHomeProps> = ({
  user,
  recruiterAssessments,
  savedJobDescriptions,
  onDeleteAssessment,
  onSelectSavedAssessment,
  onNavigate,
}) => {
  const [quickCandidateUrl, setQuickCandidateUrl] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const recPrefs = user.onboarding?.recruiterPrefs || {
    hiringContext: 'Hiring Manager',
    hiringRoles: ['Full-Stack', 'Backend'],
    evaluationPriority: 'Required skills & code ownership',
  };

  const filteredAssessments = recruiterAssessments.filter((item) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.candidateUsername.toLowerCase().includes(q) ||
      item.candidateDisplayName.toLowerCase().includes(q) ||
      item.jobTitle.toLowerCase().includes(q) ||
      item.guidanceClassification.toLowerCase().includes(q)
    );
  });

  const handleQuickStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('/app/assess', quickCandidateUrl.trim());
  };

  return (
    <div className="space-y-8">
      {/* Personalized Recruiter Header & Quick Assessment Launcher */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E2E8E7]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#0B4F4A]">
              <span>Recruiter &amp; Hiring Workspace</span>
              <span>·</span>
              <span>{recPrefs.hiringContext}</span>
              <span>·</span>
              <span className="text-[#526362]">
                Hiring: {recPrefs.hiringRoles.join(', ')}
              </span>
              <span>·</span>
              <span className="text-[#526362]">
                Priority: {recPrefs.evaluationPriority}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111919]">
              Candidate Technical Evidence &amp; Role Alignment
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/onboarding')}
              className="px-3 py-1.5 text-xs font-medium text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg inline-flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Hiring Preferences</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app/assess')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>New Candidate Assessment</span>
            </button>
          </div>
        </div>

        {/* Immediate Candidate URL Launcher */}
        <form onSubmit={handleQuickStartSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="recruiter-home-quick-url"
                className="block text-xs font-semibold text-[#111919] mb-1.5"
              >
                Start a New Candidate Evaluation (Enter Candidate Public GitHub Profile or Repository URL)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#526362] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="recruiter-home-quick-url"
                  type="text"
                  value={quickCandidateUrl}
                  onChange={(e) => setQuickCandidateUrl(e.target.value)}
                  placeholder="https://github.com/candidate-username or https://github.com/owner/repository"
                  className="w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center justify-center gap-2 shrink-0 h-[42px]"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Configure Job &amp; Evaluate Candidate</span>
            </button>
          </div>
          <p className="text-[11px] text-[#526362]">
            Evaluates live public GitHub code and separates <strong>Technical Evidence Strength</strong> (authored code &amp; commits) from <strong>Job-Description Match Score</strong> (alignment with your specific role requirements).
          </p>
        </form>
      </section>

      {/* Saved Candidate Assessments Table */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-[#E2E8E7] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#111919]">
              Saved Candidate Assessments ({recruiterAssessments.length})
            </h2>
            <p className="text-xs text-[#526362] mt-0.5">
              Revisit past candidate evaluations, compare Evidence Strength vs. JD Match, and open commit-grounded interview prompts.
            </p>
          </div>

          {recruiterAssessments.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#526362] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by candidate or role..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A]"
              />
            </div>
          )}
        </div>

        {filteredAssessments.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-[#111919]">
              {recruiterAssessments.length === 0
                ? 'No candidate assessments saved yet'
                : 'No candidate assessments match your filter'}
            </p>
            <p className="text-xs text-[#526362] max-w-md mx-auto">
              Run a candidate assessment against a job description to generate a persistent dossier with verified strengths, missing evidence, and tailored technical interview questions.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/app/assess')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5"
              >
                <span>Start First Candidate Assessment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8E7] bg-[#F8F9F8] text-[11px] font-semibold text-[#526362]">
                  <th className="py-3 px-5">Candidate / Target</th>
                  <th className="py-3 px-3">Evaluated Role</th>
                  <th className="py-3 px-3 text-right">Evidence Strength</th>
                  <th className="py-3 px-3 text-right">JD Match Score</th>
                  <th className="py-3 px-3">Classification</th>
                  <th className="py-3 px-3">Evaluated</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E7]">
                {filteredAssessments.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8F9F8]">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#111919]">
                        {item.candidateDisplayName}
                      </div>
                      <div className="font-mono text-[11px] text-[#0B4F4A]">
                        @{item.candidateUsername} · {item.targetType}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-medium text-[#111919]">{item.jobTitle}</div>
                      <div className="text-[11px] text-[#526362]">{item.roleCategory}</div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-[#188078]">
                      {item.evidenceStrengthScore}/100
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-[#0B4F4A]">
                      {item.jdMatchScore}/100
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`font-medium ${
                          item.guidanceClassification === 'Strong Evidence Match'
                            ? 'text-[#0B4F4A] font-semibold'
                            : item.guidanceClassification === 'Partial Evidence Match'
                            ? 'text-[#188078]'
                            : 'text-[#B45309]'
                        }`}
                      >
                        {item.guidanceClassification}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono tabular-nums text-[#526362]">
                      {item.createdAt.slice(0, 10)}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectSavedAssessment(item)}
                          className="px-3 py-1 font-semibold text-[#0B4F4A] bg-[#EEF6F5] hover:bg-[#DDECE9] rounded-md"
                        >
                          Open Report
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete assessment for ${item.candidateUsername}`}
                          onClick={() => void onDeleteAssessment(item.id)}
                          className="p-1 text-[#526362] hover:text-[#B91C1C]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bottom 2-Column Strip: Saved Job Requisitions + Standalone Public URL Lookup */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111919] flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#0B4F4A]" />
              <span>Saved Job Requisitions ({savedJobDescriptions.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/app/jobs')}
              className="text-xs font-semibold text-[#0B4F4A] hover:underline"
            >
              Manage Requisitions →
            </button>
          </div>
          {savedJobDescriptions.length === 0 ? (
            <p className="text-xs text-[#526362]">
              Save your team’s job descriptions in Requisitions to reuse required and preferred skill weights across multiple candidates.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E8E7] text-xs">
              {savedJobDescriptions.slice(0, 3).map((jd) => (
                <div key={jd.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[#111919]">{jd.title}</div>
                    <div className="text-[11px] text-[#526362]">
                      Required: {jd.requiredSkills.slice(0, 4).join(', ') || 'None'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('/app/assess')}
                    className="font-semibold text-[#0B4F4A] hover:underline shrink-0"
                  >
                    Evaluate Candidate →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#EEF6F5] border border-[#CBE0DD] rounded-xl p-6 space-y-3 text-xs">
          <div className="font-semibold text-[#0B4F4A] flex items-center gap-2">
            <FolderGit2 className="w-4 h-4" />
            <span>Quick Public Repository &amp; Profile Lookup</span>
          </div>
          <p className="text-[#263333] leading-relaxed">
            Need to inspect a candidate’s repository structure or commit attribution without a specific job description? Use the standalone Public GitHub Inspector.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/app/inspector')}
            className="font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
          >
            <span>Open Public GitHub Inspector</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};
