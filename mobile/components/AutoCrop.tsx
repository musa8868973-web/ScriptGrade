/**
 * AutoCrop — capture adjustment surface for scanned documents.
 *
 * Controls (per the mobile PRD scanner spec):
 *  - Rotate left / right in 90° steps
 *  - Aspect crop: Original · 4:3 · 3:4 · A4 (center-crop)
 *  - Reset: restores the untouched capture ("perspective reset"). True
 *    four-point perspective correction requires native CV primitives that
 *    expo-image-manipulator deliberately does not expose; the reset control
 *    therefore returns to the original, undistorted pixels — the safe,
 *    hallucination-free behaviour on Expo SDK 51.
 *
 * Edits are applied exactly once (on Apply) via a single
 * `ImageManipulator.manipulateAsync` call (rotate → crop) so the JPEG never
 * accumulates re-encode loss. The dashed preview overlay uses the same pure
 * geometry functions as the pixel pipeline, so what you see is what ships.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Check,
  Crop,
  RotateCcw,
  RotateCw,
  Undo2,
} from 'lucide-react-native';

import { CapturedImage } from '../lib/captureStore';
import { colors, radius, spacing } from '../lib/theme';

// ---------------------------------------------------------------------------
// Pure geometry (exported for unit testing / reuse)
// ---------------------------------------------------------------------------
export type AspectKey = 'original' | '4:3' | '3:4' | 'a4';

export const ASPECT_RATIO: Record<Exclude<AspectKey, 'original'>, number> = {
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  /** ISO A4 portrait: width / height. */
  a4: 210 / 297,
};

export interface Size {
  width: number;
  height: number;
}

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Dimensions of an image after a 90°-step rotation. */
export function rotatedSize(width: number, height: number, rotation: number): Size {
  return rotation % 180 === 0
    ? { width, height }
    : { width: height, height: width };
}

/** Largest centered rectangle of `ratio` (w/h) inside `width`×`height`. */
export function centerCropRect(
  width: number,
  height: number,
  ratio: number,
): CropRect {
  const current = width / height;
  let cropWidth = width;
  let cropHeight = height;
  if (current > ratio) {
    cropWidth = Math.round(height * ratio);
  } else {
    cropHeight = Math.round(width / ratio);
  }
  return {
    originX: Math.round((width - cropWidth) / 2),
    originY: Math.round((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface AutoCropProps {
  image: CapturedImage;
  onApply: (next: CapturedImage) => void;
  onBusyChange?: (busy: boolean) => void;
}

const ASPECT_OPTIONS: Array<{ key: AspectKey; label: string }> = [
  { key: 'original', label: 'Original' },
  { key: '4:3', label: '4:3' },
  { key: '3:4', label: '3:4' },
  { key: 'a4', label: 'A4' },
];

const PREVIEW_MAX_HEIGHT = 340;

export function AutoCrop({
  image,
  onApply,
  onBusyChange,
}: AutoCropProps): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions();
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<AspectKey>('original');
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const previewMaxWidth = windowWidth - spacing(8);

  // Display geometry — uniform scale, so the dashed crop window maps 1:1
  // onto the pixel-space crop computed in `applyEdits`.
  const preview = useMemo(() => {
    const rotated = rotatedSize(image.width, image.height, rotation);
    const scale = Math.min(
      previewMaxWidth / rotated.width,
      PREVIEW_MAX_HEIGHT / rotated.height,
    );
    const container = {
      width: Math.max(1, Math.round(rotated.width * scale)),
      height: Math.max(1, Math.round(rotated.height * scale)),
    };
    const img = {
      width: Math.max(1, Math.round(image.width * scale)),
      height: Math.max(1, Math.round(image.height * scale)),
    };
    const cropWindow =
      aspect === 'original'
        ? null
        : centerCropRect(container.width, container.height, ASPECT_RATIO[aspect]);
    return { container, img, cropWindow };
  }, [image.width, image.height, rotation, aspect, previewMaxWidth]);

  const dirty = rotation !== 0 || aspect !== 'original';

  const setBusyState = (next: boolean): void => {
    setBusy(next);
    onBusyChange?.(next);
  };

  const handleReset = (): void => {
    if (busy) {
      return;
    }
    setRotation(0);
    setAspect('original');
    setEditError(null);
  };

  const handleApply = async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusyState(true);
    setEditError(null);
    try {
      const actions: ImageManipulator.Action[] = [];
      if (rotation !== 0) {
        actions.push({ rotate: rotation });
      }
      if (aspect !== 'original') {
        const dims = rotatedSize(image.width, image.height, rotation);
        actions.push({
          crop: centerCropRect(dims.width, dims.height, ASPECT_RATIO[aspect]),
        });
      }
      if (actions.length === 0) {
        onApply(image);
        return;
      }
      const result = await ImageManipulator.manipulateAsync(
        image.uri,
        actions,
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );
      onApply({ uri: result.uri, width: result.width, height: result.height });
    } catch (error) {
      setEditError(
        error instanceof Error
          ? `Image edit failed: ${error.message}`
          : 'Image edit failed. Please retake the photo.',
      );
    } finally {
      setBusyState(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Preview surface */}
      <View style={styles.previewWrap}>
        <View
          style={[
            styles.preview,
            {
              width: preview.container.width,
              height: preview.container.height,
            },
          ]}
        >
          <Image
            source={{ uri: image.uri }}
            resizeMode="cover"
            style={[
              styles.previewImage,
              {
                width: preview.img.width,
                height: preview.img.height,
                left: Math.round(
                  (preview.container.width - preview.img.width) / 2,
                ),
                top: Math.round(
                  (preview.container.height - preview.img.height) / 2,
                ),
                transform: [{ rotate: `${rotation}deg` }],
              },
            ]}
          />
          {preview.cropWindow ? (
            <View
              pointerEvents="none"
              style={[
                styles.cropWindow,
                {
                  left: preview.cropWindow.originX,
                  top: preview.cropWindow.originY,
                  width: preview.cropWindow.width,
                  height: preview.cropWindow.height,
                },
              ]}
            />
          ) : null}
          {busy ? (
            <View style={styles.busyOverlay}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : null}
        </View>
      </View>

      {editError ? <Text style={styles.errorText}>{editError}</Text> : null}

      {/* Rotation controls */}
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setRotation((value) => (value + 270) % 360)}
          disabled={busy}
          accessibilityLabel="Rotate left"
        >
          <RotateCcw size={18} color={colors.text} />
          <Text style={styles.controlLabel}>Rotate −90°</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setRotation((value) => (value + 90) % 360)}
          disabled={busy}
          accessibilityLabel="Rotate right"
        >
          <RotateCw size={18} color={colors.text} />
          <Text style={styles.controlLabel}>Rotate +90°</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, !dirty && styles.controlDisabled]}
          onPress={handleReset}
          disabled={busy || !dirty}
          accessibilityLabel="Reset perspective and edits"
        >
          <Undo2 size={18} color={dirty ? colors.accent : colors.textDim} />
          <Text
            style={[
              styles.controlLabel,
              !dirty && styles.controlLabelDisabled,
            ]}
          >
            Reset
          </Text>
        </TouchableOpacity>
      </View>

      {/* Aspect crop selector */}
      <View style={styles.row}>
        <Crop size={16} color={colors.textDim} />
        {ASPECT_OPTIONS.map((option) => {
          const active = aspect === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.aspectChip, active && styles.aspectChipActive]}
              onPress={() => setAspect(option.key)}
              disabled={busy}
            >
              <Text
                style={[
                  styles.aspectChipText,
                  active && styles.aspectChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Apply */}
      <TouchableOpacity
        style={[styles.applyButton, busy && styles.controlDisabled]}
        onPress={() => {
          void handleApply();
        }}
        disabled={busy}
      >
        <Check size={18} color={colors.text} />
        <Text style={styles.applyLabel}>
          {dirty ? 'Apply edits' : 'Keep original'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing(3),
  },
  previewWrap: {
    alignItems: 'center',
  },
  preview: {
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewImage: {
    position: 'absolute',
  },
  cropWindow: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 106, 0, 0.08)',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    flexWrap: 'wrap',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlDisabled: {
    opacity: 0.5,
  },
  controlLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  controlLabelDisabled: {
    color: colors.textDim,
  },
  aspectChip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aspectChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  aspectChipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  aspectChipTextActive: {
    color: colors.text,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    paddingVertical: spacing(3),
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  applyLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
