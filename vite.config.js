import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CERT_PATH = resolve(".certs/fco-planning.local.pem");
const KEY_PATH = resolve(".certs/fco-planning.local-key.pem");

function getHttpsConfig() {
  if (!existsSync(CERT_PATH) || !existsSync(KEY_PATH)) return undefined;
  return {
    cert: readFileSync(CERT_PATH),
    key: readFileSync(KEY_PATH),
  };
}

const httpsConfig = getHttpsConfig();

const now = new Date();
const buildLabel = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_LABEL__: JSON.stringify(buildLabel),
  },
  build: {
    // Clean dist each build to avoid stale assets being served/deployed.
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("/reactflow/")
            || id.includes("/@reactflow/")
            || id.includes("/@xyflow/")
            || id.includes("/d3-")
            || id.includes("/zustand/")
          ) {
            return "vendor-reactflow";
          }
          if (id.includes("/firebase/") || id.includes("/@firebase/") || id.includes("/idb/")) {
            return "vendor-firebase";
          }
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          return "vendor";
        },
      },
    },
  },
  plugins: [
    react(),
  ],
  server: httpsConfig
    ? {
        https: httpsConfig,
      }
    : undefined,
  preview: httpsConfig
    ? {
        host: true,
        https: httpsConfig,
      }
    : undefined,
});
