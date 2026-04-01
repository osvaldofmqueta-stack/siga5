import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useChatInterno } from '@/context/ChatInternoContext';

const HIDDEN_ROUTES = ['/chat-interno', '/(main)/chat-interno'];

export default function FloatingChatButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadTotal } = useChatInterno();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const prevUnread = useRef(0);

  // Animação de pulso quando chegam novas mensagens
  useEffect(() => {
    if (unreadTotal > prevUnread.current) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.25, useNativeDriver: true, speed: 20 }),
        Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20 }),
      ]).start();
      Animated.spring(badgeAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }).start();
    }
    prevUnread.current = unreadTotal;
  }, [unreadTotal]);

  // Oculta no ecrã de chat (após todos os hooks)
  const isHidden = HIDDEN_ROUTES.some(() => pathname?.includes('chat-interno'));
  if (isHidden) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/(main)/chat-interno' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubbles" size={24} color="#fff" />
        {unreadTotal > 0 && (
          <Animated.View style={[styles.badge, { transform: [{ scale: badgeAnim }] }]}>
            <Text style={styles.badgeText}>
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 9999,
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : {}),
  },
  btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    lineHeight: 13,
  },
});
