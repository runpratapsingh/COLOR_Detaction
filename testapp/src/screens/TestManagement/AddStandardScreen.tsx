import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { JalqTheme } from '../../theme/colors';
import { ChemicalTestDetail, ReferenceAnalysisResult, UserSession } from '../../types/jalq';
import {
  analyzeReferenceSample,
  createColorStandard,
  fetchTestDetails,
} from '../../services/jalqApi';
import { DEMO_REFERENCE_BOTTLE_BASE64 } from '../../constants/demoReferenceBottle';
import { HeaderBackButton, InAppCameraModal, NormalizedRoi, SolutionAreaSelectorModal } from '../../components';

interface AddStandardScreenProps {
  session: UserSession;
  testId: string;
  onBack: () => void;
  onStandardSaved: (testId: string) => void;
}

export const AddStandardScreen: React.FC<AddStandardScreenProps> = ({
  session,
  testId,
  onBack,
  onStandardSaved,
}) => {
  const [test, setTest] = useState<ChemicalTestDetail | null>(null);
  const [loadingTest, setLoadingTest] = useState(true);

  // Standard inputs
  const [standardValue, setStandardValue] = useState('1');
  const [unit, setUnit] = useState('mg/L');
  const [description, setDescription] = useState('');

  // Selected image & analysis state
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageSourceType, setImageSourceType] = useState<'camera' | 'gallery' | 'demo' | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<ReferenceAnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);

  // Live camera reticle and post-capture solution area selector states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showSolutionSelector, setShowSolutionSelector] = useState(false);
  const [customLiquidRoi, setCustomLiquidRoi] = useState<NormalizedRoi | undefined>(undefined);

  const displayImageUri =
    previewUri ||
    selectedImageUri ||
    (imageBase64
      ? imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`
      : null);

  const pipelineSteps = [
    'Finding sample bottle...',
    'Locating liquid area...',
    'Checking lighting and reflections...',
    'Measuring sample color...',
    'Calculating reference color profile...',
  ];

  React.useEffect(() => {
    let isMounted = true;
    const loadTestInfo = async () => {
      setLoadingTest(true);
      try {
        const detail = await fetchTestDetails(testId);
        if (isMounted) {
          setTest(detail);
          setUnit(detail.unit);
          const nextVal = detail.standards.length;
          setStandardValue(String(nextVal));
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to load test detail:', err);
        }
      } finally {
        if (isMounted) {
          setLoadingTest(false);
        }
      }
    };

    loadTestInfo();
    return () => {
      isMounted = false;
    };
  }, [testId]);

  const handleCaptureCamera = () => {
    setShowCameraModal(true);
  };

  const handleCameraPhotoCaptured = (uri: string) => {
    setShowCameraModal(false);
    setSelectedImageUri(uri);
    setPreviewUri(uri);
    setImageBase64(null);
    setImageSourceType('camera');
    setAnalysisResult(null);
    setShowSolutionSelector(true);
  };

  const handlePickGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
        includeBase64: true,
        selectionLimit: 1,
        maxWidth: 1600,
        maxHeight: 1600,
      });

      if (result.errorCode) {
        Alert.alert('Gallery Notice', result.errorMessage || result.errorCode);
        return;
      }

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const rawUri = asset.uri || '';
      const formattedUri =
        rawUri.startsWith('file://') || rawUri.startsWith('content://') || rawUri.startsWith('data:')
          ? rawUri
          : `file://${rawUri}`;

      setSelectedImageUri(formattedUri);
      setImageSourceType('gallery');
      if (asset.base64) {
        setImageBase64(asset.base64);
        setPreviewUri(`data:image/jpeg;base64,${asset.base64}`);
      } else {
        setImageBase64(null);
        setPreviewUri(formattedUri);
      }
      setAnalysisResult(null);
      setShowSolutionSelector(true);
    } catch (err: any) {
      Alert.alert('Gallery Error', err?.message || 'Failed to pick image from photo library.');
    }
  };

  const handleLoadDemoBottle = () => {
    const dataUri = `data:image/jpeg;base64,${DEMO_REFERENCE_BOTTLE_BASE64}`;
    setSelectedImageUri(dataUri);
    setPreviewUri(dataUri);
    setImageBase64(DEMO_REFERENCE_BOTTLE_BASE64);
    setImageSourceType('demo');
    setAnalysisResult(null);
    setShowSolutionSelector(true);
  };

  const handleRunAnalysis = async (overrideUri?: string, overrideRoi?: NormalizedRoi) => {
    const targetUri = overrideUri || selectedImageUri || previewUri;
    if (!targetUri) {
      Alert.alert('Image Required', 'Please capture or upload a reference sample photograph first.');
      return;
    }

    const effRoi = overrideRoi !== undefined ? overrideRoi : customLiquidRoi;

    setAnalyzing(true);
    setAnalysisStep(0);
    const interval = setInterval(() => {
      setAnalysisStep((prev) => (prev < pipelineSteps.length - 1 ? prev + 1 : prev));
    }, 450);

    try {
      const res = await analyzeReferenceSample(
        testId,
        targetUri,
        imageBase64 || undefined,
        effRoi ? { liquidRoi: effRoi } : undefined
      );
      setAnalysisResult(res);

      if (res.preview_image) {
        setPreviewUri(res.preview_image);
      }

      if (res.is_valid && res.detected_color) {
        // Pre-fill a standard description placeholder if empty
        if (!description.trim()) {
          setDescription(
            `Calibrated reference reaction indicating approximately ${standardValue} ${unit} under defined standard conditions.`
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Analysis Failed', err.message || 'Computer vision pipeline failed to process image.');
    } finally {
      clearInterval(interval);
      setAnalyzing(false);
    }
  };

  const handleConfirmSolutionArea = (confirmedRoi: NormalizedRoi) => {
    setCustomLiquidRoi(confirmedRoi);
    setShowSolutionSelector(false);
    handleRunAnalysis(selectedImageUri || previewUri || undefined, confirmedRoi);
  };

  const handleSaveStandard = async () => {
    if (!analysisResult || !analysisResult.is_valid || !analysisResult.detected_color) {
      Alert.alert('Analysis Required', 'Run reference sample analysis and verify detected color before saving.');
      return;
    }

    const val = parseFloat(standardValue);
    if (isNaN(val)) {
      Alert.alert('Invalid Value', 'Please enter a valid numeric standard concentration value.');
      return;
    }

    const det = analysisResult.detected_color;
    const q = analysisResult.quality;

    setSaving(true);
    try {
      await createColorStandard(
        testId,
        {
          value: val,
          unit: unit.trim(),
          level: `${val} ${unit.trim()}`,
          color_name: `Standard (${val} ${unit.trim()})`,
          description: description.trim() || `Reference reaction indicating ${val} ${unit.trim()}`,
          reference_color: {
            hex: det.hex,
            rgb: {
              r: Math.round(Number(det.rgb.r)),
              g: Math.round(Number(det.rgb.g)),
              b: Math.round(Number(det.rgb.b)),
            },
            hsv: {
              h: Number(Number(det.hsv.h).toFixed(1)),
              s: Number(Number(det.hsv.s).toFixed(1)),
              v: Number(Number(det.hsv.v).toFixed(1)),
            },
            lab: {
              l: Number(Number(det.lab.l).toFixed(2)),
              a: Number(Number(det.lab.a).toFixed(2)),
              b: Number(Number(det.lab.b).toFixed(2)),
            },
          },
          quality: {
            overall: Number(Number(q.overall).toFixed(1)),
            valid_pixel_percentage: Number(Number(q.valid_pixel_percentage).toFixed(1)),
          },
          reference_image:
            (analysisResult.reference_image && analysisResult.reference_image.startsWith('data:')
              ? analysisResult.reference_image
              : '') ||
            (imageBase64
              ? imageBase64.startsWith('data:')
                ? imageBase64
                : `data:image/jpeg;base64,${imageBase64}`
              : '') ||
            (previewUri && previewUri.startsWith('data:') ? previewUri : '') ||
            analysisResult.reference_image ||
            '',
          tolerance_delta_e: 3.0,
        },
        session.role
      );

      Alert.alert(
        'Standard Saved',
        `Color standard ${val} ${unit} successfully added to test '${test?.name || testId}'.`,
        [
          {
            text: 'OK',
            onPress: () => onStandardSaved(testId),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to save color standard.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <HeaderBackButton onPress={onBack} label="Standards" />
        <View style={styles.titleCol}>
          <Text style={styles.navTitle} numberOfLines={1}>Add Standard</Text>
          <Text style={styles.navSubtitle} numberOfLines={1}>{test?.name || testId}</Text>
        </View>
        <View style={styles.topPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Step 1: Concentration & Unit Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Target Concentration</Text>
            <Text style={styles.cardHeaderSubtitle}>
              Specify the known chemical concentration value for this reference standard.
            </Text>

            <View style={styles.rowTwo}>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.fieldLabel}>Concentration value</Text>
                <TextInput
                  style={[styles.input, styles.inputValue]}
                  value={standardValue}
                  onChangeText={setStandardValue}
                  keyboardType="numeric"
                  placeholder="e.g. 1.0"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={[styles.fieldGroup, styles.unitCol]}>
                <Text style={styles.fieldLabel}>Unit</Text>
                <TextInput
                  style={[styles.input, styles.inputUnit]}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="mg/L"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </View>

          {/* Step 2: Reference Sample Capture / Upload */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Reference Photo</Text>
            <Text style={styles.cardHeaderSubtitle}>
              Capture or upload a clear photo of the reacted reference bottle under uniform light.
            </Text>

            {/* Image Preview Box */}
            {displayImageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: displayImageUri }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
                <View style={styles.imagePreviewOverlay}>
                  <Text style={styles.imageSelectedTag}>
                    {imageSourceType === 'camera'
                      ? 'Photo Captured'
                      : imageSourceType === 'gallery'
                      ? 'Image Uploaded'
                      : imageSourceType === 'demo'
                      ? 'Demo Bottle'
                      : 'Photo Selected'}
                  </Text>
                </View>
                <Pressable
                  style={styles.clearImageBtn}
                  onPress={() => {
                    setSelectedImageUri(null);
                    setPreviewUri(null);
                    setImageBase64(null);
                    setImageSourceType(null);
                    setAnalysisResult(null);
                  }}>
                  <Text style={styles.clearImageBtnText}>✕ Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.imagePlaceholderBox}>
                <Text style={styles.placeholderTitle}>No photo selected</Text>
                <Text style={styles.placeholderSubtitle}>
                  Take a photo with camera or choose an image from library
                </Text>
              </View>
            )}

            {/* Action Buttons: Retake / Upload / Capture */}
            <View style={styles.buttonRow}>
              <Pressable style={styles.captureBtn} onPress={handleCaptureCamera}>
                <Text style={styles.captureBtnText}>
                  {displayImageUri ? 'Retake Photo' : 'Take Photo'}
                </Text>
              </Pressable>

              <Pressable style={styles.uploadBtn} onPress={handlePickGallery}>
                <Text style={styles.uploadBtnText}>
                  {displayImageUri ? 'Change Photo' : 'Photo Library'}
                </Text>
              </Pressable>
            </View>

            {/* Interactive Solution Area Adjustment Trigger */}
            {displayImageUri ? (
              <Pressable
                style={styles.adjustRoiBtn}
                onPress={() => setShowSolutionSelector(true)}>
                <Text style={styles.adjustRoiBtnText}>
                  {customLiquidRoi ? 'Modify Liquid Area (Active)' : 'Adjust Liquid Area'}
                </Text>
              </Pressable>
            ) : null}

            {/* Quick Demo Sample Bottle Button */}
            <Pressable style={styles.demoSampleBtn} onPress={handleLoadDemoBottle}>
              <Text style={styles.demoSampleBtnText}>Use demo reference sample</Text>
            </Pressable>

            {/* Run Real Model Analysis Button */}
            <Pressable
              style={[
                styles.analyzeBtn,
                (!displayImageUri || analyzing) && styles.btnDisabled,
              ]}
              disabled={!displayImageUri || analyzing}
              onPress={() => handleRunAnalysis()}>
              {analyzing ? (
                <View style={styles.analyzingContentRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.analyzeBtnText}>Analyzing Photo...</Text>
                </View>
              ) : (
                <Text style={styles.analyzeBtnText}>Analyze Photo</Text>
              )}
            </Pressable>

            {/* Progress Pipeline Feedback */}
            {analyzing && (
              <View style={styles.progressBox}>
                <Text style={styles.progressStepText}>{pipelineSteps[analysisStep]}</Text>
              </View>
            )}
          </View>

          {/* Step 3: Analysis Results Review or Validation Rejection */}
          {analysisResult && (
            <>
              {analysisResult.is_valid && analysisResult.detected_color ? (
                <View style={styles.analysisSuccessCard}>
                  {/* Card Header */}
                  <View style={styles.successHeaderRow}>
                    <View style={styles.successTitleLeft}>
                      <View style={styles.activeCheckDot} />
                      <Text style={styles.successHeaderTitle}>Color Measured Successfully</Text>
                    </View>
                    <View style={styles.calibratedBadge}>
                      <Text style={styles.calibratedBadgeText}>✓ Calibrated</Text>
                    </View>
                  </View>

                  {/* Side-by-Side Dual Viewport Comparison */}
                  <View style={styles.visualVerificationCard}>
                    <View style={styles.comparisonRow}>
                      {/* Left: Original Photograph */}
                      <View style={styles.comparisonCol}>
                        <Text style={styles.comparisonColLabel}>Reference photo</Text>
                        <View style={styles.comparisonPhotoBox}>
                          {displayImageUri ? (
                            <Image
                              source={{ uri: displayImageUri }}
                              style={styles.comparisonPhoto}
                              resizeMode="contain"
                            />
                          ) : (
                            <Text style={styles.noPhotoText}>No Image</Text>
                          )}
                        </View>
                      </View>

                      {/* Middle Transition Divider */}
                      <View style={styles.comparisonDivider}>
                        <Text style={styles.comparisonArrow}>→</Text>
                      </View>

                      {/* Right: Extracted Color Swatch */}
                      <View style={styles.comparisonCol}>
                        <Text style={styles.comparisonColLabel}>Detected color</Text>
                        <View
                          style={[
                            styles.comparisonSwatchBox,
                            { backgroundColor: analysisResult.detected_color.hex },
                          ]}>
                          <View style={styles.hexPill}>
                            <Text style={styles.hexPillText}>
                              {analysisResult.detected_color.hex.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Quick Re-upload / Retake Bar */}
                    <View style={styles.reuploadBar}>
                      <Text style={styles.reuploadPrompt}>Need a different photo?</Text>
                      <View style={styles.reuploadBtnRow}>
                        <Pressable style={styles.reuploadBtn} onPress={handleCaptureCamera}>
                          <Text style={styles.reuploadBtnText}>Retake</Text>
                        </Pressable>
                        <Pressable style={styles.reuploadBtn} onPress={handlePickGallery}>
                          <Text style={styles.reuploadBtnText}>Upload New</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Measurements: 2x2 Metric Grid */}
                  <View style={styles.metricGridSection}>
                    <Text style={styles.sectionSublabel}>Color Coordinates</Text>
                    <View style={styles.metricsGrid2x2}>
                      <View style={styles.metricTile}>
                        <Text style={styles.metricTileLabel}>CIE L*a*b*</Text>
                        <Text style={styles.metricTileVal}>
                          L: {analysisResult.detected_color.lab.l.toFixed(1)}
                        </Text>
                        <Text style={styles.metricTileSub}>
                          a: {analysisResult.detected_color.lab.a.toFixed(1)}  b: {analysisResult.detected_color.lab.b.toFixed(1)}
                        </Text>
                      </View>

                      <View style={styles.metricTile}>
                        <Text style={styles.metricTileLabel}>sRGB</Text>
                        <Text style={styles.metricTileVal}>
                          {analysisResult.detected_color.rgb.r}, {analysisResult.detected_color.rgb.g}, {analysisResult.detected_color.rgb.b}
                        </Text>
                        <Text style={styles.metricTileSub}>Median</Text>
                      </View>

                      <View style={styles.metricTile}>
                        <Text style={styles.metricTileLabel}>Quality</Text>
                        <Text style={[styles.metricTileVal, { color: '#059669' }]}>
                          {analysisResult.quality.overall.toFixed(0)}%
                        </Text>
                        <Text style={styles.metricTileSub}>Valid sample</Text>
                      </View>

                      <View style={styles.metricTile}>
                        <Text style={styles.metricTileLabel}>Liquid Area</Text>
                        <Text style={styles.metricTileVal}>
                          {analysisResult.quality.valid_pixel_percentage.toFixed(0)}%
                        </Text>
                        <Text style={styles.metricTileSub}>Core area</Text>
                      </View>
                    </View>

                    {analysisResult.warnings && analysisResult.warnings.length > 0 && (
                      <View style={styles.warningNoteBox}>
                        <Text style={styles.warningNoteTitle}>Guidance:</Text>
                        {analysisResult.warnings.map((w: string, idx: number) => (
                          <Text key={idx} style={styles.warningNoteText}>• {w}</Text>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Step 4: Written Description */}
                  <View style={styles.descriptionSection}>
                    <Text style={styles.sectionSublabel}>
                      Description & notes (optional)
                    </Text>
                    <TextInput
                      style={[styles.input, styles.descInput]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="e.g. Reference reaction indicating standard concentration."
                      placeholderTextColor="#94A3B8"
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Save Standard CTA */}
                  <Pressable
                    style={[styles.saveStandardBtn, saving && styles.btnDisabled]}
                    disabled={saving}
                    onPress={handleSaveStandard}>
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveStandardBtnText}>
                        Save Standard ({standardValue} {unit})
                      </Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                /* Validation Failure Card */
                <View style={styles.rejectionCard}>
                  <Text style={styles.rejectionTitle}>Photo Cannot Be Used</Text>
                  <Text style={styles.rejectionMessage}>
                    The computer vision pipeline detected problems with this photograph. Standards
                    must meet strict optical criteria.
                  </Text>

                  <View style={styles.problemsList}>
                    {analysisResult.problems.map((prob, idx) => (
                      <Text key={idx} style={styles.problemItem}>
                        • {prob}
                      </Text>
                    ))}
                  </View>

                  <Text style={styles.rejectionFooterText}>
                    Please capture another reference sample image ensuring good lighting, neutral
                    background, and clear bottle framing.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Live In-App Camera Modal with Alignment Reticle */}
      <InAppCameraModal
        visible={showCameraModal}
        title="Reference Standard"
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCameraPhotoCaptured}
      />

      {/* Interactive Solution Area Selector Modal */}
      <SolutionAreaSelectorModal
        visible={showSolutionSelector}
        imageUri={displayImageUri}
        title="Select Solution Area"
        initialLiquidRoi={customLiquidRoi}
        onCancel={() => setShowSolutionSelector(false)}
        onConfirm={handleConfirmSolutionArea}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  adjustRoiBtn: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1.5,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  adjustRoiBtnText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  container: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgDark,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: JalqTheme.colors.borderSubtle,
    borderBottomWidth: 1,
    backgroundColor: JalqTheme.colors.bgCard,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: JalqTheme.colors.bgCardElevated,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
  },
  backText: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  titleCol: {
    flex: 1,
    marginHorizontal: 12,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
  },
  navSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: JalqTheme.colors.textMuted,
    marginTop: 1,
  },
  topPlaceholder: {
    width: 60,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldGroup: {
    marginBottom: 4,
  },
  unitCol: {
    width: 100,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 14,
  },
  inputValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0284C7',
  },
  inputUnit: {
    fontWeight: '600',
  },
  imagePreviewContainer: {
    height: 190,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  imagePreview: {
    width: '100%',
    height: 190,
  },
  imagePreviewOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  imageSelectedTag: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  clearImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  clearImageBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600',
  },
  imagePlaceholderBox: {
    height: 120,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
    padding: 12,
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  placeholderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  captureBtn: {
    flex: 1,
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  captureBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadBtnText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 13,
  },
  demoSampleBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  demoSampleBtnText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  analyzeBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  analyzeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  analyzingContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
  },
  progressStepText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  analysisSuccessCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  successHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  successTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  activeCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  successHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  calibratedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  calibratedBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  visualVerificationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  comparisonCol: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonColLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  comparisonPhotoBox: {
    width: '100%',
    height: 110,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  comparisonPhoto: {
    width: '100%',
    height: 110,
  },
  noPhotoText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  comparisonDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  comparisonArrow: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
  },
  comparisonSwatchBox: {
    width: '100%',
    height: 110,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 8,
  },
  hexPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  hexPillText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  reuploadBar: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reuploadPrompt: {
    color: '#64748B',
    fontSize: 11,
    flex: 1,
  },
  reuploadBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reuploadBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reuploadBtnText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '600',
  },
  metricGridSection: {
    gap: 8,
  },
  sectionSublabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  metricsGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricTile: {
    width: '48.5%',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  metricTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  metricTileVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricTileSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  warningNoteBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  warningNoteTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    marginBottom: 2,
  },
  warningNoteText: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
  },
  descriptionSection: {
    gap: 6,
  },
  descInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  saveStandardBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  saveStandardBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  rejectionCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  rejectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  rejectionMessage: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 17,
  },
  problemsList: {
    gap: 4,
    marginVertical: 4,
  },
  problemItem: {
    fontSize: 12,
    color: '#B91C1C',
  },
  rejectionFooterText: {
    fontSize: 11,
    color: '#991B1B',
    fontStyle: 'italic',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
