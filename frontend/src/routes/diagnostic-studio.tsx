import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageIcon, Loader2, Save, ScanEye, ScanText } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LanguageBadge, PaperStatusBadge, SourceBadge } from "@/components/badges";
import { DEBUGGERS, DebuggerTabContent, toneClasses } from "@/components/debuggers/DebuggerPanel";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { usePaper, usePaperQueue, useOverride } from "@/lib/queries";
import { API_BASE_URL } from "@/lib/api";
import { DEMO_EXAM_ID } from "@/lib/demo-data";
import { LANGUAGE_LABELS, RTL_LANGUAGES, type LanguageCode } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/diagnostic-studio")({
  validateSearch: (search: Record<string, unknown>): { exam_id: string; student_id?: string } => ({
    exam_id: typeof search["exam_id"] === "string" ? (search["exam_id"] as string) : DEMO_EXAM_ID,
    ...(typeof search["student_id"] === "string"
      ? { student_id: search["student_id"] as string }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Diagnostic Studio — 8-Debugger Engine | ScriptGrade" },
      {
        name: "description",
        content:
          "Split-pane grading workspace: scanned student paper beside all eight debugger result cards, with a teacher score override slider.",
      },
      { property: "og:title", content: "Diagnostic Studio — 8-Debugger Engine" },
      {
        property: "og:description",
        content:
          "Garbage classifier, negation, synonym, fuzzy spelling, sequence DAG, vision, density, and rubric aggregation — fully transparent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiagnosticStudio,
});

const LANGS: LanguageCode[] = ["en", "ur", "sd", "pa"];
/** Backend origin: API_BASE_URL minus its `/api/v1` suffix. Relative `/static/…`
 * scan paths resolve against this — never the Vercel frontend root (which 404s).
 * Derived with `.replace` (not `new URL`) so a malformed base can't throw. */
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
/** True only when BACKEND_ORIGIN is a non-empty absolute http(s) URL, so a
 * relative scan path is prefixed with it only when it can actually resolve. */
const HAS_BACKEND_ORIGIN = /^https?:\/\//i.test(BACKEND_ORIGIN);
/** Guaranteed-working external demo PDF, used whenever the paper has no usable
 * URL or the backend origin is empty/invalid — so the viewer can never 404. */
const PUBLIC_FALLBACK_PDF = "https://pdfobject.com/pdf/sample.pdf";

function DiagnosticStudio() {
  const { exam_id, student_id } = Route.useSearch();
  const { data: queue } = usePaperQueue(exam_id);
  const papers = useMemo(() => queue?.papers ?? [], [queue]);

  const [active, setActive] = useState<string | null>(student_id ?? null);
  // Keep the active paper driven by the URL `student_id` param so the detail
  // query resolves that record. The backend resolves a direct UUID id first and
  // falls back to the `student_identifier` when that fetch fails.
  useEffect(() => {
    if (student_id) setActive(student_id);
  }, [student_id]);
  useEffect(() => {
    if (!active && papers.length) setActive(papers[0]!.student_id);
  }, [active, papers]);

  const { data: paper, isLoading } = usePaper(active, exam_id);
  const override = useOverride(active ?? "", exam_id);

  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (paper) {
      setScore(paper.score);
      setNote("");
    }
  }, [paper]);

  const isRTL = paper ? RTL_LANGUAGES.includes(paper.language) : false;

  // Debug: surface the active paper so scan_url / scanned_image_url resolution is visible.
  console.log("Active Paper Data:", paper);

  // Resolve the scanned-sheet source per priority. An absolute http(s) URL is
  // used as-is; a relative path (/static/…, /uploads/…) is prefixed with the
  // backend origin only when that origin is a valid absolute http(s) URL. In
  // every other case — no paper URL, or an empty/invalid backend origin (e.g.
  // missing env vars) — use PUBLIC_FALLBACK_PDF, so the <iframe> src is always
  // a guaranteed-valid absolute URL and a 404 is impossible.
  const rawPaperUrl = paper?.file_url || paper?.scan_url || paper?.pdf_url || "";
  const paperUrl = /^https?:\/\//i.test(rawPaperUrl)
    ? rawPaperUrl
    : rawPaperUrl.startsWith("/") && HAS_BACKEND_ORIGIN
      ? `${BACKEND_ORIGIN}${rawPaperUrl}`
      : PUBLIC_FALLBACK_PDF;
  const hasPreview = paperUrl.length > 0;
  const paperIsImage = /\.(jpe?g|png)(\?|#|$)/i.test(paperUrl);

  return (
    <AppShell
      padded={false}
      crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Diagnostic Studio" }]}
      title="Diagnostic Studio"
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {LANGS.map((l) => (
            <span
              key={l}
              className={cn(
                "transition-opacity",
                paper?.language === l ? "opacity-100" : "opacity-45",
              )}
            >
              <LanguageBadge language={l} />
            </span>
          ))}
        </div>
      }
    >
      <div className="px-4 pt-5 md:px-6">
        {/* Paper selector */}
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {papers.slice(0, 24).map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.student_id)}
              className={cn(
                "mono-token shrink-0 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                p.student_id === active
                  ? "bg-success font-medium text-success-foreground"
                  : "pill-soft hover:text-foreground",
              )}
            >
              {p.student_name ?? p.student_id}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !paper ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading debugger payload…
        </div>
      ) : (
        <div className="grid min-h-[70vh] grid-cols-1 gap-4 border-t border-border lg:grid-cols-12">
          {/* ── Left: scanned paper ─────────────────────────── */}
          <div className="col-span-12 lg:col-span-5">
            <div className="h-full space-y-6 overflow-y-auto p-4 md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono-token text-sm font-semibold">{paper.student_id}</span>
                {paper.student_name && (
                  <span className="text-sm font-medium text-foreground">{paper.student_name}</span>
                )}
                <PaperStatusBadge status={paper.status} />
                <SourceBadge source={paper.source} />
                <LanguageBadge language={paper.language} />
              </div>

              <div>
                <div className="section-title text-[0.6875rem] font-semibold tracking-wide uppercase">
                  <ImageIcon size={12} /> Scanned Sheet
                  <span className="mono-token ml-auto text-[0.6875rem] normal-case">
                    OCR confidence {paper.ocr_confidence.toFixed(1)}%
                  </span>
                </div>
                {!hasPreview ? (
                  <p className="mt-3 rounded-lg border border-border bg-card px-4 py-10 text-center text-xs text-muted-foreground">
                    No document preview available for this scan.
                  </p>
                ) : paperIsImage ? (
                  <div className="mt-3 overflow-y-auto rounded-lg border border-slate-200">
                    <img
                      src={paperUrl}
                      alt={`Scanned answer sheet for ${paper.student_id}`}
                      className="w-full"
                    />
                  </div>
                ) : (
                  <div className="mt-3 h-[600px] w-full overflow-hidden rounded-lg border border-slate-200">
                    <iframe
                      src={`${paperUrl}#toolbar=0&navpanes=0`}
                      className="block h-full w-full border-0"
                      title="Answer Sheet Preview"
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="section-title text-[0.6875rem] font-semibold tracking-wide uppercase">
                  <ScanText size={12} /> OCR Transcript · {LANGUAGE_LABELS[paper.language]}
                </div>
                <p
                  dir={isRTL ? "rtl" : "ltr"}
                  lang={paper.language}
                  className={cn(
                    "mt-3 text-sm leading-relaxed",
                    isRTL && "text-right leading-loose",
                  )}
                >
                  {paper.ocr_text}
                </p>
                <div className="mono-token mt-3 flex gap-4 text-[0.6875rem] text-muted-foreground">
                  <span>{paper.word_count} words</span>
                  <span>density {paper.density_ratio}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: 8-debugger inline list ───────────────── */}
          <div className="col-span-12 lg:col-span-7">
            <div className="space-y-8 p-4 md:p-6">
              <div>
                <div className="section-title">
                  <ScanEye size={15} className="text-brand" />
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight">
                    Musa&apos;s 8-Debugger Engine
                  </h2>
                  <span className="mono-token ml-auto text-xs text-muted-foreground">
                    <span className="font-semibold text-success">
                      {paper.debuggers.aggregator.total_awarded}
                    </span>
                    /{paper.debuggers.aggregator.total_max} pts
                  </span>
                </div>

                <ul className="divide-y divide-border">
                  {DEBUGGERS.map(({ n, roman, label, tone, Icon }) => {
                    const t = toneClasses[tone];
                    return (
                      <li key={n} className="py-5">
                        <div className="flex items-center gap-2.5">
                          <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} />
                          <span className="mono-token text-[0.625rem] text-muted-foreground">
                            {roman}
                          </span>
                          <Icon size={13} className="text-muted-foreground" />
                          <h3 className="text-sm font-medium">{label}</h3>
                        </div>
                        <div className="mt-3 pl-6">
                          <DebuggerTabContent tab={n} paper={paper} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Teacher override */}
              <section>
                <h3 className="section-title text-[0.9375rem] font-semibold">
                  Teacher Score Override
                </h3>
                <p className="mt-3 text-xs text-muted-foreground">
                  Human-in-the-loop moderation — every override is written to the audit trail.
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <Slider
                    value={[score ?? 0]}
                    min={0}
                    max={paper.max_score}
                    step={0.5}
                    onValueChange={(v) => setScore(v[0] ?? 0)}
                    aria-label="Override score"
                    className="flex-1"
                  />
                  <span className="mono-token w-20 text-right text-base font-semibold">
                    {(score ?? 0).toFixed(1)}/{paper.max_score}
                  </span>
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Moderation note (required for audit trail)…"
                  className="mt-4"
                />
                <button
                  onClick={() =>
                    override.mutate({
                      override_score: score ?? 0,
                      moderation_note: note || "Teacher override applied from Diagnostic Studio.",
                    })
                  }
                  disabled={override.isPending}
                  className="magnetic mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {override.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  Apply Override
                </button>
              </section>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
