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
  | 'biblioteca';

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
      { key: 'dashboard', label: 'Dashboard Principal', desc: 'Visão geral da escola com estatísticas', roles: ['admin', 'director', 'ceo', 'pca'] },
      { key: 'ceo_dashboard', label: 'Dashboard CEO', desc: 'Painel executivo de alto nível', roles: ['ceo', 'pca'] },
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
      { key: 'alunos', label: 'Alunos', desc: 'Registo, matrícula e gestão de alunos', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'professores', label: 'Professores', desc: 'Gestão do corpo docente', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'turmas', label: 'Turmas', desc: 'Criação e gestão de turmas', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'salas', label: 'Salas de Aula', desc: 'Gestão e atribuição de salas', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'notas', label: 'Notas & Pautas', desc: 'Registo e consulta de notas', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'presencas', label: 'Presenças', desc: 'Controlo de assiduidade', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'horario', label: 'Horário', desc: 'Horários de aulas e turnos', roles: ['admin', 'director', 'secretaria', 'professor', 'aluno', 'ceo', 'pca'] },
      { key: 'historico', label: 'Histórico Académico', desc: 'Registo histórico de percurso', roles: ['admin', 'director', 'secretaria', 'aluno', 'ceo', 'pca'] },
      { key: 'grelha', label: 'Grelha Curricular', desc: 'Estrutura e plano curricular', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'gestao_academica', label: 'Gestão Académica (Hub)', desc: 'Hub geral de gestão académica', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'admissao', label: 'Admissões', desc: 'Processo de candidatura e admissão de novos alunos', roles: ['admin', 'director', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'disciplinas', label: 'Disciplinas', desc: 'Gestão e configuração das disciplinas e conteúdos programáticos', roles: ['admin', 'director', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
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
      { key: 'pedagogico', label: 'Área Pedagógica', desc: 'Gestão pedagógica: sumários, calendário de provas, solicitações e pautas', roles: ['admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Financeiro',
    icon: 'cash',
    features: [
      { key: 'financeiro', label: 'Gestão Financeira', desc: 'Propinas, pagamentos e rubricas', roles: ['admin', 'director', 'secretaria', 'financeiro', 'ceo', 'pca'] },
      { key: 'boletim_propina', label: 'Boletim de Propina', desc: 'Geração de recibos de propina', roles: ['secretaria', 'admin', 'director', 'financeiro', 'ceo', 'pca'] },
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
      { key: 'relatorios', label: 'Relatórios & Análise', desc: 'Gráficos e exportação de dados', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'rh_controle', label: 'Controlo de RH', desc: 'Gestão de recursos humanos', roles: ['admin', 'director', 'secretaria', 'ceo', 'pca'] },
      { key: 'desempenho', label: 'Análise de Desempenho', desc: 'Análise detalhada de notas e desempenho por turma e aluno', roles: ['admin', 'director', 'secretaria', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'visao_geral', label: 'Visão Geral Multi-Ano', desc: 'Comparação de indicadores académicos e financeiros entre anos lectivos', roles: ['admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'rh_hub', label: 'Hub de Recursos Humanos', desc: 'Centro de gestão de RH: professores, contratos, avaliações e presenças', roles: ['rh', 'admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Documentos',
    icon: 'newspaper',
    features: [
      { key: 'editor_documentos', label: 'Editor de Documentos', desc: 'Modelos e emissão de documentos', roles: ['secretaria', 'admin', 'director', 'ceo', 'pca'] },
      { key: 'boletim_matricula', label: 'Boletim de Matrícula', desc: 'Impressão de ficha de matrícula', roles: ['secretaria', 'admin', 'director', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Biblioteca Escolar',
    icon: 'library',
    features: [
      { key: 'biblioteca', label: 'Biblioteca Escolar', desc: 'Gestão de livros, empréstimos e devoluções', roles: ['admin', 'director', 'secretaria', 'chefe_secretaria', 'professor', 'aluno', 'ceo', 'pca'] },
    ],
  },
  {
    categoria: 'Administração',
    icon: 'shield-checkmark',
    features: [
      { key: 'admin', label: 'Super Administração', desc: 'Configurações avançadas do sistema', roles: ['admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
      { key: 'gestao_acessos', label: 'Gestão de Acessos', desc: 'Controlar permissões e acessos de utilizadores', roles: ['chefe_secretaria', 'ceo', 'pca'] },
      { key: 'controlo_supervisao', label: 'Controlo & Supervisão', desc: 'Painel de supervisão geral: utilizadores, secretaria, académico e financeiro', roles: ['admin', 'director', 'chefe_secretaria', 'ceo', 'pca'] },
    ],
  },
];

// ─── Permissões padrão por cargo ──────────────────────────────────────────────
const ALL_KEYS: PermKey[] = FEATURE_CATEGORIES.flatMap(c => c.features.map(f => f.key));

export const ROLE_DEFAULTS: Record<string, PermKey[]> = {
  ceo: [...ALL_KEYS],
  pca: [...ALL_KEYS],
  // Chefe de Secretaria: parametriza tudo excepto dashboard CEO
  chefe_secretaria: ALL_KEYS.filter(k => k !== 'ceo_dashboard'),
  admin: [
    'dashboard', 'eventos', 'notificacoes', 'alunos', 'professores', 'turmas', 'salas',
    'notas', 'presencas', 'horario', 'historico', 'grelha', 'financeiro', 'relatorios',
    'rh_controle', 'admin', 'boletim_matricula', 'boletim_propina', 'gestao_academica',
    'secretaria_hub', 'editor_documentos', 'gestao_acessos',
    'admissao', 'disciplinas', 'pedagogico', 'desempenho', 'visao_geral', 'rh_hub', 'controlo_supervisao',
    'biblioteca',
  ],
  director: [
    'dashboard', 'eventos', 'notificacoes', 'alunos', 'professores', 'turmas', 'salas',
    'notas', 'presencas', 'horario', 'historico', 'grelha', 'financeiro', 'relatorios',
    'rh_controle', 'admin', 'boletim_matricula', 'secretaria_hub', 'editor_documentos',
    'gestao_academica', 'gestao_acessos',
    'admissao', 'disciplinas', 'pedagogico', 'desempenho', 'visao_geral', 'rh_hub', 'controlo_supervisao',
    'biblioteca',
  ],
  secretaria: [
    'secretaria_hub', 'editor_documentos', 'notificacoes', 'alunos', 'professores', 'turmas',
    'salas', 'presencas', 'notas', 'horario', 'historico', 'eventos', 'grelha', 'relatorios',
    'rh_controle', 'financeiro', 'boletim_matricula', 'boletim_propina', 'gestao_academica',
    'admissao', 'disciplinas', 'desempenho', 'biblioteca',
  ],
  professor: [
    'professor_hub', 'notificacoes', 'professor_turmas', 'professor_pauta', 'horario',
    'professor_sumario', 'eventos', 'professor_mensagens', 'professor_materiais', 'biblioteca',
  ],
  aluno: ['portal_estudante', 'notificacoes', 'horario', 'historico', 'eventos', 'biblioteca'],
  financeiro: ['financeiro', 'notificacoes', 'boletim_propina'],
  encarregado: ['portal_encarregado', 'notificacoes'],
  rh: ['rh_hub', 'rh_controle', 'notificacoes'],
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
