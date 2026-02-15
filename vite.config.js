import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
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
    emptyOutDir: false, // Don't empty dist folder (fixes permission issues on mounted folders)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: [
        "icon-16.png",
        "icon-32.png",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "FCO Planning App",
        short_name: "FCO Planner",
        description: "Editable planning trees with cross-reference portals.",
        version: buildLabel,
        theme_color: "#07090c",
        background_color: "#07090c",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        navigateFallback: "/index.html",
      },
      devOptions: {
        // Disable PWA in dev by default to avoid stale cache issues
        // Set VITE_PWA_DEV_ENABLED=1 to enable in dev if needed
        enabled: process.env.NODE_ENV === "production" || process.env.VITE_PWA_DEV_ENABLED === "1",
      },
    }),
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
