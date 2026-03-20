// server/index.ts
import express from "express";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";

// server/routes.ts
import { createServer } from "node:http";

// server/db.ts
import { Pool } from "pg";
var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Configure it with your Supabase Postgres connection string.");
}
var pool = new Pool({
  connectionString: databaseUrl
});
async function query(sqlText, params = []) {
  const res = await pool.query(sqlText, params);
  return res.rows;
}

// server/routes.ts
function json(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}
function requireBodyObject(req) {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid JSON body (expected an object).");
  }
  return body;
}
function jsonbParam(value) {
  if (value === void 0) return null;
  if (value === null) return null;
  return JSON.stringify(value);
}
async function registerRoutes(app2) {
  app2.get("/api/health", (_req, res) => {
    json(res, 200, { ok: true });
  });
  app2.get("/api/users", async (_req, res) => {
    const rows = await query(
      `SELECT * FROM public.users ORDER BY id DESC`,
      []
    );
    json(res, 200, rows);
  });
  app2.get("/api/alunos", async (_req, res) => {
    const rows = await query(
      `SELECT * FROM public.alunos ORDER BY "createdAt" DESC`,
      []
    );
    json(res, 200, rows);
  });
  app2.post("/api/alunos", async (req, res) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query(
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
          b.createdAt
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.put("/api/alunos/:id", async (req, res) => {
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
        "createdAt"
      ];
      const setParts = [];
      const values = [];
      for (const key of allowed) {
        const v = b[key];
        if (v === void 0) continue;
        values.push(v);
        setParts.push(`"${key}" = $${values.length}`);
      }
      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }
      const rows = await query(
        `UPDATE public.alunos SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.delete("/api/alunos/:id", async (req, res) => {
    const { id } = req.params;
    const rows = await query(
      `DELETE FROM public.alunos WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });
  app2.get("/api/professores", async (_req, res) => {
    const rows = await query(
      `SELECT * FROM public.professores ORDER BY "createdAt" DESC`,
      []
    );
    json(res, 200, rows);
  });
  app2.post("/api/professores", async (req, res) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query(
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
          b.createdAt
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.put("/api/professores/:id", async (req, res) => {
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
        "createdAt"
      ];
      const jsonbKeys = /* @__PURE__ */ new Set(["disciplinas", "turmasIds"]);
      const setParts = [];
      const values = [];
      for (const key of allowed) {
        const v = b[key];
        if (v === void 0) continue;
        values.push(
          jsonbKeys.has(key) ? jsonbParam(v) : v
        );
        const placeholder = `$${values.length}`;
        setParts.push(
          jsonbKeys.has(key) ? `"${key}" = ${placeholder}::jsonb` : `"${key}" = ${placeholder}`
        );
      }
      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }
      const rows = await query(
        `UPDATE public.professores SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.delete("/api/professores/:id", async (req, res) => {
    const { id } = req.params;
    const rows = await query(
      `DELETE FROM public.professores WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });
  app2.get("/api/turmas", async (_req, res) => {
    const rows = await query(
      `SELECT * FROM public.turmas ORDER BY "anoLetivo" DESC`,
      []
    );
    json(res, 200, rows);
  });
  app2.post("/api/turmas", async (req, res) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query(
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
          b.ativo
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.put("/api/turmas/:id", async (req, res) => {
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
        "ativo"
      ];
      const setParts = [];
      const values = [];
      for (const key of allowed) {
        const v = b[key];
        if (v === void 0) continue;
        values.push(v);
        setParts.push(`"${key}" = $${values.length}`);
      }
      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }
      const rows = await query(
        `UPDATE public.turmas SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.delete("/api/turmas/:id", async (req, res) => {
    const { id } = req.params;
    const rows = await query(
      `DELETE FROM public.turmas WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });
  app2.get("/api/notas", async (_req, res) => {
    const rows = await query(
      `SELECT * FROM public.notas ORDER BY "anoLetivo" DESC`,
      []
    );
    json(res, 200, rows);
  });
  app2.post("/api/notas", async (req, res) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query(
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
          jsonbParam(b.lancamentos)
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.put("/api/notas/:id", async (req, res) => {
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
        "lancamentos"
      ];
      const jsonbKeys = /* @__PURE__ */ new Set(["lancamentos"]);
      const setParts = [];
      const values = [];
      for (const key of allowed) {
        const v = b[key];
        if (v === void 0) continue;
        values.push(jsonbKeys.has(key) ? jsonbParam(v) : v);
        const placeholder = `$${values.length}`;
        setParts.push(
          jsonbKeys.has(key) ? `"${key}" = ${placeholder}::jsonb` : `"${key}" = ${placeholder}`
        );
      }
      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }
      const rows = await query(
        `UPDATE public.notas SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.delete("/api/notas/:id", async (req, res) => {
    const { id } = req.params;
    const rows = await query(
      `DELETE FROM public.notas WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });
  app2.get("/api/presencas", async (_req, res) => {
    const rows = await query(
      `SELECT * FROM public.presencas ORDER BY "data" DESC`,
      []
    );
    json(res, 200, rows);
  });
  app2.post("/api/presencas", async (req, res) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query(
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
          b.observacao ?? null
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.put("/api/presencas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const b = requireBodyObject(req);
      const allowed = [
        "alunoId",
        "turmaId",
        "disciplina",
        "data",
        "status",
        "observacao"
      ];
      const setParts = [];
      const values = [];
      for (const key of allowed) {
        const v = b[key];
        if (v === void 0) continue;
        values.push(v);
        setParts.push(`"${key}" = $${values.length}`);
      }
      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }
      const rows = await query(
        `UPDATE public.presencas SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.delete("/api/presencas/:id", async (req, res) => {
    const { id } = req.params;
    const rows = await query(
      `DELETE FROM public.presencas WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });
  app2.get("/api/eventos", async (_req, res) => {
    const rows = await query(
      `SELECT * FROM public.eventos ORDER BY "createdAt" DESC`,
      []
    );
    json(res, 200, rows);
  });
  app2.post("/api/eventos", async (req, res) => {
    try {
      const b = requireBodyObject(req);
      const rows = await query(
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
          b.createdAt
        ]
      );
      json(res, 201, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.put("/api/eventos/:id", async (req, res) => {
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
        "createdAt"
      ];
      const jsonbKeys = /* @__PURE__ */ new Set(["turmasIds"]);
      const setParts = [];
      const values = [];
      for (const key of allowed) {
        const v = b[key];
        if (v === void 0) continue;
        values.push(jsonbKeys.has(key) ? jsonbParam(v) : v);
        const placeholder = `$${values.length}`;
        setParts.push(
          jsonbKeys.has(key) ? `"${key}" = ${placeholder}::jsonb` : `"${key}" = ${placeholder}`
        );
      }
      if (setParts.length === 0) {
        return json(res, 400, { error: "No fields to update." });
      }
      const rows = await query(
        `UPDATE public.eventos SET ${setParts.join(", ")} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, id]
      );
      if (!rows[0]) return json(res, 404, { error: "Not found." });
      json(res, 200, rows[0]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
  app2.delete("/api/eventos/:id", async (req, res) => {
    const { id } = req.params;
    const rows = await query(
      `DELETE FROM public.eventos WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return json(res, 404, { error: "Not found." });
    json(res, 200, rows[0]);
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
var PWA_TAGS = `
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#0D1B3E" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="SIGA" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
  <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
  <meta name="msapplication-TileColor" content="#0D1B3E" />
  <meta name="msapplication-TileImage" content="/icons/icon-192.png" />`;
var SW_SCRIPT = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
          .then(function(reg) { console.log('[PWA] Service Worker registered:', reg.scope); })
          .catch(function(err) { console.warn('[PWA] Service Worker registration failed:', err); });
      });
    }
  </script>`;
function injectPwaTags(html) {
  if (html.includes('rel="manifest"')) return html;
  let result = html.replace("</head>", `${PWA_TAGS}
</head>`);
  result = result.replace("</body>", `${SW_SCRIPT}
</body>`);
  return result;
}
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function setupMobileManifest(app2) {
  app2.use((req, res, next) => {
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    next();
  });
}
function setupPwaAssets(app2) {
  const publicPath = path.resolve(process.cwd(), "public");
  if (fs.existsSync(publicPath)) {
    app2.use(express.static(publicPath));
    log("PWA assets served from /public");
  }
}
function setupWebProxy(app2) {
  const EXPO_WEB_PORT = 8e3;
  log(`Development mode: proxying web requests to Expo web server on port ${EXPO_WEB_PORT}`);
  app2.use(
    createProxyMiddleware({
      target: `http://localhost:${EXPO_WEB_PORT}`,
      changeOrigin: true,
      ws: true,
      selfHandleResponse: true,
      headers: {
        host: `localhost:${EXPO_WEB_PORT}`
      },
      on: {
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
          const contentType = proxyRes.headers["content-type"] || "";
          if (!contentType.includes("text/html")) {
            return responseBuffer;
          }
          const html = responseBuffer.toString("utf-8");
          return injectPwaTags(html);
        }),
        error: (_err, _req, res) => {
          if (res && "status" in res) {
            res.status(503).send(
              `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0D1B3E;color:#fff">
              <div style="text-align:center">
                <h2>A iniciar o servidor web...</h2>
                <p>Aguarda um momento enquanto o servidor Expo web arranca.</p>
                <script>setTimeout(()=>location.reload(),3000)</script>
              </div>
              </body></html>`
            );
          }
        }
      }
    })
  );
}
function setupStaticWeb(app2) {
  const distPath = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    log(`Production mode: serving static web build from ${distPath}`);
    app2.use(express.static(distPath));
    app2.get("*", (_req, res) => {
      const indexPath = path.join(distPath, "index.html");
      const html = fs.readFileSync(indexPath, "utf-8");
      const modified = injectPwaTags(html);
      res.setHeader("Content-Type", "text/html");
      res.send(modified);
    });
  } else {
    log("WARNING: dist/ folder not found. Run 'npx expo export -p web' to build.");
  }
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  setupMobileManifest(app);
  setupPwaAssets(app);
  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  const server = await registerRoutes(app);
  if (process.env.NODE_ENV === "development") {
    setupWebProxy(app);
  } else {
    setupStaticWeb(app);
  }
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`Express server running on port ${port}`);
      if (process.env.NODE_ENV === "development") {
        log(`Proxying web requests to Expo web server on port 8000`);
      }
    }
  );
})();
