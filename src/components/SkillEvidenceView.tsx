import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Check,
  AlertTriangle,
  HelpCircle,
  XCircle,
  ExternalLink,
  Plus,
  Trash2,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  UserProfileData,
  SkillAssessmentResult,
  SupportedSkillCatalogItem,
  EvidenceBand,
} from '../types/workverify';
import { EvidenceMeterBar } from './VisualAssets';

interface SkillEvidenceViewProps {
  user: UserProfileData;
  supportedCatalog: SupportedSkillCatalogItem[];
  onUpdateClaims: (skills: string[]) => Promise<void>;
  onSyncGitHub: (username?: string) => Promise<void>;
  onNavigateTab: (tab: 'evidence' | 'repositories' | 'contributions' | 'recruiter' | 'settings') => void;
  isSyncing: boolean;
}

export function renderBandIndicator(band: EvidenceBand) {
  switch (band) {
    case 'Strong Evidence':
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#0B4F4A] whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0B4F4A]" aria-hidden="true" />
          <span>Strong Evidence</span>
        </span>
      );
    case 'Moderate Evidence':
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#188078] whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#188078]" aria-hidden="true" />
          <span>Moderate Evidence</span>
        </span>
      );
    case 'Weak Evidence':
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-[#B45309] whitespace-nowrap">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#D97706]" aria-hidden="true" />
          <span>Weak Evidence</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-[#526362] whitespace-nowrap">
          <XCircle className="w-4 h-4 shrink-0 text-[#526362]" aria-hidden="true" />
          <span>Insufficient Evidence</span>
        </span>
      );
  }
}

export const SkillEvidenceView: React.FC<SkillEvidenceViewProps> = ({
  user,
  supportedCatalog,
  onUpdateClaims,
  onSyncGitHub,
  onNavigateTab,
  isSyncing,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'claimed' | 'strong' | 'insufficient'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newSkillInput, setNewSkillInput] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isUpdatingClaims, setIsUpdatingClaims] = useState(false);
  const [selectedSkillName, setSelectedSkillName] = useState<string>(
    user.skillAssessments[0]?.skillName || 'React'
  );

  const filteredAssessments = useMemo(() => {
    return user.skillAssessments.filter((item) => {
      if (filterMode === 'claimed' && !item.claimedByUser) return false;
      if (
        filterMode === 'strong' &&
        item.evidenceBand !== 'Strong Evidence' &&
        item.evidenceBand !== 'Moderate Evidence'
      ) {
        return false;
      }
      if (
        filterMode === 'insufficient' &&
        item.evidenceBand !== 'Insufficient Evidence' &&
        item.evidenceBand !== 'Weak Evidence'
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.skillName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.evidenceBand.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [user.skillAssessments, filterMode, searchQuery]);

  const activeAssessment: SkillAssessmentResult | undefined = useMemo(() => {
    return (
      user.skillAssessments.find(
        (s) => s.skillName.toLowerCase() === selectedSkillName.toLowerCase()
      ) ||
      filteredAssessments[0] ||
      user.skillAssessments[0]
    );
  }, [user.skillAssessments, filteredAssessments, selectedSkillName]);

  const handleAddSkillClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (!trimmed) {
      setClaimError('Enter a technical skill or select one from the catalog before adding a claim.');
      return;
    }
    if (user.claimedSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setClaimError(`"${trimmed}" is already in your claimed skills list.`);
      return;
    }

    setClaimError(null);
    setIsUpdatingClaims(true);
    try {
      const nextClaims = [...user.claimedSkills, trimmed];
      await onUpdateClaims(nextClaims);
      setSelectedSkillName(trimmed);
      setNewSkillInput('');
    } finally {
      setIsUpdatingClaims(false);
    }
  };

  const handleRemoveSkillClaim = async (skillToRemove: string) => {
    setIsUpdatingClaims(true);
    try {
      const nextClaims = user.claimedSkills.filter(
        (s) => s.toLowerCase() !== skillToRemove.toLowerCase()
      );
      await onUpdateClaims(nextClaims);
    } finally {
      setIsUpdatingClaims(false);
    }
  };

  const handleQuickClaimToggle = async (skillName: string) => {
    const exists = user.claimedSkills.some(
      (s) => s.toLowerCase() === skillName.toLowerCase()
    );
    if (exists) {
      await handleRemoveSkillClaim(skillName);
    } else {
      setIsUpdatingClaims(true);
      try {
        await onUpdateClaims([...user.claimedSkills, skillName]);
        setSelectedSkillName(skillName);
      } finally {
        setIsUpdatingClaims(false);
      }
    }
  };

  const originalReposCount = user.normalizedRepositories.filter((r) => !r.isFork).length;
  const forkedReposCount = user.normalizedRepositories.filter((r) => r.isFork).length;
  const strongClaimsCount = user.skillAssessments.filter(
    (s) => s.claimedByUser && s.evidenceBand === 'Strong Evidence'
  ).length;
  const insufficientClaimsCount = user.skillAssessments.filter(
    (s) =>
      s.claimedByUser &&
      (s.evidenceBand === 'Insufficient Evidence' || s.evidenceBand === 'Weak Evidence')
  ).length;

  if (!user.githubConnected || user.normalizedRepositories.length === 0) {
    return (
      <div className="bg-white border border-[#E2E8E7] rounded-xl p-8">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-xl font-bold text-[#111919]">
            No GitHub Evidence Connected Yet
          </h2>
          <p className="text-sm text-[#526362] leading-relaxed">
            Connect a GitHub account in Settings or analyze a public GitHub URL to inspect skill verification.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors"
            >
              Configure GitHub Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Essential Top Analysis Summary */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#E2E8E7]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#526362]">
              <span className="font-semibold text-[#111919]">{user.fullName}</span>
              <span>·</span>
              <span className="font-mono text-[#0B4F4A]">@{user.githubUsername}</span>
              <span>·</span>
              <span>{user.roleTitle}</span>
              <span>·</span>
              <span className="font-mono">
                Assessed{' '}
                {user.lastAnalyzedAt
                  ? new Date(user.lastAnalyzedAt).toISOString().slice(0, 10)
                  : 'N/A'}
              </span>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#111919]">
              Skill Claim &amp; Work Evidence Verification
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onSyncGitHub(user.githubUsername)}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isSyncing ? 'Refreshing...' : 'Refresh Evidence'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('recruiter')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors"
            >
              Open Recruiter Dossier
            </button>
          </div>
        </div>

        {/* Clean 4-Metric Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          <div>
            <div className="text-[#526362]">Claimed Skills</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#111919]">
              {user.claimedSkills.length}
            </div>
            <div className="mt-0.5 text-[#526362]">
              <span className="font-mono font-semibold text-[#0B4F4A]">
                {strongClaimsCount}
              </span>{' '}
              strong ·{' '}
              <span className="font-mono font-semibold text-[#B45309]">
                {insufficientClaimsCount}
              </span>{' '}
              weak/insufficient
            </div>
          </div>

          <div>
            <div className="text-[#526362]">Analyzed Repositories</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#111919]">
              {user.normalizedRepositories.length}
            </div>
            <div className="mt-0.5 text-[#526362]">
              <span className="font-mono font-semibold text-[#0B4F4A]">
                {originalReposCount}
              </span>{' '}
              original ·{' '}
              <span className="font-mono font-semibold text-[#B45309]">
                {forkedReposCount}
              </span>{' '}
              forks isolated
            </div>
          </div>

          <div>
            <div className="text-[#526362]">Attributed Commits</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#111919]">
              {user.normalizedRepositories.reduce(
                (acc, r) => acc + r.candidateAttributedCommits,
                0
              )}
            </div>
            <div className="mt-0.5 text-[#526362]">
              <span className="font-mono font-semibold text-[#0B4F4A]">
                {user.normalizedRepositories.reduce(
                  (acc, r) => acc + r.substantiveAttributedCommits,
                  0
                )}
              </span>{' '}
              substantive source commits
            </div>
          </div>

          <div>
            <div className="text-[#526362]">Sharing Visibility</div>
            <div className="mt-1 text-base font-bold text-[#111919]">
              {user.isPublicProfile ? 'Published Link' : 'Private Workspace'}
            </div>
            <div className="mt-0.5 text-[#526362] font-mono truncate">
              /profile/{user.profileSlug}
            </div>
          </div>
        </div>
      </section>

      {/* Claimed Skills Input Bar */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#111919]">
              Claimed Technical Skills
            </h2>
            <p className="text-xs text-[#526362]">
              Select or add skills you claim on your resume to verify how strongly your repositories support them.
            </p>
          </div>

          <form onSubmit={handleAddSkillClaim} className="flex items-center gap-2 w-full lg:w-auto">
            <div className="flex-1 lg:w-64">
              <label htmlFor="skill-claim-input" className="sr-only">
                Add Claimed Technical Skill
              </label>
              <input
                id="skill-claim-input"
                type="text"
                list="supported-skills-datalist"
                value={newSkillInput}
                onChange={(e) => {
                  setNewSkillInput(e.target.value);
                  if (claimError) setClaimError(null);
                }}
                placeholder="e.g., React, Python, Node.js..."
                className="w-full px-3 py-2 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A]"
              />
              <datalist id="supported-skills-datalist">
                {supportedCatalog.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.category}
                  </option>
                ))}
              </datalist>
            </div>
            <button
              type="submit"
              disabled={isUpdatingClaims}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Verify Claim</span>
            </button>
          </form>
        </div>

        {claimError && (
          <p role="alert" className="text-xs font-medium text-[#B91C1C]">
            {claimError}
          </p>
        )}

        <div className="pt-3 border-t border-[#E2E8E7] flex flex-wrap items-center gap-2">
          {supportedCatalog.map((cat) => {
            const isClaimed = user.claimedSkills.some(
              (s) => s.toLowerCase() === cat.name.toLowerCase()
            );
            return (
              <button
                key={cat.name}
                type="button"
                disabled={isUpdatingClaims}
                onClick={() => handleQuickClaimToggle(cat.name)}
                aria-pressed={isClaimed}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  isClaimed
                    ? 'bg-[#0B4F4A] text-white'
                    : 'bg-[#F2F5F4] text-[#263333] hover:bg-[#E2E8E7]'
                }`}
              >
                {isClaimed ? (
                  <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
                ) : (
                  <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                )}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Two-Column Split: Left = Skill Evidence Table, Right = Deterministic Evidence Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-[#E2E8E7] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#E2E8E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#F8F9F8] border border-[#E2E8E7] rounded-lg overflow-x-auto">
              {(
                [
                  ['all', `All (${user.skillAssessments.length})`],
                  ['claimed', `Claimed (${user.claimedSkills.length})`],
                  ['strong', 'Strong / Moderate'],
                  ['insufficient', 'Weak / Insufficient'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    filterMode === mode
                      ? 'bg-[#0B4F4A] text-white'
                      : 'text-[#526362] hover:text-[#111919]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-48">
              <Search
                className="w-3.5 h-3.5 text-[#526362] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Filter assessed skills"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skill..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8E7] bg-[#F8F9F8] text-[11px] font-semibold text-[#526362]">
                  <th className="py-3 px-4 whitespace-nowrap">Skill &amp; Claim</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">Evidence Band</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Score</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap">Repos / Commits</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E7] text-xs">
                {filteredAssessments.map((item) => {
                  const isSelected =
                    activeAssessment?.skillName.toLowerCase() === item.skillName.toLowerCase();
                  const originalRepoMatches = item.supportingRepos.filter((r) => !r.isFork).length;
                  const totalCommits = item.supportingRepos.reduce(
                    (acc, r) => acc + r.attributedCommitsCount,
                    0
                  );

                  return (
                    <tr
                      key={item.skillName}
                      onClick={() => setSelectedSkillName(item.skillName)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EEF6F5]' : 'hover:bg-[#F8F9F8]'
                      }`}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[#111919]">{item.skillName}</div>
                        <div className="mt-0.5 text-[11px] text-[#526362]">
                          <span>{item.category}</span>
                          <span> · </span>
                          <span
                            className={
                              item.claimedByUser ? 'text-[#0B4F4A] font-medium' : 'text-[#526362]'
                            }
                          >
                            {item.claimedByUser ? 'Claimed' : 'Detected'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2.5 whitespace-nowrap">
                        {renderBandIndicator(item.evidenceBand)}
                      </td>
                      <td className="py-3.5 px-2.5 text-right font-mono tabular-nums font-semibold text-[#111919] whitespace-nowrap">
                        {item.evidenceScore}/100
                      </td>
                      <td className="py-3.5 px-2.5 text-right font-mono tabular-nums text-[#526362] whitespace-nowrap">
                        {originalRepoMatches}r · {totalCommits}c
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSkillName(item.skillName);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-[#0B4F4A] bg-white border border-[#CBD5D4] rounded-md hover:bg-[#EEF6F5]"
                          >
                            Inspect
                          </button>
                          {item.claimedByUser && (
                            <button
                              type="button"
                              aria-label={`Remove claimed skill ${item.skillName}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleRemoveSkillClaim(item.skillName);
                              }}
                              className="p-1 text-[#526362] hover:text-[#B91C1C] rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 5 Columns: Explainable Skill Evidence Inspector */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-6">
          {activeAssessment ? (
            <>
              <div className="pb-4 border-b border-[#E2E8E7]">
                <div className="flex items-center justify-between gap-2 text-xs text-[#526362]">
                  <span>
                    {activeAssessment.category} ·{' '}
                    {activeAssessment.claimedByUser ? 'Claimed by Developer' : 'System Detected'}
                  </span>
                  <span className="font-mono font-semibold text-[#0B4F4A]">
                    Score: {activeAssessment.evidenceScore}/100
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-[#111919]">
                    {activeAssessment.skillName}
                  </h3>
                  {renderBandIndicator(activeAssessment.evidenceBand)}
                </div>
              </div>

              {/* 5-Part Evidence Meters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#111919]">
                  <span>5-Signal Evidence Breakdown</span>
                  <span className="font-mono text-[#526362]">
                    {activeAssessment.breakdown.totalScore} / 100 pts
                  </span>
                </div>
                <div className="space-y-2.5">
                  <EvidenceMeterBar
                    label="1. Manifest & Language Metadata"
                    score={activeAssessment.breakdown.manifestSignal}
                    max={15}
                    tone="muted"
                  />
                  <EvidenceMeterBar
                    label="2. Non-Vendor Source Files"
                    score={activeAssessment.breakdown.sourceFilesSignal}
                    max={25}
                    tone="teal"
                  />
                  <EvidenceMeterBar
                    label="3. Attributed Substantive Commits"
                    score={activeAssessment.breakdown.attributedWorkSignal}
                    max={30}
                    tone="teal"
                  />
                  <EvidenceMeterBar
                    label="4. Multi-Repository Consistency"
                    score={activeAssessment.breakdown.multiRepoConsistency}
                    max={15}
                    tone="muted"
                  />
                  <EvidenceMeterBar
                    label="5. Activity Span & Recency"
                    score={activeAssessment.breakdown.recencyAndContinuity}
                    max={15}
                    tone="amber"
                  />
                </div>
              </div>

              {/* Supporting & Missing Evidence */}
              <div className="pt-4 border-t border-[#E2E8E7] space-y-4 text-xs">
                {activeAssessment.positiveSignals.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[#0B4F4A] mb-2">
                      Supporting Evidence
                    </h4>
                    <ul className="space-y-1.5 text-[#263333]">
                      {activeAssessment.positiveSignals.map((sig, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2
                            className="w-3.5 h-3.5 text-[#0B4F4A] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{sig}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeAssessment.missingOrWeakSignals.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[#B45309] mb-2">
                      Missing or Weak Signals
                    </h4>
                    <ul className="space-y-1.5 text-[#526362]">
                      {activeAssessment.missingOrWeakSignals.map((sig, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertTriangle
                            className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{sig}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Supporting Repositories */}
              <div className="pt-4 border-t border-[#E2E8E7] text-xs">
                <h4 className="font-semibold text-[#111919] mb-2.5">
                  Supporting Repositories ({activeAssessment.supportingRepos.length})
                </h4>
                {activeAssessment.supportingRepos.length === 0 ? (
                  <p className="text-[#526362]">
                    No repositories in this profile contain signals for {activeAssessment.skillName}.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E2E8E7]">
                    {activeAssessment.supportingRepos.map((repo) => (
                      <div key={repo.fullName} className="py-2.5">
                        <div className="flex items-center gap-2">
                          <a
                            href={repo.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
                          >
                            <span>{repo.repoName}</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                          {repo.isFork && (
                            <span className="text-[11px] font-medium text-[#B45309]">
                              · Forked (Isolated)
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#526362] font-mono">
                          {repo.matchingFilesCount} files · {repo.attributedCommitsCount} commits
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Verifiable Commit Links */}
              {activeAssessment.supportingCommits.length > 0 && (
                <div className="pt-4 border-t border-[#E2E8E7] text-xs">
                  <h4 className="font-semibold text-[#111919] mb-2">
                    Attributed Commits
                  </h4>
                  <div className="space-y-2">
                    {activeAssessment.supportingCommits.slice(0, 4).map((c) => (
                      <div
                        key={c.sha}
                        className="p-2.5 bg-[#F8F9F8] border border-[#E2E8E7] rounded-lg"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#526362] font-mono">
                          <a
                            href={c.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
                          >
                            <span>{c.shortSha}</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                          <span>
                            {c.repoName} · {c.date.slice(0, 10)}
                          </span>
                        </div>
                        <p className="mt-1 text-[#111919] truncate">{c.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Limitations */}
              <div className="pt-4 border-t border-[#E2E8E7]">
                <h4 className="text-xs font-semibold text-[#526362] flex items-center gap-1.5 mb-1">
                  <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Scope &amp; Boundaries</span>
                </h4>
                <p className="text-[11px] text-[#526362] leading-relaxed">
                  {activeAssessment.limitations[0]}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
