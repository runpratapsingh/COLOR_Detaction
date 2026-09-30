import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { SessionProvider } from './src/context/SessionContext';
import { RootNavigator } from './src/navigation';
import { JalqTheme } from './src/theme/colors';

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NavigationContainer>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={JalqTheme.colors.bgDark}
          />
          <RootNavigator />
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
