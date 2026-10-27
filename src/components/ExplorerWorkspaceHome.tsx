import React, { useState } from 'react';
import {
  Compass,
  Search,
  Briefcase,
  ClipboardCheck,
  ArrowRight,
  Terminal,
  Users,
} from 'lucide-react';
import {
  UserProfileData,
  PublicAnalysisHistoryItem,
  PrimaryWorkspaceRole,
} from '../types/workverify';

interface ExplorerWorkspaceHomeProps {
  user: UserProfileData;
  publicAnalyses: PublicAnalysisHistoryItem[];
  onSwitchRole: (role: PrimaryWorkspaceRole) => Promise<void>;
  onNavigate: (path: string, optionalUrl?: string) => void;
}

export const ExplorerWorkspaceHome: React.FC<ExplorerWorkspaceHomeProps> = ({
  user,
  publicAnalyses,
  onSwitchRole,
  onNavigate,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const otherPrefs = user.onboarding?.otherPrefs || {
    primaryIntent: 'Inspect a public GitHub profile or repo',
    focusNotes: '',
  };

  const handleInspectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('/app/inspector', urlInput.trim());
  };

  return (
    <div className="space-y-8">
      {/* Explorer Header & Immediate URL Inspector */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E2E8E7]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#0B4F4A]">
              <Compass className="w-3.5 h-3.5" />
              <span>Explorer Workspace</span>
              <span>·</span>
              <span>Focus: {otherPrefs.primaryIntent}</span>
              {otherPrefs.focusNotes && (
                <>
                  <span>·</span>
                  <span className="text-[#526362]">{otherPrefs.focusNotes}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111919]">
              Explore Public GitHub Evidence &amp; Role Benchmarks
            </h1>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/onboarding')}
            className="px-3.5 py-1.5 text-xs font-medium text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg self-start"
          >
            Update Focus
          </button>
        </div>

        <form onSubmit={handleInspectSubmit} className="space-y-2.5">
          <label
            htmlFor="explorer-url-input"
            className="block text-xs font-semibold text-[#111919]"
          >
            Inspect any public GitHub repository or developer profile:
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#526362] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="explorer-url-input"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://github.com/owner/repository or https://github.com/username"
                className="w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center justify-center gap-2 shrink-0"
            >
              <span>Inspect GitHub Evidence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </section>

      {/* Recommended Exploration Workflows */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <Search className="w-5 h-5 text-[#0B4F4A]" />
            <h2 className="text-base font-bold text-[#111919]">
              Public GitHub URL Inspector
            </h2>
            <p className="text-xs text-[#526362] leading-relaxed">
              Analyze any open-source repository or profile to inspect 5-signal skill scores, fork isolation, and commit attribution ratios.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/app/inspector')}
            className="text-xs font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
          >
            <span>Open URL Inspector</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <Briefcase className="w-5 h-5 text-[#D97706]" />
            <h2 className="text-base font-bold text-[#111919]">
              Job Description Benchmark
            </h2>
            <p className="text-xs text-[#526362] leading-relaxed">
              Compare any public GitHub URL against one or more job descriptions to see supported skills, gaps, and best-fit engineering roles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/app/job-match')}
            className="text-xs font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
          >
            <span>Open Job Matcher</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <ClipboardCheck className="w-5 h-5 text-[#188078]" />
            <h2 className="text-base font-bold text-[#111919]">
              Candidate &amp; Project Evaluator
            </h2>
            <p className="text-xs text-[#526362] leading-relaxed">
              Run a structured technical assessment with distinct Evidence Strength vs. Role Match scores and commit-grounded interview questions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/app/assess')}
            className="text-xs font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
          >
            <span>Open Evaluator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Recent Public Inspections + Switch to Dedicated Role Workspace */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-[#111919]">
            Recent Public Inspections ({publicAnalyses.length})
          </h2>
          {publicAnalyses.length === 0 ? (
            <p className="text-xs text-[#526362]">
              No public URLs inspected in this session yet. Enter any GitHub URL above to begin.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E8E7] text-xs">
              {publicAnalyses.map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-mono font-semibold text-[#111919]">
                      {item.summaryTitle}
                    </div>
                    <div className="text-[11px] text-[#526362]">
                      {item.targetType} · Top:{' '}
                      {item.topSkills.map((s) => s.skillName).join(', ') || 'None'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('/app/inspector', item.targetUrl)}
                    className="font-semibold text-[#0B4F4A] hover:underline shrink-0"
                  >
                    Re-inspect →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-[#EEF6F5] border border-[#CBE0DD] rounded-xl p-6 space-y-4 text-xs">
          <h2 className="text-base font-bold text-[#111919]">
            Switch to a Specialized Workspace
          </h2>
          <p className="text-[#263333] leading-relaxed">
            Ready to connect your own GitHub repositories as a Developer or manage a hiring pipeline as a Recruiter? Activate either workspace below in one click.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => void onSwitchRole('developer')}
              className="px-3.5 py-2 font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Switch to Developer Workspace</span>
            </button>
            <button
              type="button"
              onClick={() => void onSwitchRole('recruiter')}
              className="px-3.5 py-2 font-semibold text-[#111919] bg-white border border-[#CBD5D4] hover:bg-[#F8F9F8] rounded-lg inline-flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Switch to Recruiter Workspace</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
