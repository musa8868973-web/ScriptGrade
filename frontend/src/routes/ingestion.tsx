import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  RotateCcw,
  ScanEye,
  ScanLine,
  Smartphone,
  UploadCloud,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PaperStatusBadge } from "@/components/badges";
import { DEBUGGERS } from "@/components/debuggers/DebuggerPanel";
import {
  useBatchUpload,
  useOverride,
  usePaper,
  usePaperQueue,
  useSetStudentName,
} from "@/lib/queries";
import { DEMO_EXAM_ID } from "@/lib/demo-data";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { TERMINAL_QUEUE_STATES, type PaperDetail, type PaperStatus } from "@/lib/types";

const MAX_BATCH_BYTES = 200 * 1024 * 1024;

/** Client-side batch item lifecycle mirrors PRD §1.3 paper states */
type BatchItem = {
  id: string;
  file: File;
  status: PaperStatus | "failed";
  progress: number;
};

export const Route = createFileRoute("/ingestion")({
  validateSearch: (search: Record<string, unknown>) => ({
    exam_id: typeof search["exam_id"] === "string" ? (search["exam_id"] as string) : DEMO_EXAM_ID,
  }),
  head: () => ({
    meta: [
      { title: "Answer Sheet Ingestion — ScriptGrade" },
      {
        name: "description",
        content:
          "Upload student answer sheets one-by-one or in batches, map each auto-assigned ID to a name, and see the initial 8-debugger check inline.",
      },
      { property: "og:title", content: "Answer Sheet Ingestion — ScriptGrade" },
      {
        property: "og:description",
        content: "Batch scan, ID→name mapping, and instant initial grading on a single page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IngestionPage,
});

/** Per-debugger one-line summary for the inline "initial check" grid. */
function quickSignals(d: PaperDetail): Record<string, { ok: boolean; text: string }> {
  const g = d.debuggers;
  return {
    garbage: { ok: !g.garbage.flagged, text: g.garbage.flagged ? "Padding flagged" : "Clean text" },
    negation: {
      ok: !g.negation.flagged,
      text: g.negation.flagged ? "Negation reversal" : "No negation",
    },
    synonym: {
      ok: true,
      text: `${g.synonym.resolved} synonym${g.synonym.resolved === 1 ? "" : "s"} resolved`,
    },
    spelling: { ok: true, text: `${g.spelling.corrections_applied} auto-corrected` },
    sequence: {
      ok: g.sequence.correct_order,
      text: g.sequence.correct_order ? "Step order valid" : "Step order violated",
    },
    vision: {
      ok: g.vision.verified,
      text: g.vision.verified
        ? `Diagram verified ${g.vision.confidence.toFixed(0)}%`
        : "Diagram unverified",
    },
    density: {
      ok: !g.density.flagged,
      text: g.density.flagged
        ? `Low density ${g.density.density_ratio.toFixed(0)}%`
        : `Density ${g.density.density_ratio.toFixed(0)}%`,
    },
    aggregator: {
      ok: g.aggregator.total_awarded === g.aggregator.total_max,
      text: `${g.aggregator.total_awarded}/${g.aggregator.total_max} pts`,
    },
  };
}

/** Immediate "Enter Student Name" field — saves the ID↔name mapping to the DB. */
function StudentNameField({
  current,
  onSave,
  width = "w-36",
}: {
  current: string | null;
  onSave: (name: string) => Promise<unknown>;
  width?: string;
}) {
  const [editing, setEditing] = useState(!current);
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(current ?? "");
    if (current) setEditing(false);
  }, [current]);

  const commit = async () => {
    const name = value.trim();
    if (!name || name === current) {
      setValue(current ?? "");
      if (current) setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(name);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing && current) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="mono-token text-left text-xs font-medium transition-colors hover:text-brand"
      >
        {current}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        value={value}
        placeholder="Enter Student Name"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={commit}
        disabled={saving}
        className={cn(
          "mono-token rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-brand",
          width,
        )}
      />
      {saving ? (
        <Loader2 size={12} className="animate-spin text-muted-foreground" />
      ) : (
        <Check size={12} className="text-pass" />
      )}
    </div>
  );
}

function IngestionPage() {
  const { exam_id } = Route.useSearch();
  const navigate = useNavigate();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"single" | "batch">("batch");
  const [quickStudent, setQuickStudent] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: queue } = usePaperQueue(exam_id);
  const upload = useBatchUpload(exam_id, setProgress);
  const setName = useSetStudentName(exam_id);
  const detail = usePaper(quickStudent, exam_id);
  const override = useOverride(quickStudent ?? "", exam_id);
  const papers = useMemo(() => queue?.papers ?? [], [queue]);

  const [overrideScore, setOverrideScore] = useState<number | null>(null);
  const [overrideNote, setOverrideNote] = useState("");
  useEffect(() => {
    if (detail.data) {
      setOverrideScore(detail.data.score);
      setOverrideNote("");
    }
  }, [detail.data]);

  // Surface auto-assigned IDs the moment the batch lands, and preselect the
  // first new paper so its initial check appears inline under the uploader.
  useEffect(() => {
    const created = upload.data?.papers;
    if (created?.length) {
      setQuickStudent(created[0]!.student_id);
      if (mode === "single") setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload.data]);

  // Once the selected paper reaches a terminal state, pull its diagnostics.
  const selectedStatus = papers.find((p) => p.student_id === quickStudent)?.status;
  useEffect(() => {
    if (quickStudent && selectedStatus && TERMINAL_QUEUE_STATES.includes(selectedStatus)) {
      void detail.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, quickStudent]);

  const totalBytes = items.reduce((s, i) => s + i.file.size, 0);

  const stats = useMemo(() => {
    const done = papers.filter((p) => TERMINAL_QUEUE_STATES.includes(p.status)).length;
    return {
      total: papers.length,
      done,
      processing: papers.filter((p) => p.status === "ocr_in_progress").length,
      queued: papers.filter((p) => p.status === "queued" || p.status === "uploaded").length,
      pct: papers.length ? Math.round((done / papers.length) * 100) : 0,
    };
  }, [papers]);

  const accept = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    const mapped = Array.from(incoming).map((file, i) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${i}`,
      file,
      status: "uploaded" as const,
      progress: 0,
    }));
    // One-by-one mode stages exactly the newest sheet; batch mode accumulates.
    const next = mode === "single" ? mapped.slice(-1) : [...items, ...mapped];
    if (next.reduce((s, i) => s + i.file.size, 0) > MAX_BATCH_BYTES) {
      toast.error("Batch too large", { description: "Keep each batch under 200 MB." });
      return;
    }
    setItems(next);
  };

  const patch = (id: string, data: Partial<BatchItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));

  /** Simulated per-file OCR progression so the queue stays observable offline. */
  const runItem = (item: BatchItem) => {
    patch(item.id, { status: "queued", progress: 0 });
    let pct = 0;
    const timer = setInterval(() => {
      pct = Math.min(100, pct + 8 + Math.round(Math.random() * 14));
      patch(item.id, {
        progress: pct,
        status: pct < 45 ? "queued" : pct < 100 ? "ocr_in_progress" : "evaluated",
      });
      if (pct >= 100) clearInterval(timer);
    }, 320);
  };

  const startBatch = () => {
    if (!items.length) {
      toast.error("Attach at least one answer sheet");
      return;
    }
    items.forEach(runItem);
    upload.mutate(items.map((i) => i.file));
  };

  const openStudio = (studentId: string) =>
    navigate({ to: "/diagnostic-studio", search: { exam_id, student_id: studentId } });

  const signals = detail.data ? quickSignals(detail.data) : null;
  const selectedName = papers.find((p) => p.student_id === quickStudent)?.student_name ?? null;
  const maxScore = detail.data?.max_score || 10;

  return (
    <AppShell
      crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Ingestion" }]}
      title="Answer Sheet Ingestion"
      actions={
        <button
          onClick={() => navigate({ to: "/diagnostic-studio", search: { exam_id } })}
          className="magnetic inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Open Diagnostic Studio <ArrowRight size={15} />
        </button>
      }
    >
      <div className="grid gap-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          {/* Upload mode — one-by-one or batch (workflow spec §2) */}
          <div className="flex items-center gap-1">
            <span className="section-title mr-1 text-[0.6875rem] font-semibold tracking-wide uppercase">
              Mode
            </span>
            {(["single", "batch"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "mono-token rounded-md px-3 py-1.5 text-xs transition-colors",
                  mode === m
                    ? "bg-success font-medium text-success-foreground"
                    : "pill-soft text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "single" ? "One-by-one" : "Batch"}
              </button>
            ))}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              accept(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-3 border border-dashed bg-card p-10 text-center transition-colors",
              dragging ? "border-brand bg-secondary/60" : "border-border",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              multiple={mode === "batch"}
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => accept(e.target.files)}
            />
            <UploadCloud size={22} className="text-muted-foreground" />
            <p className="text-sm font-medium">
              {mode === "single" ? "Add one answer sheet" : "Drop scanned answer sheets here"}
            </p>
            <p className="mono-token text-xs text-muted-foreground">
              PDF · JPG · PNG — max 200 MB per batch — {items.length} file(s),{" "}
              {(totalBytes / 1024 / 1024).toFixed(1)} MB staged
            </p>
          </div>

          <button
            onClick={startBatch}
            disabled={upload.isPending}
            className="magnetic flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {upload.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <UploadCloud size={16} />
            )}
            {upload.isPending ? `Uploading… ${progress}%` : "Start Ingestion"}
          </button>

          {upload.isPending && <Progress value={progress} className="h-2" />}

          <div className="border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-muted-foreground" />
              <p className="text-sm font-medium">Mobile Scanner Channel</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Sheets captured in the ScriptGrade mobile app land in the same queue below, each
              tagged with a unique auto-assigned ID (STU-2026-NNN).
            </p>
          </div>
        </div>

        {/* Batch file preview list */}
        <div>
          <div className="section-title flex-wrap justify-between gap-2">
            <div>
              <h2 className="text-[0.9375rem] font-semibold tracking-tight">Upload Staging</h2>
              <p className="mono-token mt-1 text-[0.625rem] text-muted-foreground">
                POST /papers/batch-upload · exam {exam_id}
              </p>
            </div>
            {items.length > 0 && (
              <button
                onClick={() => setItems([])}
                className="mono-token rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-alert"
              >
                Clear all
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <FileText size={22} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No sheets staged. Upload to see the initial check inline.
              </p>
            </div>
          ) : (
            <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="py-3">
                  <div className="flex items-center gap-2 text-xs">
                    <ScanLine size={13} className="text-muted-foreground" />
                    <span className="mono-token truncate">{item.file.name}</span>
                    <span className="ml-auto text-muted-foreground">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => setItems(items.filter((i) => i.id !== item.id))}
                      className="text-muted-foreground transition-colors hover:text-alert"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    {item.status === "failed" ? (
                      <span className="mono-token rounded-md border border-alert/40 px-2.5 py-1 text-[0.6875rem] font-medium text-alert">
                        Failed
                      </span>
                    ) : (
                      <PaperStatusBadge status={item.status} />
                    )}
                    <Progress value={item.progress} className="h-1.5 flex-1" />
                    <span className="mono-token w-10 text-right text-[0.6875rem] text-muted-foreground">
                      {item.progress}%
                    </span>
                    {(item.status === "failed" || item.progress === 100) && (
                      <button
                        onClick={() => runItem(item)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.6875rem] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <RotateCcw size={11} /> Retry
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Initial check — inline, beneath the uploader (workflow spec §2) ── */}
      <div className="mt-10">
        <div className="section-title justify-between">
          <div className="flex items-center gap-2">
            <ScanEye size={15} className="text-brand" />
            <h2 className="text-[0.9375rem] font-semibold tracking-tight">Initial Check</h2>
          </div>
          {quickStudent && (
            <span className="mono-token text-xs text-muted-foreground">{quickStudent}</span>
          )}
        </div>

        <div className="mt-3 border border-border bg-card p-5">
          {!quickStudent ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Upload a sheet (or pick a student below) to see the 8-debugger initial breakdown and
              enter the student name.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="mono-token text-sm font-semibold">{quickStudent}</span>
                <div className="flex items-center gap-1.5">
                  <UserPlus size={13} className="text-muted-foreground" />
                  <StudentNameField
                    current={selectedName}
                    onSave={(name) =>
                      setName.mutateAsync({ studentId: quickStudent, name }).then(() => undefined)
                    }
                  />
                </div>
                <button
                  onClick={() => openStudio(quickStudent)}
                  className="mono-token ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[0.6875rem] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Deep dive <ChevronRight size={12} />
                </button>
              </div>

              {detail.isLoading || !detail.data ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {selectedStatus && !TERMINAL_QUEUE_STATES.includes(selectedStatus)
                    ? "Sheet queued — initial check appears once OCR + grading complete."
                    : "Loading debugger payload…"}
                </p>
              ) : (
                signals && (
                  <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                    {DEBUGGERS.map(({ n, roman, key, label }) => {
                      const sig = signals[key];
                      const ok = sig?.ok ?? true;
                      return (
                        <div key={n} className="flex items-center gap-2 py-1 text-sm">
                          {ok ? (
                            <CheckCircle2 size={14} className="shrink-0 text-pass" />
                          ) : (
                            <AlertTriangle size={14} className="shrink-0 text-alert" />
                          )}
                          <span className="mono-token w-8 shrink-0 text-[0.625rem] text-muted-foreground">
                            {roman}
                          </span>
                          <span className="w-24 shrink-0 font-medium">{label}</span>
                          <span
                            className={cn("ml-auto text-right", ok ? "text-pass" : "text-alert")}
                          >
                            {sig?.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* Final score + inline override */}
              {detail.data && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
                        Calculated Score
                      </p>
                      <p className="mono-token mt-1 text-2xl font-semibold text-success">
                        {detail.data.score}
                        <span className="text-sm text-muted-foreground">
                          /{detail.data.max_score}
                        </span>
                      </p>
                    </div>
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[overrideScore ?? 0]}
                          min={0}
                          max={maxScore}
                          step={0.5}
                          onValueChange={(v) => setOverrideScore(v[0] ?? 0)}
                          aria-label="Override score"
                          className="flex-1"
                        />
                        <span className="mono-token w-16 text-right text-sm font-medium">
                          {(overrideScore ?? 0).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Textarea
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    placeholder="Override reason (optional audit note)…"
                    className="mt-3"
                  />
                  <button
                    onClick={() =>
                      override.mutate({
                        override_score: overrideScore ?? 0,
                        moderation_note: overrideNote || "Inline override from Ingestion.",
                      })
                    }
                    disabled={override.isPending || !quickStudent}
                    className="magnetic mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {override.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    Apply Score Override
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Clickable student records (workflow spec §3) ── */}
      <div className="mt-10">
        <div className="section-title justify-between">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">Student Records</h2>
          <span className="mono-token text-xs text-pass">
            {stats.done}/{stats.total} complete
          </span>
        </div>
        <p className="mono-token mt-2 text-[0.625rem] text-muted-foreground">
          polling GET /papers/queue every 3s · click any row to open the Diagnostic Studio
        </p>
        <Progress value={stats.pct} className="mt-3 h-2" />
        <div className="mono-token mt-2 flex gap-4 text-[0.6875rem] text-muted-foreground">
          <span>{stats.queued} queued</span>
          <span className="text-vision">{stats.processing} OCR active</span>
          <span className="text-pass">{stats.done} evaluated</span>
        </div>

        {queue?.demo && (
          <p className="mono-token mt-3 border-l-2 border-warn pl-3 text-xs text-warn">
            Demo fixtures — backend unreachable at {API_BASE_URL}. Name edits against STU-1xx
            sample rows are not persisted; point VITE_API_BASE_URL at the live FastAPI backend.
          </p>
        )}

        <div className="mt-3 max-h-[420px] overflow-y-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="sticky top-0 bg-background text-[0.625rem] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-medium">Student ID</th>
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 text-right font-medium">Score</th>
                <th className="py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {papers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No papers yet — upload answer sheets above to build the roster.
                  </td>
                </tr>
              )}
              {papers.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openStudio(p.student_id)}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors hover:bg-secondary/60",
                    p.student_id === quickStudent && "bg-secondary/40",
                  )}
                >
                  <td className="mono-token py-3 pr-4 font-medium">{p.student_id}</td>
                  <td className="py-3 pr-4">
                    <StudentNameField
                      current={p.student_name ?? null}
                      onSave={(name) =>
                        setName.mutateAsync({ studentId: p.student_id, name }).then(() => undefined)
                      }
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <PaperStatusBadge status={p.status} />
                  </td>
                  <td className="mono-token py-3 pr-4 text-right">
                    {p.score === null ? "—" : `${p.score}/${p.max_score}`}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      aria-label={`Preview ${p.student_id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickStudent(p.student_id);
                      }}
                      className="mono-token mr-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.6875rem] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ScanEye size={11} /> Quick
                    </button>
                    <ChevronRight size={14} className="inline text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
