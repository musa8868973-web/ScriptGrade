/**
 * API contract types — mirrors backend/app/schemas/ exactly (frozen v2.1.0).
 *
 * Sources of truth:
 *  - backend/app/schemas/auth.py   (TokenResponse / TokenUser)
 *  - backend/app/schemas/exam.py   (ExamSetupResponse / DashboardResponse)
 *  - backend/app/schemas/paper.py  (PaperUploadResponse / PaperDetailResponse)
 *  - backend/app/core/errors.py    (standardized error envelope)
 */

export type IngestionSource = 'mobile' | 'web_dashboard';
export type ScriptLanguage = 'en' | 'ur' | 'sd' | 'pa';
export type PaperStatus = 'queued' | 'processing' | 'evaluated' | 'failed';
export type ExamStatus = 'draft' | 'processing' | 'completed';
export type UserRole = 'teacher' | 'dept_head' | 'admin';

// ---------------------------------------------------------------------------
// Auth — POST /api/v1/auth/login
// ---------------------------------------------------------------------------
export interface TokenUser {
  user_id: string;
  full_name: string;
  email: string;
  institution_name: string;
  role: UserRole;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: TokenUser;
}

// ---------------------------------------------------------------------------
// Exam setup — POST /api/v1/exam/setup (multipart: exam_title, question_file,
// sample_answer_file)
// ---------------------------------------------------------------------------
export interface ConceptItem {
  keyword: string;
  weight: number;
}

export interface ExamSetupResponse {
  exam_id: string;
  extracted_concepts: ConceptItem[];
  synonyms: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Dashboard — GET /api/v1/exams/list (used for the student-scan exam picker)
// ---------------------------------------------------------------------------
export interface GlobalMetrics {
  total_checked: number;
  overall_accuracy: number;
  hours_saved: number;
}

export interface ExamListItem {
  exam_id: string;
  title: string;
  date: string;
  class_size: number;
  status: ExamStatus;
  class_average: number | null;
  created_at: string;
}

export interface DashboardResponse {
  global_metrics: GlobalMetrics;
  exams: ExamListItem[];
}

// ---------------------------------------------------------------------------
// Paper ingestion — POST /api/v1/papers/upload → 202 Accepted
// ---------------------------------------------------------------------------
export interface PaperUploadResponse {
  job_id: string;
  paper_id: string;
  status: string;
  source: IngestionSource;
  language: ScriptLanguage;
  oss_key: string;
  estimated_completion_seconds: number;
}

// ---------------------------------------------------------------------------
// 8-Debugger diagnostics — GET /api/v1/papers/{student_id}
// (README §7 "Live Diagnostic JSON" — the exact NLP-engine contract)
// ---------------------------------------------------------------------------
export interface DiagnosticMatchedPair {
  student_token: string;
  rubric_concept: string;
  similarity_score: number;
}

export interface DiagnosticSpellingCorrection {
  original: string;
  corrected: string;
  levenshtein_score: number;
}

export interface DiagnosticVisualElement {
  label: string;
  bounding_box: number[];
  confidence: number;
}

export type MatchType = 'exact' | 'synonym' | 'fuzzy' | 'none';

export interface RubricBreakdownItem {
  concept: string;
  awarded: number;
  max: number;
  match_type: MatchType;
}

export interface GarbageTextDiagnostics {
  garbage_text_score: number;
  flagged: boolean;
  detail: string;
}

export interface NegationDiagnostics {
  negation_detected: boolean;
  flagged_tokens: unknown[];
  detail: string;
}

export interface SynonymMatchDiagnostics {
  synonym_matched: boolean;
  matched_pairs: DiagnosticMatchedPair[];
  detail: string;
}

export interface SpellingCorrectionDiagnostics {
  spelling_autocorrected: boolean;
  corrections: DiagnosticSpellingCorrection[];
  detail: string;
}

export interface SequenceDAGDiagnostics {
  sequence_match: boolean;
  expected_order: string[];
  detected_order: string[];
  dag_transitions_valid: boolean;
  detail: string;
}

export interface DiagramVisualDiagnostics {
  diagram_verified: boolean;
  visual_confidence: number | null;
  detected_elements: DiagnosticVisualElement[];
  detail: string;
}

export interface DensityScorerDiagnostics {
  density_ratio: number;
  valid_keyword_hits: number;
  total_word_count: number;
  flagged: boolean;
  detail: string;
}

export interface RubricAggregatorDiagnostics {
  rubric_breakdown: RubricBreakdownItem[];
  total_awarded: number;
  max_possible: number;
  detail: string;
}

export interface DiagnosticsPayload {
  I_garbage_text: GarbageTextDiagnostics;
  II_negation_detection: NegationDiagnostics;
  III_synonym_match: SynonymMatchDiagnostics;
  IV_spelling_correction: SpellingCorrectionDiagnostics;
  V_sequence_dag: SequenceDAGDiagnostics;
  VI_diagram_visual: DiagramVisualDiagnostics;
  VII_density_scorer: DensityScorerDiagnostics;
  VIII_rubric_aggregator: RubricAggregatorDiagnostics;
  /** Failure envelopes may carry extra keys (backend marks them extra=allow). */
  [key: string]: unknown;
}

export interface TeacherOverrideState {
  applied: boolean;
  override_score: number | null;
  moderation_note: string | null;
}

export interface PaperDetailResponse {
  student_id: string;
  paper_id: string;
  exam_id: string;
  ingestion_source: string;
  language_detected: string | null;
  processing_status: PaperStatus | null;
  score: number | null;
  max_score: number | null;
  status: string;
  ocr_confidence: number | null;
  ocr_transcript: string | null;
  word_count: number | null;
  evaluated_at: string | null;
  is_flagged: boolean;
  diagnostics: DiagnosticsPayload;
  teacher_override: TeacherOverrideState;
}

// ---------------------------------------------------------------------------
// Standardized backend error envelope (app/core/errors.py)
// ---------------------------------------------------------------------------
export interface ApiFieldError {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    request_id?: string;
    fields?: ApiFieldError[];
  };
}
