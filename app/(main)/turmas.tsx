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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useData, Turma, Sala } from '@/context/DataContext';
import { useConfig } from '@/context/ConfigContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import TopBar from '@/components/TopBar';
import { alertSucesso, alertErro } from '@/utils/toast';
import ExportMenu from '@/components/ExportMenu';
import { useLookup } from '@/hooks/useLookup';
import { webAlert } from '@/utils/webAlert';

interface Curso { id: string; nome: string; codigo: string; areaFormacao: string; ativo: boolean; }

const NIVEIS_FALLBACK = ['Primário', 'I Ciclo', 'II Ciclo'];
const TURNOS_FALLBACK = ['Manhã', 'Tarde', 'Noite'];
const CLASSES_FALLBACK = ['Iniciação', '1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe', '7ª Classe', '8ª Classe', '9ª Classe', '10ª Classe', '11ª Classe', '12ª Classe', '13ª Classe'];

function classeNumero(c: string): number {
  return parseInt(c.replace(/[^0-9]/g, ''), 10) || 0;
}

function classesPorNivel(nivel: string, allClasses: string[]): string[] {
  const n = nivel?.toLowerCase() || '';
  if (n.includes('primário') || n.includes('primario')) {
    return allClasses.filter(c => {
      const num = classeNumero(c);
      return c.toLowerCase().includes('iniciação') || c.toLowerCase().includes('iniciacao') || (num >= 1 && num <= 6);
    });
  }
  if (n.includes('ii ciclo') || n === 'ii ciclo') {
    return allClasses.filter(c => { const num = classeNumero(c); return num >= 10 && num <= 13; });
  }
  if (n.includes('i ciclo') || n === 'i ciclo') {
    return allClasses.filter(c => { const num = classeNumero(c); return num >= 7 && num <= 9; });
  }
  return allClasses;
}

function DirectorSelector({ professores, nivel, value, onChange }: { professores: any[]; nivel: string; value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const nivelMatch = nivel?.toLowerCase() || '';
  const profsFiltrados = useMemo(() => {
    return professores.filter((p: any) => {
      const pNivel = (p.nivelEnsino || 'I Ciclo').toLowerCase();
      return pNivel === nivelMatch;
    });
  }, [professores, nivelMatch]);

  const profsSearch = useMemo(() => {
    if (!search.trim()) return profsFiltrados;
    const q = search.toLowerCase();
    return profsFiltrados.filter((p: any) => `${p.nome} ${p.apelido}`.toLowerCase().includes(q));
  }, [profsFiltrados, search]);

  const selected = professores.find((p: any) => p.id === value);

  const nivelLabel: Record<string, string> = { 'primário': 'Primário', 'i ciclo': 'I Ciclo', 'ii ciclo': 'II Ciclo' };
  const nivelNome = nivelLabel[nivelMatch] || nivel;

  return (
    <View>
      <TouchableOpacity
        style={mS.directorTrigger}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.8}
      >
        <View style={mS.directorTriggerLeft}>
          <View style={mS.directorAvatar}>
            <Ionicons name={selected ? 'person' : 'person-outline'} size={16} color={selected ? Colors.gold : Colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            {selected ? (
              <>
                <Text style={mS.directorName}>{selected.nome} {selected.apelido}</Text>
                <Text style={mS.directorMeta}>{selected.nivelEnsino || nivel} · Director de Turma</Text>
              </>
            ) : (
              <Text style={mS.directorPlaceholder}>Seleccionar Director de Turma</Text>
            )}
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={mS.directorDropdown}>
          <View style={mS.directorSearch}>
            <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
            <TextInput
              style={mS.directorSearchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={`Pesquisar em ${nivelNome}...`}
              placeholderTextColor={Colors.textMuted}
              autoFocus={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[mS.directorOption, !value && mS.directorOptionActive]}
              onPress={() => { onChange(''); setExpanded(false); setSearch(''); }}
            >
              <View style={[mS.directorOptionAvatar, { backgroundColor: `${Colors.textMuted}15` }]}>
                <Ionicons name="close-circle-outline" size={14} color={Colors.textMuted} />
              </View>
              <Text style={[mS.directorOptionName, !value && { color: Colors.goldLight }]}>Nenhum</Text>
              {!value && <Ionicons name="checkmark-circle" size={16} color={Colors.gold} />}
            </TouchableOpacity>

            {profsFiltrados.length === 0 ? (
              <View style={{ padding: 16, alignItems: 'center', gap: 6 }}>
                <Ionicons name="people-outline" size={24} color={Colors.textMuted} />
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' }}>
                  Nenhum professor do nível {nivelNome} registado.{'\n'}Edite o perfil do professor para definir o nível.
                </Text>
              </View>
            ) : profsSearch.length === 0 ? (
              <View style={{ padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>Nenhum resultado para "{search}"</Text>
              </View>
            ) : (
              profsSearch.map((p: any) => {
                const isActive = value === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[mS.directorOption, isActive && mS.directorOptionActive]}
                    onPress={() => { onChange(p.id); setExpanded(false); setSearch(''); }}
                  >
                    <View style={[mS.directorOptionAvatar, isActive && { backgroundColor: `${Colors.gold}25` }]}>
                      <Ionicons name="person" size={14} color={isActive ? Colors.gold : Colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[mS.directorOptionName, isActive && { color: Colors.goldLight }]}>{p.nome} {p.apelido}</Text>
                      <Text style={mS.directorOptionMeta}>{p.numeroProfessor} · {p.nivelEnsino || nivel}</Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={16} color={Colors.gold} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {profsFiltrados.length > 0 && (
            <View style={mS.directorFooter}>
              <Ionicons name="information-circle-outline" size={12} color={Colors.textMuted} />
              <Text style={mS.directorFooterText}>
                {profsFiltrados.length} professor{profsFiltrados.length !== 1 ? 'es' : ''} do nível {nivelNome}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function TurmaFormModal({ visible, onClose, onSave, turma, professores, salas }: any) {
  const { anoSelecionado } = useAnoAcademico();
  const anoAtual = anoSelecionado?.ano || new Date().getFullYear().toString();
  const { values: niveis } = useLookup('niveis', NIVEIS_FALLBACK);
  const { values: turnos } = useLookup('turnos', TURNOS_FALLBACK);
  const { values: classes } = useLookup('classes', CLASSES_FALLBACK);
  const defaultNivel = turma?.nivel || niveis[1] || niveis[0] || 'I Ciclo';
  const defaultTurno = turma?.turno || turnos[0] || 'Manhã';
  const defaultClassesPorNivel = classesPorNivel(defaultNivel, classes);
  const defaultClasse = turma?.classe || defaultClassesPorNivel[0] || classes[0] || '7ª Classe';
  const [form, setForm] = useState<Partial<Turma>>(turma || {
    nome: '', classe: defaultClasse, turno: defaultTurno, anoLetivo: anoAtual,
    nivel: defaultNivel, professorId: '', sala: '', capacidade: 35, ativo: true,
  });
  const [cursos, setCursos] = useState<Curso[]>([]);
  const set = (k: keyof Turma, v: any) => setForm(f => ({ ...f, [k]: v }));
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const classesDoNivel = classesPorNivel(form.nivel || defaultNivel, classes);
  const isIICiclo = (form.nivel || '').toLowerCase().includes('ii ciclo');

  function handleNivelChange(n: string) {
    const classesNivel = classesPorNivel(n, classes);
    const primeiraClasse = classesNivel[0] || classes[0] || '';
    setForm(f => ({ ...f, nivel: n, classe: primeiraClasse, professorId: '' }));
  }

  useEffect(() => {
    if (visible) {
      fetch('/api/cursos').then(r => r.json()).then((list: Curso[]) => setCursos(list.filter(c => c.ativo))).catch(() => {});
    }
  }, [visible]);

  const salasAtivas: Sala[] = (salas || []).filter((s: Sala) => s.ativo);
  const salaSelected = salasAtivas.find((s: Sala) => s.nome === form.sala);

  function handleSelectSala(s: Sala) {
    setForm(f => ({ ...f, sala: s.nome, capacidade: s.capacidade }));
  }

  function handleSave() {
    if (!form.nome) {
      webAlert('Campo obrigatório', 'Preencha o nome da turma.');
      return;
    }
    if (!form.sala) {
      webAlert('Sala obrigatória', 'Seleccione uma sala para a turma.');
      return;
    }
    onSave(form);
  }

  const nivelAtual = form.nivel || defaultNivel;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={[mS.container, { paddingBottom: bottomPad + 16 }]}>
          <View style={mS.header}>
            <Text style={mS.title}>{turma ? 'Editar Turma' : 'Nova Turma'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Nome da Turma (ex: 7ª A)</Text>
              <TextInput
                style={mS.input}
                value={form.nome ?? ''}
                onChangeText={v => set('nome', v)}
                placeholder="Nome da Turma (ex: 7ª A)"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={[mS.field, { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.info}10`, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: `${Colors.info}25` }]}>
              <Ionicons name="calendar-outline" size={14} color={Colors.info} />
              <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.info, flex: 1 }}>
                Ano Lectivo: <Text style={{ fontFamily: 'Inter_700Bold' }}>{anoAtual}</Text>
              </Text>
            </View>

            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Sala</Text>
              {salasAtivas.length === 0 ? (
                <View style={mS.emptyRoomHint}>
                  <Ionicons name="alert-circle-outline" size={15} color={Colors.warning} />
                  <Text style={mS.emptyRoomText}>Nenhuma sala registada. Crie uma sala primeiro.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={mS.toggleRow}>
                    {salasAtivas.map((s: Sala) => {
                      const isActive = form.sala === s.nome;
                      return (
                        <TouchableOpacity key={s.id} style={[mS.salaCard, isActive && mS.salaCardActive]} onPress={() => handleSelectSala(s)}>
                          <Ionicons name="business-outline" size={14} color={isActive ? Colors.gold : Colors.textMuted} />
                          <Text style={[mS.salaName, isActive && mS.salaNameActive]}>{s.nome}</Text>
                          <Text style={[mS.salaMeta, isActive && mS.salaMetaActive]}>{s.bloco} · {s.capacidade} lug.</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
              {salaSelected && (
                <View style={mS.salaInfo}>
                  <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                  <Text style={mS.salaInfoText}>
                    {salaSelected.nome} — {salaSelected.tipo} — Capacidade: {salaSelected.capacidade} alunos
                  </Text>
                </View>
              )}
            </View>

            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Nível</Text>
              <View style={mS.toggleRow}>
                {niveis.map(n => (
                  <TouchableOpacity key={n} style={[mS.toggleBtn, form.nivel === n && mS.toggleActive]} onPress={() => handleNivelChange(n)}>
                    <Text style={[mS.toggleText, form.nivel === n && mS.toggleTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Classe</Text>
              {classesDoNivel.length === 0 ? (
                <View style={mS.emptyRoomHint}>
                  <Ionicons name="alert-circle-outline" size={15} color={Colors.warning} />
                  <Text style={mS.emptyRoomText}>Seleccione um nível para ver as classes disponíveis.</Text>
                </View>
              ) : (
                <View style={mS.toggleRow}>
                  {classesDoNivel.map(c => (
                    <TouchableOpacity key={c} style={[mS.toggleBtn, form.classe === c && mS.toggleActive]} onPress={() => set('classe', c)}>
                      <Text style={[mS.toggleText, form.classe === c && mS.toggleTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Turno</Text>
              <View style={mS.toggleRow}>
                {turnos.map(t => (
                  <TouchableOpacity key={t} style={[mS.toggleBtn, form.turno === t && mS.toggleActive]} onPress={() => set('turno', t)}>
                    <Text style={[mS.toggleText, form.turno === t && mS.toggleTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={mS.field}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={mS.fieldLabel}>Director de Turma <Text style={{ color: Colors.textMuted, fontFamily: 'Inter_400Regular' }}>(opcional)</Text></Text>
                <View style={mS.nivelBadge}>
                  <Ionicons name="filter-outline" size={10} color={Colors.info} />
                  <Text style={mS.nivelBadgeText}>{nivelAtual}</Text>
                </View>
              </View>
              <DirectorSelector
                professores={professores}
                nivel={nivelAtual}
                value={form.professorId || ''}
                onChange={(id) => set('professorId', id)}
              />
              <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 6, lineHeight: 14 }}>
                Apenas professores registados no nível {nivelAtual} são apresentados. O director é responsável pela gestão disciplinar, comunicação com encarregados e coordenação pedagógica da turma.
              </Text>
            </View>

            {isIICiclo && cursos.length > 0 && (
              <View style={mS.field}>
                <Text style={mS.fieldLabel}>Curso <Text style={{ color: Colors.textMuted, fontFamily: 'Inter_400Regular' }}>(opcional)</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={mS.toggleRow}>
                    <TouchableOpacity style={[mS.toggleBtn, !form.cursoId && mS.toggleActive]} onPress={() => set('cursoId', undefined)}>
                      <Text style={[mS.toggleText, !form.cursoId && mS.toggleTextActive]}>Nenhum</Text>
                    </TouchableOpacity>
                    {cursos.map((c: Curso) => (
                      <TouchableOpacity key={c.id} style={[mS.toggleBtn, form.cursoId === c.id && mS.toggleActive]} onPress={() => set('cursoId', c.id)}>
                        <Text style={[mS.toggleText, form.cursoId === c.id && mS.toggleTextActive]}>{c.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {form.cursoId && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: `${Colors.success}12`, borderRadius: 8, padding: 8 }}>
                    <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.success }}>
                      As disciplinas do curso serão usadas nas pautas e notas desta turma.
                    </Text>
                  </View>
                )}
              </View>
            )}
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
  const { turmas, professores, alunos, salas, addTurma, updateTurma, deleteTurma } = useData();
  const { config } = useConfig();
  const { values: nivelsFiltro } = useLookup('niveis', NIVEIS_FALLBACK);
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
    webAlert('Remover Turma', `Remover turma ${t.nome}?`, [
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

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 14, paddingTop: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterScroll, { flex: 1 }]} contentContainerStyle={styles.filterContent}>
          {['', ...nivelsFiltro].map(n => (
            <TouchableOpacity key={n} style={[styles.filterChip, filterNivel === n && styles.filterChipActive]} onPress={() => setFilterNivel(n)}>
              <Text style={[styles.filterChipText, filterNivel === n && styles.filterChipTextActive]}>{n || 'Todos'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ExportMenu
          title="Lista de Turmas"
          columns={[
            { header: 'Turma', key: 'nome', width: 16 },
            { header: 'Classe', key: 'classe', width: 14 },
            { header: 'Nível', key: 'nivel', width: 12 },
            { header: 'Turno', key: 'turno', width: 10 },
            { header: 'Ano Lectivo', key: 'anoLetivo', width: 14 },
            { header: 'Alunos', key: 'numAlunos', width: 10 },
            { header: 'Capacidade', key: 'capacidade', width: 12 },
            { header: 'Sala', key: 'sala', width: 12 },
            { header: 'Director de Turma', key: 'director', width: 24 },
          ]}
          rows={filtered.map(t => ({
            nome: t.nome,
            classe: t.classe,
            nivel: t.nivel,
            turno: t.turno,
            anoLetivo: t.anoLetivo,
            numAlunos: alunos.filter(a => a.turmaId === t.id).length,
            capacidade: t.capacidade,
            sala: t.sala,
            director: professores.find(p => p.id === t.professorId) ? `${professores.find(p => p.id === t.professorId)!.nome} ${professores.find(p => p.id === t.professorId)!.apelido}` : '—',
          }))}
          school={{ nomeEscola: config?.nomeEscola ?? 'Escola' }}
          filename="lista_turmas"
          landscape
        />
      </View>

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
        <TurmaFormModal visible={showForm} onClose={() => { setShowForm(false); setEditTurma(null); }} onSave={handleSave} turma={editTurma} professores={professores} salas={salas} />
      )}
    </View>
  );
}

const mS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
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
  salaCard: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 3, minWidth: 90,
  },
  salaCardActive: { backgroundColor: `${Colors.gold}18`, borderColor: Colors.gold },
  salaName: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  salaNameActive: { color: Colors.goldLight },
  salaMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  salaMetaActive: { color: `${Colors.gold}CC` },
  salaInfo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: `${Colors.success}12`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: `${Colors.success}25` },
  salaInfoText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.success, flex: 1 },
  emptyRoomHint: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: `${Colors.warning}12`, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: `${Colors.warning}25` },
  emptyRoomText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.warning, flex: 1 },
  nivelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${Colors.info}15`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${Colors.info}30` },
  nivelBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.info },
  directorTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  directorTriggerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  directorAvatar: { width: 34, height: 34, borderRadius: 10, backgroundColor: `${Colors.gold}15`, alignItems: 'center', justifyContent: 'center' },
  directorName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  directorMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  directorPlaceholder: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  directorDropdown: { marginTop: 6, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  directorSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  directorSearchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text },
  directorOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: `${Colors.border}60` },
  directorOptionActive: { backgroundColor: `${Colors.gold}10` },
  directorOptionAvatar: { width: 30, height: 30, borderRadius: 8, backgroundColor: `${Colors.textMuted}18`, alignItems: 'center', justifyContent: 'center' },
  directorOptionName: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text },
  directorOptionMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  directorFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: `${Colors.info}08`, borderTopWidth: 1, borderTopColor: Colors.border },
  directorFooterText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
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
