import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme, DS } from '../../theme/colors';
import { ChemicalTestSummary, UserSession } from '../../types/jalq';
import { fetchChemicalTests } from '../../services/jalqApi';
import { QRScannerModal } from '../QRScanner/QRScannerModal';

interface TestListScreenProps {
  session: UserSession;
  onSelectTest: (testId: string) => void;
  onLogout: () => void;
}

// Color accent per card index for visual variety
const CARD_ACCENTS = [
  JalqTheme.colors.primary,
  JalqTheme.colors.emerald,
  JalqTheme.colors.amber,
  '#8B5CF6', // purple
  '#EC4899', // pink
];

export const TestListScreen: React.FC<TestListScreenProps> = ({
  session,
  onSelectTest,
  onLogout,
}) => {
  const [tests, setTests] = useState<ChemicalTestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => { loadTests(); }, []);

  const loadTests = async () => {
    setLoading(true);
    const data = await fetchChemicalTests();
    setTests(data);
    setLoading(false);
  };

  // Avatar initials
  const initials = session.technicianName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const renderTestCard = ({ item, index }: { item: ChemicalTestSummary; index: number }) => {
    const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
    const incubMin = Math.round(item.incubation_seconds / 60);
    return (
      <Pressable
        style={({ pressed }) => [styles.testCard, pressed && styles.cardPressed]}
        onPress={() => onSelectTest(item.test_id)}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.testTitle}>{item.name}</Text>
              <Text style={[styles.testType, { color: accent }]}>
                {item.sample_type} · {item.unit}
              </Text>
            </View>
            <View style={styles.chevronCircle}>
              <Text style={styles.chevron}>›</Text>
            </View>
          </View>

          {item.description ? (
            <Text style={styles.testDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>⏱ {incubMin} min</Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>📊 {item.standards_count} standards</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={JalqTheme.colors.bgDeep} />

      {/* ── Top Header Bar ──────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.techName}>{session.technicianName}</Text>
            <Text style={styles.facilityText}>{session.facility}</Text>
          </View>
        </View>
        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* ── Section Header ──────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Available Tests</Text>
          <Text style={styles.sectionSub}>Select a test protocol to begin</Text>
        </View>
        <Pressable style={styles.qrBtn} onPress={() => setShowQrModal(true)}>
          <Text style={styles.qrBtnText}>📷 Scan Kit</Text>
        </Pressable>
      </View>

      {/* ── List ────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading protocols...</Text>
        </View>
      ) : tests.length === 0 ? (
        <View style={styles.loadingCenter}>
          <Text style={styles.emptyIcon}>🧪</Text>
          <Text style={styles.emptyTitle}>No Tests Configured</Text>
          <Text style={styles.emptyDesc}>Add chemical tests via the Test Manager panel.</Text>
        </View>
      ) : (
        <FlatList
          data={tests}
          keyExtractor={(item) => item.test_id}
          renderItem={renderTestCard}
          contentContainerStyle={styles.listContent}
          onRefresh={loadTests}
          refreshing={loading}
          showsVerticalScrollIndicator={false}
        />
      )}

      <QRScannerModal
        visible={showQrModal}
        onClose={() => setShowQrModal(false)}
        onTestIdentified={(testId) => onSelectTest(testId)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: JalqTheme.colors.bgDark },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: JalqTheme.spacing.lg,
    paddingVertical: JalqTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: JalqTheme.colors.borderSubtle,
    backgroundColor: JalqTheme.colors.bgCard,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: JalqTheme.spacing.md },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderWidth: 1.5,
    borderColor: JalqTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: JalqTheme.colors.primary },
  techName: { fontSize: 14, fontWeight: '700', color: JalqTheme.colors.textPrimary },
  facilityText: { fontSize: 11, color: JalqTheme.colors.textSecondary, marginTop: 1 },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: JalqTheme.radius.md,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
  },
  logoutText: { fontSize: 12, fontWeight: '600', color: JalqTheme.colors.textSecondary },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: JalqTheme.spacing.lg,
    paddingTop: JalqTheme.spacing.lg,
    paddingBottom: JalqTheme.spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: JalqTheme.colors.textPrimary },
  sectionSub: { fontSize: 12, color: JalqTheme.colors.textSecondary, marginTop: 2 },
  qrBtn: {
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderFocus,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: JalqTheme.radius.md,
  },
  qrBtnText: { color: JalqTheme.colors.primary, fontSize: 12, fontWeight: '700' },

  // List
  listContent: {
    paddingHorizontal: JalqTheme.spacing.lg,
    paddingBottom: JalqTheme.spacing.xxl,
    gap: JalqTheme.spacing.md,
  },

  // Test card
  testCard: {
    flexDirection: 'row',
    backgroundColor: JalqTheme.colors.bgCard,
    borderRadius: JalqTheme.radius.lg,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    overflow: 'hidden',
    ...JalqTheme.shadow.sm,
  },
  cardPressed: { opacity: 0.75 },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: JalqTheme.spacing.base },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  testTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  testType: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: JalqTheme.colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: { fontSize: 18, color: JalqTheme.colors.textSecondary, marginTop: -1 },
  testDesc: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: JalqTheme.radius.pill,
    backgroundColor: JalqTheme.colors.bgMuted,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
  },
  metaBadgeText: { fontSize: 10, fontWeight: '600', color: JalqTheme.colors.textSecondary },

  // Empty / loading
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: { color: JalqTheme.colors.textSecondary, fontSize: 13, marginTop: 8 },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: JalqTheme.colors.textPrimary },
  emptyDesc: { fontSize: 13, color: JalqTheme.colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
});
