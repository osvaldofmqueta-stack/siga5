import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type PermKey =
  | 'dashboard' | 'ceo_dashboard' | 'alunos' | 'professores' | 'turmas' | 'salas'
  | 'notas' | 'presencas' | 'horario' | 'historico' | 'grelha'
  | 'financeiro' | 'relatorios' | 'rh_controle' | 'admin'
  | 'editor_documentos' | 'secretaria_hub' | 'professor_hub'
  | 'professor_turmas' | 'professor_pauta' | 'professor_sumario'
  | 'professor_mensagens' | 'professor_materiais'
  | 'portal_estudante' | 'eventos' | 'notificacoes'
  | 'boletim_matricula' | 'boletim_propina' | 'gestao_academica'
  | 'gestao_acessos'
  | 'admissao' | 'disciplinas' | 'pedagogico' | 'desempenho'
  | 'visao_geral' | 'rh_hub' | 'controlo_supervisao' | 'portal_encarregado'
  | 'biblioteca' | 'transferencias' | 'avaliacao_professores' | 'chat_interno'
  | 'auditoria' | 'bolsas' | 'calendario_academico' | 'pagamentos_hub'
  | 'extrato_propinas' | 'quadro_honra' | 'rh_payroll' | 'trabalhos_finais'
  | 'documentos_hub' | 'plano_aula' | 'exclusoes_faltas' | 'financeiro_relatorios';

export interface FeatureDef {
  key: PermKey;
  label: string;
  desc: string;
  roles: string[];
}

export interface FeatureCategory {
  categoria: string;
  icon: string;
  features: FeatureDef[];
}

// ─── Mapa completo de funcionalidades ─────────────────────────────────────────
export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    categoria: 'Painéis & Dashboards',
    icon: 'grid',
    features: [
      { key: 'dashboard', label: 'Dashboard Principal', desc: 'Visão geral da escola com estatísticas', roles: ['admin', 'director', 'pedagogico', 'ceo', 'pca'] },
      { key: 'ceo_dashboard', label: 'Dashboard CEO', desc: 'Painel executivo de alto nível — acesso exclusivo à direcção executiva', roles: ['ceo', 'pca'] },
      { key: 'secretaria_hub', label: 'Painel da Secretaria', desc: 'Hub central da secretaria escolar', roles: ['secretaria', 'ceo', 'pca'] },
      { key: 'professor_hub', label: 'Painel do Professor', desc: 'Hub pessoal do professor', roles: ['professor', 'ceo', 'pca'] },
      { key: 'portal_estudante', label: 'Portal do Estudante', desc: 'Área pessoal do aluno', roles: ['aluno', 'ceo', 'pca'] },
      { key: 'portal_encarregado', label: 'Portal do Encarregado', desc: 'Painel do encarregado de educação com notas, presenças e financeiro', roles: ['encarregado', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Gestão Académica',
    icon: 'school',
    features: [
      { key: 'alunos', label: 'Alunos', desc: 'Registo, matrícula e gestão de alunos', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'ceo', 'pca'] },
      { key: 'professores', label: 'Professores', desc: 'Gestão do corpo docente', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'ceo', 'pca'] },
      { key: 'turmas', label: 'Turmas', desc: 'Criação e gestão de turmas', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'ceo', 'pca'] },
      { key: 'salas', label: 'Salas de Aula', desc: 'Gestão e atribuição de salas', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'ceo', 'pca'] },
      { key: 'notas', label: 'Notas & Pautas', desc: 'Registo e consulta de notas', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'ceo', 'pca'] },
      { key: 'presencas', label: 'Presenças', desc: 'Controlo de assiduidade', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'ceo', 'pca'] },
      { key: 'horario', label: 'Horário', desc: 'Horários de aulas e turnos', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'professor', 'aluno', 'ceo', 'pca'] },
      { key: 'historico', label: 'Histórico Académico', desc: 'Registo histórico de percurso', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'aluno', 'ceo', 'pca'] },
      { key: 'grelha', label: 'Grelha Curricular', desc: 'Estrutura e plano curricular', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'ceo', 'pca'] },
      { key: 'gestao_academica', label: 'Gestão Académica (Hub)', desc: 'Hub geral de gestão académica', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'ceo', 'pca'] },
      { key: 'admissao', label: 'Admissões', desc: 'Processo de candidatura e admissão de novos alunos', roles: ['admin', 'director', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'disciplinas', label: 'Disciplinas', desc: 'Gestão e configuração das disciplinas e conteúdos programáticos', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'transferencias', label: 'Transferências', desc: 'Gestão de entradas e saídas de alunos por transferência escolar', roles: ['admin', 'director', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Professor',
    icon: 'book',
    features: [
      { key: 'professor_turmas', label: 'Minhas Turmas', desc: 'Turmas atribuídas ao professor', roles: ['professor', 'ceo', 'pca'] },
      { key: 'professor_pauta', label: 'Pautas & Notas', desc: 'Lançamento de notas pelo professor', roles: ['professor', 'ceo', 'pca'] },
      { key: 'professor_sumario', label: 'Sumário / Presenças', desc: 'Registos de aula e assiduidade', roles: ['professor', 'ceo', 'pca'] },
      { key: 'professor_mensagens', label: 'Mensagens', desc: 'Comunicação interna do professor', roles: ['professor', 'ceo', 'pca'] },
      { key: 'professor_materiais', label: 'Materiais Didáticos', desc: 'Partilha de conteúdos pedagógicos', roles: ['professor', 'ceo', 'pca'] },
      { key: 'pedagogico', label: 'Área Pedagógica', desc: 'Gestão pedagógica: sumários, calendário de provas, solicitações e pautas', roles: ['admin', 'director', 'pedagogico', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Financeiro',
    icon: 'cash',
    features: [
      { key: 'financeiro', label: 'Gestão Financeira', desc: 'Propinas, pagamentos e rubricas — gestão operacional do departamento financeiro', roles: ['financeiro', 'admin', 'director', 'ceo', 'pca'] },
      { key: 'boletim_propina', label: 'Boletim de Propina', desc: 'Geração de recibos de propina — emitido pelo financeiro e disponível à secretaria para entrega ao aluno', roles: ['financeiro', 'secretaria', 'admin', 'director', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Planeamento',
    icon: 'calendar',
    features: [
      { key: 'eventos', label: 'Calendário Escolar', desc: 'Eventos, feriados e actividades', roles: ['admin', 'director', 'secretaria', 'professor', 'aluno', 'ceo', 'pca'] },
      { key: 'notificacoes', label: 'Notificações', desc: 'Centro de avisos e alertas', roles: ['admin', 'director', 'secretaria', 'professor', 'aluno', 'financeiro', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Relatórios & RH',
    icon: 'bar-chart',
    features: [
      { key: 'relatorios', label: 'Relatórios & Análise', desc: 'Gráficos e exportação de dados', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'ceo', 'pca'] },
      { key: 'rh_controle', label: 'Controlo de RH', desc: 'Gestão de recursos humanos — responsabilidade do departamento de RH e direcção', roles: ['rh', 'admin', 'director', 'ceo', 'pca'] },
      { key: 'desempenho', label: 'Análise de Desempenho', desc: 'Análise detalhada de notas e desempenho por turma e aluno', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'visao_geral', label: 'Visão Geral Multi-Ano', desc: 'Comparação de indicadores académicos e financeiros entre anos lectivos', roles: ['admin', 'director', 'pedagogico', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'rh_hub', label: 'Hub de Recursos Humanos', desc: 'Centro de gestão de RH: professores, contratos, avaliações e presenças', roles: ['rh', 'admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Documentos',
    icon: 'newspaper',
    features: [
      { key: 'editor_documentos', label: 'Editor de Documentos', desc: 'Modelos e emissão de documentos', roles: ['secretaria', 'admin', 'director', 'pedagogico', 'ceo', 'pca'] },
      { key: 'boletim_matricula', label: 'Boletim de Matrícula', desc: 'Impressão de ficha de matrícula', roles: ['secretaria', 'admin', 'director', 'pedagogico', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Pedagógico & Qualidade',
    icon: 'star',
    features: [
      { key: 'avaliacao_professores', label: 'Avaliação de Professores', desc: 'Avaliação pedagógica de professores pela direcção', roles: ['admin', 'director', 'pedagogico', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Biblioteca Escolar',
    icon: 'library',
    features: [
      { key: 'biblioteca', label: 'Biblioteca Escolar', desc: 'Gestão de livros, empréstimos e devoluções', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'chefe_secretaria', 'professor', 'aluno', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Comunicação Interna',
    icon: 'chatbubbles',
    features: [
      { key: 'chat_interno', label: 'Chat Interno', desc: 'Comunicação centralizada entre secretaria, direcção e professores', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'chefe_secretaria', 'professor', 'financeiro', 'rh', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Financeiro Avançado',
    icon: 'cash-outline',
    features: [
      { key: 'financeiro_relatorios', label: 'Relatórios Financeiros', desc: 'Relatórios financeiros mensais, trimestrais e anuais com gráficos', roles: ['financeiro', 'admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'extrato_propinas', label: 'Extrato de Propinas', desc: 'Consulta e emissão de extratos de propinas por aluno', roles: ['secretaria', 'admin', 'director', 'financeiro', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'bolsas', label: 'Bolsas e Subsídios', desc: 'Gestão de bolsas de estudo e subsídios a alunos', roles: ['admin', 'director', 'financeiro', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'pagamentos_hub', label: 'Hub de Pagamentos', desc: 'Portal de auto-serviço para alunos e encarregados efetuarem pagamentos de rubricas', roles: ['aluno', 'encarregado', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Planeamento Pedagógico',
    icon: 'book-outline',
    features: [
      { key: 'plano_aula', label: 'Plano de Aula', desc: 'Criação e gestão de planos de aula pelos professores', roles: ['professor', 'admin', 'director', 'pedagogico', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'trabalhos_finais', label: 'Trabalhos Finais / PAP', desc: 'Gestão de trabalhos finais e Provas de Aptidão Profissional', roles: ['admin', 'director', 'pedagogico', 'professor', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'quadro_honra', label: 'Quadro de Honra', desc: 'Publicação e visualização do quadro de honra escolar', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'professor', 'aluno', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'exclusoes_faltas', label: 'Exclusões de Faltas', desc: 'Gestão de exclusões por excesso de faltas', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Calendário & Documentação',
    icon: 'calendar-outline',
    features: [
      { key: 'calendario_academico', label: 'Calendário Académico', desc: 'Gestão do calendário oficial do ano lectivo', roles: ['admin', 'director', 'pedagogico', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'documentos_hub', label: 'Hub de Documentos', desc: 'Centro centralizado de consulta e emissão de documentos escolares', roles: ['admin', 'director', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Recursos Humanos Avançado',
    icon: 'people-outline',
    features: [
      { key: 'rh_payroll', label: 'Processamento de Salários', desc: 'Cálculo e emissão de folhas de vencimentos e processamento salarial', roles: ['rh', 'admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Administração',
    icon: 'shield-checkmark',
    features: [
      { key: 'admin', label: 'Super Administração', desc: 'Configurações avançadas do sistema — exclusivo ao administrador técnico do sistema', roles: ['admin', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'gestao_acessos', label: 'Gestão de Acessos', desc: 'Controlar permissões e acessos de utilizadores', roles: ['chefe_secretaria', 'ceo', 'pca'] },
      { key: 'controlo_supervisao', label: 'Controlo & Supervisão', desc: 'Painel de supervisão geral: utilizadores, secretaria, académico e financeiro', roles: ['admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'auditoria', label: 'Auditoria do Sistema', desc: 'Registo detalhado de todas as acções realizadas no sistema', roles: ['admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
];

// ─── Permissões padrão por cargo ──────────────────────────────────────────────
const ALL_KEYS: PermKey[] = FEATURE_CATEGORIES.flatMap(c => c.features.map(f => f.key));

export const ROLE_DEFAULTS: Record<string, PermKey[]> = {
  // ── Executivos: acesso total ──────────────────────────────────────
  ceo: [...ALL_KEYS],
  pca: [...ALL_KEYS],

  // ── Chefe de Secretaria: supervisão e coordenação de toda a secretaria ──
  // Pode visualizar e supervisionar todos os módulos, mas as operações
  // diárias pertencem aos respectivos departamentos.
  chefe_secretaria: ALL_KEYS.filter(k => k !== 'ceo_dashboard'),

  // ── Director: direcção estratégica e supervisão institucional ────
  // Visão global de todos os departamentos, aprovações e decisões.
  // Supervisiona mas NÃO opera: não configura o sistema (admin), não gere
  // acessos (chefe_secretaria/admin), não acede ao hub operacional da secretaria.
  // Não faz operações financeiras nem de RH directamente.
  director: [
    'dashboard', 'eventos', 'notificacoes', 'chat_interno',
    'calendario_academico', 'controlo_supervisao', 'auditoria',
    // Académico (supervisão)
    'alunos', 'professores', 'turmas', 'salas', 'notas', 'presencas',
    'horario', 'historico', 'grelha', 'gestao_academica', 'admissao',
    'disciplinas', 'transferencias', 'biblioteca',
    // Pedagógico (supervisão)
    'pedagogico', 'avaliacao_professores', 'desempenho', 'visao_geral',
    'relatorios', 'quadro_honra', 'trabalhos_finais', 'exclusoes_faltas',
    // Financeiro (supervisão — ver relatórios, não operar)
    'financeiro_relatorios', 'extrato_propinas',
    // RH (supervisão estratégica — ver relatórios e controlo, não operar folhas de salário)
    'rh_hub', 'rh_controle',
    // Documentos (director assina e revê documentos oficiais)
    'editor_documentos', 'boletim_matricula', 'boletim_propina', 'documentos_hub',
  ] as PermKey[],

  // ── Admin: configuração do sistema e gestão de utilizadores ──────
  // Responsabilidade técnica: configurar o sistema, gerir utilizadores
  // e controlar acessos. Não faz operações financeiras ou de RH.
  admin: [
    'dashboard', 'notificacoes', 'chat_interno', 'eventos', 'calendario_academico',
    // Sistema
    'admin', 'gestao_acessos', 'controlo_supervisao', 'auditoria',
    // Gestão de utilizadores (precisa ver alunos/professores para criar contas)
    'alunos', 'professores', 'turmas', 'salas',
    'notas', 'presencas', 'horario', 'historico', 'admissao',
    'disciplinas', 'grelha', 'transferencias', 'gestao_academica',
    'boletim_matricula', 'editor_documentos', 'secretaria_hub',
    'pedagogico', 'avaliacao_professores', 'desempenho', 'visao_geral',
    'relatorios', 'quadro_honra', 'trabalhos_finais', 'exclusoes_faltas',
    'biblioteca', 'documentos_hub',
  ],

  // ── Secretaria: operações administrativas académicas ─────────────
  // Matrícula, documentos, transferências, correspondência escolar.
  // NÃO faz gestão financeira (é do financeiro) nem RH (é do rh).
  secretaria: [
    'secretaria_hub', 'notificacoes', 'chat_interno', 'eventos', 'calendario_academico',
    // Operações académicas (core da secretaria)
    'alunos', 'turmas', 'presencas', 'notas', 'horario', 'historico',
    'admissao', 'transferencias', 'gestao_academica',
    // Parametrização curricular (cursos, disciplinas, áreas de formação)
    'disciplinas', 'grelha',
    // Documentos (responsabilidade da secretaria)
    'editor_documentos', 'boletim_matricula', 'boletim_propina', 'documentos_hub',
    // Planeamento
    'salas', 'biblioteca', 'quadro_honra', 'trabalhos_finais',
  ],

  // ── Financeiro: gestão financeira completa ───────────────────────
  // Rubricas, pagamentos, bolsas, comprovativos, relatórios financeiros.
  // NÃO faz gestão académica nem de RH.
  financeiro: [
    'financeiro', 'notificacoes', 'chat_interno',
    // Operações financeiras (core do financeiro)
    'boletim_propina', 'extrato_propinas', 'bolsas',
    'pagamentos_hub', 'documentos_hub', 'financeiro_relatorios',
  ],

  // ── RH: recursos humanos e processamento salarial ────────────────
  // Gestão de pessoal docente, contratos, avaliações, folhas de salário.
  // NÃO faz gestão académica de alunos nem financeiro de propinas.
  // NÃO acede a sumários de aula (professor_sumario) — esses são registos
  // lectivos do professor, não documentos de RH.
  rh: [
    'rh_hub', 'rh_controle', 'rh_payroll', 'notificacoes', 'chat_interno',
    // Acesso ao registo do pessoal docente (necessário para contratos e avaliações)
    'professores', 'horario', 'calendario_academico',
  ],

  // ── Pedagógico: qualidade académica e currículo ──────────────────
  // Currículo, avaliação de professores, análise académica, pedagógica.
  // NÃO faz gestão financeira nem operações de secretaria.
  pedagogico: [
    'dashboard', 'notificacoes', 'chat_interno', 'eventos', 'calendario_academico',
    // Académico (análise e qualidade)
    'alunos', 'professores', 'turmas', 'salas', 'notas', 'presencas',
    'horario', 'historico', 'disciplinas', 'grelha', 'biblioteca',
    // Pedagógico (core do pedagógico)
    'pedagogico', 'avaliacao_professores', 'gestao_academica',
    'desempenho', 'visao_geral', 'relatorios',
    // Qualidade académica
    'quadro_honra', 'trabalhos_finais', 'exclusoes_faltas', 'plano_aula',
  ],

  // ── Professor: docência e actividade lectiva ──────────────────────
  // Lançamento de notas, sumários, materiais, comunicação com alunos.
  // NÃO tem acesso a funções de gestão pedagógica ou de avaliação de outros professores.
  professor: [
    'professor_hub', 'notificacoes', 'chat_interno', 'eventos',
    // Actividade lectiva (core do professor)
    'professor_turmas', 'professor_pauta', 'horario',
    'professor_sumario', 'professor_mensagens', 'professor_materiais',
    // Recursos
    'biblioteca', 'quadro_honra', 'trabalhos_finais', 'plano_aula',
  ],

  // ── Aluno: portal do estudante ────────────────────────────────────
  aluno: [
    'portal_estudante', 'notificacoes', 'horario', 'historico',
    'eventos', 'biblioteca', 'pagamentos_hub', 'quadro_honra',
  ],

  // ── Encarregado: portal do encarregado de educação ───────────────
  encarregado: ['portal_encarregado', 'notificacoes', 'pagamentos_hub'],
};

// ─── Context ──────────────────────────────────────────────────────────────────
interface UserPermRecord {
  userId: string;
  permissoes: Record<string, boolean>;
}

interface PermissoesContextValue {
  hasPermission: (key: PermKey) => boolean;
  allUserPermissions: UserPermRecord[];
  getUserPermissions: (userId: string, role: string) => Record<PermKey, boolean>;
  saveUserPermissions: (userId: string, permissoes: Record<string, boolean>) => Promise<void>;
  resetUserPermissions: (userId: string) => Promise<void>;
  isLoading: boolean;
  reload: () => void;
}

const PermissoesContext = createContext<PermissoesContextValue | null>(null);

export function PermissoesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [myPermissoes, setMyPermissoes] = useState<Record<string, boolean>>({});
  const [allUserPermissions, setAllUserPermissions] = useState<UserPermRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    loadPermissions();
  }, [user?.id, tick]);

  async function loadPermissions() {
    if (!user) return;
    setIsLoading(true);
    try {
      const isSuperUser = user.role === 'ceo' || user.role === 'pca' || user.role === 'chefe_secretaria';
      const [myRes, allRes] = await Promise.all([
        fetch(`/api/user-permissions/${user.id}`),
        isSuperUser ? fetch('/api/user-permissions') : Promise.resolve(null),
      ]);
      const myData = await myRes.json();
      setMyPermissoes(myData.permissoes || {});
      if (allRes) {
        const allData = await allRes.json();
        setAllUserPermissions(Array.isArray(allData)
          ? allData.map((r: any) => ({ userId: r.user_id || r.userId, permissoes: r.permissoes || {} }))
          : []
        );
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  function hasPermission(key: PermKey): boolean {
    if (!user) return false;
    // CEO/PCA always have full access (they manage others, cannot self-restrict)
    if (user.role === 'ceo' || user.role === 'pca') return true;
    // Chefe de Secretaria parametrizes everything (except CEO dashboard)
    if (user.role === 'chefe_secretaria') return key !== 'ceo_dashboard';
    // If there's an explicit override stored for this user, use it
    if (Object.keys(myPermissoes).length > 0) {
      if (key in myPermissoes) return myPermissoes[key] === true;
    }
    // Fallback: role default
    return (ROLE_DEFAULTS[user.role] || []).includes(key as PermKey);
  }

  function getUserPermissions(userId: string, role: string): Record<PermKey, boolean> {
    const stored = allUserPermissions.find(p => p.userId === userId);
    const defaults = ROLE_DEFAULTS[role] || [];
    const result: Record<string, boolean> = {};
    ALL_KEYS.forEach(key => {
      if (stored && Object.keys(stored.permissoes).length > 0 && key in stored.permissoes) {
        result[key] = stored.permissoes[key] === true;
      } else {
        result[key] = defaults.includes(key);
      }
    });
    return result as Record<PermKey, boolean>;
  }

  async function saveUserPermissions(userId: string, permissoes: Record<string, boolean>) {
    await fetch(`/api/user-permissions/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissoes }),
    });
    reload();
  }

  async function resetUserPermissions(userId: string) {
    await fetch(`/api/user-permissions/${userId}`, { method: 'DELETE' });
    reload();
  }

  return (
    <PermissoesContext.Provider value={{
      hasPermission,
      allUserPermissions,
      getUserPermissions,
      saveUserPermissions,
      resetUserPermissions,
      isLoading,
      reload,
    }}>
      {children}
    </PermissoesContext.Provider>
  );
}

export function usePermissoes() {
  const ctx = useContext(PermissoesContext);
  if (!ctx) throw new Error('usePermissoes must be used within PermissoesProvider');
  return ctx;
}
