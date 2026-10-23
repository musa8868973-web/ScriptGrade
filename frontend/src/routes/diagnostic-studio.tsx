import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, Save, ScanEye, ScanText, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LanguageBadge, PaperStatusBadge, SourceBadge } from "@/components/badges";
import { DEBUGGERS, DebuggerTabContent, toneClasses } from "@/components/debuggers/DebuggerPanel";
import { SheetViewer } from "@/components/SheetViewer";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { usePaper, usePaperQueue, useOverride } from "@/lib/queries";
import { useGradeStore } from "@/stores/grade";
import { API_BASE_URL } from "@/lib/api";
import { DEMO_EXAM_ID } from "@/lib/demo-data";
import { LANGUAGE_LABELS, RTL_LANGUAGES, type LanguageCode } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/diagnostic-studio")({
  validateSearch: (search: Record<string, unknown>): {
    exam_id: string;
    student_id?: string;
    sheet_url?: string;
  } => ({
    exam_id: typeof search["exam_id"] === "string" ? (search["exam_id"] as string) : DEMO_EXAM_ID,
    ...(typeof search["student_id"] === "string"
      ? { student_id: search["student_id"] as string }
      : {}),
    ...(typeof search["sheet_url"] === "string"
      ? { sheet_url: search["sheet_url"] as string }
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
/** Guaranteed-working local demo PDF, used ONLY whenever the paper has no usable
 * URL anywhere or is fundamentally missing. */
const PUBLIC_FALLBACK_PDF = "/sample.pdf";

function DiagnosticStudio() {
  const { exam_id, student_id, sheet_url } = Route.useSearch();
  const storeStudentPaperUrl = useGradeStore((s) => s.studentPaperUrl);
  const storeStudentPaperBlob = useGradeStore((s) => s.studentPaperBlobUrl);
  const storeStudentPaperFile = useGradeStore((s) => s.studentPaperFile);

  const { data: queue } = usePaperQueue(exam_id);
  const papers = useMemo(() => queue?.papers ?? [], [queue]);

  const [active, setActive] = useState<string | null>(student_id ?? null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    // Cross-reference input string against loaded batch records (student_name or student_id)
    const match = papers.find((p) => {
      const name = (p.student_name ?? "").toLowerCase();
      const id = p.student_id.toLowerCase();
      return name === query || name.includes(query) || id === query || id.includes(query);
    });

    if (match) {
      setActive(match.student_id);
      useGradeStore.getState().setActiveStudent(match.student_id);
      if (match.scanned_image_url) {
        useGradeStore.getState().setStudentPaper({
          studentId: match.student_id,
          url: match.scanned_image_url,
        });
      }
      toast.success(`Switched to ${match.student_name ?? match.student_id}`);
      setSearchQuery("");
    } else {
      toast.error("Student record not found in the current batch.");
    }
  };

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

  // Dynamic candidate resolution:
  // If active student matches the searched/ingested student, prioritize the dynamically passed sheet reference.
  const isMatchingActive = !active || active === student_id;
  const dynamicCandidate = isMatchingActive
    ? sheet_url || storeStudentPaperBlob || storeStudentPaperUrl || ""
    : "";

  const backendPaperUrl =
    paper?.scanned_image_url || paper?.scan_url || paper?.file_url || paper?.pdf_url || "";
  const queuePaperUrl = papers.find((p) => p.student_id === active)?.scanned_image_url || "";

  // Prioritize: dynamic sheet passed from Ingestion > paper's scanned URL from API > queue scanned URL > store fallback
  const rawPaperUrl =
    dynamicCandidate ||
    backendPaperUrl ||
    queuePaperUrl ||
    storeStudentPaperBlob ||
    storeStudentPaperUrl ||
    "";

  const paperUrl = rawPaperUrl.startsWith("blob:") || /^https?:\/\//i.test(rawPaperUrl)
    ? rawPaperUrl
    : rawPaperUrl.startsWith("/") && HAS_BACKEND_ORIGIN
      ? `${BACKEND_ORIGIN}${rawPaperUrl}`
      : rawPaperUrl
        ? rawPaperUrl
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
        {/* Paper selector & Search bar */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <form
            onSubmit={handleSearch}
            className="flex items-center gap-1.5"
          >
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Student..."
                className="mono-token h-8 w-44 rounded-md border border-border bg-background pl-8 pr-2.5 text-xs outline-none transition-all placeholder:text-muted-foreground focus:w-56 focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-secondary/80 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <Search size={12} />
              <span>Search</span>
            </button>
          </form>

          <div className="hidden h-4 w-px bg-border sm:block" />

          {/* Student name pills */}
          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-1">
            {papers.slice(0, 24).map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.student_id)}
                className={cn(
                  "mono-token shrink-0 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  p.student_id === active
                    ? "bg-royalBlue font-medium text-white shadow-xs"
                    : "pill-soft hover:text-foreground",
                )}
              >
                {p.student_name ?? p.student_id}
              </button>
            ))}
          </div>
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
                  Scanned Sheet
                  <span className="mono-token ml-auto text-[0.6875rem] normal-case">
                    OCR confidence {paper.ocr_confidence.toFixed(1)}%
                  </span>
                </div>
                {/* SheetViewer: intersection-observer lazy-load, toolbar, zoom.
                    Pass the resolved absolute URL directly — SheetViewer renders
                    a NoPreview placeholder when url is null/relative. */}
                <SheetViewer
                  url={hasPreview ? paperUrl : null}
                  blobUrl={isMatchingActive ? storeStudentPaperBlob : undefined}
                  file={isMatchingActive ? storeStudentPaperFile : undefined}
                  studentId={paper.student_id}
                  height={620}
                  className="mt-3"
                />
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
              {/* ── Dedicated 3-Frameworks Metrics Panel ── */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-success" />
                    </span>
                    <h3 className="text-xs font-semibold tracking-wide uppercase text-foreground">
                      Active Frameworks Execution Status
                    </h3>
                  </div>
                  <span className="mono-token rounded bg-secondary px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
                    Priority Pipeline (3 Active)
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {/* Framework 1: Synonym Matcher */}
                  <div className="rounded-lg border border-border/80 bg-background/70 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.6875rem] font-medium text-muted-foreground">
                        Synonym Matcher
                      </span>
                      <span className="mono-token inline-flex items-center gap-1 rounded bg-pass/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-pass">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    </div>
                    <p className="mono-token mt-2 text-lg font-semibold text-foreground">
                      {paper.debuggers.synonym.resolved}
                      <span className="text-xs font-normal text-muted-foreground"> resolved</span>
                    </p>
                    <p className="mt-1 truncate text-[0.6875rem] text-muted-foreground">
                      {paper.debuggers.synonym.matches.length > 0
                        ? `${paper.debuggers.synonym.matches.length} concept match(es)`
                        : "Semantic vector search"}
                    </p>
                  </div>

                  {/* Framework 2: Negation Engine */}
                  <div className="rounded-lg border border-border/80 bg-background/70 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.6875rem] font-medium text-muted-foreground">
                        Negation Engine
                      </span>
                      <span
                        className={cn(
                          "mono-token inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium",
                          paper.debuggers.negation.flagged
                            ? "bg-alert/10 text-alert"
                            : "bg-pass/10 text-pass",
                        )}
                      >
                        {paper.debuggers.negation.flagged ? (
                          <AlertTriangle size={10} />
                        ) : (
                          <CheckCircle2 size={10} />
                        )}
                        {paper.debuggers.negation.flagged ? "Flagged" : "Active / Verified"}
                      </span>
                    </div>
                    <p className="mono-token mt-2 text-lg font-semibold text-foreground">
                      {paper.debuggers.negation.tokens_scanned.length}
                      <span className="text-xs font-normal text-muted-foreground"> tokens scanned</span>
                    </p>
                    <p className="mt-1 truncate text-[0.6875rem] text-muted-foreground">
                      {paper.debuggers.negation.flagged
                        ? "Polarity inversion caught"
                        : "Zero negation violations"}
                    </p>
                  </div>

                  {/* Framework 3: Anti-Fluff Scorer */}
                  <div className="rounded-lg border border-border/80 bg-background/70 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.6875rem] font-medium text-muted-foreground">
                        Anti-Fluff Scorer
                      </span>
                      <span
                        className={cn(
                          "mono-token inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium",
                          paper.debuggers.garbage.flagged
                            ? "bg-alert/10 text-alert"
                            : "bg-pass/10 text-pass",
                        )}
                      >
                        {paper.debuggers.garbage.flagged ? (
                          <AlertTriangle size={10} />
                        ) : (
                          <CheckCircle2 size={10} />
                        )}
                        {paper.debuggers.garbage.flagged ? "Padding Flagged" : "Active / Clean"}
                      </span>
                    </div>
                    <p className="mono-token mt-2 text-lg font-semibold text-foreground">
                      {(paper.debuggers.garbage.relevance_score * 100).toFixed(0)}%
                      <span className="text-xs font-normal text-muted-foreground"> relevance</span>
                    </p>
                    <p className="mt-1 truncate text-[0.6875rem] text-muted-foreground">
                      {paper.debuggers.garbage.notes || "Density & fluff filter"}
                    </p>
                  </div>
                </div>
              </div>

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
                    const isPhase2 = ![1, 2, 3, 8].includes(n);
                    return (
                      <li key={n} className={cn("py-5", isPhase2 && "opacity-50")}>
                        <div className="flex items-center gap-2.5">
                          <span className={cn("size-1.5 shrink-0 rounded-full", isPhase2 ? "bg-muted-foreground/40" : t.dot)} />
                          <span className="mono-token text-[0.625rem] text-muted-foreground">
                            {roman}
                          </span>
                          <Icon size={13} className={isPhase2 ? "text-muted-foreground/50" : "text-muted-foreground"} />
                          <h3 className={cn("text-sm font-medium", isPhase2 && "text-muted-foreground")}>{label}</h3>
                          {isPhase2 && (
                            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground/70">
                              Coming Soon
                            </span>
                          )}
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
