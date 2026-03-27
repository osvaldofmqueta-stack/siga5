import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  Platform, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors } from '@/constants/colors';
import { useDrawer } from '@/context/DrawerContext';
import { useAuth } from '@/context/AuthContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.75, 290);

const roleColors: Record<string, string> = {
  ceo: '#8B5CF6', pca: Colors.gold, admin: Colors.info, director: Colors.gold,
  chefe_secretaria: '#E11D48',
  secretaria: Colors.info, professor: Colors.success, aluno: Colors.success,
  financeiro: Colors.warning, encarregado: '#F97316', rh: '#06B6D4',
};
const roleLabels: Record<string, string> = {
  ceo: 'CEO', pca: 'Presidente', admin: 'Administrador', director: 'Director',
  chefe_secretaria: 'Chefe de Secretaria',
  secretaria: 'Secretária Académica', professor: 'Professor', aluno: 'Aluno',
  financeiro: 'Gestor Financeiro', encarregado: 'Encarregado', rh: 'Recursos Humanos',
};

export default function DrawerRight() {
  const { rightOpen, closeRight } = useDrawer();
  const insets = useSafeAreaInsets();
  const { user, logout, setBiometric } = useAuth();
  const router = useRouter();
  const { isDesktop } = useBreakpoint();

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const confirmAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const nd = Platform.OS !== 'web';
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: rightOpen ? 0 : DRAWER_WIDTH,
        useNativeDriver: nd,
        damping: 20,
        stiffness: 200,
      }),
      Animated.timing(opacity, {
        toValue: rightOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: nd,
      }),
    ]).start();

    if (!rightOpen) {
      setConfirmLogout(false);
    }
  }, [rightOpen]);

  useEffect(() => {
    const nd = Platform.OS !== 'web';
    Animated.spring(confirmAnim, {
      toValue: confirmLogout ? 1 : 0,
      useNativeDriver: nd,
      damping: 18,
      stiffness: 200,
    }).start();
  }, [confirmLogout]);

  const topInset = isDesktop ? 0 : Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = isDesktop ? 0 : Platform.OS === 'web' ? 34 : insets.bottom;

  async function toggleBiometric(val: boolean) {
    if (val) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return;
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) return;
    }
    await setBiometric(val);
  }

  async function doLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      closeRight();
      router.replace('/login' as any);
    } catch {
      setIsLoggingOut(false);
      setConfirmLogout(false);
    }
  }

  const roleColor = roleColors[user?.role ?? ''] ?? Colors.success;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: rightOpen ? 'auto' : 'none' } as any]}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeRight} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { transform: [{ translateX }], paddingTop: topInset + 12, paddingBottom: bottomInset }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={closeRight} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.nome?.charAt(0) ?? 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.nome}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: `${roleColor}20` }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>
              {roleLabels[user?.role ?? ''] ?? user?.role}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Segurança</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="finger-print" size={20} color={Colors.gold} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Autenticação Biométrica</Text>
              <Text style={styles.settingDesc}>Impressão digital / Face ID</Text>
            </View>
            <Switch
              value={user?.biometricEnabled ?? false}
              onValueChange={toggleBiometric}
              trackColor={{ false: Colors.surface, true: Colors.gold }}
              thumbColor={Colors.text}
            />
          </View>

          <Text style={styles.sectionTitle}>Escola</Text>

          <View style={styles.infoRow}>
            <Ionicons name="school-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Instituição</Text>
              <Text style={styles.infoValue}>{user?.escola}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Ano Lectivo</Text>
              <Text style={styles.infoValue}>2025</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>País</Text>
              <Text style={styles.infoValue}>Angola</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Sobre</Text>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Versão</Text>
              <Text style={styles.infoValue}>SGAA v1.0.0</Text>
            </View>
          </View>
        </ScrollView>

        {/* Logout area */}
        {!confirmLogout ? (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setConfirmLogout(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={styles.logoutText}>Terminar Sessão</Text>
          </TouchableOpacity>
        ) : (
          <Animated.View style={[styles.confirmBox, { opacity: confirmAnim, transform: [{ scale: confirmAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }]}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="log-out" size={24} color={Colors.danger} />
            </View>
            <Text style={styles.confirmTitle}>Terminar Sessão?</Text>
            <Text style={styles.confirmSub}>A sua sessão será encerrada.</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setConfirmLogout(false)}
                disabled={isLoggingOut}
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSairBtn, isLoggingOut && { opacity: 0.6 }]}
                onPress={doLogout}
                disabled={isLoggingOut}
              >
                <Ionicons name={isLoggingOut ? 'ellipsis-horizontal' : 'log-out'} size={15} color="#fff" />
                <Text style={styles.confirmSairText}>{isLoggingOut ? 'A sair...' : 'Sair'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.primaryDark,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: Colors.gold,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(240,165,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: { flex: 1 },
  settingLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  settingDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(231,76,60,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.3)',
  },
  logoutText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.danger,
  },

  confirmBox: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.35)',
    alignItems: 'center',
    gap: 6,
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(231,76,60,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  confirmTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  confirmSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  confirmSairBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  confirmSairText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
