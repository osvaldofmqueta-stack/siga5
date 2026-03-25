import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, ScrollView, Platform, Animated, ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

export default function EsqueceuSenhaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [inscricoesAbertas, setInscricoesAbertas] = useState(false);

  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetch('/api/public/inscricoes-status')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.abertas) setInscricoesAbertas(true); })
      .catch(() => {});
  }, []);

  async function handleEnviar() {
    setErro('');
    if (!email.trim()) {
      setErro('Por favor, introduza o seu endereço de email.');
      return;
    }
    if (!email.includes('@')) {
      setErro('Introduza um email válido.');
      return;
    }

    setIsLoading(true);
    try {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error ?? 'Ocorreu um erro. Tente novamente.');
        return;
      }

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setEnviado(true);
    } catch {
      setErro('Não foi possível contactar o servidor. Verifique a sua ligação.');
    } finally {
      setIsLoading(false);
    }
  }

  const topPad = Platform.OS === 'web' ? 32 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom;

  if (enviado) {
    return (
      <ImageBackground
        source={require('../assets/login-bg.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(6,16,41,0.93)', 'rgba(10,22,40,0.89)', 'rgba(15,31,64,0.86)']}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: topPad + 40, paddingBottom: bottomPad + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.successCard}>
              <View style={styles.successIconCircle}>
                <Ionicons name="mail-open-outline" size={44} color={Colors.success} />
              </View>
              <Text style={styles.successTitle}>Email Enviado!</Text>
              <Text style={styles.successDesc}>
                Se o endereço <Text style={{ color: Colors.gold, fontFamily: 'Inter_600SemiBold' }}>{email.toLowerCase().trim()}</Text> estiver registado no sistema, receberá um link para redefinir a sua senha.
              </Text>
              <View style={styles.successTip}>
                <Ionicons name="information-circle-outline" size={15} color={Colors.textMuted} />
                <Text style={styles.successTipText}>
                  Verifique a pasta de spam ou lixo se não encontrar o email na sua caixa de entrada.
                </Text>
              </View>
              <Text style={styles.successExpiry}>O link é válido por 1 hora.</Text>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.replace('/login' as any)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#1A5276', '#2980B9']}
                  style={styles.backBtnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="log-in-outline" size={18} color="#fff" />
                  <Text style={styles.backBtnText}>Voltar ao Login</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
        colors={['rgba(6,16,41,0.93)', 'rgba(10,22,40,0.89)', 'rgba(15,31,64,0.86)']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 20, paddingBottom: bottomPad + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            <Text style={styles.backLinkText}>Voltar ao Login</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.cardTopAccent} />

            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="key-outline" size={18} color={Colors.gold} />
              </View>
              <View style={styles.headerTexts}>
                <Text style={styles.cardTitle}>Esqueceu a Senha?</Text>
                <Text style={styles.cardSubtitle}>Recuperação de acesso ao SIGE</Text>
              </View>
            </View>

            <Text style={styles.instrucoes}>
              Introduza o email associado à sua conta. Receberá um link para criar uma nova senha.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email da Conta</Text>
              <View style={[styles.inputBox, focusedField && styles.inputBoxFocused]}>
                <Ionicons
                  name="mail-outline"
                  size={17}
                  color={focusedField ? Colors.gold : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.inputText}
                  value={email}
                  onChangeText={t => { setEmail(t); setErro(''); }}
                  placeholder="o-seu-email@escola.ao"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField(true)}
                  onBlur={() => setFocusedField(false)}
                  onSubmitEditing={handleEnviar}
                  returnKeyType="send"
                />
              </View>
              {!!erro && (
                <View style={styles.erroRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
                  <Text style={styles.erroText}>{erro}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, isLoading && styles.sendBtnDisabled]}
              onPress={handleEnviar}
              disabled={isLoading}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={isLoading ? ['#3a3a3a', '#2a2a2a'] : ['#1A5276', '#1F618D', '#2980B9']}
                style={styles.sendBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <>
                    <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text} />
                    <Text style={styles.sendBtnText}>A enviar...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#fff" />
                    <Text style={styles.sendBtnText}>Enviar Link de Recuperação</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.notaBox}>
              <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.notaText}>
                Por segurança, o link expira em 1 hora e só pode ser utilizado uma vez.
              </Text>
            </View>
          </View>

          {inscricoesAbertas && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Ainda não é nosso estudante?{' '}
                <Text
                  style={styles.footerLink}
                  onPress={() => router.push('/registro' as any)}
                >
                  Solicitar matrícula
                </Text>
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },

  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },

  card: {
    backgroundColor: 'rgba(15,35,71,0.92)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTopAccent: {
    height: 3,
    backgroundColor: Colors.gold,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 4,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(240,165,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,165,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: { flex: 1 },
  cardTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    marginTop: 2,
  },

  instrucoes: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 4,
  },

  inputGroup: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 4,
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  inputBoxFocused: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(240,165,0,0.06)',
  },
  inputIcon: { opacity: 0.85 },
  inputText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },

  erroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  erroText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.danger,
    flex: 1,
  },

  sendBtn: {
    marginHorizontal: 24,
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sendBtnDisabled: { opacity: 0.65 },
  sendBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  sendBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },

  notaBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    margin: 20,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 12,
  },
  notaText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    lineHeight: 18,
  },

  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  footerLink: {
    color: Colors.gold,
    fontFamily: 'Inter_600SemiBold',
  },

  successCard: {
    backgroundColor: 'rgba(15,35,71,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(39,174,96,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(39,174,96,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  successTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  successTipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    lineHeight: 18,
  },
  successExpiry: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.gold,
    marginBottom: 24,
  },
  backBtn: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  backBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
