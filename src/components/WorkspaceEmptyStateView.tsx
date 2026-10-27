import React, { useState } from 'react';
import {
  Search,
  GitBranch,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { UserProfileData } from '../types/workverify';
import { EmptyInspectionIllustration } from './VisualAssets';

interface WorkspaceEmptyStateViewProps {
  user: UserProfileData;
  isSyncing: boolean;
  onSyncGitHub: (usernameOrUrl: string) => Promise<void>;
  onNavigate: (path: string) => void;
}

export const WorkspaceEmptyStateView: React.FC<WorkspaceEmptyStateViewProps> = ({
  user,
  isSyncing,
  onSyncGitHub,
  onNavigate,
}) => {
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [githubInput, setGithubInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = githubInput.trim();
    if (!cleaned) {
      setErrorMsg('Please enter a public GitHub username or repository URL.');
      return;
    }
    setErrorMsg(null);
    try {
      await onSyncGitHub(cleaned);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not collect GitHub data.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#E2E8E7]">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#0B4F4A]">
              <Lock className="w-3.5 h-3.5" />
              <span>Private Workspace · No Analysis Run Yet</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111919]">
              Welcome to WorkVerify, {user.fullName}
            </h1>

            <p className="text-sm text-[#526362] leading-relaxed">
              Analyze real software-development work and understand the evidence behind technical skills. Choose an action below to begin.
            </p>
          </div>

          <div className="shrink-0">
            <EmptyInspectionIllustration />
          </div>
        </div>

        {/* Three Primary Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            type="button"
            onClick={() => onNavigate('/app/inspector')}
            className="p-5 text-left bg-[#F8F9F8] hover:bg-[#EEF6F5] border border-[#E2E8E7] hover:border-[#0B4F4A] rounded-xl transition-colors flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <Search className="w-5 h-5 text-[#0B4F4A]" />
              <h2 className="text-sm font-semibold text-[#111919]">
                Inspect a public GitHub URL
              </h2>
              <p className="text-xs text-[#526362] leading-relaxed">
                Inspect any public repository or profile without connecting it as your identity.
              </p>
            </div>
            <span className="text-xs font-semibold text-[#0B4F4A] inline-flex items-center gap-1">
              <span>Public URL Inspector</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowConnectForm(true)}
            className="p-5 text-left bg-[#F8F9F8] hover:bg-[#EEF6F5] border border-[#E2E8E7] hover:border-[#0B4F4A] rounded-xl transition-colors flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <GitBranch className="w-5 h-5 text-[#0B4F4A]" />
              <h2 className="text-sm font-semibold text-[#111919]">
                Connect my GitHub account
              </h2>
              <p className="text-xs text-[#526362] leading-relaxed">
                Import your public GitHub repositories and commits into your private workspace.
              </p>
            </div>
            <span className="text-xs font-semibold text-[#0B4F4A] inline-flex items-center gap-1">
              <span>Connect GitHub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/app/job-match')}
            className="p-5 text-left bg-[#F8F9F8] hover:bg-[#EEF6F5] border border-[#E2E8E7] hover:border-[#0B4F4A] rounded-xl transition-colors flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <ClipboardCheck className="w-5 h-5 text-[#D97706]" />
              <h2 className="text-sm font-semibold text-[#111919]">
                Evaluate against a job description
              </h2>
              <p className="text-xs text-[#526362] leading-relaxed">
                Compare a public GitHub URL against required and preferred skills in a job description.
              </p>
            </div>
            <span className="text-xs font-semibold text-[#0B4F4A] inline-flex items-center gap-1">
              <span>Job Match &amp; Readiness</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>

        {/* Inline Connect / Analyze GitHub Form */}
        {showConnectForm && (
          <form
            onSubmit={handleConnectSubmit}
            className="p-5 bg-[#EEF6F5] border border-[#CBE0DD] rounded-xl space-y-4"
          >
            <div>
              <label
                htmlFor="empty-workspace-gh-input"
                className="block text-xs font-semibold text-[#0B4F4A] mb-1.5"
              >
                Enter Your Public GitHub Username or Profile URL
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="empty-workspace-gh-input"
                  type="text"
                  value={githubInput}
                  onChange={(e) => setGithubInput(e.target.value)}
                  placeholder="e.g., https://github.com/octocat or octocat"
                  className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-white border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A]"
                />
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  {isSyncing ? 'Fetching Live GitHub Data...' : 'Import Public Repositories'}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </form>
        )}
      </section>
    </div>
  );
};
