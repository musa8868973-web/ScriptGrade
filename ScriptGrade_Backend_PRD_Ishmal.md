# **_ScriptGrade – Backend Architecture & Engineering Specification (PRD)_** 

**Event:** Alibaba Cloud AI Hackathon Pakistan 2026 

**Target Architecture:** Microservice / Asynchronous Gateway (FastAPI / Python) 

**Document Purpose:** Complete Database Schemas, REST API Gateway Contracts, Qwen-2.5 / Qwen-VL AI Integration Middleware, and Institutional Data Isolation Protocols. 

## **Developer Assignment & Responsibility Matrix** 

- **Document Assigned To:** Ishmal Khalid (Lead Backend Architect) 

- 

- **Assigned Deliverables:** 

   - Implementation of high-performance FastAPI microservices, async routing, and Celery background workers. 

   - Relational schema engineering and vector embedding setup using Alibaba Cloud AnalyticDB for PostgreSQL (pgvector). 

   - Building API gateway middleware to connect Rohail Khan Shinwari’s Next.js Frontend with Qwen AI / NLP microservices. 

   - Multi-tenant institutional data isolation, JWT authentication, and multipage ADF scanner PDF handling using Alibaba Cloud OSS. 

## **1. Executive Summary & Core Infrastructure** 

The Backend serves as the central orchestration engine for ScriptGrade. It exposes highperformance REST APIs to Rohail's Next.js Frontend, manages persistent relational and vector storage, handles batch document ingestion, and dispatches compute requests to the Qwen-2.5 / Qwen-VL AI layer. 

## **Comprehensive Technology Stack** 

- **Primary Language & Framework:** Python 3.11+ / FastAPI (Asynchronous execution with asyncio & uvicorn) 

- **Primary Database & Vector Store:** Alibaba Cloud AnalyticDB for PostgreSQL (Relational tables + pgvector for semantic embeddings) 

- **Task Queue & Async Ingestion:** Celery / Redis (For asynchronous multi-page PDF processing & OCR pipelines) 

- **Object Storage:** Alibaba Cloud Object Storage Service (OSS) for scanned exam PDFs, student answer sheet images, and exported CSV/PDF reports 

- **Authentication & Security:** OAuth2 with JWT (JSON Web Tokens) & passlib (Bcrypt hashing) 

- **Core AI Engines:** Alibaba Cloud Qwen-2.5 / Qwen-Plus (LLM) & Qwen-VL (VisionLanguage Model) 

## **2. System Architecture & Data Flow** 

Page 1: Auth (/login) ────────► FastAPI Gateway ──► OAuth2 / JWT Middleware 

│ 

Page 2: Dashboard ───────────► AnalyticDB PostgreSQL (Metadata & Results) 

│ 

Page 3: Rubric Setup ────────► Qwen-2.5 AI Engine (Concept & Synonym Extraction) │ 

Page 4: Batch Upload ────────► Celery / Redis Worker ──► Alibaba Cloud OSS (PDF Storage) 

│ 

Page 5: Master Workspace ─────► Qwen-VL Engine (OCR, Diagrams & 8 Diagnostic Debuggers) 

## **3. Database Schema Design (AnalyticDB PostgreSQL) A. users Table (Educators & Admins)** 

- user_id (UUID, Primary Key) 

- full_name (VARCHAR) 

- email (VARCHAR, Unique, Indexed) 

- hashed_password (VARCHAR) 

- institution_name (VARCHAR) 

- role (ENUM: teacher, dept_head, admin) 

- created_at (TIMESTAMP, Default: NOW()) 

## **B. exams Table** 

- exam_id (UUID, Primary Key) 

- user_id (UUID, Foreign Key ➔ users.user_id) 

- title (VARCHAR) -- e.g., "Biology 101 – Term 1" 

- question_paper_url (TEXT) 

- sample_answer_url (TEXT) 

- status (ENUM: draft, processing, completed) 

- created_at (TIMESTAMP, Default: NOW()) 

## **C. rubrics Table** 

- rubric_id (UUID, Primary Key) 

- exam_id (UUID, Foreign Key ➔ exams.exam_id) 

- concepts_json (JSONB) -- Stores magic keywords, custom weights, and synonym clusters 

- ignore_spelling (BOOLEAN, Default: TRUE) -- Levenshtein Distance Threshold 85% (Flaw #4) 

- strict_order (BOOLEAN, Default: FALSE) -- DAG Logic Enforcement (Flaw #5) 

- density_scoring (BOOLEAN, Default: TRUE) -- Anti-Fluff Normalization (Flaw #7) 

## **D. student_papers Table** 

- paper_id (UUID, Primary Key) 

- exam_id (UUID, Foreign Key ➔ exams.exam_id) 

- student_identifier (VARCHAR) -- Roll No / Student Name 

- scanned_image_url (TEXT) 

- ocr_transcript (TEXT) 

- total_score (NUMERIC) 

- max_score (NUMERIC) 

- is_flagged (BOOLEAN, Default: FALSE) 

- diagnostic_logs (JSONB) -- Stores 8 Edge-Case Debugger Metrics (Garbage Text, Negation, Sequence, Diagrams, Length Bias, etc.) 

- teacher_override_score (NUMERIC, Nullable) 

- moderation_note (TEXT, Nullable) 

- evaluated_at (TIMESTAMP) 

## **4. End-to-End REST API Implementation Specifications** 

Ishmal Khalid is responsible for implementing and deploying the following 9 REST API contracts to connect with Rohail's Frontend: 

## **1. POST /api/v1/auth/login (Page 1)** 

- **Purpose:** Authenticates educators and returns JWT bearer session tokens. 

- **Request Body:** { "email": "teacher@school.edu", "password": "secure_password" } 

- **Response (200 OK):** 

JSON 

{ 

"access_token": "jwt_token_string", 

"token_type": "bearer", 

"user": { "full_name": "Rohail Khan", "role": "teacher" } 

} 

## **2. POST /api/v1/auth/signup (Page 1)** 

- **Purpose:** Registers a new educator account and initializes workspace defaults. 

- **Request Body:** { "full_name": "Rohail Khan", "email": "teacher@school.edu", • 

- "institution_name": "National University", "password": "...", "role": "teacher" } 

**Response (201 Created):** { "status": "success", "user_id": "uuid_string" } 

## **3. GET /api/v1/exams/list (Page 2)** 

- **Purpose:** Retrieves dashboard metrics, recent exam logs, and global performance counters. 

- **Headers:** Authorization: Bearer <JWT> 

- **Response (200 OK):** 

JSON 

{ 

"global_metrics": { "total_checked": 1250, "overall_accuracy": 98.4, "hours_saved": 140 }, 

"exams": [ 

{ "exam_id": "uuid", "title": "Biology 101 – Term 1", "date": "2026-08-19", "class_size": 50, "status": "completed", "class_average": 8.2 } 

] 

} 

## **4. POST /api/v1/exam/setup (Page 3)** 

- **Purpose:** Accepts Question Paper and Reference Answer uploads, calls Qwen AI, and returns auto-extracted magic concepts. 

- **Payload:** multipart/form-data (question_file, sample_answer_file, exam_title) 

- **Response (200 OK):** 

JSON 

{ 

"exam_id": "uuid", 

"extracted_concepts": [ 

{ "keyword": "Sunlight", "weight": 3 }, 

{ "keyword": "Chlorophyll", "weight": 3 }, 

{ "keyword": "Glucose", "weight": 2 } 

], 

"synonyms": { "Sunlight": ["solar energy"], "Chlorophyll": ["green pigment"] } } 

## **5. PUT /api/v1/exam/rubric (Page 3)** 

- **Purpose:** Saves teacher-customized magic keywords, weights, synonym clusters, and sensitivity toggles. 

- **Request Body:** 

JSON 

{ 

"exam_id": "uuid", 

"concepts": [ { "keyword": "Sunlight", "weight": 3 } ], 

"ignore_spelling": true, 

"strict_order": false, 

"density_scoring": true 

} 

- **Response (200 OK):** { "status": "updated", "rubric_id": "uuid" } 

## **6. POST /api/v1/papers/batch-upload (Page 4)** 

- **Purpose:** Accepts bulk scanner PDFs or Mobile App sync images, uploads to Alibaba Cloud OSS, and queues Celery evaluation tasks. 

- **Payload:** multipart/form-data (exam_id, batch_pdf_file) 

- **Response (202 Accepted):** { "batch_id": "uuid", "total_papers": 50, "status": "processing" } 

## **7. GET /api/v1/papers/{student_id} (Page 5)** 

- **Purpose:** Fetches complete evaluation breakdown, OCR transcript, and the 8 vulnerability diagnostic debuggers for a student paper.  • **Headers:** Authorization: Bearer <JWT> 

- **Response (200 OK):** 

JSON 

- { 

"student_id": "STU-102", 

"score": 10.0, 

"max_score": 10.0, 

"ocr_confidence": 96.5, 

- "ocr_transcript": "Photosynthesis process uses sunlight and chlorophyll...", 

- "diagnostics": { 

"garbage_text_score": 0.0, 

"negation_detected": false, 

"synonym_matched": true, 

- "spelling_autocorrected": true, 

"sequence_match": true, 

"diagram_verified": true, 

"density_ratio": 88.5, 

"rubric_breakdown": [ { "concept": "Sunlight", "awarded": 3, "max": 3 } ] 

} 

} 

## **8. POST /api/v1/papers/{student_id}/override (Page 5)** 

- **Purpose:** Processes teacher manual score adjustments and recalculates live class performance analytics. 

- **Request Body:** { "new_score": 8.0, "moderation_note": "Diagram visual clarity reverified manually." } 

- **Response (200 OK):** { "status": "override_applied", "updated_score": 8.0 } 

## **9. GET /api/v1/analytics/export?exam_id={id} (Page 5)** 

- **Purpose:** Generates and streams a downloadable class performance report in CSV or PDF format. 

- **Response (200 OK):** Binary file stream (content-type: application/pdf or text/csv). 

