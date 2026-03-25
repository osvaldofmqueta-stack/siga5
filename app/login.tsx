import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
  Platform, Animated, KeyboardAvoidingView, ScrollView, Dimensions, Image, ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useAuth, saveAuthToken } from '@/context/AuthContext';
import type { AuthUser } from '@/context/AuthContext';
import { useUsers } from '@/context/UsersContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const { width, height } = Dimensions.get('window');

const CEO_ACCOUNT = {
  email: 'ceo@sige.ao',
  senha: 'Sige@2025',
  role: 'ceo' as const,
  nome: 'Administrador SIGE',
  id: 'usr_ceo',
  escola: 'SIGE — Sistema Integral de Gestão Escolar',
};

const FINANCEIRO_ACCOUNT = {
  email: 'financeiro@sige.ao',
  senha: 'Financeiro@2025',
  role: 'financeiro' as const,
  nome: 'Gestor Financeiro',
  id: 'usr_financeiro_001',
  escola: 'SIGE — Sistema Integral de Gestão Escolar',
};

const SECRETARIA_ACCOUNT = {
  email: 'secretaria@sige.ao',
  senha: 'Secretaria@2025',
  role: 'secretaria' as const,
  nome: 'Secretária Académica',
  id: 'usr_secretaria_001',
  escola: 'SIGE — Sistema Integral de Gestão Escolar',
};

const RH_ACCOUNT = {
  email: 'rh@sige.ao',
  senha: 'RH@2025',
  role: 'rh' as const,
  nome: 'Gestor de Recursos Humanos',
  id: 'usr_rh_001',
  escola: 'SIGE — Sistema Integral de Gestão Escolar',
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, logout, lastUser, clearLastUser, user, isLoading: authLoading } = useAuth();
  const { users, findByCredentials } = useUsers();
  const { isDesktop } = useBreakpoint();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'senha' | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'faceid' | 'none'>('none');
  const [showBiometricWelcome, setShowBiometricWelcome] = useState(false);
  const [inscricoesAbertas, setInscricoesAbertas] = useState(false);
  const [alertModal, setAlertModal] = useState<{ visible: boolean; title: string; message: string; type: 'error' | 'success' }>({ visible: false, title: '', message: '', type: 'error' });

  function showAlert(title: string, message: string, type: 'error' | 'success' = 'error') {
    setAlertModal({ visible: true, title, message, type });
  }

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const biometricPulse = useRef(new Animated.Value(1)).current;
  const biometricGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initLogin();
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(getRouteForRole(user.role) as any);
    }
  }, [user, authLoading]);

  function getRouteForRole(role: string): string {
    if (role === 'ceo' || role === 'pca') return '/(main)/ceo';
    if (role === 'secretaria') return '/(main)/secretaria-hub';
    if (role === 'professor') return '/(main)/professor-hub';
    if (role === 'aluno') return '/(main)/portal-estudante';
    if (role === 'encarregado') return '/(main)/portal-encarregado';
    if (role === 'rh') return '/(main)/rh-hub';
    return '/(main)/dashboard';
  }

  useEffect(() => {
    if (showBiometricWelcome) {
      startBiometricAnimation();
    }
  }, [showBiometricWelcome]);

  async function initLogin() {
    try {
      const res = await fetch('/api/public/inscricoes-status');
      if (res.ok) {
        const data = await res.json();
        setInscricoesAbertas(!!data.abertas);
      }
    } catch { /* network silencioso */ }

    const hasHardware = await checkBiometricAvailability();

    const shouldShowBiometric =
      Platform.OS !== 'web' &&
      hasHardware &&
      lastUser?.biometricEnabled === true;

    if (shouldShowBiometric) {
      setShowBiometricWelcome(true);
      animateEntrance();
      setTimeout(() => triggerBiometricAuth(), 800);
    } else {
      setShowBiometricWelcome(false);
      animateEntrance();
    }
  }

  function animateEntrance() {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 100 }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 90 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(footerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }

  function startBiometricAnimation() {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(biometricPulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
          Animated.timing(biometricGlow, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(biometricPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(biometricGlow, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }

  async function checkBiometricAvailability(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        setBiometricAvailable(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setBiometricType(
          types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'faceid' : 'fingerprint'
        );
        return true;
      }
    } catch {}
    return false;
  }

  async function triggerBiometricAuth() {
    if (!lastUser) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Bem-vindo de volta, ${lastUser.nome.split(' ')[0]}`,
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar código',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsLoading(true);
        const authUser: AuthUser = { ...lastUser, biometricEnabled: true, avatar: lastUser.avatar };
        await login(authUser);
        router.replace(getRouteForRole(lastUser.role) as any);
      }
    } catch (e) {
      console.error('Biometric auth error:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBiometricAuth() {
    if (Platform.OS === 'web') {
      showAlert('Não disponível', 'Autenticação biométrica não está disponível na versão web.');
      return;
    }
    if (showBiometricWelcome && lastUser) {
      await triggerBiometricAuth();
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autentique-se para aceder ao SIGE',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar código',
        disableDeviceFallback: false,
      });
      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const emailTrimmed = email.toLowerCase().trim();
        if (!emailTrimmed) {
          showAlert('Email necessário', 'Introduza primeiro o seu email e depois use a autenticação biométrica.');
          return;
        }
        setIsLoading(true);
        const bioAvatar = lastUser?.email?.toLowerCase() === emailTrimmed ? lastUser?.avatar : undefined;
        if (emailTrimmed === CEO_ACCOUNT.email) {
          const u: AuthUser = { id: CEO_ACCOUNT.id, nome: CEO_ACCOUNT.nome, email: CEO_ACCOUNT.email, role: CEO_ACCOUNT.role, escola: CEO_ACCOUNT.escola, biometricEnabled: true, avatar: bioAvatar };
          await login(u); router.replace(getRouteForRole(CEO_ACCOUNT.role) as any);
        } else if (emailTrimmed === FINANCEIRO_ACCOUNT.email) {
          const u: AuthUser = { id: FINANCEIRO_ACCOUNT.id, nome: FINANCEIRO_ACCOUNT.nome, email: FINANCEIRO_ACCOUNT.email, role: FINANCEIRO_ACCOUNT.role, escola: FINANCEIRO_ACCOUNT.escola, biometricEnabled: true, avatar: bioAvatar };
          await login(u); router.replace(getRouteForRole(FINANCEIRO_ACCOUNT.role) as any);
        } else if (emailTrimmed === SECRETARIA_ACCOUNT.email) {
          const u: AuthUser = { id: SECRETARIA_ACCOUNT.id, nome: SECRETARIA_ACCOUNT.nome, email: SECRETARIA_ACCOUNT.email, role: SECRETARIA_ACCOUNT.role, escola: SECRETARIA_ACCOUNT.escola, biometricEnabled: true, avatar: bioAvatar };
          await login(u); router.replace(getRouteForRole(SECRETARIA_ACCOUNT.role) as any);
        } else if (emailTrimmed === RH_ACCOUNT.email) {
          const u: AuthUser = { id: RH_ACCOUNT.id, nome: RH_ACCOUNT.nome, email: RH_ACCOUNT.email, role: RH_ACCOUNT.role, escola: RH_ACCOUNT.escola, biometricEnabled: true, avatar: bioAvatar };
          await login(u); router.replace(getRouteForRole(RH_ACCOUNT.role) as any);
        } else {
          const found = users.find(u => u.email.toLowerCase() === emailTrimmed && u.ativo);
          if (found) {
            const u: AuthUser = { id: found.id, nome: found.nome, email: found.email, role: found.role, escola: found.escola, biometricEnabled: true, avatar: bioAvatar };
            await login(u); router.replace(getRouteForRole(found.role) as any);
          } else {
            showAlert('Utilizador não encontrado', 'Não existe conta activa com esse email.');
          }
        }
      }
    } catch (e) {
      console.error('Biometric auth error:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() && !senha.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert('Campos Obrigatórios', 'Por favor, preencha o email e a senha para continuar.');
      return;
    }
    if (!email.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert('Email em falta', 'Por favor, introduza o seu email institucional.');
      return;
    }
    if (!senha.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert('Senha em falta', 'Por favor, introduza a sua senha de acesso.');
      return;
    }
    setIsLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const emailTrimmed = email.toLowerCase().trim();
    const savedAvatar = lastUser?.email?.toLowerCase() === emailTrimmed ? lastUser?.avatar : undefined;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrimmed, senha }),
      });
      const data = await res.json();
      if (!res.ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert('Credenciais Inválidas', data.error ?? 'O email ou a senha estão incorrectos.\nVerifique os dados e tente novamente.');
        setIsLoading(false);
        return;
      }
      await saveAuthToken(data.token);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const u: AuthUser = {
        id: data.user.id,
        nome: data.user.nome,
        email: data.user.email,
        role: data.user.role,
        escola: data.user.escola ?? '',
        biometricEnabled: false,
        avatar: savedAvatar,
      };
      await login(u);
      router.replace(getRouteForRole(data.user.role) as any);
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert('Erro de Ligação', 'Não foi possível contactar o servidor. Verifique a sua ligação e tente novamente.');
      setIsLoading(false);
    }
  }

  function handleSwitchAccount() {
    clearLastUser();
    setShowBiometricWelcome(false);
    biometricPulse.stopAnimation();
    biometricGlow.stopAnimation();
  }

  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 32 : insets.bottom;

  const biometricIconName = biometricType === 'faceid' ? 'scan-outline' : 'finger-print-outline';
  const biometricLabel = biometricType === 'faceid' ? 'Face ID' : 'Impressão Digital';

  const getInitials = (nome: string) => {
    const parts = nome.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      ceo: 'CEO / Administrador',
      pca: 'Presidente do Conselho',
      admin: 'Administrador',
      director: 'Director',
      secretaria: 'Secretaria',
      professor: 'Professor',
      aluno: 'Aluno',
      financeiro: 'Gestor Financeiro',
    };
    return labels[role] || role;
  };

  const biometricWelcomeScreen = (
    <Animated.View style={[styles.biometricWelcomeContainer, { opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}>
      <View style={styles.bwCard}>
        <View style={styles.cardTopAccent} />

        <View style={styles.bwAvatarSection}>
          <View style={styles.bwAvatarOuter}>
            {lastUser?.avatar ? (
              <Image
                source={{ uri: lastUser.avatar }}
                style={styles.bwAvatarPhoto}
              />
            ) : (
              <View style={styles.bwAvatarInner}>
                <Text style={styles.bwAvatarInitials}>{getInitials(lastUser?.nome || '')}</Text>
              </View>
            )}
          </View>
          <View style={styles.bwRoleBadge}>
            <Text style={styles.bwRoleText}>{getRoleLabel(lastUser?.role || '')}</Text>
          </View>
        </View>

        <View style={styles.bwTextSection}>
          <Text style={styles.bwGreeting}>Bem-vindo de volta</Text>
          <Text style={styles.bwName}>{lastUser?.nome}</Text>
          <Text style={styles.bwSchool}>{lastUser?.escola}</Text>
        </View>

        <TouchableOpacity
          style={styles.bwBiometricButton}
          onPress={triggerBiometricAuth}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Animated.View
            style={[
              styles.bwBiometricGlow,
              {
                opacity: biometricGlow,
                transform: [{ scale: biometricPulse }],
              },
            ]}
          />
          <Animated.View style={[styles.bwBiometricIconWrap, { transform: [{ scale: biometricPulse }] }]}>
            {isLoading ? (
              <Ionicons name="checkmark-circle" size={52} color={Colors.gold} />
            ) : (
              <Ionicons name={biometricIconName} size={52} color={Colors.gold} />
            )}
          </Animated.View>
          <Text style={styles.bwBiometricLabel}>
            {isLoading ? 'A autenticar...' : `Toque para usar ${biometricLabel}`}
          </Text>
        </TouchableOpacity>

        <View style={styles.bwDividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.bwSwitchBtn}
          onPress={handleSwitchAccount}
          activeOpacity={0.8}
        >
          <Ionicons name="person-outline" size={15} color={Colors.textMuted} />
          <Text style={styles.bwSwitchText}>Usar outra conta</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const formCard = (
    <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}>
      <View style={styles.cardTopAccent} />

      <View style={styles.cardHeaderRow}>
        <View style={styles.lockBadge}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.gold} />
        </View>
        <View style={styles.cardHeaderTexts}>
          <Text style={styles.cardTitle}>Iniciar Sessão</Text>
          <Text style={styles.cardSubtitle}>Credenciais institucionais SIGE</Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email Institucional</Text>
        <View style={[styles.inputBox, focusedField === 'email' && styles.inputBoxFocused]}>
          <Ionicons
            name="mail-outline"
            size={17}
            color={focusedField === 'email' ? Colors.gold : Colors.textMuted}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.inputText}
            value={email}
            onChangeText={setEmail}
            placeholder="utilizador@escola.ao"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Senha de Acesso</Text>
        <View style={[styles.inputBox, focusedField === 'senha' && styles.inputBoxFocused]}>
          <Ionicons
            name="lock-closed-outline"
            size={17}
            color={focusedField === 'senha' ? Colors.gold : Colors.textMuted}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.inputText}
            value={senha}
            onChangeText={setSenha}
            placeholder="••••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry={!showSenha}
            autoCapitalize="none"
            onFocus={() => setFocusedField('senha')}
            onBlur={() => setFocusedField(null)}
          />
          <TouchableOpacity
            onPress={() => setShowSenha(!showSenha)}
            style={styles.eyeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={showSenha ? 'eye-off-outline' : 'eye-outline'} size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
        activeOpacity={0.88}
      >
        <LinearGradient
          colors={isLoading ? ['#3a3a3a', '#2a2a2a'] : ['#1A5276', '#1F618D', '#2980B9']}
          style={styles.loginBtnGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {isLoading ? (
            <>
              <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text} />
              <Text style={styles.loginBtnText}>A autenticar...</Text>
            </>
          ) : (
            <>
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={styles.loginBtnText}>Entrar no Sistema</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {biometricAvailable && Platform.OS !== 'web' && (
        <View style={styles.biometricWrap}>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricAuth} activeOpacity={0.8}>
            <View style={styles.biometricIconWrap}>
              <Ionicons
                name={biometricIconName}
                size={24}
                color={Colors.gold}
              />
            </View>
            <Text style={styles.biometricText}>
              {biometricType === 'faceid' ? 'Entrar com Face ID' : 'Entrar com Impressão Digital'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const registerCard = (
    <Animated.View style={[styles.registerSection, { opacity: fadeAnim }]}>
      <View style={styles.registerCard}>
        <View style={styles.registerLeft}>
          <View style={styles.registerIconWrap}>
            <Ionicons name="person-add-outline" size={18} color="#3498DB" />
          </View>
          <View style={styles.registerTexts}>
            <Text style={styles.registerTitle}>Novo Estudante?</Text>
            <Text style={styles.registerDesc}>Solicite a sua matrícula online</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => router.push('/registro' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.registerBtnText}>Inscrição</Text>
          <Ionicons name="arrow-forward" size={13} color="#3498DB" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.provisorioBtn}
        onPress={() => router.push('/login-provisorio' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="person-circle-outline" size={15} color={Colors.gold} />
        <Text style={styles.provisorioBtnText}>Já tenho uma inscrição — Acompanhar processo</Text>
        <Ionicons name="chevron-forward" size={13} color={Colors.gold} />
      </TouchableOpacity>
    </Animated.View>
  );

  const footerView = (
    <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
      <View style={styles.angolaBanner}>
        <View style={[styles.angolaStripe, { backgroundColor: '#CC0000' }]} />
        <View style={[styles.angolaStripe, { backgroundColor: '#000000' }]} />
      </View>
      <Text style={styles.footerText}>Desenvolvido por Isaias Osvaldo & Gemima Delfina  ·  SIGE v1.0</Text>
      <Text style={styles.footerSub}>Isaias Osvaldo & Gemima Delfina - Queta</Text>
    </Animated.View>
  );

  const alertModalView = (
    <Modal
      visible={alertModal.visible}
      transparent
      animationType="fade"
      onRequestClose={() => setAlertModal(p => ({ ...p, visible: false }))}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={[styles.modalIconWrap, { backgroundColor: alertModal.type === 'error' ? '#FF453A22' : '#22C55E22' }]}>
            <Ionicons
              name={alertModal.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
              size={36}
              color={alertModal.type === 'error' ? '#FF453A' : '#22C55E'}
            />
          </View>
          <Text style={styles.modalTitle}>{alertModal.title}</Text>
          <Text style={styles.modalMessage}>{alertModal.message}</Text>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: alertModal.type === 'error' ? '#FF453A' : '#22C55E' }]}
            onPress={() => setAlertModal(p => ({ ...p, visible: false }))}
            activeOpacity={0.85}
          >
            <Text style={styles.modalBtnText}>OK, entendi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const bgDecorations = (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />
      <View style={styles.strip1} />
      <View style={styles.strip2} />
    </View>
  );

  if (isDesktop) {
    return (
      <ImageBackground
        source={require('../assets/login-bg.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(6,16,41,0.92)', 'rgba(10,22,40,0.88)', 'rgba(15,31,64,0.85)', 'rgba(20,34,71,0.82)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
        />
        {bgDecorations}

        <View style={styles.desktopRow}>
          <Animated.View style={[styles.desktopLeft, { opacity: logoOpacity }]}>
            <View style={styles.desktopLogoWrap}>
              <View style={styles.logoGlowBig} />
              <Image
                source={require('../assets/sige-logo.png')}
                style={styles.desktopLogoImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.desktopBrandTitle}>Sistema Integral de{'\n'}Gestão Escolar</Text>
            <Text style={styles.desktopBrandSub}>Plataforma digital para a gestão académica e administrativa das escolas angolanas.</Text>

            <View style={styles.desktopFeatures}>
              {[
                { icon: 'school-outline', text: 'Gestão de Alunos e Professores' },
                { icon: 'document-text-outline', text: 'Lançamento de Notas e Presenças' },
                { icon: 'bar-chart-outline', text: 'Relatórios e Estatísticas' },
                { icon: 'cash-outline', text: 'Controlo Financeiro' },
              ].map((f, i) => (
                <View key={i} style={styles.desktopFeatureRow}>
                  <View style={styles.desktopFeatureIcon}>
                    <Ionicons name={f.icon as any} size={16} color={Colors.gold} />
                  </View>
                  <Text style={styles.desktopFeatureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.desktopLeftFooter}>
              <View style={styles.angolaBanner}>
                <View style={[styles.angolaStripe, { backgroundColor: '#CC0000' }]} />
                <View style={[styles.angolaStripe, { backgroundColor: '#000000' }]} />
              </View>
              <Text style={styles.footerText}>Desenvolvido por Isaias Osvaldo & Gemima Delfina  ·  SIGE v1.0</Text>
            </View>
          </Animated.View>

          <View style={styles.desktopRight}>
            <ScrollView
              contentContainerStyle={styles.desktopRightScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {formCard}
              {inscricoesAbertas && registerCard}
            </ScrollView>
          </View>
        </View>
        {alertModalView}
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../assets/login-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(6,16,41,0.92)', 'rgba(10,22,40,0.88)', 'rgba(15,31,64,0.85)', 'rgba(20,34,71,0.82)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
      />
      {bgDecorations}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 20, paddingBottom: bottomPad + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.logoSection, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <View style={styles.logoContainer}>
              <View style={styles.logoGlowBig} />
              <Image
                source={require('../assets/sige-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            {!showBiometricWelcome && (
              <View style={styles.taglineRow}>
                <View style={styles.taglineLine} />
                <Text style={styles.taglineText}>ACESSO INSTITUCIONAL</Text>
                <View style={styles.taglineLine} />
              </View>
            )}
          </Animated.View>

          {showBiometricWelcome ? biometricWelcomeScreen : formCard}
          {!showBiometricWelcome && inscricoesAbertas && registerCard}
          {footerView}
        </ScrollView>
      </KeyboardAvoidingView>
      {alertModalView}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  desktopRow: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopLeft: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 56,
    paddingVertical: 40,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
  },
  desktopLogoWrap: {
    alignItems: 'flex-start',
    marginBottom: 32,
    position: 'relative',
  },
  desktopLogoImage: {
    width: 260,
    height: 90,
  },
  desktopBrandTitle: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    lineHeight: 42,
    marginBottom: 12,
  },
  desktopBrandSub: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 24,
    maxWidth: 380,
    marginBottom: 36,
  },
  desktopFeatures: {
    gap: 16,
    marginBottom: 48,
  },
  desktopFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  desktopFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(240,165,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(240,165,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopFeatureText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  desktopLeftFooter: {
    alignItems: 'flex-start',
    gap: 6,
  },
  desktopRight: {
    width: 480,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.05)',
  },
  desktopRightScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 48,
    gap: 16,
  },

  circle1: {
    position: 'absolute', width: 380, height: 380,
    borderRadius: 190, top: -120, right: -100,
    backgroundColor: 'rgba(26,82,118,0.18)',
  },
  circle2: {
    position: 'absolute', width: 220, height: 220,
    borderRadius: 110, bottom: 60, left: -80,
    backgroundColor: 'rgba(204,26,26,0.07)',
  },
  circle3: {
    position: 'absolute', width: 140, height: 140,
    borderRadius: 70, top: '42%', right: -40,
    backgroundColor: 'rgba(240,165,0,0.05)',
  },
  strip1: {
    position: 'absolute', width: 2, height: height * 0.4,
    top: '15%', left: '12%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    transform: [{ rotate: '15deg' }],
  },
  strip2: {
    position: 'absolute', width: 1, height: height * 0.3,
    top: '30%', right: '18%',
    backgroundColor: 'rgba(255,255,255,0.025)',
    transform: [{ rotate: '-10deg' }],
  },

  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20 },

  logoSection: { alignItems: 'center', marginBottom: 32, width: '100%' },
  logoContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoGlowBig: {
    position: 'absolute',
    width: 260, height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(26,82,118,0.2)',
  },
  logoImage: {
    width: Math.min(width - 60, 280),
    height: 110,
  },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  taglineLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', maxWidth: 50 },
  taglineText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 14,
    gap: 20,
    padding: 24,
    paddingTop: 28,
  },
  cardTopAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: Colors.gold,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lockBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(240,165,0,0.1)',
    borderWidth: 1, borderColor: 'rgba(240,165,0,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardHeaderTexts: { flex: 1 },
  cardTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  cardSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  inputGroup: { gap: 8 },
  inputLabel: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.09)',
    height: 54,
    paddingHorizontal: 6,
  },
  inputBoxFocused: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(240,165,0,0.05)',
  },
  inputIcon: { marginHorizontal: 10 },
  inputText: {
    flex: 1, fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text, height: '100%',
  },
  eyeBtn: { width: 42, alignItems: 'center', justifyContent: 'center' },

  loginBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 17,
  },
  loginBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  biometricWrap: { gap: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  biometricBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14,
    backgroundColor: 'rgba(240,165,0,0.07)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(240,165,0,0.2)',
  },
  biometricIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(240,165,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  biometricText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.gold },

  registerSection: { width: '100%', maxWidth: 440 },
  registerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(52,152,219,0.07)',
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(52,152,219,0.15)',
    padding: 16,
  },
  registerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  registerIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(52,152,219,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  registerTexts: { flex: 1 },
  registerTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  registerDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  registerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: 'rgba(52,152,219,0.12)',
    borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(52,152,219,0.25)',
  },
  registerBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#3498DB' },

  provisorioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingVertical: 11, paddingHorizontal: 14,
    backgroundColor: 'rgba(240,165,0,0.07)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(240,165,0,0.18)',
  },
  provisorioBtnText: {
    flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.gold,
  },

  footer: { alignItems: 'center', marginTop: 20, gap: 6 },
  angolaBanner: { flexDirection: 'row', height: 4, width: 36, borderRadius: 2, overflow: 'hidden', gap: 1 },
  angolaStripe: { flex: 1 },
  footerText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.25)' },
  footerSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.15)' },

  biometricWelcomeContainer: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  bwCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    padding: 28,
    alignItems: 'center',
    gap: 20,
  },
  bwAvatarSection: {
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  bwAvatarOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(240,165,0,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(240,165,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bwAvatarInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(26,82,118,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bwAvatarPhoto: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: Colors.gold,
  },
  bwAvatarInitials: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.gold,
  },
  bwRoleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(240,165,0,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(240,165,0,0.2)',
  },
  bwRoleText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  bwTextSection: {
    alignItems: 'center',
    gap: 4,
  },
  bwGreeting: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  bwName: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  bwSchool: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  bwBiometricButton: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 32,
    width: '100%',
  },
  bwBiometricGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(240,165,0,0.18)',
  },
  bwBiometricIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(240,165,0,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(240,165,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bwBiometricLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  bwDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  bwSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bwSwitchText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textMuted,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: '#0F1F40',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  modalIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  modalBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
