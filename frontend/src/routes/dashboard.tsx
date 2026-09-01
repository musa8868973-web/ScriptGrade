import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  Flag,
  Plus,
  Search,
  Target,
  Wand2,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { useExams, usePaperQueue } from "@/lib/queries";
import { DEMO_EXAM_ID, scoreBands } from "@/lib/demo-data";
import type { PaperStatus } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Exam Hub — ScriptGrade Dashboard" },
      {
        name: "description",
        content:
          "Monitor exams, grading accuracy, hours saved, and score distribution across every graded class in ScriptGrade.",
      },
      { property: "og:title", content: "Exam Hub — ScriptGrade Dashboard" },
      {
        property: "og:description",
        content: "Live exam pipeline, accuracy metrics, and score distribution analytics.",
      },
    ],
  }),
  component: DashboardPage,
});

function MetricCard({
  label,
  value,
  hint,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  Icon: typeof Activity;
  tone: string;
}) {
  return (
    <div className="border-l border-border px-5 first:border-l-0 first:pl-0">
      <div className="flex items-center gap-2 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
        <Icon size={13} className={tone} />
        {label}
      </div>
      <p className="mt-3 text-[2rem] leading-none font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Percentage clamped to a strict 0–100 ceiling. Eliminates the >100% anomalies
 * (e.g. 108%, 282.5%) that surface when a raw score exceeds the stored max.
 */
function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Paper lifecycle → teacher-facing roster status (spec §2: Graded/Moderated/Flagged). */
const ROSTER_STATUS: Record<PaperStatus, { label: string; className: string }> = {
  uploaded: { label: "Grading", className: "text-muted-foreground" },
  queued: { label: "Grading", className: "text-muted-foreground" },
  ocr_in_progress: { label: "Grading", className: "text-vision" },
  flagged: { label: "Flagged", className: "text-alert" },
  needs_review: { label: "Flagged", className: "text-warn" },
  evaluated: { label: "Graded", className: "text-pass" },
  scored: { label: "Graded", className: "text-pass" },
  override_applied: { label: "Moderated", className: "text-brand" },
  finalized: { label: "Graded", className: "text-pass" },
  exported: { label: "Graded", className: "text-pass" },
};

function DashboardPage() {
  const { data, isLoading } = useExams();
  const navigate = useNavigate();
  const metrics = data?.metrics;

  // Single-subject model — 1 teacher = 1 course/session, so the roster is that
  // exam's student submissions (falls back to demo fixtures when offline).
  const primaryExam = data?.exams[0] ?? null;
  const examId = primaryExam?.id ?? DEMO_EXAM_ID;
  const { data: roster } = usePaperQueue(primaryExam?.id ?? "");
  const [query, setQuery] = useState("");
  const rosterRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (roster?.papers ?? []).filter(
      (p) =>
        !q ||
        p.student_id.toLowerCase().includes(q) ||
        (p.student_name ?? "").toLowerCase().includes(q),
    );
  }, [roster, query]);
  const openStudio = (studentId: string) =>
    navigate({ to: "/diagnostic-studio", search: { exam_id: examId, student_id: studentId } });

  return (
    <AppShell
      crumbs={[{ label: "ScriptGrade", to: "/dashboard" }, { label: "Exam Hub" }]}
      title="Exam Hub"
      actions={
        <button
          onClick={() => navigate({ to: "/exam/setup" })}
          className="magnetic inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} /> Create &amp; Grade New Exam
        </button>
      }
    >
      {data?.demo && (
        <p className="mono-token mb-6 border-l-2 border-warn pl-3 text-xs text-warn">
          FastAPI backend unreachable at /api/v1 — rendering demo fixtures. Start the backend to
          load live data.
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-md" />
          ))
        ) : (
          <>
            <MetricCard
              label="Total Exams"
              value={String(metrics.total_exams)}
              hint="Across all classes this session"
              Icon={FileSpreadsheet}
              tone="text-brand"
            />
            <MetricCard
              label="Grading Accuracy"
              value={`${metrics.accuracy_pct.toFixed(1)}%`}
              hint="Teacher-confirmed vs AI-scored"
              Icon={Target}
              tone="text-pass"
            />
            <MetricCard
              label="Hours Saved"
              value={`${metrics.hours_saved}h`}
              hint="At 0.35 min/paper manual baseline"
              Icon={Clock}
              tone="text-vision"
            />
            <MetricCard
              label="Flagged Papers"
              value="2"
              hint="Awaiting teacher moderation"
              Icon={Flag}
              tone="text-warn"
            />
          </>
        )}
      </div>

      {/* Student roster / submissions — single-subject view (spec §1 & §2) */}
      <div className="mt-10">
        <div className="section-title justify-between gap-4">
          <div>
            <h2 className="text-[0.9375rem] font-semibold tracking-tight">
              Student Roster &amp; Submissions
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {primaryExam ? primaryExam.name : "Current subject"} · {rosterRows.length}{" "}
              {rosterRows.length === 1 ? "student" : "students"}
            </p>
          </div>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or ID…"
              aria-label="Search students by name or ID"
              className="h-9 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-brand"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-medium">Student ID</th>
                <th className="py-3 pr-4 font-medium">Student Name</th>
                <th className="py-3 pr-4 font-medium">Assessment</th>
                <th className="py-3 pr-4 font-medium">Date</th>
                <th className="py-3 pr-4 font-medium">Score</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="py-4">
                      <Skeleton className="h-5 w-full shimmer" />
                    </td>
                  </tr>
                ))
              ) : rosterRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {query
                      ? `No students match "${query}".`
                      : "No submissions yet — upload answer sheets from Ingestion to populate this roster."}
                  </td>
                </tr>
              ) : (
                rosterRows.map((p) => {
                  const pct =
                    p.score !== null && p.max_score
                      ? clampPct((p.score / p.max_score) * 100)
                      : null;
                  const status = ROSTER_STATUS[p.status];
                  return (
                    <tr
                      key={p.id}
                      onClick={() => openStudio(p.student_id)}
                      className="cursor-pointer border-b border-border transition-colors hover:bg-success/10"
                    >
                      <td className="mono-token py-4 pr-4 font-medium">{p.student_id}</td>
                      <td className="py-4 pr-4">
                        {p.student_name ?? (
                          <span className="text-muted-foreground italic">Unnamed</span>
                        )}
                      </td>
                      <td className="py-4 pr-4 text-muted-foreground">
                        {primaryExam?.name ?? "—"}
                      </td>
                      <td className="py-4 pr-4 text-muted-foreground">
                        {primaryExam
                          ? new Date(primaryExam.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-4 pr-4">
                        <span className="mono-token font-medium">
                          {pct === null ? "—" : `${pct.toFixed(0)}%`}
                        </span>
                        <span className="mono-token ml-1.5 text-xs text-muted-foreground">
                          {p.score === null ? "—" : `${p.score}/${p.max_score}`}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`pill-soft inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide ${status.className}`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {status.label}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <button
                          title="Inspect in Diagnostic Studio"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudio(p.student_id);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                        >
                          Inspect in Diagnostic Studio <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <div>
          <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
            Score Distribution
          </h2>
          <p className="mt-3 mb-4 text-xs text-muted-foreground">
            Students per score band · current cohort
          </p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreBands}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="band" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v) => [`${v} students`, "Count"]}
                />
                <Bar dataKey="count" fill="var(--brand)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
            Quick Actions
          </h2>
          <p className="mt-3 text-xs text-muted-foreground">
            Press ⌘K for the full command palette
          </p>
          <div className="mt-2 divide-y divide-border">
            {[
              { label: "Re-extract rubric with Qwen AI", to: "/exam/setup", Icon: Wand2 },
              { label: "Review flagged papers", to: "/diagnostic-studio", Icon: Flag },
              { label: "Download class report", to: "/analytics", Icon: Download },
            ].map(({ label, to, Icon }) => (
              <Link
                key={label}
                to={to}
                className="flex items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-brand"
              >
                <Icon size={15} className="text-muted-foreground" />
                {label}
                <ArrowUpRight size={14} className="ml-auto text-success" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
