import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAnoAcademico, Trimestre, AnoAcademico, EpocasExame, EpocaExameItem } from '@/context/AnoAcademicoContext';
import { useData, Evento } from '@/context/DataContext';
import { useProfessor, CalendarioProva } from '@/context/ProfessorContext';
import { useAuth } from '@/context/AuthContext';
import TopBar from '@/components/TopBar';
import { alertSucesso, alertErro } from '@/utils/toast';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const TRIM_COLORS = ['#3498DB', '#2ECC71', '#E67E22'] as const;
const TRIM_NAMES  = ['1.º Trimestre', '2.º Trimestre', '3.º Trimestre'] as const;
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'] as const;

const FERIADOS_NACIONAIS = [
  { dia: '01-01', nome: 'Ano Novo' },
  { dia: '04-02', nome: 'Início da Luta Armada de Libertação Nacional' },
  { dia: '08-03', nome: 'Dia Internacional da Mulher' },
  { dia: '04-04', nome: 'Dia da Paz e Reconciliação Nacional' },
  { dia: '01-05', nome: 'Dia do Trabalhador' },
  { dia: '25-05', nome: 'Dia de África' },
  { dia: '01-06', nome: 'Dia Internacional da Criança' },
  { dia: '17-09', nome: 'Dia do Herói Nacional (Agostinho Neto)' },
  { dia: '02-11', nome: 'Dia dos Finados' },
  { dia: '11-11', nome: 'Dia da Proclamação da Independência Nacional' },
  { dia: '10-12', nome: 'Dia dos Direitos Humanos' },
  { dia: '25-12', nome: 'Natal' },
];

const PROVA_TIPO_COLOR: Record<string, string> = {
  teste:      Colors.info,
  exame:      Colors.danger,
  trabalho:   Colors.gold,
  prova_oral: '#9B59B6',
};
const PROVA_TIPO_LABEL: Record<string, string> = {
  teste:      'Teste',
  exame:      'Exame',
  trabalho:   'Trabalho',
  prova_oral: 'Prova Oral',
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function diffDays(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function diffWeeks(a: string, b: string) {
  return Math.round(diffDays(a, b) / 7);
}
function formatDate(d: string) {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function trimProgress(t: Trimestre): number {
  const today = todayStr();
  if (today < t.dataInicio) return 0;
  if (today > t.dataFim)    return 100;
  return Math.min(100, Math.round(diffDays(t.dataInicio, today) / diffDays(t.dataInicio, t.dataFim) * 100));
}

// ─────────────────────────────────────────────────────────────
// TRIMESTRE EDIT MODAL
// ─────────────────────────────────────────────────────────────
function TrimestreModal({ visible, trimestre, onClose, onSave }: {
  visible: boolean;
  trimestre: Trimestre | null;
  onClose: () => void;
  onSave: (t: Trimestre) => void;
}) {
  const [form, setForm] = useState<Trimestre>(trimestre ?? {
    numero: 1, dataInicio: '', dataFim: '', dataInicioExames: '', dataFimExames: '', ativo: false,
  });
  useEffect(() => {
    if (trimestre) setForm(trimestre);
  }, [trimestre]);

  const set = (k: keyof Trimestre, v: any) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    if (!form.dataInicio || !form.dataFim) {
      Alert.alert('Campos obrigatórios', 'Preencha Data Início e Data Fim do trimestre.');
      return;
    }
    if (form.dataFim < form.dataInicio) {
      Alert.alert('Datas inválidas', 'A data de fim deve ser posterior à data de início.');
      return;
    }
    onSave(form);
  }

  const idx = (form.numero || 1) - 1;
  const color = TRIM_COLORS[idx];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={mS.container}>
          <View style={[mS.header, { borderLeftColor: color, borderLeftWidth: 4 }]}>
            <Text style={mS.title}>{TRIM_NAMES[idx]}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={mS.sectionLabel}>PERÍODO LECTIVO</Text>
            {[
              { label: 'Data de Início', key: 'dataInicio', ph: 'AAAA-MM-DD' },
              { label: 'Data de Fim', key: 'dataFim', ph: 'AAAA-MM-DD' },
            ].map(f => (
              <View key={f.key} style={mS.field}>
                <Text style={mS.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={mS.input}
                  value={(form as any)[f.key] ?? ''}
                  onChangeText={v => set(f.key as keyof Trimestre, v)}
                  placeholder={f.ph}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ))}

            <Text style={[mS.sectionLabel, { marginTop: 16 }]}>PERÍODO DE EXAMES</Text>
            {[
              { label: 'Início dos Exames', key: 'dataInicioExames', ph: 'AAAA-MM-DD (opcional)' },
              { label: 'Fim dos Exames', key: 'dataFimExames', ph: 'AAAA-MM-DD (opcional)' },
            ].map(f => (
              <View key={f.key} style={mS.field}>
                <Text style={mS.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={mS.input}
                  value={(form as any)[f.key] ?? ''}
                  onChangeText={v => set(f.key as keyof Trimestre, v)}
                  placeholder={f.ph}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ))}

            <View style={mS.field}>
              <TouchableOpacity
                style={[mS.toggleBtn, form.ativo && { backgroundColor: `${color}20`, borderColor: color }]}
                onPress={() => set('ativo', !form.ativo)}
              >
                <Ionicons name={form.ativo ? 'radio-button-on' : 'radio-button-off'} size={18} color={form.ativo ? color : Colors.textMuted} />
                <Text style={[mS.toggleText, form.ativo && { color }]}>Trimestre activo (em curso)</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity style={[mS.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={mS.saveBtnText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// FERIADO MODAL
// ─────────────────────────────────────────────────────────────
function FeriadoModal({ visible, evento, anoAtivo, onClose, onSave }: {
  visible: boolean;
  evento: Evento | null;
  anoAtivo: AnoAcademico | null;
  onClose: () => void;
  onSave: (e: Partial<Evento>) => void;
}) {
  const ano = anoAtivo?.ano?.split('/')?.[0] ?? String(new Date().getFullYear());
  const [form, setForm] = useState<Partial<Evento>>(evento || {
    titulo: '', descricao: '', data: `${ano}-01-01`, hora: '', tipo: 'Feriado', local: '',
  });
  useEffect(() => {
    setForm(evento || { titulo: '', descricao: '', data: `${ano}-01-01`, hora: '', tipo: 'Feriado', local: '' });
  }, [evento, visible]);
  const set = (k: keyof Evento, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={mS.container}>
          <View style={mS.header}>
            <Text style={mS.title}>{evento ? 'Editar Feriado' : 'Novo Feriado'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: 'Nome', key: 'titulo', ph: 'Ex: Dia da Independência' },
              { label: 'Data (AAAA-MM-DD)', key: 'data', ph: `${ano}-11-11` },
              { label: 'Descrição (opcional)', key: 'descricao', ph: 'Nota adicional...' },
            ].map(f => (
              <View key={f.key} style={mS.field}>
                <Text style={mS.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={mS.input}
                  value={(form as any)[f.key] ?? ''}
                  onChangeText={v => set(f.key as keyof Evento, v)}
                  placeholder={f.ph}
                  placeholderTextColor={Colors.textMuted}
                  multiline={f.key === 'descricao'}
                />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[mS.saveBtn, { backgroundColor: Colors.warning }]} onPress={() => {
            if (!form.titulo || !form.data) {
              Alert.alert('Campos obrigatórios', 'Preencha nome e data.'); return;
            }
            onSave(form);
          }}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={mS.saveBtnText}>Guardar Feriado</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// PROVA MODAL
// ─────────────────────────────────────────────────────────────
function ProvaModal({ visible, prova, onClose, onSave }: {
  visible: boolean;
  prova: CalendarioProva | null;
  onClose: () => void;
  onSave: (p: Partial<CalendarioProva>) => void;
}) {
  const [form, setForm] = useState<Partial<CalendarioProva>>(prova || {
    titulo: '', descricao: '', disciplina: '', data: todayStr(), hora: '08:00',
    tipo: 'teste', publicado: false, turmasIds: [],
  });
  useEffect(() => {
    setForm(prova || { titulo: '', descricao: '', disciplina: '', data: todayStr(), hora: '08:00', tipo: 'teste', publicado: false, turmasIds: [] });
  }, [prova, visible]);
  const set = (k: keyof CalendarioProva, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={mS.container}>
          <View style={mS.header}>
            <Text style={mS.title}>{prova ? 'Editar Prova' : 'Nova Prova / Exame'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: 'Título', key: 'titulo', ph: 'Ex: Teste Formativo de Matemática' },
              { label: 'Disciplina', key: 'disciplina', ph: 'Ex: Matemática' },
              { label: 'Data (AAAA-MM-DD)', key: 'data', ph: '2025-03-15' },
              { label: 'Hora (HH:MM)', key: 'hora', ph: '08:00' },
              { label: 'Descrição (opcional)', key: 'descricao', ph: 'Conteúdos abrangidos...' },
            ].map(f => (
              <View key={f.key} style={mS.field}>
                <Text style={mS.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={mS.input}
                  value={(form as any)[f.key] ?? ''}
                  onChangeText={v => set(f.key as keyof CalendarioProva, v)}
                  placeholder={f.ph}
                  placeholderTextColor={Colors.textMuted}
                  multiline={f.key === 'descricao'}
                />
              </View>
            ))}
            <View style={mS.field}>
              <Text style={mS.fieldLabel}>Tipo</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {(['teste','exame','trabalho','prova_oral'] as const).map(t => {
                  const active = form.tipo === t;
                  const col = PROVA_TIPO_COLOR[t];
                  return (
                    <TouchableOpacity key={t}
                      style={[mS.tipoBtn, active && { backgroundColor: `${col}20`, borderColor: col }]}
                      onPress={() => set('tipo', t)}
                    >
                      <Text style={[mS.tipoText, active && { color: col }]}>{PROVA_TIPO_LABEL[t]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
          <TouchableOpacity style={[mS.saveBtn, { backgroundColor: Colors.danger }]} onPress={() => {
            if (!form.titulo || !form.disciplina || !form.data) {
              Alert.alert('Campos obrigatórios', 'Preencha título, disciplina e data.'); return;
            }
            onSave(form);
          }}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={mS.saveBtnText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// ÉPOCAS DE EXAME MODAL
// ─────────────────────────────────────────────────────────────
const EPOCAS_CFG = [
  { key: 'normal',   label: 'Época Normal',   color: '#E74C3C', icon: 'school'           as const },
  { key: 'recurso',  label: 'Época de Recurso', color: '#E67E22', icon: 'refresh-circle' as const },
  { key: 'especial', label: 'Época Especial', color: '#9B59B6', icon: 'star'              as const },
] as const;

type EpocaKey = 'normal' | 'recurso' | 'especial';

function EpocasExameModal({ visible, epocas, anoLabel, onClose, onSave }: {
  visible: boolean;
  epocas: EpocasExame;
  anoLabel: string;
  onClose: () => void;
  onSave: (e: EpocasExame) => void;
}) {
  const [form, setForm] = useState<EpocasExame>(epocas ?? {});

  useEffect(() => {
    if (visible) setForm(epocas ?? {});
  }, [epocas, visible]);

  function setEpoca(key: EpocaKey, field: keyof EpocaExameItem, val: string) {
    setForm(f => ({
      ...f,
      [key]: { ...(f[key] ?? {}), [field]: val },
    }));
  }

  function handleSave() {
    for (const ep of EPOCAS_CFG) {
      const e = form[ep.key as EpocaKey];
      if (e?.dataInicio && e?.dataFim && e.dataFim < e.dataInicio) {
        Alert.alert('Datas inválidas', `Em "${ep.label}", a data de fim deve ser posterior à data de início.`);
        return;
      }
    }
    onSave(form);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={mS.container}>
          <View style={[mS.header, { borderLeftColor: '#E74C3C', borderLeftWidth: 4 }]}>
            <View style={{ flex: 1 }}>
              <Text style={mS.title}>Épocas de Exame</Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                {anoLabel}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {EPOCAS_CFG.map(ep => {
              const epKey = ep.key as EpocaKey;
              const val = form[epKey] ?? {};
              return (
                <View key={ep.key} style={[mS.epocaBlock, { borderLeftColor: ep.color }]}>
                  <View style={mS.epocaBlockHeader}>
                    <Ionicons name={ep.icon} size={16} color={ep.color} />
                    <Text style={[mS.epocaBlockTitle, { color: ep.color }]}>{ep.label}</Text>
                  </View>
                  {[
                    { label: 'Data de Início', field: 'dataInicio' as keyof EpocaExameItem, ph: 'AAAA-MM-DD' },
                    { label: 'Data de Fim',    field: 'dataFim'    as keyof EpocaExameItem, ph: 'AAAA-MM-DD' },
                    { label: 'Observações (opcional)', field: 'observacoes' as keyof EpocaExameItem, ph: 'Ex: Turmas do 2.º ciclo...' },
                  ].map(f => (
                    <View key={f.field} style={mS.field}>
                      <Text style={mS.fieldLabel}>{f.label}</Text>
                      <TextInput
                        style={[mS.input, f.field === 'observacoes' && { minHeight: 52, textAlignVertical: 'top' }]}
                        value={(val[f.field] as string) ?? ''}
                        onChangeText={v => setEpoca(epKey, f.field, v)}
                        placeholder={f.ph}
                        placeholderTextColor={Colors.textMuted}
                        multiline={f.field === 'observacoes'}
                      />
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={[mS.saveBtn, { backgroundColor: '#E74C3C' }]} onPress={handleSave}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={mS.saveBtnText}>Guardar Épocas</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────
type Tab = 'trimestres' | 'feriados' | 'provas' | 'anual';

export default function CalendarioAcademicoScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { anos, anoAtivo, anoSelecionado, setAnoSelecionado, updateAno, isLoading: anoLoading } = useAnoAcademico();
  const { eventos, addEvento, updateEvento, deleteEvento } = useData();
  const { calendarioProvas, addCalendarioProva, updateCalendarioProva, deleteCalendarioProva } = useProfessor();

  const [tab, setTab] = useState<Tab>('trimestres');
  const [saving, setSaving] = useState(false);

  // Trimestre edit
  const [editTrim, setEditTrim] = useState<Trimestre | null>(null);
  const [showTrimModal, setShowTrimModal] = useState(false);

  // Feriado
  const [editFeriado, setEditFeriado] = useState<Evento | null>(null);
  const [showFeriadoModal, setShowFeriadoModal] = useState(false);

  // Prova
  const [editProva, setEditProva] = useState<CalendarioProva | null>(null);
  const [showProvaModal, setShowProvaModal] = useState(false);

  // Épocas de Exame
  const [showEpocasModal, setShowEpocasModal] = useState(false);
  const [savingEpocas, setSavingEpocas] = useState(false);

  const ano = anoSelecionado ?? anoAtivo;
  const isAdmin = user?.role === 'admin' || user?.role === 'director' || user?.role === 'chefe_secretaria';
  const today = todayStr();

  const feriados = useMemo(() =>
    eventos.filter(e => e.tipo === 'Feriado').sort((a, b) => a.data.localeCompare(b.data)),
    [eventos]
  );

  const provasOrdenadas = useMemo(() =>
    [...calendarioProvas].sort((a, b) => a.data.localeCompare(b.data)),
    [calendarioProvas]
  );

  // ── Save trimestre ────────────────────────────────────────
  async function handleSaveTrimestre(updated: Trimestre) {
    if (!ano) return;
    setSaving(true);
    try {
      const newTrimestres = ano.trimestres.map(t => t.numero === updated.numero ? updated : t);
      await updateAno(ano.id, { trimestres: newTrimestres });
      setShowTrimModal(false);
      alertSucesso('Trimestre actualizado', `${TRIM_NAMES[updated.numero - 1]} guardado com sucesso.`);
    } catch { alertErro('Erro', 'Não foi possível guardar o trimestre.'); }
    finally { setSaving(false); }
  }

  // ── Seed feriados nacionais ───────────────────────────────
  async function seedFeriadosNacionais() {
    if (!ano) return;
    const anoBase = ano.ano.split('/')[0];
    const existingNames = feriados.map(f => f.titulo.toLowerCase());
    const missing = FERIADOS_NACIONAIS.filter(f => !existingNames.some(e => e.includes(f.nome.toLowerCase().slice(0, 10))));
    if (missing.length === 0) {
      Alert.alert('Feriados', 'Os feriados nacionais já estão todos registados.'); return;
    }
    Alert.alert(
      'Adicionar Feriados Nacionais',
      `Adicionar ${missing.length} feriado(s) oficial(is) de Angola para ${anoBase}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Adicionar', onPress: async () => {
            setSaving(true);
            try {
              for (const f of missing) {
                await addEvento({ titulo: f.nome, descricao: 'Feriado Nacional de Angola', data: `${anoBase}-${f.dia}`, hora: '', tipo: 'Feriado', local: '', turmasIds: [] });
              }
              alertSucesso('Feriados adicionados', `${missing.length} feriado(s) nacional(is) registado(s).`);
            } catch { alertErro('Erro', 'Não foi possível adicionar os feriados.'); }
            finally { setSaving(false); }
          },
        },
      ]
    );
  }

  // ── Delete feriado ────────────────────────────────────────
  function confirmDeleteFeriado(ev: Evento) {
    Alert.alert('Remover Feriado', `Remover "${ev.titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
          try { await deleteEvento(ev.id); alertSucesso('Removido', `"${ev.titulo}" foi removido.`); }
          catch { alertErro('Erro', 'Não foi possível remover.'); }
        }},
    ]);
  }

  // ── Save feriado ──────────────────────────────────────────
  async function handleSaveFeriado(form: Partial<Evento>) {
    setSaving(true);
    try {
      if (editFeriado) await updateEvento(editFeriado.id, form);
      else await addEvento({ ...form, tipo: 'Feriado' } as any);
      setShowFeriadoModal(false);
      setEditFeriado(null);
      alertSucesso(editFeriado ? 'Feriado actualizado' : 'Feriado adicionado', `"${form.titulo}" guardado.`);
    } catch { alertErro('Erro', 'Não foi possível guardar o feriado.'); }
    finally { setSaving(false); }
  }

  // ── Save prova ────────────────────────────────────────────
  async function handleSaveProva(form: Partial<CalendarioProva>) {
    setSaving(true);
    try {
      if (editProva) await updateCalendarioProva(editProva.id, form);
      else await addCalendarioProva({ ...form, publicado: false, turmasIds: [] } as any);
      setShowProvaModal(false);
      setEditProva(null);
      alertSucesso(editProva ? 'Prova actualizada' : 'Prova adicionada', `"${form.titulo}" guardada.`);
    } catch { alertErro('Erro', 'Não foi possível guardar a prova.'); }
    finally { setSaving(false); }
  }

  // ── Toggle publicado ──────────────────────────────────────
  async function togglePublicado(p: CalendarioProva) {
    try { await updateCalendarioProva(p.id, { publicado: !p.publicado }); }
    catch { alertErro('Erro', 'Não foi possível actualizar.'); }
  }

  // ── Delete prova ──────────────────────────────────────────
  function confirmDeleteProva(p: CalendarioProva) {
    Alert.alert('Remover Prova', `Remover "${p.titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
          try { await deleteCalendarioProva(p.id); }
          catch { alertErro('Erro', 'Não foi possível remover.'); }
        }},
    ]);
  }

  // ── Determine which trimester a date belongs to ───────────
  function provaTrimestreNum(data: string): number {
    if (!ano) return 0;
    for (const t of ano.trimestres) {
      if (data >= t.dataInicio && data <= t.dataFim) return t.numero;
    }
    return 0;
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: TRIMESTRES TAB
  // ─────────────────────────────────────────────────────────
  function renderTrimestres() {
    if (!ano) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="calendar-blank" size={44} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Nenhum ano académico configurado.</Text>
          <Text style={styles.emptySubText}>Configure um ano académico no painel de administração.</Text>
        </View>
      );
    }
    const semanas = diffWeeks(ano.dataInicio, ano.dataFim);
    const totalDias = diffDays(ano.dataInicio, ano.dataFim);
    const diasPassados = Math.max(0, Math.min(totalDias, diffDays(ano.dataInicio, today)));
    const progressoAno = totalDias > 0 ? Math.round(diasPassados / totalDias * 100) : 0;

    return (
      <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        {/* Year banner */}
        <View style={styles.anoBanner}>
          <View style={styles.anoBannerLeft}>
            <Text style={styles.anoLabel}>Ano Lectivo</Text>
            <Text style={styles.anoValue}>{ano.ano}</Text>
            <Text style={styles.anoDates}>{formatDate(ano.dataInicio)} → {formatDate(ano.dataFim)}</Text>
          </View>
          <View style={styles.anoBannerRight}>
            <Text style={styles.anoStat}>{semanas}</Text>
            <Text style={styles.anoStatLabel}>semanas</Text>
          </View>
        </View>

        {/* Global progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progresso do Ano Lectivo</Text>
            <Text style={styles.progressPct}>{progressoAno}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressoAno}%`, backgroundColor: Colors.gold }]} />
          </View>
          <Text style={styles.progressSub}>{diasPassados} de {totalDias} dias lectivos decorridos</Text>
        </View>

        {/* Trimestre cards */}
        {ano.trimestres.map((t, idx) => {
          const color = TRIM_COLORS[idx] || Colors.textMuted;
          const prog = trimProgress(t);
          const weeks = diffWeeks(t.dataInicio, t.dataFim);
          const examDays = t.dataInicioExames && t.dataFimExames ? diffDays(t.dataInicioExames, t.dataFimExames) + 1 : 0;
          const isNow = today >= t.dataInicio && today <= t.dataFim;
          const isFuture = today < t.dataInicio;
          const isPast = today > t.dataFim;

          return (
            <View key={t.numero} style={[styles.trimCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
              <View style={styles.trimCardHeader}>
                <View style={[styles.trimBadge, { backgroundColor: `${color}20` }]}>
                  <Text style={[styles.trimBadgeText, { color }]}>{TRIM_NAMES[idx]}</Text>
                </View>
                <View style={styles.trimStatusRow}>
                  {t.ativo && <View style={[styles.activePill, { backgroundColor: `${color}25`, borderColor: color }]}>
                    <View style={[styles.activeDot, { backgroundColor: color }]} />
                    <Text style={[styles.activePillText, { color }]}>Em curso</Text>
                  </View>}
                  {isNow && !t.ativo && <View style={styles.nowPill}><Text style={styles.nowPillText}>Período actual</Text></View>}
                  {isPast && <Text style={styles.pastLabel}>Concluído</Text>}
                  {isFuture && <Text style={styles.futureLabel}>Por iniciar</Text>}
                  {isAdmin && (
                    <TouchableOpacity style={styles.editBtn} onPress={() => { setEditTrim(t); setShowTrimModal(true); }}>
                      <Ionicons name="create-outline" size={16} color={color} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Dates grid */}
              <View style={styles.trimDatesGrid}>
                <View style={styles.trimDateCell}>
                  <Text style={styles.trimDateLabel}>INÍCIO</Text>
                  <Text style={styles.trimDateValue}>{formatDate(t.dataInicio)}</Text>
                </View>
                <View style={styles.trimDateSep} />
                <View style={styles.trimDateCell}>
                  <Text style={styles.trimDateLabel}>FIM</Text>
                  <Text style={styles.trimDateValue}>{formatDate(t.dataFim)}</Text>
                </View>
                <View style={styles.trimDateSep} />
                <View style={styles.trimDateCell}>
                  <Text style={styles.trimDateLabel}>SEMANAS</Text>
                  <Text style={[styles.trimDateValue, { color }]}>{weeks}</Text>
                </View>
              </View>

              {/* Exam period */}
              {t.dataInicioExames && t.dataFimExames ? (
                <View style={[styles.examPeriod, { borderColor: `${color}40`, backgroundColor: `${color}08` }]}>
                  <Ionicons name="document-text" size={14} color={color} />
                  <Text style={[styles.examPeriodText, { color }]}>
                    Exames: {formatDate(t.dataInicioExames)} → {formatDate(t.dataFimExames)}
                    {examDays > 0 ? ` (${examDays} dias)` : ''}
                  </Text>
                </View>
              ) : isAdmin ? (
                <TouchableOpacity
                  style={styles.addExamBtn}
                  onPress={() => { setEditTrim(t); setShowTrimModal(true); }}
                >
                  <Ionicons name="add-circle-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.addExamBtnText}>Definir período de exames</Text>
                </TouchableOpacity>
              ) : null}

              {/* Progress */}
              <View style={styles.trimProgressRow}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${prog}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.trimProgPct, { color }]}>{prog}%</Text>
              </View>
            </View>
          );
        })}

        {/* Year selector */}
        {anos.length > 1 && (
          <View style={styles.yearSelector}>
            <Text style={styles.yearSelectorLabel}>Outros anos:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {anos.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.yearBtn, a.id === ano?.id && styles.yearBtnActive]}
                    onPress={() => setAnoSelecionado(a)}
                  >
                    <Text style={[styles.yearBtnText, a.id === ano?.id && styles.yearBtnTextActive]}>{a.ano}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: FERIADOS TAB
  // ─────────────────────────────────────────────────────────
  function renderFeriados() {
    return (
      <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{feriados.length}</Text>
            <Text style={styles.kpiLabel}>Total</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: Colors.success }]}>{feriados.filter(f => f.data >= today).length}</Text>
            <Text style={styles.kpiLabel}>Próximos</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: Colors.textMuted }]}>{feriados.filter(f => f.data < today).length}</Text>
            <Text style={styles.kpiLabel}>Passados</Text>
          </View>
        </View>

        {/* Actions */}
        {isAdmin && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.seedBtn} onPress={seedFeriadosNacionais} disabled={saving}>
              <Ionicons name="flag" size={14} color={Colors.warning} />
              <Text style={styles.seedBtnText}>Feriados Nacionais de Angola</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* List */}
        {feriados.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum feriado registado</Text>
            {isAdmin && <Text style={styles.emptySubText}>Use o botão acima para adicionar os feriados nacionais</Text>}
          </View>
        ) : (
          feriados.map(ev => {
            const isPast = ev.data < today;
            const dDiff = diffDays(today, ev.data);
            return (
              <View key={ev.id} style={[styles.feriadoCard, isPast && { opacity: 0.6 }]}>
                <View style={[styles.feriadoDateBox, { backgroundColor: isPast ? Colors.surface : `${Colors.warning}20` }]}>
                  <Text style={[styles.feriadoDay, { color: isPast ? Colors.textMuted : Colors.warning }]}>
                    {ev.data.split('-')[2]}
                  </Text>
                  <Text style={[styles.feriadoMonth, { color: isPast ? Colors.textMuted : Colors.warning }]}>
                    {MESES[parseInt(ev.data.split('-')[1]) - 1]}
                  </Text>
                </View>
                <View style={styles.feriadoInfo}>
                  <Text style={styles.feriadoNome}>{ev.titulo}</Text>
                  {ev.descricao ? <Text style={styles.feriadoDesc} numberOfLines={1}>{ev.descricao}</Text> : null}
                  <Text style={[styles.feriadoCountdown, { color: isPast ? Colors.textMuted : Colors.warning }]}>
                    {dDiff === 0 ? 'Hoje' : dDiff > 0 ? `Em ${dDiff} dias` : `${Math.abs(dDiff)} dias atrás`}
                  </Text>
                </View>
                {isAdmin && (
                  <View style={styles.feriadoActions}>
                    <TouchableOpacity onPress={() => { setEditFeriado(ev); setShowFeriadoModal(true); }}>
                      <Ionicons name="create-outline" size={16} color={Colors.info} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDeleteFeriado(ev)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: PROVAS TAB
  // ─────────────────────────────────────────────────────────
  function renderProvas() {
    const upcoming = provasOrdenadas.filter(p => p.data >= today);
    const past = provasOrdenadas.filter(p => p.data < today);

    const renderProvaCard = (p: CalendarioProva) => {
      const color = PROVA_TIPO_COLOR[p.tipo] || Colors.textMuted;
      const isPast = p.data < today;
      const tn = provaTrimestreNum(p.data);
      return (
        <View key={p.id} style={[styles.provaCard, { borderLeftColor: color, borderLeftWidth: 3 }, isPast && { opacity: 0.65 }]}>
          <View style={styles.provaCardTop}>
            <View style={styles.provaInfo}>
              <Text style={styles.provaTitulo}>{p.titulo}</Text>
              <View style={styles.provaMetaRow}>
                <Text style={styles.provaMeta}>{p.disciplina}</Text>
                {tn > 0 && <Text style={[styles.provaTrimBadge, { color: TRIM_COLORS[tn - 1] }]}>T{tn}</Text>}
              </View>
              <Text style={styles.provaMeta}>{formatDate(p.data)} · {p.hora}</Text>
            </View>
            <View style={styles.provaRight}>
              <View style={[styles.tipoBadge, { backgroundColor: `${color}20` }]}>
                <Text style={[styles.tipoText, { color }]}>{PROVA_TIPO_LABEL[p.tipo]}</Text>
              </View>
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.publicadoBtn, p.publicado && styles.publicadoBtnActive]}
                  onPress={() => togglePublicado(p)}
                >
                  <Ionicons name={p.publicado ? 'eye' : 'eye-off-outline'} size={12} color={p.publicado ? Colors.success : Colors.textMuted} />
                  <Text style={[styles.publicadoText, p.publicado && { color: Colors.success }]}>
                    {p.publicado ? 'Público' : 'Rascunho'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {p.descricao ? <Text style={styles.provaDesc} numberOfLines={2}>{p.descricao}</Text> : null}
          {isAdmin && (
            <View style={styles.provaActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditProva(p); setShowProvaModal(true); }}>
                <Ionicons name="create-outline" size={15} color={Colors.info} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDeleteProva(p)}>
                <Ionicons name="trash-outline" size={15} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    };

    return (
      <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{provasOrdenadas.length}</Text>
            <Text style={styles.kpiLabel}>Total</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: Colors.success }]}>{upcoming.length}</Text>
            <Text style={styles.kpiLabel}>Próximas</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: Colors.warning }]}>{provasOrdenadas.filter(p => p.publicado).length}</Text>
            <Text style={styles.kpiLabel}>Publicadas</Text>
          </View>
        </View>

        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRÓXIMAS PROVAS</Text>
            {upcoming.map(renderProvaCard)}
          </View>
        )}
        {past.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PROVAS PASSADAS</Text>
            {past.map(renderProvaCard)}
          </View>
        )}
        {provasOrdenadas.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhuma prova agendada</Text>
            {isAdmin && <Text style={styles.emptySubText}>Use o botão + para agendar provas e exames</Text>}
          </View>
        )}
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: ANNUAL CALENDAR TAB
  // ─────────────────────────────────────────────────────────
  function renderAnual() {
    if (!ano) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="calendar-blank" size={44} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Nenhum ano académico configurado.</Text>
        </View>
      );
    }

    const anoBase = parseInt(ano.ano.split('/')[0]) || new Date().getFullYear();
    const feriadosDatas = new Set(feriados.map(f => f.data));
    const provasDatas = new Set(provasOrdenadas.map(p => p.data));

    function getDayInfo(year: number, month: number, day: number): {
      trimColor: string | null;
      isExam: boolean;
      isFeriado: boolean;
      isProva: boolean;
      isToday: boolean;
    } {
      const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      let trimColor: string | null = null;
      let isExam = false;
      if (ano) {
        for (let i = 0; i < ano.trimestres.length; i++) {
          const t = ano.trimestres[i];
          if (d >= t.dataInicio && d <= t.dataFim) {
            trimColor = TRIM_COLORS[i];
            if (t.dataInicioExames && t.dataFimExames && d >= t.dataInicioExames && d <= t.dataFimExames) {
              isExam = true;
            }
          }
        }
      }
      return {
        trimColor,
        isExam,
        isFeriado: feriadosDatas.has(d),
        isProva: provasDatas.has(d),
        isToday: d === today,
      };
    }

    return (
      <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        {/* Legend */}
        <View style={styles.legendRow}>
          {TRIM_COLORS.map((c, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c }]} />
              <Text style={styles.legendText}>T{i + 1}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.danger, opacity: 0.7 }]} />
            <Text style={styles.legendText}>Exames</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
            <Text style={styles.legendText}>Feriado</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9B59B6' }]} />
            <Text style={styles.legendText}>Prova</Text>
          </View>
        </View>

        {/* Month grids */}
        {Array.from({ length: 12 }, (_, mi) => {
          const year = mi >= 8 ? anoBase : anoBase + 1;
          const month = (mi + 8) % 12;
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const firstDow = new Date(year, month, 1).getDay();

          const hasContent = Array.from({ length: daysInMonth }, (_, d) => {
            const info = getDayInfo(year, month, d + 1);
            return info.trimColor || info.isFeriado || info.isProva;
          }).some(Boolean);

          return (
            <View key={mi} style={styles.monthBlock}>
              <Text style={styles.monthTitle}>{MESES_FULL[month]} {year}</Text>
              <View style={styles.monthGrid}>
                {['D','S','T','Q','Q','S','S'].map((d, di) => (
                  <Text key={di} style={styles.dowLabel}>{d}</Text>
                ))}
                {Array.from({ length: firstDow }, (_, i) => (
                  <View key={`e-${i}`} style={styles.dayCell} />
                ))}
                {Array.from({ length: daysInMonth }, (_, d) => {
                  const info = getDayInfo(year, month, d + 1);
                  const bgColor = info.isToday ? Colors.gold
                    : info.isFeriado ? Colors.warning
                    : info.isProva ? '#9B59B6'
                    : info.isExam ? `${info.trimColor}99`
                    : info.trimColor ? `${info.trimColor}35`
                    : 'transparent';
                  return (
                    <View key={d} style={[styles.dayCell, { backgroundColor: bgColor }]}>
                      <Text style={[
                        styles.dayNum,
                        info.isToday && { color: '#0D1B3E', fontFamily: 'Inter_700Bold' },
                        info.isFeriado && { color: '#fff' },
                        info.isProva && { color: '#fff' },
                        !info.trimColor && !info.isToday && { color: Colors.textMuted, opacity: 0.4 },
                      ]}>{d + 1}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'trimestres', label: 'Trimestres', icon: 'calendar' },
    { key: 'feriados',   label: 'Feriados',   icon: 'flag' },
    { key: 'provas',     label: 'Provas',      icon: 'document-text' },
    { key: 'anual',      label: 'Vista Anual', icon: 'grid' },
  ];

  const FAB_VISIBLE = tab === 'feriados' || tab === 'provas';

  if (anoLoading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopBar
        title="Calendário Académico"
        subtitle={ano ? `${ano.ano} · ${ano.ativo ? 'Ano Activo' : 'Ano Inactivo'}` : 'Sem ano configurado'}
      />

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons name={t.icon as any} size={14} color={tab === t.key ? Colors.gold : Colors.textMuted} />
            <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      {tab === 'trimestres' && renderTrimestres()}
      {tab === 'feriados'   && renderFeriados()}
      {tab === 'provas'     && renderProvas()}
      {tab === 'anual'      && renderAnual()}

      {/* FAB */}
      {isAdmin && FAB_VISIBLE && (
        <TouchableOpacity
          style={[styles.fab, { bottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 20 }]}
          onPress={() => {
            if (tab === 'feriados') { setEditFeriado(null); setShowFeriadoModal(true); }
            else if (tab === 'provas') { setEditProva(null); setShowProvaModal(true); }
          }}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Trimestre Modal */}
      <TrimestreModal
        visible={showTrimModal}
        trimestre={editTrim}
        onClose={() => setShowTrimModal(false)}
        onSave={handleSaveTrimestre}
      />

      {/* Feriado Modal */}
      <FeriadoModal
        visible={showFeriadoModal}
        evento={editFeriado}
        anoAtivo={ano}
        onClose={() => { setShowFeriadoModal(false); setEditFeriado(null); }}
        onSave={handleSaveFeriado}
      />

      {/* Prova Modal */}
      <ProvaModal
        visible={showProvaModal}
        prova={editProva}
        onClose={() => { setShowProvaModal(false); setEditProva(null); }}
        onSave={handleSaveProva}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const mS = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center' },
  container:    { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '92%' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingLeft: 8 },
  title:        { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  field:        { marginBottom: 14 },
  fieldLabel:   { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 6 },
  input:        { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  toggleBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  toggleText:   { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  saveBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, gap: 8, marginTop: 12 },
  saveBtnText:  { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  tipoBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tipoText:     { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
});

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: Colors.background },

  tabBar:         { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBarContent:  { paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignItems: 'center' },
  tabBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive:   { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  tabBtnText:     { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  tabContent:     { padding: 16, gap: 12 },

  // Year banner
  anoBanner:      { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border },
  anoBannerLeft:  { gap: 3 },
  anoBannerRight: { alignItems: 'center' },
  anoLabel:       { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  anoValue:       { fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.gold },
  anoDates:       { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  anoStat:        { fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.text },
  anoStatLabel:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  // Progress card
  progressCard:   { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel:  { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  progressPct:    { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.gold },
  progressBarBg:  { height: 6, backgroundColor: Colors.surface, borderRadius: 4, flex: 1 },
  progressBarFill:{ height: 6, borderRadius: 4 },
  progressSub:    { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  // Trimestre card
  trimCard:       { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  trimCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trimBadge:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  trimBadgeText:  { fontSize: 13, fontFamily: 'Inter_700Bold' },
  trimStatusRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activePill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  activeDot:      { width: 6, height: 6, borderRadius: 3 },
  activePillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  nowPill:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: `${Colors.info}20` },
  nowPillText:    { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.info },
  pastLabel:      { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  futureLabel:    { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  editBtn:        { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },

  trimDatesGrid:  { flexDirection: 'row', alignItems: 'center' },
  trimDateCell:   { flex: 1, alignItems: 'center', gap: 3 },
  trimDateSep:    { width: 1, height: 32, backgroundColor: Colors.border },
  trimDateLabel:  { fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.textMuted, letterSpacing: 0.5 },
  trimDateValue:  { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },

  examPeriod:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  examPeriodText: { fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1 },
  addExamBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10 },
  addExamBtnText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  trimProgressRow:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  trimProgPct:    { fontSize: 12, fontFamily: 'Inter_700Bold', minWidth: 34, textAlign: 'right' },

  // Year selector
  yearSelector:   { gap: 8, marginTop: 4 },
  yearSelectorLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase' },
  yearBtn:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  yearBtnActive:  { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  yearBtnText:    { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  yearBtnTextActive: { color: Colors.gold },

  // KPIs
  kpiRow:         { flexDirection: 'row', gap: 10 },
  kpiCard:        { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 4 },
  kpiValue:       { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.text },
  kpiLabel:       { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  // Action row
  actionRow:      { flexDirection: 'row', gap: 8 },
  seedBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: `${Colors.warning}15`, borderWidth: 1, borderColor: `${Colors.warning}40` },
  seedBtnText:    { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.warning },

  // Feriado card
  feriadoCard:    { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border },
  feriadoDateBox: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  feriadoDay:     { fontSize: 20, fontFamily: 'Inter_700Bold' },
  feriadoMonth:   { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  feriadoInfo:    { flex: 1, gap: 2 },
  feriadoNome:    { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  feriadoDesc:    { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  feriadoCountdown: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  feriadoActions: { flexDirection: 'row', gap: 12 },

  // Prova card
  provaCard:      { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: Colors.border },
  provaCardTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  provaInfo:      { flex: 1, gap: 3 },
  provaTitulo:    { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  provaMetaRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  provaMeta:      { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  provaTrimBadge: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  provaRight:     { alignItems: 'flex-end', gap: 6 },
  tipoBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tipoText:       { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  publicadoBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  publicadoBtnActive: { backgroundColor: `${Colors.success}15`, borderColor: Colors.success },
  publicadoText:  { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  provaDesc:      { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  provaActions:   { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  actionBtn:      { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },

  // Section
  section:        { gap: 8 },
  sectionTitle:   { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },

  // Annual calendar
  legendRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:      { width: 10, height: 10, borderRadius: 5 },
  legendText:     { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  monthBlock:     { backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  monthTitle:     { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 10 },
  monthGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  dowLabel:       { width: '14.28%', textAlign: 'center', fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, paddingBottom: 6 },
  dayCell:        { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 4, marginBottom: 2 },
  dayNum:         { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.text },

  // Empty state
  emptyState:     { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyText:      { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  emptySubText:   { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },

  // FAB
  fab:            { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});
