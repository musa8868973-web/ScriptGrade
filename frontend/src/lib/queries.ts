import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { examApi, isOffline, paperApi } from "./api";
import {
  demoExamsResponse,
  demoPaperDetail,
  demoQueue,
  DEMO_EXAM_ID,
} from "./demo-data";
import {
  TERMINAL_QUEUE_STATES,
  type ExamsListResponse,
  type PaperDetail,
  type PaperQueueResponse,
} from "./types";

/** Query keys factory — single source of truth (PRD §5.3) */
export const queryKeys = {
  exams: () => ["exams"] as const,
  examDetail: (id: string) => ["exam", id] as const,
  paperQueue: (examId: string) => ["paperQueue", examId] as const,
  paper: (studentId: string) => ["paper", studentId] as const,
  dashMetrics: () => ["dashMetrics"] as const,
};

export const retryConfig = {
  retry: (failureCount: number, error: unknown) => (isOffline(error) ? false : failureCount < 2),
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
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
        if (isOffline(error)) return { ...demoQueue, exam_id: examId || DEMO_EXAM_ID };
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

export function usePaper(studentId: string | null) {
  return useQuery<PaperDetail>({
    queryKey: queryKeys.paper(studentId ?? "none"),
    enabled: Boolean(studentId),
    queryFn: async () => {
      try {
        const res = await paperApi.detail(studentId!);
        return res.data;
      } catch (error) {
        if (isOffline(error)) return demoPaperDetail(studentId!);
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
        const res = await paperApi.override(studentId, payload);
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
      queryClient.invalidateQueries({ queryKey: queryKeys.paper(studentId) });
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
            jobs: files.map((f, i) => ({
              job_id: `job_${i}`,
              student_inferred_id: `STU-${200 + i}`,
            })),
          };
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      toast.success(`${data.jobs.length} sheets queued`, {
        description: `Batch ${data.batch_id} dispatched to Qwen-VL OCR workers.`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.paperQueue(examId) });
    },
  });
}
