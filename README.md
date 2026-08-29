<div align="center">

<br/>

```
███████╗ ██████╗██████╗ ██╗██████╗ ████████╗ ██████╗ ██████╗  █████╗ ██████╗ ███████╗
██╔════╝██╔════╝██╔══██╗██║██╔══██╗╚══██╔══╝██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██╔════╝
███████╗██║     ██████╔╝██║██████╔╝   ██║   ██║  ███╗██████╔╝███████║██║  ██║█████╗  
╚════██║██║     ██╔══██╗██║██╔═══╝    ██║   ██║   ██║██╔══██╗██╔══██║██║  ██║██╔══╝  
███████║╚██████╗██║  ██║██║██║        ██║   ╚██████╔╝██║  ██║██║  ██║██████╔╝███████╗
╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝        ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝
```

### *Enterprise Automated Script Grading & Diagnostic Platform*
#### Grading that thinks like a teacher — at machine speed.

<br/>

[![Alibaba Cloud](https://img.shields.io/badge/Alibaba%20Cloud-DashScope%20%7C%20Qwen3.8--Max-FF6A00?style=for-the-badge&logo=alibabacloud&logoColor=white)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-Async%20Python%203.11+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-2496ED?style=for-the-badge&logo=postgresql&logoColor=white)](#)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-61DAFB?style=for-the-badge&logo=react&logoColor=black)](#)
[![React](https://img.shields.io/badge/React-Tailwind%20CSS-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](#)
[![OSS](https://img.shields.io/badge/Alibaba%20OSS-Object%20Storage-FF6A00?style=for-the-badge&logo=alibabacloud&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](#)
[![Hackathon](https://img.shields.io/badge/Alibaba%20Cloud%20AI%20Hackathon-Pakistan%202026-FF6A00?style=for-the-badge&logo=alibabacloud&logoColor=white)](#)

<br/>

[![▶ Watch Full Demo](https://img.shields.io/badge/▶%20Watch%20Full%20Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](#)
[![📊 Presentation Deck](https://img.shields.io/badge/📊%20Presentation%20Deck-FF6A00?style=for-the-badge&logo=alibabacloud&logoColor=white)](#)
[![🚀 Try Live App](https://img.shields.io/badge/🚀%20Try%20Live%20App-4F46E5?style=for-the-badge&logo=vercel&logoColor=white)](#)

> 💡 **Quick Judge Access:** Hit **"Quick Demo Access"** on the `/login` screen — credentials are pre-filled, landing you in a live pre-seeded dashboard in under 5 seconds. No signup required.

</div>

---

## 📸 UI Showcase

<div align="center">

| Page 1 — Auth & Login | Page 2 — Exam Hub Dashboard |
|:---:|:---:|
| ![Login](https://via.placeholder.com/600x380/4F46E5/FFFFFF?text=Page+1%3A+Auth+%2F+Login) | ![Dashboard](https://via.placeholder.com/600x380/4F46E5/FFFFFF?text=Page+2%3A+Exam+Hub+Dashboard) |

| Page 3 — AI Rubric Studio | Page 4 — Dual Ingestion Portal |
|:---:|:---:|
| ![Rubric](https://via.placeholder.com/600x380/FF6A00/FFFFFF?text=Page+3%3A+AI+Rubric+Studio) | ![Upload](https://via.placeholder.com/600x380/FF6A00/FFFFFF?text=Page+4%3A+Dual+Ingestion+Portal) |

| Page 5 — Master Grading & 8-Debugger Diagnostic Workspace |
|:---:|
| ![Workspace](https://via.placeholder.com/1200x480/2496ED/FFFFFF?text=Page+5%3A+Master+Grading+%26+8-Debugger+Diagnostic+Workspace) |

> 🔁 *Replace placeholders with real screenshots or a GIF walkthrough before submission.*

</div>

---

## 1. Executive Summary

**ScriptGrade** is a teacher-first, enterprise-grade SaaS platform that eliminates the single most time-consuming task in education — grading handwritten descriptive exam papers — and replaces it with a fully automated, bias-free, and auditable AI workflow.

Powered end-to-end by **Alibaba Cloud DashScope (Qwen3.8-Max)**, ScriptGrade reads a teacher's rubric intent from a single sample answer, comprehends student handwriting across **English and three Asian regional scripts** (Urdu, Sindhi, Punjabi/Nastaliq), and produces a defensible, itemized score with a full diagnostic breakdown in seconds — not hours.

> **The value proposition in one sentence:** ScriptGrade doesn't just OCR handwriting — it *reasons* about correctness, catches manipulation and negation attempts, supports right-to-left regional languages natively, and delivers every score with a transparent, teacher-editable audit trail.

This is not a toy OCR demo. It is a production-shaped monorepo featuring a **Dual-Ingestion Pipeline** (Mobile Camera Scanner App + Desktop Web Dashboard), authenticated multi-tenant APIs, a relational + vector database schema, an **8-Debugger NLP Diagnostic Engine**, and a polished enterprise UI — engineered to showcase deep, load-bearing integration with Alibaba Cloud's AI and infrastructure stack.

---

## 2. The Problem vs. The ScriptGrade Solution

| ❌ The Problem (Manual Grading Reality) | ✅ The ScriptGrade Solution |
|---|---|
| Teachers spend **3–6 hours per class** manually scoring descriptive answers | **Qwen3.8-Max** evaluates a full class batch in minutes via async pipelines |
| Grading is **inconsistent** — fatigue, mood, and bias shift marks across the same paper | Deterministic, rubric-weighted scoring produces **repeatable, auditable results** every single time |
| **Urdu, Sindhi, Punjabi/Nastaliq** handwritten scripts are completely unsupported by legacy tools | Qwen3.8-Max's multilingual VLM natively handles **RTL regional language OCR and semantic evaluation** |
| Students who **pad answers with fluff** often outrank concise, accurate ones | The **Anti-Fluff Density Scorer** normalizes score against factual content ratio, not word count |
| Valid phrasing (synonyms) or minor **handwriting slips** are unfairly penalized | **Synonym Clustering + Levenshtein Fuzzy Matching (≥85%)** reward true conceptual understanding |
| Students can **negate a required concept** ("does NOT absorb sunlight") and still trigger naive keyword tools | The **Negation & Reversal Engine** performs dependency parsing to catch reversed meaning at the token level |
| **Handwritten diagrams and flowcharts** are impossible for legacy OCR tools to grade | **Qwen3.8-Max Vision** detects diagram elements, arrows, and spatial labels directly from scanned images |
| Grading workflows are **siloed** — mobile scans and desktop uploads follow completely separate, fragile paths | The **Dual-Ingestion Pipeline** unifies mobile camera scans and web batch uploads into a single OSS-backed queue |
| Manual grading offers **zero auditability** — scores cannot be defended with evidence | **JWT-secured multi-tenant architecture** with itemized per-concept breakdowns and moderation note logging |

---

## 3. Alibaba Cloud Ecosystem — Deep Integration Map

Every Alibaba Cloud service below plays a **unique, load-bearing role** in ScriptGrade's architecture. This is not a surface-level API call — it is a full-stack cloud-native integration.

| Alibaba Cloud Service | Integration Point | Exact Role in ScriptGrade |
|---|---|---|
| **Qwen3.8-Max (LLM + VLM)** | NLP Engine · Rubric Studio · 8-Debugger Core | Structured JSON rubric extraction from sample answers; handwritten OCR across English, Urdu, Sindhi, Punjabi/Nastaliq; dependency parsing for negation detection; diagram and flowchart visual element verification |
| **DashScope API** | `backend/services/ai_client.py` | Unified inference gateway for all Qwen3.8-Max calls — manages authentication, rate-limiting, streaming, and routing to both LLM and VLM endpoints from a single client |
| **OSS (Object Storage Service)** | Dual-Ingestion Pipeline · Export Engine | Persistent store for mobile camera scans, scanner PDFs, and generated CSV/PDF class performance reports; acts as the shared buffer between both ingestion channels and the async worker queue |
| **PostgreSQL + pgvector** | Backend ORM · NLP Embeddings Layer | Dual-mode storage: relational tables for users, exams, rubrics, student papers; pgvector extension for cosine-similarity semantic matching of student answer embeddings against rubric concept vectors |
| **ECS / Container Compute** | Full-Stack Deployment | Hosts FastAPI uvicorn server, Celery async workers, Redis broker, and React web dashboard in a containerized production environment |
| **Text Embedding Models (DashScope)** | `nlp-engine/embeddings/` | Generates high-dimensional vectors for rubric concepts and student tokens — stored and queried in pgvector for semantic similarity matching |

---

## 4. System Architecture

### 4.1 End-to-End Architecture Diagram

```mermaid
flowchart TD
    subgraph INGESTION ["⬛ Dual-Ingestion Pipeline"]
        A1["📱 Mobile Camera Scanner App\n(React Native · Expo)\nEdge Detection · Auto-Crop · RTL Support"]
        A2["🖥️ Web Office Dashboard\n(React · Tailwind CSS)\nBatch PDF Upload · ADF Scanner Sync"]
    end

    subgraph STORAGE ["☁️ Alibaba Cloud OSS"]
        B["OSS Bucket\n(scriptgrade-scans)\nMobile Images · Scanner PDFs · Export Reports"]
    end

    subgraph QUEUE ["⚙️ Async Worker Queue"]
        C["Celery + Redis\n(Async Ingestion & OCR Dispatch)"]
    end

    subgraph AI ["🤖 Alibaba Cloud DashScope — Qwen3.8-Max"]
        D1["LLM Engine\nRubric Extraction · Negation Parsing\nSynonym Clustering · Structured JSON Output"]
        D2["Vision-Language Engine\nHandwritten OCR (EN · اردو · سنڌي · ਪੰਜਾਬੀ)\nDiagram & Flowchart Visual Inspection"]
    end

    subgraph NLP ["🩺 8-Debugger NLP Diagnostic Engine"]
        E["I Garbage Text Detector\nII Negation & Reversal Engine\nIII Synonym & Semantic Matcher\nIV Fuzzy Spelling Corrector\nV Sequence DAG Verifier\nVI Visual Inspector (Qwen-VL)\nVII Anti-Fluff Density Scorer\nVIII Rubric Score Aggregator"]
    end

    subgraph DB ["🗄️ PostgreSQL + pgvector"]
        F["Relational: Users · Exams · Rubrics · Papers\nVector: Semantic Embeddings (cosine similarity)"]
    end

    subgraph API ["🔐 FastAPI Gateway"]
        G["Async Python · JWT Auth\nMulti-Tenant Isolation · REST Contracts"]
    end

    subgraph UI ["🎨 Web Office Dashboard"]
        H["React + Tailwind CSS\nMaster Grading Workspace\n8-Debugger Visual Metrics · Override Panel"]
    end

    A1 -->|"Camera capture + edge-crop"| B
    A2 -->|"Batch PDF / ADF upload"| B
    B --> C
    C --> D2
    D2 -->|"OCR Transcript + Bounding Boxes"| E
    D1 -->|"Rubric JSON + Synonym Clusters"| E
    E --> F
    F --> G
    G --> H
    H -->|"Teacher override + moderation notes"| F

    style A1 fill:#4F46E5,color:#fff
    style A2 fill:#4F46E5,color:#fff
    style B fill:#FF6A00,color:#fff
    style D1 fill:#FF6A00,color:#fff
    style D2 fill:#FF6A00,color:#fff
    style E fill:#7C3AED,color:#fff
    style F fill:#2496ED,color:#fff
    style G fill:#059669,color:#fff
    style H fill:#4F46E5,color:#fff
```

### 4.2 ASCII Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DUAL-INGESTION PIPELINE                          │
│  📱 Mobile Scanner App (RN Expo)   🖥️ Web Dashboard (React/Tailwind) │
│      Edge Detection · Auto-Crop         Batch PDF · ADF Scanner     │
└──────────────────────┬──────────────────────────┬───────────────────┘
                       │                          │
                       ▼                          ▼
            ┌──────────────────────────────────────────┐
            │       Alibaba Cloud OSS (scriptgrade-scans) │
            │   Mobile Images · Scanner PDFs · Reports    │
            └─────────────────────┬────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   Celery + Redis Queue   │
                    │   (Async OCR Dispatch)   │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                      ▼
  ┌───────────────────────┐          ┌───────────────────────────────┐
  │  DashScope · Qwen3.8  │          │  DashScope · Qwen3.8-Max VLM  │
  │  (LLM — Text Engine)  │          │  (Vision — OCR + Diagrams)    │
  │  Rubric Extraction    │          │  EN · اردو · سنڌي · ਪੰਜਾਬੀ   │
  └────────────┬──────────┘          └──────────────┬────────────────┘
               │                                    │
               └──────────────┬─────────────────────┘
                              ▼
            ┌─────────────────────────────────────────┐
            │      8-Debugger NLP Diagnostic Engine    │
            │  Garbage · Negation · Synonym · Fuzzy    │
            │  DAG Seq · Visual · Density · Aggregator │
            └─────────────────────┬───────────────────┘
                                  │
                                  ▼
            ┌─────────────────────────────────────────┐
            │    PostgreSQL + pgvector (AnalyticDB)    │
            │   Relational Schema + Vector Embeddings  │
            └─────────────────────┬───────────────────┘
                                  │
                                  ▼
            ┌─────────────────────────────────────────┐
            │  FastAPI Gateway (Async · JWT · REST)    │
            └─────────────────────┬───────────────────┘
                                  │
                                  ▼
            ┌─────────────────────────────────────────┐
            │  React Web Dashboard (Tailwind CSS)      │
            │  Master Grading · Diagnostics · Override │
            └─────────────────────────────────────────┘
```

---

## 5. Core Feature Breakdown

### 🌐 Regional Language Support — English & Asian Scripts

ScriptGrade is built specifically for South Asian educational contexts where English alone is insufficient.

| Language | Script | Direction | Qwen3.8-Max Capability |
|---|---|---|---|
| **English** | Latin | LTR | Full OCR, semantic matching, diagram grading |
| **Urdu** | Nastaliq / Naskh | RTL | Native OCR, tokenization, rubric matching |
| **Sindhi** | Arabic-derived | RTL | OCR + semantic evaluation |
| **Punjabi** | Nastaliq / Gurmukhi | RTL / LTR | OCR + keyword concept extraction |

> Qwen3.8-Max's multilingual vision-language architecture handles right-to-left script directionality, diacritics (harakat), and mixed-language answer sheets natively — without preprocessing hacks.

---

### 🩺 The 8-Debugger NLP Diagnostic Engine

Every graded paper ships with a transparent, itemized diagnostic report. Zero black boxes.

| # | Debugger Module | What It Catches | Core Technique |
|---|---|---|---|
| **I** | **Garbage Text & Hallucination Detector** | Filler text, nonsensical sentences, copied question text used to pad length | Sentence-level cosine similarity vs. rubric vectors — flags if `score < 0.35` |
| **II** | **Negation & Reversal Modifiers Engine** | Correct keywords used with reversed meaning ("does **NOT** absorb...") | Qwen3.8-Max dependency parsing for negation tokens (`not`, `never`, `fails to`, `without`) bound to rubric concepts |
| **III** | **Synonym & Semantic Matcher** | Valid alternative phrasing unfairly penalized by rigid keyword tools | pgvector cosine-similarity search against pre-generated synonym clusters |
| **IV** | **Fuzzy Spelling Auto-Corrector** | Minor handwriting and spelling slips causing unfair deductions | Levenshtein Distance — auto-corrected at **≥85%** token match threshold |
| **V** | **Sequence & Procedural DAG Verifier** | Out-of-order steps in procedural or scientific answers | NetworkX Directed Acyclic Graph (DAG) transition validation against reference order |
| **VI** | **Qwen-VL Diagram & Visual Inspector** | Diagrams, flowcharts, labeled arrows that plain-text OCR cannot evaluate | Qwen3.8-Max VLM region dispatch for visual element + spatial label detection with bounding boxes |
| **VII** | **Anti-Fluff Information Density Scorer** | Length bias — verbose answers outscoring concise, correct ones | `Density Ratio = (Valid Keyword Hits / Total Word Count) × 100` — flags below 30% threshold |
| **VIII** | **Itemized Rubric Score Aggregator** | Opaque, unauditable final scores with no per-concept breakdown | Weighted sum of per-concept awards, capped at max marks, serialized as `rubric_breakdown` JSON |

---

### 📥 Dual-Ingestion Pipeline

ScriptGrade unifies two physically separate grading realities into a single processing pipeline.

#### Channel A — Mobile Camera Scanner App (React Native · Expo)

Designed for field educators, invigilators, and schools without ADF scanners.

- 📷 **Real-time edge detection** with automatic document boundary recognition
- ✂️ **Auto-crop and perspective correction** — no flat surface or studio setup required
- 🌐 **RTL script preview** — Urdu/Sindhi/Punjabi handwriting renders correctly in-app before upload
- ☁️ **Direct OSS upload** — each scan is tagged `source: mobile` with student ID metadata
- 📶 **Offline queue** — scans captured without connectivity are synced automatically on reconnect

#### Channel B — Web Office Dashboard (React · Tailwind CSS)

Designed for institutional administrators, exam offices, and bulk processing workflows.

- 📄 **Batch PDF upload** — multi-page scanner output ingested in a single drag-and-drop action
- 🖨️ **ADF scanner integration** — direct sync from institutional document scanners via the portal
- 🏷️ **Source tagging** — all uploads tagged `source: web_dashboard` for audit trail differentiation
- 📊 **Live ingestion status** — real-time Celery job progress shown on the dashboard
- 📤 **Export engine** — class-level CSV and PDF performance reports generated to OSS on demand

---

### 🤖 Automated Rubric Extraction

- One-click generation of weighted **magic concept keywords** from a single Question Paper + Sample Answer upload, powered by structured JSON prompting against **Qwen3.8-Max**
- Auto-generated **synonym clusters** (3–5 valid academic alternatives per concept) stored as pgvector embeddings for semantic matching
- Full teacher override: add, edit, delete, and re-weight any AI-extracted concept in the **Interactive Magic Concepts Editor**

---

## 6. Scoring Algorithms

### Algorithm I — Anti-Fluff Information Density Ratio (Debugger VII)

$$\text{Density Ratio} \ (\%) = \left( \frac{\sum_{i=1}^{n} \mathbf{1}[\text{token}_i \in \text{RubricKeywords}]}{\text{TotalWordCount}} \right) \times 100$$

Where:
- $n$ = total token count in the student's answer
- $\mathbf{1}[\text{token}_i \in \text{RubricKeywords}]$ = `1` if token matches a rubric keyword (exact, fuzzy ≥85%, or synonym cluster), `0` otherwise
- A `density_ratio` below the teacher-configured threshold (default **30%**) triggers a length-bias flag in the diagnostic report

### Algorithm II — Weighted Rubric Score Aggregation (Debugger VIII)

$$S_{\text{final}} = \min\left( \sum_{k=1}^{K} w_k \cdot m_k \;,\; S_{\max} \right)$$

Where:
- $K$ = total number of rubric concepts (magic keywords) for the exam
- $w_k$ = teacher-assigned point weight for concept $k$
- $m_k \in \{0, 1\}$ = match indicator — `1` if detected (exact, synonym, or fuzzy); `0` if absent or negated
- $S_{\max}$ = maximum achievable marks for the question
- The per-concept breakdown is serialized as a `rubric_breakdown` JSON array returned via REST API

---

## 7. Live Diagnostic JSON — Full Response Contract

The following is the exact structured payload produced by the **8-Debugger Engine** for every graded paper — consumed by both the API response contract (`GET /api/v1/papers/{student_id}`) and the Master Grading Workspace UI.

```json
{
  "student_id": "STU-102",
  "exam_id": "a3f7c891-12b4-4e3a-9d1c-bc7e234f5a10",
  "ingestion_source": "mobile",
  "language_detected": "en",
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
      "detail": "All sentences exceed contextual relevance threshold 0.35. No filler or copied prompt text detected."
    },
    "II_negation_detection": {
      "negation_detected": false,
      "flagged_tokens": [],
      "detail": "No negation modifiers (not, never, fails to, without) bound to rubric concepts via dependency parse."
    },
    "III_synonym_match": {
      "synonym_matched": true,
      "matched_pairs": [
        { "student_token": "solar energy", "rubric_concept": "Sunlight", "similarity_score": 0.94 },
        { "student_token": "green pigment", "rubric_concept": "Chlorophyll", "similarity_score": 0.91 }
      ],
      "detail": "2 synonym clusters resolved via pgvector cosine-similarity semantic search."
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
      "detail": "Qwen3.8-Max VLM verified 2 diagram elements and 1 directional arrow from scanned image region."
    },
    "VII_density_scorer": {
      "density_ratio": 88.5,
      "valid_keyword_hits": 5,
      "total_word_count": 28,
      "flagged": false,
      "detail": "Information density 88.5% — well above the 30% fluff threshold. Answer is factually dense."
    },
    "VIII_rubric_aggregator": {
      "rubric_breakdown": [
        { "concept": "Sunlight",    "awarded": 3, "max": 3, "match_type": "synonym" },
        { "concept": "Chlorophyll", "awarded": 3, "max": 3, "match_type": "synonym" },
        { "concept": "Glucose",     "awarded": 2, "max": 2, "match_type": "exact"   },
        { "concept": "CO2",         "awarded": 1, "max": 1, "match_type": "exact"   },
        { "concept": "Oxygen",      "awarded": 1, "max": 1, "match_type": "fuzzy"   }
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

## 8. REST API Contract

### Primary Upload Endpoint — Dual-Source Ingestion

**`POST /api/v1/papers/upload`**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | `multipart/form-data` | ✅ | Scanned image (mobile) or PDF file (web) |
| `exam_id` | `UUID` | ✅ | Target exam identifier |
| `student_id` | `string` | ✅ | Student roll number or unique ID |
| `source` | `enum` | ✅ | `mobile` \| `web_dashboard` — ingestion channel tag |
| `language` | `enum` | ✅ | `en` \| `ur` \| `sd` \| `pa` — script language hint |
| `Authorization` | `Bearer <JWT>` | ✅ | Institutional teacher token |

**Response `202 Accepted`:**
```json
{
  "job_id": "celery-job-uuid-xxxx",
  "status": "queued",
  "source": "mobile",
  "oss_key": "exams/a3f7c891/STU-102/scan_1724076727.jpg",
  "estimated_completion_seconds": 12
}
```

### Full API Surface

| # | Endpoint | Method | Auth | Purpose |
|---|---|---|---|---|
| 1 | `/api/v1/auth/login` | `POST` | Public | Authenticate & issue JWT bearer token |
| 2 | `/api/v1/auth/signup` | `POST` | Public | Register educator + institutional workspace |
| 3 | `/api/v1/exams/list` | `GET` | 🔐 JWT | Dashboard metrics & exam logs |
| 4 | `/api/v1/exam/setup` | `POST` | 🔐 JWT | Upload Q&A, trigger Qwen3.8-Max rubric extraction |
| 5 | `/api/v1/exam/rubric` | `PUT` | 🔐 JWT | Save/edit rubric weights, synonyms, sensitivity toggles |
| 6 | `/api/v1/papers/upload` | `POST` | 🔐 JWT | **Dual-ingestion upload** (mobile or web) → OSS → Celery |
| 7 | `/api/v1/papers/batch-upload` | `POST` | 🔐 JWT | Bulk scanner PDF upload → OSS → Celery queue |
| 8 | `/api/v1/papers/{student_id}` | `GET` | 🔐 JWT | Full evaluation + 8-debugger diagnostic JSON |
| 9 | `/api/v1/papers/{student_id}/override` | `POST` | 🔐 JWT | Teacher manual score override + moderation notes |
| 10 | `/api/v1/analytics/export` | `GET` | 🔐 JWT | Export class results as CSV/PDF to OSS |

---

## 9. Comprehensive Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **AI — LLM + Vision** | **Alibaba Cloud DashScope · Qwen3.8-Max** | Rubric extraction, multilingual OCR, negation parsing, diagram inspection |
| **AI Gateway** | **DashScope API** | Unified inference endpoint for all Qwen3.8-Max LLM and VLM calls |
| **Mobile Scanner App** | **React Native (Expo)** | Camera-based script scanning with edge detection and auto-crop |
| **Web Dashboard** | **React + Tailwind CSS** | 5-page enterprise UI with dynamic 8-debugger visual metrics |
| **Backend Framework** | **Python 3.11+ · FastAPI (asyncio + uvicorn)** | High-performance async REST gateway |
| **Task Queue** | **Celery + Redis** | Async multi-page PDF ingestion & OCR dispatch |
| **Authentication** | **OAuth2 + JWT · Passlib (Bcrypt)** | Multi-tenant institutional data isolation |
| **Vector & Relational DB** | **PostgreSQL + pgvector** | Semantic embeddings + relational exam/rubric/paper schemas |
| **Object Storage** | **Alibaba Cloud OSS** | Unified store for mobile scans, PDFs, and exported reports |
| **Cloud Compute** | **Alibaba Cloud ECS / Container** | Full-stack containerized production hosting |
| **Graph Logic** | **NetworkX (Python)** | DAG procedural order verification (Debugger V) |
| **Algorithms** | **Cosine Similarity · Levenshtein · Density Ratio** | Semantic matching, fuzzy spelling, anti-fluff scoring |
| **UI Components** | **Radix UI / Shadcn · Lucide Icons** | Accessible composable component library |
| **Data Visualization** | **ApexCharts.js / Recharts** | Class performance distribution and score analytics |
| **State Management** | **Zustand · TanStack React Query** | Async API state, caching, optimistic updates |

---

## 10. Monorepo Structure

```
ScriptGrade/
│
├── mobile/                              # 📱 Mobile Scanner App — React Native (Expo)
│   ├── app/
│   │   ├── (auth)/                      # Login, institutional SSO
│   │   ├── scanner/                     # Camera, edge detection, auto-crop
│   │   ├── preview/                     # RTL script preview before upload
│   │   └── sync/                        # Offline queue + OSS upload
│   ├── components/
│   │   ├── EdgeDetector.tsx             # Real-time document boundary detection
│   │   ├── AutoCrop.tsx                 # Perspective correction
│   │   └── RTLPreview.tsx               # Urdu/Sindhi/Punjabi script preview
│   ├── hooks/                           # useOfflineQueue, useOSSUpload
│   ├── app.json
│   └── package.json
│
├── frontend/                            # 🖥️ Web Office Dashboard — React + Tailwind CSS
│   ├── src/
│   │   ├── pages/
│   │   │   ├── login/                   # Page 1: Auth (Login/Signup, Demo Access)
│   │   │   ├── dashboard/               # Page 2: Exam Hub & Global Metrics
│   │   │   ├── exam/setup/              # Page 3: AI Rubric Studio
│   │   │   ├── exam/upload/             # Page 4: Dual Ingestion Portal
│   │   │   └── exam/grade/              # Page 5: Master Grading Workspace
│   │   ├── components/
│   │   │   ├── DebuggerPanel/           # 8-Debugger visual metric cards
│   │   │   ├── RubricEditor/            # Interactive Magic Concepts Editor
│   │   │   └── OverridePanel/           # Teacher manual override + notes
│   │   ├── lib/                         # API client, Zustand stores, React Query
│   │   └── styles/                      # Tailwind config & design tokens
│   ├── tailwind.config.ts
│   ├── package.json
│   └── .env.example
│
├── backend/                             # ⚙️ FastAPI Gateway — Async Python
│   ├── app/
│   │   ├── api/v1/                      # auth, exams, papers, analytics routers
│   │   ├── models/                      # users, exams, rubrics, student_papers (SQLAlchemy)
│   │   ├── schemas/                     # Pydantic request/response contracts
│   │   ├── services/
│   │   │   ├── ai_client.py             # DashScope / Qwen3.8-Max unified client
│   │   │   ├── oss_client.py            # Alibaba Cloud OSS upload & signed URLs
│   │   │   └── celery_worker.py         # Async OCR ingestion task definitions
│   │   ├── core/                        # JWT auth, config, multi-tenant security
│   │   └── main.py
│   ├── alembic/                         # DB migrations (PostgreSQL + pgvector)
│   ├── requirements.txt
│   └── .env.example
│
├── nlp-engine/                          # 🧠 8-Debugger NLP Pipeline
│   ├── pipelines/
│   │   ├── rubric_extraction.py         # Qwen3.8-Max auto-rubric prompt pipeline
│   │   ├── vision_ocr.py                # Qwen3.8-Max VLM OCR + diagram inspection
│   │   └── evaluation_pipeline.py       # Orchestrates full 8-debugger scoring
│   ├── debuggers/
│   │   ├── garbage_text.py              # Debugger I
│   │   ├── negation_detector.py         # Debugger II
│   │   ├── synonym_matcher.py           # Debugger III
│   │   ├── fuzzy_spelling.py            # Debugger IV
│   │   ├── sequence_dag.py              # Debugger V — NetworkX DAG verifier
│   │   ├── visual_inspector.py          # Debugger VI — Qwen3.8-Max VLM dispatch
│   │   ├── density_scorer.py            # Debugger VII
│   │   └── rubric_aggregator.py         # Debugger VIII
│   ├── prompts/                         # Versioned JSON prompt templates
│   ├── embeddings/                      # pgvector embedding utilities
│   └── requirements.txt
│
├── docs/                                # PRDs, API contracts, architecture diagrams
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 11. Quick Start & Installation Guide

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 18.x+ | For web frontend and mobile Expo builds |
| **Python** | 3.11+ | Backend and NLP engine |
| **PostgreSQL** | 14+ with pgvector | pgvector extension required |
| **Redis** | 7.x+ | Celery task broker |
| **Expo CLI** | Latest | `npm install -g expo-cli` |
| **Alibaba Cloud Account** | — | DashScope API key · OSS bucket · ECS access |

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/<your-org>/scriptgrade.git
cd scriptgrade
```

---

### Step 2 — Configure Environment Variables

**`backend/.env`**
```env
# ── Alibaba Cloud AI (DashScope) ─────────────────────────────────────
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
QWEN_MODEL=qwen3-8b-max
QWEN_VL_MODEL=qwen-vl-max

# ── PostgreSQL + pgvector ─────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/scriptgrade
PGVECTOR_ENABLED=true

# ── Alibaba Cloud OSS ─────────────────────────────────────────────────
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET_NAME=scriptgrade-scans
OSS_ENDPOINT=oss-ap-southeast-1.aliyuncs.com

# ── Auth ──────────────────────────────────────────────────────────────
JWT_SECRET_KEY=your_super_secret_key_min_32_chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# ── Task Queue ────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0
```

**`frontend/.env`**
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_APP_NAME=ScriptGrade
```

**`mobile/.env`**
```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
EXPO_PUBLIC_OSS_BUCKET=scriptgrade-scans
```

---

### Step 3 — Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt

# Run DB migrations (creates tables + pgvector extension)
alembic upgrade head

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000

# In a second terminal — start the Celery async worker
celery -A app.services.celery_worker worker --loglevel=info
```

---

### Step 4 — NLP Engine Validation

```bash
cd nlp-engine
python -m venv venv
source venv/bin/activate

pip install -r requirements.txt

# Verify Qwen3.8-Max DashScope connectivity
python -m pipelines.rubric_extraction --healthcheck

# Run the full 8-debugger engine on a sample paper
python -m pipelines.evaluation_pipeline --sample
```

---

### Step 5 — Web Dashboard Setup (React + Tailwind)

```bash
cd frontend
npm install
npm run dev
```

---

### Step 6 — Mobile Scanner App Setup (React Native · Expo)

```bash
cd mobile
npm install

# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android

# Physical device — scan the QR code in the Expo Go app
npx expo start
```

---

### Step 7 — Service Access URLs

| Service | URL | Notes |
|---|---|---|
| **Web Dashboard** | `http://localhost:5173` | React + Tailwind frontend |
| **Backend API** | `http://localhost:8000` | FastAPI server |
| **Swagger API Docs** | `http://localhost:8000/docs` | Interactive REST documentation |
| **Celery Monitor** | `http://localhost:5555` | Flower task dashboard (optional) |

> 💡 **Judges' Shortcut:** Use the **Quick Demo Access** button on `/login` to auto-fill credentials and jump directly into a pre-seeded live dashboard.

---

## 12. Docker Compose — One-Command Launch

```bash
docker-compose up --build
```

```yaml
# docker-compose.yml (excerpt)
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    depends_on: [postgres, redis]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    env_file: ./frontend/.env

  nlp-engine:
    build: ./nlp-engine
    env_file: ./backend/.env
    depends_on: [backend]

  celery-worker:
    build: ./backend
    command: celery -A app.services.celery_worker worker --loglevel=info
    env_file: ./backend/.env
    depends_on: [redis, postgres]

  postgres:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_DB: scriptgrade
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

---

## 13. Hackathon Alignment & Business Impact

### Alibaba Cloud Technology Depth

ScriptGrade was purpose-built to showcase **maximum depth** of Alibaba Cloud integration — not breadth of surface-level API calls.

| Evaluation Criterion | ScriptGrade Evidence |
|---|---|
| **AI Innovation** | Qwen3.8-Max drives the entire evaluation loop: rubric extraction, multilingual OCR, negation dependency parsing, diagram visual inspection — all from a single unified DashScope client |
| **Cloud-Native Architecture** | OSS for persistent dual-channel storage, pgvector for semantic retrieval, ECS for containerized compute, Celery for async workload management |
| **Regional Language Impact** | First-of-kind automated grading for Urdu, Sindhi, and Punjabi/Nastaliq — directly addressing Pakistan's 220M+ population educational infrastructure gap |
| **Production Readiness** | JWT multi-tenant auth, alembic migrations, structured API contracts, Celery async workers, Docker Compose orchestration — this is a shippable system |
| **Technical Completeness** | Dual ingestion (mobile + web), 8-debugger NLP engine, teacher override loop, CSV/PDF export, and a full 5-page enterprise UI |

### Market & Social Impact

> Pakistan administers over **6 million board-level handwritten exam scripts annually** across matric, intermediate, and university levels. Each paper is evaluated manually by an overworked examiner under institutional time pressure.

| Metric | Current State | ScriptGrade Target |
|---|---|---|
| **Grading Time per Paper** | 15–30 minutes | < 30 seconds |
| **Language Coverage** | English only (digital tools) | English + Urdu + Sindhi + Punjabi |
| **Score Consistency** | High variance across examiners | Deterministic, rubric-locked |
| **Auditability** | None — single examiner judgment | Full per-concept diagnostic trail |
| **Diagram Grading** | Manual or skipped | Qwen3.8-Max VLM bounding-box verification |
| **Institutional Deployment** | Spreadsheets + physical papers | Cloud-native multi-tenant SaaS |

---

## 14. Team

| Member | Role | Core Responsibilities |
|---|---|---|
| **Muhammad Musa** | 🧠 Lead AI / NLP Architect | Qwen3.8-Max DashScope inference pipelines, prompt engineering, pgvector semantic matching, all 8 Vulnerability Debuggers, multilingual OCR strategy |
| **Rohail Khan Shinwari** | 🎨 Lead Frontend Engineer | React + Tailwind 5-page enterprise UI, Interactive Rubric Studio, Master Grading Workspace, 8-Debugger visual metrics, full REST API integration |
| **Ishmal Khalid** | ⚙️ Lead Backend Engineer | FastAPI microservices, PostgreSQL + pgvector schema design, Celery async ingestion, JWT multi-tenant security, OSS dual-channel integration |

---

<div align="center">

---

### Built with ❤️, Qwen3.8-Max, and Alibaba Cloud DashScope
#### **Alibaba Cloud AI Hackathon — Pakistan 2026**

*ScriptGrade — Grading that thinks like a teacher, at machine speed.*

[![Alibaba Cloud](https://img.shields.io/badge/Powered%20by-Alibaba%20Cloud%20DashScope-FF6A00?style=for-the-badge&logo=alibabacloud&logoColor=white)](#)
[![Qwen3.8-Max](https://img.shields.io/badge/Model-Qwen3.8--Max-FF6A00?style=for-the-badge)](#)
[![pgvector](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20pgvector-2496ED?style=for-the-badge&logo=postgresql&logoColor=white)](#)

---

</div>
