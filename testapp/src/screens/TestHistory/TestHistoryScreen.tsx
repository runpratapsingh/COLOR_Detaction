import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { JalqTheme } from '../../theme/colors';
import { PerformedTestHistoryItem, UserSession } from '../../types/jalq';
import {
  clearAllTestHistory,
  deleteTestHistoryItem,
  fetchTestHistory,
} from '../../services/jalqApi';
import { HeaderBackButton } from '../../components';

interface TestHistoryScreenProps {
  session: UserSession;
  onBack: () => void;
}

const PAGE_SIZE = 20;

export const TestHistoryScreen: React.FC<TestHistoryScreenProps> = ({
  session,
  onBack,
}) => {
  const [history, setHistory] = useState<PerformedTestHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [selectedTest, setSelectedTest] = useState<PerformedTestHistoryItem | null>(null);

  const isMountedRef = useRef(true);

  const sortByNewest = (items: PerformedTestHistoryItem[]): PerformedTestHistoryItem[] => {
    return [...items].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  };

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetchTestHistory(undefined, PAGE_SIZE, 0);
      if (isMountedRef.current) {
        const sorted = sortByNewest(res.items);
        setHistory(sorted);
        setTotalCount(res.total);
        setHasMore(sorted.length < res.total);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn('Failed to load test history:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const currentOffset = history.length;
      const res = await fetchTestHistory(undefined, PAGE_SIZE, currentOffset);

      if (isMountedRef.current) {
        if (!res.items || res.items.length === 0) {
          setHasMore(false);
        } else {
          setHistory((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newItems = res.items.filter((i) => !existingIds.has(i.id));
            const combined = [...prev, ...newItems];
            return sortByNewest(combined);
          });
          setTotalCount(res.total);
          setHasMore(history.length + res.items.length < res.total);
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn('Failed to load more test history:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingMore(false);
      }
    }
  }, [loading, refreshing, loadingMore, hasMore, history.length]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      loadHistory();
      return () => {
        isMountedRef.current = false;
      };
    }, [loadHistory])
  );

  const handleDelete = (item: PerformedTestHistoryItem) => {
    Alert.alert(
      'Delete Record',
      `Delete this test record for ${item.test_name || item.test_id || 'Sample'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(item.id);
              await deleteTestHistoryItem(item.id);
              if (isMountedRef.current) {
                setHistory((prev) => prev.filter((h) => h.id !== item.id));
                setTotalCount((prev) => Math.max(0, prev - 1));
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete history record.');
            } finally {
              if (isMountedRef.current) {
                setDeletingId(null);
              }
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all performed test history records from the database? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearingAll(true);
              await clearAllTestHistory();
              if (isMountedRef.current) {
                setHistory([]);
                setTotalCount(0);
                setHasMore(false);
              }
              Alert.alert('Success', 'All test history has been cleared.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to clear test history.');
            } finally {
              if (isMountedRef.current) {
                setIsClearingAll(false);
              }
            }
          },
        },
      ]
    );
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const isItemMatched = (item: PerformedTestHistoryItem) =>
    item.status === 'SUCCESS' &&
    (item.match_percentage === undefined ||
      item.match_percentage === null ||
      item.match_percentage >= 70);

  const [filterMode, setFilterMode] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');

  const matchedCount = history.filter(isItemMatched).length;
  const unmatchedCount = history.length - matchedCount;

  const filteredHistory = history.filter((item) => {
    if (filterMode === 'MATCHED') return isItemMatched(item);
    if (filterMode === 'UNMATCHED') return !isItemMatched(item);
    return true;
  });

  const renderHistoryCard = ({ item }: { item: PerformedTestHistoryItem }) => {
    const isSuccess = isItemMatched(item);
    const isDeleting = deletingId === item.id;

    const detectedColor = item.detected_color?.startsWith('#')
      ? item.detected_color
      : '#38BDF8';

    return (
      <Pressable style={styles.card} onPress={() => setSelectedTest(item)}>
        {/* Top Header Row */}
        <View style={styles.cardHeader}>
          <View style={styles.testInfoCol}>
            <Text style={styles.testName} numberOfLines={1}>
              {item.test_name || item.test_id || 'Chemical Test'}
            </Text>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              isSuccess ? styles.badgeSuccess : styles.badgeWarning,
            ]}>
            <Text
              style={[
                styles.statusBadgeText,
                isSuccess ? styles.textSuccess : styles.textWarning,
              ]}>
              {isSuccess ? '✓ Matched' : '⚠️ Unmatched'}
            </Text>
          </View>
        </View>

        {/* Content Row: Color Swatch + Readings */}
        <View style={styles.detailsRow}>
          <View
            style={[
              styles.colorSwatch,
              { backgroundColor: detectedColor },
            ]}
          />

          <View style={styles.readingsCol}>
            <Text style={styles.readingLabel}>MEASURED READING</Text>
            <Text style={styles.readingValue}>
              {item.detected_level ||
                (item.matched_standard_value !== undefined && item.matched_standard_value !== null
                  ? `${item.matched_standard_value} mg/L`
                  : isSuccess
                  ? 'Matched'
                  : 'Unmatched Color')}
            </Text>
          </View>

          {item.match_percentage !== undefined && item.match_percentage !== null && (
            <View style={styles.metricCol}>
              <Text style={styles.metricVal}>
                {Math.round(item.match_percentage)}%
              </Text>
              <Text style={styles.metricSub}>Accuracy</Text>
            </View>
          )}

          {item.quality_score !== undefined && item.quality_score !== null && (
            <View style={styles.metricCol}>
              <Text style={styles.metricVal}>
                {Math.round(item.quality_score)}%
              </Text>
              <Text style={styles.metricSub}>Clarity</Text>
            </View>
          )}
        </View>

        {/* Rejection / Info reasons if available */}
        {item.rejection_reasons && item.rejection_reasons.length > 0 && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionReasonText}>
              Note: {item.rejection_reasons.join(', ')}
            </Text>
          </View>
        )}

        {/* Footer Actions Row */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeftCol}>
            <Text style={styles.deviceIdText}>
              {item.device_model ? `Device: ${item.device_model}` : `Version ${item.test_version}`}
            </Text>
            <Text style={styles.tapToViewText}>Tap to view full test ›</Text>
          </View>

          <Pressable
            style={styles.deleteBtn}
            disabled={isDeleting}
            onPress={(e) => {
              e?.stopPropagation?.();
              handleDelete(item);
            }}>
            {isDeleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.deleteBtnText}>Delete</Text>
            )}
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={JalqTheme.colors.primary} />
          <Text style={styles.footerLoaderText}>Loading more tests...</Text>
        </View>
      );
    }
    if (history.length > 0 && !hasMore) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>✓ All {totalCount || history.length} tests loaded</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Navigation Top Bar */}
      <View style={styles.navBar}>
        <HeaderBackButton onPress={onBack} label="Back" />
        <Text style={styles.navTitle}>Performed Tests History</Text>
        <View style={styles.navActions}>
          {history.length > 0 && (
            <Pressable
              style={styles.clearAllBtn}
              onPress={handleClearAll}
              disabled={isClearingAll}>
              {isClearingAll ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Text style={styles.clearAllBtnText}>Clear All</Text>
              )}
            </Pressable>
          )}
          <Pressable
            style={styles.refreshIconBtn}
            onPress={() => loadHistory(true)}>
            <Text style={styles.refreshIconText}>↻</Text>
          </Pressable>
        </View>
      </View>

      {/* Stats Summary Strip with Tab Filtering */}
      <View style={styles.statsStrip}>
        <Pressable
          style={[
            styles.statBox,
            filterMode === 'ALL' && styles.statBoxActive,
          ]}
          onPress={() => setFilterMode('ALL')}>
          <Text style={styles.statNumber}>{totalCount || history.length}</Text>
          <Text style={[styles.statLabel, filterMode === 'ALL' && styles.statLabelActive]}>
            Total Tests
          </Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable
          style={[
            styles.statBox,
            filterMode === 'MATCHED' && styles.statBoxActive,
          ]}
          onPress={() => setFilterMode('MATCHED')}>
          <Text style={[styles.statNumber, { color: JalqTheme.colors.emerald }]}>
            {matchedCount}
          </Text>
          <Text style={[styles.statLabel, filterMode === 'MATCHED' && styles.statLabelActive]}>
            Matched
          </Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable
          style={[
            styles.statBox,
            filterMode === 'UNMATCHED' && styles.statBoxActive,
          ]}
          onPress={() => setFilterMode('UNMATCHED')}>
          <Text style={[styles.statNumber, { color: JalqTheme.colors.amber }]}>
            {unmatchedCount}
          </Text>
          <Text style={[styles.statLabel, filterMode === 'UNMATCHED' && styles.statLabelActive]}>
            Unmatched
          </Text>
        </Pressable>
      </View>

      {/* History List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading tests history...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadHistory(true)}
              tintColor={JalqTheme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>
                {filterMode === 'MATCHED'
                  ? 'No matched tests found'
                  : filterMode === 'UNMATCHED'
                  ? 'No unmatched tests found'
                  : 'No test history recorded'}
              </Text>
              <Text style={styles.emptyDesc}>
                Any chemical bottle test performed by field technicians will be automatically recorded in the database with full colorimetry metrics.
              </Text>
            </View>
          }
        />
      )}

      {/* Test Inspection Detail Modal */}
      {selectedTest && (
        <Modal
          visible={Boolean(selectedTest)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedTest(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTestTitle} numberOfLines={1}>
                    {selectedTest.test_name || selectedTest.test_id}
                  </Text>
                  <Text style={styles.modalDateText}>
                    {formatDate(selectedTest.created_at)}
                  </Text>
                </View>
                <Pressable
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedTest(null)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Status Indicator */}
                <View
                  style={[
                    styles.modalStatusBanner,
                    isItemMatched(selectedTest)
                      ? styles.badgeSuccess
                      : styles.badgeWarning,
                  ]}>
                  <Text style={styles.modalStatusText}>
                    {isItemMatched(selectedTest)
                      ? '✓ Chemical Reading Matched'
                      : '⚠️ Unmatched / Out of Range'}
                  </Text>
                </View>

                {/* Primary Metric Row */}
                <View style={styles.modalMetricRow}>
                  <View style={styles.modalSwatchCol}>
                    <View
                      style={[
                        styles.modalColorSwatch,
                        {
                          backgroundColor:
                            selectedTest.detected_color?.startsWith('#')
                              ? selectedTest.detected_color
                              : '#38BDF8',
                        },
                      ]}
                    />
                    <Text style={styles.modalHexText}>
                      {selectedTest.detected_color || '#38BDF8'}
                    </Text>
                  </View>

                  <View style={styles.modalReadingCol}>
                    <Text style={styles.modalReadingLabel}>MEASURED LEVEL</Text>
                    <Text style={styles.modalReadingVal}>
                      {selectedTest.detected_level ||
                        (selectedTest.matched_standard_value !== undefined &&
                        selectedTest.matched_standard_value !== null
                          ? `${selectedTest.matched_standard_value} mg/L`
                          : 'Sample Reading')}
                    </Text>
                    {selectedTest.match_percentage !== undefined && (
                      <Text style={styles.modalAccuracyText}>
                        Accuracy: {Math.round(selectedTest.match_percentage)}%
                      </Text>
                    )}
                  </View>
                </View>

                {/* Specs Box */}
                <View style={styles.modalSpecsBox}>
                  <View style={styles.modalSpecItem}>
                    <Text style={styles.modalSpecKey}>Assay ID</Text>
                    <Text style={styles.modalSpecVal}>{selectedTest.test_id}</Text>
                  </View>
                  <View style={styles.modalSpecItem}>
                    <Text style={styles.modalSpecKey}>Clarity Score</Text>
                    <Text style={styles.modalSpecVal}>
                      {selectedTest.quality_score
                        ? `${Math.round(selectedTest.quality_score)}%`
                        : '85%'}
                    </Text>
                  </View>
                  <View style={styles.modalSpecItem}>
                    <Text style={styles.modalSpecKey}>Captured Device</Text>
                    <Text style={styles.modalSpecVal}>
                      {selectedTest.device_model || 'Mobile Device'}
                    </Text>
                  </View>
                  <View style={styles.modalSpecItem}>
                    <Text style={styles.modalSpecKey}>Protocol Version</Text>
                    <Text style={styles.modalSpecVal}>v{selectedTest.test_version}</Text>
                  </View>
                </View>

                {/* Notes */}
                {selectedTest.rejection_reasons &&
                  selectedTest.rejection_reasons.length > 0 && (
                    <View style={styles.modalRejectionBox}>
                      <Text style={styles.modalRejectionHeading}>Observations & Notes:</Text>
                      <Text style={styles.modalRejectionText}>
                        {selectedTest.rejection_reasons.join('\n')}
                      </Text>
                    </View>
                  )}
              </ScrollView>

              <Pressable
                style={styles.modalDoneBtn}
                onPress={() => setSelectedTest(null)}>
                <Text style={styles.modalDoneBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: JalqTheme.spacing.base,
    paddingVertical: JalqTheme.spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  clearAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  refreshIconBtn: {
    padding: 6,
  },
  refreshIconText: {
    fontSize: 20,
    fontWeight: '700',
    color: JalqTheme.colors.primary,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  footerEnd: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  footerEndText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statBox: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statBoxActive: {
    backgroundColor: '#F1F5F9',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  statLabelActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  testInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  testName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  badgeRetake: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textSuccess: {
    color: '#059669',
  },
  textWarning: {
    color: '#D97706',
  },
  textRetake: {
    color: '#DC2626',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginRight: 12,
  },
  readingsCol: {
    flex: 1,
  },
  readingLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  readingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  metricCol: {
    alignItems: 'center',
    marginLeft: 12,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  metricSub: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  rejectionBox: {
    backgroundColor: '#FFF1F2',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  rejectionReasonText: {
    fontSize: 11,
    color: '#BE123C',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  deviceIdText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  footerLeftCol: {
    flex: 1,
    marginRight: 8,
  },
  tapToViewText: {
    fontSize: 11,
    color: JalqTheme.colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 20,
    ...JalqTheme.shadow.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTestTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalDateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  modalBody: {
    marginBottom: 16,
  },
  modalStatusBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  modalStatusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 16,
  },
  modalSwatchCol: {
    alignItems: 'center',
  },
  modalColorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...JalqTheme.shadow.sm,
  },
  modalHexText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  modalReadingCol: {
    flex: 1,
  },
  modalReadingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  modalReadingVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  modalAccuracyText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  modalSpecsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  modalSpecItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalSpecKey: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  modalSpecVal: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  modalRejectionBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  modalRejectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  modalRejectionText: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 16,
  },
  modalDoneBtn: {
    backgroundColor: JalqTheme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
