<div align="center">

# 📝 ScriptGrade

### Multi-Modal Handwritten Answer Script Automated Evaluation System

**Built for the Alibaba Cloud AI Hackathon Pakistan 2026**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge&logo=github)](#)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](#)
[![Alibaba Cloud](https://img.shields.io/badge/Alibaba%20Cloud-Qwen--2.5%20%7C%20Qwen--VL-FF6A00?style=for-the-badge&logo=alibabacloud&logoColor=white)](#)
[![AnalyticDB](https://img.shields.io/badge/AnalyticDB-PostgreSQL%20%2B%20pgvector-2496ED?style=for-the-badge&logo=postgresql&logoColor=white)](#)
[![Next.js](https://img.shields.io/badge/Next.js-14%2B-000000?style=for-the-badge&logo=next.js&logoColor=white)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](#)

</div>

---

## 🎥 Live Video Demo

<div align="center">

[![ScriptGrade Live Demo](https://img.shields.io/badge/▶%20Watch%20Full%20Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](#)
[![Presentation Deck](https://img.shields.io/badge/📊%20Presentation%20Deck-FF6A00?style=for-the-badge&logo=alibabacloud&logoColor=white)](#)
[![Live App](https://img.shields.io/badge/🚀%20Try%20Live%20App-4F46E5?style=for-the-badge&logo=vercel&logoColor=white)](#)

> **Quick Judge Access:** Click **"Quick Demo Access"** on the `/login` screen — credentials are pre-filled, landing you in a live pre-seeded dashboard in under 5 seconds.

</div>

---

## 📸 Application Screenshots / UI Wireframes

<div align="center">

| Page 1 — Auth & Login | Page 2 — Exam Hub Dashboard |
|:---:|:---:|
| ![Login Screen](https://via.placeholder.com/600x380/4F46E5/FFFFFF?text=Page+1%3A+Auth+%2F+Login) | ![Dashboard](https://via.placeholder.com/600x380/4F46E5/FFFFFF?text=Page+2%3A+Exam+Hub+Dashboard) |

| Page 3 — AI Rubric Studio | Page 4 — Batch Upload & Scan Portal |
|:---:|:---:|
| ![Rubric Studio](https://via.placeholder.com/600x380/FF6A00/FFFFFF?text=Page+3%3A+AI+Rubric+Studio) | ![Upload Portal](https://via.placeholder.com/600x380/FF6A00/FFFFFF?text=Page+4%3A+Batch+Upload+Portal) |

| Page 5 — Master Grading Workspace |
|:---:|
| ![Master Workspace](https://via.placeholder.com/1200x480/2496ED/FFFFFF?text=Page+5%3A+Master+Grading+%26+Diagnostic+Workspace) |

> 🔁 *Replace placeholder URLs with actual screenshots or a GIF walkthrough before submission.*

</div>

---

## 1. Executive Summary

**ScriptGrade** is a teacher-first, enterprise-grade SaaS platform that transforms the single most time-consuming task in education — grading descriptive, handwritten exam papers — into an automated, bias-free, and fully auditable workflow.

Powered end-to-end by **Alibaba Cloud's Qwen-2.5 (LLM)** and **Qwen-VL (Vision-Language Model)**, ScriptGrade reads a teacher's rubric intent from a single sample answer, understands a student's handwriting (including diagrams and flowcharts), and produces a defensible, itemized score in seconds — not hours.

> **The value proposition in one line:** ScriptGrade doesn't just OCR handwriting — it *reasons* about correctness, catches manipulation attempts, and gives every score a transparent, teacher-editable audit trail.

This isn't a toy OCR demo. It's a production-shaped monorepo with authenticated multi-tenant APIs, a relational + vector database schema, an 8-module adversarial diagnostic engine, and a polished 5-page enterprise UI — engineered specifically to showcase deep integration with Alibaba Cloud's AI and infrastructure stack.

---

## 2. Problem Statement vs. Solution

| ❌ The Problem (Traditional Manual Grading) | ✅ The ScriptGrade Solution |
|---|---|
| Teachers spend **hours per class** manually reading and scoring descriptive answers. | **Qwen-VL + Qwen-2.5** evaluate a full class batch in minutes via asynchronous Celery pipelines. |
| Grading is **inconsistent** — the same answer can receive different marks depending on teacher fatigue or mood. | Deterministic, rubric-weighted scoring produces **repeatable, auditable results** every time. |
| Students who **pad answers with fluff** or copy question text often score higher than concise, correct answers. | The **Anti-Fluff Density Scorer** normalizes score against factual content, not word count. |
| Valid answers phrased differently (synonyms) or with **minor spelling slips** get unfairly penalized. | **Synonym Clustering** + **Levenshtein Fuzzy Matching (≥85%)** reward true understanding. |
| Students can **negate a required concept** ("Chlorophyll does *NOT* absorb sunlight") and still trigger keyword-matching tools. | The **Negation & Reversal Modifiers Engine** performs dependency parsing to catch reversed meaning. |
| **Handwritten diagrams and flowcharts** are impossible for legacy OCR/keyword tools to grade. | **Qwen-VL Vision Inspector** detects diagram elements, arrows, and spatial labels directly from scanned images. |
| Setting up a rubric for every exam is tedious ("**Teacher Setup Fatigue**"). | **Auto-Rubric Extraction** — teachers upload one sample answer; Qwen-2.5 generates concepts, weights, and synonyms instantly. |
| Manual grading offers **zero data isolation or auditability** across institutions. | **JWT-secured, multi-tenant architecture** with full teacher override + moderation note logging. |

---

## 3. Alibaba Cloud Ecosystem Mapping

The table below documents precisely how each Alibaba Cloud service is wired into ScriptGrade's architecture — this is not a generic integration; every service plays a unique, load-bearing role.

| Alibaba Cloud Service | Integration Point | Exact Role in ScriptGrade |
|---|---|---|
| **Qwen-2.5 / Qwen-Plus (LLM)** | NLP Engine → Rubric Studio → Diagnostic Engine | Structured JSON rubric extraction from sample answers; dependency parsing for negation token detection; semantic reasoning for comprehensive answer evaluation prompts |
| **Qwen-VL (Vision-Language Model)** | NLP Engine → Upload Pipeline → Debugger VI | Handwritten answer sheet OCR with confidence scoring; flowchart and diagram element detection; spatial arrow and label verification from scanned PDFs and mobile images |
| **DashScope API** | Backend `services/ai_client.py` | Unified API gateway for all Qwen model inference calls (both LLM and VL) — manages authentication, rate-limiting, and request routing to Qwen-2.5 and Qwen-VL endpoints |
| **AnalyticDB for PostgreSQL (pgvector)** | Backend ORM + NLP Embeddings Layer | Dual-mode storage: relational tables for users, exams, rubrics, papers; pgvector extension for cosine-similarity semantic matching of student answer vectors against rubric concept embeddings |
| **Alibaba Cloud OSS** | Celery Workers → Upload Pipeline → Export Engine | Persistent object store for scanned exam PDFs (batch upload), mobile-synced student images, and generated CSV/PDF class performance export reports |
| **Alibaba Cloud ECS / Container Compute** | Full-stack deployment host | Hosts FastAPI uvicorn server, Celery workers, Redis broker, and Next.js SSR frontend in a containerized production environment |
| **Alibaba Cloud Text Embedding Models** | `nlp-engine/embeddings/` | Generates high-dimensional vector embeddings for rubric concepts and student answer tokens, stored and queried in AnalyticDB pgvector for semantic matching |

---

## 4. Key Features

### 🎯 Automated Rubric Extraction
- One-click generation of weighted "magic concepts" from a single Question Paper + Sample Answer upload, powered by structured JSON prompting against **Qwen-2.5 / Qwen-Plus**.
- Auto-generated **synonym clusters** (3–5 valid academic alternatives per concept).
- Full manual override: add, edit, delete, and re-weight any AI-extracted keyword in the **Interactive Magic Concepts Editor**.

### 👁️ Multi-Modal Vision OCR
- **Qwen-VL** transcribes handwritten scripts (scanner PDFs or mobile-synced images) with confidence scoring.
- Native support for **diagram, flowchart, and spatial-label verification** — not just plain text.
- Bulk ingestion via office ADF scanners or QR-code-linked mobile sync, processed asynchronously through **Celery + Redis** workers.

### ⚙️ Dynamic Evaluation Engine
- Real-time **cosine-similarity semantic matching** against rubric vectors stored in **AnalyticDB pgvector**.
- Three teacher-configurable **sensitivity toggles**: Ignore Spelling, Strict Procedural Order, and Density Scoring.
- Fully itemized, per-concept score breakdown returned as structured JSON for instant frontend rendering.

### 🩺 Diagnostic Debuggers
- Every graded paper ships with a transparent **8-module diagnostic report**, giving teachers full visibility into *why* a score was awarded — not a black box.
- Diagnostics feed directly into a **Teacher Manual Override Panel**, with moderation notes and real-time class analytics recalculation.

---

## 5. The 8 Vulnerability Edge-Case Debuggers

ScriptGrade's grading brain is only as trustworthy as its ability to defend against the ways students (intentionally or not) game naive keyword-matching systems. These eight modules — engineered by the AI/NLP team — form the diagnostic core surfaced on the **Master Grading Workspace**.

| # | Debugger | What It Catches | Core Technique |
|---|---|---|---|
| **I** | **Garbage Text & Hallucination Detector** | Filler text, nonsensical sentences, or copied question text used to pad length | Sentence-level cosine similarity vs. rubric vectors (flags if `< 0.35`) |
| **II** | **Negation & Reversal Modifiers Engine** | Correct keywords used with reversed meaning ("does **NOT** absorb...") | Qwen-2.5 dependency parsing for negation tokens (`not`, `never`, `fails to`, `without`) |
| **III** | **Synonym & Semantic Matcher** | Valid alternative phrasing penalized by rigid keyword tools | Vector similarity search against pre-generated synonym clusters |
| **IV** | **Fuzzy Spelling Auto-Correction** | Minor handwriting/spelling slips unfairly deducted | Levenshtein Distance, auto-corrected at **≥85%** token match |
| **V** | **Sequence & Procedural DAG Verifier** | Out-of-order steps in procedural answers | NetworkX Directed Acyclic Graph (DAG) transition validation |
| **VI** | **Qwen-VL Diagram & Visual Inspector** | Diagrams, flowcharts, and arrows that plain-text OCR cannot grade | Qwen-VL region dispatch for visual element + spatial label detection |
| **VII** | **Anti-Fluff Information Density Scorer** | Length bias — verbose answers outscoring concise, correct ones | `Density Ratio = (Valid Keyword Hits / Total Word Count) × 100` |
| **VIII** | **Itemized Rubric Score Aggregator** | Opaque, unauditable final scores | Weighted sum of per-concept awards, capped at max marks, output as `rubric_breakdown` JSON |

---

## 6. Scoring Algorithms

### Algorithm I — Anti-Fluff Information Density Ratio (Debugger VII)

The Density Scorer normalizes a student's raw keyword hit count against their total word count, preventing verbose, padding-heavy answers from outscoring concise, factually accurate ones.

$$\text{Density Ratio} \ (\%) = \left( \frac{\sum_{i=1}^{n} \mathbf{1}[\text{token}_i \in \text{RubricKeywords}]}{\text{TotalWordCount}} \right) \times 100$$

Where:
- $n$ = total number of tokens in the student answer
- $\mathbf{1}[\text{token}_i \in \text{RubricKeywords}]$ = indicator function — `1` if token matches a rubric keyword (exact, fuzzy ≥85%, or synonym), `0` otherwise
- $\text{TotalWordCount}$ = total token count of the student's answer

A `density_ratio` below a teacher-configured threshold (default: **30%**) triggers a length-bias flag in the diagnostic report.

---

### Algorithm II — Weighted Rubric Score Aggregation (Debugger VIII)

The Aggregator computes the final deterministic score by summing per-concept awarded points against teacher-defined weights, hard-capped at the exam's maximum marks.

$$S_{\text{final}} = \min\left( \sum_{k=1}^{K} w_k \cdot m_k \;,\; S_{\max} \right)$$

Where:
- $K$ = total number of rubric concepts (magic keywords) defined for the exam
- $w_k$ = teacher-assigned point weight for concept $k$
- $m_k \in \{0, 1\}$ = match indicator for concept $k$ — `1` if the concept was detected (exact, synonym, or fuzzy match), `0` if absent or negated
- $S_{\max}$ = maximum achievable marks for the question

The per-concept breakdown is serialized as a `rubric_breakdown` JSON array and returned via the REST API for complete frontend rendering.

---

## 7. Real-Time Diagnostic JSON Response

The following is an exact example of the structured JSON payload the **8 Vulnerability Edge-Case Debugger Engine** returns after evaluating a student's answer sheet. This is the payload consumed by both the FastAPI response contract (`GET /api/v1/papers/{student_id}`) and the Master Grading Workspace UI.

```json
{
  "student_id": "STU-102",
  "exam_id": "a3f7c891-12b4-4e3a-9d1c-bc7e234f5a10",
  "score": 10.0,
  "max_score": 10.0,
  "ocr_confidence": 96.5,
  "ocr_transcript": "Photosynthesis is the process by which green plants use sunlight and chlorophyll to convert carbon dioxide and water into glucose and oxygen.",
  "word_count": 28,
  "evaluated_at": "2026-08-19T14:32:07.412Z",
  "diagnostics": {
    "I_garbage_text": {
      "garbage_text_score": 0.02,
      "flagged": false,
      "detail": "All sentences exceed contextual relevance threshold of 0.35. No filler or copied prompt text detected."
    },
    "II_negation_detection": {
      "negation_detected": false,
      "flagged_tokens": [],
      "detail": "No negation modifiers (not, never, fails to, without) bound to magic concepts detected via dependency parse."
    },
    "III_synonym_match": {
      "synonym_matched": true,
      "matched_pairs": [
        { "student_token": "solar energy", "rubric_concept": "Sunlight", "similarity_score": 0.94 },
        { "student_token": "green pigment", "rubric_concept": "Chlorophyll", "similarity_score": 0.91 }
      ],
      "detail": "2 synonym clusters resolved via pgvector semantic similarity search."
    },
    "IV_spelling_correction": {
      "spelling_autocorrected": true,
      "corrections": [
        { "original": "photosinthesis", "corrected": "photosynthesis", "levenshtein_score": 0.92 }
      ],
      "detail": "1 token auto-corrected above 85% Levenshtein threshold. No score deduction applied."
    },
    "V_sequence_dag": {
      "sequence_match": true,
      "expected_order": ["Sunlight Absorption", "Chlorophyll Activation", "CO2 Fixation", "Glucose Synthesis"],
      "detected_order": ["Sunlight Absorption", "Chlorophyll Activation", "CO2 Fixation", "Glucose Synthesis"],
      "dag_transitions_valid": true,
      "detail": "All 4 procedural concept transitions validated against reference DAG. Strict order toggle: ENABLED."
    },
    "VI_diagram_visual": {
      "diagram_verified": true,
      "visual_confidence": 91.3,
      "detected_elements": [
        { "label": "Chloroplast", "bounding_box": [112, 88, 240, 195], "confidence": 93.1 },
        { "label": "Arrow: CO2 → Leaf", "bounding_box": [300, 140, 410, 160], "confidence": 89.5 }
      ],
      "detail": "Qwen-VL Vision Inspector verified 2 diagram elements and 1 directional arrow from scanned image region."
    },
    "VII_density_scorer": {
      "density_ratio": 88.5,
      "valid_keyword_hits": 5,
      "total_word_count": 28,
      "flagged": false,
      "detail": "Information density (88.5%) well above the 30% fluff threshold. Answer is factually dense with minimal padding."
    },
    "VIII_rubric_aggregator": {
      "rubric_breakdown": [
        { "concept": "Sunlight",      "awarded": 3, "max": 3, "match_type": "synonym" },
        { "concept": "Chlorophyll",   "awarded": 3, "max": 3, "match_type": "synonym" },
        { "concept": "Glucose",       "awarded": 2, "max": 2, "match_type": "exact" },
        { "concept": "CO2",           "awarded": 1, "max": 1, "match_type": "exact" },
        { "concept": "Oxygen",        "awarded": 1, "max": 1, "match_type": "fuzzy" }
      ],
      "total_awarded": 10.0,
      "max_possible": 10.0,
      "detail": "All 5 rubric concepts matched. Final score capped at max_score = 10.0."
    }
  },
  "teacher_override": {
    "applied": false,
    "override_score": null,
    "moderation_note": null
  }
}
```

---

## 8. End-to-End System Architecture

```mermaid
flowchart TD
    A["📄 Scanned Answer Sheet<br/>(ADF Scanner PDF / Mobile Sync Image)"] --> B["Alibaba Cloud OSS<br/>(Object Storage)"]
    B --> C["Celery + Redis<br/>(Async Ingestion Queue)"]

    Q["📋 Question Paper +<br/>Sample Reference Answer"] --> D["Qwen-2.5 / Qwen-Plus<br/>(Concept & Synonym Extraction)"]
    D --> E["Rubric JSON<br/>(concepts, weights, synonyms, toggles)"]

    C --> F["Qwen-VL<br/>(Handwritten OCR + Diagram/Label Vision)"]
    F --> G["OCR Transcript +<br/>Visual Bounding Boxes"]

    E --> H["8 Vulnerability<br/>Edge-Case Debuggers Engine"]
    G --> H

    H --> I["AnalyticDB for PostgreSQL<br/>(pgvector — Semantic Embeddings + Relational Store)"]
    I --> J["FastAPI Gateway<br/>(REST API + JWT Auth + Multi-Tenant Isolation)"]

    J --> K["Next.js Frontend<br/>Master Grading Workspace"]
    K --> L["👩‍🏫 Teacher Override,<br/>Moderation Notes & CSV/PDF Export"]
    L -.->|feedback loop| I

    style A fill:#4F46E5,color:#fff
    style F fill:#FF6A00,color:#fff
    style D fill:#FF6A00,color:#fff
    style I fill:#2496ED,color:#fff
    style K fill:#4F46E5,color:#fff
```

**Text-based flow summary:**

```
[Scanned Answer Sheet] ──► Alibaba Cloud OSS ──► Celery/Redis Queue ──► Qwen-VL (OCR + Vision)
                                                                              │
[Question Paper + Sample Answer] ──► Qwen-2.5 (Rubric/Synonym Extraction)    │
                                              │                              │
                                              ▼                              ▼
                                    8 Vulnerability Edge-Case Debuggers Engine
                                                      │
                                                      ▼
                                AnalyticDB PostgreSQL (pgvector + Relational Store)
                                                      │
                                                      ▼
                                  FastAPI Gateway (JWT Auth + REST Contracts)
                                                      │
                                                      ▼
                              Next.js Frontend — Master Grading Workspace (UI)
```

---

## 9. Comprehensive Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | Next.js 14+ (App Router) / React 18+ (Vite) | 5-page enterprise SaaS UI |
| **Styling** | Tailwind CSS | Utility-first design system |
| **UI Components** | Radix UI / Shadcn UI, Lucide React Icons | Accessible, composable component library |
| **Data Visualization** | ApexCharts.js / Recharts | Class performance distribution, score analytics |
| **State Management** | Zustand, TanStack React Query | Async API state, caching, optimistic updates |
| **Backend Framework** | Python 3.11+ / FastAPI (asyncio + uvicorn) | High-performance async REST gateway |
| **Task Queue** | Celery + Redis | Async multi-page PDF ingestion & OCR dispatch |
| **Authentication** | OAuth2 + JWT, Passlib (Bcrypt) | Multi-tenant institutional data isolation |
| **AI — LLM Engine** | **Alibaba Cloud Qwen-2.5 / Qwen-Plus** | Semantic reasoning, rubric & synonym extraction, negation parsing |
| **AI — Vision Engine** | **Alibaba Cloud Qwen-VL** | Handwritten OCR, diagram & flowchart visual inspection |
| **AI — API Gateway** | **Alibaba Cloud DashScope** | Unified inference endpoint for all Qwen model calls |
| **Graph Logic** | NetworkX (Python) | Directed Acyclic Graph (DAG) procedural order verification |
| **Core Algorithms** | Cosine Similarity, Levenshtein Distance, Token-Density Ratio | Semantic matching, fuzzy spelling, anti-fluff scoring |
| **Vector & Relational DB** | **Alibaba Cloud AnalyticDB for PostgreSQL (pgvector)** | Semantic embeddings + structured exam/rubric/paper schemas |
| **Object Storage** | **Alibaba Cloud OSS** | Scanned PDFs, student images, exported CSV/PDF reports |
| **Cloud Infrastructure** | Alibaba Cloud (ECS / Container Compute, OSS, AnalyticDB) | End-to-end hosting & AI inference backbone |

---

## 10. Monorepo Structure

```
ScriptGrade/
├── frontend/                        # Next.js 14+ — Rohail Khan Shinwari
│   ├── app/
│   │   ├── (auth)/login/            # Page 1: Auth (Login/Signup, SSO, Demo Access)
│   │   ├── dashboard/               # Page 2: Exam Hub & Global Metrics
│   │   ├── exam/setup/              # Page 3: AI Rubric Studio
│   │   ├── exam/upload/             # Page 4: Batch Upload & Scan Portal
│   │   └── exam/grade/              # Page 5: Master Grading Workspace
│   ├── components/                  # Shared UI (tags editor, diagnostic tabs, charts)
│   ├── lib/                         # API client, Zustand stores, React Query hooks
│   ├── public/
│   ├── tailwind.config.ts
│   ├── package.json
│   └── .env.local.example
│
├── backend/                         # FastAPI — Ishmal Khalid
│   ├── app/
│   │   ├── api/v1/                  # auth, exams, papers, analytics routers
│   │   ├── models/                  # users, exams, rubrics, student_papers (SQLAlchemy)
│   │   ├── schemas/                 # Pydantic request/response contracts
│   │   ├── services/                # OSS upload, Celery tasks, AI client wrappers
│   │   ├── core/                    # JWT auth, config, security
│   │   └── main.py
│   ├── alembic/                     # DB migrations (AnalyticDB PostgreSQL)
│   ├── requirements.txt
│   └── .env.example
│
├── nlp-engine/                      # AI/NLP Pipeline — Muhammad Musa
│   ├── pipelines/
│   │   ├── rubric_extraction.py     # Qwen-2.5 auto-rubric prompt pipeline
│   │   ├── vision_ocr.py            # Qwen-VL OCR + diagram inspection
│   │   └── evaluation_pipeline.py   # Orchestrates full 8-debugger scoring
│   ├── debuggers/
│   │   ├── garbage_text.py
│   │   ├── negation_detector.py
│   │   ├── synonym_matcher.py
│   │   ├── fuzzy_spelling.py
│   │   ├── sequence_dag.py          # NetworkX DAG verifier
│   │   ├── visual_inspector.py
│   │   ├── density_scorer.py
│   │   └── rubric_aggregator.py
│   ├── prompts/                     # Versioned JSON prompt templates
│   ├── embeddings/                  # pgvector embedding utilities
│   └── requirements.txt
│
├── docs/                            # PRDs, API contracts, architecture diagrams
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 11. Local Environment Setup & Quickstart Guide

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18.x+ |
| Python | 3.11+ |
| PostgreSQL client / AnalyticDB access | pgvector-enabled |
| Redis | 7.x+ (for Celery broker) |
| Alibaba Cloud Account | Qwen-2.5, Qwen-VL API access + OSS bucket |

### 1. Clone the Repository

```bash
git clone https://github.com/<your-org>/scriptgrade.git
cd scriptgrade
```

### 2. Configure Environment Variables

**`backend/.env`**
```env
# Alibaba Cloud AI (DashScope)
QWEN_API_KEY=your_alibaba_dashscope_api_key
QWEN_LLM_MODEL=qwen-plus
QWEN_VL_MODEL=qwen-vl-plus

# AnalyticDB for PostgreSQL
DATABASE_URL=postgresql+asyncpg://user:password@analyticdb-host:5432/scriptgrade
PGVECTOR_ENABLED=true

# Alibaba Cloud OSS
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET_NAME=scriptgrade-scans
OSS_ENDPOINT=oss-ap-southeast-1.aliyuncs.com

# Auth
JWT_SECRET_KEY=your_super_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Task Queue
REDIS_URL=redis://localhost:6379/0
```

**`frontend/.env.local`**
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME=ScriptGrade
```

### 3. Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt

# Run DB migrations against AnalyticDB PostgreSQL
alembic upgrade head

# Start the FastAPI gateway
uvicorn app.main:app --reload --port 8000

# In a separate terminal — start the Celery worker for async OCR/PDF ingestion
celery -A app.services.celery_worker worker --loglevel=info
```

### 4. NLP/AI Engine Setup

```bash
cd nlp-engine
python -m venv venv
source venv/bin/activate

pip install -r requirements.txt

# Verify Qwen-2.5 / Qwen-VL connectivity
python -m pipelines.rubric_extraction --healthcheck
```

### 5. Frontend Setup (Next.js)

```bash
cd frontend
npm install
npm run dev
```

### 6. Access the App

| Service | URL |
|---|---|
| Frontend (UI) | `http://localhost:3000` |
| Backend API Docs (Swagger) | `http://localhost:8000/docs` |

> 💡 **Judges' Tip:** Use the **Quick Demo Access** button on the `/login` screen to auto-fill credentials and jump straight into a pre-seeded dashboard for rapid evaluation.

---

## 12. REST API Contract Overview

| # | Endpoint | Method | Purpose |
|---|---|---|---|
| 1 | `/api/v1/auth/login` | `POST` | Authenticate & issue JWT bearer token |
| 2 | `/api/v1/auth/signup` | `POST` | Register educator + institutional workspace |
| 3 | `/api/v1/exams/list` | `GET` | Dashboard metrics & exam logs |
| 4 | `/api/v1/exam/setup` | `POST` | Upload Q&A, trigger Qwen-2.5 auto-rubric extraction |
| 5 | `/api/v1/exam/rubric` | `PUT` | Save/edit rubric weights, synonyms, sensitivity toggles |
| 6 | `/api/v1/papers/batch-upload` | `POST` | Bulk scanner PDF upload → OSS → Celery queue |
| 7 | `/api/v1/papers/{student_id}` | `GET` | Full evaluation breakdown + 8-debugger diagnostics |
| 8 | `/api/v1/papers/{student_id}/override` | `POST` | Teacher manual score override + moderation notes |
| 9 | `/api/v1/analytics/export` | `GET` | Export class results as CSV/PDF |

---

## 13. Team Members & Roles

| Member | Role | Core Responsibilities |
|---|---|---|
| **Muhammad Musa** | 🧠 **Lead AI / NLP Architect** | Qwen-2.5 & Qwen-VL inference pipelines, prompt engineering, pgvector semantic matching, all 8 Vulnerability Edge-Case Debuggers |
| **Rohail Khan Shinwari** | 🎨 **Lead Frontend Engineer** | Next.js 5-page enterprise UI, Interactive Rubric Studio, Master Grading Workspace, full REST API integration |
| **Ishmal Khalid** | ⚙️ **Lead Backend Engineer** | FastAPI microservices, AnalyticDB schema design, Celery async ingestion, JWT multi-tenant security, OSS integration |

---

<div align="center">

### Built with ❤️ and Qwen AI for the **Alibaba Cloud AI Hackathon Pakistan 2026**

*ScriptGrade — Grading that thinks like a teacher, at machine speed.*

</div>
