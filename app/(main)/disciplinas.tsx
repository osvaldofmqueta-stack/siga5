import React, { useState, useEffect, useCallback } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import TopBar from '@/components/TopBar';
import { alertSucesso, alertErro } from '@/utils/toast';
import { useLookup } from '@/hooks/useLookup';
import { webAlert } from '@/utils/webAlert';

// ─── Constantes ─────────────────────────────────────────────────────────────

const COMPONENTES = [
  'Sócio-Cultural',
  'Científica',
  'Técnica, Tecnológica e Prática',
] as const;
type Componente = typeof COMPONENTES[number] | '';

const COMPONENTE_COLORS: Record<string, string> = {
  'Sócio-Cultural':                   '#8B5CF6',
  'Científica':                        '#3B82F6',
  'Técnica, Tecnológica e Prática':   '#F59E0B',
};

const COMPONENTE_ICONS: Record<string, string> = {
  'Sócio-Cultural':                   'account-group',
  'Científica':                        'atom',
  'Técnica, Tecnológica e Prática':   'wrench',
};

const COMPONENTE_SHORT: Record<string, string> = {
  'Sócio-Cultural':                   'Sócio-Cultural',
  'Científica':                        'Científica',
  'Técnica, Tecnológica e Prática':   'Técnica / Prática',
};

const AREAS_DEFAULT = [
  'Ciências Exactas',
  'Ciências Naturais',
  'Ciências Sociais e Humanas',
  'Línguas e Comunicação',
  'Artes e Expressão',
  'Tecnologia e Informática',
  'Educação Física',
  'Formação Profissional',
  'Outra',
];

const CLASSES_DEFAULT = [
  'Iniciação',
  '1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe',
  '7ª Classe', '8ª Classe', '9ª Classe',
  '10ª Classe', '11ª Classe', '12ª Classe', '13ª Classe',
];

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Disciplina {
  id: string;
  nome: string;
  codigo: string;
  area: string;
  descricao: string;
  ativo: boolean;
  tipo: string;
  classeInicio: string;
  classeFim: string;
  componente: string;
  createdAt: string;
}

interface FormState {
  nome: string;
  codigo: string;
  area: string;
  descricao: string;
  ativo: boolean;
  tipo: string;
  classeInicio: string;
  classeFim: string;
  componente: string;
}

const EMPTY_FORM: FormState = {
  nome: '',
  codigo: '',
  area: AREAS_DEFAULT[0],
  descricao: '',
  ativo: true,
  tipo: 'continuidade',
  classeInicio: '',
  classeFim: '',
  componente: '',
};

type PickerField = 'area' | 'classeInicio' | 'classeFim' | null;

// ─── Modal de Formulário ──────────────────────────────────────────────────────

function DisciplinaFormModal({
  visible, onClose, onSave, disciplina,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (form: FormState) => Promise<void>;
  disciplina: Disciplina | null;
}) {
  const { values: areas } = useLookup('areas_conhecimento', AREAS_DEFAULT);
  const { values: classesRaw } = useLookup('classes', CLASSES_DEFAULT);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerField>(null);
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    if (disciplina) {
      setForm({
        nome: disciplina.nome,
        codigo: disciplina.codigo,
        area: disciplina.area || areas[0] || AREAS_DEFAULT[0],
        descricao: disciplina.descricao,
        ativo: disciplina.ativo,
        tipo: disciplina.tipo || 'continuidade',
        classeInicio: disciplina.classeInicio || '',
        classeFim: disciplina.classeFim || '',
        componente: disciplina.componente || '',
      });
    } else {
      setForm({ ...EMPTY_FORM, area: areas[0] || AREAS_DEFAULT[0] });
    }
  }, [disciplina, visible, areas]);

  const set = (k: keyof FormState, v: any) => setForm(f => ({
    ...f,
    [k]: v,
    ...(k === 'area' && v !== 'Formação Profissional' ? { componente: '' } : {}),
  }));

  async function handleSave() {
    if (!form.nome.trim()) {
      webAlert('Campo obrigatório', 'O nome da disciplina é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const pickerOptions: Record<NonNullable<PickerField>, string[]> = {
    area: areas,
    classeInicio: classesRaw,
    classeFim: classesRaw,
  };

  const pickerTitles: Record<NonNullable<PickerField>, string> = {
    area: 'Área de Conhecimento',
    classeInicio: 'Classe de Início',
    classeFim: 'Classe de Fim',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={[mStyles.container, { paddingBottom: bottomPad + 16 }]}>
          <View style={mStyles.header}>
            <Text style={mStyles.title}>{disciplina ? 'Editar Disciplina' : 'Nova Disciplina'}</Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Nome */}
            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Nome da Disciplina *</Text>
              <TextInput
                style={mStyles.input}
                value={form.nome}
                onChangeText={v => set('nome', v)}
                placeholder="Ex: Matemática"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>

            {/* Código */}
            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Código</Text>
              <TextInput
                style={mStyles.input}
                value={form.codigo}
                onChangeText={v => set('codigo', v.toUpperCase())}
                placeholder="Ex: MAT"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                maxLength={6}
              />
            </View>

            {/* Componente — apenas para Formação Profissional (cursos técnico-profissionais) */}
            {form.area === 'Formação Profissional' && (
              <View style={mStyles.field}>
                <Text style={mStyles.fieldLabel}>Componente Curricular</Text>
                <Text style={mStyles.fieldHint}>
                  Seleccione a componente curricular deste curso técnico-profissional.
                </Text>
                <View style={mStyles.compRow}>
                  {COMPONENTES.map(c => {
                    const active = form.componente === c;
                    const color = COMPONENTE_COLORS[c];
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[mStyles.compBtn, active && { backgroundColor: color + '22', borderColor: color + '70' }]}
                        onPress={() => set('componente', active ? '' : c)}
                      >
                        <MaterialCommunityIcons
                          name={COMPONENTE_ICONS[c] as any}
                          size={15}
                          color={active ? color : Colors.textMuted}
                        />
                        <Text style={[mStyles.compBtnText, active && { color, fontFamily: 'Inter_600SemiBold' }]}>
                          {COMPONENTE_SHORT[c]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Área */}
            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Área de Conhecimento</Text>
              <TouchableOpacity
                style={[mStyles.input, mStyles.pickerBtn]}
                onPress={() => setActivePicker('area')}
              >
                <Text style={{ color: Colors.text, fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 }}>
                  {form.area || 'Seleccionar área...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Tipo */}
            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Tipo de Disciplina</Text>
              <View style={mStyles.tipoRow}>
                <TouchableOpacity
                  style={[mStyles.tipoBtn, form.tipo === 'continuidade' && mStyles.tipoBtnActive]}
                  onPress={() => set('tipo', 'continuidade')}
                >
                  <MaterialCommunityIcons
                    name="arrow-right-bold-circle"
                    size={16}
                    color={form.tipo === 'continuidade' ? Colors.info : Colors.textMuted}
                  />
                  <Text style={[mStyles.tipoBtnText, form.tipo === 'continuidade' && mStyles.tipoBtnTextActive]}>
                    Continuidade
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mStyles.tipoBtn, form.tipo === 'terminal' && mStyles.tipoBtnTerminal]}
                  onPress={() => set('tipo', 'terminal')}
                >
                  <MaterialCommunityIcons
                    name="flag-checkered"
                    size={16}
                    color={form.tipo === 'terminal' ? Colors.warning : Colors.textMuted}
                  />
                  <Text style={[mStyles.tipoBtnText, form.tipo === 'terminal' && mStyles.tipoBtnTextTerminal]}>
                    Terminal
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={mStyles.tipoHint}>
                {form.tipo === 'terminal'
                  ? 'Disciplina terminal: leccionada num intervalo específico de classes.'
                  : 'Disciplina de continuidade: leccionada ao longo de vários anos consecutivos.'}
              </Text>
            </View>

            {/* Intervalo de Classes */}
            <View style={mStyles.classeRow}>
              <View style={[mStyles.field, { flex: 1 }]}>
                <Text style={mStyles.fieldLabel}>Classe de Início</Text>
                <TouchableOpacity
                  style={[mStyles.input, mStyles.pickerBtn]}
                  onPress={() => setActivePicker('classeInicio')}
                >
                  <Text style={{ color: form.classeInicio ? Colors.text : Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 }} numberOfLines={1}>
                    {form.classeInicio || 'Seleccionar...'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={mStyles.classeSep}>
                <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
              </View>
              <View style={[mStyles.field, { flex: 1 }]}>
                <Text style={mStyles.fieldLabel}>Classe de Fim</Text>
                <TouchableOpacity
                  style={[mStyles.input, mStyles.pickerBtn]}
                  onPress={() => setActivePicker('classeFim')}
                >
                  <Text style={{ color: form.classeFim ? Colors.text : Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 }} numberOfLines={1}>
                    {form.classeFim || 'Seleccionar...'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Descrição */}
            <View style={mStyles.field}>
              <Text style={mStyles.fieldLabel}>Descrição</Text>
              <TextInput
                style={[mStyles.input, mStyles.textarea]}
                value={form.descricao}
                onChangeText={v => set('descricao', v)}
                placeholder="Descrição breve da disciplina..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Activa */}
            <View style={mStyles.switchRow}>
              <Text style={mStyles.fieldLabel}>Disciplina activa</Text>
              <TouchableOpacity
                style={[mStyles.toggleBtn, form.ativo && mStyles.toggleBtnActive]}
                onPress={() => set('ativo', !form.ativo)}
              >
                <Text style={[mStyles.toggleText, form.ativo && mStyles.toggleTextActive]}>
                  {form.ativo ? 'Activa' : 'Inactiva'}
                </Text>
              </TouchableOpacity>
            </View>

          </ScrollView>

          <TouchableOpacity style={mStyles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.text} />
              : <>
                <Ionicons name="checkmark" size={18} color={Colors.text} />
                <Text style={mStyles.saveBtnText}>Guardar</Text>
              </>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Picker modal genérico */}
      {activePicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setActivePicker(null)}>
          <TouchableOpacity style={mStyles.pickerOverlay} onPress={() => setActivePicker(null)} activeOpacity={1}>
            <View style={mStyles.pickerList}>
              <Text style={mStyles.pickerTitle}>{pickerTitles[activePicker]}</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                {pickerOptions[activePicker].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[mStyles.pickerItem, form[activePicker] === opt && mStyles.pickerItemActive]}
                    onPress={() => { set(activePicker, opt); setActivePicker(null); }}
                  >
                    <Text style={[mStyles.pickerItemText, form[activePicker] === opt && mStyles.pickerItemTextActive]}>{opt}</Text>
                    {form[activePicker] === opt && <Ionicons name="checkmark" size={16} color={Colors.gold} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </Modal>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AREA_COLORS: Record<string, string> = {
  'Ciências Exactas': '#3B82F6',
  'Ciências Naturais': '#10B981',
  'Ciências Sociais e Humanas': '#8B5CF6',
  'Línguas e Comunicação': '#F59E0B',
  'Artes e Expressão': '#EC4899',
  'Tecnologia e Informática': '#06B6D4',
  'Educação Física': '#F97316',
  'Formação Profissional': '#84CC16',
  'Outra': Colors.textMuted,
};

function areaColor(area: string) {
  return AREA_COLORS[area] || Colors.textMuted;
}

function tipoBadge(tipo: string, classeInicio: string, classeFim: string) {
  const isTerminal = tipo === 'terminal';
  const range = classeInicio && classeFim
    ? (classeInicio === classeFim ? classeInicio : `${classeInicio} – ${classeFim}`)
    : classeInicio || classeFim || null;
  return { isTerminal, range };
}

// ─── Ecrã Principal ───────────────────────────────────────────────────────────

export default function DisciplinasScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState<string>('Todas');
  const [filterTipo, setFilterTipo] = useState<string>('Todos');
  const [filterComp, setFilterComp] = useState<string>('Todas');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Disciplina | null>(null);
  const [showAreaFilter, setShowAreaFilter] = useState(false);
  const [showTipoFilter, setShowTipoFilter] = useState(false);
  const [showCompFilter, setShowCompFilter] = useState(false);

  const { values: areasFromDB } = useLookup('areas_conhecimento', AREAS_DEFAULT);

  const canEdit = ['admin', 'ceo', 'pca', 'director', 'chefe_secretaria', 'secretaria'].includes(user?.role ?? '');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/disciplinas');
      if (res.ok) setDisciplinas(await res.json());
    } catch {
      alertErro('Erro', 'Não foi possível carregar as disciplinas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const areas = ['Todas', ...areasFromDB];
  const tiposFilter = ['Todos', 'Continuidade', 'Terminal'];
  const compFilter = ['Todas', ...COMPONENTES, 'Sem componente'];

  const filtered = disciplinas.filter(d => {
    const matchSearch = d.nome.toLowerCase().includes(search.toLowerCase()) ||
      d.codigo.toLowerCase().includes(search.toLowerCase()) ||
      d.area.toLowerCase().includes(search.toLowerCase());
    const matchArea = filterArea === 'Todas' || d.area === filterArea;
    const matchTipo = filterTipo === 'Todos' ||
      (filterTipo === 'Terminal' && d.tipo === 'terminal') ||
      (filterTipo === 'Continuidade' && d.tipo !== 'terminal');
    const matchComp = filterComp === 'Todas' ||
      (filterComp === 'Sem componente' && !d.componente) ||
      d.componente === filterComp;
    return matchSearch && matchArea && matchTipo && matchComp;
  });

  // Contagens por componente
  const cSocio    = disciplinas.filter(d => d.componente === 'Sócio-Cultural').length;
  const cCiencia  = disciplinas.filter(d => d.componente === 'Científica').length;
  const cTec      = disciplinas.filter(d => d.componente === 'Técnica, Tecnológica e Prática').length;
  const cGeral    = disciplinas.filter(d => !d.componente).length;

  async function handleSave(form: FormState) {
    try {
      if (editItem) {
        const res = await fetch(`/api/disciplinas/${editItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Erro ao actualizar disciplina.');
        alertSucesso('Disciplina actualizada', `"${form.nome}" foi actualizada com sucesso.`);
      } else {
        const res = await fetch('/api/disciplinas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Erro ao criar disciplina.');
        alertSucesso('Disciplina criada', `"${form.nome}" foi adicionada ao catálogo.`);
      }
      await load();
      setEditItem(null);
    } catch (e: any) {
      alertErro('Erro', e.message);
      throw e;
    }
  }

  function handleDelete(d: Disciplina) {
    webAlert(
      'Remover Disciplina',
      `Tem a certeza que deseja remover "${d.nome}"? Esta acção não pode ser revertida.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`/api/disciplinas/${d.id}`, { method: 'DELETE' });
              if (!res.ok) throw new Error('Erro ao remover disciplina.');
              alertSucesso('Disciplina removida', `"${d.nome}" foi removida do catálogo.`);
              await load();
            } catch (e: any) {
              alertErro('Erro', e.message);
            }
          },
        },
      ]
    );
  }

  const renderItem = ({ item }: { item: Disciplina }) => {
    const color = areaColor(item.area);
    const { isTerminal, range } = tipoBadge(item.tipo, item.classeInicio, item.classeFim);
    const compColor = item.componente ? COMPONENTE_COLORS[item.componente] : null;
    return (
      <View style={[styles.card, !item.ativo && styles.cardInactive]}>
        <View style={[styles.cardLeft, { backgroundColor: color + '18', borderColor: color + '30' }]}>
          <MaterialCommunityIcons name="book-open-page-variant" size={20} color={color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName}>{item.nome}</Text>
            {item.codigo ? (
              <View style={[styles.codeBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.codeText, { color }]}>{item.codigo}</Text>
              </View>
            ) : null}
            <View style={[styles.tipoBadge, isTerminal ? styles.tipoBadgeTerminal : styles.tipoBadgeCont]}>
              <MaterialCommunityIcons
                name={isTerminal ? 'flag-checkered' : 'arrow-right-bold-circle'}
                size={10}
                color={isTerminal ? Colors.warning : Colors.info}
              />
              <Text style={[styles.tipoBadgeText, { color: isTerminal ? Colors.warning : Colors.info }]}>
                {isTerminal ? 'Terminal' : 'Continuidade'}
              </Text>
            </View>
            {!item.ativo && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveText}>Inactiva</Text>
              </View>
            )}
          </View>

          {/* Componente badge */}
          {item.componente ? (
            <View style={[styles.compBadge, { backgroundColor: compColor! + '18', borderColor: compColor! + '40' }]}>
              <MaterialCommunityIcons
                name={COMPONENTE_ICONS[item.componente] as any}
                size={10}
                color={compColor!}
              />
              <Text style={[styles.compBadgeText, { color: compColor! }]}>
                {COMPONENTE_SHORT[item.componente]}
              </Text>
            </View>
          ) : null}

          {item.area ? (
            <View style={styles.areaRow}>
              <View style={[styles.areaDot, { backgroundColor: color }]} />
              <Text style={styles.areaText}>{item.area}</Text>
            </View>
          ) : null}
          {range ? (
            <View style={styles.classeRangeRow}>
              <Ionicons name="school-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.classeRangeText}>{range}</Text>
            </View>
          ) : null}
          {item.descricao ? (
            <Text style={styles.descricao} numberOfLines={1}>{item.descricao}</Text>
          ) : null}
        </View>
        {canEdit && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { setEditItem(item); setShowForm(true); }}
            >
              <Ionicons name="create-outline" size={17} color={Colors.info} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
              <Ionicons name="trash-outline" size={17} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const hasActiveFilter = filterTipo !== 'Todos' || filterArea !== 'Todas' || filterComp !== 'Todas';

  return (
    <View style={styles.screen}>
      <TopBar
        title="Disciplinas"
        subtitle={`${disciplinas.length} no catálogo`}
        rightAction={canEdit ? { icon: 'add-circle', onPress: () => { setEditItem(null); setShowForm(true); } } : undefined}
      />

      {/* Hero — estatísticas por componente */}
      <LinearGradient colors={['#0D1B3E', '#112257']} style={styles.hero}>
        <Text style={styles.heroLabel}>Cursos Técnico-Profissionais</Text>
        <View style={styles.heroComps}>
          {COMPONENTES.map(c => {
            const count = c === 'Sócio-Cultural' ? cSocio : c === 'Científica' ? cCiencia : cTec;
            const col = COMPONENTE_COLORS[c];
            return (
              <TouchableOpacity
                key={c}
                style={[styles.heroCompItem, filterComp === c && { backgroundColor: col + '25' }]}
                onPress={() => setFilterComp(filterComp === c ? 'Todas' : c)}
              >
                <MaterialCommunityIcons name={COMPONENTE_ICONS[c] as any} size={16} color={col} />
                <Text style={[styles.heroCompCount, { color: col }]}>{count}</Text>
                <Text style={styles.heroCompLabel} numberOfLines={2}>{COMPONENTE_SHORT[c]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.heroDividerH} />
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={[styles.heroVal, { color: Colors.gold }]}>{disciplinas.length}</Text>
            <Text style={styles.heroLbl}>Total</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroVal, { color: Colors.info }]}>{disciplinas.filter(d => d.tipo !== 'terminal').length}</Text>
            <Text style={styles.heroLbl}>Continuidade</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroVal, { color: Colors.warning }]}>{disciplinas.filter(d => d.tipo === 'terminal').length}</Text>
            <Text style={styles.heroLbl}>Terminais</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroVal, { color: '#84CC16' }]}>{cGeral}</Text>
            <Text style={styles.heroLbl}>Ensino Geral</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Barra de pesquisa e filtros */}
      <View style={styles.filterRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Pesquisar disciplina..."
            placeholderTextColor={Colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, filterComp !== 'Todas' && { borderColor: COMPONENTE_COLORS[filterComp] + '70', backgroundColor: COMPONENTE_COLORS[filterComp] + '15' }]}
          onPress={() => setShowCompFilter(true)}
        >
          <MaterialCommunityIcons
            name="layers-triple"
            size={14}
            color={filterComp !== 'Todas' ? COMPONENTE_COLORS[filterComp] || Colors.gold : Colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filterTipo !== 'Todos' && styles.filterBtnActive]}
          onPress={() => setShowTipoFilter(true)}
        >
          <MaterialCommunityIcons
            name="flag-checkered"
            size={14}
            color={filterTipo !== 'Todos' ? Colors.warning : Colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filterArea !== 'Todas' && styles.filterBtnAreaActive]}
          onPress={() => setShowAreaFilter(true)}
        >
          <Ionicons name="filter" size={14} color={filterArea !== 'Todas' ? Colors.gold : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Chips de filtros activos */}
      {hasActiveFilter && (
        <View style={styles.activeFiltersRow}>
          {filterComp !== 'Todas' && (
            <TouchableOpacity
              style={[styles.activeFilterChip, { backgroundColor: (COMPONENTE_COLORS[filterComp] || Colors.textMuted) + '18', borderColor: (COMPONENTE_COLORS[filterComp] || Colors.textMuted) + '40' }]}
              onPress={() => setFilterComp('Todas')}
            >
              <Text style={[styles.activeFilterText, { color: COMPONENTE_COLORS[filterComp] || Colors.textMuted }]}>
                {COMPONENTE_SHORT[filterComp] || filterComp}
              </Text>
              <Ionicons name="close" size={11} color={COMPONENTE_COLORS[filterComp] || Colors.textMuted} />
            </TouchableOpacity>
          )}
          {filterTipo !== 'Todos' && (
            <TouchableOpacity style={styles.activeFilterChip} onPress={() => setFilterTipo('Todos')}>
              <Text style={styles.activeFilterText}>{filterTipo}</Text>
              <Ionicons name="close" size={11} color={Colors.warning} />
            </TouchableOpacity>
          )}
          {filterArea !== 'Todas' && (
            <TouchableOpacity style={[styles.activeFilterChip, styles.activeFilterChipArea]} onPress={() => setFilterArea('Todas')}>
              <Text style={[styles.activeFilterText, { color: Colors.gold }]}>{filterArea.split(' ')[0]}</Text>
              <Ionicons name="close" size={11} color={Colors.gold} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.clearAllBtn} onPress={() => { setFilterComp('Todas'); setFilterTipo('Todos'); setFilterArea('Todas'); }}>
            <Text style={styles.clearAllText}>Limpar tudo</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.gold} size="large" />
          <Text style={styles.loadingText}>A carregar disciplinas...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="book-open-page-variant-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {search || hasActiveFilter
                  ? 'Nenhuma disciplina encontrada'
                  : 'Sem disciplinas no catálogo'}
              </Text>
              <Text style={styles.emptyDesc}>
                {canEdit && !search && !hasActiveFilter
                  ? 'Clique em "+" para adicionar a primeira disciplina ao catálogo da escola.'
                  : 'Tente ajustar os filtros de pesquisa.'}
              </Text>
            </View>
          }
        />
      )}

      <DisciplinaFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        onSave={handleSave}
        disciplina={editItem}
      />

      {/* Filtro por Componente */}
      <Modal visible={showCompFilter} transparent animationType="fade" onRequestClose={() => setShowCompFilter(false)}>
        <TouchableOpacity style={mStyles.pickerOverlay} onPress={() => setShowCompFilter(false)} activeOpacity={1}>
          <View style={mStyles.pickerList}>
            <Text style={mStyles.pickerTitle}>Filtrar por Componente</Text>
            {compFilter.map(c => {
              const col = COMPONENTE_COLORS[c] || Colors.textMuted;
              const isNone = c === 'Sem componente';
              return (
                <TouchableOpacity
                  key={c}
                  style={[mStyles.pickerItem, filterComp === c && mStyles.pickerItemActive]}
                  onPress={() => { setFilterComp(c); setShowCompFilter(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {c !== 'Todas' && !isNone && (
                      <MaterialCommunityIcons name={COMPONENTE_ICONS[c] as any} size={14} color={col} />
                    )}
                    {isNone && <Ionicons name="remove-circle-outline" size={14} color={Colors.textMuted} />}
                    <Text style={[mStyles.pickerItemText, filterComp === c && mStyles.pickerItemTextActive, !isNone && c !== 'Todas' && { color: col }]}>{c}</Text>
                  </View>
                  {filterComp === c && <Ionicons name="checkmark" size={16} color={Colors.gold} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filtro por Tipo */}
      <Modal visible={showTipoFilter} transparent animationType="fade" onRequestClose={() => setShowTipoFilter(false)}>
        <TouchableOpacity style={mStyles.pickerOverlay} onPress={() => setShowTipoFilter(false)} activeOpacity={1}>
          <View style={mStyles.pickerList}>
            <Text style={mStyles.pickerTitle}>Filtrar por Tipo</Text>
            {tiposFilter.map(t => (
              <TouchableOpacity
                key={t}
                style={[mStyles.pickerItem, filterTipo === t && mStyles.pickerItemActive]}
                onPress={() => { setFilterTipo(t); setShowTipoFilter(false); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {t === 'Terminal' && <MaterialCommunityIcons name="flag-checkered" size={14} color={Colors.warning} />}
                  {t === 'Continuidade' && <MaterialCommunityIcons name="arrow-right-bold-circle" size={14} color={Colors.info} />}
                  <Text style={[mStyles.pickerItemText, filterTipo === t && mStyles.pickerItemTextActive]}>{t}</Text>
                </View>
                {filterTipo === t && <Ionicons name="checkmark" size={16} color={Colors.gold} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filtro por Área */}
      <Modal visible={showAreaFilter} transparent animationType="fade" onRequestClose={() => setShowAreaFilter(false)}>
        <TouchableOpacity style={mStyles.pickerOverlay} onPress={() => setShowAreaFilter(false)} activeOpacity={1}>
          <View style={mStyles.pickerList}>
            <Text style={mStyles.pickerTitle}>Filtrar por Área</Text>
            {areas.map(a => (
              <TouchableOpacity
                key={a}
                style={[mStyles.pickerItem, filterArea === a && mStyles.pickerItemActive]}
                onPress={() => { setFilterArea(a); setShowAreaFilter(false); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {a !== 'Todas' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: areaColor(a) }} />}
                  <Text style={[mStyles.pickerItemText, filterArea === a && mStyles.pickerItemTextActive]}>{a}</Text>
                </View>
                {filterArea === a && <Ionicons name="checkmark" size={16} color={Colors.gold} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Estilos do Modal ─────────────────────────────────────────────────────────

const mStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end', alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: Colors.border,
    padding: 20, maxHeight: '92%', width: '100%', maxWidth: 520,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  field: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary, marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted,
    marginBottom: 8, lineHeight: 15,
  },
  input: {
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text,
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center' },
  // Componente selector
  compRow: { gap: 8 },
  compBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  compBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted, flex: 1 },
  // Tipo selector
  tipoRow: { flexDirection: 'row', gap: 10 },
  tipoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tipoBtnActive: {
    backgroundColor: Colors.info + '18', borderColor: Colors.info + '60',
  },
  tipoBtnTerminal: {
    backgroundColor: Colors.warning + '18', borderColor: Colors.warning + '60',
  },
  tipoBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tipoBtnTextActive: { color: Colors.info, fontFamily: 'Inter_600SemiBold' },
  tipoBtnTextTerminal: { color: Colors.warning, fontFamily: 'Inter_600SemiBold' },
  tipoHint: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted,
    marginTop: 6, lineHeight: 16,
  },
  classeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  classeSep: { paddingBottom: 14, alignItems: 'center', justifyContent: 'center' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  toggleBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnActive: { backgroundColor: Colors.success + '20', borderColor: Colors.success + '50' },
  toggleText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted },
  toggleTextActive: { color: Colors.success },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent, borderRadius: 14,
    paddingVertical: 16, gap: 8, marginTop: 8,
  },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pickerList: {
    backgroundColor: Colors.backgroundCard, borderRadius: 18,
    padding: 16, width: '100%', maxWidth: 380,
    borderWidth: 1, borderColor: Colors.border,
  },
  pickerTitle: {
    fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text,
    marginBottom: 12, textAlign: 'center',
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10,
  },
  pickerItemActive: { backgroundColor: Colors.gold + '15' },
  pickerItemText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  pickerItemTextActive: { fontFamily: 'Inter_600SemiBold', color: Colors.gold },
});

// ─── Estilos da Lista ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  hero: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 18,
    padding: 16,
  },
  heroLabel: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  heroComps: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  heroCompItem: {
    flex: 1, alignItems: 'center', gap: 4,
    borderRadius: 12, padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  heroCompCount: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  heroCompLabel: {
    fontSize: 9, fontFamily: 'Inter_500Medium', color: Colors.textMuted,
    textAlign: 'center', lineHeight: 12,
  },
  heroDividerH: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.10)' },
  heroVal: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  heroLbl: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginTop: 12, marginBottom: 4,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 42, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  filterBtn: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnActive: { borderColor: Colors.warning + '60', backgroundColor: Colors.warning + '10' },
  filterBtnAreaActive: { borderColor: Colors.gold + '60', backgroundColor: Colors.gold + '10' },

  activeFiltersRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center',
  },
  activeFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warning + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.warning + '40',
  },
  activeFilterChipArea: {
    backgroundColor: Colors.gold + '18', borderColor: Colors.gold + '40',
  },
  activeFilterText: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.warning,
  },
  clearAllBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  clearAllText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  list: { padding: 16, paddingTop: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.backgroundCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  cardInactive: { opacity: 0.6 },
  cardLeft: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  cardName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  codeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  codeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  tipoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  tipoBadgeTerminal: { backgroundColor: Colors.warning + '18' },
  tipoBadgeCont: { backgroundColor: Colors.info + '18' },
  tipoBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  inactiveBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: Colors.textMuted + '20' },
  inactiveText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  // Componente badge na lista
  compBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1, marginTop: 5,
  },
  compBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  areaDot: { width: 6, height: 6, borderRadius: 3 },
  areaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  classeRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  classeRangeText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  descricao: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'column', gap: 6 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, textAlign: 'center' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
