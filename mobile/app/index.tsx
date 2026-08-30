/**
 * Home — scanning mode entry + exam picker.
 *
 *  Mode 1 "Scan Exam & Answer Key"   → /scanner (mode 'setup')
 *      Captures question paper + sample answer, uploads to /exam/setup.
 *  Mode 2 "Scan Student Answer Sheet" → /scanner (mode 'paper')
 *      Captures a student sheet, uploads to /papers/upload against the
 *      exam selected here (GET /exams/list, DashboardResponse contract).
 *
 * The chosen mode/exam is written into the capture session store before
 * navigation (file URIs and exam context must not cross nav params).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  FileScan,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react-native';

import { useAuth } from '../hooks/useAuth';
import { api, normalizeApiError } from '../lib/api';
import { beginSession } from '../lib/captureStore';
import { colors, radius, spacing } from '../lib/theme';
import { DashboardResponse, ExamListItem } from '../lib/types';

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [loadingExams, setLoadingExams] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);

  const loadExams = useCallback(async (silent: boolean): Promise<void> => {
    if (!silent) {
      setLoadingExams(true);
    }
    setExamsError(null);
    try {
      const response = await api.get<DashboardResponse>('/exams/list');
      const list = response.data.exams ?? [];
      setExams(list);
      setSelectedExamId((current) => {
        if (current && list.some((exam) => exam.exam_id === current)) {
          return current;
        }
        // Default to the most recent completed exam, else the first.
        const firstCompleted = list.find((exam) => exam.status === 'completed');
        return (firstCompleted ?? list[0])?.exam_id ?? null;
      });
    } catch (error) {
      setExamsError(normalizeApiError(error).message);
    } finally {
      setLoadingExams(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadExams(false);
  }, [loadExams]);

  // Refresh the exam list whenever Home regains focus (e.g. after a new
  // exam was set up via Mode 1 on the scanner).
  useFocusEffect(
    useCallback(() => {
      void loadExams(true);
    }, [loadExams]),
  );

  const selectedExam = exams.find((exam) => exam.exam_id === selectedExamId) ?? null;

  const openSetupScanner = (): void => {
    beginSession('setup', null, null);
    router.push('/scanner');
  };

  const openPaperScanner = (): void => {
    if (!selectedExam) {
      Alert.alert(
        'Select an exam first',
        'Student answer sheets must be attached to an exam. Pick one from the list below, or create a new exam with "Scan Exam & Answer Key".',
      );
      return;
    }
    beginSession('paper', selectedExam.exam_id, selectedExam.title);
    router.push('/scanner');
  };

  const handleSignOut = (): void => {
    Alert.alert('Sign out', 'End the secure session on this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadExams(true);
          }}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.greeting}>
            {user ? `Assalam-o-Alaikum, ${user.full_name.split(' ')[0]}` : 'Welcome'}
          </Text>
          <Text style={styles.institution} numberOfLines={1}>
            {user?.institution_name ?? 'ScriptGrade'}
          </Text>
          <View style={styles.roleChip}>
            <ShieldCheck size={12} color={colors.info} />
            <Text style={styles.roleChipText}>
              {(user?.role ?? 'teacher').replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
        >
          <LogOut size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Mode cards */}
      <Text style={styles.sectionTitle}>What are you scanning?</Text>
      <View style={styles.modeGrid}>
        <TouchableOpacity style={styles.modeCard} onPress={openSetupScanner}>
          <View style={[styles.modeIconWrap, styles.modeIconSetup]}>
            <BookOpenCheck size={24} color={colors.text} />
          </View>
          <Text style={styles.modeTitle}>Scan Exam &amp; Answer Key</Text>
          <Text style={styles.modeHint}>
            Register a new exam: capture the question paper, then the sample
            answer key for rubric extraction.
          </Text>
          <View style={styles.modeCta}>
            <Text style={styles.modeCtaText}>Start setup scan</Text>
            <ChevronRight size={15} color={colors.accent} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.modeCard} onPress={openPaperScanner}>
          <View style={[styles.modeIconWrap, styles.modeIconPaper]}>
            <FileScan size={24} color={colors.text} />
          </View>
          <Text style={styles.modeTitle}>Scan Student Answer Sheet</Text>
          <Text style={styles.modeHint}>
            Grade a handwritten sheet against the selected exam and stream
            back 8-debugger diagnostics.
          </Text>
          <View style={styles.modeCta}>
            <Text style={styles.modeCtaText}>Scan student sheet</Text>
            <ChevronRight size={15} color={colors.accent} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Exam picker */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Target exam</Text>
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={() => void loadExams(false)}
          accessibilityLabel="Reload exams"
        >
          <RefreshCw size={14} color={colors.textDim} />
        </TouchableOpacity>
      </View>

      {loadingExams ? (
        <View style={styles.examStateBox}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.examStateText}>Loading your exams…</Text>
        </View>
      ) : examsError ? (
        <View style={styles.examStateBox}>
          <Text style={styles.examErrorText}>{examsError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void loadExams(false)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : exams.length === 0 ? (
        <View style={styles.examStateBox}>
          <Text style={styles.examStateText}>
            No exams yet. Use “Scan Exam &amp; Answer Key” to register your
            first exam and rubric.
          </Text>
        </View>
      ) : (
        <View style={styles.examList}>
          {exams.map((exam) => {
            const active = exam.exam_id === selectedExamId;
            return (
              <TouchableOpacity
                key={exam.exam_id}
                style={[styles.examRow, active && styles.examRowActive]}
                onPress={() => setSelectedExamId(exam.exam_id)}
              >
                <View style={styles.examRadio}>
                  {active ? <View style={styles.examRadioDot} /> : null}
                </View>
                <View style={styles.examBody}>
                  <Text style={styles.examTitle} numberOfLines={1}>
                    {exam.title}
                  </Text>
                  <View style={styles.examMetaRow}>
                    <CalendarDays size={12} color={colors.textDim} />
                    <Text style={styles.examMetaText}>{exam.date}</Text>
                    <Users size={12} color={colors.textDim} />
                    <Text style={styles.examMetaText}>
                      {exam.class_size} sheet{exam.class_size === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.examStatusChip,
                    exam.status === 'completed'
                      ? styles.examStatusDone
                      : styles.examStatusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.examStatusText,
                      exam.status === 'completed'
                        ? styles.examStatusTextDone
                        : styles.examStatusTextPending,
                    ]}
                  >
                    {exam.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {selectedExam ? (
        <Text style={styles.selectionHint}>
          Student sheets will be graded against “{selectedExam.title}”.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing(5),
    paddingBottom: spacing(10),
    gap: spacing(4),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing(4),
  },
  headerTextWrap: {
    flex: 1,
    gap: spacing(1),
    paddingRight: spacing(3),
  },
  greeting: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  institution: {
    color: colors.textDim,
    fontSize: 13,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    alignSelf: 'flex-start',
    backgroundColor: colors.infoSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
    marginTop: spacing(1),
  },
  roleChipText: {
    color: colors.info,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  signOutButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  reloadButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeGrid: {
    gap: spacing(3),
  },
  modeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(2),
  },
  modeIconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIconSetup: {
    backgroundColor: colors.primary,
  },
  modeIconPaper: {
    backgroundColor: colors.accent,
  },
  modeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  modeHint: {
    color: colors.textDim,
    fontSize: 12.5,
    lineHeight: 18,
  },
  modeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    marginTop: spacing(1),
  },
  modeCtaText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  examStateBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    alignItems: 'center',
    gap: spacing(2),
  },
  examStateText: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  examErrorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  retryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  examList: {
    gap: spacing(2),
  },
  examRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
  },
  examRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  examRadio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examRadioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  examBody: {
    flex: 1,
    gap: 3,
  },
  examTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  examMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
  },
  examMetaText: {
    color: colors.textDim,
    fontSize: 11.5,
    marginRight: spacing(2),
  },
  examStatusChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
  },
  examStatusDone: {
    backgroundColor: colors.successSoft,
  },
  examStatusPending: {
    backgroundColor: colors.warningSoft,
  },
  examStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  examStatusTextDone: {
    color: colors.success,
  },
  examStatusTextPending: {
    color: colors.warning,
  },
  selectionHint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
