import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Alert,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useNotificacoes, TipoNotificacao, Notificacao, timeAgo } from '@/context/NotificacoesContext';

const FILTROS = [
  { key: 'todas', label: 'Todas' },
  { key: 'nao_lidas', label: 'Não lidas' },
  { key: 'urgente', label: 'Urgente' },
  { key: 'aviso', label: 'Aviso' },
  { key: 'info', label: 'Info' },
  { key: 'sucesso', label: 'Sucesso' },
];

const TIPO_CONFIG: Record<TipoNotificacao, { icon: string; color: string; bg: string }> = {
  urgente: { icon: 'alert-circle', color: Colors.accent, bg: Colors.accent + '22' },
  aviso: { icon: 'warning', color: Colors.warning, bg: Colors.warning + '22' },
  info: { icon: 'information-circle', color: Colors.info, bg: Colors.info + '22' },
  sucesso: { icon: 'checkmark-circle', color: Colors.success, bg: Colors.success + '22' },
};

function NotificacaoItem({ item, onPress, onDelete }: { item: Notificacao; onPress: (n: Notificacao) => void; onDelete: (id: string) => void }) {
  const config = TIPO_CONFIG[item.tipo];
  return (
    <TouchableOpacity
      style={[styles.notifItem, !item.lida && styles.notifItemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.notifIcon, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon as any} size={22} color={config.color} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifTitleRow}>
          <Text style={[styles.notifTitle, !item.lida && styles.notifTitleBold]} numberOfLines={1}>
            {item.titulo}
          </Text>
          {!item.lida && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notifMsg} numberOfLines={2}>{item.mensagem}</Text>
        <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function NotificacoesScreen() {
  const { notificacoes, unreadCount, marcarLida, marcarTodasLidas, deletarNotificacao } = useNotificacoes();
  const router = useRouter();
  const [filtro, setFiltro] = useState('todas');

  const filtered = notificacoes.filter(n => {
    if (filtro === 'todas') return true;
    if (filtro === 'nao_lidas') return !n.lida;
    return n.tipo === filtro;
  });

  async function handlePress(n: Notificacao) {
    await marcarLida(n.id);
    if (n.link) {
      try { router.push(n.link as any); } catch {}
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Remover', 'Remover esta notificação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => deletarNotificacao(id) },
    ]);
  }

  return (
    <View style={styles.container}>
      <TopBar
        title="Notificações"
        subtitle={unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
        rightAction={unreadCount > 0 ? { icon: 'checkmark-done', onPress: marcarTodasLidas } : undefined}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll}>
        <View style={styles.filtrosRow}>
          {FILTROS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filtroBtn, filtro === f.key && styles.filtroBtnActive]}
              onPress={() => setFiltro(f.key)}
            >
              <Text style={[styles.filtroText, filtro === f.key && styles.filtroTextActive]}>{f.label}</Text>
              {f.key === 'nao_lidas' && unreadCount > 0 && (
                <View style={styles.filtroBadge}>
                  <Text style={styles.filtroBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sem notificações</Text>
          <Text style={styles.emptyMsg}>
            {filtro === 'nao_lidas' ? 'Todas as notificações estão lidas.' : 'Não existem notificações nesta categoria.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <NotificacaoItem item={item} onPress={handlePress} onDelete={handleDelete} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filtrosScroll: { maxHeight: 52, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filtrosRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filtroBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface },
  filtroBtnActive: { backgroundColor: Colors.accent },
  filtroText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  filtroTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  filtroBadge: { backgroundColor: Colors.gold, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filtroBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#000' },
  list: { paddingTop: 8, paddingBottom: 32 },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  notifItemUnread: { backgroundColor: 'rgba(26,43,95,0.5)' },
  notifIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifContent: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  notifTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  notifTitleBold: { fontFamily: 'Inter_700Bold' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.info },
  notifMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  deleteBtn: { padding: 4, flexShrink: 0, alignSelf: 'center' },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptyMsg: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
});
