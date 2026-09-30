import React from 'react';
import { StyleSheet, View } from 'react-native';

export function QROverlay() {
  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.box} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#00E676',
    borderRadius: 12,
  },
});
