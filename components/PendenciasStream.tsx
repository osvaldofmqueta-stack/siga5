import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, Image, Platform, Dimensions,
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
const CARD_WIDTH_DESKTOP = 290;
const CARD_WIDTH_MOBILE = 260;
const SIDE_PAUSE_LEFT = 2500;
const SIDE_PAUSE_RIGHT = 3500;
const SIDE_SLIDE_DURATION = 900;

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
  const colors = ['#4A90D9', '#1E3A5F', '#C89A2A', '#2ECC71', '#3498DB', '#8E44AD'];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Avatar Component ─────────────────────────────────────────────────────────
function StudentAvatar({ foto, nome, apelido, size = 52 }: {
  foto: string | null; nome: string; apelido: string; size?: number;
}) {
  const initials = getInitials(nome, apelido);
  const color = getAvatarColor(nome);
  const radius = size * 0.16;

  if (foto) {
    return (
      <Image
        source={{ uri: foto }}
        style={{ width: size, height: size, borderRadius: radius, borderWidth: 2, borderColor: Colors.gold + '88' }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: radius,
      backgroundColor: color,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: Colors.gold + '55',
    }}>
      <Text style={{ fontSize: size * 0.34, fontFamily: 'Inter_700Bold', color: '#fff' }}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Student ID Card (full panel) ─────────────────────────────────────────────
function StudentCard({ p, onDismiss }: { p: Pendencia; onDismiss: () => void }) {
  const router = useRouter();
  const sevColor = getSeveridadeColor(p.severidade);
  const icon = getTipoIcon(p.tipoPendencia);
  const tipoLabel = getTipoLabel(p.tipoPendencia);

  return (
    <View style={[styles.card, { borderLeftColor: sevColor }]}>
      <View style={[styles.cardGlow, { backgroundColor: sevColor + '18' }]} />

      {/* Header */}
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

      {/* Student identity */}
      <View style={styles.identityRow}>
        <View style={styles.avatarWrapper}>
          <StudentAvatar foto={p.foto} nome={p.nome} apelido={p.apelido} size={52} />
          <View style={styles.avatarCorner} />
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName} numberOfLines={1}>{p.nome} {p.apelido}</Text>
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

      {/* Actions */}
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

// ─── Trigger Card (collapsed state) ───────────────────────────────────────────
function TriggerCard({
  p, total, currentIndex, pulseAnim, onExpand,
}: {
  p: Pendencia;
  total: number;
  currentIndex: number;
  pulseAnim: Animated.Value;
  onExpand: () => void;
}) {
  const router = useRouter();
  const sevColor = getSeveridadeColor(p.severidade);
  const icon = getTipoIcon(p.tipoPendencia);
  const tipoLabel = getTipoLabel(p.tipoPendencia);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View style={[styles.triggerCard, { borderLeftColor: sevColor }]}>
        {/* Subtle glow */}
        <View style={[styles.triggerGlow, { backgroundColor: sevColor + '10' }]} />

        <View style={styles.triggerInner}>
          {/* Avatar */}
          <View style={styles.triggerAvatarWrap}>
            <StudentAvatar foto={p.foto} nome={p.nome} apelido={p.apelido} size={46} />
            {/* Severity indicator dot */}
            <View style={[styles.triggerSevDot, { backgroundColor: sevColor }]} />
          </View>

          {/* Student info */}
          <View style={styles.triggerContent}>
            {/* Name + counter */}
            <View style={styles.triggerTopRow}>
              <Text style={styles.triggerName} numberOfLines={1}>{p.nome} {p.apelido}</Text>
              {total > 1 && (
                <View style={[styles.triggerCount, { backgroundColor: sevColor }]}>
                  <Text style={styles.triggerCountText}>{total > 99 ? '99+' : total}</Text>
                </View>
              )}
            </View>

            {/* Matricula */}
            <View style={styles.triggerMatriculaRow}>
              <Ionicons name="card-outline" size={10} color={Colors.gold} />
              <Text style={styles.triggerMatricula}>{p.numeroMatricula}</Text>
              <Text style={styles.triggerTurma} numberOfLines={1}> · {p.turma}</Text>
            </View>

            {/* Issue pill */}
            <View style={[styles.triggerIssuePill, { backgroundColor: sevColor + '1A', borderColor: sevColor + '44' }]}>
              {icon.lib === 'ion' ? (
                <Ionicons name={icon.name as any} size={10} color={sevColor} />
              ) : (
                <MaterialCommunityIcons name={icon.name as any} size={10} color={sevColor} />
              )}
              <Text style={[styles.triggerIssueLabel, { color: sevColor }]}>{tipoLabel}</Text>
              <Text style={styles.triggerIssueDesc} numberOfLines={1}> · {p.descricao}</Text>
            </View>

            {/* Action row */}
            <View style={styles.triggerActions}>
              <TouchableOpacity
                style={[styles.triggerResolverBtn, { borderColor: sevColor + '55', backgroundColor: sevColor + '18' }]}
                onPress={() => {
                  if (p.tipoPendencia === 'nota_negativa') router.push('/(main)/notas' as any);
                  else if (p.tipoPendencia === 'faltas_excessivas') router.push('/(main)/presencas' as any);
                  else router.push('/(main)/pagamentos-hub' as any);
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="checkmark-circle-outline" size={11} color={sevColor} />
                <Text style={[styles.triggerResolverText, { color: sevColor }]}>Resolver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.triggerExpandBtn}
                onPress={onExpand}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="alert-decagram" size={11} color={Colors.textMuted} />
                <Text style={styles.triggerExpandText}>Ver todos</Text>
                <Ionicons name="chevron-back" size={11} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Pagination dots */}
        {total > 1 && (
          <View style={styles.triggerDots}>
            {Array.from({ length: Math.min(total, 6) }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.triggerDot,
                  i === (currentIndex % Math.min(total, 6)) && [styles.triggerDotActive, { backgroundColor: sevColor }],
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
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
  const sideAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const leftOffset = isDesktop ? 16 : 12;
  const slideXAnim = useRef(new Animated.Value(leftOffset)).current;

  const shouldRender = !!(user && VISIBLE_ROLES.includes(user.role));

  const visible = pendencias.filter(p => !dismissed.has(p.id));
  const urgente = visible.filter(p => p.severidade === 'urgente').length;
  const aviso = visible.filter(p => p.severidade === 'aviso').length;
  const info = visible.filter(p => p.severidade === 'info').length;
  const total = visible.length;

  const load = useCallback(async () => {
    if (!shouldRender) return;
    try {
      setIsLoading(true);
      const data = await api.get<Pendencia[]>('/api/pendencias-alunos');
      setPendencias(data);
      setCurrentIndex(0);
    } catch (_e) {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    load();
    const interval = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load, shouldRender]);

  // Pulse when urgent and collapsed
  useEffect(() => {
    if (!shouldRender) return;
    if (urgente > 0 && !expanded) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [urgente, expanded, shouldRender]);

  // Auto-rotate cards
  useEffect(() => {
    if (!shouldRender || expanded || total === 0) {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
      return;
    }
    rotateTimerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % total);
    }, ROTATE_INTERVAL);
    return () => {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    };
  }, [expanded, total, shouldRender]);

  // Animate panel
  useEffect(() => {
    if (!shouldRender) return;
    Animated.spring(slideAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
  }, [expanded, shouldRender]);

  // Side-to-side sliding animation (only when collapsed and has items)
  useEffect(() => {
    if (!shouldRender) return;

    if (sideAnimRef.current) {
      sideAnimRef.current.stop();
      sideAnimRef.current = null;
    }

    if (expanded || total === 0) {
      // Snap back to left side when expanded or no items
      Animated.spring(slideXAnim, {
        toValue: leftOffset,
        useNativeDriver: false,
        tension: 60,
        friction: 12,
      }).start();
      return;
    }

    const screenW = Dimensions.get('window').width;
    const cardW = isDesktop ? CARD_WIDTH_DESKTOP : CARD_WIDTH_MOBILE;
    const rightX = Math.max(screenW - cardW - leftOffset, leftOffset);

    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(SIDE_PAUSE_LEFT),
        Animated.timing(slideXAnim, {
          toValue: rightX,
          duration: SIDE_SLIDE_DURATION,
          useNativeDriver: false,
        }),
        Animated.delay(SIDE_PAUSE_RIGHT),
        Animated.timing(slideXAnim, {
          toValue: leftOffset,
          duration: SIDE_SLIDE_DURATION,
          useNativeDriver: false,
        }),
      ])
    );

    sideAnimRef.current = anim;
    anim.start();

    return () => {
      anim.stop();
      sideAnimRef.current = null;
    };
  }, [expanded, total, shouldRender, isDesktop, leftOffset]);

  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  }, []);

  const panelWidth = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, isDesktop ? 340 : 310] });
  const panelOpacity = slideAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 1] });

  if (!shouldRender) return null;
  if (total === 0 && !isLoading) return null;

  const currentCard = visible[currentIndex % Math.max(total, 1)];

  return (
    <Animated.View style={[styles.container, isDesktop ? styles.containerDesktop : styles.containerMobile, { left: slideXAnim }]}>
      {/* Expanded panel */}
      <Animated.View style={[styles.panel, { width: panelWidth, opacity: panelOpacity }]}>
        {expanded && (
          <View style={styles.panelInner}>
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

      {/* Collapsed trigger card OR nothing when expanded */}
      {!expanded && currentCard && (
        <TriggerCard
          p={currentCard}
          total={total}
          currentIndex={currentIndex}
          pulseAnim={pulseAnim}
          onExpand={() => {
            slideXAnim.setValue(leftOffset);
            setExpanded(true);
          }}
        />
      )}

      {/* Collapse button when panel is open */}
      {expanded && (
        <TouchableOpacity
          style={styles.collapseFloatBtn}
          onPress={() => setExpanded(false)}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </Animated.View>
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
    bottom: 90,
    flexDirection: 'row-reverse',
  } as any,
  containerMobile: {
    bottom: 80,
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

  // ── Full student card (inside expanded panel) ──
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
    top: 0, left: 0, right: 0, bottom: 0,
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

  // ── Trigger card (collapsed state) ──
  triggerCard: {
    width: 270,
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 16,
  },
  triggerGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  triggerInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    gap: 10,
  },
  triggerAvatarWrap: {
    position: 'relative',
  },
  triggerSevDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
  },
  triggerContent: {
    flex: 1,
    gap: 4,
  },
  triggerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  triggerName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  triggerCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  triggerCountText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  triggerMatriculaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  triggerMatricula: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.gold,
    letterSpacing: 0.4,
  },
  triggerTurma: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    flex: 1,
  },
  triggerIssuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  triggerIssueLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
  triggerIssueDesc: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    flex: 1,
  },
  triggerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  triggerResolverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  triggerResolverText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  triggerExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 7,
    gap: 3,
  },
  triggerExpandText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  triggerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 7,
  },
  triggerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  triggerDotActive: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },

  // ── Collapse float button (when expanded) ──
  collapseFloatBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
