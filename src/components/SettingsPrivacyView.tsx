import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  Unlink,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Lock,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Terminal,
  Users,
  Compass,
  SlidersHorizontal,
} from 'lucide-react';
import {
  UserProfileData,
  AuditLogItem,
  SupabaseConnectionStatus,
  PrimaryWorkspaceRole,
} from '../types/workverify';
import { apiFetch } from '../lib/apiClient';

import { AppTheme } from '../lib/themeManager';
import { Sun, Moon } from 'lucide-react';

interface SettingsPrivacyViewProps {
  user: UserProfileData;
  auditLogs: AuditLogItem[];
  supabaseStatus: SupabaseConnectionStatus | null;
  onSyncGitHub: (username?: string) => Promise<void>;
  onDisconnectGitHub: () => Promise<void>;
  onDeleteAccountData: () => Promise<void>;
  onUpdateProfileMeta: (payload: {
    fullName?: string;
    roleTitle?: string;
    bio?: string;
    isPublicProfile?: boolean;
  }) => Promise<void>;
  onSwitchWorkspaceRole?: (role: PrimaryWorkspaceRole) => Promise<void>;
  onUserUpdated?: (updatedUser: UserProfileData, logs?: AuditLogItem[]) => void;
  onNavigate?: (path: string) => void;
  isSyncing: boolean;
  theme?: AppTheme;
  onToggleTheme?: () => void;
}

export const SettingsPrivacyView: React.FC<SettingsPrivacyViewProps> = ({
  user,
  auditLogs,
  supabaseStatus,
  onSyncGitHub,
  onDisconnectGitHub,
  onDeleteAccountData,
  onUpdateProfileMeta,
  onSwitchWorkspaceRole,
  onUserUpdated,
  onNavigate,
  isSyncing,
  theme = 'light',
  onToggleTheme,
}) => {
  const [usernameInput, setUsernameInput] = useState(user.githubUsername || '');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [fullName, setFullName] = useState(user.fullName);
  const [roleTitle, setRoleTitle] = useState(user.roleTitle);
  const [bio, setBio] = useState(user.bio);
  const [profileSavedToast, setProfileSavedToast] = useState(false);

  // Email verification & password change state
  const [verifyCodeInput, setVerifyCodeInput] = useState(
    user.pendingVerificationPreviewCode || ''
  );
  const [securityStatus, setSecurityStatus] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);

  useEffect(() => {
    setUsernameInput(user.githubUsername || '');
    setFullName(user.fullName);
    setRoleTitle(user.roleTitle);
    setBio(user.bio);
    if (user.pendingVerificationPreviewCode && !verifyCodeInput) {
      setVerifyCodeInput(user.pendingVerificationPreviewCode);
    }
  }, [
    user.githubUsername,
    user.fullName,
    user.roleTitle,
    user.bio,
    user.pendingVerificationPreviewCode,
    verifyCodeInput,
  ]);

  const shareUrl = `${window.location.origin}/profile/${encodeURIComponent(user.profileSlug)}`;

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    } catch {
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    }
  };

  const handleLoadSchema = async () => {
    setShowSchemaModal(true);
    if (!schemaSql) {
      try {
        const res = await apiFetch('/api/operations/schema');
        const data = await res.json();
        setSchemaSql(data.sql || '');
      } catch {
        setSchemaSql('-- Could not load supabase/schema.sql');
      }
    }
  };

  const handleCopySchema = async () => {
    if (!schemaSql) return;
    try {
      await navigator.clipboard.writeText(schemaSql);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2500);
    } catch {
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2500);
    }
  };

  const handleDirectUsernameSync = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = usernameInput
      .trim()
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/^(www\.)?github\.com\//i, '')
      .split('/')[0]
      .replace(/^@/, '')
      .trim();
    if (!cleaned) {
      setSyncError('Please enter a GitHub username before starting repository collection.');
      return;
    }
    setSyncError(null);
    try {
      await onSyncGitHub(cleaned);
    } catch (err: any) {
      setSyncError(err.message || 'Failed to sync GitHub user.');
    }
  };

  const handleStartGitHubOAuthPopup = async () => {
    setOauthMessage(null);
    try {
      const origin = window.location.origin;
      const res = await apiFetch(`/api/auth/github/url?origin=${encodeURIComponent(origin)}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        setOauthMessage(
          data.error ||
            'GitHub OAuth Client ID is not configured yet. Use the Direct Public GitHub Username Collector below or add GITHUB_CLIENT_ID in Secrets.'
        );
        return;
      }
      window.open(data.url, 'github_oauth_popup', 'width=620,height=720');
    } catch (err: any) {
      setOauthMessage(err.message || 'Could not initiate GitHub OAuth flow.');
    }
  };

  const handleStartGoogleOAuthPopup = async () => {
    setSecurityError(null);
    setSecurityStatus(null);
    try {
      const origin = window.location.origin;
      const res = await apiFetch(`/api/auth/google/url?origin=${encodeURIComponent(origin)}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        setSecurityStatus(
          data.error ||
            'Google OAuth credentials are not configured in environment secrets yet.'
        );
        return;
      }
      window.open(data.url, 'google_oauth_popup', 'width=560,height=680');
    } catch (err: any) {
      setSecurityError(err.message || 'Could not initiate Google OAuth.');
    }
  };

  const handleVerifyEmailNow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecurityStatus(null);
    setIsUpdatingSecurity(true);
    try {
      const res = await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ tokenOrCode: verifyCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not verify email.');
      }
      if (onUserUpdated && data.user) {
        onUserUpdated(data.user, data.auditLogs);
      }
      setSecurityStatus('Email address verified!');
    } catch (err: any) {
      setSecurityError(err.message || 'Verification failed.');
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  const handleResendVerification = async () => {
    setSecurityError(null);
    setSecurityStatus(null);
    setIsUpdatingSecurity(true);
    try {
      const res = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not resend verification code.');
      }
      if (data.verificationCode) {
        setVerifyCodeInput(data.verificationCode);
      }
      if (onUserUpdated && data.user) {
        onUserUpdated(data.user, data.auditLogs);
      }
      setSecurityStatus(
        data.verificationCode
          ? `Issued new 6-digit verification code: ${data.verificationCode}`
          : 'Verification code re-issued.'
      );
    } catch (err: any) {
      setSecurityError(err.message || 'Could not resend code.');
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecurityStatus(null);
    setIsUpdatingSecurity(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not update password.');
      }
      setCurrentPassword('');
      setNewPassword('');
      if (onUserUpdated && data.user) {
        onUserUpdated(data.user, data.auditLogs);
      }
      setSecurityStatus('Password updated.');
    } catch (err: any) {
      setSecurityError(err.message || 'Password update failed.');
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  const handleUnlinkProvider = async (provider: 'email' | 'google' | 'github') => {
    setSecurityError(null);
    setSecurityStatus(null);
    setIsUpdatingSecurity(true);
    try {
      const res = await apiFetch('/api/auth/unlink-provider', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not unlink provider.');
      }
      if (onUserUpdated && data.user) {
        onUserUpdated(data.user, data.auditLogs);
      }
      setSecurityStatus(`Unlinked ${provider} provider from your account.`);
    } catch (err: any) {
      setSecurityError(err.message || 'Unlink blocked.');
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    await onUpdateProfileMeta({ fullName, roleTitle, bio });
    setProfileSavedToast(true);
    setTimeout(() => setProfileSavedToast(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Adaptive Workspace Role & Theme Appearance Preferences */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-[#0B4F4A]">
              Adaptive Workspace &amp; Appearance Configuration
            </div>
            <h2 className="text-lg font-bold text-[#111919] mt-0.5">
              Active Workspace Role, Theme &amp; Multi-Role Switching
            </h2>
            <p className="text-xs text-[#526362] mt-1">
              Primary role:{' '}
              <strong className="text-[#111919] capitalize">
                {user.onboarding?.primaryRole || 'developer'}
              </strong>{' '}
              · Active view:{' '}
              <strong className="text-[#0B4F4A] capitalize">{user.activeRole}</strong> · Theme:{' '}
              <strong className="text-[#0B4F4A] capitalize">{theme} Mode</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#CBD5D4] bg-[#F8F9F8] text-[#111919] hover:bg-[#EEF6F5] inline-flex items-center gap-1.5 transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>Switch to Light Theme</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-[#0B4F4A]" />
                    <span>Switch to Dark Theme</span>
                  </>
                )}
              </button>
            )}
            {(
              [
                ['developer', 'Developer', Terminal],
                ['recruiter', 'Recruiter', Users],
                ['other', 'Explorer', Compass],
              ] as const
            ).map(([roleKey, label, Icon]) => {
              const isActive = user.activeRole === roleKey;
              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => onSwitchWorkspaceRole && void onSwitchWorkspaceRole(roleKey)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-[#0B4F4A] text-white border-[#0B4F4A]'
                      : 'bg-[#F8F9F8] text-[#263333] border-[#CBD5D4] hover:bg-[#EEF6F5]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label} View</span>
                </button>
              );
            })}

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/onboarding')}
                className="px-3.5 py-2 text-xs font-medium text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg inline-flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Re-run Onboarding</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. Account Identity, Email Verification, Linked Sign-In Providers & Password Security */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8E7]">
          <div>
            <h2 className="text-lg font-bold text-[#111919] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0B4F4A]" />
              <span>Authentication, Linked Identities &amp; Account Security</span>
            </h2>
            <p className="text-xs text-[#526362] mt-1">
              Canonical Account Email: <code className="font-mono text-[#111919]">{user.email}</code>{' '}
              · Status:{' '}
              {user.emailVerified ? (
                <span className="font-semibold text-[#0B4F4A]">Verified Email</span>
              ) : (
                <span className="font-semibold text-[#B45309]">Unverified Email</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartGoogleOAuthPopup}
            className="px-3.5 py-2 text-xs font-semibold text-[#111919] bg-[#F8F9F8] hover:bg-[#EEF6F5] border border-[#CBD5D4] rounded-lg inline-flex items-center gap-2 self-start"
          >
            <span>Link Google Account</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Email Verification Banner if not verified yet */}
        {!user.emailVerified && (
          <form
            onSubmit={handleVerifyEmailNow}
            className="p-4 bg-[#FBF7EE] border border-[#F3E3C3] rounded-xl space-y-3 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-semibold text-[#92400E]">
                Verify your email address ({user.email}) to enable safe cross-provider account linking
              </div>
              {user.pendingVerificationPreviewCode && (
                <span className="font-mono text-[#0B4F4A] font-semibold">
                  Code: {user.pendingVerificationPreviewCode}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="text"
                required
                value={verifyCodeInput}
                onChange={(e) => setVerifyCodeInput(e.target.value)}
                placeholder="6-digit verification code"
                className="px-3 py-1.5 font-mono bg-white border border-[#CBD5D4] rounded-lg text-[#111919]"
              />
              <button
                type="submit"
                disabled={isUpdatingSecurity}
                className="px-3.5 py-1.5 font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg"
              >
                Verify Email
              </button>
              <button
                type="button"
                disabled={isUpdatingSecurity}
                onClick={handleResendVerification}
                className="px-3 py-1.5 font-medium text-[#263333] bg-white border border-[#CBD5D4] rounded-lg"
              >
                Resend Code
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* Linked Identities List */}
          <div className="space-y-3">
            <div className="font-semibold text-[#111919]">
              Linked Sign-In &amp; Data Providers ({user.linkedProviders?.length || 0})
            </div>
            <div className="divide-y divide-[#E2E8E7] border border-[#E2E8E7] rounded-xl overflow-hidden">
              {(user.linkedProviders || []).map((item) => (
                <div
                  key={`${item.provider}_${item.providerId}`}
                  className="p-3.5 bg-[#F8F9F8] flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-[#111919] uppercase font-mono">
                      {item.provider}
                    </div>
                    <div className="text-[#526362]">
                      {item.displayName || item.email} ·{' '}
                      {item.verified ? 'Verified' : 'Unverified'}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isUpdatingSecurity}
                    onClick={() => void handleUnlinkProvider(item.provider)}
                    className="px-2.5 py-1 text-[11px] font-medium text-[#B91C1C] bg-white border border-[#FECACA] hover:bg-[#FEF2F2] rounded-md"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#526362]">
              Lockout protection is enforced: you cannot unlink your last remaining platform sign-in method.
            </p>
          </div>

          {/* Password Update / Set Form */}
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="font-semibold text-[#111919] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#0B4F4A]" />
              <span>{user.hasPassword ? 'Change Account Password' : 'Set Account Password'}</span>
            </div>
            {user.hasPassword && (
              <div>
                <label
                  htmlFor="sec-current-pw"
                  className="block text-[11px] text-[#526362] mb-1"
                >
                  Current Password
                </label>
                <input
                  id="sec-current-pw"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg"
                />
              </div>
            )}
            <div>
              <label
                htmlFor="sec-new-pw"
                className="block text-[11px] text-[#526362] mb-1"
              >
                New Password (minimum 6 characters)
              </label>
              <input
                id="sec-new-pw"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={isUpdatingSecurity}
              className="px-4 py-2 font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg"
            >
              {user.hasPassword ? 'Update Password' : 'Save Password'}
            </button>
          </form>
        </div>

        {securityError && (
          <div
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{securityError}</span>
          </div>
        )}
        {securityStatus && (
          <div className="p-3 bg-[#EEF6F5] border border-[#CBE0DD] rounded-lg text-xs text-[#0B4F4A]">
            {securityStatus}
          </div>
        )}
      </section>

      {/* 3. GitHub Connection, OAuth & Live Public Repository Collector */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-6">
        <div className="pb-4 border-b border-[#E2E8E7] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111919]">
              GitHub Authorization, Profile Sharing &amp; Privacy Controls
            </h1>
            <p className="mt-1 text-sm text-[#526362] max-w-3xl">
              Manage your GitHub repository connection (read-only public scope), control public profile sharing, inspect your Supabase PostgreSQL persistence configuration, or exercise full disconnect and data deletion rights.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleStartGitHubOAuthPopup}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span>Authorize via GitHub OAuth</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {oauthMessage && (
          <div
            role="status"
            className="p-3.5 bg-[#F8F9F8] border border-[#E2E8E7] rounded-lg text-xs text-[#263333]"
          >
            {oauthMessage}
          </div>
        )}

        {/* Live Public GitHub Username Collector */}
        <form onSubmit={handleDirectUsernameSync} className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 max-w-md">
              <label
                htmlFor="github-username-input"
                className="block text-xs font-semibold text-[#111919] mb-1"
              >
                Collect &amp; Verify Your Public GitHub Account (REST API)
              </label>
              <input
                id="github-username-input"
                type="text"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  if (syncError) setSyncError(null);
                }}
                placeholder="Enter GitHub username (e.g., octocat, sindresorhus)..."
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919] focus:outline-none focus:border-[#0B4F4A]"
              />
            </div>

            <button
              type="submit"
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isSyncing ? 'Collecting from GitHub...' : 'Run Public Repo Collection'}</span>
            </button>
          </div>
          {syncError && (
            <p role="alert" className="text-xs font-medium text-[#991B1B]">
              {syncError}
            </p>
          )}
          <p className="text-[11px] text-[#526362]">
            Scope: Read-only public repositories (<code className="font-mono">read:user public_repo</code>). WorkVerify never requests write access or private repository permissions.
          </p>
        </form>
      </section>

      {/* 4. Public Profile Visibility & Sharing Governance */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#111919]">
              {user.isPublicProfile ? (
                <>
                  <Share2 className="w-4 h-4 text-[#0B4F4A]" />
                  <span>Public Shareable Profile Enabled</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-[#D97706]" />
                  <span>Profile Private by Default</span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-[#526362] max-w-2xl">
              Your WorkVerify profile is private by default. When you publish your profile, external recruiters can view your verified dossier at <code className="font-mono text-[#111919]">/profile/{user.profileSlug}</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {user.isPublicProfile && (
              <>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg transition-colors"
                >
                  {copiedShareLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#0B4F4A]" />
                      <span>Copied Link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Shareable URL</span>
                    </>
                  )}
                </button>
                <a
                  href={`/profile/${encodeURIComponent(user.profileSlug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0B4F4A] bg-[#EEF6F5] border border-[#CBE0DD] hover:bg-[#DDECE9] rounded-lg transition-colors"
                >
                  <span>Preview Public Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </>
            )}

            <button
              type="button"
              onClick={() => void onUpdateProfileMeta({ isPublicProfile: !user.isPublicProfile })}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                user.isPublicProfile
                  ? 'bg-[#F2F5F4] text-[#111919] hover:bg-[#E2E8E7]'
                  : 'bg-[#0B4F4A] text-white hover:bg-[#0F6660]'
              }`}
            >
              {user.isPublicProfile ? 'Unpublish Profile (Make Private)' : 'Publish Shareable Profile'}
            </button>
          </div>
        </div>
      </section>

      {/* 5. Developer Profile Metadata Editor */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6">
        <h2 className="text-base font-bold text-[#111919] mb-4">
          Profile Details
        </h2>
        <form onSubmit={handleSaveProfileDetails} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="dev-fullname" className="block font-semibold text-[#263333] mb-1">
              Full Name
            </label>
            <input
              id="dev-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919]"
            />
          </div>
          <div>
            <label htmlFor="dev-roletitle" className="block font-semibold text-[#263333] mb-1">
              Role / Headline
            </label>
            <input
              id="dev-roletitle"
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919]"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="dev-bio" className="block font-semibold text-[#263333] mb-1">
              Engineering / Hiring Summary
            </label>
            <input
              id="dev-bio"
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg text-[#111919]"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Save Profile Metadata
            </button>
            {profileSavedToast && (
              <span className="text-xs font-medium text-[#0B4F4A]">
                Profile metadata saved.
              </span>
            )}
          </div>
        </form>
      </section>

      {/* 6. Supabase PostgreSQL Database Configuration & Schema Inspector */}
      <section className="bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#111919] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#0B4F4A]" aria-hidden="true" />
              <span>Supabase PostgreSQL Persistence Layer</span>
            </h2>
            <p className="mt-1 text-xs text-[#526362]">
              Mode:{' '}
              <span className="font-mono font-medium text-[#111919]">
                {supabaseStatus?.authMode || 'Supabase PostgreSQL Adapter'}
              </span>
              {supabaseStatus?.projectUrl && (
                <span>
                  {' '}
                  · Endpoint: <code className="font-mono">{supabaseStatus.projectUrl}</code>
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLoadSchema}
            className="px-3.5 py-2 text-xs font-semibold text-[#263333] bg-[#F2F5F4] hover:bg-[#E2E8E7] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {showSchemaModal ? 'View Supabase SQL Schema' : 'Inspect Supabase DDL (schema.sql)'}
          </button>
        </div>

        {showSchemaModal && (
          <div className="p-4 bg-[#F8F9F8] border border-[#E2E8E7] text-[#111919] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#0B4F4A] font-semibold">
                supabase/schema.sql — Run in Supabase SQL Editor
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-[#CBD5D4] hover:bg-[#EEF6F5] text-[#111919] rounded-md"
                >
                  {copiedSchema ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#0B4F4A]" aria-hidden="true" />
                      <span>Copied SQL</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSchemaModal(false)}
                  className="px-2.5 py-1 text-xs font-medium bg-white border border-[#CBD5D4] hover:bg-[#F2F5F4] text-[#526362] rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
            <pre className="text-[11px] font-mono overflow-x-auto max-h-64 text-[#263333]">
              {schemaSql || 'Loading schema...'}
            </pre>
          </div>
        )}
      </section>

      {/* 7. Disconnect GitHub & Full Account Data Deletion */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Disconnect GitHub &amp; Data Deletion Controls
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Disconnecting GitHub immediately revokes stored OAuth tokens and unpublishes shared recruiter links. Deleting account data purges all stored repositories, commit attributions, job descriptions, and skill assessments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={!user.githubConnected}
            onClick={() => void onDisconnectGitHub()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Disconnect GitHub Access</span>
          </button>

          {!confirmDeleteOpen ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Delete Stored Account Data</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 p-1.5 bg-rose-50 border border-rose-200 rounded-lg">
              <span className="text-xs font-semibold text-rose-800 px-2">
                Confirm permanent purge?
              </span>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteAccountData();
                  setConfirmDeleteOpen(false);
                }}
                className="px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md whitespace-nowrap shrink-0"
              >
                Confirm Delete All Data
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 8. Operations, Rate-Limit & Privacy Audit Log */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">
            Operations, Rate-Limit &amp; Privacy Audit Log
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-3">Operation</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Details</th>
                <th className="py-2.5 px-4 text-right">API Rate Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-center text-xs text-slate-500">
                    No operations recorded yet in this session.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {log.createdAt.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={
                          log.status === 'SUCCESS'
                            ? 'text-emerald-700 font-semibold'
                            : log.status === 'WARNING'
                            ? 'text-amber-700 font-semibold'
                            : 'text-rose-700 font-semibold'
                        }
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{log.details}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {log.rateLimitRemaining !== undefined
                        ? `${log.rateLimitRemaining} rem`
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
