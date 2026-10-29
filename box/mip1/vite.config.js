import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { base64Packaging } from "./src/hooks/base64Packaging.js";

// Serve the built preview unchanged; Vite's HTML transforms add development URLs.
// Local servers have no ad-network bridge; keep these routes out of builds.
function localMraidFallback() {
  const configureServer = (server) => {
    server.middlewares.use((req, res, next) => {
      const pathname = req.url?.split("?", 1)[0];
      if (
        (req.method === "GET" || req.method === "HEAD") &&
        ["/dist/", "/dist/index.html"].includes(pathname)
      ) {
        const file = resolve(server.config.root, server.config.build.outDir, "index.html");
        readFile(file).then((html) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Content-Length", html.length);
          res.end(req.method === "HEAD" ? undefined : html);
        }).catch((error) => {
          res.statusCode = error.code === "ENOENT" ? 404 : 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Built preview unavailable. Run yarn build first.");
        });
        return;
      }
      if (
        (req.method !== "GET" && req.method !== "HEAD") ||
        !["/mraid.js", "/dist/mraid.js"].includes(pathname)
      ) {
        return next();
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-store");
      res.end();
    });
  };

  return {
    name: "local-mraid-fallback",
    apply: "serve",
    configureServer,
    configurePreviewServer: configureServer,
  };
}

// https://vite.dev/config/
// Serve the actual export before Vite's development HTML transformation.
function localCreativePreview() {
  return {
    name: "local-creative-preview",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!["GET", "HEAD"].includes(req.method)) return next();
        const pathname = req.url?.split("?", 1)[0];
        if (pathname === "/dev.html") {
          // Keep source editing and hot reload available on an explicit route.
          req.url = "/index.html" + req.url.slice(pathname.length);
          return next();
        }
        if (!["/", "/index.html", "/creative.html"].includes(pathname)) return next();

        res.setHeader("Cache-Control", "no-store");
        try {
          const html = await fs.readFile(
            path.resolve(server.config.root, server.config.build.outDir, "index.html"),
          );
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Content-Length", html.length);
          res.end(req.method === "HEAD" ? undefined : html);
        } catch (error) {
          res.statusCode = error.code === "ENOENT" ? 503 : 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(req.method === "HEAD" ? undefined :
            "Built creative unavailable. Run npm run build, then reload this page. Live development is available at /dev.html.");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [localMraidFallback(), localCreativePreview(), react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true }), base64Packaging()],
  build: {
    assetsInlineLimit: () => true,
    modulePreload: false,
  },
  server: {
    host: true,
  },
});
