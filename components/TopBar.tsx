import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useDrawer } from '@/context/DrawerContext';
import { useAuth } from '@/context/AuthContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useNotificacoes } from '@/context/NotificacoesContext';

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 0 && h < 6) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(date: Date) {
  return date.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' });
}

interface TopBarProps {
  title: string;
  subtitle?: string;
  rightAction?: { icon: string; onPress: () => void };
}

export default function TopBar({ title, subtitle, rightAction }: TopBarProps) {
  const { openLeft, openRight } = useDrawer();
  const { user } = useAuth();
  const { unreadCount } = useNotificacoes();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop, isMobile } = useBreakpoint();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const topPad = isDesktop ? 0 : insets.top;

  const firstName = user?.nome?.trim().split(' ')[0] ?? '';
  const greetingText = subtitle ?? `${getGreeting()}${firstName ? `, ${firstName}` : ''}`;
  const timeText = formatTime(now);
  const dateText = formatDate(now);

  return (
    <View style={[styles.container, { paddingTop: topPad + (isDesktop ? 16 : 8) }]}>
      {!isDesktop && (
        <TouchableOpacity style={styles.iconBtn} onPress={openLeft} activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>
      )}

      {/* Home button — always visible */}
      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => router.push('/(main)/dashboard' as any)}
        activeOpacity={0.75}
      >
        <Ionicons name="home" size={19} color={Colors.gold} />
      </TouchableOpacity>

      <View style={styles.titleArea}>
        <Text style={[styles.title, isDesktop && styles.titleDesktop]} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{greetingText}</Text>
      </View>

      {/* Clock Widget — hidden on narrow mobile screens to avoid overflow */}
      {!isMobile && (
        <View style={styles.clockWidget}>
          <View style={styles.clockGlow} />
          <Ionicons name="time-outline" size={18} color={Colors.gold} />
          <View style={styles.clockTexts}>
            <Text style={styles.clockTime}>{timeText}</Text>
            <Text style={styles.clockDate}>{dateText}</Text>
          </View>
        </View>
      )}

      <View style={styles.rightActions}>
        {rightAction && (
          <TouchableOpacity style={styles.iconBtn} onPress={rightAction.onPress} activeOpacity={0.7}>
            <Ionicons name={rightAction.icon as any} size={22} color={Colors.text} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(main)/notificacoes' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications" size={22} color={unreadCount > 0 ? Colors.gold : Colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.avatarBtn} onPress={openRight} activeOpacity={0.7}>
          {(user as any)?.avatar ? (
            <Image source={{ uri: (user as any).avatar }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{user?.nome?.charAt(0) ?? 'U'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  homeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(240,165,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(240,165,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  titleDesktop: {
    fontSize: 19,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    marginTop: 2,
  },
  clockWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#1A1200',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  clockGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.gold + '12',
    borderRadius: 12,
  },
  clockTime: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.gold,
    letterSpacing: 1,
    lineHeight: 19,
  },
  clockDate: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.gold + 'AA',
    textTransform: 'capitalize',
    lineHeight: 13,
    letterSpacing: 0.3,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.gold,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
});
