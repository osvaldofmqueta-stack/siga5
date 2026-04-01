import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useNotificacoes, TipoNotificacao, Notificacao, timeAgo } from '@/context/NotificacoesContext';
import { webAlert } from '@/utils/webAlert';

// ── Tipo config ───────────────────────────────────────────────────────────────
const TIPO_CONFIG: Record<TipoNotificacao, {
  icon: string; iconLib: 'ion' | 'mci';
  color: string; bg: string; label: string; badgeColor: string;
}> = {
  urgente: { icon: 'alert-circle',          iconLib: 'ion', color: '#FF4757', bg: '#FF475715', label: 'Urgente',  badgeColor: '#FF4757' },
  aviso:   { icon: 'alert-decagram-outline', iconLib: 'mci', color: '#F39C12', bg: '#F39C1215', label: 'Aviso',    badgeColor: '#F39C12' },
  info:    { icon: 'information-circle',     iconLib: 'ion', color: '#3498DB', bg: '#3498DB15', label: 'Info',     badgeColor: '#3498DB' },
  sucesso: { icon: 'checkmark-circle',       iconLib: 'ion', color: '#2ECC71', bg: '#2ECC7115', label: 'Sucesso',  badgeColor: '#2ECC71' },
};

const FILTROS: { key: string; label: string; icon: string }[] = [
  { key: 'todas',    label: 'Todas',    icon: 'layers-outline' },
  { key: 'nao_lidas',label: 'Não lidas',icon: 'ellipse' },
  { key: 'urgente',  label: 'Urgente',  icon: 'alert-circle-outline' },
  { key: 'aviso',    label: 'Aviso',    icon: 'warning-outline' },
  { key: 'info',     label: 'Info',     icon: 'information-circle-outline' },
  { key: 'sucesso',  label: 'Sucesso',  icon: 'checkmark-circle-outline' },
];

// ── Group by date ─────────────────────────────────────────────────────────────
function groupByDate(items: Notificacao[]): { title: string; data: Notificacao[] }[] {
  const groups: Record<string, Notificacao[]> = {};
  items.forEach(n => {
    const d = new Date(n.createdAt);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    let key: string;
    if (d.toDateString() === today.toDateString()) key = 'Hoje';
    else if (d.toDateString() === yesterday.toDateString()) key = 'Ontem';
    else key = d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

// ── Notificação Item ──────────────────────────────────────────────────────────
function NotifItem({
  item,
  onPress,
  onDelete,
}: {
  item: Notificacao;
  onPress: (n: Notificacao) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = TIPO_CONFIG[item.tipo];

  return (
    <TouchableOpacity
      style={[styles.item, !item.lida && styles.itemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {/* Linha indicadora de não lida */}
      {!item.lida && <View style={[styles.unreadBar, { backgroundColor: cfg.color }]} />}

      {/* Ícone */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        {cfg.iconLib === 'ion'
          ? <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
          : <MaterialCommunityIcons name={cfg.icon as any} size={22} color={cfg.color} />}
      </View>

      {/* Conteúdo */}
      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <View style={[styles.badge, { backgroundColor: cfg.badgeColor + '25' }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={[styles.itemTitle, !item.lida && styles.itemTitleBold]} numberOfLines={1}>
          {item.titulo}
        </Text>
        <Text style={styles.itemMsg} numberOfLines={2}>{item.mensagem}</Text>
      </View>

      {/* Acções */}
      <View style={styles.itemActions}>
        {!item.lida && <View style={styles.dot} />}
        <TouchableOpacity
          style={styles.delBtn}
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Modal de Detalhe ──────────────────────────────────────────────────────────
function DetalheModal({
  notif,
  onClose,
  onDelete,
  router,
}: {
  notif: Notificacao | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (!notif) return null;
  const cfg = TIPO_CONFIG[notif.tipo];
  return (
    <Modal visible={!!notif} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.detalheBox}>
          {/* Header colorido */}
          <View style={[styles.detalheHeader, { backgroundColor: cfg.bg, borderBottomColor: cfg.color + '30' }]}>
            <View style={[styles.detalheIconWrap, { backgroundColor: cfg.bg }]}>
              {cfg.iconLib === 'ion'
                ? <Ionicons name={cfg.icon as any} size={32} color={cfg.color} />
                : <MaterialCommunityIcons name={cfg.icon as any} size={32} color={cfg.color} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={[styles.badge, { backgroundColor: cfg.badgeColor + '30', alignSelf: 'flex-start', marginBottom: 4 }]}>
                <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
              <Text style={styles.detalheTitulo}>{notif.titulo}</Text>
              <Text style={styles.detalheTime}>
                {new Date(notif.createdAt).toLocaleDateString('pt-PT', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.detalheClose}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mensagem */}
          <ScrollView style={styles.detalheMsgScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.detalheMsg}>{notif.mensagem}</Text>
          </ScrollView>

          {/* Acções */}
          <View style={styles.detalheFooter}>
            {notif.link ? (
              <TouchableOpacity
                style={[styles.detalheBtn, { backgroundColor: cfg.color }]}
                onPress={() => { onClose(); try { router.push(notif.link as any); } catch {} }}
              >
                <Ionicons name="arrow-forward" size={16} color="#fff" />
                <Text style={styles.detalheBtnText}>Ver mais detalhes</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.detalheBtn, { backgroundColor: Colors.surface, flex: notif.link ? 0 : 1 }]}
              onPress={() => { onDelete(notif.id); onClose(); }}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={[styles.detalheBtnText, { color: Colors.danger }]}>Remover</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Ecrã principal ────────────────────────────────────────────────────────────
export default function NotificacoesScreen() {
  const { notificacoes, unreadCount, marcarLida, marcarTodasLidas, deletarNotificacao } = useNotificacoes();
  const router = useRouter();
  const [filtro, setFiltro] = useState('todas');
  const [selected, setSelected] = useState<Notificacao | null>(null);

  const filtered = useMemo(() => {
    return notificacoes.filter(n => {
      if (filtro === 'todas') return true;
      if (filtro === 'nao_lidas') return !n.lida;
      return n.tipo === filtro;
    });
  }, [notificacoes, filtro]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  // Flatten for FlatList with section headers
  const flatData = useMemo(() => {
    const rows: ({ type: 'header'; title: string } | { type: 'item'; item: Notificacao })[] = [];
    grouped.forEach(g => {
      rows.push({ type: 'header', title: g.title });
      g.data.forEach(item => rows.push({ type: 'item', item }));
    });
    return rows;
  }, [grouped]);

  async function handlePress(n: Notificacao) {
    await marcarLida(n.id);
    setSelected(n);
  }

  function handleDelete(id: string) {
    webAlert('Remover notificação', 'Tem a certeza que pretende remover esta notificação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => deletarNotificacao(id) },
    ]);
  }

  return (
    <View style={styles.container}>
      <TopBar
        title="Notificações"
        subtitle={unreadCount > 0 ? `${unreadCount} por ler` : 'Sem novas notificações'}
        rightAction={unreadCount > 0
          ? { icon: 'checkmark-done-outline', onPress: marcarTodasLidas }
          : undefined}
      />

      {/* Filtros */}
      <View style={styles.filtrosContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtrosRow}>
          {FILTROS.map(f => {
            const isActive = filtro === f.key;
            const cnt = f.key === 'nao_lidas' ? unreadCount
              : f.key === 'todas' ? notificacoes.length
              : notificacoes.filter(n => n.tipo === f.key).length;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filtroBtn, isActive && styles.filtroBtnActive]}
                onPress={() => setFiltro(f.key)}
              >
                <Ionicons
                  name={f.icon as any}
                  size={14}
                  color={isActive ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.filtroText, isActive && styles.filtroTextActive]}>
                  {f.label}
                </Text>
                {cnt > 0 && (
                  <View style={[styles.filtroCnt, isActive && styles.filtroCntActive]}>
                    <Text style={[styles.filtroCntText, isActive && { color: Colors.accent }]}>
                      {cnt}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Cabeçalho de acções */}
      {filtered.length > 0 && (
        <View style={styles.actionsBar}>
          <Text style={styles.actionsCount}>
            {filtered.length} notificaç{filtered.length === 1 ? 'ão' : 'ões'}
          </Text>
          {unreadCount > 0 && filtro !== 'nao_lidas' && (
            <TouchableOpacity style={styles.markAllBtn} onPress={marcarTodasLidas}>
              <Ionicons name="checkmark-done" size={14} color={Colors.info} />
              <Text style={styles.markAllText}>Marcar todas como lidas</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Lista */}
      {flatData.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>
            {filtro === 'nao_lidas' ? 'Tudo lido!' : 'Sem notificações'}
          </Text>
          <Text style={styles.emptyMsg}>
            {filtro === 'nao_lidas'
              ? 'Não tem notificações por ler.'
              : filtro === 'todas'
              ? 'Ainda não recebeu nenhuma notificação.'
              : `Não tem notificações do tipo "${FILTROS.find(f => f.key === filtro)?.label}".`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(row, i) => row.type === 'header' ? `h-${row.title}` : row.item.id}
          renderItem={({ item: row }) => {
            if (row.type === 'header') {
              return (
                <View style={styles.groupHeader}>
                  <View style={styles.groupHeaderLine} />
                  <Text style={styles.groupHeaderText}>{row.title}</Text>
                  <View style={styles.groupHeaderLine} />
                </View>
              );
            }
            return (
              <NotifItem
                item={row.item}
                onPress={handlePress}
                onDelete={handleDelete}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal detalhe */}
      <DetalheModal
        notif={selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
        router={router}
      />
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Filtros
  filtrosContainer: {
    backgroundColor: Colors.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
  },
  filtrosRow: { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filtroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  filtroBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.info + '60',
  },
  filtroText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  filtroTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  filtroCnt: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.backgroundElevated,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filtroCntActive: { backgroundColor: Colors.accent + '22' },
  filtroCntText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted },

  // Actions bar
  actionsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  actionsCount: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  markAllText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.info },

  // Lista
  listContent: { paddingBottom: 32, paddingTop: 4 },

  // Separador de data
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    marginTop: 4,
  },
  groupHeaderLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  groupHeaderText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, letterSpacing: 0.8 },

  // Item
  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginHorizontal: 12, marginVertical: 3,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  itemUnread: {
    borderColor: 'rgba(52,152,219,0.3)',
    backgroundColor: 'rgba(26,43,95,0.8)',
  },
  unreadBar: { width: 3, alignSelf: 'stretch' },
  iconWrap: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    margin: 12, flexShrink: 0,
  },
  itemBody: { flex: 1, paddingVertical: 10, paddingRight: 4 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  itemTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginLeft: 'auto' as any },
  itemTitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text, marginBottom: 3 },
  itemTitleBold: { fontFamily: 'Inter_700Bold' },
  itemMsg: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 17 },
  itemActions: { alignItems: 'center', justifyContent: 'center', paddingRight: 10, paddingTop: 10, gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.info },
  delBtn: { padding: 4 },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 8 },
  emptyMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Modal detalhe
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  detalheBox: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  detalheHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    padding: 20,
    borderBottomWidth: 1,
  },
  detalheIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  detalheTitulo: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text, lineHeight: 20 },
  detalheTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 4 },
  detalheClose: { padding: 4, alignSelf: 'flex-start' },
  detalheMsgScroll: { padding: 20, maxHeight: 200 },
  detalheMsg: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 22 },
  detalheFooter: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  detalheBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
  },
  detalheBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
