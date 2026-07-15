import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const NGROK_TARGET = "https://taco-childhood-jailbreak.ngrok-free.dev";

// Local backend (used in dev when running `node server/index.js` locally)
const LOCAL_BACKEND = "http://localhost:3000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.js",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "mask-icon.svg",
        "apple-splash-640x1136.png",
        "apple-splash-1242x2688.png",
        "apple-splash-2048x2732.png",
      ],
      // STEP/IGES conversion uses OpenCascade WebAssembly (~7.6 MB).
      injectManifest: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },

      manifest: {
        name: "Team 935 Scouting App",
        short_name: "935 Scouting",
        description: "My awesome React Progressive Web App",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // In Vite dev mode on localhost, /backend proxies to your LOCAL server.
      // To use ngrok instead, change LOCAL_BACKEND to NGROK_TARGET above.
      "/backend": {
        target: LOCAL_BACKEND,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/backend/, ""),
        headers: {
          "ngrok-skip-browser-warning": "69420",
        },
      },
    },
  },
});
