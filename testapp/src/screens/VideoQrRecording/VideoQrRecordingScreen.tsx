import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import Video from 'react-native-video';

import { CameraPreview } from './components/CameraPreview';
import { RecordingControls } from './components/RecordingControls';
import { RecordingStatus } from './components/RecordingStatus';
import { useVideoRecording } from './hooks/useVideoRecording';
import { useQRCodeDetection } from './hooks/useQRCodeDetection';

const log = (...args: unknown[]) => console.log('[Camera]', ...args);

export function VideoQrRecordingScreen() {
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');

  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } =
    useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } =
    useMicrophonePermission();

  const [isAppForeground, setIsAppForeground] = useState(true);
  const [isScreenMounted, setIsScreenMounted] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { state, errorMessage, video, startRecording, requestStop, reset } =
    useVideoRecording(cameraRef);

  const { codeScanner, lastQrValue, resetDetection } = useQRCodeDetection({
    isActive: state === 'RECORDING',
    onValidQRDetected: () => {
      requestStop();
    },
  });

  // Request permissions on mount.
  useEffect(() => {
    if (!hasCameraPermission) {
      requestCameraPermission()
        .then(granted => log('Camera permission', granted ? 'granted' : 'denied'))
        .catch(e => console.error('[Camera] Permission request failed', e));
    }
    if (!hasMicPermission) {
      requestMicPermission()
        .then(granted => log('Microphone permission', granted ? 'granted' : 'denied'))
        .catch(e => console.error('[Camera] Permission request failed', e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App background/foreground handling: stop an in-progress recording if the
  // app is backgrounded, since the camera session becomes inactive anyway.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const foreground = nextState === 'active';
      setIsAppForeground(foreground);
      if (!foreground && state === 'RECORDING') {
        log('App backgrounded during recording, stopping');
        requestStop();
      }
    });
    return () => subscription.remove();
  }, [state, requestStop]);

  // Screen unmount handling: stop an in-progress recording rather than
  // leaving the recorder/camera session dangling.
  useEffect(() => {
    setIsScreenMounted(true);
    return () => {
      setIsScreenMounted(false);
      if (state === 'RECORDING') {
        log('Screen unmounting during recording, stopping');
        requestStop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Duration timer, only while actively recording.
  useEffect(() => {
    if (state === 'RECORDING') {
      setDurationSeconds(0);
      durationTimer.current = setInterval(() => {
        setDurationSeconds(d => d + 1);
      }, 1000);
    } else {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
    }
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
    };
  }, [state]);

  const handleRecordAgain = useCallback(() => {
    resetDetection();
    reset();
  }, [resetDetection, reset]);

  const isCameraActive = isAppForeground && isScreenMounted && (state === 'RECORDING' || state === 'STARTING');

  if (!hasCameraPermission || !hasMicPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Camera and microphone permissions are required to record video.
        </Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No camera device found on this phone.</Text>
      </View>
    );
  }

  if (state === 'COMPLETED' && video) {
    return (
      <View style={styles.completedContainer}>
        <Text style={styles.completedTitle}>Recording Completed</Text>
        <Text style={styles.completedLabel}>QR:</Text>
        <Text style={styles.completedValue}>{lastQrValue ?? '(stopped manually)'}</Text>
        <Text style={styles.completedLabel}>Duration:</Text>
        <Text style={styles.completedValue}>{video.duration.toFixed(1)}s</Text>
        <Text style={styles.completedLabel}>Video:</Text>
        <Text style={styles.completedValue} numberOfLines={2}>
          {video.path}
        </Text>
        <Video
          source={{ uri: video.path }}
          style={styles.videoPreview}
          controls
          paused={false}
          resizeMode="contain"
        />
        <RecordingControls
          state={state}
          onStart={startRecording}
          onStopManually={requestStop}
          onRecordAgain={handleRecordAgain}
        />
      </View>
    );
  }

  if (state === 'ERROR') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {errorMessage}</Text>
        <RecordingControls
          state={state}
          onStart={startRecording}
          onStopManually={requestStop}
          onRecordAgain={handleRecordAgain}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraPreview
        ref={cameraRef}
        device={device}
        isActive={isCameraActive}
        codeScanner={codeScanner}
      />
      <RecordingStatus state={state} durationSeconds={durationSeconds} lastQrValue={lastQrValue} />
      <View style={styles.controlsContainer}>
        <RecordingControls
          state={state}
          onStart={startRecording}
          onStopManually={requestStop}
          onRecordAgain={handleRecordAgain}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  completedContainer: { flex: 1, backgroundColor: '#000', padding: 24, paddingTop: 60 },
  completedTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  completedLabel: { color: '#999', fontSize: 13, marginTop: 8 },
  completedValue: { color: '#fff', fontSize: 15 },
  videoPreview: { width: '100%', height: 240, backgroundColor: '#111', marginTop: 16, marginBottom: 16 },
});
