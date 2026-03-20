import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Platform, Dimensions, FlatList, Image,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useConfig } from '@/context/ConfigContext';

// ─── Types ─────────────────────────────────────────────────────────────────

type DocTipo = 'declaracao' | 'certificado' | 'atestado' | 'oficio' | 'outro';
type Mode = 'list' | 'editor' | 'emit';

interface DocTemplate {
  id: string;
  nome: string;
  tipo: DocTipo;
  conteudo: string;
  criadoEm: string;
  atualizadoEm: string;
}

// ─── Variables definition ───────────────────────────────────────────────────

const VARIABLE_GROUPS = [
  {
    grupo: 'Aluno',
    icon: 'person',
    cor: Colors.info,
    vars: [
      { tag: '{{NOME_COMPLETO}}', desc: 'Nome e apelido completos', exemplo: 'João Manuel Silva' },
      { tag: '{{NOME}}', desc: 'Primeiro nome', exemplo: 'João' },
      { tag: '{{APELIDO}}', desc: 'Apelido', exemplo: 'Silva' },
      { tag: '{{DATA_NASCIMENTO}}', desc: 'Data de nascimento', exemplo: '15/03/2005' },
      { tag: '{{GENERO}}', desc: 'Género', exemplo: 'Masculino' },
      { tag: '{{PROVINCIA}}', desc: 'Província de naturalidade', exemplo: 'Luanda' },
      { tag: '{{MUNICIPIO}}', desc: 'Município / Naturalidade', exemplo: 'Belas' },
      { tag: '{{NUMERO_MATRICULA}}', desc: 'Número de matrícula', exemplo: '2025001' },
      { tag: '{{NOME_ENCARREGADO}}', desc: 'Nome do encarregado de educação', exemplo: 'Manuel Silva' },
      { tag: '{{TELEFONE_ENCARREGADO}}', desc: 'Telefone do encarregado', exemplo: '+244 923 456 789' },
    ],
  },
  {
    grupo: 'Turma',
    icon: 'people',
    cor: Colors.success,
    vars: [
      { tag: '{{TURMA}}', desc: 'Nome da turma', exemplo: '10ª A' },
      { tag: '{{CLASSE}}', desc: 'Classe', exemplo: '10ª Classe' },
      { tag: '{{NIVEL}}', desc: 'Nível de ensino', exemplo: 'II Ciclo' },
      { tag: '{{TURNO}}', desc: 'Turno', exemplo: 'Manhã' },
      { tag: '{{ANO_LECTIVO}}', desc: 'Ano lectivo', exemplo: '2025' },
    ],
  },
  {
    grupo: 'Escola',
    icon: 'school',
    cor: Colors.gold,
    vars: [
      { tag: '{{NOME_ESCOLA}}', desc: 'Nome da escola', exemplo: 'Escola Secundária N.º 1' },
      { tag: '{{NOME_DIRECTOR}}', desc: 'Nome do Director', exemplo: 'António Gomes' },
    ],
  },
  {
    grupo: 'Data',
    icon: 'calendar',
    cor: Colors.warning,
    vars: [
      { tag: '{{DATA_ACTUAL}}', desc: 'Data actual completa', exemplo: '20 de Março de 2026' },
      { tag: '{{MES_ACTUAL}}', desc: 'Mês actual por extenso', exemplo: 'Março' },
      { tag: '{{ANO_ACTUAL}}', desc: 'Ano actual', exemplo: '2026' },
    ],
  },
];

const TIPO_LABELS: Record<DocTipo, string> = {
  declaracao: 'Declaração',
  certificado: 'Certificado',
  atestado: 'Atestado',
  oficio: 'Ofício',
  outro: 'Outro',
};
const TIPO_COLORS: Record<DocTipo, string> = {
  declaracao: Colors.info,
  certificado: Colors.gold,
  atestado: Colors.success,
  oficio: Colors.warning,
  outro: Colors.textMuted,
};

const STORAGE_KEY = '@sgaa_doc_templates';
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function genId() { return 'tpl_' + Date.now() + Math.random().toString(36).slice(2, 7); }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function EditorDocumentos() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { alunos, turmas } = useData();
  const { config } = useConfig();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const [mode, setMode] = useState<Mode>('list');
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<DocTemplate | null>(null);
  const [editorNome, setEditorNome] = useState('');
  const [editorTipo, setEditorTipo] = useState<DocTipo>('declaracao');
  const [editorContent, setEditorContent] = useState('');
  const [showVarsPanel, setShowVarsPanel] = useState(true);
  const [activeVarGroup, setActiveVarGroup] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Emit state
  const [emitTemplate, setEmitTemplate] = useState<DocTemplate | null>(null);
  const [emitAlunoId, setEmitAlunoId] = useState('');
  const [emitPreview, setEmitPreview] = useState('');
  const [alunoSearch, setAlunoSearch] = useState('');

  const inputRef = useRef<TextInput>(null);

  // Load templates
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setTemplates(JSON.parse(raw));
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  async function saveTemplates(list: DocTemplate[]) {
    setTemplates(list);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function openNew() {
    setEditingTemplate(null);
    setEditorNome('Novo Documento');
    setEditorTipo('declaracao');
    setEditorContent('');
    setShowVarsPanel(true);
    setMode('editor');
  }

  function openEdit(t: DocTemplate) {
    setEditingTemplate(t);
    setEditorNome(t.nome);
    setEditorTipo(t.tipo);
    setEditorContent(t.conteudo);
    setShowVarsPanel(true);
    setMode('editor');
  }

  async function saveTemplate() {
    if (!editorNome.trim()) return;
    setIsSaving(true);
    const now = new Date().toISOString();
    let updated: DocTemplate[];
    if (editingTemplate) {
      updated = templates.map(t =>
        t.id === editingTemplate.id
          ? { ...t, nome: editorNome.trim(), tipo: editorTipo, conteudo: editorContent, atualizadoEm: now }
          : t
      );
    } else {
      const novo: DocTemplate = {
        id: genId(), nome: editorNome.trim(), tipo: editorTipo,
        conteudo: editorContent, criadoEm: now, atualizadoEm: now,
      };
      updated = [novo, ...templates];
    }
    await saveTemplates(updated);
    setIsSaving(false);
    setMode('list');
  }

  async function deleteTemplate(id: string) {
    const updated = templates.filter(t => t.id !== id);
    await saveTemplates(updated);
  }

  function openEmit(t: DocTemplate) {
    setEmitTemplate(t);
    setEmitAlunoId('');
    setEmitPreview('');
    setAlunoSearch('');
    setMode('emit');
  }

  // Insert variable into editor at cursor (web-aware)
  function insertVariable(tag: string) {
    if (Platform.OS === 'web') {
      const el = (inputRef.current as any)?._inputRef?.current as HTMLTextAreaElement | null
        || document.activeElement as HTMLTextAreaElement | null;
      if (el && el.tagName === 'TEXTAREA') {
        const start = el.selectionStart ?? editorContent.length;
        const end = el.selectionEnd ?? editorContent.length;
        const next = editorContent.slice(0, start) + tag + editorContent.slice(end);
        setEditorContent(next);
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + tag.length;
          el.focus();
        }, 0);
        return;
      }
    }
    setEditorContent(prev => prev + tag);
  }

  // Fill variables for a given student
  function buildPreview(template: DocTemplate, alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return template.conteudo;
    const turma = turmas.find(t => t.id === aluno.turmaId);
    const now = new Date();

    const map: Record<string, string> = {
      '{{NOME_COMPLETO}}': `${aluno.nome} ${aluno.apelido}`,
      '{{NOME}}': aluno.nome,
      '{{APELIDO}}': aluno.apelido,
      '{{DATA_NASCIMENTO}}': aluno.dataNascimento
        ? new Date(aluno.dataNascimento).toLocaleDateString('pt-PT') : '',
      '{{GENERO}}': aluno.genero === 'M' ? 'Masculino' : 'Feminino',
      '{{PROVINCIA}}': aluno.provincia || '',
      '{{MUNICIPIO}}': aluno.municipio || '',
      '{{NUMERO_MATRICULA}}': aluno.numeroMatricula || '',
      '{{NOME_ENCARREGADO}}': aluno.nomeEncarregado || '',
      '{{TELEFONE_ENCARREGADO}}': aluno.telefoneEncarregado || '',
      '{{TURMA}}': turma?.nome || '',
      '{{CLASSE}}': turma ? `${turma.classe} Classe` : '',
      '{{NIVEL}}': turma?.nivel || '',
      '{{TURNO}}': turma?.turno || '',
      '{{ANO_LECTIVO}}': turma?.anoLetivo || new Date().getFullYear().toString(),
      '{{NOME_ESCOLA}}': config.nomeEscola || '',
      '{{NOME_DIRECTOR}}': user?.nome || '',
      '{{DATA_ACTUAL}}': `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`,
      '{{MES_ACTUAL}}': MESES[now.getMonth()],
      '{{ANO_ACTUAL}}': now.getFullYear().toString(),
    };

    let result = template.conteudo;
    Object.entries(map).forEach(([k, v]) => {
      result = result.split(k).join(v);
    });
    return result;
  }

  function handleSelectAluno(alunoId: string) {
    setEmitAlunoId(alunoId);
    if (emitTemplate) setEmitPreview(buildPreview(emitTemplate, alunoId));
    setAlunoSearch('');
  }

  function handlePrint() {
    if (Platform.OS === 'web') {
      const win = window.open('', '_blank');
      if (!win) return;
      const aluno = alunos.find(a => a.id === emitAlunoId);
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <title>${emitTemplate?.nome || 'Documento'}</title>
          <style>
            body { font-family: 'Times New Roman', serif; margin: 60px; font-size: 14px; line-height: 1.8; color: #000; }
            h1 { text-align: center; font-size: 18px; margin-bottom: 8px; }
            .meta { text-align: center; color: #555; font-size: 12px; margin-bottom: 40px; }
            pre { white-space: pre-wrap; font-family: inherit; }
            @media print { body { margin: 30px 50px; } }
          </style>
        </head>
        <body>
          <h1>${config.nomeEscola}</h1>
          <div class="meta">${emitTemplate?.nome || ''} — ${aluno ? aluno.nome + ' ' + aluno.apelido : ''}</div>
          <pre>${emitPreview}</pre>
        </body>
        </html>
      `);
      win.document.close();
      win.print();
    }
  }

  const screenWidth = Dimensions.get('window').width;
  const isWide = screenWidth >= 768;

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (mode === 'list') return <ListScreen />;
  if (mode === 'editor') return <EditorScreen />;
  if (mode === 'emit') return <EmitScreen />;
  return null;

  // ─── LIST ─────────────────────────────────────────────────────────────────

  function ListScreen() {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Editor de Documentos</Text>
            <Text style={styles.headerSub}>{templates.length} modelo{templates.length !== 1 ? 's' : ''} guardado{templates.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={openNew} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>

        {templates.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="file-alt" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum modelo criado</Text>
            <Text style={styles.emptyDesc}>Crie o primeiro modelo de documento para a sua escola.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openNew}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Criar primeiro modelo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={templates}
            keyExtractor={t => t.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => <TemplateCard template={item} />}
          />
        )}
      </View>
    );
  }

  function TemplateCard({ template }: { template: DocTemplate }) {
    const [showMenu, setShowMenu] = useState(false);
    const tipoColor = TIPO_COLORS[template.tipo];
    const preview = template.conteudo.slice(0, 120).replace(/\n/g, ' ');

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.tipoBadge, { backgroundColor: tipoColor + '22' }]}>
            <Text style={[styles.tipoText, { color: tipoColor }]}>{TIPO_LABELS[template.tipo]}</Text>
          </View>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(v => !v)}>
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardNome}>{template.nome}</Text>
        <Text style={styles.cardPreview} numberOfLines={2}>{preview || 'Sem conteúdo'}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>Actualizado: {fmtDate(template.atualizadoEm)}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.cardActionBtn} onPress={() => openEmit(template)}>
              <Ionicons name="document-text" size={14} color={Colors.success} />
              <Text style={[styles.cardActionText, { color: Colors.success }]}>Emitir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cardActionBtn} onPress={() => openEdit(template)}>
              <Ionicons name="pencil" size={14} color={Colors.info} />
              <Text style={[styles.cardActionText, { color: Colors.info }]}>Editar</Text>
            </TouchableOpacity>
          </View>
        </View>
        {showMenu && (
          <View style={styles.dropMenu}>
            <TouchableOpacity style={styles.dropItem} onPress={() => { setShowMenu(false); openEdit(template); }}>
              <Ionicons name="pencil-outline" size={16} color={Colors.text} />
              <Text style={styles.dropItemText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropItem} onPress={() => { setShowMenu(false); openEmit(template); }}>
              <Ionicons name="document-text-outline" size={16} color={Colors.success} />
              <Text style={[styles.dropItemText, { color: Colors.success }]}>Emitir documento</Text>
            </TouchableOpacity>
            <View style={styles.dropDivider} />
            <TouchableOpacity style={styles.dropItem} onPress={() => { setShowMenu(false); deleteTemplate(template.id); }}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={[styles.dropItemText, { color: Colors.danger }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ─── EDITOR ───────────────────────────────────────────────────────────────

  function EditorScreen() {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        {/* Editor Header */}
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.backBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
          <TextInput
            style={styles.editorNomeInput}
            value={editorNome}
            onChangeText={setEditorNome}
            placeholder="Nome do modelo..."
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
            onPress={saveTemplate}
            disabled={isSaving}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>{isSaving ? 'A guardar...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>

        {/* Tipo selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tipoScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {(Object.keys(TIPO_LABELS) as DocTipo[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tipoChip, editorTipo === t && { backgroundColor: TIPO_COLORS[t], borderColor: TIPO_COLORS[t] }]}
              onPress={() => setEditorTipo(t)}
            >
              <Text style={[styles.tipoChipText, editorTipo === t && { color: '#fff' }]}>{TIPO_LABELS[t]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.editorBody, isWide && { flexDirection: 'row' }]}>
          {/* Text area */}
          <View style={[styles.editorTextWrap, isWide && { flex: 1 }]}>
            <View style={styles.editorToolbar}>
              <Text style={styles.editorToolbarLabel}>Área de edição</Text>
              <TouchableOpacity onPress={() => setShowVarsPanel(v => !v)} style={styles.toggleVarsBtn}>
                <Ionicons name={showVarsPanel ? 'eye-off-outline' : 'code-slash'} size={15} color={Colors.textSecondary} />
                <Text style={styles.toggleVarsText}>{showVarsPanel ? 'Ocultar variáveis' : 'Ver variáveis'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              ref={inputRef}
              style={styles.editorTextInput}
              value={editorContent}
              onChangeText={setEditorContent}
              multiline
              textAlignVertical="top"
              placeholder={`Escreva o conteúdo do documento aqui...\n\nUse as variáveis no painel ao lado para inserir dados automáticos.\n\nExemplo:\nEu, {{NOME_DIRECTOR}}, Director(a) da {{NOME_ESCOLA}}, declaro que {{NOME_COMPLETO}}, portador(a) do BI nº _______, filho(a) de _______ e _______, nascido(a) em {{DATA_NASCIMENTO}}, na província de {{PROVINCIA}}, está regularmente matriculado(a) na {{CLASSE}}, turma {{TURMA}}, no ano lectivo {{ANO_LECTIVO}}.\n\nLuanda, {{DATA_ACTUAL}}.`}
              placeholderTextColor={Colors.textMuted}
            />
            <View style={styles.editorStats}>
              <Text style={styles.editorStatsText}>{editorContent.length} caracteres · {editorContent.split('\n').length} linhas</Text>
            </View>
          </View>

          {/* Variables panel */}
          {showVarsPanel && (
            <View style={[styles.varsPanel, isWide && { width: 260 }]}>
              <View style={styles.varsPanelHeader}>
                <Ionicons name="code-slash" size={15} color={Colors.gold} />
                <Text style={styles.varsPanelTitle}>Variáveis disponíveis</Text>
              </View>
              <Text style={styles.varsPanelHint}>Toque numa variável para inserir no documento</Text>

              {/* Group tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupTabScroll} contentContainerStyle={{ gap: 6 }}>
                {VARIABLE_GROUPS.map((g, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.groupTab, activeVarGroup === i && { backgroundColor: g.cor + '22', borderColor: g.cor }]}
                    onPress={() => setActiveVarGroup(i)}
                  >
                    <Ionicons name={g.icon as any} size={13} color={activeVarGroup === i ? g.cor : Colors.textMuted} />
                    <Text style={[styles.groupTabText, activeVarGroup === i && { color: g.cor }]}>{g.grupo}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Variables list */}
              <ScrollView style={styles.varsList} showsVerticalScrollIndicator={false}>
                {VARIABLE_GROUPS[activeVarGroup].vars.map((v, i) => (
                  <TouchableOpacity key={i} style={styles.varItem} onPress={() => insertVariable(v.tag)} activeOpacity={0.7}>
                    <View style={styles.varItemInner}>
                      <Text style={styles.varTag}>{v.tag}</Text>
                      <Text style={styles.varDesc}>{v.desc}</Text>
                      <Text style={styles.varExemplo}>Ex: {v.exemplo}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={18} color={VARIABLE_GROUPS[activeVarGroup].cor} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ─── EMIT ─────────────────────────────────────────────────────────────────

  function EmitScreen() {
    const alunosAtivos = alunos.filter(a => a.ativo);
    const filteredAlunos = alunoSearch.trim()
      ? alunosAtivos.filter(a =>
          `${a.nome} ${a.apelido} ${a.numeroMatricula}`.toLowerCase().includes(alunoSearch.toLowerCase())
        )
      : alunosAtivos;

    const selectedAluno = alunos.find(a => a.id === emitAlunoId);
    const selectedTurma = selectedAluno ? turmas.find(t => t.id === selectedAluno.turmaId) : null;

    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Emitir Documento</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{emitTemplate?.nome}</Text>
          </View>
          {emitAlunoId && emitPreview ? (
            <TouchableOpacity style={styles.printBtn} onPress={handlePrint} activeOpacity={0.8}>
              <Ionicons name="print" size={16} color="#fff" />
              <Text style={styles.printBtnText}>Imprimir</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.emitBody, isWide && { flexDirection: 'row' }]}>
          {/* Left: Student selector */}
          <View style={[styles.emitLeft, isWide && { width: 300 }]}>
            <Text style={styles.emitSectionTitle}>1. Seleccionar Aluno</Text>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={alunoSearch}
                onChangeText={setAlunoSearch}
                placeholder="Pesquisar aluno..."
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {filteredAlunos.slice(0, 50).map(aluno => {
                const t = turmas.find(tr => tr.id === aluno.turmaId);
                const sel = emitAlunoId === aluno.id;
                return (
                  <TouchableOpacity
                    key={aluno.id}
                    style={[styles.alunoItem, sel && styles.alunoItemSel]}
                    onPress={() => handleSelectAluno(aluno.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.alunoAvatar, sel && { backgroundColor: Colors.info }]}>
                      <Text style={styles.alunoAvatarText}>{aluno.nome.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alunoNome, sel && { color: Colors.info }]}>{aluno.nome} {aluno.apelido}</Text>
                      <Text style={styles.alunoMeta}>{t ? `${t.classe} · ${t.nome}` : 'Sem turma'} · Nº {aluno.numeroMatricula}</Text>
                    </View>
                    {sel && <Ionicons name="checkmark-circle" size={18} color={Colors.info} />}
                  </TouchableOpacity>
                );
              })}
              {filteredAlunos.length === 0 && (
                <Text style={styles.noAlunos}>Nenhum aluno encontrado</Text>
              )}
            </ScrollView>

            {selectedAluno && (
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedInfoTitle}>Aluno seleccionado:</Text>
                <Text style={styles.selectedInfoName}>{selectedAluno.nome} {selectedAluno.apelido}</Text>
                <Text style={styles.selectedInfoMeta}>{selectedTurma?.classe} · {selectedTurma?.nome} · {selectedAluno.provincia}</Text>
              </View>
            )}
          </View>

          {/* Right: Preview */}
          <View style={[styles.emitRight, isWide && { flex: 1 }]}>
            <Text style={styles.emitSectionTitle}>2. Pré-visualização do Documento</Text>
            {!emitPreview ? (
              <View style={styles.previewEmpty}>
                <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.previewEmptyText}>Seleccione um aluno para pré-visualizar o documento com os dados preenchidos</Text>
              </View>
            ) : (
              <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
                {/* Document header */}
                <View style={styles.docHeader}>
                  <Text style={styles.docEscola}>{config.nomeEscola}</Text>
                  <Text style={styles.docTipo}>{TIPO_LABELS[emitTemplate!.tipo]}</Text>
                  <View style={styles.docDivider} />
                </View>
                {/* Document body */}
                <Text style={styles.docBody}>{emitPreview}</Text>
                {/* Signature area */}
                <View style={styles.docSignature}>
                  <Text style={styles.docSignatureDate}>Luanda, {new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
                  <View style={styles.docSignatureLine} />
                  <Text style={styles.docSignatureName}>{user?.nome}</Text>
                  <Text style={styles.docSignatureRole}>Director(a)</Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    );
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.primaryDark,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10,
  },
  newBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  printBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.success, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10,
  },
  printBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // List
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: Colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // Card
  card: {
    backgroundColor: Colors.backgroundCard, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tipoBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  tipoText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  menuBtn: { padding: 4 },
  cardNome: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  cardPreview: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  cardActions: { flexDirection: 'row', gap: 8 },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.surface, borderRadius: 8 },
  cardActionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  dropMenu: {
    position: 'absolute', top: 48, right: 8, zIndex: 99,
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 8, minWidth: 200, padding: 4,
  },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  dropItemText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text },
  dropDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },

  // Editor
  editorHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.primaryDark,
  },
  editorNomeInput: {
    flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text,
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.success, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  tipoScroll: { maxHeight: 48, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tipoChip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'center',
  },
  tipoChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  editorBody: { flex: 1, flexDirection: 'column' },
  editorTextWrap: { flex: 1, display: 'flex', flexDirection: 'column' },
  editorToolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  editorToolbarLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  toggleVarsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toggleVarsText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  editorTextInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Inter_400Regular',
    color: Colors.text, backgroundColor: Colors.background,
    lineHeight: 24,
  },
  editorStats: {
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: Colors.backgroundCard, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  editorStatsText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  // Variables panel
  varsPanel: {
    backgroundColor: Colors.primaryDark, borderTopWidth: 1, borderTopColor: Colors.border,
    borderLeftWidth: 1, borderLeftColor: Colors.border, maxHeight: 320,
  },
  varsPanelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4,
  },
  varsPanelTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.8 },
  varsPanelHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, paddingHorizontal: 14, paddingBottom: 8 },
  groupTabScroll: { paddingHorizontal: 10, paddingBottom: 8 },
  groupTab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  groupTabText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  varsList: { flex: 1, paddingHorizontal: 10 },
  varItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 8,
  },
  varItemInner: { flex: 1 },
  varTag: { fontSize: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Inter_600SemiBold', color: Colors.gold },
  varDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 1 },
  varExemplo: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1, fontStyle: 'italic' },

  // Emit
  emitBody: { flex: 1, flexDirection: 'column' },
  emitLeft: {
    borderRightWidth: 1, borderRightColor: Colors.border,
    backgroundColor: Colors.primaryDark, padding: 14,
    maxHeight: '100%',
  },
  emitRight: { flex: 1, padding: 14 },
  emitSectionTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text },
  alunoItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 10, marginBottom: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  alunoItemSel: { backgroundColor: Colors.info + '15', borderColor: Colors.info + '50' },
  alunoAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  alunoAvatarText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  alunoNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  alunoMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  noAlunos: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', padding: 20 },
  selectedInfo: {
    marginTop: 10, padding: 12, backgroundColor: Colors.info + '15',
    borderRadius: 10, borderWidth: 1, borderColor: Colors.info + '40',
  },
  selectedInfoTitle: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textTransform: 'uppercase' },
  selectedInfoName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 2 },
  selectedInfoMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2 },

  // Preview
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 },
  previewEmptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', maxWidth: 300 },
  previewScroll: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 24 },
  docHeader: { alignItems: 'center', marginBottom: 24 },
  docEscola: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1a1a1a', textAlign: 'center' },
  docTipo: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#444', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  docDivider: { height: 2, backgroundColor: '#1a1a1a', width: 60, marginTop: 10 },
  docBody: { fontSize: 14, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'Inter_400Regular', color: '#1a1a1a', lineHeight: 26, textAlign: 'justify' },
  docSignature: { marginTop: 48, alignItems: 'center', gap: 4 },
  docSignatureDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#444' },
  docSignatureLine: { width: 200, height: 1, backgroundColor: '#333', marginTop: 40, marginBottom: 6 },
  docSignatureName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#1a1a1a' },
  docSignatureRole: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#444' },
});
