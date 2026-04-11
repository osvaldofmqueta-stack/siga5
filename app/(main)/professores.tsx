import React, { useState, useMemo, useEffect } from 'react';
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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useData, Professor } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import TopBar from '@/components/TopBar';
import { alertSucesso, alertErro } from '@/utils/toast';
import QRCodeModal from '@/components/QRCodeModal';
import ExportMenu from '@/components/ExportMenu';
import { webAlert } from '@/utils/webAlert';
import { useEnterToSave } from '@/hooks/useEnterToSave';
import { usePermissoes } from '@/context/PermissoesContext';

interface DisciplinaCatalog { id: string; nome: string; codigo: string; area: string; }

const NIVEIS_ENSINO = ['Primário', 'I Ciclo', 'II Ciclo'];

const TIPO_CONTRATO = [
  { id: 'efectivo',           label: 'Efectivo',             color: '#4CAF50' },
  { id: 'colaborador',        label: 'Colaborador',          color: '#2196F3' },
  { id: 'contratado',         label: 'Contratado',           color: '#FF9800' },
  { id: 'prestacao_servicos', label: 'Prestação de Serviços', color: '#9C27B0' },
];

function ProfessorFormModal({ visible, onClose, onSave, professor, canAlterarTipoContrato }: any) {
  const { config } = useConfig();
  const maxDisc = config.maxDisciplinasPorProfessor ?? 5;

  const getDefault = () => professor ? {
    ...professor,
    nivelEnsino: professor.nivelEnsino || 'I Ciclo',
  } : {
    nome: '', apelido: '', disciplinas: [], turmasIds: [],
    telefone: '', email: '', habilitacoes: 'Licenciatura', ativo: true,
    nivelEnsino: 'I Ciclo',
  };

  const [form, setForm] = useState<Partial<Professor>>(getDefault);
  const [catalogDisc, setCatalogDisc] = useState<DisciplinaCatalog[]>([]);

  useEnterToSave(handleSave, visible);

  useEffect(() => {
    if (visible) {
      setForm(getDefault());
      fetch('/api/disciplinas').then(r => r.json()).then((list: DisciplinaCatalog[]) => {
        setCatalogDisc(list.filter((d: any) => d.ativo !== false));
      }).catch(() => {});
    }
  }, [visible, professor?.id]);

  const set = (k: keyof Professor, v: any) => setForm(f => ({ ...f, [k]: v }));

  function toggleDisciplina(nome: string) {
    const cur: string[] = form.disciplinas || [];
    if (cur.includes(nome)) {
      set('disciplinas', cur.filter(x => x !== nome));
    } else {
      if (cur.length >= maxDisc) {
        webAlert('Limite atingido', `Este professor já tem ${maxDisc} disciplina(s) atribuída(s), que é o máximo definido nas configurações.`);
        return;
      }
      set('disciplinas', [...cur, nome]);
    }
  }

  function handleSave() {
    if (!form.nome || !form.apelido) {
      webAlert('Campos obrigatórios', 'Preencha nome e apelido.');
      return;
    }
    onSave(form);
  }

  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={[mStyles.container, { paddingBottom: bottomPad + 16 }]}>
          <View style={mStyles.header}>
            <Text style={mStyles.title}>{professor ? 'Editar Professor' : 'Novo Professor'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: 'Nome', key: 'nome', placeholder: 'Nome' },
              { label: 'Apelido', key: 'apelido', placeholder: 'Apelido' },
              { label: 'Telefone', key: 'telefone', placeholder: '9XX XXX XXX' },
              { label: 'Email', key: 'email', placeholder: 'professor@escola.ao' },
              { label: 'Habilitações', key: 'habilitacoes', placeholder: 'Ex: Licenciatura em...' },
            ].map(f => (
              <View key={f.key} style={mStyles.field}>
                <Text style={mStyles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={mStyles.input}
                  value={(form as any)[f.key] ?? ''}
                  onChangeText={v => set(f.key as keyof Professor, v)}
                  placeholder={f.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
            ))}

            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Nível de Ensino</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {NIVEIS_ENSINO.map(n => {
                  const isActive = (form.nivelEnsino || 'I Ciclo') === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[mStyles.tag, isActive && { backgroundColor: `${Colors.gold}22`, borderWidth: 1, borderColor: Colors.gold + '80' }]}
                      onPress={() => set('nivelEnsino', n)}
                    >
                      {isActive && <Ionicons name="checkmark-circle" size={13} color={Colors.gold} />}
                      <Text style={[mStyles.tagText, isActive && { color: Colors.goldLight, fontFamily: 'Inter_600SemiBold' }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 6, lineHeight: 14 }}>
                Define em que nível este professor pode ser Director de Turma.
              </Text>
            </View>

            {canAlterarTipoContrato && (
              <View style={mStyles.field}>
                <Text style={mStyles.fieldLabel}>Tipo de Vínculo Contratual</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {TIPO_CONTRATO.map(t => {
                    const isActive = ((form as any).tipoContrato || 'efectivo') === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[mStyles.tag, isActive && { backgroundColor: `${t.color}22`, borderWidth: 1, borderColor: t.color + '80' }]}
                        onPress={() => set('tipoContrato' as keyof Professor, t.id)}
                      >
                        {isActive && <Ionicons name="checkmark-circle" size={13} color={t.color} />}
                        <Text style={[mStyles.tagText, isActive && { color: t.color, fontFamily: 'Inter_600SemiBold' }]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 6, lineHeight: 14 }}>
                  Altera a natureza do vínculo. Afecta o cálculo salarial do professor.
                </Text>
              </View>
            )}

            <View style={mStyles.field}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={mStyles.fieldLabel}>Disciplinas que lecciona</Text>
                <View style={{
                  backgroundColor: (form.disciplinas || []).length >= maxDisc ? Colors.danger + '22' : Colors.success + '22',
                  borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: (form.disciplinas || []).length >= maxDisc ? Colors.danger : Colors.success }}>
                    {(form.disciplinas || []).length}/{maxDisc}
                  </Text>
                </View>
              </View>
              {catalogDisc.length === 0 ? (
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 4 }}>
                  Nenhuma disciplina no catálogo. Adicione disciplinas em Administração primeiro.
                </Text>
              ) : (
                <View style={mStyles.tagRow}>
                  {catalogDisc.map((d: DisciplinaCatalog) => {
                    const selected = (form.disciplinas || []).includes(d.nome);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[mStyles.tag, selected && { backgroundColor: `${Colors.success}22`, borderWidth: 1, borderColor: Colors.success + '66' }]}
                        onPress={() => toggleDisciplina(d.nome)}
                      >
                        {selected && <Ionicons name="checkmark-circle" size={13} color={Colors.success} />}
                        <Text style={[mStyles.tagText, selected && { color: Colors.success }]}>{d.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity style={mStyles.saveBtn} onPress={handleSave}>
            <Ionicons name="checkmark" size={18} color={Colors.text} />
            <Text style={mStyles.saveBtnText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfessoresScreen() {
  const { professores, turmas, updateProfessor, deleteProfessor } = useData();
  const { user } = useAuth();
  const { config } = useConfig();
  const { can } = usePermissoes();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProf, setEditProf] = useState<Professor | null>(null);
  const [qrData, setQrData] = useState<{ data: string; title: string; subtitle: string } | null>(null);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const canManage = ['admin', 'ceo', 'pca', 'director', 'chefe_secretaria'].includes(user?.role ?? '');
  const canAlterarTipoContrato = can('alterar_tipo_contrato');

  const filtered = useMemo(() => {
    return professores.filter(p => {
      const nome = `${p.nome} ${p.apelido}`.toLowerCase();
      return nome.includes(search.toLowerCase()) || p.numeroProfessor.toLowerCase().includes(search.toLowerCase());
    });
  }, [professores, search]);

  if (user?.role === 'professor') {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <TopBar title="Professores" />
        <Ionicons name="lock-closed" size={56} color={Colors.textMuted} style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 8 }}>
          Acesso Restrito
        </Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
          Apenas administradores e direção têm acesso à gestão de professores.
        </Text>
      </View>
    );
  }

  async function handleSave(form: Partial<Professor>) {
    if (!editProf) return;
    await updateProfessor(editProf.id, form);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    alertSucesso('Professor actualizado', `Os dados de ${form.nome} ${form.apelido} foram actualizados.`);
    setShowForm(false);
    setEditProf(null);
  }

  function confirmDelete(prof: Professor) {
    webAlert('Remover Professor', `Remover ${prof.nome} ${prof.apelido}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          try {
            await deleteProfessor(prof.id);
            alertSucesso('Professor removido', `${prof.nome} ${prof.apelido} foi removido.`);
          } catch {
            alertErro('Erro', 'Não foi possível remover o professor.');
          }
        }
      },
    ]);
  }

  const renderProf = ({ item }: { item: Professor }) => {
    const numTurmas = turmas.filter(t => item.turmasIds.includes(t.id)).length;
    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <FontAwesome5 name="chalkboard-teacher" size={20} color={Colors.gold} />
        </View>
        <View style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.nome}>{item.nome} {item.apelido}</Text>
            {(item as any).tipoContrato && (item as any).tipoContrato !== 'efectivo' && (() => {
              const tc = TIPO_CONTRATO.find(t => t.id === (item as any).tipoContrato);
              if (!tc) return null;
              return (
                <View style={{ backgroundColor: `${tc.color}22`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: `${tc.color}50` }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: tc.color }}>{tc.label}</Text>
                </View>
              );
            })()}
          </View>
          <Text style={styles.meta}>{item.numeroProfessor} · {numTurmas} turma{numTurmas !== 1 ? 's' : ''}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.disciplinasRow}>
              {item.disciplinas.map(d => (
                <View key={d} style={styles.disciplinaTag}>
                  <Text style={styles.disciplinaTagText}>{d}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setQrData({ data: `SIGA|PROF|${item.id}|${item.numeroProfessor}|${item.nome} ${item.apelido}`, title: item.nome + ' ' + item.apelido, subtitle: item.numeroProfessor })}>
            <Ionicons name="qr-code-outline" size={18} color={Colors.gold} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditProf(item); setShowForm(true); }}>
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
      <TopBar title="Professores" subtitle={`${professores.length} professores`} />

      {canManage && (
        <TouchableOpacity
          style={styles.infoBanner}
          onPress={() => router.push({ pathname: '/(main)/admin', params: { section: 'usuarios', group: 'pessoal' } } as any)}
          activeOpacity={0.82}
        >
          <View style={styles.infoBannerIcon}>
            <Ionicons name="information-circle" size={20} color={Colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Como registar um novo professor?</Text>
            <Text style={styles.infoBannerDesc}>
              Aceda a Administração → Utilizadores, crie o utilizador e seleccione o perfil <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.info }}>Professor</Text>. O perfil académico é criado automaticamente.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.info} />
        </TouchableOpacity>
      )}

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Pesquisar..." placeholderTextColor={Colors.textMuted} />
        {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={Colors.textMuted} /></TouchableOpacity>}
        <ExportMenu
          title="Lista de Professores"
          columns={[
            { header: 'Nº Professor', key: 'numeroProfessor', width: 16 },
            { header: 'Nome Completo', key: 'nomeCompleto', width: 26 },
            { header: 'Disciplinas', key: 'disciplinas', width: 30 },
            { header: 'Habilitações', key: 'habilitacoes', width: 20 },
            { header: 'Turmas', key: 'numTurmas', width: 10 },
            { header: 'Telefone', key: 'telefone', width: 16 },
            { header: 'Estado', key: 'estado', width: 10 },
          ]}
          rows={filtered.map(p => ({
            numeroProfessor: p.numeroProfessor,
            nomeCompleto: `${p.nome} ${p.apelido}`,
            disciplinas: p.disciplinas.join(', '),
            habilitacoes: p.habilitacoes,
            numTurmas: turmas.filter(t => p.turmasIds.includes(t.id)).length,
            telefone: p.telefone ?? '',
            estado: p.ativo ? 'Activo' : 'Inactivo',
          }))}
          school={{ nomeEscola: config?.nomeEscola ?? 'Escola' }}
          filename="lista_professores"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderProf}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<View style={styles.empty}><FontAwesome5 name="chalkboard-teacher" size={36} color={Colors.textMuted} /><Text style={styles.emptyText}>Nenhum professor registado</Text></View>}
      />

      {showForm && (
        <ProfessorFormModal visible={showForm} onClose={() => { setShowForm(false); setEditProf(null); }} onSave={handleSave} professor={editProf} canAlterarTipoContrato={canAlterarTipoContrato} />
      )}

      {qrData && (
        <QRCodeModal visible={!!qrData} onClose={() => setQrData(null)} data={qrData.data} title={qrData.title} subtitle={qrData.subtitle} />
      )}
    </View>
  );
}

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '85%', width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  tagInputRow: { flexDirection: 'row', gap: 8 },
  addBtn: { backgroundColor: Colors.accent, borderRadius: 10, width: 46, alignItems: 'center', justifyContent: 'center' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${Colors.info}20`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.info },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, gap: 8, marginTop: 12 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.info + '12', borderWidth: 1, borderColor: Colors.info + '30',
    marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14,
  },
  infoBannerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.info + '20', alignItems: 'center', justifyContent: 'center',
  },
  infoBannerTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.info, marginBottom: 3 },
  infoBannerDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 17 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, marginHorizontal: 16, marginVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, gap: 8, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  list: { padding: 16 },
  card: { backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 14, backgroundColor: `${Colors.gold}15`, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 3 },
  nome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  disciplinasRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  disciplinaTag: { backgroundColor: `${Colors.info}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  disciplinaTagText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.info },
  actions: { flexDirection: 'column', gap: 6 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
});
