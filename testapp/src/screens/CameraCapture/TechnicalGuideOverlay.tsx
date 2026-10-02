import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { JalqTheme } from '../../theme/colors';

export type CaptureStatus =
  | 'waiting'      // no bottle yet — idle
  | 'too_far'      // bottle detected but too small
  | 'too_close'    // bottle fills too much of frame
  | 'off_center'   // bottle not centered
  | 'too_dark'     // underexposed
  | 'too_bright'   // overexposed
  | 'ready';       // all checks pass — green

const STATUS_CONFIG: Record<
  CaptureStatus,
  { label: string; color: string; icon: string; pulse: boolean }
> = {
  waiting:    { label: 'Fit bottle inside the box',     color: '#94A3B8', icon: '⬜', pulse: false },
  too_far:    { label: 'Move closer to the bottle',     color: '#F59E0B', icon: '🔍', pulse: true  },
  too_close:  { label: 'Move further away',             color: '#F59E0B', icon: '↔️', pulse: true  },
  off_center: { label: 'Center the bottle in frame',    color: '#F59E0B', icon: '⊕',  pulse: true  },
  too_dark:   { label: 'Too dark — find brighter light',color: '#EF4444', icon: '🌑', pulse: true  },
  too_bright: { label: 'Too bright — find shade',       color: '#EF4444', icon: '☀️', pulse: true  },
  ready:      { label: 'Hold still — ready to capture!',color: '#10B981', icon: '✅', pulse: false },
};

interface TechnicalGuideOverlayProps {
  status?: CaptureStatus;
  onOpenInstructions?: () => void;
}

export const TechnicalGuideOverlay: React.FC<TechnicalGuideOverlayProps> = ({
  status = 'waiting',
  onOpenInstructions,
}) => {
  const cfg = STATUS_CONFIG[status];
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for warning/error states
  useEffect(() => {
    if (cfg.pulse) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  // Border color smooth transition
  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: status === 'ready' ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [status]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      status === 'too_dark' || status === 'too_bright' ? '#EF4444' :
      status === 'waiting' ? 'rgba(14,165,233,0.3)' : '#F59E0B',
      '#10B981',
    ],
  });

  const isReady = status === 'ready';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* ── Top Status Pill ───────────────────────────────────── */}
      <View style={styles.topPillContainer}>
        <Animated.View
          style={[
            styles.statusPill,
            { borderColor: cfg.color, opacity: cfg.pulse ? pulseAnim : 1 },
          ]}>
          <Text style={styles.statusIcon}>{cfg.icon}</Text>
          <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
        </Animated.View>

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

      {/* ── Center Framing Box ────────────────────────────────── */}
      <View style={styles.centerFramingArea}>
        <Animated.View style={[styles.bottleGuideBox, { borderColor }]}>

          {/* Corner brackets — colored by state */}
          {(['tl','tr','bl','br'] as const).map(pos => (
            <View
              key={pos}
              style={[styles.corner, styles[pos], { borderColor: cfg.color }]}
            />
          ))}

          {/* Liquid-Level Target Zone */}
          <View style={[styles.liquidCoreTarget, isReady && styles.liquidCoreTargetReady]}>
            <View style={[styles.horizontalLine, isReady && styles.hLineReady]} />
            <Text style={[styles.liquidCoreLabel, isReady && styles.liquidCoreLabelReady]}>
              LIQUID ZONE
            </Text>
            <View style={[styles.horizontalLine, isReady && styles.hLineReady]} />
          </View>

          {/* Vertical center indicator */}
          <View style={styles.verticalCenterLine} />

          {/* Shadow band indicators */}
          <View style={styles.shadowLeft}  pointerEvents="none" />
          <View style={styles.shadowRight} pointerEvents="none" />
        </Animated.View>

        {/* Ready checkmark badge */}
        {isReady && (
          <Animated.View style={styles.readyBadge}>
            <Text style={styles.readyBadgeText}>✓ READY</Text>
          </Animated.View>
        )}
      </View>

      {/* ── Bottom Environment Tips ───────────────────────────── */}
      <View style={styles.bottomTipsContainer}>
        <View style={styles.tipPill}>
          <Text style={styles.tipText}>☀️ Avoid direct sun</Text>
          <Text style={styles.tipDivider}>|</Text>
          <Text style={styles.tipText}>📄 White background</Text>
          <Text style={styles.tipDivider}>|</Text>
          <Text style={styles.tipText}>🚫 Flash Off</Text>
        </View>
      </View>
    </View>
  );
};

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 3.5;

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
    backgroundColor: 'rgba(11,15,23,0.88)',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 8,
  },
  statusIcon: { fontSize: 13 },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  protoTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14,165,233,0.2)',
    borderColor: JalqTheme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  protoTriggerIcon: { fontSize: 12 },
  protoTriggerText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

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
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Corner brackets
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  tl: { top: -2, left: -2, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 16 },
  tr: { top: -2, right: -2, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 16 },
  bl: { bottom: -2, left: -2, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 16 },
  br: { bottom: -2, right: -2, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 16 },

  // Liquid zone target
  liquidCoreTarget: {
    width: '70%',
    height: '38%',
    borderColor: 'rgba(16,185,129,0.4)',
    borderWidth: 1.5,
    borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liquidCoreTargetReady: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  horizontalLine: {
    width: '40%',
    height: 1,
    backgroundColor: 'rgba(16,185,129,0.3)',
    marginVertical: 2,
  },
  hLineReady: { backgroundColor: '#10B981' },
  liquidCoreLabel: {
    color: 'rgba(16,185,129,0.7)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  liquidCoreLabelReady: { color: '#10B981' },

  verticalCenterLine: {
    position: 'absolute',
    width: 1,
    height: 20,
    backgroundColor: 'rgba(14,165,233,0.4)',
    top: 8,
  },

  // Shadow band visual hints (left/right 15% shaded)
  shadowLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '15%',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  shadowRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '15%',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },

  readyBadge: {
    position: 'absolute',
    bottom: -14,
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readyBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // Bottom tips
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
    backgroundColor: 'rgba(11,15,23,0.82)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    gap: 8,
  },
  tipText: { color: JalqTheme.colors.textSecondary, fontSize: 10, fontWeight: '700' },
  tipDivider: { color: JalqTheme.colors.borderSubtle, fontSize: 10 },
});
