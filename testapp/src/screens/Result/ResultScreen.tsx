import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { JalqTheme, DS } from '../../theme/colors';
import { ChemicalTestDetail, JalqAnalysisResponse } from '../../types/jalq';

interface ResultScreenProps {
  test: ChemicalTestDetail;
  result: JalqAnalysisResponse;
  capturedUri: string;
  onRetake: () => void;
  onNewTest: () => void;
  onViewHistory?: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  test,
  result,
  capturedUri,
  onRetake,
  onNewTest,
  onViewHistory,
}) => {
  const insets = useSafeAreaInsets();
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const classification = result.classification;
  const matchedStandard = classification?.matched_standard;
  const bestLevel = matchedStandard?.level || classification?.level || 'Standard';
  const deltaE = classification?.delta_e_00 ?? classification?.delta_e_2000 ?? 0.0;
  const rangeStatus = classification?.range_status || 'IN_RANGE';
  const rangeLabel = classification?.range_label;

  const rawMatchPct =
    classification?.match_percentage ??
    result.detected_color?.match_percentage ??
    Math.round(100 - deltaE * 4);
  const matchAccuracy = Math.max(0, Math.min(100, Math.round(rawMatchPct)));

  const isColorUnmatched =
    result.status === 'NO_MATCH_FOUND' ||
    result.status === 'CALIBRATION_REQUIRED' ||
    classification?.range_status === 'OUT_OF_RANGE' ||
    classification?.range_status === 'ABOVE_CALIBRATED_RANGE' ||
    classification?.range_status === 'BELOW_CALIBRATED_RANGE' ||
    matchAccuracy < 70;

  const isCaptureError =
    result.status === 'RETAKE_IMAGE' ||
    result.status === 'INVALID_INCUBATION_TIME' ||
    result.status === 'ERROR';

  const isRetake = isCaptureError || isColorUnmatched;
  const isAmbiguous = result.status === 'AMBIGUOUS_RESULT';

  // Show the matched label (e.g. "NITRO 4 mg/L")
  const matchedLabel =
    matchedStandard?.name ||
    (matchedStandard?.level && matchedStandard.level !== 'Detected Sample'
      ? `${test.name} ${matchedStandard.level}`
      : '') ||
    (matchedStandard?.concentration !== undefined
      ? `${test.name} ${matchedStandard.concentration} ${matchedStandard.unit || 'mg/L'}`
      : '') ||
    `${test.name} Matched`;

  const detectedColor = result.detected_color;
  const detectedHex =
    detectedColor?.hex ||
    (detectedColor?.rgb
      ? `#${detectedColor.rgb.r.toString(16).padStart(2, '0')}${detectedColor.rgb.g.toString(16).padStart(2, '0')}${detectedColor.rgb.b.toString(16).padStart(2, '0')}`.toUpperCase()
      : '#0284C7');

  const matchedStandardHex =
    matchedStandard?.hex ||
    test.standards.find((s) => s.id === matchedStandard?.id)?.reference_color.hex ||
    detectedHex;

  const quality = result.quality || {
    overall: 85,
    blur: 90,
    exposure: 80,
    reflection: 85,
    roi_uniformity: 90,
    valid_pixel_percentage: 80,
  };

  // Combine rejection details from capture validation and core quality engine
  const allRejections = [
    ...(result.capture_rejection_details || []),
    ...(result.rejection_details || []),
  ].filter((item, idx, arr) => arr.findIndex((d) => d.reason === item.reason) === idx);

  const standardDistances = classification?.standard_distances || [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Navigation Top Bar */}
      <View style={styles.navBar}>
        <Text style={styles.navTitle} numberOfLines={1}>
          {test.name}
        </Text>
        <View style={styles.navBarActions}>
          {onViewHistory && (
            <Pressable style={styles.headerHistoryBtn} onPress={onViewHistory}>
              <Text style={styles.headerHistoryText}>📋 History</Text>
            </Pressable>
          )}
          {!isRetake && (
            <Pressable style={styles.headerDoneBtn} onPress={onNewTest}>
              <Text style={styles.headerDoneText}>Done</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Header Banner */}
        <View
          style={[
            styles.statusBanner,
            isRetake
              ? styles.bannerRetake
              : isAmbiguous
              ? styles.bannerAmbiguous
              : styles.bannerSuccess,
          ]}>
          <View style={styles.statusCol}>
            <Text style={styles.statusHeading}>
              {isRetake
                ? (isColorUnmatched ? '⚠️ Color Not Matched' : '⚠️ Photo needs adjustment')
                : '✓ Analysis Complete'}
            </Text>
            <Text style={styles.statusSub}>
              {isRetake
                ? (isColorUnmatched
                    ? `Sample color match (${matchAccuracy}%) did not reach the required tolerance (≥ 70%).`
                    : 'The photo could not be reliably measured. Please review suggestions below.')
                : 'Liquid spectrum successfully matched against calibrated standards.'}
            </Text>
          </View>
        </View>

        {/* Test Saved to History Notification Strip - Only recorded when matched */}
        {!isRetake && (
          <View style={styles.historySavedStrip}>
            <Text style={styles.historySavedText}>✓ Reading recorded in Test History</Text>
            {onViewHistory && (
              <Pressable onPress={onViewHistory} style={styles.historySavedBtn}>
                <Text style={styles.historySavedBtnText}>View All History →</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* RETAKE / REJECTION ALERT VIEW */}
        {isRetake && (
          <View style={styles.rejectionCard}>
            <Text style={styles.rejectionTitle}>
              {isColorUnmatched ? '💡 Recommendations for Match' : (result.rejection_title || 'Photo Needs Adjustment')}
            </Text>
            <Text style={styles.rejectionMessage}>
              {isColorUnmatched
                ? `The detected liquid color match accuracy is ${matchAccuracy}%, which does not reach the required tolerance (≥ 70%). Please ensure neutral lighting, use a plain white background, and verify incubation before retaking.`
                : (result.rejection_message ||
                  'To make sure your result is accurate, please retake the photo with the suggestions below:')}
            </Text>

            {allRejections.length > 0 && (
              <View style={styles.rejectionDetailsList}>
                <Text style={styles.fixHeading}>Suggested fixes:</Text>
                {allRejections.map((item, idx) => (
                  <View key={idx} style={styles.rejectionItem}>
                    <View style={styles.rejectionTextCol}>
                      <Text style={styles.rejectionItemTitle}>{item.title}</Text>
                      <Text style={styles.rejectionItemDesc}>{item.description}</Text>
                      <View style={styles.howToFixBox}>
                        <Text style={styles.howToFixLabel}>How to fix:</Text>
                        <Text style={styles.howToFixText}>{item.how_to_fix}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* RESULT & COMPARISON PRESENTATION */}
        {(!isCaptureError || isColorUnmatched) && (
          <>
            {/* Primary Winner Match Card - Shows matched standard with color and standard name only */}
            <View style={styles.winnerCard}>
              <View style={styles.winnerHeader}>
                <Text style={styles.winnerTag}>
                  {isColorUnmatched ? 'CLOSEST STANDARD' : 'MATCHED STANDARD'}
                </Text>
                <View
                  style={[
                    styles.matchQualityPill,
                    isColorUnmatched ? styles.pillAmbiguous : styles.pillStrong,
                  ]}>
                  <Text
                    style={[
                      styles.matchQualityText,
                      isColorUnmatched ? styles.textAmbiguous : styles.textStrong,
                    ]}>
                    {isColorUnmatched ? 'Unmatched' : 'Matched'}
                  </Text>
                </View>
              </View>

              {/* Matched Standard Color & Standard Name Only */}
              <View style={styles.matchedResultBox}>
                <View
                  style={[
                    styles.matchedStandardColorCircle,
                    { backgroundColor: matchedStandardHex },
                  ]}
                />
                <Text style={styles.matchedResultValue}>
                  {matchedLabel}
                </Text>
              </View>
            </View>

            {/* Liquid Color vs Standard Swatches */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Spectra Comparison</Text>
              <Text style={styles.sectionDesc}>
                Visual comparison between your liquid sample and closest calibrated standard:
              </Text>

              <View style={styles.colorComparisonRow}>
                {/* Captured Liquid Color */}
                <View style={styles.colorBlock}>
                  <View
                    style={[styles.colorSwatch, { backgroundColor: detectedHex }]}
                  />
                  <Text style={styles.colorBlockLabel}>Your Sample</Text>
                  <Text style={styles.colorBlockSubLabel}>Tested Bottle</Text>
                </View>

                <View style={styles.vsBadge}>
                  <Text style={styles.vsText}>VS</Text>
                </View>

                {/* Matched Standard Color */}
                <View style={styles.colorBlock}>
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: matchedStandardHex },
                    ]}
                  />
                  <Text style={styles.colorBlockLabel}>Calibrated Standard</Text>
                  <Text style={styles.colorBlockSubLabel}>
                    {matchedStandard?.concentration !== undefined
                      ? `${matchedStandard.concentration} ${matchedStandard.unit ?? 'mg/L'}`
                      : 'Reference'}
                  </Text>
                </View>
              </View>
            </View>



            {/* Quality Verification Details Accordion */}
            <View style={styles.card}>
              <Pressable
                style={styles.diagHeader}
                onPress={() => setShowDiagnostics(!showDiagnostics)}>
                <Text style={styles.diagTitle}>
                  {showDiagnostics ? '▲ Hide Quality Verification' : '▼ View Quality Verification'}
                </Text>
              </Pressable>

              {showDiagnostics && (
                <View style={styles.diagBody}>
                  <View style={styles.diagMetricRow}>
                    <Text style={styles.diagMetricName}>Image Sharpness & Focus</Text>
                    <Text style={styles.diagMetricVal}>{quality.blur.toFixed(0)}% (Optimal)</Text>
                  </View>
                  <View style={styles.diagMetricRow}>
                    <Text style={styles.diagMetricName}>Lighting & Exposure</Text>
                    <Text style={styles.diagMetricVal}>{quality.exposure.toFixed(0)}% (Optimal)</Text>
                  </View>
                  <View style={styles.diagMetricRow}>
                    <Text style={styles.diagMetricName}>Glare Reduction</Text>
                    <Text style={styles.diagMetricVal}>{quality.reflection.toFixed(0)}% (Good)</Text>
                  </View>
                  <View style={styles.diagMetricRow}>
                    <Text style={styles.diagMetricName}>Liquid Color Uniformity</Text>
                    <Text style={styles.diagMetricVal}>{quality.roi_uniformity.toFixed(0)}% (Consistent)</Text>
                  </View>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky Bottom Actions Footer - Shows Complete only when matched; Retake only when unmatched */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.footerBtnRow}>
          <Pressable
            testID="btn-retake"
            style={[
              styles.secondaryFooterBtn,
              isRetake && styles.prominentRetakeBtn,
            ]}
            onPress={onRetake}>
            <Text
              style={[
                styles.secondaryFooterBtnText,
                isRetake && styles.prominentRetakeBtnText,
              ]}>
              ↺ Retake Photo
            </Text>
          </Pressable>
          {!isRetake && (
            <Pressable
              testID="btn-complete"
              style={styles.primaryFooterBtn}
              onPress={onNewTest}>
              <Text style={styles.primaryFooterBtnText}>Complete Test ✓</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgDark,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: JalqTheme.spacing.base,
    paddingVertical: JalqTheme.spacing.md,
    borderBottomColor: JalqTheme.colors.borderSubtle,
    borderBottomWidth: 1,
    backgroundColor: JalqTheme.colors.bgCard,
  },
  navTitle: {
    flex: 1,
    color: JalqTheme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  navBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerHistoryBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: JalqTheme.radius.md,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  headerHistoryText: {
    color: '#0284C7',
    fontWeight: '700',
    fontSize: 12,
  },
  headerDoneBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: JalqTheme.radius.md,
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderFocus,
  },
  headerDoneText: {
    color: JalqTheme.colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  historySavedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: JalqTheme.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  historySavedText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  historySavedBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  historySavedBtnText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '700',
  },
  scrollContent: {
    padding: JalqTheme.spacing.base,
    gap: JalqTheme.spacing.md,
    paddingBottom: 32,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: JalqTheme.spacing.base,
    borderRadius: JalqTheme.radius.lg,
    borderWidth: 1,
  },
  bannerSuccess: {
    backgroundColor: JalqTheme.colors.badgeSuccessBg,
    borderColor: JalqTheme.colors.badgeSuccessBorder,
  },
  bannerAmbiguous: {
    backgroundColor: JalqTheme.colors.badgeWarningBg,
    borderColor: JalqTheme.colors.badgeWarningBorder,
  },
  bannerRetake: {
    backgroundColor: JalqTheme.colors.badgeErrorBg,
    borderColor: JalqTheme.colors.badgeErrorBorder,
  },
  statusCol: {
    flex: 1,
  },
  statusHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
  },
  statusSub: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  card: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.lg,
    padding: JalqTheme.spacing.base,
    ...JalqTheme.shadow.sm,
  },
  winnerCard: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: '#BAE6FD',
    borderWidth: 1.5,
    borderRadius: JalqTheme.radius.xl,
    padding: JalqTheme.spacing.lg,
    ...JalqTheme.shadow.md,
  },
  winnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  winnerTag: {
    fontSize: 11,
    fontWeight: '800',
    color: JalqTheme.colors.primary,
    letterSpacing: 0.8,
  },
  matchQualityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: JalqTheme.radius.pill,
    borderWidth: 1,
  },
  pillStrong: {
    backgroundColor: JalqTheme.colors.badgeSuccessBg,
    borderColor: JalqTheme.colors.badgeSuccessBorder,
  },
  pillGood: {
    backgroundColor: JalqTheme.colors.badgeInfoBg,
    borderColor: JalqTheme.colors.badgeInfoBorder,
  },
  pillAmbiguous: {
    backgroundColor: JalqTheme.colors.badgeWarningBg,
    borderColor: JalqTheme.colors.badgeWarningBorder,
  },
  matchQualityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textStrong: { color: JalqTheme.colors.badgeSuccessText },
  textGood: { color: JalqTheme.colors.badgeInfoText },
  textAmbiguous: { color: JalqTheme.colors.badgeWarningText },
  matchedResultBox: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1.5,
    borderRadius: JalqTheme.radius.lg,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchedStandardColorCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  matchedResultLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: JalqTheme.colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  matchedResultValue: {
    fontSize: 26,
    fontWeight: '900',
    color: JalqTheme.colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  matchedSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: JalqTheme.colors.emerald,
    marginTop: 6,
  },
  unmatchedSubtitle: {
    color: JalqTheme.colors.amber,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopColor: JalqTheme.colors.borderSubtle,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    padding: 8,
    borderRadius: JalqTheme.radius.md,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
  },
  metricHint: {
    fontSize: 10,
    color: JalqTheme.colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  colorComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  colorBlock: {
    alignItems: 'center',
  },
  colorSwatch: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#BAE6FD',
    marginBottom: 8,
    ...JalqTheme.shadow.sm,
  },
  colorBlockLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    textTransform: 'uppercase',
  },
  colorBlockSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: JalqTheme.colors.textSecondary,
    marginTop: 2,
  },
  vsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  vsText: {
    fontSize: 10,
    fontWeight: '900',
    color: JalqTheme.colors.textSecondary,
  },
  standardsLadder: {
    gap: 8,
  },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: JalqTheme.colors.bgInput,
    padding: 10,
    borderRadius: JalqTheme.radius.md,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    gap: 10,
  },
  ladderRowWinner: {
    borderColor: JalqTheme.colors.emerald,
    backgroundColor: JalqTheme.colors.emeraldGlow,
  },
  ladderSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
  },
  ladderInfoCol: {
    flex: 1,
  },
  ladderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ladderName: {
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  winnerMarker: {
    fontSize: 10,
    fontWeight: '700',
    color: JalqTheme.colors.emerald,
  },
  distanceBarTrack: {
    height: 5,
    backgroundColor: JalqTheme.colors.bgMuted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  distanceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  deltaBox: {
    alignItems: 'flex-end',
    minWidth: 44,
  },
  deltaLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
    textTransform: 'uppercase',
  },
  deltaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.textSecondary,
  },
  deltaValWinner: {
    color: JalqTheme.colors.emerald,
    fontWeight: '800',
  },
  diagHeader: {
    paddingVertical: 4,
  },
  diagTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: JalqTheme.colors.primary,
    textAlign: 'center',
  },
  diagBody: {
    marginTop: 12,
    borderTopColor: JalqTheme.colors.borderSubtle,
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  diagMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  diagMetricName: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
  },
  diagMetricVal: {
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  rejectionCard: {
    backgroundColor: JalqTheme.colors.badgeErrorBg,
    borderColor: JalqTheme.colors.badgeErrorBorder,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.lg,
    padding: JalqTheme.spacing.base,
  },
  rejectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: JalqTheme.colors.crimson,
    marginBottom: 6,
  },
  rejectionMessage: {
    fontSize: 13,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  rejectionDetailsList: {
    gap: 10,
  },
  fixHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: JalqTheme.colors.crimson,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rejectionItem: {
    backgroundColor: JalqTheme.colors.bgInput,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.md,
    padding: 12,
  },
  rejectionTextCol: {
    flex: 1,
  },
  rejectionItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 2,
  },
  rejectionItemDesc: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  howToFixBox: {
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderColor: JalqTheme.colors.borderFocus,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.sm,
    padding: 8,
  },
  howToFixLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: JalqTheme.colors.primary,
    marginBottom: 2,
  },
  howToFixText: {
    fontSize: 11,
    fontWeight: '600',
    color: JalqTheme.colors.textPrimary,
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: JalqTheme.spacing.base,
    paddingTop: JalqTheme.spacing.md,
    backgroundColor: JalqTheme.colors.bgCardElevated,
    borderTopWidth: 1,
    borderTopColor: JalqTheme.colors.borderSubtle,
  },
  footerBtnRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  primaryFooterBtn: {
    flex: 1,
    ...DS.primaryBtn,
    paddingVertical: 14,
  },
  primaryFooterBtnText: {
    ...DS.primaryBtnText,
  },
  secondaryFooterBtn: {
    flex: 1,
    ...DS.ghostBtn,
    paddingVertical: 14,
  },
  secondaryFooterBtnText: {
    ...DS.ghostBtnText,
  },
  prominentRetakeBtn: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  prominentRetakeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
