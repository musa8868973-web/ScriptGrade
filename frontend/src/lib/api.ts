import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import type {
  ExamSetupResponse,
  ExamsListResponse,
  EvaluationToggles,
  MagicConcept,
  OverrideResponse,
  PaperDetail,
  PaperQueueResponse,
  Teacher,
} from "./types";

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ??
  "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

/** Request interceptor — attach JWT bearer token (PRD §5.1) */
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Response interceptor — backend security contract: 401 / 422 / 500 */
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ detail?: string | { msg: string }[] }>) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(" · ")
          : error.message;

    if (status === 401) {
      useAuthStore.getState().clearToken();
      toast.error("Session expired", { description: "Please sign in again." });
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    } else if (status === 422) {
      toast.error("Validation error (422)", { description: message });
    } else if (status && status >= 500) {
      toast.error("Grading service error (500)", { description: message });
    }
    return Promise.reject(error);
  },
);

/** True when the FastAPI backend is unreachable — UI falls back to demo fixtures. */
export const isOffline = (error: unknown) =>
  axios.isAxiosError(error) && (!error.response || error.code === "ERR_NETWORK");

export const authApi = {
  login: (payload: { email: string; password: string }) =>
    api.post<{ access_token: string; teacher: Teacher }>("/auth/login", payload),
  signup: (payload: {
    full_name: string;
    email: string;
    institution: string;
    role: string;
    password: string;
  }) => api.post<{ access_token: string; teacher: Teacher }>("/auth/signup", payload),
};

export const examApi = {
  list: () => api.get<ExamsListResponse>("/exams/list"),
  setup: (form: FormData) =>
    api.post<ExamSetupResponse>("/exam/setup", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  saveRubric: (payload: {
    exam_id: string;
    concepts: MagicConcept[];
    toggles: EvaluationToggles;
  }) => api.put<{ exam_id: string; saved: boolean }>("/exam/rubric", payload),
};

export const paperApi = {
  batchUpload: (
    files: File[],
    examId: string,
    onProgress?: (pct: number) => void,
  ) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("exam_id", examId);
    form.append("source", "web_dashboard");
    return api.post<{ batch_id: string; jobs: { job_id: string; student_inferred_id: string }[] }>(
      "/papers/batch-upload",
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) =>
          onProgress?.(Math.round((e.loaded / (e.total ?? e.loaded)) * 100)),
      },
    );
  },
  queue: (examId: string) =>
    api.get<PaperQueueResponse>("/papers/queue", { params: { exam_id: examId } }),
  detail: (studentId: string) => api.get<PaperDetail>(`/papers/${studentId}`),
  override: (studentId: string, payload: { override_score: number; moderation_note: string }) =>
    api.post<OverrideResponse>(`/papers/${studentId}/override`, payload),
};

export const analyticsApi = {
  exportUrl: (examId: string, format: "csv" | "pdf") =>
    `${API_BASE_URL}/analytics/export?exam_id=${encodeURIComponent(examId)}&format=${format}`,
};
