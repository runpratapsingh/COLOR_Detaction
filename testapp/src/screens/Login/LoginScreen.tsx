import React, { useState } from 'react';
import {
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
import { UserRole, UserSession } from '../../types/jalq';
import { JALQ_API_BASE, setCurrentUserRole, setApiBaseUrl } from '../../services/jalqApi';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [techName, setTechName] = useState('');
  const [facility, setFacility] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('TESTER');
  const [showConfig, setShowConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(JALQ_API_BASE);

  const handleLogin = () => {
    if (!techName.trim()) return;
    setCurrentUserRole(selectedRole);
    onLoginSuccess({
      technicianName: techName.trim(),
      technicianId: `TECH-${Date.now().toString().slice(-4)}`,
      facility: facility.trim() || 'Field Site',
      role: selectedRole,
    });
  };

  const handleQuickLogin = (role: UserRole, name: string, id: string, fac: string) => {
    setCurrentUserRole(role);
    onLoginSuccess({ technicianName: name, technicianId: id, facility: fac, role });
  };

  const handleSaveConfig = () => {
    setApiBaseUrl(serverUrl.trim());
    setShowConfig(false);
  };

  const canLogin = techName.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={JalqTheme.colors.bgDeep} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Brand Header ───────────────────────────────────────── */}
          <View style={styles.brandArea}>
            {/* Logo Icon */}
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>💧</Text>
            </View>
            <Text style={styles.brandName}>JalQ</Text>
            <Text style={styles.brandTagline}>Chemical Liquid Color Analysis</Text>
            {/* Version badge */}
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>FIELD EDITION • v1.0</Text>
            </View>
          </View>

          {/* ── Login Card ─────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardDesc}>Select your role and enter your details to begin.</Text>

            {/* Role Segmented Control */}
            <View style={styles.fieldGroup}>
              <Text style={DS.fieldLabel}>Your role</Text>
              <View style={styles.segmentedControl}>
                {(['TESTER', 'TEST_MANAGER'] as UserRole[]).map((role) => {
                  const active = selectedRole === role;
                  return (
                    <Pressable
                      key={role}
                      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                      onPress={() => setSelectedRole(role)}>
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {role === 'TESTER' ? '🧪 Field Tester' : '⚗️ Test Manager'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={DS.fieldLabel}>Your name</Text>
              <TextInput
                style={styles.input}
                value={techName}
                onChangeText={setTechName}
                placeholder="Enter your name"
                placeholderTextColor={JalqTheme.colors.textMuted}
              />
            </View>

            {/* Facility */}
            <View style={styles.fieldGroup}>
              <Text style={DS.fieldLabel}>Facility / site</Text>
              <TextInput
                style={styles.input}
                value={facility}
                onChangeText={setFacility}
                placeholder="e.g. North River Testing Site"
                placeholderTextColor={JalqTheme.colors.textMuted}
              />
            </View>

            {/* CTA Button */}
            <Pressable
              style={[styles.loginBtn, !canLogin && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={!canLogin}>
              <Text style={styles.loginBtnText}>
                {selectedRole === 'TEST_MANAGER' ? 'Open Test Manager →' : 'Start Testing →'}
              </Text>
            </Pressable>

            {/* Quick Fill */}
            <View style={styles.quickRow}>
              <Text style={styles.quickLabel}>Quick demo:</Text>
              <Pressable onPress={() => handleQuickLogin('TESTER', 'Sam Rivera', 'TECH-4091', 'North River Site')}>
                <Text style={styles.quickLink}>Tester</Text>
              </Pressable>
              <Text style={styles.quickDot}>·</Text>
              <Pressable onPress={() => handleQuickLogin('TEST_MANAGER', 'Dr. Alex Chen', 'MGR-8012', 'Standards Lab')}>
                <Text style={styles.quickLink}>Manager</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Server Config ──────────────────────────────────────── */}
          <View style={styles.configArea}>
            <Pressable style={styles.configToggle} onPress={() => setShowConfig(!showConfig)}>
              <Text style={styles.configToggleText}>⚙️  Server settings</Text>
              <Text style={styles.configChevron}>{showConfig ? '▲' : '▼'}</Text>
            </Pressable>

            {showConfig && (
              <View style={styles.configBox}>
                <Text style={DS.fieldLabel}>API Base URL</Text>
                <TextInput
                  style={[styles.input, styles.configInput]}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={JalqTheme.colors.textMuted}
                />
                <Pressable style={styles.saveBtn} onPress={handleSaveConfig}>
                  <Text style={styles.saveBtnText}>Save URL</Text>
                </Pressable>
              </View>
            )}
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
    marginBottom: JalqTheme.spacing.xxl,
    paddingTop: JalqTheme.spacing.xl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderWidth: 1.5,
    borderColor: JalqTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: JalqTheme.spacing.md,
    ...JalqTheme.shadow.cyan,
  },
  logoIcon: { fontSize: 32 },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
    letterSpacing: -1,
  },
  brandTagline: {
    fontSize: 13,
    color: JalqTheme.colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  versionBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: JalqTheme.radius.pill,
    backgroundColor: JalqTheme.colors.badgeInfoBg,
    borderWidth: 1,
    borderColor: JalqTheme.colors.badgeInfoBorder,
  },
  versionText: {
    fontSize: 9,
    fontWeight: '700',
    color: JalqTheme.colors.badgeInfoText,
    letterSpacing: 1,
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
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: JalqTheme.colors.textSecondary,
    marginBottom: JalqTheme.spacing.xl,
    lineHeight: 18,
  },

  // Fields
  fieldGroup: { marginBottom: JalqTheme.spacing.base },
  input: {
    backgroundColor: JalqTheme.colors.bgInput,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
    borderRadius: JalqTheme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: JalqTheme.colors.textPrimary,
    fontSize: 14,
  },

  // Segmented control
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: JalqTheme.colors.bgInput,
    borderRadius: JalqTheme.radius.md,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: JalqTheme.radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: JalqTheme.colors.primary,
    ...JalqTheme.shadow.cyan,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: JalqTheme.colors.textMuted,
  },
  segmentTextActive: {
    color: JalqTheme.colors.textInverse,
    fontWeight: '700',
  },

  // Login button
  loginBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingVertical: 15,
    borderRadius: JalqTheme.radius.lg,
    alignItems: 'center',
    marginTop: JalqTheme.spacing.sm,
    ...JalqTheme.shadow.cyan,
  },
  loginBtnDisabled: {
    backgroundColor: JalqTheme.colors.bgMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  loginBtnText: {
    color: JalqTheme.colors.textInverse,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // Quick fill
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: JalqTheme.spacing.base,
    gap: 6,
  },
  quickLabel: { fontSize: 12, color: JalqTheme.colors.textMuted },
  quickLink: { fontSize: 12, fontWeight: '600', color: JalqTheme.colors.primary },
  quickDot: { color: JalqTheme.colors.textMuted },

  // Server config
  configArea: { marginTop: JalqTheme.spacing.lg },
  configToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: JalqTheme.spacing.sm,
    gap: 6,
  },
  configToggleText: { fontSize: 12, color: JalqTheme.colors.textMuted },
  configChevron: { fontSize: 10, color: JalqTheme.colors.textMuted },
  configBox: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderRadius: JalqTheme.radius.lg,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    padding: JalqTheme.spacing.base,
    marginTop: JalqTheme.spacing.sm,
  },
  configInput: { marginBottom: JalqTheme.spacing.md, fontSize: 12 },
  saveBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingVertical: 10,
    borderRadius: JalqTheme.radius.md,
    alignItems: 'center',
  },
  saveBtnText: { color: JalqTheme.colors.textInverse, fontWeight: '700', fontSize: 13 },
});
