/**
 * Fault-tolerant input sanitization for payload fields.
 *
 * Rules mirror the backend validators so a value that passes here also
 * passes the API:
 *  - student_id: backend `papers.py` pattern `^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}$`
 *  - exam_id:    backend parses a UUID (FastAPI `UUID` form field)
 *  - titles:     backend `Form(min_length=2, max_length=255)`
 *
 * All functions strip control characters and path-traversal sequences so a
 * hostile or careless clipboard paste can never smuggle `../`, NUL bytes or
 * zero-width characters into multipart fields or OSS object keys.
 */

// Built via `new RegExp` with explicit \u escapes so no invisible control or
// zero-width characters are ever embedded literally in this source file.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');
const ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g');
const WHITESPACE_RUN = /\s+/g;
const TRAVERSAL = /\.{2,}[\\/]?/g;

const STUDENT_ID_ALLOWED = /[^A-Za-z0-9 _.\-]/g;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Remove control/zero-width chars, traversal sequences and fold whitespace. */
export function stripUnsafe(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(ZERO_WIDTH, '')
    .replace(TRAVERSAL, '')
    .replace(WHITESPACE_RUN, ' ')
    .trim();
}

/** Sanitize a student roll number for `student_id` (max 64 chars). */
export function sanitizeStudentId(raw: string): string {
  return stripUnsafe(raw).replace(STUDENT_ID_ALLOWED, '').slice(0, 64).trim();
}

/** True when the sanitized id satisfies the backend contract exactly. */
export function isValidStudentId(value: string): boolean {
  return STUDENT_ID_PATTERN.test(value);
}

/** Normalize an exam UUID for `exam_id` (lowercase, whitespace-free). */
export function sanitizeExamId(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(ZERO_WIDTH, '')
    .replace(WHITESPACE_RUN, '')
    .toLowerCase();
}

/** True when the value is a well-formed UUID string. */
export function isValidExamId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Sanitize a human-entered exam title (backend requires 2..255 chars). */
export function sanitizeTitle(raw: string, maxLength = 255): string {
  return stripUnsafe(raw).slice(0, maxLength);
}

/** True when the title satisfies the backend `exam_title` constraint. */
export function isValidExamTitle(value: string): boolean {
  return value.length >= 2 && value.length <= 255;
}
