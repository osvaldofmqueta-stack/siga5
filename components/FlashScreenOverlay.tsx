import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Image, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useConfig } from '@/context/ConfigContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const SEEN_KEY = '@sgaa_flash_seen';

export default function FlashScreenOverlay() {
  const { config } = useConfig();
  const flash = config.flashScreen;
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkAndShow();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [flash.ativa, flash.titulo, flash.mensagem, flash.duracao]);

  async function checkAndShow() {
    if (!flash.ativa || !flash.titulo) return;

    const today = new Date().toISOString().split('T')[0];
    if (flash.dataInicio && today < flash.dataInicio) return;
    if (flash.dataFim && today > flash.dataFim) return;

    const seenKey = `${SEEN_KEY}_${flash.titulo}_${flash.dataInicio}`;
    const seen = await AsyncStorage.getItem(seenKey);
    if (seen) return;

    await AsyncStorage.setItem(seenKey, '1');

    setCountdown(flash.duracao);
    setVisible(true);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 100, useNativeDriver: true }),
    ]).start();

    let remaining = flash.duracao;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1000);

    autoCloseRef.current = setTimeout(() => {
      dismiss();
    }, flash.duracao * 1000);
  }

  function dismiss() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.92, duration: 300, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }

  if (!visible) return null;

  const bg = flash.bgColor || '#0A1628';

  return (
    <Animated.View style={[styles.overlay, { opacity, backgroundColor: bg + 'F2' }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.topBar}>
          <View style={styles.systemBadge}>
            <Ionicons name="megaphone" size={12} color="#FFD700" />
            <Text style={styles.systemLabel}>AVISO DO SISTEMA</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
            <Ionicons name="close" size={18} color="#999" />
          </TouchableOpacity>
        </View>

        {!!flash.imagemUrl && (
          <Image
            source={{ uri: flash.imagemUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={() => {}}
          />
        )}

        {!flash.imagemUrl && (
          <View style={styles.iconPlaceholder}>
            <Ionicons name="notifications" size={52} color="#FFD700" />
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{flash.titulo}</Text>
          {!!flash.mensagem && (
            <Text style={styles.message}>{flash.mensagem}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss}>
          <Text style={styles.dismissBtnText}>
            {countdown > 0 ? `Fechar em ${countdown}s` : 'Fechar'}
          </Text>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                { width: `${(countdown / flash.duracao) * 100}%` },
              ]}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0F1E3E',
    borderRadius: 24,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  } as any,
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  systemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  systemLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#FFD700',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: 180,
  },
  iconPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  content: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 28,
  },
  message: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 21,
  },
  dismissBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    overflow: 'hidden',
  },
  dismissBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFD700',
    marginBottom: 8,
  },
  progressTrack: {
    width: '80%',
    height: 3,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 2,
  },
});
