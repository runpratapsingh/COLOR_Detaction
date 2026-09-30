import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme } from '../theme/colors';
import { JalqAnalysisResponse, RejectionDetail } from '../types/jalq';
import { CaptureInstructionsModal } from './CaptureInstructionsModal';

interface ValidationGateModalProps {
  visible: boolean;
  result: JalqAnalysisResponse | null;
  imageUri: string | null;
  onRetake: () => void;
}

export const ValidationGateModal: React.FC<ValidationGateModalProps> = ({
  visible,
  result,
  imageUri,
  onRetake,
}) => {
  const [showInstructions, setShowInstructions] = useState(false);

  if (!result) return null;

  const captureChecks = result.capture_validation?.checks || {};
  const rejectionReasons = result.reasons || [];

  const ignoredReasons = [
    'POOR_FRAMING_TOO_SMALL',
    'POOR_FRAMING_TOO_LARGE',
    'POOR_FRAMING_CLIPPED',
    'EXCESSIVE_REFLECTION',
    'LANDSCAPE_ORIENTATION',
    'BLURRY',
  ];

  // Deduplicate rejection details and filter out removed validations (framing, glare, orientation, blur)
  const allRejectionDetails: RejectionDetail[] = [
    ...(result.capture_rejection_details || []),
    ...(result.rejection_details || []),
  ]
    .filter((item) => !ignoredReasons.includes(item.reason))
    .filter(
      (item, idx, arr) => arr.findIndex((d) => d.reason === item.reason) === idx
    );

  // Evaluate core quality checkpoints (Fit, Glare, Orientation, and Focus validations removed per requirement)
  const checksList = [
    {
      id: 'bottle_detected',
      name: 'Bottle Clearly Visible',
      icon: '🍾',
      passed:
        !rejectionReasons.includes('BOTTLE_NOT_DETECTED') &&
        captureChecks.bottle_detected !== false,
      issue: 'Could not clearly find the bottle in the picture.',
      fix: 'Put the bottle upright in the center of your screen.',
    },
    {
      id: 'exposure',
      name: 'Good Lighting',
      icon: '💡',
      passed:
        !rejectionReasons.includes('UNDEREXPOSED') &&
        !rejectionReasons.includes('OVEREXPOSED') &&
        captureChecks.exposure?.is_underexposed !== true &&
        captureChecks.exposure?.is_overexposed !== true,
      issue: rejectionReasons.includes('UNDEREXPOSED')
        ? 'Photo is too dark.'
        : 'Photo is too bright or washed out.',
      fix: 'Move to a well-lit area with soft daylight. Avoid direct sunlight.',
    },
    {
      id: 'background',
      name: 'Plain Background',
      icon: '📄',
      passed:
        !rejectionReasons.includes('COLORED_BACKGROUND') &&
        captureChecks.background?.is_colored !== true,
      issue: `Colored background behind bottle (${captureChecks.background?.dominant_cast || 'colored tint'}).`,
      fix: 'Place a plain white paper or white card behind the bottle.',
    },
    {
      id: 'flash',
      name: 'Flash Turned Off',
      icon: '⚡',
      passed:
        !rejectionReasons.includes('FLASH_DETECTED') &&
        captureChecks.flash?.flash_fired !== true,
      issue: 'Camera flash was turned on.',
      fix: 'Turn off camera flash so glass doesn’t create bright spots.',
    },
  ];

  const failedCount = checksList.filter((c) => !c.passed).length;
  const passedCount = checksList.length - failedCount;

  const detectedColor = result.detected_color;
  const hexStr =
    detectedColor?.hex ||
    (detectedColor?.rgb
      ? `#${detectedColor.rgb.r.toString(16).padStart(2, '0')}${detectedColor.rgb.g.toString(16).padStart(2, '0')}${detectedColor.rgb.b.toString(16).padStart(2, '0')}`.toUpperCase()
      : '#666666');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onRetake}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

        {/* Top Gate Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleBox}>
            <View style={styles.alertDot} />
            <Text style={styles.headerTitle}>Photo Verification</Text>
          </View>
          <Pressable
            style={styles.protoBtn}
            onPress={() => setShowInstructions(true)}>
            <Text style={styles.protoBtnText}>Photo Tips</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Status Alert Banner */}
          <View style={styles.alertBanner}>
            <View style={styles.alertTextCol}>
              <Text style={styles.alertHeading}>
                Photo Needs Adjustment ({passedCount}/{checksList.length} Checks Passed)
              </Text>
              <Text style={styles.alertSub}>
                A clear, glare-free photo ensures the right chemical reading. Please review the adjustments below.
              </Text>
            </View>
          </View>

          {/* Color Extraction Preview */}
          <View style={styles.colorPreviewCard}>
            <Text style={styles.cardTitle}>Detected Liquid Color</Text>
            <View style={styles.colorRow}>
              <View style={[styles.colorSwatch, { backgroundColor: hexStr }]} />
              <View style={styles.colorInfoCol}>
                <Text style={styles.colorHex}>{hexStr.toUpperCase()}</Text>
                <Text style={styles.colorWarning}>
                  This color reading may be altered by lighting or glare.
                </Text>
              </View>
            </View>
          </View>

          {/* Checkpoints Grid */}
          <View style={styles.checklistCard}>
            <Text style={styles.cardTitle}>Photo Quality Checklist</Text>
            <View style={styles.checklistItems}>
              {checksList.map((check) => (
                <View
                  key={check.id}
                  style={[
                    styles.checkRow,
                    !check.passed && styles.checkRowFailed,
                  ]}>
                  <View style={styles.checkLeft}>
                    <View
                      style={[
                        styles.checkStatusCircle,
                        check.passed ? styles.circlePass : styles.circleFail,
                      ]}>
                      <Text
                        style={[
                          styles.checkStatusSymbol,
                          check.passed ? styles.symbolPass : styles.symbolFail,
                        ]}>
                        {check.passed ? '✓' : '!'}
                      </Text>
                    </View>
                    <View style={styles.checkLabelCol}>
                      <Text
                        style={[
                          styles.checkName,
                          !check.passed && styles.checkNameFailed,
                        ]}>
                        {check.name}
                      </Text>
                      {!check.passed && (
                        <Text style={styles.checkIssueText}>{check.issue}</Text>
                      )}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      check.passed
                        ? styles.statusBadgePass
                        : styles.statusBadgeFail,
                    ]}>
                    <Text
                      style={[
                        styles.statusBadgeText,
                        check.passed
                          ? styles.statusBadgeTextPass
                          : styles.statusBadgeTextFail,
                      ]}>
                      {check.passed ? 'Passed' : 'Adjust'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Specific Fixes Required */}
          {allRejectionDetails.length > 0 && (
            <View style={styles.fixesCard}>
              <Text style={styles.cardTitle}>Tips for an Accurate Result</Text>
              {allRejectionDetails.map((item, idx) => (
                <View key={idx} style={styles.fixItem}>
                  <Text style={styles.fixItemTitle}>• {item.title}</Text>
                  <Text style={styles.fixItemDesc}>{item.description}</Text>
                  <View style={styles.fixActionBox}>
                    <Text style={styles.fixActionLabel}>How to fix:</Text>
                    <Text style={styles.fixActionText}>{item.how_to_fix}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Retake Button */}
          <Pressable style={styles.retakeBtn} onPress={onRetake}>
            <Text style={styles.retakeBtnText}>Retake Photo</Text>
          </Pressable>
        </ScrollView>

        {/* Capture Instructions Protocol Modal */}
        <CaptureInstructionsModal
          visible={showInstructions}
          onClose={() => setShowInstructions(false)}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  protoBtn: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  protoBtnText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  alertIcon: {
    fontSize: 22,
  },
  alertTextCol: {
    flex: 1,
  },
  alertHeading: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertSub: {
    color: '#7F1D1D',
    fontSize: 12,
    lineHeight: 17,
  },
  cardTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  colorPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  colorInfoCol: {
    flex: 1,
  },
  colorHex: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  colorWarning: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  checklistCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  checklistItems: {
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkRowFailed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  checkLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 8,
  },
  checkStatusCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  circlePass: {
    backgroundColor: '#DCFCE7',
  },
  circleFail: {
    backgroundColor: '#FEE2E2',
  },
  checkStatusSymbol: {
    fontSize: 12,
    fontWeight: '700',
  },
  symbolPass: {
    color: '#15803D',
  },
  symbolFail: {
    color: '#DC2626',
  },
  checkLabelCol: {
    flex: 1,
  },
  checkName: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  checkNameFailed: {
    color: '#991B1B',
  },
  checkIssueText: {
    color: '#DC2626',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgePass: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
  },
  statusBadgeFail: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeTextPass: {
    color: '#15803D',
  },
  statusBadgeTextFail: {
    color: '#B91C1C',
  },
  fixesCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  fixItem: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  fixItemTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  fixItemDesc: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  fixActionBox: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
  },
  fixActionLabel: {
    color: '#0284C7',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fixActionText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  retakeBtn: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 6,
  },
  retakeBtnIcon: {
    fontSize: 18,
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
