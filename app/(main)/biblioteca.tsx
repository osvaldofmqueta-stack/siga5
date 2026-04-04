import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, FlatList, Platform,
  Image, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import DateInput from '@/components/DateInput';
import TopBar from '@/components/TopBar';
import { useToast } from '@/context/ToastContext';
import { useAuth, getAuthToken } from '@/context/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Livro {
  id: string;
  titulo: string;
  autor: string;
  isbn: string;
  categoria: string;
  editora: string;
  anoPublicacao: number | null;
  quantidadeTotal: number;
  quantidadeDisponivel: number;
  localizacao: string;
  descricao: string;
  capaUrl: string;
  ativo: boolean;
  createdAt: string;
}

interface Emprestimo {
  id: string;
  livroId: string;
  livroTitulo: string;
  alunoId: string | null;
  nomeLeitor: string;
  tipoLeitor: string;
  dataEmprestimo: string;
  dataPrevistaDevolucao: string;
  dataDevolucao: string | null;
  status: 'emprestado' | 'devolvido' | 'atrasado';
  observacao: string | null;
  registadoPor: string;
  createdAt: string;
}

interface Solicitacao {
  id: string;
  livroId: string;
  livroTitulo: string;
  alunoId: string | null;
  nomeLeitor: string;
  tipoLeitor: string;
  diasSolicitados: number;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  motivoRejeicao: string | null;
  registadoPor: string;
  createdAt: string;
}

const TIPOS_LEITOR = ['aluno', 'professor', 'funcionário', 'externo'];

async function req<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const tok = await getAuthToken();
  const r = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      ...opts?.headers,
    },
    credentials: 'include',
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || 'Erro de servidor');
  return data as T;
}

function fmtDate(d: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('pt-PT');
}

function diasAtraso(dataPrevista: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prev = new Date(dataPrevista);
  return Math.floor((hoje.getTime() - prev.getTime()) / 86400000);
}

function catColor(cat: string) {
  const map: Record<string, string> = {
    'Matemática': '#5E6AD2', 'Ciências': '#26A69A', 'Língua Portuguesa': '#FF7043',
    'História': '#AB47BC', 'Geografia': '#42A5F5', 'Física': '#FFA726',
    'Química': '#EF5350', 'Biologia': '#66BB6A', 'Literatura': '#EC407A',
    'Filosofia': '#7E57C2', 'Informática': '#29B6F6', 'Inglês': '#FF7139',
    'Geral': '#888',
  };
  return map[cat] || '#888';
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function BibliotecaScreen() {
  const [tab, setTab] = useState<'catalogo' | 'emprestimos' | 'stats'>('catalogo');
  const [livros, setLivros] = useState<Livro[]>([]);
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();
  const { user } = useAuth();
  const canManage = user?.role !== 'aluno';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      await req('/api/emprestimos/sync-atrasos', { method: 'POST' });
      const [ls, es] = await Promise.all([
        req<Livro[]>('/api/livros'),
        req<Emprestimo[]>('/api/emprestimos'),
      ]);
      setLivros(ls);
      setEmprestimos(es);
      if (canManage) {
        const sols = await req<Solicitacao[]>('/api/solicitacoes-emprestimo?status=pendente');
        setSolicitacoes(sols);
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const ativos = emprestimos.filter(e => e.status === 'emprestado' || e.status === 'atrasado');
  const atrasados = emprestimos.filter(e => e.status === 'atrasado');
  const devolvidos = emprestimos.filter(e => e.status === 'devolvido');
  const totalLivros = livros.reduce((s, l) => s + l.quantidadeTotal, 0);
  const totalDisp = livros.reduce((s, l) => s + l.quantidadeDisponivel, 0);
  const totalEmprestados = totalLivros - totalDisp;
  const pendentesCount = solicitacoes.length;

  return (
    <View style={styles.root}>
      <TopBar title="Biblioteca Escolar" subtitle="Gestão de livros e empréstimos" />

      <View style={styles.tabBar}>
        {([
          { key: 'catalogo', label: 'Catálogo', icon: 'book' },
          { key: 'emprestimos', label: 'Empréstimos', icon: 'swap-horizontal',
            badge: atrasados.length + (canManage ? pendentesCount : 0) },
          { key: 'stats', label: 'Estatísticas', icon: 'bar-chart' },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons name={t.icon as any} size={17} color={tab === t.key ? '#fff' : '#777'} />
            <Text style={[styles.tabLabel, tab === t.key && { color: '#fff' }]}>{t.label}</Text>
            {'badge' in t && (t as any).badge > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{(t as any).badge}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#5E6AD2" size="large" /></View>
      ) : (
        <>
          {tab === 'catalogo' && (
            <CatalogoTab
              livros={livros}
              canManage={canManage}
              user={user}
              onReload={() => load(true)}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          )}
          {tab === 'emprestimos' && (
            <EmprestimosTab
              emprestimos={emprestimos}
              livros={livros}
              solicitacoes={solicitacoes}
              canManage={canManage}
              user={user}
              onReload={() => load(true)}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          )}
          {tab === 'stats' && (
            <StatsTab
              livros={livros}
              emprestimos={emprestimos}
              totalLivros={totalLivros}
              totalDisp={totalDisp}
              totalEmprestados={totalEmprestados}
              atrasados={atrasados}
              devolvidos={devolvidos}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          )}
        </>
      )}
    </View>
  );
}

// ─── Catálogo Tab ─────────────────────────────────────────────────────────────
function CatalogoTab({ livros, canManage, user, onReload, refreshing, onRefresh }: {
  livros: Livro[];
  canManage: boolean;
  user: any;
  onReload: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [catFiltro, setCatFiltro] = useState('Todas');
  const [showModal, setShowModal] = useState(false);
  const [editLivro, setEditLivro] = useState<Livro | null>(null);
  const [solicitarLivro, setSolicitarLivro] = useState<Livro | null>(null);

  const cats = ['Todas', ...Array.from(new Set(livros.map(l => l.categoria))).sort()];

  const filtered = livros.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.titulo.toLowerCase().includes(q) || l.autor.toLowerCase().includes(q) || l.isbn.includes(q);
    const matchCat = catFiltro === 'Todas' || l.categoria === catFiltro;
    return matchSearch && matchCat;
  });

  return (
    <View style={styles.flex}>
      {/* Search + Add */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar título, autor, ISBN…"
            placeholderTextColor="#666"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#888" />
            </TouchableOpacity>
          )}
        </View>
        {canManage && (
          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditLivro(null); setShowModal(true); }}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Compact category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        {cats.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.catChip, catFiltro === c && styles.catChipActive]}
            onPress={() => setCatFiltro(c)}
          >
            <Text style={[styles.catChipText, catFiltro === c && { color: '#fff' }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Book grid */}
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 12, gap: 12, marginBottom: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5E6AD2" />}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="library-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>Nenhum livro encontrado</Text>
            {canManage && <Text style={styles.emptySub}>Toque em + para adicionar o primeiro livro</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <BookCard
            livro={item}
            canManage={canManage}
            onEdit={() => { setEditLivro(item); setShowModal(true); }}
            onSolicitar={() => setSolicitarLivro(item)}
          />
        )}
      />

      <LivroModal
        visible={showModal}
        livro={editLivro}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); onReload(); }}
      />

      <SolicitarModal
        visible={!!solicitarLivro}
        livro={solicitarLivro}
        user={user}
        onClose={() => setSolicitarLivro(null)}
        onSaved={() => {
          setSolicitarLivro(null);
          showToast('Pedido enviado! Aguarda aprovação da biblioteca.', 'success');
        }}
      />
    </View>
  );
}

// ─── Book Card (Grid) ─────────────────────────────────────────────────────────
function BookCard({ livro, canManage, onEdit, onSolicitar }: {
  livro: Livro;
  canManage: boolean;
  onEdit: () => void;
  onSolicitar: () => void;
}) {
  const available = livro.quantidadeDisponivel > 0;
  const dispColor = !available ? '#EF5350' : livro.quantidadeDisponivel <= 2 ? '#FFA726' : '#66BB6A';
  const cc = catColor(livro.categoria);

  return (
    <View style={bookStyles.card}>
      {/* Cover */}
      <View style={bookStyles.coverWrap}>
        {livro.capaUrl ? (
          <Image source={{ uri: livro.capaUrl }} style={bookStyles.coverImg} resizeMode="cover" />
        ) : (
          <View style={[bookStyles.coverPlaceholder, { backgroundColor: cc + '22' }]}>
            <Ionicons name="book" size={36} color={cc} />
            <Text style={[bookStyles.coverCat, { color: cc }]} numberOfLines={2}>{livro.categoria}</Text>
          </View>
        )}
        {/* Availability badge */}
        <View style={[bookStyles.availBadge, { backgroundColor: dispColor }]}>
          <Text style={bookStyles.availText}>{livro.quantidadeDisponivel}/{livro.quantidadeTotal}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={bookStyles.info}>
        <Text style={bookStyles.titulo} numberOfLines={2}>{livro.titulo}</Text>
        <Text style={bookStyles.autor} numberOfLines={1}>{livro.autor}</Text>
        {livro.editora ? <Text style={bookStyles.editora} numberOfLines={1}>{livro.editora}</Text> : null}
      </View>

      {/* Actions */}
      <View style={bookStyles.actions}>
        {canManage ? (
          <TouchableOpacity style={bookStyles.editBtn} onPress={onEdit}>
            <Ionicons name="pencil" size={13} color="#5E6AD2" />
            <Text style={bookStyles.editBtnText}>Editar</Text>
          </TouchableOpacity>
        ) : available ? (
          <TouchableOpacity style={bookStyles.solicitarBtn} onPress={onSolicitar}>
            <Ionicons name="hand-right-outline" size={13} color="#fff" />
            <Text style={bookStyles.solicitarBtnText}>Solicitar</Text>
          </TouchableOpacity>
        ) : (
          <View style={bookStyles.esgotadoBtn}>
            <Text style={bookStyles.esgotadoText}>Esgotado</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Solicitar Empréstimo Modal ───────────────────────────────────────────────
function SolicitarModal({ visible, livro, user, onClose, onSaved }: {
  visible: boolean;
  livro: Livro | null;
  user: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [dias, setDias] = useState('14');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setDias('14'); }, [visible]);

  const dayOptions = [7, 14, 21, 30];

  const save = async () => {
    if (!livro) return;
    const d = parseInt(dias);
    if (!d || d < 1 || d > 60) { showToast('Indique um número de dias válido (1–60).', 'error'); return; }
    setSaving(true);
    try {
      const nomeLeitor = user?.nome || 'Aluno';
      await req('/api/solicitacoes-emprestimo', {
        method: 'POST',
        body: JSON.stringify({
          livroId: livro.id,
          alunoId: user?.id || null,
          nomeLeitor,
          tipoLeitor: user?.role === 'professor' ? 'professor' : 'aluno',
          diasSolicitados: d,
          registadoPor: nomeLeitor,
        }),
      });
      onSaved();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!livro) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={[mStyles.sheet, { maxHeight: 480 }]}>
          <View style={mStyles.header}>
            <Text style={mStyles.headerTitle}>Solicitar Empréstimo</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
          </View>

          <View style={{ padding: 20, gap: 16 }}>
            {/* Book preview */}
            <View style={solStyles.bookPreview}>
              {livro.capaUrl ? (
                <Image source={{ uri: livro.capaUrl }} style={solStyles.previewImg} resizeMode="cover" />
              ) : (
                <View style={[solStyles.previewPlaceholder, { backgroundColor: catColor(livro.categoria) + '33' }]}>
                  <Ionicons name="book" size={28} color={catColor(livro.categoria)} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={solStyles.previewTitulo} numberOfLines={2}>{livro.titulo}</Text>
                <Text style={solStyles.previewAutor}>{livro.autor}</Text>
                <Text style={solStyles.previewDisp}>{livro.quantidadeDisponivel} exemplar(es) disponível(is)</Text>
              </View>
            </View>

            {/* Days picker */}
            <View>
              <Text style={solStyles.daysLabel}>Quantos dias precisa?</Text>
              <View style={solStyles.dayBtns}>
                {dayOptions.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[solStyles.dayBtn, dias === String(d) && solStyles.dayBtnActive]}
                    onPress={() => setDias(String(d))}
                  >
                    <Text style={[solStyles.dayBtnText, dias === String(d) && { color: '#fff' }]}>{d}d</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={solStyles.daysInput}
                value={dias}
                onChangeText={setDias}
                placeholder="Outro número de dias"
                placeholderTextColor="#555"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>

            <View style={solStyles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#5E6AD2" />
              <Text style={solStyles.infoText}>
                O pedido será enviado à biblioteca para aprovação. Será notificado quando estiver pronto.
              </Text>
            </View>
          </View>

          <View style={mStyles.footer}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose}>
              <Text style={{ color: '#aaa', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mStyles.saveBtn} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontWeight: '700' }}>Enviar Pedido</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Livro Modal ──────────────────────────────────────────────────────────────
function LivroModal({ visible, livro, onClose, onSaved }: {
  visible: boolean; livro: Livro | null; onClose: () => void; onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: '', autor: '', isbn: '', categoria: 'Geral', editora: '',
    anoPublicacao: '', quantidadeTotal: '1', localizacao: '', descricao: '', capaUrl: '',
  });

  const CATS = ['Geral', 'Matemática', 'Ciências', 'Língua Portuguesa', 'História', 'Geografia',
    'Física', 'Química', 'Biologia', 'Literatura', 'Filosofia', 'Informática',
    'Inglês', 'Francês', 'Educação Física', 'Artes', 'Religião', 'Outros'];

  useEffect(() => {
    if (livro) {
      setForm({
        titulo: livro.titulo, autor: livro.autor, isbn: livro.isbn,
        categoria: livro.categoria, editora: livro.editora,
        anoPublicacao: livro.anoPublicacao?.toString() || '',
        quantidadeTotal: livro.quantidadeTotal.toString(),
        localizacao: livro.localizacao, descricao: livro.descricao,
        capaUrl: livro.capaUrl || '',
      });
    } else {
      setForm({ titulo: '', autor: '', isbn: '', categoria: 'Geral', editora: '', anoPublicacao: '', quantidadeTotal: '1', localizacao: '', descricao: '', capaUrl: '' });
    }
  }, [livro, visible]);

  const upd = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.titulo.trim() || !form.autor.trim()) {
      showToast('Título e autor são obrigatórios.', 'error'); return;
    }
    setSaving(true);
    try {
      const qty = parseInt(form.quantidadeTotal) || 1;
      const payload = {
        titulo: form.titulo.trim(), autor: form.autor.trim(), isbn: form.isbn.trim(),
        categoria: form.categoria, editora: form.editora.trim(),
        anoPublicacao: form.anoPublicacao ? parseInt(form.anoPublicacao) : null,
        quantidadeTotal: qty,
        quantidadeDisponivel: livro ? undefined : qty,
        localizacao: form.localizacao.trim(), descricao: form.descricao.trim(),
        capaUrl: form.capaUrl.trim(),
      };
      if (livro) {
        await req(`/api/livros/${livro.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Livro atualizado.', 'success');
      } else {
        await req('/api/livros', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Livro adicionado ao catálogo.', 'success');
      }
      onSaved();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>

          {/* ── Cabeçalho ─────────────────────────────────────────────── */}
          <View style={mStyles.header}>
            <View style={mStyles.headerLeft}>
              <Ionicons name={livro ? 'pencil' : 'add-circle'} size={20} color="#5E6AD2" />
              <Text style={mStyles.headerTitle}>{livro ? 'Editar Livro' : 'Adicionar Livro'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={mStyles.closeBtn}>
              <Ionicons name="close" size={20} color="#aaa" />
            </TouchableOpacity>
          </View>

          <ScrollView style={mStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* ── Secção 1: Identificação ─────────────────────────────── */}
            <View style={mStyles.section}>
              <View style={mStyles.sectionHeader}>
                <Ionicons name="information-circle-outline" size={14} color="#5E6AD2" />
                <Text style={mStyles.sectionTitle}>IDENTIFICAÇÃO</Text>
              </View>
              <MLabel>Título *</MLabel>
              <MInput value={form.titulo} onChangeText={upd('titulo')} placeholder="Título do livro" />
              <MLabel>Autor *</MLabel>
              <MInput value={form.autor} onChangeText={upd('autor')} placeholder="Nome do autor" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <MLabel>ISBN</MLabel>
                  <MInput value={form.isbn} onChangeText={upd('isbn')} placeholder="ISBN" keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <MLabel>Ano Publicação</MLabel>
                  <MInput value={form.anoPublicacao} onChangeText={upd('anoPublicacao')} placeholder="Ex: 2018" keyboardType="numeric" />
                </View>
              </View>
              <MLabel>Editora</MLabel>
              <MInput value={form.editora} onChangeText={upd('editora')} placeholder="Nome da editora" />
            </View>

            {/* ── Secção 2: Categoria ─────────────────────────────────── */}
            <View style={mStyles.section}>
              <View style={mStyles.sectionHeader}>
                <Ionicons name="pricetag-outline" size={14} color="#5E6AD2" />
                <Text style={mStyles.sectionTitle}>CATEGORIA</Text>
                <View style={mStyles.catSelectedBadge}>
                  <Text style={mStyles.catSelectedText}>{form.categoria}</Text>
                </View>
              </View>
              <View style={mStyles.catGrid}>
                {CATS.map(c => {
                  const cc = catColor(c);
                  const isActive = form.categoria === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[mStyles.catGridItem, isActive && { borderColor: cc, backgroundColor: cc + '20' }]}
                      onPress={() => upd('categoria')(c)}
                    >
                      <View style={[mStyles.catDot, { backgroundColor: isActive ? cc : 'rgba(255,255,255,0.15)' }]} />
                      <Text style={[mStyles.catGridText, isActive && { color: cc, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>
                        {c}
                      </Text>
                      {isActive && <Ionicons name="checkmark" size={11} color={cc} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Secção 3: Inventário ────────────────────────────────── */}
            <View style={mStyles.section}>
              <View style={mStyles.sectionHeader}>
                <Ionicons name="cube-outline" size={14} color="#5E6AD2" />
                <Text style={mStyles.sectionTitle}>INVENTÁRIO & LOCALIZAÇÃO</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 90 }}>
                  <MLabel>Exemplares</MLabel>
                  <MInput value={form.quantidadeTotal} onChangeText={upd('quantidadeTotal')} placeholder="1" keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <MLabel>Prateleira / Localização</MLabel>
                  <MInput value={form.localizacao} onChangeText={upd('localizacao')} placeholder="Ex: Estante A, Prateleira 3" />
                </View>
              </View>
            </View>

            {/* ── Secção 4: Capa e Descrição ──────────────────────────── */}
            <View style={mStyles.section}>
              <View style={mStyles.sectionHeader}>
                <Ionicons name="image-outline" size={14} color="#5E6AD2" />
                <Text style={mStyles.sectionTitle}>CAPA & DESCRIÇÃO</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                {form.capaUrl ? (
                  <Image source={{ uri: form.capaUrl }} style={mStyles.capaImg} resizeMode="cover" onError={() => {}} />
                ) : (
                  <View style={mStyles.capaPlaceholder}>
                    <Ionicons name="book-outline" size={28} color="#444" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <MLabel>URL da Capa</MLabel>
                  <MInput value={form.capaUrl} onChangeText={upd('capaUrl')} placeholder="https://..." />
                </View>
              </View>
              <MLabel>Sinopse / Descrição</MLabel>
              <MInput value={form.descricao} onChangeText={upd('descricao')} placeholder="Breve descrição do livro..." multiline style={{ height: 72, textAlignVertical: 'top' }} />
            </View>

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* ── Rodapé ──────────────────────────────────────────────────── */}
          <View style={mStyles.footer}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose}>
              <Text style={{ color: '#aaa', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mStyles.saveBtn} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name={livro ? 'save-outline' : 'add-circle-outline'} size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>{livro ? 'Guardar Alterações' : 'Adicionar Livro'}</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─── Empréstimos Tab ──────────────────────────────────────────────────────────
function EmprestimosTab({ emprestimos, livros, solicitacoes, canManage, user, onReload, refreshing, onRefresh }: {
  emprestimos: Emprestimo[]; livros: Livro[]; solicitacoes: Solicitacao[];
  canManage: boolean; user: any;
  onReload: () => void; refreshing: boolean; onRefresh: () => void;
}) {
  const { showToast } = useToast();
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'atrasados' | 'devolvidos'>('ativos');
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const filtered = emprestimos.filter(e => {
    const matchFiltro =
      filtro === 'todos' ? true :
      filtro === 'ativos' ? (e.status === 'emprestado' || e.status === 'atrasado') :
      e.status === filtro;
    const q = search.toLowerCase();
    const matchSearch = !q || e.nomeLeitor.toLowerCase().includes(q) || e.livroTitulo.toLowerCase().includes(q);
    return matchFiltro && matchSearch;
  });

  const devolver = async (emp: Emprestimo) => {
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      await req(`/api/emprestimos/${emp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'devolvido', dataDevolucao: hoje }),
      });
      showToast('Devolução registada com sucesso.', 'success');
      onReload();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const aprovar = async (sol: Solicitacao) => {
    setProcessing(sol.id);
    try {
      await req(`/api/solicitacoes-emprestimo/${sol.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'aprovado', aprovadoPor: user?.nome || 'Biblioteca' }),
      });
      showToast(`Empréstimo aprovado para ${sol.nomeLeitor}.`, 'success');
      onReload();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setProcessing(null);
    }
  };

  const rejeitar = async () => {
    if (!rejectId) return;
    setProcessing(rejectId);
    try {
      await req(`/api/solicitacoes-emprestimo/${rejectId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rejeitado', motivoRejeicao: rejectMotivo || null }),
      });
      showToast('Pedido rejeitado.', 'info');
      setRejectId(null);
      setRejectMotivo('');
      onReload();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <ScrollView
      style={styles.flex}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5E6AD2" />}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Pedidos Pendentes (staff only) ── */}
      {canManage && solicitacoes.length > 0 && (
        <View style={empStyles.pendentesSection}>
          <View style={empStyles.pendenteHeader}>
            <Ionicons name="time" size={16} color="#FFA726" />
            <Text style={empStyles.pendenteTitle}>Pedidos Pendentes de Aprovação</Text>
            <View style={empStyles.pendenteCount}>
              <Text style={empStyles.pendenteCountText}>{solicitacoes.length}</Text>
            </View>
          </View>
          {solicitacoes.map(sol => (
            <View key={sol.id} style={empStyles.pedidoCard}>
              <View style={{ flex: 1 }}>
                <Text style={empStyles.pedidoTitulo} numberOfLines={1}>{sol.livroTitulo}</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 }}>
                  <Ionicons name="person-outline" size={12} color="#888" />
                  <Text style={empStyles.pedidoLeitor}>{sol.nomeLeitor}</Text>
                  <View style={empStyles.diasChip}>
                    <Ionicons name="calendar-outline" size={10} color="#5E6AD2" />
                    <Text style={empStyles.diasChipText}>{sol.diasSolicitados} dias</Text>
                  </View>
                </View>
                <Text style={empStyles.pedidoData}>Solicitado em {fmtDate(sol.createdAt)}</Text>
              </View>
              <View style={empStyles.pedidoBtns}>
                <TouchableOpacity
                  style={[empStyles.aprovarBtn, processing === sol.id && { opacity: 0.5 }]}
                  onPress={() => aprovar(sol)}
                  disabled={!!processing}
                >
                  {processing === sol.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="checkmark" size={16} color="#fff" />
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[empStyles.rejeitarBtn, processing === sol.id && { opacity: 0.5 }]}
                  onPress={() => setRejectId(sol.id)}
                  disabled={!!processing}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Empréstimos List ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar leitor ou título…"
            placeholderTextColor="#666"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color="#888" /></TouchableOpacity>}
        </View>
        {canManage && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {([
          { key: 'ativos', label: 'Ativos' },
          { key: 'atrasados', label: 'Atrasados' },
          { key: 'devolvidos', label: 'Devolvidos' },
          { key: 'todos', label: 'Todos' },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filtro === f.key && styles.filterChipActive]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={[styles.filterChipText, filtro === f.key && { color: '#fff' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={[styles.emptyBox, { marginTop: 24 }]}>
          <Ionicons name="swap-horizontal-outline" size={48} color="#444" />
          <Text style={styles.emptyText}>Nenhum empréstimo encontrado</Text>
        </View>
      ) : (
        <View style={{ padding: 16, gap: 10, paddingBottom: 120 }}>
          {filtered.map(item => (
            <EmprestimoCard key={item.id} emp={item} canManage={canManage} onDevolver={() => devolver(item)} />
          ))}
        </View>
      )}

      {canManage && (
        <NovoEmprestimoModal
          visible={showModal}
          livros={livros}
          user={user}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onReload(); }}
        />
      )}

      {/* Reject reason modal */}
      <Modal visible={!!rejectId} transparent animationType="fade" onRequestClose={() => setRejectId(null)}>
        <View style={mStyles.overlay}>
          <View style={[mStyles.sheet, { maxHeight: 320 }]}>
            <View style={mStyles.header}>
              <Text style={mStyles.headerTitle}>Rejeitar Pedido</Text>
              <TouchableOpacity onPress={() => setRejectId(null)}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={{ color: '#aaa', fontSize: 13 }}>Indique o motivo da rejeição (opcional):</Text>
              <TextInput
                style={[mStyles.input, { height: 80, textAlignVertical: 'top' }]}
                value={rejectMotivo}
                onChangeText={setRejectMotivo}
                placeholder="Ex: Livro reservado, exemplar danificado…"
                placeholderTextColor="#555"
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={mStyles.footer}>
              <TouchableOpacity style={mStyles.cancelBtn} onPress={() => setRejectId(null)}>
                <Text style={{ color: '#aaa', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mStyles.saveBtn, { backgroundColor: '#EF5350' }]} onPress={rejeitar} disabled={!!processing}>
                {processing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Rejeitar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function EmprestimoCard({ emp, canManage, onDevolver }: { emp: Emprestimo; canManage: boolean; onDevolver: () => void }) {
  const isAtrasado = emp.status === 'atrasado';
  const isDevolvido = emp.status === 'devolvido';
  const dias = !isDevolvido ? diasAtraso(emp.dataPrevistaDevolucao) : 0;
  const statusColor = isAtrasado ? '#EF5350' : isDevolvido ? '#66BB6A' : '#5E6AD2';
  const statusLabel = isAtrasado ? 'Atrasado' : isDevolvido ? 'Devolvido' : 'Emprestado';

  return (
    <View style={[eStyles.card, isAtrasado && eStyles.cardAtrasado]}>
      <View style={eStyles.cardTop}>
        <View style={eStyles.livroInfo}>
          <Text style={eStyles.livroTitulo} numberOfLines={1}>{emp.livroTitulo}</Text>
          <View style={eStyles.leitorRow}>
            <Ionicons name="person-outline" size={12} color="#888" />
            <Text style={eStyles.leitorNome}>{emp.nomeLeitor}</Text>
            <View style={[eStyles.tipoBadge, { backgroundColor: tipoColor(emp.tipoLeitor) + '22' }]}>
              <Text style={[eStyles.tipoText, { color: tipoColor(emp.tipoLeitor) }]}>{emp.tipoLeitor}</Text>
            </View>
          </View>
        </View>
        <View style={[eStyles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '44' }]}>
          <Text style={[eStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={eStyles.datesRow}>
        <DatePill icon="calendar-outline" label="Empréstimo" date={fmtDate(emp.dataEmprestimo)} />
        <DatePill icon="time-outline" label="Previsto" date={fmtDate(emp.dataPrevistaDevolucao)} warn={isAtrasado} />
        {isDevolvido && <DatePill icon="checkmark-circle-outline" label="Devolvido" date={fmtDate(emp.dataDevolucao || '')} ok />}
      </View>
      {isAtrasado && dias > 0 && (
        <View style={eStyles.atrasoAlert}>
          <Ionicons name="warning" size={13} color="#EF5350" />
          <Text style={eStyles.atrasoText}>{dias} dia{dias !== 1 ? 's' : ''} de atraso</Text>
        </View>
      )}
      {!isDevolvido && canManage && (
        <TouchableOpacity style={eStyles.devolverBtn} onPress={onDevolver}>
          <Ionicons name="return-down-back" size={14} color="#fff" />
          <Text style={eStyles.devolverText}>Registar Devolução</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DatePill({ icon, label, date, warn, ok }: { icon: string; label: string; date: string; warn?: boolean; ok?: boolean }) {
  const color = warn ? '#EF5350' : ok ? '#66BB6A' : '#888';
  return (
    <View style={eStyles.datePill}>
      <Ionicons name={icon as any} size={11} color={color} />
      <View>
        <Text style={[eStyles.dateLabel, { color: '#666' }]}>{label}</Text>
        <Text style={[eStyles.dateVal, { color }]}>{date}</Text>
      </View>
    </View>
  );
}

function tipoColor(tipo: string) {
  const m: Record<string, string> = { aluno: '#5E6AD2', professor: '#26A69A', funcionário: '#FF7043', externo: '#888' };
  return m[tipo] || '#888';
}

// ─── Novo Empréstimo Modal (direct, staff only) ────────────────────────────────────────────────────
function NovoEmprestimoModal({ visible, livros, user, onClose, onSaved }: {
  visible: boolean; livros: Livro[]; user: any; onClose: () => void; onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [livroSearch, setLivroSearch] = useState('');
  const [livroSel, setLivroSel] = useState<Livro | null>(null);
  const [form, setForm] = useState({
    nomeLeitor: '', tipoLeitor: 'aluno',
    dataEmprestimo: new Date().toISOString().slice(0, 10),
    dataPrevistaDevolucao: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    observacao: '',
  });

  useEffect(() => {
    if (!visible) { setLivroSel(null); setLivroSearch(''); }
  }, [visible]);

  const livrosFiltrados = livros.filter(l =>
    l.quantidadeDisponivel > 0 &&
    (l.titulo.toLowerCase().includes(livroSearch.toLowerCase()) || l.autor.toLowerCase().includes(livroSearch.toLowerCase()))
  );

  const upd = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!livroSel) { showToast('Selecione um livro.', 'error'); return; }
    if (!form.nomeLeitor.trim()) { showToast('Nome do leitor é obrigatório.', 'error'); return; }
    setSaving(true);
    try {
      await req('/api/emprestimos', {
        method: 'POST',
        body: JSON.stringify({
          livroId: livroSel.id,
          nomeLeitor: form.nomeLeitor.trim(),
          tipoLeitor: form.tipoLeitor,
          dataEmprestimo: form.dataEmprestimo,
          dataPrevistaDevolucao: form.dataPrevistaDevolucao,
          observacao: form.observacao || null,
          registadoPor: user?.nome || 'Sistema',
        }),
      });
      showToast('Empréstimo registado com sucesso.', 'success');
      onSaved();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.header}>
            <Text style={mStyles.headerTitle}>Registar Empréstimo</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
          </View>
          <ScrollView style={mStyles.body} keyboardShouldPersistTaps="handled">
            <MLabel>Livro *</MLabel>
            {livroSel ? (
              <View style={mStyles.livroSel}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }} numberOfLines={1}>{livroSel.titulo}</Text>
                  <Text style={{ color: '#aaa', fontSize: 12 }}>{livroSel.autor} · {livroSel.quantidadeDisponivel} disponível(is)</Text>
                </View>
                <TouchableOpacity onPress={() => setLivroSel(null)}>
                  <Ionicons name="close-circle" size={18} color="#EF5350" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <MInput value={livroSearch} onChangeText={setLivroSearch} placeholder="Pesquisar livro disponível…" />
                {livroSearch.length > 0 && (
                  <View style={mStyles.livroDropdown}>
                    {livrosFiltrados.slice(0, 5).map(l => (
                      <TouchableOpacity key={l.id} style={mStyles.livroOption} onPress={() => { setLivroSel(l); setLivroSearch(''); }}>
                        <Text style={mStyles.livroOptionTitle} numberOfLines={1}>{l.titulo}</Text>
                        <Text style={mStyles.livroOptionSub}>{l.autor} · {l.quantidadeDisponivel} disponível(is)</Text>
                      </TouchableOpacity>
                    ))}
                    {livrosFiltrados.length === 0 && <Text style={{ color: '#666', padding: 8, fontSize: 13 }}>Nenhum livro disponível encontrado</Text>}
                  </View>
                )}
              </>
            )}
            <MLabel>Nome do Leitor *</MLabel>
            <MInput value={form.nomeLeitor} onChangeText={upd('nomeLeitor')} placeholder="Nome completo" />
            <MLabel>Tipo de Leitor</MLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {TIPOS_LEITOR.map(t => (
                <TouchableOpacity key={t} style={[mStyles.chip, form.tipoLeitor === t && mStyles.chipActive]} onPress={() => upd('tipoLeitor')(t)}>
                  <Text style={[mStyles.chipText, form.tipoLeitor === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <MLabel>Data de Empréstimo</MLabel>
                <DateInput style={mStyles.input} value={form.dataEmprestimo} onChangeText={upd('dataEmprestimo')} />
              </View>
              <View style={{ flex: 1 }}>
                <MLabel>Data Prevista de Devolução</MLabel>
                <DateInput style={mStyles.input} value={form.dataPrevistaDevolucao} onChangeText={upd('dataPrevistaDevolucao')} />
              </View>
            </View>
            <MLabel>Observações</MLabel>
            <MInput value={form.observacao} onChangeText={upd('observacao')} placeholder="Observações opcionais" multiline style={{ height: 60, textAlignVertical: 'top' }} />
          </ScrollView>
          <View style={mStyles.footer}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose}>
              <Text style={{ color: '#aaa', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mStyles.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Registar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Estatísticas Tab ─────────────────────────────────────────────────────────
function StatsTab({ livros, emprestimos, totalLivros, totalDisp, totalEmprestados, atrasados, devolvidos, refreshing, onRefresh }: {
  livros: Livro[]; emprestimos: Emprestimo[];
  totalLivros: number; totalDisp: number; totalEmprestados: number;
  atrasados: Emprestimo[]; devolvidos: Emprestimo[];
  refreshing: boolean; onRefresh: () => void;
}) {
  const catCounts = livros.reduce<Record<string, number>>((acc, l) => {
    acc[l.categoria] = (acc[l.categoria] || 0) + 1; return acc;
  }, {});
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const taxaOcupacao = totalLivros > 0 ? Math.round((totalEmprestados / totalLivros) * 100) : 0;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5E6AD2" />}
    >
      <View style={sStyles.kpiGrid}>
        <KpiCard icon="library" label="Títulos" value={livros.length.toString()} color="#5E6AD2" />
        <KpiCard icon="albums" label="Exemplares" value={totalLivros.toString()} color="#26A69A" />
        <KpiCard icon="checkmark-circle" label="Disponíveis" value={totalDisp.toString()} color="#66BB6A" />
        <KpiCard icon="swap-horizontal" label="Emprestados" value={totalEmprestados.toString()} color="#FFA726" />
        <KpiCard icon="warning" label="Atrasados" value={atrasados.length.toString()} color="#EF5350" />
        <KpiCard icon="return-down-back" label="Devolvidos" value={devolvidos.length.toString()} color="#42A5F5" />
      </View>

      <View style={sStyles.section}>
        <Text style={sStyles.sectionTitle}>Taxa de Ocupação</Text>
        <View style={sStyles.progressRow}>
          <View style={sStyles.progressBg}>
            <View style={[sStyles.progressFill, { width: `${taxaOcupacao}%` as any, backgroundColor: taxaOcupacao > 80 ? '#EF5350' : taxaOcupacao > 50 ? '#FFA726' : '#66BB6A' }]} />
          </View>
          <Text style={sStyles.progressLabel}>{taxaOcupacao}%</Text>
        </View>
        <Text style={sStyles.progressSub}>{totalEmprestados} de {totalLivros} exemplares emprestados</Text>
      </View>

      {topCats.length > 0 && (
        <View style={sStyles.section}>
          <Text style={sStyles.sectionTitle}>Livros por Categoria</Text>
          {topCats.map(([cat, count]) => (
            <View key={cat} style={sStyles.catRow}>
              <View style={[sStyles.catDot, { backgroundColor: catColor(cat) }]} />
              <Text style={sStyles.catName} numberOfLines={1}>{cat}</Text>
              <View style={sStyles.catBarBg}>
                <View style={[sStyles.catBarFill, { width: `${Math.round((count / livros.length) * 100)}%` as any, backgroundColor: catColor(cat) }]} />
              </View>
              <Text style={sStyles.catCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}

      {atrasados.length > 0 && (
        <View style={sStyles.section}>
          <Text style={[sStyles.sectionTitle, { color: '#EF5350' }]}>Em Atraso ({atrasados.length})</Text>
          {atrasados.map(e => {
            const dias = diasAtraso(e.dataPrevistaDevolucao);
            return (
              <View key={e.id} style={sStyles.atrasoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={sStyles.atrasoTitulo} numberOfLines={1}>{e.livroTitulo}</Text>
                  <Text style={sStyles.atrasoLeitor}>{e.nomeLeitor} · Previsto: {fmtDate(e.dataPrevistaDevolucao)}</Text>
                </View>
                <View style={sStyles.atrasoChip}>
                  <Text style={sStyles.atrasoChipText}>{dias}d</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function KpiCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[sStyles.kpiCard, { borderColor: color + '40' }]}>
      <View style={[sStyles.kpiIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[sStyles.kpiValue, { color }]}>{value}</Text>
      <Text style={sStyles.kpiLabel}>{label}</Text>
    </View>
  );
}

function MLabel({ children }: { children: string }) {
  return <Text style={mStyles.label}>{children}</Text>;
}
function MInput({ style, ...props }: React.ComponentProps<typeof TextInput> & { style?: any }) {
  return <TextInput style={[mStyles.input, style]} placeholderTextColor="#555" selectionColor="#5E6AD2" {...props} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: '#0d0d1f', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, position: 'relative' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#5E6AD2' },
  tabLabel: { color: '#777', fontSize: 12, fontWeight: '600' },
  badge: { backgroundColor: '#EF5350', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 12, gap: 8, height: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#5E6AD2', alignItems: 'center', justifyContent: 'center' },
  catScroll: { maxHeight: 36, marginBottom: 4 },
  catChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#13131f', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  catChipActive: { backgroundColor: '#5E6AD2', borderColor: '#5E6AD2' },
  catChipText: { color: '#aaa', fontSize: 11, fontWeight: '600' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterChipActive: { backgroundColor: '#5E6AD2', borderColor: '#5E6AD2' },
  filterChipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { color: '#555', fontSize: 15, fontWeight: '600' },
  emptySub: { color: '#444', fontSize: 13 },
});

// Book card styles
const bookStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#13131f', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  coverWrap: { width: '100%', aspectRatio: 2 / 3, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 },
  coverCat: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  availBadge: { position: 'absolute', top: 6, right: 6, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  availText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  info: { padding: 10, gap: 3, flex: 1 },
  titulo: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  autor: { color: '#aaa', fontSize: 11 },
  editora: { color: '#666', fontSize: 10 },
  actions: { paddingHorizontal: 10, paddingBottom: 10 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#5E6AD222', borderWidth: 1, borderColor: '#5E6AD244' },
  editBtnText: { color: '#5E6AD2', fontSize: 11, fontWeight: '700' },
  solicitarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#5E6AD2' },
  solicitarBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  esgotadoBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#EF535022', borderWidth: 1, borderColor: '#EF535044', alignItems: 'center' },
  esgotadoText: { color: '#EF5350', fontSize: 11, fontWeight: '700' },
});

// Solicitar modal styles
const solStyles = StyleSheet.create({
  bookPreview: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#0d1120', borderRadius: 12, padding: 12 },
  previewImg: { width: 56, height: 80, borderRadius: 6 },
  previewPlaceholder: { width: 56, height: 80, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  previewTitulo: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 18 },
  previewAutor: { color: '#aaa', fontSize: 12, marginTop: 3 },
  previewDisp: { color: '#66BB6A', fontSize: 11, marginTop: 6 },
  daysLabel: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  dayBtns: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dayBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1a2040', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  dayBtnActive: { backgroundColor: '#5E6AD2', borderColor: '#5E6AD2' },
  dayBtnText: { color: '#aaa', fontSize: 13, fontWeight: '700' },
  daysInput: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontSize: 14 },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#5E6AD211', borderRadius: 10, padding: 12 },
  infoText: { color: '#888', fontSize: 12, flex: 1, lineHeight: 17 },
});

// Emprestimos styles
const empStyles = StyleSheet.create({
  pendentesSection: { margin: 12, backgroundColor: '#FFA72611', borderRadius: 14, borderWidth: 1, borderColor: '#FFA72633', overflow: 'hidden' },
  pendenteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#FFA72633' },
  pendenteTitle: { color: '#FFA726', fontSize: 13, fontWeight: '700', flex: 1 },
  pendenteCount: { backgroundColor: '#FFA726', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  pendenteCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  pedidoCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  pedidoTitulo: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pedidoLeitor: { color: '#aaa', fontSize: 12 },
  pedidoData: { color: '#555', fontSize: 11, marginTop: 2 },
  diasChip: { flexDirection: 'row', gap: 3, alignItems: 'center', backgroundColor: '#5E6AD222', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  diasChipText: { color: '#5E6AD2', fontSize: 10, fontWeight: '700' },
  pedidoBtns: { flexDirection: 'row', gap: 6 },
  aprovarBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#66BB6A', alignItems: 'center', justifyContent: 'center' },
  rejeitarBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EF5350', alignItems: 'center', justifyContent: 'center' },
});

// Emprestimo card styles
const eStyles = StyleSheet.create({
  card: { backgroundColor: '#13131f', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  cardAtrasado: { borderColor: '#EF535044', backgroundColor: '#EF535011' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  livroInfo: { flex: 1, marginRight: 10 },
  livroTitulo: { color: '#fff', fontSize: 14, fontWeight: '700' },
  leitorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  leitorNome: { color: '#aaa', fontSize: 12 },
  tipoBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tipoText: { fontSize: 10, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  datesRow: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  datePill: { flexDirection: 'row', gap: 5, alignItems: 'flex-start' },
  dateLabel: { fontSize: 10 },
  dateVal: { fontSize: 12, fontWeight: '600' },
  atrasoAlert: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  atrasoText: { color: '#EF5350', fontSize: 12, fontWeight: '600' },
  devolverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#26A69A', borderRadius: 8, paddingVertical: 8 },
  devolverText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// Modal styles
const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0f1423', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  body: { maxHeight: 480 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  cancelBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 10, backgroundColor: '#1a1a2e' },
  saveBtn: { flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: 10, backgroundColor: '#5E6AD2' },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#13131f', color: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontSize: 14, marginBottom: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#13131f', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipActive: { backgroundColor: '#5E6AD2', borderColor: '#5E6AD2' },
  chipText: { color: '#aaa', fontSize: 11, fontWeight: '600' },
  livroSel: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#13131f', borderRadius: 10, padding: 10, marginBottom: 4, gap: 10, borderWidth: 1, borderColor: '#5E6AD244' },
  livroDropdown: { backgroundColor: '#0d1120', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  livroOption: { padding: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  livroOptionTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  livroOptionSub: { color: '#888', fontSize: 11, marginTop: 2 },
  capaPreview: { alignItems: 'center', gap: 6, marginVertical: 8 },
  capaImg: { width: 80, height: 112, borderRadius: 8 },
  capaHint: { color: '#555', fontSize: 11 },
});

// Stats styles
const sStyles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { width: '31%', backgroundColor: '#13131f', borderRadius: 12, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1 },
  kpiIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { color: '#666', fontSize: 11, fontWeight: '600' },
  section: { backgroundColor: '#13131f', borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#1a1a2e', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { color: '#fff', fontSize: 14, fontWeight: '700', minWidth: 36, textAlign: 'right' },
  progressSub: { color: '#666', fontSize: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { color: '#aaa', fontSize: 12, width: 100 },
  catBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#1a1a2e', overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catCount: { color: '#666', fontSize: 12, minWidth: 20, textAlign: 'right' },
  atrasoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  atrasoTitulo: { color: '#fff', fontSize: 13, fontWeight: '600' },
  atrasoLeitor: { color: '#888', fontSize: 11, marginTop: 2 },
  atrasoChip: { backgroundColor: '#EF535022', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#EF535044' },
  atrasoChipText: { color: '#EF5350', fontSize: 12, fontWeight: '700' },
});
