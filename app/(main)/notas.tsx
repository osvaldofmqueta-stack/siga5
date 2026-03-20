import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useData, Nota, NotaLancamentos } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import TopBar from '@/components/TopBar';

const DISCIPLINAS = [
  'Matemática', 'Português', 'Física', 'Química', 'Biologia',
  'História', 'Geografia', 'Inglês', 'Educação Física', 'Filosofia', 'Desenho',
];

function calcMac1(a1: number, a2: number, a3: number, a4: number): number {
  return parseFloat(((a1 + a2 + a3 + a4) / 4).toFixed(2));
}

function calcMac1Partial(vals: number[], count: number): number {
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
}: {
  label: string;
  value: number;
  onChange?: (v: number) => void;
  highlight?: boolean;
  readonly?: boolean;
  registered?: boolean;
}) {
  const color = gradeColor(value);
  return (
    <View style={gS.gradeBox}>
      <View style={gS.gradeLabelRow}>
        <Text style={gS.gradeLabel}>{label}</Text>
        {registered && (
          <View style={gS.registeredDot} />
        )}
      </View>
      {readonly ? (
        <View style={[gS.gradeReadonly, highlight && { borderColor: color + '80', backgroundColor: color + '12' }]}>
          <Text style={[gS.gradeReadonlyVal, { color: highlight ? color : Colors.text }]}>
            {value > 0 ? value.toFixed(1) : '—'}
          </Text>
        </View>
      ) : (
        <TextInput
          style={[gS.gradeInput, highlight && { borderColor: Colors.gold + '80' }, registered && { borderColor: Colors.success + '70', backgroundColor: Colors.success + '08' }]}
          value={value === 0 ? '' : String(value)}
          onChangeText={t => {
            const n = parseFloat(t);
            if (!isNaN(n) && n >= 0 && n <= 20) onChange?.(n);
            else if (t === '' || t === '0') onChange?.(0);
          }}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={Colors.textMuted}
          maxLength={4}
          selectTextOnFocus
        />
      )}
    </View>
  );
}

const LANC_KEYS: (keyof NotaLancamentos)[] = ['aval1', 'aval2', 'aval3', 'aval4', 'pp1', 'ppt'];

function buildEmptyLanc(): NotaLancamentos {
  return { aval1: false, aval2: false, aval3: false, aval4: false, pp1: false, ppt: false };
}

function NotaFormModal({
  visible, onClose, onSave, alunos, turmas, nota, trimestre, disciplinas, professorId,
  pp1Habilitado, pptHabilitado,
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
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const makeEmpty = (): Partial<Nota> => ({
    alunoId: alunos[0]?.id || '',
    turmaId: '',
    disciplina: disciplinas[0] || DISCIPLINAS[0],
    trimestre,
    aval1: 0, aval2: 0, aval3: 0, aval4: 0,
    mac1: 0, pp1: 0, ppt: 0, mt1: 0, nf: 0, mac: 0,
    anoLetivo: new Date().getFullYear().toString(),
    professorId,
    data: new Date().toISOString().split('T')[0],
    lancamentos: buildEmptyLanc(),
  });

  const [form, setForm] = useState<Partial<Nota>>(nota ? { ...nota, lancamentos: nota.lancamentos || buildEmptyLanc() } : makeEmpty());

  const set = (k: keyof Nota, v: any) => setForm(f => {
    const next = { ...f, [k]: v };

    if (LANC_KEYS.includes(k as keyof NotaLancamentos)) {
      next.lancamentos = { ...(f.lancamentos || buildEmptyLanc()), [k]: true } as NotaLancamentos;
    }

    const lanc = next.lancamentos || buildEmptyLanc();

    const a1 = next.aval1 || 0;
    const a2 = next.aval2 || 0;
    const a3 = next.aval3 || 0;
    const a4 = next.aval4 || 0;

    const regAvals = [
      lanc.aval1 ? a1 : null,
      lanc.aval2 ? a2 : null,
      lanc.aval3 ? a3 : null,
      lanc.aval4 ? a4 : null,
    ].filter(v => v !== null) as number[];

    const mac1 = regAvals.length === 4
      ? calcMac1(a1, a2, a3, a4)
      : regAvals.length > 0 ? calcMac1Partial(regAvals, regAvals.length) : 0;

    const pp1 = next.pp1 || 0;
    const ppt = next.ppt || 0;
    const mt1 = mac1 > 0 ? calcMt1(mac1, pp1, ppt, pp1Habilitado, pptHabilitado) : 0;
    const nf = mt1;

    return { ...next, mac1, mt1, nf, mac: nf };
  });

  const selectedAluno = alunos.find((a: any) => a.id === form.alunoId);

  React.useEffect(() => {
    if (nota) {
      setForm({ ...nota, lancamentos: nota.lancamentos || buildEmptyLanc() });
    } else {
      setForm({ ...makeEmpty(), trimestre });
    }
  }, [nota, visible, trimestre]);

  const lanc = form.lancamentos || buildEmptyLanc();

  function handleSave(asFinal: boolean) {
    if (!form.alunoId || !form.disciplina) {
      Alert.alert('Campos obrigatórios', 'Seleccione aluno e disciplina.');
      return;
    }
    const vals = [form.aval1, form.aval2, form.aval3, form.aval4, form.pp1, form.ppt];
    if (vals.some(v => (v || 0) > 20)) {
      Alert.alert('Nota inválida', 'Nenhuma nota pode exceder 20 valores.');
      return;
    }
    const hasAny = Object.values(lanc).some(Boolean);
    if (!hasAny && asFinal) {
      Alert.alert('Sem dados', 'Introduza pelo menos uma avaliação antes de guardar.');
      return;
    }
    const parcial = !isComplete();
    onSave({ ...form, turmaId: selectedAluno?.turmaId || '', trimestre }, parcial && !asFinal ? true : parcial);
  }

  const mac1 = form.mac1 || 0;
  const mt1 = form.mt1 || 0;
  const nf = form.nf || 0;

  const avaisRegistadas = [lanc.aval1, lanc.aval2, lanc.aval3, lanc.aval4].filter(Boolean).length;
  const avaisCompletas = avaisRegistadas === 4;

  function isComplete() {
    const avaisOk = avaisCompletas;
    const pp1Ok = !pp1Habilitado || lanc.pp1;
    const pptOk = !pptHabilitado || lanc.ppt;
    return avaisOk && pp1Ok && pptOk;
  }

  const completo = isComplete();
  const temAlgumDado = Object.values(lanc).some(Boolean);

  const mt1Label = (): string => {
    const parts: string[] = ['MAC1'];
    if (pp1Habilitado) parts.push('PP1');
    if (pptHabilitado) parts.push('PPT');
    return `(${parts.join(' + ')}) / ${parts.length}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={[mS.sheet, { paddingBottom: bottomPad + 16 }]}>
          <View style={mS.header}>
            <View style={mS.headerLeft}>
              <Text style={mS.title}>{nota ? 'Editar Nota' : 'Lançar Nota'}</Text>
              <View style={mS.trimBadge}>
                <Text style={mS.trimBadgeText}>{trimestre}º Trim.</Text>
              </View>
              {nota && !completo && (
                <View style={mS.parcialBadge}>
                  <Text style={mS.parcialBadgeText}>Em curso</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Progress indicator */}
          <View style={mS.progressRow}>
            {(['aval1', 'aval2', 'aval3', 'aval4'] as const).map((k) => (
              <View key={k} style={[mS.progressDot, lanc[k] && mS.progressDotDone]} />
            ))}
            <View style={mS.progressSep} />
            {pp1Habilitado && (
              <View style={[mS.progressDot, { backgroundColor: Colors.info + '40' }, lanc.pp1 && { backgroundColor: Colors.info }]} />
            )}
            {pptHabilitado && (
              <View style={[mS.progressDot, { backgroundColor: Colors.accent + '40' }, lanc.ppt && { backgroundColor: Colors.accent }]} />
            )}
            <Text style={mS.progressText}>
              {avaisRegistadas}/4 AVAL {pp1Habilitado && (lanc.pp1 ? '· PP1 ✓' : '· PP1 —')} {pptHabilitado && (lanc.ppt ? '· PPT ✓' : '· PPT —')}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Aluno */}
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Aluno</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={mS.chips}>
                  {alunos.map((a: any) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[mS.chip, form.alunoId === a.id && mS.chipActive]}
                      onPress={() => set('alunoId', a.id)}
                    >
                      <Text style={[mS.chipText, form.alunoId === a.id && mS.chipTextActive]}>
                        {a.nome} {a.apelido}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Disciplina */}
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Disciplina</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={mS.chips}>
                  {disciplinas.map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[mS.chip, form.disciplina === d && mS.chipActive]}
                      onPress={() => set('disciplina', d)}
                    >
                      <Text style={[mS.chipText, form.disciplina === d && mS.chipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Bloco AVAL */}
            <View style={mS.blockCard}>
              <View style={mS.blockHeader}>
                <View style={mS.blockDot} />
                <Text style={mS.blockTitle}>Avaliações Contínuas</Text>
                <Text style={mS.blockSub}>{avaisRegistadas}/4 registadas</Text>
              </View>
              <View style={mS.gradesGrid}>
                <GradeInput label="AVAL 1" value={form.aval1 || 0} onChange={v => set('aval1', v)} registered={lanc.aval1} />
                <GradeInput label="AVAL 2" value={form.aval2 || 0} onChange={v => set('aval2', v)} registered={lanc.aval2} />
                <GradeInput label="AVAL 3" value={form.aval3 || 0} onChange={v => set('aval3', v)} registered={lanc.aval3} />
                <GradeInput label="AVAL 4" value={form.aval4 || 0} onChange={v => set('aval4', v)} registered={lanc.aval4} />
              </View>

              {!avaisCompletas && avaisRegistadas > 0 && (
                <View style={mS.infoBox}>
                  <Ionicons name="time-outline" size={13} color={Colors.info} />
                  <Text style={mS.infoBoxText}>
                    {avaisRegistadas} de 4 avaliações registadas. Pode guardar e continuar mais tarde.
                  </Text>
                </View>
              )}

              <View style={[mS.calcResult, avaisCompletas && { borderColor: Colors.gold + '60', backgroundColor: Colors.gold + '0E' }]}>
                <View style={mS.calcResultLeft}>
                  <Text style={mS.calcResultLbl}>MAC 1</Text>
                  <Text style={mS.calcResultDesc}>
                    {avaisCompletas ? 'Média das 4 Avaliações' : avaisRegistadas > 0 ? `Parcial (${avaisRegistadas} AVAL)` : 'Aguarda avaliações'}
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
              <View style={mS.blockCard}>
                <View style={mS.blockHeader}>
                  <View style={[mS.blockDot, { backgroundColor: Colors.info }]} />
                  <Text style={mS.blockTitle}>Provas do Trimestre</Text>
                  <Text style={mS.blockSub}>Escala 0–20</Text>
                </View>
                <View style={mS.gradesGrid}>
                  {pp1Habilitado && (
                    <GradeInput label="PP 1" value={form.pp1 || 0} onChange={v => set('pp1', v)} registered={lanc.pp1} />
                  )}
                  {pptHabilitado && (
                    <GradeInput label="PPT" value={form.ppt || 0} onChange={v => set('ppt', v)} registered={lanc.ppt} />
                  )}
                </View>
              </View>
            )}

            {!(pp1Habilitado || pptHabilitado) && (
              <View style={mS.disabledProvasBox}>
                <Ionicons name="close-circle-outline" size={16} color={Colors.textMuted} />
                <Text style={mS.disabledProvasText}>PP1 e PPT desactivadas nas Configurações Gerais</Text>
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
                    MAC1 = (AVAL1+AVAL2+AVAL3+AVAL4) / 4 = <Text style={mS.formulaVal}>{mac1.toFixed(1)}</Text>
                  </Text>
                ) : (
                  <Text style={mS.formulaLine}>
                    MAC1 parcial ({avaisRegistadas} avaliações) = <Text style={mS.formulaVal}>{mac1 > 0 ? mac1.toFixed(1) : '—'}</Text>
                  </Text>
                )}
                {mt1 > 0 && (
                  <>
                    <Text style={mS.formulaLine}>
                      MT1 = {mtl1Label(pp1Habilitado, pptHabilitado)} = <Text style={mS.formulaVal}>{mt1.toFixed(1)}</Text>
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
                {nota
                  ? completo ? 'Actualizar Nota' : 'Actualizar'
                  : completo ? 'Lançar Nota' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function mtl1Label(pp1On: boolean, pptOn: boolean): string {
  const parts: string[] = ['MAC1'];
  if (pp1On) parts.push('PP1');
  if (pptOn) parts.push('PPT');
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
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const isProfessor = user?.role === 'professor';

  const professorActual = useMemo(() => {
    if (!isProfessor || !user) return null;
    return professores.find(p => p.id === user.id) || null;
  }, [isProfessor, user, professores]);

  const turmasDoProf = useMemo(() => {
    if (!isProfessor || !professorActual) return turmas;
    return turmas.filter(t => professorActual.turmasIds.includes(t.id));
  }, [isProfessor, professorActual, turmas]);

  const disciplinasDisponiveis = useMemo(() => {
    if (!isProfessor || !professorActual) return DISCIPLINAS;
    return professorActual.disciplinas.length > 0 ? professorActual.disciplinas : DISCIPLINAS;
  }, [isProfessor, professorActual]);

  const alunosDisponiveis = useMemo(() => {
    if (!isProfessor || !professorActual) return alunos.filter(a => a.ativo);
    const turmaIds = new Set(professorActual.turmasIds);
    return alunos.filter(a => a.ativo && turmaIds.has(a.turmaId));
  }, [isProfessor, professorActual, alunos]);

  const filtered = useMemo(() => {
    return notas.filter(n => {
      const aluno = alunos.find(a => a.id === n.alunoId);
      const turmaMatch = !filterTurma || aluno?.turmaId === filterTurma;
      const trimestreMatch = n.trimestre === trimestreActivo;
      if (isProfessor && professorActual) {
        const profTurmaIds = new Set(professorActual.turmasIds);
        const profTurmaMatch = aluno ? profTurmaIds.has(aluno.turmaId) : false;
        const discMatch = professorActual.disciplinas.length === 0 || professorActual.disciplinas.includes(n.disciplina);
        return trimestreMatch && turmaMatch && profTurmaMatch && discMatch;
      }
      return trimestreMatch && turmaMatch;
    });
  }, [notas, trimestreActivo, filterTurma, alunos, isProfessor, professorActual]);

  async function handleSave(form: Partial<Nota>, parcial: boolean) {
    if (editNota) {
      await updateNota(editNota.id, form);
    } else {
      await addNota(form as any);
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (parcial) {
      Alert.alert('Progresso Guardado', 'Os dados foram guardados. Pode continuar a preencher as restantes avaliações mais tarde.', [{ text: 'OK' }]);
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
    const avaisReg = [lanc.aval1, lanc.aval2, lanc.aval3, lanc.aval4].filter(Boolean).length;
    const pp1Reg = !config.pp1Habilitado || lanc.pp1;
    const pptReg = !config.pptHabilitado || lanc.ppt;
    const isParcial = avaisReg < 4 || !pp1Reg || !pptReg;

    return (
      <TouchableOpacity
        style={[styles.card, isParcial && { borderColor: Colors.warning + '50', borderStyle: 'dashed' }]}
        onPress={() => { setEditNota(item); setShowForm(true); }}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <View style={styles.cardTopRow}>
            <Text style={styles.alunoNome}>{aluno?.nome} {aluno?.apelido}</Text>
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
            {(['aval1', 'aval2', 'aval3', 'aval4'] as const).map((k, i) => (
              <View key={k} style={[styles.valPill, lanc[k] && { borderColor: Colors.success + '50', backgroundColor: Colors.success + '0A' }]}>
                <Text style={styles.valKey}>A{i + 1}</Text>
                <Text style={[styles.valNum, !lanc[k] && { color: Colors.textMuted }]}>
                  {lanc[k] ? (item[k] ?? 0).toFixed(1) : '—'}
                </Text>
              </View>
            ))}
            <View style={[styles.valPill, { borderColor: Colors.gold + '50' }]}>
              <Text style={styles.valKey}>MAC1</Text>
              <Text style={styles.valNum}>{(item.mac1 ?? 0) > 0 ? (item.mac1 ?? 0).toFixed(1) : '—'}</Text>
            </View>
            {config.pp1Habilitado && (
              <View style={[styles.valPill, lanc.pp1 && { borderColor: Colors.info + '50' }]}>
                <Text style={styles.valKey}>PP1</Text>
                <Text style={[styles.valNum, !lanc.pp1 && { color: Colors.textMuted }]}>
                  {lanc.pp1 ? (item.pp1 ?? 0) : '—'}
                </Text>
              </View>
            )}
            {config.pptHabilitado && (
              <View style={[styles.valPill, lanc.ppt && { borderColor: Colors.info + '50' }]}>
                <Text style={styles.valKey}>PPT</Text>
                <Text style={[styles.valNum, !lanc.ppt && { color: Colors.textMuted }]}>
                  {lanc.ppt ? (item.ppt ?? 0) : '—'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.nfBadge, { backgroundColor: isParcial ? Colors.warning + '12' : color + '18', borderColor: isParcial ? Colors.warning + '50' : color + '50' }]}>
          <Text style={styles.nfLabel}>{isParcial ? 'AVAL' : 'NF'}</Text>
          <Text style={[styles.nfVal, { color: isParcial ? Colors.warning : color }]}>
            {isParcial ? `${avaisReg}/4` : (nf > 0 ? nf.toFixed(1) : '—')}
          </Text>
          <Text style={[styles.nfGrade, { color: isParcial ? Colors.warning : color }]}>
            {isParcial ? 'Parcial' : (nf > 0 ? gradeLabel(nf) : '')}
          </Text>
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
        rightAction={{ icon: 'add', onPress: () => { setEditNota(null); setShowForm(true); } }}
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '94%',
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
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
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

  profContextBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.info + '15',
    borderBottomWidth: 1, borderBottomColor: Colors.info + '30',
  },
  profContextName: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.info },
  profContextInfo: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
});
