/**
 * Optical document-alignment frame guide for the scanner.
 *
 * Pure-View implementation (no SVG mask quirks): four dimmed bands surround
 * a centered document window, with indigo corner brackets marking the
 * capture area. Sizing derives from the live window dimensions so the guide
 * stays proportional on phones and tablets.
 */

import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, radius, spacing } from '../lib/theme';

interface FrameGuideProps {
  /** Short instruction rendered beneath the frame window. */
  label?: string;
}

const CORNER_SIZE = 34;
const CORNER_STROKE = 4;

export function FrameGuide({ label }: FrameGuideProps): React.JSX.Element {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Document window: 84% of width, A4-ish portrait, capped to fit the screen.
  const frameWidth = Math.round(windowWidth * 0.84);
  const maxFrameHeight = Math.round(windowHeight * 0.52);
  const frameHeight = Math.min(Math.round(frameWidth * 1.32), maxFrameHeight);

  const horizontalBand = (windowWidth - frameWidth) / 2;
  const verticalBand = Math.max((windowHeight - frameHeight) / 2 - 40, 0);

  const cornerBase = {
    position: 'absolute' as const,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: colors.accent,
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Dimmed bands around the document window */}
      <View style={[styles.band, { top: 0, left: 0, right: 0, height: verticalBand }]} />
      <View
        style={[
          styles.band,
          {
            top: verticalBand + frameHeight,
            left: 0,
            right: 0,
            bottom: 0,
          },
        ]}
      />
      <View
        style={[
          styles.band,
          {
            top: verticalBand,
            left: 0,
            width: horizontalBand,
            height: frameHeight,
          },
        ]}
      />
      <View
        style={[
          styles.band,
          {
            top: verticalBand,
            right: 0,
            width: horizontalBand,
            height: frameHeight,
          },
        ]}
      />

      {/* Corner brackets */}
      <View
        style={[
          styles.frame,
          {
            top: verticalBand,
            left: horizontalBand,
            width: frameWidth,
            height: frameHeight,
          },
        ]}
      >
        <View
          style={[
            cornerBase,
            {
              top: -CORNER_STROKE / 2,
              left: -CORNER_STROKE / 2,
              borderTopWidth: CORNER_STROKE,
              borderLeftWidth: CORNER_STROKE,
              borderTopLeftRadius: radius.md,
            },
          ]}
        />
        <View
          style={[
            cornerBase,
            {
              top: -CORNER_STROKE / 2,
              right: -CORNER_STROKE / 2,
              borderTopWidth: CORNER_STROKE,
              borderRightWidth: CORNER_STROKE,
              borderTopRightRadius: radius.md,
            },
          ]}
        />
        <View
          style={[
            cornerBase,
            {
              bottom: -CORNER_STROKE / 2,
              left: -CORNER_STROKE / 2,
              borderBottomWidth: CORNER_STROKE,
              borderLeftWidth: CORNER_STROKE,
              borderBottomLeftRadius: radius.md,
            },
          ]}
        />
        <View
          style={[
            cornerBase,
            {
              bottom: -CORNER_STROKE / 2,
              right: -CORNER_STROKE / 2,
              borderBottomWidth: CORNER_STROKE,
              borderRightWidth: CORNER_STROKE,
              borderBottomRightRadius: radius.md,
            },
          ]}
        />
      </View>

      {label ? (
        <View
          style={[
            styles.labelWrap,
            { top: verticalBand + frameHeight + spacing(3) },
          ]}
        >
          <Text style={styles.label}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    backgroundColor: colors.overlay,
  },
  frame: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(244, 246, 255, 0.18)',
    borderRadius: radius.md,
  },
  labelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing(6),
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: colors.overlayStrong,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
