import test from 'node:test';
import assert from 'node:assert/strict';
import { dbRepository } from './supabaseRepo.ts';

test('supabaseRepo: registers new user with unverified email, verifies code, saves adaptive onboarding, switches roles, and enforces provider lockout protection', () => {
  const uniqueEmail = `test_${Date.now()}@gmail.com`;
  const reg = dbRepository.registerUser({
    email: uniqueEmail,
    password: 'securePassword123',
    fullName: 'Ananya Verma',
  });

  assert.equal(reg.user.email, uniqueEmail);
  assert.equal(reg.user.emailVerified, false);
  assert.equal(reg.user.onboarding.completed, false);
  assert.equal(reg.user.normalizedRepositories.length, 0, 'New user must start with 0 fake repositories');
  assert.ok(reg.verificationCode.length === 6);

  // Verify email using 6-digit code
  const verifiedUser = dbRepository.verifyUserEmail({
    userId: reg.user.id,
    tokenOrCode: reg.verificationCode,
  });
  assert.equal(verifiedUser.emailVerified, true);

  // Save adaptive onboarding as Recruiter with Developer secondary role
  const onboarded = dbRepository.saveOnboardingPreferences(reg.user.id, {
    primaryRole: 'recruiter',
    secondaryRoles: ['developer'],
    recruiterPrefs: {
      hiringContext: 'Hiring Manager',
      hiringRoles: ['Backend', 'Full-Stack'],
      evaluationPriority: 'Code ownership',
    },
    completed: true,
  });
  assert.equal(onboarded.onboarding.completed, true);
  assert.equal(onboarded.onboarding.primaryRole, 'recruiter');
  assert.equal(onboarded.activeRole, 'recruiter');
  assert.deepEqual(onboarded.onboarding.secondaryRoles, ['developer']);

  // Switch active role to developer
  const switched = dbRepository.switchActiveRole(reg.user.id, 'developer');
  assert.equal(switched.activeRole, 'developer');

  // Lockout protection: cannot unlink only active platform login method ('email')
  assert.throws(
    () => {
      dbRepository.unlinkAuthProvider(reg.user.id, 'email');
    },
    /only active sign-in method/i
  );

  // Password reset flow
  const resetReq = dbRepository.requestPasswordReset(uniqueEmail);
  assert.ok(resetReq.resetCode);
  const afterReset = dbRepository.resetPasswordWithToken({
    email: uniqueEmail,
    tokenOrCode: resetReq.resetCode!,
    newPassword: 'newSecurePassword456',
  });
  assert.equal(afterReset.user.id, reg.user.id);
});
