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
import FlashScreenOverlay from '@/components/FlashScreenOverlay';
import ToastManager from '@/components/ToastManager';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

// On web, expo-font internally uses fontfaceobserver which fires an unhandledrejection
// when fonts take longer than 6s to load (even with an empty font map).
// Fonts are already loaded via server-injected @font-face CSS, so this is safe to suppress.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg: string = event?.reason?.message ?? '';
    if (msg.includes('timeout exceeded')) {
      event.preventDefault();
    }
  });
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
                                    <DrawerProvider>
                                      <RootLayoutNav />
                                      <FlashScreenOverlay />
                                    </DrawerProvider>
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
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  // On web, fonts are loaded via server-injected @font-face CSS (server/index.ts).
  // Passing an empty map avoids fontfaceobserver which times out on web.
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === 'web'
      ? {}
      : { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold }
  );

  useEffect(() => {
    if (Platform.OS !== 'web' && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (Platform.OS === 'web') {
    return <AppProviders />;
  }

  if (!fontsLoaded && !fontError) return null;

  return <AppProviders />;
}
