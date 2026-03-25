import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, FlatList, Platform,
  Animated, RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

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

const CATEGORIAS = [
  'Todas', 'Geral', 'Matemática', 'Ciências', 'Língua Portuguesa', 'História', 'Geografia',
  'Física', 'Química', 'Biologia', 'Literatura', 'Filosofia', 'Informática',
  'Inglês', 'Francês', 'Educação Física', 'Artes', 'Religião', 'Outros',
];

const TIPOS_LEITOR = ['aluno', 'professor', 'funcionário', 'externo'];

function req<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    credentials: 'include',
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || 'Erro de servidor');
    return data as T;
  });
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

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function BibliotecaScreen() {
  const [tab, setTab] = useState<'catalogo' | 'emprestimos' | 'stats'>('catalogo');
  const [livros, setLivros] = useState<Livro[]>([]);
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'aluno';

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
    } catch (e) {
      addToast({ type: 'error', message: (e as Error).message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const ativos = emprestimos.filter(e => e.status === 'emprestado' || e.status === 'atrasado');
  const atrasados = emprestimos.filter(e => e.status === 'atrasado');
  const devolvidos = emprestimos.filter(e => e.status === 'devolvido');
  const totalLivros = livros.reduce((s, l) => s + l.quantidadeTotal, 0);
  const totalDisp = livros.reduce((s, l) => s + l.quantidadeDisponivel, 0);
  const totalEmprestados = totalLivros - totalDisp;

  return (
    <View style={styles.root}>
      <TopBar title="Biblioteca Escolar" subtitle="Gestão de livros e empréstimos" />
      {/* Tabs */}
      <View style={styles.tabBar}>
        {([
          { key: 'catalogo', label: 'Catálogo', icon: 'book' },
          { key: 'emprestimos', label: 'Empréstimos', icon: 'swap-horizontal', badge: atrasados.length },
          { key: 'stats', label: 'Estatísticas', icon: 'bar-chart' },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons name={t.icon as any} size={17} color={tab === t.key ? '#fff' : '#777'} />
            <Text style={[styles.tabLabel, tab === t.key && { color: '#fff' }]}>{t.label}</Text>
            {!!t.badge && t.badge > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{t.badge}</Text></View>
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
              isReadOnly={isReadOnly}
              onReload={() => load(true)}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          )}
          {tab === 'emprestimos' && (
            <EmprestimosTab
              emprestimos={emprestimos}
              livros={livros}
              isReadOnly={isReadOnly}
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
function CatalogoTab({ livros, isReadOnly, onReload, refreshing, onRefresh }: {
  livros: Livro[];
  isReadOnly: boolean;
  onReload: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [catFiltro, setCatFiltro] = useState('Todas');
  const [showModal, setShowModal] = useState(false);
  const [editLivro, setEditLivro] = useState<Livro | null>(null);

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
        {!isReadOnly && (
          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditLivro(null); setShowModal(true); }}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {CATEGORIAS.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, catFiltro === c && styles.chipActive]}
            onPress={() => setCatFiltro(c)}
          >
            <Text style={[styles.chipText, catFiltro === c && { color: '#fff' }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5E6AD2" />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="library-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>Nenhum livro encontrado</Text>
            {!isReadOnly && <Text style={styles.emptySub}>Toque em + para adicionar o primeiro livro</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <LivroCard
            livro={item}
            isReadOnly={isReadOnly}
            onEdit={() => { setEditLivro(item); setShowModal(true); }}
          />
        )}
      />

      <LivroModal
        visible={showModal}
        livro={editLivro}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); onReload(); }}
      />
    </View>
  );
}

function LivroCard({ livro, isReadOnly, onEdit }: { livro: Livro; isReadOnly: boolean; onEdit: () => void }) {
  const dispColor = livro.quantidadeDisponivel === 0 ? '#EF5350' : livro.quantidadeDisponivel <= 2 ? '#FFA726' : '#66BB6A';
  return (
    <View style={bStyles.card}>
      <View style={[bStyles.catBadge, { backgroundColor: catColor(livro.categoria) + '33' }]}>
        <Ionicons name="book" size={20} color={catColor(livro.categoria)} />
      </View>
      <View style={bStyles.cardInfo}>
        <Text style={bStyles.cardTitle} numberOfLines={1}>{livro.titulo}</Text>
        <Text style={bStyles.cardAutor}>{livro.autor}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Text style={bStyles.cardCat}>{livro.categoria}</Text>
          {livro.isbn ? <Text style={bStyles.cardIsbn}>ISBN: {livro.isbn}</Text> : null}
        </View>
        {livro.localizacao ? <Text style={bStyles.cardLoc}><Ionicons name="location-outline" size={11} color="#888" /> {livro.localizacao}</Text> : null}
      </View>
      <View style={bStyles.cardRight}>
        <View style={[bStyles.dispBox, { borderColor: dispColor + '66' }]}>
          <Text style={[bStyles.dispNum, { color: dispColor }]}>{livro.quantidadeDisponivel}</Text>
          <Text style={bStyles.dispLabel}>/{livro.quantidadeTotal}</Text>
        </View>
        <Text style={[bStyles.dispTag, { color: dispColor }]}>{livro.quantidadeDisponivel === 0 ? 'Esgotado' : 'Dispon.'}</Text>
        {!isReadOnly && (
          <TouchableOpacity style={bStyles.editBtn} onPress={onEdit}>
            <Ionicons name="pencil" size={14} color="#5E6AD2" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function catColor(cat: string) {
  const map: Record<string, string> = {
    'Matemática': '#5E6AD2', 'Ciências': '#26A69A', 'Língua Portuguesa': '#FF7043',
    'História': '#AB47BC', 'Geografia': '#42A5F5', 'Física': '#FFA726',
    'Química': '#EF5350', 'Biologia': '#66BB6A', 'Literatura': '#EC407A',
    'Filosofia': '#7E57C2', 'Informática': '#29B6F6', 'Inglês': '#FF7139',
  };
  return map[cat] || '#888';
}

// ─── Livro Modal ──────────────────────────────────────────────────────────────
function LivroModal({ visible, livro, onClose, onSaved }: {
  visible: boolean; livro: Livro | null; onClose: () => void; onSaved: () => void;
}) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: '', autor: '', isbn: '', categoria: 'Geral', editora: '',
    anoPublicacao: '', quantidadeTotal: '1', localizacao: '', descricao: '',
  });

  useEffect(() => {
    if (livro) {
      setForm({
        titulo: livro.titulo, autor: livro.autor, isbn: livro.isbn,
        categoria: livro.categoria, editora: livro.editora,
        anoPublicacao: livro.anoPublicacao?.toString() || '',
        quantidadeTotal: livro.quantidadeTotal.toString(),
        localizacao: livro.localizacao, descricao: livro.descricao,
      });
    } else {
      setForm({ titulo: '', autor: '', isbn: '', categoria: 'Geral', editora: '', anoPublicacao: '', quantidadeTotal: '1', localizacao: '', descricao: '' });
    }
  }, [livro, visible]);

  const upd = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.titulo.trim() || !form.autor.trim()) {
      addToast({ type: 'error', message: 'Título e autor são obrigatórios.' }); return;
    }
    setSaving(true);
    try {
      const qty = parseInt(form.quantidadeTotal) || 1;
      const payload = {
        titulo: form.titulo.trim(), autor: form.autor.trim(), isbn: form.isbn.trim(),
        categoria: form.categoria, editora: form.editora.trim(),
        anoPublicacao: form.anoPublicacao ? parseInt(form.anoPublicacao) : null,
        quantidadeTotal: qty, quantidadeDisponivel: livro ? undefined : qty,
        localizacao: form.localizacao.trim(), descricao: form.descricao.trim(),
      };
      if (livro) {
        await req(`/api/livros/${livro.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        addToast({ type: 'success', message: 'Livro atualizado.' });
      } else {
        await req('/api/livros', { method: 'POST', body: JSON.stringify(payload) });
        addToast({ type: 'success', message: 'Livro adicionado ao catálogo.' });
      }
      onSaved();
    } catch (e) {
      addToast({ type: 'error', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.header}>
            <Text style={mStyles.headerTitle}>{livro ? 'Editar Livro' : 'Adicionar Livro'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
          </View>
          <ScrollView style={mStyles.body} keyboardShouldPersistTaps="handled">
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
            <MLabel>Categoria</MLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
              {CATEGORIAS.filter(c => c !== 'Todas').map(c => (
                <TouchableOpacity key={c} style={[mStyles.chip, form.categoria === c && mStyles.chipActive]} onPress={() => upd('categoria')(c)}>
                  <Text style={[mStyles.chipText, form.categoria === c && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <MLabel>Editora</MLabel>
                <MInput value={form.editora} onChangeText={upd('editora')} placeholder="Nome da editora" />
              </View>
              <View style={{ width: 80 }}>
                <MLabel>Exemplares</MLabel>
                <MInput value={form.quantidadeTotal} onChangeText={upd('quantidadeTotal')} placeholder="1" keyboardType="numeric" />
              </View>
            </View>
            <MLabel>Localização / Prateleira</MLabel>
            <MInput value={form.localizacao} onChangeText={upd('localizacao')} placeholder="Ex: Estante A, Prateleira 3" />
            <MLabel>Descrição / Sinopse</MLabel>
            <MInput value={form.descricao} onChangeText={upd('descricao')} placeholder="Breve descrição do livro" multiline style={{ height: 80, textAlignVertical: 'top' }} />
          </ScrollView>
          <View style={mStyles.footer}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose}>
              <Text style={{ color: '#aaa', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mStyles.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{livro ? 'Guardar' : 'Adicionar'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Empréstimos Tab ──────────────────────────────────────────────────────────
function EmprestimosTab({ emprestimos, livros, isReadOnly, onReload, refreshing, onRefresh }: {
  emprestimos: Emprestimo[]; livros: Livro[]; isReadOnly: boolean;
  onReload: () => void; refreshing: boolean; onRefresh: () => void;
}) {
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'atrasados' | 'devolvidos'>('ativos');
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const { addToast } = useToast();

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
      addToast({ type: 'success', message: 'Devolução registada com sucesso.' });
      onReload();
    } catch (e) {
      addToast({ type: 'error', message: (e as Error).message });
    }
  };

  return (
    <View style={styles.flex}>
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
        {!isReadOnly && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter */}
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

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5E6AD2" />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="swap-horizontal-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>Nenhum empréstimo encontrado</Text>
          </View>
        }
        renderItem={({ item }) => (
          <EmprestimoCard emp={item} isReadOnly={isReadOnly} onDevolver={() => devolver(item)} />
        )}
      />

      <NovoEmprestimoModal
        visible={showModal}
        livros={livros}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); onReload(); }}
      />
    </View>
  );
}

function EmprestimoCard({ emp, isReadOnly, onDevolver }: { emp: Emprestimo; isReadOnly: boolean; onDevolver: () => void }) {
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
      {!isDevolvido && !isReadOnly && (
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

// ─── Novo Empréstimo Modal ────────────────────────────────────────────────────
function NovoEmprestimoModal({ visible, livros, onClose, onSaved }: {
  visible: boolean; livros: Livro[]; onClose: () => void; onSaved: () => void;
}) {
  const { addToast } = useToast();
  const { user } = useAuth();
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
    if (!livroSel) { addToast({ type: 'error', message: 'Selecione um livro.' }); return; }
    if (!form.nomeLeitor.trim()) { addToast({ type: 'error', message: 'Nome do leitor é obrigatório.' }); return; }
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
      addToast({ type: 'success', message: 'Empréstimo registado com sucesso.' });
      onSaved();
    } catch (e) {
      addToast({ type: 'error', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.header}>
            <Text style={mStyles.headerTitle}>Novo Empréstimo</Text>
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
                <MInput value={form.dataEmprestimo} onChangeText={upd('dataEmprestimo')} placeholder="AAAA-MM-DD" />
              </View>
              <View style={{ flex: 1 }}>
                <MLabel>Data de Devolução Prevista</MLabel>
                <MInput value={form.dataPrevistaDevolucao} onChangeText={upd('dataPrevistaDevolucao')} placeholder="AAAA-MM-DD" />
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
      {/* KPI Grid */}
      <View style={sStyles.kpiGrid}>
        <KpiCard icon="library" label="Títulos" value={livros.length.toString()} color="#5E6AD2" />
        <KpiCard icon="albums" label="Exemplares" value={totalLivros.toString()} color="#26A69A" />
        <KpiCard icon="checkmark-circle" label="Disponíveis" value={totalDisp.toString()} color="#66BB6A" />
        <KpiCard icon="swap-horizontal" label="Emprestados" value={totalEmprestados.toString()} color="#FFA726" />
        <KpiCard icon="warning" label="Atrasados" value={atrasados.length.toString()} color="#EF5350" />
        <KpiCard icon="return-down-back" label="Devolvidos" value={devolvidos.length.toString()} color="#42A5F5" />
      </View>

      {/* Taxa de ocupação */}
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

      {/* Categorias */}
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

      {/* Atrasados */}
      {atrasados.length > 0 && (
        <View style={sStyles.section}>
          <Text style={[sStyles.sectionTitle, { color: '#EF5350' }]}>Empréstimos em Atraso ({atrasados.length})</Text>
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

// ─── Shared Form Components ────────────────────────────────────────────────────
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
  filterScroll: { maxHeight: 44 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipActive: { backgroundColor: '#5E6AD2', borderColor: '#5E6AD2' },
  chipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterChipActive: { backgroundColor: '#5E6AD2', borderColor: '#5E6AD2' },
  filterChipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: '#666', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#444', fontSize: 13 },
});

const bStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12122a', borderRadius: 12, padding: 12, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  catBadge: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardAutor: { color: '#aaa', fontSize: 12 },
  cardCat: { color: '#5E6AD2', fontSize: 11, fontWeight: '600', backgroundColor: 'rgba(94,106,210,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  cardIsbn: { color: '#666', fontSize: 11 },
  cardLoc: { color: '#888', fontSize: 11, marginTop: 2 },
  cardRight: { alignItems: 'center', gap: 4 },
  dispBox: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  dispNum: { fontSize: 16, fontWeight: '800' },
  dispLabel: { fontSize: 10, color: '#666' },
  dispTag: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  editBtn: { marginTop: 4, width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(94,106,210,0.15)', alignItems: 'center', justifyContent: 'center' },
});

const eStyles = StyleSheet.create({
  card: { backgroundColor: '#12122a', borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  cardAtrasado: { borderColor: 'rgba(239,83,80,0.3)' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  livroInfo: { flex: 1, gap: 4 },
  livroTitulo: { color: '#fff', fontSize: 14, fontWeight: '700' },
  leitorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  leitorNome: { color: '#aaa', fontSize: 12, flex: 1 },
  tipoBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  tipoText: { fontSize: 10, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  datesRow: { flexDirection: 'row', gap: 12 },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },
  dateVal: { fontSize: 11, fontWeight: '700' },
  atrasoAlert: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(239,83,80,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  atrasoText: { color: '#EF5350', fontSize: 12, fontWeight: '700' },
  devolverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#5E6AD2', borderRadius: 8, paddingVertical: 8 },
  devolverText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

const sStyles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flex: 1, minWidth: 90, backgroundColor: '#12122a', borderRadius: 12, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1 },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { color: '#888', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  section: { backgroundColor: '#12122a', borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  sectionTitle: { color: '#aaa', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { color: '#fff', fontSize: 14, fontWeight: '800', width: 40, textAlign: 'right' },
  progressSub: { color: '#666', fontSize: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { width: 110, color: '#ccc', fontSize: 12 },
  catBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catCount: { color: '#aaa', fontSize: 12, fontWeight: '700', width: 24, textAlign: 'right' },
  atrasoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  atrasoTitulo: { color: '#fff', fontSize: 13, fontWeight: '600' },
  atrasoLeitor: { color: '#888', fontSize: 11 },
  atrasoChip: { backgroundColor: 'rgba(239,83,80,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(239,83,80,0.3)' },
  atrasoChipText: { color: '#EF5350', fontSize: 11, fontWeight: '800' },
});

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { backgroundColor: '#0f0f22', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  body: { padding: 16 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  label: { color: '#aaa', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipActive: { backgroundColor: '#5E6AD2', borderColor: '#5E6AD2' },
  chipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  cancelBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  saveBtn: { flex: 2, height: 44, borderRadius: 10, backgroundColor: '#5E6AD2', alignItems: 'center', justifyContent: 'center' },
  livroSel: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(94,106,210,0.15)', borderRadius: 8, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(94,106,210,0.3)', gap: 8 },
  livroDropdown: { backgroundColor: '#1a1a2e', borderRadius: 8, marginTop: -8, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  livroOption: { padding: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  livroOptionTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  livroOptionSub: { color: '#888', fontSize: 11 },
});
