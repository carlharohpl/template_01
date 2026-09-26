import { build, defineConfig } from "vite";
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

// The standalone offer shares the application but never bundles sound assets.
function silentSipAudio() {
  const silentModule = "\0sip3-silent-audio";
  return {
    name: "sip3-silent-audio",
    enforce: "pre",
    resolveId(source) {
      if (/\.(mp3|wav|ogg|m4a)(\?.*)?$/.test(source)) return silentModule;
      if (source === "./components/endscene") return silentModule;
    },
    load(id) {
      if (id === silentModule) return "export default null;";
    },
  };
}

function creativeExports(isSip) {
  return {
    name: "creative-exports",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      if (!isSip) return;
      const html = bundle["index.html"];
      if (!html) throw new Error("The standalone offer HTML was not generated.");
      html.fileName = "sip3.html";
      bundle["sip3.html"] = html;
      delete bundle["index.html"];
    },
    async closeBundle() {
      if (!isSip) await build({ mode: "sip3", build: { emptyOutDir: false } });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [localMraidFallback(), mode === "sip3" && silentSipAudio(), react(), tailwindcss(), viteSingleFile(), creativeExports(mode === "sip3")],
  build: {
    assetsInlineLimit: 1024 * 1024,
  },
  server: {
    host: true,
    port: 5174,
    strictPort: false,
  },
}));
