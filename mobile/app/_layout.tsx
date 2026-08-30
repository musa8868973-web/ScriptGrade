/**
 * Root layout — navigation shell + auth gate.
 *
 * Route map (expo-router, file-based):
 *   /            → app/index.tsx          Home: mode picker + exam picker
 *   /login       → app/login/index.tsx    Sign-in
 *   /scanner     → app/scanner/index.tsx  Dual-mode document camera
 *   /preview     → app/preview/index.tsx  Edit, upload, live diagnostics
 *
 * The auth store hydrates from SecureStore on mount; while hydrating a
 * branded splash is shown. Signed-out users are pinned to /login and
 * signed-in users are bounced off it via declarative <Redirect>.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import { colors } from '../lib/theme';

export default function RootLayout(): React.JSX.Element {
  const { status } = useAuth();
  const segments = useSegments();

  const inLoginGroup = segments[0] === 'login';
  const redirectTo =
    status === 'loading'
      ? null
      : status === 'signedOut' && !inLoginGroup
        ? '/login'
        : status === 'signedIn' && inLoginGroup
          ? '/'
          : null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {status === 'loading' ? (
        <View style={styles.splash}>
          <Text style={styles.splashTitle}>ScriptGrade</Text>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.splashHint}>Restoring secure session…</Text>
        </View>
      ) : redirectTo ? (
        <Redirect href={redirectTo} />
      ) : (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login/index" options={{ headerShown: false }} />
          <Stack.Screen
            name="scanner/index"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="preview/index"
            options={{ title: 'Review & Upload' }}
          />
        </Stack>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  splashTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  splashHint: {
    color: colors.textDim,
    fontSize: 13,
  },
});
