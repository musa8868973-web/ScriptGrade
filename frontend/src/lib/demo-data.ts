/**
 * Demo fixtures. Used ONLY when the FastAPI backend at VITE_API_BASE_URL
 * is unreachable, so the dashboard stays fully explorable offline.
 * Shapes mirror the API contracts in PRD §5.2 exactly.
 */
import type {
  AnalyticsSummary,
  Exam,
  ExamsListResponse,
  MagicConcept,
  PaperDetail,
  PaperQueueResponse,
  QueuePaper,
} from "./types";

export const DEMO_EXAM_ID = "exam_bio101";

export const demoExams: Exam[] = [
  {
    id: DEMO_EXAM_ID,
    name: "Biology 101 — Photosynthesis",
    created_at: "2026-08-19T09:00:00Z",
    paper_count: 50,
    status: "completed",
    avg_score: 7.84,
    max_score: 10,
  },
  {
    id: "exam_chem_mid",
    name: "Chemistry Midterm — Bonding",
    created_at: "2026-07-28T09:00:00Z",
    paper_count: 35,
    status: "processing",
    avg_score: null,
    max_score: 10,
  },
  {
    id: "exam_urdu_lit",
    name: "Urdu Literature — Nazm Analysis",
    created_at: "2026-07-11T09:00:00Z",
    paper_count: 42,
    status: "needs_review",
    avg_score: 6.4,
    max_score: 10,
  },
  {
    id: "exam_phys_draft",
    name: "Physics — Optics Quiz",
    created_at: "2026-08-26T09:00:00Z",
    paper_count: 0,
    status: "draft",
    avg_score: null,
    max_score: 10,
  },
];

export const demoExamsResponse: ExamsListResponse = {
  exams: demoExams,
  metrics: {
    total_exams: 24,
    accuracy_pct: 94.2,
    hours_saved: 316,
  },
};

export const demoConcepts: Omit<MagicConcept, "id">[] = [
  { keyword: "Sunlight", points: 3, synonyms: ["solar energy", "radiation", "light energy"] },
  { keyword: "Chlorophyll", points: 3, synonyms: ["green pigment", "pigment"] },
  { keyword: "Glucose", points: 2, synonyms: ["sugar", "C6H12O6"] },
  { keyword: "CO₂", points: 1, synonyms: ["carbon dioxide"] },
  { keyword: "Oxygen", points: 1, synonyms: ["O2"] },
];

const languages = ["en", "ur", "sd", "pa"] as const;

const FIRST_NAMES = ["Ayesha", "Bilal", "Comrade", "Dana", "Emaan", "Faizan", "Hira", "Ibrahim"];
const LAST_NAMES = ["Khan", "Ahmed", "Malik", "Sheikh", "Bhatti", "Chaudhry", "Raza", "Qureshi"];

function makePaper(i: number): QueuePaper {
  const id = 101 + i;
  const flagged = i % 17 === 2;
  const processing = i >= 48;
  return {
    id: `paper_${id}`,
    student_id: `STU-${id}`,
    student_name:
      processing && i % 2 === 0
        ? null
        : `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3) % LAST_NAMES.length]}`,
    source: i % 3 === 0 ? "mobile" : "web_dashboard",
    language: languages[i % 4]!,
    status: processing ? "ocr_in_progress" : flagged ? "needs_review" : "evaluated",
    score: processing ? null : flagged ? 4 : 6 + ((i * 3) % 5),
    max_score: 10,
  };
}

export const demoQueue: PaperQueueResponse = {
  exam_id: DEMO_EXAM_ID,
  papers: Array.from({ length: 50 }, (_, i) => makePaper(i)),
};

const OCR_EN = `Photosynthesis is the process by which plants use solar energy captured by the
green pigment in their leaves to convert carbon dioxide and water into glucose,
releasing O2 as a by-product.`;

const OCR_UR = `پودے سورج کی روشنی کو سبز مادے کی مدد سے جذب کرتے ہیں اور کاربن ڈائی آکسائیڈ اور پانی
سے گلوکوز بناتے ہیں، جس کے دوران آکسیجن خارج ہوتی ہے۔`;

export function demoPaperDetail(studentId: string): PaperDetail {
  const queued = demoQueue.papers.find((p) => p.student_id === studentId) ?? demoQueue.papers[0]!;
  const flagged = queued.status === "needs_review";
  const isRTL = queued.language !== "en";

  return {
    student_id: queued.student_id,
    exam_id: DEMO_EXAM_ID,
    status: queued.status,
    score: queued.score ?? 0,
    max_score: 10,
    ocr_confidence: flagged ? 78.4 : 96.5,
    word_count: flagged ? 61 : 28,
    density_ratio: flagged ? 22.1 : 88.5,
    language: queued.language,
    source: queued.source,
    scan_url: "",
    ocr_text: isRTL ? OCR_UR : OCR_EN,
    moderation_note: null,
    debuggers: {
      garbage: {
        flagged,
        relevance_score: flagged ? 0.61 : 0.02,
        threshold: 0.35,
        sentences_scanned: flagged ? 5 : 2,
        notes: flagged
          ? "3 sentences repeat the question prompt verbatim — padding detected."
          : "No filler, padding, or copied prompt text detected.",
      },
      negation: {
        flagged,
        negation_tokens_bound: flagged ? 1 : 0,
        tokens_scanned: ["not", "never", "fails to", "without"],
        flagged_phrases: flagged
          ? [{ phrase: "chlorophyll does not absorb light", concept: "Chlorophyll" }]
          : [],
      },
      synonym: {
        resolved: flagged ? 1 : 2,
        method: "pgvector cosine-similarity semantic search",
        matches: [
          { student_token: "solar energy", rubric_concept: "Sunlight", similarity: 0.94 },
          ...(flagged
            ? []
            : [
                { student_token: "green pigment", rubric_concept: "Chlorophyll", similarity: 0.91 },
              ]),
        ],
      },
      spelling: {
        corrections_applied: 1,
        threshold: 0.85,
        corrections: [
          { original: "photosinthesis", corrected: "photosynthesis", levenshtein: 0.92 },
        ],
      },
      sequence: {
        correct_order: !flagged,
        strict_order_enabled: true,
        transitions_validated: flagged ? 2 : 4,
        transitions_expected: 4,
        steps: [
          { label: "Sunlight Absorption", detected: true },
          { label: "Chlorophyll Activation", detected: !flagged },
          { label: "CO₂ Fixation", detected: true },
          { label: "Glucose Synthesis", detected: !flagged },
        ],
      },
      vision: {
        verified: true,
        confidence: flagged ? 74.8 : 91.3,
        image_width: 620,
        image_height: 420,
        detected_elements: [
          { label: "Chloroplast", bbox: [112, 88, 240, 195], confidence: 93.1 },
          { label: "Arrow: CO₂ → Leaf", bbox: [300, 140, 410, 160], confidence: 89.5 },
          { label: "Label: O₂ release", bbox: [330, 250, 470, 286], confidence: 86.2 },
        ],
      },
      density: {
        flagged,
        density_ratio: flagged ? 22.1 : 88.5,
        threshold: 30,
        valid_keyword_hits: flagged ? 2 : 5,
        total_word_count: flagged ? 61 : 28,
        raw_ratio: flagged ? 3.28 : 17.86,
      },
      aggregator: {
        total_awarded: queued.score ?? 0,
        total_max: 10,
        rows: [
          { concept: "Sunlight", award: 3, max: 3, match_type: "synonym" },
          {
            concept: "Chlorophyll",
            award: flagged ? 0 : 3,
            max: 3,
            match_type: flagged ? "missed" : "synonym",
          },
          {
            concept: "Glucose",
            award: flagged ? 0 : 2,
            max: 2,
            match_type: flagged ? "missed" : "exact",
          },
          { concept: "CO₂", award: 1, max: 1, match_type: "exact" },
          { concept: "Oxygen", award: flagged ? 0 : 1, max: 1, match_type: "fuzzy" },
        ],
      },
    },
  };
}

export const scoreBands = [
  { band: "0–20%", count: 2 },
  { band: "21–40%", count: 4 },
  { band: "41–60%", count: 9 },
  { band: "61–80%", count: 21 },
  { band: "81–100%", count: 14 },
];

export const mistakeClusters = [
  { cluster: "Missed Chlorophyll concept", students: 14, debugger: "VIII — Aggregator" },
  { cluster: "Negation reversal on light reaction", students: 9, debugger: "II — Negation" },
  { cluster: "Sequence order violated (CO₂ before light)", students: 7, debugger: "V — Sequence" },
  { cluster: "Low density / padded answers", students: 6, debugger: "VII — Density" },
  { cluster: "Diagram unlabeled", students: 5, debugger: "VI — Vision AI" },
];

export const debuggerAccuracy = [
  { name: "Garbage", value: 96 },
  { name: "Negation", value: 93 },
  { name: "Synonym", value: 95 },
  { name: "Spelling", value: 98 },
  { name: "Sequence", value: 89 },
  { name: "Vision", value: 91 },
  { name: "Density", value: 94 },
  { name: "Aggregator", value: 97 },
];

/** Offline twin of GET /analytics/summary so the Analytics page stays whole. */
export function demoAnalyticsSummary(examId: string): AnalyticsSummary {
  return {
    exam_id: examId,
    title: "Biology 101 — Photosynthesis",
    total_papers: demoQueue.papers.length,
    scored_papers: demoQueue.papers.filter((p) => p.score !== null).length,
    max_score: 10,
    class_average: 7.84,
    score_distribution: [2, 6, 14, 18, 8],
    concept_mastery: [
      { concept: "Sunlight", awarded: 2.7, max: 3, mastery_pct: 90 },
      { concept: "Chlorophyll", awarded: 1.6, max: 3, mastery_pct: 48 },
      { concept: "Glucose", awarded: 1.7, max: 2, mastery_pct: 74 },
      { concept: "CO₂", awarded: 0.9, max: 1, mastery_pct: 88 },
      { concept: "Oxygen", awarded: 0.8, max: 1, mastery_pct: 82 },
    ],
    debugger_breakdown: [
      { key: "garbage", label: "Garbage / padding", count: 6, total: 48, rate: 12.5 },
      { key: "negation", label: "Negation reversal", count: 9, total: 48, rate: 18.8 },
      { key: "synonym", label: "Synonym gap", count: 14, total: 48, rate: 29.2 },
      { key: "spelling", label: "Spelling corrected", count: 21, total: 48, rate: 43.8 },
      { key: "sequence", label: "Sequence breakage", count: 7, total: 48, rate: 14.6 },
      { key: "vision", label: "Diagram unverified", count: 33, total: 48, rate: 68.8 },
      { key: "density", label: "Low density (fluff)", count: 5, total: 48, rate: 10.4 },
      { key: "aggregator", label: "Concept missed", count: 24, total: 48, rate: 50 },
    ],
  };
}
