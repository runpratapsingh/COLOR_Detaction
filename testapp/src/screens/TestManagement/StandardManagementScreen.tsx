import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { JalqTheme } from '../../theme/colors';
import { ChemicalTestDetail, ColorStandard, UserSession } from '../../types/jalq';
import {
  createNewTestVersion,
  deleteColorStandard,
  fetchTestDetails,
  publishChemicalTest,
  updateColorStandard,
} from '../../services/jalqApi';
import { HeaderBackButton } from '../../components';

interface StandardManagementScreenProps {
  session: UserSession;
  testId: string;
  onBack: () => void;
  onAddStandard: (testId: string) => void;
  onEditStandard?: (testId: string, standardId: string) => void;
  onTestNow?: (testId: string) => void;
}

export const StandardManagementScreen: React.FC<StandardManagementScreenProps> = ({
  session,
  testId,
  onBack,
  onAddStandard,
  onTestNow,
}) => {
  const [test, setTest] = useState<ChemicalTestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit Description Modal State
  const [editingStandard, setEditingStandard] = useState<ColorStandard | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editTolerance, setEditTolerance] = useState('3.0');

  // Detail Modal State (View analysis & samples)
  const [selectedStandardForDetails, setSelectedStandardForDetails] = useState<ColorStandard | null>(null);

  const isMountedRef = useRef(true);

  const loadStandards = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await fetchTestDetails(testId);
      if (isMountedRef.current) {
        setTest(detail);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.warn('Failed to load standards:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [testId]);

  useEffect(() => {
    isMountedRef.current = true;
    loadStandards();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadStandards]);

  const isPublished = test?.status === 'PUBLISHED';

  const handleDelete = (standardId: string, valStr: string) => {
    Alert.alert(
      'Delete Standard',
      `Are you sure you want to delete standard ${valStr}? This will remove its calibration profile.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await deleteColorStandard(testId, standardId, session.role);
              await loadStandards();
            } catch (err: any) {
              Alert.alert('Delete Error', err.message || 'Failed to delete standard.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenEdit = (std: ColorStandard) => {
    setEditingStandard(std);
    setEditDesc(std.description || '');
    setEditTolerance(String(std.tolerance_delta_e || 3.0));
  };

  const handleSaveEdit = async () => {
    if (!editingStandard) return;
    try {
      setActionLoading(true);
      await updateColorStandard(
        testId,
        editingStandard.id,
        {
          description: editDesc.trim(),
          tolerance_delta_e: parseFloat(editTolerance) || 3.0,
        },
        session.role
      );
      setEditingStandard(null);
      await loadStandards();
    } catch (err: any) {
      Alert.alert('Update Error', err.message || 'Failed to update standard.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!test) return;
    if (test.standards.length === 0) {
      Alert.alert('Cannot Publish', 'Add at least one color standard before publishing.');
      return;
    }

    Alert.alert(
      'Publish Chemical Test',
      `Publishing '${test.name}' will make its standards immutable for field testers. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish Test Now',
          onPress: async () => {
            try {
              setActionLoading(true);
              await publishChemicalTest(testId, session.role);
              await loadStandards();
              Alert.alert('Published', `Test '${test.name}' is now live for field testers.`);
            } catch (err: any) {
              Alert.alert('Publish Error', err.message || 'Failed to publish test.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleNewVersion = async () => {
    Alert.alert(
      'Create New Revision',
      `Create Version ${(test?.version || 1) + 1} of this test in DRAFT state? Historical version will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Version',
          onPress: async () => {
            try {
              setActionLoading(true);
              await createNewTestVersion(testId, session.role);
              await loadStandards();
              Alert.alert('Success', 'New draft version created.');
            } catch (err: any) {
              Alert.alert('Version Error', err.message || 'Failed to create new version.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !test) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading color standards ladder...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sortedStandards = [...test.standards].sort((a, b) => a.value - b.value);

  return (
    <SafeAreaView style={styles.container}>
      {/* Navigation Top Bar */}
      <View style={styles.navBar}>
        <HeaderBackButton onPress={onBack} label="Dashboard" />
        <View style={styles.titleCol}>
          <Text style={styles.navTitle} numberOfLines={1}>
            {test.name}
          </Text>
          <Text style={styles.navSubtitle}>
            Version {test.version} • {isPublished ? 'Published' : 'Draft'}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text
            style={[
              styles.statusBadgeText,
              isPublished ? styles.textPublished : styles.textDraft,
            ]}>
            {isPublished ? 'Published' : 'Draft'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Visual Concentration / Color Ladder */}
        <View style={styles.ladderCard}>
          <View style={styles.ladderHeaderRow}>
            <View>
              <Text style={styles.ladderTitle}>Reference Color Progression</Text>
              <Text style={styles.ladderSubtitle}>
                Calibrated progression across {sortedStandards.length} defined levels
              </Text>
            </View>
            <View style={styles.unitTag}>
              <Text style={styles.unitTagText}>{test.unit}</Text>
            </View>
          </View>

          {/* Visual Swatch Progression Ladder */}
          {sortedStandards.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ladderRow}>
              {sortedStandards.map((std, idx) => {
                const hex = std.reference_color?.hex || '#CCCCCC';
                const isLast = idx === sortedStandards.length - 1;
                return (
                  <View key={std.id} style={styles.ladderNode}>
                    <View style={styles.ladderSwatchWrapper}>
                      <View style={[styles.ladderSwatch, { backgroundColor: hex }]} />
                    </View>
                    <Text style={styles.ladderValueText}>
                      {std.value} {std.unit}
                    </Text>
                    <Text style={styles.ladderHexText}>{hex.toUpperCase()}</Text>

                    {!isLast && (
                      <View style={styles.ladderConnector}>
                        <View style={styles.ladderConnectorLine} />
                        <Text style={styles.ladderConnectorArrow}>→</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.ladderEmptyBox}>
              <Text style={styles.ladderEmptyText}>
                No standards defined yet. Add reference samples to build the color ladder.
              </Text>
            </View>
          )}
        </View>

        {/* Section 2: Standards List Header & Add CTA */}
        <View style={styles.standardsListHeaderRow}>
          <View>
            <Text style={styles.sectionHeaderTitle}>Calibrated Standards</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Ordered by concentration ({test.unit})
            </Text>
          </View>

          <Pressable
            style={styles.addStandardBtn}
            onPress={() => onAddStandard(testId)}>
            <Text style={styles.addStandardBtnText}>+ Add Standard</Text>
          </Pressable>
        </View>

        {/* Section 3: Detailed Standard Cards */}
        {sortedStandards.map((std) => {
          const hex = std.reference_color?.hex || '#CCCCCC';
          const lab = std.reference_color?.lab || { l: 0, a: 0, b: 0 };
          const quality = std.quality || { overall: 90, valid_pixel_percentage: 85 };
          const refImg = std.reference_image || std.samples?.[0]?.image_base64;

          return (
            <View key={std.id} style={styles.standardCard}>
              {/* Card Top: Swatch + Concentration + Quality */}
              <View style={styles.standardCardTop}>
                {refImg ? (
                  <View style={styles.standardVisualsGroup}>
                    <Image source={{ uri: refImg }} style={styles.refPhotoThumb} resizeMode="contain" />
                    <View style={[styles.largeSwatch, { backgroundColor: hex }]} />
                  </View>
                ) : (
                  <View style={[styles.largeSwatch, { backgroundColor: hex }]} />
                )}

                <View style={styles.standardMetaCol}>
                  <View style={styles.standardValueRow}>
                    <Text style={styles.standardValueText}>
                      {std.value} {std.unit}
                    </Text>
                    <View style={styles.qualityPill}>
                      <Text style={styles.qualityPillText}>
                        {quality.overall.toFixed(0)}% valid
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.standardNameText}>{std.name || std.color_name || 'Standard'}</Text>
                  <Text style={styles.metricSummaryText}>
                    Hex: {hex.toUpperCase()} • CIE Lab: {lab.l.toFixed(1)}, {lab.a.toFixed(1)}, {lab.b.toFixed(1)}
                  </Text>
                </View>
              </View>

              {/* Written Description if any */}
              {std.description ? (
                <Text style={styles.descText} numberOfLines={2}>
                  {std.description}
                </Text>
              ) : null}

              {/* Action Buttons Row */}
              <View style={styles.cardActionsRow}>
                <Pressable
                  style={styles.detailsBtn}
                  onPress={() => setSelectedStandardForDetails(std)}>
                  <Text style={styles.detailsBtnText}>View Analysis</Text>
                </Pressable>

                <View style={styles.cardRightActions}>
                  <Pressable
                    style={styles.editCardBtn}
                    onPress={() => handleOpenEdit(std)}>
                    <Text style={styles.editCardBtnText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={styles.deleteCardBtn}
                    onPress={() => handleDelete(std.id, `${std.value} ${std.unit}`)}>
                    <Text style={styles.deleteCardBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}

        {/* Bottom Testing & Publishing Controls */}
        <View style={styles.bottomControlBox}>
          <Pressable
            style={styles.testNowActionBtn}
            onPress={() => (onTestNow ? onTestNow(testId) : onBack())}>
            <Text style={styles.testNowActionText}>
              🧪 Test Chemical Reading Now ›
            </Text>
          </Pressable>

          {!isPublished ? (
            <Pressable
              style={[styles.publishActionBtn, actionLoading && styles.btnDisabled]}
              disabled={actionLoading}
              onPress={handlePublish}>
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.publishActionText}>
                  ✓ Publish Test (Make Live)
                </Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.publishedNoticeBox}>
              <Text style={styles.publishedNoticeHeading}>Test Published & Active</Text>
              <Text style={styles.publishedNoticeText}>
                You can add more standards above or run sample bottle tests anytime.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL 1: Edit Description & Tolerance */}
      <Modal
        visible={Boolean(editingStandard)}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingStandard(null)}>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Edit Standard ({editingStandard?.value} {editingStandard?.unit})
            </Text>
            <Text style={styles.modalSubtitle}>
              Update description or CIEDE2000 acceptance threshold.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>WRITTEN DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.modalTextArea]}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Enter scientific description of reaction color..."
                placeholderTextColor={JalqTheme.colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TOLERANCE ΔE00</Text>
              <TextInput
                style={styles.input}
                value={editTolerance}
                onChangeText={setEditTolerance}
                keyboardType="numeric"
                placeholder="3.0"
                placeholderTextColor={JalqTheme.colors.textMuted}
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setEditingStandard(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.modalSaveBtn}
                onPress={handleSaveEdit}>
                <Text style={styles.modalSaveText}>Save Changes</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL 2: View Analysis & Samples Details */}
      <Modal
        visible={Boolean(selectedStandardForDetails)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedStandardForDetails(null)}>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                Analysis Profile: {selectedStandardForDetails?.value} {selectedStandardForDetails?.unit}
              </Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setSelectedStandardForDetails(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.modalDetailHeader}>
                <View
                  style={[
                    styles.modalSwatch,
                    { backgroundColor: selectedStandardForDetails?.reference_color?.hex || '#CCCCCC' },
                  ]}
                />
                <View>
                  <Text style={styles.modalDetailTitle}>
                    {selectedStandardForDetails?.name}
                  </Text>
                  <Text style={styles.modalDetailCode}>
                    HEX: {(selectedStandardForDetails?.reference_color?.hex || '#CCCCCC').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.sampleCountBox}>
                <Text style={styles.sampleCountTitle}>
                  Aggregated Reference Samples: {selectedStandardForDetails?.sample_count || 1}
                </Text>
                <Text style={styles.sampleCountDesc}>
                  Calculated from real model computer vision analysis. Multiple sample measurements
                  are aggregated via median CIELAB conversion to ensure high environmental reproducibility.
                </Text>
              </View>

              {/* Show individual samples if available */}
              {selectedStandardForDetails?.samples && selectedStandardForDetails.samples.length > 0 && (
                <View style={styles.sampleListCol}>
                  <Text style={styles.sampleListHeader}>Individual Measurements:</Text>
                  {selectedStandardForDetails.samples.map((s, idx) => (
                    <View key={s.id || idx} style={styles.sampleItemCard}>
                      <View style={[styles.sampleMiniSwatch, { backgroundColor: s.hex }]} />
                      <View style={styles.sampleMiniInfo}>
                        <Text style={styles.sampleMiniTitle}>Sample #{idx + 1}</Text>
                        <Text style={styles.sampleMiniMetrics}>
                          Lab: {s.lab.l.toFixed(1)}, {s.lab.a.toFixed(1)}, {s.lab.b.toFixed(1)} • RGB: {s.rgb.r},{s.rgb.g},{s.rgb.b}
                        </Text>
                        <Text style={styles.sampleMiniQuality}>
                          Quality: {s.quality.overall.toFixed(1)}% (Valid ROI: {s.quality.valid_pixel_percentage.toFixed(1)}%)
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgDark,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: JalqTheme.colors.borderSubtle,
    borderBottomWidth: 1,
    backgroundColor: JalqTheme.colors.bgCard,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: JalqTheme.colors.bgCardElevated,
  },
  backText: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  titleCol: {
    flex: 1,
    marginHorizontal: 10,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
  },
  navSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: JalqTheme.colors.textMuted,
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: JalqTheme.colors.bgInput,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  textPublished: {
    color: JalqTheme.colors.badgeSuccessText,
  },
  textDraft: {
    color: '#F59E0B',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  ladderCard: {
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
  ladderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ladderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  ladderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  unitTag: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitTagText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  ladderNode: {
    alignItems: 'center',
    marginRight: 10,
    position: 'relative',
  },
  ladderSwatchWrapper: {
    padding: 3,
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ladderSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  ladderValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 6,
  },
  ladderHexText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  ladderConnector: {
    position: 'absolute',
    right: -14,
    top: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ladderConnectorLine: {
    width: 10,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  ladderConnectorArrow: {
    color: '#94A3B8',
    fontSize: 10,
  },
  ladderEmptyBox: {
    padding: 20,
    alignItems: 'center',
  },
  ladderEmptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  standardsListHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  addStandardBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addStandardBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  standardCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  standardCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  standardVisualsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refPhotoThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  largeSwatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  standardMetaCol: {
    flex: 1,
  },
  standardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  standardValueText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  qualityPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qualityPillText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
  },
  standardNameText: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
    fontWeight: '600',
  },
  metricSummaryText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  descText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: '#F1F5F9',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  detailsBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  detailsBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  cardRightActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editCardBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editCardBtnText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '600',
  },
  deleteCardBtn: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteCardBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600',
  },
  bottomControlBox: {
    marginTop: 10,
    marginBottom: 24,
  },
  testNowActionBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  testNowActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  publishActionBtn: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  publishActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  publishedNoticeBox: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  publishedNoticeHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: JalqTheme.colors.badgeSuccessText,
    marginBottom: 4,
  },
  publishedNoticeText: {
    fontSize: 11,
    color: JalqTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    marginBottom: 12,
  },
  newVersionActionBtn: {
    backgroundColor: JalqTheme.colors.bgCardElevated,
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  newVersionActionText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: JalqTheme.colors.textMuted,
    marginTop: 2,
    marginBottom: 14,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '800',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: JalqTheme.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: JalqTheme.colors.bgInput,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: JalqTheme.colors.textPrimary,
    fontSize: 13,
  },
  modalTextArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgCardElevated,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: JalqTheme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: JalqTheme.colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  modalScroll: {
    maxHeight: 380,
  },
  modalDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalSwatch: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalDetailTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
  },
  modalDetailCode: {
    fontSize: 11,
    color: JalqTheme.colors.textMuted,
  },
  sampleCountBox: {
    backgroundColor: JalqTheme.colors.bgInput,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  sampleCountTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
    marginBottom: 4,
  },
  sampleCountDesc: {
    fontSize: 11,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 15,
  },
  sampleListCol: {
    gap: 8,
  },
  sampleListHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: JalqTheme.colors.textSecondary,
    marginBottom: 4,
  },
  sampleItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: JalqTheme.colors.bgInput,
    padding: 8,
    borderRadius: 8,
    gap: 10,
  },
  sampleMiniSwatch: {
    width: 26,
    height: 26,
    borderRadius: 6,
  },
  sampleMiniInfo: {
    flex: 1,
  },
  sampleMiniTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
  },
  sampleMiniMetrics: {
    fontSize: 9,
    color: JalqTheme.colors.textSecondary,
    marginTop: 1,
  },
  sampleMiniQuality: {
    fontSize: 9,
    color: JalqTheme.colors.emerald,
    marginTop: 1,
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
    color: JalqTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 12,
  },
});
