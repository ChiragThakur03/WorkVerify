import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  User,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { apiFetch, setStoredSessionToken } from '../lib/apiClient';
import {
  UserProfileData,
  ExtractedJobDescription,
  AuditLogItem,
  SavedRecruiterAssessmentItem,
} from '../types/workverify';

export type AuthScreenMode = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password';

interface AuthViewProps {
  initialMode?: AuthScreenMode;
  initialToken?: string;
  currentUser?: UserProfileData | null;
  onAuthSuccess: (payload: {
    user: UserProfileData;
    token?: string;
    jobDescriptions?: ExtractedJobDescription[];
    recruiterAssessments?: SavedRecruiterAssessmentItem[];
    auditLogs?: AuditLogItem[];
    isNewRegistration?: boolean;
  }) => void;
  onUserUpdated?: (user: UserProfileData, logs?: AuditLogItem[]) => void;
  onNavigate: (path: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialMode = 'login',
  initialToken = '',
  currentUser,
  onAuthSuccess,
  onUserUpdated,
  onNavigate,
}) => {
  const [mode, setMode] = useState<AuthScreenMode>(initialMode);
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [verificationCodeInput, setVerificationCodeInput] = useState(initialToken || '');
  const [resetTokenInput, setResetTokenInput] = useState(initialToken || '');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [previewVerificationCode, setPreviewVerificationCode] = useState<string | null>(
    currentUser?.pendingVerificationPreviewCode || null
  );
  const [previewResetCode, setPreviewResetCode] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setStatusMessage(null);
  }, [initialMode]);

  useEffect(() => {
    if (currentUser?.pendingVerificationPreviewCode) {
      setPreviewVerificationCode(currentUser.pendingVerificationPreviewCode);
    }
    if (currentUser?.email && !email) {
      setEmail(currentUser.email);
    }
  }, [currentUser, email]);

  const handleLoginOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { email: email.trim(), password, fullName: fullName.trim() }
          : { email: email.trim(), password };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      if (data.token) {
        setStoredSessionToken(data.token);
      }
      if (data.verificationCode) {
        setPreviewVerificationCode(data.verificationCode);
      }

      onAuthSuccess({
        user: data.user,
        token: data.token,
        jobDescriptions: data.jobDescriptions || [],
        recruiterAssessments: data.recruiterAssessments || [],
        auditLogs: data.auditLogs || [],
        isNewRegistration: mode === 'register',
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not complete authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const res = await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ tokenOrCode: verificationCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      setStatusMessage('Email address verified! Redirecting to your workspace...');
      if (onUserUpdated && data.user) {
        onUserUpdated(data.user, data.auditLogs);
      }
      setTimeout(() => {
        if (data.user && !data.user.onboarding?.completed) {
          onNavigate('/onboarding');
        } else {
          onNavigate('/app');
        }
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not verify email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMsg(null);
    setStatusMessage(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() || currentUser?.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not resend verification code.');
      }
      if (data.verificationCode) {
        setPreviewVerificationCode(data.verificationCode);
        setVerificationCodeInput(data.verificationCode);
      }
      setStatusMessage('A fresh 6-digit verification code has been issued.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMessage(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not request password reset.');
      }
      if (data.resetCode) {
        setPreviewResetCode(data.resetCode);
        setResetTokenInput(data.resetCode);
      }
      setStatusMessage(
        data.message ||
          'Password reset code generated. Enter your reset code and new password below.'
      );
      setMode('reset-password');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initiate password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMessage(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          tokenOrCode: resetTokenInput.trim(),
          newPassword: newPasswordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Password reset failed.');
      }
      if (data.token) {
        setStoredSessionToken(data.token);
      }
      onAuthSuccess({
        user: data.user,
        token: data.token,
        jobDescriptions: data.jobDescriptions || [],
        recruiterAssessments: data.recruiterAssessments || [],
        auditLogs: data.auditLogs || [],
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setErrorMsg(null);
    setStatusMessage(null);
    try {
      const origin = window.location.origin;
      const res = await apiFetch(`/api/auth/google/url?origin=${encodeURIComponent(origin)}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        setStatusMessage(
          data.error ||
            'Google OAuth is not configured in environment secrets yet. Sign up or sign in with your email address (including any Gmail address) above.'
        );
        return;
      }
      window.open(data.url, 'google_oauth_popup', 'width=560,height=680');
    } catch (err: any) {
      setStatusMessage(err.message || 'Could not start Google OAuth flow.');
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#0B4F4A]">
            <Lock className="w-3.5 h-3.5" />
            <span>WorkVerify Authentication</span>
          </div>
          <h1 className="text-2xl font-bold text-[#111919] mt-1.5">
            {mode === 'register' && 'Create your WorkVerify account'}
            {mode === 'login' && 'Sign in to WorkVerify'}
            {mode === 'verify-email' && 'Verify your email address'}
            {mode === 'forgot-password' && 'Reset your password'}
            {mode === 'reset-password' && 'Set a new password'}
          </h1>
          <p className="text-xs text-[#526362] mt-1 leading-relaxed">
            {mode === 'register' &&
              'Sign up with any valid email (including Gmail) or Google. You can connect GitHub inside your workspace whenever needed.'}
            {mode === 'login' &&
              'Access your personalized Developer or Recruiter workspace and saved evidence reports.'}
            {mode === 'verify-email' &&
              'Confirm your email ownership to enable verified account linking and security notifications.'}
            {mode === 'forgot-password' &&
              'Enter the email address associated with your account to receive a time-limited reset code.'}
            {mode === 'reset-password' &&
              'Enter your 6-digit reset code or token and choose a new password (minimum 6 characters).'}
          </p>
        </div>

        {/* Mode Switcher for Sign In / Create Account */}
        {(mode === 'login' || mode === 'register') && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F8F9F8] border border-[#E2E8E7] rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                onNavigate('/login');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-[#0B4F4A] text-white'
                  : 'text-[#526362] hover:text-[#111919]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                onNavigate('/signup');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-[#0B4F4A] text-white'
                  : 'text-[#526362] hover:text-[#111919]'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Continue with Google Button */}
        {(mode === 'login' || mode === 'register') && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleOAuth}
              className="w-full py-2.5 px-4 text-xs font-semibold text-[#111919] bg-white hover:bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg transition-colors flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.99-2.19-6.97-5.14H1.02v3.14C3.03 21.14 7.21 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.03 14.01c-.25-.72-.39-1.5-.39-2.31s.14-1.59.39-2.31V6.25H1.02C.37 7.54 0 9.01 0 11.7s.37 4.16 1.02 5.45l4.01-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.03 2.86 1.02 6.85l4.01 3.14c.98-2.95 3.73-5.24 6.97-5.24z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-[#E2E8E7] w-full" />
              <span className="bg-white px-3 text-[11px] font-mono text-[#526362] uppercase">
                or with email
              </span>
              <div className="border-t border-[#E2E8E7] w-full" />
            </div>
          </div>
        )}

        {/* Form 1: Sign In or Register */}
        {(mode === 'login' || mode === 'register') && (
          <form onSubmit={handleLoginOrRegister} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-fullname"
                  className="block text-xs font-medium text-[#263333] mb-1"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#526362] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Priya Sharma"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-[#263333] mb-1"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#526362] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com or work@company.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-[#263333]"
                >
                  Password {mode === 'register' && '(min. 6 characters)'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot-password');
                      onNavigate('/forgot-password');
                    }}
                    className="text-xs font-medium text-[#0B4F4A] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#526362] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
                />
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {statusMessage && (
              <div className="p-3 bg-[#FBF7EE] border border-[#F3E3C3] rounded-lg text-xs text-[#92400E]">
                {statusMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <span>
                {isSubmitting
                  ? 'Authenticating...'
                  : mode === 'register'
                  ? 'Create Account & Continue'
                  : 'Sign In'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Form 2: Verify Email */}
        {mode === 'verify-email' && (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            {previewVerificationCode && (
              <div className="p-3.5 bg-[#EEF6F5] border border-[#CBE0DD] rounded-lg text-xs text-[#0B4F4A] space-y-1">
                <div className="font-semibold flex items-center justify-between">
                  <span>Verification Code Issued</span>
                  <button
                    type="button"
                    onClick={() => setVerificationCodeInput(previewVerificationCode)}
                    className="underline font-mono"
                  >
                    Auto-fill {previewVerificationCode}
                  </button>
                </div>
                <p className="text-[#263333]">
                  Your 6-digit verification code is{' '}
                  <code className="font-mono font-bold text-[#0B4F4A]">
                    {previewVerificationCode}
                  </code>
                  .
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="verify-code-input"
                className="block text-xs font-medium text-[#263333] mb-1"
              >
                6-Digit Verification Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#526362] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="verify-code-input"
                  type="text"
                  required
                  value={verificationCodeInput}
                  onChange={(e) => setVerificationCodeInput(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
                />
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {statusMessage && (
              <div className="p-3 bg-[#EEF6F5] border border-[#CBE0DD] rounded-lg text-xs text-[#0B4F4A] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{isSubmitting ? 'Verifying...' : 'Verify Email Address'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isSubmitting}
                className="text-[#0B4F4A] font-medium hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Resend verification code</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate(
                    currentUser && !currentUser.onboarding?.completed ? '/onboarding' : '/app'
                  )
                }
                className="text-[#526362] hover:text-[#111919]"
              >
                Verify later →
              </button>
            </div>
          </form>
        )}

        {/* Form 3: Forgot Password */}
        {mode === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-xs font-medium text-[#263333] mb-1"
              >
                Account Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#526362] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
                />
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Issuing Reset Code...' : 'Send Password Reset Code'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  onNavigate('/login');
                }}
                className="text-xs font-medium text-[#526362] hover:text-[#111919]"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* Form 4: Reset Password */}
        {mode === 'reset-password' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {previewResetCode && (
              <div className="p-3.5 bg-[#EEF6F5] border border-[#CBE0DD] rounded-lg text-xs text-[#0B4F4A] space-y-1">
                <div className="font-semibold">Password Reset Code Issued</div>
                <p className="text-[#263333]">
                  Use reset code{' '}
                  <code className="font-mono font-bold text-[#0B4F4A]">
                    {previewResetCode}
                  </code>{' '}
                  (valid for 60 minutes).
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="reset-email"
                className="block text-xs font-medium text-[#263333] mb-1"
              >
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="reset-code"
                className="block text-xs font-medium text-[#263333] mb-1"
              >
                6-Digit Reset Code or Token
              </label>
              <input
                id="reset-code"
                type="text"
                required
                value={resetTokenInput}
                onChange={(e) => setResetTokenInput(e.target.value)}
                placeholder="Enter 6-digit reset code"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="reset-new-password"
                className="block text-xs font-medium text-[#263333] mb-1"
              >
                New Password (minimum 6 characters)
              </label>
              <input
                id="reset-new-password"
                type="password"
                required
                minLength={6}
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-xs bg-[#F8F9F8] border border-[#CBD5D4] rounded-lg focus:outline-none focus:border-[#0B4F4A] focus:bg-white"
              />
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] disabled:opacity-50 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Updating Password...' : 'Reset Password & Sign In'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  onNavigate('/login');
                }}
                className="text-xs font-medium text-[#526362] hover:text-[#111919]"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

        <div className="pt-4 border-t border-[#E2E8E7] text-center">
          <button
            type="button"
            onClick={() => onNavigate('/analyze')}
            className="text-xs font-medium text-[#0B4F4A] hover:underline"
          >
            Inspect a public GitHub URL without signing in →
          </button>
        </div>
      </div>
    </div>
  );
};
