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
          "aval1","aval2","aval3","aval4","mac1","pp1","ppt","mt1","nf","mac",
          "anoLetivo","professorId","data","lancamentos"
        ) VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19::jsonb
        ) RETURNING *`,
        [
          b.id,
          b.alunoId,
          b.turmaId,
          b.disciplina,
          b.trimestre,
          b.aval1,
          b.aval2,
          b.aval3,
          b.aval4,
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

  const httpServer = createServer(app);

  return httpServer;
}
