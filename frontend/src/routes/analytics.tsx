import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useAnalyticsSummary, useExams } from "@/lib/queries";
import { analyticsApi } from "@/lib/api";
import { DEMO_EXAM_ID } from "@/lib/demo-data";

export const Route = createFileRoute("/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({
    exam_id: typeof search["exam_id"] === "string" ? (search["exam_id"] as string) : DEMO_EXAM_ID,
  }),
  head: () => ({
    meta: [
      { title: "Subject Analytics — ScriptGrade" },
      {
        name: "description",
        content:
          "Single-subject performance view: concept mastery, class average per question, and the eight-debugger error breakdown for one exam session.",
      },
      { property: "og:title", content: "Subject Analytics — ScriptGrade" },
      {
        property: "og:description",
        content: "Where the class lost marks — per question and per debugger, in one subject view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const BAND_LABELS = ["0–20%", "21–40%", "41–60%", "61–80%", "81–100%"];

const TONE_FILL: Record<string, string> = {
  brand: "var(--brand)",
  light: "var(--brand-light)",
  pass: "var(--pass)",
  warn: "var(--warn)",
  alert: "var(--alert)",
  vision: "var(--vision)",
};

/** Debugger key → chart tone (matches the DebuggerPanel semantic colours). */
const DEBUGGER_TONE: Record<string, string> = {
  garbage: "alert",
  negation: "alert",
  synonym: "brand",
  spelling: "warn",
  sequence: "warn",
  vision: "vision",
  density: "warn",
  aggregator: "alert",
};

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
} as const;

function AnalyticsPage() {
  const { exam_id } = Route.useSearch();
  const navigate = useNavigate();
  const { data: exams } = useExams();
  const { data: summary, isLoading } = useAnalyticsSummary(exam_id);

  const distribution = (summary?.score_distribution ?? []).map((count, i) => ({
    band: BAND_LABELS[i] ?? `Band ${i + 1}`,
    students: count,
  }));

  const mastery = (summary?.concept_mastery ?? []).map((c) => ({
    concept: c.concept,
    mastery: c.mastery_pct,
    avg: c.awarded,
    max: c.max,
  }));

  const debuggers = (summary?.debugger_breakdown ?? []).map((d) => ({
    key: d.key,
    label: d.label,
    count: d.count,
    total: d.total,
    rate: d.rate,
  }));

  const exportFile = async (format: "csv" | "pdf") => {
    try {
      const filename = await analyticsApi.download(exam_id, format);
      toast.success(`${format.toUpperCase()} export downloaded`, { description: filename });
    } catch (error) {
      toast.error(`${format.toUpperCase()} export failed`, {
        description:
          error instanceof Error ? error.message : "Check the backend connection and try again.",
      });
    }
  };

  const maxScore = summary?.max_score ?? 10;

  return (
    <AppShell
      crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Analytics" }]}
      title="Subject Analytics"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={exam_id}
            onChange={(e) => navigate({ to: "/analytics", search: { exam_id: e.target.value } })}
            aria-label="Select subject / exam"
            className="mono-token rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
          >
            {!exams?.exams.some((e) => e.id === exam_id) && (
              <option value={exam_id}>{summary?.title ?? exam_id}</option>
            )}
            {exams?.exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => exportFile("csv")}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:border-success/50 hover:text-success"
          >
            <FileSpreadsheet size={15} className="text-success" /> Export CSV
          </button>
          <button
            onClick={() => exportFile("pdf")}
            className="magnetic inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <FileText size={15} /> Export PDF
          </button>
        </div>
      }
    >
      {isLoading && !summary ? (
        <div className="py-24 text-center text-sm text-muted-foreground">
          Loading class analytics…
        </div>
      ) : (
        <>
          <p className="mono-token -mt-2 text-[0.6875rem] text-muted-foreground">
            {summary?.title ?? "Exam"} · single-subject session
          </p>

          {/* KPI strip */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Papers scored",
                value: `${summary?.scored_papers ?? 0}`,
                sub: `of ${summary?.total_papers ?? 0}`,
                tone: "brand",
              },
              {
                label: "Class average",
                value: `${(summary?.class_average ?? 0).toFixed(2)}`,
                sub: `out of ${maxScore}`,
                tone: "pass",
              },
              {
                label: "Questions tracked",
                value: `${mastery.length}`,
                sub: "rubric concepts",
                tone: "vision",
              },
              {
                label: "Debugger signals",
                value: `${debuggers.filter((d) => d.count > 0).length}`,
                sub: `of ${debuggers.length} engines`,
                tone: "warn",
              },
            ].map((k) => (
              <div
                key={k.label}
                className="border-l border-border px-5 first:border-l-0 first:pl-0"
              >
                <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
                  {k.label}
                </p>
                <p
                  className="mt-3 text-[2rem] leading-none font-semibold tracking-tight"
                  style={{ color: TONE_FILL[k.tone] }}
                >
                  {k.value}
                  <span className="mono-token ml-2 text-xs font-normal text-muted-foreground">
                    {k.sub}
                  </span>
                </p>
              </div>
            ))}
          </div>

          {/* (a) Concept mastery + grade distribution */}
          <div className="mt-10 grid gap-10 xl:grid-cols-2">
            <section>
              <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
                Concept Mastery per Question
              </h2>
              <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
                % of class awarded full marks for each rubric concept
              </p>
              <div className="mt-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mastery}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="concept" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
                    <Bar
                      dataKey="mastery"
                      name="Mastery %"
                      radius={[2, 2, 0, 0]}
                      fill={TONE_FILL["vision"]!}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section>
              <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
                Class Average per Question
              </h2>
              <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
                mean marks earned vs full marks · out of {maxScore}
              </p>
              <div className="mt-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mastery}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="concept" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="avg"
                      name="Class avg"
                      radius={[2, 2, 0, 0]}
                      fill={TONE_FILL["brand"]!}
                    />
                    <Bar
                      dataKey="max"
                      name="Full marks"
                      radius={[2, 2, 0, 0]}
                      fill={TONE_FILL["light"]!}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Grade distribution + (b) debugger breakdown */}
          <div className="mt-10 grid gap-10 xl:grid-cols-2">
            <section>
              <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
                Grade Distribution
              </h2>
              <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
                students per score band (percentage of full marks)
              </p>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="band" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
                    <Bar dataKey="students" name="Students" radius={[2, 2, 0, 0]}>
                      {distribution.map((d, i) => (
                        <Cell
                          key={d.band}
                          fill={
                            i < 2
                              ? TONE_FILL["alert"]!
                              : i < 3
                                ? TONE_FILL["warn"]!
                                : TONE_FILL["brand"]!
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section>
              <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
                8-Debugger Error Breakdown
              </h2>
              <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
                papers where each engine raised its signal (negation, sequence, synonym gaps…)
              </p>
              <div className="mt-4 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={debuggers} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={128}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "var(--secondary)" }}
                      formatter={(value: number) => [`${value} papers`, "Signal"]}
                    />
                    <Bar dataKey="count" name="Papers" radius={[0, 2, 2, 0]}>
                      {debuggers.map((d) => (
                        <Cell key={d.key} fill={TONE_FILL[DEBUGGER_TONE[d.key] ?? "brand"]!} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Tabular detail — debugger signal rates */}
          <section className="mt-10">
            <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
              Debugger Signal Rates
            </h2>
            <div className="mt-4 space-y-3">
              {debuggers.map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{d.label}</span>
                    <span className="mono-token text-muted-foreground">
                      {d.count}/{d.total} · {d.rate}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden bg-secondary">
                    <div
                      className="h-full transition-[width] duration-700"
                      style={{
                        width: `${Math.min(100, d.rate)}%`,
                        background: TONE_FILL[DEBUGGER_TONE[d.key] ?? "brand"],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
