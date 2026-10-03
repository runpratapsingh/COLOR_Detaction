import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme, DS } from '../../theme/colors';
import { ChemicalTestDetail } from '../../types/jalq';
import { fetchTestDetails } from '../../services/jalqApi';
import { HeaderBackButton } from '../../components';

interface TestDetailsScreenProps {
  testId: string;
  onBack: () => void;
  onStartIncubation: (test: ChemicalTestDetail) => void;
}

export const TestDetailsScreen: React.FC<TestDetailsScreenProps> = ({
  testId,
  onBack,
  onStartIncubation,
}) => {
  const [test, setTest] = useState<ChemicalTestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [testId]);

  const loadDetails = async () => {
    setLoading(true);
    const data = await fetchTestDetails(testId);
    setTest(data);
    setLoading(false);
  };

  const toggleStep = (stepNumber: number) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  if (loading || !test) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={JalqTheme.colors.bgDeep} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading Test Specifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const incubMin = Math.round(test.incubation_seconds / 60);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={JalqTheme.colors.bgDeep} />

      {/* Navigation Top Bar */}
      <View style={styles.navBar}>
        <HeaderBackButton onPress={onBack} label="Tests" />
        <Text style={styles.navTitle} numberOfLines={1}>
          {test.name}
        </Text>
        <View style={styles.navPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Test Overview Card */}
        <View style={styles.card}>
          <View style={styles.titleBadgeRow}>
            <View style={styles.protocolBadge}>
              <Text style={styles.protocolBadgeText}>{test.test_id}</Text>
            </View>
            <View style={styles.incubBadge}>
              <Text style={styles.incubBadgeText}>⏱ {incubMin} min incubation</Text>
            </View>
          </View>

          <Text style={styles.mainTitle}>{test.name}</Text>
          {test.description ? (
            <Text style={styles.descriptionText}>{test.description}</Text>
          ) : null}

          {/* Quick Specs Grid */}
          <View style={styles.specsGrid}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>Sample</Text>
              <Text style={styles.specVal}>{test.sample_type}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>Unit</Text>
              <Text style={styles.specVal}>{test.unit}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>Volume</Text>
              <Text style={styles.specVal} numberOfLines={1}>
                {test.sample_requirements || '10 mL'}
              </Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>Wait time</Text>
              <Text style={styles.specVal}>{incubMin} min</Text>
            </View>
          </View>
        </View>

        {/* Video / Visual Instruction Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How-To Video Guide</Text>

          <View style={styles.videoPlayerContainer}>
            <View style={styles.videoPoster}>
              <Text style={styles.videoPosterIcon}>🔬</Text>
              <Text style={styles.videoPosterTitle}>Chemical Reaction Protocol</Text>
              <Text style={styles.videoPosterSubtitle}>
                Add water sample & reagent pillow, invert gently 10x, then incubate
              </Text>
              <Pressable
                style={styles.playButton}
                onPress={() => setIsVideoPlaying(!isVideoPlaying)}>
                <Text style={styles.playButtonText}>
                  {isVideoPlaying ? '⏸ Pause Protocol' : '▶ Watch Step Video'}
                </Text>
              </Pressable>
            </View>

            {isVideoPlaying && (
              <View style={styles.videoNoticeBanner}>
                <Text style={styles.videoNoticeText}>
                  Invert bottle 10 times until powder dissolves. The liquid will develop color over {incubMin} minutes.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Required Materials */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Required Materials</Text>

          <View style={styles.reagentsList}>
            {test.reagents.map((reagent, idx) => (
              <View key={idx} style={styles.reagentItemRow}>
                <View style={styles.reagentBulletCircle}>
                  <Text style={styles.reagentBulletText}>🧪</Text>
                </View>
                <Text style={styles.reagentName}>{reagent.name}</Text>
                <View style={styles.reagentAmountBadge}>
                  <Text style={styles.reagentAmount}>{reagent.amount}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Step-by-Step Procedure Checklist */}
        <View style={styles.card}>
          <View style={styles.procedureHeaderRow}>
            <Text style={styles.sectionTitle}>Step-by-Step Procedure</Text>
            <Text style={styles.procedureSub}>Tap step when completed</Text>
          </View>

          <View style={styles.procedureList}>
            {test.procedure.map((step) => {
              const isChecked = !!checkedSteps[step.step_number];
              return (
                <Pressable
                  key={step.step_number}
                  style={[
                    styles.procedureStepRow,
                    isChecked && styles.procedureStepChecked,
                  ]}
                  onPress={() => toggleStep(step.step_number)}>
                  {/* Step Number or Checkbox */}
                  <View
                    style={[
                      styles.stepCheckbox,
                      isChecked && styles.stepCheckboxActive,
                    ]}>
                    <Text
                      style={[
                        styles.stepCheckboxText,
                        isChecked && styles.stepCheckboxTextActive,
                      ]}>
                      {isChecked ? '✓' : String(step.step_number)}
                    </Text>
                  </View>

                  <View style={styles.stepContentCol}>
                    <Text
                      style={[
                        styles.stepTitle,
                        isChecked && styles.stepTitleChecked,
                      ]}>
                      {step.title}
                    </Text>
                    <Text style={styles.stepInstruction}>{step.instruction}</Text>
                    {step.tip && (
                      <View style={styles.tipBox}>
                        <Text style={styles.tipText}>💡 Tip: {step.tip}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Color Standards Preview */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Calibrated Standards Ladder</Text>
          <Text style={styles.sectionDesc}>Expected color spectrum for {test.name}</Text>

          <View style={styles.standardsRow}>
            {test.standards.map((std) => (
              <View key={std.id} style={styles.stdPreviewItem}>
                <View
                  style={[
                    styles.stdSwatch,
                    { backgroundColor: std.reference_color.hex },
                  ]}
                />
                <Text style={styles.stdLevelText} numberOfLines={1}>{std.level}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Footer CTA */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.startReactionBtn, pressed && styles.btnPressed]}
          onPress={() => onStartIncubation(test)}>
          <Text style={styles.startReactionText}>
            Start Incubation Timer ({incubMin} min) →
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgDark,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: JalqTheme.colors.textSecondary,
    fontSize: 13,
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
    textAlign: 'center',
    color: JalqTheme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
    paddingHorizontal: 8,
  },
  navPlaceholder: {
    width: 60,
  },
  scrollContent: {
    padding: JalqTheme.spacing.base,
    gap: JalqTheme.spacing.md,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.lg,
    padding: JalqTheme.spacing.base,
    ...JalqTheme.shadow.sm,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  protocolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: JalqTheme.radius.sm,
    backgroundColor: JalqTheme.colors.bgMuted,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
  },
  protocolBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: JalqTheme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  incubBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: JalqTheme.radius.sm,
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderFocus,
  },
  incubBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: JalqTheme.colors.primary,
  },
  mainTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  specsGrid: {
    flexDirection: 'row',
    gap: 8,
    borderTopColor: JalqTheme.colors.borderSubtle,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  specBox: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgInput,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    padding: 8,
    borderRadius: JalqTheme.radius.md,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  specVal: {
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.primary,
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
  },
  videoPlayerContainer: {
    backgroundColor: JalqTheme.colors.bgInput,
    borderRadius: JalqTheme.radius.md,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
    overflow: 'hidden',
    marginTop: 8,
  },
  videoPoster: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPosterIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  videoPosterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    textAlign: 'center',
  },
  videoPosterSubtitle: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 17,
  },
  playButton: {
    backgroundColor: JalqTheme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: JalqTheme.radius.md,
  },
  playButtonText: {
    color: JalqTheme.colors.textInverse,
    fontWeight: '700',
    fontSize: 12,
  },
  videoNoticeBanner: {
    backgroundColor: JalqTheme.colors.primaryGlow,
    padding: 12,
    borderTopColor: JalqTheme.colors.borderSubtle,
    borderTopWidth: 1,
  },
  videoNoticeText: {
    color: JalqTheme.colors.primary,
    fontSize: 12,
    lineHeight: 16,
  },
  reagentsList: {
    gap: 8,
    marginTop: 8,
  },
  reagentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: JalqTheme.colors.bgInput,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  reagentBulletCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: JalqTheme.colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reagentBulletText: {
    fontSize: 12,
  },
  reagentName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: JalqTheme.colors.textPrimary,
  },
  reagentAmountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: JalqTheme.radius.pill,
    backgroundColor: JalqTheme.colors.bgMuted,
  },
  reagentAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: JalqTheme.colors.textSecondary,
  },
  procedureHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  procedureSub: {
    fontSize: 11,
    color: JalqTheme.colors.textMuted,
  },
  procedureList: {
    gap: 10,
  },
  procedureStepRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: JalqTheme.colors.bgInput,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    borderRadius: JalqTheme.radius.md,
    padding: 12,
  },
  procedureStepChecked: {
    borderColor: JalqTheme.colors.emerald,
    backgroundColor: JalqTheme.colors.emeraldGlow,
  },
  stepCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: JalqTheme.colors.bgCardElevated,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepCheckboxActive: {
    backgroundColor: JalqTheme.colors.emerald,
    borderColor: JalqTheme.colors.emerald,
  },
  stepCheckboxText: {
    fontSize: 11,
    fontWeight: '800',
    color: JalqTheme.colors.textSecondary,
  },
  stepCheckboxTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  stepContentCol: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 4,
  },
  stepTitleChecked: {
    color: JalqTheme.colors.emerald,
  },
  stepInstruction: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 17,
  },
  tipBox: {
    marginTop: 6,
    backgroundColor: JalqTheme.colors.amberGlow,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: JalqTheme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tipText: {
    fontSize: 11,
    color: JalqTheme.colors.amber,
    lineHeight: 15,
  },
  standardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 4,
  },
  stdPreviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  stdSwatch: {
    width: '100%',
    height: 26,
    borderRadius: JalqTheme.radius.sm,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
    marginBottom: 4,
  },
  stdLevelText: {
    fontSize: 9,
    fontWeight: '700',
    color: JalqTheme.colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: JalqTheme.spacing.base,
    paddingVertical: JalqTheme.spacing.md,
    backgroundColor: JalqTheme.colors.bgCardElevated,
    borderTopWidth: 1,
    borderTopColor: JalqTheme.colors.borderSubtle,
  },
  startReactionBtn: {
    ...DS.primaryBtn,
    paddingVertical: 14,
  },
  btnPressed: {
    opacity: 0.85,
  },
  startReactionText: {
    ...DS.primaryBtnText,
  },
});
