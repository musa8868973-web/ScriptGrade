import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { usePaperQueue } from "@/lib/queries";
import { analyticsApi } from "@/lib/api";
import { DEMO_EXAM_ID } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({
    exam_id: typeof search["exam_id"] === "string" ? (search["exam_id"] as string) : DEMO_EXAM_ID,
  }),
  head: () => ({
    meta: [
      { title: "Performance Insights & Class Reports — ScriptGrade" },
      {
        name: "description",
        content:
          "Grade distribution charts, class performance heatmaps, common error clusters, and one-click PDF/CSV exports for every graded exam.",
      },
      { property: "og:title", content: "Performance Insights & Class Reports" },
      {
        property: "og:description",
        content: "See where a whole class lost marks — and export the report in one click.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const BANDS = [
  { label: "0–2", min: 0, max: 2 },
  { label: "3–4", min: 3, max: 4 },
  { label: "5–6", min: 5, max: 6 },
  { label: "7–8", min: 7, max: 8 },
  { label: "9–10", min: 9, max: 10 },
];

const ERROR_CLUSTERS = [
  { cluster: "Missed Chlorophyll concept", count: 18, tone: "alert" },
  { cluster: "Negation reversal on light absorption", count: 11, tone: "alert" },
  { cluster: "Sequence steps out of order", count: 9, tone: "warn" },
  { cluster: "Low keyword density (padding)", count: 7, tone: "warn" },
  { cluster: "Spelling variants of photosynthesis", count: 6, tone: "vision" },
] as const;

const CONCEPT_TRENDS = [
  { concept: "Sunlight", mastery: 92 },
  { concept: "Chlorophyll", mastery: 64 },
  { concept: "Glucose", mastery: 78 },
  { concept: "CO₂", mastery: 85 },
  { concept: "Oxygen", mastery: 88 },
];

const TONE_FILL: Record<string, string> = {
  brand: "var(--brand)",
  light: "var(--brand-light)",
  pass: "var(--pass)",
  warn: "var(--warn)",
  alert: "var(--alert)",
  vision: "var(--vision)",
};

function heatTone(pct: number) {
  if (pct >= 85) return "text-pass";
  if (pct >= 70) return "text-vision";
  if (pct >= 55) return "text-warn";
  return "text-alert";
}

function AnalyticsPage() {
  const { exam_id } = Route.useSearch();
  const { data: queue } = usePaperQueue(exam_id);
  const papers = queue?.papers ?? [];

  const scored = papers.filter((p) => p.score !== null);

  const distribution = useMemo(
    () =>
      BANDS.map((b) => ({
        band: b.label,
        students: scored.filter((p) => (p.score ?? 0) >= b.min && (p.score ?? 0) <= b.max).length,
      })),
    [scored],
  );

  const avg = scored.length
    ? scored.reduce((s, p) => s + (p.score ?? 0), 0) / scored.length
    : 0;

  const heatmap = useMemo(
    () =>
      Array.from({ length: 6 }, (_, row) => ({
        group: `Group ${String.fromCharCode(65 + row)}`,
        cells: CONCEPT_TRENDS.map((c, i) => ({
          concept: c.concept,
          pct: Math.max(
            32,
            Math.min(99, Math.round(c.mastery + ((row * 7 + i * 11) % 23) - 11)),
          ),
        })),
      })),
    [],
  );

  const exportFile = (format: "csv" | "pdf") => {
    const url = analyticsApi.exportUrl(exam_id, format);
    toast.success(`${format.toUpperCase()} export requested`, {
      description: `GET ${url}`,
    });
  };

  return (
    <AppShell
      crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Analytics" }]}
      title="Performance Insights & Class Reports"
      actions={
        <>
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
        </>
      }
    >
      {/* KPI strip */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Papers scored", value: String(scored.length), tone: "brand" },
          { label: "Class average", value: `${avg.toFixed(2)}/10`, tone: "pass" },
          {
            label: "Needs review",
            value: String(papers.filter((p) => p.status === "needs_review").length),
            tone: "warn",
          },
          { label: "Error clusters", value: String(ERROR_CLUSTERS.length), tone: "vision" },
        ].map((k) => (
          <div key={k.label} className="border-l border-border px-5 first:border-l-0 first:pl-0">
            <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
              {k.label}
            </p>
            <p
              className="mt-3 text-[2rem] leading-none font-semibold tracking-tight"
              style={{ color: TONE_FILL[k.tone] }}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 xl:grid-cols-2">
        {/* Grade distribution */}
        <section>
          <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
            Grade Distribution
          </h2>
          <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
            students per score band · exam {exam_id}
          </p>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="band" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="students" radius={[2, 2, 0, 0]}>
                  {distribution.map((d, i) => (
                    <Cell
                      key={d.band}
                      fill={i < 2 ? TONE_FILL["alert"]! : i < 3 ? TONE_FILL["warn"]! : TONE_FILL["brand"]!}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Concept mastery trend */}
        <section>
          <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
            Concept Mastery
          </h2>
          <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
            % of class awarded full marks per rubric concept
          </p>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CONCEPT_TRENDS}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="concept" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="mastery"
                  stroke={TONE_FILL["vision"]!}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: TONE_FILL["vision"]! }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Heatmap */}
      <section className="mt-10 overflow-x-auto">
        <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
          Class Performance Heatmap
        </h2>
        <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
          concept mastery % by tutorial group
        </p>
        <table className="mt-4 w-full min-w-[620px] text-left text-xs">
          <thead>
            <tr className="border-b border-border text-[0.625rem] tracking-wide uppercase">
              <th className="px-2 py-2 font-medium text-muted-foreground">Group</th>
              {CONCEPT_TRENDS.map((c) => (
                <th key={c.concept} className="px-2 py-2 font-medium text-muted-foreground">
                  {c.concept}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.map((row) => (
              <tr key={row.group} className="border-b border-border">
                <td className="mono-token px-2 py-2 font-medium">{row.group}</td>
                {row.cells.map((cell) => (
                  <td key={cell.concept} className="px-1 py-1.5">
                    <div
                      className={cn("mono-token px-2 py-2 text-center font-medium", heatTone(cell.pct))}
                    >
                      {cell.pct}%
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Error clusters */}
      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section>
          <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
            Common Error Clusters
          </h2>
          <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
            aggregated across the 8-debugger engine
          </p>
          <div className="mt-4 space-y-3">
            {ERROR_CLUSTERS.map((e) => (
              <div key={e.cluster}>
                <div className="flex items-center justify-between text-xs">
                  <span>{e.cluster}</span>
                  <span className="mono-token text-muted-foreground">{e.count} students</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden bg-secondary">
                  <div
                    className="h-full transition-[width] duration-700"
                    style={{
                      width: `${(e.count / ERROR_CLUSTERS[0].count) * 100}%`,
                      background: TONE_FILL[e.tone],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
            Error Share
          </h2>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ERROR_CLUSTERS.map((e) => ({ name: e.cluster, value: e.count }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={86}
                  paddingAngle={3}
                >
                  {ERROR_CLUSTERS.map((e) => (
                    <Cell key={e.cluster} fill={TONE_FILL[e.tone]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <button
            onClick={() => exportFile("csv")}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border py-2.5 text-xs font-medium transition-colors hover:border-success/50 hover:text-success"
          >
            <Download size={14} /> Download cluster breakdown
          </button>
        </section>
      </div>
    </AppShell>
  );
}
