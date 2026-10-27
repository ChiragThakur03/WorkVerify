import React, { useState } from 'react';
import {
  Terminal,
  Users,
  Compass,
  Check,
  ArrowRight,
  ArrowLeft,
  GitBranch,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  UserProfileData,
  PrimaryWorkspaceRole,
  AuditLogItem,
} from '../types/workverify';
import { apiFetch } from '../lib/apiClient';

interface OnboardingViewProps {
  user: UserProfileData;
  isSyncingGitHub: boolean;
  onSyncGitHub: (username: string) => Promise<void>;
  onOnboardingComplete: (updatedUser: UserProfileData, logs?: AuditLogItem[], nextRoute?: string) => void;
}

const DEVELOPER_STATUS_OPTIONS = [
  'Actively job hunting',
  'Experienced developer',
  'Early-career developer',
  'Student',
  'Exploring skill gaps',
];

const DEVELOPER_TARGET_ROLES = [
  'Full-Stack',
  'Frontend',
  'Backend',
  'Data / ML',
  'DevOps / Cloud',
  'Mobile',
  'Systems',
];

const DEVELOPER_GOALS = [
  'Check job readiness',
  'Verify skills',
  'Improve portfolio',
  'Prepare for applications',
];

const RECRUITER_CONTEXTS = [
  'Recruiter',
  'Hiring Manager',
  'Founder',
  'Technical Interviewer',
  'Agency',
];

const RECRUITER_HIRING_ROLES = [
  'Full-Stack',
  'Backend',
  'Frontend',
  'Data / ML',
  'DevOps / Cloud',
  'Systems',
];

const RECRUITER_PRIORITIES = [
  'Required skills',
  'Code ownership',
  'Project depth',
  'Recent activity',
  'Interview focus areas',
];

const OTHER_INTENTS = [
  'Inspect a public GitHub profile or repo',
  'Compare skills to a job description',
  'Evaluate a team or open-source project',
  'Just exploring',
];

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  user,
  isSyncingGitHub,
  onSyncGitHub,
  onOnboardingComplete,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [primaryRole, setPrimaryRole] = useState<PrimaryWorkspaceRole>(
    user.onboarding?.primaryRole || 'developer'
  );
  const [secondaryRoles, setSecondaryRoles] = useState<PrimaryWorkspaceRole[]>(
    user.onboarding?.secondaryRoles || []
  );

  // Developer conditional fields
  const [devStatus, setDevStatus] = useState(
    user.onboarding?.developerPrefs?.currentStatus || DEVELOPER_STATUS_OPTIONS[0]
  );
  const [devTargetRole, setDevTargetRole] = useState(
    user.onboarding?.developerPrefs?.targetRole || DEVELOPER_TARGET_ROLES[0]
  );
  const [devMainGoal, setDevMainGoal] = useState(
    user.onboarding?.developerPrefs?.mainGoal || DEVELOPER_GOALS[0]
  );
  const [optionalGithubUsername, setOptionalGithubUsername] = useState(
    user.githubUsername || ''
  );

  // Recruiter conditional fields
  const [recContext, setRecContext] = useState(
    user.onboarding?.recruiterPrefs?.hiringContext || RECRUITER_CONTEXTS[1]
  );
  const [recHiringRoles, setRecHiringRoles] = useState<string[]>(
    user.onboarding?.recruiterPrefs?.hiringRoles?.length
      ? user.onboarding.recruiterPrefs.hiringRoles
      : ['Full-Stack', 'Backend']
  );
  const [recPriority, setRecPriority] = useState(
    user.onboarding?.recruiterPrefs?.evaluationPriority || RECRUITER_PRIORITIES[0]
  );

  // Other conditional fields
  const [otherIntent, setOtherIntent] = useState(
    user.onboarding?.otherPrefs?.primaryIntent || OTHER_INTENTS[0]
  );
  const [otherNotes, setOtherNotes] = useState(
    user.onboarding?.otherPrefs?.focusNotes || ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  const toggleSecondaryRole = (role: PrimaryWorkspaceRole) => {
    if (role === primaryRole) return;
    setSecondaryRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleRecruiterRole = (roleLabel: string) => {
    setRecHiringRoles((prev) =>
      prev.includes(roleLabel)
        ? prev.length > 1
          ? prev.filter((r) => r !== roleLabel)
          : prev
        : [...prev, roleLabel]
    );
  };

  const handleStartGitHubOAuth = async () => {
    setOauthNotice(null);
    try {
      const origin = window.location.origin;
      const res = await apiFetch(`/api/auth/github/url?origin=${encodeURIComponent(origin)}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        setOauthNotice(
          data.error ||
            'GitHub OAuth is not configured in environment secrets yet. Enter your public GitHub username below or skip and connect later.'
        );
        return;
      }
      window.open(data.url, 'github_oauth_popup', 'width=620,height=720');
    } catch (err: any) {
      setOauthNotice(err.message || 'Could not initiate GitHub OAuth.');
    }
  };

  const handleSaveAndFinish = async (customNextRoute?: string) => {
    setIsSaving(true);
    setErrorMsg(null);

    try {
      // If Developer entered an optional public GitHub username during step 2, sync it first
      if (
        primaryRole === 'developer' &&
        optionalGithubUsername.trim() &&
        optionalGithubUsername.trim() !== user.githubUsername
      ) {
        await onSyncGitHub(optionalGithubUsername.trim());
      }

      const res = await apiFetch('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          primaryRole,
          secondaryRoles: secondaryRoles.filter((r) => r !== primaryRole),
          developerPrefs: {
            currentStatus: devStatus,
            targetRole: devTargetRole,
            mainGoal: devMainGoal,
          },
          recruiterPrefs: {
            hiringContext: recContext,
            hiringRoles: recHiringRoles,
            evaluationPriority: recPriority,
          },
          otherPrefs: {
            primaryIntent: otherIntent,
            focusNotes: otherNotes.trim(),
          },
          completed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save workspace setup.');
      }

      onOnboardingComplete(data.user, data.auditLogs, customNextRoute || '/app');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not complete onboarding setup.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 sm:p-10 space-y-8">
        {/* Progress Indicator Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2E8E7]">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-[#0B4F4A]">
              Step {step} of 2 · Adaptive Workspace Setup
            </div>
            <h1 className="text-2xl font-bold text-[#111919] mt-1">
              {step === 1
                ? `Welcome, ${user.fullName}. How will you use WorkVerify?`
                : primaryRole === 'developer'
                ? 'Tailor your Developer & Job-Readiness Workspace'
                : primaryRole === 'recruiter'
                ? 'Tailor your Technical Hiring & Assessment Workspace'
                : 'Tailor your WorkVerify Exploration Workspace'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`h-2 w-12 rounded-full ${
                step >= 1 ? 'bg-[#0B4F4A]' : 'bg-[#E2E8E7]'
              }`}
            />
            <div
              className={`h-2 w-12 rounded-full ${
                step === 2 ? 'bg-[#0B4F4A]' : 'bg-[#E2E8E7]'
              }`}
            />
          </div>
        </div>

        {/* STEP 1: Primary Role Selection + Optional Secondary Roles */}
        {step === 1 && (
          <div className="space-y-6">
            <p className="text-xs text-[#526362]">
              Select your primary objective so WorkVerify configures the right navigation, tools, and evidence views for you. You can switch or add roles anytime in Settings.
            </p>

            <div className="grid grid-cols-1 gap-4">
              {/* Option A: Developer */}
              <button
                type="button"
                onClick={() => {
                  setPrimaryRole('developer');
                  setSecondaryRoles((prev) => prev.filter((r) => r !== 'developer'));
                }}
                className={`p-5 rounded-xl border text-left transition-colors flex items-start justify-between gap-4 ${
                  primaryRole === 'developer'
                    ? 'bg-[#EEF6F5] border-[#0B4F4A]'
                    : 'bg-white border-[#E2E8E7] hover:border-[#CBD5D4]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      primaryRole === 'developer'
                        ? 'bg-[#0B4F4A] text-white'
                        : 'bg-[#F2F5F4] text-[#263333]'
                    }`}
                  >
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[#111919]">
                      Developer / Job Seeker
                    </div>
                    <p className="text-xs text-[#526362] leading-relaxed">
                      Verify my skills, find gaps against target engineering roles, and match my GitHub work to job descriptions.
                    </p>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                    primaryRole === 'developer'
                      ? 'bg-[#0B4F4A] border-[#0B4F4A] text-white'
                      : 'border-[#CBD5D4]'
                  }`}
                >
                  {primaryRole === 'developer' && <Check className="w-3 h-3" />}
                </div>
              </button>

              {/* Option B: Recruiter */}
              <button
                type="button"
                onClick={() => {
                  setPrimaryRole('recruiter');
                  setSecondaryRoles((prev) => prev.filter((r) => r !== 'recruiter'));
                }}
                className={`p-5 rounded-xl border text-left transition-colors flex items-start justify-between gap-4 ${
                  primaryRole === 'recruiter'
                    ? 'bg-[#EEF6F5] border-[#0B4F4A]'
                    : 'bg-white border-[#E2E8E7] hover:border-[#CBD5D4]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      primaryRole === 'recruiter'
                        ? 'bg-[#0B4F4A] text-white'
                        : 'bg-[#F2F5F4] text-[#263333]'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[#111919]">
                      Recruiter / Hiring Manager
                    </div>
                    <p className="text-xs text-[#526362] leading-relaxed">
                      Evaluate candidates against job requirements using real GitHub evidence, isolate forks, and generate interview prompts.
                    </p>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                    primaryRole === 'recruiter'
                      ? 'bg-[#0B4F4A] border-[#0B4F4A] text-white'
                      : 'border-[#CBD5D4]'
                  }`}
                >
                  {primaryRole === 'recruiter' && <Check className="w-3 h-3" />}
                </div>
              </button>

              {/* Option C: Other / Exploring */}
              <button
                type="button"
                onClick={() => {
                  setPrimaryRole('other');
                  setSecondaryRoles((prev) => prev.filter((r) => r !== 'other'));
                }}
                className={`p-5 rounded-xl border text-left transition-colors flex items-start justify-between gap-4 ${
                  primaryRole === 'other'
                    ? 'bg-[#EEF6F5] border-[#0B4F4A]'
                    : 'bg-white border-[#E2E8E7] hover:border-[#CBD5D4]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      primaryRole === 'other'
                        ? 'bg-[#0B4F4A] text-white'
                        : 'bg-[#F2F5F4] text-[#263333]'
                    }`}
                  >
                    <Compass className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[#111919]">
                      Other / Exploring WorkVerify
                    </div>
                    <p className="text-xs text-[#526362] leading-relaxed">
                      Explore open-source project quality, benchmark skills, or learn how deterministic GitHub verification works.
                    </p>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                    primaryRole === 'other'
                      ? 'bg-[#0B4F4A] border-[#0B4F4A] text-white'
                      : 'border-[#CBD5D4]'
                  }`}
                >
                  {primaryRole === 'other' && <Check className="w-3 h-3" />}
                </div>
              </button>
            </div>

            {/* Optional Multi-Role Workspace Toggle */}
            <div className="p-4 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl space-y-2.5 text-xs">
              <div className="font-semibold text-[#111919]">
                Need more than one workspace? (Optional)
              </div>
              <p className="text-[#526362]">
                If you both write code and evaluate candidates, enable a secondary workspace to get a 1-click role switcher in your header.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(
                  [
                    ['developer', 'Developer Workspace'],
                    ['recruiter', 'Recruiter Workspace'],
                    ['other', 'Explorer Workspace'],
                  ] as const
                )
                  .filter(([r]) => r !== primaryRole)
                  .map(([roleKey, label]) => {
                    const isChecked = secondaryRoles.includes(roleKey);
                    return (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => toggleSecondaryRole(roleKey)}
                        className={`px-3 py-1.5 rounded-lg border font-medium inline-flex items-center gap-1.5 transition-colors ${
                          isChecked
                            ? 'bg-[#0B4F4A] text-white border-[#0B4F4A]'
                            : 'bg-white text-[#263333] border-[#CBD5D4] hover:bg-[#EEF6F5]'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                        <span>+ Also enable {label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E2E8E7]">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSaveAndFinish('/app')}
                className="text-xs font-medium text-[#526362] hover:text-[#111919]"
              >
                Skip details &amp; open workspace
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2A: Conditional Follow-Up for Developer / Job Seeker */}
        {step === 2 && primaryRole === 'developer' && (
          <div className="space-y-6 text-xs">
            <div>
              <label className="block font-semibold text-[#111919] mb-2">
                1. What is your current status?
              </label>
              <div className="flex flex-wrap gap-2">
                {DEVELOPER_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDevStatus(opt)}
                    className={`px-3.5 py-2 rounded-lg border font-medium transition-colors ${
                      devStatus === opt
                        ? 'bg-[#0B4F4A] text-white border-[#0B4F4A]'
                        : 'bg-[#F8F9F8] text-[#263333] border-[#E2E8E7] hover:border-[#CBD5D4]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#111919] mb-2">
                2. Which target role or domain are you focusing on?
              </label>
              <div className="flex flex-wrap gap-2">
                {DEVELOPER_TARGET_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setDevTargetRole(role)}
                    className={`px-3.5 py-2 rounded-lg border font-medium transition-colors ${
                      devTargetRole === role
                        ? 'bg-[#0B4F4A] text-white border-[#0B4F4A]'
                        : 'bg-[#F8F9F8] text-[#263333] border-[#E2E8E7] hover:border-[#CBD5D4]'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#111919] mb-2">
                3. What is your primary goal right now?
              </label>
              <div className="flex flex-wrap gap-2">
                {DEVELOPER_GOALS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setDevMainGoal(goal)}
                    className={`px-3.5 py-2 rounded-lg border font-medium transition-colors ${
                      devMainGoal === goal
                        ? 'bg-[#0B4F4A] text-white border-[#0B4F4A]'
                        : 'bg-[#F8F9F8] text-[#263333] border-[#E2E8E7] hover:border-[#CBD5D4]'
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional GitHub Connection (Not Required to Finish!) */}
            <div className="p-5 bg-[#EEF6F5] border border-[#CBE0DD] rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="font-semibold text-[#0B4F4A] flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  <span>4. Connect your GitHub account (Optional — or connect later)</span>
                </div>
                <button
                  type="button"
                  onClick={handleStartGitHubOAuth}
                  className="px-3 py-1.5 font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg inline-flex items-center gap-1.5 self-start transition-colors"
                >
                  <span>Authorize via GitHub OAuth</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[#263333] leading-relaxed">
                WorkVerify only requests read-only public scope (<code className="font-mono">read:user public_repo</code>) to inspect your public repositories and commit attribution. You can also enter your public GitHub username directly below, or skip and connect later in your workspace.
              </p>
              <input
                type="text"
                value={optionalGithubUsername}
                onChange={(e) => setOptionalGithubUsername(e.target.value)}
                placeholder="Optional: enter your public GitHub username (e.g., octocat)"
                className="w-full px-3.5 py-2 font-mono bg-white border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A]"
              />
              {oauthNotice && (
                <div className="p-2.5 bg-[#FBF7EE] border border-[#F3E3C3] rounded-lg text-[#92400E]">
                  {oauthNotice}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2B: Conditional Follow-Up for Recruiter / Hiring Manager */}
        {step === 2 && primaryRole === 'recruiter' && (
          <div className="space-y-6 text-xs">
            <div>
              <label className="block font-semibold text-[#111919] mb-2">
                1. What best describes your hiring role?
              </label>
              <div className="flex flex-wrap gap-2">
                {RECRUITER_CONTEXTS.map((ctx) => (
                  <button
                    key={ctx}
                    type="button"
                    onClick={() => setRecContext(ctx)}
                    className={`px-3.5 py-2 rounded-lg border font-medium transition-colors ${
                      recContext === ctx
                        ? 'bg-[#0B4F4A] text-white border-[#0B4F4A]'
                        : 'bg-[#F8F9F8] text-[#263333] border-[#E2E8E7] hover:border-[#CBD5D4]'
                    }`}
                  >
                    {ctx}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#111919] mb-2">
                2. Which engineering roles are you evaluating candidates for? (Select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {RECRUITER_HIRING_ROLES.map((role) => {
                  const active = recHiringRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRecruiterRole(role)}
                      className={`px-3.5 py-2 rounded-lg border font-medium inline-flex items-center gap-1.5 transition-colors ${
                        active
                          ? 'bg-[#0B4F4A] text-white border-[#0B4F4A]'
                          : 'bg-[#F8F9F8] text-[#263333] border-[#E2E8E7] hover:border-[#CBD5D4]'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5" />}
                      <span>{role}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#111919] mb-2">
                3. What is your top candidate evaluation priority?
              </label>
              <div className="flex flex-wrap gap-2">
                {RECRUITER_PRIORITIES.map((prio) => (
                  <button
                    key={prio}
                    type="button"
                    onClick={() => setRecPriority(prio)}
                    className={`px-3.5 py-2 rounded-lg border font-medium transition-colors ${
                      recPriority === prio
                        ? 'bg-[#0B4F4A] text-white border-[#0B4F4A]'
                        : 'bg-[#F8F9F8] text-[#263333] border-[#E2E8E7] hover:border-[#CBD5D4]'
                    }`}
                  >
                    {prio}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2C: Conditional Follow-Up for Other / Exploring */}
        {step === 2 && primaryRole === 'other' && (
          <div className="space-y-6 text-xs">
            <div>
              <label className="block font-semibold text-[#111919] mb-2">
                1. What would you like to do first in WorkVerify?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OTHER_INTENTS.map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => setOtherIntent(intent)}
                    className={`p-3.5 rounded-xl border text-left font-medium transition-colors ${
                      otherIntent === intent
                        ? 'bg-[#0B4F4A] text-white border-[#0B4F4A]'
                        : 'bg-[#F8F9F8] text-[#263333] border-[#E2E8E7] hover:border-[#CBD5D4]'
                    }`}
                  >
                    {intent}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="onboarding-other-notes"
                className="block font-semibold text-[#111919] mb-1.5"
              >
                2. Specific technologies or repositories you plan to inspect (Optional)
              </label>
              <input
                id="onboarding-other-notes"
                type="text"
                value={otherNotes}
                onChange={(e) => setOtherNotes(e.target.value)}
                placeholder="e.g., TypeScript, Python, open-source infrastructure..."
                className="w-full px-3.5 py-2 bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A]"
              />
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

        {/* Step 2 Footer Controls */}
        {step === 2 && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#E2E8E7]">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-medium text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {primaryRole === 'recruiter' && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSaveAndFinish('/app/assess')}
                  className="px-4 py-2.5 text-xs font-semibold text-[#0B4F4A] bg-[#EEF6F5] hover:bg-[#DDECE9] border border-[#CBE0DD] rounded-lg transition-colors"
                >
                  Save &amp; Start Candidate Assessment →
                </button>
              )}
              <button
                type="button"
                disabled={isSaving || isSyncingGitHub}
                onClick={() => void handleSaveAndFinish('/app')}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg inline-flex items-center gap-2"
              >
                <span>
                  {isSaving || isSyncingGitHub
                    ? 'Configuring Workspace...'
                    : `Open My ${
                        primaryRole === 'developer'
                          ? 'Developer'
                          : primaryRole === 'recruiter'
                          ? 'Recruiter'
                          : 'Explorer'
                      } Workspace`}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
