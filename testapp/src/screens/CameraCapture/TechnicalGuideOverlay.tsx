import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { JalqTheme } from '../../theme/colors';

interface TechnicalGuideOverlayProps {
  statusText?: string;
  isReadyToCapture?: boolean;
  onOpenInstructions?: () => void;
}

export const TechnicalGuideOverlay: React.FC<TechnicalGuideOverlayProps> = ({
  statusText = 'Fit bottle inside box • Plain background',
  isReadyToCapture = true,
  onOpenInstructions,
}) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Top Guidance Pill & Protocol Button */}
      <View style={styles.topPillContainer}>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, isReadyToCapture && styles.statusDotActive]} />
          <Text style={styles.statusPillText}>{statusText}</Text>
        </View>

        {onOpenInstructions && (
          <Pressable
            style={styles.protoTriggerBtn}
            onPress={onOpenInstructions}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.protoTriggerIcon}>ℹ️</Text>
            <Text style={styles.protoTriggerText}>Tips</Text>
          </Pressable>
        )}
      </View>

      {/* Center Framing Viewport */}
      <View style={styles.centerFramingArea}>
        <View style={styles.bottleGuideBox}>
          {/* 4 Corner Brackets */}
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />

          {/* Liquid Core Safe Target Indicator */}
          <View style={styles.liquidCoreTarget}>
            <View style={styles.horizontalLine} />
            <Text style={styles.liquidCoreLabel}>LIQUID LEVEL</Text>
            <View style={styles.horizontalLine} />
          </View>

          {/* Level Center Line */}
          <View style={styles.verticalCenterLine} />
        </View>
      </View>

      {/* Bottom Environmental Reminders */}
      <View style={styles.bottomTipsContainer}>
        <View style={styles.tipPill}>
          <Text style={styles.tipText}>☀️ Avoid direct sun</Text>
          <Text style={styles.tipDivider}>|</Text>
          <Text style={styles.tipText}>📄 Plain background</Text>
          <Text style={styles.tipDivider}>|</Text>
          <Text style={styles.tipText}>🚫 Flash Off</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topPillContainer: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 15, 23, 0.85)',
    borderColor: JalqTheme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  protoTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    borderColor: JalqTheme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  protoTriggerIcon: {
    fontSize: 12,
  },
  protoTriggerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: JalqTheme.colors.textMuted,
  },
  statusDotActive: {
    backgroundColor: JalqTheme.colors.emerald,
  },
  statusPillText: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  centerFramingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottleGuideBox: {
    width: '62%',
    height: '68%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: 'rgba(14, 165, 233, 0.25)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: JalqTheme.colors.primary,
  },
  tl: { top: -2, left: -2, borderTopWidth: 3.5, borderLeftWidth: 3.5, borderTopLeftRadius: 16 },
  tr: { top: -2, right: -2, borderTopWidth: 3.5, borderRightWidth: 3.5, borderTopRightRadius: 16 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 3.5, borderLeftWidth: 3.5, borderBottomLeftRadius: 16 },
  br: { bottom: -2, right: -2, borderBottomWidth: 3.5, borderRightWidth: 3.5, borderBottomRightRadius: 16 },
  liquidCoreTarget: {
    width: '76%',
    height: '40%',
    borderColor: 'rgba(16, 185, 129, 0.45)',
    borderWidth: 1.5,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalLine: {
    width: '40%',
    height: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    marginVertical: 2,
  },
  liquidCoreLabel: {
    color: JalqTheme.colors.emerald,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  verticalCenterLine: {
    position: 'absolute',
    width: 1,
    height: 16,
    backgroundColor: 'rgba(14, 165, 233, 0.4)',
    top: 8,
  },
  bottomTipsContainer: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 23, 0.82)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    gap: 8,
  },
  tipText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  tipDivider: {
    color: JalqTheme.colors.borderSubtle,
    fontSize: 10,
  },
});
