/**
 * Robust dual-ingestion upload engine.
 *
 * Builds multipart/form-data payloads matching the frozen backend contract
 * (backend/app/api/v1/exams.py + papers.py, PRD §604-669) byte-for-byte:
 *
 *  Mode 1 — Exam & Answer Key setup → POST /exam/setup
 *      exam_title          : string (Form, 2..255 chars)
 *      question_file       : UploadFile (image/* or application/pdf)
 *      sample_answer_file  : UploadFile (image/* or application/pdf)
 *
 *  Mode 2 — Student answer sheet   → POST /papers/upload  (202 Accepted)
 *      file                : UploadFile (image/*)
 *      exam_id             : string (UUID Form field)
 *      student_id          : string (Form, ^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}$)
 *      source              : "mobile"
 *      language            : "en" | "ur" | "sd" | "pa"
 *
 * NOTE: the backend /exam/setup endpoint intentionally has no `subject`
 * field (see backend/app/models/exam.py — no subject column) and requires
 * two documents. The mobile UI therefore captures question paper and
 * answer key as two shots in Mode 1.
 *
 * Features: real-time upload progress, extended upload timeout, request
 * cancellation, input re-sanitization (defense-in-depth) and normalized,
 * structured errors from the backend's standardized envelope.
 */

import { useCallback, useRef, useState } from 'react';

import {
  api,
  normalizeApiError,
  NormalizedApiError,
} from '../lib/api';
import {
  isValidExamId,
  isValidExamTitle,
  isValidStudentId,
  sanitizeExamId,
  sanitizeStudentId,
  sanitizeTitle,
} from '../lib/sanitize';
import {
  ExamSetupResponse,
  PaperUploadResponse,
  ScriptLanguage,
} from '../lib/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export type UploadPhase = 'idle' | 'uploading' | 'success' | 'error';

export type UploadResult =
  | { kind: 'setup'; data: ExamSetupResponse }
  | { kind: 'paper'; data: PaperUploadResponse };

export interface UploadFileInput {
  uri: string;
  /** Optional explicit file name / mime — derived from the URI otherwise. */
  fileName?: string;
  mimeType?: string;
}

export interface SetupUploadParams {
  examTitle: string;
  questionFile: UploadFileInput;
  answerFile: UploadFileInput;
}

export interface PaperUploadParams {
  examId: string;
  studentId: string;
  file: UploadFileInput;
  language: ScriptLanguage;
}

export interface UseOSSUpload {
  phase: UploadPhase;
  /** 0..1 while uploading; 1 once the server responded. */
  progress: number;
  error: NormalizedApiError | null;
  result: UploadResult | null;
  uploadExamSetup: (params: SetupUploadParams) => Promise<UploadResult | null>;
  uploadStudentPaper: (
    params: PaperUploadParams,
  ) => Promise<UploadResult | null>;
  cancel: () => void;
  reset: () => void;
}

/** Uploads stream large images — allow up to 2 minutes on slow networks. */
const UPLOAD_TIMEOUT_MS = 120_000;

/** Client-side guard: backend upload cap is 10 MB per file. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Multipart helpers
// ---------------------------------------------------------------------------
interface FileParts {
  name: string;
  type: string;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  pdf: 'application/pdf',
};

function resolveFileParts(file: UploadFileInput, fallbackName: string): FileParts {
  const extMatch = /\.([A-Za-z0-9]+)(?:[?#].*)?$/.exec(file.uri);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const type =
    file.mimeType ?? (ext in MIME_BY_EXT ? MIME_BY_EXT[ext] : 'image/jpeg');
  const name =
    file.fileName ?? (ext ? `${fallbackName}.${ext}` : `${fallbackName}.jpg`);
  return { name, type };
}

/**
 * Append a React Native local file to FormData. RN's networking stack
 * accepts the `{uri, name, type}` descriptor shape directly; the cast keeps
 * TypeScript happy without inventing Blob polyfills.
 */
function appendFile(
  form: FormData,
  field: string,
  file: UploadFileInput,
  fallbackName: string,
): void {
  const { name, type } = resolveFileParts(file, fallbackName);
  const descriptor = {
    uri: file.uri,
    name,
    type,
  } as unknown as Blob;
  form.append(field, descriptor);
}

function validationError(message: string): NormalizedApiError {
  return {
    status: null,
    code: 'client_validation',
    message,
    isNetworkError: false,
    isTimeout: false,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useOSSUpload(): UseOSSUpload {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const beginUpload = useCallback((): AbortController => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('uploading');
    setProgress(0);
    setError(null);
    setResult(null);
    return controller;
  }, []);

  const fail = useCallback((rawError: unknown): null => {
    const normalized = normalizeApiError(rawError);
    // A user-initiated cancel surfaces as a generic axios cancellation.
    if (normalized.code === 'canceled') {
      setPhase('idle');
      setProgress(0);
      return null;
    }
    setError(normalized);
    setPhase('error');
    return null;
  }, []);

  const uploadExamSetup = useCallback(
    async (params: SetupUploadParams): Promise<UploadResult | null> => {
      // Fault-tolerant sanitization before dispatch.
      const examTitle = sanitizeTitle(params.examTitle);
      if (!isValidExamTitle(examTitle)) {
        setError(
          validationError(
            'Exam title must be between 2 and 255 characters after cleanup.',
          ),
        );
        setPhase('error');
        return null;
      }

      const controller = beginUpload();
      const form = new FormData();
      form.append('exam_title', examTitle);
      appendFile(form, 'question_file', params.questionFile, 'question_paper');
      appendFile(
        form,
        'sample_answer_file',
        params.answerFile,
        'sample_answer',
      );

      try {
        const response = await api.post<ExamSetupResponse>(
          '/exam/setup',
          form,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: UPLOAD_TIMEOUT_MS,
            maxContentLength: MAX_FILE_BYTES * 4,
            signal: controller.signal,
            onUploadProgress: (event) => {
              if (event.total && event.total > 0) {
                setProgress(Math.min(event.loaded / event.total, 0.99));
              } else {
                setProgress((current) => Math.min(current + 0.05, 0.9));
              }
            },
          },
        );
        const value: UploadResult = { kind: 'setup', data: response.data };
        setProgress(1);
        setResult(value);
        setPhase('success');
        return value;
      } catch (rawError) {
        return fail(rawError);
      }
    },
    [beginUpload, fail],
  );

  const uploadStudentPaper = useCallback(
    async (params: PaperUploadParams): Promise<UploadResult | null> => {
      // Fault-tolerant sanitization before dispatch.
      const examId = sanitizeExamId(params.examId);
      const studentId = sanitizeStudentId(params.studentId);
      if (!isValidExamId(examId)) {
        setError(validationError('A valid exam must be selected first.'));
        setPhase('error');
        return null;
      }
      if (!isValidStudentId(studentId)) {
        setError(
          validationError(
            'Student ID must be 1-64 letters, digits, spaces, dots, dashes or underscores and start with a letter or digit.',
          ),
        );
        setPhase('error');
        return null;
      }

      const controller = beginUpload();
      const form = new FormData();
      appendFile(form, 'file', params.file, 'student_sheet');
      form.append('exam_id', examId);
      form.append('student_id', studentId);
      form.append('source', 'mobile');
      form.append('language', params.language);

      try {
        const response = await api.post<PaperUploadResponse>(
          '/papers/upload',
          form,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: UPLOAD_TIMEOUT_MS,
            maxContentLength: MAX_FILE_BYTES * 4,
            signal: controller.signal,
            onUploadProgress: (event) => {
              if (event.total && event.total > 0) {
                setProgress(Math.min(event.loaded / event.total, 0.99));
              } else {
                setProgress((current) => Math.min(current + 0.05, 0.9));
              }
            },
          },
        );
        const value: UploadResult = { kind: 'paper', data: response.data };
        setProgress(1);
        setResult(value);
        setPhase('success');
        return value;
      } catch (rawError) {
        return fail(rawError);
      }
    },
    [beginUpload, fail],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('idle');
    setProgress(0);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('idle');
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  return {
    phase,
    progress,
    error,
    result,
    uploadExamSetup,
    uploadStudentPaper,
    cancel,
    reset,
  };
}
