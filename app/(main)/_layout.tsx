import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import DrawerLeft from '@/components/DrawerLeft';
import DrawerRight from '@/components/DrawerRight';
import { useAuth } from '@/context/AuthContext';
import { useLicense } from '@/context/LicenseContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import SessionTimeoutModal, { useSessionTimeout } from '@/components/SessionTimeoutModal';
import ToastManager from '@/components/ToastManager';

export default function MainLayout() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { isLicencaValida, diasRestantes, isLoading: licLoading } = useLicense();
  const router = useRouter();
  const { isDesktop } = useBreakpoint();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login' as any);
      return;
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (licLoading) return;
    if (user?.role === 'ceo') return;
    if (!isLicencaValida || diasRestantes < 0) {
      router.replace('/licenca' as any);
    }
  }, [isLicencaValida, diasRestantes, licLoading, user]);

  const handleSessionLogout = useCallback(async () => {
    await logout();
    router.replace('/login' as any);
  }, [logout, router]);

  const { showModal, countdown, handleContinue, handleLogout } = useSessionTimeout(
    handleSessionLogout,
    !!user
  );

  const stackScreens = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="alunos" />
      <Stack.Screen name="professores" />
      <Stack.Screen name="turmas" />
      <Stack.Screen name="salas" />
      <Stack.Screen name="notas" />
      <Stack.Screen name="presencas" />
      <Stack.Screen name="eventos" />
      <Stack.Screen name="relatorios" />
      <Stack.Screen name="horario" />
      <Stack.Screen name="grelha" />
      <Stack.Screen name="financeiro" />
      <Stack.Screen name="notificacoes" />
      <Stack.Screen name="perfil" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="historico" />
      <Stack.Screen name="ceo" />
      <Stack.Screen name="professor-hub" />
      <Stack.Screen name="professor-pauta" />
      <Stack.Screen name="professor-turmas" />
      <Stack.Screen name="professor-mensagens" />
      <Stack.Screen name="professor-materiais" />
      <Stack.Screen name="professor-sumario" />
      <Stack.Screen name="rh-controle" />
      <Stack.Screen name="portal-estudante" />
      <Stack.Screen name="secretaria-hub" />
      <Stack.Screen name="gestao-academica" />
      <Stack.Screen name="editor-documentos" />
      <Stack.Screen name="boletim-matricula" />
      <Stack.Screen name="boletim-propina" />
      <Stack.Screen name="gestao-acessos" />
      <Stack.Screen name="portal-encarregado" />
    </Stack>
  );

  if (isDesktop) {
    return (
      <View style={styles.desktopContainer}>
        <DrawerLeft />
        <View style={styles.desktopContent}>
          {stackScreens}
          <DrawerRight />
        </View>
        <SessionTimeoutModal
          visible={showModal}
          countdown={countdown}
          onContinue={handleContinue}
          onLogout={handleLogout}
        />
        <ToastManager />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {stackScreens}
      <DrawerLeft />
      <DrawerRight />
      <SessionTimeoutModal
        visible={showModal}
        countdown={countdown}
        onContinue={handleContinue}
        onLogout={handleLogout}
      />
      <ToastManager />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  desktopContent: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  } as any,
});
