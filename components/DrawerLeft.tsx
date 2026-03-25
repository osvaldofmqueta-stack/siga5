import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  Platform, ScrollView, Image,
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useDrawer } from '@/context/DrawerContext';
import { useAuth } from '@/context/AuthContext';
import { useNotificacoes } from '@/context/NotificacoesContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { useLicense } from '@/context/LicenseContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { usePermissoes, PermKey } from '@/context/PermissoesContext';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.78, 300);
const SIDEBAR_WIDTH = 260;

interface NavItem {
  label: string;
  route: string;
  icon: React.ReactNode;
  badgeCount?: number;
  permKey?: PermKey;
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
  const isPca = user?.role === 'pca';
  const isAdmin = user?.role === 'admin';
  const isDirector = user?.role === 'director';

  const isProf = user?.role === 'professor';
  const isAluno = user?.role === 'aluno';
  const isFinanceiro = user?.role === 'financeiro';
  const isSecretaria = user?.role === 'secretaria';
  const isChefeSec = user?.role === 'chefe_secretaria';
  const isRhRole = user?.role === 'rh';
  const isRH = isDirector || isAdmin || isRhRole;
  const isEncarregado = user?.role === 'encarregado';

  const { hasPermission } = usePermissoes();

  const ALUNO_SECTIONS: NavSection[] = [
    {
      title: 'Meu Portal',
      items: [
        { label: 'Portal do Estudante', route: '/(main)/portal-estudante', icon: <Ionicons name="grid" size={20} color="inherit" />, permKey: 'portal_estudante' },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount, permKey: 'notificacoes' },
      ],
    },
    {
      title: 'Académico',
      items: [
        { label: 'Minhas Notas', route: '/(main)/portal-estudante', icon: <Ionicons name="document-text" size={20} color="inherit" />, permKey: 'portal_estudante' },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" />, permKey: 'horario' },
        { label: 'Histórico', route: '/(main)/historico', icon: <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="inherit" />, permKey: 'historico' },
        { label: 'Calendário', route: '/(main)/eventos', icon: <Ionicons name="calendar" size={20} color="inherit" />, permKey: 'eventos' },
      ],
    },
    {
      title: 'Financeiro',
      items: [
        { label: 'Pagamentos', route: '/(main)/portal-estudante', icon: <MaterialCommunityIcons name="cash" size={20} color="inherit" />, permKey: 'portal_estudante' },
      ],
    },
  ];

  const ENCARREGADO_SECTIONS: NavSection[] = [
    {
      title: 'Portal do Encarregado',
      items: [
        { label: 'Painel do Educando', route: '/(main)/portal-encarregado', icon: <MaterialCommunityIcons name="account-child" size={20} color="inherit" />, permKey: 'portal_encarregado' },
        { label: 'Notas', route: '/(main)/portal-encarregado', icon: <Ionicons name="document-text" size={20} color="inherit" />, permKey: 'portal_encarregado' },
        { label: 'Presenças', route: '/(main)/portal-encarregado', icon: <Ionicons name="checkmark-circle-outline" size={20} color="inherit" />, permKey: 'portal_encarregado' },
        { label: 'Financeiro', route: '/(main)/portal-encarregado', icon: <MaterialCommunityIcons name="cash" size={20} color="inherit" />, permKey: 'portal_encarregado' },
        { label: 'Mensagens', route: '/(main)/portal-encarregado', icon: <Ionicons name="chatbubbles-outline" size={20} color="inherit" />, permKey: 'portal_encarregado' },
      ],
    },
    {
      title: 'Conta',
      items: [
        { label: 'Meu Perfil', route: '/(main)/perfil', icon: <Ionicons name="person-outline" size={20} color="inherit" /> },
      ],
    },
  ];

  const PROFESSOR_SECTIONS: NavSection[] = [
    {
      title: 'Painel do Professor',
      items: [
        { label: 'Meu Painel', route: '/(main)/professor-hub', icon: <Ionicons name="grid" size={20} color="inherit" />, permKey: 'professor_hub' },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount, permKey: 'notificacoes' },
      ],
    },
    {
      title: 'Académico',
      items: [
        { label: 'Minhas Turmas', route: '/(main)/professor-turmas', icon: <MaterialIcons name="class" size={20} color="inherit" />, permKey: 'professor_turmas' },
        { label: 'Pautas & Notas', route: '/(main)/professor-pauta', icon: <Ionicons name="document-text" size={20} color="inherit" />, permKey: 'professor_pauta' },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" />, permKey: 'horario' },
        { label: 'Sumário / Presenças', route: '/(main)/professor-sumario', icon: <MaterialCommunityIcons name="clipboard-check" size={20} color="inherit" />, permKey: 'professor_sumario' },
        { label: 'Área Pedagógica', route: '/(main)/pedagogico', icon: <MaterialCommunityIcons name="clipboard-list" size={20} color="inherit" />, permKey: 'pedagogico' },
        { label: 'Avaliação de Professores', route: '/(main)/avaliacao-professores', icon: <MaterialCommunityIcons name="star-check-outline" size={20} color="inherit" />, permKey: 'avaliacao_professores' },
        { label: 'Biblioteca', route: '/(main)/biblioteca', icon: <Ionicons name="library" size={20} color="inherit" />, permKey: 'biblioteca' },
        { label: 'Calendário', route: '/(main)/eventos', icon: <Ionicons name="calendar" size={20} color="inherit" />, permKey: 'eventos' },
      ],
    },
    {
      title: 'Comunicação',
      items: [
        { label: 'Mensagens', route: '/(main)/professor-mensagens', icon: <Ionicons name="chatbubbles" size={20} color="inherit" />, permKey: 'professor_mensagens' },
        { label: 'Materiais', route: '/(main)/professor-materiais', icon: <Ionicons name="folder-open" size={20} color="inherit" />, permKey: 'professor_materiais' },
      ],
    },
  ];

  const FINANCEIRO_SECTIONS: NavSection[] = [
    {
      title: 'Painel Financeiro',
      items: [
        { label: 'Gestão Financeira', route: '/(main)/financeiro', icon: <MaterialCommunityIcons name="cash" size={20} color="inherit" />, permKey: 'financeiro' },
        { label: 'Bolsas & Descontos', route: '/(main)/bolsas', icon: <MaterialCommunityIcons name="school-outline" size={20} color="inherit" />, permKey: 'financeiro' },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount, permKey: 'notificacoes' },
      ],
    },
  ];

  const RH_SECTIONS: NavSection[] = [
    {
      title: 'Recursos Humanos',
      items: [
        { label: 'Hub RH', route: '/(main)/rh-hub', icon: <MaterialCommunityIcons name="account-tie" size={20} color="inherit" />, permKey: 'rh_hub' },
        { label: 'Folha de Salários', route: '/(main)/rh-payroll', icon: <MaterialCommunityIcons name="cash-multiple" size={20} color="inherit" />, permKey: 'rh_hub' },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount, permKey: 'notificacoes' },
      ],
    },
    {
      title: 'Pessoal Docente',
      items: [
        { label: 'Professores', route: '/(main)/professores', icon: <FontAwesome5 name="chalkboard-teacher" size={18} color="inherit" />, permKey: 'professores' },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" />, permKey: 'horario' },
      ],
    },
    {
      title: 'Controlo',
      items: [
        { label: 'Sumários', route: '/(main)/rh-hub', icon: <MaterialCommunityIcons name="clipboard-check" size={20} color="inherit" />, permKey: 'rh_hub' },
        { label: 'Calendário de Provas', route: '/(main)/rh-hub', icon: <Ionicons name="calendar" size={20} color="inherit" />, permKey: 'rh_hub' },
      ],
    },
  ];

  const SECRETARIA_SECTIONS: NavSection[] = [
    {
      title: 'Secretaria',
      items: [
        { label: 'Painel da Secretaria', route: '/(main)/secretaria-hub', icon: <Ionicons name="grid" size={20} color="inherit" />, permKey: 'secretaria_hub' },
        { label: 'Editor de Documentos', route: '/(main)/editor-documentos', icon: <Ionicons name="newspaper" size={20} color="inherit" />, permKey: 'editor_documentos' },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount, permKey: 'notificacoes' },
      ],
    },
    {
      title: 'Gestão Académica',
      items: [
        { label: 'Alunos', route: '/(main)/alunos', icon: <Ionicons name="people" size={20} color="inherit" />, permKey: 'alunos' },
        { label: 'Transferências', route: '/(main)/transferencias', icon: <MaterialCommunityIcons name="transfer" size={20} color="inherit" />, permKey: 'transferencias' },
        { label: 'Professores', route: '/(main)/professores', icon: <FontAwesome5 name="chalkboard-teacher" size={18} color="inherit" />, permKey: 'professores' },
        { label: 'Turmas', route: '/(main)/turmas', icon: <MaterialIcons name="class" size={20} color="inherit" />, permKey: 'turmas' },
        { label: 'Salas de Aula', route: '/(main)/salas', icon: <MaterialCommunityIcons name="door-open" size={20} color="inherit" />, permKey: 'salas' },
        { label: 'Presenças', route: '/(main)/presencas', icon: <Ionicons name="checkmark-circle-outline" size={20} color="inherit" />, permKey: 'presencas' },
        { label: 'Notas & Pautas', route: '/(main)/notas', icon: <Ionicons name="document-text" size={20} color="inherit" />, permKey: 'notas' },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" />, permKey: 'horario' },
        { label: 'Histórico', route: '/(main)/historico', icon: <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="inherit" />, permKey: 'historico' },
        { label: 'Disciplinas', route: '/(main)/disciplinas', icon: <MaterialCommunityIcons name="book-outline" size={20} color="inherit" />, permKey: 'disciplinas' },
        { label: 'Gestão de Cursos', route: '/(main)/admin?section=cursos&group=academico', icon: <MaterialCommunityIcons name="book-open-variant" size={20} color="inherit" />, permKey: 'gestao_academica' },
        { label: 'Biblioteca', route: '/(main)/biblioteca', icon: <Ionicons name="library" size={20} color="inherit" />, permKey: 'biblioteca' },
      ],
    },
    {
      title: 'Planeamento',
      items: [
        { label: 'Calendário Académico', route: '/(main)/calendario-academico', icon: <MaterialCommunityIcons name="calendar-month" size={20} color="inherit" />, permKey: 'eventos' },
        { label: 'Eventos Escolares', route: '/(main)/eventos', icon: <Ionicons name="calendar" size={20} color="inherit" />, permKey: 'eventos' },
        { label: 'Grelha Curricular', route: '/(main)/grelha', icon: <Ionicons name="library" size={20} color="inherit" />, permKey: 'grelha' },
      ],
    },
    {
      title: 'Análise',
      items: [
        { label: 'Visão Geral Multi-Ano', route: '/(main)/visao-geral', icon: <MaterialCommunityIcons name="chart-line" size={20} color="inherit" />, permKey: 'visao_geral' },
        { label: 'Relatórios', route: '/(main)/relatorios', icon: <Ionicons name="bar-chart" size={20} color="inherit" />, permKey: 'relatorios' },
        { label: 'Recursos Humanos', route: '/(main)/rh-hub', icon: <MaterialCommunityIcons name="account-tie" size={20} color="inherit" />, permKey: 'rh_hub' },
        { label: 'Pagamentos', route: '/(main)/financeiro', icon: <MaterialCommunityIcons name="cash" size={20} color="inherit" />, permKey: 'financeiro' },
        { label: 'Bolsas & Descontos', route: '/(main)/bolsas', icon: <MaterialCommunityIcons name="school-outline" size={20} color="inherit" />, permKey: 'financeiro' },
      ],
    },
  ];

  const CEO_PCA_SECTIONS: NavSection[] = [
    {
      title: isCeo ? 'Painel CEO' : 'Principal',
      items: [
        ...(isCeo ? [{ label: 'Painel CEO (Subscrição)', route: '/(main)/ceo', icon: <MaterialCommunityIcons name="crown" size={20} color="inherit" />, permKey: 'ceo_dashboard' as PermKey }] : []),
        { label: 'Dashboard Escolar', route: '/(main)/dashboard', icon: <Ionicons name="grid" size={20} color="inherit" />, permKey: 'dashboard' },
        { label: 'Calendário Académico', route: '/(main)/calendario-academico', icon: <MaterialCommunityIcons name="calendar-month" size={20} color="inherit" />, permKey: 'eventos' },
        { label: 'Eventos Escolares', route: '/(main)/eventos', icon: <Ionicons name="calendar" size={20} color="inherit" />, permKey: 'eventos' },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount, permKey: 'notificacoes' },
      ],
    },
    {
      title: 'Académico',
      items: [
        { label: 'Alunos', route: '/(main)/alunos', icon: <Ionicons name="people" size={20} color="inherit" />, permKey: 'alunos' },
        { label: 'Transferências', route: '/(main)/transferencias', icon: <MaterialCommunityIcons name="transfer" size={20} color="inherit" />, permKey: 'transferencias' },
        { label: 'Professores', route: '/(main)/professores', icon: <FontAwesome5 name="chalkboard-teacher" size={18} color="inherit" />, permKey: 'professores' },
        { label: 'Turmas', route: '/(main)/turmas', icon: <MaterialIcons name="class" size={20} color="inherit" />, permKey: 'turmas' },
        { label: 'Salas de Aula', route: '/(main)/salas', icon: <MaterialCommunityIcons name="door-open" size={20} color="inherit" />, permKey: 'salas' },
        { label: 'Notas', route: '/(main)/notas', icon: <Ionicons name="document-text" size={20} color="inherit" />, permKey: 'notas' },
        { label: 'Presenças', route: '/(main)/presencas', icon: <Ionicons name="checkmark-circle-outline" size={20} color="inherit" />, permKey: 'presencas' },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" />, permKey: 'horario' },
        { label: 'Histórico', route: '/(main)/historico', icon: <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="inherit" />, permKey: 'historico' },
        { label: 'Biblioteca', route: '/(main)/biblioteca', icon: <Ionicons name="library" size={20} color="inherit" />, permKey: 'biblioteca' },
      ],
    },
    {
      title: 'Pedagógico',
      items: [
        { label: 'Área Pedagógica', route: '/(main)/pedagogico', icon: <MaterialCommunityIcons name="clipboard-list" size={20} color="inherit" />, permKey: 'pedagogico' },
        { label: 'Avaliação de Professores', route: '/(main)/avaliacao-professores', icon: <MaterialCommunityIcons name="star-check-outline" size={20} color="inherit" />, permKey: 'avaliacao_professores' },
        { label: 'Grelha Curricular', route: '/(main)/grelha', icon: <Ionicons name="library" size={20} color="inherit" />, permKey: 'grelha' },
      ],
    },
    {
      title: 'Análise',
      items: [
        { label: 'Visão Geral Multi-Ano', route: '/(main)/visao-geral', icon: <MaterialCommunityIcons name="chart-line" size={20} color="inherit" />, permKey: 'visao_geral' },
        { label: 'Relatórios', route: '/(main)/relatorios', icon: <Ionicons name="bar-chart" size={20} color="inherit" />, permKey: 'relatorios' },
        { label: 'Módulo Financeiro', route: '/(main)/financeiro', icon: <MaterialCommunityIcons name="cash" size={20} color="inherit" />, permKey: 'financeiro' },
        { label: 'Bolsas & Descontos', route: '/(main)/bolsas', icon: <MaterialCommunityIcons name="school-outline" size={20} color="inherit" />, permKey: 'financeiro' },
        { label: 'Recursos Humanos', route: '/(main)/rh-hub', icon: <MaterialCommunityIcons name="account-tie" size={20} color="inherit" />, permKey: 'rh_hub' },
        { label: 'Folha de Salários', route: '/(main)/rh-payroll', icon: <MaterialCommunityIcons name="cash-multiple" size={20} color="inherit" />, permKey: 'rh_hub' },
      ],
    },
    {
      title: 'Administração',
      items: [
        { label: 'Configurações do Sistema', route: '/(main)/admin', icon: <Ionicons name="settings" size={20} color="inherit" />, permKey: 'admin' },
        { label: 'Gestão de Acessos', route: '/(main)/gestao-acessos', icon: <MaterialCommunityIcons name="account-key" size={20} color="inherit" />, permKey: 'gestao_acessos' },
        { label: 'Controlo & Supervisão', route: '/(main)/controlo-supervisao', icon: <MaterialCommunityIcons name="shield-search" size={20} color="inherit" />, permKey: 'controlo_supervisao' },
      ],
    },
  ];

  const ADMIN_DIRECTOR_SECTIONS: NavSection[] = [
    {
      title: 'Principal',
      items: [
        { label: 'Dashboard', route: '/(main)/dashboard', icon: <Ionicons name="grid" size={20} color="inherit" />, permKey: 'dashboard' },
        { label: 'Calendário Académico', route: '/(main)/calendario-academico', icon: <MaterialCommunityIcons name="calendar-month" size={20} color="inherit" />, permKey: 'eventos' },
        { label: 'Eventos Escolares', route: '/(main)/eventos', icon: <Ionicons name="calendar" size={20} color="inherit" />, permKey: 'eventos' },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount, permKey: 'notificacoes' },
      ],
    },
    {
      title: 'Académico',
      items: [
        { label: 'Alunos', route: '/(main)/alunos', icon: <Ionicons name="people" size={20} color="inherit" />, permKey: 'alunos' },
        { label: 'Transferências', route: '/(main)/transferencias', icon: <MaterialCommunityIcons name="transfer" size={20} color="inherit" />, permKey: 'transferencias' },
        { label: 'Professores', route: '/(main)/professores', icon: <FontAwesome5 name="chalkboard-teacher" size={18} color="inherit" />, permKey: 'professores' },
        { label: 'Turmas', route: '/(main)/turmas', icon: <MaterialIcons name="class" size={20} color="inherit" />, permKey: 'turmas' },
        { label: 'Salas de Aula', route: '/(main)/salas', icon: <MaterialCommunityIcons name="door-open" size={20} color="inherit" />, permKey: 'salas' },
        { label: 'Notas', route: '/(main)/notas', icon: <Ionicons name="document-text" size={20} color="inherit" />, permKey: 'notas' },
        { label: 'Presenças', route: '/(main)/presencas', icon: <Ionicons name="checkmark-circle-outline" size={20} color="inherit" />, permKey: 'presencas' },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" />, permKey: 'horario' },
        { label: 'Histórico', route: '/(main)/historico', icon: <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="inherit" />, permKey: 'historico' },
        { label: 'Biblioteca', route: '/(main)/biblioteca', icon: <Ionicons name="library" size={20} color="inherit" />, permKey: 'biblioteca' },
      ],
    },
    {
      title: 'Pedagógico',
      items: [
        { label: 'Área Pedagógica', route: '/(main)/pedagogico', icon: <MaterialCommunityIcons name="clipboard-list" size={20} color="inherit" />, permKey: 'pedagogico' },
        { label: 'Avaliação de Professores', route: '/(main)/avaliacao-professores', icon: <MaterialCommunityIcons name="star-check-outline" size={20} color="inherit" />, permKey: 'avaliacao_professores' },
        { label: 'Grelha Curricular', route: '/(main)/grelha', icon: <Ionicons name="library" size={20} color="inherit" />, permKey: 'grelha' },
      ],
    },
    {
      title: 'Análise',
      items: [
        { label: 'Visão Geral Multi-Ano', route: '/(main)/visao-geral', icon: <MaterialCommunityIcons name="chart-line" size={20} color="inherit" />, permKey: 'visao_geral' },
        { label: 'Relatórios', route: '/(main)/relatorios', icon: <Ionicons name="bar-chart" size={20} color="inherit" />, permKey: 'relatorios' },
      ],
    },
    ...(isRH ? [{
      title: 'Recursos Humanos',
      items: [
        { label: 'Recursos Humanos', route: '/(main)/rh-hub', icon: <MaterialCommunityIcons name="account-tie" size={20} color="inherit" />, permKey: 'rh_hub' as PermKey },
      ],
    }] : []),
  ];

  const CHEFE_SECRETARIA_SECTIONS: NavSection[] = [
    {
      title: 'Principal',
      items: [
        { label: 'Dashboard', route: '/(main)/dashboard', icon: <Ionicons name="grid" size={20} color="inherit" />, permKey: 'dashboard' },
        { label: 'Painel da Secretaria', route: '/(main)/secretaria-hub', icon: <MaterialCommunityIcons name="briefcase-account" size={20} color="inherit" />, permKey: 'secretaria_hub' },
        { label: 'Notificações', route: '/(main)/notificacoes', icon: <Ionicons name="notifications" size={20} color="inherit" />, badgeCount: unreadCount, permKey: 'notificacoes' },
      ],
    },
    {
      title: 'Gestão Académica',
      items: [
        { label: 'Alunos', route: '/(main)/alunos', icon: <Ionicons name="people" size={20} color="inherit" />, permKey: 'alunos' },
        { label: 'Professores', route: '/(main)/professores', icon: <FontAwesome5 name="chalkboard-teacher" size={18} color="inherit" />, permKey: 'professores' },
        { label: 'Turmas', route: '/(main)/turmas', icon: <MaterialIcons name="class" size={20} color="inherit" />, permKey: 'turmas' },
        { label: 'Salas de Aula', route: '/(main)/salas', icon: <MaterialCommunityIcons name="door-open" size={20} color="inherit" />, permKey: 'salas' },
        { label: 'Notas & Pautas', route: '/(main)/notas', icon: <Ionicons name="document-text" size={20} color="inherit" />, permKey: 'notas' },
        { label: 'Presenças', route: '/(main)/presencas', icon: <Ionicons name="checkmark-circle-outline" size={20} color="inherit" />, permKey: 'presencas' },
        { label: 'Horário', route: '/(main)/horario', icon: <Ionicons name="time" size={20} color="inherit" />, permKey: 'horario' },
        { label: 'Histórico', route: '/(main)/historico', icon: <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="inherit" />, permKey: 'historico' },
        { label: 'Grelha Curricular', route: '/(main)/grelha', icon: <Ionicons name="library" size={20} color="inherit" />, permKey: 'grelha' },
        { label: 'Disciplinas', route: '/(main)/disciplinas', icon: <MaterialCommunityIcons name="book-outline" size={20} color="inherit" />, permKey: 'disciplinas' },
        { label: 'Gestão de Cursos', route: '/(main)/admin?section=cursos&group=academico', icon: <MaterialCommunityIcons name="book-open-variant" size={20} color="inherit" />, permKey: 'gestao_academica' },
      ],
    },
    {
      title: 'Documentos & Comunicação',
      items: [
        { label: 'Editor de Documentos', route: '/(main)/editor-documentos', icon: <Ionicons name="newspaper" size={20} color="inherit" />, permKey: 'editor_documentos' },
        { label: 'Calendário Académico', route: '/(main)/calendario-academico', icon: <MaterialCommunityIcons name="calendar-month" size={20} color="inherit" />, permKey: 'eventos' },
        { label: 'Eventos Escolares', route: '/(main)/eventos', icon: <Ionicons name="calendar" size={20} color="inherit" />, permKey: 'eventos' },
      ],
    },
    {
      title: 'Finanças & RH',
      items: [
        { label: 'Gestão Financeira', route: '/(main)/financeiro', icon: <MaterialCommunityIcons name="cash" size={20} color="inherit" />, permKey: 'financeiro' },
        { label: 'Bolsas & Descontos', route: '/(main)/bolsas', icon: <MaterialCommunityIcons name="school-outline" size={20} color="inherit" />, permKey: 'financeiro' },
        { label: 'Recursos Humanos', route: '/(main)/rh-hub', icon: <MaterialCommunityIcons name="account-tie" size={20} color="inherit" />, permKey: 'rh_hub' },
      ],
    },
    {
      title: 'Análise',
      items: [
        { label: 'Visão Geral Multi-Ano', route: '/(main)/visao-geral', icon: <MaterialCommunityIcons name="chart-line" size={20} color="inherit" />, permKey: 'visao_geral' },
        { label: 'Relatórios', route: '/(main)/relatorios', icon: <Ionicons name="bar-chart" size={20} color="inherit" />, permKey: 'relatorios' },
      ],
    },
    {
      title: 'Administração',
      items: [
        { label: 'Configurações do Sistema', route: '/(main)/admin', icon: <Ionicons name="settings" size={20} color="inherit" />, permKey: 'admin' },
        { label: 'Gestão de Acessos', route: '/(main)/admin', icon: <MaterialCommunityIcons name="account-key" size={20} color="inherit" />, permKey: 'gestao_acessos' },
      ],
    },
  ];

  const RAW_SECTIONS: NavSection[] = isSecretaria ? SECRETARIA_SECTIONS
    : (isCeo || isPca) ? CEO_PCA_SECTIONS
    : isChefeSec ? CHEFE_SECRETARIA_SECTIONS
    : isProf ? PROFESSOR_SECTIONS
    : isAluno ? ALUNO_SECTIONS
    : isEncarregado ? ENCARREGADO_SECTIONS
    : isFinanceiro ? FINANCEIRO_SECTIONS
    : isRhRole ? RH_SECTIONS
    : ADMIN_DIRECTOR_SECTIONS;

  // CEO/PCA/ChefeSec always see everything; others get filtered by permissions
  const NAV_SECTIONS: NavSection[] = (isCeo || isPca || isChefeSec) ? RAW_SECTIONS : RAW_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => !item.permKey || hasPermission(item.permKey)),
  })).filter(section => section.items.length > 0);

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

        {/* Chefe de Secretaria Badge */}
        {isChefeSec && (
          <View style={[styles.ceoBadge, { backgroundColor: '#E11D4820', borderColor: '#E11D4840' }]}>
            <MaterialCommunityIcons name="briefcase-account" size={14} color="#E11D48" />
            <Text style={[styles.ceoBadgeText, { color: '#E11D48' }]}>Chefe de Secretaria — Parametrização Total</Text>
          </View>
        )}

        {/* Licence Status — estilo antivírus */}
        {!isCeo && (
          <TouchableOpacity
            style={styles.licCard}
            onPress={() => router.push('/licenca' as any)}
            activeOpacity={0.85}
          >
            {/* Faixa de cor lateral */}
            <View style={[styles.licCardStripe, {
              backgroundColor: diasRestantes <= 0
                ? '#FF3B30'
                : diasRestantes <= 7
                ? '#FF3B30'
                : diasRestantes <= 30
                ? '#FF9F0A'
                : '#30D158',
            }]} />

            <View style={styles.licCardBody}>
              {/* Linha de estado */}
              <View style={styles.licCardTop}>
                <MaterialCommunityIcons
                  name={diasRestantes <= 0 ? 'shield-off' : diasRestantes <= 7 ? 'shield-alert' : 'shield-check'}
                  size={13}
                  color={diasRestantes <= 0 ? '#FF3B30' : diasRestantes <= 7 ? '#FF3B30' : diasRestantes <= 30 ? '#FF9F0A' : '#30D158'}
                />
                <Text style={[styles.licCardStatus, {
                  color: diasRestantes <= 0 ? '#FF3B30' : diasRestantes <= 7 ? '#FF3B30' : diasRestantes <= 30 ? '#FF9F0A' : '#30D158',
                }]}>
                  {diasRestantes <= 0 ? 'EXPIRADA' : diasRestantes <= 7 ? 'EXPIRA EM BREVE' : diasRestantes <= 30 ? 'RENOVE EM BREVE' : 'ACTIVA'}
                </Text>
              </View>

              {/* Contador de dias em destaque */}
              <View style={styles.licCardDaysRow}>
                <Text style={[styles.licCardDaysNum, {
                  color: diasRestantes <= 0 ? '#FF3B30' : diasRestantes <= 7 ? '#FF3B30' : diasRestantes <= 30 ? '#FF9F0A' : '#30D158',
                }]}>
                  {diasRestantes <= 0 ? '0' : diasRestantes}
                </Text>
                <View>
                  <Text style={styles.licCardDaysLabel}>DIAS</Text>
                  <Text style={styles.licCardDaysLabel}>RESTANTES</Text>
                </View>
              </View>

              {/* Barra de progresso */}
              <View style={styles.licCardBarTrack}>
                <View style={[styles.licCardBarFill, {
                  width: `${Math.max(0, Math.min(100, (diasRestantes / 30) * 100))}%` as any,
                  backgroundColor: diasRestantes <= 0 ? '#FF3B30' : diasRestantes <= 7 ? '#FF3B30' : diasRestantes <= 30 ? '#FF9F0A' : '#30D158',
                }]} />
              </View>
              <Text style={styles.licCardExpiry}>
                {diasRestantes <= 0 ? 'Clique para renovar a licença' : `${diasRestantes} dia${diasRestantes === 1 ? '' : 's'} para expirar`}
              </Text>
            </View>
          </TouchableOpacity>
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
          {/* ── Centro de Supervisão ── */}
          {(isCeo || isPca || isChefeSec || user?.role === 'admin' || user?.role === 'director') && (
            <TouchableOpacity
              style={styles.supervisaoCTA}
              onPress={() => { router.push('/(main)/controlo-supervisao' as any); closeLeft && closeLeft(); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1A2B8A', '#0D1B3E']}
                style={styles.supervisaoCTAGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.supervisaoCTALeft}>
                  <View style={styles.supervisaoCTAIcon}>
                    <MaterialCommunityIcons name="eye-check-outline" size={20} color={Colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.supervisaoCTATitle}>Centro de Supervisão</Text>
                    <Text style={styles.supervisaoCTASub}>Monitorizar todos os utilizadores</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.gold} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Super Admin — Acesso Privilegiado ── */}
          {(isCeo || isPca) && (
            <TouchableOpacity
              style={styles.superAdminCTA}
              onPress={() => { router.push('/(main)/admin' as any); closeLeft && closeLeft(); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#5C0A0A', '#2D0505', '#1A0000']}
                style={styles.superAdminCTAGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.superAdminCTALeft}>
                  <View style={styles.superAdminCTAIcon}>
                    <MaterialCommunityIcons name="shield-crown" size={20} color={Colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={styles.superAdminCTATitle}>Super Admin</Text>
                      <View style={styles.superAdminBadge}>
                        <Text style={styles.superAdminBadgeText}>RESTRITO</Text>
                      </View>
                    </View>
                    <Text style={styles.superAdminCTASub}>Utilizadores · Escola · Anos · Segurança</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.danger} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Controlo Financeiro ── */}
          {(isCeo || isPca || isAdmin) && (
            <TouchableOpacity
              style={styles.financeiroCTA}
              onPress={() => { router.push('/(main)/financeiro' as any); closeLeft && closeLeft(); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#0A3D1A', '#052610', '#021508']}
                style={styles.financeiroCTAGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.financeiroCTALeft}>
                  <View style={styles.financeiroCTAIcon}>
                    <MaterialCommunityIcons name="cash-multiple" size={20} color="#4ADE80" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.financeiroCTATitle}>Controlo Financeiro</Text>
                    <Text style={styles.financeiroCTASub}>Propinas · Pagamentos · Multas · RUPEs</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#4ADE80" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Editor de Documentos ── */}
          {(isCeo || isPca || isAdmin) && (
            <TouchableOpacity
              style={styles.editorCTA}
              onPress={() => { router.push('/(main)/editor-documentos' as any); closeLeft && closeLeft(); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#7C3A00', '#4A2200', '#2A1200']}
                style={styles.editorCTAGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.editorCTALeft}>
                  <View style={styles.editorCTAIcon}>
                    <Ionicons name="newspaper" size={20} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editorCTATitle}>Editor de Documentos</Text>
                    <Text style={styles.editorCTASub}>Modelos · Declarações · Certificados</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Hub de Recursos Humanos ── */}
          {isRH && (
            <TouchableOpacity
              style={styles.rhCTA}
              onPress={() => { router.push('/(main)/rh-hub' as any); if (!isDesktop) closeLeft(); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1A4A3A', '#0D2B22', '#061A14']}
                style={styles.rhCTAGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.rhCTALeft}>
                  <View style={styles.rhCTAIcon}>
                    <MaterialCommunityIcons name="account-tie" size={20} color="#34D399" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rhCTATitle}>Recursos Humanos</Text>
                    <Text style={styles.rhCTASub}>Sumários · Pautas · Calendário · Professores</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#34D399" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Gestão de Acessos e Permissões ── */}
          {(isCeo || isPca || isAdmin || isDirector) && (
            <TouchableOpacity
              style={styles.acessosCTA}
              onPress={() => { router.push('/(main)/gestao-acessos' as any); closeLeft && closeLeft(); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#0D1F5C', '#071240', '#040B28']}
                style={styles.acessosCTAGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.acessosCTALeft}>
                  <View style={styles.acessosCTAIcon}>
                    <MaterialCommunityIcons name="account-key" size={20} color="#818CF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.acessosCTATitle}>Gestão de Acessos</Text>
                    <Text style={styles.acessosCTASub}>Perfis · Permissões · Controlo de Acesso</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#818CF8" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {(isCeo || isPca || isAdmin || isDirector) && <View style={styles.divider} />}

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
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.perfilAvatarImg} />
              ) : (
                <Text style={styles.perfilAvatarText}>
                  {user?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
                </Text>
              )}
            </View>
            <View style={styles.perfilInfo}>
              <Text style={styles.perfilNome} numberOfLines={1}>{user?.nome}</Text>
              <Text style={[styles.roleText, user?.role === 'ceo' && { color: '#FFD700' }]}>
                {({
                  ceo: 'CEO — Super Admin',
                  pca: 'Presidente',
                  admin: 'Administrador',
                  director: 'Director',
                  chefe_secretaria: 'Chefe de Secretaria',
                  secretaria: 'Secretária Académica',
                  professor: 'Professor',
                  aluno: 'Aluno',
                  financeiro: 'Gestor Financeiro',
                  encarregado: 'Encarregado',
                  rh: 'Recursos Humanos',
                } as Record<string, string>)[user?.role ?? ''] ?? user?.role ?? 'Utilizador'}
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
  perfilAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  licCard: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  licCardStripe: {
    width: 4,
    borderRadius: 0,
  },
  licCardBody: {
    flex: 1,
    padding: 10,
    gap: 6,
  },
  licCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  licCardStatus: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  licCardDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  licCardDaysNum: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    lineHeight: 40,
  },
  licCardDaysLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    lineHeight: 13,
  },
  licCardBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  licCardBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  licCardExpiry: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.35)',
  },
  supervisaoCTA: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gold + '40',
  },
  supervisaoCTAGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  supervisaoCTALeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  supervisaoCTAIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.gold + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.gold + '40',
  },
  supervisaoCTATitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.gold,
    marginBottom: 2,
  },
  supervisaoCTASub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },

  superAdminCTA: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.danger + '50',
  },
  superAdminCTAGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  superAdminCTALeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  superAdminCTAIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.danger + '25',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.danger + '45',
  },
  superAdminCTATitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#FF6B6B',
  },
  superAdminCTASub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,107,107,0.65)',
  },
  superAdminBadge: {
    backgroundColor: Colors.danger + '30',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: Colors.danger + '50',
  },
  superAdminBadgeText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: Colors.danger,
    letterSpacing: 0.8,
  },

  financeiroCTA: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4ADE8050',
  },
  financeiroCTAGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  financeiroCTALeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  financeiroCTAIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#4ADE8025',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4ADE8045',
  },
  financeiroCTATitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#4ADE80',
    marginBottom: 2,
  },
  financeiroCTASub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(74,222,128,0.65)',
  },

  editorCTA: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F59E0B50',
  },
  editorCTAGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  editorCTALeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  editorCTAIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F59E0B25',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B45',
  },
  editorCTATitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#F59E0B',
    marginBottom: 2,
  },
  editorCTASub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(245,158,11,0.65)',
  },
  acessosCTA: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#818CF850',
  },
  acessosCTAGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  acessosCTALeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  acessosCTAIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#818CF825',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#818CF845',
  },
  acessosCTATitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#818CF8',
    marginBottom: 2,
  },
  acessosCTASub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(129,140,248,0.65)',
  },
  rhCTA: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#34D39950',
  },
  rhCTAGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  rhCTALeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rhCTAIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#34D39925',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#34D39945',
  },
  rhCTATitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#34D399',
    marginBottom: 2,
  },
  rhCTASub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(52,211,153,0.65)',
  },
});
