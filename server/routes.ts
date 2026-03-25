import type { Express } from "express";
import type { Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { query } from "./db";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { signToken, requireAuth, requirePermission, type UserRole } from "./auth";
import { sendPasswordResetEmail } from "./email";
import {
  notifyGuardianAboutNota,
  notifyGuardianAboutFalta,
  notifyGuardianAboutPropina,
} from "./notifications";
import { logAudit, setupAuditMiddleware } from "./audit";
import { registerMEDRoutes } from "./med";

type JsonObject = Record<string, unknown>;

function json(res: Response, statusCode: number, payload: unknown) {
  res.status(statusCode).json(payload);
}

function requireBodyObject(req: Request): JsonObject {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid JSON body (expected an object).");
  }
  return body as JsonObject;
}

function jsonbParam(value: unknown) {
  if (value === undefined) return null;
  if (value === null) return null;
  return JSON.stringify(value);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Audit middleware — intercepts all successful write operations automatically
  setupAuditMiddleware(app);

  // MED (Ministério da Educação) integration routes
  registerMEDRoutes(app);

  app.get("/api/health", (_req: Request, res: Response) => {
    json(res, 200, { ok: true });
  });

  // -----------------------
  // AUTENTICAÇÃO (LOGIN)
  // -----------------------
  const HARDCODED_ACCOUNTS: Array<{ email: string; senha: string; id: string; nome: string; role: UserRole; escola: string }> = [
    { email: "ceo@sige.ao",        senha: "Sige@2025",       id: "usr_ceo",            nome: "Administrador SIGE",           role: "ceo",       escola: "SIGE — Sistema Integral de Gestão Escolar" },
    { email: "financeiro@sige.ao", senha: "Financeiro@2025", id: "usr_financeiro_001", nome: "Gestor Financeiro",            role: "financeiro", escola: "SIGE — Sistema Integral de Gestão Escolar" },
    { email: "secretaria@sige.ao", senha: "Secretaria@2025", id: "usr_secretaria_001", nome: "Secretária Académica",         role: "secretaria", escola: "SIGE — Sistema Integral de Gestão Escolar" },
    { email: "rh@sige.ao",         senha: "RH@2025",         id: "usr_rh_001",         nome: "Gestor de Recursos Humanos",  role: "rh",        escola: "SIGE — Sistema Integral de Gestão Escolar" },
  ];

  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const email = String(b.email ?? "").toLowerCase().trim();
      const senha = String(b.senha ?? "").trim();
      if (!email || !senha) {
        return json(res, 400, { error: "Email e senha são obrigatórios." });
      }

      const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? req.socket?.remoteAddress;
      const ua = req.headers["user-agent"];

      // Verificar contas fixas primeiro
      const hardcoded = HARDCODED_ACCOUNTS.find(
        a => a.email.toLowerCase() === email && a.senha === senha
      );
      if (hardcoded) {
        const token = signToken({ userId: hardcoded.id, role: hardcoded.role, email: hardcoded.email });
        logAudit({
          userId: hardcoded.id, userEmail: hardcoded.email, userRole: hardcoded.role, userName: hardcoded.nome,
          acao: "login", modulo: "Autenticação", descricao: `Login bem-sucedido: ${hardcoded.email}`,
          ipAddress: ip, userAgent: ua,
        }).catch(() => {});
        return json(res, 200, {
          token,
          user: { id: hardcoded.id, nome: hardcoded.nome, email: hardcoded.email, role: hardcoded.role, escola: hardcoded.escola },
        });
      }

      // Verificar na base de dados
      const rows = await query<JsonObject>(
        `SELECT * FROM public.utilizadores WHERE LOWER(email)=LOWER($1) AND senha=$2 AND ativo=true LIMIT 1`,
        [email, senha]
      );
      if (!rows[0]) {
        logAudit({
          userId: "unknown", userEmail: email, userRole: "desconhecido",
          acao: "login_falhado", modulo: "Autenticação", descricao: `Tentativa de login falhada: ${email}`,
          ipAddress: ip, userAgent: ua,
        }).catch(() => {});
        return json(res, 401, { error: "Credenciais inválidas. Verifique o email e a senha." });
      }
      const u = rows[0];
      const token = signToken({ userId: String(u.id), role: String(u.role) as UserRole, email: String(u.email) });
      logAudit({
        userId: String(u.id), userEmail: String(u.email), userRole: String(u.role), userName: String(u.nome),
        acao: "login", modulo: "Autenticação", descricao: `Login bem-sucedido: ${u.email}`,
        ipAddress: ip, userAgent: ua,
      }).catch(() => {});
      return json(res, 200, {
        token,
        user: { id: u.id, nome: u.nome, email: u.email, role: u.role, escola: u.escola ?? "" },
      });
    } catch (e: unknown) {
      return json(res, 500, { error: String(e) });
    }
  });

  // -----------------------
  // FILE UPLOAD
  // -----------------------
  const uploadDir = path.resolve(process.cwd(), "public/uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });

  const upload = multer({ storage: diskStorage, limits: { fileSize: 5 * 1024 * 1024 } });

  app.post("/api/upload", upload.single("file"), (req: Request, res: Response) => {
    if (!req.file) {
      return json(res, 400, { error: "Nenhum ficheiro enviado." });
    }
    json(res, 200, { url: `/uploads/${req.file.filename}` });
  });

  // -----------------------
  // USERS
  // -----------------------
  app.get("/api/users", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.users ORDER BY id DESC`,
      [],
    );
    json(res, 200, rows);
  });

  // -----------------------
  // ALUNOS
  // -----------------------
  app.get("/api/alunos", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.alunos ORDER BY "createdAt" DESC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/alunos", requireAuth, requirePermission("alunos"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.alunos (
          id, "numeroMatricula", "nome", "apelido", "dataNascimento", "genero", "provincia", "municipio",
          "turmaId", "nomeEncarregado", "telefoneEncarregado", "emailEncarregado", "ativo", "foto", "createdAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
        ) RETURNING *`,
        [
          b.id,
          b.numeroMatricula,
          b.nome,
          b.apelido,
          b.dataNascimento,
          b.genero,
          b.provincia,
          b.municipio,
          b.turmaId,
          b.nomeEncarregado,
          b.telefoneEncarregado,
          b.emailEncarregado ?? null,
          b.ativo,
          b.foto ?? null,
          b.createdAt,
        ],
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/alunos/:id", requireAuth, requirePermission("alunos"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const allowed = [
        "numeroMatricula",
        "nome",
        "apelido",
        "dataNascimento",
        "genero",
        "provincia",
        "municipio",
        "turmaId",
        "nomeEncarregado",
        "telefoneEncarregado",
        "emailEncarregado",
        "ativo",
        "bloqueado",
        "foto",
        "createdAt",
      ] as const;

      const setParts: string[] = [];
      const values: unknown[] = [];

      for (const key of allowed) {
        const v = b[key as keyof typeof b];
        if (v === undefined) continue;
        values.push(v);
        setParts.push(`"${key}" = $${values.length}`);
      }

      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }

      const rows = await query<JsonObject>(
        `UPDATE public.alunos SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id],
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.delete("/api/alunos/:id", requireAuth, requirePermission("alunos"), async (req: Request, res: Response) => {
    const { id } = req.params;
    const rows = await query<JsonObject>(
      `DELETE FROM public.alunos WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // PROFESSORES
  // -----------------------
  app.get("/api/professores", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.professores ORDER BY "createdAt" DESC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/professores", requireAuth, requirePermission("professores"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.professores (
          id, "numeroProfessor", "nome", "apelido", "disciplinas", "turmasIds",
          "telefone", "email", "habilitacoes", "ativo", "createdAt"
        ) VALUES (
          $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11
        ) RETURNING *`,
        [
          b.id,
          b.numeroProfessor,
          b.nome,
          b.apelido,
          jsonbParam(b.disciplinas),
          jsonbParam(b.turmasIds),
          b.telefone,
          b.email,
          b.habilitacoes,
          b.ativo,
          b.createdAt,
        ],
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/professores/:id", requireAuth, requirePermission("professores"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const allowed = [
        "numeroProfessor",
        "nome",
        "apelido",
        "disciplinas",
        "turmasIds",
        "telefone",
        "email",
        "habilitacoes",
        "ativo",
        "createdAt",
        // Payroll fields
        "cargo",
        "categoria",
        "salarioBase",
        "subsidioAlimentacao",
        "subsidioTransporte",
        "subsidioHabitacao",
        "dataContratacao",
        "tipoContrato",
      ] as const;

      const jsonbKeys = new Set(["disciplinas", "turmasIds"]);
      const setParts: string[] = [];
      const values: unknown[] = [];

      for (const key of allowed) {
        const v = b[key as keyof typeof b];
        if (v === undefined) continue;
        values.push(
          jsonbKeys.has(key) ? jsonbParam(v) : (v as unknown),
        );
        const placeholder = `$${values.length}`;
        setParts.push(
          jsonbKeys.has(key) ? `"${key}" = ${placeholder}::jsonb` : `"${key}" = ${placeholder}`,
        );
      }

      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }

      const rows = await query<JsonObject>(
        `UPDATE public.professores SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id],
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.delete("/api/professores/:id", requireAuth, requirePermission("professores"), async (req: Request, res: Response) => {
    const { id } = req.params;
    const rows = await query<JsonObject>(
      `DELETE FROM public.professores WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // SALAS DE AULA
  // -----------------------
  app.get("/api/salas", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.salas ORDER BY nome ASC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/salas", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.salas (id, "nome", "bloco", "capacidade", "tipo", "ativo")
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [b.id, b.nome, b.bloco ?? '', b.capacidade ?? 30, b.tipo ?? 'Sala Normal', b.ativo ?? true],
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/salas/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["nome", "bloco", "capacidade", "tipo", "ativo"] as const;
      const setParts: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key as keyof typeof b];
        if (v === undefined) continue;
        values.push(v);
        setParts.push(`"${key}" = $${values.length}`);
      }
      if (setParts.length === 0) return json(res, 400, { error: "No fields to update." });
      const rows = await query<JsonObject>(
        `UPDATE public.salas SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id],
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.delete("/api/salas/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const rows = await query<JsonObject>(
      `DELETE FROM public.salas WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // TURMAS
  // -----------------------
  app.get("/api/turmas", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.turmas ORDER BY "anoLetivo" DESC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/turmas", requireAuth, requirePermission("turmas"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.turmas (
          id, "nome", "classe", "turno", "anoLetivo", "nivel",
          "professorId", "sala", "capacidade", "ativo", "cursoId"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        ) RETURNING *`,
        [
          b.id,
          b.nome,
          b.classe,
          b.turno,
          b.anoLetivo,
          b.nivel,
          b.professorId,
          b.sala,
          b.capacidade,
          b.ativo,
          b.cursoId ?? null,
        ],
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/turmas/:id", requireAuth, requirePermission("turmas"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const allowed = [
        "nome",
        "classe",
        "turno",
        "anoLetivo",
        "nivel",
        "professorId",
        "sala",
        "capacidade",
        "ativo",
        "cursoId",
      ] as const;

      const setParts: string[] = [];
      const values: unknown[] = [];

      for (const key of allowed) {
        const v = b[key as keyof typeof b];
        if (v === undefined) continue;
        values.push(v);
        setParts.push(`"${key}" = $${values.length}`);
      }

      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }

      const rows = await query<JsonObject>(
        `UPDATE public.turmas SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id],
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.delete("/api/turmas/:id", requireAuth, requirePermission("turmas"), async (req: Request, res: Response) => {
    const { id } = req.params;
    const rows = await query<JsonObject>(
      `DELETE FROM public.turmas WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // NOTAS
  // -----------------------
  app.get("/api/notas", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.notas ORDER BY "anoLetivo" DESC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/notas", requireAuth, requirePermission("pautas"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.notas (
          id, "alunoId", "turmaId", "disciplina", "trimestre",
          "aval1","aval2","aval3","aval4","aval5","aval6","aval7","aval8",
          "mac1","pp1","ppt","mt1","nf","mac",
          "anoLetivo","professorId","data","lancamentos"
        ) VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,$11,$12,$13,
          $14,$15,$16,$17,$18,$19,
          $20,$21,$22,$23::jsonb
        ) RETURNING *`,
        [
          b.id,
          b.alunoId,
          b.turmaId,
          b.disciplina,
          b.trimestre,
          b.aval1 ?? 0,
          b.aval2 ?? 0,
          b.aval3 ?? 0,
          b.aval4 ?? 0,
          b.aval5 ?? 0,
          b.aval6 ?? 0,
          b.aval7 ?? 0,
          b.aval8 ?? 0,
          b.mac1,
          b.pp1,
          b.ppt,
          b.mt1,
          b.nf,
          b.mac,
          b.anoLetivo,
          b.professorId,
          b.data,
          jsonbParam(b.lancamentos),
        ],
      );
      json(res, 201, rows[0]);
      // Notify guardian (non-blocking)
      if (b.alunoId && b.disciplina) {
        notifyGuardianAboutNota(
          String(b.alunoId),
          String(b.disciplina),
          b.nf !== undefined && b.nf !== null ? Number(b.nf) : null,
          String(b.trimestre ?? "")
        ).catch(() => {});
      }
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/notas/:id", requireAuth, requirePermission("pautas"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const allowed = [
        "alunoId",
        "turmaId",
        "disciplina",
        "trimestre",
        "aval1",
        "aval2",
        "aval3",
        "aval4",
        "aval5",
        "aval6",
        "aval7",
        "aval8",
        "mac1",
        "pp1",
        "ppt",
        "mt1",
        "nf",
        "mac",
        "anoLetivo",
        "professorId",
        "data",
        "lancamentos",
      ] as const;

      const jsonbKeys = new Set(["lancamentos"]);
      const setParts: string[] = [];
      const values: unknown[] = [];

      for (const key of allowed) {
        const v = b[key as keyof typeof b];
        if (v === undefined) continue;
        values.push(jsonbKeys.has(key) ? jsonbParam(v) : (v as unknown));
        const placeholder = `$${values.length}`;
        setParts.push(
          jsonbKeys.has(key)
            ? `"${key}" = ${placeholder}::jsonb`
            : `"${key}" = ${placeholder}`,
        );
      }

      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }

      const rows = await query<JsonObject>(
        `UPDATE public.notas SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id],
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.delete("/api/notas/:id", requireAuth, requirePermission("pautas"), async (req: Request, res: Response) => {
    const { id } = req.params;
    const rows = await query<JsonObject>(
      `DELETE FROM public.notas WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // PRESENCAS
  // -----------------------
  app.get("/api/presencas", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.presencas ORDER BY "data" DESC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/presencas", requireAuth, requirePermission("presencas"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.presencas (
          id,"alunoId","turmaId","disciplina","data","status","observacao"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7
        ) RETURNING *`,
        [
          b.id,
          b.alunoId,
          b.turmaId,
          b.disciplina,
          b.data,
          b.status,
          b.observacao ?? null,
        ],
      );
      json(res, 201, rows[0]);
      // Notify guardian on falta (non-blocking)
      if (b.alunoId && b.status === "falta" && b.disciplina && b.data) {
        notifyGuardianAboutFalta(
          String(b.alunoId),
          String(b.disciplina),
          String(b.data),
          String(b.status)
        ).catch(() => {});
      }
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/presencas/:id", requireAuth, requirePermission("presencas"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const allowed = [
        "alunoId",
        "turmaId",
        "disciplina",
        "data",
        "status",
        "observacao",
      ] as const;

      const setParts: string[] = [];
      const values: unknown[] = [];

      for (const key of allowed) {
        const v = b[key as keyof typeof b];
        if (v === undefined) continue;
        values.push(v);
        setParts.push(`"${key}" = $${values.length}`);
      }

      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }

      const rows = await query<JsonObject>(
        `UPDATE public.presencas SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id],
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.delete("/api/presencas/:id", requireAuth, requirePermission("presencas"), async (req: Request, res: Response) => {
    const { id } = req.params;
    const rows = await query<JsonObject>(
      `DELETE FROM public.presencas WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // EVENTOS
  // -----------------------
  app.get("/api/eventos", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.eventos ORDER BY "createdAt" DESC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/eventos", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.eventos (
          id, "titulo","descricao","data","hora","tipo","local","turmasIds","createdAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9
        ) RETURNING *`,
        [
          b.id,
          b.titulo,
          b.descricao ?? null,
          b.data,
          b.hora,
          b.tipo,
          b.local,
          jsonbParam(b.turmasIds),
          b.createdAt,
        ],
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/eventos/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const allowed = [
        "titulo",
        "descricao",
        "data",
        "hora",
        "tipo",
        "local",
        "turmasIds",
        "createdAt",
      ] as const;

      const jsonbKeys = new Set(["turmasIds"]);
      const setParts: string[] = [];
      const values: unknown[] = [];

      for (const key of allowed) {
        const v = b[key as keyof typeof b];
        if (v === undefined) continue;
        values.push(jsonbKeys.has(key) ? jsonbParam(v) : (v as unknown));
        const placeholder = `$${values.length}`;
        setParts.push(
          jsonbKeys.has(key)
            ? `"${key}" = ${placeholder}::jsonb`
            : `"${key}" = ${placeholder}`,
        );
      }

      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }

      const rows = await query<JsonObject>(
        `UPDATE public.eventos SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id],
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.delete("/api/eventos/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const rows = await query<JsonObject>(
      `DELETE FROM public.eventos WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // HORARIOS
  // -----------------------
  app.get("/api/horarios", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.horarios ORDER BY "diaSemana" ASC, "periodo" ASC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/horarios", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.horarios (
          id, "turmaId", "disciplina", "professorId", "professorNome",
          "diaSemana", "periodo", "horaInicio", "horaFim", "sala", "anoAcademico", "createdAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        ) RETURNING *`,
        [
          b.id,
          b.turmaId,
          b.disciplina,
          b.professorId ?? null,
          b.professorNome ?? '—',
          b.diaSemana,
          b.periodo,
          b.horaInicio,
          b.horaFim,
          b.sala ?? '',
          b.anoAcademico,
          b.createdAt ?? new Date().toISOString(),
        ],
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/horarios/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const allowed = [
        "turmaId",
        "disciplina",
        "professorId",
        "professorNome",
        "diaSemana",
        "periodo",
        "horaInicio",
        "horaFim",
        "sala",
        "anoAcademico",
      ] as const;

      const setParts: string[] = [];
      const values: unknown[] = [];

      for (const key of allowed) {
        const v = b[key as keyof typeof b];
        if (v === undefined) continue;
        values.push(v as unknown);
        setParts.push(`"${key}" = $${values.length}`);
      }

      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }

      const rows = await query<JsonObject>(
        `UPDATE public.horarios SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id],
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.delete("/api/horarios/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const rows = await query<JsonObject>(
      `DELETE FROM public.horarios WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // UTILIZADORES DO SISTEMA
  // -----------------------
  app.get("/api/utilizadores", requireAuth, async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.utilizadores ORDER BY "criadoEm" DESC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/utilizadores", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.utilizadores (id,"nome","email","senha","role","escola","ativo","alunoId","criadoEm")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [b.id ?? null, b.nome, b.email, b.senha, b.role, b.escola ?? '', b.ativo ?? true, b.alunoId ?? null, b.criadoEm ?? new Date().toISOString()],
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.get("/api/utilizadores/encarregado/:alunoId", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.utilizadores WHERE "alunoId"=$1 AND role='encarregado' LIMIT 1`,
      [req.params.alunoId],
    );
    if (!rows[0]) return json(res, 404, { error: "Encarregado não encontrado." });
    json(res, 200, rows[0]);
  });

  app.put("/api/utilizadores/:id", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["nome","email","senha","role","escola","ativo","alunoId"] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}" = $${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.utilizadores SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/utilizadores/:id", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.utilizadores WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // ANOS ACADÉMICOS
  // -----------------------
  app.get("/api/anos-academicos", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.anos_academicos ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/anos-academicos", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.anos_academicos (id,"ano","dataInicio","dataFim","ativo","trimestres")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
        [b.id ?? null, b.ano, b.dataInicio, b.dataFim, b.ativo ?? false, jsonbParam(b.trimestres) ?? '[]'],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/anos-academicos/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["ano","dataInicio","dataFim","ativo","trimestres"] as const;
      const jsonbKeys = new Set(["trimestres"]);
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(jsonbKeys.has(key) ? jsonbParam(v) : v);
        const ph = `$${values.length}`;
        setParts.push(jsonbKeys.has(key) ? `"${key}"=${ph}::jsonb` : `"${key}"=${ph}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.anos_academicos SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/anos-academicos/:id", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.anos_academicos WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  app.post("/api/anos-academicos/:id/transicao", async (req: Request, res: Response) => {
    try {
      const { id: toAnoId } = req.params;
      const { fromAnoId } = requireBodyObject(req) as { fromAnoId: string };

      if (!fromAnoId) return json(res, 400, { error: "fromAnoId é obrigatório." });
      if (fromAnoId === toAnoId) return json(res, 400, { error: "Ano origem e destino não podem ser iguais." });

      const [anoFrom, anoTo] = await Promise.all([
        query<JsonObject>(`SELECT * FROM public.anos_academicos WHERE id=$1`, [fromAnoId]),
        query<JsonObject>(`SELECT * FROM public.anos_academicos WHERE id=$1`, [toAnoId]),
      ]);

      if (!anoFrom[0]) return json(res, 404, { error: "Ano de origem não encontrado." });
      if (!anoTo[0]) return json(res, 404, { error: "Ano de destino não encontrado." });

      const turmasOrigem = await query<JsonObject>(
        `SELECT * FROM public.turmas WHERE "anoLetivo"=$1`,
        [anoFrom[0].ano as string]
      );

      if (turmasOrigem.length === 0) {
        return json(res, 200, { turmasCriadas: 0, anoDestino: anoTo[0].ano, mensagem: "Nenhuma turma encontrada no ano de origem." });
      }

      const anoDestinoStr = anoTo[0].ano as string;
      let turmasCriadas = 0;

      for (const turma of turmasOrigem) {
        const existente = await query<JsonObject>(
          `SELECT id FROM public.turmas WHERE nome=$1 AND "anoLetivo"=$2`,
          [turma.nome, anoDestinoStr]
        );
        if (existente.length > 0) continue;

        await query<JsonObject>(
          `INSERT INTO public.turmas (id, nome, classe, turno, "anoLetivo", nivel, "professorId", sala, capacidade, ativo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            Date.now().toString() + Math.random().toString(36).slice(2, 7),
            turma.nome,
            turma.classe,
            turma.turno,
            anoDestinoStr,
            turma.nivel,
            turma.professorId,
            turma.sala,
            turma.capacidade,
            true,
          ]
        );
        turmasCriadas++;
      }

      json(res, 200, {
        turmasCriadas,
        anoDestino: anoDestinoStr,
        anoOrigem: anoFrom[0].ano,
        mensagem: `${turmasCriadas} turma(s) criada(s) com sucesso para ${anoDestinoStr}.`,
      });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  // -----------------------
  // PAUTAS
  // -----------------------
  app.get("/api/pautas", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.pautas ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/pautas", requireAuth, requirePermission("pautas"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.pautas (id,"turmaId","disciplina","trimestre","professorId","status","anoLetivo","dataFecho")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [b.id ?? null, b.turmaId, b.disciplina, b.trimestre, b.professorId, b.status ?? 'aberta', b.anoLetivo, b.dataFecho ?? null],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/pautas/:id", requireAuth, requirePermission("pautas"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["turmaId","disciplina","trimestre","professorId","status","anoLetivo","dataFecho"] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.pautas SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/pautas/:id", requireAuth, requirePermission("pautas"), async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.pautas WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // SOLICITAÇÕES DE ABERTURA
  // -----------------------
  app.get("/api/solicitacoes-abertura", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.solicitacoes_abertura ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/solicitacoes-abertura", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.solicitacoes_abertura (id,"pautaId","turmaId","turmaNome","disciplina","trimestre","professorId","professorNome","motivo","status","respondidoEm","observacao")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [b.id??null,b.pautaId,b.turmaId,b.turmaNome,b.disciplina,b.trimestre,b.professorId,b.professorNome,b.motivo,b.status??'pendente',b.respondidoEm??null,b.observacao??null],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/solicitacoes-abertura/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["status","respondidoEm","observacao"] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.solicitacoes_abertura SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // -----------------------
  // MENSAGENS (PROFESSOR / TURMA / ALUNO)
  // -----------------------
  app.get("/api/mensagens", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.mensagens ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/mensagens", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.mensagens (id,"remetenteId","remetenteNome","tipo","turmaId","turmaNome","destinatarioId","destinatarioNome","destinatarioTipo","assunto","corpo","lidaPor")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING *`,
        [b.id??null,b.remetenteId,b.remetenteNome,b.tipo,b.turmaId??null,b.turmaNome??null,b.destinatarioId??null,b.destinatarioNome??null,b.destinatarioTipo??null,b.assunto,b.corpo,jsonbParam(b.lidaPor)??'[]'],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/mensagens/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["lidaPor"] as const;
      const jsonbKeys = new Set(["lidaPor"]);
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(jsonbKeys.has(key) ? jsonbParam(v) : v);
        const ph = `$${values.length}`;
        setParts.push(jsonbKeys.has(key) ? `"${key}"=${ph}::jsonb` : `"${key}"=${ph}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.mensagens SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // -----------------------
  // MATERIAIS DIDÁCTICOS
  // -----------------------
  app.get("/api/materiais", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.materiais ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/materiais", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.materiais (id,"professorId","turmaId","turmaNome","disciplina","titulo","descricao","tipo","conteudo","nomeArquivo","tamanhoArquivo")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [b.id??null,b.professorId,b.turmaId,b.turmaNome,b.disciplina,b.titulo,b.descricao??'',b.tipo,b.conteudo,b.nomeArquivo??null,b.tamanhoArquivo??null],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/materiais/:id", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.materiais WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // SUMÁRIOS
  // -----------------------
  app.get("/api/sumarios", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.sumarios ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/sumarios", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.sumarios (id,"professorId","professorNome","turmaId","turmaNome","disciplina","data","horaInicio","horaFim","numeroAula","conteudo","status","observacaoRH")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [b.id??null,b.professorId,b.professorNome,b.turmaId,b.turmaNome,b.disciplina,b.data,b.horaInicio,b.horaFim,b.numeroAula,b.conteudo,b.status??'pendente',b.observacaoRH??null],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/sumarios/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["status","observacaoRH","conteudo","data","horaInicio","horaFim","numeroAula"] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.sumarios SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/sumarios/:id", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.sumarios WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // CALENDÁRIO DE PROVAS
  // -----------------------
  app.get("/api/calendario-provas", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.calendario_provas ORDER BY "data" ASC`, []);
    json(res, 200, rows);
  });

  app.post("/api/calendario-provas", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.calendario_provas (id,"titulo","descricao","turmasIds","disciplina","data","hora","tipo","publicado")
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9) RETURNING *`,
        [b.id??null,b.titulo,b.descricao??'',jsonbParam(b.turmasIds)??'[]',b.disciplina,b.data,b.hora,b.tipo,b.publicado??false],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/calendario-provas/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["titulo","descricao","turmasIds","disciplina","data","hora","tipo","publicado"] as const;
      const jsonbKeys = new Set(["turmasIds"]);
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(jsonbKeys.has(key) ? jsonbParam(v) : v);
        const ph = `$${values.length}`;
        setParts.push(jsonbKeys.has(key) ? `"${key}"=${ph}::jsonb` : `"${key}"=${ph}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.calendario_provas SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/calendario-provas/:id", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.calendario_provas WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // TAXAS
  // -----------------------
  app.get("/api/taxas", requireAuth, requirePermission("financeiro"), async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.taxas ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/taxas", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.taxas (id,"tipo","descricao","valor","frequencia","nivel","anoAcademico","ativo")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [b.id??null,b.tipo,b.descricao,b.valor,b.frequencia,b.nivel,b.anoAcademico,b.ativo??true],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/taxas/:id", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["tipo","descricao","valor","frequencia","nivel","anoAcademico","ativo"] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.taxas SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/taxas/:id", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.taxas WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // PAGAMENTOS
  // -----------------------
  app.get("/api/pagamentos", requireAuth, requirePermission("financeiro"), async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.pagamentos ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/pagamentos", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const status = String(b.status ?? "pendente");
      const rows = await query<JsonObject>(
        `INSERT INTO public.pagamentos (id,"alunoId","taxaId","valor","data","mes","trimestre","ano","status","metodoPagamento","referencia","observacao")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [b.id??null,b.alunoId,b.taxaId,b.valor,b.data,b.mes??null,b.trimestre??null,b.ano,status,b.metodoPagamento,b.referencia??null,b.observacao??null],
      );
      json(res, 201, rows[0]);
      // Notify guardian about payment status (non-blocking)
      if (b.alunoId && b.mes) {
        notifyGuardianAboutPropina(
          String(b.alunoId),
          String(b.mes),
          Number(b.valor ?? 0),
          status
        ).catch(() => {});
      }
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/pagamentos/:id", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["status","metodoPagamento","referencia","observacao","valor","data"] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.pagamentos SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/pagamentos/:id", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.pagamentos WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // MENSAGENS FINANCEIRAS
  // -----------------------
  app.get("/api/mensagens-financeiras", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.mensagens_financeiras ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/mensagens-financeiras", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.mensagens_financeiras (id,"alunoId","remetente","texto","data","lida","tipo")
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [b.id??null,b.alunoId,b.remetente,b.texto,b.data,b.lida??false,b.tipo??'geral'],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/mensagens-financeiras/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["lida","texto"] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.mensagens_financeiras SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // -----------------------
  // CHAT INTERNO
  // -----------------------
  app.get("/api/chat-interno", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return json(res, 401, { error: "Não autenticado." });
      const rows = await query<JsonObject>(
        `SELECT * FROM public.chat_mensagens
         WHERE "remetenteId"=$1 OR "destinatarioId"=$1
         ORDER BY "createdAt" ASC`,
        [userId],
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/chat-interno", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return json(res, 401, { error: "Não autenticado." });
      const b = requireBodyObject(req);
      if (!b.destinatarioId || !b.corpo || String(b.corpo).trim() === "") {
        return json(res, 400, { error: "Destinatário e corpo são obrigatórios." });
      }
      const rows = await query<JsonObject>(
        `INSERT INTO public.chat_mensagens
           (id,"remetenteId","remetenteNome","remetenteRole","destinatarioId","destinatarioNome","destinatarioRole","corpo","lida")
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,false) RETURNING *`,
        [
          userId,
          String(b.remetenteNome ?? ""),
          String(b.remetenteRole ?? ""),
          String(b.destinatarioId),
          String(b.destinatarioNome ?? ""),
          String(b.destinatarioRole ?? ""),
          String(b.corpo).trim(),
        ],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/chat-interno/:id/ler", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) return json(res, 401, { error: "Não autenticado." });
      const rows = await query<JsonObject>(
        `UPDATE public.chat_mensagens SET lida=true
         WHERE id=$1 AND "destinatarioId"=$2 RETURNING *`,
        [id, userId],
      );
      if (!rows[0]) return json(res, 404, { error: "Mensagem não encontrada." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.get("/api/chat-interno/unread-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return json(res, 401, { error: "Não autenticado." });
      const rows = await query<JsonObject>(
        `SELECT COUNT(*) as count FROM public.chat_mensagens
         WHERE "destinatarioId"=$1 AND lida=false`,
        [userId],
      );
      json(res, 200, { count: Number((rows[0] as any)?.count ?? 0) });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // RUPES
  // -----------------------
  app.get("/api/rupes", requireAuth, requirePermission("financeiro"), async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.rupes ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/rupes", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.rupes (id,"alunoId","taxaId","valor","referencia","dataGeracao","dataValidade","status")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [b.id??null,b.alunoId,b.taxaId,b.valor,b.referencia,b.dataGeracao,b.dataValidade,b.status??'ativo'],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/rupes/:id", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["status"] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.rupes SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // -----------------------
  // NOTIFICAÇÕES
  // -----------------------
  app.get("/api/notificacoes", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.notificacoes ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/notificacoes", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.notificacoes (id,"titulo","mensagem","tipo","data","lida","link")
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [b.id??null,b.titulo,b.mensagem,b.tipo??'info',b.data,b.lida??false,b.link??null],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/notificacoes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["lida"] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.notificacoes SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/notificacoes/:id", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.notificacoes WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  app.delete("/api/notificacoes", async (_req: Request, res: Response) => {
    await query(`DELETE FROM public.notificacoes`, []);
    json(res, 200, { ok: true });
  });

  // -----------------------
  // PUSH SUBSCRIPTIONS (Web Push VAPID)
  // -----------------------
  app.get("/api/push/vapid-key", (_req: Request, res: Response) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
    if (!publicKey) return json(res, 503, { error: "Push notifications not configured." });
    json(res, 200, { publicKey });
  });

  app.post("/api/push/subscribe", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const sub = b.subscription as { endpoint: string; keys: { p256dh: string; auth: string } } | undefined;
      const utilizadorId = String(b.utilizadorId ?? "");
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || !utilizadorId) {
        return json(res, 400, { error: "Dados da subscrição inválidos." });
      }
      await query(
        `INSERT INTO public.push_subscriptions (id,"utilizadorId",endpoint,p256dh,auth,"userAgent")
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5)
         ON CONFLICT (endpoint) DO UPDATE SET "utilizadorId"=$1, p256dh=$3, auth=$4, "userAgent"=$5`,
        [utilizadorId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, String(b.userAgent ?? "")]
      );
      json(res, 201, { ok: true });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/push/unsubscribe", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const endpoint = String(b.endpoint ?? "");
      if (!endpoint) return json(res, 400, { error: "endpoint obrigatório." });
      await query(`DELETE FROM public.push_subscriptions WHERE endpoint=$1`, [endpoint]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.get("/api/push/status/:utilizadorId", requireAuth, async (req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT id, endpoint, "criadoEm" FROM public.push_subscriptions WHERE "utilizadorId"=$1`,
        [req.params.utilizadorId]
      );
      json(res, 200, { subscriptions: rows.length, active: rows.length > 0 });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // -----------------------
  // REGISTROS (SOLICITAÇÕES DE MATRÍCULA)
  // -----------------------
  function gerarSenhaProvisoria(nomeCompleto: string, dataNascimento: string): string {
    const partes = nomeCompleto.trim().split(/\s+/);
    const apelido = partes[partes.length - 1] || partes[0] || 'Aluno';
    const ano = (dataNascimento || '2000').substring(0, 4);
    const anoInvertido = ano.split('').reverse().join('');
    return apelido + anoInvertido;
  }

  function gerarReferenciaRUPE(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const seq = String(now.getTime()).slice(-5);
    const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
    return `RUPE-${yyyy}-${mm}-${seq}-${rand}`;
  }

  app.get("/api/registros", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.registros ORDER BY "criadoEm" DESC`, []);
    json(res, 200, rows);
  });

  app.get("/api/registros/:id", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.registros WHERE id=$1`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  app.post("/api/login-provisorio", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { email, senha } = b as { email: string; senha: string };
      if (!email || !senha) return json(res, 400, { error: "Email e senha são obrigatórios." });
      const rows = await query<JsonObject>(
        `SELECT * FROM public.registros WHERE LOWER(email)=LOWER($1) AND "senhaProvisoria"=$2`,
        [email.trim(), senha.trim()]
      );
      if (!rows[0]) return json(res, 401, { error: "Credenciais inválidas. Verifique o email e a senha provisória." });
      const reg = rows[0] as any;
      if (reg.status === 'pendente') return json(res, 403, { error: "A sua inscrição ainda está em análise pela secretaria." });
      if (reg.status === 'rejeitado') return json(res, 403, { error: "A sua inscrição foi rejeitada." });
      if (reg.status === 'reprovado_admissao') return json(res, 403, { error: "Não foi admitido(a) neste processo. A conta provisória foi encerrada." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.post("/api/registros", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const senha = gerarSenhaProvisoria(String(b.nomeCompleto||''), String(b.dataNascimento||''));
      const rows = await query<JsonObject>(
        `INSERT INTO public.registros (
          "nomeCompleto","dataNascimento","genero","provincia","municipio",
          "telefone","email","endereco","bairro","numeroBi","numeroCedula",
          "nivel","classe","nomeEncarregado","telefoneEncarregado","observacoes",
          "status","senhaProvisoria"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [
          b.nomeCompleto, b.dataNascimento, b.genero, b.provincia, b.municipio,
          b.telefone??'', b.email??'', b.endereco??'', b.bairro??'', b.numeroBi??'', b.numeroCedula??'',
          b.nivel, b.classe, b.nomeEncarregado, b.telefoneEncarregado, b.observacoes??'',
          b.status??'pendente', senha
        ],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/registros/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = [
        "status","avaliadoEm","avaliadoPor","motivoRejeicao",
        "dataProva","notaAdmissao","resultadoAdmissao","matriculaCompleta",
        "rupeInscricao","rupeMatricula"
      ] as const;
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(v); setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      const rows = await query<JsonObject>(`UPDATE public.registros SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, id]);
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/registros/:id/publicar-data-prova", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { dataProva } = b as { dataProva: string };
      if (!dataProva) return json(res, 400, { error: "dataProva é obrigatória." });
      const rows = await query<JsonObject>(
        `UPDATE public.registros SET "dataProva"=$1 WHERE id=$2 RETURNING *`,
        [dataProva, req.params.id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/registros/:id/lancar-nota", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const nota = Number(b.notaAdmissao);
      if (isNaN(nota) || nota < 0 || nota > 20) return json(res, 400, { error: "Nota inválida (0–20)." });
      const resultado = nota >= 10 ? 'aprovado' : 'reprovado';
      const novoStatus = nota >= 10 ? 'admitido' : 'reprovado_admissao';
      const rows = await query<JsonObject>(
        `UPDATE public.registros SET "notaAdmissao"=$1,"resultadoAdmissao"=$2,"status"=$3 WHERE id=$4 RETURNING *`,
        [nota, resultado, novoStatus, req.params.id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.post("/api/registros/:id/gerar-rupe", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const tipo = String(b.tipo || 'inscricao'); // 'inscricao' | 'matricula'
      const valor = Number(b.valor || 0);
      const referencia = gerarReferenciaRUPE();
      const field = tipo === 'matricula' ? 'rupeMatricula' : 'rupeInscricao';
      const rows = await query<JsonObject>(
        `UPDATE public.registros SET "${field}"=$1 WHERE id=$2 RETURNING *`,
        [referencia, req.params.id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, { referencia, valor, validade: new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0], registro: rows[0] });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.post("/api/registros/:id/completar-matricula", async (req: Request, res: Response) => {
    try {
      const regRows = await query<JsonObject>(`SELECT * FROM public.registros WHERE id=$1`, [req.params.id]);
      if (!regRows[0]) return json(res, 404, { error: "Inscrição não encontrada." });
      const reg = regRows[0] as any;
      if (reg.status !== 'admitido') return json(res, 400, { error: "Apenas estudantes admitidos podem completar a matrícula." });

      // Find matching turma
      const turmas = await query<JsonObject>(
        `SELECT id FROM public.turmas WHERE nome ILIKE $1 LIMIT 1`,
        [`%${reg.classe}%`]
      );
      const turmaId = (turmas[0] as any)?.id || '';

      // Parse name
      const partes = String(reg.nomeCompleto || '').trim().split(/\s+/);
      const nome = partes[0] || '';
      const apelido = partes.slice(1).join(' ') || nome;

      // Generate matricula number
      const ano = new Date().getFullYear();
      const rand = Math.random().toString(36).toUpperCase().slice(2, 7);
      const numeroMatricula = `MAT-${ano}-${rand}`;

      // Create aluno record
      const alunoRows = await query<JsonObject>(
        `INSERT INTO public.alunos (
          id,"numeroMatricula","nome","apelido","dataNascimento","genero",
          "provincia","municipio","turmaId","nomeEncarregado","telefoneEncarregado",
          "emailEncarregado","ativo","bloqueado"
        ) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,false) RETURNING *`,
        [numeroMatricula, nome, apelido, reg.dataNascimento, reg.genero,
         reg.provincia, reg.municipio, turmaId,
         reg.nomeEncarregado, reg.telefoneEncarregado, reg.email||'']
      );
      const aluno = alunoRows[0] as any;

      // Create utilizador for aluno (official account)
      if (reg.email) {
        await query(
          `INSERT INTO public.utilizadores (id,nome,email,senha,role,"alunoId","ativo")
           VALUES (gen_random_uuid(),$1,$2,$3,'aluno',$4,true)
           ON CONFLICT (email) DO NOTHING`,
          [reg.nomeCompleto, reg.email, reg.senhaProvisoria, aluno.id]
        ).catch(() => {}); // ignore if utilizadores doesn't have these exact columns
      }

      // Mark registration as complete
      await query(
        `UPDATE public.registros SET "status"='matriculado',"matriculaCompleta"=true WHERE id=$1`,
        [reg.id]
      );

      json(res, 200, { success: true, aluno, numeroMatricula });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/registros/:id", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.registros WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // PERMISSÕES DE UTILIZADORES
  // -----------------------
  app.get("/api/user-permissions", requireAuth, requirePermission("gestao_acessos"), async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.user_permissions`, []);
    json(res, 200, rows);
  });

  app.get("/api/user-permissions/:userId", requireAuth, async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.user_permissions WHERE user_id=$1`, [req.params.userId]);
    if (!rows[0]) return json(res, 200, { userId: req.params.userId, permissoes: {} });
    json(res, 200, rows[0]);
  });

  app.put("/api/user-permissions/:userId", requireAuth, requirePermission("gestao_acessos"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const permissoes = b.permissoes ?? {};
      const rows = await query<JsonObject>(
        `INSERT INTO public.user_permissions (user_id, permissoes, atualizado_em)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET permissoes=$2::jsonb, atualizado_em=NOW()
         RETURNING *`,
        [req.params.userId, jsonbParam(permissoes)],
      );
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/user-permissions/:userId", requireAuth, requirePermission("gestao_acessos"), async (req: Request, res: Response) => {
    await query(`DELETE FROM public.user_permissions WHERE user_id=$1`, [req.params.userId]);
    json(res, 200, { ok: true });
  });

  // -----------------------
  // CONFIGURAÇÕES
  // -----------------------

  // Public endpoint — no auth required (used by login screen)
  app.get("/api/public/inscricoes-status", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT "inscricoesAbertas" FROM public.config_geral LIMIT 1`, []);
    const abertas = rows[0] ? Boolean(rows[0].inscricoesAbertas) : false;
    json(res, 200, { abertas });
  });

  app.get("/api/config", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.config_geral LIMIT 1`, []);
    let config = rows[0];
    if (!config) {
      const created = await query<JsonObject>(
        `INSERT INTO public.config_geral DEFAULT VALUES RETURNING *`, [],
      );
      config = created[0];
    }
    // Auto-inicializar datas de licença na primeira vez (nunca muda depois)
    if (!config.licencaAtivacao) {
      const hoje = new Date().toISOString().split('T')[0];
      const expiracao = new Date();
      expiracao.setDate(expiracao.getDate() + 30);
      const dataExpiracao = expiracao.toISOString().split('T')[0];
      const updated = await query<JsonObject>(
        `UPDATE public.config_geral SET "licencaAtivacao"=$1, "licencaExpiracao"=$2, "licencaPlano"=$3 WHERE id=$4 RETURNING *`,
        [hoje, dataExpiracao, 'avaliacao', config.id],
      );
      config = updated[0];
    }
    json(res, 200, config);
  });

  app.put("/api/config", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const allowed = ["nomeEscola","logoUrl","pp1Habilitado","pptHabilitado","notaMinimaAprovacao","maxAlunosTurma","numAvaliacoes","macMin","macMax","horarioFuncionamento","flashScreen","multaConfig","inscricoesAbertas","propinaHabilitada","numeroEntidade","iban","nomeBeneficiario","bancoTransferencia","telefoneMulticaixaExpress","nib","directorGeral","directorPedagogico","directorProvincialEducacao","codigoMED","nifEscola","provinciaEscola","municipioEscola","tipoEnsino","modalidade","inssEmpPerc","inssPatrPerc","irtTabela","mesesAnoAcademico"] as const;
      const jsonbKeys = new Set(["flashScreen","multaConfig","irtTabela","mesesAnoAcademico"]);
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        values.push(jsonbKeys.has(key) ? jsonbParam(v) : v);
        const ph = `$${values.length}`;
        setParts.push(jsonbKeys.has(key) ? `"${key}"=${ph}::jsonb` : `"${key}"=${ph}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      // Upsert: update existing row or insert if none
      const existing = await query<JsonObject>(`SELECT id FROM public.config_geral LIMIT 1`, []);
      let rows;
      if (existing[0]) {
        rows = await query<JsonObject>(`UPDATE public.config_geral SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, existing[0].id]);
      } else {
        rows = await query<JsonObject>(`INSERT INTO public.config_geral DEFAULT VALUES RETURNING *`, []);
        if (setParts.length) {
          rows = await query<JsonObject>(`UPDATE public.config_geral SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values, rows[0].id]);
        }
      }
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // -----------------------
  // PROVÍNCIAS & MUNICÍPIOS
  // -----------------------

  const ANGOLA_GEO: Record<string, string[]> = {
    'Luanda': ['Luanda', 'Belas', 'Cacuaco', 'Cazenga', 'Icolo e Bengo', 'Kilamba Kiaxi', 'Quiçama', 'Sambizanga', 'Viana'],
    'Benguela': ['Benguela', 'Baía Farta', 'Balombo', 'Bocoio', 'Caimbambo', 'Chongoroi', 'Cubal', 'Ganda', 'Lobito', 'Longonjo'],
    'Huambo': ['Huambo', 'Bailundo', 'Caála', 'Catchiungo', 'Chinjenje', 'Ecunha', 'Londuimbali', 'Longonjo', 'Mungo', 'Ukuma', 'Chicala-Cholohanga'],
    'Bié': ['Kuito', 'Andulo', 'Camacupa', 'Catabola', 'Chitembo', 'Cuemba', 'Cunhinga', 'Nharea'],
    'Uíge': ['Uíge', 'Alto Cauale', 'Ambuíla', 'Bembe', 'Bungo', 'Buza', 'Damba', 'Maquela do Zombo', 'Negage', 'Puri', 'Quitexe', 'Sanza Pombo', 'Songo', 'Yumbi'],
    'Malanje': ['Malanje', 'Cacuso', 'Calandula', 'Cambundi-Catembo', 'Cangandala', 'Caombo', 'Cuaba Nzoji', 'Cunda-dia-Baza', 'Luquembo', 'Marimba', 'Massango', 'Mucari', 'Quela', 'Quirima'],
    'Moxico': ['Luena', 'Alto Zambeze', 'Bundas', 'Camanongue', 'Léua', 'Luacano', 'Luchazes', 'Lucusse', 'Lumeje'],
    'Cuando Cubango': ['Menongue', 'Calai', 'Cuangar', 'Cuchi', 'Dirico', 'Kavango', 'Longa', 'Mavinga', 'Nancova', 'Rivungo'],
    'Cunene': ['Ondjiva', 'Cahama', 'Cuanhama', 'Cuvelai', 'Namacunde', 'Ombadja'],
    'Namibe': ['Moçâmedes', 'Bibala', 'Camucuio', 'Tômbwa', 'Virei'],
    'Huíla': ['Lubango', 'Caconda', 'Cacula', 'Caluquembe', 'Chiange', 'Chibia', 'Chicomba', 'Chipindo', 'Cuvango', 'Gambos', 'Humpata', 'Jamba', 'Matala', 'Quilengues', 'Quipungo'],
    'Kuanza Norte': ["N'dalatando", 'Alto Dande', 'Ambaca', 'Banga', 'Bolongongo', 'Cambambe', 'Cazengo', 'Golungo Alto', 'Gonguembo', 'Lucala', 'Ngonguembo', 'Quiculungo', 'Samba Caju'],
    'Kuanza Sul': ['Sumbe', 'Amboim', 'Cassongue', 'Cela', 'Conda', 'Ebo', 'Kibala', 'Mussende', 'Porto Amboim', 'Quibala', 'Quilenda', 'Seles', 'Waku Kungo'],
    'Lunda Norte': ['Dundo', 'Cambulo', 'Capenda-Camulemba', 'Caungula', 'Chitato', 'Cuango', 'Cuilo', 'Lubalo', 'Lucapa', 'Xá-Muteba'],
    'Lunda Sul': ['Saurimo', 'Cacolo', 'Dala', 'Muconda'],
    'Zaire': ["M'banza Kongo", 'Cuimba', 'Nóqui', 'Nzeto', 'Soyo', 'Tomboco'],
    'Cabinda': ['Cabinda', 'Belize', 'Buco-Zau', 'Cacongo'],
    'Bengo': ['Caxito', 'Ambriz', 'Bula Atumba', 'Dande', 'Dembos', 'Nambuangongo', 'Pango Aluquém'],
  };

  async function seedGeoData() {
    try {
      const existing = await query<JsonObject>(`SELECT COUNT(*) as count FROM public.provincias`, []);
      const count = parseInt(String((existing[0] as any).count), 10);
      if (count > 0) return;

      console.log('[seed] A popular províncias e municípios...');
      for (const [nomeProv, municipiosArr] of Object.entries(ANGOLA_GEO)) {
        const provRows = await query<JsonObject>(
          `INSERT INTO public.provincias (nome) VALUES ($1) ON CONFLICT (nome) DO UPDATE SET nome=EXCLUDED.nome RETURNING id`,
          [nomeProv]
        );
        const provId = (provRows[0] as any).id;
        for (const nomeMun of municipiosArr) {
          await query(
            `INSERT INTO public.municipios (nome, "provinciaId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [nomeMun, provId]
          );
        }
      }
      console.log('[seed] Dados geográficos inseridos com sucesso.');
    } catch (e) {
      console.error('[seed] Erro ao popular dados geográficos:', e);
    }
  }

  await seedGeoData();

  async function seedDefaultUsers() {
    try {
      const existing = await query<JsonObject>(`SELECT COUNT(*) as count FROM public.utilizadores`, []);
      const count = parseInt(String((existing[0] as any).count), 10);
      if (count > 0) return;

      const cfgEscola = await query<JsonObject>(`SELECT "nomeEscola" FROM public.config_geral LIMIT 1`, []);
      const escola = (cfgEscola[0] as any)?.nomeEscola || 'Escola SIGA';
      const agora = new Date().toISOString();

      const defaultUsers = [
        { id: uuidv4(), nome: 'Administrador do Sistema', email: 'admin@sige.ao', senha: 'Admin@2025', role: 'admin', escola, ativo: true },
        { id: uuidv4(), nome: 'Director Académico',       email: 'director@sige.ao', senha: 'Director@2025', role: 'director', escola, ativo: true },
        { id: uuidv4(), nome: 'Encarregado de Educação',  email: 'encarregado@sige.ao', senha: 'Enc@2025', role: 'encarregado', escola, ativo: true },
        { id: uuidv4(), nome: 'Professor Exemplo',        email: 'professor@sige.ao', senha: 'Prof@2025', role: 'professor', escola, ativo: true },
        { id: uuidv4(), nome: 'PCA Escolar',              email: 'pca@sige.ao', senha: 'PCA@2025', role: 'pca', escola, ativo: true },
      ];

      for (const u of defaultUsers) {
        await query(
          `INSERT INTO public.utilizadores (id,nome,email,senha,role,escola,ativo,"criadoEm") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
          [u.id, u.nome, u.email, u.senha, u.role, u.escola, u.ativo, agora]
        );
      }
      console.log('[seed] Utilizadores padrão criados com sucesso.');
    } catch (e) {
      console.error('[seed] Erro ao criar utilizadores padrão:', e);
    }
  }

  await seedDefaultUsers();

  // -----------------------
  // SEED LOOKUP ITEMS
  // -----------------------
  async function seedLookupItems() {
    try {
      const existing = await query<JsonObject>(`SELECT COUNT(*) as count FROM public.lookup_items`, []);
      const count = parseInt(String((existing[0] as any).count), 10);
      if (count > 0) return;

      console.log('[seed] A popular lookup_items...');
      const defaults: { categoria: string; valor: string; label: string; ordem: number }[] = [
        // classes
        { categoria: 'classes', valor: 'Iniciação', label: 'Iniciação', ordem: 0 },
        { categoria: 'classes', valor: '1ª Classe', label: '1ª Classe', ordem: 1 },
        { categoria: 'classes', valor: '2ª Classe', label: '2ª Classe', ordem: 2 },
        { categoria: 'classes', valor: '3ª Classe', label: '3ª Classe', ordem: 3 },
        { categoria: 'classes', valor: '4ª Classe', label: '4ª Classe', ordem: 4 },
        { categoria: 'classes', valor: '5ª Classe', label: '5ª Classe', ordem: 5 },
        { categoria: 'classes', valor: '6ª Classe', label: '6ª Classe', ordem: 6 },
        { categoria: 'classes', valor: '7ª Classe', label: '7ª Classe', ordem: 7 },
        { categoria: 'classes', valor: '8ª Classe', label: '8ª Classe', ordem: 8 },
        { categoria: 'classes', valor: '9ª Classe', label: '9ª Classe', ordem: 9 },
        { categoria: 'classes', valor: '10ª Classe', label: '10ª Classe', ordem: 10 },
        { categoria: 'classes', valor: '11ª Classe', label: '11ª Classe', ordem: 11 },
        { categoria: 'classes', valor: '12ª Classe', label: '12ª Classe', ordem: 12 },
        { categoria: 'classes', valor: '13ª Classe', label: '13ª Classe', ordem: 13 },
        // niveis
        { categoria: 'niveis', valor: 'Primário', label: 'Primário', ordem: 0 },
        { categoria: 'niveis', valor: 'I Ciclo', label: 'I Ciclo', ordem: 1 },
        { categoria: 'niveis', valor: 'II Ciclo', label: 'II Ciclo', ordem: 2 },
        // turnos
        { categoria: 'turnos', valor: 'Manhã', label: 'Manhã', ordem: 0 },
        { categoria: 'turnos', valor: 'Tarde', label: 'Tarde', ordem: 1 },
        { categoria: 'turnos', valor: 'Noite', label: 'Noite', ordem: 2 },
        // tipos de sala
        { categoria: 'tipos_sala', valor: 'Sala Normal', label: 'Sala Normal', ordem: 0 },
        { categoria: 'tipos_sala', valor: 'Laboratório', label: 'Laboratório', ordem: 1 },
        { categoria: 'tipos_sala', valor: 'Sala de Informática', label: 'Sala de Informática', ordem: 2 },
        { categoria: 'tipos_sala', valor: 'Auditório', label: 'Auditório', ordem: 3 },
        { categoria: 'tipos_sala', valor: 'Sala de Reunião', label: 'Sala de Reunião', ordem: 4 },
        // áreas de conhecimento (disciplinas)
        { categoria: 'areas_conhecimento', valor: 'Ciências Exactas', label: 'Ciências Exactas', ordem: 0 },
        { categoria: 'areas_conhecimento', valor: 'Ciências Naturais', label: 'Ciências Naturais', ordem: 1 },
        { categoria: 'areas_conhecimento', valor: 'Ciências Sociais e Humanas', label: 'Ciências Sociais e Humanas', ordem: 2 },
        { categoria: 'areas_conhecimento', valor: 'Línguas e Comunicação', label: 'Línguas e Comunicação', ordem: 3 },
        { categoria: 'areas_conhecimento', valor: 'Artes e Expressão', label: 'Artes e Expressão', ordem: 4 },
        { categoria: 'areas_conhecimento', valor: 'Tecnologia e Informática', label: 'Tecnologia e Informática', ordem: 5 },
        { categoria: 'areas_conhecimento', valor: 'Educação Física', label: 'Educação Física', ordem: 6 },
        { categoria: 'areas_conhecimento', valor: 'Formação Profissional', label: 'Formação Profissional', ordem: 7 },
        { categoria: 'areas_conhecimento', valor: 'Outra', label: 'Outra', ordem: 8 },
        // áreas de formação (cursos)
        { categoria: 'areas_curso', valor: 'Ciências Físicas e Biológicas', label: 'Ciências Físicas e Biológicas', ordem: 0 },
        { categoria: 'areas_curso', valor: 'Ciências Económicas e Jurídicas', label: 'Ciências Económicas e Jurídicas', ordem: 1 },
        { categoria: 'areas_curso', valor: 'Humanidades', label: 'Humanidades', ordem: 2 },
        { categoria: 'areas_curso', valor: 'Artes Visuais', label: 'Artes Visuais', ordem: 3 },
        { categoria: 'areas_curso', valor: 'Ciências de Informática', label: 'Ciências de Informática', ordem: 4 },
        { categoria: 'areas_curso', valor: 'Formação de Professores', label: 'Formação de Professores', ordem: 5 },
        { categoria: 'areas_curso', valor: 'Outro', label: 'Outro', ordem: 6 },
        // tipos de taxa financeira
        { categoria: 'tipos_taxa', valor: 'propina', label: 'Propina', ordem: 0 },
        { categoria: 'tipos_taxa', valor: 'matricula', label: 'Matrícula', ordem: 1 },
        { categoria: 'tipos_taxa', valor: 'material', label: 'Material Didáctico', ordem: 2 },
        { categoria: 'tipos_taxa', valor: 'exame', label: 'Exame', ordem: 3 },
        { categoria: 'tipos_taxa', valor: 'multa', label: 'Multa', ordem: 4 },
        { categoria: 'tipos_taxa', valor: 'outro', label: 'Outro', ordem: 5 },
        // métodos de pagamento
        { categoria: 'metodos_pagamento', valor: 'dinheiro', label: 'Dinheiro', ordem: 0 },
        { categoria: 'metodos_pagamento', valor: 'transferencia', label: 'RUPE/Transferência', ordem: 1 },
        { categoria: 'metodos_pagamento', valor: 'multicaixa', label: 'Multicaixa', ordem: 2 },
        // disciplinas fallback (usadas quando turma não tem disciplinas atribuídas)
        { categoria: 'disciplinas_fallback', valor: 'Matemática', label: 'Matemática', ordem: 0 },
        { categoria: 'disciplinas_fallback', valor: 'Português', label: 'Português', ordem: 1 },
        { categoria: 'disciplinas_fallback', valor: 'Física', label: 'Física', ordem: 2 },
        { categoria: 'disciplinas_fallback', valor: 'Química', label: 'Química', ordem: 3 },
        { categoria: 'disciplinas_fallback', valor: 'Biologia', label: 'Biologia', ordem: 4 },
        { categoria: 'disciplinas_fallback', valor: 'História', label: 'História', ordem: 5 },
        { categoria: 'disciplinas_fallback', valor: 'Geografia', label: 'Geografia', ordem: 6 },
        { categoria: 'disciplinas_fallback', valor: 'Inglês', label: 'Inglês', ordem: 7 },
        { categoria: 'disciplinas_fallback', valor: 'Educação Física', label: 'Educação Física', ordem: 8 },
        { categoria: 'disciplinas_fallback', valor: 'Filosofia', label: 'Filosofia', ordem: 9 },
        { categoria: 'disciplinas_fallback', valor: 'Desenho', label: 'Desenho', ordem: 10 },
      ];
      for (const item of defaults) {
        await query(
          `INSERT INTO public.lookup_items (categoria, valor, label, ordem, ativo) VALUES ($1,$2,$3,$4,true) ON CONFLICT DO NOTHING`,
          [item.categoria, item.valor, item.label, item.ordem]
        );
      }
      console.log('[seed] Lookup items inseridos com sucesso.');
    } catch (e) {
      console.error('[seed] Erro ao popular lookup_items:', e);
    }
  }

  async function seedConfigDefaults() {
    try {
      const rows = await query<JsonObject>(`SELECT id, "irtTabela" FROM public.config_geral LIMIT 1`, []);
      if (!rows[0]) return;
      const cfg = rows[0] as any;
      const tabelaVazia = !cfg.irtTabela || (Array.isArray(cfg.irtTabela) && cfg.irtTabela.length === 0);
      if (!tabelaVazia) return;

      const defaultIRT = [
        { max: 70000,    taxa: 0,    baseFixa: 0,      limiteAnterior: 0 },
        { max: 100000,   taxa: 0.10, baseFixa: 0,      limiteAnterior: 70000 },
        { max: 150000,   taxa: 0.13, baseFixa: 3000,   limiteAnterior: 100000 },
        { max: 200000,   taxa: 0.16, baseFixa: 9500,   limiteAnterior: 150000 },
        { max: 300000,   taxa: 0.18, baseFixa: 17500,  limiteAnterior: 200000 },
        { max: 500000,   taxa: 0.19, baseFixa: 35500,  limiteAnterior: 300000 },
        { max: 1000000,  taxa: 0.20, baseFixa: 73500,  limiteAnterior: 500000 },
        { max: null,     taxa: 0.25, baseFixa: 173500, limiteAnterior: 1000000 },
      ];
      await query(
        `UPDATE public.config_geral SET "irtTabela"=$1::jsonb WHERE id=$2`,
        [JSON.stringify(defaultIRT), cfg.id]
      );
      console.log('[seed] Tabela IRT inserida com valores padrão.');
    } catch (e) {
      console.error('[seed] Erro ao popular config defaults:', e);
    }
  }

  await seedLookupItems();
  await seedConfigDefaults();

  // -----------------------
  // LOOKUP ITEMS — API
  // -----------------------

  // GET /api/lookup/:categoria — público (sem auth)
  app.get("/api/lookup/:categoria", async (req: Request, res: Response) => {
    try {
      const { categoria } = req.params;
      const rows = await query<JsonObject>(
        `SELECT id, categoria, valor, label, ordem, ativo FROM public.lookup_items WHERE categoria=$1 AND ativo=true ORDER BY ordem ASC, label ASC`,
        [categoria]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // GET /api/lookup — lista todas as categorias disponíveis (admin)
  app.get("/api/lookup", requireAuth, async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT DISTINCT categoria FROM public.lookup_items ORDER BY categoria ASC`, []
      );
      json(res, 200, rows.map((r: any) => r.categoria));
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // POST /api/lookup — criar item (admin)
  app.post("/api/lookup", requireAuth, requirePermission("admin"), async (req: Request, res: Response) => {
    try {
      const { categoria, valor, label, ordem } = requireBodyObject(req) as any;
      if (!categoria || !valor || !label) return json(res, 400, { error: 'categoria, valor e label são obrigatórios.' });
      const rows = await query<JsonObject>(
        `INSERT INTO public.lookup_items (categoria, valor, label, ordem, ativo) VALUES ($1,$2,$3,$4,true) RETURNING *`,
        [categoria, valor, label, ordem ?? 99]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // PUT /api/lookup/:id — atualizar item (admin)
  app.put("/api/lookup/:id", requireAuth, requirePermission("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { valor, label, ordem, ativo } = requireBodyObject(req) as any;
      const setParts: string[] = []; const values: unknown[] = [];
      if (valor !== undefined) { values.push(valor); setParts.push(`valor=$${values.length}`); }
      if (label !== undefined) { values.push(label); setParts.push(`label=$${values.length}`); }
      if (ordem !== undefined) { values.push(ordem); setParts.push(`ordem=$${values.length}`); }
      if (ativo !== undefined) { values.push(ativo); setParts.push(`ativo=$${values.length}`); }
      if (!setParts.length) return json(res, 400, { error: 'Nenhum campo para atualizar.' });
      values.push(id);
      const rows = await query<JsonObject>(
        `UPDATE public.lookup_items SET ${setParts.join(',')} WHERE id=$${values.length} RETURNING *`, values
      );
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // DELETE /api/lookup/:id — remover item (admin)
  app.delete("/api/lookup/:id", requireAuth, requirePermission("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await query(`DELETE FROM public.lookup_items WHERE id=$1`, [id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // DOCUMENTOS EMITIDOS (HISTÓRICO)
  // -----------------------
  app.get("/api/documentos-emitidos", async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT id, aluno_id AS "alunoId", aluno_nome AS "alunoNome", aluno_num AS "alunoNum",
                aluno_turma AS "alunoTurma", tipo, finalidade, ano_academico AS "anoAcademico",
                emitido_por AS "emitidoPor", emitido_em AS "emitidoEm", dados_snapshot AS "dadosSnapshot"
         FROM public.documentos_emitidos ORDER BY emitido_em DESC`,
        []
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.get("/api/documentos-emitidos/aluno/:alunoId", async (req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT id, aluno_id AS "alunoId", aluno_nome AS "alunoNome", aluno_num AS "alunoNum",
                aluno_turma AS "alunoTurma", tipo, finalidade, ano_academico AS "anoAcademico",
                emitido_por AS "emitidoPor", emitido_em AS "emitidoEm", dados_snapshot AS "dadosSnapshot"
         FROM public.documentos_emitidos WHERE aluno_id=$1 ORDER BY emitido_em DESC`,
        [req.params.alunoId]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/documentos-emitidos", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { alunoId, alunoNome, alunoNum, alunoTurma, tipo, finalidade, anoAcademico, emitidoPor, dadosSnapshot } = b as Record<string, unknown>;
      if (!alunoNome || !tipo || !emitidoPor) return json(res, 400, { error: 'alunoNome, tipo e emitidoPor são obrigatórios.' });
      const rows = await query<JsonObject>(
        `INSERT INTO public.documentos_emitidos (aluno_id, aluno_nome, aluno_num, aluno_turma, tipo, finalidade, ano_academico, emitido_por, dados_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, aluno_id AS "alunoId", aluno_nome AS "alunoNome", aluno_num AS "alunoNum",
                   aluno_turma AS "alunoTurma", tipo, finalidade, ano_academico AS "anoAcademico",
                   emitido_por AS "emitidoPor", emitido_em AS "emitidoEm", dados_snapshot AS "dadosSnapshot"`,
        [alunoId ?? null, alunoNome, alunoNum ?? '', alunoTurma ?? null, tipo, finalidade ?? '', anoAcademico ?? '', emitidoPor, dadosSnapshot ?? null]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.delete("/api/documentos-emitidos/:id", async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.documentos_emitidos WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // DOC TEMPLATES (EDITOR DE DOCUMENTOS)
  // -----------------------
  app.get("/api/doc-templates", async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT id, nome, tipo, conteudo, insignia_base64 AS "insigniaBase64", marca_agua_base64 AS "marcaAguaBase64", classe_alvo AS "classeAlvo", bloqueado, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm" FROM public.doc_templates ORDER BY criado_em DESC`,
        []
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/doc-templates", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { id, nome, tipo, conteudo, insigniaBase64, marcaAguaBase64, classeAlvo, bloqueado } = b as Record<string, unknown>;
      if (!nome || !tipo || !conteudo) return json(res, 400, { error: 'nome, tipo e conteudo são obrigatórios.' });

      const idToUse = id && typeof id === 'string' ? id : undefined;
      let rows: JsonObject[];
      if (idToUse) {
        rows = await query<JsonObject>(
          `INSERT INTO public.doc_templates (id, nome, tipo, conteudo, insignia_base64, marca_agua_base64, classe_alvo, bloqueado)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, tipo=EXCLUDED.tipo, conteudo=EXCLUDED.conteudo, insignia_base64=EXCLUDED.insignia_base64, marca_agua_base64=EXCLUDED.marca_agua_base64, classe_alvo=EXCLUDED.classe_alvo, bloqueado=EXCLUDED.bloqueado, atualizado_em=NOW()
           RETURNING id, nome, tipo, conteudo, insignia_base64 AS "insigniaBase64", marca_agua_base64 AS "marcaAguaBase64", classe_alvo AS "classeAlvo", bloqueado, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`,
          [idToUse, nome, tipo, conteudo, insigniaBase64 ?? null, marcaAguaBase64 ?? null, classeAlvo ?? null, bloqueado ?? false]
        );
      } else {
        rows = await query<JsonObject>(
          `INSERT INTO public.doc_templates (nome, tipo, conteudo, insignia_base64, marca_agua_base64, classe_alvo, bloqueado)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING id, nome, tipo, conteudo, insignia_base64 AS "insigniaBase64", marca_agua_base64 AS "marcaAguaBase64", classe_alvo AS "classeAlvo", bloqueado, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`,
          [nome, tipo, conteudo, insigniaBase64 ?? null, marcaAguaBase64 ?? null, classeAlvo ?? null, bloqueado ?? false]
        );
      }
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.put("/api/doc-templates/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { nome, tipo, conteudo, insigniaBase64, marcaAguaBase64, classeAlvo } = b as Record<string, unknown>;
      if (!nome || !tipo || !conteudo) return json(res, 400, { error: 'nome, tipo e conteudo são obrigatórios.' });
      const rows = await query<JsonObject>(
        `UPDATE public.doc_templates SET nome=$1, tipo=$2, conteudo=$3, insignia_base64=$4, marca_agua_base64=$5, classe_alvo=$6, atualizado_em=NOW()
         WHERE id=$7
         RETURNING id, nome, tipo, conteudo, insignia_base64 AS "insigniaBase64", marca_agua_base64 AS "marcaAguaBase64", classe_alvo AS "classeAlvo", bloqueado, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`,
        [nome, tipo, conteudo, insigniaBase64 ?? null, marcaAguaBase64 ?? null, classeAlvo ?? null, id]
      );
      if (!rows.length) return json(res, 404, { error: 'Template não encontrado.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.patch("/api/doc-templates/:id/bloqueado", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { bloqueado } = b as Record<string, unknown>;
      const rows = await query<JsonObject>(
        `UPDATE public.doc_templates SET bloqueado=$1, atualizado_em=NOW() WHERE id=$2
         RETURNING id, bloqueado`,
        [bloqueado ?? false, id]
      );
      if (!rows.length) return json(res, 404, { error: 'Template não encontrado.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.delete("/api/doc-templates/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await query(`DELETE FROM public.doc_templates WHERE id=$1`, [id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // CURSOS
  // -----------------------
  app.get("/api/cursos", async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT * FROM public.cursos ORDER BY "areaFormacao" ASC, nome ASC`,
        []
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/cursos", async (req: Request, res: Response) => {
    try {
      const body = requireBodyObject(req);
      const { nome, codigo, areaFormacao, descricao } = body as Record<string, string>;
      if (!nome?.trim()) return json(res, 400, { error: 'Nome é obrigatório.' });
      if (!areaFormacao?.trim()) return json(res, 400, { error: 'Área de formação é obrigatória.' });
      const rows = await query<JsonObject>(
        `INSERT INTO public.cursos (nome, codigo, "areaFormacao", descricao, ativo)
         VALUES ($1, $2, $3, $4, true) RETURNING *`,
        [nome.trim(), (codigo || '').trim(), areaFormacao.trim(), (descricao || '').trim()]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.put("/api/cursos/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = requireBodyObject(req);
      const { nome, codigo, areaFormacao, descricao, ativo } = body as Record<string, any>;
      const rows = await query<JsonObject>(
        `UPDATE public.cursos SET nome=$1, codigo=$2, "areaFormacao"=$3, descricao=$4, ativo=$5
         WHERE id=$6 RETURNING *`,
        [nome?.trim(), (codigo || '').trim(), areaFormacao?.trim(), (descricao || '').trim(), ativo !== false, id]
      );
      if (!rows.length) return json(res, 404, { error: 'Curso não encontrado.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.delete("/api/cursos/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await query(`UPDATE public.cursos SET ativo=false WHERE id=$1`, [id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // CURSO_DISCIPLINAS (ligação curso ↔ disciplina)
  // -----------------------

  // GET disciplinas de um curso específico (com detalhes da disciplina)
  app.get("/api/cursos/:id/disciplinas", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rows = await query<JsonObject>(
        `SELECT cd.id, cd."cursoId", cd."disciplinaId", cd.obrigatoria, cd."cargaHoraria", cd.ordem,
                d.nome, d.codigo, d.area, d.descricao, d.ativo
         FROM public.curso_disciplinas cd
         JOIN public.disciplinas d ON d.id = cd."disciplinaId"
         WHERE cd."cursoId" = $1
         ORDER BY cd.ordem ASC, d.nome ASC`,
        [id]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // PUT — repõe a lista de disciplinas de um curso (substitui tudo)
  app.put("/api/cursos/:id/disciplinas", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = requireBodyObject(req);
      const disciplinaIds = (body.disciplinaIds as string[]) || [];

      // Remove todas as existentes e re-insere
      await query(`DELETE FROM public.curso_disciplinas WHERE "cursoId"=$1`, [id]);

      if (disciplinaIds.length > 0) {
        for (let i = 0; i < disciplinaIds.length; i++) {
          await query(
            `INSERT INTO public.curso_disciplinas ("cursoId","disciplinaId",obrigatoria,"cargaHoraria",ordem)
             VALUES ($1,$2,true,0,$3)
             ON CONFLICT DO NOTHING`,
            [id, disciplinaIds[i], i]
          );
        }
      }

      // Retorna a lista actualizada
      const rows = await query<JsonObject>(
        `SELECT cd.id, cd."cursoId", cd."disciplinaId", cd.obrigatoria, cd."cargaHoraria", cd.ordem,
                d.nome, d.codigo, d.area, d.descricao, d.ativo
         FROM public.curso_disciplinas cd
         JOIN public.disciplinas d ON d.id = cd."disciplinaId"
         WHERE cd."cursoId" = $1
         ORDER BY cd.ordem ASC, d.nome ASC`,
        [id]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // GET disciplinas de uma turma (via cursoId da turma)
  app.get("/api/turmas/:id/disciplinas", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const turmaRows = await query<JsonObject>(
        `SELECT "cursoId" FROM public.turmas WHERE id=$1`, [id]
      );
      if (!turmaRows.length) return json(res, 404, { error: 'Turma não encontrada.' });

      const cursoId = turmaRows[0].cursoId as string | null;
      if (!cursoId) return json(res, 200, []); // Turma sem curso não tem disciplinas via curso

      const rows = await query<JsonObject>(
        `SELECT cd."disciplinaId" AS id, d.nome, d.codigo, d.area, d.descricao, d.ativo,
                cd.obrigatoria, cd."cargaHoraria", cd.ordem
         FROM public.curso_disciplinas cd
         JOIN public.disciplinas d ON d.id = cd."disciplinaId"
         WHERE cd."cursoId" = $1 AND d.ativo = true
         ORDER BY cd.ordem ASC, d.nome ASC`,
        [cursoId]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // PLANIFICAÇÕES DE AULA
  // -----------------------
  app.get("/api/planificacoes", async (req: Request, res: Response) => {
    try {
      const { turmaId, disciplina, trimestre, anoLetivo, professorId } = req.query;
      let sql = `SELECT * FROM public.planificacoes WHERE 1=1`;
      const params: unknown[] = [];
      let i = 1;
      if (turmaId)    { sql += ` AND "turmaId"=$${i++}`;    params.push(turmaId); }
      if (disciplina) { sql += ` AND disciplina=$${i++}`;   params.push(disciplina); }
      if (trimestre)  { sql += ` AND trimestre=$${i++}`;    params.push(Number(trimestre)); }
      if (anoLetivo)  { sql += ` AND "anoLetivo"=$${i++}`;  params.push(anoLetivo); }
      if (professorId){ sql += ` AND "professorId"=$${i++}`;params.push(professorId); }
      sql += ` ORDER BY trimestre ASC, semana ASC, "createdAt" DESC`;
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/planificacoes", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.planificacoes (
          "professorId","turmaId",disciplina,trimestre,semana,"anoLetivo",
          tema,objectivos,conteudos,metodologia,recursos,avaliacao,observacoes,"numAulas",cumprida
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          b.professorId, b.turmaId, b.disciplina, b.trimestre, b.semana, b.anoLetivo,
          b.tema, b.objectivos||'', b.conteudos||'', b.metodologia||'',
          b.recursos||'', b.avaliacao||'', b.observacoes||'', b.numAulas||1, b.cumprida||false
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.put("/api/planificacoes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `UPDATE public.planificacoes SET
          tema=$1, objectivos=$2, conteudos=$3, metodologia=$4, recursos=$5,
          avaliacao=$6, observacoes=$7, "numAulas"=$8, cumprida=$9,
          disciplina=$10, trimestre=$11, semana=$12
        WHERE id=$13 RETURNING *`,
        [
          b.tema, b.objectivos||'', b.conteudos||'', b.metodologia||'', b.recursos||'',
          b.avaliacao||'', b.observacoes||'', b.numAulas||1, b.cumprida||false,
          b.disciplina, b.trimestre, b.semana, id
        ]
      );
      if (!rows.length) return json(res, 404, { error: 'Planificação não encontrada.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.delete("/api/planificacoes/:id", async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.planificacoes WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // CONTEÚDOS PROGRAMÁTICOS
  // -----------------------
  app.get("/api/conteudos-programaticos", async (req: Request, res: Response) => {
    try {
      const { disciplina, classe, trimestre, anoLetivo } = req.query;
      let sql = `SELECT * FROM public.conteudos_programaticos WHERE 1=1`;
      const params: unknown[] = [];
      let i = 1;
      if (disciplina) { sql += ` AND disciplina=$${i++}`;  params.push(disciplina); }
      if (classe)     { sql += ` AND classe=$${i++}`;      params.push(classe); }
      if (trimestre)  { sql += ` AND trimestre=$${i++}`;   params.push(Number(trimestre)); }
      if (anoLetivo)  { sql += ` AND "anoLetivo"=$${i++}`; params.push(anoLetivo); }
      sql += ` ORDER BY trimestre ASC, ordem ASC`;
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/conteudos-programaticos", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.conteudos_programaticos
          (disciplina,classe,trimestre,"anoLetivo",titulo,descricao,ordem,cumprido,percentagem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [b.disciplina, b.classe, b.trimestre, b.anoLetivo, b.titulo, b.descricao||'', b.ordem||0, b.cumprido||false, b.percentagem||0]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.put("/api/conteudos-programaticos/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `UPDATE public.conteudos_programaticos
         SET titulo=$1, descricao=$2, cumprido=$3, percentagem=$4, ordem=$5
         WHERE id=$6 RETURNING *`,
        [b.titulo, b.descricao||'', b.cumprido||false, b.percentagem||0, b.ordem||0, id]
      );
      if (!rows.length) return json(res, 404, { error: 'Conteúdo não encontrado.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.delete("/api/conteudos-programaticos/:id", async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.conteudos_programaticos WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // OCORRÊNCIAS DISCIPLINARES
  // -----------------------
  app.get("/api/ocorrencias", async (req: Request, res: Response) => {
    try {
      const { alunoId, turmaId, resolvida } = req.query;
      let sql = `SELECT * FROM public.ocorrencias WHERE 1=1`;
      const params: unknown[] = [];
      let i = 1;
      if (alunoId)  { sql += ` AND "alunoId"=$${i++}`;  params.push(alunoId); }
      if (turmaId)  { sql += ` AND "turmaId"=$${i++}`;  params.push(turmaId); }
      if (resolvida !== undefined) { sql += ` AND resolvida=$${i++}`; params.push(resolvida === 'true'); }
      sql += ` ORDER BY data DESC, "createdAt" DESC`;
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/ocorrencias", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.ocorrencias
          ("alunoId","turmaId","professorId","registadoPor",tipo,gravidade,descricao,"medidaTomada",data,resolvida,observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          b.alunoId, b.turmaId, b.professorId||null, b.registadoPor,
          b.tipo, b.gravidade||'leve', b.descricao, b.medidaTomada||'',
          b.data, b.resolvida||false, b.observacoes||''
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.put("/api/ocorrencias/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `UPDATE public.ocorrencias
         SET tipo=$1, gravidade=$2, descricao=$3, "medidaTomada"=$4, data=$5, resolvida=$6, observacoes=$7
         WHERE id=$8 RETURNING *`,
        [b.tipo, b.gravidade, b.descricao, b.medidaTomada||'', b.data, b.resolvida||false, b.observacoes||'', id]
      );
      if (!rows.length) return json(res, 404, { error: 'Ocorrência não encontrada.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.delete("/api/ocorrencias/:id", async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.ocorrencias WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // DISCIPLINAS (catálogo)
  // -----------------------
  app.get("/api/disciplinas", async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(`SELECT * FROM public.disciplinas ORDER BY nome ASC`, []);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/disciplinas", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      if (!b.nome) return json(res, 400, { error: 'Nome é obrigatório.' });
      const rows = await query<JsonObject>(
        `INSERT INTO public.disciplinas (nome, codigo, area, descricao, ativo)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [b.nome, b.codigo || '', b.area || '', b.descricao || '', b.ativo ?? true]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.put("/api/disciplinas/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `UPDATE public.disciplinas SET nome=$1, codigo=$2, area=$3, descricao=$4, ativo=$5 WHERE id=$6 RETURNING *`,
        [b.nome, b.codigo || '', b.area || '', b.descricao || '', b.ativo ?? true, id]
      );
      if (!rows.length) return json(res, 404, { error: 'Disciplina não encontrada.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.delete("/api/disciplinas/:id", async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.disciplinas WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.get("/api/provincias", async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(`SELECT id, nome FROM public.provincias ORDER BY nome ASC`, []);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.get("/api/municipios", async (req: Request, res: Response) => {
    try {
      const { provinciaId } = req.query;
      if (!provinciaId) return json(res, 400, { error: 'provinciaId é obrigatório.' });
      const rows = await query<JsonObject>(
        `SELECT id, nome, "provinciaId" FROM public.municipios WHERE "provinciaId"=$1 ORDER BY nome ASC`,
        [Number(provinciaId)]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // RECUPERAÇÃO DE SENHA
  // -----------------------
  app.post("/api/forgot-password", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const email = String(b.email ?? "").toLowerCase().trim();
      if (!email) return json(res, 400, { error: "Email é obrigatório." });

      // Verificar se o email existe (utilizadores da BD ou contas fixas)
      const FIXED_EMAILS = [
        "ceo@sige.ao", "financeiro@sige.ao", "secretaria@sige.ao", "rh@sige.ao"
      ];
      let nomeUtilizador = "";

      if (FIXED_EMAILS.includes(email)) {
        return json(res, 400, {
          error: "Este email pertence a uma conta de sistema. Contacte o administrador para redefinir a senha."
        });
      }

      const rows = await query<JsonObject>(
        `SELECT id, nome, email FROM public.utilizadores WHERE LOWER(email)=LOWER($1) AND ativo=true LIMIT 1`,
        [email]
      );
      if (!rows[0]) {
        // Por segurança, responder com sucesso mesmo que o email não exista
        return json(res, 200, { ok: true, message: "Se o email existir no sistema, receberá um link de redefinição." });
      }
      nomeUtilizador = String(rows[0].nome);

      // Invalidar tokens anteriores deste email
      await query(
        `UPDATE public.password_reset_tokens SET "usedAt"=NOW() WHERE email=LOWER($1) AND "usedAt" IS NULL`,
        [email]
      );

      // Gerar novo token seguro
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await query(
        `INSERT INTO public.password_reset_tokens (email, token, "expiresAt") VALUES (LOWER($1), $2, $3)`,
        [email, token, expiresAt.toISOString()]
      );

      // Construir link de reset
      let appDomain = "";
      if (process.env.REPLIT_DOMAINS) {
        appDomain = `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`;
      } else if (process.env.REPLIT_DEV_DOMAIN) {
        appDomain = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      } else {
        appDomain = `http://localhost:5000`;
      }
      const resetLink = `${appDomain}/redefinir-senha?token=${token}`;

      let nomeEscola: string | undefined;
      try {
        const cfgRows = await query<JsonObject>(`SELECT "nomeEscola" FROM public.config_geral LIMIT 1`, []);
        if (cfgRows[0]?.nomeEscola) nomeEscola = String(cfgRows[0].nomeEscola);
      } catch { /* sem configuração disponível */ }

      const result = await sendPasswordResetEmail(email, nomeUtilizador, resetLink, nomeEscola);

      if (!result.success) {
        return json(res, 500, { error: result.message });
      }

      return json(res, 200, { ok: true, message: "Link de redefinição enviado para o seu email." });
    } catch (e) {
      console.error("[forgot-password]", e);
      return json(res, 500, { error: "Erro interno. Tente novamente mais tarde." });
    }
  });

  app.post("/api/reset-password", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const token = String(b.token ?? "").trim();
      const novaSenha = String(b.novaSenha ?? "").trim();

      if (!token || !novaSenha) {
        return json(res, 400, { error: "Token e nova senha são obrigatórios." });
      }
      if (novaSenha.length < 6) {
        return json(res, 400, { error: "A senha deve ter pelo menos 6 caracteres." });
      }

      // Verificar token
      const tokenRows = await query<JsonObject>(
        `SELECT * FROM public.password_reset_tokens WHERE token=$1 AND "usedAt" IS NULL AND "expiresAt" > NOW() LIMIT 1`,
        [token]
      );
      if (!tokenRows[0]) {
        return json(res, 400, { error: "Link inválido ou expirado. Solicite um novo link de redefinição." });
      }

      const tokenRecord = tokenRows[0];
      const email = String(tokenRecord.email);

      // Atualizar senha do utilizador
      const updateRows = await query<JsonObject>(
        `UPDATE public.utilizadores SET senha=$1 WHERE LOWER(email)=LOWER($2) AND ativo=true RETURNING id`,
        [novaSenha, email]
      );
      if (!updateRows[0]) {
        return json(res, 404, { error: "Utilizador não encontrado ou inactivo." });
      }

      // Marcar token como usado
      await query(
        `UPDATE public.password_reset_tokens SET "usedAt"=NOW() WHERE token=$1`,
        [token]
      );

      return json(res, 200, { ok: true, message: "Senha redefinida com sucesso. Pode agora iniciar sessão." });
    } catch (e) {
      console.error("[reset-password]", e);
      return json(res, 500, { error: "Erro interno. Tente novamente mais tarde." });
    }
  });

  app.get("/api/verify-reset-token", async (req: Request, res: Response) => {
    try {
      const token = String(req.query.token ?? "").trim();
      if (!token) return json(res, 400, { error: "Token é obrigatório." });

      const rows = await query<JsonObject>(
        `SELECT email FROM public.password_reset_tokens WHERE token=$1 AND "usedAt" IS NULL AND "expiresAt" > NOW() LIMIT 1`,
        [token]
      );
      if (!rows[0]) {
        return json(res, 400, { valid: false, error: "Link inválido ou expirado." });
      }
      return json(res, 200, { valid: true, email: String(rows[0].email) });
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
  });

  // ─── PLANOS DE AULA ──────────────────────────────────────────────────────────

  app.get("/api/planos-aula", async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT id, "professorId", "professorNome", "turmaId", "turmaNome", disciplina, unidade,
                sumario, classe, escola, "perfilEntrada", "perfilSaida", data, periodo, tempo,
                duracao, "anoLetivo", "objectivoGeral", "objectivosEspecificos", fases, status,
                "observacaoDirector", "aprovadoPor", "aprovadoEm",
                "createdAt", "updatedAt"
         FROM public.planos_aula ORDER BY "createdAt" DESC`
      );
      return json(res, 200, rows);
    } catch (e) { return json(res, 500, { error: (e as Error).message }); }
  });

  app.get("/api/planos-aula/professor/:professorId", async (req: Request, res: Response) => {
    try {
      const { professorId } = req.params;
      const rows = await query<JsonObject>(
        `SELECT id, "professorId", "professorNome", "turmaId", "turmaNome", disciplina, unidade,
                sumario, classe, escola, "perfilEntrada", "perfilSaida", data, periodo, tempo,
                duracao, "anoLetivo", "objectivoGeral", "objectivosEspecificos", fases, status,
                "observacaoDirector", "aprovadoPor", "aprovadoEm",
                "createdAt", "updatedAt"
         FROM public.planos_aula WHERE "professorId"=$1 ORDER BY "createdAt" DESC`,
        [professorId]
      );
      return json(res, 200, rows);
    } catch (e) { return json(res, 500, { error: (e as Error).message }); }
  });

  app.get("/api/planos-aula/:id", async (req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT * FROM public.planos_aula WHERE id=$1 LIMIT 1`,
        [req.params.id]
      );
      if (!rows[0]) return json(res, 404, { error: 'Plano não encontrado.' });
      return json(res, 200, rows[0]);
    } catch (e) { return json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/planos-aula", async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      if (!b.professorId || !b.professorNome || !b.disciplina)
        return json(res, 400, { error: 'professorId, professorNome e disciplina são obrigatórios.' });
      const rows = await query<JsonObject>(
        `INSERT INTO public.planos_aula
           ("professorId", "professorNome", "turmaId", "turmaNome", disciplina, unidade,
            sumario, classe, escola, "perfilEntrada", "perfilSaida", data, periodo, tempo,
            duracao, "anoLetivo", "objectivoGeral", "objectivosEspecificos", fases, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)
         RETURNING *`,
        [b.professorId, b.professorNome, b.turmaId ?? null, b.turmaNome ?? '',
         b.disciplina, b.unidade ?? '', b.sumario ?? '', b.classe ?? '', b.escola ?? '',
         b.perfilEntrada ?? '', b.perfilSaida ?? '', b.data ?? '', b.periodo ?? '',
         b.tempo ?? '', b.duracao ?? '', b.anoLetivo ?? '', b.objectivoGeral ?? '',
         b.objectivosEspecificos ?? '', JSON.stringify(b.fases ?? []), b.status ?? 'rascunho']
      );
      return json(res, 201, rows[0]);
    } catch (e) { return json(res, 500, { error: (e as Error).message }); }
  });

  app.put("/api/planos-aula/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = req.body as Record<string, unknown>;
      const rows = await query<JsonObject>(
        `UPDATE public.planos_aula SET
           "professorNome"=COALESCE($1,"professorNome"), "turmaId"=COALESCE($2,"turmaId"),
           "turmaNome"=COALESCE($3,"turmaNome"), disciplina=COALESCE($4,disciplina),
           unidade=COALESCE($5,unidade), sumario=COALESCE($6,sumario),
           classe=COALESCE($7,classe), escola=COALESCE($8,escola),
           "perfilEntrada"=COALESCE($9,"perfilEntrada"), "perfilSaida"=COALESCE($10,"perfilSaida"),
           data=COALESCE($11,data), periodo=COALESCE($12,periodo), tempo=COALESCE($13,tempo),
           duracao=COALESCE($14,duracao), "anoLetivo"=COALESCE($15,"anoLetivo"),
           "objectivoGeral"=COALESCE($16,"objectivoGeral"),
           "objectivosEspecificos"=COALESCE($17,"objectivosEspecificos"),
           fases=COALESCE($18::jsonb,fases), status=COALESCE($19,status),
           "observacaoDirector"=COALESCE($20,"observacaoDirector"),
           "aprovadoPor"=COALESCE($21,"aprovadoPor"), "aprovadoEm"=COALESCE($22,"aprovadoEm"),
           "updatedAt"=NOW()
         WHERE id=$23 RETURNING *`,
        [b.professorNome ?? null, b.turmaId ?? null, b.turmaNome ?? null, b.disciplina ?? null,
         b.unidade ?? null, b.sumario ?? null, b.classe ?? null, b.escola ?? null,
         b.perfilEntrada ?? null, b.perfilSaida ?? null, b.data ?? null, b.periodo ?? null,
         b.tempo ?? null, b.duracao ?? null, b.anoLetivo ?? null, b.objectivoGeral ?? null,
         b.objectivosEspecificos ?? null, b.fases != null ? JSON.stringify(b.fases) : null,
         b.status ?? null, b.observacaoDirector ?? null, b.aprovadoPor ?? null, b.aprovadoEm ?? null, id]
      );
      if (!rows[0]) return json(res, 404, { error: 'Plano não encontrado.' });
      return json(res, 200, rows[0]);
    } catch (e) { return json(res, 500, { error: (e as Error).message }); }
  });

  app.delete("/api/planos-aula/:id", async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.planos_aula WHERE id=$1`, [req.params.id]);
      return json(res, 200, { ok: true });
    } catch (e) { return json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // FOLHAS DE SALÁRIOS (PAYROLL)
  // -----------------------

  // IRT Angola — cálculo do Imposto sobre Rendimento do Trabalho
  function calcularIRT(rendimentoBruto: number): number {
    if (rendimentoBruto <= 70000)   return 0;
    if (rendimentoBruto <= 100000)  return (rendimentoBruto - 70000) * 0.10;
    if (rendimentoBruto <= 150000)  return 3000  + (rendimentoBruto - 100000) * 0.13;
    if (rendimentoBruto <= 200000)  return 9500  + (rendimentoBruto - 150000) * 0.16;
    if (rendimentoBruto <= 300000)  return 17500 + (rendimentoBruto - 200000) * 0.18;
    if (rendimentoBruto <= 500000)  return 35500 + (rendimentoBruto - 300000) * 0.19;
    if (rendimentoBruto <= 1000000) return 73500 + (rendimentoBruto - 500000) * 0.20;
    return 173500 + (rendimentoBruto - 1000000) * 0.25;
  }

  app.get("/api/folhas-salarios", requireAuth, requirePermission("rh"), async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(`SELECT * FROM public.folhas_salarios ORDER BY ano DESC, mes DESC`, []);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.get("/api/folhas-salarios/:id", requireAuth, requirePermission("rh"), async (req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(`SELECT * FROM public.folhas_salarios WHERE id=$1`, [req.params.id]);
      if (!rows[0]) return json(res, 404, { error: 'Folha não encontrada.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.get("/api/folhas-salarios/:id/itens", requireAuth, requirePermission("rh"), async (req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(`SELECT * FROM public.itens_folha WHERE "folhaId"=$1 ORDER BY "professorNome"`, [req.params.id]);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/folhas-salarios", requireAuth, requirePermission("rh"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const mes = Number(b.mes);
      const ano = Number(b.ano);
      if (!mes || !ano) return json(res, 400, { error: 'Mês e ano são obrigatórios.' });

      // Check if sheet already exists for this month/year
      const existing = await query<JsonObject>(
        `SELECT id FROM public.folhas_salarios WHERE mes=$1 AND ano=$2 LIMIT 1`,
        [mes, ano]
      );
      if (existing[0]) return json(res, 409, { error: 'Já existe uma folha de salários para este mês/ano.' });

      const rows = await query<JsonObject>(
        `INSERT INTO public.folhas_salarios (id,mes,ano,descricao,status,observacoes)
         VALUES (gen_random_uuid(),$1,$2,$3,'rascunho',$4) RETURNING *`,
        [mes, ano, String(b.descricao ?? ''), String(b.observacoes ?? '')]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/folhas-salarios/:id", requireAuth, requirePermission("rh"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["descricao","status","observacoes","processadaPor"] as const;
      const setParts: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (b[key] === undefined) continue;
        values.push(b[key]);
        setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: 'Sem campos para atualizar.' });
      setParts.push(`"atualizadoEm"=NOW()`);
      const rows = await query<JsonObject>(
        `UPDATE public.folhas_salarios SET ${setParts.join(',')} WHERE id=$${values.length+1} RETURNING *`,
        [...values, id]
      );
      if (!rows[0]) return json(res, 404, { error: 'Folha não encontrada.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/folhas-salarios/:id", requireAuth, requirePermission("rh"), async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.folhas_salarios WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // Processar folha: gera itens automáticos para todos os professores ativos com salário definido
  app.post("/api/folhas-salarios/:id/processar", requireAuth, requirePermission("rh"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const folha = await query<JsonObject>(`SELECT * FROM public.folhas_salarios WHERE id=$1`, [id]);
      if (!folha[0]) return json(res, 404, { error: 'Folha não encontrada.' });

      const profs = await query<JsonObject>(
        `SELECT * FROM public.professores WHERE ativo=true AND "salarioBase" IS NOT NULL AND "salarioBase" > 0 ORDER BY nome`,
        []
      );

      // Delete existing items and rebuild
      await query(`DELETE FROM public.itens_folha WHERE "folhaId"=$1`, [id]);

      let totalBruto = 0, totalLiquido = 0, totalInssEmp = 0, totalInssPatr = 0, totalIrtSum = 0, totalSubs = 0;

      for (const p of profs) {
        const salBase = Number(p.salarioBase ?? 0);
        const subAlim = Number(p.subsidioAlimentacao ?? 0);
        const subTrans = Number(p.subsidioTransporte ?? 0);
        const subHab = Number(p.subsidioHabitacao ?? 0);
        const outrosSubs = Number(b.outrosSubsidios ?? 0);
        const outrosDesc = Number(b.outrosDescontos ?? 0);

        const totalSubsidios = subAlim + subTrans + subHab + outrosSubs;
        const salBruto = salBase + totalSubsidios;

        // INSS: 3% empregado, 8% patronal (Angola)
        const inssEmp = Math.round(salBase * 0.03 * 100) / 100;
        const inssPatr = Math.round(salBase * 0.08 * 100) / 100;

        // IRT: calculado sobre salário base (Angola, subsídios em geral isentos)
        const irt = Math.round(calcularIRT(salBase) * 100) / 100;

        const totalDescontos = inssEmp + irt + outrosDesc;
        const salLiquido = Math.round((salBruto - totalDescontos) * 100) / 100;

        await query(
          `INSERT INTO public.itens_folha
           (id,"folhaId","professorId","professorNome",cargo,categoria,
            "salarioBase","subsidioAlimentacao","subsidioTransporte","subsidioHabitacao","outrosSubsidios","salarioBruto",
            "inssEmpregado","inssPatronal",irt,"outrosDescontos","totalDescontos","salarioLiquido")
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [id, String(p.id), `${p.nome} ${p.apelido}`,
           String(p.cargo ?? 'Professor'), String(p.categoria ?? ''),
           salBase, subAlim, subTrans, subHab, outrosSubs, salBruto,
           inssEmp, inssPatr, irt, outrosDesc, totalDescontos, salLiquido]
        );

        totalBruto += salBruto;
        totalLiquido += salLiquido;
        totalInssEmp += inssEmp;
        totalInssPatr += inssPatr;
        totalIrtSum += irt;
        totalSubs += totalSubsidios;
      }

      const nomeProcBy = String(b.processadaPor ?? 'Sistema');

      const updated = await query<JsonObject>(
        `UPDATE public.folhas_salarios SET
           status='processada',"totalBruto"=$1,"totalLiquido"=$2,"totalInssEmpregado"=$3,
           "totalInssPatronal"=$4,"totalIrt"=$5,"totalSubsidios"=$6,"numFuncionarios"=$7,
           "processadaPor"=$8,"atualizadoEm"=NOW()
         WHERE id=$9 RETURNING *`,
        [Math.round(totalBruto*100)/100, Math.round(totalLiquido*100)/100,
         Math.round(totalInssEmp*100)/100, Math.round(totalInssPatr*100)/100,
         Math.round(totalIrtSum*100)/100, Math.round(totalSubs*100)/100,
         profs.length, nomeProcBy, id]
      );

      json(res, 200, { folha: updated[0], numProcessados: profs.length });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // Update a single payroll item (manual adjustments)
  app.put("/api/itens-folha/:id", requireAuth, requirePermission("rh"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["cargo","categoria","salarioBase","subsidioAlimentacao","subsidioTransporte","subsidioHabitacao","outrosSubsidios","outrosDescontos","observacao"] as const;
      const setParts: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (b[key] === undefined) continue;
        values.push(b[key]);
        setParts.push(`"${key}"=$${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: 'Sem campos para atualizar.' });

      // Recalculate derived fields if salary fields changed
      const item = await query<JsonObject>(`SELECT * FROM public.itens_folha WHERE id=$1`, [id]);
      if (!item[0]) return json(res, 404, { error: 'Item não encontrado.' });

      const salBase = Number(b.salarioBase ?? item[0].salarioBase ?? 0);
      const subAlim = Number(b.subsidioAlimentacao ?? item[0].subsidioAlimentacao ?? 0);
      const subTrans = Number(b.subsidioTransporte ?? item[0].subsidioTransporte ?? 0);
      const subHab = Number(b.subsidioHabitacao ?? item[0].subsidioHabitacao ?? 0);
      const outrosSubs = Number(b.outrosSubsidios ?? item[0].outrosSubsidios ?? 0);
      const outrosDesc = Number(b.outrosDescontos ?? item[0].outrosDescontos ?? 0);

      const salBruto = salBase + subAlim + subTrans + subHab + outrosSubs;
      const inssEmp = Math.round(salBase * 0.03 * 100) / 100;
      const inssPatr = Math.round(salBase * 0.08 * 100) / 100;
      const irt = Math.round(calcularIRT(salBase) * 100) / 100;
      const totalDescontos = inssEmp + irt + outrosDesc;
      const salLiquido = Math.round((salBruto - totalDescontos) * 100) / 100;

      const rows = await query<JsonObject>(
        `UPDATE public.itens_folha SET
           ${setParts.join(',')},
           "salarioBruto"=$${values.length+1},"inssEmpregado"=$${values.length+2},"inssPatronal"=$${values.length+3},
           irt=$${values.length+4},"totalDescontos"=$${values.length+5},"salarioLiquido"=$${values.length+6}
         WHERE id=$${values.length+7} RETURNING *`,
        [...values, salBruto, inssEmp, inssPatr, irt, totalDescontos, salLiquido, id]
      );
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // ─── BIBLIOTECA ESCOLAR ─────────────────────────────────────────────────────
  app.get('/api/livros', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const rows = await query<JsonObject>(`SELECT * FROM public.livros WHERE ativo=true ORDER BY titulo ASC`);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post('/api/livros', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const b = req.body as Record<string, unknown>;
      const rows = await query<JsonObject>(
        `INSERT INTO public.livros (titulo, autor, isbn, categoria, editora, "anoPublicacao", "quantidadeTotal", "quantidadeDisponivel", localizacao, descricao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) RETURNING *`,
        [b.titulo, b.autor, b.isbn || '', b.categoria || 'Geral', b.editora || '', b.anoPublicacao || null,
         b.quantidadeTotal || 1, b.localizacao || '', b.descricao || '']
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put('/api/livros/:id', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const { id } = req.params;
      const b = req.body as Record<string, unknown>;
      const allowed = ['titulo', 'autor', 'isbn', 'categoria', 'editora', 'anoPublicacao', 'quantidadeTotal', 'quantidadeDisponivel', 'localizacao', 'descricao', 'ativo'];
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        if (key in b) { values.push(b[key]); setParts.push(`"${key}"=$${values.length}`); }
      }
      if (!setParts.length) return json(res, 400, { error: 'Sem campos para atualizar.' });
      const rows = await query<JsonObject>(
        `UPDATE public.livros SET ${setParts.join(',')} WHERE id=$${values.length + 1} RETURNING *`,
        [...values, id]
      );
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete('/api/livros/:id', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const { id } = req.params;
      await query(`UPDATE public.livros SET ativo=false WHERE id=$1`, [id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // Emprestimos
  app.get('/api/emprestimos', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const rows = await query<JsonObject>(`SELECT * FROM public.emprestimos ORDER BY "createdAt" DESC`);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post('/api/emprestimos', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const b = req.body as Record<string, unknown>;
      // Check availability
      const livro = await query<JsonObject>(`SELECT * FROM public.livros WHERE id=$1`, [b.livroId]);
      if (!livro[0]) return json(res, 404, { error: 'Livro não encontrado.' });
      if (Number(livro[0].quantidadeDisponivel) < 1) return json(res, 400, { error: 'Livro sem exemplares disponíveis.' });

      const rows = await query<JsonObject>(
        `INSERT INTO public.emprestimos ("livroId", "livroTitulo", "alunoId", "nomeLeitor", "tipoLeitor", "dataEmprestimo", "dataPrevistaDevolucao", status, observacao, "registadoPor")
         VALUES ($1,$2,$3,$4,$5,$6,$7,'emprestado',$8,$9) RETURNING *`,
        [b.livroId, livro[0].titulo, b.alunoId || null, b.nomeLeitor, b.tipoLeitor || 'aluno',
         b.dataEmprestimo, b.dataPrevistaDevolucao, b.observacao || null, b.registadoPor || 'Sistema']
      );
      // Decrement available
      await query(`UPDATE public.livros SET "quantidadeDisponivel"="quantidadeDisponivel"-1 WHERE id=$1`, [b.livroId]);
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put('/api/emprestimos/:id', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const { id } = req.params;
      const b = req.body as Record<string, unknown>;
      const emp = await query<JsonObject>(`SELECT * FROM public.emprestimos WHERE id=$1`, [id]);
      if (!emp[0]) return json(res, 404, { error: 'Empréstimo não encontrado.' });

      const rows = await query<JsonObject>(
        `UPDATE public.emprestimos SET status=$1, "dataDevolucao"=$2, observacao=COALESCE($3, observacao) WHERE id=$4 RETURNING *`,
        [b.status || emp[0].status, b.dataDevolucao || emp[0].dataDevolucao || null, b.observacao || null, id]
      );
      // If returning, increment available
      if (b.status === 'devolvido' && emp[0].status !== 'devolvido') {
        await query(`UPDATE public.livros SET "quantidadeDisponivel"="quantidadeDisponivel"+1 WHERE id=$1`, [emp[0].livroId]);
      }
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // Sync atrasados on read
  app.post('/api/emprestimos/sync-atrasos', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await query(
        `UPDATE public.emprestimos SET status='atrasado' WHERE status='emprestado' AND "dataPrevistaDevolucao" < $1`,
        [today]
      );
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // -----------------------
  // TRANSFERÊNCIAS DE ALUNOS
  // -----------------------

  app.get('/api/transferencias', requireAuth, requirePermission('transferencias'), async (_req, res) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT * FROM public.transferencias ORDER BY criado_em DESC`,
        []
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post('/api/transferencias', requireAuth, requirePermission('transferencias'), async (req, res) => {
    try {
      const b = requireBodyObject(req);
      const { tipo, nomeAluno, alunoId, escolaOrigem, escolaDestino, classeOrigem, classeDestino,
        turmaDestinoId, motivo, observacoes, documentosRecebidos, dataRequisicao, criadoPor } = b as Record<string, unknown>;
      if (!tipo || !nomeAluno) return json(res, 400, { error: 'tipo e nomeAluno são obrigatórios.' });
      const rows = await query<JsonObject>(
        `INSERT INTO public.transferencias (
          tipo, status, "nomeAluno", "alunoId", "escolaOrigem", "escolaDestino",
          "classeOrigem", "classeDestino", "turmaDestinoId", motivo, observacoes,
          "documentosRecebidos", "dataRequisicao", "criadoPor"
        ) VALUES ($1,'pendente',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *`,
        [tipo, nomeAluno, alunoId ?? null, escolaOrigem ?? null, escolaDestino ?? null,
          classeOrigem ?? null, classeDestino ?? null, turmaDestinoId ?? null,
          motivo ?? null, observacoes ?? null,
          JSON.stringify(documentosRecebidos ?? []),
          dataRequisicao ?? new Date().toISOString().slice(0, 10),
          criadoPor ?? null]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.put('/api/transferencias/:id', requireAuth, requirePermission('transferencias'), async (req, res) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { nomeAluno, alunoId, escolaOrigem, escolaDestino, classeOrigem, classeDestino,
        turmaDestinoId, motivo, observacoes, documentosRecebidos, dataRequisicao } = b as Record<string, unknown>;
      const rows = await query<JsonObject>(
        `UPDATE public.transferencias SET
          "nomeAluno"=$1, "alunoId"=$2, "escolaOrigem"=$3, "escolaDestino"=$4,
          "classeOrigem"=$5, "classeDestino"=$6, "turmaDestinoId"=$7,
          motivo=$8, observacoes=$9, "documentosRecebidos"=$10, "dataRequisicao"=$11,
          atualizado_em=NOW()
         WHERE id=$12 RETURNING *`,
        [nomeAluno, alunoId ?? null, escolaOrigem ?? null, escolaDestino ?? null,
          classeOrigem ?? null, classeDestino ?? null, turmaDestinoId ?? null,
          motivo ?? null, observacoes ?? null,
          JSON.stringify(documentosRecebidos ?? []),
          dataRequisicao ?? null, id]
      );
      if (!rows.length) return json(res, 404, { error: 'Transferência não encontrada.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.patch('/api/transferencias/:id/status', requireAuth, requirePermission('transferencias'), async (req, res) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { status } = b as Record<string, unknown>;
      const validStatuses = ['pendente', 'aprovado', 'concluido', 'rejeitado'];
      if (!status || !validStatuses.includes(status as string)) {
        return json(res, 400, { error: `Status inválido. Use: ${validStatuses.join(', ')}` });
      }
      const now = new Date().toISOString().slice(0, 10);
      const rows = await query<JsonObject>(
        `UPDATE public.transferencias SET
          status=$1,
          "dataAprovacao"=CASE WHEN $1='aprovado' THEN $2 ELSE "dataAprovacao" END,
          "dataConclusao"=CASE WHEN $1='concluido' THEN $2 ELSE "dataConclusao" END,
          atualizado_em=NOW()
         WHERE id=$3 RETURNING *`,
        [status, now, id]
      );
      if (!rows.length) return json(res, 404, { error: 'Transferência não encontrada.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.delete('/api/transferencias/:id', requireAuth, requirePermission('transferencias'), async (req, res) => {
    try {
      const { id } = req.params;
      await query(`DELETE FROM public.transferencias WHERE id=$1`, [id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // ─── BOLSAS E DESCONTOS ─────────────────────────────────────────────────────

  app.get('/api/bolsas', requireAuth, async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(`
        SELECT b.*, a.nome, a.apelido, a."numeroMatricula", a."turmaId"
        FROM public.bolsas b
        JOIN public.alunos a ON a.id = b."alunoId"
        ORDER BY b."criadoEm" DESC
      `);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.get('/api/bolsas/aluno/:alunoId', requireAuth, async (req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT * FROM public.bolsas WHERE "alunoId"=$1 ORDER BY "criadoEm" DESC`,
        [req.params.alunoId]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post('/api/bolsas', requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      if (!b.alunoId) return json(res, 400, { error: 'alunoId é obrigatório.' });
      if (b.percentagem === undefined || b.percentagem === null) return json(res, 400, { error: 'percentagem é obrigatória.' });

      const pct = Number(b.percentagem);
      if (isNaN(pct) || pct < 0 || pct > 100) return json(res, 400, { error: 'Percentagem deve ser entre 0 e 100.' });

      const rows = await query<JsonObject>(
        `INSERT INTO public.bolsas
           (id, "alunoId", tipo, percentagem, descricao, "dataInicio", "dataFim", ativo, "aprovadoPor", observacao)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          String(b.alunoId),
          String(b.tipo ?? 'social'),
          pct,
          String(b.descricao ?? ''),
          b.dataInicio ? String(b.dataInicio) : null,
          b.dataFim ? String(b.dataFim) : null,
          b.ativo !== false,
          b.aprovadoPor ? String(b.aprovadoPor) : null,
          b.observacao ? String(b.observacao) : null,
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put('/api/bolsas/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const fields: string[] = [];
      const vals: unknown[] = [];

      const add = (col: string, val: unknown) => { vals.push(val); fields.push(`"${col}"=$${vals.length}`); };

      if (b.tipo !== undefined) add('tipo', String(b.tipo));
      if (b.percentagem !== undefined) add('percentagem', Number(b.percentagem));
      if (b.descricao !== undefined) add('descricao', String(b.descricao));
      if (b.dataInicio !== undefined) add('dataInicio', b.dataInicio ? String(b.dataInicio) : null);
      if (b.dataFim !== undefined) add('dataFim', b.dataFim ? String(b.dataFim) : null);
      if (b.ativo !== undefined) add('ativo', Boolean(b.ativo));
      if (b.aprovadoPor !== undefined) add('aprovadoPor', b.aprovadoPor ? String(b.aprovadoPor) : null);
      if (b.observacao !== undefined) add('observacao', b.observacao ? String(b.observacao) : null);

      if (!fields.length) return json(res, 400, { error: 'Sem campos para atualizar.' });
      add('atualizadoEm', new Date().toISOString());

      vals.push(id);
      const rows = await query<JsonObject>(
        `UPDATE public.bolsas SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`,
        vals
      );
      if (!rows[0]) return json(res, 404, { error: 'Bolsa não encontrada.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete('/api/bolsas/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.bolsas WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // ─── AVALIAÇÃO DE PROFESSORES ─────────────────────────────────────────────

  app.get('/api/avaliacoes-professores', requireAuth, async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(`
        SELECT av.*, p.nome, p.apelido, p."numeroProfessor", p.disciplinas
        FROM public.avaliacoes_professores av
        JOIN public.professores p ON p.id = av."professorId"
        ORDER BY av."criadoEm" DESC
      `);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.get('/api/avaliacoes-professores/professor/:professorId', requireAuth, async (req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT * FROM public.avaliacoes_professores WHERE "professorId"=$1 ORDER BY "criadoEm" DESC`,
        [req.params.professorId]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post('/api/avaliacoes-professores', requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      if (!b.professorId)    return json(res, 400, { error: 'professorId é obrigatório.' });
      if (!b.periodoLetivo)  return json(res, 400, { error: 'periodoLetivo é obrigatório.' });
      if (!b.avaliador)      return json(res, 400, { error: 'avaliador é obrigatório.' });

      const notas = ['notaPlaneamento','notaPontualidade','notaMetodologia','notaRelacaoAlunos',
                     'notaRelacaoColegas','notaResultados','notaDisciplina','notaDesenvolvimento'];
      const vals: number[] = notas.map(k => {
        const v = Number(b[k] ?? 0);
        return (isNaN(v) || v < 0 || v > 5) ? 0 : v;
      });
      const filled = vals.filter(v => v > 0);
      const notaFinal = filled.length > 0
        ? Math.round((filled.reduce((a, b) => a + b, 0) / filled.length) * 100) / 100
        : 0;

      const rows = await query<JsonObject>(`
        INSERT INTO public.avaliacoes_professores
          (id, "professorId", "periodoLetivo", avaliador, "avaliadorId",
           "notaPlaneamento","notaPontualidade","notaMetodologia","notaRelacaoAlunos",
           "notaRelacaoColegas","notaResultados","notaDisciplina","notaDesenvolvimento",
           "notaFinal", status, "pontosFuertes","areasMelhoria","recomendacoes","avaliacaoEm")
        VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING *`,
        [
          String(b.professorId), String(b.periodoLetivo), String(b.avaliador),
          b.avaliadorId ? String(b.avaliadorId) : null,
          ...vals,
          notaFinal,
          String(b.status ?? 'rascunho'),
          String(b.pontosFuertes ?? ''), String(b.areasMelhoria ?? ''), String(b.recomendacoes ?? ''),
          b.status === 'aprovada' || b.status === 'submetida' ? new Date().toISOString() : null,
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put('/api/avaliacoes-professores/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const fields: string[] = [];
      const vals: unknown[] = [];

      const add = (col: string, val: unknown) => { vals.push(val); fields.push(`"${col}"=$${vals.length}`); };

      const notaCols = ['notaPlaneamento','notaPontualidade','notaMetodologia','notaRelacaoAlunos',
                        'notaRelacaoColegas','notaResultados','notaDisciplina','notaDesenvolvimento'];
      let recalc = false;
      for (const k of notaCols) {
        if (b[k] !== undefined) { add(k, Number(b[k])); recalc = true; }
      }
      if (b.periodoLetivo  !== undefined) add('periodoLetivo',  String(b.periodoLetivo));
      if (b.avaliador      !== undefined) add('avaliador',      String(b.avaliador));
      if (b.status         !== undefined) add('status',         String(b.status));
      if (b.pontosFuertes  !== undefined) add('pontosFuertes',  String(b.pontosFuertes));
      if (b.areasMelhoria  !== undefined) add('areasMelhoria',  String(b.areasMelhoria));
      if (b.recomendacoes  !== undefined) add('recomendacoes',  String(b.recomendacoes));

      if (recalc) {
        // Re-fetch existing + merge to compute notaFinal
        const existing = await query<JsonObject>(`SELECT * FROM public.avaliacoes_professores WHERE id=$1`, [id]);
        if (existing[0]) {
          const merged: Record<string, number> = {};
          for (const k of notaCols) {
            merged[k] = b[k] !== undefined ? Number(b[k]) : Number((existing[0] as Record<string, unknown>)[k] ?? 0);
          }
          const filled = Object.values(merged).filter(v => v > 0);
          const nf = filled.length > 0
            ? Math.round((filled.reduce((a, b) => a + b, 0) / filled.length) * 100) / 100
            : 0;
          add('notaFinal', nf);
        }
      }

      if (b.status === 'aprovada' || b.status === 'submetida') add('avaliacaoEm', new Date().toISOString());
      add('atualizadoEm', new Date().toISOString());

      if (fields.length === 1) return json(res, 400, { error: 'Sem campos para actualizar.' });

      vals.push(id);
      const rows = await query<JsonObject>(
        `UPDATE public.avaliacoes_professores SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING *`,
        vals
      );
      if (!rows[0]) return json(res, 404, { error: 'Avaliação não encontrada.' });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete('/api/avaliacoes-professores/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.avaliacoes_professores WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // AUDIT LOGS
  // -----------------------
  app.get("/api/audit-logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.jwtUser!.role;
      const allowedRoles = ["ceo", "pca", "admin", "director", "chefe_secretaria"];
      if (!allowedRoles.includes(role)) {
        return json(res, 403, { error: "Acesso negado. Apenas administradores podem ver o audit log." });
      }

      const {
        page = "1",
        limit = "50",
        acao,
        modulo,
        userId,
        search,
        dataInicio,
        dataFim,
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (acao) { conditions.push(`acao = $${p++}`); params.push(acao); }
      if (modulo) { conditions.push(`modulo = $${p++}`); params.push(modulo); }
      if (userId) { conditions.push(`"userId" = $${p++}`); params.push(userId); }
      if (search) {
        conditions.push(`(descricao ILIKE $${p} OR "userEmail" ILIKE $${p} OR "userName" ILIKE $${p})`);
        params.push(`%${search}%`); p++;
      }
      if (dataInicio) { conditions.push(`"criadoEm" >= $${p++}`); params.push(dataInicio); }
      if (dataFim)    { conditions.push(`"criadoEm" <= $${p++}`); params.push(dataFim); }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countRows = await query<{ total: string }>(
        `SELECT COUNT(*) as total FROM public.audit_logs ${where}`,
        params
      );
      const total = parseInt(countRows[0]?.total ?? "0");

      const rows = await query<JsonObject>(
        `SELECT * FROM public.audit_logs ${where} ORDER BY "criadoEm" DESC LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limitNum, offset]
      );

      json(res, 200, {
        logs: rows,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  app.get("/api/audit-logs/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.jwtUser!.role;
      const allowedRoles = ["ceo", "pca", "admin", "director", "chefe_secretaria"];
      if (!allowedRoles.includes(role)) {
        return json(res, 403, { error: "Acesso negado." });
      }

      const [byAcao, byModulo, recentActivity] = await Promise.all([
        query<{ acao: string; total: string }>(
          `SELECT acao, COUNT(*) as total FROM public.audit_logs GROUP BY acao ORDER BY total DESC`
        ),
        query<{ modulo: string; total: string }>(
          `SELECT modulo, COUNT(*) as total FROM public.audit_logs GROUP BY modulo ORDER BY total DESC LIMIT 10`
        ),
        query<{ dia: string; total: string }>(
          `SELECT DATE("criadoEm") as dia, COUNT(*) as total
           FROM public.audit_logs
           WHERE "criadoEm" >= NOW() - INTERVAL '30 days'
           GROUP BY dia ORDER BY dia`
        ),
      ]);

      json(res, 200, { byAcao, byModulo, recentActivity });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
