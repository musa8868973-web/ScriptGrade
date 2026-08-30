/**
 * RTL-aware language badge.
 *
 * Displays the detection/target language with its native script label and an
 * explicit RTL pill for the right-to-left scripts supported by the NLP
 * engine (Urdu, Sindhi, Punjabi) plus English. Used by the preview screen
 * (target-language picker) and the diagnostic card (detected language).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Languages } from 'lucide-react-native';

import { colors, radius, spacing } from '../lib/theme';
import { ScriptLanguage } from '../lib/types';

export interface LanguageMeta {
  label: string;
  /** Native-script rendering (Nastaliq/Arabic script for RTL languages). */
  native: string;
  rtl: boolean;
}

export const LANGUAGE_META: Record<ScriptLanguage, LanguageMeta> = {
  en: { label: 'English', native: 'English', rtl: false },
  ur: { label: 'Urdu', native: 'اردو', rtl: true },
  sd: { label: 'Sindhi', native: 'سنڌي', rtl: true },
  pa: { label: 'Punjabi', native: 'پنجابی', rtl: true },
};

export const SUPPORTED_LANGUAGES: ScriptLanguage[] = ['en', 'ur', 'sd', 'pa'];

/** Narrow an arbitrary string (e.g. `language_detected`) to ScriptLanguage. */
export function toScriptLanguage(value: string | null | undefined): ScriptLanguage | null {
  if (value === 'en' || value === 'ur' || value === 'sd' || value === 'pa') {
    return value;
  }
  return null;
}

interface LanguageBadgeProps {
  language: ScriptLanguage;
  /** Highlights the chip (used by pickers). */
  selected?: boolean;
  /** Marks the value as auto-detected by the NLP engine. */
  detected?: boolean;
  compact?: boolean;
}

export function LanguageBadge({
  language,
  selected = false,
  detected = false,
  compact = false,
}: LanguageBadgeProps): React.JSX.Element {
  const meta = LANGUAGE_META[language];
  return (
    <View
      style={[
        styles.chip,
        selected && styles.chipSelected,
        detected && styles.chipDetected,
        compact && styles.chipCompact,
      ]}
    >
      <Languages
        size={compact ? 13 : 15}
        color={selected ? colors.text : colors.textDim}
      />
      <Text
        style={[
          styles.label,
          selected && styles.labelSelected,
          compact && styles.labelCompact,
        ]}
      >
        {meta.label}
      </Text>
      {meta.rtl ? (
        <Text
          style={[
            styles.native,
            // Native Nastaliq labels must render right-to-left even inside
            // an LTR chip row. (TextStyle.writingDirection — the Text prop
            // of the same name does not exist in RN 0.74 types.)
            styles.nativeRtl,
            selected && styles.labelSelected,
            compact && styles.labelCompact,
          ]}
        >
          {meta.native}
        </Text>
      ) : null}
      {meta.rtl ? (
        <View style={styles.rtlPill}>
          <Text style={styles.rtlPillText}>RTL</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipDetected: {
    borderColor: colors.info,
    backgroundColor: colors.infoSoft,
  },
  chipCompact: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
  },
  label: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.text,
  },
  labelCompact: {
    fontSize: 11,
  },
  native: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  nativeRtl: {
    writingDirection: 'rtl',
  },
  rtlPill: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
  },
  rtlPillText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
