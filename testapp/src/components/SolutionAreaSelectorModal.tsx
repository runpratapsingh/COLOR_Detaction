import React, { useEffect, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme } from '../theme/colors';

export type NormalizedRoi = [number, number, number, number]; // [x_min, y_min, x_max, y_max] in 0.0 .. 1.0

interface SolutionAreaSelectorModalProps {
  visible: boolean;
  imageUri: string | null;
  initialLiquidRoi?: NormalizedRoi;
  bottleRoi?: NormalizedRoi;
  onConfirm: (liquidRoi: NormalizedRoi) => void;
  onCancel: () => void;
  title?: string;
}

// Default core liquid area relative to image: [x1, y1, x2, y2]
const DEFAULT_LIQUID_ROI: NormalizedRoi = [0.32, 0.40, 0.68, 0.72];
const DEFAULT_BOTTLE_ROI: NormalizedRoi = [0.22, 0.18, 0.78, 0.88];

export const SolutionAreaSelectorModal: React.FC<SolutionAreaSelectorModalProps> = ({
  visible,
  imageUri,
  initialLiquidRoi = DEFAULT_LIQUID_ROI,
  bottleRoi = DEFAULT_BOTTLE_ROI,
  onConfirm,
  onCancel,
  title = 'Verify Solution Area',
}) => {
  const [roi, setRoi] = useState<NormalizedRoi>(initialLiquidRoi);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    if (visible) {
      setRoi(initialLiquidRoi || DEFAULT_LIQUID_ROI);
    }
  }, [visible, initialLiquidRoi]);

  useEffect(() => {
    if (imageUri) {
      Image.getSize(
        imageUri,
        (w, h) => {
          if (w > 0 && h > 0) {
            setImageSize({ width: w, height: h });
          }
        },
        () => {
          setImageSize({ width: 1080, height: 1920 });
        }
      );
    }
  }, [imageUri]);

  const onContainerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setContainerSize({ width, height });
    }
  };

  // Calculate actual rendered image box inside container with resizeMode="contain"
  const getRenderedImageBox = () => {
    const cw = containerSize.width || 1;
    const ch = containerSize.height || 1;
    const iw = imageSize.width || 1;
    const ih = imageSize.height || 1;

    const containerAspect = cw / ch;
    const imageAspect = iw / ih;

    let rw = cw;
    let rh = ch;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspect > containerAspect) {
      rw = cw;
      rh = cw / imageAspect;
      offsetY = (ch - rh) / 2;
    } else {
      rh = ch;
      rw = ch * imageAspect;
      offsetX = (cw - rw) / 2;
    }

    return { rw, rh, offsetX, offsetY };
  };

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  // Nudge box position
  const nudge = (dx: number, dy: number) => {
    setRoi((prev) => {
      const [x1, y1, x2, y2] = prev;
      const w = x2 - x1;
      const h = y2 - y1;

      let newX1 = clamp(x1 + dx, 0.05, 0.95 - w);
      let newY1 = clamp(y1 + dy, 0.05, 0.95 - h);
      let newX2 = newX1 + w;
      let newY2 = newY1 + h;

      return [
        Math.round(newX1 * 100) / 100,
        Math.round(newY1 * 100) / 100,
        Math.round(newX2 * 100) / 100,
        Math.round(newY2 * 100) / 100,
      ];
    });
  };

  // Resize box dimensions
  const resize = (dw: number, dh: number) => {
    setRoi((prev) => {
      const [x1, y1, x2, y2] = prev;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const curW = x2 - x1;
      const curH = y2 - y1;

      const newW = clamp(curW + dw, 0.15, 0.70);
      const newH = clamp(curH + dh, 0.15, 0.70);

      const newX1 = clamp(cx - newW / 2, 0.05, 0.95 - newW);
      const newY1 = clamp(cy - newH / 2, 0.05, 0.95 - newH);
      const newX2 = newX1 + newW;
      const newY2 = newY1 + newH;

      return [
        Math.round(newX1 * 100) / 100,
        Math.round(newY1 * 100) / 100,
        Math.round(newX2 * 100) / 100,
        Math.round(newY2 * 100) / 100,
      ];
    });
  };

  const handleReset = () => {
    setRoi(DEFAULT_LIQUID_ROI);
  };

  const { rw, rh, offsetX, offsetY } = getRenderedImageBox();
  const [x1, y1, x2, y2] = roi;
  const [bx1, by1, bx2, by2] = bottleRoi;

  // Liquid box pixel coordinates within container
  const boxLeft = offsetX + x1 * rw;
  const boxTop = offsetY + y1 * rh;
  const boxWidth = (x2 - x1) * rw;
  const boxHeight = (y2 - y1) * rh;

  // Bottle guide box pixel coordinates within container
  const bottleLeft = offsetX + bx1 * rw;
  const bottleTop = offsetY + by1 * rh;
  const bottleWidth = (bx2 - bx1) * rw;
  const bottleHeight = (by2 - by1) * rh;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerSlotLeft}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
              onPress={onCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.backBtnText}>✕ Retake</Text>
            </Pressable>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>Adjust box to fit liquid only</Text>
          </View>

          <View style={styles.headerSlotRight}>
            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && styles.btnPressed]}
              onPress={handleReset}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.resetBtnText}>↺ Reset</Text>
            </Pressable>
          </View>
        </View>

        {/* Guidance Callout */}
        <View style={styles.callout}>
          <Text style={styles.calloutIcon}>🧪</Text>
          <Text style={styles.calloutText}>
            Make sure the <Text style={styles.calloutHighlight}>green box</Text> covers only the colored liquid. Keep bottle caps and background out.
          </Text>
        </View>

        {/* Interactive Image Display Area */}
        <View style={styles.imageCanvasContainer} onLayout={onContainerLayout}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.noImagePlaceholder}>
              <Text style={styles.noImageText}>No Image Available</Text>
            </View>
          )}

          {/* Dotted Bottle Outline Guide */}
          {containerSize.width > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.bottleGuideBox,
                {
                  left: bottleLeft,
                  top: bottleTop,
                  width: bottleWidth,
                  height: bottleHeight,
                },
              ]}
            />
          )}

          {/* Emerald Green Solution Detection Box */}
          {containerSize.width > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.liquidRoiBox,
                {
                  left: boxLeft,
                  top: boxTop,
                  width: boxWidth,
                  height: boxHeight,
                },
              ]}>
              {/* Corner Handles */}
              <View style={[styles.roiCorner, styles.cornerTL]} />
              <View style={[styles.roiCorner, styles.cornerTR]} />
              <View style={[styles.roiCorner, styles.cornerBL]} />
              <View style={[styles.roiCorner, styles.cornerBR]} />

              {/* Center Crosshair Target */}
              <View style={styles.roiCenterReticle} />
            </View>
          )}
        </View>

        {/* Coordinate / Tip Bar */}
        <View style={styles.readoutBar}>
          <Text style={styles.readoutText}>
            💡 Use arrows to move box • Use buttons to resize
          </Text>
        </View>

        {/* Interactive Nudge / Adjust Controls */}
        <View style={styles.controlDeck}>
          <View style={styles.padGroup}>
            <Text style={styles.groupLabel}>MOVE BOX</Text>
            <View style={styles.dPad}>
              <Pressable style={styles.padBtn} onPress={() => nudge(0, -0.03)}>
                <Text style={styles.padBtnText}>▲</Text>
              </Pressable>
              <View style={styles.dPadRow}>
                <Pressable style={styles.padBtn} onPress={() => nudge(-0.03, 0)}>
                  <Text style={styles.padBtnText}>◀</Text>
                </Pressable>
                <View style={styles.dPadCenter} />
                <Pressable style={styles.padBtn} onPress={() => nudge(0.03, 0)}>
                  <Text style={styles.padBtnText}>▶</Text>
                </Pressable>
              </View>
              <Pressable style={styles.padBtn} onPress={() => nudge(0, 0.03)}>
                <Text style={styles.padBtnText}>▼</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.padGroup}>
            <Text style={styles.groupLabel}>RESIZE BOX</Text>
            <View style={styles.sizeControlCol}>
              <View style={styles.sizeRow}>
                <Pressable style={styles.sizeBtn} onPress={() => resize(0, 0.04)}>
                  <Text style={styles.sizeBtnText}>↕ Taller</Text>
                </Pressable>
                <Pressable style={styles.sizeBtn} onPress={() => resize(0, -0.04)}>
                  <Text style={styles.sizeBtnText}>↕ Shorter</Text>
                </Pressable>
              </View>
              <View style={styles.sizeRow}>
                <Pressable style={styles.sizeBtn} onPress={() => resize(0.04, 0)}>
                  <Text style={styles.sizeBtnText}>↔ Wider</Text>
                </Pressable>
                <Pressable style={styles.sizeBtn} onPress={() => resize(-0.04, 0)}>
                  <Text style={styles.sizeBtnText}>↔ Narrow</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Confirm Footer */}
        <View style={styles.footer}>
          <Pressable style={styles.confirmBtn} onPress={() => onConfirm(roi)}>
            <Text style={styles.confirmBtnText}>✓ Confirm Liquid Area & Analyze</Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
  },
  headerSlotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 80,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerSlotRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 80,
  },
  backBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: JalqTheme.colors.bgMuted,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
    justifyContent: 'center',
  },
  backBtnText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: JalqTheme.colors.primary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
    textAlign: 'center',
  },
  resetBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: JalqTheme.colors.badgeSuccessBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: JalqTheme.colors.badgeSuccessBorder,
    justifyContent: 'center',
  },
  resetBtnText: {
    color: JalqTheme.colors.badgeSuccessText,
    fontSize: 13,
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: JalqTheme.colors.primaryGlow,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderFocus,
    gap: 8,
  },
  calloutIcon: {
    fontSize: 16,
  },
  calloutText: {
    flex: 1,
    color: JalqTheme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  calloutHighlight: {
    color: JalqTheme.colors.emerald,
    fontWeight: '700',
  },
  imageCanvasContainer: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgDeep,
    margin: 14,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
  },
  noImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: JalqTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  bottleGuideBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
  },
  liquidRoiBox: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: JalqTheme.colors.emerald,
    backgroundColor: JalqTheme.colors.emeraldGlow,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roiCorner: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderColor: JalqTheme.colors.emerald,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  roiCenterReticle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: JalqTheme.colors.emerald,
  },
  readoutBar: {
    backgroundColor: JalqTheme.colors.bgDeep,
    paddingVertical: 7,
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
  },
  readoutText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  controlDeck: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    backgroundColor: JalqTheme.colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: JalqTheme.colors.borderSubtle,
  },
  padGroup: {
    flex: 1,
    alignItems: 'center',
  },
  groupLabel: {
    color: JalqTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dPad: {
    alignItems: 'center',
  },
  dPadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  dPadCenter: {
    width: 28,
    height: 28,
  },
  padBtn: {
    width: 38,
    height: 34,
    backgroundColor: JalqTheme.colors.bgInput,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
  },
  padBtnText: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sizeControlCol: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    width: '100%',
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeBtn: {
    flex: 1,
    height: 36,
    backgroundColor: JalqTheme.colors.bgInput,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
  },
  sizeBtnText: {
    color: JalqTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: JalqTheme.colors.bgCardElevated,
    borderTopWidth: 1,
    borderTopColor: JalqTheme.colors.borderSubtle,
  },
  confirmBtn: {
    backgroundColor: JalqTheme.colors.emerald,
    paddingVertical: 14,
    borderRadius: JalqTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...JalqTheme.shadow.sm,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
