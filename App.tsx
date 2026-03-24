import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, Outfit_400Regular, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import MealLogScreen from './src/screens/MealLogScreen';
import MealHistoryScreen from './src/screens/MealHistoryScreen';
import InsulinLogScreen from './src/screens/InsulinLogScreen';
import EditMealScreen from './src/screens/EditMealScreen';
import EditInsulinScreen from './src/screens/EditInsulinScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AccountScreen from './src/screens/AccountScreen';
import HelpScreen from './src/screens/HelpScreen';
import type { InsulinLogType } from './src/services/storage';
import { migrateLegacySessions } from './src/services/storage';

export type RootStackParamList = {
  Home: undefined;
  MealLog: undefined;
  MealHistory: undefined;
  InsulinLog: { type: InsulinLogType };
  EditMeal: { mealId: string };
  EditInsulin: { logId: string };
  Settings: undefined;
  Account: undefined;
  Help: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    migrateLegacySessions().catch(err =>
      console.warn('[App] migration error:', err)
    );
  }, []);

  // Release splash when fonts ready OR after error
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // 5-second timeout fallback: release splash regardless
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Don't render navigation until fonts are ready (or errored/timed out)
  // fontError: render anyway (fonts will fall back to system)
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#050706' }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#050706' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#050706' },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="MealLog" component={MealLogScreen} options={{ title: 'Log meal' }} />
          <Stack.Screen name="MealHistory" component={MealHistoryScreen} options={{ title: 'History' }} />
          <Stack.Screen
            name="InsulinLog"
            component={InsulinLogScreen}
            options={({ route }) => ({
              title: route.params.type === 'long-acting'
                ? 'Long-acting insulin'
                : route.params.type === 'tablets'
                ? 'Tablets'
                : 'Correction dose',
            })}
          />
          <Stack.Screen name="EditMeal" component={EditMealScreen} options={{ title: 'Edit meal' }} />
          <Stack.Screen name="EditInsulin" component={EditInsulinScreen} options={{ title: 'Edit entry' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
          <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help & FAQ' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
