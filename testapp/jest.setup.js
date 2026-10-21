// Mock react-native-screens
jest.mock('react-native-screens', () => {
  const RealComponent = jest.requireActual('react-native').View;
  const ScreenContainer = (props) => <RealComponent {...props} />;
  const Screen = (props) => <RealComponent {...props} />;
  return {
    enableScreens: jest.fn(),
    screensEnabled: jest.fn(() => true),
    ScreenContainer,
    Screen,
    NativeScreen: Screen,
    NativeScreenContainer: ScreenContainer,
  };
});

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return {
    ...actual,
    useFocusEffect: (cb) => {
      React.useEffect(cb, [cb]);
    },
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      reset: jest.fn(),
    }),
  };
});





