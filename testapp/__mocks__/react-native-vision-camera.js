const React = require('react');

const Camera = React.forwardRef((_props, _ref) => null);
Camera.getCameraPermissionStatus = () => 'not-determined';
Camera.getMicrophonePermissionStatus = () => 'not-determined';
Camera.requestCameraPermission = async () => 'granted';
Camera.requestMicrophonePermission = async () => 'granted';

module.exports = {
  Camera,
  useCameraDevice: () => undefined,
  useCameraPermission: () => ({
    hasPermission: false,
    requestPermission: async () => true,
  }),
  useMicrophonePermission: () => ({
    hasPermission: false,
    requestPermission: async () => true,
  }),
  useCodeScanner: options => options,
};
