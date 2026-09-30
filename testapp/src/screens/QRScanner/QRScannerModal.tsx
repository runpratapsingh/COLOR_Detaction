import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { JalqTheme } from '../../theme/colors';

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onTestIdentified: (testId: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onTestIdentified,
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  React.useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [visible, hasPermission, requestPermission]);

  const parseQrValue = (value: string) => {
    if (!value) return null;
    const clean = value.trim();

    // 1. Check URI format: JALQ://TEST/IRON_001/V1
    if (clean.toUpperCase().startsWith('JALQ://TEST/')) {
      const parts = clean.split('/');
      if (parts.length >= 4 && parts[3]) {
        return parts[3].toUpperCase();
      }
    }

    // 2. Check JSON payload: {"type":"TEST","test_id":"IRON_001"}
    try {
      const parsed = JSON.parse(clean);
      if (parsed && typeof parsed === 'object' && parsed.test_id) {
        return String(parsed.test_id).toUpperCase();
      }
    } catch {
      // Not JSON, continue
    }

    // 3. Direct test code format e.g. IRON_001 or CHEM_001
    if (clean.includes('IRON') || clean.includes('CHEM') || clean.length >= 4) {
      return clean.toUpperCase();
    }

    return null;
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'code-128'],
    onCodeScanned: (codes) => {
      if (isProcessing || codes.length === 0) return;
      const rawValue = codes[0].value;
      if (!rawValue) return;

      const parsedId = parseQrValue(rawValue);
      if (parsedId) {
        setIsProcessing(true);
        onTestIdentified(parsedId);
        onClose();
        setTimeout(() => setIsProcessing(false), 1000);
      }
    },
  });

  const handleManualSubmit = () => {
    const parsed = parseQrValue(manualCode);
    if (parsed) {
      onTestIdentified(parsed);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Scan Test QR Code</Text>
              <Text style={styles.headerSubtitle}>
                Point camera at the reaction assay packet QR code
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Viewfinder Area */}
          <View style={styles.viewfinderContainer}>
            {device && hasPermission ? (
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={visible}
                codeScanner={codeScanner}
              />
            ) : (
              <View style={styles.noCameraBox}>
                <Text style={styles.noCameraText}>
                  {hasPermission ? 'Initializing Camera...' : 'Camera permission required.'}
                </Text>
              </View>
            )}

            {/* Target Reticle Overlay */}
            <View style={styles.reticle}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
              <Text style={styles.reticleLabel}>ALIGN QR WITHIN FRAME</Text>
            </View>
          </View>

          {/* Manual Input Fallback */}
          <View style={styles.manualBox}>
            <Text style={styles.manualLabel}>OR ENTER TEST ID MANUALLY</Text>
            <View style={styles.manualInputRow}>
              <TextInput
                style={styles.manualInput}
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="e.g. IRON_001"
                placeholderTextColor={JalqTheme.colors.textMuted}
                autoCapitalize="characters"
              />
              <Pressable style={styles.manualSubmitBtn} onPress={handleManualSubmit}>
                <Text style={styles.manualSubmitText}>Open Test</Text>
              </Pressable>
            </View>

            {/* Quick Presets for Demo Presentation */}
            <View style={styles.quickPresetRow}>
              <Pressable
                style={styles.presetChip}
                onPress={() => {
                  onTestIdentified('IRON_001');
                  onClose();
                }}>
                <Text style={styles.presetChipText}>🧪 Open IRON_001</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 14, 0.92)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomColor: JalqTheme.colors.borderSubtle,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: JalqTheme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: JalqTheme.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: JalqTheme.colors.bgCardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: JalqTheme.colors.textPrimary,
    fontWeight: '700',
  },
  viewfinderContainer: {
    height: 280,
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noCameraBox: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noCameraText: {
    color: JalqTheme.colors.textMuted,
    fontSize: 13,
  },
  reticle: {
    width: 190,
    height: 190,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: JalqTheme.colors.emerald,
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  reticleLabel: {
    color: JalqTheme.colors.emerald,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  manualBox: {
    padding: 18,
  },
  manualLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: JalqTheme.colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  manualInput: {
    flex: 1,
    backgroundColor: JalqTheme.colors.bgInput,
    borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: JalqTheme.colors.textPrimary,
    fontSize: 13,
  },
  manualSubmitBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  manualSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  quickPresetRow: {
    marginTop: 12,
    flexDirection: 'row',
  },
  presetChip: {
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderColor: JalqTheme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  presetChipText: {
    color: JalqTheme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
});
