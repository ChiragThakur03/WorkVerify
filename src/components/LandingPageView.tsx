import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Search,
  Lock,
  Check,
  ChevronDown,
  ChevronUp,
  Terminal,
  Users,
  Sparkles,
  FileCheck2,
  Filter,
  Target,
} from 'lucide-react';
import {
  HeroEvidenceIllustration,
  PipelineFlowIllustration,
  EvidenceMeterBar,
  MatchScoreRing,
} from './VisualAssets';
import { ThemeToggleButton } from './ThemeToggleButton';
import { AppTheme } from '../lib/themeManager';

interface LandingPageViewProps {
  onNavigate: (path: string) => void;
  onAnalyzeUrl?: (url: string) => void;
  theme: AppTheme;
  onToggleTheme: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onNavigate,
  onAnalyzeUrl,
  theme,
  onToggleTheme,
}) => {
  const [heroUrl, setHeroUrl] = useState('');
  const [showBoundaries, setShowBoundaries] = useState(false);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = heroUrl.trim();
    if (onAnalyzeUrl && cleaned) {
      onAnalyzeUrl(cleaned);
    } else {
      onNavigate('/analyze');
    }
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, sectionId: string) => {
    e.preventDefault();
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${sectionId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9F8] text-[#111919] transition-colors">
      {/* Unified Marketing Header — Cohesive Theme + Smooth Scroll Links + Theme Toggle */}
      <header className="sticky top-0 z-30 bg-[#F8F9F8]/95 backdrop-blur-xs border-b border-[#E2E8E7] px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#111919] shrink-0"
          >
            <span className="w-6 h-6 rounded-md bg-[#0B4F4A] text-white inline-flex items-center justify-center font-mono text-xs font-semibold">
              W
            </span>
            <span>WorkVerify</span>
          </a>

          <nav
            aria-label="Marketing Navigation"
            className="hidden md:flex items-center gap-8 text-sm font-medium text-[#526362]"
          >
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="hover:text-[#0B4F4A] transition-colors cursor-pointer"
            >
              How It Works
            </a>
            <a
              href="#who-it-is-for"
              onClick={(e) => scrollToSection(e, 'who-it-is-for')}
              className="hover:text-[#0B4F4A] transition-colors cursor-pointer"
            >
              For Developers &amp; Hiring Teams
            </a>
            <button
              type="button"
              onClick={() => onNavigate('/analyze')}
              className="hover:text-[#0B4F4A] transition-colors"
            >
              Public URL Inspector
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="px-3.5 py-2 text-xs font-semibold text-[#111919] bg-white border border-[#CBD5D4] hover:bg-[#F2F5F4] rounded-lg transition-colors"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/signup')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Main Marketing Content — Single Unified Theme From Top to Bottom */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="max-w-7xl w-full mx-auto px-4 sm:px-8 pt-12 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-[#0B4F4A] bg-[#EEF6F5] border border-[#CBE0DD] px-3 py-1 rounded-md">
                <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                <span>Real-Work Skill Verification</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#111919] leading-[1.1]">
                Verify software skills through real GitHub work.
              </h1>

              <p className="text-base sm:text-lg text-[#526362] leading-relaxed max-w-xl">
                Resumes only show what people claim. WorkVerify checks real GitHub projects to prove what skills a developer actually used—making it easy for developers to stand out and hiring teams to hire with confidence.
              </p>

              {/* Quick Visual Value Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs font-medium text-[#263333]">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#E2E8E7]">
                  <Check className="w-3.5 h-3.5 text-[#0B4F4A]" />
                  <span>Checks Real Projects</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#E2E8E7]">
                  <Check className="w-3.5 h-3.5 text-[#0B4F4A]" />
                  <span>Filters Out Copied Code</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#E2E8E7]">
                  <Check className="w-3.5 h-3.5 text-[#0B4F4A]" />
                  <span>Instant Job Match Score</span>
                </span>
              </div>

              {/* Primary Conversion CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('/signup')}
                  className="px-5 py-3 text-sm font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="px-5 py-3 text-sm font-semibold text-[#111919] bg-white hover:bg-[#F2F5F4] border border-[#CBD5D4] rounded-lg transition-colors"
                >
                  Sign In to Workspace
                </button>
              </div>

              {/* Instant Public GitHub URL Inspection Bar (No Login Required) */}
              <div className="pt-4 border-t border-[#E2E8E7]">
                <form onSubmit={handleHeroSubmit} className="space-y-2">
                  <label
                    htmlFor="landing-public-url-input"
                    className="block text-xs font-mono text-[#526362]"
                  >
                    Try it right now—paste any public GitHub profile or project link:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5 p-1.5 bg-white border border-[#CBD5D4] rounded-xl focus-within:border-[#0B4F4A]">
                    <div className="relative flex-1 flex items-center">
                      <Search className="w-4 h-4 text-[#526362] ml-3 shrink-0" />
                      <input
                        id="landing-public-url-input"
                        type="text"
                        aria-label="GitHub profile or repository URL"
                        value={heroUrl}
                        onChange={(e) => setHeroUrl(e.target.value)}
                        placeholder="github.com/owner/repo or github.com/username"
                        className="w-full px-3 py-2 text-sm font-mono text-[#111919] placeholder:text-[#526362] bg-transparent focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>Inspect Public URL</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Clean 2D Product & Evidence Illustration */}
            <div className="lg:col-span-6 bg-white text-[#111919] p-4 sm:p-6 rounded-2xl border border-[#E2E8E7]">
              <HeroEvidenceIllustration />
            </div>
          </div>
        </section>

        {/* Adaptive Experience Overview & How It Works */}
        <div className="border-t border-[#E2E8E7]">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-20 space-y-20">
            {/* Section 1: For Developers & Hiring Teams (Visual Cards + Short Points) */}
            <section id="who-it-is-for" className="scroll-mt-24 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-[#0B4F4A]">
                    For Developers &amp; Hiring Teams
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111919] mt-1">
                    One platform, two visual workspaces
                  </h2>
                </div>
                <p className="text-base sm:text-lg text-[#526362] leading-relaxed max-w-md">
                  Pick your role at sign-up to get tools built for your exact goal.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Card A: Developers & Job Seekers */}
                <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#0B4F4A] bg-[#EEF6F5] px-3 py-1 rounded-md">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>For Developers &amp; Students</span>
                      </div>
                      <span className="text-xs font-mono text-[#526362]">
                        Skill Proof &amp; Job Fit
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-[#111919] leading-snug">
                      Show proof of your skills, not just a resume list.
                    </h3>

                    {/* Visual Mini-Preview Inside Developer Card */}
                    <div className="bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-5 space-y-3.5">
                      <div className="flex items-center justify-between text-sm sm:text-base">
                        <span className="font-semibold text-[#111919]">
                          Your Verified Skill Snapshot
                        </span>
                        <span className="font-mono text-xs text-[#0B4F4A] bg-[#EEF6F5] px-2.5 py-0.5 rounded">
                          3 Skills Checked
                        </span>
                      </div>
                      <div className="space-y-3">
                        <EvidenceMeterBar
                          score={92}
                          label="React & Frontend (4 real projects)"
                          tone="teal"
                        />
                        <EvidenceMeterBar
                          score={84}
                          label="Node.js & APIs (3 real projects)"
                          tone="muted"
                        />
                        <EvidenceMeterBar
                          score={45}
                          label="Docker (Needs 1 more project)"
                          tone="amber"
                        />
                      </div>
                    </div>

                    {/* 3 Short, Easy-to-Read Points (Matching Hero Font Size) */}
                    <div className="grid grid-cols-1 gap-3 text-base sm:text-lg leading-relaxed">
                      <div className="flex items-start gap-3.5 p-3.5 rounded-lg bg-[#F8F9F8] border border-[#E2E8E7]">
                        <span className="w-7 h-7 rounded-md bg-[#EEF6F5] text-[#0B4F4A] inline-flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-4 h-4" />
                        </span>
                        <div>
                          <strong className="text-[#111919]">See Your Strongest Skills:</strong>{' '}
                          <span className="text-[#526362]">
                            Know which skills your GitHub projects clearly prove.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-3.5 rounded-lg bg-[#F8F9F8] border border-[#E2E8E7]">
                        <span className="w-7 h-7 rounded-md bg-[#EEF6F5] text-[#0B4F4A] inline-flex items-center justify-center shrink-0 mt-0.5">
                          <Target className="w-4 h-4" />
                        </span>
                        <div>
                          <strong className="text-[#111919]">Match With Any Job:</strong>{' '}
                          <span className="text-[#526362]">
                            Paste a job description to see your match % and missing skills.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-3.5 rounded-lg bg-[#F8F9F8] border border-[#E2E8E7]">
                        <span className="w-7 h-7 rounded-md bg-[#EEF6F5] text-[#0B4F4A] inline-flex items-center justify-center shrink-0 mt-0.5">
                          <Lock className="w-4 h-4" />
                        </span>
                        <div>
                          <strong className="text-[#111919]">Private Until You Share:</strong>{' '}
                          <span className="text-[#526362]">
                            Your profile stays private until you share your verified link.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E2E8E7] flex items-center justify-between">
                    <span className="text-sm sm:text-base text-[#526362]">
                      Free for developers &amp; job seekers
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('/signup')}
                      className="text-sm sm:text-base font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1.5"
                    >
                      <span>Start as Developer</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Card B: Recruiters & Hiring Teams */}
                <div className="bg-white border border-[#E2E8E7] rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-[#92400E] bg-[#FBF7EE] px-3 py-1 rounded-md">
                        <Users className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>For Hiring Teams &amp; Recruiters</span>
                      </div>
                      <span className="text-xs font-mono text-[#526362]">
                        Fast Candidate Check
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-[#111919] leading-snug">
                      Check candidate skills in seconds—no coding required.
                    </h3>

                    {/* Visual Mini-Preview Inside Recruiter Card */}
                    <div className="bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl p-5 flex items-center gap-4">
                      <MatchScoreRing score={86} size={76} label="FIT" />
                      <div className="flex-1 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base font-bold text-[#111919]">
                            Candidate Match Report
                          </span>
                          <span className="text-xs font-mono font-semibold text-[#0B4F4A] bg-[#EEF6F5] px-2.5 py-0.5 rounded">
                            Strong Fit
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                          <span className="px-2.5 py-1 rounded bg-white border border-[#E2E8E7] text-[#111919]">
                            ✓ 94% Own Code
                          </span>
                          <span className="px-2.5 py-1 rounded bg-white border border-[#E2E8E7] text-[#111919]">
                            ✓ 5/6 Job Skills Matched
                          </span>
                          <span className="px-2.5 py-1 rounded bg-[#FBF7EE] border border-[#F3E3C3] text-[#92400E]">
                            3 Interview Questions Ready
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3 Short, Easy-to-Read Points (Matching Hero Font Size) */}
                    <div className="grid grid-cols-1 gap-3 text-base sm:text-lg leading-relaxed">
                      <div className="flex items-start gap-3.5 p-3.5 rounded-lg bg-[#F8F9F8] border border-[#E2E8E7]">
                        <span className="w-7 h-7 rounded-md bg-[#EEF6F5] text-[#0B4F4A] inline-flex items-center justify-center shrink-0 mt-0.5">
                          <FileCheck2 className="w-4 h-4" />
                        </span>
                        <div>
                          <strong className="text-[#111919]">Real Work vs. Resume Claims:</strong>{' '}
                          <span className="text-[#526362]">
                            Instantly see if a candidate actually built projects with the skills you need.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-3.5 rounded-lg bg-[#F8F9F8] border border-[#E2E8E7]">
                        <span className="w-7 h-7 rounded-md bg-[#EEF6F5] text-[#0B4F4A] inline-flex items-center justify-center shrink-0 mt-0.5">
                          <Filter className="w-4 h-4" />
                        </span>
                        <div>
                          <strong className="text-[#111919]">Spots Copied Projects:</strong>{' '}
                          <span className="text-[#526362]">
                            Separates original work from copied templates automatically.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-3.5 rounded-lg bg-[#F8F9F8] border border-[#E2E8E7]">
                        <span className="w-7 h-7 rounded-md bg-[#EEF6F5] text-[#0B4F4A] inline-flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4" />
                        </span>
                        <div>
                          <strong className="text-[#111919]">Ready Interview Questions:</strong>{' '}
                          <span className="text-[#526362]">
                            Gives you simple questions to ask based on the candidate’s real projects.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E2E8E7] flex items-center justify-between">
                    <span className="text-sm sm:text-base text-[#526362]">
                      Save &amp; compare multiple candidates
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('/signup')}
                      className="text-sm sm:text-base font-semibold text-[#0B4F4A] hover:underline inline-flex items-center gap-1.5"
                    >
                      <span>Start as Recruiter</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: How It Works (Visual Flow + 3 Simple Visual Cards with Hero Font Size) */}
            <section
              id="how-it-works"
              className="scroll-mt-24 bg-[#EEF6F5] border border-[#CBE0DD] rounded-2xl p-6 sm:p-10 space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-[#0B4F4A]">
                    How It Works
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#111919] mt-1">
                    From a GitHub link to a clear skill report in 4 simple steps
                  </h2>
                </div>
                <span className="text-sm font-mono text-[#0B4F4A]">
                  No Setup · Real Code Proof · Plain English Report
                </span>
              </div>

              <div className="bg-white border border-[#E2E8E7] rounded-xl p-4 sm:p-6">
                <PipelineFlowIllustration />
              </div>

              {/* 3 Visual Highlight Boxes With Hero Paragraph Font Size (text-base sm:text-lg) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
                <div className="bg-white border border-[#E2E8E7] rounded-xl p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold text-[#0B4F4A]">
                      1. Smart Filtering
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-[#EEF6F5] text-[#0B4F4A] font-mono text-xs whitespace-nowrap shrink-0">
                      No Noise
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                    <span className="px-2.5 py-1 rounded bg-[#F8F9F8] border border-[#E2E8E7] text-[#111919]">
                      ✓ Real Project Files
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]">
                      ✕ Auto-Generated Files
                    </span>
                  </div>
                  <p className="text-base sm:text-lg text-[#526362] leading-relaxed">
                    Ignores downloaded folders and templates so only real work counts.
                  </p>
                </div>

                <div className="bg-white border border-[#E2E8E7] rounded-xl p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold text-[#0B4F4A]">
                      2. Real Ownership Check
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-[#EEF6F5] text-[#0B4F4A] font-mono text-xs whitespace-nowrap shrink-0">
                      Anti-Copy
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                    <span className="px-2.5 py-1 rounded bg-[#F8F9F8] border border-[#E2E8E7] text-[#111919]">
                      ✓ Written by User
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[#FBF7EE] border border-[#F3E3C3] text-[#92400E]">
                      ✕ Copied Forks Flagged
                    </span>
                  </div>
                  <p className="text-base sm:text-lg text-[#526362] leading-relaxed">
                    Checks code history to confirm the person actually wrote the code themselves.
                  </p>
                </div>

                <div className="bg-white border border-[#E2E8E7] rounded-xl p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold text-[#0B4F4A]">
                      3. Easy Skill Rating
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-[#EEF6F5] text-[#0B4F4A] font-mono text-xs whitespace-nowrap shrink-0">
                      Clickable Proof
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                    <span className="px-2.5 py-1 rounded bg-[#EEF6F5] border border-[#CBE0DD] text-[#0B4F4A] font-semibold">
                      Strong
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[#F8F9F8] border border-[#E2E8E7] text-[#263333]">
                      Moderate
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[#FBF7EE] border border-[#F3E3C3] text-[#92400E]">
                      Needs More Proof
                    </span>
                  </div>
                  <p className="text-base sm:text-lg text-[#526362] leading-relaxed">
                    Every skill gets a clear rating with direct links to the projects behind it.
                  </p>
                </div>
              </div>
            </section>

            {/* Progressive Disclosure: Fair Verification Promise + Call to Action */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 bg-white border border-[#E2E8E7] rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#0B4F4A]" />
                    <h2 className="text-base font-semibold text-[#111919]">
                      Fair &amp; Honest Skill Check
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBoundaries(!showBoundaries)}
                    className="text-xs font-medium text-[#0B4F4A] hover:underline inline-flex items-center gap-1"
                  >
                    <span>{showBoundaries ? 'Hide details' : 'What we check'}</span>
                    {showBoundaries ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-[#526362] leading-relaxed">
                  WorkVerify checks public GitHub projects. If a skill isn’t shown on public GitHub, we simply mark it as “Not found in public projects”—never as a failure.
                </p>

                {showBoundaries && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#E2E8E7] text-xs">
                    <div className="space-y-2">
                      <div className="font-semibold text-[#0B4F4A] flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>What WorkVerify Checks</span>
                      </div>
                      <ul className="space-y-1.5 text-[#526362]">
                        <li>• Real code files and tools used in projects</li>
                        <li>• Original projects vs. copied templates</li>
                        <li>• How well projects match a job description</li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <div className="font-semibold text-[#B45309] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>What Requires an Interview</span>
                      </div>
                      <ul className="space-y-1.5 text-[#526362]">
                        <li>• Private company work under NDA</li>
                        <li>• Communication &amp; teamwork skills</li>
                        <li>• Offline projects not uploaded to GitHub</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-[#EEF6F5] border border-[#CBE0DD] rounded-xl p-6 space-y-4">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#0B4F4A]">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Quick Setup · Private by Default</span>
                </div>
                <h3 className="text-lg font-bold text-[#111919] leading-snug">
                  Ready to check your skills or evaluate a candidate?
                </h3>
                <p className="text-xs text-[#263333] leading-relaxed">
                  Sign up with Email or Google in seconds. Choose Developer or Recruiter mode anytime.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigate('/signup')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0B4F4A] hover:bg-[#0F6660] rounded-lg transition-colors"
                  >
                    Create Free Account
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/login')}
                    className="px-4 py-2 text-xs font-semibold text-[#111919] bg-white border border-[#CBD5D4] hover:bg-[#F8F9F8] rounded-lg transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Unified Footer */}
      <footer className="border-t border-[#E2E8E7] bg-white px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#526362]">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-[#0B4F4A] text-white inline-flex items-center justify-center font-mono text-[10px] font-bold">
              W
            </span>
            <span>WorkVerify — Real-Work Skill Verification</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              className="hover:text-[#0B4F4A] transition-colors cursor-pointer"
            >
              How It Works
            </a>
            <a
              href="#who-it-is-for"
              onClick={(e) => scrollToSection(e, 'who-it-is-for')}
              className="hover:text-[#0B4F4A] transition-colors cursor-pointer"
            >
              For Developers &amp; Teams
            </a>
            <button
              type="button"
              onClick={() => onNavigate('/analyze')}
              className="hover:text-[#0B4F4A] transition-colors"
            >
              Public URL Inspector
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="hover:text-[#0B4F4A] transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
