import type { Express } from "express";
import type { Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { query } from "./db";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

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
  // put application routes here
  // prefix all routes with /api

  app.get("/api/health", (_req: Request, res: Response) => {
    json(res, 200, { ok: true });
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

  app.post("/api/alunos", async (req: Request, res: Response) => {
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

  app.put("/api/alunos/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/alunos/:id", async (req: Request, res: Response) => {
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

  app.post("/api/professores", async (req: Request, res: Response) => {
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

  app.put("/api/professores/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/professores/:id", async (req: Request, res: Response) => {
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

  app.post("/api/turmas", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.turmas (
          id, "nome", "classe", "turno", "anoLetivo", "nivel",
          "professorId", "sala", "capacidade", "ativo"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
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
        ],
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/turmas/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/turmas/:id", async (req: Request, res: Response) => {
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

  app.post("/api/notas", async (req: Request, res: Response) => {
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
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/notas/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/notas/:id", async (req: Request, res: Response) => {
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

  app.post("/api/presencas", async (req: Request, res: Response) => {
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
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/presencas/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/presencas/:id", async (req: Request, res: Response) => {
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
  app.get("/api/utilizadores", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(
      `SELECT * FROM public.utilizadores ORDER BY "criadoEm" DESC`,
      [],
    );
    json(res, 200, rows);
  });

  app.post("/api/utilizadores", async (req: Request, res: Response) => {
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

  app.put("/api/utilizadores/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/utilizadores/:id", async (req: Request, res: Response) => {
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

  app.post("/api/pautas", async (req: Request, res: Response) => {
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

  app.put("/api/pautas/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/pautas/:id", async (req: Request, res: Response) => {
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
  app.get("/api/taxas", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.taxas ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/taxas", async (req: Request, res: Response) => {
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

  app.put("/api/taxas/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/taxas/:id", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`DELETE FROM public.taxas WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });

  // -----------------------
  // PAGAMENTOS
  // -----------------------
  app.get("/api/pagamentos", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.pagamentos ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/pagamentos", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.pagamentos (id,"alunoId","taxaId","valor","data","mes","trimestre","ano","status","metodoPagamento","referencia","observacao")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [b.id??null,b.alunoId,b.taxaId,b.valor,b.data,b.mes??null,b.trimestre??null,b.ano,b.status??'pendente',b.metodoPagamento,b.referencia??null,b.observacao??null],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/pagamentos/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/pagamentos/:id", async (req: Request, res: Response) => {
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
  // RUPES
  // -----------------------
  app.get("/api/rupes", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.rupes ORDER BY "createdAt" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/rupes", async (req: Request, res: Response) => {
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

  app.put("/api/rupes/:id", async (req: Request, res: Response) => {
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
          id,"nomeCompleto","dataNascimento","genero","provincia","municipio",
          "telefone","email","endereco","bairro","numeroBi","numeroCedula",
          "nivel","classe","nomeEncarregado","telefoneEncarregado","observacoes",
          "status","senhaProvisoria"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [
          b.id??null, b.nomeCompleto, b.dataNascimento, b.genero, b.provincia, b.municipio,
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
  app.get("/api/user-permissions", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.user_permissions`, []);
    json(res, 200, rows);
  });

  app.get("/api/user-permissions/:userId", async (req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.user_permissions WHERE user_id=$1`, [req.params.userId]);
    if (!rows[0]) return json(res, 200, { userId: req.params.userId, permissoes: {} });
    json(res, 200, rows[0]);
  });

  app.put("/api/user-permissions/:userId", async (req: Request, res: Response) => {
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

  app.delete("/api/user-permissions/:userId", async (req: Request, res: Response) => {
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
    if (rows[0]) return json(res, 200, rows[0]);
    // Create default if not exists
    const created = await query<JsonObject>(
      `INSERT INTO public.config_geral DEFAULT VALUES RETURNING *`, [],
    );
    json(res, 200, created[0]);
  });

  app.put("/api/config", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const allowed = ["nomeEscola","logoUrl","pp1Habilitado","pptHabilitado","notaMinimaAprovacao","maxAlunosTurma","numAvaliacoes","macMin","macMax","horarioFuncionamento","flashScreen","multaConfig","inscricoesAbertas","numeroEntidade","iban","nomeBeneficiario","bancoTransferencia","telefoneMulticaixaExpress","nib","directorGeral","directorPedagogico","directorProvincialEducacao"] as const;
      const jsonbKeys = new Set(["flashScreen","multaConfig"]);
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

      const escola = 'Escola Secundária N.º 1 de Luanda';
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

  const httpServer = createServer(app);

  return httpServer;
}
