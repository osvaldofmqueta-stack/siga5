import type { Express } from "express";
import type { Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { query } from "./db";

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
          "turmaId", "nomeEncarregado", "telefoneEncarregado", "ativo", "foto", "createdAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
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
        `INSERT INTO public.utilizadores (id,"nome","email","senha","role","escola","ativo","criadoEm")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [b.id ?? null, b.nome, b.email, b.senha, b.role, b.escola ?? '', b.ativo ?? true, b.criadoEm ?? new Date().toISOString()],
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });

  app.put("/api/utilizadores/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["nome","email","senha","role","escola","ativo"] as const;
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
  app.get("/api/registros", async (_req: Request, res: Response) => {
    const rows = await query<JsonObject>(`SELECT * FROM public.registros ORDER BY "criadoEm" DESC`, []);
    json(res, 200, rows);
  });

  app.post("/api/registros", async (req: Request, res: Response) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query<JsonObject>(
        `INSERT INTO public.registros (id,"nomeCompleto","dataNascimento","genero","provincia","municipio","nivel","classe","nomeEncarregado","telefoneEncarregado","observacoes","status")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [b.id??null,b.nomeCompleto,b.dataNascimento,b.genero,b.provincia,b.municipio,b.nivel,b.classe,b.nomeEncarregado,b.telefoneEncarregado,b.observacoes??'',b.status??'pendente'],
      );
      json(res, 201, rows[0]);
    } catch (e) { json(res, 400, { error: (e as Error).message }); }
  });

  app.put("/api/registros/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = ["status","avaliadoEm","avaliadoPor","motivoRejeicao"] as const;
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
      const allowed = ["nomeEscola","logoUrl","pp1Habilitado","pptHabilitado","notaMinimaAprovacao","maxAlunosTurma","horarioFuncionamento","flashScreen","multaConfig","inscricoesAbertas"] as const;
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

  const httpServer = createServer(app);

  return httpServer;
}
