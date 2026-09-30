import React, { useState } from 'react';
import {
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
import { UserRole, UserSession } from '../../types/jalq';
import { JALQ_API_BASE, setCurrentUserRole, setApiBaseUrl } from '../../services/jalqApi';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [techName, setTechName] = useState('Dr. Alex Chen');
  const [techId, setTechId] = useState('MGR-8012');
  const [facility, setFacility] = useState('JalQ Standards & Calibration Lab');
  const [selectedRole, setSelectedRole] = useState<UserRole>('TEST_MANAGER');
  const [showConfig, setShowConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(JALQ_API_BASE);

  const handleManualLogin = () => {
    if (!techName.trim()) return;
    setCurrentUserRole(selectedRole);
    onLoginSuccess({
      technicianName: techName.trim(),
      technicianId: techId.trim() || 'TECH-DEMO',
      facility: facility.trim() || 'JalQ Testing Facility',
      role: selectedRole,
    });
  };

  const handleQuickLogin = (role: UserRole, name: string, id: string, fac: string) => {
    setCurrentUserRole(role);
    onLoginSuccess({
      technicianName: name,
      technicianId: id,
      facility: fac,
      role: role,
    });
  };

  const handleSaveConfig = () => {
    setApiBaseUrl(serverUrl.trim());
    setShowConfig(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header Brand */}
          <View style={styles.header}>
            <Text style={styles.brandTitle}>JalQ</Text>
            <Text style={styles.brandSubtitle}>
              Liquid test reader and color analysis
            </Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardDesc}>
              Select your role to start testing or manage chemical standards.
            </Text>

            {/* Role Selection Segmented Control */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.roleSelectorRow}>
                <Pressable
                  style={[
                    styles.roleChip,
                    selectedRole === 'TESTER' && styles.roleChipActive,
                  ]}
                  onPress={() => setSelectedRole('TESTER')}>
                  <Text
                    style={[
                      styles.roleChipText,
                      selectedRole === 'TESTER' && styles.roleChipTextActive,
                    ]}>
                    Field Tester
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.roleChip,
                    selectedRole === 'TEST_MANAGER' && styles.roleChipActive,
                  ]}
                  onPress={() => setSelectedRole('TEST_MANAGER')}>
                  <Text
                    style={[
                      styles.roleChipText,
                      selectedRole === 'TEST_MANAGER' && styles.roleChipTextActive,
                    ]}>
                    Test Manager
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Your name</Text>
              <TextInput
                style={styles.input}
                value={techName}
                onChangeText={setTechName}
                placeholder="Enter your name"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Facility or testing site</Text>
              <TextInput
                style={styles.input}
                value={facility}
                onChangeText={setFacility}
                placeholder="Enter facility name"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <Pressable style={styles.primaryButton} onPress={handleManualLogin}>
              <Text style={styles.primaryButtonText}>
                {selectedRole === 'TEST_MANAGER'
                  ? 'Open Test Manager'
                  : 'Start Testing'}
              </Text>
            </Pressable>

            {/* Subtle Demo Quick Fills */}
            <View style={styles.quickFillRow}>
              <Text style={styles.quickFillLabel}>Quick fill:</Text>
              <Pressable
                onPress={() =>
                  handleQuickLogin(
                    'TESTER',
                    'Sam Rivera',
                    'TECH-4091',
                    'North River Testing Site',
                  )
                }>
                <Text style={styles.quickFillLink}>Tester</Text>
              </Pressable>
              <Text style={styles.quickFillDot}>•</Text>
              <Pressable
                onPress={() =>
                  handleQuickLogin(
                    'TEST_MANAGER',
                    'Dr. Alex Chen',
                    'MGR-8012',
                    'Standards Lab',
                  )
                }>
                <Text style={styles.quickFillLink}>Manager</Text>
              </Pressable>
            </View>
          </View>

          {/* Network / Server Config */}
          <View style={styles.configContainer}>
            <Pressable
              style={styles.configToggle}
              onPress={() => setShowConfig(!showConfig)}>
              <Text style={styles.configToggleText}>
                {showConfig ? 'Hide server settings' : 'Server settings'}
              </Text>
            </Pressable>

            {showConfig && (
              <View style={styles.configBox}>
                <Text style={styles.configLabel}>API Base URL</Text>
                <TextInput
                  style={styles.configInput}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable style={styles.configSaveBtn} onPress={handleSaveConfig}>
                  <Text style={styles.configSaveText}>Save URL</Text>
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
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  roleSelectorRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  roleChipActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  roleChipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  roleChipTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  quickFillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 8,
  },
  quickFillLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  quickFillLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  quickFillDot: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  configContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  configToggle: {
    padding: 8,
  },
  configToggleText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  configBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  configLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  configInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0F172A',
    fontSize: 13,
    marginBottom: 10,
  },
  configSaveBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  configSaveText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
});
