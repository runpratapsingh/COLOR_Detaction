import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { createNewTestVersion, fetchChemicalTests, publishChemicalTest } from '../../services/jalqApi';

interface TestManagerDashboardScreenProps {
  session: UserSession;
  onCreateTest: () => void;
  onEditTest: (testId: string) => void;
  onManageStandards: (testId: string) => void;
  onPreviewAsTester: (testId: string) => void;
  onSwitchToTesterMode: () => void;
  onLogout: () => void;
}

export const TestManagerDashboardScreen: React.FC<TestManagerDashboardScreenProps> = ({
  session,
  onCreateTest,
  onEditTest,
  onManageStandards,
  onPreviewAsTester,
  onSwitchToTesterMode,
  onLogout,
}) => {
  const [tests, setTests] = useState<ChemicalTestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PUBLISHED'>('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const loadTests = useCallback(async () => {
    setLoading(true);
    const filter = statusFilter === 'ALL' ? undefined : statusFilter;
    try {
      const data = await fetchChemicalTests(filter, session.role);
      if (isMountedRef.current) {
        setTests(data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.warn('Failed to load tests:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [statusFilter, session.role]);

  useEffect(() => {
    isMountedRef.current = true;
    loadTests();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadTests]);

  const handlePublish = async (testId: string) => {
    Alert.alert(
      'Publish Chemical Test',
      `Are you sure you want to publish '${testId}'? Its reference standards will become immutable for active field testers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish Now',
          style: 'default',
          onPress: async () => {
            try {
              setActionLoadingId(testId);
              await publishChemicalTest(testId, session.role);
              await loadTests();
              Alert.alert('Test Published', `Test '${testId}' is now live and available to field testers.`);
            } catch (err: any) {
              Alert.alert('Publish Error', err.message || 'Failed to publish test.');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const handleNewVersion = async (testId: string) => {
    Alert.alert(
      'Create New Version',
      `Create a new revision of '${testId}'? The current published version will remain frozen for historical records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Version',
          onPress: async () => {
            try {
              setActionLoadingId(testId);
              const updated = await createNewTestVersion(testId, session.role);
              await loadTests();
              Alert.alert('New Version Created', `Version ${updated.version} created in DRAFT state.`);
            } catch (err: any) {
              Alert.alert('Version Error', err.message || 'Failed to create new version.');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const renderTestCard = ({ item }: { item: ChemicalTestSummary }) => {
    const isPublished = item.status === 'PUBLISHED';
    const isDraft = item.status === 'DRAFT';
    const isBusy = actionLoadingId === item.test_id;

    return (
      <View style={styles.testCard}>
        {/* Top Header Row */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.testTitleCol}>
            <Text style={styles.testTitle}>{item.name}</Text>
            <Text style={styles.testSubtitle}>
              {item.sample_type} • {item.unit} • v{item.version}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isPublished ? styles.statusPublished : styles.statusDraft,
            ]}>
            <Text
              style={[
                styles.statusBadgeText,
                isPublished ? styles.textPublished : styles.textDraft,
              ]}>
              {isPublished ? '● Published' : '○ Draft'}
            </Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.testDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Specs Overview */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            ⏱ Wait: {Math.round(item.incubation_seconds / 60)} min
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>
            📊 {item.standards_count} standards
          </Text>
        </View>

        {/* Main Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.standardsBtn}
            onPress={() => onManageStandards(item.test_id)}>
            <Text style={styles.standardsBtnText}>
              Manage Standards ({item.standards_count})
            </Text>
          </Pressable>

          <Pressable
            style={styles.editBtn}
            onPress={() => onEditTest(item.test_id)}>
            <Text style={styles.editBtnText}>Edit Details</Text>
          </Pressable>
        </View>

        {/* Secondary Workflow Row */}
        <View style={styles.secondaryActionRow}>
          {isDraft ? (
            <Pressable
              style={[styles.publishLinkBtn, isBusy && styles.btnDisabled]}
              disabled={isBusy}
              onPress={() => handlePublish(item.test_id)}>
              {isBusy ? (
                <ActivityIndicator size="small" color={JalqTheme.colors.emerald} />
              ) : (
                <Text style={styles.publishLinkText}>✓ Publish Live</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.newVersionLinkBtn, isBusy && styles.btnDisabled]}
              disabled={isBusy}
              onPress={() => handleNewVersion(item.test_id)}>
              <Text style={styles.newVersionLinkText}>+ New Revision</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.previewLinkBtn}
            onPress={() => onPreviewAsTester(item.test_id)}>
            <Text style={styles.previewLinkText}>Tester Preview ›</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={JalqTheme.colors.bgDeep} />

      {/* Top Manager Banner */}
      <View style={styles.topBar}>
        <View>
          <View style={styles.roleHeaderRow}>
            <Text style={styles.roleTag}>TEST MANAGER CONSOLE</Text>
          </View>
          <Text style={styles.techName}>{session.technicianName}</Text>
          <Text style={styles.facilityText}>{session.facility}</Text>
        </View>

        <View style={styles.topActionsRow}>
          <Pressable style={styles.switchModeBtn} onPress={onSwitchToTesterMode}>
            <Text style={styles.switchModeText}>Field Tester</Text>
          </Pressable>
          <Pressable style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      {/* Action Header Banner */}
      <View style={styles.actionHeader}>
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, statusFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setStatusFilter('ALL')}>
            <Text style={[styles.filterChipText, statusFilter === 'ALL' && styles.filterChipTextActive]}>
              All ({tests.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, statusFilter === 'DRAFT' && styles.filterChipActive]}
            onPress={() => setStatusFilter('DRAFT')}>
            <Text style={[styles.filterChipText, statusFilter === 'DRAFT' && styles.filterChipTextActive]}>
              Drafts
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, statusFilter === 'PUBLISHED' && styles.filterChipActive]}
            onPress={() => setStatusFilter('PUBLISHED')}>
            <Text style={[styles.filterChipText, statusFilter === 'PUBLISHED' && styles.filterChipTextActive]}>
              Published
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.createTestBtn} onPress={onCreateTest}>
          <Text style={styles.createTestBtnText}>+ New Test</Text>
        </Pressable>
      </View>

      {/* Tests Catalog List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading tests...</Text>
        </View>
      ) : (
        <FlatList
          data={tests}
          keyExtractor={(item) => item.test_id}
          renderItem={renderTestCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🧪</Text>
              <Text style={styles.emptyTitle}>No chemical tests found</Text>
              <Text style={styles.emptyDesc}>
                Create your first chemical assay and configure calibrated reference standards.
              </Text>
              <Pressable style={styles.createTestEmptyBtn} onPress={onCreateTest}>
                <Text style={styles.createTestEmptyBtnText}>+ Create New Chemical Test</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgDark,
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
  roleHeaderRow: {
    marginBottom: 2,
  },
  roleTag: {
    color: JalqTheme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  techName: {
    fontSize: 15,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  facilityText: {
    fontSize: 11,
    color: JalqTheme.colors.textSecondary,
    marginTop: 2,
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  switchModeBtn: {
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderColor: JalqTheme.colors.borderFocus,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: JalqTheme.radius.md,
  },
  switchModeText: {
    color: JalqTheme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: JalqTheme.colors.bgMuted,
    borderColor: JalqTheme.colors.borderDefault,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: JalqTheme.radius.md,
  },
  logoutText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: JalqTheme.spacing.base,
    paddingVertical: JalqTheme.spacing.md,
    borderBottomColor: JalqTheme.colors.borderSubtle,
    borderBottomWidth: 1,
    backgroundColor: JalqTheme.colors.bgCard,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: JalqTheme.radius.pill,
    backgroundColor: JalqTheme.colors.bgInput,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderColor: JalqTheme.colors.borderFocus,
  },
  filterChipText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: JalqTheme.colors.primary,
    fontWeight: '700',
  },
  createTestBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: JalqTheme.radius.md,
  },
  createTestBtnText: {
    color: JalqTheme.colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: JalqTheme.spacing.base,
    gap: JalqTheme.spacing.md,
    paddingBottom: 32,
  },
  testCard: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.lg,
    padding: JalqTheme.spacing.base,
    ...JalqTheme.shadow.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  testTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  testSubtitle: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: JalqTheme.radius.pill,
    borderWidth: 1,
  },
  statusPublished: {
    backgroundColor: JalqTheme.colors.badgeSuccessBg,
    borderColor: JalqTheme.colors.badgeSuccessBorder,
  },
  statusDraft: {
    backgroundColor: JalqTheme.colors.badgeWarningBg,
    borderColor: JalqTheme.colors.badgeWarningBorder,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textPublished: {
    color: JalqTheme.colors.badgeSuccessText,
  },
  textDraft: {
    color: JalqTheme.colors.badgeWarningText,
  },
  testDesc: {
    fontSize: 13,
    color: JalqTheme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: JalqTheme.colors.textMuted,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 12,
    color: JalqTheme.colors.borderDefault,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  standardsBtn: {
    flex: 1,
    backgroundColor: JalqTheme.colors.primary,
    paddingVertical: 10,
    borderRadius: JalqTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardsBtnText: {
    color: JalqTheme.colors.textInverse,
    fontWeight: '700',
    fontSize: 13,
  },
  editBtn: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgInput,
    borderColor: JalqTheme.colors.borderDefault,
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: JalqTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    color: JalqTheme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: JalqTheme.colors.borderSubtle,
  },
  publishLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  publishLinkText: {
    color: JalqTheme.colors.emerald,
    fontWeight: '700',
    fontSize: 12,
  },
  newVersionLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  newVersionLinkText: {
    color: JalqTheme.colors.amber,
    fontWeight: '700',
    fontSize: 12,
  },
  previewLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  previewLinkText: {
    color: JalqTheme.colors.primary,
    fontWeight: '600',
    fontSize: 12,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 13,
    color: JalqTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  createTestEmptyBtn: {
    ...DS.primaryBtn,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  createTestEmptyBtnText: {
    ...DS.primaryBtnText,
  },
});
