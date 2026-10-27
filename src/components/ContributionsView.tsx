import React, { useState, useMemo } from 'react';
import { ExternalLink, GitCommit, GitPullRequest, Info } from 'lucide-react';
import { NormalizedRepository, WorkCategory } from '../types/workverify';

interface ContributionsViewProps {
  repositories: NormalizedRepository[];
  githubUsername: string;
}

const WORK_CATEGORIES: WorkCategory[] = [
  'Feature Development',
  'Bug Fixing',
  'Testing & Quality',
  'Documentation',
  'Maintenance & Config',
];

export const ContributionsView: React.FC<ContributionsViewProps> = ({
  repositories,
  githubUsername,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | WorkCategory>('all');
  const [onlySubstantive, setOnlySubstantive] = useState(false);

  const allCommits = useMemo(() => {
    const list: {
      repoName: string;
      isFork: boolean;
      sha: string;
      message: string;
      date: string;
      authorLogin: string;
      htmlUrl: string;
      additions: number;
      deletions: number;
      isCandidateAttributed: boolean;
      isSubstantiveChange: boolean;
      workCategory: WorkCategory;
      meaningfulFilesChanged: string[];
    }[] = [];

    for (const repo of repositories) {
      for (const c of repo.commits) {
        list.push({
          repoName: repo.name,
          isFork: repo.isFork,
          sha: c.sha,
          message: c.message,
          date: c.date,
          authorLogin: c.authorLogin,
          htmlUrl: c.htmlUrl,
          additions: c.additions,
          deletions: c.deletions,
          isCandidateAttributed: c.isCandidateAttributed,
          isSubstantiveChange: c.isSubstantiveChange,
          workCategory: c.workCategory,
          meaningfulFilesChanged: c.meaningfulFilesChanged,
        });
      }
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [repositories]);

  const allPullRequests = useMemo(() => {
    const prs: {
      repoName: string;
      number: number;
      title: string;
      state: string;
      createdAt: string;
      mergedAt?: string | null;
      authorLogin: string;
      htmlUrl: string;
    }[] = [];

    for (const repo of repositories) {
      for (const pr of repo.pullRequests || []) {
        prs.push({
          repoName: repo.name,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          createdAt: pr.createdAt,
          mergedAt: pr.mergedAt,
          authorLogin: pr.authorLogin,
          htmlUrl: pr.htmlUrl,
        });
      }
    }
    return prs;
  }, [repositories]);

  const categoryTotals = useMemo(() => {
    const totals: Record<WorkCategory, number> = {
      'Feature Development': 0,
      'Bug Fixing': 0,
      'Testing & Quality': 0,
      'Documentation': 0,
      'Maintenance & Config': 0,
    };
    for (const c of allCommits) {
      if (c.isCandidateAttributed) {
        totals[c.workCategory] = (totals[c.workCategory] || 0) + 1;
      }
    }
    return totals;
  }, [allCommits]);

  const filteredCommits = useMemo(() => {
    return allCommits.filter((c) => {
      if (selectedCategory !== 'all' && c.workCategory !== selectedCategory) return false;
      if (onlySubstantive && !c.isSubstantiveChange) return false;
      return true;
    });
  }, [allCommits, selectedCategory, onlySubstantive]);

  const totalAttributed = allCommits.filter((c) => c.isCandidateAttributed).length;
  const totalSubstantive = allCommits.filter((c) => c.isSubstantiveChange).length;

  return (
    <div className="space-y-6">
      {/* Header & Step 6 Methodology Disclosure */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="pb-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">
            Contribution &amp; Commit Attribution Analysis
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Evaluates commit authorship, file-level code modifications, work classification, and temporal continuity for <span className="font-mono font-medium text-slate-900">@{githubUsername}</span>. Raw commit counts are never used as a direct proxy for skill—many tiny 1–2 line edits do not inflate evidence scores.
          </p>
        </div>

        {/* Work Category Distribution */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-6">
          {WORK_CATEGORIES.map((cat) => {
            const count = categoryTotals[cat] || 0;
            const pct = totalAttributed > 0 ? Math.round((count / totalAttributed) * 100) : 0;
            return (
              <div key={cat} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs font-medium text-slate-600">{cat}</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {count}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Out of <strong className="font-mono tabular-nums text-slate-900">{allCommits.length}</strong> sampled commits across repositories,{' '}
            <strong className="font-mono tabular-nums text-slate-900">{totalAttributed}</strong> are attributable to <span className="font-mono">@{githubUsername}</span>, and{' '}
            <strong className="font-mono tabular-nums text-emerald-700">{totalSubstantive}</strong> qualify as substantive code changes (modifying non-vendor source files with &ge;8 lines changed outside pure documentation).
          </span>
        </div>
      </section>

      {/* Pull Requests Evidence Section */}
      {allPullRequests.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
            <GitPullRequest className="w-4 h-4 text-slate-700" aria-hidden="true" />
            <span>Verified Pull Request Activity ({allPullRequests.length})</span>
          </h2>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg text-xs">
            {allPullRequests.map((pr) => (
              <div
                key={`${pr.repoName}_${pr.number}`}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <a
                    href={pr.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-slate-900 hover:underline inline-flex items-center gap-1.5"
                  >
                    <span className="font-mono">
                      {pr.repoName} #{pr.number}
                    </span>
                    <span>— {pr.title}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                  </a>
                </div>
                <div className="font-mono tabular-nums text-slate-500 shrink-0">
                  <span>State: {pr.state.toUpperCase()}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{pr.createdAt.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Commit Ledger & Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Categories ({allCommits.length})
            </button>
            {WORK_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={onlySubstantive}
              onChange={(e) => setOnlySubstantive(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span>Substantive source commits only (&ge;8 lines, non-docs)</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Commit &amp; Message</th>
                <th className="py-3 px-3">Repository</th>
                <th className="py-3 px-3">Attribution</th>
                <th className="py-3 px-3">Work Classification</th>
                <th className="py-3 px-3 text-right">Delta (Lines)</th>
                <th className="py-3 px-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredCommits.map((commit) => (
                <tr key={`${commit.repoName}_${commit.sha}`} className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 max-w-md">
                    <div className="flex items-center gap-2">
                      <GitCommit className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <a
                        href={commit.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{commit.sha.slice(0, 7)}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" aria-hidden="true" />
                      </a>
                      <span className="text-slate-800 font-medium truncate">
                        {commit.message}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 font-mono truncate">
                      Files: {commit.meaningfulFilesChanged.join(', ') || 'No non-vendor source files'}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                    {commit.repoName}
                    {commit.isFork && (
                      <span className="text-amber-700 text-[11px]"> (Fork)</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {commit.isCandidateAttributed ? (
                      <span className="text-emerald-700 font-medium">
                        Candidate (@{commit.authorLogin})
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        Upstream (@{commit.authorLogin})
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap">
                    <span>{commit.workCategory}</span>
                    {!commit.isSubstantiveChange && commit.isCandidateAttributed && (
                      <span className="text-slate-400 text-[11px]"> · Minor edit</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    <span className="text-emerald-700">+{commit.additions}</span>{' '}
                    <span className="text-slate-400">/</span>{' '}
                    <span className="text-rose-700">-{commit.deletions}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {commit.date.slice(0, 10)}
                  </td>
                </tr>
              ))}
              {filteredCommits.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-xs text-slate-500">
                    No commits match the selected category filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
