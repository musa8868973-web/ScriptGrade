import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Clock,
  Download,
  FileSpreadsheet,
  Flag,
  MoreHorizontal,
  Plus,
  Target,
  Users,
  Wand2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/badges";
import { useExams } from "@/lib/queries";
import { scoreBands } from "@/lib/demo-data";
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

function DashboardPage() {
  const { data, isLoading } = useExams();
  const navigate = useNavigate();
  const metrics = data?.metrics;

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
          FastAPI backend unreachable at /api/v1 — rendering demo fixtures. Start the backend to load
          live data.
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-md" />)
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

      {/* Recent exams table */}
      <div className="mt-10">
        <div className="section-title justify-between">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">Recent Exams</h2>
          <span className="mono-token text-[0.625rem] text-muted-foreground">
            GET /api/v1/exams/list
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-medium">Exam Name</th>
                <th className="py-3 pr-4 font-medium">Date</th>
                <th className="py-3 pr-4 font-medium">Class Size</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Class Avg</th>
                <th className="py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={6} className="py-4">
                        <Skeleton className="h-5 w-full shimmer" />
                      </td>
                    </tr>
                  ))
                : data?.exams.map((exam) => (
                    <tr key={exam.id} className="border-b border-border transition-colors hover:bg-success/10">
                      <td className="py-4 pr-4">
                        <Link
                          to="/diagnostic-studio"
                          search={{ exam_id: exam.id }}
                          className="font-medium text-foreground hover:text-brand"
                        >
                          {exam.name}
                        </Link>
                      </td>
                      <td className="py-4 pr-4 text-muted-foreground">
                        {new Date(exam.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Users size={13} /> {exam.paper_count}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <StatusBadge status={exam.status} />
                      </td>
                      <td className="mono-token py-4 pr-4">
                        {exam.avg_score === null
                          ? "—"
                          : `${((exam.avg_score / exam.max_score) * 100).toFixed(1)}%`}
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <button
                          aria-label={`Actions for ${exam.name}`}
                          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
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
