import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "./db";

const JWT_SECRET = process.env.JWT_SECRET ?? "siga_v3_secret_2025_angola";
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
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
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
  chefe_secretaria: ["painel_secretaria","alunos","professores","turmas","notas","presencas",
                     "financeiro","relatorios","mensagens","horario","documentos","disciplinas",
                     "admissao","pedagogico","desempenho","visao_geral","rh_hub","rh_controle",
                     "controlo_supervisao","gestao_acessos","notificacoes","portal_encarregado"],
  admin:            ["painel_secretaria","alunos","professores","turmas","notas","presencas",
                     "financeiro","relatorios","mensagens","horario","documentos","disciplinas",
                     "admissao","pedagogico","desempenho","visao_geral","rh_hub","rh_controle",
                     "gestao_acessos","notificacoes"],
  director:         ["painel_secretaria","alunos","professores","turmas","notas","presencas",
                     "relatorios","mensagens","horario","documentos","disciplinas","pedagogico",
                     "desempenho","visao_geral","notificacoes"],
  pedagogico:       ["alunos","professores","turmas","notas","presencas","horario","historico",
                     "relatorios","mensagens","documentos","disciplinas","pedagogico",
                     "desempenho","visao_geral","notificacoes","avaliacao_professores",
                     "biblioteca","chat_interno","grelha","eventos"],
  secretaria:       ["painel_secretaria","alunos","professores","turmas","notas","presencas",
                     "financeiro","mensagens","horario","documentos","disciplinas","admissao",
                     "notificacoes"],
  professor:        ["hub_professor","turmas","pautas","sumarios","horario","mensagens",
                     "materiais","notificacoes","biblioteca"],
  financeiro:       ["financeiro","notificacoes"],
  rh:               ["rh_hub","rh_controle","notificacoes"],
  aluno:            ["portal_estudante","historico","horario","notificacoes"],
  encarregado:      ["portal_encarregado","notificacoes"],
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
