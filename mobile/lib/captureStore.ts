/**
 * Pending-capture store shared between the scanner and preview screens.
 *
 * File URIs and pixel dimensions must not travel through navigation params
 * (they are long, non-serializable-friendly, and survive deep links badly),
 * so the scanner writes the capture session here and the preview reads it.
 * This is module state, deliberately simple: a capture session is transient
 * and single-producer/single-consumer by UX design.
 */

export type ScanMode = 'setup' | 'paper';
export type SetupStep = 'question' | 'answer';
export type CaptureSlot = 'question' | 'answer' | 'paper';

export interface CapturedImage {
  uri: string;
  width: number;
  height: number;
}

export interface CaptureSession {
  mode: ScanMode;
  /** Selected exam target for student-sheet scans (Mode 2). */
  examId: string | null;
  examTitle: string | null;
  question: CapturedImage | null;
  answer: CapturedImage | null;
  paper: CapturedImage | null;
}

const EMPTY_SESSION: CaptureSession = {
  mode: 'paper',
  examId: null,
  examTitle: null,
  question: null,
  answer: null,
  paper: null,
};

let session: CaptureSession = { ...EMPTY_SESSION };

/** Start a fresh capture session for the given mode / exam target. */
export function beginSession(
  mode: ScanMode,
  examId: string | null,
  examTitle: string | null,
): void {
  session = { ...EMPTY_SESSION, mode, examId, examTitle };
}

/** Replace the scan mode mid-session (clears any captured documents). */
export function switchMode(mode: ScanMode): void {
  session = { ...session, mode, question: null, answer: null, paper: null };
}

/** Store a freshly captured (or freshly edited) document image. */
export function setCaptured(slot: CaptureSlot, image: CapturedImage): void {
  session = { ...session, [slot]: image };
}

/** Read the immutable current session snapshot. */
export function getSession(): CaptureSession {
  return session;
}

/** Drop all captured documents but keep the mode/exam context. */
export function clearCaptures(): void {
  session = { ...session, question: null, answer: null, paper: null };
}

/** Full reset — used after a successful upload or sign-out. */
export function resetSession(): void {
  session = { ...EMPTY_SESSION };
}
