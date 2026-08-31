import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  Ruler,
  ScanText,
  SpellCheck2,
  Split,
  Trash2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaperDetail } from "@/lib/types";

export const DEBUGGERS = [
  { n: 1, roman: "I", key: "garbage", label: "Garbage Text", tone: "alert", Icon: Trash2 },
  { n: 2, roman: "II", key: "negation", label: "Negation", tone: "alert", Icon: XCircle },
  { n: 3, roman: "III", key: "synonym", label: "Synonym", tone: "pass", Icon: Split },
  { n: 4, roman: "IV", key: "spelling", label: "Spelling", tone: "warn", Icon: SpellCheck2 },
  { n: 5, roman: "V", key: "sequence", label: "Sequence DAG", tone: "warn", Icon: ArrowRight },
  { n: 6, roman: "VI", key: "vision", label: "Vision AI", tone: "vision", Icon: Eye },
  { n: 7, roman: "VII", key: "density", label: "Density", tone: "warn", Icon: Ruler },
  { n: 8, roman: "VIII", key: "aggregator", label: "Aggregator", tone: "pass", Icon: ScanText },
] as const;

export type DebuggerTone = (typeof DEBUGGERS)[number]["tone"];

export const toneClasses: Record<DebuggerTone, { text: string; border: string; bg: string; dot: string }> = {
  alert: { text: "text-alert", border: "border-border", bg: "bg-transparent", dot: "bg-alert" },
  pass: { text: "text-pass", border: "border-border", bg: "bg-transparent", dot: "bg-pass" },
  warn: { text: "text-warn", border: "border-border", bg: "bg-transparent", dot: "bg-warn" },
  vision: { text: "text-vision", border: "border-border", bg: "bg-transparent", dot: "bg-vision" },
};

function StatusLine({
  ok,
  tone,
  children,
}: {
  ok: boolean;
  tone: DebuggerTone;
  children: React.ReactNode;
}) {
  const t = toneClasses[ok ? "pass" : tone];
  return (
    <div className={cn("flex items-center gap-2 text-sm font-medium", t.text)}>
      {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      {children}
    </div>
  );
}

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", mono && "mono-token")}>{value}</span>
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-border">
          {head.map((h) => (
            <th
              key={h}
              className="py-1.5 pr-4 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className="mono-token py-1.5 pr-4">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DebuggerTabContent({ tab, paper }: { tab: number; paper: PaperDetail }) {
  const d = paper.debuggers;

  if (tab === 1) {
    const g = d.garbage;
    return (
      <div className="space-y-2.5 spring-in">
        <StatusLine ok={!g.flagged} tone="alert">
          {g.flagged ? "Garbage / padding flagged" : "Clean"} (score: {g.relevance_score.toFixed(2)})
        </StatusLine>
        <Row label="Contextual relevance score" value={`${g.relevance_score.toFixed(2)} / 1.0  [LOW = GOOD]`} />
        <Row label="Threshold (flag above)" value={g.threshold.toFixed(2)} />
        <Row label="Sentences scanned" value={String(g.sentences_scanned)} />
        <div className="border-l-2 border-border pl-3 text-xs text-muted-foreground">
          {g.notes}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700", g.flagged ? "bg-alert" : "bg-pass")}
            style={{ width: `${Math.min(100, g.relevance_score * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  if (tab === 2) {
    const n = d.negation;
    return (
      <div className="space-y-2.5 spring-in">
        <StatusLine ok={!n.flagged} tone="alert">
          {n.flagged ? "Negation detected — concept reversed" : "No negation detected"}
        </StatusLine>
        <Row label="Negation tokens bound to concepts" value={String(n.negation_tokens_bound)} />
        <div className="text-xs text-muted-foreground">Dependency-parse tokens scanned</div>
        <div className="flex flex-wrap gap-1.5">
          {n.tokens_scanned.map((t) => (
            <span key={t} className="pill-soft mono-token rounded px-1.5 py-0.5">
              {t}
            </span>
          ))}
        </div>
        {n.flagged_phrases.length === 0 ? (
          <p className="mono-token text-xs text-muted-foreground">Flagged phrases: [none]</p>
        ) : (
          <div className="space-y-2">
            {n.flagged_phrases.map((p) => (
              <div key={p.phrase} className="border-l-2 border-alert pl-3 text-xs">
                <p className="mono-token text-alert">“{p.phrase}”</p>
                <p className="mt-1 text-muted-foreground">
                  Semantic shift against rubric concept <b className="text-foreground">{p.concept}</b>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (tab === 3) {
    const s = d.synonym;
    return (
      <div className="space-y-2.5 spring-in">
        <StatusLine ok tone="pass">
          {s.resolved} synonym{s.resolved === 1 ? "" : "s"} resolved
        </StatusLine>
        <DataTable
          head={["Student Token", "Rubric Concept", "Similarity"]}
          rows={s.matches.map((m) => [
            <span className="text-pass">“{m.student_token}”</span>,
            m.rubric_concept,
            m.similarity.toFixed(2),
          ])}
        />
        <p className="text-xs text-muted-foreground">Method: {s.method}</p>
      </div>
    );
  }

  if (tab === 4) {
    const s = d.spelling;
    return (
      <div className="space-y-2.5 spring-in">
        <StatusLine ok={s.corrections_applied === 0} tone="warn">
          {s.corrections_applied} auto-correction{s.corrections_applied === 1 ? "" : "s"} applied (no
          deduction)
        </StatusLine>
        <DataTable
          head={["Original Token", "Corrected Token", "Levenshtein"]}
          rows={s.corrections.map((c) => [
            <span className="text-alert line-through">{c.original}</span>,
            <span className="text-pass">{c.corrected}</span>,
            `${c.levenshtein.toFixed(2)} (≥${s.threshold})`,
          ])}
        />
      </div>
    );
  }

  if (tab === 5) {
    const s = d.sequence;
    return (
      <div className="space-y-2.5 spring-in">
        <StatusLine ok={s.correct_order} tone="warn">
          {s.correct_order ? "Correct order" : "Order violated"}
        </StatusLine>
        <div className="space-y-2">
          {s.steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex flex-1 items-center gap-2 border-b border-border py-1.5 text-xs font-medium",
                  step.detected ? "text-pass" : "text-warn",
                )}
              >
                <span className="mono-token opacity-60">{i + 1}</span>
                {step.label}
                <span className="ml-auto">
                  {step.detected ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                </span>
              </div>
            </div>
          ))}
        </div>
        <Row
          label="DAG transitions validated"
          value={`${s.transitions_validated}/${s.transitions_expected}`}
        />
        <Row label="Strict order toggle" value={s.strict_order_enabled ? "ENABLED" : "DISABLED"} />
      </div>
    );
  }

  if (tab === 6) {
    const v = d.vision;
    return (
      <div className="space-y-2.5 spring-in">
        <StatusLine ok tone="vision">
          Vision verified (confidence: {v.confidence.toFixed(1)}%)
        </StatusLine>
        <p className="text-xs text-muted-foreground">
          Bounding boxes are overlaid on the scan in the left viewer while this tab is active.
        </p>
        <DataTable
          head={["Label", "Bounding Box", "Conf."]}
          rows={v.detected_elements.map((e) => [
            <span className="text-vision">{e.label}</span>,
            `[${e.bbox.join(", ")}]`,
            `${e.confidence.toFixed(1)}%`,
          ])}
        />
      </div>
    );
  }

  if (tab === 7) {
    const s = d.density;
    return (
      <div className="space-y-2.5 spring-in">
        <StatusLine ok={!s.flagged} tone="warn">
          {s.flagged ? "Low density — fluff flagged" : "High density"}
        </StatusLine>
        <Row label="Density ratio" value={`${s.density_ratio.toFixed(1)}% (threshold: ${s.threshold}%)`} />
        <Row label="Valid keyword hits" value={String(s.valid_keyword_hits)} />
        <Row label="Total word count" value={String(s.total_word_count)} />
        <p className="mono-token border-l-2 border-border pl-3 text-xs text-muted-foreground">
          ({s.valid_keyword_hits} / {s.total_word_count}) × 100 = {s.raw_ratio.toFixed(2)}% →
          normalized {s.density_ratio.toFixed(1)}%
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700", s.flagged ? "bg-warn" : "bg-pass")}
            style={{ width: `${Math.min(100, s.density_ratio)}%` }}
          />
        </div>
      </div>
    );
  }

  const a = d.aggregator;
  return (
    <div className="space-y-2.5 spring-in">
      <StatusLine ok={a.total_awarded === a.total_max} tone="pass">
        {a.total_awarded === a.total_max ? "Full match" : "Partial match"} ({a.total_awarded}/
        {a.total_max})
      </StatusLine>
      <DataTable
        head={["Concept", "Award", "Max", "Match Type"]}
        rows={a.rows.map((r) => [
          r.concept,
          <span className={r.award === r.max ? "text-pass" : "text-warn"}>{r.award}</span>,
          r.max,
          <span
            className={cn(
              "pill-soft rounded px-1.5 py-0.5 text-[0.625rem] font-medium",
              r.match_type === "missed"
                ? "text-alert"
                : r.match_type === "exact"
                  ? "text-pass"
                  : r.match_type === "vision"
                    ? "text-vision"
                    : "text-brand",
            )}
          >
            {r.match_type}
          </span>,
        ])}
      />
      <p className="mono-token text-sm font-semibold">
        Total: {a.total_awarded.toFixed(1)} / {a.total_max.toFixed(1)}
      </p>
    </div>
  );
}
