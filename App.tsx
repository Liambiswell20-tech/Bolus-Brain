import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, Outfit_400Regular, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAppForeground } from './src/hooks/useAppForeground';
import { getDailyTIRHistory, calculateDailyTIR, storeDailyTIR } from './src/utils/timeInRange';
import { fetchGlucoseRange } from './src/services/nightscout';
import { refreshBackendState } from './src/services/backend';
import { supabase } from './src/services/supabase';
import EquipmentOnboardingScreen from './src/screens/EquipmentOnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import MealLogScreen from './src/screens/MealLogScreen';
import MealHistoryScreen from './src/screens/MealHistoryScreen';
import InsulinLogScreen from './src/screens/InsulinLogScreen';
import EditMealScreen from './src/screens/EditMealScreen';
import EditInsulinScreen from './src/screens/EditInsulinScreen';
import EditHypoScreen from './src/screens/EditHypoScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AccountScreen from './src/screens/AccountScreen';
import HelpScreen from './src/screens/HelpScreen';
import type { InsulinLogType } from './src/services/storage';
import { migrateLegacySessions, loadHypoTreatments, fetchAndStoreHypoRecoveryCurve } from './src/services/storage';
import { getCurrentEquipmentProfile } from './src/utils/equipmentProfile';

export type RootStackParamList = {
  Auth: undefined;
  EquipmentOnboarding: undefined;
  Home: undefined;
  MealLog: undefined;
  MealHistory: undefined;
  InsulinLog: { type: InsulinLogType };
  EditMeal: { mealId: string };
  EditInsulin: { logId: string };
  EditHypo: { treatmentId: string };
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

  const [gateChecked, setGateChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Auth + backend state check on startup
  useEffect(() => {
    (async () => {
      await refreshBackendState();
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    })();

    // Listen for auth state changes (sign in / sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await refreshBackendState();
        setIsAuthenticated(!!session);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    migrateLegacySessions().catch(err =>
      console.warn('[App] migration error:', err)
    );
  }, []);

  // Equipment onboarding gate: show EquipmentOnboardingScreen on first launch
  useEffect(() => {
    getCurrentEquipmentProfile()
      .then(profile => setNeedsOnboarding(profile === null))
      .catch(() => setNeedsOnboarding(true))
      .finally(() => setGateChecked(true));
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

  // Foreground handler — TIR calculation + hypo recovery curve fetch (B2B-06, B2B-07)
  const handleForeground = useCallback(async () => {
    // TIR calculation — once per calendar day
    try {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const history = await getDailyTIRHistory();
      if (!history.some(r => r.date === yesterdayStr)) {
        const startMs = Date.UTC(
          yesterday.getUTCFullYear(),
          yesterday.getUTCMonth(),
          yesterday.getUTCDate()
        );
        const endMs = startMs + 24 * 60 * 60 * 1000 - 1;
        const readings = await fetchGlucoseRange(startMs, endMs);
        const mmolValues = readings.map(r => r.mmol);
        const tir = calculateDailyTIR(mmolValues, yesterdayStr);
        await storeDailyTIR(tir);
      }
    } catch (err) {
      console.warn('[App] TIR foreground calculation failed (non-fatal)', err);
    }

    // Hypo recovery curve fetch — for treatments where 60min window has elapsed
    try {
      const treatments = await loadHypoTreatments();
      const now = Date.now();
      const pending = treatments.filter(t =>
        t.glucose_readings_after === undefined &&
        now - new Date(t.logged_at).getTime() > 60 * 60 * 1000
      );
      for (const treatment of pending) {
        try {
          await fetchAndStoreHypoRecoveryCurve(treatment.id);
        } catch {}
      }
    } catch (err) {
      console.warn('[App] hypo recovery fetch failed (non-fatal)', err);
    }
  }, []);

  useAppForeground(handleForeground);

  // Don't render navigation until fonts are ready (or errored/timed out)
  // and until gate check resolves — prevents flash of wrong initial route
  // fontError: render anyway (fonts will fall back to system)
  if ((!fontsLoaded && !fontError) || !gateChecked) {
    return <View style={{ flex: 1, backgroundColor: '#050706' }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName={
            !isAuthenticated ? 'Auth' : needsOnboarding ? 'EquipmentOnboarding' : 'Home'
          }
          screenOptions={{
            headerStyle: { backgroundColor: '#050706' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#050706' },
          }}
        >
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="EquipmentOnboarding"
            component={EquipmentOnboardingScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
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
          <Stack.Screen name="EditHypo" component={EditHypoScreen} options={{ title: 'Edit treatment' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
          <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help & FAQ' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
