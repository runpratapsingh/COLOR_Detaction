import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { DEFAULT_API_URL, analyzeBottleImage } from '../../services/colorDetectionApi';
import { AnalysisResponse, TargetColorEntry } from '../../types/colorDetection';
import { BottleGuideOverlay } from './BottleGuideOverlay';
import { ValidationResultCard } from './ValidationResultCard';

const TEST_TARGET_COLORS: TargetColorEntry[] = [
  { id: 'target-orange', name: 'Orange Chemical Standard', hex: '#FC7A01' },
  { id: 'target-blue', name: 'Cyan-Blue Standard', hex: '#01C7E7' },
  { id: 'target-calib-orange', name: 'Iron: 0.8–1.0 mg/L (Strong orange)', hex: '#ED8A3A' },
  { id: 'target-calib-red', name: 'Iron: 2.0–3.0 mg/L (Red-orange)', hex: '#D94F52' },
];

const DEFAULT_IRON_STANDARDS: TargetColorEntry[] = [
  { id: '1', name: 'Iron: Almost clear / faint yellow (0 mg/L)', hex: '#FFF9E8' },
  { id: '2', name: 'Iron: 0.1–0.2 mg/L (Very pale yellow)', hex: '#FFF2C2' },
  { id: '3', name: 'Iron: 0.2–0.3 mg/L (Pale yellow-orange)', hex: '#FFE5A3' },
  { id: '4', name: 'Iron: 0.3–0.5 mg/L (Light orange)', hex: '#FFD08A' },
  { id: '5', name: 'Iron: 0.5–0.8 mg/L (Orange)', hex: '#F5A45B' },
  { id: '6', name: 'Iron: 0.8–1.0 mg/L (Strong orange)', hex: '#ED8A3A' },
  { id: '7', name: 'Iron: 1.0–1.5 mg/L (Orange-red)', hex: '#E66A3A' },
  { id: '8', name: 'Iron: 1.5–2.0 mg/L (Reddish orange)', hex: '#D9573F' },
  { id: '9', name: 'Iron: 2.0–3.0 mg/L (Red-orange / reddish pink)', hex: '#D94F52' },
  { id: '10', name: 'Iron: 3.0–4.0 mg/L (Strong reddish-orange)', hex: '#C94345' },
  { id: '11', name: 'Iron: 4.0+ mg/L (Deep red / orange-red)', hex: '#B83B3B' },
];

export const BottleColorDetectionScreen: React.FC = () => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState<'off' | 'on'>('off');
  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef<Camera>(null);

  const [backendUrl, setBackendUrl] = useState<string>(DEFAULT_API_URL);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isTargetColorsExpanded, setIsTargetColorsExpanded] = useState<boolean>(true);

  const [targetColors, setTargetColors] = useState<TargetColorEntry[]>(TEST_TARGET_COLORS);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const analysisSteps = [
    '🔍 1/4 Localizing Bottle & Liquid ROI...',
    '✨ 2/4 Filtering Specular Glare & Shadows...',
    '🎨 3/4 Converting RGB to CIE Lab D65 Space...',
    '📐 4/4 Computing CIEDE2000 ΔE Distance...',
  ];

  React.useEffect(() => {
    if (isAnalyzing) {
      setAnalysisStep(0);
      const interval = setInterval(() => {
        setAnalysisStep((prev) => (prev < analysisSteps.length - 1 ? prev + 1 : prev));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing]);

  React.useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Take photo from live camera stream
  async function handleTakePhoto() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: false,
      });

      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      setCapturedPhotoUri(uri);
      setIsCameraActive(false);
      executeAnalysis(uri);
    } catch (err) {
      Alert.alert('Capture Error', 'Failed to take camera photo.');
    }
  }

  // Pick image from phone photo gallery
  async function handlePickImageFromGallery() {
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
        setCapturedPhotoUri(selectedUri);
        setIsCameraActive(false);
        executeAnalysis(selectedUri);
      }
    } catch (err) {
      Alert.alert('Image Picker Error', 'Failed to select image from photo library.');
    }
  }

  function handleRetake() {
    setCapturedPhotoUri(null);
    setResult(null);
    setIsCameraActive(true);
  }

  // Target Color Management
  function handleAddTargetColor() {
    const newEntry: TargetColorEntry = {
      id: String(Date.now()),
      name: `State ${targetColors.length + 1}`,
      hex: '#EB9BB4',
    };
    setTargetColors([...targetColors, newEntry]);
  }

  function handleRemoveTargetColor(index: number) {
    if (targetColors.length <= 1) return;
    const updated = [...targetColors];
    updated.splice(index, 1);
    setTargetColors(updated);
  }

  function handleUpdateTargetColor(index: number, field: 'name' | 'hex', val: string) {
    const updated = [...targetColors];
    let value = val;
    if (field === 'hex') {
      value = val.toUpperCase();
      if (!value.startsWith('#')) value = '#' + value;
    }
    updated[index] = { ...updated[index], [field]: value };
    setTargetColors(updated);
  }

  // Execute FastAPI Analysis
  async function executeAnalysis(uri: string) {
    if (targetColors.length === 0) {
      Alert.alert('Configuration Error', 'Please add at least one target color standard.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const resp = await analyzeBottleImage(
        {
          imageUri: uri,
          testCode: 'CHEM_001',
          incubationSeconds: 300,
          whiteBalanceMethod: 'REFERENCE_PATCH',
          targetColors: targetColors,
          debug: true,
        },
        backendUrl
      );
      setResult(resp);
    } catch (err) {
      Alert.alert('Analysis Failed', err instanceof Error ? err.message : 'Pipeline error.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  const targetMatches = result?.classification?.target_matches ?? [];
  const bestMatch = result?.classification?.best_target_match ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with Server Connection Status */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chemical Reaction Camera</Text>
          <View style={styles.serverStatusPill}>
            <View style={styles.greenPingDot} />
            <Text style={styles.headerSubtitle}>ENGINE CONNECTED (`{backendUrl}`)</Text>
          </View>
        </View>

        {/* Capture Requirements — shown before shooting so retakes are rarer */}
        {isCameraActive && (
          <View style={styles.captureTipsBox}>
            <Text style={styles.captureTipsTitle}>📋 Capture Checklist (for accurate color):</Text>
            <Text style={styles.captureTipItem}>☀️ In shade or overcast? No direct sun on bottle</Text>
            <Text style={styles.captureTipItem}>📷 Flash OFF, HDR OFF, filters OFF (auto-enforced)</Text>
            <Text style={styles.captureTipItem}>🏷️ Label facing AWAY from camera</Text>
            <Text style={styles.captureTipItem}>🤍 White paper/clipboard behind the bottle</Text>
            <Text style={styles.captureTipItem}>📐 Full bottle visible, filling ~50% of frame</Text>
            <Text style={styles.captureTipItem}>📱 Portrait orientation (phone upright)</Text>
            <Text style={styles.captureTipItem}>🔍 Tap bottle to focus on the liquid</Text>
            <Text style={styles.captureTipItem}>✋ Hold phone steady — don't move</Text>
          </View>
        )}

        {/* Live Camera Viewfinder or Preview Container */}
        <View style={styles.cameraContainer}>
          <View style={styles.cameraBox}>
            {isCameraActive && device ? (
              <>
                <Camera
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  device={device}
                  isActive={true}
                  photo={true}
                  torch={torch}
                  photoHdr={false}
                />
                <BottleGuideOverlay showGuide={true} />

                {/* Top Camera Controls Overlay (Flash & Flip Camera) */}
                <View style={styles.topCameraControls}>
                  <TouchableOpacity
                    style={[styles.cameraControlBtn, torch === 'on' && styles.controlBtnActive]}
                    onPress={() => setTorch(torch === 'off' ? 'on' : 'off')}>
                    <Text style={styles.controlBtnText}>{torch === 'on' ? '⚡ FLASH ON' : '⚡ FLASH OFF'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cameraControlBtn}
                    onPress={() => setCameraPosition(cameraPosition === 'back' ? 'front' : 'back')}>
                    <Text style={styles.controlBtnText}>🔄 FLIP</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : capturedPhotoUri ? (
              <>
                <Image source={{ uri: capturedPhotoUri }} style={styles.previewImage} resizeMode="contain" />
                <BottleGuideOverlay showGuide={true} />
              </>
            ) : (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>Camera Viewfinder Initializing</Text>
              </View>
            )}
          </View>

          {/* Action Control Bar (Positioned OUTSIDE & BELOW cameraBox so it NEVER overlaps the guide frame!) */}
          {isCameraActive && device ? (
            <View style={styles.cameraControlBar}>
              <TouchableOpacity style={styles.uploadIconButton} onPress={handlePickImageFromGallery}>
                <Text style={styles.uploadIconText}>🖼️</Text>
                <Text style={styles.uploadIconLabel}>GALLERY</Text>
              </TouchableOpacity>

              {/* Pro Dual Concentric Ring Shutter Button */}
              <TouchableOpacity style={styles.shutterOuterRing} onPress={handleTakePhoto} activeOpacity={0.7}>
                <View style={styles.shutterInnerBtn} />
              </TouchableOpacity>

              <View style={{ width: 44 }} />
            </View>
          ) : capturedPhotoUri ? (
            <View style={styles.cameraControlBar}>
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
                <Text style={styles.retakeBtnText}>🔄 RETAKE PHOTO</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadBtn} onPress={handlePickImageFromGallery}>
                <Text style={styles.uploadBtnText}>🖼️ CHOOSE OTHER</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraControlBar}>
              <TouchableOpacity style={styles.uploadBtnPlaceholder} onPress={handlePickImageFromGallery}>
                <Text style={styles.uploadBtnText}>🖼️ UPLOAD IMAGE FROM GALLERY</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Collapsible Target Colors Configuration Card */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeaderRow}
            onPress={() => setIsTargetColorsExpanded(!isTargetColorsExpanded)}>
            <View style={styles.cardTitleCol}>
              <Text style={styles.cardTitle}>Target Color Standards ({targetColors.length} Active)</Text>
              <Text style={styles.cardSubText}>
                {isTargetColorsExpanded ? 'Tap to collapse configuration' : 'Tap to expand & edit target colors'}
              </Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={handleAddTargetColor}>
              <Text style={styles.addBtnText}>+ Add Standard</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Quick 1-Tap Single Color Presets for Accuracy Testing */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll} contentContainerStyle={styles.presetScrollContent}>
            <TouchableOpacity
              style={[styles.presetChip, targetColors.length === 1 && targetColors[0].hex === '#FC7A01' && styles.presetChipActive]}
              onPress={() => setTargetColors([{ id: 'target-orange', name: 'Orange Chemical Standard', hex: '#FC7A01' }])}>
              <View style={[styles.presetDot, { backgroundColor: '#FC7A01' }]} />
              <Text style={styles.presetChipText}>Only Orange (#FC7A01)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetChip, targetColors.length === 1 && targetColors[0].hex === '#01C7E7' && styles.presetChipActive]}
              onPress={() => setTargetColors([{ id: 'target-blue', name: 'Cyan-Blue Standard', hex: '#01C7E7' }])}>
              <View style={[styles.presetDot, { backgroundColor: '#01C7E7' }]} />
              <Text style={styles.presetChipText}>Only Blue (#01C7E7)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetChip, targetColors.length === 1 && targetColors[0].hex === '#ED8A3A' && styles.presetChipActive]}
              onPress={() => setTargetColors([{ id: 'target-calib-orange', name: 'Iron: 0.8–1.0 mg/L (Strong orange)', hex: '#ED8A3A' }])}>
              <View style={[styles.presetDot, { backgroundColor: '#ED8A3A' }]} />
              <Text style={styles.presetChipText}>Only Calib. Orange (#ED8A3A)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetChip, targetColors.length === 1 && targetColors[0].hex === '#D94F52' && styles.presetChipActive]}
              onPress={() => setTargetColors([{ id: 'target-calib-red', name: 'Iron: 2.0–3.0 mg/L (Red-orange)', hex: '#D94F52' }])}>
              <View style={[styles.presetDot, { backgroundColor: '#D94F52' }]} />
              <Text style={styles.presetChipText}>Only Calib. Red (#D94F52)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetChip, targetColors.length === 4 && styles.presetChipActive]}
              onPress={() => setTargetColors(TEST_TARGET_COLORS)}>
              <Text style={styles.presetChipText}>📋 All 4 Test Standards</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetChip, targetColors.length === 11 && styles.presetChipActive]}
              onPress={() => setTargetColors(DEFAULT_IRON_STANDARDS)}>
              <Text style={styles.presetChipText}>🧪 11 Iron Standards</Text>
            </TouchableOpacity>
          </ScrollView>

          {isTargetColorsExpanded &&
            targetColors.map((tc, idx) => (
              <View key={tc.id || idx} style={styles.targetRow}>
                <View style={[styles.colorSwatch, { backgroundColor: tc.hex.startsWith('#') ? tc.hex : '#888888' }]} />
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={tc.name}
                  onChangeText={(v) => handleUpdateTargetColor(idx, 'name', v)}
                  placeholder="State Name"
                  placeholderTextColor="#71717A"
                />
                <TextInput
                  style={[styles.input, styles.hexInput]}
                  value={tc.hex}
                  onChangeText={(v) => handleUpdateTargetColor(idx, 'hex', v)}
                  placeholder="#RRGGBB"
                  placeholderTextColor="#71717A"
                />
                <TouchableOpacity
                  disabled={targetColors.length <= 1}
                  onPress={() => handleRemoveTargetColor(idx)}
                  style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
        </View>

        {/* Backend API Configuration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>FastAPI Engine URL</Text>
          <TextInput
            style={styles.input}
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://192.168.29.205:8000/api/v1"
            placeholderTextColor="#71717A"
          />
        </View>

        {/* High-Tech Analysis Loading Indicator */}
        {isAnalyzing && (
          <View style={styles.analysisLoadingBox}>
            <View style={styles.loadingHeaderRow}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={styles.loadingTitle}>CV & Color Science Engine Active</Text>
            </View>

            {/* Diagnostic Ticker Step */}
            <View style={styles.stepTickerCard}>
              <Text style={styles.stepTickerText}>{analysisSteps[analysisStep]}</Text>
            </View>

            {/* Multi-Step Progress Tracker Dots */}
            <View style={styles.stepDotsRow}>
              {analysisSteps.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.stepDot,
                    idx <= analysisStep ? styles.stepDotActive : styles.stepDotInactive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Analysis Results */}
        {result && !isAnalyzing && (
          <View style={styles.resultsContainer}>
            {/* Interactive Quality, Object Detection & Extracted Liquid Color Validation Card */}
            <ValidationResultCard result={result} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0F17',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FAFAFA',
  },
  serverStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  greenPingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1E2230',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D3346',
    padding: 14,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FAFAFA',
  },
  cardSubText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 8,
  },
  captureTipsBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: '#06B6D4',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  captureTipsTitle: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  captureTipItem: {
    color: '#D1D5DB',
    fontSize: 12,
    marginVertical: 1,
    lineHeight: 17,
  },
  cameraContainer: {
    marginBottom: 14,
  },
  cameraBox: {
    width: '100%',
    height: 420,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#161922',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#2D3346',
  },
  cameraControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1E2230',
    borderColor: '#2D3346',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
  },
  topCameraControls: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  cameraControlBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: '#374151',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10B981',
  },
  controlBtnText: {
    color: '#FAFAFA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  uploadIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#374151',
  },
  uploadIconText: {
    fontSize: 14,
  },
  uploadIconLabel: {
    color: '#9CA3AF',
    fontSize: 7,
    fontWeight: '800',
    marginTop: 1,
  },
  shutterOuterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    elevation: 8,
  },
  shutterInnerBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#10B981',
  },
  flexInput: {
    flex: 1,
    marginRight: 6,
  },
  hexInput: {
    width: 85,
    marginRight: 6,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    padding: 20,
  },
  placeholderText: {
    color: '#71717A',
    fontSize: 14,
  },
  actionBtnRow: {
    position: 'absolute',
    bottom: 14,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    zIndex: 20,
  },
  shutterBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 4,
  },
  shutterBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  uploadBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 4,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  retakeBtn: {
    backgroundColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  placeholderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  uploadBtnPlaceholder: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  analysisLoadingBox: {
    backgroundColor: '#1E2230',
    borderColor: '#06B6D4',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginVertical: 14,
    gap: 12,
    shadowColor: '#06B6D4',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  loadingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingTitle: {
    color: '#06B6D4',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepTickerCard: {
    backgroundColor: '#161922',
    borderColor: '#2D3346',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  stepTickerText: {
    color: '#FAFAFA',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  stepDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  stepDot: {
    height: 4,
    borderRadius: 2,
    flex: 1,
  },
  stepDotActive: {
    backgroundColor: '#06B6D4',
  },
  stepDotInactive: {
    backgroundColor: '#2D3346',
  },
  addBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  presetScroll: {
    marginVertical: 10,
  },
  presetScrollContent: {
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161922',
    borderColor: '#374151',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  presetChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  presetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  presetChipText: {
    color: '#FAFAFA',
    fontSize: 11,
    fontWeight: '700',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  removeBtn: {
    padding: 6,
  },
  removeBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingBox: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#10B981',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  resultsContainer: {
    gap: 14,
  },
  winnerCard: {
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    borderColor: '#059669',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  winnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  winnerSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  winnerLabel: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  winnerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  winnerPct: {
    color: '#34D399',
    fontSize: 18,
    fontWeight: '900',
  },
  matchItem: {
    marginBottom: 10,
  },
  matchTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  matchNameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  matchName: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
  matchPctText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#27272A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreBadge: {
    backgroundColor: '#059669',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 'bold',
  },
  qMetric: {
    color: '#A1A1AA',
    fontSize: 11,
    marginBottom: 2,
  },
  metricText: {
    color: '#D4D4D8',
    fontSize: 11,
    marginBottom: 4,
  },
});
