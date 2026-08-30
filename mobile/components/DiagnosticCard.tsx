/**
 * DiagnosticCard — real-time feedback surface for Musa's 8-Debugger NLP
 * engine (README §7 "Live Diagnostic JSON" contract).
 *
 * Renders, for an evaluated paper:
 *  - Score / max score with a percentage bar and processing-status chip
 *  - Detected language (RTL-aware badge), OCR confidence, word count
 *  - Flag banner when the engine marks the paper for review
 *  - Teacher override state (when applied)
 *  - All eight debuggers, each with a severity verdict and its evidence:
 *      I   Garbage Text        II  Negation Detection
 *      III Synonym Match       IV  Fuzzy Spelling Correction
 *      V   Sequence DAG        VI  Diagram / Visual Inspector
 *      VII Density Scorer      VIII Rubric Aggregator (score breakdown)
 *
 * The backend marks diagnostic envelopes `extra = allow` and failure
 * envelopes may omit debugger blocks entirely, so every block is accessed
 * defensively and renders an honest "Not reported" state when absent.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  Flag,
  GitBranch,
  Image as ImageIcon,
  Info,
  ListChecks,
  Repeat,
  ScanText,
  SpellCheck,
  XCircle,
} from 'lucide-react-native';

import { colors, radius, spacing } from '../lib/theme';
import {
  DiagnosticsPayload,
  MatchType,
  PaperDetailResponse,
  RubricBreakdownItem,
} from '../lib/types';
import { LanguageBadge, toScriptLanguage } from './LanguageBadge';

// ---------------------------------------------------------------------------
// Severity primitives
// ---------------------------------------------------------------------------
type Severity = 'pass' | 'warn' | 'fail' | 'info';

const SEVERITY_COLOR: Record<Severity, string> = {
  pass: colors.success,
  warn: colors.warning,
  fail: colors.danger,
  info: colors.info,
};

const SEVERITY_BG: Record<Severity, string> = {
  pass: colors.successSoft,
  warn: colors.warningSoft,
  fail: colors.dangerSoft,
  info: colors.infoSoft,
};

function SeverityIcon({ severity }: { severity: Severity }): React.JSX.Element {
  switch (severity) {
    case 'pass':
      return <CheckCircle2 size={16} color={SEVERITY_COLOR.pass} />;
    case 'warn':
      return <AlertTriangle size={16} color={SEVERITY_COLOR.warn} />;
    case 'fail':
      return <XCircle size={16} color={SEVERITY_COLOR.fail} />;
    default:
      return <Info size={16} color={SEVERITY_COLOR.info} />;
  }
}

const MATCH_TYPE_META: Record<MatchType, { color: string; bg: string }> = {
  exact: { color: colors.success, bg: colors.successSoft },
  synonym: { color: colors.info, bg: colors.infoSoft },
  fuzzy: { color: colors.warning, bg: colors.warningSoft },
  none: { color: colors.danger, bg: colors.dangerSoft },
};

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
interface DebuggerRowProps {
  severity: Severity;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  children?: React.ReactNode;
}

function DebuggerRow({
  severity,
  icon,
  title,
  detail,
  children,
}: DebuggerRowProps): React.JSX.Element {
  return (
    <View style={styles.debugRow}>
      <View style={styles.debugHeader}>
        <View style={[styles.debugIconWrap, { backgroundColor: SEVERITY_BG[severity] }]}>
          {icon}
        </View>
        <Text style={styles.debugTitle}>{title}</Text>
        <SeverityIcon severity={severity} />
      </View>
      {detail ? <Text style={styles.debugDetail}>{detail}</Text> : null}
      {children}
    </View>
  );
}

function NotReported({ title }: { title: string }): React.JSX.Element {
  return (
    <View style={styles.debugRow}>
      <View style={styles.debugHeader}>
        <Text style={[styles.debugTitle, styles.muted]}>{title}</Text>
        <Text style={styles.notReported}>Not reported</Text>
      </View>
    </View>
  );
}

function MetaItem({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function MatchChip({ matchType }: { matchType: MatchType }): React.JSX.Element {
  const meta = MATCH_TYPE_META[matchType] ?? MATCH_TYPE_META.none;
  return (
    <View style={[styles.matchChip, { backgroundColor: meta.bg }]}>
      <Text style={[styles.matchChipText, { color: meta.color }]}>{matchType}</Text>
    </View>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  // Engine emits ratios in 0..1; tolerate 0..100 inputs too.
  const ratio = value <= 1 ? value : value / 100;
  return `${Math.round(ratio * 100)}%`;
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------
interface DiagnosticCardProps {
  paper: PaperDetailResponse;
}

export function DiagnosticCard({ paper }: DiagnosticCardProps): React.JSX.Element {
  const d: Partial<DiagnosticsPayload> = paper.diagnostics ?? {};

  const score = paper.score;
  const maxScore = paper.max_score;
  const pct =
    score !== null && maxScore !== null && maxScore > 0
      ? Math.round((score / maxScore) * 100)
      : null;

  const detectedLanguage = toScriptLanguage(paper.language_detected);
  const override = paper.teacher_override;

  const garbage = d.I_garbage_text;
  const negation = d.II_negation_detection;
  const synonym = d.III_synonym_match;
  const spelling = d.IV_spelling_correction;
  const sequence = d.V_sequence_dag;
  const visual = d.VI_diagram_visual;
  const density = d.VII_density_scorer;
  const rubric = d.VIII_rubric_aggregator;

  return (
    <View style={styles.card}>
      {/* Flag banner */}
      {paper.is_flagged ? (
        <View style={styles.flagBanner}>
          <Flag size={15} color={colors.danger} />
          <Text style={styles.flagText}>
            Flagged by the diagnostic engine — teacher review recommended.
          </Text>
        </View>
      ) : null}

      {/* Score header */}
      <View style={styles.scoreRow}>
        <View>
          <Text style={styles.scoreLabel}>Final score</Text>
          <Text style={styles.scoreValue}>
            {score ?? '—'}
            <Text style={styles.scoreMax}> / {maxScore ?? '—'}</Text>
          </Text>
        </View>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>
            {(paper.processing_status ?? paper.status).toUpperCase()}
          </Text>
        </View>
      </View>
      {pct !== null ? (
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.min(pct, 100)}%`,
                backgroundColor:
                  pct >= 70
                    ? colors.success
                    : pct >= 40
                      ? colors.warning
                      : colors.danger,
              },
            ]}
          />
        </View>
      ) : null}

      {/* Meta grid */}
      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Language detected</Text>
          {detectedLanguage ? (
            <LanguageBadge language={detectedLanguage} detected compact />
          ) : (
            <Text style={styles.metaValue}>
              {paper.language_detected ?? '—'}
            </Text>
          )}
        </View>
        <MetaItem label="OCR confidence" value={formatPercent(paper.ocr_confidence)} />
        <MetaItem
          label="Word count"
          value={paper.word_count !== null ? String(paper.word_count) : '—'}
        />
        <MetaItem label="Evaluated at" value={formatDateTime(paper.evaluated_at)} />
      </View>

      {/* Teacher override */}
      {override?.applied ? (
        <View style={styles.overrideBox}>
          <Text style={styles.overrideTitle}>Teacher override applied</Text>
          <Text style={styles.overrideText}>
            Override score: {override.override_score ?? '—'}
          </Text>
          {override.moderation_note ? (
            <Text style={styles.overrideText}>Note: {override.moderation_note}</Text>
          ) : null}
        </View>
      ) : null}

      {/* 8-Debugger breakdown */}
      <Text style={styles.sectionTitle}>NLP Diagnostic Pipeline</Text>

      {garbage ? (
        <DebuggerRow
          severity={garbage.flagged ? 'fail' : 'pass'}
          icon={<ScanText size={15} color={SEVERITY_COLOR[garbage.flagged ? 'fail' : 'pass']} />}
          title="I · Garbage Text"
          detail={garbage.detail}
        >
          <Text style={styles.evidence}>
            Garbage score: {garbage.garbage_text_score}
          </Text>
        </DebuggerRow>
      ) : (
        <NotReported title="I · Garbage Text" />
      )}

      {negation ? (
        <DebuggerRow
          severity={negation.negation_detected ? 'warn' : 'pass'}
          icon={
            <Ban
              size={15}
              color={SEVERITY_COLOR[negation.negation_detected ? 'warn' : 'pass']}
            />
          }
          title="II · Negation Detection"
          detail={negation.detail}
        >
          <Text style={styles.evidence}>
            {negation.negation_detected
              ? `${negation.flagged_tokens.length} negated token(s) flagged`
              : 'No negation detected'}
          </Text>
        </DebuggerRow>
      ) : (
        <NotReported title="II · Negation Detection" />
      )}

      {synonym ? (
        <DebuggerRow
          severity={synonym.synonym_matched ? 'info' : 'pass'}
          icon={
            <Repeat
              size={15}
              color={SEVERITY_COLOR[synonym.synonym_matched ? 'info' : 'pass']}
            />
          }
          title="III · Synonym Match"
          detail={synonym.detail}
        >
          {synonym.matched_pairs.map((pair, index) => (
            <Text key={`${pair.student_token}-${index}`} style={styles.evidence}>
              “{pair.student_token}” ↔ “{pair.rubric_concept}” ·{' '}
              {formatPercent(pair.similarity_score)}
            </Text>
          ))}
        </DebuggerRow>
      ) : (
        <NotReported title="III · Synonym Match" />
      )}

      {spelling ? (
        <DebuggerRow
          severity={spelling.spelling_autocorrected ? 'warn' : 'pass'}
          icon={
            <SpellCheck
              size={15}
              color={SEVERITY_COLOR[spelling.spelling_autocorrected ? 'warn' : 'pass']}
            />
          }
          title="IV · Fuzzy Spelling Correction"
          detail={spelling.detail}
        >
          {spelling.corrections.map((correction, index) => (
            <Text key={`${correction.original}-${index}`} style={styles.evidence}>
              {correction.original} → {correction.corrected} (lev{' '}
              {correction.levenshtein_score})
            </Text>
          ))}
        </DebuggerRow>
      ) : (
        <NotReported title="IV · Fuzzy Spelling Correction" />
      )}

      {sequence ? (
        <DebuggerRow
          severity={sequence.sequence_match && sequence.dag_transitions_valid ? 'pass' : 'warn'}
          icon={<GitBranch size={15} color={SEVERITY_COLOR[sequence.sequence_match && sequence.dag_transitions_valid ? 'pass' : 'warn']} />}
          title="V · Sequence DAG"
          detail={sequence.detail}
        >
          {sequence.expected_order.length > 0 ? (
            <Text style={styles.evidence}>
              Expected: {sequence.expected_order.join(' → ')}
            </Text>
          ) : null}
          {sequence.detected_order.length > 0 ? (
            <Text style={styles.evidence}>
              Detected: {sequence.detected_order.join(' → ')}
            </Text>
          ) : null}
        </DebuggerRow>
      ) : (
        <NotReported title="V · Sequence DAG" />
      )}

      {visual ? (
        <DebuggerRow
          severity={visual.diagram_verified ? 'pass' : 'info'}
          icon={
            <ImageIcon
              size={15}
              color={SEVERITY_COLOR[visual.diagram_verified ? 'pass' : 'info']}
            />
          }
          title="VI · Diagram / Visual Inspector"
          detail={visual.detail}
        >
          <Text style={styles.evidence}>
            Visual confidence: {formatPercent(visual.visual_confidence)}
          </Text>
          {visual.detected_elements.length > 0 ? (
            <Text style={styles.evidence}>
              Elements:{' '}
              {visual.detected_elements
                .map((element) => `${element.label} (${formatPercent(element.confidence)})`)
                .join(', ')}
            </Text>
          ) : null}
        </DebuggerRow>
      ) : (
        <NotReported title="VI · Diagram / Visual Inspector" />
      )}

      {density ? (
        <DebuggerRow
          severity={density.flagged ? 'fail' : 'pass'}
          icon={
            <BarChart3
              size={15}
              color={SEVERITY_COLOR[density.flagged ? 'fail' : 'pass']}
            />
          }
          title="VII · Density Scorer"
          detail={density.detail}
        >
          <Text style={styles.evidence}>
            Density ratio {density.density_ratio} · {density.valid_keyword_hits} valid
            keyword hits / {density.total_word_count} words
          </Text>
        </DebuggerRow>
      ) : (
        <NotReported title="VII · Density Scorer" />
      )}

      {rubric ? (
        <DebuggerRow
          severity="info"
          icon={<ListChecks size={15} color={SEVERITY_COLOR.info} />}
          title="VIII · Rubric Aggregator"
          detail={rubric.detail}
        >
          <View style={styles.breakdown}>
            {rubric.rubric_breakdown.map((item: RubricBreakdownItem, index: number) => (
              <View key={`${item.concept}-${index}`} style={styles.breakdownRow}>
                <Text style={styles.breakdownConcept} numberOfLines={2}>
                  {item.concept}
                </Text>
                <MatchChip matchType={item.match_type} />
                <Text style={styles.breakdownScore}>
                  {item.awarded}/{item.max}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.totalLine}>
            Total: {rubric.total_awarded} / {rubric.max_possible}
          </Text>
        </DebuggerRow>
      ) : (
        <NotReported title="VIII · Rubric Aggregator" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(3),
  },
  flagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  flagText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scoreValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    marginTop: spacing(1),
  },
  scoreMax: {
    color: colors.textDim,
    fontSize: 18,
    fontWeight: '600',
  },
  statusChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.primary,
  },
  statusChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(3),
  },
  metaItem: {
    minWidth: '44%',
    gap: spacing(1),
  },
  metaLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  overrideBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing(3),
    gap: spacing(1),
  },
  overrideTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  overrideText: {
    color: colors.text,
    fontSize: 13,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: spacing(1),
  },
  debugRow: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing(3),
    gap: spacing(1.5),
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  debugIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  debugDetail: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 17,
  },
  evidence: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  muted: {
    color: colors.textDim,
  },
  notReported: {
    color: colors.textDim,
    fontSize: 11,
    fontStyle: 'italic',
  },
  breakdown: {
    gap: spacing(2),
    marginTop: spacing(1),
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  breakdownConcept: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
  },
  breakdownScore: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 40,
    textAlign: 'right',
  },
  matchChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  matchChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalLine: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: spacing(1),
  },
});
