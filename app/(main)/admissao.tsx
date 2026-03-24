import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { alertSucesso, alertErro } from '@/utils/toast';
import DatePickerField from '@/components/DatePickerField';

interface Registro {
  id: string;
  nomeCompleto: string;
  dataNascimento: string;
  genero: string;
  provincia: string;
  municipio: string;
  telefone: string;
  email: string;
  nivel: string;
  classe: string;
  status: string;
  senhaProvisoria?: string;
  dataProva?: string;
  notaAdmissao?: number;
  resultadoAdmissao?: string;
  matriculaCompleta?: boolean;
  rupeInscricao?: string;
  criadoEm: string;
  nomeEncarregado: string;
  telefoneEncarregado: string;
}

type TabKey = 'pendentes' | 'aprovados' | 'resultado' | 'concluidos';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: Colors.warning },
  aprovado: { label: 'Aprovado p/ Exame', color: '#3498DB' },
  rejeitado: { label: 'Rejeitado', color: Colors.danger },
  admitido: { label: 'Admitido', color: Colors.success },
  reprovado_admissao: { label: 'Reprovado', color: Colors.danger },
  matriculado: { label: 'Matriculado', color: Colors.gold },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABEL[status] ?? { label: status, color: Colors.textMuted };
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.color + '20' }]}>
      <Text style={[badge.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
});

export default function AdmissaoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('pendentes');
  const [search, setSearch] = useState('');

  const [modalRejeitar, setModalRejeitar] = useState<{ visible: boolean; reg: Registro | null }>({ visible: false, reg: null });
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [modalProva, setModalProva] = useState<{ visible: boolean; reg: Registro | null }>({ visible: false, reg: null });
  const [dataProva, setDataProva] = useState('');
  const [modalNota, setModalNota] = useState<{ visible: boolean; reg: Registro | null }>({ visible: false, reg: null });
  const [nota, setNota] = useState('');
  const [modalDetalhes, setModalDetalhes] = useState<{ visible: boolean; reg: Registro | null }>({ visible: false, reg: null });
  const [isActing, setIsActing] = useState(false);

  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom;

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/registros');
      const data = await res.json();
      setRegistros(Array.isArray(data) ? data : []);
    } catch { setRegistros([]); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const byTab: Record<TabKey, Registro[]> = {
      pendentes: registros.filter(r => r.status === 'pendente'),
      aprovados: registros.filter(r => r.status === 'aprovado'),
      resultado: registros.filter(r => r.status === 'admitido' || r.status === 'reprovado_admissao'),
      concluidos: registros.filter(r => r.status === 'matriculado' || r.status === 'rejeitado'),
    };
    const list = byTab[activeTab];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(r => r.nomeCompleto.toLowerCase().includes(q) || r.classe.toLowerCase().includes(q));
  }, [registros, activeTab, search]);

  async function aprovar(reg: Registro) {
    setIsActing(true);
    try {
      const res = await fetch(`/api/registros/${reg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'aprovado', avaliadoPor: user?.nome, avaliadoEm: new Date().toISOString().split('T')[0] }),
      });
      if (!res.ok) throw new Error();
      await load();
      alertSucesso('Candidato aprovado', `${reg.nomeCompleto} foi aprovado(a) para o exame de admissão.`);
    } catch { alertErro('Erro', 'Não foi possível aprovar. Tente novamente.'); }
    finally { setIsActing(false); }
  }

  async function rejeitar() {
    const reg = modalRejeitar.reg;
    if (!reg || !motivoRejeicao.trim()) { Alert.alert('Motivo obrigatório', 'Indique o motivo da rejeição.'); return; }
    setIsActing(true);
    try {
      const res = await fetch(`/api/registros/${reg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejeitado', motivoRejeicao: motivoRejeicao.trim(), avaliadoPor: user?.nome, avaliadoEm: new Date().toISOString().split('T')[0] }),
      });
      if (!res.ok) throw new Error();
      await load();
      setModalRejeitar({ visible: false, reg: null });
      setMotivoRejeicao('');
      alertSucesso('Candidatura rejeitada', `A candidatura de ${reg.nomeCompleto} foi rejeitada.`);
    } catch { alertErro('Erro', 'Não foi possível rejeitar. Tente novamente.'); }
    finally { setIsActing(false); }
  }

  async function publicarDataProva() {
    const reg = modalProva.reg;
    if (!reg || !dataProva.trim()) { Alert.alert('Data obrigatória', 'Seleccione a data do exame.'); return; }
    setIsActing(true);
    try {
      const res = await fetch(`/api/registros/${reg.id}/publicar-data-prova`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataProva: dataProva.trim() }),
      });
      if (!res.ok) throw new Error();
      await load();
      setModalProva({ visible: false, reg: null });
      setDataProva('');
      alertSucesso('Data publicada', 'A data do exame foi publicada com sucesso.');
    } catch { alertErro('Erro', 'Não foi possível publicar a data.'); }
    finally { setIsActing(false); }
  }

  async function lancarNota() {
    const reg = modalNota.reg;
    if (!reg || nota.trim() === '') { Alert.alert('Nota obrigatória', 'Introduza a nota do exame.'); return; }
    const n = parseFloat(nota.replace(',', '.'));
    if (isNaN(n) || n < 0 || n > 20) { Alert.alert('Nota inválida', 'A nota deve estar entre 0 e 20.'); return; }
    setIsActing(true);
    try {
      const res = await fetch(`/api/registros/${reg.id}/lancar-nota`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notaAdmissao: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
      setModalNota({ visible: false, reg: null });
      setNota('');
      const resultado = n >= 10 ? 'ADMITIDO' : 'NÃO ADMITIDO';
      alertSucesso('Nota lançada', `${reg.nomeCompleto}: ${n}/20 — ${resultado}`);
    } catch (e: any) { alertErro('Erro', e.message || 'Não foi possível lançar a nota.'); }
    finally { setIsActing(false); }
  }

  const TABS = [
    { key: 'pendentes' as TabKey, label: 'Pendentes', icon: 'hourglass-outline', count: registros.filter(r => r.status === 'pendente').length },
    { key: 'aprovados' as TabKey, label: 'Aprovados', icon: 'checkmark-circle-outline', count: registros.filter(r => r.status === 'aprovado').length },
    { key: 'resultado' as TabKey, label: 'Resultado', icon: 'trophy-outline', count: registros.filter(r => ['admitido', 'reprovado_admissao'].includes(r.status)).length },
    { key: 'concluidos' as TabKey, label: 'Concluídos', icon: 'ribbon-outline', count: registros.filter(r => ['matriculado', 'rejeitado'].includes(r.status)).length },
  ];

  function renderItem({ item: reg }: { item: Registro }) {
    return (
      <View style={styles.regCard}>
        <View style={styles.regCardTop}>
          <View style={styles.regAvatar}>
            <Text style={styles.regAvatarText}>{reg.nomeCompleto[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.regNome}>{reg.nomeCompleto}</Text>
            <Text style={styles.regSub}>{reg.nivel} · {reg.classe}</Text>
            {reg.email ? <Text style={styles.regEmail}>{reg.email}</Text> : null}
          </View>
          <StatusBadge status={reg.status} />
        </View>

        {reg.dataProva && (
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={12} color={Colors.gold} />
            <Text style={styles.infoText}>Exame: {reg.dataProva}</Text>
          </View>
        )}
        {reg.notaAdmissao !== undefined && reg.notaAdmissao !== null && (
          <View style={styles.infoRow}>
            <Ionicons name="ribbon-outline" size={12} color={reg.notaAdmissao >= 10 ? Colors.success : Colors.danger} />
            <Text style={styles.infoText}>Nota: {reg.notaAdmissao}/20 — {reg.notaAdmissao >= 10 ? 'Admitido' : 'Reprovado'}</Text>
          </View>
        )}
        {reg.senhaProvisoria && (
          <View style={styles.infoRow}>
            <Ionicons name="lock-closed-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.infoText}>Senha: {reg.senhaProvisoria}</Text>
          </View>
        )}

        <View style={styles.regActions}>
          <TouchableOpacity style={styles.regActionBtn} onPress={() => setModalDetalhes({ visible: true, reg })}>
            <Ionicons name="eye-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.regActionText}>Ver</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.regActionBtn, styles.btnBoletim]} onPress={() => router.push(`/boletim-inscricao?id=${reg.id}` as any)}>
            <Ionicons name="document-text-outline" size={14} color={Colors.gold} />
            <Text style={[styles.regActionText, { color: Colors.gold }]}>Boletim</Text>
          </TouchableOpacity>

          {/* Pendentes actions */}
          {reg.status === 'pendente' && <>
            <TouchableOpacity style={[styles.regActionBtn, styles.btnSuccess]} onPress={() => aprovar(reg)} disabled={isActing}>
              <Ionicons name="checkmark" size={14} color={Colors.success} />
              <Text style={[styles.regActionText, { color: Colors.success }]}>Aprovar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.regActionBtn, styles.btnDanger]} onPress={() => { setModalRejeitar({ visible: true, reg }); setMotivoRejeicao(''); }}>
              <Ionicons name="close" size={14} color={Colors.danger} />
              <Text style={[styles.regActionText, { color: Colors.danger }]}>Rejeitar</Text>
            </TouchableOpacity>
          </>}

          {/* Aprovados actions */}
          {reg.status === 'aprovado' && <>
            <TouchableOpacity style={[styles.regActionBtn, styles.btnGold]} onPress={() => { setModalProva({ visible: true, reg }); setDataProva(reg.dataProva || ''); }}>
              <Ionicons name="calendar-outline" size={14} color={Colors.gold} />
              <Text style={[styles.regActionText, { color: Colors.gold }]}>Data Prova</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.regActionBtn, styles.btnSuccess]} onPress={() => { setModalNota({ visible: true, reg }); setNota(reg.notaAdmissao !== undefined ? String(reg.notaAdmissao) : ''); }}>
              <Ionicons name="ribbon-outline" size={14} color={Colors.success} />
              <Text style={[styles.regActionText, { color: Colors.success }]}>Lançar Nota</Text>
            </TouchableOpacity>
          </>}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title="Processo de Admissão" subtitle="Gestão de inscrições e resultados" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={styles.tabsContent}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Ionicons name={t.icon as any} size={13} color={activeTab === t.key ? Colors.gold : Colors.textMuted} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            {t.count > 0 && (
              <View style={[styles.tabBadge, activeTab === t.key && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === t.key && styles.tabBadgeTextActive]}>{t.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Pesquisar nome ou classe..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Nenhuma inscrição neste separador</Text>
          <TouchableOpacity onPress={load} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={15} color={Colors.textMuted} />
            <Text style={styles.refreshBtnText}>Actualizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 24, gap: 12 }}
          showsVerticalScrollIndicator={false}
          onRefresh={load}
          refreshing={isLoading}
        />
      )}

      {/* ── Rejeitar Modal ── */}
      <Modal visible={modalRejeitar.visible} transparent animationType="slide" onRequestClose={() => setModalRejeitar({ visible: false, reg: null })}>
        <View style={mStyles.overlay}>
          <View style={mStyles.container}>
            <Text style={mStyles.title}>Rejeitar Inscrição</Text>
            {modalRejeitar.reg && <Text style={mStyles.name}>{modalRejeitar.reg.nomeCompleto}</Text>}
            <Text style={mStyles.label}>Motivo da Rejeição *</Text>
            <TextInput
              style={mStyles.textarea}
              value={motivoRejeicao}
              onChangeText={setMotivoRejeicao}
              placeholder="Descreva o motivo..."
              placeholderTextColor={Colors.textMuted}
              multiline numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={mStyles.actions}>
              <TouchableOpacity style={mStyles.cancelBtn} onPress={() => setModalRejeitar({ visible: false, reg: null })}>
                <Text style={mStyles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mStyles.actionBtn, { backgroundColor: Colors.danger }]} onPress={rejeitar} disabled={isActing}>
                {isActing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={mStyles.actionText}>Rejeitar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Data da Prova Modal ── */}
      <Modal visible={modalProva.visible} transparent animationType="slide" onRequestClose={() => setModalProva({ visible: false, reg: null })}>
        <View style={mStyles.overlay}>
          <View style={mStyles.container}>
            <Text style={mStyles.title}>Publicar Data do Exame</Text>
            {modalProva.reg && <Text style={mStyles.name}>{modalProva.reg.nomeCompleto}</Text>}
            <Text style={mStyles.label}>Data do Exame *</Text>
            <DatePickerField
              label=""
              value={dataProva}
              onChange={setDataProva}
              required
              style={{ marginBottom: 0 }}
            />
            <View style={mStyles.actions}>
              <TouchableOpacity style={mStyles.cancelBtn} onPress={() => setModalProva({ visible: false, reg: null })}>
                <Text style={mStyles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mStyles.actionBtn, { backgroundColor: Colors.gold }]} onPress={publicarDataProva} disabled={isActing}>
                {isActing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={mStyles.actionText}>Publicar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Lançar Nota Modal ── */}
      <Modal visible={modalNota.visible} transparent animationType="slide" onRequestClose={() => setModalNota({ visible: false, reg: null })}>
        <View style={mStyles.overlay}>
          <View style={mStyles.container}>
            <Text style={mStyles.title}>Lançar Nota de Admissão</Text>
            {modalNota.reg && <Text style={mStyles.name}>{modalNota.reg.nomeCompleto}</Text>}
            <Text style={mStyles.label}>Nota (0 – 20) *</Text>
            <TextInput
              style={mStyles.input}
              value={nota}
              onChangeText={setNota}
              placeholder="Ex: 14.5"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
            <Text style={mStyles.hint}>Nota ≥ 10: Admitido · Nota {'<'} 10: Reprovado</Text>
            <View style={mStyles.actions}>
              <TouchableOpacity style={mStyles.cancelBtn} onPress={() => setModalNota({ visible: false, reg: null })}>
                <Text style={mStyles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mStyles.actionBtn, { backgroundColor: Colors.success }]} onPress={lancarNota} disabled={isActing}>
                {isActing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={mStyles.actionText}>Lançar Nota</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Detalhes Modal ── */}
      <Modal visible={modalDetalhes.visible} transparent animationType="slide" onRequestClose={() => setModalDetalhes({ visible: false, reg: null })}>
        <View style={mStyles.overlay}>
          <View style={[mStyles.container, { gap: 8 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={mStyles.title}>Detalhes da Inscrição</Text>
              <TouchableOpacity onPress={() => setModalDetalhes({ visible: false, reg: null })}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {modalDetalhes.reg && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                {[
                  ['Nome', modalDetalhes.reg.nomeCompleto],
                  ['Data Nascimento', modalDetalhes.reg.dataNascimento],
                  ['Género', modalDetalhes.reg.genero === 'M' ? 'Masculino' : 'Feminino'],
                  ['Nível / Classe', `${modalDetalhes.reg.nivel} — ${modalDetalhes.reg.classe}`],
                  ['Província / Município', `${modalDetalhes.reg.provincia} / ${modalDetalhes.reg.municipio}`],
                  ['Telefone', modalDetalhes.reg.telefone],
                  ['Email', modalDetalhes.reg.email],
                  ['Encarregado', modalDetalhes.reg.nomeEncarregado],
                  ['Tel. Encarregado', modalDetalhes.reg.telefoneEncarregado],
                  ['Senha Provisória', modalDetalhes.reg.senhaProvisoria || '—'],
                  ['Status', STATUS_LABEL[modalDetalhes.reg.status]?.label ?? modalDetalhes.reg.status],
                  ['Data Exame', modalDetalhes.reg.dataProva || 'Não publicada'],
                  ['Nota Admissão', modalDetalhes.reg.notaAdmissao !== undefined ? `${modalDetalhes.reg.notaAdmissao}/20` : '—'],
                ].map(([label, value]) => (
                  <View key={label} style={mStyles.detailRow}>
                    <Text style={mStyles.detailLabel}>{label}</Text>
                    <Text style={mStyles.detailValue}>{value}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabsRow: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { paddingHorizontal: 12, gap: 4, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, gap: 6 },
  tabActive: { backgroundColor: 'rgba(240,165,0,0.1)' },
  tabText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  tabTextActive: { color: Colors.gold, fontFamily: 'Inter_700Bold' },
  tabBadge: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: Colors.gold },
  tabBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  tabBadgeTextActive: { color: '#fff' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  refreshBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textMuted },

  regCard: { backgroundColor: Colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10 },
  regCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  regAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(240,165,0,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(240,165,0,0.3)' },
  regAvatarText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.gold },
  regNome: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  regSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 1 },
  regEmail: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },

  regActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  regActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Colors.border },
  regActionText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  btnSuccess: { borderColor: Colors.success + '50', backgroundColor: 'rgba(39,174,96,0.08)' },
  btnDanger: { borderColor: Colors.danger + '50', backgroundColor: 'rgba(231,76,60,0.08)' },
  btnGold: { borderColor: Colors.gold + '50', backgroundColor: 'rgba(240,165,0,0.08)' },
  btnBoletim: { borderColor: 'rgba(240,165,0,0.35)', backgroundColor: 'rgba(240,165,0,0.06)' },
});

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center' },
  container: { backgroundColor: '#0F1F40', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.1)', width: '100%', maxWidth: 480 },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  name: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5, textTransform: 'uppercase' },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, height: 52, fontSize: 16, fontFamily: 'Inter_400Regular', color: Colors.text },
  textarea: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, height: 100, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  detailRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, marginTop: 2 },
});
