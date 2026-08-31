import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEMO_EXAM_ID } from "@/lib/demo-data";

/** Legacy path — the grading workspace now lives at /diagnostic-studio. */
export const Route = createFileRoute("/exam/grade")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : undefined,
    exam_id: typeof search["exam_id"] === "string" ? (search["exam_id"] as string) : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/diagnostic-studio",
      search: { exam_id: search.exam_id ?? search.id ?? DEMO_EXAM_ID },
    });
  },
});
