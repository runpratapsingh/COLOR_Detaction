import React, { useState } from 'react';
import {
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
import { JalqTheme, DS } from '../../theme/colors';
import { UserRole, UserSession } from '../../types/jalq';
import { getApiBaseUrl, setCurrentUserRole } from '../../services/jalqApi';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
  onChangeServer?: () => void;
}

// Dedicated login credentials for client testing & production verification
interface PresetAccount {
  username: string;
  password: string;
  role: UserRole;
  name: string;
  facility: string;
  roleLabel: string;
}

const PRESET_ACCOUNTS: PresetAccount[] = [
  {
    username: 'engineer',
    password: 'tester123',
    role: 'TESTER',
    name: 'Test Engineer',
    facility: 'Water Testing Field Unit',
    roleLabel: 'Test Engineer',
  },
  {
    username: 'manager',
    password: 'manager123',
    role: 'TEST_MANAGER',
    name: 'Test Manager',
    facility: 'Central Standards & QA Lab',
    roleLabel: 'Test Manager',
  },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onChangeServer,
}) => {
  const [username, setUsername] = useState('engineer');
  const [password, setPassword] = useState('tester123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = () => {
    setErrorMessage(null);
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    // Check credentials against dedicated Test Engineer and Test Manager accounts
    const account = PRESET_ACCOUNTS.find(
      (acc) =>
        (acc.username === cleanUser ||
          (cleanUser === 'tester' && acc.username === 'engineer')) &&
        acc.password === cleanPass
    );

    if (account) {
      setCurrentUserRole(account.role);
      onLoginSuccess({
        technicianName: account.name,
        technicianId: account.role === 'TESTER' ? 'ENG-4091' : 'MGR-8012',
        facility: account.facility,
        role: account.role,
      });
    } else {
      setErrorMessage('Invalid username or password. Please check your credentials.');
    }
  };

  const handleApplyPreset = (acc: PresetAccount) => {
    setUsername(acc.username);
    setPassword(acc.password);
    setErrorMessage(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Brand Header ───────────────────────────────────────── */}
          <View style={styles.brandArea}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>💧</Text>
            </View>
            <Text style={styles.brandName}>JalQ</Text>
            <Text style={styles.brandTagline}>Chemical Liquid Color Analysis System</Text>
          </View>

          {/* ── Dynamic Server Configuration Pill ───────────────────── */}
          {onChangeServer && (
            <Pressable style={styles.serverPill} onPress={onChangeServer}>
              <View style={styles.serverStatusDot} />
              <Text style={styles.serverPillLabel}>Server:</Text>
              <Text style={styles.serverPillUrl} numberOfLines={1}>
                {getApiBaseUrl().replace(/\/api\/v1\/?$/, '')}
              </Text>
              <Text style={styles.serverPillAction}>Change ⚙️</Text>
            </Pressable>
          )}

          {/* ── Login Card ─────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardDesc}>
              Enter your credentials to access testing protocols and analysis.
            </Text>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Username Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter username (e.g. engineer or manager)"
                placeholderTextColor={JalqTheme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input with Visibility Toggle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter password"
                  placeholderTextColor={JalqTheme.colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
                </Pressable>
              </View>
            </View>

            {/* CTA Button */}
            <Pressable
              style={({ pressed }) => [
                styles.loginBtn,
                pressed && styles.loginBtnPressed,
              ]}
              onPress={handleLogin}>
              <Text style={styles.loginBtnText}>Sign In →</Text>
            </Pressable>

            {/* Quick Credentials Selection for Client Verification */}
            <View style={styles.quickPresetSection}>
              <Text style={styles.quickPresetTitle}>Quick Fill Credentials:</Text>
              <View style={styles.presetButtonsRow}>
                {PRESET_ACCOUNTS.map((acc) => {
                  const isSelected = username === acc.username;
                  return (
                    <Pressable
                      key={acc.username}
                      style={[
                        styles.presetChip,
                        isSelected && styles.presetChipActive,
                      ]}
                      onPress={() => handleApplyPreset(acc)}>
                      <Text
                        style={[
                          styles.presetChipText,
                          isSelected && styles.presetChipTextActive,
                        ]}>
                        {acc.role === 'TESTER' ? '🧪 Test Engineer' : '⚗️ Test Manager'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Discreet credentials helper hint */}
              <View style={styles.credentialsHintBox}>
                <Text style={styles.hintTitle}>Credential Reference:</Text>
                <Text style={styles.hintText}>
                  • Test Engineer: <Text style={styles.codeText}>engineer</Text> / <Text style={styles.codeText}>tester123</Text>
                </Text>
                <Text style={styles.hintText}>
                  • Test Manager: <Text style={styles.codeText}>manager</Text> / <Text style={styles.codeText}>manager123</Text>
                </Text>
              </View>
            </View>
          </View>
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
  scroll: {
    padding: JalqTheme.spacing.lg,
    paddingBottom: JalqTheme.spacing.xxxl,
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Brand
  brandArea: {
    alignItems: 'center',
    marginBottom: JalqTheme.spacing.xl,
    paddingTop: JalqTheme.spacing.md,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: JalqTheme.spacing.md,
    ...JalqTheme.shadow.sm,
  },
  logoIcon: { fontSize: 32 },
  brandName: {
    fontSize: 34,
    fontWeight: '800',
    color: JalqTheme.colors.primary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: JalqTheme.colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderRadius: JalqTheme.radius.xl,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    padding: JalqTheme.spacing.xl,
    ...JalqTheme.shadow.md,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: JalqTheme.colors.textSecondary,
    marginBottom: JalqTheme.spacing.lg,
    lineHeight: 18,
  },

  // Error Banner
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: JalqTheme.colors.badgeErrorBg,
    borderColor: JalqTheme.colors.badgeErrorBorder,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: JalqTheme.radius.md,
    marginBottom: JalqTheme.spacing.base,
    gap: 8,
  },
  errorIcon: { fontSize: 14 },
  errorText: {
    flex: 1,
    color: JalqTheme.colors.badgeErrorText,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },

  // Fields
  fieldGroup: { marginBottom: JalqTheme.spacing.base },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: JalqTheme.colors.bgInput,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
    borderRadius: JalqTheme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: JalqTheme.colors.textPrimary,
    fontSize: 14,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 46,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },

  // Login button
  loginBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingVertical: 14,
    borderRadius: JalqTheme.radius.lg,
    alignItems: 'center',
    marginTop: JalqTheme.spacing.sm,
    ...JalqTheme.shadow.cyan,
  },
  loginBtnPressed: {
    backgroundColor: JalqTheme.colors.primaryDark,
    transform: [{ scale: 0.99 }],
  },
  loginBtnText: {
    color: JalqTheme.colors.textInverse,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // Quick Preset section
  quickPresetSection: {
    marginTop: JalqTheme.spacing.xl,
    paddingTop: JalqTheme.spacing.base,
    borderTopWidth: 1,
    borderTopColor: JalqTheme.colors.borderSubtle,
  },
  quickPresetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: JalqTheme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: JalqTheme.radius.md,
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: JalqTheme.colors.primary,
    borderColor: JalqTheme.colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.primary,
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },

  // Hint box
  credentialsHintBox: {
    backgroundColor: '#F8FAFC',
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.sm,
    padding: 10,
    marginTop: 12,
    gap: 3,
  },
  hintTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: JalqTheme.colors.textSecondary,
    marginBottom: 2,
  },
  hintText: {
    fontSize: 11,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 16,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: JalqTheme.colors.primary,
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    maxWidth: '92%',
  },
  serverStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  serverPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 4,
  },
  serverPillUrl: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
    marginRight: 6,
  },
  serverPillAction: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
});

