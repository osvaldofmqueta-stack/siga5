import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, TextInput, Platform, Modal,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useData, Aluno, Presenca } from '@/context/DataContext';
import { alertSucesso, alertErro } from '@/utils/toast';
import { webAlert } from '@/utils/webAlert';

// ─── Limiares ─────────────────────────────────────────────────────────────────
const LIMITE_FALTAS_ALERTA = 0.25;   // 25% de faltas → alerta
const LIMITE_PRESENCA_RISCO = 75;    // < 75% de presença → risco de reprovação
const LIMITE_NOTA_RISCO = 10;        // NF < 10 → risco de reprovação

type Tab = 'dossier' | 'faltas' | 'alertas' | 'risco';

// ─── Componente: Badge de risco ────────────────────────────────────────────────
function RiscoBadge({ tipo }: { tipo: 'alto' | 'medio' | 'baixo' }) {
  const cfg = {
    alto:  { color: Colors.danger,  label: 'Risco Alto',   icon: 'alert-circle' },
    medio: { color: Colors.warning, label: 'Risco Médio',  icon: 'warning' },
    baixo: { color: Colors.success, label: 'OK',            icon: 'checkmark-circle' },
  }[tipo];
  return (
    <View style={[sR.badge, { backgroundColor: cfg.color + '22' }]}>
      <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
      <Text style={[sR.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Modal de detalhes de faltas de um aluno ──────────────────────────────────
function ModalFaltasAluno({
  visible, aluno, presencas, turmaId, onClose, onJustificar,
}: {
  visible: boolean;
  aluno: Aluno | null;
  presencas: Presenca[];
  turmaId: string;
  onClose: () => void;
  onJustificar: (presencaId: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  if (!aluno) return null;

  const faltasAluno = presencas
    .filter(p => p.alunoId === aluno.id && p.turmaId === turmaId && p.status !== 'P')
    .sort((a, b) => b.data.localeCompare(a.data));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mF.overlay}>
        <View style={[mF.container, { paddingBottom: (Platform.OS === 'web' ? 24 : insets.bottom) + 16 }]}>
          <View style={mF.header}>
            <View>
              <Text style={mF.title}>{aluno.nome} {aluno.apelido}</Text>
              <Text style={mF.sub}>{faltasAluno.length} falta(s) registada(s)</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {faltasAluno.length === 0 ? (
            <View style={mF.empty}>
              <Ionicons name="checkmark-circle-outline" size={40} color={Colors.success} />
              <Text style={mF.emptyText}>Sem faltas registadas</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {faltasAluno.map(p => (
                <View key={p.id} style={[mF.row, { borderLeftColor: p.status === 'J' ? Colors.warning : Colors.danger }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={mF.rowData}>{new Date(p.data).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })}</Text>
                    <Text style={mF.rowDisc}>{p.disciplina}</Text>
                    {p.observacao ? <Text style={mF.rowObs}>"{p.observacao}"</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[mF.statusBadge, { backgroundColor: p.status === 'J' ? Colors.warning + '22' : Colors.danger + '22' }]}>
                      <Text style={[mF.statusText, { color: p.status === 'J' ? Colors.warning : Colors.danger }]}>
                        {p.status === 'J' ? 'Justificada' : 'Injustificada'}
                      </Text>
                    </View>
                    {p.status === 'F' && (
                      <TouchableOpacity
                        style={mF.justBtn}
                        onPress={() => onJustificar(p.id)}
                      >
                        <Ionicons name="checkmark" size={12} color={Colors.warning} />
                        <Text style={mF.justBtnText}>Justificar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Ecrã principal ────────────────────────────────────────────────────────────
export default function DirectorTurmaScreen() {
  const { user } = useAuth();
  const { professores, turmas, alunos, notas, presencas, updatePresenca } = useData();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [tab, setTab] = useState<Tab>('dossier');
  const [turmaIdx, setTurmaIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [alunoModal, setAlunoModal] = useState<Aluno | null>(null);

  const prof = useMemo(() => professores.find(p => p.email === user?.email), [professores, user]);

  // Turmas em que este professor é director
  const minhasTurmas = useMemo(() =>
    prof ? turmas.filter(t => t.professorId === prof.id && t.ativo) : [],
    [prof, turmas]
  );

  const turmaAtual = minhasTurmas[turmaIdx] || minhasTurmas[0];

  const alunosDaTurma = useMemo(() =>
    turmaAtual ? alunos.filter(a => a.turmaId === turmaAtual.id && a.ativo) : [],
    [turmaAtual, alunos]
  );

  const alunosFiltrados = useMemo(() =>
    alunosDaTurma.filter(a =>
      `${a.nome} ${a.apelido} ${a.numeroMatricula}`.toLowerCase().includes(search.toLowerCase())
    ),
    [alunosDaTurma, search]
  );

  // ── Estatísticas de presença por aluno ────────────────────────────────────
  function getStats(alunoId: string) {
    const pr = presencas.filter(p => p.alunoId === alunoId && p.turmaId === turmaAtual?.id);
    const total = pr.length;
    const presentes = pr.filter(p => p.status === 'P').length;
    const faltas = pr.filter(p => p.status === 'F').length;
    const justificadas = pr.filter(p => p.status === 'J').length;
    const pct = total > 0 ? Math.round((presentes / total) * 100) : 100;
    return { total, presentes, faltas, justificadas, pct };
  }

  // ── Média de notas por aluno ───────────────────────────────────────────────
  function getMediaNotas(alunoId: string): number | null {
    const notasAluno = notas.filter(n => n.alunoId === alunoId && n.turmaId === turmaAtual?.id && n.nf > 0);
    if (notasAluno.length === 0) return null;
    const soma = notasAluno.reduce((acc, n) => acc + n.nf, 0);
    return Math.round((soma / notasAluno.length) * 10) / 10;
  }

  // ── Justificar falta ───────────────────────────────────────────────────────
  const handleJustificar = useCallback(async (presencaId: string) => {
    try {
      await updatePresenca(presencaId, { status: 'J' });
      alertSucesso('Falta justificada', 'A falta foi marcada como justificada.');
    } catch {
      alertErro('Erro', 'Não foi possível justificar a falta.');
    }
  }, [updatePresenca]);

  // ── Alunos em alerta (muitas faltas) ──────────────────────────────────────
  const alunosAlerta = useMemo(() => {
    return alunosDaTurma
      .map(a => ({ aluno: a, stats: getStats(a.id) }))
      .filter(({ stats }) => stats.total > 0 && (1 - stats.presentes / stats.total) >= LIMITE_FALTAS_ALERTA)
      .sort((a, b) => a.stats.pct - b.stats.pct);
  }, [alunosDaTurma, presencas, turmaAtual]);

  // ── Alunos em risco de reprovação ─────────────────────────────────────────
  const alunosRisco = useMemo(() => {
    return alunosDaTurma.map(a => {
      const stats = getStats(a.id);
      const media = getMediaNotas(a.id);
      const riscoPresenca = stats.pct < LIMITE_PRESENCA_RISCO;
      const riscoNotas = media !== null && media < LIMITE_NOTA_RISCO;
      const nivel: 'alto' | 'medio' | 'baixo' =
        riscoPresenca && riscoNotas ? 'alto'
        : riscoPresenca || riscoNotas ? 'medio'
        : 'baixo';
      return { aluno: a, stats, media, riscoPresenca, riscoNotas, nivel };
    }).filter(r => r.nivel !== 'baixo')
      .sort((a, b) => (a.nivel === 'alto' ? -1 : b.nivel === 'alto' ? 1 : 0));
  }, [alunosDaTurma, presencas, notas, turmaAtual]);

  const tabConfig: { key: Tab; label: string; icon: string; badge?: number }[] = [
    { key: 'dossier', label: 'Dossier', icon: 'folder-open' },
    { key: 'faltas',  label: 'Faltas',  icon: 'calendar-clear' },
    { key: 'alertas', label: 'Alertas', icon: 'warning', badge: alunosAlerta.length },
    { key: 'risco',   label: 'Risco',   icon: 'trending-down', badge: alunosRisco.length },
  ];

  if (!prof) {
    return (
      <View style={s.screen}>
        <TopBar title="Director de Turma" subtitle="Painel exclusivo" />
        <View style={s.empty}>
          <Ionicons name="warning-outline" size={48} color={Colors.textMuted} />
          <Text style={s.emptyTitle}>Perfil não encontrado</Text>
          <Text style={s.emptySub}>O seu e-mail não está associado a nenhum professor.</Text>
        </View>
      </View>
    );
  }

  if (minhasTurmas.length === 0) {
    return (
      <View style={s.screen}>
        <TopBar title="Director de Turma" subtitle="Painel exclusivo" />
        <View style={s.empty}>
          <FontAwesome5 name="shield-alt" size={48} color={Colors.textMuted} />
          <Text style={s.emptyTitle}>Sem turmas sob sua direcção</Text>
          <Text style={s.emptySub}>Ainda não foi designado como Director de nenhuma turma activa.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <TopBar
        title="Director de Turma"
        subtitle={turmaAtual ? `${turmaAtual.nome} · ${turmaAtual.classe}` : 'Painel exclusivo'}
      />

      {/* Selector de turma (se for director de mais de uma) */}
      {minhasTurmas.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.turmaTabs}>
          <View style={s.turmaTabsInner}>
            {minhasTurmas.map((t, i) => (
              <TouchableOpacity
                key={t.id}
                style={[s.turmaTab, turmaIdx === i && s.turmaTabActive]}
                onPress={() => { setTurmaIdx(i); setSearch(''); }}
              >
                <Text style={[s.turmaTabText, turmaIdx === i && s.turmaTabTextActive]}>{t.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Info bar da turma */}
      {turmaAtual && (
        <View style={s.infoBar}>
          <View style={s.infoPill}>
            <Ionicons name="people" size={12} color={Colors.info} />
            <Text style={s.infoPillText}>{alunosDaTurma.length} alunos</Text>
          </View>
          <View style={s.infoPill}>
            <Ionicons name="time-outline" size={12} color={Colors.gold} />
            <Text style={s.infoPillText}>{turmaAtual.turno}</Text>
          </View>
          <View style={s.infoPill}>
            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
            <Text style={s.infoPillText}>Sala {turmaAtual.sala}</Text>
          </View>
          <View style={s.infoPill}>
            <Ionicons name="calendar-outline" size={12} color={Colors.success} />
            <Text style={s.infoPillText}>{turmaAtual.anoLetivo}</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
        {tabConfig.map(tc => (
          <TouchableOpacity
            key={tc.key}
            style={[s.tabBtn, tab === tc.key && s.tabBtnActive]}
            onPress={() => setTab(tc.key)}
          >
            <Ionicons name={tc.icon as any} size={14} color={tab === tc.key ? Colors.gold : Colors.textMuted} />
            <Text style={[s.tabText, tab === tc.key && s.tabTextActive]}>{tc.label}</Text>
            {tc.badge !== undefined && tc.badge > 0 && (
              <View style={s.tabBadge}>
                <Text style={s.tabBadgeText}>{tc.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Tab: DOSSIER ─────────────────────────────────────────────────────── */}
      {tab === 'dossier' && (
        <>
          <View style={s.searchBox}>
            <Ionicons name="search" size={15} color={Colors.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Pesquisar aluno..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <FlatList
            data={alunosFiltrados}
            keyExtractor={a => a.id}
            contentContainerStyle={{ padding: 14, paddingBottom: bottomPad + 20 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTitle}>Nenhum aluno encontrado</Text>
              </View>
            }
            renderItem={({ item: a, index }) => {
              const stats = getStats(a.id);
              const pctColor = stats.pct >= 75 ? Colors.success : stats.pct >= 50 ? Colors.warning : Colors.danger;
              const idade = a.dataNascimento
                ? Math.floor((Date.now() - new Date(a.dataNascimento).getTime()) / (365.25 * 86400000))
                : null;
              return (
                <View style={s.dossierCard}>
                  <View style={s.dossierTop}>
                    <View style={s.dossierAvatar}>
                      <Text style={s.dossierAvatarText}>{a.nome[0]}{a.apelido[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.dossierNome}>{String(index + 1).padStart(2, '0')}. {a.nome} {a.apelido}</Text>
                      <Text style={s.dossierMat}>{a.numeroMatricula} · {a.genero === 'M' ? 'Masculino' : 'Feminino'}{idade ? ` · ${idade} anos` : ''}</Text>
                      {a.provincia ? <Text style={s.dossierMat}>{a.provincia}{a.municipio ? `, ${a.municipio}` : ''}</Text> : null}
                    </View>
                    <View style={[s.pctCircle, { borderColor: pctColor }]}>
                      <Text style={[s.pctVal, { color: pctColor }]}>{stats.pct}%</Text>
                      <Text style={s.pctLbl}>pres.</Text>
                    </View>
                  </View>
                  <View style={s.dossierEnc}>
                    <Ionicons name="person-circle-outline" size={14} color={Colors.textMuted} />
                    <Text style={s.dossierEncText} numberOfLines={1}>
                      Enc: {a.nomeEncarregado || '—'}
                    </Text>
                    {a.telefoneEncarregado ? (
                      <Text style={s.dossierEncPhone}>{a.telefoneEncarregado}</Text>
                    ) : null}
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      {/* ── Tab: FALTAS ──────────────────────────────────────────────────────── */}
      {tab === 'faltas' && (
        <>
          <View style={s.searchBox}>
            <Ionicons name="search" size={15} color={Colors.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Pesquisar aluno..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <FlatList
            data={alunosFiltrados}
            keyExtractor={a => a.id}
            contentContainerStyle={{ padding: 14, paddingBottom: bottomPad + 20 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTitle}>Nenhum aluno</Text>
              </View>
            }
            renderItem={({ item: a }) => {
              const stats = getStats(a.id);
              const pctColor = stats.pct >= 75 ? Colors.success : stats.pct >= 50 ? Colors.warning : Colors.danger;
              return (
                <TouchableOpacity
                  style={s.faltasCard}
                  onPress={() => setAlunoModal(a)}
                  activeOpacity={0.8}
                >
                  <View style={s.faltasLeft}>
                    <View style={s.faltasAvatar}>
                      <Text style={s.faltasAvatarText}>{a.nome[0]}{a.apelido[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.faltasNome}>{a.nome} {a.apelido}</Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                        <Text style={[s.faltasStat, { color: Colors.success }]}>✓ {stats.presentes} pres.</Text>
                        <Text style={[s.faltasStat, { color: Colors.danger }]}>✗ {stats.faltas} inj.</Text>
                        <Text style={[s.faltasStat, { color: Colors.warning }]}>~ {stats.justificadas} just.</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[s.pctBadge, { backgroundColor: pctColor + '22' }]}>
                      <Text style={[s.pctBadgeText, { color: pctColor }]}>{stats.pct}%</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      {/* ── Tab: ALERTAS ─────────────────────────────────────────────────────── */}
      {tab === 'alertas' && (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: bottomPad + 20 }}>
          <View style={s.alertaBanner}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.warning} />
            <Text style={s.alertaBannerText}>
              Alunos com mais de {Math.round(LIMITE_FALTAS_ALERTA * 100)}% de faltas. Comunique aos encarregados de educação.
            </Text>
          </View>

          {alunosAlerta.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.success} />
              <Text style={s.emptyTitle}>Sem alertas activos</Text>
              <Text style={s.emptySub}>Nenhum aluno ultrapassou o limite de faltas.</Text>
            </View>
          ) : (
            alunosAlerta.map(({ aluno: a, stats }) => (
              <View key={a.id} style={s.alertaCard}>
                <View style={s.alertaTop}>
                  <View style={[s.alertaAvatar, { backgroundColor: Colors.danger + '22' }]}>
                    <Text style={[s.alertaAvatarText, { color: Colors.danger }]}>{a.nome[0]}{a.apelido[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.alertaNome}>{a.nome} {a.apelido}</Text>
                    <Text style={s.alertaMat}>{a.numeroMatricula}</Text>
                  </View>
                  <View style={[s.pctBadge, { backgroundColor: Colors.danger + '22' }]}>
                    <Text style={[s.pctBadgeText, { color: Colors.danger }]}>{stats.pct}%</Text>
                  </View>
                </View>
                <View style={s.alertaStats}>
                  <View style={s.alertaStatItem}>
                    <Text style={[s.alertaStatNum, { color: Colors.danger }]}>{stats.faltas}</Text>
                    <Text style={s.alertaStatLbl}>Injustificadas</Text>
                  </View>
                  <View style={s.alertaStatItem}>
                    <Text style={[s.alertaStatNum, { color: Colors.warning }]}>{stats.justificadas}</Text>
                    <Text style={s.alertaStatLbl}>Justificadas</Text>
                  </View>
                  <View style={s.alertaStatItem}>
                    <Text style={[s.alertaStatNum, { color: Colors.textSecondary }]}>{stats.total}</Text>
                    <Text style={s.alertaStatLbl}>Total registos</Text>
                  </View>
                </View>
                {(a.nomeEncarregado || a.telefoneEncarregado) && (
                  <View style={s.alertaEnc}>
                    <Ionicons name="person-circle-outline" size={14} color={Colors.textMuted} />
                    <Text style={s.alertaEncText}>
                      {a.nomeEncarregado}{a.telefoneEncarregado ? ` · ${a.telefoneEncarregado}` : ''}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={s.alertaBtn}
                  onPress={() => webAlert(
                    'Contactar Encarregado',
                    `Registe que contactou o encarregado de ${a.nome} ${a.apelido} sobre o excesso de faltas.\n\nEncarregado: ${a.nomeEncarregado || '—'}\nTelefone: ${a.telefoneEncarregado || '—'}`,
                    [{ text: 'Fechar', style: 'cancel' }]
                  )}
                >
                  <Ionicons name="call-outline" size={14} color={Colors.info} />
                  <Text style={s.alertaBtnText}>Ver contacto do encarregado</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Tab: RISCO DE REPROVAÇÃO ─────────────────────────────────────────── */}
      {tab === 'risco' && (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: bottomPad + 20 }}>
          <View style={s.legendaRow}>
            <View style={s.legendaItem}>
              <View style={[s.legendaDot, { backgroundColor: Colors.danger }]} />
              <Text style={s.legendaText}>Risco Alto — faltas + notas em baixo</Text>
            </View>
            <View style={s.legendaItem}>
              <View style={[s.legendaDot, { backgroundColor: Colors.warning }]} />
              <Text style={s.legendaText}>Risco Médio — um dos factores</Text>
            </View>
          </View>

          {alunosRisco.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="shield-checkmark-outline" size={48} color={Colors.success} />
              <Text style={s.emptyTitle}>Nenhum aluno em risco</Text>
              <Text style={s.emptySub}>Todos os alunos têm assiduidade e notas adequadas.</Text>
            </View>
          ) : (
            alunosRisco.map(({ aluno: a, stats, media, riscoPresenca, riscoNotas, nivel }) => (
              <View key={a.id} style={[s.riscoCard, { borderLeftColor: nivel === 'alto' ? Colors.danger : Colors.warning }]}>
                <View style={s.riscoTop}>
                  <View style={s.faltasAvatar}>
                    <Text style={s.faltasAvatarText}>{a.nome[0]}{a.apelido[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.faltasNome}>{a.nome} {a.apelido}</Text>
                    <Text style={s.alertaMat}>{a.numeroMatricula}</Text>
                  </View>
                  <RiscoBadge tipo={nivel} />
                </View>
                <View style={s.riscoFactores}>
                  <View style={[s.riscoFactor, riscoPresenca && s.riscoFactorAlert]}>
                    <Ionicons name="calendar-clear-outline" size={13} color={riscoPresenca ? Colors.danger : Colors.success} />
                    <Text style={[s.riscoFactorText, { color: riscoPresenca ? Colors.danger : Colors.success }]}>
                      Presença: {stats.pct}%
                    </Text>
                  </View>
                  <View style={[s.riscoFactor, riscoNotas && s.riscoFactorAlertWarn]}>
                    <Ionicons name="document-text-outline" size={13} color={riscoNotas ? Colors.warning : Colors.success} />
                    <Text style={[s.riscoFactorText, { color: riscoNotas ? Colors.warning : Colors.success }]}>
                      Média NF: {media !== null ? media : 'S/dados'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal de detalhes de faltas */}
      <ModalFaltasAluno
        visible={!!alunoModal}
        aluno={alunoModal}
        presencas={presencas}
        turmaId={turmaAtual?.id || ''}
        onClose={() => setAlunoModal(null)}
        onJustificar={async (id) => {
          await handleJustificar(id);
        }}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  turmaTabs: { maxHeight: 52, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  turmaTabsInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  turmaTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface },
  turmaTabActive: { backgroundColor: Colors.accent },
  turmaTabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  turmaTabTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  infoBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  infoPillText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tabScroll: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface, position: 'relative' },
  tabBtnActive: { backgroundColor: `${Colors.gold}22`, borderWidth: 1, borderColor: Colors.gold },
  tabText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  tabBadge: { backgroundColor: Colors.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 14, marginBottom: 4, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  // Dossier
  dossierCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10 },
  dossierTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dossierAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  dossierAvatarText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  dossierNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  dossierMat: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  dossierEnc: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: `${Colors.info}10`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dossierEncText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, flex: 1 },
  dossierEncPhone: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.info },
  pctCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pctVal: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  pctLbl: { fontSize: 8, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  // Faltas
  faltasCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  faltasLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  faltasAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  faltasAvatarText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold },
  faltasNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  faltasStat: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  pctBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pctBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  // Alertas
  alertaBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: `${Colors.warning}12`, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: `${Colors.warning}30` },
  alertaBannerText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.warning, flex: 1, lineHeight: 17 },
  alertaCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10, gap: 10 },
  alertaTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertaAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  alertaAvatarText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  alertaNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  alertaMat: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  alertaStats: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  alertaStatItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  alertaStatNum: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  alertaStatLbl: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  alertaEnc: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: `${Colors.info}10`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  alertaEncText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, flex: 1 },
  alertaBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center', backgroundColor: `${Colors.info}15`, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: `${Colors.info}30` },
  alertaBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.info },
  // Risco
  legendaRow: { gap: 6, marginBottom: 12 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendaDot: { width: 10, height: 10, borderRadius: 5 },
  legendaText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  riscoCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, padding: 14, marginBottom: 10, gap: 10 },
  riscoTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riscoFactores: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  riscoFactor: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${Colors.success}12`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  riscoFactorAlert: { backgroundColor: `${Colors.danger}12` },
  riscoFactorAlertWarn: { backgroundColor: `${Colors.warning}12` },
  riscoFactorText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});

const sR = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

const mF = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  container: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, borderLeftWidth: 3, paddingLeft: 12, marginBottom: 2 },
  rowData: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  rowDisc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  rowObs: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 3, fontStyle: 'italic' },
  statusBadge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  justBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${Colors.warning}22`, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  justBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.warning },
});
