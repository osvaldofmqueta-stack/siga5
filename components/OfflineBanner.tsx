import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform, Pressable } from 'react-native';
import { useOffline } from '@/context/OfflineContext';

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOffline();
  const translateY = useRef(new Animated.Value(-60)).current;
  const wasOffline = useRef(false);
  const showSynced = useRef(false);
  const [syncedVisible, setSyncedVisible] = React.useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.spring(translateY, {
        toValue: -60,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      if (wasOffline.current) {
        wasOffline.current = false;
        setSyncedVisible(true);
        setTimeout(() => setSyncedVisible(false), 3000);
      }
    }
  }, [isOnline]);

  if (isOnline && !syncedVisible) return null;

  if (isOnline && syncedVisible) {
    return (
      <View style={[styles.banner, styles.syncedBanner]}>
        <Text style={styles.icon}>✓</Text>
        <Text style={styles.text}>
          {isSyncing ? 'A sincronizar...' : 'Ligação restaurada e dados sincronizados'}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.banner, styles.offlineBanner, { transform: [{ translateY }] }]}>
      <Text style={styles.icon}>⚡</Text>
      <View style={styles.textContainer}>
        <Text style={styles.text}>Modo offline</Text>
        {pendingCount > 0 && (
          <Text style={styles.subText}>
            {pendingCount} {pendingCount === 1 ? 'operação pendente' : 'operações pendentes'}
          </Text>
        )}
      </View>
      {pendingCount > 0 && (
        <Pressable onPress={triggerSync} style={styles.syncBtn}>
          <Text style={styles.syncBtnText}>Tentar sincronizar</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 0 : 44,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  offlineBanner: {
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#f59e0b',
  },
  syncedBanner: {
    backgroundColor: '#065f46',
    borderBottomWidth: 1,
    borderBottomColor: '#10b981',
  },
  icon: {
    fontSize: 16,
    color: '#f59e0b',
  },
  textContainer: {
    flex: 1,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  subText: {
    color: '#d1d5db',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  syncBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  syncBtnText: {
    color: '#f59e0b',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
