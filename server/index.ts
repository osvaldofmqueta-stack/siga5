import dotenv from "dotenv";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import { registerRoutes } from "./routes";
import { registerMEDRoutes } from "./med";
import { registerPDFRoutes } from "./pdf";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const FONT_STYLE = `
  <link rel="preload" href="/fonts/Inter_400Regular.ttf" as="font" type="font/ttf" crossorigin="anonymous" />
  <link rel="preload" href="/fonts/Inter_500Medium.ttf" as="font" type="font/ttf" crossorigin="anonymous" />
  <link rel="preload" href="/fonts/Inter_600SemiBold.ttf" as="font" type="font/ttf" crossorigin="anonymous" />
  <link rel="preload" href="/fonts/Inter_700Bold.ttf" as="font" type="font/ttf" crossorigin="anonymous" />
  <style>
    @font-face { font-family: 'Inter_400Regular'; src: url('/fonts/Inter_400Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Inter_500Medium';  src: url('/fonts/Inter_500Medium.ttf')  format('truetype'); font-weight: 500; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Inter_600SemiBold';src: url('/fonts/Inter_600SemiBold.ttf')format('truetype'); font-weight: 600; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Inter_700Bold';    src: url('/fonts/Inter_700Bold.ttf')    format('truetype'); font-weight: 700; font-style: normal; font-display: swap; }
  </style>`;

const PWA_TAGS = `
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#0D1F35" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="QUETA" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
  <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
  <meta name="msapplication-TileColor" content="#0D1F35" />
  <meta name="msapplication-TileImage" content="/icons/icon-192.png" />`;

const SW_SCRIPT = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
          .then(function(reg) { console.log('[PWA] Service Worker registered:', reg.scope); })
          .catch(function(err) { console.warn('[PWA] Service Worker registration failed:', err); });
      });
    }
  </script>`;

function injectPwaTags(html: string): string {
  let result = html;

  // Always ensure the proper mobile viewport tag is present
  if (!result.includes('name="viewport"')) {
    result = result.replace("<head>", `<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />`);
  } else {
    // Replace any existing viewport meta with our correct one
    result = result.replace(
      /<meta[^>]*name=["']viewport["'][^>]*>/gi,
      `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />`
    );
  }

  if (!html.includes("Inter_400Regular")) {
    result = result.replace("</head>", `${FONT_STYLE}\n</head>`);
  }

  // Always inject icon font CSS for mobile web support
  if (!result.includes("Ionicons")) {
    const iconFontsCss = `<style>
    @font-face { font-family: 'Ionicons'; src: url('/icon-fonts/Ionicons.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'MaterialCommunityIcons'; src: url('/icon-fonts/MaterialCommunityIcons.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'MaterialIcons'; src: url('/icon-fonts/MaterialIcons.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome5_Regular'; src: url('/icon-fonts/FontAwesome5_Regular.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome5_Solid'; src: url('/icon-fonts/FontAwesome5_Solid.ttf') format('truetype'); font-display: block; }
    @font-face { font-family: 'FontAwesome5_Brands'; src: url('/icon-fonts/FontAwesome5_Brands.ttf') format('truetype'); font-display: block; }
  </style>`;
    result = result.replace("</head>", `${iconFontsCss}\n</head>`);
  }

  // Always remove any Expo-generated manifest link and replace with ours
  result = result.replace(/<link[^>]*rel=["']manifest["'][^>]*>/gi, "");

  // Always inject our PWA tags and service worker script
  result = result.replace("</head>", `${PWA_TAGS}\n</head>`);

  if (!result.includes("serviceWorker.register")) {
    result = result.replace("</body>", `${SW_SCRIPT}\n</body>`);
  }

  return result;
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    if (process.env.RENDER_EXTERNAL_URL) {
      origins.add(process.env.RENDER_EXTERNAL_URL);
    }

    if (process.env.ALLOWED_ORIGINS) {
      process.env.ALLOWED_ORIGINS.split(",").forEach((o) => {
        origins.add(o.trim());
      });
    }

    const origin = req.header("origin");

    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function setupMobileManifest(app: express.Application) {
  app.use((req: Request, res: Response, next: NextFunction) => {
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

function setupPwaAssets(app: express.Application) {
  const publicPath = path.resolve(process.cwd(), "public");

  // Dedicated route for manifest.json — always accessible with open CORS
  app.get("/manifest.json", (_req: Request, res: Response) => {
    const manifestPath = path.join(publicPath, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return res.status(404).json({ error: "manifest.json not found" });
    }
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(fs.readFileSync(manifestPath, "utf-8"));
  });

  // Dedicated route for service worker — must be served from root scope
  app.get("/sw.js", (_req: Request, res: Response) => {
    const swPath = path.join(publicPath, "sw.js");
    if (!fs.existsSync(swPath)) {
      return res.status(404).send("// sw not found");
    }
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "no-cache");
    return res.send(fs.readFileSync(swPath, "utf-8"));
  });

  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath, { setHeaders: (res, filePath) => {
      if (filePath.endsWith(".png") || filePath.endsWith(".jpg") || filePath.endsWith(".ico")) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    }}));
    log("PWA assets served from /public");
  }
}

function setupWebProxy(app: express.Application) {
  const EXPO_WEB_PORT = 8000;

  log(`Development mode: proxying web requests to Expo web server on port ${EXPO_WEB_PORT}`);

  app.use(
    createProxyMiddleware({
      target: `http://localhost:${EXPO_WEB_PORT}`,
      changeOrigin: true,
      ws: true,
      selfHandleResponse: true,
      proxyTimeout: 60000,
      timeout: 60000,
      headers: {
        host: `localhost:${EXPO_WEB_PORT}`,
      },
      on: {
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, _req, res) => {
          const contentType = proxyRes.headers["content-type"] || "";
          // Disable caching for JS bundles too so updates are always picked up
          if (contentType.includes("javascript") || contentType.includes("application/json")) {
            (res as Response).setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
            (res as Response).setHeader("Pragma", "no-cache");
            return responseBuffer;
          }
          if (!contentType.includes("text/html")) {
            return responseBuffer;
          }
          (res as Response).setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          (res as Response).setHeader("Pragma", "no-cache");
          const html = responseBuffer.toString("utf-8");
          return injectPwaTags(html);
        }),
        error: (_err, _req, res) => {
          if (res && "status" in res) {
            (res as Response).status(503).send(
              `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0D1F35;color:#fff">
              <div style="text-align:center">
                <h2>A iniciar o servidor web...</h2>
                <p>Aguarda um momento enquanto o servidor Expo web arranca.</p>
                <script>setTimeout(()=>location.reload(),8000)</script>
              </div>
              </body></html>`,
            );
          }
        },
      },
    }),
  );
}

function setupStaticWeb(app: express.Application) {
  const distPath = path.resolve(process.cwd(), "dist");

  if (fs.existsSync(distPath)) {
    log(`Production mode: serving static web build from ${distPath}`);
    app.use(express.static(distPath));
    app.get("*splat", (_req: Request, res: Response) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, "utf-8");
        const modified = injectPwaTags(html);
        res.setHeader("Content-Type", "text/html");
        res.send(modified);
      } else {
        res.status(404).send("Not Found");
      }
    });
  } else {
    log("WARNING: dist/ folder not found. Run 'npx expo export -p web' to build.");
  }
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

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

  // Serve icon fonts from node_modules for mobile web support
  const iconFontsPath = path.resolve(process.cwd(), "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts");
  app.use("/icon-fonts", express.static(iconFontsPath, {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
    }
  }));

  const server = await registerRoutes(app);
  registerMEDRoutes(app);
  registerPDFRoutes(app);

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
      ...(process.platform === "win32" ? {} : { reusePort: true }),
    },
    () => {
      log(`Express server running on port ${port}`);
      if (process.env.NODE_ENV === "development") {
        log(`Proxying web requests to Expo web server on port 8000`);
      }
    },
  );

  server.setTimeout(120000);
  server.headersTimeout = 120000;
  server.requestTimeout = 120000;
})();
