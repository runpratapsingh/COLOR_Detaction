import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { JalqTheme } from '../../theme/colors';
import { ChemicalTestDetail, JalqAnalysisResponse } from '../../types/jalq';
import { analyzeBottleCapture } from '../../services/jalqApi';
import { TechnicalGuideOverlay } from './TechnicalGuideOverlay';
import {
  CaptureInstructionsModal,
  HeaderBackButton,
  NormalizedRoi,
  SolutionAreaSelectorModal,
  ValidationGateModal,
} from '../../components';

interface CameraCaptureScreenProps {
  test: ChemicalTestDetail;
  incubationSeconds: number;
  onBack: () => void;
  onAnalysisComplete: (result: JalqAnalysisResponse, capturedUri: string) => void;
}

export const CameraCaptureScreen: React.FC<CameraCaptureScreenProps> = ({
  test,
  incubationSeconds,
  onBack,
  onAnalysisComplete,
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState<'off' | 'on'>('off');
  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef<Camera>(null);

  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [showSolutionSelector, setShowSolutionSelector] = useState(false);

  const [showInstructions, setShowInstructions] = useState(false);
  const [showValidationGate, setShowValidationGate] = useState(false);
  const [failedValidationResult, setFailedValidationResult] = useState<JalqAnalysisResponse | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  const pipelineSteps = [
    'Checking photo clarity and lighting...',
    'Finding bottle and liquid area...',
    'Checking color and reflections...',
    'Matching calibrated standard...',
  ];

  const handleRetakeFromGate = () => {
    setShowValidationGate(false);
    setFailedValidationResult(null);
    setCapturedUri(null);
  };

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isAnalyzing) {
      setAnalysisStep(0);
      interval = setInterval(() => {
        setAnalysisStep((prev) => (prev < pipelineSteps.length - 1 ? prev + 1 : prev));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleCapturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: false,
      });

      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      setCapturedUri(uri);
      setShowSolutionSelector(true);
    } catch (err) {
      Alert.alert('Camera Capture Error', 'Failed to capture frame from camera.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const pickerResult = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      });

      if (pickerResult.didCancel || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const selectedUri = pickerResult.assets[0].uri;
      if (selectedUri) {
        setCapturedUri(selectedUri);
        setShowSolutionSelector(true);
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Failed to select image from photo library.');
    }
  };

  const runAnalysis = async (uri: string, liquidRoi?: NormalizedRoi) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeBottleCapture({
        testId: test.test_id,
        imageUri: uri,
        incubationSeconds: incubationSeconds,
        whiteBalanceMethod: 'REFERENCE_PATCH',
        bottleGuide: [0.19, 0.16, 0.81, 0.84],
        liquidRoi: liquidRoi,
        debug: true,
      });
      setIsAnalyzing(false);

      // Capture Quality Gate: Check if image was rejected for critical color-accuracy checks
      // (Fit/framing, glare, orientation, and blur validations have been removed per requirements)
      const ignoredReasons = [
        'POOR_FRAMING_TOO_SMALL',
        'POOR_FRAMING_TOO_LARGE',
        'POOR_FRAMING_CLIPPED',
        'EXCESSIVE_REFLECTION',
        'LANDSCAPE_ORIENTATION',
        'BLURRY',
      ];
      const activeReasons = (result.reasons || []).filter(
        (r: string) => !ignoredReasons.includes(r)
      );
      const activeCaptureDetails = (result.capture_rejection_details || []).filter(
        (d: any) => !ignoredReasons.includes(d.reason)
      );
      const activeRejectionDetails = (result.rejection_details || []).filter(
        (d: any) => !ignoredReasons.includes(d.reason)
      );

      const isRejected =
        result.status === 'ERROR' ||
        activeCaptureDetails.length > 0 ||
        activeRejectionDetails.length > 0 ||
        (activeReasons.length > 0 && result.status !== 'SUCCESS');

      if (isRejected) {
        setFailedValidationResult(result);
        setShowValidationGate(true);
        return;
      }

      onAnalysisComplete(result, uri);
    } catch (err: any) {
      setIsAnalyzing(false);
      Alert.alert(
        'Connection Error',
        err.message || 'Could not connect to analysis service. Please check your network or server.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={false} />

      {/* Top Controls Bar */}
      <View style={styles.topControlBar}>
        <View style={styles.headerSlotLeft}>
          <HeaderBackButton onPress={onBack} label="Incubation" disabled={isAnalyzing} />
        </View>

        <View style={styles.headerSlotCenter}>
          <View style={styles.testBadge}>
            <Text style={styles.testBadgeText} numberOfLines={1} ellipsizeMode="tail">
              {test.name}
            </Text>
          </View>
        </View>

        <View style={styles.headerSlotRight}>
          <Pressable
            style={({ pressed }) => [styles.hwBtn, pressed && styles.btnPressed]}
            onPress={() => setShowInstructions(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.hwIcon}>ℹ️</Text>
          </Pressable>

          {device?.hasTorch && (
            <Pressable
              style={({ pressed }) => [
                styles.hwBtn,
                torch === 'on' && styles.hwBtnActive,
                pressed && styles.btnPressed,
              ]}
              onPress={() => setTorch(torch === 'off' ? 'on' : 'off')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.hwIcon}>⚡</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.hwBtn, pressed && styles.btnPressed]}
            onPress={() => setCameraPosition(cameraPosition === 'back' ? 'front' : 'back')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.hwIcon}>🔄</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Viewfinder Frame */}
      <View style={styles.viewfinderContainer}>
        {device && hasPermission ? (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!isAnalyzing}
            photo={true}
            torch={torch}
          />
        ) : (
          <View style={styles.fallbackBox}>
            <Text style={styles.fallbackTitle}>Camera Inactive</Text>
            <Text style={styles.fallbackDesc}>
              {hasPermission
                ? 'Camera device initializing...'
                : 'Camera permission required to capture bottle reactions.'}
            </Text>
          </View>
        )}

        {/* Technical Guidance Reticle */}
        {!isAnalyzing && (
          <TechnicalGuideOverlay
            isReadyToCapture={true}
            onOpenInstructions={() => setShowInstructions(true)}
          />
        )}

        {/* In-Flight Analysis Progress Overlay */}
        {isAnalyzing && (
          <View style={styles.progressOverlay}>
            <View style={styles.progressCard}>
              <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
              <Text style={styles.progressTitle}>Analyzing Test Photo...</Text>
              <Text style={styles.progressStepText}>{pipelineSteps[analysisStep]}</Text>
              <Text style={styles.progressSubtext}>
                Matching colors against calibrated standards
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Shutter & Controls Dock */}
      <View style={styles.bottomDock}>
        <Pressable
          style={styles.galleryButton}
          onPress={handlePickFromGallery}
          disabled={isAnalyzing}>
          <Text style={styles.galleryIcon}>🖼️</Text>
          <Text style={styles.galleryLabel}>Gallery / Test Bottle</Text>
        </Pressable>

        {/* Main Capture Shutter Button */}
        <Pressable
          style={[styles.shutterOuterRing, isAnalyzing && styles.shutterDisabled]}
          onPress={handleCapturePhoto}
          disabled={isAnalyzing}>
          <View style={styles.shutterInnerButton} />
        </Pressable>

        <View style={styles.dockPlaceholder}>
          <Text style={styles.dockTipsText}>Keep steady</Text>
        </View>
      </View>

      {/* Interactive Post-Capture Solution Area Selector Modal */}
      <SolutionAreaSelectorModal
        visible={showSolutionSelector}
        imageUri={capturedUri}
        title="Check Liquid Area"
        onCancel={() => {
          setShowSolutionSelector(false);
          setCapturedUri(null);
        }}
        onConfirm={(confirmedRoi) => {
          setShowSolutionSelector(false);
          if (capturedUri) {
            runAnalysis(capturedUri, confirmedRoi);
          }
        }}
      />

      {/* Chemical Photography Instructions Modal */}
      <CaptureInstructionsModal
        visible={showInstructions}
        onClose={() => setShowInstructions(false)}
      />

      {/* Strict Post-Capture Quality Gate Modal */}
      <ValidationGateModal
        visible={showValidationGate}
        result={failedValidationResult}
        imageUri={capturedUri}
        onRetake={handleRetakeFromGate}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    zIndex: 10,
  },
  headerSlotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 80,
  },
  headerSlotCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerSlotRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 80,
    gap: 8,
  },
  testBadge: {
    height: 38,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 14,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: '100%',
  },
  testBadgeText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  hwBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  hwBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  hwIcon: {
    fontSize: 15,
    textAlign: 'center',
    includeFontPadding: false,
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  viewfinderContainer: {
    flex: 1,
    backgroundColor: '#05070B',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackBox: {
    padding: 24,
    alignItems: 'center',
  },
  fallbackTitle: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  fallbackDesc: {
    color: JalqTheme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  progressOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 8, 14, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 20,
  },
  progressCard: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.primary,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  progressTitle: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 14,
    marginBottom: 6,
  },
  progressStepText: {
    color: JalqTheme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  progressSubtext: {
    color: JalqTheme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  bottomDock: {
    height: 100,
    backgroundColor: 'rgba(11, 15, 23, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  galleryButton: {
    alignItems: 'center',
    width: 80,
  },
  galleryIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  galleryLabel: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  shutterOuterRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shutterInnerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  dockPlaceholder: {
    width: 80,
    alignItems: 'center',
  },
  dockTipsText: {
    color: JalqTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
});
