import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "./db";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is not set.");
const JWT_EXPIRES = "12h";

export type UserRole =
  | "ceo" | "pca" | "admin" | "director" | "chefe_secretaria"
  | "secretaria" | "professor" | "aluno" | "financeiro" | "encarregado" | "rh"
  | "pedagogico";

export interface JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      jwtUser?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["authorization"] ?? "";
  let token: string | null = header.startsWith("Bearer ") ? header.slice(7) : null;
  // Fallback: accept ?token= query param for PDF/iframe requests that can't set headers
  if (!token && typeof req.query.token === "string" && req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    res.status(401).json({ error: "Não autenticado. Faça login para continuar." });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
    return;
  }
  req.jwtUser = payload;
  next();
}

const ROLE_DEFAULTS: Record<string, string[]> = {
  ceo:              ["*"],
  pca:              ["*"],
  // chefe_secretaria: supervisão e coordenação total (excl. ceo_dashboard)
  chefe_secretaria: ["secretaria_hub","alunos","professores","turmas","notas","presencas",
                     "financeiro","financeiro_relatorios","extrato_propinas","bolsas",
                     "relatorios","chat_interno","horario","editor_documentos","documentos_hub",
                     "disciplinas","admissao","pedagogico","desempenho","visao_geral",
                     "rh_hub","rh_controle","rh_payroll","controlo_supervisao","gestao_acessos",
                     "auditoria","notificacoes","portal_encarregado","calendario_academico",
                     "transferencias","biblioteca","boletim_matricula","boletim_propina",
                     "quadro_honra","trabalhos_finais","exclusoes_faltas","plano_aula",
                     "eventos","gestao_academica","grelha","historico","salas","dashboard",
                     "avaliacao_professores","admin",
                     "professor_hub","professor_turmas","professor_pauta","professor_sumario",
                     "professor_mensagens","professor_materiais","portal_estudante","pagamentos_hub"],
  // admin: configuração técnica, gestão de utilizadores, auditoria — sem finanças nem RH operacional
  admin:            ["dashboard","alunos","professores","turmas","salas","notas","presencas",
                     "horario","historico","disciplinas","grelha","admissao","transferencias",
                     "gestao_academica","editor_documentos","boletim_matricula","documentos_hub",
                     "secretaria_hub","pedagogico","avaliacao_professores","desempenho",
                     "visao_geral","relatorios","quadro_honra","trabalhos_finais",
                     "exclusoes_faltas","biblioteca","eventos","plano_aula",
                     "notificacoes","chat_interno","calendario_academico","admin",
                     "gestao_acessos","controlo_supervisao","auditoria"],
  // director: supervisão estratégica — vê tudo, não opera finanças nem configura o sistema
  director:         ["dashboard","alunos","professores","turmas","salas","notas","presencas",
                     "horario","historico","disciplinas","grelha","admissao","transferencias",
                     "gestao_academica","pedagogico","avaliacao_professores","desempenho",
                     "visao_geral","relatorios","quadro_honra","trabalhos_finais","exclusoes_faltas",
                     "rh_hub","rh_controle","financeiro_relatorios","extrato_propinas",
                     "editor_documentos","boletim_matricula","boletim_propina","documentos_hub",
                     "controlo_supervisao","auditoria","biblioteca","eventos",
                     "notificacoes","chat_interno","calendario_academico"],
  // pedagogico: qualidade académica, currículo, avaliação pedagógica
  pedagogico:       ["dashboard","alunos","professores","turmas","salas","notas","presencas",
                     "horario","historico","disciplinas","grelha","gestao_academica",
                     "pedagogico","avaliacao_professores","desempenho","visao_geral","relatorios",
                     "quadro_honra","trabalhos_finais","exclusoes_faltas","plano_aula",
                     "biblioteca","notificacoes","chat_interno","eventos","calendario_academico"],
  // secretaria: operações académicas diárias — matrícula, documentos, transferências
  // NÃO tem gestão financeira (é do financeiro) nem configurações de sistema (é do admin)
  secretaria:       ["secretaria_hub","alunos","turmas","salas","notas","presencas",
                     "horario","historico","admissao","transferencias","gestao_academica",
                     "disciplinas","grelha",
                     "editor_documentos","boletim_matricula","boletim_propina","documentos_hub",
                     "extrato_propinas","biblioteca","quadro_honra","trabalhos_finais",
                     "notificacoes","chat_interno","eventos","calendario_academico"],
  // professor: actividade lectiva própria — lança notas, sumários e materiais das suas turmas
  professor:        ["notas","pautas","professor_hub","professor_turmas","professor_pauta","professor_sumario",
                     "professor_mensagens","professor_materiais","horario","plano_aula",
                     "trabalhos_finais","biblioteca","quadro_honra","notificacoes",
                     "chat_interno","eventos"],
  // financeiro: gestão financeira completa — propinas, pagamentos, bolsas, relatórios
  // NÃO acede a dados académicos nem de RH
  financeiro:       ["financeiro","boletim_propina","extrato_propinas","bolsas",
                     "pagamentos_hub","financeiro_relatorios","documentos_hub",
                     "notificacoes","chat_interno"],
  // rh: recursos humanos e processamento salarial
  // NÃO acede a sumários de aula (são registos lectivos do professor)
  rh:               ["rh_hub","rh_controle","rh_payroll","professores","horario",
                     "calendario_academico","notificacoes","chat_interno"],
  aluno:            ["portal_estudante","historico","horario","eventos","biblioteca",
                     "pagamentos_hub","quadro_honra","notificacoes"],
  encarregado:      ["portal_encarregado","pagamentos_hub","notificacoes"],
};

async function getUserPermissions(userId: string, role: UserRole): Promise<string[]> {
  if (role === "ceo" || role === "pca") return ["*"];
  try {
    const rows = await query<{ permissoes: Record<string, boolean> }>(
      `SELECT permissoes FROM public.user_permissions WHERE user_id=$1`, [userId]
    );
    if (rows[0]?.permissoes && typeof rows[0].permissoes === "object") {
      const custom = rows[0].permissoes as Record<string, boolean>;
      return Object.keys(custom).filter(k => custom[k] === true);
    }
  } catch { /* fallback to defaults */ }
  return ROLE_DEFAULTS[role] ?? [];
}

export function requirePermission(permKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.jwtUser) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }
    const { userId, role } = req.jwtUser;
    if (role === "ceo" || role === "pca") { next(); return; }
    const perms = await getUserPermissions(userId, role);
    if (perms.includes("*") || perms.includes(permKey)) {
      next();
    } else {
      res.status(403).json({
        error: `Acesso negado. Não tem permissão para '${permKey}'.`,
        permKey,
      });
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.jwtUser) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }
    if (!roles.includes(req.jwtUser.role)) {
      res.status(403).json({ error: "Acesso negado. Cargo insuficiente." });
      return;
    }
    next();
  };
}
