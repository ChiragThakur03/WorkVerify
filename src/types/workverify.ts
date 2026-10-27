import type {
  EvidenceBand,
  WorkCategory,
  NormalizedRepository,
  SkillAssessmentResult,
} from '../lib/verificationEngine';
import type {
  GitHubTargetType,
  SingleRepositoryInspectionReport,
  ExtractedJobDescription,
  RequirementEvidenceState,
  ApplicationGuidanceClassification,
  RequirementEvaluationItem,
  InterviewQuestionItem,
  JobDescriptionMatchReport,
  RoleRecommendationItem,
} from '../lib/jobMatchEngine';

export type {
  EvidenceBand,
  WorkCategory,
  NormalizedRepository,
  SkillAssessmentResult,
  GitHubTargetType,
  SingleRepositoryInspectionReport,
  ExtractedJobDescription,
  RequirementEvidenceState,
  ApplicationGuidanceClassification,
  RequirementEvaluationItem,
  InterviewQuestionItem,
  JobDescriptionMatchReport,
  RoleRecommendationItem,
};

export type PrimaryWorkspaceRole = 'developer' | 'recruiter' | 'other';

export interface LinkedIdentityItem {
  provider: 'email' | 'google' | 'github';
  providerId: string;
  email: string;
  displayName?: string;
  verified: boolean;
  linkedAt: string;
}

export interface DeveloperOnboardingPrefs {
  currentStatus: string;
  targetRole: string;
  mainGoal: string;
}

export interface RecruiterOnboardingPrefs {
  hiringContext: string;
  hiringRoles: string[];
  evaluationPriority: string;
}

export interface OtherOnboardingPrefs {
  primaryIntent: string;
  focusNotes: string;
}

export interface UserOnboardingState {
  completed: boolean;
  completedAt: string | null;
  primaryRole: PrimaryWorkspaceRole;
  secondaryRoles: PrimaryWorkspaceRole[];
  developerPrefs: DeveloperOnboardingPrefs;
  recruiterPrefs: RecruiterOnboardingPrefs;
  otherPrefs: OtherOnboardingPrefs;
}

export interface SavedRecruiterAssessmentItem {
  id: string;
  userId: string;
  candidateUsername: string;
  candidateDisplayName: string;
  targetUrl: string;
  targetType: 'repository' | 'profile';
  jobTitle: string;
  roleCategory: string;
  evidenceStrengthScore: number;
  jdMatchScore: number;
  guidanceClassification: ApplicationGuidanceClassification;
  candidateOverview: {
    username: string;
    displayName: string;
    avatarUrl: string;
    bio: string;
    profileUrl: string;
    repositoriesAnalyzed: number;
    originalReposCount: number;
    forkedReposCount: number;
    totalAttributedCommits: number;
    skillAssessments: SkillAssessmentResult[];
    normalizedRepositories: NormalizedRepository[];
  };
  jobMatchReport: JobDescriptionMatchReport;
  createdAt: string;
}

export interface PublicAnalysisHistoryItem {
  id: string;
  targetType: 'repository' | 'profile';
  targetUrl: string;
  ownerLogin: string;
  repoName: string | null;
  summaryTitle: string;
  repositoriesCount: number;
  topSkills: { skillName: string; evidenceBand: string; evidenceScore: number }[];
  createdAt: string;
}

export interface UserProfileData {
  id: string;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  pendingVerificationPreviewCode?: string | null;
  linkedProviders: LinkedIdentityItem[];
  fullName: string;
  roleTitle: string;
  bio: string;
  activeRole: PrimaryWorkspaceRole;
  onboarding: UserOnboardingState;
  githubUsername: string;
  githubConnected: boolean;
  githubAvatarUrl: string;
  githubProfileUrl: string;
  githubConnectedAt: string | null;
  profileSlug: string;
  isPublicProfile: boolean;
  publishedAt: string | null;
  lastAnalyzedAt: string | null;
  claimedSkills: string[];
  normalizedRepositories: NormalizedRepository[];
  skillAssessments: SkillAssessmentResult[];
  roleRecommendations: RoleRecommendationItem[];
  jobMatchReports: JobDescriptionMatchReport[];
  createdAt?: string;
}

export interface AuditLogItem {
  id: string;
  userId: string;
  action: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  details: string;
  rateLimitRemaining?: number;
  createdAt: string;
}

export interface SupabaseConnectionStatus {
  provider: string;
  configured: boolean;
  projectUrl: string | null;
  authMode: string;
  googleOAuthConfigured: boolean;
  githubOAuthConfigured: boolean;
  githubTokenConfigured: boolean;
  missingEnvVars?: string[];
}

export interface SupportedSkillCatalogItem {
  name: string;
  category: string;
  aliases: string[];
}
