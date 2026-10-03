import React from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme } from '../theme/colors';

interface CaptureInstructionsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CaptureInstructionsModal: React.FC<CaptureInstructionsModalProps> = ({
  visible,
  onClose,
}) => {
  const rules = [
    {
      num: '1',
      icon: '📄',
      title: 'White Paper Behind Bottle',
      subtitle: 'Block out background colors',
      detail:
        'Put a clean sheet of white paper or card directly behind the bottle. This prevents table wood, wall paint, or outdoor colors from showing through the liquid.',
    },
    {
      num: '2',
      icon: '🚫⚡',
      title: 'Turn Camera Flash OFF',
      subtitle: 'Avoid bright light reflections',
      detail:
        'Camera flash bounces right off the glass bottle and creates bright white glare spots that hide the true color. Always keep flash turned off.',
    },
    {
      num: '3',
      icon: '💡',
      title: 'Use Soft, Even Room Light',
      subtitle: 'No harsh spotlights or direct sun',
      detail:
        'Use normal room lighting or indirect daylight. Avoid pointing a bright flashlight or lamp straight at the bottle to prevent deep shadows.',
    },
    {
      num: '4',
      icon: '🎯',
      title: 'Keep Bottle Straight & Centered',
      subtitle: 'Fit inside the guide box',
      detail:
        'Place the bottle upright and center the colored liquid inside the on-screen box. The center of the bottle shows the clearest, most accurate test color.',
    },
    {
      num: '5',
      icon: '📱',
      title: 'Hold Steady & Tap to Focus',
      subtitle: 'Keep phone 15–25 cm (6–10 in) away',
      detail:
        'Hold your phone steady with both hands. Tap the liquid area on your phone screen so it looks sharp and clear, then take the photo.',
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerIcon}>📸</Text>
            <View>
              <Text style={styles.headerTitle}>Photo Tips for Best Results</Text>
              <Text style={styles.headerSubtitle}>
                Follow these 5 simple steps for an accurate reading
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Why Banner */}
          <View style={styles.tipBanner}>
            <Text style={styles.tipBannerTitle}>
              💡 Why do these steps matter?
            </Text>
            <Text style={styles.tipBannerText}>
              Liquid in clear glass picks up colors from your table, wall, and shadows. Following these simple steps makes sure your phone captures the exact true test color every single time.
            </Text>
          </View>

          {/* Rules List */}
          <View style={styles.rulesList}>
            {rules.map((rule) => (
              <View key={rule.num} style={styles.ruleCard}>
                <View style={styles.ruleHeader}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>STEP {rule.num}</Text>
                  </View>
                  <Text style={styles.ruleIcon}>{rule.icon}</Text>
                </View>

                <Text style={styles.ruleTitle}>{rule.title}</Text>
                <Text style={styles.ruleSubtitle}>{rule.subtitle}</Text>
                <Text style={styles.ruleDetail}>{rule.detail}</Text>
              </View>
            ))}
          </View>

          {/* Quick Summary Box */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>✓ Quick Checklist:</Text>
            <Text style={styles.summaryItem}>• Clean white paper sheet placed behind bottle</Text>
            <Text style={styles.summaryItem}>• Camera flash is turned OFF</Text>
            <Text style={styles.summaryItem}>• Bottle is standing upright inside the guide box</Text>
            <Text style={styles.summaryItem}>• Liquid looks sharp, clear, and well-lit</Text>
          </View>

          {/* Acknowledge Button */}
          <Pressable style={styles.confirmBtn} onPress={onClose}>
            <Text style={styles.confirmBtnText}>Got It — Take Photo</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: JalqTheme.colors.borderSubtle,
    backgroundColor: JalqTheme.colors.bgCard,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerTitle: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: JalqTheme.colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
  },
  closeBtnText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  tipBanner: {
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderColor: JalqTheme.colors.borderFocus,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  tipBannerTitle: {
    color: JalqTheme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  tipBannerText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  rulesList: {
    gap: 14,
  },
  ruleCard: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    ...JalqTheme.shadow.sm,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: JalqTheme.colors.primaryGlow,
    borderColor: JalqTheme.colors.borderFocus,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: JalqTheme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ruleIcon: {
    fontSize: 22,
  },
  ruleTitle: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  ruleSubtitle: {
    color: JalqTheme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  ruleDetail: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryBox: {
    marginTop: 20,
    backgroundColor: JalqTheme.colors.badgeSuccessBg,
    borderColor: JalqTheme.colors.badgeSuccessBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  summaryTitle: {
    color: JalqTheme.colors.badgeSuccessText,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryItem: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 22,
  },
  confirmBtn: {
    marginTop: 24,
    backgroundColor: JalqTheme.colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...JalqTheme.shadow.cyan,
  },
  confirmBtnText: {
    color: JalqTheme.colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
});

