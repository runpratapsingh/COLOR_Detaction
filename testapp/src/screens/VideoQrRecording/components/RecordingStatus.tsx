import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecordingState } from '../types';

interface Props {
  state: RecordingState;
  durationSeconds: number;
  lastQrValue: string | null;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export function RecordingStatus({ state, durationSeconds, lastQrValue }: Props) {
  if (state === 'RECORDING' || state === 'STOPPING') {
    return (
      <View style={styles.container}>
        <Text style={styles.recordingText}>🔴 Recording</Text>
        <Text style={styles.durationText}>Duration: {formatDuration(durationSeconds)}</Text>
        <Text style={styles.hintText}>
          {state === 'STOPPING' ? 'Stopping recording...' : 'Scan target QR to automatically stop'}
        </Text>
      </View>
    );
  }

  if (state === 'QR_DETECTED') {
    return (
      <View style={styles.container}>
        <Text style={styles.recordingText}>QR Detected</Text>
        <Text style={styles.durationText}>Value: {lastQrValue}</Text>
        <Text style={styles.hintText}>Stopping recording...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  recordingText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  durationText: { color: '#fff', fontSize: 14, marginTop: 4 },
  hintText: { color: '#ccc', fontSize: 12, marginTop: 4 },
});
