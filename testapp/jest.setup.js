// Mock react-native-screens
jest.mock('react-native-screens', () => {
  const RealComponent = jest.requireActual('react-native').View;
  const ScreenContainer = (props: any) => <RealComponent {...props} />;
  const Screen = (props: any) => <RealComponent {...props} />;
  return {
    enableScreens: jest.fn(),
    screensEnabled: jest.fn(() => true),
    ScreenContainer,
    Screen,
    NativeScreen: Screen,
    NativeScreenContainer: ScreenContainer,
  };
});
