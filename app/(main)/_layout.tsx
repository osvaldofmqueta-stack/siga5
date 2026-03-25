import React, { useEffect, useCallback, useRef, useState } from 'react';
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
import WelcomeModal from '@/components/WelcomeModal';

export default function MainLayout() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { isLicencaValida, diasRestantes, isLoading: licLoading } = useLicense();
  const router = useRouter();
  const { isDesktop } = useBreakpoint();
  const [showWelcome, setShowWelcome] = useState(false);
  const firstLoadChecked = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login' as any);
      return;
    }
    if (!firstLoadChecked.current) {
      firstLoadChecked.current = true;
      setShowWelcome(true);
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

  return (
    <View style={isDesktop ? styles.desktopContainer : styles.container}>
      {isDesktop && <DrawerLeft />}
      <View style={isDesktop ? styles.desktopContent : styles.flex}>
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
          <Stack.Screen name="controlo-supervisao" />
          <Stack.Screen name="admissao" />
          <Stack.Screen name="visao-geral" />
          <Stack.Screen name="rh-hub" />
          <Stack.Screen name="rh-payroll" />
          <Stack.Screen name="pedagogico" />
          <Stack.Screen name="calendario-academico" />
          <Stack.Screen name="biblioteca" />
          <Stack.Screen name="bolsas" />
          <Stack.Screen name="avaliacao-professores" />
          <Stack.Screen name="chat-interno" />
          <Stack.Screen name="auditoria" />
          <Stack.Screen name="med-integracao" />
          <Stack.Screen name="pagamentos-hub" />
          <Stack.Screen name="documentos-hub" />
        </Stack>
        {isDesktop && <DrawerRight />}
      </View>
      {!isDesktop && <DrawerLeft />}
      {!isDesktop && <DrawerRight />}
      <SessionTimeoutModal
        visible={showModal}
        countdown={countdown}
        onContinue={handleContinue}
        onLogout={handleLogout}
      />
      <ToastManager />
      <WelcomeModal
        visible={showWelcome}
        user={user}
        onFinish={() => setShowWelcome(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
