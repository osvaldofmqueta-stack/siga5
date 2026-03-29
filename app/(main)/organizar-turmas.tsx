import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useData } from '@/context/DataContext';
import { alertSucesso, alertErro } from '@/utils/toast';

interface AlunoSemTurma {
  id: string;
  nome: string;
  apelido: string;
  numeroMatricula: string;
  classe?: string;
  nivel?: string;
  cursoId?: string;
  cursoNome?: string;
  turmaIdAtribuida?: string; // turma seleccionada localmente antes de guardar
}

interface Turma {
  id: string;
  nome: string;
  classe: string;
  turno: string;
  anoLetivo: string;
  curso?: string;
}

export default function OrganizarTurmasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { turmas } = useData();

  const [alunos, setAlunos] = useState<AlunoSemTurma[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Classe seleccionada para filtrar
  const [classeActiva, setClasseActiva] = useState<string>('');

  // Modal de selecção de turma para um grupo inteiro
  const [modalGrupo, setModalGrupo] = useState<{
    visible: boolean;
    classe: string;
    cursoNome?: string;
    alunoIds: string[];
  }>({ visible: false, classe: '', alunoIds: [] });

  // Modal de selecção de turma para um aluno individual
  const [modalAluno, setModalAluno] = useState<{
    visible: boolean;
    alunoId: string;
    nome: string;
    classe: string;
  }>({ visible: false, alunoId: '', nome: '', classe: '' });

  useEffect(() => {
    carregarAlunos();
  }, []);

  async function carregarAlunos() {
    setLoading(true);
    try {
      const res = await fetch('/api/alunos/sem-turma', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const data = await res.json();
      setAlunos(Array.isArray(data) ? data : []);
    } catch {
      alertErro('Erro ao carregar alunos sem turma.');
    } finally {
      setLoading(false);
    }
  }

  // Agrupar por classe
  const classes = useMemo(() => {
    const set = new Set(alunos.map(a => a.classe || 'Sem classe'));
    return Array.from(set).sort((a, b) => {
      const n = (s: string) => parseInt(s) || 999;
      return n(a) - n(b);
    });
  }, [alunos]);

  // Seleccionar classe activa por defeito
  useEffect(() => {
    if (classes.length > 0 && !classeActiva) setClasseActiva(classes[0]);
  }, [classes]);

  // Alunos da classe activa, agrupados por curso (especialmente para 10ª)
  const gruposDaClasse = useMemo(() => {
    const da = alunos.filter(a => (a.classe || 'Sem classe') === classeActiva);
    const is10 = classeActiva.startsWith('10');
    if (is10) {
      const map: Record<string, AlunoSemTurma[]> = {};
      for (const a of da) {
        const key = a.cursoNome || 'Sem Curso';
        if (!map[key]) map[key] = [];
        map[key].push(a);
      }
      return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'pt'));
    }
    return [['Todos', da]] as [string, AlunoSemTurma[]][];
  }, [alunos, classeActiva]);

  // Turmas compatíveis com a classe activa
  function turmasParaClasse(classe: string): Turma[] {
    return (turmas as Turma[]).filter(t =>
      t.classe && t.classe.toString().replace(/[ªa°]/g, '') === classe.replace(/[ªa°]/g, '').trim().split(' ')[0]
    );
  }

  function atribuirTurmaAoGrupo(turmaId: string, alunoIds: string[]) {
    setAlunos(prev => prev.map(a =>
      alunoIds.includes(a.id) ? { ...a, turmaIdAtribuida: turmaId } : a
    ));
    setModalGrupo(m => ({ ...m, visible: false }));
    setModalAluno(m => ({ ...m, visible: false }));
  }

  async function guardarAtribuicoes() {
    const comTurma = alunos.filter(a => a.turmaIdAtribuida);
    if (comTurma.length === 0) {
      Alert.alert('Sem atribuições', 'Seleccione pelo menos uma turma para algum aluno.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/alunos/atribuir-turmas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          atribuicoes: comTurma.map(a => ({ alunoId: a.id, turmaId: a.turmaIdAtribuida! })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      alertSucesso(`${data.actualizados} aluno(s) atribuído(s) às turmas com sucesso!`);
      carregarAlunos();
    } catch (e: any) {
      alertErro(e.message || 'Erro ao guardar atribuições.');
    } finally {
      setSaving(false);
    }
  }

  const totalComAtribuicao = alunos.filter(a => a.turmaIdAtribuida).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TopBar title="Organizar Alunos em Turmas" onBack={() => router.back()} />

      {/* Resumo */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{alunos.length}</Text>
          <Text style={styles.summaryLabel}>Sem Turma</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.success }]}>{totalComAtribuicao}</Text>
          <Text style={styles.summaryLabel}>Atribuídos</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNum, { color: Colors.warning }]}>{alunos.length - totalComAtribuicao}</Text>
          <Text style={styles.summaryLabel}>Pendentes</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={guardarAtribuicoes}
          disabled={saving || totalComAtribuicao === 0}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Ionicons name="checkmark-circle" size={16} color="#fff" /><Text style={styles.saveBtnText}>Guardar</Text></>
          }
        </TouchableOpacity>
      </View>

      {/* Tabs por classe */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {classes.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.tab, classeActiva === c && styles.tabActive]}
            onPress={() => setClasseActiva(c)}
          >
            <Text style={[styles.tabText, classeActiva === c && styles.tabTextActive]}>{c}</Text>
            <View style={[styles.tabBadge, classeActiva === c && styles.tabBadgeActive]}>
              <Text style={styles.tabBadgeText}>
                {alunos.filter(a => (a.classe || 'Sem classe') === c).length}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : alunos.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="check-circle" size={56} color={Colors.success} />
          <Text style={styles.emptyTitle}>Todos os alunos têm turma!</Text>
          <Text style={styles.emptyDesc}>Não há alunos sem turma atribuída neste momento.</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }}>
          {gruposDaClasse.map(([grupo, alunosGrupo]) => {
            const turmasDisp = turmasParaClasse(classeActiva);
            const todosAtribuidos = alunosGrupo.every(a => a.turmaIdAtribuida);
            const algumAtribuido = alunosGrupo.some(a => a.turmaIdAtribuida);
            const turmaDom = alunosGrupo[0]?.turmaIdAtribuida
              ? turmas.find((t: any) => t.id === alunosGrupo[0]?.turmaIdAtribuida)?.nome
              : null;
            const is10 = classeActiva.startsWith('10');

            return (
              <View key={grupo} style={styles.grupo}>
                {/* Cabeçalho do grupo */}
                <View style={styles.grupoHeader}>
                  <View style={{ flex: 1 }}>
                    {is10 && grupo !== 'Todos' && (
                      <Text style={styles.cursoTag}>{grupo}</Text>
                    )}
                    <Text style={styles.grupoTitle}>
                      {is10 ? `${grupo} — ${classeActiva}` : classeActiva}
                    </Text>
                    <Text style={styles.grupoCount}>{alunosGrupo.length} aluno(s)</Text>
                  </View>
                  <View style={styles.grupoActions}>
                    {todosAtribuidos && (
                      <View style={styles.atribuidoBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                        <Text style={styles.atribuidoText}>{turmaDom || 'Atribuído'}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.atribuirGrupoBtn}
                      onPress={() => setModalGrupo({
                        visible: true,
                        classe: classeActiva,
                        cursoNome: is10 ? grupo : undefined,
                        alunoIds: alunosGrupo.map(a => a.id),
                      })}
                    >
                      <Ionicons name="people" size={14} color="#fff" />
                      <Text style={styles.atribuirGrupoBtnText}>
                        {algumAtribuido ? 'Alterar Turma' : 'Atribuir Turma ao Grupo'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Lista de alunos do grupo */}
                {alunosGrupo.map(aluno => {
                  const turmaAluno = aluno.turmaIdAtribuida
                    ? turmas.find((t: any) => t.id === aluno.turmaIdAtribuida)
                    : null;
                  return (
                    <TouchableOpacity
                      key={aluno.id}
                      style={styles.alunoRow}
                      onPress={() => setModalAluno({
                        visible: true,
                        alunoId: aluno.id,
                        nome: `${aluno.nome} ${aluno.apelido}`,
                        classe: classeActiva,
                      })}
                    >
                      <View style={styles.alunoAvatar}>
                        <Text style={styles.alunoAvatarText}>
                          {aluno.nome?.[0]}{aluno.apelido?.[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.alunoNome}>{aluno.nome} {aluno.apelido}</Text>
                        <Text style={styles.alunoMat}>{aluno.numeroMatricula}</Text>
                      </View>
                      {turmaAluno ? (
                        <View style={styles.turmaBadge}>
                          <Ionicons name="checkmark" size={12} color={Colors.success} />
                          <Text style={styles.turmaBadgeText}>{(turmaAluno as any).nome}</Text>
                        </View>
                      ) : (
                        <View style={styles.semTurmaBadge}>
                          <Ionicons name="time-outline" size={12} color={Colors.warning} />
                          <Text style={styles.semTurmaText}>Pendente</Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Modal: selecção de turma para grupo */}
      <Modal visible={modalGrupo.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Atribuir Turma ao Grupo</Text>
            <Text style={styles.modalDesc}>
              {modalGrupo.cursoNome ? `Curso: ${modalGrupo.cursoNome} — ` : ''}{modalGrupo.classe} • {modalGrupo.alunoIds.length} aluno(s)
            </Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {turmasParaClasse(modalGrupo.classe).length === 0 ? (
                <Text style={styles.semTurmasMsg}>
                  Não existem turmas criadas para a {modalGrupo.classe}.{'\n'}
                  Crie as turmas primeiro no módulo de Turmas.
                </Text>
              ) : turmasParaClasse(modalGrupo.classe).map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.turmaOpcao}
                  onPress={() => atribuirTurmaAoGrupo(t.id, modalGrupo.alunoIds)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.turmaOpcaoNome}>{t.nome}</Text>
                    <Text style={styles.turmaOpcaoInfo}>{t.turno} · {t.anoLetivo}</Text>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={22} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelar} onPress={() => setModalGrupo(m => ({ ...m, visible: false }))}>
              <Text style={styles.modalCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: selecção de turma para aluno individual */}
      <Modal visible={modalAluno.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Atribuir Turma</Text>
            <Text style={styles.modalDesc}>{modalAluno.nome} · {modalAluno.classe}</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {turmasParaClasse(modalAluno.classe).length === 0 ? (
                <Text style={styles.semTurmasMsg}>
                  Não existem turmas criadas para a {modalAluno.classe}.
                </Text>
              ) : turmasParaClasse(modalAluno.classe).map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.turmaOpcao}
                  onPress={() => atribuirTurmaAoGrupo(t.id, [modalAluno.alunoId])}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.turmaOpcaoNome}>{t.nome}</Text>
                    <Text style={styles.turmaOpcaoInfo}>{t.turno} · {t.anoLetivo}</Text>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={22} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelar} onPress={() => setModalAluno(m => ({ ...m, visible: false }))}>
              <Text style={styles.modalCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: Colors.textMuted, marginTop: 8, textAlign: 'center' },

  summaryBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryNum: { fontSize: 20, fontWeight: '800', color: Colors.text },
  summaryLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  tabsScroll: { maxHeight: 48, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  tabActive: { backgroundColor: Colors.primary + '22' },
  tabText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.primary },
  tabBadge: { backgroundColor: Colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: Colors.primary },
  tabBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  body: { flex: 1, padding: 12 },

  grupo: {
    backgroundColor: Colors.card, borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    backgroundColor: Colors.primary + '14', borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 8,
  },
  cursoTag: {
    fontSize: 10, fontWeight: '700', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  grupoTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  grupoCount: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  grupoActions: { alignItems: 'flex-end', gap: 6 },
  atribuidoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.success + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  atribuidoText: { fontSize: 11, color: Colors.success, fontWeight: '600' },
  atribuirGrupoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7,
  },
  atribuirGrupoBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  alunoRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border + '55',
  },
  alunoAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  alunoAvatarText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  alunoNome: { fontSize: 14, fontWeight: '600', color: Colors.text },
  alunoMat: { fontSize: 11, color: Colors.textMuted },
  turmaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.success + '1A', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  turmaBadgeText: { fontSize: 11, color: Colors.success, fontWeight: '600' },
  semTurmaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warning + '1A', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  semTurmaText: { fontSize: 11, color: Colors.warning, fontWeight: '600' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36, maxHeight: '70%',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalDesc: { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  semTurmasMsg: {
    textAlign: 'center', color: Colors.textMuted, fontSize: 13,
    paddingVertical: 20, lineHeight: 20,
  },
  turmaOpcao: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    backgroundColor: Colors.background, borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  turmaOpcaoNome: { fontSize: 15, fontWeight: '700', color: Colors.text },
  turmaOpcaoInfo: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  modalCancelar: {
    marginTop: 12, alignItems: 'center', padding: 12,
    backgroundColor: Colors.border + '55', borderRadius: 10,
  },
  modalCancelarText: { color: Colors.textMuted, fontWeight: '600', fontSize: 14 },
});
