import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { JalqTheme } from '../theme/colors';
import { TechnicalGuideOverlay } from '../screens/CameraCapture/TechnicalGuideOverlay';
import { CaptureInstructionsModal } from './CaptureInstructionsModal';

interface InAppCameraModalProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onCapture: (uri: string) => void;
}

export const InAppCameraModal: React.FC<InAppCameraModalProps> = ({
  visible,
  title = 'Capture Bottle Photo',
  onClose,
  onCapture,
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState<'off' | 'on'>('off');
  const [isCapturing, setIsCapturing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const device = useCameraDevice(cameraPosition);
  const cameraRef = useRef<Camera>(null);

  React.useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [visible, hasPermission, requestPermission]);

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;
    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: false,
      });
      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      setIsCapturing(false);
      onCapture(uri);
    } catch (err: any) {
      setIsCapturing(false);
      console.warn('Camera takePhoto error:', err);
      Alert.alert(
        'Camera Capture Error',
        err.message || 'Failed to capture photo frame. Please try again.',
        [
          { text: 'Retry' },
          {
            text: 'Choose from Gallery',
            onPress: handlePickFromGallery,
          },
        ]
      );
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const pickerResult = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      });

      if (pickerResult.didCancel || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const selectedUri = pickerResult.assets[0].uri;
      if (selectedUri) {
        onCapture(selectedUri);
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Failed to select image from photo library.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={false} />

        {/* Top Control Bar */}
        <View style={styles.topBar}>
          <View style={styles.headerSlotLeft}>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
              onPress={onClose}
              disabled={isCapturing}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeIcon}>✕</Text>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.headerSlotCenter}>
            <View style={styles.titleBadge}>
              <Text style={styles.titleText} numberOfLines={1} ellipsizeMode="tail">
                {title}
              </Text>
            </View>
          </View>

          <View style={styles.headerSlotRight}>
            <Pressable
              style={({ pressed }) => [styles.hwBtn, pressed && styles.btnPressed]}
              onPress={() => setShowInstructions(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.hwIcon}>ℹ️</Text>
            </Pressable>

            {device?.hasTorch && (
              <Pressable
                style={({ pressed }) => [
                  styles.hwBtn,
                  torch === 'on' && styles.hwBtnActive,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => setTorch(torch === 'off' ? 'on' : 'off')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.hwIcon}>⚡</Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [styles.hwBtn, pressed && styles.btnPressed]}
              onPress={() => setCameraPosition(cameraPosition === 'back' ? 'front' : 'back')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.hwIcon}>🔄</Text>
            </Pressable>
          </View>
        </View>

        {/* Viewfinder with Framing Guide */}
        <View style={styles.viewfinderContainer}>
          {device && hasPermission ? (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={visible}
              photo={true}
              torch={torch}
              onError={(error) => {
                console.warn('[InAppCameraModal] Camera error:', error);
              }}
            />
          ) : (
            <View style={styles.fallbackBox}>
              <Text style={styles.fallbackTitle}>Camera Inactive</Text>
              <Text style={styles.fallbackDesc}>
                {hasPermission
                  ? 'Initializing camera sensor...'
                  : 'Camera permission required to align bottle in real-time.'}
              </Text>
              {!hasPermission && (
                <Pressable style={styles.permissionBtn} onPress={requestPermission}>
                  <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Technical Alignment Reticle Frame */}
          <TechnicalGuideOverlay
            statusText="ALIGN BOTTLE INSIDE FRAME • WHITE BACKGROUND"
            isReadyToCapture={!isCapturing}
            onOpenInstructions={() => setShowInstructions(true)}
          />

          {isCapturing && (
            <View style={styles.capturingOverlay}>
              <ActivityIndicator size="large" color={JalqTheme.colors.primary} />
              <Text style={styles.capturingText}>Capturing frame...</Text>
            </View>
          )}
        </View>

        {/* Bottom Shutter Dock */}
        <View style={styles.bottomDock}>
          <Pressable
            style={styles.galleryShortcut}
            onPress={handlePickFromGallery}
            disabled={isCapturing}>
            <Text style={styles.galleryIcon}>🖼️</Text>
            <Text style={styles.galleryLabel}>Gallery</Text>
          </Pressable>

          <View style={styles.shutterWrapper}>
            <Pressable
              style={[styles.shutterOuter, isCapturing && styles.shutterOuterDisabled]}
              onPress={handleTakePhoto}
              disabled={isCapturing || !device}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>

          <View style={styles.dockPlaceholder} />
        </View>

        {/* Photography Protocol Modal */}
        <CaptureInstructionsModal
          visible={showInstructions}
          onClose={() => setShowInstructions(false)}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    zIndex: 10,
  },
  headerSlotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 80,
  },
  headerSlotCenter: {
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
    gap: 8,
  },
  closeBtn: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    gap: 6,
  },
  closeIcon: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  closeText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  titleBadge: {
    height: 38,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: '100%',
  },
  titleText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  hwBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  hwBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  hwIcon: {
    fontSize: 15,
    textAlign: 'center',
    includeFontPadding: false,
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  viewfinderContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  fallbackBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  fallbackTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  fallbackDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  capturingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  capturingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomDock: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  galleryShortcut: {
    alignItems: 'center',
    width: 60,
  },
  galleryIcon: {
    fontSize: 22,
  },
  galleryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  shutterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  shutterOuterDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
  },
  dockPlaceholder: {
    width: 60,
  },
});
