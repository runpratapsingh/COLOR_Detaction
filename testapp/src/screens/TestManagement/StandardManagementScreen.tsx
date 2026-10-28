import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { JalqTheme } from '../../theme/colors';
import { ChemicalTestDetail, ColorStandard, UserSession } from '../../types/jalq';
import {
  addReferenceSampleToStandard,
  deleteColorStandard,
  fetchTestDetails,
  publishChemicalTest,
} from '../../services/jalqApi';
import { DEMO_REFERENCE_BOTTLE_BASE64 } from '../../constants/demoReferenceBottle';
import { HeaderBackButton } from '../../components';


interface StandardManagementScreenProps {
  session: UserSession;
  testId: string;
  onBack: () => void;
  onAddStandard: (testId: string) => void;
  onTestNow?: (testId: string) => void;
  onEditTest?: (testId: string) => void;
}

export const StandardManagementScreen: React.FC<StandardManagementScreenProps> = ({
  session,
  testId,
  onBack,
  onAddStandard,
  onTestNow,
  onEditTest,
}) => {
  const [test, setTest] = useState<ChemicalTestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      loadStandards();
      return () => {
        isMountedRef.current = false;
      };
    }, [loadStandards])
  );

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

  const processNewSample = async (std: ColorStandard, uri: string, base64?: string) => {
    try {
      setActionLoading(true);
      const updatedStd = await addReferenceSampleToStandard(
        testId,
        std.id,
        uri,
        base64,
        session.role
      );
      await loadStandards();
      Alert.alert(
        'Bottle Calibrated ✓',
        `Standard ${std.value} ${std.unit} now averages ${updatedStd.sample_count || 2} photos for improved accuracy and glare tolerance.`
      );
    } catch (err: any) {
      Alert.alert('Calibration Error', err.message || 'Failed to add bottle sample.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddSampleToStandard = (std: ColorStandard) => {
    Alert.alert(
      `Calibrate ${std.value} ${std.unit} Bottle`,
      'Add another photo of this same bottle under different angle or ambient lighting. The app will calculate the median color to eliminate glare and noise.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '📸 Take Photo (Camera)',
          onPress: async () => {
            try {
              const res = await launchCamera({
                mediaType: 'photo',
                quality: 0.9,
                includeBase64: true,
                maxWidth: 1600,
                maxHeight: 1600,
              });
              if (res.assets && res.assets[0]?.uri) {
                await processNewSample(std, res.assets[0].uri, res.assets[0].base64);
              }
            } catch (err: any) {
              Alert.alert('Camera Error', err.message || 'Failed to capture photo.');
            }
          },
        },
        {
          text: '🖼️ Choose from Gallery',
          onPress: async () => {
            try {
              const res = await launchImageLibrary({
                mediaType: 'photo',
                quality: 0.9,
                includeBase64: true,
                maxWidth: 1600,
                maxHeight: 1600,
              });
              if (res.assets && res.assets[0]?.uri) {
                await processNewSample(std, res.assets[0].uri, res.assets[0].base64);
              }
            } catch (err: any) {
              Alert.alert('Gallery Error', err.message || 'Failed to select image.');
            }
          },
        },
        {
          text: '🧪 Use Demo Sample',
          onPress: async () => {
            await processNewSample(
              std,
              `data:image/jpeg;base64,${DEMO_REFERENCE_BOTTLE_BASE64}`,
              DEMO_REFERENCE_BOTTLE_BASE64
            );
          },
        },
      ]
    );
  };


  const handleMergeDuplicateStandard = async (primaryStd: ColorStandard, duplicateStd: ColorStandard) => {
    Alert.alert(
      'Merge Duplicate Bottles',
      `Merge '${duplicateStd.name || duplicateStd.color_name}' into '${primaryStd.name || primaryStd.color_name}'? The calibration photos will be averaged together, and the duplicate card will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge & Average',
          style: 'default',
          onPress: async () => {
            try {
              setActionLoading(true);
              const dupImg = duplicateStd.reference_image || duplicateStd.samples?.[0]?.image_base64;
              if (dupImg) {
                await addReferenceSampleToStandard(
                  testId,
                  primaryStd.id,
                  dupImg,
                  dupImg.startsWith('data:') ? dupImg.split(',')[1] : undefined,
                  session.role
                );
              }
              await deleteColorStandard(testId, duplicateStd.id, session.role);
              await loadStandards();
              Alert.alert(
                'Duplicate Merged ✓',
                `Both photo samples are now averaged under a single standard (${primaryStd.value} ${primaryStd.unit}).`
              );
            } catch (err: any) {
              Alert.alert('Merge Error', err.message || 'Failed to merge duplicate standards.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };



  const handlePublishTest = async () => {
    if (!test) return;
    if (sortedStandards.length < 1) {
      Alert.alert(
        'Standards Required',
        'Please add at least 1 calibrated reference standard before publishing the test.'
      );
      return;
    }

    Alert.alert(
      'Publish Chemical Test',
      `Publish '${test.name}' with ${sortedStandards.length} calibrated standards? Once published, standards will become locked and active for field testing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish Live',
          style: 'default',
          onPress: async () => {
            try {
              setActionLoading(true);
              await publishChemicalTest(testId, session.role);
              await loadStandards();
              Alert.alert('Test Published ✓', `'${test.name}' is now live and locked for field testing.`);
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



  if (loading || !test) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
        <View style={styles.topRightActions}>
          {onEditTest && (
            <Pressable
              style={styles.editTestNavBtn}
              onPress={() => onEditTest(testId)}>
              <Text style={styles.editTestNavBtnText}>✏️ Edit Test</Text>
            </Pressable>
          )}
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
                    <Text style={styles.ladderHexText}>{std.level || `Level ${idx + 1}`}</Text>

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

          {!isPublished && (
            <Pressable
              style={styles.addStandardBtn}
              onPress={() => onAddStandard(testId)}>
              <Text style={styles.addStandardBtnText}>+ Add Standard</Text>
            </Pressable>
          )}
        </View>

        {/* Section 3: Detailed Standard Cards */}
        {sortedStandards.map((std) => {
          const hex = std.reference_color?.hex || '#CCCCCC';
          const lab = std.reference_color?.lab || { l: 0, a: 0, b: 0 };
          const quality = std.quality || { overall: 90, valid_pixel_percentage: 85 };
          const refImg = std.reference_image || std.samples?.[0]?.image_base64;
          const sampleCount = std.sample_count || (std.samples ? std.samples.length : 1);

          const duplicates = sortedStandards.filter((s) => Math.abs(s.value - std.value) < 1e-4);
          const isDuplicate = duplicates.length > 1;
          const isSecondaryDuplicate = isDuplicate && duplicates[0].id !== std.id;

          return (
            <View key={std.id} style={[styles.standardCard, isSecondaryDuplicate && styles.duplicateStandardCard]}>
              {/* Secondary Duplicate Warning Banner */}
              {isSecondaryDuplicate && !isPublished && (
                <View style={styles.duplicateWarningStrip}>
                  <Text style={styles.duplicateWarningText}>
                    ⚠️ Duplicate concentration ({std.value} {std.unit})
                  </Text>
                  <Pressable
                    style={styles.mergeDuplicateBtn}
                    onPress={() => handleMergeDuplicateStandard(duplicates[0], std)}>
                    <Text style={styles.mergeDuplicateBtnText}>🔗 Merge into 1 Bottle</Text>
                  </Pressable>
                </View>
              )}

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
                    <View style={styles.sampleBadge}>
                      <Text style={styles.sampleBadgeText}>
                        {sampleCount > 1 ? `📸 ${sampleCount} Shots Averaged` : '📸 1 Shot'}
                      </Text>
                    </View>
                    <View style={styles.qualityPill}>
                      <Text style={styles.qualityPillText}>
                        {quality.overall.toFixed(0)}% valid
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.standardNameText}>{std.name || std.color_name || 'Standard'}</Text>
                  <Text style={styles.metricSummaryText}>
                    {sampleCount > 1 ? `Multi-Shot Profile (${sampleCount} photos) • ` : 'Calibrated Standard • '}
                    {quality.overall.toFixed(0)}% Optical Clarity
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


                {!isPublished && (
                  <View style={styles.cardRightActions}>
                    <Pressable
                      style={styles.deleteCardBtn}
                      onPress={() => handleDelete(std.id, `${std.value} ${std.unit}`)}>
                      <Text style={styles.deleteCardBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        })}



      </ScrollView>

      {/* Sticky Bottom Actions */}
      {!isPublished ? (
        <View style={styles.footerBar}>
          <Pressable
            style={[
              styles.publishActionBtn,
              (sortedStandards.length < 1 || actionLoading) && styles.btnDisabled,
            ]}
            disabled={sortedStandards.length < 1 || actionLoading}
            onPress={handlePublishTest}>
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.publishActionText}>
                ✓ Publish Test Live ({sortedStandards.length} {sortedStandards.length === 1 ? 'Standard' : 'Standards'})
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.footerBar}>
          <View style={styles.publishedNoticeBox}>
            <Text style={styles.publishedNoticeHeading}>● Test is Published & Locked</Text>
            <Text style={styles.publishedNoticeText}>
              Reference standards are immutable and active for field testing.
            </Text>
          </View>
        </View>
      )}

      {/* MODAL: View Analysis & Samples Details */}
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
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editTestNavBtn: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: JalqTheme.radius.md,
  },
  editTestNavBtnText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '700',
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
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.lg,
    padding: JalqTheme.spacing.base,
    ...JalqTheme.shadow.sm,
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
    color: JalqTheme.colors.textPrimary,
  },
  ladderSubtitle: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    marginTop: 2,
  },
  unitTag: {
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderFocus,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: JalqTheme.radius.pill,
  },
  unitTagText: {
    color: JalqTheme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  ladderNode: {
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  ladderSwatchWrapper: {
    padding: 3,
    backgroundColor: JalqTheme.colors.bgInput,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
  },
  ladderSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  ladderValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: JalqTheme.colors.textPrimary,
    marginTop: 6,
  },
  ladderHexText: {
    fontSize: 10,
    color: JalqTheme.colors.textMuted,
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
    backgroundColor: JalqTheme.colors.borderDefault,
  },
  ladderConnectorArrow: {
    color: JalqTheme.colors.textMuted,
    fontSize: 10,
  },
  ladderEmptyBox: {
    padding: 20,
    alignItems: 'center',
  },
  ladderEmptyText: {
    color: JalqTheme.colors.textSecondary,
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
    color: JalqTheme.colors.textPrimary,
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    marginTop: 1,
  },
  addStandardBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: JalqTheme.radius.md,
  },
  addStandardBtnText: {
    color: JalqTheme.colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  standardCard: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: JalqTheme.radius.lg,
    padding: JalqTheme.spacing.base,
    gap: 12,
    ...JalqTheme.shadow.sm,
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
    backgroundColor: JalqTheme.colors.bgInput,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
  },
  largeSwatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
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
    fontSize: 16,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
  },
  qualityPill: {
    backgroundColor: JalqTheme.colors.badgeSuccessBg,
    borderColor: JalqTheme.colors.badgeSuccessBorder,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qualityPillText: {
    color: JalqTheme.colors.badgeSuccessText,
    fontSize: 10,
    fontWeight: '700',
  },
  standardNameText: {
    fontSize: 13,
    color: JalqTheme.colors.textPrimary,
    marginTop: 2,
    fontWeight: '600',
  },
  metricSummaryText: {
    fontSize: 11,
    color: JalqTheme.colors.textMuted,
    marginTop: 2,
  },
  descText: {
    fontSize: 12,
    color: JalqTheme.colors.textSecondary,
    lineHeight: 16,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: JalqTheme.colors.borderSubtle,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  detailsBtn: {
    backgroundColor: JalqTheme.colors.bgInput,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  detailsBtnText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  cardRightActions: {
    flexDirection: 'row',
    gap: 10,
  },
  sampleBadge: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  sampleBadgeText: {
    color: '#4338CA',
    fontSize: 10,
    fontWeight: '700',
  },
  recalibrateBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
  },
  recalibrateBtnText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteCardBtn: {
    backgroundColor: JalqTheme.colors.badgeErrorBg,
    borderColor: JalqTheme.colors.badgeErrorBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteCardBtnText: {
    color: JalqTheme.colors.crimson,
    fontSize: 11,
    fontWeight: '700',
  },
  duplicateStandardCard: {
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    backgroundColor: '#FFFBEB',
  },
  duplicateWarningStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 10,
  },
  duplicateWarningText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  mergeDuplicateBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 8,
  },
  mergeDuplicateBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },


  bottomControlBox: {
    marginTop: 10,
    marginBottom: 24,
  },
  testNowActionBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingVertical: 14,
    borderRadius: JalqTheme.radius.md,
    alignItems: 'center',
    marginBottom: 10,
    ...JalqTheme.shadow.cyan,
  },
  testNowActionText: {
    color: JalqTheme.colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  publishActionBtn: {
    backgroundColor: JalqTheme.colors.emerald,
    paddingVertical: 14,
    borderRadius: JalqTheme.radius.md,
    alignItems: 'center',
  },
  publishActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footerBar: {
    padding: JalqTheme.spacing.base,
    backgroundColor: JalqTheme.colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: JalqTheme.colors.borderSubtle,
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
