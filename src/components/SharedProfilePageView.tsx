import React, { useEffect, useState } from 'react';
import {
  Lock,
  ShieldCheck,
  ExternalLink,
  FolderGit2,
  GitCommit,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { UserProfileData } from '../types/workverify';
import { renderBandIndicator } from './SkillEvidenceView';
import { apiFetch } from '../lib/apiClient';
import {
  MatchScoreRing,
  TechStackDistributionBar,
  EngineeringRigorGrid,
  EvidenceMeterBar,
} from './VisualAssets';

interface SharedProfilePageViewProps {
  slug: string;
  onNavigate: (path: string) => void;
  onEvaluateCandidateInRecruiter: (targetUrl: string) => void;
}

export const SharedProfilePageView: React.FC<SharedProfilePageViewProps> = ({
  slug,
  onNavigate,
  onEvaluateCandidateInRecruiter,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'FOUND_PUBLIC' | 'PRIVATE_PROFILE' | 'NOT_FOUND' | 'ERROR'>(
    'NOT_FOUND'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [profile, setProfile] = useState<UserProfileData | null>(null);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch(`/api/recruiter/profile/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!active) return;

        if (res.status === 403 || data.status === 'PRIVATE_PROFILE') {
          setStatus('PRIVATE_PROFILE');
          setErrorMessage(
            data.error ||
              'This WorkVerify profile is set to Private by its owner and cannot be accessed externally.'
          );
          setProfile(null);
        } else if (!res.ok || !data.profile) {
          setStatus('NOT_FOUND');
          setErrorMessage(data.error || 'No published WorkVerify profile exists at this URL.');
          setProfile(null);
        } else {
          setStatus('FOUND_PUBLIC');
          setProfile(data.profile);
        }
      } catch (err: any) {
        if (!active) return;
        setStatus('ERROR');
        setErrorMessage(err.message || 'Failed to load shared profile.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
        <div className="h-6 w-64 bg-slate-100 rounded" />
        <div className="h-4 w-96 bg-slate-100 rounded" />
      </div>
    );
  }

  if (status !== 'FOUND_PUBLIC' || !profile) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {status === 'PRIVATE_PROFILE'
              ? 'This WorkVerify Profile is Private'
              : 'Profile Not Found or Unpublished'}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">{errorMessage}</p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/analyze')}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
            >
              Analyze a Public GitHub URL
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const originalRepos = profile.normalizedRepositories.filter((r) => !r.isFork);
  const forkedRepos = profile.normalizedRepositories.filter((r) => r.isFork);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Published WorkVerify Technical Dossier</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{profile.fullName}</h1>
            <p className="text-xs text-slate-600">
              {profile.roleTitle} · GitHub:{' '}
              <span className="font-mono font-semibold">@{profile.githubUsername}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {profile.githubProfileUrl && (
              <a
                href={profile.githubProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5"
              >
                GitHub Profile
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {profile.githubUsername && (
              <button
                type="button"
                onClick={() =>
                  onEvaluateCandidateInRecruiter(
                    `https://github.com/${profile.githubUsername}`
                  )
                }
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5"
              >
                Evaluate Against a Job Description
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Visual Primary Dossier Overview */}
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Original vs Forked Repositories Visual Bar */}
            <div className="lg:col-span-5 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Codebase Ownership
                </span>
                <span className="text-xs font-mono font-bold text-teal-800">
                  {originalRepos.length} Original · {forkedRepos.length} Forks Isolated
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  title="Original Repositories"
                  style={{
                    width: `${
                      profile.normalizedRepositories.length > 0
                        ? (originalRepos.length / profile.normalizedRepositories.length) * 100
                        : 100
                    }%`,
                  }}
                  className="bg-teal-700 h-full transition-all"
                />
                <div
                  title="Forked Repositories"
                  style={{
                    width: `${
                      profile.normalizedRepositories.length > 0
                        ? (forkedRepos.length / profile.normalizedRepositories.length) * 100
                        : 0
                    }%`,
                  }}
                  className="bg-amber-600 h-full transition-all"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-700" />
                  <span>Authored Source ({originalRepos.length})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  <span>Isolated Forks ({forkedRepos.length})</span>
                </span>
              </div>
            </div>

            {/* Verified Skills Match Ring */}
            <div className="lg:col-span-3 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-around gap-3">
              <MatchScoreRing
                score={
                  profile.skillAssessments.length > 0
                    ? Math.round(
                        (profile.skillAssessments.filter(
                          (s) =>
                            s.evidenceBand === 'Strong Evidence' ||
                            s.evidenceBand === 'Moderate Evidence'
                        ).length /
                          profile.skillAssessments.length) *
                          100
                      )
                    : 0
                }
                size={76}
                label="Verified"
                customColor="#0F766E"
              />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-900">Verified Skills</div>
                <div className="text-sm font-mono font-bold text-teal-800">
                  {
                    profile.skillAssessments.filter(
                      (s) =>
                        s.evidenceBand === 'Strong Evidence' ||
                        s.evidenceBand === 'Moderate Evidence'
                    ).length
                  }{' '}
                  / {profile.skillAssessments.length}
                </div>
                <div className="text-[10px] text-slate-500">Strong / Moderate</div>
              </div>
            </div>

            {/* Engineering Rigor Highlights */}
            <div className="lg:col-span-4 p-4 bg-teal-50/70 border border-teal-200 rounded-xl flex flex-col justify-between gap-2">
              <div className="text-xs text-teal-900 font-semibold uppercase tracking-wider">
                Engineering Integrity
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-white border border-teal-100 rounded-lg">
                  <div className="text-slate-500 text-[10px]">Attributed Commits</div>
                  <div className="font-mono font-bold text-slate-900">
                    {profile.normalizedRepositories.reduce((acc, r) => acc + r.candidateAttributedCommits, 0)}
                  </div>
                </div>
                <div className="p-2 bg-white border border-teal-100 rounded-lg">
                  <div className="text-slate-500 text-[10px]">Test Coverage</div>
                  <div className="font-mono font-bold text-teal-900">
                    {profile.normalizedRepositories.some((r) => r.meaningfulFilePaths.some((f) => /test|spec/i.test(f)))
                      ? 'Automated Tests'
                      : 'None Detected'}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-teal-800">
                Verified against public GitHub commit history
              </div>
            </div>
          </div>

          {/* Tech Stack Distribution */}
          {profile.skillAssessments.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <TechStackDistributionBar
                items={profile.skillAssessments.slice(0, 7).map((s) => ({
                  name: s.skillName,
                  count: s.evidenceScore,
                }))}
                title="Verified Technology Stack"
              />
            </div>
          )}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Verified Technical Skill Evidence Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Multi-signal scorecards computed from source files, dependency manifests, and commit authorship
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
            {profile.skillAssessments.length} skills analyzed
          </span>
        </div>

        {profile.skillAssessments.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            No repository skill assessments have been recorded for this profile yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.skillAssessments.map((s) => {
              const isStrong = s.evidenceBand === 'Strong Evidence';
              const isModerate = s.evidenceBand === 'Moderate Evidence';
              return (
                <div
                  key={s.skillName}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                    isStrong
                      ? 'bg-teal-50/40 border-teal-200'
                      : isModerate
                      ? 'bg-white border-slate-200'
                      : 'bg-amber-50/40 border-amber-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-medium text-slate-500">
                        {s.category}
                      </span>
                      {renderBandIndicator(s.evidenceBand)}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{s.skillName}</h4>
                        <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                          {s.positiveSignals[0] || 'Observed in public code evidence.'}
                        </p>
                      </div>
                      <MatchScoreRing
                        score={s.evidenceScore}
                        size={52}
                        strokeWidth={4}
                        customColor={isStrong ? '#0F766E' : isModerate ? '#14B8A6' : '#D97706'}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-500">
                    {s.supportingRepos.map((sr) => (
                      <span
                        key={sr.repoName}
                        className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded inline-flex items-center gap-1"
                      >
                        <FolderGit2 className="w-3 h-3" />
                        <span>{sr.repoName} ({sr.attributedCommitsCount}c)</span>
                      </span>
                    ))}
                    {s.supportingRepos.length === 0 && (
                      <span className="text-slate-400">No public repos</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong>Evidence Limitations Disclosure: </strong>
          This profile reflects public GitHub repositories and sampled commit metadata at the time
          of analysis. Private enterprise work is not included.
        </div>
      </section>
    </div>
  );
};
