import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, Image, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useRouter } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Pendencia {
  id: string;
  alunoId: string;
  nome: string;
  apelido: string;
  numeroMatricula: string;
  foto: string | null;
  turma: string;
  curso: string;
  tipoPendencia: 'propina' | 'bloqueio' | 'rupe' | 'aviso_financeiro' | 'nota_negativa' | 'faltas_excessivas';
  descricao: string;
  severidade: 'urgente' | 'aviso' | 'info';
  area: string;
  createdAt: string;
}

const VISIBLE_ROLES = ['admin', 'ceo', 'pca', 'director', 'secretaria', 'chefe_secretaria', 'financeiro', 'pedagogico'];
const REFRESH_INTERVAL = 30000;
const ROTATE_INTERVAL = 10000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSeveridadeColor(s: Pendencia['severidade']) {
  if (s === 'urgente') return Colors.danger;
  if (s === 'aviso') return Colors.warning;
  return Colors.info;
}

function getTipoIcon(tipo: Pendencia['tipoPendencia']): { lib: 'ion' | 'mci'; name: string } {
  switch (tipo) {
    case 'propina': return { lib: 'mci', name: 'cash-remove' };
    case 'bloqueio': return { lib: 'ion', name: 'lock-closed' };
    case 'rupe': return { lib: 'mci', name: 'bank-outline' };
    case 'aviso_financeiro': return { lib: 'ion', name: 'warning' };
    case 'nota_negativa': return { lib: 'mci', name: 'close-circle' };
    case 'faltas_excessivas': return { lib: 'mci', name: 'calendar-remove' };
    default: return { lib: 'ion', name: 'alert-circle' };
  }
}

function getTipoLabel(tipo: Pendencia['tipoPendencia']) {
  switch (tipo) {
    case 'propina': return 'Propina';
    case 'bloqueio': return 'Bloqueio';
    case 'rupe': return 'RUPE';
    case 'aviso_financeiro': return 'Aviso';
    case 'nota_negativa': return 'Nota Negativa';
    case 'faltas_excessivas': return 'Faltas Excessivas';
    default: return 'Pendência';
  }
}

function getInitials(nome: string, apelido: string) {
  return `${nome.charAt(0)}${apelido.charAt(0)}`.toUpperCase();
}

function getAvatarColor(nome: string) {
  const colors = ['#CC1A1A', '#1A2B5F', '#F0A500', '#2ECC71', '#3498DB', '#8E44AD'];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Student ID Card ──────────────────────────────────────────────────────────
function StudentCard({ p, onDismiss }: { p: Pendencia; onDismiss: () => void }) {
  const router = useRouter();
  const sevColor = getSeveridadeColor(p.severidade);
  const icon = getTipoIcon(p.tipoPendencia);
  const tipoLabel = getTipoLabel(p.tipoPendencia);
  const initials = getInitials(p.nome, p.apelido);
  const avatarColor = getAvatarColor(p.nome);

  return (
    <View style={[styles.card, { borderLeftColor: sevColor }]}>
      {/* Severity glow strip */}
      <View style={[styles.cardGlow, { backgroundColor: sevColor + '18' }]} />

      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={[styles.severityBadge, { backgroundColor: sevColor + '22', borderColor: sevColor + '55' }]}>
          <View style={[styles.severityDot, { backgroundColor: sevColor }]} />
          <Text style={[styles.severityText, { color: sevColor }]}>{p.severidade.toUpperCase()}</Text>
        </View>
        <View style={styles.areaBadge}>
          <Text style={styles.areaText}>{p.area}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="close" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Student identity row */}
      <View style={styles.identityRow}>
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          {p.foto ? (
            <Image source={{ uri: p.foto }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          {/* ID card corner decoration */}
          <View style={styles.avatarCorner} />
        </View>

        {/* Student info */}
        <View style={styles.studentInfo}>
          <Text style={styles.studentName} numberOfLines={1}>
            {p.nome} {p.apelido}
          </Text>
          <View style={styles.matriculaRow}>
            <Ionicons name="card-outline" size={11} color={Colors.gold} />
            <Text style={styles.matriculaText}>{p.numeroMatricula}</Text>
          </View>
          <View style={styles.turmaRow}>
            <Ionicons name="school-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.turmaText} numberOfLines={1}>{p.turma}</Text>
          </View>
          {p.curso ? (
            <View style={styles.cursoRow}>
              <Ionicons name="book-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.cursoText} numberOfLines={1}>{p.curso}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Pending issue */}
      <View style={[styles.pendenciaBox, { borderColor: sevColor + '44', backgroundColor: sevColor + '0D' }]}>
        <View style={[styles.pendenciaIconWrap, { backgroundColor: sevColor + '22' }]}>
          {icon.lib === 'ion' ? (
            <Ionicons name={icon.name as any} size={16} color={sevColor} />
          ) : (
            <MaterialCommunityIcons name={icon.name as any} size={16} color={sevColor} />
          )}
        </View>
        <View style={styles.pendenciaContent}>
          <Text style={[styles.pendenciaTipo, { color: sevColor }]}>{tipoLabel}</Text>
          <Text style={styles.pendenciaDescricao}>{p.descricao}</Text>
        </View>
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.resolverBtn, { borderColor: sevColor + '66', backgroundColor: sevColor + '18' }]}
          onPress={() => {
            if (p.tipoPendencia === 'nota_negativa') router.push('/(main)/notas' as any);
            else if (p.tipoPendencia === 'faltas_excessivas') router.push('/(main)/presencas' as any);
            else router.push('/(main)/pagamentos-hub' as any);
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="checkmark-circle-outline" size={13} color={sevColor} />
          <Text style={[styles.resolverText, { color: sevColor }]}>Resolver</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.verPerfilBtn}
          onPress={() => router.push('/(main)/alunos' as any)}
          activeOpacity={0.75}
        >
          <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.verPerfilText}>Ver Aluno</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Counter Badge ─────────────────────────────────────────────────────────────
function CounterBadge({ urgente, aviso, info }: { urgente: number; aviso: number; info: number }) {
  const total = urgente + aviso + info;
  if (total === 0) return null;
  return (
    <View style={styles.counterRow}>
      {urgente > 0 && (
        <View style={[styles.counterChip, { backgroundColor: Colors.danger + '22', borderColor: Colors.danger + '55' }]}>
          <View style={[styles.counterDot, { backgroundColor: Colors.danger }]} />
          <Text style={[styles.counterNum, { color: Colors.danger }]}>{urgente}</Text>
        </View>
      )}
      {aviso > 0 && (
        <View style={[styles.counterChip, { backgroundColor: Colors.warning + '22', borderColor: Colors.warning + '55' }]}>
          <View style={[styles.counterDot, { backgroundColor: Colors.warning }]} />
          <Text style={[styles.counterNum, { color: Colors.warning }]}>{aviso}</Text>
        </View>
      )}
      {info > 0 && (
        <View style={[styles.counterChip, { backgroundColor: Colors.info + '22', borderColor: Colors.info + '55' }]}>
          <View style={[styles.counterDot, { backgroundColor: Colors.info }]} />
          <Text style={[styles.counterNum, { color: Colors.info }]}>{info}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PendenciasStream() {
  const { user } = useAuth();
  const { isDesktop } = useBreakpoint();

  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!user || !VISIBLE_ROLES.includes(user.role)) return null;

  const visible = pendencias.filter(p => !dismissed.has(p.id));
  const urgente = visible.filter(p => p.severidade === 'urgente').length;
  const aviso = visible.filter(p => p.severidade === 'aviso').length;
  const info = visible.filter(p => p.severidade === 'info').length;
  const total = visible.length;

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<Pendencia[]>('/api/pendencias-alunos');
      setPendencias(data);
      setCurrentIndex(0);
    } catch (_e) {
      // silent fail — avoid disrupting the UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  // Pulsate the button when there are urgent issues
  useEffect(() => {
    if (urgente > 0 && !expanded) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [urgente, expanded]);

  // Auto-rotate cards in minimised mode
  useEffect(() => {
    if (expanded || total === 0) {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
      return;
    }
    rotateTimerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % total);
    }, ROTATE_INTERVAL);
    return () => {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    };
  }, [expanded, total]);

  // Animate panel open/close
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
  }, [expanded]);

  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  }, []);

  const panelWidth = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, isDesktop ? 340 : 310] });
  const panelOpacity = slideAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 1] });

  if (total === 0 && !isLoading) return null;

  const currentCard = visible[currentIndex % Math.max(total, 1)];

  return (
    <View style={[styles.container, isDesktop ? styles.containerDesktop : styles.containerMobile]}>
      {/* Expanded panel */}
      <Animated.View style={[styles.panel, { width: panelWidth, opacity: panelOpacity }]}>
        {expanded && (
          <View style={styles.panelInner}>
            {/* Panel header */}
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleRow}>
                <MaterialCommunityIcons name="alert-decagram" size={18} color={Colors.warning} />
                <Text style={styles.panelTitle}>Pendências de Alunos</Text>
              </View>
              <CounterBadge urgente={urgente} aviso={aviso} info={info} />
              <TouchableOpacity onPress={() => setExpanded(false)} style={styles.collapseBtn}>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.refreshRow} onPress={load} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.refreshText}>{isLoading ? 'A actualizar...' : 'Actualizar agora'}</Text>
            </TouchableOpacity>

            {/* Scrollable card list */}
            <ScrollView
              style={styles.cardList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.cardListContent}
            >
              {visible.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle-outline" size={32} color={Colors.success} />
                  <Text style={styles.emptyText}>Sem pendências activas</Text>
                </View>
              ) : (
                visible.map(p => (
                  <StudentCard key={p.id} p={p} onDismiss={() => handleDismiss(p.id)} />
                ))
              )}
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* Toggle button + mini card preview */}
      <View style={styles.toggleArea}>
        {!expanded && currentCard && (
          <Animated.View style={[styles.miniCard, { borderLeftColor: getSeveridadeColor(currentCard.severidade) }]}>
            <View style={styles.miniCardInner}>
              {/* Mini avatar */}
              <View style={[styles.miniAvatar, { backgroundColor: getAvatarColor(currentCard.nome) }]}>
                {currentCard.foto ? (
                  <Image source={{ uri: currentCard.foto }} style={styles.miniAvatarImg} />
                ) : (
                  <Text style={styles.miniAvatarText}>{getInitials(currentCard.nome, currentCard.apelido)}</Text>
                )}
              </View>
              <View style={styles.miniInfo}>
                <Text style={styles.miniName} numberOfLines={1}>{currentCard.nome} {currentCard.apelido}</Text>
                <Text style={styles.miniMatricula}>{currentCard.numeroMatricula}</Text>
                <Text style={[styles.miniDesc, { color: getSeveridadeColor(currentCard.severidade) }]} numberOfLines={1}>
                  {currentCard.descricao}
                </Text>
              </View>
            </View>
            {/* Dots indicator */}
            {total > 1 && (
              <View style={styles.dotsRow}>
                {Array.from({ length: Math.min(total, 5) }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === (currentIndex % Math.min(total, 5)) && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* FAB button */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[
              styles.fab,
              urgente > 0 && styles.fabUrgente,
              expanded && styles.fabExpanded,
            ]}
            onPress={() => setExpanded(v => !v)}
            activeOpacity={0.85}
          >
            {expanded ? (
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="alert-decagram" size={20} color="#fff" />
                {total > 0 && (
                  <View style={[styles.fabBadge, urgente > 0 ? styles.fabBadgeUrgente : styles.fabBadgeAviso]}>
                    <Text style={styles.fabBadgeText}>{total > 99 ? '99+' : total}</Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'flex-end',
  } as any,
  containerDesktop: {
    bottom: 28,
    left: 24,
    flexDirection: 'row-reverse',
  } as any,
  containerMobile: {
    bottom: 20,
    left: 16,
    flexDirection: 'row-reverse',
  } as any,

  // ── Panel ──
  panel: {
    overflow: 'hidden',
    marginLeft: 8,
  },
  panelInner: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    maxHeight: 520,
    width: '100%',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  panelTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  panelTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  collapseBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  refreshText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  cardList: {
    flex: 1,
  },
  cardListContent: {
    padding: 10,
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },

  // ── Counter badges ──
  counterRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  counterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  counterDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  counterNum: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },

  // ── Student card ──
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  severityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  severityText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  areaBadge: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  areaText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  dismissBtn: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Identity row ──
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 10,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.gold + '88',
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.gold + '55',
  },
  avatarInitials: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  avatarCorner: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
  studentInfo: {
    flex: 1,
    gap: 3,
  },
  studentName: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    lineHeight: 16,
  },
  matriculaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  matriculaText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  turmaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  turmaText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  cursoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cursoText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },

  // ── Pendência box ──
  pendenciaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    gap: 8,
  },
  pendenciaIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendenciaContent: {
    flex: 1,
    gap: 2,
  },
  pendenciaTipo: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  pendenciaDescricao: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 15,
  },

  // ── Action row ──
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  resolverBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 7,
    gap: 5,
  },
  resolverText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  verPerfilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 5,
    backgroundColor: Colors.surface,
  },
  verPerfilText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },

  // ── Toggle area ──
  toggleArea: {
    alignItems: 'flex-end',
    gap: 8,
  },

  // ── Mini card ──
  miniCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    width: 220,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  miniCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  miniAvatarText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  miniInfo: {
    flex: 1,
    gap: 1,
  },
  miniName: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  miniMatricula: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.gold,
    letterSpacing: 0.4,
  },
  miniDesc: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    lineHeight: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.gold,
    width: 12,
  },

  // ── FAB ──
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 2,
    borderColor: Colors.surfaceLight,
    position: 'relative',
  },
  fabUrgente: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger + 'AA',
  },
  fabExpanded: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accentLight + '88',
  },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
  },
  fabBadgeUrgente: {
    backgroundColor: Colors.danger,
  },
  fabBadgeAviso: {
    backgroundColor: Colors.warning,
  },
  fabBadgeText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
