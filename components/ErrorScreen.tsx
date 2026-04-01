import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const { width: W, height: H } = Dimensions.get('window');

interface ErrorConfig {
  iconName: string;
  iconLib: 'ion' | 'mci';
  accentColor: string;
  title: string;
  description: string;
  badge: string;
}

const CONFIGS: Record<number | 'default', ErrorConfig> = {
  401: {
    iconName: 'lock-closed',
    iconLib: 'ion',
    accentColor: Colors.gold,
    title: 'Sessão Expirada',
    description: 'A sua sessão terminou ou as suas credenciais são inválidas. Inicie sessão novamente para continuar a utilizar o SIGA.',
    badge: 'Não Autenticado',
  },
  403: {
    iconName: 'shield-lock',
    iconLib: 'mci',
    accentColor: Colors.warning,
    title: 'Acesso Negado',
    description: 'Não possui permissões suficientes para aceder a este recurso. Contacte o administrador do sistema se necessitar de acesso.',
    badge: 'Sem Permissão',
  },
  404: {
    iconName: 'compass-outline',
    iconLib: 'ion',
    accentColor: Colors.info,
    title: 'Página Não Encontrada',
    description: 'O recurso ou página que procura não existe ou foi movido para outro endereço. Verifique o URL e tente novamente.',
    badge: 'Recurso Inexistente',
  },
  408: {
    iconName: 'timer-outline',
    iconLib: 'ion',
    accentColor: Colors.warning,
    title: 'Tempo Esgotado',
    description: 'O servidor demorou demasiado tempo a responder. Verifique a sua ligação à Internet e tente novamente.',
    badge: 'Tempo Limite Excedido',
  },
  500: {
    iconName: 'server-off',
    iconLib: 'mci',
    accentColor: Colors.danger,
    title: 'Erro Interno do Servidor',
    description: 'Ocorreu um problema no servidor do SIGA. A nossa equipa técnica foi notificada e está a trabalhar na resolução.',
    badge: 'Erro do Servidor',
  },
  502: {
    iconName: 'cloud-alert',
    iconLib: 'mci',
    accentColor: Colors.danger,
    title: 'Gateway Inválido',
    description: 'O servidor recebeu uma resposta inválida. Por favor, tente novamente em instantes.',
    badge: 'Erro de Gateway',
  },
  503: {
    iconName: 'cloud-off-outline',
    iconLib: 'mci',
    accentColor: '#8B9DC3',
    title: 'Sistema Indisponível',
    description: 'O SIGA está temporariamente indisponível para manutenção ou está a enfrentar uma sobrecarga. Tente novamente em alguns minutos.',
    badge: 'Em Manutenção',
  },
  default: {
    iconName: 'alert-circle-outline',
    iconLib: 'ion',
    accentColor: Colors.warning,
    title: 'Algo Correu Mal',
    description: 'Ocorreu um erro inesperado na aplicação. Por favor, tente recarregar. Se o problema persistir, contacte o suporte técnico do SIGA.',
    badge: 'Erro Inesperado',
  },
};

interface ErrorScreenProps {
  code?: number;
  customMessage?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export default function ErrorScreen({
  code,
  customMessage,
  onPrimaryAction,
  onSecondaryAction,
  primaryLabel,
  secondaryLabel,
}: ErrorScreenProps) {
  const cfg = CONFIGS[code as keyof typeof CONFIGS] ?? CONFIGS.default;
  const displayCode = code ?? '—';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.7, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const defaultPrimary = code === 401 ? 'Iniciar Sessão' : code === 403 ? 'Voltar' : 'Tentar Novamente';
  const defaultSecondary = code === 401 ? undefined : code === 403 ? 'Ir ao Dashboard' : 'Ir ao Dashboard';

  return (
    <View style={styles.root}>
      {/* Background decoration */}
      <View style={[styles.bgCircle, styles.bgCircle1, { borderColor: cfg.accentColor + '18' }]} />
      <View style={[styles.bgCircle, styles.bgCircle2, { borderColor: cfg.accentColor + '10' }]} />
      <View style={[styles.bgCircle, styles.bgCircle3, { borderColor: Colors.primaryLight + '20' }]} />
      <View style={[styles.bgDot, { top: H * 0.15, left: W * 0.1, backgroundColor: cfg.accentColor + '22' }]} />
      <View style={[styles.bgDot, { bottom: H * 0.2, right: W * 0.08, backgroundColor: Colors.primaryLight + '30' }]} />
      <View style={[styles.bgDot, { top: H * 0.6, left: W * 0.05, backgroundColor: cfg.accentColor + '18', width: 6, height: 6 }]} />

      {/* SIGA Brand header */}
      <View style={styles.brandRow}>
        <View style={styles.brandDot} />
        <Text style={styles.brandText}>SIGA</Text>
        <View style={[styles.brandBadge, { backgroundColor: cfg.accentColor + '20', borderColor: cfg.accentColor + '40' }]}>
          <Text style={[styles.brandBadgeText, { color: cfg.accentColor }]}>{cfg.badge}</Text>
        </View>
      </View>

      {/* Main content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Large background error code */}
        <Text style={[styles.bgCode, { color: cfg.accentColor + '10' }]}>{displayCode}</Text>

        {/* Icon with glow */}
        <View style={styles.iconWrapper}>
          <Animated.View style={[
            styles.iconGlow,
            { backgroundColor: cfg.accentColor + '18', transform: [{ scale: pulseAnim }] },
          ]} />
          <Animated.View style={[styles.iconGlowInner, { backgroundColor: cfg.accentColor + '10', opacity: glowAnim }]} />
          <View style={[styles.iconContainer, { backgroundColor: cfg.accentColor + '1A', borderColor: cfg.accentColor + '50' }]}>
            {cfg.iconLib === 'ion' ? (
              <Ionicons name={cfg.iconName as any} size={44} color={cfg.accentColor} />
            ) : (
              <MaterialCommunityIcons name={cfg.iconName as any} size={44} color={cfg.accentColor} />
            )}
          </View>
        </View>

        {/* Error code badge */}
        <View style={[styles.codeBadge, { backgroundColor: cfg.accentColor + '15', borderColor: cfg.accentColor + '35' }]}>
          <Text style={[styles.codeBadgeText, { color: cfg.accentColor }]}>Erro {displayCode}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{cfg.title}</Text>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: cfg.accentColor + '40' }]} />

        {/* Description */}
        <Text style={styles.description}>
          {customMessage || cfg.description}
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          {onPrimaryAction && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: cfg.accentColor }]}
              onPress={onPrimaryAction}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-forward" size={16} color={Colors.primaryDark} style={{ marginRight: 8 }} />
              <Text style={[styles.primaryBtnText, { color: Colors.primaryDark }]}>
                {primaryLabel ?? defaultPrimary}
              </Text>
            </TouchableOpacity>
          )}
          {onSecondaryAction && (secondaryLabel ?? defaultSecondary) && (
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: Colors.borderLight }]}
              onPress={onSecondaryAction}
              activeOpacity={0.75}
            >
              <Text style={styles.secondaryBtnText}>{secondaryLabel ?? defaultSecondary}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Diagnostic row */}
        <View style={styles.diagnosticRow}>
          <View style={styles.diagnosticDot} />
          <Text style={styles.diagnosticText}>
            Código HTTP {displayCode} · {new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Sistema Integral de Gestão Escolar — Angola</Text>
        <Text style={styles.footerSub}>SIGA v3 · Suporte Técnico: suporte@siga.ao</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
    overflow: 'hidden',
  },

  /* Background decoration */
  bgCircle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
  },
  bgCircle1: {
    width: W * 1.2,
    height: W * 1.2,
    top: -W * 0.4,
    left: -W * 0.1,
  },
  bgCircle2: {
    width: W * 0.9,
    height: W * 0.9,
    bottom: -W * 0.35,
    right: -W * 0.25,
  },
  bgCircle3: {
    width: W * 0.5,
    height: W * 0.5,
    top: H * 0.3,
    left: -W * 0.1,
  },
  bgDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  /* Brand */
  brandRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 32,
    left: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  brandText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    letterSpacing: 2,
  },
  brandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  brandBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },

  /* Content */
  content: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    gap: 0,
  },
  bgCode: {
    position: 'absolute',
    fontSize: Platform.OS === 'web' ? 200 : 160,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -8,
    top: -60,
    alignSelf: 'center',
    userSelect: 'none',
  } as any,

  /* Icon */
  iconWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  iconGlowInner: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },

  /* Code badge */
  codeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  codeBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },

  /* Text */
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 34,
  },
  divider: {
    width: 48,
    height: 2,
    borderRadius: 2,
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 360,
  },

  /* Buttons */
  actions: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
    marginBottom: 28,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },

  /* Diagnostic */
  diagnosticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  diagnosticDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.textMuted,
  },
  diagnosticText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    alignItems: 'center',
    gap: 3,
  },
  footerText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  footerSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted + 'AA',
  },
});
