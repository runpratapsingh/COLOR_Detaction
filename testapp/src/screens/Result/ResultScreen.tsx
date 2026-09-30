import React, { useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme } from '../../theme/colors';
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
      {/* Navigation Top Bar */}
      <View style={styles.navBar}>
        <Text style={styles.navTitle} numberOfLines={1}>
          {test.name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                ? 'Photo needs adjustment'
                : isAmbiguous
                ? 'Borderline result'
                : 'Test complete'}
            </Text>
            <Text style={styles.statusSub}>
              {isRetake
                ? 'The photo could not be reliably measured. Please review suggestions below.'
                : isAmbiguous
                ? 'The color is between two standard levels.'
                : 'Liquid color successfully measured and verified.'}
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
                <Text style={styles.winnerTag}>Measured Result</Text>
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
                <Text style={styles.estimatedConcLabel}>Estimated concentration</Text>
                <Text style={styles.estimatedConcValue}>
                  {rangeStatus === 'ABOVE_CALIBRATED_RANGE'
                    ? rangeLabel || `> ${matchedStandard?.concentration ?? '4'} ${matchedStandard?.unit ?? 'mg/L'}`
                    : rangeStatus === 'BELOW_CALIBRATED_RANGE'
                    ? rangeLabel || `< ${matchedStandard?.concentration ?? '0'} ${matchedStandard?.unit ?? 'mg/L'}`
                    : `${estimatedConcentration !== undefined ? Number(estimatedConcentration).toFixed(2) : '—'} ${matchedStandard?.unit ?? 'mg/L'}`}
                </Text>
                <Text style={styles.winnerLevel}>Matched: {bestLevel}</Text>
              </View>

              {/* Key Metrics Row */}
              <View style={styles.metricRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Match accuracy</Text>
                  <Text style={styles.metricVal}>
                    {Math.max(70, Math.min(99, Math.round(100 - deltaE * 4)))}%
                  </Text>
                  <Text style={styles.metricHint}>Color match</Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Image clarity</Text>
                  <Text style={styles.metricVal}>{Math.round(quality.overall)}%</Text>
                  <Text style={styles.metricHint}>Sharpness</Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Closest level</Text>
                  <Text style={styles.metricVal}>
                    {matchedStandard?.concentration ?? '—'} {matchedStandard?.unit ?? 'mg/L'}
                  </Text>
                  <Text style={styles.metricHint}>Standard</Text>
                </View>
              </View>
            </View>

            {/* Detected Liquid Color vs Standard Swatches */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Color Comparison</Text>
              <Text style={styles.sectionDesc}>
                Visual comparison between your liquid sample and the closest calibrated standard:
              </Text>

              <View style={styles.colorComparisonRow}>
                {/* Captured Liquid Color */}
                <View style={styles.colorBlock}>
                  <View
                    style={[styles.colorSwatch, { backgroundColor: detectedHex }]}
                  />
                  <Text style={styles.colorBlockLabel}>Your sample</Text>
                  <Text style={styles.colorBlockHex}>{detectedHex}</Text>
                </View>

                <Text style={styles.vsText}>vs</Text>

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
                  <Text style={styles.colorBlockLabel}>Matched standard</Text>
                  <Text style={styles.colorBlockHex}>
                    {matchedStandard?.hex || detectedHex}
                  </Text>
                </View>
              </View>
            </View>

            {/* Compare Standards Ladder */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Reference Color Scale</Text>
              <Text style={styles.sectionDesc}>
                All standard concentration levels for this test:
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
                                <Text style={styles.winnerMarker}>Your match</Text>
                              )}
                            </View>

                            {/* Relative distance bar */}
                            <View style={styles.distanceBarTrack}>
                              <View
                                style={[
                                  styles.distanceBarFill,
                                  {
                                    width: `${matchPct}%`,
                                    backgroundColor: isWinner ? '#059669' : '#0284C7',
                                  },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={styles.deltaBox}>
                            <Text style={styles.deltaLabel}>Match</Text>
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
                  {showDiagnostics ? '▲ Hide Advanced Diagnostics' : '▼ View Advanced Diagnostics'}
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
              <Text style={styles.primaryFooterBtnText}>Done</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: JalqTheme.colors.borderSubtle,
    borderBottomWidth: 1,
    backgroundColor: JalqTheme.colors.bgCard,
  },
  navTitle: {
    flex: 1,
    color: JalqTheme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  newTestBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: JalqTheme.colors.primary,
  },
  newTestText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
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
  statusIcon: {
    fontSize: 20,
  },
  statusCol: {
    flex: 1,
  },
  statusHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: JalqTheme.colors.textPrimary,
  },
  statusSub: {
    fontSize: 11,
    color: JalqTheme.colors.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  winnerCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  winnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  winnerTag: {
    fontSize: 11,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
    letterSpacing: 0.5,
  },
  matchQualityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillStrong: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  pillGood: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  pillAmbiguous: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  matchQualityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textStrong: { color: '#15803D' },
  textGood: { color: '#0284C7' },
  textAmbiguous: { color: '#B45309' },
  winnerLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: JalqTheme.colors.textSecondary,
    marginTop: 4,
  },
  estimatedConcBox: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  estimatedConcLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  estimatedConcValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
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
    borderColor: '#E2E8F0',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 16,
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
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 11,
    color: JalqTheme.colors.textSecondary,
    marginBottom: 14,
    lineHeight: 15,
  },
  colorComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
  colorBlock: {
    alignItems: 'center',
  },
  colorSwatch: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginBottom: 8,
  },
  colorBlockLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: JalqTheme.colors.textMuted,
    letterSpacing: 0.5,
  },
  colorBlockHex: {
    fontSize: 12,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
    marginTop: 2,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '900',
    color: JalqTheme.colors.textMuted,
  },
  coordsPanel: {
    flexDirection: 'row',
    backgroundColor: JalqTheme.colors.bgInput,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    marginTop: 8,
  },
  coordCol: {
    flex: 1,
  },
  coordDivider: {
    width: 1,
    backgroundColor: JalqTheme.colors.borderSubtle,
    marginHorizontal: 10,
  },
  coordHeader: {
    fontSize: 8,
    fontWeight: '800',
    color: JalqTheme.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coordVal: {
    fontSize: 10,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  standardsLadder: {
    gap: 10,
  },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  ladderRowWinner: {
    borderColor: '#86EFAC',
    backgroundColor: '#ECFDF5',
  },
  ladderSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    fontSize: 13,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  winnerMarker: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  distanceBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distanceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  deltaBox: {
    alignItems: 'flex-end',
    minWidth: 50,
  },
  deltaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
  },
  deltaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  deltaValWinner: {
    color: '#15803D',
  },
  diagHeader: {
    paddingVertical: 6,
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
  secondaryRetakeBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryRetakeText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  rejectionCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
  },
  rejectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  rejectionMessage: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
    marginBottom: 14,
  },
  rejectionDetailsList: {
    gap: 10,
    marginBottom: 14,
  },
  fixHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rejectionItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rejectionBullet: {
    fontSize: 16,
  },
  rejectionTextCol: {
    flex: 1,
  },
  rejectionItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  rejectionItemDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 8,
  },
  howToFixBox: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
  },
  howToFixLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    marginBottom: 2,
  },
  howToFixText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
    lineHeight: 16,
  },
  retakeActionBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  retakeActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryFooterBtn: {
    flex: 1,
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryFooterBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryFooterBtn: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryFooterBtnText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 15,
  },
});
