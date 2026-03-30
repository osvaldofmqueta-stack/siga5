import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInputDimensions, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { useProfessor } from '@/context/ProfessorContext';
import { alertSucesso, alertErro } from '@/utils/toast';
import { useNotificacoes } from '@/context/NotificacoesContext';
import { apiRequest } from '@/lib/query-client';
import { useLookup } from '@/hooks/useLookup';
import { webAlert } from '@/utils/webAlert';

const { width } = Dimensions.get('window');

interface AulaHorario {
  id: string;
  turmaId: string;
  disciplina: string;
  professorId: string;
  professorNome: string;
  diaSemana: number;
  periodo: number;
  horaInicio: string;
  horaFim: string;
  sala: string;
  anoAcademico: string;
}

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
const DIAS_FULL = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

const PERIODOS = [
  { numero: 1, inicio: '07:00', fim: '07:45' },
  { numero: 2, inicio: '07:45', fim: '08:30' },
  { numero: 3, inicio: '08:30', fim: '09:15' },
  { numero: 4, inicio: '09:45', fim: '10:30' },
  { numero: 5, inicio: '10:30', fim: '11:15' },
  { numero: 6, inicio: '11:15', fim: '12:00' },
];


const CELL_W = Math.max(64, (width - 52) / 5);

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}


type ModalMode = 'add' | 'edit' | null;

export default function HorarioScreen() {
  const { user } = useAuth();
  const { turmas, professores, alunos } = useData();
  const { anoSelecionado } = useAnoAcademico();
  const { addSumario } = useProfessor();
  const { addNotificacao } = useNotificacoes();
  const { values: disciplinasFallback } = useLookup('disciplinas_fallback', [
    'Língua Portuguesa', 'Matemática', 'Física', 'Química', 'Biologia',
    'História', 'Geografia', 'Língua Estrangeira I', 'Educação Física', 'Filosofia',
  ]);

  const isProf = user?.role === 'professor';
  const isAluno = user?.role === 'aluno';
  const profData = professores.find(p => p.email === user?.email);
  const alunoData = alunos.find(a => a.email === user?.email || a.numeroBi === user?.numeroBi);

  function toArray(val: unknown): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val as string[];
    if (typeof val === 'string') {
      try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
  }

  const [showSumarioModal, setShowSumarioModal] = useState(false);
  const [sumarioAula, setSumarioAula] = useState<AulaHorario | null>(null);
  const [sumarioConteudo, setSumarioConteudo] = useState('');
  const [sumarioNumero, setSumarioNumero] = useState('');
  const [horarios, setHorarios] = useState<AulaHorario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [turmaIdx, setTurmaIdx] = useState(0);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedCell, setSelectedCell] = useState<{ dia: number; periodo: number } | null>(null);
  const [editingHorario, setEditingHorario] = useState<AulaHorario | null>(null);
  const [form, setForm] = useState({ disciplina: '', professorId: '', sala: '' });
  const [showDisciplinaList, setShowDisciplinaList] = useState(false);
  const [showProfList, setShowProfList] = useState(false);
  const [disciplinas, setDisciplinas] = useState<string[]>([]);

  const turmasAtivas = turmas.filter(t => {
    const anoOk = !anoSelecionado || t.anoLetivo === anoSelecionado.ano;
    if (isProf && profData) {
      return t.ativo && anoOk && toArray(profData.turmasIds).includes(t.id);
    }
    if (isAluno && alunoData) {
      return t.ativo && anoOk && t.id === alunoData.turmaId;
    }
    return t.ativo && anoOk;
  });
  const turmaAtual = turmasAtivas[turmaIdx] || turmasAtivas[0];

  useEffect(() => {
    loadHorarios();
  }, []);

  useEffect(() => {
    if (!turmaAtual) { setDisciplinas([]); return; }
    fetch(`/api/turmas/${turmaAtual.id}/disciplinas`)
      .then(r => r.json())
      .then((list: { nome: string }[]) => {
        if (list && list.length > 0) {
          setDisciplinas(list.map(d => d.nome));
        } else {
          setDisciplinas(disciplinasFallback);
        }
      })
      .catch(() => setDisciplinas(disciplinasFallback));
  }, [turmaAtual?.id]);

  async function loadHorarios() {
    try {
      const res = await apiRequest('GET', '/api/horarios');
      const data = await res.json();
      setHorarios(Array.isArray(data) ? data : []);
    } catch {
      setHorarios([]);
    } finally {
      setIsLoading(false);
    }
  }

  const horariosTurma = horarios.filter(h =>
    h.turmaId === turmaAtual?.id &&
    (!anoSelecionado || h.anoAcademico === anoSelecionado.ano)
  );

  function getAula(dia: number, periodo: number): AulaHorario | undefined {
    return horariosTurma.find(h => h.diaSemana === dia && h.periodo === periodo);
  }

  function openAdd(dia: number, periodo: number) {
    setSelectedCell({ dia, periodo });
    setForm({ disciplina: '', professorId: '', sala: '' });
    setEditingHorario(null);
    setModalMode('add');
  }

  function openEdit(aula: AulaHorario) {
    setEditingHorario(aula);
    setForm({ disciplina: aula.disciplina, professorId: aula.professorId, sala: aula.sala });
    setSelectedCell({ dia: aula.diaSemana, periodo: aula.periodo });
    setModalMode('edit');
  }

  function openOptions(aula: AulaHorario) {
    webAlert(aula.disciplina, `${DIAS_FULL[aula.diaSemana - 1]} — ${aula.horaInicio}`, [
      { text: 'Editar', onPress: () => openEdit(aula) },
      { text: 'Remover', style: 'destructive', onPress: () => removeAula(aula.id) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function removeAula(id: string) {
    try {
      await apiRequest('DELETE', `/api/horarios/${id}`);
      setHorarios(prev => prev.filter(h => h.id !== id));
      alertSucesso('Aula removida', 'A aula foi removida do horário.');
    } catch {
      alertErro('Erro', 'Não foi possível remover a aula.');
    }
  }

  async function salvar() {
    if (!form.disciplina || !selectedCell || !turmaAtual) return;
    const prof = professores.find(p => p.id === form.professorId);
    const periodo = PERIODOS[selectedCell.periodo - 1];

    if (modalMode === 'add') {
      const nova: AulaHorario = {
        id: genId(),
        turmaId: turmaAtual.id,
        disciplina: form.disciplina,
        professorId: form.professorId,
        professorNome: prof ? `${prof.nome} ${prof.apelido}` : '—',
        diaSemana: selectedCell.dia,
        periodo: selectedCell.periodo,
        horaInicio: periodo.inicio,
        horaFim: periodo.fim,
        sala: form.sala || turmaAtual.sala,
        anoAcademico: anoSelecionado?.ano || '2025',
      };
      try {
        const res = await apiRequest('POST', '/api/horarios', nova);
        const created = await res.json();
        setHorarios(prev => [...prev, created]);
        alertSucesso('Aula adicionada', `${form.disciplina} foi adicionada ao horário.`);
      } catch {
        alertErro('Erro', 'Não foi possível guardar a aula.');
      }
    } else if (modalMode === 'edit' && editingHorario) {
      const updates = {
        disciplina: form.disciplina,
        professorId: form.professorId || null,
        professorNome: prof ? `${prof.nome} ${prof.apelido}` : '—',
        sala: form.sala || editingHorario.sala,
      };
      try {
        const res = await apiRequest('PUT', `/api/horarios/${editingHorario.id}`, updates);
        const updated = await res.json();
        setHorarios(prev => prev.map(h => h.id === editingHorario.id ? updated : h));
        alertSucesso('Aula actualizada', `${form.disciplina} foi actualizada com sucesso.`);
      } catch {
        alertErro('Erro', 'Não foi possível actualizar a aula.');
      }
    }
    setModalMode(null);
  }

  async function submeterSumarioFromHorario() {
    if (!sumarioAula || !profData || !sumarioConteudo.trim() || !sumarioNumero) return;
    const turma = turmasAtivas.find(t => t.id === sumarioAula.turmaId);
    await addSumario({
      professorId: profData.id,
      professorNome: `${profData.nome} ${profData.apelido}`,
      turmaId: sumarioAula.turmaId,
      turmaNome: turma?.nome || '',
      disciplina: sumarioAula.disciplina,
      data: new Date().toISOString().split('T')[0],
      horaInicio: sumarioAula.horaInicio,
      horaFim: sumarioAula.horaFim,
      numeroAula: parseInt(sumarioNumero) || 1,
      conteudo: sumarioConteudo,
      status: 'pendente',
    });
    await addNotificacao({
      titulo: 'Sumário Submetido',
      mensagem: `Sumário da aula ${sumarioNumero} de ${sumarioAula.disciplina} enviado para aprovação.`,
      tipo: 'info',
      data: new Date().toISOString(),
    });
    setSumarioConteudo('');
    setSumarioNumero('');
    setSumarioAula(null);
    setShowSumarioModal(false);
    alertSucesso('Sumário enviado', 'O sumário foi enviado ao RH para validação.');
  }

  function openProfCell(aula: AulaHorario) {
    if (aula.professorId !== profData?.id) {
      webAlert(aula.disciplina, `Prof. ${aula.professorNome} · ${aula.sala}\n${DIAS_FULL[aula.diaSemana - 1]} — ${aula.horaInicio}`);
      return;
    }
    setSumarioAula(aula);
    setSumarioConteudo('');
    setSumarioNumero('');
    setShowSumarioModal(true);
  }

  const profOptions = professores.filter(p => p.ativo);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.gold} size="large" />
      </View>
    );
  }

  if (turmasAtivas.length === 0) {
    return (
      <View style={styles.container}>
        <TopBar title="Horário" subtitle="Sem turmas disponíveis" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="calendar-outline" size={56} color={Colors.textMuted} />
          <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 16, textAlign: 'center' }}>
            Sem turmas atribuídas
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            {isProf
              ? 'Ainda não tem turmas atribuídas. Contacte a direcção para que lhe sejam atribuídas turmas.'
              : 'Não existem turmas activas no sistema. Crie turmas na secção de Gestão Académica.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title="Horário" subtitle={turmaAtual ? `${turmaAtual.nome} — ${turmaAtual.turno}` : 'Selecione uma turma'} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.turmaTabsScroll}>
        <View style={styles.turmaTabs}>
          {turmasAtivas.map((t, i) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.turmaTab, turmaIdx === i && styles.turmaTabActive]}
              onPress={() => setTurmaIdx(i)}
            >
              <Text style={[styles.turmaTabText, turmaIdx === i && styles.turmaTabTextActive]}>{t.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {turmaAtual && (
        <View style={styles.infoBar}>
          <View style={styles.infoBadge}>
            <MaterialIcons name="class" size={13} color={Colors.gold} />
            <Text style={styles.infoText}>{turmaAtual.nivel}</Text>
          </View>
          <View style={styles.infoBadge}>
            <Ionicons name="time" size={13} color={Colors.info} />
            <Text style={styles.infoText}>{turmaAtual.turno}</Text>
          </View>
          <View style={styles.infoBadge}>
            <Ionicons name="location" size={13} color={Colors.textMuted} />
            <Text style={styles.infoText}>{turmaAtual.sala}</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.gridContainer} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.gridHeader}>
              <View style={styles.periodoLabel} />
              {DIAS.map((dia, i) => (
                <View key={dia} style={[styles.diaHeader, { width: CELL_W }]}>
                  <Text style={styles.diaHeaderText}>{dia}</Text>
                </View>
              ))}
            </View>

            {PERIODOS.map((periodo) => (
              <View key={periodo.numero} style={styles.gridRow}>
                <View style={styles.periodoLabel}>
                  <Text style={styles.periodoNum}>{periodo.numero}º</Text>
                  <Text style={styles.periodoTime}>{periodo.inicio}</Text>
                </View>
                {DIAS.map((_, diaIdx) => {
                  const dia = diaIdx + 1;
                  const aula = getAula(dia, periodo.numero);
                  const isMyClass = isProf && aula && aula.professorId === profData?.id;
                  return aula ? (
                    <TouchableOpacity
                      key={dia}
                      style={[
                        styles.cell, styles.cellFilled, { width: CELL_W },
                        isMyClass && styles.cellMinha,
                      ]}
                      onLongPress={() => (!isProf && !isAluno) && openOptions(aula)}
                      onPress={() => isProf ? openProfCell(aula) : (isAluno ? undefined : openOptions(aula))}
                      activeOpacity={isAluno ? 1 : 0.7}
                    >
                      <Text style={styles.cellDisciplina} numberOfLines={2}>{aula.disciplina}</Text>
                      <Text style={styles.cellProf} numberOfLines={1}>{aula.professorNome}</Text>
                      <Text style={styles.cellSala} numberOfLines={1}>{aula.sala}</Text>
                      {isMyClass && (
                        <View style={styles.sumarioBadge}>
                          <Ionicons name="add-circle" size={12} color={Colors.gold} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (isProf || isAluno) ? (
                    <View key={dia} style={[styles.cell, styles.cellEmpty, { width: CELL_W }]} />
                  ) : (
                    <TouchableOpacity
                      key={dia}
                      style={[styles.cell, styles.cellEmpty, { width: CELL_W }]}
                      onPress={() => openAdd(dia, periodo.numero)}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="add" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.legendaContainer}>
          <Text style={styles.legendaTitle}>Legenda de Períodos</Text>
          {PERIODOS.map(p => {
            const aulasNoPeriodo = horariosTurma.filter(h => h.periodo === p.numero);
            const seen = new Set<string>();
            const aulasUnicas = aulasNoPeriodo.filter(h => {
              const key = `${h.disciplina}-${h.professorId}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            return (
              <View key={p.numero} style={styles.legendaRow}>
                <View style={styles.legendaPeriodoHeader}>
                  <Text style={styles.legendaNum}>{p.numero}º Período</Text>
                  <Text style={styles.legendaTime}>{p.inicio} — {p.fim}</Text>
                </View>
                {aulasUnicas.length > 0 ? (
                  aulasUnicas.map((aula, i) => {
                    const prof = professores.find(pr => pr.id === aula.professorId);
                    return (
                      <View key={i} style={styles.legendaAulaCard}>
                        <View style={styles.legendaAulaRow}>
                          <Ionicons name="book-outline" size={11} color={Colors.gold} />
                          <Text style={styles.legendaAulaDisciplina}>{aula.disciplina}</Text>
                        </View>
                        {prof && (
                          <>
                            <View style={styles.legendaAulaRow}>
                              <Ionicons name="person-outline" size={11} color={Colors.info} />
                              <Text style={styles.legendaAulaProf}>{prof.nome} {prof.apelido}</Text>
                            </View>
                            {prof.habilitacoes ? (
                              <View style={styles.legendaAulaRow}>
                                <Ionicons name="school-outline" size={11} color={Colors.textMuted} />
                                <Text style={styles.legendaAulaHab}>{prof.habilitacoes}</Text>
                              </View>
                            ) : null}
                          </>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.legendaVazio}>— Sem aulas registadas —</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={modalMode !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'add' ? 'Adicionar Aula' : 'Editar Aula'}
              </Text>
              {selectedCell && (
                <Text style={styles.modalSubtitle}>
                  {DIAS_FULL[selectedCell.dia - 1]} — {PERIODOS[selectedCell.periodo - 1]?.inicio}
                </Text>
              )}
              <TouchableOpacity onPress={() => setModalMode(null)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Disciplina *</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => { setShowDisciplinaList(v => !v); setShowProfList(false); }}
              >
                <Text style={form.disciplina ? styles.selectorValue : styles.selectorPlaceholder}>
                  {form.disciplina || 'Selecionar disciplina...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {showDisciplinaList && (
                <View style={styles.dropdownList}>
                  {disciplinas.map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dropdownItem, form.disciplina === d && styles.dropdownItemActive]}
                      onPress={() => { setForm(f => ({ ...f, disciplina: d })); setShowDisciplinaList(false); }}
                    >
                      <Text style={[styles.dropdownText, form.disciplina === d && styles.dropdownTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Professor</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => { setShowProfList(v => !v); setShowDisciplinaList(false); }}
              >
                <Text style={form.professorId ? styles.selectorValue : styles.selectorPlaceholder}>
                  {form.professorId ? (profOptions.find(p => p.id === form.professorId)?.nome + ' ' + profOptions.find(p => p.id === form.professorId)?.apelido) : 'Selecionar professor...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {showProfList && (
                <View style={styles.dropdownList}>
                  {profOptions.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.dropdownItem, form.professorId === p.id && styles.dropdownItemActive]}
                      onPress={() => { setForm(f => ({ ...f, professorId: p.id })); setShowProfList(false); }}
                    >
                      <Text style={[styles.dropdownText, form.professorId === p.id && styles.dropdownTextActive]}>
                        {p.nome} {p.apelido}
                      </Text>
                      <Text style={styles.dropdownSub}>{toArray(p.disciplinas).join(', ')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Sala</Text>
              <TextInput
                style={styles.input}
                placeholder={turmaAtual?.sala || 'Ex: Sala 01'}
                placeholderTextColor={Colors.textMuted}
                value={form.sala}
                onChangeText={v => setForm(f => ({ ...f, sala: v }))}
              />

              <TouchableOpacity
                style={[styles.saveBtn, !form.disciplina && styles.saveBtnDisabled]}
                onPress={salvar}
                disabled={!form.disciplina}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Guardar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Professor Sumário Modal */}
      <Modal visible={showSumarioModal} transparent animationType="slide" onRequestClose={() => setShowSumarioModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Registar Sumário</Text>
                {sumarioAula && (
                  <Text style={styles.modalSubtitle}>
                    {sumarioAula.disciplina} · {DIAS_FULL[sumarioAula.diaSemana - 1]} {sumarioAula.horaInicio}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowSumarioModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Número da Aula</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 1, 2, 3..."
                placeholderTextColor={Colors.textMuted}
                value={sumarioNumero}
                onChangeText={setSumarioNumero}
                keyboardType="numeric"
              />
              <Text style={styles.fieldLabel}>Conteúdo da Aula</Text>
              <TextInput
                style={[styles.input, { height: 140, textAlignVertical: 'top' }]}
                placeholder="Descreva o conteúdo lecionado nesta aula..."
                placeholderTextColor={Colors.textMuted}
                value={sumarioConteudo}
                onChangeText={setSumarioConteudo}
                multiline
              />
              <View style={{ backgroundColor: Colors.info + '11', borderRadius: 10, padding: 12, marginTop: 10 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 18 }}>
                  O sumário ficará pendente até ser aceite pelo RH. As suas faltas são controladas conforme o estado do sumário.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, (!sumarioConteudo || !sumarioNumero) && styles.saveBtnDisabled]}
                onPress={submeterSumarioFromHorario}
                disabled={!sumarioConteudo || !sumarioNumero}
              >
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Submeter Sumário</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  turmaTabsScroll: { maxHeight: 52, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  turmaTabs: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  turmaTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface },
  turmaTabActive: { backgroundColor: Colors.accent },
  turmaTabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  turmaTabTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  infoBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.backgroundCard },
  infoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  infoText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  gridContainer: { flex: 1 },
  gridHeader: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 12, paddingBottom: 6 },
  periodoLabel: { width: 46 },
  diaHeader: { alignItems: 'center', paddingVertical: 4 },
  diaHeaderText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold },
  gridRow: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 },
  periodoNum: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textSecondary },
  periodoTime: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  cell: { marginHorizontal: 3, borderRadius: 10, minHeight: 72, alignItems: 'center', justifyContent: 'center', padding: 6 },
  cellEmpty: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  cellFilled: { backgroundColor: Colors.primaryLight },
  cellDisciplina: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.text, textAlign: 'center', marginBottom: 2 },
  cellProf: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.gold, textAlign: 'center' },
  cellSala: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  legendaContainer: { margin: 16, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14 },
  legendaTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  legendaRow: { flexDirection: 'column', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  legendaPeriodoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  legendaNum: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  legendaTime: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  legendaAulaCard: { backgroundColor: Colors.surface, borderRadius: 8, padding: 8, marginTop: 4, gap: 3 },
  legendaAulaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendaAulaDisciplina: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.gold, flex: 1 },
  legendaAulaProf: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text, flex: 1 },
  legendaAulaHab: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, flex: 1 },
  legendaVazio: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontStyle: 'italic', marginTop: 4, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderRadius: 24, padding: 20, maxHeight: '90%', width: '100%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  modalSubtitle: { position: 'absolute', top: 22, left: 0, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  modalClose: { padding: 4 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  selector: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border },
  selectorValue: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  selectorPlaceholder: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  dropdownList: { backgroundColor: Colors.surface, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: Colors.border, maxHeight: 200, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemActive: { backgroundColor: 'rgba(240,165,0,0.1)' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  dropdownTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  dropdownSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 8 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  cellMinha: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.gold + '55' },
  sumarioBadge: { position: 'absolute', top: 4, right: 4 },
});
