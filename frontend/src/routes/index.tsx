import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ScriptGrade — AI Automated Script Grading & Diagnostics" },
      {
        name: "description",
        content:
          "ScriptGrade grades handwritten exam scripts with Qwen-VL OCR and an 8-debugger NLP engine — transparent diagnostics, teacher overrides, and class analytics.",
      },
      { property: "og:title", content: "ScriptGrade — AI Script Grading Platform" },
      {
        property: "og:description",
        content: "Grading that thinks like a teacher — at machine speed.",
      },
    ],
  }),
  component: () => <AuthScreen initialTab="signin" />,
});
