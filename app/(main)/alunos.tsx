import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, Alert, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useData, Aluno } from '@/context/DataContext';
import TopBar from '@/components/TopBar';
import QRCodeModal from '@/components/QRCodeModal';

const PROVINCIAS = ['Luanda', 'Benguela', 'Huambo', 'Bié', 'Uíge', 'Malanje', 'Moxico', 'Cuando Cubango', 'Cunene', 'Namibe', 'Huíla', 'Kuanza Norte', 'Kuanza Sul', 'Lunda Norte', 'Lunda Sul', 'Zaire', 'Cabinda', 'Bengo'];

function getClasseFromTurma(turmaId: string, turmas: any[]) {
  return turmas.find(t => t.id === turmaId)?.nome ?? '—';
}

function calcIdade(dataNascimento: string) {
  const diff = Date.now() - new Date(dataNascimento).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
}

function AlunoFormModal({ visible, onClose, onSave, aluno, turmas }: any) {
  const [form, setForm] = useState<Partial<Aluno>>(aluno || {
    nome: '', apelido: '', dataNascimento: '2008-01-01', genero: 'M',
    provincia: 'Luanda', municipio: '', turmaId: turmas[0]?.id || '',
    nomeEncarregado: '', telefoneEncarregado: '', ativo: true,
  });

  const set = (k: keyof Aluno, v: any) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    if (!form.nome || !form.apelido || !form.turmaId) {
      Alert.alert('Campos obrigatórios', 'Preencha nome, apelido e turma.');
      return;
    }
    onSave(form);
  }

  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { paddingBottom: bottomPad + 16 }]}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{aluno ? 'Editar Aluno' : 'Novo Aluno'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: 'Nome', key: 'nome', placeholder: 'Nome' },
              { label: 'Apelido', key: 'apelido', placeholder: 'Apelido' },
              { label: 'Data de Nascimento (AAAA-MM-DD)', key: 'dataNascimento', placeholder: '2008-01-01' },
              { label: 'Município', key: 'municipio', placeholder: 'Município' },
              { label: 'Nome do Encarregado', key: 'nomeEncarregado', placeholder: 'Nome completo' },
              { label: 'Telefone do Encarregado', key: 'telefoneEncarregado', placeholder: '9XX XXX XXX' },
            ].map(f => (
              <View key={f.key} style={modalStyles.field}>
                <Text style={modalStyles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={modalStyles.input}
                  value={(form as any)[f.key] ?? ''}
                  onChangeText={v => set(f.key as keyof Aluno, v)}
                  placeholder={f.placeholder}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ))}

            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>Género</Text>
              <View style={modalStyles.toggleRow}>
                {(['M', 'F'] as const).map(g => (
                  <TouchableOpacity key={g} style={[modalStyles.toggleBtn, form.genero === g && modalStyles.toggleActive]} onPress={() => set('genero', g)}>
                    <Text style={[modalStyles.toggleText, form.genero === g && modalStyles.toggleTextActive]}>{g === 'M' ? 'Masculino' : 'Feminino'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>Turma</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={modalStyles.toggleRow}>
                  {turmas.map((t: any) => (
                    <TouchableOpacity key={t.id} style={[modalStyles.toggleBtn, form.turmaId === t.id && modalStyles.toggleActive]} onPress={() => set('turmaId', t.id)}>
                      <Text style={[modalStyles.toggleText, form.turmaId === t.id && modalStyles.toggleTextActive]}>{t.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </ScrollView>

          <TouchableOpacity style={modalStyles.saveBtn} onPress={handleSave}>
            <Ionicons name="checkmark" size={18} color={Colors.text} />
            <Text style={modalStyles.saveBtnText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function AlunosScreen() {
  const router = useRouter();
  const { alunos, turmas, addAluno, updateAluno, deleteAluno } = useData();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filterTurma, setFilterTurma] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editAluno, setEditAluno] = useState<Aluno | null>(null);
  const [qrData, setQrData] = useState<{ data: string; title: string; subtitle: string } | null>(null);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const filtered = useMemo(() => {
    return alunos.filter(a => {
      const nome = `${a.nome} ${a.apelido}`.toLowerCase();
      const searchMatch = nome.includes(search.toLowerCase()) || a.numeroMatricula.toLowerCase().includes(search.toLowerCase());
      const turmaMatch = !filterTurma || a.turmaId === filterTurma;
      return searchMatch && turmaMatch;
    });
  }, [alunos, search, filterTurma]);

  async function handleSave(form: Partial<Aluno>) {
    if (editAluno) {
      await updateAluno(editAluno.id, form);
    } else {
      const totalAlunos = alunos.length;
      await addAluno({
        ...form,
        numeroMatricula: `AL-2025-${String(totalAlunos + 1).padStart(3, '0')}`,
        ativo: true,
      } as any);
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false);
    setEditAluno(null);
  }

  function confirmDelete(aluno: Aluno) {
    Alert.alert('Remover Aluno', `Remover ${aluno.nome} ${aluno.apelido}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => deleteAluno(aluno.id) },
    ]);
  }

  const renderAluno = ({ item }: { item: Aluno }) => {
    const turmaName = getClasseFromTurma(item.turmaId, turmas);
    const idade = calcIdade(item.dataNascimento);
    return (
      <View style={styles.alunoCard}>
        <View style={[styles.avatar, { backgroundColor: item.genero === 'F' ? `${Colors.accent}30` : `${Colors.info}30` }]}>
          <Text style={[styles.avatarText, { color: item.genero === 'F' ? Colors.accent : Colors.info }]}>
            {item.nome.charAt(0)}{item.apelido.charAt(0)}
          </Text>
        </View>
        <View style={styles.alunoInfo}>
          <Text style={styles.alunoNome}>{item.nome} {item.apelido}</Text>
          <Text style={styles.alunoMeta}>{item.numeroMatricula} · {turmaName} · {idade} anos</Text>
          <Text style={styles.alunoProvinvia}>{item.provincia} · {item.genero === 'M' ? 'Masculino' : 'Feminino'}</Text>
        </View>
        <View style={styles.alunoActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(main)/boletim-matricula' as any)}>
            <Ionicons name="newspaper-outline" size={18} color={Colors.warning} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setQrData({ data: `SGAA|ALUNO|${item.id}|${item.numeroMatricula}|${item.nome} ${item.apelido}`, title: item.nome + ' ' + item.apelido, subtitle: item.numeroMatricula })}>
            <Ionicons name="qr-code-outline" size={18} color={Colors.gold} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditAluno(item); setShowForm(true); }}>
            <Ionicons name="create-outline" size={18} color={Colors.info} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(item)}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <TopBar title="Alunos" subtitle={`${filtered.length} alunos`} rightAction={{ icon: 'person-add', onPress: () => { setEditAluno(null); setShowForm(true); } }} />

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Pesquisar por nome ou matrícula..."
          placeholderTextColor={Colors.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        <TouchableOpacity style={[styles.filterChip, !filterTurma && styles.filterChipActive]} onPress={() => setFilterTurma('')}>
          <Text style={[styles.filterChipText, !filterTurma && styles.filterChipTextActive]}>Todas</Text>
        </TouchableOpacity>
        {turmas.map(t => (
          <TouchableOpacity key={t.id} style={[styles.filterChip, filterTurma === t.id && styles.filterChipActive]} onPress={() => setFilterTurma(t.id)}>
            <Text style={[styles.filterChipText, filterTurma === t.id && styles.filterChipTextActive]}>{t.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderAluno}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum aluno encontrado</Text>
          </View>
        }
      />

      {showForm && (
        <AlunoFormModal
          visible={showForm}
          onClose={() => { setShowForm(false); setEditAluno(null); }}
          onSave={handleSave}
          aluno={editAluno}
          turmas={turmas}
        />
      )}

      {qrData && (
        <QRCodeModal
          visible={!!qrData}
          onClose={() => setQrData(null)}
          data={qrData.data}
          title={qrData.title}
          subtitle={qrData.subtitle}
        />
      )}
    </View>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  container: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '85%' },
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
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, marginHorizontal: 16, marginVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, gap: 8, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  filterScroll: { maxHeight: 44 },
  filterContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  filterChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.goldLight, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16 },
  separator: { height: 8 },
  alunoCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  alunoInfo: { flex: 1, gap: 2 },
  alunoNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  alunoMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  alunoProvinvia: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  alunoActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
});
