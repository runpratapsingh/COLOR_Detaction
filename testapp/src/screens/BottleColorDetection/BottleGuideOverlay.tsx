import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

interface BottleGuideOverlayProps {
  showGuide?: boolean;
  isScanning?: boolean;
  statusText?: string;
  isBottleDetected?: boolean;
}

export const BottleGuideOverlay: React.FC<BottleGuideOverlayProps> = ({
  showGuide = true,
  isScanning = true,
  statusText = '⚡ FILL BOX • PLAIN BACKGROUND',
  isBottleDetected = false,
}) => {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const rippleAnim1 = useRef(new Animated.Value(0)).current;
  const rippleAnim2 = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showGuide) return;

    // 1. Paytm-style Smooth Vertical Laser Sweeper (Top to Bottom and Back)
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.bezier(0.42, 0, 0.58, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.bezier(0.42, 0, 0.58, 1),
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Corner Brackets Glowing Pulse Breathing Loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Paytm / UPI Radar Expanding Ripple Waves (Circle waves expanding outwards)
    const rippleLoop1 = Animated.loop(
      Animated.timing(rippleAnim1, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    const rippleLoop2 = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(rippleAnim2, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // 4. Subtle Crosshair Reticle Slow Rotation
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    scanLoop.start();
    pulseLoop.start();
    rippleLoop1.start();
    rippleLoop2.start();
    rotateLoop.start();

    return () => {
      scanLoop.stop();
      pulseLoop.stop();
      rippleLoop1.stop();
      rippleLoop2.stop();
      rotateLoop.stop();
    };
  }, [showGuide, scanAnim, pulseAnim, rippleAnim1, rippleAnim2, rotateAnim]);

  if (!showGuide) return null;

  // Vertical laser beam travel across entire bottle height (0 to 300px)
  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 290],
  });

  // Radar ripple scales and opacities
  const rippleScale1 = rippleAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 2.4],
  });
  const rippleOpacity1 = rippleAnim1.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.8, 0.4, 0],
  });

  const rippleScale2 = rippleAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 2.4],
  });
  const rippleOpacity2 = rippleAnim2.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.8, 0.4, 0],
  });

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const themeColor = isBottleDetected ? '#10B981' : '#06B6D4';

  return (
    <View style={styles.overlayContainer} pointerEvents="none">
      {/* Outer Viewfinder Frame Box */}
      <View style={[styles.frameBox, { borderColor: isBottleDetected ? '#10B981' : 'rgba(6, 182, 212, 0.5)' }]}>
        {/* Top Telemetry Header */}
        <View style={styles.telemetryHeader}>
          <Text style={[styles.telemetryTag, { color: themeColor }]}>[ML BOTTLE DETECTOR: ACTIVE]</Text>
          <Text style={styles.telemetryTag}>[CIE D65 CALIBRATION]</Text>
        </View>

        {/* Top Cap Alignment Zone Box */}
        <View style={styles.capOutline}>
          <View style={styles.capBadge}>
            <Text style={styles.capBadgeText}>⬆ ALIGN CAP HERE</Text>
          </View>
        </View>

        {/* Inner Liquid Core ROI Zone (Emerald & Neon Cyan) */}
        <View style={styles.liquidRoiBox}>
          {/* Holographic Matrix Grid Lines */}
          <View style={styles.gridLineH1} />
          <View style={styles.gridLineH2} />
          <View style={styles.gridLineV1} />
          <View style={styles.gridLineV2} />

          {/* Paytm-style Expanding Ripple Wave 1 */}
          <Animated.View
            style={[
              styles.radarRipple,
              {
                borderColor: themeColor,
                transform: [{ scale: rippleScale1 }],
                opacity: rippleOpacity1,
              },
            ]}
          />

          {/* Paytm-style Expanding Ripple Wave 2 */}
          <Animated.View
            style={[
              styles.radarRipple,
              {
                borderColor: themeColor,
                transform: [{ scale: rippleScale2 }],
                opacity: rippleOpacity2,
              },
            ]}
          />

          {/* Central Rotating HUD Crosshair Reticle */}
          <Animated.View style={[styles.reticleContainer, { transform: [{ rotate: spin }] }]}>
            <View style={[styles.reticleCircle, { borderColor: themeColor }]} />
            <View style={[styles.reticleCrossH, { backgroundColor: themeColor }]} />
            <View style={[styles.reticleCrossV, { backgroundColor: themeColor }]} />
          </Animated.View>

          {/* Top Liquid Core Tag */}
          <View style={styles.roiHeaderBadge}>
            <View style={styles.liveGreenDot} />
            <Text style={styles.roiBadgeText}>LIQUID MEASUREMENT CORE</Text>
          </View>

          {/* Side Scale Markings */}
          <View style={styles.leftScaleTicks}>
            <View style={styles.scaleTickMajor} />
            <View style={styles.scaleTickMinor} />
            <View style={styles.scaleTickMajor} />
            <View style={styles.scaleTickMinor} />
            <View style={styles.scaleTickMajor} />
          </View>
          <View style={styles.rightScaleTicks}>
            <View style={styles.scaleTickMajor} />
            <View style={styles.scaleTickMinor} />
            <View style={styles.scaleTickMajor} />
            <View style={styles.scaleTickMinor} />
            <View style={styles.scaleTickMajor} />
          </View>
        </View>

        {/* Paytm-style High-Tech Full Vertical Laser Beam Sweeper */}
        {isScanning && (
          <Animated.View
            style={[
              styles.laserBeamContainer,
              {
                transform: [{ translateY: laserTranslateY }],
              },
            ]}
          >
            <View style={[styles.laserCoreLine, { backgroundColor: themeColor, shadowColor: themeColor }]} />
            <View style={[styles.laserAuraGlow, { backgroundColor: isBottleDetected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(6, 182, 212, 0.35)' }]} />
          </Animated.View>
        )}

        {/* Live Optical Status Banner */}
        <Animated.View style={[styles.scannerStatusBadge, { opacity: pulseAnim, borderColor: themeColor }]}>
          <View style={[styles.activePulseDot, { backgroundColor: themeColor }]} />
          <Text style={[styles.scannerStatusText, { color: themeColor }]}>{statusText}</Text>
        </Animated.View>

        {/* Bottom Base Alignment Indicator */}
        <View style={styles.baseBadge}>
          <Text style={styles.baseBadgeText}>⬇ BOTTLE BASE</Text>
        </View>

        {/* Cyber Neon Precision Corner Brackets (Pulsing Glow) */}
        <Animated.View style={[styles.corner, styles.topLeft, { borderColor: themeColor, opacity: pulseAnim }]} />
        <Animated.View style={[styles.corner, styles.topRight, { borderColor: themeColor, opacity: pulseAnim }]} />
        <Animated.View style={[styles.corner, styles.bottomLeft, { borderColor: themeColor, opacity: pulseAnim }]} />
        <Animated.View style={[styles.corner, styles.bottomRight, { borderColor: themeColor, opacity: pulseAnim }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  frameBox: {
    width: '76%',
    height: '86%',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.45)',
    borderStyle: 'dashed',
    borderRadius: 22,
    backgroundColor: 'rgba(6, 182, 212, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  telemetryHeader: {
    position: 'absolute',
    top: 8,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 6,
  },
  telemetryTag: {
    color: '#06B6D4',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  capOutline: {
    position: 'absolute',
    top: '6%',
    width: '52%',
    height: '13%',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  capBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  capBadgeText: {
    color: '#FBBF24',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  liquidRoiBox: {
    position: 'absolute',
    top: '26%',
    width: '84%',
    height: '54%',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridLineH1: {
    position: 'absolute',
    top: '33%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  gridLineH2: {
    position: 'absolute',
    top: '66%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  gridLineV1: {
    position: 'absolute',
    left: '33%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  gridLineV2: {
    position: 'absolute',
    left: '66%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  radarRipple: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
  },
  reticleContainer: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  reticleCrossH: {
    position: 'absolute',
    width: 44,
    height: 1.5,
  },
  reticleCrossV: {
    position: 'absolute',
    width: 1.5,
    height: 44,
  },
  roiHeaderBadge: {
    position: 'absolute',
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.35)',
    borderColor: '#34D399',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 5,
    gap: 5,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  roiBadgeText: {
    color: '#ECFDF5',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  laserBeamContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 10,
    zIndex: 8,
  },
  laserCoreLine: {
    height: 3,
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  laserAuraGlow: {
    height: 24,
    marginTop: -13.5,
    borderRadius: 12,
  },
  leftScaleTicks: {
    position: 'absolute',
    left: 4,
    top: '15%',
    bottom: '15%',
    justifyContent: 'space-between',
  },
  rightScaleTicks: {
    position: 'absolute',
    right: 4,
    top: '15%',
    bottom: '15%',
    justifyContent: 'space-between',
  },
  scaleTickMajor: {
    width: 8,
    height: 1.5,
    backgroundColor: 'rgba(6, 182, 212, 0.7)',
  },
  scaleTickMinor: {
    width: 4,
    height: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.4)',
  },
  scannerStatusBadge: {
    position: 'absolute',
    bottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 7,
    zIndex: 7,
  },
  activePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  scannerStatusText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  baseBadge: {
    position: 'absolute',
    bottom: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#34D399',
    zIndex: 5,
  },
  baseBadgeText: {
    color: '#ECFDF5',
    fontSize: 8,
    fontWeight: '900',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
});
