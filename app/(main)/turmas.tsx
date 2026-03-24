import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, Alert, Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useData, Turma } from '@/context/DataContext';
import TopBar from '@/components/TopBar';
import { alertSucesso, alertErro } from '@/utils/toast';

const NIVEIS = ['Primário', 'I Ciclo', 'II Ciclo'] as const;
const TURNOS = ['Manhã', 'Tarde', 'Noite'] as const;
const CLASSES = ['1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe', '7ª Classe', '8ª Classe', '9ª Classe', '10ª Classe', '11ª Classe', '12ª Classe', '13ª Classe'];

function TurmaFormModal({ visible, onClose, onSave, turma, professores }: any) {
  const [form, setForm] = useState<Partial<Turma>>(turma || {
    nome: '', classe: '7ª Classe', turno: 'Manhã', anoLetivo: '2025',
    nivel: 'I Ciclo', professorId: professores[0]?.id || '', sala: '', capacidade: 35, ativo: true,
  });
  const set = (k: keyof Turma, v: any) => setForm(f => ({ ...f, [k]: v }));
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  function handleSave() {
    if (!form.nome || !form.sala) {
      Alert.alert('Campos obrigatórios', 'Preencha nome e sala.');
      return;
    }
    onSave(form);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={[mS.container, { paddingBottom: bottomPad + 16 }]}>
          <View style={mS.header}>
            <Text style={mS.title}>{turma ? 'Editar Turma' : 'Nova Turma'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: 'Nome da Turma (ex: 7ª A)', key: 'nome' },
              { label: 'Sala', key: 'sala' },
              { label: 'Ano Lectivo', key: 'anoLetivo' },
            ].map(f => (
              <View key={f.key} style={mS.field}>
                <Text style={mS.fieldLabel}>{f.label}</Text>
                <TextInput style={mS.input} value={(form as any)[f.key] ?? ''} onChangeText={v => set(f.key as keyof Turma, v)} placeholder={f.label} placeholderTextColor={Colors.textMuted} />
              </View>
            ))}
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Capacidade</Text>
              <TextInput style={mS.input} value={String(form.capacidade ?? 35)} onChangeText={v => set('capacidade', parseInt(v) || 35)} keyboardType="number-pad" placeholder="35" placeholderTextColor={Colors.textMuted} />
            </View>
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Nível</Text>
              <View style={mS.toggleRow}>
                {NIVEIS.map(n => (
                  <TouchableOpacity key={n} style={[mS.toggleBtn, form.nivel === n && mS.toggleActive]} onPress={() => set('nivel', n)}>
                    <Text style={[mS.toggleText, form.nivel === n && mS.toggleTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Turno</Text>
              <View style={mS.toggleRow}>
                {TURNOS.map(t => (
                  <TouchableOpacity key={t} style={[mS.toggleBtn, form.turno === t && mS.toggleActive]} onPress={() => set('turno', t)}>
                    <Text style={[mS.toggleText, form.turno === t && mS.toggleTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Classe</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={mS.toggleRow}>
                  {CLASSES.map(c => (
                    <TouchableOpacity key={c} style={[mS.toggleBtn, form.classe === c && mS.toggleActive]} onPress={() => set('classe', c)}>
                      <Text style={[mS.toggleText, form.classe === c && mS.toggleTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Director de Turma</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={mS.toggleRow}>
                  {professores.map((p: any) => (
                    <TouchableOpacity key={p.id} style={[mS.toggleBtn, form.professorId === p.id && mS.toggleActive]} onPress={() => set('professorId', p.id)}>
                      <Text style={[mS.toggleText, form.professorId === p.id && mS.toggleTextActive]}>{p.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </ScrollView>
          <TouchableOpacity style={mS.saveBtn} onPress={handleSave}>
            <Ionicons name="checkmark" size={18} color={Colors.text} />
            <Text style={mS.saveBtnText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function TurmasScreen() {
  const { turmas, professores, alunos, addTurma, updateTurma, deleteTurma } = useData();
  const insets = useSafeAreaInsets();
  const [filterNivel, setFilterNivel] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTurma, setEditTurma] = useState<Turma | null>(null);
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const filtered = useMemo(() => {
    return turmas.filter(t => !filterNivel || t.nivel === filterNivel);
  }, [turmas, filterNivel]);

  async function handleSave(form: Partial<Turma>) {
    if (editTurma) {
      await updateTurma(editTurma.id, form);
    } else {
      await addTurma({ ...form } as any);
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    alertSucesso(
      editTurma ? 'Turma actualizada' : 'Turma criada',
      editTurma
        ? `A turma "${form.nome}" foi actualizada com sucesso.`
        : `A turma "${form.nome}" foi criada com sucesso.`
    );
    setShowForm(false);
    setEditTurma(null);
  }

  function confirmDelete(t: Turma) {
    Alert.alert('Remover Turma', `Remover turma ${t.nome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          try {
            await deleteTurma(t.id);
            alertSucesso('Turma removida', `A turma "${t.nome}" foi removida.`);
          } catch {
            alertErro('Erro', 'Não foi possível remover a turma.');
          }
        }
      },
    ]);
  }

  const nivelColors: Record<string, string> = { 'Primário': Colors.success, 'I Ciclo': Colors.gold, 'II Ciclo': Colors.accent };
  const turnoColors: Record<string, string> = { 'Manhã': Colors.info, 'Tarde': Colors.warning, 'Noite': Colors.textSecondary };

  const renderTurma = ({ item }: { item: Turma }) => {
    const director = professores.find(p => p.id === item.professorId);
    const numAlunos = alunos.filter(a => a.turmaId === item.id).length;
    const nColor = nivelColors[item.nivel] || Colors.textMuted;
    const tColor = turnoColors[item.turno] || Colors.textMuted;
    return (
      <View style={styles.card}>
        <View style={[styles.cardTop, { borderBottomColor: nColor }]}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.turmaNome}>{item.nome}</Text>
            <Text style={styles.turmaClasse}>{item.classe}</Text>
          </View>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: `${nColor}18` }]}>
              <Text style={[styles.badgeText, { color: nColor }]}>{item.nivel}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${tColor}18` }]}>
              <Text style={[styles.badgeText, { color: tColor }]}>{item.turno}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.infoText}>{numAlunos}/{item.capacidade} alunos · Sala {item.sala}</Text>
          </View>
          {director && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.infoText}>Dir: {director.nome} {director.apelido}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditTurma(item); setShowForm(true); }}>
            <Ionicons name="create-outline" size={16} color={Colors.info} />
            <Text style={styles.actionBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: `${Colors.danger}30` }]} onPress={() => confirmDelete(item)}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Remover</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <TopBar title="Turmas" subtitle={`${filtered.length} turmas`} rightAction={{ icon: 'add-circle', onPress: () => { setEditTurma(null); setShowForm(true); } }} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {['', ...NIVEIS].map(n => (
          <TouchableOpacity key={n} style={[styles.filterChip, filterNivel === n && styles.filterChipActive]} onPress={() => setFilterNivel(n)}>
            <Text style={[styles.filterChipText, filterNivel === n && styles.filterChipTextActive]}>{n || 'Todos'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderTurma}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<View style={styles.empty}><MaterialIcons name="class" size={40} color={Colors.textMuted} /><Text style={styles.emptyText}>Nenhuma turma</Text></View>}
      />

      {showForm && (
        <TurmaFormModal visible={showForm} onClose={() => { setShowForm(false); setEditTurma(null); }} onSave={handleSave} turma={editTurma} professores={professores} />
      )}
    </View>
  );
}

const mS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', alignItems: 'center' },
  container: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '90%', width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  toggleActive: { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  toggleText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  toggleTextActive: { color: Colors.goldLight, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, gap: 8, marginTop: 12 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  filterScroll: { maxHeight: 50 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  filterChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.goldLight, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16 },
  card: { backgroundColor: Colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1 },
  cardTopLeft: { gap: 2 },
  turmaNome: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  turmaClasse: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  cardBody: { padding: 14, gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  cardFooter: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, padding: 10, gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: `${Colors.info}30` },
  actionBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.info },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
});
