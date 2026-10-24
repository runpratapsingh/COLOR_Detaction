import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JalqTheme } from '../../theme/colors';
import {
  getApiBaseUrl,
  setApiBaseUrl,
  testServerConnection,
} from '../../services/jalqApi';

interface ServerConfigScreenProps {
  onContinue: () => void;
}

interface QuickPreset {
  id: string;
  label: string;
  icon: string;
  url: string;
  description: string;
}

const PRESETS: QuickPreset[] = [
  {
    id: 'cloud',
    label: 'AWS EC2 (Production)',
    icon: '☁️',
    url: 'http://100.59.196.14:8000',
    description: 'Hosted on Amazon Linux 2023 EC2',
  },
  {
    id: 'render',
    label: 'Render Cloud Backend',
    icon: '🚀',
    url: 'https://chemical-cv-service.onrender.com',
    description: 'Render Cloud deployment endpoint',
  },
  {
    id: 'vscode',
    label: 'VS Code Port Forwarding',
    icon: '⚡',
    url: 'https://',
    description: 'Paste your VS Code public port forwarded URL',
  },
  {
    id: 'emulator',
    label: 'Android Emulator',
    icon: '💻',
    url: 'http://10.0.2.2:8000',
    description: 'Localhost alias for Android AVD',
  },
  {
    id: 'lan',
    label: 'Local Wi-Fi Network',
    icon: '🏠',
    url: 'http://192.168.1.100:8000',
    description: 'Direct IP on same Wi-Fi network',
  },
];

export const ServerConfigScreen: React.FC<ServerConfigScreenProps> = ({
  onContinue,
}) => {
  const currentBase = getApiBaseUrl().replace(/\/api\/v1\/?$/, '');
  const [urlInput, setUrlInput] = useState(currentBase);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    version?: string;
  } | null>(null);

  const handleTestConnection = async () => {
    if (!urlInput.trim()) {
      setTestResult({
        success: false,
        message: 'Please enter a valid server URL.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const result = await testServerConnection(urlInput);
    setTesting(false);
    setTestResult({
      success: result.success,
      message: result.message,
      latencyMs: result.latencyMs,
      version: result.version,
    });
  };

  const handleApplyPreset = (preset: QuickPreset) => {
    if (preset.id === 'vscode') {
      if (urlInput.includes('.app.github.dev')) {
        // already has a github url, keep it
      } else {
        setUrlInput('https://');
      }
    } else {
      setUrlInput(preset.url);
    }
    setTestResult(null);
  };

  const handleSaveAndContinue = () => {
    if (urlInput.trim()) {
      setApiBaseUrl(urlInput.trim());
    }
    onContinue();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>NETWORK SETUP</Text>
            </View>
            <Text style={styles.title}>Dynamic Server URL</Text>
            <Text style={styles.subtitle}>
              Configure the backend endpoint for your testing environment. Supports VS Code port forwarding, ngrok, or local network.
            </Text>
          </View>

          {/* Current Active Target Card */}
          <View style={styles.activeCard}>
            <View style={styles.activeHeaderRow}>
              <View style={styles.statusDot} />
              <Text style={styles.activeLabel}>ACTIVE ENDPOINT</Text>
            </View>
            <Text style={styles.activeUrl} numberOfLines={1}>
              {getApiBaseUrl()}
            </Text>
          </View>

          {/* URL Input Form */}
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>SERVER BASE URL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={urlInput}
                onChangeText={(text) => {
                  setUrlInput(text);
                  setTestResult(null);
                }}
                placeholder="https://xxxx-8000.app.github.dev"
                placeholderTextColor={JalqTheme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {urlInput.length > 0 && (
                <Pressable
                  style={styles.clearBtn}
                  onPress={() => {
                    setUrlInput('');
                    setTestResult(null);
                  }}>
                  <Text style={styles.clearBtnText}>✕</Text>
                </Pressable>
              )}
            </View>

            {/* Test Connection Button */}
            <Pressable
              style={[styles.testBtn, testing && styles.testBtnDisabled]}
              onPress={handleTestConnection}
              disabled={testing}>
              {testing ? (
                <View style={styles.testBtnLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.testBtnText}>Testing Reachability...</Text>
                </View>
              ) : (
                <Text style={styles.testBtnText}>⚡ Test Connection</Text>
              )}
            </Pressable>

            {/* Test Result Feedback Banner */}
            {testResult && (
              <View
                style={[
                  styles.resultBanner,
                  testResult.success ? styles.resultSuccess : styles.resultError,
                ]}>
                <Text
                  style={[
                    styles.resultTitle,
                    testResult.success
                      ? styles.resultSuccessTitle
                      : styles.resultErrorTitle,
                  ]}>
                  {testResult.success ? '✓ Server Reachable' : '✗ Connection Failed'}
                </Text>
                <Text
                  style={[
                    styles.resultMessage,
                    testResult.success
                      ? styles.resultSuccessMessage
                      : styles.resultErrorMessage,
                  ]}>
                  {testResult.message}
                </Text>
                {testResult.latencyMs !== undefined && (
                  <Text style={styles.resultMeta}>
                    Roundtrip Latency: {testResult.latencyMs} ms
                    {testResult.version ? ` • API ${testResult.version}` : ''}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Quick Preset Buttons */}
          <View style={styles.presetsSection}>
            <Text style={styles.presetsHeader}>QUICK PRESETS</Text>
            {PRESETS.map((preset) => {
              const isActive =
                urlInput.replace(/\/+$/, '') === preset.url.replace(/\/+$/, '') ||
                (preset.id === 'vscode' && urlInput.includes('.app.github.dev'));

              return (
                <Pressable
                  key={preset.id}
                  style={[styles.presetCard, isActive && styles.presetCardActive]}
                  onPress={() => handleApplyPreset(preset)}>
                  <View style={styles.presetIconContainer}>
                    <Text style={styles.presetIcon}>{preset.icon}</Text>
                  </View>
                  <View style={styles.presetContent}>
                    <Text style={styles.presetLabel}>{preset.label}</Text>
                    <Text style={styles.presetDesc}>{preset.description}</Text>
                  </View>
                  {isActive && <Text style={styles.presetActiveCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </View>

          {/* VS Code Port Forwarding Instructions Card */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>💡 VS Code Port Forwarding Guide</Text>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNum}>1.</Text>
              <Text style={styles.stepText}>
                In VS Code, run your backend:
                {'\n'}
                <Text style={styles.codeText}>uvicorn app.main:app --host 0.0.0.0 --port 8000</Text>
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNum}>2.</Text>
              <Text style={styles.stepText}>
                Open the <Text style={styles.boldText}>Ports</Text> tab in VS Code and forward port <Text style={styles.boldText}>8000</Text>.
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNum}>3.</Text>
              <Text style={styles.stepText}>
                <Text style={styles.warningText}>CRUCIAL:</Text> Right-click Port 8000 → <Text style={styles.boldText}>Port Visibility → Public</Text>.
                (If private, GitHub blocks mobile app requests with a login redirect).
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <Text style={styles.stepNum}>4.</Text>
              <Text style={styles.stepText}>
                Copy the <Text style={styles.boldText}>Forwarded Address</Text> (e.g. <Text style={styles.codeText}>https://xxxx-8000.app.github.dev</Text>) and paste it above.
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={styles.continueBtn}
              onPress={handleSaveAndContinue}>
              <Text style={styles.continueBtnText}>Connect & Continue to App ›</Text>
            </Pressable>

            <Pressable
              style={styles.skipBtn}
              onPress={onContinue}>
              <Text style={styles.skipBtnText}>Skip to Login Screen</Text>
            </Pressable>
          </View>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 20,
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  tagText: {
    color: JalqTheme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  activeCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    ...JalqTheme.shadow.sm,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  activeUrl: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    marginBottom: 20,
    ...JalqTheme.shadow.sm,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  testBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnDisabled: {
    opacity: 0.7,
  },
  testBtnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  resultBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  resultError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  resultSuccessTitle: {
    color: '#065F46',
  },
  resultErrorTitle: {
    color: '#991B1B',
  },
  resultMessage: {
    fontSize: 11,
    lineHeight: 16,
  },
  resultSuccessMessage: {
    color: '#047857',
  },
  resultErrorMessage: {
    color: '#B91C1C',
  },
  resultMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: '#047857',
    marginTop: 6,
  },
  presetsSection: {
    marginBottom: 20,
  },
  presetsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 10,
    letterSpacing: 0.6,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    ...JalqTheme.shadow.sm,
  },
  presetCardActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  presetIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  presetIcon: {
    fontSize: 18,
  },
  presetContent: {
    flex: 1,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  presetDesc: {
    fontSize: 11,
    color: '#64748B',
  },
  presetActiveCheck: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284C7',
    marginLeft: 8,
  },
  instructionsCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 10,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
    width: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  boldText: {
    fontWeight: '700',
  },
  warningText: {
    fontWeight: '800',
    color: '#B91C1C',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    color: '#1E293B',
    backgroundColor: '#FEF3C7',
  },
  actions: {
    gap: 10,
  },
  continueBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    ...JalqTheme.shadow.md,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
