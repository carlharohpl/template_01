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
export default defineConfig(({ mode }) => ({
  plugins: [
    localMraidFallback(), react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true }), base64Packaging(),
  ],
  build: {
    modulePreload: false,
    assetsInlineLimit: () => true,
    outDir: mode === "endscene" ? "dist-endscene" : "dist",
    emptyOutDir: true,
  },
  server: {
    host: true,
  },
}));
