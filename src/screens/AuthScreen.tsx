import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '../theme';
import { supabase } from '../services/supabase';
import { refreshBackendState } from '../services/backend';
import { hasLocalData, migrateLocalDataToSupabase } from '../services/dataMigration';
import type { RootStackParamList } from '../../App';

type Mode = 'sign-in' | 'sign-up';

export default function AuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Auth'>>();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;

        // If email confirmation is enabled, there's no session yet
        if (!data.session) {
          Alert.alert(
            'Check your email',
            'We sent a confirmation link to ' + trimmedEmail + '. Tap it, then come back and sign in.',
          );
          setMode('sign-in');
          setLoading(false);
          return;
        }

        // Session exists (email confirmation disabled) — create profile row
        await supabase.from('profiles').upsert({
          id: data.session.user.id,
          display_name: '',
          email: trimmedEmail,
        });
        await supabase.from('user_settings').upsert({
          user_id: data.session.user.id,
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
      }

      // Sync backend state so isSupabaseActive() returns true
      await refreshBackendState();

      // Migrate local data to Supabase if any exists
      if (await hasLocalData()) {
        setMigrationStatus('Migrating your data...');
        try {
          await migrateLocalDataToSupabase(step => setMigrationStatus(step));
        } catch (err) {
          console.warn('[AuthScreen] migration error (non-fatal):', err);
        }
        setMigrationStatus(null);
      }

      // Navigate into the app — equipment gate in App.tsx decides the route
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err: any) {
      const message = err?.message ?? 'Something went wrong. Try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>BolusBrain</Text>
        <Text style={styles.subtitle}>
          {mode === 'sign-in' ? 'Sign in to your account' : 'Create your account'}
        </Text>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
        </View>

        <Pressable
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.submitBtnText}>
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        {migrationStatus && (
          <View style={styles.migrationRow}>
            <ActivityIndicator size="small" color={COLORS.textSecondary} />
            <Text style={styles.migrationText}>{migrationStatus}</Text>
          </View>
        )}

        <Pressable
          style={styles.toggleBtn}
          onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        >
          <Text style={styles.toggleText}>
            {mode === 'sign-in'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 24, paddingTop: 80, paddingBottom: 48 },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.separator, marginLeft: 16 },
  field: { padding: 16, gap: 6 },
  label: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  input: {
    fontSize: 17,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 10,
    padding: 12,
  },
  submitBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#000', fontSize: 17, fontWeight: '700' },
  migrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  migrationText: { color: COLORS.textSecondary, fontSize: 14 },
  toggleBtn: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: COLORS.blue, fontSize: 15 },
});
