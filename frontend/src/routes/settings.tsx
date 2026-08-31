import { createFileRoute } from "@tanstack/react-router";
import { Ruler, ShieldCheck, SpellCheck2, Workflow } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Switch } from "@/components/ui/switch";
import { useRubricStore } from "@/stores/rubric";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Evaluation Settings — ScriptGrade" },
      {
        name: "description",
        content:
          "Configure default 8-debugger evaluation behaviour: fuzzy spelling correction, strict DAG ordering, and density scoring.",
      },
      { property: "og:title", content: "Evaluation Settings — ScriptGrade" },
      {
        property: "og:description",
        content: "Institution-wide defaults for the ScriptGrade grading engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { toggles, setToggle } = useRubricStore();

  const rows = [
    {
      key: "spelling_correction" as const,
      label: "Fuzzy spelling correction",
      hint: "Levenshtein ≥ 0.85 similarity is treated as a match.",
      Icon: SpellCheck2,
      tone: "text-success",
    },
    {
      key: "strict_dag_order" as const,
      label: "Strict DAG sequence order",
      hint: "Penalise answers where process steps appear out of order.",
      Icon: Workflow,
      tone: "text-brand",
    },
    {
      key: "density_scoring" as const,
      label: "Density scoring",
      hint: "Flag padded answers with a low valid-keyword ratio.",
      Icon: Ruler,
      tone: "text-warn",
    },
  ];

  return (
    <AppShell
      crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Settings" }]}
      title="Evaluation Settings"
    >
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)]">
        <section>
          <h2 className="section-title text-[0.9375rem] font-semibold tracking-tight">
            Engine Defaults
          </h2>
          <p className="mono-token mt-3 text-[0.625rem] text-muted-foreground">
            applied to every new exam via PUT /exam/rubric
          </p>
          <div className="mt-2 divide-y divide-border">
            {rows.map(({ key, label, hint, Icon, tone }) => (
              <div
                key={key}
                className="flex items-center gap-3 py-4"
              >
                <Icon size={15} className={tone} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <Switch
                  checked={toggles[key]}
                  onCheckedChange={(v) => setToggle(key, v)}
                  aria-label={label}
                  className="ml-auto"
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title">
            <ShieldCheck size={15} className="text-pass" />
            <h2 className="text-[0.9375rem] font-semibold tracking-tight">Audit &amp; Access</h2>
          </div>
          <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
            <li>• Every teacher override is written to an immutable audit trail.</li>
            <li>• Role-based access: teacher, department head, exam controller.</li>
            <li>• JWT bearer sessions expire after 24 hours of inactivity.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
