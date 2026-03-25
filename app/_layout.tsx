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

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
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
                                            <RootLayoutNav />
                                            <FlashScreenOverlay />
                                            <OfflineBanner />
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
