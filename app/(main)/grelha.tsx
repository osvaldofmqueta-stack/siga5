import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface DiscRefLei {
  nome: string;
  codigo: string;
  horasSemana: number;
  horasAnuais: number;
  notaMinima: number;
  obrigatoria: boolean;
  observacao?: string;
}

interface CursoDB {
  id: string;
  nome: string;
  codigo: string;
  areaFormacao: string;
  descricao?: string;
  ativo: boolean;
}

interface CursoDisc {
  id: string;
  nome: string;
  codigo: string;
  area: string;
  tipo?: string;
  obrigatoria: boolean;
  cargaHoraria?: number;
  ordem?: number;
}

interface DiscCatalogo {
  id: string;
  nome: string;
  codigo: string;
  area: string;
  descricao?: string;
  tipo?: string;
  classeInicio?: string;
  classeFim?: string;
  ativo: boolean;
}

// ─── Dados Lei 17/16 (Primário e I Ciclo são imutáveis por lei) ─────────────

const PRIMARIO: DiscRefLei[] = [
  { nome: 'Língua Portuguesa', codigo: 'LP',  horasSemana: 8, horasAnuais: 320, notaMinima: 10, obrigatoria: true },
  { nome: 'Matemática',        codigo: 'MAT', horasSemana: 6, horasAnuais: 240, notaMinima: 10, obrigatoria: true },
  { nome: 'Estudo do Meio',    codigo: 'EM',  horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
  { nome: 'Educação Física',   codigo: 'EF',  horasSemana: 2, horasAnuais: 80,  notaMinima: 10, obrigatoria: true },
  { nome: 'Educação Artística',codigo: 'EA',  horasSemana: 2, horasAnuais: 80,  notaMinima: 10, obrigatoria: true },
  { nome: 'Educação Moral e Cívica', codigo: 'EMC', horasSemana: 1, horasAnuais: 40, notaMinima: 10, obrigatoria: true },
  { nome: 'Língua Estrangeira', codigo: 'LE', horasSemana: 2, horasAnuais: 80, notaMinima: 10, obrigatoria: false, observacao: 'A partir da 4ª Classe' },
];

const I_CICLO: DiscRefLei[] = [
  { nome: 'Língua Portuguesa',       codigo: 'LP',  horasSemana: 5, horasAnuais: 200, notaMinima: 10, obrigatoria: true },
  { nome: 'Matemática',              codigo: 'MAT', horasSemana: 5, horasAnuais: 200, notaMinima: 10, obrigatoria: true },
  { nome: 'Física',                  codigo: 'FIS', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
  { nome: 'Química',                 codigo: 'QUI', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
  { nome: 'Biologia',                codigo: 'BIO', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
  { nome: 'História',                codigo: 'HIS', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
  { nome: 'Geografia',               codigo: 'GEO', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
  { nome: 'Língua Estrangeira I',    codigo: 'LEI', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
  { nome: 'Educação Física',         codigo: 'EF',  horasSemana: 2, horasAnuais: 80,  notaMinima: 10, obrigatoria: true },
  { nome: 'Educação Visual e Plástica', codigo: 'EVP', horasSemana: 2, horasAnuais: 80, notaMinima: 10, obrigatoria: true },
];

const TABS = ['Primário', 'I Ciclo', 'II Ciclo', 'Catálogo'] as const;
type Tab = typeof TABS[number];

const TAB_COLORS: Record<Tab, string> = {
  'Primário': Colors.success,
  'I Ciclo':  Colors.info,
  'II Ciclo': Colors.gold,
  'Catálogo': '#8B5CF6',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcTotalLei(discs: DiscRefLei[]) {
  return {
    count: discs.length,
    semana: discs.reduce((s, d) => s + d.horasSemana, 0),
    anual:  discs.reduce((s, d) => s + d.horasAnuais, 0),
  };
}

const AREA_COLORS: Record<string, string> = {
  'Ciências e Tecnologia':                          Colors.info,
  'Ciências Económicas Jurídicas e Sociais':        '#10B981',
  'Humanidades':                                    '#8B5CF6',
  'Artes':                                          '#EC4899',
  'Ciências de Informação e Comunicação':           '#06B6D4',
  'Formação de Professores':                        Colors.gold,
  'Ciências Exactas':                               Colors.info,
  'Ciências Naturais':                              '#10B981',
  'Ciências Sociais e Humanas':                     '#8B5CF6',
  'Línguas e Comunicação':                          '#F59E0B',
  'Artes e Expressão':                              '#EC4899',
  'Tecnologia e Informática':                       '#06B6D4',
  'Educação Física':                                '#F97316',
  'Formação Profissional':                          '#84CC16',
};

function areaColor(area: string) {
  return AREA_COLORS[area] || Colors.textMuted;
}

// ─── Componentes internos ────────────────────────────────────────────────────

function LeiDiscRow({ disc, cor, onPress }: { disc: DiscRefLei; cor: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tableRow} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <View style={styles.discNameRow}>
          <View style={[styles.codBadge, { backgroundColor: cor + '22' }]}>
            <Text style={[styles.codText, { color: cor }]}>{disc.codigo}</Text>
          </View>
          <Text style={styles.discNome} numberOfLines={1}>{disc.nome}</Text>
          {!disc.obrigatoria && (
            <View style={[styles.optBadge, { borderColor: Colors.info + '60' }]}>
              <Text style={styles.optBadgeText}>Optativa</Text>
            </View>
          )}
        </View>
        {disc.observacao ? <Text style={styles.discObs}>{disc.observacao}</Text> : null}
      </View>
      <Text style={[styles.tableCell, { width: 40 }]}>{disc.horasSemana}h</Text>
      <Text style={[styles.tableCell, { width: 52, color: Colors.textMuted }]}>{disc.horasAnuais}h</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function SistemaAvaliacao() {
  return (
    <View style={styles.sistemaNota}>
      <View style={styles.sistemaHeader}>
        <Ionicons name="school" size={18} color={Colors.gold} />
        <Text style={styles.sistemaNoteTitle}>Sistema de Avaliação</Text>
      </View>
      <View style={styles.sistemaRow}>
        {[
          { label: 'PP — Prova Periódica',    value: '30%' },
          { label: 'MT — Média de Trabalhos', value: '30%' },
          { label: 'PT — Prova Trimestral',   value: '40%' },
        ].map(item => (
          <View key={item.label} style={styles.sistemaItem}>
            <Text style={styles.sistemaItemLabel}>{item.label}</Text>
            <Text style={styles.sistemaItemValue}>{item.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.macInfo}>
        <Text style={styles.macLabel}>MAC = (PP + MT + PT) / 3 — Mínimo de Aprovação: 10 valores</Text>
      </View>
    </View>
  );
}

// ─── Tab: Primário / I Ciclo ─────────────────────────────────────────────────

function TabRefLei({
  nivel, classes, descricao, cor, disciplinas,
}: {
  nivel: string; classes: string; descricao: string; cor: string; disciplinas: DiscRefLei[];
}) {
  const [detalhe, setDetalhe] = useState<DiscRefLei | null>(null);
  const total = calcTotalLei(disciplinas);

  return (
    <>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.enquadramentoCard, { borderLeftColor: cor }]}>
          <View style={styles.enquadramentoHeader}>
            <Ionicons name="information-circle" size={20} color={cor} />
            <Text style={styles.enquadramentoTitle}>Enquadramento Lei 17/16</Text>
          </View>
          <Text style={styles.enquadramentoClasses}>{classes}</Text>
          <Text style={styles.enquadramentoDesc}>{descricao}</Text>
          <View style={styles.enquadramentoLei}>
            <FontAwesome5 name="balance-scale" size={12} color={Colors.textMuted} />
            <Text style={styles.enquadramentoLeiText}>
              Lei n.º 17/16 de 7 de Outubro — Lei de Bases do Sistema de Educação e Ensino (Angola)
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Disciplinas', value: `${total.count}`, color: cor },
            { label: 'H/Semana',    value: `${total.semana}h`, color: cor },
            { label: 'H/Ano',       value: `${total.anual}h`,  color: cor },
            { label: 'Mín. Aprov.', value: '10',               color: Colors.success },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Disciplinas da Grelha</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Disciplina</Text>
          <Text style={[styles.tableHeaderText, { width: 40 }]}>H/Sem</Text>
          <Text style={[styles.tableHeaderText, { width: 52 }]}>H/Ano</Text>
          <View style={{ width: 24 }} />
        </View>

        {disciplinas.map((disc, i) => (
          <View key={disc.codigo} style={i % 2 !== 0 ? styles.tableRowAlt : undefined}>
            <LeiDiscRow disc={disc} cor={cor} onPress={() => setDetalhe(disc)} />
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={[styles.totalValue, { width: 40, color: cor }]}>{total.semana}h</Text>
          <Text style={[styles.totalValue, { width: 52, color: Colors.textMuted }]}>{total.anual}h</Text>
          <View style={{ width: 24 }} />
        </View>

        <SistemaAvaliacao />
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={!!detalhe} transparent animationType="slide" onRequestClose={() => setDetalhe(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {detalhe && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.codBadgeLg, { backgroundColor: cor + '22' }]}>
                    <Text style={[styles.codTextLg, { color: cor }]}>{detalhe.codigo}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{detalhe.nome}</Text>
                    <Text style={styles.modalSub}>{nivel} — {classes}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetalhe(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={22} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.detalheGrid}>
                  {[
                    { label: 'Horas / Semana', value: `${detalhe.horasSemana}h`, color: cor },
                    { label: 'Horas / Ano',    value: `${detalhe.horasAnuais}h`, color: cor },
                    { label: 'Nota Mínima',    value: `${detalhe.notaMinima} val.`, color: Colors.success },
                    { label: 'Tipo',           value: detalhe.obrigatoria ? 'Obrigatória' : 'Optativa', color: detalhe.obrigatoria ? Colors.accent : Colors.info },
                  ].map(d => (
                    <View key={d.label} style={styles.detalheItem}>
                      <Text style={styles.detalheItemLabel}>{d.label}</Text>
                      <Text style={[styles.detalheItemValue, { color: d.color }]}>{d.value}</Text>
                    </View>
                  ))}
                </View>
                {detalhe.observacao ? (
                  <View style={styles.obsCard}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
                    <Text style={styles.obsText}>{detalhe.observacao}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Tab: II Ciclo dinâmico ──────────────────────────────────────────────────

function TabIICiclo() {
  const cor = TAB_COLORS['II Ciclo'];
  const [cursos, setCursos] = useState<CursoDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursoSel, setCursoSel] = useState<CursoDB | null>(null);
  const [discsDoC, setDiscsDoC] = useState<CursoDisc[]>([]);
  const [loadingDiscs, setLoadingDiscs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cursos');
      if (res.ok) {
        const data: CursoDB[] = await res.json();
        const ativos = data.filter(c => c.ativo);
        setCursos(ativos);
        if (ativos.length > 0 && !cursoSel) {
          setCursoSel(ativos[0]);
        }
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!cursoSel) return;
    setLoadingDiscs(true);
    fetch(`/api/cursos/${cursoSel.id}/disciplinas`)
      .then(r => r.ok ? r.json() : [])
      .then((data: CursoDisc[]) => setDiscsDoC(Array.isArray(data) ? data : []))
      .catch(() => setDiscsDoC([]))
      .finally(() => setLoadingDiscs(false));
  }, [cursoSel]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={cor} size="large" />
        <Text style={styles.loadingText}>A carregar cursos...</Text>
      </View>
    );
  }

  if (cursos.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyBox}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} colors={[cor]} />}
      >
        <MaterialCommunityIcons name="book-open-variant" size={48} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Sem cursos registados</Text>
        <Text style={styles.emptyDesc}>Os cursos do II Ciclo são geridos em Configurações → Cursos.</Text>
      </ScrollView>
    );
  }

  const totalDiscs = discsDoC.length;
  const obrigatorias = discsDoC.filter(d => d.obrigatoria).length;
  const cargaTotal = discsDoC.reduce((s, d) => s + (d.cargaHoraria || 0), 0);

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} colors={[cor]} />}
    >
      <View style={[styles.enquadramentoCard, { borderLeftColor: cor }]}>
        <View style={styles.enquadramentoHeader}>
          <Ionicons name="information-circle" size={20} color={cor} />
          <Text style={styles.enquadramentoTitle}>II Ciclo — 10ª a 13ª Classe</Text>
        </View>
        <Text style={styles.enquadramentoDesc}>
          Segundo ciclo do Ensino Secundário (4 anos). Organizado por áreas de formação especializadas.
          Cada curso define o seu plano curricular com disciplinas obrigatórias e optativas.
        </Text>
        <View style={styles.enquadramentoLei}>
          <FontAwesome5 name="balance-scale" size={12} color={Colors.textMuted} />
          <Text style={styles.enquadramentoLeiText}>
            Lei n.º 17/16 — Plano curricular definido pela escola conforme área de formação aprovada pelo MED
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Área de Formação</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cursoTabs}>
        {cursos.map(c => {
          const isActive = cursoSel?.id === c.id;
          const acor = areaColor(c.areaFormacao);
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.cursoTab, isActive && { backgroundColor: acor + '22', borderColor: acor }]}
              onPress={() => setCursoSel(c)}
              activeOpacity={0.75}
            >
              <Text style={[styles.cursoTabCode, { color: isActive ? acor : Colors.textMuted }]}>
                {c.codigo || '—'}
              </Text>
              <Text style={[styles.cursoTabNome, isActive && { color: acor }]} numberOfLines={2}>
                {c.nome}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {cursoSel && (
        <>
          <View style={[styles.cursoInfoCard, { borderLeftColor: areaColor(cursoSel.areaFormacao) }]}>
            <Text style={[styles.cursoInfoArea, { color: areaColor(cursoSel.areaFormacao) }]}>
              {cursoSel.areaFormacao}
            </Text>
            <Text style={styles.cursoInfoNome}>{cursoSel.nome}</Text>
            {cursoSel.descricao ? (
              <Text style={styles.cursoInfoDesc}>{cursoSel.descricao}</Text>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            {[
              { label: 'Disciplinas', value: `${totalDiscs}`, color: areaColor(cursoSel.areaFormacao) },
              { label: 'Obrigatórias', value: `${obrigatorias}`, color: Colors.accent },
              { label: 'Carga Total', value: cargaTotal > 0 ? `${cargaTotal}h` : '—', color: Colors.gold },
              { label: 'Mín. Aprov.', value: '10', color: Colors.success },
            ].map(s => (
              <View key={s.label} style={styles.statCard}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {loadingDiscs ? (
            <ActivityIndicator color={areaColor(cursoSel.areaFormacao)} style={{ marginTop: 24 }} />
          ) : discsDoC.length === 0 ? (
            <View style={styles.emptyInline}>
              <MaterialCommunityIcons name="book-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyInlineText}>
                Nenhuma disciplina atribuída a este curso.{'\n'}Configure em Configurações → Cursos.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Plano Curricular</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Disciplina</Text>
                <Text style={[styles.tableHeaderText, { width: 52 }]}>Carga</Text>
                <Text style={[styles.tableHeaderText, { width: 60 }]}>Tipo</Text>
              </View>
              {discsDoC
                .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99))
                .map((disc, i) => (
                  <View key={disc.id} style={[styles.tableRow, i % 2 !== 0 && styles.tableRowAlt]}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.discNameRow}>
                        <View style={[styles.codBadge, { backgroundColor: areaColor(disc.area) + '22' }]}>
                          <Text style={[styles.codText, { color: areaColor(disc.area) }]}>
                            {disc.codigo || '—'}
                          </Text>
                        </View>
                        <Text style={styles.discNome} numberOfLines={1}>{disc.nome}</Text>
                      </View>
                      {disc.area ? (
                        <Text style={[styles.discObs, { color: areaColor(disc.area) }]}>{disc.area}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.tableCell, { width: 52, color: Colors.textMuted }]}>
                      {disc.cargaHoraria ? `${disc.cargaHoraria}h` : '—'}
                    </Text>
                    <View style={{ width: 60, alignItems: 'center' }}>
                      <View style={[
                        styles.tipoPill,
                        { backgroundColor: disc.obrigatoria ? Colors.accent + '20' : Colors.info + '20' },
                      ]}>
                        <Text style={[
                          styles.tipoPillText,
                          { color: disc.obrigatoria ? Colors.accent : Colors.info },
                        ]}>
                          {disc.obrigatoria ? 'Obrig.' : 'Optativa'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
            </>
          )}
        </>
      )}

      <SistemaAvaliacao />
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Tab: Catálogo de Disciplinas (dinâmico) ─────────────────────────────────

function TabCatalogo() {
  const cor = TAB_COLORS['Catálogo'];
  const [disciplinas, setDisciplinas] = useState<DiscCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/disciplinas');
      if (res.ok) {
        const data: DiscCatalogo[] = await res.json();
        setDisciplinas(Array.isArray(data) ? data.filter(d => d.ativo) : []);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const byArea = disciplinas.reduce<Record<string, DiscCatalogo[]>>((acc, d) => {
    const a = d.area || 'Sem Área';
    if (!acc[a]) acc[a] = [];
    acc[a].push(d);
    return acc;
  }, {});

  const areas = Object.keys(byArea).sort();

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={cor} size="large" />
        <Text style={styles.loadingText}>A carregar catálogo...</Text>
      </View>
    );
  }

  if (disciplinas.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyBox}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} colors={[cor]} />}
      >
        <MaterialCommunityIcons name="book-search-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Catálogo vazio</Text>
        <Text style={styles.emptyDesc}>Adicione disciplinas em Gestão Académica → Disciplinas.</Text>
      </ScrollView>
    );
  }

  const continuidade = disciplinas.filter(d => d.tipo !== 'terminal').length;
  const terminal = disciplinas.filter(d => d.tipo === 'terminal').length;

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} colors={[cor]} />}
    >
      <View style={styles.statsRow}>
        {[
          { label: 'Total',         value: `${disciplinas.length}`, color: cor },
          { label: 'Áreas',         value: `${areas.length}`,       color: Colors.info },
          { label: 'Continuidade',  value: `${continuidade}`,       color: Colors.success },
          { label: 'Terminal',      value: `${terminal}`,           color: Colors.warning },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {areas.map(area => {
        const discs = byArea[area];
        const isOpen = expandedArea === area;
        const acor = areaColor(area);
        return (
          <View key={area} style={styles.areaSection}>
            <TouchableOpacity
              style={[styles.areaHeader, { borderLeftColor: acor }]}
              onPress={() => setExpandedArea(isOpen ? null : area)}
              activeOpacity={0.75}
            >
              <View style={[styles.areaIconWrap, { backgroundColor: acor + '22' }]}>
                <MaterialCommunityIcons name="book-open-page-variant" size={18} color={acor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.areaNome}>{area}</Text>
                <Text style={styles.areaCount}>{discs.length} disciplina{discs.length !== 1 ? 's' : ''}</Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            {isOpen && discs.map((d, i) => (
              <View key={d.id} style={[styles.catalogoRow, i % 2 !== 0 && styles.tableRowAlt]}>
                <View style={[styles.codBadge, { backgroundColor: acor + '22' }]}>
                  <Text style={[styles.codText, { color: acor }]}>{d.codigo || '—'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.discNome}>{d.nome}</Text>
                  {(d.classeInicio || d.classeFim) ? (
                    <Text style={styles.discObs}>
                      {d.classeInicio === d.classeFim
                        ? d.classeInicio
                        : `${d.classeInicio || '—'} → ${d.classeFim || '—'}`}
                    </Text>
                  ) : null}
                </View>
                <View style={[
                  styles.tipoPill,
                  { backgroundColor: d.tipo === 'terminal' ? Colors.warning + '20' : Colors.success + '20' },
                ]}>
                  <Text style={[
                    styles.tipoPillText,
                    { color: d.tipo === 'terminal' ? Colors.warning : Colors.success },
                  ]}>
                    {d.tipo === 'terminal' ? 'Terminal' : 'Continuidade'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Screen principal ────────────────────────────────────────────────────────

export default function GrelhaScreen() {
  const [tabAtiva, setTabAtiva] = useState<Tab>('Primário');
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <TopBar title="Grelha Curricular" subtitle="Sistema Educativo Angolano — Lei 17/16" />

      <View style={styles.nivelTabs}>
        {TABS.map(tab => {
          const isActive = tabAtiva === tab;
          const cor = TAB_COLORS[tab];
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.nivelTab, isActive && { borderBottomColor: cor, borderBottomWidth: 3 }]}
              onPress={() => setTabAtiva(tab)}
            >
              <Text style={[styles.nivelTabText, isActive && { color: cor }]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tabAtiva === 'Primário' && (
        <TabRefLei
          nivel="Primário"
          classes="1ª — 6ª Classe"
          descricao="Ensino Primário obrigatório (6 anos). Foco no desenvolvimento de competências básicas de leitura, escrita e cálculo."
          cor={TAB_COLORS['Primário']}
          disciplinas={PRIMARIO}
        />
      )}
      {tabAtiva === 'I Ciclo' && (
        <TabRefLei
          nivel="I Ciclo"
          classes="7ª — 9ª Classe"
          descricao="Primeiro ciclo do Ensino Secundário (3 anos). Aprofundamento das ciências e humanidades com base multidisciplinar."
          cor={TAB_COLORS['I Ciclo']}
          disciplinas={I_CICLO}
        />
      )}
      {tabAtiva === 'II Ciclo' && <TabIICiclo />}
      {tabAtiva === 'Catálogo' && <TabCatalogo />}
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background },
  nivelTabs:      { flexDirection: 'row', backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  nivelTab:       { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  nivelTabText:   { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  scroll:         { flex: 1 },

  enquadramentoCard:     { margin: 16, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 16, borderLeftWidth: 4 },
  enquadramentoHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  enquadramentoTitle:    { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  enquadramentoClasses:  { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 6 },
  enquadramentoDesc:     { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20, marginBottom: 10 },
  enquadramentoLei:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  enquadramentoLeiText:  { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontStyle: 'italic', lineHeight: 16 },

  statsRow:   { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  statCard:   { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 10, alignItems: 'center' },
  statValue:  { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel:  { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2, textAlign: 'center' },

  sectionTitle:     { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, paddingHorizontal: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  tableHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.surface },
  tableHeaderText:  { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  tableRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableRowAlt:      { backgroundColor: 'rgba(26,43,95,0.3)' },
  totalRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface },
  totalLabel:       { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  totalValue:       { fontSize: 14, fontFamily: 'Inter_700Bold', textAlign: 'center' },

  discNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  codText:      { fontSize: 10, fontFamily: 'Inter_700Bold' },
  discNome:     { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  discObs:      { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.info, marginTop: 2, marginLeft: 50 },
  tableCell:    { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, textAlign: 'center' },
  optBadge:     { borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  optBadgeText: { fontSize: 9, fontFamily: 'Inter_500Medium', color: Colors.info },

  tipoPill:     { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  tipoPillText: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },

  sistemaNota:     { margin: 16, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 16 },
  sistemaHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sistemaNoteTitle:{ fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  sistemaRow:      { gap: 8 },
  sistemaItem:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sistemaItemLabel:{ fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  sistemaItemValue:{ fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold },
  macInfo:         { marginTop: 12, backgroundColor: Colors.surface, borderRadius: 8, padding: 10 },
  macLabel:        { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:     { backgroundColor: Colors.backgroundCard, borderRadius: 24, padding: 24, width: '100%', maxWidth: 480 },
  modalHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  modalTitle:   { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  modalSub:     { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  modalClose:   { padding: 4 },
  codBadgeLg:   { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codTextLg:    { fontSize: 14, fontFamily: 'Inter_700Bold' },
  detalheGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  detalheItem:  { width: '47%', backgroundColor: Colors.surface, borderRadius: 12, padding: 14 },
  detalheItemLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 4 },
  detalheItemValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  obsCard:  { flexDirection: 'row', gap: 8, backgroundColor: Colors.surface, borderRadius: 10, padding: 12, alignItems: 'flex-start' },
  obsText:  { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.info },

  cursoTabs:     { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  cursoTab:      { minWidth: 120, maxWidth: 160, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cursoTabCode:  { fontSize: 11, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  cursoTabNome:  { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, textAlign: 'center' },

  cursoInfoCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderLeftWidth: 4 },
  cursoInfoArea: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  cursoInfoNome: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  cursoInfoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20 },

  areaSection: { marginHorizontal: 16, marginBottom: 8 },
  areaHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderLeftWidth: 4 },
  areaIconWrap:{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  areaNome:    { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  areaCount:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  catalogoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + '60' },

  centerBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  emptyBox:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle:  { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  emptyDesc:   { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyInline: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyInlineText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
