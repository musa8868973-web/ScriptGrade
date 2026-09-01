import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { analyticsApi, examApi, isOffline, isUnavailable, paperApi } from "./api";
import {
  demoAnalyticsSummary,
  demoExamsResponse,
  demoPaperDetail,
  demoQueue,
  DEMO_EXAM_ID,
} from "./demo-data";
import {
  TERMINAL_QUEUE_STATES,
  type AnalyticsSummary,
  type ExamsListResponse,
  type PaperDetail,
  type PaperQueueResponse,
} from "./types";

/** Query keys factory — single source of truth (PRD §5.3) */
export const queryKeys = {
  exams: () => ["exams"] as const,
  examDetail: (id: string) => ["exam", id] as const,
  paperQueue: (examId: string) => ["paperQueue", examId] as const,
  paper: (studentId: string, examId?: string) =>
    examId ? ([`paper`, studentId, examId] as const) : ([`paper`, studentId] as const),
  analytics: (examId: string) => ["analytics", examId] as const,
  dashMetrics: () => ["dashMetrics"] as const,
};

/** PRD §7.3 — no retry on 4xx (validation/auth) or network failures (demo
 * fixtures render instantly); retry transient 5xx up to 3× with exponential
 * backoff capped at 10s (1s → 2s → 4s). */
export const retryConfig = {
  retry: (failureCount: number, error: unknown) => {
    if (isOffline(error)) return false;
    if (axios.isAxiosError(error) && error.response && error.response.status < 500) return false;
    return failureCount < 3;
  },
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
};

export function useExams() {
  return useQuery<ExamsListResponse & { demo: boolean }>({
    queryKey: queryKeys.exams(),
    queryFn: async () => {
      try {
        const res = await examApi.list();
        return { ...res.data, demo: false };
      } catch (error) {
        if (isOffline(error)) return { ...demoExamsResponse, demo: true };
        throw error;
      }
    },
    ...retryConfig,
  });
}

export function usePaperQueue(examId: string) {
  return useQuery<PaperQueueResponse>({
    queryKey: queryKeys.paperQueue(examId),
    queryFn: async () => {
      try {
        const res = await paperApi.queue(examId);
        return res.data;
      } catch (error) {
        // `/papers/queue` is the Frontend PRD §5.3 polling contract; the local
        // backend build does not implement it (Backend PRD §8.7) → 404 renders
        // demo fixtures so the queue UI stays stable.
        if (isUnavailable(error)) return { ...demoQueue, exam_id: examId || DEMO_EXAM_ID };
        throw error;
      }
    },
    // 3s polling while papers are still processing; stops when all reach a terminal state
    refetchInterval: (query) => {
      const papers = query.state.data?.papers;
      if (!papers?.length) return 3000;
      return papers.every((p) => TERMINAL_QUEUE_STATES.includes(p.status)) ? false : 3000;
    },
    ...retryConfig,
  });
}

export function usePaper(studentId: string | null, examId?: string) {
  return useQuery<PaperDetail>({
    queryKey: queryKeys.paper(studentId ?? "none", examId),
    enabled: Boolean(studentId),
    queryFn: async () => {
      try {
        const res = await paperApi.detail(studentId!, examId);
        return res.data;
      } catch (error) {
        // Demo queue IDs (STU-…) 404 against a live backend — fall back to the
        // demo paper so the studio never hangs on an empty payload.
        if (isUnavailable(error)) return demoPaperDetail(studentId!);
        throw error;
      }
    },
    ...retryConfig,
  });
}

export function useOverride(studentId: string, examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { override_score: number; moderation_note: string }) => {
      try {
        const res = await paperApi.override(studentId, payload, examId);
        return res.data;
      } catch (error) {
        if (isOffline(error)) return { applied: true, final_score: payload.override_score };
        throw error;
      }
    },
    onSuccess: (data) => {
      toast.success("Override applied", {
        description: `${studentId} finalized at ${data.final_score} pts — audit note recorded.`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.paper(studentId, examId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.paperQueue(examId) });
    },
  });
}

export function useBatchUpload(examId: string, onProgress?: (pct: number) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      try {
        const res = await paperApi.batchUpload(files, examId, onProgress);
        return res.data;
      } catch (error) {
        if (isOffline(error)) {
          onProgress?.(100);
          return {
            batch_id: `batch_demo_${Date.now()}`,
            total_papers: files.length,
            status: "processing",
            papers: [],
          };
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      toast.success(`${data.total_papers} sheets queued`, {
        description: `Batch ${data.batch_id} dispatched to Qwen-VL OCR workers.`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.paperQueue(examId) });
    },
  });
}

/** Persist the teacher's ID↔name mapping for one auto-assigned paper. */
export function useSetStudentName(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, name }: { studentId: string; name: string }) => {
      try {
        const res = await paperApi.setIdentity(studentId, name, examId);
        return res.data;
      } catch (error) {
        if (isOffline(error)) {
          return {
            status: "identity_saved",
            paper_id: studentId,
            student_id: studentId,
            student_name: name,
          };
        }
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paperQueue(examId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.paper(variables.studentId, examId) });
    },
  });
}

export function useAnalyticsSummary(examId: string) {
  return useQuery<AnalyticsSummary>({
    queryKey: queryKeys.analytics(examId),
    queryFn: async () => {
      try {
        const res = await analyticsApi.summary(examId);
        return res.data;
      } catch (error) {
        if (isUnavailable(error)) return demoAnalyticsSummary(examId || DEMO_EXAM_ID);
        throw error;
      }
    },
    ...retryConfig,
  });
}
