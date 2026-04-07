import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useData, Sala } from '@/context/DataContext';
import TopBar from '@/components/TopBar';
import { alertSucesso, alertErro } from '@/utils/toast';
import { useLookup } from '@/hooks/useLookup';
import { webAlert } from '@/utils/webAlert';

const TIPOS_SALA_FALLBACK = ['Sala Normal', 'Laboratório', 'Sala de Informática', 'Auditório', 'Sala de Reunião'];

const TIPO_ICONS: Record<string, string> = {
  'Sala Normal': 'door-open',
  'Laboratório': 'flask',
  'Sala de Informática': 'desktop-tower-monitor',
  'Auditório': 'theater',
  'Sala de Reunião': 'account-group',
};

const TIPO_COLORS: Record<string, string> = {
  'Sala Normal': Colors.info,
  'Laboratório': Colors.success,
  'Sala de Informática': Colors.gold,
  'Auditório': Colors.accent,
  'Sala de Reunião': Colors.warning,
};

function SalaFormModal({ visible, onClose, onSave, sala }: { visible: boolean; onClose: () => void; onSave: (s: Partial<Sala>) => void; sala?: Sala | null }) {
  const { values: tiposSala } = useLookup('tipos_sala', TIPOS_SALA_FALLBACK);
  const defaultTipo = tiposSala[0] || 'Sala Normal';
  const [form, setForm] = useState<Partial<Sala>>(sala || {
    nome: '', bloco: '', capacidade: 30, tipo: defaultTipo, ativo: true,
  });
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  React.useEffect(() => {
    if (visible) {
      setForm(sala || { nome: '', bloco: '', capacidade: 30, tipo: defaultTipo, ativo: true });
    }
  }, [visible, sala]);

  const set = (k: keyof Sala, v: any) => setForm(f => ({ ...f, [k]: v }));
  const blocoRef = useRef<any>(null);
  const capRef = useRef<any>(null);

  function handleSave() {
    if (!form.nome?.trim()) {
      webAlert('Campo obrigatório', 'Introduza o nome da sala.');
      return;
    }
    if (!form.capacidade || form.capacidade < 1) {
      webAlert('Capacidade inválida', 'A capacidade deve ser pelo menos 1.');
      return;
    }
    onSave(form);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={[mS.container, { paddingBottom: bottomPad + 16 }]}>
          <View style={mS.header}>
            <Text style={mS.title}>{sala ? 'Editar Sala' : 'Nova Sala de Aula'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Nome da Sala *</Text>
              <TextInput
                style={mS.input}
                value={form.nome ?? ''}
                onChangeText={v => set('nome', v)}
                placeholder="Ex: Sala 101, Lab. Química"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => blocoRef.current?.focus()}
              />
            </View>

            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Bloco / Edifício</Text>
              <TextInput
                ref={blocoRef}
                style={mS.input}
                value={form.bloco ?? ''}
                onChangeText={v => set('bloco', v)}
                placeholder="Ex: Bloco A, Edifício Principal"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => capRef.current?.focus()}
              />
            </View>

            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Capacidade (alunos)</Text>
              <TextInput
                ref={capRef}
                style={mS.input}
                value={String(form.capacidade ?? 30)}
                onChangeText={v => set('capacidade', parseInt(v) || 0)}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>

            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Tipo de Sala</Text>
              <View style={mS.tipoGrid}>
                {tiposSala.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[mS.tipoBtn, form.tipo === t && { backgroundColor: (TIPO_COLORS[t] || Colors.accent) + '22', borderColor: TIPO_COLORS[t] || Colors.accent }]}
                    onPress={() => set('tipo', t)}
                  >
                    <MaterialCommunityIcons
                      name={TIPO_ICONS[t] as any || 'door-open'}
                      size={18}
                      color={form.tipo === t ? (TIPO_COLORS[t] || Colors.accent) : Colors.textMuted}
                    />
                    <Text style={[mS.tipoText, form.tipo === t && { color: TIPO_COLORS[t] || Colors.accent }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Estado</Text>
              <View style={mS.toggleRow}>
                {[{ label: 'Activa', value: true }, { label: 'Inactiva', value: false }].map(opt => (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[mS.toggleBtn, form.ativo === opt.value && mS.toggleActive]}
                    onPress={() => set('ativo', opt.value)}
                  >
                    <Text style={[mS.toggleText, form.ativo === opt.value && mS.toggleTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={mS.actions}>
            <TouchableOpacity style={mS.cancelBtn} onPress={onClose}>
              <Text style={mS.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mS.saveBtn} onPress={handleSave}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={mS.saveText}>{sala ? 'Actualizar' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SalasScreen() {
  const insets = useSafeAreaInsets();
  const { salas, addSala, updateSala, deleteSala } = useData();
  const { values: tiposSalaFiltro } = useLookup('tipos_sala', TIPOS_SALA_FALLBACK);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Sala | null>(null);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const filtered = useMemo(() => {
    return salas.filter(s => {
      const matchSearch = !search || s.nome.toLowerCase().includes(search.toLowerCase()) || (s.bloco || '').toLowerCase().includes(search.toLowerCase());
      const matchTipo = !filterTipo || s.tipo === filterTipo;
      return matchSearch && matchTipo;
    });
  }, [salas, search, filterTipo]);

  const stats = useMemo(() => ({
    total: salas.length,
    ativas: salas.filter(s => s.ativo).length,
    capacidadeTotal: salas.filter(s => s.ativo).reduce((sum, s) => sum + s.capacidade, 0),
  }), [salas]);

  async function handleSave(form: Partial<Sala>) {
    if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      if (editing) {
        await updateSala(editing.id, form);
        alertSucesso('Sala actualizada', `"${form.nome}" foi actualizada com sucesso.`);
      } else {
        await addSala({
          nome: form.nome!,
          bloco: form.bloco || '',
          capacidade: form.capacidade || 30,
          tipo: form.tipo || 'Sala Normal',
          ativo: form.ativo ?? true,
        });
        alertSucesso('Sala criada', `"${form.nome}" foi adicionada com sucesso.`);
      }
    } catch {
      alertErro('Erro', 'Não foi possível guardar a sala. Tente novamente.');
    }
    setShowForm(false);
    setEditing(null);
  }

  function handleEdit(sala: Sala) {
    setEditing(sala);
    setShowForm(true);
  }

  function handleDelete(sala: Sala) {
    webAlert(
      'Remover Sala',
      `Tem a certeza que deseja remover "${sala.nome}"? Esta acção não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            try {
              await deleteSala(sala.id);
              alertSucesso('Sala removida', `"${sala.nome}" foi removida com sucesso.`);
            } catch {
              alertErro('Erro', 'Não foi possível remover a sala.');
            }
          },
        },
      ]
    );
  }

  function handleToggleAtivo(sala: Sala) {
    updateSala(sala.id, { ativo: !sala.ativo });
    alertSucesso(sala.ativo ? 'Sala desactivada' : 'Sala activada', `"${sala.nome}" foi ${sala.ativo ? 'desactivada' : 'activada'}.`);
  }

  const renderItem = ({ item }: { item: Sala }) => {
    const color = TIPO_COLORS[item.tipo] || Colors.accent;
    const icon = TIPO_ICONS[item.tipo] || 'door-open';
    return (
      <View style={[styles.card, !item.ativo && styles.cardInactive]}>
        <View style={[styles.cardAccent, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
              <MaterialCommunityIcons name={icon as any} size={22} color={color} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.nome}</Text>
              {!!item.bloco && <Text style={styles.cardBloco}>{item.bloco}</Text>}
              <View style={styles.cardMeta}>
                <View style={[styles.tipoBadge, { backgroundColor: color + '18' }]}>
                  <Text style={[styles.tipoLabel, { color }]}>{item.tipo}</Text>
                </View>
                <View style={styles.capacidadeRow}>
                  <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.capacidadeText}>{item.capacidade} alunos</Text>
                </View>
              </View>
            </View>
            <View style={[styles.statusDot, { backgroundColor: item.ativo ? Colors.success : Colors.textMuted }]} />
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: item.ativo ? Colors.warning + '18' : Colors.success + '18' }]}
              onPress={() => handleToggleAtivo(item)}
            >
              <Ionicons name={item.ativo ? 'pause-circle-outline' : 'play-circle-outline'} size={15} color={item.ativo ? Colors.warning : Colors.success} />
              <Text style={[styles.actionText, { color: item.ativo ? Colors.warning : Colors.success }]}>
                {item.ativo ? 'Desactivar' : 'Activar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.info + '18' }]} onPress={() => handleEdit(item)}>
              <Ionicons name="pencil-outline" size={15} color={Colors.info} />
              <Text style={[styles.actionText, { color: Colors.info }]}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.danger + '18' }]} onPress={() => handleDelete(item)}>
              <Ionicons name="trash-outline" size={15} color={Colors.danger} />
              <Text style={[styles.actionText, { color: Colors.danger }]}>Remover</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <TopBar
        title="Salas de Aula"
        rightAction={{ icon: 'add', onPress: () => { setEditing(null); setShowForm(true); } }}
      />

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Colors.success }]}>{stats.ativas}</Text>
                <Text style={styles.statLabel}>Activas</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Colors.gold }]}>{stats.capacidadeTotal}</Text>
                <Text style={styles.statLabel}>Cap. Total</Text>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Pesquisar sala..."
                placeholderTextColor={Colors.textMuted}
              />
              {!!search && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Tipo Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !filterTipo && styles.filterChipActive]}
                onPress={() => setFilterTipo(null)}
              >
                <Text style={[styles.filterChipText, !filterTipo && styles.filterChipTextActive]}>Todos</Text>
              </TouchableOpacity>
              {tiposSalaFiltro.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterChip, filterTipo === t && { backgroundColor: (TIPO_COLORS[t] || Colors.accent) + '22', borderColor: TIPO_COLORS[t] || Colors.accent }]}
                  onPress={() => setFilterTipo(filterTipo === t ? null : t)}
                >
                  <MaterialCommunityIcons name={TIPO_ICONS[t] as any || 'door-open'} size={12} color={filterTipo === t ? (TIPO_COLORS[t] || Colors.accent) : Colors.textMuted} />
                  <Text style={[styles.filterChipText, filterTipo === t && { color: TIPO_COLORS[t] || Colors.accent }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filtered.length === 0 && (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="door-open" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>{search || filterTipo ? 'Nenhuma sala encontrada' : 'Sem salas registadas'}</Text>
                <Text style={styles.emptyDesc}>{search || filterTipo ? 'Tente alterar os filtros.' : 'Adicione a primeira sala de aula clicando no botão + acima.'}</Text>
              </View>
            )}
          </>
        )}
      />

      <SalaFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
        sala={editing}
      />
    </View>
  );
}

const mS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  container: {
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 480,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontFamily: 'Inter_400Regular', fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  tipoGrid: { gap: 8 },
  tipoBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  tipoText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, flex: 1 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  toggleActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent },
  toggleText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  toggleTextActive: { color: Colors.accent },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.accent },
  saveText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  list: { paddingHorizontal: 16, paddingTop: 8 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 10,
  },
  searchInput: { flex: 1, color: Colors.text, fontFamily: 'Inter_400Regular', fontSize: 14 },

  filterScroll: { marginBottom: 14 },
  filterRow: { gap: 8, paddingRight: 4 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent },
  filterChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  filterChipTextActive: { color: Colors.accent },

  card: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14,
    marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  cardInactive: { opacity: 0.6 },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  cardBloco: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tipoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tipoLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  capacidadeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  capacidadeText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },

  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 8 },
  actionText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 20 },
});
