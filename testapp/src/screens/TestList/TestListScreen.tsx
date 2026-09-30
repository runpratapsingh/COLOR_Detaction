import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme } from '../../theme/colors';
import { ChemicalTestSummary, UserSession } from '../../types/jalq';
import { fetchChemicalTests } from '../../services/jalqApi';
import { QRScannerModal } from '../QRScanner/QRScannerModal';

interface TestListScreenProps {
  session: UserSession;
  onSelectTest: (testId: string) => void;
  onLogout: () => void;
}

export const TestListScreen: React.FC<TestListScreenProps> = ({
  session,
  onSelectTest,
  onLogout,
}) => {
  const [tests, setTests] = useState<ChemicalTestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    setLoading(true);
    const data = await fetchChemicalTests();
    setTests(data);
    setLoading(false);
  };

  const renderTestCard = ({ item }: { item: ChemicalTestSummary }) => (
    <Pressable
      style={({ pressed }) => [styles.testCard, pressed && styles.cardPressed]}
      onPress={() => onSelectTest(item.test_id)}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.testTitleCol}>
          <Text style={styles.testTitle}>{item.name}</Text>
          <Text style={styles.testSubtitle}>{item.sample_type} • {item.unit}</Text>
        </View>
        <Text style={styles.cardChevron}>›</Text>
      </View>

      {item.description ? (
        <Text style={styles.testDesc} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {Math.round(item.incubation_seconds / 60)} min wait time
        </Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.metaText}>
          {item.standards_count} reference standards
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Session Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarInfo}>
          <Text style={styles.techName}>{session.technicianName}</Text>
          <Text style={styles.facilityText}>{session.facility}</Text>
        </View>
        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* Action Bar */}
      <View style={styles.actionsBar}>
        <View style={styles.headingCol}>
          <Text style={styles.sectionHeading}>Available Tests</Text>
          <Text style={styles.sectionSub}>Select a test to begin</Text>
        </View>
        <Pressable style={styles.scanQrBtn} onPress={() => setShowQrModal(true)}>
          <Text style={styles.scanQrText}>Scan Kit QR</Text>
        </Pressable>
      </View>

      {/* Tests List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Loading tests...</Text>
        </View>
      ) : (
        <FlatList
          data={tests}
          keyExtractor={(item) => item.test_id}
          renderItem={renderTestCard}
          contentContainerStyle={styles.listContent}
          onRefresh={loadTests}
          refreshing={loading}
        />
      )}

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showQrModal}
        onClose={() => setShowQrModal(false)}
        onTestIdentified={(testId) => {
          onSelectTest(testId);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  topBarInfo: {
    flex: 1,
  },
  techName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  facilityText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headingCol: {
    flex: 1,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  scanQrBtn: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanQrText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  testCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.85,
    backgroundColor: '#F8FAFC',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  testTitleCol: {
    flex: 1,
    paddingRight: 8,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  testSubtitle: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '500',
    marginTop: 2,
  },
  cardChevron: {
    fontSize: 22,
    fontWeight: '300',
    color: '#94A3B8',
  },
  testDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  metaDot: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 13,
  },
});
