import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ScriptGrade AI Grading Platform" },
      {
        name: "description",
        content:
          "Secure institutional sign-in to the ScriptGrade AI grading and 8-debugger diagnostic workspace.",
      },
      { property: "og:title", content: "Sign in — ScriptGrade" },
      {
        property: "og:description",
        content: "Grading that thinks like a teacher — at machine speed.",
      },
    ],
  }),
  component: () => <AuthScreen initialTab="signin" />,
});
