import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { RecordingState } from '../types';

interface Props {
  state: RecordingState;
  onStart: () => void;
  onStopManually: () => void;
  onRecordAgain: () => void;
}

export function RecordingControls({ state, onStart, onStopManually, onRecordAgain }: Props) {
  if (state === 'IDLE' || state === 'ERROR') {
    return (
      <Pressable style={styles.button} onPress={onStart}>
        <Text style={styles.buttonText}>Start Recording</Text>
      </Pressable>
    );
  }

  if (state === 'RECORDING') {
    return (
      <Pressable style={[styles.button, styles.stopButton]} onPress={onStopManually}>
        <Text style={styles.buttonText}>Stop Manually</Text>
      </Pressable>
    );
  }

  if (state === 'COMPLETED') {
    return (
      <Pressable style={styles.button} onPress={onRecordAgain}>
        <Text style={styles.buttonText}>Record Again</Text>
      </Pressable>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#2962FF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
  },
  stopButton: {
    backgroundColor: '#D50000',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
