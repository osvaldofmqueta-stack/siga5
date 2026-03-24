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
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { useLicense } from '@/context/LicenseContext';
import { useAuth } from '@/context/AuthContext';

const RING_SIZE = 160;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUM = 2 * Math.PI * RING_RADIUS;

function CountdownRing({ dias, maxDias, cor }: { dias: number; maxDias: number; cor: string }) {
  const pct = maxDias > 0 ? Math.min(dias / maxDias, 1) : 0;
  const dashOffset = RING_CIRCUM * (1 - pct);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (dias <= 7) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [dias]);

  return (
    <Animated.View style={[styles.ringWrap, { transform: [{ scale: pulse }] }]}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={cor}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${RING_CIRCUM}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringDays, { color: cor }]}>{dias}</Text>
        <Text style={styles.ringDaysLabel}>dias{'\n'}restantes</Text>
      </View>
    </Animated.View>
  );
}

export default function LicencaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { licenca, diasRestantes, isLicencaValida, ativarLicenca } = useLicense();
  const { user, logout } = useAuth();

  const [codigo, setCodigo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'expired' | 'activate'>('expired');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

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
    <LinearGradient colors={['#0A0E1A', '#0F1629', '#0A0E1A']} style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoRing}>
              <MaterialCommunityIcons
                name={isLicencaValida ? 'shield-check' : 'shield-lock'}
                size={48}
                color={isLicencaValida ? Colors.success : Colors.danger}
              />
            </View>
            <Text style={styles.appName}>SGAA Angola</Text>
            <Text style={styles.appSub}>Sistema de Gestão Académica Angolana</Text>
          </View>

          {/* Status Card — Contador ao estilo antivírus */}
          {(() => {
            const maxDias = licenca
              ? ({ mensal: 30, trimestral: 90, semestral: 180, anual: 365, avaliacao: 30 } as Record<string, number>)[licenca.plano] ?? 30
              : 30;
            const cor = diasRestantes <= 0
              ? Colors.danger
              : diasRestantes <= 7
              ? Colors.danger
              : diasRestantes <= 30
              ? Colors.warning
              : Colors.success;
            const statusLabel = diasRestantes <= 0
              ? 'SUBSCRIÇÃO EXPIRADA'
              : diasRestantes <= 7
              ? 'EXPIRA EM BREVE'
              : diasRestantes <= 30
              ? 'ATENÇÃO — RENOVE EM BREVE'
              : 'LICENÇA ACTIVA';
            return (
              <View style={[styles.statusCard, { borderColor: cor + '66' }]}>
                <View style={[styles.statusCardGlow, { backgroundColor: cor + '0A' }]} />
                <Text style={[styles.statusBadge, { color: cor, borderColor: cor + '55', backgroundColor: cor + '15' }]}>
                  {statusLabel}
                </Text>

                <View style={styles.ringArea}>
                  <CountdownRing dias={diasRestantes} maxDias={maxDias} cor={cor} />
                  <View style={styles.ringSideInfo}>
                    {licenca && (
                      <>
                        <View style={styles.infoBlock}>
                          <Text style={styles.infoBlockLabel}>Plano</Text>
                          <Text style={[styles.infoBlockVal, { color: cor }]}>
                            {licenca.plano.charAt(0).toUpperCase() + licenca.plano.slice(1)}
                          </Text>
                        </View>
                        <View style={styles.infoBlock}>
                          <Text style={styles.infoBlockLabel}>Activação</Text>
                          <Text style={styles.infoBlockVal}>{licenca.dataAtivacao}</Text>
                        </View>
                        <View style={styles.infoBlock}>
                          <Text style={styles.infoBlockLabel}>Expira em</Text>
                          <Text style={[styles.infoBlockVal, { color: diasRestantes <= 7 ? Colors.danger : Colors.textSecondary }]}>
                            {licenca.dataExpiracao}
                          </Text>
                        </View>
                        <View style={styles.infoBlock}>
                          <Text style={styles.infoBlockLabel}>Escola</Text>
                          <Text style={styles.infoBlockVal} numberOfLines={2}>{licenca.escolaNome || '—'}</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                <Text style={styles.statusMsg}>
                  {diasRestantes <= 0
                    ? 'A licença desta instituição expirou. Active uma nova licença abaixo para continuar a utilizar o sistema.'
                    : diasRestantes <= 7
                    ? `Atenção! Restam apenas ${diasRestantes} dias. Renove já para evitar interrupção do serviço.`
                    : diasRestantes <= 30
                    ? `A sua licença expira em ${diasRestantes} dias. Recomendamos que renove com antecedência.`
                    : `A sua licença está activa e válida por mais ${diasRestantes} dias.`}
                </Text>
              </View>
            );
          })()}

          {/* Activate Form */}
          <View style={styles.activateCard}>
            <Text style={styles.activateTitle}>Activar Nova Licença</Text>
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
              {isLoading ? (
                <Text style={styles.activateBtnText}>A activar…</Text>
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-check" size={20} color="#fff" />
                  <Text style={styles.activateBtnText}>Activar Licença</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Plans Info */}
          <View style={styles.planosCard}>
            <Text style={styles.planosTitle}>Planos Disponíveis</Text>
            {[
              { label: 'Mensal', dias: '30 dias', preco: '5.000 AOA', color: Colors.info },
              { label: 'Trimestral', dias: '90 dias', preco: '13.500 AOA', color: Colors.warning },
              { label: 'Semestral', dias: '180 dias', preco: '25.000 AOA', color: Colors.success },
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
  scroll: { paddingHorizontal: 24, flexGrow: 1 },

  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoRing: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
  },
  appName: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.5 },
  appSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 4, textAlign: 'center' },

  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 20,
    borderWidth: 1.5, marginBottom: 16, overflow: 'hidden', position: 'relative',
  },
  statusCardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20,
  },
  statusBadge: {
    fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 16,
  },
  ringArea: {
    flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 14,
  },
  ringWrap: {
    width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
  },
  ringDays: {
    fontSize: 40, fontFamily: 'Inter_700Bold', lineHeight: 44,
  },
  ringDaysLabel: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted,
    textAlign: 'center', lineHeight: 15,
  },
  ringSideInfo: { flex: 1, gap: 10 },
  infoBlock: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  infoBlockLabel: {
    fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2,
  },
  infoBlockVal: {
    fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.textSecondary,
  },
  statusMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20 },

  activateCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.gold + '33', marginBottom: 16,
  },
  activateTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 6 },
  activateMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
    borderWidth: 1, borderColor: Colors.gold + '44', marginBottom: 14, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 2 },
  activateBtn: {
    backgroundColor: Colors.gold, borderRadius: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16,
  },
  activateBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },

  planosCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 20,
  },
  planosTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  planoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  planoDot: { width: 8, height: 8, borderRadius: 4 },
  planoLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  planoDias: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  planoPreco: { fontSize: 13, fontFamily: 'Inter_700Bold', marginLeft: 8 },
  contacto: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 14, textAlign: 'center', lineHeight: 20 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  logoutText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
});
