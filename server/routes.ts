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

  // ─── DB MIGRATIONS ──────────────────────────────────────────────────────────
  try {
    await query(`ALTER TABLE public.disciplinas ADD COLUMN IF NOT EXISTS componente TEXT NOT NULL DEFAULT ''`, []);
  } catch (migErr) {
    console.warn('[migration] disciplinas componente:', (migErr as Error).message);
  }

  // Add utilizadorId column to professores (links academic profile → user account)
  try {
    await query(`ALTER TABLE public.professores ADD COLUMN IF NOT EXISTS "utilizadorId" varchar`, []);
    console.log('[migration] professores.utilizadorId ensured.');
  } catch (migErr) {
    console.warn('[migration] professores utilizadorId:', (migErr as Error).message);
  }

  // Auto-create professor records for any utilizadores with role='professor' that don't have one yet
  try {
    const orphanUsers = await query<JsonObject>(
      `SELECT u.* FROM public.utilizadores u
       WHERE u.role = 'professor'
         AND NOT EXISTS (SELECT 1 FROM public.professores p WHERE p."utilizadorId" = u.id)`,
      []
    );
    for (const u of orphanUsers) {
      const user = u as any;
      const year = new Date().getFullYear();
      const countRows = await query<JsonObject>(`SELECT COUNT(*) as c FROM public.professores`, []);
      const count = parseInt((countRows[0] as any).c ?? '0') + 1;
      const numeroProfessor = `PROF-${year}-${String(count).padStart(4, '0')}`;
      const { v4: uuidv4 } = await import('uuid');
      const parts = (user.nome as string ?? '').trim().split(/\s+/);
      const nome = parts[0] ?? user.nome ?? '';
      const apelido = parts.slice(1).join(' ') || '';
      await query<JsonObject>(
        `INSERT INTO public.professores (id,"numeroProfessor","nome","apelido","disciplinas","turmasIds","telefone","email","habilitacoes","ativo","utilizadorId","createdAt")
         VALUES ($1,$2,$3,$4,'[]'::jsonb,'[]'::jsonb,$5,$6,'',$7,$8,NOW())`,
        [uuidv4(), numeroProfessor, nome, apelido, '', user.email ?? '', true, user.id]
      );
      console.log(`[migration] Auto-created professor record for user ${user.id} (${user.nome})`);
    }
  } catch (migErr) {
    console.warn('[migration] professor auto-creation:', (migErr as Error).message);
  }
  try {
    await query(`ALTER TABLE public.disciplinas ADD CONSTRAINT disciplinas_nome_unique UNIQUE (nome)`, []);
  } catch {
    // constraint already exists — ignore
  }

  // ── turma_disciplinas: atribuição directa de disciplinas a turmas (Primário / I Ciclo) ──
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public.turma_disciplinas (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "turmaId" varchar NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
        "disciplinaId" varchar NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
        ordem integer NOT NULL DEFAULT 0,
        "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
        UNIQUE("turmaId", "disciplinaId")
      )
    `, []);
    await query(`CREATE INDEX IF NOT EXISTS idx_turma_disc_turma ON public.turma_disciplinas ("turmaId")`, []);
    console.log('[migration] turma_disciplinas ensured.');
  } catch (e) {
    console.warn('[migration] turma_disciplinas:', (e as Error).message);
  }

  // Partial unique indexes for funcionarios — prevent duplicate BI, NIF, telefone, email
  // (empty strings are excluded so legacy/missing values don't conflict)
  for (const [col, idx] of [
    ['bi',       'idx_func_bi_uniq'],
    ['nif',      'idx_func_nif_uniq'],
    ['telefone', 'idx_func_telefone_uniq'],
    ['email',    'idx_func_email_uniq'],
  ] as [string, string][]) {
    try {
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${idx}"
         ON public.funcionarios ("${col}")
         WHERE "${col}" IS NOT NULL AND "${col}" <> ''`,
        []
      );
    } catch {
      // index may already exist with different definition — ignore
    }
  }
  // Seed — Produção Vegetal (idempotent via ON CONFLICT DO NOTHING)
  try {
    await query(`
      INSERT INTO public.disciplinas (nome, codigo, area, descricao, ativo, tipo, "classeInicio", "classeFim", componente) VALUES
        ('Língua Portuguesa','PORT','Línguas e Comunicação','',true,'continuidade','10ª Classe','13ª Classe','Sócio-Cultural'),
        ('Língua Inglesa','ING','Línguas e Comunicação','',true,'continuidade','10ª Classe','13ª Classe','Sócio-Cultural'),
        ('Formação de Atitudes Integradoras','FAI','Ciências Sociais e Humanas','',true,'continuidade','10ª Classe','13ª Classe','Sócio-Cultural'),
        ('Educação Física','EFI','Educação Física','',true,'continuidade','10ª Classe','13ª Classe','Sócio-Cultural'),
        ('Matemática','MAT','Ciências Exactas','',true,'continuidade','10ª Classe','13ª Classe','Científica'),
        ('Biologia','BIO','Ciências Naturais','',true,'continuidade','10ª Classe','13ª Classe','Científica'),
        ('Química','QUI','Ciências Exactas','',true,'continuidade','10ª Classe','13ª Classe','Científica'),
        ('Física','FIS','Ciências Exactas','',true,'continuidade','10ª Classe','13ª Classe','Científica'),
        ('Ecologia e Ambiente','ECO','Ciências Naturais','',true,'continuidade','10ª Classe','13ª Classe','Científica'),
        ('Botânica e Morfologia Vegetal','BOT','Formação Profissional','Produção Vegetal — 10ª Classe',true,'terminal','10ª Classe','10ª Classe','Técnica, Tecnológica e Prática'),
        ('Ciência do Solo / Edafologia','CSE','Formação Profissional','Produção Vegetal — 10ª Classe',true,'terminal','10ª Classe','10ª Classe','Técnica, Tecnológica e Prática'),
        ('Climatologia e Agrometeorologia','CLM','Formação Profissional','Produção Vegetal — 10ª Classe',true,'terminal','10ª Classe','10ª Classe','Técnica, Tecnológica e Prática'),
        ('Topografia Agrícola','TOP','Formação Profissional','Produção Vegetal — 10ª Classe',true,'terminal','10ª Classe','10ª Classe','Técnica, Tecnológica e Prática'),
        ('Informática Aplicada','INF','Tecnologia e Informática','Produção Vegetal — 10ª Classe',true,'terminal','10ª Classe','10ª Classe','Técnica, Tecnológica e Prática'),
        ('Empreendedorismo','EMP','Ciências Sociais e Humanas','Produção Vegetal — 10ª Classe',true,'terminal','10ª Classe','10ª Classe','Técnica, Tecnológica e Prática'),
        ('Fisiologia Vegetal','FVG','Formação Profissional','Produção Vegetal — 11ª Classe',true,'terminal','11ª Classe','11ª Classe','Técnica, Tecnológica e Prática'),
        ('Fitotecnia (Culturas Anuais)','FIT','Formação Profissional','Produção Vegetal — 11ª Classe',true,'terminal','11ª Classe','11ª Classe','Técnica, Tecnológica e Prática'),
        ('Propagação e Multiplicação de Plantas','PMP','Formação Profissional','Produção Vegetal — 11ª Classe',true,'terminal','11ª Classe','11ª Classe','Técnica, Tecnológica e Prática'),
        ('Fitopatologia e Entomologia (Defesa Sanitária)','FPE','Formação Profissional','Produção Vegetal — 11ª Classe',true,'terminal','11ª Classe','11ª Classe','Técnica, Tecnológica e Prática'),
        ('Horticultura / Olericultura','HOR','Formação Profissional','Produção Vegetal — 11ª Classe',true,'terminal','11ª Classe','11ª Classe','Técnica, Tecnológica e Prática'),
        ('Irrigação e Drenagem','IRD','Formação Profissional','Produção Vegetal — 11ª Classe',true,'terminal','11ª Classe','11ª Classe','Técnica, Tecnológica e Prática'),
        ('Fruticultura','FRU','Formação Profissional','Produção Vegetal — 12ª Classe',true,'terminal','12ª Classe','12ª Classe','Técnica, Tecnológica e Prática'),
        ('Tecnologia Pós-Colheita e Armazenamento','TPC','Formação Profissional','Produção Vegetal — 12ª Classe',true,'terminal','12ª Classe','12ª Classe','Técnica, Tecnológica e Prática'),
        ('Mecanização Agrícola','MEC','Formação Profissional','Produção Vegetal — 12ª Classe',true,'terminal','12ª Classe','12ª Classe','Técnica, Tecnológica e Prática'),
        ('Gestão e Economia Agrária','GEA','Ciências Sociais e Humanas','Produção Vegetal — 12ª Classe',true,'terminal','12ª Classe','12ª Classe','Técnica, Tecnológica e Prática'),
        ('Organização da Exploração Agrícola','OEA','Formação Profissional','Produção Vegetal — 12ª Classe',true,'terminal','12ª Classe','12ª Classe','Técnica, Tecnológica e Prática'),
        ('Extensão Rural','EXR','Formação Profissional','Produção Vegetal — 12ª Classe',true,'terminal','12ª Classe','12ª Classe','Técnica, Tecnológica e Prática'),
        ('Trabalho de Campo e Oficina','TCO','Formação Profissional','Disciplina prática: ensaios de culturas (tomate, feijão) e trabalhos na exploração agropecuária do ISTM',true,'terminal','12ª Classe','12ª Classe','Técnica, Tecnológica e Prática'),
        ('Prova de Aptidão Profissional (PAP)','PAP','Formação Profissional','Projecto prático desenvolvido no campo experimental do ISTM pelos alunos finalistas',true,'terminal','13ª Classe','13ª Classe','Técnica, Tecnológica e Prática'),
        ('Estágio Curricular Supervisionado','ECS','Formação Profissional','Estágio em fazendas parceiras da região, como a Fazenda Pungo Andongo',true,'terminal','13ª Classe','13ª Classe','Técnica, Tecnológica e Prática')
      ON CONFLICT (nome) DO NOTHING
    `, []);
    console.log('[seed] Produção Vegetal disciplines seeded successfully.');
  } catch (seedErr) {
    console.warn('[seed] disciplinas seed warning:', (seedErr as Error).message);
  }
  // ── Payroll tables ────────────────────────────────────────────────────────
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public.folhas_salarios (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        mes integer NOT NULL,
        ano integer NOT NULL,
        descricao text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'rascunho',
        "totalBruto" numeric NOT NULL DEFAULT 0,
        "totalLiquido" numeric NOT NULL DEFAULT 0,
        "totalInssEmpregado" numeric NOT NULL DEFAULT 0,
        "totalInssPatronal" numeric NOT NULL DEFAULT 0,
        "totalIrt" numeric NOT NULL DEFAULT 0,
        "totalSubsidios" numeric NOT NULL DEFAULT 0,
        "numFuncionarios" integer NOT NULL DEFAULT 0,
        "processadaPor" text,
        observacoes text,
        "criadoEm" timestamp with time zone NOT NULL DEFAULT now(),
        "atualizadoEm" timestamp with time zone NOT NULL DEFAULT now()
      )
    `, []);
    await query(`
      CREATE TABLE IF NOT EXISTS public.itens_folha (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "folhaId" varchar NOT NULL REFERENCES public.folhas_salarios(id) ON DELETE CASCADE,
        "professorId" varchar NOT NULL,
        "professorNome" text NOT NULL,
        cargo text NOT NULL DEFAULT '',
        categoria text NOT NULL DEFAULT '',
        "salarioBase" numeric NOT NULL DEFAULT 0,
        "subsidioAlimentacao" numeric NOT NULL DEFAULT 0,
        "subsidioTransporte" numeric NOT NULL DEFAULT 0,
        "subsidioHabitacao" numeric NOT NULL DEFAULT 0,
        "outrosSubsidios" numeric NOT NULL DEFAULT 0,
        "salarioBruto" numeric NOT NULL DEFAULT 0,
        "inssEmpregado" numeric NOT NULL DEFAULT 0,
        "inssPatronal" numeric NOT NULL DEFAULT 0,
        irt numeric NOT NULL DEFAULT 0,
        "descontoFaltas" numeric NOT NULL DEFAULT 0,
        "numFaltasInj" integer NOT NULL DEFAULT 0,
        "numMeioDia" integer NOT NULL DEFAULT 0,
        "remuneracaoTempos" numeric NOT NULL DEFAULT 0,
        "numTempos" numeric NOT NULL DEFAULT 0,
        "outrosDescontos" numeric NOT NULL DEFAULT 0,
        "totalDescontos" numeric NOT NULL DEFAULT 0,
        "salarioLiquido" numeric NOT NULL DEFAULT 0,
        "tipoFuncionario" text NOT NULL DEFAULT 'funcionario',
        departamento text NOT NULL DEFAULT '',
        seccao text NOT NULL DEFAULT '',
        observacao text
      )
    `, []);
    console.log('[migration] payroll tables ensured.');
  } catch (migErr) {
    console.warn('[migration] payroll migration warning:', (migErr as Error).message);
  }

  try {
    await query(`ALTER TABLE public.livros ADD COLUMN IF NOT EXISTS "capaUrl" text NOT NULL DEFAULT ''`, []);
    await query(`
      CREATE TABLE IF NOT EXISTS public.solicitacoes_emprestimo (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "livroId" varchar NOT NULL,
        "livroTitulo" text NOT NULL,
        "alunoId" varchar,
        "nomeLeitor" text NOT NULL,
        "tipoLeitor" text NOT NULL DEFAULT 'aluno',
        "diasSolicitados" integer NOT NULL DEFAULT 14,
        status text NOT NULL DEFAULT 'pendente',
        "motivoRejeicao" text,
        "registadoPor" text NOT NULL DEFAULT 'Sistema',
        "createdAt" timestamp with time zone NOT NULL DEFAULT now()
      )
    `, []);
  } catch (migErr) {
    console.warn('[migration] biblioteca migration warning:', (migErr as Error).message);
  }

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
      const hardcodedByEmail = HARDCODED_ACCOUNTS.find(a => a.email.toLowerCase() === email);
      if (hardcodedByEmail) {
        if (hardcodedByEmail.senha !== senha) {
          logAudit({
            userId: "unknown", userEmail: email, userRole: "desconhecido",
            acao: "login_falhado", modulo: "Autenticação", descricao: `Senha incorrecta para conta fixa: ${email}`,
            ipAddress: ip, userAgent: ua,
          }).catch(() => {});
          return json(res, 401, { error: "Senha incorrecta. Verifique a sua senha de acesso.", field: "senha" });
        }
        const token = signToken({ userId: hardcodedByEmail.id, role: hardcodedByEmail.role, email: hardcodedByEmail.email });
        logAudit({
          userId: hardcodedByEmail.id, userEmail: hardcodedByEmail.email, userRole: hardcodedByEmail.role, userName: hardcodedByEmail.nome,
          acao: "login", modulo: "Autenticação", descricao: `Login bem-sucedido: ${hardcodedByEmail.email}`,
          ipAddress: ip, userAgent: ua,
        }).catch(() => {});
        return json(res, 200, {
          token,
          user: { id: hardcodedByEmail.id, nome: hardcodedByEmail.nome, email: hardcodedByEmail.email, role: hardcodedByEmail.role, escola: hardcodedByEmail.escola },
        });
      }

      // Verificar na base de dados — primeiro só pelo email
      const emailRows = await query<JsonObject>(
        `SELECT * FROM public.utilizadores WHERE LOWER(email)=LOWER($1) AND ativo=true LIMIT 1`,
        [email]
      );
      if (!emailRows[0]) {
        logAudit({
          userId: "unknown", userEmail: email, userRole: "desconhecido",
          acao: "login_falhado", modulo: "Autenticação", descricao: `Email não encontrado: ${email}`,
          ipAddress: ip, userAgent: ua,
        }).catch(() => {});
        return json(res, 401, { error: "Email não encontrado. Verifique o endereço de email.", field: "email" });
      }
      // Email existe — verificar senha
      if (emailRows[0].senha !== senha) {
        logAudit({
          userId: String(emailRows[0].id), userEmail: email, userRole: "desconhecido",
          acao: "login_falhado", modulo: "Autenticação", descricao: `Senha incorrecta para: ${email}`,
          ipAddress: ip, userAgent: ua,
        }).catch(() => {});
        return json(res, 401, { error: "Senha incorrecta. Verifique a sua senha de acesso.", field: "senha" });
      }
      const rows = emailRows;
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
        "falecido",
        "dataFalecimento",
        "observacoesFalecimento",
        "registadoFalecimentoPor",
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

  // Alunos sem turma atribuída (para organização pela secretaria)
  app.get("/api/alunos/sem-turma", requireAuth, async (req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT a.*, r.classe, r."cursoId", c.nome AS "cursoNome", r.nivel
         FROM public.alunos a
         LEFT JOIN public.registros r ON r."nomeCompleto" ILIKE (a.nome || ' ' || a.apelido)
           AND r.status IN ('matriculado', 'admitido')
         LEFT JOIN public.cursos c ON c.id = r."cursoId"
         WHERE a."turmaId" IS NULL AND a.ativo = true
         ORDER BY a.nome, a.apelido`,
        []
      );
      json(res, 200, rows);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // Atribuição em massa de turmas a alunos (pela secretaria)
  app.post("/api/alunos/atribuir-turmas", requireAuth, async (req: Request, res: Response) => {
    try {
      const rolesPermitidas = ['chefe_secretaria', 'secretaria', 'admin', 'director', 'ceo', 'pca'];
      const role = req.jwtUser?.role || '';
      if (!rolesPermitidas.includes(role)) {
        return json(res, 403, { error: 'Sem permissão. Apenas secretaria ou superiores podem organizar turmas.' });
      }
      const b = requireBodyObject(req) as any;
      const atribuicoes: { alunoId: string; turmaId: string }[] = b.atribuicoes || [];
      if (!atribuicoes.length) return json(res, 400, { error: 'Nenhuma atribuição fornecida.' });

      let actualizados = 0;
      for (const { alunoId, turmaId } of atribuicoes) {
        if (!alunoId || !turmaId) continue;
        await query(
          `UPDATE public.alunos SET "turmaId" = $1 WHERE id = $2`,
          [turmaId, alunoId]
        );
        actualizados++;
      }
      json(res, 200, { success: true, actualizados });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // Registo de Falecimento — exclusivo para chefe_secretaria, admin, director, ceo, pca
  app.post("/api/alunos/:id/registar-falecimento", requireAuth, async (req: Request, res: Response) => {
    try {
      const rolesPermitidas = ['chefe_secretaria', 'admin', 'director', 'ceo', 'pca'];
      const role = req.jwtUser?.role || '';
      if (!rolesPermitidas.includes(role)) {
        return json(res, 403, { error: 'Sem permissão. Apenas o Chefe de Secretaria ou superiores podem registar falecimentos.' });
      }
      const { id } = req.params;
      const b = requireBodyObject(req);
      const registadoPor = (b as any).registadoPor || req.jwtUser?.email || 'Sistema';
      const dataFalecimento = (b as any).dataFalecimento || null;
      const observacoes = (b as any).observacoes || null;

      // Verificar se o aluno existe
      const aluno = await query<JsonObject>(`SELECT id, nome, apelido, falecido FROM public.alunos WHERE id = $1`, [id]);
      if (!aluno[0]) return json(res, 404, { error: 'Aluno não encontrado.' });
      if ((aluno[0] as any).falecido) return json(res, 400, { error: 'Este aluno já está registado como falecido.' });

      // Arquivar: falecido=true, bloqueado=true, ativo=false
      const rows = await query<JsonObject>(
        `UPDATE public.alunos SET
          "falecido" = true,
          "bloqueado" = true,
          "ativo" = false,
          "dataFalecimento" = $1,
          "observacoesFalecimento" = $2,
          "registadoFalecimentoPor" = $3
        WHERE id = $4 RETURNING *`,
        [dataFalecimento, observacoes, registadoPor, id],
      );
      if (!rows[0]) return json(res, 404, { error: 'Não foi possível actualizar o registo.' });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
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
        "nivelEnsino",
        // Payroll fields
        "cargo",
        "categoria",
        "salarioBase",
        "subsidioAlimentacao",
        "subsidioTransporte",
        "subsidioHabitacao",
        "dataContratacao",
        "tipoContrato",
        "valorPorTempoLectivo",
        "temposSemanais",
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

  // ─── Permissões automáticas do Director de Turma ─────────────────────────────
  const DIRECTOR_TURMA_PERMS = [
    // Base professor
    'professor_hub', 'professor_turmas', 'professor_pauta', 'professor_sumario',
    'professor_mensagens', 'professor_materiais',
    'biblioteca', 'quadro_honra', 'trabalhos_finais', 'plano_aula',
    'horario', 'notificacoes', 'chat_interno', 'eventos',
    // Extra por ser Director de Turma
    'alunos', 'presencas', 'notas', 'exclusoes_faltas',
    'pedagogico', 'editor_documentos', 'relatorios', 'boletim_matricula',
    'turmas', 'salas',
  ];
  const DIRECTOR_TURMA_EXTRA_PERMS = [
    'alunos', 'presencas', 'notas', 'exclusoes_faltas',
    'pedagogico', 'editor_documentos', 'relatorios', 'boletim_matricula',
    'turmas', 'salas',
  ];

  async function atribuirPermissoesDirector(professorId: string) {
    try {
      const profRows = await query<JsonObject>(
        `SELECT "utilizadorId" FROM public.professores WHERE id=$1`, [professorId]
      );
      const utilizadorId = profRows[0]?.utilizadorId as string | null;
      if (!utilizadorId) return;
      const permRows = await query<JsonObject>(
        `SELECT permissoes FROM public.user_permissions WHERE user_id=$1`, [utilizadorId]
      );
      const current = (permRows[0]?.permissoes as Record<string, boolean>) || {};
      const merged: Record<string, boolean> = { ...current };
      for (const p of DIRECTOR_TURMA_PERMS) merged[p] = true;
      await query(
        `INSERT INTO public.user_permissions (id, user_id, permissoes, atualizado_em)
         VALUES (gen_random_uuid(),$1,$2::jsonb,NOW())
         ON CONFLICT (user_id) DO UPDATE SET permissoes=$2::jsonb, atualizado_em=NOW()`,
        [utilizadorId, JSON.stringify(merged)]
      );
    } catch { /* non-critical */ }
  }

  async function revogarPermissoesDirector(professorId: string) {
    try {
      // Only revoke if no longer director of ANY turma
      const still = await query<JsonObject>(
        `SELECT id FROM public.turmas WHERE "professorId"=$1 LIMIT 1`, [professorId]
      );
      if (still.length > 0) return;
      const profRows = await query<JsonObject>(
        `SELECT "utilizadorId" FROM public.professores WHERE id=$1`, [professorId]
      );
      const utilizadorId = profRows[0]?.utilizadorId as string | null;
      if (!utilizadorId) return;
      const permRows = await query<JsonObject>(
        `SELECT permissoes FROM public.user_permissions WHERE user_id=$1`, [utilizadorId]
      );
      if (!permRows[0]) return;
      const current = (permRows[0].permissoes as Record<string, boolean>) || {};
      const updated: Record<string, boolean> = { ...current };
      for (const p of DIRECTOR_TURMA_EXTRA_PERMS) updated[p] = false;
      await query(
        `UPDATE public.user_permissions SET permissoes=$1::jsonb, atualizado_em=NOW() WHERE user_id=$2`,
        [JSON.stringify(updated), utilizadorId]
      );
    } catch { /* non-critical */ }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  app.post("/api/turmas", requireAuth, requirePermission("turmas"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      if (!b.professorId) return json(res, 400, { error: 'O Director de Turma é obrigatório.' });
      const rows = await query<JsonObject>(
        `INSERT INTO public.turmas (
          id, "nome", "classe", "turno", "anoLetivo", "nivel",
          "professorId", "professoresIds", "sala", "capacidade", "ativo", "cursoId"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12
        ) RETURNING *`,
        [
          b.id,
          b.nome,
          b.classe,
          b.turno,
          b.anoLetivo,
          b.nivel,
          b.professorId,
          JSON.stringify(Array.isArray(b.professoresIds) ? b.professoresIds : []),
          b.sala,
          b.capacidade,
          b.ativo,
          b.cursoId ?? null,
        ],
      );
      // Atribuir permissões ao Director de Turma
      await atribuirPermissoesDirector(b.professorId as string);
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/turmas/:id", requireAuth, requirePermission("turmas"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      // Fetch existing turma to compare director
      const existing = await query<JsonObject>(
        `SELECT "professorId" FROM public.turmas WHERE id=$1`, [id]
      );
      if (!existing[0]) return json(res, 404, { error: "Turma não encontrada." });
      const oldProfessorId = existing[0].professorId as string | null;

      // If professorId is being updated, it cannot be cleared
      if ('professorId' in b && (!b.professorId || b.professorId === '')) {
        return json(res, 400, { error: 'O Director de Turma é obrigatório. Uma turma não pode ficar sem Director.' });
      }

      const allowed = [
        "nome",
        "classe",
        "turno",
        "anoLetivo",
        "nivel",
        "professorId",
        "professoresIds",
        "sala",
        "capacidade",
        "ativo",
        "cursoId",
      ] as const;

      const jsonbKeys = new Set(["professoresIds"]);
      const setParts: string[] = [];
      const values: unknown[] = [];

      for (const key of allowed) {
        const v = b[key as keyof typeof b];
        if (v === undefined) continue;
        if (jsonbKeys.has(key)) {
          values.push(JSON.stringify(Array.isArray(v) ? v : []));
          setParts.push(`"${key}" = $${values.length}::jsonb`);
          continue;
        }
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

      // Handle permission changes when director changes
      const newProfessorId = (rows[0].professorId as string | null) || null;
      if (newProfessorId && newProfessorId !== oldProfessorId) {
        // Assign permissions to the new director
        await atribuirPermissoesDirector(newProfessorId);
        // Revoke from old director if changed
        if (oldProfessorId && oldProfessorId !== newProfessorId) {
          await revogarPermissoesDirector(oldProfessorId);
        }
      }

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
      const AVAL_KEYS = ['aval1','aval2','aval3','aval4','aval5','aval6','aval7','aval8'] as const;
      for (const k of AVAL_KEYS) {
        const v = Number(b[k] ?? 0);
        if (v > 5) return json(res, 400, { error: `O campo ${k} não pode ser superior a 5. Escala das avaliações contínuas: 1–5.` });
      }
      if (Number(b.pp1 ?? 0) > 20 || Number(b.ppt ?? 0) > 20) {
        return json(res, 400, { error: 'PP e PT não podem ser superiores a 20. Escala: 0–20.' });
      }
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
        "camposAbertos",
        "pedidosReabertura",
      ] as const;

      const jsonbKeys = new Set(["lancamentos", "camposAbertos", "pedidosReabertura"]);
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

  // Solicitar reabertura de campo bloqueado numa nota (qualquer professor autenticado)
  app.post("/api/notas/:id/solicitar-reabertura", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { campo, motivo, professorId, professorNome } = b as any;
      if (!campo || !motivo) return json(res, 400, { error: 'campo e motivo são obrigatórios.' });

      const existing = await query<JsonObject>(`SELECT "pedidosReabertura" FROM public.notas WHERE id=$1`, [id]);
      if (!existing[0]) return json(res, 404, { error: 'Nota não encontrada.' });

      const pedidos: any[] = (existing[0].pedidosReabertura as any[]) ?? [];
      const pendente = pedidos.find((p: any) => p.campo === campo && p.status === 'pendente');
      if (pendente) return json(res, 409, { error: 'Já existe um pedido pendente para este campo.' });

      const novoPedido = {
        id: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        campo,
        motivo,
        professorId: professorId || null,
        professorNome: professorNome || null,
        status: 'pendente',
        criadoEm: new Date().toISOString(),
        respondidoEm: null,
        observacao: null,
      };
      pedidos.push(novoPedido);

      const rows = await query<JsonObject>(
        `UPDATE public.notas SET "pedidosReabertura"=$1::jsonb WHERE id=$2 RETURNING *`,
        [jsonbParam(pedidos), id],
      );
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // Responder a pedido de reabertura (privilegiado: admin, director, pca, ceo, chefe_secretaria)
  app.put("/api/notas/:id/responder-reabertura", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { role: string };
      const PRIV = ['ceo','pca','admin','director','chefe_secretaria'];
      if (!user || !PRIV.includes(user.role)) return json(res, 403, { error: 'Sem permissão.' });

      const { id } = req.params;
      const b = requireBodyObject(req);
      const { pedidoId, decisao, observacao } = b as any; // decisao: 'aprovada' | 'rejeitada'
      if (!pedidoId || !decisao) return json(res, 400, { error: 'pedidoId e decisao são obrigatórios.' });

      const existing = await query<JsonObject>(
        `SELECT "pedidosReabertura","camposAbertos","lancamentos" FROM public.notas WHERE id=$1`, [id]
      );
      if (!existing[0]) return json(res, 404, { error: 'Nota não encontrada.' });

      const pedidos: any[] = (existing[0].pedidosReabertura as any[]) ?? [];
      const pedido = pedidos.find((p: any) => p.id === pedidoId);
      if (!pedido) return json(res, 404, { error: 'Pedido não encontrado.' });

      pedido.status = decisao;
      pedido.respondidoEm = new Date().toISOString();
      pedido.observacao = observacao ?? null;

      const camposAbertos: string[] = (existing[0].camposAbertos as string[]) ?? [];
      if (decisao === 'aprovada' && !camposAbertos.includes(pedido.campo)) {
        camposAbertos.push(pedido.campo);
      }

      // Also clear lancamento flag for approved campo so value can be re-entered
      let lancamentos: any = existing[0].lancamentos ?? {};
      if (decisao === 'aprovada' && pedido.campo in lancamentos) {
        lancamentos = { ...lancamentos, [pedido.campo]: false };
      }

      const rows = await query<JsonObject>(
        `UPDATE public.notas SET "pedidosReabertura"=$1::jsonb,"camposAbertos"=$2::jsonb,"lancamentos"=$3::jsonb WHERE id=$4 RETURNING *`,
        [jsonbParam(pedidos), jsonbParam(camposAbertos), jsonbParam(lancamentos), id],
      );
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // Listar notas com pedidos de reabertura pendentes (privilegiado)
  app.get("/api/notas/reabertura-pendentes", requireAuth, async (req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT n.*, a.nome as "alunoNome", a.apelido as "alunoApelido", t.nome as "turmaNome"
         FROM public.notas n
         LEFT JOIN public.alunos a ON a.id = n."alunoId"
         LEFT JOIN public.turmas t ON t.id = n."turmaId"
         WHERE n."pedidosReabertura"::text != '[]' AND n."pedidosReabertura"::text != 'null'
         AND n."pedidosReabertura"::jsonb @> '[{"status":"pendente"}]'
         ORDER BY n."data" DESC`,
        []
      );
      json(res, 200, rows);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
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
      const newUser = rows[0] as any;

      // Auto-create academic professor record when role is 'professor'
      if (newUser && newUser.role === 'professor') {
        try {
          const year = new Date().getFullYear();
          const countRows = await query<JsonObject>(`SELECT COUNT(*) as c FROM public.professores`, []);
          const count = parseInt((countRows[0] as any).c ?? '0') + 1;
          const numeroProfessor = `PROF-${year}-${String(count).padStart(4, '0')}`;
          const { v4: uuidv4 } = await import('uuid');
          const parts = ((newUser.nome as string) ?? '').trim().split(/\s+/);
          const nomeParts = parts[0] ?? newUser.nome ?? '';
          const apelidoParts = parts.slice(1).join(' ') || '';
          await query<JsonObject>(
            `INSERT INTO public.professores (id,"numeroProfessor","nome","apelido","disciplinas","turmasIds","telefone","email","habilitacoes","ativo","utilizadorId","createdAt")
             VALUES ($1,$2,$3,$4,'[]'::jsonb,'[]'::jsonb,'',$5,'',$6,$7,NOW())`,
            [uuidv4(), numeroProfessor, nomeParts, apelidoParts, newUser.email ?? '', true, newUser.id]
          );
        } catch (profErr) {
          console.warn('[utilizadores] auto-create professor record failed:', (profErr as Error).message);
        }
      }

      json(res, 201, newUser);
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
      const allowed = ["nome","email","senha","role","escola","ativo","alunoId","departamento","cargo"] as const;
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

  // Helper: verifica unicidade de BI/NIF/telefone/email em funcionarios antes de INSERT/UPDATE
  async function checkFuncionarioDuplicados(
    fields: { bi?: string; nif?: string; telefone?: string; email?: string },
    excludeId?: string
  ): Promise<string | null> {
    const checks: { col: string; val: string; label: string }[] = [
      { col: 'bi',       val: fields.bi       ?? '', label: 'Bilhete de Identidade' },
      { col: 'nif',      val: fields.nif      ?? '', label: 'NIF'                  },
      { col: 'telefone', val: fields.telefone ?? '', label: 'Telefone'              },
      { col: 'email',    val: fields.email    ?? '', label: 'Email'                 },
    ];
    for (const { col, val, label } of checks) {
      if (!val || val.trim() === '') continue;
      const rows = excludeId
        ? await query<JsonObject>(`SELECT id FROM public.funcionarios WHERE "${col}"=$1 AND id<>$2 LIMIT 1`, [val.trim(), excludeId])
        : await query<JsonObject>(`SELECT id FROM public.funcionarios WHERE "${col}"=$1 LIMIT 1`, [val.trim()]);
      if (rows.length > 0) return `Já existe um funcionário registado com este ${label}.`;
    }
    return null;
  }

  // -----------------------
  // FUNCIONÁRIOS — Registo Central de Pessoal
  // -----------------------
  app.get("/api/funcionarios", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    const { departamento, ativo } = req.query as Record<string, string>;
    let sql = `SELECT * FROM public.funcionarios WHERE 1=1`;
    const params: unknown[] = [];
    if (departamento) { params.push(departamento); sql += ` AND departamento=$${params.length}`; }
    if (ativo !== undefined) { params.push(ativo === 'true'); sql += ` AND ativo=$${params.length}`; }
    sql += ` ORDER BY "createdAt" DESC`;
    const rows = await query<JsonObject>(sql, params);
    json(res, 200, rows);
  });

  app.get("/api/funcionarios/:id", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.funcionarios WHERE id=$1`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Funcionário não encontrado." });
    json(res, 200, rows[0]);
  });

  app.post("/api/funcionarios", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const dupErr = await checkFuncionarioDuplicados({ bi: b.bi, nif: b.nif, telefone: b.telefone, email: b.email });
      if (dupErr) return json(res, 409, { error: dupErr });
      const rows = await query<JsonObject>(
        `INSERT INTO public.funcionarios (
          id, nome, apelido, "dataNascimento", genero, bi, nif, telefone, email, foto,
          provincia, municipio, morada, departamento, seccao, cargo, especialidade,
          "tipoContrato", "dataContratacao", "dataFimContrato", habilitacoes,
          "salarioBase", "subsidioAlimentacao", "subsidioTransporte", "subsidioHabitacao", "outrosSubsidios", subsidios,
          "utilizadorId", "professorId", ativo, observacoes, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,$15,$16,
          $17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,
          $27,$28,$29,$30,NOW(),NOW()
        ) RETURNING *`,
        [
          b.nome, b.apelido ?? '', b.dataNascimento ?? '', b.genero ?? '', b.bi ?? '', b.nif ?? '',
          b.telefone ?? '', b.email ?? '', b.foto ?? null,
          b.provincia ?? '', b.municipio ?? '', b.morada ?? '',
          b.departamento, b.seccao ?? '', b.cargo, b.especialidade ?? '',
          b.tipoContrato ?? 'efectivo', b.dataContratacao ?? '', b.dataFimContrato ?? null, b.habilitacoes ?? '',
          b.salarioBase ?? 0, b.subsidioAlimentacao ?? 0, b.subsidioTransporte ?? 0, b.subsidioHabitacao ?? 0, b.outrosSubsidios ?? 0,
          JSON.stringify(b.subsidios ?? []),
          b.utilizadorId ?? null, b.professorId ?? null, b.ativo ?? true, b.observacoes ?? '',
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/funcionarios/:id", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const dupErr = await checkFuncionarioDuplicados({ bi: b.bi, nif: b.nif, telefone: b.telefone, email: b.email }, id);
      if (dupErr) return json(res, 409, { error: dupErr });
      const allowed = [
        "nome","apelido","dataNascimento","genero","bi","nif","telefone","email","foto",
        "provincia","municipio","morada","departamento","seccao","cargo","especialidade",
        "tipoContrato","dataContratacao","dataFimContrato","habilitacoes",
        "salarioBase","subsidioAlimentacao","subsidioTransporte","subsidioHabitacao","outrosSubsidios","subsidios",
        "valorPorTempoLectivo","temposSemanais",
        "utilizadorId","professorId","ativo","observacoes",
      ] as const;
      const JSONB_FIELDS = new Set(["subsidios"]);
      const setParts: string[] = []; const values: unknown[] = [];
      for (const key of allowed) {
        const v = b[key]; if (v === undefined) continue;
        const serialized = JSONB_FIELDS.has(key) ? JSON.stringify(v) : v;
        values.push(serialized); setParts.push(`"${key}" = $${values.length}`);
      }
      if (!setParts.length) return json(res, 400, { error: "No fields." });
      values.push(new Date().toISOString()); setParts.push(`"updatedAt" = $${values.length}`);
      const rows = await query<JsonObject>(
        `UPDATE public.funcionarios SET ${setParts.join(",")} WHERE id=$${values.length+1} RETURNING *`,
        [...values, id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/funcionarios/:id", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.funcionarios WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // Ligar funcionário a utilizador do sistema
  app.post("/api/funcionarios/:id/criar-acesso", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      // b.email, b.senha (hashed), b.role
      const funcRows = await query<JsonObject>(`SELECT * FROM public.funcionarios WHERE id=$1`, [id]);
      if (!funcRows[0]) return json(res, 404, { error: "Funcionário não encontrado." });
      const func = funcRows[0] as any;

      const bcrypt = await import('bcrypt');
      const senhaHash = await bcrypt.hash(b.senha as string, 10);

      const userRows = await query<JsonObject>(
        `INSERT INTO public.utilizadores (id,nome,email,senha,role,escola,ativo,departamento,cargo,"criadoEm")
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,true,$6,$7,NOW()) RETURNING *`,
        [func.nome + ' ' + func.apelido, b.email || func.email, senhaHash, b.role || func.cargo, b.escola ?? '', func.departamento, func.cargo]
      );
      const newUser = userRows[0] as any;

      // Link the funcionario to this user
      await query(`UPDATE public.funcionarios SET "utilizadorId"=$1,"updatedAt"=NOW() WHERE id=$2`, [newUser.id, id]);
      json(res, 201, { utilizador: newUser });
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  // Atribuir funcionário como professor no módulo pedagógico
  app.post("/api/funcionarios/:id/atribuir-professor", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const funcRows = await query<JsonObject>(`SELECT * FROM public.funcionarios WHERE id=$1`, [id]);
      if (!funcRows[0]) return json(res, 404, { error: "Funcionário não encontrado." });
      const func = funcRows[0] as any;

      // If already linked, return existing professor record
      if (func.professorId) {
        const profRows = await query<JsonObject>(`SELECT * FROM public.professores WHERE id=$1`, [func.professorId]);
        if (profRows[0]) return json(res, 200, { professor: profRows[0], already: true });
      }

      // Generate numeroProfessor
      const year = new Date().getFullYear();
      const countRows = await query<JsonObject>(`SELECT COUNT(*) as c FROM public.professores`, []);
      const count = parseInt((countRows[0] as any).c ?? '0') + 1;
      const numeroProfessor = `PROF-${year}-${String(count).padStart(4, '0')}`;

      // Create professores record
      const { v4: uuidv4 } = await import('uuid');
      const profId = uuidv4();
      const profRows = await query<JsonObject>(
        `INSERT INTO public.professores (id,"numeroProfessor","nome","apelido","disciplinas","turmasIds","telefone","email","habilitacoes","ativo","createdAt")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,NOW()) RETURNING *`,
        [
          profId,
          numeroProfessor,
          func.nome,
          func.apelido,
          '[]',
          '[]',
          func.telefone || '',
          func.email || '',
          b.habilitacoes || func.habilitacoes || '',
          true,
        ]
      );

      // Link funcionário → professor
      await query(`UPDATE public.funcionarios SET "professorId"=$1,"updatedAt"=NOW() WHERE id=$2`, [profId, id]);

      // If already has a system user, update their role to professor
      if (func.utilizadorId) {
        await query(`UPDATE public.utilizadores SET role='professor',"updatedAt"=NOW() WHERE id=$1`, [func.utilizadorId]);
      }

      json(res, 201, { professor: profRows[0] });
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  // -----------------------
  // ANOS ACADÉMICOS
  // -----------------------
  app.get("/api/anos-academicos", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.anos_academicos ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/anos-academicos", async (req: Request, res: Response) => {
    console.log("POST /api/anos-academicos", req.body);
    try {
      const b = requireBodyObject(req);

      // Verificar se já existe um ano académico com o mesmo valor de "ano"
      const existente = await query<JsonObject>(
        `SELECT id, ano FROM public.anos_academicos WHERE ano = $1 LIMIT 1`,
        [b.ano]
      );
      if (existente.length > 0) {
        return json(res, 409, {
          error: `Já existe um ano académico "${b.ano}" registado no sistema. Não é permitido criar dois anos académicos iguais.`,
          codigo: 'ANO_DUPLICADO',
        });
      }

      const id = b.id || Date.now().toString() + Math.random().toString(36).slice(2, 7);
      const rows = await query<JsonObject>(
        `INSERT INTO public.anos_academicos (id,"ano","dataInicio","dataFim","ativo","trimestres")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
        [id, b.ano, b.dataInicio, b.dataFim, b.ativo ?? false, jsonbParam(b.trimestres) ?? '[]'],
      );
      console.log("Ano criado:", rows[0]);
      json(res, 201, rows[0]);
    } catch (e) { 
      console.error("Erro ao criar ano:", e);
      json(res, 400, { error: (e as Error).message }); 
    }
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
    try {
      const { id } = req.params;
      console.log(`Tentando eliminar ano académico: ${id}`);
      
      // Verificar se existem turmas vinculadas a este ano (pelo nome do ano)
      const anoRow = await query<JsonObject>(`SELECT ano FROM public.anos_academicos WHERE id=$1`, [id]);
      if (anoRow[0]) {
        const turmasCount = await query<JsonObject>(`SELECT count(*) as count FROM public.turmas WHERE "anoLetivo"=$1`, [anoRow[0].ano]);
        if (parseInt(String(turmasCount[0].count)) > 0) {
          return json(res, 400, { error: "Não é possível eliminar um ano que possui turmas vinculadas." });
        }
      }

      const rows = await query<JsonObject>(`DELETE FROM public.anos_academicos WHERE id=$1 RETURNING *`, [id]);
      if (!rows[0]) return json(res, 404, { error: "Ano não encontrado." });
      
      console.log(`Ano eliminado com sucesso: ${id}`);
      json(res, 200, rows[0]);
    } catch (e) { 
      console.error("Erro ao eliminar ano:", e);
      json(res, 500, { error: (e as Error).message }); 
    }
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

  // GET /api/sumarios/pendentes-rh?mes=X&ano=Y
  // Returns: rejected sumários + professors with horários but no accepted sumário this month
  app.get("/api/sumarios/pendentes-rh", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const mes  = parseInt(String(req.query.mes  ?? new Date().getMonth() + 1));
      const ano  = parseInt(String(req.query.ano  ?? new Date().getFullYear()));

      // 1. Sumários rejeitados no mês
      const rejeitados = await query<JsonObject>(
        `SELECT s.*, f.cargo, f.departamento
         FROM public.sumarios s
         LEFT JOIN public.funcionarios f ON f."professorId" = s."professorId"
         WHERE EXTRACT(MONTH FROM s.data::date) = $1
           AND EXTRACT(YEAR  FROM s.data::date) = $2
           AND s.status = 'rejeitado'
         ORDER BY s.data DESC`,
        [mes, ano]
      );

      // 2. Professores com horários mas sem sumário aceite no mês
      const semSumario = await query<JsonObject>(
        `SELECT DISTINCT h."professorId", h."professorNome",
                f.cargo, f.departamento, f.id as funcionarioId
         FROM public.horarios h
         LEFT JOIN public.funcionarios f ON f."professorId" = h."professorId"
         WHERE NOT EXISTS (
           SELECT 1 FROM public.sumarios s
           WHERE s."professorId" = h."professorId"
             AND EXTRACT(MONTH FROM s.data::date) = $1
             AND EXTRACT(YEAR  FROM s.data::date) = $2
             AND s.status = 'aceite'
         )`,
        [mes, ano]
      );

      json(res, 200, {
        rejeitados: rejeitados.map(r => ({ ...r, _tipo: 'rejeitado' })),
        semSumario: semSumario.map(r => ({ ...r, _tipo: 'sem_sumario' })),
      });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
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

  // Rota pública para estudantes registarem o seu próprio pedido de pagamento (status sempre 'pendente')
  app.post("/api/pagamentos/self", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.jwtUser) return json(res, 401, { error: "Não autenticado." });
      const [userRow] = await query<JsonObject>(
        `SELECT "alunoId" FROM public.utilizadores WHERE id=$1`,
        [req.jwtUser.userId]
      );
      if (!userRow || !userRow.alunoId) {
        return json(res, 403, { error: "Utilizador não está associado a nenhum aluno." });
      }
      const b = requireBodyObject(req);
      if (String(b.alunoId) !== String(userRow.alunoId)) {
        return json(res, 403, { error: "Não pode registar pagamentos para outro aluno." });
      }
      const rows = await query<JsonObject>(
        `INSERT INTO public.pagamentos (id,"alunoId","taxaId","valor","data","mes","trimestre","ano","status","metodoPagamento","referencia","observacao")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendente',$9,$10,$11) RETURNING *`,
        [b.id ?? null, b.alunoId, b.taxaId, b.valor, b.data, b.mes ?? null, b.trimestre ?? null, b.ano, b.metodoPagamento, b.referencia ?? null, b.observacao ?? null],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

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

  // Transferir pagamento → outro serviço ou → saldo
  app.post("/api/pagamentos/:id/transferir", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const destino = (b as any).destino as string; // 'saldo' | taxaId
      const criadoPor = (b as any).criadoPor || req.jwtUser?.email || 'Sistema';

      const [pag] = await query<JsonObject>(`SELECT * FROM public.pagamentos WHERE id=$1`, [id]);
      if (!pag) return json(res, 404, { error: 'Pagamento não encontrado.' });

      const alunoId = (pag as any).alunoId;
      const valor = (pag as any).valor as number;

      if (destino === 'saldo') {
        // Cancelar o pagamento original e adicionar ao saldo
        await query(`UPDATE public.pagamentos SET status='cancelado', observacao='Transferido para saldo' WHERE id=$1`, [id]);

        // Upsert saldo
        const [existente] = await query<JsonObject>(`SELECT * FROM public.saldo_alunos WHERE "alunoId"=$1`, [alunoId]);
        if (existente) {
          const novoSaldo = ((existente as any).saldo as number) + valor;
          await query(`UPDATE public.saldo_alunos SET saldo=$1, "updatedAt"=NOW() WHERE "alunoId"=$2`, [novoSaldo, alunoId]);
        } else {
          await query(`INSERT INTO public.saldo_alunos ("alunoId", saldo) VALUES ($1, $2)`, [alunoId, valor]);
        }

        // Registar movimento
        await query(
          `INSERT INTO public.movimentos_saldo ("alunoId", tipo, valor, descricao, "pagamentoId", "criadoPor") VALUES ($1,$2,$3,$4,$5,$6)`,
          [alunoId, 'credito', valor, `Pagamento transferido para saldo`, id, criadoPor]
        );

        const [saldoAtualizado] = await query<JsonObject>(`SELECT * FROM public.saldo_alunos WHERE "alunoId"=$1`, [alunoId]);
        return json(res, 200, { pagamento: pag, saldo: saldoAtualizado });
      } else {
        // Transferir para outra taxa
        const [taxa] = await query<JsonObject>(`SELECT * FROM public.taxas WHERE id=$1`, [destino]);
        if (!taxa) return json(res, 404, { error: 'Rubrica de destino não encontrada.' });

        await query(`UPDATE public.pagamentos SET status='cancelado', observacao='Transferido para outra rubrica' WHERE id=$1`, [id]);

        const [novoPag] = await query<JsonObject>(
          `INSERT INTO public.pagamentos ("alunoId","taxaId",valor,data,ano,status,"metodoPagamento",referencia,observacao)
           VALUES ($1,$2,$3,$4,$5,'pendente',$6,'Transferência','Transferido de outro serviço') RETURNING *`,
          [alunoId, destino, valor, new Date().toISOString().slice(0, 10), (pag as any).ano, (pag as any).metodoPagamento]
        );
        return json(res, 200, { pagamento: pag, novoPagamento: novoPag });
      }
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  // -----------------------
  // SALDO DE ALUNOS
  // -----------------------
  app.get("/api/saldo-alunos", requireAuth, requirePermission("financeiro"), async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.saldo_alunos ORDER BY "updatedAt" DESC`, []);
    json(res, 200, rows);
  });

  app.get("/api/saldo-alunos/:alunoId", requireAuth, async (req: Request, res: Response) => {
    const [row] = await query<JsonObject>(`SELECT * FROM public.saldo_alunos WHERE "alunoId"=$1`, [req.params.alunoId]);
    json(res, 200, row || { alunoId: req.params.alunoId, saldo: 0 });
  });

  app.post("/api/saldo-alunos/:alunoId/creditar", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;
      const b = requireBodyObject(req);
      const valor = parseFloat((b as any).valor) || 0;
      const descricao = (b as any).descricao || 'Crédito adicionado';
      const dataProximaCobranca = (b as any).dataProximaCobranca || null;
      const observacoes = (b as any).observacoes || null;
      const criadoPor = (b as any).criadoPor || req.jwtUser?.email || 'Sistema';

      if (valor <= 0) return json(res, 400, { error: 'Valor deve ser positivo.' });

      const [existente] = await query<JsonObject>(`SELECT * FROM public.saldo_alunos WHERE "alunoId"=$1`, [alunoId]);
      let saldoAtualizado: JsonObject;
      if (existente) {
        const novoSaldo = ((existente as any).saldo as number) + valor;
        const [r] = await query<JsonObject>(
          `UPDATE public.saldo_alunos SET saldo=$1,"dataProximaCobranca"=$2,observacoes=$3,"updatedAt"=NOW() WHERE "alunoId"=$4 RETURNING *`,
          [novoSaldo, dataProximaCobranca, observacoes, alunoId]
        );
        saldoAtualizado = r;
      } else {
        const [r] = await query<JsonObject>(
          `INSERT INTO public.saldo_alunos ("alunoId",saldo,"dataProximaCobranca",observacoes) VALUES ($1,$2,$3,$4) RETURNING *`,
          [alunoId, valor, dataProximaCobranca, observacoes]
        );
        saldoAtualizado = r;
      }

      await query(
        `INSERT INTO public.movimentos_saldo ("alunoId",tipo,valor,descricao,"criadoPor") VALUES ($1,'credito',$2,$3,$4)`,
        [alunoId, valor, descricao, criadoPor]
      );

      json(res, 200, saldoAtualizado);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  app.post("/api/saldo-alunos/:alunoId/debitar", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;
      const b = requireBodyObject(req);
      const valor = parseFloat((b as any).valor) || 0;
      const descricao = (b as any).descricao || 'Débito';
      const criadoPor = (b as any).criadoPor || req.jwtUser?.email || 'Sistema';

      if (valor <= 0) return json(res, 400, { error: 'Valor deve ser positivo.' });

      const [existente] = await query<JsonObject>(`SELECT * FROM public.saldo_alunos WHERE "alunoId"=$1`, [alunoId]);
      if (!existente || ((existente as any).saldo as number) < valor) {
        return json(res, 400, { error: 'Saldo insuficiente.' });
      }

      const novoSaldo = ((existente as any).saldo as number) - valor;
      const [r] = await query<JsonObject>(
        `UPDATE public.saldo_alunos SET saldo=$1,"updatedAt"=NOW() WHERE "alunoId"=$2 RETURNING *`,
        [novoSaldo, alunoId]
      );

      await query(
        `INSERT INTO public.movimentos_saldo ("alunoId",tipo,valor,descricao,"criadoPor") VALUES ($1,'debito',$2,$3,$4)`,
        [alunoId, valor, descricao, criadoPor]
      );

      json(res, 200, r);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  app.put("/api/saldo-alunos/:alunoId", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;
      const b = requireBodyObject(req);
      const dataProximaCobranca = (b as any).dataProximaCobranca !== undefined ? (b as any).dataProximaCobranca : undefined;
      const observacoes = (b as any).observacoes !== undefined ? (b as any).observacoes : undefined;

      const setParts: string[] = ['"updatedAt"=NOW()'];
      const values: unknown[] = [];

      if (dataProximaCobranca !== undefined) {
        values.push(dataProximaCobranca);
        setParts.push(`"dataProximaCobranca"=$${values.length}`);
      }
      if (observacoes !== undefined) {
        values.push(observacoes);
        setParts.push(`observacoes=$${values.length}`);
      }

      values.push(alunoId);
      const [r] = await query<JsonObject>(
        `UPDATE public.saldo_alunos SET ${setParts.join(',')} WHERE "alunoId"=$${values.length} RETURNING *`,
        values
      );
      if (!r) return json(res, 404, { error: 'Saldo não encontrado.' });
      json(res, 200, r);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  app.get("/api/movimentos-saldo", requireAuth, requirePermission("financeiro"), async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.movimentos_saldo ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.get("/api/movimentos-saldo/:alunoId", requireAuth, async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.movimentos_saldo WHERE "alunoId"=$1 ORDER BY "createdAt" DESC`,
      [req.params.alunoId]
    );
    json(res, 200, rows);
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
  // ISENÇÕES DE MULTA
  // -----------------------
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public.multa_isencoes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "alunoId" varchar NOT NULL,
        "solicitadoPor" text NOT NULL DEFAULT '',
        "justificativa" text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'pendente',
        "aprovadoPor" text,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz
      )
    `, []);
  } catch { }

  app.get("/api/multa-isencoes", requireAuth, async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.multa_isencoes ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/multa-isencoes", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.multa_isencoes ("alunoId","solicitadoPor","justificativa",status,"createdAt")
         VALUES ($1,$2,$3,'pendente',NOW()) RETURNING *`,
        [b.alunoId, b.solicitadoPor, b.justificativa],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/multa-isencoes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `UPDATE public.multa_isencoes SET status=$1,"aprovadoPor"=$2,"updatedAt"=NOW() WHERE id=$3 RETURNING *`,
        [b.status, b.aprovadoPor ?? null, id],
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/multa-isencoes/:id", requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    await query(`DELETE FROM public.multa_isencoes WHERE id=$1`, [id]);
    json(res, 200, { ok: true });
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
    const rows = await query<JsonObject>(
      `SELECT r.*, c.nome AS "cursoNome" FROM public.registros r LEFT JOIN public.cursos c ON c.id = r."cursoId" ORDER BY r."criadoEm" DESC`,
      []
    );
    json(res, 200, rows);
  });

  app.get("/api/registros/lista-aprovados", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT r.*, c.nome AS "cursoNome" FROM public.registros r
       LEFT JOIN public.cursos c ON c.id = r."cursoId"
       WHERE r.status IN ('admitido','matriculado')
       ORDER BY r.classe ASC, c.nome ASC NULLS LAST, r."nomeCompleto" ASC`,
      []
    );
    json(res, 200, rows);
  });

  app.get("/api/registros/:id", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT r.*, c.nome AS "cursoNome" FROM public.registros r LEFT JOIN public.cursos c ON c.id = r."cursoId" WHERE r.id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  app.post("/api/login-provisorio", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { email, senha } = b as { email: string; senha: string };
      if (!email || !senha) return json(res, 400, { error: "Email e senha são obrigatórios." });
      const rows = await query<JsonObject>(
        `SELECT * FROM public.registros WHERE LOWER(email)=LOWER($1) AND LOWER("senhaProvisoria")=LOWER($2)`,
        [email.trim(), senha.trim()]
      );
      if (!rows[0]) return json(res, 401, { error: "Credenciais inválidas. Verifique o email e a senha provisória." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.post("/api/registros", async (req: Request, res: Response) => {
    console.log("POST /api/registros", req.body);
    try {
      const b = requireBodyObject(req);

      // ── Validação de email ─────────────────────────────────────────
      const emailRaw = String(b.email || '').trim().toLowerCase();
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      const BLOCKED_DOMAINS = [
        'mailinator.com','guerrillamail.com','guerrillamailblock.com','tempmail.com',
        'temp-mail.org','throwam.com','yopmail.com','sharklasers.com','guerrillamail.info',
        'grr.la','guerrillamail.biz','guerrillamail.de','guerrillamail.net','guerrillamail.org',
        'spam4.me','trashmail.com','trashmail.me','trashmail.net','dispostable.com',
        'mailnull.com','spamgourmet.com','maildrop.cc','fakeinbox.com','getairmail.com',
        'filzmail.com','throwam.com','discard.email','mailnesia.com','mailnull.com',
        'spamhereplease.com','10minutemail.com','10minutemail.net','10minutemail.org',
        'tempr.email','tempail.com','crazymailing.com','getnada.com','mytemp.email',
        'mail-temporaire.fr','jetable.fr.nf','moncourrier.fr.nf','monemail.fr.nf',
        'speed.1s.fr','sofimail.com','mailzilla.com','moakt.com','emailtemporario.com.br',
      ];
      if (!emailRaw) {
        return json(res, 400, { error: 'O email de contacto é obrigatório.' });
      }
      if (!emailRegex.test(emailRaw)) {
        return json(res, 400, { error: 'Formato de email inválido.' });
      }
      const emailDomain = emailRaw.split('@')[1];
      if (BLOCKED_DOMAINS.includes(emailDomain)) {
        return json(res, 400, { error: 'Não é permitido usar endereços de email temporário ou descartável. Por favor, use um email real.' });
      }
      // ──────────────────────────────────────────────────────────────

      const senha = gerarSenhaProvisoria(String(b.nomeCompleto||''), String(b.dataNascimento||''));
      const id = b.id || Date.now().toString() + Math.random().toString(36).slice(2, 7);
      const rupeInscricao = gerarReferenciaRUPE();

      const rows = await query<JsonObject>(
        `INSERT INTO public.registros (
          "id", "nomeCompleto","dataNascimento","genero","provincia","municipio",
          "telefone","email","endereco","bairro","numeroBi","numeroCedula",
          "nivel","classe","cursoId","nomeEncarregado","telefoneEncarregado","observacoes",
          "status","senhaProvisoria","tipoInscricao","rupeInscricao"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
        [
          id, b.nomeCompleto, b.dataNascimento, b.genero, b.provincia, b.municipio,
          b.telefone??'', b.email??'', b.endereco??'', b.bairro??'', b.numeroBi??'', b.numeroCedula??'',
          b.nivel, b.classe, b.cursoId || null, b.nomeEncarregado, b.telefoneEncarregado, b.observacoes??'',
          'pendente_pagamento', senha, b.tipoInscricao??'novo', rupeInscricao
        ],
      );
      console.log("Inscrição criada:", rows[0]);
      json(res, 201, { ...rows[0], senhaProvisoria: senha });
    } catch (e) { 
      console.error("Erro ao criar inscrição:", e);
      json(res, 400, { error: (e as Error).message }); 
    }
  });

  app.put("/api/registros/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = [
        "status","avaliadoEm","avaliadoPor","motivoRejeicao",
        "dataProva","notaAdmissao","resultadoAdmissao","matriculaCompleta",
        "rupeInscricao","rupeMatricula","tipoInscricao",
        "pagamentoInscricaoConfirmado","pagamentoInscricaoConfirmadoEm","pagamentoInscricaoConfirmadoPor",
        "pagamentoMatriculaConfirmado","pagamentoMatriculaConfirmadoEm","pagamentoMatriculaConfirmadoPor"
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

      // Fetch the registro to check tipo de inscrição
      const regRows = await query<JsonObject>(`SELECT * FROM public.registros WHERE id=$1`, [req.params.id]);
      if (!regRows[0]) return json(res, 404, { error: "Inscrição não encontrada." });
      const reg = regRows[0] as any;

      // For NEW students (tipo='novo'), verify if vagas are available
      if ((reg.tipoInscricao ?? 'novo') === 'novo' && nota >= 10) {
        // Get capacity from turma or config
        const configRows = await query<JsonObject>(`SELECT "maxAlunosTurma" FROM public.config_geral LIMIT 1`, []);
        const capacidade = (configRows[0] as any)?.maxAlunosTurma ?? 35;

        // Count reconfirmações already admitidas/matriculadas for this class
        const reconfRows = await query<JsonObject>(
          `SELECT COUNT(*) as total FROM public.registros WHERE classe=$1 AND "tipoInscricao"='reconfirmacao' AND status IN ('admitido','matriculado')`,
          [reg.classe]
        );
        const reconfCount = parseInt(String((reconfRows[0] as any)?.total ?? 0));

        // Count new students already admitidos/matriculados for this class
        const novosRows = await query<JsonObject>(
          `SELECT COUNT(*) as total FROM public.registros WHERE classe=$1 AND ("tipoInscricao"='novo' OR "tipoInscricao" IS NULL) AND status IN ('admitido','matriculado')`,
          [reg.classe]
        );
        const novosCount = parseInt(String((novosRows[0] as any)?.total ?? 0));

        const vagasOcupadas = reconfCount + novosCount;
        if (vagasOcupadas >= capacidade) {
          return json(res, 400, { error: `Não há vagas disponíveis para novos alunos na ${reg.classe}. Capacidade (${capacidade}) atingida — ${reconfCount} reconfirmações + ${novosCount} novos alunos admitidos.` });
        }
      }

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

  app.put("/api/registros/:id/confirmar-pagamento-inscricao", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const confirmadoPor = String(b.confirmadoPor || 'Admin');
      const rows = await query<JsonObject>(
        `UPDATE public.registros SET "pagamentoInscricaoConfirmado"=true, "pagamentoInscricaoConfirmadoEm"=$1, "pagamentoInscricaoConfirmadoPor"=$2, "status"='pendente' WHERE id=$3 AND status='pendente_pagamento' RETURNING *`,
        [new Date().toISOString().split('T')[0], confirmadoPor, req.params.id]
      );
      if (!rows[0]) return json(res, 404, { error: "Inscrição não encontrada ou não está aguardando confirmação de pagamento." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/registros/:id/confirmar-pagamento-matricula", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const confirnadoPor = String(b.confirmadoPor || 'Admin');
      const rows = await query<JsonObject>(
        `UPDATE public.registros SET "pagamentoMatriculaConfirmado"=true, "pagamentoMatriculaConfirmadoEm"=$1, "pagamentoMatriculaConfirmadoPor"=$2 WHERE id=$3 AND status='admitido' RETURNING *`,
        [new Date().toISOString().split('T')[0], confirnadoPor, req.params.id]
      );
      if (!rows[0]) return json(res, 404, { error: "Inscrição não encontrada ou não está no estado 'admitido'." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.get("/api/vagas/:classe", async (req: Request, res: Response) => {
    try {
      const { classe } = req.params;
      const configRows = await query<JsonObject>(`SELECT "maxAlunosTurma" FROM public.config_geral LIMIT 1`, []);
      const capacidade = (configRows[0] as any)?.maxAlunosTurma ?? 35;

      const reconfRows = await query<JsonObject>(
        `SELECT COUNT(*) as total FROM public.registros WHERE classe=$1 AND "tipoInscricao"='reconfirmacao' AND status IN ('admitido','matriculado')`,
        [classe]
      );
      const reconfCount = parseInt(String((reconfRows[0] as any)?.total ?? 0));

      const novosRows = await query<JsonObject>(
        `SELECT COUNT(*) as total FROM public.registros WHERE classe=$1 AND ("tipoInscricao"='novo' OR "tipoInscricao" IS NULL) AND status IN ('admitido','matriculado')`,
        [classe]
      );
      const novosCount = parseInt(String((novosRows[0] as any)?.total ?? 0));

      const vagasOcupadas = reconfCount + novosCount;
      const vagasDisponiveis = Math.max(0, capacidade - vagasOcupadas);
      json(res, 200, { classe, capacidade, reconfirmacoes: reconfCount, novosAdmitidos: novosCount, vagasOcupadas, vagasDisponiveis });
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.post("/api/registros/:id/completar-matricula", async (req: Request, res: Response) => {
    try {
      const regRows = await query<JsonObject>(`SELECT * FROM public.registros WHERE id=$1`, [req.params.id]);
      if (!regRows[0]) return json(res, 404, { error: "Inscrição não encontrada." });
      const reg = regRows[0] as any;
      if (reg.status !== 'admitido') return json(res, 400, { error: "Apenas estudantes admitidos podem completar a matrícula." });
      if (!reg.pagamentoMatriculaConfirmado) return json(res, 400, { error: "O pagamento da taxa de matrícula ainda não foi confirmado pela secretaria. Dirija-se à secretaria com o comprovativo de pagamento." });

      // Find matching turma by classe and current anoLetivo (optional — if not found, secretaria assigns later)
      const anoAtual = new Date().getFullYear().toString();
      const turmasMatch = await query<JsonObject>(
        `SELECT id, nome FROM public.turmas
         WHERE ("classe" = $1 OR nome ILIKE $2)
           AND ("anoLetivo" ILIKE $3 OR "anoLetivo" IS NULL)
         ORDER BY nome ASC LIMIT 10`,
        [reg.classe, `%${reg.classe}%`, `%${anoAtual}%`]
      );
      // If exactly one match, use it; otherwise leave null for secretaria to assign
      const turmaId = turmasMatch.length === 1 ? (turmasMatch[0] as any).id : null;

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
    const rows = await query<JsonObject>(`SELECT "inscricoesAbertas", "inscricaoDataInicio", "inscricaoDataFim" FROM public.config_geral LIMIT 1`, []);
    const abertas = rows[0] ? Boolean(rows[0].inscricoesAbertas) : false;
    const dataInicio = rows[0]?.inscricaoDataInicio as string | null ?? null;
    const dataFim = rows[0]?.inscricaoDataFim as string | null ?? null;
    json(res, 200, { abertas, dataInicio, dataFim });
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
      const allowed = ["nomeEscola","logoUrl","pp1Habilitado","pptHabilitado","notaMinimaAprovacao","maxAlunosTurma","numAvaliacoes","macMin","macMax","horarioFuncionamento","flashScreen","multaConfig","inscricoesAbertas","inscricaoDataInicio","inscricaoDataFim","propinaHabilitada","numeroEntidade","iban","nomeBeneficiario","bancoTransferencia","telefoneMulticaixaExpress","nib","directorGeral","directorPedagogico","directorProvincialEducacao","codigoMED","nifEscola","provinciaEscola","municipioEscola","tipoEnsino","modalidade","inssEmpPerc","inssPatrPerc","irtTabela","mesesAnoAcademico","prazosLancamento","papHabilitado","estagioComoDisciplina","papDisciplinasContribuintes","exameAntecipadoHabilitado"] as const;
      const jsonbKeys = new Set(["flashScreen","multaConfig","irtTabela","mesesAnoAcademico","prazosLancamento","papDisciplinasContribuintes"]);
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
      
      const id = body.id || Date.now().toString() + Math.random().toString(36).slice(2, 7);
      
      const rows = await query<JsonObject>(
        `INSERT INTO public.cursos (id, nome, codigo, "areaFormacao", descricao, ativo)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, nome.trim(), (codigo || '').trim(), areaFormacao.trim(), (descricao || '').trim(), true]
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
      
      // Verificar se existem turmas vinculadas a este curso
      const turmas = await query<JsonObject>(`SELECT id FROM public.turmas WHERE "cursoId"=$1 LIMIT 1`, [id]);
      if (turmas.length > 0) {
        return json(res, 400, { error: "Não é possível eliminar um curso que possui turmas vinculadas." });
      }

      // Verificar se existem alunos vinculados a este curso
      const alunos = await query<JsonObject>(`SELECT id FROM public.alunos WHERE "cursoId"=$1 LIMIT 1`, [id]);
      if (alunos.length > 0) {
        return json(res, 400, { error: "Não é possível eliminar um curso que possui alunos matriculados." });
      }

      const rows = await query<JsonObject>(`DELETE FROM public.cursos WHERE id=$1 RETURNING *`, [id]);
      if (!rows.length) return json(res, 404, { error: 'Curso não encontrado.' });
      
      json(res, 200, { message: "Curso eliminado com sucesso", curso: rows[0] });
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

  // GET disciplinas de uma turma (via cursoId para II Ciclo, ou turma_disciplinas para os outros)
  app.get("/api/turmas/:id/disciplinas", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const turmaRows = await query<JsonObject>(
        `SELECT "cursoId" FROM public.turmas WHERE id=$1`, [id]
      );
      if (!turmaRows.length) return json(res, 404, { error: 'Turma não encontrada.' });

      const cursoId = turmaRows[0].cursoId as string | null;

      if (cursoId) {
        // II Ciclo: disciplinas via curso
        const rows = await query<JsonObject>(
          `SELECT cd."disciplinaId" AS id, d.nome, d.codigo, d.area, d.descricao, d.ativo,
                  cd.obrigatoria, cd."cargaHoraria", cd.ordem
           FROM public.curso_disciplinas cd
           JOIN public.disciplinas d ON d.id = cd."disciplinaId"
           WHERE cd."cursoId" = $1 AND d.ativo = true
           ORDER BY cd.ordem ASC, d.nome ASC`,
          [cursoId]
        );
        return json(res, 200, rows);
      }

      // Primário / I Ciclo: disciplinas via turma_disciplinas
      const rows = await query<JsonObject>(
        `SELECT td."disciplinaId" AS id, d.nome, d.codigo, d.area, d.descricao, d.ativo, td.ordem
         FROM public.turma_disciplinas td
         JOIN public.disciplinas d ON d.id = td."disciplinaId"
         WHERE td."turmaId" = $1 AND d.ativo = true
         ORDER BY td.ordem ASC, d.nome ASC`,
        [id]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // PUT /api/turmas/:id/disciplinas — atribuir disciplinas a uma turma (Primário / I Ciclo)
  app.put("/api/turmas/:id/disciplinas", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { disciplinaIds } = req.body as { disciplinaIds: string[] };
      if (!Array.isArray(disciplinaIds)) return json(res, 400, { error: 'disciplinaIds deve ser um array.' });

      // Remove todas as atribuições actuais e reinsere
      await query(`DELETE FROM public.turma_disciplinas WHERE "turmaId" = $1`, [id]);
      for (let i = 0; i < disciplinaIds.length; i++) {
        await query(
          `INSERT INTO public.turma_disciplinas ("turmaId", "disciplinaId", ordem) VALUES ($1, $2, $3) ON CONFLICT ("turmaId","disciplinaId") DO UPDATE SET ordem=$3`,
          [id, disciplinaIds[i], i]
        );
      }
      json(res, 200, { ok: true, total: disciplinaIds.length });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // GET /api/disciplinas/por-classe — disciplinas do catálogo filtrando por classe
  // Usa comparação numérica extraída do nome da classe (ex: "7ª Classe" → 7)
  app.get("/api/disciplinas/por-classe", async (req: Request, res: Response) => {
    try {
      const { classe } = req.query as { classe?: string };
      let rows: JsonObject[];
      if (classe) {
        // Extrai o número da classe passada (ex: "7ª Classe" → 7, "Iniciação" → 0)
        const classeNumStr = classe.replace(/[^0-9]/g, '') || '0';
        rows = await query<JsonObject>(
          `SELECT id, nome, codigo, area, componente, tipo, "classeInicio", "classeFim"
           FROM public.disciplinas
           WHERE ativo = true
             AND (
               "classeInicio" = '' OR
               (regexp_replace("classeInicio", '[^0-9]', '', 'g') = '' AND "classeInicio" != '') OR
               CAST(NULLIF(regexp_replace("classeInicio", '[^0-9]', '', 'g'), '') AS integer) <= $1
             )
             AND (
               "classeFim" = '' OR
               (regexp_replace("classeFim", '[^0-9]', '', 'g') = '' AND "classeFim" != '') OR
               CAST(NULLIF(regexp_replace("classeFim", '[^0-9]', '', 'g'), '') AS integer) >= $1
             )
           ORDER BY componente ASC, nome ASC`,
          [parseInt(classeNumStr, 10)]
        );
      } else {
        rows = await query<JsonObject>(
          `SELECT id, nome, codigo, area, componente, tipo, "classeInicio", "classeFim"
           FROM public.disciplinas WHERE ativo = true ORDER BY componente ASC, nome ASC`,
          []
        );
      }
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // GET /api/turmas/:id/alunos — lista de alunos activos de uma turma
  app.get("/api/turmas/:id/alunos", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rows = await query<JsonObject>(
        `SELECT id, nome, apelido, "numeroMatricula", genero, foto, "turmaId", ativo, bloqueado, falecido
         FROM public.alunos
         WHERE "turmaId" = $1 AND ativo = true AND (bloqueado IS NULL OR bloqueado = false) AND (falecido IS NULL OR falecido = false)
         ORDER BY apelido ASC, nome ASC`,
        [id]
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
      const tipo = (b.tipo === 'terminal' || b.tipo === 'continuidade') ? b.tipo : 'continuidade';
      const COMPS = ['Sócio-Cultural', 'Científica', 'Técnica, Tecnológica e Prática'];
      const componente = COMPS.includes(String(b.componente)) ? String(b.componente) : '';
      const rows = await query<JsonObject>(
        `INSERT INTO public.disciplinas (nome, codigo, area, descricao, ativo, tipo, "classeInicio", "classeFim", componente)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [b.nome, b.codigo || '', b.area || '', b.descricao || '', b.ativo ?? true, tipo, b.classeInicio || '', b.classeFim || '', componente]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.put("/api/disciplinas/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const tipo = (b.tipo === 'terminal' || b.tipo === 'continuidade') ? b.tipo : 'continuidade';
      const COMPS = ['Sócio-Cultural', 'Científica', 'Técnica, Tecnológica e Prática'];
      const componente = COMPS.includes(String(b.componente)) ? String(b.componente) : '';
      const rows = await query<JsonObject>(
        `UPDATE public.disciplinas SET nome=$1, codigo=$2, area=$3, descricao=$4, ativo=$5, tipo=$6, "classeInicio"=$7, "classeFim"=$8, componente=$9 WHERE id=$10 RETURNING *`,
        [b.nome, b.codigo || '', b.area || '', b.descricao || '', b.ativo ?? true, tipo, b.classeInicio || '', b.classeFim || '', componente, id]
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

  // Endpoint público: verificar se o email existe e retornar dica do nome (sem autenticação)
  app.post("/api/public/check-email-reset", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const email = String(b.email ?? "").toLowerCase().trim();
      if (!email) return json(res, 400, { error: "Email é obrigatório." });
      const FIXED = ["ceo@sige.ao","financeiro@sige.ao","secretaria@sige.ao","rh@sige.ao"];
      if (FIXED.includes(email)) {
        return json(res, 400, { error: "Esta conta de sistema só pode ser redefinida pelo administrador." });
      }
      const rows = await query<JsonObject>(
        `SELECT nome FROM public.utilizadores WHERE LOWER(email)=LOWER($1) AND ativo=true LIMIT 1`,
        [email]
      );
      if (!rows[0]) {
        // Por segurança, não revelar se o email existe
        return json(res, 200, { encontrado: false });
      }
      // Retornar apenas o primeiro nome como dica
      const nomeCompleto = String(rows[0].nome).trim();
      const primeiroNome = nomeCompleto.split(' ')[0];
      return json(res, 200, { encontrado: true, dica: primeiroNome });
    } catch (e) {
      console.error("[check-email-reset]", e);
      return json(res, 500, { error: "Erro interno." });
    }
  });

  // Endpoint público: redefinir senha sem email (verificação por nome completo)
  app.post("/api/public/reset-senha-direto", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const email = String(b.email ?? "").toLowerCase().trim();
      const nomeVerificacao = String(b.nomeVerificacao ?? "").trim();
      const novaSenha = String(b.novaSenha ?? "").trim();

      if (!email || !nomeVerificacao || !novaSenha) {
        return json(res, 400, { error: "Todos os campos são obrigatórios." });
      }
      if (novaSenha.length < 6) {
        return json(res, 400, { error: "A senha deve ter pelo menos 6 caracteres." });
      }

      const rows = await query<JsonObject>(
        `SELECT id, nome FROM public.utilizadores WHERE LOWER(email)=LOWER($1) AND ativo=true LIMIT 1`,
        [email]
      );
      if (!rows[0]) {
        return json(res, 404, { error: "Utilizador não encontrado." });
      }
      const nomeDB = String(rows[0].nome).trim().toLowerCase();
      const nomeInput = nomeVerificacao.trim().toLowerCase();
      // Verificar: o nome introduzido deve ser encontrado no nome completo registado
      if (!nomeDB.includes(nomeInput) && !nomeInput.includes(nomeDB.split(' ')[0])) {
        return json(res, 401, { error: "Nome não corresponde ao registado nesta conta." });
      }

      await query(
        `UPDATE public.utilizadores SET senha=$1 WHERE LOWER(email)=LOWER($2) AND ativo=true`,
        [novaSenha, email]
      );
      return json(res, 200, { ok: true });
    } catch (e) {
      console.error("[reset-senha-direto]", e);
      return json(res, 500, { error: "Erro interno." });
    }
  });

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
  function calcularIRT(rendimentoBruto: number, tabela?: Array<{max: number|null, taxa: number, baseFixa: number, limiteAnterior: number}>): number {
    if (tabela && tabela.length > 0) {
      for (const escalao of tabela) {
        if (escalao.max === null || rendimentoBruto <= escalao.max) {
          return Math.max(0, escalao.baseFixa + (rendimentoBruto - escalao.limiteAnterior) * escalao.taxa);
        }
      }
    }
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

  // Processar folha: gera itens automáticos para professores e funcionários ativos com salário definido
  // Inclui: descontos por faltas (configuracao_rh), pagamento por tempos lectivos (tempos_lectivos)
  app.post("/api/folhas-salarios/:id/processar", requireAuth, requirePermission("rh"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);

      const folha = await query<JsonObject>(`SELECT * FROM public.folhas_salarios WHERE id=$1`, [id]);
      if (!folha[0]) return json(res, 404, { error: 'Folha não encontrada.' });
      const folhaMes = Number((folha[0] as any).mes);
      const folhaAno = Number((folha[0] as any).ano);

      // Delete existing items and rebuild
      await query(`DELETE FROM public.itens_folha WHERE "folhaId"=$1`, [id]);

      // Load taxas globais (INSS, IRT)
      const cfgRows = await query<JsonObject>(`SELECT "inssEmpPerc","inssPatrPerc","irtTabela" FROM public.config_geral LIMIT 1`, []);
      const cfg = cfgRows[0] as any;
      const inssEmpRate = ((cfg?.inssEmpPerc ?? 3)) / 100;
      const inssPatrRate = ((cfg?.inssPatrPerc ?? 8)) / 100;
      const irtTabela = Array.isArray(cfg?.irtTabela) && (cfg.irtTabela as any[]).length > 0 ? cfg.irtTabela : undefined;

      // Load configuração RH (valores de faltas e parâmetros de tempos lectivos)
      const rhRows = await query<JsonObject>(`SELECT * FROM public.configuracao_rh WHERE id=1`);
      const rhCfg = rhRows[0] as any ?? {};
      const valorPorFalta           = Number(rhCfg.valorPorFalta ?? 0);
      const valorMeioDia            = Number(rhCfg.valorMeioDia  ?? 0);
      const descontoPorTempoNaoDado = Number(rhCfg.descontoPorTempoNaoDado ?? 0);
      const semanasPorMes           = Number(rhCfg.semanasPorMes ?? 4);

      let totalBruto = 0, totalLiquido = 0, totalInssEmp = 0, totalInssPatr = 0, totalIrtSum = 0, totalSubs = 0;
      let numProcessados = 0;

      // ── Helper: calcular item para qualquer funcionário/professor ───────────
      async function processarPessoa(
        pessoaId: string,
        nome: string,
        cargoStr: string,
        categoriaStr: string,
        salBase: number,
        subAlim: number,
        subTrans: number,
        subHab: number,
        outrosSubs: number,
        tipoFunc: 'professor' | 'funcionario',
        departamentoStr: string,
        seccaoStr: string,
        tipoContrato: string = 'efectivo',
        valorPorTempoLectivo: number = 0,
        temposSemanais: number = 0,
      ) {
        const outrosDesc = Number(b.outrosDescontos ?? 0);

        // ── Faltas do mês ──────────────────────────────────────────────────
        const faltasRows = await query<JsonObject>(
          `SELECT tipo, descontavel FROM public.faltas_funcionarios
           WHERE "funcionarioId"=$1 AND mes=$2 AND ano=$3`,
          [pessoaId, folhaMes, folhaAno]
        );
        const nFaltasInj = faltasRows.filter(f => (f as any).tipo === 'injustificada' && (f as any).descontavel).length;
        const nMeioDia   = faltasRows.filter(f => (f as any).tipo === 'meio_dia'      && (f as any).descontavel).length;
        const descFaltas = Math.round((nFaltasInj * valorPorFalta + nMeioDia * valorMeioDia) * 100) / 100;

        // ── Tempos lectivos registados manualmente (aprovados) ─────────────
        const tempoRows = await query<JsonObject>(
          `SELECT "totalUnidades","totalCalculado" FROM public.tempos_lectivos
           WHERE "funcionarioId"=$1 AND mes=$2 AND ano=$3 AND aprovado=true`,
          [pessoaId, folhaMes, folhaAno]
        );
        const numTemposRegist = tempoRows.reduce((s, t) => s + Number((t as any).totalUnidades ?? 0), 0);
        const remTemposRegist  = Math.round(tempoRows.reduce((s, t) => s + Number((t as any).totalCalculado ?? 0), 0) * 100) / 100;

        let salBaseEfectivo = salBase;
        let remTempos = remTemposRegist;
        let numTempos = numTemposRegist;

        // ── Lógica específica por tipo de contrato ─────────────────────────
        if (tipoContrato === 'efectivo' && temposSemanais > 0 && descontoPorTempoNaoDado > 0) {
          // Efectivo: salário base fixo menos desconto por tempos lectivos não dados
          // Tempos esperados no mês = temposSemanais × semanasPorMes
          const temposEsperados = temposSemanais * semanasPorMes;
          const temposDados = numTemposRegist; // tempos registados como dados
          const temposNaoDados = Math.max(0, temposEsperados - temposDados);
          const descontoTempos = Math.round(temposNaoDados * descontoPorTempoNaoDado * 100) / 100;
          // O desconto por tempos não dados subtrai do salário base
          salBaseEfectivo = Math.max(0, Math.round((salBase - descontoTempos) * 100) / 100);
          numTempos = temposNaoDados; // guardar o nº de tempos não dados para referência
          remTempos = -descontoTempos; // negativo indica desconto
        } else if ((tipoContrato === 'colaborador' || tipoContrato === 'contratado' || tipoContrato === 'prestacao_servicos') && valorPorTempoLectivo > 0 && temposSemanais > 0 && salBase === 0) {
          // Colaborador sem salário base fixo: valor por tempo × tempos semanais × semanas/mês
          const salCalculado = Math.round(valorPorTempoLectivo * temposSemanais * semanasPorMes * 100) / 100;
          salBaseEfectivo = salCalculado;
          numTempos = temposSemanais * semanasPorMes;
          remTempos = salCalculado; // remuneração calculada automaticamente
        } else if ((tipoContrato === 'colaborador' || tipoContrato === 'contratado' || tipoContrato === 'prestacao_servicos') && valorPorTempoLectivo > 0 && temposSemanais > 0 && salBase > 0) {
          // Colaborador com salário base definido — usar o base definido + tempos registados
          remTempos = remTemposRegist;
        }

        const totalSubsidios = subAlim + subTrans + subHab + outrosSubs;
        // Bruto = salário base efectivo + subsídios + remuneração extra por tempos registados
        const remTemposExtra = tipoContrato === 'efectivo' ? 0 : (remTemposRegist > 0 && salBaseEfectivo > 0 ? remTemposRegist : 0);
        const salBruto = Math.round((salBaseEfectivo + totalSubsidios + remTemposExtra) * 100) / 100;

        // INSS e IRT calculam sobre salário base efectivo
        const inssEmp  = Math.round(salBaseEfectivo * inssEmpRate  * 100) / 100;
        const inssPatr = Math.round(salBaseEfectivo * inssPatrRate * 100) / 100;
        const irt = Math.round(calcularIRT(salBaseEfectivo, irtTabela) * 100) / 100;

        const totalDescontos = Math.round((inssEmp + irt + descFaltas + outrosDesc) * 100) / 100;
        const salLiquido     = Math.round((salBruto - totalDescontos) * 100) / 100;

        await query(
          `INSERT INTO public.itens_folha
           (id,"folhaId","professorId","professorNome",cargo,categoria,
            "salarioBase","subsidioAlimentacao","subsidioTransporte","subsidioHabitacao","outrosSubsidios","salarioBruto",
            "inssEmpregado","inssPatronal",irt,
            "descontoFaltas","numFaltasInj","numMeioDia",
            "remuneracaoTempos","numTempos",
            "outrosDescontos","totalDescontos","salarioLiquido",
            "tipoFuncionario",departamento,seccao)
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
          [
            id, pessoaId, nome, cargoStr, categoriaStr,
            salBase, subAlim, subTrans, subHab, outrosSubs, salBruto,
            inssEmp, inssPatr, irt,
            descFaltas, nFaltasInj, nMeioDia,
            remTempos, numTempos,
            outrosDesc, totalDescontos, salLiquido,
            tipoFunc, departamentoStr, seccaoStr,
          ]
        );

        totalBruto    += salBruto;
        totalLiquido  += salLiquido;
        totalInssEmp  += inssEmp;
        totalInssPatr += inssPatr;
        totalIrtSum   += irt;
        totalSubs     += totalSubsidios;
        numProcessados++;
      }

      // ── 1. Professores com salário base definido ou com tempos lectivos configurados ─
      const profs = await query<JsonObject>(
        `SELECT * FROM public.professores WHERE ativo=true AND (("salarioBase" IS NOT NULL AND "salarioBase" > 0) OR ("temposSemanais" IS NOT NULL AND "temposSemanais" > 0)) ORDER BY nome`,
        []
      );
      for (const p of profs) {
        // Obter funcionario correspondente para faltas (professores podem estar na tabela funcionarios)
        const fRows = await query<JsonObject>(`SELECT id, seccao FROM public.funcionarios WHERE "professorId"=$1 LIMIT 1`, [String(p.id)]);
        const funcId = fRows[0] ? String((fRows[0] as any).id) : String(p.id);
        const seccao = fRows[0] ? String((fRows[0] as any).seccao ?? '') : '';
        await processarPessoa(
          funcId,
          `${p.nome} ${p.apelido}`,
          String(p.cargo ?? 'Professor'),
          String(p.categoria ?? ''),
          Number(p.salarioBase ?? 0),
          Number(p.subsidioAlimentacao ?? 0),
          Number(p.subsidioTransporte ?? 0),
          Number(p.subsidioHabitacao ?? 0),
          0,
          'professor',
          'pedagogico',
          seccao,
          String(p.tipoContrato ?? 'efectivo'),
          Number((p as any).valorPorTempoLectivo ?? 0),
          Number((p as any).temposSemanais ?? 0),
        );
      }

      // ── 2. Funcionários administrativos com salário base definido ou com tempos ─
      // Exclui os que já estão ligados a um professor (evitar duplicação)
      const funcs = await query<JsonObject>(
        `SELECT * FROM public.funcionarios
         WHERE ativo=true
           AND departamento != 'pedagogico'
           AND (("salarioBase" IS NOT NULL AND "salarioBase" > 0)
                OR ("temposSemanais" IS NOT NULL AND "temposSemanais" > 0
                    AND "valorPorTempoLectivo" IS NOT NULL AND "valorPorTempoLectivo" > 0))
         ORDER BY departamento, nome`,
        []
      );
      for (const f of funcs) {
        await processarPessoa(
          String(f.id),
          `${f.nome} ${f.apelido}`,
          String((f as any).cargo ?? ''),
          '',
          Number((f as any).salarioBase ?? 0),
          Number((f as any).subsidioAlimentacao ?? 0),
          Number((f as any).subsidioTransporte ?? 0),
          Number((f as any).subsidioHabitacao ?? 0),
          Number((f as any).outrosSubsidios ?? 0),
          'funcionario',
          String((f as any).departamento ?? ''),
          String((f as any).seccao ?? ''),
          String((f as any).tipoContrato ?? 'efectivo'),
          Number((f as any).valorPorTempoLectivo ?? 0),
          Number((f as any).temposSemanais ?? 0),
        );
      }

      // ── 3. Professores/funcionários contratados SEM salário base fixo e SEM tempos configurados ──
      // Apenas com tempos lectivos aprovados registados manualmente
      const semSalBase = await query<JsonObject>(
        `SELECT DISTINCT tl."funcionarioId", f.nome, f.apelido, f.cargo, f.departamento, f.seccao,
                f."tipoContrato", f."valorPorTempoLectivo", f."temposSemanais"
         FROM public.tempos_lectivos tl
         JOIN public.funcionarios f ON tl."funcionarioId" = f.id
         WHERE tl.mes=$1 AND tl.ano=$2 AND tl.aprovado=true
           AND (f."salarioBase" IS NULL OR f."salarioBase" = 0)
           AND (f."temposSemanais" IS NULL OR f."temposSemanais" = 0)
           AND f.ativo=true`,
        [folhaMes, folhaAno]
      );
      for (const p of semSalBase) {
        await processarPessoa(
          String((p as any).funcionarioId),
          `${(p as any).nome} ${(p as any).apelido}`,
          String((p as any).cargo ?? ''),
          '',
          0,
          0, 0, 0, 0,
          (p as any).departamento === 'pedagogico' ? 'professor' : 'funcionario',
          String((p as any).departamento ?? ''),
          String((p as any).seccao ?? ''),
          String((p as any).tipoContrato ?? 'contratado'),
          Number((p as any).valorPorTempoLectivo ?? 0),
          Number((p as any).temposSemanais ?? 0),
        );
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
         numProcessados, nomeProcBy, id]
      );

      json(res, 200, { folha: updated[0], numProcessados });
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
      const cfgRowsUpd = await query<JsonObject>(`SELECT "inssEmpPerc","inssPatrPerc","irtTabela" FROM public.config_geral LIMIT 1`, []);
      const cfgUpd = cfgRowsUpd[0] as any;
      const inssEmpRateUpd = ((cfgUpd?.inssEmpPerc ?? 3)) / 100;
      const inssPatrRateUpd = ((cfgUpd?.inssPatrPerc ?? 8)) / 100;
      const irtTabelaUpd = Array.isArray(cfgUpd?.irtTabela) && (cfgUpd.irtTabela as any[]).length > 0 ? cfgUpd.irtTabela : undefined;
      const inssEmp = Math.round(salBase * inssEmpRateUpd * 100) / 100;
      const inssPatr = Math.round(salBase * inssPatrRateUpd * 100) / 100;
      const irt = Math.round(calcularIRT(salBase, irtTabelaUpd) * 100) / 100;
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
        `INSERT INTO public.livros (titulo, autor, isbn, categoria, editora, "anoPublicacao", "quantidadeTotal", "quantidadeDisponivel", localizacao, descricao, "capaUrl")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10) RETURNING *`,
        [b.titulo, b.autor, b.isbn || '', b.categoria || 'Geral', b.editora || '', b.anoPublicacao || null,
         b.quantidadeTotal || 1, b.localizacao || '', b.descricao || '', b.capaUrl || '']
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put('/api/livros/:id', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const { id } = req.params;
      const b = req.body as Record<string, unknown>;
      const allowed = ['titulo', 'autor', 'isbn', 'categoria', 'editora', 'anoPublicacao', 'quantidadeTotal', 'quantidadeDisponivel', 'localizacao', 'descricao', 'ativo', 'capaUrl'];
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

  // ─── SOLICITAÇÕES DE EMPRÉSTIMO ──────────────────────────────────────────────
  app.get('/api/solicitacoes-emprestimo', requireAuth, requirePermission('biblioteca'), async (req, res) => {
    try {
      const { status } = req.query;
      let sql = `SELECT * FROM public.solicitacoes_emprestimo`;
      const params: unknown[] = [];
      if (status) { sql += ` WHERE status=$1`; params.push(status); }
      sql += ` ORDER BY "createdAt" DESC`;
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post('/api/solicitacoes-emprestimo', requireAuth, async (req: Request, res: Response) => {
    try {
      const b = req.body as Record<string, unknown>;
      const livro = await query<JsonObject>(`SELECT * FROM public.livros WHERE id=$1 AND ativo=true`, [b.livroId]);
      if (!livro[0]) return json(res, 404, { error: 'Livro não encontrado.' });
      if (Number(livro[0].quantidadeDisponivel) < 1) return json(res, 400, { error: 'Livro sem exemplares disponíveis.' });

      const rows = await query<JsonObject>(
        `INSERT INTO public.solicitacoes_emprestimo ("livroId","livroTitulo","alunoId","nomeLeitor","tipoLeitor","diasSolicitados",status,"registadoPor")
         VALUES ($1,$2,$3,$4,$5,$6,'pendente',$7) RETURNING *`,
        [b.livroId, livro[0].titulo, b.alunoId || null, b.nomeLeitor, b.tipoLeitor || 'aluno',
         b.diasSolicitados || 14, b.registadoPor || 'Aluno']
      );

      const today = new Date().toISOString().slice(0, 10);
      await query(
        `INSERT INTO public.notificacoes (titulo, mensagem, tipo, data, lida)
         VALUES ($1,$2,'info',$3,false)`,
        [`Pedido de Empréstimo`, `${b.nomeLeitor} solicitou o livro "${livro[0].titulo}" por ${b.diasSolicitados || 14} dias.`, today]
      ).catch(() => {});

      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put('/api/solicitacoes-emprestimo/:id', requireAuth, requirePermission('biblioteca'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = req.body as Record<string, unknown>;
      const sol = await query<JsonObject>(`SELECT * FROM public.solicitacoes_emprestimo WHERE id=$1`, [id]);
      if (!sol[0]) return json(res, 404, { error: 'Solicitação não encontrada.' });
      if (sol[0].status !== 'pendente') return json(res, 400, { error: 'Solicitação já processada.' });

      if (b.status === 'aprovado') {
        const livro = await query<JsonObject>(`SELECT * FROM public.livros WHERE id=$1`, [sol[0].livroId]);
        if (!livro[0] || Number(livro[0].quantidadeDisponivel) < 1) return json(res, 400, { error: 'Livro sem exemplares disponíveis.' });

        const hoje = new Date().toISOString().slice(0, 10);
        const devolucao = new Date(Date.now() + Number(sol[0].diasSolicitados) * 86400000).toISOString().slice(0, 10);
        await query(
          `INSERT INTO public.emprestimos ("livroId","livroTitulo","alunoId","nomeLeitor","tipoLeitor","dataEmprestimo","dataPrevistaDevolucao",status,"registadoPor")
           VALUES ($1,$2,$3,$4,$5,$6,$7,'emprestado',$8)`,
          [sol[0].livroId, sol[0].livroTitulo, sol[0].alunoId, sol[0].nomeLeitor, sol[0].tipoLeitor, hoje, devolucao, b.aprovadoPor || 'Biblioteca']
        );
        await query(`UPDATE public.livros SET "quantidadeDisponivel"="quantidadeDisponivel"-1 WHERE id=$1`, [sol[0].livroId]);
        await query(`UPDATE public.solicitacoes_emprestimo SET status='aprovado' WHERE id=$1`, [id]);
        json(res, 200, { ok: true, status: 'aprovado' });
      } else if (b.status === 'rejeitado') {
        await query(
          `UPDATE public.solicitacoes_emprestimo SET status='rejeitado', "motivoRejeicao"=$1 WHERE id=$2`,
          [b.motivoRejeicao || null, id]
        );
        json(res, 200, { ok: true, status: 'rejeitado' });
      } else {
        json(res, 400, { error: 'Status inválido. Use "aprovado" ou "rejeitado".' });
      }
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

  // -----------------------
  // EXTRATO DE PROPINAS
  // -----------------------
  app.get('/api/extrato-propinas', requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.jwtUser!.role;
      const allowed = ['ceo', 'pca', 'admin', 'director', 'pedagogico', 'chefe_secretaria', 'secretaria', 'financeiro'];
      if (!allowed.includes(role)) {
        return json(res, 403, { error: 'Acesso negado.' });
      }

      const { alunoId, dataInicio, dataFim } = req.query as Record<string, string>;

      if (!alunoId) {
        return json(res, 400, { error: 'alunoId é obrigatório.' });
      }

      const [aluno] = await query<JsonObject>(
        `SELECT a.*, t.nome as "turmaNome", c.nome as "cursoNome"
         FROM public.alunos a
         LEFT JOIN public.turmas t ON t.id = a."turmaId"
         LEFT JOIN public.cursos c ON c.id = a."cursoId"
         WHERE a.id = $1`,
        [alunoId]
      );

      if (!aluno) {
        return json(res, 404, { error: 'Aluno não encontrado.' });
      }

      let whereDate = '';
      const params: unknown[] = [alunoId];
      if (dataInicio) {
        params.push(dataInicio);
        whereDate += ` AND p.data >= $${params.length}`;
      }
      if (dataFim) {
        params.push(dataFim);
        whereDate += ` AND p.data <= $${params.length}`;
      }

      const pagamentos = await query<JsonObject>(
        `SELECT p.*, t.descricao as "taxaDescricao", t.tipo as "taxaTipo", t.frequencia as "taxaFrequencia"
         FROM public.pagamentos p
         LEFT JOIN public.taxas t ON t.id = p."taxaId"
         WHERE p."alunoId" = $1 ${whereDate}
         ORDER BY p.data ASC, p."createdAt" ASC`,
        params
      );

      const totalPago = pagamentos
        .filter((p: any) => p.status === 'pago')
        .reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0);

      const totalPendente = pagamentos
        .filter((p: any) => p.status === 'pendente')
        .reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0);

      const totalCancelado = pagamentos
        .filter((p: any) => p.status === 'cancelado')
        .reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0);

      json(res, 200, {
        aluno,
        pagamentos,
        resumo: { totalPago, totalPendente, totalCancelado, total: pagamentos.length },
        filtros: { dataInicio: dataInicio || null, dataFim: dataFim || null },
      });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  // -----------------------
  // TRABALHOS FINAIS DE CURSO
  // -----------------------
  app.get('/api/trabalhos-finais', async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT * FROM public.trabalhos_finais WHERE ativo=true ORDER BY "anoConclusao" DESC, autor ASC`
      );
      json(res, 200, rows);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  app.post('/api/trabalhos-finais', requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { titulo, autor, orientador, anoConclusao, curso, imagemCapa, resumo } = b as any;
      if (!titulo || !autor || !orientador || !anoConclusao || !curso) {
        return json(res, 400, { error: 'Título, autor, orientador, ano e curso são obrigatórios.' });
      }
      const rows = await query<JsonObject>(
        `INSERT INTO public.trabalhos_finais (titulo, autor, orientador, "anoConclusao", curso, "imagemCapa", resumo)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [titulo, autor, orientador, parseInt(String(anoConclusao)), curso, imagemCapa || null, resumo || '']
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  app.put('/api/trabalhos-finais/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const fields: Record<string, unknown> = {};
      const allowed = ['titulo', 'autor', 'orientador', 'anoConclusao', 'curso', 'imagemCapa', 'resumo'];
      for (const key of allowed) {
        if (key in b) fields[key] = key === 'anoConclusao' ? parseInt(String((b as any)[key])) : (b as any)[key];
      }
      if (Object.keys(fields).length === 0) return json(res, 400, { error: 'Nenhum campo para actualizar.' });
      const keys = Object.keys(fields);
      const values = Object.values(fields);
      const setParts = keys.map((k, i) => `"${k}"=$${i + 1}`);
      const rows = await query<JsonObject>(
        `UPDATE public.trabalhos_finais SET ${setParts.join(',')} WHERE id=$${values.length + 1} RETURNING *`,
        [...values, id]
      );
      if (!rows.length) return json(res, 404, { error: 'Trabalho não encontrado.' });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  app.delete('/api/trabalhos-finais/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await query(`UPDATE public.trabalhos_finais SET ativo=false WHERE id=$1`, [id]);
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  app.post('/api/trabalhos-finais/:id/visita', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rows = await query<JsonObject>(
        `UPDATE public.trabalhos_finais SET visitas = visitas + 1 WHERE id=$1 AND ativo=true RETURNING visitas`,
        [id]
      );
      if (!rows.length) return json(res, 404, { error: 'Trabalho não encontrado.' });
      json(res, 200, { visitas: rows[0].visitas });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  // -----------------------
  // DISCIPLINAS DE CONTINUIDADE — SITUAÇÃO DO ALUNO
  // -----------------------

  /**
   * GET /api/continuidade/situacao/:alunoId
   *
   * Regras das disciplinas de continuidade (II Ciclo — 10ª a 12ª classe):
   *  R1 — Duas negativas consecutivas em anos distintos → REPROVA SEM DIREITO A EXAME
   *  R2 — Negativa num ano + positiva no ano seguinte → pode avançar para o ano
   *        seguinte; no final da 12ª classe (ano de fecho) realiza o Exame de Época
   *        Normal para fechar a negativa anterior.
   *  R3 — A disciplina de continuidade fecha (encerra) na 12ª classe, onde se
   *        contabiliza o somatório do plano curricular.
   *
   *  NOTA: Ao longo dos trimestres aplicam-se apenas médias normais (MAC, PP, PT).
   *        O Exame de Época Normal só é aplicado no final do ano de fecho (12ª classe).
   */
  app.get('/api/continuidade/situacao/:alunoId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;

      // Config: nota mínima de aprovação
      const cfgRows = await query<{ notaMinimaAprovacao: unknown }>(`SELECT "notaMinimaAprovacao" FROM public.config_geral LIMIT 1`);
      const notaMin = Number(cfgRows[0]?.notaMinimaAprovacao ?? 10);

      // 1. Media anual por disciplina/anoLetivo (avg dos trimestres)
      const notasRows = await query<{
        disciplina: string;
        anoLetivo: string;
        classe: string;
        mediaAnual: string;
        numTrimestres: string;
      }>(`
        SELECT
          n.disciplina,
          n."anoLetivo",
          t.classe,
          ROUND(AVG(n.nf)::numeric, 2)::text      AS "mediaAnual",
          COUNT(n.trimestre)::text                  AS "numTrimestres"
        FROM public.notas n
        JOIN public.turmas t ON t.id = n."turmaId"
        WHERE n."alunoId" = $1
        GROUP BY n.disciplina, n."anoLetivo", t.classe
        ORDER BY n."anoLetivo", n.disciplina
      `, [alunoId]);

      // 2. Catálogo de disciplinas de continuidade
      const catRows = await query<{ nome: string; classeInicio: string; classeFim: string }>(`
        SELECT nome, "classeInicio", "classeFim"
        FROM public.disciplinas
        WHERE tipo = 'continuidade' AND ativo = true
      `);
      const continuidade_nomes = new Set(catRows.map(d => d.nome));

      // 3. Agrupar por disciplina (só as de continuidade)
      type AnoEntry = { anoLetivo: string; classe: string; mediaAnual: number; numTrimestres: number };
      const byDisc: Record<string, AnoEntry[]> = {};

      for (const row of notasRows) {
        if (!continuidade_nomes.has(row.disciplina)) continue;
        if (!byDisc[row.disciplina]) byDisc[row.disciplina] = [];
        byDisc[row.disciplina].push({
          anoLetivo:    row.anoLetivo,
          classe:       row.classe,
          mediaAnual:   parseFloat(row.mediaAnual),
          numTrimestres: parseInt(row.numTrimestres),
        });
      }

      // 4. Aplicar regras
      type Situacao = 'normal' | 'reprova_sem_exame' | 'exame_fechamento' | 'fechada_12';
      interface DiscResult {
        disciplina: string;
        anos: AnoEntry[];
        situacao: Situacao;
        motivo: string;
        examesPendentes: string[]; // anoLetivo com negativa que precisa de exame
        mediaAcumulada: number;    // somatório / média acumulada para fechar na 12ª
      }

      const resultado: DiscResult[] = [];

      for (const [disciplina, anos] of Object.entries(byDisc)) {
        // Ordenar cronologicamente
        anos.sort((a, b) => a.anoLetivo.localeCompare(b.anoLetivo));

        let situacao: Situacao = 'normal';
        let motivo = '';
        const examesPendentes: string[] = [];
        let regraAplicada = false;

        for (let i = 0; i < anos.length; i++) {
          const ano     = anos[i];
          const isNeg   = ano.mediaAnual < notaMin;

          if (i > 0 && !regraAplicada) {
            const prev        = anos[i - 1];
            const prevIsNeg   = prev.mediaAnual < notaMin;

            if (prevIsNeg && isNeg) {
              // R1 — Duas negativas consecutivas
              situacao = 'reprova_sem_exame';
              motivo   = `Negativa em ${prev.anoLetivo} (${prev.mediaAnual.toFixed(1)}) e ${ano.anoLetivo} (${ano.mediaAnual.toFixed(1)}) — Reprova sem direito a exame`;
              regraAplicada = true;
              break;
            }

            if (prevIsNeg && !isNeg) {
              // R2 — Negativa seguida de positiva → Exame de Época Normal no final da 12ª classe
              examesPendentes.push(prev.anoLetivo);
              if (situacao === 'normal') {
                situacao = 'exame_fechamento';
                motivo   = `Negativa em ${prev.anoLetivo} (${prev.mediaAnual.toFixed(1)}) resgatada em ${ano.anoLetivo} (${ano.mediaAnual.toFixed(1)}) — Exame de Época Normal obrigatório no final da 12ª classe`;
              }
            }
          }

          // R3 — A disciplina fecha na 12ª classe com Exame de Época Normal
          if (ano.classe === '12' && situacao === 'exame_fechamento') {
            situacao = 'fechada_12';
            motivo += ' | Disciplina encerra na 12ª classe — Exame de Época Normal a aplicar no final do ano';
          }
        }

        // Média acumulada (somatório normalizado)
        const mediaAcumulada = anos.length > 0
          ? parseFloat((anos.reduce((s, a) => s + a.mediaAnual, 0) / anos.length).toFixed(2))
          : 0;

        resultado.push({ disciplina, anos, situacao, motivo, examesPendentes, mediaAcumulada });
      }

      json(res, 200, { alunoId, notaMin, resultado });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  /**
   * GET /api/continuidade/turma/:turmaId
   * Retorna a situação de continuidade de todos os alunos de uma turma.
   */
  app.get('/api/continuidade/turma/:turmaId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { turmaId } = req.params;

      const cfgRows = await query<{ notaMinimaAprovacao: unknown }>(`SELECT "notaMinimaAprovacao" FROM public.config_geral LIMIT 1`);
      const notaMin = Number(cfgRows[0]?.notaMinimaAprovacao ?? 10);

      // Alunos da turma
      const alunosRows = await query<{ id: string; nome: string; apelido: string }>(`
        SELECT id, nome, apelido FROM public.alunos WHERE "turmaId" = $1 AND ativo = true ORDER BY apelido, nome
      `, [turmaId]);

      // Catálogo de continuidade
      const catRows = await query<{ nome: string }>(`
        SELECT nome FROM public.disciplinas WHERE tipo = 'continuidade' AND ativo = true
      `);
      const continuidade_nomes = new Set(catRows.map(d => d.nome));

      // Notas históricas de todos os alunos da turma (todos os anos letivos)
      // Filtra por alunoId (não por turmaId) para capturar negativas de anos anteriores
      // e assim detectar correctamente duas negativas consecutivas (R1).
      const alunoIds = alunosRows.map(a => a.id);
      const notasRows = alunoIds.length === 0 ? [] : await query<{
        alunoId: string; disciplina: string; anoLetivo: string;
        classe: string; mediaAnual: string;
      }>(`
        SELECT
          n."alunoId",
          n.disciplina,
          n."anoLetivo",
          t.classe,
          ROUND(AVG(n.nf)::numeric, 2)::text AS "mediaAnual"
        FROM public.notas n
        JOIN public.turmas t ON t.id = n."turmaId"
        WHERE n."alunoId" = ANY($1::uuid[])
        GROUP BY n."alunoId", n.disciplina, n."anoLetivo", t.classe
        ORDER BY n."alunoId", n."anoLetivo", n.disciplina
      `, [alunoIds]);

      // Agrupar por aluno → disciplina
      const byAluno: Record<string, Record<string, { anoLetivo: string; classe: string; mediaAnual: number }[]>> = {};
      for (const row of notasRows) {
        if (!continuidade_nomes.has(row.disciplina)) continue;
        if (!byAluno[row.alunoId]) byAluno[row.alunoId] = {};
        if (!byAluno[row.alunoId][row.disciplina]) byAluno[row.alunoId][row.disciplina] = [];
        byAluno[row.alunoId][row.disciplina].push({
          anoLetivo:  row.anoLetivo,
          classe:     row.classe,
          mediaAnual: parseFloat(row.mediaAnual),
        });
      }

      const resumo = alunosRows.map(aluno => {
        const discMap = byAluno[aluno.id] ?? {};
        let temReprovaSemExame = false;
        let temExameFechamento = false;
        const detalhes: { disciplina: string; situacao: string; motivo: string }[] = [];

        for (const [disciplina, anos] of Object.entries(discMap)) {
          anos.sort((a, b) => a.anoLetivo.localeCompare(b.anoLetivo));
          let situacao = 'normal';
          let motivo = '';
          for (let i = 1; i < anos.length; i++) {
            const prev   = anos[i - 1];
            const cur    = anos[i];
            const prevNeg = prev.mediaAnual < notaMin;
            const curNeg  = cur.mediaAnual  < notaMin;
            if (prevNeg && curNeg) {
              situacao = 'reprova_sem_exame';
              motivo   = `Duas negativas: ${prev.anoLetivo} (${prev.mediaAnual.toFixed(1)}) e ${cur.anoLetivo} (${cur.mediaAnual.toFixed(1)})`;
              temReprovaSemExame = true;
              break;
            }
            if (prevNeg && !curNeg) {
              situacao = 'exame_fechamento';
              motivo   = `Negativa em ${prev.anoLetivo} (${prev.mediaAnual.toFixed(1)}), positiva em ${cur.anoLetivo} (${cur.mediaAnual.toFixed(1)}) — Exame de Época Normal no final da 12ª classe`;
              temExameFechamento = true;
            }
          }
          if (situacao !== 'normal') {
            detalhes.push({ disciplina, situacao, motivo });
          }
        }

        return {
          alunoId:   aluno.id,
          nome:      `${aluno.nome} ${aluno.apelido}`,
          situacao:  temReprovaSemExame ? 'reprova_sem_exame' : temExameFechamento ? 'exame_fechamento' : 'normal',
          detalhes,
        };
      });

      json(res, 200, { turmaId, notaMin, resumo });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  /**
   * GET /api/promocao/situacao/:alunoId
   *
   * Calcula a situação de promoção do aluno no ano lectivo actual, aplicando
   * as regras específicas por classe do II Ciclo do Ensino Secundário:
   *
   *  10ª CLASSE (sem histórico anterior):
   *    — Pode avançar com ATÉ 2 negativas, desde que cada negativa ≥ 7 valores.
   *    — Qualquer disciplina com média < 7 → REPROVA automaticamente.
   *    — Mais de 2 negativas → REPROVA.
   *    — Disciplinas terminais com negativa → Exame de Época Normal na 10ª classe.
   *    — Disciplinas de continuidade com negativa → arrastam-se (R2 aplica-se na 11ª/12ª).
   *
   *  11ª CLASSE (considera histórico da 10ª):
   *    — O histórico da 10ª classe é analisado via /api/continuidade/situacao.
   *    — Duas negativas consecutivas (10ª + 11ª) na mesma disciplina de continuidade → REPROVA (R1).
   *    — A média mínima de promoção normal é 10 (configurável).
   *
   *  12ª CLASSE:
   *    — Ano de fecho das disciplinas de continuidade.
   *    — Exame de Época Normal aplicado no final do ano.
   */
  app.get('/api/promocao/situacao/:alunoId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { alunoId } = req.params;
      const anoLetivoParam = req.query.anoLetivo as string | undefined;

      const cfgRows = await query<{ notaMinimaAprovacao: unknown }>(
        `SELECT "notaMinimaAprovacao" FROM public.config_geral LIMIT 1`
      );
      const notaMin = Number(cfgRows[0]?.notaMinimaAprovacao ?? 10);
      const notaMinAbsoluta = 7;
      const maxNegativasPermitidas10 = 2;

      // Aluno + turma actual
      const alunoRows = await query<{
        id: string; nome: string; apelido: string; turmaId: string;
      }>(
        `SELECT id, nome, apelido, "turmaId" FROM public.alunos WHERE id = $1`,
        [alunoId]
      );
      if (alunoRows.length === 0) return json(res, 404, { error: 'Aluno não encontrado' });
      const aluno = alunoRows[0];

      const turmaRows = await query<{ classe: string; anoLetivo: string }>(
        `SELECT classe, "anoLetivo" FROM public.turmas WHERE id = $1`,
        [aluno.turmaId]
      );
      if (turmaRows.length === 0) return json(res, 404, { error: 'Turma não encontrada' });
      const turma = turmaRows[0];

      const classeAtual = turma.classe;
      const anoLetivo   = anoLetivoParam || turma.anoLetivo;

      // Médias anuais por disciplina no ano letivo em questão
      const notasRows = await query<{
        disciplina: string;
        mediaAnual: string;
        numTrimestres: string;
      }>(`
        SELECT
          n.disciplina,
          ROUND(AVG(n.nf)::numeric, 2)::text   AS "mediaAnual",
          COUNT(DISTINCT n.trimestre)::text     AS "numTrimestres"
        FROM public.notas n
        WHERE n."alunoId" = $1 AND n."anoLetivo" = $2
        GROUP BY n.disciplina
        ORDER BY n.disciplina
      `, [alunoId, anoLetivo]);

      // Catálogo de disciplinas (tipo + classeFim)
      const catRows = await query<{ nome: string; tipo: string; classeFim: string }>(
        `SELECT nome, tipo, "classeFim" FROM public.disciplinas WHERE ativo = true`
      );
      const catalog = new Map(catRows.map(d => [d.nome, d]));

      // ── 10ª CLASSE ─────────────────────────────────────────────────────────
      if (classeAtual === '10') {
        type Situacao10 = 'aprovado' | 'negativa_exame_terminal' | 'negativa_continuidade' | 'reprova_abaixo_minimo';

        const disciplinas = notasRows.map(row => {
          const media = parseFloat(row.mediaAnual);
          const info  = catalog.get(row.disciplina);
          const tipo  = info?.tipo ?? 'continuidade';
          const classeFim = info?.classeFim ?? '';

          const isNeg        = media < notaMin;
          const isAbaixoMin  = media < notaMinAbsoluta;
          const isTerminal10 = tipo === 'terminal' && classeFim === '10';

          let situacao: Situacao10;
          if (isAbaixoMin) {
            situacao = 'reprova_abaixo_minimo';
          } else if (isNeg && isTerminal10) {
            situacao = 'negativa_exame_terminal';
          } else if (isNeg) {
            situacao = 'negativa_continuidade';
          } else {
            situacao = 'aprovado';
          }

          return {
            disciplina: row.disciplina,
            tipo,
            classeFim,
            mediaAnual: media,
            numTrimestres: parseInt(row.numTrimestres),
            situacao,
          };
        });

        const reprovadosAbsoluto  = disciplinas.filter(d => d.situacao === 'reprova_abaixo_minimo');
        const negativas           = disciplinas.filter(d => d.mediaAnual < notaMin);
        const numNegativas        = negativas.length;

        type SituacaoGeral = 'aprovado' | 'aprovado_com_condicoes' | 'reprovado';
        let situacaoGeral: SituacaoGeral;
        let motivoGeral: string;

        if (reprovadosAbsoluto.length > 0) {
          situacaoGeral = 'reprovado';
          motivoGeral   = `Média abaixo do mínimo absoluto (${notaMinAbsoluta} valores) em: ${reprovadosAbsoluto.map(d => d.disciplina).join(', ')} — Reprova directamente`;
        } else if (numNegativas > maxNegativasPermitidas10) {
          situacaoGeral = 'reprovado';
          motivoGeral   = `${numNegativas} negativas — máximo permitido na 10ª classe é ${maxNegativasPermitidas10}`;
        } else if (numNegativas > 0) {
          situacaoGeral = 'aprovado_com_condicoes';
          const exames = disciplinas.filter(d => d.situacao === 'negativa_exame_terminal').map(d => d.disciplina);
          const arrastadas = disciplinas.filter(d => d.situacao === 'negativa_continuidade').map(d => d.disciplina);
          const partes: string[] = [];
          if (exames.length)    partes.push(`Exame de Época Normal (terminal): ${exames.join(', ')}`);
          if (arrastadas.length) partes.push(`Disciplina${arrastadas.length > 1 ? 's' : ''} de continuidade arrastada${arrastadas.length > 1 ? 's' : ''} para 11ª/12ª: ${arrastadas.join(', ')}`);
          motivoGeral = partes.join(' | ');
        } else {
          situacaoGeral = 'aprovado';
          motivoGeral   = 'Aprovado — sem negativas, pode avançar para a 11ª classe';
        }

        return json(res, 200, {
          alunoId,
          nomeAluno: `${aluno.nome} ${aluno.apelido}`,
          classe: classeAtual,
          anoLetivo,
          notaMin,
          notaMinAbsoluta,
          maxNegativasPermitidas: maxNegativasPermitidas10,
          situacaoGeral,
          motivoGeral,
          disciplinas,
        });
      }

      // ── 11ª CLASSE ─────────────────────────────────────────────────────────
      if (classeAtual === '11') {
        const notaMinAbsoluta11 = 7;

        // Histórico da 10ª classe para este aluno (médias por disciplina)
        const historico10Rows = await query<{ disciplina: string; mediaAnual: string }>(`
          SELECT
            n.disciplina,
            ROUND(AVG(n.nf)::numeric, 2)::text AS "mediaAnual"
          FROM public.notas n
          JOIN public.turmas t ON t.id = n."turmaId"
          WHERE n."alunoId" = $1 AND t.classe = '10'
          GROUP BY n.disciplina
        `, [alunoId]);

        const historico10 = new Map(historico10Rows.map(r => [r.disciplina, parseFloat(r.mediaAnual)]));

        type Situacao11 =
          | 'aprovado'
          | 'reprova_r1'
          | 'negativa_exame_terminal'
          | 'negativa_continuidade'
          | 'reprova_abaixo_minimo';

        const disciplinas11 = notasRows.map(row => {
          const media      = parseFloat(row.mediaAnual);
          const info       = catalog.get(row.disciplina);
          const tipo       = info?.tipo ?? 'continuidade';
          const classeFim  = info?.classeFim ?? '';

          const isNeg        = media < notaMin;
          const isAbaixoMin  = media < notaMinAbsoluta11;
          const isTerminal11 = tipo === 'terminal' && classeFim === '11';

          const media10   = historico10.get(row.disciplina) ?? null;
          const hadNeg10  = media10 !== null && media10 < notaMin;

          let situacao: Situacao11;
          let motivo = '';

          if (isAbaixoMin) {
            situacao = 'reprova_abaixo_minimo';
            motivo   = `Média de ${media.toFixed(1)} abaixo do mínimo absoluto de ${notaMinAbsoluta11} valores`;
          } else if (isNeg && !isTerminal11 && hadNeg10) {
            // R1 — negativa consecutiva (10ª + 11ª) numa disciplina de continuidade
            situacao = 'reprova_r1';
            motivo   = `Negativa consecutiva — 10ª: ${media10!.toFixed(1)} + 11ª: ${media.toFixed(1)} — Reprova sem direito a exame (R1)`;
          } else if (isNeg && isTerminal11) {
            situacao = 'negativa_exame_terminal';
            motivo   = `Disciplina terminal na 11ª classe — Exame de Época Normal obrigatório`;
          } else if (isNeg) {
            situacao = 'negativa_continuidade';
            motivo   = `Negativa arrastada para a 12ª classe${media10 !== null ? ` (10ª: ${media10.toFixed(1)})` : ''}`;
          } else {
            situacao = 'aprovado';
          }

          return {
            disciplina:    row.disciplina,
            tipo,
            classeFim,
            mediaAnual:    media,
            media10,
            numTrimestres: parseInt(row.numTrimestres),
            situacao,
            motivo,
          };
        });

        const reprovadosAbsoluto = disciplinas11.filter(d => d.situacao === 'reprova_abaixo_minimo');
        const reprovadosR1       = disciplinas11.filter(d => d.situacao === 'reprova_r1');
        const examesTerminal     = disciplinas11.filter(d => d.situacao === 'negativa_exame_terminal');
        const negativasCont      = disciplinas11.filter(d => d.situacao === 'negativa_continuidade');
        const numNegativas       = disciplinas11.filter(d => d.mediaAnual < notaMin).length;

        type SituacaoGeral11 = 'aprovado' | 'aprovado_com_condicoes' | 'reprovado';
        let situacaoGeral: SituacaoGeral11;
        let motivoGeral: string;

        if (reprovadosAbsoluto.length > 0 || reprovadosR1.length > 0) {
          situacaoGeral = 'reprovado';
          const partes: string[] = [];
          if (reprovadosAbsoluto.length > 0)
            partes.push(`Média abaixo de ${notaMinAbsoluta11} em: ${reprovadosAbsoluto.map(d => d.disciplina).join(', ')}`);
          if (reprovadosR1.length > 0)
            partes.push(`Negativas consecutivas (R1) em: ${reprovadosR1.map(d => d.disciplina).join(', ')}`);
          motivoGeral = partes.join(' | ');
        } else if (examesTerminal.length > 0 || negativasCont.length > 0) {
          situacaoGeral = 'aprovado_com_condicoes';
          const partes: string[] = [];
          if (examesTerminal.length > 0)
            partes.push(`Exame Época Normal (terminal 11ª): ${examesTerminal.map(d => d.disciplina).join(', ')}`);
          if (negativasCont.length > 0)
            partes.push(`Negativa${negativasCont.length > 1 ? 's' : ''} arrastada${negativasCont.length > 1 ? 's' : ''} para 12ª: ${negativasCont.map(d => d.disciplina).join(', ')}`);
          motivoGeral = partes.join(' | ');
        } else {
          situacaoGeral = 'aprovado';
          motivoGeral   = 'Aprovado — pode avançar para a 12ª classe';
        }

        return json(res, 200, {
          alunoId,
          nomeAluno:    `${aluno.nome} ${aluno.apelido}`,
          classe:       classeAtual,
          anoLetivo,
          notaMin,
          notaMinAbsoluta: notaMinAbsoluta11,
          situacaoGeral,
          motivoGeral,
          numNegativas,
          disciplinas:  disciplinas11,
        });
      }

      // ── 12ª CLASSE ─────────────────────────────────────────────────────────
      const disciplinas = notasRows.map(row => {
        const media = parseFloat(row.mediaAnual);
        const info  = catalog.get(row.disciplina);
        const tipo  = info?.tipo ?? 'continuidade';
        return {
          disciplina: row.disciplina,
          tipo,
          mediaAnual: media,
          numTrimestres: parseInt(row.numTrimestres),
          aprovado: media >= notaMin,
        };
      });

      return json(res, 200, {
        alunoId,
        nomeAluno: `${aluno.nome} ${aluno.apelido}`,
        classe: classeAtual,
        anoLetivo,
        notaMin,
        disciplinas,
        info: 'Ano de fecho das disciplinas de continuidade. O Exame de Época Normal é aplicado no final deste ano para fechar o plano curricular.',
      });

    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  // -----------------------
  // PAP — PROVA DE APTIDÃO PROFISSIONAL (13ª Classe)
  // -----------------------

  // GET /api/pap-alunos?turmaId=&anoLetivo=
  app.get("/api/pap-alunos", requireAuth, async (req: Request, res: Response) => {
    try {
      const { turmaId, anoLetivo, alunoId } = req.query as Record<string, string>;
      if (alunoId) {
        const rows = await query<JsonObject>(
          `SELECT pa.*, a.nome, a.apelido, a."numeroMatricula"
           FROM public.pap_alunos pa
           JOIN public.alunos a ON a.id = pa."alunoId"
           WHERE pa."alunoId"=$1 AND pa."anoLetivo"=$2
           LIMIT 1`,
          [alunoId, anoLetivo || '']
        );
        return json(res, 200, rows[0] || null);
      }
      if (!turmaId) return json(res, 400, { error: "turmaId obrigatório" });
      const rows = await query<JsonObject>(
        `SELECT pa.*, a.nome, a.apelido, a."numeroMatricula"
         FROM public.pap_alunos pa
         JOIN public.alunos a ON a.id = pa."alunoId"
         WHERE pa."turmaId"=$1 ${anoLetivo ? `AND pa."anoLetivo"=$2` : ''}
         ORDER BY a.nome`,
        anoLetivo ? [turmaId, anoLetivo] : [turmaId]
      );
      json(res, 200, rows);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  // POST /api/pap-alunos — upsert (create or update)
  app.post("/api/pap-alunos", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { alunoId, turmaId, anoLetivo, professorId, notaEstagio, notaDefesa, notasDisciplinas, observacoes } = b as Record<string, unknown>;
      if (!alunoId || !turmaId || !anoLetivo || !professorId) {
        return json(res, 400, { error: "alunoId, turmaId, anoLetivo e professorId são obrigatórios" });
      }

      const disciplinas: { nome: string; nota: number }[] = Array.isArray(notasDisciplinas) ? notasDisciplinas as { nome: string; nota: number }[] : [];
      const estagio = typeof notaEstagio === 'number' ? notaEstagio : (notaEstagio !== null && notaEstagio !== undefined ? parseFloat(String(notaEstagio)) : null);
      const defesa = typeof notaDefesa === 'number' ? notaDefesa : (notaDefesa !== null && notaDefesa !== undefined ? parseFloat(String(notaDefesa)) : null);

      // Calcula Nota PAP: soma dos componentes / número de componentes presentes
      // Sem disciplinas: (Estágio + Defesa) / 2
      // Com disciplinas: (Estágio + Defesa + Média_Disciplinas) / 3
      let notaPAP: number | null = null;
      if (defesa !== null && !isNaN(defesa)) {
        let soma = defesa;
        let divisor = 1;
        if (estagio !== null && !isNaN(estagio)) { soma += estagio; divisor++; }
        if (disciplinas.length > 0) {
          const avgDisc = disciplinas.reduce((s: number, d: { nome: string; nota: number }) => s + d.nota, 0) / disciplinas.length;
          soma += avgDisc;
          divisor++;
        }
        notaPAP = Math.round((soma / divisor) * 10) / 10;
      }

      const existing = await query<JsonObject>(
        `SELECT id FROM public.pap_alunos WHERE "alunoId"=$1 AND "anoLetivo"=$2 LIMIT 1`,
        [alunoId, anoLetivo]
      );

      let rows: JsonObject[];
      if (existing.length > 0) {
        rows = await query<JsonObject>(
          `UPDATE public.pap_alunos
           SET "turmaId"=$1, "professorId"=$2, "notaEstagio"=$3, "notaDefesa"=$4,
               "notasDisciplinas"=$5::jsonb, "notaPAP"=$6, "observacoes"=$7, "updatedAt"=NOW()
           WHERE "alunoId"=$8 AND "anoLetivo"=$9
           RETURNING *`,
          [turmaId, professorId, estagio, defesa, JSON.stringify(disciplinas), notaPAP, observacoes || null, alunoId, anoLetivo]
        );
      } else {
        rows = await query<JsonObject>(
          `INSERT INTO public.pap_alunos ("alunoId","turmaId","anoLetivo","professorId","notaEstagio","notaDefesa","notasDisciplinas","notaPAP","observacoes")
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
           RETURNING *`,
          [alunoId, turmaId, anoLetivo, professorId, estagio, defesa, JSON.stringify(disciplinas), notaPAP, observacoes || null]
        );
      }
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  // =============================================================================
  // CONFIGURAÇÕES DE FALTA (Director de Turma)
  // =============================================================================

  // GET /api/configuracoes-falta?turmaId=&anoLetivo=
  app.get("/api/configuracoes-falta", requireAuth, async (req: Request, res: Response) => {
    try {
      const { turmaId, anoLetivo } = req.query as Record<string, string>;
      let sql = `SELECT cf.*, t.nome as "turmaNome" FROM public.configuracoes_falta cf
        LEFT JOIN public.turmas t ON t.id = cf."turmaId" WHERE 1=1`;
      const params: unknown[] = [];
      if (turmaId) { params.push(turmaId); sql += ` AND cf."turmaId"=$${params.length}`; }
      if (anoLetivo) { params.push(anoLetivo); sql += ` AND cf."anoLetivo"=$${params.length}`; }
      sql += ' ORDER BY cf."createdAt" DESC';
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // POST /api/configuracoes-falta
  app.post("/api/configuracoes-falta", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { turmaId, disciplina, anoLetivo, maxFaltasMensais, definidoPor, definidoPorId } = b as Record<string, unknown>;
      if (!turmaId || !disciplina || !anoLetivo) return json(res, 400, { error: "turmaId, disciplina e anoLetivo são obrigatórios" });
      const max = typeof maxFaltasMensais === 'number' ? maxFaltasMensais : 3;
      const existing = await query<JsonObject>(
        `SELECT id FROM public.configuracoes_falta WHERE "turmaId"=$1 AND disciplina=$2 AND "anoLetivo"=$3 LIMIT 1`,
        [turmaId, disciplina, anoLetivo]
      );
      let row: JsonObject;
      if (existing.length > 0) {
        const rows = await query<JsonObject>(
          `UPDATE public.configuracoes_falta SET "maxFaltasMensais"=$1, "definidoPor"=$2, "definidoPorId"=$3, "updatedAt"=NOW()
           WHERE "turmaId"=$4 AND disciplina=$5 AND "anoLetivo"=$6 RETURNING *`,
          [max, definidoPor || '', definidoPorId || null, turmaId, disciplina, anoLetivo]
        );
        row = rows[0];
      } else {
        const rows = await query<JsonObject>(
          `INSERT INTO public.configuracoes_falta ("turmaId",disciplina,"anoLetivo","maxFaltasMensais","definidoPor","definidoPorId")
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [turmaId, disciplina, anoLetivo, max, definidoPor || '', definidoPorId || null]
        );
        row = rows[0];
      }
      json(res, 200, row);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // PUT /api/configuracoes-falta/:id
  app.put("/api/configuracoes-falta/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { maxFaltasMensais, ativo } = b as Record<string, unknown>;
      const rows = await query<JsonObject>(
        `UPDATE public.configuracoes_falta SET "maxFaltasMensais"=$1, ativo=$2, "updatedAt"=NOW() WHERE id=$3 RETURNING *`,
        [maxFaltasMensais ?? 3, ativo !== false, id]
      );
      if (!rows.length) return json(res, 404, { error: "Não encontrado" });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // =============================================================================
  // REGISTOS MENSAIS DE FALTAS
  // =============================================================================

  // GET /api/registos-falta-mensal?turmaId=&alunoId=&mes=&ano=&disciplina=
  app.get("/api/registos-falta-mensal", requireAuth, async (req: Request, res: Response) => {
    try {
      const { turmaId, alunoId, mes, ano, disciplina, trimestre, anoLetivo } = req.query as Record<string, string>;
      let sql = `SELECT r.*, a.nome || ' ' || a.apelido as "alunoNomeCompleto", t.nome as "turmaNome"
        FROM public.registos_falta_mensal r
        LEFT JOIN public.alunos a ON a.id = r."alunoId"
        LEFT JOIN public.turmas t ON t.id = r."turmaId"
        WHERE 1=1`;
      const params: unknown[] = [];
      if (turmaId) { params.push(turmaId); sql += ` AND r."turmaId"=$${params.length}`; }
      if (alunoId) { params.push(alunoId); sql += ` AND r."alunoId"=$${params.length}`; }
      if (mes) { params.push(parseInt(mes)); sql += ` AND r.mes=$${params.length}`; }
      if (ano) { params.push(parseInt(ano)); sql += ` AND r.ano=$${params.length}`; }
      if (disciplina) { params.push(disciplina); sql += ` AND r.disciplina=$${params.length}`; }
      if (trimestre) { params.push(parseInt(trimestre)); sql += ` AND r.trimestre=$${params.length}`; }
      sql += ' ORDER BY r.ano DESC, r.mes DESC, r."createdAt" DESC';
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // POST /api/registos-falta-mensal — cria ou actualiza registo mensal
  app.post("/api/registos-falta-mensal", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { alunoId, turmaId, disciplina, mes, ano, trimestre, totalFaltas, faltasJustificadas,
        faltasInjustificadas, status, observacao, registadoPor, registadoPorId, dataRegisto } = b as Record<string, unknown>;
      if (!alunoId || !turmaId || !disciplina || !mes || !ano) {
        return json(res, 400, { error: "alunoId, turmaId, disciplina, mes e ano são obrigatórios" });
      }
      const existing = await query<JsonObject>(
        `SELECT id FROM public.registos_falta_mensal WHERE "alunoId"=$1 AND "turmaId"=$2 AND disciplina=$3 AND mes=$4 AND ano=$5 LIMIT 1`,
        [alunoId, turmaId, disciplina, mes, ano]
      );
      let row: JsonObject;
      if (existing.length > 0) {
        const rows = await query<JsonObject>(
          `UPDATE public.registos_falta_mensal
           SET trimestre=$1, "totalFaltas"=$2, "faltasJustificadas"=$3, "faltasInjustificadas"=$4,
               status=$5, observacao=$6, "registadoPor"=$7, "registadoPorId"=$8, "dataRegisto"=$9
           WHERE "alunoId"=$10 AND "turmaId"=$11 AND disciplina=$12 AND mes=$13 AND ano=$14 RETURNING *`,
          [trimestre || 1, totalFaltas || 0, faltasJustificadas || 0, faltasInjustificadas || 0,
           status || 'normal', observacao || '', registadoPor || '', registadoPorId || null,
           dataRegisto || new Date().toISOString().slice(0, 10),
           alunoId, turmaId, disciplina, mes, ano]
        );
        row = rows[0];
      } else {
        const rows = await query<JsonObject>(
          `INSERT INTO public.registos_falta_mensal
           ("alunoId","turmaId",disciplina,mes,ano,trimestre,"totalFaltas","faltasJustificadas","faltasInjustificadas",status,observacao,"registadoPor","registadoPorId","dataRegisto")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [alunoId, turmaId, disciplina, mes, ano, trimestre || 1, totalFaltas || 0, faltasJustificadas || 0,
           faltasInjustificadas || 0, status || 'normal', observacao || '', registadoPor || '',
           registadoPorId || null, dataRegisto || new Date().toISOString().slice(0, 10)]
        );
        row = rows[0];
      }
      json(res, 200, row);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // GET /api/registos-falta-mensal/resumo-trimestral?turmaId=&trimestre=&anoLetivo=
  // Agrega registos mensais de um trimestre para relatório trimestral
  app.get("/api/registos-falta-mensal/resumo-trimestral", requireAuth, async (req: Request, res: Response) => {
    try {
      const { turmaId, trimestre, anoLetivo } = req.query as Record<string, string>;
      if (!turmaId || !trimestre) return json(res, 400, { error: "turmaId e trimestre são obrigatórios" });
      const rows = await query<JsonObject>(
        `SELECT r."alunoId", a.nome || ' ' || a.apelido as "alunoNome", r.disciplina,
           SUM(r."totalFaltas") as "totalFaltas",
           SUM(r."faltasJustificadas") as "faltasJustificadas",
           SUM(r."faltasInjustificadas") as "faltasInjustificadas",
           MAX(r.status) as "piorStatus"
         FROM public.registos_falta_mensal r
         LEFT JOIN public.alunos a ON a.id = r."alunoId"
         WHERE r."turmaId"=$1 AND r.trimestre=$2
         GROUP BY r."alunoId", a.nome, a.apelido, r.disciplina
         ORDER BY a.nome, r.disciplina`,
        [turmaId, parseInt(trimestre)]
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // =============================================================================
  // EXCLUSÕES POR FALTA
  // =============================================================================

  // GET /api/exclusoes-falta?turmaId=&anoLetivo=&alunoId=
  app.get("/api/exclusoes-falta", requireAuth, async (req: Request, res: Response) => {
    try {
      const { turmaId, anoLetivo, alunoId, tipoExclusao } = req.query as Record<string, string>;
      let sql = `SELECT e.*, a.nome || ' ' || a.apelido as "alunoNomeCompleto", a."numeroMatricula",
          t.nome as "turmaNome"
         FROM public.exclusoes_falta e
         LEFT JOIN public.alunos a ON a.id = e."alunoId"
         LEFT JOIN public.turmas t ON t.id = e."turmaId"
         WHERE 1=1`;
      const params: unknown[] = [];
      if (turmaId) { params.push(turmaId); sql += ` AND e."turmaId"=$${params.length}`; }
      if (anoLetivo) { params.push(anoLetivo); sql += ` AND e."anoLetivo"=$${params.length}`; }
      if (alunoId) { params.push(alunoId); sql += ` AND e."alunoId"=$${params.length}`; }
      if (tipoExclusao) { params.push(tipoExclusao); sql += ` AND e."tipoExclusao"=$${params.length}`; }
      sql += ' ORDER BY e."createdAt" DESC';
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // POST /api/exclusoes-falta
  app.post("/api/exclusoes-falta", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { alunoId, turmaId, disciplina, anoLetivo, trimestre, mes, ano,
        totalFaltasAcumuladas, limiteFaltas, tipoExclusao, motivo, observacao,
        registadoPor, registadoPorId, dataExclusao } = b as Record<string, unknown>;
      if (!alunoId || !turmaId || !disciplina || !anoLetivo) {
        return json(res, 400, { error: "alunoId, turmaId, disciplina e anoLetivo são obrigatórios" });
      }
      const rows = await query<JsonObject>(
        `INSERT INTO public.exclusoes_falta
         ("alunoId","turmaId",disciplina,"anoLetivo",trimestre,mes,ano,"totalFaltasAcumuladas","limiteFaltas",
          "tipoExclusao",motivo,observacao,"registadoPor","registadoPorId","dataExclusao")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [alunoId, turmaId, disciplina, anoLetivo, trimestre || 1, mes || new Date().getMonth() + 1,
         ano || new Date().getFullYear(), totalFaltasAcumuladas || 0, limiteFaltas || 3,
         tipoExclusao || 'exclusao_disciplina', motivo || '', observacao || '',
         registadoPor || '', registadoPorId || null,
         dataExclusao || new Date().toISOString().slice(0, 10)]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // PUT /api/exclusoes-falta/:id — anular/actualizar exclusão
  app.put("/api/exclusoes-falta/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { status, observacao } = b as Record<string, unknown>;
      const rows = await query<JsonObject>(
        `UPDATE public.exclusoes_falta SET status=$1, observacao=$2 WHERE id=$3 RETURNING *`,
        [status || 'ativo', observacao || '', id]
      );
      if (!rows.length) return json(res, 404, { error: "Não encontrado" });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // =============================================================================
  // SOLICITAÇÕES DE PROVA JUSTIFICADA
  // =============================================================================

  // GET /api/solicitacoes-prova-justificada?turmaId=&status=&alunoId=
  app.get("/api/solicitacoes-prova-justificada", requireAuth, async (req: Request, res: Response) => {
    try {
      const { turmaId, status, alunoId, anoLetivo, trimestre } = req.query as Record<string, string>;
      let sql = `SELECT s.*, a.nome || ' ' || a.apelido as "alunoNomeCompleto", a."numeroMatricula",
           t.nome as "turmaNome"
         FROM public.solicitacoes_prova_justificada s
         LEFT JOIN public.alunos a ON a.id = s."alunoId"
         LEFT JOIN public.turmas t ON t.id = s."turmaId"
         WHERE 1=1`;
      const params: unknown[] = [];
      if (turmaId) { params.push(turmaId); sql += ` AND s."turmaId"=$${params.length}`; }
      if (alunoId) { params.push(alunoId); sql += ` AND s."alunoId"=$${params.length}`; }
      if (status) { params.push(status); sql += ` AND s.status=$${params.length}`; }
      if (anoLetivo) { params.push(anoLetivo); sql += ` AND s."anoLetivo"=$${params.length}`; }
      if (trimestre) { params.push(parseInt(trimestre)); sql += ` AND s.trimestre=$${params.length}`; }
      sql += ' ORDER BY s."createdAt" DESC';
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // POST /api/solicitacoes-prova-justificada
  app.post("/api/solicitacoes-prova-justificada", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { alunoId, turmaId, disciplina, anoLetivo, trimestre, tipoProva,
        dataProvaOriginal, dataProvaJustificada, motivo, documentoJustificacao,
        solicitadoPor, solicitadoPorId } = b as Record<string, unknown>;
      if (!alunoId || !turmaId || !disciplina || !anoLetivo || !trimestre || !dataProvaOriginal || !motivo) {
        return json(res, 400, { error: "Campos obrigatórios em falta" });
      }
      const rows = await query<JsonObject>(
        `INSERT INTO public.solicitacoes_prova_justificada
         ("alunoId","turmaId",disciplina,"anoLetivo",trimestre,"tipoProva","dataProvaOriginal",
          "dataProvaJustificada",motivo,"documentoJustificacao","solicitadoPor","solicitadoPorId")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [alunoId, turmaId, disciplina, anoLetivo, trimestre, tipoProva || 'teste',
         dataProvaOriginal, dataProvaJustificada || null, motivo,
         documentoJustificacao || null, solicitadoPor || '', solicitadoPorId || null]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // PUT /api/solicitacoes-prova-justificada/:id — responder/actualizar
  app.put("/api/solicitacoes-prova-justificada/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { status, resposta, respondidoPor, respondidoEm, dataProvaJustificada } = b as Record<string, unknown>;
      const rows = await query<JsonObject>(
        `UPDATE public.solicitacoes_prova_justificada
         SET status=$1, resposta=$2, "respondidoPor"=$3, "respondidoEm"=$4,
             "dataProvaJustificada"=$5, "updatedAt"=NOW()
         WHERE id=$6 RETURNING *`,
        [status || 'pendente', resposta || '', respondidoPor || '',
         respondidoEm || new Date().toISOString().slice(0, 10),
         dataProvaJustificada || null, id]
      );
      if (!rows.length) return json(res, 404, { error: "Não encontrado" });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // =============================================================================
  // ANULAÇÕES DE MATRÍCULA
  // =============================================================================

  // GET /api/anulacoes-matricula?anoLetivo=&alunoId=
  app.get("/api/anulacoes-matricula", requireAuth, async (req: Request, res: Response) => {
    try {
      const { anoLetivo, alunoId, status } = req.query as Record<string, string>;
      let sql = `SELECT am.*, t.nome as "turmaNome"
         FROM public.anulacoes_matricula am
         LEFT JOIN public.turmas t ON t.id = am."turmaId"
         WHERE 1=1`;
      const params: unknown[] = [];
      if (anoLetivo) { params.push(anoLetivo); sql += ` AND am."anoLetivo"=$${params.length}`; }
      if (alunoId) { params.push(alunoId); sql += ` AND am."alunoId"=$${params.length}`; }
      if (status) { params.push(status); sql += ` AND am.status=$${params.length}`; }
      sql += ' ORDER BY am."createdAt" DESC';
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // POST /api/anulacoes-matricula
  app.post("/api/anulacoes-matricula", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { alunoId, alunoNome, turmaId, turmaNome, anoLetivo, motivo, descricao,
        dataAnulacao, registadoPor, registadoPorId, reAdmissaoPermitida, observacoes } = b as Record<string, unknown>;
      if (!alunoId || !alunoNome || !anoLetivo || !motivo || !dataAnulacao) {
        return json(res, 400, { error: "Campos obrigatórios em falta" });
      }
      const rows = await query<JsonObject>(
        `INSERT INTO public.anulacoes_matricula
         ("alunoId","alunoNome","turmaId","turmaNome","anoLetivo",motivo,descricao,
          "dataAnulacao","registadoPor","registadoPorId","reAdmissaoPermitida",observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [alunoId, alunoNome, turmaId || null, turmaNome || '', anoLetivo, motivo, descricao || '',
         dataAnulacao, registadoPor || '', registadoPorId || null,
         reAdmissaoPermitida !== false, observacoes || '']
      );
      // Marcar aluno como inactivo
      await query(`UPDATE public.alunos SET ativo=false WHERE id=$1`, [alunoId]);
      json(res, 201, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // PUT /api/anulacoes-matricula/:id
  app.put("/api/anulacoes-matricula/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { status, observacoes, reAdmissaoPermitida } = b as Record<string, unknown>;
      const rows = await query<JsonObject>(
        `UPDATE public.anulacoes_matricula SET status=$1, observacoes=$2, "reAdmissaoPermitida"=$3 WHERE id=$4 RETURNING *`,
        [status || 'ativa', observacoes || '', reAdmissaoPermitida !== false, id]
      );
      if (!rows.length) return json(res, 404, { error: "Não encontrado" });
      // Se revertida, reactivar o aluno
      if (status === 'revertida') {
        const r = rows[0] as JsonObject;
        await query(`UPDATE public.alunos SET ativo=true WHERE id=$1`, [r.alunoId]);
      }
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // =============================================================================
  // QUADRO DE HONRA
  // =============================================================================

  // GET /api/quadro-honra?anoLetivo=&trimestre=&turmaId=
  app.get("/api/quadro-honra", requireAuth, async (req: Request, res: Response) => {
    try {
      const { anoLetivo, trimestre, turmaId } = req.query as Record<string, string>;
      let sql = `SELECT qh.*, a.nome || ' ' || a.apelido as "alunoNomeCompleto",
           a."numeroMatricula", a.foto, t.nome as "turmaNome", t.classe
         FROM public.quadro_honra qh
         LEFT JOIN public.alunos a ON a.id = qh."alunoId"
         LEFT JOIN public.turmas t ON t.id = qh."turmaId"
         WHERE 1=1`;
      const params: unknown[] = [];
      if (anoLetivo) { params.push(anoLetivo); sql += ` AND qh."anoLetivo"=$${params.length}`; }
      if (trimestre) { params.push(parseInt(trimestre)); sql += ` AND qh.trimestre=$${params.length}`; }
      if (turmaId) { params.push(turmaId); sql += ` AND qh."turmaId"=$${params.length}`; }
      sql += ' ORDER BY qh."posicaoGeral" ASC NULLS LAST, qh."posicaoClasse" ASC';
      const rows = await query<JsonObject>(sql, params);
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // POST /api/quadro-honra/gerar — calcula e persiste o quadro de honra a partir das notas
  app.post("/api/quadro-honra/gerar", requireAuth, async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const { anoLetivo, trimestre, geradoPor } = b as Record<string, unknown>;
      if (!anoLetivo) return json(res, 400, { error: "anoLetivo é obrigatório" });

      // Agregar médias por aluno (considerando apenas alunos activos com notas lançadas)
      let mediasQuery = `
        SELECT n."alunoId", n."turmaId", n."anoLetivo",
          AVG(n.nf) as "mediaGeral",
          COUNT(DISTINCT n.disciplina) as "numDisciplinas"
        FROM public.notas n
        WHERE n."anoLetivo"=$1 AND n.nf > 0`;
      const params: unknown[] = [anoLetivo];
      if (trimestre) { params.push(trimestre); mediasQuery += ` AND n.trimestre=$${params.length}`; }
      mediasQuery += ` GROUP BY n."alunoId", n."turmaId", n."anoLetivo"
        HAVING COUNT(DISTINCT n.disciplina) >= 1
        ORDER BY AVG(n.nf) DESC`;

      const medias = await query<JsonObject>(mediasQuery, params);
      if (!medias.length) return json(res, 200, { gerados: 0, msg: "Sem dados suficientes" });

      // Calcular posição por turma
      const porTurma: Record<string, JsonObject[]> = {};
      for (const m of medias) {
        const tid = String(m.turmaId);
        if (!porTurma[tid]) porTurma[tid] = [];
        porTurma[tid].push(m);
      }

      // Limpar entradas anteriores do mesmo período
      await query(
        `DELETE FROM public.quadro_honra WHERE "anoLetivo"=$1 AND ($2::int IS NULL OR trimestre=$2::int)`,
        [anoLetivo, trimestre ? parseInt(String(trimestre)) : null]
      );

      // Obter nomes de turmas
      const turmaRows = await query<JsonObject>(`SELECT id, nome FROM public.turmas`);
      const turmaNomeMap: Record<string, string> = {};
      for (const t of turmaRows) turmaNomeMap[String(t.id)] = String(t.nome);

      // Obter nomes de alunos
      const alunoRows = await query<JsonObject>(`SELECT id, nome, apelido FROM public.alunos`);
      const alunoNomeMap: Record<string, string> = {};
      for (const a of alunoRows) alunoNomeMap[String(a.id)] = `${a.nome} ${a.apelido}`;

      let posicaoGeral = 0;
      const insertedIds: string[] = [];

      for (const [turmaId, alunos] of Object.entries(porTurma)) {
        // Ordenar por média (já estão ordenados, mas garantir por turma)
        alunos.sort((a, b) => Number(b.mediaGeral) - Number(a.mediaGeral));

        for (let i = 0; i < alunos.length; i++) {
          posicaoGeral++;
          const m = alunos[i];
          const media = Number(m.mediaGeral);

          let mencao = '';
          if (media >= 18) mencao = 'excelencia';
          else if (media >= 15) mencao = 'louvor';
          else if (media >= 14) mencao = 'honra';

          const isMelhorEscola = posicaoGeral === 1;

          const rows = await query<JsonObject>(
            `INSERT INTO public.quadro_honra
             ("alunoId","alunoNome","turmaId","turmaNome","anoLetivo",trimestre,"mediaGeral",
              "posicaoClasse","posicaoGeral","melhorEscola",mencionado,publicado,"geradoPor")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12) RETURNING id`,
            [m.alunoId, alunoNomeMap[String(m.alunoId)] || '', turmaId,
             turmaNomeMap[turmaId] || '', anoLetivo,
             trimestre ? parseInt(String(trimestre)) : null,
             Math.round(media * 100) / 100, i + 1, posicaoGeral,
             isMelhorEscola, mencao, geradoPor || 'Sistema']
          );
          insertedIds.push(String(rows[0].id));
        }
      }

      json(res, 201, { gerados: insertedIds.length, ids: insertedIds });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // PUT /api/quadro-honra/:id — publicar/despublicar
  app.put("/api/quadro-honra/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const { publicado } = b as Record<string, unknown>;
      const rows = await query<JsonObject>(
        `UPDATE public.quadro_honra SET publicado=$1 WHERE id=$2 RETURNING *`,
        [publicado !== false, id]
      );
      if (!rows.length) return json(res, 404, { error: "Não encontrado" });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // DELETE /api/quadro-honra?anoLetivo=&trimestre=
  app.delete("/api/quadro-honra", requireAuth, async (req: Request, res: Response) => {
    try {
      const { anoLetivo, trimestre } = req.query as Record<string, string>;
      if (!anoLetivo) return json(res, 400, { error: "anoLetivo é obrigatório" });
      await query(
        `DELETE FROM public.quadro_honra WHERE "anoLetivo"=$1 AND ($2::int IS NULL OR trimestre=$2::int)`,
        [anoLetivo, trimestre ? parseInt(trimestre) : null]
      );
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // =============================================================================
  // VERIFICAÇÃO DE DUPLA REPROVAÇÃO (para uso pelo sistema de exclusão automática)
  // =============================================================================

  // GET /api/dupla-reprovacao/verificar?alunoId=&classe=
  app.get("/api/dupla-reprovacao/verificar", requireAuth, async (req: Request, res: Response) => {
    try {
      const { alunoId, classe } = req.query as Record<string, string>;
      if (!alunoId) return json(res, 400, { error: "alunoId é obrigatório" });

      // Verificar configuração global de exclusão por dupla reprovação
      const config = await query<JsonObject>(`SELECT "exclusaoDuasReprovacoes" FROM public.config_geral LIMIT 1`);
      const habilitado = config.length > 0 && config[0].exclusaoDuasReprovacoes === true;

      if (!habilitado) return json(res, 200, { habilitado: false, reprovacoes: [], risco: false });

      // Contar reprovações (nf < 10) por classe a partir das notas históricas
      // Uma reprovação = todos os trimestres do ano com nf < 10 em pelo menos 3 disciplinas
      let sql = `
        SELECT n."anoLetivo", n."turmaId", t.classe,
          COUNT(DISTINCT CASE WHEN n.nf < 10 THEN n.disciplina END) as "disciplinasReprovadas",
          COUNT(DISTINCT n.disciplina) as "totalDisciplinas"
        FROM public.notas n
        LEFT JOIN public.turmas t ON t.id = n."turmaId"
        WHERE n."alunoId"=$1`;
      const params: unknown[] = [alunoId];
      if (classe) { params.push(classe); sql += ` AND t.classe=$${params.length}`; }
      sql += ` GROUP BY n."anoLetivo", n."turmaId", t.classe
               HAVING COUNT(DISTINCT CASE WHEN n.nf < 10 THEN n.disciplina END) >= 3
               ORDER BY n."anoLetivo"`;

      const reprovacoes = await query<JsonObject>(sql, params);
      const risco = habilitado && reprovacoes.length >= 2;

      json(res, 200, { habilitado, reprovacoes, risco, numReprovacoes: reprovacoes.length });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // ─── PROCESSOS SECRETARIA ─────────────────────────────────────────────────
  app.get("/api/processos-secretaria", requireAuth, async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT * FROM public.processos_secretaria ORDER BY "createdAt" DESC`
      );
      json(res, 200, rows);
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.post("/api/processos-secretaria", requireAuth, requirePermission("secretaria_hub"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const user = (req as any).user;
      const rows = await query<JsonObject>(
        `INSERT INTO public.processos_secretaria
          ("tipo","descricao","solicitante","prazo","status","prioridade","criadoPor")
         VALUES ($1,$2,$3,$4,'pendente',$5,$6) RETURNING *`,
        [
          b.tipo, b.descricao, b.solicitante,
          b.prazo || null,
          b.prioridade || 'media',
          user?.nome || 'Secretaria'
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/processos-secretaria/:id", requireAuth, requirePermission("secretaria_hub"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `UPDATE public.processos_secretaria
         SET "status"=COALESCE($1,"status"),
             "prioridade"=COALESCE($2,"prioridade"),
             "descricao"=COALESCE($3,"descricao"),
             "prazo"=COALESCE($4,"prazo"),
             "updatedAt"=NOW()
         WHERE id=$5 RETURNING *`,
        [b.status || null, b.prioridade || null, b.descricao || null, b.prazo || null, req.params.id]
      );
      if (rows.length === 0) return json(res, 404, { error: "Processo não encontrado." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/processos-secretaria/:id", requireAuth, requirePermission("secretaria_hub"), async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.processos_secretaria WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // CONFIGURAÇÃO RH (taxas e valores de pagamento/desconto)
  // -----------------------
  app.get("/api/configuracao-rh", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.configuracao_rh WHERE id=1`);
    json(res, 200, rows[0] ?? { id: 1, valorPorFalta: 0, valorMeioDia: 0, taxaTempoLectivo: 0, taxaAdminPorDia: 0, observacoes: '' });
  });

  app.put("/api/configuracao-rh", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.configuracao_rh (id, "valorPorFalta", "valorMeioDia", "taxaTempoLectivo", "taxaAdminPorDia", "descontoPorTempoNaoDado", "semanasPorMes", observacoes, "atualizadoEm")
         VALUES (1,$1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT (id) DO UPDATE SET
           "valorPorFalta"=$1, "valorMeioDia"=$2, "taxaTempoLectivo"=$3, "taxaAdminPorDia"=$4,
           "descontoPorTempoNaoDado"=$5, "semanasPorMes"=$6, observacoes=$7, "atualizadoEm"=NOW()
         RETURNING *`,
        [
          b.valorPorFalta ?? 0, b.valorMeioDia ?? 0, b.taxaTempoLectivo ?? 0, b.taxaAdminPorDia ?? 0,
          b.descontoPorTempoNaoDado ?? 0, b.semanasPorMes ?? 4, b.observacoes ?? ''
        ]
      );
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // -----------------------
  // FALTAS DE FUNCIONÁRIOS
  // -----------------------
  app.get("/api/faltas-funcionarios", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    const { funcionarioId, mes, ano, departamento } = req.query as Record<string, string>;
    let sql = `SELECT ff.*, f.nome, f.apelido, f.departamento, f.cargo
               FROM public.faltas_funcionarios ff
               JOIN public.funcionarios f ON ff."funcionarioId" = f.id WHERE 1=1`;
    const params: unknown[] = [];
    if (funcionarioId) { params.push(funcionarioId); sql += ` AND ff."funcionarioId"=$${params.length}`; }
    if (mes) { params.push(parseInt(mes)); sql += ` AND ff.mes=$${params.length}`; }
    if (ano) { params.push(parseInt(ano)); sql += ` AND ff.ano=$${params.length}`; }
    if (departamento) { params.push(departamento); sql += ` AND f.departamento=$${params.length}`; }
    sql += ` ORDER BY ff.data DESC, ff."criadoEm" DESC`;
    const rows = await query<JsonObject>(sql, params);
    json(res, 200, rows);
  });

  app.post("/api/faltas-funcionarios", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      if (!b.funcionarioId || !b.data || !b.mes || !b.ano) return json(res, 400, { error: "funcionarioId, data, mes e ano são obrigatórios." });
      const rows = await query<JsonObject>(
        `INSERT INTO public.faltas_funcionarios
           ("funcionarioId", data, tipo, motivo, descontavel, mes, ano, "registadoPor", "criadoEm")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
        [b.funcionarioId, b.data, b.tipo ?? 'injustificada', b.motivo ?? '',
         b.descontavel ?? true, b.mes, b.ano, b.registadoPor ?? '']
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/faltas-funcionarios/:id", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `UPDATE public.faltas_funcionarios SET tipo=$1, motivo=$2, descontavel=$3, data=$4 WHERE id=$5 RETURNING *`,
        [b.tipo ?? 'injustificada', b.motivo ?? '', b.descontavel ?? true, b.data, req.params.id]
      );
      if (!rows[0]) return json(res, 404, { error: "Falta não encontrada." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/faltas-funcionarios/:id", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.faltas_funcionarios WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // Resumo de faltas por funcionário (para folha de salário)
  app.get("/api/faltas-funcionarios/resumo", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    const { mes, ano } = req.query as Record<string, string>;
    if (!mes || !ano) return json(res, 400, { error: "mes e ano são obrigatórios." });
    const rows = await query<JsonObject>(
      `SELECT ff."funcionarioId", f.nome, f.apelido, f.departamento, f.cargo,
              COUNT(*) FILTER (WHERE ff.tipo='injustificada' AND ff.descontavel) AS faltas_injustificadas,
              COUNT(*) FILTER (WHERE ff.tipo='justificada') AS faltas_justificadas,
              COUNT(*) FILTER (WHERE ff.tipo='meio_dia' AND ff.descontavel) AS meios_dias,
              COUNT(*) AS total_faltas
       FROM public.faltas_funcionarios ff
       JOIN public.funcionarios f ON ff."funcionarioId" = f.id
       WHERE ff.mes=$1 AND ff.ano=$2
       GROUP BY ff."funcionarioId", f.nome, f.apelido, f.departamento, f.cargo
       ORDER BY f.nome`,
      [parseInt(mes), parseInt(ano)]
    );
    json(res, 200, rows);
  });

  // -----------------------
  // TEMPOS LECTIVOS / DIAS TRABALHADOS
  // -----------------------
  app.get("/api/tempos-lectivos", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    const { mes, ano, tipo, departamento } = req.query as Record<string, string>;
    let sql = `SELECT tl.*, f.nome, f.apelido, f.departamento, f.cargo, f.especialidade
               FROM public.tempos_lectivos tl
               JOIN public.funcionarios f ON tl."funcionarioId" = f.id WHERE 1=1`;
    const params: unknown[] = [];
    if (mes) { params.push(parseInt(mes)); sql += ` AND tl.mes=$${params.length}`; }
    if (ano) { params.push(parseInt(ano)); sql += ` AND tl.ano=$${params.length}`; }
    if (tipo) { params.push(tipo); sql += ` AND tl.tipo=$${params.length}`; }
    if (departamento) { params.push(departamento); sql += ` AND f.departamento=$${params.length}`; }
    sql += ` ORDER BY f.nome, tl."criadoEm" DESC`;
    const rows = await query<JsonObject>(sql, params);
    json(res, 200, rows);
  });

  app.post("/api/tempos-lectivos", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      if (!b.funcionarioId || !b.mes || !b.ano) return json(res, 400, { error: "funcionarioId, mes e ano são obrigatórios." });
      const totalUnidades = b.totalUnidades ?? 0;
      const valorUnitario = b.valorUnitario ?? 0;
      const totalCalculado = totalUnidades * valorUnitario;
      // Check for existing record (one per funcionario/mes/ano/tipo)
      const existing = await query<JsonObject>(
        `SELECT id FROM public.tempos_lectivos WHERE "funcionarioId"=$1 AND mes=$2 AND ano=$3 AND tipo=$4`,
        [b.funcionarioId, b.mes, b.ano, b.tipo ?? 'professor']
      );
      if (existing[0]) {
        const rows = await query<JsonObject>(
          `UPDATE public.tempos_lectivos SET "totalUnidades"=$1, "valorUnitario"=$2, "totalCalculado"=$3,
           departamento=$4, observacoes=$5, aprovado=$6, "atualizadoEm"=NOW()
           WHERE id=$7 RETURNING *`,
          [totalUnidades, valorUnitario, totalCalculado, b.departamento ?? '', b.observacoes ?? '', b.aprovado ?? false, existing[0].id]
        );
        return json(res, 200, rows[0]);
      }
      const rows = await query<JsonObject>(
        `INSERT INTO public.tempos_lectivos
           ("funcionarioId", mes, ano, "totalUnidades", "valorUnitario", "totalCalculado", tipo, departamento, observacoes, aprovado, "criadoEm", "atualizadoEm")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
        [b.funcionarioId, b.mes, b.ano, totalUnidades, valorUnitario, totalCalculado,
         b.tipo ?? 'professor', b.departamento ?? '', b.observacoes ?? '', b.aprovado ?? false]
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/tempos-lectivos/:id", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const totalUnidades = b.totalUnidades ?? 0;
      const valorUnitario = b.valorUnitario ?? 0;
      const rows = await query<JsonObject>(
        `UPDATE public.tempos_lectivos SET
           "totalUnidades"=$1, "valorUnitario"=$2, "totalCalculado"=$3,
           departamento=$4, observacoes=$5, aprovado=$6, "atualizadoEm"=NOW()
         WHERE id=$7 RETURNING *`,
        [totalUnidades, valorUnitario, totalUnidades * valorUnitario,
         b.departamento ?? '', b.observacoes ?? '', b.aprovado ?? false, req.params.id]
      );
      if (!rows[0]) return json(res, 404, { error: "Registo não encontrado." });
      json(res, 200, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.delete("/api/tempos-lectivos/:id", requireAuth, requirePermission("rh_hub"), async (req: Request, res: Response) => {
    try {
      await query(`DELETE FROM public.tempos_lectivos WHERE id=$1`, [req.params.id]);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  // -----------------------
  // CONFIGURAÇÃO FISCAL (INSS + IRT) — editável pelo Financeiro
  // -----------------------
  app.get("/api/config-fiscal", requireAuth, requirePermission("financeiro"), async (_req: Request, res: Response) => {
    try {
      const rows = await query<JsonObject>(
        `SELECT "inssEmpPerc","inssPatrPerc","irtTabela" FROM public.config_geral LIMIT 1`
      );
      const cfg = rows[0] as any ?? {};
      json(res, 200, {
        inssEmpPerc:  Number(cfg.inssEmpPerc  ?? 3),
        inssPatrPerc: Number(cfg.inssPatrPerc ?? 8),
        irtTabela:    Array.isArray(cfg.irtTabela) ? cfg.irtTabela : [],
      });
    } catch (e) { json(res, 500, { error: (e as Error).message }); }
  });

  app.put("/api/config-fiscal", requireAuth, requirePermission("financeiro"), async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const parts: string[] = [];
      const vals: unknown[] = [];
      if (b.inssEmpPerc  !== undefined) { vals.push(Number(b.inssEmpPerc));  parts.push(`"inssEmpPerc"=$${vals.length}`); }
      if (b.inssPatrPerc !== undefined) { vals.push(Number(b.inssPatrPerc)); parts.push(`"inssPatrPerc"=$${vals.length}`); }
      if (b.irtTabela    !== undefined) { vals.push(JSON.stringify(b.irtTabela)); parts.push(`"irtTabela"=$${vals.length}::jsonb`); }
      if (!parts.length) return json(res, 400, { error: "Nenhum campo para actualizar." });
      const existing = await query<JsonObject>(`SELECT id FROM public.config_geral LIMIT 1`);
      if (!existing[0]) return json(res, 404, { error: "Configuração não encontrada." });
      await query(`UPDATE public.config_geral SET ${parts.join(",")} WHERE id=$${vals.length+1}`, [...vals, existing[0].id]);
      const updated = await query<JsonObject>(`SELECT "inssEmpPerc","inssPatrPerc","irtTabela" FROM public.config_geral WHERE id=$1`, [existing[0].id]);
      json(res, 200, updated[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  // ─── Estimativa salarial do próprio utilizador ───────────────────────────────
  // Acessível a qualquer utilizador autenticado (professor ou funcionário com acesso)
  app.get("/api/meu-recibo-estimado", requireAuth, async (req: Request, res: Response) => {
    try {
      const jwtUser = req.jwtUser!;
      const mes  = parseInt(String(req.query.mes  ?? new Date().getMonth() + 1));
      const ano  = parseInt(String(req.query.ano  ?? new Date().getFullYear()));

      // 1. Encontrar professor (por email) ou funcionário (por utilizadorId)
      let profRow: any = null;
      let funcRow: any = null;

      const profRows = await query<JsonObject>(
        `SELECT id, nome, apelido, cargo, "tipoContrato", "salarioBase",
                "subsidioAlimentacao", "subsidioTransporte", "subsidioHabitacao",
                "valorPorTempoLectivo", "temposSemanais"
         FROM public.professores WHERE email=$1 AND ativo=true LIMIT 1`,
        [jwtUser.email]
      );
      if (profRows[0]) {
        profRow = profRows[0];
      } else {
        const funcRows2 = await query<JsonObject>(
          `SELECT id, nome, apelido, cargo, "tipoContrato", "salarioBase",
                  "subsidioAlimentacao", "subsidioTransporte", "subsidioHabitacao",
                  "valorPorTempoLectivo", "temposSemanais"
           FROM public.funcionarios WHERE "utilizadorId"=$1 AND ativo=true LIMIT 1`,
          [jwtUser.userId]
        );
        if (funcRows2[0]) funcRow = funcRows2[0];
      }

      const pessoa = profRow ?? funcRow;
      if (!pessoa) {
        return json(res, 200, { semPerfil: true });
      }

      // 2. Config geral (INSS + IRT)
      const cfgRows = await query<JsonObject>(
        `SELECT "inssEmpPerc","inssPatrPerc","irtTabela" FROM public.config_geral LIMIT 1`
      );
      const cfg = cfgRows[0] as any ?? {};
      const inssEmpRate  = (Number(cfg.inssEmpPerc  ?? 3))  / 100;
      const irtTabelaRaw = Array.isArray(cfg.irtTabela) && cfg.irtTabela.length > 0 ? cfg.irtTabela : undefined;

      // 3. Config RH (desconto por tempo, semanas por mês)
      const rhRows = await query<JsonObject>(`SELECT * FROM public.configuracao_rh WHERE id=1`);
      const rh = rhRows[0] as any ?? {};
      const descontoPorTempoNaoDado = Number(rh.descontoPorTempoNaoDado ?? 0);
      const semanasPorMes           = Number(rh.semanasPorMes ?? 4);
      const valorPorFalta           = Number(rh.valorPorFalta ?? 0);

      // 4. Faltas + Tempos trabalhados do mês
      const pessoaId = profRow ? profRow.id : funcRow.id;
      let faltasMes = 0;
      let temposRegistados: number | null = null; // null = sem registo na tabela tempos_lectivos

      // Tentar encontrar o funcionarioId correspondente ao professor (para tempos_lectivos)
      let funcionarioId: string | null = null;
      if (profRow) {
        const funcLink = await query<JsonObject>(
          `SELECT id FROM public.funcionarios WHERE "professorId"=$1 AND ativo=true LIMIT 1`,
          [pessoaId]
        );
        if (funcLink[0]) funcionarioId = String(funcLink[0].id);
      } else {
        funcionarioId = pessoaId;
      }

      // Tempos lectivos reais registados na tabela tempos_lectivos
      if (funcionarioId) {
        const temposRows = await query<JsonObject>(
          `SELECT COALESCE(SUM("totalUnidades"), 0) AS total
           FROM public.tempos_lectivos
           WHERE "funcionarioId"=$1 AND mes=$2 AND ano=$3`,
          [funcionarioId, mes, ano]
        );
        const totalRegistado = Number((temposRows[0] as any)?.total ?? 0);
        if (totalRegistado > 0) temposRegistados = totalRegistado;
      }

      if (profRow) {
        // Professores: contar faltas via sumários rejeitados no mês
        const sumRows = await query<JsonObject>(
          `SELECT COUNT(*) AS cnt FROM public.sumarios
           WHERE "professorId"=$1 AND status='rejeitado'
           AND EXTRACT(MONTH FROM data::date)=$2 AND EXTRACT(YEAR FROM data::date)=$3`,
          [pessoaId, mes, ano]
        );
        faltasMes = Number((sumRows[0] as any)?.cnt ?? 0);
        // Também contar faltas_funcionarios se tiver funcionarioId ligado
        if (funcionarioId) {
          const fRows = await query<JsonObject>(
            `SELECT COUNT(*) AS cnt FROM public.faltas_funcionarios
             WHERE "funcionarioId"=$1 AND mes=$2 AND ano=$3 AND descontavel=true`,
            [funcionarioId, mes, ano]
          );
          const faltasRH = Number((fRows[0] as any)?.cnt ?? 0);
          if (faltasRH > faltasMes) faltasMes = faltasRH;
        }
      } else {
        // Funcionários: faltas registadas pela RH
        const fRows = await query<JsonObject>(
          `SELECT COUNT(*) AS cnt FROM public.faltas_funcionarios
           WHERE "funcionarioId"=$1 AND mes=$2 AND ano=$3 AND descontavel=true`,
          [pessoaId, mes, ano]
        );
        faltasMes = Number((fRows[0] as any)?.cnt ?? 0);
      }

      // 5. Calcular salário estimado
      const tipoContrato         = String(pessoa.tipoContrato ?? 'efectivo');
      const salBase              = Number(pessoa.salarioBase ?? 0);
      const subAlim              = Number(pessoa.subsidioAlimentacao ?? 0);
      const subTrans             = Number(pessoa.subsidioTransporte ?? 0);
      const subHab               = Number(pessoa.subsidioHabitacao ?? 0);
      const valorTempoLectivo    = Number(pessoa.valorPorTempoLectivo ?? 0);
      const temposSemanais       = Number(pessoa.temposSemanais ?? 0);
      const temposEsperados      = temposSemanais * semanasPorMes;

      let salBaseEfectivo  = salBase;
      let descontoTempos   = 0;
      // Se há registo real na tabela tempos_lectivos, usa esse valor; caso contrário infere pelos cálculos
      let temposTrabalhados = temposRegistados !== null ? temposRegistados : temposEsperados;
      let salColaborador   = 0;
      const temposComDadosReais = temposRegistados !== null;

      const isColaborador = ['colaborador', 'contratado', 'prestacao_servicos'].includes(tipoContrato);

      if (tipoContrato === 'efectivo' && temposSemanais > 0 && descontoPorTempoNaoDado > 0) {
        if (!temposComDadosReais) {
          // Sem dados reais: inferir pelos sumários/faltas
          temposTrabalhados = Math.max(0, temposEsperados - faltasMes);
        }
        const temposNaoDados = Math.max(0, temposEsperados - temposTrabalhados);
        descontoTempos = Math.round(temposNaoDados * descontoPorTempoNaoDado * 100) / 100;
        salBaseEfectivo = Math.max(0, salBase - descontoTempos);
      } else if (isColaborador && valorTempoLectivo > 0 && salBase === 0) {
        if (!temposComDadosReais) {
          temposTrabalhados = Math.max(0, temposEsperados - faltasMes);
        }
        salColaborador = Math.round(valorTempoLectivo * temposTrabalhados * 100) / 100;
        salBaseEfectivo = salColaborador;
      }

      const descontoFaltas = Math.round(faltasMes * valorPorFalta * 100) / 100;
      const subs            = subAlim + subTrans + subHab;
      const salBruto        = Math.round((salBaseEfectivo + subs) * 100) / 100;
      const inssEmpregado   = Math.round(salBaseEfectivo * inssEmpRate * 100) / 100;
      const irt             = Math.round(calcularIRT(salBaseEfectivo, irtTabelaRaw as any) * 100) / 100;
      const salLiquido      = Math.round((salBruto - inssEmpregado - irt - (isColaborador ? 0 : descontoFaltas)) * 100) / 100;

      json(res, 200, {
        nome:              `${pessoa.nome} ${pessoa.apelido}`,
        cargo:             pessoa.cargo ?? '',
        tipoContrato,
        mes, ano,
        // Tempos
        temposSemanais,
        temposEsperados,
        temposTrabalhados,
        temposComDadosReais,
        faltasMes,
        // Valores
        salarioBase:       salBase,
        valorPorTempoLectivo: valorTempoLectivo,
        subsidioAlimentacao: subAlim,
        subsidioTransporte:  subTrans,
        subsidioHabitacao:   subHab,
        salColaborador,
        descontoTempos,
        descontoFaltas:    isColaborador ? 0 : descontoFaltas,
        salarioBruto:      salBruto,
        inssEmpregado,
        irt,
        salarioLiquido:    salLiquido,
        // Meta
        semanasPorMes,
        inssEmpPerc:       Number(cfg.inssEmpPerc ?? 3),
        semPerfil:         false,
      });
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  // ─── PENDÊNCIAS DE ALUNOS (Real-time student issues stream) ─────────────────
  app.get("/api/pendencias-alunos", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const allowedRoles = ['admin', 'ceo', 'pca', 'director', 'secretaria', 'chefe_secretaria', 'financeiro', 'pedagogico'];
    if (!allowedRoles.includes(user?.role)) {
      return json(res, 403, { error: 'Acesso negado' });
    }
    try {
      const pendencias: Array<{
        id: string;
        alunoId: string;
        nome: string;
        apelido: string;
        numeroMatricula: string;
        foto: string | null;
        turma: string;
        curso: string;
        tipoPendencia: string;
        descricao: string;
        severidade: 'urgente' | 'aviso' | 'info';
        area: string;
        createdAt: string;
      }> = [];

      // 1. Propinas em atraso (pagamentos pendentes)
      const propinasPendentes = await query(`
        SELECT DISTINCT ON (a.id)
          a.id as "alunoId",
          a.nome,
          a.apelido,
          a."numeroMatricula",
          a.foto,
          COALESCE(t.nome, 'Sem turma') as turma,
          COALESCE(c.nome, '') as curso,
          COUNT(p.id) as total_pendentes,
          MIN(p."createdAt") as mais_antiga
        FROM alunos a
        LEFT JOIN turmas t ON t.id = a."turmaId"
        LEFT JOIN cursos c ON c.id = a."cursoId"
        INNER JOIN pagamentos p ON p."alunoId" = a.id AND p.status = 'pendente'
        WHERE a.ativo = true AND a.falecido = false
        GROUP BY a.id, a.nome, a.apelido, a."numeroMatricula", a.foto, t.nome, c.nome
        ORDER BY a.id, mais_antiga ASC
        LIMIT 30
      `, []);

      for (const row of propinasPendentes.rows) {
        const count = parseInt(row.total_pendentes);
        pendencias.push({
          id: `propina-${row.alunoId}-${Date.now()}`,
          alunoId: row.alunoId,
          nome: row.nome,
          apelido: row.apelido,
          numeroMatricula: row.numeroMatricula,
          foto: row.foto,
          turma: row.turma,
          curso: row.curso,
          tipoPendencia: 'propina',
          descricao: count === 1 ? '1 propina pendente por regularizar' : `${count} propinas pendentes por regularizar`,
          severidade: count >= 3 ? 'urgente' : count >= 2 ? 'aviso' : 'info',
          area: 'Financeiro',
          createdAt: row.mais_antiga,
        });
      }

      // 2. Alunos bloqueados
      const bloqueados = await query(`
        SELECT
          a.id as "alunoId",
          a.nome,
          a.apelido,
          a."numeroMatricula",
          a.foto,
          COALESCE(t.nome, 'Sem turma') as turma,
          COALESCE(c.nome, '') as curso,
          a."createdAt"
        FROM alunos a
        LEFT JOIN turmas t ON t.id = a."turmaId"
        LEFT JOIN cursos c ON c.id = a."cursoId"
        WHERE a.bloqueado = true AND a.ativo = true AND a.falecido = false
        ORDER BY a."createdAt" DESC
        LIMIT 15
      `, []);

      for (const row of bloqueados.rows) {
        pendencias.push({
          id: `bloqueado-${row.alunoId}`,
          alunoId: row.alunoId,
          nome: row.nome,
          apelido: row.apelido,
          numeroMatricula: row.numeroMatricula,
          foto: row.foto,
          turma: row.turma,
          curso: row.curso,
          tipoPendencia: 'bloqueio',
          descricao: 'Acesso bloqueado — situação por regularizar',
          severidade: 'urgente',
          area: 'Secretaria',
          createdAt: row.createdAt,
        });
      }

      // 3. RUPEs activos (referências bancárias por pagar)
      const rupesActivos = await query(`
        SELECT DISTINCT ON (a.id)
          a.id as "alunoId",
          a.nome,
          a.apelido,
          a."numeroMatricula",
          a.foto,
          COALESCE(t.nome, 'Sem turma') as turma,
          COALESCE(c.nome, '') as curso,
          COUNT(r.id) as total_rupes,
          MAX(r."dataValidade") as validade
        FROM alunos a
        LEFT JOIN turmas t ON t.id = a."turmaId"
        LEFT JOIN cursos c ON c.id = a."cursoId"
        INNER JOIN rupes r ON r."alunoId" = a.id AND r.status = 'ativo'
        WHERE a.ativo = true AND a.falecido = false
        GROUP BY a.id, a.nome, a.apelido, a."numeroMatricula", a.foto, t.nome, c.nome
        ORDER BY a.id, validade ASC
        LIMIT 15
      `, []);

      for (const row of rupesActivos.rows) {
        const count = parseInt(row.total_rupes);
        pendencias.push({
          id: `rupe-${row.alunoId}`,
          alunoId: row.alunoId,
          nome: row.nome,
          apelido: row.apelido,
          numeroMatricula: row.numeroMatricula,
          foto: row.foto,
          turma: row.turma,
          curso: row.curso,
          tipoPendencia: 'rupe',
          descricao: `${count} referência${count > 1 ? 's' : ''} bancária${count > 1 ? 's' : ''} activa${count > 1 ? 's' : ''} por liquidar`,
          severidade: 'aviso',
          area: 'Financeiro',
          createdAt: new Date().toISOString(),
        });
      }

      // 4. Mensagens financeiras não lidas (avisos/bloqueios)
      const mensagensNaoLidas = await query(`
        SELECT DISTINCT ON (a.id)
          a.id as "alunoId",
          a.nome,
          a.apelido,
          a."numeroMatricula",
          a.foto,
          COALESCE(t.nome, 'Sem turma') as turma,
          COALESCE(c.nome, '') as curso,
          mf.tipo,
          mf.texto,
          mf."createdAt"
        FROM alunos a
        LEFT JOIN turmas t ON t.id = a."turmaId"
        LEFT JOIN cursos c ON c.id = a."cursoId"
        INNER JOIN mensagens_financeiras mf ON mf."alunoId" = a.id AND mf.lida = false AND mf.tipo IN ('aviso', 'bloqueio')
        WHERE a.ativo = true AND a.falecido = false
        ORDER BY a.id, mf."createdAt" DESC
        LIMIT 15
      `, []);

      for (const row of mensagensNaoLidas.rows) {
        if (pendencias.some(p => p.alunoId === row.alunoId && p.tipoPendencia === 'bloqueio')) continue;
        pendencias.push({
          id: `msg-${row.alunoId}-${Date.now()}`,
          alunoId: row.alunoId,
          nome: row.nome,
          apelido: row.apelido,
          numeroMatricula: row.numeroMatricula,
          foto: row.foto,
          turma: row.turma,
          curso: row.curso,
          tipoPendencia: 'aviso_financeiro',
          descricao: row.texto.length > 80 ? row.texto.slice(0, 80) + '…' : row.texto,
          severidade: row.tipo === 'bloqueio' ? 'urgente' : 'aviso',
          area: 'Financeiro',
          createdAt: row.createdAt,
        });
      }

      // 5. Notas negativas (nf < 10 ou mt1 < 10, com pelo menos 1 nota lançada)
      const notasNegativas = await query(`
        SELECT DISTINCT ON (a.id)
          a.id as "alunoId",
          a.nome,
          a.apelido,
          a."numeroMatricula",
          a.foto,
          COALESCE(t.nome, 'Sem turma') as turma,
          COALESCE(c.nome, '') as curso,
          COUNT(n.id) as total_negativas,
          MIN(n.nf) as nota_minima,
          n."anoLetivo"
        FROM alunos a
        LEFT JOIN turmas t ON t.id = a."turmaId"
        LEFT JOIN cursos c ON c.id = a."cursoId"
        INNER JOIN notas n ON n."alunoId" = a.id AND (
          (n.nf > 0 AND n.nf < 10) OR (n.mt1 > 0 AND n.mt1 < 10)
        )
        WHERE a.ativo = true AND a.falecido = false
        GROUP BY a.id, a.nome, a.apelido, a."numeroMatricula", a.foto, t.nome, c.nome, n."anoLetivo"
        ORDER BY a.id, total_negativas DESC
        LIMIT 20
      `, []);

      for (const row of notasNegativas.rows) {
        if (pendencias.some(p => p.alunoId === row.alunoId && p.tipoPendencia === 'nota_negativa')) continue;
        const count = parseInt(row.total_negativas);
        const minNota = parseInt(row.nota_minima) || 0;
        pendencias.push({
          id: `nota-${row.alunoId}`,
          alunoId: row.alunoId,
          nome: row.nome,
          apelido: row.apelido,
          numeroMatricula: row.numeroMatricula,
          foto: row.foto,
          turma: row.turma,
          curso: row.curso,
          tipoPendencia: 'nota_negativa',
          descricao: count === 1
            ? `Nota negativa em ${count} disciplina (mín. ${minNota} valores)`
            : `Notas negativas em ${count} disciplinas (mín. ${minNota} valores)`,
          severidade: minNota < 5 ? 'urgente' : minNota < 8 ? 'aviso' : 'info',
          area: 'Pedagógico',
          createdAt: new Date().toISOString(),
        });
      }

      // 6. Faltas excessivas (≥ 10 faltas injustificadas 'F')
      const faltasExcessivas = await query(`
        SELECT DISTINCT ON (a.id)
          a.id as "alunoId",
          a.nome,
          a.apelido,
          a."numeroMatricula",
          a.foto,
          COALESCE(t.nome, 'Sem turma') as turma,
          COALESCE(c.nome, '') as curso,
          COUNT(p.id) as total_faltas
        FROM alunos a
        LEFT JOIN turmas t ON t.id = a."turmaId"
        LEFT JOIN cursos c ON c.id = a."cursoId"
        INNER JOIN presencas p ON p."alunoId" = a.id AND p.status = 'F'
        WHERE a.ativo = true AND a.falecido = false
        GROUP BY a.id, a.nome, a.apelido, a."numeroMatricula", a.foto, t.nome, c.nome
        HAVING COUNT(p.id) >= 10
        ORDER BY a.id, total_faltas DESC
        LIMIT 20
      `, []);

      for (const row of faltasExcessivas.rows) {
        if (pendencias.some(p => p.alunoId === row.alunoId && p.tipoPendencia === 'faltas_excessivas')) continue;
        const count = parseInt(row.total_faltas);
        pendencias.push({
          id: `faltas-${row.alunoId}`,
          alunoId: row.alunoId,
          nome: row.nome,
          apelido: row.apelido,
          numeroMatricula: row.numeroMatricula,
          foto: row.foto,
          turma: row.turma,
          curso: row.curso,
          tipoPendencia: 'faltas_excessivas',
          descricao: `${count} falta${count > 1 ? 's' : ''} injustificada${count > 1 ? 's' : ''} registada${count > 1 ? 's' : ''}`,
          severidade: count >= 25 ? 'urgente' : count >= 15 ? 'aviso' : 'info',
          area: 'Pedagógico',
          createdAt: new Date().toISOString(),
        });
      }

      // Sort: urgente first, then aviso, then info; within each group newest first
      const order = { urgente: 0, aviso: 1, info: 2 };
      pendencias.sort((a, b) => {
        const sev = order[a.severidade] - order[b.severidade];
        if (sev !== 0) return sev;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      json(res, 200, pendencias);
    } catch (e) {
      console.error('[pendencias-alunos]', e);
      json(res, 500, { error: (e as Error).message });
    }
  });

  // ─── BACKUP & EXPORT ─────────────────────────────────────────────────────────
  app.get('/api/admin/backup', requireAuth, requirePermission('admin'), async (req: Request, res: Response) => {
    try {
      const tables = [
        'utilizadores', 'alunos', 'funcionarios', 'turmas', 'notas',
        'presencas', 'pagamentos', 'taxas', 'eventos', 'horarios',
        'disciplinas', 'cursos', 'curso_disciplinas', 'salas',
        'anos_academicos', 'materiais', 'sumarios', 'planificacoes',
        'ocorrencias', 'documentos_emitidos', 'registros', 'pautas',
        'folhas_salarios', 'mensagens',
      ];
      const backup: Record<string, unknown[]> = {};
      for (const table of tables) {
        try {
          const result = await query(`SELECT * FROM public.${table} LIMIT 50000`, []);
          backup[table] = result.rows;
        } catch {
          backup[table] = [];
        }
      }
      const payload = {
        sistema: 'SIGE v1.0.0',
        geradoEm: new Date().toISOString(),
        tabelas: Object.keys(backup).length,
        dados: backup,
      };
      const filename = `sige-backup-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(JSON.stringify(payload, null, 2));
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  app.get('/api/admin/export-csv', requireAuth, requirePermission('admin'), async (req: Request, res: Response) => {
    try {
      const table = (req.query.tabela as string) || 'alunos';
      const allowed = ['alunos', 'funcionarios', 'utilizadores', 'notas', 'presencas', 'pagamentos', 'turmas'];
      if (!allowed.includes(table)) return json(res, 400, { error: 'Tabela não permitida.' });
      const result = await query(`SELECT * FROM public.${table} LIMIT 50000`, []);
      if (result.rows.length === 0) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
        return res.status(200).send('sem dados\n');
      }
      const headers = Object.keys(result.rows[0]);
      const escape = (v: unknown) => {
        if (v === null || v === undefined) return '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n\r]/.test(s) ? `"${s}"` : s;
      };
      const csvLines = [
        headers.join(','),
        ...result.rows.map(row => headers.map(h => escape(row[h])).join(',')),
      ];
      const filename = `sige-${table}-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send('\uFEFF' + csvLines.join('\r\n'));
    } catch (e) {
      json(res, 500, { error: (e as Error).message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
