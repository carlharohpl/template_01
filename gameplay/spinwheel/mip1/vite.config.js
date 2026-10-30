import fs from "node:fs/promises";
import path from "node:path";
import { base64Packaging } from "./src/hooks/base64Packaging.js";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Local servers have no ad-network bridge; keep this fallback out of builds.
function localMraidFallback() {
  const configureServer = (server) => {
    server.middlewares.use((req, res, next) => {
      const pathname = req.url?.split("?", 1)[0];
      if (
        (req.method !== "GET" && req.method !== "HEAD") ||
        pathname !== "/mraid.js"
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
// Reserve /creative.html for the last export; root uses normal Vite HMR.
function localCreativePreview() {
  return {
    name: "local-creative-preview",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!["GET", "HEAD"].includes(req.method)) return next();
        const pathname = req.url?.split("?", 1)[0];
        if (pathname === "/dev.html") {
          // Keep the existing development alias alongside the root page.
          req.url = "/index.html" + req.url.slice(pathname.length);
          return next();
        }
        if (pathname !== "/creative.html") return next();

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
            "Built creative unavailable. Run npm run build when an export is needed, then reload this page. Live development is available at /.");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [localMraidFallback(), localCreativePreview(), react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true }), base64Packaging()],
  build: {
    modulePreload: false,
    assetsInlineLimit: () => true,
  },
  server: {
    host: true,
    port: 5174,
    strictPort: false,
  },
});
