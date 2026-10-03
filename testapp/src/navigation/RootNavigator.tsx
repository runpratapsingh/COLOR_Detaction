import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from './types';
import { JalqTheme } from '../theme/colors';

// Screens
import { LoginScreen } from '../screens/Login/LoginScreen';
import { TestManagerDashboardScreen } from '../screens/TestManagement/TestManagerDashboardScreen';
import { CreateEditTestScreen } from '../screens/TestManagement/CreateEditTestScreen';
import { StandardManagementScreen } from '../screens/TestManagement/StandardManagementScreen';
import { AddStandardScreen } from '../screens/TestManagement/AddStandardScreen';
import { TestListScreen } from '../screens/TestList/TestListScreen';
import { TestDetailsScreen } from '../screens/TestDetails/TestDetailsScreen';
import { IncubationScreen } from '../screens/Incubation/IncubationScreen';
import { CameraCaptureScreen } from '../screens/CameraCapture/CameraCaptureScreen';
import { ResultScreen } from '../screens/Result/ResultScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { session, setSession, logout } = useSession();

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: JalqTheme.colors.bgDark },
      }}>
      {/* 1. Authentication */}
      <Stack.Screen name="Login">
        {({ navigation }) => (
          <LoginScreen
            onLoginSuccess={(userSession) => {
              setSession(userSession);
              if (
                userSession.role === 'TEST_MANAGER' ||
                userSession.role === 'ADMIN'
              ) {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'TestManagerDashboard' }],
                });
              } else {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'TestList' }],
                });
              }
            }}
          />
        )}
      </Stack.Screen>

      {/* 2. Test Manager Screens */}
      <Stack.Screen name="TestManagerDashboard">
        {({ navigation }) =>
          session ? (
            <TestManagerDashboardScreen
              session={session}
              onCreateTest={() => navigation.navigate('CreateEditTest')}
              onEditTest={(testId) =>
                navigation.navigate('CreateEditTest', { testId })
              }
              onManageStandards={(testId) =>
                navigation.navigate('StandardManagement', { testId })
              }
              onPreviewAsTester={(testId) =>
                navigation.navigate('TestDetails', { testId })
              }
              onSwitchToTesterMode={() => navigation.navigate('TestList')}
              onLogout={() => {
                logout();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }}
            />
          ) : null
        }
      </Stack.Screen>

      <Stack.Screen name="CreateEditTest">
        {({ navigation, route }) =>
          session ? (
            <CreateEditTestScreen
              session={session}
              testId={route.params?.testId}
              onBack={() => navigation.goBack()}
              onSaved={(testId) =>
                navigation.replace('StandardManagement', { testId })
              }
            />
          ) : null
        }
      </Stack.Screen>

      <Stack.Screen name="StandardManagement">
        {({ navigation, route }) =>
          session ? (
            <StandardManagementScreen
              session={session}
              testId={route.params.testId}
              onBack={() => navigation.goBack()}
              onAddStandard={(testId) =>
                navigation.navigate('AddStandard', { testId })
              }
              onTestNow={(testId) =>
                navigation.navigate('TestDetails', { testId })
              }
            />
          ) : null
        }
      </Stack.Screen>

      <Stack.Screen name="AddStandard">
        {({ navigation, route }) =>
          session ? (
            <AddStandardScreen
              session={session}
              testId={route.params.testId}
              onBack={() => navigation.goBack()}
              onStandardSaved={() => navigation.goBack()}
            />
          ) : null
        }
      </Stack.Screen>

      {/* 3. Field Tester Screens */}
      <Stack.Screen name="TestList">
        {({ navigation }) =>
          session ? (
            <TestListScreen
              session={session}
              onSelectTest={(testId) =>
                navigation.navigate('TestDetails', { testId })
              }
              onLogout={() => {
                logout();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }}
            />
          ) : null
        }
      </Stack.Screen>

      <Stack.Screen name="TestDetails">
        {({ navigation, route }) => (
          <TestDetailsScreen
            testId={route.params.testId}
            onBack={() => navigation.goBack()}
            onStartIncubation={(test) =>
              navigation.navigate('Incubation', { test })
            }
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Incubation">
        {({ navigation, route }) => (
          <IncubationScreen
            test={route.params.test}
            onBack={() => navigation.goBack()}
            onProceedToCapture={(actualIncubationSecs) =>
              navigation.navigate('CameraCapture', {
                test: route.params.test,
                incubationSeconds: actualIncubationSecs,
              })
            }
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="CameraCapture">
        {({ navigation, route }) => (
          <CameraCaptureScreen
            test={route.params.test}
            incubationSeconds={route.params.incubationSeconds}
            onBack={() => navigation.goBack()}
            onAnalysisComplete={(result, photoUri) =>
              navigation.navigate('Result', {
                test: route.params.test,
                result,
                capturedUri: photoUri,
              })
            }
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Result">
        {({ navigation, route }) => (
          <ResultScreen
            test={route.params.test}
            result={route.params.result}
            capturedUri={route.params.capturedUri}
            onRetake={() => navigation.goBack()}
            onNewTest={() => {
              if (
                session?.role === 'TEST_MANAGER' ||
                session?.role === 'ADMIN'
              ) {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'TestManagerDashboard' }],
                });
              } else {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'TestList' }],
                });
              }
            }}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};
