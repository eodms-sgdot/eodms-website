import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { translations } from "./src/i18n.ts";

// Build date in UTC as YYYY.MM.dd
const appVersion = new Date().toISOString().slice(0, 10).replaceAll("-", ".");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appTitle = env.VITE_APP_TITLE || translations.en.appTitle;

  return {
    plugins: [
      react(),
      {
        name: "html-app-title",
        transformIndexHtml(html) {
          return html.replace("%APP_TITLE%", appTitle);
        },
      },
    ],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    },
    server: {
      host: true,
      proxy: {
        "/aaa": {
          target: "http://127.0.0.1:5000",
          changeOrigin: true,
        },
        "/search": {
          target: "https://eodms-sgdot.nrcan-rncan.gc.ca",
          changeOrigin: true,
        },
        "/dds": {
          target: "https://eodms-sgdot.nrcan-rncan.gc.ca",
          changeOrigin: true,
        },
      },
    },
  };
});
