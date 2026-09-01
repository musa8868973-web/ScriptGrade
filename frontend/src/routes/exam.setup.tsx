import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  FileText,
  Gauge,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  UploadCloud,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { examApi, isOffline } from "@/lib/api";
import { demoConcepts, DEMO_EXAM_ID } from "@/lib/demo-data";
import { newConcept, useRubricStore } from "@/stores/rubric";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { EvaluationToggles } from "@/lib/types";

export const Route = createFileRoute("/exam/setup")({
  head: () => ({
    meta: [
      { title: "AI Rubric Studio — ScriptGrade" },
      {
        name: "description",
        content:
          "Upload the question paper and model solution, then edit AI-extracted magic concepts, weightages, synonyms, and evaluation sensitivity toggles.",
      },
      { property: "og:title", content: "AI Rubric Studio — ScriptGrade" },
      {
        property: "og:description",
        content: "Qwen-extracted rubric concepts with interactive weightage editing.",
      },
    ],
  }),
  component: RubricStudio,
});

const STEPS = ["Upload", "AI Extraction", "Edit & Confirm", "Save & Ingest"] as const;

const TOGGLES: {
  key: keyof EvaluationToggles;
  title: string;
  sub: string;
  debug: string;
  Icon: typeof Gauge;
}[] = [
  {
    key: "spelling_correction",
    title: "Ignore Minor Spelling Mistakes",
    sub: "Levenshtein ≥ 85%",
    debug: "Debugger IV",
    Icon: Sparkles,
  },
  {
    key: "strict_dag_order",
    title: "Strict Procedural Order",
    sub: "DAG logic enforcement",
    debug: "Debugger V",
    Icon: Workflow,
  },
  {
    key: "density_scoring",
    title: "Anti-Fluff Density Scoring",
    sub: "Min density 30%",
    debug: "Debugger VII",
    Icon: Gauge,
  },
];

/** One labelled file slot (Question Paper / Model Answer Key) — same card
 * styling as the rest of the studio, but a dedicated single-purpose uploader. */
function FileDropSlot({
  label,
  hint,
  file,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <p className="section-title text-[0.6875rem] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onPick(f);
        }}
        onClick={() => ref.current?.click()}
        className={cn(
          "mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed bg-card p-6 text-center transition-colors",
          drag ? "border-brand bg-secondary/60" : "border-border",
        )}
      >
        <input
          ref={ref}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        {file ? (
          <>
            <FileText size={20} className="text-pass" />
            <p className="mono-token max-w-full truncate text-xs font-medium">{file.name}</p>
            <p className="mono-token text-[0.625rem] text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB · click to replace
            </p>
            <button
              type="button"
              aria-label={`Remove ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="mono-token inline-flex items-center gap-1 text-[0.625rem] text-muted-foreground transition-colors hover:text-alert"
            >
              <X size={11} /> Remove
            </button>
          </>
        ) : (
          <>
            <UploadCloud size={20} className="text-muted-foreground" />
            <p className="text-sm font-medium">{hint}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF · DOC · TXT — or click to browse
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function RubricStudio() {
  const navigate = useNavigate();
  const {
    concepts,
    toggles,
    step,
    examId,
    setStep,
    setExam,
    hydrate,
    addConcept,
    removeConcept,
    updateConcept,
    setToggle,
  } = useRubricStore();

  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalPoints = concepts.reduce((sum, c) => sum + c.points, 0);

  const pickQuestion = (f: File) => {
    setQuestionFile(f);
    setStep(1);
  };
  const pickAnswer = (f: File) => {
    setAnswerFile(f);
    setStep(1);
  };

  const handleExtract = async () => {
    if (!questionFile) {
      toast.error("Upload the question paper first");
      return;
    }
    setExtracting(true);
    setStep(2);
    const form = new FormData();
    form.append("question_file", questionFile);
    if (answerFile) form.append("answer_file", answerFile);
    try {
      const res = await examApi.setup(form);
      setExam(res.data.exam_id);
      hydrate(res.data.concepts);
      toast.success("Key concepts extracted", {
        description: `${res.data.concepts.length} magic keywords with semantic weights & sequence — edit below.`,
      });
    } catch (error) {
      if (isOffline(error)) {
        await new Promise((r) => setTimeout(r, 900));
        setExam(DEMO_EXAM_ID);
        hydrate(demoConcepts);
        toast.success("Key concepts extracted (demo)", {
          description: "Backend offline — loaded reference photosynthesis rubric.",
        });
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!concepts.length) {
      toast.error("Add at least one magic concept");
      return;
    }
    setSaving(true);
    const id = examId ?? DEMO_EXAM_ID;
    try {
      await examApi.saveRubric({ exam_id: id, concepts, toggles });
    } catch (error) {
      if (!isOffline(error)) {
        setSaving(false);
        return;
      }
    }
    setStep(4);
    setSaving(false);
    toast.success("Rubric saved", { description: "Proceeding to answer-sheet ingestion." });
    navigate({ to: "/ingestion", search: { exam_id: id } });
  };

  return (
    <AppShell
      crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "New Exam Setup" }]}
      title="AI Rubric Studio"
    >
      {/* Stepper */}
      <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-border pb-5">
        {STEPS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4;
          const done = step > n;
          const active = step === n;
          return (
            <div key={label} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex items-center gap-2 text-xs font-medium transition-colors",
                  active ? "text-foreground" : done ? "text-pass" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "mono-token grid size-5 place-items-center rounded-full border text-[0.625rem]",
                    done
                      ? "border-success bg-success text-success-foreground"
                      : active
                        ? "border-foreground text-foreground"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check size={11} /> : n}
                </span>
                {label}
              </div>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-border sm:w-10" />}
            </div>
          );
        })}
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Section A — upload */}
        <div className="space-y-5">
          <FileDropSlot
            label="Upload Question Paper"
            hint="Drop the question paper"
            file={questionFile}
            onPick={pickQuestion}
            onClear={() => setQuestionFile(null)}
          />

          <FileDropSlot
            label="Upload Model Answer Key"
            hint="Drop the model answer / marking scheme"
            file={answerFile}
            onPick={pickAnswer}
            onClear={() => setAnswerFile(null)}
          />

          <button
            onClick={handleExtract}
            disabled={extracting}
            className="magnetic flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {extracting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {extracting ? "Extracting key concepts…" : "Auto-Extract Key Concepts"}
          </button>

          <div>
            <p className="section-title text-[0.6875rem] font-semibold tracking-wide uppercase">
              Sensitivity Toggles
            </p>
            <div className="divide-y divide-border">
              {TOGGLES.map(({ key, title, sub, debug, Icon }) => (
                <div key={key} className="flex items-center gap-3 py-3.5">
                  <Icon size={15} className="text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mono-token text-[0.6875rem] text-muted-foreground">
                      {sub} · {debug}
                    </p>
                  </div>
                  <Switch
                    checked={toggles[key]}
                    onCheckedChange={(v) => setToggle(key, v)}
                    aria-label={title}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section B — magic concepts */}
        <div className="space-y-5">
          <div>
            <div className="section-title justify-between gap-3">
              <h2 className="text-[0.9375rem] font-semibold tracking-tight">
                Extracted Rubric — Keywords, Weights &amp; Sequence
              </h2>
              <button
                onClick={() => addConcept(newConcept("New Concept", 1))}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:text-brand"
              >
                <Plus size={13} /> Add Magic Word
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Weightage editor · total{" "}
              <span className="font-medium text-success">{totalPoints} pts</span> across{" "}
              {concepts.length} concepts
            </p>

            <div className="divide-y divide-border">
              {extracting &&
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="mt-2 h-[58px] rounded-md shimmer" />
                ))}

              {!extracting && concepts.length === 0 && (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  No concepts yet — upload both files and press Auto-Extract Key Concepts, or add a
                  keyword manually.
                </p>
              )}

              {concepts.map((c) => (
                <div key={c.id} className="py-3.5 spring-in">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pencil size={12} className="text-muted-foreground" />
                    <input
                      value={c.keyword}
                      onChange={(e) => updateConcept(c.id, { keyword: e.target.value })}
                      aria-label="Concept keyword"
                      className="min-w-[120px] flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium outline-none focus:border-brand"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={c.points}
                        onChange={(e) => updateConcept(c.id, { points: Number(e.target.value) })}
                        aria-label={`${c.keyword} weightage`}
                        className="w-24 accent-[var(--brand)]"
                      />
                      <span className="mono-token w-12 text-center text-xs font-medium text-muted-foreground">
                        {c.points}pts
                      </span>
                    </div>
                    <button
                      onClick={() => removeConcept(c.id)}
                      aria-label={`Remove ${c.keyword}`}
                      className="text-muted-foreground hover:text-alert"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {c.synonyms.map((s) => (
                      <span
                        key={s}
                        className="mono-token rounded-md border border-border px-2 py-0.5 text-[0.625rem] text-muted-foreground"
                      >
                        {s}
                      </span>
                    ))}
                    <input
                      placeholder="+ synonym ⏎"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          updateConcept(c.id, {
                            synonyms: [...c.synonyms, e.currentTarget.value.trim()],
                          });
                          e.currentTarget.value = "";
                        }
                      }}
                      aria-label={`Add synonym for ${c.keyword}`}
                      className="mono-token w-28 rounded-md border border-border bg-transparent px-2 py-0.5 text-[0.625rem] outline-none focus:border-brand"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="magnetic flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Save Rubric &amp; Proceed to Ingestion <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
