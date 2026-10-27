import React, { useState } from 'react';
import {
  ExternalLink,
  ShieldAlert,
  Share2,
  Lock,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { UserProfileData } from '../types/workverify';
import { renderBandIndicator } from './SkillEvidenceView';

interface RecruiterViewProps {
  user: UserProfileData;
  onTogglePublicProfile: (nextPublic: boolean) => Promise<void>;
}

export const RecruiterView: React.FC<RecruiterViewProps> = ({
  user,
  onTogglePublicProfile,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [bandFilter, setBandFilter] = useState<'all' | 'claimed' | 'strong' | 'gaps'>('all');

  const shareUrl = `${window.location.origin}/profile/${encodeURIComponent(
    user.profileSlug
  )}`;

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleVisibilityToggle = async () => {
    setIsToggling(true);
    try {
      await onTogglePublicProfile(!user.isPublicProfile);
    } finally {
      setIsToggling(false);
    }
  };

  const filteredSkills = user.skillAssessments.filter((s) => {
    if (bandFilter === 'claimed') return s.claimedByUser;
    if (bandFilter === 'strong')
      return s.evidenceBand === 'Strong Evidence' || s.evidenceBand === 'Moderate Evidence';
    if (bandFilter === 'gaps')
      return s.evidenceBand === 'Insufficient Evidence' || s.evidenceBand === 'Weak Evidence';
    return true;
  });

  const originalRepos = user.normalizedRepositories.filter((r) => !r.isFork);
  const forkedRepos = user.normalizedRepositories.filter((r) => r.isFork);

  return (
    <div className="space-y-6">
      {/* Step 10: Publication & Recruiter Access Governance Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              {user.isPublicProfile ? (
                <>
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Public Shareable Recruiter Profile Active</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                  <span>Profile Currently Private (Hidden from External Recruiters)</span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600 max-w-2xl">
              By default, WorkVerify profiles remain private. When you publish your profile, recruiters with your link can inspect your claimed skills, supporting repository links, and evidence limitations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {user.isPublicProfile && (
              <button
                type="button"
                onClick={handleCopyShareUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span>Copied Recruiter URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy Shareable Link</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              disabled={isToggling}
              onClick={handleVisibilityToggle}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                user.isPublicProfile
                  ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {user.isPublicProfile ? 'Make Profile Private' : 'Publish Shareable Profile'}
            </button>
          </div>
        </div>
      </section>

      {/* Step 11: Recruiter Verification Dossier */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500">
              WorkVerify Technical Evidence Dossier · Recruiter Review Mode
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{user.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>{user.roleTitle}</span>
              <span aria-hidden="true">·</span>
              {user.githubUsername ? (
                <a
                  href={user.githubProfileUrl || `https://github.com/${user.githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
                >
                  <span>github.com/{user.githubUsername}</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              ) : (
                <span>No GitHub Connected</span>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Assessment Date:{' '}
                {user.lastAnalyzedAt ? user.lastAnalyzedAt.slice(0, 10) : 'Not Assessed'}
              </span>
            </div>
            {user.bio && <p className="mt-2.5 text-sm text-slate-700 max-w-3xl">{user.bio}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs shrink-0">
            <div>
              <div className="text-slate-500">Original Repos</div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                {originalRepos.length}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Forks Isolated</div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-700">
                {forkedRepos.length}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Substantive Commits</div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
                {originalRepos.reduce((acc, r) => acc + r.substantiveAttributedCommits, 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar for Recruiter Inspection */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">
            Claimed Skills vs. Verifiable Repository Evidence
          </h2>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setBandFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                bandFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({user.skillAssessments.length})
            </button>
            <button
              type="button"
              onClick={() => setBandFilter('claimed')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                bandFilter === 'claimed'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Candidate Claimed ({user.claimedSkills.length})
            </button>
            <button
              type="button"
              onClick={() => setBandFilter('strong')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                bandFilter === 'strong'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Strong / Moderate
            </button>
            <button
              type="button"
              onClick={() => setBandFilter('gaps')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                bandFilter === 'gaps'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weak / Uncorroborated Claims
            </button>
          </div>
        </div>

        {/* Detailed Skill Cards for Recruiter Review */}
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
          {filteredSkills.map((skill) => (
            <div key={skill.skillName} className="p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">
                      {skill.skillName}
                    </span>
                    <span className="text-xs text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs text-slate-600">
                      {skill.claimedByUser ? 'Candidate Claimed' : 'System Detected (Unclaimed)'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  {renderBandIndicator(skill.evidenceBand)}
                  <span className="font-mono tabular-nums font-semibold text-slate-700">
                    Evidence Score: {skill.evidenceScore}/100
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs pt-1">
                <div>
                  <div className="font-semibold text-slate-800 mb-1">
                    What WorkVerify Established:
                  </div>
                  {skill.positiveSignals.length > 0 ? (
                    <ul className="space-y-1 text-slate-600">
                      {skill.positiveSignals.map((sig, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2
                            className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{sig}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">
                      No substantive candidate-attributed source evidence established in original repositories.
                    </p>
                  )}
                </div>

                <div>
                  <div className="font-semibold text-slate-800 mb-1">
                    Missing Evidence &amp; Verification Boundaries:
                  </div>
                  {skill.missingOrWeakSignals.length > 0 ? (
                    <ul className="space-y-1 text-rose-700">
                      {skill.missingOrWeakSignals.map((sig, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <AlertTriangle
                            className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{sig}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-600">
                      Corroborated across repository manifests, non-vendor source files, and attributed commit history.
                    </p>
                  )}
                </div>
              </div>

              {/* Direct Repository & Commit Proof Links */}
              <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Inspect Source Links:</span>
                {skill.supportingRepos.map((r) => (
                  <a
                    key={r.fullName}
                    href={r.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-slate-900 hover:underline inline-flex items-center gap-1"
                  >
                    <span>
                      {r.repoName}
                      {r.isFork ? ' (Fork)' : ''}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  </a>
                ))}
                {skill.supportingCommits.slice(0, 3).map((c) => (
                  <a
                    key={c.sha}
                    href={c.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-slate-600 hover:text-slate-900 hover:underline inline-flex items-center gap-1"
                  >
                    <span>commit:{c.shortSha}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Section 8: Mandatory Disclosure — What WorkVerify Does Not Guarantee */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <ShieldAlert className="w-4 h-4 text-slate-700" aria-hidden="true" />
            <span>What WorkVerify Establishes vs. What It Does Not Guarantee</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            WorkVerify connects claimed technical skills to observable, deterministic signals in public GitHub repositories. However, public GitHub data alone cannot conclusively prove or disprove a developer&apos;s engineering competence:
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
            <li>
              • <strong>Attribution &amp; Shared Repos:</strong> Git commit author metadata can be configured locally; shared team repositories or pair-programming sessions may under-represent or over-represent individual authorship.
            </li>
            <li>
              • <strong>Private Enterprise Work:</strong> Code written inside private corporate GitHub organizations, GitLab instances, or internal monorepos is not visible in a public-scope assessment.
            </li>
            <li>
              • <strong>Evidence Strength &ne; Expertise Percentage:</strong> A score of 85/100 means strong multi-repository public evidence was found—not that the candidate knows &ldquo;85% of React.&rdquo;
            </li>
            <li>
              • <strong>Human Review Required:</strong> WorkVerify is designed to make technical screening structured and explainable, never to automate hiring rejections.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};
