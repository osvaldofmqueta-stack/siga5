import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  Platform, ScrollView,
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useDrawer } from '@/context/DrawerContext';
import { useAuth } from '@/context/AuthContext';
import { useNotificacoes } from '@/context/NotificacoesContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { useLicense } from '@/context/LicenseContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.78, 300);
const SIDEBAR_WIDTH = 260;

interface NavItem {
  label: string;
  route: string;
  icon: React.ReactNode;
  badgeCount?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function DrawerLeft() {
  const { leftOpen, closeLeft } = useDrawer();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { unreadCount } = useNotificacoes();
  const { anos, anoSelecionado, setAnoSelecionado } = useAnoAcademico();
  const { isLicencaValida, diasRestantes } = useLicense();
  const { isDesktop } = useBreakpoint();

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDesktop) return;
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: leftOpen ? 0 : -DRAWER_WIDTH,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }),
      Animated.timing(opacity, {
        toValue: leftOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [leftOpen, isDesktop]);

  const navigate = (route: string) => {
    if (!isDesktop) closeLeft();
    setTimeout(() => router.push(route as any), isDesktop ? 0 : 150);
  };

  const isActive = (route: string) => {
    const routeName = route.replace('/(main)/', '');
    return pathname.includes(routeName);
  };

  const isCeo = user?.role === 'ceo';

  const isProf = user?.role === 'professor';
  const isAluno = user?.role === 'aluno';
  const isRH = user?.role === 'secretaria' || user?.role === 'director' || user?.role === 'admin';

  const ALUNO_SECTIONS: NavSection[] = [
    {
      title: 'Meu Portal',
      items: [
        { label: 'Portal do Estudante', route: '/(main)/portal-estudante', icon: <Ionicons name="grid" size={20} color="inherit" /> },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount },
      ],
    },
    {
      title: 'Académico',
      items: [
        { label: 'Minhas Notas', route: '/(main)/portal-estudante', icon: <Ionicons name="document-text" size={20} color="inherit" /> },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" /> },
        { label: 'Histórico', route: '/(main)/historico', icon: <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="inherit" /> },
        { label: 'Calendário', route: '/(main)/eventos', icon: <Ionicons name="calendar" size={20} color="inherit" /> },
      ],
    },
    {
      title: 'Financeiro',
      items: [
        { label: 'Pagamentos', route: '/(main)/portal-estudante', icon: <MaterialCommunityIcons name="cash" size={20} color="inherit" /> },
      ],
    },
  ];

  const PROFESSOR_SECTIONS: NavSection[] = [
    {
      title: 'Painel do Professor',
      items: [
        { label: 'Meu Painel', route: '/(main)/professor-hub', icon: <Ionicons name="grid" size={20} color="inherit" /> },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount },
      ],
    },
    {
      title: 'Académico',
      items: [
        { label: 'Minhas Turmas', route: '/(main)/professor-turmas', icon: <MaterialIcons name="class" size={20} color="inherit" /> },
        { label: 'Pautas & Notas', route: '/(main)/professor-pauta', icon: <Ionicons name="document-text" size={20} color="inherit" /> },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" /> },
        { label: 'Sumário / Presenças', route: '/(main)/professor-sumario', icon: <MaterialCommunityIcons name="clipboard-check" size={20} color="inherit" /> },
        { label: 'Calendário', route: '/(main)/eventos', icon: <Ionicons name="calendar" size={20} color="inherit" /> },
      ],
    },
    {
      title: 'Comunicação',
      items: [
        { label: 'Mensagens', route: '/(main)/professor-mensagens', icon: <Ionicons name="chatbubbles" size={20} color="inherit" /> },
        { label: 'Materiais', route: '/(main)/professor-materiais', icon: <Ionicons name="folder-open" size={20} color="inherit" /> },
      ],
    },
  ];

  const NAV_SECTIONS: NavSection[] = isCeo ? [
    {
      title: 'Painel CEO',
      items: [
        { label: 'Dashboard CEO', route: '/(main)/ceo', icon: <MaterialCommunityIcons name="crown" size={20} color="inherit" /> },
        { label: 'Dashboard Escola', route: '/(main)/dashboard', icon: <Ionicons name="grid" size={20} color="inherit" /> },
      ],
    },
    {
      title: 'Sistema',
      items: [
        { label: 'Alunos', route: '/(main)/alunos', icon: <Ionicons name="people" size={20} color="inherit" /> },
        { label: 'Professores', route: '/(main)/professores', icon: <FontAwesome5 name="chalkboard-teacher" size={18} color="inherit" /> },
        { label: 'Turmas', route: '/(main)/turmas', icon: <MaterialIcons name="class" size={20} color="inherit" /> },
        { label: 'Notas', route: '/(main)/notas', icon: <Ionicons name="document-text" size={20} color="inherit" /> },
        { label: 'Relatórios', route: '/(main)/relatorios', icon: <Ionicons name="bar-chart" size={20} color="inherit" /> },
      ],
    },
    {
      title: 'Administração',
      items: [
        { label: 'Super Admin', route: '/(main)/admin', icon: <Ionicons name="shield-checkmark" size={20} color="inherit" /> },
      ],
    },
  ] : isProf ? PROFESSOR_SECTIONS : isAluno ? ALUNO_SECTIONS : [
    {
      title: 'Principal',
      items: [
        { label: 'Dashboard', route: '/(main)/dashboard', icon: <Ionicons name="grid" size={20} color="inherit" /> },
        { label: 'Calendário', route: '/(main)/eventos', icon: <Ionicons name="calendar" size={20} color="inherit" /> },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount },
      ],
    },
    {
      title: 'Académico',
      items: [
        { label: 'Alunos', route: '/(main)/alunos', icon: <Ionicons name="people" size={20} color="inherit" /> },
        { label: 'Professores', route: '/(main)/professores', icon: <FontAwesome5 name="chalkboard-teacher" size={18} color="inherit" /> },
        { label: 'Turmas', route: '/(main)/turmas', icon: <MaterialIcons name="class" size={20} color="inherit" /> },
        { label: 'Notas', route: '/(main)/notas', icon: <Ionicons name="document-text" size={20} color="inherit" /> },
        { label: 'Presenças', route: '/(main)/presencas', icon: <MaterialCommunityIcons name="calendar-check" size={20} color="inherit" /> },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" /> },
        { label: 'Histórico', route: '/(main)/historico', icon: <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="inherit" /> },
      ],
    },
    {
      title: 'Currículo',
      items: [
        { label: 'Grelha Curricular', route: '/(main)/grelha', icon: <Ionicons name="library" size={20} color="inherit" /> },
      ],
    },
    {
      title: 'Financeiro',
      items: [
        { label: 'Pagamentos', route: '/(main)/financeiro', icon: <MaterialCommunityIcons name="cash" size={20} color="inherit" /> },
      ],
    },
    {
      title: 'Análise',
      items: [
        { label: 'Relatórios', route: '/(main)/relatorios', icon: <Ionicons name="bar-chart" size={20} color="inherit" /> },
      ],
    },
    ...(isRH ? [{
      title: 'Recursos Humanos',
      items: [
        { label: 'Controlo RH', route: '/(main)/rh-controle', icon: <MaterialCommunityIcons name="account-check" size={20} color="inherit" /> },
      ],
    }] : []),
    ...(user?.role === 'director' ? [{
      title: 'Administração',
      items: [
        { label: 'Super Admin', route: '/(main)/admin', icon: <Ionicons name="shield-checkmark" size={20} color="inherit" /> },
      ],
    }] : []),
  ];

  function renderNavContent(showClose: boolean) {
    return (
      <>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.schoolBadge}>
            <Ionicons name="school" size={22} color={Colors.gold} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.schoolName} numberOfLines={2}>{user?.escola ?? 'SGAA Angola'}</Text>
            <Text style={styles.anoLetivo}>
              {anoSelecionado ? `Ano Lectivo ${anoSelecionado.ano}` : 'SGAA Angola'}
            </Text>
          </View>
          {showClose && (
            <TouchableOpacity onPress={closeLeft} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* CEO Badge */}
        {isCeo && (
          <View style={styles.ceoBadge}>
            <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
            <Text style={styles.ceoBadgeText}>CEO — Controlo Total</Text>
          </View>
        )}

        {/* Licence Status */}
        {!isCeo && (
          <View style={[styles.licBar, {
            backgroundColor: isLicencaValida && diasRestantes > 7
              ? Colors.success + '18'
              : diasRestantes <= 7 && diasRestantes > 0
              ? Colors.warning + '20'
              : Colors.danger + '18',
          }]}>
            <Ionicons
              name={isLicencaValida ? (diasRestantes <= 7 ? 'warning' : 'shield-checkmark') : 'close-circle'}
              size={14}
              color={isLicencaValida ? (diasRestantes <= 7 ? Colors.warning : Colors.success) : Colors.danger}
            />
            <Text style={[styles.licBarText, {
              color: isLicencaValida ? (diasRestantes <= 7 ? Colors.warning : Colors.success) : Colors.danger,
            }]}>
              {isLicencaValida ? `Licença activa · ${diasRestantes}d` : 'Licença expirada'}
            </Text>
          </View>
        )}

        {/* Year Selector */}
        {!isCeo && anos.length > 1 && (
          <View style={styles.yearSelector}>
            <Text style={styles.yearLabel}>Ano Académico</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.yearBtns}>
                {anos.map(ano => (
                  <TouchableOpacity
                    key={ano.id}
                    style={[styles.yearBtn, anoSelecionado?.id === ano.id && styles.yearBtnActive]}
                    onPress={() => setAnoSelecionado(ano)}
                  >
                    <Text style={[styles.yearBtnText, anoSelecionado?.id === ano.id && styles.yearBtnTextActive]}>
                      {ano.ano}
                    </Text>
                    {ano.ativo && <View style={styles.yearActiveDot} />}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.divider} />

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {NAV_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item) => {
                const active = isActive(item.route);
                return (
                  <TouchableOpacity
                    key={item.route}
                    style={[styles.navItem, active && styles.navItemActive]}
                    onPress={() => navigate(item.route)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.navIcon, active && styles.navIconActive]}>
                      {React.cloneElement(item.icon as React.ReactElement, {
                        color: active ? Colors.gold : Colors.textSecondary,
                      })}
                    </View>
                    <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                    {item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badgeCount > 99 ? '99+' : item.badgeCount}</Text>
                      </View>
                    )}
                    {active && !item.badgeCount && <View style={styles.activeIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: Colors.border }]}>
          <TouchableOpacity
            style={styles.perfilBtn}
            onPress={() => navigate('/(main)/perfil')}
          >
            <View style={styles.perfilAvatar}>
              <Text style={styles.perfilAvatarText}>
                {user?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
              </Text>
            </View>
            <View style={styles.perfilInfo}>
              <Text style={styles.perfilNome} numberOfLines={1}>{user?.nome}</Text>
              <Text style={[styles.roleText, user?.role === 'ceo' && { color: '#FFD700' }]}>
                {user?.role === 'ceo' ? 'CEO — Super Admin'
                  : user?.role === 'director' ? 'Director'
                  : user?.role === 'secretaria' ? 'Secretaria'
                  : user?.role === 'professor' ? 'Professor'
                  : 'Aluno'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.version}>v1.0</Text>
        </View>
      </>
    );
  }

  /* ── DESKTOP: persistent static sidebar ───────────────────── */
  if (isDesktop) {
    return (
      <View style={styles.sidebarDesktop}>
        {renderNavContent(false)}
      </View>
    );
  }

  /* ── MOBILE: animated overlay drawer ──────────────────────── */
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={leftOpen ? 'auto' : 'none'}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeLeft} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[
        styles.drawer,
        { transform: [{ translateX }], paddingTop: topInset + 12, paddingBottom: bottomInset },
      ]}>
        {renderNavContent(true)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Desktop sidebar */
  sidebarDesktop: {
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.primaryDark,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingTop: 20,
    paddingBottom: 12,
  },

  /* Mobile drawer */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.primaryDark,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },

  /* Shared */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  schoolBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  schoolName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    lineHeight: 18,
  },
  anoLetivo: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  yearSelector: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  yearLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  yearBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  yearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearBtnActive: {
    backgroundColor: 'rgba(240,165,0,0.15)',
    borderColor: Colors.gold + '66',
  },
  yearBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  yearBtnTextActive: {
    color: Colors.gold,
  },
  yearActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  scroll: {
    flex: 1,
  },
  section: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingBottom: 4,
    paddingTop: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 12,
    gap: 10,
    marginBottom: 1,
  },
  navItemActive: {
    backgroundColor: 'rgba(240,165,0,0.1)',
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: 'rgba(240,165,0,0.15)',
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  navLabelActive: {
    color: Colors.goldLight,
    fontFamily: 'Inter_600SemiBold',
  },
  badge: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  perfilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  perfilAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  perfilAvatarText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  perfilInfo: {
    flex: 1,
  },
  perfilNome: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  roleText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.gold,
    marginTop: 1,
  },
  version: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  ceoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  ceoBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#FFD700',
  },
  licBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  licBarText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
