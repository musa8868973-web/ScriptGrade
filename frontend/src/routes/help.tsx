import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, LifeBuoy, Terminal } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DEBUGGERS, toneClasses } from "@/components/debuggers/DebuggerPanel";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & API Reference — ScriptGrade" },
      {
        name: "description",
        content:
          "How the ScriptGrade 8-debugger engine grades handwritten scripts, plus the REST endpoints the dashboard consumes.",
      },
      { property: "og:title", content: "Help & API Reference — ScriptGrade" },
      {
        property: "og:description",
        content: "Debugger reference and endpoint map for the ScriptGrade dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

const ENDPOINTS: { method: "GET" | "POST" | "PUT"; path: string }[] = [
  { method: "POST", path: "/auth/login" },
  { method: "GET", path: "/exams/list" },
  { method: "POST", path: "/exam/setup" },
  { method: "PUT", path: "/exam/rubric" },
  { method: "POST", path: "/papers/batch-upload" },
  { method: "GET", path: "/papers/queue?exam_id=" },
  { method: "GET", path: "/papers/{student_id}" },
  { method: "POST", path: "/papers/{student_id}/override" },
  { method: "GET", path: "/analytics/export?format=csv|pdf" },
];

const METHOD_TONE: Record<"GET" | "POST" | "PUT", string> = {
  GET: "text-success",
  POST: "text-brand",
  PUT: "text-warn",
};

function HelpPage() {
  return (
    <AppShell
      crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Help" }]}
      title="Help & API Reference"
    >
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section>
          <div className="section-title">
            <BookOpen size={15} className="text-brand" />
            <h2 className="text-[0.9375rem] font-semibold tracking-tight">The 8 Debuggers</h2>
          </div>
          <div className="divide-y divide-border">
            {DEBUGGERS.map(({ n, roman, label, tone, Icon }) => {
              const t = toneClasses[tone];
              return (
                <div
                  key={n}
                  className="flex items-center gap-3 py-3.5"
                >
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full border text-[0.625rem] font-medium",
                      t.border,
                      t.text,
                    )}
                  >
                    {roman}
                  </span>
                  <Icon size={14} className={t.text} />
                  <p className="text-sm font-medium">{label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-10">
          <section>
            <div className="section-title">
              <Terminal size={15} className="text-brand" />
              <h2 className="text-[0.9375rem] font-semibold tracking-tight">Endpoints</h2>
            </div>
            <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
              base {API_BASE_URL}
            </p>
            <ul className="mono-token mt-2 divide-y divide-border text-xs text-muted-foreground">
              {ENDPOINTS.map(({ method, path }) => (
                <li key={`${method} ${path}`} className="flex gap-3 py-2.5">
                  <span className={cn("w-10 shrink-0 font-semibold", METHOD_TONE[method])}>
                    {method}
                  </span>
                  {path}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="section-title">
              <LifeBuoy size={15} className="text-pass" />
              <h2 className="text-[0.9375rem] font-semibold tracking-tight">Offline demo mode</h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              When the grading backend is unreachable the dashboard falls back to PRD-shaped demo
              fixtures, so every screen stays explorable.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
