import React, { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, type CameraDevice, type CodeScanner } from 'react-native-vision-camera';
import { QROverlay } from './QROverlay';

interface Props {
  device: CameraDevice;
  isActive: boolean;
  codeScanner: CodeScanner;
}

export const CameraPreview = forwardRef<Camera, Props>(({ device, isActive, codeScanner }, ref) => {
  return (
    <>
      <Camera
        ref={ref}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        video={true}
        audio={true}
        codeScanner={codeScanner}
      />
      <QROverlay />
    </>
  );
});
