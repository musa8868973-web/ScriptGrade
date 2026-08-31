import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Loader2,
  Monitor,
  ScanLine,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LANGUAGE_LABELS,
  RTL_LANGUAGES,
  type ExamStatus,
  type LanguageCode,
  type PaperSource,
  type PaperStatus,
} from "@/lib/types";

/* Soft, light-tinted pill — no heavy borders, no saturated fills. */
const pill =
  "pill-soft inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide";

/* ── Exam status (PRD §3, Page 2) ─────────────────────────────── */
const examStatusConfig: Record<
  ExamStatus,
  { label: string; className: string; Icon: typeof CheckCircle; spin?: boolean }
> = {
  completed: { label: "Completed", className: "text-pass", Icon: CheckCircle },
  processing: { label: "Processing", className: "text-brand", Icon: Loader2, spin: true },
  needs_review: { label: "Needs Review", className: "text-warn", Icon: AlertTriangle },
  draft: { label: "Draft", className: "text-muted-foreground", Icon: FileText },
};

export function StatusBadge({ status }: { status: ExamStatus }) {
  const { label, className, Icon, spin } = examStatusConfig[status];
  return (
    <span role="status" className={pill}>
      <Icon size={11} className={cn(className, spin && "animate-spin")} />
      {label}
    </span>
  );
}

/* ── Paper lifecycle status (PRD §1.3) ────────────────────────── */
const paperStatusConfig: Record<
  PaperStatus,
  { label: string; className: string; Icon: typeof CheckCircle; spin?: boolean }
> = {
  uploaded: { label: "Uploaded", className: "text-muted-foreground", Icon: FileText },
  queued: { label: "Queued", className: "text-muted-foreground", Icon: Loader2 },
  ocr_in_progress: { label: "OCR Active", className: "text-vision", Icon: ScanLine, spin: true },
  flagged: { label: "Flagged", className: "text-alert", Icon: AlertTriangle },
  evaluated: { label: "Evaluated", className: "text-pass", Icon: CheckCircle },
  needs_review: { label: "Needs Review", className: "text-warn", Icon: AlertTriangle },
  scored: { label: "Scored", className: "text-pass", Icon: CheckCircle },
  override_applied: { label: "Override Applied", className: "text-brand", Icon: Sparkles },
  finalized: { label: "Finalized", className: "text-pass", Icon: CheckCircle },
  exported: { label: "Exported", className: "text-vision", Icon: FileText },
};

export function PaperStatusBadge({ status }: { status: PaperStatus }) {
  const { label, className, Icon, spin } = paperStatusConfig[status];
  return (
    <span role="status" className={pill}>
      <Icon size={11} className={cn(className, spin && "animate-spin")} />
      {label}
    </span>
  );
}

/* ── Source tag (PRD §3, Page 4) ──────────────────────────────── */
export function SourceBadge({ source }: { source: PaperSource }) {
  return source === "mobile" ? (
    <span className={pill}>
      <Smartphone size={10} className="text-muted-foreground" /> Mobile
    </span>
  ) : (
    <span className={pill}>
      <Monitor size={10} className="text-muted-foreground" /> Web
    </span>
  );
}

/* ── Language detector badge (English + RTL scripts) ──────────── */
export function LanguageBadge({ language }: { language: LanguageCode }) {
  const isRTL = RTL_LANGUAGES.includes(language);
  return (
    <span lang={language} dir={isRTL ? "rtl" : "ltr"} className={pill}>
      {LANGUAGE_LABELS[language]}
      {isRTL && <span className="text-[0.5625rem] text-muted-foreground">RTL</span>}
    </span>
  );
}
