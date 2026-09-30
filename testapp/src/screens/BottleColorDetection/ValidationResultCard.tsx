import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnalysisResponse } from '../../types/colorDetection';

export const ValidationResultCard: React.FC<{ result: AnalysisResponse }> = ({ result }) => {
  const isRetake = result.status === 'RETAKE_IMAGE' || result.status === 'INVALID_INCUBATION_TIME';
  const isAmbiguous = result.status === 'AMBIGUOUS_RESULT';
  const quality = result.quality;
  const objectInfo = result.object_detection;
  const bestMatch = result.classification?.best_target_match;

  const headerColor = isRetake ? '#DC2626' : isAmbiguous ? '#D97706' : '#16A34A';
  const headerText = isRetake
    ? 'Photo needs adjustment'
    : isAmbiguous
    ? 'Borderline color match'
    : 'Chemical color match confirmed';

  const detectedHex =
    result.detected_color?.hex ||
    (result.detected_color?.rgb
      ? `#${result.detected_color.rgb.r.toString(16).padStart(2, '0')}${result.detected_color.rgb.g.toString(16).padStart(2, '0')}${result.detected_color.rgb.b.toString(16).padStart(2, '0')}`.toUpperCase()
      : '#888888');

  const matchPercentage =
    result.classification?.match_percentage ??
    result.detected_color?.match_percentage ??
    bestMatch?.match_percentage ??
    0;

  const targetMatches = result.classification?.target_matches ?? [];

  return (
    <View style={[styles.container, { borderColor: headerColor }]}>
      {/* Status Header */}
      <View style={[styles.headerBanner, { backgroundColor: headerColor }]}>
        <Text style={styles.headerTitle}>{headerText}</Text>
      </View>

      <View style={styles.body}>
        {/* ML Object Detection Recognition Badge */}
        {objectInfo && (
          <View style={styles.objectBadgeRow}>
            <Text style={styles.sectionLabel}>Container detection:</Text>
            <View
              style={[
                styles.objectBadge,
                objectInfo.is_bottle ? styles.badgeBottle : styles.badgeUnrelated,
              ]}>
              <Text style={styles.objectBadgeText}>
                {objectInfo.is_bottle ? 'Sample container' : 'Unrecognized object'}
              </Text>
              <Text style={styles.confidenceText}>
                {Math.round((objectInfo.confidence || 0) * 100)}% confidence
              </Text>
            </View>
          </View>
        )}

        {/* Primary Rejection Explanation Box */}
        {isRetake && (() => {
          // Combine both original rejection details and capture validation rejection details
          const allRejectionDetails = [
            ...(result.capture_rejection_details ?? []),
            ...(result.rejection_details ?? []),
          ].filter((item, idx, arr) =>
            arr.findIndex(d => d.reason === item.reason) === idx
          );

          return (
          <View style={styles.rejectionAlertBox}>
            <View style={styles.rejectionHeaderRow}>
              <View style={styles.rejectionTitleCol}>
                <Text style={styles.rejectionMainTitle}>
                  {result.rejection_title || 'Photo needs adjustment'}
                </Text>
                <Text style={styles.rejectionMainMsg}>
                  {result.rejection_message || 'The photo could not be accurately analyzed.'}
                </Text>
              </View>
            </View>

            {/* Detailed Rejection Reasons & How-To-Fix Steps */}
            {allRejectionDetails.length > 0 && (
              <View style={styles.rejectionDetailsList}>
                <Text style={styles.rejectionFixHeading}>Suggestions to improve photo:</Text>
                {allRejectionDetails.map((item, idx) => (
                  <View key={idx} style={styles.rejectionItemRow}>
                    <View style={styles.rejectionItemCol}>
                      <Text style={styles.rejectionItemTitle}>{item.title}</Text>
                      <Text style={styles.rejectionItemDesc}>{item.description}</Text>
                      <View style={styles.fixActionBox}>
                        <Text style={styles.fixActionLabel}>How to fix:</Text>
                        <Text style={styles.fixActionText}>{item.how_to_fix}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
          );
        })()}

        {/* Best Match Standard Winner Card */}
        {result.status === 'SUCCESS' && (
          <View style={styles.winnerCard}>
            <View style={styles.winnerHeaderRow}>
              <View
                style={[
                  styles.winnerSwatch,
                  { backgroundColor: bestMatch?.hex || result.classification?.hex || detectedHex },
                ]}
              />
              <View style={styles.winnerTitleCol}>
                <Text style={styles.winnerTag}>Best match standard</Text>
                <Text style={styles.winnerName}>
                  {result.classification?.level || bestMatch?.name || 'Standard Match'}
                </Text>
                {bestMatch?.hex && <Text style={styles.winnerHexText}>Target Hex: {bestMatch.hex}</Text>}
              </View>
              <View style={styles.winnerScoreCol}>
                <View style={styles.matchScoreBadge}>
                  <Text style={styles.matchScoreBadgeText}>
                    {matchPercentage > 0 ? `${matchPercentage.toFixed(1)}%` : 'Match'}
                  </Text>
                  <Text style={styles.matchScoreSubText}>confidence</Text>
                </View>
                {result.classification?.delta_e_2000 !== null && result.classification?.delta_e_2000 !== undefined && (
                  <Text style={styles.deltaEBadge}>ΔE: {result.classification.delta_e_2000.toFixed(2)}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Extracted Liquid Color & HEX Code Display */}
        {result.detected_color && (
          <View style={styles.colorComparisonCard}>
            <View style={styles.cardHeaderWithBadge}>
              <Text style={styles.cardSectionTitle}>Detected Liquid Color</Text>
              <View style={styles.hexPillBadge}>
                <Text style={styles.hexPillLabel}>HEX</Text>
                <Text style={styles.hexPillCode}>{detectedHex}</Text>
              </View>
            </View>

            <View style={styles.singleSwatchRow}>
              <View
                style={[
                  styles.largeSwatch,
                  {
                    backgroundColor: `rgb(${result.detected_color.rgb.r}, ${result.detected_color.rgb.g}, ${result.detected_color.rgb.b})`,
                  },
                ]}
              />
              <View style={styles.swatchDetailsCol}>
                <Text style={styles.detectedColorTitle}>
                  {result.detected_color.name || 'MEASURED_COLOR'}
                </Text>
                <View style={styles.hexHighlightBox}>
                  <Text style={styles.hexHighlightText}>{detectedHex}</Text>
                </View>
                <Text style={styles.detectedColorBadge}>
                  RGB: ({result.detected_color.rgb.r}, {result.detected_color.rgb.g}, {result.detected_color.rgb.b})
                </Text>
              </View>
            </View>

            {/* Exact Multi-Space Coordinates */}
            <View style={styles.coordsDivider} />
            <Text style={styles.colorValueCode}>
              RGB: ({result.detected_color.rgb.r}, {result.detected_color.rgb.g}, {result.detected_color.rgb.b}) | HSV: {Math.round(result.detected_color.hsv.h)}°, {Math.round(result.detected_color.hsv.s)}%, {Math.round(result.detected_color.hsv.v)}%
            </Text>
            <Text style={styles.colorValueCode}>
              CIE Lab (D65): L*:{result.detected_color.lab.l} | a*:{result.detected_color.lab.a} | b*:{result.detected_color.lab.b}
            </Text>
          </View>
        )}

        {/* Ranked Target Standards Breakdown */}
        {targetMatches.length > 0 && (
          <View style={styles.targetMatchesCard}>
            <Text style={styles.cardSectionTitle}>Chemical Standards Scale Matching</Text>
            {targetMatches.map((tm, idx) => {
              const isTop = idx === 0;
              const barColor = isTop ? '#10B981' : tm.match_percentage > 50 ? '#06B6D4' : '#6B7280';
              return (
                <View key={idx} style={styles.targetMatchRow}>
                  <View style={styles.targetMatchHeader}>
                    <View style={styles.targetNameCol}>
                      <View style={[styles.smallColorDot, { backgroundColor: tm.hex || '#888' }]} />
                      <Text style={[styles.targetNameText, isTop && styles.topTargetNameText]}>
                        {tm.name}
                      </Text>
                      <Text style={styles.targetHexBadge}>{tm.hex}</Text>
                    </View>
                    <View style={styles.targetScoreCol}>
                      <Text style={[styles.targetMatchPctText, { color: barColor }]}>
                        {tm.match_percentage.toFixed(1)}%
                      </Text>
                      <Text style={styles.targetDeltaText}>ΔE {tm.delta_e_2000.toFixed(1)}</Text>
                    </View>
                  </View>
                  <View style={styles.targetProgressBarTrack}>
                    <View
                      style={[
                        styles.targetProgressBarFill,
                        { width: `${Math.max(0, Math.min(100, tm.match_percentage))}%`, backgroundColor: barColor },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Validation Checks & Status Messages */}
        {result.validation_messages && result.validation_messages.length > 0 && (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Image Quality Diagnostics</Text>
            {result.validation_messages.map((msg, idx) => (
              <Text key={idx} style={styles.validationMessageItem}>
                {msg}
              </Text>
            ))}
          </View>
        )}

        {/* Component Score Progress Grid */}
        {quality && (
          <View style={styles.metricsGrid}>
            <MetricProgress label="Sharpness / Focus" score={quality.blur} threshold={50} />
            <MetricProgress label="Exposure Level" score={quality.exposure} threshold={60} />
            <MetricProgress label="Specular Glare Mask" score={quality.reflection} threshold={50} />
            <MetricProgress label="ROI Uniformity" score={quality.roi_uniformity} threshold={70} />
          </View>
        )}

        {/* Recommendations & Retake Guidance */}
        {result.recommendations && result.recommendations.length > 0 && (
          <View style={styles.recommendationsBox}>
            <Text style={styles.recommendationsTitle}>Actionable Hints for Optimal Measurement:</Text>
            {result.recommendations.map((rec, i) => (
              <Text key={i} style={styles.recommendationText}>
                • {rec}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const MetricProgress: React.FC<{ label: string; score: number; threshold: number }> = ({
  label,
  score,
  threshold,
}) => {
  const isPassed = score >= threshold;
  const barColor = isPassed ? '#10B981' : '#F87171';

  return (
    <View style={styles.metricContainer}>
      <View style={styles.metricLabelRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricScore, { color: barColor }]}>
          {score.toFixed(1)}/100 {isPassed ? '✓ PASS' : '⚠️ WARN'}
        </Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E2230',
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginVertical: 14,
  },
  headerBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  body: {
    padding: 16,
    gap: 14,
  },
  objectBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
  },
  objectBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeBottle: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  badgeUnrelated: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  objectBadgeText: {
    fontWeight: '800',
    fontSize: 11,
    color: '#FAFAFA',
  },
  confidenceText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  rejectionAlertBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  rejectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rejectionIcon: {
    fontSize: 22,
  },
  rejectionTitleCol: {
    flex: 1,
    gap: 3,
  },
  rejectionMainTitle: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  rejectionMainMsg: {
    color: '#FEE2E2',
    fontSize: 12,
    lineHeight: 17,
  },
  rejectionDetailsList: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rejectionFixHeading: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rejectionItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rejectionBullet: {
    fontSize: 13,
    marginTop: 1,
  },
  rejectionItemCol: {
    flex: 1,
    gap: 3,
  },
  rejectionItemTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  rejectionItemDesc: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 15,
  },
  fixActionBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 3,
  },
  fixActionLabel: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  fixActionText: {
    color: '#ECFDF5',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  winnerCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#10B981',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  winnerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  winnerSwatch: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  winnerTitleCol: {
    flex: 1,
    gap: 2,
  },
  winnerTag: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  winnerName: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '900',
  },
  winnerHexText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
  },
  winnerScoreCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  matchScoreBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  matchScoreBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  matchScoreSubText: {
    color: '#D1FAE5',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  deltaEBadge: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '700',
  },
  colorComparisonCard: {
    backgroundColor: '#161922',
    borderColor: '#2D3346',
    borderWidth: 1,
    padding: 14,
    borderRadius: 14,
  },
  cardHeaderWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardSectionTitle: {
    color: '#06B6D4',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hexPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2230',
    borderColor: '#06B6D4',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  hexPillLabel: {
    backgroundColor: '#06B6D4',
    color: '#0D0F17',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hexPillCode: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  singleSwatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 4,
  },
  swatchDetailsCol: {
    flex: 1,
    gap: 4,
  },
  detectedColorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  hexHighlightBox: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: '#06B6D4',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginVertical: 2,
  },
  hexHighlightText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detectedColorBadge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  largeSwatch: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 6,
  },
  targetMatchesCard: {
    backgroundColor: '#161922',
    borderColor: '#2D3346',
    borderWidth: 1,
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  targetMatchRow: {
    gap: 6,
  },
  targetMatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetNameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  smallColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  targetNameText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  topTargetNameText: {
    color: '#FAFAFA',
    fontWeight: '800',
  },
  targetHexBadge: {
    color: '#6B7280',
    fontSize: 10,
  },
  targetScoreCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetMatchPctText: {
    fontSize: 12,
    fontWeight: '900',
  },
  targetDeltaText: {
    color: '#6B7280',
    fontSize: 10,
  },
  targetProgressBarTrack: {
    height: 6,
    backgroundColor: '#2D3346',
    borderRadius: 3,
    overflow: 'hidden',
  },
  targetProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  coordsDivider: {
    height: 1,
    backgroundColor: '#2D3346',
    marginVertical: 10,
  },
  colorValueCode: {
    color: '#9CA3AF',
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 1,
  },
  sectionBox: {
    backgroundColor: '#161922',
    borderColor: '#2D3346',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  sectionTitle: {
    color: '#FAFAFA',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 6,
  },
  validationMessageItem: {
    color: '#D1D5DB',
    fontSize: 12,
    marginVertical: 2,
  },
  metricsGrid: {
    gap: 10,
  },
  metricContainer: {
    gap: 4,
  },
  metricLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  metricScore: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#2D3346',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  recommendationsBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  recommendationsTitle: {
    color: '#FBBF24',
    fontWeight: '800',
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  recommendationText: {
    color: '#FEF3C7',
    fontSize: 12,
    marginVertical: 2,
  },
});
