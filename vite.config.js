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
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
      ],
      manifest: {
        name: "FCO Planning App",
        short_name: "FCO Planner",
        description: "Hierarchical project planning with cross-reference bubbles",
        theme_color: "#0a0f18",
        background_color: "#0a0f18",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cache app shell and static assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Don't cache Firebase/Firestore API calls
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
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
