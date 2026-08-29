# ScriptGrade — Backend Architecture & Engineering Specification (PRD)

> **Event:** Alibaba Cloud AI Hackathon Pakistan 2026
> **Revision:** v2.0 — Dual-Ingestion Architecture
> **Document Owner:** Ishmal Khalid (Lead Backend Engineer)
> **Last Updated:** 2026-08-29

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Developer Responsibility Matrix](#2-developer-responsibility-matrix)
3. [Comprehensive Technology Stack](#3-comprehensive-technology-stack)
4. [System Architecture & Data Flow](#4-system-architecture--data-flow)
5. [Dual-Ingestion Architecture](#5-dual-ingestion-architecture)
6. [CORS & Networking Configuration](#6-cors--networking-configuration)
7. [Database Schema Design](#7-database-schema-design)
8. [REST API Contract Specifications](#8-rest-api-contract-specifications)
9. [NLP Engine Integration Contract](#9-nlp-engine-integration-contract)
10. [Alibaba Cloud OSS Integration](#10-alibaba-cloud-oss-integration)
11. [Celery Async Worker Configuration](#11-celery-async-worker-configuration)
12. [JWT Authentication & Multi-Tenant Security](#12-jwt-authentication--multi-tenant-security)
13. [8-Debugger Diagnostic JSON Schema](#13-8-debugger-diagnostic-json-schema)
14. [Error Handling & Response Standards](#14-error-handling--response-standards)
15. [Environment Variables Reference](#15-environment-variables-reference)
16. [Deployment & Infrastructure](#16-deployment--infrastructure)

---

## 1. Executive Summary

The ScriptGrade backend serves as the **central orchestration engine** of the platform. It exposes high-performance asynchronous REST APIs consumed by two upstream clients — Rohail Khan Shinwari's React web dashboard and the React Native mobile scanner application — while dispatching all AI inference workloads downstream to Muhammad Musa's NLP Engine and Alibaba Cloud DashScope (Qwen3.8-Max).

**v2.0 expands the original single-channel ingestion model into a Dual-Ingestion Architecture.** Both the mobile camera scanner app and the web office dashboard feed into a unified OSS-backed processing queue, differentiated by a `source` tag at ingestion. The pipeline ensures identical downstream evaluation regardless of ingestion channel — the same 8-Debugger NLP diagnostics, the same scoring contract, the same audit trail.

**Key architectural invariants this document enforces:**

- Zero breaking changes to any endpoint consumed by Rohail's frontend (v1 contracts are additive-only).
- All `nlp-engine` integration schemas are strictly typed and versioned.
- Multi-tenant data isolation is enforced at the SQL row level (not just at the API layer).
- No evaluation logic lives in the FastAPI layer — it is delegated entirely to the NLP engine via Celery tasks.

---

## 2. Developer Responsibility Matrix

| Deliverable | Owner | Status |
|---|---|---|
| FastAPI microservices, async routing, uvicorn server | Ishmal Khalid | Backend |
| Celery + Redis async worker configuration | Ishmal Khalid | Backend |
| Relational schema design (PostgreSQL + pgvector) | Ishmal Khalid | Backend |
| Alibaba Cloud OSS dual-channel integration | Ishmal Khalid | Backend |
| JWT OAuth2 multi-tenant security middleware | Ishmal Khalid | Backend |
| CORS configuration (web + mobile IP routing) | Ishmal Khalid | Backend |
| Alembic database migration scripts | Ishmal Khalid | Backend |
| API Gateway ↔ NLP Engine integration contracts | Ishmal Khalid + Muhammad Musa | Shared |
| Qwen3.8-Max LLM/VLM inference pipelines | Muhammad Musa | NLP Engine |
| 8-Debugger evaluation orchestration | Muhammad Musa | NLP Engine |
| React web dashboard (5 pages, REST integration) | Rohail Khan Shinwari | Frontend |
| React Native mobile scanner app | Rohail Khan Shinwari | Frontend |

---

## 3. Comprehensive Technology Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| **Language & Runtime** | Python | 3.11+ | Async execution via asyncio |
| **API Framework** | FastAPI | 0.111+ | High-performance async REST gateway |
| **ASGI Server** | Uvicorn | 0.29+ | Production ASGI server |
| **Task Queue** | Celery | 5.3+ | Async OCR dispatch & PDF ingestion |
| **Message Broker** | Redis | 7.x | Celery task broker |
| **Primary Database** | PostgreSQL (Alibaba Cloud AnalyticDB) | 14+ | Relational schema — users, exams, rubrics, papers |
| **Vector Extension** | pgvector | 0.7+ | Cosine-similarity semantic embedding queries |
| **ORM** | SQLAlchemy (async) | 2.0+ | Async database access with asyncpg driver |
| **Migrations** | Alembic | 1.13+ | Schema versioning |
| **Authentication** | OAuth2 + JWT (python-jose) | — | Stateless multi-tenant bearer tokens |
| **Password Hashing** | Passlib (Bcrypt) | 1.7+ | Secure credential storage |
| **Object Storage** | Alibaba Cloud OSS (oss2) | 2.18+ | Scans, PDFs, exported reports |
| **AI LLM** | Alibaba Cloud DashScope / Qwen3.8-Max | — | Rubric extraction, negation parsing |
| **AI VLM** | Alibaba Cloud DashScope / Qwen3.8-Max VL | — | Handwritten OCR, diagram inspection |
| **HTTP Client** | httpx | 0.27+ | Async internal service calls |
| **Validation** | Pydantic | 2.x | Request/response schema validation |
| **CORS** | FastAPI CORSMiddleware | — | Web + mobile origin policy |
| **Container** | Docker + Docker Compose | — | Orchestrated multi-service deployment |

---

## 4. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     UPSTREAM CLIENTS                                │
│                                                                     │
│  📱 React Native Mobile App          🖥️ React Web Dashboard          │
│     (Expo — Camera Scanner)            (Tailwind CSS — 5 Pages)     │
│     source: "mobile"                   source: "web_dashboard"      │
└────────────────┬──────────────────────────────┬────────────────────┘
                 │ POST /api/v1/papers/upload    │ POST /api/v1/papers/batch-upload
                 │ multipart/form-data           │ multipart/form-data
                 ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              FastAPI Gateway (Async · JWT · REST)                   │
│                                                                     │
│  /auth          /exams         /papers         /analytics           │
│  OAuth2/JWT     CRUD + AI      Ingest + Query  Export Engine        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ Validated payload + JWT claim
                                 ▼
                  ┌──────────────────────────────┐
                  │   Alibaba Cloud OSS           │
                  │   (scriptgrade-scans bucket)  │
                  │   oss_key returned            │
                  └──────────────┬───────────────┘
                                 │ oss_key enqueued
                                 ▼
                  ┌──────────────────────────────┐
                  │   Celery + Redis Queue        │
                  │   task: evaluate_paper        │
                  └──────────────┬───────────────┘
                                 │ HTTP POST (internal)
                                 ▼
                  ┌──────────────────────────────┐
                  │   NLP Engine (Musa)           │
                  │   POST /internal/evaluate     │
                  │   Qwen3.8-Max LLM + VLM       │
                  │   8-Debugger Pipeline         │
                  └──────────────┬───────────────┘
                                 │ DiagnosticResult JSON
                                 ▼
                  ┌──────────────────────────────┐
                  │   PostgreSQL + pgvector       │
                  │   student_papers row updated  │
                  │   diagnostic_logs (JSONB)     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │   FastAPI Response            │
                  │   GET /api/v1/papers/:id      │
                  │   → Full 8-Debugger JSON      │
                  └──────────────────────────────┘
```

---

## 5. Dual-Ingestion Architecture

### 5.1 Overview

ScriptGrade v2.0 processes exam scripts arriving from two physically distinct channels. The backend must normalize both into an identical internal representation before queuing for evaluation. The `source` field is the only structural differentiator persisted in the database.

| Channel | Client | Endpoint | Payload Type | Source Tag |
|---|---|---|---|---|
| **Channel A — Mobile** | React Native (Expo) | `POST /api/v1/papers/upload` | `image/jpeg` or `image/png` (single scan) | `mobile` |
| **Channel B — Web** | React Dashboard | `POST /api/v1/papers/upload` | `application/pdf` (single or multi-page) | `web_dashboard` |
| **Channel B Bulk** | React Dashboard | `POST /api/v1/papers/batch-upload` | `application/pdf` (batch, multi-student) | `web_dashboard` |

### 5.2 Channel A — Mobile Scanner Ingestion

The mobile app captures a photograph of a handwritten answer sheet, performs on-device edge detection and perspective correction (handled in the Expo app), and sends the cropped image directly to the backend.

**Mobile-specific handling at the backend layer:**

- Accept `image/jpeg`, `image/png`, or `image/webp` MIME types.
- Validate file size ≤ 15 MB per scan (mobile camera output).
- Apply `source = "mobile"` tag on the `student_papers` row.
- OSS key prefix: `exams/{exam_id}/mobile/{student_id}/{timestamp}.jpg`
- Dispatch `evaluate_paper` Celery task immediately (no splitting required — single student, single page).
- Return `202 Accepted` with `job_id` and `oss_key`.

**RTL Language Hint:** The `language` field passed in the request body is forwarded to the NLP engine as a directive to Qwen3.8-Max VLM for script-specific OCR (Urdu Nastaliq / Sindhi / Punjabi Gurmukhi).

### 5.3 Channel B — Web Dashboard Ingestion (Single Upload)

The web dashboard sends a single PDF or image representing one student's paper.

- Accept `application/pdf`, `image/jpeg`, `image/png`.
- Validate file size ≤ 50 MB per upload.
- Apply `source = "web_dashboard"` tag.
- OSS key prefix: `exams/{exam_id}/web/{student_id}/{timestamp}.pdf`
- Dispatch `evaluate_paper` Celery task.

### 5.4 Channel B Bulk — Web Batch Upload

The web dashboard sends a single PDF containing answer sheets from multiple students (ADF scanner output). The backend must split and route individual papers.

- Accept `application/pdf` only.
- Validate ≤ 200 MB per batch.
- Apply `source = "web_dashboard"` and `batch_id` on all generated `student_papers` rows.
- Celery task `split_and_evaluate_batch` handles PDF page segmentation (via `PyMuPDF`) and dispatches individual `evaluate_paper` sub-tasks per student.
- OSS key prefix: `exams/{exam_id}/batch/{batch_id}/{student_id}.pdf`

### 5.5 Unified File Processing Pipeline

Regardless of ingestion channel, every paper traverses the following pipeline inside the Celery worker:

```
1. Receive validated file from FastAPI route handler
2. Upload raw file to Alibaba Cloud OSS → obtain signed oss_key
3. Create student_papers row (status: "processing", source tagged)
4. Enqueue Celery task with: { paper_id, oss_key, exam_id, language, source }
5. Celery worker: POST to NLP Engine /internal/evaluate with OSS presigned URL
6. NLP Engine: Qwen3.8-Max VLM OCR → 8-Debugger pipeline → DiagnosticResult JSON
7. Celery worker: UPDATE student_papers SET diagnostic_logs, total_score, ocr_transcript,
   ocr_confidence, status = "completed"
8. Optional webhook / WebSocket push to frontend (status update)
```

---

## 6. CORS & Networking Configuration

### 6.1 CORS Policy

The FastAPI application must allow cross-origin requests from all valid client origins. The following `CORSMiddleware` configuration must be applied in `app/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS: list[str] = [
    # Web Dashboard — local development (Vite default ports)
    "http://localhost:3000",
    "http://localhost:5173",
    # Web Dashboard — staging / production
    "https://scriptgrade.app",
    "https://staging.scriptgrade.app",
    # Mobile App — Expo Go LAN development (covers common local network ranges)
    "http://192.168.1.0/24",   # Resolved dynamically; see note below
    "exp://",                  # Expo deep-link scheme
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://192\.168\.\d+\.\d+(:\d+)?",  # LAN mobile dev
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Source", "Accept"],
    expose_headers=["X-Job-ID", "X-OSS-Key"],
    max_age=600,
)
```

> **Mobile LAN Note:** During local development, the Expo app runs on the developer's LAN IP (e.g., `192.168.x.x`). The `allow_origin_regex` pattern accepts any `192.168.x.x` origin on any port, eliminating the need to hardcode the IP each session. On staging/production, mobile requests route through HTTPS and the wildcard regex is disabled.

### 6.2 Custom Headers

| Header | Direction | Purpose |
|---|---|---|
| `X-Request-Source` | Client → Server | Optional reinforcement of `source` field (`mobile` / `web_dashboard`) |
| `X-Job-ID` | Server → Client | Celery job ID exposed in response headers for polling |
| `X-OSS-Key` | Server → Client | OSS object key of the uploaded file for direct CDN access |
| `Authorization` | Client → Server | `Bearer <JWT>` — required on all protected routes |

### 6.3 Trusted Proxy Configuration

When deployed behind Alibaba Cloud SLB (Server Load Balancer) or Nginx, add:

```python
from fastapi import FastAPI
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

app = FastAPI()
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
```

This ensures `request.client.host` reflects the real client IP for rate-limiting and audit logging, not the proxy IP.

---

## 7. Database Schema Design

### 7.1 Schema Overview (PostgreSQL + pgvector)

All tables reside in a `scriptgrade` schema with row-level tenant isolation enforced via `user_id` foreign key relationships. pgvector is enabled at the database level:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

### 7.2 `users` Table

```sql
CREATE TABLE users (
    user_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name        VARCHAR(255)    NOT NULL,
    email            VARCHAR(320)    NOT NULL UNIQUE,
    hashed_password  VARCHAR(255)    NOT NULL,
    institution_name VARCHAR(500)    NOT NULL,
    role             VARCHAR(20)     NOT NULL CHECK (role IN ('teacher', 'dept_head', 'admin')),
    is_active        BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
```

**SQLAlchemy Model (`app/models/users.py`):**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    institution_name: Mapped[str] = mapped_column(String(500), nullable=False)
    role: Mapped[str] = mapped_column(SAEnum("teacher", "dept_head", "admin", name="user_role"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
```

---

### 7.3 `exams` Table

```sql
CREATE TABLE exams (
    exam_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title                VARCHAR(500) NOT NULL,
    subject              VARCHAR(255),
    question_paper_url   TEXT,
    sample_answer_url    TEXT,
    status               VARCHAR(20) NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'processing', 'completed')),
    class_size           INTEGER DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exams_user_id ON exams (user_id);
CREATE INDEX idx_exams_status ON exams (status);
```

---

### 7.4 `rubrics` Table

```sql
CREATE TABLE rubrics (
    rubric_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id          UUID NOT NULL UNIQUE REFERENCES exams(exam_id) ON DELETE CASCADE,
    concepts_json    JSONB NOT NULL DEFAULT '[]',
    ignore_spelling  BOOLEAN NOT NULL DEFAULT TRUE,
    strict_order     BOOLEAN NOT NULL DEFAULT FALSE,
    density_scoring  BOOLEAN NOT NULL DEFAULT TRUE,
    density_threshold NUMERIC(5,2) NOT NULL DEFAULT 30.0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`concepts_json` structure:**

```json
[
  {
    "keyword": "Sunlight",
    "weight": 3,
    "synonyms": ["solar energy", "solar radiation", "light energy"],
    "embedding_id": "vec-uuid-1234"
  },
  {
    "keyword": "Chlorophyll",
    "weight": 3,
    "synonyms": ["green pigment", "photosynthetic pigment"],
    "embedding_id": "vec-uuid-5678"
  }
]
```

---

### 7.5 `student_papers` Table — v2.0 Extended Schema

This table is the primary extension point for v2.0. Key additions: `source`, `ocr_confidence`, `batch_id`, `celery_job_id`, and `processing_status`.

```sql
CREATE TABLE student_papers (
    paper_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id                 UUID NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
    user_id                 UUID NOT NULL REFERENCES users(user_id),

    -- Identity
    student_identifier      VARCHAR(255) NOT NULL,   -- Roll No or student name
    batch_id                UUID,                    -- Set when ingested via batch-upload

    -- Ingestion metadata (v2.0)
    source                  VARCHAR(20) NOT NULL DEFAULT 'web_dashboard'
                            CHECK (source IN ('mobile', 'web_dashboard')),
    language                VARCHAR(5) NOT NULL DEFAULT 'en'
                            CHECK (language IN ('en', 'ur', 'sd', 'pa')),
    celery_job_id           VARCHAR(255),
    processing_status       VARCHAR(20) NOT NULL DEFAULT 'queued'
                            CHECK (processing_status IN ('queued', 'processing', 'completed', 'failed')),

    -- OSS references
    scanned_image_url       TEXT NOT NULL,
    oss_key                 TEXT NOT NULL,

    -- OCR output (v2.0 — confidence field added)
    ocr_transcript          TEXT,
    ocr_confidence          NUMERIC(5,2),             -- 0.00–100.00 %
    word_count              INTEGER,

    -- Scoring
    total_score             NUMERIC(6,2),
    max_score               NUMERIC(6,2),
    is_flagged              BOOLEAN NOT NULL DEFAULT FALSE,

    -- 8-Debugger diagnostic payload
    diagnostic_logs         JSONB,

    -- Teacher override
    teacher_override_score  NUMERIC(6,2),
    moderation_note         TEXT,

    -- Timestamps
    evaluated_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_papers_exam_id ON student_papers (exam_id);
CREATE INDEX idx_papers_student_identifier ON student_papers (student_identifier);
CREATE INDEX idx_papers_source ON student_papers (source);
CREATE INDEX idx_papers_batch_id ON student_papers (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_papers_processing_status ON student_papers (processing_status);
```

---

### 7.6 `concept_embeddings` Table (pgvector)

Stores rubric concept vector embeddings for cosine-similarity synonym matching performed by the NLP engine.

```sql
CREATE TABLE concept_embeddings (
    embedding_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubric_id     UUID NOT NULL REFERENCES rubrics(rubric_id) ON DELETE CASCADE,
    concept_name  VARCHAR(255) NOT NULL,
    embedding     vector(1536) NOT NULL,   -- DashScope text-embedding-v3 dimension
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_embeddings_rubric_id ON concept_embeddings (rubric_id);
CREATE INDEX idx_concept_embeddings_ivfflat
    ON concept_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

---

## 8. REST API Contract Specifications

### 8.1 Base URL & Versioning

| Environment | Base URL |
|---|---|
| Local development | `http://localhost:8000/api/v1` |
| Staging | `https://api.staging.scriptgrade.app/api/v1` |
| Production | `https://api.scriptgrade.app/api/v1` |

All routes are versioned under `/api/v1`. Future breaking changes introduce `/api/v2`.

---

### 8.2 Authentication Routes

#### `POST /api/v1/auth/login`

Authenticates an educator and returns a JWT bearer token. No auth required.

**Request Body:**
```json
{
  "email": "teacher@school.edu.pk",
  "password": "secure_password_here"
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "full_name": "Rohail Khan Shinwari",
    "email": "teacher@school.edu.pk",
    "role": "teacher",
    "institution_name": "National University of Sciences & Technology"
  }
}
```

**Response `401 Unauthorized`:**
```json
{ "detail": "Invalid credentials." }
```

---

#### `POST /api/v1/auth/signup`

Registers a new educator account and initializes workspace defaults.

**Request Body:**
```json
{
  "full_name": "Ishmal Khalid",
  "email": "ishmal@school.edu.pk",
  "institution_name": "University of Engineering & Technology",
  "password": "strong_password_min_8",
  "role": "teacher"
}
```

**Response `201 Created`:**
```json
{
  "status": "success",
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "message": "Account created. You may now log in."
}
```

---

### 8.3 Exam Management Routes

#### `GET /api/v1/exams/list`

Returns dashboard metrics and paginated exam logs for the authenticated teacher.

**Headers:** `Authorization: Bearer <JWT>`

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | `int` | `1` | Pagination page number |
| `page_size` | `int` | `20` | Results per page (max 100) |
| `status` | `string` | `null` | Filter by exam status: `draft`, `processing`, `completed` |

**Response `200 OK`:**
```json
{
  "global_metrics": {
    "total_papers_checked": 1250,
    "overall_accuracy": 98.4,
    "hours_saved": 140.5,
    "total_exams": 18
  },
  "exams": [
    {
      "exam_id": "a3f7c891-12b4-4e3a-9d1c-bc7e234f5a10",
      "title": "Biology 101 – Term 1 Mid-Term",
      "subject": "Biology",
      "date": "2026-08-19",
      "class_size": 50,
      "status": "completed",
      "class_average": 8.2,
      "papers_graded": 50,
      "papers_pending": 0
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_records": 18,
    "total_pages": 1
  }
}
```

---

#### `POST /api/v1/exam/setup`

Accepts Question Paper and Reference Sample Answer uploads, stores both in OSS, triggers Qwen3.8-Max rubric extraction, and returns auto-extracted magic concepts.

**Headers:** `Authorization: Bearer <JWT>`
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `question_file` | `File` | ✅ | Question paper (PDF or image) |
| `sample_answer_file` | `File` | ✅ | Model answer sheet (PDF or image) |
| `exam_title` | `string` | ✅ | Human-readable exam title |
| `subject` | `string` | ❌ | Subject name (e.g., "Biology") |
| `max_score` | `float` | ✅ | Maximum achievable marks |

**Response `200 OK`:**
```json
{
  "exam_id": "a3f7c891-12b4-4e3a-9d1c-bc7e234f5a10",
  "extracted_concepts": [
    { "keyword": "Sunlight",    "weight": 3, "synonyms": ["solar energy", "solar radiation"] },
    { "keyword": "Chlorophyll", "weight": 3, "synonyms": ["green pigment", "photosynthetic pigment"] },
    { "keyword": "Glucose",     "weight": 2, "synonyms": ["sugar", "C6H12O6"] },
    { "keyword": "CO2",         "weight": 1, "synonyms": ["carbon dioxide", "CO₂"] },
    { "keyword": "Oxygen",      "weight": 1, "synonyms": ["O2", "O₂"] }
  ],
  "concept_count": 5,
  "max_score": 10.0,
  "qwen_model": "qwen3-8b-max",
  "extraction_latency_ms": 1240
}
```

---

#### `PUT /api/v1/exam/rubric`

Saves teacher-customized magic keywords, weights, synonym clusters, and sensitivity toggles.

**Headers:** `Authorization: Bearer <JWT>`
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "exam_id": "a3f7c891-12b4-4e3a-9d1c-bc7e234f5a10",
  "concepts": [
    { "keyword": "Sunlight",    "weight": 3, "synonyms": ["solar energy"] },
    { "keyword": "Chlorophyll", "weight": 3, "synonyms": ["green pigment"] },
    { "keyword": "Glucose",     "weight": 2, "synonyms": ["sugar"] },
    { "keyword": "CO2",         "weight": 1, "synonyms": ["carbon dioxide"] },
    { "keyword": "Oxygen",      "weight": 1, "synonyms": ["O2"] }
  ],
  "ignore_spelling": true,
  "strict_order": false,
  "density_scoring": true,
  "density_threshold": 30.0
}
```

**Response `200 OK`:**
```json
{
  "status": "updated",
  "rubric_id": "b1c2d3e4-5678-90ab-cdef-1234567890ab",
  "concept_count": 5,
  "embeddings_generated": 5
}
```

---

### 8.4 Paper Ingestion Routes

#### `POST /api/v1/papers/upload` ⬅ *v2.0 Primary Dual-Ingestion Endpoint*

Accepts a single student answer sheet from either the mobile scanner app or the web dashboard. This is the **unified ingestion endpoint** for Channel A and Channel B (single-paper).

**Headers:** `Authorization: Bearer <JWT>`
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Allowed Values | Description |
|---|---|---|---|---|
| `file` | `File` | ✅ | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` | Scanned answer sheet |
| `exam_id` | `UUID` | ✅ | — | Target exam identifier |
| `student_id` | `string` | ✅ | — | Student roll number or unique identifier |
| `source` | `string` | ✅ | `mobile` \| `web_dashboard` | Ingestion channel tag |
| `language` | `string` | ✅ | `en` \| `ur` \| `sd` \| `pa` | Script language hint for Qwen OCR |
| `max_score` | `float` | ❌ | — | Override max score (defaults to rubric max) |

**File Size Limits:**

| Source | Max Size |
|---|---|
| `mobile` | 15 MB |
| `web_dashboard` | 50 MB |

**Response `202 Accepted`:**
```json
{
  "job_id": "celery-a3b4c5d6-7890-1234-abcd-ef1234567890",
  "paper_id": "f7e8d9c0-b1a2-3456-7890-abcdef123456",
  "status": "queued",
  "source": "mobile",
  "language": "ur",
  "oss_key": "exams/a3f7c891/mobile/STU-102/scan_1724076727.jpg",
  "estimated_completion_seconds": 12
}
```

**Python Route Handler (async):**

```python
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from app.core.auth import get_current_user
from app.db.session import get_db
from app.services.oss_client import upload_to_oss
from app.services.celery_worker import evaluate_paper
from app.models.users import User
from app.models.student_papers import StudentPaper
import uuid

router = APIRouter()

SOURCE_SIZE_LIMITS: dict[str, int] = {
    "mobile": 15 * 1024 * 1024,        # 15 MB
    "web_dashboard": 50 * 1024 * 1024, # 50 MB
}

ALLOWED_MIME_TYPES: set[str] = {
    "image/jpeg", "image/png", "image/webp", "application/pdf"
}

@router.post("/papers/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_paper(
    file: UploadFile = File(...),
    exam_id: UUID = Form(...),
    student_id: str = Form(...),
    source: str = Form(...),
    language: str = Form(default="en"),
    max_score: float | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # Validate source
    if source not in SOURCE_SIZE_LIMITS:
        raise HTTPException(status_code=422, detail="source must be 'mobile' or 'web_dashboard'.")

    # Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported media type: {file.content_type}")

    # Validate file size
    contents = await file.read()
    if len(contents) > SOURCE_SIZE_LIMITS[source]:
        raise HTTPException(status_code=413, detail=f"File exceeds {source} size limit.")

    # Upload to OSS
    oss_key = f"exams/{exam_id}/{source}/{student_id}/{int(datetime.now().timestamp())}"
    oss_key += ".jpg" if "image" in file.content_type else ".pdf"
    oss_url = await upload_to_oss(key=oss_key, data=contents, content_type=file.content_type)

    # Create student_papers row
    paper = StudentPaper(
        paper_id=uuid.uuid4(),
        exam_id=exam_id,
        user_id=current_user.user_id,
        student_identifier=student_id,
        source=source,
        language=language,
        scanned_image_url=oss_url,
        oss_key=oss_key,
        processing_status="queued",
    )
    db.add(paper)
    await db.commit()
    await db.refresh(paper)

    # Dispatch Celery task
    task = evaluate_paper.delay(
        paper_id=str(paper.paper_id),
        oss_key=oss_key,
        exam_id=str(exam_id),
        language=language,
        source=source,
    )

    # Persist job reference
    paper.celery_job_id = task.id
    await db.commit()

    return {
        "job_id": task.id,
        "paper_id": str(paper.paper_id),
        "status": "queued",
        "source": source,
        "language": language,
        "oss_key": oss_key,
        "estimated_completion_seconds": 12,
    }
```

---

#### `POST /api/v1/papers/batch-upload`

Accepts a single bulk PDF from an ADF institutional scanner containing multiple student answer sheets. The Celery worker handles page segmentation.

**Headers:** `Authorization: Bearer <JWT>`
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `batch_pdf_file` | `File` | ✅ | Multi-student bulk PDF (max 200 MB) |
| `exam_id` | `UUID` | ✅ | Target exam identifier |
| `language` | `string` | ✅ | `en` \| `ur` \| `sd` \| `pa` |
| `student_ids` | `string` | ✅ | JSON array of student IDs in page order |

**Response `202 Accepted`:**
```json
{
  "batch_id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
  "total_papers": 50,
  "status": "processing",
  "source": "web_dashboard",
  "estimated_completion_seconds": 180
}
```

---

### 8.5 Paper Retrieval & Override Routes

#### `GET /api/v1/papers/{student_id}`

Returns the complete evaluation, OCR transcript, and 8-Debugger diagnostics for a student paper within a given exam.

**Headers:** `Authorization: Bearer <JWT>`

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `exam_id` | `UUID` | ✅ | Scopes the lookup to a specific exam |

**Response `200 OK`:** Full 8-Debugger diagnostic JSON (see Section 13 for complete schema).

```json
{
  "student_id": "STU-102",
  "paper_id": "f7e8d9c0-b1a2-3456-7890-abcdef123456",
  "exam_id": "a3f7c891-12b4-4e3a-9d1c-bc7e234f5a10",
  "ingestion_source": "mobile",
  "language_detected": "en",
  "processing_status": "completed",
  "score": 10.0,
  "max_score": 10.0,
  "ocr_confidence": 96.5,
  "ocr_transcript": "Photosynthesis is the process by which green plants use sunlight and chlorophyll to convert carbon dioxide and water into glucose and oxygen.",
  "word_count": 28,
  "evaluated_at": "2026-08-19T14:32:07.412Z",
  "diagnostics": { },
  "teacher_override": {
    "applied": false,
    "override_score": null,
    "moderation_note": null
  }
}
```

---

#### `POST /api/v1/papers/{student_id}/override`

Applies a teacher manual score override and recalculates live class performance analytics.

**Headers:** `Authorization: Bearer <JWT>`

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `exam_id` | `UUID` | ✅ | Scopes the override to a specific exam |

**Request Body:**
```json
{
  "new_score": 8.0,
  "moderation_note": "Diagram visual clarity reverified manually. Partial credit awarded for chloroplast label."
}
```

**Response `200 OK`:**
```json
{
  "status": "override_applied",
  "paper_id": "f7e8d9c0-b1a2-3456-7890-abcdef123456",
  "updated_score": 8.0,
  "original_ai_score": 10.0,
  "class_average_recalculated": 8.14,
  "moderation_note": "Diagram visual clarity reverified manually. Partial credit awarded for chloroplast label."
}
```

---

#### `GET /api/v1/analytics/export`

Generates and streams a class performance report.

**Headers:** `Authorization: Bearer <JWT>`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `exam_id` | `UUID` | ✅ | — | Target exam |
| `format` | `string` | ❌ | `csv` | `csv` or `pdf` |

**Response `200 OK`:** Binary file stream.

| Format | Content-Type | Filename |
|---|---|---|
| `csv` | `text/csv` | `exam_{exam_id}_results.csv` |
| `pdf` | `application/pdf` | `exam_{exam_id}_report.pdf` |

The generated file is simultaneously uploaded to OSS at `exports/{user_id}/{exam_id}/report.{format}` and streamed to the client.

---

### 8.6 Job Status Polling Route

#### `GET /api/v1/jobs/{job_id}`

Allows the frontend to poll Celery task status for a submitted ingestion job.

**Headers:** `Authorization: Bearer <JWT>`

**Response `200 OK`:**
```json
{
  "job_id": "celery-a3b4c5d6-7890-1234-abcd-ef1234567890",
  "paper_id": "f7e8d9c0-b1a2-3456-7890-abcdef123456",
  "processing_status": "completed",
  "progress_percent": 100,
  "score": 10.0,
  "evaluated_at": "2026-08-19T14:32:07.412Z"
}
```

**`processing_status` values:** `queued` → `processing` → `completed` | `failed`

---

### 8.7 Complete API Surface Reference

| # | Endpoint | Method | Auth | Source | Purpose |
|---|---|---|---|---|---|
| 1 | `/api/v1/auth/login` | `POST` | Public | Both | Authenticate & issue JWT |
| 2 | `/api/v1/auth/signup` | `POST` | Public | Both | Register educator account |
| 3 | `/api/v1/exams/list` | `GET` | 🔐 JWT | Both | Dashboard metrics & exam log |
| 4 | `/api/v1/exam/setup` | `POST` | 🔐 JWT | Web | Upload Q&A → trigger Qwen rubric extraction |
| 5 | `/api/v1/exam/rubric` | `PUT` | 🔐 JWT | Web | Save/edit rubric weights & toggles |
| 6 | `/api/v1/papers/upload` | `POST` | 🔐 JWT | **Both** | **Dual-ingestion endpoint** (mobile + web single) |
| 7 | `/api/v1/papers/batch-upload` | `POST` | 🔐 JWT | Web | ADF bulk PDF → batch evaluation |
| 8 | `/api/v1/papers/{student_id}` | `GET` | 🔐 JWT | Both | Full evaluation + 8-debugger JSON |
| 9 | `/api/v1/papers/{student_id}/override` | `POST` | 🔐 JWT | Web | Teacher manual override + note |
| 10 | `/api/v1/analytics/export` | `GET` | 🔐 JWT | Web | Class CSV/PDF export to OSS |
| 11 | `/api/v1/jobs/{job_id}` | `GET` | 🔐 JWT | Both | Celery task status polling |

---

## 9. NLP Engine Integration Contract

The backend communicates with Muhammad Musa's `nlp-engine` microservice exclusively via Celery-dispatched async tasks that make internal HTTP calls. No direct synchronous coupling exists between the FastAPI gateway and the NLP engine.

### 9.1 Internal Evaluation Request

The Celery worker sends the following payload to the NLP engine:

**`POST http://nlp-engine:8001/internal/evaluate`**

```python
from pydantic import BaseModel

class EvaluationRequest(BaseModel):
    paper_id: str                  # UUID string
    oss_key: str                   # OSS object key for file retrieval
    oss_presigned_url: str         # Time-limited presigned download URL (15 min TTL)
    exam_id: str                   # UUID string
    language: str                  # en | ur | sd | pa
    source: str                    # mobile | web_dashboard
    rubric: RubricPayload          # Full rubric object (see below)
    qwen_model: str                # "qwen3-8b-max"
    qwen_vl_model: str             # "qwen-vl-max"

class RubricPayload(BaseModel):
    rubric_id: str
    concepts: list[ConceptItem]
    ignore_spelling: bool
    strict_order: bool
    density_scoring: bool
    density_threshold: float

class ConceptItem(BaseModel):
    keyword: str
    weight: float
    synonyms: list[str]
    embedding_id: str | None
```

### 9.2 Internal Evaluation Response

The NLP engine returns the following contract. **This schema is frozen — Musa must not add breaking changes without a version bump (`/internal/v2/evaluate`).**

```python
class DiagnosticResult(BaseModel):
    paper_id: str
    ocr_transcript: str
    ocr_confidence: float               # 0.0 – 100.0
    word_count: int
    language_detected: str
    score: float
    max_score: float
    diagnostics: DiagnosticsPayload
    evaluated_at: str                   # ISO 8601 UTC

class DiagnosticsPayload(BaseModel):
    I_garbage_text: GarbageTextResult
    II_negation_detection: NegationResult
    III_synonym_match: SynonymResult
    IV_spelling_correction: SpellingResult
    V_sequence_dag: SequenceDAGResult
    VI_diagram_visual: DiagramResult
    VII_density_scorer: DensityResult
    VIII_rubric_aggregator: RubricAggregatorResult
```

Full field definitions for each debugger sub-object are defined in Section 13.

### 9.3 Celery Task Implementation

```python
# app/services/celery_worker.py
from celery import Celery
import httpx
from app.services.oss_client import generate_presigned_url
from app.db.session import SyncSessionFactory
from app.models.student_papers import StudentPaper
from app.core.config import settings

celery_app = Celery("scriptgrade", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def evaluate_paper(
    self,
    paper_id: str,
    oss_key: str,
    exam_id: str,
    language: str,
    source: str,
) -> dict:
    try:
        with SyncSessionFactory() as db:
            paper = db.query(StudentPaper).filter_by(paper_id=paper_id).first()
            paper.processing_status = "processing"
            db.commit()

            rubric = _fetch_rubric(db, exam_id)
            presigned_url = generate_presigned_url(oss_key, ttl_seconds=900)

            payload = {
                "paper_id": paper_id,
                "oss_key": oss_key,
                "oss_presigned_url": presigned_url,
                "exam_id": exam_id,
                "language": language,
                "source": source,
                "rubric": rubric,
                "qwen_model": settings.QWEN_MODEL,
                "qwen_vl_model": settings.QWEN_VL_MODEL,
            }

            response = httpx.post(
                f"{settings.NLP_ENGINE_URL}/internal/evaluate",
                json=payload,
                timeout=120.0,
            )
            response.raise_for_status()
            result = response.json()

            # Persist results
            paper.ocr_transcript = result["ocr_transcript"]
            paper.ocr_confidence = result["ocr_confidence"]
            paper.word_count = result["word_count"]
            paper.total_score = result["score"]
            paper.diagnostic_logs = result["diagnostics"]
            paper.processing_status = "completed"
            paper.evaluated_at = result["evaluated_at"]
            db.commit()

            return {"status": "completed", "paper_id": paper_id}

    except Exception as exc:
        with SyncSessionFactory() as db:
            paper = db.query(StudentPaper).filter_by(paper_id=paper_id).first()
            if paper:
                paper.processing_status = "failed"
                db.commit()
        raise self.retry(exc=exc)
```

---

## 10. Alibaba Cloud OSS Integration

### 10.1 Bucket Structure

```
scriptgrade-scans/
├── exams/
│   └── {exam_id}/
│       ├── mobile/
│       │   └── {student_id}/
│       │       └── scan_{timestamp}.jpg
│       ├── web/
│       │   └── {student_id}/
│       │       └── upload_{timestamp}.pdf
│       └── batch/
│           └── {batch_id}/
│               └── {student_id}.pdf
├── question_papers/
│   └── {exam_id}/
│       ├── question_{timestamp}.pdf
│       └── sample_answer_{timestamp}.pdf
└── exports/
    └── {user_id}/
        └── {exam_id}/
            ├── report.csv
            └── report.pdf
```

### 10.2 OSS Client Implementation

```python
# app/services/oss_client.py
import oss2
from app.core.config import settings

auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
bucket = oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET_NAME)

async def upload_to_oss(key: str, data: bytes, content_type: str) -> str:
    """Upload raw bytes to OSS and return the object URL."""
    headers = {"Content-Type": content_type}
    bucket.put_object(key, data, headers=headers)
    return f"https://{settings.OSS_BUCKET_NAME}.{settings.OSS_ENDPOINT}/{key}"

def generate_presigned_url(key: str, ttl_seconds: int = 900) -> str:
    """Generate a time-limited presigned download URL for NLP engine access."""
    return bucket.sign_url("GET", key, ttl_seconds)

async def delete_from_oss(key: str) -> None:
    """Hard-delete an object from OSS (GDPR / data retention policy)."""
    bucket.delete_object(key)

def stream_object(key: str):
    """Return an iterator for streaming large exports to the HTTP response."""
    return bucket.get_object(key)
```

### 10.3 OSS Lifecycle Policy

| Prefix | Retention | Action |
|---|---|---|
| `exams/*/mobile/*` | 365 days | Transition to IA storage after 30 days; delete after 365 |
| `exams/*/web/*` | 365 days | Transition to IA storage after 30 days; delete after 365 |
| `exports/*` | 7 days | Hard delete after 7 days |
| `question_papers/*` | Indefinite | No expiry; teacher-controlled deletion |

---

## 11. Celery Async Worker Configuration

### 11.1 Task Registry

| Task Name | Queue | Timeout | Retries | Triggered By |
|---|---|---|---|---|
| `evaluate_paper` | `evaluation` | 120s | 3 | `POST /papers/upload` |
| `split_and_evaluate_batch` | `batch` | 600s | 2 | `POST /papers/batch-upload` |
| `generate_export` | `export` | 60s | 1 | `GET /analytics/export` |
| `extract_rubric_concepts` | `ai` | 90s | 2 | `POST /exam/setup` |

### 11.2 Worker Configuration

```python
# app/core/celery_config.py
CELERY_CONFIG = {
    "broker_url": settings.REDIS_URL,
    "result_backend": settings.REDIS_URL,
    "task_serializer": "json",
    "result_serializer": "json",
    "accept_content": ["json"],
    "task_track_started": True,
    "task_acks_late": True,
    "worker_prefetch_multiplier": 1,
    "task_routes": {
        "app.services.celery_worker.evaluate_paper": {"queue": "evaluation"},
        "app.services.celery_worker.split_and_evaluate_batch": {"queue": "batch"},
        "app.services.celery_worker.generate_export": {"queue": "export"},
        "app.services.celery_worker.extract_rubric_concepts": {"queue": "ai"},
    },
    "task_soft_time_limit": 110,
    "task_time_limit": 130,
}
```

Start workers per queue for resource isolation:

```bash
# Evaluation worker (high priority)
celery -A app.services.celery_worker worker -Q evaluation --concurrency=4 --loglevel=info

# Batch worker (lower priority, higher concurrency)
celery -A app.services.celery_worker worker -Q batch --concurrency=2 --loglevel=info

# Export + AI workers
celery -A app.services.celery_worker worker -Q export,ai --concurrency=2 --loglevel=info
```

---

## 12. JWT Authentication & Multi-Tenant Security

### 12.1 Token Structure

```python
# JWT Payload
{
    "sub": "3fa85f64-5717-4562-b3fc-2c963f66afa6",   # user_id
    "email": "teacher@school.edu.pk",
    "role": "teacher",
    "institution": "National University",
    "iat": 1724076000,
    "exp": 1724079600
}
```

### 12.2 Token Lifecycle

| Setting | Value |
|---|---|
| Algorithm | `HS256` |
| Access token TTL | 60 minutes |
| Secret minimum length | 32 characters |
| Refresh tokens | Not implemented in v1 (stateless design) |

### 12.3 Multi-Tenant Isolation Rules

Every database query on `exams`, `rubrics`, and `student_papers` must include a `user_id` filter derived from the JWT claim. No cross-tenant data access is possible at the query level:

```python
# Correct — tenant-scoped query
async def get_exam(db: AsyncSession, exam_id: UUID, user_id: UUID) -> Exam | None:
    result = await db.execute(
        select(Exam).where(Exam.exam_id == exam_id, Exam.user_id == user_id)
    )
    return result.scalar_one_or_none()

# Wrong — never query without user_id scope on tenant tables
async def get_exam_unsafe(db: AsyncSession, exam_id: UUID) -> Exam | None:
    result = await db.execute(select(Exam).where(Exam.exam_id == exam_id))
    return result.scalar_one_or_none()
```

---

## 13. 8-Debugger Diagnostic JSON Schema

The following is the canonical `diagnostic_logs` JSONB structure stored in `student_papers` and returned by `GET /api/v1/papers/{student_id}`. This schema is the integration contract between the NLP engine (Musa) and the API layer (Ishmal).

```json
{
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
      { "student_token": "solar energy",  "rubric_concept": "Sunlight",    "similarity_score": 0.94 },
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
      { "label": "Chloroplast",        "bounding_box": [112, 88, 240, 195], "confidence": 93.1 },
      { "label": "Arrow: CO2 → Leaf",  "bounding_box": [300, 140, 410, 160], "confidence": 89.5 }
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
}
```

---

## 14. Error Handling & Response Standards

### 14.1 HTTP Status Code Usage

| Status | Meaning | Usage |
|---|---|---|
| `200 OK` | Success | Successful GET, PUT |
| `201 Created` | Resource created | Successful POST with new resource |
| `202 Accepted` | Job queued | Paper upload accepted for async processing |
| `400 Bad Request` | Malformed request | Missing required fields, invalid UUID |
| `401 Unauthorized` | Authentication failed | Expired or invalid JWT |
| `403 Forbidden` | Authorization failed | Valid JWT but accessing another tenant's resource |
| `404 Not Found` | Resource missing | Paper, exam, or rubric not found for this user |
| `409 Conflict` | Duplicate resource | Student ID already submitted for this exam |
| `413 Payload Too Large` | File size exceeded | File exceeds channel size limit |
| `415 Unsupported Media Type` | Bad MIME type | Non-image/PDF file uploaded |
| `422 Unprocessable Entity` | Validation error | Pydantic model validation failure |
| `500 Internal Server Error` | Unexpected failure | Unhandled exception (logged + alerted) |
| `503 Service Unavailable` | Dependency failure | OSS or NLP engine unreachable |

### 14.2 Standard Error Response Shape

All error responses follow this structure:

```json
{
  "detail": "Human-readable error message.",
  "error_code": "PAPER_NOT_FOUND",
  "timestamp": "2026-08-19T14:32:07.412Z",
  "request_id": "req-abc123"
}
```

### 14.3 Global Exception Handler

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
import uuid

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred. Our team has been notified.",
            "error_code": "INTERNAL_SERVER_ERROR",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": str(uuid.uuid4()),
        },
    )
```

---

## 15. Environment Variables Reference

### `backend/.env`

```env
# ── Application ───────────────────────────────────────────────────────
APP_NAME=ScriptGrade
APP_ENV=development               # development | staging | production
DEBUG=true
LOG_LEVEL=INFO

# ── Alibaba Cloud AI (DashScope) ──────────────────────────────────────
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
QWEN_MODEL=qwen3-8b-max
QWEN_VL_MODEL=qwen-vl-max

# ── NLP Engine (Internal Microservice) ───────────────────────────────
NLP_ENGINE_URL=http://nlp-engine:8001
NLP_ENGINE_TIMEOUT_SECONDS=120

# ── PostgreSQL + pgvector ─────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://scriptgrade_user:password@postgres:5432/scriptgrade
PGVECTOR_ENABLED=true

# ── Alibaba Cloud OSS ─────────────────────────────────────────────────
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET_NAME=scriptgrade-scans
OSS_ENDPOINT=oss-ap-southeast-1.aliyuncs.com
OSS_PRESIGNED_URL_TTL_SECONDS=900

# ── Authentication ────────────────────────────────────────────────────
JWT_SECRET_KEY=your_super_secret_key_minimum_32_characters_long
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# ── Task Queue ────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── CORS ─────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://scriptgrade.app
```

---

## 16. Deployment & Infrastructure

### 16.1 Docker Compose (Full Stack)

```yaml
# docker-compose.yml
version: "3.9"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./backend:/app

  celery-evaluation:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: ./backend/.env
    depends_on: [redis, postgres, backend]
    command: celery -A app.services.celery_worker worker -Q evaluation --concurrency=4 --loglevel=info

  celery-batch:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: ./backend/.env
    depends_on: [redis, postgres, backend]
    command: celery -A app.services.celery_worker worker -Q batch --concurrency=2 --loglevel=info

  celery-support:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: ./backend/.env
    depends_on: [redis, postgres, backend]
    command: celery -A app.services.celery_worker worker -Q export,ai --concurrency=2 --loglevel=info

  flower:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: ./backend/.env
    ports:
      - "5555:5555"
    depends_on: [redis]
    command: celery -A app.services.celery_worker flower --port=5555

  nlp-engine:
    build:
      context: ./nlp-engine
      dockerfile: Dockerfile
    env_file: ./backend/.env
    ports:
      - "8001:8001"
    depends_on: [postgres]

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    env_file: ./frontend/.env

  postgres:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_DB: scriptgrade
      POSTGRES_USER: scriptgrade_user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U scriptgrade_user -d scriptgrade"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### 16.2 Service Access URLs

| Service | URL | Notes |
|---|---|---|
| **FastAPI Backend** | `http://localhost:8000` | Main REST gateway |
| **Swagger API Docs** | `http://localhost:8000/docs` | Interactive endpoint explorer |
| **ReDoc API Docs** | `http://localhost:8000/redoc` | Alternative API documentation |
| **Web Dashboard** | `http://localhost:5173` | React + Tailwind frontend |
| **NLP Engine** | `http://localhost:8001` | Internal only — Musa's service |
| **Celery Flower** | `http://localhost:5555` | Task monitoring dashboard |
| **PostgreSQL** | `localhost:5432` | Direct DB access (dev only) |
| **Redis** | `localhost:6379` | Broker / result backend (dev only) |

### 16.3 Alembic Migration Commands

```bash
# Apply all pending migrations
alembic upgrade head

# Create a new migration after schema changes
alembic revision --autogenerate -m "add_source_column_to_student_papers"

# Rollback one migration
alembic downgrade -1
```

### 16.4 Health Check Endpoint

```python
@app.get("/health", tags=["System"])
async def health_check() -> dict:
    return {
        "status": "healthy",
        "service": "ScriptGrade Backend",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
```

---

<div align="center">

---

### ScriptGrade Backend — Engineered by Ishmal Khalid
#### Alibaba Cloud AI Hackathon — Pakistan 2026

*Central orchestration. Zero compromises. Every paper graded with a traceable audit trail.*

---

</div>
