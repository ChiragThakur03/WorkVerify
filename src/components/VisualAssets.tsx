import React from 'react';

/**
 * 1. Hero 2D Product & Pipeline Illustration
 * Shows GitHub Repository -> File & Manifest Filter -> Commit Attribution -> Verified Skill Profile
 */
export const HeroEvidenceIllustration: React.FC = () => (
  <svg
    viewBox="0 0 540 380"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-auto max-w-[540px] mx-auto select-none"
    role="img"
    aria-label="Illustration of GitHub repositories, commits, and manifests flowing into a verified skill profile"
  >
    {/* Soft background canvas shape */}
    <rect x="16" y="16" width="508" height="348" rx="16" fill="#EEF6F5" />
    <rect x="16.5" y="16.5" width="507" height="347" rx="15.5" stroke="#D3E4E1" />

    {/* Subtle decorative grid lines */}
    <line x1="16" y1="96" x2="524" y2="96" stroke="#DCEAE7" strokeDasharray="4 4" />
    <line x1="16" y1="276" x2="524" y2="276" stroke="#DCEAE7" strokeDasharray="4 4" />

    {/* Left Node: Source Repository & File Tree */}
    <g transform="translate(36, 48)">
      <rect width="190" height="128" rx="10" fill="#FFFFFF" stroke="#CBDAD7" strokeWidth="1.2" />
      <rect x="14" y="14" width="64" height="8" rx="4" fill="#0F6660" />
      <circle cx="168" cy="18" r="4" fill="#D97706" />
      <line x1="14" y1="34" x2="176" y2="34" stroke="#E8EFEE" />

      {/* File tree rows */}
      <rect x="14" y="46" width="10" height="10" rx="2" fill="#0F6660" fillOpacity="0.18" />
      <rect x="30" y="48" width="88" height="6" rx="3" fill="#263333" />
      <rect x="142" y="47" width="32" height="8" rx="4" fill="#EEF6F5" />

      <rect x="14" y="66" width="10" height="10" rx="2" fill="#0F6660" fillOpacity="0.18" />
      <rect x="30" y="68" width="104" height="6" rx="3" fill="#586969" />

      <rect x="14" y="86" width="10" height="10" rx="2" fill="#D97706" fillOpacity="0.22" />
      <rect x="30" y="88" width="74" height="6" rx="3" fill="#586969" />

      {/* Fork / vendor filter tag */}
      <rect x="14" y="104" width="162" height="14" rx="4" fill="#FBF7EE" />
      <circle cx="22" cy="111" r="2.5" fill="#D97706" />
      <rect x="30" y="108" width="110" height="5" rx="2.5" fill="#92400E" fillOpacity="0.55" />
    </g>

    {/* Bottom-Left Node: Commit Attribution Stream */}
    <g transform="translate(36, 198)">
      <rect width="190" height="134" rx="10" fill="#FFFFFF" stroke="#CBDAD7" strokeWidth="1.2" />
      <rect x="14" y="16" width="76" height="7" rx="3.5" fill="#0B4F4A" />
      <line x1="14" y1="34" x2="176" y2="34" stroke="#E8EFEE" />

      {/* Commit timeline nodes */}
      <line x1="22" y1="48" x2="22" y2="112" stroke="#0F6660" strokeWidth="1.5" />
      <circle cx="22" cy="52" r="4" fill="#0F6660" />
      <rect x="34" y="48" width="96" height="6" rx="3" fill="#263333" />
      <rect x="140" y="47" width="34" height="8" rx="4" fill="#EEF6F5" />

      <circle cx="22" cy="80" r="4" fill="#188078" />
      <rect x="34" y="76" width="112" height="6" rx="3" fill="#586969" />

      <circle cx="22" cy="108" r="4" fill="#D97706" />
      <rect x="34" y="104" width="82" height="6" rx="3" fill="#586969" />
    </g>

    {/* Connecting Flow Curves */}
    <path
      d="M226 112 C256 112, 256 160, 284 160"
      stroke="#0F6660"
      strokeWidth="2"
      strokeDasharray="4 3"
    />
    <path
      d="M226 264 C256 264, 256 210, 284 210"
      stroke="#0F6660"
      strokeWidth="2"
    />
    <circle cx="284" cy="160" r="4" fill="#0F6660" />
    <circle cx="284" cy="210" r="4" fill="#0F6660" />

    {/* Right Panel: Verified Technical Evidence Profile */}
    <g transform="translate(284, 48)">
      <rect width="220" height="284" rx="12" fill="#FFFFFF" stroke="#0F6660" strokeWidth="1.5" />

      {/* Header */}
      <rect x="18" y="18" width="28" height="28" rx="6" fill="#0B4F4A" />
      <path
        d="M26 32L30 36L38 28"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="56" y="21" width="108" height="8" rx="4" fill="#111919" />
      <rect x="56" y="34" width="72" height="6" rx="3" fill="#586969" />

      <line x1="18" y1="58" x2="202" y2="58" stroke="#E2E8E7" />

      {/* Skill 1: Strong Evidence */}
      <rect x="18" y="72" width="68" height="7" rx="3.5" fill="#111919" />
      <rect x="158" y="71" width="44" height="8" rx="4" fill="#0F6660" fillOpacity="0.15" />
      <rect x="18" y="88" width="184" height="7" rx="3.5" fill="#EEF6F5" />
      <rect x="18" y="88" width="158" height="7" rx="3.5" fill="#0F6660" />

      {/* Skill 2: Strong Evidence */}
      <rect x="18" y="112" width="54" height="7" rx="3.5" fill="#111919" />
      <rect x="158" y="111" width="44" height="8" rx="4" fill="#0F6660" fillOpacity="0.15" />
      <rect x="18" y="128" width="184" height="7" rx="3.5" fill="#EEF6F5" />
      <rect x="18" y="128" width="142" height="7" rx="3.5" fill="#188078" />

      {/* Skill 3: Partial / Insight Highlight (Warm Amber) */}
      <rect x="18" y="152" width="76" height="7" rx="3.5" fill="#111919" />
      <rect x="158" y="151" width="44" height="8" rx="4" fill="#FEF3C7" />
      <rect x="18" y="168" width="184" height="7" rx="3.5" fill="#FBF7EE" />
      <rect x="18" y="168" width="92" height="7" rx="3.5" fill="#D97706" />

      {/* Bottom Insight Callout inside Right Panel */}
      <rect x="18" y="198" width="184" height="68" rx="8" fill="#EEF6F5" />
      <circle cx="32" cy="216" r="5" fill="#0F6660" />
      <rect x="44" y="213" width="128" height="6" rx="3" fill="#0B4F4A" />
      <rect x="32" y="230" width="152" height="5" rx="2.5" fill="#586969" />
      <rect x="32" y="242" width="118" height="5" rx="2.5" fill="#586969" />
    </g>
  </svg>
);

/**
 * 2. Visual 4-Step Flow Diagram for the Landing Page (Simple, Clear Language)
 */
export const PipelineFlowIllustration: React.FC = () => (
  <div className="py-5 px-4 sm:px-6 bg-[#EEF6F5]/70 rounded-xl border border-[#D5E6E3]">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
      {[
        {
          step: '01',
          badge: 'Paste Link',
          title: 'Connect or Paste URL',
          detail: 'Enter any public GitHub profile or project link.',
        },
        {
          step: '02',
          badge: 'Auto-Clean',
          title: 'Filter Out Noise',
          detail: 'Ignores copied templates and auto-generated folders.',
        },
        {
          step: '03',
          badge: 'Real Work',
          title: 'Verify Own Code',
          detail: 'Checks what code the person actually wrote themselves.',
        },
        {
          step: '04',
          badge: 'Clear Score',
          title: 'Skill & Job Match',
          detail: 'Shows verified skills and role fit in plain English.',
        },
      ].map((item, idx) => (
        <div
          key={item.step}
          className="bg-white border border-[#E2E8E7] rounded-xl p-5 flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-[#0B4F4A] bg-[#EEF6F5] border border-[#C5DDD9] rounded-md px-2.5 py-1">
              STEP {item.step}
            </span>
            <span className="text-xs font-mono font-semibold text-[#188078] bg-[#F8F9F8] border border-[#E2E8E7] px-2.5 py-0.5 rounded">
              {item.badge}
            </span>
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="text-lg font-bold text-[#111919] flex items-center justify-between gap-2">
              <span>{item.title}</span>
              {idx < 3 && (
                <span className="hidden lg:inline text-[#188078] font-mono text-sm" aria-hidden="true">
                  →
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg text-[#526362] leading-relaxed">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * 3. Thoughtful Empty-State Illustration (Code & Magnifying Lens)
 */
export const EmptyInspectionIllustration: React.FC = () => (
  <svg
    viewBox="0 0 180 110"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-36 h-auto mx-auto select-none"
    aria-hidden="true"
  >
    <rect x="20" y="14" width="120" height="80" rx="8" fill="#EEF6F5" stroke="#C5DDD9" strokeWidth="1.5" />
    <line x1="20" y1="30" x2="140" y2="30" stroke="#C5DDD9" strokeWidth="1.2" />
    <circle cx="31" cy="22" r="2.5" fill="#0F6660" />
    <circle cx="40" cy="22" r="2.5" fill="#D97706" />
    <rect x="32" y="42" width="54" height="6" rx="3" fill="#0F6660" fillOpacity="0.45" />
    <rect x="32" y="56" width="82" height="5" rx="2.5" fill="#586969" fillOpacity="0.35" />
    <rect x="32" y="68" width="68" height="5" rx="2.5" fill="#586969" fillOpacity="0.35" />

    <circle cx="130" cy="68" r="22" fill="#FFFFFF" stroke="#0B4F4A" strokeWidth="2.5" />
    <circle cx="130" cy="68" r="14" fill="#FBF7EE" />
    <path d="M125 68L129 72L137 64" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="146" y1="84" x2="160" y2="98" stroke="#0B4F4A" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

/**
 * 4. Elegant Horizontal Evidence Strength Meter
 */
export const EvidenceMeterBar: React.FC<{
  score: number;
  max?: number;
  label?: string;
  tone?: 'teal' | 'muted' | 'amber' | 'neutral';
  band?: string;
  showValue?: boolean;
}> = ({ score, max = 100, label, tone, band, showValue = true }) => {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.max(0, Math.min(100, Math.round((score / safeMax) * 100)));

  let barColor = 'bg-[#CBD5D4]';
  if (tone === 'teal') {
    barColor = 'bg-[#0B4F4A]';
  } else if (tone === 'muted') {
    barColor = 'bg-[#188078]';
  } else if (tone === 'amber') {
    barColor = 'bg-[#D97706]';
  } else if (tone === 'neutral') {
    barColor = 'bg-[#94A3A3]';
  } else {
    const isStrong = band === 'Strong Evidence' || (!band && pct >= 75);
    const isModerate = band === 'Moderate Evidence' || (!band && pct >= 50 && pct < 75);
    const isWeak = band === 'Weak Evidence' || (!band && pct >= 25 && pct < 50);
    barColor = isStrong
      ? 'bg-[#0B4F4A]'
      : isModerate
      ? 'bg-[#188078]'
      : isWeak
      ? 'bg-[#D97706]'
      : 'bg-[#CBD5D4]';
  }

  if (label) {
    return (
      <div className="space-y-1.5 w-full">
        <div className="flex items-center justify-between gap-2 text-sm sm:text-base">
          <span className="text-[#263333] font-medium truncate">{label}</span>
          {showValue && (
            <span className="font-mono font-semibold tabular-nums text-[#111919] shrink-0">
              {score}/{safeMax}
            </span>
          )}
        </div>
        <div className="w-full h-2 bg-[#E2E8E7] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-1.5 bg-[#E2E8E7] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue && (
        <span className="font-mono text-xs tabular-nums text-[#263333] w-12 text-right shrink-0">
          {score}/{safeMax}
        </span>
      )}
    </div>
  );
};

/**
 * 5. Circular Match Gauge for Applicant & Recruiter Job Alignment
 */
export const MatchScoreRing: React.FC<{
  score: number;
  size?: number;
  label?: string;
  strokeWidth?: number;
  sublabel?: string;
  customColor?: string;
}> = ({ score, size = 80, label, strokeWidth = 6, sublabel, customColor }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    customColor ||
    (clamped >= 70 ? '#0B4F4A' : clamped >= 45 ? '#D97706' : '#526362');

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#E2E8E7"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
        <span
          className="font-mono font-bold tabular-nums text-[#111919] leading-none"
          style={{ fontSize: size >= 100 ? '1.75rem' : size >= 70 ? '1.15rem' : '0.875rem' }}
        >
          {clamped}
        </span>
        <span
          className="font-mono text-[#526362] mt-0.5 leading-none"
          style={{ fontSize: size >= 100 ? '0.75rem' : '0.625rem' }}
        >
          {label || '/100'}
        </span>
        {sublabel && (
          <span className="text-[9px] font-semibold text-[#0B4F4A] mt-0.5 truncate max-w-full">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 6. Visual Requirement Coverage Donut Chart
 * Visually shows Strong Match (Teal), Partial Match (Amber), and Gaps/Missing (Slate)
 */
export const RequirementCoverageDonut: React.FC<{
  strongCount: number;
  partialCount: number;
  missingCount: number;
  size?: number;
  title?: string;
  showLegend?: boolean;
}> = ({
  strongCount,
  partialCount,
  missingCount,
  size = 110,
  title = 'Coverage',
  showLegend = true,
}) => {
  const total = strongCount + partialCount + missingCount;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const pctStrong = total > 0 ? strongCount / total : 0;
  const pctPartial = total > 0 ? partialCount / total : 0;
  const pctMissing = total > 0 ? missingCount / total : 0;

  const lenStrong = pctStrong * circumference;
  const lenPartial = pctPartial * circumference;
  const lenMissing = pctMissing * circumference;

  const metRate = total > 0 ? Math.round(((strongCount + partialCount * 0.5) / total) * 100) : 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div
        className="relative inline-flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          {/* Base Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#E2E8E7"
            strokeWidth={strokeWidth}
          />
          {total > 0 && (
            <>
              {/* Strong Segment (Teal) */}
              {lenStrong > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#0B4F4A"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${lenStrong} ${circumference - lenStrong}`}
                  strokeDashoffset={0}
                  strokeLinecap="butt"
                />
              )}
              {/* Partial Segment (Warm Amber) */}
              {lenPartial > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#D97706"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${lenPartial} ${circumference - lenPartial}`}
                  strokeDashoffset={-lenStrong}
                  strokeLinecap="butt"
                />
              )}
              {/* Missing Segment (Muted Slate) */}
              {lenMissing > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#CBD5D4"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${lenMissing} ${circumference - lenMissing}`}
                  strokeDashoffset={-(lenStrong + lenPartial)}
                  strokeLinecap="butt"
                />
              )}
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-base font-bold tabular-nums text-[#111919] leading-none">
            {metRate}%
          </span>
          <span className="text-[10px] font-medium text-[#526362] mt-0.5">
            {title}
          </span>
        </div>
      </div>

      {showLegend && (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0B4F4A] shrink-0" />
            <span className="text-[#263333] font-medium">Strong Evidence:</span>
            <span className="font-mono font-semibold text-[#111919] tabular-nums">
              {strongCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] shrink-0" />
            <span className="text-[#263333] font-medium">Partial Evidence:</span>
            <span className="font-mono font-semibold text-[#111919] tabular-nums">
              {partialCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5D4] shrink-0" />
            <span className="text-[#526362] font-medium">Missing / Gap:</span>
            <span className="font-mono font-semibold text-[#526362] tabular-nums">
              {missingCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 7. Visual 5-Axis Radar / Spider Chart
 * Visually decomposes the 5-signal verification model:
 * 1. Manifest Signal (15)
 * 2. Source Files Signal (25)
 * 3. Attributed Commits (30)
 * 4. Multi-Repo Consistency (15)
 * 5. Activity Span & Recency (15)
 */
export const EvidenceRadarChart: React.FC<{
  signals: {
    manifestSignal: number;
    sourceFilesSignal: number;
    attributedWorkSignal: number;
    multiRepoConsistency: number;
    recencyAndContinuity: number;
  };
  size?: number;
  skillName?: string;
}> = ({ signals, size = 240, skillName }) => {
  const axes = [
    { label: 'Manifest', value: signals.manifestSignal, max: 15 },
    { label: 'Source Files', value: signals.sourceFilesSignal, max: 25 },
    { label: 'Commits', value: signals.attributedWorkSignal, max: 30 },
    { label: 'Multi-Repo', value: signals.multiRepoConsistency, max: 15 },
    { label: 'Recency', value: signals.recencyAndContinuity, max: 15 },
  ];

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;

  // Grid levels (25%, 50%, 75%, 100%)
  const levels = [0.25, 0.5, 0.75, 1.0];

  const getCoordinates = (index: number, ratio: number) => {
    const angle = (index * 2 * Math.PI) / axes.length - Math.PI / 2;
    return {
      x: cx + radius * ratio * Math.cos(angle),
      y: cy + radius * ratio * Math.sin(angle),
    };
  };

  // Generate polygon points for data
  const dataPoints = axes.map((axis, i) => {
    const ratio = Math.max(0.08, Math.min(1, axis.value / axis.max));
    return getCoordinates(i, ratio);
  });
  const polygonPointsString = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="flex flex-col items-center select-none">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Background Web Polygons */}
        {levels.map((level) => {
          const webPoints = axes
            .map((_, i) => {
              const p = getCoordinates(i, level);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <polygon
              key={level}
              points={webPoints}
              fill={level === 1 ? '#F8F9F8' : 'none'}
              stroke="#DCEAE7"
              strokeWidth={level === 1 ? 1.5 : 1}
              strokeDasharray={level < 1 ? '3 3' : undefined}
            />
          );
        })}

        {/* Axis Rays */}
        {axes.map((_, i) => {
          const outer = getCoordinates(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="#CBDAD7"
              strokeWidth={1}
            />
          );
        })}

        {/* Shaded Evidence Polygon */}
        <polygon
          points={polygonPointsString}
          fill="#0F6660"
          fillOpacity={0.22}
          stroke="#0B4F4A"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />

        {/* Vertex Markers & Values */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="#0B4F4A"
            stroke="#FFFFFF"
            strokeWidth={1.5}
          />
        ))}

        {/* Axis Labels */}
        {axes.map((axis, i) => {
          const labelDist = radius + 18;
          const angle = (i * 2 * Math.PI) / axes.length - Math.PI / 2;
          const lx = cx + labelDist * Math.cos(angle);
          const ly = cy + labelDist * Math.sin(angle);

          let anchor: 'middle' | 'start' | 'end' = 'middle';
          if (Math.cos(angle) > 0.25) anchor = 'start';
          if (Math.cos(angle) < -0.25) anchor = 'end';

          return (
            <text
              key={axis.label}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="central"
              className="text-[10px] font-medium fill-[#526362]"
            >
              {axis.label} ({axis.value}/{axis.max})
            </text>
          );
        })}
      </svg>
      {skillName && (
        <div className="text-[11px] font-mono text-[#0B4F4A] font-semibold mt-2">
          5-Signal Shape: {skillName}
        </div>
      )}
    </div>
  );
};

/**
 * 8. Visual Tech Stack & Language Distribution Bar (GitHub Style)
 */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  React: '#0EA5E9',
  'Node.js': '#22C55E',
  'Next.js': '#111919',
  'SQL & PostgreSQL': '#336791',
  'Docker & CI/CD': '#2496ED',
  'HTML & CSS': '#E34F26',
  Go: '#00ADD8',
  Rust: '#DEA584',
  Java: '#B07219',
  'C++': '#F34B7D',
  PHP: '#4F5D95',
  Ruby: '#CC342D',
  Shell: '#89E051',
  Unknown: '#94A3B8',
};

export const TechStackDistributionBar: React.FC<{
  items: Array<{
    name: string;
    percentage?: number;
    count?: number;
    color?: string;
  }>;
  title?: string;
}> = ({ items, title = 'Detected Technology Stack' }) => {
  if (items.length === 0) return null;

  // Calculate percentages if not provided
  const totalCount = items.reduce((acc, i) => acc + (i.count || i.percentage || 1), 0);
  const normalized = items.map((item) => {
    const rawVal = item.percentage ?? (item.count ? (item.count / totalCount) * 100 : 0);
    const pct = Math.max(1, Math.round(rawVal));
    const col = item.color || LANGUAGE_COLORS[item.name] || '#0F6660';
    return { ...item, pct, col };
  });

  return (
    <div className="space-y-2.5 w-full">
      {title && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#111919]">{title}</span>
          <span className="text-[#526362] font-mono text-[11px]">{normalized.length} technologies</span>
        </div>
      )}

      {/* Segmented Bar */}
      <div className="w-full h-3 rounded-full bg-[#E2E8E7] overflow-hidden flex">
        {normalized.map((item, idx) => (
          <div
            key={item.name}
            title={`${item.name}: ${item.pct}%`}
            style={{
              width: `${item.pct}%`,
              backgroundColor: item.col,
            }}
            className={`h-full transition-all hover:opacity-85 ${idx > 0 ? 'border-l border-white/40' : ''}`}
          />
        ))}
      </div>

      {/* Badges Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5 text-xs">
        {normalized.slice(0, 6).map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.col }}
            />
            <span className="font-medium text-[#263333]">{item.name}</span>
            <span className="text-[#526362] font-mono text-[11px] tabular-nums">
              {item.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 9. Authorship Attribution Visual Semicircular Gauge
 * Displays candidate/owner authorship vs external contributors visually
 */
export const AuthorshipAttributionGauge: React.FC<{
  ownerCommits: number;
  totalCommits: number;
  ownerLogin: string;
  distinctAuthorsCount?: number;
}> = ({ ownerCommits, totalCommits, ownerLogin, distinctAuthorsCount = 1 }) => {
  const safeTotal = Math.max(1, totalCommits);
  const ratio = Math.min(100, Math.round((ownerCommits / safeTotal) * 100));
  const externalCommits = Math.max(0, safeTotal - ownerCommits);

  const isHighConfidence = ratio >= 70;
  const isModerate = ratio >= 40 && ratio < 70;

  return (
    <div className="p-4 bg-[#F8F9F8] border border-[#E2E8E7] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#111919]">Authorship Attribution</span>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
              isHighConfidence
                ? 'bg-[#EEF6F5] text-[#0B4F4A] border border-[#C5DDD9]'
                : isModerate
                ? 'bg-[#FBF7EE] text-[#D97706] border border-[#F3E3C3]'
                : 'bg-[#F2F5F4] text-[#526362] border border-[#CBD5D4]'
            }`}
          >
            {isHighConfidence
              ? 'High Authorship Confidence'
              : isModerate
              ? 'Collaborative Repository'
              : 'External / Fork Dominant'}
          </span>
        </div>
        <p className="text-xs text-[#526362]">
          @{ownerLogin} wrote{' '}
          <strong className="text-[#111919] font-mono">{ownerCommits}</strong> of{' '}
          <span className="font-mono">{safeTotal}</span> sampled commits across this codebase.
        </p>
      </div>

      <div className="w-full sm:w-60 shrink-0 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#0B4F4A] font-semibold">{ratio}% @{ownerLogin}</span>
          <span className="text-[#526362]">{100 - ratio}% External</span>
        </div>
        <div className="w-full h-3 bg-[#E2E8E7] rounded-full overflow-hidden flex">
          <div
            className="bg-[#0B4F4A] h-full transition-all"
            style={{ width: `${ratio}%` }}
          />
          <div
            className="bg-[#CBD5D4] h-full transition-all"
            style={{ width: `${100 - ratio}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#526362] font-mono">
          <span>{ownerCommits} candidate commits</span>
          <span>{externalCommits} team/vendor commits</span>
        </div>
      </div>
    </div>
  );
};

/**
 * 10. Engineering Rigor Visual Grid
 * Displays interactive status badges for Tests, CI/CD, Strict Types, Docker, and Manifests
 */
export const EngineeringRigorGrid: React.FC<{
  hasTests: boolean;
  testFilesCount?: number;
  hasCiCd: boolean;
  hasContainer: boolean;
  hasTypes: boolean;
  manifestsCount?: number;
}> = ({
  hasTests,
  testFilesCount = 0,
  hasCiCd,
  hasContainer,
  hasTypes,
  manifestsCount = 1,
}) => {
  const cards = [
    {
      title: 'Automated Tests',
      active: hasTests,
      statusText: hasTests ? `${testFilesCount || 1} test suites` : 'No tests found',
      tag: hasTests ? 'Tests Present' : 'Untested',
      tone: hasTests ? 'teal' : 'neutral',
      icon: '🧪',
    },
    {
      title: 'CI/CD Automation',
      active: hasCiCd,
      statusText: hasCiCd ? 'GitHub Actions / CI' : 'No CI pipeline',
      tag: hasCiCd ? 'Automated' : 'Manual',
      tone: hasCiCd ? 'teal' : 'neutral',
      icon: '⚙️',
    },
    {
      title: 'Strict Type Safety',
      active: hasTypes,
      statusText: hasTypes ? 'TypeScript / Typed' : 'Dynamic / Untyped',
      tag: hasTypes ? 'Type Checked' : 'Standard',
      tone: hasTypes ? 'teal' : 'neutral',
      icon: '🛡️',
    },
    {
      title: 'Containerization',
      active: hasContainer,
      statusText: hasContainer ? 'Dockerfile / Compose' : 'No container config',
      tag: hasContainer ? 'Containerized' : 'Bare Metal',
      tone: hasContainer ? 'teal' : 'neutral',
      icon: '📦',
    },
    {
      title: 'Dependency Manifest',
      active: Boolean(manifestsCount),
      statusText: manifestsCount ? `${manifestsCount} manifest detected` : 'No manifest',
      tag: manifestsCount ? 'Managed' : 'Unmanaged',
      tone: manifestsCount ? 'teal' : 'neutral',
      icon: '📋',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full text-xs">
      {cards.map((c) => (
        <div
          key={c.title}
          className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
            c.active
              ? 'bg-[#EEF6F5]/80 border-[#C5DDD9] text-[#111919]'
              : 'bg-[#F8F9F8] border-[#E2E8E7] text-[#526362] opacity-80'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-base select-none">{c.icon}</span>
            <span
              className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                c.active
                  ? 'bg-[#0B4F4A] text-white'
                  : 'bg-[#E2E8E7] text-[#526362]'
              }`}
            >
              {c.tag}
            </span>
          </div>
          <div>
            <div className="font-semibold text-[#111919] truncate">{c.title}</div>
            <div className="text-[11px] text-[#526362] truncate mt-0.5">
              {c.statusText}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};


