import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { JalqTheme } from '../../theme/colors';
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
          setIncubationToleranceSecs(String(detail.incubation_tolerance_seconds || 60));
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
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to load test details:', err);
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
      Alert.alert('Validation Error', 'Please enter a unique Test ID (e.g. NITRATE_001).');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a Test Name.');
      return;
    }

    const incSecs = Math.max(10, (parseInt(incubationMinutes, 10) || 5) * 60);
    const incTol = Math.max(5, parseInt(incubationToleranceSecs, 10) || 60);

    const payload: Partial<ChemicalTestDetail> = {
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
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading test parameters...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <HeaderBackButton onPress={onBack} label="Cancel" />
        <Text style={styles.navTitle}>{isEditing ? 'Edit Chemical Test' : 'Create Chemical Test'}</Text>
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Card 1: Core Identification */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>General Information</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Test code / ID</Text>
              <TextInput
                style={[styles.input, isEditing && styles.inputReadonly]}
                value={code}
                onChangeText={setCode}
                placeholder="e.g. NITRATE_001"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                editable={!isEditing}
              />
              <Text style={styles.fieldHint}>
                Unique code for identification (e.g. {code || 'CODE'})
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Test name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Nitrate (NO3-) Concentration Assay"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.fieldLabel}>Sample type</Text>
                <TextInput
                  style={styles.input}
                  value={sampleType}
                  onChangeText={setSampleType}
                  placeholder="Water, Soil, etc."
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.fieldLabel}>Reporting unit</Text>
                <TextInput
                  style={styles.input}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="mg/L, ppm, %"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.fieldLabel}>Wait time (minutes)</Text>
                <TextInput
                  style={styles.input}
                  value={incubationMinutes}
                  onChangeText={setIncubationMinutes}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.fieldLabel}>Tolerance (seconds)</Text>
                <TextInput
                  style={styles.input}
                  value={incubationToleranceSecs}
                  onChangeText={setIncubationToleranceSecs}
                  keyboardType="numeric"
                  placeholder="60"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Description & notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe reaction mechanism, indicator chemistry, or targeted analyte..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sample requirements</Text>
              <TextInput
                style={styles.input}
                value={sampleRequirements}
                onChangeText={setSampleRequirements}
                placeholder="e.g. 10 mL fresh water sample in clean container"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* Card 2: Demonstration Video & Notes */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>Demonstration & Safety</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Procedure video URL (optional)</Text>
              <TextInput
                style={styles.input}
                value={videoUrl}
                onChangeText={setVideoUrl}
                placeholder="https://... video stream or MP4 URL"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Operator safety instructions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Wear safety glasses. Discard reacted solution responsibly according to protocol."
                placeholderTextColor="#94A3B8"
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
                  {step.tip && <Text style={styles.stepTipText}>Tip: {step.tip}</Text>}
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
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBottomBtnText}>
                {isEditing ? 'Save Changes' : 'Create Test & Continue to Standards'}
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
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  backText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  saveTopBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveTopBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
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
  inputReadonly: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
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
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  stepNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  stepInfoCol: {
    flex: 1,
  },
  stepTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepInstText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  stepTipText: {
    fontSize: 11,
    color: '#059669',
    marginTop: 4,
  },
  saveBottomBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  saveBottomBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 12,
  },
});
