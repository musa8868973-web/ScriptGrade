/**
 * Preview — review, edit, upload, and live-diagnose a capture session.
 *
 *  Mode 1 (setup):  exam title input + question/answer thumbnails →
 *                   POST /exam/setup → extracted-concepts summary.
 *  Mode 2 (paper):  target exam chip + student ID (sanitized) + RTL-aware
 *                   language picker → POST /papers/upload (202) → poll
 *                   GET /papers/{student_id} every 3s (≤20 attempts) until
 *                   the 8-debugger pipeline reports evaluated/failed →
 *                   DiagnosticCard with the full NLP feedback.
 *
 * Editing runs through AutoCrop (rotate / aspect crop / reset) applied via
 * expo-image-manipulator; upload state comes from useOSSUpload (progress,
 * cancel, normalized errors). Polling is cleaned up on unmount.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  FileEdit,
  KeySquare,
  ListChecks,
  RotateCcw,
  Sparkles,
  Timer,
  X,
  XCircle,
} from 'lucide-react-native';

import { AutoCrop } from '../../components/AutoCrop';
import { DiagnosticCard } from '../../components/DiagnosticCard';
import {
  LanguageBadge,
  SUPPORTED_LANGUAGES,
} from '../../components/LanguageBadge';
import { useOSSUpload, UploadFileInput } from '../../hooks/useOSSUpload';
import { api } from '../../lib/api';
import {
  beginSession,
  CapturedImage,
  CaptureSlot,
  clearCaptures,
  getSession,
  resetSession,
  setCaptured,
} from '../../lib/captureStore';
import {
  isValidExamTitle,
  isValidStudentId,
  sanitizeStudentId,
  sanitizeTitle,
} from '../../lib/sanitize';
import { colors, radius, spacing } from '../../lib/theme';
import {
  ExamSetupResponse,
  PaperDetailResponse,
  PaperUploadResponse,
  ScriptLanguage,
} from '../../lib/types';

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 20;

type PollState = 'idle' | 'polling' | 'done' | 'failed' | 'timeout';

export default function PreviewScreen(): React.JSX.Element {
  const router = useRouter();
  const session = getSession();
  const isSetup = session.mode === 'setup';

  const [examTitle, setExamTitle] = useState(session.examTitle ?? '');
  const [studentId, setStudentId] = useState('');
  const [language, setLanguage] = useState<ScriptLanguage>('en');
  const [editingSlot, setEditingSlot] = useState<CaptureSlot | null>(null);
  const [, forceRender] = useState(0);

  const [setupResult, setSetupResult] = useState<ExamSetupResponse | null>(null);
  const [paperJob, setPaperJob] = useState<PaperUploadResponse | null>(null);
  const [evaluatedPaper, setEvaluatedPaper] = useState<PaperDetailResponse | null>(null);
  const [pollState, setPollState] = useState<PollState>('idle');
  const [pollAttempt, setPollAttempt] = useState(0);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCancelledRef = useRef(false);

  const {
    phase,
    progress,
    error,
    uploadExamSetup,
    uploadStudentPaper,
    cancel,
    reset,
  } = useOSSUpload();

  // Stop polling when leaving the screen.
  useEffect(() => {
    return () => {
      pollCancelledRef.current = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------
  const question = session.question;
  const answer = session.answer;
  const paper = session.paper;
  const capturesReady = isSetup
    ? Boolean(question && answer)
    : Boolean(paper);

  const titleClean = sanitizeTitle(examTitle);
  const titleReady = isValidExamTitle(titleClean);
  const studentIdClean = sanitizeStudentId(studentId);
  const studentIdReady = isValidStudentId(studentIdClean);

  const formReady =
    capturesReady &&
    phase !== 'uploading' &&
    (isSetup ? titleReady : studentIdReady && Boolean(session.examId));

  // -------------------------------------------------------------------------
  // Edit handlers
  // -------------------------------------------------------------------------
  const handleApplyEdit = useCallback(
    (slot: CaptureSlot) =>
      (next: CapturedImage): void => {
        setCaptured(slot, next);
        setEditingSlot(null);
        forceRender((value) => value + 1);
      },
    [],
  );

  const handleRetake = useCallback((): void => {
    clearCaptures();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/scanner');
    }
  }, [router]);

  // -------------------------------------------------------------------------
  // Diagnostic polling (paper mode)
  // -------------------------------------------------------------------------
  const pollDiagnostics = useCallback((targetStudentId: string): void => {
    pollCancelledRef.current = false;
    setPollState('polling');
    setPollAttempt(0);

    const tick = async (): Promise<void> => {
      if (pollCancelledRef.current) {
        return;
      }
      setPollAttempt((attempt) => attempt + 1);
      try {
        const response = await api.get<PaperDetailResponse>(
          `/papers/${encodeURIComponent(targetStudentId)}`,
        );
        const detail = response.data;
        if (
          detail.processing_status === 'evaluated' ||
          detail.processing_status === 'failed'
        ) {
          setEvaluatedPaper(detail);
          setPollState(
            detail.processing_status === 'evaluated' ? 'done' : 'failed',
          );
          return;
        }
      } catch {
        // Transient network/404 while the job spins up — keep polling
        // until the attempt budget is exhausted.
      }
      setPollAttempt((attempt) => {
        if (attempt >= MAX_POLL_ATTEMPTS) {
          setPollState('timeout');
          return attempt;
        }
        pollTimerRef.current = setTimeout(() => {
          void tick();
        }, POLL_INTERVAL_MS);
        return attempt;
      });
    };

    void tick();
  }, []);

  // -------------------------------------------------------------------------
  // Upload handlers
  // -------------------------------------------------------------------------
  const handleUploadSetup = useCallback(async (): Promise<void> => {
    if (!question || !answer) {
      return;
    }
    const result = await uploadExamSetup({
      examTitle: titleClean,
      questionFile: toFileInput(question, 'question_paper'),
      answerFile: toFileInput(answer, 'sample_answer'),
    });
    if (result && result.kind === 'setup') {
      setSetupResult(result.data);
    }
  }, [answer, question, titleClean, uploadExamSetup]);

  const handleUploadPaper = useCallback(async (): Promise<void> => {
    if (!paper || !session.examId) {
      return;
    }
    const result = await uploadStudentPaper({
      examId: session.examId,
      studentId: studentIdClean,
      file: toFileInput(paper, `sheet_${studentIdClean.replace(/\s+/g, '_')}`),
      language,
    });
    if (result && result.kind === 'paper') {
      setPaperJob(result.data);
      pollDiagnostics(studentIdClean);
    }
  }, [language, paper, pollDiagnostics, session.examId, studentIdClean, uploadStudentPaper]);

  const handleFinish = useCallback((): void => {
    reset();
    resetSession();
    router.replace('/');
  }, [reset, router]);

  const handleScanAnother = useCallback((): void => {
    const keepMode = session.mode;
    const keepExamId = session.examId;
    const keepExamTitle = session.examTitle;
    reset();
    // Re-open the scanner in the same mode/exam context for batch grading.
    beginSession(keepMode, keepExamId, keepExamTitle);
    router.replace('/scanner');
  }, [reset, router, session.examId, session.examTitle, session.mode]);

  // -------------------------------------------------------------------------
  // Render: editing surface
  // -------------------------------------------------------------------------
  if (editingSlot) {
    const editingImage =
      editingSlot === 'question' ? question : editingSlot === 'answer' ? answer : paper;
    if (editingImage) {
      return (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.editContainer}
        >
          <View style={styles.editHeader}>
            <Text style={styles.editTitle}>
              Edit {slotLabel(editingSlot, isSetup)}
            </Text>
            <TouchableOpacity
              style={styles.editClose}
              onPress={() => setEditingSlot(null)}
              accessibilityLabel="Close editor"
            >
              <X size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <AutoCrop image={editingImage} onApply={handleApplyEdit(editingSlot)} />
        </ScrollView>
      );
    }
  }

  // -------------------------------------------------------------------------
  // Render: missing captures
  // -------------------------------------------------------------------------
  if (!capturesReady) {
    return (
      <View style={styles.centerState}>
        <AlertCircle size={36} color={colors.warning} />
        <Text style={styles.centerTitle}>Nothing to review</Text>
        <Text style={styles.centerText}>
          The capture session is empty. Return to the scanner and photograph
          {isSetup
            ? ' the question paper and sample answer key.'
            : ' the student answer sheet.'}
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleRetake}>
          <Text style={styles.primaryButtonText}>Back to scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Render: main flow
  // -------------------------------------------------------------------------
  const uploading = phase === 'uploading';
  const showPaperResult = !isSetup && paperJob !== null;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {/* Captured documents */}
      {isSetup ? (
        <>
          {question ? (
            <DocumentCard
              label="Question paper"
              image={question}
              onEdit={() => setEditingSlot('question')}
              onRetake={handleRetake}
              disabled={uploading}
            />
          ) : null}
          {answer ? (
            <DocumentCard
              label="Sample answer key"
              image={answer}
              onEdit={() => setEditingSlot('answer')}
              onRetake={handleRetake}
              disabled={uploading}
            />
          ) : null}
        </>
      ) : (
        paper && (
          <DocumentCard
            label="Student answer sheet"
            image={paper}
            onEdit={() => setEditingSlot('paper')}
            onRetake={handleRetake}
            disabled={uploading}
          />
        )
      )}

      {/* Form fields */}
      {isSetup ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Exam title</Text>
          <TextInput
            style={[
              styles.textInput,
              examTitle.length > 0 && !titleReady && styles.textInputInvalid,
            ]}
            placeholder="e.g. Physics Midterm — Grade 10"
            placeholderTextColor={colors.textDim}
            value={examTitle}
            onChangeText={setExamTitle}
            editable={!uploading && !setupResult}
            maxLength={255}
          />
          {examTitle.length > 0 && !titleReady ? (
            <Text style={styles.fieldError}>
              Title must be 2–255 characters after cleanup.
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.targetExamRow}>
            <Text style={styles.fieldLabel}>Target exam</Text>
            <View style={styles.targetExamChip}>
              <ListChecks size={14} color={colors.info} />
              <Text style={styles.targetExamText} numberOfLines={1}>
                {session.examTitle ?? session.examId}
              </Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Student ID / roll number</Text>
            <TextInput
              style={[
                styles.textInput,
                studentId.length > 0 && !studentIdReady && styles.textInputInvalid,
              ]}
              placeholder="e.g. STU-001"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
              value={studentId}
              onChangeText={setStudentId}
              editable={!uploading && !paperJob}
              maxLength={80}
            />
            {studentId.length > 0 && !studentIdReady ? (
              <Text style={styles.fieldError}>
                Use 1–64 letters, digits, spaces, dots, dashes or underscores;
                must start with a letter or digit.
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Handwriting language (OCR hint)
            </Text>
            <View style={styles.languageRow}>
              {SUPPORTED_LANGUAGES.map((code) => (
                <TouchableOpacity
                  key={code}
                  onPress={() => setLanguage(code)}
                  disabled={uploading || Boolean(paperJob)}
                >
                  <LanguageBadge language={code} selected={language === code} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Error banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color={colors.danger} />
          <View style={styles.errorBody}>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.requestId ? (
              <Text style={styles.errorRequestId}>
                Reference: {error.requestId}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Upload action */}
      {!setupResult && !paperJob ? (
        <View style={styles.uploadBlock}>
          {uploading ? (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(progress * 100)}%` },
                  ]}
                />
              </View>
              <View style={styles.uploadStatusRow}>
                <Text style={styles.uploadStatusText}>
                  Uploading… {Math.round(progress * 100)}%
                </Text>
                <TouchableOpacity onPress={cancel}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.uploadButton, !formReady && styles.uploadDisabled]}
              disabled={!formReady}
              onPress={() => {
                void (isSetup ? handleUploadSetup() : handleUploadPaper());
              }}
            >
              <CloudUpload size={18} color={colors.text} />
              <Text style={styles.uploadButtonText}>
                {isSetup ? 'Upload exam & extract rubric' : 'Upload & evaluate'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Setup success: extracted rubric concepts */}
      {setupResult ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <CheckCircle2 size={20} color={colors.success} />
            <Text style={styles.resultTitle}>Rubric extracted</Text>
          </View>
          <View style={styles.resultMetaRow}>
            <KeySquare size={13} color={colors.textDim} />
            <Text style={styles.resultMetaText} selectable>
              Exam ID: {setupResult.exam_id}
            </Text>
          </View>
          <Text style={styles.resultSectionLabel}>
            Extracted concepts ({setupResult.extracted_concepts.length})
          </Text>
          <View style={styles.conceptWrap}>
            {setupResult.extracted_concepts.map((concept, index) => (
              <View key={`${concept.keyword}-${index}`} style={styles.conceptChip}>
                <Text style={styles.conceptText}>{concept.keyword}</Text>
                <Text style={styles.conceptWeight}>×{concept.weight}</Text>
              </View>
            ))}
          </View>
          {Object.keys(setupResult.synonyms).length > 0 ? (
            <>
              <Text style={styles.resultSectionLabel}>
                Synonym expansions
              </Text>
              {Object.entries(setupResult.synonyms)
                .slice(0, 6)
                .map(([keyword, expansions]) => (
                  <Text key={keyword} style={styles.synonymLine}>
                    {keyword} → {expansions.join(', ')}
                  </Text>
                ))}
            </>
          ) : null}
          <Text style={styles.resultHint}>
            This exam now appears in your Home list — select it to grade
            student sheets.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleFinish}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Paper flow: job accepted → polling → diagnostics */}
      {showPaperResult && paperJob ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            {pollState === 'done' ? (
              <CheckCircle2 size={20} color={colors.success} />
            ) : pollState === 'failed' || pollState === 'timeout' ? (
              <XCircle size={20} color={colors.danger} />
            ) : (
              <Sparkles size={20} color={colors.accent} />
            )}
            <Text style={styles.resultTitle}>
              {pollState === 'done'
                ? 'Evaluation complete'
                : pollState === 'failed'
                  ? 'Evaluation failed'
                  : pollState === 'timeout'
                    ? 'Still processing'
                    : 'Evaluating with NLP engine…'}
            </Text>
          </View>

          <View style={styles.resultMetaRow}>
            <Timer size={13} color={colors.textDim} />
            <Text style={styles.resultMetaText}>
              Job {paperJob.job_id} · ETA ~
              {paperJob.estimated_completion_seconds}s · source:{' '}
              {paperJob.source}
            </Text>
          </View>

          {pollState === 'polling' ? (
            <View style={styles.pollingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.pollingText}>
                Running 8-debugger pipeline… check {pollAttempt}/
                {MAX_POLL_ATTEMPTS}
              </Text>
            </View>
          ) : null}

          {pollState === 'timeout' ? (
            <Text style={styles.resultHint}>
              The paper is still queued on the worker. Its diagnostics will
              appear on the web dashboard once evaluation finishes.
            </Text>
          ) : null}

          {pollState === 'failed' && evaluatedPaper ? (
            <Text style={styles.errorText}>
              The engine reported a failure for this sheet (status:{' '}
              {evaluatedPaper.status}). Please retake the photo with better
              lighting and try again.
            </Text>
          ) : null}

          {pollState === 'done' && evaluatedPaper ? (
            <DiagnosticCard paper={evaluatedPaper} />
          ) : null}

          <View style={styles.resultActions}>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={handleScanAnother}
            >
              <RotateCcw size={15} color={colors.accent} />
              <Text style={styles.secondaryActionText}>Scan next sheet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleFinish}>
              <Text style={styles.primaryButtonText}>Back to home</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Helpers + sub-components
// ---------------------------------------------------------------------------
function toFileInput(image: CapturedImage, baseName: string): UploadFileInput {
  return { uri: image.uri, fileName: `${baseName}.jpg`, mimeType: 'image/jpeg' };
}

function slotLabel(slot: CaptureSlot, isSetup: boolean): string {
  if (slot === 'question') {
    return 'question paper';
  }
  if (slot === 'answer') {
    return 'answer key';
  }
  return isSetup ? 'document' : 'answer sheet';
}

interface DocumentCardProps {
  label: string;
  image: CapturedImage;
  onEdit: () => void;
  onRetake: () => void;
  disabled: boolean;
}

function DocumentCard({
  label,
  image,
  onEdit,
  onRetake,
  disabled,
}: DocumentCardProps): React.JSX.Element {
  return (
    <View style={styles.docCard}>
      <Image source={{ uri: image.uri }} style={styles.docThumb} resizeMode="cover" />
      <View style={styles.docBody}>
        <Text style={styles.docLabel}>{label}</Text>
        <Text style={styles.docMeta}>
          {image.width} × {image.height}px
        </Text>
      </View>
      <View style={styles.docActions}>
        <TouchableOpacity
          style={styles.docActionButton}
          onPress={onEdit}
          disabled={disabled}
          accessibilityLabel={`Edit ${label}`}
        >
          <FileEdit size={16} color={disabled ? colors.textDim : colors.info} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.docActionButton}
          onPress={onRetake}
          disabled={disabled}
          accessibilityLabel={`Retake ${label}`}
        >
          <RotateCcw size={16} color={disabled ? colors.textDim : colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing(5),
    paddingBottom: spacing(12),
    gap: spacing(4),
  },
  editContainer: {
    padding: spacing(4),
    gap: spacing(4),
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  editClose: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  centerState: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(8),
    gap: spacing(3),
  },
  centerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  centerText: {
    color: colors.textDim,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
  },
  docThumb: {
    width: 64,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  docBody: {
    flex: 1,
    gap: 4,
  },
  docLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  docMeta: {
    color: colors.textDim,
    fontSize: 11.5,
  },
  docActions: {
    gap: spacing(2),
  },
  docActionButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldGroup: {
    gap: spacing(2),
  },
  fieldLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    color: colors.text,
    fontSize: 15,
  },
  textInputInvalid: {
    borderColor: colors.danger,
  },
  fieldError: {
    color: colors.danger,
    fontSize: 12,
  },
  targetExamRow: {
    gap: spacing(2),
  },
  targetExamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderWidth: 1,
    borderColor: colors.info,
  },
  targetExamText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  errorBody: {
    flex: 1,
    gap: 2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  errorRequestId: {
    color: colors.textDim,
    fontSize: 11,
  },
  uploadBlock: {
    gap: spacing(2),
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
  },
  uploadDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  uploadStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadStatusText: {
    color: colors.textDim,
    fontSize: 12.5,
    fontWeight: '600',
  },
  cancelText: {
    color: colors.danger,
    fontSize: 12.5,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(3),
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  resultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  resultMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  resultMetaText: {
    color: colors.textDim,
    fontSize: 12,
    flex: 1,
  },
  resultSectionLabel: {
    color: colors.textDim,
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  conceptWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  conceptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.primary,
  },
  conceptText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '600',
  },
  conceptWeight: {
    color: colors.accent,
    fontSize: 11.5,
    fontWeight: '800',
  },
  synonymLine: {
    color: colors.textDim,
    fontSize: 12.5,
    lineHeight: 18,
  },
  resultHint: {
    color: colors.textDim,
    fontSize: 12.5,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  pollingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  pollingText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  resultActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
    flexWrap: 'wrap',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  secondaryActionText: {
    color: colors.accent,
    fontSize: 13.5,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
