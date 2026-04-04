import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, FlatList, Platform,
  RefreshControl, Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TopBar from '@/components/TopBar';
import { useToast } from '@/context/ToastContext';
import { useAuth, getAuthToken } from '@/context/AuthContext';

interface TrabalhoFinal {
  id: string;
  titulo: string;
  autor: string;
  orientador: string;
  anoConclusao: number;
  curso: string;
  imagemCapa: string | null;
  resumo: string;
  visitas: number;
  criadoEm: string;
}

const CURSOS = [
  'Todos',
  'Informática',
  'Contabilidade',
  'Gestão',
  'Construção Civil',
  'Electricidade',
  'Electrónica',
  'Mecânica',
  'Agropecuária',
  'Saúde',
  'Turismo e Hotelaria',
  'Administração Pública',
  'Outro',
];

const CURSO_COLORS: Record<string, string> = {
  'Informática': '#5E6AD2',
  'Contabilidade': '#26A69A',
  'Gestão': '#FFA726',
  'Construção Civil': '#8D6E63',
  'Electricidade': '#FFCA28',
  'Electrónica': '#42A5F5',
  'Mecânica': '#78909C',
  'Agropecuária': '#66BB6A',
  'Saúde': '#EF5350',
  'Turismo e Hotelaria': '#AB47BC',
  'Administração Pública': '#FF7043',
};

function cursoColor(curso: string) {
  return CURSO_COLORS[curso] || '#888';
}

async function req<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeader, ...opts?.headers },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Erro de servidor');
  return data as T;
}

export default function TrabalhosFinals() {
  const [trabalhos, setTrabalhos] = useState<TrabalhoFinal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('Todos');
  const [anoFiltro, setAnoFiltro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<TrabalhoFinal | null>(null);
  const [selectedItem, setSelectedItem] = useState<TrabalhoFinal | null>(null);
  const { showToast } = useToast();
  const { user } = useAuth();

  const canWrite = !['aluno', 'encarregado'].includes(user?.role || '');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await req<TrabalhoFinal[]>('/api/trabalhos-finais');
      setTrabalhos(rows);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const anos = Array.from(new Set(trabalhos.map(t => String(t.anoConclusao)))).sort((a, b) => Number(b) - Number(a));

  const filtered = trabalhos.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      t.titulo.toLowerCase().includes(q) ||
      t.autor.toLowerCase().includes(q) ||
      t.orientador.toLowerCase().includes(q);
    const matchCurso = cursoFiltro === 'Todos' || t.curso === cursoFiltro;
    const matchAno = !anoFiltro || String(t.anoConclusao) === anoFiltro;
    return matchSearch && matchCurso && matchAno;
  });

  const handleDelete = async (id: string) => {
    try {
      await req(`/api/trabalhos-finais/${id}`, { method: 'DELETE' });
      showToast('Trabalho removido com sucesso.', 'success');
      load(true);
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const handleView = async (item: TrabalhoFinal) => {
    setSelectedItem(item);
    try {
      const result = await req<{ visitas: number }>(`/api/trabalhos-finais/${item.id}/visita`, { method: 'POST' });
      setTrabalhos(prev =>
        prev.map(t => t.id === item.id ? { ...t, visitas: result.visitas } : t)
      );
      setSelectedItem(prev => prev && prev.id === item.id ? { ...prev, visitas: result.visitas } : prev);
    } catch {
    }
  };

  const topVisitados = [...trabalhos].sort((a, b) => (b.visitas || 0) - (a.visitas || 0)).slice(0, 3).filter(t => (t.visitas || 0) > 0);

  return (
    <View style={styles.root}>
      <TopBar
        title="Repositório de Trabalhos Finais"
        subtitle="13ª Classe — Ensino Técnico Profissional"
      />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar tema, autor, orientador…"
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
        {canWrite && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setEditItem(null); setShowModal(true); }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {CURSOS.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, cursoFiltro === c && styles.chipActive]}
            onPress={() => setCursoFiltro(c)}
          >
            <Text style={[styles.chipText, cursoFiltro === c && { color: '#fff' }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {anos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterScroll, { marginTop: 0 }]} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <TouchableOpacity
            style={[styles.anoChip, !anoFiltro && styles.anoChipActive]}
            onPress={() => setAnoFiltro('')}
          >
            <Text style={[styles.anoChipText, !anoFiltro && { color: '#fff' }]}>Todos os Anos</Text>
          </TouchableOpacity>
          {anos.map(a => (
            <TouchableOpacity
              key={a}
              style={[styles.anoChip, anoFiltro === a && styles.anoChipActive]}
              onPress={() => setAnoFiltro(a)}
            >
              <Text style={[styles.anoChipText, anoFiltro === a && { color: '#fff' }]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} trabalho{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#5E6AD2" size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          numColumns={Platform.OS === 'web' ? 2 : 1}
          key={Platform.OS === 'web' ? 'grid' : 'list'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5E6AD2" />}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
          columnWrapperStyle={Platform.OS === 'web' ? { gap: 12 } : undefined}
          ListHeaderComponent={
            topVisitados.length > 0 ? (
              <View style={styles.topBox}>
                <View style={styles.topHeader}>
                  <Ionicons name="flame" size={16} color="#FFA726" />
                  <Text style={styles.topTitle}>Mais Visitados</Text>
                </View>
                {topVisitados.map((t, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const color = cursoColor(t.curso);
                  return (
                    <TouchableOpacity key={t.id} style={styles.topItem} onPress={() => handleView(t)}>
                      <Text style={styles.topMedal}>{medals[idx]}</Text>
                      <View style={styles.topInfo}>
                        <Text style={styles.topItemTitle} numberOfLines={1}>{t.titulo}</Text>
                        <Text style={styles.topItemAutor} numberOfLines={1}>{t.autor} · {t.curso}</Text>
                      </View>
                      <View style={styles.topVisitasBox}>
                        <Ionicons name="eye" size={13} color="#FFA726" />
                        <Text style={styles.topVisitasNum}>{t.visitas}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="book-education-outline" size={56} color="#444" />
              <Text style={styles.emptyText}>Nenhum trabalho final encontrado</Text>
              {canWrite && <Text style={styles.emptySub}>Toque em + para registar o primeiro trabalho</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <TrabalhoCard
              item={item}
              canWrite={canWrite}
              onEdit={() => { setEditItem(item); setShowModal(true); }}
              onDelete={() => handleDelete(item.id)}
              onView={() => handleView(item)}
            />
          )}
        />
      )}

      <TrabalhoModal
        visible={showModal}
        item={editItem}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); load(true); }}
      />

      <DetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        canWrite={canWrite}
        onEdit={() => { setEditItem(selectedItem); setSelectedItem(null); setShowModal(true); }}
      />
    </View>
  );
}

function TrabalhoCard({ item, canWrite, onEdit, onDelete, onView }: {
  item: TrabalhoFinal;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const color = cursoColor(item.curso);
  return (
    <TouchableOpacity style={[styles.card, Platform.OS === 'web' && { flex: 1 }]} onPress={onView} activeOpacity={0.85}>
      <View style={styles.cardImageContainer}>
        {item.imagemCapa ? (
          <Image source={{ uri: item.imagemCapa }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImagePlaceholder, { backgroundColor: color + '22' }]}>
            <MaterialCommunityIcons name="book-open-page-variant" size={40} color={color} />
          </View>
        )}
        <View style={[styles.cursoBadge, { backgroundColor: color }]}>
          <Text style={styles.cursoBadgeText} numberOfLines={1}>{item.curso}</Text>
        </View>
        {item.visitas > 0 && (
          <View style={styles.visitasBadge}>
            <Ionicons name="eye" size={11} color="#fff" />
            <Text style={styles.visitasBadgeText}>{item.visitas}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitulo} numberOfLines={2}>{item.titulo}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="person-outline" size={13} color="#aaa" />
          <Text style={styles.cardMetaText} numberOfLines={1}>{item.autor}</Text>
        </View>
        <View style={styles.cardMeta}>
          <MaterialCommunityIcons name="account-tie-outline" size={13} color="#aaa" />
          <Text style={styles.cardMetaText} numberOfLines={1}>{item.orientador}</Text>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.anoBadge}>
            <Ionicons name="calendar-outline" size={12} color="#5E6AD2" />
            <Text style={styles.anoText}>{item.anoConclusao}</Text>
          </View>
          {canWrite && (
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
                <Ionicons name="pencil-outline" size={15} color="#5E6AD2" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
                <Ionicons name="trash-outline" size={15} color="#EF5350" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DetailModal({ item, onClose, canWrite, onEdit }: {
  item: TrabalhoFinal | null;
  onClose: () => void;
  canWrite: boolean;
  onEdit: () => void;
}) {
  if (!item) return null;
  const color = cursoColor(item.curso);
  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dStyles.overlay}>
        <View style={dStyles.sheet}>
          <View style={dStyles.header}>
            <Text style={dStyles.headerTitle} numberOfLines={2}>{item.titulo}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
          </View>
          <ScrollView style={dStyles.body}>
            <View style={dStyles.coverContainer}>
              {item.imagemCapa ? (
                <Image source={{ uri: item.imagemCapa }} style={dStyles.cover} resizeMode="cover" />
              ) : (
                <View style={[dStyles.coverPlaceholder, { backgroundColor: color + '22' }]}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={64} color={color} />
                  <Text style={[dStyles.coverPlaceholderText, { color }]}>Sem imagem de capa</Text>
                </View>
              )}
            </View>

            <View style={dStyles.metaRow}>
              <View style={[dStyles.cursoBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                <Text style={[dStyles.cursoText, { color }]}>{item.curso} — 13ª Classe</Text>
              </View>
              <View style={dStyles.visitasBox}>
                <Ionicons name="eye" size={15} color="#FFA726" />
                <Text style={dStyles.visitasNum}>{item.visitas || 0}</Text>
                <Text style={dStyles.visitasLabel}>visita{(item.visitas || 0) !== 1 ? 's' : ''}</Text>
              </View>
            </View>

            <View style={dStyles.infoGrid}>
              <View style={dStyles.infoItem}>
                <Text style={dStyles.infoLabel}>Autor</Text>
                <Text style={dStyles.infoValue}>{item.autor}</Text>
              </View>
              <View style={dStyles.infoItem}>
                <Text style={dStyles.infoLabel}>Orientador</Text>
                <Text style={dStyles.infoValue}>{item.orientador}</Text>
              </View>
              <View style={dStyles.infoItem}>
                <Text style={dStyles.infoLabel}>Ano de Conclusão</Text>
                <Text style={dStyles.infoValue}>{item.anoConclusao}</Text>
              </View>
            </View>

            {!!item.resumo && (
              <View style={dStyles.resumoBox}>
                <Text style={dStyles.resumoLabel}>Resumo / Descrição</Text>
                <Text style={dStyles.resumoText}>{item.resumo}</Text>
              </View>
            )}
          </ScrollView>
          {canWrite && (
            <View style={dStyles.footer}>
              <TouchableOpacity style={dStyles.editBtn} onPress={onEdit}>
                <Ionicons name="pencil" size={16} color="#fff" />
                <Text style={dStyles.editBtnText}>Editar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function TrabalhoModal({ visible, item, onClose, onSaved }: {
  visible: boolean;
  item: TrabalhoFinal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    autor: '',
    orientador: '',
    anoConclusao: String(new Date().getFullYear()),
    curso: 'Informática',
    imagemCapa: '',
    resumo: '',
  });

  useEffect(() => {
    if (item) {
      setForm({
        titulo: item.titulo,
        autor: item.autor,
        orientador: item.orientador,
        anoConclusao: String(item.anoConclusao),
        curso: item.curso,
        imagemCapa: item.imagemCapa || '',
        resumo: item.resumo || '',
      });
    } else {
      setForm({
        titulo: '',
        autor: '',
        orientador: '',
        anoConclusao: String(new Date().getFullYear()),
        curso: 'Informática',
        imagemCapa: '',
        resumo: '',
      });
    }
  }, [item, visible]);

  const upd = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append('file', file);
          const tok = await getAuthToken();
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: fd,
            credentials: 'include',
            headers: tok ? { Authorization: `Bearer ${tok}` } : undefined,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Erro ao carregar imagem');
          setForm(f => ({ ...f, imagemCapa: data.url }));
          showToast('Imagem carregada com sucesso.', 'success');
        } catch (err) {
          showToast((err as Error).message, 'error');
        } finally {
          setUploading(false);
        }
      };
      input.click();
    } else {
      showToast('Cole o URL da imagem no campo abaixo.', 'info');
    }
  };

  const save = async () => {
    if (!form.titulo.trim() || !form.autor.trim() || !form.orientador.trim() || !form.curso) {
      showToast('Tema, autor, orientador e curso são obrigatórios.', 'error');
      return;
    }
    const ano = parseInt(form.anoConclusao);
    if (isNaN(ano) || ano < 1990 || ano > new Date().getFullYear() + 1) {
      showToast('Ano de conclusão inválido.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        autor: form.autor.trim(),
        orientador: form.orientador.trim(),
        anoConclusao: ano,
        curso: form.curso,
        imagemCapa: form.imagemCapa.trim() || null,
        resumo: form.resumo.trim(),
      };
      if (item) {
        await req(`/api/trabalhos-finais/${item.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Trabalho actualizado com sucesso.', 'success');
      } else {
        await req('/api/trabalhos-finais', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Trabalho registado com sucesso.', 'success');
      }
      onSaved();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const color = cursoColor(form.curso);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.header}>
            <Text style={mStyles.headerTitle}>{item ? 'Editar Trabalho' : 'Registar Trabalho Final'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
          </View>
          <ScrollView style={mStyles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>

            <MLabel>Tema / Título *</MLabel>
            <MInput value={form.titulo} onChangeText={upd('titulo')} placeholder="Título do trabalho final" multiline style={{ height: 64, textAlignVertical: 'top' }} />

            <MLabel>Autor (Nome do Aluno) *</MLabel>
            <MInput value={form.autor} onChangeText={upd('autor')} placeholder="Nome completo do autor" />

            <MLabel>Orientador *</MLabel>
            <MInput value={form.orientador} onChangeText={upd('orientador')} placeholder="Nome do professor orientador" />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <MLabel>Ano de Conclusão *</MLabel>
                <MInput value={form.anoConclusao} onChangeText={upd('anoConclusao')} placeholder="Ex: 2024" keyboardType="numeric" maxLength={4} />
              </View>
            </View>

            <MLabel>Curso Técnico Profissional *</MLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
              {CURSOS.filter(c => c !== 'Todos').map(c => (
                <TouchableOpacity
                  key={c}
                  style={[mStyles.chip, form.curso === c && { backgroundColor: cursoColor(c), borderColor: cursoColor(c) }]}
                  onPress={() => setForm(f => ({ ...f, curso: c }))}
                >
                  <Text style={[mStyles.chipText, form.curso === c && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <MLabel>Imagem da Capa</MLabel>
            <TouchableOpacity style={mStyles.imagePickerBtn} onPress={handlePickImage} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color="#5E6AD2" size="small" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={18} color="#5E6AD2" />
                  <Text style={mStyles.imagePickerText}>{form.imagemCapa ? 'Alterar Imagem' : 'Seleccionar Imagem da Capa'}</Text>
                </>
              )}
            </TouchableOpacity>
            {!!form.imagemCapa && (
              <View style={mStyles.imagePreviewContainer}>
                <Image source={{ uri: form.imagemCapa }} style={mStyles.imagePreview} resizeMode="cover" />
                <TouchableOpacity style={mStyles.removeImageBtn} onPress={() => setForm(f => ({ ...f, imagemCapa: '' }))}>
                  <Ionicons name="close-circle" size={22} color="#EF5350" />
                </TouchableOpacity>
              </View>
            )}
            <MLabel>URL da imagem (opcional)</MLabel>
            <MInput value={form.imagemCapa} onChangeText={upd('imagemCapa')} placeholder="https://... ou cole aqui o link da imagem" />

            <MLabel>Resumo / Descrição</MLabel>
            <MInput value={form.resumo} onChangeText={upd('resumo')} placeholder="Breve resumo do trabalho..." multiline style={{ height: 90, textAlignVertical: 'top' }} />
          </ScrollView>
          <View style={mStyles.footer}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose}>
              <Text style={{ color: '#aaa', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mStyles.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={{ color: '#fff', fontWeight: '700' }}>{item ? 'Guardar' : 'Registar'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MLabel({ children }: { children: React.ReactNode }) {
  return <Text style={mStyles.label}>{children}</Text>;
}

function MInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      style={[mStyles.input, props.style]}
      placeholderTextColor="#555"
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1F35' },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a2a4a', borderRadius: 10, paddingHorizontal: 12, gap: 8, height: 42 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular' },
  addBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#5E6AD2', alignItems: 'center', justifyContent: 'center' },
  filterScroll: { marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1a2a4a', borderWidth: 1, borderColor: '#253a5e' },
  chipActive: { backgroundColor: '#5E6AD2', borderColor: '#5E6AD2' },
  chipText: { color: '#aaa', fontSize: 13, fontFamily: 'Inter_500Medium' },
  anoChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: '#1a2a4a', borderWidth: 1, borderColor: '#253a5e' },
  anoChipActive: { backgroundColor: '#243a6a', borderColor: '#5E6AD2' },
  anoChipText: { color: '#aaa', fontSize: 12, fontFamily: 'Inter_500Medium' },
  countRow: { paddingHorizontal: 16, paddingVertical: 4 },
  countText: { color: '#666', fontSize: 12, fontFamily: 'Inter_400Regular' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#aaa', fontSize: 16, fontFamily: 'Inter_500Medium' },
  emptySub: { color: '#666', fontSize: 13, fontFamily: 'Inter_400Regular' },
  card: {
    backgroundColor: '#111f3d',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e3055',
    marginBottom: 2,
  },
  cardImageContainer: { position: 'relative' },
  cardImage: { width: '100%', height: 160 },
  cardImagePlaceholder: { width: '100%', height: 160, alignItems: 'center', justifyContent: 'center' },
  cursoBadge: { position: 'absolute', bottom: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cursoBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  cardBody: { padding: 12, gap: 4 },
  cardTitulo: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText: { color: '#aaa', fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  anoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1a2a4a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  anoText: { color: '#5E6AD2', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#1a2a4a', alignItems: 'center', justifyContent: 'center' },
  visitasBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  visitasBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  topBox: { backgroundColor: '#111f3d', borderRadius: 14, borderWidth: 1, borderColor: '#1e3055', padding: 14, marginBottom: 12 },
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  topTitle: { color: '#FFA726', fontSize: 14, fontFamily: 'Inter_700Bold' },
  topItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1a2a4a' },
  topMedal: { fontSize: 20, width: 28, textAlign: 'center' },
  topInfo: { flex: 1 },
  topItemTitle: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  topItemAutor: { color: '#888', fontSize: 12, fontFamily: 'Inter_400Regular' },
  topVisitasBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFA72622', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  topVisitasNum: { color: '#FFA726', fontSize: 13, fontFamily: 'Inter_700Bold' },
});

const dStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#0e1e3d', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '92%', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 20, paddingBottom: 16, backgroundColor: '#0a1830', gap: 12 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold', lineHeight: 22 },
  body: { flex: 1, padding: 20 },
  coverContainer: { alignItems: 'center', marginBottom: 16 },
  cover: { width: 180, height: 250, borderRadius: 12 },
  coverPlaceholder: { width: 180, height: 250, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 12 },
  coverPlaceholderText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  cursoBadge: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  cursoText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  infoGrid: { gap: 14, marginBottom: 16 },
  infoItem: { gap: 3 },
  infoLabel: { color: '#666', fontSize: 12, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { color: '#fff', fontSize: 15, fontFamily: 'Inter_500Medium' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  visitasBox: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFA72620', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#FFA72633' },
  visitasNum: { color: '#FFA726', fontSize: 18, fontFamily: 'Inter_700Bold' },
  visitasLabel: { color: '#FFA726', fontSize: 12, fontFamily: 'Inter_400Regular' },
  resumoBox: { backgroundColor: '#1a2a4a', borderRadius: 10, padding: 14, gap: 6 },
  resumoLabel: { color: '#888', fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  resumoText: { color: '#ccc', fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  footer: { padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1a2a4a' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5E6AD2', borderRadius: 10, paddingVertical: 12 },
  editBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#0e1e3d', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '94%', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 16, backgroundColor: '#0a1830' },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold', flex: 1 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  label: { color: '#aaa', fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#1a2a4a', color: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 14, borderWidth: 1, borderColor: '#253a5e' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1a2a4a', borderWidth: 1, borderColor: '#253a5e' },
  chipText: { color: '#aaa', fontSize: 13, fontFamily: 'Inter_500Medium' },
  imagePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#5E6AD2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, justifyContent: 'center' },
  imagePickerText: { color: '#5E6AD2', fontSize: 14, fontFamily: 'Inter_500Medium' },
  imagePreviewContainer: { position: 'relative', alignSelf: 'center', marginBottom: 12 },
  imagePreview: { width: 120, height: 160, borderRadius: 10 },
  removeImageBtn: { position: 'absolute', top: -8, right: -8 },
  footer: { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#1a2a4a' },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 10, backgroundColor: '#1a2a4a' },
  saveBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 10, backgroundColor: '#5E6AD2' },
});
