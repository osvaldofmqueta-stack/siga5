import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  Platform, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useLicense } from '@/context/LicenseContext';
import { useAuth } from '@/context/AuthContext';

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

          {/* Status Card */}
          <View style={[styles.statusCard, { borderColor: isLicencaValida ? Colors.warning + '55' : Colors.danger + '55' }]}>
            <View style={styles.statusHeader}>
              <Ionicons
                name={isLicencaValida ? 'warning' : 'close-circle'}
                size={22}
                color={isLicencaValida ? Colors.warning : Colors.danger}
              />
              <Text style={[styles.statusTitle, { color: isLicencaValida ? Colors.warning : Colors.danger }]}>
                {isLicencaValida ? `Subscrição Expira em ${diasRestantes} Dias` : 'Subscrição Expirada'}
              </Text>
            </View>
            <Text style={styles.statusMsg}>
              {isLicencaValida
                ? 'A sua licença está próxima do fim. Renove agora para evitar interrupções no acesso ao sistema.'
                : 'A licença desta instituição expirou. Para continuar a utilizar o SGAA, active uma nova licença abaixo.'}
            </Text>
            {licenca && (
              <View style={styles.licInfoRow}>
                <View style={styles.licInfoItem}>
                  <Text style={styles.licInfoLabel}>Plano Anterior</Text>
                  <Text style={styles.licInfoVal}>{licenca.plano.charAt(0).toUpperCase() + licenca.plano.slice(1)}</Text>
                </View>
                <View style={styles.licInfoItem}>
                  <Text style={styles.licInfoLabel}>Expiração</Text>
                  <Text style={[styles.licInfoVal, { color: Colors.danger }]}>{licenca.dataExpiracao}</Text>
                </View>
                <View style={styles.licInfoItem}>
                  <Text style={styles.licInfoLabel}>Escola</Text>
                  <Text style={styles.licInfoVal} numberOfLines={1}>{licenca.escolaNome}</Text>
                </View>
              </View>
            )}
          </View>

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
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, padding: 18,
    borderWidth: 1, marginBottom: 16,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', flex: 1 },
  statusMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20 },
  licInfoRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  licInfoItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, alignItems: 'center' },
  licInfoLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 3 },
  licInfoVal: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff', textAlign: 'center' },

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
