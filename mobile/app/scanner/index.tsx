/**
 * Dual-mode document scanner.
 *
 *  Mode 1 — "Scan Exam & Answer Key" (setup)
 *      Two-step capture: question paper → sample answer key.
 *      Payload is later dispatched to POST /api/v1/exam/setup.
 *  Mode 2 — "Scan Student Answer Sheet" (paper)
 *      Single capture against the exam chosen on Home.
 *      Payload is later dispatched to POST /api/v1/papers/upload.
 *
 * Built on expo-camera's CameraView (SDK 51): real props only — `facing`,
 * `enableTorch`, `zoom`, `autofocus`, `mode="picture"` and
 * `takePictureAsync`. Includes the mode-switcher header, step indicator,
 * FrameGuide optical alignment overlay, and flash / autofocus / zoom /
 * camera-flip controls. Captures are written to the capture session store;
 * Preview performs edit + upload.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpenCheck,
  Camera,
  FileScan,
  Focus,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react-native';

import { FrameGuide } from '../../components/FrameGuide';
import {
  getSession,
  setCaptured,
  SetupStep,
  switchMode,
} from '../../lib/captureStore';
import { colors, radius, spacing } from '../../lib/theme';

const ZOOM_STEP = 0.1;

export default function ScannerScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState(() => getSession().mode);
  const [setupStep, setSetupStep] = useState<SetupStep>('question');
  const [torch, setTorch] = useState(false);
  const [autoFocus, setAutoFocus] = useState(true);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [zoom, setZoom] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stepLabel = useMemo(() => {
    if (mode === 'paper') {
      const title = getSession().examTitle;
      return title ? `Student sheet · ${title}` : 'Student answer sheet';
    }
    return setupStep === 'question'
      ? 'Step 1 of 2 · Question paper'
      : 'Step 2 of 2 · Sample answer key';
  }, [mode, setupStep]);

  const handleSwitchMode = useCallback(
    (nextMode: 'setup' | 'paper'): void => {
      if (nextMode === mode) {
        return;
      }
      switchMode(nextMode);
      setMode(nextMode);
      setSetupStep('question');
    },
    [mode],
  );

  const adjustZoom = useCallback((delta: number): void => {
    setZoom((value) => {
      const next = Math.round((value + delta) * 100) / 100;
      return Math.min(1, Math.max(0, next));
    });
  }, []);

  const handleCapture = useCallback(async (): Promise<void> => {
    const camera = cameraRef.current;
    if (!camera || capturing) {
      return;
    }
    setCapturing(true);
    try {
      const photo = await camera.takePictureAsync({ quality: 0.85 });
      if (!photo) {
        return;
      }
      const image = { uri: photo.uri, width: photo.width, height: photo.height };
      if (mode === 'setup') {
        if (setupStep === 'question') {
          setCaptured('question', image);
          setSetupStep('answer');
        } else {
          setCaptured('answer', image);
          router.push('/preview');
        }
      } else {
        setCaptured('paper', image);
        router.push('/preview');
      }
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? `Capture failed: ${error.message}`
          : 'Capture failed. Please try again.',
      );
    } finally {
      setCapturing(false);
    }
  }, [capturing, mode, router, setupStep]);

  // -------------------------------------------------------------------------
  // Permission states
  // -------------------------------------------------------------------------
  if (Platform.OS === 'web') {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateText}>
          The document camera requires a physical iOS or Android device.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerState}>
        <Camera size={40} color={colors.textDim} />
        <Text style={styles.stateTitle}>Camera access needed</Text>
        <Text style={styles.stateText}>
          ScriptGrade scans answer sheets with the device camera. Photos are
          uploaded to your institution&apos;s grading pipeline and are never
          shared elsewhere.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              void requestPermission();
            }}
          >
            <Text style={styles.primaryButtonText}>Grant camera access</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              void Linking.openSettings();
            }}
          >
            <Text style={styles.primaryButtonText}>Open system settings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Camera UI
  // -------------------------------------------------------------------------
  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="picture"
        enableTorch={torch}
        autofocus={autoFocus ? 'on' : 'off'}
        zoom={zoom}
        onMountError={(event) => {
          setCameraError(`Camera failed to start: ${event.message}`);
        }}
      />

      <FrameGuide label={stepLabel} />

      {/* Header: close + mode switcher */}
      <View style={[styles.header, { paddingTop: insets.top + spacing(2) }]}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Close scanner"
        >
          <X size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeChip, mode === 'setup' && styles.modeChipActive]}
            onPress={() => handleSwitchMode('setup')}
          >
            <BookOpenCheck
              size={14}
              color={mode === 'setup' ? colors.text : colors.textDim}
            />
            <Text
              style={[
                styles.modeChipText,
                mode === 'setup' && styles.modeChipTextActive,
              ]}
            >
              Exam Setup
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, mode === 'paper' && styles.modeChipActive]}
            onPress={() => handleSwitchMode('paper')}
          >
            <FileScan
              size={14}
              color={mode === 'paper' ? colors.text : colors.textDim}
            />
            <Text
              style={[
                styles.modeChipText,
                mode === 'paper' && styles.modeChipTextActive,
              ]}
            >
              Student Sheet
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {/* Setup step indicator */}
      {mode === 'setup' ? (
        <View
          style={[
            styles.stepIndicator,
            { top: insets.top + spacing(14) },
          ]}
        >
          <View
            style={[
              styles.stepDot,
              setupStep === 'question' && styles.stepDotActive,
            ]}
          />
          <View
            style={[
              styles.stepDot,
              setupStep === 'answer' && styles.stepDotActive,
            ]}
          />
        </View>
      ) : null}

      {cameraError ? (
        <View style={[styles.errorBanner, { top: insets.top + spacing(20) }]}>
          <Text style={styles.errorText}>{cameraError}</Text>
          <TouchableOpacity onPress={() => setCameraError(null)} hitSlop={8}>
            <X size={15} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Bottom controls */}
      <View
        style={[
          styles.controls,
          { paddingBottom: insets.bottom + spacing(5) },
        ]}
      >
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setTorch((value) => !value)}
            accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'}
          >
            {torch ? (
              <Flashlight size={20} color={colors.accent} />
            ) : (
              <FlashlightOff size={20} color={colors.text} />
            )}
            <Text style={styles.controlText}>Flash</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setAutoFocus((value) => !value)}
            accessibilityLabel={autoFocus ? 'Disable autofocus' : 'Enable autofocus'}
          >
            <Focus size={20} color={autoFocus ? colors.accent : colors.text} />
            <Text style={styles.controlText}>
              {autoFocus ? 'AF on' : 'AF off'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => adjustZoom(-ZOOM_STEP)}
            disabled={zoom <= 0}
            accessibilityLabel="Zoom out"
          >
            <ZoomOut size={20} color={zoom <= 0 ? colors.textDim : colors.text} />
            <Text style={styles.controlText}>{Math.round(zoom * 100)}%</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => adjustZoom(ZOOM_STEP)}
            disabled={zoom >= 1}
            accessibilityLabel="Zoom in"
          >
            <ZoomIn size={20} color={zoom >= 1 ? colors.textDim : colors.text} />
            <Text style={styles.controlText}>Zoom</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() =>
              setFacing((value) => (value === 'back' ? 'front' : 'back'))
            }
            accessibilityLabel="Flip camera"
          >
            <SwitchCamera size={20} color={colors.text} />
            <Text style={styles.controlText}>Flip</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.shutter, capturing && styles.shutterBusy]}
          onPress={() => {
            void handleCapture();
          }}
          disabled={capturing}
          accessibilityLabel="Capture document"
        >
          {capturing ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>

        <Text style={styles.captureHint}>
          {mode === 'setup'
            ? setupStep === 'question'
              ? 'Align the question paper inside the frame'
              : 'Now align the sample answer key'
            : 'Align the student answer sheet inside the frame'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerState: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(8),
    gap: spacing(3),
  },
  stateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  stateText: {
    color: colors.textDim,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(3),
    marginTop: spacing(2),
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: spacing(2),
  },
  secondaryButtonText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(4),
    gap: spacing(3),
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.overlayStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSwitcher: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing(2),
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.overlayStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.primary,
  },
  modeChipText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: colors.text,
  },
  headerSpacer: {
    width: 38,
  },
  stepIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing(1.5),
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(244, 246, 255, 0.35)',
  },
  stepDotActive: {
    backgroundColor: colors.accent,
    width: 22,
  },
  errorBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    maxWidth: '88%',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    flexShrink: 1,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: spacing(4),
    backgroundColor: 'transparent',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing(2),
    flexWrap: 'wrap',
    paddingHorizontal: spacing(3),
  },
  controlButton: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.overlayStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    minWidth: 62,
  },
  controlText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: radius.pill,
    borderWidth: 5,
    borderColor: colors.text,
    backgroundColor: 'rgba(244, 246, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBusy: {
    opacity: 0.7,
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  captureHint: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: colors.overlayStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(1.5),
    overflow: 'hidden',
  },
});
