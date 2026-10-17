import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  optimizeDeps: {
    // 4. prevent Vite from scanning `src-tauri` during dependency discovery
    entries: ["index.html", "src/**/*.{ts,tsx}"],
    exclude: ["@tauri-apps/api", "@tauri-apps/plugin-updater", "@tauri-apps/plugin-dialog"],
  },
  // 5. Exclude heavy assets from production build (downloaded separately via installer)
  build: {
    rollupOptions: {
      external: [/^\/vtuber_chara\/.*/],
    },
  },
  // 6. Prevent copying vtuber_chara to dist during build
  publicDir: "public",
}));
