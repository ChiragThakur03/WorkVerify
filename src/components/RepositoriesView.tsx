import React, { useState, useMemo } from 'react';
import {
  ExternalLink,
  GitFork,
  FileCode2,
  Package,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { NormalizedRepository } from '../types/workverify';

interface RepositoriesViewProps {
  repositories: NormalizedRepository[];
  githubUsername: string;
}

export const RepositoriesView: React.FC<RepositoriesViewProps> = ({
  repositories,
  githubUsername,
}) => {
  const [repoFilter, setRepoFilter] = useState<'all' | 'original' | 'forked' | 'insufficient'>('all');
  const [expandedRepoId, setExpandedRepoId] = useState<string | null>(
    repositories[0]?.id || null
  );

  const filteredRepos = useMemo(() => {
    return repositories.filter((repo) => {
      if (repoFilter === 'original') return !repo.isFork && !repo.isEmptyOrInsufficient;
      if (repoFilter === 'forked') return repo.isFork;
      if (repoFilter === 'insufficient') return repo.isEmptyOrInsufficient || (!repo.isFork && repo.substantiveAttributedCommits === 0);
      return true;
    });
  }, [repositories, repoFilter]);

  const totalExcludedArtifacts = repositories.reduce(
    (acc, r) => acc + r.excludedVendorFilesCount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header & Data Normalization Summary (Steps 3, 4, 5) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Repository Normalization &amp; Technology Detection
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-3xl">
              Displays normalized public repositories for <span className="font-mono font-medium text-slate-900">@{githubUsername}</span>. Forked repositories are explicitly isolated, and generated/vendor lockfiles (<code className="font-mono text-xs">node_modules</code>, <code className="font-mono text-xs">dist</code>, <code className="font-mono text-xs">package-lock.json</code>) are excluded prior to technology detection.
            </p>
          </div>

          {/* Interactive Filter Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setRepoFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                repoFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({repositories.length})
            </button>
            <button
              type="button"
              onClick={() => setRepoFilter('original')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                repoFilter === 'original'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Original Verified
            </button>
            <button
              type="button"
              onClick={() => setRepoFilter('forked')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                repoFilter === 'forked'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Forks Isolated ({repositories.filter((r) => r.isFork).length})
            </button>
            <button
              type="button"
              onClick={() => setRepoFilter('insufficient')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                repoFilter === 'insufficient'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Limited / Sandbox
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-5 text-xs">
          <div>
            <span className="text-slate-500">Original Source Repos</span>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
              {repositories.filter((r) => !r.isFork).length}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Forked Repos Isolated</span>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-700">
              {repositories.filter((r) => r.isFork).length}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Meaningful Source Files</span>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
              {repositories.reduce((acc, r) => acc + r.meaningfulFilePaths.length, 0)}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Vendor / Lockfiles Excluded</span>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-700">
              {totalExcludedArtifacts}
            </div>
          </div>
        </div>
      </section>

      {/* Repository List */}
      <div className="space-y-4">
        {filteredRepos.map((repo) => {
          const isExpanded = expandedRepoId === repo.id;
          return (
            <article
              key={repo.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-bold font-mono text-slate-900 hover:underline inline-flex items-center gap-1.5"
                      >
                        <span>{repo.fullName}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      </a>
                      <span aria-hidden="true">·</span>
                      {repo.isFork ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <GitFork className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Forked Repository (Isolated from primary skill attribution)</span>
                        </span>
                      ) : repo.substantiveAttributedCommits === 0 ? (
                        <span className="inline-flex items-center gap-1 font-medium text-rose-700">
                          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Insufficient Substantive Commits</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Original Authored Repository</span>
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-600">
                      {repo.description || 'No repository description provided.'}
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                      <span>Primary: {repo.primaryLanguage || 'Unspecified'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{repo.meaningfulFilePaths.length} meaningful files</span>
                      <span aria-hidden="true">·</span>
                      <span>{repo.excludedVendorFilesCount} vendor/lockfile excluded</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {repo.candidateAttributedCommits}/{repo.totalCommitsSampled} attributed commits
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Span: {repo.activitySpanDays}d</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedRepoId(isExpanded ? null : repo.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>{isExpanded ? 'Hide Evidence Tree' : 'Inspect Signals & Files'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Detected Technologies Summary Line */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <span className="font-semibold text-slate-700">Detected Signals:</span>
                  {repo.detectedTechnologies.length === 0 ? (
                    <span className="text-slate-500">None detected</span>
                  ) : (
                    repo.detectedTechnologies.map((tech, idx) => (
                      <React.Fragment key={tech.skillName}>
                        {idx > 0 && <span className="text-slate-300" aria-hidden="true">/</span>}
                        <span className="text-slate-800">
                          <strong className="font-semibold">{tech.skillName}</strong>{' '}
                          <span className="text-slate-500 font-mono tabular-nums">
                            ({tech.matchingSourceFiles.length} files, {tech.attributedCommitCount} commits
                            {tech.fromManifest ? ', manifest' : ''})
                          </span>
                        </span>
                      </React.Fragment>
                    ))
                  )}
                </div>

                {/* Data Quality & Normalization Disclosures */}
                {repo.dataQualityNotes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    {repo.dataQualityNotes.map((note, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-slate-400">•</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Expanded Deep Inspection Drawer */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                  {/* Left: Dependency Manifests & Meaningful Source Tree */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-slate-900 flex items-center gap-1.5 mb-2">
                        <Package className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                        <span>Inspected Dependency Manifests ({repo.manifests.length})</span>
                      </h4>
                      {repo.manifests.length === 0 ? (
                        <p className="text-slate-500">No root dependency manifest found.</p>
                      ) : (
                        <div className="space-y-2">
                          {repo.manifests.map((m) => (
                            <div
                              key={m.fileName}
                              className="p-3 bg-white border border-slate-200 rounded-lg"
                            >
                              <div className="font-mono font-semibold text-slate-900">
                                {m.fileName}
                              </div>
                              <div className="mt-1 text-slate-600 font-mono">
                                Dependencies:{' '}
                                {[...(m.dependencies || []), ...(m.devDependencies || [])].join(
                                  ', '
                                ) || 'None'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 flex items-center gap-1.5 mb-2">
                        <FileCode2 className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                        <span>
                          Normalized Source File Paths ({repo.meaningfulFilePaths.length})
                        </span>
                      </h4>
                      <div className="p-3 bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto font-mono text-[11px] text-slate-700 space-y-1">
                        {repo.meaningfulFilePaths.map((fp) => (
                          <div key={fp} className="truncate">
                            {fp}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Sampled Commits & Attribution Status */}
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">
                      Sampled Commit Attribution ({repo.commits.length})
                    </h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {repo.commits.map((commit) => (
                        <div
                          key={commit.sha}
                          className="p-3 bg-white border border-slate-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                            <a
                              href={commit.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
                            >
                              <span>{commit.sha.slice(0, 8)}</span>
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                            <span
                              className={
                                commit.isCandidateAttributed
                                  ? 'text-emerald-700 font-medium'
                                  : 'text-amber-700 font-medium'
                              }
                            >
                              {commit.isCandidateAttributed
                                ? `Attributed (@${commit.authorLogin})`
                                : `External Author (@${commit.authorLogin})`}
                            </span>
                          </div>
                          <p className="mt-1 text-slate-800 font-medium">{commit.message}</p>
                          <div className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                            <span>{commit.workCategory}</span>
                            <span aria-hidden="true"> · </span>
                            <span>
                              +{commit.additions} / -{commit.deletions} lines
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>{commit.meaningfulFilesChanged.length} meaningful file(s)</span>
                            <span aria-hidden="true"> · </span>
                            <span>{commit.date.slice(0, 10)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
