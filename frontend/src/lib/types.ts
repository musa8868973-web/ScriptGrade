/**
 * ScriptGrade domain types — traced to Frontend PRD §1.3, §3, §5.2
 * and System README §7 (8-Debugger evaluation payload).
 */

export type Role = "teacher" | "department_head" | "exam_controller";

export interface Teacher {
  id: string;
  name: string;
  institution: string;
  email?: string;
  role?: Role;
}

/** PRD §1.3 — Paper lifecycle state machine */
export type PaperStatus =
  | "uploaded"
  | "queued"
  | "ocr_in_progress"
  | "flagged"
  | "evaluated"
  | "needs_review"
  | "scored"
  | "override_applied"
  | "finalized"
  | "exported";

export const TERMINAL_QUEUE_STATES: PaperStatus[] = [
  "evaluated",
  "needs_review",
  "scored",
  "override_applied",
  "finalized",
  "exported",
];

export type ExamStatus = "completed" | "processing" | "needs_review" | "draft";

export type PaperSource = "mobile" | "web_dashboard";

/** ISO codes used by the language detector — en + RTL scripts */
export type LanguageCode = "en" | "ur" | "sd" | "pa";
export const RTL_LANGUAGES: LanguageCode[] = ["ur", "sd", "pa"];

export interface Exam {
  id: string;
  name: string;
  created_at: string;
  paper_count: number;
  status: ExamStatus;
  avg_score: number | null;
  max_score: number;
}

export interface DashboardMetrics {
  total_exams: number;
  accuracy_pct: number;
  hours_saved: number;
}

export interface ExamsListResponse {
  exams: Exam[];
  metrics: DashboardMetrics;
}

export interface MagicConcept {
  id: string;
  keyword: string;
  points: number;
  synonyms: string[];
}

export interface EvaluationToggles {
  spelling_correction: boolean;
  strict_dag_order: boolean;
  density_scoring: boolean;
}

export interface ExamSetupResponse {
  exam_id: string;
  concepts: Omit<MagicConcept, "id">[];
}

export interface QueuePaper {
  id: string;
  student_id: string;
  source: PaperSource;
  language: LanguageCode;
  status: PaperStatus;
  score: number | null;
  max_score: number;
}

export interface PaperQueueResponse {
  exam_id: string;
  papers: QueuePaper[];
}

/* ── 8-Debugger payload (README §7) ─────────────────────────── */

export interface GarbageDebug {
  flagged: boolean;
  relevance_score: number;
  threshold: number;
  sentences_scanned: number;
  notes: string;
}

export interface NegationDebug {
  flagged: boolean;
  negation_tokens_bound: number;
  tokens_scanned: string[];
  flagged_phrases: { phrase: string; concept: string }[];
}

export interface SynonymDebug {
  resolved: number;
  method: string;
  matches: { student_token: string; rubric_concept: string; similarity: number }[];
}

export interface SpellingDebug {
  corrections_applied: number;
  threshold: number;
  corrections: { original: string; corrected: string; levenshtein: number }[];
}

export interface SequenceDebug {
  correct_order: boolean;
  strict_order_enabled: boolean;
  transitions_validated: number;
  transitions_expected: number;
  steps: { label: string; detected: boolean }[];
}

export interface VisionDebug {
  verified: boolean;
  confidence: number;
  detected_elements: {
    label: string;
    /** [x1, y1, x2, y2] in source-image pixel space */
    bbox: [number, number, number, number];
    confidence: number;
  }[];
  image_width: number;
  image_height: number;
}

export interface DensityDebug {
  flagged: boolean;
  density_ratio: number;
  threshold: number;
  valid_keyword_hits: number;
  total_word_count: number;
  raw_ratio: number;
}

export interface AggregatorDebug {
  total_awarded: number;
  total_max: number;
  rows: {
    concept: string;
    award: number;
    max: number;
    match_type: "exact" | "synonym" | "fuzzy" | "vision" | "missed";
  }[];
}

export interface PaperDetail {
  student_id: string;
  exam_id: string;
  status: PaperStatus;
  score: number;
  max_score: number;
  ocr_confidence: number;
  word_count: number;
  density_ratio: number;
  language: LanguageCode;
  source: PaperSource;
  scan_url: string;
  ocr_text: string;
  moderation_note?: string | null;
  debuggers: {
    garbage: GarbageDebug;
    negation: NegationDebug;
    synonym: SynonymDebug;
    spelling: SpellingDebug;
    sequence: SequenceDebug;
    vision: VisionDebug;
    density: DensityDebug;
    aggregator: AggregatorDebug;
  };
}

export interface OverrideResponse {
  applied: boolean;
  final_score: number;
}

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: "EN English",
  ur: "اردو Urdu",
  sd: "سنڌي Sindhi",
  pa: "پنجابی Punjabi",
};
