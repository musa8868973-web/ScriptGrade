# ScriptGrade — Frontend Technical Specification (PRD)
### Rohail Khan Shinwari · Frontend Lead · Alibaba Cloud AI Hackathon Pakistan 2026

> **Document Authority:** This is the single source of truth for all UI decisions, component architecture, API integration contracts, and interaction patterns across the ScriptGrade web dashboard and mobile camera scanner app. Every implementation decision made during the hackathon must trace back to this document.

---

## Table of Contents

1. [System Architecture & UX Overview](#1-system-architecture--ux-overview)
2. [Design System & Token Library](#2-design-system--token-library)
3. [Web Dashboard — 5-Page Specification](#3-web-dashboard--5-page-specification)
4. [Mobile Camera Scanner App — Specification](#4-mobile-camera-scanner-app--specification)
5. [API Integration Contracts & State Management](#5-api-integration-contracts--state-management)
6. [Component Hierarchy & Reusability Matrix](#6-component-hierarchy--reusability-matrix)
7. [Offline Buffering, Error Handling & Retry Strategy](#7-offline-buffering-error-handling--retry-strategy)
8. [Accessibility, RTL Support & i18n](#8-accessibility-rtl-support--i18n)
9. [Build, Tooling & Deployment Targets](#9-build-tooling--deployment-targets)

---

## 1. System Architecture & UX Overview

### 1.1 Dual-Channel Mental Model

ScriptGrade operates on two distinct physical realities that must feel like one unified product:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SCRIPTGRADE UNIFIED UX MODEL                           │
│                                                                             │
│  FIELD CHANNEL (Mobile)              OFFICE CHANNEL (Web)                   │
│  ─────────────────────               ──────────────────                     │
│  📱 Phone Camera Capture             🖥️  Desktop Browser Dashboard           │
│  → Edge Detection Overlay            → Batch PDF Drag-and-Drop              │
│  → Auto-crop + Preview               → ADF Scanner Sync                    │
│  → Single-tap OSS Upload             → Real-time Celery Queue Monitor       │
│  → Instant Score Micro-modal         → Deep Inspection Workspace            │
│                                                                             │
│  Both channels converge at:                                                 │
│  ───────────────────────────                                                │
│  POST /api/v1/papers/upload  →  Alibaba Cloud OSS  →  Celery Queue          │
│  →  Qwen3.8-Max OCR + NLP  →  8-Debugger Engine  →  PostgreSQL+pgvector     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 User Journey Map

```
TEACHER (OFFICE)                          INVIGILATOR (FIELD)
────────────────                          ──────────────────────
/login                                    Mobile App Launch
  │                                          │
  ▼                                          ▼
/dashboard ──── View past exams           Camera Viewport Opens
  │             Check analytics             │
  ▼                                          ▼
/exam/setup ─── Upload Q+A               Aim at answer sheet
  │             AI extracts rubric        Edge Detection locks on
  │             Teacher edits tags          │
  ▼                                          ▼
/exam/upload ── Batch PDF drop           Auto-crop → Preview screen
  │             Live queue monitor          │
  ▼                                          ▼
/exam/grade ─── Split-screen view        Single-tap Upload
                8-Debugger panels          │
                Override controls          ▼
                Export results           Micro-modal: "9/10 · Urdu Detected"
                                         Queued for web dashboard sync
```

### 1.3 State Machine — Paper Lifecycle

```
           [UPLOADED]
               │
               ▼
          [QUEUED]  ←── Celery receives job
               │
               ▼
        [OCR_IN_PROGRESS]  ←── Qwen3.8-Max VLM active
               │
          ┌────┴────┐
          ▼         ▼
      [FLAGGED]  [EVALUATED]  ←── 8-Debugger complete
          │         │
          ▼         ▼
    [NEEDS_REVIEW]  [SCORED]
          │         │
          └────┬────┘
               ▼
        [OVERRIDE_APPLIED]  ←── Teacher confirmed
               │
               ▼
          [FINALIZED]
               │
               ▼
          [EXPORTED]
```

---

## 2. Design System & Token Library

### 2.1 Design Philosophy

**Precision-first enterprise.** Every visual decision must communicate authority, legibility, and trust — the qualities that convince teachers to trust an AI with their students' grades. The UI should feel like a well-engineered instrument: purposeful, no ornamentation that doesn't carry information. The signature element is the **8-Debugger panel**: color-coded diagnostic tabs that read at a glance like a diagnostic readout from medical imaging software — a deliberate analogy to convey rigor.

### 2.2 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-brand` | `#4F46E5` | Primary CTAs, active nav, branded accents |
| `--color-brand-light` | `#818CF8` | Hover states, gradient highlights |
| `--color-surface` | `#F8FAFC` | Page background (light mode) |
| `--color-surface-dark` | `#0F1117` | Page background (dark mode) |
| `--color-card` | `#FFFFFF` | Card/panel backgrounds (light) |
| `--color-card-dark` | `#1A1D2E` | Card/panel backgrounds (dark) |
| `--color-border` | `#E2E8F0` | Default border (light) |
| `--color-border-dark` | `#2D3148` | Default border (dark) |
| `--color-pass` | `#10B981` | Emerald — Matched / Pass / Verified |
| `--color-alert` | `#F43F5E` | Rose — Negation / Garbage / Fail |
| `--color-warn` | `#F59E0B` | Amber — Sequence mismatch / Partial |
| `--color-vision` | `#06B6D4` | Cyan — Vision AI verified / Diagram |
| `--color-text-primary` | `#0F172A` | Headings (light mode) |
| `--color-text-secondary` | `#64748B` | Subtext, labels (light mode) |
| `--color-text-primary-dark` | `#F1F5F9` | Headings (dark mode) |
| `--color-text-secondary-dark` | `#94A3B8` | Subtext (dark mode) |

### 2.3 Typography

```
Display  →  "Geist" (Variable, 600–800 weight) — for score readouts, hero numbers
Body     →  "Inter" (400–500 weight) — all prose, labels, descriptions
Mono     →  "JetBrains Mono" — JSON diagnostic output, OCR transcripts, code
RTL      →  "Noto Nastaliq Urdu" / "Noto Naskh Arabic" — student sheet preview text
```

**Type Scale (rem, base 16px):**

| Role | Size | Weight | Line Height |
|---|---|---|---|
| `display-xl` | 3.5rem | 800 | 1.1 |
| `display-lg` | 2.25rem | 700 | 1.2 |
| `heading-1` | 1.5rem | 600 | 1.3 |
| `heading-2` | 1.125rem | 600 | 1.4 |
| `body` | 0.9375rem | 400 | 1.6 |
| `caption` | 0.75rem | 500 | 1.5 |
| `mono` | 0.875rem | 400 | 1.7 |

### 2.4 Spacing & Radius Tokens

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `6px` | Badges, small pills |
| `--radius-md` | `10px` | Cards, inputs |
| `--radius-lg` | `16px` | Panels, modals |
| `--radius-xl` | `24px` | Full-bleed sections |
| `--space-xs` | `4px` | Tight gaps |
| `--space-sm` | `8px` | Inline spacing |
| `--space-md` | `16px` | Component padding |
| `--space-lg` | `24px` | Section gutters |
| `--space-xl` | `40px` | Page-level spacing |

### 2.5 Debugger Status Color System

Each of the 8 debuggers has a fixed semantic color used consistently in tabs, badges, and chart fills:

| Debugger | Color Token | Hex | Meaning |
|---|---|---|---|
| I — Garbage Text | `alert` | `#F43F5E` | Red when flagged |
| II — Negation | `alert` | `#F43F5E` | Red when negation detected |
| III — Synonym | `pass` | `#10B981` | Green when matched |
| IV — Spelling | `warn` | `#F59E0B` | Amber when autocorrected |
| V — Sequence DAG | `warn` | `#F59E0B` | Amber when order violated |
| VI — Vision AI | `vision` | `#06B6D4` | Cyan always (VLM output) |
| VII — Density | `warn` | `#F59E0B` | Amber when fluff flagged |
| VIII — Aggregator | `pass` | `#10B981` | Green when all concepts matched |

### 2.6 Shadow & Elevation System

```css
--shadow-sm:  0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
--shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);
--shadow-brand: 0 0 0 3px rgb(79 70 229 / 0.25); /* focus ring */
```

---

## 3. Web Dashboard — 5-Page Specification

**Stack:** React 18 + Vite · Tailwind CSS · Shadcn/UI · Lucide Icons · TanStack React Query v5 · Zustand · Recharts · Axios

---

### Page 1 — Authentication (`/login` & `/signup`)

#### Layout: Asymmetric Split-Screen

```
┌────────────────────────┬────────────────────────────────────────┐
│                        │                                        │
│   LEFT (40%)           │   RIGHT (60%)                          │
│   Brand Panel          │   Form Panel                           │
│                        │                                        │
│  ┌──────────────────┐  │  ┌──────────────────────────────────┐  │
│  │  ScriptGrade     │  │  │  [Sign In]  [Sign Up]  ← Tabs    │  │
│  │  logo mark       │  │  │──────────────────────────────────│  │
│  │                  │  │  │  Institutional Email              │  │
│  │  "Grading that   │  │  │  [_________________________]     │  │
│  │  thinks like a   │  │  │                                  │  │
│  │  teacher — at    │  │  │  Password                        │  │
│  │  machine speed." │  │  │  [_________________________]     │  │
│  │                  │  │  │                                  │  │
│  │  ── Stats ──     │  │  │  ☐ Remember me    Forgot?        │  │
│  │  6M scripts/yr   │  │  │                                  │  │
│  │  80% time saved  │  │  │  [────── Sign In ──────]         │  │
│  │  4 languages     │  │  │                                  │  │
│  │                  │  │  │  ─────── or ──────────           │  │
│  │  Alibaba Cloud   │  │  │                                  │  │
│  │  Qwen-Powered    │  │  │  [Google Workspace SSO] (mock)   │  │
│  │  badge           │  │  │  [Microsoft 365 SSO]   (mock)   │  │
│  │                  │  │  │                                  │  │
│  └──────────────────┘  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│                        │  │  [⚡ Quick Demo Access]           │  │
│                        │  │   Pre-fills + redirects /dash    │  │
│                        │  └──────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────┘
```

#### Component Tree

```
<AuthLayout>
  <BrandPanel>
    <Logo />
    <Tagline />
    <StatsPillRow stats={[examsGraded, timeSaved, languagesSupported]} />
    <AlibabaBadge />
  </BrandPanel>
  <FormPanel>
    <AuthTabs defaultTab="signin">
      <SignInForm onSuccess={redirectToDashboard} />
      <SignUpForm onSuccess={redirectToDashboard} />
    </AuthTabs>
    <SSOButtons mock />
    <QuickDemoButton />   {/* CRITICAL — pre-seeds auth token + redirects */}
  </FormPanel>
</AuthLayout>
```

#### Sign In Form — Field Specs

| Field | Type | Validation | Error State |
|---|---|---|---|
| `email` | `text/email` | Required · RFC 5322 | "Enter a valid institutional email" |
| `password` | `password` | Required · min 8 chars | "Incorrect password" |
| `rememberMe` | `checkbox` | Optional | — |

#### Sign Up Form — Field Specs

| Field | Type | Validation |
|---|---|---|
| `fullName` | `text` | Required · 2–80 chars |
| `email` | `email` | Required · institutional domain |
| `institution` | `text` | Required · 2–100 chars |
| `role` | `select` | Teacher / Department Head / Exam Controller |
| `password` | `password` | Required · strength meter: Weak/Fair/Strong |
| `confirmPassword` | `password` | Must match `password` |
| `agreeToTerms` | `checkbox` | Required |

#### Quick Demo Button — Critical Implementation

```tsx
const QuickDemoButton = () => {
  const { setToken, setUser } = useAuthStore();
  const router = useRouter();

  const handleDemo = async () => {
    // Fires POST /api/v1/auth/login with demo credentials
    const res = await authApi.login({
      email: "demo@scriptgrade.pk",
      password: "HackathonDemo2026"
    });
    setToken(res.data.access_token);
    setUser(res.data.teacher);
    router.push("/dashboard");
  };

  return (
    <button
      onClick={handleDemo}
      className="w-full py-3 rounded-md bg-indigo-600 text-white font-semibold
                 flex items-center justify-center gap-2 hover:bg-indigo-700 transition"
    >
      <Zap size={16} />
      Quick Demo Access
    </button>
  );
};
```

**Redirect target on any auth success:** `/dashboard`

---

### Page 2 — Exam Hub Dashboard (`/dashboard`)

#### Layout: Topbar + Sidebar + Main Content

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOPBAR                                                                │
│ [ScriptGrade Logo]  [Qwen-Powered badge]  ─────  [Notifications] [👤]│
├───────────┬──────────────────────────────────────────────────────────┤
│           │  GLOBAL METRICS STRIP                                     │
│ SIDEBAR   │  [Total Exams: 24] [Accuracy: 94.2%] [Hours Saved: 316h] │
│           ├──────────────────────────────────────────────────────────┤
│  Dashboard│                                                           │
│  Exams    │  + Create & Grade New Exam  ←── PRIMARY CTA (top right)  │
│  Analytics│                                                           │
│  Settings │  ┌────────────────────────────────────────────────────┐   │
│  Help     │  │  RECENT EXAMS TABLE                                │   │
│           │  │  Exam Name │ Date │ Class Size │ Status │ Avg │ ⋯  │   │
│           │  │  ──────────┼──────┼────────────┼────────┼─────┼──  │   │
│           │  │  Bio 101   │ Aug  │ 50         │ ✅Done │ 78% │ → │   │
│           │  │  Chem Mid  │ Jul  │ 35         │ 🔄Proc │ ──  │ → │   │
│           │  └────────────────────────────────────────────────────┘   │
│           │                                                           │
│           │  ┌──────────────────────┐  ┌─────────────────────────┐   │
│           │  │  Score Distribution  │  │  Quick Actions          │   │
│           │  │  [Bar Chart]         │  │  Re-extract rubric      │   │
│           │  │  x: Score bands      │  │  Review flagged papers  │   │
│           │  │  y: # of students    │  │  Download class report  │   │
│           │  └──────────────────────┘  └─────────────────────────┘   │
└───────────┴──────────────────────────────────────────────────────────┘
```

#### Exam Table — Column Definitions

| Column | Data Source | Render |
|---|---|---|
| Exam Name | `exam.name` | Text link → `/exam/grade?id=exam.id` |
| Date | `exam.created_at` | `"Aug 19, 2026"` |
| Class Size | `exam.paper_count` | Integer with student icon |
| Status | `exam.status` | `StatusBadge` (see below) |
| Class Avg | `exam.avg_score / exam.max_score * 100` | `"78.4%"` or `"—"` if processing |
| Actions | — | `⋯` menu: Re-grade / Export / Archive |

#### StatusBadge Component

```tsx
type ExamStatus = "completed" | "processing" | "needs_review" | "draft";

const statusConfig = {
  completed:    { label: "Completed",    color: "emerald", icon: CheckCircle },
  processing:   { label: "Processing",   color: "indigo",  icon: Loader2    },
  needs_review: { label: "Needs Review", color: "amber",   icon: AlertTriangle },
  draft:        { label: "Draft",        color: "slate",   icon: FileText   },
};
```

#### Global Metrics Strip — Data Contract

```tsx
interface DashboardMetrics {
  total_exams:    number;   // count of all exams by this teacher
  accuracy_pct:   number;   // avg (teacher-confirmed / AI-scored) across all overrides
  hours_saved:    number;   // total_papers * 0.35 (minutes/paper) / 60
}
// Fetched via: GET /api/v1/exams/list  →  computed client-side
```

#### Score Distribution Chart (Recharts)

```tsx
<BarChart data={scoreBands} width={520} height={220}>
  <XAxis dataKey="band" label="Score Range" />
  <YAxis label="Students" />
  <Bar dataKey="count" fill="#4F46E5" radius={[4,4,0,0]} />
  <Tooltip formatter={(v) => [`${v} students`]} />
</BarChart>
// scoreBands: [{ band: "0–20%", count: 2 }, { band: "21–40%", ... }, ...]
```

---

### Page 3 — AI Rubric Studio (`/exam/setup`)

#### Layout: Stepper Header + Two-Column Body

```
┌───────────────────────────────────────────────────────────────────────┐
│ BREADCRUMB: Dashboard > New Exam Setup                                │
│                                                                       │
│ ─── STEP INDICATOR ────────────────────────────────────────────────  │
│  [1 Upload] ──── [2 AI Extraction] ──── [3 Edit & Confirm] ──── [4↓] │
│                                                                       │
├─────────────────────────────┬─────────────────────────────────────────┤
│ SECTION A (Upload)          │ SECTION B (Magic Concepts Editor)        │
│                             │                                         │
│  ┌───────────────────────┐  │  ┌─────────────────────────────────────┐ │
│  │  📄 Drag & Drop Zone  │  │  │  AI-Extracted Magic Concepts        │ │
│  │  Question Paper       │  │  │  ─────────────────────────────────  │ │
│  │  + Reference Answer   │  │  │  [Sunlight 3pts ✎ ✕] [Chlorophyll  │ │
│  │  (PDF / PNG)          │  │  │   3pts ✎ ✕] [Glucose 2pts ✎ ✕]    │ │
│  └───────────────────────┘  │  │  [CO₂ 1pt ✎ ✕] [Oxygen 1pt ✎ ✕]  │ │
│                             │  │  [+ Add Magic Word]                 │ │
│  [⚡ Auto-Extract with      │  │                                       │ │
│     Qwen AI]                │  │  ── Synonyms Cluster Sub-panel ──   │ │
│                             │  │  Sunlight → solar energy, radiation │ │
│  Upload State:              │  │  Chlorophyll → green pigment, pigmt │ │
│  • Idle / Uploading /       │  └─────────────────────────────────────┘ │
│    Extracting / Done        │                                         │
│                             │  SECTION C: Sensitivity Toggles         │
│                             │  ┌─────────────────────────────────────┐ │
│                             │  │ ⚙ Ignore Minor Spelling Mistakes    │ │
│                             │  │   Levenshtein ≥ 85%      [●  ON]   │ │
│                             │  │                                     │ │
│                             │  │ ⚙ Strict Procedural Order          │ │
│                             │  │   DAG Logic Enforcement  [○ OFF]   │ │
│                             │  │                                     │ │
│                             │  │ ⚙ Anti-Fluff Density Scoring       │ │
│                             │  │   Min density 30%        [●  ON]   │ │
│                             │  └─────────────────────────────────────┘ │
└─────────────────────────────┴─────────────────────────────────────────┘
│  [Save Rubric & Proceed to Paper Upload →]                            │
└───────────────────────────────────────────────────────────────────────┘
```

#### Magic Concept Tag Component

```tsx
interface MagicConcept {
  id:        string;
  keyword:   string;
  points:    number;
  synonyms:  string[];
}

const MagicConceptTag = ({
  concept, onEdit, onDelete, onSynonymAdd
}: MagicConceptTagProps) => (
  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                  bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm">
    <span className="font-medium">{concept.keyword}</span>
    <span className="text-indigo-400 text-xs">{concept.points}pts</span>
    <button onClick={() => onEdit(concept)} aria-label="Edit concept">
      <Pencil size={12} className="text-indigo-400 hover:text-indigo-700" />
    </button>
    <button onClick={() => onDelete(concept.id)} aria-label="Remove concept">
      <X size={12} className="text-indigo-400 hover:text-rose-500" />
    </button>
  </div>
);
```

#### AI Extraction — Interaction Flow

```
Teacher uploads Q+A files
    │
    ▼
POST /api/v1/exam/setup
    │
    ▼ (optimistic: show skeleton tags)
Response: { exam_id, concepts: [{keyword, points, synonyms}] }
    │
    ▼
RubricEditorStore.hydrate(concepts)
    │
    ▼
Teacher edits (add / remove / re-weight)
    │
    ▼
PUT /api/v1/exam/rubric  →  { exam_id, concepts, toggles }
    │
    ▼
router.push('/exam/upload?exam_id=...')
```

#### Sensitivity Toggles — State Shape

```tsx
interface EvaluationToggles {
  spelling_correction: boolean;  // Debugger IV — Levenshtein ≥85%
  strict_dag_order:    boolean;  // Debugger V — procedural sequence
  density_scoring:     boolean;  // Debugger VII — anti-fluff threshold
}

// Zustand store slice
const useRubricStore = create<RubricStore>((set) => ({
  concepts:  [],
  toggles: {
    spelling_correction: true,
    strict_dag_order:    false,
    density_scoring:     true,
  },
  setToggle: (key, val) =>
    set((s) => ({ toggles: { ...s.toggles, [key]: val } })),
}));
```

---

### Page 4 — Dual Upload & Scan Portal (`/exam/upload`)

#### Layout: Two-Zone Upload + Live Queue Monitor

```
┌───────────────────────────────────────────────────────────────────────┐
│ BREADCRUMB: Dashboard > Biology 101 > Upload Answer Sheets            │
├───────────────────────────────────────────────────────────────────────┤
│ SECTION A: DUAL-SOURCE UPLOAD HUB                                     │
│                                                                       │
│  ┌────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │  🖨️  OFFICE SCANNER         │  │  📱 MOBILE APP SYNC              │ │
│  │                            │  │                                  │ │
│  │  Drag & drop multi-page    │  │  ┌──────────────────────────┐    │ │
│  │  scanned PDFs here         │  │  │  [QR Code SVG]           │    │ │
│  │                            │  │  └──────────────────────────┘    │ │
│  │  or [Browse Files]         │  │                                  │ │
│  │                            │  │  Scan with ScriptGrade App       │ │
│  │  Accepts: PDF · PNG · JPG  │  │  to sync papers wirelessly.     │ │
│  │  Max: 200MB per batch      │  │                                  │ │
│  │                            │  │  ● Live sync status:             │ │
│  │  Source tag: web_dashboard  │  │    "48 papers received"         │ │
│  └────────────────────────────┘  └──────────────────────────────────┘ │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│ SECTION B: REAL-TIME PROCESSING MONITOR                               │
│                                                                       │
│  Qwen-VL Vision AI evaluating 50 student sheets...                   │
│  ████████████████████████░░░░░░ 48 / 50                              │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ PAPER QUEUE TABLE                                                 │ │
│  │ # │ Student ID │ Source   │ Language   │ Status        │ Score   │ │
│  │ ─ ┼───────────┼──────────┼────────────┼───────────────┼──────── │ │
│  │ 1 │ STU-101   │ 📱Mobile │ اردو Urdu  │ ✅ Evaluated  │ 8/10   │ │
│  │ 2 │ STU-102   │ 🖥️ Web   │ EN English │ ✅ Evaluated  │ 10/10  │ │
│  │ 3 │ STU-103   │ 📱Mobile │ EN English │ ⚠️ Needs Rev  │ 4/10   │ │
│  │ 4 │ STU-104   │ 🖥️ Web   │ سنڌي       │ 🔄 Processing │ ──     │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Counters: Processed: 48/50  |  Flagged for Review: 2/50             │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│               [Launch Master Grading Workspace →]                     │
│               (Enabled when all papers reach SCORED/NEEDS_REVIEW)    │
└───────────────────────────────────────────────────────────────────────┘
```

#### Live Queue Polling — Implementation

```tsx
// React Query with 3s polling interval while papers are processing
const { data: queue } = useQuery({
  queryKey: ['paperQueue', examId],
  queryFn: () => api.get(`/api/v1/papers/queue?exam_id=${examId}`),
  refetchInterval: (data) => {
    const allDone = data?.papers.every(
      p => ['evaluated', 'needs_review', 'scored'].includes(p.status)
    );
    return allDone ? false : 3000; // stop polling when complete
  },
});
```

#### Source Tag Badge Component

```tsx
const SourceBadge = ({ source }: { source: 'mobile' | 'web_dashboard' }) =>
  source === 'mobile' ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5
                     bg-violet-50 text-violet-700 border border-violet-200 rounded-full">
      <Smartphone size={10} /> Mobile
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5
                     bg-sky-50 text-sky-700 border border-sky-200 rounded-full">
      <Monitor size={10} /> Web
    </span>
  );
```

---

### Page 5 — Master Grading & Diagnostic Workspace (`/exam/grade`)

This is the flagship page. Every design decision here must serve one goal: make the AI's reasoning fully transparent and override-friendly for the teacher.

#### Layout: Fixed 50/50 Split View

```
┌──────────────────────────────────┬──────────────────────────────────────┐
│  LEFT PANEL (50%)                │  RIGHT PANEL (50%)                    │
│  Document Viewer & Navigation    │  AI Diagnostics & Override            │
│                                  │                                       │
│  ┌──────────────────────────┐    │  ┌───────────────────────────────┐    │
│  │ Student Selector         │    │  │  SCORE WIDGET                 │    │
│  │ [STU-102 ▼] [🔍 Search]  │    │  │                               │    │
│  │ [☐ Flagged Only]         │    │  │  10 / 10                      │    │
│  └──────────────────────────┘    │  │  ─────────────                │    │
│                                  │  │  OCR Confidence:  96.5%       │    │
│  PAPERS SIDEBAR                  │  │  Word Count:      28 words    │    │
│  ┌──────────────────────────┐    │  │  Density Ratio:   88.5%       │    │
│  │ STU-101  ● 8/10  اردو   │    │  │  Language:       EN English   │    │
│  │ STU-102  ● 10/10  EN    │←   │  │  Source:         📱 Mobile    │    │
│  │ STU-103  ⚠ 4/10  FLAGG │    │  └───────────────────────────────┘    │
│  │ STU-104  🔄 Processing   │    │                                       │
│  └──────────────────────────┘    │  8-DEBUGGER TABS                      │
│                                  │  ┌───────────────────────────────┐    │
│  DOCUMENT VIEWER                 │  │ [I] [II] [III] [IV]           │    │
│  ┌──────────────────────────┐    │  │ [V]  [VI] [VII] [VIII]        │    │
│  │                          │    │  │───────────────────────────────│    │
│  │   High-Res Scan Image    │    │  │  ACTIVE TAB CONTENT PANEL     │    │
│  │   or OCR Rendered Text   │    │  │  (see per-tab specs below)    │    │
│  │   (toggle: Scan / OCR)   │    │  └───────────────────────────────┘    │
│  │                          │    │                                       │
│  │  RTL text renders        │    │  TEACHER OVERRIDE PANEL               │
│  │  correctly in Noto       │    │  ┌───────────────────────────────┐    │
│  │  Nastaliq font           │    │  │  Score Override:  [10] / 10   │    │
│  │                          │    │  │                               │    │
│  │  Bounding boxes for      │    │  │  Moderation Note:             │    │
│  │  Debugger VI overlaid    │    │  │  ┌─────────────────────────┐  │    │
│  │  when tab VI active      │    │  │  │ e.g. "Diagram excellent" │  │    │
│  │                          │    │  │  └─────────────────────────┘  │    │
│  └──────────────────────────┘    │  │  [Confirm Override]            │    │
│                                  │  └───────────────────────────────┘    │
├──────────────────────────────────┴──────────────────────────────────────┤
│  [← Previous Paper]      [Export CSV/PDF]    [Finish Session]  [Next →] │
└────────────────────────────────────────────────────────────────────────┘
```

#### 8-Debugger Tab Panel — Per-Tab Render Specs

**Tab I — Garbage Text Detector**
```
Status: ✅ Clean (score: 0.02)
──────────────────────────────────────────────────────
Contextual Relevance Score: 0.02 / 1.0   [LOW = GOOD]
Threshold: 0.35 (flagged if score exceeds)
All 2 sentences exceed relevance threshold.
No filler, padding, or copied prompt text detected.
```

**Tab II — Negation & Reversal Engine**
```
Status: ✅ No Negation Detected
──────────────────────────────────────────────────────
Dependency parse: 0 negation tokens bound to rubric concepts
Tokens scanned: not · never · fails to · without
Flagged phrases: [none]
```

**Tab III — Synonym & Semantic Matcher**
```
Status: ✅ 2 Synonyms Resolved
──────────────────────────────────────────────────────
┌─────────────────────┬─────────────────┬────────────┐
│ Student Token       │ Rubric Concept  │ Similarity │
├─────────────────────┼─────────────────┼────────────┤
│ "solar energy"      │ Sunlight        │ 0.94       │
│ "green pigment"     │ Chlorophyll     │ 0.91       │
└─────────────────────┴─────────────────┴────────────┘
Method: pgvector cosine-similarity semantic search
```

**Tab IV — Fuzzy Spelling Auto-Corrector**
```
Status: ⚠️ 1 Auto-Correction Applied (no deduction)
──────────────────────────────────────────────────────
┌──────────────────┬───────────────────┬──────────────┐
│ Original Token   │ Corrected Token   │ Levenshtein  │
├──────────────────┼───────────────────┼──────────────┤
│ photosinthesis   │ photosynthesis    │ 0.92 (≥0.85) │
└──────────────────┴───────────────────┴──────────────┘
```

**Tab V — Sequence & Procedural DAG Verifier**
```
Status: ✅ Correct Order
──────────────────────────────────────────────────────
Expected → Detected:
[Sunlight Absorption] → ✅
[Chlorophyll Activation] → ✅
[CO₂ Fixation] → ✅
[Glucose Synthesis] → ✅

DAG transitions validated: 4/4
Strict Order Toggle: ENABLED
```

**Tab VI — Vision AI Diagram Inspector (Qwen-VL)**

```
Status: 🔵 Vision Verified (confidence: 91.3%)
──────────────────────────────────────────────────────
[Scanned image region displayed with bounding boxes]

Detected Elements:
┌──────────────────────┬───────────────────────┬───────┐
│ Label                │ Bounding Box           │ Conf. │
├──────────────────────┼───────────────────────┼───────┤
│ Chloroplast          │ [112, 88, 240, 195]   │ 93.1% │
│ Arrow: CO₂ → Leaf    │ [300, 140, 410, 160]  │ 89.5% │
└──────────────────────┴───────────────────────┴───────┘
```

> When Tab VI is active, the left Document Viewer overlays the bounding boxes from `detected_elements` onto the scanned image using absolute-positioned `<div>` elements with `mix-blend-mode: multiply` in cyan (`#06B6D4`).

**Tab VII — Anti-Fluff Density Scorer**
```
Status: ✅ High Density
──────────────────────────────────────────────────────
Density Ratio: 88.5% (threshold: 30%)
Valid Keyword Hits: 5
Total Word Count: 28
Formula: (5 / 28) × 100 = 17.86%  →  normalized 88.5%
```

**Tab VIII — Rubric Score Aggregator**
```
Status: ✅ Full Match (10/10)
──────────────────────────────────────────────────────
┌─────────────────┬───────┬────────┬────────────┐
│ Concept         │ Award │ Max    │ Match Type │
├─────────────────┼───────┼────────┼────────────┤
│ Sunlight        │ 3     │ 3      │ synonym    │
│ Chlorophyll     │ 3     │ 3      │ synonym    │
│ Glucose         │ 2     │ 2      │ exact      │
│ CO₂             │ 1     │ 1      │ exact      │
│ Oxygen          │ 1     │ 1      │ fuzzy      │
└─────────────────┴───────┴────────┴────────────┘
Total: 10.0 / 10.0
```

#### Teacher Override Panel — Implementation

```tsx
const OverridePanel = ({ studentId, currentScore, maxScore, onOverrideSuccess }) => {
  const [score, setScore] = useState(currentScore);
  const [note, setNote] = useState("");
  const overrideMutation = useMutation({
    mutationFn: (payload) => api.post(
      `/api/v1/papers/${studentId}/override`, payload
    ),
    onSuccess: () => {
      queryClient.invalidateQueries(['paper', studentId]);
      queryClient.invalidateQueries(['paperQueue']);
      onOverrideSuccess?.();
    }
  });

  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
      <label className="text-sm font-semibold text-slate-700">Score Override</label>
      <div className="flex items-center gap-2">
        <input
          type="number" min={0} max={maxScore}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-20 rounded-md border border-slate-300 px-2 py-1
                     text-center font-mono text-lg focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-slate-500">/ {maxScore}</span>
      </div>
      <textarea
        placeholder="Add moderation note for audit record..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-slate-300 p-2 text-sm
                   resize-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        onClick={() => overrideMutation.mutate({ override_score: score, moderation_note: note })}
        disabled={overrideMutation.isPending}
        className="w-full py-2 rounded-md bg-indigo-600 text-white text-sm
                   font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {overrideMutation.isPending ? "Saving..." : "Confirm Override"}
      </button>
    </div>
  );
};
```

---

## 4. Mobile Camera Scanner App — Specification

**Stack:** React Native (Expo SDK 51+) · Expo Camera · Expo FileSystem · Expo NetInfo · React Native Reanimated · React Query · Zustand · NativeWind (Tailwind for RN)

### 4.1 App Screen Architecture

```
┌─────────────────────────────────────────────────────────┐
│              SCRIPTGRADE MOBILE — SCREEN MAP             │
│                                                         │
│  /SplashScreen                                          │
│       │                                                 │
│       ▼                                                 │
│  /Auth ── (if no token stored in SecureStore)           │
│       │                                                 │
│       ▼                                                 │
│  /ScannerHome ─── Entry screen with exam selector       │
│       │                                                 │
│       ▼                                                 │
│  /CameraViewport ─── Full-screen camera + edge overlay  │
│       │                                                 │
│       ▼                                                 │
│  /PreviewScreen ─── Cropped preview + student ID entry  │
│       │                                                 │
│       ▼                                                 │
│  /UploadingScreen ─── Progress + OSS upload feedback    │
│       │                                                 │
│       ▼                                                 │
│  /ScoreMicroModal ─── Instant result overlay (9/10)     │
│       │                                                 │
│  [Scan Next Paper] ── loops back to /CameraViewport     │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Camera Viewport Screen

#### Full-Screen Layout (portrait, 390×844)

```
┌──────────────────────────────────┐
│  STATUS BAR (transparent)        │
│                                  │
│  [←] Cancel    ScriptGrade  [?]  │
│──────────────────────────────────│
│                                  │
│                                  │
│   LIVE CAMERA FEED               │
│                                  │
│   ┌─  ─  ─  ─  ─  ─  ─  ─ ─ ─┐  │
│   |                            |  │
│   |  EDGE DETECTION OVERLAY    |  │
│   |  (animated cyan corners)   |  │
│   |                            |  │
│   |  "Align document edges"    |  │
│   |  (label fades when locked) |  │
│   |                            |  │
│   └─  ─  ─  ─  ─  ─  ─  ─ ─ ─┘  │
│                                  │
│   ● Language Auto-Detected: اردو │
│                                  │
│──────────────────────────────────│
│                                  │
│        [◎  CAPTURE]              │
│                                  │
│    [📁 From Gallery]  [⚙ Flash]  │
└──────────────────────────────────┘
```

#### Edge Detection Overlay — Implementation

```tsx
const EdgeOverlay = ({ isLocked }: { isLocked: boolean }) => {
  const borderColor = useSharedValue(isLocked ? '#06B6D4' : '#ffffff80');

  // Animate to cyan when edge is detected and "locked"
  useEffect(() => {
    borderColor.value = withSpring(isLocked ? '#06B6D4' : '#ffffff80');
  }, [isLocked]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Corner brackets — 4 positioned absolutely */}
      <Animated.View style={[styles.cornerTL, { borderColor: borderColor }]} />
      <Animated.View style={[styles.cornerTR, { borderColor: borderColor }]} />
      <Animated.View style={[styles.cornerBL, { borderColor: borderColor }]} />
      <Animated.View style={[styles.cornerBR, { borderColor: borderColor }]} />
      {!isLocked && (
        <Text style={styles.hint}>Align document edges</Text>
      )}
    </View>
  );
};
```

#### Camera Capture Logic

```tsx
const handleCapture = async () => {
  if (!cameraRef.current) return;

  const photo = await cameraRef.current.takePictureAsync({
    quality: 0.92,
    exif: false,
    skipProcessing: false,
  });

  // Auto-crop using detected corners (if edge detection has locked)
  const cropped = edgeLocked
    ? await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: computeCropRegion(detectedCorners, photo.width, photo.height) }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      )
    : photo;

  navigation.navigate('Preview', { imageUri: cropped.uri });
};
```

### 4.3 Preview Screen

```
┌──────────────────────────────────┐
│  [← Retake]    Preview    [Use →]│
│──────────────────────────────────│
│                                  │
│  ┌──────────────────────────┐    │
│  │                          │    │
│  │   CROPPED ANSWER SHEET   │    │
│  │   (scrollable if tall)   │    │
│  │                          │    │
│  │   RTL text renders in    │    │
│  │   correct Nastaliq font  │    │
│  │   for preview            │    │
│  │                          │    │
│  └──────────────────────────┘    │
│                                  │
│  Student Roll Number:            │
│  [___________________________]   │
│                                  │
│  Exam:  [Biology 101 ▼]          │
│                                  │
│  Language Hint:                  │
│  [Auto-Detect] [EN] [اردو] [سنڌي]│
│                                  │
│  [⬆ Upload Answer Sheet]         │
└──────────────────────────────────┘
```

### 4.4 Upload & Score Micro-Modal

#### Upload Progress Screen

```
┌──────────────────────────────────┐
│                                  │
│         Uploading...             │
│                                  │
│   ████████████████░░░░  74%      │
│                                  │
│   Sending to Alibaba OSS...      │
│   Qwen-VL reading handwriting... │
│   8-Debugger evaluating...       │
│                                  │
│   [Cancel Upload]                │
│                                  │
└──────────────────────────────────┘
```

#### Score Micro-Modal (bottom sheet, slides up after result)

```
┌──────────────────────────────────┐
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │  ← drag handle
│                                  │
│   STU-102 · Biology 101          │
│                                  │
│        9 / 10 Marks              │  ← large Geist 700 display
│                                  │
│   ──────────────────────         │
│   OCR Confidence:   96.5%  ✅    │
│   Language Detected: EN  🇺🇸      │
│   Source:           Mobile 📱    │
│   Synonym Matches:  2            │
│   Spelling Fixed:   1            │
│                                  │
│   [Scan Next Paper]              │
│   [View Full Diagnostic →]       │  (opens web dashboard link)
│                                  │
└──────────────────────────────────┘
```

#### Micro-Modal — Quick Result Data Contract

```tsx
interface QuickScoreResult {
  student_id:       string;
  score:            number;
  max_score:        number;
  ocr_confidence:   number;
  language_detected: 'en' | 'ur' | 'sd' | 'pa';
  ingestion_source: 'mobile';
  synonym_matches:  number;
  corrections_made: number;
  job_id:           string;  // for linking to web dashboard
}
```

### 4.5 Offline Queue

```tsx
// useOfflineQueue hook — wraps expo-file-system + NetInfo
const useOfflineQueue = () => {
  const [queue, setQueue] = useState<ScanJob[]>([]);
  const isOnline = useNetInfo().isInternetReachable;

  const enqueue = async (job: ScanJob) => {
    // Persist scan to local FS
    await FileSystem.copyAsync({
      from: job.imageUri,
      to: `${FileSystem.documentDirectory}queue/${job.id}.jpg`,
    });
    setQueue(prev => [...prev, job]);
    await AsyncStorage.setItem('scan_queue', JSON.stringify([...queue, job]));
  };

  // Auto-drain queue on connectivity restore
  useEffect(() => {
    if (isOnline && queue.length > 0) drainQueue();
  }, [isOnline]);

  const drainQueue = async () => {
    for (const job of queue) {
      await uploadScan(job);
      setQueue(prev => prev.filter(j => j.id !== job.id));
    }
  };

  return { enqueue, queue, pendingCount: queue.length };
};
```

---

## 5. API Integration Contracts & State Management

### 5.1 Axios Client Configuration

```tsx
// lib/api.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // http://localhost:8000/api/v1
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
```

### 5.2 Complete API Surface — Frontend Contracts

| # | Endpoint | Method | Used By Page | Request Shape | Response Shape |
|---|---|---|---|---|---|
| 1 | `/api/v1/auth/login` | POST | `/login` | `{ email, password }` | `{ access_token, teacher: { id, name, institution } }` |
| 2 | `/api/v1/auth/signup` | POST | `/signup` | `{ full_name, email, institution, role, password }` | `{ access_token, teacher }` |
| 3 | `/api/v1/exams/list` | GET | `/dashboard` | — | `{ exams[], metrics: { total, accuracy_pct, hours_saved } }` |
| 4 | `/api/v1/exam/setup` | POST | `/exam/setup` | `FormData: { question_file, answer_file }` | `{ exam_id, concepts[{ keyword, points, synonyms[] }] }` |
| 5 | `/api/v1/exam/rubric` | PUT | `/exam/setup` | `{ exam_id, concepts[], toggles }` | `{ exam_id, saved: true }` |
| 6 | `/api/v1/papers/upload` | POST | Mobile App | `FormData: { file, exam_id, student_id, source, language }` | `{ job_id, status: "queued", oss_key, estimated_completion_seconds }` |
| 7 | `/api/v1/papers/batch-upload` | POST | `/exam/upload` | `FormData: { files[], exam_id, source: "web_dashboard" }` | `{ batch_id, jobs[{ job_id, student_inferred_id }] }` |
| 8 | `/api/v1/papers/{student_id}` | GET | `/exam/grade` | — | Full 8-debugger JSON (see README §7) |
| 9 | `/api/v1/papers/{student_id}/override` | POST | `/exam/grade` | `{ override_score, moderation_note }` | `{ applied: true, final_score }` |
| 10 | `/api/v1/analytics/export` | GET | `/exam/grade` | `?exam_id=&format=csv|pdf` | Binary file stream |

### 5.3 React Query — Key Definitions

```tsx
// Query keys factory — single source of truth
export const queryKeys = {
  exams:         () => ['exams'],
  examDetail:    (id: string) => ['exam', id],
  paperQueue:    (examId: string) => ['paperQueue', examId],
  paper:         (studentId: string) => ['paper', studentId],
  dashMetrics:   () => ['dashMetrics'],
};

// Mutation — batch upload
export const useBatchUpload = (examId: string) =>
  useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      form.append('exam_id', examId);
      form.append('source', 'web_dashboard');
      return api.post('/api/v1/papers/batch-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          uploadProgressStore.setState({ pct: Math.round((e.loaded / e.total!) * 100) });
        },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.paperQueue(examId) }),
  });
```

### 5.4 Zustand Store Architecture

```tsx
// stores/auth.ts
interface AuthStore {
  token: string | null;
  teacher: Teacher | null;
  setToken: (t: string) => void;
  setUser: (u: Teacher) => void;
  clearToken: () => void;
}

// stores/rubric.ts
interface RubricStore {
  examId: string | null;
  concepts: MagicConcept[];
  toggles: EvaluationToggles;
  addConcept: (c: MagicConcept) => void;
  removeConcept: (id: string) => void;
  updateConcept: (id: string, patch: Partial<MagicConcept>) => void;
  setToggle: (key: keyof EvaluationToggles, val: boolean) => void;
}

// stores/grade.ts
interface GradeStore {
  activeStudentId: string | null;
  activeDebuggerTab: number;    // 1–8
  showFlaggedOnly: boolean;
  viewMode: 'scan' | 'ocr';    // Document viewer toggle
  setActiveStudent: (id: string) => void;
  setDebuggerTab: (n: number) => void;
  toggleFlaggedOnly: () => void;
}
```

---

## 6. Component Hierarchy & Reusability Matrix

### 6.1 Shared Component Library

```
src/components/
├── ui/
│   ├── StatusBadge.tsx          – exam/paper status pill
│   ├── SourceBadge.tsx          – Mobile vs Web ingestion tag
│   ├── LanguageBadge.tsx        – EN / اردو / سنڌي / ਪੰਜਾਬੀ tag
│   ├── ScoreDisplay.tsx         – "10 / 10" display widget
│   ├── ProgressBar.tsx          – generic animated fill bar
│   ├── LoadingSpinner.tsx       – brand-colored spinner
│   └── Toast.tsx                – success / error / info toasts
│
├── layout/
│   ├── AppShell.tsx             – topbar + sidebar + main
│   ├── Topbar.tsx               – logo, metrics strip, avatar
│   ├── Sidebar.tsx              – nav links, active state
│   └── PageHeader.tsx           – breadcrumb + title + CTA slot
│
├── rubric/
│   ├── MagicConceptTag.tsx      – editable tag with synonyms
│   ├── SynonymCluster.tsx       – synonym sub-panel
│   ├── RubricEditor.tsx         – full concept grid + add form
│   └── SensitivityToggles.tsx   – 3-toggle panel
│
├── grading/
│   ├── DocumentViewer.tsx       – scan image / OCR text with overlay
│   ├── BoundingBoxOverlay.tsx   – Vision AI diagram boxes
│   ├── DebuggerTabs.tsx         – tab switcher + panel router
│   ├── debuggers/
│   │   ├── GarbageTextPanel.tsx
│   │   ├── NegationPanel.tsx
│   │   ├── SynonymPanel.tsx
│   │   ├── SpellingPanel.tsx
│   │   ├── SequenceDagPanel.tsx
│   │   ├── VisionPanel.tsx
│   │   ├── DensityPanel.tsx
│   │   └── AggregatorPanel.tsx
│   ├── OverridePanel.tsx        – score input + note + confirm
│   └── StudentSidebar.tsx       – filtered paper list
│
└── upload/
    ├── DropZone.tsx             – drag-and-drop with accept types
    ├── BatchQueueTable.tsx      – live processing monitor table
    └── MobileQRSync.tsx        – QR display + live sync status
```

### 6.2 Reusability Matrix

| Component | Login | Dashboard | Setup | Upload | Grade | Mobile |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| StatusBadge | | ✅ | | ✅ | ✅ | |
| SourceBadge | | | | ✅ | ✅ | |
| LanguageBadge | | | | ✅ | ✅ | ✅ |
| ScoreDisplay | | ✅ | | | ✅ | ✅ |
| ProgressBar | | | ✅ | ✅ | | ✅ |
| PageHeader | | ✅ | ✅ | ✅ | ✅ | |
| AppShell | | ✅ | ✅ | ✅ | ✅ | |
| DropZone | | | ✅ | ✅ | | |
| Toast | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 7. Offline Buffering, Error Handling & Retry Strategy

### 7.1 Mobile Offline Queue — State Machine

```
SCAN CAPTURED
     │
     ▼
[CHECK CONNECTIVITY]
     │
   Online? ─── Yes ──► UPLOAD_IN_PROGRESS ──► SUCCESS → ScoreMicroModal
     │
    No
     │
     ▼
QUEUED_OFFLINE (persisted to device FS + AsyncStorage)
     │
[MONITOR CONNECTIVITY]
     │
  Online restored
     │
     ▼
AUTO_DRAIN: upload jobs in FIFO order
     │
     ▼
SUCCESS → push notification "STU-102 graded: 9/10"
```

### 7.2 Web Upload — Error Handling Matrix

| HTTP Status | Scenario | UI Response |
|---|---|---|
| `202 Accepted` | Upload queued | Show job in queue table with "Processing" badge |
| `400 Bad Request` | Invalid file type or missing fields | Toast: "File must be PDF or image. Max 200MB." |
| `401 Unauthorized` | Token expired | Redirect to `/login`, preserve upload state in sessionStorage |
| `413 Payload Too Large` | File over OSS limit | Toast: "File exceeds 200MB limit. Split PDF and retry." |
| `422 Unprocessable` | Malformed form data | Toast: "Upload failed — missing student ID or exam." |
| `503 Service Unavailable` | Backend/Celery down | Toast with retry button: "Service busy. Retry in 30s." |
| Network timeout | No response | Auto-retry 3× with exponential backoff (1s, 2s, 4s) |

### 7.3 React Query Retry Config

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx (client errors)
        if (axios.isAxiosError(error) && error.response?.status < 500) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      staleTime: 30_000,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

---

## 8. Accessibility, RTL Support & i18n

### 8.1 RTL Script Rendering (Critical)

Student answer sheets in Urdu, Sindhi, and Punjabi/Nastaliq must render correctly in the OCR text view on Page 5.

```tsx
const RTLTextViewer = ({ text, language }: { text: string; language: string }) => {
  const isRTL = ['ur', 'sd', 'pa'].includes(language);
  const fontFamily = isRTL ? 'Noto Nastaliq Urdu' : 'JetBrains Mono';

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={language}
      className="p-4 rounded-lg bg-slate-50 text-slate-800 leading-loose whitespace-pre-wrap"
      style={{ fontFamily, fontSize: isRTL ? '1.125rem' : '0.875rem' }}
    >
      {text}
    </div>
  );
};
```

**Font loading (index.html):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
```

### 8.2 Accessibility Requirements

| Area | Requirement |
|---|---|
| Keyboard navigation | All interactive elements reachable via Tab. Modals trap focus. |
| Focus ring | 3px `--color-brand` outline visible on all focusable elements. |
| ARIA labels | All icon-only buttons have `aria-label`. Status badges use `role="status"`. |
| Color contrast | All text meets WCAG 2.1 AA (≥4.5:1 for body, ≥3:1 for large text). |
| Motion | `prefers-reduced-motion` respected — edge detection overlay stops animating. |
| Screen readers | Debugger tabs use `role="tablist"` / `role="tab"` / `role="tabpanel"` pattern. |

---

## 9. Build, Tooling & Deployment Targets

### 9.1 Web Dashboard

```bash
# Development
cd frontend && npm run dev       # Vite dev server → localhost:5173

# Production build
npm run build                    # Output: dist/
npm run preview                  # Preview production bundle

# Environment files
.env.local         → VITE_API_BASE_URL=http://localhost:8000/api/v1
.env.production    → VITE_API_BASE_URL=https://api.scriptgrade.pk/api/v1
```

### 9.2 Mobile App

```bash
# Local development
cd mobile && npx expo start      # Metro bundler

# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android

# Production build (EAS)
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

### 9.3 Key `.env` Variables

**Web (`frontend/.env`):**
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_APP_NAME=ScriptGrade
VITE_DEMO_EMAIL=demo@scriptgrade.pk
VITE_DEMO_PASSWORD=HackathonDemo2026
```

**Mobile (`mobile/.env`):**
```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
EXPO_PUBLIC_OSS_BUCKET=scriptgrade-scans
EXPO_PUBLIC_APP_NAME=ScriptGrade
```

### 9.4 Service URLs

| Service | URL | Notes |
|---|---|---|
| Web Dashboard | `http://localhost:5173` | Vite dev server |
| Backend API | `http://localhost:8000/api/v1` | FastAPI |
| Swagger Docs | `http://localhost:8000/docs` | Interactive REST docs |
| Mobile (Expo) | Expo Go QR scan | Physical device |

---

<div align="center">

---

**ScriptGrade Frontend PRD · Rohail Khan Shinwari · Frontend Lead**

*Alibaba Cloud AI Hackathon Pakistan 2026*

*Grading that thinks like a teacher — at machine speed.*

---

</div>
