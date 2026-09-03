import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import type {
  AnalyticsSummary,
  ExamSetupResponse,
  ExamsListResponse,
  EvaluationToggles,
  MagicConcept,
  OverrideResponse,
  PaperDetail,
  PaperQueueResponse,
  Role,
  Teacher,
} from "./types";

export const API_BASE_URL = (
  ((import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8000/api/v1")
).replace(/\/+$/, ""); // strip trailing slashes — request paths all start with "/", so a
// trailing slash in the env var would produce "//auth/login" → 404.

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

/** Request interceptor — attach JWT bearer token (PRD §5.1) */
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Response interceptor — backend security contract: 401 / 422 / 500 */
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ detail?: string | { msg: string }[] }>) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(" · ")
          : error.message;

    if (status === 401) {
      useAuthStore.getState().clearToken();
      toast.error("Session expired", { description: "Please sign in again." });
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    } else if (status === 422) {
      toast.error("Validation error (422)", { description: message });
    } else if (status && status >= 500) {
      toast.error("Grading service error (500)", { description: message });
    }
    return Promise.reject(error);
  },
);

/** True when the FastAPI backend is unreachable — UI falls back to demo fixtures. */
export const isOffline = (error: unknown) =>
  axios.isAxiosError(error) && (!error.response || error.code === "ERR_NETWORK");

/**
 * True when live data is unavailable: backend unreachable OR the endpoint is
 * not implemented in the local backend build. Both cases render demo fixtures
 * so the UI stays fully explorable (PRD §5.2 fallback contract).
 */
export const isUnavailable = (error: unknown) =>
  isOffline(error) || (axios.isAxiosError(error) && error.response?.status === 404);

/* ────────────────────────────────────────────────────────────────────────────
 * Backend wire contracts — response shapes exactly as served by FastAPI
 * (Backend PRD §8 endpoint table and §13 8-debugger diagnostic JSONB).
 * ──────────────────────────────────────────────────────────────────────────── */

interface BackendTokenUser {
  user_id: string;
  full_name: string;
  email: string;
  institution_name: string;
  role: string;
}

interface BackendTokenResponse {
  access_token: string;
  token_type: string;
  user: BackendTokenUser;
}

interface BackendSignupResponse {
  status: string;
  user_id: string;
}

interface BackendGlobalMetrics {
  total_checked: number;
  overall_accuracy: number;
  hours_saved: number;
}

interface BackendExamItem {
  exam_id: string;
  title: string;
  date: string;
  class_size: number;
  status: string;
  class_average: number | null;
  created_at: string;
}

interface BackendExamsResponse {
  global_metrics: BackendGlobalMetrics;
  exams: BackendExamItem[];
}

interface BackendConcept {
  keyword: string;
  weight: number;
}

interface BackendExamSetupResponse {
  exam_id: string;
  extracted_concepts: BackendConcept[];
  synonyms: Record<string, string[]>;
}

interface BackendRubricResponse {
  status: string;
  rubric_id: string;
}

export interface BackendBatchUploadResponse {
  batch_id: string;
  total_papers: number;
  status: string;
  /** Auto-assigned papers (id + STU-2026-NNN) for immediate name mapping. */
  papers: { id: string; student_id: string }[];
}

interface BackendOverrideResponse {
  status: string;
  updated_score: number;
}

/** §13 canonical 8-debugger diagnostic JSONB persisted on `diagnostic_logs`. */
interface BackendDiagnostics {
  I_garbage_text?: {
    garbage_text_score?: number;
    flagged?: boolean;
    detail?: string;
  };
  II_negation_detection?: {
    negation_detected?: boolean;
    flagged_tokens?: string[];
    detail?: string;
  };
  III_synonym_match?: {
    synonym_matched?: boolean;
    matched_pairs?: {
      student_token?: string;
      rubric_concept?: string;
      similarity_score?: number;
    }[];
    detail?: string;
  };
  IV_spelling_correction?: {
    spelling_autocorrected?: boolean;
    corrections?: {
      original?: string;
      corrected?: string;
      levenshtein_score?: number;
    }[];
    detail?: string;
  };
  V_sequence_dag?: {
    sequence_match?: boolean;
    expected_order?: string[];
    detected_order?: string[];
    dag_transitions_valid?: boolean;
    detail?: string;
  };
  VI_diagram_visual?: {
    diagram_verified?: boolean;
    visual_confidence?: number;
    detected_elements?: {
      label?: string;
      bounding_box?: number[];
      confidence?: number;
    }[];
    detail?: string;
  };
  VII_density_scorer?: {
    density_ratio?: number;
    valid_keyword_hits?: number;
    total_word_count?: number;
    flagged?: boolean;
    detail?: string;
  };
  VIII_rubric_aggregator?: {
    rubric_breakdown?: {
      concept?: string;
      awarded?: number;
      max?: number;
      match_type?: string;
    }[];
    total_awarded?: number;
    max_possible?: number;
    detail?: string;
  };
}

interface BackendPaperDetailResponse {
  student_id: string;
  student_name?: string | null;
  paper_id: string;
  exam_id: string;
  score: number | null;
  max_score: number | null;
  status: string;
  ocr_confidence: number | null;
  ocr_transcript: string | null;
  word_count: number | null;
  evaluated_at: string | null;
  is_flagged: boolean;
  diagnostics: BackendDiagnostics;
  teacher_override: {
    applied?: boolean;
    override_score?: number | null;
    moderation_note?: string | null;
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Contract adapters — map backend wire shapes onto the UI domain models so
 * components, stores and demo fixtures stay byte-for-byte unchanged.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Engine constants surfaced by the debugger cards (NLP PRD / evaluation.py). */
const GARBAGE_FLAG_THRESHOLD = 0.65; // fraction of irrelevant sentences before flag
const SPELLING_SIMILARITY_FLOOR = 0.85; // PRD Flaw #4 — Levenshtein similarity floor
const DENSITY_FLOOR_PCT = 30.0; // PRD Algorithm I — anti-fluff density floor
const NEGATION_MARKERS = ["not", "never", "fails to", "without", "lack of"]; // NLP PRD §4

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const bool = (v: unknown): boolean => v === true;
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const toBBox = (raw: unknown): [number, number, number, number] => {
  const arr = list(raw).map((n) => num(n));
  return [arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0, arr[3] ?? 0];
};

/**
 * Frontend PRD §3 and backend UserRole declare different role enums; bridge
 * equivalent privilege tiers (exam_controller ↔ admin — the institutional
 * oversight tier; department_head ↔ dept_head — exact).
 */
const UI_ROLE_MAP: Record<string, Role | undefined> = {
  teacher: "teacher",
  dept_head: "department_head",
  admin: "exam_controller",
};

const BACKEND_ROLE_MAP: Record<Role, string> = {
  teacher: "teacher",
  department_head: "dept_head",
  exam_controller: "admin",
};

/** Backend PaperStatus enum → PRD §1.3 UI lifecycle states. */
const PAPER_STATUS_MAP: Record<string, PaperDetail["status"]> = {
  queued: "queued",
  processing: "ocr_in_progress",
  evaluated: "evaluated",
  failed: "needs_review", // failed evaluations surface for teacher attention
};

const mapTokenResponse = (d: BackendTokenResponse): { access_token: string; teacher: Teacher } => {
  const role = UI_ROLE_MAP[d.user.role];
  return {
    access_token: d.access_token,
    teacher: {
      id: String(d.user.user_id),
      name: d.user.full_name,
      institution: d.user.institution_name,
      email: d.user.email,
      ...(role ? { role } : {}),
    },
  };
};

const mapExamsList = (d: BackendExamsResponse): ExamsListResponse => ({
  metrics: {
    total_exams: d.global_metrics.total_checked,
    accuracy_pct: d.global_metrics.overall_accuracy,
    hours_saved: d.global_metrics.hours_saved,
  },
  exams: d.exams.map((e) => ({
    id: String(e.exam_id),
    name: e.title,
    created_at: e.created_at,
    paper_count: e.class_size,
    status: e.status as ExamsListResponse["exams"][number]["status"],
    avg_score: e.class_average,
    // Backend PRD §8.3 omits max_score; rubric weights cap at 10 pts/concept,
    // so the dashboard % denominator follows the demo convention.
    max_score: 10,
  })),
});

const mapExamSetup = (d: BackendExamSetupResponse): ExamSetupResponse => ({
  exam_id: String(d.exam_id),
  concepts: d.extracted_concepts.map((c) => ({
    keyword: c.keyword,
    points: c.weight,
    synonyms: d.synonyms[c.keyword] ?? [],
  })),
});

/** §13 diagnostic JSONB → the 8-debugger UI payload (defensive defaults). */
const mapDiagnostics = (diag: BackendDiagnostics): PaperDetail["debuggers"] => {
  const garbage = diag.I_garbage_text ?? {};
  const negation = diag.II_negation_detection ?? {};
  const synonym = diag.III_synonym_match ?? {};
  const spelling = diag.IV_spelling_correction ?? {};
  const sequence = diag.V_sequence_dag ?? {};
  const vision = diag.VI_diagram_visual ?? {};
  const density = diag.VII_density_scorer ?? {};
  const aggregator = diag.VIII_rubric_aggregator ?? {};

  const expectedOrder = list(sequence.expected_order)
    .map((k) => str(k))
    .filter(Boolean);
  const detectedOrder = list(sequence.detected_order)
    .map((k) => str(k))
    .filter(Boolean);
  const expectedIndex = new Map(expectedOrder.map((keyword, i) => [keyword, i]));
  let transitionsValidated = 0;
  for (let i = 0; i < detectedOrder.length - 1; i++) {
    const current = detectedOrder[i];
    const next = detectedOrder[i + 1];
    if (current === undefined || next === undefined) continue;
    const a = expectedIndex.get(current);
    const b = expectedIndex.get(next);
    if (a !== undefined && b !== undefined && a <= b) transitionsValidated++;
  }
  const strictOrderMatch = /Strict order toggle:\s*(ENABLED|DISABLED)/i.exec(str(sequence.detail));
  const sentenceCountMatch = /(\d+)\/(\d+)\s+sentences/.exec(str(garbage.detail));

  const flaggedTokens = list(negation.flagged_tokens)
    .map((t) => str(t))
    .filter(Boolean);

  return {
    garbage: {
      flagged: bool(garbage.flagged),
      relevance_score: num(garbage.garbage_text_score),
      threshold: GARBAGE_FLAG_THRESHOLD,
      sentences_scanned: sentenceCountMatch ? Number(sentenceCountMatch[2]) : 0,
      notes: str(garbage.detail),
    },
    negation: {
      flagged: bool(negation.negation_detected),
      negation_tokens_bound: flaggedTokens.length,
      tokens_scanned: NEGATION_MARKERS,
      flagged_phrases: flaggedTokens.map((token) => ({ phrase: token, concept: token })),
    },
    synonym: {
      resolved: list(synonym.matched_pairs).length,
      method: "semantic similarity search",
      matches: list(synonym.matched_pairs).map((m) => {
        const pair = m as {
          student_token?: string;
          rubric_concept?: string;
          similarity_score?: number;
        };
        return {
          student_token: str(pair.student_token),
          rubric_concept: str(pair.rubric_concept),
          similarity: num(pair.similarity_score),
        };
      }),
    },
    spelling: {
      corrections_applied: list(spelling.corrections).length,
      threshold: SPELLING_SIMILARITY_FLOOR,
      corrections: list(spelling.corrections).map((c) => {
        const item = c as { original?: string; corrected?: string; levenshtein_score?: number };
        return {
          original: str(item.original),
          corrected: str(item.corrected),
          levenshtein: num(item.levenshtein_score),
        };
      }),
    },
    sequence: {
      correct_order: bool(sequence.sequence_match),
      strict_order_enabled: strictOrderMatch?.[1]?.toUpperCase() === "ENABLED",
      transitions_validated: transitionsValidated,
      transitions_expected: Math.max(0, expectedOrder.length - 1),
      steps: expectedOrder.map((label) => ({
        label,
        detected: detectedOrder.includes(label),
      })),
    },
    vision: {
      verified: bool(vision.diagram_verified),
      confidence: num(vision.visual_confidence),
      detected_elements: list(vision.detected_elements).map((e) => {
        const element = e as { label?: string; bounding_box?: number[]; confidence?: number };
        return {
          label: str(element.label),
          bbox: toBBox(element.bounding_box),
          confidence: num(element.confidence),
        };
      }),
      image_width: 620, // backend omits source dims; demo viewer convention
      image_height: 420,
    },
    density: {
      flagged: bool(density.flagged),
      density_ratio: num(density.density_ratio),
      threshold: DENSITY_FLOOR_PCT,
      valid_keyword_hits: num(density.valid_keyword_hits),
      total_word_count: num(density.total_word_count),
      raw_ratio: num(density.density_ratio),
    },
    aggregator: {
      total_awarded: num(aggregator.total_awarded),
      total_max: num(aggregator.max_possible),
      rows: list(aggregator.rubric_breakdown).map((r) => {
        const item = r as { concept?: string; awarded?: number; max?: number; match_type?: string };
        const matchType = str(item.match_type);
        const type =
          matchType === "exact" ||
          matchType === "synonym" ||
          matchType === "fuzzy" ||
          matchType === "vision"
            ? matchType
            : "missed";
        return {
          concept: str(item.concept),
          award: num(item.awarded),
          max: num(item.max),
          match_type: type as PaperDetail["debuggers"]["aggregator"]["rows"][number]["match_type"],
        };
      }),
    },
  };
};

const mapPaperDetail = (d: BackendPaperDetailResponse): PaperDetail => {
  const debuggers = mapDiagnostics(d.diagnostics);
  return {
    student_id: d.student_id,
    student_name: d.student_name ?? null,
    exam_id: String(d.exam_id),
    status: PAPER_STATUS_MAP[d.status] ?? "evaluated",
    score: d.score ?? 0,
    max_score: d.max_score ?? 0,
    ocr_confidence: d.ocr_confidence ?? 0,
    word_count: d.word_count ?? 0,
    density_ratio: debuggers.density.density_ratio,
    language: "en",
    source: "web_dashboard",
    scan_url: "", // backend PRD §8.5 has no scan URL — offline viewer placeholder
    ocr_text: d.ocr_transcript ?? "",
    moderation_note: d.teacher_override?.moderation_note ?? null,
    debuggers,
  };
};

/** Backend requires `sample_answer_file`; the UI treats Model Solution as optional. */
const deriveExamTitle = (fileName: string): string => {
  const candidate = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
  return candidate.length >= 2 ? candidate : "Untitled Exam";
};

/* ────────────────────────────────────────────────────────────────────────────
 * API surface — every call resolves to the FastAPI contract and returns the
 * UI domain shape via the adapters above (PRD §5.2 surface table).
 * ──────────────────────────────────────────────────────────────────────────── */

export const authApi = {
  login: async (payload: { email: string; password: string }) => {
    const res = await api.post<BackendTokenResponse>("/auth/login", payload);
    return { ...res, data: mapTokenResponse(res.data) };
  },
  /** Backend §8.1 returns {status, user_id} with no token → auto-login (PRD §5.2). */
  signup: async (payload: {
    full_name: string;
    email: string;
    institution: string;
    role: string;
    password: string;
  }) => {
    await api.post<BackendSignupResponse>("/auth/signup", {
      full_name: payload.full_name,
      email: payload.email,
      institution_name: payload.institution,
      role: BACKEND_ROLE_MAP[payload.role as Role] ?? "teacher",
      password: payload.password,
    });
    return authApi.login({ email: payload.email, password: payload.password });
  },
};

export const examApi = {
  list: async () => {
    const res = await api.get<BackendExamsResponse>("/exams/list");
    return { ...res, data: mapExamsList(res.data) };
  },
  setup: async (form: FormData) => {
    const rebuilt = new FormData();
    const question = form.get("question_file");
    if (!(question instanceof File)) throw new Error("question_file missing from upload form");
    rebuilt.append("exam_title", deriveExamTitle(question.name));
    rebuilt.append("question_file", question, question.name);
    const answer = form.get("answer_file");
    // Backend requires sample_answer_file; fall back to the question file so the
    // single-file upload flow still extracts a rubric.
    const sample = answer instanceof File ? answer : question;
    rebuilt.append("sample_answer_file", sample, sample.name);
    const res = await api.post<BackendExamSetupResponse>("/exam/setup", rebuilt, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { ...res, data: mapExamSetup(res.data) };
  },
  saveRubric: async (payload: {
    exam_id: string;
    concepts: MagicConcept[];
    toggles: EvaluationToggles;
  }) => {
    const res = await api.put<BackendRubricResponse>("/exam/rubric", {
      exam_id: payload.exam_id,
      concepts: payload.concepts.map((c) => ({ keyword: c.keyword, weight: c.points })),
      ignore_spelling: payload.toggles.spelling_correction,
      strict_order: payload.toggles.strict_dag_order,
      density_scoring: payload.toggles.density_scoring,
    });
    return { ...res, data: { exam_id: payload.exam_id, saved: true } };
  },
};

export const paperApi = {
  batchUpload: (files: File[], examId: string, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("exam_id", examId);
    form.append("source", "web_dashboard");
    return api.post<BackendBatchUploadResponse>("/papers/batch-upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded / (e.total ?? e.loaded)) * 100)),
    });
  },
  queue: (examId: string) =>
    api.get<PaperQueueResponse>("/papers/queue", { params: { exam_id: examId } }),
  /** Persist the teacher's ID↔name mapping (workflow spec §2b). Accepts the
   * paper UUID returned by batch-upload or the auto-assigned STU identifier.
   * ``examId`` disambiguates STU-2026-NNN ids that recur across exams. */
  setIdentity: (studentId: string, studentName: string, examId?: string) =>
    api.patch<{ status: string; paper_id: string; student_id: string; student_name: string }>(
      `/papers/${encodeURIComponent(studentId)}/identity`,
      { student_name: studentName },
      examId ? { params: { exam_id: examId } } : undefined,
    ),
  detail: async (studentId: string, examId?: string) => {
    const res = await api.get<BackendPaperDetailResponse>(
      `/papers/${encodeURIComponent(studentId)}`,
      examId ? { params: { exam_id: examId } } : undefined,
    );
    return { ...res, data: mapPaperDetail(res.data) };
  },
  override: async (
    studentId: string,
    payload: { override_score: number; moderation_note: string },
    examId?: string,
  ) => {
    const res = await api.post<BackendOverrideResponse>(
      `/papers/${encodeURIComponent(studentId)}/override`,
      {
        new_score: payload.override_score,
        moderation_note: payload.moderation_note,
      },
      examId ? { params: { exam_id: examId } } : undefined,
    );
    return {
      ...res,
      data: {
        applied: res.data.status === "override_applied",
        final_score: res.data.updated_score,
      },
    };
  },
};

export const analyticsApi = {
  /** Chart-ready aggregates for the single-subject Analytics view. */
  summary: (examId: string) =>
    api.get<AnalyticsSummary>("/analytics/summary", { params: { exam_id: examId } }),
  exportUrl: (examId: string, format: "csv" | "pdf") =>
    `${API_BASE_URL}/analytics/export?exam_id=${encodeURIComponent(examId)}&format=${format}`,
  /** Authenticated binary download; returns the server-provided filename. */
  download: async (examId: string, format: "csv" | "pdf"): Promise<string> => {
    const token = useAuthStore.getState().token;
    const res = await fetch(analyticsApi.exportUrl(examId, format), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const filename = match?.[1] ?? `scriptgrade_report_${examId}.${format}`;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return filename;
  },
};
