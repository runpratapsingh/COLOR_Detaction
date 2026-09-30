import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme } from '../../theme/colors';
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
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading Test Specifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Navigation Top Bar */}
      <View style={styles.navBar}>
        <HeaderBackButton onPress={onBack} label="Tests" />
        <Text style={styles.navTitle} numberOfLines={1}>
          {test.name}
        </Text>
        <View style={styles.navPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Test Overview Card */}
        <View style={styles.card}>
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
              <Text style={styles.specVal}>
                {Math.round(test.incubation_seconds / 60)} min
              </Text>
            </View>
          </View>
        </View>

        {/* Video / Visual Instruction Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How-To Video Guide</Text>

          <View style={styles.videoPlayerContainer}>
            <View style={styles.videoPoster}>
              <Text style={styles.videoPosterTitle}>Chemical Reaction Guide</Text>
              <Text style={styles.videoPosterSubtitle}>
                Add water sample and powder pillow, invert gently, then wait for color
              </Text>
              <Pressable
                style={styles.playButton}
                onPress={() => setIsVideoPlaying(!isVideoPlaying)}>
                <Text style={styles.playButtonText}>
                  {isVideoPlaying ? 'Pause Video' : 'Watch Step Video'}
                </Text>
              </Pressable>
            </View>

            {isVideoPlaying && (
              <View style={styles.videoNoticeBanner}>
                <Text style={styles.videoNoticeText}>
                  Invert bottle 10 times until powder dissolves. The liquid will develop color over {Math.round(test.incubation_seconds / 60)} minutes.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Required Materials */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What You Need</Text>

          <View style={styles.reagentsList}>
            {test.reagents.map((reagent, idx) => (
              <View key={idx} style={styles.reagentItemRow}>
                <Text style={styles.reagentBullet}>•</Text>
                <Text style={styles.reagentName}>{reagent.name}</Text>
                <Text style={styles.reagentAmount}>{reagent.amount}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Step-by-Step Procedure Checklist */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Steps to Follow</Text>

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
                        <Text style={styles.tipText}>Tip: {step.tip}</Text>
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
          <Text style={styles.sectionTitle}>Expected Color Range</Text>

          <View style={styles.standardsRow}>
            {test.standards.map((std) => (
              <View key={std.id} style={styles.stdPreviewItem}>
                <View
                  style={[
                    styles.stdSwatch,
                    { backgroundColor: std.reference_color.hex },
                  ]}
                />
                <Text style={styles.stdLevelText}>{std.level}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Footer CTA */}
      <View style={styles.footer}>
        <Pressable
          style={styles.startReactionBtn}
          onPress={() => onStartIncubation(test)}>
          <Text style={styles.startReactionText}>
            Start Reaction Timer ({Math.round(test.incubation_seconds / 60)} min)
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: JalqTheme.colors.textMuted,
    fontSize: 13,
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
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: JalqTheme.colors.bgCardElevated,
  },
  backText: {
    color: JalqTheme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    color: JalqTheme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
    paddingHorizontal: 8,
  },
  navPlaceholder: {
    width: 60,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
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
  headerTagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  testTag: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  testTagText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  incubationTag: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  incubationTagText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 18,
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
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  specVal: {
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  videoPlayerContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  videoPosterSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 16,
  },
  playButton: {
    backgroundColor: JalqTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  videoNoticeBanner: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    padding: 12,
    borderTopColor: '#334155',
    borderTopWidth: 1,
  },
  videoNoticeText: {
    color: '#7DD3FC',
    fontSize: 12,
    lineHeight: 16,
  },
  reagentsList: {
    gap: 8,
  },
  reagentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  reagentBullet: {
    color: JalqTheme.colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  reagentName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  reagentAmount: {
    fontSize: 11,
    fontWeight: '700',
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
    borderRadius: 12,
    padding: 12,
  },
  procedureStepChecked: {
    borderColor: JalqTheme.colors.emerald,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  stepCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: JalqTheme.colors.bgCardElevated,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
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
    color: JalqTheme.colors.textMuted,
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
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 4,
  },
  stepTitleChecked: {
    color: JalqTheme.colors.emerald,
  },
  stepInstruction: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 16,
  },
  tipBox: {
    marginTop: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tipText: {
    fontSize: 10,
    color: JalqTheme.colors.amber,
    lineHeight: 14,
  },
  standardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stdPreviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  stdSwatch: {
    width: '100%',
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    marginBottom: 4,
  },
  stdLevelText: {
    fontSize: 9,
    fontWeight: '700',
    color: JalqTheme.colors.textMuted,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  startReactionBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startReactionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
