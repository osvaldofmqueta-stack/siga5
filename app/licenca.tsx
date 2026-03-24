import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  Platform, ScrollView, KeyboardAvoidingView, Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { useLicense } from '@/context/LicenseContext';
import { useAuth } from '@/context/AuthContext';

const RING_SIZE = 220;
const RING_STROKE = 16;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUM = 2 * Math.PI * RING_RADIUS;

function getStatusInfo(dias: number, maxDias: number = 30) {
  const metade = Math.floor(maxDias * 0.5);
  if (dias <= 0) return {
    cor: '#FF3B30', corBg: '#2A0A0A', label: 'SUBSCRIÇÃO EXPIRADA',
    icon: 'shield-off' as const, gradStart: '#3A0808', gradEnd: '#1A0404',
    msg: 'A licença expirou. Active uma nova licença para continuar.',
    blink: true,
  };
  if (dias <= 10) return {
    cor: '#FF3B30', corBg: '#2A0A0A', label: 'EXPIRA EM BREVE!',
    icon: 'shield-alert' as const, gradStart: '#3A0808', gradEnd: '#1A0404',
    msg: `Apenas ${dias} dia${dias === 1 ? '' : 's'} restante${dias === 1 ? '' : 's'}! Renove imediatamente.`,
    blink: true,
  };
  if (dias <= metade) return {
    cor: '#FF9F0A', corBg: '#1E1200', label: 'RENOVE EM BREVE',
    icon: 'shield-alert-outline' as const, gradStart: '#2A1800', gradEnd: '#150C00',
    msg: `A sua licença expira em ${dias} dias. Recomendamos que renove antes de atingir o prazo.`,
    blink: false,
  };
  return {
    cor: '#30D158', corBg: '#061A0E', label: 'PROTEGIDO — LICENÇA ACTIVA',
    icon: 'shield-check' as const, gradStart: '#0A2A14', gradEnd: '#04150A',
    msg: `O sistema está protegido. Licença válida por mais ${dias} dias.`,
    blink: false,
  };
}

function AntivirusRing({ dias, maxDias }: { dias: number; maxDias: number }) {
  const info = getStatusInfo(dias, maxDias);
  const pct = maxDias > 0 ? Math.max(0, Math.min(dias / maxDias, 1)) : 0;
  const dashOffset = RING_CIRCUM * (1 - pct);

  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (info.blink) {
      const pulseAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.04, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      const opacityAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseAnim.start();
      opacityAnim.start();
      return () => {
        pulseAnim.stop();
        opacityAnim.stop();
      };
    }
  }, [info.blink]);

  return (
    <View style={styles.avContainer}>
      <LinearGradient
        colors={[info.gradStart, info.gradEnd]}
        style={styles.avGradientBg}
      />

      {/* Status badge topo */}
      <Animated.View style={[styles.avStatusBadge, { backgroundColor: info.cor + '22', borderColor: info.cor + '66' }, dias <= 7 && { opacity }]}>
        <MaterialCommunityIcons name={info.icon} size={14} color={info.cor} />
        <Text style={[styles.avStatusLabel, { color: info.cor }]}>{info.label}</Text>
      </Animated.View>

      {/* Anel principal */}
      <Animated.View style={[styles.avRingWrap, { transform: [{ scale: pulse }] }]}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Defs>
            <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={info.cor} stopOpacity="1" />
              <Stop offset="1" stopColor={info.cor + 'AA'} stopOpacity="1" />
            </SvgGradient>
          </Defs>
          {/* Trilho de fundo */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          {/* Progresso */}
          {dias > 0 && (
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={info.cor}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${RING_CIRCUM}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          )}
        </Svg>

        {/* Centro do anel */}
        <View style={styles.avRingCenter}>
          {dias <= 0 ? (
            <>
              <MaterialCommunityIcons name="shield-off" size={48} color={info.cor} />
              <Text style={[styles.avExpiredText, { color: info.cor }]}>EXPIRADO</Text>
            </>
          ) : (
            <>
              <Text style={[styles.avDaysNumber, { color: info.cor }]}>{dias}</Text>
              <Text style={styles.avDaysWord}>DIAS{'\n'}RESTANTES</Text>
            </>
          )}
        </View>
      </Animated.View>

      {/* Barra de progresso linear */}
      <View style={styles.avBarSection}>
        <View style={styles.avBarTrack}>
          <View style={[styles.avBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: info.cor }]} />
        </View>
        <View style={styles.avBarLabels}>
          <Text style={styles.avBarLabelLeft}>0 dias</Text>
          <Text style={[styles.avBarPct, { color: info.cor }]}>{Math.round(pct * 100)}% restante</Text>
          <Text style={styles.avBarLabelRight}>{maxDias} dias</Text>
        </View>
      </View>

      {/* Mensagem de estado */}
      <Text style={[styles.avMsg, { color: info.cor + 'CC' }]}>{info.msg}</Text>
    </View>
  );
}

export default function LicencaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { licenca, diasRestantes, isLicencaValida, ativarLicenca } = useLicense();
  const { user, logout } = useAuth();

  const [codigo, setCodigo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const maxDias = licenca
    ? ({ mensal: 30, trimestral: 90, semestral: 180, anual: 365, avaliacao: 30 } as Record<string, number>)[licenca.plano] ?? 30
    : 30;

  const info = getStatusInfo(diasRestantes, maxDias);

  async function handleActivar() {
    if (!codigo.trim()) {
      Alert.alert('Código inválido', 'Introduza o código de activação.');
      return;
    }
    setIsLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await ativarLicenca(codigo.trim(), user?.escola || 'Escola');
    setIsLoading(false);
    if (result.sucesso) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Licença Activada!', result.mensagem, [
        { text: 'Continuar', onPress: () => router.replace('/(main)/dashboard') },
      ]);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erro', result.mensagem);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <LinearGradient colors={['#060A14', '#0D1525', '#060A14']} style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={[styles.logoRing, { borderColor: info.cor + '44' }]}>
              <MaterialCommunityIcons name={info.icon} size={36} color={info.cor} />
            </View>
            <Text style={styles.appName}>SGAA Angola</Text>
            <Text style={styles.appSub}>Sistema de Gestão Académica Angolana</Text>
          </View>

          {/* Bloco antivírus principal */}
          <AntivirusRing dias={diasRestantes} maxDias={maxDias} />

          {/* Detalhes da licença */}
          {licenca && (
            <View style={[styles.detailsCard, { borderColor: info.cor + '33' }]}>
              <Text style={styles.detailsTitle}>DETALHES DA LICENÇA</Text>
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Ionicons name="ribbon-outline" size={16} color={info.cor} />
                  <View>
                    <Text style={styles.detailLabel}>Plano</Text>
                    <Text style={[styles.detailVal, { color: info.cor }]}>
                      {licenca.plano.charAt(0).toUpperCase() + licenca.plano.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                  <View>
                    <Text style={styles.detailLabel}>Activação</Text>
                    <Text style={styles.detailVal}>{licenca.dataAtivacao}</Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={16} color={diasRestantes <= 7 ? '#FF3B30' : Colors.textMuted} />
                  <View>
                    <Text style={styles.detailLabel}>Expiração</Text>
                    <Text style={[styles.detailVal, { color: diasRestantes <= 7 ? '#FF3B30' : Colors.textSecondary }]}>
                      {licenca.dataExpiracao}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="business-outline" size={16} color={Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>Escola</Text>
                    <Text style={styles.detailVal} numberOfLines={1}>{licenca.escolaNome || '—'}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Formulário de activação */}
          <View style={styles.activateCard}>
            <View style={styles.activateHeader}>
              <MaterialCommunityIcons name="key-outline" size={20} color={Colors.gold} />
              <Text style={styles.activateTitle}>Activar Nova Licença</Text>
            </View>
            <Text style={styles.activateMsg}>
              Introduza o código de activação fornecido pelo distribuidor SGAA.
            </Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="key" size={20} color={Colors.gold} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={codigo}
                onChangeText={v => setCodigo(v.toUpperCase())}
                placeholder="SGAA-XXX-XXXXXXXX"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.activateBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleActivar}
              disabled={isLoading}
            >
              <LinearGradient
                colors={[Colors.gold, Colors.gold + 'CC']}
                style={styles.activateBtnGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <Text style={styles.activateBtnText}>A activar…</Text>
                ) : (
                  <>
                    <MaterialCommunityIcons name="shield-check" size={20} color="#fff" />
                    <Text style={styles.activateBtnText}>Activar Licença</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Planos */}
          <View style={styles.planosCard}>
            <Text style={styles.planosTitle}>Planos Disponíveis</Text>
            {[
              { label: 'Mensal', dias: '30 dias', preco: '5.000 AOA', color: Colors.info },
              { label: 'Trimestral', dias: '90 dias', preco: '13.500 AOA', color: '#FF9F0A' },
              { label: 'Semestral', dias: '180 dias', preco: '25.000 AOA', color: '#30D158' },
              { label: 'Anual', dias: '365 dias', preco: '45.000 AOA', color: Colors.gold },
            ].map(p => (
              <View key={p.label} style={styles.planoRow}>
                <View style={[styles.planoDot, { backgroundColor: p.color }]} />
                <Text style={styles.planoLabel}>{p.label}</Text>
                <Text style={styles.planoDias}>{p.dias}</Text>
                <Text style={[styles.planoPreco, { color: p.color }]}>{p.preco}</Text>
              </View>
            ))}
            <Text style={styles.contacto}>
              Para adquirir um código, contacte:{'\n'}
              <Text style={{ color: Colors.gold }}>suporte@sgaa.ao</Text>
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.logoutText}>Terminar Sessão</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, flexGrow: 1 },

  header: { alignItems: 'center', marginBottom: 20 },
  logoRing: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, marginBottom: 12,
  },
  appName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.5 },
  appSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 3, textAlign: 'center' },

  avContainer: {
    borderRadius: 24, overflow: 'hidden', marginBottom: 16,
    padding: 24, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  avGradientBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  avStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    marginBottom: 20,
  },
  avStatusLabel: {
    fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5,
  },
  avRingWrap: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  avRingCenter: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
  },
  avDaysNumber: {
    fontSize: 72, fontFamily: 'Inter_700Bold',
    lineHeight: 80, textAlign: 'center',
  },
  avDaysWord: {
    fontSize: 12, fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.45)', textAlign: 'center',
    letterSpacing: 2, lineHeight: 16,
  },
  avExpiredText: {
    fontSize: 18, fontFamily: 'Inter_700Bold',
    letterSpacing: 2, marginTop: 8,
  },
  avBarSection: { width: '100%', marginBottom: 16 },
  avBarTrack: {
    height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', marginBottom: 6,
  },
  avBarFill: { height: '100%', borderRadius: 4 },
  avBarLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avBarLabelLeft: { fontSize: 10, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.3)' },
  avBarLabelRight: { fontSize: 10, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.3)' },
  avBarPct: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  avMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },

  detailsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18,
    padding: 18, borderWidth: 1, marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 14,
  },
  detailsGrid: { gap: 10 },
  detailItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: 12,
  },
  detailLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 2 },
  detailVal: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.textSecondary },

  activateCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.gold + '33', marginBottom: 16,
  },
  activateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  activateTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  activateMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
    borderWidth: 1, borderColor: Colors.gold + '44', marginBottom: 14, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 2 },
  activateBtn: { borderRadius: 14, overflow: 'hidden' },
  activateBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  activateBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },

  planosCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 20,
  },
  planosTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  planoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  planoDot: { width: 8, height: 8, borderRadius: 4 },
  planoLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  planoDias: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  planoPreco: { fontSize: 13, fontFamily: 'Inter_700Bold', marginLeft: 8 },
  contacto: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 14, textAlign: 'center', lineHeight: 20 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  logoutText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
});
