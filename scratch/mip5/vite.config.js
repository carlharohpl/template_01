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
    localMraidFallback(), react(), tailwindcss(), viteSingleFile(),
    mode === "endscene" && {
      name: "standalone-end-scene-output",
      apply: "build",
      enforce: "post",
      generateBundle: {
        order: "post",
        handler(_, bundle) {
          const html = bundle["index.html"];
          html.fileName = "endscene.html";
          bundle["endscene.html"] = html;
          delete bundle["index.html"];
        },
      },
    },
  ],
  build: {
    assetsInlineLimit: 1024 * 1024,
    emptyOutDir: mode !== "endscene",
  },
  server: {
    host: true,
  },
}));
