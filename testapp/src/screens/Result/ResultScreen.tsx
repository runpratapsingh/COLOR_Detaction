import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme, DS } from '../../theme/colors';
import { ChemicalTestDetail, JalqAnalysisResponse } from '../../types/jalq';

interface ResultScreenProps {
  test: ChemicalTestDetail;
  result: JalqAnalysisResponse;
  capturedUri: string;
  onRetake: () => void;
  onNewTest: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  test,
  result,
  capturedUri,
  onRetake,
  onNewTest,
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const isRetake =
    result.status === 'RETAKE_IMAGE' ||
    result.status === 'INVALID_INCUBATION_TIME' ||
    result.status === 'ERROR';
  const isAmbiguous = result.status === 'AMBIGUOUS_RESULT';

  const classification = result.classification;
  const matchedStandard = classification?.matched_standard;
  const bestLevel = matchedStandard?.level || classification?.level || 'Detected Sample';
  const deltaE = classification?.delta_e_00 ?? classification?.delta_e_2000 ?? 0.0;
  const matchQuality = classification?.match_quality || (isAmbiguous ? 'AMBIGUOUS' : 'GOOD');
  const estimatedConcentration =
    classification?.estimated_concentration ??
    classification?.interpolated_concentration ??
    matchedStandard?.concentration;
  const rangeStatus = classification?.range_status || 'IN_RANGE';
  const rangeLabel = classification?.range_label;

  const detectedColor = result.detected_color;
  const detectedHex =
    detectedColor?.hex ||
    (detectedColor?.rgb
      ? `#${detectedColor.rgb.r.toString(16).padStart(2, '0')}${detectedColor.rgb.g.toString(16).padStart(2, '0')}${detectedColor.rgb.b.toString(16).padStart(2, '0')}`.toUpperCase()
      : '#888888');

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={JalqTheme.colors.bgDeep} />

      {/* Navigation Top Bar */}
      <View style={styles.navBar}>
        <Text style={styles.navTitle} numberOfLines={1}>
          {test.name}
        </Text>
        <Pressable style={styles.headerDoneBtn} onPress={onNewTest}>
          <Text style={styles.headerDoneText}>Done</Text>
        </Pressable>
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
                ? '⚠️ Photo needs adjustment'
                : isAmbiguous
                ? '⚡ Borderline concentration'
                : '✓ Analysis Complete'}
            </Text>
            <Text style={styles.statusSub}>
              {isRetake
                ? 'The photo could not be reliably measured. Please review suggestions below.'
                : isAmbiguous
                ? 'The color falls between two calibrated standard levels.'
                : 'Liquid spectrum matched against calibrated curve.'}
            </Text>
          </View>
        </View>

        {/* RETAKE / REJECTION ALERT VIEW */}
        {isRetake && (
          <View style={styles.rejectionCard}>
            <Text style={styles.rejectionTitle}>
              {result.rejection_title || 'Photo Needs Adjustment'}
            </Text>
            <Text style={styles.rejectionMessage}>
              {result.rejection_message ||
                'To make sure your result is accurate, please retake the photo with the suggestions below:'}
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

        {/* SUCCESS RESULT PRESENTATION */}
        {!isRetake && (
          <>
            {/* Primary Winner Match Card */}
            <View style={styles.winnerCard}>
              <View style={styles.winnerHeader}>
                <Text style={styles.winnerTag}>MEASURED ASSAY RESULT</Text>
                <View
                  style={[
                    styles.matchQualityPill,
                    matchQuality === 'STRONG'
                      ? styles.pillStrong
                      : matchQuality === 'AMBIGUOUS'
                      ? styles.pillAmbiguous
                      : styles.pillGood,
                  ]}>
                  <Text
                    style={[
                      styles.matchQualityText,
                      matchQuality === 'STRONG'
                        ? styles.textStrong
                        : matchQuality === 'AMBIGUOUS'
                        ? styles.textAmbiguous
                        : styles.textGood,
                    ]}>
                    {matchQuality === 'STRONG'
                      ? 'High Confidence'
                      : matchQuality === 'AMBIGUOUS'
                      ? 'Borderline'
                      : 'Good Match'}
                  </Text>
                </View>
              </View>

              {/* Main Reading */}
              <View style={styles.estimatedConcBox}>
                <Text style={styles.estimatedConcLabel}>Estimated Concentration</Text>
                <Text style={styles.estimatedConcValue}>
                  {rangeStatus === 'ABOVE_CALIBRATED_RANGE'
                    ? rangeLabel || `> ${matchedStandard?.concentration ?? '4'} ${matchedStandard?.unit ?? 'mg/L'}`
                    : rangeStatus === 'BELOW_CALIBRATED_RANGE'
                    ? rangeLabel || `< ${matchedStandard?.concentration ?? '0'} ${matchedStandard?.unit ?? 'mg/L'}`
                    : `${estimatedConcentration !== undefined ? Number(estimatedConcentration).toFixed(2) : '—'} ${matchedStandard?.unit ?? 'mg/L'}`}
                </Text>
                <Text style={styles.winnerLevel}>Standard: {bestLevel}</Text>
              </View>

              {/* Key Metrics Row */}
              <View style={styles.metricRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Match Accuracy</Text>
                  <Text style={styles.metricVal}>
                    {Math.max(70, Math.min(99, Math.round(100 - deltaE * 4)))}%
                  </Text>
                  <Text style={styles.metricHint}>Color match</Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Image Clarity</Text>
                  <Text style={styles.metricVal}>{Math.round(quality.overall)}%</Text>
                  <Text style={styles.metricHint}>Sharpness</Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Calibrated</Text>
                  <Text style={styles.metricVal}>
                    {matchedStandard?.concentration ?? '—'} {matchedStandard?.unit ?? 'mg/L'}
                  </Text>
                  <Text style={styles.metricHint}>Reference</Text>
                </View>
              </View>
            </View>

            {/* Detected Liquid Color vs Standard Swatches */}
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
                  <Text style={styles.colorBlockHex}>{detectedHex}</Text>
                </View>

                <View style={styles.vsBadge}>
                  <Text style={styles.vsText}>VS</Text>
                </View>

                {/* Matched Standard Color */}
                <View style={styles.colorBlock}>
                  <View
                    style={[
                      styles.colorSwatch,
                      {
                        backgroundColor:
                          matchedStandard?.hex ||
                          test.standards.find((s) => s.id === matchedStandard?.id)
                            ?.reference_color.hex ||
                          detectedHex,
                      },
                    ]}
                  />
                  <Text style={styles.colorBlockLabel}>Calibrated Standard</Text>
                  <Text style={styles.colorBlockHex}>
                    {matchedStandard?.hex || detectedHex}
                  </Text>
                </View>
              </View>
            </View>

            {/* Compare Standards Ladder */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Calibrated Curve Standards</Text>
              <Text style={styles.sectionDesc}>
                Concentration steps for {test.name}:
              </Text>

              <View style={styles.standardsLadder}>
                {standardDistances.length > 0
                  ? standardDistances.map((std) => {
                      const isWinner = std.id === matchedStandard?.id;
                      const matchPct = Math.max(10, Math.min(99, Math.round(100 - std.delta_e_00 * 4)));
                      return (
                        <View
                          key={std.id}
                          style={[
                            styles.ladderRow,
                            isWinner && styles.ladderRowWinner,
                          ]}>
                          <View
                            style={[
                              styles.ladderSwatch,
                              { backgroundColor: std.hex || '#888888' },
                            ]}
                          />
                          <View style={styles.ladderInfoCol}>
                            <View style={styles.ladderTitleRow}>
                              <Text style={styles.ladderName}>{std.name}</Text>
                              {isWinner && (
                                <Text style={styles.winnerMarker}>✓ Best Match</Text>
                              )}
                            </View>

                            {/* Relative distance bar */}
                            <View style={styles.distanceBarTrack}>
                              <View
                                style={[
                                  styles.distanceBarFill,
                                  {
                                    width: `${matchPct}%`,
                                    backgroundColor: isWinner ? JalqTheme.colors.emerald : JalqTheme.colors.primary,
                                  },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={styles.deltaBox}>
                            <Text style={styles.deltaLabel}>Fit</Text>
                            <Text
                              style={[
                                styles.deltaVal,
                                isWinner && styles.deltaValWinner,
                              ]}>
                              {matchPct}%
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  : test.standards.map((std) => (
                      <View key={std.id} style={styles.ladderRow}>
                        <View
                          style={[
                            styles.ladderSwatch,
                            { backgroundColor: std.reference_color.hex },
                          ]}
                        />
                        <Text style={styles.ladderName}>{std.name}</Text>
                      </View>
                    ))}
              </View>
            </View>

            {/* Diagnostic Metrics Accordion */}
            <View style={styles.card}>
              <Pressable
                style={styles.diagHeader}
                onPress={() => setShowDiagnostics(!showDiagnostics)}>
                <Text style={styles.diagTitle}>
                  {showDiagnostics ? '▲ Hide Advanced Optical Diagnostics' : '▼ View Advanced Optical Diagnostics'}
                </Text>
              </Pressable>

              {showDiagnostics && (
                <View style={styles.diagBody}>
                  <View style={styles.diagMetricRow}>
                    <Text style={styles.diagMetricName}>Sharpness & Focus</Text>
                    <Text style={styles.diagMetricVal}>{quality.blur.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.diagMetricRow}>
                    <Text style={styles.diagMetricName}>Lighting & Exposure</Text>
                    <Text style={styles.diagMetricVal}>{quality.exposure.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.diagMetricRow}>
                    <Text style={styles.diagMetricName}>Glare Reduction</Text>
                    <Text style={styles.diagMetricVal}>{quality.reflection.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.diagMetricRow}>
                    <Text style={styles.diagMetricName}>Liquid Color Uniformity</Text>
                    <Text style={styles.diagMetricVal}>{quality.roi_uniformity.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.diagMetricRow}>
                    <Text style={styles.diagMetricName}>Delta-E Distance (ΔE00)</Text>
                    <Text style={styles.diagMetricVal}>{deltaE.toFixed(2)}</Text>
                  </View>
                  {detectedColor?.lab && (
                    <View style={styles.diagMetricRow}>
                      <Text style={styles.diagMetricName}>CIE L*a*b* (D65)</Text>
                      <Text style={styles.diagMetricVal}>
                        L*:{detectedColor.lab.l.toFixed(1)} a*:{detectedColor.lab.a.toFixed(1)} b*:{detectedColor.lab.b.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky Bottom Actions Footer */}
      <View style={styles.footer}>
        {isRetake ? (
          <Pressable style={styles.primaryFooterBtn} onPress={onRetake}>
            <Text style={styles.primaryFooterBtnText}>Retake Photo</Text>
          </Pressable>
        ) : (
          <View style={styles.footerBtnRow}>
            <Pressable style={styles.secondaryFooterBtn} onPress={onRetake}>
              <Text style={styles.secondaryFooterBtnText}>Retake</Text>
            </Pressable>
            <Pressable style={styles.primaryFooterBtn} onPress={onNewTest}>
              <Text style={styles.primaryFooterBtnText}>Complete Test ✓</Text>
            </Pressable>
          </View>
        )}
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
    borderColor: JalqTheme.colors.primaryDark,
    borderWidth: 1.5,
    borderRadius: JalqTheme.radius.xl,
    padding: JalqTheme.spacing.lg,
    ...JalqTheme.shadow.cyan,
  },
  winnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  winnerTag: {
    fontSize: 11,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
    letterSpacing: 0.6,
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
  winnerLevel: {
    fontSize: 13,
    fontWeight: '600',
    color: JalqTheme.colors.textSecondary,
    marginTop: 4,
  },
  estimatedConcBox: {
    backgroundColor: JalqTheme.colors.bgInput,
    borderColor: JalqTheme.colors.borderFocus,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.lg,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  estimatedConcLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: JalqTheme.colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  estimatedConcValue: {
    fontSize: 32,
    fontWeight: '900',
    color: JalqTheme.colors.textPrimary,
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
    backgroundColor: JalqTheme.colors.bgInput,
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
    borderColor: JalqTheme.colors.borderDefault,
    marginBottom: 8,
    ...JalqTheme.shadow.sm,
  },
  colorBlockLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
    textTransform: 'uppercase',
  },
  colorBlockHex: {
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    marginTop: 2,
  },
  vsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: JalqTheme.colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
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
    paddingVertical: JalqTheme.spacing.md,
    backgroundColor: JalqTheme.colors.bgCardElevated,
    borderTopWidth: 1,
    borderTopColor: JalqTheme.colors.borderSubtle,
  },
  footerBtnRow: {
    flexDirection: 'row',
    gap: 12,
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
    width: 100,
    ...DS.ghostBtn,
    paddingVertical: 14,
  },
  secondaryFooterBtnText: {
    ...DS.ghostBtnText,
  },
});
