import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { DrawerProvider } from '@/context/DrawerContext';
import { AnoAcademicoProvider } from '@/context/AnoAcademicoContext';
import { FinanceiroProvider } from '@/context/FinanceiroContext';
import { NotificacoesProvider } from '@/context/NotificacoesContext';
import { LicenseProvider } from '@/context/LicenseContext';
import { UsersProvider } from '@/context/UsersContext';
import { RegistroProvider } from '@/context/RegistroContext';
import { ConfigProvider } from '@/context/ConfigContext';
import { ProfessorProvider } from '@/context/ProfessorContext';
import { PermissoesProvider } from '@/context/PermissoesContext';
import { ToastProvider } from '@/context/ToastContext';
import { ChatInternoProvider } from '@/context/ChatInternoContext';
import FlashScreenOverlay from '@/components/FlashScreenOverlay';
import { OfflineProvider } from '@/context/OfflineContext';
import OfflineBanner from '@/components/OfflineBanner';
import { WebAlertProvider } from '@/utils/webAlert';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('shadow') && msg.includes('style props are deprecated') ||
      msg.includes('useNativeDriver') && msg.includes('not supported') ||
      msg.includes('pointerEvents') && msg.includes('deprecated')
    ) return;
    _warn(...args);
  };
}

// On web, expo-font's fontfaceobserver fires internally even without useFonts().
// Fonts are already loaded via @font-face CSS injected by the Express server.
// Intercept in capture phase (before Replit's logger) to suppress this non-fatal noise.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const isFontTimeout = (msg: unknown): boolean =>
    typeof msg === 'string' && msg.includes('ms timeout exceeded');

  window.addEventListener(
    'unhandledrejection',
    (e) => { if (isFontTimeout(e?.reason?.message)) e.preventDefault(); },
    true,
  );

  window.addEventListener(
    'error',
    (e) => {
      if (isFontTimeout(e?.message) || isFontTimeout((e as any)?.error?.message)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="registro" />
      <Stack.Screen name="licenca" />
      <Stack.Screen name="(main)" />
    </Stack>
  );
}

function AppProviders() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <OfflineProvider>
                <ConfigProvider>
                  <AuthProvider>
                    <PermissoesProvider>
                      <LicenseProvider>
                        <UsersProvider>
                          <RegistroProvider>
                            <DataProvider>
                              <AnoAcademicoProvider>
                                <FinanceiroProvider>
                                  <NotificacoesProvider>
                                    <ProfessorProvider>
                                      <ChatInternoProvider>
                                        <DrawerProvider>
                                          <ToastProvider>
                                            <WebAlertProvider>
                                              <RootLayoutNav />
                                              <FlashScreenOverlay />
                                              <OfflineBanner />
                                            </WebAlertProvider>
                                          </ToastProvider>
                                        </DrawerProvider>
                                      </ChatInternoProvider>
                                    </ProfessorProvider>
                                  </NotificacoesProvider>
                                </FinanceiroProvider>
                              </AnoAcademicoProvider>
                            </DataProvider>
                          </RegistroProvider>
                        </UsersProvider>
                      </LicenseProvider>
                    </PermissoesProvider>
                  </AuthProvider>
                </ConfigProvider>
              </OfflineProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Web layout: fonts are already loaded via @font-face CSS injected by the server.
// useFonts must NOT be called on web — even with {}, fontfaceobserver triggers a 6s timeout.
function WebRootLayout() {
  return <AppProviders />;
}

// Native layout: load fonts via expo-font, hide splash when ready.
function NativeRootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return <AppProviders />;
}

export default function RootLayout() {
  if (Platform.OS === 'web') {
    return <WebRootLayout />;
  }
  return <NativeRootLayout />;
}
