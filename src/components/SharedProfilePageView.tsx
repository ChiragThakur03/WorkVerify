import React, { useEffect, useState } from 'react';
import {
  Lock,
  ShieldCheck,
  ExternalLink,
  FolderGit2,
  GitCommit,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { UserProfileData } from '../types/workverify';
import { renderBandIndicator } from './SkillEvidenceView';
import { apiFetch } from '../lib/apiClient';

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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">Original Repositories</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {originalRepos.length}
            </div>
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">Forked Repositories (Isolated)</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {forkedRepos.length}
            </div>
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">Verified Technologies</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {
                profile.skillAssessments.filter(
                  (s) =>
                    s.evidenceBand === 'Strong Evidence' ||
                    s.evidenceBand === 'Moderate Evidence'
                ).length
              }{' '}
              / {profile.skillAssessments.length}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          Verified Technical Skill Evidence Matrix
        </h2>
        {profile.skillAssessments.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            No repository skill assessments have been recorded for this profile yet.
          </div>
        ) : (
          <div className="space-y-3">
            {profile.skillAssessments.map((s) => (
              <div
                key={s.skillName}
                className="p-4 border border-slate-200 rounded-lg space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">{s.skillName}</span>
                    {renderBandIndicator(s.evidenceBand)}
                  </div>
                  <span className="text-xs font-mono font-bold tabular-nums text-slate-800">
                    Evidence Score: {s.evidenceScore}/100
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {s.positiveSignals[0] || s.missingOrWeakSignals[0] || ''}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-slate-500">
                  {s.supportingRepos.map((sr) => (
                    <span
                      key={sr.repoName}
                      className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded inline-flex items-center gap-1"
                    >
                      <FolderGit2 className="w-3 h-3" />
                      {sr.repoName} ({sr.attributedCommitsCount} commits)
                    </span>
                  ))}
                  {s.supportingCommits.slice(0, 2).map((sc) => (
                    <span
                      key={sc.shortSha}
                      className="px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded inline-flex items-center gap-1"
                    >
                      <GitCommit className="w-3 h-3" />
                      {sc.shortSha}: {sc.message.slice(0, 44)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
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
