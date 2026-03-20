import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, Modal, FlatList,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useProfessor } from '@/context/ProfessorContext';
import { useProfessor as useProfCtx } from '@/context/ProfessorContext';
import { useNotificacoes } from '@/context/NotificacoesContext';
import { timeAgo } from '@/context/NotificacoesContext';

type Tab = 'sumarios' | 'solicitacoes' | 'calendario';

export default function RHControleScreen() {
  const { user } = useAuth();
  const { professores, turmas } = useData();
  const { sumarios, updateSumario, solicitacoes, updateSolicitacao, updatePauta, pautas, calendarioProvas, addCalendarioProva, updateCalendarioProva, deleteCalendarioProva } = useProfessor();
  const { addNotificacao } = useNotificacoes();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [tab, setTab] = useState<Tab>('sumarios');
  const [selectedSumario, setSelectedSumario] = useState<string | null>(null);
  const [selectedSolicidade, setSelectedSolicidade] = useState<string | null>(null);
  const [observacao, setObservacao] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'aceite' | 'rejeitado'>('pendente');

  // Calendário de provas
  const [showProvaForm, setShowProvaForm] = useState(false);
  const [editingProva, setEditingProva] = useState<string | null>(null);
  const [provaTitulo, setProvaTitulo] = useState('');
  const [provaDesc, setProvaDesc] = useState('');
  const [provaDisciplina, setProvaDisciplina] = useState('');
  const [provaData, setProvaData] = useState('');
  const [provaHora, setProvaHora] = useState('');
  const [provaTipo, setProvaTipo] = useState<'teste' | 'exame' | 'trabalho' | 'prova_oral'>('teste');
  const [provaTurmasIds, setProvaTurmasIds] = useState<string[]>([]);

  const isRH = user?.role === 'secretaria' || user?.role === 'admin' || user?.role === 'director' || user?.role === 'ceo';

  const sumariosOrdenados = useMemo(() =>
    [...sumarios]
      .filter(s => filtro === 'todos' || s.status === filtro)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sumarios, filtro]
  );

  const solicitacoesPendentes = useMemo(() =>
    solicitacoes.filter(s => s.status === 'pendente')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [solicitacoes]
  );

  const sumarioSelecionado = sumarios.find(s => s.id === selectedSumario);
  const solicitSelecionada = solicitacoes.find(s => s.id === selectedSolicidade);

  async function aceitarSumario() {
    if (!sumarioSelecionado) return;
    await updateSumario(sumarioSelecionado.id, { status: 'aceite', observacaoRH: observacao || undefined });
    await addNotificacao({
      titulo: 'Sumário Aceite',
      mensagem: `O sumário da aula ${sumarioSelecionado.numeroAula} de ${sumarioSelecionado.disciplina} foi aceite.`,
      tipo: 'sucesso',
      data: new Date().toISOString(),
    });
    setSelectedSumario(null);
    setObservacao('');
  }

  async function rejeitarSumario() {
    if (!sumarioSelecionado) return;
    if (!observacao.trim()) {
      Alert.alert('Obrigatório', 'Indique o motivo da rejeição.');
      return;
    }
    await updateSumario(sumarioSelecionado.id, { status: 'rejeitado', observacaoRH: observacao });
    await addNotificacao({
      titulo: 'Sumário Rejeitado',
      mensagem: `O sumário da aula ${sumarioSelecionado.numeroAula} de ${sumarioSelecionado.disciplina} foi rejeitado. Motivo: ${observacao}`,
      tipo: 'aviso',
      data: new Date().toISOString(),
    });
    setSelectedSumario(null);
    setObservacao('');
  }

  async function aprovarSolicitacao() {
    if (!solicitSelecionada) return;
    await updateSolicitacao(solicitSelecionada.id, {
      status: 'aprovada',
      respondidoEm: new Date().toISOString(),
      observacao,
    });
    await updatePauta(solicitSelecionada.pautaId, { status: 'aberta' });
    await addNotificacao({
      titulo: 'Reabertura Aprovada',
      mensagem: `A sua solicitação de reabertura da pauta de ${solicitSelecionada.disciplina} (${solicitSelecionada.turmaNome}) foi aprovada.`,
      tipo: 'sucesso',
      data: new Date().toISOString(),
    });
    setSelectedSolicidade(null);
    setObservacao('');
  }

  async function rejeitarSolicitacao() {
    if (!solicitSelecionada) return;
    await updateSolicitacao(solicitSelecionada.id, {
      status: 'rejeitada',
      respondidoEm: new Date().toISOString(),
      observacao,
    });
    await addNotificacao({
      titulo: 'Reabertura Rejeitada',
      mensagem: `A sua solicitação de reabertura da pauta de ${solicitSelecionada.disciplina} foi rejeitada.`,
      tipo: 'aviso',
      data: new Date().toISOString(),
    });
    setSelectedSolicidade(null);
    setObservacao('');
  }

  async function publicarProva() {
    if (!provaTitulo || !provaData || !provaDisciplina) return;
    if (editingProva) {
      await updateCalendarioProva(editingProva, {
        titulo: provaTitulo, descricao: provaDesc, disciplina: provaDisciplina,
        data: provaData, hora: provaHora, tipo: provaTipo,
        turmasIds: provaTurmasIds, publicado: true,
      });
    } else {
      await addCalendarioProva({
        titulo: provaTitulo, descricao: provaDesc, disciplina: provaDisciplina,
        data: provaData, hora: provaHora, tipo: provaTipo,
        turmasIds: provaTurmasIds, publicado: false,
      });
    }
    await addNotificacao({
      titulo: 'Nova Prova no Calendário',
      mensagem: `${provaTitulo} de ${provaDisciplina} agendada para ${provaData} às ${provaHora}.`,
      tipo: 'aviso',
      data: new Date().toISOString(),
    });
    setShowProvaForm(false);
    resetProvaForm();
  }

  function resetProvaForm() {
    setProvaTitulo(''); setProvaDesc(''); setProvaDisciplina('');
    setProvaData(''); setProvaHora(''); setProvaTurmasIds([]);
    setEditingProva(null);
  }

  async function publicarToggle(id: string, publicado: boolean) {
    await updateCalendarioProva(id, { publicado });
    if (publicado) {
      const prova = calendarioProvas.find(p => p.id === id);
      await addNotificacao({
        titulo: 'Prova Publicada',
        mensagem: `${prova?.titulo} de ${prova?.disciplina} foi publicada para os professores.`,
        tipo: 'info',
        data: new Date().toISOString(),
      });
    }
  }

  if (!isRH) {
    return (
      <View style={styles.container}>
        <TopBar title="Controlo RH" subtitle="Acesso restrito" />
        <View style={styles.empty}>
          <Ionicons name="lock-closed" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Acesso Restrito</Text>
          <Text style={styles.emptySub}>Esta área é exclusiva para Secretaria, Admin e Direcção.</Text>
        </View>
      </View>
    );
  }

  const tipoProvaColor: Record<string, string> = { teste: Colors.info, exame: Colors.danger, trabalho: Colors.gold, prova_oral: Colors.success };

  return (
    <View style={styles.container}>
      <TopBar title="Controlo RH / Secretaria" subtitle="Sumários, pautas e calendário" />

      {/* Summary Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.warning }]}>{sumarios.filter(s => s.status === 'pendente').length}</Text>
          <Text style={styles.statLabel}>Sumários Pendentes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.accent }]}>{solicitacoesPendentes.length}</Text>
          <Text style={styles.statLabel}>Solicitações</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Colors.info }]}>{calendarioProvas.filter(p => p.publicado).length}</Text>
          <Text style={styles.statLabel}>Provas Publ.</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <View style={styles.tabRow}>
          {(['sumarios', 'solicitacoes', 'calendario'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'sumarios' ? `Sumários (${sumarios.filter(s => s.status === 'pendente').length})` : t === 'solicitacoes' ? `Solicitações (${solicitacoesPendentes.length})` : 'Calendário Provas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* SUMARIOS TAB */}
      {tab === 'sumarios' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <View style={styles.filterInner}>
              {(['pendente', 'aceite', 'rejeitado', 'todos'] as const).map(f => (
                <TouchableOpacity key={f} style={[styles.filterBtn, filtro === f && styles.filterBtnActive]} onPress={() => setFiltro(f)}>
                  <Text style={[styles.filterText, filtro === f && styles.filterTextActive]}>
                    {f === 'pendente' ? 'Pendentes' : f === 'aceite' ? 'Aceites' : f === 'rejeitado' ? 'Rejeitados' : 'Todos'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <FlatList
            data={sumariosOrdenados}
            keyExtractor={s => s.id}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Nenhum sumário</Text></View>}
            renderItem={({ item: s }) => {
              const sc = s.status === 'aceite' ? Colors.success : s.status === 'rejeitado' ? Colors.danger : Colors.warning;
              return (
                <TouchableOpacity
                  style={[styles.card, { borderLeftColor: sc, borderLeftWidth: 3 }]}
                  onPress={() => setSelectedSumario(s.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{s.professorNome}</Text>
                      <Text style={styles.cardSub}>{s.disciplina} · {s.turmaNome} · Aula {s.numeroAula}</Text>
                      <Text style={styles.cardDate}>{s.data} · {s.horaInicio}–{s.horaFim}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc + '22' }]}>
                      <Text style={[styles.statusText, { color: sc }]}>
                        {s.status === 'aceite' ? 'Aceite' : s.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardConteudo} numberOfLines={2}>{s.conteudo}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      {/* SOLICITACOES TAB */}
      {tab === 'solicitacoes' && (
        <FlatList
          data={solicitacoes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>Nenhuma solicitação</Text></View>}
          renderItem={({ item: sol }) => {
            const sc = sol.status === 'aprovada' ? Colors.success : sol.status === 'rejeitada' ? Colors.danger : Colors.warning;
            return (
              <TouchableOpacity
                style={[styles.card, sol.status === 'pendente' && { borderLeftColor: Colors.warning, borderLeftWidth: 3 }]}
                onPress={() => sol.status === 'pendente' && setSelectedSolicidade(sol.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{sol.professorNome}</Text>
                    <Text style={styles.cardSub}>{sol.disciplina} · {sol.turmaNome} · T{sol.trimestre}</Text>
                    <Text style={styles.cardDate}>{timeAgo(sol.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + '22' }]}>
                    <Text style={[styles.statusText, { color: sc }]}>
                      {sol.status === 'aprovada' ? 'Aprovada' : sol.status === 'rejeitada' ? 'Rejeitada' : 'Pendente'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardConteudo} numberOfLines={2}>Motivo: {sol.motivo}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* CALENDARIO TAB */}
      {tab === 'calendario' && (
        <FlatList
          data={calendarioProvas.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 90 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="calendar-blank" size={52} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhuma prova agendada</Text>
            </View>
          }
          renderItem={({ item: prova }) => {
            const color = tipoProvaColor[prova.tipo] || Colors.info;
            return (
              <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{prova.titulo}</Text>
                    <Text style={styles.cardSub}>{prova.disciplina} · {prova.tipo}</Text>
                    <Text style={styles.cardDate}>{prova.data} às {prova.hora}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.publishBtn, { backgroundColor: prova.publicado ? Colors.success + '22' : Colors.surface }]}
                      onPress={() => publicarToggle(prova.id, !prova.publicado)}
                    >
                      <Ionicons name={prova.publicado ? 'eye' : 'eye-off'} size={14} color={prova.publicado ? Colors.success : Colors.textMuted} />
                      <Text style={[styles.publishText, { color: prova.publicado ? Colors.success : Colors.textMuted }]}>
                        {prova.publicado ? 'Publicado' : 'Rascunho'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Eliminar', 'Eliminar esta prova?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Eliminar', style: 'destructive', onPress: () => deleteCalendarioProva(prova.id) }
                    ])}>
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                {prova.descricao ? <Text style={styles.cardConteudo} numberOfLines={2}>{prova.descricao}</Text> : null}
              </View>
            );
          }}
        />
      )}

      {tab === 'calendario' && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowProvaForm(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Sumario Review Modal */}
      <Modal visible={!!selectedSumario} transparent animationType="slide" onRequestClose={() => setSelectedSumario(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Validar Sumário</Text>
              <TouchableOpacity onPress={() => setSelectedSumario(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {sumarioSelecionado && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.reviewLabel}>Professor</Text>
                <Text style={styles.reviewValue}>{sumarioSelecionado.professorNome}</Text>
                <Text style={styles.reviewLabel}>Turma / Disciplina</Text>
                <Text style={styles.reviewValue}>{sumarioSelecionado.turmaNome} · {sumarioSelecionado.disciplina}</Text>
                <Text style={styles.reviewLabel}>Data / Horário</Text>
                <Text style={styles.reviewValue}>{sumarioSelecionado.data} · {sumarioSelecionado.horaInicio}–{sumarioSelecionado.horaFim} · Aula {sumarioSelecionado.numeroAula}</Text>
                <Text style={styles.reviewLabel}>Conteúdo Lecionado</Text>
                <View style={styles.conteudoBox}>
                  <Text style={styles.conteudoText}>{sumarioSelecionado.conteudo}</Text>
                </View>
                <Text style={styles.fieldLabel}>Observação (obrigatória na rejeição)</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Escreva uma observação..."
                  placeholderTextColor={Colors.textMuted}
                  value={observacao}
                  onChangeText={setObservacao}
                  multiline
                />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={rejeitarSumario}>
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Rejeitar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={aceitarSumario}>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Aceitar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Solicitacao Review Modal */}
      <Modal visible={!!selectedSolicidade} transparent animationType="slide" onRequestClose={() => setSelectedSolicidade(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitação de Reabertura</Text>
              <TouchableOpacity onPress={() => setSelectedSolicidade(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {solicitSelecionada && (
              <ScrollView>
                <Text style={styles.reviewLabel}>Professor</Text>
                <Text style={styles.reviewValue}>{solicitSelecionada.professorNome}</Text>
                <Text style={styles.reviewLabel}>Pauta</Text>
                <Text style={styles.reviewValue}>{solicitSelecionada.disciplina} · {solicitSelecionada.turmaNome} · Trimestre {solicitSelecionada.trimestre}</Text>
                <Text style={styles.reviewLabel}>Motivo do Pedido</Text>
                <View style={styles.conteudoBox}>
                  <Text style={styles.conteudoText}>{solicitSelecionada.motivo}</Text>
                </View>
                <Text style={styles.fieldLabel}>Resposta / Observação</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Escreva uma resposta..."
                  placeholderTextColor={Colors.textMuted}
                  value={observacao}
                  onChangeText={setObservacao}
                  multiline
                />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={rejeitarSolicitacao}>
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Rejeitar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={aprovarSolicitacao}>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Aprovar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Nova Prova Modal */}
      <Modal visible={showProvaForm} transparent animationType="slide" onRequestClose={() => { setShowProvaForm(false); resetProvaForm(); }}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agendar Prova</Text>
              <TouchableOpacity onPress={() => { setShowProvaForm(false); resetProvaForm(); }} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Tipo</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['teste', 'exame', 'trabalho', 'prova_oral'] as const).map(t => (
                  <TouchableOpacity key={t} style={[styles.tipoBtn, provaTipo === t && styles.tipoBtnActive, { backgroundColor: provaTipo === t ? tipoProvaColor[t] + '22' : Colors.surface }]} onPress={() => setProvaTipo(t)}>
                    <Text style={[styles.tipoBtnText, provaTipo === t && { color: tipoProvaColor[t] }]}>
                      {t === 'prova_oral' ? 'Oral' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Título</Text>
              <TextInput style={styles.input} placeholder="Ex: Teste do 1º Trimestre..." placeholderTextColor={Colors.textMuted} value={provaTitulo} onChangeText={setProvaTitulo} />
              <Text style={styles.fieldLabel}>Disciplina</Text>
              <TextInput style={styles.input} placeholder="Ex: Matemática" placeholderTextColor={Colors.textMuted} value={provaDisciplina} onChangeText={setProvaDisciplina} />
              <Text style={styles.fieldLabel}>Data (AAAA-MM-DD)</Text>
              <TextInput style={styles.input} placeholder="2025-06-15" placeholderTextColor={Colors.textMuted} value={provaData} onChangeText={setProvaData} />
              <Text style={styles.fieldLabel}>Hora</Text>
              <TextInput style={styles.input} placeholder="08:00" placeholderTextColor={Colors.textMuted} value={provaHora} onChangeText={setProvaHora} />
              <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Informações adicionais..." placeholderTextColor={Colors.textMuted} value={provaDesc} onChangeText={setProvaDesc} multiline />
              <Text style={styles.fieldLabel}>Turmas</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {turmas.filter(t => t.ativo).map(t => {
                  const sel = provaTurmasIds.includes(t.id);
                  return (
                    <TouchableOpacity key={t.id} style={[styles.tipoBtn, sel && styles.tipoBtnActive]} onPress={() => setProvaTurmasIds(sel ? provaTurmasIds.filter(id => id !== t.id) : [...provaTurmasIds, t.id])}>
                      <Text style={[styles.tipoBtnText, sel && { color: Colors.gold }]}>{t.nome}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={[styles.saveBtn, (!provaTitulo || !provaData || !provaDisciplina) && styles.saveBtnDisabled]} onPress={publicarProva} disabled={!provaTitulo || !provaData || !provaDisciplina}>
                <Ionicons name="calendar" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Guardar Prova</Text>
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
  statsBar: { flexDirection: 'row', backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 14 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: Colors.border },
  tabScroll: { maxHeight: 48, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tabTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  filterRow: { maxHeight: 46, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface },
  filterBtnActive: { backgroundColor: Colors.gold + '33', borderWidth: 1, borderColor: Colors.gold + '66' },
  filterText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  filterTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  card: { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.gold, marginTop: 2 },
  cardDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  cardConteudo: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18 },
  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  publishText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  fab: { position: 'absolute', bottom: 80, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  closeBtn: { padding: 4 },
  reviewLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 4 },
  reviewValue: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  conteudoBox: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginTop: 4, borderWidth: 1, borderColor: Colors.border },
  conteudoText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, lineHeight: 22 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.danger },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.success },
  actionBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  tipoBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tipoBtnActive: { borderColor: Colors.gold + '66' },
  tipoBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, minHeight: 200 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
});
