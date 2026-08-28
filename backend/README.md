# ScriptGrade — Backend Microservice

Production FastAPI gateway for the ScriptGrade multi-modal handwritten script
evaluation platform (Alibaba Cloud AI Hackathon Pakistan 2026).

- **Stack:** Python 3.11+, FastAPI (asyncio/uvicorn), SQLAlchemy 2.0 Async,
  Pydantic v2, PyJWT, passlib (bcrypt), Celery + Redis, Alembic.
- **Database:** Alibaba Cloud AnalyticDB for PostgreSQL (relational + pgvector).
- **Object storage:** Alibaba Cloud OSS (local filesystem fallback when
  credentials are absent).
- **AI:** Alibaba Cloud DashScope — Qwen-2.5 / Qwen-Plus (rubric extraction)
  and Qwen-VL (handwritten OCR + diagram inspection).

## Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, /api/v1 mount, /health
│   ├── config.py            # Pydantic Settings (env-driven)
│   ├── database.py          # Async engine/session (asyncpg)
│   ├── celery_app.py        # Celery instance (Redis broker)
│   ├── api/v1/              # auth, exams, papers, analytics routers
│   ├── models/              # users, exams, rubrics, student_papers, batch_uploads
│   ├── schemas/             # Pydantic v2 request/response contracts
│   ├── services/            # OSS, DashScope AI, rubric, batch, evaluation, export
│   ├── workers/             # Celery tasks + sync DB session
│   ├── core/                # JWT security, dependencies, role guards
│   └── utils/               # PDF split/extract, PDF report rendering
├── alembic/                 # DB migrations (AnalyticDB PostgreSQL)
├── requirements.txt
└── .env.example
```

## REST Contracts (all under `/api/v1`)

| # | Endpoint | Method | Purpose |
|---|---|---|---|
| 1 | `/auth/signup` | POST | Register educator + workspace |
| 2 | `/auth/login` | POST | JWT bearer token (JSON or OAuth2 form) |
| 3 | `/exams/list` | GET | Dashboard metrics + exam logs |
| 4 | `/exam/setup` | POST | Upload Q&A → Qwen-2.5 rubric extraction |
| 5 | `/exam/rubric` | PUT | Save keywords, weights, sensitivity toggles |
| 6 | `/papers/batch-upload` | POST | 202 + batch_id, async Celery evaluation |
| 7 | `/papers/{student_id}` | GET | Evaluation breakdown + 8-debugger diagnostics |
| 8 | `/papers/{student_id}/override` | POST | Teacher score override + note |
| 9 | `/analytics/export?exam_id=…&format=csv|pdf` | GET | Downloadable class report |

## Quickstart

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # then fill in DATABASE_URL, JWT_SECRET_KEY, Redis, OSS, Qwen keys

# Schema (choose one)
alembic upgrade head                 # migrations
# ...or rely on idempotent create_all at app startup

# Gateway
uvicorn app.main:app --reload --port 8000

# Worker (separate terminal)
celery -A app.celery_app.celery worker --loglevel=info
```

Swagger UI: `http://localhost:8000/docs` · Health: `GET /health`.

## Multi-tenant isolation

Every resource is scoped to `users.user_id`. Teachers only see their own
exams/papers; `dept_head` and `admin` roles may inspect across educators
(enforced centrally in `app/core/deps.py::get_owned_exam`).

## Evaluation pipeline (Celery)

`POST /papers/batch-upload` → PDF pages split → each page stored in OSS →
one `scriptgrade.process_paper` task per paper → Qwen-VL OCR (with text-layer
fallback) → 8-debugger evaluation engine (`app/services/evaluation.py`) →
scores + `diagnostic_logs` JSONB persisted → batch/exam lifecycle advanced.
