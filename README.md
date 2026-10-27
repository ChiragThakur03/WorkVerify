# WorkVerify

**Evidence-Based Software Skill & Experience Verification Platform**

WorkVerify analyzes observable software engineering work across public GitHub profiles and repositories, linking developer skill claims and job requirements directly to verifiable code artifacts—manifests, source trees, candidate-attributed commits, pull requests, and testing signals.

---

## Core Capabilities

- **Public GitHub Analyzer (`/analyze`)** — Inspect any public GitHub profile or repository URL without requiring account sign-in or GitHub OAuth. Extracts technology signals, filters out vendor/lockfile noise, separates forked vs. original repositories, and attributes commit history.
- **Recruiter Assessment Mode (`/recruiter`)** — Evaluate a candidate's public GitHub profile or repository against a structured job description. Produces an audit-ready verification report with per-requirement evidence states, verifiable code citations, and structured technical interview follow-ups.
- **Applicant Workspace & Multi-JD Matcher (`/workspace`)** — Authenticate, optionally connect GitHub via OAuth, compare your repositories against multiple job descriptions simultaneously, identify skill gaps, and receive role category recommendations.
- **Privacy-Controlled Shareable Dossiers (`/u/:slug`)** — Opt-in public verification profiles that remain strictly private until explicitly published by the account owner.

---

## Architecture & Scoring Principles

1. **Evidence Strength vs. Arbitrary Percentages** — Skill assessments use a deterministic 5-factor scoring model (`verificationEngine.ts`) mapped to four transparent evidence bands: *Strong Evidence*, *Moderate Evidence*, *Weak Evidence*, and *Insufficient Evidence*.
2. **Manifest Presence ≠ Verified Skill** — Declaring a library in `package.json`, `requirements.txt`, or `Cargo.toml` provides an initial signal (capped at 15/100 points) and automatically resolves to *Insufficient Evidence* unless backed by candidate-attributed source file commits.
3. **Fork & Vendor Isolation** — Unauthored code in forked repositories and generated/vendor directories (`node_modules/`, `dist/`, lockfiles) are excluded from candidate attribution.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Lucide Icons
- **Backend:** Node.js, Express (local dev & standalone server) + Vercel Serverless Functions (`api/index.ts`)
- **Database:** Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Testing:** Node.js native test runner (`node:test`) with `tsx`

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your Supabase and GitHub OAuth credentials:

```bash
cp .env.example .env
```

### 3. Initialize Supabase schema

Open your Supabase project's **SQL Editor** and execute the SQL statements in [`supabase/schema.sql`](./supabase/schema.sql).

### 4. Start the development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## Running Tests & Type Checks

```bash
# Run deterministic verification & job-matching unit tests
npm test

# Run TypeScript compiler check
npm run lint
```

---

## Deploying to Vercel + Supabase

1. Push this repository to GitHub and import it into **Vercel**.
2. In your **Supabase** project, run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL Editor.
3. Add the following Environment Variables in **Vercel → Project Settings → Environment Variables**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_URL` (your production Vercel domain, e.g. `https://your-domain.vercel.app`)
   - `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET` (with callback URL `<APP_URL>/auth/callback`)
   - `GITHUB_TOKEN` *(optional, increases GitHub REST API rate limits from 60/hr to 5,000/hr)*
4. Deploy. Static assets are served via Vercel's CDN and `/api/*` + `/auth/callback` routes execute dynamically via `api/index.ts`.
