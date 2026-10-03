import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { JalqTheme, DS } from '../../theme/colors';
import { ChemicalTestDetail, ProcedureStep, Reagent, UserSession } from '../../types/jalq';
import { createChemicalTest, fetchTestDetails, updateChemicalTest } from '../../services/jalqApi';
import { HeaderBackButton } from '../../components';

interface CreateEditTestScreenProps {
  session: UserSession;
  testId?: string; // If provided, edit mode; otherwise create mode
  onBack: () => void;
  onSaved: (testId: string) => void;
}

export const CreateEditTestScreen: React.FC<CreateEditTestScreenProps> = ({
  session,
  testId,
  onBack,
  onSaved,
}) => {
  const isEditing = Boolean(testId);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [code, setCode] = useState(testId || '');
  const [name, setName] = useState('');
  const [sampleType, setSampleType] = useState('Water');
  const [unit, setUnit] = useState('mg/L');
  const [incubationMinutes, setIncubationMinutes] = useState('5');
  const [incubationToleranceSecs, setIncubationToleranceSecs] = useState('60');
  const [description, setDescription] = useState('');
  const [sampleRequirements, setSampleRequirements] = useState('10 mL sample in clean container');
  const [videoUrl, setVideoUrl] = useState('https://assets.mixkit.co/videos/preview/mixkit-chemical-reaction-in-a-lab-tube-40292-large.mp4');
  const [notes, setNotes] = useState('');

  // Procedure Steps
  const [procedure, setProcedure] = useState<ProcedureStep[]>([
    {
      step_number: 1,
      title: 'Collect Sample',
      instruction: 'Fill reaction bottle with 10 mL of water sample up to the marked fill line.',
      tip: 'Ensure sample is clear of large suspended debris.',
    },
    {
      step_number: 2,
      title: 'Add Indicator Reagent',
      instruction: 'Add reagent powder pillow and cap bottle tightly.',
      tip: 'Tap packet gently to transfer all indicator contents.',
    },
    {
      step_number: 3,
      title: 'Invert to Dissolve',
      instruction: 'Invert gently 10 times until the powder is fully dissolved.',
      tip: 'Do not shake aggressively to avoid micro-bubbles.',
    },
    {
      step_number: 4,
      title: 'Reaction Incubation',
      instruction: 'Allow reaction to develop undisturbed for the designated duration.',
      tip: 'Liquid will shift color according to concentration.',
    },
    {
      step_number: 5,
      title: 'Capture Assay in JalQ',
      instruction: 'Position bottle against neutral white background and capture frame.',
      tip: 'Avoid harsh directional glare or camera flash.',
    },
  ]);

  // Reagents List
  const [reagents, setReagents] = useState<Reagent[]>([
    { name: 'Indicator Powder Pillow', amount: '1 Pillow / 10 mL' },
    { name: 'Optical Sample Bottle (15 mL)', amount: '1 Bottle' },
  ]);

  useEffect(() => {
    let isMounted = true;
    const loadExistingTest = async (id: string) => {
      setLoading(true);
      try {
        const detail = await fetchTestDetails(id);
        if (isMounted) {
          setCode(detail.test_id);
          setName(detail.name);
          setSampleType(detail.sample_type);
          setUnit(detail.unit);
          setIncubationMinutes(String(Math.round(detail.incubation_seconds / 60)));
          setIncubationToleranceSecs(String(detail.incubation_tolerance_seconds));
          setDescription(detail.description || '');
          setSampleRequirements(detail.sample_requirements || '');
          setVideoUrl(detail.video_url || '');
          setNotes(detail.notes || '');
          if (detail.procedure && detail.procedure.length > 0) {
            setProcedure(detail.procedure);
          }
          if (detail.reagents && detail.reagents.length > 0) {
            setReagents(detail.reagents);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          Alert.alert('Load Error', err.message || 'Failed to load test details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (testId) {
      loadExistingTest(testId);
    }
    return () => {
      isMounted = false;
    };
  }, [testId]);

  const handleSave = async () => {
    if (!code.trim()) {
      Alert.alert('Validation Error', 'Test Code / ID is required (e.g. NITRATE_001).');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Test Name is required.');
      return;
    }
    const incSecs = Math.max(10, parseInt(incubationMinutes, 10) * 60 || 300);
    const incTol = Math.max(10, parseInt(incubationToleranceSecs, 10) || 60);

    const payload = {
      test_id: code.trim().toUpperCase(),
      name: name.trim(),
      sample_type: sampleType.trim(),
      unit: unit.trim(),
      incubation_seconds: incSecs,
      incubation_tolerance_seconds: incTol,
      description: description.trim(),
      sample_requirements: sampleRequirements.trim(),
      video_url: videoUrl.trim(),
      notes: notes.trim(),
      procedure: procedure,
      reagents: reagents,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateChemicalTest(code.trim().toUpperCase(), payload, session.role);
        Alert.alert('Success', `Test '${name}' updated successfully.`);
      } else {
        await createChemicalTest(payload, session.role);
        Alert.alert('Success', `Chemical test '${name}' created in DRAFT state.`);
      }
      onSaved(code.trim().toUpperCase());
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to save chemical test.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={JalqTheme.colors.bgDeep} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading test parameters...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={JalqTheme.colors.bgDeep} />

      {/* Top Header */}
      <View style={styles.topBar}>
        <HeaderBackButton onPress={onBack} label="Cancel" />
        <Text style={styles.navTitle}>{isEditing ? 'Edit Protocol' : 'New Chemical Assay'}</Text>
        <Pressable
          style={[styles.saveTopBtn, saving && styles.btnDisabled]}
          disabled={saving}
          onPress={handleSave}>
          <Text style={styles.saveTopBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Card 1: Core Identification */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>General Information</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Test Code / ID</Text>
              <TextInput
                style={[styles.input, isEditing && styles.inputReadonly]}
                value={code}
                onChangeText={setCode}
                placeholder="e.g. NITRATE_001"
                placeholderTextColor={JalqTheme.colors.textMuted}
                autoCapitalize="characters"
                editable={!isEditing}
              />
              <Text style={styles.fieldHint}>
                Unique identifier across calibration sets
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Test Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Nitrate (NO3-) Concentration Assay"
                placeholderTextColor={JalqTheme.colors.textMuted}
              />
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.fieldLabel}>Sample Type</Text>
                <TextInput
                  style={styles.input}
                  value={sampleType}
                  onChangeText={setSampleType}
                  placeholder="Water, Soil, etc."
                  placeholderTextColor={JalqTheme.colors.textMuted}
                />
              </View>

              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.fieldLabel}>Reporting Unit</Text>
                <TextInput
                  style={styles.input}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="mg/L, ppm, etc."
                  placeholderTextColor={JalqTheme.colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.fieldLabel}>Incubation (minutes)</Text>
                <TextInput
                  style={styles.input}
                  value={incubationMinutes}
                  onChangeText={setIncubationMinutes}
                  placeholder="5"
                  placeholderTextColor={JalqTheme.colors.textMuted}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.fieldLabel}>Tolerance (seconds)</Text>
                <TextInput
                  style={styles.input}
                  value={incubationToleranceSecs}
                  onChangeText={setIncubationToleranceSecs}
                  placeholder="60"
                  placeholderTextColor={JalqTheme.colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Protocol Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Brief summary of chemical test methodology and target parameter..."
                placeholderTextColor={JalqTheme.colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sample Requirements</Text>
              <TextInput
                style={styles.input}
                value={sampleRequirements}
                onChangeText={setSampleRequirements}
                placeholder="e.g. 10 mL fresh water sample in clean container"
                placeholderTextColor={JalqTheme.colors.textMuted}
              />
            </View>
          </View>

          {/* Card 2: Demonstration Video & Notes */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Demonstration & Safety</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Procedure Video URL (Optional)</Text>
              <TextInput
                style={styles.input}
                value={videoUrl}
                onChangeText={setVideoUrl}
                placeholder="https://... video stream or MP4 URL"
                placeholderTextColor={JalqTheme.colors.textMuted}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Safety Instructions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Wear safety glasses. Discard reacted solution responsibly according to protocol."
                placeholderTextColor={JalqTheme.colors.textMuted}
                multiline
                numberOfLines={2}
              />
            </View>
          </View>

          {/* Card 3: Procedure Preview */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Step-by-Step Procedure</Text>
            <Text style={styles.cardHeaderSubtitle}>
              {procedure.length} standard sequential steps configured for field testers:
            </Text>

            {procedure.map((step) => (
              <View key={step.step_number} style={styles.stepItemRow}>
                <View style={styles.stepNumCircle}>
                  <Text style={styles.stepNumText}>{step.step_number}</Text>
                </View>
                <View style={styles.stepInfoCol}>
                  <Text style={styles.stepTitleText}>{step.title}</Text>
                  <Text style={styles.stepInstText}>{step.instruction}</Text>
                  {step.tip && <Text style={styles.stepTipText}>💡 Tip: {step.tip}</Text>}
                </View>
              </View>
            ))}
          </View>

          {/* Save Action Bottom Button */}
          <Pressable
            style={[styles.saveBottomBtn, saving && styles.btnDisabled]}
            disabled={saving}
            onPress={handleSave}>
            {saving ? (
              <ActivityIndicator color={JalqTheme.colors.textInverse} />
            ) : (
              <Text style={styles.saveBottomBtnText}>
                {isEditing ? 'Save Changes' : 'Create Test & Configure Standards →'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgDark,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: JalqTheme.spacing.base,
    paddingVertical: JalqTheme.spacing.md,
    borderBottomColor: JalqTheme.colors.borderSubtle,
    borderBottomWidth: 1,
    backgroundColor: JalqTheme.colors.bgCard,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  saveTopBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: JalqTheme.radius.md,
  },
  saveTopBtnText: {
    color: JalqTheme.colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: JalqTheme.spacing.base,
    gap: JalqTheme.spacing.md,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.lg,
    padding: JalqTheme.spacing.base,
    ...JalqTheme.shadow.sm,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 4,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    ...DS.fieldLabel,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: JalqTheme.colors.textMuted,
    marginTop: 4,
  },
  input: {
    ...DS.input,
  },
  inputReadonly: {
    backgroundColor: JalqTheme.colors.bgMuted,
    color: JalqTheme.colors.textSecondary,
    borderColor: JalqTheme.colors.borderSubtle,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 12,
  },
  stepItemRow: {
    flexDirection: 'row',
    backgroundColor: JalqTheme.colors.bgInput,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    padding: 12,
    borderRadius: JalqTheme.radius.md,
    marginBottom: 8,
    gap: 10,
  },
  stepNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: JalqTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: JalqTheme.colors.textInverse,
    fontWeight: '800',
    fontSize: 11,
  },
  stepInfoCol: {
    flex: 1,
  },
  stepTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  stepInstText: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  stepTipText: {
    fontSize: 11,
    color: JalqTheme.colors.amber,
    marginTop: 4,
  },
  saveBottomBtn: {
    ...DS.primaryBtn,
    paddingVertical: 14,
    marginBottom: 24,
  },
  saveBottomBtnText: {
    ...DS.primaryBtnText,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
});
