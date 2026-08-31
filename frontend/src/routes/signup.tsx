import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — ScriptGrade AI Grading" },
      {
        name: "description",
        content:
          "Register your institution on ScriptGrade to automate script grading with transparent NLP diagnostics.",
      },
      { property: "og:title", content: "Create account — ScriptGrade" },
      {
        property: "og:description",
        content: "Register teachers, department heads, and exam controllers on ScriptGrade.",
      },
    ],
  }),
  component: () => <AuthScreen initialTab="signup" />,
});
