import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useData, Nota, NotaLancamentos, PedidoReabertura } from '@/context/DataContext';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { alertSucesso, alertErro } from '@/utils/toast';
import TopBar from '@/components/TopBar';
import ContinuidadeStatusModal from '@/components/ContinuidadeStatusModal';

import { useLookup } from '@/hooks/useLookup';
import { webAlert } from '@/utils/webAlert';

const ALL_AVAL_KEYS = ['aval1','aval2','aval3','aval4','aval5','aval6','aval7','aval8'] as const;
type AvalKey = typeof ALL_AVAL_KEYS[number];

function calcMac(vals: number[], count: number): number {
  if (count === 0) return 0;
  return parseFloat((vals.reduce((s, v) => s + v, 0) / count).toFixed(2));
}

function calcMt1(mac1: number, pp1: number, ppt: number, pp1On: boolean, pptOn: boolean): number {
  const parts = [mac1];
  if (pp1On) parts.push(pp1);
  if (pptOn) parts.push(ppt);
  return parseFloat((parts.reduce((s, v) => s + v, 0) / parts.length).toFixed(2));
}

function gradeColor(val: number) {
  if (val >= 14) return Colors.success;
  if (val >= 10) return Colors.warning;
  return Colors.danger;
}

function gradeLabel(val: number) {
  if (val >= 17) return 'Muito Bom';
  if (val >= 14) return 'Bom';
  if (val >= 10) return 'Suficiente';
  return 'Insuficiente';
}

function GradeInput({
  label, value, onChange, highlight = false, readonly = false, registered = false,
  pending = false, min = 0, max = 20,
}: {
  label: string;
  value: number;
  onChange?: (v: number) => void;
  highlight?: boolean;
  readonly?: boolean;
  registered?: boolean;
  pending?: boolean;
  min?: number;
  max?: number;
}) {
  const color = gradeColor(value);
  const isOverMax = !readonly && value > max && value > 0;
  const inputBorderColor = isOverMax
    ? Colors.danger
    : registered
    ? Colors.success + '70'
    : highlight
    ? Colors.gold + '80'
    : undefined;
  const inputBg = isOverMax
    ? Colors.danger + '10'
    : registered
    ? Colors.success + '08'
    : undefined;

  return (
    <View style={gS.gradeBox}>
      <View style={gS.gradeLabelRow}>
        <Text style={gS.gradeLabel}>{label}</Text>
        {registered && !isOverMax && !pending && <View style={gS.registeredDot} />}
        {pending && <Ionicons name="time-outline" size={10} color={Colors.warning} />}
        {isOverMax && (
          <Ionicons name="alert-circle" size={10} color={Colors.danger} />
        )}
      </View>
      {readonly ? (
        <View style={[
          gS.gradeReadonly,
          highlight && { borderColor: color + '80', backgroundColor: color + '12' },
          pending && { borderColor: Colors.warning + '80', backgroundColor: Colors.warning + '10' },
        ]}>
          <Text style={[gS.gradeReadonlyVal, { color: highlight ? color : Colors.text }]}>
            {value > 0 ? value.toFixed(1) : '—'}
          </Text>
          {pending && <Ionicons name="time" size={10} color={Colors.warning} style={{ marginLeft: 2 }} />}
        </View>
      ) : (
        <TextInput
          style={[
            gS.gradeInput,
            inputBorderColor ? { borderColor: inputBorderColor } : undefined,
            inputBg ? { backgroundColor: inputBg } : undefined,
          ]}
          value={value === 0 ? '' : String(value)}
          onChangeText={t => {
            const cleaned = t.replace(/[^0-9.]/g, '');
            if (cleaned === '' || cleaned === '0') { onChange?.(0); return; }
            const n = parseFloat(cleaned);
            if (!isNaN(n)) {
              onChange?.(Math.min(max, Math.max(min, n)));
            }
          }}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={Colors.textMuted}
          maxLength={max <= 5 ? 1 : 4}
          selectTextOnFocus
        />
      )}
    </View>
  );
}

const LANC_KEYS: (keyof NotaLancamentos)[] = ['aval1','aval2','aval3','aval4','aval5','aval6','aval7','aval8','pp1','ppt'];

function buildEmptyLanc(): NotaLancamentos {
  return { aval1: false, aval2: false, aval3: false, aval4: false, aval5: false, aval6: false, aval7: false, aval8: false, pp1: false, ppt: false };
}

function NotaFormModal({
  visible, onClose, onSave, alunos, turmas, nota, trimestre, disciplinas, professorId,
  pp1Habilitado, pptHabilitado, numAvaliacoes, allNotas,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (n: Partial<Nota>, parcial: boolean) => void;
  alunos: any[];
  turmas: any[];
  nota: Nota | null;
  trimestre: 1 | 2 | 3;
  disciplinas: string[];
  professorId: string;
  pp1Habilitado: boolean;
  pptHabilitado: boolean;
  numAvaliacoes: number;
  allNotas: Nota[];
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // auto-detected existing nota when selecting aluno+disciplina in new-launch mode
  const [autoNota, setAutoNota] = useState<Nota | null>(null);
  const autoKeyRef = useRef<string>('');

  const effectiveNota = nota ?? autoNota;
  const isEditingExisting = effectiveNota !== null;
  const activeAvalKeys = ALL_AVAL_KEYS.slice(0, numAvaliacoes);

  const [selectedTurmaId, setSelectedTurmaId] = useState<string>(nota?.turmaId || turmas[0]?.id || '');
  const [alunoSearch, setAlunoSearch] = useState('');
  const [disciplinaSearch, setDisciplinaSearch] = useState('');

  // Alunos carregados dinamicamente da API ao seleccionar turma
  const [alunosDaAPI, setAlunosDaAPI] = useState<any[]>([]);
  const [alunosLoading, setAlunosLoading] = useState(false);

  const makeEmpty = (): Partial<Nota> => ({
    alunoId: alunos[0]?.id || '',
    turmaId: '',
    disciplina: disciplinas[0] || '',
    trimestre,
    aval1: 0, aval2: 0, aval3: 0, aval4: 0, aval5: 0, aval6: 0, aval7: 0, aval8: 0,
    mac1: 0, pp1: 0, ppt: 0, mt1: 0, nf: 0, mac: 0,
    anoLetivo: new Date().getFullYear().toString(),
    professorId,
    data: new Date().toISOString().split('T')[0],
    lancamentos: buildEmptyLanc(),
  });

  const [form, setForm] = useState<Partial<Nota>>(nota ? { ...nota, lancamentos: nota.lancamentos || buildEmptyLanc() } : makeEmpty());

  // Reabertura de campos bloqueados
  const [reaberturaModal, setReaberturaModal] = useState<{ campo: string; label: string } | null>(null);
  const [reaberturaMotivo, setReaberturaMotivo] = useState('');
  const [isSubmittingRea, setIsSubmittingRea] = useState(false);

  const camposAbertos: string[] = (form.camposAbertos as string[]) ?? [];
  const pedidosReabertura: PedidoReabertura[] = (form.pedidosReabertura as PedidoReabertura[]) ?? [];

  function hasPendingRequest(campo: string) {
    return pedidosReabertura.some(p => p.campo === campo && p.status === 'pendente');
  }

  async function openLockedField(campo: string, label: string) {
    if (hasPendingRequest(campo)) {
      webAlert('Pedido em Análise', 'Já existe um pedido de reabertura pendente para este campo. Aguarde a resposta da direcção.');
      return;
    }
    setReaberturaMotivo('');
    setReaberturaModal({ campo, label });
  }

  async function submitReabertura() {
    if (!reaberturaMotivo.trim()) {
      webAlert('Motivo necessário', 'Indique o motivo pelo qual necessita de corrigir este campo.');
      return;
    }
    const notaId = effectiveNota?.id ?? (form as any).id;
    if (!notaId) {
      webAlert('Erro', 'Guarde a nota antes de solicitar a reabertura.');
      return;
    }
    setIsSubmittingRea(true);
    try {
      const updated = await api.post<Nota>(`/api/notas/${notaId}/solicitar-reabertura`, {
        campo: reaberturaModal!.campo,
        motivo: reaberturaMotivo.trim(),
        professorId,
      });
      setForm(f => ({ ...f, pedidosReabertura: updated.pedidosReabertura }));
      setReaberturaModal(null);
      setReaberturaMotivo('');
      alertSucesso('Pedido enviado', 'O pedido de reabertura foi enviado à direcção para análise.');
    } catch (e: any) {
      const msg = e?.message?.includes('pendente') ? 'Já existe um pedido pendente para este campo.' : 'Não foi possível enviar o pedido.';
      webAlert('Erro', msg);
    } finally {
      setIsSubmittingRea(false);
    }
  }

  const set = (k: keyof Nota, v: any) => setForm(f => {
    const next = { ...f, [k]: v };

    if (LANC_KEYS.includes(k as keyof NotaLancamentos)) {
      next.lancamentos = { ...(f.lancamentos || buildEmptyLanc()), [k]: true } as NotaLancamentos;
    }

    const lanc = next.lancamentos || buildEmptyLanc();

    const regAvals = activeAvalKeys
      .map(key => ({ key, val: (next[key as keyof Nota] as number) || 0, reg: !!(lanc[key as keyof NotaLancamentos]) }))
      .filter(a => a.reg)
      .map(a => a.val);

    const allAvalVals = activeAvalKeys.map(key => (next[key as keyof Nota] as number) || 0);
    const mac1 = regAvals.length === numAvaliacoes
      ? calcMac(allAvalVals, numAvaliacoes)
      : regAvals.length > 0 ? calcMac(regAvals, regAvals.length) : 0;

    const pp1 = next.pp1 || 0;
    const ppt = next.ppt || 0;
    const mt1 = mac1 > 0 ? calcMt1(mac1, pp1, ppt, pp1Habilitado, pptHabilitado) : 0;
    const nf = mt1;

    return { ...next, mac1, mt1, nf, mac: nf };
  });

  const selectedAluno = alunosDaAPI.find((a: any) => a.id === form.alunoId)
    ?? alunos.find((a: any) => a.id === form.alunoId);

  React.useEffect(() => {
    autoKeyRef.current = '';
    setAutoNota(null);
    setAlunoSearch('');
    setDisciplinaSearch('');
    setAlunosDaAPI([]);
    if (nota) {
      setSelectedTurmaId(nota.turmaId || turmas[0]?.id || '');
      setForm({ ...nota, lancamentos: nota.lancamentos || buildEmptyLanc() });
    } else {
      const defaultTurmaId = turmas[0]?.id || '';
      setSelectedTurmaId(defaultTurmaId);
      setForm({ ...makeEmpty(), trimestre, alunoId: '' });
    }
  }, [nota, visible, trimestre]);

  // Carregar alunos da API dinamicamente quando a turma muda (igual às disciplinas)
  useEffect(() => {
    if (!selectedTurmaId) { setAlunosDaAPI([]); return; }
    setAlunosLoading(true);
    fetch(`/api/turmas/${selectedTurmaId}/alunos`)
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setAlunosDaAPI(Array.isArray(data) ? data : []);
        // Se não há aluno seleccionado ou não pertence a esta turma, seleccionar o primeiro
        if (data.length > 0 && (!form.alunoId || !data.find((a: any) => a.id === form.alunoId))) {
          autoKeyRef.current = '';
          set('alunoId', data[0].id);
        }
      })
      .catch(() => setAlunosDaAPI([]))
      .finally(() => setAlunosLoading(false));
  }, [selectedTurmaId]);

  // Auto-detect existing nota when selecting aluno+disciplina in new-launch mode
  useEffect(() => {
    if (nota) return; // already editing a specific nota — skip
    const key = `${form.alunoId}|${form.disciplina}|${trimestre}`;
    if (autoKeyRef.current === key) return;
    autoKeyRef.current = key;
    if (!form.alunoId || !form.disciplina) { setAutoNota(null); return; }
    const found = allNotas.find(
      n => n.alunoId === form.alunoId && n.disciplina === form.disciplina && n.trimestre === trimestre
    ) ?? null;
    setAutoNota(found);
    if (found) {
      setForm({ ...found, lancamentos: found.lancamentos || buildEmptyLanc() });
    }
  }, [form.alunoId, form.disciplina, trimestre, nota, allNotas]);

  // Students who already have a nota for the selected disciplina+trimestre
  const alunosComNota = useMemo(() => {
    const s = new Set<string>();
    allNotas.forEach(n => {
      if (n.disciplina === form.disciplina && n.trimestre === trimestre) s.add(n.alunoId);
    });
    return s;
  }, [allNotas, form.disciplina, trimestre]);

  // Usar alunos da API se disponíveis, senão fallback para prop
  const alunosDaTurma = alunosDaAPI.length > 0
    ? alunosDaAPI
    : alunos.filter((a: any) => (!selectedTurmaId || a.turmaId === selectedTurmaId) && !a.bloqueado && !a.falecido);

  const alunosDaTurmaFiltered = alunoSearch.trim()
    ? alunosDaTurma.filter((a: any) =>
        `${a.nome} ${a.apelido}`.toLowerCase().includes(alunoSearch.toLowerCase()) ||
        (a.numeroMatricula || '').toLowerCase().includes(alunoSearch.toLowerCase())
      )
    : alunosDaTurma;

  const disciplinasFiltradas = disciplinaSearch.trim()
    ? disciplinas.filter(d => d.toLowerCase().includes(disciplinaSearch.toLowerCase()))
    : disciplinas;

  const lanc = form.lancamentos || buildEmptyLanc();

  function handleSave(asFinal: boolean) {
    if (!form.alunoId || !form.disciplina) {
      webAlert('Campos obrigatórios', 'Seleccione aluno e disciplina.');
      return;
    }
    const avalVals = activeAvalKeys.map(k => (form[k as keyof Nota] as number) || 0);
    if (avalVals.some(v => v > 5)) {
      webAlert('Nota inválida', 'As avaliações contínuas (AVAL) têm escala de 1 a 5. Corrija os valores antes de guardar.');
      return;
    }
    const provaVals = [form.pp1 || 0, form.ppt || 0];
    if (provaVals.some(v => v > 20)) {
      webAlert('Nota inválida', 'As provas (PP / PT) têm escala de 0 a 20. Corrija os valores antes de guardar.');
      return;
    }
    const hasAny = Object.values(lanc).some(Boolean);
    if (!hasAny && asFinal) {
      webAlert('Sem dados', 'Introduza pelo menos uma avaliação antes de guardar.');
      return;
    }
    const parcial = !isComplete();
    onSave({ ...form, turmaId: selectedAluno?.turmaId || selectedTurmaId || '', trimestre }, parcial && !asFinal ? true : parcial);
  }

  const mac1 = form.mac1 || 0;
  const mt1 = form.mt1 || 0;
  const nf = form.nf || 0;

  const avaisRegistadas = activeAvalKeys.filter(k => !!(lanc[k as keyof NotaLancamentos])).length;
  const avaisCompletas = avaisRegistadas === numAvaliacoes;

  function isComplete() {
    const avaisOk = avaisCompletas;
    const pp1Ok = !pp1Habilitado || lanc.pp1;
    const pptOk = !pptHabilitado || lanc.ppt;
    return avaisOk && pp1Ok && pptOk;
  }

  const completo = isComplete();
  const temAlgumDado = Object.values(lanc).some(Boolean);

  const mt1Label = (): string => {
    const parts: string[] = ['MAC'];
    if (pp1Habilitado) parts.push('PP');
    if (pptHabilitado) parts.push('PT');
    return `(${parts.join(' + ')}) / ${parts.length}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={[mS.sheet, { paddingBottom: bottomPad + 16 }]}>
          <View style={mS.header}>
            <View style={mS.headerLeft}>
              <Text style={mS.title}>{effectiveNota ? 'Editar Nota' : 'Lançar Nota'}</Text>
              <View style={mS.trimBadge}>
                <Text style={mS.trimBadgeText}>{trimestre}º Trim.</Text>
              </View>
              {effectiveNota && !completo && (
                <View style={mS.parcialBadge}>
                  <Text style={mS.parcialBadgeText}>Em curso</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Auto-detected existing nota banner */}
          {autoNota && !nota && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.info + '18', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.info + '40' }}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.info} />
              <Text style={{ flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 16 }}>
                Este aluno já tem nota lançada para esta disciplina. O formulário foi pré-preenchido com os dados existentes.
              </Text>
            </View>
          )}

          {/* Locked fields notice */}
          {isEditingExisting && Object.values(lanc).some(Boolean) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warning + '18', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: Colors.warning + '40' }}>
              <Ionicons name="lock-closed-outline" size={14} color={Colors.warning} />
              <Text style={{ flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.warning, lineHeight: 16 }}>
                Campos já lançados estão bloqueados. Toque num campo bloqueado para mais informação.
              </Text>
            </View>
          )}

          {/* Progress indicator */}
          <View style={mS.progressRow}>
            {activeAvalKeys.map((k) => (
              <View key={k} style={[mS.progressDot, !!(lanc[k as keyof NotaLancamentos]) && mS.progressDotDone]} />
            ))}
            <View style={mS.progressSep} />
            {pp1Habilitado && (
              <View style={[mS.progressDot, { backgroundColor: Colors.info + '40' }, lanc.pp1 && { backgroundColor: Colors.info }]} />
            )}
            {pptHabilitado && (
              <View style={[mS.progressDot, { backgroundColor: Colors.accent + '40' }, lanc.ppt && { backgroundColor: Colors.accent }]} />
            )}
            <Text style={mS.progressText}>
              {avaisRegistadas}/{numAvaliacoes} AVAL {pp1Habilitado && (lanc.pp1 ? '· PP ✓' : '· PP —')} {pptHabilitado && (lanc.ppt ? '· PT ✓' : '· PT —')}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Turma */}
            {turmas.length > 0 && (
              <View style={mS.field}>
                <Text style={mS.fieldLabel}>Turma / Classe</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={mS.chips}>
                    {turmas.map((t: any) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[mS.chip, selectedTurmaId === t.id && mS.chipActive]}
                        onPress={() => {
                          setAlunosDaAPI([]);
                          setAlunoSearch('');
                          set('alunoId', '');
                          setSelectedTurmaId(t.id);
                        }}
                      >
                        <Text style={[mS.chipText, selectedTurmaId === t.id && mS.chipTextActive]}>{t.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Aluno */}
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Aluno</Text>
              <View style={mS.searchBox}>
                <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
                <TextInput
                  style={mS.searchInput}
                  placeholder="Pesquisar aluno..."
                  placeholderTextColor={Colors.textMuted}
                  value={alunoSearch}
                  onChangeText={setAlunoSearch}
                  autoCorrect={false}
                />
                {alunoSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setAlunoSearch('')}>
                    <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={mS.pickerList}>
                {!alunosLoading && alunosDaTurmaFiltered.map((a: any) => {
                  const jaLancado = alunosComNota.has(a.id);
                  const isSelected = form.alunoId === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[mS.pickerRow, isSelected && mS.pickerRowActive]}
                      onPress={() => { autoKeyRef.current = ''; set('alunoId', a.id); }}
                      activeOpacity={0.75}
                    >
                      <View style={[mS.pickerAvatar, { backgroundColor: a.genero === 'F' ? Colors.accent + '30' : Colors.info + '30' }]}>
                        <Text style={[mS.pickerAvatarText, { color: a.genero === 'F' ? Colors.accent : Colors.info }]}>
                          {(a.nome || '').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[mS.pickerRowName, isSelected && { color: Colors.goldLight }]} numberOfLines={1}>
                          {a.nome} {a.apelido}
                        </Text>
                        {a.numeroMatricula ? (
                          <Text style={mS.pickerRowSub}>Nº {a.numeroMatricula}</Text>
                        ) : null}
                      </View>
                      {jaLancado && (
                        <View style={mS.pickerBadge}>
                          <Ionicons name="checkmark-circle" size={14} color={isSelected ? Colors.goldLight : Colors.success} />
                          <Text style={[mS.pickerBadgeText, { color: isSelected ? Colors.goldLight : Colors.success }]}>Nota lançada</Text>
                        </View>
                      )}
                      {isSelected && !jaLancado && (
                        <Ionicons name="radio-button-on" size={16} color={Colors.gold} />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {alunosLoading && (
                  <View style={mS.pickerEmpty}>
                    <ActivityIndicator size="small" color={Colors.gold} />
                    <Text style={[mS.pickerEmptyText, { marginTop: 8 }]}>A carregar alunos...</Text>
                  </View>
                )}
                {!alunosLoading && alunosDaTurmaFiltered.length === 0 && (
                  <View style={mS.pickerEmpty}>
                    <Ionicons name="person-outline" size={22} color={Colors.textMuted} />
                    <Text style={mS.pickerEmptyText}>
                      {alunoSearch ? 'Nenhum aluno encontrado' : 'Nenhum aluno nesta turma'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Disciplina */}
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Disciplina</Text>
              <View style={mS.searchBox}>
                <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
                <TextInput
                  style={mS.searchInput}
                  placeholder="Pesquisar disciplina..."
                  placeholderTextColor={Colors.textMuted}
                  value={disciplinaSearch}
                  onChangeText={setDisciplinaSearch}
                  autoCorrect={false}
                />
                {disciplinaSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setDisciplinaSearch('')}>
                    <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={mS.pickerList}>
                {disciplinasFiltradas.map(d => {
                  const isSelected = form.disciplina === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[mS.pickerRow, isSelected && mS.pickerRowActive]}
                      onPress={() => set('disciplina', d)}
                      activeOpacity={0.75}
                    >
                      <View style={[mS.pickerAvatar, { backgroundColor: Colors.gold + '22' }]}>
                        <Ionicons name="book-outline" size={14} color={Colors.gold} />
                      </View>
                      <Text style={[mS.pickerRowName, isSelected && { color: Colors.goldLight }]} numberOfLines={1}>{d}</Text>
                      {isSelected && <Ionicons name="radio-button-on" size={16} color={Colors.gold} />}
                    </TouchableOpacity>
                  );
                })}
                {disciplinasFiltradas.length === 0 && (
                  <View style={mS.pickerEmpty}>
                    <Text style={mS.pickerEmptyText}>Nenhuma disciplina encontrada</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bloco AVAL */}
            <View style={mS.blockCard}>
              <View style={mS.blockHeader}>
                <View style={mS.blockDot} />
                <Text style={mS.blockTitle}>Avaliações Contínuas</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ backgroundColor: Colors.gold + '22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.gold + '44' }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.goldLight }}>Escala 1–5</Text>
                  </View>
                  <Text style={mS.blockSub}>{avaisRegistadas}/{numAvaliacoes} registadas</Text>
                </View>
              </View>
              <View style={mS.gradesGrid}>
                {activeAvalKeys.map((key, i) => {
                  const wasLanc = !!(lanc[key as keyof NotaLancamentos]);
                  const prevLanc = i === 0 ? true : !!(lanc[activeAvalKeys[i - 1] as keyof NotaLancamentos]);
                  const isLocked = isEditingExisting && wasLanc && !camposAbertos.includes(key);
                  const isSequentialLocked = !wasLanc && !prevLanc;
                  const isPending = isEditingExisting && wasLanc && isLocked && hasPendingRequest(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={isLocked ? 0.7 : isSequentialLocked ? 1 : 1}
                      onPress={isLocked ? () => openLockedField(key, `AVAL ${i + 1}`) : undefined}
                      style={{ flex: 1, opacity: isSequentialLocked ? 0.35 : 1 }}
                    >
                      <GradeInput
                        label={`AVAL ${i + 1}`}
                        value={(form[key as keyof Nota] as number) || 0}
                        onChange={(isLocked || isSequentialLocked) ? undefined : v => set(key as keyof Nota, v)}
                        registered={wasLanc}
                        readonly={isLocked || isSequentialLocked}
                        pending={isPending}
                        max={5}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!avaisCompletas && avaisRegistadas > 0 && (
                <View style={mS.infoBox}>
                  <Ionicons name="time-outline" size={13} color={Colors.info} />
                  <Text style={mS.infoBoxText}>
                    {avaisRegistadas} de {numAvaliacoes} avaliações registadas. Pode guardar e continuar mais tarde.
                  </Text>
                </View>
              )}

              <View style={[mS.calcResult, avaisCompletas && { borderColor: Colors.gold + '60', backgroundColor: Colors.gold + '0E' }]}>
                <View style={mS.calcResultLeft}>
                  <Text style={mS.calcResultLbl}>MAC</Text>
                  <Text style={mS.calcResultDesc}>
                    {avaisCompletas ? `Média das ${numAvaliacoes} Avaliações` : avaisRegistadas > 0 ? `Parcial (${avaisRegistadas} AVAL)` : 'Aguarda avaliações'}
                  </Text>
                </View>
                <View style={mS.calcResultRight}>
                  <Text style={[mS.calcResultVal, { color: mac1 > 0 ? gradeColor(mac1) : Colors.textMuted }]}>
                    {mac1 > 0 ? mac1.toFixed(1) : '—'}
                  </Text>
                  <Text style={mS.calcResultSub}>/ 20</Text>
                </View>
              </View>
            </View>

            {/* Bloco Provas */}
            {(pp1Habilitado || pptHabilitado) && (
              <View style={[mS.blockCard, !avaisCompletas && { opacity: 0.5 }]}>
                <View style={mS.blockHeader}>
                  <View style={[mS.blockDot, { backgroundColor: Colors.info }]} />
                  <Text style={mS.blockTitle}>Provas do Trimestre</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {!avaisCompletas && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warning + '20', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Ionicons name="lock-closed-outline" size={10} color={Colors.warning} />
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.warning }}>Aguarda AVALs</Text>
                      </View>
                    )}
                    <Text style={mS.blockSub}>Escala 0–20</Text>
                  </View>
                </View>
                <View style={mS.gradesGrid}>
                  {pp1Habilitado && (() => {
                    const wasLanc = lanc.pp1;
                    const isLocked = isEditingExisting && wasLanc && !camposAbertos.includes('pp1');
                    const isDisabled = !avaisCompletas && !wasLanc;
                    const isPending = isEditingExisting && wasLanc && isLocked && hasPendingRequest('pp1');
                    return (
                      <TouchableOpacity
                        activeOpacity={isLocked ? 0.7 : 1}
                        onPress={isLocked ? () => openLockedField('pp1', 'PP (Prova do Professor)') : undefined}
                        style={{ flex: 1 }}
                      >
                        <GradeInput label="PP" value={form.pp1 || 0} onChange={(isLocked || isDisabled) ? undefined : v => set('pp1', v)} registered={wasLanc} readonly={isLocked || isDisabled} pending={isPending} />
                      </TouchableOpacity>
                    );
                  })()}
                  {pptHabilitado && (() => {
                    const wasLanc = lanc.ppt;
                    const isLocked = isEditingExisting && wasLanc && !camposAbertos.includes('ppt');
                    const isDisabled = !avaisCompletas && !wasLanc;
                    const isPending = isEditingExisting && wasLanc && isLocked && hasPendingRequest('ppt');
                    return (
                      <TouchableOpacity
                        activeOpacity={isLocked ? 0.7 : 1}
                        onPress={isLocked ? () => openLockedField('ppt', 'PT (Prova de Trimestre)') : undefined}
                        style={{ flex: 1 }}
                      >
                        <GradeInput label="PT" value={form.ppt || 0} onChange={(isLocked || isDisabled) ? undefined : v => set('ppt', v)} registered={wasLanc} readonly={isLocked || isDisabled} pending={isPending} />
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </View>
            )}

            {!(pp1Habilitado || pptHabilitado) && (
              <View style={mS.disabledProvasBox}>
                <Ionicons name="close-circle-outline" size={16} color={Colors.textMuted} />
                <Text style={mS.disabledProvasText}>PP e PT desactivadas nas Configurações Gerais</Text>
              </View>
            )}

            {/* MT1 + NF Results */}
            <View style={mS.resultBlock}>
              <View style={[mS.resultCard, { borderColor: Colors.info + '50' }]}>
                <Text style={mS.resultLbl}>MT 1</Text>
                <Text style={mS.resultSublbl}>Média Total</Text>
                <Text style={[mS.resultVal, { color: mt1 > 0 ? gradeColor(mt1) : Colors.textMuted }]}>
                  {mt1 > 0 ? mt1.toFixed(1) : '—'}
                </Text>
              </View>
              <View style={[mS.resultCard, mS.resultCardMain, { borderColor: (nf >= 10 ? Colors.success : Colors.accent) + '70' }]}>
                <Text style={mS.resultLbl}>NF</Text>
                <Text style={mS.resultSublbl}>Nota Final</Text>
                <Text style={[mS.resultValMain, { color: nf > 0 ? gradeColor(nf) : Colors.textMuted }]}>
                  {nf > 0 ? nf.toFixed(1) : '—'}
                </Text>
                {nf > 0 && (
                  <Text style={[mS.resultGrade, { color: gradeColor(nf) }]}>{gradeLabel(nf)}</Text>
                )}
              </View>
            </View>

            {(mac1 > 0 || mt1 > 0) && (
              <View style={mS.formulaCard}>
                <Text style={mS.formulaTitle}>Cálculo</Text>
                {avaisCompletas ? (
                  <Text style={mS.formulaLine}>
                    MAC = ({activeAvalKeys.map((_, i) => `AVAL${i+1}`).join('+')}){' '}/ {numAvaliacoes} = <Text style={mS.formulaVal}>{mac1.toFixed(1)}</Text>
                  </Text>
                ) : (
                  <Text style={mS.formulaLine}>
                    MAC parcial ({avaisRegistadas} avaliações) = <Text style={mS.formulaVal}>{mac1 > 0 ? mac1.toFixed(1) : '—'}</Text>
                  </Text>
                )}
                {mt1 > 0 && (
                  <>
                    <Text style={mS.formulaLine}>
                      MT1 = {mt1Label()} = <Text style={mS.formulaVal}>{mt1.toFixed(1)}</Text>
                    </Text>
                    <Text style={mS.formulaLine}>
                      NF = MT1 = <Text style={[mS.formulaVal, { color: gradeColor(nf) }]}>{nf.toFixed(1)}</Text>
                    </Text>
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* Buttons */}
          <View style={mS.btnRow}>
            {!completo && temAlgumDado && (
              <TouchableOpacity style={mS.saveBtnPartial} onPress={() => handleSave(false)}>
                <Ionicons name="save-outline" size={18} color={Colors.gold} />
                <Text style={mS.saveBtnPartialText}>Guardar Progresso</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[mS.saveBtn, { flex: completo || !temAlgumDado ? 1 : 0.6 }]}
              onPress={() => handleSave(true)}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={mS.saveBtnText}>
                {effectiveNota
                  ? completo ? 'Actualizar Nota' : 'Actualizar'
                  : completo ? 'Lançar Nota' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Modal de Solicitação de Reabertura */}
      <Modal visible={!!reaberturaModal} transparent animationType="fade" onRequestClose={() => setReaberturaModal(null)}>
        <View style={mS.reaOverlay}>
          <View style={mS.reaCard}>
            <View style={mS.reaHeader}>
              <Ionicons name="lock-closed" size={20} color={Colors.warning} />
              <Text style={mS.reaTitle}>Solicitar Reabertura</Text>
            </View>
            <Text style={mS.reaSubtitle}>Campo: <Text style={{ fontWeight: '700' }}>{reaberturaModal?.label}</Text></Text>
            <Text style={mS.reaDesc}>
              Este campo já foi lançado e está bloqueado. Para efectuar correcções, indique o motivo abaixo.
              O pedido será enviado à direcção para aprovação.
            </Text>
            <TextInput
              style={mS.reaInput}
              placeholder="Motivo da reabertura..."
              placeholderTextColor={Colors.textMuted}
              value={reaberturaMotivo}
              onChangeText={setReaberturaMotivo}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            <Text style={mS.reaCount}>{reaberturaMotivo.length}/300</Text>
            <View style={mS.reaActions}>
              <TouchableOpacity style={mS.reaCancelBtn} onPress={() => setReaberturaModal(null)}>
                <Text style={mS.reaCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mS.reaSubmitBtn, isSubmittingRea && { opacity: 0.6 }]} onPress={submitReabertura} disabled={isSubmittingRea}>
                <Ionicons name="send" size={15} color="#fff" />
                <Text style={mS.reaSubmitText}>{isSubmittingRea ? 'A enviar...' : 'Enviar Pedido'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function mtl1Label(pp1On: boolean, pptOn: boolean): string {
  const parts: string[] = ['MAC'];
  if (pp1On) parts.push('PP');
  if (pptOn) parts.push('PT');
  return `(${parts.join('+')} )/${parts.length}`;
}

export default function NotasScreen() {
  const { notas, alunos, turmas, professores, addNota, updateNota } = useData();
  const { user } = useAuth();
  const { config } = useConfig();
  const insets = useSafeAreaInsets();
  const [trimestreActivo, setTrimestreActivo] = useState<1 | 2 | 3>(1);
  const [filterTurma, setFilterTurma] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editNota, setEditNota] = useState<Nota | null>(null);
  const [continuidade, setContinuidade] = useState<{ alunoId: string; alunoNome: string } | null>(null);
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const isProfessor = user?.role === 'professor';
  const isPrivilegedRole = !!user?.role && ['ceo', 'pca', 'admin', 'director', 'chefe_secretaria'].includes(user.role);

  const prazoKey = `t${trimestreActivo}` as 't1' | 't2' | 't3';
  const prazoData: string | undefined = (config.prazosLancamento as any)?.[prazoKey];
  const prazoEncerrado = prazoData ? new Date() > new Date(prazoData + 'T23:59:59') : false;
  const podeEditar = isPrivilegedRole || !prazoEncerrado;

  const professorActual = useMemo(() => {
    if (!isProfessor || !user) return null;
    return professores.find(p => p.id === user.id || p.email === user.email) || null;
  }, [isProfessor, user, professores]);

  const turmasDoProf = useMemo(() => {
    if (isPrivilegedRole) return turmas.filter(t => t.ativo !== false);
    if (!isProfessor || !professorActual) return turmas.filter(t => t.ativo !== false);
    return turmas.filter(t => professorActual.turmasIds.includes(t.id));
  }, [isProfessor, professorActual, turmas, isPrivilegedRole]);

  const { items: disciplinasLookupItems } = useLookup('disciplinas_fallback', [
    'Matemática', 'Português', 'Física', 'Química', 'Biologia',
    'História', 'Geografia', 'Inglês', 'Educação Física', 'Filosofia',
  ]);
  // Stable reference — items from useState is stable; .map() creates new refs every render so we memo it
  const disciplinasFallback = useMemo(
    () => disciplinasLookupItems.map(i => i.valor),
    [disciplinasLookupItems]
  );

  const [disciplinasDisponiveis, setDisciplinasDisponiveis] = useState<string[]>([
    'Matemática', 'Português', 'Física', 'Química', 'Biologia',
    'História', 'Geografia', 'Inglês', 'Educação Física', 'Filosofia',
  ]);
  useEffect(() => {
    const turmaParaFetch = filterTurma || (turmasDoProf.length === 1 ? turmasDoProf[0].id : '');
    if (!turmaParaFetch) {
      if (isProfessor && professorActual && professorActual.disciplinas.length > 0) {
        setDisciplinasDisponiveis(professorActual.disciplinas);
      } else {
        setDisciplinasDisponiveis(disciplinasFallback);
      }
      return;
    }
    fetch(`/api/turmas/${turmaParaFetch}/disciplinas`)
      .then(r => r.json())
      .then((list: { nome: string }[]) => {
        if (list && list.length > 0) {
          setDisciplinasDisponiveis(list.map(d => d.nome));
        } else if (isProfessor && professorActual && professorActual.disciplinas.length > 0) {
          setDisciplinasDisponiveis(professorActual.disciplinas);
        } else {
          setDisciplinasDisponiveis(disciplinasFallback);
        }
      })
      .catch(() => {
        if (isProfessor && professorActual && professorActual.disciplinas.length > 0) {
          setDisciplinasDisponiveis(professorActual.disciplinas);
        } else {
          setDisciplinasDisponiveis(disciplinasFallback);
        }
      });
  }, [filterTurma, turmasDoProf, isProfessor, professorActual, disciplinasFallback]);

  const alunosDisponiveis = useMemo(() => {
    const base = (a: any) => a.ativo && !a.bloqueado && !a.falecido;
    if (isPrivilegedRole) return alunos.filter(base);
    if (!isProfessor || !professorActual) return alunos.filter(base);
    const turmaIds = new Set(professorActual.turmasIds);
    return alunos.filter(a => base(a) && turmaIds.has(a.turmaId));
  }, [isProfessor, professorActual, alunos, isPrivilegedRole]);

  const filtered = useMemo(() => {
    return notas.filter(n => {
      const aluno = alunos.find(a => a.id === n.alunoId);
      const turmaMatch = !filterTurma || aluno?.turmaId === filterTurma || n.turmaId === filterTurma;
      const trimestreMatch = n.trimestre === trimestreActivo;
      if (isProfessor && professorActual) {
        const profTurmaIds = new Set(professorActual.turmasIds);
        const profTurmaMatch = aluno ? profTurmaIds.has(aluno.turmaId) || profTurmaIds.has(n.turmaId) : profTurmaIds.has(n.turmaId);
        const discMatch = professorActual.disciplinas.length === 0 || professorActual.disciplinas.includes(n.disciplina);
        return trimestreMatch && turmaMatch && profTurmaMatch && discMatch;
      }
      return trimestreMatch && turmaMatch;
    });
  }, [notas, trimestreActivo, filterTurma, alunos, isProfessor, professorActual]);

  async function handleSave(form: Partial<Nota>, parcial: boolean) {
    const notaId = editNota?.id ?? form.id;
    if (notaId) {
      await updateNota(notaId, form);
    } else {
      await addNota(form as any);
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (parcial) {
      alertSucesso('Progresso guardado', 'Pode continuar a preencher as restantes avaliações mais tarde.');
    } else {
      alertSucesso(editNota ? 'Nota actualizada' : 'Nota lançada', 'As avaliações foram guardadas com sucesso.');
    }
    setShowForm(false);
    setEditNota(null);
  }

  const renderNota = ({ item }: { item: Nota }) => {
    const aluno = alunos.find(a => a.id === item.alunoId);
    const turma = turmas.find(t => t.id === item.turmaId);
    const nf = item.nf ?? item.mac ?? 0;
    const color = gradeColor(nf);
    const aprovado = nf >= 10;
    const lanc = item.lancamentos || buildEmptyLanc();
    const numAval = config.numAvaliacoes ?? 4;
    const activeKeys = ALL_AVAL_KEYS.slice(0, numAval);
    const avaisReg = activeKeys.filter(k => !!(lanc[k as keyof NotaLancamentos])).length;
    const pp1Reg = !config.pp1Habilitado || lanc.pp1;
    const pptReg = !config.pptHabilitado || lanc.ppt;
    const isParcial = avaisReg < numAval || !pp1Reg || !pptReg;

    return (
      <TouchableOpacity
        style={[styles.card, isParcial && { borderColor: Colors.warning + '50', borderStyle: 'dashed' }]}
        onPress={() => {
          if (!podeEditar) return;
          setEditNota(item);
          setShowForm(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <View style={styles.cardTopRow}>
            <Text style={styles.alunoNome}>{aluno?.nome} {aluno?.apelido}</Text>
            <TouchableOpacity
              style={styles.continuidadeIconBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                if (aluno) setContinuidade({ alunoId: aluno.id, alunoNome: `${aluno.nome} ${aluno.apelido}` });
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="git-branch-outline" size={13} color={Colors.info} />
            </TouchableOpacity>
            {isParcial ? (
              <View style={styles.parcialBadgeCard}>
                <Ionicons name="time-outline" size={11} color={Colors.warning} />
                <Text style={styles.parcialBadgeCardText}>Em curso</Text>
              </View>
            ) : (
              <View style={[styles.statusDot, { backgroundColor: aprovado ? Colors.success : Colors.accent }]} />
            )}
          </View>
          <Text style={styles.cardMeta}>
            {item.disciplina} · {turma?.nome}
          </Text>
          <View style={styles.cardValues}>
            {activeKeys.map((k, i) => (
              <View key={k} style={[styles.valPill, !!(lanc[k as keyof NotaLancamentos]) && { borderColor: Colors.success + '50', backgroundColor: Colors.success + '0A' }]}>
                <Text style={styles.valKey}>A{i + 1}</Text>
                <Text style={[styles.valNum, !(lanc[k as keyof NotaLancamentos]) && { color: Colors.textMuted }]}>
                  {!!(lanc[k as keyof NotaLancamentos]) ? ((item[k as keyof Nota] as number) ?? 0).toFixed(1) : '—'}
                </Text>
              </View>
            ))}
            <View style={[styles.valPill, { borderColor: Colors.gold + '50' }]}>
              <Text style={styles.valKey}>MAC</Text>
              <Text style={styles.valNum}>{(item.mac1 ?? 0) > 0 ? (item.mac1 ?? 0).toFixed(1) : '—'}</Text>
            </View>
            {config.pp1Habilitado && (
              <View style={[styles.valPill, lanc.pp1 && { borderColor: Colors.info + '50' }]}>
                <Text style={styles.valKey}>PP</Text>
                <Text style={[styles.valNum, !lanc.pp1 && { color: Colors.textMuted }]}>
                  {lanc.pp1 ? (item.pp1 ?? 0) : '—'}
                </Text>
              </View>
            )}
            {config.pptHabilitado && (
              <View style={[styles.valPill, lanc.ppt && { borderColor: Colors.info + '50' }]}>
                <Text style={styles.valKey}>PT</Text>
                <Text style={[styles.valNum, !lanc.ppt && { color: Colors.textMuted }]}>
                  {lanc.ppt ? (item.ppt ?? 0) : '—'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          {!podeEditar && (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={10} color={Colors.danger} />
            </View>
          )}
          <View style={[styles.nfBadge, { backgroundColor: isParcial ? Colors.warning + '12' : color + '18', borderColor: isParcial ? Colors.warning + '50' : color + '50' }]}>
            <Text style={styles.nfLabel}>{isParcial ? 'AVAL' : 'NF'}</Text>
            <Text style={[styles.nfVal, { color: isParcial ? Colors.warning : color }]}>
              {isParcial ? `${avaisReg}/${numAval}` : (nf > 0 ? nf.toFixed(1) : '—')}
            </Text>
            <Text style={[styles.nfGrade, { color: isParcial ? Colors.warning : color }]}>
              {isParcial ? 'Parcial' : (nf > 0 ? gradeLabel(nf) : '')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const avgNf = filtered.length > 0
    ? filtered.reduce((s, n) => s + (n.nf ?? n.mac ?? 0), 0) / filtered.length
    : 0;

  return (
    <View style={styles.screen}>
      <TopBar
        title="Notas"
        subtitle="Sistema AVAL → NF"
        rightAction={podeEditar ? { icon: 'add', onPress: () => { setEditNota(null); setShowForm(true); } } : undefined}
      />

      {/* Contexto do Professor */}
      {isProfessor && professorActual && (
        <View style={styles.profContextBar}>
          <Ionicons name="person-circle" size={16} color={Colors.info} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profContextName}>{professorActual.nome} {professorActual.apelido}</Text>
            <Text style={styles.profContextInfo} numberOfLines={1}>
              {professorActual.disciplinas.join(' · ')} · {turmasDoProf.map(t => t.nome).join(', ')}
            </Text>
          </View>
        </View>
      )}
      {isProfessor && !professorActual && (
        <View style={[styles.profContextBar, { backgroundColor: Colors.warning + '20', borderColor: Colors.warning + '50' }]}>
          <Ionicons name="warning-outline" size={16} color={Colors.warning} />
          <Text style={[styles.profContextName, { color: Colors.warning }]}>Sem turmas atribuídas. Contacte a direcção.</Text>
        </View>
      )}

      {/* Banner de Prazo Encerrado */}
      {prazoEncerrado && prazoData && (
        <View style={styles.prazoBanner}>
          <Ionicons name="lock-closed" size={14} color={Colors.danger} />
          <Text style={styles.prazoBannerText}>
            {podeEditar
              ? `Prazo do ${trimestreActivo}º Trimestre encerrado em ${prazoData.split('-').reverse().join('/')} — acesso privilegiado activo.`
              : `Prazo encerrado em ${prazoData.split('-').reverse().join('/')}. Lançamento de notas bloqueado para este trimestre.`}
          </Text>
          {podeEditar && <Ionicons name="shield-checkmark" size={12} color={Colors.success} />}
        </View>
      )}

      {/* Selector de Trimestre */}
      <View style={styles.trimestreBar}>
        {([1, 2, 3] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.trimestreTab, trimestreActivo === t && styles.trimestreTabActive]}
            onPress={() => { setTrimestreActivo(t); setFilterTurma(''); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.trimestreTabText, trimestreActivo === t && styles.trimestreTabTextActive]}>
              {t}º Trimestre
            </Text>
            {trimestreActivo === t && (
              <View style={styles.trimestreIndicator} />
            )}
            <View style={styles.trimestreCount}>
              <Text style={[styles.trimestreCountText, trimestreActivo === t && { color: Colors.gold }]}>
                {notas.filter(n => {
                  if (!isProfessor || !professorActual) return n.trimestre === t;
                  const aluno = alunos.find(a => a.id === n.alunoId);
                  const profTurmaIds = new Set(professorActual.turmasIds);
                  return n.trimestre === t && aluno && profTurmaIds.has(aluno.turmaId) &&
                    (professorActual.disciplinas.length === 0 || professorActual.disciplinas.includes(n.disciplina));
                }).length}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtro por Turma */}
      {turmasDoProf.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.chip, !filterTurma && styles.chipActive]}
            onPress={() => setFilterTurma('')}
          >
            <Text style={[styles.chipText, !filterTurma && styles.chipTextActive]}>Todas as Turmas</Text>
          </TouchableOpacity>
          {turmasDoProf.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.chip, filterTurma === t.id && styles.chipActive]}
              onPress={() => setFilterTurma(filterTurma === t.id ? '' : t.id)}
            >
              <Text style={[styles.chipText, filterTurma === t.id && styles.chipTextActive]}>{t.nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Resumo */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.success }]}>
            {filtered.filter(n => (n.nf ?? n.mac ?? 0) >= 10).length}
          </Text>
          <Text style={styles.summaryLabel}>Aprovados</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.accent }]}>
            {filtered.filter(n => (n.nf ?? n.mac ?? 0) < 10 && (n.nf ?? n.mac ?? 0) > 0).length}
          </Text>
          <Text style={styles.summaryLabel}>Reprovados</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.gold }]}>
            {avgNf > 0 ? avgNf.toFixed(1) : '—'}
          </Text>
          <Text style={styles.summaryLabel}>Média NF</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.info }]}>{filtered.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderNota}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Sem notas no {trimestreActivo}º Trimestre</Text>
            <Text style={styles.emptyMsg}>Use o botão + para lançar a primeira nota deste trimestre.</Text>
          </View>
        }
      />

      {showForm && (
        <NotaFormModal
          visible={showForm}
          onClose={() => { setShowForm(false); setEditNota(null); }}
          onSave={handleSave}
          alunos={alunosDisponiveis}
          turmas={turmasDoProf}
          nota={editNota}
          trimestre={trimestreActivo}
          disciplinas={disciplinasDisponiveis}
          professorId={isProfessor && professorActual ? professorActual.id : ''}
          pp1Habilitado={config.pp1Habilitado}
          pptHabilitado={config.pptHabilitado}
          numAvaliacoes={config.numAvaliacoes ?? 4}
          allNotas={notas}
        />
      )}

      {continuidade && (
        <ContinuidadeStatusModal
          visible={!!continuidade}
          onClose={() => setContinuidade(null)}
          alunoId={continuidade.alunoId}
          alunoNome={continuidade.alunoNome}
        />
      )}
    </View>
  );
}

const gS = StyleSheet.create({
  gradeBox: { flex: 1, alignItems: 'center' },
  gradeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  gradeLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  registeredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  gradeInput: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 12,
    fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center',
  },
  gradeReadonly: {
    width: '100%', borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 12, alignItems: 'center', backgroundColor: Colors.surface,
  },
  gradeReadonlyVal: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text },
});

const mS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '94%', width: '100%', maxWidth: 480,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  trimBadge: { backgroundColor: Colors.gold + '25', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: Colors.gold + '50' },
  trimBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.goldLight },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 6 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.gold + '20', borderColor: Colors.gold },
  chipLancado: { borderColor: Colors.success + '60', backgroundColor: Colors.success + '0A' },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  chipTextActive: { color: Colors.goldLight, fontFamily: 'Inter_600SemiBold' },
  blockCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  blockDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gold },
  blockTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, flex: 1 },
  blockSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  gradesGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  calcResult: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.background, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  calcResultLeft: {},
  calcResultLbl: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  calcResultDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  calcResultRight: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  calcResultVal: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  calcResultSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  resultBlock: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  resultCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  resultCardMain: { flex: 1.4, backgroundColor: Colors.backgroundCard },
  resultLbl: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  resultSublbl: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 6 },
  resultVal: { fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  resultValMain: { fontSize: 38, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  resultGrade: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  formulaCard: { backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  formulaTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  formulaLine: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20 },
  formulaVal: { fontFamily: 'Inter_700Bold', color: Colors.gold },
  parcialBadge: { backgroundColor: Colors.warning + '25', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: Colors.warning + '60' },
  parcialBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.warning },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 2, marginBottom: 4 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  progressDotDone: { backgroundColor: Colors.success },
  progressSep: { width: 1, height: 12, backgroundColor: Colors.border, marginHorizontal: 2 },
  progressText: { flex: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.info + '15', borderRadius: 8, padding: 10, marginTop: 8 },
  infoBoxText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 16 },
  disabledProvasBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  disabledProvasText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveBtnPartial: {
    flex: 0.45, backgroundColor: Colors.gold + '18', borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 16, borderWidth: 1, borderColor: Colors.gold + '50',
  },
  saveBtnPartialText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.gold },
  saveBtn: {
    flex: 1, backgroundColor: Colors.gold, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },

  reaOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  reaCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 16,
    padding: 20, width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: Colors.border,
  },
  reaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  reaTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  reaSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 8 },
  reaDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, lineHeight: 18, marginBottom: 14 },
  reaInput: {
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    padding: 12, color: Colors.text, fontSize: 14,
    fontFamily: 'Inter_400Regular', minHeight: 80, textAlignVertical: 'top',
  },
  reaCount: { fontSize: 10, color: Colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 14 },
  reaActions: { flexDirection: 'row', gap: 10 },
  reaCancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  reaCancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  reaSubmitBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.warning,
  },
  reaSubmitText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular',
    color: Colors.text, outlineStyle: 'none' as any,
  },
  pickerList: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerRowActive: {
    backgroundColor: Colors.gold + '18', borderLeftWidth: 3, borderLeftColor: Colors.gold,
  },
  pickerAvatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerAvatarText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  pickerRowName: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  pickerRowSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  pickerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pickerBadgeText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  pickerEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 20 },
  pickerEmptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  trimestreBar: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  trimestreTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    position: 'relative',
  },
  trimestreTabActive: {},
  trimestreTabText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  trimestreTabTextActive: {
    color: Colors.gold,
  },
  trimestreIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 3,
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  trimestreCount: {
    marginTop: 2,
  },
  trimestreCountText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },

  filterScroll: { maxHeight: 44 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.gold + '20', borderColor: Colors.gold },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  chipTextActive: { color: Colors.goldLight, fontFamily: 'Inter_600SemiBold' },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  summaryLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  summarySep: { width: 1, height: 28, backgroundColor: Colors.border },

  list: { padding: 16 },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 10,
  },
  cardLeft: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, gap: 6 },
  continuidadeIconBtn: { padding: 3, borderRadius: 5, backgroundColor: Colors.info + '15' },
  alunoNome: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  cardMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 8 },
  cardValues: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  valPill: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', gap: 4, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  valKey: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted },
  valNum: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text },
  nfBadge: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 10, borderWidth: 1, minWidth: 62 },
  nfLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  nfVal: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  nfGrade: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  parcialBadgeCard: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  parcialBadgeCardText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.warning },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 12, marginBottom: 6, textAlign: 'center' },
  emptyMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  prazoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: Colors.danger + '15',
    borderRadius: 10, borderWidth: 1, borderColor: Colors.danger + '40',
  },
  prazoBannerText: {
    flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium',
    color: Colors.danger, lineHeight: 16,
  },
  lockBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.danger + '22',
    borderWidth: 1, borderColor: Colors.danger + '50',
    alignItems: 'center', justifyContent: 'center',
  },
  profContextBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.info + '15',
    borderBottomWidth: 1, borderBottomColor: Colors.info + '30',
  },
  profContextName: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.info },
  profContextInfo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
});
