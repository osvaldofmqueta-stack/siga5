import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import TopBar from '@/components/TopBar';
import { alertSucesso, alertErro } from '@/utils/toast';

const AREAS = [
  'Ciências Exactas',
  'Ciências Naturais',
  'Ciências Sociais e Humanas',
  'Línguas e Comunicação',
  'Artes e Expressão',
  'Tecnologia e Informática',
  'Educação Física',
  'Formação Profissional',
  'Outra',
];

interface Disciplina {
  id: string;
  nome: string;
  codigo: string;
  area: string;
  descricao: string;
  ativo: boolean;
  createdAt: string;
}

interface FormState {
  nome: string;
  codigo: string;
  area: string;
  descricao: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = {
  nome: '',
  codigo: '',
  area: AREAS[0],
  descricao: '',
  ativo: true,
};

function DisciplinaFormModal({
  visible, onClose, onSave, disciplina,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (form: FormState) => Promise<void>;
  disciplina: Disciplina | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    if (disciplina) {
      setForm({
        nome: disciplina.nome,
        codigo: disciplina.codigo,
        area: disciplina.area || AREAS[0],
        descricao: disciplina.descricao,
        ativo: disciplina.ativo,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [disciplina, visible]);

  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.nome.trim()) {
      Alert.alert('Campo obrigatório', 'O nome da disciplina é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={[mStyles.container, { paddingBottom: bottomPad + 16 }]}>
          <View style={mStyles.header}>
            <Text style={mStyles.title}>{disciplina ? 'Editar Disciplina' : 'Nova Disciplina'}</Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Nome da Disciplina *</Text>
              <TextInput
                style={mStyles.input}
                value={form.nome}
                onChangeText={v => set('nome', v)}
                placeholder="Ex: Matemática"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>

            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Código</Text>
              <TextInput
                style={mStyles.input}
                value={form.codigo}
                onChangeText={v => set('codigo', v.toUpperCase())}
                placeholder="Ex: MAT"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                maxLength={6}
              />
            </View>

            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Área de Conhecimento</Text>
              <TouchableOpacity
                style={[mStyles.input, mStyles.pickerBtn]}
                onPress={() => setShowAreaPicker(true)}
              >
                <Text style={{ color: Colors.text, fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 }}>
                  {form.area}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Descrição</Text>
              <TextInput
                style={[mStyles.input, mStyles.textarea]}
                value={form.descricao}
                onChangeText={v => set('descricao', v)}
                placeholder="Descrição breve da disciplina..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={mStyles.switchRow}>
              <Text style={mStyles.fieldLabel}>Disciplina activa</Text>
              <TouchableOpacity
                style={[mStyles.toggleBtn, form.ativo && mStyles.toggleBtnActive]}
                onPress={() => set('ativo', !form.ativo)}
              >
                <Text style={[mStyles.toggleText, form.ativo && mStyles.toggleTextActive]}>
                  {form.ativo ? 'Activa' : 'Inactiva'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity style={mStyles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.text} />
              : <>
                <Ionicons name="checkmark" size={18} color={Colors.text} />
                <Text style={mStyles.saveBtnText}>Guardar</Text>
              </>
            }
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showAreaPicker} transparent animationType="fade" onRequestClose={() => setShowAreaPicker(false)}>
        <TouchableOpacity style={mStyles.pickerOverlay} onPress={() => setShowAreaPicker(false)} activeOpacity={1}>
          <View style={mStyles.pickerList}>
            <Text style={mStyles.pickerTitle}>Seleccionar Área</Text>
            {AREAS.map(a => (
              <TouchableOpacity
                key={a}
                style={[mStyles.pickerItem, form.area === a && mStyles.pickerItemActive]}
                onPress={() => { set('area', a); setShowAreaPicker(false); }}
              >
                <Text style={[mStyles.pickerItemText, form.area === a && mStyles.pickerItemTextActive]}>{a}</Text>
                {form.area === a && <Ionicons name="checkmark" size={16} color={Colors.gold} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const AREA_COLORS: Record<string, string> = {
  'Ciências Exactas': '#3B82F6',
  'Ciências Naturais': '#10B981',
  'Ciências Sociais e Humanas': '#8B5CF6',
  'Línguas e Comunicação': '#F59E0B',
  'Artes e Expressão': '#EC4899',
  'Tecnologia e Informática': '#06B6D4',
  'Educação Física': '#F97316',
  'Formação Profissional': '#84CC16',
  'Outra': Colors.textMuted,
};

function areaColor(area: string) {
  return AREA_COLORS[area] || Colors.textMuted;
}

export default function DisciplinasScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState<string>('Todas');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Disciplina | null>(null);
  const [showAreaFilter, setShowAreaFilter] = useState(false);

  const canEdit = ['admin', 'ceo', 'pca', 'director', 'chefe_secretaria', 'secretaria'].includes(user?.role ?? '');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/disciplinas');
      if (res.ok) setDisciplinas(await res.json());
    } catch {
      alertErro('Erro', 'Não foi possível carregar as disciplinas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const areas = ['Todas', ...AREAS];

  const filtered = disciplinas.filter(d => {
    const matchSearch = d.nome.toLowerCase().includes(search.toLowerCase()) ||
      d.codigo.toLowerCase().includes(search.toLowerCase()) ||
      d.area.toLowerCase().includes(search.toLowerCase());
    const matchArea = filterArea === 'Todas' || d.area === filterArea;
    return matchSearch && matchArea;
  });

  async function handleSave(form: FormState) {
    try {
      if (editItem) {
        const res = await fetch(`/api/disciplinas/${editItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Erro ao actualizar disciplina.');
        alertSucesso('Disciplina actualizada', `"${form.nome}" foi actualizada com sucesso.`);
      } else {
        const res = await fetch('/api/disciplinas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Erro ao criar disciplina.');
        alertSucesso('Disciplina criada', `"${form.nome}" foi adicionada ao catálogo.`);
      }
      await load();
      setEditItem(null);
    } catch (e: any) {
      alertErro('Erro', e.message);
      throw e;
    }
  }

  function handleDelete(d: Disciplina) {
    Alert.alert(
      'Remover Disciplina',
      `Tem a certeza que deseja remover "${d.nome}"? Esta acção não pode ser revertida.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`/api/disciplinas/${d.id}`, { method: 'DELETE' });
              if (!res.ok) throw new Error('Erro ao remover disciplina.');
              alertSucesso('Disciplina removida', `"${d.nome}" foi removida do catálogo.`);
              await load();
            } catch (e: any) {
              alertErro('Erro', e.message);
            }
          },
        },
      ]
    );
  }

  const byArea = areas.slice(1).map(a => ({
    area: a,
    count: disciplinas.filter(d => d.area === a).length,
  })).filter(x => x.count > 0);

  const renderItem = ({ item }: { item: Disciplina }) => {
    const color = areaColor(item.area);
    return (
      <View style={[styles.card, !item.ativo && styles.cardInactive]}>
        <View style={[styles.cardLeft, { backgroundColor: color + '18', borderColor: color + '30' }]}>
          <MaterialCommunityIcons name="book-open-page-variant" size={20} color={color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName}>{item.nome}</Text>
            {item.codigo ? (
              <View style={[styles.codeBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.codeText, { color }]}>{item.codigo}</Text>
              </View>
            ) : null}
            {!item.ativo && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveText}>Inactiva</Text>
              </View>
            )}
          </View>
          {item.area ? (
            <View style={styles.areaRow}>
              <View style={[styles.areaDot, { backgroundColor: color }]} />
              <Text style={styles.areaText}>{item.area}</Text>
            </View>
          ) : null}
          {item.descricao ? (
            <Text style={styles.descricao} numberOfLines={1}>{item.descricao}</Text>
          ) : null}
        </View>
        {canEdit && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { setEditItem(item); setShowForm(true); }}
            >
              <Ionicons name="create-outline" size={17} color={Colors.info} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
              <Ionicons name="trash-outline" size={17} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <TopBar
        title="Disciplinas"
        subtitle={`${disciplinas.length} no catálogo`}
        rightAction={canEdit ? { icon: 'add-circle', onPress: () => { setEditItem(null); setShowForm(true); } } : undefined}
      />

      <LinearGradient colors={['#0D1B3E', '#112257']} style={styles.hero}>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={[styles.heroVal, { color: Colors.gold }]}>{disciplinas.length}</Text>
            <Text style={styles.heroLbl}>Total</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroVal, { color: Colors.success }]}>{disciplinas.filter(d => d.ativo).length}</Text>
            <Text style={styles.heroLbl}>Activas</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroVal, { color: Colors.info }]}>{byArea.length}</Text>
            <Text style={styles.heroLbl}>Áreas</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroVal, { color: Colors.textMuted }]}>{disciplinas.filter(d => !d.ativo).length}</Text>
            <Text style={styles.heroLbl}>Inactivas</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.filterRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Pesquisar disciplina..."
            placeholderTextColor={Colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.areaFilterBtn, filterArea !== 'Todas' && styles.areaFilterBtnActive]}
          onPress={() => setShowAreaFilter(true)}
        >
          <Ionicons name="filter" size={15} color={filterArea !== 'Todas' ? Colors.gold : Colors.textMuted} />
          <Text style={[styles.areaFilterText, filterArea !== 'Todas' && { color: Colors.gold }]} numberOfLines={1}>
            {filterArea === 'Todas' ? 'Área' : filterArea.split(' ')[0]}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.gold} size="large" />
          <Text style={styles.loadingText}>A carregar disciplinas...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="book-open-page-variant-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {search || filterArea !== 'Todas' ? 'Nenhuma disciplina encontrada' : 'Sem disciplinas no catálogo'}
              </Text>
              <Text style={styles.emptyDesc}>
                {canEdit && !search && filterArea === 'Todas'
                  ? 'Clique em "+" para adicionar a primeira disciplina ao catálogo da escola.'
                  : 'Tente ajustar os filtros de pesquisa.'}
              </Text>
            </View>
          }
        />
      )}

      <DisciplinaFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        onSave={handleSave}
        disciplina={editItem}
      />

      <Modal visible={showAreaFilter} transparent animationType="fade" onRequestClose={() => setShowAreaFilter(false)}>
        <TouchableOpacity style={mStyles.pickerOverlay} onPress={() => setShowAreaFilter(false)} activeOpacity={1}>
          <View style={mStyles.pickerList}>
            <Text style={mStyles.pickerTitle}>Filtrar por Área</Text>
            {areas.map(a => (
              <TouchableOpacity
                key={a}
                style={[mStyles.pickerItem, filterArea === a && mStyles.pickerItemActive]}
                onPress={() => { setFilterArea(a); setShowAreaFilter(false); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {a !== 'Todas' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: areaColor(a) }} />}
                  <Text style={[mStyles.pickerItemText, filterArea === a && mStyles.pickerItemTextActive]}>{a}</Text>
                </View>
                {filterArea === a && <Ionicons name="checkmark" size={16} color={Colors.gold} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const mStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: Colors.border,
    padding: 20, maxHeight: '90%', width: '100%', maxWidth: 480,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  field: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text,
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  toggleBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnActive: { backgroundColor: Colors.success + '20', borderColor: Colors.success + '50' },
  toggleText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted },
  toggleTextActive: { color: Colors.success },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent, borderRadius: 14,
    paddingVertical: 16, gap: 8, marginTop: 8,
  },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pickerList: {
    backgroundColor: Colors.backgroundCard, borderRadius: 18,
    padding: 16, width: '100%', maxWidth: 380,
    borderWidth: 1, borderColor: Colors.border,
  },
  pickerTitle: {
    fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text,
    marginBottom: 12, textAlign: 'center',
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10,
  },
  pickerItemActive: { backgroundColor: Colors.gold + '15' },
  pickerItemText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  pickerItemTextActive: { fontFamily: 'Inter_600SemiBold', color: Colors.gold },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  hero: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 18,
    padding: 18,
  },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.10)' },
  heroVal: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  heroLbl: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginTop: 12, marginBottom: 4,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 42, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  areaFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 42,
  },
  areaFilterBtnActive: { borderColor: Colors.gold + '60', backgroundColor: Colors.gold + '10' },
  areaFilterText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  list: { padding: 16, paddingTop: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.backgroundCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  cardInactive: { opacity: 0.6 },
  cardLeft: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  codeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  codeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  inactiveBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: Colors.textMuted + '20' },
  inactiveText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  areaDot: { width: 6, height: 6, borderRadius: 3 },
  areaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  descricao: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'column', gap: 6 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
