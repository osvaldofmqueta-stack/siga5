import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuth, getAuthToken } from '@/context/AuthContext';
import { api } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import { webAlert } from '@/utils/webAlert';
import { consultarNIF } from '@/lib/nifLookup';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MEDConfig {
  codigoMED: string;
  nifEscola: string;
  nomeEscola: string;
  provinciaEscola: string;
  municipioEscola: string;
  tipoEnsino: string;
  modalidade: string;
  directorGeral: string;
  directorPedagogico: string;
  directorProvincialEducacao: string;
}

interface MEDStats {
  alunos: { total: number; masculino: number; feminino: number };
  professores: { total: number; ativos: number };
  turmas: number;
  taxaAprovacao: number;
}

type ExportType = 'matriculas' | 'professores' | 'resultados' | 'frequencias' | 'consolidado';
type ExportFormat = 'csv' | 'xml' | 'json' | 'xlsx';

interface AuditLog {
  id: string;
  userEmail: string;
  userRole: string;
  acao: string;
  descricao: string;
  ipAddress: string;
  createdAt: string;
}

const ALLOWED_ROLES = ['ceo', 'pca', 'admin', 'director', 'chefe_secretaria'];

const TIPO_ENSINO_OPTIONS = ['Primário', 'Secundário', 'Técnico-Profissional', 'Superior'];
const MODALIDADE_OPTIONS = ['Presencial', 'Semi-presencial', 'EaD'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {sub && <Text style={styles.statSub}>{sub}</Text>}
      </View>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={16} color={Colors.gold} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, editable = true, onSubmitEditing }: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string; editable?: boolean; onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={Colors.textMuted}
        editable={editable}
        returnKeyType={onSubmitEditing ? 'done' : undefined}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

function OptionPicker({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.optionPill, value === opt && styles.optionPillActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.optionPillText, value === opt && styles.optionPillTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Export Card ─────────────────────────────────────────────────────────────

function ExportCard({
  title, description, icon, color, type, anoLetivo,
  onExported,
}: {
  title: string; description: string; icon: string; color: string;
  type: ExportType; anoLetivo: string; onExported: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [trimestre, setTrimestre] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const doExport = useCallback(async () => {
    if (Platform.OS !== 'web') {
      webAlert('Exportação', 'A exportação directa está disponível apenas na versão Web. Use o portal SIGE Gov para submissão.');
      return;
    }
    setLoading(true);
    try {
      const token = await getAuthToken() ?? '';

      if (format === 'xlsx') {
        const xlsxParams = new URLSearchParams();
        if (anoLetivo) xlsxParams.set('anoLetivo', anoLetivo);
        const url = `/api/med/export/xlsx/${type}?${xlsxParams}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) { const err = await resp.json(); throw new Error(err.error ?? 'Erro na exportação'); }
        const blob = await resp.blob();
        const cd = resp.headers.get('Content-Disposition') ?? '';
        const match = cd.match(/filename="(.+?)"/);
        const fname = match?.[1] ?? `MED_${type}_${new Date().toISOString().slice(0,10)}.xlsx`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        a.click();
      } else {
        const params = new URLSearchParams({ formato: format });
        if (anoLetivo) params.set('anoLetivo', anoLetivo);
        if (type === 'resultados' && trimestre) params.set('trimestre', trimestre);
        const url = `/api/med/export/${type}?${params}`;

        if (format === 'json') {
          const data = await api.get<unknown>(url);
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `MED_${type}_${anoLetivo || 'todos'}_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
        } else {
          const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) { const err = await resp.json(); throw new Error(err.error ?? 'Erro na exportação'); }
          const blob = await resp.blob();
          const cd = resp.headers.get('Content-Disposition') ?? '';
          const match = cd.match(/filename="(.+?)"/);
          const fname = match?.[1] ?? `export.${format}`;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = fname;
          a.click();
        }
      }
      setLastExport(new Date().toLocaleString('pt-AO'));
      onExported();
    } catch (e) {
      if (Platform.OS === 'web') {
        window.alert('Erro na exportação: ' + (e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [type, format, anoLetivo, trimestre, onExported]);

  return (
    <View style={[styles.exportCard, { borderLeftColor: color }]}>
      <View style={styles.exportCardHeader}>
        <View style={[styles.exportIcon, { backgroundColor: `${color}18` }]}>
          <MaterialCommunityIcons name={icon as any} size={24} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.exportTitle}>{title}</Text>
          <Text style={styles.exportDesc}>{description}</Text>
          {lastExport && <Text style={styles.exportLast}>Último: {lastExport}</Text>}
        </View>
      </View>

      {/* Trimestre filter (only for results) */}
      {type === 'resultados' && (
        <View style={styles.exportFilters}>
          <Text style={styles.exportFilterLabel}>Trimestre</Text>
          <View style={styles.exportFilterRow}>
            {['', '1', '2', '3'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tPill, trimestre === t && styles.tPillActive]}
                onPress={() => setTrimestre(t)}
              >
                <Text style={[styles.tPillText, trimestre === t && styles.tPillTextActive]}>
                  {t === '' ? 'Todos' : `T${t}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Format selector */}
      <View style={styles.exportActions}>
        <View style={styles.formatRow}>
          {(type === 'consolidado'
            ? ['json'] as ExportFormat[]
            : ['csv', 'xlsx', 'xml', 'json'] as ExportFormat[]
          ).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.formatPill, format === f && styles.formatPillActive, f === 'xlsx' && styles.formatPillXlsx, f === 'xlsx' && format === f && styles.formatPillXlsxActive]}
              onPress={() => setFormat(f)}
            >
              <Text style={[styles.formatPillText, format === f && styles.formatPillTextActive]}>
                {f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: color }, loading && { opacity: 0.7 }]}
          onPress={doExport}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.exportBtnText}>Exportar</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MEDIntegracaoScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { anoLetivo } = useAnoAcademico();

  const [config, setConfig] = useState<MEDConfig>({
    codigoMED: '', nifEscola: '', nomeEscola: '', provinciaEscola: '', municipioEscola: '',
    tipoEnsino: 'Secundário', modalidade: 'Presencial',
    directorGeral: '', directorPedagogico: '', directorProvincialEducacao: '',
  });
  const [stats, setStats] = useState<MEDStats | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'exportar' | 'config' | 'historico'>('exportar');
  const [exportCount, setExportCount] = useState(0);
  const [historico, setHistorico] = useState<AuditLog[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [nifEscolaLookupLoading, setNifEscolaLookupLoading] = useState(false);
  const [nifEscolaLookupStatus, setNifEscolaLookupStatus] = useState<'idle' | 'found' | 'not_found' | 'error'>('idle');
  const [nifEscolaFoundName, setNifEscolaFoundName] = useState('');

  const hasAccess = user && ALLOWED_ROLES.includes(user.role);

  const loadData = useCallback(async () => {
    if (!hasAccess) return;
    setLoadingConfig(true);
    try {
      const [cfg, st] = await Promise.all([
        api.get<MEDConfig>('/api/med/config'),
        api.get<MEDStats>('/api/med/stats'),
      ]);
      setConfig(cfg);
      setStats(st);
    } catch (e) {
      console.error('MED load error', e);
    } finally {
      setLoadingConfig(false);
    }
  }, [hasAccess]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadHistorico = useCallback(async () => {
    if (!hasAccess) return;
    setLoadingHistorico(true);
    try {
      const logs = await api.get<AuditLog[]>('/api/med/historico');
      setHistorico(logs);
    } catch (e) {
      console.error('Historico load error', e);
    } finally {
      setLoadingHistorico(false);
    }
  }, [hasAccess]);

  useEffect(() => {
    if (activeTab === 'historico') loadHistorico();
  }, [activeTab, loadHistorico]);

  const saveConfig = useCallback(async () => {
    setSavingConfig(true);
    setConfigSaved(false);
    try {
      await api.patch('/api/med/config', config as any);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (e) {
      if (Platform.OS === 'web') window.alert('Erro ao guardar: ' + (e as Error).message);
    } finally {
      setSavingConfig(false);
    }
  }, [config]);

  const onExported = useCallback(() => setExportCount(c => c + 1), []);

  async function lookupNIFEscola(nif: string) {
    if (!nif?.trim() || nif.trim().length < 9) return;
    setNifEscolaLookupLoading(true);
    setNifEscolaLookupStatus('idle');
    setNifEscolaFoundName('');
    try {
      const data = await consultarNIF(nif);
      if (data) {
        setConfig(c => ({ ...c, nomeEscola: data.nome }));
        setNifEscolaFoundName(data.nome);
        setNifEscolaLookupStatus('found');
      } else {
        setNifEscolaLookupStatus('not_found');
      }
    } catch {
      setNifEscolaLookupStatus('error');
    } finally {
      setNifEscolaLookupLoading(false);
    }
  }

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <TopBar title="Integração MED" />
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.accessDeniedTitle}>Acesso Restrito</Text>
          <Text style={styles.accessDeniedSub}>Apenas administradores têm acesso à integração com o MED.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <TopBar title="Integração MED" />

      {/* MED Identity Banner */}
      <View style={styles.medBanner}>
        <View style={styles.medBannerLeft}>
          <View style={styles.medLogoBox}>
            <MaterialCommunityIcons name="shield-star" size={28} color="#4A90D9" />
          </View>
          <View>
            <Text style={styles.medBannerTitle}>Ministério da Educação de Angola</Text>
            <Text style={styles.medBannerSub}>
              SIGE Gov  ·  Código: {config.codigoMED || '—'}  ·  NIF: {config.nifEscola || '—'}
            </Text>
          </View>
        </View>
        <View style={[styles.medStatusBadge, { backgroundColor: config.codigoMED ? '#2ECC7122' : '#F39C1222', borderColor: config.codigoMED ? '#2ECC71' : '#F39C12' }]}>
          <Ionicons name={config.codigoMED ? 'checkmark-circle' : 'alert-circle'} size={12} color={config.codigoMED ? '#2ECC71' : '#F39C12'} />
          <Text style={[styles.medStatusText, { color: config.codigoMED ? '#2ECC71' : '#F39C12' }]}>
            {config.codigoMED ? 'Configurado' : 'Incompleto'}
          </Text>
        </View>
      </View>

      {/* Stats Row */}
      {stats && (
        <View style={styles.statsRow}>
          <StatCard label="Alunos" value={stats.alunos.total}
            sub={`♂ ${stats.alunos.masculino}  ♀ ${stats.alunos.feminino}`}
            color={Colors.info} icon="account-school" />
          <StatCard label="Professores" value={stats.professores.ativos}
            color={Colors.success} icon="human-male-board" />
          <StatCard label="Turmas" value={stats.turmas}
            color={Colors.gold} icon="google-classroom" />
          <StatCard label="Aprovação" value={`${stats.taxaAprovacao}%`}
            color={Colors.approved} icon="check-decagram" />
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'exportar' && styles.tabActive]} onPress={() => setActiveTab('exportar')}>
          <Ionicons name="cloud-upload-outline" size={15} color={activeTab === 'exportar' ? Colors.gold : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'exportar' && styles.tabTextActive]}>Exportar</Text>
          {exportCount > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{exportCount}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'historico' && styles.tabActive]} onPress={() => setActiveTab('historico')}>
          <Ionicons name="time-outline" size={15} color={activeTab === 'historico' ? Colors.gold : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'historico' && styles.tabTextActive]}>Histórico</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'config' && styles.tabActive]} onPress={() => setActiveTab('config')}>
          <Ionicons name="settings-outline" size={15} color={activeTab === 'config' ? Colors.gold : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'config' && styles.tabTextActive]}>Config.</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loadingConfig ? (
          <ActivityIndicator color={Colors.gold} size="large" style={{ marginTop: 40 }} />
        ) : activeTab === 'historico' ? (
          <>
            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
              <Text style={styles.infoNoteText}>
                Registo das últimas 50 exportações e acções realizadas neste módulo. Inclui utilizador, formato e data/hora.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: Colors.primary }]}
                onPress={loadHistorico}
                disabled={loadingHistorico}
              >
                {loadingHistorico
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="refresh-outline" size={14} color="#fff" /><Text style={styles.exportBtnText}>Actualizar</Text></>
                }
              </TouchableOpacity>
            </View>
            {historico.length === 0 ? (
              <View style={styles.emptyHistorico}>
                <MaterialCommunityIcons name="history" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyHistoricoText}>Sem exportações registadas</Text>
                <Text style={[styles.emptyHistoricoText, { fontSize: 12, marginTop: 4 }]}>As exportações realizadas aparecerão aqui</Text>
              </View>
            ) : (
              historico.map((log) => {
                const isExport = log.acao === 'exportar';
                const color = isExport ? '#2ECC71' : Colors.gold;
                const dt = new Date(log.createdAt);
                return (
                  <View key={log.id} style={[styles.histCard, { borderLeftColor: color }]}>
                    <View style={[styles.histIcon, { backgroundColor: `${color}15` }]}>
                      <MaterialCommunityIcons
                        name={isExport ? 'file-export' : 'cog'}
                        size={18} color={color}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.histDesc} numberOfLines={2}>{log.descricao}</Text>
                      <Text style={styles.histMeta}>{log.userEmail} · {log.userRole}</Text>
                      <Text style={styles.histDate}>
                        {dt.toLocaleDateString('pt-AO')} às {dt.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
                        {log.ipAddress ? `  ·  IP: ${log.ipAddress}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.histBadge, { backgroundColor: `${color}22`, borderColor: `${color}60` }]}>
                      <Text style={[styles.histBadgeText, { color }]}>{log.acao.toUpperCase()}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : activeTab === 'exportar' ? (
          <>
            {/* Info note */}
            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
              <Text style={styles.infoNoteText}>
                Os ficheiros gerados são compatíveis com o portal SIGE Gov do Ministério da Educação de Angola.
                Seleccione o formato pretendido e faça o upload no portal{' '}
                <Text style={styles.infoNoteLink}>sige.med.gov.ao</Text> com as suas credenciais institucionais.
              </Text>
            </View>

            <SectionHeader title="Relatórios a Exportar" icon="document-text-outline" />

            <ExportCard
              title="Mapa de Matrículas"
              description="Listagem completa de alunos inscritos com dados demográficos e de turma"
              icon="account-multiple"
              color="#3498DB"
              type="matriculas"
              anoLetivo={anoLetivo}
              onExported={onExported}
            />
            <ExportCard
              title="Mapa de Professores"
              description="Corpo docente activo com habilitações, disciplinas e tipo de contrato"
              icon="human-male-board"
              color="#2ECC71"
              type="professores"
              anoLetivo={anoLetivo}
              onExported={onExported}
            />
            <ExportCard
              title="Resultados Académicos"
              description="Notas e situação de aprovação por aluno, disciplina e trimestre"
              icon="chart-bar"
              color="#F39C12"
              type="resultados"
              anoLetivo={anoLetivo}
              onExported={onExported}
            />
            <ExportCard
              title="Frequências e Presenças"
              description="Taxa de presença e número de faltas por aluno ao longo do ano"
              icon="calendar-check"
              color="#9B59B6"
              type="frequencias"
              anoLetivo={anoLetivo}
              onExported={onExported}
            />

            <SectionHeader title="Relatório Consolidado" icon="file-chart-outline" />

            <View style={styles.consolidadoCard}>
              <View style={styles.consolidadoHeader}>
                <MaterialCommunityIcons name="file-chart" size={28} color={Colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.consolidadoTitle}>Relatório Consolidado MED</Text>
                  <Text style={styles.consolidadoDesc}>
                    Documento único com sumário executivo, mapa de matrículas por classe/género e indicadores-chave.
                    Adequado para submissão ao Director Provincial de Educação.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.consolidadoBtn}
                onPress={async () => {
                  if (Platform.OS !== 'web') { webAlert('Disponível apenas na versão Web.'); return; }
                  try {
                    const token = await getAuthToken() ?? '';
                    const params = anoLetivo ? `?anoLetivo=${anoLetivo}` : '';
                    const data = await fetch(`/api/med/export/consolidado${params}`, { headers: { Authorization: `Bearer ${token}` } });
                    const json = await data.json();
                    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `MED_Consolidado_${anoLetivo || 'todos'}_${new Date().toISOString().slice(0,10)}.json`;
                    a.click();
                    onExported();
                  } catch (e) { window.alert('Erro: ' + (e as Error).message); }
                }}
              >
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.consolidadoBtnText}>Descarregar Consolidado (JSON)</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Config tab */}
            <View style={styles.configCard}>
              <SectionHeader title="Identificação da Escola (MED)" icon="school-outline" />

              <Field label="Código MED" value={config.codigoMED}
                onChange={v => setConfig(c => ({ ...c, codigoMED: v }))}
                placeholder="Ex: AO-LDA-2024-001" />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>NIF da Escola</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    style={[styles.fieldInput, { flex: 1 }]}
                    value={config.nifEscola}
                    onChangeText={v => { setConfig(c => ({ ...c, nifEscola: v })); setNifEscolaLookupStatus('idle'); setNifEscolaFoundName(''); }}
                    onBlur={() => lookupNIFEscola(config.nifEscola)}
                    placeholder="Número de Identificação Fiscal"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[nifBtnStyle, nifEscolaLookupLoading && { opacity: 0.6 }]}
                    onPress={() => lookupNIFEscola(config.nifEscola)}
                    disabled={nifEscolaLookupLoading}
                  >
                    {nifEscolaLookupLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="search" size={16} color="#fff" />}
                  </TouchableOpacity>
                </View>
                {nifEscolaLookupStatus === 'found' && (
                  <View style={nifBadgeStyle}>
                    <Ionicons name="checkmark-circle" size={14} color="#2ECC71" />
                    <Text style={[nifBadgeTextStyle, { color: '#2ECC71' }]}>Nome obtido: {nifEscolaFoundName}</Text>
                  </View>
                )}
                {(nifEscolaLookupStatus === 'not_found' || nifEscolaLookupStatus === 'error') && (
                  <View style={nifBadgeStyle}>
                    <Ionicons name="warning-outline" size={14} color="#F39C12" />
                    <Text style={[nifBadgeTextStyle, { color: '#F39C12' }]}>NIF não encontrado — preencha manualmente</Text>
                  </View>
                )}
              </View>
              <Field label="Nome Oficial da Escola" value={config.nomeEscola}
                onChange={v => setConfig(c => ({ ...c, nomeEscola: v }))} onSubmitEditing={saveConfig} />
              <Field label="Província" value={config.provinciaEscola}
                onChange={v => setConfig(c => ({ ...c, provinciaEscola: v }))}
                placeholder="Ex: Luanda" onSubmitEditing={saveConfig} />
              <Field label="Município" value={config.municipioEscola}
                onChange={v => setConfig(c => ({ ...c, municipioEscola: v }))}
                placeholder="Ex: Luanda" onSubmitEditing={saveConfig} />

              <OptionPicker label="Tipo de Ensino" options={TIPO_ENSINO_OPTIONS}
                value={config.tipoEnsino}
                onChange={v => setConfig(c => ({ ...c, tipoEnsino: v }))} />
              <OptionPicker label="Modalidade" options={MODALIDADE_OPTIONS}
                value={config.modalidade}
                onChange={v => setConfig(c => ({ ...c, modalidade: v }))} />
            </View>

            <View style={styles.configCard}>
              <SectionHeader title="Direcção" icon="people-outline" />
              <Field label="Director Geral" value={config.directorGeral}
                onChange={v => setConfig(c => ({ ...c, directorGeral: v }))}
                placeholder="Nome completo" onSubmitEditing={saveConfig} />
              <Field label="Director Pedagógico" value={config.directorPedagogico}
                onChange={v => setConfig(c => ({ ...c, directorPedagogico: v }))}
                placeholder="Nome completo" onSubmitEditing={saveConfig} />
              <Field label="Director Provincial de Educação" value={config.directorProvincialEducacao}
                onChange={v => setConfig(c => ({ ...c, directorProvincialEducacao: v }))}
                placeholder="Nome completo" onSubmitEditing={saveConfig} />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, savingConfig && { opacity: 0.7 }]}
              onPress={saveConfig}
              disabled={savingConfig}
            >
              {savingConfig
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name={configSaved ? 'checkmark-circle' : 'save-outline'} size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>{configSaved ? 'Configurações Guardadas!' : 'Guardar Configurações'}</Text>
                  </>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── NIF lookup inline styles ────────────────────────────────────────────────
const nifBtnStyle = {
  width: 38, height: 38, borderRadius: 8, backgroundColor: Colors.accent,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
const nifBadgeStyle = {
  flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
  marginTop: 6, paddingHorizontal: 10, paddingVertical: 5,
  borderRadius: 8, backgroundColor: Colors.surface,
};
const nifBadgeTextStyle = {
  fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1,
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  accessDeniedTitle: { fontSize: 20, color: Colors.text, fontFamily: 'Inter_700Bold' },
  accessDeniedSub: { fontSize: 14, color: Colors.textMuted, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  medBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A0000', borderBottomWidth: 1, borderBottomColor: '#4A90D940',
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
  },
  medBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  medLogoBox: {
    width: 46, height: 46, borderRadius: 10,
    backgroundColor: '#4A90D918', borderWidth: 1, borderColor: '#4A90D940',
    alignItems: 'center', justifyContent: 'center',
  },
  medBannerTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  medBannerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  medStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  medStatusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  statCard: {
    flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 10,
    padding: 10, borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  statIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 9, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },
  statSub: { fontSize: 9, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { borderColor: Colors.gold, backgroundColor: `${Colors.gold}12` },
  tabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tabTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },
  tabBadge: {
    backgroundColor: Colors.gold, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1,
    minWidth: 18, alignItems: 'center',
  },
  tabBadgeText: { fontSize: 10, color: Colors.primaryDark, fontFamily: 'Inter_700Bold' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  infoNote: {
    flexDirection: 'row', gap: 10, backgroundColor: `${Colors.info}12`,
    borderRadius: 10, padding: 12, borderWidth: 1, borderColor: `${Colors.info}30`,
    marginBottom: 4, alignItems: 'flex-start',
  },
  infoNoteText: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  infoNoteLink: { color: Colors.info, fontFamily: 'Inter_600SemiBold' },

  exportCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
    padding: 14, marginBottom: 12,
  },
  exportCardHeader: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  exportIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  exportTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 3 },
  exportDesc: { fontSize: 12, color: Colors.textMuted, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  exportLast: { fontSize: 11, color: Colors.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 4 },

  exportFilters: { marginBottom: 10 },
  exportFilterLabel: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_400Regular', marginBottom: 6 },
  exportFilterRow: { flexDirection: 'row', gap: 6 },
  tPill: {
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border,
  },
  tPillActive: { backgroundColor: `${Colors.gold}22`, borderColor: Colors.gold },
  tPillText: { fontSize: 12, color: Colors.textSecondary, fontFamily: 'Inter_400Regular' },
  tPillTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  exportActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  formatRow: { flexDirection: 'row', gap: 6 },
  formatPill: {
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border,
  },
  formatPillActive: { backgroundColor: `${Colors.primaryLight}50`, borderColor: Colors.primaryLight },
  formatPillText: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_600SemiBold' },
  formatPillTextActive: { color: Colors.text, fontFamily: 'Inter_700Bold' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  exportBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  consolidadoCard: {
    backgroundColor: `${Colors.gold}12`, borderRadius: 12,
    borderWidth: 1, borderColor: `${Colors.gold}40`, padding: 16,
  },
  consolidadoHeader: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  consolidadoTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.gold, marginBottom: 4 },
  consolidadoDesc: { fontSize: 12, color: Colors.textSecondary, fontFamily: 'Inter_400Regular', lineHeight: 17, flex: 1 },
  consolidadoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: 10, paddingVertical: 12,
  },
  consolidadoBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.primaryDark },

  configCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 12,
  },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_400Regular', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: {
    backgroundColor: Colors.backgroundElevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.text, fontFamily: 'Inter_400Regular', fontSize: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  fieldInputDisabled: { opacity: 0.5 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionPill: {
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.backgroundElevated, borderWidth: 1, borderColor: Colors.border,
  },
  optionPillActive: { backgroundColor: `${Colors.gold}22`, borderColor: Colors.gold },
  optionPillText: { fontSize: 13, color: Colors.textSecondary, fontFamily: 'Inter_400Regular' },
  optionPillTextActive: { color: Colors.gold, fontFamily: 'Inter_600SemiBold' },

  formatPillXlsx: { borderColor: '#1D6F42' },
  formatPillXlsxActive: { backgroundColor: '#1D6F4222', borderColor: '#1D6F42' },

  histCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.backgroundCard, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
    padding: 12, marginBottom: 8,
  },
  histIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  histDesc: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text, lineHeight: 18 },
  histMeta: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },
  histDate: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },
  histBadge: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1,
    alignSelf: 'flex-start', flexShrink: 0,
  },
  histBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold' },

  emptyHistorico: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyHistoricoText: { fontSize: 15, color: Colors.textMuted, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.primaryLight,
  },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
