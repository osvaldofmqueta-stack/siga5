import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Platform } from 'react-native';
import { registerToastListener, ToastType } from '@/utils/toast';
import { Colors } from '@/constants/colors';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

let _idCounter = 0;

const TYPE_CONFIG = {
  error:   { bg: '#C0392B', icon: '✕' },
  success: { bg: '#1A7A4A', icon: '✓' },
  info:    { bg: '#1A5AA0', icon: 'ℹ' },
  warning: { bg: '#B5651D', icon: '⚠' },
};

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 160 }),
      Animated.delay(toast.duration - 400),
      Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDone(toast.id));
  }, []);

  const cfg = TYPE_CONFIG[toast.type];

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] });
  const opacity = anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] });

  return (
    <Animated.View style={[styles.toast, { backgroundColor: cfg.bg, opacity, transform: [{ translateY }] }]}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{cfg.icon}</Text>
      </View>
      <Text style={styles.message} numberOfLines={3}>{toast.message}</Text>
    </Animated.View>
  );
}

export default function ToastManager() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, type: ToastType, duration = 3500) => {
    const id = ++_idCounter;
    setToasts(prev => [...prev.slice(-3), { id, message, type, duration }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    registerToastListener(add);
  }, [add]);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDone={remove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    gap: 8,
    pointerEvents: 'none',
  } as any,
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    maxWidth: 420,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#fff',
    lineHeight: 20,
  },
});
