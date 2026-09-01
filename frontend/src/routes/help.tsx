import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Compass, LifeBuoy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DEBUGGERS, toneClasses } from "@/components/debuggers/DebuggerPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Teacher Guide — ScriptGrade" },
      {
        name: "description",
        content:
          "A plain-English guide to the eight grading checks ScriptGrade runs on every answer sheet, and the four steps of the teacher workflow.",
      },
      { property: "og:title", content: "Teacher Guide — ScriptGrade" },
      {
        property: "og:description",
        content: "What each checker does and why it matters — no technical jargon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

/** Simple, non-technical explanation of each debugger for teachers. */
const GUIDE: Record<string, { title: string; what: string; marks: string }> = {
  garbage: {
    title: "Is the answer actually on-topic?",
    what: "It reads the whole response and looks for filler — copied question text, blank padding, or sentences that don't relate to the topic.",
    marks: "Waffle is ignored, so students only score for genuine content.",
  },
  negation: {
    title: "Does the meaning get flipped?",
    what: "It watches for words like 'not', 'never' or 'without' that reverse a fact. Writing 'plants do not need sunlight' is very different from naming sunlight.",
    marks: "A reversed statement earns no credit, even if the keyword appears.",
  },
  synonym: {
    title: "Same idea, different words",
    what: "It rewards the correct concept even when the student uses a different phrase — 'solar energy' still counts for 'Sunlight'.",
    marks: "Students aren't penalised for using their own words.",
  },
  spelling: {
    title: "Small typos are forgiven",
    what: "It gently fixes misspellings that are clearly close to a keyword, like 'photosinthesis' → 'photosynthesis'.",
    marks: "No marks are lost for a minor spelling slip.",
  },
  sequence: {
    title: "Steps in the right order",
    what: "For process answers, it checks the steps appear in the correct sequence rather than jumbled.",
    marks: "If strict order is on, out-of-sequence steps can lose marks.",
  },
  vision: {
    title: "Reading the diagrams",
    what: "It inspects drawings and labels on the page — a labelled diagram often carries marks of its own.",
    marks: "Verified diagram elements contribute to the score.",
  },
  density: {
    title: "Substance over length",
    what: "It measures how much of the answer is real, useful content versus padding. A short, sharp answer can beat a long, empty one.",
    marks: "Thin, padded answers are flagged so they don't over-score.",
  },
  aggregator: {
    title: "Adding it all up",
    what: "Finally it walks through every rubric point, records what the student earned on each, and totals the score.",
    marks: "This is the transparent breakdown behind the final mark.",
  },
};

const FLOW: { step: number; page: string; text: string }[] = [
  {
    step: 1,
    page: "Exam Setup",
    text: "Upload the question paper and the model answer key, press Auto-Extract Key Concepts, then edit the rubric keywords and weights and Save & Proceed.",
  },
  {
    step: 2,
    page: "Ingestion",
    text: "Upload answer sheets one-by-one or in a batch. Each sheet gets an ID (like STU-2026-001) — type the student's name and the initial score appears right below.",
  },
  {
    step: 3,
    page: "Diagnostic Studio",
    text: "Click any student to open their sheet beside the full eight-checker breakdown. Adjust the score and leave a note if you disagree with the machine.",
  },
  {
    step: 4,
    page: "Analytics",
    text: "Pick your subject to see the class average per question and which checks most often flagged mistakes across the class.",
  },
];

function HelpPage() {
  return (
    <AppShell
      crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Help" }]}
      title="Teacher Guide"
    >
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        {/* The eight checks, in plain English */}
        <section>
          <div className="section-title">
            <BookOpen size={15} className="text-brand" />
            <h2 className="text-[0.9375rem] font-semibold tracking-tight">
              The Eight Checks, In Plain English
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every answer sheet runs through the same eight automatic checks before a score is
            calculated. Here is what each one is really looking for.
          </p>
          <div className="mt-4 space-y-4">
            {DEBUGGERS.map(({ n, roman, key, label, tone, Icon }) => {
              const t = toneClasses[tone];
              const g = GUIDE[key];
              if (!g) return null;
              return (
                <div key={n} className="border border-border bg-card p-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border text-[0.625rem] font-medium",
                        t.border,
                        t.text,
                      )}
                    >
                      {roman}
                    </span>
                    <Icon size={15} className={t.text} />
                    <h3 className="text-sm font-semibold">{label}</h3>
                    <p className="mono-token ml-auto text-[0.6875rem] text-muted-foreground">
                      Checker {n} of 8
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{g.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.what}</p>
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground">
                    <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", t.dot)} />
                    <span>
                      <b className="font-medium">Marks:</b> {g.marks}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Side rail: the workflow + reassurance */}
        <div className="space-y-10">
          <section>
            <div className="section-title">
              <Compass size={15} className="text-brand" />
              <h2 className="text-[0.9375rem] font-semibold tracking-tight">The Four Steps</h2>
            </div>
            <ol className="mt-3 space-y-4">
              {FLOW.map((f) => (
                <li key={f.step} className="flex gap-3">
                  <span className="mono-token grid size-6 shrink-0 place-items-center rounded-full border border-border text-xs font-medium">
                    {f.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{f.page}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <div className="section-title">
              <LifeBuoy size={15} className="text-pass" />
              <h2 className="text-[0.9375rem] font-semibold tracking-tight">You Stay In Control</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              These checks only suggest a score. On any sheet you can open the Diagnostic Studio,
              read the reasoning, and set the final mark yourself — every change is saved with your
              note. If the service is ever offline, the app shows sample results so you can keep
              exploring.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
