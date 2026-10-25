import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { base64Packaging } from "./src/hooks/base64Packaging.js";

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true }), base64Packaging()],
  build: {
    assetsInlineLimit: () => true,
    modulePreload: false,
  },
});
