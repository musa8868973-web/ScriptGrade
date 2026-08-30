/**
 * Shared design tokens — dark theme per README branding
 * (indigo #4F46E5 primary, orange #FF6A00 accent, deep navy background).
 */

export const colors = {
  bg: '#0B1020',
  surface: '#131A2E',
  surfaceAlt: '#1B2440',
  border: '#2A3556',
  primary: '#4F46E5',
  primarySoft: 'rgba(79, 70, 229, 0.16)',
  accent: '#FF6A00',
  accentSoft: 'rgba(255, 106, 0, 0.14)',
  text: '#F4F6FF',
  textDim: '#9AA4C7',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.14)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.14)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.14)',
  info: '#38BDF8',
  infoSoft: 'rgba(56, 189, 248, 0.14)',
  overlay: 'rgba(4, 8, 24, 0.62)',
  overlayStrong: 'rgba(4, 8, 24, 0.86)',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

/** 4pt grid spacing helper. */
export const spacing = (units: number): number => units * 4;
